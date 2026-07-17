(function (window) {
    const TABLE_NAME = 'personal_cfo_snapshots';
    const STORAGE_KEY = 'netvisualizer.personalCfo.snapshot.v3';
    const LEGACY_STORAGE_KEY = 'netvisualizer.personalCfo.snapshot.v2';
    const SNAPSHOT_KEY = 'default';
    const SCHEMA_VERSION = 3;
    const domain = window.PersonalCfoDomain;
    if (!domain) throw new Error('PersonalCfoDomain runtime is not loaded. Run npm run build:cfo-runtime.');

    const emptySnapshot = domain.createEmptyPersonalCfoSnapshot();

    let currentSnapshot;
    let remoteAvailable = true;
    let remoteLoaded = false;
    let remoteLoadStarted = false;
    let syncStatusText = '로컬 우선';
    let syncStatusClasses = 'text-slate-600 bg-slate-50 border-slate-100';
    let activeGraphMode = 'cashFlow';

    const typeMeta = {
        person: { fill: '#334155', stroke: '#0f172a', label: '본인' },
        income: { fill: '#16a34a', stroke: '#15803d', label: '소득' },
        account: { fill: '#0284c7', stroke: '#0369a1', label: '계좌' },
        asset: { fill: '#4f46e5', stroke: '#4338ca', label: '자산' },
        liability: { fill: '#dc2626', stroke: '#b91c1c', label: '부채' },
        budgetBucket: { fill: '#d97706', stroke: '#b45309', label: '자금' },
        project: { fill: '#7c3aed', stroke: '#6d28d9', label: '프로젝트' },
        risk: { fill: '#e11d48', stroke: '#be123c', label: '리스크' },
        kpi: { fill: '#0d9488', stroke: '#0f766e', label: 'KPI' },
    };
    const statusLabels = {
        active: '진행중',
        planned: '예정',
        completed: '완료',
        paused: '보류',
    };
    const riskLevelLabels = {
        low: '낮음',
        medium: '보통',
        high: '높음',
        critical: '치명적',
    };
    const edgeLabels = {
        FLOWS_TO: '흐름',
        ALLOCATED_TO: '배분',
        FUNDS: '자금지원',
        HEDGES: '완충',
        EXPOSED_TO: '노출',
        CONTRIBUTES_TO: '기여',
        DEPENDS_ON: '의존',
    };
    const bucketLabels = {
        operating: '운영자금',
        defense: '방어자금',
        housing: '주거자금',
        growth: '성장자금',
        humanCapital: '인적자본',
        experience: '경험자금',
    };
    const graphModeMeta = {
        cashFlow: {
            label: '현금 흐름',
            title: '월급 배분 현금 흐름',
            description: '최근 종료 급여기간의 내부 이체를 순액으로 정산해 생활비·저축·부채 순서로 보여줍니다. 전세대출은 이 흐름에만 반영합니다.',
            dataLabel: '실제+정산 추정',
            dataClasses: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        },
        balanceSheet: {
            label: '재무상태',
            title: '현재 재무상태 네트워크',
            description: '포트폴리오 현재값만 사용해 계좌·자산·부채가 순자산에 기여하는 구조를 보여줍니다.',
            dataLabel: '실제 데이터',
            dataClasses: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        },
        strategy: {
            label: '목표·리스크',
            title: '목표와 리스크 연결',
            description: '계획 바구니가 프로젝트를 지원하고 주요 리스크를 완충하는 관계입니다.',
            dataLabel: '계획 모델',
            dataClasses: 'border-amber-100 bg-amber-50 text-amber-700',
        },
    };
    function clamp(value, min = 0, max = 100) {
        return Math.max(min, Math.min(max, value));
    }

    function escapeHtml(value) {
        return window.AppUtils.escapeHtml(value);
    }

    function cloneSnapshot(value) {
        return JSON.parse(JSON.stringify(value ?? emptySnapshot));
    }

    function normalizeSnapshot(raw, schemaVersion = SCHEMA_VERSION) {
        return domain.normalizePersonalCfoPlanSnapshot(raw, schemaVersion);
    }

    function getStore() {
        try {
            const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (current && typeof current === 'object') return normalizeSnapshot(current);
            const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
            if (legacy && typeof legacy === 'object') {
                const migrated = normalizeSnapshot(legacy, 2);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                localStorage.removeItem(LEGACY_STORAGE_KEY);
                return migrated;
            }
        } catch (error) {
            console.warn('Personal CFO storage parse failed', error);
        }
        return normalizeSnapshot(emptySnapshot);
    }

    currentSnapshot = getStore();

    function getPortfolioFinanceItems() {
        const financeData = typeof window.getFinanceDataSnapshot === 'function'
            ? window.getFinanceDataSnapshot()
            : null;
        if (Array.isArray(financeData?.portfolios) && financeData.portfolios.length > 0) {
            return financeData.portfolios.map((item) => ({
                id: item.id,
                groupName: String(item.group_name || '미분류'),
                name: String(item.name || ''),
                amount: Number(item.amount || 0),
                maturity: String(item.maturity || ''),
                accountName: String(item.account_name || ''),
                assetType: String(item.asset_type || ''),
                instrumentType: String(item.instrument_type || ''),
            }));
        }
        if (typeof dynamicPortfolioData === 'undefined' || !dynamicPortfolioData || typeof dynamicPortfolioData !== 'object') {
            return [];
        }
        return Object.entries(dynamicPortfolioData).flatMap(([groupName, group]) => (
            Array.isArray(group?.items) ? group.items : []
        ).map((item) => ({
            id: item.id,
            groupName,
            name: String(item.name || ''),
            amount: Number(item.amount || 0),
            maturity: String(item.maturity || ''),
            accountName: String(item.accountName || ''),
            assetType: String(item.classification?.assetType || item.assetType || ''),
            instrumentType: String(item.classification?.instrumentType || item.instrumentType || ''),
        })));
    }

    function applyPortfolioFinanceData(nextSnapshot) {
        return domain.applyPortfolioFinanceData(nextSnapshot, getPortfolioFinanceItems());
    }

    function applyRuntimeFinanceData(nextSnapshot) {
        const portfolioOverlay = applyPortfolioFinanceData(nextSnapshot);
        const cashFlowContext = typeof window.getFinanceCashFlowContext === 'function'
            ? window.getFinanceCashFlowContext()
            : { periods: [] };
        return {
            ...portfolioOverlay,
            snapshot: domain.applyCashFlowData(
                portfolioOverlay.snapshot,
                cashFlowContext.periods || [],
                window.AppUtils.toLocalDateString(),
            ),
            cashFlowContext,
        };
    }

    function saveStore(nextSnapshot = currentSnapshot) {
        const normalized = normalizeSnapshot(nextSnapshot);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        return normalized;
    }

    function toast(message, type = 'info', duration = 1600) {
        if (typeof window.showToast === 'function') window.showToast(message, type, duration);
    }

    function getCurrentCfoUserId() {
        return typeof getCurrentUserId === 'function' ? getCurrentUserId() : null;
    }

    function getClient() {
        if (!remoteAvailable || typeof getAuthenticatedSupabaseClient !== 'function' || !getCurrentCfoUserId()) return null;
        try {
            return getAuthenticatedSupabaseClient();
        } catch (error) {
            return null;
        }
    }

    function isMissingSchemaError(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        return code === '42P01'
            || code === 'PGRST204'
            || code === 'PGRST205'
            || message.includes('could not find')
            || message.includes('does not exist')
            || message.includes('schema cache');
    }

    function renderSyncStatus(text, classes) {
        syncStatusText = text;
        syncStatusClasses = classes;
        const badge = document.getElementById('personal-cfo-sync-badge');
        if (!badge) return;
        badge.className = `rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${classes}`;
        badge.textContent = text;
    }

    function handleRemoteError(error, context) {
        remoteLoaded = false;
        if (isMissingSchemaError(error)) {
            remoteAvailable = false;
            console.warn(`${context}: Personal CFO Supabase table is not ready`, error);
            renderSyncStatus('로컬 전용', 'text-slate-600 bg-slate-50 border-slate-100');
            return;
        }
        console.warn(`${context}: Personal CFO sync failed`, error);
        renderSyncStatus('동기화 실패', 'text-amber-600 bg-amber-50 border-amber-100');
    }

    function toRemotePayload(nextSnapshot = currentSnapshot) {
        const normalized = normalizeSnapshot(nextSnapshot);
        const userId = getCurrentCfoUserId();
        const payload = {
            snapshot_key: SNAPSHOT_KEY,
            schema_version: SCHEMA_VERSION,
            snapshot: normalized,
            updated_at: new Date().toISOString(),
        };
        if (userId) payload.user_id = userId;
        return payload;
    }

    function fromRemoteRow(row) {
        const schemaVersion = Number(row?.schema_version || 0);
        return {
            snapshot: normalizeSnapshot(row?.snapshot, schemaVersion),
            needsMigration: schemaVersion < SCHEMA_VERSION,
        };
    }

    async function persistRemoteSnapshot(nextSnapshot = currentSnapshot, options = {}) {
        const client = getClient();
        if (!client) {
            renderSyncStatus('로컬 전용', 'text-slate-600 bg-slate-50 border-slate-100');
            return false;
        }
        currentSnapshot = saveStore(nextSnapshot);
        renderSyncStatus('클라우드 저장 중', 'text-sky-600 bg-sky-50 border-sky-100');
        try {
            const { error } = await client
                .from(TABLE_NAME)
                .upsert(toRemotePayload(currentSnapshot), { onConflict: 'user_id,snapshot_key' });
            if (error) throw error;
            remoteLoaded = true;
            renderSyncStatus('클라우드 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
            if (options.manual) toast('개인 CFO 스냅샷을 클라우드에 저장했습니다.', 'info');
            return true;
        } catch (error) {
            handleRemoteError(error, 'persistRemoteSnapshot');
            if (options.manual) toast('클라우드 저장에 실패했습니다. 로컬에는 저장되어 있습니다.', 'warning');
            return false;
        }
    }

    async function loadRemoteSnapshot() {
        const client = getClient();
        if (!client) {
            renderSyncStatus('로컬 전용', 'text-slate-600 bg-slate-50 border-slate-100');
            return null;
        }
        renderSyncStatus('클라우드 확인 중', 'text-sky-600 bg-sky-50 border-sky-100');
        try {
            const { data, error } = await client
                .from(TABLE_NAME)
                .select('snapshot_key,schema_version,snapshot,updated_at')
                .eq('snapshot_key', SNAPSHOT_KEY)
                .order('updated_at', { ascending: false })
                .limit(1);
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : null;
            if (row?.snapshot) {
                const remoteSnapshot = fromRemoteRow(row);
                currentSnapshot = saveStore(remoteSnapshot.snapshot);
                remoteLoaded = true;
                render({ skipRemoteLoad: true });
                if (remoteSnapshot.needsMigration) await persistRemoteSnapshot(currentSnapshot);
                else renderSyncStatus('클라우드 저장됨', 'text-emerald-600 bg-emerald-50 border-emerald-100');
                return currentSnapshot;
            }
            await persistRemoteSnapshot(currentSnapshot);
            return currentSnapshot;
        } catch (error) {
            handleRemoteError(error, 'loadRemoteSnapshot');
            return null;
        }
    }

    function queueRemoteLoad() {
        if (remoteLoadStarted) return;
        remoteLoadStarted = true;
        loadRemoteSnapshot();
    }

    function formatKrw(value) {
        const sign = value < 0 ? '-' : '';
        const abs = Math.abs(Number(value || 0));
        if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(2)}억`;
        if (abs >= 10000) return `${sign}${Math.round(abs / 10000).toLocaleString('ko-KR')}만원`;
        return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`;
    }

    function formatPercent(value) {
        return `${Number(value || 0).toFixed(1)}%`;
    }

    function formatMonths(value) {
        return `${Number(value || 0).toFixed(1)}개월`;
    }

    function formatMetricValue(value, unit = 'KRW') {
        if (unit === 'PERCENT') return formatPercent(value);
        if (unit === 'MONTHS') return formatMonths(value);
        if (unit === 'SCORE') return `${Math.round(Number(value || 0))}점`;
        return formatKrw(value);
    }

    function formatProgress(current, target) {
        if (!target || target <= 0) return 0;
        return clamp((current / target) * 100);
    }

    function truncateLabel(value, limit = 18) {
        const label = String(value || '');
        return label.length > limit ? `${label.slice(0, limit - 1)}...` : label;
    }

    function renderKpiCards(summary) {
        const cashFlowReviewLabel = summary.cashFlowReviewStatus === 'confirmed'
            ? '분류 확정'
            : (summary.cashFlowReviewStatus === 'stale' ? '분류 재확인 필요' : '분류 미확정');
        const cards = [
            { label: '순자산', value: formatKrw(summary.netWorth), sub: `총자산 ${formatKrw(summary.totalAssets)}`, tone: 'slate', basis: 'actual' },
            { label: '종료월 잉여현금', value: formatKrw(summary.monthlyFreeCashFlow), sub: `수입-지출 · ${cashFlowReviewLabel}`, tone: summary.monthlyFreeCashFlow >= 0 ? 'emerald' : 'rose', basis: 'actual' },
            { label: '계획 저축률', value: summary.hasSavingsPlan ? formatPercent(summary.savingsRate) : '-', sub: summary.hasSavingsPlan ? '계획 배분 / 종료월 수입' : '자금 배분 계획 없음', tone: summary.hasSavingsPlan ? 'emerald' : 'slate', basis: summary.hasSavingsPlan ? 'plan' : 'unset' },
            { label: '고정 현금유출률', value: formatPercent(summary.fixedCostRatio), sub: '고정비+대출이자+전세대출 / 수입', tone: summary.fixedCostRatio <= 50 ? 'sky' : 'amber', basis: 'actual' },
            { label: '비상금 커버리지', value: summary.hasEmergencyPlan ? formatMonths(summary.emergencyCoverageMonths) : '-', sub: summary.hasEmergencyPlan ? '계획 방어자금 기준 유지 기간' : '방어자금 계획 없음', tone: summary.hasEmergencyPlan && summary.emergencyCoverageMonths >= 6 ? 'emerald' : summary.hasEmergencyPlan ? 'amber' : 'slate', basis: summary.hasEmergencyPlan ? 'plan' : 'unset' },
            { label: '부채비율', value: formatPercent(summary.debtRatio), sub: `총부채 ${formatKrw(summary.totalLiabilities)}`, tone: summary.debtRatio <= 25 ? 'emerald' : 'rose', basis: 'actual' },
        ];
        const valueClasses = {
            slate: 'text-gray-900',
            emerald: 'text-emerald-700',
            sky: 'text-sky-700',
            amber: 'text-amber-700',
            rose: 'text-rose-700',
        };
        const basisClasses = {
            actual: 'border-emerald-100 bg-emerald-50 text-emerald-700',
            plan: 'border-amber-100 bg-amber-50 text-amber-700',
            unset: 'border-gray-200 bg-gray-50 text-gray-500',
        };
        return cards.map((card) => `
            <article class="rounded-lg border bg-white p-3 shadow-sm min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-[11px] font-bold text-gray-500">${escapeHtml(card.label)}</p>
                    <span class="rounded border px-1.5 py-0.5 text-[9px] font-bold ${basisClasses[card.basis]}">${card.basis === 'plan' ? '계획' : card.basis === 'unset' ? '미설정' : '실제'}</span>
                </div>
                <p class="mt-2 text-lg md:text-xl font-bold leading-tight ${valueClasses[card.tone] || valueClasses.slate}">${escapeHtml(card.value)}</p>
                <p class="mt-1 text-[11px] text-gray-400 truncate">${escapeHtml(card.sub)}</p>
            </article>
        `).join('');
    }

    function getGraphNodeDimensions(node) {
        return {
            width: Math.round(Math.min(156, Math.max(96, node.size * 4.2))),
            height: node.type === 'project' || node.type === 'risk' ? 52 : 46,
        };
    }

    function buildOrthogonalEdgePath(source, target) {
        const sourceSize = getGraphNodeDimensions(source);
        const targetSize = getGraphNodeDimensions(target);
        if (Math.abs(target.x - source.x) < 2) {
            const movesDown = target.y >= source.y;
            const sourceY = source.y + (movesDown ? sourceSize.height / 2 : -sourceSize.height / 2);
            const targetY = target.y + (movesDown ? -targetSize.height / 2 : targetSize.height / 2);
            return `M ${source.x.toFixed(1)} ${sourceY.toFixed(1)} V ${targetY.toFixed(1)}`;
        }
        const movesRight = target.x >= source.x;
        const sourceX = source.x + (movesRight ? sourceSize.width / 2 : -sourceSize.width / 2);
        const sourceY = source.y;
        const targetX = target.x + (movesRight ? -targetSize.width / 2 : targetSize.width / 2);
        const targetY = target.y;
        if (Math.abs(sourceY - targetY) < 1) {
            return `M ${sourceX.toFixed(1)} ${sourceY.toFixed(1)} H ${targetX.toFixed(1)}`;
        }
        const middleX = Math.round(((sourceX + targetX) / 2) / 4) * 4;
        return `M ${sourceX.toFixed(1)} ${sourceY.toFixed(1)} H ${middleX.toFixed(1)} V ${targetY.toFixed(1)} H ${targetX.toFixed(1)}`;
    }

    function renderGraphEdge(edge, nodeById) {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return '';
        const isHedge = edge.type === 'HEDGES';
        const isExposure = edge.type === 'EXPOSED_TO';
        const color = isExposure ? '#fb7185' : isHedge ? '#14b8a6' : '#94a3b8';
        const markerId = isExposure ? 'personal-cfo-arrow-exposure' : isHedge ? 'personal-cfo-arrow-hedge' : 'personal-cfo-arrow';
        const amountText = edge.amount === undefined ? '' : formatMetricValue(edge.amount, target.unit);
        const path = buildOrthogonalEdgePath(source, target);
        return `
            <path
                data-cfo-edge="${escapeHtml(edge.id)}"
                data-edge-type="${escapeHtml(edge.type)}"
                d="${path}"
                fill="none"
                stroke="${color}" stroke-width="${edge.weight}" stroke-linecap="round"
                stroke-linejoin="round" stroke-opacity="${isExposure ? '0.48' : isHedge ? '0.44' : '0.28'}"
                ${isHedge ? 'stroke-dasharray="8 6"' : ''}
                marker-end="url(#${markerId})"
            >
                <title>${escapeHtml(edgeLabels[edge.type] || edge.type)} ${escapeHtml(amountText)}</title>
            </path>
        `;
    }

    function renderGraphNode(node) {
        const meta = typeMeta[node.type] || typeMeta.account;
        const isHighRisk = Number(node.riskScore || 0) >= 70;
        const statusText = node.status ? ` / ${node.status}` : '';
        const hasAmount = node.amount !== undefined && node.amount !== null;
        const formattedAmount = hasAmount ? formatMetricValue(node.amount, node.unit) : '';
        const amountText = hasAmount ? ` / ${formattedAmount}` : '';
        const { width, height } = getGraphNodeDimensions(node);
        const x = -width / 2;
        const y = -height / 2;
        const subLabel = node.status
            ? statusLabels[node.status] || node.status
            : (node.riskScore ? `리스크 ${node.riskScore}` : (hasAmount ? formattedAmount : meta.label));
        return `
            <g opacity="${node.opacity}" transform="translate(${node.x} ${node.y})">
                <title>${escapeHtml(`${node.label} / ${meta.label}${statusText}${amountText}`)}</title>
                ${isHighRisk ? `<rect x="${x - 5}" y="${y - 5}" width="${width + 10}" height="${height + 10}" rx="8" fill="none" stroke="#fb7185" stroke-width="3" stroke-opacity="0.8"></rect>` : ''}
                <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${meta.fill}" stroke="${meta.stroke}" stroke-width="2"></rect>
                <text y="-7" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="800" opacity="0.82">${escapeHtml(meta.label.toUpperCase())}</text>
                <text y="8" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800">${escapeHtml(truncateLabel(node.label, 18))}</text>
                <text y="22" text-anchor="middle" fill="#ffffff" font-size="9" font-weight="600" opacity="0.78">${escapeHtml(truncateLabel(subLabel, 20))}</text>
            </g>
        `;
    }

    function renderGraphGuides(graph) {
        const laneLines = (graph.laneYs || []).map((y) => `
            <line x1="28" y1="${y}" x2="${graph.width - 28}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4 8"></line>
        `).join('');
        const columns = (graph.columns || []).map((column) => `
            <line x1="${column.x}" y1="42" x2="${column.x}" y2="${graph.height - 24}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 9" opacity="0.7"></line>
            <text x="${column.x}" y="25" text-anchor="middle" fill="#64748b" font-size="11" font-weight="800">${escapeHtml(column.label)}</text>
        `).join('');
        return `<g aria-hidden="true">${laneLines}${columns}</g>`;
    }

    function renderFinanceGraph(graph) {
        const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
        const modeMeta = graphModeMeta[graph.mode] || graphModeMeta.cashFlow;
        const visibleTypes = new Set(graph.nodes.map((node) => node.type));
        const emptyMessage = graph.nodes.length <= 1
            ? (graph.mode === 'strategy' ? '등록된 계획 데이터가 없습니다.' : '표시할 실제 재무 데이터가 없습니다.')
            : '';
        return `
            <section class="hidden md:block rounded-lg border border-gray-200 bg-white p-3 md:p-4 shadow-sm">
                <div class="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <h3 class="text-base font-bold text-gray-900">${escapeHtml(modeMeta.title)}</h3>
                            <span class="rounded border px-2 py-0.5 text-[10px] font-bold ${modeMeta.dataClasses}">${escapeHtml(modeMeta.dataLabel)}</span>
                        </div>
                        <p class="text-xs text-gray-500">${escapeHtml(modeMeta.description)}</p>
                    </div>
                    <div class="inline-flex w-fit rounded-md border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label="재무 네트워크 보기">
                        ${Object.entries(graphModeMeta).map(([mode, meta]) => `
                            <button type="button" data-cfo-graph-mode="${escapeAttr(mode)}" class="rounded px-2.5 py-1.5 text-[11px] font-bold transition ${graph.mode === mode ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'}" aria-pressed="${graph.mode === mode}">${escapeHtml(meta.label)}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="mb-2 hidden md:flex flex-wrap gap-1.5 text-[10px] font-bold">
                        ${Object.entries(typeMeta).filter(([type]) => visibleTypes.has(type)).map(([, meta]) => `
                            <span class="inline-flex items-center gap-1 rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-gray-600">
                                <span class="h-2 w-2 rounded-full" style="background:${meta.fill}"></span>${escapeHtml(meta.label)}
                            </span>
                        `).join('')}
                </div>
                <div class="overflow-x-auto rounded-lg border border-gray-100 bg-gray-50">
                    ${emptyMessage ? `
                        <div class="flex min-h-48 items-center justify-center px-4 text-sm font-semibold text-gray-400">${escapeHtml(emptyMessage)}</div>
                    ` : `<svg viewBox="0 0 ${graph.width} ${graph.height}" preserveAspectRatio="xMinYMin meet" role="img" aria-label="${escapeAttr(modeMeta.title)}" class="min-w-[900px] w-full h-auto" style="aspect-ratio:${graph.width}/${graph.height}">
                        <defs>
                            <marker id="personal-cfo-arrow" markerWidth="10" markerHeight="10" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                                <path d="M0,0 L0,8 L9,4 z" fill="#94a3b8"></path>
                            </marker>
                            <marker id="personal-cfo-arrow-exposure" markerWidth="10" markerHeight="10" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                                <path d="M0,0 L0,8 L9,4 z" fill="#fb7185"></path>
                            </marker>
                            <marker id="personal-cfo-arrow-hedge" markerWidth="10" markerHeight="10" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
                                <path d="M0,0 L0,8 L9,4 z" fill="#14b8a6"></path>
                            </marker>
                        </defs>
                        <rect x="0" y="0" width="${graph.width}" height="${graph.height}" fill="#f8fafc"></rect>
                        ${renderGraphGuides(graph)}
                        ${graph.edges.map((edge) => renderGraphEdge(edge, nodeById)).join('')}
                        ${graph.nodes.map(renderGraphNode).join('')}
                    </svg>`}
                </div>
            </section>
        `;
    }

    function renderMobileFinanceSummary(nextSnapshot) {
        const assetRows = [
            ...nextSnapshot.accounts.map((item) => ({ label: item.label, amount: item.balance, type: '계좌' })),
            ...nextSnapshot.assets.map((item) => ({ label: item.label, amount: item.marketValue, type: '자산' })),
        ];
        const liabilityRows = nextSnapshot.liabilities.map((item) => ({
            label: item.label,
            amount: item.outstandingBalance,
            type: '부채',
        }));
        const salaryAllocation = nextSnapshot.cashFlow?.salaryAllocation;
        const actualAllocationRows = salaryAllocation ? [
            { label: '생활비', amount: salaryAllocation.salaryAccountReserve + salaryAllocation.livingAccountReserve, type: '운영자금' },
            { label: '청년도약계좌', amount: salaryAllocation.youthSavings, type: '장기목돈' },
            { label: '연금저축펀드', amount: salaryAllocation.pensionSavings, type: '노후자산' },
            { label: '원화 발행어음', amount: salaryAllocation.safeAssetSweep, type: '안전자산' },
            { label: '신용대출 이자', amount: salaryAllocation.creditLoanInterest, type: '금융비용' },
            { label: '전세대출', amount: salaryAllocation.housingLoanPayment, type: '현금흐름 부채' },
        ].filter((item) => Number(item.amount) > 0) : [];
        const allocationRows = nextSnapshot.cashFlow
            ? actualAllocationRows
            : nextSnapshot.budgetBuckets.map((item) => ({
                label: item.label,
                amount: item.monthlyAllocation,
                type: '월 계획',
            }));
        const renderRows = (rows, amountClass = 'text-gray-900') => rows.map((row) => `
            <div class="flex items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
                <div class="min-w-0">
                    <p class="text-sm font-bold text-gray-800 truncate">${escapeHtml(row.label)}</p>
                    <p class="text-[11px] text-gray-400">${escapeHtml(row.type)}</p>
                </div>
                <p class="shrink-0 text-sm font-bold ${amountClass}">${escapeHtml(formatKrw(row.amount))}</p>
            </div>
        `).join('');

        return `
            <section class="md:hidden rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
                <div class="mb-2">
                    <h3 class="text-base font-bold text-gray-900">재무 흐름 요약</h3>
                    <p class="text-xs text-gray-500">모바일에서는 핵심 금액을 목록으로 먼저 보여줍니다.</p>
                </div>
                <div class="divide-y-4 divide-gray-50">
                    <div class="py-2">
                        <p class="mb-1 text-[11px] font-bold text-indigo-600">자산</p>
                        ${assetRows.length ? renderRows(assetRows) : '<p class="py-3 text-sm text-gray-400">등록된 자산이 없습니다.</p>'}
                    </div>
                    <div class="py-2">
                        <p class="mb-1 text-[11px] font-bold text-rose-600">부채</p>
                        ${liabilityRows.length ? renderRows(liabilityRows, 'text-rose-700') : '<p class="py-3 text-sm text-gray-400">등록된 부채가 없습니다.</p>'}
                    </div>
                    <div class="py-2">
                        <p class="mb-1 text-[11px] font-bold text-emerald-600">${escapeHtml(nextSnapshot.cashFlow ? `${nextSnapshot.cashFlow.periodLabel} 월급 배분` : '월 자금 배분 계획')}</p>
                        ${allocationRows.length ? renderRows(allocationRows, 'text-emerald-700') : '<p class="py-3 text-sm text-gray-400">표시할 흐름이 없습니다.</p>'}
                    </div>
                </div>
            </section>
        `;
    }

    function renderProjectRows(projects) {
        if (!projects.length) {
            return '<tr><td colspan="4" class="px-3 py-10 text-center text-sm font-semibold text-gray-400">등록된 프로젝트 계획이 없습니다.</td></tr>';
        }
        return projects.map((project) => {
            const progress = formatProgress(project.currentAmount, project.targetAmount);
            const fundingGap = Math.max(0, project.targetAmount - project.currentAmount);
            const rowOpacity = project.status === 'completed' ? 'opacity-55' : '';
            return `
                <tr class="${rowOpacity}">
                    <td class="px-3 py-2 align-top">
                        <p class="text-sm font-bold text-gray-900">${escapeHtml(project.label)}</p>
                        <p class="text-[11px] text-gray-400">${escapeHtml(bucketLabels[project.bucketKey] || project.bucketKey)} / ${escapeHtml(statusLabels[project.status] || project.status)}</p>
                        <p class="mt-1 text-[11px] text-gray-600">다음: ${escapeHtml(project.nextMilestone || '계획 보완')}</p>
                        <p class="text-[10px] text-gray-400">목표 시점: ${escapeHtml(project.targetDateLabel || '미정')}</p>
                    </td>
                    <td class="px-3 py-2 align-top text-right text-xs font-semibold text-gray-700">${project.priorityScore}</td>
                    <td class="px-3 py-2 align-top text-right">
                        <p class="text-xs text-gray-600">${escapeHtml(formatKrw(project.monthlyBurn))}</p>
                        <p class="text-[10px] text-gray-400">${escapeHtml(project.fundingSourceLabel || '계획값')}</p>
                    </td>
                    <td class="px-3 py-2 align-top min-w-[190px]">
                        <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div class="h-full rounded-full bg-indigo-500" style="width:${progress}%"></div>
                        </div>
                        <p class="mt-1 text-[11px] text-gray-500">계획 ${escapeHtml(formatKrw(project.currentAmount))} / ${escapeHtml(formatKrw(project.targetAmount))}</p>
                        <p class="text-[10px] text-gray-400">${progress.toFixed(1)}% · 부족 ${escapeHtml(formatKrw(fundingGap))}</p>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderRiskRows(risks) {
        if (!risks.length) {
            return '<tr><td colspan="4" class="px-3 py-10 text-center text-sm font-semibold text-gray-400">등록된 리스크 계획이 없습니다.</td></tr>';
        }
        const levelClasses = {
            low: 'text-emerald-700 bg-emerald-50 border-emerald-100',
            medium: 'text-amber-700 bg-amber-50 border-amber-100',
            high: 'text-rose-700 bg-rose-50 border-rose-100',
            critical: 'text-red-800 bg-red-50 border-red-200',
        };
        return risks.map((risk) => `
            <tr>
                <td class="px-3 py-2 align-top">
                    <p class="text-sm font-bold text-gray-900">${escapeHtml(risk.label)}</p>
                    <p class="text-[11px] text-gray-400">완충: ${escapeHtml(bucketLabels[risk.mitigatedByBucket] || '없음')}</p>
                </td>
                <td class="px-3 py-2 align-top">
                    <span class="inline-flex rounded-md border px-2 py-1 text-[11px] font-bold ${levelClasses[risk.level] || levelClasses.medium}">
                        ${escapeHtml(riskLevelLabels[risk.level] || risk.level)}
                    </span>
                </td>
                <td class="px-3 py-2 align-top text-right text-xs text-gray-600">${escapeHtml(formatKrw(risk.exposureAmount))}</td>
                <td class="px-3 py-2 align-top text-right text-xs font-semibold text-gray-800">${risk.score}</td>
            </tr>
        `).join('');
    }










    function renderTables(model) {
        if (!model.projectsByPriority.length && !model.risksByScore.length) {
            return `
                <section class="border-t border-gray-200 py-6 text-center">
                    <p class="text-sm font-semibold text-gray-400">등록된 프로젝트·리스크 계획이 없습니다.</p>
                </section>
            `;
        }
        return `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <section class="rounded-lg border border-gray-200 bg-white p-3 md:p-4 shadow-sm min-w-0">
                    <div class="mb-3 flex items-center justify-between gap-3">
                        <h3 class="text-base font-bold text-gray-900">프로젝트 포트폴리오</h3>
                        <span class="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">계획 ${model.projectsByPriority.length}개</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[720px] text-left">
                            <thead>
                                <tr class="border-b border-gray-100 text-[10px] font-bold text-gray-400">
                                    <th class="px-3 py-2">프로젝트</th>
                                    <th class="px-3 py-2 text-right">점수</th>
                                    <th class="px-3 py-2 text-right">월 소진</th>
                                    <th class="px-3 py-2">자금 충족</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">${renderProjectRows(model.projectsByPriority)}</tbody>
                        </table>
                    </div>
                </section>
                <section class="rounded-lg border border-gray-200 bg-white p-3 md:p-4 shadow-sm min-w-0">
                    <div class="mb-3 flex items-center justify-between gap-3">
                        <h3 class="text-base font-bold text-gray-900">리스크 대시보드</h3>
                        <span class="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">계획 ${model.risksByScore.length}개</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[520px] text-left">
                            <thead>
                                <tr class="border-b border-gray-100 text-[10px] font-bold text-gray-400">
                                    <th class="px-3 py-2">리스크</th>
                                    <th class="px-3 py-2">수준</th>
                                    <th class="px-3 py-2 text-right">노출액</th>
                                    <th class="px-3 py-2 text-right">점수</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">${renderRiskRows(model.risksByScore)}</tbody>
                        </table>
                    </div>
                </section>
            </div>
        `;
    }

    function render(options = {}) {
        const root = document.getElementById('personal-cfo-view');
        if (!root) return;
        const portfolioOverlay = applyRuntimeFinanceData(currentSnapshot);
        const model = domain.createPersonalCfoPageModel(portfolioOverlay.snapshot, activeGraphMode);
        const officialSnapshot = typeof getOfficialFinanceSnapshot === 'function' ? getOfficialFinanceSnapshot() : null;
        const dataBadge = portfolioOverlay.hasPortfolioData
            ? `${window.FinanceModel.getSourceBadge(officialSnapshot)} · 자산 ${portfolioOverlay.accountItemCount + portfolioOverlay.assetItemCount}개 · 부채 ${portfolioOverlay.liabilityItemCount}개`
            : '포트폴리오 데이터 없음';
        const dataBadgeClasses = portfolioOverlay.hasPortfolioData
            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
            : 'border-gray-200 bg-white text-gray-600';
        const planningBadge = model.summary.hasPlanningData
            ? '계획 · 자금 바구니·프로젝트·리스크'
            : '계획 데이터 없음';
        const planningBadgeClasses = model.summary.hasPlanningData
            ? 'border-amber-100 bg-amber-50 text-amber-700'
            : 'border-gray-200 bg-gray-50 text-gray-500';
        root.innerHTML = `
            <div class="mb-3 flex items-center justify-end gap-2">
                <div class="flex flex-wrap justify-end gap-2">
                    <span id="personal-cfo-sync-badge" class="rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${syncStatusClasses}">${escapeHtml(syncStatusText)}</span>
                    <span class="rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${dataBadgeClasses}">실제 · ${escapeHtml(dataBadge)}</span>
                    <span class="rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${planningBadgeClasses}">${escapeHtml(planningBadge)}</span>
                </div>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
                ${renderKpiCards(model.summary)}
            </div>
            <div class="space-y-4 pb-10">
                ${renderMobileFinanceSummary(portfolioOverlay.snapshot)}
                ${renderFinanceGraph(model.graph)}
                ${renderTables(model)}
            </div>
        `;
        renderSyncStatus(syncStatusText, syncStatusClasses);
        root.querySelectorAll('[data-cfo-graph-mode]').forEach((button) => {
            button.addEventListener('click', () => {
                const nextMode = button.dataset.cfoGraphMode;
                if (!graphModeMeta[nextMode] || nextMode === activeGraphMode) return;
                activeGraphMode = nextMode;
                render({ skipRemoteLoad: true });
            });
        });
        if (!options.skipRemoteLoad) queueRemoteLoad();
    }

    window.PersonalCfoFeature = {
        render,
        getDashboardSnapshot: () => {
            const portfolioOverlay = applyRuntimeFinanceData(currentSnapshot);
            const model = domain.createPersonalCfoPageModel(portfolioOverlay.snapshot, activeGraphMode);
            return {
                summary: model.summary,
                projects: model.projectsByPriority.map((project) => ({
                    id: project.id,
                    label: project.label,
                    priorityScore: project.priorityScore,
                    statusLabel: statusLabels[project.status] || project.status,
                    fundingPercent: formatProgress(project.currentAmount, project.targetAmount),
                })),
            };
        },
        getSnapshot: () => cloneSnapshot(currentSnapshot),
        setSnapshot: (nextSnapshot) => {
            currentSnapshot = saveStore(nextSnapshot);
            render({ skipRemoteLoad: true });
            return cloneSnapshot(currentSnapshot);
        },
        saveCurrentSnapshot: () => persistRemoteSnapshot(currentSnapshot, { manual: true }),
        getPortfolioOverlay: () => applyRuntimeFinanceData(currentSnapshot),
        createPersonalCfoPageModel: domain.createPersonalCfoPageModel,
        buildFinanceGraphFromSnapshot: domain.buildFinanceGraphFromSnapshot,
        calculations: {
            calculateTotalAssets: domain.calculateTotalAssets,
            calculateTotalLiabilities: domain.calculateTotalLiabilities,
            calculateNetWorth: domain.calculateNetWorth,
            calculateMonthlyFreeCashFlow: domain.calculateMonthlyFreeCashFlow,
            calculateSavingsRate: domain.calculateSavingsRate,
            calculateFixedCostRatio: domain.calculateFixedCostRatio,
            calculateDebtRatio: domain.calculateDebtRatio,
            calculateEmergencyCoverageMonths: domain.calculateEmergencyCoverageMonths,
            calculateProjectBurnRate: domain.calculateProjectBurnRate,
            calculateRiskScore: domain.calculateRiskScore,
            calculateProjectPriorityScore: domain.calculateProjectPriorityScore,
        },
    };
})(window);
