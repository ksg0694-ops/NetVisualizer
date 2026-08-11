(function (root) {
    const MIN_FONT_SIZE = 10;
    const MAX_FONT_SIZE = 32;
    const DEFAULT_FONT_SIZE = 14;
    const savedSelections = new WeakMap();

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

    function updateToolbarFromSelection(toolbar, surface) {
        const input = toolbar?.querySelector('[data-note-font-input]');
        if (input) input.value = String(getSelectionFontSize(surface));
    }

    root.NoteEditor = Object.freeze({
        MIN_FONT_SIZE,
        MAX_FONT_SIZE,
        DEFAULT_FONT_SIZE,
        applyFontSize,
        clampFontSize,
        getSelectionFontSize,
        rememberSelection,
        renderFontSizeMarkup,
        renderFontSizeToolbar,
        serializeFontSize,
        updateToolbarFromSelection,
    });
}(window));
