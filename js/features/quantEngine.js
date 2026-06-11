// Quant strategy, rebalance, and market-price helpers extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

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
                <div class="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${meta.color}"></span>
                            <span class="text-xs font-bold text-gray-800 truncate">${escapeHtml(meta.label)}</span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded ${statusClass}">${statusLabel}</span>
                    </div>
                    <div class="grid grid-cols-4 gap-2 text-[10px]">
                        <div>
                            <p class="text-gray-400 font-bold">현재</p>
                            <p class="text-gray-800 font-bold">${currentPct.toFixed(1)}%</p>
                        </div>
                        <div>
                            <p class="text-gray-400 font-bold">목표</p>
                            <input id="quant-target-${key}" type="number" min="0" max="100" step="0.1" value="${escapeAttr(targetPct)}" oninput="markQuantRulesDirty()" class="w-full border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold text-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none">
                        </div>
                        <div>
                            <p class="text-gray-400 font-bold">밴드</p>
                            <input id="quant-band-${key}" type="number" min="0" max="100" step="0.1" value="${escapeAttr(bandPct)}" oninput="markQuantRulesDirty()" class="w-full border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold text-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none">
                        </div>
                        <div>
                            <p class="text-gray-400 font-bold">기준</p>
                            <input id="quant-trigger-${key}" type="text" value="${escapeAttr(rule.trigger)}" oninput="markQuantRulesDirty()" class="w-full border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold text-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none">
                        </div>
                    </div>
                    <div class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full" style="width: ${Math.min(100, Math.max(0, currentPct))}%; background-color: ${meta.color}"></div>
                    </div>
                    <div class="mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1 ${needsRebalance ? 'bg-rose-50 text-rose-600' : 'bg-gray-50 text-gray-500'}">
                        <span class="text-[10px] font-bold">리밸런싱</span>
                        <span class="text-[10px] font-bold text-right">${rebalanceLabel}</span>
                    </div>
                    <p class="mt-1 text-[10px] text-gray-400">Ticker ${tickerReady}/${items.length} · 평균단가 ${avgReady}/${items.length} · 현재가 ${priceReady}/${items.length}</p>
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
            const _supabase = getSupabaseClient();
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
        const prices = dataCache.marketPrices || [];
        const scopedPrices = prices.filter(row => {
            const ticker = String(row.ticker || '').trim().toUpperCase();
            return ticker && (tickers.length === 0 || tickers.includes(ticker));
        });
        const manualCount = scopedPrices.filter(row => row.source === 'manual').length;
        const apiCount = scopedPrices.filter(row => row.source === 'api').length;
        const latestDate = scopedPrices
            .map(row => row.price_date || '')
            .filter(Boolean)
            .sort()
            .pop();

        const tickerLabel = tickers.length > 0 ? `${tickers.length}개 ticker` : 'ticker 대기';
        const priceLabel = scopedPrices.length > 0
            ? `시세 ${scopedPrices.length}건 (수동 ${manualCount} / API ${apiCount})`
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

            const _supabase = getSupabaseClient();
            const { error } = await _supabase
                .from('quant_strategy_rules')
                .upsert(payload, { onConflict: 'strategy_tag' });
            if (error) throw error;

            dataCache.quantRules = payload;
            persistDataCache();
            parseQuantStrategyRules(payload);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
            showToast('Quant 전략 설정을 저장했습니다.', 'info', 1800);
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

    window.syncMarketPrices = async function() {
        const btn = document.getElementById('btn-sync-market-prices');
        const status = document.getElementById('invest-quant-status');
        const originalHtml = btn ? btn.innerHTML : '';
        const tickers = getActiveInvestTickers();

        if (tickers.length === 0) {
            showToast('Ticker가 있는 투자 항목이 없습니다.', 'warning', 2000);
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[9px]"></i> 시세';
        }
        if (status) status.textContent = '시세 동기화';

        try {
            const _supabase = getSupabaseClient();
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

            const patch = await fetchRemoteTables(['portfolio_market_prices']);
            dataCache = normalizeCache({ ...dataCache, ...patch });
            persistDataCache();
            applyCachedData();
            renderSections({ investDetail: activeViewId === 'invest-detail-view' });
            const failedCount = Array.isArray(data.errors) ? data.errors.length : 0;
            const message = syncedCount > 0
                ? (failedCount > 0 ? `시세 ${syncedCount}건 동기화, ${failedCount}건 보류` : `시세 ${syncedCount}건 동기화 완료`)
                : `오늘 캐시 ${cachedCount}건 사용`;
            showToast(message, failedCount > 0 ? 'warning' : 'info', 2200);
        } catch (error) {
            console.error('시세 동기화 실패:', error);
            if (status) status.textContent = '시세 보류';
            showToast(`시세 동기화 보류: ${error.message}`, 'warning', 3200);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml || '<i class="fas fa-cloud-download-alt text-[9px]"></i> 시세';
            }
        }
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
            const _supabase = getSupabaseClient();
            const { error } = await _supabase
                .from('portfolio_market_prices')
                .upsert(payload, { onConflict: 'ticker' });
            if (error) throw error;

            const { error: historyError } = await _supabase
                .from('portfolio_price_history')
                .upsert({
                    ticker: payload.ticker,
                    price: payload.price,
                    currency: payload.currency,
                    price_date: payload.price_date,
                    source: payload.source
                }, { onConflict: 'ticker,price_date,source' });
            if (historyError) throw historyError;

            const remaining = (dataCache.marketPrices || []).filter(row => String(row.ticker || '').toUpperCase() !== normalizedTicker);
            dataCache.marketPrices = [...remaining, payload].sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)));
            persistDataCache();
            parseMarketPrices(dataCache.marketPrices);
            if (activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
            showToast(`${normalizedTicker} 현재가를 저장했습니다.`, 'info', 1600);
        } catch (error) {
            console.error('현재가 저장 실패:', error);
            alert('현재가 저장 실패: ' + error.message);
        }
    };

    // ==========================================
    // 렌더링 로직
    // ==========================================
