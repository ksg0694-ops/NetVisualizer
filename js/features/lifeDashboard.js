(function (root) {
    const utils = root.AppUtils;
    let isBound = false;

    function renderTask(task) {
        const domainTone = task.domain === 'finance'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
            : task.domain === 'career'
                ? 'text-sky-700 bg-sky-50 border-sky-100'
                : 'text-indigo-700 bg-indigo-50 border-indigo-100';
        const stepText = task.stepTotal > 0 ? `${task.stepDone}/${task.stepTotal} 스텝` : '스텝 없음';
        return `
            <button type="button" data-life-task-id="${utils.escapeAttr(task.id)}" class="w-full flex items-center gap-3 py-2.5 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                <span class="h-5 w-5 shrink-0 rounded-md border border-gray-300 bg-white flex items-center justify-center" aria-hidden="true"></span>
                <span class="min-w-0 flex-1">
                    <span class="block text-sm font-bold text-gray-800 truncate">${utils.escapeHtml(task.title)}</span>
                    <span class="block mt-0.5 text-[11px] text-gray-400">${utils.escapeHtml(stepText)}</span>
                </span>
                <span class="rounded-md border px-2 py-1 text-[10px] font-bold ${domainTone}">${utils.escapeHtml(task.domainLabel)}</span>
            </button>
        `;
    }

    function getSnapshot() {
        root.ChecklistFeature?.refresh?.();
        return root.ChecklistFeature?.getDashboardSnapshot?.()
            || { open: 0, done: 0, total: 0, progress: 0, tasks: [] };
    }

    function render() {
        const rootEl = document.getElementById('life-view');
        if (!rootEl) return;
        bindControls(rootEl);
        const todo = getSnapshot();
        const taskHtml = todo.tasks.length
            ? todo.tasks.map(renderTask).join('')
            : '<p class="py-8 text-center text-sm text-gray-400">확인할 할 일이 없습니다.</p>';
        rootEl.innerHTML = `
            <div class="mb-4 flex flex-col gap-1">
                <p class="text-[11px] font-bold text-indigo-500">생활 관리</p>
                <p class="text-sm text-gray-500">열린 할 일과 스텝 진행상태를 한눈에 확인합니다.</p>
            </div>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3 mb-4">
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <p class="text-[11px] font-bold text-gray-500">미완료</p>
                    <p class="mt-1 text-xl font-bold text-gray-900">${todo.open}</p>
                    <p class="mt-1 text-[11px] text-gray-400">현재 열린 할 일</p>
                </article>
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <p class="text-[11px] font-bold text-gray-500">완료</p>
                    <p class="mt-1 text-xl font-bold text-emerald-700">${todo.done}</p>
                    <p class="mt-1 text-[11px] text-gray-400">완료된 할 일</p>
                </article>
                <article class="bg-white border border-gray-200 rounded-lg p-3">
                    <div class="flex items-center justify-between gap-2">
                        <p class="text-[11px] font-bold text-gray-500">전체 진행률</p>
                        <p class="text-sm font-black text-indigo-700">${todo.progress}%</p>
                    </div>
                    <div class="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div class="h-full rounded-full bg-indigo-500 transition-all" style="width:${todo.progress}%"></div>
                    </div>
                    <p class="mt-2 text-[11px] text-gray-400">${todo.done}/${todo.total} 완료</p>
                </article>
            </div>
            <section class="bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-0 pb-8">
                <div class="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                    <div>
                        <h3 class="text-sm font-bold text-gray-900">할 일</h3>
                        <p class="text-[11px] text-gray-400">현재 순서 기준 최대 5개</p>
                    </div>
                    <button type="button" data-life-open-todo class="text-xs font-bold text-indigo-600 hover:text-indigo-800">전체 보기</button>
                </div>
                <div>${taskHtml}</div>
            </section>
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
        });
    }

    root.LifeDashboardFeature = Object.freeze({ render, getSnapshot });
})(window);
