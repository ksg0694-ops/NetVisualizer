import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const context = vm.createContext({});
vm.runInContext(await readFile(new URL('../../js/features/investmentLabModel.js', import.meta.url), 'utf8'), context);
const api = context.InvestmentLabModel;
const holding = (id, value = 120, cost = 100, extra = {}) => ({ id, name: id, ticker: 'AAA', accountName: '계좌 A',
    portKey: 'growth', portLabel: '성장', valuationKrw: value, costKrw: cost, unrealizedPnlKrw: value - cost,
    hasComparableCost: true, isMarketValued: true, priceCurrency: 'KRW', marketPrice: {priceDate:'2026-09-16'}, ...extra });
const build = (rows, options = {}) => api.build(rows, { today: '2026-09-16', ...options });

test('neutral theme keeps gains red, losses blue, and the legend aligned', async () => {
    const view = await readFile(new URL('../../js/features/investmentLab.js', import.meta.url), 'utf8');
    for (const [value, expected] of [[-20, '#1e40af'], [-5, '#bfdbfe'], [0, '#fafafa'], [5, '#fecaca'], [20, '#991b1b']]) {
        assert.equal(api.color(value), expected);
        assert.ok(view.includes(`--swatch:${expected}`));
    }
    assert.equal(api.color(20, false), '#e4e4e7');
});
test('same instrument aggregates accounts with cost weighting; scope reconciles everywhere', () => {
    const rows = [holding('a'), holding('b', 330, 300, { accountName: '계좌 B' })];
    const model = build(rows);
    assert.equal(model.holdings.length, 1);
    assert.equal(model.total, 450); assert.equal(model.pnl, 50);
    assert.equal(model.holdings[0].returnPct, 12.5);
    assert.equal(model.comparablePct, 100); assert.equal(model.topThreePct, 100);
    const filtered = build(rows, { account: '계좌 B' });
    assert.equal(filtered.total, 330); assert.equal(filtered.pnl, 30); assert.equal(filtered.returnPct, 10);
    assert.equal(build(rows, { account: '' }).total, model.total);
});
test('partial cost never colors a whole instrument as fully comparable', () => {
    const model = build([holding('a'), holding('b', 80, 0, { hasComparableCost: false, costKrw: null, unrealizedPnlKrw: null })]);
    assert.equal(model.holdings[0].returnPct, null);
    assert.equal(model.holdings[0].colorReady, false);
    assert.equal(model.pnl, 20); assert.equal(model.comparablePct, 60);
    assert.equal(api.color(null), '#e4e4e7'); assert.notEqual(api.color(0), api.color(null));
});
test('old, missing and future prices/FX preserve value but never imply a fresh return color', () => {
    for (const date of ['', '2026-02-30', '2026-09-17', '2026-09-08']) {
        const model = build([holding('a', 120, 100, { marketPrice: {priceDate:date} })]);
        assert.equal(model.holdings[0].colorReady, false); assert.equal(model.total, 120); assert.equal(model.pnl, 20);
        assert.equal(model.recentPct, 0);
    }
    assert.equal(build([holding('a', 120, 100, {marketPrice:{priceDate:'2026-09-09'}})]).recentPct, 100);
    const foreign = build([holding('a', 120, 100, {priceCurrency:'USD',fxRate:{rateDate:'2026-08-01'}})]);
    assert.equal(foreign.holdings[0].colorReady, false);
    assert.ok(foreign.holdings[0].issues.includes('환율 7일 초과'));
});
test('concentration merges instruments across strategies; markets/currencies and missing tickers stay distinct', () => {
    const rows = [holding('a', 100, 80), holding('b', 100, 80, {portKey:'income'}),
        holding('c', 100, 80, {ticker:'BBB'}), holding('d', 100, 80, {ticker:'CCC'}), holding('e', 100, 80, {ticker:'DDD'})];
    assert.equal(build(rows).topThreePct, 80);
    assert.equal(build(rows,{strategy:'income'}).total, 100);
    assert.equal(build([holding('a'),holding('b',120,100,{priceCurrency:'USD'}),holding('c',120,100,{market:'other'})]).holdings.length,3);
    assert.equal(build([holding('a',120,100,{ticker:''}),holding('b',120,100,{ticker:''})]).holdings.length,2);
});
test('empty, zero, debt and fallback states are explicit', () => {
    assert.equal(build([]).total, null); assert.equal(build([]).pnl, null);
    const model = build([holding('zero',0,0,{hasComparableCost:false}),holding('debt',200,100,{isDebt:true})]);
    assert.equal(model.total,0); assert.equal(model.rows.length,1); assert.equal(model.topThreePct,null);
    const fallback = build([holding('a',500,0,{isMarketValued:false,hasComparableCost:false,fallbackReason:'현재가 없음'})]);
    assert.equal(fallback.total,500); assert.equal(fallback.marketPct,0); assert.equal(fallback.pnl,null);
});
test('weighted rectangle areas reconcile at desktop/mobile sizes without overlaps', () => {
    for (const [w,h] of [[1000,400],[360,350]]) for (let count=1;count<=30;count++) {
        const rows=Array.from({length:count},(_,i)=>({key:String(i),value:(i+1)**2}));
        const total=rows.reduce((a,p)=>a+p.value,0), rects=api.layout(rows,w,h);
        assert.equal(rects.length,count);
        rects.forEach((p,i)=>{
            assert.ok(Math.abs(p.width*p.height/(w*h)-p.value/total)<1e-10);
            assert.ok(p.x>=0&&p.y>=0&&p.x+p.width<=w+1e-8&&p.y+p.height<=h+1e-8);
            rects.slice(i+1).forEach(q=>assert.ok(Math.min(p.x+p.width,q.x+q.width)-Math.max(p.x,q.x)<1e-8 || Math.min(p.y+p.height,q.y+q.height)-Math.max(p.y,q.y)<1e-8));
        });
    }
});
test('integration keeps old views, auth gating, direct links, mobile navigation and refresh', async () => {
    const read=p=>readFile(new URL(`../../${p}`,import.meta.url),'utf8');
    const [html,core,shell,views,ui]=await Promise.all(['index.html','js/features/appCore.js','js/features/appShell.js','js/features/portfolioViews.js','js/features/investmentLab.js'].map(read));
    assert.match(html,/data-mobile-nav-target="investment-lab-view"/);
    assert.match(html,/id="invest-detail-view"/); assert.match(html,/id="portfolio-view"/);
    assert.match(core,/activeViewId === 'investment-lab-view'\) window.InvestmentLab\?\.render/);
    assert.match(shell,/get\('view'\) === 'investment-lab'/);
    assert.match(views,/positions: authUser \?/);
    assert.match(ui,/owner !== source.owner/); assert.match(ui,/textContent = value/);
    assert.doesNotMatch(ui,/localStorage|sessionStorage|fetch\(/);
});
