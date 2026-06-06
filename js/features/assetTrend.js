(function (window) {
    const DEFAULT_TARGET_GOAL_ASSET = 250000000;
    const DEFAULT_BASELINE_LABEL = '25.12';

    function getHistoryArrays(history = {}) {
        return {
            labels: Array.isArray(history.labels) ? history.labels : [],
            data: Array.isArray(history.data) ? history.data : []
        };
    }

    function getFiniteNumber(value, fallback = 0) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function getBaselineAsset(labels, data, baselineLabel) {
        const baselineIndex = labels.indexOf(baselineLabel);
        if (baselineIndex !== -1) return getFiniteNumber(data[baselineIndex]);
        return getFiniteNumber(data[0]);
    }

    function getCurrentYearParts(currentMonthKey) {
        const currentYear = String(currentMonthKey || '').split('-')[0] || '';
        const shortYear = currentYear.length >= 4 ? currentYear.substring(2) : '';
        const shortYearNumber = Number.parseInt(shortYear, 10);
        return {
            currentYear,
            shortYear,
            shortYearNumber: Number.isFinite(shortYearNumber) ? shortYearNumber : null
        };
    }

    function buildDashboardSeries(labels, data, currentMonthKey) {
        const { shortYear } = getCurrentYearParts(currentMonthKey);
        const yearLabels = [];
        const yearData = [];

        for (let month = 1; month <= 12; month += 1) {
            yearLabels.push(`${month}\uC6D4`);
            const label = `${shortYear}.${String(month).padStart(2, '0')}`;
            const index = labels.indexOf(label);
            yearData.push(index !== -1 ? data[index] : null);
        }

        return { labels: yearLabels, data: yearData };
    }

    function buildFullSeries(labels, data, currentMonthKey, currentAssetFilter) {
        const { shortYearNumber } = getCurrentYearParts(currentMonthKey);
        const allLabels = labels.slice();
        const allData = data.slice();

        if (allLabels.length > 0 && shortYearNumber !== null) {
            const lastLabel = allLabels[allLabels.length - 1];
            const [lastYStr, lastMStr] = String(lastLabel).split('.');
            const lastY = Number.parseInt(lastYStr, 10);
            const lastM = Number.parseInt(lastMStr, 10);

            if (Number.isFinite(lastY) && Number.isFinite(lastM) && lastY <= shortYearNumber) {
                for (let y = lastY; y <= shortYearNumber; y += 1) {
                    const startMonth = y === lastY ? lastM + 1 : 1;
                    for (let m = startMonth; m <= 12; m += 1) {
                        allLabels.push(`${y}.${String(m).padStart(2, '0')}`);
                        allData.push(null);
                    }
                }
            }
        }

        if (currentAssetFilter === 'all') {
            return { labels: allLabels, data: allData };
        }

        const filteredLabels = [];
        const filteredData = [];
        allLabels.forEach((label, index) => {
            if (String(label).startsWith(`${currentAssetFilter}.`)) {
                filteredLabels.push(label);
                filteredData.push(allData[index]);
            }
        });
        return { labels: filteredLabels, data: filteredData };
    }

    function createModel({
        history,
        currentMonthKey,
        currentAssetFilter = 'all',
        currentAsset = 0,
        prevAsset = 0,
        monthIndex = 0,
        targetGoalAsset = DEFAULT_TARGET_GOAL_ASSET,
        baselineLabel = DEFAULT_BASELINE_LABEL
    } = {}) {
        const { labels, data } = getHistoryArrays(history);
        const asset = getFiniteNumber(currentAsset);
        const previousAsset = getFiniteNumber(prevAsset);
        const firstAsset = getFiniteNumber(data[0]);
        const baselineAsset = getBaselineAsset(labels, data, baselineLabel);
        const safeMonthIndex = monthIndex > 0 ? monthIndex : 1;
        const totalAssetGrowth = asset > 0 ? asset - firstAsset : 0;
        const avgMonthlyGrowth = totalAssetGrowth / safeMonthIndex;
        const goalPercentage = asset > 0 && targetGoalAsset > baselineAsset
            ? ((asset - baselineAsset) / (targetGoalAsset - baselineAsset)) * 100
            : 0;
        const { currentYear } = getCurrentYearParts(currentMonthKey);

        return {
            targetGoalAsset,
            currentAsset: asset,
            prevAsset: previousAsset,
            monthDiff: asset - previousAsset,
            totalAssetGrowth,
            avgMonthlyGrowth,
            goalPercentage,
            dashboardTitle: currentYear ? `${currentYear}\uB144 \uC790\uC0B0 \uD750\uB984` : '\uC790\uC0B0 \uD750\uB984',
            dashboardSeries: buildDashboardSeries(labels, data, currentMonthKey),
            fullSeries: buildFullSeries(labels, data, currentMonthKey, currentAssetFilter)
        };
    }

    window.AssetTrendFeature = {
        DEFAULT_TARGET_GOAL_ASSET,
        DEFAULT_BASELINE_LABEL,
        createModel
    };
})(window);
