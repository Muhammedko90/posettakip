/**
 * Kargo desi hesaplama (Emre Bebe mantığı) — Poşet Takip entegrasyonu
 */
const LS_PRICES = 'emreBebePrices';
const LS_OVER30 = 'emreBebeOver30Price';
const LS_HIST = 'emreBebeHist';

const defaultPriceTable = [
    { min: 0, max: 0, price: 92.30 },
    { min: 1, max: 5, price: 105.30 },
    { min: 6, max: 10, price: 133.12 },
    { min: 11, max: 15, price: 156.25 },
    { min: 16, max: 20, price: 187.50 },
    { min: 21, max: 25, price: 249.22 },
    { min: 26, max: 30, price: 299.06 },
];

const MOBILE_FEE = 50.0;
const VAT_RATE = 0.2;

export function formatMoneyKargo(x) {
    return x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL';
}

function showKargoDialog({ title = 'Bilgi', message = '', withInput = false, defaultValue = '', confirmText = 'Tamam', cancelText = 'İptal', hideCancel = false }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4';
        const inputHtml = withInput
            ? `<input id="kargo-dialog-input" type="text" value="${String(defaultValue ?? '').replace(/"/g, '&quot;')}" class="w-full p-3 bg-tertiary border border-dynamic rounded-lg text-primary focus:ring-2 ring-accent outline-none">`
            : '';
        overlay.innerHTML = `
            <div class="w-full max-w-lg bg-primary border border-dynamic rounded-xl p-4 shadow-xl">
                <h4 class="text-lg font-semibold text-primary mb-2">${title}</h4>
                <p class="text-secondary text-sm mb-4">${message}</p>
                ${inputHtml}
                <div class="flex justify-end gap-2 mt-4">
                    ${hideCancel ? '' : `<button id="kargo-dialog-cancel" type="button" class="px-4 py-2 rounded-lg bg-tertiary text-primary hover:bg-secondary transition">${cancelText}</button>`}
                    <button id="kargo-dialog-confirm" type="button" class="px-4 py-2 rounded-lg accent-bg text-white accent-bg-hover transition">${confirmText}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        const cleanup = (result) => {
            overlay.remove();
            resolve(result);
        };

        overlay.querySelector('#kargo-dialog-confirm')?.addEventListener('click', () => {
            const value = withInput ? overlay.querySelector('#kargo-dialog-input')?.value ?? '' : '';
            cleanup({ confirmed: true, value });
        }, { once: true });

        overlay.querySelector('#kargo-dialog-cancel')?.addEventListener('click', () => {
            cleanup({ confirmed: false, value: '' });
        }, { once: true });
    });
}

const appAlert = (message, title = 'Bilgi') =>
    showKargoDialog({ title, message, hideCancel: true });
const appConfirm = async (message, title = 'Onay') =>
    (await showKargoDialog({ title, message })).confirmed;
const appPrompt = async (message, defaultValue = '', title = 'Değer Girin') => {
    const res = await showKargoDialog({ title, message, withInput: true, defaultValue });
    return res.confirmed ? res.value : null;
};

function buildDatalistFromCustomers(allCustomers) {
    const dl = document.createElement('datalist');
    (allCustomers || []).forEach((c) => {
        if (!c?.name) return;
        const opt = document.createElement('option');
        opt.value = c.name;
        dl.appendChild(opt);
    });
    return dl;
}

function mergeHistIntoDatalist(datalistEl) {
    if (!datalistEl) return;
    try {
        const hist = JSON.parse(localStorage.getItem(LS_HIST)) || [];
        const names = new Set(
            Array.from(datalistEl.querySelectorAll('option')).map((o) => o.value)
        );
        hist.forEach((item) => {
            if (item.customer && !names.has(item.customer)) {
                const opt = document.createElement('option');
                opt.value = item.customer;
                datalistEl.appendChild(opt);
                names.add(item.customer);
            }
        });
    } catch (_) {}
}

/**
 * @param {HTMLElement} root
 * @param {{ tabbed?: boolean, allCustomers?: Array<{name:string}>, presetCustomerName?: string, compact?: boolean, hideCustomerBlock?: boolean, hideWhatsappButton?: boolean, nonCompactPrimaryLabel?: string, onNonCompactPrimary?: (ctx: { totalDesi: number, grandTotal: number, mode: 'ambar' | 'kargo' }) => void, onApplyDesi?: (desi: number) => void }} opts
 */
export function mountKargoCalculator(root, opts = {}) {
    const tabbed = !!opts.tabbed;
    const compact = !!opts.compact;
    /** Teslimat gömülü kargo (compact): müşteri zaten üstte seçili; müşteri kartı gösterme */
    const hideCustomerBlock = !!opts.hideCustomerBlock || compact;
    const prefix = `kd-${Math.random().toString(36).slice(2, 9)}`;
    const id = (s) => `${prefix}-${s}`;

    let priceTable = JSON.parse(localStorage.getItem(LS_PRICES)) || defaultPriceTable;
    let OVER_30_UNIT_PRICE = parseFloat(localStorage.getItem(LS_OVER30)) || 10.71;
    let packages = [];
    let currentTotal = { desi: 0, grandTotal: 0 };
    /** Ambar butonu görsel + mantık (toggle); sadece onNonCompactPrimary kullanıldığında */
    let ambarBtnActive = false;

    function applyAmbarBtnStyle(btn, active) {
        if (!btn) return;
        if (active) {
            btn.classList.remove('bg-tertiary', 'border', 'border-dynamic', 'text-primary', 'hover:bg-secondary');
            btn.classList.add('accent-bg', 'text-white');
        } else {
            btn.classList.remove('accent-bg', 'text-white');
            btn.classList.add('bg-tertiary', 'border', 'border-dynamic', 'text-primary', 'hover:bg-secondary');
        }
    }

    const htmlTabbed = `
        <div class="kargo-desi-root text-primary min-w-0 max-w-full">
            <div class="kargo-desi-tabs flex min-w-0 gap-0.5 bg-tertiary rounded-lg p-1 text-[10px] sm:text-xs mb-3 border border-dynamic">
                <button type="button" data-kd-tab="calc" class="kd-tab min-w-0 flex-1 px-1.5 py-2 sm:px-3 rounded font-semibold accent-bg text-white transition text-center leading-tight">Hesapla</button>
                <button type="button" data-kd-tab="prices" class="kd-tab min-w-0 flex-1 px-1.5 py-2 sm:px-3 rounded text-secondary hover:text-primary transition text-center leading-tight">Fiyatlar</button>
                <button type="button" data-kd-tab="history" class="kd-tab min-w-0 flex-1 px-1.5 py-2 sm:px-3 rounded text-secondary hover:text-primary transition text-center leading-tight">Geçmiş</button>
            </div>
            <div id="${id('tab-calc')}" class="kd-panel"></div>
            <div id="${id('tab-prices')}" class="kd-panel hidden"></div>
            <div id="${id('tab-history')}" class="kd-panel hidden"></div>
        </div>`;

    const customerBlock = `
        <div class="kargo-desi-card mb-3 min-w-0 space-y-2 rounded-xl border border-dynamic bg-primary p-3 relative">
            <div class="mb-1 flex min-w-0 items-center gap-2 border-b border-dynamic pb-2">
                <h4 class="font-semibold text-sm text-primary">Müşteri Bilgileri</h4>
            </div>
            <div>
                <label class="block text-[10px] font-bold text-secondary uppercase mb-1">Ad Soyad / Firma</label>
                <input type="text" id="${id('customerName')}" list="${id('customerList')}" class="w-full p-2 bg-tertiary border border-dynamic rounded-lg text-sm focus:ring-2 ring-accent outline-none text-primary" placeholder="İsim yazmaya başlayın..." autocomplete="off">
                <datalist id="${id('customerList')}"></datalist>
            </div>
        </div>`;

    const calcBody = `
        ${hideCustomerBlock ? '' : customerBlock}
        <div class="grid min-w-0 max-w-full grid-cols-1 gap-3 md:grid-cols-2">
            <div class="min-w-0 space-y-2">
                <div class="flex min-w-0 flex-wrap gap-2">
                    <button type="button" data-kd-template="60,40,40" class="shrink-0 bg-tertiary text-accent-text px-2 py-1.5 rounded-lg text-xs font-semibold border border-dynamic hover:bg-secondary transition">+ Std Koli</button>
                    <button type="button" data-kd-template="80,50,50" class="shrink-0 bg-tertiary text-primary px-2 py-1.5 rounded-lg text-xs font-semibold border border-dynamic hover:bg-secondary transition">+ Büyük Çuval</button>
                    <button type="button" data-kd-template="30,20,15" class="shrink-0 bg-tertiary text-primary px-2 py-1.5 rounded-lg text-xs font-semibold border border-dynamic hover:bg-secondary transition">+ Ayakkabı</button>
                </div>
                <div class="kargo-desi-card min-w-0 bg-primary border border-dynamic border-l-4 border-l-[var(--accent-color)] rounded-xl p-3 shadow-md sm:p-4">
                    <h4 class="text-sm font-semibold text-primary mb-2 sm:mb-3">Yeni Paket Ekle</h4>
                    <div class="mb-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2">
                        <div class="min-w-0"><label class="text-[10px] font-bold text-secondary uppercase">En</label><input type="number" id="${id('w')}" class="w-full min-w-0 p-2 bg-tertiary border border-dynamic rounded text-center font-semibold text-primary outline-none" placeholder="cm"></div>
                        <div class="min-w-0"><label class="text-[10px] font-bold text-secondary uppercase">Boy</label><input type="number" id="${id('l')}" class="w-full min-w-0 p-2 bg-tertiary border border-dynamic rounded text-center font-semibold text-primary outline-none" placeholder="cm"></div>
                        <div class="min-w-0"><label class="text-[10px] font-bold text-secondary uppercase">Yükseklik</label><input type="number" id="${id('h')}" class="w-full min-w-0 p-2 bg-tertiary border border-dynamic rounded text-center font-semibold text-primary outline-none" placeholder="cm"></div>
                    </div>
                    <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
                        <div class="min-w-0 flex-1">
                            <label class="text-[10px] font-bold text-secondary uppercase">Manuel Desi</label>
                            <input type="number" id="${id('manual')}" class="w-full min-w-0 p-2 bg-tertiary border border-dynamic rounded text-sm text-primary" placeholder="Varsa girin">
                        </div>
                        <button type="button" id="${id('btnAddPkg')}" class="w-full shrink-0 accent-bg px-4 py-2 text-sm font-semibold text-white whitespace-nowrap rounded-lg shadow accent-bg-hover sm:w-auto">Paket Ekle</button>
                    </div>
                </div>
                <div class="kargo-desi-card min-w-0 bg-primary border border-dynamic rounded-xl p-3">
                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                        <span class="min-w-0 text-sm text-secondary">Toplam Ürün Adedi:</span>
                        <input type="number" id="${id('totalItems')}" value="1" min="0" class="w-16 shrink-0 p-1 bg-tertiary border border-dynamic rounded text-center text-sm text-primary">
                    </div>
                    <div class="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span class="min-w-0 flex-1 text-sm text-secondary">Mobil Bölge Farkı</span>
                        <input type="checkbox" id="${id('mobileFee')}" class="h-5 w-5 shrink-0 kd-mobile-fee-cb">
                    </div>
                </div>
            </div>
            <div class="min-w-0 space-y-2">
                <div class="kargo-desi-card bg-primary border border-dynamic rounded-xl overflow-hidden min-h-[120px] flex flex-col">
                    <div class="bg-tertiary p-2 border-b border-dynamic flex justify-between items-center">
                        <span class="text-xs font-bold text-secondary uppercase">Paketler</span>
                        <button type="button" id="${id('btnClear')}" class="text-xs text-red-400 hover:underline">Temizle</button>
                    </div>
                    <div id="${id('packageList')}" class="flex-1 divide-y divide-[var(--border-color)] overflow-y-auto max-h-[220px] kargo-desi-plist"></div>
                </div>
                <div class="min-w-0 bg-secondary border border-dynamic rounded-xl p-3 text-primary sm:p-4">
                    <div class="mb-1 flex min-w-0 flex-wrap items-end justify-between gap-2">
                        <span class="min-w-0 text-sm text-secondary">Toplam Desi</span>
                        <span class="shrink-0 text-2xl font-bold tabular-nums" id="${id('displayTotalDesi')}">0.00</span>
                    </div>
                    <div class="my-2 h-px bg-[var(--border-color)]"></div>
                    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
                        <div class="min-w-0">
                            <p class="text-xs text-secondary">Genel Toplam</p>
                            <p class="break-words text-xl font-bold text-green-400 sm:text-2xl" id="${id('displayGrandTotal')}">0.00 ₺</p>
                        </div>
                        <div class="min-w-0 text-left sm:text-right">
                            <p class="text-[10px] text-secondary">Ürün Başı Maliyet</p>
                            <p class="text-sm font-semibold text-yellow-400" id="${id('displayUnitCost')}">-</p>
                        </div>
                    </div>
                </div>
                <div id="${id('savings')}" class="hidden kargo-savings-box p-3 rounded-xl flex gap-2 items-start text-sm border border-green-500/30 bg-green-500/10">
                    <div class="text-green-400 shrink-0">💡</div>
                    <div>
                        <p class="font-semibold text-green-300 mb-1">Kâr Fırsatı</p>
                        <p class="text-green-200/90 leading-snug text-xs">
                            <span id="${id('save-desi-diff')}">...</span> desi küçültüp <span id="${id('save-target-desi')}">...</span> desi yaparsanız <span id="${id('save-amount')}">...</span> daha az ödersiniz.
                        </p>
                    </div>
                </div>
                ${compact ? `
                <button type="button" id="${id('btnApply')}" class="w-full accent-bg text-white py-3 rounded-lg font-bold accent-bg-hover">Ekle</button>` : `
                <div class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    <button type="button" id="${id('btnSaveHist')}" class="min-w-0 bg-tertiary border border-dynamic py-2 text-xs font-semibold text-primary transition hover:bg-secondary rounded-lg">${opts.nonCompactPrimaryLabel || 'Kaydet'}</button>
                    ${opts.hideWhatsappButton ? '<div></div>' : `<button type="button" id="${id('btnWa')}" class="min-w-0 bg-green-600 py-2 text-xs font-semibold text-white transition hover:bg-green-700 rounded-lg">WhatsApp</button>`}
                </div>`}
            </div>
        </div>`;

    if (tabbed) {
        root.innerHTML = htmlTabbed;
        root.querySelector(`#${id('tab-calc')}`).innerHTML = calcBody;
        root.querySelector(`#${id('tab-prices')}`).innerHTML = buildPricesHtml(id);
        root.querySelector(`#${id('tab-history')}`).innerHTML = buildHistoryHtml(id);
    } else {
        /* compact = teslim modalı içi: çift scroll yerine modal kutusu kayar (styles.css #modal-content-wrapper) */
        const wrapCls = compact
            ? 'kargo-desi-root min-w-0 max-w-full overflow-x-hidden pr-1 text-primary'
            : 'kargo-desi-root max-h-[70vh] min-w-0 max-w-full overflow-y-auto overflow-x-hidden pr-1 text-primary';
        root.innerHTML = `<div class="${wrapCls}">${calcBody}</div>`;
    }

    const el = (suffix) => root.querySelector(`#${id(suffix)}`);

    const datalist = el('customerList');
    if (datalist) {
        datalist.innerHTML = '';
        const built = buildDatalistFromCustomers(opts.allCustomers || []);
        built.querySelectorAll('option').forEach((o) => datalist.appendChild(o.cloneNode(true)));
        mergeHistIntoDatalist(datalist);
    }

    function calculatePrice(desi) {
        let basePrice = 0;
        if (desi > 0 && desi < 1) basePrice = priceTable[0].price;
        else {
            const rounded = Math.ceil(desi);
            if (rounded > 30) basePrice = rounded * OVER_30_UNIT_PRICE;
            else {
                const tier = priceTable.find((p) => rounded >= p.min && rounded <= p.max);
                basePrice = tier ? tier.price : 0;
            }
        }
        return basePrice;
    }

    function renderPriceListTab() {
        if (!tabbed) return;
        const tbody = root.querySelector(`#${id('priceListTableBody')}`);
        if (!tbody) return;
        let html = '';
        priceTable.forEach((row, index) => {
            const range = row.min === 0 && row.max === 0 ? 'Dosya / Min' : `${row.min} - ${row.max}`;
            const priceWithVat = row.price * (1 + VAT_RATE);
            html += `<tr class="hover:bg-tertiary/50">
                <td class="p-2 text-sm">${range}</td>
                <td class="p-2 text-center"><button type="button" data-kd-price="${index}" class="text-accent-text font-semibold border-b border-dashed border-[var(--accent-color)]">${formatMoneyKargo(row.price)}</button></td>
                <td class="p-2 text-right text-sm font-semibold">${formatMoneyKargo(priceWithVat)}</td>
            </tr>`;
        });
        tbody.innerHTML = html;
        const overEl = root.querySelector(`#${id('over30ex')}`);
        const overInc = root.querySelector(`#${id('over30inc')}`);
        if (overEl)
            overEl.innerHTML = `<button type="button" data-kd-over30="1" class="font-semibold border-b border-dashed">${formatMoneyKargo(OVER_30_UNIT_PRICE)}</button>`;
        if (overInc) {
            const wv = OVER_30_UNIT_PRICE * (1 + VAT_RATE);
            overInc.textContent = `${formatMoneyKargo(wv)} (Desi Başı)`;
        }
    }

    function autoFillCustomer() {
        const nameInput = el('customerName');
        if (!nameInput) return;
        nameInput.value = nameInput.value.trim();
    }

    function updateTotals(totalDesi, baseTotal) {
        const mob = el('mobileFee');
        if (mob?.checked && totalDesi > 0) baseTotal += MOBILE_FEE;
        const vat = baseTotal * VAT_RATE;
        const grandTotal = baseTotal + vat;
        currentTotal = { desi: totalDesi, grandTotal };

        const dTd = el('displayTotalDesi');
        const dGt = el('displayGrandTotal');
        const dUc = el('displayUnitCost');
        if (dTd) dTd.textContent = totalDesi.toFixed(2);
        if (dGt) dGt.textContent = formatMoneyKargo(grandTotal);
        const count = parseInt(el('totalItems')?.value, 10) || 0;
        if (dUc) dUc.textContent = count > 0 && grandTotal > 0 ? formatMoneyKargo(grandTotal / count) : '-';

        checkSavings(totalDesi, grandTotal);
    }

    function checkSavings(currentDesi, currentTotalPrice) {
        const savingsContainer = el('savings');
        if (!savingsContainer) return;
        let potentialDesi = 0;
        let potentialPrice = 0;
        let hasSaving = false;
        const currentRoundedDesi = Math.ceil(currentDesi);
        const mob = el('mobileFee');

        if (currentRoundedDesi > 30) {
            potentialDesi = currentRoundedDesi - 1;
            let basePrice = 0;
            if (potentialDesi === 30) basePrice = priceTable[priceTable.length - 1].price;
            else basePrice = potentialDesi * OVER_30_UNIT_PRICE;
            if (mob?.checked) basePrice += MOBILE_FEE;
            potentialPrice = basePrice * (1 + VAT_RATE);
            hasSaving = true;
        } else if (currentRoundedDesi > 0) {
            const currentTierIndex = priceTable.findIndex((p) => currentRoundedDesi >= p.min && currentRoundedDesi <= p.max);
            if (currentTierIndex > 0) {
                const lowerTier = priceTable[currentTierIndex - 1];
                potentialDesi = lowerTier.max;
                let basePrice = lowerTier.price;
                if (mob?.checked) basePrice += MOBILE_FEE;
                potentialPrice = basePrice * (1 + VAT_RATE);
                hasSaving = true;
            }
        }

        if (hasSaving) {
            const diffAmount = currentTotalPrice - potentialPrice;
            const diffDesi = (currentDesi - potentialDesi).toFixed(1);
            if (diffAmount > 2) {
                savingsContainer.classList.remove('hidden');
                const a = el('save-desi-diff');
                const b = el('save-target-desi');
                const c = el('save-amount');
                if (a) a.textContent = diffDesi;
                if (b) b.textContent = String(potentialDesi);
                if (c) c.textContent = formatMoneyKargo(diffAmount);
            } else savingsContainer.classList.add('hidden');
        } else savingsContainer.classList.add('hidden');
    }

    function renderPackages() {
        const list = el('packageList');
        if (!list) return;
        if (packages.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-secondary text-sm italic">Henüz paket eklenmedi.</div>';
            updateTotals(0, 0);
            return;
        }
        let html = '';
        let totalDesi = 0;
        let totalPrice = 0;
        packages.forEach((p, i) => {
            totalDesi += p.desi;
            totalPrice += p.price;
            html += `<div class="p-2 flex justify-between items-center hover:bg-tertiary/40 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <span class="bg-[var(--accent-bg-light)] text-[var(--accent-text-light)] w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">${i + 1}</span>
                    <div class="min-w-0">
                        <div class="text-sm font-semibold text-primary truncate">${p.desc}</div>
                        <div class="text-xs text-secondary">${p.desi.toFixed(2)} Desi</div>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs font-mono text-secondary">${formatMoneyKargo(p.price * (1 + VAT_RATE))}</span>
                    <button type="button" data-kd-rm="${p.id}" class="text-red-400 hover:text-red-300 p-1" title="Sil">✕</button>
                </div>
            </div>`;
        });
        list.innerHTML = html;
        updateTotals(totalDesi, totalPrice);
    }

    async function addPackage() {
        const w = parseFloat(el('w')?.value) || 0;
        const l = parseFloat(el('l')?.value) || 0;
        const h = parseFloat(el('h')?.value) || 0;
        const manual = parseFloat(el('manual')?.value) || 0;
        let desi = 0;
        let desc = '';
        if (manual > 0) {
            desi = manual;
            desc = 'Manuel: ' + manual + ' DS';
        } else if (w > 0 && l > 0 && h > 0) {
            desi = (w * l * h) / 3000;
            desc = w + 'x' + l + 'x' + h + ' cm';
        } else {
            await appAlert('Lütfen ölçü giriniz.', 'Eksik Bilgi');
            return;
        }
        packages.push({
            id: Date.now(),
            desc,
            desi,
            price: calculatePrice(desi),
        });
        if (el('w')) el('w').value = '';
        if (el('l')) el('l').value = '';
        if (el('h')) el('h').value = '';
        if (el('manual')) el('manual').value = '';
        renderPackages();
    }

    function removePackage(pid) {
        packages = packages.filter((p) => p.id !== pid);
        renderPackages();
    }

    function reCalculateTotal() {
        let td = 0,
            tp = 0;
        packages.forEach((p) => {
            td += p.desi;
            tp += p.price;
        });
        updateTotals(td, tp);
    }

    /** Hangi sekme vurgulu (mavi); aynı sekmeye tekrar tıklanınca seçim kaldırılır */
    let kdSelectedTab = null;

    function switchTab(tab) {
        if (!tabbed) return;
        if (kdSelectedTab === tab) {
            kdSelectedTab = null;
            ['calc', 'prices', 'history'].forEach((t) => {
                const btn = root.querySelector(`[data-kd-tab="${t}"]`);
                if (btn) {
                    btn.classList.remove('accent-bg', 'text-white');
                    btn.classList.add('text-secondary');
                }
            });
            return;
        }
        kdSelectedTab = tab;
        ['calc', 'prices', 'history'].forEach((t) => {
            const panel = root.querySelector(`#${id('tab-' + t)}`);
            const btn = root.querySelector(`[data-kd-tab="${t}"]`);
            if (panel) panel.classList.toggle('hidden', t !== tab);
            if (btn) {
                btn.classList.toggle('accent-bg', t === tab);
                btn.classList.toggle('text-white', t === tab);
                btn.classList.toggle('text-secondary', t !== tab);
            }
        });
        if (tab === 'history') loadHistoryTable();
    }

    function loadHistoryTable() {
        const body = root.querySelector(`#${id('historyTableBody')}`);
        if (!body) return;
        const hist = JSON.parse(localStorage.getItem(LS_HIST)) || [];
        if (hist.length === 0) {
            body.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-secondary text-sm">Kayıt yok.</td></tr>`;
            return;
        }
        body.innerHTML = hist
            .map(
                (item) => `<tr class="border-b border-dynamic">
            <td class="p-2 text-xs whitespace-nowrap">${item.date}</td>
            <td class="p-2 text-sm font-semibold">${item.customer}</td>
            <td class="p-2 text-center">${item.count}</td>
            <td class="p-2 text-right text-green-400 font-semibold">${formatMoneyKargo(item.total)}</td>
            <td class="p-2 text-center"><button type="button" data-kd-delhist="${item.id}" class="text-red-400 text-xs hover:underline">Sil</button></td>
        </tr>`
            )
            .join('');
    }

    async function saveToHistory() {
        if (packages.length === 0) {
            await appAlert('Liste boş.', 'Uyarı');
            return;
        }
        const name = el('customerName')?.value?.trim();
        if (!name) {
            await appAlert('Müşteri adı gerekli.', 'Uyarı');
            return;
        }
        const record = {
            id: Date.now(),
            date: new Date().toLocaleString('tr-TR'),
            customer: name,
            phone: '',
            address: '',
            count: packages.length,
            total: currentTotal.grandTotal,
        };
        let hist = JSON.parse(localStorage.getItem(LS_HIST)) || [];
        hist.unshift(record);
        localStorage.setItem(LS_HIST, JSON.stringify(hist));
        await appAlert('Kaydedildi.', 'Başarılı');
        mergeHistIntoDatalist(datalist);
        packages = [];
        renderPackages();
        if (el('customerName')) el('customerName').value = '';
    }

    async function shareWhatsapp() {
        if (packages.length === 0) {
            await appAlert('Paket yok.', 'Uyarı');
            return;
        }
        const name = el('customerName')?.value || 'Belirtilmedi';
        let txt = '*EMRE BEBE TOPTAN & TEKSTİL*\n📦 *Kargo Bilgilendirme*\n👤 Müşteri: ' + name + '\n----------------------------\n';
        packages.forEach((p, i) => {
            txt += i + 1 + '. Koli: ' + p.desc + ' (' + p.desi.toFixed(2) + ' DS)\n';
        });
        txt += '----------------------------\n📊 Toplam: ' + packages.length + ' Parça / ' + currentTotal.desi.toFixed(2) + ' DS\n💰 *TUTAR: ' + formatMoneyKargo(currentTotal.grandTotal) + '*\n----------------------------\nHayırlı İşler Dileriz.';
        window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
    }

    async function exportHistory() {
        const hist = JSON.parse(localStorage.getItem(LS_HIST)) || [];
        if (hist.length === 0) {
            await appAlert('Veri yok.', 'Uyarı');
            return;
        }
        let csv = 'Tarih,Musteri,Telefon,Adres,Adet,Tutar\n';
        hist.forEach((x) => {
            csv += `${x.date},"${x.customer}","${x.phone || ''}","${x.address || ''}",${x.count},${x.total}\n`;
        });
        const link = document.createElement('a');
        link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = 'emre_bebe_gecmis.csv';
        link.click();
    }

    // Events
    root.addEventListener('click', async (e) => {
        const t = e.target instanceof Element ? e.target : e.target?.parentElement;
        if (!t) return;
        const tabEl = t.closest?.('[data-kd-tab]');
        if (tabEl?.dataset?.kdTab) switchTab(tabEl.dataset.kdTab);
        const tmpl = t.closest?.('[data-kd-template]');
        if (tmpl?.dataset?.kdTemplate) {
            const [a, b, c] = tmpl.dataset.kdTemplate.split(',').map(Number);
            if (el('w')) el('w').value = a;
            if (el('l')) el('l').value = b;
            if (el('h')) el('h').value = c;
            if (el('manual')) el('manual').value = '';
        }
        if (t?.id === id('btnAddPkg') || t.closest?.('#' + id('btnAddPkg'))) await addPackage();
        if (t.closest?.('#' + id('btnClear'))) {
            if (await appConfirm('Liste temizlensin mi?', 'Onay')) {
                packages = [];
                renderPackages();
            }
        }
        const rmEl = t.closest?.('[data-kd-rm]');
        if (rmEl?.dataset?.kdRm) removePackage(Number(rmEl.dataset.kdRm));
        const nonCompactPrimaryBtn = t.closest?.('#' + id('btnSaveHist'));
        if (nonCompactPrimaryBtn) {
            if (typeof opts.onNonCompactPrimary === 'function') {
                if (ambarBtnActive) {
                    ambarBtnActive = false;
                    applyAmbarBtnStyle(nonCompactPrimaryBtn, false);
                    opts.onNonCompactPrimary({
                        totalDesi: currentTotal.desi,
                        grandTotal: currentTotal.grandTotal,
                        mode: null,
                    });
                } else {
                    ambarBtnActive = true;
                    applyAmbarBtnStyle(nonCompactPrimaryBtn, true);
                    opts.onNonCompactPrimary({
                        totalDesi: currentTotal.desi,
                        grandTotal: currentTotal.grandTotal,
                        mode: 'ambar',
                    });
                }
                nonCompactPrimaryBtn.blur();
            } else {
                await saveToHistory();
            }
        }
        if (t?.id === id('btnWa')) await shareWhatsapp();
        if (t?.id === id('btnApply') && opts.onApplyDesi) {
            const d = currentTotal.desi;
            if (!packages.length || d <= 0) {
                await appAlert('Önce en az bir paket ekleyin.', 'Uyarı');
                return;
            }
            opts.onApplyDesi(d);
        }
        if (t?.dataset?.kdPrice !== undefined) {
            const index = Number(t.dataset.kdPrice);
            let current = priceTable[index].price;
            let val = await appPrompt(
                (index === 0 ? 'Dosya/Min' : priceTable[index].min + '-' + priceTable[index].max + ' Desi') + ' için yeni KDV Hariç fiyatı:',
                current,
                'Fiyat Güncelle'
            );
            if (val !== null) {
                val = parseFloat(String(val).replace(',', '.'));
                if (!isNaN(val) && val >= 0) {
                    priceTable[index].price = val;
                    localStorage.setItem(LS_PRICES, JSON.stringify(priceTable));
                    renderPriceListTab();
                    packages.forEach((p) => (p.price = calculatePrice(p.desi)));
                    reCalculateTotal();
                }
            }
        }
        if (t?.dataset?.kdOver30 !== undefined) {
            let val = await appPrompt('31 desi ve üzeri için KDV Hariç birim fiyat (desi başı):', OVER_30_UNIT_PRICE, 'Birim Fiyat Güncelle');
            if (val !== null) {
                val = parseFloat(String(val).replace(',', '.'));
                if (!isNaN(val) && val >= 0) {
                    OVER_30_UNIT_PRICE = val;
                    localStorage.setItem(LS_OVER30, String(OVER_30_UNIT_PRICE));
                    renderPriceListTab();
                    packages.forEach((p) => (p.price = calculatePrice(p.desi)));
                    reCalculateTotal();
                }
            }
        }
        if (t?.dataset?.kdDelhist) {
            const hid = Number(t.dataset.kdDelhist);
            if (await appConfirm('Silinsin mi?', 'Onay')) {
                let hist = JSON.parse(localStorage.getItem(LS_HIST)) || [];
                hist = hist.filter((x) => x.id !== hid);
                localStorage.setItem(LS_HIST, JSON.stringify(hist));
                loadHistoryTable();
                mergeHistIntoDatalist(datalist);
            }
        }
        if (t?.id === id('btnExportCsv')) await exportHistory();
    });

    el('customerName')?.addEventListener('change', autoFillCustomer);
    el('customerName')?.addEventListener('blur', autoFillCustomer);
    el('mobileFee')?.addEventListener('change', reCalculateTotal);
    el('totalItems')?.addEventListener('input', reCalculateTotal);

    if (opts.presetCustomerName && el('customerName')) {
        el('customerName').value = opts.presetCustomerName;
        autoFillCustomer();
    }

    if (tabbed) {
        renderPriceListTab();
        switchTab('calc');
    }
    renderPackages();

    return {
        getTotalDesi: () => currentTotal.desi,
        getGrandTotal: () => currentTotal.grandTotal,
        resetAmbarButton: () => {
            ambarBtnActive = false;
            const btn = root.querySelector(`#${id('btnSaveHist')}`);
            applyAmbarBtnStyle(btn, false);
        },
        destroy: () => {
            root.innerHTML = '';
        },
    };
}

function buildPricesHtml(idFn) {
    return `
        <div class="kargo-desi-card bg-primary border border-dynamic rounded-xl overflow-hidden">
            <div class="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-dynamic bg-tertiary p-3">
                <h4 class="min-w-0 font-semibold text-primary">Güncel Fiyat Listesi</h4>
                <span class="shrink-0 rounded-full bg-[var(--accent-bg-light)] px-2 py-0.5 text-xs font-semibold text-[var(--accent-text-light)]">KDV %20</span>
            </div>
            <div class="p-3 overflow-x-auto">
                <table class="w-full text-left text-sm text-primary border-collapse">
                    <thead class="bg-tertiary text-xs uppercase text-secondary">
                        <tr>
                            <th class="p-2 border-b border-dynamic">Desi Aralığı</th>
                            <th class="p-2 border-b border-dynamic text-center">KDV Hariç</th>
                            <th class="p-2 border-b border-dynamic text-right">KDV Dahil</th>
                        </tr>
                    </thead>
                    <tbody id="${idFn('priceListTableBody')}"></tbody>
                    <tfoot class="bg-yellow-500/10">
                        <tr>
                            <td class="p-2 font-semibold border-t border-yellow-500/30">31+</td>
                            <td id="${idFn('over30ex')}" class="p-2 text-center border-t border-yellow-500/30"></td>
                            <td id="${idFn('over30inc')}" class="p-2 text-right border-t border-yellow-500/30 text-sm font-semibold"></td>
                        </tr>
                    </tfoot>
                </table>
                <p class="text-xs text-secondary mt-2 p-2 bg-tertiary/50 rounded border border-dynamic">Fiyatların üzerine tıklayarak düzenleyebilirsiniz. Veriler tarayıcıda saklanır.</p>
            </div>
        </div>`;
}

function buildHistoryHtml(idFn) {
    return `
        <div class="kargo-desi-card bg-primary border border-dynamic rounded-xl overflow-hidden">
            <div class="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-dynamic bg-tertiary p-3">
                <h4 class="min-w-0 font-semibold text-primary">Gönderim Geçmişi</h4>
                <button type="button" id="${idFn('btnExportCsv')}" class="shrink-0 text-xs font-semibold accent-text hover:underline">Excel İndir</button>
            </div>
            <div class="overflow-x-auto max-h-[50vh]">
                <table class="w-full text-left text-sm">
                    <thead class="bg-tertiary text-xs uppercase text-secondary sticky top-0">
                        <tr>
                            <th class="p-2">Tarih</th>
                            <th class="p-2">Müşteri</th>
                            <th class="p-2 text-center">Paket</th>
                            <th class="p-2 text-right">Tutar</th>
                            <th class="p-2 text-center">Sil</th>
                        </tr>
                    </thead>
                    <tbody id="${idFn('historyTableBody')}"></tbody>
                </table>
            </div>
        </div>`;
}
