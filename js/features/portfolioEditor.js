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

        const getAmountNumber = (value) => Math.round(parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))) || 0;
        const isQuickEditableItem = (item) => {
            const groupText = String(item.groupName || '').toLowerCase();
            const classification = item.classification || classifyPortfolioItem(item.groupName, item);
            if (Number(item.shares || 0) > 0) return false;
            if (classification.assetType === 'debt') return true;
            if (classification.assetType === 'pension' || includesAny(groupText, ['연금', '퇴직', 'irp'])) return true;
            if (classification.assetType !== 'account') return false;
            if (includesAny(groupText, ['투자', '주식', 'etf', '펀드'])) return false;
            return true;
        };
        const getEditableBucket = (item) => {
            const groupText = String(item.groupName || '').toLowerCase();
            const classification = item.classification || classifyPortfolioItem(item.groupName, item);
            if (classification.assetType === 'debt' || includesAny(groupText, ['부채', '대출', '마이너스'])) return '부채';
            if (classification.assetType === 'pension' || includesAny(groupText, ['연금', '퇴직', 'irp'])) return '연금';
            if (includesAny(groupText, ['안전', '예금', '적금', 'cma', '파킹', 'rp', '발행어음', '채권'])) return '안전';
            return '현금';
        };
        const bucketMeta = {
            '현금': { icon: 'fa-wallet', color: 'blue', label: '현금 / 계좌' },
            '안전': { icon: 'fa-shield-alt', color: 'emerald', label: '안전자산' },
            '연금': { icon: 'fa-piggy-bank', color: 'pink', label: '연금' },
            '부채': { icon: 'fa-credit-card', color: 'red', label: '부채' }
        };

        // 1. 편집 대상은 현금/안전/연금/부채로 묶고, 투자 보유정보는 별도 섹션에서 관리한다.
        const editBuckets = { '현금': [], '안전': [], '연금': [], '부채': [] };
        const quantItems = [];
        for (let i = 1; i < workingPortfolioData.length; i++) {
            const row = workingPortfolioData[i];
            if(row.length < 5) continue;
            const groupName = row[0] || '미분류';
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
                avgBuyPrice: row[14] || '',
                accountName: row[15] || ''
            };
            editItem.classification = classifyPortfolioItem(groupName, editItem);
            if (isQuickEditableItem(editItem)) editBuckets[getEditableBucket(editItem)].push(editItem);
            else quantItems.push(editItem);
        }

        const editableTotal = Object.values(editBuckets).flat().reduce((sum, item) => {
            const amount = getAmountNumber(item.amount);
            return sum + (getEditableBucket(item) === '부채' ? -Math.abs(amount) : amount);
        }, 0);
        const stockLikeCount = quantItems.filter(item => Number(item.shares || 0) > 0 || ['stock', 'etf'].includes(item.classification?.assetType)).length;

        container.insertAdjacentHTML('beforeend', `
            <div class="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
                <div class="px-3 md:px-4 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <h4 class="text-sm font-bold text-gray-900">빠른 금액 수정</h4>
                        <p class="text-[10px] text-gray-500 truncate">현금/안전/연금/부채 금액을 입력</p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[9px] font-bold text-indigo-500">편집 순액</p>
                        <p class="text-sm font-black text-indigo-800">${editableTotal.toLocaleString()}원</p>
                    </div>
                </div>
                <div class="grid grid-cols-4 divide-x divide-indigo-50 text-center">
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">현금</p><p class="text-xs font-bold text-blue-700">${editBuckets['현금'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">안전</p><p class="text-xs font-bold text-emerald-700">${editBuckets['안전'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">연금</p><p class="text-xs font-bold text-pink-700">${editBuckets['연금'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">부채</p><p class="text-xs font-bold text-red-700">${editBuckets['부채'].length}</p></div>
                </div>
            </div>
        `);

        ['현금', '안전', '연금', '부채'].forEach((bucketName) => {
            const items = editBuckets[bucketName];
            const meta = bucketMeta[bucketName];
            const color = meta.color;
            const bucketTotal = items.reduce((sum, item) => sum + getAmountNumber(item.amount), 0);
            const borderClass = color === 'red' ? 'border-red-100' : (color === 'pink' ? 'border-pink-100' : (color === 'emerald' ? 'border-emerald-100' : 'border-blue-100'));
            const bgClass = color === 'red' ? 'bg-red-50/50' : (color === 'pink' ? 'bg-pink-50/50' : (color === 'emerald' ? 'bg-emerald-50/50' : 'bg-blue-50/50'));
            const iconClass = color === 'red' ? 'text-red-600 bg-red-100' : (color === 'pink' ? 'text-pink-600 bg-pink-100' : (color === 'emerald' ? 'text-emerald-600 bg-emerald-100' : 'text-blue-600 bg-blue-100'));
            const buttonClass = color === 'red' ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-100' : (color === 'pink' ? 'text-pink-600 bg-pink-50 hover:bg-pink-100 border-pink-100' : (color === 'emerald' ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100'));
            const jsGroupName = escapeJsString(bucketName);
            const sectionId = `pf-edit-section-${bucketName}`;

            let cardHtml = `
                <div class="bg-white rounded-xl shadow-sm border ${borderClass} overflow-hidden">
                    <button type="button" onclick="togglePortfolioEditSection('${sectionId}', this)" class="w-full px-3 py-2 border-b ${borderClass} flex items-center justify-between gap-3 ${bgClass} text-left">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-6 h-6 rounded-full ${iconClass} flex items-center justify-center"><i class="fas ${meta.icon} text-[10px]"></i></div>
                            <div class="min-w-0">
                                <h4 class="text-xs md:text-sm font-bold text-gray-800 truncate">${meta.label}</h4>
                                <p class="text-[9px] text-gray-400">${items.length}개</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <p class="text-xs font-black text-gray-800 whitespace-nowrap">${bucketTotal.toLocaleString()}원</p>
                            <i class="fas fa-chevron-down text-[10px] text-gray-400 transition-transform"></i>
                        </div>
                    </button>
                    <div id="${sectionId}" class="hidden p-2.5 space-y-1.5">
            `;

            if (items.length === 0) {
                cardHtml += `
                    <div class="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-center">
                        <p class="text-[11px] font-bold text-gray-500">아직 ${meta.label} 항목이 없습니다.</p>
                    </div>
                `;
            }

            items.forEach(item => {
                const amountStr = String(item.amount || '0').replace(/[^0-9.-]/g, '');
                const formattedAmount = amountStr ? Math.round(parseFloat(amountStr)).toLocaleString() : '0';
                cardHtml += `
                    <div class="grid grid-cols-[minmax(86px,1fr)_minmax(112px,0.95fr)_42px_28px] md:grid-cols-[minmax(160px,1.1fr)_minmax(150px,0.9fr)_48px_28px] gap-1.5 items-center rounded-lg border border-gray-100 bg-white px-2 py-1.5">
                        <input type="text" value="${escapeAttr(item.name)}" onchange="updatePortfolioName(${item.index}, this.value)" class="min-w-0 text-[11px] md:text-xs font-bold text-gray-800 bg-transparent border border-transparent hover:border-gray-100 focus:border-indigo-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-200 focus:outline-none placeholder-gray-400" placeholder="계좌명">
                        <input type="text" inputmode="numeric" id="pf-edit-amt-${item.index}" value="${formattedAmount}" oninput="formatNumberInput(this); updatePortfolioAmount(${item.index}, this.value)" class="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs md:text-sm font-black focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-right">
                        <span class="text-[9px] md:text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-1.5 rounded-md shrink-0 text-center">${escapeHtml(item.currency)}</span>
                        <button onclick="removePortfolioItem(${item.index})" class="w-7 h-7 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 rounded-md"><i class="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                `;
            });

            // [+ 항목 추가] 버튼 (B안)
            cardHtml += `
                    </div>
                    <button onclick="addPortfolioItem('${jsGroupName}')" class="w-full py-1.5 border-t text-[11px] font-bold transition-colors ${buttonClass}">
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
        newRow[1] = groupName === '부채' ? '새 부채' : (groupName === '연금' ? '새 연금' : (groupName === '안전' ? '새 안전자산' : '새 계좌'));
        newRow[2] = "KRW";
        newRow[4] = 0;
        workingPortfolioData.push(newRow);
        renderPortfolioEditForm();
    };

    window.removePortfolioItem = function(index) {
        workingPortfolioData.splice(index, 1);
        renderPortfolioEditForm();
    };

    window.togglePortfolioEditSection = function(sectionId, buttonEl) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const willOpen = section.classList.contains('hidden');
        section.classList.toggle('hidden', !willOpen);
        const icon = buttonEl?.querySelector('.fa-chevron-down');
        if (icon) icon.style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        const label = buttonEl?.querySelector('[data-toggle-label]');
        if (label) label.textContent = willOpen ? (label.dataset.openLabel || '접기') : (label.dataset.closedLabel || '펼치기');
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

    window.updatePortfolioShares = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][5] = String(val || '').replace(/[^0-9.-]/g, '');
    };

    window.updatePortfolioStrategy = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][13] = INVEST_STRATEGY_META[val] ? val : '';
    };

    window.updatePortfolioAvgBuyPrice = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][14] = String(val || '').replace(/[^0-9.-]/g, '');
    };

    window.updatePortfolioAccountName = function(index, val) {
        if (!workingPortfolioData[index]) return;
        workingPortfolioData[index][15] = String(val || '').trim();
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
            const tickerEl = document.getElementById(`pf-quant-ticker-${i}`);
            if (tickerEl) workingPortfolioData[i][9] = String(tickerEl.value || '').trim().toUpperCase();
            const sharesEl = document.getElementById(`pf-quant-shares-${i}`);
            if (sharesEl) workingPortfolioData[i][5] = String(sharesEl.value || '').replace(/[^0-9.-]/g, '');
            const avgEl = document.getElementById(`pf-quant-avg-${i}`);
            if (avgEl) workingPortfolioData[i][14] = String(avgEl.value || '').replace(/[^0-9.-]/g, '');
            const strategyEl = document.getElementById(`pf-quant-strategy-${i}`);
            if (strategyEl) workingPortfolioData[i][13] = INVEST_STRATEGY_META[strategyEl.value] ? strategyEl.value : '';
            const accountEl = document.getElementById(`pf-quant-account-${i}`);
            if (accountEl) workingPortfolioData[i][15] = String(accountEl.value || '').trim();
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
                    avgBuyPrice: workingPortfolioData[i][14] || '',
                    accountName: workingPortfolioData[i][15] || ''
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
                payload.account_name = workingPortfolioData[i][15] || null;

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
