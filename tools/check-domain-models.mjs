import assert from 'node:assert/strict';

await import('../js/shared/appUtils.js');
await import('../js/features/financeModel.js');

const { AppUtils, FinanceModel } = globalThis;

assert.equal(AppUtils.escapeHtml('<계좌 & 자산>'), '&lt;계좌 &amp; 자산&gt;');
assert.equal(AppUtils.toLocalDateString(new Date('2026-07-15T12:00:00+09:00')), '2026-07-15');
assert.equal(AppUtils.formatWon(1234567), '1,234,567원');

const portfolioData = {
    현금: {
        isDebt: false,
        items: [{ id: 'cash', name: '생활계좌', amount: 1000000, classification: { assetType: 'account' } }],
    },
    투자: {
        isDebt: false,
        items: [{ id: 'etf', name: 'ETF', amount: 500000, classification: { assetType: 'etf' } }],
    },
    부채: {
        isDebt: true,
        items: [{ id: 'loan', name: '신용대출', amount: -400000, classification: { assetType: 'debt' } }],
    },
};

const snapshot = FinanceModel.buildOfficialSnapshot({ portfolioData, asOf: '2026-07-15T12:00:00+09:00' });
assert.equal(snapshot.totalAssets, 1500000);
assert.equal(snapshot.totalLiabilities, 400000);
assert.equal(snapshot.netWorth, 1100000);
assert.equal(snapshot.assetCount, 2);
assert.equal(snapshot.liabilityCount, 1);
assert.equal(Number(snapshot.debtRatio.toFixed(2)), 26.67);

const fallback = FinanceModel.buildOfficialSnapshot({ assetHistory: { data: [900000, 1200000] } });
assert.equal(fallback.source, 'asset-history');
assert.equal(fallback.netWorth, 1200000);

const rowSnapshot = FinanceModel.buildOfficialSnapshot({
    portfolioRows: [
        { group_name: '현금', name: '생활계좌', amount: 1000000, asset_type: 'account' },
        { group_name: '부채', name: '직장인론', amount: 400000, asset_type: 'debt' },
    ],
});
assert.equal(rowSnapshot.totalAssets, 1000000);
assert.equal(rowSnapshot.totalLiabilities, 400000);
assert.equal(rowSnapshot.netWorth, 600000);

const decisions = FinanceModel.buildDecisionItems({
    snapshot,
    cashFlow: { totalIncome: 1000000, totalExpense: 1200000 },
    fundingStatus: { totalPct: 20 },
});
assert.equal(decisions.length, 3);
assert.ok(decisions.some((item) => item.target === 'stats-view' && item.tone === 'rose'));
assert.ok(decisions.some((item) => item.target === 'portfolio-view'));

console.log('Domain model checks ok');
