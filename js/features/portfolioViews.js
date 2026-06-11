// Portfolio and investment detail rendering extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    function renderPortfolio() {
        if(!currentMonthKey) return;
        const shortYear = currentMonthKey.substring(2, 4); const shortMonth = currentMonthKey.substring(5, 7);
        const targetLabel = `${shortYear}.${shortMonth}`;

        const keys = getMonthKeys();
        const isLatestMonth = currentMonthKey === keys[keys.length - 1];
        const snapshot = dynamicAssetSnapshots[targetLabel];

        let totalCashAndSafe = 0, totalInvest = 0, totalDebt = 0;
        let totalLiquid = 0, totalTied = 0;
        let chartLabels = [], chartData = [], chartColors = [];

        const badge = document.getElementById('portfolio-month-badge');
        if (isLatestMonth) {
            badge.classList.add('hidden');
        } else {
            badge.classList.remove('hidden');
            badge.textContent = `${targetLabel} 스냅샷`;
        }
        const wrapper = document.getElementById('portfolio-accordion-wrapper');
        const notice = document.getElementById('portfolio-past-notice');

        if (isLatestMonth && dynamicPortfolioData) {
            wrapper.classList.remove('hidden'); notice.classList.add('hidden'); wrapper.innerHTML = '';
            getSortedPortfolioGroups(dynamicPortfolioData).forEach(([groupName, groupData]) => {
                const sum = groupData.items.reduce((acc, curr) => acc + curr.amount, 0);

                groupData.items.forEach(item => {
                    if (groupData.isDebt || item.classification?.assetType === 'debt') {
                        totalDebt += item.amount;
                    } else if (item.classification?.assetType === 'stock' || item.classification?.assetType === 'etf' || item.classification?.assetType === 'pension') {
                        totalInvest += item.amount;
                    } else {
                        totalCashAndSafe += item.amount;
                    }

                    if (!groupData.isDebt && item.classification?.assetType !== 'debt') {
                        if (item.maturity || item.classification?.assetType === 'pension' || groupName.includes('부동산') || groupName.includes('보증금')) {
                            totalTied += item.amount;
                        } else {
                            totalLiquid += item.amount;
                        }
                    }
                });

                if (!groupData.isDebt && sum > 0) {
                    chartLabels.push(groupName); chartData.push(sum);
                    chartColors.push(groupName.includes('투자') ? '#A855F7' : (groupName.includes('연금') ? '#EC4899' : (groupName.includes('안전') ? '#10B981' : (groupName.includes('기타') ? '#E5E7EB' : '#3B82F6'))));
                }

                const isDebt = groupData.isDebt;
                // 💡 아코디언이 닫혀있도록 'open' 클래스 제거
                const safeGroupName = escapeHtml(groupName);
                const jsGroupName = escapeJsString(groupName);
                const itemHtml = `
                <div class="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    <div class="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onclick="toggleAccordion(this)">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full ${groupData.bg} ${groupData.color} flex items-center justify-center text-sm">
                                <i class="fas ${isDebt ? 'fa-credit-card' : (groupName.includes('투자') ? 'fa-chart-line' : (groupName.includes('안전') ? 'fa-lock' : 'fa-coins'))}"></i>
                            </div>
                            <span class="font-bold text-gray-800 text-sm md:text-base">${safeGroupName}</span>
                            ${groupName.includes('투자') ? `<button onclick="event.stopPropagation(); renderInvestDetail('${jsGroupName}'); switchView('invest-detail-view');" class="ml-2 text-[10px] bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded font-bold hover:bg-purple-100 transition-colors z-10">상세보기 <i class="fas fa-chevron-right ml-1 text-[8px]"></i></button>` : ''}
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="font-bold ${isDebt ? 'text-red-500' : 'text-gray-800'} text-sm md:text-base">${sum.toLocaleString()}원</span>
                            <i class="fas fa-chevron-down text-gray-400 accordion-icon text-sm"></i>
                        </div>
                    </div>
                    <div class="accordion-content bg-white">
                        <div class="p-4 space-y-3 border-t border-gray-100">
                            ${groupData.items.length > 0 ? groupData.items.map(item => `
                                <div class="flex justify-between items-center text-sm">
                                    <span class="text-gray-600 flex items-center gap-2">
                                        <div class="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                                        ${escapeHtml(item.name)}
                                        ${getAssetClassBadgeHtml(item.classification)}
                                        ${item.maturity ? `<span class="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-bold whitespace-nowrap"><i class="fas fa-lock text-[9px]"></i> 묶인 돈 (${escapeHtml(item.maturity)})</span>` : ''}
                                    </span>
                                    <div class="text-right flex flex-col items-end">
                                        <span class="font-medium ${item.amount < 0 ? 'text-red-500' : 'text-gray-700'}">${item.amount.toLocaleString()}원</span>
                                        ${item.shares ? `<span class="text-[10px] text-gray-400 font-bold tracking-tight">${item.shares.toLocaleString()}주 | 단가 ${Math.floor(item.amount / item.shares).toLocaleString()}원</span>` : ''}
                                    </div>
                                </div>
                            `).join('') : '<p class="text-sm text-gray-400 text-center py-2">등록된 내역이 없습니다.</p>'}
                        </div>
                    </div>
                </div>`;
                wrapper.insertAdjacentHTML('beforeend', itemHtml);
            });
        } else if (snapshot) {
            wrapper.classList.add('hidden'); notice.classList.remove('hidden');
            totalCashAndSafe = snapshot.cash + snapshot.safe; totalInvest = snapshot.invest; totalDebt = snapshot.debt;

            if(totalCashAndSafe > 0) { chartLabels.push('현금/안전 자산'); chartData.push(totalCashAndSafe); chartColors.push('#3B82F6'); }
            if(totalInvest > 0) { chartLabels.push('투자 자산'); chartData.push(totalInvest); chartColors.push('#A855F7'); }
        } else {
            wrapper.classList.add('hidden'); notice.classList.remove('hidden');
            document.getElementById('portfolio-past-notice-text').textContent = `해당 월의 자산 구성 스냅샷 데이터가 존재하지 않습니다.`;
        }

        document.getElementById('pf-networth').textContent = (totalCashAndSafe + totalInvest + totalDebt).toLocaleString() + '원';
        document.getElementById('pf-safe-sum').textContent = totalCashAndSafe.toLocaleString() + '원';
        document.getElementById('pf-invest-sum').textContent = totalInvest.toLocaleString() + '원';
        document.getElementById('pf-debt-sum').textContent = totalDebt.toLocaleString() + '원';

        if(document.getElementById('pf-liquid-sum')) {
            document.getElementById('pf-liquid-sum').textContent = totalLiquid.toLocaleString() + '원';
            document.getElementById('pf-tied-sum').textContent = totalTied.toLocaleString() + '원';
        }

        const renderDoughnut = (ctxId, chartKey, isMini = false) => {
            renderOrUpdateChart(chartKey, ctxId, {
                type: 'doughnut',
                data: { labels: chartLabels, datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 0, hoverOffset: 4 }] },
                options: withChartTransitions({ responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: isMini ? 8 : 10, font: { size: isMini ? 10 : 11, color: '#4B5563' } } }, tooltip: { callbacks: { label: function(c) { return ' ' + c.raw.toLocaleString() + '원'; } } } } }, 420)
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

        // 종목별 전략 태그 부여. DB 값이 있으면 우선 사용하고, 없으면 기존 규칙으로 추론한다.
        const processedItems = groupData.items.map(item => {
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
        });
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

        renderQuantStrategyStructure(processedItems, total);
        renderMarketSyncStatus(processedItems);
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
