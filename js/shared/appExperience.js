(function (root) {
    let restoreFocus = null;
    let lastRefresh = 0;
    let refreshing = false;
    let pendingRefresh = false;
    function isEditing() {
        return !!document.querySelector('[contenteditable="true"]:focus-within, textarea:focus, input:focus, dialog[open], .modal-overlay:not(.hidden)');
    }
    function deferRefresh() { pendingRefresh = true; }
    function openSettings() {
        restoreFocus = document.activeElement;
        document.getElementById('settings-modal').classList.remove('hidden');
        document.getElementById('auth-email')?.focus();
        root.AppUpdater?.render();
    }
    function closeSettings() {
        document.getElementById('settings-modal').classList.add('hidden');
        restoreFocus?.focus();
    }
    function update() {
        const signedIn = typeof isSignedIn === 'function' && isSignedIn();
        const banner = document.getElementById('account-state-banner');
        if (banner) banner.hidden = signedIn;
        const hasAssets = typeof dataCache !== 'undefined' && (dataCache.asset?.length > 0 || dataCache.portfolio?.length > 0);
        for (const id of ['card-asset', 'finance-kpi-asset-progress', 'finance-kpi-funding-progress']) {
            if (!hasAssets) { const el = document.getElementById(id); if (el) el.textContent = '—'; }
        }
        const chart = document.getElementById('dashboardAssetChart');
        if (chart) chart.parentElement.hidden = !hasAssets;
        const placeholder = document.getElementById('asset-empty-message');
        if (placeholder) placeholder.hidden = !!hasAssets;
        const status = document.getElementById('source-sync-detail');
        if (status && root.FinanceRepository?.TABLE_SPECS) {
            let meta = {};
            try { meta = JSON.parse(root.AccountStorage.current.getItem('sync.tables.v1') || '{}'); } catch { /* no status yet */ }
            const names = { transactions: '거래', portfolios: '포트폴리오', assets: '월말 자산', portfolio_market_prices: '시세' };
            status.textContent = Object.entries(meta).map(([table, value]) => {
                const label = names[table] || table;
                const date = value.lastSuccessAt ? new Date(value.lastSuccessAt).toLocaleString('ko-KR') : '성공 기록 없음';
                return `${label}: ${date}${value.error ? ' · 최근 갱신 실패' : ''}`;
            }).join('\n') || '아직 동기화 기록이 없습니다.';
        }
    }
    async function refreshIfStale() {
        if (document.visibilityState !== 'visible' || refreshing || !root.navigator.onLine || !isSignedIn()) return;
        if (isEditing()) { deferRefresh(); return; }
        if (!pendingRefresh && Date.now() - lastRefresh < 60000) return;
        pendingRefresh = false;
        refreshing = true; lastRefresh = Date.now();
        try { await fetchSheetData(true); await root.LearningArchiveFeature?.refresh(); }
        catch (error) { root.showToast?.('자동 갱신에 실패했습니다. 연결 후 새로고침해 주세요.', 'warning'); }
        finally { refreshing = false; update(); }
    }
    root.AppExperience = { openSettings, closeSettings, update, refreshIfStale, isEditing, deferRefresh };
    document.addEventListener('DOMContentLoaded', () => {
        const modal = document.getElementById('settings-modal');
        modal?.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); closeSettings(); }
            if (event.key !== 'Tab') return;
            const items = [...modal.querySelectorAll('button,input,a[href],[tabindex="0"]')].filter(el => !el.disabled && el.getClientRects().length);
            if (!items.length) return;
            if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
            else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
        });
        update();
    });
    document.addEventListener('visibilitychange', refreshIfStale);
    document.addEventListener('focusout', () => { if (pendingRefresh) setTimeout(refreshIfStale, 0); });
    root.addEventListener('online', refreshIfStale);
    root.addEventListener('record-sync-conflict', () => root.showToast?.('다른 기기 변경과 충돌해 저장을 중단했습니다. 이 기기의 수정본은 보관했습니다.', 'warning', 8000));
})(window);
