import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({});
test('promoted cashflow keeps both direct links and retires legacy navigation', async () => {
    const shell = await readFile(new URL('../../js/features/appShell.js', import.meta.url), 'utf8');
    const view = await readFile(new URL('../../js/features/cashflowLab.js', import.meta.url), 'utf8');
    assert.ok(!shell.includes("title: '현금흐름 (삭제 예정)'"));
    assert.ok(shell.includes("get('view') === 'cashflow'"));
    assert.ok(shell.includes('cashflow-lab'));
    assert.ok(!view.includes('현금흐름 Lab'));
    assert.ok(!view.includes('id="cfl-old"'));
});
test('Lab reference copy stays short without removing tables or data warnings', async () => {
    const view = await readFile(new URL('../../js/features/cashflowLab.js', import.meta.url), 'utf8');
    for (const removed of ['원천: 로그인 계정', '관측 기준', '소비 기준선:', 'Y축 고정:', 'cfl-source-status', 'cfl-axis-note']) assert.ok(!view.includes(removed));
    assert.ok(view.includes('<details class="cfl-evidence"><summary>계산 기준 · 집계표</summary>'));
    for (const id of ['cfl-year-table', 'cfl-category-table', 'cfl-pace-table', 'cfl-pace-empty']) assert.ok(view.includes(`id="${id}"`));
    const investment = await readFile(new URL('../../js/features/investmentLab.js', import.meta.url), 'utf8');
    assert.ok(investment.includes('<summary>계산 기준</summary>'));
    assert.ok(investment.includes('미실현 가격손익 · 환차손익·배당·수수료 제외'));
});
for (const file of ['spendingAnalysis', 'cashflowLabModel']) vm.runInContext(await readFile(new URL(`../../js/features/${file}.js`, import.meta.url), 'utf8'), context);
test('annotation feedback removes header actions and handles percentage baselines', async () => {
    const view = await readFile(new URL('../../js/features/cashflowLab.js', import.meta.url), 'utf8');
    for (const id of ['cfl-report', 'cfl-print', 'cfl-old']) assert.ok(!view.includes(`id="${id}"`));
    assert.ok(view.includes('cfl-common-scale'));
    assert.equal(context.CashflowLabModel.categoryDelta({current:120,average:100}), '+20%');
    assert.equal(context.CashflowLabModel.categoryDelta({current:50,average:100}), '-50%');
    assert.equal(context.CashflowLabModel.categoryDelta({current:50,average:0}), '신규');
    assert.equal(context.CashflowLabModel.categoryDelta({current:50,average:null}), '비교 없음');
});
const repayment = tx => tx.type === '지출' && tx.category === '상환';
const tx = (date, amount, type = '지출', category = '생활') => ({ date, amount, type, category });
function fixture() {
    return ['01', '02', '03', '04'].map(month => ({ key: `2026-${month}`, label: month, startDate: `2026-${month}-01`, endDate: `2026-${month}-28`, closeStatus: 'confirmed', transactions: [tx(`2026-${month}-01`, 1000, '수입'), tx(`2026-${month}-02`, -100), tx(`2026-${month}-05`, -50, '지출', '상환'), tx(`2026-${month}-20`, -200)] }));
}
const build = (periods, key = '', today = '2026-04-10') => context.CashflowLabModel.build(periods, key, today, repayment, context.SpendingAnalysis.analyze);
test('annual accounting year, cashflow reconciliation, future and missing periods', () => {
    const periods = fixture();
    periods.push({ ...periods[0], key: '2025-12' });
    const model = build(periods);
    assert.equal(model.currentKey, '2026-04');
    assert.equal(model.annual.income, 4000);
    assert.equal(model.annual.spending, 1000);
    assert.equal(model.annual.repayment, 200);
    assert.equal(model.annual.net, 2800);
    assert.equal(model.annual.net, model.annual.income - model.annual.spending - model.annual.repayment);
    assert.equal(model.monthly[8].income, null);
    assert.equal(model.monthly[3].partial, true);
});
test('cumulative median matches independent spending model, future remains null', () => {
    const model = build(fixture());
    assert.equal(model.curves.current[0], 0);
    assert.equal(model.curves.current[1], 100);
    assert.equal(model.curves.current[9], 100);
    assert.equal(model.curves.current[10], null);
    assert.equal(model.curves.baseline[9], model.analysis.baseline);
    assert.equal(model.curves.baseline[10], null);
    assert.equal(model.categories[0].average, 100);
});
test('category means reconcile including long-tail Other, income never affects pace', () => {
    const periods = fixture();
    periods.forEach(p => { for (let n = 1; n <= 9; n++) p.transactions.push(tx(p.startDate, -n, '지출', `분류${n}`)); });
    let model = build(periods);
    assert.equal(model.categories.length, 7);
    assert.equal(model.categories.reduce((n, row) => n + row.current, 0), 145);
    assert.equal(model.categories.reduce((n, row) => n + row.average, 0), 145);
    periods.at(-1).transactions.push(tx('2026-04-03', 50000, '수입'));
    model = build(periods);
    assert.equal(model.analysis.baseline, 145);
    assert.equal(model.analysis.difference, 0);
});
test('selected period only changes detail, annual totals stable; insufficient history and empty data', () => {
    const periods = fixture();
    const a = build(periods), b = build(periods, '2026-02');
    assert.equal(a.annual.income, b.annual.income);
    assert.equal(b.selected.key, '2026-02');
    assert.equal(b.analysis.baseline, 300);
    assert.equal(b.analysis.samples.length, 1);
    assert.equal(b.curves.baseline.at(-1), 300);
    const empty = build([]);
    assert.equal(empty.annual.income, null);
    assert.equal(empty.analysis, null);
    assert.equal(empty.availableCount, 0);
});
test('changed close histories are included; real payday dates and stable Y scale across selections', () => {
    const bounds = [
        ['2025-12-24','2026-01-22'], ['2026-01-23','2026-02-24'],
        ['2026-02-25','2026-03-24'], ['2026-03-25','2026-04-23'],
        ['2026-04-24','2026-05-21'], ['2026-05-22','2026-06-24'],
        ['2026-06-25','2026-07-23'], ['2026-07-24','2026-08-24'],
        ['2026-08-25','2026-09-22'],
    ];
    const periods = bounds.map(([startDate,endDate],i) => ({ key:`2026-${String(i+1).padStart(2,'0')}`,startDate,endDate,closeStatus:'stale',transactions:[tx(startDate,-(i+1)*100000)] }));
    const september = build(periods,'2026-09','2026-09-15');
    const august = build(periods,'2026-08','2026-09-15');
    assert.equal(september.analysis.samples.length,8);
    assert.equal(september.analysis.baseline,450000);
    assert.equal(september.curves.labels[0],'8/25');
    assert.equal(september.curves.dates[21],'2026-09-15');
    assert.equal(september.curves.labels.at(-1),'9/22');
    assert.equal(august.analysis.samples.length,2);
    assert.equal(august.analysis.baseline,400000);
    assert.equal(august.analysis.shortPeriodCount,5);
    assert.equal(september.paceAxisMax,august.paceAxisMax);
    assert.ok(september.paceAxisMax >= 900000);
    assert.equal(september.monthly[8].dailySpending,900000/22);
    assert.equal(september.monthly[7].dailySpending,800000/32);
    const june = build(periods,'2026-06','2026-09-15');
    assert.equal(june.analysis.duration,34);
    assert.equal(june.analysis.historyCount,5);
    assert.equal(june.analysis.shortPeriodCount,5);
    assert.equal(june.analysis.samples.length,0);
    assert.equal(june.analysis.baseline,null);
    assert.ok(june.curves.baseline.every(value => value === null));
    assert.equal(june.monthly[5].spending,600000);
    assert.equal(june.monthly[5].dailySpending,600000/34);
});
test('navigation, refresh and asset integration remain independent of old view', async () => {
    const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    const [html, core, shell] = await Promise.all([read('index.html'), read('js/features/appCore.js'), read('js/features/appShell.js')]);
    assert.match(html, /data-target="cashflow-lab-view"/);
    assert.match(html, /data-mobile-nav-target="cashflow-lab-view"/);
    assert.match(html, /id="cashflow-view"/);
    assert.match(html, /id="cashflow-lab-view"/);
    assert.match(core, /activeViewId === 'cashflow-lab-view'\) window.CashflowLab\?\.render/);
    assert.match(shell, /targetId === 'cashflow-lab-view'\) window.CashflowLab\?\.render/);
});
