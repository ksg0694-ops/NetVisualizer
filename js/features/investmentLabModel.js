// Pure investment-Lab measurements. No fetching, mutation or private persistence.
(function (root) {
    'use strict';
    const finite = value => value !== null && value !== undefined && Number.isFinite(Number(value));
    const sum = (rows, field) => rows.reduce((total, row) => total + (finite(row[field]) ? Number(row[field]) : 0), 0);
    function day(value) {
        const text = String(value || '');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
        const date = new Date(`${text}T00:00:00Z`);
        return Number.isFinite(+date) && date.toISOString().slice(0, 10) === text ? +date / 86400000 : null;
    }
    function ageStatus(date, today) {
        const age = day(today) !== null && day(date) !== null ? day(today) - day(date) : null;
        return age === null ? '기준일 없음' : age < 0 ? '미래 기준일' : age > 7 ? '7일 초과' : '';
    }
    function build(positions = [], options = {}) {
        const today = options.today || '';
        const prepared = positions.filter(p => !p.isDebt && p.classification?.assetType !== 'debt').map((p, i) => {
            const account = String(p.accountName || p.account_name || p.groupName || '계좌 미지정');
            const ticker = String(p.ticker || '').trim().toUpperCase();
            const instrument = ticker ? JSON.stringify([ticker, p.market || p.exchange || '', p.priceCurrency || 'KRW']) : `position:${p.id || i}`;
            const priceDate = String(p.marketPrice?.priceDate || p.marketPrice?.price_date || '');
            const issues = [];
            if (!p.isMarketValued) issues.push(p.fallbackReason || '입력 평가액');
            else {
                const priceIssue = ageStatus(priceDate, today);
                if (priceIssue) issues.push(`시세 ${priceIssue}`);
                if (p.priceCurrency !== 'KRW') {
                    const fxIssue = ageStatus(p.fxRate?.rateDate, today);
                    if (fxIssue) issues.push(`환율 ${fxIssue}`);
                }
            }
            const comparable = Boolean(p.hasComparableCost && finite(p.costKrw) && p.costKrw > 0 && finite(p.unrealizedPnlKrw));
            if (!comparable) issues.push('원가 비교 불가');
            return { ...p, instrument, account, priceDate, comparable, issues,
                key: String(p.id || `position-${i}`), name: String(p.name || ticker || '이름 없음'),
                strategy: String(p.portKey || 'other'), strategyLabel: String(p.portLabel || '미분류'),
                value: finite(p.valuationKrw) ? Math.max(0, Number(p.valuationKrw)) : 0,
            };
        });
        const accounts = [...new Set(prepared.map(p => p.account))].sort((a, b) => a.localeCompare(b, 'ko'));
        const account = accounts.includes(options.account) ? options.account : '';
        const accountRows = prepared.filter(p => !account || p.account === account);
        const strategies = [...new Map(accountRows.map(p => [p.strategy, { key: p.strategy, label: p.strategyLabel }])).values()];
        const strategy = strategies.some(p => p.key === options.strategy) ? options.strategy : '';
        const rows = accountRows.filter(p => !strategy || p.strategy === strategy);
        const groups = new Map();
        rows.forEach(p => {
            const key = JSON.stringify([p.strategy, p.instrument]);
            if (!groups.has(key)) groups.set(key, { key, instrument: p.instrument, name: p.name, ticker: p.ticker,
                strategy: p.strategy, strategyLabel: p.strategyLabel, positions: [] });
            groups.get(key).positions.push(p);
        });
        const holdings = [...groups.values()].map(group => {
            const comparable = group.positions.filter(p => p.comparable);
            const cost = sum(comparable, 'costKrw'), pnl = comparable.length ? sum(comparable, 'unrealizedPnlKrw') : null;
            const complete = comparable.length === group.positions.length;
            return { ...group, value: sum(group.positions, 'value'), cost: cost || null, pnl,
                comparableValue: sum(comparable, 'value'), complete,
                returnPct: complete && cost > 0 ? pnl / cost * 100 : null,
                issues: [...new Set(group.positions.flatMap(p => p.issues))],
                colorReady: complete && group.positions.every(p => p.issues.length === 0),
            };
        }).sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
        const total = sum(rows, 'value');
        holdings.forEach(p => { p.weight = total > 0 ? p.value / total * 100 : null; });
        const instruments = new Map();
        rows.forEach(p => instruments.set(p.instrument, (instruments.get(p.instrument) || 0) + p.value));
        const comparable = rows.filter(p => p.comparable);
        const cost = sum(comparable, 'costKrw');
        const pnl = comparable.length ? sum(comparable, 'unrealizedPnlKrw') : null;
        const strategyGroups = strategies.map(s => ({ ...s, value: sum(holdings.filter(p => p.strategy === s.key), 'value') })).filter(s => s.value > 0);
        return { today, accounts, account, strategies, strategy, rows, holdings, strategyGroups,
            total: rows.length ? total : null, pnl, cost: cost || null,
            returnPct: cost > 0 ? pnl / cost * 100 : null,
            comparablePct: total > 0 ? sum(comparable, 'value') / total * 100 : null,
            marketPct: total > 0 ? sum(rows.filter(p => p.isMarketValued), 'value') / total * 100 : null,
            recentPct: total > 0 ? sum(rows.filter(p => p.isMarketValued && !p.issues.some(s => s.startsWith('시세') || s.startsWith('환율'))), 'value') / total * 100 : null,
            topThreePct: total > 0 ? [...instruments.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / total * 100 : null,
            issueCount: rows.filter(p => p.issues.length).length,
        };
    }
    // Binary weighted partition: each outer rectangle has exactly its value share.
    function layout(items, width = 100, height = 100, x = 0, y = 0) {
        const nodes = items.filter(p => finite(p.value) && p.value > 0).slice().sort((a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)));
        if (!nodes.length || width <= 0 || height <= 0) return [];
        if (nodes.length === 1) return [{ ...nodes[0], x, y, width, height }];
        const total = sum(nodes, 'value');
        let split = 1, running = nodes[0].value;
        while (split < nodes.length - 1 && Math.abs(running + nodes[split].value - total / 2) < Math.abs(running - total / 2)) running += nodes[split++].value;
        const ratio = running / total;
        return width >= height
            ? [...layout(nodes.slice(0, split), width * ratio, height, x, y), ...layout(nodes.slice(split), width * (1 - ratio), height, x + width * ratio, y)]
            : [...layout(nodes.slice(0, split), width, height * ratio, x, y), ...layout(nodes.slice(split), width, height * (1 - ratio), x, y + height * ratio)];
    }
    function color(value, ready = true) {
        if (!ready || !finite(value)) return '#555962';
        if (Number(value) === 0) return '#343943';
        const ramp = value > 0 ? ['#51383e', '#77404a', '#99414d', '#b53c4a', '#cf3545'] : ['#364858', '#365878', '#35648f', '#226bc1', '#155cb0'];
        return ramp[Math.min(4, Math.floor(Math.abs(value) / 5))];
    }
    root.InvestmentLabModel = Object.freeze({ build, layout, color, ageStatus });
})(globalThis);
