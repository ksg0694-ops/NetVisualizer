// Quant strategy, rebalance, and market-price helpers extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    let strategyBoardDraggedId = '';
    const strategyMoveInFlight = new Set();
    let strategyManagerOpen = false;
    let strategyDefinitionSaving = false;
    const CUSTOM_STRATEGY_COLORS = ['#0f766e', '#4f46e5', '#c2410c', '#be123c', '#0369a1', '#7e22ce'];

    function renderQuantStrategyStructure(processedItems = [], total = 0) {
        const container = document.getElementById('invest-quant-structure');
        if (!container) return;

        const groupedItems = {};
        const strategyTotals = {};
        processedItems.forEach(item => {
            const key = item.strategyTag || 'other';
            if (!groupedItems[key]) groupedItems[key] = [];
            groupedItems[key].push(item);
            strategyTotals[key] = (strategyTotals[key] || 0) + item.amount;
        });

        const structureKeys = INVEST_STRATEGY_KEYS.filter(key => {
            const rule = quantStrategyRules[key] || {};
            return rule.isActive !== false && ((rule.targetPct || 0) > 0 || (strategyTotals[key] || 0) !== 0);
        }).sort((a, b) => (quantStrategyRules[a]?.displayOrder || 0) - (quantStrategyRules[b]?.displayOrder || 0));

        let missingDataCount = 0;
        let rebalanceCount = 0;

        container.className = 'space-y-1.5';
        container.innerHTML = structureKeys.map(key => {
            const meta = getStrategyMeta(key);
            const rule = quantStrategyRules[key] || DEFAULT_QUANT_STRATEGY_RULES.other;
            const items = groupedItems[key] || [];
            const amount = strategyTotals[key] || 0;
            const currentPct = total > 0 ? (amount / total) * 100 : 0;
            const targetPct = Number(rule.targetPct || 0);
            const bandPct = Number(rule.bandPct || 0);
            const targetAmount = total > 0 ? (total * targetPct) / 100 : 0;
            const rebalanceDiff = targetAmount - amount;
            const rebalanceAbs = Math.abs(rebalanceDiff);
            const tickerReady = items.filter(item => !!item.ticker).length;
            const avgReady = items.filter(item => !!item.avgBuyPrice).length;
            const priceReady = items.filter(item => !!item.marketPrice).length;
            const hasMissingData = items.length > 0 && (tickerReady < items.length || avgReady < items.length || priceReady < items.length);
            const needsRebalance = items.length > 0 && bandPct > 0 && Math.abs(currentPct - targetPct) > bandPct;
            const rebalanceLabel = total <= 0
                ? '계산 대기'
                : rebalanceAbs < 1
                    ? '유지'
                    : `${formatSignedWon(rebalanceDiff)} ${rebalanceDiff > 0 ? '매수' : '축소'}`;

            if (hasMissingData) missingDataCount += 1;
            if (needsRebalance) rebalanceCount += 1;

            const statusLabel = items.length === 0
                ? '대기'
                : hasMissingData && needsRebalance
                    ? '데이터/리밸런싱'
                    : hasMissingData
                    ? '데이터 필요'
                    : needsRebalance
                        ? '리밸런싱'
                        : '정상범위';
            const statusClass = items.length === 0
                ? 'text-gray-500 bg-gray-100'
                : hasMissingData
                    ? 'text-amber-600 bg-amber-50'
                    : needsRebalance
                        ? 'text-rose-600 bg-rose-50'
                        : 'text-emerald-600 bg-emerald-50';

            return `
                <div class="rounded-xl border border-gray-100 bg-white px-3 py-2">
                    <div class="grid grid-cols-[minmax(80px,1fr)_48px_58px_58px_minmax(72px,0.8fr)] md:grid-cols-[minmax(140px,1.2fr)_64px_70px_70px_minmax(120px,1fr)] gap-2 items-center">
                        <div class="min-w-0">
                            <div class="flex items-center gap-2 min-w-0">
                                <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${meta.color}"></span>
                                <span class="text-[11px] md:text-xs font-bold text-gray-800 truncate">${escapeHtml(meta.label)}</span>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${statusClass} hidden md:inline">${statusLabel}</span>
                            </div>
                            <div class="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div class="h-full rounded-full" style="width: ${Math.min(100, Math.max(0, currentPct))}%; background-color: ${meta.color}"></div>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-[9px] text-gray-400 font-bold">현재</p>
                            <p class="text-[11px] font-black text-gray-800">${currentPct.toFixed(1)}%</p>
                        </div>
                        <label class="min-w-0">
                            <span class="block text-[9px] text-gray-400 font-bold">목표</span>
                            <input id="quant-target-${key}" type="number" min="0" max="100" step="0.1" value="${escapeAttr(targetPct)}" oninput="markQuantRulesDirty()" class="w-full border border-gray-200 rounded-md px-1 py-1 text-[10px] font-bold text-gray-800 text-right focus:ring-1 focus:ring-indigo-500 outline-none">
                        </label>
                        <label class="min-w-0">
                            <span class="block text-[9px] text-gray-400 font-bold">밴드</span>
                            <input id="quant-band-${key}" type="number" min="0" max="100" step="0.1" value="${escapeAttr(bandPct)}" oninput="markQuantRulesDirty()" class="w-full border border-gray-200 rounded-md px-1 py-1 text-[10px] font-bold text-gray-800 text-right focus:ring-1 focus:ring-indigo-500 outline-none">
                        </label>
                        <div class="min-w-0 text-right">
                            <input id="quant-trigger-${key}" type="hidden" value="${escapeAttr(rule.trigger)}">
                            <p class="text-[9px] text-gray-400 font-bold">리밸런싱</p>
                            <p class="text-[10px] md:text-[11px] font-bold truncate ${needsRebalance ? 'text-rose-600' : 'text-gray-500'}">${rebalanceLabel}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const status = document.getElementById('invest-quant-status');
        if (status) {
            status.textContent = missingDataCount > 0 ? `${missingDataCount}개 데이터 필요` : (rebalanceCount > 0 ? `${rebalanceCount}개 리밸런싱` : '구조 준비');
        }
    }

    function buildQuantRebalanceSignalRows(processedItems = activeInvestProcessedItems, total = activeInvestTotal, groupName = activeInvestGroupName) {
        const groupedItems = {};
        const strategyTotals = {};
        processedItems.forEach(item => {
            const key = item.strategyTag || 'other';
            if (!groupedItems[key]) groupedItems[key] = [];
            groupedItems[key].push(item);
            strategyTotals[key] = (strategyTotals[key] || 0) + Number(item.amount || 0);
        });

        const keys = INVEST_STRATEGY_KEYS.filter(key => {
            const rule = quantStrategyRules[key] || {};
            return rule.isActive !== false && ((rule.targetPct || 0) > 0 || (strategyTotals[key] || 0) !== 0);
        }).sort((a, b) => (quantStrategyRules[a]?.displayOrder || 0) - (quantStrategyRules[b]?.displayOrder || 0));

        const generatedAt = new Date().toISOString();
        return keys.map(key => {
            const meta = getStrategyMeta(key);
            const rule = quantStrategyRules[key] || DEFAULT_QUANT_STRATEGY_RULES.other;
            const items = groupedItems[key] || [];
            const amount = strategyTotals[key] || 0;
            const targetPct = Number(readQuantRuleInput(key, 'target', rule.targetPct));
            const bandPct = Number(readQuantRuleInput(key, 'band', rule.bandPct));
            const triggerLabel = readQuantRuleInput(key, 'trigger', rule.trigger);
            const currentPct = total > 0 ? (amount / total) * 100 : 0;
            const targetAmount = total > 0 ? (total * targetPct) / 100 : 0;
            const rebalanceAmount = targetAmount - amount;
            const tickerReady = items.filter(item => !!item.ticker).length;
            const avgReady = items.filter(item => !!item.avgBuyPrice).length;
            const priceReady = items.filter(item => !!item.marketPrice).length;
            const missingDataCount = Math.max(0, items.length * 3 - tickerReady - avgReady - priceReady);
            const hasMissingData = items.length > 0 && missingDataCount > 0;
            const needsRebalance = items.length > 0 && bandPct > 0 && Math.abs(currentPct - targetPct) > bandPct;
            const status = items.length === 0
                ? 'wait'
                : hasMissingData
                    ? 'data_needed'
                    : needsRebalance
                        ? 'rebalance'
                        : 'ok';

            return {
                group_name: groupName || '투자',
                strategy_tag: key,
                strategy_label: meta.label,
                current_amount: Math.round(amount),
                target_amount: Math.round(targetAmount),
                rebalance_amount: Math.round(rebalanceAmount),
                current_pct: Number(currentPct.toFixed(4)),
                target_pct: Number(targetPct.toFixed(4)),
                band_pct: Number(bandPct.toFixed(4)),
                status,
                trigger_label: String(triggerLabel || ''),
                item_count: items.length,
                ticker_ready_count: tickerReady,
                avg_ready_count: avgReady,
                price_ready_count: priceReady,
                missing_data_count: missingDataCount,
                generated_at: generatedAt
            };
        });
    }

    window.saveQuantRebalanceSignals = async function() {
        const btn = document.getElementById('btn-save-quant-signal');
        const statusEl = document.getElementById('invest-quant-status');
        const originalHtml = btn ? btn.innerHTML : '';
        const rows = buildQuantRebalanceSignalRows();

        if (rows.length === 0) {
            showToast('저장할 Quant 신호가 없습니다.', 'warning', 2200);
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[9px]"></i> 신호';
        }
        if (statusEl) statusEl.textContent = '신호 저장 중';

        try {
            const _supabase = getAuthenticatedSupabaseClient();
            const { error } = await _supabase
                .from('quant_rebalance_signals')
                .insert(rows);
            if (error) throw error;

            const rebalanceCount = rows.filter(row => row.status === 'rebalance').length;
            const dataNeededCount = rows.filter(row => row.status === 'data_needed').length;
            const message = `Quant 신호 ${rows.length}건 저장`
                + (rebalanceCount ? ` · 리밸런싱 ${rebalanceCount}건` : '')
                + (dataNeededCount ? ` · 데이터필요 ${dataNeededCount}건` : '');
            showToast(message, dataNeededCount ? 'warning' : 'info', 2600);
            if (statusEl) statusEl.textContent = rebalanceCount > 0 ? `${rebalanceCount}개 리밸런싱` : '신호 저장됨';
        } catch (error) {
            console.error('Quant 신호 저장 실패:', error);
            if (statusEl) statusEl.textContent = '신호 저장 실패';
            alert('Quant 신호 저장 실패: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fas fa-flag-checkered text-[9px]"></i> 신호';
            }
        }
    };

    function renderMarketSyncStatus(processedItems = []) {
        const container = document.getElementById('invest-market-sync-status');
        if (!container) return;

        const tickers = [...new Set(
            processedItems
                .map(item => String(item.ticker || '').trim().toUpperCase())
                .filter(Boolean)
        )];
        const prices = typeof getMergedMarketPriceRows === 'function'
            ? getMergedMarketPriceRows()
            : (dataCache.marketPrices || []);
        const scopedPrices = prices.filter(row => {
            const ticker = String(row.ticker || '').trim().toUpperCase();
            return ticker && (tickers.length === 0 || tickers.includes(ticker));
        });
        const overrideCount = scopedPrices.filter(row => row.sourceScope === 'override').length;
        const apiCount = scopedPrices.filter(row => row.source === 'api').length;
        const latestDate = scopedPrices
            .map(row => row.price_date || '')
            .filter(Boolean)
            .sort()
            .pop();

        const tickerLabel = tickers.length > 0 ? `${tickers.length}개 ticker` : 'ticker 대기';
        const priceLabel = scopedPrices.length > 0
            ? `시세 ${scopedPrices.length}건 (내 override ${overrideCount} / API ${apiCount})`
            : '시세 미입력';
        const latestLabel = latestDate ? `최근 가격일 ${latestDate}` : '가격일 없음';

        container.innerHTML = `
            <span class="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
                <i class="fas fa-lock text-[9px]"></i> 무료모드
            </span>
            <span class="inline-flex items-center gap-1 bg-white border border-gray-100 px-2 py-1 rounded">
                <i class="fas fa-hashtag text-sky-400 text-[9px]"></i> ${escapeHtml(tickerLabel)}
            </span>
            <span class="inline-flex items-center gap-1 bg-white border border-gray-100 px-2 py-1 rounded">
                <i class="fas fa-database text-indigo-400 text-[9px]"></i> ${escapeHtml(priceLabel)}
            </span>
            <span class="inline-flex items-center gap-1 bg-white border border-gray-100 px-2 py-1 rounded">
                <i class="fas fa-calendar-day text-amber-400 text-[9px]"></i> ${escapeHtml(latestLabel)}
            </span>
            <span class="inline-flex items-center gap-1 text-gray-500 bg-white border border-gray-100 px-2 py-1 rounded">
                KIS 키 대기
            </span>
        `;
    }

    function renderStrategyPerformance(processedItems = []) {
        const container = document.getElementById('invest-strategy-performance');
        if (!container) return;

        const grouped = {};
        processedItems.forEach(item => {
            const key = item.strategyTag || 'other';
            if (!grouped[key]) {
                grouped[key] = { amount: 0, count: 0, priced: 0, byCurrency: {} };
            }

            grouped[key].amount += Number(item.amount || 0);
            grouped[key].count += 1;

            if (item.hasComparablePrice) {
                const currency = String(item.currency || 'KRW').toUpperCase();
                if (!grouped[key].byCurrency[currency]) {
                    grouped[key].byCurrency[currency] = { cost: 0, current: 0, pnl: 0 };
                }
                grouped[key].priced += 1;
                grouped[key].byCurrency[currency].cost += Number(item.investedCost || 0);
                grouped[key].byCurrency[currency].current += Number(item.currentValue || 0);
                grouped[key].byCurrency[currency].pnl += Number(item.unrealizedPnl || 0);
            }
        });

        const keys = getOrderedStrategyKeys(grouped);
        if (keys.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-400">전략 데이터가 없습니다.</p>';
            return;
        }

        container.innerHTML = keys.map(key => {
            const meta = getStrategyMeta(key);
            const group = grouped[key];
            const readyClass = group.priced === group.count && group.count > 0
                ? 'text-emerald-600 bg-emerald-50'
                : group.priced > 0
                    ? 'text-amber-600 bg-amber-50'
                    : 'text-gray-500 bg-gray-100';
            const currencyRows = Object.entries(group.byCurrency).sort(([a], [b]) => a.localeCompare(b)).map(([currency, bucket]) => {
                const returnPct = bucket.cost > 0 ? (bucket.pnl / bucket.cost) * 100 : 0;
                const pnlClass = bucket.pnl >= 0 ? 'text-emerald-600' : 'text-red-500';
                return `
                    <div class="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1.5">
                        <span class="text-[10px] font-bold text-gray-500">${escapeHtml(currency)}</span>
                        <span class="text-[10px] font-bold ${pnlClass}">${formatSignedUnitPrice(bucket.pnl, currency)} (${returnPct.toFixed(1)}%)</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="border border-gray-100 rounded-xl p-3 border-l-4" style="border-left-color: ${meta.color}">
                    <div class="flex items-start justify-between gap-2 mb-2">
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(meta.label)}</p>
                            <p class="text-[10px] text-gray-400">${group.count}종목 · DB 평가 ${formatWon(group.amount)}</p>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${readyClass}">${group.priced}/${group.count}</span>
                    </div>
                    <div class="space-y-1">
                        ${currencyRows || '<div class="rounded-lg bg-gray-50 px-2 py-1.5 text-[10px] font-bold text-gray-400">현재가/평균단가 필요</div>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPortfolioStrategyManager() {
        const container = document.getElementById('invest-strategy-manager');
        if (!container) return;
        container.classList.toggle('hidden', !strategyManagerOpen);
        if (!strategyManagerOpen) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="mb-2 flex items-center justify-between gap-2">
                <div>
                    <p class="text-xs font-black text-gray-900">전략 박스 관리</p>
                    <p class="mt-0.5 text-[9px] text-gray-500">이름을 바꿔도 종목 분류는 유지됩니다.</p>
                </div>
                <button type="button" onclick="togglePortfolioStrategyManager()" class="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white hover:text-gray-700" aria-label="전략 관리 닫기">
                    <i class="fas fa-xmark text-xs"></i>
                </button>
            </div>
            <div class="grid grid-cols-1 gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                ${INVEST_STRATEGY_KEYS.map((key) => {
                    const meta = getStrategyMeta(key);
                    return `
                        <div class="flex items-center gap-1.5 rounded-lg border border-violet-100 bg-white p-1.5">
                            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-50" style="color:${meta.color}">
                                <i class="fas ${meta.icon} text-[10px]"></i>
                            </span>
                            <input data-strategy-name-input="${escapeAttr(key)}" value="${escapeAttr(meta.label)}" maxlength="40" class="h-7 min-w-0 flex-1 rounded-md border border-gray-200 px-2 text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-violet-400">
                            <button type="button" onclick="savePortfolioStrategyName('${escapeAttr(key)}')" class="h-7 shrink-0 rounded-md bg-gray-900 px-2 text-[9px] font-bold text-white hover:bg-gray-800">저장</button>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="mt-2 flex flex-col gap-1.5 rounded-lg border border-dashed border-violet-200 bg-white/80 p-2 sm:flex-row sm:items-center">
                <input id="new-portfolio-strategy-name" maxlength="40" class="h-8 min-w-0 flex-1 rounded-md border border-gray-200 px-2.5 text-[10px] font-bold text-gray-700 outline-none focus:ring-2 focus:ring-violet-400" placeholder="새 전략 이름">
                <button type="button" onclick="addPortfolioStrategy()" class="h-8 shrink-0 rounded-md bg-violet-600 px-3 text-[10px] font-bold text-white hover:bg-violet-700">
                    <i class="fas fa-plus mr-1 text-[9px]"></i> 전략 추가
                </button>
            </div>
        `;
    }

    function togglePortfolioStrategyManager() {
        strategyManagerOpen = !strategyManagerOpen;
        renderPortfolioStrategyManager();
    }

    async function savePortfolioStrategyName(strategyTag) {
        if (strategyDefinitionSaving || !INVEST_STRATEGY_META[strategyTag]) return;
        const input = document.querySelector(`[data-strategy-name-input="${CSS.escape(strategyTag)}"]`);
        const nextLabel = String(input?.value || '').trim();
        const currentLabel = getStrategyMeta(strategyTag).label;
        if (!nextLabel) {
            showToast('전략 이름을 입력해주세요.', 'warning');
            input?.focus();
            return;
        }
        if (nextLabel === currentLabel) {
            showToast('변경된 전략 이름이 없습니다.', 'info', 1500);
            return;
        }
        if (INVEST_STRATEGY_KEYS.some((key) => key !== strategyTag && getStrategyMeta(key).label === nextLabel)) {
            showToast('같은 이름의 전략이 이미 있습니다.', 'warning');
            input?.focus();
            return;
        }

        strategyDefinitionSaving = true;
        try {
            const { error } = await getAuthenticatedSupabaseClient()
                .from('portfolio_strategy_definitions')
                .update({ label: nextLabel, updated_at: new Date().toISOString() })
                .eq('strategy_tag', strategyTag);
            if (error) throw error;
            await fetchSheetData(false, ['portfolio_strategy_definitions']);
            renderPortfolioStrategyManager();
            showToast(`${currentLabel} → ${nextLabel} 이름을 저장했습니다.`, 'info', 1800);
        } catch (error) {
            showToast(`전략 이름 저장 실패: ${error.message}`, 'error', 3200);
        } finally {
            strategyDefinitionSaving = false;
        }
    }

    async function addPortfolioStrategy() {
        if (strategyDefinitionSaving) return;
        const input = document.getElementById('new-portfolio-strategy-name');
        const label = String(input?.value || '').trim();
        if (!label) {
            showToast('새 전략 이름을 입력해주세요.', 'warning');
            input?.focus();
            return;
        }
        if (INVEST_STRATEGY_KEYS.some((key) => getStrategyMeta(key).label === label)) {
            showToast('같은 이름의 전략이 이미 있습니다.', 'warning');
            input?.focus();
            return;
        }

        const strategyTag = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
        const displayOrder = INVEST_STRATEGY_KEYS.reduce(
            (maxOrder, key) => Math.max(maxOrder, Number(getStrategyMeta(key).displayOrder || 0)),
            0,
        ) + 10;
        const color = CUSTOM_STRATEGY_COLORS[INVEST_STRATEGY_KEYS.length % CUSTOM_STRATEGY_COLORS.length];
        const payload = {
            strategy_tag: strategyTag,
            label,
            color,
            icon: 'fa-layer-group',
            display_order: displayOrder,
            is_active: true,
        };
        const userId = getCurrentUserId();
        if (userId) payload.user_id = userId;

        strategyDefinitionSaving = true;
        try {
            const { error } = await getAuthenticatedSupabaseClient()
                .from('portfolio_strategy_definitions')
                .insert(payload);
            if (error) throw error;
            await fetchSheetData(false, ['portfolio_strategy_definitions']);
            renderPortfolioStrategyManager();
            showToast(`${label} 전략 박스를 추가했습니다.`, 'info', 1800);
        } catch (error) {
            showToast(`전략 추가 실패: ${error.message}`, 'error', 3200);
        } finally {
            strategyDefinitionSaving = false;
        }
    }

    function renderStrategyBoard(processedItems = []) {
        const container = document.getElementById('invest-strategy-board');
        if (!container) return;
        const items = processedItems
            .filter((item) => item.id && Number(item.amount || 0) >= 0)
            .map((item) => ({
                ...item,
                strategyTag: INVEST_STRATEGY_META[item.strategyTag]
                    ? item.strategyTag
                    : inferStrategyTag(item),
            }));
        activeQuantHoldingItems = items;
        const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const options = (selected) => INVEST_STRATEGY_KEYS.map((key) => (
            `<option value="${escapeAttr(key)}" ${selected === key ? 'selected' : ''}>${escapeHtml(getStrategyMeta(key).label)}</option>`
        )).join('');

        container.innerHTML = INVEST_STRATEGY_KEYS.map((key) => {
            const meta = getStrategyMeta(key);
            const laneItems = items
                .filter((item) => item.strategyTag === key)
                .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0) || String(a.name).localeCompare(String(b.name), 'ko-KR'));
            const amount = laneItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const pct = total > 0 ? (amount / total) * 100 : 0;
            const comparableItems = laneItems.filter((item) => item.hasComparablePrice);
            const investedCost = comparableItems.reduce((sum, item) => sum + Number(item.investedCost || 0), 0);
            const unrealizedPnl = comparableItems.reduce((sum, item) => sum + Number(item.unrealizedPnl || 0), 0);
            const returnPct = investedCost > 0 ? (unrealizedPnl / investedCost) * 100 : null;
            const returnClass = returnPct === null
                ? 'text-gray-400'
                : returnPct >= 0 ? 'text-emerald-600' : 'text-rose-500';
            const returnLabel = returnPct === null
                ? '수익률 계산 대기'
                : `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}% · ${comparableItems.length}/${laneItems.length}`;
            return `
                <section data-strategy-lane="${escapeAttr(key)}" class="min-h-[132px] rounded-xl border border-gray-200 bg-gray-50/70 p-2.5 transition">
                    <div class="mb-2 flex items-start justify-between gap-2 border-b border-gray-200 pb-2">
                        <div class="flex min-w-0 items-center gap-2">
                            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm" style="color:${meta.color}">
                                <i class="fas ${meta.icon} text-xs"></i>
                            </span>
                            <div class="min-w-0">
                                <h4 class="truncate text-xs font-black text-gray-900">${escapeHtml(meta.label)}</h4>
                                <p class="text-[9px] text-gray-400">${laneItems.length}개 · ${pct.toFixed(1)}%</p>
                            </div>
                        </div>
                        <div class="shrink-0 text-right">
                            <p class="text-[11px] font-black text-gray-800">${formatWon(amount)}</p>
                            <p class="mt-0.5 text-[9px] font-bold ${returnClass}">${returnLabel}</p>
                        </div>
                    </div>
                    <div class="space-y-1.5" data-strategy-card-list>
                        ${laneItems.length ? laneItems.map((item) => {
                            const pnlClass = Number(item.unrealizedPnl || 0) >= 0 ? 'text-emerald-600' : 'text-rose-500';
                            const accountLabel = item.accountName || item.groupName || '계좌 미지정';
                            return `
                                <article draggable="true" tabindex="0" data-strategy-holding="${escapeAttr(item.id)}" class="group cursor-grab rounded-lg border border-gray-200 bg-white px-2.5 py-2 shadow-sm transition hover:border-violet-300 hover:shadow active:cursor-grabbing">
                                    <div class="flex items-start gap-2">
                                        <span class="mt-0.5 text-gray-300 group-hover:text-violet-400"><i class="fas fa-grip-vertical text-[10px]"></i></span>
                                        <div class="min-w-0 flex-1">
                                            <div class="flex items-start justify-between gap-2">
                                                <p class="truncate text-[11px] font-bold text-gray-800">${escapeHtml(item.name || '보유자산')}</p>
                                                <p class="shrink-0 text-[11px] font-black text-gray-900">${formatWon(item.amount)}</p>
                                            </div>
                                            <div class="mt-0.5 flex items-center justify-between gap-2">
                                                <p class="min-w-0 truncate text-[9px] text-gray-400">${escapeHtml(item.ticker || accountLabel)}</p>
                                                ${item.hasComparablePrice ? `<p class="shrink-0 text-[9px] font-bold ${pnlClass}">${Number(item.returnPct || 0).toFixed(1)}%</p>` : ''}
                                            </div>
                                            <label class="mt-1.5 block sm:hidden">
                                                <span class="sr-only">전략 선택</span>
                                                <select data-strategy-select="${escapeAttr(item.id)}" class="h-7 w-full rounded-md border border-gray-200 bg-gray-50 px-2 text-[10px] font-bold text-gray-600 outline-none focus:ring-2 focus:ring-violet-400">
                                                    ${options(key)}
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                </article>
                            `;
                        }).join('') : '<div class="flex min-h-[58px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white/60 text-[10px] font-bold text-gray-300">여기로 이동</div>'}
                    </div>
                </section>
            `;
        }).join('');
        bindStrategyBoardControls(container);
        renderPortfolioStrategyManager();
    }

    function bindStrategyBoardControls(container) {
        if (container.dataset.strategyBoardBound === 'true') return;
        container.dataset.strategyBoardBound = 'true';
        container.addEventListener('dragstart', (event) => {
            const card = event.target.closest('[data-strategy-holding]');
            if (!card) return;
            strategyBoardDraggedId = card.dataset.strategyHolding || '';
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', strategyBoardDraggedId);
            card.classList.add('opacity-40');
        });
        container.addEventListener('dragend', (event) => {
            strategyBoardDraggedId = '';
            event.target.closest('[data-strategy-holding]')?.classList.remove('opacity-40');
            container.querySelectorAll('[data-strategy-lane]').forEach((lane) => lane.classList.remove('ring-2', 'ring-violet-300', 'bg-violet-50'));
        });
        container.addEventListener('dragover', (event) => {
            const lane = event.target.closest('[data-strategy-lane]');
            if (!lane || !strategyBoardDraggedId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            container.querySelectorAll('[data-strategy-lane]').forEach((candidate) => candidate.classList.remove('ring-2', 'ring-violet-300', 'bg-violet-50'));
            lane.classList.add('ring-2', 'ring-violet-300', 'bg-violet-50');
        });
        container.addEventListener('drop', async (event) => {
            const lane = event.target.closest('[data-strategy-lane]');
            if (!lane) return;
            event.preventDefault();
            const holdingId = strategyBoardDraggedId || event.dataTransfer.getData('text/plain');
            strategyBoardDraggedId = '';
            await movePortfolioStrategy(holdingId, lane.dataset.strategyLane);
        });
        container.addEventListener('change', async (event) => {
            const select = event.target.closest('[data-strategy-select]');
            if (!select) return;
            await movePortfolioStrategy(select.dataset.strategySelect, select.value);
        });
    }

    async function movePortfolioStrategy(holdingId, nextStrategy) {
        if (!holdingId || !INVEST_STRATEGY_META[nextStrategy] || strategyMoveInFlight.has(holdingId)) return;
        const item = (activeQuantHoldingItems || []).find((candidate) => candidate.id === holdingId);
        if (!item) return;
        const previousStrategy = item.strategyTag || inferStrategyTag(item);
        if (previousStrategy === nextStrategy) return;
        const status = document.getElementById('invest-strategy-save-status');
        strategyMoveInFlight.add(holdingId);
        item.strategyTag = nextStrategy;
        item.portKey = nextStrategy;
        renderStrategyBoard(activeQuantHoldingItems);
        if (status) status.textContent = `${item.name} · ${getStrategyMeta(nextStrategy).label} 저장 중`;

        try {
            const _supabase = getAuthenticatedSupabaseClient();
            const { error } = await _supabase
                .from('portfolios')
                .update({
                    strategy_tag: nextStrategy,
                    classification_updated_at: new Date().toISOString(),
                })
                .eq('id', holdingId);
            if (error) throw error;
            if (status) status.textContent = `${item.name} · ${getStrategyMeta(nextStrategy).label} 저장됨`;
            showToast(`${item.name}을(를) ${getStrategyMeta(nextStrategy).label}(으)로 이동했습니다.`, 'info', 1700);
            await fetchSheetData(false, ['portfolios']);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
        } catch (error) {
            item.strategyTag = previousStrategy;
            item.portKey = previousStrategy;
            renderStrategyBoard(activeQuantHoldingItems);
            if (status) status.textContent = '전략 저장 실패 · 이전 위치로 복원됨';
            showToast(`전략 저장 실패: ${error.message}`, 'error', 3200);
        } finally {
            strategyMoveInFlight.delete(holdingId);
        }
    }

    function renderQuantHoldingEditor(processedItems = []) {
        const container = document.getElementById('invest-holding-editor');
        if (!container) return;
        activeQuantHoldingItems = processedItems;

        const editableItems = processedItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !!item.id);
        const accountSuggestions = [...new Set([
            ...processedItems.map(item => String(item.accountName || '').trim()).filter(Boolean),
            ...Object.values(dynamicPortfolioData || {}).flatMap(group => group.items || [])
                .filter(item => item.classification?.assetType === 'account')
                .map(item => String(item.name || '').trim())
                .filter(Boolean)
        ])].sort((a, b) => a.localeCompare(b, 'ko-KR'));

        const strategyOptions = (selectedKey) => INVEST_STRATEGY_KEYS.map(key => {
            const meta = getStrategyMeta(key);
            const selected = selectedKey === key ? 'selected' : '';
            return `<option value="${escapeAttr(key)}" ${selected}>${escapeHtml(meta.label)}</option>`;
        }).join('');
        const getAccountKey = (item) => {
            return getPortfolioAccountDisplayName(item);
        };
        const accountGroups = {};
        const accountOrderMap = getPortfolioAccountOrderMap(editableItems.map(({ item }) => item));
        editableItems.forEach(entry => {
            const key = getAccountKey(entry.item);
            if (!accountGroups[key]) accountGroups[key] = [];
            accountGroups[key].push(entry);
        });
        const accountEntries = Object.entries(accountGroups).sort(([a], [b]) => comparePortfolioAccounts(a, b, accountOrderMap));

        if (editableItems.length === 0) {
            container.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <h3 class="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-sliders text-purple-500"></i> 계좌별 보유종목 입력</h3>
                    <span class="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">수정 가능 항목 없음</span>
                </div>
                <p class="text-xs text-gray-400 mt-3">저장 가능한 투자 항목 ID가 없습니다.</p>
            `;
            return;
        }

        container.innerHTML = `
            <button type="button" onclick="togglePortfolioEditSection('invest-holding-edit-body', this)" class="w-full flex items-center justify-between gap-2 text-left rounded-xl border border-purple-100 bg-purple-50/70 px-3 py-2.5 hover:bg-purple-50 transition-colors">
                <div class="min-w-0">
                    <h3 class="text-sm md:text-base font-bold text-gray-800 flex items-center gap-2"><i class="fas fa-sliders text-purple-500"></i> 계좌별 보유종목 입력</h3>
                    <p class="text-[10px] md:text-xs text-purple-500 mt-0.5">계좌를 열고 종목을 눌러 티커/수량/평단/전략을 수정</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded">${editableItems.length}개</span>
                    <span data-toggle-label data-open-label="접기" data-closed-label="펼치기" class="text-[10px] font-bold text-purple-700 bg-white border border-purple-100 px-2 py-1 rounded-lg">접기</span>
                    <i class="fas fa-chevron-down text-[10px] text-purple-400 transition-transform" style="transform: rotate(180deg);"></i>
                </div>
            </button>
            <div id="invest-holding-edit-body" class="mt-3">
                <div class="flex items-center justify-between gap-2 mb-2">
                    <p class="text-[10px] font-bold text-gray-400">계좌 ${accountEntries.length}개 · 종목 ${editableItems.length}개</p>
                    <button id="btn-save-quant-holdings" onclick="saveQuantHoldings()" class="shrink-0 text-[10px] md:text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                        <i class="fas fa-save text-[9px]"></i> 보유 저장
                    </button>
                </div>
                <datalist id="quant-account-options">
                    ${accountSuggestions.map(name => `<option value="${escapeAttr(name)}"></option>`).join('')}
                </datalist>
                <div class="space-y-2">
                    ${accountEntries.map(([accountName, rows], accountIndex) => {
                        const accountTotal = rows.reduce((sum, { item }) => sum + Number(item.amount || 0), 0);
                        const accountSectionId = `invest-holding-account-${accountIndex}`;
                        const jsAccountName = escapeJsString(accountName);
                        const isFirstAccount = accountIndex === 0;
                        const isLastAccount = accountIndex === accountEntries.length - 1;
                        return `
                            <div class="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
                                <div onclick="togglePortfolioEditSection('${accountSectionId}', this)" class="w-full px-3 py-2 bg-white hover:bg-purple-50/60 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <div class="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><i class="fas fa-wallet text-[10px]"></i></div>
                                        <div class="min-w-0">
                                            <h4 class="text-xs md:text-sm font-bold text-gray-800 truncate">${escapeHtml(accountName)}</h4>
                                            <p class="text-[9px] text-gray-400">${rows.length}개 종목</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <p class="text-xs font-black text-gray-800 whitespace-nowrap">${accountTotal.toLocaleString()}원</p>
                                        <div class="flex items-center gap-1" onclick="event.stopPropagation()">
                                            <button type="button" title="계좌 위로 이동" aria-label="계좌 위로 이동" onclick="reorderPortfolioAccount('${jsAccountName}', -1)" ${isFirstAccount ? 'disabled' : ''} class="w-6 h-6 rounded-md border border-purple-100 bg-white text-purple-500 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-white transition-colors">
                                                <i class="fas fa-arrow-up text-[9px]"></i>
                                            </button>
                                            <button type="button" title="계좌 아래로 이동" aria-label="계좌 아래로 이동" onclick="reorderPortfolioAccount('${jsAccountName}', 1)" ${isLastAccount ? 'disabled' : ''} class="w-6 h-6 rounded-md border border-purple-100 bg-white text-purple-500 hover:bg-purple-50 disabled:opacity-30 disabled:hover:bg-white transition-colors">
                                                <i class="fas fa-arrow-down text-[9px]"></i>
                                            </button>
                                        </div>
                                        <i class="fas fa-chevron-down text-[10px] text-purple-300 transition-transform"></i>
                                    </div>
                                </div>
                                <div id="${accountSectionId}" class="hidden border-t border-purple-100 p-2 space-y-1.5 bg-purple-50/20">
                                    ${rows.map(({ item, index }) => {
                                        const strategyTag = item.strategyTag || inferStrategyTag(item);
                                        const amountText = Number(item.amount || 0).toLocaleString();
                                        const itemSectionId = `invest-holding-item-${index}`;
                                        const tickerLabel = item.ticker ? item.ticker : 'Ticker';
                                        const sharesLabel = item.shares ? `${Number(item.shares).toLocaleString()}주` : '수량 없음';
                                        return `
                                            <div class="rounded-lg border border-gray-100 bg-white overflow-hidden">
                                                <button type="button" onclick="togglePortfolioEditSection('${itemSectionId}', this)" class="w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left hover:bg-gray-50 transition-colors">
                                                    <div class="min-w-0">
                                                        <p class="text-[11px] md:text-xs font-bold text-gray-800 truncate">${escapeHtml(item.name || '투자자산')}</p>
                                                        <p class="text-[9px] text-gray-400 truncate">${escapeHtml(tickerLabel)} · ${escapeHtml(sharesLabel)} · ${amountText}원</p>
                                                    </div>
                                                    <div class="flex items-center gap-2 shrink-0">
                                                        <span class="text-[10px] font-bold text-gray-500">${escapeHtml(getStrategyMeta(strategyTag).shortLabel)}</span>
                                                        <i class="fas fa-chevron-down text-[10px] text-gray-300 transition-transform"></i>
                                                    </div>
                                                </button>
                                                <div id="${itemSectionId}" class="hidden border-t border-gray-100 bg-gray-50/60 p-2">
                                                    <div class="grid grid-cols-[minmax(0,1fr)_70px_72px] md:grid-cols-[minmax(150px,1.1fr)_96px_100px_112px_112px_84px] gap-1.5 items-center">
                                                        <input id="quant-holding-account-${index}" list="quant-account-options" type="text" value="${escapeAttr(item.accountName || '')}" oninput="markQuantHoldingsDirty()" class="w-full text-[10px] text-purple-600 font-bold bg-purple-50 border border-purple-100 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-purple-400 outline-none" placeholder="계좌명">
                                                        <input id="quant-holding-ticker-${index}" type="text" value="${escapeAttr(item.ticker || '')}" oninput="markQuantHoldingsDirty()" class="uppercase border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-bold focus:ring-1 focus:ring-purple-500 outline-none bg-white" placeholder="Ticker">
                                                        <input id="quant-holding-shares-${index}" type="number" min="0" step="0.0001" value="${escapeAttr(item.shares || '')}" oninput="markQuantHoldingsDirty()" class="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-bold text-right focus:ring-1 focus:ring-purple-500 outline-none bg-white" placeholder="수량">
                                                        <input id="quant-holding-avg-${index}" type="number" min="0" step="0.0001" value="${escapeAttr(item.avgBuyPrice || '')}" oninput="markQuantHoldingsDirty()" class="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-bold text-right focus:ring-1 focus:ring-purple-500 outline-none bg-white" placeholder="평단">
                                                        <select id="quant-holding-strategy-${index}" onchange="markQuantHoldingsDirty()" class="hidden md:block border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-bold focus:ring-1 focus:ring-purple-500 outline-none bg-white">
                                                        ${strategyOptions(strategyTag)}
                                                        </select>
                                                        <p class="hidden md:block text-[11px] font-bold text-gray-500 text-right truncate">${amountText}원</p>
                                                    </div>
                                                    <div class="md:hidden grid grid-cols-[minmax(0,1fr)_82px] gap-1.5 mt-1.5">
                                                        <select id="quant-holding-strategy-mobile-${index}" onchange="document.getElementById('quant-holding-strategy-${index}').value=this.value; markQuantHoldingsDirty()" class="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] font-bold focus:ring-1 focus:ring-purple-500 outline-none bg-white">
                                                            ${strategyOptions(strategyTag)}
                                                        </select>
                                                        <p class="text-[11px] font-bold text-gray-500 text-right truncate self-center">${amountText}원</p>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    window.reorderPortfolioAccount = async function(accountName, direction) {
        const rows = (activeQuantHoldingItems || activeInvestProcessedItems || [])
            .filter(item => !!item.id)
            .map(item => ({ item, accountName: getPortfolioAccountDisplayName(item) }));
        const accountOrderMap = getPortfolioAccountOrderMap(rows.map(({ item }) => item));
        const accountNames = [...new Set(rows.map(row => row.accountName))]
            .sort((a, b) => comparePortfolioAccounts(a, b, accountOrderMap));
        const fromIndex = accountNames.indexOf(accountName);
        const toIndex = fromIndex + Number(direction || 0);

        if (fromIndex === -1 || toIndex < 0 || toIndex >= accountNames.length) return;

        [accountNames[fromIndex], accountNames[toIndex]] = [accountNames[toIndex], accountNames[fromIndex]];
        const nextOrderMap = saveStoredPortfolioAccountOrder(accountNames);

        rows.forEach(({ item, accountName: rowAccountName }) => {
            if (Number.isFinite(Number(nextOrderMap[rowAccountName]))) item.accountOrder = nextOrderMap[rowAccountName];
        });

        const status = document.getElementById('invest-quant-status');
        if (status) status.textContent = '계좌 순서 저장 중';
        renderQuantHoldingEditor(activeQuantHoldingItems || activeInvestProcessedItems || []);

        try {
            const _supabase = getAuthenticatedSupabaseClient();
            const updates = accountNames
                .filter(name => name !== PORTFOLIO_UNASSIGNED_ACCOUNT && Number.isFinite(Number(nextOrderMap[name])))
                .map(name => {
                    const ids = rows
                        .filter(row => row.accountName === name)
                        .map(row => row.item.id)
                        .filter(Boolean);
                    return { name, ids, accountOrder: nextOrderMap[name] };
                })
                .filter(update => update.ids.length > 0);

            for (const update of updates) {
                const { error } = await _supabase
                    .from('portfolios')
                    .update({ account_order: update.accountOrder })
                    .in('id', update.ids);
                if (error) throw error;
            }

            if (status) status.textContent = '계좌 순서 저장됨';
            showToast('계좌 순서를 저장했습니다.', 'info', 1600);
            await fetchSheetData(false, ['portfolios']);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
        } catch (error) {
            if (status) status.textContent = '계좌 순서 로컬 저장됨';
            showToast('현재 브라우저에 계좌 순서를 저장했습니다. Supabase 컬럼 적용 후에는 기기 간 동기화됩니다.', 'warning', 3200);
            console.warn('Account order DB save skipped:', error);
        }
    };

    window.markQuantHoldingsDirty = function() {
        const status = document.getElementById('invest-quant-status');
        if (status) status.textContent = '보유 수정 중';
    };

    window.saveQuantHoldings = async function() {
        const btn = document.getElementById('btn-save-quant-holdings');
        const status = document.getElementById('invest-quant-status');
        const originalHtml = btn ? btn.innerHTML : '';
        const rows = (activeQuantHoldingItems || activeInvestProcessedItems || [])
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => !!item.id);

        if (rows.length === 0) {
            showToast('저장할 투자 항목이 없습니다.', 'warning', 2200);
            return;
        }

        const updates = [];
        for (const { item, index } of rows) {
            const ticker = String(document.getElementById(`quant-holding-ticker-${index}`)?.value || '').trim().toUpperCase();
            const accountName = String(document.getElementById(`quant-holding-account-${index}`)?.value || '').trim();
            const sharesRaw = String(document.getElementById(`quant-holding-shares-${index}`)?.value || '').replace(/[^0-9.-]/g, '');
            const avgRaw = String(document.getElementById(`quant-holding-avg-${index}`)?.value || '').replace(/[^0-9.-]/g, '');
            const strategy = String(document.getElementById(`quant-holding-strategy-${index}`)?.value || item.strategyTag || inferStrategyTag(item)).trim();
            const shares = sharesRaw ? Number(sharesRaw) : null;
            const avgBuyPrice = avgRaw ? Number(avgRaw) : null;

            if ((shares !== null && (!Number.isFinite(shares) || shares < 0)) || (avgBuyPrice !== null && (!Number.isFinite(avgBuyPrice) || avgBuyPrice < 0))) {
                showToast('수량과 평단은 0 이상의 숫자로 입력해주세요.', 'error');
                return;
            }

            updates.push({
                id: item.id,
                payload: {
                    ticker: ticker || null,
                    account_name: accountName || null,
                    shares,
                    strategy_tag: INVEST_STRATEGY_META[strategy] ? strategy : 'other',
                    avg_buy_price: avgBuyPrice,
                    classification_updated_at: new Date().toISOString()
                }
            });
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[9px]"></i> 저장';
        }
        if (status) status.textContent = '보유 저장 중';

        try {
            const _supabase = getAuthenticatedSupabaseClient();
            for (const update of updates) {
                const { error } = await _supabase
                    .from('portfolios')
                    .update(update.payload)
                    .eq('id', update.id);
                if (error) throw error;
            }

            showToast(`보유종목 ${updates.length}건을 저장했습니다.`, 'info', 1800);
            await fetchSheetData(false, ['portfolios']);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
        } catch (error) {
            console.error('보유종목 저장 실패:', error);
            if (status) status.textContent = '보유 저장 실패';
            alert('보유종목 저장 실패: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fas fa-save text-[9px]"></i> 보유 저장';
            }
        }
    };

    window.markQuantRulesDirty = function() {
        const status = document.getElementById('invest-quant-status');
        if (status) status.textContent = '수정 중';
    };

    function readQuantRuleInput(key, field, fallback) {
        const el = document.getElementById(`quant-${field}-${key}`);
        if (!el) return fallback;
        if (field === 'trigger') return String(el.value || '').trim() || fallback || '';
        const value = Number(String(el.value || '').replace(/[^0-9.-]/g, ''));
        if (!Number.isFinite(value)) return fallback || 0;
        return Math.min(100, Math.max(0, value));
    }

    window.saveQuantStrategyRules = async function() {
        const btn = document.getElementById('btn-save-quant-rules');
        const status = document.getElementById('invest-quant-status');
        const originalHtml = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[9px]"></i> 저장';
        }
        if (status) status.textContent = '저장 중';

        try {
            const now = new Date().toISOString();
            const payload = INVEST_STRATEGY_KEYS.map((key, index) => {
                const currentRule = quantStrategyRules[key] || DEFAULT_QUANT_STRATEGY_RULES[key] || DEFAULT_QUANT_STRATEGY_RULES.other;
                return {
                    strategy_tag: key,
                    target_pct: readQuantRuleInput(key, 'target', currentRule.targetPct),
                    band_pct: readQuantRuleInput(key, 'band', currentRule.bandPct),
                    trigger_label: readQuantRuleInput(key, 'trigger', currentRule.trigger),
                    is_active: currentRule.isActive !== false,
                    display_order: currentRule.displayOrder || ((index + 1) * 10),
                    updated_at: now
                };
            });

            const _supabase = getAuthenticatedSupabaseClient();
            const userId = getCurrentUserId();
            const overridePayload = payload.map(row => userId ? ({
                ...row,
                user_id: userId
            }) : row);
            const { error } = await _supabase
                .from('quant_strategy_rule_overrides')
                .upsert(overridePayload, { onConflict: 'user_id,strategy_tag' });
            if (error) throw error;

            dataCache.quantRuleOverrides = overridePayload;
            persistDataCache();
            parseQuantStrategyRules(dataCache.quantRules, dataCache.quantRuleOverrides);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
            showToast('내 Quant 전략 override를 저장했습니다.', 'info', 1800);
        } catch (error) {
            console.error('Quant 설정 저장 실패:', error);
            if (status) status.textContent = '저장 실패';
            alert('Quant 전략 설정 저장 실패: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fas fa-save text-[9px]"></i> 저장';
            }
        }
    };

    function getActiveInvestTickers() {
        const groupData = activeInvestGroupName ? dynamicPortfolioData?.[activeInvestGroupName] : null;
        const items = groupData?.items || rawPortfolioData || [];
        return [...new Set(
            items
                .map(item => String(item.ticker || '').trim().toUpperCase())
                .filter(Boolean)
        )];
    }

    async function getFunctionErrorMessage(error) {
        if (!error) return '';
        const fallback = error.message || String(error);
        try {
            if (error.context && typeof error.context.json === 'function') {
                const body = await error.context.json();
                return body?.error || body?.message || fallback;
            }
        } catch (_ignored) {
            return fallback;
        }
        return fallback;
    }

    const MARKET_PRICE_AUTO_SYNC_KEY = 'netvisualizer_market_price_auto_sync_at';
    const MARKET_PRICE_AUTO_SYNC_INTERVAL_MS = 4 * 60 * 60 * 1000;

    window.syncMarketPrices = async function(options = {}) {
        const silent = Boolean(options?.silent);
        const btn = document.getElementById('btn-sync-market-prices');
        const status = document.getElementById('invest-quant-status');
        const originalHtml = btn ? btn.innerHTML : '';
        const tickers = getActiveInvestTickers();

        if (tickers.length === 0) {
            if (!silent) showToast('Ticker가 있는 투자 항목이 없습니다.', 'warning', 2000);
            return null;
        }

        if (btn && !silent) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[9px]"></i> 시세';
        }
        if (status && !silent) status.textContent = '시세 동기화';

        try {
            const _supabase = getAuthenticatedSupabaseClient();
            const { data, error } = await _supabase.functions.invoke('sync-market-prices', {
                body: { tickers }
            });

            if (error) throw new Error(await getFunctionErrorMessage(error));
            const syncedCount = Number(data?.synced || 0);
            const cachedCount = Number(data?.cached || 0);
            if (!data || (syncedCount === 0 && cachedCount === 0)) {
                const reason = Array.isArray(data?.errors) && data.errors.length ? data.errors[0] : '동기화된 시세가 없습니다.';
                throw new Error(reason);
            }

            const patch = await fetchRemoteTables(['portfolio_market_prices', 'portfolio_market_price_overrides']);
            dataCache = normalizeCache({ ...dataCache, ...patch });
            persistDataCache();
            applyCachedData();
            renderSections({ investDetail: activeViewId === 'invest-detail-view' });
            const failedCount = Array.isArray(data.errors) ? data.errors.length : 0;
            const message = syncedCount > 0
                ? (failedCount > 0 ? `시세 ${syncedCount}건 동기화, ${failedCount}건 보류` : `시세 ${syncedCount}건 동기화 완료`)
                : `오늘 캐시 ${cachedCount}건 사용`;
            localStorage.setItem(MARKET_PRICE_AUTO_SYNC_KEY, new Date().toISOString());
            if (!silent) showToast(message, failedCount > 0 ? 'warning' : 'info', 2200);
            return data;
        } catch (error) {
            console.error('시세 동기화 실패:', error);
            if (status && !silent) status.textContent = '시세 보류';
            if (!silent) showToast(`시세 동기화 보류: ${error.message}`, 'warning', 3200);
            return null;
        } finally {
            if (btn && !silent) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fas fa-cloud-download-alt text-[9px]"></i> 시세';
            }
        }
    };

    window.maybeAutoSyncMarketPrices = function() {
        const lastSyncAt = new Date(localStorage.getItem(MARKET_PRICE_AUTO_SYNC_KEY) || '').getTime();
        if (Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < MARKET_PRICE_AUTO_SYNC_INTERVAL_MS) {
            return;
        }
        window.syncMarketPrices({ silent: true });
    };

    window.saveMarketPrice = async function(ticker, currency, priceInputId, dateInputId) {
        const normalizedTicker = String(ticker || '').trim().toUpperCase();
        if (!normalizedTicker) {
            alert('Ticker가 있어야 현재가를 저장할 수 있습니다.');
            return;
        }

        const priceEl = document.getElementById(priceInputId);
        const dateEl = document.getElementById(dateInputId);
        const rawPrice = String(priceEl?.value || '').replace(/[^0-9.-]/g, '');
        const price = rawPrice ? Number(rawPrice) : NaN;
        if (!Number.isFinite(price) || price < 0) {
            alert('현재가를 0 이상의 숫자로 입력해주세요.');
            return;
        }

        const priceDate = dateEl?.value || new Date().toISOString().slice(0, 10);
        const payload = {
            ticker: normalizedTicker,
            price,
            currency: String(currency || 'KRW').toUpperCase(),
            price_date: priceDate,
            source: 'manual',
            updated_at: new Date().toISOString()
        };

        try {
            const _supabase = getAuthenticatedSupabaseClient();
            const userId = getCurrentUserId();
            const dbPayload = userId ? {
                ...payload,
                user_id: userId
            } : payload;
            const { error } = await _supabase
                .from('portfolio_market_price_overrides')
                .upsert(dbPayload, { onConflict: 'user_id,ticker' });
            if (error) throw error;

            const historyPayload = userId ? {
                user_id: userId,
                ticker: payload.ticker,
                price: payload.price,
                currency: payload.currency,
                price_date: payload.price_date,
                source: payload.source
            } : {
                ticker: payload.ticker,
                price: payload.price,
                currency: payload.currency,
                price_date: payload.price_date,
                source: payload.source
            };
            const { error: historyError } = await _supabase
                .from('portfolio_market_price_override_history')
                .upsert(historyPayload, { onConflict: 'user_id,ticker,price_date,source' });
            if (historyError) throw historyError;

            const remaining = (dataCache.marketPriceOverrides || []).filter(row => String(row.ticker || '').toUpperCase() !== normalizedTicker);
            dataCache.marketPriceOverrides = [...remaining, { ...dbPayload, sourceScope: 'override' }]
                .sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
            persistDataCache();
            parseMarketPrices(dataCache.marketPrices, dataCache.marketPriceOverrides);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
            showToast(`${normalizedTicker} 내 현재가 override를 저장했습니다.`, 'info', 1600);
        } catch (error) {
            console.error('현재가 저장 실패:', error);
            alert('현재가 저장 실패: ' + error.message);
        }
    };

    // ==========================================
    // 렌더링 로직
    // ==========================================
