import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const source=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const c=vm.createContext({});vm.runInContext(await source('js/features/cardStore.js'),c);const S=c.CardStore;
const input={name:'카드',bank:'카드사',card_type:'credit',card_status:'active',annual_fee:'0',target_amt:'',pay_day:'14',issued_on:'2024-02-29'};
test('card validation distinguishes unknown and zero; no sensitive credential payload',()=>{
 const p=S.normalize({...input,image_data:'bad',prt_real:'bad',user_id:'bad'});assert.equal(p.annual_fee,0);assert.equal(p.target_amt,null);assert.equal(p.pay_day,14);assert.ok(!('image_data' in p));assert.ok(!('user_id' in p));
 for(const patch of [{name:''},{bank:''},{annual_fee:-1},{annual_fee:1.5},{pay_day:0},{pay_day:32},{issued_on:'2026-02-30'},{card_type:'bad'},{card_status:'bad'},{note:'x'.repeat(2001)}])assert.throws(()=>S.normalize({...input,...patch}));
});
test('card writes use version/owner guards and trash is partial; failures retain edits',async()=>{
 let userId='a',payload,filters=[],response={data:[{id:1,version:2}],error:null};
 const q={update(p){payload=p;return this;},insert(p){payload=p;return this;},eq(k,v){filters.push([k,v]);return this;},select(){return Promise.resolve(response);}};
 const store=S.create(()=>({userId,client:{from(t){assert.equal(t,'cards');return q;}}}));
 await store.save(input,{id:1,version:1});assert.deepEqual(filters,[['user_id','a'],['id',1],['version',1]]);assert.ok(!('image_data' in payload));
 await store.trash({id:1,version:2},true);assert.deepEqual(JSON.parse(JSON.stringify(payload)),{deleted:true});
 await store.save(input,null,'creation-key');assert.equal(payload.create_key,'creation-key');assert.equal(payload.user_id,'a');
 response={data:[],error:null};await assert.rejects(()=>store.trash({id:1,version:1},false),/다른 기기/);
 response={data:null,error:{}};await assert.rejects(()=>store.save(input,{id:1,version:1}),/저장하지 못/);
 q.select=()=>{userId='b';return Promise.resolve({data:[{}],error:null});};await assert.rejects(()=>store.trash({id:1,version:1},false),/계정이 변경/);
});
test('card pagination never returns partial rows on failure',async()=>{
 let page=0;const q={select(){return this;},eq(){return this;},order(){return this;},range(){page++;return page===1?{data:Array(500).fill({id:1}),error:null}:{data:null,error:{}};}};
 await assert.rejects(()=>S.create(()=>({userId:'a',client:{from:()=>q}})).list(),/불러오지 못/);assert.equal(page,2);
});
test('card migration preserves legacy fields and guards versions, identities and create retry',async()=>{
 const db=new PGlite();try{
 await db.exec("create table cards(id serial primary key,user_id uuid not null,name text not null,image_data text,prt_real text,created_at timestamptz default now());insert into cards(user_id,name,image_data,prt_real) values('10000000-0000-0000-0000-000000000001','Old','image','2%');");
 await db.exec(await source('supabase/migrations/20260930110000_card_management.sql'));
 assert.equal((await db.query('select image_data from cards')).rows[0].image_data,'image');
 assert.equal((await db.query("update cards set deleted=true where id=1 and version=1 returning version")).rows[0].version,2);
 assert.equal((await db.query('update cards set deleted=false where id=1 and version=1 returning id')).rows.length,0);
 await db.exec('update cards set deleted=false where id=1 and version=2');
 for(const assignment of ["card_type='bad'","card_status='bad'","pay_day=32","id=2","user_id='20000000-0000-0000-0000-000000000002'"])await assert.rejects(()=>db.exec('update cards set '+assignment+' where id=1'));
 await db.exec("update cards set create_key='30000000-0000-0000-0000-000000000003' where id=1");
 await assert.rejects(()=>db.exec("insert into cards(user_id,name,create_key) values('10000000-0000-0000-0000-000000000001','Retry','30000000-0000-0000-0000-000000000003')"),/unique/);
 assert.equal((await db.query('select prt_real from cards')).rows[0].prt_real,'2%');
 }finally{await db.close();}
});
test('card UI integrates with auth reset, preserves insurance, and confirms deletion',async()=>{
 const core=await source('js/features/appCore.js'),ui=await source('js/features/cardManager.js'),addons=await source('js/features/cashflowControls.js');
 assert.ok(core.includes('window.CardManager?.reset()'));assert.ok(addons.includes('window.CardManager?.render()'));assert.ok(addons.includes('addonInsurances.map'));
 for(const s of ['showModal()','token!==generation','cm-confirm-yes','esc(c.name)','삭제 취소'])assert.ok(ui.includes(s));
 assert.ok(!ui.includes('<summary>'));assert.ok(!ui.includes("select('card_status'"));
 assert.ok(!ui.includes('cm-count'));assert.ok(!ui.includes('보유 카드'));
 assert.ok(ui.includes("$('cm-header')?.appendChild"));assert.ok(ui.includes("querySelector('.cm-toolbar')?.remove()"));
 assert.ok((await source('index.html')).includes('id="cm-header"'));
});
test('card images allow only verified official images and safe embedded raster data',()=>{
 assert.ok(S.imageUrl('https://m.hanacard.co.kr/ATTACH/NEW_MOBILE/images/cardinfo/card_img/13889.gif'));
 assert.ok(S.imageUrl('https://cdn.www.shinhancard.com/pconts/static/images/card/plate/BGCBUR_00_h_f_d.webp'));
 assert.ok(S.imageUrl('data:image/png;base64,YQ=='));
 for(const url of ['javascript:alert(1)','https://evil.example/a.png','data:image/svg+xml;base64,YQ==','https://www.shinhancard.com.evil/a.png'])assert.equal(S.imageUrl(url),'');
});
