(function (root) {
    const utils = root.AppUtils;
    let isBound = false;

    function renderTask(task) {
        const domainTone = task.domain === 'finance'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
            : task.domain === 'career'
                ? 'text-sky-700 bg-sky-50 border-sky-100'
                : 'text-indigo-700 bg-indigo-50 border-indigo-100';
        return `
            <button type="button" data-life-task-id="${utils.escapeAttr(task.id)}" class="w-full flex items-center gap-3 py-2.5 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                <span class="h-5 w-5 shrink-0 rounded-md border border-gray-300 bg-white flex items-center justify-center" aria-hidden="true"></span>
                <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold text-gray-800 truncate">${utils.escapeHtml(task.title)}</span>
                    <span class="block mt-0.5 text-[11px] text-gray-400">${utils.escapeHtml(task.dueDate)} · ${utils.escapeHtml(task.domainLabel)}</span>
                </span>
                <span class="rounded-md border px-2 py-1 text-[10px] font-bold ${domainTone}">${utils.escapeHtml(task.domainLabel)}</span>
            </button>
        `;
    }

    function getSnapshot() {
        root.ChecklistFeature?.refresh?.();
        root.HealthTrackerFeature?.refresh?.();
        const todo = root.ChecklistFeature?.getDashboardSnapshot?.() || { open: 0, dueToday: 0, overdue: 0, tasks: [] };
        const health = root.HealthTrackerFeature?.getDashboardSnapshot?.() || { latest: null, loggedToday: false, delta: 0 };
        return { todo, health };
    }

    function render() {
        const rootEl = document.getElementById('life-view');
        if (!rootEl) return;
        bindControls(rootEl);
        const { todo, health } = getSnapshot();
        const latestWeight = health.latest ? `${health.latest.weightKg.toFixed(1)}kg` : '-';
        const weightMeta = health.loggedToday
            ? '오늘 기록 완료'
            : health.latest
                ? `최근 ${health.latest.date}`
                : '첫 기록이 필요합니다';
        const taskHtml = todo.tasks.length
            ? todo.tasks.map(renderTask).join('')
            : '<p class="py-8 text-center text-sm text-gray-400">오늘 확인할 할 일이 없습니다.</p>';
        rootEl.innerHTML = `
            <div class="mb-4 flex flex-col gap-1">
                <p class="text-[11px] font-bold text-indigo-500">오늘의 생활 상태</p>
                <p class="text-sm text-gray-500">할 일과 건강 기록에서 오늘 필요한 것만 모았습니다.</p>
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <p class="text-[11px] font-bold text-gray-500">미완료</p>
                    <p class="mt-1 text-xl font-bold text-gray-900">${todo.open}</p>
                    <p class="mt-1 text-[11px] text-gray-400">전체 열린 할 일</p>
                </article>
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <p class="text-[11px] font-bold text-gray-500">오늘 마감</p>
                    <p class="mt-1 text-xl font-bold ${todo.dueToday ? 'text-indigo-700' : 'text-gray-900'}">${todo.dueToday}</p>
                    <p class="mt-1 text-[11px] text-gray-400">오늘 처리할 항목</p>
                </article>
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <p class="text-[11px] font-bold text-gray-500">기한 지남</p>
                    <p class="mt-1 text-xl font-bold ${todo.overdue ? 'text-rose-700' : 'text-gray-900'}">${todo.overdue}</p>
                    <p class="mt-1 text-[11px] text-gray-400">우선 정리 필요</p>
                </article>
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <p class="text-[11px] font-bold text-gray-500">최근 체중</p>
                    <p class="mt-1 text-xl font-bold text-gray-900">${utils.escapeHtml(latestWeight)}</p>
                    <p class="mt-1 text-[11px] ${health.loggedToday ? 'text-emerald-600' : 'text-gray-400'}">${utils.escapeHtml(weightMeta)}</p>
                </article>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 pb-8">
                <section class="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-0">
                    <div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                        <div>
                            <h3 class="text-sm font-bold text-gray-900">오늘 할 일</h3>
                            <p class="text-[11px] text-gray-400">기한과 우선순위 기준 최대 5개</p>
                        </div>
                        <button type="button" data-life-open-todo class="text-xs font-bold text-indigo-600 hover:text-indigo-800">전체 보기</button>
                    </div>
                    <div>${taskHtml}</div>
                </section>
                <div>
                    <section class="bg-white border border-gray-200 rounded-lg px-4 py-3">
                        <div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                            <div>
                                <h3 class="text-sm font-bold text-gray-900">건강 기록</h3>
                                <p class="text-[11px] text-gray-400">체중과 7일 평균</p>
                            </div>
                            <button type="button" data-life-open-health class="text-xs font-bold text-rose-600 hover:text-rose-800">기록하기</button>
                        </div>
                        <div class="py-3 flex items-end justify-between gap-3">
                            <div>
                                <p class="text-2xl font-bold text-gray-900">${utils.escapeHtml(latestWeight)}</p>
                                <p class="mt-1 text-[11px] text-gray-400">${health.average ? `7일 평균 ${health.average.toFixed(1)}kg` : '평균 계산 대기'}</p>
                            </div>
                            <p class="text-xs font-bold ${health.delta > 0 ? 'text-rose-600' : health.delta < 0 ? 'text-emerald-600' : 'text-gray-400'}">${health.delta ? `${health.delta > 0 ? '+' : ''}${health.delta.toFixed(1)}kg` : '변화 없음'}</p>
                        </div>
                    </section>
                </div>
            </div>
        `;
    }

    function bindControls(rootEl) {
        if (isBound) return;
        isBound = true;
        rootEl.addEventListener('click', (event) => {
            const taskButton = event.target.closest('[data-life-task-id]');
            if (taskButton) {
                root.ChecklistFeature?.selectTask?.(taskButton.dataset.lifeTaskId);
                root.switchView?.('routine-checklist-view');
                return;
            }
            if (event.target.closest('[data-life-open-todo]')) root.switchView?.('routine-checklist-view');
            else if (event.target.closest('[data-life-open-health]')) root.switchView?.('health-view');
        });
    }

    root.LifeDashboardFeature = Object.freeze({ render, getSnapshot });
})(window);
