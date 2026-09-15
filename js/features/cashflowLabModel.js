// Read-only aggregates for the experimental visual cashflow tab.
(function (root) {
    'use strict';
    const DAY = 86400000;
    const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? Date.parse(`${value}T00:00:00Z`) / DAY : NaN;
    const median = values => {
        const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
        return sorted.length ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null;
    };
    function build(periods, selectedKey, today, isRepayment, analyze) {
        const ordered = [...periods].filter(p => Number.isFinite(day(p.startDate)) && day(p.endDate) >= day(p.startDate))
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
        const currentPeriod = ordered.find(p => p.startDate <= today && p.endDate >= today)
            || ordered.filter(p => p.startDate <= today).at(-1);
        const selected = ordered.find(p => p.key === selectedKey) || currentPeriod;
        const rowsFor = (period, count) => (period.transactions || []).filter(tx => {
            const date = day(tx.date);
            return Number.isFinite(Number(tx.amount)) && date >= day(period.startDate)
                && date <= Math.min(day(period.endDate), day(today))
                && (count === undefined || date < day(period.startDate) + count);
        });
        const summarize = period => {
            const rows = rowsFor(period);
            const known = period.startDate <= today && (rows.length > 0 || period.closeStatus === 'confirmed');
            const sum = predicate => rows.filter(predicate).reduce((n, tx) => n + Math.abs(Number(tx.amount)), 0);
            const income = rows.filter(tx => tx.type === '수입').reduce((n, tx) => n + Number(tx.amount), 0);
            const expense = sum(tx => tx.type === '지출');
            const repayment = sum(isRepayment);
            const observedDays = Math.max(0, Math.min(day(period.endDate), day(today)) - day(period.startDate) + 1);
            return { key: period.key, start: period.startDate, end: period.endDate, known, observedDays,
                dailySpending: known && observedDays > 0 ? (expense - repayment) / observedDays : null,
                income: known ? income : null, spending: known ? expense - repayment : null,
                repayment: known ? repayment : null, net: known ? income - expense : null,
                count: rows.length, latest: rows.map(tx => tx.date).sort().at(-1) || '—',
                status: period.closeStatus === 'confirmed' ? '마감 확인' : period.closeStatus === 'stale' ? '마감 변경됨' : '미확정',
                partial: period.startDate <= today && period.endDate >= today };
        };
        const monthly = Array.from({ length: 12 }, (_, index) => {
            const key = `2026-${String(index + 1).padStart(2, '0')}`;
            const period = ordered.find(p => p.key === key);
            return period ? summarize(period) : { key, known: false, income: null, spending: null, dailySpending: null, observedDays: 0, repayment: null, net: null, count: 0, start: '—', end: '—', latest: '—', status: '기록 없음', partial: false };
        });
        const available = monthly.filter(row => row.known);
        const annual = Object.fromEntries(['income', 'spending', 'repayment', 'net'].map(field => [field,
            available.length ? available.reduce((sum, row) => sum + row[field], 0) : null]));
        const analysis = selected ? analyze(ordered, selected.key, today, isRepayment, { includeChanged: true, minimumSamples: 1, historyLimit: 12 }) : null;
        const cohort = analysis?.samples.map(sample => ordered.find(p => p.key === sample.key)).filter(Boolean) || [];
        const consumption = rows => rows.filter(tx => tx.type === '지출' && !isRepayment(tx));
        const cumulative = (period, days) => {
            const daily = new Array(days).fill(0);
            consumption(rowsFor(period, days)).forEach(tx => { daily[day(tx.date) - day(period.startDate)] += Math.abs(Number(tx.amount)); });
            let total = 0;
            return daily.map(value => total += value);
        };
        const curves = { labels: [], dates: [], current: [], baseline: [] };
        let categories = [];
        if (analysis) {
            const series = cumulative(selected, analysis.duration);
            const history = cohort.map(p => cumulative(p, analysis.elapsed));
            for (let index = 0; index < analysis.duration; index++) {
                const date = new Date((day(selected.startDate) + index) * DAY).toISOString().slice(0, 10);
                curves.dates.push(date);
                curves.labels.push(`${Number(date.slice(5, 7))}/${Number(date.slice(8))}`);
                curves.current.push(analysis.hasCurrent && index < analysis.elapsed ? series[index] : null);
                curves.baseline.push(analysis.baseline !== null && index < analysis.elapsed ? median(history.map(values => values[index])) : null);
            }
            const groups = new Map();
            const accumulate = (period, field, divisor) => consumption(rowsFor(period, analysis.elapsed)).forEach(tx => {
                const category = String(tx.category || tx.cat || '미분류');
                if (!groups.has(category)) groups.set(category, { category, current: 0, average: analysis.baseline === null ? null : 0 });
                const row = groups.get(category);
                row[field] += Math.abs(Number(tx.amount)) / divisor;
            });
            accumulate(selected, 'current', 1);
            if (analysis.baseline !== null) cohort.forEach(p => accumulate(p, 'average', cohort.length));
            const ranked = [...groups.values()].sort((a, b) => Math.max(b.current, b.average || 0) - Math.max(a.current, a.average || 0));
            categories = ranked.slice(0, 6);
            if (ranked.length > 6) categories.push(ranked.slice(6).reduce((sum, row) => ({ category: '그 외 합계', current: sum.current + row.current, average: sum.average === null ? null : sum.average + row.average }), { category: '그 외 합계', current: 0, average: analysis.baseline === null ? null : 0 }));
        }
        const closedIncome = monthly.filter(row => row.known && row.end < today).map(row => row.income);
        const incomeRange = closedIncome.length ? { min: Math.min(...closedIncome), max: Math.max(...closedIncome), median: median(closedIncome), count: closedIncome.length } : null;
        const closed = available.filter(row => row.end < today);
        const spendingReference = median(closed.map(row => row.spending));
        const dailySpendingReference = median(closed.map(row => row.dailySpending));
        const maximumConsumption = Math.max(0, ...ordered.map(p => summarize(p).spending || 0));
        const paceAxisMax = Math.max(100000, Math.ceil(maximumConsumption * 1.05 / 100000) * 100000);
        return { monthly, annual, availableCount: available.length, selected, currentKey: currentPeriod?.key,
            isCurrent: !!selected && selected.startDate <= today && selected.endDate >= today,
            analysis, curves, categories, incomeRange, spendingReference, dailySpendingReference, paceAxisMax, today,
            periods: ordered.filter(p => p.startDate <= today).map(p => ({ key: p.key, label: p.label || p.key })),
            provisional: available.some(row => row.status !== '마감 확인') };
    }
    root.CashflowLabModel = Object.freeze({ build });
})(globalThis);
