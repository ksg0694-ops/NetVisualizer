import type {
  PersonalCfoInternalTransferMatch,
  PersonalCfoSalaryFlowEvidenceStatus,
  PersonalCfoSalaryFlowLedgerEntry,
  PersonalCfoSalaryFlowReconciliation,
} from './types';

const DEFAULT_SALARY_ACCOUNT_TARGET = 500_000;
const DEFAULT_LIVING_ACCOUNT_TARGET = 500_000;
const DEFAULT_PENSION_MONTHLY_TRANSFER = 100_000;
const PAYDAY_TRANSFER_WINDOW_DAYS = 3;
const MAX_PAIR_MINUTES = 15;

export interface SalaryFlowSourceTransaction {
  id?: string;
  date: string;
  time?: string;
  type: string;
  category?: string;
  subcategory?: string;
  memo?: string;
  amount: number;
  method?: string;
}

export interface SalaryFlowSourcePeriod {
  key: string;
  startDate: string;
  transactions: SalaryFlowSourceTransaction[];
}

export interface SalaryFlowReconciliationOptions {
  salaryAccountTarget?: number;
  livingAccountTarget?: number;
  pensionMonthlyTransfer?: number;
  fallbackSalaryIncome?: number;
}

interface IndexedTransaction {
  transaction: SalaryFlowSourceTransaction;
  index: number;
  key: string;
  dateKey: string;
  minuteOfDay?: number;
}

interface TransferPairResult {
  matches: PersonalCfoInternalTransferMatch[];
  matchedIndexes: Set<number>;
}

function value(value: unknown): string {
  return String(value || '').trim();
}

function absoluteAmount(transaction: SalaryFlowSourceTransaction): number {
  return Math.abs(Number(transaction.amount || 0));
}

function sum(values: number[]): number {
  return values.reduce((total, current) => total + Number(current || 0), 0);
}

function dateKey(input: string): string {
  return value(input).replace(/[./]/g, '-').slice(0, 10);
}

function transactionKey(transaction: SalaryFlowSourceTransaction, index: number): string {
  return value(transaction.id) || `${dateKey(transaction.date)}:${value(transaction.time) || index}:${index}`;
}

function minuteOfDay(transaction: SalaryFlowSourceTransaction): number | undefined {
  const timeText = value(transaction.time)
    || value(transaction.date).split(/[T ]/)[1]
    || '';
  const [hour, minute] = timeText.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
  return (hour * 60) + minute;
}

function daysFrom(date: string, startDate: string): number {
  const dateMs = Date.parse(`${dateKey(date)}T00:00:00Z`);
  const startMs = Date.parse(`${dateKey(startDate)}T00:00:00Z`);
  if (!Number.isFinite(dateMs) || !Number.isFinite(startMs)) return Number.POSITIVE_INFINITY;
  return Math.round((dateMs - startMs) / 86_400_000);
}

function isInPaydayWindow(transaction: SalaryFlowSourceTransaction, startDate: string): boolean {
  const distance = daysFrom(transaction.date, startDate);
  return distance >= 0 && distance <= PAYDAY_TRANSFER_WINDOW_DAYS;
}

function isPairableTransfer(transaction: SalaryFlowSourceTransaction): boolean {
  return transaction.type === '이체'
    && /내계좌이체|저축/u.test(value(transaction.category));
}

function isSalaryAccount(method: unknown): boolean {
  return /월급\s*통장/u.test(value(method));
}

function isLivingAccount(method: unknown): boolean {
  return /생활비\s*통장/u.test(value(method));
}

function evidenceStatus(amount: number, inferred = false): PersonalCfoSalaryFlowEvidenceStatus {
  if (amount <= 0) return 'missing';
  return inferred ? 'inferred' : 'observed';
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildIndexedTransactions(period: SalaryFlowSourcePeriod): IndexedTransaction[] {
  return period.transactions.map((transaction, index) => ({
    transaction,
    index,
    key: transactionKey(transaction, index),
    dateKey: dateKey(transaction.date),
    minuteOfDay: minuteOfDay(transaction),
  }));
}

function pairInternalTransfers(indexed: IndexedTransaction[], startDate: string): TransferPairResult {
  const pairable = indexed.filter(({ transaction }) => (
    isPairableTransfer(transaction) && isInPaydayWindow(transaction, startDate)
  ));
  const outflows = pairable.filter(({ transaction }) => Number(transaction.amount) < 0);
  const inflows = pairable.filter(({ transaction }) => Number(transaction.amount) > 0);
  const matchedIndexes = new Set<number>();
  const matches: PersonalCfoInternalTransferMatch[] = [];

  inflows.forEach((inflow) => {
    const candidates = outflows
      .filter((outflow) => (
        !matchedIndexes.has(outflow.index)
        && outflow.dateKey === inflow.dateKey
        && absoluteAmount(outflow.transaction) === absoluteAmount(inflow.transaction)
      ))
      .map((outflow) => {
        const hasTimes = outflow.minuteOfDay !== undefined && inflow.minuteOfDay !== undefined;
        const minuteDifference = hasTimes
          ? Math.abs(Number(outflow.minuteOfDay) - Number(inflow.minuteOfDay))
          : 0;
        return {
          outflow,
          hasTimes,
          minuteDifference,
          score: (minuteDifference * 1_000) + Math.abs(outflow.index - inflow.index),
        };
      })
      .filter(({ hasTimes, minuteDifference }) => !hasTimes || minuteDifference <= MAX_PAIR_MINUTES)
      .sort((a, b) => a.score - b.score);
    const selected = candidates[0]?.outflow;
    if (!selected) return;

    matchedIndexes.add(selected.index);
    matchedIndexes.add(inflow.index);
    matches.push({
      date: inflow.dateKey,
      amount: absoluteAmount(inflow.transaction),
      fromAccount: value(selected.transaction.method),
      toAccount: value(inflow.transaction.method),
      outflowKey: selected.key,
      inflowKey: inflow.key,
    });
  });

  return { matches, matchedIndexes };
}

function makeEntry(
  key: PersonalCfoSalaryFlowLedgerEntry['key'],
  label: string,
  amount: number,
  status: PersonalCfoSalaryFlowEvidenceStatus,
  transactionKeys: string[],
): PersonalCfoSalaryFlowLedgerEntry {
  return { key, label, amount, status, transactionKeys: unique(transactionKeys) };
}

export function reconcileSalaryFlowPeriod(
  period: SalaryFlowSourcePeriod,
  options: SalaryFlowReconciliationOptions = {},
): PersonalCfoSalaryFlowReconciliation {
  const salaryAccountTarget = Math.max(0, options.salaryAccountTarget ?? DEFAULT_SALARY_ACCOUNT_TARGET);
  const livingAccountTarget = Math.max(0, options.livingAccountTarget ?? DEFAULT_LIVING_ACCOUNT_TARGET);
  const pensionMonthlyTransfer = Math.max(0, options.pensionMonthlyTransfer ?? DEFAULT_PENSION_MONTHLY_TRANSFER);
  const indexed = buildIndexedTransactions(period);
  const { matches, matchedIndexes } = pairInternalTransfers(indexed, period.startDate);

  const salaryRows = indexed.filter(({ transaction }) => (
    transaction.type === '수입'
    && /급여|월급/u.test(`${value(transaction.category)} ${value(transaction.memo)}`)
  ));
  const salaryIncome = sum(salaryRows.map(({ transaction }) => Number(transaction.amount || 0)))
    || Math.max(0, options.fallbackSalaryIncome || 0);
  const youthRows = indexed.filter(({ transaction }) => (
    transaction.type === '이체'
    && transaction.category === '저축'
    && Number(transaction.amount) < 0
    && /청년|도약/u.test(value(transaction.memo))
  ));
  const youthSavings = sum(youthRows.map(({ transaction }) => absoluteAmount(transaction)));
  const creditRows = indexed.filter(({ transaction }) => (
    transaction.type === '지출'
    && transaction.category === '상환'
    && !/전세/u.test(`${value(transaction.subcategory)} ${value(transaction.memo)}`)
  ));
  const creditLoanInterest = sum(creditRows.map(({ transaction }) => absoluteAmount(transaction)));
  const housingRows = indexed.filter(({ transaction }) => (
    transaction.type === '지출'
    && transaction.category === '상환'
    && /전세/u.test(`${value(transaction.subcategory)} ${value(transaction.memo)}`)
  ));
  const housingLoanPayment = sum(housingRows.map(({ transaction }) => absoluteAmount(transaction)));

  const pensionCandidates = indexed.filter(({ transaction, index }) => (
    !matchedIndexes.has(index)
    && transaction.type === '이체'
    && transaction.category === '내계좌이체'
    && Number(transaction.amount) === -pensionMonthlyTransfer
    && isSalaryAccount(transaction.method)
    && daysFrom(transaction.date, period.startDate) >= 0
    && daysFrom(transaction.date, period.startDate) <= 2
  ));
  const pensionEvidence = pensionCandidates.slice(0, pensionMonthlyTransfer > 0 ? 1 : 0);
  const pensionIndexes = new Set(pensionEvidence.map(({ index }) => index));
  const pensionSavings = pensionEvidence.length > 0 ? pensionMonthlyTransfer : 0;

  const livingMatches = matches.filter((match) => (
    (isSalaryAccount(match.fromAccount) && isLivingAccount(match.toAccount))
    || (isLivingAccount(match.fromAccount) && isSalaryAccount(match.toAccount))
  ));
  const livingAccountNetFunding = sum(livingMatches.map((match) => (
    isSalaryAccount(match.fromAccount) ? match.amount : -match.amount
  )));
  const livingAccountFundingFromSalary = Math.max(0, livingAccountNetFunding);

  const unmatchedSalaryTransfers = indexed.filter(({ transaction, index }) => (
    !matchedIndexes.has(index)
    && !pensionIndexes.has(index)
    && isInPaydayWindow(transaction, period.startDate)
    && transaction.type === '이체'
    && transaction.category === '내계좌이체'
    && isSalaryAccount(transaction.method)
    && Number(transaction.amount) !== 0
  ));
  const inferredSafeAssetSweep = Math.max(0, sum(unmatchedSalaryTransfers.map(({ transaction }) => (
    Number(transaction.amount) < 0 ? absoluteAmount(transaction) : -absoluteAmount(transaction)
  ))));
  const hasSafeAssetEvidence = inferredSafeAssetSweep > 0 && unmatchedSalaryTransfers.length > 0;
  const committedSalary = youthSavings + pensionSavings + creditLoanInterest + housingLoanPayment;
  const availableForAccounts = Math.max(0, salaryIncome - committedSalary);

  let salaryAccountFunding: number;
  let livingAccountFunding: number;
  let safeAssetSweep: number;
  if (hasSafeAssetEvidence) {
    livingAccountFunding = livingAccountFundingFromSalary;
    safeAssetSweep = inferredSafeAssetSweep;
    salaryAccountFunding = Math.max(0, salaryIncome - committedSalary - livingAccountFunding - safeAssetSweep);
  } else {
    salaryAccountFunding = Math.min(salaryAccountTarget, availableForAccounts);
    livingAccountFunding = Math.min(
      livingAccountTarget,
      Math.max(0, availableForAccounts - salaryAccountFunding),
    );
    safeAssetSweep = Math.max(0, availableForAccounts - salaryAccountFunding - livingAccountFunding);
  }

  const livingFunding = salaryAccountFunding + livingAccountFunding;
  const accountedSalary = committedSalary + livingFunding + safeAssetSweep;
  const allocationShortfall = Math.max(0, accountedSalary - salaryIncome);
  const unaccountedSalary = Math.max(0, salaryIncome - accountedSalary);
  const livingKeys = livingMatches.flatMap((match) => [match.outflowKey, match.inflowKey]);
  const accountFlowStatus: PersonalCfoSalaryFlowEvidenceStatus = hasSafeAssetEvidence ? 'inferred' : 'target';
  const salaryStatus: PersonalCfoSalaryFlowEvidenceStatus = salaryRows.length > 0
    ? 'observed'
    : (salaryIncome > 0 ? 'inferred' : 'missing');

  return {
    entries: [
      makeEntry('salaryIncome', '월급', salaryIncome, salaryStatus, salaryRows.map(({ key }) => key)),
      makeEntry('youthSavings', '청년도약계좌', youthSavings, evidenceStatus(youthSavings), youthRows.map(({ key }) => key)),
      makeEntry('pensionSavings', '연금저축펀드', pensionSavings, evidenceStatus(pensionSavings, true), pensionEvidence.map(({ key }) => key)),
      makeEntry('creditLoanInterest', '신용대출 이자', creditLoanInterest, evidenceStatus(creditLoanInterest), creditRows.map(({ key }) => key)),
      makeEntry('housingLoanPayment', '전세대출', housingLoanPayment, evidenceStatus(housingLoanPayment), housingRows.map(({ key }) => key)),
      makeEntry('livingFunding', '생활비', livingFunding, accountFlowStatus, livingKeys),
      makeEntry('safeAssetSweep', '원화 발행어음', safeAssetSweep, accountFlowStatus, unmatchedSalaryTransfers.map(({ key }) => key)),
    ],
    internalTransfers: matches,
    livingAccountNetFunding,
    salaryAccountFunding,
    livingAccountFunding,
    safeAssetSweep,
    accountedSalary,
    unaccountedSalary,
    allocationShortfall,
    usesReconciledAccountFlow: hasSafeAssetEvidence,
  };
}
