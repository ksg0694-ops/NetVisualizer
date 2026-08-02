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
        'routine-checklist-view': document.getElementById('routine-checklist-view'),
        'health-view': document.getElementById('health-view'),
        'personal-cfo-view': document.getElementById('personal-cfo-view'),
        'stats-view': document.getElementById('stats-view'), 'cashflow-view': document.getElementById('cashflow-view'),
        'asset-view': document.getElementById('asset-view'),
        'realestate-view': document.getElementById('realestate-view'), 'invest-detail-view': document.getElementById('invest-detail-view')
    };

    const viewContextMeta = {
        'dashboard-view': { label: '재무 목표', title: '재무 홈' },
        'routine-checklist-view': { label: '도구', title: '할 일' },
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
    const mobileNavigationDialog = document.getElementById('mobile-navigation-dialog');
    const mobileMenuButton = document.getElementById('btn-mobile-menu');

    function isFeatureEnabled(name) {
        return window.APP_FEATURE_FLAGS?.[name] !== false;
    }

    function applyFeatureVisibility() {
        document.querySelectorAll('[data-feature]').forEach((element) => {
            const enabled = isFeatureEnabled(element.dataset.feature);
            element.classList.toggle('hidden', !enabled);
        });
    }

    applyFeatureVisibility();

    function resolveActiveGoalTarget(targetId) {
        if (financeToolViews.has(targetId)) return 'dashboard-view';
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
        const homeLabel = homeTarget === 'dashboard-view' ? '재무 홈' : '홈';
        if (label) label.textContent = homeLabel;
        button.title = `${homeLabel}으로 돌아가기`;
        button.setAttribute('aria-label', button.title);
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
        document.querySelectorAll('[data-mobile-nav-target]').forEach(nav => {
            const isActive = nav.getAttribute('data-mobile-nav-target') === targetId;
            nav.classList.toggle('bg-indigo-50', isActive);
            nav.classList.toggle('text-indigo-700', isActive);
            nav.classList.toggle('text-gray-600', !isActive);
        });
    }

    function switchView(targetId) {
        if (targetId === 'project-view' || targetId === 'career-view') targetId = 'dashboard-view';
        if (targetId === 'health-view' && !isFeatureEnabled('health')) targetId = 'routine-checklist-view';
        useMonthScopeForView(targetId);
        activeViewId = targetId;
        updateAppContext(targetId);
        updateGoalNavigation(targetId);
        document.querySelectorAll('.nav-link').forEach(nav => {
            if(nav.getAttribute('data-target') === targetId) { nav.classList.add('text-indigo-600', 'bg-indigo-50'); nav.classList.remove('text-gray-600', 'hover:bg-gray-50'); }
            else { nav.classList.remove('text-indigo-600', 'bg-indigo-50'); nav.classList.add('text-gray-600', 'hover:bg-gray-50'); }
        });
        Object.values(views).forEach(v => { if(v) v.classList.add('hidden'); });
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

    document.querySelectorAll('[data-app-home-link]').forEach((link) => {
        link.addEventListener('click', (event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            switchView('dashboard-view');
        });
        link.addEventListener('auxclick', (event) => {
            if (event.button !== 1) return;
            event.preventDefault();
            window.open(link.href, '_blank', 'noopener,noreferrer');
        });
    });

    function setMobileMenuOpen(open) {
        if (!mobileNavigationDialog || !mobileMenuButton) return;
        mobileNavigationDialog.classList.toggle('hidden', !open);
        mobileMenuButton.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('overflow-hidden', open);
        if (open) mobileNavigationDialog.querySelector('[data-mobile-nav-target]')?.focus();
        else mobileMenuButton.focus();
    }

    mobileMenuButton?.addEventListener('click', () => setMobileMenuOpen(true));
    mobileNavigationDialog?.addEventListener('click', (event) => {
        const navButton = event.target.closest('[data-mobile-nav-target]');
        if (navButton) {
            const target = navButton.dataset.mobileNavTarget;
            setMobileMenuOpen(false);
            switchView(target);
            return;
        }
        if (event.target.closest('[data-mobile-menu-close]')) setMobileMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && mobileNavigationDialog && !mobileNavigationDialog.classList.contains('hidden')) {
            setMobileMenuOpen(false);
        }
    });

    document.getElementById('btn-goal-home')?.addEventListener('click', (event) => {
        const target = event.currentTarget.dataset.target || resolveActiveGoalTarget(activeViewId);
        switchView(target);
    });

    updateGoalHomeButton(activeViewId);

    document.getElementById('asset-year-filter')?.addEventListener('change', (e) => {
        currentAssetFilter = e.target.value; renderFinanceSummary();
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
        loadSettings();
        if (typeof initAuth === 'function') await initAuth();
        fetchSheetData(true);
    });
