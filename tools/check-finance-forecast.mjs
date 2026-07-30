import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../js/features/financeForecast.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);

const forecast = context.window.FinanceForecastFeature;
assert.ok(forecast, 'FinanceForecastFeature must be exposed');

const flatTrend = forecast.calculateLinearTrend([4_000_000, 4_000_000, 4_000_000]);
assert.equal(flatTrend.slope, 0);
assert.equal(flatTrend.fittedLatest, 4_000_000);

const risingTrend = forecast.calculateLinearTrend([4_000_000, 4_100_000, 4_200_000]);
assert.equal(risingTrend.slope, 100_000);
assert.equal(risingTrend.fittedLatest, 4_200_000);

const salaryCalendar = forecast.buildSalaryCalendarForecast(
    [4_200_000, 3_900_000, 4_600_000],
    7,
    12,
    [2, 9],
);
assert.equal(salaryCalendar.lowestMonthlySalary, 3_900_000);
assert.equal(salaryCalendar.annualSalary, 52_000_000);
assert.equal(salaryCalendar.holidayBonus, 2_600_000);
assert.equal(salaryCalendar.projectedMonthlyIncomes[0], 3_900_000);
assert.equal(salaryCalendar.projectedMonthlyIncomes[1], 6_500_000);
assert.equal(
    salaryCalendar.projectedMonthlyIncomes.reduce((sum, value) => sum + value, 0),
    52_000_000,
);

const flatProjection = forecast.buildAssetIncomeForecastPath(
    [100_000_000, null, null, null],
    {
        observedMonths: 3,
        fittedLatestIncome: 4_000_000,
        incomeSlope: 0,
        retentionRate: 0.5,
    },
);
assert.deepEqual(Array.from(flatProjection.path), [100_000_000, 102_000_000, 104_000_000, 106_000_000]);
assert.equal(flatProjection.yearEndAsset, 106_000_000);
assert.equal(flatProjection.averageMonthlyRetained, 2_000_000);

const scheduledProjection = forecast.buildAssetIncomeForecastPath(
    [100_000_000, null, null, null],
    {
        observedMonths: 3,
        fittedLatestIncome: 9_000_000,
        incomeSlope: 0,
        retentionRate: 0.5,
        projectedMonthlyIncomes: [4_000_000, 6_000_000, 4_000_000],
    },
);
assert.deepEqual(Array.from(scheduledProjection.path), [100_000_000, 102_000_000, 105_000_000, 107_000_000]);
assert.equal(scheduledProjection.yearEndAsset, 107_000_000);

const noObservationProjection = forecast.buildAssetIncomeForecastPath(
    [100_000_000, null],
    { observedMonths: 0, fittedLatestIncome: 0, incomeSlope: 0, retentionRate: 0 },
);
assert.deepEqual(Array.from(noObservationProjection.path), [100_000_000, null]);

const threeYearRoadmap = forecast.buildThreeYearRoadmap(
    100_000_000,
    '2026-07',
    {
        observedMonths: 3,
        fittedLatestIncome: 4_000_000,
        incomeSlope: 0,
        retentionRate: 0.5,
        projectedMonthlyIncomes: Array.from({ length: 36 }, () => 4_000_000),
    },
    36,
);
assert.equal(threeYearRoadmap.months.length, 36);
assert.equal(threeYearRoadmap.checkpoints.length, 3);
assert.equal(threeYearRoadmap.checkpoints[0].monthKey, '2027-07');
assert.equal(threeYearRoadmap.checkpoints[0].projectedAsset, 124_000_000);
assert.equal(threeYearRoadmap.checkpoints[1].projectedAsset, 148_000_000);
assert.equal(threeYearRoadmap.checkpoints[2].projectedAsset, 172_000_000);
assert.equal(threeYearRoadmap.endingAsset, 172_000_000);

console.log('Finance forecast contracts ok');
