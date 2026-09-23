import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const source = p => readFile(new URL('../../'+p,import.meta.url),'utf8');
const c=vm.createContext({});
vm.runInContext(await source('js/features/fixedCostsStore.js'),c);
const draft={name:'Internet',category:'인터넷',kind:'fixed',monthly_amount:20000,pay_day:25,is_active:true};
test('fixed-cost validation rejects invalid amounts and days; preserves inactive state',()=>{
    assert.equal(c.FixedCostsStore.normalize(draft).monthly_amount,20000);
    for(const monthly_amount of ['',-1,Infinity,1.5,null]) {
        assert.throws(()=>c.FixedCostsStore.normalize({...draft,monthly_amount}));
    }
    for(const pay_day of [0,32,1.5])assert.throws(()=>c.FixedCostsStore.normalize({...draft,pay_day}));
    assert.equal(c.FixedCostsStore.normalize({...draft,is_active:false}).is_active,false);
});
test('store guards owner/version, surfaces conflict and errors, rejects account switch',async()=>{
    let userId='a', result={data:[],error:null}, filters=[];
    const query={eq(k,v){filters.push([k,v]);return this;},select(){return Promise.resolve(result);}};
    const client={from(table){assert.equal(table,'fixed_costs');return {update(){return query;},insert(){return query;}};}};
    const store=c.FixedCostsStore.create(()=>({userId,client}));
    await assert.rejects(()=>store.save(draft,{id:'item',version:3}),/다른 기기/);
    assert.deepEqual(filters,[['user_id','a'],['id','item'],['version',3]]);
    result={data:null,error:{message:'fail'}}; await assert.rejects(()=>store.save(draft,null,'draft'),/저장하지 못/);
    userId=''; await assert.rejects(()=>store.list(),/로그인/);
});
test('fixed-cost schema enforces owners, constraints and optimistic versions',async()=>{
    const db=new PGlite(),a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
    try {
        await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;`);
        await db.exec(await source('supabase/migrations/20260923085446_fixed_costs.sql'));
        await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`);
        const inserted=await db.query("insert into fixed_costs(name,category,kind,monthly_amount) values('test','internet','fixed',20000) returning id,version");
        const id=inserted.rows[0].id;
        assert.equal(Number(inserted.rows[0].version),1);
        assert.equal((await db.query('update fixed_costs set monthly_amount=21000 where id=$1 and version=1 returning version',[id])).rows[0].version,2);
        assert.equal((await db.query('update fixed_costs set monthly_amount=22000 where id=$1 and version=1 returning id',[id])).rows.length,0);
        await assert.rejects(()=>db.query('update fixed_costs set pay_day=32 where id=$1',[id]),/check constraint/);
        await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
        assert.equal((await db.query('select id from fixed_costs')).rows.length,0);
        assert.equal((await db.query('update fixed_costs set monthly_amount=1 where id=$1 returning id',[id])).rows.length,0);
        await assert.rejects(()=>db.query("insert into fixed_costs(user_id,name,category,kind,monthly_amount) values($1,'x','x','fixed',1)",[a]),/row-level security/);
        await assert.rejects(()=>db.query('delete from fixed_costs'),/permission denied/);
        await db.exec('reset role;set role anon'); await assert.rejects(()=>db.query('select id from fixed_costs'),/permission denied/);
    } finally {await db.close();}
});
test('life navigation and versioned assets include fixed-cost management',async()=>{
    const html=await source('index.html'),shell=await source('js/features/appShell.js');
    for(const marker of ['data-target="fixed-costs-view"','data-mobile-nav-target="fixed-costs-view"','id="fixed-costs-view"','fixedCostsStore.js','fixedCosts.js','fixed-costs.css'])assert.ok(html.includes(marker));
    assert.ok(shell.includes("get('view') === 'fixed-costs'"));
});
