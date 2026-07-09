(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.checklist.v1';
    const TABLE_NAME = 'life_todos';
    const DOMAINS = [
        { key: 'career', label: 'Career', tone: 'sky' },
        { key: 'finance', label: 'Finance', tone: 'emerald' },
        { key: 'life', label: 'Life', tone: 'indigo' },
    ];
    const LEGACY_CATEGORIES = [
        { key: 'today', label: 'Today' },
        { key: 'home', label: 'Home' },
        { key: 'health', label: 'Health' },
        { key: 'admin', label: 'Admin' },
        { key: 'other', label: 'Other' },
    ];
    const QUICK_TASKS = [
        { title: '이력서 / 포트폴리오 점검', domain: 'career' },
        { title: '이번 달 고정비 확인', domain: 'finance' },
        { title: '헬스 기록 남기기', domain: 'life' },
        { title: '계좌 / 카드 확인', domain: 'finance' },
        { title: '답장할 메시지 정리', domain: 'life' },
    ];
    const TONE_CLASSES = {
        sky: 'text-sky-700 bg-sky-50 border-sky-100',
        emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
        slate: 'text-slate-600 bg-slate-50 border-slate-100',
    };

    let tasks = [];
    let activeFilter = 'open';
    let activeDomain = 'all';
    let activeTaskId = null;
    let isBound = false;
    let remoteAvailable = true;
    let remoteLoaded = false;
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

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function toast(message, type = 'info', duration = 1600) {
        if (typeof window.showToast === 'function') window.showToast(message, type, duration);
    }

    function todayString() {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    function createId() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
            const value = Math.random() * 16 | 0;
            return (ch === 'x' ? value : (value & 0x3 | 0x8)).toString(16);
        });
    }

    function getDomain(key) {
        return DOMAINS.find((item) => item.key === key) || DOMAINS[DOMAINS.length - 1];
    }

    function getLegacyCategory(key) {
        return LEGACY_CATEGORIES.find((item) => item.key === key) || LEGACY_CATEGORIES[0];
    }

    function inferDomain(raw = {}) {
        const direct = String(raw.domain || raw.task_domain || '').toLowerCase();
        if (DOMAINS.some((item) => item.key === direct)) return direct;
        const legacy = String(raw.category || raw.category_key || '').toLowerCase();
        if (legacy === 'admin') return 'finance';
        if (legacy === 'health' || legacy === 'home') return 'life';
        return 'life';
    }

    function normalizeStep(raw = {}) {
        if (typeof raw === 'string') {
            const title = raw.trim();
            if (!title) return null;
            return {
                id: createId(),
                title,
                done: false,
                createdAt: new Date().toISOString(),
            };
        }
        const title = String(raw.title || raw.text || raw.name || '').trim();
        if (!title) return null;
        return {
            id: String(raw.id || createId()),
            title,
            done: Boolean(raw.done ?? raw.completed ?? raw.is_done),
            createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
        };
    }

    function normalizeSteps(value) {
        let source = value;
        if (typeof source === 'string') {
            try {
                source = JSON.parse(source);
            } catch (error) {
                source = source.split(/\r?\n/);
            }
        }
        if (!Array.isArray(source)) return [];
        return source
            .map(normalizeStep)
            .filter(Boolean)
            .slice(0, 80);
    }

    function parseStepsText(value, previousSteps = []) {
        const previousByTitle = {};
        previousSteps.forEach((step) => {
            previousByTitle[step.title.trim().toLowerCase()] = step;
        });
        return String(value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 80)
            .map((title) => {
                const previous = previousByTitle[title.toLowerCase()];
                return {
                    id: previous?.id || createId(),
                    title,
                    done: Boolean(previous?.done),
                    createdAt: previous?.createdAt || new Date().toISOString(),
                };
            });
    }

    function stepsToText(steps = []) {
        return steps.map((step) => step.title).join('\n');
    }

    function getStepSummary(task) {
        const total = task.steps.length;
        const done = task.steps.filter((step) => step.done).length;
        return { total, done };
    }

    function normalizeTask(raw = {}) {
        const title = String(raw.title || '').trim();
        if (!title) return null;
        const category = getLegacyCategory(raw.category || raw.category_key || 'today').key;
        const dueDate = String(raw.dueDate || raw.due_date || todayString()).slice(0, 10);
        return {
            id: String(raw.id || createId()),
            title,
            note: String(raw.note || '').trim(),
            category,
            domain: getDomain(inferDomain(raw)).key,
            dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : todayString(),
            priority: raw.priority === 'high' ? 'high' : 'normal',
            steps: normalizeSteps(raw.steps || raw.subtasks || []),
            completed: Boolean(raw.completed ?? raw.is_done),
            completedAt: raw.completedAt || raw.completed_at || null,
            createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
        };
    }

    function sortTasks(nextTasks = []) {
        const byId = {};
        nextTasks.forEach((task) => {
            const normalized = normalizeTask(task);
            if (!normalized) return;
            const existing = byId[normalized.id];
            if (!existing || String(normalized.updatedAt) >= String(existing.updatedAt)) {
                byId[normalized.id] = normalized;
            }
        });
        return Object.values(byId).sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
            if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
            if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
            return String(b.createdAt).localeCompare(String(a.createdAt));
        });
    }

    function getStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(parsed)) return sortTasks(parsed);
        } catch (error) {
            console.warn('Todo storage parse failed', error);
        }
        return [];
    }

    function saveStore(nextTasks = tasks) {
        const normalized = sortTasks(nextTasks);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function getClient() {
        if (!remoteAvailable || typeof getAuthenticatedSupabaseClient !== 'function') return null;
        if (typeof isSignedIn === 'function' && !isSignedIn()) return null;
        try {
            return getAuthenticatedSupabaseClient();
        } catch (error) {
            return null;
        }
    }

    function isMissingSchemaError(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        return code === '42P01'
            || code === 'PGRST204'
            || code === 'PGRST205'
            || message.includes('could not find')
            || message.includes('does not exist')
            || message.includes('schema cache');
    }

    function handleRemoteError(error, context) {
        remoteLoaded = false;
        if (isMissingSchemaError(error)) {
            remoteAvailable = false;
            console.warn(`${context}: todo Supabase schema is not ready`, error);
            renderSyncStatus('Local only', 'text-slate-600 bg-slate-50 border-slate-100');
            return;
        }
        console.warn(`${context}: todo sync failed`, error);
        renderSyncStatus('Sync failed', 'text-amber-600 bg-amber-50 border-amber-100');
    }

    function toRemotePayload(task) {
        const normalized = normalizeTask(task);
        const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
        return {
            id: normalized.id,
            user_id: userId,
            title: normalized.title,
            note: normalized.note || null,
            category: normalized.category,
            domain: normalized.domain,
            steps: normalized.steps,
            due_date: normalized.dueDate,
            priority: normalized.priority,
            is_done: normalized.completed,
            completed_at: normalized.completedAt,
            created_at: normalized.createdAt,
            updated_at: normalized.updatedAt,
        };
    }

    function fromRemoteRow(row) {
        return normalizeTask({
            id: row.id,
            title: row.title,
            note: row.note,
            category: row.category,
            domain: row.domain,
            steps: row.steps,
            dueDate: row.due_date,
            priority: row.priority,
            completed: row.is_done,
            completedAt: row.completed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    async function persistRemoteTask(task) {
        const client = getClient();
        const normalized = normalizeTask(task);
        if (!client || !normalized) return false;
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(toRemotePayload(normalized), { onConflict: 'id' });
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('Cloud saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistRemoteTask');
            return false;
        }
    }

    async function persistAllRemote() {
        const client = getClient();
        if (!client || tasks.length === 0) return false;
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(tasks.map(toRemotePayload), { onConflict: 'id' });
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('Cloud saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistAllRemote');
            return false;
        }
    }

    async function deleteRemoteTask(id) {
        const client = getClient();
        if (!client) return false;
        try {
            const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
            if (error) throw error;
            remoteLoaded = true;
            return true;
        } catch (error) {
            handleRemoteError(error, 'deleteRemoteTask');
            return false;
        }
    }

    async function loadRemoteTasks() {
        const client = getClient();
        if (!client) {
            renderSyncStatus('Local only', 'text-slate-600 bg-slate-50 border-slate-100');
            return null;
        }
        renderSyncStatus('Checking cloud', 'text-sky-600 bg-sky-50 border-sky-100');
        try {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select('id,title,note,category,domain,steps,due_date,priority,is_done,completed_at,created_at,updated_at')
                .order('is_done', { ascending: true })
                .order('due_date', { ascending: true })
                .order('created_at', { ascending: false });
            if (error) throw error;

            const remoteTasks = sortTasks((data || []).map(fromRemoteRow).filter(Boolean));
            const localTasks = getStore();
            tasks = saveStore([...remoteTasks, ...localTasks]);
            if (localTasks.length > 0) await persistAllRemote();
            remoteLoaded = true;
            render({ skipRemoteLoad: true });
            renderSyncStatus('Cloud saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            return tasks;
        } catch (error) {
            handleRemoteError(error, 'loadRemoteTasks');
            return null;
        }
    }

    function queueRemoteLoad() {
        if (remoteLoadStarted) return;
        remoteLoadStarted = true;
        loadRemoteTasks();
    }

    function renderSyncStatus(text, classes) {
        const el = document.getElementById('checklist-sync-badge');
        if (!el) return;
        el.className = `text-[10px] font-bold border px-2.5 py-1 rounded-md whitespace-nowrap ${classes}`;
        el.textContent = text;
    }

    function matchesDomain(task) {
        return activeDomain === 'all' || task.domain === activeDomain;
    }

    function getFilteredTasks() {
        let nextTasks = tasks.filter(matchesDomain);
        if (activeFilter === 'today') {
            const today = todayString();
            nextTasks = nextTasks.filter((task) => task.dueDate <= today && !task.completed);
        } else if (activeFilter === 'done') {
            nextTasks = nextTasks.filter((task) => task.completed);
        } else if (activeFilter !== 'all') {
            nextTasks = nextTasks.filter((task) => !task.completed);
        }
        return nextTasks;
    }

    function getSummary() {
        const open = tasks.filter((task) => !task.completed).length;
        const done = tasks.filter((task) => task.completed).length;
        const dueToday = tasks.filter((task) => !task.completed && task.dueDate <= todayString()).length;
        const total = open + done;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return { open, done, dueToday, total, pct };
    }

    function renderFilterButton(key, label, count) {
        const isActive = activeFilter === key;
        return `
            <button type="button" data-checklist-filter="${key}" class="px-3 py-1.5 rounded-md text-[11px] font-bold border transition ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200'}">
                ${label}${Number.isFinite(count) ? ` ${count}` : ''}
            </button>
        `;
    }

    function renderDomainButton(domain) {
        const isActive = activeDomain === domain.key;
        return `
            <button type="button" data-checklist-domain="${escapeAttr(domain.key)}" class="px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition ${isActive ? 'bg-gray-900 text-white border-gray-900' : `bg-white border-gray-200 ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}`}">
                ${escapeHtml(domain.label)}
            </button>
        `;
    }

    function renderTaskRow(task) {
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        const selectedClass = activeTaskId === task.id ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-100 bg-white hover:border-indigo-200';
        const doneClass = task.completed ? 'opacity-60' : '';
        const titleClass = task.completed ? 'line-through text-gray-400' : 'text-gray-900';
        const priorityBadge = task.priority === 'high'
            ? '<span class="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded">중요</span>'
            : '';
        const stepBadge = stepSummary.total
            ? `<span>${stepSummary.done}/${stepSummary.total} step</span>`
            : '';
        return `
            <li data-checklist-open="${escapeAttr(task.id)}" class="group cursor-pointer flex items-start gap-3 rounded-lg border px-3 py-2.5 transition ${selectedClass} ${doneClass}">
                <input type="checkbox" data-checklist-toggle="${escapeAttr(task.id)}" ${task.completed ? 'checked' : ''} class="mt-1 h-4 w-4 rounded border-gray-300 accent-indigo-600 shrink-0">
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-1.5">
                        <p class="text-sm font-semibold leading-snug ${titleClass}">${escapeHtml(task.title)}</p>
                        ${priorityBadge}
                    </div>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400">
                        <span class="font-bold border px-1.5 py-0.5 rounded ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}">${escapeHtml(domain.label)}</span>
                        <span>${escapeHtml(task.dueDate)}</span>
                        ${stepBadge}
                        ${task.note ? `<span class="truncate max-w-[220px]">${escapeHtml(task.note)}</span>` : ''}
                    </div>
                </div>
                <button type="button" data-checklist-delete="${escapeAttr(task.id)}" class="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-300 hover:text-rose-500 transition px-1 py-0.5" title="Delete">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </li>
        `;
    }

    function renderTasks() {
        const list = document.getElementById('checklist-task-list');
        if (!list) return;
        const visibleTasks = getFilteredTasks();
        if (visibleTasks.length === 0) {
            list.innerHTML = `
                <div class="border border-dashed border-gray-200 rounded-lg bg-white px-4 py-8 text-center">
                    <p class="text-sm font-bold text-gray-700">할일이 없습니다.</p>
                    <p class="text-xs text-gray-400 mt-1">지금 떠오른 일을 하나만 남겨두세요.</p>
                </div>
            `;
            return;
        }
        list.innerHTML = visibleTasks.map(renderTaskRow).join('');
    }

    function renderDetailPanel() {
        const panel = document.getElementById('checklist-detail-panel');
        if (!panel) return;
        const task = tasks.find((item) => item.id === activeTaskId);
        if (!task) {
            panel.innerHTML = `
                <div class="h-full min-h-[220px] rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 flex flex-col justify-center text-center">
                    <p class="text-sm font-bold text-gray-600">선택된 할일 없음</p>
                </div>
            `;
            return;
        }
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        panel.innerHTML = `
            <div class="rounded-lg border border-gray-100 bg-gray-50 p-3 md:p-4">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <span class="inline-flex text-[10px] font-bold border px-2 py-0.5 rounded ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}">${escapeHtml(domain.label)}</span>
                        <h4 class="mt-2 text-base font-black text-gray-900 leading-snug">${escapeHtml(task.title)}</h4>
                        <p class="mt-1 text-[11px] text-gray-400">${escapeHtml(task.dueDate)} · ${stepSummary.done}/${stepSummary.total} step</p>
                    </div>
                </div>

                <div class="mt-4 space-y-3">
                    <label class="block">
                        <span class="text-[11px] font-bold text-gray-500">상세 메모</span>
                        <textarea id="checklist-detail-note-edit" class="mt-1 w-full min-h-[110px] resize-y border border-gray-200 rounded-md px-2.5 py-2 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="상세 메모">${escapeHtml(task.note)}</textarea>
                    </label>

                    <label class="block">
                        <span class="text-[11px] font-bold text-gray-500">스텝 / 서브할일</span>
                        <textarea id="checklist-detail-steps-edit" class="mt-1 w-full min-h-[96px] resize-y border border-gray-200 rounded-md px-2.5 py-2 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="한 줄에 하나씩">${escapeHtml(stepsToText(task.steps))}</textarea>
                    </label>

                    <div class="space-y-1.5">
                        ${task.steps.length ? task.steps.map((step) => `
                            <label class="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                                <input type="checkbox" data-checklist-step-toggle="${escapeAttr(task.id)}" data-step-id="${escapeAttr(step.id)}" ${step.done ? 'checked' : ''} class="mt-0.5 h-3.5 w-3.5 accent-indigo-600 shrink-0">
                                <span class="${step.done ? 'line-through text-gray-400' : ''}">${escapeHtml(step.title)}</span>
                            </label>
                        `).join('') : '<p class="text-xs text-gray-400">등록된 스텝이 없습니다.</p>'}
                    </div>

                    <button type="button" data-checklist-save-detail="${escapeAttr(task.id)}" class="w-full rounded-md bg-gray-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-gray-800">상세 저장</button>
                </div>
            </div>
        `;
    }

    function renderSummary() {
        const summary = getSummary();
        const openEl = document.getElementById('checklist-open-count');
        const todayEl = document.getElementById('checklist-today-count');
        const doneEl = document.getElementById('checklist-done-count');
        const pctEl = document.getElementById('checklist-progress-percent');
        const barEl = document.getElementById('checklist-progress-bar');
        const filtersEl = document.getElementById('checklist-filters');
        const domainsEl = document.getElementById('checklist-domain-filters');
        if (openEl) openEl.textContent = summary.open.toLocaleString();
        if (todayEl) todayEl.textContent = summary.dueToday.toLocaleString();
        if (doneEl) doneEl.textContent = summary.done.toLocaleString();
        if (pctEl) pctEl.textContent = `${summary.pct}%`;
        if (barEl) barEl.style.width = `${summary.pct}%`;
        if (filtersEl) {
            filtersEl.innerHTML = [
                renderFilterButton('open', '열림', summary.open),
                renderFilterButton('today', '오늘', summary.dueToday),
                renderFilterButton('done', '완료', summary.done),
                renderFilterButton('all', '전체', summary.total),
            ].join('');
        }
        if (domainsEl) {
            const allActive = activeDomain === 'all';
            domainsEl.innerHTML = `
                <button type="button" data-checklist-domain="all" class="px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition ${allActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}">All</button>
                ${DOMAINS.map(renderDomainButton).join('')}
            `;
        }
    }

    function ensureShell() {
        const root = document.getElementById('routine-checklist-view');
        if (!root || document.getElementById('checklist-task-list')) return;
        root.innerHTML = `
            <div class="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <p class="text-[10px] md:text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">Life Tool</p>
                    <h2 class="text-xl md:text-2xl font-bold text-gray-900">할일</h2>
                    <p class="text-xs text-gray-500 mt-1">메모와 스텝까지 정리하는 개인 할일 목록.</p>
                </div>
                <span id="checklist-sync-badge" class="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md whitespace-nowrap w-fit">Local only</span>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-3 md:gap-5 mb-8">
                <aside class="space-y-3">
                    <section class="bg-white p-3 rounded-lg border border-gray-100">
                        <div class="grid grid-cols-3 gap-2 text-center">
                            <div class="rounded-md bg-gray-50 border border-gray-100 px-2 py-2">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Open</p>
                                <p id="checklist-open-count" class="text-lg font-black text-gray-900">0</p>
                            </div>
                            <div class="rounded-md bg-indigo-50 border border-indigo-100 px-2 py-2">
                                <p class="text-[10px] text-indigo-400 font-bold uppercase">Today</p>
                                <p id="checklist-today-count" class="text-lg font-black text-indigo-700">0</p>
                            </div>
                            <div class="rounded-md bg-emerald-50 border border-emerald-100 px-2 py-2">
                                <p class="text-[10px] text-emerald-500 font-bold uppercase">Done</p>
                                <p id="checklist-done-count" class="text-lg font-black text-emerald-700">0</p>
                            </div>
                        </div>
                        <div class="mt-3">
                            <div class="flex justify-between text-[10px] text-gray-400 font-bold mb-1">
                                <span>Progress</span>
                                <span id="checklist-progress-percent">0%</span>
                            </div>
                            <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div id="checklist-progress-bar" class="h-full bg-indigo-500 transition-all duration-300" style="width: 0%"></div>
                            </div>
                        </div>
                    </section>

                    <section class="bg-white p-3 rounded-lg border border-gray-100">
                        <h3 class="text-sm font-bold text-gray-900 mb-2.5">할일 추가</h3>
                        <div class="space-y-2">
                            <input id="checklist-title-input" type="text" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="할일">
                            <textarea id="checklist-note-input" class="w-full min-h-[74px] resize-y border border-gray-200 rounded-md px-2.5 py-2 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="상세 메모"></textarea>
                            <textarea id="checklist-steps-input" class="w-full min-h-[74px] resize-y border border-gray-200 rounded-md px-2.5 py-2 text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="스텝 / 서브할일"></textarea>
                            <div class="grid grid-cols-[1fr_1fr] gap-2">
                                <input id="checklist-due-input" type="date" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                                <select id="checklist-domain-input" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                    ${DOMAINS.map((item) => `<option value="${escapeAttr(item.key)}">${escapeHtml(item.label)}</option>`).join('')}
                                </select>
                            </div>
                            <label class="flex items-center gap-2 text-xs font-semibold text-gray-600">
                                <input id="checklist-priority-input" type="checkbox" class="h-3.5 w-3.5 accent-indigo-600">
                                중요
                            </label>
                            <button type="button" id="checklist-add-button" class="w-full rounded-md bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700">추가</button>
                        </div>
                    </section>

                    <section class="bg-white p-3 rounded-lg border border-gray-100">
                        <h3 class="text-sm font-bold text-gray-900 mb-2.5">빠른 추가</h3>
                        <div class="flex flex-wrap gap-1.5">
                            ${QUICK_TASKS.map((item) => `
                                <button type="button" data-checklist-quick="${escapeAttr(item.title)}" data-checklist-domain-value="${escapeAttr(item.domain)}" class="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-600 hover:border-indigo-200 hover:bg-indigo-50">
                                    ${escapeHtml(item.title)}
                                </button>
                            `).join('')}
                        </div>
                    </section>
                </aside>

                <section class="bg-white p-3 md:p-4 rounded-lg border border-gray-100 min-w-0">
                    <div class="flex flex-col gap-2 mb-3">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <h3 class="text-sm font-bold text-gray-900">Item</h3>
                            <div id="checklist-filters" class="flex flex-wrap gap-1.5"></div>
                        </div>
                        <div id="checklist-domain-filters" class="flex flex-wrap gap-1.5"></div>
                    </div>
                    <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
                        <div class="min-w-0">
                            <ul id="checklist-task-list" class="space-y-2"></ul>
                            <div class="mt-3 flex justify-end">
                                <button type="button" id="checklist-clear-done" class="text-[11px] font-bold text-gray-400 hover:text-rose-500">완료 항목 지우기</button>
                            </div>
                        </div>
                        <aside id="checklist-detail-panel" class="min-w-0"></aside>
                    </div>
                </section>
            </div>
        `;
        isBound = false;
        bindControls();
    }

    function render(options = {}) {
        ensureShell();
        tasks = getStore();
        if (activeTaskId && !tasks.some((task) => task.id === activeTaskId)) activeTaskId = null;
        const dueInput = document.getElementById('checklist-due-input');
        if (dueInput && !dueInput.value) dueInput.value = todayString();
        renderSummary();
        renderTasks();
        renderDetailPanel();
        if (remoteAvailable) {
            if (remoteLoaded) renderSyncStatus('Cloud saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            else if (getClient()) renderSyncStatus('Checking cloud', 'text-sky-600 bg-sky-50 border-sky-100');
            else renderSyncStatus('Local only', 'text-slate-600 bg-slate-50 border-slate-100');
        }
        if (!options.skipRemoteLoad) queueRemoteLoad();
    }

    async function addTaskFromForm() {
        const titleEl = document.getElementById('checklist-title-input');
        const noteEl = document.getElementById('checklist-note-input');
        const stepsEl = document.getElementById('checklist-steps-input');
        const dueEl = document.getElementById('checklist-due-input');
        const domainEl = document.getElementById('checklist-domain-input');
        const priorityEl = document.getElementById('checklist-priority-input');
        const task = normalizeTask({
            title: titleEl?.value,
            note: noteEl?.value,
            steps: parseStepsText(stepsEl?.value || ''),
            dueDate: dueEl?.value || todayString(),
            domain: domainEl?.value || 'life',
            priority: priorityEl?.checked ? 'high' : 'normal',
        });
        if (!task) {
            toast('할일을 입력해주세요.', 'warning');
            return;
        }
        tasks = saveStore([task, ...tasks]);
        activeTaskId = task.id;
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
        if (titleEl) titleEl.value = '';
        if (noteEl) noteEl.value = '';
        if (stepsEl) stepsEl.value = '';
        if (priorityEl) priorityEl.checked = false;
        toast('할일을 추가했습니다.', 'info');
    }

    async function addQuickTask(title, domain) {
        const task = normalizeTask({ title, domain, dueDate: todayString() });
        tasks = saveStore([task, ...tasks]);
        activeTaskId = task.id;
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
    }

    async function toggleTask(id) {
        const now = new Date().toISOString();
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        task.completed = !task.completed;
        task.completedAt = task.completed ? now : null;
        task.updatedAt = now;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
    }

    async function toggleStep(taskId, stepId) {
        const now = new Date().toISOString();
        const task = tasks.find((item) => item.id === taskId);
        const step = task?.steps.find((item) => item.id === stepId);
        if (!task || !step) return;
        step.done = !step.done;
        task.updatedAt = now;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
    }

    async function saveTaskDetail(id) {
        const now = new Date().toISOString();
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        const noteEl = document.getElementById('checklist-detail-note-edit');
        const stepsEl = document.getElementById('checklist-detail-steps-edit');
        task.note = String(noteEl?.value || '').trim();
        task.steps = parseStepsText(stepsEl?.value || '', task.steps);
        task.updatedAt = now;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
        toast('상세 내용을 저장했습니다.', 'info');
    }

    async function deleteTask(id) {
        tasks = tasks.filter((item) => item.id !== id);
        if (activeTaskId === id) activeTaskId = null;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await deleteRemoteTask(id);
    }

    async function clearDone() {
        const doneIds = tasks.filter((task) => task.completed).map((task) => task.id);
        if (doneIds.length === 0) return;
        tasks = tasks.filter((task) => !task.completed);
        if (activeTaskId && doneIds.includes(activeTaskId)) activeTaskId = null;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        for (const id of doneIds) await deleteRemoteTask(id);
        toast('완료 항목을 지웠습니다.', 'info');
    }

    function bindControls() {
        if (isBound) return;
        isBound = true;
        const root = document.getElementById('routine-checklist-view');
        root?.addEventListener('click', (event) => {
            const filterBtn = event.target.closest('[data-checklist-filter]');
            if (filterBtn) {
                activeFilter = filterBtn.dataset.checklistFilter || 'open';
                render({ skipRemoteLoad: true });
                return;
            }
            const domainBtn = event.target.closest('[data-checklist-domain]');
            if (domainBtn) {
                activeDomain = domainBtn.dataset.checklistDomain || 'all';
                render({ skipRemoteLoad: true });
                return;
            }
            const quickBtn = event.target.closest('[data-checklist-quick]');
            if (quickBtn) {
                addQuickTask(quickBtn.dataset.checklistQuick || '', quickBtn.dataset.checklistDomainValue || 'life');
                return;
            }
            const saveBtn = event.target.closest('[data-checklist-save-detail]');
            if (saveBtn) {
                saveTaskDetail(saveBtn.dataset.checklistSaveDetail);
                return;
            }
            const deleteBtn = event.target.closest('[data-checklist-delete]');
            if (deleteBtn) {
                deleteTask(deleteBtn.dataset.checklistDelete);
                return;
            }
            const row = event.target.closest('[data-checklist-open]');
            if (row && !event.target.closest('input, button, textarea, select, a')) {
                activeTaskId = row.dataset.checklistOpen;
                render({ skipRemoteLoad: true });
            }
        });
        root?.addEventListener('change', (event) => {
            const stepToggle = event.target.closest('[data-checklist-step-toggle]');
            if (stepToggle) {
                toggleStep(stepToggle.dataset.checklistStepToggle, stepToggle.dataset.stepId);
                return;
            }
            const toggle = event.target.closest('[data-checklist-toggle]');
            if (toggle) toggleTask(toggle.dataset.checklistToggle);
        });
        document.getElementById('checklist-add-button')?.addEventListener('click', addTaskFromForm);
        document.getElementById('checklist-title-input')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') addTaskFromForm();
        });
        document.getElementById('checklist-clear-done')?.addEventListener('click', clearDone);
    }

    window.ChecklistFeature = {
        bindControls,
        render,
    };
})(window);
