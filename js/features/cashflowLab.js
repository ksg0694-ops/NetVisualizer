// Experimental visual dashboard. Keeps the original cashflow view untouched.
(function (root) {
    'use strict';
    let selectedKey = '', reportMode = false, spendingUnit = 'daily';
    const colors = { income: '#64748b', spending: '#3f3f46', comparison: '#a1a1aa', positive: '#64748b', negative: '#3f3f46' };
    const won = value => value == null ? '—' : `${Math.round(value).toLocaleString('ko-KR')}원`;
    const compact = value => value == null ? '—' : `${(value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
    function text(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
    function mount(container) {
        container.innerHTML = `
            <div class="cfl-header">
                <div><p class="cfl-eyebrow">2026 · CASH FLOW</p><h2>현금흐름 Lab</h2></div>
                <div class="cfl-controls">
                    <button type="button" id="cfl-dashboard" aria-pressed="true">대시보드</button>
                    <button type="button" id="cfl-report" aria-pressed="false">리포트</button>
                    <button type="button" id="cfl-print">인쇄 / PDF</button>
                    <button type="button" id="cfl-old">구버전 비교 ↗</button>
                </div>
            </div>
            <div class="cfl-report" id="cfl-report-summary"><h3>2026 현금흐름 리포트</h3><ol id="cfl-findings"></ol></div>
            <div class="cfl-section-heading"><h3>연간 흐름 <span class="cfl-heading-meta">급여 주기 기준</span></h3><span id="cfl-coverage" class="cfl-status"></span></div>
            <div class="cfl-kpis">
                <div class="cfl-kpi"><span>누적 소득</span><strong id="cfl-income"></strong></div>
                <div class="cfl-kpi"><span>누적 소비 <small>상환 제외</small></span><strong id="cfl-spending"></strong></div>
                <div class="cfl-kpi"><span>누적 상환</span><strong id="cfl-repayment"></strong></div>
                <div class="cfl-kpi"><span>장부상 잉여</span><strong id="cfl-net"></strong></div>
            </div>
            <div class="cfl-grid cfl-annual">
                <article class="cfl-panel"><div class="cfl-panel-heading"><h4>소비</h4><div class="cfl-controls"><select id="cfl-spending-unit" aria-label="소비 비교 기준"><option value="total">월 총소비</option><option value="daily">일평균 소비</option></select></div></div><p class="cfl-note cfl-reference" id="cfl-spending-reference"></p><div class="cfl-chart"><canvas id="cfl-year-chart" role="img" aria-label="2026 월별 소비만 비교. 점선은 종료 주기 중앙값입니다."></canvas><p id="cfl-year-empty" class="cfl-empty" hidden></p></div></article>
                <article class="cfl-panel"><div class="cfl-panel-heading"><h4>소득</h4><span class="cfl-unit">월 소득</span></div><p class="cfl-note cfl-reference" id="cfl-income-reference"></p><div class="cfl-chart"><canvas id="cfl-income-chart" role="img" aria-label="2026 월별 소득만 비교. 소비 차트와 다른 금액 축입니다."></canvas><p id="cfl-income-empty" class="cfl-empty" hidden></p></div></article>
            </div>
            <p class="cfl-note cfl-annual-footnote">* 진행 중 · 오늘까지 반영 <span>단위: 만원 · 소득/소비 별도 축</span></p>
            <div class="cfl-section-heading"><div><h3 id="cfl-current-title">이번 급여 주기</h3><p id="cfl-period-range"></p></div><div class="cfl-controls"><label for="cfl-period">상세 주기</label><select id="cfl-period"></select><button type="button" id="cfl-current">현재 주기</button></div></div>
            <div class="cfl-grid">
                <article class="cfl-panel cfl-detail-panel"><div class="cfl-panel-heading"><h4>소비 속도</h4><span class="cfl-unit" title="월을 바꿔도 동일한 금액 범위로 비교합니다">Y축 고정 · 만원</span></div><div class="cfl-detail-summary"><div class="cfl-pace-total"><strong id="cfl-current-spending"></strong><span id="cfl-pace-delta" role="status"></span></div><p class="cfl-note" id="cfl-baseline-note"></p></div><div class="cfl-chart cfl-chart-tall"><canvas id="cfl-pace-chart" role="img" aria-label="실제 날짜별 누적 소비. 월을 변경해도 같은 Y축 범위를 사용합니다."></canvas><p id="cfl-pace-empty" class="cfl-empty" hidden></p></div></article>
                <article class="cfl-panel cfl-detail-panel"><div class="cfl-panel-heading"><h4>소비 구성</h4><span class="cfl-unit">단위: 만원</span></div><div class="cfl-detail-summary"><div class="cfl-pace-total"><strong id="cfl-top-category"></strong><span id="cfl-top-share"></span></div><p class="cfl-note">같은 경과일 비교 · 상위 6개 + 그 외</p></div><div class="cfl-chart cfl-chart-tall"><canvas id="cfl-category-chart" role="img" aria-label="카테고리별 현재 소비와 과거 평균 비교"></canvas><p id="cfl-category-empty" class="cfl-empty" hidden></p></div></article>
            </div>
            <details class="cfl-evidence"><summary>계산 기준 및 원자료</summary>
                <p>원천: 로그인 계정의 동기화된 거래와 유효한 월 마감. 금액은 원화, 급여일~다음 급여일 전날 기준입니다. 2026년 주기에는 전년 말 거래가 포함될 수 있습니다. 진행 중인 기간은 오늘까지만 표시하며, 빈 미확정 기간은 0원으로 채우지 않습니다.</p>
                <p id="cfl-source-status"></p>
                <p>소비 기준선: 종료된 최근 최대 12개 주기에서 최신 유효 거래를 사용합니다. 마감 후 변경 여부로 제외하지 않습니다. 같은 경과일까지 존재하는 주기가 1개라도 있으면 참고 비교를 표시합니다. 선택 주기보다 짧은 과거 주기는 소비속도 비교에서만 제외하며, 연간 소비 차트에는 표시합니다. 빈 미확정 주기는 0원으로 추정하지 않습니다.</p>
                <p>일평균 소비 = 반영 소비 ÷ 관측 경과일(종료 주기는 전체 일수). 월별 점선은 기록이 있는 2026 종료 주기 중앙값입니다. 소비속도 Y축은 전체 조회 주기의 최대 소비를 바탕으로 고정하며, 새 거래가 들어오면 범위가 바뀔 수 있습니다. 과거 수준은 적정 예산이 아닙니다. 환불은 기존 장부 분류와 절댓값 규칙을 따릅니다.</p>
                <p>장부상 잉여 = 소득 − 소비 − 상환(저축이체 미차감). 소비 구성의 과거 값은 합산 가능한 평균이며, 소비 속도는 중앙값입니다. 연간 막대를 선택하면 아래 상세 주기가 바뀝니다. 과거 누적선은 선택 주기의 같은 경과일에 정렬합니다.</p>
                <p id="cfl-axis-note"></p>
                <article class="cfl-panel"><h4>참고 · 월별 장부상 잉여</h4><p class="cfl-note">소득 − 전체 지출 · 실제 계좌 잔액과 다름</p><div class="cfl-chart"><canvas id="cfl-net-chart" role="img" aria-label="2026 월별 장부상 잉여"></canvas><p id="cfl-net-empty" class="cfl-empty" hidden></p></div></article>
                <h4>2026 주기별 집계</h4><div id="cfl-year-table" class="cfl-table-wrap"></div>
                <h4>선택 주기 카테고리 비교</h4><div id="cfl-category-table" class="cfl-table-wrap"></div>
                <h4>선택 주기 누적 소비</h4><div id="cfl-pace-table" class="cfl-table-wrap"></div>
            </details>`;
        document.getElementById('cfl-period').addEventListener('change', event => { selectedKey = event.target.value; render(); });
        document.getElementById('cfl-spending-unit').addEventListener('change', event => { spendingUnit = event.target.value; render(); });
        document.getElementById('cfl-current').addEventListener('click', () => { selectedKey = ''; render(); });
        document.getElementById('cfl-old').addEventListener('click', () => root.openLegacyCashflowFromLab(document.getElementById('cfl-period').value));
        document.getElementById('cfl-dashboard').addEventListener('click', () => { reportMode = false; render(); });
        document.getElementById('cfl-report').addEventListener('click', () => { reportMode = true; render(); });
        document.getElementById('cfl-print').addEventListener('click', () => { reportMode = true; render(); requestAnimationFrame(() => root.print()); });
    }
    function table(id, headers, rows) {
        const container = document.getElementById(id); container.replaceChildren();
        const element = document.createElement('table');
        const head = document.createElement('thead'), body = document.createElement('tbody');
        const tr = document.createElement('tr');
        headers.forEach(value => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = value; tr.appendChild(th); });
        head.appendChild(tr);
        rows.forEach(row => { const line = document.createElement('tr'); row.forEach(value => { const td = document.createElement('td'); td.textContent = value; line.appendChild(td); }); body.appendChild(line); });
        element.append(head, body); container.appendChild(element);
    }
    function chart(name, labels, datasets, extra = {}, type = 'bar') {
        const id = `cfl-${name}-chart`, empty = document.getElementById(`cfl-${name}-empty`), canvas = document.getElementById(id);
        const hasData = datasets.some(dataset => dataset.data.some(value => value !== null && value !== undefined));
        empty.hidden = hasData; empty.style.display = hasData ? 'none' : 'flex'; canvas.style.display = hasData ? 'block' : 'none';
        empty.textContent = '표시할 기록이 없습니다. 로그인과 거래 동기화를 확인해 주세요.';
        const options = {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top', align: 'start', labels: { boxWidth: 12, font: { size: 12 } } }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${won(ctx.raw)}` } } },
            scales: { x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 }, maxRotation: 0 } }, y: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { color: '#71717a', callback: compact, font: { size: 11 } } } },
            ...extra,
        };
        // A missing comparison is not a zero series or an available legend entry.
        const visibleDatasets = datasets.filter(dataset => dataset.data.some(value => value !== null && value !== undefined));
        root.renderOrUpdateChart(`cashflowLab-${name}`, id, { type, data: { labels, datasets: visibleDatasets }, options });
    }
    function render() {
        const container = document.getElementById('cashflow-lab-view');
        if (!container || container.classList.contains('hidden')) return;
        if (!document.getElementById('cfl-period')) mount(container);
        const periods = root.getCashFlowPeriods();
        const model = root.CashflowLabModel.build(periods, selectedKey, root.AppUtils.toLocalDateString(), root.isRepaymentExpense, root.SpendingAnalysis.analyze);
        container.classList.toggle('cfl-report-mode', reportMode);
        document.getElementById('cfl-dashboard').setAttribute('aria-pressed', String(!reportMode));
        document.getElementById('cfl-report').setAttribute('aria-pressed', String(reportMode));
        const select = document.getElementById('cfl-period'); select.replaceChildren();
        model.periods.forEach(period => { const option = document.createElement('option'); option.value = period.key; option.textContent = period.label; select.appendChild(option); });
        select.value = model.selected?.key || ''; select.disabled = !model.periods.length;
        for (const [key, value] of Object.entries(model.annual)) text(`cfl-${key}`, value === null ? '—' : `${compact(value)}원`);
        text('cfl-coverage', `${model.availableCount}/12 주기${model.provisional ? ' · 미확정 포함' : ''}`);
        const labels = model.monthly.map(row => `${Number(row.key.slice(5))}월${row.partial ? '*' : ''}`);
        const selectFromChart = (_event, elements) => { const row = elements[0] && model.monthly[elements[0].index]; if (row?.known) { selectedKey = row.key; render(); document.getElementById('cfl-current-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
        const reference = (value, label) => ({ type: 'line', label, data: model.monthly.map(row => row.known ? value : null), borderColor: colors.comparison, borderDash: [5, 4], borderWidth: 2, pointRadius: 0, spanGaps: false });
        const daily = spendingUnit === 'daily';
        document.getElementById('cfl-spending-unit').value = spendingUnit;
        text('cfl-spending-reference', `종료 주기 중앙값 ${won(daily ? model.dailySpendingReference : model.spendingReference)}${daily ? '/일' : ''}`);
        text('cfl-income-reference', `종료 주기 중앙값 ${won(model.incomeRange?.median ?? null)}`);
        chart('year', labels, [
            { label: daily ? '일평균 소비' : '월 총소비', data: model.monthly.map(row => daily ? row.dailySpending : row.spending), backgroundColor: model.monthly.map(row => row.partial ? '#a1a1aa' : colors.spending), borderRadius: 3 },
            reference(daily ? model.dailySpendingReference : model.spendingReference, '종료 주기 중앙값'),
        ], { onClick: selectFromChart });
        chart('income', labels, [
            { label: '월 소득', data: model.monthly.map(row => row.income), backgroundColor: model.monthly.map(row => row.partial ? '#cbd5e1' : colors.income), borderRadius: 3 },
            reference(model.incomeRange?.median ?? null, '종료 주기 중앙값'),
        ], { onClick: selectFromChart });
        chart('net', labels, [{ label: '장부상 잉여', data: model.monthly.map(row => row.net), backgroundColor: model.monthly.map(row => row.net < 0 ? colors.negative : colors.positive), borderRadius: 3 }]);
        const a = model.analysis;
        text('cfl-current-title', model.isCurrent ? '이번 급여 주기' : '선택 급여 주기');
        text('cfl-period-range', model.selected ? `${model.selected.startDate} ~ ${model.selected.endDate} · ${a?.elapsed || 0}/${a?.duration || 0}일 경과` : '조회 가능한 주기 없음');
        text('cfl-current-spending', a?.hasCurrent ? `${compact(a.current.consumption)}원` : '기록 없음');
        const unavailable = !a?.hasCurrent ? '선택 주기 기록 없음' : !a.historyCount ? '이전 주기 기록 없음' : `${a.elapsed}일차 비교 없음`;
        text('cfl-pace-delta', a?.difference == null ? unavailable : a.difference === 0 ? '과거와 동일' : `과거 대비 ${won(Math.abs(a.difference))} ${a.difference > 0 ? '↑' : '↓'}`);
        document.getElementById('cfl-pace-delta').dataset.trend = a?.difference == null ? 'unavailable' : a.difference > 0 ? 'more' : a.difference < 0 ? 'less' : 'same';
        text('cfl-baseline-note', a?.hasCurrent && a.historyCount && !a.samples.length ? `이전 ${a.historyCount}개 주기가 더 짧습니다 · 위 일평균으로 비교` : `과거 ${a?.samples.length || 0}개 주기 중앙값 · ${a?.elapsed || 0}일차`);
        text('cfl-axis-note', `Y축 고정: 0 ~ ${won(model.paceAxisMax)} · X축: 선택 주기의 실제 날짜`);
        chart('pace', model.curves.labels, [
            { label: '선택 주기 소비', data: model.curves.current, borderColor: colors.spending, backgroundColor: colors.spending, borderWidth: 3, pointRadius: a?.elapsed === 1 ? 4 : 0, pointHitRadius: 12, spanGaps: false },
            { label: '과거 중앙값', data: model.curves.baseline, borderColor: colors.comparison, backgroundColor: colors.comparison, borderDash: [5, 4], borderWidth: 2, pointRadius: a?.elapsed === 1 ? 4 : 0, spanGaps: false },
        ], {
            scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, font: { size: 11 }, callback: (_value, index) => {
                const last = model.curves.labels.length - 1, observed = (a?.elapsed || 1) - 1;
                return index === 0 || index === last || index === observed || (index % 7 === 0 && last - index >= 4 && Math.abs(index - observed) >= 4) ? model.curves.labels[index] : '';
            } } }, y: { min: 0, max: model.paceAxisMax, grid: { color: '#f4f4f5' }, ticks: { callback: compact, font: { size: 11 } } } },
            plugins: { legend: { position: 'top', align: 'start', labels: { boxWidth: 12, font: { size: 12 } } }, tooltip: { callbacks: { title: items => { const i = items[0]?.dataIndex; return i == null ? '' : `${model.curves.dates[i]} · ${i + 1}일차`; }, label: ctx => `${ctx.dataset.label}: ${won(ctx.raw)}`, afterBody: () => `과거 ${a?.samples.length || 0}개 주기를 같은 경과일에 정렬` } } },
        }, 'line');
        chart('category', model.categories.map(row => row.category), [
            { label: '선택 주기', data: model.categories.map(row => row.current), backgroundColor: colors.spending, borderRadius: 3 },
            { label: '과거 평균', data: model.categories.map(row => row.average), backgroundColor: '#d4d4d8', borderRadius: 3 },
        ], { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#f4f4f5' }, ticks: { callback: compact, font: { size: 11 }, maxRotation: 0 } }, y: { grid: { display: false }, ticks: { font: { size: 12 }, callback: function(value) { const label = this.getLabelForValue(value); return label.length > 10 ? `${label.slice(0, 9)}…` : label; } } } } });
        const findings = document.getElementById('cfl-findings'); findings.replaceChildren();
        const biggest = [...model.categories].sort((x, y) => y.current - x.current)[0];
        text('cfl-top-category', biggest?.category || '기록 없음');
        text('cfl-top-share', biggest && a?.current.consumption > 0 ? `${Math.round(biggest.current / a.current.consumption * 100)}% · 최대 소비 묶음` : '');
        const lines = [model.incomeRange ? `2026 종료 주기 소득은 ${compact(model.incomeRange.min)}~${compact(model.incomeRange.max)}원. 중앙값 ${compact(model.incomeRange.median)}원 (${model.incomeRange.count}개 주기).` : '2026 종료 주기의 소득 기록이 없어 변동 범위를 계산하지 않았습니다.',
            a?.difference != null ? `${model.selected.key} ${a.elapsed}일차 소비 ${compact(a.current.consumption)}원. 과거 ${a.samples.length}개 주기의 같은 경과일 중앙값과 ${won(Math.abs(a.difference))} ${a.difference > 0 ? '증가' : a.difference < 0 ? '감소' : '차이 없음'}.` : unavailable,
            biggest ? `선택 주기 최대 소비 묶음은 ${biggest.category}, ${won(biggest.current)}. 지출 시점·일회성 여부는 원장과 함께 확인하세요.` : '선택 주기에 표시할 소비 분류가 없습니다.'];
        lines.forEach(line => { const li = document.createElement('li'); li.textContent = line; findings.appendChild(li); });
        text('cfl-source-status', `관측 기준 ${model.today} · *는 진행 중 주기. 비교 주기: ${a?.samples.map(p => p.key).join(', ') || '없음'}. 마감 상태로 비교에서 제외하지 않으며, 최신 유효 거래 기준입니다. 거래 누락에 따라 결과가 달라질 수 있습니다.`);
        table('cfl-year-table', ['주기', '날짜', '소득', '소비', '일평균 소비', '상환', '잉여', '건수', '마지막 거래', '상태'], model.monthly.map(row => [row.key, `${row.start} ~ ${row.end}`, won(row.income), won(row.spending), won(row.dailySpending), won(row.repayment), won(row.net), row.count, row.latest, row.status]));
        table('cfl-category-table', ['분류', '선택 주기', '과거 평균'], model.categories.map(row => [row.category, won(row.current), won(row.average)]));
        table('cfl-pace-table', ['실제 날짜', '경과일', '선택 주기 누적', '과거 중앙값'], model.curves.labels.map((label, index) => [model.curves.dates[index], `${index + 1}일차`, won(model.curves.current[index]), won(model.curves.baseline[index])]));
    }
    root.CashflowLab = Object.freeze({ render });
})(globalThis);
