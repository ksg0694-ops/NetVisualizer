// Text-only conflict UI. Server adoption never mutates the remote record.
(function (root) {
    let dialog, list, detail, message, accept, selection;
    let reviewRequest = 0;
    const names = { life_todos: '할 일', learning_archive_notes: '학습 노트' };
    function renderList() {
        if (!list) return;
        list.replaceChildren();
        const conflicts = Object.entries(root.RecordSync.listConflicts());
        if (!conflicts.length) { list.textContent = '해결할 충돌이 없습니다.'; return; }
        for (const [key, value] of conflicts) {
            const [table, id] = key.split(':');
            if (!names[table]) continue;
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${names[table]} · ${value.local?.title || value.server?.title || '삭제된 항목'} 비교`;
            button.addEventListener('click', () => open(table, id));
            list.append(button);
        }
    }
    async function open(table, id) {
        const request = ++reviewRequest;
        selection = null; detail.replaceChildren(); message.textContent = '최신 내용을 확인하고 있습니다.';
        accept.disabled = true;
        if (!dialog.open) dialog.showModal();
        try {
            const expected = await root.RecordSync.review(getAuthenticatedSupabaseClient(), table, id);
            if (!dialog.open || request !== reviewRequest) return;
            selection = { table, id, expected };
            for (const [label, row] of [['이 기기의 수정본', expected.local], ['서버의 최신본', expected.server]]) {
                const section = document.createElement('section');
                const title = document.createElement('h3'); title.textContent = label;
                const pre = document.createElement('pre');
                pre.textContent = !row || row.deleted ? '삭제된 항목' : JSON.stringify(row, null, 2);
                section.append(title, pre); detail.append(section);
            }
            message.textContent = '서버 버전을 선택하면 이 기기만 갱신됩니다. 기존 수정본은 복구 자료에 보관됩니다. 내용을 직접 합치려면 사본을 내려받아 비교한 뒤 편집하세요.';
            accept.disabled = false;
        } catch (error) { if (request === reviewRequest) message.textContent = error.message; }
    }
    document.addEventListener('DOMContentLoaded', () => {
        list = document.getElementById('sync-conflict-list');
        if (!list) return;
        dialog = document.createElement('dialog'); dialog.className = 'sync-conflict-dialog';
        dialog.setAttribute('aria-labelledby', 'sync-conflict-title');
        dialog.addEventListener('close', () => { reviewRequest++; selection = null; });
        const title = document.createElement('h2'); title.id = 'sync-conflict-title'; title.textContent = '충돌 내용 비교';
        message = document.createElement('p'); message.setAttribute('role', 'status');
        detail = document.createElement('div'); detail.className = 'sync-conflict-columns';
        accept = document.createElement('button'); accept.type = 'button'; accept.textContent = '서버 버전 사용 · 기기 수정본 보관';
        accept.addEventListener('click', async () => {
            if (!selection) return;
            accept.disabled = true;
            const { table, id, expected } = selection;
            try {
                await root.RecordSync.acceptServer(getAuthenticatedSupabaseClient(), table, id, expected);
                dialog.close(); renderList(); root.showToast?.('충돌을 해결했습니다. 기존 수정본은 복구 자료에 보관했습니다.', 'success');
            } catch (error) { message.textContent = `${error.message} 닫은 뒤 비교를 다시 선택하세요.`; }
        });
        const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기';
        close.addEventListener('click', () => dialog.close());
        dialog.append(title, message, detail, accept, close); document.body.append(dialog);
        renderList();
    });
    root.addEventListener('record-sync-conflict', renderList);
    root.ConflictPanel = { renderList };
})(window);
