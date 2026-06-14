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

        const totalGrowthEl = document.getElementById('asset-total-growth');
        const avgGrowthEl = document.getElementById('asset-avg-growth');
        const goalPercentEl = document.getElementById('asset-goal-percent');
        const goalBarEl = document.getElementById('asset-goal-bar');
        const dashboardTitleEl = document.getElementById('dashboard-asset-title');
        const goalPercentage = Number(model.goalPercentage) || 0;

        if (totalGrowthEl) totalGrowthEl.innerHTML = `<span class="text-indigo-600">${model.totalAssetGrowth >= 0 ? '+' : ''}${model.totalAssetGrowth.toLocaleString()}</span>원`;
        if (avgGrowthEl) avgGrowthEl.innerHTML = `<span class="text-emerald-600">${model.avgMonthlyGrowth >= 0 ? '+' : ''}${Math.round(model.avgMonthlyGrowth).toLocaleString()}</span>원/월`;
        if (goalPercentEl) goalPercentEl.innerHTML = `<span class="text-amber-500">${goalPercentage.toFixed(1)}</span>%`;
        if (goalBarEl) {
            goalBarEl.style.width = '0%';
            setTimeout(() => { goalBarEl.style.width = `${Math.max(0, Math.min(100, goalPercentage))}%`; }, 100);
        }
        if (dashboardTitleEl) dashboardTitleEl.textContent = model.dashboardTitle;
    }

    function createAssetTrendChartConfig(labels, data, targetGoalAsset) {
        const goalData = labels.map(() => targetGoalAsset);
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
                        order: 2
                    }
                ]
            },
            options: withChartTransitions({
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: { font: { size: 10 }, callback: function(value) { return Math.floor(value / 10000).toLocaleString() + '만'; } },
                        grid: { borderDash: [5, 5] }
                    },
                    x: { grid: { display: false }, ticks: { font: { size: 10 } } }
                },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { usePointStyle: false, boxWidth: 18, boxHeight: 2, font: { size: 10 } } },
                    tooltip: { callbacks: { label: function(context) { return ' ' + context.dataset.label + ': ' + context.raw.toLocaleString() + '원'; } } }
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
                createAssetTrendChartConfig(model.dashboardSeries.labels, model.dashboardSeries.data, model.targetGoalAsset)
            );
        }

        if (document.getElementById('fullAssetChart')) {
            renderOrUpdateChart(
                'fullAsset',
                'fullAssetChart',
                createAssetTrendChartConfig(model.fullSeries.labels, model.fullSeries.data, model.targetGoalAsset)
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

        renderAssetTrendDashboardDiff(model);
        renderAssetTrendSummary(model);
        renderAssetTrendCharts(model);
        if (typeof updateFinanceRoadmap === 'function') updateFinanceRoadmap(model.currentAsset);
        return model;
    }

    function renderFinanceSummaryKpis({ assetModel, totalIncome, totalExpense, currentBalance, periodLabel = '올해' }) {
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const setHtml = (id, html) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        };

        setText('finance-period-badge', `${periodLabel} 누적`);

        const assetPct = Number(assetModel?.goalPercentage || 0);
        const currentAsset = Number(assetModel?.currentAsset || 0);
        const targetAsset = Number(assetModel?.targetGoalAsset || 250000000);
        setHtml('finance-kpi-asset-progress', `<span class="text-amber-500">${assetPct.toFixed(1)}</span>%`);
        setText('finance-kpi-asset-meta', `${formatWon(currentAsset)} / ${formatWon(targetAsset)}`);
        setProgressBar('finance-kpi-asset-bar', assetPct);

        const fundingStatus = getRealEstateFundingStatus();
        const fundingPct = Number(fundingStatus.totalPct || 0);
        setHtml('finance-kpi-funding-progress', `<span class="text-indigo-500">${fundingPct.toFixed(1)}</span>%`);
        setText('finance-kpi-funding-meta', `${formatWon(fundingStatus.totalReady)} / ${formatWon(fundingStatus.targetBudget)}`);
        setProgressBar('finance-kpi-funding-bar', fundingPct);

        const cashflowClass = currentBalance >= 0 ? 'text-emerald-600' : 'text-red-500';
        setHtml('finance-kpi-cashflow', `<span class="${cashflowClass}">${formatSignedWon(currentBalance)}</span>`);
        setHtml('finance-kpi-cashflow-meta', `
            <div class="flex justify-between gap-2"><span>${periodLabel} 수입</span><span class="font-semibold text-gray-500">${formatWon(totalIncome)}</span></div>
            <div class="flex justify-between gap-2"><span>${periodLabel} 지출</span><span class="font-semibold text-gray-500">${formatWon(totalExpense)}</span></div>
        `);

        const savingRate = totalIncome > 0 ? (currentBalance / totalIncome) * 100 : 0;
        const savingClass = savingRate >= 0 ? 'text-sky-600' : 'text-red-500';
        setHtml('finance-kpi-saving-rate', `<span class="${savingClass}">${savingRate.toFixed(1)}</span>%`);
        setHtml('finance-kpi-saving-meta', `
            <div class="flex justify-between gap-2"><span>${periodLabel} 잉여</span><span class="font-semibold text-gray-500">${formatSignedWon(currentBalance)}</span></div>
            <div class="flex justify-between gap-2"><span>${periodLabel} 수입</span><span class="font-semibold text-gray-500">${formatWon(totalIncome)}</span></div>
        `);
        setProgressBar('finance-kpi-saving-bar', savingRate);
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

    function renderCategoryBreakdownList(containerId, items = [], total = 0, accentClass = 'text-gray-600') {
        const container = document.getElementById(containerId);
        if (!container) return;
        if (!items.length || total <= 0) {
            container.innerHTML = '<p class="text-gray-400">표시할 거래가 없습니다.</p>';
            return;
        }

        container.innerHTML = items.map(item => {
            const pct = total > 0 ? (item.amount / total) * 100 : 0;
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

    function renderCashFlowCategoryAnalysis(txData = []) {
        const incomeItems = getCashFlowCategoryBreakdown(txData, '수입', 5);
        const expenseItems = getCashFlowCategoryBreakdown(txData, '지출', 5);
        const incomeTotal = incomeItems.reduce((sum, item) => sum + item.amount, 0);
        const expenseTotal = expenseItems.reduce((sum, item) => sum + item.amount, 0);
        const incomeColors = ['#3B82F6', '#60A5FA', '#93C5FD', '#2563EB', '#BFDBFE'];
        const expenseColors = ['#EF4444', '#F97316', '#F59E0B', '#EC4899', '#FCA5A5'];

        if (incomeItems.length && document.getElementById('cashflow-income-category-chart')) {
            renderOrUpdateChart('cashflowIncomeCategory', 'cashflow-income-category-chart', createCategoryDoughnutConfig(incomeItems, incomeColors));
        } else {
            destroyChart('cashflowIncomeCategory');
        }

        if (expenseItems.length && document.getElementById('cashflow-expense-category-chart')) {
            renderOrUpdateChart('cashflowExpenseCategory', 'cashflow-expense-category-chart', createCategoryDoughnutConfig(expenseItems, expenseColors));
        } else {
            destroyChart('cashflowExpenseCategory');
        }

        renderCategoryBreakdownList('cashflow-income-category-list', incomeItems, incomeTotal, 'text-blue-600');
        renderCategoryBreakdownList('cashflow-expense-category-list', expenseItems, expenseTotal, 'text-red-600');
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

    function getRemainingFixedCostItems(monthKey, txData = []) {
        const today = getLocalTodayParts();
        if (monthKey !== today.monthKey) return { isCurrentMonth: false, items: [], total: 0 };

        const paidKeys = new Set(txData
            .filter(tx => tx.type === '지출')
            .map(tx => `${tx.date}|${Math.abs(Number(tx.amount) || 0)}|${String(tx.memo || '').trim()}`));

        const items = (addonInsurances || []).map(ins => {
            const payDay = Number(ins.pay_day || ins.payDay || 0);
            const amount = Math.abs(Number(ins.monthly_payment || ins.monthlyPayment || 0));
            if (!payDay || !amount) return null;

            const dueDay = Math.min(payDay, new Date(today.year, Number(today.month), 0).getDate());
            if (dueDay < today.day) return null;

            const dueDateKey = `${today.monthKey}-${String(dueDay).padStart(2, '0')}`;
            const start = ins.start_date ? String(ins.start_date).slice(0, 10) : '';
            const end = ins.end_date ? String(ins.end_date).slice(0, 10) : '';
            if (start && dueDateKey < start) return null;
            if (end && dueDateKey > end) return null;

            const description = String(ins.description || ins.name || '보험료').trim();
            const company = String(ins.company || '').trim();
            const exactPaidKey = `${dueDateKey}|${amount}|${description}`;
            const looksPaid = paidKeys.has(exactPaidKey) || txData.some(tx => (
                tx.type === '지출'
                && tx.date === dueDateKey
                && Math.abs(Number(tx.amount) || 0) === amount
                && (!description || String(tx.memo || '').includes(description) || (company && String(tx.memo || '').includes(company)))
            ));
            if (looksPaid) return null;

            const dueDate = new Date(today.year, Number(today.month) - 1, dueDay);
            const diffDays = Math.max(0, Math.ceil((dueDate - today.date) / 86400000));
            return {
                label: description,
                meta: company || '보험',
                amount,
                dueDateKey,
                diffDays
            };
        }).filter(Boolean).sort((a, b) => a.dueDateKey.localeCompare(b.dueDateKey));

        return { isCurrentMonth: true, items, total: items.reduce((sum, item) => sum + item.amount, 0) };
    }

    function renderRemainingFixedCosts(monthKey, txData = []) {
        const panel = document.getElementById('cashflow-fixed-due-panel');
        const list = document.getElementById('cashflow-fixed-due-list');
        const totalEl = document.getElementById('cashflow-fixed-due-total');
        if (!panel || !list || !totalEl) return;

        const result = getRemainingFixedCostItems(monthKey, txData);
        totalEl.textContent = formatWon(result.total);

        if (!result.isCurrentMonth) {
            panel.className = 'border border-gray-100 rounded-xl p-3 min-w-0 bg-gray-50/60';
            list.innerHTML = '<p class="text-gray-400">이번 달 상세 내역에서만 예정 고정비를 표시합니다.</p>';
            return;
        }

        panel.className = result.items.length
            ? 'border border-amber-100 rounded-xl p-3 min-w-0 bg-amber-50/30'
            : 'border border-gray-100 rounded-xl p-3 min-w-0 bg-white';

        if (!result.items.length) {
            list.innerHTML = '<p class="text-gray-400">남은 보험 납입 예정이 없습니다.</p>';
            return;
        }

        list.innerHTML = result.items.map(item => `
            <div class="flex items-center justify-between gap-2 bg-white border border-amber-100 rounded-lg px-2.5 py-1.5">
                <div class="min-w-0">
                    <p class="font-bold text-gray-700 truncate">${escapeHtml(item.label)}</p>
                    <p class="text-gray-400 truncate">${escapeHtml(item.meta)} · ${escapeHtml(item.dueDateKey)} · ${item.diffDays === 0 ? '오늘' : `D-${item.diffDays}`}</p>
                </div>
                <span class="font-bold text-amber-700 whitespace-nowrap">${formatWon(item.amount)}</span>
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

    function renderFinanceSummary() {
        if(!currentMonthKey || !monthlyDB[currentMonthKey]) return;
        const db = monthlyDB[currentMonthKey];
        applyAssetStateForMonth(db, currentMonthKey);

        const { year, totalIncome, totalExpense } = getYearToDateCashFlowStats(currentMonthKey);
        const currentBalance = totalIncome - totalExpense;

        if (document.getElementById('card-total')) document.getElementById('card-total').textContent = `${currentBalance.toLocaleString()}원`;
        if (document.getElementById('card-asset')) document.getElementById('card-asset').textContent = `${db.asset.toLocaleString()}원`;

        const budgetStatus = document.getElementById('card-budget-status');
        if (budgetStatus) {
            if (currentBalance >= 0) {
                budgetStatus.innerHTML = '<i class="fas fa-check-circle"></i> 흑자';
                budgetStatus.className = 'text-[10px] md:text-xs text-indigo-100 flex items-center gap-1 mb-1 whitespace-nowrap shrink-0';
            } else {
                budgetStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> 적자';
                budgetStatus.className = 'text-[10px] md:text-xs text-red-200 flex items-center gap-1 mb-1 whitespace-nowrap shrink-0';
            }
        }

        const assetModel = renderAssetTrend(db);
        renderFinanceSummaryKpis({ assetModel, totalIncome, totalExpense, currentBalance, periodLabel: `${year}년` });
    }

    function renderCashFlow() {
        if(!currentMonthKey || !monthlyDB[currentMonthKey]) return;
        const db = monthlyDB[currentMonthKey];
        const txData = db.transactions;

        const displayMonth = document.getElementById('display-month');
        const displayPeriod = document.getElementById('display-period');
        const manageTitle = document.getElementById('manage-title');
        if (displayMonth) displayMonth.textContent = db.title;
        if (displayPeriod) displayPeriod.textContent = db.periodStr;
        if (manageTitle) manageTitle.textContent = `${db.title} 거래 내역`;

        const { totalIncome, totalExpense } = getCashFlowStats(txData);
        const currentBalance = totalIncome - totalExpense;
        const cashflowClass = currentBalance >= 0 ? 'text-emerald-600' : 'text-red-500';

        const selectedIncome = document.getElementById('cashflow-selected-income');
        const selectedExpense = document.getElementById('cashflow-selected-expense');
        const selectedNet = document.getElementById('cashflow-selected-net');
        if (selectedIncome) selectedIncome.textContent = formatWon(totalIncome);
        if (selectedExpense) selectedExpense.textContent = formatWon(totalExpense);
        if (selectedNet) {
            selectedNet.innerHTML = `<span class="${cashflowClass}">${formatSignedWon(currentBalance)}</span>`;
            selectedNet.className = `text-xs sm:text-sm md:text-xl font-bold truncate ${cashflowClass}`;
        }

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
        const expenseData = [];
        const cumulativeNetData = [];
        let cumulativeNet = 0;
        getYearMonthKeys(currentMonthKey).forEach(key => {
            const monthDb = monthlyDB[key];
            const stats = getCashFlowStats(monthDb.transactions);
            const monthlyNet = stats.totalIncome - stats.totalExpense;
            cumulativeNet += monthlyNet;
            trendLabels.push(key.replace('20', '').replace('-', '.'));
            incomeData.push(stats.totalIncome);
            expenseData.push(stats.totalExpense);
            cumulativeNetData.push(cumulativeNet);
        });

        const trendCtx = document.getElementById('monthlyTrendChart');
        if (trendCtx) {
            renderOrUpdateChart('monthlyTrend', 'monthlyTrendChart', {
                type: 'bar',
                data: { labels: trendLabels, datasets: [
                    { type: 'bar', label: '수입', data: incomeData, backgroundColor: 'rgba(59, 130, 246, 0.75)', borderRadius: 6, yAxisID: 'y' },
                    { type: 'bar', label: '지출', data: expenseData, backgroundColor: 'rgba(239, 68, 68, 0.72)', borderRadius: 6, yAxisID: 'y' },
                    { type: 'line', label: '누적 잉여', data: cumulativeNetData, borderColor: '#10B981', backgroundColor: '#10B981', borderWidth: 2.5, pointRadius: 3, fill: false, tension: 0.32, yAxisID: 'y' }
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
        let cashAndSafe = 0;
        if (dynamicPortfolioData) {
            Object.entries(dynamicPortfolioData).forEach(([groupName, groupData]) => {
                const sum = groupData.items.reduce((acc, curr) => acc + curr.amount, 0);
                if (groupData.isDebt) {
                    cashAndSafe += sum; // 부채 (음수)
                } else if (groupName.includes('투자')) {
                    cashAndSafe += (sum * 0.9); // 투자자산 * 0.9
                } else {
                    cashAndSafe += sum; // 안전자산(현금) 및 기타
                }
            });
        }

        const targetBudget = 800000000; // 8억
        const expectedLoan = 300000000; // 3억 고정
        const totalReady = cashAndSafe + expectedLoan;
        const savedPct = (cashAndSafe / targetBudget) * 100;
        const loanPct = (expectedLoan / targetBudget) * 100;
        const totalPct = Math.min(100, Math.max(0, savedPct + loanPct));

        return { cashAndSafe, targetBudget, expectedLoan, totalReady, savedPct, loanPct, totalPct };
    }
