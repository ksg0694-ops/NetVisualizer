// Shared optimistic concurrency for independent Todo and Learning records.
(function (root) {
    const storage = root.AccountStorage.current;
    const KEY = 'record-sync.bases.v1';
    const CONFLICTS = 'record-sync.conflicts.v1';
    const queues = new Map();
    const adapters = new Map();
    const generations = new Map();
    const HISTORY = 'record-sync.resolved.v1';
    const read = (key) => { try { return JSON.parse(storage.getItem(key) || '{}'); } catch { return {}; } };
    function remember(table, rows, dirty = new Set()) {
        const bases = read(KEY);
        for (const row of rows) {
            const key = `${table}:${row.id}`;
            if (!dirty.has(row.id)) bases[key] = row.updated_at;
        }
        storage.setItem(KEY, JSON.stringify(bases));
    }
    function setBase(key, value) {
        const bases = read(KEY);
        if (value === undefined) delete bases[key]; else bases[key] = value;
        storage.setItem(KEY, JSON.stringify(bases));
    }
    async function conflict(client, table, row) {
        const { data: server } = await client.from(table).select('*').eq('id', row.id).maybeSingle();
        const conflicts = read(CONFLICTS);
        conflicts[`${table}:${row.id}`] = { local: row, server, detectedAt: new Date().toISOString() };
        storage.setItem(CONFLICTS, JSON.stringify(conflicts));
        root.dispatchEvent(new Event('record-sync-conflict'));
        throw new Error('다른 기기 변경과 충돌했습니다. 이 기기의 수정본은 보관되었습니다. 설정에서 충돌 사본을 확인하세요.');
    }
    function enqueue(key, task) {
        const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(task);
        queues.set(key, next);
        void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
        return next;
    }
    function save(client, table, source) {
        const row = JSON.parse(JSON.stringify(source));
        const key = `${table}:${row.id}`;
        const generation = generations.get(key) || 0;
        return enqueue(key, async () => {
            if (generation !== (generations.get(key) || 0)) throw new Error('이미 해결된 충돌의 이전 저장 요청입니다.');
            if (root.AccountStorage.switching) throw new Error('계정 전환 중입니다.');
            const base = read(KEY)[key];
            if (base === undefined) {
                const existing = await client.from(table).select('id,updated_at').eq('id', row.id).maybeSingle();
                if (existing.error) throw existing.error;
                if (existing.data) return conflict(client, table, row);
            }
            const query = base === undefined
                ? client.from(table).insert(row)
                : client.from(table).update(row).eq('id', row.id).eq('updated_at', base);
            const result = await query.select('id,updated_at').maybeSingle();
            if (result.error?.code === '23505') return conflict(client, table, row);
            if (result.error) throw result.error;
            if (!result.data) return conflict(client, table, row);
            setBase(key, result.data.updated_at);
            return true;
        });
    }
    function remove(client, table, id) {
        const key = `${table}:${id}`;
        const generation = generations.get(key) || 0;
        return enqueue(key, async () => {
            if (generation !== (generations.get(key) || 0)) throw new Error('이미 해결된 충돌의 이전 삭제 요청입니다.');
            if (root.AccountStorage.switching) throw new Error('계정 전환 중입니다.');
            const base = read(KEY)[key];
            const existing = await client.from(table).select('id,updated_at').eq('id', id).maybeSingle();
            if (existing.error) throw existing.error;
            if (!existing.data) { setBase(key, undefined); return true; }
            if (base === undefined || existing.data.updated_at !== base) return conflict(client, table, { id, deleted: true });
            const result = await client.from(table).delete().eq('id', id).eq('updated_at', base).select('id');
            if (result.error) throw result.error;
            if (!result.data?.length) return conflict(client, table, { id, deleted: true });
            setBase(key, undefined);
            return true;
        });
    }
    function exportConflicts() {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify({ pending: read(CONFLICTS), resolved: read(HISTORY) }, null, 2)], { type: 'application/json' }));
        a.download = 'netvisualizer-conflict-copies.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    async function review(client, table, id) {
        const adapter = adapters.get(table);
        if (!adapter || root.AccountStorage.switching) throw new Error('계정 또는 기능 상태를 확인해 주세요.');
        const key = `${table}:${id}`;
        return enqueue(key, async () => {
            if (!read(CONFLICTS)[key]) throw new Error('이미 해결된 충돌입니다.');
            const { data, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            if (root.AccountStorage.switching) throw new Error('계정 전환 중입니다.');
            const conflicts = read(CONFLICTS);
            conflicts[key] = { local: adapter.snapshot(id) || { id, deleted: true }, server: data, detectedAt: new Date().toISOString() };
            storage.setItem(CONFLICTS, JSON.stringify(conflicts));
            return conflicts[key];
        });
    }
    function acceptServer(client, table, id, expected) {
        const key = `${table}:${id}`;
        return enqueue(key, async () => {
            const adapter = adapters.get(table);
            const matches = () => !root.AccountStorage.switching && adapter
                && JSON.stringify(read(CONFLICTS)[key]) === JSON.stringify(expected)
                && JSON.stringify(adapter.snapshot(id) || { id, deleted: true }) === JSON.stringify(expected.local);
            if (!matches()) throw new Error('기기 내용이 바뀌었습니다. 비교를 다시 열어 주세요.');
            const { data: server, error } = await client.from(table).select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            if (!matches() || (server?.updated_at ?? null) !== (expected.server?.updated_at ?? null)) {
                throw new Error('비교 이후 내용이 바뀌었습니다. 비교를 다시 열어 주세요.');
            }
            // Preserve the local copy before changing any state; no database write.
            const history = read(HISTORY);
            const entries = history[key] || [];
            history[key] = [...entries, { ...expected, resolvedAt: new Date().toISOString() }];
            storage.setItem(HISTORY, JSON.stringify(history));
            generations.set(key, (generations.get(key) || 0) + 1);
            adapter.adopt(id, server);
            setBase(key, server?.updated_at);
            const conflicts = read(CONFLICTS); delete conflicts[key];
            storage.setItem(CONFLICTS, JSON.stringify(conflicts));
            return true;
        });
    }
    async function readAllRows(makeQuery, pageSize = 500) {
        const rows = new Map();
        for (let offset = 0; ; offset += pageSize) {
            if (root.AccountStorage.switching) return { data: null, error: new Error('계정 전환 중입니다.') };
            const { data, error } = await makeQuery().order('id', { ascending: true }).range(offset, offset + pageSize - 1);
            if (error) return { data: null, error };
            for (const row of data || []) rows.set(row.id, row);
            if (!data || data.length < pageSize) return { data: [...rows.values()], error: null };
        }
    }
    root.RecordSync = { remember, save, remove, exportConflicts, review, acceptServer, readAllRows,
        listConflicts: () => read(CONFLICTS), register: (table, adapter) => adapters.set(table, adapter) };
})(window);
