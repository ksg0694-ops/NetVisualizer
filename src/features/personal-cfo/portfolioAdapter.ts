import type {
  BudgetBucketKey,
  PersonalCfoAccount,
  PersonalCfoAccountType,
  PersonalCfoAsset,
  PersonalCfoAssetClass,
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

export interface PortfolioPositionAxes {
  accountId?: string;
  accountLabel?: string;
  assetClass: PersonalCfoAssetClass;
  purposeKey: BudgetBucketKey;
}

export interface PortfolioFinanceOverlay {
  snapshot: PersonalCfoSnapshot;
  accountItemCount: number;
  assetItemCount: number;
  liabilityItemCount: number;
  hasPortfolioData: boolean;
}

interface ClassifiedHolding extends PortfolioPositionAxes {
  item: PortfolioFinanceItem;
  accountType?: PersonalCfoAccountType;
}

const assetClassMeta: Record<PersonalCfoAssetClass, {
  label: string;
  liquidityScore: number;
  volatilityScore: number;
}> = {
  cash: { label: '현금', liquidityScore: 98, volatilityScore: 2 },
  deposit: { label: '예·적금', liquidityScore: 70, volatilityScore: 4 },
  fixedIncome: { label: '채권·발행어음', liquidityScore: 72, volatilityScore: 14 },
  equity: { label: '주식·ETF', liquidityScore: 82, volatilityScore: 58 },
  fund: { label: '펀드', liquidityScore: 72, volatilityScore: 44 },
  pension: { label: '연금자산', liquidityScore: 24, volatilityScore: 32 },
  realEstate: { label: '주거자산', liquidityScore: 12, volatilityScore: 18 },
  other: { label: '기타자산', liquidityScore: 45, volatilityScore: 24 },
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

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}:${(hash >>> 0).toString(36)}`;
}

function getItemText(item: PortfolioFinanceItem): string {
  return `${item.groupName} ${item.name} ${item.accountName ?? ''} ${item.assetType ?? ''} ${item.instrumentType ?? ''}`
    .toLowerCase();
}

function getPurposeKey(item: PortfolioFinanceItem): BudgetBucketKey {
  const text = getItemText(item);
  const holdingText = `${item.groupName} ${item.name} ${item.assetType ?? ''} ${item.instrumentType ?? ''}`.toLowerCase();
  if (/청약|주택드림|전세|보증금|부동산|housing/u.test(holdingText)) return 'housing';
  if (/학비|교육|자격증|석사|커리어|human.?capital/u.test(holdingText)) return 'humanCapital';
  if (/여행|취미|회복|경험|experience/u.test(holdingText)) return 'experience';
  if (/연금|퇴직|irp|주식|etf|펀드|stock|equity|fund/u.test(holdingText)) return 'growth';
  if (/안전|예금|적금|발행어음|ima|도약|rp|cma|채권|deposit|bond/u.test(holdingText)) return 'defense';
  if (/투자|증권|isa|brokerage/u.test(text)) return 'growth';
  return 'operating';
}

function getAssetClass(item: PortfolioFinanceItem): PersonalCfoAssetClass {
  const text = getItemText(item);
  const assetType = String(item.assetType || '').toLowerCase();
  const instrumentType = String(item.instrumentType || '').toLowerCase();
  if (/청약|주택드림/u.test(text)) return 'deposit';
  if (/전세|보증금|부동산|housing/u.test(text) || assetType === 'real_estate') return 'realEstate';
  if (/연금|퇴직|irp|pension/u.test(text) || assetType === 'pension') return 'pension';
  if (/예금|적금|도약|deposit/u.test(text) || instrumentType === 'deposit') return 'deposit';
  if (/발행어음|채권|\brp\b|bond|fixed.?income|safe_account/u.test(text)) return 'fixedIncome';
  if (/펀드|fund/u.test(text) && !/etf/u.test(text)) return 'fund';
  if (/주식|etf|stock|equity/u.test(text) || assetType === 'stock' || assetType === 'etf') return 'equity';
  if (/현금|입출금|예수금|cash/u.test(text) || assetType === 'account') return 'cash';
  return 'other';
}

function getAccountLabel(item: PortfolioFinanceItem): string | undefined {
  const explicitLabel = String(item.accountName || '').trim();
  if (explicitLabel) return explicitLabel;

  const itemName = String(item.name || '').trim();
  const text = getItemText(item);
  if (/계좌|통장/u.test(itemName)) return itemName;
  if (item.assetType === 'account' && /cash_account/u.test(text)) return itemName || undefined;
  if (/연금|퇴직|irp|pension/u.test(text)) return '연금 계좌';
  return undefined;
}

function getAccountType(label: string, item: PortfolioFinanceItem): PersonalCfoAccountType {
  const text = `${label} ${getItemText(item)}`.toLowerCase();
  if (/연금|퇴직|irp|pension/u.test(text)) return 'pension';
  if (/청약|적금|도약|savings/u.test(text)) return 'savings';
  if (/증권|투자|isa|brokerage|cma/u.test(text)) return 'brokerage';
  if (/은행|통장|계좌|bank/u.test(text)) return 'bank';
  return 'other';
}

export function classifyPortfolioPositionAxes(item: PortfolioFinanceItem): PortfolioPositionAxes {
  const accountLabel = getAccountLabel(item);
  return {
    accountId: accountLabel ? stableId('account:portfolio', accountLabel.toLowerCase()) : undefined,
    accountLabel,
    assetClass: getAssetClass(item),
    purposeKey: getPurposeKey(item),
  };
}

function classifyHolding(item: PortfolioFinanceItem): ClassifiedHolding {
  const axes = classifyPortfolioPositionAxes(item);
  return {
    ...axes,
    item,
    accountType: axes.accountLabel ? getAccountType(axes.accountLabel, item) : undefined,
  };
}

function aggregateAccounts(holdings: ClassifiedHolding[]): PersonalCfoAccount[] {
  const grouped = new Map<string, ClassifiedHolding[]>();
  holdings.forEach((holding) => {
    if (!holding.accountId) return;
    grouped.set(holding.accountId, [...(grouped.get(holding.accountId) ?? []), holding]);
  });

  return Array.from(grouped.entries()).map(([accountId, rows]) => {
    const balance = rows.reduce((total, row) => total + Math.max(0, Number(row.item.amount || 0)), 0);
    const purposeKeys = new Set(rows.map((row) => row.purposeKey));
    const weightedLiquidity = rows.reduce((total, row) => (
      total + (Math.max(0, Number(row.item.amount || 0)) * assetClassMeta[row.assetClass].liquidityScore)
    ), 0);
    return {
      id: accountId,
      label: rows[0].accountLabel || '계좌',
      accountType: rows[0].accountType || 'other',
      balance,
      liquidityScore: balance > 0 ? Math.round(weightedLiquidity / balance) : 0,
      purposeKey: purposeKeys.size === 1 ? rows[0].purposeKey : undefined,
      sourceRefs: toSourceRefs(rows.map((row) => row.item)),
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

function aggregateAssets(holdings: ClassifiedHolding[]): PersonalCfoAsset[] {
  const grouped = new Map<string, ClassifiedHolding[]>();
  holdings.forEach((holding) => {
    const key = `${holding.accountId || 'direct'}|${holding.assetClass}|${holding.purposeKey}`;
    grouped.set(key, [...(grouped.get(key) ?? []), holding]);
  });

  return Array.from(grouped.entries()).map(([key, rows]) => {
    const first = rows[0];
    const meta = assetClassMeta[first.assetClass];
    const firstItemLabel = String(first.item.name || '').trim();
    const repeatsAccountLabel = first.accountLabel === firstItemLabel;
    const label = rows.length > 1
      ? `${meta.label} ${rows.length}개`
      : (repeatsAccountLabel ? meta.label : firstItemLabel || meta.label);
    return {
      id: stableId('asset:portfolio', key),
      label,
      accountId: first.accountId,
      assetClass: first.assetClass,
      marketValue: rows.reduce((total, row) => total + Math.max(0, Number(row.item.amount || 0)), 0),
      purposeKey: first.purposeKey,
      volatilityScore: meta.volatilityScore,
      sourceRefs: toSourceRefs(rows.map((row) => row.item)),
    };
  });
}

export function applyPortfolioFinanceData(
  snapshot: PersonalCfoSnapshot,
  items: PortfolioFinanceItem[],
): PortfolioFinanceOverlay {
  if (items.length === 0) {
    return { snapshot, accountItemCount: 0, assetItemCount: 0, liabilityItemCount: 0, hasPortfolioData: false };
  }

  const liabilityItems = items.filter((item) => item.assetType === 'debt' || Number(item.amount) < 0);
  const holdings = items
    .filter((item) => !liabilityItems.includes(item) && Number(item.amount) > 0)
    .map(classifyHolding);
  const accounts = aggregateAccounts(holdings);
  const assets = aggregateAssets(holdings);
  const liabilities = mapLiabilities(liabilityItems);

  return {
    snapshot: {
      ...snapshot,
      accounts,
      assets,
      liabilities,
    },
    accountItemCount: accounts.length,
    assetItemCount: assets.length,
    liabilityItemCount: liabilities.length,
    hasPortfolioData: true,
  };
}
