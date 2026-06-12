// App event binding, navigation, service worker registration, and bootstrapping extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

// PWA ServiceWorker 등록
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => console.log('PWA ServiceWorker 등록 성공'))
                .catch(error => console.log('PWA ServiceWorker 등록 실패:', error));
        });
    }

    // ==========================================
    // UI 유틸리티
    // ==========================================

document.getElementById('btn-sync').addEventListener('click', () => fetchSheetData(false));
    document.getElementById('tx-import-file')?.addEventListener('change', (e) => handleTxImportFile(e.target.files?.[0]));
    document.getElementById('tx-import-source')?.addEventListener('input', () => {
        if (txImportRawRows) rebuildTxImportCandidates();
    });

    document.getElementById('btn-sort-tx').addEventListener('click', () => {
        txSortOrder = txSortOrder === 'desc' ? 'asc' : 'desc';
        const sortIcon = document.querySelector('#btn-sort-tx i');
        const sortText = document.getElementById('sort-tx-text');
        if (txSortOrder === 'desc') {
            sortIcon.className = 'fas fa-sort-amount-down'; sortText.textContent = '최신순';
        } else {
            sortIcon.className = 'fas fa-sort-amount-up'; sortText.textContent = '과거순';
        }
        renderCashFlow();
    });

    // Cashflow view controls and add-on rendering live in js/features/cashflowControls.js.

    const views = {
        'dashboard-view': document.getElementById('dashboard-view'), 'portfolio-view': document.getElementById('portfolio-view'),
        'career-view': document.getElementById('career-view'), 'project-view': document.getElementById('project-view'),
        'life-view': document.getElementById('life-view'),
        'weekly-timetable-view': document.getElementById('weekly-timetable-view'),
        'routine-checklist-view': document.getElementById('routine-checklist-view'),
        'vacation-plan-view': document.getElementById('vacation-plan-view'),
        'stats-view': document.getElementById('stats-view'), 'asset-view': document.getElementById('asset-view'),
        'realestate-view': document.getElementById('realestate-view'), 'invest-detail-view': document.getElementById('invest-detail-view')
    };

    const viewContextMeta = {
        'dashboard-view': { label: 'Finance Goal', title: 'Finance Cockpit' },
        'career-view': { label: 'Career Goal', title: 'Career Cockpit' },
        'project-view': { label: 'Project Goal', title: 'Project Cockpit' },
        'life-view': { label: 'Life Goal', title: 'Life Cockpit' },
        'weekly-timetable-view': { label: 'Life Tool', title: 'Weekly Timetable' },
        'routine-checklist-view': { label: 'Life Tool', title: 'Routine Checklist' },
        'vacation-plan-view': { label: 'Life Tool', title: 'Vacation Plan' },
        'portfolio-view': { label: 'Finance Tool', title: '포트폴리오' },
        'stats-view': { label: 'Finance Tool', title: '현금 흐름' },
        'asset-view': { label: 'Finance Tool', title: '장기 자산' },
        'realestate-view': { label: 'Finance Tool', title: '부동산 / 청약' },
        'invest-detail-view': { label: 'Finance Tool', title: '투자 상세' }
    };

    const financeToolViews = new Set(['portfolio-view', 'stats-view', 'asset-view', 'realestate-view', 'invest-detail-view']);
    const lifeToolViews = new Set(['weekly-timetable-view', 'routine-checklist-view', 'vacation-plan-view']);
    const mobileToolNav = document.getElementById('mobile-tool-nav');
    const mobileToolGroups = {
        'dashboard-view': [
            { target: 'portfolio-view', icon: 'fa-briefcase', label: '포트폴리오' },
            { target: 'stats-view', icon: 'fa-money-bill-transfer', label: '현금' },
            { target: 'asset-view', icon: 'fa-chart-area', label: '자산' },
            { target: 'realestate-view', icon: 'fa-home', label: '부동산' }
        ],
        'career-view': [
            { target: 'career-view', icon: 'fa-id-badge', label: '커리어' }
        ],
        'project-view': [
            { target: 'project-view', icon: 'fa-folder-open', label: '프로젝트' }
        ],
        'life-view': [
            { target: 'weekly-timetable-view', icon: 'fa-calendar-week', label: '주간' },
            { target: 'routine-checklist-view', icon: 'fa-list-check', label: '루틴' },
            { target: 'vacation-plan-view', icon: 'fa-plane-departure', label: '휴가' }
        ]
    };

    function resolveActiveGoalTarget(targetId) {
        if (financeToolViews.has(targetId)) return 'dashboard-view';
        if (lifeToolViews.has(targetId)) return 'life-view';
        return targetId;
    }

    function renderMobileToolNavigation(activeGoalTarget, targetId) {
        if (!mobileToolNav) return;
        const toolItems = mobileToolGroups[activeGoalTarget] || mobileToolGroups['dashboard-view'];
        mobileToolNav.innerHTML = toolItems.map(item => {
            const isActive = item.target === targetId;
            const stateClasses = isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600';
            return `
                <a href="#" data-target="${item.target}" class="mobile-nav-link flex flex-col items-center justify-center w-full h-full ${stateClasses} transition-colors min-w-0">
                    <i class="fas ${item.icon} text-lg mb-1"></i>
                    <span class="text-[9px] font-medium truncate max-w-full px-1">${item.label}</span>
                </a>
            `;
        }).join('');
    }

    function updateAppContext(targetId) {
        const meta = viewContextMeta[targetId] || viewContextMeta['dashboard-view'];
        const labelEl = document.getElementById('app-context-label');
        const titleEl = document.getElementById('app-context-title');
        if (labelEl) labelEl.textContent = meta.label;
        if (titleEl) titleEl.textContent = meta.title;
    }

    function updateGoalNavigation(targetId) {
        const activeGoalTarget = resolveActiveGoalTarget(targetId);
        document.querySelectorAll('.goal-link').forEach(nav => {
            const isActive = nav.getAttribute('data-target') === activeGoalTarget;
            nav.classList.toggle('text-indigo-700', isActive);
            nav.classList.toggle('bg-indigo-50', isActive);
            nav.classList.toggle('font-semibold', isActive);
            nav.classList.toggle('border', isActive);
            nav.classList.toggle('border-indigo-100', isActive);
            nav.classList.toggle('text-gray-600', !isActive);
            nav.classList.toggle('hover:bg-gray-50', !isActive);
            nav.classList.toggle('font-medium', !isActive);
        });
        document.querySelectorAll('.mobile-goal-link').forEach(nav => {
            const isActive = nav.getAttribute('data-target') === activeGoalTarget;
            nav.classList.toggle('bg-indigo-600', isActive);
            nav.classList.toggle('text-white', isActive);
            nav.classList.toggle('border-indigo-600', isActive);
            nav.classList.toggle('shadow-sm', isActive);
            nav.classList.toggle('bg-white', !isActive);
            nav.classList.toggle('text-gray-500', !isActive);
            nav.classList.toggle('border-gray-100', !isActive);
        });
        renderMobileToolNavigation(activeGoalTarget, targetId);
    }

    function switchView(targetId) {
        useMonthScopeForView(targetId);
        activeViewId = targetId;
        updateAppContext(targetId);
        updateGoalNavigation(targetId);
        document.querySelectorAll('.nav-link').forEach(nav => {
            if(nav.getAttribute('data-target') === targetId) { nav.classList.add('text-indigo-600', 'bg-indigo-50'); nav.classList.remove('text-gray-600', 'hover:bg-gray-50'); }
            else { nav.classList.remove('text-indigo-600', 'bg-indigo-50'); nav.classList.add('text-gray-600', 'hover:bg-gray-50'); }
        });
        document.querySelectorAll('.mobile-nav-link').forEach(nav => {
            if(nav.getAttribute('data-target') === targetId) { nav.classList.add('text-indigo-600'); nav.classList.remove('text-gray-400', 'hover:text-gray-600'); }
            else { nav.classList.remove('text-indigo-600'); nav.classList.add('text-gray-400', 'hover:text-gray-600'); }
        });

        Object.values(views).forEach(v => { if(v) v.classList.add('hidden'); });
        if(views[targetId]) views[targetId].classList.remove('hidden');

        // 💡 [수정] FAB 표시 제어: '현금 흐름(stats-view)' 탭에서만 보이게 함
        const fab = document.getElementById('fab-add-tx');
        if(fab) {
            if(targetId === 'stats-view') fab.classList.remove('hidden');
            else fab.classList.add('hidden');
        }

        if (targetId === 'realestate-view' && window.reMap) {
            setTimeout(() => window.reMap.invalidateSize(), 50);
        }
        if (targetId === 'stats-view') toggleManageView(false);

        setTimeout(() => {
            if (targetId === 'dashboard-view') renderSections({ financeSummary: true, portfolio: true });
            else if (targetId === 'portfolio-view') renderSections({ portfolio: true });
            else if (targetId === 'stats-view') renderSections({ cashFlow: true });
            else if (targetId === 'asset-view') renderSections({ financeSummary: true });
            else if (targetId === 'realestate-view') renderSections({ realEstate: true });
            else if (targetId === 'weekly-timetable-view') {
                window.WeeklyTimetableFeature?.bindControls();
                window.WeeklyTimetableFeature?.render();
            }
            else if (targetId === 'vacation-plan-view') {
                window.VacationPlanFeature?.bindControls();
                window.VacationPlanFeature?.render();
            }
        }, 20);
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => { e.preventDefault(); switchView(e.currentTarget.getAttribute('data-target')); });
    });

    mobileToolNav?.addEventListener('click', (e) => {
        const link = e.target.closest('.mobile-nav-link');
        if (!link || !mobileToolNav.contains(link)) return;
        e.preventDefault();
        switchView(link.getAttribute('data-target'));
    });

    renderMobileToolNavigation(resolveActiveGoalTarget(activeViewId), activeViewId);

    document.getElementById('asset-year-filter')?.addEventListener('change', (e) => {
        currentAssetFilter = e.target.value; renderFinanceSummary();
    });

    document.addEventListener('keydown', (e) => {
        if (document.getElementById('settings-modal').classList.contains('hidden') === false) return;
        if (document.getElementById('tx-modal').classList.contains('hidden') === false) return;
        if (document.getElementById('tx-import-modal')?.classList.contains('hidden') === false) return;
        if (document.getElementById('pf-edit-modal').classList.contains('hidden') === false) return;

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const navLinks = Array.from(document.querySelectorAll('.nav-link'));
            const activeIndex = navLinks.findIndex(link => link.classList.contains('bg-indigo-50'));
            if (activeIndex !== -1) {
                let nextIndex = activeIndex;
                if (e.key === 'ArrowUp' && activeIndex > 0) nextIndex--;
                if (e.key === 'ArrowDown' && activeIndex < navLinks.length - 1) nextIndex++;
                if (nextIndex !== activeIndex) { e.preventDefault(); switchView(navLinks[nextIndex].getAttribute('data-target')); }
            }
        }
        const prevMonthButton = document.getElementById('btn-prev-month');
        const nextMonthButton = document.getElementById('btn-next-month');
        if (activeViewId === 'stats-view' && e.key === 'ArrowLeft' && prevMonthButton && !prevMonthButton.disabled) prevMonthButton.click();
        else if (activeViewId === 'stats-view' && e.key === 'ArrowRight' && nextMonthButton && !nextMonthButton.disabled) nextMonthButton.click();
    });

    function updateNavigationButtons() {
        const keys = getMonthKeys();
        const idx = keys.indexOf(currentMonthKey);
        const btnPrev = document.getElementById('btn-prev-month');
        const btnNext = document.getElementById('btn-next-month');
        if (!btnPrev || !btnNext) return;
        btnPrev.disabled = idx <= 0; btnNext.disabled = idx === -1 || idx >= keys.length - 1;
    }

    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
        const keys = getMonthKeys(); const idx = keys.indexOf(currentMonthKey);
        if (idx > 0) { currentMonthKey = keys[idx - 1]; cashFlowMonthKey = currentMonthKey; renderSections({ cashFlow: true }); }
    });

    document.getElementById('btn-next-month')?.addEventListener('click', () => {
        const keys = getMonthKeys(); const idx = keys.indexOf(currentMonthKey);
        if (idx !== -1 && idx < keys.length - 1) { currentMonthKey = keys[idx + 1]; cashFlowMonthKey = currentMonthKey; renderSections({ cashFlow: true }); }
    });

    window.toggleAccordion = function(btn) {
        const content = btn.nextElementSibling; const icon = btn.querySelector('.accordion-icon');
        content.classList.toggle('open'); icon.classList.toggle('rotate');
    };

    // Quant strategy behavior lives in js/features/quantEngine.js.

    // Portfolio and investment detail rendering lives in js/features/portfolioViews.js.

    // Finance summary, asset trend, cashflow rendering, and roadmap helpers live in js/features/financeViews.js.

    // Real-estate subscription schedule and map rendering lives in js/features/realEstate.js.

    window.addEventListener('DOMContentLoaded', () => {
        loadSettings();
        fetchSheetData(true);
    });
