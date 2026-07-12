(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.healthWeight.v1';
    const PROFILE_KEY = 'netvisualizer.life.healthProfile.v1';
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

    function parseHeight(value) {
        const number = Number(String(value || '').replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(number) || number < 100 || number > 230) return 0;
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

    function getProfile() {
        try {
            const parsed = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
            return {
                heightCm: parseHeight(parsed.heightCm),
            };
        } catch (error) {
            return { heightCm: 0 };
        }
    }

    function saveProfile(nextProfile = {}) {
        const profile = { ...getProfile(), ...nextProfile };
        if (!profile.heightCm) delete profile.heightCm;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return getProfile();
    }

    function getClient() {
        if (!remoteAvailable || typeof getSupabaseClient !== 'function') return null;
        try {
            return typeof getAuthenticatedSupabaseClient === 'function' ? getAuthenticatedSupabaseClient() : null;
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
            renderSyncStatus('Server table missing', 'text-red-600 bg-red-50 border-red-100');
            return;
        }
        console.warn(`${context}: health weight sync failed`, error);
        renderSyncStatus('Server save failed', 'text-amber-600 bg-amber-50 border-amber-100');
    }

    function isMissingCompositeConflictError(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        return code === '42P10'
            || message.includes('no unique or exclusion constraint')
            || message.includes('on conflict')
            || message.includes('user_id');
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

    async function upsertRemoteLogs(client, payload) {
        const { error } = await client
            .from(TABLE_NAME)
            .upsert(payload, { onConflict: 'user_id,log_date' });
        if (!error) return null;
        if (!isMissingCompositeConflictError(error)) return error;
        const fallback = await client
            .from(TABLE_NAME)
            .upsert(payload, { onConflict: 'log_date' });
        return fallback.error || null;
    }

    async function loadRemoteLogs() {
        const client = getClient();
        if (!client) return null;
        renderSyncStatus('Checking server', 'text-sky-600 bg-sky-50 border-sky-100');
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
                    render({ skipRemoteLoad: true, preserveSelectedDate: true });
                    renderSyncStatus('Supabase saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
                    toast('Local weight logs were moved to Supabase.', 'info');
                    return logs;
                }
                return null;
            }
            logs = remoteLogs;
            saveStore(logs);
            if (!selectedDate) selectedDate = getTodayString();
            render({ skipRemoteLoad: true, preserveSelectedDate: true });
            remoteLoaded = true;
            renderSyncStatus('Supabase saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
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
            const error = await upsertRemoteLogs(client, toRemotePayload(normalized));
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('Supabase saved', 'text-emerald-600 bg-emerald-50 border-emerald-100');
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
            const error = await upsertRemoteLogs(client, logs.map(toRemotePayload));
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

    function calculateBmi(weightKg, heightCm) {
        if (!weightKg || !heightCm) return null;
        const heightM = heightCm / 100;
        return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    }

    function getBmiMeta(bmi) {
        if (!bmi) {
            return {
                label: 'Height needed',
                tone: 'text-gray-600',
                border: 'border-gray-200',
                message: 'Enter height once to calculate BMI.',
            };
        }
        if (bmi < 18.5) {
            return {
                label: 'Underweight',
                tone: 'text-sky-700',
                border: 'border-sky-200',
                message: 'BMI is below the adult healthy range.',
            };
        }
        if (bmi < 25) {
            return {
                label: 'Healthy range',
                tone: 'text-emerald-700',
                border: 'border-emerald-200',
                message: 'BMI is within the adult healthy range.',
            };
        }
        if (bmi < 30) {
            return {
                label: 'Overweight',
                tone: 'text-amber-700',
                border: 'border-amber-200',
                message: 'BMI is above the adult healthy range.',
            };
        }
        return {
            label: 'Obesity range',
            tone: 'text-rose-700',
            border: 'border-rose-200',
            message: 'BMI is in the adult obesity range.',
        };
    }

    function getHealthyWeightRange(heightCm) {
        if (!heightCm) return null;
        const heightM = heightCm / 100;
        return {
            min: Math.round(18.5 * heightM * heightM * 10) / 10,
            max: Math.round(24.9 * heightM * heightM * 10) / 10,
        };
    }

    function getBoundarySignal(latest, healthyRange) {
        if (!latest || !healthyRange) return 'Enter height';
        if (latest.weightKg > healthyRange.max) return `${(latest.weightKg - healthyRange.max).toFixed(1)}kg over upper bound`;
        if (latest.weightKg < healthyRange.min) return `${(healthyRange.min - latest.weightKg).toFixed(1)}kg under lower bound`;
        return `${(healthyRange.max - latest.weightKg).toFixed(1)}kg below upper bound`;
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
            <div class="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <h2 class="text-xl md:text-2xl font-bold text-gray-900">Health</h2>
                    <p class="text-xs text-gray-500 mt-1">Weight, BMI, and trend only.</p>
                </div>
                <span id="health-sync-badge" class="text-[10px] font-bold text-sky-600 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-md whitespace-nowrap w-fit">Checking server</span>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-3 md:gap-5 mb-8">
                <aside class="space-y-3">
                    <section class="bg-white p-3 rounded-lg border border-gray-100">
                        <div class="flex items-center justify-between mb-2.5">
                            <h3 class="text-sm font-bold text-gray-900">Today</h3>
                            <p class="text-[10px] text-gray-400" id="health-latest-label">No weight log yet</p>
                        </div>
                        <div class="space-y-2.5">
                            <div>
                                <label class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input id="health-weight-date" type="date" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Weight (kg)</label>
                                <input id="health-weight-input" type="number" min="0" step="0.1" inputmode="decimal" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm font-semibold text-right focus:ring-2 focus:ring-rose-500 outline-none" placeholder="72.4">
                            </div>
                            <div>
                                <label class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Memo</label>
                                <input id="health-weight-note" type="text" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-rose-500 outline-none" placeholder="optional">
                            </div>
                            <details class="border border-gray-100 rounded-md p-2.5">
                                <summary class="cursor-pointer text-[9px] font-bold text-gray-500 uppercase">Profile</summary>
                                <label class="block mt-2.5">
                                    <span class="block text-[9px] font-bold text-gray-500 uppercase mb-1">Height (cm)</span>
                                    <input id="health-height-input" type="number" min="100" max="230" step="0.1" inputmode="decimal" class="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-right focus:ring-2 focus:ring-rose-500 outline-none" placeholder="175">
                                </label>
                            </details>
                            <div class="grid grid-cols-[1fr_auto] gap-2">
                                <button type="button" id="health-save-log" class="px-3 py-1.5 rounded-md bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700">Save</button>
                                <button type="button" id="health-delete-log" class="px-3 py-1.5 rounded-md bg-gray-100 text-gray-600 text-[11px] font-bold hover:bg-gray-200">Delete</button>
                            </div>
                        </div>
                    </section>

                    <section class="bg-white p-4 rounded-lg border border-gray-100">
                        <h3 class="text-sm font-bold text-gray-900 mb-3">Summary</h3>
                        <div class="divide-y divide-gray-100">
                            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2">
                                <p class="text-[10px] font-bold text-gray-400 uppercase">BMI</p>
                                <div>
                                    <p class="text-lg font-bold text-gray-900 leading-tight" id="health-bmi-value">-</p>
                                    <p class="text-[11px] font-bold" id="health-bmi-label">Height needed</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2">
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Range</p>
                                <div>
                                    <p class="text-sm font-bold text-gray-900" id="health-boundary-signal">-</p>
                                    <p class="text-[11px] text-gray-400" id="health-bmi-range-note">BMI 18.5 - 24.9</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2">
                                <p class="text-[10px] font-bold text-gray-400 uppercase">Trend</p>
                                <div>
                                    <p class="text-sm font-bold text-gray-900" id="health-trend-signal">-</p>
                                    <p class="text-[11px] text-gray-400" id="health-average-signal">-</p>
                                </div>
                            </div>
                        </div>
                        <p id="health-management-notes" class="mt-3 text-[11px] leading-relaxed text-gray-500"></p>
                    </section>

                </aside>

                <section class="bg-white p-4 md:p-5 rounded-lg border border-gray-100 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-3">
                        <h3 class="text-sm font-bold text-gray-900">Weight trend</h3>
                        <span class="text-[10px] font-bold text-gray-400" id="health-chart-meta">30 logs</span>
                    </div>
                    <div class="relative h-72 md:h-[420px] w-full">
                        <canvas id="health-weight-chart"></canvas>
                        <div id="health-empty-state" class="hidden absolute inset-0 flex flex-col items-center justify-center text-center bg-white/80">
                            <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                                <i class="fas fa-weight-scale"></i>
                            </div>
                            <p class="text-sm font-bold text-gray-700">No weight logs yet.</p>
                            <p class="text-xs text-gray-400 mt-1">Save today's weight from the form.</p>
                        </div>
                    </div>
                </section>
            </div>
        `;
        isBound = false;
        bindControls();
    }
    function fillForm(log) {
        const normalized = normalizeLog(log || {}) || { date: selectedDate || getTodayString(), weightKg: '', note: '' };
        const dateEl = document.getElementById('health-weight-date');
        const heightEl = document.getElementById('health-height-input');
        const weightEl = document.getElementById('health-weight-input');
        const noteEl = document.getElementById('health-weight-note');
        const profile = getProfile();
        if (dateEl) dateEl.value = normalized.date || getTodayString();
        if (heightEl) heightEl.value = profile.heightCm ? profile.heightCm.toFixed(1).replace(/\.0$/, '') : '';
        if (weightEl) weightEl.value = normalized.weightKg ? normalized.weightKg.toFixed(1) : '';
        if (noteEl) noteEl.value = normalized.note || '';
    }

    function renderSummary() {
        const { sorted, latest, latestAverage, delta } = getSummary();
        const profile = getProfile();
        const heightCm = profile.heightCm;
        const bmi = latest ? calculateBmi(latest.weightKg, heightCm) : null;
        const bmiMeta = getBmiMeta(bmi);
        const healthyRange = getHealthyWeightRange(heightCm);

        const latestEl = document.getElementById('health-latest-label');
        const bmiValueEl = document.getElementById('health-bmi-value');
        const bmiLabelEl = document.getElementById('health-bmi-label');
        const boundaryEl = document.getElementById('health-boundary-signal');
        const bmiRangeNoteEl = document.getElementById('health-bmi-range-note');
        const trendEl = document.getElementById('health-trend-signal');
        const averageEl = document.getElementById('health-average-signal');
        const notesEl = document.getElementById('health-management-notes');

        if (latestEl) latestEl.textContent = latest ? `${latest.date} | ${formatKg(latest.weightKg)}` : 'No weight log yet';
        if (bmiValueEl) bmiValueEl.textContent = bmi ? bmi.toFixed(1) : '-';
        if (bmiLabelEl) {
            bmiLabelEl.textContent = bmiMeta.label;
            bmiLabelEl.className = `text-[11px] font-bold mt-1 ${bmiMeta.tone}`;
        }
        if (boundaryEl) boundaryEl.textContent = getBoundarySignal(latest, healthyRange);
        if (bmiRangeNoteEl) bmiRangeNoteEl.textContent = healthyRange ? `range ${healthyRange.min.toFixed(1)} - ${healthyRange.max.toFixed(1)}kg` : 'enter height once';
        if (trendEl) {
            const sign = delta > 0 ? '+' : '';
            trendEl.textContent = sorted.length > 1 ? `${sign}${delta.toFixed(1)}kg vs previous` : 'Need 2+ logs';
            trendEl.className = `text-sm font-bold ${delta > 0 ? 'text-rose-700' : delta < 0 ? 'text-emerald-700' : 'text-gray-900'}`;
        }
        if (averageEl) averageEl.textContent = latestAverage ? `7-day avg ${latestAverage.toFixed(1)}kg` : '7-day avg waiting';
        if (notesEl) {
            let note = !heightCm ? 'Add height once to unlock BMI.' : bmiMeta.message;
            if (latest && healthyRange && latest.weightKg > healthyRange.max) {
                note = `${(latest.weightKg - healthyRange.max).toFixed(1)}kg above the BMI healthy-range upper bound.`;
            } else if (latest && healthyRange && latest.weightKg < healthyRange.min) {
                note = `${(healthyRange.min - latest.weightKg).toFixed(1)}kg below the BMI healthy-range lower bound.`;
            } else if (delta > 0.5) {
                note = 'Weight is up more than 0.5kg from the previous log.';
            }
            notesEl.textContent = note;
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
        if (metaEl) metaEl.textContent = sorted.length > 0 ? `${sorted.length} logs` : 'Waiting for logs';

        const config = {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Daily weight',
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
                        label: '7-day average',
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
                            label: (context) => ' ' + context.dataset.label + ': ' + Number(context.raw || 0).toFixed(1) + 'kg',
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
    function render(options = {}) {
        ensureShell();
        logs = getStore();
        if (!options.preserveSelectedDate) selectedDate = getTodayString();
        if (!selectedDate) selectedDate = getTodayString();
        renderSummary();
        renderChart();
        fillForm(getSelectedLog() || { date: selectedDate });
        if (remoteAvailable) {
            renderSyncStatus(remoteLoaded ? 'Supabase saved' : 'Checking server', remoteLoaded ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-sky-600 bg-sky-50 border-sky-100');
        } else {
            renderSyncStatus('Server table missing', 'text-red-600 bg-red-50 border-red-100');
        }
        if (!options.skipRemoteLoad) queueRemoteLoad();
    }

    function getFormPayload() {
        const date = document.getElementById('health-weight-date')?.value || getTodayString();
        saveHeightFromInput();
        const weightKg = parseWeight(document.getElementById('health-weight-input')?.value);
        const note = document.getElementById('health-weight-note')?.value || '';
        return normalizeLog({
            date,
            weightKg,
            note,
            updatedAt: new Date().toISOString(),
        });
    }

    function saveHeightFromInput() {
        const heightCm = parseHeight(document.getElementById('health-height-input')?.value);
        saveProfile({ heightCm });
        return heightCm;
    }

    async function saveCurrentLog() {
        const nextLog = getFormPayload();
        if (!nextLog) {
            toast('Check the date and weight.', 'warning');
            return;
        }
        renderSyncStatus('Saving server', 'text-sky-600 bg-sky-50 border-sky-100');
        const synced = await persistLog(nextLog);
        logs = sortLogs([...logs.filter((log) => log.date !== nextLog.date), nextLog]);
        selectedDate = nextLog.date;
        saveStore(logs);
        render({ skipRemoteLoad: true, preserveSelectedDate: true });
        if (!synced) renderSyncStatus('Server save failed', 'text-amber-600 bg-amber-50 border-amber-100');
        toast(synced ? 'Weight log saved to Supabase.' : 'Server save failed. Saved temporarily on this device.', synced ? 'info' : 'warning');
    }

    async function deleteLogByDate(date) {
        if (!date || !logs.some((log) => log.date === date)) return;
        renderSyncStatus('Deleting server', 'text-sky-600 bg-sky-50 border-sky-100');
        const synced = await deleteRemoteLog(date);
        if (!synced) {
            toast('Server delete failed. Try again later.', 'warning');
            render({ skipRemoteLoad: true, preserveSelectedDate: true });
            renderSyncStatus('Server save failed', 'text-amber-600 bg-amber-50 border-amber-100');
            return;
        }
        logs = logs.filter((log) => log.date !== date);
        selectedDate = logs[logs.length - 1]?.date || getTodayString();
        saveStore(logs);
        render({ skipRemoteLoad: true, preserveSelectedDate: true });
        toast('Weight log deleted from Supabase.', 'info');
    }

    function selectDate(date) {
        selectedDate = date || getTodayString();
        render({ skipRemoteLoad: true, preserveSelectedDate: true });
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
        document.getElementById('health-height-input')?.addEventListener('change', () => {
            saveHeightFromInput();
            render({ skipRemoteLoad: true, preserveSelectedDate: true });
        });
        document.getElementById('health-weight-input')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') saveCurrentLog();
        });
    }

    window.HealthTrackerFeature = {
        bindControls,
        render,
    };
})(window);
