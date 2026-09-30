(function(root){
 'use strict';
 const columns='id,user_id,name,bank,purpose,image_data,target_amt,annual_fee,prt_ideal,prt_real,card_type,card_status,pay_day,issued_on,benefits,note,deleted,version,create_key';
 const types={unspecified:'미지정',credit:'신용',debit:'체크'},statuses={active:'사용 중',closed:'해지'};
 const officialImages=new Set(['https://m.hanacard.co.kr/ATTACH/NEW_MOBILE/images/cardinfo/card_img/13889.gif','https://cdn.www.shinhancard.com/pconts/static/images/card/plate/BGCBUR_00_h_f_d.webp']);
 function imageUrl(value){return typeof value==='string'&&(officialImages.has(value)||/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value))?value:'';}
 function normalize(input){
  const p={};for(const [key,max] of Object.entries({name:120,bank:100,purpose:200,benefits:2000,note:2000})){p[key]=String(input[key]??'').trim();if(p[key].length>max)throw Error('입력 내용이 너무 깁니다.');}
  if(!p.name||!p.bank)throw Error('카드명과 카드사를 입력해 주세요.');
  for(const [key,values] of [['card_type',types],['card_status',statuses]]){if(!Object.hasOwn(values,input[key]))throw Error('카드 종류와 상태를 선택해 주세요.');p[key]=input[key];}
  for(const key of ['target_amt','annual_fee','pay_day']){const v=input[key];p[key]=v==null||String(v).trim()===''?null:Number(v);if(p[key]!==null&&(!Number.isSafeInteger(p[key])||p[key]<0||p[key]>1e12))throw Error('금액은 0 이상의 정수로 입력해 주세요.');}
  if(p.pay_day!==null&&(p.pay_day<1||p.pay_day>31))throw Error('결제일은 1~31일입니다.');
  p.issued_on=input.issued_on||null;if(p.issued_on&&!/^\d{4}-\d{2}-\d{2}$/.test(p.issued_on))throw Error('발급일을 확인해 주세요.');
  if(p.issued_on&&(!Number.isFinite(Date.parse(p.issued_on))||new Date(p.issued_on).toISOString().slice(0,10)!==p.issued_on||p.issued_on<'1900-01-01'||p.issued_on>'2200-12-31'))throw Error('발급일을 확인해 주세요.');
  return p;
 }
 function create(getContext){
  const context=()=>{const c=getContext();if(!c?.userId||!c.client)throw Error('로그인 후 이용해 주세요.');return c;};
  const same=id=>{if(getContext()?.userId!==id)throw Error('계정이 변경되었습니다. 다시 열어 주세요.');};
  async function write(payload,base,key){const c=context();let q=c.client.from('cards');q=base?q.update(payload).eq('user_id',c.userId).eq('id',base.id).eq('version',base.version):q.insert({...payload,user_id:c.userId,create_key:key});const {data,error}=await q.select(columns);same(c.userId);if(error)throw Error('저장하지 못했습니다. 입력을 유지했습니다. 새로고침으로 저장 여부를 확인해 주세요.');if(data?.length!==1)throw Error('다른 기기에서 변경되었습니다. 취소 → 새로고침 후 다시 수정해 주세요.');return data[0];}
  return {async list(){const c=context(),rows=[];for(let n=0;;n+=500){const {data,error}=await c.client.from('cards').select(columns).eq('user_id',c.userId).order('id').range(n,n+499);same(c.userId);if(error)throw Error('카드를 불러오지 못했습니다. 다시 시도해 주세요.');rows.push(...data);if(data.length<500)return rows;}},save:(input,base,key)=>write(normalize(input),base,key),trash:(base,deleted)=>{if(!base?.id||typeof deleted!=='boolean')throw Error('카드를 다시 선택해 주세요.');return write({deleted},base);}};
 }
 root.CardStore=Object.freeze({create,normalize,types,statuses,imageUrl});
})(globalThis);
