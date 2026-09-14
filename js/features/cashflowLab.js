// Experimental visual dashboard. Keeps the original cashflow view untouched.
(function (root) {
    'use strict';
    let selectedKey = '', reportMode = false;
    const colors = { income: '#2874b8', spending: '#c76c32', comparison: '#8d9aa6', positive: '#355e78', negative: '#b96e41' };
    const won = value => value == null ? '—' : `${Math.round(value).toLocaleString('ko-KR')}원`;
    const compact = value => value == null ? '—' : `${(value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
    function text(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
    function mount(container) {
        container.innerHTML = `
            <div class="cfl-header">
                <div><h2>현금흐름 Lab</h2><p class="cfl-subtitle">2026 연간 분석 · 급여 주기별 소비 리포트</p></div>
                <div class="cfl-controls">
                    <button type="button" id="cfl-dashboard" aria-pressed="true">대시보드</button>
                    <button type="button" id="cfl-report" aria-pressed="false">리포트</button>
                    <button type="button" id="cfl-print">인쇄 / PDF</button>
                    <button type="button" id="cfl-old">구버전 비교 ↗</button>
                </div>
            </div>
            <div class="cfl-report" id="cfl-report-summary"><h3>2026 현금흐름 리포트</h3><ol id="cfl-findings"></ol></div>
            <div class="cfl-section-heading"><div><h3>2026 한눈에</h3><p>2026 급여 주기 기준 · 오늘까지 반영된 거래</p></div><span id="cfl-coverage" class="cfl-status"></span></div>
            <div class="cfl-kpis">
                <div class="cfl-kpi"><span>누적 소득</span><strong id="cfl-income"></strong><small>수입 분류 합계</small></div>
                <div class="cfl-kpi"><span>누적 소비</span><strong id="cfl-spending"></strong><small>상환 제외 지출</small></div>
                <div class="cfl-kpi"><span>누적 상환</span><strong id="cfl-repayment"></strong><small>상환 분류 지출</small></div>
                <div class="cfl-kpi"><span>장부상 잉여</span><strong id="cfl-net"></strong><small>소득 − 소비 − 상환 · 저축이체 미차감</small></div>
            </div>
            <div class="cfl-grid">
                <article class="cfl-panel"><h4>월별 소득과 소비</h4><p class="cfl-note">동일 금액 축 · 막대를 누르면 해당 주기 상세 보기</p><div class="cfl-chart"><canvas id="cfl-year-chart" role="img" aria-label="2026 월별 소득과 소비 비교. 아래 원자료 표에서도 확인할 수 있습니다."></canvas><p id="cfl-year-empty" class="cfl-empty" hidden></p></div></article>
                <article class="cfl-panel"><h4>월별 장부상 잉여</h4><p class="cfl-note">소득 − 전체 지출 · 실제 계좌 잔액과 다름</p><div class="cfl-chart"><canvas id="cfl-net-chart" role="img" aria-label="2026 월별 장부상 잉여. 음수는 지출이 소득보다 많은 기간입니다."></canvas><p id="cfl-net-empty" class="cfl-empty" hidden></p></div></article>
            </div>
            <div class="cfl-section-heading"><div><h3 id="cfl-current-title">이번 급여 주기</h3><p id="cfl-period-range"></p></div><div class="cfl-controls"><label for="cfl-period">상세 주기</label><select id="cfl-period"></select><button type="button" id="cfl-current">현재 주기</button></div></div>
            <div class="cfl-grid">
                <article class="cfl-panel"><h4>소비 속도</h4><p class="cfl-note">누적 소비 vs 과거 같은 경과일 중앙값 · 소득과 독립</p><div class="cfl-pace-total"><strong id="cfl-current-spending"></strong><span id="cfl-pace-delta"></span></div><div class="cfl-progress" aria-hidden="true"><i id="cfl-elapsed"></i></div><div class="cfl-chart cfl-chart-tall"><canvas id="cfl-pace-chart" role="img" aria-label="선택 주기의 일별 누적 소비와 과거 같은 경과일 중앙값"></canvas><p id="cfl-pace-empty" class="cfl-empty" hidden></p></div><p class="cfl-note" id="cfl-baseline-note"></p></article>
                <article class="cfl-panel"><h4>어디에 썼나</h4><p class="cfl-note">같은 경과일 카테고리별 소비 · 과거 비교는 평균</p><div class="cfl-chart cfl-chart-tall"><canvas id="cfl-category-chart" role="img" aria-label="카테고리별 현재 소비와 과거 평균 비교"></canvas><p id="cfl-category-empty" class="cfl-empty" hidden></p></div><p class="cfl-note">상위 6개 + 그 외 합계 · 평균은 합산 가능, 중앙값과 다름</p></article>
            </div>
            <details class="cfl-evidence"><summary>계산 기준 · 원자료 · 시각화 계획</summary>
                <p>원천: 로그인 계정의 동기화된 거래와 유효한 월 마감. 금액은 원화, 급여일~다음 급여일 전날 기준입니다. 2026년 주기에는 전년 말 거래가 포함될 수 있습니다. 진행 중인 기간은 오늘까지만 표시하며, 빈 미확정 기간은 0원으로 채우지 않습니다.</p>
                <p id="cfl-source-status"></p>
                <p>소비 기준선: 종료된 최근 최대 6개 중 같은 경과일 비교가 가능한 최소 3개 주기. 변경된 마감과 빈 미확정 주기는 제외합니다. 과거 수준은 적정 예산이 아닙니다. 지출 금액은 기존 장부의 절댓값 규칙을 유지하며 환불은 거래 분류를 먼저 확인해야 합니다.</p>
                <p>계획: 연간 규모(막대) → 주기 내 지출 속도(누적선) → 소비 구성(가로막대). 리포트는 같은 데이터·차트를 재사용합니다. 연간 차트는 2026 고정, 상세 주기 선택은 아래 두 차트에만 적용됩니다.</p>
                <h4>2026 주기별 집계</h4><div id="cfl-year-table" class="cfl-table-wrap"></div>
                <h4>선택 주기 카테고리 비교</h4><div id="cfl-category-table" class="cfl-table-wrap"></div>
                <h4>선택 주기 누적 소비</h4><div id="cfl-pace-table" class="cfl-table-wrap"></div>
            </details>`;
        document.getElementById('cfl-period').addEventListener('change', event => { selectedKey = event.target.value; render(); });
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
            scales: { x: { grid: { display: false }, ticks: { color: '#68788a', font: { size: 11 }, maxRotation: 0 } }, y: { beginAtZero: true, grid: { color: '#edf1f5' }, ticks: { color: '#68788a', callback: compact, font: { size: 11 } } } },
            ...extra,
        };
        root.renderOrUpdateChart(`cashflowLab-${name}`, id, { type, data: { labels, datasets }, options });
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
        text('cfl-coverage', `${model.availableCount}/12개 주기 기록${model.provisional ? ' · 미확정 포함' : ''}`);
        const labels = model.monthly.map(row => `${Number(row.key.slice(5))}월${row.partial ? '*' : ''}`);
        chart('year', labels, [
            { label: '소득', data: model.monthly.map(row => row.income), backgroundColor: colors.income, borderRadius: 3 },
            { label: '소비', data: model.monthly.map(row => row.spending), backgroundColor: colors.spending, borderRadius: 3 },
        ], { onClick: (_event, elements) => { const row = elements[0] && model.monthly[elements[0].index]; if (row?.known) { selectedKey = row.key; render(); document.getElementById('cfl-current-title').scrollIntoView({ behavior: 'smooth', block: 'start' }); } } });
        chart('net', labels, [{ label: '장부상 잉여', data: model.monthly.map(row => row.net), backgroundColor: model.monthly.map(row => row.net < 0 ? colors.negative : colors.positive), borderRadius: 3 }]);
        const a = model.analysis;
        text('cfl-current-title', model.isCurrent ? '이번 급여 주기' : '선택 급여 주기');
        text('cfl-period-range', model.selected ? `${model.selected.startDate} ~ ${model.selected.endDate} · ${a?.elapsed || 0}/${a?.duration || 0}일 경과` : '조회 가능한 주기 없음');
        text('cfl-current-spending', a?.hasCurrent ? `${compact(a.current.consumption)}원` : '기록 없음');
        text('cfl-pace-delta', a?.difference == null ? '비교 자료 부족' : `과거 중앙값보다 ${won(Math.abs(a.difference))} ${a.difference > 0 ? '많음' : a.difference < 0 ? '적음' : '차이 없음'}`);
        document.getElementById('cfl-elapsed').style.width = `${a ? a.elapsed / a.duration * 100 : 0}%`;
        text('cfl-baseline-note', `${a?.samples.length || 0}개 비교 주기 · ${a?.elapsed || 0}일차까지 · 마지막 거래 ${a?.current.latest || '없음'}${a?.provisional ? ' · 잠정 비교' : ''}`);
        chart('pace', model.curves.labels, [
            { label: '선택 주기 소비', data: model.curves.current, borderColor: colors.spending, backgroundColor: colors.spending, borderWidth: 3, pointRadius: a?.elapsed === 1 ? 4 : 0, pointHitRadius: 12, spanGaps: false },
            { label: '과거 중앙값', data: model.curves.baseline, borderColor: colors.comparison, backgroundColor: colors.comparison, borderDash: [5, 4], borderWidth: 2, pointRadius: a?.elapsed === 1 ? 4 : 0, spanGaps: false },
        ], {}, 'line');
        chart('category', model.categories.map(row => row.category), [
            { label: '선택 주기', data: model.categories.map(row => row.current), backgroundColor: colors.spending, borderRadius: 3 },
            { label: '과거 평균', data: model.categories.map(row => row.average), backgroundColor: '#bcc6cf', borderRadius: 3 },
        ], { indexAxis: 'y', scales: { x: { beginAtZero: true, grid: { color: '#edf1f5' }, ticks: { callback: compact, font: { size: 11 }, maxRotation: 0 } }, y: { grid: { display: false }, ticks: { font: { size: 12 }, callback: function(value) { const label = this.getLabelForValue(value); return label.length > 10 ? `${label.slice(0, 9)}…` : label; } } } } });
        const findings = document.getElementById('cfl-findings'); findings.replaceChildren();
        const biggest = [...model.categories].sort((x, y) => y.current - x.current)[0];
        const lines = [model.incomeRange ? `2026 종료 주기 소득은 ${compact(model.incomeRange.min)}~${compact(model.incomeRange.max)}원. 중앙값 ${compact(model.incomeRange.median)}원 (${model.incomeRange.count}개 주기).` : '2026 종료 주기의 소득 기록이 없어 변동 범위를 계산하지 않았습니다.',
            a?.difference != null ? `${model.selected.key} ${a.elapsed}일차 소비 ${compact(a.current.consumption)}원. 과거 같은 경과일 중앙값과 ${won(Math.abs(a.difference))} ${a.difference > 0 ? '증가' : a.difference < 0 ? '감소' : '차이 없음'}.` : '선택 주기 소비 비교는 현재 기록과 최소 3개 과거 주기가 필요합니다.',
            biggest ? `선택 주기 최대 소비 묶음은 ${biggest.category}, ${won(biggest.current)}. 지출 시점·일회성 여부는 원장과 함께 확인하세요.` : '선택 주기에 표시할 소비 분류가 없습니다.'];
        lines.forEach(line => { const li = document.createElement('li'); li.textContent = line; findings.appendChild(li); });
        text('cfl-source-status', `관측 기준 ${model.today} · *는 진행 중 주기. 비교에 사용한 과거 주기: ${a?.samples.map(p => `${p.key}${p.confirmed ? '' : '(미확정)'}`).join(', ') || '없음'}. 거래 누락·마감 변경에 따라 결과가 달라집니다.`);
        table('cfl-year-table', ['주기', '날짜', '소득', '소비', '상환', '잉여', '건수', '마지막 거래', '상태'], model.monthly.map(row => [row.key, `${row.start} ~ ${row.end}`, won(row.income), won(row.spending), won(row.repayment), won(row.net), row.count, row.latest, row.status]));
        table('cfl-category-table', ['분류', '선택 주기', '과거 평균'], model.categories.map(row => [row.category, won(row.current), won(row.average)]));
        table('cfl-pace-table', ['경과일', '선택 주기 누적', '과거 중앙값'], model.curves.labels.map((label, index) => [label, won(model.curves.current[index]), won(model.curves.baseline[index])]));
    }
    root.CashflowLab = Object.freeze({ render });
})(globalThis);
