import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/generated/personal-cfo-domain.js', import.meta.url), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'personal-cfo-domain.js' });

const domain = context.PersonalCfoDomain;
assert.ok(domain, 'PersonalCfoDomain global must be generated');

const closedPeriod = {
  key: '2026-06',
  label: '2026년 6월',
  startDate: '2026-05-25',
  endDate: '2026-06-24',
  transactions: [
    { date: '2026-05-25', type: '수입', category: '월급', memo: '급여', amount: 3_908_580 },
    { date: '2026-06-02', type: '지출', category: '고정비', memo: '통신·보험', amount: -619_682 },
    { date: '2026-06-10', type: '지출', category: '상환', memo: '직장인론 원리금', amount: -1_269_457 },
    { date: '2026-06-15', type: '지출', category: '식비', memo: '생활비', amount: -1_019_863 },
    { date: '2026-06-20', type: '이체', category: '저축', memo: '청년도약 적금', amount: -700_000 },
  ],
};
const openPeriod = {
  key: '2026-07',
  label: '2026년 7월',
  startDate: '2026-06-25',
  endDate: '2026-07-24',
  transactions: [
    { date: '2026-06-25', type: '수입', category: '월급', memo: '급여', amount: 3_998_000 },
    { date: '2026-06-25', type: '지출', category: '식비', memo: '일부 기록', amount: -32_000 },
  ],
};

const closedSummary = domain.selectLatestClosedCashFlow([closedPeriod, openPeriod], '2026-07-16');
assert.equal(closedSummary.periodKey, '2026-06', 'open accounting period must not be treated as closed');
assert.equal(closedSummary.freeCashFlow, 999_578);
assert.equal(closedSummary.debtRepayment, 1_269_457);
assert.equal(closedSummary.savingTransfers, 700_000);

const portfolio = domain.applyPortfolioFinanceData(domain.personalCfoMockSnapshot, [
  { id: 'cash', groupName: '현금 자산', name: '생활계좌', amount: 1_000_000, assetType: 'account' },
  { id: 'deposit', groupName: '기타', name: '전세금', amount: 140_000_000, assetType: 'other' },
  { id: 'loan', groupName: '부채', name: '직장인론', amount: -65_000_000, assetType: 'debt' },
]);
const housingAsset = portfolio.snapshot.assets.find((asset) => asset.bucketKey === 'housing');
assert.equal(housingAsset.marketValue, 140_000_000, 'housing deposit must be classified as housing asset');
assert.equal(domain.calculateNetWorth(portfolio.snapshot), 76_000_000);

const actualSnapshot = domain.applyCashFlowData(portfolio.snapshot, [closedPeriod, openPeriod], '2026-07-16');
const model = domain.createPersonalCfoPageModel(actualSnapshot);
assert.equal(model.graph.mode, 'balanceSheet', 'balance sheet must be the default network mode');
assert.equal(model.summary.monthlyFreeCashFlow, 999_578);
assert.equal(model.graph.nodes.some((node) => node.type === 'income'), false, 'balance sheet must not mix income flow nodes');
const balancePerson = model.graph.nodes.find((node) => node.type === 'person');
const balanceAccounts = model.graph.nodes.filter((node) => node.type === 'account');
const balanceAssets = model.graph.nodes.filter((node) => node.type === 'asset');
const balanceLiabilities = model.graph.nodes.filter((node) => node.type === 'liability');
assert.equal(new Set(balanceAccounts.map((node) => node.x)).size, 1, 'accounts must share one vertical column');
assert.equal(new Set(balanceAssets.map((node) => node.x)).size, 1, 'assets must share one vertical column');
assert.ok(balanceAccounts.every((node) => node.x < balancePerson.x));
assert.ok(balanceAssets.every((node) => node.x > balancePerson.x));
assert.ok(balanceLiabilities.every((node) => node.y > balancePerson.y));
assert.deepEqual(Array.from(model.graph.columns, (column) => column.label), ['계좌', '순자산', '보유자산']);

const cashFlowGraph = domain.buildFinanceGraphFromSnapshot(actualSnapshot, 'cashFlow');
const outgoing = cashFlowGraph.edges
  .filter((edge) => edge.source === actualSnapshot.person.id && edge.amount > 0)
  .reduce((sum, edge) => sum + edge.amount, 0);
assert.equal(outgoing, closedSummary.totalIncome, 'cash-flow graph must conserve the closed-period income');
assert.ok(cashFlowGraph.nodes.some((node) => node.id === 'liability:monthly-debt-payment' && node.amount === 1_269_457));
const cashFlowTargets = cashFlowGraph.nodes.filter((node) => node.type === 'budgetBucket'
  || node.id === 'liability:monthly-debt-payment'
  || node.id === 'account:unallocated-cash');
assert.equal(new Set(cashFlowTargets.map((node) => node.x)).size, 1, 'cash-flow outflows must share one vertical column');

const strategyGraph = domain.buildFinanceGraphFromSnapshot(actualSnapshot, 'strategy');
const strategyBuckets = strategyGraph.nodes.filter((node) => node.type === 'budgetBucket');
const strategyTargets = strategyGraph.nodes.filter((node) => node.type === 'project' || node.type === 'risk');
assert.equal(new Set(strategyBuckets.map((node) => node.x)).size, 1, 'strategy buckets must share one vertical column');
assert.equal(new Set(strategyTargets.map((node) => node.x)).size, 1, 'projects and risks must share one target column');
assert.equal(strategyGraph.laneYs.length, actualSnapshot.budgetBuckets.length);
strategyTargets.forEach((target) => {
  const sourceBucket = strategyBuckets.find((bucket) => bucket.bucketKey === target.bucketKey);
  assert.ok(sourceBucket && Math.abs(sourceBucket.y - target.y) <= 32, 'strategy target must stay inside its bucket lane');
});

console.log('Personal CFO runtime checks ok');
