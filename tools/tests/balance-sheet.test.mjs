import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
const source=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(await source('js/features/balanceSheetModel.js'),c);
const m=c.BalanceSheetModel;
test('housing debt is nested and subtracted once; zero remains valid',()=>{
 const r=m.current([{group:'housing',amount:150},{group:'housing',amount:65,isDebt:true},{group:'operating',amount:0}]);
 assert.equal(r.assets,150);assert.equal(r.debt,65);assert.equal(r.netWorth,85);assert.equal(r.groups[4].net,85);
});
test('history preserves authoritative net worth, missing months and duplicate uncertainty',()=>{
 const h=m.history([{year:2026,month:1,total_asset:100,debt:-65},{year:2026,month:3,total_asset:0},{year:2026,month:4,total_asset:10},{year:2026,month:4,total_asset:11},{year:2027,month:1,total_asset:999}],'2026-09-24');
 assert.equal(h.length,4);assert.equal(h[0].netWorth,100);assert.equal(h[1].netWorth,null);assert.equal(h[2].netWorth,0);assert.equal(h[3].status,'duplicate');
 assert.equal(m.reconcile(h)[2].change,null);
});
test('reconciliation removes deposits from performance and never guesses savings',()=>{
 const h=m.history([{year:2026,month:1,total_asset:100},{year:2026,month:2,total_asset:130}]);
 const f={month:'2026-02',basis:'calendar',scope:'investment+pension',reviewed:true,opening_net_worth:100,closing_net_worth:130,opening_investment:50,closing_investment:75,net_contributions:20,net_saving:25,other_change:0};
 const r=m.reconcile(h,[f])[1];assert.equal(r.performance,5);assert.equal(r.saving,25);assert.equal(r.difference,0);
 assert.equal(m.reconcile(h,[])[1].performance,null);
 assert.equal(m.reconcile(h,[{...f,opening_net_worth:90}])[1].performance,null);
 assert.equal(m.reconcile(h,[{...f,net_saving:null}])[1].saving,null);
 assert.equal(m.reconcile(h,[{...f,net_saving:20}])[1].difference,5);
});
test('valuation requires fresh matching quote and FX; missing or stale retain inputs',()=>{
 const p=[{group:'investment',amount:100,ticker:'TEST',currency:'USD',shares:2}];
 const opts={today:'2026-09-24',getPrice:()=>({price:10,currency:'USD',priceDate:'2026-09-23'}),getFx:()=>({krwPerUnit:1400,rateDate:'2026-09-23'})};
 assert.equal(m.current(p,opts).netWorth,28000);
 assert.equal(m.current(p,{...opts,getFx:()=>({krwPerUnit:1400,rateDate:'2026-07-01'})}).netWorth,100);
 assert.equal(m.current(p,{...opts,getPrice:()=>null}).netWorth,100);
 assert.equal(m.current(p,{...opts,getPrice:()=>({price:10,currency:'KRW',priceDate:'2026-09-23'})}).netWorth,100);
});
test('new snapshots load in normal repository refresh',async()=>{
 vm.runInContext(await source('js/features/financeRepository.js'),c);
 for(const name of ['personal_balance_sheet_inputs','personal_balance_sheet_flows'])assert.ok(c.FinanceRepository.DEFAULT_DATA_TABLES.includes(name));
});
test('private source and monthly analysis schema enforce ownership and review completeness',async()=>{
 const db=new PGlite(),a='11111111-1111-1111-1111-111111111111',b='22222222-2222-2222-2222-222222222222';
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;`);
  await db.exec(await source('supabase/migrations/20260924100614_personal_balance_sheet.sql'));
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);insert into personal_balance_sheet_inputs(as_of,positions) values('2026-09-24','[]');`);
  await assert.rejects(()=>db.exec("insert into personal_balance_sheet_flows(month,reviewed) values('2026-09',true)"),/check constraint/);
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false)`);
  assert.equal((await db.query('select id from personal_balance_sheet_inputs')).rows.length,0);
  await assert.rejects(()=>db.exec('delete from personal_balance_sheet_inputs'),/permission denied/);
  await assert.rejects(()=>db.exec(`insert into personal_balance_sheet_inputs(user_id,as_of,positions) values('${a}','2026-09-24','[]')`),/row-level security/);
  await db.exec('reset role;set role anon');await assert.rejects(()=>db.exec('select id from personal_balance_sheet_inputs'),/permission denied/);
 }finally{await db.close();}
});
