(function (root) {
    'use strict';
    let rows = [], editing = false, busy = false, loaded = false, generation = 0, base = null, draftId = '', owner = '';
    const store = root.FixedCostsStore.create(() => root.getFixedCostContext());
    const money = n => `${Number(n).toLocaleString('ko-KR')}원`;
    const el = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
    function message(value, error = false) { el('fc-message').textContent = value; el('fc-message').dataset.error = String(error); }
    function mount(container) {
        container.innerHTML = `<div class="fc-header"><div><p class="fc-eyebrow">LIFE · MONTHLY COSTS</p><h2>고정비 관리</h2></div><div class="fc-actions"><button id="fc-refresh" type="button">새로고침</button><button id="fc-add" class="fc-primary" type="button">항목 추가</button></div></div>
        <p id="fc-message" role="status" aria-live="polite"></p>
        <div class="fc-summary" id="fc-summary"></div>
        <form id="fc-form" hidden><h3 id="fc-form-title">항목 추가</h3><fieldset id="fc-fields"><div class="fc-fields">
        <label>항목명<input name="name" maxlength="80" required></label>
        <label>분류<input name="category" list="fc-categories" maxlength="40" required><datalist id="fc-categories"><option>보험</option><option>통신비</option><option>인터넷</option><option>구독비</option><option>관리비</option><option>기타</option></datalist></label>
        <label>비용 구분<select name="kind"><option value="fixed">정액 고정비</option><option value="essential">변동 필수비</option></select></label>
        <label>월 예정 금액 (원)<input name="monthly_amount" type="number" inputmode="numeric" min="0" max="1000000000" step="1" required></label>
        <label>매월 결제일<input name="pay_day" type="number" inputmode="numeric" min="1" max="31" step="1" placeholder="미정"></label>
        <label>결제수단<input name="payment_method" maxlength="80" placeholder="카드 또는 계좌 별칭"></label>
        <label>상태<select name="is_active"><option value="true">사용 중</option><option value="false">중지</option></select></label>
        <label>메모<input name="note" maxlength="500" placeholder="연납은 월 환산액 등"></label>
        </div><p class="fc-note">예정 금액만 관리하며 실제 거래·보험 원본은 바뀌지 않습니다. 없는 결제일은 해당 월 말일로 확인하세요.</p>
        <div class="fc-actions"><button type="submit" class="fc-primary">저장</button><button type="button" id="fc-cancel">취소</button></div></fieldset></form>
        <div class="fc-list-heading"><h3>관리 항목</h3><label>표시 <select id="fc-filter"><option value="active">사용 중</option><option value="all">전체</option><option value="paused">중지</option></select></label></div>
        <div id="fc-list"></div>
        <details class="fc-candidates"><summary>최근 거래에서 항목 가져오기</summary><p class="fc-note">기록된 고정비를 초안으로 가져옵니다. 월 예정 금액은 확인 후 저장하세요.</p><div id="fc-candidates"></div></details>`;
        el('fc-add').onclick = () => open();
        el('fc-refresh').onclick = () => load();
        el('fc-cancel').onclick = close;
        el('fc-filter').onchange = draw;
        el('fc-form').onsubmit = save;
    }
    function controls() {
        const disabled = busy || editing || !owner || !loaded;
        el('fc-add').disabled = disabled; el('fc-refresh').disabled = busy || editing || !owner;
        el('fc-fields').disabled = busy;
        el('fc-list').querySelectorAll('button').forEach(b => { b.disabled = disabled; });
        el('fc-candidates').querySelectorAll('button').forEach(b => { b.disabled = disabled; });
    }
    function draw() {
        const active = rows.filter(r => r.is_active), sum = kind => active.filter(r => r.kind === kind).reduce((n,r) => n + Number(r.monthly_amount), 0);
        el('fc-summary').innerHTML = [['정액 · 월 예정',sum('fixed')],['변동 필수 · 월 예상',sum('essential')],['전체 · 월 예상',sum('fixed')+sum('essential')]].map(([label,value])=>`<div><span>${label}</span><strong>${loaded ? money(value) : '—'}</strong></div>`).join('');
        const filter = el('fc-filter').value;
        const visible = rows.filter(r => filter === 'all' || r.is_active === (filter === 'active')).sort((a,b)=>(a.pay_day || 32)-(b.pay_day || 32) || a.name.localeCompare(b.name));
        el('fc-list').innerHTML = visible.length ? visible.map(r => `<article class="fc-item"><div><span class="fc-tag">${esc(r.category)} · ${r.kind === 'fixed' ? '정액' : '변동 필수'}${r.is_active ? '' : ' · 중지'}</span><h4>${esc(r.name)}</h4><p>${r.pay_day ? `매월 ${r.pay_day}일` : '결제일 미정'}${r.payment_method ? ` · ${esc(r.payment_method)}` : ''}</p>${r.note ? `<p>${esc(r.note)}</p>` : ''}</div><div class="fc-item-end"><strong>${money(r.monthly_amount)}<small>/월</small></strong><button type="button" data-edit="${esc(r.id)}">수정</button></div></article>`).join('') : `<p class="fc-empty">${owner ? loaded ? '등록된 항목이 없습니다. 직접 추가하거나 최근 거래에서 가져오세요.' : '고정비를 불러오는 중입니다.' : '로그인 후 고정비를 관리할 수 있습니다.'}</p>`;
        el('fc-list').querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => open(rows.find(r => r.id === b.dataset.edit)); });
        candidates(); controls();
    }
    function candidates() {
        const today = root.AppUtils.toLocalDateString();
        const period = owner ? (root.getCashFlowPeriods?.() || []).filter(p => p.endDate < today && p.transactions?.length).sort((a,b)=>b.endDate.localeCompare(a.endDate))[0] : null;
        const grouped = new Map();
        for (const t of period?.transactions || []) {
            if (t.type !== '지출' || t.category !== '고정비') continue;
            const category = String(t.subcategory || '기타'), name = String(t.memo || category).slice(0,80), key = JSON.stringify([category,name]);
            if (!grouped.has(key)) grouped.set(key,{name,category,kind:category === '관리비' ? 'essential' : 'fixed',monthly_amount:0,pay_day:null,payment_method:'',note:`${period.key} 거래 참고 · 월 예정액 확인 필요`,is_active:true});
            grouped.get(key).monthly_amount += Math.abs(Number(t.amount) || 0);
        }
        const items = [...grouped.values()].filter(c => !rows.some(r=>r.name === c.name && r.category === c.category));
        el('fc-candidates').innerHTML = items.length ? items.map((c,i)=>`<div class="fc-candidate"><span>${esc(c.name)} · ${money(c.monthly_amount)}</span><button type="button" data-candidate="${i}">가져오기</button></div>`).join('') : '<p class="fc-note">가져올 고정비 거래가 없습니다.</p>';
        el('fc-candidates').querySelectorAll('button').forEach(b => { b.onclick = () => open(items[Number(b.dataset.candidate)], true); });
    }
    function open(row = {}, candidate = false) {
        if (busy || editing || !loaded || !owner) return;
        base = row.id && !candidate ? {...row} : null; draftId = root.crypto.randomUUID(); editing = true;
        const defaults = {name:'',category:'기타',kind:'fixed',monthly_amount:'',pay_day:'',payment_method:'',note:'',is_active:true,...row};
        for (const name of ['name','category','kind','monthly_amount','pay_day','payment_method','note','is_active']) el('fc-form').elements.namedItem(name).value = defaults[name] ?? '';
        el('fc-form-title').textContent = base ? '고정비 수정' : '항목 추가';
        el('fc-form').hidden = false; message(''); controls(); el('fc-form').elements.namedItem('name').focus();
    }
    function close() { if (busy) return; editing = false; base = null; el('fc-form').hidden = true; controls(); }
    async function save(event) {
        event.preventDefault(); if (busy || !editing) return;
        const input = Object.fromEntries(new FormData(el('fc-form'))); input.is_active = input.is_active === 'true';
        const token = generation; busy = true; controls(); message('저장 중…');
        try {
            const result = await store.save(input, base, draftId);
            if (token !== generation) return;
            rows = [...rows.filter(r => r.id !== result.id),result]; busy = false; close(); draw(); message('저장했습니다.');
        } catch (error) { if (token === generation) message(error.message, true); }
        finally { if (token === generation) { busy = false; controls(); } }
    }
    async function load() {
        if (editing || busy || !owner) return;
        const token = generation; busy = true; controls(); message('불러오는 중…');
        try { const data = await store.list(); if (token !== generation) return; rows = data; loaded = true; message(''); draw(); }
        catch (error) { if (token === generation) message(error.message, true); }
        finally { if (token === generation) { busy = false; controls(); } }
    }
    function reset() { generation++; rows=[]; owner=''; loaded=false; editing=false; busy=false; base=null; const c=el('fixed-costs-view'); if(c)c.replaceChildren(); }
    function render() {
        const container = el('fixed-costs-view'); if (!container || container.classList.contains('hidden')) return;
        const next = root.getFixedCostContext()?.userId || '';
        if (owner !== next) reset(); owner = next;
        if (!el('fc-form')) mount(container);
        if (editing) return;
        draw(); if (!loaded && owner) load();
    }
    root.FixedCosts = Object.freeze({ render, refresh: load, reset });
})(globalThis);
