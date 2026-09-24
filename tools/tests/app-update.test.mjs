import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const code=await read('js/shared/appUpdater.js');
const old='1111111111111111',fresh='2222222222222222';
function setup({published=fresh,loaded=old,offline=false,confirm=true,editor=false}={}){
 const elements=new Map(),events=new Map(),changes=new Set(),calls={reload:[],apply:0,confirm:0};
 const elem=id=>{if(!elements.has(id))elements.set(id,{textContent:'',dataset:{},setAttribute(){},querySelector(){return null;},addEventListener(){}});return elements.get(id);};
 const document={querySelector:s=>s.includes('meta[name=')?{content:loaded}:s.startsWith('dialog')&&editor?{}:null,getElementById:elem,addEventListener:(e,fn)=>events.set(e,fn)};
 let reg;
 const worker=revision=>({postMessage(message,ports){if(message.type==='GET_VERSION')ports[0].postMessage({revision});else{calls.apply++;reg.active=reg.waiting;reg.waiting=null;queueMicrotask(()=>changes.forEach(f=>f()));}}});
 reg={active:worker(old),waiting:worker(fresh),update:async()=>{}};
 const navigator={serviceWorker:{getRegistration:async()=>reg,addEventListener:(_e,f)=>changes.add(f),removeEventListener:(_e,f)=>changes.delete(f)}};
 const location={href:'https://example.com/NetVisualizer/',replace:u=>calls.reload.push(u)};
 const window={addEventListener(){},confirm(){calls.confirm++;return confirm;}};
 const context=vm.createContext({window,document,navigator,location,fetch:async(_url,opts)=>{assert.equal(opts.cache,'no-store');if(offline)throw Error('offline');return {ok:true,json:async()=>({revision:published})};},URL,AbortSignal,MessageChannel,setTimeout,clearTimeout,setInterval,clearInterval,console});
 vm.runInContext(code,context);return {api:window.AppUpdater,elements,calls,reg,elem};
}
test('network version check displays mismatch but never reloads automatically',async()=>{
 const r=setup();await r.api.check();assert.match(r.elem('app-update-status').textContent,/새 버전/);assert.equal(r.calls.reload.length,0);assert.equal(r.elem('settings-app-apply').hidden,false);
});
test('matching version is latest; offline and malformed response never claim latest',async()=>{
 const equal=setup({published:old});await equal.api.check();assert.match(equal.elem('app-update-status').textContent,/최신/);
 for(const options of [{offline:true},{published:'invalid'}]){const r=setup(options);assert.equal(await r.api.check(),false);assert.match(r.elem('app-update-status').textContent,/확인하지 못/);assert.equal(r.calls.reload.length,0);}
});
test('user approval activates only verified waiting build then reloads',async()=>{
 const r=setup();await r.api.apply();assert.equal(r.calls.confirm,1);assert.equal(r.calls.apply,1);assert.match(r.calls.reload[0],/app-build=2222222222222222/);
});
test('cancel and open editor keep live content untouched',async()=>{
 for(const options of [{confirm:false},{editor:true}]){const r=setup(options);await r.api.apply();assert.equal(r.calls.apply,0);assert.equal(r.calls.reload.length,0);}
});
test('worker and published revision mismatch never activates or reloads',async()=>{
 const r=setup({published:'3333333333333333'});await r.api.apply();assert.equal(r.calls.apply,0);assert.equal(r.calls.reload.length,0);assert.match(r.elem('app-update-status').textContent,/배포 중/);
});
test('service worker bypasses version probe and rejects wrong-target activation',async()=>{
 const handlers={},calls={skip:0,claim:0};
 const self={NETVISUALIZER_OFFLINE:{revision:fresh,assets:['./','./index.html']},location:{href:'https://example.com/NetVisualizer/sw.js'},addEventListener:(k,f)=>handlers[k]=f,skipWaiting:()=>{calls.skip++;return Promise.resolve();},clients:{claim:()=>calls.claim++}};
 const context=vm.createContext({self,importScripts(){},URL,Request,caches:{}});vm.runInContext(await read('sw.js'),context);
 let response;handlers.message({data:{type:'GET_VERSION'},ports:[{postMessage:m=>response=m}]});assert.equal(response.revision,fresh);
 handlers.message({data:{type:'APPLY_UPDATE',revision:old},waitUntil(){}});assert.equal(calls.skip,0);
 handlers.message({data:{type:'APPLY_UPDATE',revision:fresh},waitUntil(){}});assert.equal(calls.skip,1);
 let intercepted=false;handlers.fetch({request:{url:'https://example.com/NetVisualizer/version.json?check=1',method:'GET'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
});
test('published manifest, HTML and offline cache have the same build ID; settings removals preserve sync engine',async()=>{
 const html=await read('index.html'),version=JSON.parse(await read('version.json'));
 assert.ok(html.includes(`name="app-build" content="${version.revision}"`));assert.ok((await read('offline-assets.js')).includes(version.revision));
 for(const text of ['데이터베이스 및 클라우드 데이터 관리','이 기기의 복구 자료','충돌 비교 및 해결','복지포인트 환불'])assert.ok(!html.includes(text));
 assert.ok(html.includes('source-sync-detail'));assert.ok(html.includes('btn-app-update'));assert.ok(html.includes('settings-app-apply'));
 assert.ok((await read('js/shared/recordSync.js')).includes('CONFLICTS'));
});
