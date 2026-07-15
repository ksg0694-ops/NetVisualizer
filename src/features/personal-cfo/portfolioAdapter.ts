import type {
  BudgetBucketKey,
  PersonalCfoAccount,
  PersonalCfoAsset,
  PersonalCfoLiability,
  PersonalCfoSnapshot,
  PersonalCfoSourceRef,
} from './types';

export interface PortfolioFinanceItem {
  id?: string;
  groupName: string;
  name: string;
  amount: number;
  maturity?: string;
  accountName?: string;
  assetType?: string;
  instrumentType?: string;
}

export interface PortfolioFinanceOverlay {
  snapshot: PersonalCfoSnapshot;
  accountItemCount: number;
  assetItemCount: number;
  liabilityItemCount: number;
  hasPortfolioData: boolean;
}

const accountMeta: Record<BudgetBucketKey, { label: string; liquidityScore: number }> = {
  operating: { label: '생활계좌', liquidityScore: 95 },
  defense: { label: '안전자산 계좌', liquidityScore: 70 },
  housing: { label: '청약통장', liquidityScore: 60 },
  growth: { label: '증권계좌 현금', liquidityScore: 85 },
  humanCapital: { label: '인적자본 계좌', liquidityScore: 80 },
  experience: { label: '경험자금 계좌', liquidityScore: 80 },
};

function toSourceRefs(items: PortfolioFinanceItem[]): PersonalCfoSourceRef[] {
  return items
    .filter((item) => item.id)
    .map((item) => ({
      sourceId: 'source:portfolio',
      entityType: 'portfolio',
      entityId: String(item.id),
      field: 'amount',
    }));
}

function getAccountBucket(item: PortfolioFinanceItem): BudgetBucketKey {
  const group = item.groupName.toLowerCase();
  const text = `${item.groupName} ${item.name} ${item.accountName ?? ''} ${item.instrumentType ?? ''}`.toLowerCase();
  if (/청약|주택드림/.test(text)) return 'housing';
  if (/투자/.test(group) || /증권|isa|brokerage/.test(text)) return 'growth';
  if (/안전|예금|적금|발행어음|ima|도약|rp|cma|채권/.test(text)) return 'defense';
  return 'operating';
}

function aggregateAccounts(items: PortfolioFinanceItem[]): PersonalCfoAccount[] {
  const grouped = new Map<BudgetBucketKey, PortfolioFinanceItem[]>();
  items.forEach((item) => {
    const bucket = getAccountBucket(item);
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), item]);
  });

  return (['operating', 'defense', 'housing', 'growth'] as BudgetBucketKey[])
    .filter((bucket) => grouped.has(bucket))
    .map((bucket) => {
      const rows = grouped.get(bucket) ?? [];
      const meta = accountMeta[bucket];
      return {
        id: `account:portfolio:${bucket}`,
        label: `${meta.label} ${rows.length}개`,
        balance: rows.reduce((total, item) => total + Math.max(0, Number(item.amount || 0)), 0),
        liquidityScore: meta.liquidityScore,
        bucketKey: bucket,
        sourceRefs: toSourceRefs(rows),
      };
    });
}

function normalizeLiabilityLabel(label: string): string {
  return label.replace(/^가계일반자금대출\(일시상환\)-/u, '') || label;
}

function mapLiabilities(items: PortfolioFinanceItem[]): PersonalCfoLiability[] {
  return items.map((item, index) => {
    const outstandingBalance = Math.abs(Number(item.amount || 0));
    return {
      id: `liability:portfolio:${item.id || index + 1}`,
      label: normalizeLiabilityLabel(item.name),
      outstandingBalance,
      monthlyPayment: 0,
      interestRate: 0,
      riskScore: Math.round(Math.min(80, 40 + outstandingBalance / 2_000_000)),
      sourceRefs: toSourceRefs([item]),
    };
  });
}

function getAssetGroup(item: PortfolioFinanceItem): {
  key: string;
  label: string;
  bucketKey: BudgetBucketKey;
  volatilityScore: number;
} {
  const text = `${item.groupName} ${item.name} ${item.assetType ?? ''} ${item.instrumentType ?? ''}`.toLowerCase();
  if (/연금|퇴직|pension/u.test(text)) {
    return { key: 'pension', label: '연금·퇴직자산', bucketKey: 'growth', volatilityScore: 30 };
  }
  if (/주식|etf|펀드|채권|stock|equity|fund/u.test(text)) {
    return { key: 'investment', label: '투자자산', bucketKey: 'growth', volatilityScore: 52 };
  }
  if (/전세|보증금|부동산|housing/u.test(text)) {
    return { key: 'housing', label: '주거자산', bucketKey: 'housing', volatilityScore: 18 };
  }
  return { key: 'other', label: '기타 보유자산', bucketKey: 'defense', volatilityScore: 24 };
}

function aggregateAssets(items: PortfolioFinanceItem[]): PersonalCfoAsset[] {
  const grouped = new Map<string, { meta: ReturnType<typeof getAssetGroup>; items: PortfolioFinanceItem[] }>();
  items.forEach((item) => {
    const meta = getAssetGroup(item);
    const entry = grouped.get(meta.key) ?? { meta, items: [] };
    entry.items.push(item);
    grouped.set(meta.key, entry);
  });
  return Array.from(grouped.entries()).map(([key, entry]) => ({
    id: `asset:portfolio:${key}`,
    label: `${entry.meta.label} ${entry.items.length}개`,
    marketValue: entry.items.reduce((total, item) => total + Math.max(0, Number(item.amount || 0)), 0),
    bucketKey: entry.meta.bucketKey,
    volatilityScore: entry.meta.volatilityScore,
    sourceRefs: toSourceRefs(entry.items),
  }));
}

export function applyPortfolioFinanceData(
  snapshot: PersonalCfoSnapshot,
  items: PortfolioFinanceItem[],
): PortfolioFinanceOverlay {
  if (items.length === 0) {
    return { snapshot, accountItemCount: 0, assetItemCount: 0, liabilityItemCount: 0, hasPortfolioData: false };
  }

  const liabilityItems = items.filter((item) => item.assetType === 'debt' || Number(item.amount) < 0);
  const accountItems = items.filter((item) => (
    !liabilityItems.includes(item)
      && (item.assetType === 'account' || /청약통장/u.test(item.name))
  ));
  const assetItems = items.filter((item) => !liabilityItems.includes(item) && !accountItems.includes(item));

  return {
    snapshot: {
      ...snapshot,
      accounts: aggregateAccounts(accountItems),
      assets: aggregateAssets(assetItems),
      liabilities: mapLiabilities(liabilityItems),
    },
    accountItemCount: accountItems.length,
    assetItemCount: assetItems.length,
    liabilityItemCount: liabilityItems.length,
    hasPortfolioData: true,
  };
}
