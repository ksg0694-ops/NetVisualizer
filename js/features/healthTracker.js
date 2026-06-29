(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.healthWeight.v1';
    const TABLE_NAME = 'health_weight_logs';

    let logs = [];
    let selectedDate = getTodayString();
    let isBound = false;
    let remoteAvailable = true;
    let remoteLoadStarted = false;
    let remoteLoaded = false;

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

    function getTodayString() {
        const now = new Date();
        const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    function parseWeight(value) {
        const number = Number(String(value || '').replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(number) || number <= 0 || number >= 500) return 0;
        return Math.round(number * 10) / 10;
    }

    function normalizeLog(raw = {}) {
        const date = String(raw.date || raw.log_date || '').slice(0, 10);
        const weightKg = parseWeight(raw.weightKg ?? raw.weight_kg);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !weightKg) return null;
        return {
            date,
            weightKg,
            note: String(raw.note || '').trim(),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
        };
    }

    function sortLogs(nextLogs) {
        const byDate = {};
        nextLogs.forEach((item) => {
            const normalized = normalizeLog(item);
            if (!normalized) return;
            const existing = byDate[normalized.date];
            if (!existing || String(normalized.updatedAt) >= String(existing.updatedAt)) byDate[normalized.date] = normalized;
        });
        return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    }

    function getStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (Array.isArray(parsed)) return sortLogs(parsed);
        } catch (error) {
            console.warn('Health weight storage parse failed', error);
        }
        return [];
    }

    function saveStore(nextLogs = logs) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sortLogs(nextLogs)));
    }

    function getClient() {
        if (!remoteAvailable || typeof getSupabaseClient !== 'function') return null;
        try {
            return getSupabaseClient();
        } catch (error) {
            console.warn('Health Supabase client unavailable', error);
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
        remoteLoaded = false;
        if (isMissingTableError(error)) {
            remoteAvailable = false;
            console.warn(`${context}: health weight Supabase table is not ready`, error);
            renderSyncStatus('서버 테이블 없음', 'text-red-600 bg-red-50 border-red-100');
            return;
        }
        console.warn(`${context}: health weight sync failed`, error);
        renderSyncStatus('서버 저장 실패', 'text-amber-600 bg-amber-50 border-amber-100');
    }

    function toRemotePayload(log) {
        const normalized = normalizeLog(log);
        return {
            log_date: normalized.date,
            weight_kg: normalized.weightKg,
            note: normalized.note || null,
            updated_at: normalized.updatedAt || new Date().toISOString(),
        };
    }

    function fromRemoteRow(row) {
        return normalizeLog({
            date: row.log_date,
            weightKg: row.weight_kg,
            note: row.note,
            updatedAt: row.updated_at,
        });
    }

    async function loadRemoteLogs() {
        const client = getClient();
        if (!client) return null;
        renderSyncStatus('서버 확인 중', 'text-sky-600 bg-sky-50 border-sky-100');
        try {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select('log_date,weight_kg,note,updated_at')
                .order('log_date', { ascending: true });
            if (error) throw error;
            const remoteLogs = sortLogs((data || []).map(fromRemoteRow).filter(Boolean));
            const localLogs = getStore();
            if (remoteLogs.length === 0 && localLogs.length > 0) {
                logs = localLogs;
                const migrated = await persistAllLogs();
                if (migrated) {
                    render({ skipRemoteLoad: true });
                    renderSyncStatus('Supabase 저장', 'text-emerald-600 bg-emerald-50 border-emerald-100');
                    toast('이 기기의 체중 기록을 Supabase로 옮겼습니다.', 'info');
                    return logs;
                }
                return null;
            }
            logs = remoteLogs;
            saveStore(logs);
            if (!logs.some((log) => log.date === selectedDate)) selectedDate = logs[logs.length - 1]?.date || getTodayString();
            render({ skipRemoteLoad: true });
            remoteLoaded = true;
            renderSyncStatus('Supabase 저장', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            return logs;
        } catch (error) {
            handleRemoteError(error, 'loadRemoteLogs');
            return null;
        }
    }

    function queueRemoteLoad() {
        if (remoteLoadStarted) return;
        remoteLoadStarted = true;
        loadRemoteLogs();
    }

    async function persistLog(log) {
        const client = getClient();
        const normalized = normalizeLog(log);
        if (!client || !normalized) return false;
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(toRemotePayload(normalized), { onConflict: 'log_date' });
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('Supabase 저장', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistLog');
            return false;
        }
    }

    async function persistAllLogs() {
        const client = getClient();
        if (!client || logs.length === 0) return false;
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(logs.map(toRemotePayload), { onConflict: 'log_date' });
            if (error) throw error;
            remoteLoaded = true;
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistAllLogs');
            return false;
        }
    }

    async function deleteRemoteLog(date) {
        const client = getClient();
        if (!client) return false;
        try {
            const { error } = await client.from(TABLE_NAME).delete().eq('log_date', date);
            if (error) throw error;
            remoteLoaded = true;
            return true;
        } catch (error) {
            handleRemoteError(error, 'deleteRemoteLog');
            return false;
        }
    }

    function getSelectedLog() {
        return logs.find((log) => log.date === selectedDate) || null;
    }

    function formatKg(value) {
        const number = Number(value || 0);
        return number ? `${number.toFixed(1)}kg` : '-';
    }

    function formatDateLabel(value) {
        if (!value) return '-';
        const [, month, day] = String(value).split('-');
        return `${Number(month)}.${Number(day)}`;
    }

    function getRollingAverageForDate(log, allLogs) {
        const target = new Date(`${log.date}T00:00:00`);
        const min = new Date(target);
        min.setDate(target.getDate() - 6);
        const values = allLogs
            .filter((item) => {
                const current = new Date(`${item.date}T00:00:00`);
                return current >= min && current <= target;
            })
            .map((item) => item.weightKg);
        if (values.length === 0) return null;
        const sum = values.reduce((acc, value) => acc + value, 0);
        return Math.round((sum / values.length) * 10) / 10;
    }

    function getSummary() {
        const sorted = sortLogs(logs);
        const latest = sorted[sorted.length - 1] || null;
        const previous = sorted[sorted.length - 2] || null;
        const latestAverage = latest ? getRollingAverageForDate(latest, sorted) : null;
        const delta = latest && previous ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10 : 0;
        return { sorted, latest, previous, latestAverage, delta };
    }

    function renderSyncStatus(text, classes) {
        const el = document.getElementById('health-sync-badge');
        if (!el) return;
        el.className = `text-[10px] md:text-xs font-bold border px-2.5 py-1 rounded-lg whitespace-nowrap ${classes}`;
        el.textContent = text;
    }

    function ensureShell() {
        const root = document.getElementById('health-view');
        if (!root || document.getElementById('health-weight-chart')) return;
        root.innerHTML = `
            <div class="mb-3 md:mb-4 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
                <div>
                    <p class="text-[10px] md:text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Life Tool</p>
                    <h2 class="text-xl md:text-2xl font-bold text-gray-900">Health</h2>
                    <p class="text-xs md:text-sm text-gray-500 mt-1">체중을 기록하고 일별 변화와 7일 평균을 같이 봅니다.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <span id="health-sync-badge" class="text-[10px] md:text-xs font-bold text-sky-600 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-lg whitespace-nowrap">서버 확인 중</span>
                    <span class="text-[10px] md:text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg whitespace-nowrap">7일 평균</span>
                </div>
            </div>

            <div class="grid grid-cols-2 xl:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
                <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-rose-500 min-w-0">
                    <p class="text-[10px] md:text-xs font-semibold text-gray-500 truncate">최근 체중</p>
                    <h3 class="text-lg md:text-xl font-bold text-gray-900 truncate" id="health-current-weight">-</h3>
                    <p class="text-[10px] text-gray-400 mt-1 truncate" id="health-current-date">기록 없음</p>
                </div>
                <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-indigo-500 min-w-0">
                    <p class="text-[10px] md:text-xs font-semibold text-gray-500 truncate">직전 기록 대비</p>
                    <h3 class="text-lg md:text-xl font-bold text-gray-900 truncate" id="health-delta-weight">-</h3>
                    <p class="text-[10px] text-gray-400 mt-1 truncate">낮을수록 감량</p>
                </div>
                <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-emerald-500 min-w-0">
                    <p class="text-[10px] md:text-xs font-semibold text-gray-500 truncate">7일 평균</p>
                    <h3 class="text-lg md:text-xl font-bold text-gray-900 truncate" id="health-week-average">-</h3>
                    <p class="text-[10px] text-gray-400 mt-1 truncate">최근 기록일 기준</p>
                </div>
                <div class="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-sky-500 min-w-0">
                    <p class="text-[10px] md:text-xs font-semibold text-gray-500 truncate">기록 수</p>
                    <h3 class="text-lg md:text-xl font-bold text-gray-900 truncate" id="health-log-count">0회</h3>
                    <p class="text-[10px] text-gray-400 mt-1 truncate" id="health-range-label">-</p>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-3 md:gap-4 mb-8">
                <div class="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <div>
                            <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Weight Trend</p>
                            <h3 class="text-base md:text-lg font-bold text-gray-900">일별 체중 / 7일 평균</h3>
                        </div>
                        <span class="text-[10px] font-bold text-gray-400" id="health-chart-meta">최근 30개 기록</span>
                    </div>
                    <div class="relative h-72 md:h-80 w-full">
                        <canvas id="health-weight-chart"></canvas>
                        <div id="health-empty-state" class="hidden absolute inset-0 flex flex-col items-center justify-center text-center bg-white/80">
                            <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                                <i class="fas fa-weight-scale"></i>
                            </div>
                            <p class="text-sm font-bold text-gray-700">아직 체중 기록이 없습니다.</p>
                            <p class="text-xs text-gray-400 mt-1">오른쪽 입력폼에서 오늘 체중을 저장해보세요.</p>
                        </div>
                    </div>
                </div>

                <div class="space-y-3">
                    <div class="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100">
                        <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Daily Log</p>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input id="health-weight-date" type="date" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Weight (kg)</label>
                                <input id="health-weight-input" type="number" min="0" step="0.1" inputmode="decimal" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg font-bold text-right focus:ring-2 focus:ring-rose-500 outline-none" placeholder="예: 72.4">
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Memo</label>
                                <input id="health-weight-note" type="text" class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" placeholder="예: 운동 후, 공복">
                            </div>
                            <div class="grid grid-cols-[1fr_auto] gap-2">
                                <button type="button" id="health-save-log" class="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700">저장</button>
                                <button type="button" id="health-delete-log" class="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold hover:bg-gray-200">삭제</button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-100">
                        <div class="flex items-center justify-between gap-2 mb-3">
                            <p class="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Logs</p>
                            <span class="text-[10px] text-gray-400">최근 10개</span>
                        </div>
                        <div id="health-log-list" class="space-y-2"></div>
                    </div>
                </div>
            </div>
        `;
        isBound = false;
        bindControls();
    }

    function fillForm(log) {
        const normalized = normalizeLog(log || {}) || { date: selectedDate || getTodayString(), weightKg: '', note: '' };
        const dateEl = document.getElementById('health-weight-date');
        const weightEl = document.getElementById('health-weight-input');
        const noteEl = document.getElementById('health-weight-note');
        if (dateEl) dateEl.value = normalized.date || getTodayString();
        if (weightEl) weightEl.value = normalized.weightKg ? normalized.weightKg.toFixed(1) : '';
        if (noteEl) noteEl.value = normalized.note || '';
    }

    function renderSummary() {
        const { sorted, latest, latestAverage, delta } = getSummary();
        const currentEl = document.getElementById('health-current-weight');
        const dateEl = document.getElementById('health-current-date');
        const deltaEl = document.getElementById('health-delta-weight');
        const averageEl = document.getElementById('health-week-average');
        const countEl = document.getElementById('health-log-count');
        const rangeEl = document.getElementById('health-range-label');

        if (currentEl) currentEl.textContent = latest ? formatKg(latest.weightKg) : '-';
        if (dateEl) dateEl.textContent = latest ? `${latest.date} 기준` : '기록 없음';
        if (averageEl) averageEl.textContent = latestAverage ? formatKg(latestAverage) : '-';
        if (countEl) countEl.textContent = `${sorted.length}회`;
        if (rangeEl) {
            rangeEl.textContent = sorted.length > 1
                ? `${formatDateLabel(sorted[0].date)} ~ ${formatDateLabel(sorted[sorted.length - 1].date)}`
                : (latest ? formatDateLabel(latest.date) : '-');
        }
        if (deltaEl) {
            const sign = delta > 0 ? '+' : '';
            deltaEl.textContent = sorted.length > 1 ? `${sign}${delta.toFixed(1)}kg` : '-';
            deltaEl.className = `text-lg md:text-xl font-bold truncate ${delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : 'text-gray-900'}`;
        }
    }

    function renderChart() {
        const sorted = sortLogs(logs).slice(-30);
        const labels = sorted.map((log) => formatDateLabel(log.date));
        const daily = sorted.map((log) => log.weightKg);
        const averages = sorted.map((log) => getRollingAverageForDate(log, logs));
        const emptyEl = document.getElementById('health-empty-state');
        const metaEl = document.getElementById('health-chart-meta');
        if (emptyEl) emptyEl.classList.toggle('hidden', sorted.length > 0);
        if (metaEl) metaEl.textContent = sorted.length > 0 ? `최근 ${sorted.length}개 기록` : '기록 대기';

        const config = {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: '일별 체중',
                        data: daily,
                        borderColor: '#E11D48',
                        backgroundColor: 'rgba(225, 29, 72, 0.12)',
                        pointBackgroundColor: '#E11D48',
                        pointRadius: 4,
                        pointHoverRadius: 5,
                        tension: 0.25,
                        borderWidth: 2,
                    },
                    {
                        label: '7일 평균',
                        data: averages,
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.08)',
                        pointRadius: 2,
                        borderDash: [6, 4],
                        tension: 0.35,
                        borderWidth: 2,
                    },
                ],
            },
            options: withChartTransitions({
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, usePointStyle: true, font: { size: 11 } },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${context.dataset.label}: ${Number(context.raw || 0).toFixed(1)}kg`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6B7280', font: { size: 11 } },
                    },
                    y: {
                        ticks: {
                            color: '#6B7280',
                            font: { size: 11 },
                            callback: (value) => `${value}kg`,
                        },
                        grid: { color: '#F3F4F6' },
                    },
                },
            }, 420),
        };
        renderOrUpdateChart('healthWeight', 'health-weight-chart', config);
    }

    function renderLogList() {
        const container = document.getElementById('health-log-list');
        if (!container) return;
        const recent = sortLogs(logs).slice(-10).reverse();
        if (recent.length === 0) {
            container.innerHTML = `
                <div class="border border-dashed border-gray-200 rounded-lg p-4 text-center">
                    <p class="text-xs font-bold text-gray-600">저장된 체중 기록이 없습니다.</p>
                    <p class="text-[10px] text-gray-400 mt-1">매일 한 번만 입력해도 추세가 보입니다.</p>
                </div>
            `;
            return;
        }
        container.innerHTML = recent.map((log) => {
            const isActive = log.date === selectedDate;
            return `
                <div class="border rounded-lg p-3 ${isActive ? 'border-rose-300 bg-rose-50/40' : 'border-gray-100 bg-white'}">
                    <div class="flex items-center justify-between gap-3">
                        <button type="button" data-health-edit="${escapeHtml(log.date)}" class="min-w-0 text-left">
                            <p class="text-sm font-bold text-gray-900">${formatKg(log.weightKg)}</p>
                            <p class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(log.date)}</p>
                        </button>
                        <button type="button" data-health-delete="${escapeHtml(log.date)}" class="w-7 h-7 rounded-lg bg-gray-50 text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition">
                            <i class="fas fa-trash text-[10px]"></i>
                        </button>
                    </div>
                    ${log.note ? `<p class="text-[10px] text-gray-500 mt-2 truncate">${escapeHtml(log.note)}</p>` : ''}
                </div>
            `;
        }).join('');
    }

    function render(options = {}) {
        ensureShell();
        logs = getStore();
        if (!selectedDate) selectedDate = logs[logs.length - 1]?.date || getTodayString();
        renderSummary();
        renderChart();
        renderLogList();
        fillForm(getSelectedLog() || { date: selectedDate });
        if (remoteAvailable) {
            renderSyncStatus(remoteLoaded ? 'Supabase 저장' : '서버 확인 중', remoteLoaded ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-sky-600 bg-sky-50 border-sky-100');
        } else {
            renderSyncStatus('서버 테이블 없음', 'text-red-600 bg-red-50 border-red-100');
        }
        if (!options.skipRemoteLoad) queueRemoteLoad();
    }

    function getFormPayload() {
        const date = document.getElementById('health-weight-date')?.value || getTodayString();
        const weightKg = parseWeight(document.getElementById('health-weight-input')?.value);
        const note = document.getElementById('health-weight-note')?.value || '';
        return normalizeLog({
            date,
            weightKg,
            note,
            updatedAt: new Date().toISOString(),
        });
    }

    async function saveCurrentLog() {
        const nextLog = getFormPayload();
        if (!nextLog) {
            toast('날짜와 체중을 확인해주세요.', 'warning');
            return;
        }
        renderSyncStatus('서버 저장 중', 'text-sky-600 bg-sky-50 border-sky-100');
        const synced = await persistLog(nextLog);
        logs = sortLogs([...logs.filter((log) => log.date !== nextLog.date), nextLog]);
        selectedDate = nextLog.date;
        saveStore(logs);
        render({ skipRemoteLoad: true });
        if (!synced) renderSyncStatus('서버 저장 실패', 'text-amber-600 bg-amber-50 border-amber-100');
        toast(synced ? '체중 기록을 Supabase에 저장했습니다.' : '서버 저장에 실패해 이 기기에 임시 보관했습니다.', synced ? 'info' : 'warning');
    }

    async function deleteLogByDate(date) {
        if (!date || !logs.some((log) => log.date === date)) return;
        renderSyncStatus('서버 삭제 중', 'text-sky-600 bg-sky-50 border-sky-100');
        const synced = await deleteRemoteLog(date);
        if (!synced) {
            toast('서버 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.', 'warning');
            render({ skipRemoteLoad: true });
            renderSyncStatus('서버 저장 실패', 'text-amber-600 bg-amber-50 border-amber-100');
            return;
        }
        logs = logs.filter((log) => log.date !== date);
        selectedDate = logs[logs.length - 1]?.date || getTodayString();
        saveStore(logs);
        render({ skipRemoteLoad: true });
        toast('체중 기록을 Supabase에서 삭제했습니다.', 'info');
    }

    function selectDate(date) {
        selectedDate = date || getTodayString();
        render({ skipRemoteLoad: true });
    }

    function bindControls() {
        if (isBound) return;
        isBound = true;
        document.getElementById('health-save-log')?.addEventListener('click', saveCurrentLog);
        document.getElementById('health-delete-log')?.addEventListener('click', () => {
            const date = document.getElementById('health-weight-date')?.value || selectedDate;
            deleteLogByDate(date);
        });
        document.getElementById('health-weight-date')?.addEventListener('change', (event) => selectDate(event.target.value));
        document.getElementById('health-weight-input')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') saveCurrentLog();
        });
        document.getElementById('health-log-list')?.addEventListener('click', (event) => {
            const editButton = event.target.closest('[data-health-edit]');
            const deleteButton = event.target.closest('[data-health-delete]');
            if (deleteButton) {
                deleteLogByDate(deleteButton.dataset.healthDelete);
                return;
            }
            if (editButton) selectDate(editButton.dataset.healthEdit);
        });
    }

    window.HealthTrackerFeature = {
        bindControls,
        render,
    };
})(window);
