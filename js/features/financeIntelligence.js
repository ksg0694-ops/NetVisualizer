(function (root) {
  'use strict';
  const M = root.FinanceIntelligenceModel;
  if (!M) return;
  let owner='', loaded=false, loading=false, busy=false, request=0, selected=null, periods=[], ruleFor='', message='', messageError=false;
  let data={rules:[],tags:[],fixed:[],cards:[]};
  const money = n => Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
  const esc = value => root.AppUtils.escapeHtml(String(value ?? ''));
  const attr = value => root.AppUtils.escapeAttr(String(value ?? ''));
  const node = () => document.getElementById('finance-intelligence-panel');
  const context = () => root.getFixedCostContext?.() || {};
  const txs = () => selected?.transactions || [];
  function reset(id) {owner=id;loaded=false;loading=false;busy=false;data={rules:[],tags:[],fixed:[],cards:[]};ruleFor='';message='';request++;}
  function status(text, error=false) {message=text;messageError=error;draw();}
  async function list(client, table, columns) {
    const rows=[];
    for(let offset=0;offset<10000;offset+=500) {
      const {data:batch,error}=await client.from(table).select(columns).eq('user_id',owner).range(offset,offset+499);
      if(error) throw new Error(table+' 읽기 실패: 데이터베이스 마이그레이션과 로그인 상태를 확인하세요.');
      rows.push(...(batch||[]));
      if(!batch || batch.length<500) return rows;
    }
    throw new Error(table+' 데이터가 너무 많아 일부만 읽혔습니다.');
  }
  async function load() {
    const c=context(), current=owner, token=++request;
    if(!c.userId||!c.client||loading)return;
    loading=true;draw();
    try {
      const [rules,tags,fixed,cards]=await Promise.all([
        list(c.client,'finance_transaction_rules','id,match_text,match_type,match_method,target_type,target_category,target_subcategory,enabled'),
        list(c.client,'finance_transaction_tags','transaction_key,event_tag'),
        root.FixedCostsStore.create(()=>context()).list(),
        root.CardStore.create(()=>root.getCardContext()).list()
      ]);
      if(owner!==current||token!==request)return;
      data={rules,tags,fixed,cards};loaded=true;message='';messageError=false;
    }catch(err){
      if(owner===current&&token===request){message=err.message;messageError=true;}
    }finally{if(owner===current&&token===request){loading=false;draw();if(loaded)root.CashflowLab?.render();}}
  }
  function rowFor(key) {return txs().find(tx=>M.txKey(tx)===key);}
  function suggestedRows() {
    return txs().map(tx=>({tx, suggestion:M.suggest(tx,data.rules)})).filter(x=>x.suggestion.status==='suggested'||x.suggestion.status==='conflict');
  }
  function ruleEditor(tx) {
    if(!tx) return '';
    return '<form id="fi-rule-form" class="fi-form"><strong>거래 기준 분류 규칙 등록</strong>'+
      '<label>가맹점 문자열<input name="match_text" required minlength="2" maxlength="120" value="'+attr(tx.memo||'')+'"></label>'+
      '<label>결제수단 필터 (선택)<input name="match_method" maxlength="80" value=""></label>'+
      '<label>대상 유형<select name="target_type">'+['지출','수입','이체'].map(t=>'<option'+(t===tx.type?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
      '<label>대분류<input name="target_category" required maxlength="80" value="'+attr(tx.category||tx.cat||'')+'"></label>'+
      '<label>소분류<input name="target_subcategory" required maxlength="80" value="'+attr(tx.subcategory||tx.subcat||'')+'"></label>'+
      '<div class="fi-actions"><button type="submit">이후 거래에 추천</button><button type="button" data-fi-close-editor>취소</button></div>'+
      '<p class="fi-note">규칙은 다음 거래에만 제안됩니다. 기존 원장이나 확정된 월 마감은 자동 변경되지 않습니다.</p></form>';
  }
  function transactionMarkup() {
    const list=[...txs()].sort((a,b)=>String(b.date+' '+(b.time||'')).localeCompare(String(a.date+' '+(a.time||'')))).slice(0,60);
    if(!list.length)return '<p class="fi-note">선택한 기간에 거래가 없습니다.</p>';
    return '<p class="fi-note">최근 60건 표시 · 마감 전 추천 적용 가능 · 특별지출 태그는 합계 원장을 수정하지 않습니다.</p>'+
      '<div class="fi-rows">'+list.map(tx=>{
        const key=M.txKey(tx), suggestion=M.suggest(tx,data.rules);
        const tag=data.tags.find(row=>row.transaction_key===key)?.event_tag||'';
        const closed=selected?.basis==='calendar'||selected?.closeStatus==='confirmed'||selected?.closeStatus==='stale';
        let recommendation='';
        if(suggestion.status==='suggested') recommendation='<button type="button" data-fi-apply="'+attr(key)+'"'+(closed?' disabled':'')+'>추천 적용: '+esc(suggestion.classification.category)+' / '+esc(suggestion.classification.subcategory)+'</button>';
        if(suggestion.status==='conflict')recommendation='<span class="fi-warning">규칙 충돌: 수동 검토</span>';
        return '<div class="fi-transaction" data-fi-tx="'+attr(key)+'"><div><strong>'+esc(tx.memo||'내용 없음')+'</strong><small>'+esc(tx.date)+' · '+money(Math.abs(Number(tx.amount)||0))+' · '+esc(tx.category||tx.cat||'미분류')+'</small></div>'+
          '<div class="fi-actions">'+recommendation+
          '<button type="button" data-fi-rule-open="'+attr(key)+'">규칙 등록</button>'+
          '<input data-fi-tag-input aria-label="특별지출 행사명" maxlength="80" placeholder="특별지출 행사명" value="'+attr(tag)+'">'+
          '<button type="button" data-fi-tag-save="'+attr(key)+'">태그 저장</button></div></div>';
      }).join('')+'</div>'+ruleEditor(rowFor(ruleFor));
  }
  function draw() {
    const el=node();if(!el)return;
    if(!owner){el.innerHTML='<article class="cfl-panel"><h3>거래 자동화 · 결제 검토</h3><p class="fi-note">로그인하면 이용할 수 있습니다.</p></article>';return;}
    if(!loaded){el.innerHTML='<article class="cfl-panel"><h3>거래 자동화 · 결제 검토</h3><p class="fi-note">'+esc(loading?'서버에서 설정을 가져오는 중…':message||'연결 필요')+'</p>'+(!loading?'<button type="button" data-fi-reload>다시 연결</button>':'')+'</article>';bind(el);return;}
    const transactions=txs(), overview=M.spendingSummary(transactions,data.tags,root.isRepaymentExpense||(()=>false));
    const due=M.reconcileFixedCosts(data.fixed,transactions,selected||{},root.AppUtils.toLocalDateString());
    const cards=M.cardUsage(data.cards,transactions,root.isRepaymentExpense||(()=>false));
    el.innerHTML='<div class="fi-heading"><h3>거래 자동화 · 결제 검토</h3><button type="button" data-fi-reload'+(busy?' disabled':'')+'>데이터 새로고침</button></div>'+
      '<p class="fi-note">범위: '+esc(selected?.startDate||'—')+' ~ '+esc(selected?.endDate||'—')+' · 원본 거래는 변경하지 않습니다.</p>'+
      (message?'<p role="status" class="'+(messageError?'fi-warning':'fi-status')+'">'+esc(message)+'</p>':'')+
      '<div class="fi-summary"><div><span>전체 소비</span><strong>'+money(overview.total)+'</strong></div><div><span>특별지출</span><strong>'+money(overview.special)+'</strong></div><div><span>일상 소비</span><strong>'+money(overview.regular)+'</strong></div></div>'+
      (overview.excludedForeign?'<p class="fi-note">외화 거래 '+overview.excludedForeign+'건은 환율 정보가 없어 합산 제외</p>':'')+
      '<div class="fi-grid">'+
      '<article class="cfl-panel"><h4>고정비 예정·실적 대조</h4><p class="fi-note">금액만 같다는 이유로 결제 완료 처리하지 않습니다. 거래명·결제수단·예정일 ±5일 일치가 필요합니다.</p>'+
        (due.length?'<div class="fi-rows">'+due.map(item=>{
          const labels={matched:'반영 확인',changed:'금액 변경',ambiguous:'후보 중복',unconfirmed:'내역 미확인',scheduled:'결제 예정','no-date':'결제일 미정'};
          return '<div class="fi-line"><span>'+esc(item.row.name)+'<small>'+esc(item.dueDate||'날짜 없음')+'</small></span><span>'+money(item.planned)+'<small>'+esc(labels[item.status]||item.status)+(item.actual!=null?' · 실제 '+money(item.actual):'')+'</small></span></div>';
        }).join('')+'</div>':'<p class="fi-note">등록된 활성 고정비가 없거나 이 기간에 예정된 결제가 없습니다.</p>')+
      '</article>'+
      '<article class="cfl-panel"><h4>카드 이용액 · 실적 참고</h4><p class="fi-note">선택 급여기간 거래명에 카드명이 확인된 건만 집계합니다. 카드사 공식 실적·청구예정액이 아닙니다.</p>'+
        (cards.length?'<div class="fi-rows">'+cards.map(item=>'<div class="fi-line"><span>'+esc(item.card.name)+'<small>'+esc(item.matched+'건 매칭')+'</small></span><span>'+ (item.matched?money(item.observed):'매칭 없음')+'<small>실적 목표 '+money(item.target)+'</small></span></div>').join('')+'</div>':'<p class="fi-note">등록된 카드가 없습니다.</p>')+
      '</article></div>'+
      '<details class="cfl-evidence" open><summary>분류 추천 · 특별지출 태그 ('+transactions.length+'건)</summary>'+
        '<p class="fi-note">일상 소비는 전체 소비에서 태그 지정된 특별지출만 뺀 비교용 수치입니다.</p>'+transactionMarkup()+
      '</details>'+
      '<details class="cfl-evidence"><summary>내 분류 규칙 ('+data.rules.length+'개)</summary><div class="fi-rows">'+
        (data.rules.length?data.rules.map(r=>'<div class="fi-line"><span>'+esc(r.match_text)+' → '+esc(r.target_category)+' / '+esc(r.target_subcategory)+'</span><button type="button" data-fi-rule-delete="'+attr(r.id)+'">삭제</button></div>').join(''):'<p class="fi-note">아직 저장된 규칙이 없습니다. 거래에서 규칙 등록을 눌러 추가하세요.</p>')+
      '</div></details>';
    bind(el);
  }
  function bind(el) {
    el.onclick=async event=>{
      if(busy)return;
      const button=event.target.closest('button');
      if(!button)return;
      if(button.hasAttribute('data-fi-reload')){loaded=false;load();return;}
      if(button.hasAttribute('data-fi-close-editor')){ruleFor='';draw();return;}
      if(button.hasAttribute('data-fi-rule-open')){ruleFor=button.dataset.fiRuleOpen;draw();return;}
      if(button.hasAttribute('data-fi-apply')){
        const tx=rowFor(button.dataset.fiApply),period=selected;
        if(!tx||!period)return;
        if(period.basis==='calendar'){status('분류 변경은 급여주기 보기에서 적용하세요.',true);return;}
        const suggestion=M.suggest(tx,data.rules);
        if(suggestion.status!=='suggested')return;
        try{root.MonthlyCloseFeature.applySuggestedClassification(period,tx,suggestion.classification);status('분류 수정안을 월 마감에 저장했습니다. 확정 전 확인하세요.');}
        catch(err){status('분류 적용 실패: '+err.message,true);}
        return;
      }
      if(button.hasAttribute('data-fi-tag-save')){
        const key=button.dataset.fiTagSave,tx=rowFor(key),field=button.closest('[data-fi-tx]')?.querySelector('[data-fi-tag-input]');
        if(!tx||!field)return;
        const tag=field.value.trim(),c=context(),original=owner;
        if(tag.length>80){status('행사명은 80자 이내로 입력해 주세요.',true);return;}
        busy=true;button.disabled=true;
        try{
          let query;
          if(tag){query=c.client.from('finance_transaction_tags').upsert({user_id:original,transaction_key:key,event_tag:tag,updated_at:new Date().toISOString()},{onConflict:'user_id,transaction_key'});}
          else query=c.client.from('finance_transaction_tags').delete().eq('user_id',original).eq('transaction_key',key);
          const {error}=await query;
          if(error)throw error;
          if(context().userId!==original)return;
          data.tags=data.tags.filter(row=>row.transaction_key!==key);
          if(tag)data.tags.push({transaction_key:key,event_tag:tag});
          status(tag?'특별지출 태그 저장 완료':'특별지출 태그 해제 완료');
          root.CashflowLab?.render();
        }catch(err){status('태그 저장 실패: '+err.message,true);}
        finally{busy=false;draw();}
        return;
      }
      if(button.hasAttribute('data-fi-rule-delete')){
        const id=button.dataset.fiRuleDelete,c=context(),original=owner;
        busy=true;
        try{
          const {error}=await c.client.from('finance_transaction_rules').delete().eq('user_id',original).eq('id',id);
          if(error)throw error;
          if(context().userId!==original)return;
          data.rules=data.rules.filter(rule=>String(rule.id)!==id);
          status('규칙을 삭제했습니다.');
        }catch(err){status('규칙 삭제 실패: '+err.message,true);}
        finally{busy=false;draw();}
      }
    };
    el.onsubmit=async event=>{
      if(event.target.id!=='fi-rule-form')return;
      event.preventDefault();
      if(busy)return;
      const tx=rowFor(ruleFor),c=context(),original=owner;
      if(!tx)return;
      const f=new FormData(event.target),match=String(f.get('match_text')||'').trim();
      const category=String(f.get('target_category')||'').trim(),sub=String(f.get('target_subcategory')||'').trim();
      if(match.length<2||!category||!sub){status('가맹점·대분류·소분류를 입력해 주세요.',true);return;}
      busy=true;
      try{
        const payload={user_id:original,match_text:match,match_type:tx.type,match_method:String(f.get('match_method')||'').trim(),
          target_type:String(f.get('target_type')||tx.type),target_category:category,target_subcategory:sub};
        const {data:added,error}=await c.client.from('finance_transaction_rules').insert(payload).select('id,match_text,match_type,match_method,target_type,target_category,target_subcategory,enabled').single();
        if(error)throw error;
        if(context().userId!==original)return;
        data.rules.push(added);ruleFor='';status('새 분류 규칙을 저장했습니다. 거래에서 제안을 확인하세요.');
      }catch(err){status('규칙 저장 실패: '+err.message,true);}
      finally{busy=false;draw();}
    };
  }
  function render(period, allPeriods=[]) {
    if(!node())return;
    selected=period||null;periods=allPeriods;
    const id=context().userId||'';
    if(id!==owner)reset(id);
    draw();
    if(id&&!loaded&&!loading)load();
  }
  function getTags() {
    return loaded && owner && context().userId === owner ? data.tags.map(tag=>({...tag})) : null;
  }
  root.FinanceIntelligence=Object.freeze({render,getTags,refresh:()=>{if(owner){loaded=false;load();}}});
})(globalThis);
