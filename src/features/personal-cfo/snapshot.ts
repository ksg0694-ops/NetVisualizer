import type { PersonalCfoSnapshot } from './types';

const CURRENT_SCHEMA_VERSION = 3;

const legacySeedIds = {
  budgetBuckets: new Set(['operating', 'defense', 'housing', 'growth', 'humanCapital', 'experience']),
  projects: new Set(['project:changneung', 'project:online-master']),
  risks: new Set(['risk:job-loss', 'risk:interest-rate', 'risk:market-drawdown', 'risk:health', 'risk:liquidity']),
  kpis: new Set([
    'kpi:net-worth',
    'kpi:savings-rate',
    'kpi:free-cash-flow',
    'kpi:fixed-cost-ratio',
    'kpi:emergency-coverage',
    'kpi:debt-ratio',
  ]),
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function items<T extends { id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return clone(value.filter((item) => (
    item && typeof item === 'object' && !Array.isArray(item) && String(item.id || '').trim()
  )) as T[]);
}

function withoutLegacySeeds<T extends { id: string }>(
  values: T[],
  ids: Set<string>,
  schemaVersion: number,
): T[] {
  if (schemaVersion >= CURRENT_SCHEMA_VERSION) return values;
  return values.filter((item) => !ids.has(String(item.id || '')));
}

export function createEmptyPersonalCfoSnapshot(): PersonalCfoSnapshot {
  return {
    person: { id: 'person:me', label: '나' },
    dataSources: [
      {
        id: 'source:portfolio',
        label: '포트폴리오 데이터',
        type: 'portfolioData',
        description: 'Finance 포트폴리오의 현재 계좌, 자산, 부채를 사용합니다.',
      },
      {
        id: 'source:cashflow',
        label: '현금흐름 데이터',
        type: 'financeData',
        description: '최근 종료 급여기간의 거래를 사용합니다.',
      },
    ],
    incomes: [],
    accounts: [],
    assets: [],
    liabilities: [],
    budgetBuckets: [],
    projects: [],
    risks: [],
    kpis: [],
  };
}

export function normalizePersonalCfoPlanSnapshot(
  value: unknown,
  schemaVersion = CURRENT_SCHEMA_VERSION,
): PersonalCfoSnapshot {
  const source = record(value);
  const person = record(source.person);
  const empty = createEmptyPersonalCfoSnapshot();
  return {
    ...empty,
    person: {
      id: String(person.id || empty.person.id),
      label: String(person.label || empty.person.label),
    },
    budgetBuckets: withoutLegacySeeds(
      items<PersonalCfoSnapshot['budgetBuckets'][number]>(source.budgetBuckets),
      legacySeedIds.budgetBuckets,
      schemaVersion,
    ),
    projects: withoutLegacySeeds(
      items<PersonalCfoSnapshot['projects'][number]>(source.projects),
      legacySeedIds.projects,
      schemaVersion,
    ),
    risks: withoutLegacySeeds(
      items<PersonalCfoSnapshot['risks'][number]>(source.risks),
      legacySeedIds.risks,
      schemaVersion,
    ),
    kpis: withoutLegacySeeds(
      items<PersonalCfoSnapshot['kpis'][number]>(source.kpis),
      legacySeedIds.kpis,
      schemaVersion,
    ),
  };
}
