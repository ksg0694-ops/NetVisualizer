// App event binding, navigation, service worker registration, and bootstrapping extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

// PWA ServiceWorker ?????濡?씀?濾????ㅼ굡???
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => console.log('PWA ServiceWorker registered'))
                .catch(error => console.log('PWA ServiceWorker registration failed:', error));
        });
    }

    // ==========================================
    // UI ????鶯ㅺ동????????????좊틣???欲꼲???
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
            sortIcon.className = 'fas fa-sort-amount-up'; sortText.textContent = '오래된순';
        }
        renderCashFlow();
    });

    // Cashflow view controls and add-on rendering live in js/features/cashflowControls.js.

    const views = {
        'dashboard-view': document.getElementById('dashboard-view'), 'portfolio-view': document.getElementById('portfolio-view'),
        'career-view': document.getElementById('career-view'), 'project-view': document.getElementById('project-view'),
        'life-view': document.getElementById('life-view'),
        'routine-checklist-view': document.getElementById('routine-checklist-view'),
        'health-view': document.getElementById('health-view'),
        'personal-cfo-view': document.getElementById('personal-cfo-view'),
        'stats-view': document.getElementById('stats-view'), 'cashflow-view': document.getElementById('cashflow-view'),
        'asset-view': document.getElementById('asset-view'),
        'realestate-view': document.getElementById('realestate-view'), 'invest-detail-view': document.getElementById('invest-detail-view')
    };

    const viewContextMeta = {
        'dashboard-view': { label: '재무 목표', title: '재무 홈' },
        'life-view': { label: '생활 관리', title: '생활 홈' },
        'routine-checklist-view': { label: '생활 도구', title: '할 일' },
        'health-view': { label: '생활 도구', title: '건강 기록' },
        'personal-cfo-view': { label: '재무 도구', title: '개인 CFO' },
        'portfolio-view': { label: '재무 도구', title: '포트폴리오' },
        'stats-view': { label: '재무 도구', title: 'Monthly Report' },
        'cashflow-view': { label: '재무 도구', title: '현금흐름' },
        'asset-view': { label: '재무 도구', title: '장기 목표' },
        'realestate-view': { label: '재무 도구', title: '부동산' },
        'invest-detail-view': { label: '재무 도구', title: '투자 상세' }
    };

    const financeToolViews = new Set(['personal-cfo-view', 'portfolio-view', 'stats-view', 'cashflow-view', 'asset-view', 'realestate-view', 'invest-detail-view']);
    const lifeToolViews = new Set(['health-view', 'routine-checklist-view']);
    const mobileToolNav = document.getElementById('mobile-tool-nav');
    const mobileToolGroups = {
        'dashboard-view': [
            { target: 'stats-view', icon: 'fa-file-invoice-dollar', label: 'Report' },
            { target: 'personal-cfo-view', icon: 'fa-diagram-project', label: '개인 CFO' },
            { target: 'cashflow-view', icon: 'fa-arrow-right-arrow-left', label: '현금흐름' },
            { target: 'portfolio-view', icon: 'fa-briefcase', label: '포트폴리오' },
            { target: 'asset-view', icon: 'fa-bullseye', label: '장기 목표' }
        ],
        'life-view': [
            { target: 'health-view', icon: 'fa-heart-pulse', label: '건강' },
            { target: 'routine-checklist-view', icon: 'fa-list-check', label: '할 일' }
        ]
    };

    function resolveActiveGoalTarget(targetId) {
        if (financeToolViews.has(targetId)) return 'dashboard-view';
        if (lifeToolViews.has(targetId)) return 'life-view';
        return targetId;
    }

    function updateGoalHomeButton(targetId) {
        const button = document.getElementById('btn-goal-home');
        const label = document.getElementById('btn-goal-home-label');
        if (!button) return;
        const homeTarget = resolveActiveGoalTarget(targetId);
        const shouldShow = homeTarget !== targetId;
        button.dataset.target = homeTarget;
        button.classList.toggle('hidden', !shouldShow);
        button.classList.toggle('flex', shouldShow);
        const homeLabel = homeTarget === 'dashboard-view'
            ? '재무 홈'
            : homeTarget === 'life-view'
                ? '생활 홈'
                : '홈';
        if (label) label.textContent = homeLabel;
        button.title = `${homeLabel}으로 돌아가기`;
        button.setAttribute('aria-label', button.title);
    }

    function renderMobileToolNavigation(activeGoalTarget, targetId) {
        if (!mobileToolNav) return;
        let toolItems = mobileToolGroups[activeGoalTarget] || mobileToolGroups['dashboard-view'];
        if (activeGoalTarget === 'life-view') {
            toolItems = [
                { target: 'health-view', icon: 'fa-heart-pulse', label: '건강' },
                { target: 'routine-checklist-view', icon: 'fa-list-check', label: '할 일' }
            ];
        }
        mobileToolNav.innerHTML = toolItems.map(item => {
            const isActive = item.target === targetId;
            const stateClasses = isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600';
            return `
                <a href="#" data-target="${item.target}" class="mobile-nav-link flex flex-col items-center justify-center w-full h-full ${stateClasses} transition-colors min-w-0">
                    <i class="fas ${item.icon} text-lg mb-1"></i>
                    <span class="text-[10px] font-medium truncate max-w-full px-1">${item.label}</span>
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
        updateGoalHomeButton(targetId);
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

    function normalizeGoalShellText() {
        return;
        const lifeTitle = document.querySelector('#life-view h2');
        if (lifeTitle) {
            const description = lifeTitle.nextElementSibling;
            if (description) description.textContent = '??????諛몄カ?????댁뢿援?????????? ??? ??????????????????????????????耀붾굝????????????饔낅떽???????';
        }
    }

    function switchView(targetId) {
        if (targetId === 'project-view' || targetId === 'career-view') targetId = 'dashboard-view';
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
        if (targetId === 'life-view') window.LifeDashboardFeature?.render();
        if (targetId === 'routine-checklist-view') window.ChecklistFeature?.render({ skipRemoteLoad: true });
        if (targetId === 'personal-cfo-view') window.PersonalCfoFeature?.render();
        if(views[targetId]) views[targetId].classList.remove('hidden');

        // ???[?????怨뚮뼺?됰뗀??? FAB ???????????? '?????????????????stats-view)' ??????饔낅떽????????????怨뺤른??????怨쀫뮡?壤굿??곸읆????ル폆???
        const fab = document.getElementById('fab-add-tx');
        if(fab) {
            if(targetId === 'cashflow-view') fab.classList.remove('hidden');
            else fab.classList.add('hidden');
        }

        if (targetId === 'realestate-view' && window.reMap) {
            setTimeout(() => window.reMap.invalidateSize(), 50);
        }
        if (targetId === 'cashflow-view') toggleManageView(false);

        setTimeout(() => {
            if (targetId === 'dashboard-view') renderSections({ financeSummary: true, portfolio: true });
            else if (targetId === 'life-view') window.LifeDashboardFeature?.render();
            else if (targetId === 'portfolio-view') renderSections({ portfolio: true });
            else if (targetId === 'stats-view' || targetId === 'cashflow-view') renderSections({ cashFlow: true });
            else if (targetId === 'asset-view') renderSections({ financeSummary: true });
            else if (targetId === 'personal-cfo-view') window.PersonalCfoFeature?.render();
            else if (targetId === 'realestate-view') renderSections({ realEstate: true });
            else if (targetId === 'health-view') {
                window.HealthTrackerFeature?.bindControls();
                window.HealthTrackerFeature?.render();
            }
            else if (targetId === 'routine-checklist-view') {
                window.ChecklistFeature?.bindControls();
                window.ChecklistFeature?.render();
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

    document.getElementById('btn-goal-home')?.addEventListener('click', (event) => {
        const target = event.currentTarget.dataset.target || resolveActiveGoalTarget(activeViewId);
        switchView(target);
    });

    renderMobileToolNavigation(resolveActiveGoalTarget(activeViewId), activeViewId);
    updateGoalHomeButton(activeViewId);

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
        const reportPrevMonthButton = document.getElementById('btn-report-prev-month');
        const reportNextMonthButton = document.getElementById('btn-report-next-month');
        if (activeViewId === 'cashflow-view' && e.key === 'ArrowLeft' && prevMonthButton && !prevMonthButton.disabled) prevMonthButton.click();
        else if (activeViewId === 'cashflow-view' && e.key === 'ArrowRight' && nextMonthButton && !nextMonthButton.disabled) nextMonthButton.click();
        else if (activeViewId === 'stats-view' && e.key === 'ArrowLeft' && reportPrevMonthButton && !reportPrevMonthButton.disabled) reportPrevMonthButton.click();
        else if (activeViewId === 'stats-view' && e.key === 'ArrowRight' && reportNextMonthButton && !reportNextMonthButton.disabled) reportNextMonthButton.click();
    });

    function updateNavigationButtons() {
        const keys = getMonthKeys();
        const idx = keys.indexOf(currentMonthKey);
        const btnPrev = document.getElementById('btn-prev-month');
        const btnNext = document.getElementById('btn-next-month');
        const reportPrev = document.getElementById('btn-report-prev-month');
        const reportNext = document.getElementById('btn-report-next-month');
        if (btnPrev) btnPrev.disabled = idx <= 0;
        if (btnNext) btnNext.disabled = idx === -1 || idx >= keys.length - 1;
        if (reportPrev) reportPrev.disabled = idx <= 0;
        if (reportNext) reportNext.disabled = idx === -1 || idx >= keys.length - 1;
    }

    document.getElementById('btn-prev-month')?.addEventListener('click', () => {
        const keys = getMonthKeys(); const idx = keys.indexOf(currentMonthKey);
        if (idx > 0) { currentMonthKey = keys[idx - 1]; cashFlowMonthKey = currentMonthKey; renderSections({ cashFlow: true }); }
    });

    document.getElementById('btn-next-month')?.addEventListener('click', () => {
        const keys = getMonthKeys(); const idx = keys.indexOf(currentMonthKey);
        if (idx !== -1 && idx < keys.length - 1) { currentMonthKey = keys[idx + 1]; cashFlowMonthKey = currentMonthKey; renderSections({ cashFlow: true }); }
    });

    document.getElementById('btn-report-prev-month')?.addEventListener('click', () => {
        const keys = getMonthKeys(); const idx = keys.indexOf(currentMonthKey);
        if (idx > 0) { currentMonthKey = keys[idx - 1]; cashFlowMonthKey = currentMonthKey; renderSections({ cashFlow: true }); }
    });

    document.getElementById('btn-report-next-month')?.addEventListener('click', () => {
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

    window.addEventListener('DOMContentLoaded', async () => {
        normalizeGoalShellText();
        loadSettings();
        if (typeof initAuth === 'function') await initAuth();
        fetchSheetData(true);
    });
