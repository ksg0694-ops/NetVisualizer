import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/generated/personal-cfo-domain.js', import.meta.url), 'utf8');
const context = vm.createContext({ console });
vm.runInContext(source, context, { filename: 'personal-cfo-domain.js' });

const domain = context.PersonalCfoDomain;
const transactions = [
  { id: 'income', date: '2026-05-25', time: '09:00', type: '수입', category: '월급', subcategory: '급여', memo: '급여', amount: 4_000_000 },
  { id: 'expense', date: '2026-06-02', time: '12:00', type: '지출', category: '미분류', subcategory: '미분류', memo: '점심', amount: -12_000 },
];

let record = domain.createFinanceMonthlyCloseRecord('2026-06', '2026-05-25', '2026-06-24', '2026-06-25T00:00:00Z');
let summary = domain.summarizeFinanceMonthlyClose(transactions, record);
assert.equal(summary.totalCount, 2);
assert.equal(summary.unclassifiedCount, 1);
assert.equal(summary.canClose, false);
assert.throws(() => domain.closeFinanceMonth(record, transactions, '2026-06-25T01:00:00Z'), /UNCLASSIFIED/);
assert.equal(domain.summarizeFinanceMonthlyClose(transactions, { ...record, status: 'closed' }).isStale, true);

record = domain.updateFinanceMonthlyCloseClassification(record, transactions[1], {
  type: '지출',
  category: '식비',
  subcategory: '점심',
}, '2026-06-25T00:30:00Z');
summary = domain.summarizeFinanceMonthlyClose(transactions, record);
assert.equal(summary.unclassifiedCount, 0);
assert.equal(summary.overrideCount, 1);

record = domain.closeFinanceMonth(record, transactions, '2026-06-25T01:00:00Z');
assert.equal(record.status, 'closed');
assert.equal(domain.canApplyConfirmedMonthlyClose(transactions, record), true);
const effective = domain.applyFinanceMonthlyClose(transactions, record);
assert.equal(effective[1].category, '식비');
assert.equal(effective[1].cat, '식비');

const changedTransactions = [...transactions, {
  id: 'late', date: '2026-06-20', time: '10:00', type: '지출', category: '교통', subcategory: '대중교통', memo: '버스', amount: -1_500,
}];
assert.equal(domain.summarizeFinanceMonthlyClose(changedTransactions, record).isStale, true);
assert.equal(domain.canApplyConfirmedMonthlyClose(changedTransactions, record), false);

const editedTransactions = transactions.map((transaction) => (
  transaction.id === 'expense' ? { ...transaction, amount: -13_000 } : transaction
));
assert.equal(
  domain.summarizeFinanceMonthlyClose(editedTransactions, record).isStale,
  true,
  'editing a source row must invalidate a close even when its id is unchanged',
);

record = domain.reopenFinanceMonth(record, '2026-06-26T00:00:00Z');
assert.equal(record.status, 'open');
assert.equal(domain.canApplyConfirmedMonthlyClose(transactions, record), false);

console.log('Monthly CFO close checks ok');
