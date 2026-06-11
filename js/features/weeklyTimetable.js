(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.weeklyTimetable.v1';
    const TEMPLATE_SYNC_KEY = 'netvisualizer.life.weeklyTimetable.templateSync.v1';
    const REGISTERED_TEMPLATE_KEY = 'netvisualizer.life.weeklyTimetable.registeredTemplate.v1';
    const STEP_MINUTES = 10;
    const FIRST_MINUTE = 6 * 60;
    const LAST_MINUTE = 24 * 60;
    const COMPANY_WORK_START_MINUTE = (8 * 60) + 30;
    const COMPANY_WORK_END_MINUTE = (17 * 60) + 30;
    const hours = Array.from({ length: 18 }, (_, idx) => idx + 6);
    const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

    const typeMeta = {
        focus: { label: '집중', cell: 'bg-sky-50 border-sky-200 text-sky-800', dot: 'bg-sky-500' },
        work: { label: '업무', cell: 'bg-indigo-50 border-indigo-200 text-indigo-800', dot: 'bg-indigo-500' },
        routine: { label: '루틴', cell: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500' },
        recovery: { label: '회복', cell: 'bg-amber-50 border-amber-200 text-amber-800', dot: 'bg-amber-500' },
        movement: { label: '운동', cell: 'bg-rose-50 border-rose-200 text-rose-800', dot: 'bg-rose-500' },
        life: { label: '생활', cell: 'bg-gray-50 border-gray-200 text-gray-800', dot: 'bg-gray-400' },
    };

    const koreanPublicHolidays = {
        '2026-01-01': '신정',
        '2026-02-16': '설날 연휴',
        '2026-02-17': '설날',
        '2026-02-18': '설날 연휴',
        '2026-03-01': '삼일절',
        '2026-03-02': '대체공휴일(삼일절)',
        '2026-05-01': '근로자의 날',
        '2026-05-05': '어린이날',
        '2026-05-24': '부처님오신날',
        '2026-05-25': '대체공휴일(부처님오신날)',
        '2026-06-03': '전국동시지방선거',
        '2026-06-06': '현충일',
        '2026-08-15': '광복절',
        '2026-08-17': '대체공휴일(광복절)',
        '2026-09-24': '추석 연휴',
        '2026-09-25': '추석',
        '2026-09-26': '추석 연휴',
        '2026-10-03': '개천절',
        '2026-10-05': '대체공휴일(개천절)',
        '2026-10-09': '한글날',
        '2026-12-25': '성탄절',
    };

    let activeWeekStart = getIsoWeekStart(new Date());
    let selectedSlot = null;
    let isBound = false;

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[ch]));
    }

    function toast(message, type = 'info', duration = 1800) {
        if (typeof window.showToast === 'function') window.showToast(message, type, duration);
    }

    function addDays(date, days) {
        const next = new Date(date);
        next.setDate(next.getDate() + days);
        return next;
    }

    function getIsoWeekStart(date) {
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);
        const day = target.getDay() || 7;
        target.setDate(target.getDate() - day + 1);
        return target;
    }

    function getIsoWeekInfo(date) {
        const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNumber = target.getUTCDay() || 7;
        target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
        const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
        const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
        return { year: target.getUTCFullYear(), week };
    }

    function formatShortDate(date) {
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }

    function formatIsoDate(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }

    function formatMinute(totalMinutes) {
        const minutes = Math.max(0, Math.min(LAST_MINUTE, Number(totalMinutes) || 0));
        if (minutes === LAST_MINUTE) return '24:00';
        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    function clampMinute(value, fallback = FIRST_MINUTE) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        const stepped = Math.round(numeric / STEP_MINUTES) * STEP_MINUTES;
        return Math.max(FIRST_MINUTE, Math.min(LAST_MINUTE, stepped));
    }

    function getWeekKey(date = activeWeekStart) {
        const info = getIsoWeekInfo(date);
        return `${info.year}-W${String(info.week).padStart(2, '0')}`;
    }

    function getStore() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (error) {
            console.warn('Weekly timetable storage parse failed', error);
            return {};
        }
    }

    function saveStore(store) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    }

    function getTemplateSyncStore() {
        try {
            return JSON.parse(localStorage.getItem(TEMPLATE_SYNC_KEY) || '{}');
        } catch (error) {
            console.warn('Weekly timetable template sync parse failed', error);
            return {};
        }
    }

    function saveTemplateSyncStore(store) {
        localStorage.setItem(TEMPLATE_SYNC_KEY, JSON.stringify(store));
    }

    function cloneRows(rows) {
        return JSON.parse(JSON.stringify(rows || {}));
    }

    function getSlotKey(dayIndex, startMinute) {
        return `${dayIndex}-${startMinute}`;
    }

    function normalizeEvent(rawKey, rawEvent = {}) {
        const [rawDayIndex, rawTimeValue] = String(rawKey || '').split('-').map(Number);
        const dayIndex = Number.isInteger(Number(rawEvent.dayIndex)) ? Number(rawEvent.dayIndex) : rawDayIndex;
        const keyTime = Number.isFinite(rawTimeValue) ? rawTimeValue : FIRST_MINUTE;
        const inferredStart = keyTime < 24 ? keyTime * 60 : keyTime;
        const startMinute = clampMinute(rawEvent.startMinute ?? inferredStart, inferredStart);
        const defaultEnd = Math.min(startMinute + 60, LAST_MINUTE);
        let endMinute = clampMinute(rawEvent.endMinute ?? defaultEnd, defaultEnd);
        if (endMinute <= startMinute) endMinute = Math.min(startMinute + STEP_MINUTES, LAST_MINUTE);
        return {
            ...rawEvent,
            dayIndex: Math.max(0, Math.min(6, Number.isFinite(dayIndex) ? dayIndex : 0)),
            startMinute,
            endMinute,
        };
    }

    function normalizeRows(rows = {}) {
        const normalizedRows = {};
        let changed = false;
        Object.entries(rows).forEach(([key, event]) => {
            const normalized = normalizeEvent(key, event);
            const normalizedKey = getSlotKey(normalized.dayIndex, normalized.startMinute);
            normalizedRows[normalizedKey] = normalized;
            if (normalizedKey !== key) changed = true;
            if (normalized.startMinute !== event?.startMinute || normalized.endMinute !== event?.endMinute || normalized.dayIndex !== event?.dayIndex) changed = true;
        });
        return { rows: normalizedRows, changed };
    }

    function getRegisteredTemplate() {
        try {
            const saved = JSON.parse(localStorage.getItem(REGISTERED_TEMPLATE_KEY) || 'null');
            const rows = saved?.rows || null;
            if (!rows || typeof rows !== 'object') return null;
            return normalizeRows(rows).rows;
        } catch (error) {
            console.warn('Weekly timetable registered template parse failed', error);
            return null;
        }
    }

    function saveRegisteredTemplate(rows) {
        const normalized = normalizeRows(rows).rows;
        localStorage.setItem(REGISTERED_TEMPLATE_KEY, JSON.stringify({
            version: 1,
            updatedAt: new Date().toISOString(),
            rows: normalized,
        }));
    }

    function getHolidayName(date) {
        return koreanPublicHolidays[formatIsoDate(date)] || '';
    }

    function createCompanyWorkEvent(dayIndex) {
        return {
            title: '회사출근',
            type: 'work',
            note: '08:30-17:30, 공휴일 자동 제외',
            dayIndex,
            startMinute: COMPANY_WORK_START_MINUTE,
            endMinute: COMPANY_WORK_END_MINUTE,
        };
    }

    function isCompanyWorkTemplateEvent(event) {
        return event?.title === '회사출근'
            && Number(event.startMinute) === COMPANY_WORK_START_MINUTE
            && Number(event.endMinute) === COMPANY_WORK_END_MINUTE;
    }

    function materializeTemplate(templateRows, weekStart) {
        const normalizedRows = normalizeRows(cloneRows(templateRows)).rows;
        return Object.entries(normalizedRows).reduce((result, [key, event]) => {
            const eventDate = addDays(weekStart, event.dayIndex);
            if (isCompanyWorkTemplateEvent(event) && getHolidayName(eventDate)) return result;
            result[key] = { ...event, updatedAt: undefined };
            return result;
        }, {});
    }

    function addCompanyWorkTemplateBlocks(rows, weekStart) {
        let changed = false;
        for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
            const date = addDays(weekStart, dayIndex);
            if (getHolidayName(date)) continue;
            const key = getSlotKey(dayIndex, COMPANY_WORK_START_MINUTE);
            if (rows[key]) continue;
            rows[key] = createCompanyWorkEvent(dayIndex);
            changed = true;
        }
        return changed;
    }

    function applyCompanyWorkTemplateSync(weekKey, rows, weekStart) {
        const syncStore = getTemplateSyncStore();
        if (syncStore[weekKey]?.companyWorkV1) return false;
        const changed = addCompanyWorkTemplateBlocks(rows, weekStart);
        syncStore[weekKey] = { ...(syncStore[weekKey] || {}), companyWorkV1: true };
        saveTemplateSyncStore(syncStore);
        return changed;
    }

    function createDefaultWeekTemplate(weekStart = activeWeekStart) {
        const registeredTemplate = getRegisteredTemplate();
        if (registeredTemplate) return materializeTemplate(registeredTemplate, weekStart);

        const template = {
            '0-420': { title: '출근 준비', type: 'routine', note: '물, 일정 확인, 이동 준비', dayIndex: 0, startMinute: 420, endMinute: 480 },
            '0-1200': { title: '학습', type: 'focus', note: '이번 주 습득 과제', dayIndex: 0, startMinute: 1200, endMinute: 1260 },
            '1-420': { title: '이동', type: 'movement', note: '가볍게 30분', dayIndex: 1, startMinute: 420, endMinute: 450 },
            '2-1200': { title: '프로젝트', type: 'focus', note: '개인 앱 개선', dayIndex: 2, startMinute: 1200, endMinute: 1260 },
            '3-420': { title: '운동', type: 'movement', note: '근력/유산소 중 선택', dayIndex: 3, startMinute: 420, endMinute: 480 },
            '3-1260': { title: '청소', type: 'life', note: '생활 리셋', dayIndex: 3, startMinute: 1260, endMinute: 1290 },
            '4-1200': { title: '주간 회고', type: 'recovery', note: '다음 주 조정', dayIndex: 4, startMinute: 1200, endMinute: 1230 },
            '5-540': { title: '개인 프로젝트', type: 'focus', note: '오전 집중 블록', dayIndex: 5, startMinute: 540, endMinute: 660 },
            '6-1260': { title: '다음 주 준비', type: 'routine', note: '캘린더와 할 일 정리', dayIndex: 6, startMinute: 1260, endMinute: 1320 },
        };
        addCompanyWorkTemplateBlocks(template, weekStart);
        return template;
    }

    function ensureWeekRows(weekKey) {
        const store = getStore();
        const isNewWeek = !store[weekKey];
        if (isNewWeek) store[weekKey] = createDefaultWeekTemplate(activeWeekStart);
        const normalized = normalizeRows(store[weekKey]);
        store[weekKey] = normalized.rows;
        const companyTemplateChanged = applyCompanyWorkTemplateSync(weekKey, store[weekKey], activeWeekStart);
        if (isNewWeek || normalized.changed || companyTemplateChanged) saveStore(store);
        return store[weekKey];
    }

    function getSlotLabel(dayIndex, startMinute, endMinute = startMinute + 60) {
        const date = addDays(activeWeekStart, dayIndex);
        const dayLabel = dayLabels[dayIndex] || '';
        return `${dayLabel} ${formatShortDate(date)} ${formatMinute(startMinute)} - ${formatMinute(endMinute)}`;
    }

    function getEvents(rows) {
        return Object.entries(rows)
            .map(([key, event]) => ({ key, ...normalizeEvent(key, event) }))
            .sort((a, b) => a.dayIndex - b.dayIndex || a.startMinute - b.startMinute);
    }

    function getDayEventLayouts(dayEvents) {
        const sortedEvents = [...dayEvents].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
        const activeLanes = [];
        const laneEvents = sortedEvents.map(event => {
            for (let idx = activeLanes.length - 1; idx >= 0; idx -= 1) {
                if (activeLanes[idx].endMinute <= event.startMinute) activeLanes.splice(idx, 1);
            }
            const usedLanes = new Set(activeLanes.map(item => item.lane));
            let lane = 0;
            while (usedLanes.has(lane)) lane += 1;
            activeLanes.push({ lane, endMinute: event.endMinute });
            return { ...event, lane };
        });

        const getMaxConcurrentCount = (event) => {
            const checkPoints = new Set([event.startMinute]);
            laneEvents.forEach(other => {
                if (other.startMinute > event.startMinute && other.startMinute < event.endMinute) checkPoints.add(other.startMinute);
                if (other.endMinute > event.startMinute && other.endMinute < event.endMinute) checkPoints.add(other.endMinute);
            });
            return Math.max(1, ...Array.from(checkPoints).map(point =>
                laneEvents.filter(other => other.startMinute <= point && other.endMinute > point).length
            ));
        };

        return laneEvents.map(event => {
            const laneCount = Math.max(getMaxConcurrentCount(event), event.lane + 1, 1);
            return { ...event, laneCount };
        });
    }

    function formatDuration(minutes) {
        const rounded = Math.round(minutes / STEP_MINUTES) * STEP_MINUTES;
        if (rounded % 60 === 0) return `${rounded / 60}h`;
        return `${(rounded / 60).toFixed(1)}h`;
    }

    function getEditorTimeSelection() {
        const startEl = document.getElementById('weekly-event-start');
        const endEl = document.getElementById('weekly-event-end');
        const fallbackStart = selectedSlot?.startMinute ?? FIRST_MINUTE;
        const startMinute = clampMinute(startEl?.value, fallbackStart);
        let endMinute = clampMinute(endEl?.value, Math.min(startMinute + 60, LAST_MINUTE));
        if (endMinute <= startMinute) endMinute = Math.min(startMinute + STEP_MINUTES, LAST_MINUTE);
        return { startMinute, endMinute };
    }

    function renderTimeOptions(startMinute, endMinute) {
        const startEl = document.getElementById('weekly-event-start');
        const endEl = document.getElementById('weekly-event-end');
        if (!startEl || !endEl) return;

        const startOptions = [];
        for (let minute = FIRST_MINUTE; minute < LAST_MINUTE; minute += STEP_MINUTES) {
            startOptions.push(`<option value="${minute}" ${minute === startMinute ? 'selected' : ''}>${formatMinute(minute)}</option>`);
        }
        startEl.innerHTML = startOptions.join('');

        const endOptions = [];
        for (let minute = FIRST_MINUTE + STEP_MINUTES; minute <= LAST_MINUTE; minute += STEP_MINUTES) {
            endOptions.push(`<option value="${minute}" ${minute <= startMinute ? 'disabled' : ''} ${minute === endMinute ? 'selected' : ''}>${formatMinute(minute)}</option>`);
        }
        endEl.innerHTML = endOptions.join('');
        startEl.value = String(startMinute);
        endEl.value = String(endMinute);
    }

    function updateSelectedLabelFromEditor() {
        if (!selectedSlot) return;
        const selectedEl = document.getElementById('weekly-selected-slot');
        const { startMinute, endMinute } = getEditorTimeSelection();
        selectedSlot.startMinute = startMinute;
        selectedSlot.endMinute = endMinute;
        if (selectedEl) selectedEl.textContent = getSlotLabel(selectedSlot.dayIndex, startMinute, endMinute);
        renderTimeOptions(startMinute, endMinute);
    }

    function render() {
        const grid = document.getElementById('weekly-calendar-grid');
        if (!grid) return;

        const weekInfo = getIsoWeekInfo(activeWeekStart);
        const weekKey = getWeekKey(activeWeekStart);
        const weekRows = ensureWeekRows(weekKey);
        const weekEnd = addDays(activeWeekStart, 6);
        const labelEl = document.getElementById('weekly-week-label');
        const rangeEl = document.getElementById('weekly-week-range');
        if (labelEl) labelEl.textContent = `${weekInfo.year} W${String(weekInfo.week).padStart(2, '0')}`;
        if (rangeEl) rangeEl.textContent = `${formatShortDate(activeWeekStart)} - ${formatShortDate(weekEnd)}`;

        const today = formatIsoDate(new Date());
        const selectedKey = selectedSlot?.eventKey || (
            selectedSlot ? getSlotKey(selectedSlot.dayIndex, selectedSlot.startMinute) : ''
        );
        const events = getEvents(weekRows);
        const focusMinutes = events
            .filter(item => ['focus', 'work'].includes(item.type))
            .reduce((sum, item) => sum + Math.max(0, item.endMinute - item.startMinute), 0);
        const blockCountEl = document.getElementById('weekly-block-count');
        const focusHoursEl = document.getElementById('weekly-focus-hours');
        const recoveryCountEl = document.getElementById('weekly-recovery-count');
        if (blockCountEl) blockCountEl.textContent = events.length.toLocaleString();
        if (focusHoursEl) focusHoursEl.textContent = formatDuration(focusMinutes);
        if (recoveryCountEl) recoveryCountEl.textContent = events.filter(item => item.type === 'recovery').length.toLocaleString();

        const calendarStartMinute = FIRST_MINUTE;
        const calendarTotalMinutes = LAST_MINUTE - FIRST_MINUTE;
        const getMinuteTopPct = (minute) => ((minute - calendarStartMinute) / calendarTotalMinutes) * 100;
        const getMinuteHeightPct = (startMinute, endMinute) => ((endMinute - startMinute) / calendarTotalMinutes) * 100;
        const timelineHeightClass = 'h-[1044px] md:h-[1296px]';
        const hourRowPct = 100 / hours.length;

        let html = '<div class="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] md:grid-cols-[64px_repeat(7,minmax(82px,1fr))] gap-px bg-gray-200 border border-gray-200 rounded-xl overflow-hidden w-full">';
        html += '<div class="bg-gray-50 min-h-[46px] md:min-h-[54px]"></div>';
        dayLabels.forEach((dayLabel, idx) => {
            const date = addDays(activeWeekStart, idx);
            const isToday = formatIsoDate(date) === today;
            html += `
                <div class="bg-white min-h-[46px] md:min-h-[54px] flex flex-col items-center justify-center px-0.5 ${isToday ? 'text-indigo-700' : 'text-gray-600'}">
                    <span class="text-[11px] md:text-xs font-black leading-none whitespace-nowrap">${dayLabel}</span>
                    <span class="text-[9px] md:text-xs font-bold mt-1 whitespace-nowrap ${isToday ? 'bg-indigo-600 text-white px-1.5 md:px-2 py-0.5 rounded-full' : ''}">${formatShortDate(date)}</span>
                </div>
            `;
        });

        html += `
            <div class="relative bg-gray-50 ${timelineHeightClass}">
                ${hours.map((hour, index) => `
                    <div class="absolute left-0 right-0 px-1 md:px-2 py-1.5 text-[9px] md:text-[10px] font-bold text-gray-400 whitespace-nowrap border-t border-gray-200 first:border-t-0"
                        style="top:${index * hourRowPct}%;height:${hourRowPct}%">
                        ${String(hour).padStart(2, '0')}:00
                    </div>
                `).join('')}
            </div>
        `;

        dayLabels.forEach((day, dayIndex) => {
            const dayEvents = getDayEventLayouts(events.filter(event => event.dayIndex === dayIndex));
            const isAddingDay = selectedSlot && !selectedSlot.eventKey && selectedSlot.dayIndex === dayIndex;
            html += `
                <div class="relative bg-white ${timelineHeightClass} overflow-hidden ${isAddingDay ? 'bg-indigo-50/30' : ''}">
                    <div class="absolute inset-0 pointer-events-none">
                        ${hours.map((hour, index) => `
                            <div class="absolute left-0 right-0 border-t border-gray-100 ${index === 0 ? 'border-t-0' : ''}" style="top:${index * hourRowPct}%"></div>
                        `).join('')}
                    </div>
                    ${hours.map(hour => {
                        const isAddingHere = selectedSlot && !selectedSlot.eventKey
                            && selectedSlot.dayIndex === dayIndex
                            && Math.floor(selectedSlot.startMinute / 60) === hour;
                        const slotTop = getMinuteTopPct(hour * 60);
                        return `
                            <button type="button" data-weekly-slot="${dayIndex}-${hour}" data-day-index="${dayIndex}" data-hour="${hour}"
                                class="group absolute left-0 right-0 z-0 border border-transparent transition ${isAddingHere ? 'bg-indigo-100/60 ring-2 ring-indigo-400 ring-inset' : 'hover:bg-gray-50/80'}"
                                style="top:${slotTop}%;height:${hourRowPct}%">
                                <span class="absolute right-1 top-1 text-[10px] md:text-xs font-bold text-gray-300 opacity-0 group-hover:opacity-100">+</span>
                            </button>
                        `;
                    }).join('')}
                    ${dayEvents.map(event => {
                        const meta = typeMeta[event.type] || typeMeta.life;
                        const isSelected = event.key === selectedKey;
                        const topPct = getMinuteTopPct(event.startMinute);
                        const heightPct = getMinuteHeightPct(event.startMinute, event.endMinute);
                        const leftPct = (event.lane / event.laneCount) * 100;
                        const widthPct = 100 / event.laneCount;
                        const timeLabel = `${formatMinute(event.startMinute)}-${formatMinute(event.endMinute)}`;
                        return `
                            <button type="button" data-weekly-event-key="${event.key}"
                                class="absolute z-20 text-left rounded-lg border px-1.5 md:px-2 py-1.5 shadow-sm transition overflow-hidden ${meta.cell} ${isSelected ? 'ring-2 ring-indigo-500 ring-inset' : 'hover:brightness-[0.98]'}"
                                style="top:${topPct}%;height:${heightPct}%;min-height:28px;left:calc(${leftPct}% + 4px);width:calc(${widthPct}% - 8px)">
                                <div class="flex items-center gap-1 min-w-0">
                                    <span class="w-1.5 h-1.5 rounded-full ${meta.dot} shrink-0"></span>
                                    <span class="text-[8px] md:text-[9px] font-bold truncate">${timeLabel}</span>
                                </div>
                                <p class="text-[9px] md:text-xs font-bold leading-tight truncate mt-0.5">${escapeHtml(event.title)}</p>
                                ${event.note ? `<p class="hidden md:block text-[10px] opacity-70 mt-1 truncate">${escapeHtml(event.note)}</p>` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        });
        html += '</div>';
        grid.innerHTML = html;

        grid.querySelectorAll('[data-weekly-slot]').forEach(button => {
            button.addEventListener('click', () => {
                selectSlot(Number(button.dataset.dayIndex), Number(button.dataset.hour));
            });
        });
        grid.querySelectorAll('[data-weekly-event-key]').forEach(button => {
            button.addEventListener('click', () => selectEvent(button.dataset.weeklyEventKey));
        });
        syncEditor();
    }

    function selectSlot(dayIndex, hour) {
        const startMinute = hour * 60;
        selectedSlot = {
            dayIndex,
            startMinute,
            endMinute: Math.min(startMinute + 60, LAST_MINUTE),
            eventKey: null,
        };
        syncEditor();
        render();
    }

    function selectEvent(eventKey) {
        const weekRows = ensureWeekRows(getWeekKey(activeWeekStart));
        const event = normalizeEvent(eventKey, weekRows[eventKey]);
        selectedSlot = {
            dayIndex: event.dayIndex,
            startMinute: event.startMinute,
            endMinute: event.endMinute,
            eventKey,
        };
        syncEditor();
        render();
    }

    function syncEditor() {
        const selectedEl = document.getElementById('weekly-selected-slot');
        const titleEl = document.getElementById('weekly-event-title');
        const typeEl = document.getElementById('weekly-event-type');
        const noteEl = document.getElementById('weekly-event-note');
        const startEl = document.getElementById('weekly-event-start');
        const endEl = document.getElementById('weekly-event-end');
        if (!selectedEl || !titleEl || !typeEl || !noteEl || !startEl || !endEl) return;

        if (!selectedSlot) {
            selectedEl.textContent = '슬롯을 선택하세요';
            titleEl.value = '';
            typeEl.value = 'focus';
            noteEl.value = '';
            renderTimeOptions(FIRST_MINUTE, FIRST_MINUTE + 60);
            startEl.disabled = true;
            endEl.disabled = true;
            return;
        }

        startEl.disabled = false;
        endEl.disabled = false;
        const weekRows = ensureWeekRows(getWeekKey(activeWeekStart));
        const event = selectedSlot.eventKey ? weekRows[selectedSlot.eventKey] : null;
        const normalizedEvent = event ? normalizeEvent(selectedSlot.eventKey, event) : null;
        const startMinute = normalizedEvent?.startMinute ?? selectedSlot.startMinute;
        const endMinute = normalizedEvent?.endMinute ?? selectedSlot.endMinute ?? Math.min(startMinute + 60, LAST_MINUTE);
        selectedEl.textContent = getSlotLabel(selectedSlot.dayIndex, startMinute, endMinute);
        titleEl.value = normalizedEvent?.title || '';
        typeEl.value = normalizedEvent?.type || 'focus';
        noteEl.value = normalizedEvent?.note || '';
        renderTimeOptions(startMinute, endMinute);
    }

    function saveSelectedSlot() {
        if (!selectedSlot) {
            toast('먼저 시간 칸을 선택하세요', 'warning');
            return;
        }
        const title = document.getElementById('weekly-event-title')?.value.trim() || '';
        const type = document.getElementById('weekly-event-type')?.value || 'focus';
        const note = document.getElementById('weekly-event-note')?.value.trim() || '';
        const { startMinute, endMinute } = getEditorTimeSelection();
        const store = getStore();
        const weekKey = getWeekKey(activeWeekStart);
        store[weekKey] = ensureWeekRows(weekKey);
        const oldKey = selectedSlot.eventKey;
        const slotKey = getSlotKey(selectedSlot.dayIndex, startMinute);
        if (oldKey && oldKey !== slotKey) delete store[weekKey][oldKey];
        if (!title) delete store[weekKey][oldKey || slotKey];
        else {
            store[weekKey][slotKey] = {
                title,
                type,
                note,
                dayIndex: selectedSlot.dayIndex,
                startMinute,
                endMinute,
                updatedAt: new Date().toISOString(),
            };
            selectedSlot = {
                dayIndex: selectedSlot.dayIndex,
                startMinute,
                endMinute,
                eventKey: slotKey,
            };
        }
        saveStore(store);
        render();
        toast(title ? '시간표를 저장했습니다' : '시간 칸을 비웠습니다', 'info', 1600);
    }

    function deleteSelectedSlot() {
        if (!selectedSlot) {
            toast('먼저 시간 칸을 선택하세요', 'warning');
            return;
        }
        const store = getStore();
        const weekKey = getWeekKey(activeWeekStart);
        store[weekKey] = ensureWeekRows(weekKey);
        const { startMinute } = getEditorTimeSelection();
        const slotKey = selectedSlot.eventKey || getSlotKey(selectedSlot.dayIndex, startMinute);
        if (store[weekKey]) delete store[weekKey][slotKey];
        selectedSlot = null;
        saveStore(store);
        render();
        toast('시간 칸을 비웠습니다', 'info', 1600);
    }

    function registerTemplate() {
        const weekRows = ensureWeekRows(getWeekKey(activeWeekStart));
        const normalizedRows = normalizeRows(weekRows).rows;
        saveRegisteredTemplate(normalizedRows);
        toast('현재 주 시간표를 개인 템플릿으로 등록했습니다.', 'info', 1800);
    }

    function resetTemplate() {
        const store = getStore();
        store[getWeekKey(activeWeekStart)] = createDefaultWeekTemplate(activeWeekStart);
        selectedSlot = null;
        saveStore(store);
        render();
        toast(getRegisteredTemplate() ? '등록된 개인 템플릿으로 초기화했습니다.' : '이번 주 시간표를 기본 템플릿으로 되돌렸습니다.', 'info', 1800);
    }

    function bindControls() {
        if (isBound) return;
        isBound = true;
        document.getElementById('weekly-prev-week')?.addEventListener('click', () => {
            activeWeekStart = addDays(activeWeekStart, -7);
            selectedSlot = null;
            render();
        });
        document.getElementById('weekly-current-week')?.addEventListener('click', () => {
            activeWeekStart = getIsoWeekStart(new Date());
            selectedSlot = null;
            render();
        });
        document.getElementById('weekly-next-week')?.addEventListener('click', () => {
            activeWeekStart = addDays(activeWeekStart, 7);
            selectedSlot = null;
            render();
        });
        document.getElementById('weekly-save-slot')?.addEventListener('click', saveSelectedSlot);
        document.getElementById('weekly-delete-slot')?.addEventListener('click', deleteSelectedSlot);
        document.getElementById('weekly-register-template')?.addEventListener('click', registerTemplate);
        document.getElementById('weekly-reset-template')?.addEventListener('click', resetTemplate);
        document.getElementById('weekly-event-start')?.addEventListener('change', updateSelectedLabelFromEditor);
        document.getElementById('weekly-event-end')?.addEventListener('change', updateSelectedLabelFromEditor);
    }

    window.WeeklyTimetableFeature = {
        bindControls,
        render,
        getWeekKey,
    };
})(window);
