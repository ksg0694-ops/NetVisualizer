import {
  calculateMonthlyFreeCashFlow,
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
  const bucketAmounts = snapshot.cashFlow?.bucketOutflows;
  const outflowX = 790;
  const bucketStartY = 80;
  const bucketGap = 84;

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: 390,
    y: 355,
    amount: snapshot.cashFlow?.totalIncome ?? snapshot.incomes.reduce((sum, item) => sum + item.monthlyAmount, 0),
  }));

  snapshot.incomes.forEach((income, index) => {
    nodes.push(makeNode({
      id: income.id,
      label: income.label,
      type: 'income',
      x: 115,
      y: 355 + (index * 84),
      amount: income.monthlyAmount,
    }));
    edges.push(makeEdge(`edge:${income.id}:person`, income.id, snapshot.person.id, 'FLOWS_TO', income.monthlyAmount));
  });

  snapshot.budgetBuckets.forEach((bucket, index) => {
    const amount = bucketAmounts ? bucketAmounts[bucket.id] : bucket.monthlyAllocation;
    nodes.push(makeNode({
      id: bucketNodeByKey[bucket.id],
      label: bucket.label,
      type: 'budgetBucket',
      x: outflowX,
      y: bucketStartY + (index * bucketGap),
      amount,
      bucketKey: bucket.id,
    }));
    if (amount > 0) {
      edges.push(makeEdge(`edge:person:${bucket.id}`, snapshot.person.id, bucketNodeByKey[bucket.id], 'ALLOCATED_TO', amount));
    }
  });

  const residual = snapshot.cashFlow?.unallocatedCash ?? calculateMonthlyFreeCashFlow(snapshot);
  const debtRepayment = snapshot.cashFlow?.debtRepayment ?? 0;
  if (debtRepayment > 0) {
    nodes.push(makeNode({
      id: 'liability:monthly-debt-payment',
      label: '부채 상환',
      type: 'liability',
      x: outflowX,
      y: bucketStartY + (snapshot.budgetBuckets.length * bucketGap),
      amount: debtRepayment,
      riskScore: 62,
    }));
    edges.push(makeEdge('edge:person:debt-payment', snapshot.person.id, 'liability:monthly-debt-payment', 'FLOWS_TO', debtRepayment));
  }
  const residualId = residual >= 0 ? 'account:unallocated-cash' : 'liability:cash-deficit';
  nodes.push(makeNode({
    id: residualId,
    label: residual >= 0 ? '저축 후 미배분' : '초과 지출',
    type: residual >= 0 ? 'account' : 'liability',
    x: outflowX,
    y: bucketStartY + ((snapshot.budgetBuckets.length + (debtRepayment > 0 ? 1 : 0)) * bucketGap),
    amount: Math.abs(residual),
    riskScore: residual < 0 ? 85 : undefined,
  }));
  edges.push(residual >= 0
    ? makeEdge('edge:person:unallocated', snapshot.person.id, residualId, 'FLOWS_TO', residual)
    : makeEdge('edge:deficit:person', residualId, snapshot.person.id, 'EXPOSED_TO', Math.abs(residual)));

  const laneYs = nodes
    .filter((node) => node.x === outflowX)
    .map((node) => node.y);
  return {
    mode: 'cashFlow',
    width: 1020,
    height: Math.max(720, Math.max(...laneYs) + 70),
    columns: [
      { x: 115, label: '수입' },
      { x: 390, label: '사용 가능 현금' },
      { x: outflowX, label: '실제 유출·잔여' },
    ],
    laneYs,
    nodes,
    edges,
  };
}

function buildBalanceSheetGraph(snapshot: PersonalCfoSnapshot): PersonalCfoGraph {
  const nodes: PersonalCfoGraphNode[] = [];
  const edges: PersonalCfoGraphEdge[] = [];
  const accountX = 170;
  const personX = 600;
  const assetX = 1030;
  const personY = 350;
  const accountYs = [115, 270, 430, 585];
  const assetYs = [170, 350, 530];

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: personX,
    y: personY,
    amount: calculateNetWorth(snapshot),
  }));

  snapshot.accounts.forEach((account, index) => {
    nodes.push(makeNode({
      id: account.id,
      label: account.label,
      type: 'account',
      x: accountX,
      y: accountYs[index] ?? (115 + (index * 120)),
      amount: account.balance,
      bucketKey: account.bucketKey,
    }));
    edges.push(makeEdge(`edge:${account.id}:person`, account.id, snapshot.person.id, 'CONTRIBUTES_TO', account.balance));
  });

  snapshot.assets.forEach((asset, index) => {
    nodes.push(makeNode({
      id: asset.id,
      label: asset.label,
      type: 'asset',
      x: assetX,
      y: assetYs[index] ?? (170 + (index * 150)),
      amount: asset.marketValue,
      bucketKey: asset.bucketKey,
      riskScore: asset.volatilityScore,
    }));
    edges.push(makeEdge(`edge:${asset.id}:person`, asset.id, snapshot.person.id, 'CONTRIBUTES_TO', asset.marketValue));
  });

  snapshot.liabilities.forEach((liability, index) => {
    nodes.push(makeNode({
      id: liability.id,
      label: liability.label,
      type: 'liability',
      x: personX + ((index - ((snapshot.liabilities.length - 1) / 2)) * 180),
      y: 650,
      amount: liability.outstandingBalance,
      riskScore: liability.riskScore,
    }));
    edges.push(makeEdge(`edge:${liability.id}:person`, liability.id, snapshot.person.id, 'EXPOSED_TO', liability.outstandingBalance));
  });

  return {
    mode: 'balanceSheet',
    width: 1200,
    height: 720,
    columns: [
      { x: accountX, label: '계좌' },
      { x: personX, label: '순자산' },
      { x: assetX, label: '보유자산' },
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
  const bucketStartY = 80;
  const bucketGap = 110;
  const bucketYByKey = new Map<BudgetBucketKey, number>();

  nodes.push(makeNode({
    id: snapshot.person.id,
    label: snapshot.person.label,
    type: 'person',
    x: personX,
    y: 355,
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
    height: 720,
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
