(function (window) {
    const STORAGE_KEY = 'netvisualizer.learning.archive.v1';
    const VERSION_KEY = 'netvisualizer.learning.archive.versions.v1';
    const UI_KEY = 'netvisualizer.learning.archive.ui.v1';
    const TABLE_NAME = 'learning_archive_notes';
    const BLOCKS = Object.freeze({
        heading: { label: '제목', hint: 'H1, H2, H3', icon: 'fa-heading', lines: ['## 제목'] },
        checkbox: { label: '체크박스', hint: '학습 체크리스트', icon: 'fa-square-check', lines: ['- [ ] 체크 항목'] },
        callout: { label: '강조', hint: '핵심 포인트', icon: 'fa-lightbulb', lines: ['> [!NOTE] 핵심 내용'] },
        divider: { label: '구분선', hint: '내용 구분', icon: 'fa-minus', lines: ['---'] },
        table: { label: '표', hint: '비교표 삽입', icon: 'fa-table-cells', lines: ['| 항목 | 내용 |', '| --- | --- |', '|  |  |'] },
    });

    let entries = [];
    let activeId = null;
    let searchText = '';
    let dockTab = 'links';
    let bound = false;
    let loaded = false;
    let autosaveTimer = null;
    let pendingTreePress = null;
    let longPressDrag = null;
    let suppressTreeClickUntil = 0;
    let remoteSupportsOrdering = true;
    const LONG_PRESS_DELAY_MS = 480;
    const LONG_PRESS_CANCEL_DISTANCE = 8;

    const escapeHtml = (value) => window.AppUtils.escapeHtml(value);
    const escapeAttr = (value) => window.AppUtils.escapeAttr(value);
    const createId = () => (window.crypto?.randomUUID?.() || `learning-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const now = () => new Date().toISOString();

    function readUiState() {
        try {
            const value = JSON.parse(localStorage.getItem(UI_KEY) || '{}');
            activeId = typeof value.activeId === 'string' ? value.activeId : null;
            dockTab = ['links', 'versions', 'toc'].includes(value.dockTab) ? value.dockTab : 'links';
        } catch (_error) { /* use defaults */ }
    }

    function saveUiState() {
        localStorage.setItem(UI_KEY, JSON.stringify({ activeId, dockTab, savedAt: now() }));
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
        try { return (JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') || []).map(normalize).filter(Boolean); }
        catch (error) { console.warn('Learning archive storage parse failed.', error); return []; }
    }

    function orderNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER;
    }

    function orderedNames(source, key, orderKey) {
        const firstIndex = new Map();
        source.forEach((entry, index) => {
            if (!firstIndex.has(entry[key])) firstIndex.set(entry[key], index);
        });
        return [...new Set(source.map((entry) => entry[key]).filter(Boolean))].sort((a, b) => {
            const aOrder = Math.min(...source.filter((entry) => entry[key] === a).map((entry) => orderNumber(entry[orderKey])));
            const bOrder = Math.min(...source.filter((entry) => entry[key] === b).map((entry) => orderNumber(entry[orderKey])));
            return aOrder - bOrder || firstIndex.get(a) - firstIndex.get(b) || a.localeCompare(b, 'ko');
        });
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

    function saveStore() {
        ensureOrdering(entries);
        entries.sort(compareEntries);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    }

    function readVersions() {
        try {
            const value = JSON.parse(localStorage.getItem(VERSION_KEY) || '{}');
            return value && typeof value === 'object' ? value : {};
        } catch (_error) { return {}; }
    }

    function getVersions(entryId) {
        const store = readVersions();
        return Array.isArray(store[entryId]) ? store[entryId] : [];
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
        localStorage.setItem(VERSION_KEY, JSON.stringify(store));
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
        const client = getClient();
        if (!client) return;
        let { error } = await client.from(TABLE_NAME).upsert(toRow(entry), { onConflict: 'id' });
        if (error && remoteSupportsOrdering && (String(error.code || '') === 'PGRST204' || /(?:field|item|chapter|display)_order/i.test(String(error.message || '')))) {
            remoteSupportsOrdering = false;
            ({ error } = await client.from(TABLE_NAME).upsert(toRow(entry, false), { onConflict: 'id' }));
        }
        if (error && !['42P01', 'PGRST204', 'PGRST205'].includes(String(error.code || ''))) console.warn('Learning archive sync failed.', error);
    }

    async function persistMany(source) {
        await Promise.all(source.map((entry) => persist(entry)));
    }

    async function removeRemote(id) {
        const client = getClient();
        if (!client) return;
        const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
        if (error && !['42P01', 'PGRST204', 'PGRST205'].includes(String(error.code || ''))) console.warn('Learning archive delete failed.', error);
    }

    async function loadRemote() {
        if (loaded) return;
        loaded = true;
        const client = getClient();
        if (!client) return;
        const orderedColumns = 'id,field_name,item_name,chapter_name,title,content,source_links,tags,is_pinned,field_order,item_order,chapter_order,display_order,created_at,updated_at';
        const legacyColumns = 'id,field_name,item_name,chapter_name,title,content,source_links,tags,is_pinned,created_at,updated_at';
        let { data, error } = await client.from(TABLE_NAME).select(orderedColumns);
        if (error && (String(error.code || '') === 'PGRST204' || /(?:field|item|chapter|display)_order/i.test(String(error.message || '')))) {
            remoteSupportsOrdering = false;
            ({ data, error } = await client.from(TABLE_NAME).select(legacyColumns).order('updated_at', { ascending: false }));
        }
        if (error) return;
        const remote = (data || []).map(normalize).filter(Boolean);
        if (remote.length || entries.length === 0) {
            entries = remote;
            if (activeId && !entries.some((entry) => entry.id === activeId)) activeId = null;
            saveStore();
            render({ skipRemote: true });
        }
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
        if (!fields.length) return '<div class="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-xs text-gray-400">첫 학습 노트를 만들어보세요.</div>';
        return fields.map((field) => {
            const fieldEntries = source.filter((entry) => entry.field === field);
            const items = orderedNames(fieldEntries, 'item', 'itemOrder');
            return `<details open data-learning-tree-node data-learning-level="field" data-learning-field="${escapeAttr(field)}" class="group/field rounded-md">
                <summary data-learning-reorder-target title="길게 눌러 분야 순서 변경" class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-xs font-black text-gray-800 transition hover:bg-gray-50"><i class="fas fa-chevron-right w-2 text-[8px] text-gray-300 transition group-open/field:rotate-90"></i><i class="far fa-folder text-indigo-400"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(field)}</span><span class="text-[9px] font-medium text-gray-400">${fieldEntries.length}</span></summary>
                <div class="ml-3 border-l border-gray-100 pl-2">${items.map((item) => {
                    const itemEntries = fieldEntries.filter((entry) => entry.item === item);
                    const chapters = orderedNames(itemEntries, 'chapter', 'chapterOrder');
                    return `<details open data-learning-tree-node data-learning-level="item" data-learning-field="${escapeAttr(field)}" data-learning-item="${escapeAttr(item)}" class="group/item rounded-md">
                        <summary data-learning-reorder-target title="길게 눌러 항목 순서 변경" class="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-bold text-gray-700 transition hover:bg-gray-50"><i class="fas fa-chevron-right w-2 text-[8px] text-gray-300 transition group-open/item:rotate-90"></i><i class="far fa-folder-open text-sky-400"></i><span class="min-w-0 flex-1 truncate">${escapeHtml(item)}</span><span class="text-[9px] font-medium text-gray-400">${itemEntries.length}</span></summary>
                        <div class="ml-3 border-l border-gray-100 pl-2">${chapters.map((chapter) => {
                            const chapterEntries = itemEntries.filter((entry) => entry.chapter === chapter).sort(compareEntries);
                            return `<details open data-learning-tree-node data-learning-level="chapter" data-learning-field="${escapeAttr(field)}" data-learning-item="${escapeAttr(item)}" data-learning-chapter="${escapeAttr(chapter)}" class="group/chapter rounded-md">
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

    function clearTreeDragState(root) {
        document.body.classList.remove('select-none');
        root?.querySelectorAll('[data-learning-tree-node]').forEach((node) => {
            node.removeAttribute('data-learning-drop-position');
            node.removeAttribute('data-learning-dragging');
            const surface = node.querySelector(':scope > [data-learning-reorder-target]');
            surface?.classList.remove('ring-2', 'ring-indigo-300', 'ring-indigo-400', 'ring-offset-1', 'bg-indigo-50', 'opacity-70', 'cursor-grabbing');
        });
    }

    function cancelPendingTreePress() {
        if (!pendingTreePress) return;
        clearTimeout(pendingTreePress.timer);
        pendingTreePress = null;
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
            startX: event.clientX,
            startY: event.clientY,
            timer: null,
        };
        pending.timer = window.setTimeout(() => {
            if (pendingTreePress !== pending) return;
            pendingTreePress = null;
            longPressDrag = { ...pending, targetNode: null, position: 'before' };
            node.dataset.learningDragging = 'true';
            surface.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-50', 'opacity-70', 'cursor-grabbing');
            document.body.classList.add('select-none');
        }, LONG_PRESS_DELAY_MS);
        pendingTreePress = pending;
    }

    function updateTreeLongPress(event, root) {
        if (pendingTreePress) {
            const distance = Math.hypot(event.clientX - pendingTreePress.startX, event.clientY - pendingTreePress.startY);
            if (distance > LONG_PRESS_CANCEL_DISTANCE) cancelPendingTreePress();
        }
        if (!longPressDrag || (event.pointerId ?? 'mouse') !== longPressDrag.pointerId) return;
        event.preventDefault();
        root.querySelectorAll('[data-learning-drop-position]').forEach((node) => {
            node.removeAttribute('data-learning-drop-position');
            node.querySelector(':scope > [data-learning-reorder-target]')?.classList.remove('ring-2', 'ring-indigo-300', 'ring-offset-1');
        });
        const targetNode = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-learning-tree-node]');
        const sourceDescriptor = describeTreeNode(longPressDrag.node);
        const targetDescriptor = describeTreeNode(targetNode);
        if (!targetNode || targetNode === longPressDrag.node || !sameTreeParent(sourceDescriptor, targetDescriptor)) {
            longPressDrag.targetNode = null;
            return;
        }
        const targetSurface = targetNode.querySelector(':scope > [data-learning-reorder-target]');
        const rect = targetSurface?.getBoundingClientRect();
        if (!rect) return;
        const position = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
        targetNode.dataset.learningDropPosition = position;
        targetSurface.classList.add('ring-2', 'ring-indigo-300', 'ring-offset-1');
        longPressDrag.targetNode = targetNode;
        longPressDrag.position = position;
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
        clearTreeDragState(root);
        if (!cancelled && completed.targetNode) await reorderTreeNode(completed.node, completed.targetNode, completed.position);
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
        saveStore();
        render({ skipRemote: true });
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
        return escapeHtml(String(value || ''))
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\+\+([^+\n]+)\+\+/g, '<u>$1</u>')
            .replace(/~~([^~\n]+)~~/g, '<s>$1</s>')
            .replace(/\[\[([^\]\n]+)\]\]/g, '<span data-learning-note-link="$1" contenteditable="false" class="rounded bg-indigo-50 px-1 py-0.5 font-semibold text-indigo-700">$1</span>');
    }

    function renderEditorLine(line, index) {
        const checkbox = String(line || '').match(/^( *)- \[([ xX])\]\s?(.*)$/);
        const indent = checkbox ? checkbox[1].length : (String(line || '').match(/^ */)?.[0]?.length || 0);
        const checked = checkbox?.[2]?.toLowerCase() === 'x';
        let content = checkbox ? checkbox[3] : String(line || '').slice(indent);
        let prefix = '';
        let block = checkbox ? 'checkbox' : 'paragraph';
        const heading = !checkbox && content.match(/^(#{1,3})\s+(.*)$/);
        const callout = !checkbox && content.match(/^> \[!NOTE\]\s?(.*)$/i);
        if (heading) { prefix = `${heading[1]} `; content = heading[2]; block = `heading-${heading[1].length}`; }
        else if (callout) { prefix = '> [!NOTE] '; content = callout[1]; block = 'callout'; }
        else if (!checkbox && content.trim() === '---') { prefix = '---'; content = ''; block = 'divider'; }
        else if (!checkbox && /^\|.*\|$/.test(content.trim())) block = 'table';
        const shellClass = block === 'callout' ? 'my-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2' : block === 'divider' ? 'my-3 min-h-5 border-t border-gray-200' : block === 'table' ? 'min-h-8 border-x border-b border-gray-200 bg-gray-50 px-2 font-mono' : '';
        const contentClass = block.startsWith('heading-') ? `${block === 'heading-1' ? 'text-2xl' : block === 'heading-2' ? 'text-xl' : 'text-lg'} font-black text-gray-900` : block === 'callout' ? 'font-medium text-amber-900' : block === 'divider' ? 'text-transparent' : block === 'table' ? 'text-xs text-gray-600' : checked ? 'text-gray-400 line-through' : 'text-gray-700';
        return `<div data-learning-line data-learning-indent="${indent}" data-learning-prefix="${escapeAttr(prefix)}" data-learning-block="${escapeAttr(block)}" data-learning-line-index="${index}" class="flex min-h-8 items-center gap-2 ${shellClass}" style="padding-left:${Math.floor(indent / 3) * 20}px">
            ${checkbox ? `<input type="checkbox" data-learning-checkbox class="m-0 h-3 w-3 shrink-0 rounded-sm border-gray-300 accent-indigo-600" ${checked ? 'checked' : ''}>` : ''}
            ${block === 'callout' ? '<i class="fas fa-lightbulb self-start pt-1.5 text-xs text-amber-500" contenteditable="false"></i>' : ''}
            <span data-learning-line-content contenteditable="true" spellcheck="true" data-placeholder="${index === 0 ? '개념, 핵심 요약, 질문을 적어보세요.' : ''}" class="min-w-0 flex-1 break-words py-1 leading-7 outline-none ${contentClass}">${formatInline(content)}</span>
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
            const checkbox = line.querySelector(':scope > [data-learning-checkbox]');
            const prefix = line.dataset.learningPrefix || '';
            const content = serializeInline(line.querySelector(':scope > [data-learning-line-content]'));
            return `${' '.repeat(indent)}${checkbox ? `- [${checkbox.checked ? 'x' : ' '}] ` : prefix}${content}`;
        }).join('\n');
        return source.value;
    }

    function placeCaret(content, atEnd = false) {
        if (!content) return;
        content.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(content);
        range.collapse(!atEnd);
        selection?.removeAllRanges();
        selection?.addRange(range);
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
        next.dataset.learningBlock = 'paragraph';
        next.className = 'flex min-h-8 items-center gap-2';
        next.style.paddingLeft = line.style.paddingLeft || '0px';
        const content = document.createElement('span');
        content.dataset.learningLineContent = '';
        content.contentEditable = 'true';
        content.spellcheck = true;
        content.className = 'min-w-0 flex-1 break-words py-1 leading-7 outline-none text-gray-700';
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
        const boundary = previous.childNodes.length;
        while (content.firstChild) previous.appendChild(content.firstChild);
        line.remove();
        const range = document.createRange();
        range.setStart(previous, boundary);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        previous.focus();
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
        const icon = state === 'saving' ? 'fa-rotate animate-spin text-indigo-400' : 'fa-circle-check text-emerald-500';
        el.innerHTML = `<i class="fas ${icon} mr-1"></i>${escapeHtml(label)}`;
    }

    function queueAutosave() {
        const entry = current();
        if (!entry) return;
        clearTimeout(autosaveTimer);
        setAutosaveStatus('saving', '저장 중');
        autosaveTimer = window.setTimeout(async () => {
            const active = current();
            if (!active) return;
            const next = readEditor(active);
            if (!next.field || !next.item || !next.chapter || !next.title) {
                setAutosaveStatus('saved', '필수 항목 확인');
                return;
            }
            const changed = Object.entries(next).some(([key, value]) => JSON.stringify(active[key]) !== JSON.stringify(value));
            if (changed) {
                captureVersion(active);
                Object.assign(active, next, { updatedAt: now() });
                saveStore();
                await persist(active);
            }
            const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            setAutosaveStatus('saved', `자동 저장됨 ${time}`);
        }, 800);
    }

    function getSelectedText() {
        const surface = document.getElementById('learning-editor-surface');
        const selection = window.getSelection();
        if (!surface) return '';
        if (selection?.rangeCount && surface.contains(selection.anchorNode) && surface.contains(selection.focusNode)) {
            const selected = selection.toString().trim();
            if (selected) return selected;
        }
        const line = selection?.anchorNode?.parentElement?.closest?.('[data-learning-line]') || surface.querySelector('[data-learning-line]');
        return serializeInline(line?.querySelector('[data-learning-line-content]')).trim();
    }

    function applyFormat(kind) {
        const command = kind === 'bold' ? 'bold' : kind === 'underline' ? 'underline' : 'strikeThrough';
        document.getElementById('learning-editor-surface')?.focus();
        document.execCommand(command, false);
        syncEditorSource();
        queueAutosave();
    }

    function applyBlock(kind) {
        const block = BLOCKS[kind];
        const surface = document.getElementById('learning-editor-surface');
        const source = document.getElementById('learning-content');
        if (!block || !surface || !source) return;
        syncEditorSource();
        const selectedLine = window.getSelection()?.anchorNode?.parentElement?.closest?.('[data-learning-line]');
        const index = Math.max(0, Array.from(surface.children).indexOf(selectedLine));
        const currentText = serializeInline(selectedLine?.querySelector('[data-learning-line-content]')).trim();
        const reusableText = currentText && currentText !== '/' ? currentText : '';
        const blockLines = reusableText && ['heading', 'checkbox', 'callout'].includes(kind)
            ? [kind === 'heading' ? `## ${reusableText}` : kind === 'checkbox' ? `- [ ] ${reusableText}` : `> [!NOTE] ${reusableText}`]
            : block.lines;
        const lines = source.value.split('\n');
        lines.splice(index, 1, ...blockLines);
        source.value = lines.join('\n');
        surface.innerHTML = renderEditorSurface(source.value);
        document.querySelector('[data-learning-block-menu]')?.classList.add('hidden');
        queueAutosave();
    }

    function keywordSet(entry) {
        return new Set([entry.title, entry.field, entry.item, entry.chapter, ...entry.tags]
            .join(' ').toLowerCase().split(/[^0-9a-zA-Z가-힣]+/).filter((word) => word.length > 1));
    }

    function getTodoContext(entry) {
        const tasks = window.ChecklistFeature?.getAllTasks?.() || [];
        const words = keywordSet(entry);
        return tasks.map((task) => {
            const haystack = `${task.title} ${task.note}`.toLowerCase();
            const score = [...words].reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
            return { ...task, score };
        }).filter((task) => task.score > 0).sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 4);
    }

    function getNoteLinks(content) {
        return [...String(content || '').matchAll(/\[\[([^\]\n]+)\]\]/g)].map((match) => match[1].trim()).filter(Boolean);
    }

    function renderConnectionDock(entry) {
        const outgoing = getNoteLinks(entry.content).map((title) => entries.find((item) => item.title === title)).filter(Boolean);
        const backlinks = entries.filter((item) => item.id !== entry.id && getNoteLinks(item.content).includes(entry.title));
        const tasks = getTodoContext(entry);
        const steps = tasks.flatMap((task) => task.steps.filter((step) => keywordSet(entry).has(step.title.toLowerCase()) || [...keywordSet(entry)].some((word) => step.title.toLowerCase().includes(word))).map((step) => ({ ...step, task })) ).slice(0, 3);
        const reports = tasks.flatMap((task) => task.reportFiles.filter((file) => /^https?:\/\//i.test(String(file.url || ''))).map((file) => ({ ...file, task }))).slice(0, 3);
        const noteCards = [...outgoing, ...backlinks.filter((item) => !outgoing.some((out) => out.id === item.id))];
        return `<div class="space-y-4">
            <section><p class="mb-2 text-[10px] font-bold text-gray-400">백링크 · 연결 노트 (${noteCards.length})</p><div class="space-y-1.5">${noteCards.length ? noteCards.map((note) => `<button type="button" data-learning-open="${escapeAttr(note.id)}" class="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-white p-2.5 text-left hover:border-indigo-200"><i class="far fa-note-sticky mt-0.5 text-xs text-indigo-400"></i><span class="min-w-0"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(note.title)}</strong><small class="block truncate text-[9px] text-gray-400">${escapeHtml(note.chapter)} · ${escapeHtml(note.item)}</small></span></button>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-[9px] text-gray-400">연결된 노트가 없습니다.</p>'}</div></section>
            <section><p class="mb-2 text-[10px] font-bold text-gray-400">관련 할 일 (${tasks.length})</p><div class="space-y-1.5">${tasks.length ? tasks.map((task) => `<button type="button" data-learning-open-task="${escapeAttr(task.id)}" class="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white p-2.5 text-left hover:border-indigo-200"><span class="h-3 w-3 rounded border ${task.completed ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300'}"></span><span class="min-w-0 flex-1"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(task.title)}</strong><small class="block text-[9px] text-gray-400">${escapeHtml(task.domainLabel)} · ${task.steps.filter((step) => step.done).length}/${task.steps.length} Step</small></span></button>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-4 text-center text-[9px] text-gray-400">키워드가 겹치는 할 일이 없습니다.</p>'}</div></section>
            ${steps.length ? `<section><p class="mb-2 text-[10px] font-bold text-gray-400">관련 Step (${steps.length})</p><div class="space-y-1.5">${steps.map((step) => `<button type="button" data-learning-open-task="${escapeAttr(step.task.id)}" class="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white p-2.5 text-left hover:border-indigo-200"><i class="fas fa-list-ol text-[10px] text-indigo-400"></i><span class="min-w-0"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(step.title)}</strong><small class="block truncate text-[9px] text-gray-400">${escapeHtml(step.task.title)}</small></span></button>`).join('')}</div></section>` : ''}
            ${reports.length ? `<section><p class="mb-2 text-[10px] font-bold text-gray-400">연결된 Report (${reports.length})</p><div class="space-y-1.5">${reports.map((report) => `<a href="${escapeAttr(report.url)}" target="_blank" rel="noopener noreferrer" class="flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white p-2.5 hover:border-indigo-200"><i class="fas fa-file-powerpoint text-xs text-orange-500"></i><span class="min-w-0"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(report.name || 'Report 링크')}</strong><small class="block truncate text-[9px] text-gray-400">${escapeHtml(report.task.title)}</small></span></a>`).join('')}</div></section>` : ''}
            <button type="button" data-learning-add-link class="w-full rounded-md border border-dashed border-indigo-200 px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"><i class="fas fa-plus mr-1"></i>노트 연결 추가</button>
        </div>`;
    }

    function renderVersionsDock(entry) {
        const versions = getVersions(entry.id);
        return `<div class="space-y-1.5">${versions.length ? versions.map((version) => `<button type="button" data-learning-version-restore="${escapeAttr(version.id)}" class="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-white p-2.5 text-left hover:border-indigo-200"><i class="fas fa-clock-rotate-left mt-0.5 text-[10px] text-indigo-400"></i><span class="min-w-0"><strong class="block truncate text-[10px] text-gray-700">${escapeHtml(version.title || '이전 버전')}</strong><small class="block text-[9px] leading-4 text-gray-400">${new Date(version.createdAt).toLocaleString('ko-KR')}<br>${escapeHtml(version.reason)}</small></span></button>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-8 text-center text-[9px] text-gray-400">아직 저장된 이전 버전이 없습니다.</p>'}</div>`;
    }

    function renderTocDock(entry) {
        const headings = String(entry.content || '').split('\n').map((line, index) => {
            const match = line.match(/^(#{1,3})\s+(.+)$/);
            return match ? { level: match[1].length, title: match[2], index } : null;
        }).filter(Boolean);
        return `<div class="space-y-1">${headings.length ? headings.map((heading) => `<button type="button" data-learning-toc-line="${heading.index}" class="block w-full truncate rounded-md px-2 py-2 text-left text-[10px] text-gray-600 hover:bg-indigo-50 hover:text-indigo-700" style="padding-left:${8 + (heading.level - 1) * 14}px">${escapeHtml(heading.title)}</button>`).join('') : '<p class="rounded-md border border-dashed border-gray-200 px-3 py-8 text-center text-[9px] text-gray-400">제목 블록을 추가하면 목차가 생성됩니다.</p>'}</div>`;
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
                <div class="flex flex-wrap items-center justify-between gap-2"><p class="min-w-0 truncate text-[10px] text-gray-400">${escapeHtml(entry.field)} <i class="fas fa-chevron-right mx-1 text-[7px]"></i> ${escapeHtml(entry.item)} <i class="fas fa-chevron-right mx-1 text-[7px]"></i> ${escapeHtml(entry.chapter)}</p><div class="flex items-center gap-2"><span id="learning-autosave-status" class="text-[9px] text-gray-400"><i class="fas fa-circle-check mr-1 text-emerald-500"></i>자동 저장됨</span><button type="button" data-learning-meta-toggle class="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-100" title="분야·항목·Chapter·태그 수정" aria-expanded="false"><i class="fas fa-sliders text-[9px]"></i><span>분류 수정</span></button><button type="button" data-learning-pin class="h-7 w-7 rounded-md text-gray-400 hover:bg-indigo-50 hover:text-indigo-600" title="고정"><i class="fas fa-thumbtack text-[10px]"></i></button><button type="button" data-learning-delete class="h-7 w-7 rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-600" title="삭제"><i class="fas fa-trash-can text-[10px]"></i></button></div></div>
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
                    <button type="button" data-learning-format="bold" class="h-7 w-7 rounded border border-gray-200 text-xs font-black text-gray-700">B</button><button type="button" data-learning-format="underline" class="h-7 w-7 rounded border border-gray-200 text-xs font-bold text-gray-700 underline">U</button><button type="button" data-learning-format="strike" class="h-7 w-7 rounded border border-gray-200 text-xs font-bold text-gray-700 line-through">S</button>
                    <span class="mx-1 h-5 w-px bg-gray-200"></span><button type="button" data-learning-block-toggle class="inline-flex h-7 items-center gap-1 rounded border border-gray-200 px-2 text-[10px] font-bold text-gray-600"><span class="text-sm">/</span> 블록</button><button type="button" data-learning-convert="task" class="inline-flex h-7 items-center gap-1 rounded border border-gray-200 px-2 text-[10px] font-bold text-gray-600"><i class="fas fa-arrow-up-right-dots text-[9px]"></i>할 일로 전환</button><button type="button" data-learning-convert="step" class="inline-flex h-7 items-center gap-1 rounded border border-gray-200 px-2 text-[10px] font-bold text-gray-600"><i class="fas fa-list-ol text-[9px]"></i>Step으로 전환</button>
                </div>
                <div data-learning-block-menu class="absolute left-4 top-11 z-30 hidden w-56 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl">${Object.entries(BLOCKS).map(([key, block]) => `<button type="button" data-learning-block="${key}" class="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-indigo-50"><span class="flex h-7 w-7 items-center justify-center rounded bg-gray-50 text-gray-500"><i class="fas ${block.icon} text-[10px]"></i></span><span><strong class="block text-[10px] text-gray-800">${block.label}</strong><small class="block text-[9px] text-gray-400">${block.hint}</small></span></button>`).join('')}</div>
            </div>
            <section class="bg-white">
                <div class="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 px-5 py-2.5">
                    <div><p class="text-[10px] font-black text-gray-700">상세내역</p><p class="mt-0.5 text-[9px] text-gray-400">본문을 클릭해 바로 수정할 수 있습니다.</p></div>
                    <button type="button" data-learning-detail-save class="inline-flex h-7 items-center gap-1 rounded-md border border-indigo-100 bg-white px-2.5 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"><i class="fas fa-floppy-disk text-[9px]"></i>본문 저장</button>
                </div>
                <textarea id="learning-content" class="hidden">${escapeHtml(entry.content)}</textarea>
                <div id="learning-editor-surface" data-learning-detail-editor role="textbox" aria-label="노트 상세내역" aria-multiline="true" tabindex="0" class="min-h-[calc(100dvh-325px)] cursor-text overflow-y-auto border border-transparent px-5 py-4 text-sm outline-none transition focus-within:border-indigo-200 focus-within:bg-indigo-50/20">${renderEditorSurface(entry.content)}</div>
            </section>
            <div class="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-[9px] text-gray-400"><span>문자 ${entry.content.length.toLocaleString('ko-KR')}</span><span>Markdown 토큰 지원 · Tab 들여쓰기</span></div>
        </main>${renderContextDock(entry)}`;
    }

    function render(options = {}) {
        const root = document.getElementById('learning-archive-view');
        if (!root) return;
        const source = filtered();
        const selected = current();
        root.innerHTML = `<div class="overflow-hidden border-y border-gray-200 bg-white xl:grid xl:min-h-[calc(100dvh-128px)] xl:grid-cols-[280px_minmax(520px,1fr)_280px]">
            <aside class="min-w-0 border-b border-gray-200 bg-white p-3 xl:border-b-0 xl:border-r">
                <div class="mb-3 flex items-start justify-between gap-2"><div><p class="text-[9px] font-bold tracking-wider text-indigo-500">LIFE TOOL</p><h2 class="mt-1 text-lg font-black text-gray-900">학습 아카이브</h2></div><button type="button" data-learning-new class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-white shadow-sm" title="새 학습 노트"><i class="fas fa-plus text-[10px]"></i></button></div>
                <label class="relative block"><i class="fas fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] text-gray-300"></i><input id="learning-search" value="${escapeAttr(searchText)}" class="h-8 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-[10px] outline-none focus:border-indigo-400" placeholder="분야, Chapter, 노트 검색"></label>
                <div class="mt-3 max-h-[calc(100dvh-235px)] space-y-1 overflow-y-auto pr-1">${renderTree(source)}</div>
                <button type="button" data-learning-new class="mt-3 w-full rounded-md border border-dashed border-indigo-200 px-3 py-2 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50"><i class="fas fa-plus mr-1"></i>새 노트</button>
            </aside>
            ${renderEditor(selected)}
        </div>`;
        saveUiState();
        if (!options.skipRemote) loadRemote();
    }

    async function saveActive() {
        const entry = current();
        if (!entry) return false;
        clearTimeout(autosaveTimer);
        const next = readEditor(entry);
        if (!next.field || !next.item || !next.chapter || !next.title) {
            window.showToast?.('분야, 항목, Chapter, 제목을 입력해 주세요.', 'warning');
            return false;
        }
        captureVersion(entry, '수동 저장 전');
        Object.assign(entry, next, { updatedAt: now() });
        saveStore();
        await persist(entry);
        setAutosaveStatus('saved', '자동 저장됨');
        return true;
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

    async function convertSelection(kind) {
        const entry = current();
        const text = getSelectedText().replace(/\s+/g, ' ').trim().slice(0, 180);
        if (!entry || !text) {
            window.showToast?.('전환할 문장이나 줄을 먼저 선택해주세요.', 'warning');
            return;
        }
        const related = getTodoContext(entry);
        if (kind === 'task') await window.ChecklistFeature?.createTaskFromText?.(text, 'career', `${entry.title}에서 전환`);
        else await window.ChecklistFeature?.addStepFromText?.(text, related[0]?.id || '', entry.title, related[0]?.domain || 'career');
        window.showToast?.(kind === 'task' ? '선택 문장을 새 할 일로 전환했습니다.' : '선택 문장을 관련 할 일의 Step으로 전환했습니다.', 'info');
        render({ skipRemote: true });
    }

    function bindControls() {
        if (bound) return;
        bound = true;
        const root = document.getElementById('learning-archive-view');
        root?.addEventListener('pointerdown', (event) => {
            if (event.target.closest('[data-learning-format], [data-learning-block-toggle], [data-learning-block], [data-learning-convert]')) {
                event.preventDefault();
                return;
            }
            beginTreeLongPress(event, root);
        });
        root?.addEventListener('mousedown', (event) => beginTreeLongPress(event, root));
        root?.addEventListener('input', (event) => {
            if (event.target.id === 'learning-search') {
                searchText = event.target.value;
                render({ skipRemote: true });
                requestAnimationFrame(() => { const input = document.getElementById('learning-search'); input?.focus(); input?.setSelectionRange(searchText.length, searchText.length); });
                return;
            }
            if (event.target.closest('[data-learning-line-content]')) {
                const value = syncEditorSource();
                const menu = document.querySelector('[data-learning-block-menu]');
                menu?.classList.toggle('hidden', event.target.textContent.trim() !== '/');
                if (value !== undefined) queueAutosave();
                return;
            }
            if (['learning-title', 'learning-field', 'learning-item', 'learning-chapter', 'learning-tags', 'learning-links'].includes(event.target.id)) queueAutosave();
        });
        root?.addEventListener('change', (event) => {
            if (event.target.matches('[data-learning-checkbox]')) {
                const content = event.target.closest('[data-learning-line]')?.querySelector('[data-learning-line-content]');
                content?.classList.toggle('line-through', event.target.checked);
                content?.classList.toggle('text-gray-400', event.target.checked);
                syncEditorSource();
                queueAutosave();
            }
        });
        root?.addEventListener('focusin', (event) => {
            if (event.target.id === 'learning-editor-surface') focusLearningDetailEditor(event.target);
        });
        root?.addEventListener('click', async (event) => {
            if (Date.now() < suppressTreeClickUntil && event.target.closest('[data-learning-tree-node]')) {
                event.preventDefault();
                return;
            }
            const open = event.target.closest('[data-learning-open]');
            if (open) {
                if (current() && open.dataset.learningOpen !== activeId && document.getElementById('learning-editor-surface')) await saveActive();
                activeId = open.dataset.learningOpen;
                render({ skipRemote: true });
                return;
            }
            if (event.target.closest('[data-learning-new]')) {
                const field = current()?.field || '새 분야';
                const item = current()?.item || '새 항목';
                const chapter = current()?.chapter || 'Chapter 1';
                const entry = normalize({ field, item, chapter, title: '새 학습 노트' });
                entries.unshift(entry); activeId = entry.id; saveStore(); render({ skipRemote: true }); document.getElementById('learning-title')?.select(); await persist(entry); return;
            }
            const entry = current();
            if (!entry) return;
            const detailSurface = event.target.closest('#learning-editor-surface');
            if (detailSurface && !event.target.closest('[data-learning-line-content], [data-learning-checkbox]')) {
                focusLearningDetailEditor(event.target);
                return;
            }
            const format = event.target.closest('[data-learning-format]');
            if (format) { applyFormat(format.dataset.learningFormat); return; }
            if (event.target.closest('[data-learning-block-toggle]')) { document.querySelector('[data-learning-block-menu]')?.classList.toggle('hidden'); return; }
            const block = event.target.closest('[data-learning-block]');
            if (block) { applyBlock(block.dataset.learningBlock); return; }
            const convert = event.target.closest('[data-learning-convert]');
            if (convert) { await convertSelection(convert.dataset.learningConvert); return; }
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
            const task = event.target.closest('[data-learning-open-task]');
            if (task) { window.switchView?.('routine-checklist-view'); window.ChecklistFeature?.selectTask?.(task.dataset.learningOpenTask); return; }
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
                queueAutosave();
                return;
            }
            if (event.target.closest('[data-learning-pin]')) { entry.pinned = !entry.pinned; entry.updatedAt = now(); saveStore(); render({ skipRemote: true }); await persist(entry); return; }
            if (event.target.closest('[data-learning-delete]')) {
                if (!window.confirm('이 학습 노트를 삭제할까요?')) return;
                entries = entries.filter((item) => item.id !== entry.id); activeId = entries[0]?.id || null; saveStore(); render({ skipRemote: true }); await removeRemote(entry.id); return;
            }
        });
        document.addEventListener('pointermove', (event) => updateTreeLongPress(event, root));
        document.addEventListener('pointerup', (event) => finishTreeLongPress(event, root));
        document.addEventListener('pointercancel', (event) => finishTreeLongPress(event, root, true));
        document.addEventListener('mousemove', (event) => updateTreeLongPress(event, root));
        document.addEventListener('mouseup', (event) => finishTreeLongPress(event, root));
        root?.addEventListener('contextmenu', (event) => {
            if ((pendingTreePress || longPressDrag) && event.target.closest('[data-learning-tree-node]')) event.preventDefault();
        });
        root?.addEventListener('keydown', (event) => {
            const reorderTarget = event.target.closest?.('[data-learning-reorder-target]');
            if (reorderTarget && event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                moveTreeNodeWithKeyboard(root, reorderTarget.closest('[data-learning-tree-node]'), event.key === 'ArrowUp' ? -1 : 1);
                return;
            }
            const content = event.target.closest?.('[data-learning-line-content]');
            if (!content) return;
            const line = content.closest('[data-learning-line]');
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
            if (event.key === 'Escape') document.querySelector('[data-learning-block-menu]')?.classList.add('hidden');
        });
        window.addEventListener('pagehide', () => {
            clearTimeout(autosaveTimer);
            if (current() && document.getElementById('learning-editor-surface')) saveActive();
        });
    }

    readUiState();
    entries = readStore();
    if (activeId && !entries.some((entry) => entry.id === activeId)) activeId = null;
    window.LearningArchiveFeature = { render, bindControls, refresh: () => { loaded = false; return loadRemote(); } };
})(window);
