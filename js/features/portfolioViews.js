// Portfolio and investment detail rendering extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    const CFO_PORTFOLIO_GROUP_UI = {
        operating: { icon: 'fa-wallet', iconClass: 'bg-slate-100 text-slate-600', borderClass: 'border-slate-200' },
        safe: { icon: 'fa-shield-halved', iconClass: 'bg-indigo-50 text-indigo-600', borderClass: 'border-indigo-100' },
        investment: { icon: 'fa-chart-line', iconClass: 'bg-violet-50 text-violet-600', borderClass: 'border-violet-100' },
        housing: { icon: 'fa-house', iconClass: 'bg-teal-50 text-teal-700', borderClass: 'border-teal-100' },
        pension: { icon: 'fa-landmark', iconClass: 'bg-slate-100 text-slate-700', borderClass: 'border-slate-200' },
    };

    function renderPortfolioCfoGroupSummary(model) {
        const container = document.getElementById('portfolio-cfo-group-summary');
        if (!container) return;
        if (!model?.groups?.length) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = model.groups.map((group) => {
            const ui = CFO_PORTFOLIO_GROUP_UI[group.key] || CFO_PORTFOLIO_GROUP_UI.operating;
            const liabilityText = group.liabilityAmount > 0
                ? `<p class="mt-1 truncate text-[9px] font-bold text-rose-500">상환 ${group.liabilityAmount.toLocaleString()}원</p>`
                : `<p class="mt-1 text-[9px] text-slate-400">${group.items.length}개 항목</p>`;
            return `
                <article class="min-w-0 rounded-xl border bg-white p-2.5 shadow-sm ${ui.borderClass} ${group.key === 'pension' ? 'col-span-2 lg:col-span-1' : ''}">
                    <div class="flex items-center gap-2">
                        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${ui.iconClass}">
                            <i class="fas ${ui.icon} text-xs" aria-hidden="true"></i>
                        </span>
                        <div class="min-w-0">
                            <p class="truncate text-[10px] font-bold text-slate-700">${escapeHtml(group.label)}</p>
                            <p class="truncate text-[9px] text-slate-400">${escapeHtml(group.purpose)}</p>
                        </div>
                    </div>
                    <p class="mt-2 truncate text-sm font-bold text-slate-950">${group.assetAmount.toLocaleString()}원</p>
                    ${liabilityText}
                </article>
            `;
        }).join('');
    }

    function renderPortfolio() {
        if (!currentMonthKey) return;
        const shortYear = currentMonthKey.substring(2, 4);
        const shortMonth = currentMonthKey.substring(5, 7);
        const targetLabel = `${shortYear}.${shortMonth}`;
        const keys = getMonthKeys();
        const isLatestMonth = currentMonthKey === keys[keys.length - 1];
        const snapshot = dynamicAssetSnapshots[targetLabel];
        const badge = document.getElementById('portfolio-month-badge');
        const wrapper = document.getElementById('portfolio-accordion-wrapper');
        const notice = document.getElementById('portfolio-past-notice');
        let chartLabels = [];
        let chartData = [];
        let chartColors = [];
        let totalAssets = 0;
        let totalLiabilities = 0;
        let totalLiquid = 0;
        let totalTied = 0;
        let displayedNetWorth = 0;
        let cfoModel = null;

        if (isLatestMonth) {
            badge.classList.add('hidden');
        } else {
            badge.classList.remove('hidden');
            badge.textContent = `${targetLabel} 스냅샷`;
        }

        const renderPortfolioItemRow = (item) => {
            const debt = Boolean(item.isDebt || item.amount < 0 || item.classification?.assetType === 'debt');
            return `
                <div class="flex items-center justify-between gap-3 text-sm">
                    <div class="min-w-0">
                        <div class="flex min-w-0 items-center gap-2">
                            <span class="h-1.5 w-1.5 shrink-0 rounded-full ${debt ? 'bg-rose-400' : 'bg-slate-300'}"></span>
                            <span class="truncate text-gray-700">${escapeHtml(item.name)}</span>
                            ${getAssetClassBadgeHtml(item.classification)}
                        </div>
                        <p class="mt-0.5 truncate pl-3.5 text-[9px] text-slate-400">
                            ${escapeHtml(item.groupName || '')}${item.maturity ? ` · ${escapeHtml(item.maturity)}` : ''}
                        </p>
                    </div>
                    <div class="flex shrink-0 flex-col items-end text-right">
                        <span class="font-medium ${debt ? 'text-rose-500' : 'text-gray-700'}">${Number(item.amount || 0).toLocaleString()}원</span>
                        ${item.shares ? `<span class="text-[10px] font-bold tracking-tight text-gray-400">${item.shares.toLocaleString()}주 · 단가 ${Math.floor(item.amount / item.shares).toLocaleString()}원</span>` : ''}
                    </div>
                </div>
            `;
        };

        const renderInvestmentAccountRows = (items) => {
            const accountGroups = {};
            const accountOrderMap = getPortfolioAccountOrderMap(items);
            items.forEach((item) => {
                const accountName = getPortfolioAccountDisplayName(item);
                if (!accountGroups[accountName]) accountGroups[accountName] = [];
                accountGroups[accountName].push(item);
            });
            return Object.entries(accountGroups)
                .sort(([a], [b]) => comparePortfolioAccounts(a, b, accountOrderMap))
                .map(([accountName, accountItems]) => {
                    const accountTotal = accountItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                    return `
                        <div class="overflow-hidden rounded-xl border border-violet-100 bg-white">
                            <div class="flex items-center justify-between gap-3 border-b border-violet-100 bg-violet-50/50 px-3 py-1.5">
                                <div class="min-w-0">
                                    <p class="truncate text-xs font-bold text-gray-800">${escapeHtml(accountName)}</p>
                                    <p class="text-[10px] text-gray-400">${accountItems.length}개 자산</p>
                                </div>
                                <p class="whitespace-nowrap text-xs font-black text-violet-700">${accountTotal.toLocaleString()}원</p>
                            </div>
                            <div class="space-y-1.5 p-2.5">${accountItems.map(renderPortfolioItemRow).join('')}</div>
                        </div>
                    `;
                }).join('');
        };

        if (isLatestMonth && dynamicPortfolioData) {
            cfoModel = window.FinanceModel.buildCfoAssetGroups(dynamicPortfolioData);
            totalAssets = cfoModel.totalAssets;
            totalLiabilities = cfoModel.totalLiabilities;
            displayedNetWorth = cfoModel.netWorth;
            wrapper.classList.remove('hidden');
            notice.classList.add('hidden');
            wrapper.innerHTML = '';
            renderPortfolioCfoGroupSummary(cfoModel);

            cfoModel.groups.forEach((group) => {
                const ui = CFO_PORTFOLIO_GROUP_UI[group.key] || CFO_PORTFOLIO_GROUP_UI.operating;
                group.items.forEach((item) => {
                    if (item.isDebt) return;
                    const tied = Boolean(item.maturity) || group.key === 'housing' || group.key === 'pension';
                    if (tied) totalTied += Math.max(0, Number(item.amount || 0));
                    else totalLiquid += Math.max(0, Number(item.amount || 0));
                });
                if (group.assetAmount > 0) {
                    chartLabels.push(group.label);
                    chartData.push(group.assetAmount);
                    chartColors.push(group.color);
                }
                const investmentButton = group.key === 'investment'
                    ? `<button onclick="event.stopPropagation(); switchView('invest-detail-view'); renderInvestDetail('투자 자산');" class="ml-1.5 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 transition-colors hover:bg-violet-100">상세보기 <i class="fas fa-chevron-right ml-1 text-[8px]"></i></button>`
                    : '';
                const liabilityBadge = group.liabilityAmount > 0
                    ? `<span class="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-500">상환 ${group.liabilityAmount.toLocaleString()}원</span>`
                    : '';
                wrapper.insertAdjacentHTML('beforeend', `
                    <div class="overflow-hidden rounded-xl border shadow-sm ${ui.borderClass}">
                        <div class="flex w-full cursor-pointer items-center justify-between gap-3 bg-white p-3 transition-colors hover:bg-slate-50" onclick="toggleAccordion(this)">
                            <div class="flex min-w-0 items-center gap-2">
                                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ui.iconClass}">
                                    <i class="fas ${ui.icon} text-xs" aria-hidden="true"></i>
                                </span>
                                <div class="min-w-0">
                                    <div class="flex items-center gap-1">
                                        <span class="truncate text-sm font-bold text-gray-800 md:text-base">${escapeHtml(group.label)}</span>
                                        ${investmentButton}
                                    </div>
                                    <p class="text-[9px] text-slate-400">${escapeHtml(group.purpose)} · ${group.items.length}개 항목</p>
                                </div>
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                                ${liabilityBadge}
                                <span class="text-sm font-bold text-gray-800 md:text-base">${group.assetAmount.toLocaleString()}원</span>
                                <i class="fas fa-chevron-down text-sm text-gray-400 accordion-icon"></i>
                            </div>
                        </div>
                        <div class="accordion-content bg-white">
                            <div class="space-y-2 border-t border-gray-100 p-3">
                                ${group.items.length > 0
                                    ? (group.key === 'investment' ? renderInvestmentAccountRows(group.items) : group.items.map(renderPortfolioItemRow).join(''))
                                    : '<p class="py-2 text-center text-sm text-gray-400">등록된 내역이 없습니다.</p>'}
                            </div>
                        </div>
                    </div>
                `);
            });
        } else if (snapshot) {
            wrapper.classList.add('hidden');
            notice.classList.remove('hidden');
            renderPortfolioCfoGroupSummary(null);
            const cashAndSafe = Number(snapshot.cash || 0) + Number(snapshot.safe || 0);
            const invested = Number(snapshot.invest || 0);
            totalLiabilities = Math.abs(Number(snapshot.debt || 0));
            totalAssets = cashAndSafe + invested;
            displayedNetWorth = totalAssets - totalLiabilities;
            chartLabels = ['현금·안전', '투자'];
            chartData = [cashAndSafe, invested];
            chartColors = ['#4F46E5', '#7C3AED'];
        } else {
            wrapper.classList.add('hidden');
            notice.classList.remove('hidden');
            renderPortfolioCfoGroupSummary(null);
            document.getElementById('portfolio-past-notice-text').textContent = '해당 월의 자산 구성 스냅샷 데이터가 존재하지 않습니다.';
        }

        const officialSnapshot = isLatestMonth && typeof getOfficialFinanceSnapshot === 'function'
            ? getOfficialFinanceSnapshot()
            : null;
        const sourceBadge = document.getElementById('portfolio-data-source-badge');
        if (sourceBadge && officialSnapshot) sourceBadge.textContent = window.FinanceModel.getSourceBadge(officialSnapshot);
        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = `${Number(value || 0).toLocaleString()}원`;
        };
        setText('pf-networth', displayedNetWorth);
        setText('pf-total-assets', totalAssets);
        setText('pf-total-liabilities', totalLiabilities);
        setText('pf-liquid-sum', totalLiquid);
        setText('pf-tied-sum', totalTied);

        const renderDoughnut = (ctxId, chartKey, isMini = false) => {
            renderOrUpdateChart(chartKey, ctxId, {
                type: 'doughnut',
                data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 0, hoverOffset: 4 }] },
                options: withChartTransitions({
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: isMini ? 'right' : 'bottom',
                            labels: { boxWidth: isMini ? 8 : 10, font: { size: isMini ? 10 : 11, color: '#4B5563' } },
                        },
                        tooltip: { callbacks: { label: (context) => ` ${Number(context.raw || 0).toLocaleString()}원` } },
                    },
                }, 420),
            });
        };
        renderDoughnut('portfolioChart', 'portfolio', false);
        renderDoughnut('dashPortfolioChart', 'dashPortfolio', true);
    }

    function renderInvestDetail(groupName) {
        try {
        activeInvestGroupName = groupName;
        const groupData = dynamicPortfolioData[groupName];
        if (!groupData) {
            activeInvestProcessedItems = [];
            activeInvestTotal = 0;
            return;
        }

        // 1. 총 자산 및 가상 수익률 계산
        const total = groupData.items.reduce((acc, curr) => acc + curr.amount, 0);
        document.getElementById('invest-detail-total').textContent = total.toLocaleString() + '원';

        const buildProcessedInvestItem = (item, sourceGroupName = groupName) => {
            const strategyTag = inferStrategyTag(item);
            const strategyMeta = getStrategyMeta(strategyTag);
            const marketPrice = getMarketPriceForTicker(item.ticker);
            const shares = Number(item.shares || 0);
            const avgBuyPrice = Number(item.avgBuyPrice || 0);
            const hasComparablePrice = !!marketPrice && shares > 0 && avgBuyPrice > 0 && String(marketPrice.currency || '').toUpperCase() === String(item.currency || '').toUpperCase();
            const investedCost = hasComparablePrice ? shares * avgBuyPrice : null;
            const currentValue = hasComparablePrice ? shares * marketPrice.price : null;
            const unrealizedPnl = hasComparablePrice ? currentValue - investedCost : null;
            const returnPct = hasComparablePrice && investedCost > 0 ? (unrealizedPnl / investedCost) * 100 : null;
            return {
                ...item,
                groupName: sourceGroupName,
                strategyTag,
                strategy: strategyMeta.label,
                strategyColor: strategyMeta.color,
                marketPrice,
                investedCost,
                currentValue,
                unrealizedPnl,
                returnPct,
                hasComparablePrice
            };
        };

        // 종목별 전략 태그 부여. DB 값이 있으면 우선 사용하고, 없으면 기존 규칙으로 추론한다.
        const processedItems = groupData.items.map(item => buildProcessedInvestItem(item, groupName));
        activeInvestProcessedItems = processedItems;
        activeInvestTotal = total;

        // 수동 현재가와 평균단가가 준비된 항목만 기준으로 미실현 손익을 계산한다.
        const profitEl = document.getElementById('invest-detail-profit');
        if (profitEl) {
            const pnlItems = processedItems.filter(item => item.hasComparablePrice);
            const totalCost = pnlItems.reduce((acc, item) => acc + item.investedCost, 0);
            const totalPnl = pnlItems.reduce((acc, item) => acc + item.unrealizedPnl, 0);
            const totalReturnPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
            profitEl.textContent = pnlItems.length > 0
                ? `${totalPnl >= 0 ? '+' : ''}${Math.round(totalPnl).toLocaleString()} ${pnlItems[0].currency || ''} (${totalReturnPct.toFixed(1)}%)`
                : '현재가 입력 필요';
            profitEl.className = `text-sm font-bold ${totalPnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`;
        }

        // 2. MDD 방어 상태 (현금 비중)
        let cashTotal = 0;
        let allTotal = 0;
        Object.values(dynamicPortfolioData).forEach(g => {
            g.items.forEach(item => {
                if (item.classification?.assetType === 'debt') return;
                const positiveAmount = Math.max(0, item.amount);
                allTotal += positiveAmount;
                if (item.classification?.assetType === 'account') {
                    cashTotal += positiveAmount;
                }
            });
        });
        const cashRatio = allTotal > 0 ? (cashTotal / allTotal) * 100 : 0;
        document.getElementById('invest-mdd-ratio').textContent = cashRatio.toFixed(1) + '%';
        document.getElementById('invest-mdd-bar').style.width = Math.min(100, cashRatio) + '%';
        const mddStatus = document.getElementById('invest-mdd-status');
        if (cashRatio >= 20) { mddStatus.textContent = "매우 안정 (위기 대응 가능)"; mddStatus.className = "text-[10px] font-bold text-emerald-500 mb-1"; }
        else if (cashRatio >= 10) { mddStatus.textContent = "보통 (적정 방어력)"; mddStatus.className = "text-[10px] font-bold text-yellow-500 mb-1"; }
        else { mddStatus.textContent = "위험 (현금 부족)"; mddStatus.className = "text-[10px] font-bold text-red-500 mb-1"; }

        const holdingEditorItems = Object.entries(dynamicPortfolioData || {}).flatMap(([sourceGroupName, group]) => {
            const sourceText = String(sourceGroupName || '').toLowerCase();
            return (group.items || [])
                .map(item => buildProcessedInvestItem(item, sourceGroupName))
                .filter(item => {
                    const assetType = item.classification?.assetType || '';
                    const hasShares = Number(item.shares || 0) > 0;
                    return hasShares || assetType === 'stock' || assetType === 'etf' || assetType === 'pension' || sourceText.includes('투자') || sourceText.includes('연금');
                });
        });

        renderQuantStrategyStructure(processedItems, total);
        renderMarketSyncStatus(processedItems);
        renderQuantHoldingEditor(holdingEditorItems);
        renderStrategyPerformance(processedItems);

        // 3. 종목 상세 카드 렌더링 (2단 아코디언 UI)
        const listContainer = document.getElementById('invest-detail-list');

        // 전략별로 데이터 그룹핑
        const groupedItems = {};
        processedItems.forEach(item => {
            const strategyKey = item.strategyTag || 'other';
            if (!groupedItems[strategyKey]) groupedItems[strategyKey] = [];
            groupedItems[strategyKey].push(item);
        });
        const strategyOrder = [
            ...INVEST_STRATEGY_KEYS.filter(key => groupedItems[key]?.length),
            ...Object.keys(groupedItems).filter(key => !INVEST_STRATEGY_META[key])
        ];

        let htmlContent = "";
        let globalIdx = 0;

        strategyOrder.forEach((strategyKey, stratIdx) => {
            const items = groupedItems[strategyKey];
            if (items.length === 0) return;
            const strategyMeta = getStrategyMeta(strategyKey);
            const strat = strategyMeta.label;

            const stratTotal = items.reduce((acc, curr) => acc + curr.amount, 0);

            htmlContent += `
            <div class="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden mb-3 border-l-4" style="border-left-color: ${strategyMeta.color}">
                <!-- 1st Level Accordion Header (Strategy) -->
                <button onclick="document.getElementById('strat-${stratIdx}').classList.toggle('hidden')" class="w-full p-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none text-left">
                    <div class="flex-1">
                        <h4 class="font-bold text-gray-800 text-sm leading-tight flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${strategyMeta.color}"></span>
                            <span>${escapeHtml(strat)} <span class="text-xs font-normal text-gray-500 ml-1">(${items.length}종목)</span></span>
                        </h4>
                    </div>
                    <div class="text-right flex items-center gap-3 shrink-0">
                        <div>
                            <p class="font-bold text-gray-800 text-sm">${stratTotal.toLocaleString()}원</p>
                        </div>
                        <i class="fas fa-chevron-down text-gray-400 text-xs ml-1"></i>
                    </div>
                </button>
                <!-- 1st Level Accordion Body -->
                <div id="strat-${stratIdx}" class="hidden p-3 bg-white border-t border-gray-200 flex flex-col gap-2">
                    ${items.map(item => {
                        globalIdx++;
                        const tickerLabel = item.ticker ? escapeHtml(item.ticker) : '<span class="text-xs text-gray-400">미입력</span>';
                        const avgBuyPriceText = item.avgBuyPrice
                            ? `${Number(item.avgBuyPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${escapeHtml(item.currency || '')}`.trim()
                            : '<span class="text-xs text-gray-400">미입력</span>';
                        const priceInputId = `market-price-${globalIdx}`;
                        const priceDateInputId = `market-date-${globalIdx}`;
                        const marketPriceText = item.marketPrice ? formatUnitPrice(item.marketPrice.price, item.marketPrice.currency) : '미입력';
                        const marketPriceValue = item.marketPrice?.price ?? '';
                        const marketPriceDate = item.marketPrice?.priceDate || new Date().toISOString().slice(0, 10);
                        const currentValueText = item.hasComparablePrice ? formatUnitPrice(item.currentValue, item.currency) : '계산 대기';
                        const investedCostText = item.hasComparablePrice ? formatUnitPrice(item.investedCost, item.currency) : '계산 대기';
                        const pnlText = item.hasComparablePrice
                            ? `${item.unrealizedPnl >= 0 ? '+' : ''}${formatUnitPrice(item.unrealizedPnl, item.currency)} (${item.returnPct.toFixed(1)}%)`
                            : (item.marketPrice && String(item.marketPrice.currency || '').toUpperCase() !== String(item.currency || '').toUpperCase() ? '통화 확인 필요' : '현재가/평균단가 필요');
                        const pnlClass = item.hasComparablePrice ? (item.unrealizedPnl >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-gray-400';
                        const jsTicker = escapeJsString(item.ticker || '');
                        const jsCurrency = escapeJsString(item.currency || 'KRW');
                        const priceSaveDisabled = item.ticker ? '' : 'disabled';

                        return `
                        <div class="bg-white border border-gray-100 rounded-lg flex flex-col overflow-hidden hover:border-indigo-300 transition-colors">
                            <!-- 2nd Level Accordion Header (Stock) -->
                            <button onclick="document.getElementById('acc-${globalIdx}').classList.toggle('hidden')" class="w-full p-3 flex justify-between items-center hover:bg-gray-50 transition-colors focus:outline-none text-left">
                                <div class="flex-1">
                                    <h4 class="font-bold text-gray-800 text-sm leading-tight flex items-center gap-1.5 flex-wrap">
                                        ${escapeHtml(item.name)}
                                        ${getAssetClassBadgeHtml(item.classification)}
                                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-white" style="color: ${item.strategyColor}; border-color: ${item.strategyColor}33">${escapeHtml(item.strategy)}</span>
                                    </h4>
                                </div>
                                <div class="text-right flex items-center gap-3 shrink-0">
                                    <div>
                                        <p class="font-bold text-gray-800 text-sm">${item.amount.toLocaleString()}원</p>
                                    </div>
                                    <i class="fas fa-chevron-down text-gray-300 text-xs ml-1"></i>
                                </div>
                            </button>
                            <!-- 2nd Level Accordion Body (Hidden by default) -->
                            <div id="acc-${globalIdx}" class="hidden p-3 border-t border-gray-100 bg-gray-50/50">
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1"><i class="fas fa-hashtag text-sky-400 mr-1"></i>Ticker</p>
                                        <p class="font-bold text-gray-800 text-xs">${tickerLabel}</p>
                                    </div>
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1"><i class="fas fa-compass text-amber-400 mr-1"></i>전략</p>
                                        <p class="font-bold text-gray-800 text-xs">${escapeHtml(item.strategy)}</p>
                                    </div>
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1"><i class="fas fa-chart-pie text-indigo-400 mr-1"></i>보유 수량</p>
                                        <p class="font-bold text-gray-800 text-xs">${item.shares ? item.shares.toLocaleString() + '주' : '<span class="text-xs text-gray-400">데이터 없음</span>'}</p>
                                    </div>
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1"><i class="fas fa-receipt text-emerald-400 mr-1"></i>평균단가</p>
                                        <p class="font-bold text-gray-800 text-xs">${avgBuyPriceText}</p>
                                    </div>
                                </div>
                                <div class="mt-3 grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-2">
                                    <label class="flex flex-col gap-1">
                                        <span class="text-[10px] text-gray-400 font-bold"><i class="fas fa-won-sign text-indigo-400 mr-1"></i>수동 현재가</span>
                                        <input id="${priceInputId}" type="number" min="0" step="0.0001" value="${escapeAttr(marketPriceValue)}" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="현재가">
                                    </label>
                                    <label class="flex flex-col gap-1">
                                        <span class="text-[10px] text-gray-400 font-bold">가격일</span>
                                        <input id="${priceDateInputId}" type="date" value="${escapeAttr(marketPriceDate)}" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none">
                                    </label>
                                    <button ${priceSaveDisabled} onclick="saveMarketPrice('${jsTicker}', '${jsCurrency}', '${priceInputId}', '${priceDateInputId}')" class="self-end h-[34px] px-3 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                                        저장
                                    </button>
                                </div>
                                <div class="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1">현재가</p>
                                        <p class="font-bold text-gray-800 text-xs">${marketPriceText}</p>
                                    </div>
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1">투입원가</p>
                                        <p class="font-bold text-gray-800 text-xs">${investedCostText}</p>
                                    </div>
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1">현재가 기준</p>
                                        <p class="font-bold text-gray-800 text-xs">${currentValueText}</p>
                                    </div>
                                    <div class="bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                        <p class="text-[10px] font-bold text-gray-400 mb-1">미실현 손익</p>
                                        <p class="font-bold text-xs ${pnlClass}">${pnlText}</p>
                                    </div>
                                </div>
                                <div class="mt-2 bg-white p-2 rounded-md border border-gray-100 shadow-sm">
                                    <p class="text-[10px] font-bold text-gray-400 mb-1"><i class="fas fa-wallet text-emerald-400 mr-1"></i>DB 평가 금액</p>
                                    <p class="font-bold text-gray-800 text-xs">${item.amount.toLocaleString()}원</p>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        listContainer.innerHTML = htmlContent;

        // 4. 전략별 비중 차트 및 레전드 렌더링
        const strategyTotals = {};
        processedItems.forEach(item => {
            const strategyKey = item.strategyTag || 'other';
            strategyTotals[strategyKey] = (strategyTotals[strategyKey] || 0) + item.amount;
        });
        const sKeys = getOrderedStrategyKeys(strategyTotals);
        const sLabels = sKeys.map(key => getStrategyMeta(key).label);
        const sData = sKeys.map(key => strategyTotals[key]);
        const sColors = sKeys.map(key => getStrategyMeta(key).color);

        const legendContainer = document.getElementById('invest-strategy-legend');
        legendContainer.innerHTML = sLabels.map((lbl, i) => {
            const pct = total > 0 ? ((sData[i] / total) * 100).toFixed(1) : 0;
            return `<div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${sColors[i]}"></div>
                    <span class="text-[10px] text-gray-600">${escapeHtml(lbl)}</span>
                </div>
                <span class="text-[10px] font-bold text-gray-800">${pct}%</span>
            </div>`;
        }).join('');

        renderOrUpdateChart('investStrategy', 'investStrategyChart', {
            type: 'doughnut',
            data: {
                labels: sLabels,
                datasets: [{ data: sData, backgroundColor: sColors, borderWidth: 0 }]
            },
            options: withChartTransitions({ cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: true } }, maintainAspectRatio: false }, 420)
        });
        } catch (e) {
            alert("Error in renderInvestDetail: " + e.message + "\n" + e.stack);
            console.error(e);
        }
    }
