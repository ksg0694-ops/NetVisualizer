import type {
  BudgetBucketKey,
  PersonalCfoCashFlowSummary,
  PersonalCfoCashFlowReviewStatus,
  PersonalCfoIncome,
  PersonalCfoSnapshot,
} from './types';

export interface CashFlowTransaction {
  date: string;
  type: string;
  category?: string;
  subcategory?: string;
  memo?: string;
  amount: number;
  method?: string;
}

export interface CashFlowPeriod {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  closeStatus?: PersonalCfoCashFlowReviewStatus;
  transactions: CashFlowTransaction[];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function emptyBucketOutflows(): Record<BudgetBucketKey, number> {
  return {
    operating: 0,
    defense: 0,
    housing: 0,
    growth: 0,
    humanCapital: 0,
    experience: 0,
  };
}

function resolveExpenseBucket(transaction: CashFlowTransaction): BudgetBucketKey {
  const category = String(transaction.category || '').trim();
  const subcategory = String(transaction.subcategory || '').trim();
  const text = `${category} ${subcategory} ${transaction.memo || ''}`;
  if (/교육|학습|시험|강의|교재/u.test(text)) return 'humanCapital';
  if (/여행|숙박|취미|여가/u.test(text)) return 'experience';
  if (/전세|월세|주거|관리비/u.test(text)) return 'housing';
  if (/보험|의료|건강|약국|병원/u.test(text)) return 'defense';
  return 'operating';
}

function resolveSavingBucket(transaction: CashFlowTransaction): BudgetBucketKey {
  const text = `${transaction.memo || ''} ${transaction.method || ''}`;
  if (/청약|주택/u.test(text)) return 'housing';
  if (/증권|ISA|ETF|주식|투자/u.test(text)) return 'growth';
  return 'defense';
}

export function summarizeCashFlowPeriod(period: CashFlowPeriod): PersonalCfoCashFlowSummary {
  const bucketOutflows = emptyBucketOutflows();
  const incomes = period.transactions.filter((item) => item.type === '수입');
  const expenses = period.transactions.filter((item) => item.type === '지출');
  const savingTransfers = period.transactions.filter((item) => (
    item.type === '이체'
      && item.category === '저축'
      && Number(item.amount) < 0
  ));

  expenses.forEach((item) => {
    if (item.category === '상환') return;
    bucketOutflows[resolveExpenseBucket(item)] += Math.abs(Number(item.amount || 0));
  });
  savingTransfers.forEach((item) => {
    bucketOutflows[resolveSavingBucket(item)] += Math.abs(Number(item.amount || 0));
  });

  const totalIncome = sum(incomes.map((item) => Number(item.amount || 0)));
  const totalExpense = sum(expenses.map((item) => Math.abs(Number(item.amount || 0))));
  const savingTotal = sum(savingTransfers.map((item) => Math.abs(Number(item.amount || 0))));
  const fixedExpense = sum(expenses
    .filter((item) => item.category === '고정비')
    .map((item) => Math.abs(Number(item.amount || 0))));
  const debtRepayment = sum(expenses
    .filter((item) => item.category === '상환')
    .map((item) => Math.abs(Number(item.amount || 0))));
  const dates = period.transactions.map((item) => item.date).filter(Boolean).sort();
  const freeCashFlow = totalIncome - totalExpense;

  return {
    periodKey: period.key,
    periodLabel: period.label,
    startDate: period.startDate,
    endDate: period.endDate,
    latestTransactionDate: dates[dates.length - 1] || period.endDate,
    reviewStatus: period.closeStatus || 'unconfirmed',
    totalIncome,
    totalExpense,
    freeCashFlow,
    fixedExpense,
    debtRepayment,
    savingTransfers: savingTotal,
    unallocatedCash: freeCashFlow - savingTotal,
    bucketOutflows,
  };
}

export function selectLatestClosedCashFlow(
  periods: CashFlowPeriod[],
  today: string,
): PersonalCfoCashFlowSummary | undefined {
  const closed = periods
    .filter((period) => period.transactions.length > 0 && period.endDate < today)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const fallback = periods
    .filter((period) => period.transactions.length > 0)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const selected = closed[closed.length - 1] || fallback[fallback.length - 1];
  return selected ? summarizeCashFlowPeriod(selected) : undefined;
}

export function applyCashFlowData(
  snapshot: PersonalCfoSnapshot,
  periods: CashFlowPeriod[],
  today: string,
): PersonalCfoSnapshot {
  const cashFlow = selectLatestClosedCashFlow(periods, today);
  if (!cashFlow) return snapshot;
  const primaryIncome = snapshot.incomes[0];
  const actualIncome: PersonalCfoIncome = primaryIncome
    ? { ...primaryIncome, label: `${cashFlow.periodLabel} 수입`, monthlyAmount: cashFlow.totalIncome }
    : {
      id: `income:cashflow:${cashFlow.periodKey}`,
      label: `${cashFlow.periodLabel} 수입`,
      monthlyAmount: cashFlow.totalIncome,
      stabilityScore: 100,
      sourceRefs: [{
        sourceId: 'source:cashflow',
        entityType: 'cashFlowPeriod',
        entityId: cashFlow.periodKey,
        field: 'totalIncome',
      }],
    };
  return {
    ...snapshot,
    cashFlow,
    incomes: [actualIncome, ...snapshot.incomes.slice(1)],
  };
}
