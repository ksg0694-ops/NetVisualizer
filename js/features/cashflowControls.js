// Cashflow view controls and card/insurance add-on rendering extracted from index.html.
// This script intentionally shares the global app state used by the legacy static app.

    function toggleManageView(show) {
        const main = document.getElementById('stats-main-content');
        const manage = document.getElementById('stats-manage-content');
        const addon = document.getElementById('stats-addon-content');
        if (!main || !manage) return;
        if (show) {
            main.classList.add('hidden'); main.classList.remove('flex');
            if(addon) { addon.classList.add('hidden'); addon.classList.remove('flex'); }
            manage.classList.remove('hidden'); manage.classList.add('flex');
        } else {
            manage.classList.add('hidden'); manage.classList.remove('flex');
            if(addon) { addon.classList.add('hidden'); addon.classList.remove('flex'); }
            main.classList.remove('hidden'); main.classList.add('flex');
        }
    }

    function toggleAddonView() {
        const main = document.getElementById('stats-main-content');
        const manage = document.getElementById('stats-manage-content');
        const addon = document.getElementById('stats-addon-content');
        if(main) { main.classList.add('hidden'); main.classList.remove('flex'); }
        if(manage) { manage.classList.add('hidden'); manage.classList.remove('flex'); }
        if(addon) { addon.classList.remove('hidden'); addon.classList.add('flex'); }
    }

    function renderAddons() {
        const cardsContainer = document.getElementById('addon-cards-list');
        const insContainer = document.getElementById('addon-insurance-list');

        if (cardsContainer) {
            cardsContainer.innerHTML = addonCards.map(c => `
                <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden">
                    ${c.purpose ? `<span class="absolute top-0 right-0 bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">${escapeHtml(c.purpose)}</span>` : ''}
                    <div class="flex items-center gap-3 mb-2">
                        ${c.image_data
                            ? `<img src="${escapeAttr(c.image_data)}" alt="${escapeAttr(c.name)}" class="h-10 w-16 object-cover rounded-md shadow-sm border border-gray-200 shrink-0">`
                            : `<div class="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-indigo-500 font-bold text-lg shrink-0"><i class="fas fa-credit-card"></i></div>`
                        }
                        <div class="overflow-hidden">
                            <h4 class="text-sm font-bold text-gray-800 truncate">${escapeHtml(c.name)}</h4>
                            <p class="text-[10px] text-gray-500 truncate">${escapeHtml(c.bank)}</p>
                        </div>
                    </div>
                    <div class="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div class="bg-white p-2 rounded border border-gray-100">
                            <span class="text-gray-400 block mb-0.5 text-[10px]">목표실적</span>
                            <span class="font-bold text-gray-700">${c.target_amt ? c.target_amt.toLocaleString() + '원' : '없음'}</span>
                        </div>
                        <div class="bg-white p-2 rounded border border-gray-100">
                            <span class="text-gray-400 block mb-0.5 text-[10px]">연회비</span>
                            <span class="font-bold text-gray-700">${c.annual_fee ? c.annual_fee.toLocaleString() + '원' : '없음'}</span>
                        </div>
                    </div>
                    ${(c.prt_ideal || c.prt_real) ? `
                    <div class="mt-2 flex gap-2 text-[10px]">
                        ${c.prt_ideal ? `<span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded">Ideal 피킹률: <b>${escapeHtml(c.prt_ideal)}</b></span>` : ''}
                        ${c.prt_real ? `<span class="bg-emerald-50 text-emerald-600 px-2 py-1 rounded">Real 피킹률: <b>${escapeHtml(c.prt_real)}</b></span>` : ''}
                    </div>` : ''}
                </div>
            `).join('');
        }

        if (insContainer) {
            const now = new Date();
            insContainer.innerHTML = addonInsurances.map(ins => {
                const startDate = new Date(ins.start_date);
                const endDate = new Date(ins.end_date);
                const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
                let elapsedMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
                if (elapsedMonths < 0) elapsedMonths = 0;
                if (elapsedMonths > totalMonths) elapsedMonths = totalMonths;
                const progressPct = totalMonths > 0 ? (elapsedMonths / totalMonths * 100).toFixed(1) : 0;

                return `
                <div class="bg-gray-50 border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col relative">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <span class="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded mb-1 inline-block">${escapeHtml(ins.category)}</span>
                            <h4 class="text-sm font-bold text-gray-800 leading-tight">${escapeHtml(ins.description)}</h4>
                            <p class="text-[10px] text-gray-500 mt-0.5">${escapeHtml(ins.company)}</p>
                        </div>
                        <div class="text-right shrink-0 ml-2">
                            <p class="text-xs font-bold text-gray-800">${ins.monthly_payment.toLocaleString()}원<span class="text-[10px] text-gray-400 font-normal">/월</span></p>
                            <p class="text-[10px] text-gray-500 mt-0.5">매월 ${ins.pay_day}일</p>
                        </div>
                    </div>
                    <div class="mt-3">
                        <div class="flex justify-between text-[10px] mb-1">
                            <span class="text-gray-500">${ins.start_date.substring(2,7).replace('-','.')} ~ ${ins.end_date.substring(2,7).replace('-','.')}</span>
                            <span class="font-bold text-emerald-600">${progressPct}% 납입</span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div class="bg-emerald-400 h-full rounded-full transition-all duration-1000" style="width: 0%" onload="this.style.width='${progressPct}%'" data-width="${progressPct}%"></div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            setTimeout(() => {
                const bars = insContainer.querySelectorAll('[data-width]');
                bars.forEach(b => b.style.width = b.getAttribute('data-width'));
            }, 100);
        }
    }

    // Weekly Timetable behavior lives in js/features/weeklyTimetable.js.
