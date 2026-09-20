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
        <p class="il-scope">미실현 가격손익 · 환차손익·배당·수수료 제외</p>
        <section class="il-panel il-market-panel"><div class="il-heading"><h3>보유 히트맵</h3><span id="il-map-encoding" class="il-note">크기: 평가금액 · 색: 매입가 대비 가격 수익률</span></div>
        <div class="il-legend" aria-label="가격 수익률 색상 범례"></div>
        <p id="il-map-note" class="il-note"></p><div id="il-map" class="il-map" aria-label="전략별 보유 평가금액 히트맵"></div><div id="il-map-readout" class="il-map-readout">종목을 가리키거나 선택하면 상세 정보를 확인할 수 있습니다.</div></section>
        <section id="il-detail" class="il-panel" hidden aria-label="선택 종목 상세"><div class="il-heading"><h3 id="il-detail-title" tabindex="-1"></h3><button type="button" id="il-close">닫기</button></div><p id="il-detail-status" class="il-note"></p><div id="il-detail-data" class="il-table-wrap"></div><button type="button" id="il-edit">기존 화면에서 보유·시세 편집 ↗</button></section>
        <div class="il-bottom"><section class="il-panel"><h3>손익 기여금액</h3><p class="il-note">절댓값 상위 6개 · 비교 가능한 보유분</p><div id="il-contributors"></div></section>
        <section class="il-panel"><div class="il-heading"><h3>보유 목록</h3><label class="il-note">정렬 <select id="il-sort"><option value="value">평가금액</option><option value="pnl">손익금액</option><option value="name">종목명</option></select></label></div><div id="il-holdings" class="il-table-wrap"></div></section></div></div>
        <details class="il-evidence"><summary>계산 기준</summary><p>평가액 = 수량 × 현재가 × 환율 · 시세 미연결 시 입력 평가액 사용</p><p>가격 수익률: 평균매입가 대비 · 외화 원가는 현재 환율 적용</p><p>회색: 원가·기준일 미확인 또는 7일 초과 시세 · 색 강도 ±20% 한도</p></details>`;
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
        const legend = document.querySelector('#investment-lab-view .il-legend');
        legend.replaceChildren();
        for (const [value, label] of [[-20, '−20% 이하'], [-5, '−5%'], [0, '0%'], [5, '+5%'], [20, '+20% 이상'], [null, '미확인·오래된 시세']]) {
            const swatch = node('span', label); swatch.style.setProperty('--swatch', root.InvestmentLabModel.color(value)); legend.append(swatch);
        }
        const resetReadout = () => text('il-map-readout', '종목을 가리키거나 선택하면 상세 정보를 확인할 수 있습니다.');
        resetReadout();
        const width = map.clientWidth, height = map.clientHeight;
        if (!(width > 0) || !model?.total) { map.append(node('p', '양수 평가금액이 없습니다. 아래 목록에서 확인하세요.', 'il-empty')); return; }
        const groupMode = width < 600 && !model.strategy;
        el('il-map-encoding').textContent = groupMode ? '크기: 전략별 평가금액' : '크기: 평가금액 · 색: 매입가 대비 가격 수익률';
        legend.hidden = groupMode;
        text('il-map-note', groupMode ? '전략을 선택하면 종목별로 확대합니다.' : '전략별 보유 현황 · 작은 종목은 아래 목록에서 확인');
        const strategyRects = root.InvestmentLabModel.layout(model.strategyGroups, width, height);
        const rectangles = groupMode ? strategyRects : strategyRects.flatMap(g => {
            const headerHeight = g.width >= 65 && g.height >= 65 ? 22 : 0;
            if (headerHeight) {
                const heading = node('div', `${g.label}  ${pct(g.value / model.total * 100)}`, 'il-map-group');
                Object.assign(heading.style, { left: `${g.x}px`, top: `${g.y}px`, width: `${g.width}px` });
                map.append(heading);
            }
            return root.InvestmentLabModel.layout(model.holdings.filter(p => p.strategy === g.key), Math.max(0, g.width - 3), Math.max(0, g.height - headerHeight - 3), g.x + 1.5, g.y + headerHeight + 1.5);
        });
        rectangles.forEach(p => {
            const tile = node('button', null, 'il-tile'); tile.type = 'button';
            Object.assign(tile.style, { left: `${p.x / width * 100}%`, top: `${p.y / height * 100}%`, width: `${p.width / width * 100}%`, height: `${p.height / height * 100}%` });
            tile.style.background = groupMode ? '#343943' : root.InvestmentLabModel.color(p.returnPct, p.colorReady);
            tile.style.color = '#fff';
            tile.style.setProperty('--tile-type', `${Math.max(11, Math.min(44, p.width / 6, p.height / 4))}px`);
            if (!groupMode && !p.colorReady) tile.classList.add('il-tile-unverified');
            const weight = p.value / model.total * 100;
            const label = groupMode ? `${p.label} · ${pct(weight)} · ${won(p.value)} · 확대` : `${p.name} · ${p.strategyLabel} · 비중 ${pct(weight)} · ${won(p.value)} · 가격 수익률 ${signed(p.returnPct)}${p.issues.length ? ` · ${p.issues.join(', ')}` : ''}`;
            tile.setAttribute('aria-label', label); tile.title = label;
            if (p.width >= 42 && p.height >= 30) {
                tile.append(node('strong', groupMode ? p.label : p.ticker || p.name));
                if (p.width >= 65 && p.height >= 55) tile.append(node('span', groupMode ? pct(weight) : signed(p.returnPct)));
                if (p.width >= 130 && p.height >= 130) tile.append(node('small', groupMode ? won(p.value) : p.name));
                if (!groupMode && p.issues.length && p.height >= 155 && p.width >= 130) tile.append(node('small', '기준일·원가 확인'));
            } else { tile.classList.add('il-tile-small'); }
            tile.addEventListener('mouseenter', () => text('il-map-readout', label));
            tile.addEventListener('mouseleave', resetReadout);
            tile.addEventListener('focus', () => text('il-map-readout', label));
            tile.addEventListener('blur', resetReadout);
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
