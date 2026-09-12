(function (root) {
    'use strict';
    const native = root.localStorage;
    const scopeKey = 'netvisualizer.active-account.v1';
    const scope = root.sessionStorage.getItem(scopeKey) || 'guest';
    const prefix = `netvisualizer.account.${encodeURIComponent(scope)}.`;
    let switching = false;
    const current = Object.freeze({
        getItem: (key) => native.getItem(prefix + key),
        setItem: (key, value) => native.setItem(prefix + key, String(value)),
        removeItem: (key) => native.removeItem(prefix + key),
    });
    root.AccountStorage = Object.freeze({
        current,
        scope,
        get switching() { return switching; },
        activate(userId) {
            const next = userId || 'guest';
            if (next === scope) return true;
            // Finish local drafts in their original scope before discarding memory.
            root.dispatchEvent(new Event('account-will-change'));
            switching = true;
            root.sessionStorage.setItem(scopeKey, next);
            root.location.reload();
            return false;
        },
        exportLegacy() {
            if (scope !== '869e1e98-eac8-499c-a0f1-bd2424dfdfb1' || !root.isSignedIn?.()) {
                root.showToast?.('이전 기록의 원래 계정으로 로그인한 후 백업할 수 있습니다.', 'warning');
                return;
            }
            const data = {};
            for (let i = 0; i < native.length; i++) {
                const key = native.key(i);
                if (/^(netvisualizer[._]|smartbook_)/.test(key) && !key.startsWith('netvisualizer.account.')) data[key] = native.getItem(key);
            }
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            link.download = 'netvisualizer-legacy-device-backup.json';
            link.click();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        },
    });
})(window);
