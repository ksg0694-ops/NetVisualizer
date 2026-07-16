import type {
  PersonalCfoBudgetBucket,
  PersonalCfoProject,
  PersonalCfoRisk,
  PersonalCfoSnapshot,
} from './types';

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

export function calculateTotalAssets(snapshot: PersonalCfoSnapshot): number {
  return sum(snapshot.accounts.map((account) => account.balance))
    + sum(snapshot.assets.map((asset) => asset.marketValue));
}

export function calculateTotalLiabilities(snapshot: PersonalCfoSnapshot): number {
  return sum(snapshot.liabilities.map((liability) => liability.outstandingBalance));
}

export function calculateNetWorth(snapshot: PersonalCfoSnapshot): number {
  return calculateTotalAssets(snapshot) - calculateTotalLiabilities(snapshot);
}

export function calculateMonthlyFreeCashFlow(snapshot: PersonalCfoSnapshot): number {
  if (snapshot.cashFlow) return snapshot.cashFlow.freeCashFlow;
  const income = sum(snapshot.incomes.map((item) => item.monthlyAmount));
  const allocations = sum(snapshot.budgetBuckets.map((bucket) => bucket.monthlyAllocation));
  const debtPayments = sum(snapshot.liabilities.map((liability) => liability.monthlyPayment));
  return income - allocations - debtPayments;
}

export function calculateSavingsRate(snapshot: PersonalCfoSnapshot): number {
  const income = sum(snapshot.incomes.map((item) => item.monthlyAmount));
  if (income <= 0) return 0;
  const savingBuckets = snapshot.budgetBuckets.filter((bucket) =>
    ['defense', 'housing', 'growth', 'humanCapital'].includes(bucket.id),
  );
  return clamp((sum(savingBuckets.map((bucket) => bucket.monthlyAllocation)) / income) * 100);
}

export function calculateFixedCostRatio(snapshot: PersonalCfoSnapshot): number {
  if (snapshot.cashFlow) {
    if (snapshot.cashFlow.totalIncome <= 0) return 0;
    return clamp(((snapshot.cashFlow.fixedExpense + snapshot.cashFlow.debtRepayment) / snapshot.cashFlow.totalIncome) * 100);
  }
  const income = sum(snapshot.incomes.map((item) => item.monthlyAmount));
  if (income <= 0) return 0;
  const fixedCosts = sum(snapshot.budgetBuckets.map((bucket) => bucket.fixedCostAmount))
    + sum(snapshot.liabilities.map((liability) => liability.monthlyPayment));
  return clamp((fixedCosts / income) * 100);
}

export function calculateDebtRatio(snapshot: PersonalCfoSnapshot): number {
  const assets = calculateTotalAssets(snapshot);
  if (assets <= 0) return 0;
  return clamp((calculateTotalLiabilities(snapshot) / assets) * 100);
}

export function calculateEmergencyCoverageMonths(snapshot: PersonalCfoSnapshot): number {
  const defenseBalance = sum(
    snapshot.budgetBuckets
      .filter((bucket) => bucket.id === 'defense')
      .map((bucket) => bucket.currentBalance),
  );
  const essentialMonthlyCost = sum(
    snapshot.budgetBuckets
      .filter((bucket) => ['operating', 'defense', 'housing'].includes(bucket.id))
      .map((bucket) => bucket.fixedCostAmount),
  ) + sum(snapshot.liabilities.map((liability) => liability.monthlyPayment));
  if (essentialMonthlyCost <= 0) return 0;
  return defenseBalance / essentialMonthlyCost;
}

export function calculateProjectBurnRate(snapshot: PersonalCfoSnapshot): number {
  return sum(
    snapshot.projects
      .filter((project) => project.status === 'active')
      .map((project) => project.monthlyBurn),
  );
}

export function calculateRiskScore(risk: PersonalCfoRisk): number {
  const baseScore = (risk.likelihood * 0.45) + (risk.impact * 0.55);
  const exposureBoost = Math.min(20, Math.log10(Math.max(1, risk.exposureAmount)) * 2);
  return Math.round(clamp(baseScore + exposureBoost));
}

export function calculateProjectPriorityScore(project: PersonalCfoProject): number {
  const fundingProgress = project.targetAmount > 0
    ? clamp((project.currentAmount / project.targetAmount) * 100)
    : 0;
  const burnPenalty = Math.min(18, project.monthlyBurn / 60_000);
  const statusPenalty = project.status === 'completed' ? 35 : project.status === 'paused' ? 20 : 0;
  return Math.round(clamp(
    (project.strategicImportance * 0.32)
      + (project.urgency * 0.24)
      + (project.expectedReturn * 0.20)
      + (project.riskReduction * 0.14)
      + (fundingProgress * 0.10)
      - burnPenalty
      - statusPenalty,
  ));
}

export function getBucketFundingProgress(bucket: PersonalCfoBudgetBucket): number {
  if (!bucket.targetBalance || bucket.targetBalance <= 0) return 0;
  return clamp((bucket.currentBalance / bucket.targetBalance) * 100);
}

export function buildPersonalCfoKpiSummary(snapshot: PersonalCfoSnapshot) {
  return {
    totalAssets: calculateTotalAssets(snapshot),
    totalLiabilities: calculateTotalLiabilities(snapshot),
    netWorth: calculateNetWorth(snapshot),
    monthlyFreeCashFlow: calculateMonthlyFreeCashFlow(snapshot),
    savingsRate: calculateSavingsRate(snapshot),
    fixedCostRatio: calculateFixedCostRatio(snapshot),
    debtRatio: calculateDebtRatio(snapshot),
    emergencyCoverageMonths: calculateEmergencyCoverageMonths(snapshot),
    projectBurnRate: calculateProjectBurnRate(snapshot),
    cashFlowReviewStatus: snapshot.cashFlow?.reviewStatus || 'unconfirmed',
  };
}
