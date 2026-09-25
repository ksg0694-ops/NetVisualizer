(function(root){
    'use strict';
    let chart=null, mode='balance', year='all', owner='', source=null, model=null, points=[];
    const el=id=>document.getElementById(id), won=v=>v==null?'—':`${Math.round(v).toLocaleString('ko-KR')}원`;
    const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    function mount(container){
        container.innerHTML=`<div class="bs-toolbar"><small id="bs-date"></small><div class="bs-actions"><a id="bs-sheet" target="_blank" rel="noopener noreferrer" hidden><i class="far fa-file-lines" aria-hidden="true"></i> 입력 시트</a><button id="bs-edit" type="button">금액 수정</button></div></div>
        <p id="bs-status" role="status"></p><div id="bs-content"><section class="bs-kpis" aria-label="재무상태"><div><i class="fas fa-coins bs-kpi-icon" aria-hidden="true"></i><div><span>순자산</span><strong id="pf-networth"></strong></div></div><div><i class="fas fa-layer-group bs-kpi-icon" aria-hidden="true"></i><div><span>총자산</span><strong id="pf-total-assets"></strong></div></div><div><i class="far fa-credit-card bs-kpi-icon" aria-hidden="true"></i><div><span>총부채</span><strong id="pf-total-liabilities"></strong></div></div></section>
        <div class="bs-grid"><section class="bs-panel"><h3>자산</h3><div id="portfolio-accordion-wrapper"></div></section><section class="bs-panel"><div class="bs-heading"><h3>순자산 흐름</h3><div class="bs-actions"><label class="bs-sr" for="bs-year">조회 연도</label><select id="bs-year"></select><div class="bs-segment"><button type="button" id="bs-balance" aria-pressed="true">잔액</button><button type="button" id="bs-change" aria-pressed="false">증감</button></div></div></div><div class="bs-chart"><canvas id="bs-chart" role="img" aria-label="월별 순자산 차트"></canvas></div><p id="bs-history-note" class="bs-note"></p></section></div>
        <details class="bs-analysis"><summary>월별 증가 분석</summary><p class="bs-note">순자산 증가 = 투자 평가변동 + 순저축 + 기타·미분류</p><div class="bs-table"><table><thead><tr><th>월</th><th>순자산</th><th>증가액</th><th>투자 평가변동</th><th>순저축</th><th>기타</th><th>대사 차이</th><th>상태</th></tr></thead><tbody id="bs-months"></tbody></table></div><p class="bs-note">투자·연금 입출금 제외 · 월 기준 자료가 없으면 미산출</p></details></div>`;
        el('bs-year').onchange=e=>{year=e.target.value;renderChart();};
        for(const value of ['balance','change'])el(`bs-${value}`).onclick=()=>{mode=value;renderChart();};
        el('bs-edit').onclick=()=>root.openPortfolioEditModal();
    }
    function renderChart(){
        const selected=points.filter(p=>year==='all'||p.month.startsWith(year));
        const labels=selected.map(p=>p.month.slice(2).replace('-','.'));
        const datasets=mode==='balance' ? [{label:'순자산',data:selected.map(p=>p.netWorth),borderColor:'#4938ff',backgroundColor:'#4938ff',pointRadius:3,borderWidth:2.5,tension:0,spanGaps:false}] : [{label:'순자산 증가',data:selected.map(p=>p.change),backgroundColor:selected.map(p=>p.change>=0?'#e45c68':'#5284c4'),borderRadius:3}];
        chart?.destroy();
        chart=new root.Chart(el('bs-chart'),{type:mode==='balance'?'line':'bar',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},scales:{x:{grid:{display:false},ticks:{maxRotation:0,maxTicksLimit:7}},y:{beginAtZero:mode==='change',ticks:{callback:v=>`${(v/10000).toLocaleString()}만`},grid:{color:'#f1f3f5'}}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${won(c.raw)}`}}}}});
        for(const v of ['balance','change'])el(`bs-${v}`).setAttribute('aria-pressed',String(mode===v));
        const inputPoint=selected.find(p=>p.status==='input');
        el('bs-history-note').textContent=selected.length?(inputPoint?`${Number(inputPoint.month.slice(5))}월 · ${inputPoint.asOf.slice(5).replace('-','/')} 입력 기준`:'월별 순자산'):'저장된 월 이력이 없습니다.';
        el('bs-months').innerHTML=[...selected].reverse().map(p=>`<tr><th scope="row">${esc(p.month)}</th>${[p.netWorth,p.change,p.performance,p.saving,p.other,p.difference].map(v=>`<td>${won(v)}</td>`).join('')}<td>${p.status==='input'?'입력 기준':p.status==='duplicate'?'중복 확인':p.status==='missing'?'기록 없음':p.attribution==='reconciled'?'대사 완료':p.attribution==='difference'?'차이 확인':'분해자료 없음'}</td></tr>`).join('');
    }
    function render(){
        const container=el('portfolio-view');if(!container)return;
        source=root.getBalanceSheetSource();
        if(owner!==source.owner){owner=source.owner;year='all';mode='balance';chart?.destroy();chart=null;}
        if(!el('bs-content'))mount(container);
        if(!source.authenticated){el('bs-content').hidden=true;el('bs-status').textContent='로그인 후 자산을 확인할 수 있습니다.';el('bs-sheet').hidden=true;el('bs-edit').hidden=true;return;}
        el('bs-content').hidden=false;
        model=root.BalanceSheetModel.current(source.positions,{today:source.today,getPrice:source.getPrice,getFx:source.getFx});
        points=root.BalanceSheetModel.reconcile(root.BalanceSheetModel.timeline(source.history,source),source.flows);
        el('pf-networth').textContent=source.positions.length?won(model.netWorth):'—';el('pf-total-assets').textContent=source.positions.length?won(model.assets):'—';el('pf-total-liabilities').textContent=source.positions.length?won(model.debt):'—';
        el('bs-date').textContent=source.asOf?`보유 기준 ${source.asOf}`:'';
        const url=String(source.url||'');el('bs-sheet').hidden=!/^https:\/\/docs\.google\.com\/spreadsheets\/d\//.test(url);el('bs-sheet').href=el('bs-sheet').hidden?'#':url;
        el('bs-edit').hidden=Boolean(source.url);
        el('bs-status').textContent=!source.positions.length?'등록된 자산이 없습니다.':model.stale+model.missing?`시세 미연결·지연 ${model.stale+model.missing}건 · 입력 금액 유지`:'';
        el('portfolio-accordion-wrapper').innerHTML=model.groups.map(g=>`<details class="bs-group"><summary><span class="bs-icon bs-${g.key}"><i class="fas ${g.icon}" aria-hidden="true"></i></span><span>${g.label}</span><strong>${won(g.net)}</strong><i class="fas fa-chevron-down bs-chevron" aria-hidden="true"></i></summary>${g.debt?`<div class="bs-housing"><span>자산 <b>${won(g.assets)}</b></span><span>대출 <b>${won(g.debt)}</b></span></div>`:''}<div class="bs-items">${g.items.map(p=>`<div><span>${esc(p.name)}${p.isDebt?' (부채)':''}<small>${esc(p.account||'')}</small></span><span>${p.isDebt?'−':''}${won(p.value)}</span></div>`).join('')||'<p class="bs-note">등록된 항목 없음</p>'}</div></details>`).join('');
        const years=[...new Set(points.map(p=>p.month.slice(0,4)))].sort().reverse();
        el('bs-year').innerHTML='<option value="all">전체</option>'+years.map(y=>`<option value="${y}">${y}년</option>`).join('');if(year!=='all'&&!years.includes(year))year='all';el('bs-year').value=year;
        renderChart();
    }
    root.BalanceSheet=Object.freeze({render});
})(globalThis);
