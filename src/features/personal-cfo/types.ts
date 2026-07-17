export type PersonalCfoNodeType =
  | 'person'
  | 'income'
  | 'account'
  | 'asset'
  | 'liability'
  | 'budgetBucket'
  | 'project'
  | 'risk'
  | 'kpi';

export type PersonalCfoEdgeType =
  | 'FLOWS_TO'
  | 'ALLOCATED_TO'
  | 'HOLDS'
  | 'FUNDS'
  | 'HEDGES'
  | 'EXPOSED_TO'
  | 'CONTRIBUTES_TO'
  | 'DEPENDS_ON';

export type BudgetBucketKey =
  | 'operating'
  | 'defense'
  | 'housing'
  | 'growth'
  | 'humanCapital'
  | 'experience';

export type PersonalCfoAccountType =
  | 'bank'
  | 'brokerage'
  | 'savings'
  | 'pension'
  | 'other';

export type PersonalCfoAssetClass =
  | 'cash'
  | 'deposit'
  | 'fixedIncome'
  | 'equity'
  | 'fund'
  | 'pension'
  | 'realEstate'
  | 'other';

export type ProjectStatus = 'active' | 'planned' | 'completed' | 'paused';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type PersonalCfoMetricUnit = 'KRW' | 'PERCENT' | 'MONTHS' | 'SCORE';
export type PersonalCfoGraphMode = 'cashFlow' | 'balanceSheet' | 'strategy';
export type PersonalCfoDataSourceType =
  | 'manual'
  | 'financeData'
  | 'portfolioData'
  | 'todoData'
  | 'healthData'
  | 'calendarData';

export interface PersonalCfoSourceRef {
  sourceId: string;
  entityType?: string;
  entityId?: string;
  field?: string;
}

export interface PersonalCfoDataSource {
  id: string;
  label: string;
  type: PersonalCfoDataSourceType;
  description: string;
  lastSyncedAt?: string;
}

export interface PersonalCfoIncome {
  id: string;
  label: string;
  monthlyAmount: number;
  stabilityScore: number;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoAccount {
  id: string;
  label: string;
  accountType: PersonalCfoAccountType;
  // Account value is a derived subtotal of linked positions, never an additional asset.
  balance: number;
  liquidityScore: number;
  purposeKey?: BudgetBucketKey;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoAsset {
  id: string;
  label: string;
  accountId?: string;
  assetClass: PersonalCfoAssetClass;
  marketValue: number;
  purposeKey: BudgetBucketKey;
  volatilityScore: number;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoLiability {
  id: string;
  label: string;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  riskScore: number;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoBudgetBucket {
  id: BudgetBucketKey;
  label: string;
  monthlyAllocation: number;
  currentBalance: number;
  fixedCostAmount: number;
  targetBalance?: number;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoProject {
  id: string;
  label: string;
  bucketKey: BudgetBucketKey;
  status: ProjectStatus;
  monthlyBurn: number;
  targetAmount: number;
  currentAmount: number;
  strategicImportance: number;
  urgency: number;
  expectedReturn: number;
  riskReduction: number;
  targetDateLabel?: string;
  nextMilestone?: string;
  fundingSourceLabel?: string;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoRisk {
  id: string;
  label: string;
  level: RiskLevel;
  likelihood: number;
  impact: number;
  exposureAmount: number;
  mitigatedByBucket?: BudgetBucketKey;
  sourceRefs?: PersonalCfoSourceRef[];
}

export interface PersonalCfoKpi {
  id: string;
  label: string;
  currentValue: number;
  targetValue: number;
  unit: PersonalCfoMetricUnit;
  sourceRefs?: PersonalCfoSourceRef[];
}

export type PersonalCfoCashFlowReviewStatus = 'confirmed' | 'unconfirmed' | 'stale';

export type PersonalCfoSalaryFlowEvidenceStatus = 'observed' | 'inferred' | 'target' | 'missing';

export type PersonalCfoSalaryFlowEntryKey =
  | 'salaryIncome'
  | 'youthSavings'
  | 'pensionSavings'
  | 'creditLoanInterest'
  | 'housingLoanPayment'
  | 'livingFunding'
  | 'safeAssetSweep';

export interface PersonalCfoSalaryFlowLedgerEntry {
  key: PersonalCfoSalaryFlowEntryKey;
  label: string;
  amount: number;
  status: PersonalCfoSalaryFlowEvidenceStatus;
  transactionKeys: string[];
}

export interface PersonalCfoInternalTransferMatch {
  date: string;
  amount: number;
  fromAccount: string;
  toAccount: string;
  outflowKey: string;
  inflowKey: string;
}

export interface PersonalCfoSalaryFlowReconciliation {
  entries: PersonalCfoSalaryFlowLedgerEntry[];
  internalTransfers: PersonalCfoInternalTransferMatch[];
  livingAccountNetFunding: number;
  salaryAccountFunding: number;
  livingAccountFunding: number;
  safeAssetSweep: number;
  accountedSalary: number;
  unaccountedSalary: number;
  allocationShortfall: number;
  usesReconciledAccountFlow: boolean;
}

export interface PersonalCfoSalaryAllocationSummary {
  salaryIncome: number;
  youthSavings: number;
  pensionSavings: number;
  creditLoanInterest: number;
  housingLoanPayment: number;
  salaryAccountReserve: number;
  livingAccountReserve: number;
  safeAssetSweep: number;
  allocationShortfall: number;
  reconciliation: PersonalCfoSalaryFlowReconciliation;
}

export interface PersonalCfoCashFlowSummary {
  periodKey: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  latestTransactionDate: string;
  reviewStatus: PersonalCfoCashFlowReviewStatus;
  totalIncome: number;
  totalExpense: number;
  freeCashFlow: number;
  fixedExpense: number;
  debtRepayment: number;
  creditLoanInterest: number;
  housingLoanPayment: number;
  youthSavings: number;
  pensionSavings: number;
  savingTransfers: number;
  unallocatedCash: number;
  bucketOutflows: Record<BudgetBucketKey, number>;
  salaryAllocation: PersonalCfoSalaryAllocationSummary;
}

export interface PersonalCfoSnapshot {
  person: {
    id: string;
    label: string;
  };
  dataSources?: PersonalCfoDataSource[];
  incomes: PersonalCfoIncome[];
  accounts: PersonalCfoAccount[];
  assets: PersonalCfoAsset[];
  liabilities: PersonalCfoLiability[];
  budgetBuckets: PersonalCfoBudgetBucket[];
  projects: PersonalCfoProject[];
  risks: PersonalCfoRisk[];
  kpis: PersonalCfoKpi[];
  cashFlow?: PersonalCfoCashFlowSummary;
}

export interface PersonalCfoGraphNode {
  id: string;
  label: string;
  type: PersonalCfoNodeType;
  amount?: number;
  riskScore?: number;
  status?: ProjectStatus;
  bucketKey?: BudgetBucketKey;
  unit?: PersonalCfoMetricUnit;
  size: number;
  opacity: number;
  x: number;
  y: number;
}

export interface PersonalCfoGraphEdge {
  id: string;
  source: string;
  target: string;
  type: PersonalCfoEdgeType;
  amount?: number;
  weight: number;
}

export interface PersonalCfoGraphColumn {
  x: number;
  label: string;
}

export interface PersonalCfoGraph {
  mode: PersonalCfoGraphMode;
  width: number;
  height: number;
  columns: PersonalCfoGraphColumn[];
  laneYs?: number[];
  nodes: PersonalCfoGraphNode[];
  edges: PersonalCfoGraphEdge[];
}

export interface PersonalCfoKpiSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  monthlyFreeCashFlow: number;
  savingsRate: number;
  fixedCostRatio: number;
  debtRatio: number;
  emergencyCoverageMonths: number;
  projectBurnRate: number;
}

export interface PersonalCfoSnapshotRecord {
  id?: string;
  userId?: string;
  snapshotKey: 'default' | string;
  schemaVersion: number;
  snapshot: PersonalCfoSnapshot;
  createdAt?: string;
  updatedAt?: string;
}
