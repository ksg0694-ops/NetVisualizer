import {
  buildPersonalCfoKpiSummary,
  calculateProjectPriorityScore,
  calculateRiskScore,
} from './calculations';
import { buildFinanceGraphFromSnapshot } from './graphBuilder';
import { personalCfoMockSnapshot } from './mockData';
import type { PersonalCfoGraphMode, PersonalCfoSnapshot } from './types';

export interface PersonalCfoPageModel {
  snapshot: PersonalCfoSnapshot;
  summary: ReturnType<typeof buildPersonalCfoKpiSummary>;
  graph: ReturnType<typeof buildFinanceGraphFromSnapshot>;
  projectsByPriority: Array<PersonalCfoSnapshot['projects'][number] & { priorityScore: number }>;
  risksByScore: Array<PersonalCfoSnapshot['risks'][number] & { score: number }>;
}

export function createPersonalCfoPageModel(
  snapshot: PersonalCfoSnapshot = personalCfoMockSnapshot,
  graphMode: PersonalCfoGraphMode = 'balanceSheet',
): PersonalCfoPageModel {
  return {
    snapshot,
    summary: buildPersonalCfoKpiSummary(snapshot),
    graph: buildFinanceGraphFromSnapshot(snapshot, graphMode),
    projectsByPriority: snapshot.projects
      .map((project) => ({ ...project, priorityScore: calculateProjectPriorityScore(project) }))
      .sort((a, b) => b.priorityScore - a.priorityScore),
    risksByScore: snapshot.risks
      .map((risk) => ({ ...risk, score: calculateRiskScore(risk) }))
      .sort((a, b) => b.score - a.score),
  };
}

export function PersonalCfoPage(snapshot: PersonalCfoSnapshot = personalCfoMockSnapshot): string {
  const model = createPersonalCfoPageModel(snapshot);
  return `개인 CFO 대시보드: 노드 ${model.graph.nodes.length}개, 연결 ${model.graph.edges.length}개`;
}
