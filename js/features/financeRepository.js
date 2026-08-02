(function (root) {
    const TABLE_SPECS = Object.freeze({
        transactions: {
            cacheKey: 'tx',
            columns: ['id', 'date', 'time', 'type', 'category', 'subcategory', 'memo', 'amount', 'currency', 'method'],
            order: [['date', true], ['id', true]],
            pageSize: 1000,
        },
        assets: {
            cacheKey: 'asset',
            columns: ['year', 'month', 'total_asset', 'cash', 'safe', 'invest', 'debt'],
            order: [['year', true], ['month', true]],
        },
        portfolios: {
            cacheKey: 'portfolio',
            columns: [
                'id', 'group_name', 'name', 'currency', 'maturity', 'amount', 'shares',
                'asset_type', 'instrument_type', 'ticker', 'risk_bucket', 'classification_source',
                'classification_updated_at', 'strategy_tag', 'avg_buy_price', 'account_name', 'account_order',
                'account_provider', 'account_type', 'asset_class', 'purpose_key',
                'mapping_review_status', 'mapping_source', 'mapping_updated_at',
            ],
        },
        portfolio_strategy_definitions: {
            cacheKey: 'portfolioStrategies',
            optional: true,
            columns: [
                'id', 'user_id', 'strategy_tag', 'label', 'color', 'icon',
                'display_order', 'is_active', 'created_at', 'updated_at',
            ],
            order: [['display_order', true], ['created_at', true]],
        },
        short_term_roadmap_goals: {
            cacheKey: 'shortTermRoadmapGoals',
            optional: true,
            columns: ['id', 'user_id', 'calendar_year', 'target_asset', 'created_at', 'updated_at'],
            order: [['calendar_year', true]],
        },
        cards: {
            cacheKey: 'cards',
            optional: true,
            columns: ['name', 'bank', 'purpose', 'image_data', 'target_amt', 'annual_fee', 'prt_ideal', 'prt_real'],
        },
        insurances: {
            cacheKey: 'insurances',
            optional: true,
            columns: ['category', 'description', 'company', 'monthly_payment', 'pay_day', 'start_date', 'end_date'],
        },
        quant_strategy_rules: {
            cacheKey: 'quantRules',
            optional: true,
            columns: ['strategy_tag', 'target_pct', 'band_pct', 'trigger_label', 'is_active', 'display_order', 'updated_at'],
            order: [['display_order', true]],
        },
        quant_strategy_rule_overrides: {
            cacheKey: 'quantRuleOverrides',
            optional: true,
            columns: ['user_id', 'strategy_tag', 'target_pct', 'band_pct', 'trigger_label', 'is_active', 'display_order', 'updated_at'],
            order: [['display_order', true]],
        },
        portfolio_market_prices: {
            cacheKey: 'marketPrices',
            optional: true,
            columns: ['ticker', 'price', 'currency', 'price_date', 'source', 'note', 'updated_at'],
            order: [['ticker', true]],
        },
        portfolio_market_price_overrides: {
            cacheKey: 'marketPriceOverrides',
            optional: true,
            columns: ['user_id', 'ticker', 'price', 'currency', 'price_date', 'source', 'note', 'updated_at'],
            order: [['ticker', true]],
        },
        portfolio_fx_rates: {
            cacheKey: 'fxRates',
            optional: true,
            columns: ['currency', 'krw_per_unit', 'rate_date', 'source', 'source_label', 'updated_at'],
            order: [['currency', true]],
        },
        portfolio_monthly_snapshots: {
            cacheKey: 'portfolioMonthlySnapshots',
            optional: true,
            columns: [
                'id', 'user_id', 'snapshot_month', 'snapshot_date', 'total_valuation_krw',
                'total_stored_amount_krw', 'position_count', 'price_coverage_pct',
                'fx_coverage_pct', 'port_totals', 'positions', 'source_revision',
                'created_at', 'updated_at',
            ],
            order: [['snapshot_month', true]],
        },
        finance_month_closes: {
            cacheKey: 'financeMonthCloses',
            optional: true,
            columns: [
                'id', 'user_id', 'period_key', 'period_start', 'period_end', 'status',
                'classifications', 'transaction_count', 'source_revision', 'reviewed_at',
                'closed_at', 'created_at', 'updated_at',
            ],
            order: [['period_key', true]],
        },
        real_estate_subscription_sites: {
            cacheKey: 'realEstateSubscriptions',
            optional: true,
            columns: [
                'id', 'block', 'site_name', 'region', 'district', 'supply_count', 'housing_type',
                'sale_type', 'priority', 'priority_order', 'budget_note', 'key_point', 'target_budget',
                'expected_notice_month', 'main_subscription_date', 'special_supply_start_date',
                'special_supply_end_date', 'general_supply_start_date', 'general_supply_end_date',
                'winner_announcement_date', 'contract_start_date', 'contract_end_date', 'latitude',
                'longitude', 'color', 'status', 'source', 'source_url', 'source_notice_no',
                'source_house_manage_no', 'synced_at', 'updated_at',
            ],
            order: [['priority_order', true], ['block', true]],
        },
        real_estate_housing_types: {
            cacheKey: 'realEstateHousingTypes',
            optional: true,
            columns: [
                'id', 'subscription_site_id', 'source_notice_no', 'source_house_manage_no', 'model_no',
                'housing_type', 'exclusive_area', 'supply_area', 'total_supply_count', 'general_supply_count',
                'special_supply_count', 'special_multi_child_count', 'special_newlywed_count',
                'special_first_life_count', 'special_elderly_parent_count', 'special_institution_count',
                'max_sale_price_krw', 'source', 'synced_at', 'updated_at',
            ],
        },
        real_estate_competition: {
            cacheKey: 'realEstateCompetition',
            optional: true,
            columns: [
                'id', 'subscription_site_id', 'source_notice_no', 'source_house_manage_no', 'model_no',
                'housing_type', 'supply_count', 'rank_no', 'residence_area', 'applications',
                'competition_rate', 'source', 'synced_at', 'updated_at',
            ],
        },
        real_estate_price_refs: {
            cacheKey: 'realEstatePriceRefs',
            optional: true,
            columns: [
                'id', 'apartment_name', 'region_code', 'region_name', 'legal_dong', 'deal_date',
                'deal_amount_krw', 'exclusive_area', 'floor_no', 'build_year', 'latitude',
                'longitude', 'source', 'synced_at', 'updated_at',
            ],
            order: [['deal_date', false]],
        },
    });

    const DEFAULT_DATA_TABLES = Object.freeze([
        'transactions',
        'assets',
        'portfolios',
        'portfolio_strategy_definitions',
        'short_term_roadmap_goals',
        'cards',
        'insurances',
        'quant_strategy_rules',
        'quant_strategy_rule_overrides',
        'portfolio_market_prices',
        'portfolio_market_price_overrides',
        'portfolio_fx_rates',
        'portfolio_monthly_snapshots',
        'finance_month_closes',
        'real_estate_subscription_sites',
    ]);
    const REAL_ESTATE_DETAIL_TABLES = Object.freeze([
        'real_estate_housing_types',
        'real_estate_competition',
        'real_estate_price_refs',
    ]);
    const ALL_DATA_TABLES = Object.freeze([...DEFAULT_DATA_TABLES, ...REAL_ESTATE_DETAIL_TABLES]);

    function finiteNumber(value, fallback = 0) {
        const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function nullableNumber(value) {
        if (value === null || value === undefined || value === '') return null;
        const parsed = finiteNumber(value, Number.NaN);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function normalizeTransaction(row = {}) {
        return {
            id: String(row.id || ''),
            date: String(row.date || ''),
            time: String(row.time || ''),
            type: String(row.type || ''),
            category: String(row.category || '미분류'),
            subcategory: String(row.subcategory || '미분류'),
            memo: String(row.memo || ''),
            amount: Math.round(finiteNumber(row.amount)),
            currency: String(row.currency || 'KRW'),
            method: String(row.method || ''),
        };
    }

    function normalizeAsset(row = {}) {
        return {
            year: Math.trunc(finiteNumber(row.year)),
            month: Math.trunc(finiteNumber(row.month)),
            total_asset: Math.round(finiteNumber(row.total_asset)),
            cash: Math.round(finiteNumber(row.cash)),
            safe: Math.round(finiteNumber(row.safe)),
            invest: Math.round(finiteNumber(row.invest)),
            debt: Math.round(finiteNumber(row.debt)),
        };
    }

    function normalizePortfolio(row = {}) {
        return {
            id: row.id || '',
            group_name: String(row.group_name || '미분류'),
            name: String(row.name || ''),
            currency: String(row.currency || 'KRW'),
            maturity: String(row.maturity || ''),
            amount: Math.round(finiteNumber(row.amount)),
            shares: nullableNumber(row.shares),
            asset_type: String(row.asset_type || ''),
            instrument_type: String(row.instrument_type || ''),
            ticker: String(row.ticker || ''),
            risk_bucket: String(row.risk_bucket || ''),
            classification_source: String(row.classification_source || ''),
            classification_updated_at: String(row.classification_updated_at || ''),
            strategy_tag: String(row.strategy_tag || ''),
            avg_buy_price: nullableNumber(row.avg_buy_price),
            account_name: String(row.account_name || ''),
            account_order: nullableNumber(row.account_order),
            account_provider: String(row.account_provider || ''),
            account_type: String(row.account_type || ''),
            asset_class: String(row.asset_class || ''),
            purpose_key: String(row.purpose_key || ''),
            mapping_review_status: String(row.mapping_review_status || ''),
            mapping_source: String(row.mapping_source || ''),
            mapping_updated_at: String(row.mapping_updated_at || ''),
        };
    }

    function normalizeFinanceMonthClose(row = {}) {
        let classifications = row.classifications;
        if (typeof classifications === 'string') {
            try { classifications = JSON.parse(classifications); } catch (_error) { classifications = {}; }
        }
        return {
            id: String(row.id || ''),
            user_id: String(row.user_id || ''),
            period_key: String(row.period_key || row.periodKey || ''),
            period_start: String(row.period_start || row.periodStart || ''),
            period_end: String(row.period_end || row.periodEnd || ''),
            status: row.status === 'closed' ? 'closed' : 'open',
            classifications: classifications && typeof classifications === 'object' && !Array.isArray(classifications)
                ? { ...classifications }
                : {},
            transaction_count: Math.max(0, Math.trunc(finiteNumber(row.transaction_count ?? row.transactionCount))),
            source_revision: String(row.source_revision || row.sourceRevision || ''),
            reviewed_at: String(row.reviewed_at || row.reviewedAt || ''),
            closed_at: String(row.closed_at || row.closedAt || ''),
            created_at: String(row.created_at || ''),
            updated_at: String(row.updated_at || row.updatedAt || ''),
        };
    }

    function parseJsonValue(value, fallback) {
        if (typeof value !== 'string') return value ?? fallback;
        try { return JSON.parse(value); } catch (_error) { return fallback; }
    }

    function normalizePortfolioMonthlySnapshot(row = {}) {
        const portTotals = parseJsonValue(row.port_totals ?? row.portTotals, []);
        const positions = parseJsonValue(row.positions, []);
        return {
            id: String(row.id || ''),
            user_id: String(row.user_id || ''),
            snapshot_month: String(row.snapshot_month || row.snapshotMonth || ''),
            snapshot_date: String(row.snapshot_date || row.snapshotDate || ''),
            total_valuation_krw: Math.round(finiteNumber(row.total_valuation_krw ?? row.totalValuationKrw)),
            total_stored_amount_krw: Math.round(finiteNumber(row.total_stored_amount_krw ?? row.totalStoredAmountKrw)),
            position_count: Math.max(0, Math.trunc(finiteNumber(row.position_count ?? row.positionCount))),
            price_coverage_pct: finiteNumber(row.price_coverage_pct ?? row.priceCoveragePct),
            fx_coverage_pct: finiteNumber(row.fx_coverage_pct ?? row.fxCoveragePct),
            port_totals: Array.isArray(portTotals) ? portTotals.map((item) => ({ ...item })) : [],
            positions: Array.isArray(positions) ? positions.map((item) => ({ ...item })) : [],
            source_revision: String(row.source_revision || row.sourceRevision || ''),
            created_at: String(row.created_at || ''),
            updated_at: String(row.updated_at || row.updatedAt || ''),
        };
    }

    function fromLegacyRows(table, rows) {
        if (!Array.isArray(rows) || !Array.isArray(rows[0])) return rows;
        const values = rows.slice(1);
        if (table === 'transactions') {
            return values.map((row) => ({
                date: row[0], time: row[1], type: row[2], category: row[3], subcategory: row[4],
                memo: row[5], amount: row[6], currency: row[7], method: row[8], id: row[9],
            }));
        }
        if (table === 'assets') {
            return values.map((row) => ({
                year: row[0], month: row[1], total_asset: row[2], cash: row[3],
                safe: row[4], invest: row[5], debt: row[6],
            }));
        }
        if (table === 'portfolios') {
            return values.map((row) => ({
                group_name: row[0], name: row[1], currency: row[2], maturity: row[3], amount: row[4],
                shares: row[5], id: row[6], asset_type: row[7], instrument_type: row[8], ticker: row[9],
                risk_bucket: row[10], classification_source: row[11], classification_updated_at: row[12],
                strategy_tag: row[13], avg_buy_price: row[14], account_name: row[15], account_order: row[16],
                account_provider: row[17], account_type: row[18], asset_class: row[19], purpose_key: row[20],
                mapping_review_status: row[21], mapping_source: row[22], mapping_updated_at: row[23],
            }));
        }
        return values;
    }

    function normalizeTableRows(table, rows = []) {
        const source = fromLegacyRows(table, Array.isArray(rows) ? rows : []);
        if (table === 'transactions') return source.map(normalizeTransaction).filter((row) => row.date && row.amount !== 0);
        if (table === 'assets') return source.map(normalizeAsset).filter((row) => row.year && row.month);
        if (table === 'portfolios') return source.map(normalizePortfolio).filter((row) => row.name);
        if (table === 'finance_month_closes') return source.map(normalizeFinanceMonthClose).filter((row) => row.period_key);
        if (table === 'portfolio_monthly_snapshots') {
            return source.map(normalizePortfolioMonthlySnapshot).filter((row) => row.snapshot_month);
        }
        return source.map((row) => ({ ...row }));
    }

    function normalizeCache(data = {}) {
        const normalized = {};
        Object.entries(TABLE_SPECS).forEach(([table, spec]) => {
            const rows = data[spec.cacheKey];
            normalized[spec.cacheKey] = Array.isArray(rows) ? normalizeTableRows(table, rows) : null;
        });
        return normalized;
    }

    function getSnapshot(cache = {}, options = {}) {
        const snapshot = { updatedAt: options.updatedAt || '' };
        Object.entries(TABLE_SPECS).forEach(([table, spec]) => {
            snapshot[table] = Array.isArray(cache[spec.cacheKey])
                ? cache[spec.cacheKey].map((row) => ({ ...row }))
                : [];
        });
        return snapshot;
    }

    function toPortfolioDraftItem(row, clientKey) {
        return {
            clientKey,
            id: row.id || '',
            groupName: row.group_name || '미분류',
            name: row.name || '',
            currency: row.currency || 'KRW',
            maturity: row.maturity || '',
            amount: Math.round(finiteNumber(row.amount)),
            shares: nullableNumber(row.shares),
            assetType: row.asset_type || '',
            instrumentType: row.instrument_type || '',
            ticker: row.ticker || '',
            riskBucket: row.risk_bucket || '',
            classificationSource: row.classification_source || '',
            classificationUpdatedAt: row.classification_updated_at || '',
            strategyTag: row.strategy_tag || '',
            avgBuyPrice: nullableNumber(row.avg_buy_price),
            accountName: row.account_name || '',
            accountOrder: nullableNumber(row.account_order),
            accountProvider: row.account_provider || '',
            accountType: row.account_type || '',
            assetClass: row.asset_class || '',
            purposeKey: row.purpose_key || '',
            mappingReviewStatus: row.mapping_review_status || '',
            mappingSource: row.mapping_source || '',
            mappingUpdatedAt: row.mapping_updated_at || '',
        };
    }

    function createPortfolioDraft(rows = []) {
        const normalized = normalizeTableRows('portfolios', rows);
        return {
            originalIds: normalized.map((row) => row.id).filter(Boolean),
            sourceCount: normalized.length,
            nextSequence: normalized.length + 1,
            items: normalized.map((row, index) => toPortfolioDraftItem(row, `row-${index + 1}`)),
        };
    }

    function addPortfolioDraftItem(draft, groupName = '기타') {
        const sequence = Math.max(1, Math.trunc(finiteNumber(draft?.nextSequence, 1)));
        const item = {
            clientKey: `new-${sequence}`,
            id: '',
            groupName: groupName || '기타',
            name: groupName === '부채' ? '새 부채' : (groupName === '연금' ? '새 연금' : (groupName === '안전' ? '새 안전자산' : '새 계좌')),
            currency: 'KRW',
            maturity: '',
            amount: 0,
            shares: null,
            assetType: '',
            instrumentType: '',
            ticker: '',
            riskBucket: '',
            classificationSource: '',
            classificationUpdatedAt: '',
            strategyTag: '',
            avgBuyPrice: null,
            accountName: '',
            accountOrder: null,
            accountProvider: '',
            accountType: '',
            assetClass: '',
            purposeKey: '',
            mappingReviewStatus: '',
            mappingSource: '',
            mappingUpdatedAt: '',
        };
        draft.nextSequence = sequence + 1;
        draft.items.push(item);
        return item;
    }

    function toPortfolioPayload(item = {}) {
        const payload = {
            group_name: String(item.groupName || '미분류'),
            name: String(item.name || ''),
            currency: String(item.currency || 'KRW'),
            maturity: String(item.maturity || ''),
            amount: Math.round(finiteNumber(item.amount)),
            shares: nullableNumber(item.shares),
            asset_type: String(item.assetType || ''),
            instrument_type: String(item.instrumentType || ''),
            ticker: String(item.ticker || '').trim().toUpperCase() || null,
            risk_bucket: String(item.riskBucket || ''),
            classification_source: String(item.classificationSource || 'rule'),
            classification_updated_at: String(item.classificationUpdatedAt || new Date().toISOString()),
            strategy_tag: String(item.strategyTag || 'other'),
            avg_buy_price: nullableNumber(item.avgBuyPrice),
            account_name: String(item.accountName || '').trim() || null,
            account_provider: String(item.accountProvider || '').trim() || null,
            account_type: String(item.accountType || '').trim() || null,
            asset_class: String(item.assetClass || '').trim() || null,
            purpose_key: String(item.purposeKey || '').trim() || null,
            mapping_review_status: String(item.mappingReviewStatus || '').trim() || null,
            mapping_source: String(item.mappingSource || '').trim() || null,
            mapping_updated_at: String(item.mappingUpdatedAt || '').trim() || null,
        };
        const accountOrder = nullableNumber(item.accountOrder);
        if (accountOrder !== null) payload.account_order = accountOrder;
        if (item.id) payload.id = item.id;
        return payload;
    }

    function buildPortfolioMutation(draft = {}) {
        const items = Array.isArray(draft.items) ? draft.items : [];
        const originalIds = Array.isArray(draft.originalIds) ? draft.originalIds.filter(Boolean) : [];
        if (Number(draft.sourceCount || 0) > 0 && originalIds.length === 0) {
            throw new Error('포트폴리오 row id가 없어 안전 저장을 진행할 수 없습니다. 먼저 최신 동기화를 실행해주세요.');
        }
        const payloads = items.map(toPortfolioPayload).filter((item) => item.name);
        const currentIds = payloads.map((item) => item.id).filter(Boolean);
        return {
            upserts: payloads.filter((item) => item.id),
            inserts: payloads.filter((item) => !item.id),
            removedIds: originalIds.filter((id) => !currentIds.includes(id)),
        };
    }

    function mergeTransactionRows(currentRows = [], insertedRows = []) {
        return [...normalizeTableRows('transactions', currentRows), ...normalizeTableRows('transactions', insertedRows)]
            .sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));
    }

    function toFinanceMonthClosePayload(record = {}) {
        return {
            period_key: String(record.periodKey || record.period_key || ''),
            period_start: String(record.periodStart || record.period_start || ''),
            period_end: String(record.periodEnd || record.period_end || ''),
            status: record.status === 'closed' ? 'closed' : 'open',
            classifications: record.classifications && typeof record.classifications === 'object'
                ? record.classifications
                : {},
            transaction_count: Math.max(0, Math.trunc(finiteNumber(record.transactionCount ?? record.transaction_count))),
            source_revision: String(record.sourceRevision || record.source_revision || ''),
            reviewed_at: record.reviewedAt || record.reviewed_at || null,
            closed_at: record.closedAt || record.closed_at || null,
        };
    }

    function mergeFinanceMonthCloseRows(currentRows = [], incomingRows = []) {
        const merged = new Map();
        [...normalizeTableRows('finance_month_closes', currentRows), ...normalizeTableRows('finance_month_closes', incomingRows)]
            .forEach((row) => {
                const current = merged.get(row.period_key);
                if (!current || String(row.updated_at || '') >= String(current.updated_at || '')) merged.set(row.period_key, row);
            });
        return Array.from(merged.values()).sort((a, b) => a.period_key.localeCompare(b.period_key));
    }

    function toPortfolioMonthlySnapshotPayload(record = {}) {
        return {
            snapshot_month: String(record.snapshotMonth || record.snapshot_month || ''),
            snapshot_date: String(record.snapshotDate || record.snapshot_date || ''),
            total_valuation_krw: Math.round(finiteNumber(record.totalValuationKrw ?? record.total_valuation_krw)),
            total_stored_amount_krw: Math.round(finiteNumber(record.totalStoredAmountKrw ?? record.total_stored_amount_krw)),
            position_count: Math.max(0, Math.trunc(finiteNumber(record.positionCount ?? record.position_count))),
            price_coverage_pct: finiteNumber(record.priceCoveragePct ?? record.price_coverage_pct),
            fx_coverage_pct: finiteNumber(record.fxCoveragePct ?? record.fx_coverage_pct),
            port_totals: Array.isArray(record.portTotals || record.port_totals)
                ? (record.portTotals || record.port_totals)
                : [],
            positions: Array.isArray(record.positions) ? record.positions : [],
            source_revision: String(record.sourceRevision || record.source_revision || ''),
        };
    }

    function mergePortfolioMonthlySnapshotRows(currentRows = [], incomingRows = []) {
        const merged = new Map();
        [
            ...normalizeTableRows('portfolio_monthly_snapshots', currentRows),
            ...normalizeTableRows('portfolio_monthly_snapshots', incomingRows),
        ].forEach((row) => {
            const current = merged.get(row.snapshot_month);
            if (!current || String(row.updated_at || '') >= String(current.updated_at || '')) {
                merged.set(row.snapshot_month, row);
            }
        });
        return Array.from(merged.values()).sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month));
    }

    function buildAccountingPeriods(rows = [], resolvePeriod) {
        if (typeof resolvePeriod !== 'function') return [];
        const periods = new Map();
        normalizeTableRows('transactions', rows).forEach((row) => {
            const period = resolvePeriod(row.date);
            if (!period?.monthKey || !period.periodStart || !period.periodEnd) return;
            const current = periods.get(period.monthKey) || {
                key: period.monthKey,
                label: period.title || period.monthKey,
                startDate: period.periodStart,
                endDate: period.periodEnd,
                transactions: [],
            };
            current.transactions.push({
                id: row.id,
                date: row.date,
                time: row.time,
                type: row.type,
                category: row.category,
                subcategory: row.subcategory,
                memo: row.memo,
                amount: row.amount,
                method: row.method,
            });
            periods.set(period.monthKey, current);
        });
        return Array.from(periods.values()).sort((a, b) => a.key.localeCompare(b.key));
    }

    function createSupabaseFinanceRepository(options = {}) {
        if (typeof options.getClient !== 'function') throw new Error('FinanceRepository requires getClient().');
        async function fetchTables(tables = DEFAULT_DATA_TABLES) {
            const client = options.getClient();
            const responses = await Promise.all(tables.map(async (table) => {
                const spec = TABLE_SPECS[table];
                if (!spec) throw new Error(`UNKNOWN_TABLE: ${table}`);
                const pageSize = Math.max(0, Number(spec.pageSize || 0));
                const rows = [];
                let pageIndex = 0;
                while (true) {
                    let query = client.from(table).select(spec.columns.join(','));
                    (spec.order || []).forEach(([column, ascending]) => {
                        query = query.order(column, { ascending });
                    });
                    if (pageSize > 0) {
                        const from = pageIndex * pageSize;
                        query = query.range(from, from + pageSize - 1);
                    }
                    const response = await query;
                    if (response.error) return { table, spec, response };
                    const pageRows = response.data || [];
                    rows.push(...pageRows);
                    if (pageSize === 0 || pageRows.length < pageSize) break;
                    pageIndex += 1;
                }
                return { table, spec, response: { data: rows, error: null } };
            }));
            const patch = {};
            responses.forEach(({ table, spec, response }) => {
                if (response.error) {
                    if (!spec.optional) throw response.error;
                    options.onOptionalError?.(table, response.error);
                    return;
                }
                patch[spec.cacheKey] = normalizeTableRows(table, response.data || []);
            });
            return patch;
        }
        async function savePortfolioDraft(draft) {
            const client = options.getClient();
            const mutation = buildPortfolioMutation(draft);
            if (mutation.upserts.length > 0) {
                const { error } = await client.from('portfolios').upsert(mutation.upserts, { onConflict: 'id' });
                if (error) throw error;
            }
            if (mutation.inserts.length > 0) {
                const { error } = await client.from('portfolios').insert(mutation.inserts);
                if (error) throw error;
            }
            if (mutation.removedIds.length > 0) {
                const { error } = await client.from('portfolios').delete().in('id', mutation.removedIds);
                if (error) throw error;
            }
            return mutation;
        }
        async function saveFinanceMonthClose(record) {
            const client = options.getClient();
            const payload = toFinanceMonthClosePayload(record);
            if (!payload.period_key || !payload.period_start || !payload.period_end) {
                throw new Error('INVALID_FINANCE_MONTH_CLOSE');
            }
            const columns = TABLE_SPECS.finance_month_closes.columns.join(',');
            const { data, error } = await client
                .from('finance_month_closes')
                .upsert(payload, { onConflict: 'user_id,period_key', defaultToNull: false })
                .select(columns)
                .single();
            if (error) throw error;
            return normalizeFinanceMonthClose(data || payload);
        }
        async function savePortfolioMonthlySnapshot(record) {
            const client = options.getClient();
            const payload = toPortfolioMonthlySnapshotPayload(record);
            if (!/^\d{4}-\d{2}$/.test(payload.snapshot_month) || !payload.snapshot_date) {
                throw new Error('INVALID_PORTFOLIO_MONTHLY_SNAPSHOT');
            }
            const columns = TABLE_SPECS.portfolio_monthly_snapshots.columns.join(',');
            const { data, error } = await client
                .from('portfolio_monthly_snapshots')
                .upsert(payload, { onConflict: 'user_id,snapshot_month', defaultToNull: false })
                .select(columns)
                .single();
            if (error) throw error;
            return normalizePortfolioMonthlySnapshot(data || payload);
        }
        return Object.freeze({
            fetchTables,
            saveFinanceMonthClose,
            savePortfolioDraft,
            savePortfolioMonthlySnapshot,
        });
    }

    root.FinanceRepository = Object.freeze({
        ALL_DATA_TABLES,
        DEFAULT_DATA_TABLES,
        REAL_ESTATE_DETAIL_TABLES,
        TABLE_SPECS,
        addPortfolioDraftItem,
        buildAccountingPeriods,
        buildPortfolioMutation,
        createPortfolioDraft,
        createSupabaseFinanceRepository,
        getSnapshot,
        mergeFinanceMonthCloseRows,
        mergePortfolioMonthlySnapshotRows,
        mergeTransactionRows,
        normalizeCache,
        normalizeTableRows,
        toFinanceMonthClosePayload,
        toPortfolioMonthlySnapshotPayload,
        toPortfolioPayload,
    });
})(typeof window !== 'undefined' ? window : globalThis);
