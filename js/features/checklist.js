(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.checklist.v1';
    const UI_STATE_KEY = 'netvisualizer.checklist.ui-state.v1';
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
    const TONE_CLASSES = {
        sky: 'text-sky-700 bg-sky-50 border-sky-100',
        emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
        slate: 'text-slate-600 bg-slate-50 border-slate-100',
    };
    const CARD_TONE_CLASSES = {
        sky: {
            base: 'bg-sky-50 border-sky-200 hover:border-sky-300 hover:bg-sky-100/80',
            active: 'bg-sky-100 border-sky-300 ring-2 ring-sky-200',
        },
        emerald: {
            base: 'bg-emerald-50 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-100/80',
            active: 'bg-emerald-100 border-emerald-300 ring-2 ring-emerald-200',
        },
        indigo: {
            base: 'bg-violet-50 border-violet-200 hover:border-violet-300 hover:bg-violet-100/80',
            active: 'bg-violet-100 border-violet-300 ring-2 ring-violet-200',
        },
        slate: {
            base: 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300',
            active: 'bg-slate-100 border-slate-300 ring-2 ring-slate-200',
        },
    };

    function readChecklistUiState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(UI_STATE_KEY) || '{}');
            const validFilters = new Set(['open', 'paused', 'done', 'all']);
            const validDomains = new Set(DOMAINS.map((domain) => domain.key));
            return {
                activeFilter: validFilters.has(parsed.activeFilter) ? parsed.activeFilter : 'open',
                activeDomain: validDomains.has(parsed.activeDomain) ? parsed.activeDomain : 'career',
                activeTaskId: typeof parsed.activeTaskId === 'string' && parsed.activeTaskId ? parsed.activeTaskId : null,
            };
        } catch (error) {
            console.warn('Saved Todo UI state could not be restored.', error);
            return { activeFilter: 'open', activeDomain: 'career', activeTaskId: null };
        }
    }

    const restoredChecklistUiState = readChecklistUiState();

    let tasks = [];
    let activeFilter = restoredChecklistUiState.activeFilter;
    let activeDomain = restoredChecklistUiState.activeDomain;
    let activeTaskId = restoredChecklistUiState.activeTaskId;
    let isBound = false;
    let isAddFormOpen = false;
    let remoteAvailable = true;
    let remoteLoaded = false;
    let remoteLoadStarted = false;
    let remoteSupportsDisplayOrder = true;
    let remoteSupportsUpdate10402 = true;
    let draggedTaskId = null;
    let draggedStepDrag = null;
    let pointerDrag = null;
    let editingTitleTaskId = null;
    let reportLibraryOpen = false;

    function escapeHtml(value) {
        return window.AppUtils.escapeHtml(value);
    }

    function escapeAttr(value) {
        return window.AppUtils.escapeAttr(value);
    }

    function persistChecklistUiState() {
        try {
            localStorage.setItem(UI_STATE_KEY, JSON.stringify({
                activeFilter,
                activeDomain,
                activeTaskId,
                savedAt: new Date().toISOString(),
            }));
        } catch (error) {
            console.warn('Todo UI state could not be saved.', error);
        }
    }

    const NOTE_FORMATS = Object.freeze({
        bold: { open: '**', close: '**', placeholder: '굵게' },
        underline: { open: '++', close: '++', placeholder: '밑줄' },
        strike: { open: '~~', close: '~~', placeholder: '취소선' },
    });

    function formatNotePreview(value) {
        return escapeHtml(String(value || ''))
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
            .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
            .replace(/\n/g, '<br>');
    }

    function renderNoteEditor({ id, value = '', minHeightClass = 'min-h-[180px]', placeholder = '' }) {
        return `
            <div class="mt-1 overflow-hidden rounded-md border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                <div class="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
                    <button type="button" data-checklist-note-format="bold" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-xs font-black text-gray-700 hover:border-indigo-300 hover:text-indigo-700" title="굵게 (**텍스트**)" aria-label="선택한 글자 굵게"><span aria-hidden="true">B</span></button>
                    <button type="button" data-checklist-note-format="underline" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-xs font-bold text-gray-700 underline hover:border-indigo-300 hover:text-indigo-700" title="밑줄 (++텍스트++)" aria-label="선택한 글자 밑줄"><span aria-hidden="true">U</span></button>
                    <button type="button" data-checklist-note-format="strike" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-xs font-bold text-gray-700 line-through hover:border-indigo-300 hover:text-indigo-700" title="취소선 (~~텍스트~~)" aria-label="선택한 글자 취소선"><span aria-hidden="true">S</span></button>
                    <span class="ml-1 text-[10px] text-gray-400">글자를 선택한 뒤 적용</span>
                </div>
                <textarea id="${escapeAttr(id)}" data-checklist-note-editor class="block w-full ${minHeightClass} resize-y border-0 px-3 py-2.5 text-sm leading-relaxed outline-none bg-white focus:ring-0" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea>
                <div data-note-preview-for="${escapeAttr(id)}" class="hidden border-t border-gray-100 bg-gray-50/70 px-3 py-2">
                    <span class="text-[9px] font-bold uppercase tracking-wide text-gray-400">미리보기</span>
                    <div data-note-preview-content class="mt-1 break-words text-sm leading-relaxed text-gray-700"></div>
                </div>
            </div>
        `;
    }

    function updateNotePreview(targetId) {
        const textarea = document.getElementById(targetId);
        const preview = document.querySelector(`[data-note-preview-for="${CSS.escape(targetId)}"]`);
        const content = preview?.querySelector('[data-note-preview-content]');
        if (!textarea || !preview || !content) return;
        const value = textarea.value || '';
        const hasFormatting = /\*\*[^*\n]+\*\*|\+\+[^+\n]+\+\+|~~[^~\n]+~~/.test(value);
        preview.classList.toggle('hidden', !hasFormatting);
        content.innerHTML = hasFormatting ? formatNotePreview(value) : '';
    }

    function applyNoteFormat(targetId, formatKey) {
        const textarea = document.getElementById(targetId);
        const format = NOTE_FORMATS[formatKey];
        if (!textarea || !format) return;
        const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
        const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
        const selected = textarea.value.slice(start, end) || format.placeholder;
        const replacement = `${format.open}${selected}${format.close}`;
        textarea.setRangeText(replacement, start, end, 'end');
        const contentStart = start + format.open.length;
        textarea.setSelectionRange(contentStart, contentStart + selected.length);
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function toast(message, type = 'info', duration = 1600) {
        if (typeof window.showToast === 'function') window.showToast(message, type, duration);
    }

    function ensureDragStyles() {
        if (document.getElementById('checklist-drag-style')) return;
        const style = document.createElement('style');
        style.id = 'checklist-drag-style';
        style.textContent = `
            .checklist-drag-ghost {
                border-radius: 0.5rem;
                box-shadow: 0 18px 38px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.14);
                cursor: grabbing;
                opacity: 0.96;
                pointer-events: none;
                transform-origin: 50% 50%;
                transition: box-shadow 120ms ease, opacity 120ms ease;
                will-change: transform;
            }
            .checklist-drag-placeholder {
                border: 1.5px dashed rgba(99, 102, 241, 0.55);
                border-radius: 0.5rem;
                background: repeating-linear-gradient(
                    135deg,
                    rgba(99, 102, 241, 0.08),
                    rgba(99, 102, 241, 0.08) 8px,
                    rgba(99, 102, 241, 0.14) 8px,
                    rgba(99, 102, 241, 0.14) 16px
                );
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.7);
                transition: height 140ms ease, margin 140ms ease, transform 140ms ease;
            }
            .checklist-drag-source {
                opacity: 0.24 !important;
                pointer-events: none;
                transform: scale(0.985);
            }
            .checklist-dragging * {
                user-select: none;
            }
            [data-checklist-drag-handle],
            [data-step-editor-drag-handle],
            [data-checklist-step-drag-handle] {
                touch-action: none;
            }
        `;
        document.head.appendChild(style);
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

    function renderDomainChoiceButtons(inputId, selectedKey = 'career') {
        const normalizedKey = getDomain(selectedKey).key;
        const visibleDomains = DOMAINS;
        return `
            <input id="${escapeAttr(inputId)}" type="hidden" value="${escapeAttr(normalizedKey)}">
            <div role="radiogroup" aria-label="할 일 그룹" class="mt-1 grid grid-cols-3 gap-1.5">
                ${visibleDomains.map((item) => {
                    const selected = item.key === normalizedKey;
                    return `
                        <button type="button" role="radio" aria-checked="${selected}" data-checklist-domain-choice="${escapeAttr(item.key)}" data-domain-target="${escapeAttr(inputId)}" class="h-9 rounded-md border text-[11px] font-bold transition ${selected ? 'border-gray-900 bg-gray-900 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:text-indigo-600'}">
                            ${escapeHtml(item.label)}
                        </button>
                    `;
                }).join('')}
            </div>
        `;
    }

    function selectDomainChoice(targetId, domainKey) {
        const input = document.getElementById(targetId);
        if (!input) return;
        const selectedKey = getDomain(domainKey).key;
        input.value = selectedKey;
        document.querySelectorAll(`[data-domain-target="${CSS.escape(targetId)}"]`).forEach((button) => {
            const selected = button.dataset.checklistDomainChoice === selectedKey;
            button.setAttribute('aria-checked', String(selected));
            button.className = `h-9 rounded-md border text-[11px] font-bold transition ${
                selected
                    ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:text-indigo-600'
            }`;
        });
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
                groupName: '기본 Step',
                detail: '',
                createdAt: new Date().toISOString(),
            };
        }
        const title = String(raw.title || raw.text || raw.name || '').trim();
        if (!title) return null;
        return {
            id: String(raw.id || createId()),
            title,
            done: Boolean(raw.done ?? raw.completed ?? raw.is_done),
            groupName: String(raw.groupName || raw.group_name || raw.group || '기본 Step').trim() || '기본 Step',
            detail: String(raw.detail || raw.note || '').trim(),
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

    function serializeStepEditorSteps(steps = []) {
        return JSON.stringify(normalizeSteps(steps));
    }

    function parseStepEditorSteps(value, previousSteps = []) {
        const text = String(value || '').trim();
        if (!text) return [];
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) return normalizeSteps(parsed);
        } catch (_ignored) {
            // Legacy line-separated values are converted below.
        }
        return parseStepsText(text, previousSteps);
    }

    function renderStepEditor(textareaId, value = '') {
        const steps = Array.isArray(value)
            ? normalizeSteps(value)
            : parseStepEditorSteps(value);
        return `
            <div data-step-editor data-step-target="${escapeAttr(textareaId)}">
                <textarea id="${escapeAttr(textareaId)}" class="hidden">${escapeHtml(serializeStepEditorSteps(steps))}</textarea>
                <div class="grid grid-cols-[minmax(0,1fr)_120px_32px] gap-1.5">
                    <input type="text" data-step-editor-input class="min-w-0 border border-gray-200 rounded-md px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="Step 입력">
                    <input type="text" data-step-editor-group-input class="min-w-0 border border-gray-200 rounded-md px-2 py-2 text-[11px] outline-none focus:border-indigo-400" placeholder="Subgroup">
                    <button type="button" data-step-editor-add class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-800" title="Step 추가" aria-label="Step 추가">
                        <i class="fas fa-plus text-[10px]"></i>
                    </button>
                </div>
                <div data-step-editor-list class="mt-2 flex flex-col gap-1.5"></div>
            </div>
        `;
    }

    function renderStepEditorList(editor) {
        const textarea = editor?.querySelector('textarea');
        const list = editor?.querySelector('[data-step-editor-list]');
        if (!textarea || !list) return;
        const steps = parseStepEditorSteps(textarea.value);
        if (steps.length === 0) {
            list.innerHTML = '<p class="text-[11px] text-gray-400">Step이 필요하면 하나씩 추가하세요.</p>';
            return;
        }
        list.innerHTML = steps.map((step, index) => `
            <div data-step-editor-item="${index}" class="group/step flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50/70 px-2 py-1.5 text-xs text-gray-700 transition hover:border-gray-300 hover:bg-white">
                <input type="checkbox" data-step-editor-toggle="${index}" ${step.done ? 'checked' : ''} class="h-3.5 w-3.5 shrink-0 rounded border-gray-300 accent-indigo-600">
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold text-gray-400">${index + 1}</span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate ${step.done ? 'line-through text-gray-400' : ''}">${escapeHtml(step.title)}</span>
                    <span class="mt-1 grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)]">
                        <input type="text" data-step-editor-group="${index}" value="${escapeAttr(step.groupName)}" class="min-w-0 rounded border border-gray-200 bg-white/80 px-1.5 py-1 text-[10px] text-gray-500 outline-none focus:border-indigo-300" aria-label="Step subgroup">
                        <input type="text" data-step-editor-detail="${index}" value="${escapeAttr(step.detail)}" class="min-w-0 rounded border border-gray-200 bg-white/80 px-1.5 py-1 text-[10px] text-gray-500 outline-none focus:border-indigo-300" placeholder="Step 상세내역" aria-label="Step 상세내역">
                    </span>
                </span>
                <button type="button" data-step-editor-remove="${index}" class="shrink-0 text-gray-300 hover:text-rose-500" title="삭제">
                    <i class="fas fa-xmark text-xs"></i>
                </button>
                <button type="button" data-step-editor-drag-handle class="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-gray-300 hover:text-gray-700 active:cursor-grabbing" title="Step 순서 이동" aria-label="Step 순서 이동">
                    <i class="fas fa-grip-vertical text-xs"></i>
                </button>
            </div>
        `).join('');
    }

    function hydrateStepEditors() {
        document.querySelectorAll('[data-step-editor]').forEach(renderStepEditorList);
    }

    function addStepFromEditor(editor) {
        const input = editor?.querySelector('[data-step-editor-input]');
        const groupInput = editor?.querySelector('[data-step-editor-group-input]');
        const textarea = editor?.querySelector('textarea');
        if (!input || !textarea) return;
        const title = String(input.value || '').trim();
        if (!title) return;
        const steps = parseStepEditorSteps(textarea.value);
        if (!steps.some((item) => item.title.toLowerCase() === title.toLowerCase())) {
            steps.push(normalizeStep({ title, groupName: groupInput?.value || '기본 Step' }));
            textarea.value = serializeStepEditorSteps(steps);
        }
        input.value = '';
        if (groupInput) groupInput.value = '';
        renderStepEditorList(editor);
    }

    function updateStepMetadata(editor, index, key, value) {
        const textarea = editor?.querySelector('textarea');
        if (!textarea) return;
        const steps = parseStepEditorSteps(textarea.value);
        const step = steps[Number(index)];
        if (!step) return;
        step[key] = String(value || '').trim() || (key === 'groupName' ? '기본 Step' : '');
        textarea.value = serializeStepEditorSteps(steps);
    }

    function removeStepFromEditor(editor, index) {
        const textarea = editor?.querySelector('textarea');
        if (!textarea) return;
        const steps = parseStepEditorSteps(textarea.value);
        steps.splice(Number(index), 1);
        textarea.value = serializeStepEditorSteps(steps);
        renderStepEditorList(editor);
    }

    function toggleStepFromEditor(editor, index) {
        const textarea = editor?.querySelector('textarea');
        if (!textarea) return;
        const steps = parseStepEditorSteps(textarea.value);
        const step = steps[Number(index)];
        if (!step) return;
        step.done = !step.done;
        textarea.value = serializeStepEditorSteps(steps);
        renderStepEditorList(editor);
    }

    function moveArrayItem(items, fromIndex, toIndex) {
        const next = items.slice();
        const from = Number(fromIndex);
        let to = Number(toIndex);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= next.length) return next;
        if (to < 0) to = 0;
        if (to >= next.length) to = next.length - 1;
        if (from === to) return next;
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
    }

    function getDropIndex(event, item) {
        const rect = item.getBoundingClientRect();
        const index = Number(item.dataset.stepEditorItem ?? item.dataset.checklistStepIndex ?? 0);
        return event.clientY > rect.top + rect.height / 2 ? index + 1 : index;
    }

    function getCompactDropIndex(event, item, sourceIndex) {
        const rect = item.getBoundingClientRect();
        const index = Number(item.dataset.stepEditorItem ?? item.dataset.checklistStepIndex ?? 0);
        if (index > sourceIndex && event.clientY > rect.top + rect.height * 0.25) return index + 1;
        if (index < sourceIndex && event.clientY < rect.top + rect.height * 0.75) return index;
        return getDropIndex(event, item);
    }

    function reorderStepEditor(editor, fromIndex, toIndex) {
        const textarea = editor?.querySelector('textarea');
        if (!textarea) return;
        const steps = parseStepEditorSteps(textarea.value);
        const source = Number(fromIndex);
        let destination = Number(toIndex);
        if (!Number.isInteger(source) || !Number.isInteger(destination)) return;
        if (destination > source) destination -= 1;
        textarea.value = serializeStepEditorSteps(moveArrayItem(steps, source, destination));
        renderStepEditorList(editor);
    }

    function assignTaskDisplayOrders(nextTasks) {
        return nextTasks.map((task, index) => ({
            ...task,
            displayOrder: (index + 1) * 1000,
        }));
    }

    function getTopDisplayOrder() {
        const orders = tasks.map((task) => task.displayOrder).filter(Number.isFinite);
        return orders.length ? Math.min(...orders) - 1000 : 1000;
    }

    async function reorderTasks(dragId, targetId, position = 'before') {
        if (!dragId || !targetId || dragId === targetId) return;
        const byId = new Map(tasks.map((task) => [task.id, task]));
        const orderedIds = tasks.map((task) => task.id).filter((id) => id !== dragId);
        const targetIndex = orderedIds.indexOf(targetId);
        if (targetIndex < 0 || !byId.has(dragId)) return;
        orderedIds.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, dragId);
        tasks = assignTaskDisplayOrders(orderedIds.map((id) => byId.get(id)).filter(Boolean));
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistAllRemote();
    }

    async function reorderSavedSteps(taskId, fromIndex, toIndex) {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;
        const source = Number(fromIndex);
        let destination = Number(toIndex);
        if (!Number.isInteger(source) || !Number.isInteger(destination)) return;
        if (destination > source) destination -= 1;
        task.steps = moveArrayItem(task.steps, source, destination);
        task.updatedAt = new Date().toISOString();
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
    }

    function clearDragHints(root = document) {
        root.querySelectorAll('[data-checklist-open], [data-step-editor-item], [data-checklist-step-item]').forEach((item) => {
            item.classList.remove('ring-2', 'ring-indigo-300', 'ring-offset-1');
            item.removeAttribute('data-drop-position');
            item.removeAttribute('data-dragging');
        });
    }

    function createDragVisuals(drag, event) {
        const source = drag.source;
        if (!source || !source.isConnected || drag.ghost) return;
        const rect = source.getBoundingClientRect();
        const placeholder = document.createElement('div');
        placeholder.className = 'checklist-drag-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.marginTop = getComputedStyle(source).marginTop;
        placeholder.style.marginBottom = getComputedStyle(source).marginBottom;
        placeholder.dataset.checklistDragPlaceholder = drag.type;

        const ghost = source.cloneNode(true);
        ghost.classList.add('checklist-drag-ghost');
        ghost.removeAttribute('id');
        ghost.removeAttribute('data-checklist-open');
        ghost.removeAttribute('data-step-editor-item');
        ghost.removeAttribute('data-checklist-step-item');
        ghost.style.position = 'fixed';
        ghost.style.left = '0';
        ghost.style.top = '0';
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.zIndex = '9999';
        ghost.style.margin = '0';

        source.parentNode.insertBefore(placeholder, source.nextSibling);
        source.classList.add('checklist-drag-source');
        document.body.appendChild(ghost);
        document.body.classList.add('checklist-dragging');

        drag.placeholder = placeholder;
        drag.ghost = ghost;
        drag.sourceRect = rect;
        drag.offsetX = event.clientX - rect.left;
        drag.offsetY = event.clientY - rect.top;
        moveDragGhost(drag, event);
    }

    function moveDragGhost(drag, event) {
        if (!drag?.ghost) return;
        const x = event.clientX - drag.offsetX;
        const y = event.clientY - drag.offsetY;
        drag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(-1deg) scale(1.015)`;
    }

    function movePlaceholder(placeholder, target, position = 'before') {
        if (!placeholder || !target || !target.parentNode || placeholder === target) return;
        const anchor = position === 'after' ? target.nextSibling : target;
        if (anchor === placeholder) return;
        target.parentNode.insertBefore(placeholder, anchor);
    }

    function findNearestDropTarget(selector, event, isValidTarget) {
        const items = Array.from(document.querySelectorAll(selector))
            .filter((item) => item !== pointerDrag?.source && item.isConnected && (!isValidTarget || isValidTarget(item)));
        if (items.length === 0) return null;
        return items
            .map((item) => {
                const rect = item.getBoundingClientRect();
                const centerY = rect.top + rect.height / 2;
                return { item, distance: Math.abs(event.clientY - centerY) };
            })
            .sort((a, b) => a.distance - b.distance)[0]?.item || null;
    }

    function clearDragVisuals(drag) {
        drag?.source?.classList.remove('checklist-drag-source');
        drag?.placeholder?.remove();
        drag?.ghost?.remove();
        document.body.classList.remove('checklist-dragging');
    }

    function beginPointerDrag(event) {
        const taskHandle = event.target.closest('[data-checklist-drag-handle]');
        if (taskHandle) {
            const row = taskHandle.closest('[data-checklist-open]');
            if (!row) return;
            pointerDrag = {
                type: 'task',
                id: row.dataset.checklistOpen,
                startX: event.clientX,
                startY: event.clientY,
                source: row,
                active: false,
            };
            taskHandle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            return;
        }

        const editorHandle = event.target.closest('[data-step-editor-drag-handle]');
        if (editorHandle) {
            const item = editorHandle.closest('[data-step-editor-item]');
            const editor = editorHandle.closest('[data-step-editor]');
            if (!item || !editor) return;
            pointerDrag = {
                type: 'editor',
                editor,
                target: editor.dataset.stepTarget || '',
                index: Number(item.dataset.stepEditorItem),
                startX: event.clientX,
                startY: event.clientY,
                source: item,
                active: false,
            };
            editorHandle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            return;
        }

        const savedHandle = event.target.closest('[data-checklist-step-drag-handle]');
        if (savedHandle) {
            const item = savedHandle.closest('[data-checklist-step-item]');
            if (!item) return;
            pointerDrag = {
                type: 'saved',
                taskId: item.dataset.checklistStepItem,
                index: Number(item.dataset.checklistStepIndex),
                startX: event.clientX,
                startY: event.clientY,
                source: item,
                active: false,
            };
            savedHandle.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        }
    }

    function updatePointerDrag(event, root) {
        if (!pointerDrag) return;
        const delta = Math.abs(event.clientX - pointerDrag.startX) + Math.abs(event.clientY - pointerDrag.startY);
        if (!pointerDrag.active && delta < 6) return;
        pointerDrag.active = true;
        createDragVisuals(pointerDrag, event);
        moveDragGhost(pointerDrag, event);
        const target = document.elementFromPoint(event.clientX, event.clientY);
        clearDragHints(root);

        if (pointerDrag.type === 'task') {
            const row = target?.closest?.('[data-checklist-open]')
                || findNearestDropTarget('[data-checklist-open]', event, (item) => item.dataset.checklistOpen !== pointerDrag.id);
            if (!row || row.dataset.checklistOpen === pointerDrag.id) return;
            const rect = row.getBoundingClientRect();
            pointerDrag.targetId = row.dataset.checklistOpen;
            pointerDrag.position = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
            row.dataset.dropPosition = pointerDrag.position;
            row.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
            movePlaceholder(pointerDrag.placeholder, row, pointerDrag.position);
            event.preventDefault();
            return;
        }

        if (pointerDrag.type === 'editor') {
            const item = target?.closest?.('[data-step-editor-item]')
                || findNearestDropTarget('[data-step-editor-item]', event, (candidate) => candidate.closest('[data-step-editor]')?.dataset.stepTarget === pointerDrag.target);
            const editor = item?.closest('[data-step-editor]');
            if (!item || editor?.dataset.stepTarget !== pointerDrag.target) return;
            pointerDrag.toIndex = getCompactDropIndex(event, item, pointerDrag.index);
            item.dataset.dropPosition = String(pointerDrag.toIndex);
            item.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
            movePlaceholder(pointerDrag.placeholder, item, pointerDrag.toIndex > Number(item.dataset.stepEditorItem) ? 'after' : 'before');
            event.preventDefault();
            return;
        }

        if (pointerDrag.type === 'saved') {
            const item = target?.closest?.('[data-checklist-step-item]')
                || findNearestDropTarget('[data-checklist-step-item]', event, (candidate) => candidate.dataset.checklistStepItem === pointerDrag.taskId);
            if (!item || item.dataset.checklistStepItem !== pointerDrag.taskId) return;
            pointerDrag.toIndex = getCompactDropIndex(event, item, pointerDrag.index);
            item.dataset.dropPosition = String(pointerDrag.toIndex);
            item.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
            movePlaceholder(pointerDrag.placeholder, item, pointerDrag.toIndex > Number(item.dataset.checklistStepIndex) ? 'after' : 'before');
            event.preventDefault();
        }
    }

    async function finishPointerDrag(root) {
        if (!pointerDrag) return;
        const drag = pointerDrag;
        pointerDrag = null;
        clearDragHints(root);
        clearDragVisuals(drag);
        if (!drag.active) return;
        if (drag.type === 'task' && drag.targetId) {
            await reorderTasks(drag.id, drag.targetId, drag.position || 'before');
        } else if (drag.type === 'editor' && Number.isInteger(drag.toIndex)) {
            reorderStepEditor(drag.editor, drag.index, drag.toIndex);
        } else if (drag.type === 'saved' && Number.isInteger(drag.toIndex)) {
            await reorderSavedSteps(drag.taskId, drag.index, drag.toIndex);
        }
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
        const displayOrder = Number(raw.displayOrder ?? raw.display_order ?? raw.sortOrder ?? raw.sort_order);
        return {
            id: String(raw.id || createId()),
            title,
            note: String(raw.note || '').trim(),
            category,
            domain: getDomain(inferDomain(raw)).key,
            dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : todayString(),
            priority: raw.priority === 'high' ? 'high' : 'normal',
            steps: normalizeSteps(raw.steps || raw.subtasks || []),
            paused: Boolean(raw.paused ?? raw.is_paused),
            completionReport: typeof (raw.completionReport || raw.completion_report) === 'object' && (raw.completionReport || raw.completion_report) !== null ? (raw.completionReport || raw.completion_report) : {},
            reportFiles: Array.isArray(raw.reportFiles || raw.report_files) ? (raw.reportFiles || raw.report_files) : [],
            completed: Boolean(raw.completed ?? raw.is_done),
            completedAt: raw.completedAt || raw.completed_at || null,
            createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
            displayOrder: Number.isFinite(displayOrder) ? displayOrder : null,
        };
    }

    function fallbackTaskCompare(a, b) {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
        if (a.domain !== b.domain) return a.domain.localeCompare(b.domain);
        return String(b.createdAt).localeCompare(String(a.createdAt));
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
        return Object.values(byId)
            .sort((a, b) => {
                const aHasOrder = Number.isFinite(a.displayOrder);
                const bHasOrder = Number.isFinite(b.displayOrder);
                if (aHasOrder && bHasOrder && a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
                if (aHasOrder !== bHasOrder) return aHasOrder ? -1 : 1;
                return fallbackTaskCompare(a, b);
            })
            .map((task, index) => ({
                ...task,
                displayOrder: Number.isFinite(task.displayOrder) ? task.displayOrder : (index + 1) * 1000,
            }));
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

    function isDisplayOrderSchemaError(error) {
        const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
        return text.includes('display_order') || String(error?.code || '') === 'PGRST204';
    }

    function isUpdate10402SchemaError(error) {
        const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
        return ['is_paused', 'completion_report', 'report_files'].some((column) => text.includes(column));
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
        const payload = {
            id: normalized.id,
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
        if (userId) payload.user_id = userId;
        if (remoteSupportsDisplayOrder) payload.display_order = normalized.displayOrder;
        if (remoteSupportsUpdate10402) {
            payload.is_paused = normalized.paused;
            payload.completion_report = normalized.completionReport;
            payload.report_files = normalized.reportFiles;
        }
        return payload;
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
            paused: row.is_paused,
            completionReport: row.completion_report,
            reportFiles: row.report_files,
            completed: row.is_done,
            completedAt: row.completed_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            displayOrder: row.display_order,
        });
    }

    async function persistRemoteTask(task) {
        const client = getClient();
        const normalized = normalizeTask(task);
        if (!client || !normalized) return false;
        try {
            let { error } = await client
                .from(TABLE_NAME)
                .upsert(toRemotePayload(normalized), { onConflict: 'id' });
            if (error && remoteSupportsUpdate10402 && isUpdate10402SchemaError(error)) {
                remoteSupportsUpdate10402 = false;
                ({ error } = await client.from(TABLE_NAME).upsert(toRemotePayload(normalized), { onConflict: 'id' }));
            }
            if (error && remoteSupportsDisplayOrder && isDisplayOrderSchemaError(error)) {
                remoteSupportsDisplayOrder = false;
                ({ error } = await client
                    .from(TABLE_NAME)
                    .upsert(toRemotePayload(normalized), { onConflict: 'id' }));
            }
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('서버 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
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
            let { error } = await client
                .from(TABLE_NAME)
                .upsert(tasks.map(toRemotePayload), { onConflict: 'id' });
            if (error && remoteSupportsUpdate10402 && isUpdate10402SchemaError(error)) {
                remoteSupportsUpdate10402 = false;
                ({ error } = await client.from(TABLE_NAME).upsert(tasks.map(toRemotePayload), { onConflict: 'id' }));
            }
            if (error && remoteSupportsDisplayOrder && isDisplayOrderSchemaError(error)) {
                remoteSupportsDisplayOrder = false;
                ({ error } = await client
                    .from(TABLE_NAME)
                    .upsert(tasks.map(toRemotePayload), { onConflict: 'id' }));
            }
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('서버 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
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
            renderSyncStatus('로컬 저장', 'text-slate-600 bg-slate-50 border-slate-100');
            return null;
        }
        renderSyncStatus('서버 확인 중', 'text-sky-600 bg-sky-50 border-sky-100');
        try {
            let { data, error } = await client
                .from(TABLE_NAME)
                .select('id,title,note,category,domain,steps,due_date,priority,is_done,completed_at,created_at,updated_at,display_order,is_paused,completion_report,report_files')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });
            if (error && remoteSupportsUpdate10402 && isUpdate10402SchemaError(error)) {
                remoteSupportsUpdate10402 = false;
                ({ data, error } = await client
                    .from(TABLE_NAME)
                    .select('id,title,note,category,domain,steps,due_date,priority,is_done,completed_at,created_at,updated_at,display_order')
                    .order('display_order', { ascending: true, nullsFirst: false })
                    .order('created_at', { ascending: false }));
            }
            if (error && remoteSupportsDisplayOrder && isDisplayOrderSchemaError(error)) {
                remoteSupportsDisplayOrder = false;
                ({ data, error } = await client
                    .from(TABLE_NAME)
                    .select('id,title,note,category,domain,steps,due_date,priority,is_done,completed_at,created_at,updated_at')
                    .order('is_done', { ascending: true })
                    .order('created_at', { ascending: false }));
            }
            if (error) throw error;

            const remoteTasks = sortTasks((data || []).map(fromRemoteRow).filter(Boolean));
            // An authenticated server read is authoritative. Merging stale local
            // cache rows here would recreate tasks deleted from another device.
            tasks = saveStore(remoteTasks);
            remoteLoaded = true;
            render({ skipRemoteLoad: true });
            renderSyncStatus('서버 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
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

    async function refreshFromServer() {
        remoteLoadStarted = true;
        remoteLoaded = false;
        return loadRemoteTasks();
    }

    function renderSyncStatus(text, classes) {
        const el = document.getElementById('checklist-sync-badge');
        if (!el) return;
        el.className = `text-[10px] font-bold border px-2.5 py-1 rounded-md whitespace-nowrap ${classes}`;
        el.textContent = text;
    }

    function matchesDomain(task) {
        return task.domain === activeDomain;
    }

    function getFilteredTasks() {
        let nextTasks = tasks.filter(matchesDomain);
        if (activeFilter === 'done') {
            nextTasks = nextTasks.filter((task) => task.completed);
        } else if (activeFilter === 'paused') {
            nextTasks = nextTasks.filter((task) => task.paused && !task.completed);
        } else if (activeFilter !== 'all') {
            nextTasks = nextTasks.filter((task) => !task.completed && !task.paused);
        }
        return nextTasks;
    }

    function getSummary() {
        const scopedTasks = tasks.filter(matchesDomain);
        const open = scopedTasks.filter((task) => !task.completed && !task.paused).length;
        const paused = scopedTasks.filter((task) => !task.completed && task.paused).length;
        const done = scopedTasks.filter((task) => task.completed).length;
        const total = open + paused + done;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return { open, paused, done, total, pct };
    }

    function renderFilterButton(key, label, count) {
        const isActive = activeFilter === key;
        return `
            <button type="button" data-checklist-filter="${key}" class="px-3 py-1.5 rounded-md text-[11px] font-bold border transition ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-200'}">
                ${label}${Number.isFinite(count) ? ` ${count}` : ''}
            </button>
        `;
    }

    function renderTaskCard(task) {
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        const cardTone = CARD_TONE_CLASSES[domain.tone] || CARD_TONE_CLASSES.slate;
        const selectedClass = activeTaskId === task.id ? cardTone.active : `${cardTone.base} hover:shadow-sm`;
        const doneClass = task.completed ? 'opacity-60' : task.paused ? 'opacity-45 grayscale-[15%]' : '';
        const titleClass = task.completed ? 'line-through text-gray-400' : 'text-gray-900';
        const domainBadge = `<span class="shrink-0 font-bold border px-1.5 py-0.5 rounded text-[10px] bg-white/75 ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}">${escapeHtml(domain.label)}</span>`;
        const stepBadge = stepSummary.total
            ? `<span>${stepSummary.done}/${stepSummary.total} Step</span>`
            : '';
        return `
            <article data-checklist-open="${escapeAttr(task.id)}" class="group cursor-pointer rounded-lg border px-3 py-2.5 transition ${selectedClass} ${doneClass}">
                <div class="flex min-w-0 items-start gap-2">
                    <button type="button" data-checklist-toggle="${escapeAttr(task.id)}" aria-pressed="${task.completed}" class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${task.completed ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-transparent hover:border-indigo-400'}" title="${task.completed ? '완료 취소' : '완료'}" aria-label="${escapeAttr(task.title)} ${task.completed ? '완료 취소' : '완료'}">
                        <i class="fas fa-check text-[8px]"></i>
                    </button>
                    <p class="min-w-0 flex-1 truncate text-[13px] font-bold leading-5 ${titleClass}">${escapeHtml(task.title)}</p>
                    <button type="button" data-checklist-delete="${escapeAttr(task.id)}" class="-mt-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition px-1 py-0.5" title="삭제" aria-label="${escapeAttr(task.title)} 삭제">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                    <button type="button" data-checklist-drag-handle class="-mt-0.5 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-gray-300 hover:text-gray-700 active:cursor-grabbing" title="할 일 순서 이동" aria-label="할 일 순서 이동">
                        <i class="fas fa-grip-vertical text-xs"></i>
                    </button>
                </div>
                <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-gray-500">
                    ${domainBadge}
                    ${task.paused ? '<span class="shrink-0 font-bold text-amber-600"><i class="fas fa-pause mr-1"></i>Monitor</span>' : ''}
                    ${stepBadge ? `<span class="shrink-0">${stepBadge}</span>` : ''}
                </div>
            </article>
        `;
    }

    function renderTasks() {
        const list = document.getElementById('checklist-task-list');
        if (!list) return;
        const visibleTasks = getFilteredTasks();
        if (visibleTasks.length === 0) {
            list.innerHTML = `
                <div class="border border-dashed border-gray-200 rounded-lg bg-white px-4 py-8 text-center">
                    <p class="text-sm font-bold text-gray-700">등록된 할 일이 없습니다.</p>
                    <p class="text-xs text-gray-400 mt-1">지금 떠오른 일을 하나만 남겨두세요.</p>
                </div>
            `;
            return;
        }
        const domain = getDomain(activeDomain);
        list.innerHTML = `
            <section class="space-y-1.5" data-checklist-group="${escapeAttr(domain.key)}">
                <div class="sticky top-0 z-[1] flex items-center justify-between rounded-md bg-gray-50/95 px-2 py-1 backdrop-blur"><h4 class="text-[10px] font-black tracking-wide text-gray-500">${escapeHtml(domain.label)}</h4><span class="text-[10px] text-gray-400">${visibleTasks.length}</span></div>
                ${visibleTasks.map(renderTaskCard).join('')}
            </section>`;
    }

    function renderCompletionReport(task) {
        if (!task.completed) return '';
        const report = task.completionReport || {};
        const files = Array.isArray(task.reportFiles) ? task.reportFiles : [];
        return `
            <section class="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                <div class="mb-3 flex items-center justify-between gap-2">
                    <div><p class="text-[10px] font-black tracking-wider text-indigo-500">COMPLETION REPORT</p><h5 class="mt-0.5 text-sm font-bold text-gray-900">완료 보고서</h5></div>
                    <span class="rounded-md bg-white px-2 py-1 text-[10px] font-bold text-indigo-600">${files.length}개 파일</span>
                </div>
                <div class="grid gap-2 md:grid-cols-3">
                    <label class="text-[10px] font-bold text-gray-500">결과 요약<textarea id="checklist-report-summary" class="mt-1 min-h-[82px] w-full rounded-md border border-indigo-100 bg-white p-2 text-xs leading-5 outline-none focus:border-indigo-300" placeholder="무엇을 완료했나요?">${escapeHtml(report.summary || '')}</textarea></label>
                    <label class="text-[10px] font-bold text-gray-500">핵심 성과<textarea id="checklist-report-outcome" class="mt-1 min-h-[82px] w-full rounded-md border border-indigo-100 bg-white p-2 text-xs leading-5 outline-none focus:border-indigo-300" placeholder="결과와 배운 점">${escapeHtml(report.outcome || '')}</textarea></label>
                    <label class="text-[10px] font-bold text-gray-500">Monitor 항목<textarea id="checklist-report-followup" class="mt-1 min-h-[82px] w-full rounded-md border border-indigo-100 bg-white p-2 text-xs leading-5 outline-none focus:border-indigo-300" placeholder="추후 확인할 항목">${escapeHtml(report.followUp || '')}</textarea></label>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button type="button" data-checklist-report-ppt="${escapeAttr(task.id)}" class="rounded-md bg-indigo-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-indigo-700"><i class="fas fa-file-powerpoint mr-1.5"></i>PPT 생성</button>
                    <label class="cursor-pointer rounded-md border border-indigo-200 bg-white px-3 py-2 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"><i class="fas fa-cloud-arrow-up mr-1.5"></i>파일 업로드<input type="file" data-checklist-report-upload="${escapeAttr(task.id)}" accept=".ppt,.pptx,.pdf" class="hidden"></label>
                </div>
                ${files.length ? `<div class="mt-3 space-y-1">${files.map((file, index) => `<button type="button" data-checklist-report-open="${escapeAttr(task.id)}" data-report-index="${index}" class="flex w-full items-center gap-2 rounded-md bg-white px-2.5 py-2 text-left text-[11px] text-gray-600 hover:text-indigo-700"><i class="fas fa-file-lines text-indigo-400"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(file.name || '완료 보고서')}</span><span class="text-[9px] text-gray-400">${escapeHtml(file.createdAt ? new Date(file.createdAt).toLocaleDateString('ko-KR') : '')}</span></button>`).join('')}</div>` : ''}
            </section>`;
    }

    function renderReportLibrary() {
        const panel = document.getElementById('checklist-report-library');
        if (!panel) return;
        const reports = tasks.flatMap((task) => (task.reportFiles || []).map((file, index) => ({ task, file, index })));
        panel.innerHTML = reportLibraryOpen ? `
            <div data-checklist-report-library-close class="fixed inset-0 z-[70] flex items-stretch justify-end bg-gray-950/35 backdrop-blur-[1px]">
                <section data-checklist-report-library-dialog class="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-2xl md:p-6">
                    <div class="flex items-start justify-between"><div><p class="text-[10px] font-black tracking-wider text-indigo-500">UPLOAD LIBRARY</p><h3 class="mt-1 text-xl font-black text-gray-900">완료 보고서 Library</h3><p class="mt-1 text-xs text-gray-400">할 일별 PPT·PDF 결과물을 한곳에서 확인합니다.</p></div><button type="button" data-checklist-report-library-close class="h-9 w-9 rounded-lg text-gray-400 hover:bg-gray-100"><i class="fas fa-xmark"></i></button></div>
                    <div class="mt-5 space-y-2">${reports.length ? reports.map(({ task, file, index }) => `<button type="button" data-checklist-report-open="${escapeAttr(task.id)}" data-report-index="${index}" class="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-indigo-200 hover:bg-indigo-50/40"><span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500"><i class="fas fa-file-powerpoint"></i></span><span class="min-w-0 flex-1"><strong class="block truncate text-sm text-gray-800">${escapeHtml(file.name || '완료 보고서')}</strong><span class="mt-0.5 block truncate text-[10px] text-gray-400">${escapeHtml(getDomain(task.domain).label)} · ${escapeHtml(task.title)}</span></span><i class="fas fa-arrow-up-right-from-square text-xs text-gray-300"></i></button>`).join('') : '<div class="rounded-xl border border-dashed border-gray-200 px-5 py-14 text-center text-sm text-gray-400">업로드된 완료 보고서가 없습니다.</div>'}</div>
                </section>
            </div>` : '';
    }

    function renderDetailPanel() {
        const panel = document.getElementById('checklist-detail-panel');
        if (!panel) return;
        const task = tasks.find((item) => item.id === activeTaskId);
        if (!task) {
            panel.className = 'hidden min-w-0 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5 xl:block xl:min-h-[560px]';
            panel.innerHTML = `
                <div class="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                    <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-300 shadow-sm">
                        <i class="fas fa-list-check"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-600">할 일을 선택하세요</p>
                    <p class="mt-1 text-xs text-gray-400">왼쪽 카드 하나를 누르면 상세내역을 확인하고 수정할 수 있습니다.</p>
                </div>
            `;
            return;
        }
        panel.className = 'fixed inset-0 z-50 flex min-w-0 items-stretch justify-center bg-gray-950/30 p-0 backdrop-blur-[1px] xl:static xl:block xl:bg-transparent xl:p-0 xl:backdrop-blur-none';
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        const isEditingTitle = editingTitleTaskId === task.id;
        panel.innerHTML = `
            <div class="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl xl:h-auto xl:min-h-[560px] xl:rounded-lg xl:border xl:border-gray-200 xl:p-4 xl:shadow-sm" role="dialog" aria-modal="true" aria-label="${escapeAttr(task.title)} 상세 편집" data-checklist-detail-dialog>
                <div class="flex shrink-0 items-start justify-between gap-2 border-b border-gray-100 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] xl:border-0 xl:p-0">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-1.5">
                            ${isEditingTitle ? `
                                <div class="flex min-w-0 flex-1 items-center gap-1.5">
                                    <input id="checklist-detail-title-edit" type="text" value="${escapeAttr(task.title)}" class="min-w-0 flex-1 rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-lg font-black text-gray-900 outline-none ring-2 ring-indigo-100" aria-label="할 일 제목 수정">
                                    <button type="button" data-checklist-save-title="${escapeAttr(task.id)}" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-800" title="제목 저장" aria-label="제목 저장"><i class="fas fa-check text-[10px]"></i></button>
                                    <button type="button" data-checklist-cancel-title class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:text-gray-700" title="제목 수정 취소" aria-label="제목 수정 취소"><i class="fas fa-xmark text-[10px]"></i></button>
                                </div>
                            ` : `
                                <h4 data-checklist-title-display="${escapeAttr(task.id)}" tabindex="0" class="min-w-0 cursor-text truncate rounded px-1 py-0.5 text-lg font-black leading-snug text-gray-900 outline-none hover:bg-gray-50 focus:ring-2 focus:ring-indigo-200" title="더블클릭하여 제목 수정">${escapeHtml(task.title)}</h4>
                            `}
                            <span class="inline-flex text-[10px] font-bold border px-2 py-0.5 rounded ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}">${escapeHtml(domain.label)}</span>
                        </div>
                        <p class="mt-1 text-[11px] text-gray-400">${escapeHtml(domain.label)} · ${stepSummary.done}/${stepSummary.total} Step · 제목은 더블클릭으로 수정</p>
                    </div>
                    <div class="flex shrink-0 gap-1">
                        <button type="button" data-checklist-pause="${escapeAttr(task.id)}" class="inline-flex h-7 w-7 items-center justify-center rounded-md border ${task.paused ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-gray-200 bg-white text-gray-400 hover:text-amber-600'}" title="${task.paused ? '다시 활성화' : 'Monitor로 보류'}" aria-label="${task.paused ? '다시 활성화' : 'Monitor로 보류'}"><i class="fas ${task.paused ? 'fa-play' : 'fa-pause'} text-xs"></i></button>
                        <button type="button" data-checklist-close-detail class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:text-gray-700" title="상세 닫기" aria-label="상세 닫기"><i class="fas fa-xmark text-xs"></i></button>
                    </div>
                </div>

                <div class="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-4 py-4 xl:mt-3 xl:overflow-visible xl:p-0">
                    <div class="max-w-2xl">
                        <div class="block"><span class="text-[11px] font-bold text-gray-500">그룹</span>${renderDomainChoiceButtons('checklist-detail-domain-edit', task.domain)}</div>
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-3">
                        <div class="block">
                            <span class="text-[11px] font-bold text-gray-500">상세내역</span>
                            ${renderNoteEditor({
                                id: 'checklist-detail-note-edit',
                                value: task.note,
                                minHeightClass: 'min-h-[220px] xl:min-h-[320px]',
                                placeholder: '상세내역을 길게 적어둘 수 있습니다.',
                            })}
                        </div>

                        <div>
                            <div class="block">
                                <span class="text-[11px] font-bold text-gray-500">Step</span>
                                <div class="mt-1">${renderStepEditor('checklist-detail-steps-edit', task.steps)}</div>
                            </div>
                        </div>
                    </div>

                    ${renderCompletionReport(task)}

                    <button type="button" data-checklist-save-detail="${escapeAttr(task.id)}" class="w-full rounded-md bg-gray-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-gray-800">수정 저장</button>
                </div>
            </div>
        `;
    }

    function renderSummary() {
        const summary = getSummary();
        const openEl = document.getElementById('checklist-open-count');
        const doneEl = document.getElementById('checklist-done-count');
        const pctEl = document.getElementById('checklist-progress-percent');
        const barEl = document.getElementById('checklist-progress-bar');
        const filtersEl = document.getElementById('checklist-filters');
        const domainsEl = document.getElementById('checklist-domain-filters');
        if (openEl) openEl.textContent = summary.open.toLocaleString();
        if (doneEl) doneEl.textContent = summary.done.toLocaleString();
        if (pctEl) pctEl.textContent = `${summary.pct}%`;
        if (barEl) barEl.style.width = `${summary.pct}%`;
        if (filtersEl) {
            filtersEl.innerHTML = [
                renderFilterButton('open', '진행 중', summary.open),
                renderFilterButton('paused', 'Monitor', summary.paused),
                renderFilterButton('done', '완료', summary.done),
                renderFilterButton('all', '전체', summary.total),
            ].join('');
        }
        if (domainsEl) {
            domainsEl.innerHTML = DOMAINS.map((domain) => {
                const count = tasks.filter((task) => task.domain === domain.key).length;
                const active = activeDomain === domain.key;
                return `<button type="button" data-checklist-domain-filter="${escapeAttr(domain.key)}" aria-pressed="${active}" class="flex min-w-0 flex-1 items-center justify-between rounded-lg border px-3 py-2 text-left transition ${active ? `font-black ${TONE_CLASSES[domain.tone]}` : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}"><span class="text-xs">${escapeHtml(domain.label)}</span><span class="text-[10px] opacity-70">${count}</span></button>`;
            }).join('');
        }
    }

    function ensureShell() {
        const root = document.getElementById('routine-checklist-view');
        ensureDragStyles();
        if (!root || document.getElementById('checklist-task-list')) return;
        root.innerHTML = `
            <div class="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <p class="text-[10px] md:text-xs font-bold text-indigo-500 mb-1">Career · Finance · Life</p>
                    <h2 class="text-xl md:text-2xl font-bold text-gray-900">할 일</h2>
                </div>
                <div class="flex items-center gap-2"><button type="button" data-checklist-report-library-open class="rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100"><i class="fas fa-box-archive mr-1"></i>완료 보고서</button><span id="checklist-sync-badge" class="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md whitespace-nowrap w-fit">로컬 저장</span></div>
            </div>

            <div id="checklist-domain-filters" class="mb-3 flex gap-2"></div>

            <div class="space-y-2.5 md:space-y-3 mb-8">
                <section id="checklist-life-notes-wrap" class="hidden min-w-0">
                    <div id="checklist-life-notes-panel"></div>
                </section>
                <section id="checklist-task-board" class="bg-white p-2.5 md:p-3 rounded-lg border border-gray-100 min-w-0">
                    <div class="flex flex-col gap-2 mb-2.5">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <h3 class="text-sm font-bold text-gray-900">할 일 목록</h3>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <div id="checklist-filters" class="flex flex-wrap gap-1.5"></div>
                                <div id="checklist-add-panel"></div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-3 min-w-0">
                        <div class="min-w-0">
                            <div id="checklist-task-list" class="space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1"></div>
                        </div>
                        <aside id="checklist-detail-panel" class="min-w-0"></aside>
                    </div>
                </section>
            </div>
            <div id="checklist-report-library"></div>
        `;
        isBound = false;
        bindControls();
    }

    function renderAddForm() {
        const panel = document.getElementById('checklist-add-panel');
        if (!panel) return;
        panel.innerHTML = `
            <button type="button" data-checklist-toggle-add-form class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm" title="할 일 추가" aria-label="할 일 추가">
                <i class="fas fa-plus text-[11px]"></i>
            </button>
            ${isAddFormOpen ? `
                <div data-checklist-close-add-form class="fixed inset-0 z-50 flex items-stretch justify-center bg-gray-950/30 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
                    <div id="checklist-add-form" class="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-lg sm:border sm:border-gray-200" role="dialog" aria-modal="true" aria-label="새 할 일 추가" data-checklist-dialog>
                        <div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
                            <p class="text-sm font-black text-gray-900">새 할 일</p>
                            <button type="button" data-checklist-close-add-form class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="닫기" aria-label="새 할 일 창 닫기">
                                <i class="fas fa-xmark text-sm"></i>
                            </button>
                        </div>
                        <div class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                            <input id="checklist-title-input" type="text" class="w-full border-0 border-b border-gray-200 px-0 py-2 text-lg font-bold focus:border-indigo-500 focus:ring-0 outline-none" placeholder="할 일 제목">

                            <div class="block">
                                <span class="text-[11px] font-bold text-gray-500">그룹</span>
                                ${renderDomainChoiceButtons('checklist-domain-input', activeDomain)}
                            </div>

                            <div class="block">
                                <span class="text-[11px] font-bold text-gray-500">상세내역</span>
                                ${renderNoteEditor({
                                    id: 'checklist-note-input',
                                    minHeightClass: 'min-h-[160px]',
                                    placeholder: '필요한 맥락, 참고 내용, 처리 기준을 길게 적어두세요.',
                                })}
                            </div>

                            <div class="block">
                                <span class="text-[11px] font-bold text-gray-500">Step</span>
                                <div class="mt-1">${renderStepEditor('checklist-steps-input')}</div>
                            </div>
                        </div>
                        <div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
                            <button type="button" data-checklist-close-add-form class="rounded-md px-3 py-2 text-[11px] font-bold text-gray-500 hover:bg-gray-100">취소</button>
                            <button type="button" id="checklist-add-button" class="rounded-md bg-gray-900 px-4 py-2 text-[11px] font-bold text-white hover:bg-gray-800">저장</button>
                        </div>
                    </div>
                </div>
            ` : ''}
        `;
    }
    function render(options = {}) {
        ensureShell();
        tasks = getStore();
        if (activeTaskId && !tasks.some((task) => task.id === activeTaskId)) activeTaskId = null;
        renderAddForm();
        renderSummary();
        renderTasks();
        renderDetailPanel();
        renderReportLibrary();
        const lifeNotesWrap = document.getElementById('checklist-life-notes-wrap');
        if (lifeNotesWrap) lifeNotesWrap.classList.toggle('hidden', activeDomain !== 'life');
        if (activeDomain === 'life') {
            window.LifeNotesFeature?.bindControls?.();
            window.LifeNotesFeature?.render?.();
        }
        hydrateStepEditors();
        document.querySelectorAll('[data-checklist-note-editor]').forEach((textarea) => updateNotePreview(textarea.id));
        persistChecklistUiState();
        if (editingTitleTaskId) {
            const titleInput = document.getElementById('checklist-detail-title-edit');
            titleInput?.focus();
            titleInput?.select();
        }
        if (isAddFormOpen) document.getElementById('checklist-title-input')?.focus();
        if (remoteAvailable) {
            if (remoteLoaded) renderSyncStatus('서버 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            else if (getClient()) renderSyncStatus('Checking cloud', 'text-sky-600 bg-sky-50 border-sky-100');
            else renderSyncStatus('Local only', 'text-slate-600 bg-slate-50 border-slate-100');
        }
        if (!options.skipRemoteLoad) queueRemoteLoad();
    }

    async function addTaskFromForm() {
        const titleEl = document.getElementById('checklist-title-input');
        const noteEl = document.getElementById('checklist-note-input');
        const stepsEl = document.getElementById('checklist-steps-input');
        const domainEl = document.getElementById('checklist-domain-input');
        const task = normalizeTask({
            title: titleEl?.value,
            note: noteEl?.value,
            steps: parseStepEditorSteps(stepsEl?.value || ''),
            dueDate: todayString(),
            domain: domainEl?.value || activeDomain,
            priority: 'normal',
            displayOrder: getTopDisplayOrder(),
        });
        if (!task) {
            toast('할 일을 입력해주세요.', 'warning');
            return;
        }
        tasks = saveStore([task, ...tasks]);
        activeTaskId = task.id;
        isAddFormOpen = false;
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
        if (titleEl) titleEl.value = '';
        if (noteEl) noteEl.value = '';
        if (stepsEl) stepsEl.value = '';
        toast('할 일을 추가했습니다.', 'info');
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

    async function togglePaused(id) {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        task.paused = !task.paused;
        task.updatedAt = new Date().toISOString();
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

    function syncCompletionReportFromUi(task) {
        if (!task) return;
        task.completionReport = {
            summary: String(document.getElementById('checklist-report-summary')?.value || task.completionReport?.summary || '').trim(),
            outcome: String(document.getElementById('checklist-report-outcome')?.value || task.completionReport?.outcome || '').trim(),
            followUp: String(document.getElementById('checklist-report-followup')?.value || task.completionReport?.followUp || '').trim(),
            updatedAt: new Date().toISOString(),
        };
    }

    function safeFileName(value) {
        return String(value || '완료-보고서').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 70);
    }

    function loadPptxGenJS() {
        if (window.NetVisualizerPptxGenJS || window.PptxGenJS) return Promise.resolve(window.NetVisualizerPptxGenJS || window.PptxGenJS);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './vendor/pptxgen.bundle.js?v=3.12.0';
            script.onload = () => {
                window.NetVisualizerPptxGenJS = window.NetVisualizerPptxGenJS || window.PptxGenJS || (typeof PptxGenJS === 'function' ? PptxGenJS : null);
                if (window.NetVisualizerPptxGenJS) resolve(window.NetVisualizerPptxGenJS);
                else reject(new Error('PPT 생성 모듈 초기화에 실패했습니다.'));
            };
            script.onerror = () => reject(new Error('PPT 생성 모듈을 불러오지 못했습니다.'));
            document.head.appendChild(script);
        });
    }

    function downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function uploadReportBlob(task, blob, fileName) {
        const client = getClient();
        const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : '';
        if (!client || !userId) return { uploaded: false, reason: 'auth' };
        const path = `${userId}/${task.id}/${Date.now()}-${safeFileName(fileName)}`;
        const { error } = await client.storage.from('todo-reports').upload(path, blob, {
            contentType: blob.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            upsert: false,
        });
        if (error) return { uploaded: false, reason: error.message || 'upload' };
        task.reportFiles = [...(task.reportFiles || []), { name: fileName, path, createdAt: new Date().toISOString() }];
        task.updatedAt = new Date().toISOString();
        tasks = saveStore(tasks);
        await persistRemoteTask(task);
        return { uploaded: true, path };
    }

    async function generateCompletionReport(taskId) {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;
        syncCompletionReportFromUi(task);
        task.updatedAt = new Date().toISOString();
        tasks = saveStore(tasks);
        try {
            const PptxGenJS = await loadPptxGenJS();
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_WIDE';
            pptx.author = 'NetVisualizer';
            pptx.subject = `${task.title} 완료 보고서`;
            pptx.title = `${task.title} 완료 보고서`;
            pptx.company = 'NetVisualizer';
            pptx.lang = 'ko-KR';
            pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'ko-KR' };
            const slide = pptx.addSlide();
            slide.background = { color: 'F8FAFC' };
            slide.addText('NetVisualizer · Completion Report', { x: 0.7, y: 0.55, w: 5.8, h: 0.25, fontSize: 11, bold: true, color: '6366F1', charSpacing: 1.2 });
            slide.addText(task.title, { x: 0.7, y: 1.0, w: 11.8, h: 0.75, fontSize: 28, bold: true, color: '111827', breakLine: false, margin: 0 });
            slide.addText(`${getDomain(task.domain).label}  ·  ${task.completedAt ? new Date(task.completedAt).toLocaleDateString('ko-KR') : '완료'}`, { x: 0.7, y: 1.82, w: 11.8, h: 0.3, fontSize: 11, color: '64748B', margin: 0 });
            const sections = [
                ['결과 요약', task.completionReport.summary || '기록 없음'],
                ['핵심 성과', task.completionReport.outcome || '기록 없음'],
                ['Monitor 항목', task.completionReport.followUp || '없음'],
            ];
            sections.forEach(([label, value], index) => {
                const x = 0.7 + index * 4.12;
                slide.addShape(pptx.ShapeType.roundRect, { x, y: 2.45, w: 3.82, h: 3.55, rectRadius: 0.08, fill: { color: index === 2 ? 'FFF7ED' : 'FFFFFF' }, line: { color: index === 2 ? 'FED7AA' : 'E2E8F0', width: 1 } });
                slide.addText(label, { x: x + 0.25, y: 2.72, w: 3.3, h: 0.3, fontSize: 13, bold: true, color: index === 2 ? 'C2410C' : '4338CA', margin: 0 });
                slide.addText(value, { x: x + 0.25, y: 3.22, w: 3.3, h: 2.35, fontSize: 14, color: '334155', breakLine: false, valign: 'top', margin: 0.03, fit: 'shrink' });
            });
            slide.addText(`생성 ${new Date().toLocaleString('ko-KR')}`, { x: 0.7, y: 6.85, w: 4, h: 0.2, fontSize: 9, color: '94A3B8', margin: 0 });
            const blob = await pptx.write({ outputType: 'blob' });
            const fileName = `${safeFileName(task.title)}-완료보고서.pptx`;
            downloadBlob(blob, fileName);
            const result = await uploadReportBlob(task, blob, fileName);
            render({ skipRemoteLoad: true });
            toast(result.uploaded ? 'PPT를 생성하고 Library에 업로드했습니다.' : 'PPT를 내려받았습니다. 로그인하면 Library에도 자동 업로드됩니다.', result.uploaded ? 'info' : 'warning', 3600);
        } catch (error) {
            console.error('Completion report generation failed.', error);
            toast('PPT 생성에 실패했습니다.', 'error');
        }
    }

    async function uploadReportFile(taskId, file) {
        const task = tasks.find((item) => item.id === taskId);
        if (!task || !file) return;
        syncCompletionReportFromUi(task);
        task.updatedAt = new Date().toISOString();
        tasks = saveStore(tasks);
        const result = await uploadReportBlob(task, file, file.name);
        render({ skipRemoteLoad: true });
        toast(result.uploaded ? '완료 보고서를 Library에 업로드했습니다.' : '로그인 후 파일을 업로드할 수 있습니다.', result.uploaded ? 'info' : 'warning');
    }

    async function openReportFile(taskId, index) {
        const task = tasks.find((item) => item.id === taskId);
        const file = task?.reportFiles?.[Number(index)];
        const client = getClient();
        if (!file?.path || !client) return;
        const { data, error } = await client.storage.from('todo-reports').createSignedUrl(file.path, 120);
        if (error || !data?.signedUrl) { toast('파일 링크를 열지 못했습니다.', 'error'); return; }
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }

    async function saveTaskDetail(id) {
        const now = new Date().toISOString();
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        const titleEl = document.getElementById('checklist-detail-title-edit');
        const domainEl = document.getElementById('checklist-detail-domain-edit');
        const noteEl = document.getElementById('checklist-detail-note-edit');
        const stepsEl = document.getElementById('checklist-detail-steps-edit');
        const title = String(titleEl?.value || task.title).trim();
        if (!title) {
            toast('할 일 제목을 입력해주세요.', 'warning');
            return;
        }
        task.title = title;
        task.domain = getDomain(domainEl?.value || task.domain).key;
        task.priority = 'normal';
        task.note = String(noteEl?.value || '').trim();
        task.steps = parseStepEditorSteps(stepsEl?.value || '', task.steps);
        if (task.completed) {
            task.completionReport = {
                summary: String(document.getElementById('checklist-report-summary')?.value || '').trim(),
                outcome: String(document.getElementById('checklist-report-outcome')?.value || '').trim(),
                followUp: String(document.getElementById('checklist-report-followup')?.value || '').trim(),
                updatedAt: now,
            };
        }
        task.updatedAt = now;
        editingTitleTaskId = null;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
        toast('할 일을 수정했습니다.', 'info');
    }

    function startTitleEditing(id) {
        if (!tasks.some((item) => item.id === id)) return;
        editingTitleTaskId = id;
        render({ skipRemoteLoad: true });
    }

    function cancelTitleEditing() {
        editingTitleTaskId = null;
        render({ skipRemoteLoad: true });
    }

    async function saveTaskTitle(id) {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;
        const titleEl = document.getElementById('checklist-detail-title-edit');
        const title = String(titleEl?.value || '').trim();
        if (!title) {
            toast('할 일 제목을 입력해주세요.', 'warning');
            titleEl?.focus();
            return;
        }
        if (task.title === title) {
            editingTitleTaskId = null;
            render({ skipRemoteLoad: true });
            return;
        }
        task.title = title;
        task.updatedAt = new Date().toISOString();
        editingTitleTaskId = null;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
        toast('제목을 수정했습니다.', 'info');
    }

    async function deleteTask(id) {
        const previousTasks = tasks.slice();
        const deletedTask = tasks.find((item) => item.id === id);
        if (!deletedTask) return;
        const hasRemoteClient = Boolean(getClient());
        tasks = tasks.filter((item) => item.id !== id);
        if (activeTaskId === id) activeTaskId = null;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        if (!hasRemoteClient) return;
        const deletedRemotely = await deleteRemoteTask(id);
        if (deletedRemotely) {
            renderSyncStatus('서버 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            return;
        }
        tasks = saveStore(previousTasks);
        render({ skipRemoteLoad: true });
        toast('서버 삭제에 실패해 항목을 복원했습니다.', 'error', 3200);
    }

    function bindControls() {
        if (isBound) return;
        isBound = true;
        const root = document.getElementById('routine-checklist-view');
        root?.addEventListener('click', (event) => {
            const noteFormatButton = event.target.closest('[data-checklist-note-format]');
            if (noteFormatButton) {
                applyNoteFormat(noteFormatButton.dataset.noteTarget, noteFormatButton.dataset.checklistNoteFormat);
                return;
            }
            const filterBtn = event.target.closest('[data-checklist-filter]');
            if (filterBtn) {
                activeFilter = filterBtn.dataset.checklistFilter || 'open';
                render({ skipRemoteLoad: true });
                return;
            }
            const domainFilter = event.target.closest('[data-checklist-domain-filter]');
            if (domainFilter) {
                activeDomain = getDomain(domainFilter.dataset.checklistDomainFilter).key;
                if (activeTaskId && tasks.find((task) => task.id === activeTaskId)?.domain !== activeDomain) activeTaskId = null;
                render({ skipRemoteLoad: true });
                return;
            }
            const toggleAddFormBtn = event.target.closest('[data-checklist-toggle-add-form]');
            if (toggleAddFormBtn) {
                isAddFormOpen = true;
                render({ skipRemoteLoad: true });
                return;
            }
            const closeAddFormButton = event.target.closest('button[data-checklist-close-add-form]');
            if (closeAddFormButton) {
                isAddFormOpen = false;
                render({ skipRemoteLoad: true });
                return;
            }
            const closeAddBackdrop = event.target.matches('[data-checklist-close-add-form]')
                && !event.target.closest('[data-checklist-dialog]');
            if (closeAddBackdrop) {
                isAddFormOpen = false;
                render({ skipRemoteLoad: true });
                return;
            }
            const closeDetailBtn = event.target.closest('[data-checklist-close-detail]');
            if (closeDetailBtn) {
                editingTitleTaskId = null;
                activeTaskId = null;
                render({ skipRemoteLoad: true });
                return;
            }
            if (event.target.closest('[data-checklist-report-library-open]')) {
                reportLibraryOpen = true;
                render({ skipRemoteLoad: true });
                return;
            }
            const reportLibraryClose = event.target.closest('[data-checklist-report-library-close]');
            if (reportLibraryClose && !event.target.closest('[data-checklist-report-library-dialog]')) {
                reportLibraryOpen = false;
                render({ skipRemoteLoad: true });
                return;
            }
            if (event.target.closest('button[data-checklist-report-library-close]')) {
                reportLibraryOpen = false;
                render({ skipRemoteLoad: true });
                return;
            }
            const closeDetailBackdrop = event.target.matches('#checklist-detail-panel')
                && !event.target.closest('[data-checklist-detail-dialog]');
            if (closeDetailBackdrop) {
                editingTitleTaskId = null;
                activeTaskId = null;
                render({ skipRemoteLoad: true });
                return;
            }
            const domainChoice = event.target.closest('[data-checklist-domain-choice]');
            if (domainChoice) {
                selectDomainChoice(domainChoice.dataset.domainTarget, domainChoice.dataset.checklistDomainChoice);
                return;
            }
            const stepAddBtn = event.target.closest('[data-step-editor-add]');
            if (stepAddBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                addStepFromEditor(stepAddBtn.closest('[data-step-editor]'));
                return;
            }
            const stepRemoveBtn = event.target.closest('[data-step-editor-remove]');
            if (stepRemoveBtn) {
                removeStepFromEditor(stepRemoveBtn.closest('[data-step-editor]'), stepRemoveBtn.dataset.stepEditorRemove);
                return;
            }
            const addBtn = event.target.closest('#checklist-add-button');
            if (addBtn) {
                addTaskFromForm();
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
            const saveTitleBtn = event.target.closest('[data-checklist-save-title]');
            if (saveTitleBtn) {
                saveTaskTitle(saveTitleBtn.dataset.checklistSaveTitle);
                return;
            }
            if (event.target.closest('[data-checklist-cancel-title]')) {
                cancelTitleEditing();
                return;
            }
            const toggleBtn = event.target.closest('[data-checklist-toggle]');
            if (toggleBtn) {
                toggleTask(toggleBtn.dataset.checklistToggle);
                return;
            }
            const pauseBtn = event.target.closest('[data-checklist-pause]');
            if (pauseBtn) {
                togglePaused(pauseBtn.dataset.checklistPause);
                return;
            }
            const reportPptBtn = event.target.closest('[data-checklist-report-ppt]');
            if (reportPptBtn) {
                generateCompletionReport(reportPptBtn.dataset.checklistReportPpt);
                return;
            }
            const reportOpenBtn = event.target.closest('[data-checklist-report-open]');
            if (reportOpenBtn) {
                openReportFile(reportOpenBtn.dataset.checklistReportOpen, reportOpenBtn.dataset.reportIndex);
                return;
            }
            const row = event.target.closest('[data-checklist-open]');
            if (row && !event.target.closest('input, button, textarea, select, a')) {
                activeTaskId = row.dataset.checklistOpen;
                render({ skipRemoteLoad: true });
            }
        });
        root?.addEventListener('dblclick', (event) => {
            const title = event.target.closest('[data-checklist-title-display]');
            if (!title) return;
            event.preventDefault();
            startTitleEditing(title.dataset.checklistTitleDisplay);
        });
        root?.addEventListener('change', (event) => {
            const editorStepToggle = event.target.closest('[data-step-editor-toggle]');
            if (editorStepToggle) {
                toggleStepFromEditor(
                    editorStepToggle.closest('[data-step-editor]'),
                    editorStepToggle.dataset.stepEditorToggle,
                );
                return;
            }
            const stepToggle = event.target.closest('[data-checklist-step-toggle]');
            if (stepToggle) {
                toggleStep(stepToggle.dataset.checklistStepToggle, stepToggle.dataset.stepId);
                return;
            }
            const reportUpload = event.target.closest('[data-checklist-report-upload]');
            if (reportUpload?.files?.[0]) {
                uploadReportFile(reportUpload.dataset.checklistReportUpload, reportUpload.files[0]);
                return;
            }
        });
        root?.addEventListener('input', (event) => {
            const noteEditor = event.target.closest('[data-checklist-note-editor]');
            if (noteEditor) updateNotePreview(noteEditor.id);
            const groupInput = event.target.closest('[data-step-editor-group]');
            if (groupInput) updateStepMetadata(groupInput.closest('[data-step-editor]'), groupInput.dataset.stepEditorGroup, 'groupName', groupInput.value);
            const detailInput = event.target.closest('[data-step-editor-detail]');
            if (detailInput) updateStepMetadata(detailInput.closest('[data-step-editor]'), detailInput.dataset.stepEditorDetail, 'detail', detailInput.value);
        });
        root?.addEventListener('keydown', (event) => {
            const titleDisplay = event.target?.closest?.('[data-checklist-title-display]');
            if (titleDisplay && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                startTitleEditing(titleDisplay.dataset.checklistTitleDisplay);
                return;
            }
            const titleInput = event.target?.closest?.('#checklist-detail-title-edit');
            if (titleInput && event.key === 'Enter') {
                event.preventDefault();
                saveTaskTitle(activeTaskId);
                return;
            }
            if (titleInput && event.key === 'Escape') {
                event.preventDefault();
                cancelTitleEditing();
                return;
            }
            if (event.key === 'Enter' && event.target?.closest?.('[data-step-editor-input]')) {
                event.preventDefault();
                event.stopImmediatePropagation();
                addStepFromEditor(event.target.closest('[data-step-editor]'));
                return;
            }
            if (event.key === 'Enter' && event.target?.closest?.('#checklist-title-input')) addTaskFromForm();
            if (event.key === 'Escape' && isAddFormOpen) {
                isAddFormOpen = false;
                render({ skipRemoteLoad: true });
            }
        });
        root?.addEventListener('pointerdown', beginPointerDrag);
        root?.addEventListener('pointermove', (event) => updatePointerDrag(event, root));
        root?.addEventListener('pointerup', (event) => {
            updatePointerDrag(event, root);
            finishPointerDrag(root);
        });
        root?.addEventListener('pointercancel', () => {
            clearDragVisuals(pointerDrag);
            pointerDrag = null;
            clearDragHints(root);
        });
        root?.addEventListener('mousedown', (event) => {
            if (!pointerDrag) beginPointerDrag(event);
        });
        root?.addEventListener('mousemove', (event) => updatePointerDrag(event, root));
        root?.addEventListener('mouseup', (event) => {
            updatePointerDrag(event, root);
            finishPointerDrag(root);
        });
        document.addEventListener('pointermove', (event) => updatePointerDrag(event, root));
        document.addEventListener('pointerup', (event) => {
            updatePointerDrag(event, root);
            finishPointerDrag(root);
        });
        document.addEventListener('pointerdown', (event) => {
            if (!pointerDrag) beginPointerDrag(event);
        });
        document.addEventListener('mousemove', (event) => updatePointerDrag(event, root));
        document.addEventListener('mouseup', (event) => {
            updatePointerDrag(event, root);
            finishPointerDrag(root);
        });
        document.addEventListener('mousedown', (event) => {
            if (!pointerDrag) beginPointerDrag(event);
        });
        root?.addEventListener('dragstart', (event) => {
            const taskRow = event.target.closest('[data-checklist-open]');
            if (taskRow) {
                if (!event.target.closest('[data-checklist-drag-handle]')) {
                    event.preventDefault();
                    return;
                }
                draggedTaskId = taskRow.dataset.checklistOpen;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', draggedTaskId);
                taskRow.setAttribute('data-dragging', 'true');
                return;
            }

            const editorItem = event.target.closest('[data-step-editor-item]');
            if (editorItem) {
                if (!event.target.closest('[data-step-editor-drag-handle]')) {
                    event.preventDefault();
                    return;
                }
                const editor = editorItem.closest('[data-step-editor]');
                draggedStepDrag = {
                    type: 'editor',
                    target: editor?.dataset.stepTarget || '',
                    index: Number(editorItem.dataset.stepEditorItem),
                };
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', `${draggedStepDrag.type}:${draggedStepDrag.index}`);
                editorItem.setAttribute('data-dragging', 'true');
                return;
            }

            const savedStepItem = event.target.closest('[data-checklist-step-item]');
            if (savedStepItem) {
                if (!event.target.closest('[data-checklist-step-drag-handle]')) {
                    event.preventDefault();
                    return;
                }
                draggedStepDrag = {
                    type: 'saved',
                    taskId: savedStepItem.dataset.checklistStepItem,
                    index: Number(savedStepItem.dataset.checklistStepIndex),
                };
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', `${draggedStepDrag.type}:${draggedStepDrag.index}`);
                savedStepItem.setAttribute('data-dragging', 'true');
            }
        });
        root?.addEventListener('dragover', (event) => {
            if (draggedTaskId) {
                const taskRow = event.target.closest('[data-checklist-open]');
                if (!taskRow || taskRow.dataset.checklistOpen === draggedTaskId) return;
                event.preventDefault();
                const rect = taskRow.getBoundingClientRect();
                const position = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
                clearDragHints(root);
                taskRow.dataset.dropPosition = position;
                taskRow.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
                return;
            }

            if (draggedStepDrag?.type === 'editor') {
                const item = event.target.closest('[data-step-editor-item]');
                const editor = item?.closest('[data-step-editor]');
                if (!item || editor?.dataset.stepTarget !== draggedStepDrag.target) return;
                event.preventDefault();
                clearDragHints(root);
                item.dataset.dropPosition = String(getDropIndex(event, item));
                item.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
                return;
            }

            if (draggedStepDrag?.type === 'saved') {
                const item = event.target.closest('[data-checklist-step-item]');
                if (!item || item.dataset.checklistStepItem !== draggedStepDrag.taskId) return;
                event.preventDefault();
                clearDragHints(root);
                item.dataset.dropPosition = String(getDropIndex(event, item));
                item.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
            }
        });
        root?.addEventListener('drop', async (event) => {
            if (draggedTaskId) {
                const taskRow = event.target.closest('[data-checklist-open]');
                if (!taskRow || taskRow.dataset.checklistOpen === draggedTaskId) return;
                event.preventDefault();
                const dragId = draggedTaskId;
                const position = taskRow.dataset.dropPosition || 'before';
                const targetId = taskRow.dataset.checklistOpen;
                draggedTaskId = null;
                clearDragHints(root);
                await reorderTasks(dragId, targetId, position);
                return;
            }

            if (draggedStepDrag?.type === 'editor') {
                const item = event.target.closest('[data-step-editor-item]');
                const editor = item?.closest('[data-step-editor]');
                if (!item || editor?.dataset.stepTarget !== draggedStepDrag.target) return;
                event.preventDefault();
                const fromIndex = draggedStepDrag.index;
                const toIndex = Number(item.dataset.dropPosition || getDropIndex(event, item));
                draggedStepDrag = null;
                clearDragHints(root);
                reorderStepEditor(editor, fromIndex, toIndex);
                return;
            }

            if (draggedStepDrag?.type === 'saved') {
                const item = event.target.closest('[data-checklist-step-item]');
                if (!item || item.dataset.checklistStepItem !== draggedStepDrag.taskId) return;
                event.preventDefault();
                const { taskId, index } = draggedStepDrag;
                const toIndex = Number(item.dataset.dropPosition || getDropIndex(event, item));
                draggedStepDrag = null;
                clearDragHints(root);
                await reorderSavedSteps(taskId, index, toIndex);
            }
        });
        root?.addEventListener('dragend', () => {
            draggedTaskId = null;
            draggedStepDrag = null;
            clearDragHints(root);
        });
    }

    window.ChecklistFeature = {
        bindControls,
        render,
        refreshFromServer,
        getDashboardSnapshot: () => {
            const sourceTasks = getStore();
            const openTasks = sourceTasks.filter((task) => !task.completed);
            const doneTasks = sourceTasks.filter((task) => task.completed);
            const total = sourceTasks.length;
            return {
                open: openTasks.length,
                done: doneTasks.length,
                total,
                progress: total ? Math.round((doneTasks.length / total) * 100) : 0,
                tasks: openTasks
                    .slice()
                    .sort(fallbackTaskCompare)
                    .slice(0, 5)
                    .map((task) => ({
                        id: task.id,
                        title: task.title,
                        domain: task.domain,
                        domainLabel: getDomain(task.domain).label,
                        priority: task.priority,
                        stepDone: task.steps.filter((step) => step.done).length,
                        stepTotal: task.steps.length,
                    })),
            };
        },
        selectTask: (taskId) => {
            activeTaskId = String(taskId || '');
            activeFilter = 'all';
            render({ skipRemoteLoad: true });
        },
        refresh: queueRemoteLoad,
    };
})(window);
