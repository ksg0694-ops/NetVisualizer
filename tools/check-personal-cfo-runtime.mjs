import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/generated/personal-cfo-domain.js', import.meta.url), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'personal-cfo-domain.js' });

const domain = context.PersonalCfoDomain;
assert.ok(domain, 'PersonalCfoDomain global must be generated');
assert.equal(domain.personalCfoMockSnapshot, undefined, 'mock snapshot must not be part of the runtime');
const emptySnapshot = domain.createEmptyPersonalCfoSnapshot();
assert.deepEqual(
  Array.from(['incomes', 'accounts', 'assets', 'liabilities', 'budgetBuckets', 'projects', 'risks', 'kpis'], (key) => emptySnapshot[key].length),
  [0, 0, 0, 0, 0, 0, 0, 0],
);
const migratedPlan = domain.normalizePersonalCfoPlanSnapshot({
  accounts: [{ id: 'account:portfolio:operating', balance: 99_000_000 }],
  budgetBuckets: [{ id: 'defense', label: 'legacy seed' }],
  projects: [
    null,
    {},
    { id: 'project:changneung', label: 'legacy seed' },
    { id: 'project:custom', label: '사용자 계획' },
  ],
}, 2);
assert.equal(migratedPlan.accounts.length, 0, 'actual finance rows must not persist in plan snapshots');
assert.equal(migratedPlan.budgetBuckets.length, 0, 'legacy seed buckets must be removed');
assert.deepEqual(Array.from(migratedPlan.projects, (project) => project.id), ['project:custom']);

assert.equal(domain.getPaydayDate(2026, 7), '2026-07-24');
const beforeJulyPayday = domain.getPaydayAccountingPeriod('2026-07-23');
assert.equal(beforeJulyPayday.monthKey, '2026-07');
assert.equal(beforeJulyPayday.periodStart, '2026-06-25');
assert.equal(beforeJulyPayday.periodEnd, '2026-07-23');
const onJulyPayday = domain.getPaydayAccountingPeriod('2026-07-24');
assert.equal(onJulyPayday.monthKey, '2026-08');
assert.equal(onJulyPayday.periodStart, '2026-07-24');
assert.equal(onJulyPayday.periodEnd, '2026-08-24');

const closedPeriod = {
  key: '2026-06',
  label: '2026년 6월',
  startDate: '2026-05-25',
  endDate: '2026-06-24',
  closeStatus: 'confirmed',
  transactions: [
    { date: '2026-05-25', type: '수입', category: '급여', memo: '급여', amount: 3_908_580 },
    { date: '2026-05-25', type: '이체', category: '내계좌이체', memo: '본인', method: '월급통장', amount: -100_000 },
    { date: '2026-06-02', type: '지출', category: '고정비', memo: '통신·보험', amount: -619_682 },
    { date: '2026-06-10', type: '지출', category: '상환', subcategory: '신용대출', memo: '직장인론 이자', amount: -269_457 },
    { date: '2026-06-10', type: '지출', category: '상환', subcategory: '전세대출', memo: '주거 정산', amount: -1_000_000 },
    { date: '2026-06-15', type: '지출', category: '식비', memo: '생활비', amount: -1_019_863 },
    { date: '2026-05-25', type: '이체', category: '저축', memo: '청년도약계좌', method: '월급통장', amount: -700_000 },
    { date: '2026-05-25', type: '이체', category: '저축', memo: '월 자동이체', method: '신한 청년도약계좌', amount: -700_000 },
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
assert.equal(closedSummary.reviewStatus, 'confirmed', 'cash-flow review status must propagate from the close record');
assert.equal(closedSummary.freeCashFlow, 999_578);
assert.equal(closedSummary.debtRepayment, 269_457, 'only the bank-loan interest is debt cash flow');
assert.equal(closedSummary.creditLoanInterest, 269_457);
assert.equal(closedSummary.housingLoanPayment, 1_000_000, 'housing payment is cash-flow only');
assert.equal(closedSummary.youthSavings, 700_000, 'the destination-side youth account row must not double count');
assert.equal(closedSummary.pensionSavings, 100_000);
assert.equal(closedSummary.savingTransfers, 800_000);
assert.equal(closedSummary.unallocatedCash, 199_578);
assert.equal(closedSummary.salaryAllocation.reconciliation.usesReconciledAccountFlow, false);
assert.equal(
  closedSummary.salaryAllocation.reconciliation.entries.find((entry) => entry.key === 'livingFunding').status,
  'target',
);
assert.deepEqual(
  {
    salary: closedSummary.salaryAllocation.salaryIncome,
    youth: closedSummary.salaryAllocation.youthSavings,
    pension: closedSummary.salaryAllocation.pensionSavings,
    credit: closedSummary.salaryAllocation.creditLoanInterest,
    housing: closedSummary.salaryAllocation.housingLoanPayment,
    salaryReserve: closedSummary.salaryAllocation.salaryAccountReserve,
    livingReserve: closedSummary.salaryAllocation.livingAccountReserve,
    note: closedSummary.salaryAllocation.safeAssetSweep,
  },
  {
    salary: 3_908_580,
    youth: 700_000,
    pension: 100_000,
    credit: 269_457,
    housing: 1_000_000,
    salaryReserve: 500_000,
    livingReserve: 500_000,
    note: 839_123,
  },
);

const reconciledPeriod = {
  key: '2026-06-reconciled',
  label: '2026년 6월 실제',
  startDate: '2026-05-22',
  endDate: '2026-06-24',
  closeStatus: 'confirmed',
  transactions: [
    { id: 'salary', date: '2026-05-22', time: '03:42:00', type: '수입', category: '급여', memo: '급여', method: '월급통장', amount: 3_776_000 },
    { id: 'loan-in', date: '2026-05-22', time: '07:03:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '대출통장', amount: 300_000 },
    { id: 'loan-out', date: '2026-05-22', time: '07:03:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -300_000 },
    { id: 'pension-out', date: '2026-05-22', time: '07:03:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -100_000 },
    { id: 'living-in-100', date: '2026-05-22', time: '07:04:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '생활비 통장', amount: 100_000 },
    { id: 'living-out-100', date: '2026-05-22', time: '07:04:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -100_000 },
    { id: 'youth-out', date: '2026-05-22', time: '08:10:00', type: '이체', category: '저축', memo: '청년도약계좌', method: '월급통장', amount: -700_000 },
    { id: 'youth-in', date: '2026-05-22', time: '08:10:00', type: '이체', category: '저축', memo: '월 자동이체', method: '신한 청년도약계좌', amount: 700_000 },
    { id: 'credit-interest', date: '2026-05-22', time: '15:13:00', type: '지출', category: '상환', subcategory: '신용대출', memo: '40698026625142-00001', method: '대출통장', amount: -269_457 },
    { id: 'loan-return-out', date: '2026-05-22', time: '21:36:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '대출통장', amount: -30_543 },
    { id: 'loan-return-in', date: '2026-05-22', time: '21:36:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: 30_543 },
    { id: 'living-return-out', date: '2026-05-22', time: '21:37:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '생활비 통장', amount: -282_307 },
    { id: 'living-return-in', date: '2026-05-22', time: '21:37:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: 282_307 },
    { id: 'living-in-500', date: '2026-05-23', time: '05:31:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '생활비 통장', amount: 500_000 },
    { id: 'living-out-500', date: '2026-05-23', time: '05:31:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -500_000 },
    { id: 'note-out-2m', date: '2026-05-23', time: '05:32:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -2_000_000 },
    { id: 'note-return-1m', date: '2026-05-23', time: '05:37:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: 1_000_000 },
    { id: 'note-out-rest', date: '2026-05-23', time: '05:37:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -118_502 },
    { id: 'housing', date: '2026-05-25', time: '10:23:00', type: '지출', category: '상환', subcategory: '전세대출', memo: '김삼봉', method: '월급통장', amount: -1_000_000 },
    { id: 'late-living-out', date: '2026-06-07', time: '07:58:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '월급통장', amount: -300_000 },
    { id: 'late-living-in', date: '2026-06-07', time: '07:58:00', type: '이체', category: '내계좌이체', memo: '김성준', method: '생활비 통장', amount: 300_000 },
  ],
};
const reconciliation = domain.reconcileSalaryFlowPeriod(reconciledPeriod);
const reconciliationEntries = Object.fromEntries(Array.from(reconciliation.entries, (entry) => [entry.key, entry]));
assert.equal(reconciliation.internalTransfers.length, 6, 'payday internal transfers must be paired once');
assert.equal(reconciliation.livingAccountNetFunding, 317_693);
assert.equal(reconciliation.salaryAccountFunding, 270_348);
assert.equal(reconciliation.livingAccountFunding, 317_693);
assert.equal(reconciliation.safeAssetSweep, 1_118_502);
assert.equal(reconciliation.accountedSalary, 3_776_000);
assert.equal(reconciliation.unaccountedSalary, 0);
assert.equal(reconciliation.allocationShortfall, 0);
assert.equal(reconciliation.usesReconciledAccountFlow, true);
assert.equal(reconciliationEntries.salaryIncome.status, 'observed');
assert.equal(reconciliationEntries.youthSavings.status, 'observed');
assert.equal(reconciliationEntries.pensionSavings.status, 'inferred');
assert.equal(reconciliationEntries.livingFunding.status, 'inferred');
assert.equal(reconciliationEntries.livingFunding.amount, 588_041);
assert.equal(reconciliationEntries.safeAssetSweep.status, 'inferred');
assert.equal(reconciliationEntries.safeAssetSweep.amount, 1_118_502);

const reconciledSummary = domain.summarizeCashFlowPeriod(reconciledPeriod);
assert.deepEqual(
  {
    salary: reconciledSummary.salaryAllocation.salaryIncome,
    living: reconciledSummary.salaryAllocation.salaryAccountReserve
      + reconciledSummary.salaryAllocation.livingAccountReserve,
    note: reconciledSummary.salaryAllocation.safeAssetSweep,
  },
  { salary: 3_776_000, living: 588_041, note: 1_118_502 },
);
assert.equal(reconciledSummary.salaryAllocation.reconciliation.usesReconciledAccountFlow, true);
const reconciledGraph = domain.buildFinanceGraphFromSnapshot({
  ...emptySnapshot,
  cashFlow: reconciledSummary,
}, 'cashFlow');
assert.ok(reconciledGraph.nodes.some((node) => node.id === 'account:living-expense' && node.amount === 588_041));
assert.ok(reconciledGraph.nodes.some((node) => node.id === 'asset:krw-note' && node.amount === 1_118_502));
assert.equal(
  reconciledGraph.edges
    .filter((edge) => edge.source === 'flow:salary-allocation' && edge.amount > 0)
    .reduce((total, edge) => total + edge.amount, 0),
  3_776_000,
);

const portfolio = domain.applyPortfolioFinanceData(emptySnapshot, [
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
assert.equal(model.summary.cashFlowReviewStatus, 'confirmed');
assert.equal(model.summary.hasPlanningData, false);
assert.equal(actualSnapshot.incomes.length, 1, 'actual cash flow must create the income node without a seed');
assert.equal(actualSnapshot.incomes[0].monthlyAmount, closedSummary.totalIncome);
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
assert.equal(balancePerson.y, Math.min(...balanceAccounts.map((node) => node.y)), 'balance columns must start on the same top line');
assert.equal(balancePerson.y, Math.min(...balanceAssets.map((node) => node.y)), 'asset column must start on the same top line');
assert.deepEqual(Array.from(model.graph.columns, (column) => column.label), ['계좌', '순자산', '보유자산']);

const cashFlowGraph = domain.buildFinanceGraphFromSnapshot(actualSnapshot, 'cashFlow');
const outgoing = cashFlowGraph.edges
  .filter((edge) => edge.source === 'flow:salary-allocation' && edge.amount > 0)
  .reduce((sum, edge) => sum + edge.amount, 0);
assert.equal(outgoing, closedSummary.salaryAllocation.salaryIncome, 'salary-allocation graph must conserve salary income');
assert.ok(cashFlowGraph.nodes.some((node) => node.id === 'liability:credit-loan-interest' && node.amount === 269_457));
assert.ok(cashFlowGraph.nodes.some((node) => node.id === 'account:living-expense'
  && node.type === 'account' && node.amount === 1_000_000));
assert.ok(!cashFlowGraph.nodes.some((node) => node.id === 'account:salary-reserve'
  || node.id === 'account:living-reserve'), 'salary and living account targets must share one living-expense node');
assert.ok(cashFlowGraph.nodes.some((node) => node.id === 'liability:housing-loan-cashflow'
  && node.type === 'liability' && node.amount === 1_000_000));
assert.ok(cashFlowGraph.nodes.some((node) => node.id === 'asset:krw-note' && node.amount === 839_123));
const cashFlowTargets = cashFlowGraph.nodes.filter((node) => node.x === 790);
assert.equal(new Set(cashFlowTargets.map((node) => node.x)).size, 1, 'cash-flow outflows must share one vertical column');
assert.deepEqual(Array.from(cashFlowTargets, (node) => node.label), [
  '생활비', '청년도약계좌', '연금저축펀드', '원화 발행어음', '신용대출 이자', '전세대출',
]);
const cashPerson = cashFlowGraph.nodes.find((node) => node.type === 'person');
const cashIncome = cashFlowGraph.nodes.find((node) => node.type === 'income');
assert.equal(cashPerson.y, Math.min(...cashFlowTargets.map((node) => node.y)), 'cash-flow columns must start at the top');
assert.equal(cashPerson.y, cashIncome.y, 'income and available cash must share the top line');
assert.deepEqual(Array.from(cashFlowGraph.columns, (column) => column.label), ['월급', '배분', '월급 사용처']);
assert.equal(domain.calculateDebtRatio(actualSnapshot), model.summary.debtRatio, 'cash-flow-only housing node must not change debt ratio');

const planningSnapshot = {
  ...actualSnapshot,
  budgetBuckets: [{
    id: 'housing', label: '주거자금', monthlyAllocation: 500_000, currentBalance: 5_000_000, fixedCostAmount: 0, targetBalance: 30_000_000,
  }],
  projects: [{
    id: 'project:custom', label: '사용자 프로젝트', bucketKey: 'housing', status: 'planned', monthlyBurn: 500_000,
    targetAmount: 30_000_000, currentAmount: 5_000_000, strategicImportance: 80, urgency: 60,
    expectedReturn: 50, riskReduction: 70,
  }],
  risks: [{
    id: 'risk:custom', label: '사용자 리스크', level: 'medium', likelihood: 40, impact: 70,
    exposureAmount: 10_000_000, mitigatedByBucket: 'housing',
  }],
};
const strategyGraph = domain.buildFinanceGraphFromSnapshot(planningSnapshot, 'strategy');
const strategyBuckets = strategyGraph.nodes.filter((node) => node.type === 'budgetBucket');
const strategyTargets = strategyGraph.nodes.filter((node) => node.type === 'project' || node.type === 'risk');
assert.equal(new Set(strategyBuckets.map((node) => node.x)).size, 1, 'strategy buckets must share one vertical column');
assert.equal(new Set(strategyTargets.map((node) => node.x)).size, 1, 'projects and risks must share one target column');
assert.equal(strategyGraph.laneYs.length, planningSnapshot.budgetBuckets.length);
const strategyPerson = strategyGraph.nodes.find((node) => node.type === 'person');
assert.equal(strategyPerson.y, Math.min(...strategyBuckets.map((node) => node.y)), 'strategy columns must start at the top');
strategyTargets.forEach((target) => {
  const sourceBucket = strategyBuckets.find((bucket) => bucket.bucketKey === target.bucketKey);
  assert.ok(sourceBucket && Math.abs(sourceBucket.y - target.y) <= 32, 'strategy target must stay inside its bucket lane');
});

console.log('Personal CFO runtime checks ok');
