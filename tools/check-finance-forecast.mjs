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

const noObservationProjection = forecast.buildAssetIncomeForecastPath(
    [100_000_000, null],
    { observedMonths: 0, fittedLatestIncome: 0, incomeSlope: 0, retentionRate: 0 },
);
assert.deepEqual(Array.from(noObservationProjection.path), [100_000_000, null]);

console.log('Finance forecast contracts ok');
