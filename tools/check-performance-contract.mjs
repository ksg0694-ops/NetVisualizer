import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appCore = await readFile(new URL('../js/features/appCore.js', import.meta.url), 'utf8');
const appShell = await readFile(new URL('../js/features/appShell.js', import.meta.url), 'utf8');
const financeViews = await readFile(new URL('../js/features/financeViews.js', import.meta.url), 'utf8');

const startupScripts = [...index.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/g)]
    .map((match) => ({ attributes: match[1], src: match[2], tag: match[0] }));

assert.ok(startupScripts.length >= 20, 'startup script inventory unexpectedly changed');
startupScripts.forEach(({ src, tag }) => {
    assert.match(tag, /\bdefer\b/, `${src} must not block HTML parsing`);
});
assert.ok(
    !startupScripts.some(({ src }) => src.includes('pptxgen.bundle.js')),
    'PPT export runtime must be loaded only when export is requested',
);
assert.ok(!index.includes('cdn.tailwindcss.com'), 'production UI must use compiled Tailwind CSS');
assert.ok(index.includes('./styles/app.css?v='), 'compiled Tailwind CSS must be linked');
assert.ok(!index.includes('@import url('), 'initial CSS must not chain through a blocking @import');

const switchViewStart = appShell.indexOf('function switchView');
const switchViewEnd = appShell.indexOf("\n    document.querySelectorAll('.nav-link').forEach", switchViewStart);
const switchViewSource = appShell.slice(switchViewStart, switchViewEnd);
assert.equal(
    (switchViewSource.match(/ChecklistFeature\?\.render/g) || []).length,
    1,
    'Todo view must render once per navigation',
);
assert.equal(
    (switchViewSource.match(/LearningArchiveFeature\?\.render/g) || []).length,
    1,
    'Learning Archive must render once per navigation',
);
assert.ok(
    !appCore.includes('if (dashboard || cashFlow)'),
    'dashboard rendering must not automatically render hidden cash-flow views',
);
assert.ok(
    appCore.includes("cashFlowVisible = activeViewId === 'stats-view' || activeViewId === 'cashflow-view'"),
    'cash-flow rendering must be gated by the active view',
);
assert.ok(
    financeViews.includes("if (isMonthlyReportView)") && financeViews.includes("renderCashFlowCategoryAnalysis(txData, 'stats-view')"),
    'Monthly Report must use its isolated render branch',
);
assert.ok(
    financeViews.includes("isActiveView('dashboard-view')")
        && financeViews.includes("isActiveView('asset-view')")
        && financeViews.includes("isActiveView('stats-view')"),
    'asset charts must render only for their active view',
);

console.log(`Performance contracts ok (${startupScripts.length} deferred startup scripts, PPT runtime lazy)`);
