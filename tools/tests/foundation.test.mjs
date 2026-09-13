import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const root = new URL('../../', import.meta.url);
const source = async path => readFile(new URL(path, root), 'utf8');
function memory() {
  const values = new Map();
  return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k), values };
}
async function runtime(scope='a', native=memory()) {
  const session=memory(); session.setItem('netvisualizer.active-account.v1',scope);
  const events=[]; let reloads=0;
  const window={localStorage:native,sessionStorage:session,dispatchEvent:e=>events.push(e.type),location:{reload:()=>reloads++}};
  const context=vm.createContext({window,Event,console,setTimeout});
  vm.runInContext(await source('js/shared/accountStorage.js'),context);
  vm.runInContext(await source('js/shared/recordSync.js'),context);
  return {window,context,events,session,native,reloads:()=>reloads};
}
function remote(initial=[]) {
  const rows=new Map(initial.map(r=>[r.id,structuredClone(r)])); let clock=0;
  return {rows,from() {
    let mode='select',payload,filters=[];
    const execute=()=>{
      let data=[...rows.values()].filter(r=>filters.every(([k,v])=>r[k]===v));
      if(mode==='insert') {
        if(rows.has(payload.id)) return {data:null,error:{code:'23505'}};
        const row={...payload,updated_at:`v${++clock}`};rows.set(row.id,row);data=[row];
      } else if(mode==='update') {
        data=data.map(r=>({...r,...payload,updated_at:`v${++clock}`}));data.forEach(r=>rows.set(r.id,r));
      } else if(mode==='delete') data.forEach(r=>rows.delete(r.id));
      return {data,error:null};
    };
    const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},insert:r=>{mode='insert';payload=r;return q;},update:r=>{mode='update';payload=r;return q;},delete:()=>{mode='delete';return q;},maybeSingle:async()=>{const r=execute();return {...r,data:r.data?.[0]??null};},then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}};
    return q;
  }};
}
test('account scopes isolate data and never implicitly import legacy data',async()=>{
  const native=memory();native.setItem('notes','legacy');
  const a=await runtime('a',native);a.window.AccountStorage.current.setItem('notes','A');
  const b=await runtime('b',native);assert.equal(b.window.AccountStorage.current.getItem('notes'),null);
  assert.equal(native.getItem('notes'),'legacy');assert.equal(a.window.AccountStorage.current.getItem('notes'),'A');
  assert.equal(a.window.AccountStorage.activate('b'),false);assert.equal(a.reloads(),1);
  assert.deepEqual(a.events,['account-will-change']);
  a.window.AccountStorage.current.setItem('late-draft','still A');
  assert.equal(b.window.AccountStorage.current.getItem('late-draft'),null);
});
test('concurrent device edits preserve server and a recoverable local conflict',async()=>{
  const a=await runtime(),b=await runtime();const db=remote([{id:'n',content:'base',updated_at:'v0'}]);
  for(const r of [a,b])r.window.RecordSync.remember('notes',[db.rows.get('n')]);
  await a.window.RecordSync.save(db,'notes',{id:'n',content:'PC'});
  await assert.rejects(()=>b.window.RecordSync.save(db,'notes',{id:'n',content:'phone'}),/충돌/);
  assert.equal(db.rows.get('n').content,'PC');
  const copies=JSON.parse(b.window.AccountStorage.current.getItem('record-sync.conflicts.v1'));
  assert.equal(copies['notes:n'].local.content,'phone');assert.equal(copies['notes:n'].server.content,'PC');
});
test('dirty refresh cannot replace the edit base; stale delete cannot remove remote changes',async()=>{
  const r=await runtime(),db=remote([{id:'n',content:'base',updated_at:'v0'}]);
  r.window.RecordSync.remember('notes',[db.rows.get('n')]);
  db.rows.set('n',{id:'n',content:'new remote',updated_at:'v9'});
  r.window.RecordSync.remember('notes',[db.rows.get('n')],new Set(['n']));
  await assert.rejects(()=>r.window.RecordSync.remove(db,'notes','n'),/충돌/);
  assert.equal(db.rows.get('n').content,'new remote');
});
test('same-device saves serialize, new rows insert, and missing base never overwrites',async()=>{
  const r=await runtime(),db=remote();
  await Promise.all([r.window.RecordSync.save(db,'notes',{id:'n',content:'one'}),r.window.RecordSync.save(db,'notes',{id:'n',content:'two'})]);
  assert.equal(db.rows.get('n').content,'two');
  const fresh=await runtime();await assert.rejects(()=>fresh.window.RecordSync.save(db,'notes',{id:'n',content:'unknown'}),/충돌/);
  await r.window.RecordSync.remove(db,'notes','n');assert.equal(db.rows.size,0);
});
test('offline manifest matches actual versioned assets and includes every required local script',async()=>{
  const self={};vm.runInNewContext(await source('offline-assets.js'),{self});
  const html=await source('index.html');
  for(const m of html.matchAll(/<script\b[^>]*src="(\.\/[^\"]+)"/g))assert.ok(self.NETVISUALIZER_OFFLINE.assets.includes(m[1]),m[1]);
  assert.ok(self.NETVISUALIZER_OFFLINE.assets.includes('./vendor/supabase.js'));
  assert.ok(!self.NETVISUALIZER_OFFLINE.assets.includes('./vendor/pptxgen.bundle.js'));
});
test('owner guards and atomic portfolio save execute in an isolated PostgreSQL engine',async()=>{
  const db=new PGlite();
  const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',position='20000000-0000-0000-0000-000000000001';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('${a}'),('${b}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to anon,authenticated;
      create table public.portfolios(id uuid primary key default gen_random_uuid(),user_id uuid default auth.uid(),name text not null,group_name text not null,amount numeric not null default 0,updated_at timestamptz default now());
      create table public.learning_archive_notes(id uuid primary key,user_id uuid default auth.uid(),content text,updated_at timestamptz default now());
      create table public.life_todos(id uuid primary key,user_id uuid default auth.uid(),updated_at timestamptz default now());
      grant all on public.portfolios,public.learning_archive_notes,public.life_todos to anon,authenticated;
      grant select on public.learning_archive_notes to public;
      create policy old_public on public.learning_archive_notes for all to anon,authenticated using(true) with check(true);
      create policy existing_portfolio_owner on public.portfolios for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
      insert into public.portfolios(id,user_id,name,group_name,amount) values('${position}','${a}','original','cash',100);
      insert into public.learning_archive_notes values('${position}','${a}','private',now());`);
    for(const file of ['20260913123733_20260912090000_private_owner_guards.sql','20260913123755_20260912091000_atomic_portfolio_save.sql','20260913123757_20260912092000_monotonic_note_versions.sql'])await db.exec(await source('supabase/migrations/'+file));
    async function as(role,user,fn) {
      await db.exec('begin');
      try {await db.exec(`set local role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user||'']);return await fn();}
      finally{await db.exec('rollback');}
    }
    await assert.rejects(()=>as('anon',null,()=>db.query('select * from public.learning_archive_notes')),/permission denied/);
    await as('authenticated',b,async()=>{assert.equal((await db.query('select * from public.learning_archive_notes')).rows.length,0);assert.equal((await db.query('update public.portfolios set amount=9 returning id')).rows.length,0);});
    await as('authenticated',a,async()=>{
      assert.equal((await db.query('select * from public.learning_archive_notes')).rows.length,1);
      const before = (await db.query('select updated_at::text from public.learning_archive_notes')).rows[0].updated_at;
      const after = (await db.query('update public.learning_archive_notes set content=content returning updated_at::text')).rows[0].updated_at;
      assert.notEqual(after,before,'server version must advance even without a content change');
      const mutation={upserts:[{id:position,name:'changed',amount:200}],inserts:[{name:'new',group_name:'cash',amount:50}],removedIds:[]};
      const id='30000000-0000-0000-0000-000000000001';
      await db.query('select public.save_portfolio_atomic($1::jsonb,$2::uuid)',[JSON.stringify(mutation),id]);
      await db.query('select public.save_portfolio_atomic($1::jsonb,$2::uuid)',[JSON.stringify(mutation),id]);
      assert.equal((await db.query('select * from public.portfolios')).rows.length,2);
      assert.equal(Number((await db.query('select amount from public.portfolios where id=$1',[position])).rows[0].amount),200);
    });
    await as('authenticated',a,async()=>{
      await db.exec('savepoint test_failure');
      await assert.rejects(()=>db.query('select public.save_portfolio_atomic($1::jsonb,$2::uuid)',[JSON.stringify({upserts:[{id:position,amount:999}],inserts:[{name:null,group_name:'cash'}],removedIds:[]}),'30000000-0000-0000-0000-000000000002']),/null/);
      await db.exec('rollback to savepoint test_failure');
      assert.equal(Number((await db.query('select amount from public.portfolios where id=$1',[position])).rows[0].amount),100);
    });
    await as('authenticated',b,async()=>{
      await assert.rejects(()=>db.query('select public.save_portfolio_atomic($1::jsonb,$2::uuid)',[JSON.stringify({upserts:[{id:position,amount:999}],inserts:[],removedIds:[]}),'30000000-0000-0000-0000-000000000003']),/another account/);
    });
    await as('authenticated',a,async()=>{
      await assert.rejects(()=>db.query('select public.save_portfolio_atomic($1::jsonb,$2::uuid)',['{}','30000000-0000-0000-0000-000000000004']),/Invalid portfolio mutation/);
    });
  } finally {await db.close();}
});
