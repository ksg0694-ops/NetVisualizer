import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({});
for (const file of ['spendingAnalysis', 'cashflowLabModel']) vm.runInContext(await readFile(new URL(`../../js/features/${file}.js`, import.meta.url), 'utf8'), context);
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
    assert.equal(b.analysis.baseline, null);
    assert.ok(b.curves.baseline.every(value => value === null));
    const empty = build([]);
    assert.equal(empty.annual.income, null);
    assert.equal(empty.analysis, null);
    assert.equal(empty.availableCount, 0);
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
