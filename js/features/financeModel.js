(function (root) {
    const utils = root.AppUtils || {};

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

    function isTiedItem(item) {
        return Boolean(item.maturity)
            || item.assetType === 'pension'
            || /부동산|보증금|청약/.test(`${item.groupName} ${item.name || ''}`);
    }

    function buildPortfolioSnapshot(portfolioData, options = {}) {
        const items = flattenPortfolio(portfolioData);
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
        return buildPortfolioSnapshot(options.portfolioData, { asOf: options.asOf })
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
        const cashFlowLabel = cashFlow.periodLabel ? `${cashFlow.periodLabel} 마감` : '이번 달';
        const debtRatio = number(snapshot?.debtRatio);
        const fundingPct = number(fundingStatus?.savedPct);

        if (number(cashFlow.staleDays) >= 7) {
            items.push({
                tone: 'amber',
                icon: 'fa-clock-rotate-left',
                target: 'stats-view',
                title: `현금흐름 기록이 ${number(cashFlow.staleDays)}일 전에서 멈췄습니다.`,
                detail: `마지막 거래 ${cashFlow.latestTransactionDate || '-'} · ${cashFlowLabel} 기준입니다.`,
            });
        }

        if (freeCashFlow < 0) {
            items.push({ tone: 'rose', icon: 'fa-arrow-trend-down', target: 'stats-view', title: `${cashFlowLabel} 현금흐름이 적자입니다.`, detail: `${Math.abs(freeCashFlow).toLocaleString('ko-KR')}원만큼 지출이 더 많습니다.` });
        } else if (income > 0) {
            items.push({ tone: 'emerald', icon: 'fa-wallet', target: 'stats-view', title: `${cashFlowLabel} 잉여현금을 확인하세요.`, detail: `${freeCashFlow.toLocaleString('ko-KR')}원이 남았습니다.` });
        }
        if (expenseRatio >= 70) {
            items.push({ tone: 'amber', icon: 'fa-gauge-high', target: 'stats-view', title: '지출 비율이 높습니다.', detail: `월수입의 ${expenseRatio.toFixed(1)}%를 사용했습니다.` });
        }
        if (debtRatio >= 25) {
            items.push({ tone: 'rose', icon: 'fa-scale-balanced', target: 'portfolio-view', title: '부채비율 점검이 필요합니다.', detail: `현재 총자산 대비 ${debtRatio.toFixed(1)}%입니다.` });
        }
        if (fundingPct > 0 && fundingPct < 50) {
            items.push({ tone: 'indigo', icon: 'fa-house', target: 'realestate-view', title: '청약 자기자금을 점검하세요.', detail: `연금 제외·부채 차감 기준 ${fundingPct.toFixed(1)}%입니다.` });
        }
        if (!items.length) {
            items.push({ tone: 'slate', icon: 'fa-clipboard-check', target: 'portfolio-view', title: '이번 달 재무 점검을 시작하세요.', detail: '계좌 잔액과 포트폴리오 기준일을 확인합니다.' });
        }
        return items.slice(0, 3);
    }

    root.FinanceModel = Object.freeze({
        buildPortfolioSnapshot,
        buildAssetHistorySnapshot,
        buildOfficialSnapshot,
        buildDecisionItems,
        flattenPortfolio,
        getSourceBadge,
        isDebtItem,
    });
})(typeof window !== 'undefined' ? window : globalThis);
