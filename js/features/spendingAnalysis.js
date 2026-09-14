// Income-independent consumption comparison. No storage or network access.
(function (root) {
    'use strict';
    const DAY = 86400000;
    function day(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
        const time = Date.parse(`${value}T00:00:00Z`);
        return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / DAY : NaN;
    }
    function median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null;
    }
    function analyze(periods, key, today, isRepayment) {
        const selected = periods.find(period => period.key === key);
        if (!selected) return null;
        const start = day(selected.startDate), end = day(selected.endDate), now = day(today);
        if (![start, end, now].every(Number.isFinite) || end < start) return null;
        const elapsed = Math.max(0, Math.min(end, now) - start + 1);
        const totals = (period, days) => {
            const first = day(period.startDate);
            const rows = (period.transactions || []).filter(tx => {
                const date = day(tx.date);
                return Number.isFinite(Number(tx.amount)) && date >= first && date < first + days;
            });
            const expenses = rows.filter(tx => tx.type === '지출' && !isRepayment(tx));
            const consumption = expenses.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
            const fixed = expenses.filter(tx => (tx.category || tx.cat) === '고정비')
                .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
            return { consumption, fixed, other: consumption - fixed,
                income: rows.filter(tx => tx.type === '수입').reduce((sum, tx) => sum + Number(tx.amount), 0),
                count: rows.length, latest: rows.map(tx => tx.date).sort().at(-1) || null };
        };
        const history = periods.filter(period => {
            const first = day(period.startDate), last = day(period.endDate);
            return period.key !== key && Number.isFinite(first) && Number.isFinite(last) && last >= first
                && last < start && last < now && period.closeStatus !== 'stale'
                && (period.closeStatus === 'confirmed' || totals(period, last - first + 1).count > 0);
        }).sort((a, b) => b.endDate.localeCompare(a.endDate)).slice(0, 6);
        const samples = history.filter(period => day(period.endDate) - day(period.startDate) + 1 >= elapsed)
            .map(period => ({ key: period.key, startDate: period.startDate, endDate: period.endDate,
                confirmed: period.closeStatus === 'confirmed', ...totals(period, elapsed) }));
        const current = totals(selected, elapsed);
        const ready = elapsed > 0 && samples.length >= 3 && (current.count > 0 || selected.closeStatus === 'confirmed');
        const baseline = ready ? median(samples.map(sample => sample.consumption)) : null;
        const difference = baseline === null ? null : current.consumption - baseline;
        const incomes = history.map(period => totals(period, day(period.endDate) - day(period.startDate) + 1).income);
        return { current, hasCurrent: current.count > 0 || selected.closeStatus === 'confirmed', elapsed, duration: end - start + 1, baseline, difference,
            percent: baseline > 0 ? difference / baseline * 100 : null,
            samples, historyCount: history.length,
            incomeMedian: median(incomes), incomeMin: incomes.length ? Math.min(...incomes) : null,
            incomeMax: incomes.length ? Math.max(...incomes) : null,
            partial: now <= end, future: now < start,
            provisional: selected.closeStatus !== 'confirmed' || history.some(period => period.closeStatus !== 'confirmed'),
            startDate: selected.startDate, endDate: selected.endDate, today };
    }
    function render(model) {
        const container = root.document?.getElementById('cashflow-independent-analysis');
        if (!container) return;
        container.replaceChildren();
        const node = (tag, text, className, parent = container) => {
            const element = root.document.createElement(tag);
            if (text != null) element.textContent = text;
            if (className) element.className = className;
            parent.appendChild(element);
            return element;
        };
        const won = value => value === null ? '자료 부족' : `${Math.round(value).toLocaleString('ko-KR')}원`;
        node('h2', '소득과 소비, 따로 보기', 'text-lg font-bold text-gray-900');
        node('p', '수입이 달라져도 소비 비교 기준은 바뀌지 않습니다.', 'text-sm text-gray-500 mt-1');
        if (!model) { node('p', '분석할 기간 정보가 없습니다.', 'text-sm mt-3'); return; }
        node('p', `${model.startDate} ~ ${model.endDate} · ${model.elapsed}/${model.duration}일 경과 · 마지막 반영 거래 ${model.current.latest || '없음'}`, 'text-xs text-gray-500 mt-2');
        if (model.provisional) node('p', '잠정 비교 · 미확정 기록이 포함되어 있습니다. 거래 누락 여부를 먼저 확인하세요.', 'text-xs text-amber-700 mt-2');
        const grid = node('div', null, 'grid grid-cols-1 md:grid-cols-2 gap-3 mt-3');
        const card = (title, accent) => {
            const item = node('article', null, `rounded-xl border p-4 min-w-0 ${accent}`, grid);
            node('h3', title, 'font-bold text-base', item);
            return item;
        };
        const spending = card('소비 수준', 'border-rose-100 bg-rose-50');
        node('p', `현재까지 소비 ${model.hasCurrent ? won(model.current.consumption) : '기록 없음'}`, 'text-xl font-bold mt-2', spending);
        const verdict = model.future ? '아직 시작하지 않은 기간입니다.' : model.baseline === null
            ? '비교 보류 · 현재 기록과 비교 가능한 과거 3개 기간이 필요합니다.'
            : model.difference === 0 ? '과거 같은 경과일 소비의 중앙값과 같습니다.'
                : `과거 같은 경과일보다 ${won(Math.abs(model.difference))} ${model.difference > 0 ? '많이' : '적게'} 썼습니다.${model.percent === null ? ' (과거 기준 0원 · 비율 계산 안 함)' : ` (${Math.abs(model.percent).toFixed(1)}%)`}`;
        node('p', verdict, 'text-sm font-semibold mt-2', spending);
        node('p', `과거 첫 ${model.elapsed}일 소비 중앙값 ${won(model.baseline)} · ${model.samples.length}개 기간`, 'text-sm mt-2', spending);
        if (model.hasCurrent) node('p', `고정비 ${won(model.current.fixed)} / 그 외 소비 ${won(model.current.other)}`, 'text-sm mt-2', spending);
        node('p', '장부의 지출 중 상환 분류를 제외한 금액입니다. 이체로 기록한 저축은 포함하지 않습니다. 과거보다 많다는 것이 곧 과소비라는 뜻은 아닙니다.', 'text-xs text-gray-600 mt-3', spending);
        const income = card('소득 흐름', 'border-blue-100 bg-blue-50');
        node('p', `현재까지 소득 ${model.hasCurrent ? won(model.current.income) : '기록 없음'}`, 'text-xl font-bold mt-2', income);
        node('p', `과거 전체 기간 소득 중앙값 ${won(model.incomeMedian)}`, 'text-sm mt-3', income);
        node('p', `최저 ${won(model.incomeMin)} ~ 최고 ${won(model.incomeMax)} · ${model.historyCount}개 기간`, 'text-sm mt-2', income);
        node('p', '과거 소득은 종료된 기간 전체 합계입니다. 진행 중인 현재 합계와 증감률로 비교하지 않습니다.', 'text-xs text-gray-600 mt-3', income);
        node('p', '소득은 현금 여력을 확인하는 자료이며, 소비가 많고 적음을 판정하는 분모로 사용하지 않습니다.', 'text-xs text-gray-600 mt-2', income);
        const details = node('details', null, 'mt-3 text-sm text-gray-600');
        node('summary', '비교 근거와 주의사항', 'cursor-pointer py-2 font-semibold', details);
        node('p', `최근 종료된 최대 6개 기간 중 첫 ${model.elapsed}일을 비교할 수 있는 기간의 중앙값입니다. 기간이 짧으면 제외합니다.`, 'mt-2', details);
        for (const sample of model.samples) node('p', `${sample.key} (${sample.startDate} ~ ${sample.endDate}) · 첫 ${model.elapsed}일 소비 ${won(sample.consumption)} · ${sample.confirmed ? '마감 확인' : '미확정 기록'}`, 'text-xs mt-2', details);
        node('p', `${model.provisional ? '미확정 기록이 포함된 잠정 분석입니다. ' : ''}거래 누락·환불 분류·고정비 결제일 차이로 비교가 달라질 수 있습니다. 빈 미확정 기간과 변경된 마감은 제외합니다.`, 'text-xs mt-3', details);
        node('p', '실제 반영된 거래 기준이며 기록의 완전성을 보장하지 않습니다. 예산이나 적정 소비 한도는 설정하지 않았습니다. 금액 부호만으로 환불을 추정하지 않고 기존 장부 분류를 따릅니다.', 'text-xs mt-2', details);
        if (model.partial && !model.future) node('p', '진행 중인 기간입니다. 예정 지출은 합산하지 않았으며 월말 예상치나 소득 대비 소비율로 평가하지 않습니다.', 'text-xs text-gray-600 mt-3');
    }
    root.SpendingAnalysis = Object.freeze({ analyze, render });
})(globalThis);
