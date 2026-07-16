// Portfolio edit modal. Draft state uses named object fields; Supabase writes live in FinanceRepository.

    function getPortfolioDraftItems() {
        return Array.isArray(workingPortfolioData?.items) ? workingPortfolioData.items : [];
    }

    function getPortfolioDraftItem(clientKey) {
        return getPortfolioDraftItems().find((item) => item.clientKey === clientKey) || null;
    }

    function getPortfolioAmount(value) {
        return Math.round(parseFloat(String(value || '0').replace(/[^0-9.-]/g, ''))) || 0;
    }

    function isPortfolioDebt(item) {
        return item?.assetType === 'debt' || /부채|대출|마이너스/.test(String(item?.groupName || ''));
    }

    function openPortfolioEditModal() {
        if (!Array.isArray(rawPortfolioData) || rawPortfolioData.length === 0) {
            return showToast('수정할 포트폴리오 데이터가 없습니다.', 'error');
        }

        workingPortfolioData = window.FinanceRepository.createPortfolioDraft(rawPortfolioData);
        originalNetWorthForDiff = getPortfolioDraftItems().reduce((total, item) => (
            isPortfolioDebt(item) ? total : total + getPortfolioAmount(item.amount)
        ), 0);

        renderPortfolioEditForm();
        document.getElementById('pf-edit-modal').classList.remove('hidden');
    }

    function renderPortfolioEditForm() {
        const container = document.getElementById('pf-edit-groups');
        if (!container) return;
        container.innerHTML = '';

        const isQuickEditableItem = (item) => {
            const groupText = String(item.groupName || '').toLowerCase();
            const classification = item.classification || classifyPortfolioItem(item.groupName, item);
            if (Number(item.shares || 0) > 0) return false;
            if (classification.assetType === 'debt') return true;
            if (classification.assetType === 'pension' || includesAny(groupText, ['연금', '퇴직', 'irp'])) return true;
            if (classification.assetType === 'other' || includesAny(groupText, ['기타', '미분류'])) return true;
            if (classification.assetType !== 'account') return false;
            return !includesAny(groupText, ['투자', '주식', 'etf', '펀드']);
        };
        const getEditableBucket = (item) => {
            const groupText = String(item.groupName || '').toLowerCase();
            const classification = item.classification || classifyPortfolioItem(item.groupName, item);
            if (classification.assetType === 'debt' || includesAny(groupText, ['부채', '대출', '마이너스'])) return '부채';
            if (classification.assetType === 'pension' || includesAny(groupText, ['연금', '퇴직', 'irp'])) return '연금';
            if (includesAny(groupText, ['안전', '예금', '적금', 'cma', '파킹', 'rp', '발행어음', '채권'])) return '안전';
            if (classification.assetType === 'other' || includesAny(groupText, ['기타', '미분류'])) return '기타';
            return '현금';
        };
        const bucketMeta = {
            '현금': { icon: 'fa-wallet', color: 'blue', label: '현금 / 계좌' },
            '안전': { icon: 'fa-shield-alt', color: 'emerald', label: '안전자산' },
            '연금': { icon: 'fa-piggy-bank', color: 'pink', label: '연금' },
            '부채': { icon: 'fa-credit-card', color: 'red', label: '부채' },
            '기타': { icon: 'fa-coins', color: 'gray', label: '기타' },
        };

        const editBuckets = { '현금': [], '안전': [], '연금': [], '부채': [], '기타': [] };
        getPortfolioDraftItems().forEach((item) => {
            item.classification = classifyPortfolioItem(item.groupName, item);
            if (isQuickEditableItem(item)) editBuckets[getEditableBucket(item)].push(item);
        });

        const editableTotal = Object.values(editBuckets).flat().reduce((sum, item) => {
            const amount = getPortfolioAmount(item.amount);
            return sum + (getEditableBucket(item) === '부채' ? -Math.abs(amount) : amount);
        }, 0);

        container.insertAdjacentHTML('beforeend', `
            <div class="bg-white rounded-xl shadow-sm border border-indigo-100 overflow-hidden">
                <div class="px-3 md:px-4 py-2.5 bg-indigo-50/60 border-b border-indigo-100 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <h4 class="text-sm font-bold text-gray-900">빠른 금액 수정</h4>
                        <p class="text-[10px] text-gray-500 truncate">현금/안전/연금/부채/기타 금액을 입력</p>
                    </div>
                    <div class="text-right shrink-0">
                        <p class="text-[9px] font-bold text-indigo-500">편집 순액</p>
                        <p class="text-sm font-black text-indigo-800">${editableTotal.toLocaleString()}원</p>
                    </div>
                </div>
                <div class="grid grid-cols-5 divide-x divide-indigo-50 text-center">
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">현금</p><p class="text-xs font-bold text-blue-700">${editBuckets['현금'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">안전</p><p class="text-xs font-bold text-emerald-700">${editBuckets['안전'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">연금</p><p class="text-xs font-bold text-pink-700">${editBuckets['연금'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">부채</p><p class="text-xs font-bold text-red-700">${editBuckets['부채'].length}</p></div>
                    <div class="px-2 py-2"><p class="text-[9px] text-gray-400 font-bold">기타</p><p class="text-xs font-bold text-gray-700">${editBuckets['기타'].length}</p></div>
                </div>
            </div>
        `);

        ['현금', '안전', '연금', '부채', '기타'].forEach((bucketName) => {
            const items = editBuckets[bucketName];
            const meta = bucketMeta[bucketName];
            const color = meta.color;
            const bucketTotal = items.reduce((sum, item) => sum + getPortfolioAmount(item.amount), 0);
            const borderClass = color === 'red' ? 'border-red-100' : (color === 'pink' ? 'border-pink-100' : (color === 'emerald' ? 'border-emerald-100' : (color === 'gray' ? 'border-gray-200' : 'border-blue-100')));
            const bgClass = color === 'red' ? 'bg-red-50/50' : (color === 'pink' ? 'bg-pink-50/50' : (color === 'emerald' ? 'bg-emerald-50/50' : (color === 'gray' ? 'bg-gray-50/70' : 'bg-blue-50/50')));
            const iconClass = color === 'red' ? 'text-red-600 bg-red-100' : (color === 'pink' ? 'text-pink-600 bg-pink-100' : (color === 'emerald' ? 'text-emerald-600 bg-emerald-100' : (color === 'gray' ? 'text-gray-600 bg-gray-100' : 'text-blue-600 bg-blue-100')));
            const buttonClass = color === 'red' ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-100' : (color === 'pink' ? 'text-pink-600 bg-pink-50 hover:bg-pink-100 border-pink-100' : (color === 'emerald' ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-100' : (color === 'gray' ? 'text-gray-600 bg-gray-50 hover:bg-gray-100 border-gray-200' : 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-100')));
            const jsGroupName = escapeJsString(bucketName);
            const sectionId = `pf-edit-section-${bucketName}`;

            let cardHtml = `
                <div class="bg-white rounded-xl shadow-sm border ${borderClass} overflow-hidden">
                    <button type="button" onclick="togglePortfolioEditSection('${sectionId}', this)" class="w-full px-3 py-2 border-b ${borderClass} flex items-center justify-between gap-3 ${bgClass} text-left">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-6 h-6 rounded-full ${iconClass} flex items-center justify-center"><i class="fas ${meta.icon} text-[10px]"></i></div>
                            <div class="min-w-0"><h4 class="text-xs md:text-sm font-bold text-gray-800 truncate">${meta.label}</h4><p class="text-[9px] text-gray-400">${items.length}개</p></div>
                        </div>
                        <div class="flex items-center gap-2 shrink-0"><p class="text-xs font-black text-gray-800 whitespace-nowrap">${bucketTotal.toLocaleString()}원</p><i class="fas fa-chevron-down text-[10px] text-gray-400 transition-transform"></i></div>
                    </button>
                    <div id="${sectionId}" class="hidden p-2.5 space-y-1.5">
            `;

            if (items.length === 0) {
                cardHtml += `<div class="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-center"><p class="text-[11px] font-bold text-gray-500">아직 ${meta.label} 항목이 없습니다.</p></div>`;
            }

            items.forEach((item) => {
                const key = escapeJsString(item.clientKey);
                const formattedAmount = getPortfolioAmount(item.amount).toLocaleString();
                cardHtml += `
                    <div data-portfolio-draft-key="${escapeAttr(item.clientKey)}" class="grid grid-cols-[minmax(86px,1fr)_minmax(112px,0.95fr)_42px_28px] md:grid-cols-[minmax(160px,1.1fr)_minmax(150px,0.9fr)_48px_28px] gap-1.5 items-center rounded-lg border border-gray-100 bg-white px-2 py-1.5">
                        <input type="text" value="${escapeAttr(item.name)}" onchange="updatePortfolioName('${key}', this.value)" class="min-w-0 text-[11px] md:text-xs font-bold text-gray-800 bg-transparent border border-transparent hover:border-gray-100 focus:border-indigo-300 rounded px-1.5 py-1 focus:ring-1 focus:ring-indigo-200 focus:outline-none placeholder-gray-400" placeholder="계좌명">
                        <input type="text" inputmode="numeric" id="pf-edit-amt-${escapeAttr(item.clientKey)}" value="${formattedAmount}" oninput="formatNumberInput(this); updatePortfolioAmount('${key}', this.value)" class="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs md:text-sm font-black focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-right">
                        <span class="text-[9px] md:text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-1.5 rounded-md shrink-0 text-center">${escapeHtml(item.currency)}</span>
                        <button type="button" onclick="removePortfolioItem('${key}')" aria-label="${escapeAttr(item.name)} 삭제" class="w-7 h-7 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 rounded-md"><i class="fas fa-trash-alt text-[10px]"></i></button>
                    </div>
                `;
            });

            cardHtml += `
                    </div>
                    <button type="button" onclick="addPortfolioItem('${jsGroupName}')" class="w-full py-1.5 border-t text-[11px] font-bold transition-colors ${buttonClass}"><i class="fas fa-plus mr-1"></i> 항목 추가</button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', cardHtml);
        });

        calculateExpectedTotal();
    }

    window.addPortfolioItem = function(groupName) {
        if (!workingPortfolioData) return;
        window.FinanceRepository.addPortfolioDraftItem(workingPortfolioData, groupName);
        renderPortfolioEditForm();
    };

    window.removePortfolioItem = function(clientKey) {
        if (!workingPortfolioData) return;
        workingPortfolioData.items = getPortfolioDraftItems().filter((item) => item.clientKey !== clientKey);
        renderPortfolioEditForm();
    };

    window.togglePortfolioEditSection = function(sectionId, buttonEl) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        const willOpen = section.classList.contains('hidden');
        section.classList.toggle('hidden', !willOpen);
        const icon = buttonEl?.querySelector('.fa-chevron-down');
        if (icon) icon.style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    };

    window.updatePortfolioName = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.name = String(value || '');
    };

    window.updatePortfolioAssetClass = function(clientKey, groupName) {
        const item = getPortfolioDraftItem(clientKey);
        if (!item) return;
        item.groupName = groupName || '기타';
        item.assetType = '';
        item.instrumentType = '';
        item.riskBucket = '';
        item.classificationSource = 'manual';
        item.classificationUpdatedAt = new Date().toISOString();
        renderPortfolioEditForm();
        showToast('분류가 변경되었습니다. 저장하면 DB에 반영됩니다.', 'info', 1600);
    };

    window.updatePortfolioTicker = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.ticker = String(value || '').trim().toUpperCase();
    };

    window.updatePortfolioShares = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.shares = String(value || '').replace(/[^0-9.-]/g, '') || null;
    };

    window.updatePortfolioStrategy = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.strategyTag = INVEST_STRATEGY_META[value] ? value : '';
    };

    window.updatePortfolioAvgBuyPrice = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.avgBuyPrice = String(value || '').replace(/[^0-9.-]/g, '') || null;
    };

    window.updatePortfolioAccountName = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.accountName = String(value || '').trim();
    };

    window.formatNumberInput = function(el) {
        const value = String(el.value).replace(/[^0-9.-]/g, '');
        el.value = value ? Math.round(parseFloat(value)).toLocaleString() : '';
    };

    window.updatePortfolioAmount = function(clientKey, value) {
        const item = getPortfolioDraftItem(clientKey);
        if (item) item.amount = getPortfolioAmount(value);
        calculateExpectedTotal();
    };

    window.calculateExpectedTotal = function() {
        const expectedNetWorth = getPortfolioDraftItems().reduce((total, item) => (
            isPortfolioDebt(item) ? total : total + getPortfolioAmount(item.amount)
        ), 0);
        const previewEl = document.getElementById('pf-edit-total-preview');
        if (previewEl) previewEl.textContent = `${expectedNetWorth.toLocaleString()}원`;

        const diff = expectedNetWorth - originalNetWorthForDiff;
        const diffEl = document.getElementById('pf-edit-diff-preview');
        if (!diffEl) return;
        if (diff > 0) {
            diffEl.textContent = `▲ +${diff.toLocaleString()}원 증가`;
            diffEl.className = 'text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded inline-block mt-0.5';
        } else if (diff < 0) {
            diffEl.textContent = `▼ ${diff.toLocaleString()}원 감소`;
            diffEl.className = 'text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded inline-block mt-0.5';
        } else {
            diffEl.textContent = '- 변동 없음';
            diffEl.className = 'text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded inline-block mt-0.5';
        }
    };

    window.getPortfolioDraftSnapshot = function() {
        return workingPortfolioData ? JSON.parse(JSON.stringify(workingPortfolioData)) : null;
    };

    function closePortfolioEditModal() {
        document.getElementById('pf-edit-modal').classList.add('hidden');
        workingPortfolioData = null;
    }

    function syncPortfolioDraftInputs() {
        getPortfolioDraftItems().forEach((item) => {
            const key = item.clientKey;
            const amountEl = document.getElementById(`pf-edit-amt-${key}`);
            if (amountEl) item.amount = getPortfolioAmount(amountEl.value);
            const tickerEl = document.getElementById(`pf-quant-ticker-${key}`);
            if (tickerEl) item.ticker = String(tickerEl.value || '').trim().toUpperCase();
            const sharesEl = document.getElementById(`pf-quant-shares-${key}`);
            if (sharesEl) item.shares = String(sharesEl.value || '').replace(/[^0-9.-]/g, '') || null;
            const avgEl = document.getElementById(`pf-quant-avg-${key}`);
            if (avgEl) item.avgBuyPrice = String(avgEl.value || '').replace(/[^0-9.-]/g, '') || null;
            const strategyEl = document.getElementById(`pf-quant-strategy-${key}`);
            if (strategyEl) item.strategyTag = INVEST_STRATEGY_META[strategyEl.value] ? strategyEl.value : '';
            const accountEl = document.getElementById(`pf-quant-account-${key}`);
            if (accountEl) item.accountName = String(accountEl.value || '').trim();

            const classification = classifyPortfolioItem(item.groupName, item);
            const strategyTag = item.strategyTag || inferStrategyTag({ ...item, classification });
            item.assetType = classification.assetType;
            item.instrumentType = classification.instrumentType;
            item.riskBucket = classification.riskBucket;
            item.classificationSource = item.classificationSource || classification.source || 'rule';
            item.classificationUpdatedAt = item.classificationUpdatedAt || new Date().toISOString();
            item.strategyTag = INVEST_STRATEGY_META[strategyTag] ? strategyTag : 'other';
        });
    }

    async function submitPortfolio() {
        if (!workingPortfolioData) return;
        syncPortfolioDraftInputs();

        const btn = document.getElementById('btn-submit-pf');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장중...';
        btn.disabled = true;

        try {
            await getFinanceRepository().savePortfolioDraft(workingPortfolioData);
            showToast('포트폴리오가 성공적으로 저장되었습니다.', 'info');
            closePortfolioEditModal();
            await fetchSheetData(false, ['portfolios']);
        } catch(error) {
            console.error('포트폴리오 저장 실패:', error);
            showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
