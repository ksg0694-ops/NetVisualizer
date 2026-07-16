(function (root) {
    const STORAGE_KEY = 'netvisualizer.finance.monthlyCloses.v1';
    const REVIEW_PAGE_SIZE = 30;
    const domain = root.PersonalCfoDomain;
    if (!domain) throw new Error('PersonalCfoDomain is required for MonthlyCloseFeature.');

    const records = new Map();
    const reviewOpen = new Set();
    const reviewPages = new Map();
    const syncStates = new Map();
    const remoteTimers = new Map();
    let activeContext = null;

    const BASE_CATEGORIES = {
        '수입': ['월급', '상여', '이자', '기타수입'],
        '지출': ['고정비', '상환', '식비', '생활비', '교통', '주거', '의료', '교육', '여가', '기타지출'],
        '이체': ['저축', '투자', '계좌이동'],
    };

    function escapeHtml(value) {
        return root.AppUtils.escapeHtml(value);
    }

    function escapeAttr(value) {
        return root.AppUtils.escapeAttr(value);
    }

    function nowIso() {
        return new Date().toISOString();
    }

    function loadLocal() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            if (!Array.isArray(parsed)) return;
            parsed.forEach((value) => {
                const record = domain.normalizeFinanceMonthlyCloseRecord(value);
                if (record.periodKey) records.set(record.periodKey, record);
            });
        } catch (error) {
            console.warn('Monthly close local state could not be read.', error);
        }
    }

    function persistLocal() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(records.values())));
    }

    function hydrate(rows = []) {
        rows.forEach((value) => {
            const incoming = domain.normalizeFinanceMonthlyCloseRecord(value);
            if (!incoming.periodKey) return;
            const current = records.get(incoming.periodKey);
            if (!current || String(incoming.updatedAt || '') >= String(current.updatedAt || '')) {
                records.set(incoming.periodKey, incoming);
                syncStates.set(incoming.periodKey, 'cloud');
            }
        });
        persistLocal();
    }

    function getRecord(periodKey, period = {}) {
        return records.get(periodKey) || domain.createFinanceMonthlyCloseRecord(
            periodKey,
            period.startDate || period.periodStart || '',
            period.endDate || period.periodEnd || '',
        );
    }

    function getEffectiveTransactions(periodKey, transactions = [], options = {}) {
        const record = records.get(periodKey);
        if (!record) return transactions.map((item) => ({ ...item }));
        if (options.includeDraft || domain.canApplyConfirmedMonthlyClose(transactions, record)) {
            return domain.applyFinanceMonthlyClose(transactions, record);
        }
        return transactions.map((item) => ({ ...item }));
    }

    function applyToPeriods(periods = []) {
        return periods.map((period) => {
            const transactions = period.transactions || [];
            const record = records.get(period.key);
            const closeSummary = record
                ? domain.summarizeFinanceMonthlyClose(transactions, record)
                : null;
            const closeStatus = record?.status === 'closed'
                ? (closeSummary?.isStale ? 'stale' : 'confirmed')
                : 'unconfirmed';
            return {
                ...period,
                closeStatus,
                transactions: getEffectiveTransactions(period.key, transactions),
            };
        });
    }

    function formatAmount(value) {
        const amount = Number(value || 0);
        return `${amount > 0 ? '+' : ''}${Math.round(amount).toLocaleString('ko-KR')}원`;
    }

    function categoryOptions(type, transactions, selected) {
        const values = new Set(BASE_CATEGORIES[type] || ['미분류']);
        transactions.forEach((item) => {
            if (item.type !== type) return;
            const category = String(item.category || item.cat || '').trim();
            if (category) values.add(category);
        });
        if (selected) values.add(selected);
        return Array.from(values).map((value) => `
            <option value="${escapeAttr(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>
        `).join('');
    }

    function getStatusModel(record, summary, periodComplete) {
        if (record.status === 'closed' && summary.isStale) {
            return { label: '재검토 필요', classes: 'border-rose-100 bg-rose-50 text-rose-700' };
        }
        if (record.status === 'closed') {
            return { label: '마감 완료', classes: 'border-emerald-100 bg-emerald-50 text-emerald-700' };
        }
        if (!periodComplete) {
            return { label: '기간 진행 중', classes: 'border-sky-100 bg-sky-50 text-sky-700' };
        }
        if (summary.unclassifiedCount > 0) {
            return { label: `미분류 ${summary.unclassifiedCount}건`, classes: 'border-amber-100 bg-amber-50 text-amber-700' };
        }
        return { label: '확정 가능', classes: 'border-indigo-100 bg-indigo-50 text-indigo-700' };
    }

    function getSyncLabel(periodKey) {
        const state = syncStates.get(periodKey);
        if (state === 'saving') return '클라우드 저장 중';
        if (state === 'cloud') return '클라우드 저장됨';
        if (state === 'local') return '로컬 저장됨';
        return '저장 대기';
    }

    function renderReviewRows(record, sourceTransactions, effectiveTransactions) {
        if (!effectiveTransactions.length) {
            return '<p class="py-8 text-center text-sm text-gray-400">검토할 거래가 없습니다.</p>';
        }
        const closed = record.status === 'closed';
        return effectiveTransactions.map((item, index) => {
            const source = sourceTransactions[index] || item;
            const key = domain.createTransactionKey(source);
            const changed = !!record.classifications[key];
            const category = String(item.category || item.cat || '미분류');
            const subcategory = String(item.subcategory || item.subcat || '미분류');
            const disabled = closed ? 'disabled' : '';
            const amountClass = Number(item.amount) >= 0 ? 'text-blue-600' : 'text-rose-600';
            return `
                <div data-close-transaction-key="${escapeAttr(key)}" class="grid grid-cols-1 gap-2 border-b border-gray-100 px-3 py-3 last:border-b-0 lg:grid-cols-[minmax(200px,1fr)_110px_150px_160px_30px] lg:items-center">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <p class="truncate text-xs font-bold text-gray-800">${escapeHtml(item.memo || '내용 없음')}</p>
                            ${changed ? '<span class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600">수정됨</span>' : ''}
                        </div>
                        <p class="mt-0.5 text-[10px] text-gray-400">${escapeHtml(item.date)} ${escapeHtml(item.time || '')} · <span class="font-bold ${amountClass}">${escapeHtml(formatAmount(item.amount))}</span></p>
                    </div>
                    <select data-close-field="type" aria-label="거래 유형" ${disabled} class="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 disabled:bg-gray-50 disabled:text-gray-400">
                        ${['수입', '지출', '이체'].map((type) => `<option value="${type}" ${item.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                    </select>
                    <select data-close-field="category" aria-label="거래 분류" ${disabled} class="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-400">
                        ${categoryOptions(item.type, effectiveTransactions, category)}
                    </select>
                    <input data-close-field="subcategory" aria-label="거래 상세 분류" ${disabled} value="${escapeAttr(subcategory)}" class="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 disabled:bg-gray-50 disabled:text-gray-400" />
                    <button type="button" data-close-reset="${escapeAttr(key)}" ${!changed || closed ? 'disabled' : ''} title="원래 분류로 되돌리기" class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-20">
                        <i class="fas fa-rotate-left text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    function render(context = activeContext) {
        if (!context) return;
        activeContext = context;
        const panel = document.getElementById('cashflow-month-close-panel');
        if (!panel) return;
        const { periodKey, period, transactions = [] } = context;
        const record = getRecord(periodKey, period);
        const effective = domain.applyFinanceMonthlyClose(transactions, record);
        const summary = domain.summarizeFinanceMonthlyClose(transactions, record);
        const today = root.AppUtils.toLocalDateString();
        const periodComplete = String(period.endDate || period.periodEnd || '') < today;
        const status = getStatusModel(record, summary, periodComplete);
        const isOpen = reviewOpen.has(periodKey);
        const pageCount = Math.max(1, Math.ceil(effective.length / REVIEW_PAGE_SIZE));
        const reviewPage = Math.max(0, Math.min(pageCount - 1, Number(reviewPages.get(periodKey) || 0)));
        reviewPages.set(periodKey, reviewPage);
        const reviewStart = reviewPage * REVIEW_PAGE_SIZE;
        const reviewEnd = Math.min(effective.length, reviewStart + REVIEW_PAGE_SIZE);
        const closed = record.status === 'closed';
        const actionDisabled = !closed && (!periodComplete || !summary.canClose);
        const actionLabel = closed ? '마감 해제' : '마감 확정';
        const actionIcon = closed ? 'fa-lock-open' : 'fa-lock';

        panel.innerHTML = `
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                        <h3 class="text-sm font-bold text-gray-900">월 마감</h3>
                        <span class="rounded-md border px-2 py-0.5 text-[10px] font-bold ${status.classes}">${escapeHtml(status.label)}</span>
                        <span class="text-[10px] text-gray-400">${escapeHtml(getSyncLabel(periodKey))}</span>
                    </div>
                    <p class="mt-0.5 text-[11px] text-gray-500">${escapeHtml(period.label || period.title || periodKey)} · 총 ${summary.totalCount}건 · 재분류 ${summary.overrideCount}건 · 미분류 ${summary.unclassifiedCount}건</p>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" data-close-toggle class="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50">
                        <i class="fas ${isOpen ? 'fa-chevron-up' : 'fa-list-check'}"></i>${isOpen ? '검토 접기' : '분류 검토'}
                    </button>
                    <button type="button" data-close-action ${actionDisabled ? 'disabled' : ''} class="inline-flex h-9 items-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400">
                        <i class="fas ${actionIcon}"></i>${actionLabel}
                    </button>
                </div>
            </div>
            ${!periodComplete && !closed ? '<p class="mt-2 text-[10px] text-sky-600">현재 급여기간은 분류 검토만 가능하며 기간 종료 후 마감할 수 있습니다.</p>' : ''}
            ${summary.isStale ? '<p class="mt-2 text-[10px] font-semibold text-rose-600">마감 후 거래가 변경되었습니다. 마감을 해제하고 다시 확정해주세요.</p>' : ''}
            ${isOpen ? `
                <div class="mt-3 overflow-hidden rounded-md border border-gray-200 bg-white">
                    <div class="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2">
                        <span class="text-[10px] font-semibold text-gray-500">${summary.totalCount ? `${reviewStart + 1}-${reviewEnd} / ${summary.totalCount}건` : '0건'}</span>
                        <div class="flex items-center gap-1">
                            <button type="button" data-close-page="${reviewPage - 1}" ${reviewPage <= 0 ? 'disabled' : ''} title="이전 거래" class="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white disabled:opacity-25"><i class="fas fa-chevron-left text-[10px]"></i></button>
                            <span class="min-w-[44px] text-center text-[10px] font-bold text-gray-500">${reviewPage + 1} / ${pageCount}</span>
                            <button type="button" data-close-page="${reviewPage + 1}" ${reviewPage >= pageCount - 1 ? 'disabled' : ''} title="다음 거래" class="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-white disabled:opacity-25"><i class="fas fa-chevron-right text-[10px]"></i></button>
                        </div>
                    </div>
                    <div class="hidden border-b border-gray-100 bg-gray-50 px-3 py-2 text-[10px] font-bold text-gray-400 lg:grid lg:grid-cols-[minmax(200px,1fr)_110px_150px_160px_30px]">
                        <span>거래</span><span>유형</span><span>분류</span><span>상세 분류</span><span></span>
                    </div>
                    <div class="max-h-[420px] overflow-y-auto">${renderReviewRows(record, transactions.slice(reviewStart, reviewEnd), effective.slice(reviewStart, reviewEnd))}</div>
                </div>
            ` : ''}
        `;
        bindPanel(panel, context);
    }

    function saveLocalRecord(record) {
        records.set(record.periodKey, record);
        syncStates.set(record.periodKey, 'local');
        persistLocal();
    }

    async function persistRemote(record) {
        if (typeof root.saveFinanceMonthlyCloseRecord !== 'function') return;
        syncStates.set(record.periodKey, 'saving');
        render();
        try {
            const saved = await root.saveFinanceMonthlyCloseRecord(record);
            hydrate([saved]);
            syncStates.set(record.periodKey, 'cloud');
        } catch (error) {
            console.warn('Monthly close cloud save failed.', error);
            syncStates.set(record.periodKey, 'local');
            root.showToast?.('월 마감은 로컬에 저장됐지만 클라우드 저장은 실패했습니다.', 'warning', 3000);
        }
        render();
    }

    function queueRemote(record) {
        clearTimeout(remoteTimers.get(record.periodKey));
        remoteTimers.set(record.periodKey, setTimeout(() => persistRemote(record), 500));
    }

    function refreshFinance() {
        root.refreshFinanceAfterMonthlyClose?.();
        render();
    }

    function bindPanel(panel, context) {
        panel.onclick = async (event) => {
            const toggle = event.target.closest('[data-close-toggle]');
            if (toggle) {
                if (reviewOpen.has(context.periodKey)) reviewOpen.delete(context.periodKey);
                else reviewOpen.add(context.periodKey);
                render();
                return;
            }

            const pageButton = event.target.closest('[data-close-page]');
            if (pageButton && !pageButton.disabled) {
                reviewPages.set(context.periodKey, Number(pageButton.dataset.closePage || 0));
                render();
                return;
            }

            const reset = event.target.closest('[data-close-reset]');
            if (reset && !reset.disabled) {
                const source = context.transactions.find((item) => domain.createTransactionKey(item) === reset.dataset.closeReset);
                if (!source) return;
                const current = getRecord(context.periodKey, context.period);
                const next = domain.updateFinanceMonthlyCloseClassification(current, source, {
                    type: source.type,
                    category: source.category || source.cat || '미분류',
                    subcategory: source.subcategory || source.subcat || '미분류',
                }, nowIso());
                saveLocalRecord(next);
                queueRemote(next);
                refreshFinance();
                return;
            }

            const action = event.target.closest('[data-close-action]');
            if (!action || action.disabled) return;
            const current = getRecord(context.periodKey, context.period);
            let next;
            if (current.status === 'closed') {
                next = domain.reopenFinanceMonth(current, nowIso());
                reviewOpen.add(context.periodKey);
                root.showToast?.('월 마감을 해제했습니다.', 'info');
            } else {
                next = domain.closeFinanceMonth(current, context.transactions, nowIso());
                root.showToast?.(`${context.period.label || context.periodKey} 마감을 확정했습니다.`, 'success');
            }
            saveLocalRecord(next);
            clearTimeout(remoteTimers.get(next.periodKey));
            await persistRemote(next);
            refreshFinance();
        };

        panel.onchange = (event) => {
            const control = event.target.closest('[data-close-field]');
            if (!control) return;
            const row = control.closest('[data-close-transaction-key]');
            const source = context.transactions.find((item) => domain.createTransactionKey(item) === row?.dataset.closeTransactionKey);
            if (!source) return;
            const current = getRecord(context.periodKey, context.period);
            if (current.status === 'closed') return;
            const next = domain.updateFinanceMonthlyCloseClassification(current, source, {
                type: row.querySelector('[data-close-field="type"]').value,
                category: row.querySelector('[data-close-field="category"]').value,
                subcategory: row.querySelector('[data-close-field="subcategory"]').value,
            }, nowIso());
            saveLocalRecord(next);
            queueRemote(next);
            refreshFinance();
        };
    }

    loadLocal();

    root.MonthlyCloseFeature = Object.freeze({
        applyToPeriods,
        getEffectiveTransactions,
        getRecord,
        hydrate,
        render,
    });
})(typeof window !== 'undefined' ? window : globalThis);
