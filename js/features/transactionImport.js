// Transaction import parsing, preview, audit, and save helpers extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    function openTxImportModal() {
        txImportCandidates = [];
        txImportStats = { total: 0, ready: 0, duplicate: 0, invalid: 0 };
        txImportRawRows = null;
        txImportSourceMeta = null;

        const fileInput = document.getElementById('tx-import-file');
        const sourceInput = document.getElementById('tx-import-source');
        if (fileInput) fileInput.value = '';
        if (sourceInput) sourceInput.value = '';

        loadTxImportAuditRuns();
        renderTxImportPreview();
        renderTxImportAudit();
        document.getElementById('tx-import-modal').classList.remove('hidden');
    }

    function closeTxImportModal() {
        document.getElementById('tx-import-modal').classList.add('hidden');
    }

    function loadTxImportAuditRuns() {
        try {
            const parsed = JSON.parse(localStorage.getItem(IMPORT_AUDIT_KEY) || '[]');
            txImportAuditRuns = Array.isArray(parsed) ? parsed.slice(0, 20) : [];
        } catch (error) {
            txImportAuditRuns = [];
        }
    }

    function persistTxImportAuditRuns() {
        try {
            localStorage.setItem(IMPORT_AUDIT_KEY, JSON.stringify(txImportAuditRuns.slice(0, 20)));
        } catch (error) {
            console.warn('import audit 저장 실패:', error.message);
        }
    }

    function getCurrentTxImportFileName() {
        const fileInput = document.getElementById('tx-import-file');
        return normalizeImportText(fileInput?.files?.[0]?.name, '파일명 없음');
    }

    function recordTxImportAuditRun({ status, insertedCount = 0, message = '' } = {}) {
        const run = {
            id: `local-${Date.now()}`,
            createdAt: new Date().toISOString(),
            fileName: getCurrentTxImportFileName(),
            status: status || 'success',
            total: txImportStats.total,
            ready: txImportStats.ready,
            duplicate: txImportStats.duplicate,
            invalid: txImportStats.invalid,
            inserted: insertedCount,
            message: normalizeImportText(message)
        };

        txImportAuditRuns = [run, ...txImportAuditRuns].slice(0, 20);
        persistTxImportAuditRuns();
        renderTxImportAudit();
    }

    function formatTxImportAuditTime(isoString) {
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getTxImportAuditStatusMeta(status) {
        if (status === 'success') return { label: '성공', className: 'bg-emerald-100 text-emerald-700' };
        return { label: '실패', className: 'bg-red-100 text-red-700' };
    }

    function renderTxImportAudit() {
        const container = document.getElementById('tx-import-audit');
        if (!container) return;

        if (!txImportAuditRuns.length) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('hidden');
        const recentRuns = txImportAuditRuns.slice(0, 5);
        container.innerHTML = `
            <div class="flex items-center justify-between gap-3 mb-3">
                <h4 class="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <i class="fas fa-history text-sky-500"></i> 최근 가져오기 기록
                </h4>
                <span class="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded">local</span>
            </div>
            <div class="space-y-2">
                ${recentRuns.map(run => {
                    const meta = getTxImportAuditStatusMeta(run.status);
                    return `
                        <div class="flex items-center justify-between gap-3 text-xs border border-gray-100 rounded-lg px-3 py-2 bg-gray-50/60">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.className}">${meta.label}</span>
                                    <span class="font-bold text-gray-700 truncate">${escapeHtml(run.fileName)}</span>
                                </div>
                                <p class="text-[10px] text-gray-500 truncate">
                                    총 ${Number(run.total || 0).toLocaleString()}건 · 저장 ${Number(run.inserted || 0).toLocaleString()}건 · 중복 ${Number(run.duplicate || 0).toLocaleString()}건 · 오류 ${Number(run.invalid || 0).toLocaleString()}건
                                    ${run.message ? ` · ${escapeHtml(run.message)}` : ''}
                                </p>
                            </div>
                            <span class="text-[10px] text-gray-400 whitespace-nowrap">${escapeHtml(formatTxImportAuditTime(run.createdAt))}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function detectDelimitedImportDelimiter(text) {
        const sample = String(text || '').split(/\r?\n/).slice(0, 5).join('\n');
        const tabCount = (sample.match(/\t/g) || []).length;
        const commaCount = (sample.match(/,/g) || []).length;
        return tabCount > commaCount ? '\t' : ',';
    }

    function parseDelimitedImportText(text, delimiter) {
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;
        const body = String(text || '').replace(/^\uFEFF/, '');

        for (let i = 0; i < body.length; i++) {
            const ch = body[i];
            const next = body[i + 1];

            if (ch === '"' && inQuotes && next === '"') {
                field += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === delimiter && !inQuotes) {
                row.push(field);
                field = '';
            } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
                if (ch === '\r' && next === '\n') i++;
                row.push(field);
                if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
                row = [];
                field = '';
            } else {
                field += ch;
            }
        }

        row.push(field);
        if (row.some(cell => String(cell).trim() !== '')) rows.push(row);
        return rows;
    }

    function isSpreadsheetImportFile(file) {
        const name = String(file?.name || '').toLowerCase();
        const type = String(file?.type || '').toLowerCase();
        if (/\.(csv|tsv|txt)$/.test(name)) return false;
        return /\.(xlsx|xls)$/.test(name)
            || type.includes('spreadsheetml')
            || type === 'application/vnd.ms-excel';
    }

    function normalizeSpreadsheetImportCell(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            const hour = String(value.getHours()).padStart(2, '0');
            const minute = String(value.getMinutes()).padStart(2, '0');
            const second = String(value.getSeconds()).padStart(2, '0');

            if (year < 1901) return `${hour}:${minute}:${second}`;
            const date = `${year}-${month}-${day}`;
            return `${hour}:${minute}:${second}` === '00:00:00' ? date : `${date} ${hour}:${minute}:${second}`;
        }

        return String(value ?? '').replace(/\s+/g, ' ').trim();
    }

    function normalizeSpreadsheetImportRows(rows) {
        return (rows || []).map(row => {
            const cells = (Array.isArray(row) ? row : [row]).map(normalizeSpreadsheetImportCell);
            while (cells.length && !cells[cells.length - 1]) cells.pop();
            return cells;
        }).filter(row => row.some(cell => String(cell).trim() !== ''));
    }

    function getImportHeaderScore(row) {
        const expectedHeaders = new Set(['date', 'time', 'type', 'category', 'subcategory', 'memo', 'amount', 'withdrawal', 'deposit', 'expenseAmount', 'currency', 'method']);
        return (row || []).reduce((score, cell) => {
            const normalized = normalizeImportHeader(cell);
            return score + (expectedHeaders.has(normalized) ? 1 : 0);
        }, 0);
    }

    function findImportHeaderRowIndex(rows) {
        return (rows || []).findIndex(row => getImportHeaderScore(row) >= 3);
    }

    function readSpreadsheetSheetRows(workbook, sheetName) {
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            defval: '',
            dateNF: 'yyyy-mm-dd'
        });
        return normalizeSpreadsheetImportRows(rows);
    }

    async function parseSpreadsheetImportFile(file) {
        if (!window.XLSX) {
            throw new Error('엑셀 파서가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.');
        }

        const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        const sheetNames = workbook.SheetNames || [];
        if (!sheetNames.length) throw new Error('엑셀 파일에서 시트를 찾지 못했습니다.');

        const candidates = sheetNames.map((sheetName, index) => {
            const rows = readSpreadsheetSheetRows(workbook, sheetName);
            const headerIndex = findImportHeaderRowIndex(rows);
            const headerScore = headerIndex >= 0 ? getImportHeaderScore(rows[headerIndex]) : 0;
            const nameScore = /가계부|거래|내역/i.test(sheetName) ? 3 : 0;
            const secondSheetScore = index === 1 ? 2 : 0;
            return {
                sheetName,
                rows,
                headerIndex,
                score: headerScore * 10 + nameScore + secondSheetScore
            };
        });

        const selected = candidates
            .filter(candidate => candidate.rows.length > 1)
            .sort((a, b) => b.score - a.score)[0];

        if (!selected) throw new Error('가져올 거래 행을 찾지 못했습니다.');

        const headerIndex = selected.headerIndex >= 0 ? selected.headerIndex : 0;
        const rows = selected.rows.slice(headerIndex);
        txImportSourceMeta = { kind: 'xlsx', sheetName: selected.sheetName };
        return rows;
    }

    async function parseTextImportFile(file) {
        const text = await file.text();
        const delimiter = detectDelimitedImportDelimiter(text);
        txImportSourceMeta = { kind: delimiter === '\t' ? 'tsv' : 'csv', sheetName: '' };
        return parseDelimitedImportText(text, delimiter);
    }

    function normalizeImportHeader(header) {
        const key = String(header || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_\-./()[\]{}]/g, '');

        const exactMap = {
            '날짜': 'date', '일자': 'date', '거래일': 'date', '거래일자': 'date', '이용일': 'date', '승인일': 'date', 'date': 'date', 'txdate': 'date',
            '시간': 'time', '거래시간': 'time', '승인시간': 'time', 'time': 'time',
            '유형': 'type', '타입': 'type', '수입지출': 'type', '입출금': 'type', '구분': 'type', 'type': 'type',
            '대분류': 'category', '분류': 'category', '카테고리': 'category', 'category': 'category', 'cat': 'category',
            '소분류': 'subcategory', '상세분류': 'subcategory', 'subcategory': 'subcategory', 'subcat': 'subcategory',
            '내용': 'memo', '내역': 'memo', '메모': 'memo', '적요': 'memo', '사용처': 'memo', '가맹점': 'memo', '가맹점명': 'memo', 'description': 'memo', 'memo': 'memo',
            '금액': 'amount', '거래금액': 'amount', 'amount': 'amount',
            '출금액': 'withdrawal', '출금': 'withdrawal', 'withdrawal': 'withdrawal', 'debit': 'withdrawal',
            '입금액': 'deposit', '입금': 'deposit', 'deposit': 'deposit', 'credit': 'deposit',
            '결제금액': 'expenseAmount', '이용금액': 'expenseAmount', '승인금액': 'expenseAmount', '사용금액': 'expenseAmount', 'paymentamount': 'expenseAmount',
            '통화': 'currency', '화폐': 'currency', 'currency': 'currency',
            '결제수단': 'method', '계좌': 'method', '계좌명': 'method', '카드': 'method', '카드명': 'method', 'method': 'method', 'account': 'method'
        };

        if (exactMap[key]) return exactMap[key];
        if (key.includes('출금')) return 'withdrawal';
        if (key.includes('입금')) return 'deposit';
        if ((key.includes('결제') || key.includes('이용') || key.includes('승인')) && key.includes('금액')) return 'expenseAmount';
        if (key.includes('일시')) return 'date';
        if (key.includes('금액')) return 'amount';
        if (key.includes('가맹') || key.includes('내용') || key.includes('적요')) return 'memo';
        if (key.includes('계좌') || key.includes('카드')) return 'method';
        return key;
    }

    function parseImportNumber(value) {
        const cleaned = String(value ?? '')
            .replace(/[,₩원\s]/g, '')
            .replace(/[^\d.-]/g, '');
        if (!cleaned || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
        const number = Number(cleaned);
        return Number.isFinite(number) ? Math.round(number) : null;
    }

    function normalizeImportDate(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';

        const korean = raw.replace(/[년월]/g, '-').replace(/일/g, '');
        const compact = korean.replace(/\s/g, '');
        const compactMatch = compact.match(/^(\d{4})(\d{2})(\d{2})$/);
        const separatedMatch = compact.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
        const match = compactMatch || separatedMatch;
        if (!match) return '';

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function normalizeImportTime(value) {
        const raw = String(value ?? '').trim();
        if (!raw) return null;

        const colonMatch = raw.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (colonMatch) {
            const hour = Number(colonMatch[1]);
            const minute = Number(colonMatch[2]);
            const second = Number(colonMatch[3] || 0);
            if (hour > 23 || minute > 59 || second > 59) return null;
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        }

        const digits = raw.replace(/\D/g, '');
        if (digits.length === 3 || digits.length === 4 || digits.length === 6) {
            const padded = digits.padStart(digits.length === 3 ? 4 : digits.length, '0');
            const hour = Number(padded.slice(0, 2));
            const minute = Number(padded.slice(2, 4));
            const second = padded.length >= 6 ? Number(padded.slice(4, 6)) : 0;
            if (hour > 23 || minute > 59 || second > 59) return null;
            return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        }

        return null;
    }

    function inferImportType(rawType, amount, method) {
        const typeKey = String(rawType || '').trim().toLowerCase().replace(/\s/g, '');
        if (['수입', '입금', 'income', 'deposit', 'credit'].includes(typeKey)) return '수입';
        if (['지출', '출금', '결제', 'expense', 'spend', 'withdrawal', 'debit'].includes(typeKey)) return '지출';
        if (['이체', 'transfer'].includes(typeKey)) return '이체';

        const methodKey = String(method || '').toLowerCase();
        if (methodKey.includes('카드') && amount > 0) return '지출';
        if (amount < 0) return '지출';
        if (amount > 0) return '수입';
        return '지출';
    }

    function parseImportAmount(values) {
        let amount = parseImportNumber(values.amount);
        const withdrawal = parseImportNumber(values.withdrawal);
        const deposit = parseImportNumber(values.deposit);
        const expenseAmount = parseImportNumber(values.expenseAmount);

        if (amount === null || amount === 0) {
            if (withdrawal !== null && withdrawal !== 0) amount = -Math.abs(withdrawal);
            else if (deposit !== null && deposit !== 0) amount = Math.abs(deposit);
            else if (expenseAmount !== null && expenseAmount !== 0) amount = -Math.abs(expenseAmount);
        }

        return amount;
    }

    function normalizeImportAmount(amount, type) {
        if (!Number.isFinite(amount) || amount === 0) return null;
        if (type === '지출') return -Math.abs(amount);
        if (type === '수입') return Math.abs(amount);
        return Math.round(amount);
    }

    function normalizeImportText(value, fallback = '') {
        const text = String(value ?? '').replace(/\s+/g, ' ').trim();
        return text || fallback;
    }

    function buildTxDedupeKey(tx) {
        const time = tx.time ? normalizeImportTime(tx.time) || tx.time : '';
        const memo = normalizeImportText(tx.memo).toLowerCase();
        const method = normalizeImportText(tx.method).toLowerCase();
        return [tx.date, time, tx.type, String(Math.round(Number(tx.amount) || 0)), memo, method].join('|');
    }

    function getExistingTransactionKeys() {
        const keys = new Set();
        Object.values(monthlyDB || {}).forEach(month => {
            (month.transactions || []).forEach(tx => keys.add(buildTxDedupeKey({
                date: tx.date,
                time: tx.time || null,
                type: tx.type,
                amount: tx.amount,
                memo: tx.memo,
                method: tx.method
            })));
        });
        return keys;
    }

    function getTxImportRowValues(headers, row) {
        const values = {};
        headers.forEach((key, index) => {
            if (!key) return;
            const value = normalizeImportText(row[index]);
            if (value && !values[key]) values[key] = value;
        });
        return values;
    }

    function buildTxImportPayload(values) {
        const defaultMethod = normalizeImportText(document.getElementById('tx-import-source')?.value);
        const date = normalizeImportDate(values.date);
        const time = normalizeImportTime(values.time);
        const memo = normalizeImportText(values.memo, '미분류 거래');
        const method = normalizeImportText(values.method, defaultMethod);
        const rawAmount = parseImportAmount(values);
        const type = inferImportType(values.type, rawAmount, method);
        const amount = normalizeImportAmount(rawAmount, type);

        return {
            date,
            time,
            type,
            category: normalizeImportText(values.category, '미분류'),
            subcategory: normalizeImportText(values.subcategory, '미분류'),
            memo,
            amount,
            currency: normalizeImportText(values.currency, 'KRW').toUpperCase(),
            method
        };
    }

    function rebuildTxImportCandidates() {
        if (!txImportRawRows || txImportRawRows.length < 2) {
            txImportCandidates = [];
            txImportStats = { total: 0, ready: 0, duplicate: 0, invalid: 0 };
            renderTxImportPreview();
            return;
        }

        const headers = txImportRawRows[0].map(normalizeImportHeader);
        const existingKeys = getExistingTransactionKeys();
        const seenKeys = new Set();

        txImportCandidates = txImportRawRows.slice(1).map((row, index) => {
            const values = getTxImportRowValues(headers, row);
            const txPayload = buildTxImportPayload(values);
            let status = 'ready';
            let reason = '';

            if (!txPayload.date) {
                status = 'invalid';
                reason = '날짜 오류';
            } else if (!Number.isFinite(txPayload.amount) || txPayload.amount === 0) {
                status = 'invalid';
                reason = '금액 오류';
            }

            const dedupeKey = status === 'ready' ? buildTxDedupeKey(txPayload) : '';
            if (status === 'ready' && existingKeys.has(dedupeKey)) {
                status = 'duplicate';
                reason = '기존 거래와 중복';
            } else if (status === 'ready' && seenKeys.has(dedupeKey)) {
                status = 'duplicate';
                reason = '파일 내 중복';
            }

            if (status === 'ready') seenKeys.add(dedupeKey);
            return { rowNumber: index + 2, txPayload, status, reason, dedupeKey };
        });

        txImportStats = txImportCandidates.reduce((acc, item) => {
            acc.total += 1;
            acc[item.status] += 1;
            return acc;
        }, { total: 0, ready: 0, duplicate: 0, invalid: 0 });

        renderTxImportPreview();
    }

    async function handleTxImportFile(file) {
        if (!file) {
            txImportRawRows = null;
            txImportSourceMeta = null;
            rebuildTxImportCandidates();
            return;
        }

        try {
            const rows = isSpreadsheetImportFile(file)
                ? await parseSpreadsheetImportFile(file)
                : await parseTextImportFile(file);
            if (rows.length < 2) throw new Error('가져올 거래 행을 찾지 못했습니다.');
            txImportRawRows = rows;
            rebuildTxImportCandidates();
        } catch (error) {
            txImportRawRows = null;
            txImportSourceMeta = null;
            txImportCandidates = [];
            txImportStats = { total: 0, ready: 0, duplicate: 0, invalid: 0 };
            renderTxImportPreview();
            showToast(error.message || '파일을 읽지 못했습니다.', 'error');
        }
    }

    function getTxImportStatusMeta(status) {
        if (status === 'ready') return { label: '저장 가능', className: 'bg-emerald-100 text-emerald-700' };
        if (status === 'duplicate') return { label: '중복 제외', className: 'bg-amber-100 text-amber-700' };
        return { label: '오류 제외', className: 'bg-red-100 text-red-700' };
    }

    function renderTxImportPreview() {
        const summary = document.getElementById('tx-import-summary');
        const list = document.getElementById('tx-import-preview-list');
        const btn = document.getElementById('btn-confirm-tx-import');

        if (btn) btn.disabled = txImportStats.ready === 0;
        if (!summary || !list) return;

        if (!txImportCandidates.length) {
            summary.textContent = '가져올 파일을 선택해주세요.';
            list.innerHTML = '';
            return;
        }

        const visibleRows = txImportCandidates.slice(0, 80);
        const hiddenCount = Math.max(txImportCandidates.length - visibleRows.length, 0);
        const sourceBadge = txImportSourceMeta?.kind
            ? `<span class="px-2 py-1 rounded-md bg-sky-100 text-sky-700 font-bold">${escapeHtml(txImportSourceMeta.kind.toUpperCase())}${txImportSourceMeta.sheetName ? ` · ${escapeHtml(txImportSourceMeta.sheetName)}` : ''}</span>`
            : '';
        summary.innerHTML = `
            <div class="flex flex-wrap gap-2 items-center">
                ${sourceBadge}
                <span class="font-bold text-gray-700">총 ${txImportStats.total.toLocaleString()}건</span>
                <span class="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 font-bold">저장 가능 ${txImportStats.ready.toLocaleString()}건</span>
                <span class="px-2 py-1 rounded-md bg-amber-100 text-amber-700 font-bold">중복 ${txImportStats.duplicate.toLocaleString()}건</span>
                <span class="px-2 py-1 rounded-md bg-red-100 text-red-700 font-bold">오류 ${txImportStats.invalid.toLocaleString()}건</span>
                ${hiddenCount > 0 ? `<span class="text-xs text-gray-500">미리보기는 80건까지만 표시됩니다.</span>` : ''}
            </div>
        `;

        list.innerHTML = visibleRows.map(item => {
            const tx = item.txPayload;
            const meta = getTxImportStatusMeta(item.status);
            const colorClass = tx.amount > 0 ? 'text-blue-600' : (tx.amount < 0 ? 'text-red-600' : 'text-gray-600');
            return `
                <tr class="hover:bg-gray-50/80 transition-colors">
                    <td class="px-4 py-3 whitespace-nowrap">
                        <span title="${escapeAttr(item.reason || meta.label)}" class="px-2 py-1 rounded-md text-[10px] font-bold ${meta.className}">${meta.label}</span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-gray-500">${escapeHtml(tx.date || '-')} <span class="hidden md:inline text-xs text-gray-400 ml-1">${escapeHtml(tx.time || '')}</span></td>
                    <td class="px-4 py-3 whitespace-nowrap"><span class="px-2 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700">${escapeHtml(tx.type)}</span></td>
                    <td class="px-4 py-3 min-w-[180px]"><div class="font-medium text-gray-800 truncate">${escapeHtml(tx.memo)}</div><div class="text-[10px] md:text-xs text-gray-400 mt-0.5">${escapeHtml(tx.category)} &gt; ${escapeHtml(tx.subcategory)}</div></td>
                    <td class="px-4 py-3 whitespace-nowrap text-gray-500 text-[10px] md:text-sm truncate max-w-[120px]">${escapeHtml(tx.method || '-')}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-right font-bold ${colorClass}">${formatSignedWon(tx.amount || 0)}</td>
                </tr>
            `;
        }).join('');
    }

    async function confirmTxImport() {
        const readyRows = txImportCandidates
            .filter(item => item.status === 'ready')
            .map(item => item.txPayload);

        if (!readyRows.length) return showToast('저장 가능한 거래가 없습니다.', 'warning');

        const btn = document.getElementById('btn-confirm-tx-import');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장중...';
        btn.disabled = true;

        try {
            const _supabase = getSupabaseClient();
            const { data: insertedRows, error } = await _supabase
                .from('transactions')
                .insert(readyRows)
                .select(SUPABASE_COLUMNS.transactions);

            if (error) throw error;

            recordTxImportAuditRun({ status: 'success', insertedCount: readyRows.length });
            showToast(`${readyRows.length.toLocaleString()}건을 저장했습니다.`, 'info');
            closeTxImportModal();

            if (insertedRows && insertedRows.length > 0) {
                mergeTransactionRowsIntoCache(insertedRows);
                const sortedRows = insertedRows.slice().sort((a, b) => `${a.date} ${a.time || '00:00'}`.localeCompare(`${b.date} ${b.time || '00:00'}`));
                const newest = sortedRows[sortedRows.length - 1];
                if (newest?.date) {
                    currentMonthKey = getMonthKeyAndPeriod(newest.date).monthKey;
                    cashFlowMonthKey = currentMonthKey;
                }
                renderSections({ dashboard: true, portfolio: true });
                toggleManageView(true);
            } else {
                await fetchSheetData(false, ['transactions']);
            }
        } catch(error) {
            console.error("가져오기 에러:", error);
            recordTxImportAuditRun({ status: 'failed', insertedCount: 0, message: error.message });
            showToast(error.message, 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = txImportStats.ready === 0;
        }
    }

    // ==========================================
    // 💡 [신규] Phase 2: 포트폴리오(Portfolio) 금액 수정 모달 및 전송
    // ==========================================
