(function (window) {
    const STORAGE_KEY = 'netvisualizer.life.notes.v1';
    const TABLE_NAME = 'life_notes';
    const COLORS = ['violet', 'sky', 'amber', 'slate'];
    const COLOR_CLASS = {
        violet: 'border-violet-200 bg-violet-50/80',
        sky: 'border-sky-200 bg-sky-50/80',
        amber: 'border-amber-200 bg-amber-50/80',
        slate: 'border-slate-200 bg-slate-50/90',
    };
    let notes = [];
    let activeTab = 'memo';
    let activeId = null;
    let bound = false;
    let loaded = false;

    function getRoot() {
        return document.getElementById('checklist-life-notes-panel') || document.getElementById('life-notes-view');
    }

    const escapeHtml = (value) => window.AppUtils.escapeHtml(value);
    const escapeAttr = (value) => window.AppUtils.escapeAttr(value);
    const createId = () => (window.crypto?.randomUUID?.() || `life-note-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const now = () => new Date().toISOString();

    function normalize(raw = {}) {
        const title = String(raw.title || '').trim();
        if (!title) return null;
        const noteType = raw.noteType === 'check' || raw.note_type === 'check' ? 'check' : 'memo';
        const statusRaw = String(raw.status || 'active');
        return {
            id: String(raw.id || createId()),
            title,
            content: String(raw.content || ''),
            noteType,
            status: ['active', 'paused', 'archived'].includes(statusRaw) ? statusRaw : 'active',
            checklist: Array.isArray(raw.checklist) ? raw.checklist.map((item) => ({
                id: String(item.id || createId()), title: String(item.title || '').trim(), done: Boolean(item.done),
            })).filter((item) => item.title) : [],
            color: COLORS.includes(raw.color) ? raw.color : COLORS[Math.abs(title.length) % COLORS.length],
            pinned: Boolean(raw.pinned ?? raw.is_pinned),
            displayOrder: Number(raw.displayOrder ?? raw.display_order) || Date.now(),
            createdAt: raw.createdAt || raw.created_at || now(),
            updatedAt: raw.updatedAt || raw.updated_at || now(),
        };
    }

    function readStore() {
        try {
            return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []).map(normalize).filter(Boolean);
        } catch (error) {
            console.warn('Life note storage parse failed.', error);
            return [];
        }
    }

    function saveStore() {
        notes.sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }

    function getClient() {
        try { return typeof getAuthenticatedSupabaseClient === 'function' ? getAuthenticatedSupabaseClient() : null; }
        catch (_error) { return null; }
    }

    function toRow(note) {
        const row = {
            id: note.id, title: note.title, content: note.content || null, note_type: note.noteType,
            status: note.status, checklist: note.checklist, color: note.color, is_pinned: note.pinned,
            display_order: note.displayOrder, created_at: note.createdAt, updated_at: note.updatedAt,
        };
        const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
        if (userId) row.user_id = userId;
        return row;
    }

    async function persist(note) {
        const client = getClient();
        if (!client) return;
        const { error } = await client.from(TABLE_NAME).upsert(toRow(note), { onConflict: 'id' });
        if (error && !['42P01', 'PGRST204', 'PGRST205'].includes(String(error.code || ''))) console.warn('Life note sync failed.', error);
    }

    async function removeRemote(id) {
        const client = getClient();
        if (!client) return;
        const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
        if (error && !['42P01', 'PGRST204', 'PGRST205'].includes(String(error.code || ''))) console.warn('Life note delete failed.', error);
    }

    async function loadRemote() {
        if (loaded) return;
        loaded = true;
        const client = getClient();
        if (!client) return;
        const { data, error } = await client.from(TABLE_NAME).select('id,title,content,note_type,status,checklist,color,is_pinned,display_order,created_at,updated_at').order('updated_at', { ascending: false });
        if (error) return;
        const remote = (data || []).map(normalize).filter(Boolean);
        if (remote.length || notes.length === 0) {
            notes = remote;
            saveStore();
            render({ skipRemote: true });
        }
    }

    function filteredNotes() {
        if (activeTab === 'paused') return notes.filter((note) => note.status === 'paused');
        return notes.filter((note) => note.status === 'active' && note.noteType === activeTab);
    }

    function renderCard(note) {
        const preview = note.noteType === 'check'
            ? note.checklist.slice(0, 3).map((item) => `<span class="block truncate ${item.done ? 'line-through text-gray-400' : ''}"><i class="far ${item.done ? 'fa-square-check' : 'fa-square'} mr-1.5"></i>${escapeHtml(item.title)}</span>`).join('')
            : `<p class="line-clamp-3 whitespace-pre-line">${escapeHtml(note.content || '내용을 입력하세요.')}</p>`;
        return `
            <button type="button" data-life-note-open="${escapeAttr(note.id)}" class="min-h-[118px] w-full rounded-xl border p-3 text-left transition ${COLOR_CLASS[note.color]} ${note.status === 'paused' ? 'opacity-45 grayscale-[20%]' : 'hover:-translate-y-0.5 hover:shadow-sm'} ${activeId === note.id ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}">
                <span class="flex items-start justify-between gap-2">
                    <strong class="min-w-0 truncate text-sm text-gray-900">${escapeHtml(note.title)}</strong>
                    <i class="fas ${note.pinned ? 'fa-thumbtack text-indigo-500' : note.status === 'paused' ? 'fa-pause text-gray-400' : 'fa-chevron-right text-gray-300'} mt-0.5 text-[10px]"></i>
                </span>
                <span class="mt-2 block text-xs leading-5 text-gray-600">${preview}</span>
                <span class="mt-2 block text-[10px] font-medium text-gray-400">${new Date(note.updatedAt).toLocaleDateString('ko-KR')}</span>
            </button>`;
    }

    function renderEditor(note) {
        if (!note) {
            return `<div class="flex min-h-[430px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 text-center">
                <span class="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-500"><i class="fas fa-note-sticky"></i></span>
                <p class="mt-3 text-sm font-bold text-gray-700">생활 메모를 선택하세요</p>
                <p class="mt-1 text-xs text-gray-400">PC에서는 오른쪽에서 바로 편집할 수 있습니다.</p>
            </div>`;
        }
        const checklist = note.checklist.map((item) => `
            <label class="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                <input type="checkbox" data-life-note-check="${escapeAttr(item.id)}" ${item.done ? 'checked' : ''} class="h-4 w-4 rounded accent-violet-600">
                <span class="min-w-0 flex-1 text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}">${escapeHtml(item.title)}</span>
                <button type="button" data-life-note-check-delete="${escapeAttr(item.id)}" class="text-gray-300 hover:text-rose-500"><i class="fas fa-xmark text-xs"></i></button>
            </label>`).join('');
        return `
            <section class="rounded-2xl border border-gray-200 bg-white shadow-sm md:min-h-[620px]">
                <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <span class="text-[10px] font-bold tracking-wider text-violet-500">DETAIL NOTE</span>
                    <div class="flex items-center gap-1">
                        <button type="button" data-life-note-pin class="h-8 w-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-indigo-600" title="고정"><i class="fas fa-thumbtack"></i></button>
                        <button type="button" data-life-note-pause class="h-8 w-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-amber-600" title="${note.status === 'paused' ? '다시 활성화' : '보류'}"><i class="fas ${note.status === 'paused' ? 'fa-play' : 'fa-pause'}"></i></button>
                        <button type="button" data-life-note-delete class="h-8 w-8 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="삭제"><i class="fas fa-trash-can"></i></button>
                    </div>
                </div>
                <div class="space-y-4 p-4 md:p-5">
                    <input id="life-note-title" value="${escapeAttr(note.title)}" class="w-full border-0 p-0 text-xl font-black text-gray-900 outline-none focus:ring-0" placeholder="제목">
                    <div class="flex items-center gap-1 border-y border-gray-100 py-2">
                        <button type="button" data-life-format="bold" class="h-8 w-8 rounded-md border border-gray-200 text-xs font-black hover:border-violet-300">B</button>
                        <button type="button" data-life-format="underline" class="h-8 w-8 rounded-md border border-gray-200 text-xs font-bold underline hover:border-violet-300">U</button>
                        <button type="button" data-life-format="strike" class="h-8 w-8 rounded-md border border-gray-200 text-xs font-bold line-through hover:border-violet-300">S</button>
                        <span class="ml-auto text-[10px] text-gray-400">${new Date(note.updatedAt).toLocaleString('ko-KR')}</span>
                    </div>
                    <textarea id="life-note-content" class="min-h-[190px] w-full resize-y rounded-xl border border-gray-200 p-3 text-sm leading-6 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 md:min-h-[320px]" placeholder="생활 메모를 적어보세요.">${escapeHtml(note.content)}</textarea>
                    <div>
                        <div class="mb-2 flex items-center justify-between"><h3 class="text-xs font-bold text-gray-700">체크 항목</h3><span class="text-[10px] text-gray-400">${note.checklist.filter((item) => item.done).length}/${note.checklist.length}</span></div>
                        <div class="space-y-1">${checklist || '<p class="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-400">체크 항목이 없습니다.</p>'}</div>
                        <div class="mt-2 flex gap-2"><input id="life-note-check-input" class="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400" placeholder="체크 항목 추가"><button type="button" data-life-note-check-add class="h-9 w-9 rounded-lg bg-gray-900 text-white"><i class="fas fa-plus text-xs"></i></button></div>
                    </div>
                    <button type="button" data-life-note-save class="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-700"><i class="fas fa-check mr-2"></i>저장</button>
                </div>
            </section>`;
    }

    function render(options = {}) {
        const root = getRoot();
        if (!root) return;
        const visible = filteredNotes();
        if (activeId && !notes.some((note) => note.id === activeId)) activeId = null;
        const selected = notes.find((note) => note.id === activeId) || null;
        const tab = (key, label, count) => `<button type="button" data-life-tab="${key}" class="border-b-2 px-1 pb-2 text-sm font-bold ${activeTab === key ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-400 hover:text-gray-700'}">${label}<span class="ml-1 text-[10px]">${count}</span></button>`;
        root.innerHTML = `
            <div class="mb-4 flex items-end justify-between gap-3">
                <div><p class="text-[10px] font-bold tracking-wider text-violet-500">LIFE TOOL</p><h2 class="mt-1 text-xl font-black text-gray-900 md:text-2xl">생활 노트</h2></div>
                <button type="button" data-life-new class="rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700"><i class="fas fa-plus mr-1.5"></i>새 메모</button>
            </div>
            <div class="mb-4 flex gap-5 border-b border-gray-200">${tab('memo', '메모', notes.filter((n) => n.status === 'active' && n.noteType === 'memo').length)}${tab('check', '체크', notes.filter((n) => n.status === 'active' && n.noteType === 'check').length)}${tab('paused', '보류', notes.filter((n) => n.status === 'paused').length)}</div>
            <div class="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
                <aside class="space-y-3">
                    <form id="life-quick-form" class="rounded-2xl border border-violet-100 bg-violet-50/60 p-3 shadow-sm">
                        <label for="life-quick-title" class="text-[10px] font-bold tracking-wider text-violet-600">QUICK CAPTURE</label>
                        <input id="life-quick-title" class="mt-2 w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400" placeholder="빠르게 메모하기">
                        <div class="mt-2 flex items-center justify-between"><span class="text-[10px] text-violet-400">Enter로 바로 저장</span><button class="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white">저장</button></div>
                    </form>
                    <div class="grid grid-cols-2 gap-2 lg:grid-cols-1">${visible.map(renderCard).join('') || '<div class="col-span-2 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-400 lg:col-span-1">아직 기록이 없습니다.</div>'}</div>
                </aside>
                <div class="${selected ? 'block' : 'hidden lg:block'}">${renderEditor(selected)}</div>
            </div>`;
        if (!options.skipRemote) loadRemote();
    }

    async function saveActive() {
        const note = notes.find((item) => item.id === activeId);
        if (!note) return;
        const title = String(document.getElementById('life-note-title')?.value || '').trim();
        if (!title) return;
        note.title = title;
        note.content = String(document.getElementById('life-note-content')?.value || '');
        note.updatedAt = now();
        saveStore();
        render({ skipRemote: true });
        await persist(note);
        window.showToast?.('생활 노트를 저장했습니다.', 'info');
    }

    function wrapSelection(kind) {
        const textarea = document.getElementById('life-note-content');
        if (!textarea) return;
        const token = kind === 'bold' ? '**' : kind === 'underline' ? '++' : '~~';
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.setRangeText(`${token}${textarea.value.slice(start, end) || '텍스트'}${token}`, start, end, 'select');
        textarea.focus();
    }

    function bindControls() {
        if (bound) return;
        bound = true;
        const root = getRoot();
        root?.addEventListener('submit', async (event) => {
            if (event.target.id !== 'life-quick-form') return;
            event.preventDefault();
            const input = document.getElementById('life-quick-title');
            const title = String(input?.value || '').trim();
            if (!title) return;
            const note = normalize({ title, noteType: activeTab === 'check' ? 'check' : 'memo', status: activeTab === 'paused' ? 'paused' : 'active', displayOrder: Date.now() });
            notes.unshift(note); activeId = note.id; saveStore(); render({ skipRemote: true }); await persist(note);
        });
        root?.addEventListener('click', async (event) => {
            const tab = event.target.closest('[data-life-tab]');
            if (tab) { activeTab = tab.dataset.lifeTab; activeId = null; render({ skipRemote: true }); return; }
            const open = event.target.closest('[data-life-note-open]');
            if (open) { activeId = open.dataset.lifeNoteOpen; render({ skipRemote: true }); return; }
            if (event.target.closest('[data-life-new]')) { activeId = null; document.getElementById('life-quick-title')?.focus(); return; }
            const note = notes.find((item) => item.id === activeId);
            if (!note) return;
            if (event.target.closest('[data-life-note-save]')) { await saveActive(); return; }
            if (event.target.closest('[data-life-note-pin]')) { note.pinned = !note.pinned; note.updatedAt = now(); saveStore(); render({ skipRemote: true }); await persist(note); return; }
            if (event.target.closest('[data-life-note-pause]')) { note.status = note.status === 'paused' ? 'active' : 'paused'; note.updatedAt = now(); saveStore(); activeTab = note.status === 'paused' ? 'paused' : note.noteType; render({ skipRemote: true }); await persist(note); return; }
            if (event.target.closest('[data-life-note-delete]')) { notes = notes.filter((item) => item.id !== note.id); activeId = null; saveStore(); render({ skipRemote: true }); await removeRemote(note.id); return; }
            const format = event.target.closest('[data-life-format]');
            if (format) { wrapSelection(format.dataset.lifeFormat); return; }
            if (event.target.closest('[data-life-note-check-add]')) {
                const input = document.getElementById('life-note-check-input'); const title = String(input?.value || '').trim(); if (!title) return;
                note.checklist.push({ id: createId(), title, done: false }); note.updatedAt = now(); saveStore(); render({ skipRemote: true }); await persist(note); return;
            }
            const remove = event.target.closest('[data-life-note-check-delete]');
            if (remove) { note.checklist = note.checklist.filter((item) => item.id !== remove.dataset.lifeNoteCheckDelete); note.updatedAt = now(); saveStore(); render({ skipRemote: true }); await persist(note); }
        });
        root?.addEventListener('change', async (event) => {
            const toggle = event.target.closest('[data-life-note-check]');
            if (!toggle) return;
            const note = notes.find((item) => item.id === activeId); const item = note?.checklist.find((entry) => entry.id === toggle.dataset.lifeNoteCheck); if (!item) return;
            item.done = toggle.checked; note.updatedAt = now(); saveStore(); render({ skipRemote: true }); await persist(note);
        });
        root?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && event.target.id === 'life-quick-title') {
                event.preventDefault();
                event.target.closest('form')?.requestSubmit();
            }
        });
    }

    notes = readStore();
    window.LifeNotesFeature = { render, bindControls, refresh: () => { loaded = false; return loadRemote(); } };
})(window);
