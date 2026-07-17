import {
  calculateNetWorth,
  calculateRiskScore,
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
  const allocation = snapshot.cashFlow?.salaryAllocation;
  const salaryIncome = allocation?.salaryIncome
    ?? snapshot.incomes.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const salaryId = 'income:salary-allocation';
  const allocationId = 'flow:salary-allocation';
  const outflowX = 790;
  const topY = 92;
  const destinationGap = 78;

  nodes.push(makeNode({
    id: salaryId,
    label: snapshot.cashFlow ? `${snapshot.cashFlow.periodLabel} 월급` : '월급',
    type: 'income',
    x: 115,
    y: topY,
    amount: salaryIncome,
  }));
  nodes.push(makeNode({
    id: allocationId,
    label: '월급 배분',
    type: 'person',
    x: 390,
    y: topY,
    amount: salaryIncome + (allocation?.allocationShortfall || 0),
  }));
  edges.push(makeEdge('edge:salary:allocation', salaryId, allocationId, 'FLOWS_TO', salaryIncome));

  if (allocation?.allocationShortfall) {
    nodes.push(makeNode({
      id: 'liability:salary-allocation-shortfall',
      label: '배분 부족',
      type: 'liability',
      x: 115,
      y: topY + destinationGap,
      amount: allocation.allocationShortfall,
      riskScore: 85,
    }));
    edges.push(makeEdge(
      'edge:shortfall:allocation',
      'liability:salary-allocation-shortfall',
      allocationId,
      'EXPOSED_TO',
      allocation.allocationShortfall,
    ));
  }

  const destinations: Array<{
    id: string;
    label: string;
    type: PersonalCfoNodeType;
    amount: number;
    edgeType: PersonalCfoEdgeType;
    bucketKey?: BudgetBucketKey;
    riskScore?: number;
  }> = allocation ? [
    {
      id: 'account:living-expense', label: '생활비', type: 'account',
      amount: allocation.salaryAccountReserve + allocation.livingAccountReserve,
      edgeType: 'ALLOCATED_TO', bucketKey: 'operating',
    },
    {
      id: 'account:youth-savings', label: '청년도약계좌', type: 'account',
      amount: allocation.youthSavings, edgeType: 'ALLOCATED_TO', bucketKey: 'defense',
    },
    {
      id: 'asset:pension-savings', label: '연금저축펀드', type: 'asset',
      amount: allocation.pensionSavings, edgeType: 'ALLOCATED_TO', bucketKey: 'growth',
    },
    {
      id: 'asset:krw-note', label: '원화 발행어음', type: 'asset',
      amount: allocation.safeAssetSweep, edgeType: 'ALLOCATED_TO', bucketKey: 'defense',
    },
    {
      id: 'liability:credit-loan-interest', label: '신용대출 이자', type: 'liability',
      amount: allocation.creditLoanInterest, edgeType: 'FLOWS_TO', riskScore: 62,
    },
    {
      id: 'liability:housing-loan-cashflow', label: '전세대출', type: 'liability',
      amount: allocation.housingLoanPayment, edgeType: 'FLOWS_TO', bucketKey: 'housing',
    },
  ] : snapshot.budgetBuckets.map((bucket) => ({
    id: bucketNodeByKey[bucket.id],
    label: bucket.label,
    type: 'budgetBucket' as const,
    amount: bucket.monthlyAllocation,
    edgeType: 'ALLOCATED_TO' as const,
    bucketKey: bucket.id,
  }));

  destinations.filter((destination) => destination.amount > 0).forEach((destination, index) => {
    nodes.push(makeNode({
      id: destination.id,
      label: destination.label,
      type: destination.type,
      x: outflowX,
      y: topY + (index * destinationGap),
      amount: destination.amount,
      bucketKey: destination.bucketKey,
      riskScore: destination.riskScore,
    }));
    edges.push(makeEdge(
      `edge:allocation:${destination.id}`,
      allocationId,
      destination.id,
      destination.edgeType,
      destination.amount,
    ));
  });

  const laneYs = nodes
    .filter((node) => node.x === outflowX)
    .map((node) => node.y);
  return {
    mode: 'cashFlow',
    width: 1020,
    height: Math.max(650, (laneYs.length ? Math.max(...laneYs) : topY) + 72),
    columns: [
      { x: 115, label: '월급' },
      { x: 390, label: '배분' },
      { x: outflowX, label: '월급 사용처' },
    ],
    laneYs,
    nodes,
    edges,
  };
}

function buildBalanceSheetGraph(snapshot: PersonalCfoSnapshot): PersonalCfoGraph {
  const nodes: PersonalCfoGraphNode[] = [];
  const edges: PersonalCfoGraphEdge[] = [];
  const accountX = 150;
  const assetX = 590;
  const personX = 1030;
  const topY = 92;
  const personY = topY;
  const rowGap = 96;
  const accountOrder = new Map(snapshot.accounts.map((account, index) => [account.id, index]));
  const orderedAssets = [...snapshot.assets].sort((left, right) => {
    const leftOrder = left.accountId ? accountOrder.get(left.accountId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const rightOrder = right.accountId ? accountOrder.get(right.accountId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
  const assetYById = new Map(orderedAssets.map((asset, index) => [asset.id, topY + (index * rowGap)]));
  const accountIds = new Set(snapshot.accounts.map((account) => account.id));

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: personX,
    y: personY,
    amount: calculateNetWorth(snapshot),
  }));

  snapshot.accounts.forEach((account, index) => {
    const linkedAssetYs = orderedAssets
      .filter((asset) => asset.accountId === account.id)
      .map((asset) => assetYById.get(asset.id) ?? topY);
    const y = linkedAssetYs[0] ?? (topY + (index * rowGap));
    nodes.push(makeNode({
      id: account.id,
      label: account.label,
      type: 'account',
      x: accountX,
      y,
      amount: account.balance,
      bucketKey: account.purposeKey,
    }));
    if (snapshot.assets.length === 0) {
      edges.push(makeEdge(`edge:${account.id}:person`, account.id, snapshot.person.id, 'CONTRIBUTES_TO', account.balance));
    }
  });

  orderedAssets.forEach((asset, index) => {
    nodes.push(makeNode({
      id: asset.id,
      label: asset.label,
      type: 'asset',
      x: assetX,
      y: assetYById.get(asset.id) ?? (topY + (index * rowGap)),
      amount: asset.marketValue,
      bucketKey: asset.purposeKey,
      riskScore: asset.volatilityScore,
    }));
    if (asset.accountId && accountIds.has(asset.accountId)) {
      edges.push(makeEdge(`edge:${asset.accountId}:${asset.id}`, asset.accountId, asset.id, 'HOLDS', asset.marketValue));
    }
    edges.push(makeEdge(`edge:${asset.id}:person`, asset.id, snapshot.person.id, 'CONTRIBUTES_TO', asset.marketValue));
  });

  const liabilityTopY = topY + (Math.max(1, orderedAssets.length) * rowGap);
  snapshot.liabilities.forEach((liability, index) => {
    nodes.push(makeNode({
      id: liability.id,
      label: liability.label,
      type: 'liability',
      x: personX,
      y: liabilityTopY + (index * rowGap),
      amount: liability.outstandingBalance,
      riskScore: liability.riskScore,
    }));
    edges.push(makeEdge(`edge:${liability.id}:person`, liability.id, snapshot.person.id, 'EXPOSED_TO', liability.outstandingBalance));
  });

  return {
    mode: 'balanceSheet',
    width: 1200,
    height: Math.max(580, liabilityTopY + (snapshot.liabilities.length * rowGap) + 60),
    columns: [
      { x: accountX, label: '계좌' },
      { x: assetX, label: '보유자산' },
      { x: personX, label: '순자산' },
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
  mode: PersonalCfoGraphMode = 'balanceSheet',
): PersonalCfoGraph {
  if (mode === 'balanceSheet') return buildBalanceSheetGraph(snapshot);
  if (mode === 'strategy') return buildStrategyGraph(snapshot);
  return buildCashFlowGraph(snapshot);
}
