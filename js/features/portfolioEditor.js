// Portfolio edit modal helpers extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    function openPortfolioEditModal() {
        if (!rawPortfolioData || rawPortfolioData.length < 2) {
            return showToast('수정할 포트폴리오 데이터가 없습니다.', 'error');
        }

        // 깊은 복사로 workingPortfolioData 초기화
        workingPortfolioData = JSON.parse(JSON.stringify(rawPortfolioData));

        // 원본 순자산(부채 제외) 합계 계산 (C안을 위함)
        originalNetWorthForDiff = 0;
        for (let i = 1; i < rawPortfolioData.length; i++) {
            if (rawPortfolioData[i].length < 5) continue;
            const group = rawPortfolioData[i][0] || '';
            const amount = Math.round(parseFloat(String(rawPortfolioData[i][4] || '0').replace(/[^0-9.-]/g, ''))) || 0;
            if (group !== '부채') originalNetWorthForDiff += amount;
        }

        renderPortfolioEditForm();
        document.getElementById('pf-edit-modal').classList.remove('hidden');
    }

    function renderPortfolioEditForm() {
        const container = document.getElementById('pf-edit-groups');
        container.innerHTML = '';

        // 1. 그룹별로 데이터 묶기 (index 포함하여 맵핑)
        const groups = {};
        for (let i = 1; i < workingPortfolioData.length; i++) {
            const row = workingPortfolioData[i];
            if(row.length < 5) continue;
            const groupName = row[0] || '미분류';
            if (!groups[groupName]) groups[groupName] = [];
            const editItem = {
                index: i,
                id: row[6] || '',
                groupName,
                name: row[1],
                currency: row[2] || 'KRW',
                maturity: row[3] || '',
                amount: row[4],
                shares: row[5] || '',
                assetType: row[7] || '',
                instrumentType: row[8] || '',
                ticker: row[9] || '',
                riskBucket: row[10] || '',
                classificationSource: row[11] || '',
                classificationUpdatedAt: row[12] || '',
                strategyTag: row[13] || '',
                avgBuyPrice: row[14] || ''
            };
            editItem.classification = classifyPortfolioItem(groupName, editItem);
            groups[groupName].push(editItem);
        }

        // 2. 그룹별로 카드 렌더링 (A안)
        getSortedPortfolioGroups(groups).forEach(([groupName, items]) => {
            const isDebt = groupName === '부채';
            const iconClass = isDebt ? 'fa-credit-card text-red-500' : (groupName.includes('투자') ? 'fa-chart-line text-purple-500' : 'fa-wallet text-blue-500');
            const bgClass = isDebt ? 'bg-red-50' : (groupName.includes('투자') ? 'bg-purple-50' : 'bg-blue-50');
            const safeGroupName = escapeHtml(groupName);
            const jsGroupName = escapeJsString(groupName);

            let cardHtml = `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div class="px-4 py-3 border-b border-gray-50 flex items-center gap-2 bg-gray-50/50">
                        <div class="w-6 h-6 rounded-full ${bgClass} flex items-center justify-center"><i class="fas ${iconClass} text-[10px]"></i></div>
                        <h4 class="text-sm font-bold text-gray-800">${safeGroupName}</h4>
                    </div>
                    <div class="p-4 space-y-4">
            `;

            items.forEach(item => {
                const amountStr = String(item.amount || '0').replace(/[^0-9.-]/g, '');
                const formattedAmount = amountStr ? Math.round(parseFloat(amountStr)).toLocaleString() : '0';
                const currentGroupRank = getPortfolioGroupRank(item.groupName);
                const classOptions = PORTFOLIO_GROUP_ORDER.map((group, groupIdx) => {
                    const selected = currentGroupRank === groupIdx ? 'selected' : '';
                    return `<option value="${escapeAttr(group.label)}" ${selected}>${escapeHtml(group.label)}</option>`;
                }).join('');
                const strategyTag = item.strategyTag || inferStrategyTag(item);
                const strategyOptions = INVEST_STRATEGY_KEYS.map(key => {
                    const meta = getStrategyMeta(key);
                    const selected = strategyTag === key ? 'selected' : '';
                    return `<option value="${escapeAttr(key)}" ${selected}>${escapeHtml(meta.label)}</option>`;
                }).join('');
                cardHtml += `
                    <div class="flex flex-col gap-1 relative group">
                        <div class="flex justify-between items-center mb-0.5">
                            <input type="text" value="${escapeAttr(item.name)}" onchange="updatePortfolioName(${item.index}, this.value)" class="text-xs font-bold text-gray-700 bg-transparent border-none p-0 focus:ring-0 focus:outline-none placeholder-gray-400 w-full" placeholder="자산명 입력">
                            ${getAssetClassBadgeHtml(item.classification)}
                            <button onclick="removePortfolioItem(${item.index})" class="text-gray-300 hover:text-red-500 transition-colors shrink-0 p-1 bg-white rounded-full"><i class="fas fa-trash-alt text-sm"></i></button>
                        </div>
                        <div class="flex items-center gap-2">
                            <input type="text" id="pf-edit-amt-${item.index}" value="${formattedAmount}" oninput="formatNumberInput(this); updatePortfolioAmount(${item.index}, this.value)" class="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-right">
                            <span class="text-xs text-gray-500 font-bold bg-gray-100 px-2 py-2 rounded-lg shrink-0">${escapeHtml(item.currency)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] text-gray-400 font-bold shrink-0">자산유형</span>
                            <select onchange="updatePortfolioAssetClass(${item.index}, this.value)" class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                ${classOptions}
                            </select>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <label class="flex flex-col gap-1">
                                <span class="text-[10px] text-gray-400 font-bold">Ticker</span>
                                <input type="text" value="${escapeAttr(item.ticker)}" oninput="updatePortfolioTicker(${item.index}, this.value)" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs uppercase focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="예: SCHD">
                            </label>
                            <label class="flex flex-col gap-1">
                                <span class="text-[10px] text-gray-400 font-bold">전략</span>
                                <select onchange="updatePortfolioStrategy(${item.index}, this.value)" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                                    ${strategyOptions}
                                </select>
                            </label>
                            <label class="flex flex-col gap-1">
                                <span class="text-[10px] text-gray-400 font-bold">평균단가</span>
                                <input type="text" value="${escapeAttr(item.avgBuyPrice)}" oninput="updatePortfolioAvgBuyPrice(${item.index}, this.value)" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0">
                            </label>
                        </div>
                    </div>
                `;
            });

            // [+ 항목 추가] 버튼 (B안)
            cardHtml += `
                    </div>
                    <button onclick="addPortfolioItem('${jsGroupName}')" class="w-full py-2 bg-gray-50/80 hover:bg-gray-100 text-xs font-bold text-indigo-500 transition-colors border-t border-gray-50">
                        <i class="fas fa-plus mr-1"></i> 항목 추가
                    </button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });

        calculateExpectedTotal(); // 초기 계산
    }

    window.addPortfolioItem = function(groupName) {
        const rowLen = workingPortfolioData.length > 0 ? workingPortfolioData[0].length : 5;
        const newRow = new Array(rowLen).fill('');
        newRow[0] = groupName;
        newRow[1] = "새 자산";
        newRow[2] = "KRW";
        newRow[4] = 0;
        workingPortfolioData.push(newRow);
        renderPortfolioEditForm();
    };

    window.removePortfolioItem = function(index) {
        workingPortfolioData.splice(index, 1);
        renderPortfolioEditForm();
    };

    window.updatePortfolioName = function(index, val) {
        if(workingPortfolioData[index]) workingPortfolioData[index][1] = val;
    };

    window.updatePortfolioAssetClass = function(index, groupName) {
        const row = workingPortfolioData[index];
        if (!row) return;
        row[0] = groupName || '기타';
        row[7] = '';
        row[8] = '';
        row[10] = '';
        row[11] = 'manual';
        row[12] = new Date().toISOString();
        renderPortfolioEditForm();
        showToast('분류가 변경되었습니다. 저장하면 DB에 반영됩니다.', 'info', 1600);
    };

    window.updatePortfolioTicker = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][9] = String(val || '').trim().toUpperCase();
    };

    window.updatePortfolioStrategy = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][13] = INVEST_STRATEGY_META[val] ? val : '';
    };

    window.updatePortfolioAvgBuyPrice = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][14] = String(val || '').replace(/[^0-9.-]/g, '');
    };

    window.formatNumberInput = function(el) {
        let val = String(el.value).replace(/[^0-9.-]/g, '');
        if (val) {
            el.value = Math.round(parseFloat(val)).toLocaleString();
        } else {
            el.value = '';
        }
    };

    window.updatePortfolioAmount = function(index, val) {
        if(workingPortfolioData[index]) {
            const rawVal = String(val).replace(/[^0-9.-]/g, '');
            workingPortfolioData[index][4] = rawVal ? Math.round(parseFloat(rawVal)) : 0;
        }
        calculateExpectedTotal();
    };

    window.calculateExpectedTotal = function() {
        let expectedNetWorth = 0;
        // input 엘리먼트들을 순회하며 즉각 반영 (렌더링을 기다리지 않음)
        for (let i = 1; i < workingPortfolioData.length; i++) {
            if (workingPortfolioData[i].length < 5) continue;
            const group = workingPortfolioData[i][0] || '';
            const inputEl = document.getElementById(`pf-edit-amt-${i}`);
            let amount = 0;
            if (inputEl) {
                const rawVal = String(inputEl.value).replace(/[^0-9.-]/g, '');
                amount = rawVal ? Math.round(parseFloat(rawVal)) : 0;
            } else {
                amount = Math.round(parseFloat(String(workingPortfolioData[i][4] || '0').replace(/[^0-9.-]/g, ''))) || 0;
            }
            if (group !== '부채') expectedNetWorth += amount;
        }

        const previewEl = document.getElementById('pf-edit-total-preview');
        if (previewEl) previewEl.textContent = expectedNetWorth.toLocaleString() + '원';

        const diff = expectedNetWorth - originalNetWorthForDiff;
        const diffEl = document.getElementById('pf-edit-diff-preview');
        if (diffEl) {
            if (diff > 0) {
                diffEl.textContent = `▲ +${diff.toLocaleString()}원 증가`;
                diffEl.className = 'text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded inline-block mt-0.5';
            } else if (diff < 0) {
                diffEl.textContent = `▼ ${diff.toLocaleString()}원 감소`;
                diffEl.className = 'text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded inline-block mt-0.5';
            } else {
                diffEl.textContent = `- 변동 없음`;
                diffEl.className = 'text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-0.5';
            }
        }
    };

    function closePortfolioEditModal() {
        document.getElementById('pf-edit-modal').classList.add('hidden');
    }

    async function submitPortfolio() {
        // 이미 updatePortfolioAmount 로 값이 반영되어 있으나, 확실히 하기 위해 한 번 더 동기화
        for (let i = 1; i < workingPortfolioData.length; i++) {
            if(workingPortfolioData[i].length < 5) continue;
            const inputEl = document.getElementById(`pf-edit-amt-${i}`);
            if (inputEl) {
                const rawVal = String(inputEl.value).replace(/[^0-9.-]/g, '');
                workingPortfolioData[i][4] = rawVal ? Math.round(parseFloat(rawVal)) : 0;
            }
        }

        const btn = document.getElementById('btn-submit-pf');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장중...';
        btn.disabled = true;

        try {
            const _supabase = getSupabaseClient();
            const existingPayloads = [];
            const newPayloads = [];
            const originalIds = rawPortfolioData.slice(1).map(row => row[6]).filter(Boolean);
            const currentIds = [];

            if (rawPortfolioData.length > 1 && originalIds.length === 0) {
                throw new Error('포트폴리오 row id가 없어 안전 저장을 진행할 수 없습니다. 먼저 최신 동기화를 실행해주세요.');
            }

            for (let i = 1; i < workingPortfolioData.length; i++) {
                if(workingPortfolioData[i].length < 5) continue;
                const rowId = workingPortfolioData[i][6];
                const payload = {
                    group_name: workingPortfolioData[i][0] || '미분류',
                    name: workingPortfolioData[i][1],
                    currency: workingPortfolioData[i][2] || 'KRW',
                    maturity: workingPortfolioData[i][3] || '',
                    amount: parseInt(workingPortfolioData[i][4] || 0, 10),
                    shares: workingPortfolioData[i][5] ? parseFloat(workingPortfolioData[i][5]) : null
                };
                const classificationItem = {
                    id: rowId,
                    name: payload.name,
                    currency: payload.currency,
                    maturity: payload.maturity,
                    amount: payload.amount,
                    shares: payload.shares,
                    assetType: workingPortfolioData[i][7] || '',
                    instrumentType: workingPortfolioData[i][8] || '',
                    ticker: workingPortfolioData[i][9] || '',
                    riskBucket: workingPortfolioData[i][10] || '',
                    classificationSource: workingPortfolioData[i][11] || '',
                    strategyTag: workingPortfolioData[i][13] || '',
                    avgBuyPrice: workingPortfolioData[i][14] || ''
                };
                const classification = classifyPortfolioItem(payload.group_name, classificationItem);
                const strategyTag = workingPortfolioData[i][13] || inferStrategyTag({ ...classificationItem, classification });
                const avgBuyPriceRaw = String(workingPortfolioData[i][14] || '').replace(/[^0-9.-]/g, '');
                payload.asset_type = classification.assetType;
                payload.instrument_type = classification.instrumentType;
                payload.ticker = workingPortfolioData[i][9] || null;
                payload.risk_bucket = classification.riskBucket;
                payload.classification_source = workingPortfolioData[i][11] || classification.source || 'rule';
                payload.classification_updated_at = workingPortfolioData[i][12] || new Date().toISOString();
                payload.strategy_tag = INVEST_STRATEGY_META[strategyTag] ? strategyTag : 'other';
                payload.avg_buy_price = avgBuyPriceRaw ? parseFloat(avgBuyPriceRaw) : null;

                if (rowId) {
                    payload.id = rowId;
                    currentIds.push(rowId);
                    existingPayloads.push(payload);
                } else {
                    newPayloads.push(payload);
                }
            }

            const removedIds = originalIds.filter(id => !currentIds.includes(id));

            if (existingPayloads.length > 0) {
                const { error } = await _supabase
                    .from('portfolios')
                    .upsert(existingPayloads, { onConflict: 'id' });
                if(error) throw error;
            }

            if (newPayloads.length > 0) {
                const { error } = await _supabase
                    .from('portfolios')
                    .insert(newPayloads);
                if(error) throw error;
            }

            if (removedIds.length > 0) {
                const { error } = await _supabase
                    .from('portfolios')
                    .delete()
                    .in('id', removedIds);
                if(error) throw error;
            }

            showToast('포트폴리오가 성공적으로 저장되었습니다.', 'info');
            closePortfolioEditModal();
            await fetchSheetData(false, ['portfolios']);
        } catch(error) {
            console.error("전송 에러:", error);
            showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // ==========================================
    // 기타 UI 이벤트 바인딩
    // ==========================================
