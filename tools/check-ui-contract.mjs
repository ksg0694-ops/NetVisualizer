import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appShell = await readFile(new URL('../js/features/appShell.js', import.meta.url), 'utf8');
const checklist = await readFile(new URL('../js/features/checklist.js', import.meta.url), 'utf8');
const health = await readFile(new URL('../js/features/healthTracker.js', import.meta.url), 'utf8');
const cfo = await readFile(new URL('../js/features/personalCfo.js', import.meta.url), 'utf8');
const financeViews = await readFile(new URL('../js/features/financeViews.js', import.meta.url), 'utf8');

const requiredScripts = [
    './js/shared/appUtils.js',
    './js/features/financeModel.js',
    './js/generated/personal-cfo-domain.js',
    './js/features/lifeDashboard.js',
];
requiredScripts.forEach((script) => assert.ok(index.includes(script), `${script} must be loaded`));

assert.ok(index.indexOf('./js/shared/appUtils.js') < index.indexOf('./js/features/appCore.js'), 'shared utils must load before appCore');
assert.ok(index.indexOf('./js/features/financeModel.js') < index.indexOf('./js/features/financeViews.js'), 'finance model must load before finance views');
assert.ok(index.indexOf('./js/generated/personal-cfo-domain.js') < index.indexOf('./js/features/appCore.js'), 'Personal CFO TypeScript runtime must load before legacy features');
assert.ok(!index.includes('xlsx.full.min.js'), 'SheetJS must be loaded on demand');
assert.ok(!index.includes('leaflet.js'), 'Leaflet must be loaded on demand');
assert.ok(index.includes('id="finance-data-source-badge"'));
assert.ok(index.includes('id="finance-cashflow-source-badge"'));
assert.ok(index.includes('id="finance-closed-free-cash"'));
assert.ok(index.includes('id="finance-decision-inbox"'));
assert.ok(index.includes('id="btn-goal-home-label"'));
assert.ok(appShell.includes("? '재무 홈'"));
assert.ok(appShell.includes("? '생활 홈'"));
assert.ok(appShell.includes("window.LifeDashboardFeature?.render()"));
assert.ok(checklist.includes('getDashboardSnapshot'));
assert.ok(checklist.includes('selectTask'));
assert.ok(health.includes('getDashboardSnapshot'));
assert.ok(cfo.includes('renderMobileFinanceSummary'));
assert.ok(cfo.includes('getDashboardSnapshot'));
assert.ok(cfo.includes('const defaultSnapshot = domain.personalCfoMockSnapshot'));
assert.ok(cfo.includes('domain.createPersonalCfoPageModel(portfolioOverlay.snapshot, activeGraphMode)'));
assert.ok(financeViews.includes('selectLatestClosedCashFlow(periods, today)'));
assert.ok(financeViews.includes('const selfFunding = Math.max(0, liquidAndSafe + housingFunds + discountedInvestments + debt)'));

console.log('UI runtime contracts ok');
