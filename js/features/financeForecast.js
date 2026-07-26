(function (window) {
    function median(values = []) {
        const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return 0;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function calculateLinearTrend(values = []) {
        const finiteValues = values.map(Number).filter(Number.isFinite);
        const count = finiteValues.length;
        if (!count) return { slope: 0, fittedLatest: 0 };
        if (count === 1) return { slope: 0, fittedLatest: finiteValues[0] };
        const meanX = (count - 1) / 2;
        const meanY = finiteValues.reduce((sum, value) => sum + value, 0) / count;
        let numerator = 0;
        let denominator = 0;
        finiteValues.forEach((value, index) => {
            numerator += (index - meanX) * (value - meanY);
            denominator += (index - meanX) ** 2;
        });
        const rawSlope = denominator > 0 ? numerator / denominator : 0;
        const typicalIncome = median(finiteValues);
        const slopeLimit = Math.max(1, typicalIncome * 0.03);
        const slope = Math.max(-slopeLimit, Math.min(slopeLimit, rawSlope));
        return {
            slope,
            fittedLatest: Math.max(0, meanY + (slope * ((count - 1) - meanX))),
        };
    }

    function buildSalaryCalendarForecast(
        monthlySalaryValues = [],
        referenceMonthNumber = 12,
        projectedMonthCount = 24,
        bonusMonths = [2, 9],
    ) {
        const salaries = monthlySalaryValues
            .map(Number)
            .filter((value) => Number.isFinite(value) && value > 0);
        const lowestMonthlySalary = salaries.length ? Math.min(...salaries) : 0;
        const annualSalary = lowestMonthlySalary > 0 ? (lowestMonthlySalary / 1.5) * 20 : 0;
        const holidayBonus = annualSalary / 20;
        const normalizedReferenceMonth = Math.max(1, Math.min(12, Number(referenceMonthNumber) || 12));
        const bonusMonthSet = new Set(
            bonusMonths
                .map(Number)
                .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
        );
        const projectedMonthlyIncomes = Array.from(
            { length: Math.max(0, Number(projectedMonthCount) || 0) },
            (_, index) => {
                const monthNumber = ((normalizedReferenceMonth + index) % 12) + 1;
                return lowestMonthlySalary + (bonusMonthSet.has(monthNumber) ? holidayBonus : 0);
            },
        );
        return {
            lowestMonthlySalary,
            annualSalary,
            holidayBonus,
            bonusMonths: Array.from(bonusMonthSet),
            projectedMonthlyIncomes,
        };
    }

    function buildAssetIncomeForecastPath(data, incomeForecast) {
        const values = Array.isArray(data) ? data : [];
        const lastActualIndex = values.reduce(
            (latest, value, index) => (Number.isFinite(Number(value)) && value !== null ? index : latest),
            -1,
        );
        const path = values.map(() => null);
        if (lastActualIndex < 0) {
            return { path, yearEndAsset: 0, averageMonthlyRetained: 0, projectedRetained: [] };
        }
        let currentAsset = Number(values[lastActualIndex] || 0);
        path[lastActualIndex] = currentAsset;
        const finalIndex = values.length - 1;
        const projectedRetained = [];
        if (finalIndex <= lastActualIndex || Number(incomeForecast?.observedMonths || 0) <= 0) {
            return { path, yearEndAsset: currentAsset, averageMonthlyRetained: 0, projectedRetained };
        }
        for (let index = lastActualIndex + 1; index <= finalIndex; index += 1) {
            const monthOffset = index - lastActualIndex;
            const scheduledIncome = Number(incomeForecast?.projectedMonthlyIncomes?.[monthOffset - 1]);
            const forecastIncome = Number.isFinite(scheduledIncome) && scheduledIncome > 0
                ? scheduledIncome
                : Math.max(
                    0,
                    Number(incomeForecast.fittedLatestIncome || 0) + (Number(incomeForecast.incomeSlope || 0) * monthOffset),
                );
            const retained = Math.max(0, forecastIncome * Number(incomeForecast.retentionRate || 0));
            currentAsset += retained;
            projectedRetained.push(retained);
            path[index] = Math.round(currentAsset);
        }
        return {
            path,
            yearEndAsset: Math.round(currentAsset),
            averageMonthlyRetained: projectedRetained.length
                ? projectedRetained.reduce((sum, value) => sum + value, 0) / projectedRetained.length
                : 0,
            projectedRetained,
        };
    }

    window.FinanceForecastFeature = {
        median,
        calculateLinearTrend,
        buildSalaryCalendarForecast,
        buildAssetIncomeForecastPath,
    };
})(window);
