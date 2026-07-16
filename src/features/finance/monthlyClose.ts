export type FinanceMonthlyCloseStatus = 'open' | 'closed';

export interface MonthlyCloseTransaction {
  id?: string;
  date: string;
  time?: string;
  type: string;
  category?: string;
  cat?: string;
  subcategory?: string;
  subcat?: string;
  memo?: string;
  amount: number;
  method?: string;
}

export interface FinanceMonthlyCloseClassification {
  transactionKey: string;
  type: string;
  category: string;
  subcategory: string;
  updatedAt: string;
}

export interface FinanceMonthlyCloseRecord {
  schemaVersion: 1;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: FinanceMonthlyCloseStatus;
  classifications: Record<string, FinanceMonthlyCloseClassification>;
  transactionCount: number;
  sourceRevision: string;
  reviewedAt: string;
  closedAt: string;
  updatedAt: string;
}

export interface FinanceMonthlyCloseSummary {
  totalCount: number;
  reviewedCount: number;
  unclassifiedCount: number;
  overrideCount: number;
  sourceRevision: string;
  isStale: boolean;
  canClose: boolean;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function parseClassifications(value: unknown): Record<string, FinanceMonthlyCloseClassification> {
  let source = value;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch (_error) {
      source = {};
    }
  }
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  return Object.entries(source as Record<string, unknown>).reduce<Record<string, FinanceMonthlyCloseClassification>>(
    (result, [key, raw]) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
      const item = raw as Record<string, unknown>;
      const transactionKey = text(item.transactionKey || item.transaction_key || key);
      if (!transactionKey) return result;
      result[transactionKey] = {
        transactionKey,
        type: text(item.type),
        category: text(item.category) || '미분류',
        subcategory: text(item.subcategory) || '미분류',
        updatedAt: text(item.updatedAt || item.updated_at),
      };
      return result;
    },
    {},
  );
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

function getCategory(transaction: MonthlyCloseTransaction): string {
  return text(transaction.category ?? transaction.cat) || '미분류';
}

function getSubcategory(transaction: MonthlyCloseTransaction): string {
  return text(transaction.subcategory ?? transaction.subcat) || '미분류';
}

export function createTransactionKey(transaction: MonthlyCloseTransaction): string {
  const id = text(transaction.id);
  if (id) return `id:${id}`;
  const fingerprint = [
    transaction.date,
    transaction.time,
    transaction.type,
    getCategory(transaction),
    getSubcategory(transaction),
    transaction.memo,
    Math.round(Number(transaction.amount || 0)),
    transaction.method,
  ].map(text).join('|');
  return `legacy:${hash(fingerprint)}`;
}

export function createMonthlyCloseSourceRevision(transactions: MonthlyCloseTransaction[]): string {
  const source = transactions
    .map((transaction) => [
      createTransactionKey(transaction),
      transaction.date,
      transaction.time,
      transaction.type,
      getCategory(transaction),
      getSubcategory(transaction),
      transaction.memo,
      Number(transaction.amount || 0),
      transaction.method,
    ].map(text).join('|'))
    .sort()
    .join('|');
  return `${transactions.length}:${hash(source)}`;
}

export function createFinanceMonthlyCloseRecord(
  periodKey: string,
  periodStart: string,
  periodEnd: string,
  updatedAt = '',
): FinanceMonthlyCloseRecord {
  return {
    schemaVersion: 1,
    periodKey: text(periodKey),
    periodStart: text(periodStart),
    periodEnd: text(periodEnd),
    status: 'open',
    classifications: {},
    transactionCount: 0,
    sourceRevision: '',
    reviewedAt: '',
    closedAt: '',
    updatedAt: text(updatedAt),
  };
}

export function normalizeFinanceMonthlyCloseRecord(
  value: unknown,
  fallback: Partial<FinanceMonthlyCloseRecord> = {},
): FinanceMonthlyCloseRecord {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const statusValue = text(source.status || fallback.status);
  return {
    schemaVersion: 1,
    periodKey: text(source.periodKey || source.period_key || fallback.periodKey),
    periodStart: text(source.periodStart || source.period_start || fallback.periodStart),
    periodEnd: text(source.periodEnd || source.period_end || fallback.periodEnd),
    status: statusValue === 'closed' ? 'closed' : 'open',
    classifications: parseClassifications(source.classifications || fallback.classifications),
    transactionCount: Math.max(0, Math.trunc(Number(source.transactionCount ?? source.transaction_count ?? fallback.transactionCount ?? 0))),
    sourceRevision: text(source.sourceRevision || source.source_revision || fallback.sourceRevision),
    reviewedAt: text(source.reviewedAt || source.reviewed_at || fallback.reviewedAt),
    closedAt: text(source.closedAt || source.closed_at || fallback.closedAt),
    updatedAt: text(source.updatedAt || source.updated_at || fallback.updatedAt),
  };
}

export function applyFinanceMonthlyClose<T extends MonthlyCloseTransaction>(
  transactions: T[],
  record?: FinanceMonthlyCloseRecord | null,
): T[] {
  if (!record) return transactions.map((transaction) => ({ ...transaction }));
  return transactions.map((transaction) => {
    const override = record.classifications[createTransactionKey(transaction)];
    if (!override) return { ...transaction };
    return {
      ...transaction,
      type: override.type,
      category: override.category,
      cat: override.category,
      subcategory: override.subcategory,
      subcat: override.subcategory,
    };
  });
}

function isUnclassified(transaction: MonthlyCloseTransaction): boolean {
  const category = getCategory(transaction);
  return !text(transaction.type) || !category || category === '미분류';
}

export function summarizeFinanceMonthlyClose(
  transactions: MonthlyCloseTransaction[],
  record?: FinanceMonthlyCloseRecord | null,
): FinanceMonthlyCloseSummary {
  const normalized = record ? normalizeFinanceMonthlyCloseRecord(record) : null;
  const effective = applyFinanceMonthlyClose(transactions, normalized);
  const sourceRevision = createMonthlyCloseSourceRevision(transactions);
  const unclassifiedCount = effective.filter(isUnclassified).length;
  const overrideCount = normalized ? Object.keys(normalized.classifications).length : 0;
  const isStale = normalized?.status === 'closed'
    && normalized.sourceRevision !== sourceRevision;
  return {
    totalCount: transactions.length,
    reviewedCount: Math.max(0, transactions.length - unclassifiedCount),
    unclassifiedCount,
    overrideCount,
    sourceRevision,
    isStale,
    canClose: transactions.length > 0 && unclassifiedCount === 0,
  };
}

export function updateFinanceMonthlyCloseClassification(
  record: FinanceMonthlyCloseRecord,
  transaction: MonthlyCloseTransaction,
  classification: Pick<FinanceMonthlyCloseClassification, 'type' | 'category' | 'subcategory'>,
  updatedAt: string,
): FinanceMonthlyCloseRecord {
  const normalized = normalizeFinanceMonthlyCloseRecord(record);
  if (normalized.status === 'closed') throw new Error('CLOSED_MONTH_CANNOT_BE_EDITED');
  const transactionKey = createTransactionKey(transaction);
  const nextType = text(classification.type) || text(transaction.type);
  const nextCategory = text(classification.category) || '미분류';
  const nextSubcategory = text(classification.subcategory) || '미분류';
  const matchesSource = nextType === text(transaction.type)
    && nextCategory === getCategory(transaction)
    && nextSubcategory === getSubcategory(transaction);
  const classifications = { ...normalized.classifications };
  if (matchesSource) {
    delete classifications[transactionKey];
  } else {
    classifications[transactionKey] = {
      transactionKey,
      type: nextType,
      category: nextCategory,
      subcategory: nextSubcategory,
      updatedAt: text(updatedAt),
    };
  }
  return {
    ...normalized,
    classifications,
    reviewedAt: text(updatedAt),
    updatedAt: text(updatedAt),
  };
}

export function closeFinanceMonth(
  record: FinanceMonthlyCloseRecord,
  transactions: MonthlyCloseTransaction[],
  closedAt: string,
): FinanceMonthlyCloseRecord {
  const normalized = normalizeFinanceMonthlyCloseRecord(record);
  const summary = summarizeFinanceMonthlyClose(transactions, normalized);
  if (!summary.canClose) throw new Error('UNCLASSIFIED_TRANSACTIONS_REMAIN');
  return {
    ...normalized,
    status: 'closed',
    transactionCount: summary.totalCount,
    sourceRevision: summary.sourceRevision,
    reviewedAt: normalized.reviewedAt || text(closedAt),
    closedAt: text(closedAt),
    updatedAt: text(closedAt),
  };
}

export function reopenFinanceMonth(
  record: FinanceMonthlyCloseRecord,
  updatedAt: string,
): FinanceMonthlyCloseRecord {
  return {
    ...normalizeFinanceMonthlyCloseRecord(record),
    status: 'open',
    closedAt: '',
    updatedAt: text(updatedAt),
  };
}

export function canApplyConfirmedMonthlyClose(
  transactions: MonthlyCloseTransaction[],
  record?: FinanceMonthlyCloseRecord | null,
): boolean {
  if (!record || record.status !== 'closed') return false;
  return !summarizeFinanceMonthlyClose(transactions, record).isStale;
}
