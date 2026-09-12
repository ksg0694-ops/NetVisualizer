import { readFile } from 'node:fs/promises';

const deployBaseUrl = (process.env.NETVISUALIZER_DEPLOY_URL || 'https://ksg0694-ops.github.io/NetVisualizer/').replace(/\/+$/, '/');
const localServiceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
const localIndex = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const localOffline = await readFile(new URL('../offline-assets.js', import.meta.url), 'utf8');
const localRevision = JSON.parse(localOffline.slice(localOffline.indexOf('{'), localOffline.lastIndexOf('}') + 1)).revision;

function requireMatch(source, pattern, label) {
    const value = source.match(pattern)?.[1];
    if (!value) throw new Error(`${label}을(를) 찾을 수 없습니다.`);
    return value;
}

const localCache = requireMatch(localServiceWorker, /CACHE_NAME\s*=\s*['"]([^'"]+)/, '로컬 캐시 버전');
const localShell = requireMatch(localIndex, /js\/features\/appShell\.js\?v=([^"']+)/, '로컬 앱 셸 버전');
const cacheBust = `deploy-check=${Date.now()}`;
const request = (path) => fetch(`${deployBaseUrl}${path}?${cacheBust}`, {
    headers: { 'cache-control': 'no-cache' },
});

const [serviceWorkerResponse, indexResponse, offlineResponse] = await Promise.all([request('sw.js'), request('index.html'), request('offline-assets.js')]);
if (!offlineResponse.ok) throw new Error(`배포 offline-assets.js 응답 실패: ${offlineResponse.status}`);
const remoteOffline = await offlineResponse.text();
const remoteRevision = JSON.parse(remoteOffline.slice(remoteOffline.indexOf('{'), remoteOffline.lastIndexOf('}') + 1)).revision;
if (!serviceWorkerResponse.ok) throw new Error(`배포 sw.js 응답 실패: ${serviceWorkerResponse.status}`);
if (!indexResponse.ok) throw new Error(`배포 index.html 응답 실패: ${indexResponse.status}`);

const remoteServiceWorker = await serviceWorkerResponse.text();
const remoteIndex = await indexResponse.text();
const remoteCache = requireMatch(remoteServiceWorker, /CACHE_NAME\s*=\s*['"]([^'"]+)/, '배포 캐시 버전');
const remoteShell = requireMatch(remoteIndex, /js\/features\/appShell\.js\?v=([^"']+)/, '배포 앱 셸 버전');

if (remoteCache !== localCache || remoteShell !== localShell || remoteRevision !== localRevision) {
    console.error(`Deployment mismatch: local ${localCache}/${localShell}/${localRevision}, remote ${remoteCache}/${remoteShell}/${remoteRevision}`);
    process.exitCode = 1;
} else {
    console.log(`Deployment verified: ${deployBaseUrl} (${remoteCache}, appShell ${remoteShell}, assets ${remoteRevision})`);
}
