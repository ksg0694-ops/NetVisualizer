export interface PaydayAccountingPeriod {
  monthKey: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  periodStr: string;
}

export const PAYDAY_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  '2025-10': '2025-10-24',
  '2025-11': '2025-11-25',
  '2025-12': '2025-12-24',
  '2026-01': '2026-01-23',
  '2026-02': '2026-02-25',
  '2026-03': '2026-03-25',
  '2026-04': '2026-04-24',
  '2026-05': '2026-05-22',
  '2026-06': '2026-06-25',
  '2026-07': '2026-07-24',
  '2026-08': '2026-08-25',
  '2026-09': '2026-09-23',
  '2026-10': '2026-10-23',
  '2026-11': '2026-11-25',
  '2026-12': '2026-12-24',
  '2027-01': '2027-01-25',
});

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function monthKey(year: number, month: number): string {
  return `${year}-${pad(month)}`;
}

function shiftDate(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function normalizeDateKey(value: string): string {
  const normalized = String(value || '').trim().replace(/[./]/g, '-').replace(/\s/g, '').replace(/-$/, '');
  const parts = normalized.split('-').map(Number);
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`INVALID_ACCOUNTING_DATE: ${value}`);
  }
  return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
}

export function getPaydayDate(year: number, month: number): string {
  const override = PAYDAY_OVERRIDES[monthKey(year, month)];
  if (override) return override;
  const weekday = new Date(Date.UTC(year, month - 1, 25)).getUTCDay();
  const day = weekday === 6 ? 24 : weekday === 0 ? 23 : 25;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getPaydayAccountingPeriod(value: string): PaydayAccountingPeriod {
  const dateKey = normalizeDateKey(value);
  const [year, month] = dateKey.split('-').map(Number);
  const currentPayday = getPaydayDate(year, month);
  let accountingYear: number;
  let accountingMonth: number;
  let periodStart: string;
  let nextPayday: string;

  if (dateKey >= currentPayday) {
    accountingYear = month === 12 ? year + 1 : year;
    accountingMonth = month === 12 ? 1 : month + 1;
    periodStart = currentPayday;
    nextPayday = getPaydayDate(accountingYear, accountingMonth);
  } else {
    accountingYear = year;
    accountingMonth = month;
    const previousYear = month === 1 ? year - 1 : year;
    const previousMonth = month === 1 ? 12 : month - 1;
    periodStart = getPaydayDate(previousYear, previousMonth);
    nextPayday = currentPayday;
  }

  const periodEnd = shiftDate(nextPayday, -1);
  const [, startMonth, startDay] = periodStart.split('-').map(Number);
  const [, endMonth, endDay] = periodEnd.split('-').map(Number);
  return {
    monthKey: monthKey(accountingYear, accountingMonth),
    title: `${accountingYear}년 ${accountingMonth}월`,
    periodStart,
    periodEnd,
    periodStr: `${startMonth}/${startDay} ~ ${endMonth}/${endDay}`,
  };
}
