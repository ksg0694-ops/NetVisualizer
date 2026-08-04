(function (window) {
    const STORAGE_KEY = 'netvisualizer.learning.archive.v1';
    const TABLE_NAME = 'learning_archive_notes';
    let entries = [];
    let activeId = null;
    let searchText = '';
    let bound = false;
    let loaded = false;

    const escapeHtml = (value) => window.AppUtils.escapeHtml(value);
    const escapeAttr = (value) => window.AppUtils.escapeAttr(value);
    const createId = () => (window.crypto?.randomUUID?.() || `learning-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const now = () => new Date().toISOString();

    function normalize(raw = {}) {
        const field = String(raw.field || raw.fieldName || raw.field_name || '').trim();
        const item = String(raw.item || raw.itemName || raw.item_name || '').trim();
        const chapter = String(raw.chapter || raw.chapterName || raw.chapter_name || '').trim();
        const title = String(raw.title || '').trim();
        if (!field || !item || !chapter || !title) return null;
        return {
            id: String(raw.id || createId()), field, item, chapter, title,
            content: String(raw.content || ''),
            sourceLinks: Array.isArray(raw.sourceLinks || raw.source_links) ? (raw.sourceLinks || raw.source_links).map(String) : [],
            tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
            pinned: Boolean(raw.pinned ?? raw.is_pinned),
            createdAt: raw.createdAt || raw.created_at || now(),
            updatedAt: raw.updatedAt || raw.updated_at || now(),
        };
    }

    function readStore() {
        try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []).map(normalize).filter(Boolean); }
        catch (error) { console.warn('Learning archive storage parse failed.', error); return []; }
    }

    function saveStore() {
        entries.sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function getClient() {
        try { return typeof getAuthenticatedSupabaseClient === 'function' ? getAuthenticatedSupabaseClient() : null; }
        catch (_error) { return null; }
    }

    function toRow(entry) {
        const row = {
            id: entry.id, field_name: entry.field, item_name: entry.item, chapter_name: entry.chapter,
            title: entry.title, content: entry.content || null, source_links: entry.sourceLinks,
            tags: entry.tags, is_pinned: entry.pinned, created_at: entry.createdAt, updated_at: entry.updatedAt,
        };
        const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
        if (userId) row.user_id = userId;
        return row;
    }

    async function persist(entry) {
        const client = getClient(); if (!client) return;
        const { error } = await client.from(TABLE_NAME).upsert(toRow(entry), { onConflict: 'id' });
        if (error && !['42P01', 'PGRST204', 'PGRST205'].includes(String(error.code || ''))) console.warn('Learning archive sync failed.', error);
    }

    async function removeRemote(id) {
        const client = getClient(); if (!client) return;
        const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
        if (error && !['42P01', 'PGRST204', 'PGRST205'].includes(String(error.code || ''))) console.warn('Learning archive delete failed.', error);
    }

    async function loadRemote() {
        if (loaded) return;
        loaded = true;
        const client = getClient(); if (!client) return;
        const { data, error } = await client.from(TABLE_NAME).select('id,field_name,item_name,chapter_name,title,content,source_links,tags,is_pinned,created_at,updated_at').order('updated_at', { ascending: false });
        if (error) return;
        const remote = (data || []).map(normalize).filter(Boolean);
        if (remote.length || entries.length === 0) { entries = remote; saveStore(); render({ skipRemote: true }); }
    }

    function unique(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')); }

    function current() { return entries.find((entry) => entry.id === activeId) || null; }

    function filtered() {
        const query = searchText.trim().toLowerCase();
        if (!query) return entries;
        return entries.filter((entry) => [entry.field, entry.item, entry.chapter, entry.title, entry.content, ...entry.tags].join(' ').toLowerCase().includes(query));
    }

    function datalist(id, values) {
        return `<datalist id="${id}">${unique(values).map((value) => `<option value="${escapeAttr(value)}"></option>`).join('')}</datalist>`;
    }

    function renderTree(source) {
        const fields = unique(source.map((entry) => entry.field));
        if (!fields.length) return '<div class="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-xs text-gray-400">첫 학습 노트를 만들어보세요.</div>';
        return fields.map((field) => {
            const fieldEntries = source.filter((entry) => entry.field === field);
            const items = unique(fieldEntries.map((entry) => entry.item));
            return `<section class="space-y-1.5">
                <div class="flex items-center justify-between px-1"><h3 class="text-xs font-black text-gray-800"><i class="fas fa-layer-group mr-1.5 text-indigo-500"></i>${escapeHtml(field)}</h3><span class="text-[10px] text-gray-400">${fieldEntries.length}</span></div>
                ${items.map((item) => {
                    const itemEntries = fieldEntries.filter((entry) => entry.item === item);
                    return `<details open class="group rounded-xl border border-gray-200 bg-white">
                        <summary class="cursor-pointer list-none px-3 py-2 text-xs font-bold text-gray-700"><i class="fas fa-chevron-right mr-2 text-[9px] text-gray-300 transition group-open:rotate-90"></i>${escapeHtml(item)}</summary>
                        <div class="border-t border-gray-100 p-1.5">${itemEntries.map((entry) => `<button type="button" data-learning-open="${escapeAttr(entry.id)}" class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${activeId === entry.id ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}"><i class="far fa-file-lines text-[10px]"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(entry.chapter)} · ${escapeHtml(entry.title)}</span>${entry.pinned ? '<i class="fas fa-thumbtack text-[9px] text-indigo-400"></i>' : ''}</button>`).join('')}</div>
                    </details>`;
                }).join('')}
            </section>`;
        }).join('');
    }

    function renderEditor(entry) {
        if (!entry) return `<div class="flex min-h-[500px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white text-center"><span class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><i class="fas fa-book-open-reader"></i></span><h3 class="mt-3 text-sm font-bold text-gray-700">학습 노트를 선택하세요</h3><p class="mt-1 text-xs text-gray-400">분야 → 항목 → Chapter 순서로 지식을 쌓습니다.</p></div>`;
        return `<section class="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3"><span class="text-[10px] font-bold tracking-wider text-indigo-500">LEARNING NOTE</span><div class="flex gap-1"><button type="button" data-learning-pin class="h-8 w-8 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600" title="고정"><i class="fas fa-thumbtack"></i></button><button type="button" data-learning-delete class="h-8 w-8 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="삭제"><i class="fas fa-trash-can"></i></button></div></div>
            <div class="space-y-4 p-4 md:p-5">
                <div class="grid gap-2 md:grid-cols-3">
                    <label class="text-[10px] font-bold text-gray-500">공부 분야<input id="learning-field" list="learning-fields" value="${escapeAttr(entry.field)}" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:border-indigo-400"></label>
                    <label class="text-[10px] font-bold text-gray-500">공부 항목<input id="learning-item" list="learning-items" value="${escapeAttr(entry.item)}" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:border-indigo-400"></label>
                    <label class="text-[10px] font-bold text-gray-500">Chapter<input id="learning-chapter" list="learning-chapters" value="${escapeAttr(entry.chapter)}" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 outline-none focus:border-indigo-400"></label>
                </div>
                ${datalist('learning-fields', entries.map((item) => item.field))}${datalist('learning-items', entries.map((item) => item.item))}${datalist('learning-chapters', entries.map((item) => item.chapter))}
                <input id="learning-title" value="${escapeAttr(entry.title)}" class="w-full border-0 border-b border-gray-100 px-0 pb-3 text-xl font-black text-gray-900 outline-none focus:border-indigo-300 focus:ring-0" placeholder="노트 제목">
                <div class="flex items-center gap-1"><button type="button" data-learning-format="bold" class="h-8 w-8 rounded-md border border-gray-200 text-xs font-black">B</button><button type="button" data-learning-format="underline" class="h-8 w-8 rounded-md border border-gray-200 text-xs font-bold underline">U</button><button type="button" data-learning-format="strike" class="h-8 w-8 rounded-md border border-gray-200 text-xs font-bold line-through">S</button><span class="ml-auto text-[10px] text-gray-400">최근 수정 ${new Date(entry.updatedAt).toLocaleString('ko-KR')}</span></div>
                <textarea id="learning-content" class="min-h-[280px] w-full resize-y rounded-xl border border-gray-200 p-4 text-sm leading-7 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="개념, 핵심 요약, 질문, 다음 학습 내용을 적어보세요.">${escapeHtml(entry.content)}</textarea>
                <div class="grid gap-3 md:grid-cols-2"><label class="text-[10px] font-bold text-gray-500">태그<input id="learning-tags" value="${escapeAttr(entry.tags.join(', '))}" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="반도체, 투자"></label><label class="text-[10px] font-bold text-gray-500">참고 링크<input id="learning-links" value="${escapeAttr(entry.sourceLinks.join(', '))}" class="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none" placeholder="https://..."></label></div>
                <button type="button" data-learning-save class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700"><i class="fas fa-check mr-2"></i>학습 노트 저장</button>
            </div>
        </section>`;
    }

    function render(options = {}) {
        const root = document.getElementById('learning-archive-view'); if (!root) return;
        const source = filtered(); const selected = current();
        root.innerHTML = `<div class="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p class="text-[10px] font-bold tracking-wider text-indigo-500">LIFE TOOL</p><h2 class="mt-1 text-xl font-black text-gray-900 md:text-2xl">학습 아카이브</h2></div><div class="flex gap-2"><label class="relative min-w-0 flex-1 md:w-72"><i class="fas fa-magnifying-glass absolute left-3 top-3 text-xs text-gray-300"></i><input id="learning-search" value="${escapeAttr(searchText)}" class="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400" placeholder="노트 검색"></label><button type="button" data-learning-new class="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm"><i class="fas fa-plus mr-1.5"></i>새 노트</button></div></div>
            <div class="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]"><aside class="max-h-[calc(100dvh-190px)] space-y-4 overflow-y-auto pr-1 scrollbar-hide">${renderTree(source)}</aside><div class="${selected ? 'block' : 'hidden lg:block'}">${renderEditor(selected)}</div></div>`;
        if (!options.skipRemote) loadRemote();
    }

    function splitList(value) { return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20); }

    async function saveActive() {
        const entry = current(); if (!entry) return;
        const field = String(document.getElementById('learning-field')?.value || '').trim();
        const item = String(document.getElementById('learning-item')?.value || '').trim();
        const chapter = String(document.getElementById('learning-chapter')?.value || '').trim();
        const title = String(document.getElementById('learning-title')?.value || '').trim();
        if (!field || !item || !chapter || !title) { window.showToast?.('분야, 항목, Chapter, 제목을 입력해 주세요.', 'warning'); return; }
        Object.assign(entry, { field, item, chapter, title, content: String(document.getElementById('learning-content')?.value || ''), tags: splitList(document.getElementById('learning-tags')?.value), sourceLinks: splitList(document.getElementById('learning-links')?.value), updatedAt: now() });
        saveStore(); render({ skipRemote: true }); await persist(entry); window.showToast?.('학습 노트를 저장했습니다.', 'info');
    }

    function wrapSelection(kind) {
        const textarea = document.getElementById('learning-content'); if (!textarea) return;
        const token = kind === 'bold' ? '**' : kind === 'underline' ? '++' : '~~';
        textarea.setRangeText(`${token}${textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || '텍스트'}${token}`, textarea.selectionStart, textarea.selectionEnd, 'select'); textarea.focus();
    }

    function bindControls() {
        if (bound) return; bound = true;
        const root = document.getElementById('learning-archive-view');
        root?.addEventListener('input', (event) => { if (event.target.id === 'learning-search') { searchText = event.target.value; render({ skipRemote: true }); document.getElementById('learning-search')?.focus(); } });
        root?.addEventListener('click', async (event) => {
            const open = event.target.closest('[data-learning-open]'); if (open) { activeId = open.dataset.learningOpen; render({ skipRemote: true }); return; }
            if (event.target.closest('[data-learning-new]')) {
                const entry = normalize({ field: '새 분야', item: '새 항목', chapter: 'Chapter 1', title: '새 학습 노트' }); entries.unshift(entry); activeId = entry.id; saveStore(); render({ skipRemote: true }); document.getElementById('learning-title')?.select(); await persist(entry); return;
            }
            const entry = current(); if (!entry) return;
            if (event.target.closest('[data-learning-save]')) { await saveActive(); return; }
            if (event.target.closest('[data-learning-pin]')) { entry.pinned = !entry.pinned; entry.updatedAt = now(); saveStore(); render({ skipRemote: true }); await persist(entry); return; }
            if (event.target.closest('[data-learning-delete]')) { entries = entries.filter((item) => item.id !== entry.id); activeId = null; saveStore(); render({ skipRemote: true }); await removeRemote(entry.id); return; }
            const format = event.target.closest('[data-learning-format]'); if (format) wrapSelection(format.dataset.learningFormat);
        });
    }

    entries = readStore();
    window.LearningArchiveFeature = { render, bindControls, refresh: () => { loaded = false; return loadRemote(); } };
})(window);
