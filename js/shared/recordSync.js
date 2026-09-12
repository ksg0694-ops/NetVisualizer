// Shared optimistic concurrency for independent Todo and Learning records.
(function (root) {
    const storage = root.AccountStorage.current;
    const KEY = 'record-sync.bases.v1';
    const CONFLICTS = 'record-sync.conflicts.v1';
    const queues = new Map();
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
        return enqueue(key, async () => {
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
        return enqueue(key, async () => {
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
        a.href = URL.createObjectURL(new Blob([JSON.stringify(read(CONFLICTS), null, 2)], { type: 'application/json' }));
        a.download = 'netvisualizer-conflict-copies.json'; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    root.RecordSync = { remember, save, remove, exportConflicts };
})(window);
