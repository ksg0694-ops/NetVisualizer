// App state, settings, data loading, parsing, chart helpers, and transaction modal logic extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    function showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const iconColor = type === 'error' ? 'text-red-400' : (type === 'warning' ? 'text-amber-400' : 'text-indigo-400');
        const icon = type === 'error' ? 'fa-exclamation-circle' : (type === 'warning' ? 'fa-bolt' : 'fa-check-circle');

        toast.className = 'bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 toast-enter pointer-events-auto break-keep';
        toast.innerHTML = `<i class="fas ${icon} ${iconColor} shrink-0"></i> <span>${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100%)';
            toast.style.transition = 'all 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ==========================================
    // 설정 및 캐싱 (Local Storage) 관리
    // ==========================================
    let userUrls = {
        webapp: 'https://djwqcewsochlesjcouoi.supabase.co',
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd3FjZXdzb2NobGVzamNvdW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMDQwMjYsImV4cCI6MjA5NTc4MDAyNn0.BaKElHEW0x0q82I38kSkpd4nQbGAJVnT-LNYwLlHZMk'
    };
    const DEFAULT_WEBAPP_URL = userUrls.webapp;
    const GOOGLE_SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1pFBp0zYmr1AFykD-a6k44HQicnmS4JtSFIpd_E4gkBU/edit?usp=drive_link';
    const CACHE_KEY = 'smartbook_v2_data_cache_v4';
    const IMPORT_AUDIT_KEY = 'smartbook_v2_tx_import_runs';

    function loadSettings() {
        // 설정 로드 로직 제거됨 (URL 하드코딩 사용)
    }

    function saveSettings() {
        // 설정 저장 로직 제거됨
    }

    function closeSettings() { document.getElementById('settings-modal').classList.add('hidden'); }
    // 원본 버튼 제거됨

    // ==========================================
    // 전역 상태 변수 및 모의(Demo) 데이터
    // ==========================================
    let monthlyDB = {};
    let currentMonthKey = '';
    let cashFlowMonthKey = '';
    let currentAssetFilter = 'all';
    let txSortOrder = 'asc';
    const myCharts = {};
    let dataCache = { tx: null, asset: null, portfolio: null, cards: null, insurances: null, quantRules: null, marketPrices: null, realEstateSubscriptions: null, realEstateHousingTypes: null, realEstateCompetition: null, realEstatePriceRefs: null };
    let sortedMonthKeys = [];
    let activeViewId = 'dashboard-view';
    let activeInvestGroupName = '';
    let activeInvestProcessedItems = [];
    let activeInvestTotal = 0;
    let marketPriceMap = {};

    let dynamicAssetHistory = { labels: [], data: [] };
    let dynamicAssetSnapshots = {};
    let dynamicPortfolioData = null;
    let rawPortfolioData = [];
    let workingPortfolioData = []; // 💡 [신규] 포트폴리오 편집 모달용 상태 (항목 추가/삭제/수정용)
    let originalNetWorthForDiff = 0; // 💡 [신규] 변경된 차액을 계산하기 위한 기준값
    let addonCards = [];
    let addonInsurances = [];
    let txImportCandidates = [];
    let txImportStats = { total: 0, ready: 0, duplicate: 0, invalid: 0 };
    let txImportRawRows = null;
    let txImportSourceMeta = null;
    let txImportAuditRuns = [];

    const SUPABASE_COLUMNS = {
        transactions: 'date,time,type,category,subcategory,memo,amount,currency,method',
        assets: 'year,month,total_asset,cash,safe,invest,debt',
        portfolios: '*',
        cards: '*',
        insurances: '*',
        quantStrategyRules: 'strategy_tag,target_pct,band_pct,trigger_label,is_active,display_order,updated_at',
        marketPrices: 'ticker,price,currency,price_date,source,note,updated_at',
        realEstateSubscriptions: '*',
        realEstateHousingTypes: '*',
        realEstateCompetition: '*',
        realEstatePriceRefs: '*'
    };

    const ALL_DATA_TABLES = ['transactions', 'assets', 'portfolios', 'cards', 'insurances', 'quant_strategy_rules', 'portfolio_market_prices', 'real_estate_subscription_sites', 'real_estate_housing_types', 'real_estate_competition', 'real_estate_price_refs'];

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/`/g, '&#96;');
    }

    function escapeJsString(value) {
        return String(value ?? '')
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }

    const ASSET_CLASS_META = {
        account: {
            label: '계좌/현금성', shortLabel: '계좌', icon: 'fa-wallet',
            badgeClass: 'bg-blue-50 text-blue-600 border-blue-100', color: '#3B82F6', riskBucket: 'safe'
        },
        pension: {
            label: '연금', shortLabel: '연금', icon: 'fa-piggy-bank',
            badgeClass: 'bg-pink-50 text-pink-600 border-pink-100', color: '#EC4899', riskBucket: 'tied'
        },
        stock: {
            label: '주식', shortLabel: '주식', icon: 'fa-chart-line',
            badgeClass: 'bg-violet-50 text-violet-600 border-violet-100', color: '#8B5CF6', riskBucket: 'market'
        },
        etf: {
            label: 'ETF', shortLabel: 'ETF', icon: 'fa-layer-group',
            badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-100', color: '#10B981', riskBucket: 'market'
        },
        real_estate: {
            label: '부동산/청약', shortLabel: '청약', icon: 'fa-home',
            badgeClass: 'bg-amber-50 text-amber-600 border-amber-100', color: '#F59E0B', riskBucket: 'tied'
        },
        debt: {
            label: '부채', shortLabel: '부채', icon: 'fa-credit-card',
            badgeClass: 'bg-red-50 text-red-600 border-red-100', color: '#EF4444', riskBucket: 'debt'
        },
        other: {
            label: '기타', shortLabel: '기타', icon: 'fa-coins',
            badgeClass: 'bg-gray-50 text-gray-600 border-gray-100', color: '#9CA3AF', riskBucket: 'other'
        }
    };

    const INVEST_STRATEGY_META = {
        dividend: { label: '배당주', shortLabel: '배당', color: '#f59e0b' },
        index: { label: '지수추종', shortLabel: '지수', color: '#10b981' },
        growth: { label: '성장/개별주', shortLabel: '성장', color: '#3b82f6' },
        cash: { label: '현금대기', shortLabel: '현금', color: '#06b6d4' },
        pension: { label: '연금장기', shortLabel: '연금', color: '#ec4899' },
        other: { label: '기타전략', shortLabel: '기타', color: '#9ca3af' }
    };
    const INVEST_STRATEGY_KEYS = ['dividend', 'index', 'growth', 'cash', 'pension', 'other'];
    const DEFAULT_QUANT_STRATEGY_RULES = {
        dividend: { targetPct: 25, bandPct: 5, trigger: '배당률' },
        index: { targetPct: 45, bandPct: 7, trigger: '추세' },
        growth: { targetPct: 20, bandPct: 6, trigger: '모멘텀' },
        cash: { targetPct: 10, bandPct: 4, trigger: 'MDD 방어' },
        pension: { targetPct: 0, bandPct: 0, trigger: '장기보유' },
        other: { targetPct: 0, bandPct: 0, trigger: '수동검토' }
    };
    let quantStrategyRules = Object.fromEntries(
        Object.entries(DEFAULT_QUANT_STRATEGY_RULES).map(([key, rule]) => [key, { ...rule }])
    );
    const PORTFOLIO_GROUP_ORDER = [
        { label: '현금', match: ['현금', '입출금', '통장', '계좌', '예수금'] },
        { label: '안전', match: ['안전', '예금', '적금', 'cma', '파킹', 'rp', '발행어음', '채권'] },
        { label: '투자', match: ['투자', '주식', 'etf', '증권', '펀드'] },
        { label: '연금', match: ['연금', '퇴직', 'irp'] },
        { label: '부채', match: ['부채', '대출', '마이너스'] },
        { label: '기타', match: ['기타', '미분류'] }
    ];

    function getAssetClassMeta(assetType) {
        return ASSET_CLASS_META[assetType] || ASSET_CLASS_META.other;
    }

    function getStrategyMeta(strategyTag) {
        return INVEST_STRATEGY_META[strategyTag] || INVEST_STRATEGY_META.other;
    }

    function includesAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    function getPortfolioGroupRank(groupName) {
        const normalized = String(groupName || '').toLowerCase();
        const idx = PORTFOLIO_GROUP_ORDER.findIndex(group => group.match.some(keyword => normalized.includes(keyword.toLowerCase())));
        return idx === -1 ? PORTFOLIO_GROUP_ORDER.length - 1 : idx;
    }

    function getSortedPortfolioGroups(groups) {
        return Object.entries(groups || {}).sort(([aName], [bName]) => {
            const rankDiff = getPortfolioGroupRank(aName) - getPortfolioGroupRank(bName);
            return rankDiff !== 0 ? rankDiff : aName.localeCompare(bName, 'ko-KR');
        });
    }

    function getDbGroupClassification(groupName, item = {}) {
        const normalized = String(groupName || '').toLowerCase();
        const currency = String(item.currency || 'KRW').toUpperCase();
        if (includesAny(normalized, ['부채', '대출', '마이너스'])) return { assetType: 'debt', instrumentType: 'loan', reason: 'DB 그룹 분류: 부채' };
        if (includesAny(normalized, ['연금', '퇴직', 'irp'])) return { assetType: 'pension', instrumentType: 'pension', reason: 'DB 그룹 분류: 연금' };
        if (includesAny(normalized, ['현금', '입출금', '통장', '계좌', '예수금'])) return { assetType: 'account', instrumentType: 'cash_account', reason: 'DB 그룹 분류: 현금' };
        if (includesAny(normalized, ['안전', '예금', '적금', 'cma', '파킹', 'rp', '발행어음', '채권'])) return { assetType: 'account', instrumentType: 'safe_account', reason: 'DB 그룹 분류: 안전자산' };
        if (includesAny(normalized, ['기타', '미분류'])) return { assetType: 'other', instrumentType: 'other', reason: 'DB 그룹 분류: 기타' };
        if (includesAny(normalized, ['투자', '증권', '주식', 'etf', '펀드'])) {
            const text = `${groupName} ${item.name || ''}`.toLowerCase();
            if (includesAny(text, ['etf', 'voo', 'qqq', 'schd', 'spy', 's&p', 'kodex', 'tiger', 'ace ', 'sol ', 'arirang'])) {
                return { assetType: 'etf', instrumentType: currency === 'USD' ? 'us_etf' : 'domestic_etf', reason: 'DB 그룹 분류: 투자/ETF' };
            }
            return { assetType: 'stock', instrumentType: currency === 'USD' ? 'us_stock' : 'domestic_stock', reason: 'DB 그룹 분류: 투자' };
        }
        return null;
    }

    function inferStrategyTag(item = {}) {
        const explicit = String(item.strategyTag || item.strategy_tag || '').trim();
        if (INVEST_STRATEGY_META[explicit]) return explicit;

        const name = String(item.name || '').toLowerCase();
        const ticker = String(item.ticker || item.tickerSymbol || '').toLowerCase();
        const searchableText = `${name} ${ticker}`;
        const assetType = item.classification?.assetType || item.assetType || item.asset_type || '';

        if (assetType === 'account') return 'cash';
        if (assetType === 'pension') return 'pension';
        if (assetType === 'etf') return 'index';
        if (includesAny(searchableText, ['배당', 'dividend', 'schd', '리츠', '맥쿼리'])) return 'dividend';
        if (includesAny(searchableText, ['지수', 'index', 's&p', 'sp500', 'voo', 'qqq', 'spy', 'kodex', 'tiger', 'arirang'])) return 'index';
        if (assetType === 'stock') return 'growth';
        return 'other';
    }

    function classifyPortfolioItem(groupName, item = {}) {
        const group = String(groupName || '').trim();
        const name = String(item.name || '').trim();
        const currency = String(item.currency || 'KRW').toUpperCase();
        const maturity = String(item.maturity || '').trim();
        const shares = Number(item.shares || 0);
        const amountValue = Math.round(parseFloat(String(item.amount || '0').replace(/[^0-9.-]/g, ''))) || 0;
        const text = `${group} ${name} ${currency} ${maturity}`.toLowerCase();
        const isDebt = group.includes('부채') || group.includes('대출') || amountValue < 0;
        const dbGroupClassification = getDbGroupClassification(group, item);
        const dbAssetType = String(item.assetType || item.asset_type || '').trim();
        const dbInstrumentType = String(item.instrumentType || item.instrument_type || '').trim();
        const dbRiskBucket = String(item.riskBucket || item.risk_bucket || '').trim();
        const dbSource = String(item.classificationSource || item.classification_source || '').trim();

        let assetType = 'other';
        let instrumentType = 'other';
        let confidence = 'medium';
        let reason = '기본 규칙';

        if (dbAssetType && ASSET_CLASS_META[dbAssetType]) {
            assetType = dbAssetType;
            instrumentType = dbInstrumentType || dbAssetType;
            confidence = dbSource || 'db';
            reason = `DB 컬럼 분류 (${getAssetClassMeta(dbAssetType).label})`;
        } else if (dbGroupClassification) {
            assetType = dbGroupClassification.assetType;
            instrumentType = dbGroupClassification.instrumentType;
            confidence = 'db';
            reason = dbGroupClassification.reason;
        } else if (isDebt) {
            assetType = 'debt'; instrumentType = 'loan'; confidence = 'high'; reason = '부채/대출 그룹 또는 음수 금액';
        } else if (includesAny(text, ['청약', '부동산', '보증금', '전세', '임대차'])) {
            assetType = 'real_estate'; instrumentType = 'housing_ready'; confidence = 'high'; reason = '부동산/청약 키워드';
        } else if (includesAny(text, ['etf', 'voo', 'qqq', 'schd', 'spy', 's&p', 'kodex', 'tiger', 'ace ', 'sol ', 'arirang'])) {
            assetType = 'etf'; instrumentType = currency === 'USD' ? 'us_etf' : 'domestic_etf'; confidence = 'high'; reason = 'ETF 또는 대표 ETF 티커/운용사 키워드';
        } else if (shares > 0 || /\b[0-9]{6}\b/.test(text) || includesAny(text, ['주식', '종목', '삼성전자', '현대차', '엔비디아', 'nvidia', 'apple', 'tesla'])) {
            assetType = 'stock'; instrumentType = currency === 'USD' ? 'us_stock' : 'domestic_stock'; confidence = shares > 0 ? 'high' : 'medium'; reason = shares > 0 ? '보유 수량 존재' : '주식 키워드';
        } else if (includesAny(text, ['계좌', '통장', '예금', '적금', 'cma', '파킹', '현금', '예수금', '입출금', '달러', '외화', 'rp', '발행어음'])) {
            assetType = 'account'; instrumentType = includesAny(text, ['예금', '적금']) ? 'deposit' : 'cash_account'; confidence = 'high'; reason = '계좌/현금성 키워드';
        } else if (group.includes('투자')) {
            assetType = 'stock'; instrumentType = currency === 'USD' ? 'us_stock' : 'domestic_stock'; confidence = 'low'; reason = '투자 그룹 fallback';
        }

        const meta = getAssetClassMeta(assetType);
        return { assetType, instrumentType, riskBucket: dbRiskBucket || meta.riskBucket, confidence, reason, label: meta.label, shortLabel: meta.shortLabel, source: confidence === 'db' || confidence === 'manual' || confidence === 'import' ? confidence : 'rule' };
    }

    function getAssetClassBadgeHtml(classification) {
        const meta = getAssetClassMeta(classification?.assetType);
        return `<span title="${escapeAttr(classification?.reason || meta.label)}" class="text-[10px] ${meta.badgeClass} border px-1.5 py-0.5 rounded font-bold whitespace-nowrap"><i class="fas ${meta.icon} text-[9px] mr-1"></i>${meta.shortLabel}</span>`;
    }

    function getMonthKeys() {
        return sortedMonthKeys;
    }

    function getLatestMonthKey() {
        const keys = getMonthKeys();
        return keys.length > 0 ? keys[keys.length - 1] : '';
    }

    function useMonthScopeForView(targetId) {
        const latestMonthKey = getLatestMonthKey();
        if (!latestMonthKey) return;

        if (targetId === 'stats-view') {
            cashFlowMonthKey = cashFlowMonthKey || currentMonthKey || latestMonthKey;
            currentMonthKey = cashFlowMonthKey;
            return;
        }

        currentMonthKey = latestMonthKey;
    }

    function getSupabaseClient() {
        if (!userUrls.webapp || !userUrls.supabaseKey) throw new Error('URL_MISSING');
        return supabase.createClient(userUrls.webapp, userUrls.supabaseKey);
    }

    function formatTransactionRows(rows = []) {
        const txFormat = [["날짜","시간","타입","대분류","소분류","내용","금액","화폐","결제수단","메모"]];
        rows.forEach(r => txFormat.push([r.date, r.time || '', r.type, r.category, r.subcategory, r.memo, String(r.amount), r.currency, r.method, '']));
        return txFormat;
    }

    function formatAssetRows(rows = []) {
        const assetFormat = [["Year","Month","총자산(순자산)","현금성자산","안전자산","투자자산","부채"]];
        rows.forEach(r => assetFormat.push([String(r.year), `${String(r.month).padStart(2,'0')}월`, String(r.total_asset), String(r.cash), String(r.safe), String(r.invest), String(r.debt)]));
        return assetFormat;
    }

    function formatPortfolioRows(rows = []) {
        const pfFormat = [["대분류 (Drop-down)","계좌/자산명 (Text)","통화/형태 (Text)","만기일 (Date/Text)","금액 (Number)", "주식수", "id", "asset_type", "instrument_type", "ticker", "risk_bucket", "classification_source", "classification_updated_at", "strategy_tag", "avg_buy_price"]];
        rows.forEach(r => pfFormat.push([
            r.group_name,
            r.name,
            r.currency,
            r.maturity || '',
            String(r.amount),
            r.shares ? String(r.shares) : '',
            r.id || '',
            r.asset_type || '',
            r.instrument_type || '',
            r.ticker || '',
            r.risk_bucket || '',
            r.classification_source || '',
            r.classification_updated_at || '',
            r.strategy_tag || '',
            r.avg_buy_price ?? ''
        ]));
        return pfFormat;
    }

    function parseQuantStrategyRules(rows = []) {
        const nextRules = Object.fromEntries(
            Object.entries(DEFAULT_QUANT_STRATEGY_RULES).map(([key, rule]) => [key, { ...rule }])
        );

        if (Array.isArray(rows)) {
            rows.forEach(row => {
                const key = String(row.strategy_tag || '').trim();
                if (!INVEST_STRATEGY_META[key]) return;
                nextRules[key] = {
                    targetPct: Number(row.target_pct ?? nextRules[key].targetPct) || 0,
                    bandPct: Number(row.band_pct ?? nextRules[key].bandPct) || 0,
                    trigger: String(row.trigger_label || nextRules[key].trigger || ''),
                    isActive: row.is_active !== false,
                    displayOrder: Number(row.display_order ?? 0) || 0,
                    updatedAt: row.updated_at || ''
                };
            });
        }

        quantStrategyRules = nextRules;
    }

    function parseMarketPrices(rows = []) {
        marketPriceMap = {};
        if (!Array.isArray(rows)) return;

        rows.forEach(row => {
            const ticker = String(row.ticker || '').trim().toUpperCase();
            const price = Number(row.price);
            if (!ticker || !Number.isFinite(price)) return;
            marketPriceMap[ticker] = {
                ticker,
                price,
                currency: String(row.currency || 'KRW').toUpperCase(),
                priceDate: row.price_date || '',
                source: row.source || 'manual',
                note: row.note || '',
                updatedAt: row.updated_at || ''
            };
        });
    }

    function getMarketPriceForTicker(ticker) {
        const key = String(ticker || '').trim().toUpperCase();
        return key ? marketPriceMap[key] || null : null;
    }

    function formatUnitPrice(value, currency = '') {
        const number = Number(value);
        if (!Number.isFinite(number)) return '미입력';
        const maxDigits = String(currency).toUpperCase() === 'KRW' ? 0 : 4;
        const formatted = number.toLocaleString(undefined, { maximumFractionDigits: maxDigits });
        return `${formatted}${currency ? ` ${escapeHtml(currency)}` : ''}`.trim();
    }

    function formatSignedUnitPrice(value, currency = '') {
        const number = Number(value);
        if (!Number.isFinite(number)) return '미입력';
        return `${number > 0 ? '+' : ''}${formatUnitPrice(number, currency)}`;
    }

    function formatWon(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '미입력';
        return `${Math.round(number).toLocaleString()}원`;
    }

    function formatSignedWon(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) return '미입력';
        return `${number > 0 ? '+' : ''}${formatWon(number)}`;
    }

    function setProgressBar(id, percentage) {
        const bar = document.getElementById(id);
        if (!bar) return;
        const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
        bar.style.width = '0%';
        setTimeout(() => { bar.style.width = `${safePercentage}%`; }, 100);
    }

    function getOrderedStrategyKeys(sourceMap = {}) {
        const sourceKeys = Object.keys(sourceMap);
        return [
            ...INVEST_STRATEGY_KEYS.filter(key => sourceKeys.includes(key) && sourceMap[key]),
            ...sourceKeys.filter(key => !INVEST_STRATEGY_META[key])
        ];
    }

    function normalizeCache(data = {}) {
        return {
            tx: data.tx || null,
            asset: data.asset || null,
            portfolio: data.portfolio || null,
            cards: data.cards || null,
            insurances: data.insurances || null,
            quantRules: data.quantRules || null,
            marketPrices: data.marketPrices || null,
            realEstateSubscriptions: data.realEstateSubscriptions || null,
            realEstateHousingTypes: data.realEstateHousingTypes || null,
            realEstateCompetition: data.realEstateCompetition || null,
            realEstatePriceRefs: data.realEstatePriceRefs || null
        };
    }

    function persistDataCache() {
        localStorage.setItem(CACHE_KEY, JSON.stringify(dataCache));
    }

    function applyCachedData() {
        if (dataCache.tx) parseTxData(dataCache.tx);
        if (dataCache.asset) parseAssetData(dataCache.asset);
        if (dataCache.portfolio) parsePortfolioData(dataCache.portfolio);
        if (dataCache.cards) addonCards = dataCache.cards;
        if (dataCache.insurances) addonInsurances = dataCache.insurances;
        parseQuantStrategyRules(dataCache.quantRules);
        parseMarketPrices(dataCache.marketPrices);
    }

    function renderSections({ dashboard = false, financeSummary = false, cashFlow = false, portfolio = false, addons = false, realEstate = false, investDetail = false } = {}) {
        updateNavigationButtons();
        if (dashboard || financeSummary) {
            renderFinanceSummary();
        }
        if (dashboard || cashFlow) {
            renderCashFlow();
        }
        if (portfolio) renderPortfolio();
        if (addons && typeof renderAddons === 'function') renderAddons();
        if (realEstate && typeof renderRealEstate === 'function') renderRealEstate();
        if (investDetail && activeInvestGroupName) renderInvestDetail(activeInvestGroupName);
    }

    function getRenderTargetsForTables(tables) {
        const tableSet = new Set(tables);
        return {
            dashboard: tableSet.has('transactions') || tableSet.has('assets'),
            portfolio: tableSet.has('transactions') || tableSet.has('assets') || tableSet.has('portfolios'),
            addons: tableSet.has('cards') || tableSet.has('insurances'),
            realEstate: activeViewId === 'realestate-view' && (
                tableSet.has('portfolios') ||
                tableSet.has('real_estate_subscription_sites') ||
                tableSet.has('real_estate_housing_types') ||
                tableSet.has('real_estate_competition') ||
                tableSet.has('real_estate_price_refs')
            ),
            investDetail: activeViewId === 'invest-detail-view' && (tableSet.has('portfolios') || tableSet.has('quant_strategy_rules') || tableSet.has('portfolio_market_prices'))
        };
    }

    function destroyChart(chartKey) {
        if (myCharts[chartKey]) {
            myCharts[chartKey].destroy();
            delete myCharts[chartKey];
        }
    }

    function withChartTransitions(options = {}, duration = 450) {
        return {
            ...options,
            animation: {
                duration,
                easing: 'easeOutCubic',
                ...(options.animation || {})
            },
            transitions: {
                active: {
                    animation: {
                        duration,
                        easing: 'easeOutCubic'
                    }
                },
                resize: {
                    animation: {
                        duration: 0
                    }
                },
                ...(options.transitions || {})
            }
        };
    }

    function renderOrUpdateChart(chartKey, canvasId, config, updateMode = 'active') {
        const el = document.getElementById(canvasId);
        if (!el) {
            destroyChart(chartKey);
            return null;
        }

        const hasData = config?.data?.datasets?.some(ds => Array.isArray(ds.data) && ds.data.some(v => v !== null && v !== undefined));
        if (!hasData) {
            destroyChart(chartKey);
            return null;
        }

        if (!myCharts[chartKey] || myCharts[chartKey].config.type !== config.type) {
            destroyChart(chartKey);
            myCharts[chartKey] = new Chart(el, config);
            return myCharts[chartKey];
        }

        myCharts[chartKey].data.labels = config.data.labels;
        myCharts[chartKey].data.datasets = config.data.datasets;
        myCharts[chartKey].options = config.options;
        myCharts[chartKey].update(updateMode);
        return myCharts[chartKey];
    }

    async function fetchRemoteTables(tables = ALL_DATA_TABLES) {
        const _supabase = getSupabaseClient();
        const queries = tables.map(table => {
            if (table === 'transactions') return _supabase.from('transactions').select(SUPABASE_COLUMNS.transactions).order('date', { ascending: true });
            if (table === 'assets') return _supabase.from('assets').select(SUPABASE_COLUMNS.assets).order('year', { ascending: true }).order('month', { ascending: true });
            if (table === 'portfolios') return _supabase.from('portfolios').select(SUPABASE_COLUMNS.portfolios);
            if (table === 'cards') return _supabase.from('cards').select(SUPABASE_COLUMNS.cards);
            if (table === 'insurances') return _supabase.from('insurances').select(SUPABASE_COLUMNS.insurances);
            if (table === 'quant_strategy_rules') return _supabase.from('quant_strategy_rules').select(SUPABASE_COLUMNS.quantStrategyRules).order('display_order', { ascending: true });
            if (table === 'portfolio_market_prices') return _supabase.from('portfolio_market_prices').select(SUPABASE_COLUMNS.marketPrices).order('ticker', { ascending: true });
            if (table === 'real_estate_subscription_sites') return _supabase.from('real_estate_subscription_sites').select(SUPABASE_COLUMNS.realEstateSubscriptions).order('priority_order', { ascending: true }).order('block', { ascending: true });
            if (table === 'real_estate_housing_types') return _supabase.from('real_estate_housing_types').select(SUPABASE_COLUMNS.realEstateHousingTypes);
            if (table === 'real_estate_competition') return _supabase.from('real_estate_competition').select(SUPABASE_COLUMNS.realEstateCompetition);
            if (table === 'real_estate_price_refs') return _supabase.from('real_estate_price_refs').select(SUPABASE_COLUMNS.realEstatePriceRefs).order('deal_date', { ascending: false });
            throw new Error(`UNKNOWN_TABLE: ${table}`);
        });

        const responses = await Promise.all(queries);
        const patch = {};

        responses.forEach((res, index) => {
            const table = tables[index];
            if (res.error) {
                if (table === 'cards' || table === 'insurances' || table === 'quant_strategy_rules' || table === 'portfolio_market_prices' || table.startsWith('real_estate_')) {
                    console.warn(`${table} 로딩 실패:`, res.error.message);
                } else {
                    throw res.error;
                }
            }

            if (table === 'transactions') patch.tx = formatTransactionRows(res.data || []);
            if (table === 'assets') patch.asset = formatAssetRows(res.data || []);
            if (table === 'portfolios') patch.portfolio = formatPortfolioRows(res.data || []);
            if (table === 'cards') patch.cards = res.data || [];
            if (table === 'insurances') patch.insurances = res.data || [];
            if (table === 'quant_strategy_rules') patch.quantRules = res.data || [];
            if (table === 'portfolio_market_prices') patch.marketPrices = res.data || [];
            if (table === 'real_estate_subscription_sites') patch.realEstateSubscriptions = res.data || [];
            if (table === 'real_estate_housing_types') patch.realEstateHousingTypes = res.data || [];
            if (table === 'real_estate_competition') patch.realEstateCompetition = res.data || [];
            if (table === 'real_estate_price_refs') patch.realEstatePriceRefs = res.data || [];
        });

        return patch;
    }

    function mergeTransactionRowsIntoCache(rows = []) {
        const insertedRows = Array.isArray(rows) ? rows : [rows];
        const currentRows = dataCache.tx ? dataCache.tx.slice(1) : [];
        const mergedRows = currentRows.concat(formatTransactionRows(insertedRows).slice(1));
        mergedRows.sort((a, b) => `${a[0]} ${a[1] || '00:00'}`.localeCompare(`${b[0]} ${b[1] || '00:00'}`));
        dataCache.tx = [formatTransactionRows([])[0], ...mergedRows];
        persistDataCache();
        applyCachedData();
    }


    const PAYDAYS = {
        '2025-10': '2025-10-24', '2025-11': '2025-11-25', '2025-12': '2025-12-24',
        '2026-01': '2026-01-23', '2026-02': '2026-02-25', '2026-03': '2026-03-25',
        '2026-04': '2026-04-24', '2026-05': '2026-05-22', '2026-06': '2026-06-25',
        '2026-07': '2026-07-24', '2026-08': '2026-08-25', '2026-09': '2026-09-23',
        '2026-10': '2026-10-23', '2026-11': '2026-11-25', '2026-12': '2026-12-24',
        '2027-01': '2027-01-25'
    };

    function getPayday(year, month) {
        const key = `${year}-${String(month).padStart(2, '0')}`;
        if (PAYDAYS[key]) return PAYDAYS[key];
        let d = 25; let date = new Date(year, month - 1, d);
        if (date.getDay() === 6) d = 24; else if (date.getDay() === 0) d = 23;
        return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    function getMonthKeyAndPeriod(dateStr) {
        const parts = dateStr.split('-');
        const y = parseInt(parts[0], 10); const m = parseInt(parts[1], 10);
        const currentPaydayStr = getPayday(y, m);
        let accountY, accountM, prevPaydayStr, nextPaydayStr;

        if (dateStr >= currentPaydayStr) {
            accountY = m === 12 ? y + 1 : y; accountM = m === 12 ? 1 : m + 1;
            prevPaydayStr = currentPaydayStr; nextPaydayStr = getPayday(accountY, accountM);
        } else {
            accountY = y; accountM = m;
            prevPaydayStr = getPayday(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1); nextPaydayStr = currentPaydayStr;
        }

        const monthKey = `${accountY}-${String(accountM).padStart(2, '0')}`;
        const prevParts = prevPaydayStr.split('-'); const nextParts = nextPaydayStr.split('-');
        const nDate = new Date(parseInt(nextParts[0], 10), parseInt(nextParts[1], 10) - 1, parseInt(nextParts[2], 10));
        nDate.setDate(nDate.getDate() - 1);
        const periodStr = `${parseInt(prevParts[1],10)}/${parseInt(prevParts[2],10)} ~ ${nDate.getMonth() + 1}/${nDate.getDate()}`;
        return { monthKey, periodStr, title: `${accountY}년 ${accountM}월` };
    }

    // ==========================================
    // 데이터 파서
    // ==========================================
    function parseTxData(rows) {
        monthlyDB = {};
        sortedMonthKeys = [];
        if (!rows || rows.length < 2) return;

        rows.slice(1).forEach(row => {
            if (!row[0]) return;

            let dateStr = String(row[0]).replace(/[\.\/]/g, '-').replace(/\s/g, '');
            if(dateStr.endsWith('-')) dateStr = dateStr.slice(0, -1);
            const dateArr = dateStr.split('-');
            if(dateArr.length >= 3) dateStr = `${dateArr[0]}-${dateArr[1].padStart(2, '0')}-${dateArr[2].padStart(2, '0')}`;
            else return;

            const time = row[1] || ''; const type = row[2] || '';
            const cat = row[3] || '미분류'; const subcat = row[4] || '미분류';
            const memo = row[5] || '';
            const amount = Math.round(parseFloat(String(row[6] || '0').replace(/[^0-9.-]/g, ''))) || 0;
            if (isNaN(amount) || amount === 0) return;
            let method = row.length > 8 ? row[8] : (row[7] || '');

            const tx = { date: dateStr, time, type, cat, subcat, memo, amount, method };
            const { monthKey, title, periodStr } = getMonthKeyAndPeriod(dateStr);

            if (!monthlyDB[monthKey]) monthlyDB[monthKey] = { title: title, periodStr: periodStr, transactions: [] };
            monthlyDB[monthKey].transactions.push(tx);
        });

        sortedMonthKeys = Object.keys(monthlyDB).sort();
        if (sortedMonthKeys.length > 0) {
            if (!currentMonthKey || !monthlyDB[currentMonthKey]) currentMonthKey = sortedMonthKeys[sortedMonthKeys.length - 1];
            if (!cashFlowMonthKey || !monthlyDB[cashFlowMonthKey]) cashFlowMonthKey = currentMonthKey;
        }
    }

    function parseAssetData(rows) {
        dynamicAssetHistory = { labels: [], data: [] };
        dynamicAssetSnapshots = {};
        if (!rows || rows.length < 2) return;

        rows.slice(1).forEach(row => {
            if (row.length < 3) return;

            const yearStr = String(row[0]).replace(/[^0-9]/g, '');
            const monthStr = String(row[1]).replace(/[^0-9]/g, '');
            if (!yearStr || !monthStr) return;

            const shortYear = yearStr.length === 4 ? yearStr.substring(2, 4) : yearStr;
            const label = `${shortYear}.${monthStr.padStart(2, '0')}`;

            const parseAmount = (val) => {
                const cleaned = String(val).replace(/[^0-9.-]/g, '');
                return cleaned === '' ? null : Math.round(parseFloat(cleaned));
            };

            const total = parseAmount(row[2]);
            if (total === null) return;

            const cash = parseAmount(row[3] || '') || 0;
            const safe = parseAmount(row[4] || '') || 0;
            const invest = parseAmount(row[5] || '') || 0;
            const debt = parseAmount(row[6] || '') || 0;

            dynamicAssetHistory.labels.push(label);
            dynamicAssetHistory.data.push(total);
            dynamicAssetSnapshots[label] = { total, cash, safe, invest, debt };
        });

        updateYearFilterOptions();
    }

    function updateYearFilterOptions() {
        const filterSelect = document.getElementById('asset-year-filter');
        if (!filterSelect) return;
        const uniqueYears = [...new Set(dynamicAssetHistory.labels.map(l => l.substring(0, 2)))].sort();
        let optionsHtml = `<option value="all">전체 기간</option>`;
        uniqueYears.reverse().forEach(y => { optionsHtml += `<option value="${y}">20${y}년</option>`; });
        filterSelect.innerHTML = optionsHtml;
        currentAssetFilter = 'all';
    }

    function parsePortfolioData(rows) {
        rawPortfolioData = rows || []; // 원본 배열 저장 (수정 및 서버전송 목적)
        dynamicPortfolioData = {};
        let hasData = false;

        if (!rows || rows.length < 2) {
            dynamicPortfolioData = null;
            return;
        }

        const fallbackColors = [
            { c: 'text-blue-500', b: 'bg-blue-50' }, { c: 'text-green-500', b: 'bg-green-50' },
            { c: 'text-purple-500', b: 'bg-purple-50' }, { c: 'text-amber-500', b: 'bg-amber-50' },
            { c: 'text-pink-500', b: 'bg-pink-50' }, { c: 'text-indigo-500', b: 'bg-indigo-50' }
        ];
        let colorIdx = 0;

        rows.slice(1).forEach(row => {
            if (row.length < 5) return;
            const group = row[0] || '미분류';
            const name = row[1];
            const currency = row[2] || 'KRW';
            const amountStr = String(row[4] || '0').replace(/[^0-9.-]/g, '');
            const amount = Math.round(parseFloat(amountStr));
            const maturity = row[3] || '';
            const sharesStr = row.length > 5 ? String(row[5] || '').replace(/[^0-9.-]/g, '') : '';
            const shares = sharesStr ? parseFloat(sharesStr) : null;
            const id = row.length > 6 ? row[6] : '';
            const assetType = row.length > 7 ? row[7] : '';
            const instrumentType = row.length > 8 ? row[8] : '';
            const ticker = row.length > 9 ? row[9] : '';
            const riskBucket = row.length > 10 ? row[10] : '';
            const classificationSource = row.length > 11 ? row[11] : '';
            const classificationUpdatedAt = row.length > 12 ? row[12] : '';
            const strategyTag = row.length > 13 ? row[13] : '';
            const avgBuyPriceStr = row.length > 14 ? String(row[14] || '').replace(/[^0-9.-]/g, '') : '';
            const avgBuyPrice = avgBuyPriceStr ? parseFloat(avgBuyPriceStr) : null;

            if (isNaN(amount) || !name) return;

            const isDebt = group.includes('부채') || group.includes('대출');

            if (!dynamicPortfolioData[group]) {
                const isDebtColor = isDebt ? { c: 'text-red-500', b: 'bg-red-50' } : fallbackColors[colorIdx % fallbackColors.length];
                dynamicPortfolioData[group] = { color: isDebtColor.c, bg: isDebtColor.b, isDebt: isDebt, items: [] };
                if(!isDebt) colorIdx++;
            }
            const item = { id, name, amount: isDebt && amount > 0 ? -amount : amount, currency, maturity, shares, assetType, instrumentType, ticker, riskBucket, classificationSource, classificationUpdatedAt, strategyTag, avgBuyPrice };
            item.classification = classifyPortfolioItem(group, item);
            dynamicPortfolioData[group].items.push(item);
            hasData = true;
        });

        if(!hasData) dynamicPortfolioData = null;
    }

    // ==========================================
    // Phase 1: 로딩 0초 매커니즘 (캐시)
    // ==========================================
    function loadCachedData() {
        const cachedStr = localStorage.getItem(CACHE_KEY);
        if (cachedStr) {
            try {
                dataCache = normalizeCache(JSON.parse(cachedStr));
                applyCachedData();
                renderSections({ dashboard: true, portfolio: true, addons: true });
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    // ==========================================
    // Fetch 데이터 (GET & Background Sync)
    // ==========================================
    async function fetchSheetData(isAutoSync = true, tables = ALL_DATA_TABLES) {
        const syncIcon = document.getElementById('sync-icon');
        const syncStatus = document.getElementById('sync-status');
        const sidebarSync = document.getElementById('sidebar-sync-status');

        const hasCache = isAutoSync ? loadCachedData() : false;

        if(syncIcon) syncIcon.classList.add('animate-spin-slow');
        if(syncStatus) {
            syncStatus.textContent = hasCache ? '백그라운드 동기화 중...' : '데이터 불러오는 중...';
            syncStatus.classList.remove('hidden');
            syncStatus.className = "hidden md:inline-block text-xs text-indigo-400 font-medium mr-2 max-w-[150px] truncate animate-pulse";
        }

        try {
            const patch = await fetchRemoteTables(tables);
            dataCache = normalizeCache({ ...dataCache, ...patch });
            persistDataCache();
            applyCachedData();
            renderSections(getRenderTargetsForTables(tables));

            const now = new Date();
            const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
            if(syncStatus) {
                syncStatus.textContent = `최신 갱신: ${timeStr}`;
                syncStatus.className = "hidden md:inline-block text-xs text-gray-400 font-medium mr-2 max-w-[150px] truncate";
            }
            if(sidebarSync) sidebarSync.innerHTML = `<i class="fas fa-check-circle text-[10px]"></i> 실시간 동기화됨`;

            if(!isAutoSync) showToast('최신 데이터가 동기화되었습니다.', 'info');

        } catch (error) {
            console.warn("API 연동 실패 사유:", error.message);
            if (hasCache) {
                if(syncStatus) {
                    syncStatus.textContent = '오프라인 (캐시 뷰)';
                    syncStatus.className = "hidden md:inline-block text-xs text-amber-500 font-medium mr-2 max-w-[150px] truncate";
                }
                if(sidebarSync) sidebarSync.innerHTML = `<i class="fas fa-bolt text-[10px] text-amber-500"></i> 오프라인 모드`;
                showToast(`인터넷 연결 불안정: 캐시된 데이터를 표시합니다.`, 'warning', 4000);
            } else {
                renderSections({ dashboard: true, portfolio: true, addons: true });

                if(syncStatus) {
                    syncStatus.textContent = '데이터 없음';
                    syncStatus.className = "hidden md:inline-block text-xs text-red-500 font-medium mr-2 max-w-[150px] truncate";
                }
                if(sidebarSync) sidebarSync.innerHTML = `<i class="fas fa-exclamation-triangle text-[10px] text-red-500"></i> 데이터 없음`;
                if(error.message === 'URL_MISSING') showToast('설정에서 Supabase URL과 Key를 입력해주세요.', 'info');
                else showToast(`연결 실패: 표시할 데이터가 없습니다.`, 'error');
            }
        } finally {
            if(syncIcon) syncIcon.classList.remove('animate-spin-slow');
        }
    }

    // ==========================================
    // Phase 2: 거래 내역(Tx) 추가 모달 및 전송
    // ==========================================
    function openTxModal() {
        const now = new Date();
        document.getElementById('tx-date').value = now.toISOString().split('T')[0];
        document.getElementById('tx-time').value = now.toTimeString().split(':')[0] + ':' + now.toTimeString().split(':')[1];
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-memo').value = '';
        document.getElementById('tx-modal').classList.remove('hidden');
    }

    function closeTxModal() {
        document.getElementById('tx-modal').classList.add('hidden');
    }

    async function submitTransaction() {
        const date = document.getElementById('tx-date').value;
        const time = document.getElementById('tx-time').value;
        const type = document.getElementById('tx-type').value;
        const cat = document.getElementById('tx-category').value;
        let amount = document.getElementById('tx-amount').value;
        const memo = document.getElementById('tx-memo').value;
        const method = document.getElementById('tx-method').value;

        if(!amount || isNaN(amount)) return showToast('올바른 금액을 입력하세요.', 'error');

        const formattedAmount = type === '지출' ? `-${Math.abs(amount)}` : `${Math.abs(amount)}`;

        const btn = document.getElementById('btn-submit-tx');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장중...';
        btn.disabled = true;

        try {
            const _supabase = getSupabaseClient();
            let timeVal = time;
            if (timeVal && timeVal.split(':').length === 2) timeVal += ':00'; // Make HH:MM into HH:MM:SS

            const txPayload = {
                date: date,
                time: timeVal || null,
                type: type,
                category: cat,
                subcategory: '미분류',
                memo: memo,
                amount: parseInt(formattedAmount, 10),
                currency: 'KRW',
                method: method
            };

            const { data: insertedRows, error } = await _supabase
                .from('transactions')
                .insert([txPayload])
                .select(SUPABASE_COLUMNS.transactions);

            if (error) throw error;

            showToast('저장 성공!', 'info');
            closeTxModal();
            if (insertedRows && insertedRows.length > 0) {
                mergeTransactionRowsIntoCache(insertedRows);
                const { monthKey } = getMonthKeyAndPeriod(date);
                currentMonthKey = monthKey;
                cashFlowMonthKey = monthKey;
                renderSections({ dashboard: true, portfolio: true });
            } else {
                await fetchSheetData(false, ['transactions']);
            }
        } catch(error) {
            console.error("전송 에러:", error);
            showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // ==========================================
    // Phase 3: 거래 내역 CSV/TSV/XLSX 가져오기
    // ==========================================
    // Transaction import behavior lives in js/features/transactionImport.js.

    // Portfolio edit modal behavior lives in js/features/portfolioEditor.js.
