import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({});
vm.runInContext(await readFile(new URL('../../js/features/spendingAnalysis.js', import.meta.url), 'utf8'), context);
const repayment = tx => tx.type === '지출' && /상환/.test(`${tx.cat || tx.category || ''} ${tx.subcat || tx.subcategory || ''}`);
const tx = (date, amount, type = '지출', category = '생활') => ({ date, amount, type, category });
const period = (month, amount = 100) => ({ key: `2026-${month}`, startDate: `2026-${month}-01`, endDate: `2026-${month}-28`, closeStatus: 'confirmed', transactions: [tx(`2026-${month}-02`, amount), tx(`2026-${month}-20`, 500), tx(`2026-${month}-01`, 1000, '수입')] });
const fixture = () => ['05', '06', '07', '08'].map(month => period(month));
const analyze = periods => context.SpendingAnalysis.analyze(periods, '2026-08', '2026-08-10', repayment);

test('income changes do not change consumption comparison; same elapsed days only', () => {
    const periods = fixture();
    let model = analyze(periods);
    assert.equal(model.elapsed, 10);
    assert.equal(model.baseline, 100);
    assert.equal(model.current.consumption, 100);
    assert.equal(model.difference, 0);
    periods.at(-1).transactions.push(tx('2026-08-03', 999999, '수입'));
    model = analyze(periods);
    assert.equal(model.current.income, 1000999);
    assert.equal(model.baseline, 100);
    assert.equal(model.difference, 0);
});
test('excludes repayments/transfers/future/out-of-period; preserves signed income and absolute expense', () => {
    const periods = fixture();
    periods.at(-1).transactions.push(tx('2026-08-03', -30, '지출', '고정비'), tx('2026-08-03', -900, '지출', '상환'), tx('2026-08-03', 800, '이체'), tx('2026-08-03', -20, '수입'), tx('2026-07-31', 700), tx('2026-08-11', 600), tx('2026-08-03', NaN));
    const model = analyze(periods);
    assert.equal(model.current.consumption, 130);
    assert.equal(model.current.fixed, 30);
    assert.equal(model.current.other, 100);
    assert.equal(model.current.income, 980);
    assert.equal(model.difference, 30);
    assert.equal(model.percent, 30);
});
test('missing/stale/short history never becomes zero baseline', () => {
    const periods = fixture();
    periods[0].closeStatus = 'stale';
    assert.equal(analyze(periods).baseline, null);
    periods[0].closeStatus = 'unconfirmed'; periods[0].transactions = [];
    assert.equal(analyze(periods).samples.length, 2);
    periods[0] = period('05'); periods[0].endDate = '2026-05-05';
    assert.equal(analyze(periods).samples.length, 2);
});
test('confirmed empty histories are zero, never divide by zero; median resists outlier', () => {
    const periods = fixture();
    periods.slice(0, 3).forEach(p => p.transactions = []);
    assert.equal(analyze(periods).baseline, 0);
    assert.equal(analyze(periods).percent, null);
    const normal = fixture(); normal[0].transactions[0].amount = 99999;
    assert.equal(analyze(normal).baseline, 100);
});
test('date boundaries, empty current and full periods', () => {
    const periods = fixture();
    assert.equal(context.SpendingAnalysis.analyze(periods, '2026-08', '2026-07-31', repayment).elapsed, 0);
    assert.equal(context.SpendingAnalysis.analyze(periods, '2026-08', 'invalid', repayment), null);
    assert.equal(context.SpendingAnalysis.analyze(periods, '2026-08', '2026-09-01', repayment).baseline, 600);
    periods.at(-1).transactions = []; periods.at(-1).closeStatus = 'unconfirmed';
    assert.equal(analyze(periods).baseline, null);
    assert.equal(analyze(periods).hasCurrent, false);
});
test('render uses text nodes for untrusted period labels and has separate income/spending headings', () => {
    class Element {
        children = []; textContent = ''; appendChild(child) { this.children.push(child); }
        replaceChildren() { this.children = []; }
    }
    const container = new Element();
    context.document = { getElementById: () => container, createElement: () => new Element() };
    const model = analyze(fixture()); model.samples[0].key = '<img src=x onerror=alert(1)>';
    context.SpendingAnalysis.render(model);
    const text = element => [element.textContent, ...element.children.map(text)].join('\n');
    assert.match(text(container), /소비 수준/);
    assert.match(text(container), /소득 흐름/);
    assert.match(text(container), /<img src=x onerror=alert\(1\)>/);
    context.SpendingAnalysis.render(null);
    assert.match(text(container), /분석할 기간 정보가 없습니다/);
});
