import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appShell = await readFile(new URL('../js/features/appShell.js', import.meta.url), 'utf8');
const appCore = await readFile(new URL('../js/features/appCore.js', import.meta.url), 'utf8');
const checklist = await readFile(new URL('../js/features/checklist.js', import.meta.url), 'utf8');
const health = await readFile(new URL('../js/features/healthTracker.js', import.meta.url), 'utf8');
const lifeDashboard = await readFile(new URL('../js/features/lifeDashboard.js', import.meta.url), 'utf8');
const cfo = await readFile(new URL('../js/features/personalCfo.js', import.meta.url), 'utf8');
const monthlyClose = await readFile(new URL('../js/features/monthlyClose.js', import.meta.url), 'utf8');
const financeModel = await readFile(new URL('../js/features/financeModel.js', import.meta.url), 'utf8');
const financeViews = await readFile(new URL('../js/features/financeViews.js', import.meta.url), 'utf8');
const portfolioEditor = await readFile(new URL('../js/features/portfolioEditor.js', import.meta.url), 'utf8');

const requiredScripts = [
    './js/shared/appUtils.js',
    './js/features/financeRepository.js',
    './js/features/financeModel.js',
    './js/generated/personal-cfo-domain.js',
    './js/features/monthlyClose.js',
    './js/features/lifeDashboard.js',
];
requiredScripts.forEach((script) => assert.ok(index.includes(script), `${script} must be loaded`));

assert.ok(index.indexOf('./js/shared/appUtils.js') < index.indexOf('./js/features/appCore.js'), 'shared utils must load before appCore');
assert.ok(index.indexOf('./js/features/financeRepository.js') < index.indexOf('./js/features/appCore.js'), 'finance repository must load before appCore');
assert.ok(index.indexOf('./js/features/financeModel.js') < index.indexOf('./js/features/financeViews.js'), 'finance model must load before finance views');
assert.ok(index.indexOf('./js/generated/personal-cfo-domain.js') < index.indexOf('./js/features/appCore.js'), 'Personal CFO TypeScript runtime must load before legacy features');
assert.ok(index.indexOf('./js/features/monthlyClose.js') < index.indexOf('./js/features/appCore.js'), 'monthly close controller must load before appCore hydration');
assert.ok(!index.includes('xlsx.full.min.js'), 'SheetJS must be loaded on demand');
assert.ok(!index.includes('leaflet.js'), 'Leaflet must be loaded on demand');
assert.ok(index.includes('id="finance-data-source-badge"'));
assert.ok(index.includes('id="finance-cashflow-source-badge"'));
assert.ok(index.includes('id="finance-closed-free-cash"'));
assert.ok(index.includes('id="finance-decision-inbox"'));
assert.ok(index.includes('id="cashflow-month-close-panel"'));
assert.ok(index.indexOf('id="finance-decision-inbox"') < index.indexOf('id="dashboardAssetChart"'), 'finance decisions must appear before the asset chart');
assert.ok(index.includes('id="btn-goal-home-label"'));
assert.ok(appShell.includes("? '재무 홈'"));
assert.ok(appShell.includes("? '생활 홈'"));
assert.ok(appShell.includes("window.LifeDashboardFeature?.render()"));
assert.ok(checklist.includes('getDashboardSnapshot'));
assert.ok(checklist.includes('selectTask'));
assert.ok(health.includes('getDashboardSnapshot'));
assert.ok(!lifeDashboard.includes('PersonalCfoFeature'), 'Life dashboard must not read CFO projects');
assert.ok(!lifeDashboard.includes('data-life-project'), 'Life dashboard must not expose CFO project routes');
assert.ok(cfo.includes('renderMobileFinanceSummary'));
assert.ok(cfo.includes('getDashboardSnapshot'));
assert.ok(cfo.includes('const emptySnapshot = domain.createEmptyPersonalCfoSnapshot()'));
assert.ok(cfo.includes("const SCHEMA_VERSION = 3"));
assert.ok(!cfo.includes('personalCfoMockSnapshot'));
assert.ok(cfo.includes('domain.createPersonalCfoPageModel(portfolioOverlay.snapshot, activeGraphMode)'));
assert.ok(cfo.includes('const middleX = Math.round(((sourceX + targetX) / 2) / 4) * 4'));
assert.ok(!cfo.includes('buildGraphEdgeRoutes'), 'graph edges should share simple routes instead of collision-avoidance fans');
assert.ok(cfo.includes("dataLabel: '실제 데이터'"));
assert.ok(cfo.includes("dataLabel: '계획 모델'"));
assert.ok(cfo.includes("basis: 'actual'"));
assert.ok(cfo.includes("basis: summary.hasSavingsPlan ? 'plan' : 'unset'"));
assert.ok(cfo.includes("unset: 'border-gray-200 bg-gray-50 text-gray-500'"));
assert.ok(cfo.includes("'계획 데이터 없음'"));
assert.ok(cfo.includes('등록된 프로젝트·리스크 계획이 없습니다.'));
assert.ok(monthlyClose.includes('domain.closeFinanceMonth'));
assert.ok(monthlyClose.includes('saveFinanceMonthlyCloseRecord'));
assert.ok(monthlyClose.includes("const actionDisabled = !closed"), 'reopening a closed month must remain available when source rows changed');
assert.ok(appCore.includes('PersonalCfoDomain.getPaydayAccountingPeriod'));
assert.ok(!appCore.includes('const PAYDAYS'), 'payday overrides must live in the TypeScript finance domain');
assert.ok(financeModel.includes('items.sort((a, b) => b.priority - a.priority)'));
assert.ok(financeViews.includes('selectLatestClosedCashFlow(periods, today)'));
assert.ok(financeViews.includes('const selfFunding = Math.max(0, liquidAndSafe + housingFunds + discountedInvestments + debt)'));
assert.ok(portfolioEditor.includes('createPortfolioDraft(rawPortfolioData)'));
assert.ok(portfolioEditor.includes('savePortfolioDraft(workingPortfolioData)'));
assert.ok(!portfolioEditor.includes(".from('portfolios')"), 'portfolio editor must not issue Supabase writes directly');
assert.ok(!/workingPortfolioData\[[^\]]+\]\[[^\]]+\]/.test(portfolioEditor), 'portfolio draft must not use indexed columns');

console.log('UI runtime contracts ok');
