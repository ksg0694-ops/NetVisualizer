(function (root) {
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (character) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[character]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function toLocalDateString(value = new Date()) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return local.toISOString().slice(0, 10);
    }

    function formatDateTime(value) {
        if (!value) return '기준일 미확인';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(date);
    }

    function formatWon(value) {
        return `${Math.round(Number(value) || 0).toLocaleString('ko-KR')}원`;
    }

    function formatCompactWon(value) {
        const amount = Number(value) || 0;
        const absolute = Math.abs(amount);
        if (absolute >= 100000000) return `${(amount / 100000000).toFixed(2).replace(/\.00$/, '')}억`;
        if (absolute >= 10000) return `${Math.round(amount / 10000).toLocaleString('ko-KR')}만원`;
        return formatWon(amount);
    }

    const pendingAssets = new Map();

    function loadStyle({ id, src, integrity, crossOrigin = 'anonymous' }) {
        if (typeof document === 'undefined') return Promise.reject(new Error('브라우저에서만 스타일을 불러올 수 있습니다.'));
        if (document.getElementById(id)) return Promise.resolve();
        const key = `style:${id}`;
        if (pendingAssets.has(key)) return pendingAssets.get(key);
        const promise = new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = src;
            if (integrity) link.integrity = integrity;
            if (crossOrigin) link.crossOrigin = crossOrigin;
            link.addEventListener('load', resolve, { once: true });
            link.addEventListener('error', () => reject(new Error(`${src} 스타일을 불러오지 못했습니다.`)), { once: true });
            document.head.appendChild(link);
        });
        pendingAssets.set(key, promise);
        return promise;
    }

    function loadScript({ id, src, integrity, crossOrigin = 'anonymous', isReady }) {
        if (typeof isReady === 'function' && isReady()) return Promise.resolve();
        if (typeof document === 'undefined') return Promise.reject(new Error('브라우저에서만 스크립트를 불러올 수 있습니다.'));
        const existing = document.getElementById(id);
        if (existing && typeof isReady === 'function' && isReady()) return Promise.resolve();
        const key = `script:${id}`;
        if (pendingAssets.has(key)) return pendingAssets.get(key);
        const promise = new Promise((resolve, reject) => {
            const script = existing || document.createElement('script');
            script.id = id;
            script.src = src;
            script.defer = true;
            if (integrity) script.integrity = integrity;
            if (crossOrigin) script.crossOrigin = crossOrigin;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', () => reject(new Error(`${src} 스크립트를 불러오지 못했습니다.`)), { once: true });
            if (!existing) document.head.appendChild(script);
        });
        pendingAssets.set(key, promise);
        return promise;
    }

    async function ensureXlsx() {
        await loadScript({
            id: 'xlsx-runtime',
            src: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
            isReady: () => Boolean(root.XLSX),
        });
    }

    async function ensureLeaflet() {
        await Promise.all([
            loadStyle({
                id: 'leaflet-runtime-style',
                src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
                integrity: 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
            }),
            loadScript({
                id: 'leaflet-runtime',
                src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
                integrity: 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
                isReady: () => Boolean(root.L),
            }),
        ]);
    }

    root.AppUtils = Object.freeze({
        escapeHtml,
        escapeAttr,
        toLocalDateString,
        formatDateTime,
        formatWon,
        formatCompactWon,
    });
    root.AppAssets = Object.freeze({ ensureLeaflet, ensureXlsx });
})(typeof window !== 'undefined' ? window : globalThis);
