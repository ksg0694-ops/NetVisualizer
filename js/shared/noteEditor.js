(function (root) {
    const MIN_FONT_SIZE = 10;
    const MAX_FONT_SIZE = 32;
    const DEFAULT_FONT_SIZE = 14;
    const savedSelections = new WeakMap();
    const BLOCK_STYLES = Object.freeze({
        body: { label: '본문', prefix: '', className: 'text-[14px] font-normal text-gray-700' },
        title: { label: '제목', prefix: '# ', className: 'text-xl font-black leading-tight text-gray-900' },
        heading: { label: '소제목', prefix: '## ', className: 'text-base font-black leading-snug text-gray-900' },
        quote: { label: '인용', prefix: '> ', className: 'border-l-2 border-indigo-200 pl-3 italic text-gray-500' },
    });

    function clampFontSize(value) {
        const parsed = Math.round(Number(value));
        if (!Number.isFinite(parsed)) return DEFAULT_FONT_SIZE;
        return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed));
    }

    function selectionBelongsTo(surface, selection = root.getSelection?.()) {
        return Boolean(surface && selection?.rangeCount
            && surface.contains(selection.anchorNode)
            && surface.contains(selection.focusNode));
    }

    function rememberSelection(surface) {
        const selection = root.getSelection?.();
        if (!selectionBelongsTo(surface, selection)) return false;
        savedSelections.set(surface, selection.getRangeAt(0).cloneRange());
        return true;
    }

    function restoreSelection(surface) {
        const selection = root.getSelection?.();
        if (selectionBelongsTo(surface, selection)) return selection;
        const range = savedSelections.get(surface);
        if (!range) return null;
        try {
            surface.focus({ preventScroll: true });
            selection?.removeAllRanges();
            selection?.addRange(range);
            return selection;
        } catch (_error) {
            savedSelections.delete(surface);
            return null;
        }
    }

    function replaceLegacyFontNodes(surface, size) {
        surface.querySelectorAll('font[size="7"]').forEach((font) => {
            const span = document.createElement('span');
            span.dataset.noteFontSize = String(size);
            span.style.fontSize = `${size}px`;
            while (font.firstChild) span.appendChild(font.firstChild);
            font.replaceWith(span);
            let parent = span.parentElement?.closest?.('[data-note-font-size]');
            while (parent && parent.childNodes.length === 1 && parent.firstChild === span) {
                const nextParent = parent.parentElement?.closest?.('[data-note-font-size]');
                parent.replaceWith(span);
                parent = nextParent;
            }
        });
    }

    function applyFontSize(surface, value) {
        const size = clampFontSize(value);
        const selection = restoreSelection(surface);
        if (!selection || selection.isCollapsed || !selectionBelongsTo(surface, selection)) {
            return { ok: false, reason: 'selection-required', size };
        }
        surface.focus({ preventScroll: true });
        document.execCommand('fontSize', false, '7');
        replaceLegacyFontNodes(surface, size);
        savedSelections.delete(surface);
        return { ok: true, size };
    }

    function applyHistory(surface, direction) {
        const command = direction === 'redo' ? 'redo' : 'undo';
        if (!surface) return false;
        surface.focus({ preventScroll: true });
        return document.execCommand(command, false);
    }

    function getSelectionFontSize(surface) {
        const selection = root.getSelection?.();
        if (!selectionBelongsTo(surface, selection)) return DEFAULT_FONT_SIZE;
        const node = selection.anchorNode?.nodeType === Node.TEXT_NODE
            ? selection.anchorNode.parentElement
            : selection.anchorNode;
        const sized = node?.closest?.('[data-note-font-size]');
        if (sized && surface.contains(sized)) return clampFontSize(sized.dataset.noteFontSize);
        const computed = node instanceof Element ? Number.parseFloat(getComputedStyle(node).fontSize) : DEFAULT_FONT_SIZE;
        return clampFontSize(computed);
    }

    function renderFontSizeMarkup(value) {
        let rendered = String(value || '');
        const pattern = /\{\{size:(1[0-9]|2[0-9]|3[0-2])\|([^{}\n]*)\}\}/g;
        for (let depth = 0; depth < 20 && pattern.test(rendered); depth += 1) {
            pattern.lastIndex = 0;
            rendered = rendered.replace(pattern, '<span data-note-font-size="$1" style="font-size:$1px">$2</span>');
        }
        return rendered;
    }

    function parseBlockStyle(value) {
        const source = String(value || '');
        const style = Object.entries(BLOCK_STYLES)
            .filter(([, meta]) => meta.prefix)
            .sort((a, b) => b[1].prefix.length - a[1].prefix.length)
            .find(([, meta]) => source.startsWith(meta.prefix));
        return style
            ? { style: style[0], prefix: style[1].prefix, content: source.slice(style[1].prefix.length) }
            : { style: 'body', prefix: '', content: source };
    }

    function getBlockStyleClass(style) {
        return BLOCK_STYLES[style]?.className || BLOCK_STYLES.body.className;
    }

    function serializeBlockStyle(style, content) {
        return `${BLOCK_STYLES[style]?.prefix || ''}${content}`;
    }

    function serializeFontSize(node, content) {
        const size = node?.dataset?.noteFontSize;
        return /^(1[0-9]|2[0-9]|3[0-2])$/.test(String(size || ''))
            ? `{{size:${size}|${content}}}`
            : null;
    }

    function renderFontSizeToolbar(prefix) {
        return `<span class="mx-1 h-5 w-px bg-gray-200"></span>
            <div data-note-font-toolbar="${prefix}" class="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white shadow-sm">
                <button type="button" data-note-font-step="-1" class="h-full w-8 text-sm font-bold text-gray-500 hover:bg-gray-50" title="선택 글자 작게" aria-label="선택 글자 크기 줄이기">−</button>
                <input type="number" min="${MIN_FONT_SIZE}" max="${MAX_FONT_SIZE}" value="${DEFAULT_FONT_SIZE}" data-note-font-input class="h-full w-12 border-x border-gray-200 bg-white px-1 text-center text-[11px] font-bold text-gray-700 outline-none" aria-label="선택 글자 크기">
                <span class="pr-1.5 text-[9px] font-bold text-gray-400">px</span>
                <button type="button" data-note-font-step="1" class="h-full w-8 border-l border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50" title="선택 글자 크게" aria-label="선택 글자 크기 늘리기">＋</button>
            </div>`;
    }

    function renderHistoryToolbar(prefix) {
        return `<div data-note-history-toolbar="${prefix}" class="mr-1 inline-flex h-8 items-center rounded-md border border-gray-200 bg-white shadow-sm">
                <button type="button" data-note-history="undo" class="h-full w-8 text-gray-500 hover:bg-gray-50 hover:text-indigo-600" title="실행 취소 (Ctrl+Z)" aria-label="실행 취소"><i class="fas fa-rotate-left text-[10px]"></i></button>
                <button type="button" data-note-history="redo" class="h-full w-8 border-l border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600" title="다시 실행 (Ctrl+Y)" aria-label="다시 실행"><i class="fas fa-rotate-right text-[10px]"></i></button>
            </div>`;
    }

    function renderBlockStyleToolbar(prefix) {
        return `<div data-note-block-toolbar="${prefix}" class="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white shadow-sm">
                <select data-note-block-style class="h-full min-w-[76px] rounded-l-md bg-white px-2 text-[10px] font-bold text-gray-600 outline-none" aria-label="문단 스타일">${Object.entries(BLOCK_STYLES).map(([key, meta]) => `<option value="${key}">${meta.label}</option>`).join('')}</select>
                <button type="button" data-note-clear-format class="h-full w-8 border-l border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600" title="선택 서식 지우기" aria-label="선택 서식 지우기"><i class="fas fa-eraser text-[10px]"></i></button>
            </div>`;
    }

    function renderExportToolbar(prefix) {
        return `<select data-note-export="${prefix}" class="h-8 rounded-md border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-600 outline-none hover:border-indigo-200" aria-label="노트 내보내기"><option value="">내보내기</option><option value="markdown">Markdown</option><option value="word">Word</option><option value="pdf">PDF 인쇄</option></select>`;
    }

    function clearFormatting(surface) {
        const selection = restoreSelection(surface);
        if (!selection || selection.isCollapsed || !selectionBelongsTo(surface, selection)) return false;
        surface.focus({ preventScroll: true });
        document.execCommand('removeFormat', false);
        savedSelections.delete(surface);
        return true;
    }

    function getTemplate(scope, key) {
        const templates = scope === 'todo' ? {
            blank: '',
            plan: '## 목표\n\n## 완료 기준\n\n## 진행 메모',
            decision: '## 결정할 내용\n\n## 선택지\n\n## 판단 기준\n\n## 결정과 이유',
            meeting: '## 핵심 내용\n\n## 결정 사항\n\n## 다음 행동',
        } : {
            blank: '',
            study: '# 핵심 주제\n\n## 개념 정리\n\n## 내 말로 설명\n\n## 질문\n\n## 복습',
            lecture: '# 강의 주제\n\n## 핵심 내용\n\n## 예시\n\n## 이해가 안 된 부분\n\n## 다음 복습',
            book: '# 책과 범위\n\n## 핵심 주장\n\n## 기억할 문장\n\n## 내 생각\n\n## 적용할 점',
        };
        return templates[key] ?? templates.blank;
    }

    function sanitizeFilename(value) {
        return String(value || 'note').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'note';
    }

    function escapePlainHtml(value) {
        return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }

    function sanitizeExportHtml(html) {
        const template = document.createElement('template');
        template.innerHTML = String(html || '');
        template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach((node) => node.remove());
        template.content.querySelectorAll('*').forEach((node) => {
            [...node.attributes].forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim().toLowerCase();
                if (name.startsWith('on') || name === 'contenteditable' || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) {
                    node.removeAttribute(attribute.name);
                }
            });
        });
        return template.innerHTML;
    }

    function downloadBlob(filename, content, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportMarkdown(title, content, metadata = '') {
        const filename = `${sanitizeFilename(title)}.md`;
        const body = `# ${String(title || '노트').trim()}\n${metadata ? `\n${metadata.trim()}\n` : ''}\n${String(content || '')}\n`;
        downloadBlob(filename, body, 'text/markdown;charset=utf-8');
        return filename;
    }

    function exportWord(title, html, metadata = '') {
        const safeTitle = escapePlainHtml(title || '노트');
        const documentHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:Arial,'Malgun Gothic',sans-serif;max-width:760px;margin:40px auto;line-height:1.5;color:#1f2937}h1{font-size:26px}p.meta{font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:12px}.note-line{min-height:20px}</style></head><body><h1>${safeTitle}</h1>${metadata ? `<p class="meta">${escapePlainHtml(metadata)}</p>` : ''}<div>${sanitizeExportHtml(html)}</div></body></html>`;
        const filename = `${sanitizeFilename(title)}.doc`;
        downloadBlob(filename, `\ufeff${documentHtml}`, 'application/msword;charset=utf-8');
        return filename;
    }

    function printNote(title, html, metadata = '') {
        const printWindow = window.open('', '_blank', 'noopener,noreferrer');
        if (!printWindow) return false;
        const safeTitle = escapePlainHtml(title || '노트');
        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:Arial,'Malgun Gothic',sans-serif;max-width:760px;margin:40px auto;line-height:1.5;color:#111827}h1{font-size:26px}p.meta{font-size:11px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:12px}@media print{body{margin:16mm}}</style></head><body><h1>${safeTitle}</h1>${metadata ? `<p class="meta">${escapePlainHtml(metadata)}</p>` : ''}<div>${sanitizeExportHtml(html)}</div><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script></body></html>`);
        printWindow.document.close();
        return true;
    }

    function renderLineDiff(previous, current) {
        const before = String(previous || '').split('\n').slice(0, 180);
        const after = String(current || '').split('\n').slice(0, 180);
        const matrix = Array.from({ length: before.length + 1 }, () => Array(after.length + 1).fill(0));
        for (let i = before.length - 1; i >= 0; i -= 1) {
            for (let j = after.length - 1; j >= 0; j -= 1) {
                matrix[i][j] = before[i] === after[j] ? matrix[i + 1][j + 1] + 1 : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
            }
        }
        const rows = [];
        const escape = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
        let i = 0;
        let j = 0;
        while (i < before.length || j < after.length) {
            if (i < before.length && j < after.length && before[i] === after[j]) {
                rows.push(`<div class="px-2 py-0.5 text-gray-400">&nbsp; ${escape(before[i]) || '&nbsp;'}</div>`); i += 1; j += 1;
            } else if (j < after.length && (i >= before.length || matrix[i][j + 1] >= matrix[i + 1][j])) {
                rows.push(`<div class="bg-emerald-50 px-2 py-0.5 text-emerald-700">+ ${escape(after[j]) || '&nbsp;'}</div>`); j += 1;
            } else {
                rows.push(`<div class="bg-rose-50 px-2 py-0.5 text-rose-700">− ${escape(before[i]) || '&nbsp;'}</div>`); i += 1;
            }
        }
        return rows.join('');
    }

    function updateToolbarFromSelection(toolbar, surface) {
        const input = toolbar?.querySelector('[data-note-font-input]');
        if (input) input.value = String(getSelectionFontSize(surface));
    }

    root.NoteEditor = Object.freeze({
        MIN_FONT_SIZE,
        MAX_FONT_SIZE,
        DEFAULT_FONT_SIZE,
        BLOCK_STYLES,
        applyFontSize,
        applyHistory,
        clearFormatting,
        clampFontSize,
        getSelectionFontSize,
        getBlockStyleClass,
        getTemplate,
        exportMarkdown,
        exportWord,
        parseBlockStyle,
        printNote,
        rememberSelection,
        renderFontSizeMarkup,
        renderFontSizeToolbar,
        renderBlockStyleToolbar,
        renderExportToolbar,
        renderHistoryToolbar,
        renderLineDiff,
        restoreSelection,
        serializeBlockStyle,
        serializeFontSize,
        updateToolbarFromSelection,
    });
}(window));
