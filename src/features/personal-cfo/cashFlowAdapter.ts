import type {
  BudgetBucketKey,
  PersonalCfoCashFlowSummary,
  PersonalCfoCashFlowReviewStatus,
  PersonalCfoIncome,
  PersonalCfoSnapshot,
} from './types';

const SALARY_ACCOUNT_TARGET = 500_000;
const LIVING_ACCOUNT_TARGET = 500_000;
const PENSION_MONTHLY_TRANSFER = 100_000;

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

function text(value: unknown): string {
  return String(value || '').trim();
}

function absoluteAmount(transaction: CashFlowTransaction): number {
  return Math.abs(Number(transaction.amount || 0));
}

function daysFrom(date: string, startDate: string): number {
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(dateMs) || !Number.isFinite(startMs)) return Number.POSITIVE_INFINITY;
  return Math.round((dateMs - startMs) / 86_400_000);
}

function calculatePensionTransfer(period: CashFlowPeriod): number {
  const paydayTransfers = period.transactions.filter((item) => (
    item.type === '이체'
      && item.category === '내계좌이체'
      && Number(item.amount) === -PENSION_MONTHLY_TRANSFER
      && /월급통장/u.test(text(item.method))
      && daysFrom(item.date, period.startDate) >= 0
      && daysFrom(item.date, period.startDate) <= 2
  ));
  const unpairedCount = paydayTransfers.reduce((total, item) => {
    const pairedIncomeCount = period.transactions.filter((candidate) => (
      candidate.type === '이체'
        && candidate.date === item.date
        && Number(candidate.amount) === PENSION_MONTHLY_TRANSFER
    )).length;
    const sameDayOutflowCount = paydayTransfers.filter((candidate) => candidate.date === item.date).length;
    return total + Math.max(0, sameDayOutflowCount - pairedIncomeCount);
  }, 0);
  return Math.min(PENSION_MONTHLY_TRANSFER, unpairedCount * PENSION_MONTHLY_TRANSFER);
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

export function summarizeCashFlowPeriod(period: CashFlowPeriod): PersonalCfoCashFlowSummary {
  const bucketOutflows = emptyBucketOutflows();
  const incomes = period.transactions.filter((item) => item.type === '수입');
  const expenses = period.transactions.filter((item) => item.type === '지출');
  const youthSavingTransfers = period.transactions.filter((item) => (
    item.type === '이체'
      && item.category === '저축'
      && Number(item.amount) < 0
      && /청년|도약/u.test(text(item.memo))
  ));

  expenses.forEach((item) => {
    if (item.category === '상환') return;
    bucketOutflows[resolveExpenseBucket(item)] += Math.abs(Number(item.amount || 0));
  });
  const totalIncome = sum(incomes.map((item) => Number(item.amount || 0)));
  const totalExpense = sum(expenses.map((item) => Math.abs(Number(item.amount || 0))));
  const salaryIncome = sum(incomes
    .filter((item) => /급여|월급/u.test(`${text(item.category)} ${text(item.memo)}`))
    .map((item) => Number(item.amount || 0))) || totalIncome;
  const youthSavings = sum(youthSavingTransfers.map(absoluteAmount));
  const pensionSavings = calculatePensionTransfer(period);
  const savingTotal = youthSavings + pensionSavings;
  const fixedExpense = sum(expenses
    .filter((item) => item.category === '고정비')
    .map(absoluteAmount));
  const housingLoanPayment = sum(expenses
    .filter((item) => item.category === '상환'
      && /전세/u.test(`${text(item.subcategory)} ${text(item.memo)}`))
    .map(absoluteAmount));
  const creditLoanInterest = sum(expenses
    .filter((item) => item.category === '상환'
      && !/전세/u.test(`${text(item.subcategory)} ${text(item.memo)}`))
    .map(absoluteAmount));
  const dates = period.transactions.map((item) => item.date).filter(Boolean).sort();
  const freeCashFlow = totalIncome - totalExpense;
  const committedSalary = youthSavings + pensionSavings + creditLoanInterest + housingLoanPayment;
  const availableForAccounts = Math.max(0, salaryIncome - committedSalary);
  const salaryAccountReserve = Math.min(SALARY_ACCOUNT_TARGET, availableForAccounts);
  const livingAccountReserve = Math.min(
    LIVING_ACCOUNT_TARGET,
    Math.max(0, availableForAccounts - salaryAccountReserve),
  );
  const safeAssetSweep = Math.max(
    0,
    availableForAccounts - salaryAccountReserve - livingAccountReserve,
  );

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
    debtRepayment: creditLoanInterest,
    creditLoanInterest,
    housingLoanPayment,
    youthSavings,
    pensionSavings,
    savingTransfers: savingTotal,
    unallocatedCash: freeCashFlow - savingTotal,
    bucketOutflows,
    salaryAllocation: {
      salaryIncome,
      youthSavings,
      pensionSavings,
      creditLoanInterest,
      housingLoanPayment,
      salaryAccountReserve,
      livingAccountReserve,
      safeAssetSweep,
      allocationShortfall: Math.max(0, committedSalary - salaryIncome),
    },
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
