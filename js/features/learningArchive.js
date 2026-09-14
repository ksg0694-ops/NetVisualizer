(function (window) {
    const STORAGE_KEY = 'netvisualizer.learning.archive.v1';
    const TRASH_KEY = 'netvisualizer.learning.archive.trash.v1';
    const VERSION_KEY = 'netvisualizer.learning.archive.versions.v1';
    const UI_KEY = 'netvisualizer.learning.archive.ui.v1';
    const DIRTY_KEY = 'netvisualizer.learning.archive.dirty.v1';
    const DELETE_QUEUE_KEY = 'netvisualizer.learning.archive.delete-queue.v1';
    const TABLE_NAME = 'learning_archive_notes';
    let entries = [];
    let activeId = null;
    let searchText = '';
    let dockTab = 'links';
    let isTrashOpen = false;
    let bound = false;
    let loaded = false;
    let autosaveTimer = null;
    let editorInputFrame = null;
    let editorSelectionGesture = null;
    let preservedEditorSelection = null;
    let pendingTreePress = null;
    let longPressDrag = null;
    let treeDragFrame = null;
    let suppressTreeClickUntil = 0;
    let remoteSupportsOrdering = true;
    const LONG_PRESS_DELAY_MS = 180;
    const TOUCH_LONG_PRESS_DELAY_MS = 260;
    const LONG_PRESS_CANCEL_DISTANCE = 10;
    const TREE_DRAG_SCROLL_MARGIN = 48;
    const TREE_DRAG_SCROLL_STEP = 12;

    const escapeHtml = (value) => window.AppUtils.escapeHtml(value);
    const escapeAttr = (value) => window.AppUtils.escapeAttr(value);
    const createId = () => (window.crypto?.randomUUID?.() || `learning-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const now = () => new Date().toISOString();

    function readUiState() {
        try {
            const value = JSON.parse(window.AccountStorage.current.getItem(UI_KEY) || '{}');
            activeId = typeof value.activeId === 'string' ? value.activeId : null;
            dockTab = ['links', 'versions', 'toc'].includes(value.dockTab) ? value.dockTab : 'links';
        } catch (_error) { /* use defaults */ }
    }

    function saveUiState() {
        window.AccountStorage.current.setItem(UI_KEY, JSON.stringify({ activeId, dockTab, savedAt: now() }));
    }

    function normalize(raw = {}) {
        const field = String(raw.field || raw.fieldName || raw.field_name || '').trim();
        const item = String(raw.item || raw.itemName || raw.item_name || '').trim();
        const chapter = String(raw.chapter || raw.chapterName || raw.chapter_name || '').trim();
        const title = String(raw.title || '').trim();
        if (!field || !item || !chapter || !title) return null;
        return {
            id: String(raw.id || createId()),
            field,
            item,
            chapter,
            title,
            content: String(raw.content || ''),
            sourceLinks: Array.isArray(raw.sourceLinks || raw.source_links) ? (raw.sourceLinks || raw.source_links).map(String) : [],
            tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
            pinned: Boolean(raw.pinned ?? raw.is_pinned),
            fieldOrder: Number(raw.fieldOrder ?? raw.field_order) || 0,
            itemOrder: Number(raw.itemOrder ?? raw.item_order) || 0,
            chapterOrder: Number(raw.chapterOrder ?? raw.chapter_order) || 0,
            displayOrder: Number(raw.displayOrder ?? raw.display_order ?? raw.sortOrder ?? raw.sort_order) || 0,
            createdAt: raw.createdAt || raw.created_at || now(),
            updatedAt: raw.updatedAt || raw.updated_at || now(),
        };
    }

    function readStore() {
        try { return (JSON.parse(window.AccountStorage.current.getItem(STORAGE_KEY) || '[]') || []).map(normalize).filter(Boolean); }
        catch (error) { console.warn('Learning archive storage parse failed.', error); return []; }
    }

    function orderNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
    }

    function orderedNames(source, key, orderKey) {
        const metadata = new Map();
        source.forEach((entry, index) => {
            const name = entry[key];
            if (!name) return;
            const order = orderNumber(entry[orderKey]);
            const current = metadata.get(name);
            if (!current) metadata.set(name, { firstIndex: index, order });
            else if (order < current.order) current.order = order;
        });
        return [...metadata.keys()].sort((a, b) => metadata.get(a).order - metadata.get(b).order
            || metadata.get(a).firstIndex - metadata.get(b).firstIndex
            || a.localeCompare(b, 'ko'));
    }

    function ensureOrdering(source = entries) {
        const fields = orderedNames(source, 'field', 'fieldOrder');
        fields.forEach((field, fieldIndex) => {
            const fieldEntries = source.filter((entry) => entry.field === field);
            fieldEntries.forEach((entry) => { entry.fieldOrder = (fieldIndex + 1) * 1000; });
            const items = orderedNames(fieldEntries, 'item', 'itemOrder');
            items.forEach((item, itemIndex) => {
                const itemEntries = fieldEntries.filter((entry) => entry.item === item);
                itemEntries.forEach((entry) => { entry.itemOrder = (itemIndex + 1) * 1000; });
                const chapters = orderedNames(itemEntries, 'chapter', 'chapterOrder');
                chapters.forEach((chapter, chapterIndex) => {
                    const chapterEntries = itemEntries
                        .filter((entry) => entry.chapter === chapter)
                        .sort((a, b) => orderNumber(a.displayOrder) - orderNumber(b.displayOrder)
                            || Number(b.pinned) - Number(a.pinned)
                            || String(b.updatedAt).localeCompare(String(a.updatedAt)));
                    chapterEntries.forEach((entry, entryIndex) => {
                        entry.chapterOrder = (chapterIndex + 1) * 1000;
                        entry.displayOrder = (entryIndex + 1) * 1000;
                    });
                });
            });
        });
        return source;
    }

    function compareEntries(a, b) {
        return orderNumber(a.fieldOrder) - orderNumber(b.fieldOrder)
            || orderNumber(a.itemOrder) - orderNumber(b.itemOrder)
            || orderNumber(a.chapterOrder) - orderNumber(b.chapterOrder)
            || orderNumber(a.displayOrder) - orderNumber(b.displayOrder)
            || a.title.localeCompare(b.title, 'ko');
    }

    function saveStore(options = {}) {
        if (!options.skipOrdering) ensureOrdering(entries);
        entries.sort(compareEntries);
        window.AccountStorage.current.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function readTrash() {
        try {
            const parsed = JSON.parse(window.AccountStorage.current.getItem(TRASH_KEY) || '[]');
            if (!Array.isArray(parsed)) return [];
            return parsed.map((item) => ({
                entry: normalize(item?.entry || item),
                deletedAt: item?.deletedAt || item?.deleted_at || now(),
            })).filter((item) => item.entry);
        } catch (error) {
            console.warn('Learning archive trash parse failed.', error);
            return [];
        }
    }

    function saveTrash(items) {
        const normalized = (Array.isArray(items) ? items : []).filter((item) => item?.entry).slice(0, 100);
        window.AccountStorage.current.setItem(TRASH_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function readDirtyIds() {
        try {
            const value = JSON.parse(window.AccountStorage.current.getItem(DIRTY_KEY) || '[]');
            return new Set(Array.isArray(value) ? value.map(String) : []);
        } catch (_error) { return new Set(); }
    }

    function updateDirtyId(id, dirty) {
        if (!id) return;
        const ids = readDirtyIds();
        if (dirty) ids.add(String(id));
        else ids.delete(String(id));
        window.AccountStorage.current.setItem(DIRTY_KEY, JSON.stringify([...ids]));
    }

    function readPendingDeleteIds() {
        try {
            const value = JSON.parse(window.AccountStorage.current.getItem(DELETE_QUEUE_KEY) || '[]');
            return new Set(Array.isArray(value) ? value.map(String) : []);
        } catch (_error) { return new Set(); }
    }

    function updatePendingDeleteId(id, pending) {
        if (!id) return;
        const ids = readPendingDeleteIds();
        if (pending) ids.add(String(id));
        else ids.delete(String(id));
        window.AccountStorage.current.setItem(DELETE_QUEUE_KEY, JSON.stringify([...ids]));
    }

    function readVersions() {
        try {
            const value = JSON.parse(window.AccountStorage.current.getItem(VERSION_KEY) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (_error) { return {}; }
    }

    function getVersions(entryId) {
        const store = readVersions();
        return Array.isArray(store[entryId]) ? store[entryId] : [];
    }

    function removeVersions(entryId) {
        const store = readVersions();
        if (!store[entryId]) return;
        delete store[entryId];
        window.AccountStorage.current.setItem(VERSION_KEY, JSON.stringify(store));
    }

    function captureVersion(entry, reason = '자동 저장 전') {
        if (!entry) return;
        const store = readVersions();
        const versions = Array.isArray(store[entry.id]) ? store[entry.id] : [];
        if (versions[0]?.content === entry.content && versions[0]?.title === entry.title) return;
        store[entry.id] = [{
            id: createId(),
            title: entry.title,
            content: entry.content,
            field: entry.field,
            item: entry.item,
            chapter: entry.chapter,
            tags: entry.tags,
            sourceLinks: entry.sourceLinks,
            reason,
            createdAt: now(),
        }, ...versions].slice(0, 24);
        window.AccountStorage.current.setItem(VERSION_KEY, JSON.stringify(store));
    }

    function getClient() {
        try { return typeof getAuthenticatedSupabaseClient === 'function' ? getAuthenticatedSupabaseClient() : null; }
        catch (_error) { return null; }
    }

    function toRow(entry, includeOrdering = remoteSupportsOrdering) {
        const row = {
            id: entry.id,
            field_name: entry.field,
            item_name: entry.item,
            chapter_name: entry.chapter,
            title: entry.title,
            content: entry.content || null,
            source_links: entry.sourceLinks,
            tags: entry.tags,
            is_pinned: entry.pinned,
            created_at: entry.createdAt,
            updated_at: entry.updatedAt,
        };
        if (includeOrdering) {
            row.field_order = entry.fieldOrder;
            row.item_order = entry.itemOrder;
            row.chapter_order = entry.chapterOrder;
            row.display_order = entry.displayOrder;
        }
        const userId = typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
        if (userId) row.user_id = userId;
        return row;
    }

    async function persist(entry) {
        if (!entry) return false;
        updateDirtyId(entry.id, true);
        const client = getClient();
        if (!client) return false;
        const row = toRow(entry);
        const fingerprint = JSON.stringify(row);
        try {
            await window.RecordSync.save(client, TABLE_NAME, row);
            const latest = entries.find((item) => item.id === entry.id);
            if (latest && JSON.stringify(toRow(latest)) === fingerprint) updateDirtyId(entry.id, false);
            return true;
        } catch (error) {
            console.warn('Learning archive sync failed.', error.message);
            setAutosaveStatus('local', error.message);
            return false;
        }
    }

    async function persistMany(source) {
        const unique = [...new Map(source.map((entry) => [entry.id, entry])).values()];
        return (await Promise.all(unique.map(persist))).every(Boolean);
    }

    async function removeRemote(id) {
        const client = getClient();
        if (!client) return false;
        try {
            await window.RecordSync.remove(client, TABLE_NAME, id);
            updatePendingDeleteId(id, false);
            return true;
        } catch (error) {
            setAutosaveStatus('local', error.message);
            return false;
        }
    }

    async function loadRemote() {
        if (loaded) return;
        loaded = true;
        const client = getClient();
        if (!client) return;
        const orderedColumns = 'id,field_name,item_name,chapter_name,title,content,source_links,tags,is_pinned,field_order,item_order,chapter_order,display_order,created_at,updated_at';
        const legacyColumns = 'id,field_name,item_name,chapter_name,title,content,source_links,tags,is_pinned,created_at,updated_at';
        let { data, error } = await window.RecordSync.readAllRows(() => client.from(TABLE_NAME).select(orderedColumns));
        if (error && (String(error.code || '') === 'PGRST204' || /(?:field|item|chapter|display)_order/i.test(String(error.message || '')))) {
            remoteSupportsOrdering = false;
            ({ data, error } = await window.RecordSync.readAllRows(() => client.from(TABLE_NAME).select(legacyColumns).order('updated_at', { ascending: false })));
        }
        if (error) { loaded = false; setAutosaveStatus('local', '서버 읽기 실패 · 기기 기록 유지'); return; }
        const dirtyIds = readDirtyIds();
        if (window.AppExperience?.isEditing()) { loaded = false; window.AppExperience.deferRefresh(); return; }
        window.RecordSync.remember(TABLE_NAME, data || [], new Set([...dirtyIds, ...readPendingDeleteIds()]));
        const trashIds = new Set(readTrash().map((item) => item.entry.id));
        const pendingDeleteIds = new Set([...readPendingDeleteIds(), ...trashIds]);
        pendingDeleteIds.forEach((id) => updatePendingDeleteId(id, true));
        const localById = new Map(entries.map((entry) => [entry.id, entry]));
        const merged = new Map((data || []).map(normalize).filter(Boolean).filter((entry) => !pendingDeleteIds.has(entry.id)).map((entry) => [entry.id, entry]));
        dirtyIds.forEach((id) => {
            const local = localById.get(id);
            if (local && !pendingDeleteIds.has(id)) merged.set(id, local);
        });
        entries = [...merged.values()];
        if (activeId && !entries.some((entry) => entry.id === activeId)) activeId = null;
        saveStore();
        render({ skipRemote: true });
        await Promise.all([...dirtyIds].map((id) => localById.get(id)).filter(Boolean).map((entry) => persist(entry)));
        await Promise.all([...pendingDeleteIds].map((id) => removeRemote(id)));
    }

    function current() {
        return entries.find((entry) => entry.id === activeId) || null;
    }

    function filtered() {
        const query = searchText.trim().toLowerCase();
        if (!query) return entries;
        return entries.filter((entry) => [entry.field, entry.item, entry.chapter, entry.title, entry.content, ...entry.tags].join(' ').toLowerCase().includes(query));
    }

    function renderTree(source) {
        const fields = orderedNames(source, 'field', 'fieldOrder');
        const active = current();
        const isOpen = (field, item = '', chapter = '') => Boolean(searchText.trim()
            || (active && active.field === field
                && (!item || active.item === item)
                && (!chapter || active.chapter === chapter)));
        if (!fields.length) return '<div class="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-xs text-gray-400">첫 학습 노트를 만들어보세요.</div>';
        return fields.map((field) => {
            const fieldEntries = source.filter((entry) => entry.field === field);
            const items = orderedNames(fieldEntries, 'item', 'itemOrder');
            return `<details ${isOpen(field) ? 'open' : ''} data-learning-tree-node data-learning-level="field" data-learning-field="${escapeAttr(field)}" class="group/field rounded-md">
                <summary data-learning-reorder-target title="길게 눌러 분야 순서 변경" class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-xs font-black text-gray-800 transition hover:bg-gray-50"><i class="fas fa-chevron-right w-2 text-[8px] text-gray-300 transition group-open/field:rotate-90"></i><i class="far fa-folder text-indigo-400"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(field)}</span><span class="text-[9px] font-medium text-gray-400">${fieldEntries.length}</span></summary>
                <div class="ml-3 border-l border-gray-100 pl-2">${items.map((item) => {
                    const itemEntries = fieldEntries.filter((entry) => entry.item === item);
                    const chapters = orderedNames(itemEntries, 'chapter', 'chapterOrder');
                    return `<details ${isOpen(field, item) ? 'open' : ''} data-learning-tree-node data-learning-level="item" data-learning-field="${escapeAttr(field)}" data-learning-item="${escapeAttr(item)}" class="group/item rounded-md">
                        <summary data-learning-reorder-target title="길게 눌러 항목 순서 변경" class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-50"><i class="fas fa-chevron-right w-2 text-[8px] text-gray-300 transition group-open/item:rotate-90"></i><i class="far fa-folder-open text-sky-400"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(item)}</span><span class="text-[9px] font-medium text-gray-400">${itemEntries.length}</span></summary>
                        <div class="ml-3 border-l border-gray-100 pl-2">${chapters.map((chapter) => {
                            const chapterEntries = itemEntries.filter((entry) => entry.chapter === chapter).sort(compareEntries);
                            return `<details ${isOpen(field, item, chapter) ? 'open' : ''} data-learning-tree-node data-learning-level="chapter" data-learning-field="${escapeAttr(field)}" data-learning-item="${escapeAttr(item)}" data-learning-chapter="${escapeAttr(chapter)}" class="group/chapter rounded-md">
                                <summary data-learning-reorder-target title="길게 눌러 Chapter 순서 변경" class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-bold text-gray-600 transition hover:bg-gray-50"><i class="fas fa-chevron-right w-2 text-[7px] text-gray-300 transition group-open/chapter:rotate-90"></i><i class="far fa-file-lines text-gray-400"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(chapter)}</span><span class="text-[9px] font-medium text-gray-400">${chapterEntries.length}</span></summary>
                                <div class="ml-3 space-y-0.5 border-l border-gray-100 pl-2">${chapterEntries.map((entry) => `<div data-learning-tree-node data-learning-level="note" data-learning-id="${escapeAttr(entry.id)}" data-learning-field="${escapeAttr(field)}" data-learning-item="${escapeAttr(item)}" data-learning-chapter="${escapeAttr(chapter)}" class="flex items-center rounded-md ${activeId === entry.id ? 'bg-indigo-50 ring-1 ring-indigo-100' : 'hover:bg-gray-50'}"><button type="button" data-learning-reorder-target data-learning-open="${escapeAttr(entry.id)}" title="길게 눌러 노트 순서 변경" class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] transition ${activeId === entry.id ? 'font-bold text-indigo-700' : 'text-gray-500 hover:text-gray-800'}"><i class="far fa-note-sticky text-[9px]"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(entry.title)}</span>${entry.pinned ? '<i class="fas fa-thumbtack text-[8px] text-indigo-400"></i>' : ''}</button></div>`).join('')}</div>
                            </details>`;
                        }).join('')}</div>
                    </details>`;
                }).join('')}</div>
            </details>`;
        }).join('');
    }

    function describeTreeNode(node) {
        if (!node) return null;
        return {
            level: node.dataset.learningLevel || '',
            id: node.dataset.learningId || '',
            field: node.dataset.learningField || '',
            item: node.dataset.learningItem || '',
            chapter: node.dataset.learningChapter || '',
        };
    }

    function sameTreeParent(a, b) {
        if (!a || !b || a.level !== b.level) return false;
        if (a.level === 'field') return true;
        if (a.level === 'item') return a.field === b.field;
        if (a.level === 'chapter') return a.field === b.field && a.item === b.item;
        return a.field === b.field && a.item === b.item && a.chapter === b.chapter;
    }

    function siblingKeys(descriptor) {
        if (descriptor.level === 'field') return orderedNames(entries, 'field', 'fieldOrder');
        const fieldEntries = entries.filter((entry) => entry.field === descriptor.field);
        if (descriptor.level === 'item') return orderedNames(fieldEntries, 'item', 'itemOrder');
        const itemEntries = fieldEntries.filter((entry) => entry.item === descriptor.item);
        if (descriptor.level === 'chapter') return orderedNames(itemEntries, 'chapter', 'chapterOrder');
        return itemEntries.filter((entry) => entry.chapter === descriptor.chapter).sort(compareEntries).map((entry) => entry.id);
    }

    function descriptorKey(descriptor) {
        if (descriptor.level === 'field') return descriptor.field;
        if (descriptor.level === 'item') return descriptor.item;
        if (descriptor.level === 'chapter') return descriptor.chapter;
        return descriptor.id;
    }

    function applySiblingOrder(descriptor, orderedKeys) {
        const changed = [];
        orderedKeys.forEach((key, index) => {
            const order = (index + 1) * 1000;
            entries.forEach((entry) => {
                let matches = false;
                if (descriptor.level === 'field') matches = entry.field === key;
                else if (descriptor.level === 'item') matches = entry.field === descriptor.field && entry.item === key;
                else if (descriptor.level === 'chapter') matches = entry.field === descriptor.field && entry.item === descriptor.item && entry.chapter === key;
                else matches = entry.id === key;
                if (!matches) return;
                const property = descriptor.level === 'field' ? 'fieldOrder'
                    : descriptor.level === 'item' ? 'itemOrder'
                        : descriptor.level === 'chapter' ? 'chapterOrder' : 'displayOrder';
                if (entry[property] !== order) {
                    entry[property] = order;
                    entry.updatedAt = now();
                    changed.push(entry);
                }
            });
        });
        return [...new Map(changed.map((entry) => [entry.id, entry])).values()];
    }

    function ensureTreeDragStyles() {
        if (document.getElementById('learning-tree-drag-style')) return;
        const style = document.createElement('style');
        style.id = 'learning-tree-drag-style';
        style.textContent = `
            .learning-tree-drag-ghost {
                border: 1px solid rgba(129, 140, 248, 0.45);
                border-radius: 0.5rem;
                background: rgba(255, 255, 255, 0.98);
                box-shadow: 0 18px 38px rgba(15, 23, 42, 0.2), 0 4px 12px rgba(15, 23, 42, 0.12);
                cursor: grabbing;
                opacity: 0.98;
                pointer-events: none;
                will-change: transform;
            }
            .learning-tree-drag-placeholder {
                border: 1.5px dashed rgba(99, 102, 241, 0.62);
                border-radius: 0.5rem;
                background: repeating-linear-gradient(135deg, rgba(99, 102, 241, 0.07), rgba(99, 102, 241, 0.07) 7px, rgba(99, 102, 241, 0.13) 7px, rgba(99, 102, 241, 0.13) 14px);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.72);
                transition: transform 90ms ease;
            }
            .learning-tree-drag-source > [data-learning-reorder-target] {
                opacity: 0.22 !important;
                transform: scale(0.985);
            }
            .learning-tree-pressing {
                background: rgba(238, 242, 255, 0.72);
                transform: scale(0.992);
            }
            .learning-tree-dragging, .learning-tree-dragging * {
                cursor: grabbing !important;
                user-select: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function moveTreeDragGhost(drag, point) {
        if (!drag?.ghost) return;
        const x = point.clientX - drag.offsetX;
        const y = point.clientY - drag.offsetY;
        drag.ghost.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(-0.75deg) scale(1.012)`;
    }

    function moveTreePlaceholder(placeholder, target, position = 'before') {
        if (!placeholder || !target?.parentNode) return;
        const anchor = position === 'after' ? target.nextSibling : target;
        if (anchor !== placeholder) target.parentNode.insertBefore(placeholder, anchor);
    }

    function clearTreeDragState(root, drag = longPressDrag) {
        if (treeDragFrame) cancelAnimationFrame(treeDragFrame);
        treeDragFrame = null;
        drag?.surface?.classList.remove('learning-tree-pressing');
        drag?.node?.classList.remove('learning-tree-drag-source');
        drag?.ghost?.remove();
        drag?.placeholder?.remove();
        document.body.classList.remove('select-none', 'learning-tree-dragging');
        root?.querySelectorAll('[data-learning-tree-node]').forEach((node) => {
            node.removeAttribute('data-learning-drop-position');
            node.removeAttribute('data-learning-dragging');
            const surface = node.querySelector(':scope > [data-learning-reorder-target]');
            surface?.classList.remove('ring-2', 'ring-indigo-300', 'ring-offset-1', 'learning-tree-pressing');
        });
    }

    function cancelPendingTreePress() {
        if (!pendingTreePress) return;
        clearTimeout(pendingTreePress.timer);
        pendingTreePress.surface?.classList.remove('learning-tree-pressing');
        pendingTreePress = null;
    }

    function activateTreeLongPress(pending) {
        if (pendingTreePress !== pending) return;
        clearTimeout(pending.timer);
        pendingTreePress = null;
        const rect = pending.surface.getBoundingClientRect();
        const placeholder = document.createElement('div');
        placeholder.className = 'learning-tree-drag-placeholder';
        placeholder.style.height = `${rect.height}px`;
        placeholder.style.marginTop = getComputedStyle(pending.node).marginTop;
        placeholder.style.marginBottom = getComputedStyle(pending.node).marginBottom;
        const ghost = pending.surface.cloneNode(true);
        ghost.classList.remove('learning-tree-pressing');
        ghost.classList.add('learning-tree-drag-ghost');
        ghost.removeAttribute('data-learning-reorder-target');
        ghost.removeAttribute('data-learning-open');
        ghost.style.position = 'fixed';
        ghost.style.left = '0';
        ghost.style.top = '0';
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.margin = '0';
        ghost.style.zIndex = '9999';
        pending.node.parentNode?.insertBefore(placeholder, pending.node.nextSibling);
        pending.node.classList.add('learning-tree-drag-source');
        pending.node.dataset.learningDragging = 'true';
        document.body.appendChild(ghost);
        document.body.classList.add('select-none', 'learning-tree-dragging');
        longPressDrag = {
            ...pending,
            ghost,
            placeholder,
            offsetX: pending.startX - rect.left,
            offsetY: pending.startY - rect.top,
            latestPoint: { clientX: pending.startX, clientY: pending.startY, pointerId: pending.pointerId },
            targetNode: null,
            position: 'before',
        };
        moveTreeDragGhost(longPressDrag, longPressDrag.latestPoint);
        window.navigator?.vibrate?.(10);
    }

    function beginTreeLongPress(event, root) {
        if (event.button !== undefined && event.button !== 0) return;
        if (pendingTreePress || longPressDrag) return;
        const surface = event.target.closest?.('[data-learning-reorder-target]');
        const node = surface?.closest?.('[data-learning-tree-node]');
        if (!surface || !node) return;
        cancelPendingTreePress();
        const pending = {
            node,
            surface,
            pointerId: event.pointerId ?? 'mouse',
            pointerType: event.pointerType || 'mouse',
            startX: event.clientX,
            startY: event.clientY,
            startedAt: performance.now(),
            timer: null,
        };
        surface.classList.add('learning-tree-pressing');
        const delay = pending.pointerType === 'touch' ? TOUCH_LONG_PRESS_DELAY_MS : LONG_PRESS_DELAY_MS;
        pending.timer = window.setTimeout(() => activateTreeLongPress(pending), delay);
        pendingTreePress = pending;
    }

    function findNearestTreeDropTarget(root, descriptor, point) {
        const candidates = Array.from(root.querySelectorAll(`[data-learning-tree-node][data-learning-level="${CSS.escape(descriptor.level)}"]`))
            .filter((node) => node !== longPressDrag?.node && sameTreeParent(descriptor, describeTreeNode(node)));
        return candidates.map((node) => {
            const surface = node.querySelector(':scope > [data-learning-reorder-target]');
            const rect = surface?.getBoundingClientRect();
            return rect ? { node, distance: Math.abs(point.clientY - (rect.top + rect.height / 2)) } : null;
        }).filter(Boolean).sort((a, b) => a.distance - b.distance)[0]?.node || null;
    }

    function updateTreeAutoScroll(root, point) {
        const scroller = root.querySelector('[data-learning-tree-list]');
        const rect = scroller?.getBoundingClientRect();
        if (!scroller || !rect) return;
        if (point.clientY < rect.top + TREE_DRAG_SCROLL_MARGIN) scroller.scrollTop -= TREE_DRAG_SCROLL_STEP;
        else if (point.clientY > rect.bottom - TREE_DRAG_SCROLL_MARGIN) scroller.scrollTop += TREE_DRAG_SCROLL_STEP;
    }

    function paintTreeDragFrame(root) {
        treeDragFrame = null;
        const drag = longPressDrag;
        const point = drag?.latestPoint;
        if (!drag || !point) return;
        moveTreeDragGhost(drag, point);
        updateTreeAutoScroll(root, point);
        const sourceDescriptor = describeTreeNode(drag.node);
        let targetNode = document.elementFromPoint(point.clientX, point.clientY)?.closest?.('[data-learning-tree-node]');
        if (!targetNode || targetNode === drag.node || !sameTreeParent(sourceDescriptor, describeTreeNode(targetNode))) {
            targetNode = findNearestTreeDropTarget(root, sourceDescriptor, point);
        }
        if (!targetNode || targetNode === drag.node) return;
        const targetSurface = targetNode.querySelector(':scope > [data-learning-reorder-target]');
        const rect = targetSurface?.getBoundingClientRect();
        if (!rect) return;
        const position = point.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
        if (drag.targetNode === targetNode && drag.position === position) return;
        drag.targetNode?.removeAttribute('data-learning-drop-position');
        drag.targetNode?.querySelector(':scope > [data-learning-reorder-target]')?.classList.remove('ring-2', 'ring-indigo-300', 'ring-offset-1');
        targetNode.dataset.learningDropPosition = position;
        targetSurface.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
        moveTreePlaceholder(drag.placeholder, targetNode, position);
        drag.targetNode = targetNode;
        drag.position = position;
    }

    function updateTreeLongPress(event, root) {
        if (pendingTreePress) {
            const distance = Math.hypot(event.clientX - pendingTreePress.startX, event.clientY - pendingTreePress.startY);
            if (distance > LONG_PRESS_CANCEL_DISTANCE) {
                const heldFor = performance.now() - pendingTreePress.startedAt;
                if (pendingTreePress.pointerType !== 'touch' && heldFor >= 70) activateTreeLongPress(pendingTreePress);
                else cancelPendingTreePress();
            }
        }
        if (!longPressDrag || (event.pointerId ?? 'mouse') !== longPressDrag.pointerId) return;
        event.preventDefault();
        longPressDrag.latestPoint = { clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId ?? 'mouse' };
        if (!treeDragFrame) treeDragFrame = requestAnimationFrame(() => paintTreeDragFrame(root));
    }

    async function finishTreeLongPress(event, root, cancelled = false) {
        if (pendingTreePress) {
            cancelPendingTreePress();
            return;
        }
        if (!longPressDrag || (event.pointerId ?? 'mouse') !== longPressDrag.pointerId) return;
        event.preventDefault();
        const completed = longPressDrag;
        longPressDrag = null;
        suppressTreeClickUntil = Date.now() + 600;
        const reorderPromise = !cancelled && completed.targetNode
            ? reorderTreeNode(completed.node, completed.targetNode, completed.position)
            : Promise.resolve();
        clearTreeDragState(root, completed);
        await reorderPromise;
    }

    async function reorderTreeNode(sourceNode, targetNode, position) {
        const source = describeTreeNode(sourceNode);
        const target = describeTreeNode(targetNode);
        if (!source || !target || descriptorKey(source) === descriptorKey(target)) return;
        if (!sameTreeParent(source, target)) {
            window.showToast?.('같은 분야·항목·Chapter 안에서 순서를 변경해주세요.', 'warning');
            return;
        }
        const keys = siblingKeys(source);
        const sourceKey = descriptorKey(source);
        const targetKey = descriptorKey(target);
        const fromIndex = keys.indexOf(sourceKey);
        if (fromIndex < 0) return;
        keys.splice(fromIndex, 1);
        const targetIndex = keys.indexOf(targetKey);
        keys.splice(targetIndex + (position === 'after' ? 1 : 0), 0, sourceKey);
        const changed = applySiblingOrder(source, keys);
        saveStore({ skipOrdering: true });
        renderTreeOnly();
        await persistMany(changed);
        window.showToast?.('학습 아카이브 순서를 저장했습니다.', 'info');
    }

    async function moveTreeNodeWithKeyboard(root, node, direction) {
        const descriptor = describeTreeNode(node);
        const siblings = Array.from(root.querySelectorAll(`[data-learning-tree-node][data-learning-level="${CSS.escape(descriptor.level)}"]`))
            .filter((candidate) => sameTreeParent(descriptor, describeTreeNode(candidate)));
        const currentIndex = siblings.indexOf(node);
        const targetIndex = currentIndex + direction;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
            window.showToast?.('더 이상 이동할 수 없습니다.', 'warning');
            return;
        }
        await reorderTreeNode(node, siblings[targetIndex], direction < 0 ? 'before' : 'after');
    }

    function formatInline(value) {
        const formatted = escapeHtml(String(value || ''))
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
            .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
            .replace(/\[\[([^\]\n]+)\]\]/g, '<span data-learning-note-link="$1" contenteditable="false" class="rounded bg-indigo-50 px-1 py-0.5 font-semibold text-indigo-700">$1</span>');
        return window.NoteEditor.renderFontSizeMarkup(formatted);
    }

    function getLearningContentClass(style = 'body') {
        return `min-w-0 flex-1 whitespace-pre-wrap break-words py-0.5 leading-[1.4] outline-none ${window.NoteEditor.getBlockStyleClass(style)}`;
    }

    function renderEditorLine(line, index) {
        const raw = String(line || '');
        const indent = raw.match(/^ */)?.[0]?.length || 0;
        const block = window.NoteEditor.parseBlockStyle(raw.slice(indent));
        return `<div data-learning-line data-learning-indent="${indent}" data-learning-block="${block.style}" data-learning-line-index="${index}" class="flex min-h-6 items-center" style="padding-left:${Math.floor(indent / 3) * 20}px">
            <span data-learning-line-content data-placeholder="${index === 0 ? '내용을 입력하세요.' : ''}" class="${getLearningContentClass(block.style)}">${formatInline(block.content)}</span>
        </div>`;
    }

    function renderEditorSurface(content) {
        return String(content || '').split('\n').map(renderEditorLine).join('');
    }

    function serializeInline(node) {
        if (!node) return '';
        if (node.nodeType === Node.TEXT_NODE) return String(node.nodeValue || '').replace(/\u00a0/g, ' ');
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        if (node.dataset?.learningNoteLink) return `[[${node.dataset.learningNoteLink}]]`;
        if (node.tagName === 'BR') return '';
        const value = Array.from(node.childNodes).map(serializeInline).join('');
        const sized = window.NoteEditor.serializeFontSize(node, value);
        if (sized) return sized;
        if (['B', 'STRONG'].includes(node.tagName)) return `**${value}**`;
        if (node.tagName === 'U') return `++${value}++`;
        if (['S', 'STRIKE'].includes(node.tagName)) return `~~${value}~~`;
        return value;
    }

    function syncEditorSource() {
        const surface = document.getElementById('learning-editor-surface');
        const source = document.getElementById('learning-content');
        if (!surface || !source) return '';
        source.value = Array.from(surface.children).filter((node) => node.matches?.('[data-learning-line]')).map((line) => {
            const indent = Math.max(0, Number(line.dataset.learningIndent) || 0);
            const content = serializeInline(line.querySelector(':scope > [data-learning-line-content]'));
            return `${' '.repeat(indent)}${window.NoteEditor.serializeBlockStyle(line.dataset.learningBlock, content)}`;
        }).join('\n');
        updateEditorCharacterCount(source.value);
        return source.value;
    }

    function updateEditorCharacterCount(value) {
        const count = document.getElementById('learning-character-count');
        if (count) count.textContent = String(value || '').length.toLocaleString('ko-KR');
    }

    function placeCaret(content, atEnd = false) {
        if (!content) return;
        const surface = content.closest('#learning-editor-surface');
        (surface || content).focus({ preventScroll: true });
        const selection = window.getSelection();
        const range = document.createRange();
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode();
        if (atEnd) {
            let next = textNode;
            while (next) { textNode = next; next = walker.nextNode(); }
        }
        if (textNode) range.setStart(textNode, atEnd ? textNode.nodeValue.length : 0);
        else range.setStart(content, atEnd ? content.childNodes.length : 0);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    function selectionBelongsToSurface(selection, surface) {
        return Boolean(selection?.rangeCount
            && !selection.isCollapsed
            && surface?.contains(selection.anchorNode)
            && surface.contains(selection.focusNode));
    }

    function beginEditorSelectionGesture(event) {
        const surface = event.target.closest?.('#learning-editor-surface');
        if (!surface || (event.button !== undefined && event.button !== 0)) return;
        preservedEditorSelection = null;
        editorSelectionGesture = {
            surface,
            pointerId: event.pointerId ?? 'mouse',
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        };
    }

    function updateEditorSelectionGesture(event) {
        if (!editorSelectionGesture || (event.pointerId ?? 'mouse') !== editorSelectionGesture.pointerId) return;
        const distance = Math.hypot(event.clientX - editorSelectionGesture.startX, event.clientY - editorSelectionGesture.startY);
        if (distance > 3) editorSelectionGesture.moved = true;
    }

    function finishEditorSelectionGesture(event) {
        const gesture = editorSelectionGesture;
        if (!gesture || (event.pointerId ?? 'mouse') !== gesture.pointerId) return;
        editorSelectionGesture = null;
        const selection = window.getSelection();
        if (!gesture.moved || !selectionBelongsToSurface(selection, gesture.surface)) return;
        preservedEditorSelection = {
            surface: gesture.surface,
            range: selection.getRangeAt(0).cloneRange(),
            expiresAt: performance.now() + 500,
        };
    }

    function preserveEditorTextSelection(surface) {
        const selection = window.getSelection();
        if (selectionBelongsToSurface(selection, surface)) {
            preservedEditorSelection = null;
            return true;
        }
        const preserved = preservedEditorSelection;
        preservedEditorSelection = null;
        if (!preserved || preserved.surface !== surface || performance.now() > preserved.expiresAt) return false;
        surface.focus({ preventScroll: true });
        selection?.removeAllRanges();
        selection?.addRange(preserved.range);
        return true;
    }

    function focusLearningDetailEditorAtPoint(event) {
        const surface = event.target.closest?.('#learning-editor-surface');
        if (!surface) return false;
        if (preserveEditorTextSelection(surface)) return true;
        surface.focus({ preventScroll: true });
        let range = null;
        if (document.caretPositionFromPoint) {
            const position = document.caretPositionFromPoint(event.clientX, event.clientY);
            if (position?.offsetNode && surface.contains(position.offsetNode)) {
                range = document.createRange();
                range.setStart(position.offsetNode, position.offset);
                range.collapse(true);
            }
        } else if (document.caretRangeFromPoint) {
            const candidate = document.caretRangeFromPoint(event.clientX, event.clientY);
            if (candidate?.startContainer && surface.contains(candidate.startContainer)) range = candidate;
        }
        const pointedNode = range?.startContainer?.nodeType === Node.TEXT_NODE
            ? range.startContainer.parentElement
            : range?.startContainer;
        if (!range || !pointedNode?.closest?.('[data-learning-line-content]')) {
            return focusLearningDetailEditor(event.target);
        }
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        return true;
    }

    function getEditorContentFromSelection(surface = document.getElementById('learning-editor-surface')) {
        const selection = window.getSelection();
        if (!surface || !selection?.rangeCount) return null;
        let anchor = selection.anchorNode;
        if (anchor?.nodeType === Node.TEXT_NODE) anchor = anchor.parentElement;
        const content = anchor?.closest?.('[data-learning-line-content]');
        return content && surface.contains(content) ? content : null;
    }

    function getCaretTextOffset(content) {
        const selection = window.getSelection();
        if (!content || !selection?.rangeCount || !content.contains(selection.anchorNode)) return 0;
        const before = document.createRange();
        before.selectNodeContents(content);
        before.setEnd(selection.anchorNode, selection.anchorOffset);
        return before.toString().length;
    }

    function placeCaretAtTextOffset(content, requestedOffset, extend = false) {
        if (!content) return;
        const surface = content.closest('#learning-editor-surface');
        surface?.focus({ preventScroll: true });
        const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
        let remaining = Math.max(0, requestedOffset);
        let node = walker.nextNode();
        while (node && remaining > node.nodeValue.length) {
            remaining -= node.nodeValue.length;
            node = walker.nextNode();
        }
        if (!node) { placeCaret(content, true); return; }
        const selection = window.getSelection();
        const offset = Math.min(remaining, node.nodeValue.length);
        if (extend && selection?.rangeCount && selection.extend) {
            selection.extend(node, offset);
            return;
        }
        const range = document.createRange();
        range.setStart(node, offset);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    function moveEditorLineVertically(content, direction, extend = false) {
        const line = content?.closest('[data-learning-line]');
        const targetLine = direction < 0 ? line?.previousElementSibling : line?.nextElementSibling;
        const targetContent = targetLine?.querySelector('[data-learning-line-content]');
        if (!targetContent) return false;
        placeCaretAtTextOffset(targetContent, getCaretTextOffset(content), extend);
        return true;
    }

    function moveEditorLineHorizontally(content, direction, extend = false) {
        const line = content?.closest('[data-learning-line]');
        const offset = getCaretTextOffset(content);
        const length = content?.textContent?.length || 0;
        if (direction < 0 && offset === 0) {
            const previous = line?.previousElementSibling?.querySelector('[data-learning-line-content]');
            if (previous) { placeCaretAtTextOffset(previous, previous.textContent.length, extend); return true; }
        }
        if (direction > 0 && offset === length) {
            const next = line?.nextElementSibling?.querySelector('[data-learning-line-content]');
            if (next) { placeCaretAtTextOffset(next, 0, extend); return true; }
        }
        return false;
    }

    function focusLearningDetailEditor(target) {
        const surface = document.getElementById('learning-editor-surface');
        if (!surface) return false;
        const selectedLine = target?.closest?.('[data-learning-line]');
        let content = selectedLine?.querySelector('[data-learning-line-content]')
            || surface.querySelector('[data-learning-line]:last-child [data-learning-line-content]');
        if (!content) {
            surface.innerHTML = renderEditorSurface('');
            content = surface.querySelector('[data-learning-line-content]');
        }
        placeCaret(content, true);
        return true;
    }

    function createLineAfter(line) {
        const next = document.createElement('div');
        next.dataset.learningLine = '';
        next.dataset.learningIndent = line.dataset.learningIndent || '0';
        next.dataset.learningPrefix = '';
        next.dataset.learningBlock = 'body';
        next.className = 'flex min-h-6 items-center gap-2';
        next.style.paddingLeft = line.style.paddingLeft || '0px';
        const content = document.createElement('span');
        content.dataset.learningLineContent = '';
        content.className = getLearningContentClass('body');
        next.appendChild(content);
        line.after(next);
        return content;
    }

    function splitEditorLine(content) {
        const line = content.closest('[data-learning-line]');
        const selection = window.getSelection();
        if (!line || !selection?.rangeCount) return;
        const range = selection.getRangeAt(0);
        if (!content.contains(range.startContainer)) return;
        if (!range.collapsed && content.contains(range.endContainer)) range.deleteContents();
        const tail = document.createRange();
        tail.setStart(range.startContainer, range.startOffset);
        tail.setEnd(content, content.childNodes.length);
        const fragment = tail.extractContents();
        const nextContent = createLineAfter(line);
        nextContent.appendChild(fragment);
        placeCaret(nextContent);
        syncEditorSource();
        queueAutosave();
    }

    function mergeEditorLineBackward(content) {
        const line = content.closest('[data-learning-line]');
        const previous = line?.previousElementSibling?.querySelector('[data-learning-line-content]');
        const selection = window.getSelection();
        if (!line || !previous || !selection?.rangeCount || !selection.isCollapsed) return false;
        const before = document.createRange();
        before.selectNodeContents(content);
        before.setEnd(selection.anchorNode, selection.anchorOffset);
        if (before.toString().length) return false;
        const boundary = previous.textContent.length;
        while (content.firstChild) previous.appendChild(content.firstChild);
        line.remove();
        placeCaretAtTextOffset(previous, boundary);
        syncEditorSource();
        queueAutosave();
        return true;
    }

    function mergeEditorLineForward(content) {
        const line = content?.closest('[data-learning-line]');
        const nextLine = line?.nextElementSibling;
        const next = nextLine?.querySelector('[data-learning-line-content]');
        const selection = window.getSelection();
        if (!line || !next || !selection?.rangeCount || !selection.isCollapsed) return false;
        if (getCaretTextOffset(content) !== content.textContent.length) return false;
        const boundary = content.textContent.length;
        while (next.firstChild) content.appendChild(next.firstChild);
        nextLine.remove();
        placeCaretAtTextOffset(content, boundary);
        syncEditorSource();
        queueAutosave();
        return true;
    }

    function splitList(value) {
        return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30);
    }

    function readEditor(entry) {
        return {
            field: String(document.getElementById('learning-field')?.value || entry.field).trim(),
            item: String(document.getElementById('learning-item')?.value || entry.item).trim(),
            chapter: String(document.getElementById('learning-chapter')?.value || entry.chapter).trim(),
            title: String(document.getElementById('learning-title')?.value || entry.title).trim(),
            content: syncEditorSource(),
            tags: splitList(document.getElementById('learning-tags')?.value),
            sourceLinks: splitList(document.getElementById('learning-links')?.value),
        };
    }

    function setAutosaveStatus(state, label) {
        const el = document.getElementById('learning-autosave-status');
        if (!el) return;
        const icon = state === 'saving'
            ? 'fa-rotate animate-spin text-indigo-400'
            : state === 'local'
                ? 'fa-hard-drive text-amber-500'
                : 'fa-circle-check text-emerald-500';
        el.innerHTML = `<i class="fas ${icon} mr-1"></i>${escapeHtml(label)}`;
    }

    function commitLearningDraftLocally() {
        const active = current();
        if (!active || !document.getElementById('learning-editor-surface')) return { valid: false, changed: false, entry: null };
        const next = readEditor(active);
        if (!next.field || !next.item || !next.chapter || !next.title) return { valid: false, changed: false, entry: active };
        const changed = Object.entries(next).some(([key, value]) => JSON.stringify(active[key]) !== JSON.stringify(value));
        if (changed) {
            captureVersion(active);
            const hierarchyChanged = ['field', 'item', 'chapter'].some((key) => active[key] !== next[key]);
            Object.assign(active, next, { updatedAt: now() });
            saveStore({ skipOrdering: !hierarchyChanged });
            updateDirtyId(active.id, true);
        }
        return { valid: true, changed, entry: active };
    }

    function flushLearningDraftBeforeUnload() {
        if (editorInputFrame) cancelAnimationFrame(editorInputFrame);
        editorInputFrame = null;
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
        commitLearningDraftLocally();
    }

    function queueAutosave() {
        const entry = current();
        if (!entry) return;
        clearTimeout(autosaveTimer);
        setAutosaveStatus('saving', '저장 중');
        autosaveTimer = window.setTimeout(async () => {
            autosaveTimer = null;
            const committed = commitLearningDraftLocally();
            if (!committed.valid) {
                setAutosaveStatus('saved', '필수 항목 확인');
                return;
            }
            const savedRemotely = committed.changed ? await persist(committed.entry) : true;
            const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            setAutosaveStatus(savedRemotely ? 'saved' : 'local', savedRemotely ? `자동 저장됨 ${time}` : `이 기기에 저장됨 ${time}`);
        }, 800);
    }

    function applyFormat(kind) {
        const command = kind === 'bold' ? 'bold' : kind === 'underline' ? 'underline' : 'strikeThrough';
        document.getElementById('learning-editor-surface')?.focus();
        document.execCommand(command, false);
        syncEditorSource();
        queueAutosave();
    }

    function applySelectionFontSize(size) {
        const surface = document.getElementById('learning-editor-surface');
        const result = window.NoteEditor.applyFontSize(surface, size);
        if (!result.ok) {
            window.showToast?.('크기를 바꿀 글자를 먼저 선택해주세요.', 'warning');
            return;
        }
        syncEditorSource();
        queueAutosave();
    }

    function getSelectedLearningLines(surface) {
        const lines = Array.from(surface?.children || []).filter((node) => node.matches?.('[data-learning-line]'));
        if (!lines.length) return [];
        const selection = window.getSelection();
        const getLine = (node) => (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest?.('[data-learning-line]');
        const anchorLine = getLine(selection?.anchorNode);
        const focusLine = getLine(selection?.focusNode);
        if (anchorLine && focusLine && surface.contains(anchorLine) && surface.contains(focusLine)) {
            const start = lines.indexOf(anchorLine);
            const end = lines.indexOf(focusLine);
            return lines.slice(Math.min(start, end), Math.max(start, end) + 1);
        }
        const active = getEditorContentFromSelection(surface)?.closest('[data-learning-line]');
        return active ? [active] : [lines[0]];
    }

    function applyLearningBlockStyle(style) {
        const surface = document.getElementById('learning-editor-surface');
        if (!surface || !window.NoteEditor.BLOCK_STYLES[style]) return;
        window.NoteEditor.restoreSelection(surface);
        getSelectedLearningLines(surface).forEach((line) => {
            line.dataset.learningBlock = style;
            const content = line.querySelector(':scope > [data-learning-line-content]');
            if (content) content.className = getLearningContentClass(style);
        });
        syncEditorSource();
        queueAutosave();
    }

    function clearLearningSelectionFormatting() {
        const surface = document.getElementById('learning-editor-surface');
        if (!surface) return;
        window.NoteEditor.restoreSelection(surface);
        const lines = getSelectedLearningLines(surface);
        const clearedInline = window.NoteEditor.clearFormatting(surface);
        lines.forEach((line) => {
            line.dataset.learningBlock = 'body';
            const content = line.querySelector(':scope > [data-learning-line-content]');
            if (content) content.className = getLearningContentClass('body');
        });
        if (!clearedInline && !lines.length) window.showToast?.('서식을 지울 문장이나 글자를 먼저 선택해주세요.', 'warning');
        syncEditorSource();
        queueAutosave();
    }

    function getNoteLinks(content) {
        return [...String(content || '').matchAll(/\[\[([^\]\n]+)\]\]/g)].map((match) => match[1].trim()).filter(Boolean);
    }

    function renderConnectionDock(entry) {
        const outgoing = getNoteLinks(entry.content).map((title) => entries.find((item) => item.title === title)).filter(Boolean);
        const backlinks = entries.filter((item) => item.id !== entry.id && getNoteLinks(item.content).includes(entry.title));
        const noteCards = [...outgoing, ...backlinks.filter((item) => !outgoing.some((out) => out.id === item.id))];
        return `<div class="space-y-4">
            <section><p class="mb-2 text-[10px] font-bold text-gray-400">백링크 · 연결 노트 (${noteCards.length})</p><div class="space-y-1.5">${noteCards.length ? noteCards.map((note) => `<button type="button" data-learning-open="${escapeAttr(note.id)}" class="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-white p-2.5 text-left hover:border-indigo-200"><i class="far fa-note-sticky mt-0.5 text-xs text-indigo-400"></i><span class="min-w-0"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(note.title)}</strong><small class="block truncate text-[9px] text-gray-400">${escapeHtml(note.chapter)} · ${escapeHtml(note.item)}</small></span></button>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-[9px] text-gray-400">연결된 노트가 없습니다.</p>'}</div></section>
            <button type="button" data-learning-add-link class="w-full rounded-md border border-dashed border-indigo-200 px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"><i class="fas fa-plus mr-1"></i>노트 연결 추가</button>
        </div>`;
    }

    function renderVersionsDock(entry) {
        const versions = getVersions(entry.id);
        return `<div class="space-y-1.5">${versions.length ? versions.map((version) => `<details class="rounded-md border border-gray-200 bg-white"><summary class="flex cursor-pointer list-none items-start gap-2 p-2.5"><i class="fas fa-code-compare mt-0.5 text-[10px] text-indigo-400"></i><span class="min-w-0 flex-1"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(version.title || '이전 버전')}</strong><small class="block text-[9px] leading-4 text-gray-400">${new Date(version.createdAt).toLocaleString('ko-KR')}<br>${escapeHtml(version.reason)}</small></span><span class="text-[9px] font-bold text-indigo-500">비교</span></summary><div class="border-t border-gray-100 p-2"><div class="max-h-40 overflow-auto rounded bg-gray-50 font-mono text-[9px] leading-4">${window.NoteEditor.renderLineDiff(version.content, entry.content)}</div><button type="button" data-learning-version-restore="${escapeAttr(version.id)}" class="mt-2 w-full rounded-md bg-indigo-600 px-2 py-1.5 text-[9px] font-bold text-white hover:bg-indigo-700">이 버전 복원</button></div></details>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-8 text-center text-[9px] text-gray-400">아직 저장된 이전 버전이 없습니다.</p>'}</div>`;
    }

    function renderTocDock(entry) {
        const headings = String(entry.content || '').split('\n').map((line, index) => {
            const match = line.match(/^(#{1,3})\s+(.+)$/);
            return match ? { level: match[1].length, title: match[2], index } : null;
        }).filter(Boolean);
        return `<div class="space-y-1">${headings.length ? headings.map((heading) => `<button type="button" data-learning-toc-line="${heading.index}" class="block w-full truncate rounded-md px-2 py-2 text-left text-[10px] text-gray-600 hover:bg-indigo-50 hover:text-indigo-700" style="padding-left:${8 + (heading.level - 1) * 14}px">${escapeHtml(heading.title)}</button>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-8 text-center text-[9px] text-gray-400">목차로 표시할 줄이 없습니다.</p>'}</div>`;
    }

    function renderContextDock(entry) {
        return `<aside class="min-w-0 border-t border-gray-200 bg-white xl:border-l xl:border-t-0">
            <div class="flex h-12 items-center justify-between border-b border-gray-100 px-4"><h3 class="text-xs font-black text-gray-800">컨텍스트 독</h3><i class="fas fa-link text-[10px] text-indigo-400"></i></div>
            <div class="grid grid-cols-3 border-b border-gray-100 px-3 pt-2">${[['links', '연결'], ['versions', '버전'], ['toc', '목차']].map(([key, label]) => `<button type="button" data-learning-dock-tab="${key}" class="border-b-2 px-2 py-2 text-[10px] font-bold ${dockTab === key ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-400 hover:text-gray-700'}">${label}</button>`).join('')}</div>
            <div class="max-h-[calc(100dvh-230px)] overflow-y-auto p-3">${dockTab === 'links' ? renderConnectionDock(entry) : dockTab === 'versions' ? renderVersionsDock(entry) : renderTocDock(entry)}</div>
        </aside>`;
    }

    function renderEditor(entry) {
        if (!entry) return `<div class="col-span-full flex min-h-[560px] flex-col items-center justify-center border border-dashed border-gray-200 bg-white text-center"><span class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><i class="fas fa-book-open-reader"></i></span><h3 class="mt-3 text-sm font-bold text-gray-700">학습 노트를 선택하세요</h3><p class="mt-1 text-xs text-gray-400">분야 → 항목 → Chapter → 노트 순서로 지식을 쌓습니다.</p></div>`;
        return `<main class="min-w-0 bg-white">
            <div class="border-b border-gray-100 px-4 py-3">
                <div class="flex flex-wrap items-center justify-between gap-2"><p class="min-w-0 truncate text-[10px] text-gray-400">${escapeHtml(entry.field)} <i class="fas fa-chevron-right mx-1 text-[7px]"></i> ${escapeHtml(entry.item)} <i class="fas fa-chevron-right mx-1 text-[7px]"></i> ${escapeHtml(entry.chapter)}</p><div class="flex items-center gap-2"><span id="learning-autosave-status" class="text-[9px] text-gray-400"><i class="fas fa-circle-check mr-1 text-emerald-500"></i>자동 저장됨</span>${window.NoteEditor.renderExportToolbar(entry.id)}<button type="button" data-learning-meta-toggle class="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100" title="분야·항목·Chapter·태그 수정" aria-expanded="false"><i class="fas fa-sliders text-[9px]"></i><span>분류 수정</span></button><button type="button" data-learning-pin class="h-7 w-7 rounded-md text-gray-400 hover:bg-indigo-50 hover:text-indigo-600" title="고정"><i class="fas fa-thumbtack text-[10px]"></i></button><button type="button" data-learning-delete class="h-7 w-7 rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="삭제"><i class="fas fa-trash-can text-[10px]"></i></button></div></div>
                <input id="learning-title" value="${escapeAttr(entry.title)}" class="mt-3 w-full border-0 p-0 text-2xl font-black text-gray-900 outline-none focus:ring-0" placeholder="노트 제목">
                <div class="mt-2 flex flex-wrap gap-1.5">${entry.tags.map((tag) => `<span class="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-bold text-indigo-600">${escapeHtml(tag)}</span>`).join('')}<span class="rounded-full bg-gray-50 px-2 py-1 text-[9px] text-gray-400">${escapeHtml(entry.chapter)}</span></div>
                <div data-learning-meta-panel class="mt-3 hidden grid gap-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 sm:grid-cols-3">
                    <label class="text-[9px] font-bold text-gray-500">공부 분야<input id="learning-field" value="${escapeAttr(entry.field)}" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300"></label>
                    <label class="text-[9px] font-bold text-gray-500">공부 항목<input id="learning-item" value="${escapeAttr(entry.item)}" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300"></label>
                    <label class="text-[9px] font-bold text-gray-500">Chapter<input id="learning-chapter" value="${escapeAttr(entry.chapter)}" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300"></label>
                    <label class="text-[9px] font-bold text-gray-500 sm:col-span-2">태그<input id="learning-tags" value="${escapeAttr(entry.tags.join(', '))}" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300" placeholder="반도체, 투자"></label>
                    <label class="text-[9px] font-bold text-gray-500">참고 링크<input id="learning-links" value="${escapeAttr(entry.sourceLinks.join(', '))}" class="mt-1 h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-[10px] outline-none focus:border-indigo-300" placeholder="https://..."></label>
                    <button type="button" data-learning-save class="h-8 rounded-md bg-indigo-600 px-3 text-[10px] font-bold text-white hover:bg-indigo-700 sm:col-span-3"><i class="fas fa-check mr-1"></i>분류 저장</button>
                </div>
            </div>
            <div class="relative border-b border-gray-100">
                <div class="flex flex-wrap items-center gap-1 px-4 py-2">
                    ${window.NoteEditor.renderHistoryToolbar('learning')}
                    <button type="button" data-learning-format="bold" class="h-7 w-7 rounded border border-gray-200 text-xs font-black text-gray-700">B</button><button type="button" data-learning-format="underline" class="h-7 w-7 rounded border border-gray-200 text-xs font-bold text-gray-700 underline">U</button><button type="button" data-learning-format="strike" class="h-7 w-7 rounded border border-gray-200 text-xs font-bold text-gray-700 line-through">S</button>
                    ${window.NoteEditor.renderFontSizeToolbar('learning')}
                    ${window.NoteEditor.renderBlockStyleToolbar('learning')}
                </div>
            </div>
            <section class="bg-white">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 px-5 py-2.5">
                    <div><p class="text-[10px] font-black text-gray-700">상세내역</p><p class="mt-0.5 text-[9px] text-gray-400">본문을 클릭해 바로 수정할 수 있습니다.</p></div>
                    <button type="button" data-learning-detail-save class="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-100 bg-white px-2.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"><i class="fas fa-floppy-disk text-[9px]"></i>본문 저장</button>
                </div>
                <textarea id="learning-content" class="hidden">${escapeHtml(entry.content)}</textarea>
                <div id="learning-editor-surface" data-learning-detail-editor role="textbox" aria-label="노트 상세내역" aria-multiline="true" contenteditable="true" spellcheck="true" style="font-size:14px;line-height:1.4" class="min-h-[calc(100dvh-325px)] cursor-text overflow-y-auto border border-transparent px-5 py-3 outline-none transition focus:border-indigo-200 focus:bg-indigo-50/20">${renderEditorSurface(entry.content)}</div>
            </section>
            <div class="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[9px] text-gray-400"><span>문자 <span id="learning-character-count">${entry.content.length.toLocaleString('ko-KR')}</span></span><span>자동 저장 · Tab 들여쓰기</span></div>
        </main>${renderContextDock(entry)}`;
    }

    function renderTrashDialog() {
        if (!isTrashOpen) return '';
        const trash = readTrash();
        return `<div data-learning-trash-close class="fixed inset-0 z-50 flex items-stretch justify-center bg-gray-950/30 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
            <div data-learning-trash-dialog class="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-lg sm:border sm:border-gray-200" role="dialog" aria-modal="true" aria-label="학습 노트 휴지통">
                <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><p class="text-sm font-black text-gray-900">학습 노트 휴지통</p><p class="mt-0.5 text-[9px] text-gray-400">이 기기에 보관됩니다.</p></div><button type="button" data-learning-trash-close class="h-8 w-8 rounded-md text-gray-400 hover:bg-gray-100" aria-label="학습 노트 휴지통 닫기"><i class="fas fa-xmark"></i></button></div>
                <div class="max-h-[70vh] flex-1 space-y-2 overflow-y-auto p-4">${trash.length ? trash.map(({ entry, deletedAt }) => `<article class="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5"><div class="min-w-0 flex-1"><p class="truncate text-[12px] font-bold text-gray-800">${escapeHtml(entry.title)}</p><p class="mt-0.5 truncate text-[9px] text-gray-400">${escapeHtml(entry.field)} · ${escapeHtml(entry.chapter)} · ${new Date(deletedAt).toLocaleString('ko-KR')}</p></div><button type="button" data-learning-trash-restore="${escapeAttr(entry.id)}" class="rounded-md border border-indigo-100 px-2 py-1.5 text-[9px] font-bold text-indigo-600 hover:bg-indigo-50">복원</button><button type="button" data-learning-trash-purge="${escapeAttr(entry.id)}" class="h-7 w-7 rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-600" aria-label="${escapeAttr(entry.title)} 영구 삭제"><i class="fas fa-trash text-[10px]"></i></button></article>`).join('') : '<div class="rounded-lg border border-dashed border-gray-200 px-4 py-12 text-center text-xs text-gray-400">휴지통이 비어 있습니다.</div>'}</div>
            </div>
        </div>`;
    }

    function renderRecentEntries() {
        const recent = entries.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 5);
        if (!recent.length) return '';
        return `<details class="mt-2 rounded-md border border-gray-100 bg-gray-50/60"><summary class="cursor-pointer list-none px-2.5 py-2 text-[9px] font-black text-gray-500"><i class="fas fa-clock mr-1 text-indigo-400"></i>최근 수정</summary><div class="border-t border-gray-100 p-1">${recent.map((entry) => `<button type="button" data-learning-open="${escapeAttr(entry.id)}" class="block w-full truncate rounded px-2 py-1.5 text-left text-[9px] ${entry.id === activeId ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-gray-500 hover:bg-white hover:text-gray-800'}">${escapeHtml(entry.title)}</button>`).join('')}</div></details>`;
    }

    function render(options = {}) {
        const root = document.getElementById('learning-archive-view');
        if (!root) return;
        const source = filtered();
        const selected = current();
        const trashCount = readTrash().length;
        root.innerHTML = `<div class="overflow-hidden border-y border-gray-200 bg-white xl:grid xl:min-h-[calc(100dvh-128px)] xl:grid-cols-[280px_minmax(520px,1fr)_280px]">
            <aside class="min-w-0 border-b border-gray-200 bg-white p-3 xl:border-b-0 xl:border-r">
                <div class="mb-3 flex items-start justify-between gap-2"><div><p class="text-[9px] font-bold tracking-wider text-indigo-500">LIFE TOOL</p><h2 class="mt-1 text-lg font-black text-gray-900">학습 아카이브</h2></div><div class="flex items-center gap-1"><button type="button" data-learning-trash-toggle class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:text-indigo-600" title="이 기기의 휴지통" aria-label="학습 노트 휴지통"><i class="fas fa-trash-can text-[10px]"></i>${trashCount ? `<span class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-black text-white">${trashCount}</span>` : ''}</button><button type="button" data-learning-new class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm" title="새 학습 노트"><i class="fas fa-plus text-[10px]"></i></button></div></div>
                <div class="grid grid-cols-[minmax(0,1fr)_92px] gap-1.5"><label class="relative block"><i class="fas fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300"></i><input id="learning-search" value="${escapeAttr(searchText)}" class="h-8 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-[10px] outline-none focus:border-indigo-400" placeholder="제목·본문 검색"></label><select id="learning-new-template" class="h-8 min-w-0 rounded-md border border-gray-200 bg-white px-2 text-[9px] font-bold text-gray-500 outline-none" aria-label="새 학습 노트 템플릿"><option value="blank">빈 노트</option><option value="study">학습 정리</option><option value="lecture">강의 노트</option><option value="book">독서 노트</option></select></div>
                ${renderRecentEntries()}
                <div data-learning-tree-list class="mt-3 max-h-[calc(100dvh-235px)] space-y-1 overflow-y-auto pr-1">${renderTree(source)}</div>
                <button type="button" data-learning-new class="mt-3 w-full rounded-md border border-dashed border-indigo-200 px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"><i class="fas fa-plus mr-1"></i>새 노트</button>
            </aside>
            ${renderEditor(selected)}
        </div>${renderTrashDialog()}`;
        saveUiState();
        if (!options.skipRemote) loadRemote();
    }

    function renderTreeOnly() {
        const list = document.querySelector('#learning-archive-view [data-learning-tree-list]');
        if (!list) return;
        const scrollTop = list.scrollTop;
        list.innerHTML = renderTree(filtered());
        list.scrollTop = scrollTop;
        saveUiState();
    }

    function scheduleEditorInputSync() {
        if (editorInputFrame) return;
        editorInputFrame = requestAnimationFrame(() => {
            editorInputFrame = null;
            const value = syncEditorSource();
            if (value !== undefined) queueAutosave();
        });
    }

    async function saveActive(options = {}) {
        const entry = current();
        if (!entry) return false;
        clearTimeout(autosaveTimer);
        const next = readEditor(entry);
        if (!next.field || !next.item || !next.chapter || !next.title) {
            window.showToast?.('분야, 항목, Chapter, 제목을 입력해 주세요.', 'warning');
            return false;
        }
        captureVersion(entry, '수동 저장 전');
        const hierarchyChanged = ['field', 'item', 'chapter'].some((key) => entry[key] !== next[key]);
        Object.assign(entry, next, { updatedAt: now() });
        saveStore({ skipOrdering: !hierarchyChanged });
        const remoteSave = persist(entry);
        if (options.waitForRemote === false) return true;
        const savedRemotely = await remoteSave;
        setAutosaveStatus(savedRemotely ? 'saved' : 'local', savedRemotely ? '서버 저장됨' : '이 기기에 저장됨');
        return true;
    }

    function exportLearningEntry(id, format) {
        const entry = entries.find((item) => item.id === id);
        const surface = document.getElementById('learning-editor-surface');
        if (!entry || !surface || !format) return;
        const content = id === activeId ? syncEditorSource() : entry.content;
        const metadata = `${entry.field} · ${entry.item} · ${entry.chapter} · ${new Date(entry.updatedAt || entry.createdAt).toLocaleString('ko-KR')}`;
        if (format === 'markdown') window.NoteEditor.exportMarkdown(entry.title, content, metadata);
        if (format === 'word') window.NoteEditor.exportWord(entry.title, surface.innerHTML, metadata);
        if (format === 'pdf' && !window.NoteEditor.printNote(entry.title, surface.innerHTML, metadata)) window.showToast?.('인쇄 창을 열 수 없습니다. 팝업 허용을 확인해주세요.', 'warning');
    }

    async function restoreVersion(versionId) {
        const entry = current();
        const version = entry ? getVersions(entry.id).find((item) => item.id === versionId) : null;
        if (!entry || !version) return;
        captureVersion(entry, '버전 복원 전');
        Object.assign(entry, {
            title: version.title,
            content: version.content,
            field: version.field || entry.field,
            item: version.item || entry.item,
            chapter: version.chapter || entry.chapter,
            tags: version.tags || entry.tags,
            sourceLinks: version.sourceLinks || entry.sourceLinks,
            updatedAt: now(),
        });
        saveStore();
        await persist(entry);
        dockTab = 'links';
        render({ skipRemote: true });
        window.showToast?.('선택한 학습 노트 버전을 복원했습니다.', 'info');
    }

    async function restoreLearningEntryFromTrash(id) {
        const trash = readTrash();
        const trashed = trash.find((item) => item.entry.id === id);
        if (!trashed) return;
        if (!entries.some((item) => item.id === id)) entries.unshift(trashed.entry);
        saveTrash(trash.filter((item) => item.entry.id !== id));
        updatePendingDeleteId(id, false);
        activeId = id;
        isTrashOpen = false;
        saveStore();
        render({ skipRemote: true });
        await persist(trashed.entry);
        window.showToast?.('학습 노트를 휴지통에서 복원했습니다.', 'info');
    }

    function purgeLearningEntryFromTrash(id) {
        saveTrash(readTrash().filter((item) => item.entry.id !== id));
        removeVersions(id);
        render({ skipRemote: true });
        window.showToast?.('학습 노트를 휴지통에서 영구 삭제했습니다.', 'info');
    }

    function bindControls() {
        if (bound) return;
        bound = true;
        const root = document.getElementById('learning-archive-view');
        window.addEventListener('beforeunload', flushLearningDraftBeforeUnload);
        window.addEventListener('account-will-change', flushLearningDraftBeforeUnload);
        window.addEventListener('offline', () => setAutosaveStatus('local', '오프라인 · 이 기기에 저장'));
        window.addEventListener('online', () => {
            loaded = false;
            void loadRemote();
        });
        ensureTreeDragStyles();
        root?.addEventListener('pointerdown', (event) => {
            beginEditorSelectionGesture(event);
            const selectionToolbar = event.target.closest('[data-note-font-toolbar], [data-note-block-toolbar]');
            if (selectionToolbar) window.NoteEditor.rememberSelection(document.getElementById('learning-editor-surface'));
            if (event.target.closest('[data-learning-format], [data-note-font-step], [data-note-history], [data-note-clear-format]')) {
                event.preventDefault();
                return;
            }
            beginTreeLongPress(event, root);
        });
        root?.addEventListener('mousedown', (event) => beginTreeLongPress(event, root));
        root?.addEventListener('input', (event) => {
            if (event.target.id === 'learning-search') {
                searchText = event.target.value;
                renderTreeOnly();
                return;
            }
            if (event.target.closest('#learning-editor-surface')) {
                scheduleEditorInputSync();
                return;
            }
            if (['learning-title', 'learning-field', 'learning-item', 'learning-chapter', 'learning-tags', 'learning-links'].includes(event.target.id)) queueAutosave();
        });
        root?.addEventListener('change', (event) => {
            const blockStyle = event.target.closest('[data-note-block-style]');
            if (blockStyle) {
                applyLearningBlockStyle(blockStyle.value);
                return;
            }
            const exportSelect = event.target.closest('[data-note-export]');
            if (exportSelect) {
                exportLearningEntry(exportSelect.dataset.noteExport, exportSelect.value);
                exportSelect.value = '';
                return;
            }
            const input = event.target.closest('[data-note-font-input]');
            if (!input) return;
            const next = window.NoteEditor.clampFontSize(input.value);
            input.value = String(next);
            applySelectionFontSize(next);
        });
        root?.addEventListener('pointerup', (event) => {
            const surface = event.target.closest('#learning-editor-surface');
            if (!surface) return;
            window.NoteEditor.rememberSelection(surface);
            window.NoteEditor.updateToolbarFromSelection(root.querySelector('[data-note-font-toolbar="learning"]'), surface);
            const activeLine = getEditorContentFromSelection(surface)?.closest('[data-learning-line]');
            const blockSelect = root.querySelector('[data-note-block-toolbar="learning"] [data-note-block-style]');
            if (blockSelect && activeLine) blockSelect.value = activeLine.dataset.learningBlock || 'body';
        });
        root?.addEventListener('click', async (event) => {
            if (Date.now() < suppressTreeClickUntil && event.target.closest('[data-learning-tree-node]')) {
                event.preventDefault();
                return;
            }
            const open = event.target.closest('[data-learning-open]');
            if (open) {
                if (current() && open.dataset.learningOpen !== activeId && document.getElementById('learning-editor-surface')) void saveActive({ waitForRemote: false });
                activeId = open.dataset.learningOpen;
                render({ skipRemote: true });
                return;
            }
            if (event.target.closest('[data-learning-new]')) {
                const field = current()?.field || '새 분야';
                const item = current()?.item || '새 항목';
                const chapter = current()?.chapter || 'Chapter 1';
                const templateKey = document.getElementById('learning-new-template')?.value || 'blank';
                const entry = normalize({ field, item, chapter, title: '새 학습 노트', content: window.NoteEditor.getTemplate('learning', templateKey) });
                entries.unshift(entry); activeId = entry.id; saveStore(); render({ skipRemote: true }); document.getElementById('learning-title')?.select(); await persist(entry); return;
            }
            if (event.target.closest('[data-learning-trash-toggle]')) {
                isTrashOpen = true;
                render({ skipRemote: true });
                return;
            }
            const trashRestore = event.target.closest('[data-learning-trash-restore]');
            if (trashRestore) {
                await restoreLearningEntryFromTrash(trashRestore.dataset.learningTrashRestore);
                return;
            }
            const trashPurge = event.target.closest('[data-learning-trash-purge]');
            if (trashPurge) {
                purgeLearningEntryFromTrash(trashPurge.dataset.learningTrashPurge);
                return;
            }
            const trashCloseButton = event.target.closest('button[data-learning-trash-close]');
            const trashCloseBackdrop = event.target.matches('[data-learning-trash-close]')
                && !event.target.closest('[data-learning-trash-dialog]');
            if (trashCloseButton || trashCloseBackdrop) {
                isTrashOpen = false;
                render({ skipRemote: true });
                return;
            }
            const entry = current();
            if (!entry) return;
            const detailSurface = event.target.closest('#learning-editor-surface');
            if (detailSurface && !event.target.closest('[data-learning-note-link]')) {
                focusLearningDetailEditorAtPoint(event);
                return;
            }
            const historyButton = event.target.closest('[data-note-history]');
            if (historyButton) {
                const surface = document.getElementById('learning-editor-surface');
                window.NoteEditor.applyHistory(surface, historyButton.dataset.noteHistory);
                syncEditorSource();
                queueAutosave();
                return;
            }
            const format = event.target.closest('[data-learning-format]');
            if (format) { applyFormat(format.dataset.learningFormat); return; }
            const fontStep = event.target.closest('[data-note-font-step]');
            if (fontStep) {
                const toolbar = fontStep.closest('[data-note-font-toolbar]');
                const input = toolbar?.querySelector('[data-note-font-input]');
                const next = window.NoteEditor.clampFontSize(Number(input?.value || 14) + Number(fontStep.dataset.noteFontStep || 0));
                if (input) input.value = String(next);
                applySelectionFontSize(next);
                return;
            }
            const clearFormat = event.target.closest('[data-note-clear-format]');
            if (clearFormat) {
                clearLearningSelectionFormatting();
                return;
            }
            const dock = event.target.closest('[data-learning-dock-tab]');
            if (dock) { dockTab = dock.dataset.learningDockTab; render({ skipRemote: true }); return; }
            if (event.target.closest('[data-learning-meta-toggle]')) {
                const panel = document.querySelector('[data-learning-meta-panel]');
                const button = event.target.closest('[data-learning-meta-toggle]');
                const willOpen = panel?.classList.contains('hidden');
                panel?.classList.toggle('hidden', !willOpen);
                button?.setAttribute('aria-expanded', String(Boolean(willOpen)));
                if (willOpen) requestAnimationFrame(() => document.getElementById('learning-title')?.focus());
                return;
            }
            if (event.target.closest('[data-learning-save]')) {
                if (await saveActive()) {
                    render({ skipRemote: true });
                    window.showToast?.('학습 노트 분류 정보를 저장했습니다.', 'info');
                }
                return;
            }
            if (event.target.closest('[data-learning-detail-save]')) {
                if (await saveActive()) {
                    render({ skipRemote: true });
                    window.showToast?.('학습 노트 상세내역을 저장했습니다.', 'info');
                }
                return;
            }
            const restore = event.target.closest('[data-learning-version-restore]');
            if (restore) { await restoreVersion(restore.dataset.learningVersionRestore); return; }
            const toc = event.target.closest('[data-learning-toc-line]');
            if (toc) { document.querySelector(`[data-learning-line-index="${CSS.escape(toc.dataset.learningTocLine)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
            if (event.target.closest('[data-learning-add-link]')) {
                const title = window.prompt('연결할 학습 노트 제목을 입력하세요.');
                const target = entries.find((item) => item.title === String(title || '').trim());
                if (!target) { window.showToast?.('일치하는 학습 노트를 찾지 못했습니다.', 'warning'); return; }
                const source = document.getElementById('learning-content');
                source.value = `${syncEditorSource()}${source.value ? '\n' : ''}[[${target.title}]]`;
                document.getElementById('learning-editor-surface').innerHTML = renderEditorSurface(source.value);
                updateEditorCharacterCount(source.value);
                queueAutosave();
                return;
            }
            if (event.target.closest('[data-learning-pin]')) { entry.pinned = !entry.pinned; entry.updatedAt = now(); saveStore({ skipOrdering: true }); render({ skipRemote: true }); await persist(entry); return; }
            if (event.target.closest('[data-learning-delete]')) {
                if (!window.confirm('이 학습 노트를 삭제할까요?')) return;
                const trash = readTrash();
                saveTrash([{ entry, deletedAt: now() }, ...trash.filter((item) => item.entry.id !== entry.id)]);
                updateDirtyId(entry.id, false);
                updatePendingDeleteId(entry.id, true);
                entries = entries.filter((item) => item.id !== entry.id); activeId = entries[0]?.id || null; saveStore(); render({ skipRemote: true }); await removeRemote(entry.id); window.showToast?.('학습 노트를 휴지통으로 이동했습니다.', 'info'); return;
            }
        });
        document.addEventListener('pointermove', (event) => {
            updateEditorSelectionGesture(event);
            updateTreeLongPress(event, root);
        });
        document.addEventListener('pointerup', (event) => {
            finishEditorSelectionGesture(event);
            finishTreeLongPress(event, root);
        });
        document.addEventListener('pointercancel', (event) => {
            editorSelectionGesture = null;
            preservedEditorSelection = null;
            finishTreeLongPress(event, root, true);
        });
        document.addEventListener('mousemove', (event) => updateTreeLongPress(event, root));
        document.addEventListener('mouseup', (event) => finishTreeLongPress(event, root));
        root?.addEventListener('contextmenu', (event) => {
            if ((pendingTreePress || longPressDrag) && event.target.closest('[data-learning-tree-node]')) event.preventDefault();
        });
        root?.addEventListener('keydown', (event) => {
            if (event.isComposing || event.keyCode === 229) return;
            const fontInput = event.target.closest?.('[data-note-font-input]');
            if (fontInput && event.key === 'Enter') {
                event.preventDefault();
                const next = window.NoteEditor.clampFontSize(fontInput.value);
                fontInput.value = String(next);
                applySelectionFontSize(next);
                return;
            }
            const reorderTarget = event.target.closest?.('[data-learning-reorder-target]');
            if (reorderTarget && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                moveTreeNodeWithKeyboard(root, reorderTarget.closest('[data-learning-tree-node]'), event.key === 'ArrowUp' ? -1 : 1);
                return;
            }
            const surface = event.target.closest?.('#learning-editor-surface');
            const content = getEditorContentFromSelection(surface) || event.target.closest?.('[data-learning-line-content]');
            if (!content) return;
            const line = content.closest('[data-learning-line]');
            if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
                if (moveEditorLineVertically(content, event.key === 'ArrowUp' ? -1 : 1, event.shiftKey)) event.preventDefault();
                return;
            }
            if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
                if (moveEditorLineHorizontally(content, event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey)) event.preventDefault();
                return;
            }
            if (['Home', 'End'].includes(event.key) && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                placeCaretAtTextOffset(content, event.key === 'Home' ? 0 : content.textContent.length, event.shiftKey);
                return;
            }
            if (event.key === 'Tab') {
                event.preventDefault();
                const currentIndent = Math.max(0, Number(line.dataset.learningIndent) || 0);
                const next = event.shiftKey ? Math.max(0, currentIndent - 3) : Math.min(30, currentIndent + 3);
                line.dataset.learningIndent = String(next);
                line.style.paddingLeft = `${Math.floor(next / 3) * 20}px`;
                syncEditorSource(); queueAutosave();
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                splitEditorLine(content);
                return;
            }
            if (event.key === 'Backspace' && mergeEditorLineBackward(content)) {
                event.preventDefault();
                return;
            }
            if (event.key === 'Delete' && mergeEditorLineForward(content)) {
                event.preventDefault();
                return;
            }
        });
        window.addEventListener('pagehide', () => {
            clearTimeout(autosaveTimer);
            if (current() && document.getElementById('learning-editor-surface')) saveActive();
        });
    }

    readUiState();
    entries = readStore();
    if (activeId && !entries.some((entry) => entry.id === activeId)) activeId = null;
    window.RecordSync.register(TABLE_NAME, {
        snapshot(id) {
            if (activeId === id) flushLearningDraftBeforeUnload();
            const entry = entries.find(item => item.id === id);
            return entry ? toRow(entry) : null;
        },
        adopt(id, row) {
            entries = entries.filter(item => item.id !== id);
            if (row) entries.push(normalize(row));
            saveStore();
            updateDirtyId(id, false);
            updatePendingDeleteId(id, false);
            saveTrash(readTrash().filter(item => item.entry.id !== id));
            if (!row && activeId === id) activeId = null;
            render({ skipRemote: true });
        },
    });
    window.LearningArchiveFeature = { render, bindControls, refresh: () => { loaded = false; return loadRemote(); } };
})(window);
