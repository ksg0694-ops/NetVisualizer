// Finance summary, asset trend, cashflow rendering, and roadmap helpers extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    function renderAssetTrendDashboardDiff(model) {
        const diffEl = document.getElementById('dashboard-asset-diff');
        if (!diffEl || !model) return;

        if (model.currentAsset === 0) {
            diffEl.innerHTML = `<i class="fas fa-minus"></i> 데이터 없음`;
            diffEl.className = "text-[10px] md:text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap";
        } else if (model.monthDiff >= 0) {
            diffEl.innerHTML = `<i class="fas fa-arrow-up"></i> 전월대비 +${model.monthDiff.toLocaleString()}원`;
            diffEl.className = "text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full whitespace-nowrap";
        } else {
            diffEl.innerHTML = `<i class="fas fa-arrow-down"></i> 전월대비 ${model.monthDiff.toLocaleString()}원`;
            diffEl.className = "text-[10px] md:text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full whitespace-nowrap";
        }
    }

    function renderAssetTrendSummary(model) {
        if (!model) return;

        const goalRemainingEl = document.getElementById('asset-goal-remaining');
        const requiredGrowthEl = document.getElementById('asset-required-growth');
        const reportCurrentAssetEl = document.getElementById('monthly-report-current-asset');
        const reportAssetAsofEl = document.getElementById('monthly-report-asset-asof');
        const reportGoalRemainingEl = document.getElementById('monthly-report-goal-remaining');
        const reportRequiredGrowthEl = document.getElementById('monthly-report-required-growth');
        const reportForecastAssetEl = document.getElementById('monthly-report-forecast-asset');
        const reportForecastMetaEl = document.getElementById('monthly-report-forecast-meta');
        const forecastYearEndEl = document.getElementById('asset-forecast-year-end');
        const forecastRetainedEl = document.getElementById('asset-forecast-retained');
        const forecastMethodEl = document.getElementById('asset-forecast-method');
        const dashboardTitleEl = document.getElementById('dashboard-asset-title');
        const goalMeta = getAssetGoalProgressMeta(model);
        const forecast = model.incomeTrendForecast || {};
        const projection = model.dashboardProjection || {};
        const forecastYearEnd = Number(projection.yearEndAsset || model.currentAsset || 0);
        const forecastGoalGap = Math.max(0, Number(model.targetGoalAsset || 0) - forecastYearEnd);
        const averageRetained = Number(projection.averageMonthlyRetained || 0);
        const forecastMethodText = forecast.observedMonths > 0
            ? `최저 월급 기준 · 설·추석 상여 반영 · 저축+잔여 중앙비율 ${(Number(forecast.retentionRate || 0) * 100).toFixed(1)}%`
            : '예측에 사용할 마감 현금흐름이 부족합니다.';

        if (goalRemainingEl) goalRemainingEl.textContent = formatWon(goalMeta.remaining);
        if (requiredGrowthEl) requiredGrowthEl.textContent = forecastGoalGap > 0
            ? `현재 추세 유지 시 연말 목표까지 ${formatWon(forecastGoalGap)}`
            : '현재 추세 기준 연말 목표 도달';
        if (reportCurrentAssetEl) reportCurrentAssetEl.textContent = formatWon(model.currentAsset);
        if (reportAssetAsofEl) reportAssetAsofEl.textContent = `${currentMonthKey || '현재'} 기준`;
        if (reportGoalRemainingEl) reportGoalRemainingEl.textContent = formatWon(goalMeta.remaining);
        if (reportRequiredGrowthEl) reportRequiredGrowthEl.textContent = forecastGoalGap > 0
            ? `연말 예상 ${formatWon(forecastGoalGap)} 부족`
            : '예상 경로상 목표 도달';
        if (reportForecastAssetEl) reportForecastAssetEl.textContent = formatWon(forecastYearEnd);
        if (reportForecastMetaEl) reportForecastMetaEl.textContent = averageRetained > 0
            ? `월 평균 +${formatWon(averageRetained)}`
            : '예측 데이터 부족';
        if (forecastYearEndEl) forecastYearEndEl.textContent = formatWon(forecastYearEnd);
        if (forecastRetainedEl) forecastRetainedEl.textContent = averageRetained > 0 ? `+${formatWon(averageRetained)}` : '-';
        if (forecastMethodEl) forecastMethodEl.textContent = forecastMethodText;
        if (dashboardTitleEl) dashboardTitleEl.textContent = model.dashboardTitle;
    }

    function getAssetGoalProgressMeta(model) {
        const currentAsset = Number(model?.currentAsset || 0);
        const targetGoalAsset = Number(model?.targetGoalAsset || 250000000);
        const monthNumber = Number(String(currentMonthKey || '').split('-')[1]) || 12;
        const monthsRemaining = Math.max(1, 12 - monthNumber);
        const remaining = Math.max(0, targetGoalAsset - currentAsset);
        return {
            remaining,
            monthsRemaining,
        };
    }

    function calculateLinearTrend(values = []) {
        return window.FinanceForecastFeature.calculateLinearTrend(values);
    }

    function buildIncomeTrendForecast(referenceMonthKey) {
        const observations = getCashFlowPeriods()
            .filter((period) => !referenceMonthKey || period.key <= referenceMonthKey)
            .sort((a, b) => a.key.localeCompare(b.key))
            .map((period) => ({ key: period.key, summary: getCashFlowStructureSummary(period.key) }))
            .filter((item) => Number(item.summary?.totalIncome || 0) > 0);
        const incomes = observations.map((item) => Number(item.summary.totalIncome || 0));
        const monthlySalaries = observations
            .map((item) => Number(item.summary.salaryAllocation?.salaryIncome || item.summary.totalIncome || 0))
            .filter((value) => value > 0);
        const retentionRates = observations
            .map((item) => Number(item.summary.savingAndResidual || 0) / Number(item.summary.totalIncome || 1))
            .filter(Number.isFinite)
            .map((value) => Math.max(0, Math.min(1, value)));
        const trend = calculateLinearTrend(incomes);
        const referenceMonthNumber = Number(String(referenceMonthKey || '').split('-')[1]) || 12;
        const salaryCalendar = window.FinanceForecastFeature.buildSalaryCalendarForecast(
            monthlySalaries,
            referenceMonthNumber,
            24,
            [2, 9],
        );
        return {
            observedMonths: observations.length,
            firstPeriodKey: observations[0]?.key || '',
            lastPeriodKey: observations[observations.length - 1]?.key || '',
            incomeSlope: trend.slope,
            fittedLatestIncome: trend.fittedLatest,
            retentionRate: retentionRates.length ? median(retentionRates) : 0,
            ...salaryCalendar,
        };
    }

    function buildAssetIncomeForecastPath(data, incomeForecast) {
        return window.FinanceForecastFeature.buildAssetIncomeForecastPath(data, incomeForecast);
    }

    function createAssetTrendChartConfig(labels, data, targetGoalAsset, incomeForecast) {
        const goalData = labels.map(() => targetGoalAsset);
        const forecastPathData = buildAssetIncomeForecastPath(data, incomeForecast).path;
        return {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: '내 총 자산',
                        data,
                        spanGaps: false,
                        borderColor: '#4F46E5',
                        backgroundColor: function(context) {
                            const chartArea = context.chart.chartArea;
                            if (!chartArea) return null;
                            const gradient = context.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            gradient.addColorStop(0, 'rgba(79, 70, 229, 0.4)');
                            gradient.addColorStop(1, 'rgba(79, 70, 229, 0.0)');
                            return gradient;
                        },
                        borderWidth: 2,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: '#4F46E5',
                        pointBorderWidth: 2,
                        pointRadius: 3,
                        fill: true,
                        tension: 0.4,
                        order: 1
                    },
                    {
                        label: '자산 예상',
                        data: forecastPathData,
                        spanGaps: true,
                        borderColor: '#64748B',
                        backgroundColor: '#64748B',
                        borderWidth: 2,
                        hoverBorderWidth: 2,
                        borderDash: [7, 6],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 8,
                        fill: false,
                        tension: 0,
                        order: 2
                    },
                    {
                        label: '목표 자산 (2.5억)',
                        data: goalData,
                        borderColor: '#F59E0B',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        pointHitRadius: 0,
                        pointStyle: false,
                        fill: false,
                        order: 3
                    }
                ]
            },
            options: withChartTransitions({
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        ticks: { font: { size: 10 }, callback: function(value) { return Math.floor(value / 10000).toLocaleString() + '만'; } },
                        grid: { borderDash: [5, 5] }
                    },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { usePointStyle: false, boxWidth: 18, boxHeight: 2, font: { size: 10 } } },
                    tooltip: {
                        filter: function(context) {
                            return context.raw !== null && Number.isFinite(Number(context.raw));
                        },
                        callbacks: {
                            label: function(context) {
                                const value = Number(context.raw);
                                return Number.isFinite(value)
                                    ? ` ${context.dataset.label}: ${value.toLocaleString()}원`
                                    : '';
                            }
                        }
                    }
                }
            }, 480)
        };
    }

    function renderAssetTrendCharts(model) {
        if (!model) return;

        if (document.getElementById('dashboardAssetChart')) {
            renderOrUpdateChart(
                'dashAsset',
                'dashboardAssetChart',
                createAssetTrendChartConfig(model.dashboardSeries.labels, model.dashboardSeries.data, model.targetGoalAsset, model.incomeTrendForecast)
            );
        }

        if (document.getElementById('fullAssetChart')) {
            renderOrUpdateChart(
                'fullAsset',
                'fullAssetChart',
                createAssetTrendChartConfig(model.fullSeries.labels, model.fullSeries.data, model.targetGoalAsset, model.incomeTrendForecast)
            );
        }
        if (document.getElementById('monthlyReportAssetChart')) {
            const selectedMonthNumber = Number(String(currentMonthKey || '').split('-')[1]) || 12;
            const reportData = model.dashboardSeries.data.map(
                (value, index) => (index < selectedMonthNumber ? value : null),
            );
            renderOrUpdateChart(
                'monthlyReportAsset',
                'monthlyReportAssetChart',
                createAssetTrendChartConfig(model.dashboardSeries.labels, reportData, model.targetGoalAsset, model.incomeTrendForecast)
            );
        }
    }

    function renderAssetTrend(db) {
        if (!db) return;
        if (!window.AssetTrendFeature || typeof window.AssetTrendFeature.createModel !== 'function') {
            console.warn('AssetTrendFeature module is not loaded.');
            return;
        }

        const model = window.AssetTrendFeature.createModel({
            history: dynamicAssetHistory,
            currentMonthKey,
            currentAssetFilter,
            currentAsset: db.asset,
            prevAsset: db.prevAsset,
            monthIndex: db.monthIndex
        });
        model.incomeTrendForecast = buildIncomeTrendForecast(currentMonthKey);
        model.dashboardProjection = buildAssetIncomeForecastPath(model.dashboardSeries.data, model.incomeTrendForecast);

        renderAssetTrendDashboardDiff(model);
        renderAssetTrendSummary(model);
        renderAssetTrendCharts(model);
        if (typeof updateFinanceRoadmap === 'function') updateFinanceRoadmap(model.currentAsset);
        return model;
    }

    function renderFinanceSummaryKpis({ assetModel, officialSnapshot, periodLabel = '올해' }) {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const setHtml = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };

        setText('finance-period-badge', `${periodLabel} 누적`);

        const currentAsset = Number(officialSnapshot?.netWorth ?? assetModel?.currentAsset ?? 0);
        const targetAsset = Number(assetModel?.targetGoalAsset || 250000000);
        const assetPct = targetAsset > 0 ? Math.max(0, Math.min(100, (currentAsset / targetAsset) * 100)) : 0;
        setHtml('finance-kpi-asset-progress', `<span class="text-amber-500">${assetPct.toFixed(1)}</span>%`);
        setText('finance-kpi-asset-meta', `${formatWon(currentAsset)} / ${formatWon(targetAsset)}`);
        setProgressBar('finance-kpi-asset-bar', assetPct);

        const fundingStatus = getRealEstateFundingStatus();
        const fundingPct = Number(fundingStatus.savedPct || 0);
        setHtml('finance-kpi-funding-progress', `<span class="text-indigo-500">${fundingPct.toFixed(1)}</span>%`);
        setText('finance-kpi-funding-meta', `${formatWon(fundingStatus.selfFunding)} / ${formatWon(fundingStatus.targetBudget)}`);
        setProgressBar('finance-kpi-funding-bar', fundingPct);
    }

    function applyAssetStateForMonth(db, monthKey) {
        const shortYear = monthKey.substring(2, 4);
        const shortMonth = monthKey.substring(5, 7);
        const targetLabel = `${shortYear}.${shortMonth}`;
        const monthIdx = dynamicAssetHistory.labels.indexOf(targetLabel);

        if (monthIdx !== -1) {
            db.asset = dynamicAssetHistory.data[monthIdx];
            db.prevAsset = monthIdx > 0 ? dynamicAssetHistory.data[monthIdx - 1] : 0;
            db.monthIndex = monthIdx;
        } else {
            db.monthIndex = dynamicAssetHistory.data.length - 1;
            db.asset = db.monthIndex >= 0 ? dynamicAssetHistory.data[db.monthIndex] : 0;
            db.prevAsset = db.monthIndex > 0 ? dynamicAssetHistory.data[db.monthIndex - 1] : 0;
        }
    }

    function getCashFlowStats(txData = []) {
        return txData.reduce((acc, item) => {
            if (item.type === '수입') acc.totalIncome += item.amount;
            else if (item.type === '지출') acc.totalExpense += Math.abs(item.amount);
            return acc;
        }, { totalIncome: 0, totalExpense: 0 });
    }

    function getCashFlowPeriods() {
        const repositoryPeriods = typeof window.getFinanceAccountingPeriods === 'function'
            ? window.getFinanceAccountingPeriods()
            : [];
        const periods = repositoryPeriods.length > 0 ? repositoryPeriods : Object.entries(monthlyDB || {}).map(([key, db]) => ({
            key,
            label: db?.title || key,
            startDate: db?.periodStart || '',
            endDate: db?.periodEnd || '',
            transactions: (db?.transactions || []).map((item) => ({
                id: item.id,
                date: item.date,
                time: item.time,
                type: item.type,
                category: item.cat,
                subcategory: item.subcat,
                memo: item.memo,
                amount: Number(item.amount || 0),
                method: item.method,
            })),
        })).filter((period) => period.startDate && period.endDate);
        return window.MonthlyCloseFeature?.applyToPeriods?.(periods) || periods;
    }

    function getCashFlowStructureSummary(periodKey) {
        const period = getCashFlowPeriods().find((item) => item.key === periodKey);
        if (!period || !window.PersonalCfoDomain?.summarizeCashFlowPeriod) return null;
        const summary = window.PersonalCfoDomain.summarizeCashFlowPeriod(period);
        const repayment = Math.max(0, Number(summary.creditLoanInterest || 0) + Number(summary.housingLoanPayment || 0));
        const saving = Math.max(0, Number(summary.savingTransfers || 0));
        const spending = Math.max(0, Number(summary.totalExpense || 0) - repayment);
        const residual = Number(summary.totalIncome || 0) - spending - repayment - saving;
        return {
            ...summary,
            spending,
            repayment,
            saving,
            residual,
            savingAndResidual: saving + residual,
        };
    }

    function renderCashFlowAllocationPanel(structure) {
        const container = document.getElementById('cashflow-allocation-panel');
        if (!container) return;
        if (!structure) {
            container.innerHTML = `
                <div class="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-400 shadow-sm">
                    재무 배분을 계산할 수 있는 월 마감 데이터가 없습니다.
                </div>
            `;
            return;
        }
        const rows = [
            { label: '소비', amount: structure.spending, icon: 'fa-basket-shopping', classes: 'border-rose-100 bg-rose-50 text-rose-700' },
            { label: '상환', amount: structure.repayment, icon: 'fa-building-columns', classes: 'border-red-100 bg-red-50 text-red-700' },
            { label: '저축', amount: structure.saving, icon: 'fa-piggy-bank', classes: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
            { label: '잔여', amount: structure.residual, icon: 'fa-wallet', classes: structure.residual >= 0 ? 'border-lime-100 bg-lime-50 text-lime-700' : 'border-amber-100 bg-amber-50 text-amber-700' },
        ];
        container.innerHTML = `
            <div class="rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
                <div class="grid grid-cols-1 items-stretch gap-1.5 md:grid-cols-[145px_16px_minmax(0,1fr)]">
                    <article class="flex min-h-16 flex-col justify-between rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-blue-700">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-bold">수입</span>
                            <i class="fas fa-arrow-down-to-line text-xs" aria-hidden="true"></i>
                        </div>
                        <p class="mt-1 text-base font-bold">${escapeHtml(formatWon(structure.totalIncome))}</p>
                    </article>
                    <div class="hidden items-center justify-center text-indigo-300 md:flex" aria-hidden="true">
                        <i class="fas fa-arrow-right"></i>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
                        ${rows.map((row) => `
                            <article class="min-w-0 rounded-lg border px-2.5 py-2 ${row.classes}">
                                <div class="flex items-center justify-between gap-2">
                                    <p class="text-[10px] font-bold">${escapeHtml(row.label)}</p>
                                    <i class="fas ${row.icon} text-xs opacity-70" aria-hidden="true"></i>
                                </div>
                                <p class="mt-1 truncate text-sm font-bold">${escapeHtml(formatWon(row.amount))}</p>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function renderMonthlyReportSummary(db, structure) {
        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        const setWidth = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
        };
        setText('monthly-report-period-label', db?.title || currentMonthKey || '-');
        setText('monthly-report-period-range', db?.periodStr || '기간 없음');
        if (!structure) {
            setText('monthly-report-status', '데이터 없음');
            destroyChart('monthlyReportAllocation');
            [
                'monthly-report-income',
                'monthly-report-expense',
                'monthly-report-spending',
                'monthly-report-repayment',
                'monthly-report-saving',
                'monthly-report-residual',
                'monthly-report-saving-residual',
            ].forEach((id) => setText(id, '-'));
            return;
        }

        const income = Math.max(0, Number(structure.totalIncome || 0));
        const shares = {
            spending: income > 0 ? (Number(structure.spending || 0) / income) * 100 : 0,
            repayment: income > 0 ? (Number(structure.repayment || 0) / income) * 100 : 0,
            saving: income > 0 ? (Number(structure.saving || 0) / income) * 100 : 0,
            residual: income > 0 ? (Number(structure.residual || 0) / income) * 100 : 0,
        };
        setText('monthly-report-income', formatWon(structure.totalIncome));
        setText('monthly-report-expense', formatWon(structure.spending));
        setText('monthly-report-spending', formatWon(structure.spending));
        setText('monthly-report-repayment', formatWon(structure.repayment));
        setText('monthly-report-saving', formatWon(structure.saving));
        setText('monthly-report-residual', formatWon(structure.residual));
        setText('monthly-report-saving-residual', formatWon(structure.savingAndResidual));
        setText('monthly-report-spending-share', `${shares.spending.toFixed(0)}%`);
        setText('monthly-report-repayment-share', `${shares.repayment.toFixed(0)}%`);
        setWidth('monthly-report-spending-bar', shares.spending);
        setWidth('monthly-report-repayment-bar', shares.repayment);
        setWidth('monthly-report-saving-bar', shares.saving);
        setWidth('monthly-report-residual-bar', Math.max(0, shares.residual));

        const status = document.getElementById('monthly-report-status');
        if (status) {
            const confirmed = structure.reviewStatus === 'confirmed';
            status.textContent = confirmed ? '마감 완료' : (structure.reviewStatus === 'stale' ? '재확인 필요' : '분류 검토');
            status.className = `rounded-md border px-2 py-1 text-[10px] font-bold ${
                confirmed
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : 'border-amber-100 bg-amber-50 text-amber-700'
            }`;
        }

        if (document.getElementById('monthlyReportAllocationChart')) {
            renderOrUpdateChart('monthlyReportAllocation', 'monthlyReportAllocationChart', {
                type: 'bar',
                plugins: [{
                    id: 'monthlyReportAssetGrowthValue',
                    afterDatasetsDraw: (chart) => {
                        const bar = chart.getDatasetMeta(0)?.data?.[2];
                        const value = Number(chart.data.datasets?.[0]?.data?.[2] || 0);
                        if (!bar || value <= 0) return;
                        const label = `+${Math.round(value / 10000).toLocaleString()}만원`;
                        const { ctx, chartArea } = chart;
                        ctx.save();
                        ctx.fillStyle = '#047857';
                        ctx.font = '700 10px Pretendard, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(label, bar.x, Math.max(chartArea.top + 12, bar.y - 7));
                        ctx.restore();
                    },
                }],
                data: {
                    labels: ['수입', '소비+상환', '저축+잔여'],
                    datasets: [{
                        data: [
                            Number(structure.totalIncome || 0),
                            Number(structure.spending || 0) + Number(structure.repayment || 0),
                            Number(structure.savingAndResidual || 0),
                        ],
                        backgroundColor: ['rgba(59, 130, 246, 0.72)', 'rgba(244, 63, 94, 0.62)', 'rgba(16, 185, 129, 0.72)'],
                        borderRadius: 6,
                        maxBarThickness: 46,
                    }],
                },
                options: withChartTransitions({
                    responsive: true,
                    maintainAspectRatio: false,
                    layout: { padding: { top: 14 } },
                    scales: {
                        x: { grid: { display: false }, ticks: { font: { size: 9, weight: '600' } } },
                        y: {
                            beginAtZero: true,
                            grid: { borderDash: [4, 5] },
                            ticks: { maxTicksLimit: 5, font: { size: 9 }, callback: (value) => Math.round(value / 10000).toLocaleString() },
                        },
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `${context.label}: ${Number(context.raw || 0).toLocaleString()}원`,
                            },
                        },
                    },
                }, 280),
            });
        }
    }

    function renderMonthlyReportPortfolioSummary() {
        const totalElement = document.getElementById('monthly-report-portfolio-total');
        const pricedElement = document.getElementById('monthly-report-portfolio-priced');
        const fxElement = document.getElementById('monthly-report-portfolio-fx');
        const snapshotElement = document.getElementById('monthly-report-portfolio-snapshot');
        if (!totalElement || !dynamicPortfolioData) {
            destroyChart('monthlyReportPortfolio');
            return;
        }
        const cfoModel = window.FinanceModel.buildCfoAssetGroups(dynamicPortfolioData);
        const investmentItems = cfoModel.groups.find((group) => group.key === 'investment')?.items || [];
        const currentValuation = buildCurrentPortfolioValuation(investmentItems);
        const snapshots = typeof window.getPortfolioMonthlySnapshots === 'function'
            ? window.getPortfolioMonthlySnapshots()
            : [];
        const selectedSnapshot = snapshots.find((row) => row.snapshot_month === currentMonthKey);
        const portTotals = selectedSnapshot?.port_totals?.length
            ? selectedSnapshot.port_totals
            : currentValuation.portTotals;
        const totalValue = selectedSnapshot
            ? Number(selectedSnapshot.total_valuation_krw || 0)
            : currentValuation.totalValuationKrw;

        totalElement.textContent = formatWon(totalValue);
        if (pricedElement) {
            const pricedCount = selectedSnapshot
                ? Math.round((Number(selectedSnapshot.price_coverage_pct || 0) / 100) * Number(selectedSnapshot.position_count || 0))
                : currentValuation.marketValuedCount;
            const positionCount = selectedSnapshot
                ? Number(selectedSnapshot.position_count || 0)
                : currentValuation.positionCount;
            pricedElement.textContent = `${pricedCount}/${positionCount}`;
        }
        if (fxElement) {
            const coverage = selectedSnapshot
                ? Number(selectedSnapshot.fx_coverage_pct || 0)
                : currentValuation.fxCoveragePct;
            fxElement.textContent = `${coverage.toFixed(0)}%`;
        }
        if (snapshotElement) {
            snapshotElement.textContent = selectedSnapshot ? `${selectedSnapshot.snapshot_month} 마감` : '현재 기준';
            snapshotElement.className = `rounded px-1.5 py-0.5 text-[9px] font-bold ${
                selectedSnapshot
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
            }`;
        }

        if (!document.getElementById('monthlyReportPortfolioChart')) return;
        renderOrUpdateChart('monthlyReportPortfolio', 'monthlyReportPortfolioChart', {
            type: 'bar',
            data: {
                labels: portTotals.map((port) => port.label || port.key),
                datasets: [{
                    data: portTotals.map((port) => Number(port.valuationKrw || 0)),
                    backgroundColor: portTotals.map((port) => port.color || '#7C3AED'),
                    borderRadius: 5,
                    barThickness: 12,
                }],
            },
            options: withChartTransitions({
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: false, beginAtZero: true },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#64748B', font: { size: 9, weight: 700 } },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${formatWon(context.raw)}`,
                        },
                    },
                },
            }, 360),
        });
    }

    function getFinanceCashFlowContext() {
        const today = window.AppUtils.toLocalDateString();
        const periods = getCashFlowPeriods();
        const summary = window.PersonalCfoDomain?.selectLatestClosedCashFlow(periods, today);
        const latestTransactionDate = periods
            .flatMap((period) => period.transactions.map((item) => item.date))
            .filter(Boolean)
            .sort()
            .pop() || '';
        const staleDays = latestTransactionDate
            ? Math.max(0, Math.floor((Date.parse(`${today}T00:00:00`) - Date.parse(`${latestTransactionDate}T00:00:00`)) / 86400000))
            : null;
        return { periods, summary, latestTransactionDate, staleDays };
    }

    window.getFinanceCashFlowContext = getFinanceCashFlowContext;

    function renderFinanceClosedCashFlow(context) {
        const summary = context?.summary;
        const sourceBadge = document.getElementById('finance-cashflow-source-badge');
        const periodEl = document.getElementById('finance-closed-cashflow-period');
        const freeCashEl = document.getElementById('finance-closed-free-cash');
        const metaEl = document.getElementById('finance-closed-cashflow-meta');
        if (!summary) {
            if (sourceBadge) sourceBadge.textContent = '현금흐름 데이터 없음';
            if (periodEl) periodEl.textContent = '-';
            if (freeCashEl) freeCashEl.textContent = '-';
            if (metaEl) metaEl.textContent = '마감된 기간을 찾지 못했습니다.';
            return;
        }
        if (sourceBadge) {
            const staleText = Number(context.staleDays) >= 7 ? ` · ${context.staleDays}일 전` : '';
            sourceBadge.textContent = `거래 ${context.latestTransactionDate}${staleText}`;
            sourceBadge.className = Number(context.staleDays) >= 7
                ? 'text-[10px] md:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg'
                : 'text-[10px] md:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg';
        }
        const reviewLabel = summary.reviewStatus === 'confirmed'
            ? '분류 확정'
            : (summary.reviewStatus === 'stale' ? '분류 재확인 필요' : '분류 미확정');
        const periodSuffix = summary.reviewStatus === 'confirmed' ? '마감' : '기간 종료';
        if (periodEl) periodEl.textContent = `${summary.periodLabel} ${periodSuffix}`;
        if (freeCashEl) {
            freeCashEl.textContent = formatWon(summary.freeCashFlow);
            freeCashEl.className = `text-base md:text-xl font-bold ${summary.freeCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`;
        }
        if (metaEl) metaEl.textContent = `수입 ${formatWon(summary.totalIncome)} · 지출 ${formatWon(summary.totalExpense)} · ${reviewLabel}`;
    }

    function getOfficialFinanceSnapshot() {
        const syncMeta = typeof getFinanceDataSyncMeta === 'function' ? getFinanceDataSyncMeta() : {};
        const financeData = typeof window.getFinanceDataSnapshot === 'function'
            ? window.getFinanceDataSnapshot()
            : {};
        return window.FinanceModel.buildOfficialSnapshot({
            portfolioRows: financeData.portfolios,
            portfolioData: dynamicPortfolioData,
            assetHistory: dynamicAssetHistory,
            asOf: syncMeta.updatedAt || '',
        });
    }

    window.getOfficialFinanceSnapshot = getOfficialFinanceSnapshot;

    function renderFinanceDecisionInbox({ snapshot, cashFlow, fundingStatus }) {
        const container = document.getElementById('finance-decision-inbox');
        if (!container) return;
        const toneClasses = {
            emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
            amber: 'border-amber-100 bg-amber-50 text-amber-700',
            rose: 'border-rose-100 bg-rose-50 text-rose-700',
            indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
            slate: 'border-gray-200 bg-gray-50 text-gray-700',
        };
        const items = window.FinanceModel.buildDecisionItems({ snapshot, cashFlow, fundingStatus });
        container.innerHTML = items.map((item) => `
            <button type="button" onclick="switchView('${escapeAttr(item.target)}')" class="flex h-full w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition hover:brightness-[0.98] ${toneClasses[item.tone] || toneClasses.slate}">
                <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/70" aria-hidden="true"><i class="fas ${escapeAttr(item.icon)} text-xs"></i></span>
                <span class="min-w-0">
                    <span class="mb-0.5 block text-[9px] font-bold opacity-65">${escapeHtml(item.priorityLabel || '확인')}</span>
                    <span class="block text-[11px] font-bold leading-snug md:text-xs">${escapeHtml(item.title)}</span>
                    <span class="mt-0.5 block text-[10px] leading-snug opacity-75">${escapeHtml(item.detail)}</span>
                </span>
            </button>
        `).join('');
    }

    function getCashFlowCategoryBreakdown(txData = [], type = '지출', limit = 5) {
        const totals = new Map();
        txData.forEach(item => {
            if (item.type !== type) return;
            const category = String(item.cat || item.category || '미분류').trim() || '미분류';
            totals.set(category, (totals.get(category) || 0) + Math.abs(Number(item.amount) || 0));
        });

        const ranked = Array.from(totals.entries())
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);

        if (ranked.length <= limit) return ranked;
        const head = ranked.slice(0, limit - 1);
        const etcAmount = ranked.slice(limit - 1).reduce((sum, item) => sum + item.amount, 0);
        return [...head, { category: '기타', amount: etcAmount }];
    }

    function renderCategoryBreakdownList(containerId, items = [], total = 0, accentClass = 'text-gray-600', options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!items.length || total <= 0) {
            container.innerHTML = '<p class="text-gray-400">표시할 거래가 없습니다.</p>';
            return;
        }

        container.innerHTML = items.map(item => {
            const pct = total > 0 ? (item.amount / total) * 100 : 0;
            if (options.compact) {
                return `
                    <div class="min-w-0">
                        <div class="flex items-center justify-between gap-2">
                            <span class="font-semibold text-gray-600 truncate">${escapeHtml(item.category)}</span>
                            <span class="font-bold ${accentClass} whitespace-nowrap">${pct.toFixed(0)}%</span>
                        </div>
                        <div class="text-gray-400 truncate">${formatWon(item.amount)}</div>
                    </div>
                `;
            }

            return `
                <div class="min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-semibold text-gray-600 truncate">${escapeHtml(item.category)}</span>
                        <span class="font-bold ${accentClass} whitespace-nowrap">${pct.toFixed(0)}%</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 text-gray-400">
                        <span class="truncate">${formatWon(item.amount)}</span>
                        <span>${item.amount.toLocaleString()}원</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function createCategoryDoughnutConfig(items = [], colors = []) {
        return {
            type: 'doughnut',
            data: {
                labels: items.map(item => item.category),
                datasets: [{
                    data: items.map(item => item.amount),
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 3
                }]
            },
            options: withChartTransitions({
                responsive: true,
                maintainAspectRatio: false,
                cutout: '64%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${Number(context.raw || 0).toLocaleString()}원`;
                            }
                        }
                    }
                }
            }, 360)
        };
    }

    function renderCategoryDoughnutBlock({ chartKey, chartId, listId, chartItems, listItems, total, colors, accentClass, compact = false }) {
        const chartData = chartItems || [];
        const listData = listItems || chartData;
        if (chartData.length && document.getElementById(chartId)) {
            renderOrUpdateChart(chartKey, chartId, createCategoryDoughnutConfig(chartData, colors));
        } else {
            destroyChart(chartKey);
        }

        renderCategoryBreakdownList(listId, listData, total, accentClass, { compact });
    }

    function expandChartColors(colors = [], count = 0) {
        if (!colors.length) return [];
        return Array.from({ length: count }, (_, idx) => colors[idx % colors.length]);
    }

    function isRepaymentExpense(item = {}) {
        if (item.type !== '지출') return false;
        const classification = `${item.cat || item.category || ''} ${item.subcat || item.subcategory || ''}`;
        return /상환/u.test(classification);
    }

    function renderCashFlowCategoryAnalysis(txData = []) {
        const incomeDetailItems = getCashFlowCategoryBreakdown(txData, '수입', Number.MAX_SAFE_INTEGER);
        const consumptionTxData = txData.filter((item) => !isRepaymentExpense(item));
        const expenseDetailItems = getCashFlowCategoryBreakdown(consumptionTxData, '지출', Number.MAX_SAFE_INTEGER);
        const incomeMainItems = incomeDetailItems.slice(0, 3);
        const expenseMainItems = expenseDetailItems.slice(0, 3);
        const incomeTotal = incomeDetailItems.reduce((sum, item) => sum + item.amount, 0);
        const expenseTotal = expenseDetailItems.reduce((sum, item) => sum + item.amount, 0);
        const incomeColors = ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#BFDBFE'];
        const expenseColors = ['#EF4444', '#F97316', '#F59E0B', '#EC4899', '#FCA5A5'];

        [
            ['cashflowIncomeCategory', 'cashflow-income-category-chart', 'cashflow-income-category-list', incomeDetailItems],
            ['cashflowMainIncomeCategory', 'cashflow-main-income-category-chart', 'cashflow-main-income-category-list', incomeMainItems],
            ['monthlyReportIncomeCategory', 'monthly-report-income-category-chart', 'monthly-report-income-category-list', incomeMainItems]
        ].forEach(([chartKey, chartId, listId, items]) => {
            renderCategoryDoughnutBlock({
                chartKey,
                chartId,
                listId,
                chartItems: incomeDetailItems,
                listItems: items,
                total: incomeTotal,
                colors: expandChartColors(incomeColors, incomeDetailItems.length),
                accentClass: 'text-blue-600',
                compact: chartKey.includes('Main') || chartKey.includes('monthlyReport')
            });
        });

        [
            ['cashflowExpenseCategory', 'cashflow-expense-category-chart', 'cashflow-expense-category-list', expenseDetailItems],
            ['cashflowMainExpenseCategory', 'cashflow-main-expense-category-chart', 'cashflow-main-expense-category-list', expenseMainItems],
            ['monthlyReportExpenseCategory', 'monthly-report-expense-category-chart', 'monthly-report-expense-category-list', expenseMainItems]
        ].forEach(([chartKey, chartId, listId, items]) => {
            renderCategoryDoughnutBlock({
                chartKey,
                chartId,
                listId,
                chartItems: expenseDetailItems,
                listItems: items,
                total: expenseTotal,
                colors: expandChartColors(expenseColors, expenseDetailItems.length),
                accentClass: 'text-red-600',
                compact: chartKey.includes('Main') || chartKey.includes('monthlyReport')
            });
        });
    }

    function getLocalTodayParts() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return {
            year,
            month,
            day: Number(day),
            monthKey: `${year}-${month}`,
            dateKey: `${year}-${month}-${day}`,
            date: new Date(year, now.getMonth(), Number(day))
        };
    }

    function getCashFlowPeriodRange(monthKey) {
        const [yearText, monthText] = String(monthKey || '').split('-');
        const year = Number(yearText);
        const month = Number(monthText);
        if (!year || !month) return null;

        const previousYear = month === 1 ? year - 1 : year;
        const previousMonth = month === 1 ? 12 : month - 1;
        const startKey = getPayday(previousYear, previousMonth);
        const nextPaydayKey = getPayday(year, month);
        const endDate = new Date(`${nextPaydayKey}T00:00:00`);
        endDate.setDate(endDate.getDate() - 1);
        const endKey = [
            endDate.getFullYear(),
            String(endDate.getMonth() + 1).padStart(2, '0'),
            String(endDate.getDate()).padStart(2, '0')
        ].join('-');
        return { startKey, endKey };
    }

    function getScheduledDatesInRange(payDay, startKey, endKey) {
        const dates = [];
        const start = new Date(`${startKey}T00:00:00`);
        const end = new Date(`${endKey}T00:00:00`);
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

        while (cursor <= endMonth) {
            const year = cursor.getFullYear();
            const month = cursor.getMonth() + 1;
            const lastDay = new Date(year, month, 0).getDate();
            const dueDay = Math.min(Number(payDay), lastDay);
            const dueKey = `${year}-${String(month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
            if (dueKey >= startKey && dueKey <= endKey) dates.push(dueKey);
            cursor.setMonth(cursor.getMonth() + 1);
        }

        return dates;
    }

    function getAllCashFlowTransactions() {
        return Object.values(monthlyDB || {}).flatMap(db => db?.transactions || []);
    }

    function isFixedCostTransaction(tx) {
        return tx?.type === '지출' && String(tx.cat || '').trim() === '고정비';
    }

    function isInsurancePaidForDueDate(ins, dueDateKey, amount) {
        const dueMonth = String(dueDateKey || '').slice(0, 7);
        const description = String(ins.description || ins.name || '').trim();
        const company = String(ins.company || '').trim();
        const category = String(ins.category || '').trim();
        return getAllCashFlowTransactions().some(tx => {
            if (tx.type !== '지출' || String(tx.date || '').slice(0, 7) !== dueMonth) return false;
            const amountDiff = Math.abs(Math.abs(Number(tx.amount) || 0) - amount);
            if (amountDiff > 2) return false;
            const txText = `${tx.cat || ''} ${tx.subcat || ''} ${tx.memo || ''} ${tx.method || ''}`;
            return String(tx.subcat || '').includes('보험')
                || (description && txText.includes(description))
                || (company && txText.includes(company))
                || (category && txText.includes(category));
        });
    }

    function getRemainingFixedCostItems(monthKey, txData = []) {
        const today = getLocalTodayParts();
        const todayPeriod = getMonthKeyAndPeriod(today.dateKey);
        const period = getCashFlowPeriodRange(monthKey);
        if (!period) return { isCurrentPeriod: false, items: [], total: 0, paidTotal: 0, scheduledTotal: 0 };

        const paidItems = txData
            .filter(isFixedCostTransaction)
            .map(tx => ({
                label: String(tx.memo || tx.subcat || '고정비').trim(),
                meta: `${tx.subcat || '고정비'} · ${tx.date}${tx.method ? ` · ${tx.method}` : ''}`,
                amount: Math.abs(Number(tx.amount) || 0),
                dueDateKey: tx.date,
                status: 'paid'
            }));

        const isCurrentPeriod = monthKey === todayPeriod.monthKey;
        const scheduledItems = isCurrentPeriod ? (addonInsurances || []).flatMap(ins => {
            const payDay = Number(ins.pay_day || ins.payDay || 0);
            const amount = Math.abs(Number(ins.monthly_payment || ins.monthlyPayment || 0));
            if (!payDay || !amount) return [];

            const start = ins.start_date ? String(ins.start_date).slice(0, 10) : '';
            const end = ins.end_date ? String(ins.end_date).slice(0, 10) : '';
            const description = String(ins.description || ins.name || '보험료').trim();
            const company = String(ins.company || '').trim();

            return getScheduledDatesInRange(payDay, period.startKey, period.endKey)
                .filter(dueDateKey => (!start || dueDateKey >= start) && (!end || dueDateKey <= end))
                .filter(dueDateKey => !isInsurancePaidForDueDate(ins, dueDateKey, amount))
                .map(dueDateKey => {
                    const dueDate = new Date(`${dueDateKey}T00:00:00`);
                    const diffDays = Math.ceil((dueDate - today.date) / 86400000);
                    return {
                        label: description,
                        meta: `${company || '보험'} · ${dueDateKey}`,
                        amount,
                        dueDateKey,
                        diffDays,
                        status: diffDays < 0 ? 'overdue' : 'scheduled'
                    };
                });
        }) : [];

        const items = [...paidItems, ...scheduledItems]
            .sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey) || a.label.localeCompare(b.label, 'ko-KR'));
        const paidTotal = paidItems.reduce((sum, item) => sum + item.amount, 0);
        const scheduledTotal = scheduledItems.reduce((sum, item) => sum + item.amount, 0);

        return {
            isCurrentPeriod,
            items,
            total: paidTotal + scheduledTotal,
            paidTotal,
            scheduledTotal
        };
    }

    function renderRemainingFixedCosts(monthKey, txData = []) {
        const panel = document.getElementById('cashflow-fixed-due-panel');
        const list = document.getElementById('cashflow-fixed-due-list');
        const totalEl = document.getElementById('cashflow-fixed-due-total');
        if (!panel || !list || !totalEl) return;

        const result = getRemainingFixedCostItems(monthKey, txData);
        totalEl.textContent = formatWon(result.total);

        panel.className = result.items.length
            ? 'border border-amber-100 rounded-xl p-3 min-w-0 bg-amber-50/30'
            : 'border border-gray-100 rounded-xl p-3 min-w-0 bg-white';

        if (!result.items.length) {
            list.innerHTML = '<p class="text-gray-400">고정비로 분류된 지출이나 남은 납입 예정이 없습니다.</p>';
            return;
        }

        list.innerHTML = result.items.map(item => `
            <div class="flex items-center justify-between gap-2 bg-white border ${item.status === 'overdue' ? 'border-rose-100' : 'border-amber-100'} rounded-lg px-2.5 py-1.5">
                <div class="min-w-0">
                    <p class="font-bold text-gray-700 truncate">${escapeHtml(item.label)}</p>
                    <p class="text-gray-400 truncate">${escapeHtml(item.meta)} · ${
                        item.status === 'paid'
                            ? '반영됨'
                            : (item.status === 'overdue' ? '확인 필요' : (item.diffDays === 0 ? '오늘 예정' : `D-${item.diffDays}`))
                    }</p>
                </div>
                <span class="font-bold ${item.status === 'overdue' ? 'text-rose-700' : 'text-amber-700'} whitespace-nowrap">${formatWon(item.amount)}</span>
            </div>
        `).join('');
    }

    function getYearMonthKeys(referenceMonthKey) {
        const referenceKey = referenceMonthKey || getLatestMonthKey();
        const year = String(referenceKey || '').slice(0, 4);
        if (!/^\d{4}$/.test(year)) return getMonthKeys();
        const keys = getMonthKeys().filter(key => key.startsWith(`${year}-`));
        return keys.length ? keys : getMonthKeys();
    }

    const REAL_ESTATE_ANALYSIS_STORAGE_KEY = 'smartbook_v2_realestate_analysis_v1';
    const REAL_ESTATE_ANALYSIS_DEFAULTS = {
        targetName: '고양창릉 S2/S3/S4',
        targetBudget: 800000000,
        annualIncome: null,
        existingMonthlyDebt: null,
        mortgageRatePct: 4.5,
        stressRatePct: 1.5,
        termYears: 30,
        dsrLimitPct: 40
    };
    let realEstateAnalysisOverrides = null;

    function getYearToDateCashFlowStats(referenceMonthKey) {
        const year = String(referenceMonthKey || getLatestMonthKey()).slice(0, 4);
        return getYearMonthKeys(referenceMonthKey)
            .reduce((acc, key) => {
                const stats = getCashFlowStats(monthlyDB[key]?.transactions || []);
                acc.totalIncome += stats.totalIncome;
                acc.totalExpense += stats.totalExpense;
                return acc;
            }, { year, totalIncome: 0, totalExpense: 0 });
    }

    function parseAssumptionNumber(value, fallback = 0) {
        const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(number) ? number : fallback;
    }

    function wonToManwon(value) {
        return Math.round((Number(value) || 0) / 10000);
    }

    function manwonToWon(value) {
        return Math.max(0, Math.round(parseAssumptionNumber(value) * 10000));
    }

    function clampPct(value, fallback) {
        const number = parseAssumptionNumber(value, fallback);
        return Math.max(0, Math.min(100, Number.isFinite(number) ? number : fallback));
    }

    function median(values = []) {
        const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
        if (!sorted.length) return 0;
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    function getYearCashFlowRunRate(referenceMonthKey) {
        const monthKey = referenceMonthKey || getLatestMonthKey();
        const year = String(monthKey || '').slice(0, 4);
        const today = window.AppUtils.toLocalDateString();
        const periods = getCashFlowPeriods()
            .filter(period => period.key.startsWith(`${year}-`)
                && (!monthKey || period.key <= monthKey)
                && period.endDate < today)
            .sort((a, b) => a.key.localeCompare(b.key));

        const stats = periods.reduce((acc, period) => {
            const monthStats = getCashFlowStats(period.transactions);
            acc.totalIncome += monthStats.totalIncome;
            acc.totalExpense += monthStats.totalExpense;
            return acc;
        }, { totalIncome: 0, totalExpense: 0 });

        const regularMonthlyIncomes = periods.map((period) => period.transactions
            .filter(item => item.type === '수입'
                && Number(item.amount) > 0
                && !/성과|상여|보너스|인센티브/i.test(`${item.category || ''} ${item.subcategory || ''} ${item.memo || ''}`))
            .reduce((sum, item) => sum + Number(item.amount || 0), 0))
            .filter(value => value > 0);
        const monthlyFreeCashFlows = periods.map((period) => {
            const monthStats = getCashFlowStats(period.transactions);
            return monthStats.totalIncome - monthStats.totalExpense;
        });
        const observedMonths = Math.max(1, periods.length);
        const avgMonthlyIncome = stats.totalIncome / observedMonths;
        const avgMonthlySaving = median(monthlyFreeCashFlows);
        const regularMonthlyIncome = median(regularMonthlyIncomes) || avgMonthlyIncome;

        return {
            year,
            observedMonths,
            periodKeys: periods.map(period => period.key),
            totalIncome: stats.totalIncome,
            totalExpense: stats.totalExpense,
            avgMonthlyIncome,
            avgMonthlySaving,
            regularMonthlyIncome,
            annualizedIncome: Math.round(regularMonthlyIncome * 12)
        };
    }

    function loadRealEstateAnalysisOverrides() {
        if (realEstateAnalysisOverrides) return realEstateAnalysisOverrides;
        try {
            realEstateAnalysisOverrides = JSON.parse(localStorage.getItem(REAL_ESTATE_ANALYSIS_STORAGE_KEY) || '{}') || {};
        } catch (error) {
            realEstateAnalysisOverrides = {};
        }
        return realEstateAnalysisOverrides;
    }

    function getRealEstateAnalysisAssumptions() {
        const overrides = loadRealEstateAnalysisOverrides();
        const runRate = getYearCashFlowRunRate(currentMonthKey);
        const latestClosedCashFlow = getFinanceCashFlowContext().summary;
        const annualIncome = overrides.annualIncome ?? REAL_ESTATE_ANALYSIS_DEFAULTS.annualIncome ?? runRate.annualizedIncome;
        const existingMonthlyDebt = overrides.existingMonthlyDebt
            ?? REAL_ESTATE_ANALYSIS_DEFAULTS.existingMonthlyDebt
            ?? latestClosedCashFlow?.debtRepayment
            ?? 0;

        return {
            targetName: String(overrides.targetName || REAL_ESTATE_ANALYSIS_DEFAULTS.targetName).trim() || REAL_ESTATE_ANALYSIS_DEFAULTS.targetName,
            targetBudget: Math.max(0, Number(overrides.targetBudget ?? REAL_ESTATE_ANALYSIS_DEFAULTS.targetBudget) || 0),
            annualIncome: Math.max(0, Number(annualIncome) || 0),
            existingMonthlyDebt: Math.max(0, Number(existingMonthlyDebt) || 0),
            mortgageRatePct: Math.max(0, Number(overrides.mortgageRatePct ?? REAL_ESTATE_ANALYSIS_DEFAULTS.mortgageRatePct) || 0),
            stressRatePct: Math.max(0, Number(overrides.stressRatePct ?? REAL_ESTATE_ANALYSIS_DEFAULTS.stressRatePct) || 0),
            termYears: Math.max(1, Number(overrides.termYears ?? REAL_ESTATE_ANALYSIS_DEFAULTS.termYears) || 30),
            dsrLimitPct: REAL_ESTATE_ANALYSIS_DEFAULTS.dsrLimitPct
        };
    }

    function saveRealEstateAnalysisAssumptions(assumptions) {
        realEstateAnalysisOverrides = { ...assumptions };
        localStorage.setItem(REAL_ESTATE_ANALYSIS_STORAGE_KEY, JSON.stringify(realEstateAnalysisOverrides));
    }

    function readRealEstateAnalysisForm() {
        return {
            targetName: String(document.getElementById('re-input-target-name')?.value || REAL_ESTATE_ANALYSIS_DEFAULTS.targetName).trim(),
            targetBudget: manwonToWon(document.getElementById('re-input-target-budget')?.value),
            annualIncome: manwonToWon(document.getElementById('re-input-annual-income')?.value),
            existingMonthlyDebt: manwonToWon(document.getElementById('re-input-existing-debt')?.value),
            mortgageRatePct: Math.max(0, parseAssumptionNumber(document.getElementById('re-input-rate')?.value, REAL_ESTATE_ANALYSIS_DEFAULTS.mortgageRatePct)),
            stressRatePct: Math.max(0, parseAssumptionNumber(document.getElementById('re-input-stress-rate')?.value, REAL_ESTATE_ANALYSIS_DEFAULTS.stressRatePct)),
            termYears: Math.max(1, parseAssumptionNumber(document.getElementById('re-input-term-years')?.value, REAL_ESTATE_ANALYSIS_DEFAULTS.termYears)),
            dsrLimitPct: REAL_ESTATE_ANALYSIS_DEFAULTS.dsrLimitPct
        };
    }

    function bindRealEstateAnalysisControls() {
        const ids = [
            're-input-target-name',
            're-input-target-budget',
            're-input-annual-income',
            're-input-existing-debt',
            're-input-rate',
            're-input-stress-rate',
            're-input-term-years'
        ];
        ids.forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            const handleInput = () => {
                saveRealEstateAnalysisAssumptions(readRealEstateAnalysisForm());
                renderRealEstateAnalysis();
                if (typeof updateFinanceRoadmap === 'function') updateFinanceRoadmap(monthlyDB[currentMonthKey]?.asset || 0);
            };
            input.oninput = handleInput;
            input.onchange = handleInput;
        });

        const settingsBtn = document.getElementById('re-analysis-settings');
        if (settingsBtn) settingsBtn.onclick = openRealEstateAssumptionModal;

        const resetBtn = document.getElementById('re-analysis-reset');
        if (resetBtn) {
            resetBtn.onclick = () => {
                realEstateAnalysisOverrides = {};
                localStorage.removeItem(REAL_ESTATE_ANALYSIS_STORAGE_KEY);
                renderRealEstateAnalysis();
                if (typeof updateFinanceRoadmap === 'function') updateFinanceRoadmap(monthlyDB[currentMonthKey]?.asset || 0);
                showToast('청약 자금 분석 가정을 기본값으로 되돌렸습니다.', 'info');
            };
        }
    }

    function getAnnuityFactor(annualRatePct, termYears) {
        const months = Math.max(1, Math.round((Number(termYears) || 1) * 12));
        const monthlyRate = Math.max(0, Number(annualRatePct) || 0) / 100 / 12;
        if (monthlyRate === 0) return 1 / months;
        return monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
    }

    function calculateMortgageMonthlyPayment(principal, annualRatePct, termYears) {
        const amount = Math.max(0, Number(principal) || 0);
        if (!amount) return 0;
        return amount * getAnnuityFactor(annualRatePct, termYears);
    }

    function getRealEstateDebtCapacity(assumptions) {
        const stressedRatePct = assumptions.mortgageRatePct + assumptions.stressRatePct;
        const monthlyDsrCapacity = assumptions.annualIncome > 0
            ? Math.max(0, (assumptions.annualIncome * (assumptions.dsrLimitPct / 100) / 12) - assumptions.existingMonthlyDebt)
            : 0;
        const maxLoanByDsr = monthlyDsrCapacity > 0
            ? monthlyDsrCapacity / getAnnuityFactor(stressedRatePct, assumptions.termYears)
            : 0;
        return { stressedRatePct, monthlyDsrCapacity, maxLoanByDsr };
    }

    function getRealEstateAnalysisModel() {
        const assumptions = getRealEstateAnalysisAssumptions();
        const funding = getRealEstateFundingStatus();
        const runRate = getYearCashFlowRunRate(currentMonthKey);
        const debtCapacity = getRealEstateDebtCapacity(assumptions);
        const plannedLoan = funding.expectedLoan;
        const monthlyPayment = calculateMortgageMonthlyPayment(plannedLoan, assumptions.mortgageRatePct, assumptions.termYears);
        const stressedMonthlyPayment = calculateMortgageMonthlyPayment(plannedLoan, debtCapacity.stressedRatePct, assumptions.termYears);
        const annualDebtService = (stressedMonthlyPayment + assumptions.existingMonthlyDebt) * 12;
        const dsrPct = assumptions.annualIncome > 0 ? (annualDebtService / assumptions.annualIncome) * 100 : 0;
        const requiredEquity = Math.max(0, assumptions.targetBudget - plannedLoan);
        const equityShortfall = Math.max(0, requiredEquity - funding.selfFunding);
        const totalShortfall = Math.max(0, assumptions.targetBudget - funding.totalReady);
        const loanCapacityGap = Math.max(0, funding.fundingGapBeforeLoan - debtCapacity.maxLoanByDsr);
        const monthsToReady = equityShortfall > 0 && runRate.avgMonthlySaving > 0
            ? Math.ceil(equityShortfall / runRate.avgMonthlySaving)
            : null;

        const model = {
            assumptions,
            funding,
            runRate,
            plannedLoan,
            stressedRatePct: debtCapacity.stressedRatePct,
            monthlyPayment,
            stressedMonthlyPayment,
            annualDebtService,
            dsrPct,
            monthlyDsrCapacity: debtCapacity.monthlyDsrCapacity,
            maxLoanByDsr: debtCapacity.maxLoanByDsr,
            loanCapacityGap,
            requiredEquity,
            equityShortfall,
            totalShortfall,
            monthsToReady
        };
        return model;
    }

    function setInputValue(id, value) {
        const input = document.getElementById(id);
        if (input && document.activeElement !== input) input.value = value;
    }

    function setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setElementHtml(id, html) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
    }

    function setElementWidth(id, percentage) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.width = `${Math.max(0, Math.min(100, Number(percentage) || 0))}%`;
    }

    function renderRealEstateAnalysis() {
        const model = getRealEstateAnalysisModel();
        const { assumptions, funding, runRate } = model;
        bindRealEstateAnalysisControls();

        setInputValue('re-input-target-name', assumptions.targetName);
        setInputValue('re-input-target-budget', wonToManwon(assumptions.targetBudget));
        setInputValue('re-input-annual-income', wonToManwon(assumptions.annualIncome));
        setInputValue('re-input-existing-debt', wonToManwon(assumptions.existingMonthlyDebt));
        setInputValue('re-input-rate', assumptions.mortgageRatePct);
        setInputValue('re-input-stress-rate', assumptions.stressRatePct);
        setInputValue('re-input-term-years', assumptions.termYears);
        setInputValue('re-input-dsr-limit', assumptions.dsrLimitPct);

        setElementText('re-total-ready', formatWon(funding.totalReady));
        setElementText('re-target-budget-label', `/ 목표 ${formatWon(assumptions.targetBudget)}`);
        setElementWidth('re-progress-saved', funding.savedPct);
        setElementText('re-progress-saved', funding.savedPct > 5 ? '모은돈' : '');
        setElementWidth('re-progress-loan', Math.min(100 - funding.savedPct, funding.loanPct));
        setElementText('re-saved-text', `자기자금: ${formatWon(funding.selfFunding)}`);
        setElementText('re-progress-text', `총 ${funding.totalPct.toFixed(1)}% 달성`);
        setElementText('re-assumption-text', `DSR ${assumptions.dsrLimitPct.toFixed(0)}% 기준 자동대출`);

        setElementText('re-analysis-target-name', assumptions.targetName);
        setElementText('re-analysis-target-budget', formatWon(assumptions.targetBudget));
        setElementText('re-analysis-planned-loan', model.plannedLoan > 0 ? formatWon(model.plannedLoan) : '대출 여력 없음');
        setElementText('re-analysis-monthly-payment', formatWon(model.monthlyPayment));
        setElementText('re-analysis-stressed-payment', formatWon(model.stressedMonthlyPayment));
        setElementText('re-analysis-max-loan', model.maxLoanByDsr > 0 ? formatWon(model.maxLoanByDsr) : '소득 가정 필요');
        setElementText('re-analysis-dsr', assumptions.annualIncome > 0 ? `${model.dsrPct.toFixed(1)}%` : '미입력');
        setElementWidth('re-analysis-dsr-bar', assumptions.annualIncome > 0 ? (model.dsrPct / Math.max(1, assumptions.dsrLimitPct)) * 100 : 0);

        const dsrBar = document.getElementById('re-analysis-dsr-bar');
        if (dsrBar) {
            dsrBar.className = `h-full transition-all duration-500 ${model.dsrPct > assumptions.dsrLimitPct ? 'bg-rose-500' : (model.dsrPct > assumptions.dsrLimitPct * 0.85 ? 'bg-amber-500' : 'bg-emerald-500')}`;
        }

        setElementText('re-analysis-income-meta', `마감 ${runRate.observedMonths}개월 급여 중앙값 연환산 ${formatWon(assumptions.annualIncome)} · 최근 월 원리금 ${formatWon(assumptions.existingMonthlyDebt)}`);

        const totalCapacity = Math.max(0, funding.selfFunding + model.maxLoanByDsr);
        const totalCapacityPct = assumptions.targetBudget > 0
            ? Math.min(100, (totalCapacity / assumptions.targetBudget) * 100)
            : 0;
        setElementText('long-goal-self-funding', formatWon(funding.selfFunding));
        setElementText('long-goal-mortgage-capacity', model.maxLoanByDsr > 0 ? formatWon(model.maxLoanByDsr) : '소득 가정 필요');
        setElementText('long-goal-total-funding', formatWon(totalCapacity));
        setElementText('long-goal-total-percent', `${totalCapacityPct.toFixed(1)}%`);
        setElementWidth('long-goal-total-bar', totalCapacityPct);
        setElementText('long-goal-dsr', assumptions.annualIncome > 0 ? `${model.dsrPct.toFixed(1)}% / ${assumptions.dsrLimitPct.toFixed(0)}%` : '미입력');
        setElementText(
            'long-goal-income-meta',
            `연소득 ${formatWon(assumptions.annualIncome)} · 기존 월 원리금 ${formatWon(assumptions.existingMonthlyDebt)} · 스트레스 ${model.stressedRatePct.toFixed(1)}%`,
        );
    }

    function openRealEstateAssumptionModal() {
        renderRealEstateAnalysis();
        document.getElementById('re-analysis-modal')?.classList.remove('hidden');
    }

    function closeRealEstateAssumptionModal() {
        document.getElementById('re-analysis-modal')?.classList.add('hidden');
    }

    function applyRealEstateAssumptionModal() {
        saveRealEstateAnalysisAssumptions(readRealEstateAnalysisForm());
        renderRealEstateAnalysis();
        closeRealEstateAssumptionModal();
        showToast('청약 자금 분석 가정을 적용했습니다.', 'info');
    }

    function renderFinanceSummary() {
        if(!currentMonthKey || !monthlyDB[currentMonthKey]) return;
        const db = monthlyDB[currentMonthKey];
        applyAssetStateForMonth(db, currentMonthKey);

        const { year } = getYearToDateCashFlowStats(currentMonthKey);
        const officialSnapshot = getOfficialFinanceSnapshot();
        const sourceBadge = document.getElementById('finance-data-source-badge');
        if (sourceBadge) sourceBadge.textContent = window.FinanceModel.getSourceBadge(officialSnapshot);

        if (document.getElementById('card-asset')) document.getElementById('card-asset').textContent = `${officialSnapshot.netWorth.toLocaleString()}원`;

        const assetModel = renderAssetTrend(db);
        renderFinanceSummaryKpis({ assetModel, officialSnapshot, periodLabel: `${year}년` });
        const fundingStatus = getRealEstateFundingStatus();
        const cashFlowContext = getFinanceCashFlowContext();
        renderFinanceClosedCashFlow(cashFlowContext);
        renderFinanceDecisionInbox({
            snapshot: officialSnapshot,
            cashFlow: cashFlowContext.summary
                ? { ...cashFlowContext.summary, staleDays: cashFlowContext.staleDays, latestTransactionDate: cashFlowContext.latestTransactionDate }
                : getCashFlowStats(db.transactions),
            fundingStatus,
        });
        renderRealEstateAnalysis();
        updateFinanceRoadmap(officialSnapshot.netWorth);
    }

    function renderCashFlow() {
        if(!currentMonthKey || !monthlyDB[currentMonthKey]) return;
        const db = monthlyDB[currentMonthKey];
        const sourceTxData = db.transactions;
        const txData = window.MonthlyCloseFeature?.getEffectiveTransactions?.(
            currentMonthKey,
            sourceTxData,
            { includeDraft: true },
        ) || sourceTxData;

        const displayMonth = document.getElementById('display-month');
        const displayPeriod = document.getElementById('display-period');
        const manageTitle = document.getElementById('manage-title');
        if (displayMonth) displayMonth.textContent = db.title;
        if (displayPeriod) displayPeriod.textContent = db.periodStr;
        if (manageTitle) manageTitle.textContent = `${db.title} 거래 내역`;
        window.MonthlyCloseFeature?.render?.({
            periodKey: currentMonthKey,
            period: {
                key: currentMonthKey,
                label: db.title,
                startDate: db.periodStart,
                endDate: db.periodEnd,
            },
            transactions: sourceTxData,
        });

        const { totalIncome, totalExpense } = getCashFlowStats(txData);
        const cashFlowStructure = getCashFlowStructureSummary(currentMonthKey);

        const selectedIncome = document.getElementById('cashflow-selected-income');
        const selectedExpense = document.getElementById('cashflow-selected-expense');
        if (selectedIncome) selectedIncome.textContent = formatWon(totalIncome);
        if (selectedExpense) selectedExpense.textContent = formatWon(cashFlowStructure?.spending ?? totalExpense);
        renderCashFlowAllocationPanel(cashFlowStructure);
        renderMonthlyReportSummary(db, cashFlowStructure);
        renderMonthlyReportPortfolioSummary();

        const manageList = document.getElementById('manageTransactionList');
        if (manageList) manageList.innerHTML = '';
        renderCashFlowCategoryAnalysis(txData);
        renderRemainingFixedCosts(currentMonthKey, txData);

        const getBadgeStyle = (type) => {
            if(type === '수입') return 'bg-blue-100 text-blue-700';
            if(type === '지출') return 'bg-red-100 text-red-700';
            return 'bg-gray-100 text-gray-700';
        };

        const sortedTxData = [...txData].sort((a, b) => {
            const dateTimeA = `${a.date} ${a.time || '00:00'}`;
            const dateTimeB = `${b.date} ${b.time || '00:00'}`;
            if (txSortOrder === 'desc') return dateTimeB.localeCompare(dateTimeA);
            return dateTimeA.localeCompare(dateTimeB);
        });

        sortedTxData.forEach((item) => {
            const colorClass = item.type === '수입' ? 'text-blue-600' : (item.type === '지출' ? 'text-red-600' : 'text-gray-600');
            const sign = item.amount > 0 ? '+' : '';
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/80 transition-colors';
            tr.innerHTML = `
                <td class="px-3 md:px-4 py-2 whitespace-nowrap text-gray-500">${escapeHtml(item.date)} <span class="hidden md:inline text-[10px] text-gray-400 ml-1">${escapeHtml(item.time)}</span></td>
                <td class="px-3 md:px-4 py-2 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${getBadgeStyle(item.type)}">${escapeHtml(item.type)}</span></td>
                <td class="px-3 md:px-4 py-2 min-w-[140px]"><div class="font-medium text-gray-800 truncate leading-tight">${escapeHtml(item.memo)}</div><div class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(item.cat || '미분류')} &gt; ${escapeHtml(item.subcat)}</div></td>
                <td class="px-3 md:px-4 py-2 whitespace-nowrap text-gray-500 text-[10px] md:text-xs truncate max-w-[96px]">${escapeHtml(item.method)}</td>
                <td class="px-3 md:px-4 py-2 whitespace-nowrap text-right font-bold ${colorClass}">${sign}${item.amount.toLocaleString()}원</td>`;
            if (manageList) manageList.appendChild(tr);
        });

        if (document.getElementById('manage-count')) document.getElementById('manage-count').textContent = `총 ${txData.length}건`;

        const trendLabels = [];
        const incomeData = [];
        const spendingData = [];
        const repaymentData = [];
        const savingAndResidualData = [];
        getYearMonthKeys(currentMonthKey).forEach(key => {
            const structure = getCashFlowStructureSummary(key);
            if (!structure) return;
            trendLabels.push(key.replace('20', '').replace('-', '.'));
            incomeData.push(structure.totalIncome);
            spendingData.push(structure.spending);
            repaymentData.push(structure.repayment);
            savingAndResidualData.push(structure.savingAndResidual);
        });

        const trendCtx = document.getElementById('monthlyTrendChart');
        if (trendCtx) {
            renderOrUpdateChart('monthlyTrend', 'monthlyTrendChart', {
                type: 'bar',
                data: { labels: trendLabels, datasets: [
                    { type: 'bar', label: '수입', data: incomeData, backgroundColor: 'rgba(59, 130, 246, 0.75)', borderRadius: 6, yAxisID: 'y' },
                    { type: 'bar', label: '소비', data: spendingData, backgroundColor: 'rgba(239, 68, 68, 0.68)', borderRadius: 6, yAxisID: 'y' },
                    { type: 'bar', label: '상환', data: repaymentData, backgroundColor: 'rgba(194, 65, 12, 0.62)', borderRadius: 6, yAxisID: 'y' },
                    { type: 'line', label: '저축+잔여', data: savingAndResidualData, borderColor: '#10B981', backgroundColor: '#10B981', borderWidth: 2.5, pointRadius: 3, fill: false, tension: 0.32, yAxisID: 'y' }
                ] },
                options: withChartTransitions({
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        x: { stacked: false, grid: { display: false }, ticks: { font: { size: 10 } } },
                        y: {
                            min: 0,
                            stacked: false,
                            grid: { borderDash: [5, 5] },
                            ticks: { font: { size: 10 }, callback: function(value) { return Math.floor(value / 10000).toLocaleString() + '만'; } }
                        }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 6, font: { size: 10 } } },
                        tooltip: {
                            callbacks: {
                                label: function(c) {
                                    const label = c.dataset.label || '';
                                    return label + ': ' + Number(c.raw || 0).toLocaleString() + '원';
                                }
                            }
                        }
                    }
                }, 480)
            });
        }
        renderAssetTrend(db);
        destroyChart('expense');
    }

    function renderDashboard() {
        renderFinanceSummary();
        renderCashFlow();
    }

    function updateFinanceRoadmap(currentAsset) {
        if (!document.getElementById('roadmap-container')) return;

        const p1Target = 145000000;
        const p2Target = 800000000;
        const p4Target = 3000000000;
        const realEstateFunding = getRealEstateFundingStatus();

        let p1Pct = Math.min(100, Math.max(0, (currentAsset / p1Target) * 100));
        let p2Pct = realEstateFunding.totalPct;
        let p4Pct = Math.min(100, Math.max(0, (currentAsset / p4Target) * 100));

        // Update bars
        if (document.getElementById('roadmap-p1-bar')) document.getElementById('roadmap-p1-bar').style.width = p1Pct + '%';
        if (document.getElementById('roadmap-p2-bar')) document.getElementById('roadmap-p2-bar').style.width = p2Pct + '%';
        if (document.getElementById('roadmap-p4-bar')) document.getElementById('roadmap-p4-bar').style.width = p4Pct + '%';
        if (document.getElementById('roadmap-p2-ready')) document.getElementById('roadmap-p2-ready').textContent = realEstateFunding.totalReady.toLocaleString() + '원';
        if (document.getElementById('roadmap-p2-percent')) document.getElementById('roadmap-p2-percent').textContent = realEstateFunding.totalPct.toFixed(1) + '%';

        const dotBase = "absolute -left-[29px] md:-left-[35px] w-4 h-4 rounded-full ring-4 ring-white";
        const cardBase = "rounded-xl p-3 md:p-4 border shadow-sm transition-all";
        const setBarTone = (idx, tone) => {
            const bar = document.getElementById(`roadmap-p${idx}-bar`);
            if (!bar) return;
            const color = tone === 'past' ? 'bg-gray-300' : (tone === 'success' ? 'bg-emerald-400' : 'bg-indigo-500');
            bar.className = `h-full ${color} transition-all duration-1000`;
        };
        const setPast = (idx) => {
            const dot = document.getElementById(`roadmap-p${idx}-dot`);
            const card = document.getElementById(`roadmap-p${idx}-card`);
            if (!dot || !card) return;
            dot.className = `${dotBase} bg-gray-300`;
            card.className = `bg-gray-50 ${cardBase} border-gray-100 opacity-60 grayscale`;
            setBarTone(idx, 'past');
        };
        const setPending = (idx) => {
            const dot = document.getElementById(`roadmap-p${idx}-dot`);
            const card = document.getElementById(`roadmap-p${idx}-card`);
            if (!dot || !card) return;
            dot.className = `${dotBase} bg-gray-200`;
            card.className = `bg-gray-50 ${cardBase} border-gray-100`;
            setBarTone(idx, idx === 4 ? 'success' : 'active');
        };

        const setActive = (idx) => {
            const dot = document.getElementById(`roadmap-p${idx}-dot`);
            const card = document.getElementById(`roadmap-p${idx}-card`);
            if (!dot || !card) return;
            const isFinal = idx === 4;
            dot.className = `${dotBase} ${isFinal ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.45)]' : 'bg-indigo-400 animate-pulse'}`;
            card.className = `bg-white ${cardBase} ${isFinal ? 'border-emerald-300' : 'border-indigo-300'} shadow-md`;
            setBarTone(idx, isFinal ? 'success' : 'active');
        };

        // Reset
        for(let i=1; i<=4; i++) setPending(i);

        if (currentAsset >= p4Target) {
            setPast(1); setPast(2); setPast(3); setActive(4);
        } else if (realEstateFunding.totalReady >= p2Target) {
            setPast(1); setPast(2); setActive(3);
        } else if (currentAsset >= p1Target) {
            setPast(1);
            setActive(2);
        } else {
            setActive(1);
        }
    }

    function getRealEstateFundingStatus() {
        let liquidAndSafe = 0;
        let housingFunds = 0;
        let discountedInvestments = 0;
        let restrictedFunds = 0;
        let debt = 0;
        if (dynamicPortfolioData) {
            Object.entries(dynamicPortfolioData).forEach(([groupName, groupData]) => {
                groupData.items.forEach((item) => {
                    const amount = Number(item.amount || 0);
                    const assetType = item.classification?.assetType || item.assetType || '';
                    const searchText = `${groupName} ${item.name || ''} ${assetType}`.toLowerCase();
                    if (groupData.isDebt || assetType === 'debt' || amount < 0) {
                        debt += Math.min(0, amount);
                    } else if (/연금|퇴직|irp|pension/.test(searchText)) {
                        restrictedFunds += amount;
                    } else if (/전세|보증금|청약|주택드림|housing/.test(searchText)) {
                        housingFunds += amount;
                    } else if (/투자|주식|etf|펀드|stock|fund|bond/.test(searchText)) {
                        discountedInvestments += amount * 0.9;
                    } else {
                        liquidAndSafe += amount;
                    }
                });
            });
        }

        const assumptions = getRealEstateAnalysisAssumptions();
        const debtCapacity = getRealEstateDebtCapacity(assumptions);
        const targetBudget = assumptions.targetBudget;
        const selfFunding = Math.max(0, liquidAndSafe + housingFunds + discountedInvestments + debt);
        const fundingGapBeforeLoan = Math.max(0, targetBudget - selfFunding);
        const expectedLoan = Math.min(fundingGapBeforeLoan, debtCapacity.maxLoanByDsr);
        const totalReady = selfFunding + expectedLoan;
        const savedPct = targetBudget > 0 ? (selfFunding / targetBudget) * 100 : 0;
        const loanPct = targetBudget > 0 ? (expectedLoan / targetBudget) * 100 : 0;
        const totalPct = Math.min(100, Math.max(0, savedPct + loanPct));

        return {
            cashAndSafe: selfFunding,
            selfFunding,
            liquidAndSafe,
            housingFunds,
            discountedInvestments,
            restrictedFunds,
            debt,
            targetBudget,
            expectedLoan,
            totalReady,
            savedPct,
            loanPct,
            totalPct,
            fundingGapBeforeLoan,
            maxLoanByDsr: debtCapacity.maxLoanByDsr
        };
    }
