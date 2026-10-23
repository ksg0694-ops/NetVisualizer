import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const read = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
const code = await read('js/features/banksaladSync.js');
function frontend({ rows = [{ status: 'completed', rows_inserted: 2 }], invokeError, readError, switchAccount = false, refreshError = false, refreshResult = {partial:false} } = {}) {
    let user = 'owner', invoked = 0, refreshed = 0;
    const notices = [], nodes = new Map();
    const node = id => {
        if (!nodes.has(id)) nodes.set(id, { textContent: '', classList: { add(){}, remove(){} }, setAttribute(){}, removeAttribute(){} });
        return nodes.get(id);
    };
    const client = { functions: { invoke: async () => { invoked++; if (switchAccount) user = 'another'; return { data: {request_id:'request'}, error:invokeError }; } },
        from: () => { const query = {select(){return query;},eq(){return query;},single:async()=>({data:rows.length > 1 ? rows.shift() : rows[0],error:readError})}; return query; } };
    const window = {setTimeout: fn=>setTimeout(fn,0), AccountStorage:{switching:false,current:{getItem:()=>null}},AppExperience:{isEditing:()=>false}};
    vm.runInNewContext(code, {window,document:{getElementById:node},getCurrentUserId:()=>user,getAuthenticatedSupabaseClient:()=>client,
        fetchSheetData:async()=>{refreshed++;if(refreshError)throw Error('offline');return refreshResult;},showToast:(...args)=>notices.push(args),Date,Error,Promise});
    return {api:window.BankSaladSync, client, notices, node, counts:()=>({invoked,refreshed})};
}
test('polls until this request completes before refreshing, and coalesces clicks', async()=>{
    const r=frontend({rows:[{status:'queued'},{status:'processing'},{status:'completed',rows_inserted:2}]});
    const a=r.api.sync(), b=r.api.sync(); assert.equal(a,b); await a;
    assert.deepEqual(r.counts(),{invoked:1,refreshed:1}); assert.match(r.notices.at(-1)[0],/2건/); assert.equal(r.node('btn-sync').disabled,false);
});
test('empty import is a successful Gmail check; failures never claim success',async()=>{
    const empty=frontend({rows:[{status:'completed',rows_inserted:0}]});await empty.api.sync();assert.match(empty.notices.at(-1)[0],/새 거래가 없/);
    for(const options of [{invokeError:Error('unconfigured')},{readError:Error('offline')},{rows:[{status:'failed'}]}]){
        const r=frontend(options);await r.api.sync();assert.equal(r.notices.at(-1)[1],'warning');assert.equal(r.counts().refreshed,1);assert.equal(r.node('btn-sync').disabled,false);
    }
});
test('view refresh failure restores button and never reports success',async()=>{
    const r=frontend({refreshError:true});await r.api.sync();assert.equal(r.notices.at(-1)[1],'warning');assert.equal(r.node('btn-sync').disabled,false);
});
test('deferred, partial and failed reloads cannot claim fresh screen data',async()=>{
    for (const refreshResult of [{deferred:true},{partial:true},{error:true}]) {const r=frontend({refreshResult});await r.api.sync();assert.doesNotMatch(r.notices.at(-1)[0],/거래 2건을 추가/);assert.equal(r.node('btn-sync').disabled,false);}
});
test('account transition cannot refresh or display former account results',async()=>{
    const r=frontend({switchAccount:true});await r.api.sync();assert.equal(r.counts().refreshed,0);assert.equal(r.notices.length,0);assert.equal(r.node('btn-sync').disabled,false);
});
test('polling timeout cannot be mistaken for completion',async()=>{
    const r=frontend();await assert.rejects(r.api.collect(r.client,'owner',{timeoutMs:0}),/mail_wait_timeout/);
});

const transpiled = ts.transpileModule(await read('supabase/functions/request-banksalad-sync/handler.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports = {};vm.runInNewContext(transpiled,{exports,Response,AbortSignal,Date});
function broker({ user='owner', authError, configured=true, dispatch=true, reused=false, rateLimited=false }={}) {
    let dispatches=0; const updates=[];
    const admin={auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:authError})},rpc:async()=>({data:[{request_id:'request',request_status:'queued',should_dispatch:!reused}],error:rateLimited?{message:'sync_rate_limited'}:null}),from:()=>{
        const q={update:p=>{updates.push(p);return q;},eq:()=>q,then:resolve=>resolve({error:null})};return q;
    }};
    const handler=exports.createHandler({env:name=>name==='NETVISUALIZER_OWNER_USER_ID'?'owner':configured?'server-only-test':'',createClient:()=>admin,fetch:async(url,opts)=>{
        dispatches++;assert.match(url,/ksg0694-ops\/NetVisualizer\/actions\/workflows\/banksalad-mail-sync.yml\/dispatches$/);
        assert.deepEqual(JSON.parse(opts.body),{ref:'main',inputs:{sync_request_id:'request'}});return {ok:dispatch};
    }});
    return {handler,updates,dispatches:()=>dispatches};
}
const req = (token='session')=>new Request('https://example.invalid',{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{}});
test('broker rejects anonymous, invalid and other users without dispatch',async()=>{
    for(const options of [{user:null},{user:'foreign'},{authError:Error('invalid')}]){const r=broker(options);assert.ok([401,403].includes((await r.handler(req())).status));assert.equal(r.dispatches(),0);}
    const r=broker();assert.equal((await r.handler(req(''))).status,401);assert.equal(r.dispatches(),0);
});
test('broker dispatches fixed repository/ref once, and reuses queued requests',async()=>{
    for(const reused of [false,true]){const r=broker({reused});const response=await r.handler(req());assert.equal(response.status,202);assert.equal(r.dispatches(),reused?0:1);assert.ok(!(await response.text()).includes('server-only-test'));}
});
test('configuration, rate limit and dispatch failures do not return success',async()=>{
    for(const [options,status] of [[{configured:false},503],[{rateLimited:true},429],[{dispatch:false},502]]){
        const r=broker(options);assert.equal((await r.handler(req())).status,status);if(!options.dispatch&&options.dispatch!==undefined)assert.equal(r.updates[0].status,'failed');
    }
});

test('migration enforces read-only owner access, service-only enqueue, reuse and expiry',async()=>{
    const db=new PGlite();
    try{
        await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated,service_role; grant select on auth.users to service_role; insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');`);
        await db.exec(await read('supabase/migrations/20261023121459_banksalad_sync_requests.sql'));
        const owner='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
        await db.exec('set role service_role');
        const first=(await db.query('select * from enqueue_banksalad_sync($1)',[owner])).rows[0];assert.equal(first.should_dispatch,true);
        const reuse=(await db.query('select * from enqueue_banksalad_sync($1)',[owner])).rows[0];assert.equal(reuse.request_id,first.request_id);assert.equal(reuse.should_dispatch,false);
        await db.exec('reset role');await db.query("update banksalad_sync_requests set created_at=now()-interval '21 minutes' where id=$1",[first.request_id]);
        await db.exec('set role service_role');const next=(await db.query('select * from enqueue_banksalad_sync($1)',[owner])).rows[0];assert.notEqual(next.request_id,first.request_id);
        await db.query("update banksalad_sync_requests set status='completed' where id=$1",[next.request_id]);
        await assert.rejects(db.query('select * from enqueue_banksalad_sync($1)',[owner]),/sync_rate_limited/);
        await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${owner}'`);
        assert.equal((await db.query('select * from banksalad_sync_requests')).rows.length,2);
        await assert.rejects(db.query('select * from enqueue_banksalad_sync($1)',[owner]),/permission denied/);
        await assert.rejects(db.query("update banksalad_sync_requests set status='completed'"),/permission denied/);
        await db.exec(`set request.jwt.claim.sub='${foreign}'`);assert.equal((await db.query('select * from banksalad_sync_requests')).rows.length,0);
        await db.exec('reset role; set role anon');await assert.rejects(db.query('select * from banksalad_sync_requests'),/permission denied/);
    }finally{await db.close();}
});
