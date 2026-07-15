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
    const TONE_CLASSES = {
        sky: 'text-sky-700 bg-sky-50 border-sky-100',
        emerald: 'text-emerald-700 bg-emerald-50 border-emerald-100',
        indigo: 'text-indigo-700 bg-indigo-50 border-indigo-100',
        slate: 'text-slate-600 bg-slate-50 border-slate-100',
    };
    const CARD_TONE_CLASSES = {
        sky: {
            base: 'bg-sky-100 border-sky-300 hover:bg-sky-200/80 hover:border-sky-400',
            active: 'bg-sky-200 border-sky-400 ring-2 ring-sky-300',
        },
        emerald: {
            base: 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200/80 hover:border-emerald-400',
            active: 'bg-emerald-200 border-emerald-400 ring-2 ring-emerald-300',
        },
        indigo: {
            base: 'bg-violet-100 border-violet-300 hover:bg-violet-200/80 hover:border-violet-400',
            active: 'bg-violet-200 border-violet-400 ring-2 ring-violet-300',
        },
        slate: {
            base: 'bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300',
            active: 'bg-gray-50 border-gray-300 ring-2 ring-gray-200',
        },
    };

    let tasks = [];
    let activeFilter = 'open';
    let activeDomain = 'all';
    let activeTaskId = null;
    let isBound = false;
    let isAddFormOpen = false;
    let remoteAvailable = true;
    let remoteLoaded = false;
    let remoteLoadStarted = false;
    let remoteSupportsDisplayOrder = true;
    let draggedTaskId = null;
    let draggedStepDrag = null;
    let pointerDrag = null;

    function escapeHtml(value) {
        return window.AppUtils.escapeHtml(value);
    }

    function escapeAttr(value) {
        return window.AppUtils.escapeAttr(value);
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

    function stepTitlesFromText(value) {
        return String(value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .slice(0, 80);
    }

    function renderStepEditor(textareaId, value = '') {
        return `
            <div data-step-editor data-step-target="${escapeAttr(textareaId)}">
                <textarea id="${escapeAttr(textareaId)}" class="hidden">${escapeHtml(value)}</textarea>
                <div class="flex gap-1.5">
                    <input type="text" data-step-editor-input class="min-w-0 flex-1 border border-gray-200 rounded-md px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="스텝 입력">
                    <button type="button" data-step-editor-add class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-900 text-white hover:bg-gray-800" title="스텝 추가" aria-label="스텝 추가">
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
        const titles = stepTitlesFromText(textarea.value);
        if (titles.length === 0) {
            list.innerHTML = '<p class="text-[11px] text-gray-400">스텝이 필요하면 하나씩 추가하세요.</p>';
            return;
        }
        list.innerHTML = titles.map((title, index) => `
            <div data-step-editor-item="${index}" class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 transition">
                <button type="button" data-step-editor-drag-handle class="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-gray-300 hover:text-gray-600 active:cursor-grabbing" title="스텝 순서 이동" aria-label="스텝 순서 이동">
                    <i class="fas fa-grip-vertical text-xs"></i>
                </button>
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-white text-[10px] font-bold text-gray-400">${index + 1}</span>
                <span class="min-w-0 flex-1 truncate">${escapeHtml(title)}</span>
                <button type="button" data-step-editor-remove="${index}" class="shrink-0 text-gray-300 hover:text-rose-500" title="삭제">
                    <i class="fas fa-xmark text-xs"></i>
                </button>
            </div>
        `).join('');
    }

    function hydrateStepEditors() {
        document.querySelectorAll('[data-step-editor]').forEach(renderStepEditorList);
    }

    function addStepFromEditor(editor) {
        const input = editor?.querySelector('[data-step-editor-input]');
        const textarea = editor?.querySelector('textarea');
        if (!input || !textarea) return;
        const title = String(input.value || '').trim();
        if (!title) return;
        const titles = stepTitlesFromText(textarea.value);
        if (!titles.some((item) => item.toLowerCase() === title.toLowerCase())) {
            titles.push(title);
            textarea.value = titles.join('\n');
        }
        input.value = '';
        renderStepEditorList(editor);
    }

    function removeStepFromEditor(editor, index) {
        const textarea = editor?.querySelector('textarea');
        if (!textarea) return;
        const titles = stepTitlesFromText(textarea.value);
        titles.splice(Number(index), 1);
        textarea.value = titles.join('\n');
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
        const titles = stepTitlesFromText(textarea.value);
        const source = Number(fromIndex);
        let destination = Number(toIndex);
        if (!Number.isInteger(source) || !Number.isInteger(destination)) return;
        if (destination > source) destination -= 1;
        textarea.value = moveArrayItem(titles, source, destination).join('\n');
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
            completed: Boolean(raw.completed ?? raw.is_done),
            completedAt: raw.completedAt || raw.completed_at || null,
            createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
            updatedAt: raw.updatedAt || raw.updated_at || new Date().toISOString(),
            displayOrder: Number.isFinite(displayOrder) ? displayOrder : null,
        };
    }

    function fallbackTaskCompare(a, b) {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
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
                .select('id,title,note,category,domain,steps,due_date,priority,is_done,completed_at,created_at,updated_at,display_order')
                .order('display_order', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false });
            if (error && remoteSupportsDisplayOrder && isDisplayOrderSchemaError(error)) {
                remoteSupportsDisplayOrder = false;
                ({ data, error } = await client
                    .from(TABLE_NAME)
                    .select('id,title,note,category,domain,steps,due_date,priority,is_done,completed_at,created_at,updated_at')
                    .order('is_done', { ascending: true })
                    .order('due_date', { ascending: true })
                    .order('created_at', { ascending: false }));
            }
            if (error) throw error;

            const remoteTasks = sortTasks((data || []).map(fromRemoteRow).filter(Boolean));
            const localTasks = getStore();
            tasks = saveStore([...remoteTasks, ...localTasks]);
            if (localTasks.length > 0) await persistAllRemote();
            remoteLoaded = true;
            render({ skipRemoteLoad: true });
            renderSyncStatus('서버 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            window.LifeDashboardFeature?.render();
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

    function renderTaskCard(task) {
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        const cardTone = CARD_TONE_CLASSES[domain.tone] || CARD_TONE_CLASSES.slate;
        const selectedClass = activeTaskId === task.id ? cardTone.active : `${cardTone.base} hover:shadow-sm`;
        const doneClass = task.completed ? 'opacity-60' : '';
        const titleClass = task.completed ? 'line-through text-gray-400' : 'text-gray-900';
        const domainBadge = `<span class="shrink-0 font-bold border px-1.5 py-0.5 rounded text-[10px] bg-white/75 ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}">${escapeHtml(domain.label)}</span>`;
        const stepBadge = stepSummary.total
            ? `<span>${stepSummary.done}/${stepSummary.total} 스텝</span>`
            : '';
        return `
            <article data-checklist-open="${escapeAttr(task.id)}" class="group cursor-pointer rounded-md border px-2.5 py-2 transition ${selectedClass} ${doneClass}">
                <div class="flex min-w-0 items-start gap-2">
                    <button type="button" data-checklist-drag-handle class="mt-0.5 flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-gray-400 hover:text-gray-700 active:cursor-grabbing" title="할 일 순서 이동" aria-label="할 일 순서 이동">
                        <i class="fas fa-grip-vertical text-xs"></i>
                    </button>
                    <input type="checkbox" data-checklist-toggle="${escapeAttr(task.id)}" ${task.completed ? 'checked' : ''} class="mt-0.5 h-4 w-4 rounded border-gray-300 accent-indigo-600 shrink-0">
                    <p class="min-w-0 flex-1 truncate text-[13px] font-bold leading-5 ${titleClass}">${escapeHtml(task.title)}</p>
                    <button type="button" data-checklist-delete="${escapeAttr(task.id)}" class="-mt-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-rose-500 transition px-1 py-0.5" title="삭제" aria-label="${escapeAttr(task.title)} 삭제">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
                <div class="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-gray-500">
                    ${domainBadge}
                    <span class="shrink-0">${escapeHtml(task.dueDate)}</span>
                    ${stepBadge ? `<span class="shrink-0">${stepBadge}</span>` : ''}
                    ${task.note ? `<span class="min-w-0 truncate text-gray-400">${escapeHtml(task.note)}</span>` : ''}
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
        list.innerHTML = visibleTasks.map(renderTaskCard).join('');
    }

    function renderDetailPanel() {
        const panel = document.getElementById('checklist-detail-panel');
        if (!panel) return;
        const task = tasks.find((item) => item.id === activeTaskId);
        if (!task) {
            panel.className = 'min-w-0 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-5 xl:min-h-[560px]';
            panel.innerHTML = `
                <div class="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                    <div class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-300 shadow-sm">
                        <i class="fas fa-list-check"></i>
                    </div>
                    <p class="text-sm font-bold text-gray-600">할 일을 선택하세요</p>
                    <p class="mt-1 text-xs text-gray-400">왼쪽 카드 하나를 누르면 이 넓은 영역에서 상세내역을 확인하고 수정할 수 있습니다.</p>
                </div>
            `;
            return;
        }
        panel.className = 'min-w-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm xl:min-h-[560px] xl:p-4';
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        panel.innerHTML = `
            <div>
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <h4 class="text-lg font-black text-gray-900 leading-snug">${escapeHtml(task.title)}</h4>
                            <span class="inline-flex text-[10px] font-bold border px-2 py-0.5 rounded ${TONE_CLASSES[domain.tone] || TONE_CLASSES.slate}">${escapeHtml(domain.label)}</span>
                        </div>
                        <p class="mt-1 text-[11px] text-gray-400">${escapeHtml(domain.label)} · ${escapeHtml(task.dueDate)} · ${stepSummary.done}/${stepSummary.total} 스텝</p>
                    </div>
                    <button type="button" data-checklist-close-detail class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:text-gray-700" title="상세 닫기" aria-label="상세 닫기">
                        <i class="fas fa-xmark text-xs"></i>
                    </button>
                </div>

                <div class="mt-3 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_220px] gap-3">
                    <label class="block">
                        <span class="text-[11px] font-bold text-gray-500">제목</span>
                        <input id="checklist-detail-title-edit" type="text" value="${escapeAttr(task.title)}" class="mt-1 w-full border border-gray-200 rounded-md px-2.5 py-2 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="할 일">
                    </label>

                    <div class="grid grid-cols-2 gap-2">
                        <label class="block">
                            <span class="text-[11px] font-bold text-gray-500">날짜</span>
                            <input id="checklist-detail-due-edit" type="date" value="${escapeAttr(task.dueDate)}" class="mt-1 w-full border border-gray-200 rounded-md px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                        </label>
                        <label class="block">
                            <span class="text-[11px] font-bold text-gray-500">영역</span>
                            <select id="checklist-detail-domain-edit" class="mt-1 w-full border border-gray-200 rounded-md px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                ${DOMAINS.map((item) => `<option value="${escapeAttr(item.key)}" ${item.key === task.domain ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                            </select>
                        </label>
                    </div>

                    <div class="xl:col-span-2 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-3">
                        <label class="block">
                            <span class="text-[11px] font-bold text-gray-500">상세내역</span>
                            <textarea id="checklist-detail-note-edit" class="mt-1 w-full min-h-[340px] resize-y border border-gray-200 rounded-md px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none bg-white" placeholder="상세내역을 길게 적어둘 수 있습니다.">${escapeHtml(task.note)}</textarea>
                        </label>

                        <div>
                            <div class="block">
                                <span class="text-[11px] font-bold text-gray-500">스텝 / 하위 할 일</span>
                                <div class="mt-1">${renderStepEditor('checklist-detail-steps-edit', stepsToText(task.steps))}</div>
                            </div>
                            <div class="mt-2 space-y-1.5">
                                ${task.steps.length ? task.steps.map((step, index) => `
                                    <div data-checklist-step-item="${escapeAttr(task.id)}" data-checklist-step-index="${index}" class="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 transition">
                                        <button type="button" data-checklist-step-drag-handle class="mt-0.5 flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-gray-300 hover:text-gray-600 active:cursor-grabbing" title="순서 이동" aria-label="하위 할 일 순서 이동">
                                            <i class="fas fa-grip-vertical text-xs"></i>
                                        </button>
                                        <input type="checkbox" data-checklist-step-toggle="${escapeAttr(task.id)}" data-step-id="${escapeAttr(step.id)}" ${step.done ? 'checked' : ''} class="mt-0.5 h-3.5 w-3.5 accent-indigo-600 shrink-0">
                                        <span class="min-w-0 flex-1 ${step.done ? 'line-through text-gray-400' : ''}">${escapeHtml(step.title)}</span>
                                    </div>
                                `).join('') : '<p class="text-xs text-gray-400">등록된 스텝이 없습니다.</p>'}
                            </div>
                        </div>
                    </div>

                    <button type="button" data-checklist-save-detail="${escapeAttr(task.id)}" class="xl:col-span-2 w-full rounded-md bg-gray-900 px-3 py-2 text-[11px] font-bold text-white hover:bg-gray-800">수정 저장</button>
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
                <button type="button" data-checklist-domain="all" class="px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition ${allActive ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}">전체</button>
                ${DOMAINS.map(renderDomainButton).join('')}
            `;
        }
    }

    function ensureShell() {
        const root = document.getElementById('routine-checklist-view');
        ensureDragStyles();
        if (!root || document.getElementById('checklist-task-list')) return;
        root.innerHTML = `
            <div class="mb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                    <p class="text-[10px] md:text-xs font-bold text-indigo-500 mb-1">생활 도구</p>
                    <h2 class="text-xl md:text-2xl font-bold text-gray-900">할 일 보드</h2>
                    <p class="text-xs text-gray-500 mt-1">메모와 하위 할 일까지 한곳에서 정리합니다.</p>
                </div>
                <span id="checklist-sync-badge" class="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md whitespace-nowrap w-fit">로컬 저장</span>
            </div>

            <div class="space-y-2.5 md:space-y-3 mb-8">
                <section class="bg-white p-2.5 md:p-3 rounded-lg border border-gray-100 min-w-0">
                    <div class="flex flex-col gap-2 mb-2.5">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                            <h3 class="text-sm font-bold text-gray-900">할 일 목록</h3>
                            <div class="flex flex-wrap items-center gap-1.5">
                                <div id="checklist-filters" class="flex flex-wrap gap-1.5"></div>
                                <div id="checklist-add-panel"></div>
                            </div>
                        </div>
                        <div id="checklist-domain-filters" class="flex flex-wrap gap-1.5"></div>
                    </div>
                    <div class="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-3 min-w-0">
                        <div class="min-w-0">
                            <div id="checklist-task-list" class="space-y-1.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-1"></div>
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

    function renderAddForm() {
        const panel = document.getElementById('checklist-add-panel');
        if (!panel) return;
        panel.innerHTML = `
            <button type="button" data-checklist-toggle-add-form class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm" title="할 일 추가" aria-label="할 일 추가">
                <i class="fas fa-plus text-[11px]"></i>
            </button>
            ${isAddFormOpen ? `
                <div data-checklist-close-add-form class="fixed inset-0 z-50 flex items-start justify-center bg-gray-950/30 px-4 py-8 backdrop-blur-[1px]">
                    <div id="checklist-add-form" class="mt-8 w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="새 할 일 추가" data-checklist-dialog>
                        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <p class="text-sm font-black text-gray-900">새 할 일</p>
                            <button type="button" data-checklist-close-add-form class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="닫기" aria-label="새 할 일 창 닫기">
                                <i class="fas fa-xmark text-sm"></i>
                            </button>
                        </div>
                        <div class="space-y-3 px-4 py-4">
                            <input id="checklist-title-input" type="text" class="w-full border-0 border-b border-gray-200 px-0 py-2 text-lg font-bold focus:border-indigo-500 focus:ring-0 outline-none" placeholder="할 일 제목">

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <label class="block sm:col-span-1">
                                    <span class="text-[11px] font-bold text-gray-500">날짜</span>
                                    <input id="checklist-due-input" type="date" class="mt-1 w-full border border-gray-200 rounded-md px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                                </label>
                                <label class="block sm:col-span-1">
                                    <span class="text-[11px] font-bold text-gray-500">영역</span>
                                    <select id="checklist-domain-input" class="mt-1 w-full border border-gray-200 rounded-md px-2.5 py-2 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white">
                                        ${DOMAINS.map((item) => `<option value="${escapeAttr(item.key)}">${escapeHtml(item.label)}</option>`).join('')}
                                    </select>
                                </label>
                            </div>

                            <label class="block">
                                <span class="text-[11px] font-bold text-gray-500">상세내역</span>
                                <textarea id="checklist-note-input" class="mt-1 w-full min-h-[180px] resize-y border border-gray-200 rounded-md px-3 py-2.5 text-sm leading-relaxed focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="필요한 맥락, 참고 내용, 처리 기준을 길게 적어두세요."></textarea>
                            </label>

                            <div class="block">
                                <span class="text-[11px] font-bold text-gray-500">스텝 / Sub tasks</span>
                                <div class="mt-1">${renderStepEditor('checklist-steps-input')}</div>
                            </div>
                        </div>
                        <div class="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3">
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
        const dueInput = document.getElementById('checklist-due-input');
        if (dueInput && !dueInput.value) dueInput.value = todayString();
        renderSummary();
        renderTasks();
        renderDetailPanel();
        hydrateStepEditors();
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
        const dueEl = document.getElementById('checklist-due-input');
        const domainEl = document.getElementById('checklist-domain-input');
        const task = normalizeTask({
            title: titleEl?.value,
            note: noteEl?.value,
            steps: parseStepsText(stepsEl?.value || ''),
            dueDate: dueEl?.value || todayString(),
            domain: domainEl?.value || 'life',
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
        const titleEl = document.getElementById('checklist-detail-title-edit');
        const dueEl = document.getElementById('checklist-detail-due-edit');
        const domainEl = document.getElementById('checklist-detail-domain-edit');
        const noteEl = document.getElementById('checklist-detail-note-edit');
        const stepsEl = document.getElementById('checklist-detail-steps-edit');
        const title = String(titleEl?.value || '').trim();
        if (!title) {
            toast('할 일 제목을 입력해주세요.', 'warning');
            return;
        }
        task.title = title;
        task.dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueEl?.value || '') ? dueEl.value : todayString();
        task.domain = getDomain(domainEl?.value || task.domain).key;
        task.priority = 'normal';
        task.note = String(noteEl?.value || '').trim();
        task.steps = parseStepsText(stepsEl?.value || '', task.steps);
        task.updatedAt = now;
        tasks = saveStore(tasks);
        render({ skipRemoteLoad: true });
        await persistRemoteTask(task);
        toast('할 일을 수정했습니다.', 'info');
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
                activeTaskId = null;
                render({ skipRemoteLoad: true });
                return;
            }
            const stepAddBtn = event.target.closest('[data-step-editor-add]');
            if (stepAddBtn) {
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
        root?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target?.closest?.('[data-step-editor-input]')) {
                event.preventDefault();
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
        document.getElementById('checklist-clear-done')?.addEventListener('click', clearDone);
    }

    window.ChecklistFeature = {
        bindControls,
        render,
        getDashboardSnapshot: () => {
            const sourceTasks = getStore();
            const today = todayString();
            const openTasks = sourceTasks.filter((task) => !task.completed);
            const dueToday = openTasks.filter((task) => task.dueDate === today).length;
            const overdue = openTasks.filter((task) => task.dueDate < today).length;
            return {
                open: openTasks.length,
                dueToday,
                overdue,
                tasks: openTasks
                    .slice()
                    .sort(fallbackTaskCompare)
                    .slice(0, 5)
                    .map((task) => ({
                        id: task.id,
                        title: task.title,
                        dueDate: task.dueDate,
                        domain: task.domain,
                        domainLabel: getDomain(task.domain).label,
                        priority: task.priority,
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
