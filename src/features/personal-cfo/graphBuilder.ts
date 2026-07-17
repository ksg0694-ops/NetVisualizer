import {
  calculateNetWorth,
  calculateRiskScore,
  calculateTotalAssets,
  calculateTotalLiabilities,
} from './calculations';
import type {
  BudgetBucketKey,
  PersonalCfoEdgeType,
  PersonalCfoGraph,
  PersonalCfoGraphEdge,
  PersonalCfoGraphMode,
  PersonalCfoGraphNode,
  PersonalCfoMetricUnit,
  PersonalCfoNodeType,
  PersonalCfoSnapshot,
  ProjectStatus,
} from './types';

const bucketNodeByKey: Record<BudgetBucketKey, string> = {
  operating: 'bucket:operating',
  defense: 'bucket:defense',
  housing: 'bucket:housing',
  growth: 'bucket:growth',
  humanCapital: 'bucket:humanCapital',
  experience: 'bucket:experience',
};

type SummaryAssetGroupKey = 'operating' | 'defense' | 'housing' | 'growth' | 'pension' | 'other';

interface SummaryAssetGroup {
  id: string;
  key: SummaryAssetGroupKey;
  label: string;
  amount: number;
  bucketKey?: BudgetBucketKey;
}

interface CashFlowSummaryData {
  salaryIncome: number;
  allocationShortfall: number;
  living: number;
  saving: number;
  debt: number;
  purposeAllocations: Record<SummaryAssetGroupKey, number>;
}

const summaryAssetGroupMeta: Record<SummaryAssetGroupKey, {
  label: string;
  bucketKey?: BudgetBucketKey;
}> = {
  operating: { label: '생활자금', bucketKey: 'operating' },
  defense: { label: '안전자금', bucketKey: 'defense' },
  housing: { label: '주거자산', bucketKey: 'housing' },
  growth: { label: '투자자산', bucketKey: 'growth' },
  pension: { label: '연금자산' },
  other: { label: '기타자산' },
};

function getSummaryAssetGroupKey(purposeKey?: string, isPension = false): SummaryAssetGroupKey {
  if (isPension) return 'pension';
  if (purposeKey === 'operating') return 'operating';
  if (purposeKey === 'defense') return 'defense';
  if (purposeKey === 'housing') return 'housing';
  if (purposeKey === 'growth') return 'growth';
  return 'other';
}

function getAssetSummaryGroups(snapshot: PersonalCfoSnapshot): SummaryAssetGroup[] {
  const totals = new Map<SummaryAssetGroupKey, number>();
  const add = (purposeKey: string | undefined, amount: number, isPension = false) => {
    if (amount <= 0) return;
    const key = getSummaryAssetGroupKey(purposeKey, isPension);
    totals.set(key, (totals.get(key) || 0) + amount);
  };

  if (snapshot.assets.length > 0) {
    const accountById = new Map(snapshot.accounts.map((account) => [account.id, account]));
    snapshot.assets.forEach((asset) => {
      const account = asset.accountId ? accountById.get(asset.accountId) : undefined;
      add(
        asset.purposeKey,
        asset.marketValue,
        asset.assetClass === 'pension' || account?.accountType === 'pension',
      );
    });
  } else {
    snapshot.accounts.forEach((account) => add(
      account.purposeKey,
      account.balance,
      account.accountType === 'pension',
    ));
  }

  return (Object.keys(summaryAssetGroupMeta) as SummaryAssetGroupKey[])
    .map((key) => ({
      id: `summary:asset:${key}`,
      key,
      label: summaryAssetGroupMeta[key].label,
      amount: totals.get(key) || 0,
      bucketKey: summaryAssetGroupMeta[key].bucketKey,
    }))
    .filter((group) => group.amount > 0);
}

function getCashFlowSummaryData(snapshot: PersonalCfoSnapshot): CashFlowSummaryData {
  const allocation = snapshot.cashFlow?.salaryAllocation;
  if (allocation) {
    const living = allocation.salaryAccountReserve + allocation.livingAccountReserve;
    const defenseSaving = allocation.youthSavings + allocation.safeAssetSweep;
    const growthSaving = allocation.pensionSavings;
    return {
      salaryIncome: allocation.salaryIncome,
      allocationShortfall: allocation.allocationShortfall,
      living,
      saving: defenseSaving + growthSaving,
      debt: allocation.creditLoanInterest + allocation.housingLoanPayment,
      purposeAllocations: {
        operating: living,
        defense: defenseSaving,
        housing: 0,
        growth: 0,
        pension: growthSaving,
        other: 0,
      },
    };
  }

  const monthlyByPurpose = new Map<BudgetBucketKey, number>();
  snapshot.budgetBuckets.forEach((bucket) => {
    monthlyByPurpose.set(bucket.id, (monthlyByPurpose.get(bucket.id) || 0) + bucket.monthlyAllocation);
  });
  const salaryIncome = snapshot.incomes.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const operating = monthlyByPurpose.get('operating') || 0;
  const experience = monthlyByPurpose.get('experience') || 0;
  const defense = monthlyByPurpose.get('defense') || 0;
  const housing = monthlyByPurpose.get('housing') || 0;
  const growth = monthlyByPurpose.get('growth') || 0;
  const humanCapital = monthlyByPurpose.get('humanCapital') || 0;
  const living = operating + experience;
  const saving = defense + housing + growth + humanCapital;
  const debt = snapshot.liabilities.reduce((sum, item) => sum + item.monthlyPayment, 0);
  return {
    salaryIncome,
    allocationShortfall: Math.max(0, living + saving + debt - salaryIncome),
    living,
    saving,
    debt,
    purposeAllocations: {
      operating,
      defense,
      housing,
      growth,
      pension: 0,
      other: humanCapital,
    },
  };
}

function amountToNodeSize(amount = 0): number {
  if (amount <= 0) return 18;
  return Math.round(Math.min(30, 12 + Math.log10(amount) * 2.25));
}

function amountToEdgeWeight(amount = 0): number {
  if (amount <= 0) return 1.2;
  return Number(Math.min(4.5, 1.2 + Math.log10(amount) * 0.38).toFixed(2));
}

function makeNode(params: {
  id: string;
  label: string;
  type: PersonalCfoNodeType;
  x: number;
  y: number;
  amount?: number;
  riskScore?: number;
  status?: ProjectStatus;
  bucketKey?: BudgetBucketKey;
  unit?: PersonalCfoMetricUnit;
}): PersonalCfoGraphNode {
  return {
    ...params,
    size: amountToNodeSize(params.amount),
    opacity: params.status === 'completed' ? 0.38 : 1,
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  type: PersonalCfoEdgeType,
  amount?: number,
): PersonalCfoGraphEdge {
  return { id, source, target, type, amount, weight: amountToEdgeWeight(amount) };
}

function buildCashFlowGraph(snapshot: PersonalCfoSnapshot): PersonalCfoGraph {
  const nodes: PersonalCfoGraphNode[] = [];
  const edges: PersonalCfoGraphEdge[] = [];
  const summary = getCashFlowSummaryData(snapshot);
  const salaryId = 'income:salary-allocation';
  const allocationId = 'flow:salary-allocation';
  const outflowX = 790;
  const topY = 92;
  const destinationGap = 112;

  nodes.push(makeNode({
    id: salaryId,
    label: snapshot.cashFlow ? `${snapshot.cashFlow.periodLabel} 월급` : '월급',
    type: 'income',
    x: 115,
    y: topY,
    amount: summary.salaryIncome,
  }));
  nodes.push(makeNode({
    id: allocationId,
    label: '월급 배분',
    type: 'budgetBucket',
    x: 390,
    y: topY,
    amount: summary.salaryIncome + summary.allocationShortfall,
  }));
  edges.push(makeEdge('edge:salary:allocation', salaryId, allocationId, 'FLOWS_TO', summary.salaryIncome));

  if (summary.allocationShortfall > 0) {
    nodes.push(makeNode({
      id: 'liability:salary-allocation-shortfall',
      label: '배분 부족',
      type: 'liability',
      x: 115,
      y: topY + destinationGap,
      amount: summary.allocationShortfall,
      riskScore: 85,
    }));
    edges.push(makeEdge(
      'edge:shortfall:allocation',
      'liability:salary-allocation-shortfall',
      allocationId,
      'EXPOSED_TO',
      summary.allocationShortfall,
    ));
  }

  const destinations: Array<{
    id: string;
    label: string;
    type: PersonalCfoNodeType;
    amount: number;
    bucketKey?: BudgetBucketKey;
  }> = [
    {
      id: 'summary:cashflow:living', label: '생활비', type: 'budgetBucket',
      amount: summary.living, bucketKey: 'operating',
    },
    {
      id: 'summary:cashflow:saving', label: '저축·투자', type: 'budgetBucket',
      amount: summary.saving,
    },
    {
      id: 'summary:cashflow:debt', label: '부채·금융비용', type: 'liability',
      amount: summary.debt,
    },
  ];

  destinations.filter((destination) => destination.amount > 0).forEach((destination, index) => {
    nodes.push(makeNode({
      id: destination.id,
      label: destination.label,
      type: destination.type,
      x: outflowX,
      y: topY + (index * destinationGap),
      amount: destination.amount,
      bucketKey: destination.bucketKey,
    }));
    edges.push(makeEdge(
      `edge:allocation:${destination.id}`,
      allocationId,
      destination.id,
      destination.type === 'liability' ? 'FLOWS_TO' : 'ALLOCATED_TO',
      destination.amount,
    ));
  });

  const laneYs = nodes
    .filter((node) => node.x === outflowX)
    .map((node) => node.y);
  return {
    mode: 'cashFlow',
    width: 1020,
    height: Math.max(440, (laneYs.length ? Math.max(...laneYs) : topY) + 84),
    columns: [
      { x: 115, label: '월급' },
      { x: 390, label: '배분' },
      { x: outflowX, label: '월 사용 요약' },
    ],
    laneYs,
    nodes,
    edges,
  };
}

function buildBalanceSheetGraph(snapshot: PersonalCfoSnapshot): PersonalCfoGraph {
  const nodes: PersonalCfoGraphNode[] = [];
  const edges: PersonalCfoGraphEdge[] = [];
  const groupX = 150;
  const totalX = 590;
  const personX = 1030;
  const topY = 92;
  const rowGap = 100;
  const assetGroups = getAssetSummaryGroups(snapshot);
  const totalAssets = calculateTotalAssets(snapshot);
  const totalLiabilities = calculateTotalLiabilities(snapshot);

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: personX,
    y: topY,
    amount: calculateNetWorth(snapshot),
  }));

  assetGroups.forEach((group, index) => {
    nodes.push(makeNode({
      id: group.id,
      label: group.label,
      type: 'budgetBucket',
      x: groupX,
      y: topY + (index * rowGap),
      amount: group.amount,
      bucketKey: group.bucketKey,
    }));
    edges.push(makeEdge(`edge:${group.id}:total-assets`, group.id, 'summary:assets:total', 'CONTRIBUTES_TO', group.amount));
  });

  nodes.push(makeNode({
    id: 'summary:assets:total',
    label: '총자산',
    type: 'asset',
    x: totalX,
    y: topY,
    amount: totalAssets,
  }));
  edges.push(makeEdge('edge:total-assets:person', 'summary:assets:total', snapshot.person.id, 'CONTRIBUTES_TO', totalAssets));

  const liabilityY = topY + (Math.max(1, assetGroups.length) * rowGap);
  if (totalLiabilities > 0) {
    nodes.push(makeNode({
      id: 'summary:liabilities:total',
      label: '총부채',
      type: 'liability',
      x: totalX,
      y: liabilityY,
      amount: totalLiabilities,
    }));
    edges.push(makeEdge('edge:total-liabilities:person', 'summary:liabilities:total', snapshot.person.id, 'EXPOSED_TO', totalLiabilities));
  }

  return {
    mode: 'balanceSheet',
    width: 1200,
    height: Math.max(520, liabilityY + 72),
    columns: [
      { x: groupX, label: '자산 구성' },
      { x: totalX, label: '자산·부채 합계' },
      { x: personX, label: '순자산' },
    ],
    nodes,
    edges,
  };
}

function buildCombinedSummaryGraph(snapshot: PersonalCfoSnapshot): PersonalCfoGraph {
  const nodes: PersonalCfoGraphNode[] = [];
  const edges: PersonalCfoGraphEdge[] = [];
  const cashFlow = getCashFlowSummaryData(snapshot);
  const assetGroups = getAssetSummaryGroups(snapshot);
  const totalLiabilities = calculateTotalLiabilities(snapshot);
  const salaryX = 100;
  const allocationX = 320;
  const flowX = 580;
  const assetX = 920;
  const resultX = 1300;
  const topY = 92;
  const flowGap = 112;
  const assetGap = 92;
  const salaryId = 'income:salary-allocation';
  const allocationId = 'flow:salary-allocation';

  nodes.push(makeNode({
    id: salaryId,
    label: snapshot.cashFlow ? `${snapshot.cashFlow.periodLabel} 월급` : '월급',
    type: 'income',
    x: salaryX,
    y: topY,
    amount: cashFlow.salaryIncome,
  }));
  nodes.push(makeNode({
    id: allocationId,
    label: '월급 배분',
    type: 'budgetBucket',
    x: allocationX,
    y: topY,
    amount: cashFlow.salaryIncome + cashFlow.allocationShortfall,
  }));
  edges.push(makeEdge('edge:combined:salary:allocation', salaryId, allocationId, 'FLOWS_TO', cashFlow.salaryIncome));

  if (cashFlow.allocationShortfall > 0) {
    nodes.push(makeNode({
      id: 'liability:salary-allocation-shortfall',
      label: '배분 부족',
      type: 'liability',
      x: salaryX,
      y: topY + flowGap,
      amount: cashFlow.allocationShortfall,
      riskScore: 85,
    }));
    edges.push(makeEdge(
      'edge:combined:shortfall:allocation',
      'liability:salary-allocation-shortfall',
      allocationId,
      'EXPOSED_TO',
      cashFlow.allocationShortfall,
    ));
  }

  const flowGroups: Array<{
    id: string;
    label: string;
    amount: number;
    type: PersonalCfoNodeType;
    bucketKey?: BudgetBucketKey;
  }> = [
    { id: 'summary:cashflow:living', label: '생활비', amount: cashFlow.living, type: 'budgetBucket', bucketKey: 'operating' },
    { id: 'summary:cashflow:saving', label: '저축·투자', amount: cashFlow.saving, type: 'budgetBucket' },
    { id: 'summary:cashflow:debt', label: '부채·금융비용', amount: cashFlow.debt, type: 'liability' },
  ];
  flowGroups.filter((group) => group.amount > 0).forEach((group, index) => {
    nodes.push(makeNode({
      ...group,
      x: flowX,
      y: topY + (index * flowGap),
    }));
    edges.push(makeEdge(
      `edge:combined:allocation:${group.id}`,
      allocationId,
      group.id,
      group.type === 'liability' ? 'FLOWS_TO' : 'ALLOCATED_TO',
      group.amount,
    ));
  });

  assetGroups.forEach((group, index) => {
    nodes.push(makeNode({
      id: group.id,
      label: group.label,
      type: 'asset',
      x: assetX,
      y: topY + (index * assetGap),
      amount: group.amount,
      bucketKey: group.bucketKey,
    }));
    edges.push(makeEdge(`edge:combined:${group.id}:person`, group.id, snapshot.person.id, 'CONTRIBUTES_TO', group.amount));
  });

  const assetByKey = new Map(assetGroups.map((group) => [group.key, group]));
  const flowToAsset: Array<{ source: string; targetKey: SummaryAssetGroupKey; amount: number }> = [
    { source: 'summary:cashflow:living', targetKey: 'operating', amount: cashFlow.purposeAllocations.operating },
    { source: 'summary:cashflow:saving', targetKey: 'defense', amount: cashFlow.purposeAllocations.defense },
    { source: 'summary:cashflow:saving', targetKey: 'housing', amount: cashFlow.purposeAllocations.housing },
    { source: 'summary:cashflow:saving', targetKey: 'growth', amount: cashFlow.purposeAllocations.growth },
    { source: 'summary:cashflow:saving', targetKey: 'pension', amount: cashFlow.purposeAllocations.pension },
    { source: 'summary:cashflow:saving', targetKey: 'other', amount: cashFlow.purposeAllocations.other },
  ];
  const nodeIds = new Set(nodes.map((node) => node.id));
  flowToAsset.forEach((connection) => {
    const target = assetByKey.get(connection.targetKey);
    if (!target || connection.amount <= 0 || !nodeIds.has(connection.source)) return;
    edges.push(makeEdge(
      `edge:combined:${connection.source}:${target.id}`,
      connection.source,
      target.id,
      'ALLOCATED_TO',
      connection.amount,
    ));
  });

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: resultX,
    y: topY,
    amount: calculateNetWorth(snapshot),
  }));
  const liabilityY = topY + (Math.max(1, assetGroups.length) * assetGap);
  if (totalLiabilities > 0) {
    nodes.push(makeNode({
      id: 'summary:liabilities:total',
      label: '총부채',
      type: 'liability',
      x: resultX,
      y: liabilityY,
      amount: totalLiabilities,
    }));
    edges.push(makeEdge('edge:combined:liabilities:person', 'summary:liabilities:total', snapshot.person.id, 'EXPOSED_TO', totalLiabilities));
  }

  return {
    mode: 'combined',
    width: 1430,
    height: Math.max(560, liabilityY + 72),
    columns: [
      { x: salaryX, label: '월급' },
      { x: allocationX, label: '배분' },
      { x: flowX, label: '월 사용 요약' },
      { x: assetX, label: '현재 자산' },
      { x: resultX, label: '순자산' },
    ],
    nodes,
    edges,
  };
}

function buildStrategyGraph(snapshot: PersonalCfoSnapshot): PersonalCfoGraph {
  const nodes: PersonalCfoGraphNode[] = [];
  const edges: PersonalCfoGraphEdge[] = [];
  const personX = 110;
  const bucketX = 430;
  const targetX = 900;
  const topY = 92;
  const bucketStartY = topY;
  const bucketGap = 110;
  const bucketYByKey = new Map<BudgetBucketKey, number>();

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: personX,
    y: topY,
    amount: calculateNetWorth(snapshot),
  }));

  snapshot.budgetBuckets.forEach((bucket, index) => {
    const y = bucketStartY + (index * bucketGap);
    bucketYByKey.set(bucket.id, y);
    nodes.push(makeNode({
      id: bucketNodeByKey[bucket.id],
      label: bucket.label,
      type: 'budgetBucket',
      x: bucketX,
      y,
      amount: bucket.currentBalance,
      bucketKey: bucket.id,
    }));
    edges.push(makeEdge(`edge:person:${bucket.id}`, snapshot.person.id, bucketNodeByKey[bucket.id], 'ALLOCATED_TO', bucket.monthlyAllocation));
  });

  const targetsByBucket = new Map<BudgetBucketKey, Array<{
    id: string;
    label: string;
    type: 'project' | 'risk';
    amount: number;
    status?: ProjectStatus;
    riskScore?: number;
  }>>();
  snapshot.projects.forEach((project) => {
    const targets = targetsByBucket.get(project.bucketKey) ?? [];
    targets.push({
      id: project.id,
      label: project.label,
      type: 'project',
      amount: project.targetAmount,
      status: project.status,
    });
    targetsByBucket.set(project.bucketKey, targets);
    edges.push(makeEdge(`edge:${project.bucketKey}:${project.id}`, bucketNodeByKey[project.bucketKey], project.id, 'FUNDS', project.monthlyBurn));
  });
  snapshot.risks.forEach((risk) => {
    if (!risk.mitigatedByBucket) return;
    const targets = targetsByBucket.get(risk.mitigatedByBucket) ?? [];
    targets.push({
      id: risk.id,
      label: risk.label,
      type: 'risk',
      amount: risk.exposureAmount,
      riskScore: calculateRiskScore(risk),
    });
    targetsByBucket.set(risk.mitigatedByBucket, targets);
    edges.push(makeEdge(`edge:${risk.mitigatedByBucket}:${risk.id}`, bucketNodeByKey[risk.mitigatedByBucket], risk.id, 'HEDGES', risk.exposureAmount));
  });
  targetsByBucket.forEach((targets, bucketKey) => {
    const baseY = bucketYByKey.get(bucketKey) ?? 355;
    targets.forEach((target, index) => {
      const y = baseY + ((index - ((targets.length - 1) / 2)) * 62);
      nodes.push(makeNode({
        ...target,
        x: targetX,
        y,
        bucketKey,
      }));
    });
  });

  return {
    mode: 'strategy',
    width: 1080,
    height: Math.max(620, Math.max(...bucketYByKey.values()) + 80),
    columns: [
      { x: personX, label: '본인' },
      { x: bucketX, label: '자금 바구니' },
      { x: targetX, label: '프로젝트·리스크' },
    ],
    laneYs: Array.from(bucketYByKey.values()),
    nodes,
    edges,
  };
}

export function buildFinanceGraphFromSnapshot(
  snapshot: PersonalCfoSnapshot,
  mode: PersonalCfoGraphMode = 'combined',
): PersonalCfoGraph {
  if (mode === 'combined') return buildCombinedSummaryGraph(snapshot);
  if (mode === 'balanceSheet') return buildBalanceSheetGraph(snapshot);
  if (mode === 'strategy') return buildStrategyGraph(snapshot);
  return buildCashFlowGraph(snapshot);
}
