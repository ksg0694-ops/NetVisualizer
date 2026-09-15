(function (root) {
    'use strict';
    let account = '', strategy = '', selected = '', model, owner = '', observer;
    const won = n => n == null ? '—' : `${Math.round(n).toLocaleString('ko-KR')}원`;
    const pct = n => n == null ? '—' : `${n.toFixed(1)}%`;
    const signed = n => n == null ? '계산 불가' : `${n > 0 ? '+' : ''}${pct(n)}`;
    const el = id => document.getElementById(id);
    function node(tag, value, className) { const n = document.createElement(tag); if (value != null) n.textContent = value; if (className) n.className = className; return n; }
    function text(id, value) { el(id).textContent = value; }
    function select(id, rows, value, label) {
        const target = el(id); target.replaceChildren();
        for (const row of [{ key: '', label }, ...rows]) { const option = node('option', row.label); option.value = row.key; target.append(option); }
        target.value = value;
    }
    function mount(container) {
        container.innerHTML = `<div class="il-heading"><div><h2>투자 Lab</h2><p id="il-asof"></p></div><button type="button" id="il-legacy">기존 투자 상세 ↗</button></div>
        <div class="il-toolbar"><label>계좌 <select id="il-account"></select></label><label>전략 <select id="il-strategy"></select></label><button type="button" id="il-reset">전체 보기</button></div>
        <div id="il-empty" class="il-empty" hidden></div>
        <div id="il-content"><div class="il-kpis">
        <div><span>평가금액</span><strong id="il-total"></strong><small id="il-valuation-coverage"></small></div>
        <div><span>미실현 가격손익</span><strong id="il-pnl"></strong><small id="il-return"></small></div>
        <div><span>상위 3종목 비중</span><strong id="il-top"></strong><small>선택 범위 평가액 기준</small></div>
        <div><span>손익 계산 가능 비중</span><strong id="il-coverage"></strong><small id="il-issues"></small></div></div>
        <p class="il-scope">가격손익은 계산 가능한 보유분만 포함합니다. 환율 변동·배당·수수료·실현손익 제외.</p>
        <section class="il-panel"><div class="il-heading"><h3>보유 히트맵</h3><span id="il-map-encoding" class="il-note">크기: 평가금액 · 색: 가격 수익률</span></div>
        <div class="il-legend" aria-label="가격 수익률 색상 범례"><span style="--swatch:#1e40af">−20% 이하</span><span style="--swatch:#bfdbfe">−5%</span><span style="--swatch:#fafafa">0%</span><span style="--swatch:#fecaca">+5%</span><span style="--swatch:#991b1b">+20% 이상</span><span style="--swatch:#e4e4e7">미확인·오래된 시세</span></div>
        <p id="il-map-note" class="il-note"></p><div id="il-map" class="il-map" aria-label="전략별 보유 평가금액 히트맵"></div></section>
        <section id="il-detail" class="il-panel" hidden aria-label="선택 종목 상세"><div class="il-heading"><h3 id="il-detail-title" tabindex="-1"></h3><button type="button" id="il-close">닫기</button></div><p id="il-detail-status" class="il-note"></p><div id="il-detail-data" class="il-table-wrap"></div><button type="button" id="il-edit">기존 화면에서 보유·시세 편집 ↗</button></section>
        <div class="il-bottom"><section class="il-panel"><h3>손익 기여금액</h3><p class="il-note">절댓값 상위 6개 · 비교 가능한 보유분</p><div id="il-contributors"></div></section>
        <section class="il-panel"><div class="il-heading"><h3>보유 목록</h3><label class="il-note">정렬 <select id="il-sort"><option value="value">평가금액</option><option value="pnl">손익금액</option><option value="name">종목명</option></select></label></div><div id="il-holdings" class="il-table-wrap"></div></section></div></div>
        <details class="il-evidence"><summary>계산 기준 및 데이터 출처</summary><p>로그인 계정의 포트폴리오·전략과 연결 시세·환율을 사용합니다. 평가액은 수량 × 현재가 × 환율이며 연결 불가 시 입력 평가액을 보존합니다. 전략 안의 동일 티커·시장·통화는 합산하고, 계좌 필터를 먼저 적용합니다.</p><p>가격 수익률 = (비교 가능한 평가액 − 평균매입가 기준 원가) ÷ 원가. 외화 원가도 현재 환율로 환산하므로 환차손익은 아닙니다. 일부 원가가 없으면 해당 종목의 색상 수익률은 표시하지 않습니다. 손익 계산 가능 비중은 종목 수가 아닌 평가금액 기준입니다.</p><p>시세 또는 외화 환율의 기준일이 없거나 미래이거나 7일을 초과하면 색은 회색으로 표시합니다. 7일은 달력 기준의 경과 경고이며 거래소 휴장일 판정이 아닙니다. 평가액·계산 가능한 손익은 마지막 확보 값을 유지합니다. 색 강도는 ±20%에서 멈추지만 숫자는 실제 값을 표시합니다.</p><p>현재 보유 미실현 가격손익만 표시합니다. 오늘 등락과 목표비중 편차는 비교 시세·목표의 연결을 검증한 뒤 추가할 항목으로, 현재 수치로 추정하지 않습니다. 개인 보유 데이터는 이 화면을 통해 공개 저장되지 않습니다.</p></details>`;
        el('il-account').addEventListener('change', event => { account = event.target.value; strategy = ''; selected = ''; render(); });
        el('il-strategy').addEventListener('change', event => { strategy = event.target.value; selected = ''; render(); });
        el('il-reset').addEventListener('click', () => { account = strategy = selected = ''; render(); });
        el('il-sort').addEventListener('change', renderList);
        el('il-close').addEventListener('click', () => { selected = ''; el('il-detail').hidden = true; el('il-sort').focus(); });
        for (const id of ['il-legacy', 'il-edit']) el(id).addEventListener('click', () => root.openLegacyInvestmentFromLab());
        observer = new ResizeObserver(() => { if (model && !container.classList.contains('hidden')) renderMap(); });
        observer.observe(el('il-map'));
    }
    function table(container, headers, rows) {
        const table = node('table'), head = node('thead'), tr = node('tr');
        headers.forEach(label => { const th = node('th', label); th.scope = 'col'; tr.append(th); }); head.append(tr); table.append(head);
        const body = node('tbody'); rows.forEach(cells => { const row = node('tr'); cells.forEach(value => { const cell = node('td'); cell.append(value instanceof Node ? value : document.createTextNode(String(value))); row.append(cell); }); body.append(row); });
        table.append(body); container.replaceChildren(table);
    }
    function openDetail(key, focus = true) {
        const holding = model.holdings.find(p => p.key === key);
        el('il-detail').hidden = !holding; if (!holding) return;
        selected = key; text('il-detail-title', `${holding.name} · ${holding.strategyLabel}`);
        text('il-detail-status', `${won(holding.value)} · 비중 ${pct(holding.weight)} · 가격 수익률 ${signed(holding.returnPct)}${holding.issues.length ? ` · ${holding.issues.join(' / ')}` : ''}`);
        table(el('il-detail-data'), ['계좌', '수량', '평가액', '원가', '가격손익', '시세 기준일', '평가 출처', '환율 기준일'], holding.positions.map(p => [p.account, p.shares || '—', won(p.value), p.comparable ? won(p.costKrw) : '—', p.comparable ? won(p.unrealizedPnlKrw) : '—', p.priceDate || '—', p.valuationSourceLabel || '입력값', p.priceCurrency === 'KRW' ? '원화' : p.fxRate?.rateDate || '—']));
        if (focus) { el('il-detail-title').focus({ preventScroll: true }); el('il-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    }
    function renderMap() {
        const map = el('il-map'); map.replaceChildren();
        const width = map.clientWidth, height = map.clientHeight;
        if (!(width > 0) || !model?.total) { map.append(node('p', '양수 평가금액이 없습니다. 아래 목록에서 확인하세요.', 'il-empty')); return; }
        const groupMode = width < 600 && !model.strategy;
        el('il-map-encoding').textContent = groupMode ? '크기: 전략별 평가금액' : '크기: 평가금액 · 색: 가격 수익률';
        document.querySelector('#investment-lab-view .il-legend').hidden = groupMode;
        text('il-map-note', groupMode ? '전략을 선택하면 종목별로 확대합니다.' : '같은 전략끼리 묶음 · 작은 종목은 아래 목록에서도 선택할 수 있습니다.');
        const strategyRects = root.InvestmentLabModel.layout(model.strategyGroups, width, height);
        const rectangles = groupMode ? strategyRects : strategyRects.flatMap(g => root.InvestmentLabModel.layout(model.holdings.filter(p => p.strategy === g.key), g.width, g.height, g.x, g.y));
        rectangles.forEach(p => {
            const tile = node('button', null, 'il-tile'); tile.type = 'button';
            Object.assign(tile.style, { left: `${p.x / width * 100}%`, top: `${p.y / height * 100}%`, width: `${p.width / width * 100}%`, height: `${p.height / height * 100}%` });
            const dark = !groupMode && p.colorReady && Math.abs(p.returnPct) >= 15;
            tile.style.background = groupMode ? '#f4f4f5' : root.InvestmentLabModel.color(p.returnPct, p.colorReady);
            tile.style.color = dark ? '#fff' : '#27272a';
            const weight = p.value / model.total * 100;
            const label = groupMode ? `${p.label} · ${pct(weight)} · ${won(p.value)} · 확대` : `${p.name} · ${p.strategyLabel} · 비중 ${pct(weight)} · ${won(p.value)} · 가격 수익률 ${signed(p.returnPct)}${p.issues.length ? ` · ${p.issues.join(', ')}` : ''}`;
            tile.setAttribute('aria-label', label); tile.title = label;
            if (p.width >= 72 && p.height >= 60) {
                tile.append(node('strong', groupMode ? p.label : p.name), node('span', groupMode ? pct(weight) : signed(p.returnPct)));
                if (p.height >= 100) tile.append(node('small', groupMode ? won(p.value) : `${p.strategyLabel} · ${pct(weight)}`));
                if (!groupMode && p.issues.length && p.height >= 128) tile.append(node('small', '데이터 확인 필요'));
            } else { tile.classList.add('il-tile-small'); }
            tile.addEventListener('click', () => { if (groupMode) { strategy = p.key; selected = ''; render(); el('il-strategy').focus(); } else openDetail(p.key); });
            map.append(tile);
        });
    }
    function renderList() {
        if (!model) return;
        const rows = [...model.holdings], sort = el('il-sort').value;
        if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        if (sort === 'pnl') rows.sort((a, b) => (b.pnl ?? -Infinity) - (a.pnl ?? -Infinity));
        table(el('il-holdings'), ['종목 / 전략', '평가액', '비중', '가격 수익률', '상태'], rows.map(p => {
            const button = node('button', `${p.name} · ${p.strategyLabel}`, 'il-row-link'); button.type = 'button'; button.addEventListener('click', () => openDetail(p.key));
            return [button, won(p.value), pct(p.weight), signed(p.returnPct), p.issues.length ? p.issues.join(' / ') : '기준일 7일 이내'];
        }));
    }
    function renderContributors() {
        const target = el('il-contributors'); target.replaceChildren();
        const rows = model.holdings.filter(p => p.pnl != null).sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl)).slice(0, 6);
        const max = Math.max(1, ...rows.map(p => Math.abs(p.pnl)));
        rows.forEach(p => {
            const button = node('button', null, 'il-contributor'); button.type = 'button';
            const label = node('span', `${p.name} · ${p.strategyLabel}`), amount = node('strong', `${p.pnl > 0 ? '+' : ''}${won(p.pnl)}${p.complete ? '' : ' (일부)'}`);
            const track = node('span', null, 'il-bar-track'), bar = node('i'); bar.style.width = `${Math.abs(p.pnl) / max * 100}%`; bar.style.background = p.pnl >= 0 ? '#b91c1c' : '#1d4ed8'; track.append(bar);
            button.append(label, amount, track); button.addEventListener('click', () => openDetail(p.key)); target.append(button);
        });
        if (!rows.length) target.append(node('p', '원가·시세를 연결하면 표시됩니다.', 'il-empty'));
    }
    function render() {
        const container = el('investment-lab-view'); if (!container || container.classList.contains('hidden')) return;
        if (!el('il-account')) mount(container);
        const source = root.getInvestmentLabSource();
        if (owner !== source.owner) { owner = source.owner; account = strategy = selected = ''; }
        model = root.InvestmentLabModel.build(source.positions, { account, strategy, today: source.today });
        account = model.account; strategy = model.strategy;
        select('il-account', model.accounts.map(key => ({ key, label: key })), account, '전체 계좌');
        select('il-strategy', model.strategies, strategy, '전체 전략');
        text('il-asof', `${source.today} 조회 · 현재 보유 기준`);
        const empty = !model.rows.length;
        el('il-content').hidden = empty; el('il-empty').hidden = !empty;
        text('il-empty', source.authenticated ? '선택 범위에 투자 보유 기록이 없습니다.' : '로그인 후 투자 보유 내역을 확인할 수 있습니다.');
        el('il-legacy').disabled = !source.authenticated;
        text('il-total', won(model.total)); text('il-pnl', won(model.pnl)); text('il-return', `가격 수익률 ${signed(model.returnPct)}`);
        text('il-top', pct(model.topThreePct)); text('il-coverage', pct(model.comparablePct));
        text('il-valuation-coverage', `시세 평가 ${pct(model.marketPct)} · 7일 이내 ${pct(model.recentPct)}`);
        text('il-issues', `데이터 확인 필요 ${model.issueCount}/${model.rows.length}개 보유분`);
        renderMap(); renderList(); renderContributors(); openDetail(selected, false);
    }
    root.InvestmentLab = Object.freeze({ render });
})(globalThis);
