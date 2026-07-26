(function (root) {
    const utils = root.AppUtils || {};
    const CFO_ASSET_GROUP_DEFINITIONS = Object.freeze([
        { key: 'operating', label: '운영자산', purpose: '생활 운영', color: '#64748B' },
        { key: 'safe', label: '안전자산', purpose: '현금 방어', color: '#4F46E5' },
        { key: 'investment', label: '투자자산', purpose: '시장 성장', color: '#7C3AED' },
        { key: 'housing', label: '주거자산', purpose: '전세 · 청약 · 대출', color: '#0F766E' },
        { key: 'pension', label: '연금', purpose: '장기 노후', color: '#475569' },
    ]);
    const OPERATING_ACCOUNT_ORDER = Object.freeze(['생활비통장', '월급통장']);

    function number(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function flattenPortfolio(portfolioData) {
        if (!portfolioData || typeof portfolioData !== 'object') return [];
        return Object.entries(portfolioData).flatMap(([groupName, group]) => {
            const items = Array.isArray(group?.items) ? group.items : [];
            return items.map((item) => ({
                ...item,
                groupName,
                groupIsDebt: Boolean(group?.isDebt),
                amount: number(item?.amount),
                assetType: String(item?.classification?.assetType || item?.assetType || '').toLowerCase(),
            }));
        });
    }

    function isDebtItem(item) {
        return item.groupIsDebt || item.assetType === 'debt' || item.amount < 0;
    }

    function isExcludedCfoItem(item = {}) {
        return String(item.name || '').trim() === '대출통장';
    }

    function compareCfoGroupItems(a, b, groupKey = '') {
        if (groupKey === 'operating') {
            const rankA = OPERATING_ACCOUNT_ORDER.indexOf(String(a.name || '').trim());
            const rankB = OPERATING_ACCOUNT_ORDER.indexOf(String(b.name || '').trim());
            const normalizedRankA = rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA;
            const normalizedRankB = rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB;
            if (normalizedRankA !== normalizedRankB) return normalizedRankA - normalizedRankB;
        }
        const amountDiff = Math.abs(number(b.amount)) - Math.abs(number(a.amount));
        if (amountDiff !== 0) return amountDiff;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
    }

    function classifyCfoAssetGroup(item = {}) {
        const assetType = String(item.assetType || item.classification?.assetType || '').toLowerCase();
        const instrumentType = String(item.instrumentType || item.classification?.instrumentType || '').toLowerCase();
        const text = `${item.groupName || ''} ${item.name || ''}`.toLowerCase();
        if (isDebtItem(item)) return 'housing';
        if (assetType === 'pension' || /연금|퇴직|irp/.test(text)) return 'pension';
        if (assetType === 'real_estate' || /전세|보증금|청약|주택|부동산/.test(text)) return 'housing';
        if (
            instrumentType === 'safe_account'
            || instrumentType === 'deposit'
            || /안전|청년도약|발행어음|ima|예금|적금|파킹|rp/.test(text)
        ) return 'safe';
        if (['stock', 'etf', 'fund', 'crypto'].includes(assetType) || /투자|주식|증권|etf|펀드/.test(text)) return 'investment';
        return 'operating';
    }

    function buildCfoAssetGroups(portfolioData) {
        const groups = CFO_ASSET_GROUP_DEFINITIONS.map((definition) => ({
            ...definition,
            items: [],
            assetAmount: 0,
            liabilityAmount: 0,
            netAmount: 0,
        }));
        const groupByKey = new Map(groups.map((group) => [group.key, group]));
        flattenPortfolio(portfolioData).filter((item) => !isExcludedCfoItem(item)).forEach((item) => {
            const key = classifyCfoAssetGroup(item);
            const group = groupByKey.get(key) || groupByKey.get('operating');
            const debt = isDebtItem(item);
            const normalizedItem = { ...item, cfoGroupKey: group.key, isDebt: debt };
            group.items.push(normalizedItem);
            if (debt) group.liabilityAmount += Math.abs(number(item.amount));
            else group.assetAmount += Math.max(0, number(item.amount));
            group.netAmount = group.assetAmount - group.liabilityAmount;
        });
        groups.forEach((group) => group.items.sort((a, b) => compareCfoGroupItems(a, b, group.key)));
        const totalAssets = groups.reduce((sum, group) => sum + group.assetAmount, 0);
        const totalLiabilities = groups.reduce((sum, group) => sum + group.liabilityAmount, 0);
        return {
            groups,
            totalAssets,
            totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
        };
    }

    function isTiedItem(item) {
        return Boolean(item.maturity)
            || item.assetType === 'pension'
            || /부동산|보증금|청약/.test(`${item.groupName} ${item.name || ''}`);
    }

    function buildPortfolioSnapshotFromItems(items, options = {}) {
        if (!items.length) return null;

        const assets = items.filter((item) => !isDebtItem(item));
        const liabilities = items.filter(isDebtItem);
        const totalAssets = assets.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
        const totalLiabilities = liabilities.reduce((sum, item) => sum + Math.abs(item.amount), 0);
        const investedAssets = assets
            .filter((item) => ['stock', 'etf', 'pension'].includes(item.assetType))
            .reduce((sum, item) => sum + Math.max(0, item.amount), 0);
        const tiedAssets = assets.filter(isTiedItem).reduce((sum, item) => sum + Math.max(0, item.amount), 0);

        return {
            totalAssets,
            totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
            liquidAssets: Math.max(0, totalAssets - tiedAssets),
            tiedAssets,
            investedAssets,
            debtRatio: totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0,
            assetCount: assets.length,
            liabilityCount: liabilities.length,
            source: 'portfolio',
            sourceLabel: '포트폴리오 실제값',
            asOf: options.asOf || '',
        };
    }

    function buildPortfolioSnapshot(portfolioData, options = {}) {
        return buildPortfolioSnapshotFromItems(flattenPortfolio(portfolioData), options);
    }

    function buildPortfolioRowsSnapshot(portfolioRows, options = {}) {
        if (!Array.isArray(portfolioRows)) return null;
        const items = portfolioRows.map((row) => {
            const groupName = String(row?.group_name || '미분류');
            const amount = number(row?.amount);
            const assetType = String(row?.asset_type || '').toLowerCase();
            return {
                ...row,
                groupName,
                groupIsDebt: /부채|대출/.test(groupName),
                name: String(row?.name || ''),
                amount: assetType === 'debt' && amount > 0 ? -amount : amount,
                maturity: String(row?.maturity || ''),
                assetType,
            };
        }).filter((item) => item.name);
        return buildPortfolioSnapshotFromItems(items, options);
    }

    function buildAssetHistorySnapshot(assetHistory, options = {}) {
        const values = Array.isArray(assetHistory?.data) ? assetHistory.data : [];
        if (!values.length) return null;
        const latest = number(values[values.length - 1]);
        return {
            totalAssets: latest,
            totalLiabilities: 0,
            netWorth: latest,
            liquidAssets: 0,
            tiedAssets: 0,
            investedAssets: 0,
            debtRatio: 0,
            assetCount: 0,
            liabilityCount: 0,
            source: 'asset-history',
            sourceLabel: '월말 자산 스냅샷',
            asOf: options.asOf || '',
        };
    }

    function buildOfficialSnapshot(options = {}) {
        return buildPortfolioRowsSnapshot(options.portfolioRows, { asOf: options.asOf })
            || buildPortfolioSnapshot(options.portfolioData, { asOf: options.asOf })
            || buildAssetHistorySnapshot(options.assetHistory, { asOf: options.asOf })
            || {
                totalAssets: 0,
                totalLiabilities: 0,
                netWorth: 0,
                liquidAssets: 0,
                tiedAssets: 0,
                investedAssets: 0,
                debtRatio: 0,
                assetCount: 0,
                liabilityCount: 0,
                source: 'none',
                sourceLabel: '데이터 없음',
                asOf: options.asOf || '',
            };
    }

    function getSourceBadge(snapshot) {
        const asOfText = typeof utils.formatDateTime === 'function'
            ? utils.formatDateTime(snapshot?.asOf)
            : (snapshot?.asOf || '기준일 미확인');
        return `${snapshot?.sourceLabel || '데이터 없음'} · ${asOfText}`;
    }

    function buildDecisionItems({ snapshot, cashFlow = {}, fundingStatus = {} } = {}) {
        const items = [];
        const income = number(cashFlow.totalIncome);
        const expense = number(cashFlow.totalExpense);
        const freeCashFlow = income - expense;
        const expenseRatio = income > 0 ? (expense / income) * 100 : 0;
        const cashFlowPeriodState = cashFlow.reviewStatus === 'confirmed' ? '마감' : '기간 종료';
        const cashFlowLabel = cashFlow.periodLabel ? `${cashFlow.periodLabel} ${cashFlowPeriodState}` : '이번 달';
        const debtRatio = number(snapshot?.debtRatio);
        const fundingPct = number(fundingStatus?.savedPct);

        if (number(cashFlow.staleDays) >= 7) {
            items.push({
                priority: 95,
                priorityLabel: '점검',
                tone: 'amber',
                icon: 'fa-clock-rotate-left',
                target: 'stats-view',
                title: `현금흐름 기록이 ${number(cashFlow.staleDays)}일 전에서 멈췄습니다.`,
                detail: `마지막 거래 ${cashFlow.latestTransactionDate || '-'} · ${cashFlowLabel} 기준입니다.`,
            });
        }

        if (freeCashFlow < 0) {
            items.push({ priority: 100, priorityLabel: '긴급', tone: 'rose', icon: 'fa-arrow-trend-down', target: 'stats-view', title: `${cashFlowLabel} 현금흐름이 적자입니다.`, detail: `${Math.abs(freeCashFlow).toLocaleString('ko-KR')}원만큼 지출이 더 많습니다.` });
        } else if (income > 0) {
            items.push({ priority: 30, priorityLabel: '참고', tone: 'emerald', icon: 'fa-wallet', target: 'stats-view', title: `${cashFlowLabel} 잉여현금을 확인하세요.`, detail: `${freeCashFlow.toLocaleString('ko-KR')}원이 남았습니다.` });
        }
        if (expenseRatio >= 70) {
            items.push({ priority: 90, priorityLabel: '점검', tone: 'amber', icon: 'fa-gauge-high', target: 'stats-view', title: '지출 비율이 높습니다.', detail: `월수입의 ${expenseRatio.toFixed(1)}%를 사용했습니다.` });
        }
        if (debtRatio >= 25) {
            items.push({ priority: 80, priorityLabel: '점검', tone: 'rose', icon: 'fa-scale-balanced', target: 'portfolio-view', title: '부채비율 점검이 필요합니다.', detail: `현재 총자산 대비 ${debtRatio.toFixed(1)}%입니다.` });
        }
        if (fundingPct > 0 && fundingPct < 50) {
            items.push({ priority: 60, priorityLabel: '계획', tone: 'indigo', icon: 'fa-house', target: 'asset-view', title: '주거 목표 가용자금을 점검하세요.', detail: `연금 제외·부채 차감 기준 ${fundingPct.toFixed(1)}%입니다.` });
        }
        if (!items.length) {
            items.push({ priority: 10, priorityLabel: '안내', tone: 'slate', icon: 'fa-clipboard-check', target: 'portfolio-view', title: '이번 달 재무 점검을 시작하세요.', detail: '계좌 잔액과 포트폴리오 기준일을 확인합니다.' });
        }
        return items.sort((a, b) => b.priority - a.priority).slice(0, 3);
    }

    root.FinanceModel = Object.freeze({
        buildPortfolioSnapshot,
        buildPortfolioRowsSnapshot,
        buildAssetHistorySnapshot,
        buildOfficialSnapshot,
        buildDecisionItems,
        buildCfoAssetGroups,
        classifyCfoAssetGroup,
        flattenPortfolio,
        getSourceBadge,
        isDebtItem,
    });
})(typeof window !== 'undefined' ? window : globalThis);
