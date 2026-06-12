(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.vacationPlan.v1';
    const TABLE_NAME = 'vacation_plans';

    const statusMeta = {
        idea: { label: '후보', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
        researching: { label: '검색중', badge: 'bg-sky-50 text-sky-700 border-sky-100' },
        planned: { label: '계획중', badge: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
        booked: { label: '예약완료', badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
        done: { label: '완료', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
    };

    const priorityMeta = {
        high: { label: '우선', className: 'text-rose-600 bg-rose-50 border-rose-100' },
        medium: { label: '보통', className: 'text-amber-600 bg-amber-50 border-amber-100' },
        low: { label: '나중', className: 'text-gray-600 bg-gray-50 border-gray-100' },
    };

    const defaultPlans = [
        {
            title: '여름 3박 4일',
            destination: '바다 또는 조용한 도시',
            startDate: '',
            endDate: '',
            budgetKrw: 800000,
            status: 'idea',
            priority: 'medium',
            transport: 'KTX 또는 항공권 비교',
            lodging: '숙소 후보 3곳 비교',
            note: '회복 중심. 이동 피로가 적은 후보부터 본다.',
            checklist: [
                { text: '연차 가능일 확인', done: false },
                { text: '숙소 가격대 확인', done: false },
                { text: '교통편 왕복 비용 확인', done: false },
            ],
        },
        {
            title: '짧은 회복 휴가',
            destination: '근교 호텔 또는 온천',
            startDate: '',
            endDate: '',
            budgetKrw: 300000,
            status: 'researching',
            priority: 'high',
            transport: '자차 또는 대중교통',
            lodging: '1박 가능한 숙소',
            note: '금요일 연차 + 주말 조합.',
            checklist: [
                { text: '금요일 연차 후보 잡기', done: false },
                { text: '체크인 시간 확인', done: false },
            ],
        },
    ];

    let plans = [];
    let selectedPlanId = '';
    let isBound = false;
    let remoteAvailable = true;
    let remoteLoadStarted = false;

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[ch]));
    }

    function toast(message, type = 'info', duration = 1600) {
        if (typeof window.showToast === 'function') window.showToast(message, type, duration);
    }

    function getClient() {
        if (!remoteAvailable || typeof getSupabaseClient !== 'function') return null;
        try {
            return getSupabaseClient();
        } catch (error) {
            console.warn('Vacation Plan Supabase client unavailable', error);
            return null;
        }
    }

    function isMissingTableError(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        return code === '42P01'
            || code === 'PGRST205'
            || message.includes('could not find the table')
            || message.includes('does not exist');
    }

    function handleRemoteError(error, context) {
        if (isMissingTableError(error)) {
            remoteAvailable = false;
            console.warn(`${context}: vacation plan Supabase table is not ready`, error);
            return;
        }
        console.warn(`${context}: vacation plan sync failed`, error);
    }

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
            const value = Math.floor(Math.random() * 16);
            const next = char === 'x' ? value : ((value & 0x3) | 0x8);
            return next.toString(16);
        });
    }

    function isUuid(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
    }

    function parseBudget(value) {
        const number = Number(String(value || '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
    }

    function formatMoney(value) {
        const number = Number(value || 0);
        if (!Number.isFinite(number) || number <= 0) return '0원';
        if (number >= 10000) return `${Math.round(number / 10000).toLocaleString()}만원`;
        return `${number.toLocaleString()}원`;
    }

    function formatDateRange(plan) {
        if (plan.startDate && plan.endDate) return `${plan.startDate} ~ ${plan.endDate}`;
        if (plan.startDate) return `${plan.startDate} 출발`;
        return '날짜 미정';
    }

    function normalizeChecklist(value) {
        if (Array.isArray(value)) {
            return value
                .map((item) => ({
                    text: String(item?.text || item || '').trim(),
                    done: item?.done === true,
                }))
                .filter((item) => item.text);
        }
        return String(value || '')
            .split('\n')
            .map((line) => ({ text: line.replace(/^\s*[-*]\s*/, '').trim(), done: false }))
            .filter((item) => item.text);
    }

    function checklistToText(checklist = []) {
        return normalizeChecklist(checklist).map((item) => item.text).join('\n');
    }

    function normalizePlan(raw = {}) {
        const rawId = String(raw.id || '');
        return {
            id: isUuid(rawId) ? rawId : createId(),
            title: String(raw.title || '').trim() || '새 휴가 후보',
            destination: String(raw.destination || '').trim(),
            startDate: raw.startDate || raw.start_date || '',
            endDate: raw.endDate || raw.end_date || '',
            budgetKrw: parseBudget(raw.budgetKrw ?? raw.budget_krw),
            status: statusMeta[raw.status] ? raw.status : 'idea',
            priority: priorityMeta[raw.priority] ? raw.priority : 'medium',
            transport: String(raw.transport || '').trim(),
            lodging: String(raw.lodging || '').trim(),
            note: String(raw.note || '').trim(),
            checklist: normalizeChecklist(raw.checklist),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
        };
    }

    function getStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizePlan);
        } catch (error) {
            console.warn('Vacation Plan storage parse failed', error);
        }
        return defaultPlans.map(normalizePlan);
    }

    function saveStore(nextPlans = plans) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlans.map(normalizePlan)));
    }

    function toRemotePayload(plan) {
        const normalized = normalizePlan(plan);
        return {
            id: normalized.id,
            title: normalized.title,
            destination: normalized.destination || null,
            start_date: normalized.startDate || null,
            end_date: normalized.endDate || null,
            budget_krw: normalized.budgetKrw,
            status: normalized.status,
            priority: normalized.priority,
            transport: normalized.transport || null,
            lodging: normalized.lodging || null,
            note: normalized.note || null,
            checklist: normalized.checklist,
            updated_at: normalized.updatedAt || new Date().toISOString(),
        };
    }

    function fromRemoteRow(row) {
        return normalizePlan({
            id: row.id,
            title: row.title,
            destination: row.destination,
            startDate: row.start_date,
            endDate: row.end_date,
            budgetKrw: row.budget_krw,
            status: row.status,
            priority: row.priority,
            transport: row.transport,
            lodging: row.lodging,
            note: row.note,
            checklist: row.checklist,
            updatedAt: row.updated_at,
        });
    }

    async function loadRemotePlans() {
        const client = getClient();
        if (!client) return null;
        try {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select('*')
                .order('start_date', { ascending: true, nullsFirst: false })
                .order('updated_at', { ascending: false });
            if (error) throw error;
            const remotePlans = (data || []).map(fromRemoteRow);
            if (remotePlans.length === 0 && plans.length > 0) {
                await persistAllPlans();
                return null;
            }
            plans = remotePlans;
            if (!selectedPlanId && plans[0]) selectedPlanId = plans[0].id;
            if (selectedPlanId && !plans.some((plan) => plan.id === selectedPlanId)) selectedPlanId = plans[0]?.id || '';
            saveStore(plans);
            render({ skipRemoteLoad: true });
            return plans;
        } catch (error) {
            handleRemoteError(error, 'loadRemotePlans');
            return null;
        }
    }

    function queueRemoteLoad() {
        if (remoteLoadStarted) return;
        remoteLoadStarted = true;
        loadRemotePlans();
    }

    async function persistPlan(plan) {
        const client = getClient();
        if (!client) return false;
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(toRemotePayload(plan), { onConflict: 'id' });
            if (error) throw error;
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistPlan');
            return false;
        }
    }

    async function persistAllPlans() {
        const client = getClient();
        if (!client || plans.length === 0) return false;
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(plans.map(toRemotePayload), { onConflict: 'id' });
            if (error) throw error;
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistAllPlans');
            return false;
        }
    }

    async function deleteRemotePlan(planId) {
        const client = getClient();
        if (!client) return false;
        try {
            const { error } = await client.from(TABLE_NAME).delete().eq('id', planId);
            if (error) throw error;
            return true;
        } catch (error) {
            handleRemoteError(error, 'deleteRemotePlan');
            return false;
        }
    }

    function getSelectedPlan() {
        return plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;
    }

    function getFormPayload() {
        return normalizePlan({
            id: document.getElementById('vacation-plan-id')?.value || createId(),
            title: document.getElementById('vacation-title')?.value,
            destination: document.getElementById('vacation-destination')?.value,
            startDate: document.getElementById('vacation-start-date')?.value,
            endDate: document.getElementById('vacation-end-date')?.value,
            budgetKrw: document.getElementById('vacation-budget')?.value,
            status: document.getElementById('vacation-status')?.value,
            priority: document.getElementById('vacation-priority')?.value,
            transport: document.getElementById('vacation-transport')?.value,
            lodging: document.getElementById('vacation-lodging')?.value,
            note: document.getElementById('vacation-note')?.value,
            checklist: document.getElementById('vacation-checklist')?.value,
            updatedAt: new Date().toISOString(),
        });
    }

    function fillForm(plan) {
        const normalized = plan ? normalizePlan(plan) : normalizePlan({ id: createId(), title: '' });
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value ?? '';
        };
        setValue('vacation-plan-id', normalized.id);
        setValue('vacation-title', normalized.title === '새 휴가 후보' ? '' : normalized.title);
        setValue('vacation-destination', normalized.destination);
        setValue('vacation-start-date', normalized.startDate);
        setValue('vacation-end-date', normalized.endDate);
        setValue('vacation-budget', normalized.budgetKrw ? normalized.budgetKrw.toLocaleString() : '');
        setValue('vacation-status', normalized.status);
        setValue('vacation-priority', normalized.priority);
        setValue('vacation-transport', normalized.transport);
        setValue('vacation-lodging', normalized.lodging);
        setValue('vacation-note', normalized.note);
        setValue('vacation-checklist', checklistToText(normalized.checklist));
    }

    function ensureShell() {
        const root = document.getElementById('vacation-plan-view');
        if (!root || document.getElementById('vacation-plan-list')) return;
        root.innerHTML = `
            <div class="mb-5 md:mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                <div>
                    <p class="text-[10px] md:text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Life Tool</p>
                    <h2 class="text-xl md:text-2xl font-bold text-gray-900">Vacation Plan</h2>
                    <p class="text-xs md:text-sm text-gray-500 mt-1">연차, 이동, 예산, 예약 상태를 휴가 후보별로 정리합니다.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <span id="vacation-count-badge" class="text-[10px] md:text-xs font-bold text-sky-600 bg-sky-50 border border-sky-100 px-3 py-2 rounded-xl whitespace-nowrap">0 Candidates</span>
                    <span id="vacation-budget-badge" class="text-[10px] md:text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl whitespace-nowrap">0원</span>
                    <span id="vacation-booked-count" class="text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl whitespace-nowrap">0 booked</span>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-4 md:gap-6 mb-8">
                <div class="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Vacation Candidates</p>
                            <h3 class="text-base md:text-lg font-bold text-gray-900">후보 목록</h3>
                        </div>
                        <button type="button" id="vacation-new-plan" class="px-3 py-2 rounded-lg bg-sky-50 text-sky-700 border border-sky-100 text-xs font-bold hover:bg-sky-100">
                            <i class="fas fa-plus mr-1"></i>새 후보
                        </button>
                    </div>
                    <div id="vacation-plan-list" class="space-y-3"></div>
                </div>

                <div class="space-y-4">
                    <div class="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Edit Candidate</p>
                        <input type="hidden" id="vacation-plan-id">
                        <div class="space-y-3">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Title</label>
                                <input id="vacation-title" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="예: 여름 3박 4일">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Destination</label>
                                <input id="vacation-destination" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="예: 부산, 제주, 근교 호텔">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Start</label>
                                    <input id="vacation-start-date" type="date" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">End</label>
                                    <input id="vacation-end-date" type="date" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none">
                                </div>
                            </div>
                            <div class="grid grid-cols-3 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Budget</label>
                                    <input id="vacation-budget" type="text" inputmode="numeric" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-right focus:ring-2 focus:ring-sky-500 outline-none" placeholder="800,000">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Status</label>
                                    <select id="vacation-status" class="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none">
                                        <option value="idea">후보</option>
                                        <option value="researching">검색중</option>
                                        <option value="planned">계획중</option>
                                        <option value="booked">예약완료</option>
                                        <option value="done">완료</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Priority</label>
                                    <select id="vacation-priority" class="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 outline-none">
                                        <option value="high">우선</option>
                                        <option value="medium">보통</option>
                                        <option value="low">나중</option>
                                    </select>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Transport</label>
                                    <input id="vacation-transport" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="항공, KTX, 자차">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Lodging</label>
                                    <input id="vacation-lodging" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none" placeholder="숙소 후보">
                                </div>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Checklist</label>
                                <textarea id="vacation-checklist" rows="4" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none" placeholder="연차 확인&#10;숙소 예약&#10;교통편 확인"></textarea>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Memo</label>
                                <textarea id="vacation-note" rows="3" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none" placeholder="휴가 목적, 조건, 주의할 점"></textarea>
                            </div>
                            <div class="grid grid-cols-[1fr_auto] gap-2">
                                <button type="button" id="vacation-save-plan" class="px-3 py-2 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-700">저장</button>
                                <button type="button" id="vacation-delete-plan" class="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200">삭제</button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                        <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Preparation</p>
                        <div id="vacation-prep-list" class="space-y-3 mb-4"></div>
                        <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Checklist</p>
                        <div id="vacation-checklist-list" class="space-y-2"></div>
                    </div>
                </div>
            </div>
        `;
        isBound = false;
        bindControls();
    }

    function renderSummary() {
        const totalBudget = plans.reduce((sum, plan) => sum + Number(plan.budgetKrw || 0), 0);
        const bookedCount = plans.filter((plan) => plan.status === 'booked').length;
        const countEl = document.getElementById('vacation-count-badge');
        const budgetEl = document.getElementById('vacation-budget-badge');
        const bookedEl = document.getElementById('vacation-booked-count');
        if (countEl) countEl.textContent = `${plans.length.toLocaleString()} Candidates`;
        if (budgetEl) budgetEl.textContent = formatMoney(totalBudget);
        if (bookedEl) bookedEl.textContent = `${bookedCount.toLocaleString()} booked`;
    }

    function renderPlanList() {
        const container = document.getElementById('vacation-plan-list');
        if (!container) return;
        if (plans.length === 0) {
            container.innerHTML = `
                <div class="border border-dashed border-gray-200 rounded-lg p-6 text-center">
                    <p class="text-sm font-bold text-gray-700">등록된 휴가 후보가 없습니다.</p>
                    <p class="text-xs text-gray-400 mt-1">오른쪽 폼에서 첫 후보를 추가하세요.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = plans.map((plan) => {
            const status = statusMeta[plan.status] || statusMeta.idea;
            const priority = priorityMeta[plan.priority] || priorityMeta.medium;
            const isActive = plan.id === selectedPlanId;
            const completed = plan.checklist.filter((item) => item.done).length;
            const checklistLabel = plan.checklist.length > 0
                ? `${completed}/${plan.checklist.length} 준비`
                : '체크리스트 없음';
            return `
                <button type="button" data-vacation-select="${escapeHtml(plan.id)}"
                    class="w-full text-left border rounded-lg p-4 transition bg-white ${isActive ? 'border-sky-300 ring-2 ring-sky-100' : 'border-gray-100 hover:border-sky-200'}">
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-sm md:text-base font-bold text-gray-900 truncate">${escapeHtml(plan.title)}</p>
                            <p class="text-xs text-gray-500 mt-1 truncate">${escapeHtml(plan.destination || '목적지 미정')}</p>
                        </div>
                        <span class="shrink-0 text-[10px] font-bold border px-2 py-1 rounded-full ${status.badge}">${status.label}</span>
                    </div>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                        <div>
                            <p class="text-[10px] font-bold text-gray-400 uppercase">Date</p>
                            <p class="text-xs font-bold text-gray-700 mt-1">${escapeHtml(formatDateRange(plan))}</p>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-gray-400 uppercase">Budget</p>
                            <p class="text-xs font-bold text-gray-700 mt-1">${formatMoney(plan.budgetKrw)}</p>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-gray-400 uppercase">Priority</p>
                            <p class="text-xs font-bold mt-1 inline-flex border rounded-full px-2 py-0.5 ${priority.className}">${priority.label}</p>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-gray-400 uppercase">Ready</p>
                            <p class="text-xs font-bold text-gray-700 mt-1">${checklistLabel}</p>
                        </div>
                    </div>
                    ${plan.note ? `<p class="text-xs text-gray-500 mt-3 line-clamp-2">${escapeHtml(plan.note)}</p>` : ''}
                </button>
            `;
        }).join('');
    }

    function renderPreparation() {
        const container = document.getElementById('vacation-prep-list');
        if (!container) return;
        const selected = getSelectedPlan();
        if (!selected) {
            container.innerHTML = '<p class="text-sm text-gray-400">후보를 선택하면 준비 상태가 표시됩니다.</p>';
            return;
        }
        const items = [
            { label: '날짜', value: formatDateRange(selected), ready: Boolean(selected.startDate) },
            { label: '교통', value: selected.transport || '미정', ready: Boolean(selected.transport) },
            { label: '숙소', value: selected.lodging || '미정', ready: Boolean(selected.lodging) },
            { label: '예산', value: formatMoney(selected.budgetKrw), ready: selected.budgetKrw > 0 },
        ];
        container.innerHTML = items.map((item) => `
            <div class="flex items-center justify-between gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                <span class="text-sm font-medium text-gray-700">${item.label}</span>
                <span class="text-xs font-bold ${item.ready ? 'text-emerald-600' : 'text-amber-600'} text-right">${escapeHtml(item.value)}</span>
            </div>
        `).join('');
    }

    function renderChecklist() {
        const container = document.getElementById('vacation-checklist-list');
        if (!container) return;
        const selected = getSelectedPlan();
        if (!selected || selected.checklist.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400">체크리스트를 줄 단위로 입력하면 여기에 표시됩니다.</p>';
            return;
        }
        container.innerHTML = selected.checklist.map((item, index) => `
            <label class="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100">
                <input type="checkbox" data-vacation-check="${index}" ${item.done ? 'checked' : ''} class="w-4 h-4 accent-sky-600">
                <span class="text-sm font-medium ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}">${escapeHtml(item.text)}</span>
            </label>
        `).join('');
    }

    function render(options = {}) {
        ensureShell();
        plans = getStore();
        if (!selectedPlanId && plans[0]) selectedPlanId = plans[0].id;
        if (selectedPlanId && !plans.some((plan) => plan.id === selectedPlanId)) selectedPlanId = plans[0]?.id || '';
        renderSummary();
        renderPlanList();
        renderPreparation();
        renderChecklist();
        fillForm(getSelectedPlan());
        if (!options.skipRemoteLoad) queueRemoteLoad();
    }

    function saveCurrentPlan() {
        const nextPlan = getFormPayload();
        const existingIndex = plans.findIndex((plan) => plan.id === nextPlan.id);
        if (existingIndex >= 0) plans[existingIndex] = nextPlan;
        else plans.unshift(nextPlan);
        selectedPlanId = nextPlan.id;
        saveStore(plans);
        render({ skipRemoteLoad: true });
        persistPlan(nextPlan).then((synced) => {
            toast(synced ? '휴가 계획을 Supabase에 저장했습니다.' : '휴가 계획을 이 기기에 저장했습니다.', synced ? 'info' : 'warning');
        });
    }

    function newPlan() {
        selectedPlanId = '';
        fillForm(null);
    }

    function deleteSelectedPlan() {
        const selected = getSelectedPlan();
        if (!selected) return;
        plans = plans.filter((plan) => plan.id !== selected.id);
        selectedPlanId = plans[0]?.id || '';
        saveStore(plans);
        render({ skipRemoteLoad: true });
        deleteRemotePlan(selected.id).then((synced) => {
            toast(synced ? '휴가 후보를 삭제했습니다.' : '이 기기에서 휴가 후보를 삭제했습니다.', synced ? 'info' : 'warning');
        });
    }

    function toggleChecklist(index) {
        const selected = getSelectedPlan();
        if (!selected || !selected.checklist[index]) return;
        selected.checklist[index].done = !selected.checklist[index].done;
        selected.updatedAt = new Date().toISOString();
        const targetIndex = plans.findIndex((plan) => plan.id === selected.id);
        if (targetIndex >= 0) plans[targetIndex] = selected;
        saveStore(plans);
        render({ skipRemoteLoad: true });
        persistPlan(selected);
    }

    function bindControls() {
        if (isBound) return;
        isBound = true;
        document.getElementById('vacation-save-plan')?.addEventListener('click', saveCurrentPlan);
        document.getElementById('vacation-new-plan')?.addEventListener('click', newPlan);
        document.getElementById('vacation-delete-plan')?.addEventListener('click', deleteSelectedPlan);
        document.getElementById('vacation-plan-list')?.addEventListener('click', (event) => {
            const button = event.target.closest('[data-vacation-select]');
            if (!button) return;
            selectedPlanId = button.dataset.vacationSelect;
            render({ skipRemoteLoad: true });
        });
        document.getElementById('vacation-checklist-list')?.addEventListener('change', (event) => {
            const input = event.target.closest('[data-vacation-check]');
            if (!input) return;
            toggleChecklist(Number(input.dataset.vacationCheck));
        });
        document.getElementById('vacation-budget')?.addEventListener('blur', (event) => {
            const budget = parseBudget(event.target.value);
            event.target.value = budget ? budget.toLocaleString() : '';
        });
    }

    window.VacationPlanFeature = {
        bindControls,
        render,
    };
})(window);
