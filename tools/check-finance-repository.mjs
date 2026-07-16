import assert from 'node:assert/strict';

await import('../js/features/financeRepository.js');

const repository = globalThis.FinanceRepository;
assert.ok(repository, 'FinanceRepository global must be available');
assert.ok(repository.DEFAULT_DATA_TABLES.includes('transactions'));
assert.ok(repository.DEFAULT_DATA_TABLES.includes('finance_month_closes'));
assert.ok(repository.TABLE_SPECS.transactions.columns.includes('id'));
assert.ok(repository.TABLE_SPECS.portfolios.columns.includes('account_order'));

const legacyTransactions = [
    ['날짜', '시간', '타입', '대분류', '소분류', '내용', '금액', '화폐', '결제수단'],
    ['2026-06-25', '09:00', '수입', '월급', '', '급여', '3908580', 'KRW', '급여통장'],
    ['2026-06-28', '12:00', '지출', '식비', '점심', '식사', '-12000', 'KRW', '카드'],
];
const normalizedTransactions = repository.normalizeTableRows('transactions', legacyTransactions);
assert.equal(normalizedTransactions.length, 2);
assert.equal(normalizedTransactions[0].amount, 3_908_580);
assert.equal(normalizedTransactions[1].category, '식비');

const normalizedPortfolio = repository.normalizeTableRows('portfolios', [{
    id: 'loan',
    group_name: '부채',
    name: '직장인론',
    currency: 'KRW',
    amount: '65000000',
    asset_type: 'debt',
    account_order: '20',
}]);
assert.equal(normalizedPortfolio[0].amount, 65_000_000);
assert.equal(normalizedPortfolio[0].account_order, 20);

const cache = repository.normalizeCache({
    tx: legacyTransactions,
    portfolio: normalizedPortfolio,
});
const snapshot = repository.getSnapshot(cache, { updatedAt: '2026-07-17T00:00:00+09:00' });
assert.equal(snapshot.transactions.length, 2);
assert.equal(snapshot.portfolios[0].asset_type, 'debt');
assert.equal(snapshot.updatedAt, '2026-07-17T00:00:00+09:00');

const draft = repository.createPortfolioDraft([
    normalizedPortfolio[0],
    { id: 'cash', group_name: '현금', name: '생활계좌', amount: 1_000_000, asset_type: 'account' },
]);
assert.equal(draft.items.length, 2);
assert.equal(draft.items[0].groupName, '부채');
assert.equal(draft.items[0].accountOrder, 20);
draft.items[0].name = '직장인론 수정';
draft.items = draft.items.filter((item) => item.id !== 'cash');
const addedDraftItem = repository.addPortfolioDraftItem(draft, '안전');
addedDraftItem.name = '새 적금';
addedDraftItem.amount = 300_000;
addedDraftItem.assetType = 'account';
const mutation = repository.buildPortfolioMutation(draft);
assert.equal(mutation.upserts.length, 1);
assert.equal(mutation.upserts[0].name, '직장인론 수정');
assert.equal(mutation.inserts.length, 1);
assert.equal(mutation.inserts[0].name, '새 적금');
assert.deepEqual(mutation.removedIds, ['cash']);

const merged = repository.mergeTransactionRows(normalizedTransactions.slice(1), normalizedTransactions.slice(0, 1));
assert.deepEqual(merged.map((row) => row.date), ['2026-06-25', '2026-06-28']);

const periods = repository.buildAccountingPeriods(normalizedTransactions, (date) => ({
    monthKey: '2026-07',
    title: '2026년 7월',
    periodStart: date < '2026-06-26' ? '2026-06-25' : '2026-06-25',
    periodEnd: '2026-07-24',
}));
assert.equal(periods.length, 1);
assert.equal(periods[0].transactions[1].subcategory, '점심');

const closePayload = repository.toFinanceMonthClosePayload({
    periodKey: '2026-06', periodStart: '2026-05-25', periodEnd: '2026-06-24', status: 'closed',
    classifications: { expense: { category: '식비' } }, transactionCount: 2, sourceRevision: '2:test',
});
assert.equal(closePayload.period_key, '2026-06');
assert.equal(closePayload.status, 'closed');
const mergedCloses = repository.mergeFinanceMonthCloseRows(
    [{ period_key: '2026-06', status: 'open', updated_at: '2026-06-24T00:00:00Z' }],
    [{ period_key: '2026-06', status: 'closed', updated_at: '2026-06-25T00:00:00Z' }],
);
assert.equal(mergedCloses[0].status, 'closed');

const queryLog = [];
const responses = {
    transactions: { data: [{ date: '2026-07-01', type: '지출', amount: '-1000' }], error: null },
    cards: { data: null, error: { message: 'optional table unavailable' } },
};
function createQuery(table) {
    const query = {
        select(columns) {
            queryLog.push({ table, action: 'select', columns });
            return query;
        },
        order(column, options) {
            queryLog.push({ table, action: 'order', column, ascending: options.ascending });
            return query;
        },
        then(resolve, reject) {
            return Promise.resolve(responses[table]).then(resolve, reject);
        },
    };
    return query;
}
const optionalErrors = [];
const supabaseRepository = repository.createSupabaseFinanceRepository({
    getClient: () => ({ from: (table) => createQuery(table) }),
    onOptionalError: (table, error) => optionalErrors.push({ table, message: error.message }),
});
const remotePatch = await supabaseRepository.fetchTables(['transactions', 'cards']);
assert.equal(remotePatch.tx[0].amount, -1000);
assert.equal(Object.hasOwn(remotePatch, 'cards'), false);
assert.equal(optionalErrors[0].table, 'cards');
assert.ok(queryLog.some((entry) => entry.table === 'transactions' && entry.action === 'order' && entry.column === 'date'));

const writeLog = [];
const writeClient = {
    from(table) {
        return {
            async upsert(payload, options) {
                writeLog.push({ table, action: 'upsert', payload, options });
                return { error: null };
            },
            async insert(payload) {
                writeLog.push({ table, action: 'insert', payload });
                return { error: null };
            },
            delete() {
                return {
                    async in(column, values) {
                        writeLog.push({ table, action: 'delete', column, values });
                        return { error: null };
                    },
                };
            },
        };
    },
};
const writeRepository = repository.createSupabaseFinanceRepository({ getClient: () => writeClient });
await writeRepository.savePortfolioDraft(draft);
assert.deepEqual(writeLog.map((entry) => entry.action), ['upsert', 'insert', 'delete']);
assert.equal(writeLog[0].options.onConflict, 'id');
assert.deepEqual(writeLog[2].values, ['cash']);

console.log('Finance repository checks ok');
