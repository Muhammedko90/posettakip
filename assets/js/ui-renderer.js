/**
 * DOM manipülasyonu ve render işlemleri
 */
import { mountKargoCalculator } from './kargo-desi.js';
import { saveOrShareText, saveOrSharePdf } from './native-share.js';

export const toTrUpperCase = (str) => str ? str.toLocaleUpperCase('tr-TR') : '';

/** Firestore Timestamp, Date veya ISO için unix saniye */
export function firestoreOrDateToSeconds(t) {
    if (!t) return 0;
    if (typeof t === 'object' && t.seconds != null) return t.seconds;
    const d = t instanceof Date ? t : new Date(t);
    const ms = d.getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** PDF'te varsayılan font Türkçe desteklemediği için ASCII karşılığa çevirir. */
export function toPdfAscii(str) {
    if (!str) return '';
    const map = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
    return String(str).replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => map[c] ?? c);
}

export function formatDate(iso) {
    if (!iso) return '';
    const date = iso.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
    return date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatRelativeTime(iso) {
    if (!iso) return '';
    const date = iso.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'gelecekte';
    if (diffDays === 0) return 'bugün';
    if (diffDays === 1) return 'dün';
    return `${diffDays} gün önce`;
}

/** Anasayfa “Son işlemler” için: dk / saat / gün */
export function formatRecentActionAge(iso) {
    if (!iso) return '';
    const date = iso.seconds != null ? new Date(iso.seconds * 1000) : new Date(iso);
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return 'gelecekte';
    const sec = Math.floor(diffMs / 1000);
    if (sec < 45) return 'az önce';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} dk önce`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} saat önce`;
    const startToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const startThat = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((startToday - startThat) / (86400 * 1000));
    if (diffDays === 0) return 'bugün';
    if (diffDays === 1) return 'dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Müşteri adında " - " veya " | " ile firma / alt satır ayrımı (veri aynı kalır). */
function splitCustomerDisplayName(customerName) {
    const raw = String(customerName || '').trim();
    if (!raw) return { primary: '', secondary: '' };
    const line = raw.match(/^(.+?)\s*[-–—|]\s*(.+)$/);
    if (line) return { primary: line[1].trim(), secondary: line[2].trim() };
    const nl = raw.indexOf('\n');
    if (nl > 0) return { primary: raw.slice(0, nl).trim(), secondary: raw.slice(nl + 1).trim() };
    return { primary: raw, secondary: '' };
}

function escapeHtmlText(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function customerDetailTimestampMs(t) {
    if (!t) return 0;
    if (typeof t === 'object' && t.seconds != null) return t.seconds * 1000;
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) ? ms : 0;
}

/**
 * Bekleyen satırlar için eklenme tarihlerine poşet adedini dağıtır (veride adet/tarih ayrıntısı yok).
 * Teslim satırları ayrı kayıttır.
 */
export function buildCustomerEkstreRows(activeItemsList, deliveredItems) {
    const rows = [];
    for (const activeItem of activeItemsList) {
        const extra = (activeItem.additionalDates || []).slice().sort((a, b) => customerDetailTimestampMs(a) - customerDetailTimestampMs(b));
        let addDates = [activeItem.createdAt, ...extra].filter(Boolean);
        const bagCount = Number(activeItem.bagCount) || 0;
        if (addDates.length === 0 && bagCount > 0) {
            const fallback = activeItem.lastModified || activeItem.createdAt;
            if (fallback) addDates = [fallback];
        }
        const parts = addDates.length;
        const base = parts > 0 ? Math.floor(bagCount / parts) : 0;
        const rem = parts > 0 ? bagCount % parts : 0;
        const amounts = addDates.map((_, i) => base + (i < rem ? 1 : 0));
        addDates.forEach((dt, i) => {
            rows.push({
                kind: 'add',
                bags: amounts[i],
                at: dt,
                who: '—',
            });
        });
    }
    for (const d of deliveredItems) {
        rows.push({
            kind: 'deliver',
            bags: Number(d.bagCount) || 0,
            at: d.deliveredAt,
            who: d.deliveredBy || '—',
        });
    }
    rows.sort((a, b) => customerDetailTimestampMs(a.at) - customerDetailTimestampMs(b.at));
    return rows;
}

/** TR: boşlukları ve ayırıcıları kaldırır; 90 / 0 öneklerini düşürür (wa.me/90… için). */
export function formatPhoneDigitsForWhatsAppTR(raw) {
    let d = String(raw || '').replace(/\s+/g, '').replace(/[^\d]/g, '');
    if (d.startsWith('90')) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    return d;
}

const DEFAULT_SHARE_TEMPLATE =
    'Merhaba, [Müşteri Adı] adına ayrılan [Poşet Sayısı] poşetiniz [Bekleme Süresi] gündür beklemektedir.';

/**
 * Ayarlardaki paylaşım şablonunda [Müşteri Adı], [Poşet Sayısı], [Bekleme Süresi] yer tutucularını doldurur.
 * Bekleme süresi takvim günü olarak hesaplanır (ilk eklenme tarihinden).
 */
export function applyShareTemplate(template, item) {
    const tmpl = String(template ?? '').trim() || DEFAULT_SHARE_TEMPLATE;
    const days = Math.max(0, calendarDiffDaysSince(item.createdAt));
    return tmpl
        .replace(/\[Müşteri Adı\]/gi, item.customerName ?? '')
        .replace(/\[Poşet Sayısı\]/gi, String(item.bagCount ?? ''))
        .replace(/\[Bekleme Süresi\]/gi, String(days));
}

/** @param {string} [prefilledText] Ayarlardan gelen şablon metni (encode edilir) */
export function openWhatsAppWaMe90FromRawPhone(rawPhone, prefilledText) {
    const d = formatPhoneDigitsForWhatsAppTR(rawPhone);
    if (d.length < 10) return false;
    let url = `https://wa.me/90${d}`;
    const t = prefilledText != null ? String(prefilledText).trim() : '';
    if (t) url += `?text=${encodeURIComponent(t)}`;
    window.open(url, '_blank');
    return true;
}

/**
 * Paylaş → müşteride numara yokken telefon soran modal. İptal: null, onay: girilen metin.
 */
export function showWhatsAppPhonePromptModal(dom) {
    return new Promise((resolve) => {
        const finish = (value) => {
            hideModalUI(dom);
            setTimeout(() => resolve(value), 280);
        };
        dom.modalContent.innerHTML = `
            <h3 class="text-xl font-semibold mb-1 text-primary">WhatsApp</h3>
            <p class="text-secondary text-sm mb-4">Öncelikle lütfen telefon numarasını girin:</p>
            <label for="whatsapp-phone-input" class="sr-only">Telefon numarası</label>
            <input type="tel" id="whatsapp-phone-input" autocomplete="tel" class="w-full p-3 bg-tertiary border border-dynamic rounded-xl text-primary text-base focus:ring-2 ring-accent focus:outline-none transition" placeholder="5XX XXX XX XX">
            <div class="flex justify-end gap-3 mt-6">
                <button type="button" id="whatsapp-phone-cancel" class="px-4 py-2.5 rounded-lg bg-tertiary text-secondary hover:bg-slate-600/90 transition">İptal</button>
                <button type="button" id="whatsapp-phone-confirm" class="accent-bg text-white font-medium px-4 py-2.5 rounded-lg accent-bg-hover transition">Devam et</button>
            </div>`;
        showModalUI(dom);
        const input = dom.modalContent.querySelector('#whatsapp-phone-input');
        input?.focus();
        dom.modalContent.querySelector('#whatsapp-phone-cancel')?.addEventListener('click', () => finish(null), { once: true });
        dom.modalContent.querySelector('#whatsapp-phone-confirm')?.addEventListener('click', () => {
            finish(String(input?.value ?? '').trim());
        }, { once: true });
    });
}

function calendarDiffDaysSince(isoLike) {
    const date = isoLike?.seconds ? new Date(isoLike.seconds * 1000) : new Date(isoLike || new Date());
    const now = new Date();
    return Math.floor(
        (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
            new Date(date.getFullYear(), date.getMonth(), date.getDate())) /
            (1000 * 60 * 60 * 24)
    );
}

/** Bekleyen kayıtta ilk poşet eklenme = kayıt oluşturma (createdAt). */
function waitDaysFromFirstBagAddition(item) {
    if (!item?.createdAt) return 0;
    return Math.max(0, calendarDiffDaysSince(item.createdAt));
}

/**
 * Bekleme gününe göre sol şerit + poşet yuvarlağı (aynı eşikler).
 * 0–10: Normal (mavi-500), 11–19: Uyarı (sarı-500), 20+: Gecikmiş (kırmızı-500).
 */
function customerCardWaitVisuals(waitDays) {
    const d = Math.max(0, waitDays | 0);
    if (d <= 10) {
        return {
            stripClasses: 'bg-blue-500 shadow-lg shadow-blue-500/35',
            bagPillClasses: 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/35',
        };
    }
    if (d <= 19) {
        return {
            stripClasses: 'bg-yellow-500 shadow-lg shadow-yellow-500/35',
            bagPillClasses: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/35',
        };
    }
    return {
        stripClasses: 'bg-red-500 shadow-lg shadow-red-500/40',
        bagPillClasses: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/35',
    };
}

function lastActivityForItem(item) {
    if (item.lastModified && (item.lastModified.seconds != null || item.lastModified)) return item.lastModified;
    return item.createdAt;
}

const MENU_DOTS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" class="customer-card__icon-btn-svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>`;

export function getDayDifference(date1, date2) {
    if (!date1 || !date2) return '-';
    const d1 = date1.seconds ? new Date(date1.seconds * 1000) : new Date(date1);
    const d2 = date2.seconds ? new Date(date2.seconds * 1000) : new Date(date2);
    const difference = d2.getTime() - d1.getTime();
    const days = Math.ceil(difference / (1000 * 3600 * 24));
    return days >= 0 ? days : '-';
}

export const icons = {
    expand: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707m4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707m0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707m-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707"/></svg>',
    collapse: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M.172 15.828a.5.5 0 0 0 .707 0l4.096-4.096V14.5a.5.5 0 1 0 1 0v-3.975a.5.5 0 0 0-.5-.5H1.5a.5.5 0 0 0 0 1h2.768L.172 15.121a.5.5 0 0 0 0 .707M15.828.172a.5.5 0 0 0-.707 0l-4.096 4.096V1.5a.5.5 0 1 0-1 0v3.975a.5.5 0 0 0 .5.5H14.5a.5.5 0 0 0 0-1h-2.768L15.828.879a.5.5 0 0 0 0-.707m-4.344 11.313a.5.5 0 0 1 0 .707l4.096 4.096a.5.5 0 0 1-.707.707l-4.096-4.096V14.5a.5.5 0 1 1-1 0v-3.975a.5.5 0 0 1 .5-.5H14.5a.5.5 0 0 1 0 1h-2.768zM4.5 1.5a.5.5 0 0 0-1 0v2.768L.525.172a.5.5 0 0 0-.707.707l4.096 4.096H1.5a.5.5 0 0 0 0 1h3.975a.5.5 0 0 0 .5-.5V1.5z"/></svg>',
    alpha_asc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.082 12.629 9.664 14H8.598l1.789-5.332h1.234L13.402 14h-1.12l-.419-1.371h-1.781zm1.57-1.055h-1.296l.648-2.042.648 2.042z"/><path d="M12.96 7.022c.16-.21.283-.417.371-.622h.043c.09.205.214.412.375.622L15.04 8.5h-1.2l-.71-1.258h-.043l-.71 1.258h-1.21l1.83-3.05zM4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L4.5 12.293V2.5z"/></svg>',
    alpha_desc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.082 3.629 9.664 2H8.598l1.789 5.332h1.234L13.402 2h-1.12l-.419 1.371h-1.781zm1.57 1.055h-1.296l.648 2.042.648 2.042z"/><path d="M12.96 10.022c.16.21.283-.417.371.622h.043c.09-.205.214-.412.375-.622L15.04 8.5h-1.2l-.71 1.258h-.043l-.71-1.258h-1.21l1.83 3.05zM4.5 13.5a.5.5 0 0 1-1 0V3.707L2.354 4.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L4.5 3.707V13.5z"/></svg>',
    bags_desc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11.5 2.707V14.5a.5.5 0 0 0 .5.5z"/><path fill-rule="evenodd" d="M2.5 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0v-13a.5.5 0 0 1 .5-.5z"/></svg>',
    bags_asc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L11.5 13.293V1.5a.5.5 0 0 1 .5-.5z"/><path fill-rule="evenodd" d="M2.5 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0v-13a.5.5 0 0 1 .5-.5z"/></svg>',
    date_desc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>',
    date_asc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.854 8.854a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0l-1.5 1.5a.5.5 0 0 0 .708.708L7.5 6.707l2.646 2.647a.5.5 0 0 0 .708 0z"/><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>',
    cancel_item: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.293z"/></svg>',
    note: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.5 12.5A.5.5 0 0 1 5 12h3.793l1.147-1.146a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .5-.5m.5 2.5a.5.5 0 0 1 0-1h4a.5.5 0 0 1 0 1z"/><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1z"/></svg>',
    deliver: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/></svg>',
    share: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
    delete: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"/></svg>',
    save: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/></svg>',
    cancel: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>',
    /** Teslim personeli varsayılan (dolu yıldız) */
    star_filled: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/></svg>',
    /** Varsayılan değil (boş yıldız) */
    star_outline: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
};

/**
 * DOM referanslarını topla
 */
export function getDomRefs() {
    return {
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingText: document.getElementById('loading-text'),
        authContainer: document.getElementById('auth-container'),
        appContainer: document.getElementById('app-container'),
        appShell: document.getElementById('app-shell'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        forgotPasswordForm: document.getElementById('forgot-password-form'),
        loginError: document.getElementById('login-error'),
        registerError: document.getElementById('register-error'),
        forgotSuccess: document.getElementById('forgot-success'),
        forgotError: document.getElementById('forgot-error'),
        showRegisterBtn: document.getElementById('show-register'),
        showLoginBtn: document.getElementById('show-login'),
        forgotPasswordLink: document.getElementById('forgot-password-link'),
        backToLoginLink: document.getElementById('back-to-login'),
        logoutBtn: document.getElementById('settings-logout-btn'),
        settingsUserEmail: document.getElementById('settings-user-email'),
        changePasswordBtn: document.getElementById('change-password-btn'),
        mainContent: document.getElementById('main-content'),
        itemList: document.getElementById('item-list'),
        itemGrid: document.getElementById('item-grid'),
        emptyItemListMessage: document.getElementById('empty-item-list-message'),
        loadMoreContainer: document.getElementById('load-more-container'),
        toastContainer: document.getElementById('toast-container'),
        totalBagsCounter: document.getElementById('total-bags-counter'),
        totalCustomersCounter: document.getElementById('total-customers-counter'),
        sortAlphaBtn: document.getElementById('sort-alpha'),
        sortBagsBtn: document.getElementById('sort-bags'),
        sortDateBtn: document.getElementById('sort-date'),
        viewListBtn: document.getElementById('view-list-btn'),
        viewGridBtn: document.getElementById('view-grid-btn'),
        addItemForm: document.getElementById('add-item-form'),
        customerNameInput: document.getElementById('customer-name'),
        bagCountInput: document.getElementById('bag-count'),
        suggestionsBox: document.getElementById('suggestions-box'),
        clearCustomerNameBtn: document.getElementById('clear-customer-name'),
        archiveList: document.getElementById('archive-list'),
        emptyArchiveListMessage: document.getElementById('empty-archive-list-message'),
        searchArchiveInput: document.getElementById('search-archive-input'),
        archivePagination: document.getElementById('archive-pagination'),
        archiveFilters: document.getElementById('archive-filters'),
        archiveFilterCustomer: document.getElementById('archive-filter-customer'),
        archiveFilterDeliverer: document.getElementById('archive-filter-deliverer'),
        archiveFilterShipment: document.getElementById('archive-filter-shipment'),
        archiveFilterSummary: document.getElementById('archive-filter-summary'),
        archiveFilterSummaryText: document.getElementById('archive-filter-summary-text'),
        archiveFilterClear: document.getElementById('archive-filter-clear'),
        archiveFiltersToggle: document.getElementById('archive-filters-toggle'),
        archiveFiltersDropdown: document.getElementById('archive-filters-dropdown'),
        notesList: document.getElementById('notes-list'),
        emptyNotesMessage: document.getElementById('empty-notes-message'),
        modalContainer: document.getElementById('modal-container'),
        modalContentWrapper: document.getElementById('modal-content-wrapper'),
        modalContent: document.getElementById('modal-content'),
        notificationBell: document.getElementById('tab-notifications'),
        notificationBadge: document.getElementById('notification-badge'),
        notificationsPageInner: document.getElementById('notifications-page-inner'),
        scrollToTopBtn: document.getElementById('scroll-to-top-btn'),
        toggleWidthBtn: document.getElementById('toggle-width-btn'),
        shareTemplate: {
            input: document.getElementById('share-template-input'),
            saveBtn: document.getElementById('save-share-template-btn')
        },
        telegram: {
            botTokenInput: document.getElementById('telegram-bot-token'),
            chatIdInput: document.getElementById('telegram-chat-id'),
            reportTimeInput: document.getElementById('telegram-report-time'),
            backupTimeInput: document.getElementById('telegram-backup-time'),
            saveBtn: document.getElementById('save-telegram-settings-btn')
        },
        dashboard: {
            waitingCustomers: document.getElementById('dashboard-waiting-customers'),
            waitingBags: document.getElementById('dashboard-waiting-bags'),
            deliveredLastWeek: document.getElementById('dashboard-delivered-last-week'),
            overdueCustomers: document.getElementById('dashboard-overdue-customers'),
            oldestCustomers: document.getElementById('dashboard-oldest-customers'),
            reminders: document.getElementById('dashboard-reminders'),
            recentActions: document.getElementById('dashboard-recent-actions'),
            quickNoteCustomer: document.getElementById('dashboard-quick-note-customer'),
            quickNoteSuggestions: document.getElementById('dashboard-quick-note-suggestions'),
            quickNoteText: document.getElementById('dashboard-quick-note-text'),
            quickNoteBtn: document.getElementById('dashboard-quick-note-btn'),
        },
        importFileInput: document.getElementById('import-file-input')
    };
}

export function showLoading(dom, message) {
    if (!dom?.loadingOverlay || !dom?.loadingText) return;
    dom.loadingText.textContent = message;
    dom.loadingOverlay.style.display = 'flex';
    dom.loadingOverlay.style.opacity = '1';
}

export function hideLoading(dom) {
    if (!dom?.loadingOverlay) return;
    dom.loadingOverlay.style.opacity = '0';
    setTimeout(() => { dom.loadingOverlay.style.display = 'none'; }, 300);
}

export function showAuthUI(dom) {
    if (!dom?.authContainer || !dom?.appContainer) return;
    dom.appContainer.classList.add('hidden');
    dom.authContainer.classList.remove('hidden');
    if (dom.loginForm) dom.loginForm.classList.remove('hidden');
    if (dom.registerForm) dom.registerForm.classList.add('hidden');
    if (dom.forgotPasswordForm) dom.forgotPasswordForm.classList.add('hidden');
}

export function showAppUI(dom, user) {
    if (!dom?.authContainer || !dom?.appContainer) return;
    dom.authContainer.classList.add('hidden');
    dom.appContainer.classList.remove('hidden');
    if (dom.settingsUserEmail) dom.settingsUserEmail.textContent = user?.email ?? '';
}

export function applySettings(dom, settings, viewMode, updateViewToggleButtonsFn) {
    document.body.className = 'bg-secondary text-primary';
    if (settings.theme) {
        document.body.classList.add(`theme-${settings.theme}`);
    }
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === settings.theme);
    });
    document.body.style.fontSize = `${settings.fontSize}px`;
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizePreview = document.getElementById('font-size-preview');
    if (fontSizeSlider) fontSizeSlider.value = settings.fontSize;
    if (fontSizePreview) fontSizePreview.textContent = `${settings.fontSize}px`;
    if (dom.shareTemplate.input) dom.shareTemplate.input.value = settings.shareTemplate || '';
    
    // Telegram ayarlarını yükle
    if (dom.telegram.botTokenInput) dom.telegram.botTokenInput.value = settings.telegramBotToken || '';
    if (dom.telegram.chatIdInput) dom.telegram.chatIdInput.value = settings.telegramChatId || '';
    if (dom.telegram.reportTimeInput) dom.telegram.reportTimeInput.value = settings.telegramReportTime || '09:00';
    if (dom.telegram.backupTimeInput) dom.telegram.backupTimeInput.value = settings.telegramBackupTime || '19:00';

    if (updateViewToggleButtonsFn) updateViewToggleButtonsFn();
}

export function updateViewToggleButtons(dom, viewMode) {
    dom.viewListBtn.classList.toggle('view-active', viewMode === 'list');
    dom.viewGridBtn.classList.toggle('view-active', viewMode === 'grid');
}

/** Alt sekme / tab değişiminde önceki sayfanın kaydırma konumunu sıfırla */
function resetScrollAfterTabSwitch() {
    try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    } catch {
        window.scrollTo(0, 0);
    }
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
    const app = document.getElementById('app-container');
    if (app) app.scrollTop = 0;
    const visiblePanel = document.querySelector('.panel[id^="panel-"]:not(.hidden)');
    if (visiblePanel) visiblePanel.scrollTop = 0;
}

export function switchTab(target, instant = false) {
    const tabs = document.querySelectorAll('nav button[id^="tab-"]');
    const panels = document.querySelectorAll('.panel[id^="panel-"]');
    tabs.forEach(tab => tab.classList.remove('tab-active'));
    const tabEl = document.getElementById(`tab-${target}`);
    if (tabEl) tabEl.classList.add('tab-active');
    panels.forEach(panel => {
        const isTargetPanel = panel.id === `panel-${target}`;
        if (instant) {
            panel.style.transition = 'none';
            panel.classList.toggle('hidden', !isTargetPanel);
            requestAnimationFrame(() => panel.style.transition = '');
        } else {
            panel.classList.toggle('hidden', !isTargetPanel);
        }
    });
    if (target !== 'archive') {
        const archiveDd = document.getElementById('archive-filters-dropdown');
        const archiveTgl = document.getElementById('archive-filters-toggle');
        archiveDd?.classList.add('hidden');
        archiveTgl?.setAttribute('aria-expanded', 'false');
    }
    resetScrollAfterTabSwitch();
}

export function updateSortButtons(dom, sortState) {
    [dom.sortAlphaBtn, dom.sortBagsBtn, dom.sortDateBtn].forEach(btn => btn.classList.remove('sort-active'));
    const activeBtn = document.getElementById(`sort-${sortState.type}`);
    if (activeBtn) activeBtn.classList.add('sort-active');
    dom.sortAlphaBtn.innerHTML = icons[`alpha_${sortState.type === 'alpha' ? sortState.direction : 'asc'}`];
    dom.sortBagsBtn.innerHTML = icons[`bags_${sortState.type === 'bags' ? sortState.direction : 'desc'}`];
    dom.sortDateBtn.innerHTML = icons[`date_${sortState.type === 'date' ? sortState.direction : 'desc'}`];
}

function createItemElement(item, formatDateFn, formatRelativeTimeFn) {
    const div = document.createElement('div');
    const waitDays = waitDaysFromFirstBagAddition(item);
    const waitVisual = customerCardWaitVisuals(waitDays);
    const { primary, secondary } = splitCustomerDisplayName(item.customerName);
    let noteIndicatorHTML = '';
    if (item.note) noteIndicatorHTML += `<span class="text-sky-400 text-xs" title="Not Mevcut">●</span>`;
    if (item.reminderDate) noteIndicatorHTML += `<span class="text-cyan-400 text-xs ml-1" title="Hatırlatıcı: ${item.reminderDate}">🔔</span>`;
    let historyHtml = item.createdAt
        ? `<p class="customer-card__relative text-sm text-secondary mt-0.5">${formatRelativeTimeFn(item.createdAt)}</p>`
        : '<p class="customer-card__relative text-sm text-secondary mt-0.5">Eklenme tarihi yok</p>';
    if (item.additionalDates && Array.isArray(item.additionalDates) && item.additionalDates.length > 0) {
        historyHtml += item.additionalDates.map(d => `<p class="text-xs text-secondary/75 mt-0.5 pl-0">+ Poşet: ${formatDateFn(d).split(' ')[0]} (${formatRelativeTimeFn(d)})</p>`).join('');
    }
    const subLine = secondary
        ? `<p class="customer-card__company text-xs text-secondary/80 font-medium mt-0.5 tracking-wide">${secondary}</p>`
        : '';
    const lastAct = lastActivityForItem(item);
    const sonIslem = lastAct ? formatDateFn(lastAct) : '—';
    div.className = 'customer-card customer-card--list gradient-border';
    div.dataset.id = item.id;
    div.dataset.customerName = item.customerName;
    div.innerHTML = `
        <div class="customer-card__strip ${waitVisual.stripClasses}" aria-hidden="true"></div>
        <div class="customer-card__inner">
            <div class="customer-card__main-row">
                <div class="customer-card__text-block min-w-0 flex-1">
                    <button type="button" data-action="view-customer" class="customer-card__name text-left w-full">
                        <span class="customer-card__name-text">${primary}</span>
                        ${noteIndicatorHTML}
                    </button>
                    ${subLine}
                    ${historyHtml}
                </div>
                <div class="customer-card__tools flex items-start gap-0.5 shrink-0">
                    <div class="edit-count-actions hidden flex items-center gap-2 mr-1">
                        <input type="number" value="${item.bagCount}" min="1" class="customer-card__count-input w-14 py-1 px-2 bg-secondary border border-dynamic text-primary rounded-lg text-sm focus:ring-1 ring-accent transition">
                        <button data-action="save-count" class="p-2 text-green-400 hover:text-green-300 transition" title="Kaydet">${icons.save}</button>
                        <button data-action="cancel-edit-count" class="p-2 text-red-500 hover:text-red-400 transition" title="Vazgeç">${icons.cancel}</button>
                    </div>
                    <div class="customer-card__actions-default flex items-center gap-0">
                    <span class="customer-card__bag-pill default-bag-display tabular-nums ${waitVisual.bagPillClasses}">${item.bagCount}</span>
                    <div class="default-actions relative flex items-center gap-0">
                        <button type="button" data-action="toggle-menu" class="customer-card__icon-btn" title="İşlemler">${MENU_DOTS_SVG}</button>
                        <div class="action-menu hidden absolute right-0 top-full mt-1 rounded-xl shadow-xl w-52 overflow-hidden border border-dynamic bg-tertiary">
                            <button data-action="deliver" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition text-green-400"><span class="w-4 shrink-0">${icons.deliver}</span> Teslim Et</button>
                            <button data-action="share" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition"><span class="w-4 shrink-0">${icons.share}</span> Paylaş</button>
                            <button data-action="edit-note" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition"><span class="w-4 shrink-0">${icons.note}</span> Notu Düzenle</button>
                            <button data-action="edit-count" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition"><span class="w-4 shrink-0">${icons.edit}</span> Sayıyı Düzenle</button>
                            <button data-action="delete-item" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition text-red-400"><span class="w-4 shrink-0">${icons.cancel_item}</span> Kaydı Sil</button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
            <p class="customer-card__footer text-xs text-secondary mt-2 pt-2 border-t border-white/5"><span class="text-secondary/70">Son İşlem:</span> ${sonIslem}</p>
        </div>`;
    return div;
}

function createItemCardElement(item, formatDateFn, formatRelativeTimeFn) {
    const div = document.createElement('div');
    const waitDays = waitDaysFromFirstBagAddition(item);
    const waitVisual = customerCardWaitVisuals(waitDays);
    const { primary, secondary } = splitCustomerDisplayName(item.customerName);
    let noteIndicatorHTML = '';
    if (item.note) noteIndicatorHTML += `<span class="text-sky-400 text-xs" title="Not Mevcut">●</span>`;
    if (item.reminderDate) noteIndicatorHTML += `<span class="text-cyan-400 text-xs ml-1" title="Hatırlatıcı: ${item.reminderDate}">🔔</span>`;
    const subLine = secondary
        ? `<p class="customer-card__company text-xs text-secondary/80 font-medium mt-1">${secondary}</p>`
        : '';
    const lastAct = lastActivityForItem(item);
    const sonIslem = lastAct ? formatDateFn(lastAct) : '—';
    div.className = 'customer-card customer-card--grid gradient-border';
    div.dataset.id = item.id;
    div.dataset.customerName = item.customerName;
    div.innerHTML = `
        <div class="customer-card__strip ${waitVisual.stripClasses}" aria-hidden="true"></div>
        <div class="customer-card__inner customer-card__inner--grid">
            <div class="flex justify-between items-start gap-2">
                <div class="min-w-0 flex-1 pr-1">
                    <button type="button" data-action="view-customer" class="customer-card__name text-left w-full">
                        <span class="customer-card__name-text">${primary}</span>
                        ${noteIndicatorHTML}
                    </button>
                    ${subLine}
                </div>
                <div class="customer-card__actions-default flex items-center gap-0 shrink-0">
                <div class="default-actions relative flex items-center gap-0">
                    <button type="button" data-action="toggle-menu" class="customer-card__icon-btn" title="İşlemler">${MENU_DOTS_SVG}</button>
                    <div class="action-menu hidden absolute right-0 top-full mt-1 rounded-xl shadow-xl w-52 overflow-hidden border border-dynamic bg-tertiary">
                        <button data-action="deliver" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition text-green-400"><span class="w-4 shrink-0">${icons.deliver}</span> Teslim Et</button>
                        <button data-action="share" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition"><span class="w-4 shrink-0">${icons.share}</span> Paylaş</button>
                        <button data-action="edit-note" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition"><span class="w-4 shrink-0">${icons.note}</span> Notu Düzenle</button>
                        <button data-action="edit-count" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition"><span class="w-4 shrink-0">${icons.edit}</span> Sayıyı Düzenle</button>
                        <button data-action="delete-item" class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-slate-600/80 transition text-red-400"><span class="w-4 shrink-0">${icons.cancel_item}</span> Kaydı Sil</button>
                    </div>
                </div>
                </div>
            </div>
            <p class="customer-card__relative text-sm text-secondary mt-2">${formatRelativeTimeFn(item.createdAt)}</p>
            <div class="mt-3 flex flex-wrap items-end justify-between gap-2">
                <p class="customer-card__footer text-xs text-secondary m-0"><span class="text-secondary/70">Son İşlem:</span> ${sonIslem}</p>
                <div class="flex items-center gap-2 ml-auto">
                    <div class="edit-count-actions hidden flex items-center gap-2">
                        <input type="number" value="${item.bagCount}" min="1" class="customer-card__count-input w-16 py-1 px-2 bg-secondary border border-dynamic text-primary rounded-lg text-sm focus:ring-1 ring-accent transition">
                        <button data-action="save-count" class="p-2 text-green-400 hover:text-green-300 transition" title="Kaydet">${icons.save}</button>
                        <button data-action="cancel-edit-count" class="p-2 text-red-500 hover:text-red-400 transition" title="Vazgeç">${icons.cancel}</button>
                    </div>
                    <div class="customer-card__actions-default">
                    <span class="customer-card__bag-pill default-bag-display tabular-nums ${waitVisual.bagPillClasses}">${item.bagCount}</span>
                    </div>
                </div>
            </div>
        </div>`;
    return div;
}

const DASH_ICON_DELIVER = '<svg class="h-5 w-5 shrink-0 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
const DASH_ICON_PLUS = '<svg class="h-5 w-5 shrink-0 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>';

function escapeDashboardHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Teslim Telegram bot / hızlı teslim ile mi (kayıt deliveredBy + eski veri). */
function isDeliveredViaTelegram(item) {
    const d = String(item?.deliveredBy ?? '').trim();
    if (!d) return false;
    return d === 'Telegram' || d.startsWith('Telegram ') || d.includes('Bot (Buton)');
}

/**
 * Son teslimat ve kayıt eklemelerinden oluşan kronoloji (en fazla `limit` satır)
 */
export function buildRecentActionRows(allItems, formatRelativeTimeFn, limit = 4) {
    if (!allItems?.length) return [];

    const firstItemIdByCustomer = new Map();
    const sortedByCreated = [...allItems].sort(
        (a, b) => firestoreOrDateToSeconds(a.createdAt) - firestoreOrDateToSeconds(b.createdAt)
    );
    for (const it of sortedByCreated) {
        const k = toTrUpperCase(it.customerName);
        if (!firstItemIdByCustomer.has(k)) firstItemIdByCustomer.set(k, it.id);
    }

    const events = [];
    for (const item of allItems) {
        if (item.status === 'delivered' && item.deliveredAt) {
            const t = firestoreOrDateToSeconds(item.deliveredAt);
            if (t > 0) {
                const deliverText = isDeliveredViaTelegram(item)
                    ? `${item.customerName} — ${item.bagCount} poşet Telegram üzerinden teslim edildi`
                    : `${item.customerName} — ${item.bagCount} poşet teslim edildi`;
                events.push({
                    t,
                    icon: DASH_ICON_DELIVER,
                    text: escapeDashboardHtml(deliverText),
                    sortKey: `d-${item.id}-${t}`,
                });
            }
        }
        if (item.createdAt) {
            const t = firestoreOrDateToSeconds(item.createdAt);
            if (t > 0) {
                const k = toTrUpperCase(item.customerName);
                const isFirst = firstItemIdByCustomer.get(k) === item.id;
                const rawText = isFirst
                    ? `Yeni müşteri eklendi: ${item.customerName}`
                    : `${item.customerName} — ${item.bagCount} poşet kaydı eklendi`;
                events.push({
                    t,
                    icon: DASH_ICON_PLUS,
                    text: escapeDashboardHtml(rawText),
                    sortKey: `c-${item.id}-${t}`,
                });
            }
        }
    }

    events.sort((a, b) => b.t - a.t);
    const seen = new Set();
    const rows = [];
    for (const e of events) {
        if (seen.has(e.sortKey)) continue;
        seen.add(e.sortKey);
        rows.push({
            icon: e.icon,
            text: e.text,
            timeLabel: formatRelativeTimeFn(new Date(e.t * 1000)),
        });
        if (rows.length >= limit) break;
    }
    return rows;
}

export function renderDashboard(dom, allItems, formatDateFn, formatRelativeTimeFn) {
    const activeItems = allItems.filter(item => item.status !== 'delivered');
    const archivedItems = allItems.filter(item => item.status === 'delivered');
    const waitingCustomers = new Set(activeItems.map(item => item.customerName));
    const waitingBags = activeItems.reduce((sum, item) => sum + item.bagCount, 0);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const deliveredLastWeek = archivedItems.filter(item => {
        const d = item.deliveredAt?.seconds ? new Date(item.deliveredAt.seconds * 1000) : new Date(item.deliveredAt);
        return d >= sevenDaysAgo;
    }).reduce((sum, item) => sum + item.bagCount, 0);
    const now = new Date();
    const overdueNames = new Set();
    activeItems.forEach((item) => {
        const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt || new Date());
        const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));
        if (diffDays >= 20) overdueNames.add(item.customerName);
    });
    dom.dashboard.waitingCustomers.textContent = waitingCustomers.size;
    dom.dashboard.waitingBags.textContent = waitingBags;
    dom.dashboard.deliveredLastWeek.textContent = deliveredLastWeek;
    if (dom.dashboard.overdueCustomers) dom.dashboard.overdueCustomers.textContent = overdueNames.size;
    const sortedActive = [...activeItems].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    if (sortedActive.length > 0) {
        dom.dashboard.oldestCustomers.innerHTML = sortedActive.slice(0, 3).map(item => `
            <div class="dashboard-mini-row dashboard-oldest-row">
                <span class="dashboard-list-name text-primary min-w-0 break-words">${item.customerName}</span>
                <span class="dashboard-list-meta text-secondary shrink-0">${formatRelativeTimeFn(item.createdAt)}</span>
            </div>
        `).join('');
    } else {
        dom.dashboard.oldestCustomers.innerHTML = '<p class="dashboard-empty text-secondary text-center py-4">Bekleyen müşteri yok.</p>';
    }
    const today = new Date().toISOString().slice(0, 10);
    const formatReminderDayLabel = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return '';
        const p = dateStr.split('-').map(Number);
        if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return dateStr;
        const d = new Date(p[0], p[1] - 1, p[2]);
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    const reminders = allItems
        .filter((item) => item.status === 'active' && item.reminderDate && item.reminderDate <= today)
        .sort((a, b) => {
            const cmp = String(a.reminderDate).localeCompare(String(b.reminderDate));
            if (cmp !== 0) return cmp;
            return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        });
    if (reminders.length > 0) {
        dom.dashboard.reminders.innerHTML = reminders.map((item) => {
            const dayLabel = formatReminderDayLabel(item.reminderDate);
            const isPast = item.reminderDate < today;
            const dateBadge = isPast
                ? `<span class="dashboard-reminder-date text-amber-300/90 shrink-0 text-xs font-medium" title="Geçmiş hatırlatma">${dayLabel}</span>`
                : `<span class="dashboard-reminder-date text-cyan-300/90 shrink-0 text-xs font-medium" title="Bugün">${dayLabel}</span>`;
            return `
            <div class="dashboard-reminder-card">
                <div class="flex items-start justify-between gap-2">
                    <p class="dashboard-reminder-name font-semibold text-primary min-w-0">${item.customerName}</p>
                    ${dateBadge}
                </div>
                <p class="dashboard-reminder-note text-secondary mt-0.5 line-clamp-2">${item.note || 'Hatırlatma'}</p>
            </div>`;
        }).join('');
    } else {
        dom.dashboard.reminders.innerHTML = '<p class="dashboard-empty text-secondary text-center py-4">Bugün veya geçmiş tarihli hatırlatma yok.</p>';
    }

    if (dom.dashboard.recentActions) {
        const rows = buildRecentActionRows(allItems, formatRecentActionAge, 4);
        if (rows.length > 0) {
            dom.dashboard.recentActions.innerHTML = rows
                .map(
                    (row) => `
            <div class="dashboard-recent-row">
                <span class="mt-0.5" aria-hidden="true">${row.icon}</span>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium leading-snug text-primary">${row.text}</p>
                    <p class="mt-0.5 text-xs text-secondary">${row.timeLabel}</p>
                </div>
            </div>`
                )
                .join('');
        } else {
            dom.dashboard.recentActions.innerHTML =
                '<p class="dashboard-empty text-secondary py-4 text-center">Henüz işlem yok.</p>';
        }
    }
}

/**
 * Ana sayfa KPI kutusundan detay modalı (`customers` / `bags` bekleyen listesi; `week` teslimler; `alert` gecikenler).
 */
export function showDashboardKpiDetailModal(dom, kpiKind, allItems, formatDateFn) {
    if (!dom?.modalContent) return;

    const activeItems = allItems.filter((item) => item.status !== 'delivered');
    const archivedItems = allItems.filter((item) => item.status === 'delivered');
    const esc = escapeDashboardHtml;

    let title = '';
    let subtitle = '';
    let rowsHtml = '';

    if (kpiKind === 'customers' || kpiKind === 'bags') {
        const map = new Map();
        for (const it of activeItems) {
            const nm = String(it.customerName ?? '').trim();
            if (!nm) continue;
            map.set(nm, (map.get(nm) || 0) + (Number(it.bagCount) || 0));
        }
        const entries = [...map.entries()].sort((a, b) => toTrUpperCase(a[0]).localeCompare(toTrUpperCase(b[0]), 'tr'));
        const totalBags = entries.reduce((s, [, v]) => s + v, 0);
        title = kpiKind === 'customers' ? 'Bekleyen müşteriler' : 'Bekleyen poşet özeti';
        subtitle = `<p class="text-secondary text-sm mb-3">${entries.length} müşteri · toplam <span class="text-primary font-medium">${totalBags}</span> poşet</p>`;
        if (entries.length === 0) {
            rowsHtml = '<p class="text-secondary py-8 text-center">Bekleyen kayıt yok.</p>';
        } else {
            rowsHtml = entries
                .map(
                    ([name, bags]) => `
                <div class="flex items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-slate-900/35 px-3 py-2.5">
                    <span class="text-primary font-medium min-w-0 break-words">${esc(name)}</span>
                    <span class="text-secondary shrink-0 tabular-nums text-sm">${bags} poşet</span>
                </div>`
                )
                .join('');
        }
    } else if (kpiKind === 'week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = archivedItems.filter((item) => {
            if (!item.deliveredAt) return false;
            const d = item.deliveredAt.seconds != null ? new Date(item.deliveredAt.seconds * 1000) : new Date(item.deliveredAt);
            return Number.isFinite(d.getTime()) && d >= sevenDaysAgo;
        });
        recent.sort((a, b) => firestoreOrDateToSeconds(b.deliveredAt) - firestoreOrDateToSeconds(a.deliveredAt));
        const bagSum = recent.reduce((s, it) => s + (Number(it.bagCount) || 0), 0);
        title = 'Son 7 günlük teslimatlar';
        subtitle = `<p class="text-secondary text-sm mb-3">${recent.length} kayıt · toplam <span class="text-primary font-medium">${bagSum}</span> poşet</p>`;
        if (recent.length === 0) {
            rowsHtml = '<p class="text-secondary py-8 text-center">Bu aralıkta teslim kaydı yok.</p>';
        } else {
            rowsHtml = recent
                .map((it) => {
                    const when = formatDateFn(it.deliveredAt);
                    return `
                <div class="flex items-start justify-between gap-3 rounded-xl border border-white/[0.08] bg-slate-900/35 px-3 py-2.5">
                    <div class="min-w-0">
                        <p class="text-primary font-medium break-words">${esc(it.customerName)}</p>
                        <p class="text-secondary text-xs mt-0.5">${esc(when)}</p>
                    </div>
                    <span class="text-emerald-300/95 shrink-0 tabular-nums text-sm">${Number(it.bagCount) || 0} poşet</span>
                </div>`;
                })
                .join('');
        }
    } else if (kpiKind === 'alert') {
        const nowPlain = new Date();
        const overdue = [];
        for (const it of activeItems) {
            const itemDate = it.createdAt?.seconds ? new Date(it.createdAt.seconds * 1000) : new Date(it.createdAt || new Date());
            const diffDays = Math.floor(
                (new Date(nowPlain.getFullYear(), nowPlain.getMonth(), nowPlain.getDate()) -
                    new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate())) /
                    (1000 * 60 * 60 * 24)
            );
            if (diffDays >= 20) overdue.push({ item: it, diffDays });
        }
        overdue.sort(
            (a, b) =>
                b.diffDays - a.diffDays ||
                toTrUpperCase(a.item.customerName).localeCompare(toTrUpperCase(b.item.customerName), 'tr')
        );
        const uniqueCustomers = new Set(overdue.map((o) => o.item.customerName));
        title = 'Gecikmiş siparişler (20+ gün)';
        subtitle = `<p class="text-secondary text-sm mb-3">${uniqueCustomers.size} müşteri · ${overdue.length} bekleyen kayıt</p>`;
        if (overdue.length === 0) {
            rowsHtml = '<p class="text-secondary py-8 text-center">Bu kriterde geciken kayıt yok.</p>';
        } else {
            rowsHtml = overdue
                .map(
                    ({ item, diffDays }) => `
                <div class="flex items-start justify-between gap-3 rounded-xl border border-red-500/25 bg-red-950/25 px-3 py-2.5">
                    <div class="min-w-0">
                        <p class="text-primary font-medium break-words">${esc(item.customerName)}</p>
                        <p class="text-secondary text-xs mt-0.5">${diffDays} gündür bekliyor</p>
                    </div>
                    <span class="text-red-200/95 shrink-0 tabular-nums text-sm">${Number(item.bagCount) || 0} poşet</span>
                </div>`
                )
                .join('');
        }
    } else {
        return;
    }

    if (dom.modalContentWrapper) {
        dom.modalContentWrapper.classList.remove('max-w-2xl', 'max-w-4xl', 'max-w-5xl', 'w-full');
        dom.modalContentWrapper.classList.add('max-w-lg', 'w-full', 'max-h-[85vh]', 'flex', 'flex-col', 'overflow-hidden');
    }

    dom.modalContent.innerHTML = `
        <h3 class="text-xl font-semibold text-primary shrink-0 mb-1">${esc(title)}</h3>
        ${subtitle}
        <div id="dashboard-kpi-modal-scroll" class="dashboard-kpi-modal-scroll min-h-0 max-h-[min(380px,52vh)] flex-1 overflow-y-auto space-y-2 pr-1 -mr-1 mb-4">
            ${rowsHtml}
        </div>
        <div class="flex justify-end shrink-0 pt-1 border-t border-white/10">
            <button type="button" id="dashboard-kpi-modal-close" class="accent-bg text-white px-4 py-2 rounded-lg accent-bg-hover transition">Tamam</button>
        </div>`;

    dom.modalContent.querySelector('#dashboard-kpi-modal-close')?.addEventListener(
        'click',
        () => hideModalUI(dom),
        { once: true }
    );
    showModalUI(dom);
}

export function renderItems(dom, items, sortState, viewMode, searchQuery, formatDateFn, formatRelativeTimeFn, visibleCount, onLoadMore) {
    const direction = sortState.direction === 'asc' ? 1 : -1;
    const filtered = items.filter(item => toTrUpperCase(item.customerName).includes(searchQuery));
    const sorted = [...filtered].sort((a, b) => {
        if (sortState.type === 'alpha') return a.customerName.localeCompare(b.customerName, 'tr') * direction;
        if (sortState.type === 'bags') return (a.bagCount - b.bagCount) * direction;
        const dateA = a.createdAt?.seconds || new Date(a.createdAt || 0).getTime();
        const dateB = b.createdAt?.seconds || new Date(b.createdAt || 0).getTime();
        return (dateB - dateA) * direction;
    });
    dom.totalBagsCounter.textContent = sorted.reduce((s, i) => s + i.bagCount, 0);
    dom.totalCustomersCounter.textContent = new Set(sorted.map(i => i.customerName)).size;
    dom.itemList.innerHTML = '';
    dom.itemGrid.innerHTML = '';
    dom.emptyItemListMessage.style.display = sorted.length === 0 ? 'block' : 'none';
    dom.emptyItemListMessage.textContent = searchQuery ? `"${searchQuery}" İLE EŞLEŞEN SONUÇ BULUNAMADI.` : 'HENÜZ BEKLEYEN POŞET BULUNMUYOR.';

    const totalCount = sorted.length;
    const hasLimit = typeof visibleCount === 'number' && visibleCount > 0;
    const limit = hasLimit ? Math.min(visibleCount, totalCount) : totalCount;
    const pageItems = sorted.slice(0, limit);

    if (viewMode === 'list') {
        dom.itemList.classList.remove('hidden');
        dom.itemGrid.classList.add('hidden');
        pageItems.forEach(item => dom.itemList.appendChild(createItemElement(item, formatDateFn, formatRelativeTimeFn)));
    } else {
        dom.itemList.classList.add('hidden');
        dom.itemGrid.classList.remove('hidden');
        pageItems.forEach(item => dom.itemGrid.appendChild(createItemCardElement(item, formatDateFn, formatRelativeTimeFn)));
    }

    const loadMoreContainer = dom.loadMoreContainer || document.getElementById('load-more-container');
    if (!loadMoreContainer) return;
    loadMoreContainer.innerHTML = '';
    if (!hasLimit || limit >= totalCount) return;

    const remaining = totalCount - limit;
    const info = document.createElement('span');
    info.className = 'text-xs text-secondary';
    info.textContent = `${limit} / ${totalCount} kayıt gösteriliyor`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl accent-bg accent-bg-hover text-white text-sm font-semibold transition shadow-md';
    btn.innerHTML = `<svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg><span>Daha Fazla Göster (+${remaining})</span>`;
    btn.addEventListener('click', () => { if (typeof onLoadMore === 'function') onLoadMore(); }, { once: true });

    loadMoreContainer.appendChild(btn);
    loadMoreContainer.appendChild(info);
}

const ARCHIVE_ICONS = {
    clock: '<svg class="archive-meta-icon pointer-events-none h-3.5 w-3.5 shrink-0 self-center opacity-90 sm:h-4 sm:w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    user: '<svg class="archive-meta-icon archive-meta-icon--deliverer pointer-events-none h-3 w-3 shrink-0 self-center text-gray-500 opacity-95 sm:h-3.5 sm:w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
};

function createArchiveItemElement(item, formatDateFn) {
    const div = document.createElement('div');
    div.className =
        'archive-item-card gradient-border group flex items-center justify-between gap-2 rounded-xl border border-gray-700/35 bg-gray-900/25 p-3 shadow-sm transition-all duration-200 hover:border-gray-600/45 hover:bg-white/10 sm:gap-3 sm:p-4';
    div.dataset.id = item.id;
    const tgDeliver = isDeliveredViaTelegram(item);
    const deliveredByHtml = item.deliveredBy
        ? `<div class="archive-meta-row flex min-w-0 items-center gap-1.5 text-[11px] leading-tight text-gray-500 sm:text-xs">${ARCHIVE_ICONS.user}<span class="min-w-0 flex-1 break-words"><span class="text-gray-500/75">Teslim Eden:</span> ${escapeHtmlText(item.deliveredBy)}</span>${tgDeliver ? '<span class="inline-flex shrink-0 items-center rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300 ring-1 ring-sky-500/25" title="Telegram üzerinden teslim">Telegram</span>' : ''}</div>`
        : '';
    const kargoHtml =
        item.kargoIleGonderildi || item.cargoDesi != null || item.ambarIleGonderildi
            ? `<p class="archive-kargo-detail item-subtext pt-0.5 text-[11px] font-normal leading-snug text-gray-500/80 sm:text-xs">${item.ambarIleGonderildi ? 'Ambar' : 'Kargo'}: ${item.cargoDesi != null ? Number(item.cargoDesi).toFixed(2) + ' desi' : '—'}${item.ambarIleGonderildi ? ' · Ambarla gönderildi' : (item.kargoIleGonderildi ? ' · Kargo ile gönderildi' : '')}</p>`
            : '';
    div.innerHTML = `
        <div class="item-details flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-base font-bold tabular-nums text-blue-400 ring-1 ring-blue-400/20 sm:h-12 sm:w-12 sm:text-lg">${item.bagCount}</div>
            <div class="min-w-0 flex-1 space-y-1">
                <p class="text-base font-semibold leading-tight text-slate-100">${escapeHtmlText(item.customerName)}</p>
                <div class="archive-meta-row flex min-w-0 items-center gap-2 text-xs leading-tight text-gray-400 sm:text-sm">${ARCHIVE_ICONS.clock}<span class="min-w-0 flex-1 break-words">Teslim Edildi: ${formatDateFn(item.deliveredAt)}</span></div>
                ${deliveredByHtml}
                ${kargoHtml}
            </div>
        </div>
        <div class="item-actions ml-1 flex shrink-0 items-center gap-1 sm:gap-2">
            <button type="button" data-action="restore" class="rounded-full p-2 text-gray-400 transition hover:bg-blue-400/10 hover:text-blue-400" title="Geri Yükle"><svg class="pointer-events-none h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg></button>
            <button type="button" data-action="delete-permanent" class="rounded-full p-2 text-gray-400 transition hover:bg-red-500/10 hover:text-red-500" title="Kalıcı Olarak Sil"><svg class="pointer-events-none h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"/></svg></button>
        </div>`;
    return div;
}

/**
 * Arşiv filtre seçimlerini ilgili öğeye göre uygular.
 * filters: { customer?: string, deliverer?: string, shipment?: 'kargo'|'ambar'|'none'|'' }
 */
function applyArchiveFilters(items, filters = {}) {
    const customer = filters.customer ? toTrUpperCase(filters.customer) : '';
    const deliverer = filters.deliverer ? toTrUpperCase(filters.deliverer) : '';
    const shipment = filters.shipment || '';
    return items.filter(item => {
        if (customer && toTrUpperCase(item.customerName || '') !== customer) return false;
        if (deliverer && toTrUpperCase(item.deliveredBy || '') !== deliverer) return false;
        if (shipment === 'kargo' && !item.kargoIleGonderildi) return false;
        if (shipment === 'ambar' && !item.ambarIleGonderildi) return false;
        if (shipment === 'none' && (item.kargoIleGonderildi || item.ambarIleGonderildi)) return false;
        return true;
    });
}

/**
 * Arşivdeki öğelerden müşteri ve teslim eden listelerini çıkarıp select'leri doldurur.
 * Önceki seçim listede yoksa otomatik olarak boş (placeholder) seçeneğe döner.
 */
export function populateArchiveFilters(dom, archivedItems, currentFilters = {}) {
    const customerSel = dom.archiveFilterCustomer;
    const delivererSel = dom.archiveFilterDeliverer;
    const shipmentSel = dom.archiveFilterShipment;
    if (!customerSel || !delivererSel || !shipmentSel) return currentFilters;

    const customerSet = new Map();
    const delivererSet = new Map();
    archivedItems.forEach(item => {
        const cn = (item.customerName || '').trim();
        if (cn) {
            const key = toTrUpperCase(cn);
            if (!customerSet.has(key)) customerSet.set(key, cn);
        }
        const dn = (item.deliveredBy || '').trim();
        if (dn) {
            const key = toTrUpperCase(dn);
            if (!delivererSet.has(key)) delivererSet.set(key, dn);
        }
    });

    const trCmp = (a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' });
    const customers = [...customerSet.values()].sort(trCmp);
    const deliverers = [...delivererSet.values()].sort(trCmp);

    const fillSelect = (select, values, currentValue, placeholder = 'Seçin') => {
        const desired = currentValue || '';
        const exists = !desired || values.some(v => v === desired);
        const finalValue = exists ? desired : '';
        select.innerHTML = `<option value="">${placeholder}</option>` +
            values.map(v => `<option value="${escapeHtmlText(v)}"${v === finalValue ? ' selected' : ''}>${escapeHtmlText(v)}</option>`).join('');
        select.value = finalValue;
        select.classList.toggle('archive-filter-select--active', !!finalValue);
        return finalValue;
    };

    const nextCustomer = fillSelect(customerSel, customers, currentFilters.customer, 'Tümü');
    const nextDeliverer = fillSelect(delivererSel, deliverers, currentFilters.deliverer, 'Tümü');

    const shipmentValue = currentFilters.shipment || '';
    shipmentSel.value = shipmentValue;
    shipmentSel.classList.toggle('archive-filter-select--active', !!shipmentValue);

    return { customer: nextCustomer, deliverer: nextDeliverer, shipment: shipmentValue };
}

export function renderArchive(dom, archivedItems, searchQuery, archiveCurrentPage, itemsPerPage, formatDateFn, onPageChange, filters = {}) {
    const normalizedFilters = populateArchiveFilters(dom, archivedItems, filters);
    const searchFiltered = archivedItems.filter(item => toTrUpperCase(item.customerName).includes(searchQuery));
    const filtered = applyArchiveFilters(searchFiltered, normalizedFilters);
    const sorted = [...filtered].sort((a, b) => (b.deliveredAt?.seconds || 0) - (a.deliveredAt?.seconds || 0));
    dom.emptyArchiveListMessage.style.display = filtered.length === 0 ? 'block' : 'none';

    const summary = dom.archiveFilterSummary;
    const summaryText = dom.archiveFilterSummaryText;
    const hasActiveFilter = !!(normalizedFilters.customer || normalizedFilters.deliverer || normalizedFilters.shipment);
    if (summary && summaryText) {
        if (hasActiveFilter) {
            const parts = [];
            if (normalizedFilters.customer) parts.push(`Müşteri: <strong>${escapeHtmlText(normalizedFilters.customer)}</strong>`);
            if (normalizedFilters.deliverer) parts.push(`Teslim Eden: <strong>${escapeHtmlText(normalizedFilters.deliverer)}</strong>`);
            if (normalizedFilters.shipment) {
                const label = normalizedFilters.shipment === 'kargo' ? 'Kargo' : normalizedFilters.shipment === 'ambar' ? 'Ambar' : 'Sevkiyatsız';
                parts.push(`Sevkiyat: <strong>${label}</strong>`);
            }
            summaryText.innerHTML = `${parts.join(' · ')} <span class="opacity-75">(${filtered.length} kayıt)</span>`;
            summary.classList.remove('hidden');
        } else {
            summary.classList.add('hidden');
            summaryText.innerHTML = '';
        }
    }

    const filterToggle = dom.archiveFiltersToggle;
    if (filterToggle) {
        filterToggle.classList.toggle(
            'archive-filters-toggle--active',
            !!(normalizedFilters.customer || normalizedFilters.deliverer || normalizedFilters.shipment),
        );
    }

    const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
    const start = (archiveCurrentPage - 1) * itemsPerPage;
    const pageItems = sorted.slice(start, start + itemsPerPage);
    dom.archiveList.innerHTML = '';
    pageItems.forEach(item => dom.archiveList.appendChild(createArchiveItemElement(item, formatDateFn)));
    dom.archivePagination.innerHTML = '';
    if (totalPages <= 1) return;

    // --- Pagination Logic (Updated for Smart View) ---
    // Mobil uyumluluk için sadece 5 buton gösterilecek.
    const maxVisibleButtons = 5;
    let startPage = Math.max(1, archiveCurrentPage - Math.floor(maxVisibleButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

    if (endPage - startPage + 1 < maxVisibleButtons) {
        startPage = Math.max(1, endPage - maxVisibleButtons + 1);
    }

    const navBtnClass =
        'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-gray-700/60 bg-gray-800 px-2 text-sm font-medium text-gray-300 transition-colors duration-150 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-35';
    const pageBtnInactive =
        'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-gray-700/60 bg-gray-800 text-sm font-medium text-gray-300 transition-colors duration-150 hover:bg-gray-700';
    const pageBtnActive =
        'inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-transparent bg-[var(--accent-color-dark)] text-sm font-semibold text-white shadow-md ring-1 ring-white/10';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.innerHTML = '&lt;';
    prevBtn.className = navBtnClass;
    prevBtn.disabled = archiveCurrentPage === 1;
    prevBtn.onclick = () => onPageChange(archiveCurrentPage - 1);
    dom.archivePagination.appendChild(prevBtn);

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = String(i);
        btn.className = i === archiveCurrentPage ? pageBtnActive : pageBtnInactive;
        btn.onclick = () => onPageChange(i);
        dom.archivePagination.appendChild(btn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.innerHTML = '&gt;';
    nextBtn.className = navBtnClass;
    nextBtn.disabled = archiveCurrentPage === totalPages;
    nextBtn.onclick = () => onPageChange(archiveCurrentPage + 1);
    dom.archivePagination.appendChild(nextBtn);
}

function createNoteElement(item, formatDateFn) {
    const div = document.createElement('div');
    div.className = 'bg-primary p-4 rounded-lg shadow-md border border-dynamic';
    div.dataset.id = item.id;
    let reminderHtml = item.reminderDate ? `<p class="text-sm mt-2 text-cyan-300"><strong>Hatırlatıcı:</strong> ${item.reminderDate}</p>` : '';
    div.innerHTML = `
        <div class="flex justify-between items-start">
            <p class="font-semibold accent-text">${item.customerName}</p>
            <button data-action="delete-note-from-tab" class="p-1 -mt-1 -mr-1 text-secondary hover:text-red-500 rounded-full transition" title="Notu ve Hatırlatıcıyı Sil">${icons.delete}</button>
        </div>
        <p class="text-primary mt-2 whitespace-pre-wrap">${item.note || '<i>Not içeriği boş.</i>'}</p>
        ${reminderHtml}`;
    return div;
}

export function renderNotes(dom, allItems, formatDateFn) {
    if (!dom?.notesList || !dom?.emptyNotesMessage) return;
    const itemsWithNotes = allItems.filter(item => (item.note && item.note.trim() !== '') || item.reminderDate).sort((a, b) => (b.lastModified?.seconds || 0) - (a.lastModified?.seconds || 0));
    dom.notesList.innerHTML = '';
    dom.emptyNotesMessage.classList.toggle('hidden', itemsWithNotes.length > 0);
    itemsWithNotes.forEach(item => dom.notesList.appendChild(createNoteElement(item, formatDateFn)));
}

export function renderOverdueReport(allItems, formatRelativeTimeFn) {
    const overdueList = document.getElementById('overdue-report-list');
    const overdueMessage = document.getElementById('empty-overdue-report-message');
    const activeItems = allItems.filter(item => item.status !== 'active'); // Assuming active implies overdue check makes sense only for active items. Correction: Code logic uses active status.
    // Re-checking logic from original file:
    // const activeItems = allItems.filter(item => item.status !== 'delivered');
    // Correct logic applied below as per original file intent.
    const pendingItems = allItems.filter(item => item.status !== 'delivered'); 

    if (!overdueList || !overdueMessage) return; // Hata önleme
    
    if (pendingItems.length === 0) {
        overdueList.innerHTML = '';
        overdueMessage.classList.remove('hidden');
        return;
    }
    overdueMessage.classList.add('hidden');
    pendingItems.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const top10 = pendingItems.slice(0, 10);
    overdueList.innerHTML = top10.map((item, i) => `<div class="bg-tertiary p-3 rounded-md flex justify-between items-center"><span class="text-primary">${i + 1}. ${item.customerName}</span><span class="text-sm text-secondary">${formatRelativeTimeFn(item.createdAt)}</span></div>`).join('');
}

// Global chart instances
window.dashboardCharts = window.dashboardCharts || {};

export function renderPeriodicReport(allItems, range, formatDateFn) {
    const contentDiv = document.getElementById('periodic-report-content');
    if (!contentDiv) return;

    const reportPanel = document.getElementById('panel-reports');
    const isVisible = reportPanel && !reportPanel.classList.contains('hidden'); 
    
    if (!isVisible) {
        if (window.dashboardCharts.reportResizeObserver) {
            try { window.dashboardCharts.reportResizeObserver.disconnect(); } catch (_) { /* ignore */ }
            window.dashboardCharts.reportResizeObserver = null;
        }
        if (window.dashboardCharts.trend) { window.dashboardCharts.trend.destroy(); window.dashboardCharts.trend = null; }
        if (window.dashboardCharts.dist) { window.dashboardCharts.dist.destroy(); window.dashboardCharts.dist = null; }
        if (window.dashboardCharts.top) { window.dashboardCharts.top.destroy(); window.dashboardCharts.top = null; }
        return;
    }

    const chartsSection = document.getElementById('report-charts-section');
    if (chartsSection && chartsSection.classList.contains('hidden')) {
        if (window.dashboardCharts.reportResizeObserver) {
            try { window.dashboardCharts.reportResizeObserver.disconnect(); } catch (_) { /* ignore */ }
            window.dashboardCharts.reportResizeObserver = null;
        }
        if (window.dashboardCharts.trend) { window.dashboardCharts.trend.destroy(); window.dashboardCharts.trend = null; }
        if (window.dashboardCharts.dist) { window.dashboardCharts.dist.destroy(); window.dashboardCharts.dist = null; }
        if (window.dashboardCharts.top) { window.dashboardCharts.top.destroy(); window.dashboardCharts.top = null; }
        if (contentDiv) contentDiv.innerHTML = '';
        return;
    }

    if (range === null) {
        const activeBtn = document.querySelector('.report-range-btn.accent-bg') || document.querySelector('.report-range-btn[data-range="7"]');
        if(activeBtn) {
            activeBtn.classList.add('accent-bg', 'text-white');
            range = activeBtn.dataset.range;
        } else {
            range = '7'; 
        }
    }

    if (!range) {
        contentDiv.innerHTML = '<p class="text-center text-secondary">Raporu görmek için bir zaman aralığı seçin.</p>';
        return;
    }

    const endDate = new Date();
    const startDate = new Date();
    let rangeNum = 7;

    if (range === 'all') {
        startDate.setFullYear(2000, 0, 1);
    } else {
        rangeNum = parseInt(range, 10);
        startDate.setDate(endDate.getDate() - rangeNum + 1); 
    }
    startDate.setHours(0, 0, 0, 0);

    let totalBagsInRange = 0; 
    let deliveredBagsInRange = 0; 
    let waitingBagsFromRange = 0; 
    let totalWaitDays = 0;
    let deliveredCountForAvg = 0;

    const dailyData = {}; 
    
    if (range !== 'all') {
        for (let i = 0; i < rangeNum; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().slice(0, 10);
            dailyData[dateKey] = { added: 0, delivered: 0 };
        }
    }

    const customerStats = {}; 

    allItems.forEach(item => {
        const creationDate = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
        const creationDateStr = creationDate.toISOString().slice(0, 10);

        const initialBagCount = item.bagCount - (item.additionalDates?.length || 0);
        
        if (creationDate >= startDate) {
            totalBagsInRange += initialBagCount;
            if (item.status === 'active') {
                waitingBagsFromRange += initialBagCount;
            }

            if (dailyData[creationDateStr]) dailyData[creationDateStr].added += initialBagCount;
            else if (range === 'all') {
                 if(!dailyData[creationDateStr]) dailyData[creationDateStr] = { added: 0, delivered: 0 };
                 dailyData[creationDateStr].added += initialBagCount;
            }
            
            customerStats[item.customerName] = (customerStats[item.customerName] || 0) + initialBagCount;
        }

        (item.additionalDates || []).forEach(d => {
            const addDate = d.seconds ? new Date(d.seconds * 1000) : new Date(d);
            const addDateStr = addDate.toISOString().slice(0, 10);
            
            if (addDate >= startDate) {
                totalBagsInRange += 1;
                if (item.status === 'active') {
                    waitingBagsFromRange += 1;
                }

                if (dailyData[addDateStr]) dailyData[addDateStr].added += 1;
                else if (range === 'all') {
                    if(!dailyData[addDateStr]) dailyData[addDateStr] = { added: 0, delivered: 0 };
                    dailyData[addDateStr].added += 1;
                }
                customerStats[item.customerName] = (customerStats[item.customerName] || 0) + 1;
            }
        });

        if (item.status === 'delivered' && item.deliveredAt) {
            const delDate = item.deliveredAt.seconds ? new Date(item.deliveredAt.seconds * 1000) : new Date(item.deliveredAt);
            const delDateStr = delDate.toISOString().slice(0, 10);

            if (delDate >= startDate) {
                deliveredBagsInRange += item.bagCount;
                if (dailyData[delDateStr]) dailyData[delDateStr].delivered += item.bagCount;
                else if (range === 'all') {
                    if(!dailyData[delDateStr]) dailyData[delDateStr] = { added: 0, delivered: 0 };
                    dailyData[delDateStr].delivered += item.bagCount;
                }

                const diffTime = Math.abs(delDate - creationDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                totalWaitDays += diffDays * item.bagCount; 
                deliveredCountForAvg += item.bagCount;
            }
        }
    });

    const avgWaitTime = deliveredCountForAvg > 0 ? Math.round(totalWaitDays / deliveredCountForAvg) : 0;

    const sortedDates = Object.keys(dailyData).sort();
    const chartCategories = sortedDates.map(d => {
        const [y, m, day] = d.split('-');
        return `${day}/${m}`;
    });
    const seriesAdded = sortedDates.map(d => dailyData[d].added);
    const seriesDelivered = sortedDates.map(d => dailyData[d].delivered);

    const topCustomers = Object.entries(customerStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    if (window.dashboardCharts.reportResizeObserver) {
        try { window.dashboardCharts.reportResizeObserver.disconnect(); } catch (_) { /* ignore */ }
        window.dashboardCharts.reportResizeObserver = null;
    }
    if (window.dashboardCharts.trend) { window.dashboardCharts.trend.destroy(); window.dashboardCharts.trend = null; }
    if (window.dashboardCharts.dist) { window.dashboardCharts.dist.destroy(); window.dashboardCharts.dist = null; }
    if (window.dashboardCharts.top) { window.dashboardCharts.top.destroy(); window.dashboardCharts.top = null; }

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 lg:grid-cols-4">
            <div class="reports-stat-card reports-stat-card--blue gradient-border relative overflow-hidden rounded-2xl border border-gray-700/45 bg-gray-900/40 p-5 shadow-lg ring-1 ring-white/[0.04] backdrop-blur-sm">
                <div class="mb-3 flex items-start justify-between gap-2">
                    <span class="text-sm font-medium text-slate-400">Toplam Poşet</span>
                    <span class="inline-flex shrink-0 rounded-lg bg-blue-500/25 p-2 text-blue-400 ring-1 ring-blue-400/30">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </span>
                </div>
                <div class="text-3xl font-bold tabular-nums tracking-tight text-slate-50">${totalBagsInRange}</div>
                <div class="mt-1.5 text-xs text-slate-500">Bu dönemde eklenen</div>
            </div>
            <div class="reports-stat-card reports-stat-card--emerald gradient-border relative overflow-hidden rounded-2xl border border-gray-700/45 bg-gray-900/40 p-5 shadow-lg ring-1 ring-white/[0.04] backdrop-blur-sm">
                <div class="mb-3 flex items-start justify-between gap-2">
                    <span class="text-sm font-medium text-slate-400">Teslim Edildi</span>
                    <span class="inline-flex shrink-0 rounded-lg bg-emerald-500/25 p-2 text-emerald-400 ring-1 ring-emerald-400/30">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                </div>
                <div class="text-3xl font-bold tabular-nums tracking-tight text-slate-50">${deliveredBagsInRange}</div>
                <div class="mt-1.5 text-xs text-slate-500">Bu dönemde teslim edilen</div>
            </div>
            <div class="reports-stat-card reports-stat-card--amber gradient-border relative overflow-hidden rounded-2xl border border-gray-700/45 bg-gray-900/40 p-5 shadow-lg ring-1 ring-white/[0.04] backdrop-blur-sm">
                <div class="mb-3 flex items-start justify-between gap-2">
                    <span class="text-sm font-medium text-slate-400">Ort. Bekleme</span>
                    <span class="inline-flex shrink-0 rounded-lg bg-amber-500/25 p-2 text-amber-300 ring-1 ring-amber-400/35">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                </div>
                <div class="text-3xl font-bold tabular-nums tracking-tight text-slate-50">${avgWaitTime}</div>
                <div class="mt-1.5 text-xs text-slate-500">Ortalama gün</div>
            </div>
            <div class="reports-stat-card reports-stat-card--violet gradient-border relative overflow-hidden rounded-2xl border border-gray-700/45 bg-gray-900/40 p-5 shadow-lg ring-1 ring-white/[0.04] backdrop-blur-sm">
                <div class="mb-3 flex items-start justify-between gap-2">
                    <span class="text-sm font-medium text-slate-400">Bekleyen</span>
                    <span class="inline-flex shrink-0 rounded-lg bg-violet-500/25 p-2 text-violet-300 ring-1 ring-violet-400/35">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </span>
                </div>
                <div class="text-3xl font-bold tabular-nums tracking-tight text-slate-50">${waitingBagsFromRange}</div>
                <div class="mt-1.5 text-xs text-slate-500">Bu dönemden kalan</div>
            </div>
        </div>

        <div class="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <div class="report-chart-box gradient-border rounded-xl border border-gray-700/40 bg-tertiary/80 p-4 shadow-inner">
                <h3 class="mb-3 font-semibold text-primary">Günlük Aktivite Trendi</h3>
                <div id="chart-trend" class="relative h-64 w-full min-w-0 max-w-full"></div>
            </div>

            <div class="report-chart-box gradient-border rounded-xl border border-gray-700/40 bg-tertiary/80 p-4 shadow-inner">
                <h3 class="mb-3 font-semibold text-primary">Poşet Durum Dağılımı</h3>
                <div id="chart-distribution" class="relative h-64 w-full min-w-0 max-w-full"></div>
            </div>
        </div>

        <div class="report-chart-box gradient-border mt-6 rounded-xl border border-gray-700/40 bg-tertiary/80 p-4 pb-6 shadow-inner">
            <h3 class="mb-3 font-semibold text-primary">En Çok İşlem Yapan 10 Müşteri</h3>
            <div id="chart-top-customers" class="relative h-80 w-full min-w-0 max-w-full"></div>
        </div>
    `;

    if (typeof ApexCharts === 'undefined') return;

    const chartPxTrend = 256;
    const chartPxDist = 256;
    const chartPxTop = 320;

    const mountChartsWhenSized = () => {
        window.dashboardCharts._reportMountSeq = (window.dashboardCharts._reportMountSeq || 0) + 1;
        const mountSeq = window.dashboardCharts._reportMountSeq;
        let layoutAttempts = 0;
        const maxLayoutAttempts = 80;

        const tryMount = () => {
            if (mountSeq !== window.dashboardCharts._reportMountSeq) return;

            const elTrend = document.getElementById('chart-trend');
            const elDist = document.getElementById('chart-distribution');
            const elTop = document.getElementById('chart-top-customers');
            const section = document.getElementById('report-charts-section');

            if (!elTrend || !elDist || !elTop) return;
            if (!elTrend.isConnected || !elDist.isConnected || !elTop.isConnected) return;

            let wT = Math.floor(elTrend.getBoundingClientRect().width);
            let wD = Math.floor(elDist.getBoundingClientRect().width);
            let wTop = Math.floor(elTop.getBoundingClientRect().width);

            const minW = Math.min(wT, wD, wTop);
            if (minW < 32 && layoutAttempts++ < maxLayoutAttempts) {
                requestAnimationFrame(tryMount);
                return;
            }
            if (mountSeq !== window.dashboardCharts._reportMountSeq) return;

            const optionsTrend = {
                series: [{
                    name: 'Eklenen',
                    data: seriesAdded
                }, {
                    name: 'Teslim Edilen',
                    data: seriesDelivered
                }],
                chart: {
                    type: 'area',
                    height: chartPxTrend,
                    toolbar: { show: false },
                    zoom: { enabled: false },
                    background: 'transparent',
                    fontFamily: 'Inter, sans-serif',
                    parentHeightOffset: 0,
                    redrawOnParentResize: true,
                    redrawOnWindowResize: true
                },
                colors: ['#34d399', '#38bdf8'],
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2.5 },
                fill: {
                    type: 'gradient',
                    gradient: {
                        shadeIntensity: 1,
                        opacityFrom: 0.58,
                        opacityTo: 0.06,
                        stops: [0, 55, 100]
                    }
                },
                xaxis: {
                    categories: chartCategories,
                    labels: { style: { colors: '#94a3b8' } },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    labels: { style: { colors: '#94a3b8' } }
                },
                grid: {
                    borderColor: '#334155',
                    strokeDashArray: 4,
                    padding: { top: 6, right: 4, bottom: 0, left: 8 }
                },
                theme: { mode: 'dark' },
                tooltip: { theme: 'dark' },
                legend: { position: 'top' }
            };

            const optionsDist = {
                series: [waitingBagsFromRange, deliveredBagsInRange],
                labels: ['Bekleyen', 'Teslim Edilen'],
                chart: {
                    type: 'donut',
                    height: chartPxDist,
                    background: 'transparent',
                    fontFamily: 'Inter, sans-serif',
                    parentHeightOffset: 0,
                    redrawOnParentResize: true,
                    redrawOnWindowResize: true
                },
                colors: ['#FACC15', '#34D399'],
                plotOptions: {
                    pie: {
                        offsetX: 0,
                        offsetY: 0,
                        donut: {
                            size: '75%',
                            labels: {
                                show: true,
                                name: { color: '#cbd5e1', offsetY: 20 },
                                value: {
                                    color: '#f8fafc',
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                    offsetY: -20,
                                    formatter: function (val) { return val; }
                                },
                                total: {
                                    show: true,
                                    label: 'Toplam',
                                    color: '#94a3b8',
                                    fontSize: '14px',
                                    formatter: function (w) {
                                        return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                    }
                                }
                            }
                        }
                    }
                },
                stroke: { show: false },
                dataLabels: { enabled: false },
                legend: { position: 'bottom', labels: { colors: '#cbd5e1' } },
                theme: { mode: 'dark' }
            };

            const optionsTop = {
                series: [{
                    name: 'İşlem Sayısı',
                    data: topCustomers.map(c => c[1])
                }],
                chart: {
                    type: 'bar',
                    height: chartPxTop,
                    toolbar: { show: false },
                    background: 'transparent',
                    fontFamily: 'Inter, sans-serif',
                    parentHeightOffset: 0,
                    redrawOnParentResize: true,
                    redrawOnWindowResize: true
                },
                plotOptions: {
                    bar: {
                        borderRadius: 4,
                        horizontal: true,
                        barHeight: '60%',
                        distributed: true
                    }
                },
                colors: ['#a78bfa', '#818cf8', '#38bdf8', '#34d399', '#f472b6', '#e879f9', '#fbbf24', '#2dd4bf', '#c084fc', '#fb7185'],
                dataLabels: {
                    enabled: true,
                    textAnchor: 'start',
                    style: { colors: ['#fff'] },
                    formatter: function (val) {
                        return val;
                    },
                    offsetX: 0
                },
                xaxis: {
                    categories: topCustomers.map(c => c[0]),
                    labels: { show: true, style: { colors: '#94a3b8' } },
                    axisBorder: { show: false },
                    axisTicks: { show: false }
                },
                yaxis: {
                    labels: {
                        style: { colors: '#e2e8f0', fontSize: '13px' },
                        maxWidth: 160
                    }
                },
                grid: {
                    borderColor: '#334155',
                    strokeDashArray: 4,
                    xaxis: { lines: { show: true } },
                    yaxis: { lines: { show: false } },
                    padding: { top: 0, right: 0, bottom: 0, left: 10 }
                },
                theme: { mode: 'dark' },
                tooltip: { theme: 'dark' },
                legend: { show: false }
            };

            const chartTrend = new ApexCharts(elTrend, optionsTrend);
            const chartDist = new ApexCharts(elDist, optionsDist);
            const chartTop = new ApexCharts(elTop, optionsTop);

            window.dashboardCharts.trend = chartTrend;
            window.dashboardCharts.dist = chartDist;
            window.dashboardCharts.top = chartTop;

            const resizeReportCharts = () => {
                try {
                    chartTrend.resize();
                    chartDist.resize();
                    chartTop.resize();
                } catch (_) { /* instance replaced */ }
            };

            const afterRender = () => {
                resizeReportCharts();
                try { window.dispatchEvent(new Event('resize')); } catch (_) { /* ignore */ }
                requestAnimationFrame(() => {
                    resizeReportCharts();
                    requestAnimationFrame(() => {
                        resizeReportCharts();
                        setTimeout(resizeReportCharts, 0);
                        setTimeout(resizeReportCharts, 80);
                    });
                });
            };

            Promise.all([
                Promise.resolve(chartTrend.render()),
                Promise.resolve(chartDist.render()),
                Promise.resolve(chartTop.render())
            ]).then(afterRender);

            if (window.dashboardCharts.reportResizeObserver) {
                try { window.dashboardCharts.reportResizeObserver.disconnect(); } catch (_) { /* ignore */ }
            }
            const roTarget = section || document.getElementById('periodic-report-content');
            if (roTarget && typeof ResizeObserver !== 'undefined') {
                window.dashboardCharts.reportResizeObserver = new ResizeObserver(() => {
                    resizeReportCharts();
                });
                window.dashboardCharts.reportResizeObserver.observe(roTarget);
            }
        };

        requestAnimationFrame(() => {
            requestAnimationFrame(tryMount);
        });
    };

    mountChartsWhenSized();
}

/** Aktif kayıtlarda vadesi gelmiş (bugün ve öncesi) hatırlatmalar — okundu filtresi yok */
function getAllDueReminders(allItems) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allItems.filter(item => {
        if (item.status !== 'active' || !item.reminderDate) return false;
        const [y, m, d] = item.reminderDate.split('-').map(Number);
        const reminderDate = new Date(y, m - 1, d);
        return reminderDate <= today;
    });
}

/** active + overDueDays+ gün bekleyen kayıtlar — okundu filtresi yok */
function getAllOverdueActiveItems(allItems, overDueDays = 20) {
    const now = new Date();
    return allItems.filter(item => {
        if (item.status !== 'active') return false;
        const itemDate = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
        const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
        return diffDays >= overDueDays;
    });
}

export function getUnseenOverdueItems(allItems, seenNotifications, overDueDays = 20) {
    return getAllOverdueActiveItems(allItems, overDueDays).filter(item => !seenNotifications.includes(item.id));
}

export function getUnseenReminders(allItems, seenNotifications) {
    return getAllDueReminders(allItems).filter(item => !seenNotifications.includes(item.id));
}

export function checkAndDisplayNotifications(dom, allItems, seenNotifications, getUnseenRemindersFn, getUnseenOverdueItemsFn) {
    const unseenReminders = getUnseenRemindersFn(allItems, seenNotifications);
    const unseenOverdue = getUnseenOverdueItemsFn(allItems, seenNotifications);
    const totalUnseen = new Set([...unseenReminders.map(i => i.id), ...unseenOverdue.map(i => i.id)]).size;
    dom.notificationBadge.textContent = totalUnseen;
    dom.notificationBadge.classList.toggle('hidden', totalUnseen === 0);
}

export function showModalUI(dom) {
    dom.modalContainer.classList.remove('hidden');
    requestAnimationFrame(() => {
        dom.modalContainer.style.opacity = '1';
        dom.modalContentWrapper.classList.remove('scale-95', 'opacity-0');
    });
}

export function hideModalUI(dom) {
    dom.modalContainer.style.opacity = '0';
    dom.modalContentWrapper.classList.add('scale-95', 'opacity-0');
    if (dom.modalContentWrapper) {
        dom.modalContentWrapper.classList.remove(
            'max-w-4xl',
            'max-w-5xl',
            'max-w-lg',
            'w-full',
            'max-h-[85vh]',
            'flex',
            'flex-col',
            'overflow-hidden'
        );
        dom.modalContentWrapper.classList.add('max-w-2xl');
    }
    setTimeout(() => {
        dom.modalContainer.classList.add('hidden');
        dom.modalContent.innerHTML = '';
    }, 300);
}

/**
 * Hızlı, işlem akışını durdurmayan bildirim. 3 saniye sonra otomatik kapanır.
 * type: 'success' | 'error' | 'info' | 'warning'
 */
export function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const palette = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-amber-500',
    };
    const bgClass = palette[type] || palette.success;

    const icons = {
        success: '<svg class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
        error: '<svg class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
        info: '<svg class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
        warning: '<svg class="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
    };
    const iconHtml = icons[type] || icons.success;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 min-w-[240px] max-w-sm ${bgClass} text-white px-4 py-3 rounded-lg shadow-lg opacity-0 translate-y-2 transition-all duration-300 ease-out`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `
        ${iconHtml}
        <span class="flex-1 text-sm font-medium leading-snug break-words">${escapeHtmlText(String(message ?? ''))}</span>
        <button type="button" class="opacity-80 hover:opacity-100 text-white text-lg leading-none px-1 -mr-1 transition" aria-label="Kapat">&times;</button>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
        toast.classList.add('opacity-100', 'translate-y-0');
    });

    let removalTimer = null;
    const dismiss = () => {
        if (removalTimer) clearTimeout(removalTimer);
        removalTimer = null;
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('button').addEventListener('click', dismiss, { once: true });
    removalTimer = setTimeout(dismiss, 3000);
}

export function showSimpleMessageModal(dom, title, message, isSuccess = false) {
    return new Promise(resolve => {
        const titleColor = isSuccess ? 'text-green-400' : 'text-primary';
        dom.modalContent.innerHTML = `<h3 class="text-xl font-semibold mb-2 ${titleColor}">${title}</h3><p class="text-secondary mb-4">${message}</p><div class="flex justify-end gap-3"><button id="modal-confirm" class="accent-bg text-white px-4 py-2 rounded-lg accent-bg-hover transition">Tamam</button></div>`;
        dom.modalContent.querySelector('#modal-confirm').addEventListener('click', () => { hideModalUI(dom); resolve(true); }, { once: true });
        showModalUI(dom);
    });
}

export function showConfirmationModal(dom, message, confirmText = 'Onayla', isDestructive = false) {
    return new Promise(resolve => {
        const confirmClass = isDestructive ? 'bg-red-600 hover:bg-red-700' : 'accent-bg accent-bg-hover';
        dom.modalContent.innerHTML = `<h3 class="text-xl font-semibold mb-2 ${isDestructive ? 'text-red-400' : 'text-primary'}">Onay</h3><p class="text-secondary mb-6">${message}</p><div class="flex justify-end gap-3"><button id="modal-cancel" class="bg-tertiary px-4 py-2 rounded-lg hover:bg-slate-500 transition">İptal</button><button id="modal-confirm" class="${confirmClass} text-white px-4 py-2 rounded-lg transition">${confirmText}</button></div>`;
        dom.modalContent.querySelector('#modal-confirm').addEventListener('click', () => { hideModalUI(dom); resolve(true); }, { once: true });
        dom.modalContent.querySelector('#modal-cancel').addEventListener('click', () => { hideModalUI(dom); resolve(false); }, { once: true });
        showModalUI(dom);
    });
}

/** Varsayılan işaretli teslim personelinin adı; yoksa ilk kişi. */
export function preferredDeliverByNameFromPersonnel(personnel) {
    if (!personnel || personnel.length === 0) return '';
    const starred = personnel.find(p => p.isDefault);
    return starred?.name ?? personnel[0].name ?? '';
}

export function showDeliverConfirmationModal(dom, item, deliveryPersonnel, formatDateFn, allCustomers = []) {
    return new Promise(resolve => {
        const bagCount = item.bagCount ?? 1;
        const preferredDeliverer = preferredDeliverByNameFromPersonnel(deliveryPersonnel);
        const optionsHtml = deliveryPersonnel.length > 0 ? deliveryPersonnel.map(p => `<option value="${p.name}"${preferredDeliverer && p.name === preferredDeliverer ? ' selected' : ''}>${p.name}</option>`).join('') : '<option value="" disabled>Lütfen ayarlardan personel ekleyin</option>';
        
        // Yerel saati doğru hesaplamak için (TZ offseti çıkararak düzeltme)
        const now = new Date();
        const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        const today = local.toISOString().slice(0, 10);
        const currentTime = local.toISOString().slice(11, 16);

        let appliedCargoDesi = null;
        let kargoMount = null;
        /** null = henüz seçim yok (ikisi de gri); teslimatta varsayılan kargo */
        let deliverShipmentMode = null;

        dom.modalContent.innerHTML = `
            <h3 class="text-xl font-semibold mb-2 text-primary">Teslimatı Onayla</h3>
            <p class="text-secondary mb-4">'${item.customerName}' adlı müşterinin poşetini teslim etmek istediğinizden emin misiniz?</p>
            <div class="space-y-4 mb-6">
                <div>
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <label for="deliver-bag-count-input" class="block text-sm font-medium text-secondary">Teslim edilen poşet sayısı:</label>
                        <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button type="button" id="deliver-shipment-ambar" class="shipment-mode-toggle shipment-mode--inactive">Ambar</button>
                            <span class="text-secondary text-xs select-none opacity-50" aria-hidden="true">|</span>
                            <button type="button" id="open-kargo-embed" class="shipment-mode-toggle shipment-mode--inactive">Kargo Hesapla</button>
                        </div>
                    </div>
                    <input type="number" id="deliver-bag-count-input" min="1" max="${bagCount}" value="${bagCount}" class="w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">
                    <p class="text-xs text-secondary mt-1">Müşterinin toplam ${bagCount} poşeti var. Kısmi teslim için sayıyı azaltın.</p>
                    <p id="deliver-cargo-summary" class="hidden text-xs text-accent-text mt-2 font-medium">Aktarılan desi: <span id="deliver-cargo-desi-val">—</span></p>
                    <div id="kargo-embed-wrap" class="mt-3 hidden min-h-0 min-w-0 max-w-full overflow-x-hidden rounded-xl border border-dynamic bg-secondary/50 p-1.5 sm:p-2"></div>
                </div>
                <div>
                    <label for="delivered-by-select" class="block text-sm font-medium text-secondary mb-1">Teslim Eden Kişi:</label>
                    <select id="delivered-by-select" class="w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">${optionsHtml}</select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="delivery-date-input" class="block text-sm font-medium text-secondary mb-1">Teslim Tarihi:</label>
                        <input type="date" id="delivery-date-input" value="${today}" class="w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">
                    </div>
                    <div>
                        <label for="delivery-time-input" class="block text-sm font-medium text-secondary mb-1">Teslim Saati:</label>
                        <input type="time" id="delivery-time-input" value="${currentTime}" class="w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">
                    </div>
                </div>
            </div>
            <div class="flex justify-end gap-3">
                <button id="modal-cancel" class="bg-tertiary px-4 py-2 rounded-lg hover:bg-slate-500 transition">İptal</button>
                <button type="button" id="modal-confirm" class="accent-bg text-white px-4 py-2 rounded-lg accent-bg-hover transition disabled:opacity-50" ${deliveryPersonnel.length === 0 ? 'disabled' : ''}>Teslim Et</button>
            </div>`;
        
        // Element referansları
        const select = dom.modalContent.querySelector('#delivered-by-select');
        const dateInput = dom.modalContent.querySelector('#delivery-date-input');
        const timeInput = dom.modalContent.querySelector('#delivery-time-input');
        const confirmBtn = dom.modalContent.querySelector('#modal-confirm');
        const cancelBtn = dom.modalContent.querySelector('#modal-cancel');
        const inputEl = dom.modalContent.querySelector('#deliver-bag-count-input');
        const kargoWrap = dom.modalContent.querySelector('#kargo-embed-wrap');
        const openKargoBtn = dom.modalContent.querySelector('#open-kargo-embed');
        const ambarModeBtn = dom.modalContent.querySelector('#deliver-shipment-ambar');
        const cargoSummary = dom.modalContent.querySelector('#deliver-cargo-summary');
        const cargoDesiSpan = dom.modalContent.querySelector('#deliver-cargo-desi-val');

        /** Ambar / Kargo: null = seçim yok (gri). Kargo Hesapla: yalnızca gömülü alan açıkken mavi. */
        const updateDeliverShipmentModeUI = () => {
            const ambarActive = deliverShipmentMode === 'ambar';
            ambarModeBtn?.classList.toggle('shipment-mode--active', ambarActive);
            ambarModeBtn?.classList.toggle('shipment-mode--inactive', !ambarActive);
            const kargoEmbedOpen = !!(kargoWrap && !kargoWrap.classList.contains('hidden'));
            openKargoBtn?.classList.toggle('shipment-mode--active', kargoEmbedOpen);
            openKargoBtn?.classList.toggle('shipment-mode--inactive', !kargoEmbedOpen);
        };
        updateDeliverShipmentModeUI();

        ambarModeBtn?.addEventListener('click', () => {
            if (deliverShipmentMode === 'ambar') {
                deliverShipmentMode = null;
            } else {
                deliverShipmentMode = 'ambar';
                if (kargoWrap && !kargoWrap.classList.contains('hidden')) {
                    kargoWrap.classList.add('hidden');
                }
            }
            updateDeliverShipmentModeUI();
            ambarModeBtn?.blur();
        });

        openKargoBtn?.addEventListener('click', () => {
            if (!kargoWrap) return;
            const wasOpen = !kargoWrap.classList.contains('hidden');
            if (wasOpen) {
                kargoWrap.classList.add('hidden');
                deliverShipmentMode = null;
                updateDeliverShipmentModeUI();
                openKargoBtn?.blur();
                return;
            }
            deliverShipmentMode = 'kargo';
            kargoWrap.classList.remove('hidden');
            if (!kargoMount) {
                kargoMount = mountKargoCalculator(kargoWrap, {
                    tabbed: false,
                    compact: true,
                    hideCustomerBlock: true,
                    allCustomers,
                    onApplyDesi: (desi) => {
                        appliedCargoDesi = desi;
                        if (cargoDesiSpan) cargoDesiSpan.textContent = desi.toFixed(2);
                        cargoSummary?.classList.remove('hidden');
                        kargoWrap.classList.add('hidden');
                        deliverShipmentMode = 'kargo';
                        updateDeliverShipmentModeUI();
                        openKargoBtn?.blur();
                    },
                });
            }
            updateDeliverShipmentModeUI();
        });

        confirmBtn.addEventListener('click', () => {
            let count = 1;
            if (inputEl) {
                count = parseInt(inputEl.value, 10);
            }
            if (isNaN(count) || count < 1) count = 1;
            if (count > bagCount) count = bagCount;
            
            if (kargoMount?.destroy) kargoMount.destroy();
            hideModalUI(dom);
            resolve({ 
                confirmed: true, 
                deliveredBy: select.value, 
                deliveryDate: dateInput.value, 
                deliveryTime: timeInput.value, 
                deliveredCount: count,
                cargoDesi: appliedCargoDesi,
                shipmentMethod: deliverShipmentMode ?? 'kargo',
            });
        }, { once: true });

        cancelBtn.addEventListener('click', () => {
            if (kargoMount?.destroy) kargoMount.destroy();
            hideModalUI(dom);
            resolve({ confirmed: false });
        }, { once: true });

        showModalUI(dom);
    });
}

/** Arşiv / tam ekran kargo hesaplama modalı (Hesapla, Fiyatlar, Geçmiş) */
export function showKargoDesiFullModal(dom, allCustomers = [], activeItems = [], deliveryPersonnel = []) {
    return new Promise((resolve) => {
        if (dom.modalContentWrapper) {
            dom.modalContentWrapper.classList.remove('max-w-2xl');
            dom.modalContentWrapper.classList.add('max-w-5xl', 'w-full');
        }

        const active = (activeItems || []).filter(i => i.status !== 'delivered');
        const optionsHtml = active.length > 0
            ? active.map(i => `<option value="${i.id}">${i.customerName}</option>`).join('')
            : '<option value="">Bekleyen müşteri yok</option>';
        const preferredDeliverer = preferredDeliverByNameFromPersonnel(deliveryPersonnel);
        const personnelOptionsHtml = deliveryPersonnel.length > 0
            ? deliveryPersonnel.map(p => `<option value="${p.name}"${preferredDeliverer && p.name === preferredDeliverer ? ' selected' : ''}>${p.name}</option>`).join('')
            : '<option value="" disabled>Lütfen ayarlardan personel ekleyin</option>';
        const saveDisabled = active.length === 0 || deliveryPersonnel.length === 0;

        let shipmentMethod = 'kargo';
        const updateShipmentUI = () => {
            const badge = dom.modalContent.querySelector('#kargo-shipment-mode');
            if (badge) {
                if (shipmentMethod === 'ambar') badge.textContent = 'Sevkiyat: AMBAR';
                else if (shipmentMethod === null) badge.textContent = 'Sevkiyat: seçilmedi (kargo hesabı kullanılır)';
                else badge.textContent = 'Sevkiyat: KARGO';
            }
            if (saveBtn) {
                saveBtn.textContent =
                    shipmentMethod === 'ambar' ? 'Ambarla Teslim Et' : 'Kargoyla teslim et';
            }
        };

        dom.modalContent.innerHTML = `
            <div class="mb-3 flex min-w-0 items-start justify-between gap-2">
                <h3 class="min-w-0 flex-1 break-words text-xl font-semibold leading-tight text-primary">Kargo Desi Hesaplama</h3>
                <button type="button" id="kargo-full-close" class="shrink-0 p-1 text-secondary transition hover:text-primary" aria-label="Kapat">${icons.cancel}</button>
            </div>

            <div class="mb-3 min-w-0 max-w-full rounded-xl border border-dynamic bg-tertiary/40 p-3">
                <div class="grid grid-cols-1 items-end gap-3 md:grid-cols-3">
                    <div class="min-w-0 md:col-span-2">
                        <label for="kargo-full-customer-select" class="mb-1 block text-sm font-medium text-secondary">Bekleyen Müşteri</label>
                        <select id="kargo-full-customer-select" class="w-full min-w-0 max-w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">${optionsHtml}</select>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm text-secondary">Poşet Sayısı</p>
                        <input type="number" id="kargo-full-bag-count" min="1" value="0" class="w-full max-w-[10rem] p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition text-primary font-semibold sm:w-28">
                    </div>
                </div>
                <div class="mt-3 min-w-0">
                    <label for="kargo-full-delivered-by" class="mb-1 block text-sm font-medium text-secondary">Teslim Eden Kişi</label>
                    <select id="kargo-full-delivered-by" class="w-full min-w-0 max-w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">${personnelOptionsHtml}</select>
                </div>
                <div class="mt-3 flex justify-end">
                    <button type="button" id="kargo-full-save-deliver" class="w-full max-w-sm accent-bg px-4 py-2 text-white rounded-lg accent-bg-hover transition disabled:opacity-50 sm:w-auto" ${saveDisabled ? 'disabled' : ''}>Kargoyla teslim et</button>
                </div>
            </div>
            <div class="mb-2 text-xs text-secondary" id="kargo-shipment-mode">Sevkiyat: KARGO</div>

            <div id="kargo-full-root" class="min-h-[200px] min-w-0 max-w-full overflow-x-hidden"></div>`;

        const root = dom.modalContent.querySelector('#kargo-full-root');
        const closeBtn = dom.modalContent.querySelector('#kargo-full-close');
        const saveBtn = dom.modalContent.querySelector('#kargo-full-save-deliver');
        const customerSelect = dom.modalContent.querySelector('#kargo-full-customer-select');
        const bagCountEl = dom.modalContent.querySelector('#kargo-full-bag-count');
        const deliveredBySelect = dom.modalContent.querySelector('#kargo-full-delivered-by');

        const kargoApi = mountKargoCalculator(root, {
            tabbed: true,
            compact: false,
            hideCustomerBlock: true,
            hideWhatsappButton: true,
            nonCompactPrimaryLabel: 'Ambar',
            onNonCompactPrimary: (ctx) => {
                shipmentMethod = ctx.mode === 'ambar' ? 'ambar' : ctx.mode === null ? null : 'kargo';
                updateShipmentUI();
            },
            allCustomers
        });

        const syncBagCount = () => {
            shipmentMethod = 'kargo';
            kargoApi?.resetAmbarButton?.();
            const item = active.find(i => i.id === customerSelect?.value);
            if (bagCountEl) {
                const maxVal = Number(item?.bagCount || 0);
                bagCountEl.max = String(maxVal);
                bagCountEl.value = String(maxVal);
            }
            updateShipmentUI();
        };
        syncBagCount();
        customerSelect?.addEventListener('change', syncBagCount);

        const cleanupAndClose = () => {
            if (kargoApi?.destroy) kargoApi.destroy();
            hideModalUI(dom);
        };

        closeBtn?.addEventListener('click', () => {
            cleanupAndClose();
            resolve({ confirmed: false });
        }, { once: true });

        saveBtn?.addEventListener('click', () => {
            const item = active.find(i => i.id === customerSelect?.value);
            const cargoDesi = Number(kargoApi?.getTotalDesi?.() || 0);
            const deliveredBy = deliveredBySelect?.value?.trim() || '';
            if (!item) {
                resolve({ confirmed: false });
                cleanupAndClose();
                return;
            }
            if (!deliveredBy) {
                showSimpleMessageModal(dom, 'Eksik Bilgi', 'Teslim eden kişiyi seçin veya ayarlardan teslim personeli ekleyin.');
                return;
            }
            if (shipmentMethod !== 'ambar' && (!cargoDesi || cargoDesi <= 0)) {
                showSimpleMessageModal(dom, 'Eksik Bilgi', 'Teslim kaydı için önce kargo paketlerini ekleyip desi hesaplayın.');
                return;
            }
            cleanupAndClose();
            const maxBag = Number(item.bagCount) || 0;
            let deliverCount = parseInt(bagCountEl?.value, 10);
            if (isNaN(deliverCount) || deliverCount < 1) deliverCount = maxBag;
            if (deliverCount > maxBag) deliverCount = maxBag;
            resolve({
                confirmed: true,
                itemId: item.id,
                customerName: item.customerName,
                bagCount: maxBag,
                deliverCount,
                shipmentMethod,
                cargoDesi,
                deliveredBy,
            });
        });

        showModalUI(dom);
    });
}

export function showNoteModal(dom, item) {
    return new Promise(resolve => {
        dom.modalContent.innerHTML = `<h3 class="text-xl font-semibold mb-2 text-primary">Not ve Hatırlatıcı</h3><p class="text-secondary mb-4">'${item.customerName}' için notu ve hatırlatıcıyı düzenleyin.</p><div class="space-y-4"><div><label for="note-textarea" class="block text-sm font-medium text-secondary mb-1">Not:</label><textarea id="note-textarea" class="w-full p-2 bg-secondary border border-dynamic rounded-lg focus:ring-2 ring-accent transition h-24">${item.note || ''}</textarea></div><div><label for="reminder-date" class="block text-sm font-medium text-secondary mb-1">Hatırlatma Tarihi (Opsiyonel):</label><input type="date" id="reminder-date" value="${item.reminderDate || ''}" class="w-full p-2 bg-secondary border border-dynamic rounded-lg focus:ring-2 ring-accent transition"></div></div><div class="flex justify-end gap-3 mt-6"><button id="modal-cancel" class="bg-tertiary px-4 py-2 rounded-lg hover:bg-slate-500 transition">İptal</button><button id="modal-confirm" class="accent-bg text-white px-4 py-2 rounded-lg accent-bg-hover transition">Kaydet</button></div>`;
        const noteTextarea = dom.modalContent.querySelector('#note-textarea');
        const reminderDateInput = dom.modalContent.querySelector('#reminder-date');
        dom.modalContent.querySelector('#modal-confirm').addEventListener('click', () => { hideModalUI(dom); resolve({ confirmed: true, note: noteTextarea.value, reminderDate: reminderDateInput.value || null }); }, { once: true });
        dom.modalContent.querySelector('#modal-cancel').addEventListener('click', () => { hideModalUI(dom); resolve({ confirmed: false }); }, { once: true });
        showModalUI(dom);
    });
}

export function showPasswordConfirmationModal(dom, title, message, confirmText, isDestructive = false) {
    return new Promise(resolve => {
        const confirmClass = isDestructive ? 'bg-red-600 hover:bg-red-700' : 'accent-bg accent-bg-hover';
        dom.modalContent.innerHTML = `
            <h3 class="text-xl font-semibold mb-2 ${isDestructive ? 'text-red-400' : 'text-primary'}">${title}</h3>
            <p class="text-secondary mb-4">${message}</p>
            <div>
                <label for="password-input" class="block text-sm font-medium text-secondary mb-1">Hesap Şifreniz:</label>
                <input id="password-input" type="password" class="w-full p-2 bg-secondary border border-dynamic rounded-lg focus:ring-2 ring-accent transition" autofocus>
                <p id="password-error" class="text-red-400 text-sm mt-2 hidden">Hatalı şifre.</p>
            </div>
            <div class="flex justify-end gap-3 mt-6">
                <button id="modal-cancel" class="bg-tertiary px-4 py-2 rounded-lg hover:bg-slate-500 transition">İptal</button>
                <button id="modal-confirm" class="${confirmClass} text-white px-4 py-2 rounded-lg transition">${confirmText}</button>
            </div>`;
        showModalUI(dom);
        const confirmBtn = dom.modalContent.querySelector('#modal-confirm');
        const cancelBtn = dom.modalContent.querySelector('#modal-cancel');
        const passwordInput = dom.modalContent.querySelector('#password-input');
        const errorMsg = dom.modalContent.querySelector('#password-error');
        const close = (password) => { hideModalUI(dom); resolve(password); };
        confirmBtn.addEventListener('click', () => {
            const p = passwordInput.value;
            if (!p) { errorMsg.textContent = 'Şifre boş olamaz.'; errorMsg.classList.remove('hidden'); }
            else close(p);
        }, { once: true });
        cancelBtn.addEventListener('click', () => close(null), { once: true });
    });
}

export function showChangePasswordModal(dom, onConfirm) {
    return new Promise((resolve, reject) => {
        dom.modalContent.innerHTML = `
            <h3 class="text-xl font-semibold mb-4 text-primary">Şifre Değiştir</h3>
            <div id="change-pass-error" class="hidden text-center p-2 mb-4 bg-red-500/20 text-red-300 rounded-md text-sm"></div>
            <div class="space-y-4">
                <div>
                    <label for="current-password" class="block text-sm font-medium text-secondary mb-1">Mevcut Şifre:</label>
                    <input id="current-password" type="password" class="w-full p-2 bg-secondary border border-dynamic rounded-lg focus:ring-2 ring-accent transition" required>
                </div>
                <div>
                    <label for="new-password" class="block text-sm font-medium text-secondary mb-1">Yeni Şifre:</label>
                    <input id="new-password" type="password" class="w-full p-2 bg-secondary border border-dynamic rounded-lg focus:ring-2 ring-accent transition" required>
                </div>
                <div>
                    <label for="confirm-password" class="block text-sm font-medium text-secondary mb-1">Yeni Şifre (Tekrar):</label>
                    <input id="confirm-password" type="password" class="w-full p-2 bg-secondary border border-dynamic rounded-lg focus:ring-2 ring-accent transition" required>
                </div>
            </div>
            <div class="flex justify-end gap-3 mt-6">
                <button id="modal-cancel" class="bg-tertiary px-4 py-2 rounded-lg hover:bg-slate-500 transition">İptal</button>
                <button id="modal-confirm" class="accent-bg text-white px-4 py-2 rounded-lg accent-bg-hover transition">Değiştir</button>
            </div>`;
        showModalUI(dom);
        const confirmBtn = dom.modalContent.querySelector('#modal-confirm');
        const cancelBtn = dom.modalContent.querySelector('#modal-cancel');
        const errorDiv = dom.modalContent.querySelector('#change-pass-error');
        const currentPass = dom.modalContent.querySelector('#current-password');
        const newPass = dom.modalContent.querySelector('#new-password');
        const confirmPass = dom.modalContent.querySelector('#confirm-password');
        const handleConfirm = async () => {
            errorDiv.classList.add('hidden');
            if (newPass.value !== confirmPass.value) {
                errorDiv.textContent = 'Yeni şifreler eşleşmiyor.';
                errorDiv.classList.remove('hidden');
                return;
            }
            if (newPass.value.length < 6) {
                errorDiv.textContent = 'Yeni şifre en az 6 karakter olmalıdır.';
                errorDiv.classList.remove('hidden');
                return;
            }
            try {
                await onConfirm(currentPass.value, newPass.value);
                hideModalUI(dom);
                resolve();
            } catch (err) {
                errorDiv.textContent = 'Mevcut şifre hatalı veya bir sorun oluştu.';
                errorDiv.classList.remove('hidden');
                reject(err);
            }
        };
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', () => { hideModalUI(dom); resolve(); }, { once: true });
    });
}

function sortNotifItemsUnreadFirst(items, seenNotifications) {
    return [...items].sort((a, b) => {
        const aSeen = seenNotifications.includes(a.id);
        const bSeen = seenNotifications.includes(b.id);
        if (aSeen === bSeen) return 0;
        return aSeen ? 1 : -1;
    });
}

export function renderNotificationsPage(dom, allItems, seenNotifications, formatRelativeTimeFn, formatDateFn, onMarkAsRead, onMarkAllAsRead) {
    const inner = dom.notificationsPageInner;
    if (!inner) return;
    const unseenReminders = getUnseenReminders(allItems, seenNotifications);
    const unseenOverdue = getUnseenOverdueItems(allItems, seenNotifications);
    const allReminders = sortNotifItemsUnreadFirst(getAllDueReminders(allItems), seenNotifications);
    const allOverdue = sortNotifItemsUnreadFirst(getAllOverdueActiveItems(allItems), seenNotifications);
    const hasAnyNotifRow = allReminders.length > 0 || allOverdue.length > 0;
    const hasUnreadNotif = unseenReminders.length > 0 || unseenOverdue.length > 0;

    let pageHtml = `<div class="mb-5 pb-4 border-b border-dynamic/70"><h2 class="text-xl sm:text-2xl font-semibold text-primary">Bildirimler ve notlar</h2><p class="text-sm text-secondary mt-1">Hatırlatmalar, gecikenler ve tüm müşteri notları</p></div><div class="space-y-5">`;
    pageHtml += `<div class="space-y-4">`;
    if (allReminders.length > 0) {
        pageHtml += `<div><h4 class="text-lg font-semibold text-cyan-300 mb-2">Bugünün Hatırlatmaları</h4><div class="space-y-2">`;
        allReminders.forEach(item => {
            const read = seenNotifications.includes(item.id);
            const rowMuted = read ? ' bg-tertiary/30 border border-white/5' : ' bg-tertiary/50 border border-transparent';
            const nameCls = read ? 'text-secondary font-normal' : 'text-primary font-bold';
            const subCls = read ? 'text-secondary/80 font-normal' : 'text-cyan-200 font-semibold';
            const actionHtml = read
                ? `<span class="shrink-0 text-xs text-secondary/70 tabular-nums" aria-hidden="true">Okundu</span>`
                : `<button type="button" data-notif-id="${item.id}" class="mark-as-read-btn shrink-0 text-sm bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-500 transition">Okundu</button>`;
            pageHtml += `<div class="notif-feed-row p-3 rounded-md flex justify-between items-center gap-2${rowMuted}"><div class="min-w-0"><p class="${nameCls}">${item.customerName}</p><p class="text-sm ${subCls}">${item.note || 'Hatırlatıcı'}</p></div>${actionHtml}</div>`;
        });
        pageHtml += `</div></div>`;
    }
    if (allOverdue.length > 0) {
        pageHtml += `<div><h4 class="text-lg font-semibold text-yellow-400 mb-2">Geciken Poşetler (20+ gün)</h4><div class="space-y-2">`;
        allOverdue.forEach(item => {
            const read = seenNotifications.includes(item.id);
            const rowMuted = read ? ' bg-tertiary/30 border border-white/5' : ' bg-tertiary/50 border border-transparent';
            const nameCls = read ? 'text-secondary font-normal' : 'text-primary font-bold';
            const subCls = read ? 'text-secondary/75 font-normal' : 'text-yellow-300 font-semibold';
            const actionHtml = read
                ? `<span class="shrink-0 text-xs text-secondary/70 tabular-nums" aria-hidden="true">Okundu</span>`
                : `<button type="button" data-notif-id="${item.id}" class="mark-as-read-btn shrink-0 text-sm bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-500 transition">Okundu</button>`;
            pageHtml += `<div class="notif-feed-row p-3 rounded-md flex justify-between items-center gap-2${rowMuted}"><div class="min-w-0"><p class="${nameCls}">${item.customerName}</p><p class="text-sm ${subCls}">${formatRelativeTimeFn(item.createdAt)}</p></div>${actionHtml}</div>`;
        });
        pageHtml += `</div></div>`;
    }
    if (!hasAnyNotifRow) pageHtml += `<p class="text-center text-secondary py-2">Hatırlatma veya gecikme bildirimi bulunmuyor.</p>`;
    pageHtml += `</div>`;
    if (hasUnreadNotif) pageHtml += `<div class="pt-1"><button type="button" id="notif-mark-all-read" class="w-full bg-tertiary p-2 rounded-lg hover:bg-slate-600 transition text-sm">Bildirimleri okundu işaretle</button></div>`;
    pageHtml += `<div class="pt-4 mt-4 border-t border-dynamic"><h4 class="text-base font-semibold text-primary mb-3">Tüm notlar</h4><div id="notif-notes-list" class="space-y-2"></div><p id="notif-empty-notes" class="hidden text-center text-secondary bg-tertiary/30 border border-dynamic p-4 rounded-lg text-sm">Henüz not eklenmiş bir kayıt bulunmuyor.</p></div>`;
    pageHtml += `</div>`;
    inner.innerHTML = pageHtml;
    renderNotes(
        { notesList: document.getElementById('notif-notes-list'), emptyNotesMessage: document.getElementById('notif-empty-notes') },
        allItems,
        formatDateFn
    );
    inner.querySelector('#notif-mark-all-read')?.addEventListener('click', () => { onMarkAllAsRead(); });
    inner.querySelectorAll('.mark-as-read-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { onMarkAsRead(e.currentTarget.dataset.notifId); });
    });
}

/**
 * detailHandlers: { customerId, initialPhone, onRename, onPhoneSave, onAfterRenameSuccess? }
 */
export function showCustomerDetailModal(dom, customerName, allItems, formatDateFn, iconsRef, onClose, onExportPdf, detailHandlers) {
    let currentDetailName = customerName;
    const customerItems = allItems.filter(item => item.customerName === currentDetailName);
    const activeItemsList = customerItems.filter((item) => item.status === 'active');
    const deliveredItems = customerItems.filter((item) => item.status === 'delivered');
    const ekstreRows = buildCustomerEkstreRows(activeItemsList, deliveredItems);
    const totalDeliveredBags = deliveredItems.reduce((s, i) => s + (Number(i.bagCount) || 0), 0);
    const currentStock = activeItemsList.reduce((s, i) => s + (Number(i.bagCount) || 0), 0);
    const totalAddedLifetime = totalDeliveredBags + currentStock;

    const initialPhoneStr = detailHandlers?.initialPhone != null ? String(detailHandlers.initialPhone).trim() : '';
    const hasPhone = initialPhoneStr.length > 0;

    let headerHtml;
    if (detailHandlers && typeof detailHandlers.onRename === 'function' && typeof detailHandlers.onPhoneSave === 'function') {
        headerHtml = `
        <div class="mb-4 border-b border-dynamic/80 pb-4">
            <div class="flex justify-between items-start gap-3">
                <div class="min-w-0 flex-1">
                    <div id="customer-detail-name-row" class="flex items-center gap-2 flex-wrap">
                        <h3 id="customer-detail-name-display" class="text-2xl font-bold accent-text break-words">${escapeHtmlText(currentDetailName)}</h3>
                        <button type="button" id="customer-detail-edit-name-btn" class="p-1.5 rounded-lg text-secondary hover:text-accent-text hover:bg-tertiary/80 transition shrink-0" title="İsmi düzenle">${iconsRef.edit}</button>
                    </div>
                    <div id="customer-detail-name-editor" class="hidden mt-2 flex flex-wrap items-center gap-2">
                        <input type="text" id="customer-detail-name-input" class="flex-1 min-w-[12rem] p-2.5 bg-tertiary border border-dynamic rounded-lg text-primary text-sm focus:ring-2 ring-accent transition" value="${escapeHtmlAttr(currentDetailName)}">
                        <button type="button" id="customer-detail-name-save" class="text-sm px-3 py-2 rounded-lg bg-emerald-600/90 text-white hover:bg-emerald-500 transition">Kaydet</button>
                        <button type="button" id="customer-detail-name-cancel" class="text-sm px-3 py-2 rounded-lg bg-tertiary text-secondary hover:bg-slate-600 transition">İptal</button>
                    </div>
                    <div class="mt-3 flex flex-col gap-1">
                        <div class="flex items-center gap-2 flex-wrap text-sm">
                            <span class="text-secondary shrink-0">Telefon:</span>
                            <span id="customer-detail-phone-text" class="min-w-0 break-all ${hasPhone ? 'text-primary' : 'text-secondary/50 italic'}">${hasPhone ? escapeHtmlText(initialPhoneStr) : 'Numara eklenmemiş'}</span>
                            <button type="button" id="customer-detail-edit-phone-btn" class="p-1.5 rounded-lg text-secondary hover:text-accent-text hover:bg-tertiary/80 transition shrink-0" title="Telefonu düzenle">${iconsRef.edit}</button>
                        </div>
                        <div id="customer-detail-phone-editor" class="hidden flex flex-wrap items-center gap-2 mt-1">
                            <input type="tel" id="customer-detail-phone-input" autocomplete="tel" class="flex-1 min-w-[12rem] p-2.5 bg-tertiary border border-dynamic rounded-lg text-primary text-sm focus:ring-2 ring-accent transition" value="${escapeHtmlAttr(hasPhone ? initialPhoneStr : '')}" placeholder="5XX XXX XX XX">
                            <button type="button" id="customer-detail-phone-save" class="text-sm px-3 py-2 rounded-lg bg-emerald-600/90 text-white hover:bg-emerald-500 transition">Kaydet</button>
                            <button type="button" id="customer-detail-phone-cancel" class="text-sm px-3 py-2 rounded-lg bg-tertiary text-secondary hover:bg-slate-600 transition">İptal</button>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button type="button" id="export-customer-pdf-btn" class="p-2 text-secondary hover:text-rose-400 transition rounded-lg hover:bg-tertiary/50" title="Bu Müşterinin Geçmişini PDF Aktar">PDF</button>
                    <button type="button" id="modal-close" class="p-1.5 text-secondary hover:text-primary transition rounded-lg hover:bg-tertiary/50">${iconsRef.cancel}</button>
                </div>
            </div>
        </div>`;
    } else {
        headerHtml = `<div class="flex justify-between items-start mb-4"><h3 class="text-2xl font-bold accent-text">${escapeHtmlText(customerName)}</h3><div class="flex items-center gap-2"><button id="export-customer-pdf-btn" class="p-2 text-secondary hover:text-rose-400 transition" title="Bu Müşterinin Geçmişini PDF Aktar">PDF</button><button id="modal-close" class="p-1 text-secondary hover:text-primary transition">${iconsRef.cancel}</button></div></div>`;
    }

    const noteItem = activeItemsList.find((i) => (i.note && String(i.note).trim()) || i.reminderDate);

    let modalHtml = `${headerHtml}<div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2">`;
    if (activeItemsList.length > 0 || deliveredItems.length > 0) {
        modalHtml += `<div>
            <h4 class="text-lg font-semibold text-primary mb-2 border-b border-dynamic pb-1">Müşteri Ekstresi</h4>
            <p class="text-sm text-secondary mb-3 leading-relaxed">Toplam <span class="text-primary font-semibold">${totalAddedLifetime}</span> poşet eklendi, <span class="text-primary font-semibold">${totalDeliveredBags}</span> poşet teslim edildi. Güncel stok: <span class="text-primary font-semibold">${currentStock}</span>.</p>
            <p class="text-xs text-secondary/80 mb-2">İşlemler en yeniden eskiye; sayfa başına en fazla 25 kayıt.</p>
            <div id="customer-ekstre-list" class="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/[0.08] bg-tertiary/25"></div>
            <div id="customer-ekstre-pagination" class="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"></div>
        </div>`;
    }
    if (noteItem && ((noteItem.note && String(noteItem.note).trim()) || noteItem.reminderDate)) {
        modalHtml += `<div><h4 class="text-lg font-semibold text-primary mb-2 border-b border-dynamic pb-1">Not ve Hatırlatıcı</h4><div class="bg-tertiary/50 p-3 rounded-md"><p class="whitespace-pre-wrap">${noteItem.note || '<i>Not girilmemiş.</i>'}</p>${noteItem.reminderDate ? `<p class="text-sm mt-2 text-cyan-300"><strong>Hatırlatıcı:</strong> ${noteItem.reminderDate}</p>` : ''}</div></div>`;
    }
    if (activeItemsList.length === 0 && deliveredItems.length === 0) {
        modalHtml += `<p class="text-center text-secondary py-4">Bu müşteri için kayıt bulunamadı.</p>`;
    }
    modalHtml += `</div>`;
    dom.modalContent.innerHTML = modalHtml;
    showModalUI(dom);

    const EKSTRE_PER_PAGE = 25;
    const ekstreList = document.getElementById('customer-ekstre-list');
    const ekstrePagination = document.getElementById('customer-ekstre-pagination');

    function customerEkstreRowHtml(row) {
        const isAdd = row.kind === 'add';
        const rowBg = isAdd ? 'bg-green-500/10' : 'bg-red-500/10';
        const borderL = isAdd ? 'border-l-green-500/50' : 'border-l-red-500/50';
        const titleClass = isAdd ? 'text-green-400' : 'text-red-400';
        const sign = isAdd ? '+' : '−';
        const kindLabel = isAdd ? 'Eklendi' : 'Teslim edildi';
        const whoStr = escapeHtmlText(String(row.who));
        return `<div class="flex min-w-0 flex-col space-y-1 px-3 py-2.5 text-left text-sm break-words whitespace-normal ${rowBg} border-l-2 ${borderL}">
            <p class="font-semibold ${titleClass}"><span class="tabular-nums">${sign}</span> ${kindLabel}</p>
            <p class="text-primary min-w-0"><span class="text-secondary font-normal">Adet:</span> <span class="font-semibold tabular-nums">${row.bags}</span></p>
            <p class="text-secondary min-w-0">${formatDateFn(row.at)}</p>
            <p class="text-secondary/95 min-w-0"><span class="text-secondary">İşlemi yapan:</span> ${whoStr}</p>
        </div>`;
    }

    if (ekstreList && ekstrePagination) {
        if (ekstreRows.length > 0) {
            const ekstreNewestFirst = ekstreRows.slice().reverse();
            const totalEkstrePages = Math.max(1, Math.ceil(ekstreNewestFirst.length / EKSTRE_PER_PAGE));
            let ekstrePage = 1;

            const renderEkstrePage = (page) => {
                ekstrePage = Math.min(Math.max(1, page), totalEkstrePages);
                const start = (ekstrePage - 1) * EKSTRE_PER_PAGE;
                const pageRows = ekstreNewestFirst.slice(start, start + EKSTRE_PER_PAGE);
                ekstreList.innerHTML = pageRows.map((row) => customerEkstreRowHtml(row)).join('');

                const prevDisabled = ekstrePage <= 1;
                const nextDisabled = ekstrePage >= totalEkstrePages;
                if (totalEkstrePages <= 1) {
                    ekstrePagination.innerHTML = `<p class="text-xs text-secondary/80 text-center sm:text-left">Toplam ${ekstreRows.length} işlem</p>`;
                    return;
                }
                ekstrePagination.innerHTML = `
                    <span class="text-xs text-secondary/90">Sayfa <span class="text-primary font-semibold tabular-nums">${ekstrePage}</span> / <span class="tabular-nums">${totalEkstrePages}</span><span class="text-secondary/60"> · </span><span class="text-secondary/80">Toplam ${ekstreRows.length} işlem</span></span>
                    <div class="flex items-center justify-center sm:justify-end gap-2">
                        <button type="button" id="customer-ekstre-prev" class="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 bg-tertiary/80 text-primary hover:bg-tertiary transition disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed" ${prevDisabled ? 'disabled' : ''}>Önceki</button>
                        <button type="button" id="customer-ekstre-next" class="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/10 bg-tertiary/80 text-primary hover:bg-tertiary transition disabled:opacity-40 disabled:pointer-events-none disabled:cursor-not-allowed" ${nextDisabled ? 'disabled' : ''}>Sonraki</button>
                    </div>`;
                ekstrePagination.querySelector('#customer-ekstre-prev')?.addEventListener('click', () => renderEkstrePage(ekstrePage - 1));
                ekstrePagination.querySelector('#customer-ekstre-next')?.addEventListener('click', () => renderEkstrePage(ekstrePage + 1));
            };
            renderEkstrePage(1);
        } else {
            ekstreList.innerHTML = '<p class="p-4 text-center text-secondary text-sm">Gösterilecek hareket yok.</p>';
            ekstrePagination.innerHTML = '';
        }
    }

    const runExport = () => onExportPdf(currentDetailName);
    dom.modalContent.querySelector('#modal-close')?.addEventListener('click', () => hideModalUI(dom), { once: true });
    dom.modalContent.querySelector('#export-customer-pdf-btn')?.addEventListener('click', () => runExport());

    if (detailHandlers && typeof detailHandlers.onRename === 'function' && typeof detailHandlers.onPhoneSave === 'function') {
        const nameRow = dom.modalContent.querySelector('#customer-detail-name-row');
        const nameDisp = dom.modalContent.querySelector('#customer-detail-name-display');
        const nameEdit = dom.modalContent.querySelector('#customer-detail-name-editor');
        const nameInput = dom.modalContent.querySelector('#customer-detail-name-input');
        const phoneText = dom.modalContent.querySelector('#customer-detail-phone-text');
        const phoneEditor = dom.modalContent.querySelector('#customer-detail-phone-editor');
        const phoneInput = dom.modalContent.querySelector('#customer-detail-phone-input');

        dom.modalContent.querySelector('#customer-detail-edit-name-btn')?.addEventListener('click', () => {
            nameEdit?.classList.remove('hidden');
            nameRow?.classList.add('hidden');
            nameInput?.focus();
        });
        dom.modalContent.querySelector('#customer-detail-name-cancel')?.addEventListener('click', () => {
            nameEdit?.classList.add('hidden');
            nameRow?.classList.remove('hidden');
            if (nameInput) nameInput.value = currentDetailName;
        });
        dom.modalContent.querySelector('#customer-detail-name-save')?.addEventListener('click', async () => {
            const raw = nameInput?.value ?? '';
            const neu = toTrUpperCase(raw.trim());
            if (!neu) {
                await showSimpleMessageModal(dom, 'Eksik bilgi', 'Müşteri adı boş olamaz.');
                return;
            }
            if (neu === currentDetailName) {
                nameEdit?.classList.add('hidden');
                nameRow?.classList.remove('hidden');
                return;
            }
            try {
                await detailHandlers.onRename(currentDetailName, neu);
                if (typeof detailHandlers.onAfterRenameSuccess === 'function') {
                    detailHandlers.onAfterRenameSuccess(neu);
                } else {
                    hideModalUI(dom);
                }
            } catch (err) {
                console.error(err);
                await showSimpleMessageModal(dom, 'Hata', 'İsim güncellenirken bir sorun oluştu.');
            }
        });

        dom.modalContent.querySelector('#customer-detail-edit-phone-btn')?.addEventListener('click', () => {
            phoneEditor?.classList.remove('hidden');
            if (phoneInput && phoneText) {
                const empty = phoneText.classList.contains('italic') || (phoneText.textContent || '').trim() === 'Numara eklenmemiş';
                phoneInput.value = empty ? '' : (phoneText.textContent || '').trim();
            }
            phoneInput?.focus();
        });
        dom.modalContent.querySelector('#customer-detail-phone-cancel')?.addEventListener('click', () => {
            phoneEditor?.classList.add('hidden');
            if (phoneInput && phoneText) {
                const empty = phoneText.classList.contains('italic') || (phoneText.textContent || '').trim() === 'Numara eklenmemiş';
                phoneInput.value = empty ? '' : (phoneText.textContent || '').trim();
            }
        });
        dom.modalContent.querySelector('#customer-detail-phone-save')?.addEventListener('click', async () => {
            const val = phoneInput?.value ?? '';
            try {
                await detailHandlers.onPhoneSave({ customerName: currentDetailName, phone: val });
                const trimmed = val.trim();
                if (phoneText) {
                    phoneText.className = `min-w-0 break-all ${trimmed ? 'text-primary' : 'text-secondary/50 italic'}`;
                    phoneText.textContent = trimmed || 'Numara eklenmemiş';
                }
                phoneEditor?.classList.add('hidden');
            } catch (err) {
                console.error(err);
                await showSimpleMessageModal(dom, 'Hata', 'Telefon kaydedilirken bir sorun oluştu.');
            }
        });
    }
}

export function exportDataToJSON(allItems, allCustomers, deliveryPersonnel, settings) {
    const data = { allItems, allCustomers, deliveryPersonnel, settings };
    const filename = `poset-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    saveOrShareText(JSON.stringify(data, null, 2), filename, 'application/json', {
        title: 'Poşet Takip Yedeği',
        dialogTitle: 'Yedek dosyasını kaydet',
    }).catch((err) => console.error('JSON yedek aktarılamadı:', err));
}

export function exportToCSV(allItems, formatDateFn) {
    const activeItems = allItems.filter(item => item.status !== 'delivered');
    if (activeItems.length === 0) return false;
    const headers = 'Musteri Adi,Poset Sayisi,Not,Son Degisiklik Tarihi';
    const rows = activeItems.map(item => `"${item.customerName.replace(/"/g, '""')}",${item.bagCount},"${(item.note || '').replace(/"/g, '""')}",${formatDateFn(item.lastModified)}`);
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    saveOrShareText(csvContent, 'poset_listesi.csv', 'text/csv;charset=utf-8;', {
        title: 'Poşet Listesi (CSV)',
        dialogTitle: 'CSV dosyasını kaydet',
    }).catch((err) => console.error('CSV aktarılamadı:', err));
    return true;
}

export function exportActiveItemsToPDF(activeItems, formatDateFn, jsPDF) {
    if (activeItems.length === 0) return false;
    const pdf = new jsPDF();
    pdf.text('Bekleyen Poset Listesi', 14, 16);
    const tableColumn = ['#', 'Musteri Adi', 'Poset Sayisi', 'Eklenme Tarihi'];
    const tableRows = activeItems.map((item, i) => [i + 1, toPdfAscii(item.customerName), item.bagCount, formatDateFn(item.createdAt).split(' ')[0]]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    saveOrSharePdf(pdf, `bekleyen-poset-listesi-${new Date().toISOString().slice(0, 10)}.pdf`, {
        title: 'Bekleyen Poşet Listesi',
        dialogTitle: 'PDF dosyasını kaydet',
    }).catch((err) => console.error('PDF aktarılamadı:', err));
    return true;
}

export function exportArchiveToPDF(archivedItems, formatDateFn, jsPDF) {
    if (archivedItems.length === 0) return false;
    const pdf = new jsPDF();
    pdf.text('Teslim Edilenler Arsivi', 14, 16);
    const tableColumn = ['#', 'Musteri Adi', 'Poset', 'Teslim Eden', 'Teslim Tarihi'];
    const tableRows = archivedItems.map((item, i) => [i + 1, toPdfAscii(item.customerName), item.bagCount, toPdfAscii(item.deliveredBy || '-'), formatDateFn(item.deliveredAt).split(' ')[0]]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    saveOrSharePdf(pdf, `teslim-edilenler-${new Date().toISOString().slice(0, 10)}.pdf`, {
        title: 'Teslim Edilenler Arşivi',
        dialogTitle: 'PDF dosyasını kaydet',
    }).catch((err) => console.error('Arşiv PDF aktarılamadı:', err));
    return true;
}

/**
 * Müşteri ekstresi: eklenen ve teslim satırlarını kronolojik PDF olarak dışa aktarır.
 */
export function exportCustomerHistoryToPDF(customerName, allItems, formatDateFn, jsPDF) {
    if (!jsPDF || typeof jsPDF !== 'function') return false;
    const customerItems = allItems.filter((item) => item.customerName === customerName);
    const activeItemsList = customerItems.filter((item) => item.status === 'active');
    const deliveredItems = customerItems.filter((item) => item.status === 'delivered');
    const ekstreRows = buildCustomerEkstreRows(activeItemsList, deliveredItems);
    if (ekstreRows.length === 0) return false;
    const totalDeliveredBags = deliveredItems.reduce((s, i) => s + (Number(i.bagCount) || 0), 0);
    const currentStock = activeItemsList.reduce((s, i) => s + (Number(i.bagCount) || 0), 0);
    const totalAddedLifetime = totalDeliveredBags + currentStock;
    try {
        const pdf = new jsPDF();
        pdf.setFontSize(14);
        pdf.text(`Musteri Ekstresi: ${toPdfAscii(customerName)}`, 14, 16);
        pdf.setFontSize(10);
        const summary = `Toplam ${totalAddedLifetime} poset eklendi, ${totalDeliveredBags} poset teslim edildi. Guncel stok: ${currentStock}.`;
        const splitSummary = pdf.splitTextToSize(toPdfAscii(summary), 180);
        pdf.text(splitSummary, 14, 24);
        const startY = 24 + splitSummary.length * 5 + 4;
        const tableColumn = ['Islem', 'Adet', 'Tarih', 'Islemi yapan'];
        const tableRows = ekstreRows.map((row) => {
            const islem = row.kind === 'add' ? '+ Eklendi' : '- Teslim edildi';
            return [islem, String(row.bags), formatDateFn(row.at), toPdfAscii(String(row.who))];
        });
        if (typeof pdf.autoTable !== 'function') {
            console.error('jsPDF autoTable eklentisi yok');
            return false;
        }
        pdf.autoTable({ head: [tableColumn], body: tableRows, startY });
        const safe = toPdfAscii(customerName).replace(/[^\w.-]+/g, '_').slice(0, 48);
        saveOrSharePdf(pdf, `musteri-ekstre-${safe}-${new Date().toISOString().slice(0, 10)}.pdf`, {
            title: `Müşteri Ekstresi: ${customerName}`,
            dialogTitle: 'PDF dosyasını kaydet',
        }).catch((err) => console.error('Müşteri ekstre PDF aktarılamadı:', err));
        return true;
    } catch (err) {
        console.error('exportCustomerHistoryToPDF', err);
        return false;
    }
}

export function exportReportsToPDF(allItems, formatDateFn, getDayDifferenceFn, jsPDF) {
    if (!jsPDF || typeof jsPDF !== 'function') return false;
    const deliveredItems = allItems.filter(item => item.status === 'delivered' && item.deliveredAt).sort((a, b) => (b.deliveredAt?.seconds || 0) - (a.deliveredAt?.seconds || 0));
    if (deliveredItems.length === 0) return false;
    const alinmaRef = (item) => item.createdAt || item.lastModified || item.deliveredAt;
    try {
        const pdf = new jsPDF();
        pdf.text('Teslim Edilen Poset Raporu', 14, 16);
        const tableColumn = ['Musteri Adi', 'Alinma Tarihi', 'Teslim Tarihi', 'Bekleme Suresi (Gun)'];
        const tableRows = deliveredItems.map((item) => {
            const c0 = alinmaRef(item);
            return [
                toPdfAscii(item.customerName),
                formatDateFn(c0).split(' ')[0],
                formatDateFn(item.deliveredAt).split(' ')[0],
                getDayDifferenceFn(c0, item.deliveredAt)
            ];
        });
        if (typeof pdf.autoTable !== 'function') {
            console.error('jsPDF autoTable eklentisi yok');
            return false;
        }
        pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
        saveOrSharePdf(pdf, `teslim-raporu-${new Date().toISOString().slice(0, 10)}.pdf`, {
            title: 'Teslim Edilen Poşet Raporu',
            dialogTitle: 'PDF dosyasını kaydet',
        }).catch((err) => console.error('Rapor PDF aktarılamadı:', err));
        return true;
    } catch (err) {
        console.error('exportReportsToPDF', err);
        return false;
    }
}

export function renderCustomerModalList(listContainerId, allCustomers, filter, toTrUpperCaseFn, iconsRef) {
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;
    listContainer.innerHTML = '';
    const ucFilter = toTrUpperCaseFn(filter);
    const filtered = allCustomers.filter(c => toTrUpperCaseFn(c.name).includes(ucFilter)).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-secondary py-4">Filtreyle eşleşen müşteri bulunamadı.</p>';
        return;
    }
    filtered.forEach(customer => {
        const div = document.createElement('div');
        div.className = 'p-2 bg-tertiary/50 rounded-md';
        div.dataset.customerId = customer.id;
        div.dataset.customerName = customer.name;
        div.innerHTML = `<div class="customer-display flex justify-between items-center"><span class="customer-name-text text-primary text-sm">${customer.name}</span><div class="flex items-center gap-2"><button data-cust-action="edit" class="p-1 text-secondary hover:text-yellow-400 transition" title="Düzenle">${iconsRef.edit}</button><button data-cust-action="delete" class="p-1 text-secondary hover:text-red-500 transition" title="Sil">${iconsRef.delete}</button></div></div><div class="customer-edit hidden flex items-center gap-2"><input type="text" value="${customer.name}" class="customer-name-input flex-grow p-1 bg-secondary border border-dynamic text-primary rounded-md text-sm focus:ring-1 ring-accent transition"><div class="flex items-center gap-1"><button data-cust-action="save-edit" class="p-1 text-green-400 hover:text-green-300 transition" title="Kaydet">${iconsRef.save}</button><button data-cust-action="cancel-edit" class="p-1 text-red-500 hover:text-red-400 transition" title="İptal">${iconsRef.cancel}</button></div></div><div class="customer-delete-confirm hidden flex justify-between items-center"><span class="text-red-300 text-sm">Silinsin mi?</span><div class="flex items-center gap-2"><button data-cust-action="confirm-delete" class="text-sm bg-red-600 text-white px-2 py-1 rounded-md hover:bg-red-700">Evet</button><button data-cust-action="cancel-delete" class="text-sm bg-tertiary px-2 py-1 rounded-md hover:bg-slate-500">Hayır</button></div></div>`;
        listContainer.appendChild(div);
    });
}

export function renderDeliveryPersonnelModalList(listContainerId, deliveryPersonnel, iconsRef) {
    const listContainer = document.getElementById(listContainerId);
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (deliveryPersonnel.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-secondary py-4">Henüz teslim eden kişi eklenmemiş.</p>';
        return;
    }
    deliveryPersonnel.forEach(person => {
        const div = document.createElement('div');
        div.className = 'p-2 bg-tertiary/50 rounded-md';
        div.dataset.personId = person.id;
        div.dataset.personName = person.name;
        const isDef = !!person.isDefault;
        const starBtnClass = isDef
            ? 'p-1 text-amber-400 hover:text-amber-300 transition'
            : 'p-1 text-secondary hover:text-amber-400 transition';
        const starTitle = isDef ? 'Teslim ekranında varsayılan (kaldırmak için tıklayın)' : 'Teslim ekranında varsayılan yap';
        const starIcon = isDef ? iconsRef.star_filled : iconsRef.star_outline;
        div.innerHTML = `<div class="person-display flex justify-between items-center gap-2"><span class="person-name-text text-primary text-sm min-w-0 flex-1 break-words">${person.name}</span><div class="flex shrink-0 items-center gap-1"><button type="button" data-person-action="toggle-default" class="${starBtnClass}" title="${starTitle}">${starIcon}</button><button type="button" data-person-action="edit" class="p-1 text-secondary hover:text-yellow-400 transition" title="Düzenle">${iconsRef.edit}</button><button type="button" data-person-action="delete" class="p-1 text-secondary hover:text-red-500 transition" title="Sil">${iconsRef.delete}</button></div></div><div class="person-edit hidden flex items-center gap-2"><input type="text" value="${person.name}" class="person-name-input flex-grow p-1 bg-secondary border border-dynamic text-primary rounded-md text-sm focus:ring-1 ring-accent transition"><div class="flex items-center gap-1"><button type="button" data-person-action="save-edit" class="p-1 text-green-400 hover:text-green-300 transition" title="Kaydet">${iconsRef.save}</button><button type="button" data-person-action="cancel-edit" class="p-1 text-red-500 hover:text-red-400 transition" title="İptal">${iconsRef.cancel}</button></div></div>`;
        listContainer.appendChild(div);
    });
}

// --- YENİ EKLENEN PDF BLOB FONKSİYONU ---
export function getActiveItemsPDFBlob(activeItems, formatDateFn, jsPDF) {
    if (activeItems.length === 0) return null;
    const pdf = new jsPDF();
    pdf.text('Bekleyen Poset Listesi', 14, 16);
    const tableColumn = ['#', 'Musteri Adi', 'Poset Sayisi', 'Eklenme Tarihi'];
    const tableRows = activeItems.map((item, i) => [i + 1, toPdfAscii(item.customerName), item.bagCount, formatDateFn(item.createdAt).split(' ')[0]]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    return pdf.output('blob');
}
