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
    let isDetailPanelOpen = Boolean(restoredChecklistUiState.activeTaskId);
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
    let reportSearch = '';
    let reportSort = 'recent';
    let isReportLinkFormOpen = false;

    function escapeHtml(value) {
        return window.AppUtils.escapeHtml(value);
    }

    function escapeAttr(value) {
        return window.AppUtils.escapeAttr(value);
    }

    function normalizeReportUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        try {
            const parsed = new URL(candidate);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
        } catch (error) {
            return null;
        }
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

    const NOTE_ICONS = Object.freeze({
        star: { label: '중요', icon: 'fa-star', tone: 'text-amber-500' },
        lightbulb: { label: '아이디어', icon: 'fa-lightbulb', tone: 'text-amber-500' },
        calendar: { label: '일정', icon: 'fa-calendar-days', tone: 'text-sky-500' },
        paperclip: { label: '첨부', icon: 'fa-paperclip', tone: 'text-indigo-500' },
        warning: { label: '주의', icon: 'fa-triangle-exclamation', tone: 'text-rose-500' },
    });

    function formatNoteInline(value) {
        return escapeHtml(String(value || ''))
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
            .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
            .replace(/\{\{icon:(star|lightbulb|calendar|paperclip|warning)\}\}/g, (match, key) => {
                const meta = NOTE_ICONS[key];
                return `<i class="fas ${meta.icon} ${meta.tone} mr-1" title="${meta.label}" aria-label="${meta.label}"></i>`;
            });
    }

    function renderNoteIndent(spaceCount) {
        const groups = Math.floor(spaceCount / 3);
        const remainder = spaceCount % 3;
        return `${'<span class="inline-block w-5" aria-hidden="true"></span>'.repeat(groups)}${'&nbsp;'.repeat(remainder)}`;
    }

    function formatNotePreview(value, targetId) {
        return String(value || '').split('\n').map((line, lineIndex) => {
            const checkbox = line.match(/^(\s*)- \[([ xX])\]\s?(.*)$/);
            if (checkbox) {
                const checked = checkbox[2].toLowerCase() === 'x';
                return `${renderNoteIndent(checkbox[1].length)}<label class="inline-flex items-center gap-1.5 align-middle"><input type="checkbox" data-note-preview-checkbox data-note-target="${escapeAttr(targetId)}" data-note-line="${lineIndex}" class="m-0 h-3 w-3 shrink-0 self-center rounded-sm border-gray-300 text-indigo-600" ${checked ? 'checked' : ''}><span class="leading-relaxed ${checked ? 'text-gray-400 line-through' : ''}">${formatNoteInline(checkbox[3])}</span></label>`;
            }
            const leadingSpaces = line.match(/^\s*/)?.[0]?.length || 0;
            return `${renderNoteIndent(leadingSpaces)}${formatNoteInline(line.slice(leadingSpaces))}`;
        }).join('<br>');
    }

    function renderNoteEditor({ id, value = '', minHeightClass = 'min-h-[180px]', placeholder = '' }) {
        return `
            <div class="mt-1 overflow-hidden rounded-md border border-gray-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                <div class="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
                    <button type="button" data-checklist-note-format="bold" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-xs font-black text-gray-700 hover:border-indigo-300 hover:text-indigo-700" title="굵게 (**텍스트**)" aria-label="선택한 글자 굵게"><span aria-hidden="true">B</span></button>
                    <button type="button" data-checklist-note-format="underline" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-xs font-bold text-gray-700 underline hover:border-indigo-300 hover:text-indigo-700" title="밑줄 (++텍스트++)" aria-label="선택한 글자 밑줄"><span aria-hidden="true">U</span></button>
                    <button type="button" data-checklist-note-format="strike" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-xs font-bold text-gray-700 line-through hover:border-indigo-300 hover:text-indigo-700" title="취소선 (~~텍스트~~)" aria-label="선택한 글자 취소선"><span aria-hidden="true">S</span></button>
                    <span class="mx-0.5 h-5 w-px bg-gray-200" aria-hidden="true"></span>
                    <button type="button" data-checklist-note-command="indent" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700" title="들여쓰기 (Tab)" aria-label="선택한 줄 들여쓰기"><i class="fas fa-indent text-[11px]"></i></button>
                    <button type="button" data-checklist-note-command="checkbox" data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700" title="체크박스 추가" aria-label="선택한 줄에 체크박스 추가"><i class="fas fa-square-check text-[11px]"></i></button>
                    <button type="button" data-checklist-icon-picker-toggle data-note-target="${escapeAttr(id)}" class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-700" title="아이콘 추가" aria-label="아이콘 선택 열기" aria-expanded="false"><i class="fas fa-icons text-[11px]"></i></button>
                    <div data-checklist-icon-picker-for="${escapeAttr(id)}" class="hidden flex flex-wrap items-center gap-1 rounded-md border border-indigo-100 bg-white p-1 shadow-sm">
                        ${Object.entries(NOTE_ICONS).map(([key, meta]) => `<button type="button" data-checklist-note-icon="${key}" data-note-target="${escapeAttr(id)}" class="flex h-7 w-7 items-center justify-center rounded hover:bg-gray-50 ${meta.tone}" title="${meta.label}" aria-label="${meta.label} 아이콘 추가"><i class="fas ${meta.icon} text-[11px]"></i></button>`).join('')}
                    </div>
                </div>
                <div data-note-preview-for="${escapeAttr(id)}" class="hidden border-t border-gray-100 bg-gray-50/70 px-3 py-2">
                    <span class="text-[9px] font-bold tracking-wide text-gray-400">적용 미리보기</span>
                    <div data-note-preview-content class="mt-1 min-h-5 break-words text-sm leading-relaxed text-gray-700"></div>
                </div>
                <textarea id="${escapeAttr(id)}" data-checklist-note-editor class="block w-full ${minHeightClass} resize-y border-0 px-3 py-2.5 text-sm leading-relaxed outline-none bg-white focus:ring-0" placeholder="${escapeAttr(placeholder)}">${escapeHtml(value)}</textarea>
            </div>
        `;
    }

    function updateNotePreview(targetId) {
        const textarea = document.getElementById(targetId);
        const preview = document.querySelector(`[data-note-preview-for="${CSS.escape(targetId)}"]`);
        const content = preview?.querySelector('[data-note-preview-content]');
        if (!textarea || !preview || !content) return;
        const value = textarea.value || '';
        const hasFormatting = /\*\*[^*\n]+\*\*|\+\+[^+\n]+\+\+|~~[^~\n]+~~|^\s{3}|^\s*- \[[ xX]\]|\{\{icon:(?:star|lightbulb|calendar|paperclip|warning)\}\}/m.test(value);
        preview.classList.toggle('hidden', !hasFormatting);
        content.innerHTML = hasFormatting ? formatNotePreview(value, targetId) : '';
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

    function applyNoteIndentation(textarea, outdent = false) {
        if (!textarea) return;
        const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
        const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
        const lineStart = start > 0 ? textarea.value.lastIndexOf('\n', start - 1) + 1 : 0;
        const effectiveEnd = end > start && textarea.value[end - 1] === '\n' ? end - 1 : end;
        const nextLineBreak = textarea.value.indexOf('\n', effectiveEnd);
        const lineEnd = nextLineBreak === -1 ? textarea.value.length : nextLineBreak;
        const block = textarea.value.slice(lineStart, lineEnd);
        const replacement = block.split('\n').map((line) => (
            outdent ? line.replace(/^ {1,3}/, '') : `   ${line}`
        )).join('\n');
        const wasCollapsed = start === end;
        const firstLineDelta = replacement.split('\n')[0].length - block.split('\n')[0].length;
        textarea.setRangeText(replacement, lineStart, lineEnd, 'end');
        if (wasCollapsed) {
            const nextCursor = Math.max(lineStart, start + firstLineDelta);
            textarea.setSelectionRange(nextCursor, nextCursor);
        } else {
            textarea.setSelectionRange(lineStart, lineStart + replacement.length);
        }
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function applyNoteCommand(targetId, command) {
        const textarea = document.getElementById(targetId);
        if (!textarea || !['indent', 'checkbox'].includes(command)) return;
        if (command === 'indent') {
            applyNoteIndentation(textarea);
            return;
        }
        const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
        const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
        const lineStart = textarea.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const nextLineBreak = textarea.value.indexOf('\n', end);
        const lineEnd = nextLineBreak === -1 ? textarea.value.length : nextLineBreak;
        const block = textarea.value.slice(lineStart, lineEnd);
        const replacement = block.split('\n').map((line) => {
            if (/^\s*- \[[ xX]\]/.test(line)) return line;
            const leading = line.match(/^\s*/)?.[0] || '';
            return `${leading}- [ ] ${line.slice(leading.length)}`;
        }).join('\n');
        textarea.setRangeText(replacement, lineStart, lineEnd, 'end');
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function insertNoteIcon(targetId, iconKey) {
        const textarea = document.getElementById(targetId);
        if (!textarea || !NOTE_ICONS[iconKey]) return;
        const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
        const end = Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : start;
        textarea.setRangeText(`{{icon:${iconKey}}} `, start, end, 'end');
        textarea.focus();
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function toggleNotePreviewCheckbox(targetId, lineIndex, checked) {
        const textarea = document.getElementById(targetId);
        if (!textarea) return;
        const lines = textarea.value.split('\n');
        if (!lines[lineIndex] || !/^\s*- \[[ xX]\]/.test(lines[lineIndex])) return;
        lines[lineIndex] = lines[lineIndex].replace(/^(\s*)- \[[ xX]\]/, `$1- [${checked ? 'x' : ' '}]`);
        textarea.value = lines.join('\n');
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

    function getFilteredTasks() {
        let nextTasks = tasks.slice();
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
        const scopedTasks = tasks;
        const open = scopedTasks.filter((task) => !task.completed && !task.paused).length;
        const paused = scopedTasks.filter((task) => !task.completed && task.paused).length;
        const done = scopedTasks.filter((task) => task.completed).length;
        const total = open + paused + done;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return { open, paused, done, total, pct };
    }

    function renderTaskCard(task) {
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        const cardTone = CARD_TONE_CLASSES[domain.tone] || CARD_TONE_CLASSES.slate;
        const selectedClass = activeTaskId === task.id ? cardTone.active : `${cardTone.base} hover:shadow-sm`;
        const doneClass = task.completed ? 'opacity-60' : task.paused ? 'opacity-45 grayscale-[15%]' : '';
        const titleClass = task.completed ? 'line-through text-gray-400' : 'text-gray-900';
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
                ${(task.paused || stepBadge) ? `<div class="mt-1 flex min-w-0 items-center gap-1.5 pl-7 text-[10px] text-gray-500">
                    ${task.paused ? '<span class="shrink-0 font-bold text-amber-600"><i class="fas fa-pause mr-1"></i>Monitor</span>' : ''}
                    ${stepBadge ? `<span class="shrink-0">${stepBadge}</span>` : ''}
                </div>` : ''}
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
        list.innerHTML = DOMAINS.map((domain) => {
            const domainTasks = visibleTasks.filter((task) => task.domain === domain.key);
            return `
                <section class="space-y-1.5" data-checklist-group="${escapeAttr(domain.key)}">
                    <div class="sticky top-0 z-[1] flex items-center justify-between rounded-md bg-gray-50/95 px-2 py-1 backdrop-blur"><h4 class="text-[10px] font-black tracking-wide text-gray-600">${escapeHtml(domain.label)}</h4><span class="text-[10px] text-gray-400">${domainTasks.length}</span></div>
                    ${domainTasks.length ? domainTasks.map(renderTaskCard).join('') : '<p class="px-2 py-2 text-[10px] text-gray-300">표시할 할 일이 없습니다.</p>'}
                </section>`;
        }).join('');
    }

    function getReportAssetType(item = {}) {
        const source = `${item.name || ''} ${item.url || ''} ${item.path || ''}`.toLowerCase();
        if (/(docs\.google\.com\/spreadsheets|google\s*sheets?|spreadsheet|excel|엑셀|\.xlsx?(?:$|[?#/]))/.test(source)) {
            return { key: 'excel', label: 'Excel', icon: 'fa-file-excel', tone: 'bg-emerald-50 text-emerald-600' };
        }
        if (/(docs\.google\.com\/presentation|google\s*slides?|presentation|powerpoint|파워포인트|ppt|\.pptx?(?:$|[?#/]))/.test(source)) {
            return { key: 'powerpoint', label: 'PowerPoint', icon: 'fa-file-powerpoint', tone: 'bg-orange-50 text-orange-600' };
        }
        return { key: 'link', label: '외부', icon: 'fa-link', tone: 'bg-indigo-50 text-indigo-500' };
    }

    function renderReportLibrary() {
        const panel = document.getElementById('checklist-report-library');
        if (!panel) return;
        const selectedTask = tasks.find((task) => task.id === activeTaskId);
        const legacyUrl = normalizeReportUrl(selectedTask?.completionReport?.externalUrl);
        const allLibraryItems = selectedTask ? [
            ...(selectedTask.reportFiles || []).map((item, index) => ({ ...item, sourceIndex: index })),
            ...(legacyUrl && !(selectedTask.reportFiles || []).some((item) => normalizeReportUrl(item.url) === legacyUrl)
                ? [{ kind: 'link', name: '이전 PPT 링크', url: legacyUrl, createdAt: selectedTask.completionReport?.updatedAt, sourceIndex: 'legacy' }]
                : []),
        ] : [];
        const libraryItems = allLibraryItems
            .filter((item) => !reportSearch || `${item.name || ''} ${item.url || ''}`.toLowerCase().includes(reportSearch.toLowerCase()))
            .sort((a, b) => {
                if (reportSort === 'title') return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
        panel.innerHTML = `
            <section class="flex min-h-[560px] flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-sm xl:min-h-[calc(100vh-205px)]">
                <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0"><h3 class="text-sm font-black text-gray-900">Report Library</h3>${selectedTask ? `<p class="mt-0.5 truncate text-[9px] text-gray-400">${escapeHtml(selectedTask.title)} · ${allLibraryItems.length}개</p>` : ''}</div>
                    ${selectedTask ? '<button type="button" data-checklist-report-link-focus class="shrink-0 rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1.5 text-[9px] font-bold text-indigo-700 hover:bg-indigo-100"><i class="fas fa-plus mr-1"></i>링크 추가</button>' : ''}
                </div>
                ${selectedTask ? `
                    ${isReportLinkFormOpen ? `<div class="mt-3 space-y-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2.5">
                        <label class="block text-[9px] font-bold text-gray-600">Report 제목<input id="checklist-report-link-title" type="text" placeholder="예: 8월 자산점검 PPT" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300"></label>
                        <label class="block text-[9px] font-bold text-gray-600">Report 링크<input id="checklist-report-external-url" type="url" inputmode="url" placeholder="Google Slides, Sheets, Drive 또는 문서 링크" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300"></label>
                        <div class="flex justify-end gap-1.5"><button type="button" data-checklist-report-link-cancel class="rounded-md px-2.5 py-1.5 text-[9px] font-bold text-gray-500 hover:bg-white">취소</button><button type="button" data-checklist-report-link-save="${escapeAttr(selectedTask.id)}" class="rounded-md bg-gray-900 px-2.5 py-1.5 text-[9px] font-bold text-white hover:bg-gray-800">Library에 추가</button></div>
                    </div>` : ''}
                    <div class="mt-3 grid grid-cols-[minmax(0,1fr)_82px] gap-2">
                        <label class="relative"><i class="fas fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-300"></i><input id="checklist-report-search" type="search" value="${escapeAttr(reportSearch)}" placeholder="Library 검색" class="h-8 w-full rounded-md border border-gray-200 pl-7 pr-2 text-[10px] outline-none focus:border-indigo-300"></label>
                        <select id="checklist-report-sort" class="h-8 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500 outline-none"><option value="recent" ${reportSort === 'recent' ? 'selected' : ''}>최신순</option><option value="title" ${reportSort === 'title' ? 'selected' : ''}>제목순</option></select>
                    </div>
                    <div class="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1">
                        ${libraryItems.length ? libraryItems.map((item) => {
                            const linkUrl = normalizeReportUrl(item.url);
                            const isLink = Boolean(linkUrl);
                            const assetType = getReportAssetType(item);
                            const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString('ko-KR') : '';
                            return `<article class="group flex items-center gap-2 rounded-md border border-gray-100 bg-white p-2 hover:border-indigo-200"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${assetType.tone}"><i class="fas ${assetType.icon} text-xs"></i></span><div class="min-w-0 flex-1"><strong class="block truncate text-[10px] text-gray-800">${escapeHtml(item.name || (isLink ? 'Report 링크' : 'Report 파일'))}</strong><span class="mt-0.5 block text-[9px] text-gray-400">${escapeHtml(assetType.label)} ${isLink ? '링크' : '파일'}${date ? ` · ${escapeHtml(date)}` : ''}</span></div>${isLink ? `<a href="${escapeAttr(linkUrl)}" target="_blank" rel="noopener noreferrer" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-indigo-500 hover:bg-indigo-50" title="Report 열기" aria-label="${escapeAttr(item.name || 'Report')} 열기"><i class="fas fa-arrow-up-right-from-square text-[10px]"></i></a><button type="button" data-checklist-report-link-delete="${escapeAttr(selectedTask.id)}" data-report-index="${escapeAttr(item.sourceIndex)}" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-300 hover:bg-rose-50 hover:text-rose-500" title="링크 삭제" aria-label="${escapeAttr(item.name || 'Report')} 링크 삭제"><i class="fas fa-trash text-[10px]"></i></button>` : `<button type="button" data-checklist-report-open="${escapeAttr(selectedTask.id)}" data-report-index="${escapeAttr(item.sourceIndex)}" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-indigo-500 hover:bg-indigo-50" title="파일 열기" aria-label="${escapeAttr(item.name || 'Report')} 파일 열기"><i class="fas fa-download text-[10px]"></i></button>`}</article>`;
                        }).join('') : '<div class="rounded-lg border border-dashed border-gray-200 px-4 py-12 text-center"><p class="text-xs font-bold text-gray-500">아직 등록된 Report가 없습니다.</p><p class="mt-1 text-[9px] text-gray-400">이 할 일의 Report 링크를 추가하세요.</p></div>'}
                    </div>
                ` : `
                    <div class="flex flex-1 flex-col items-center justify-center py-16 text-center"><div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-300"><i class="fas fa-folder-open"></i></div><p class="mt-3 text-xs font-bold text-gray-600">할 일을 선택하세요</p><p class="mt-1 text-[9px] text-gray-400">선택한 할 일의 Report Library가 표시됩니다.</p></div>
                `}
            </section>`;
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
        panel.className = isDetailPanelOpen
            ? 'fixed inset-0 z-50 flex min-w-0 items-stretch justify-center bg-gray-950/30 p-0 backdrop-blur-[1px] xl:static xl:block xl:bg-transparent xl:p-0 xl:backdrop-blur-none'
            : 'hidden min-w-0 xl:block';
        const domain = getDomain(task.domain);
        const stepSummary = getStepSummary(task);
        const isEditingTitle = editingTitleTaskId === task.id;
        panel.innerHTML = `
            <div class="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl xl:h-auto xl:min-h-[560px] xl:rounded-lg xl:border xl:border-gray-200 xl:p-4 xl:shadow-sm" role="dialog" aria-modal="true" aria-label="${escapeAttr(task.title)} 상세 편집" data-checklist-detail-dialog>
                <div class="flex shrink-0 flex-col items-stretch gap-2 border-b border-gray-100 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-row sm:items-start sm:justify-between xl:border-0 xl:p-0">
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
                        </div>
                        <p class="mt-1 text-[11px] text-gray-400">${escapeHtml(domain.label)} · ${stepSummary.done}/${stepSummary.total} Step · 제목은 더블클릭으로 수정</p>
                    </div>
                    <div class="flex w-full shrink-0 items-center gap-1 sm:w-auto">
                        <select id="checklist-status-filter" class="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-600 outline-none focus:border-indigo-300 sm:max-w-[104px] sm:flex-none" aria-label="할 일 상태 필터">
                            <option value="open" ${activeFilter === 'open' ? 'selected' : ''}>진행 중 ${getSummary().open}</option>
                            <option value="paused" ${activeFilter === 'paused' ? 'selected' : ''}>Monitor ${getSummary().paused}</option>
                            <option value="done" ${activeFilter === 'done' ? 'selected' : ''}>완료 ${getSummary().done}</option>
                            <option value="all" ${activeFilter === 'all' ? 'selected' : ''}>전체 ${getSummary().total}</option>
                        </select>
                        <select id="checklist-detail-domain-edit" class="h-8 min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-600 outline-none focus:border-indigo-300 sm:max-w-[94px] sm:flex-none" aria-label="할 일 영역">
                            ${DOMAINS.map((item) => `<option value="${escapeAttr(item.key)}" ${item.key === task.domain ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
                        </select>
                        <button type="button" data-checklist-pause="${escapeAttr(task.id)}" class="inline-flex h-7 w-7 items-center justify-center rounded-md border ${task.paused ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-gray-200 bg-white text-gray-400 hover:text-amber-600'}" title="${task.paused ? '다시 활성화' : 'Monitor로 보류'}" aria-label="${task.paused ? '다시 활성화' : 'Monitor로 보류'}"><i class="fas ${task.paused ? 'fa-play' : 'fa-pause'} text-xs"></i></button>
                        <button type="button" data-checklist-close-detail class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-400 hover:text-gray-700" title="상세 닫기" aria-label="상세 닫기"><i class="fas fa-xmark text-xs"></i></button>
                    </div>
                </div>

                <div class="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-4 py-4 xl:mt-3 xl:overflow-visible xl:p-0">
                    <div class="block">
                        <span class="text-[11px] font-bold text-gray-500">상세내역</span>
                        ${renderNoteEditor({
                            id: 'checklist-detail-note-edit',
                            value: task.note,
                            minHeightClass: 'min-h-[360px] xl:min-h-[calc(100vh-345px)]',
                            placeholder: '상세내역을 길게 적어둘 수 있습니다.',
                        })}
                    </div>

                    <button type="button" data-checklist-save-detail="${escapeAttr(task.id)}" class="w-full rounded-md bg-gray-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-gray-800">수정 저장</button>
                </div>
            </div>
        `;
    }

    function renderSummary() {
        return getSummary();
    }

    function ensureShell() {
        const root = document.getElementById('routine-checklist-view');
        ensureDragStyles();
        if (!root || document.getElementById('checklist-task-list')) return;
        root.innerHTML = `
            <div class="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(210px,0.75fr)_minmax(430px,1.9fr)_minmax(270px,1fr)]">
                <section class="min-w-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                    <div class="mb-2 flex justify-end"><div id="checklist-add-panel"></div></div>
                    <div id="checklist-task-list" class="space-y-3 max-h-[calc(100vh-215px)] overflow-y-auto pr-1"></div>
                </section>
                <aside id="checklist-detail-panel" class="min-w-0"></aside>
                <aside id="checklist-report-library" class="min-w-0"></aside>
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
            ...(task.completionReport || {}),
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
        toast(result.uploaded ? 'Report 파일을 Library에 업로드했습니다.' : '로그인 후 파일을 업로드할 수 있습니다.', result.uploaded ? 'info' : 'warning');
    }

    async function openReportFile(taskId, index) {
        const task = tasks.find((item) => item.id === taskId);
        const file = task?.reportFiles?.[Number(index)];
        const linkUrl = normalizeReportUrl(file?.url);
        if (linkUrl) {
            window.open(linkUrl, '_blank', 'noopener,noreferrer');
            return;
        }
        const client = getClient();
        if (!file?.path || !client) return;
        const { data, error } = await client.storage.from('todo-reports').createSignedUrl(file.path, 120);
        if (error || !data?.signedUrl) { toast('파일 링크를 열지 못했습니다.', 'error'); return; }
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    }

    async function addReportLink(taskId) {
        const task = tasks.find((item) => item.id === taskId);
        const titleInput = document.getElementById('checklist-report-link-title');
        const urlInput = document.getElementById('checklist-report-external-url');
        if (!task || !urlInput) return;
        const normalizedUrl = normalizeReportUrl(urlInput.value);
        if (normalizedUrl === null) {
            toast('http 또는 https 형식의 링크를 입력해주세요.', 'warning', 2600);
            urlInput.focus();
            return;
        }
        if (!normalizedUrl) {
            toast('추가할 PPT 링크를 입력해주세요.', 'warning');
            urlInput.focus();
            return;
        }
        const now = new Date().toISOString();
        let defaultTitle = 'Report 링크';
        try { defaultTitle = new URL(normalizedUrl).hostname.replace(/^www\./, '') || defaultTitle; } catch (error) { /* normalized above */ }
        const reportName = String(titleInput?.value || '').trim() || defaultTitle;
        task.reportFiles = [...(task.reportFiles || []), {
            kind: 'link',
            name: reportName,
            url: normalizedUrl,
            reportType: getReportAssetType({ name: reportName, url: normalizedUrl }).key,
            createdAt: now,
        }];
        task.updatedAt = now;
        tasks = saveStore(tasks);
        isReportLinkFormOpen = false;
        reportSearch = '';
        renderReportLibrary();
        await persistRemoteTask(task);
        toast('이 할 일의 Report Library에 링크를 추가했습니다.', 'info');
    }

    async function deleteReportLink(taskId, sourceIndex) {
        const task = tasks.find((item) => item.id === taskId);
        if (!task) return;
        if (!window.confirm('이 Report 링크를 Library에서 삭제할까요?')) return;
        if (sourceIndex === 'legacy') {
            task.completionReport = { ...(task.completionReport || {}), externalUrl: '' };
        } else {
            const index = Number(sourceIndex);
            if (!Number.isInteger(index) || !normalizeReportUrl(task.reportFiles?.[index]?.url)) return;
            task.reportFiles = task.reportFiles.filter((item, itemIndex) => itemIndex !== index);
        }
        task.updatedAt = new Date().toISOString();
        tasks = saveStore(tasks);
        renderReportLibrary();
        await persistRemoteTask(task);
        toast('Report 링크를 삭제했습니다.', 'info');
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
        if (stepsEl) task.steps = parseStepEditorSteps(stepsEl.value || '', task.steps);
        if (task.completed && document.getElementById('checklist-report-summary')) {
            task.completionReport = {
                ...(task.completionReport || {}),
                summary: String(document.getElementById('checklist-report-summary')?.value || '').trim(),
                outcome: String(document.getElementById('checklist-report-outcome')?.value || '').trim(),
                followUp: String(document.getElementById('checklist-report-followup')?.value || '').trim(),
                updatedAt: now,
            };
        }
        task.updatedAt = now;
        activeDomain = task.domain;
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
            const noteCommandButton = event.target.closest('[data-checklist-note-command]');
            if (noteCommandButton) {
                applyNoteCommand(noteCommandButton.dataset.noteTarget, noteCommandButton.dataset.checklistNoteCommand);
                return;
            }
            const iconPickerToggle = event.target.closest('[data-checklist-icon-picker-toggle]');
            if (iconPickerToggle) {
                const targetId = iconPickerToggle.dataset.noteTarget;
                const picker = document.querySelector(`[data-checklist-icon-picker-for="${CSS.escape(targetId)}"]`);
                const willOpen = picker?.classList.contains('hidden');
                picker?.classList.toggle('hidden', !willOpen);
                iconPickerToggle.setAttribute('aria-expanded', String(Boolean(willOpen)));
                return;
            }
            const noteIconButton = event.target.closest('[data-checklist-note-icon]');
            if (noteIconButton) {
                insertNoteIcon(noteIconButton.dataset.noteTarget, noteIconButton.dataset.checklistNoteIcon);
                const picker = document.querySelector(`[data-checklist-icon-picker-for="${CSS.escape(noteIconButton.dataset.noteTarget)}"]`);
                picker?.classList.add('hidden');
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
                if (window.matchMedia('(min-width: 1280px)').matches) {
                    activeTaskId = null;
                } else {
                    isDetailPanelOpen = false;
                }
                render({ skipRemoteLoad: true });
                if (activeTaskId) requestAnimationFrame(() => document.getElementById('checklist-report-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                return;
            }
            const closeDetailBackdrop = event.target.matches('#checklist-detail-panel')
                && !event.target.closest('[data-checklist-detail-dialog]');
            if (closeDetailBackdrop) {
                editingTitleTaskId = null;
                if (window.matchMedia('(min-width: 1280px)').matches) activeTaskId = null;
                else isDetailPanelOpen = false;
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
            if (event.target.closest('[data-checklist-report-link-focus]')) {
                isReportLinkFormOpen = true;
                renderReportLibrary();
                requestAnimationFrame(() => document.getElementById('checklist-report-link-title')?.focus());
                return;
            }
            if (event.target.closest('[data-checklist-report-link-cancel]')) {
                isReportLinkFormOpen = false;
                renderReportLibrary();
                return;
            }
            const reportLinkSaveBtn = event.target.closest('[data-checklist-report-link-save]');
            if (reportLinkSaveBtn) {
                addReportLink(reportLinkSaveBtn.dataset.checklistReportLinkSave);
                return;
            }
            const reportLinkDeleteBtn = event.target.closest('[data-checklist-report-link-delete]');
            if (reportLinkDeleteBtn) {
                deleteReportLink(reportLinkDeleteBtn.dataset.checklistReportLinkDelete, reportLinkDeleteBtn.dataset.reportIndex);
                return;
            }
            const row = event.target.closest('[data-checklist-open]');
            if (row && !event.target.closest('input, button, textarea, select, a')) {
                if (activeTaskId !== row.dataset.checklistOpen) {
                    isReportLinkFormOpen = false;
                    reportSearch = '';
                }
                activeTaskId = row.dataset.checklistOpen;
                isDetailPanelOpen = true;
                activeDomain = tasks.find((task) => task.id === activeTaskId)?.domain || activeDomain;
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
            const noteCheckbox = event.target.closest('[data-note-preview-checkbox]');
            if (noteCheckbox) {
                toggleNotePreviewCheckbox(noteCheckbox.dataset.noteTarget, Number(noteCheckbox.dataset.noteLine), noteCheckbox.checked);
                return;
            }
            if (event.target.matches('#checklist-status-filter')) {
                activeFilter = event.target.value || 'open';
                render({ skipRemoteLoad: true });
                return;
            }
            if (event.target.matches('#checklist-report-sort')) {
                reportSort = event.target.value || 'recent';
                renderReportLibrary();
                return;
            }
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
            if (event.target.matches('#checklist-report-search')) {
                reportSearch = event.target.value;
                renderReportLibrary();
                requestAnimationFrame(() => {
                    const search = document.getElementById('checklist-report-search');
                    search?.focus();
                    search?.setSelectionRange(reportSearch.length, reportSearch.length);
                });
                return;
            }
            const noteEditor = event.target.closest('[data-checklist-note-editor]');
            if (noteEditor) updateNotePreview(noteEditor.id);
            const groupInput = event.target.closest('[data-step-editor-group]');
            if (groupInput) updateStepMetadata(groupInput.closest('[data-step-editor]'), groupInput.dataset.stepEditorGroup, 'groupName', groupInput.value);
            const detailInput = event.target.closest('[data-step-editor-detail]');
            if (detailInput) updateStepMetadata(detailInput.closest('[data-step-editor]'), detailInput.dataset.stepEditorDetail, 'detail', detailInput.value);
        });
        root?.addEventListener('keydown', (event) => {
            const noteEditor = event.target?.closest?.('[data-checklist-note-editor]');
            if (noteEditor && event.key === 'Tab') {
                event.preventDefault();
                applyNoteIndentation(noteEditor, event.shiftKey);
                return;
            }
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
            if (event.key === 'Enter' && event.target?.closest?.('#checklist-report-external-url')) {
                event.preventDefault();
                addReportLink(activeTaskId);
                return;
            }
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
