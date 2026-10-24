import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const code=await readFile(new URL('../../js/features/financeIntelligenceModel.js',import.meta.url),'utf8');
const c=vm.createContext({PersonalCfoDomain:{createTransactionKey:t=>'id:'+t.id}});
vm.runInContext(code,c);
const m=c.FinanceIntelligenceModel;
const tx={id:'1',date:'2026-10-25',type:'지출',category:'생활',subcategory:'기타',memo:'스타벅스 운정',method:'삼성카드',amount:-5500};
test('rules require matching type and prefer scoped specificity, never mutate transaction',()=>{
 const rules=[{match_text:'스타벅스',match_type:'지출',target_type:'지출',target_category:'식비',target_subcategory:'카페',enabled:true}];
 assert.equal(m.suggest(tx,rules).status,'suggested');
 assert.equal(m.suggest(tx,[{...rules[0],match_type:'수입'}]).status,'none');
 assert.equal(m.suggest(tx,[...rules,{...rules[0],target_category:'고정비'}]).status,'conflict');
 assert.equal(m.suggest(tx,[{...rules[0],target_category:'생활',target_subcategory:'기타'}]).status,'already');
 assert.equal(tx.category,'생활');
});
test('due day clamps month end and reconciliation never guesses paid from amount alone',()=>{
 assert.equal(Array.from(m.dueDays('2026-02-10','2026-03-28',31)).join(','),'2026-02-28');
 const fixed=[{name:'통신비',is_active:true,monthly_amount:60000,pay_day:25,payment_method:'삼성카드'}];
 const period={startDate:'2026-10-01',endDate:'2026-10-31'};
 assert.equal(m.reconcileFixedCosts(fixed,[{...tx,amount:-60000,memo:'기타 매장'}],period,'2026-10-26')[0].status,'unconfirmed');
 const data=[{...tx,id:'2',memo:'통신비',amount:-66000}];
 assert.equal(m.reconcileFixedCosts(fixed,data,period,'2026-10-26')[0].status,'changed');
 assert.equal(m.reconcileFixedCosts(fixed,[...data,{...data[0],id:'3'}],period,'2026-10-26')[0].status,'ambiguous');
 assert.equal(m.reconcileFixedCosts(fixed,data,period,'2026-10-26')[0].actual,66000);
});
test('special event tags change comparison only, never total ledger consumption',()=>{
 const list=[tx,{...tx,id:'2',amount:-10000,memo:'여행 식사'},{...tx,id:'3',amount:-500,category:'상환'}];
 const tags=[{transaction_key:'id:2',event_tag:'시즈오카'}];
 const s=m.spendingSummary(list,tags,item=>item.category==='상환');
 assert.equal(s.total,15500); assert.equal(s.special,10000); assert.equal(s.regular,5500);
 assert.equal(s.events[0].name,'시즈오카');
});
test('card spend evidence is not called official eligible spending',()=>{
 const cdata=[{name:'삼성카드',target_amt:500000,card_status:'active'}];
 const r=m.cardUsage(cdata,[tx],()=>false)[0];
 assert.equal(r.observed,5500);assert.equal(r.target,500000);assert.equal(r.coverage,'matched');
 assert.equal(m.cardUsage([{...cdata[0],name:'X'}],[tx],()=>false)[0].coverage,'unknown');
});

test('owner-only SQL tables isolate rules/tags and reject anonymous writes',async()=>{
 const db=new PGlite(),a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002';
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('"+a+"'),('"+b+"');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;");
  const sql=await readFile(new URL('../../supabase/migrations/20261024090000_finance_intelligence.sql',import.meta.url),'utf8');
  await db.exec(sql);
  await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','"+a+"',false);");
  await db.exec("insert into finance_transaction_rules(match_text,match_type,target_type,target_category,target_subcategory) values('스타벅스','지출','지출','식비','카페')");
  await db.exec("insert into finance_transaction_tags(transaction_key,event_tag) values('id:1234','시즈오카')");
  assert.equal((await db.query('select * from finance_transaction_rules')).rows.length,1);
  await assert.rejects(()=>db.query("insert into finance_transaction_rules(match_text,match_type,target_type,target_category,target_subcategory) values('x','지출','지출','식비','카페')"),/check constraint/);
  await db.exec("select set_config('request.jwt.claim.sub','"+b+"',false)");
  assert.equal((await db.query('select * from finance_transaction_rules')).rows.length,0);
  assert.equal((await db.query('select * from finance_transaction_tags')).rows.length,0);
  await assert.rejects(()=>db.query("insert into finance_transaction_tags(user_id,transaction_key,event_tag) values('"+a+"','id:zzz','부정')"),/row-level security/);
  await db.exec("reset role;set role anon");
  await assert.rejects(()=>db.query("select * from finance_transaction_tags"),/permission denied/);
 }finally{await db.close();}
});
