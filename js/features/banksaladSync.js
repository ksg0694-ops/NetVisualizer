(function (root) {
    let inFlight = null;
    const wait = ms => new Promise(resolve => root.setTimeout(resolve, ms));

    async function collect(client, userId, { onStatus = () => {}, timeoutMs = 180000, pollMs = 3000 } = {}) {
        const checkAccount = () => {
            if (root.AccountStorage.switching || getCurrentUserId() !== userId) throw new Error('account_changed');
        };
        checkAccount();
        onStatus('뱅크샐러드 메일 확인 요청 중…');
        const { data, error } = await client.functions.invoke('request-banksalad-sync', { body: {} });
        checkAccount();
        if (error || !data?.request_id) throw new Error('mail_request_failed');
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            checkAccount();
            const { data: row, error: readError } = await client.from('banksalad_sync_requests')
                .select('id,status,messages_processed,messages_failed,rows_inserted,error_code')
                .eq('id', data.request_id).eq('user_id', userId).single();
            checkAccount();
            if (readError || !row) throw new Error('mail_status_failed');
            if (row.status === 'completed' || row.status === 'failed') return row;
            onStatus(row.status === 'processing' ? '메일에서 거래내역 가져오는 중…' : '메일 확인 대기 중…');
            await wait(pollMs);
        }
        throw new Error('mail_wait_timeout');
    }

    function sync() {
        if (inFlight) return inFlight;
        inFlight = run().finally(() => { inFlight = null; });
        return inFlight;
    }

    async function run() {
        const userId = getCurrentUserId();
        if (!userId) { showToast('로그인 후 메일 동기화를 사용할 수 있습니다.', 'warning'); return; }
        const button = document.getElementById('btn-sync');
        const icon = document.getElementById('sync-icon');
        const status = document.getElementById('sync-status');
        const sidebar = document.getElementById('sidebar-sync-status');
        const setStatus = text => {
            if (status) status.textContent = text;
            if (sidebar) sidebar.textContent = text;
        };
        if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
        icon?.classList.add('animate-spin-slow');
        let row, failure;
        try {
            row = await collect(getAuthenticatedSupabaseClient(), userId, { onStatus: setStatus });
        } catch (error) { failure = error.message; }
        try {
            if (root.AccountStorage.switching || getCurrentUserId() !== userId) return;
            // Database refresh remains available if Gmail collection fails.
            const refreshed = await fetchSheetData(true);
            if (typeof activeViewId !== 'undefined' && activeViewId === 'project-manager-view') await root.ProjectManager?.refresh();
            if (typeof activeViewId !== 'undefined' && activeViewId === 'insurance-cards-view') await root.CardManager?.refresh();
            if (root.AccountStorage.switching || getCurrentUserId() !== userId) return;
            if (failure || row?.status === 'failed') {
                const message = failure === 'mail_wait_timeout'
                    ? '메일 수집이 아직 진행 중입니다. 잠시 후 다시 동기화해 주세요.'
                    : '메일 동기화를 완료하지 못했습니다. 서버 데이터만 갱신을 시도했습니다. 잠시 후 다시 시도해 주세요.';
                setStatus(failure === 'mail_wait_timeout' ? '메일 수집 완료 대기' : '메일 동기화 실패');
                showToast(message, 'warning', 6000);
            } else if (refreshed?.deferred) {
                setStatus('메일 확인 완료 · 화면 갱신 대기');
                showToast('메일 확인이 끝났습니다. 편집을 마치면 화면에 반영됩니다.', 'info');
            } else {
                if (!refreshed || refreshed.error || refreshed.partial) {
                    setStatus('메일 확인 완료 · 데이터 갱신 실패');
                    showToast('메일 확인은 끝났지만 일부 데이터를 불러오지 못했습니다. 다시 동기화해 주세요.', 'warning');
                    return;
                }
                const count = Number(row?.rows_inserted) || 0;
                setStatus(count ? `메일 동기화 완료 · ${count}건 추가` : '메일 확인 완료 · 추가 거래 없음');
                showToast(count ? `뱅크샐러드 메일에서 거래 ${count}건을 추가했습니다.` : '뱅크샐러드 메일을 확인했습니다. 추가할 새 거래가 없습니다.', 'info');
            }
        } catch {
            if (!root.AccountStorage.switching && getCurrentUserId() === userId) {
                setStatus('화면 갱신 실패');
                showToast('데이터를 불러오지 못했습니다. 연결을 확인하고 다시 동기화해 주세요.', 'warning');
            }
        } finally {
            if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
            icon?.classList.remove('animate-spin-slow');
        }
    }
    root.BankSaladSync = { sync, collect, isBusy: () => !!inFlight };
})(window);
