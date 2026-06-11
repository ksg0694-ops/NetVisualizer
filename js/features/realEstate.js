// Real-estate subscription schedule and map rendering extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    const DEFAULT_REAL_ESTATE_SUBSCRIPTION_SITES = [
        { block: 'S2', site_name: '고양창릉 S-02', latitude: 37.6292, longitude: 126.8727, supply_count: 1057, housing_type: '나눔형 공공분양', expected_notice_month: '2026-06', key_point: '사전청약 없이 전량 본청약 예정', priority: '가장 중요', priority_order: 1, budget_note: '가장 중요', color: '#4F46E5' },
        { block: 'S3', site_name: '고양창릉 S-03', latitude: 37.6250, longitude: 126.8668, supply_count: 1306, housing_type: '나눔형 공공분양', expected_notice_month: '2026-06', key_point: '물량 큼, 생애최초 가능 여부 확인 필요', priority: '매우 중요', priority_order: 2, budget_note: '매우 중요', color: '#10B981' },
        { block: 'S4', site_name: '고양창릉 S-04', latitude: 37.6208, longitude: 126.8612, supply_count: 1024, housing_type: '공공분양', expected_notice_month: '2026-06', key_point: '6월 예정 대형 물량, 일반형 조건 우선 확인', priority: '매우 중요', priority_order: 3, budget_note: '매우 중요', color: '#2563EB' }
    ];

    const REAL_ESTATE_BLOCK_COLORS = {
        S2: '#4F46E5',
        S3: '#10B981',
        S4: '#2563EB'
    };

    function formatRealEstateDate(value, fallback = '공고 후 확정') {
        if (!value) return fallback;
        const text = String(value).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return `${text.slice(0, 4)}.${text.slice(5, 7)}.${text.slice(8, 10)}`;
        }
        if (/^\d{4}-\d{2}$/.test(text)) {
            return `${text.slice(0, 4)}.${text.slice(5, 7)} 예정`;
        }
        return String(value);
    }

    function normalizeSubscriptionSite(row = {}) {
        const block = String(row.block || '').trim().toUpperCase();
        const latitude = Number(row.latitude ?? row.lat);
        const longitude = Number(row.longitude ?? row.lng);
        const supplyCount = Number(row.supply_count ?? row.supplyCount ?? 0);
        const color = row.color || REAL_ESTATE_BLOCK_COLORS[block] || '#4F46E5';
        const mainDate = row.main_subscription_date || row.expected_notice_month || row.notice_month;
        const specialDate = row.special_supply_start_date || row.special_date;
        const generalDate = row.general_supply_start_date || row.local_first_supply_start_date || row.other_first_supply_start_date || row.general_date;

        return {
            ...row,
            block,
            name: row.site_name || row.name || block || '청약 단지',
            pos: Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : null,
            supply: supplyCount > 0 ? `${supplyCount.toLocaleString()}가구` : (row.supply || '공급 미정'),
            type: row.housing_type || row.sale_type || row.type || '분양 유형 미정',
            schedule: row.schedule || formatRealEstateDate(mainDate),
            mainDateText: formatRealEstateDate(mainDate),
            specialDateText: formatRealEstateDate(specialDate),
            generalDateText: formatRealEstateDate(generalDate),
            priority: row.priority || row.budget_note || '관심',
            keyPoint: row.key_point || row.note || '공고 업데이트 대기',
            color
        };
    }

    function getRealEstateSubscriptionSites() {
        const rows = Array.isArray(dataCache.realEstateSubscriptions) ? dataCache.realEstateSubscriptions : [];
        const sourceRows = rows.length > 0 ? rows : DEFAULT_REAL_ESTATE_SUBSCRIPTION_SITES;
        return sourceRows
            .map(normalizeSubscriptionSite)
            .sort((a, b) => Number(a.priority_order || 99) - Number(b.priority_order || 99) || String(a.block).localeCompare(String(b.block)));
    }

    function getRealEstateCardTone(site) {
        if (site.block === 'S2') return { border: 'border-indigo-100', bg: 'bg-indigo-50/40', badge: 'bg-indigo-600', text: 'text-indigo-600', priority: 'text-rose-600 bg-rose-50 border-rose-100' };
        if (site.block === 'S3') return { border: 'border-emerald-100', bg: 'bg-emerald-50/40', badge: 'bg-emerald-600', text: 'text-emerald-600', priority: 'text-amber-600 bg-amber-50 border-amber-100' };
        return { border: 'border-blue-100', bg: 'bg-blue-50/40', badge: 'bg-blue-600', text: 'text-blue-600', priority: 'text-amber-600 bg-amber-50 border-amber-100' };
    }

    function renderRealEstateScheduleCards(sites) {
        const container = document.getElementById('realestate-schedule-list');
        if (!container || !sites.length) return;

        container.innerHTML = sites.map(site => {
            const tone = getRealEstateCardTone(site);
            return `
                <div class="border ${tone.border} ${tone.bg} rounded-xl p-3">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="${tone.badge} text-white px-2 py-1 rounded text-[10px] font-bold shrink-0">${escapeHtml(site.block || 'APT')}</span>
                            <h5 class="font-bold text-gray-800 text-xs truncate">${escapeHtml(site.name)}</h5>
                        </div>
                        <span class="text-[10px] font-bold ${tone.text} whitespace-nowrap">${escapeHtml(site.supply)}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5 mb-2">
                        <span class="bg-white ${tone.text} border ${tone.border} px-1.5 py-0.5 rounded text-[9px] font-bold">${escapeHtml(site.type)}</span>
                        <span class="${tone.priority} border px-1.5 py-0.5 rounded text-[9px] font-bold">${escapeHtml(site.priority)}</span>
                    </div>
                    <p class="text-[10px] text-gray-500 mb-2">${escapeHtml(site.keyPoint)}</p>
                    <div class="grid grid-cols-3 gap-1 text-center">
                        <div class="bg-white rounded-lg border border-gray-100 px-1 py-1.5">
                            <p class="text-[9px] text-gray-400 font-bold">본청약</p>
                            <p class="text-[10px] text-gray-800 font-bold">${escapeHtml(site.mainDateText)}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-gray-100 px-1 py-1.5">
                            <p class="text-[9px] text-gray-400 font-bold">특공</p>
                            <p class="text-[10px] text-gray-800 font-bold">${escapeHtml(site.specialDateText)}</p>
                        </div>
                        <div class="bg-white rounded-lg border border-gray-100 px-1 py-1.5">
                            <p class="text-[9px] text-gray-400 font-bold">일반</p>
                            <p class="text-[10px] text-gray-800 font-bold">${escapeHtml(site.generalDateText)}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('') + '<p class="text-[9px] text-gray-400 leading-relaxed">* 청약홈 API/DB에 접수일이 들어오면 특공/일반공급 일자를 확정값으로 업데이트합니다.</p>';
    }

    function renderRealEstateMapLayers(sites) {
        if (!window.reMap) return;

        if (!window.reCityLayer) window.reCityLayer = L.layerGroup().addTo(window.reMap);
        if (!window.reSubscriptionLayer) window.reSubscriptionLayer = L.layerGroup().addTo(window.reMap);
        window.reCityLayer.clearLayers();
        window.reSubscriptionLayer.clearLayers();

        const dummyCities = [
            { name: '하남 교산', pos: [37.5252, 127.2023], price: '약 7~8억', status: '분양 예정', color: 'blue' },
            { name: '남양주 왕숙', pos: [37.6406, 127.1852], price: '약 6~7억', status: '건설 중', color: 'indigo' },
            { name: '고양 창릉', pos: [37.6254, 126.8687], price: '약 8~9억', status: '계획 단계', color: 'gray' },
            { name: '부천 대장', pos: [37.5332, 126.7865], price: '약 6억', status: '계획 단계', color: 'gray' },
            { name: '인천 계양', pos: [37.5467, 126.7265], price: '약 5~6억', status: '분양 완료', color: 'emerald' }
        ];

        dummyCities.forEach(city => {
            const marker = L.circleMarker(city.pos, {
                radius: 8,
                fillColor: city.color === 'gray' ? '#9CA3AF' : (city.color === 'emerald' ? '#10B981' : (city.color === 'indigo' ? '#4F46E5' : '#3B82F6')),
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(window.reCityLayer);
            marker.bindPopup(`<b>${escapeHtml(city.name)}</b><br>예상 분양가: ${escapeHtml(city.price)}<br>상태: ${escapeHtml(city.status)}`);
        });

        sites.filter(site => Array.isArray(site.pos)).forEach(site => {
            const icon = L.divIcon({
                className: '',
                html: `<div style="width:30px;height:30px;border-radius:9999px;background:${site.color};color:white;border:3px solid white;box-shadow:0 6px 16px rgba(15,23,42,.25);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;">${escapeHtml(site.block || 'APT')}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            const marker = L.marker(site.pos, { icon }).addTo(window.reSubscriptionLayer);
            marker.bindPopup(`
                <b>${escapeHtml(site.name)}</b><br>
                공급: ${escapeHtml(site.supply)}<br>
                유형: ${escapeHtml(site.type)}<br>
                본청약: ${escapeHtml(site.mainDateText)}<br>
                특공/일반: ${escapeHtml(site.specialDateText)} / ${escapeHtml(site.generalDateText)}<br>
                우선순위: ${escapeHtml(site.priority)}
            `);
        });
    }

    function renderRealEstate() {
        const subscriptionSites = getRealEstateSubscriptionSites();
        renderRealEstateScheduleCards(subscriptionSites);

        if (!window.reMap) {
            window.reMap = L.map('realestate-map').setView([37.6254, 126.8687], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(window.reMap);
            setTimeout(() => { window.reMap.invalidateSize(); }, 300);
        }
        renderRealEstateMapLayers(subscriptionSites);

        const { cashAndSafe, expectedLoan, totalReady, savedPct, loanPct, totalPct } = getRealEstateFundingStatus();

        const readyEl = document.getElementById('re-total-ready');
        if (readyEl) {
            readyEl.textContent = totalReady.toLocaleString() + '원';

            document.getElementById('re-progress-saved').style.width = Math.min(100, savedPct) + '%';
            document.getElementById('re-progress-saved').textContent = savedPct > 5 ? '모은돈' : '';

            document.getElementById('re-progress-loan').style.width = Math.min(100 - savedPct, loanPct) + '%';

            document.getElementById('re-saved-text').textContent = '모은돈: ' + cashAndSafe.toLocaleString() + '원';
            document.getElementById('re-progress-text').textContent = '총 ' + totalPct.toFixed(1) + '% 달성';
        }

        if(document.getElementById('re-expected-loan')) {
            document.getElementById('re-expected-loan').textContent = expectedLoan.toLocaleString() + '원';
            document.getElementById('re-total-available').textContent = totalReady.toLocaleString() + '원';
        }
    }

    // 앱 초기화
