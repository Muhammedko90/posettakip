/**
 * DOM manipülasyonu ve render işlemleri
 */

export const toTrUpperCase = (str) => str ? str.toLocaleUpperCase('tr-TR') : '';

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
        notesList: document.getElementById('notes-list'),
        emptyNotesMessage: document.getElementById('empty-notes-message'),
        modalContainer: document.getElementById('modal-container'),
        modalContentWrapper: document.getElementById('modal-content-wrapper'),
        modalContent: document.getElementById('modal-content'),
        notificationBell: document.getElementById('notification-bell'),
        notificationBadge: document.getElementById('notification-badge'),
        scrollToTopBtn: document.getElementById('scroll-to-top-btn'),
        toggleWidthBtn: document.getElementById('toggle-width-btn'),
        customText: {
            titleInput: document.getElementById('custom-text-title-input'),
            contentInput: document.getElementById('custom-text-content-input'),
            saveBtn: document.getElementById('save-custom-text-btn')
        },
        shareTemplate: {
            input: document.getElementById('share-template-input'),
            saveBtn: document.getElementById('save-share-template-btn')
        },
        telegram: {
            botTokenInput: document.getElementById('telegram-bot-token'),
            chatIdInput: document.getElementById('telegram-chat-id'),
            reportTimeInput: document.getElementById('telegram-report-time'),
            saveBtn: document.getElementById('save-telegram-settings-btn')
        },
        dashboard: {
            waitingCustomers: document.getElementById('dashboard-waiting-customers'),
            waitingBags: document.getElementById('dashboard-waiting-bags'),
            deliveredLastWeek: document.getElementById('dashboard-delivered-last-week'),
            oldestCustomers: document.getElementById('dashboard-oldest-customers'),
            reminders: document.getElementById('dashboard-reminders'),
            customTextTitle: document.getElementById('dashboard-custom-text-title'),
            customTextContent: document.getElementById('dashboard-custom-text-content'),
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
    if (dom.customText.titleInput) dom.customText.titleInput.value = settings.customTitle || '';
    if (dom.customText.contentInput) dom.customText.contentInput.value = settings.customContent || '';
    if (dom.shareTemplate.input) dom.shareTemplate.input.value = settings.shareTemplate || '';
    
    // Telegram ayarlarını yükle
    if (dom.telegram.botTokenInput) dom.telegram.botTokenInput.value = settings.telegramBotToken || '';
    if (dom.telegram.chatIdInput) dom.telegram.chatIdInput.value = settings.telegramChatId || '';
    if (dom.telegram.reportTimeInput) dom.telegram.reportTimeInput.value = settings.telegramReportTime || '09:00';

    if (updateViewToggleButtonsFn) updateViewToggleButtonsFn();
}

export function updateViewToggleButtons(dom, viewMode) {
    dom.viewListBtn.classList.toggle('view-active', viewMode === 'list');
    dom.viewGridBtn.classList.toggle('view-active', viewMode === 'grid');
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
    const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt || new Date());
    const now = new Date();
    const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));
    const overdueClass = (() => {
        if (diffDays >= 20) return 'border-red-500/60 bg-red-500/10';
        if (diffDays >= 10 && diffDays <= 19) return 'border-yellow-500/60 bg-yellow-500/10';
        return 'border-dynamic';
    })();
    let noteIndicatorHTML = '';
    if (item.note) noteIndicatorHTML += `<span class="accent-text text-xs" title="Not Mevcut">●</span>`;
    if (item.reminderDate) noteIndicatorHTML += `<span class="text-cyan-400 text-xs ml-1" title="Hatırlatıcı: ${item.reminderDate}">🔔</span>`;
    let historyHtml = item.createdAt
        ? `<p class="item-subtext text-sm text-secondary">Eklendi: ${formatDateFn(item.createdAt).split(' ')[0]} (${formatRelativeTimeFn(item.createdAt)})</p>`
        : '<p class="item-subtext text-sm text-secondary">Eklenme tarihi yok</p>';
    if (item.additionalDates && Array.isArray(item.additionalDates) && item.additionalDates.length > 0) {
        historyHtml += item.additionalDates.map(d => `<p class="item-subtext text-xs text-secondary/80 pl-2">+ Poşet Eklendi: ${formatDateFn(d).split(' ')[0]} (${formatRelativeTimeFn(d)})</p>`).join('');
    }
    div.className = `bg-primary p-4 rounded-lg shadow-md flex items-center justify-between border ${overdueClass} transition-colors duration-300`;
    div.dataset.id = item.id;
    div.dataset.customerName = item.customerName;
    div.innerHTML = `
        <div class="item-details flex-1 flex items-center gap-4">
            <div class="flex-shrink-0 flex flex-col items-center justify-center">
                <button data-action="increment-bag" class="p-1 rounded-full bg-tertiary text-secondary hover:bg-slate-600 transition" title="Poşet Ekle">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
                </button>
                <div class="item-bag-count-dynamic font-bold w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-xl my-1">${item.bagCount}</div>
                <button data-action="decrement-bag" class="p-1 rounded-full bg-tertiary text-secondary hover:bg-slate-600 transition disabled:opacity-50" ${item.bagCount <= 1 ? 'disabled' : ''} title="Poşet Çıkar">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pointer-events-none" fill="currentColor" viewBox="0 0 16 16"><path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/></svg>
                </button>
            </div>
            <div class="flex-1">
                <button data-action="view-customer" class="item-customer-name font-semibold text-lg text-primary text-left flex items-center gap-2 hover:underline">${item.customerName} ${noteIndicatorHTML}</button>
                ${historyHtml}
            </div>
        </div>
        <div class="item-actions flex items-center">
            <div class="edit-count-actions hidden flex items-center gap-2">
                <input type="number" value="${item.bagCount}" min="1" class="w-16 p-1 bg-secondary border border-dynamic text-primary rounded-md text-sm focus:ring-1 ring-accent transition">
                <button data-action="save-count" class="p-2 text-green-400 hover:text-green-300 transition" title="Kaydet">${icons.save}</button>
                <button data-action="cancel-edit-count" class="p-2 text-red-500 hover:text-red-400 transition" title="Vazgeç">${icons.cancel}</button>
            </div>
            <div class="default-actions relative">
                <button data-action="toggle-menu" class="p-2 text-secondary hover:accent-text rounded-full transition" title="Seçenekler">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                </button>
                <div class="action-menu hidden absolute right-0 top-full mt-2 z-30 bg-tertiary border border-dynamic rounded-lg shadow-xl w-48 overflow-hidden">
                    <button data-action="deliver" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition text-green-400 hover:text-green-300"><span class="w-4">${icons.deliver}</span> Teslim Et</button>
                    <button data-action="share" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition"><span class="w-4">${icons.share}</span> Paylaş</button>
                    <button data-action="edit-note" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition"><span class="w-4">${icons.note}</span> Notu Düzenle</button>
                    <button data-action="edit-count" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition"><span class="w-4">${icons.edit}</span> Sayıyı Düzenle</button>
                    <button data-action="delete-item" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition text-red-500 hover:text-red-400"><span class="w-4">${icons.cancel_item}</span> Kaydı Sil</button>
                </div>
            </div>
        </div>`;
    return div;
}

function createItemCardElement(item, formatDateFn, formatRelativeTimeFn) {
    const div = document.createElement('div');
    const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt || new Date());
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const overdueClass = (() => {
        if (diffDays >= 20) return 'border-red-500/60 bg-red-500/10';
        if (diffDays >= 10 && diffDays <= 19) return 'border-yellow-500/60 bg-yellow-500/10';
        return 'border-dynamic';
    })();
    let noteIndicatorHTML = '';
    if (item.note) noteIndicatorHTML += `<span class="accent-text text-xs" title="Not Mevcut">●</span>`;
    if (item.reminderDate) noteIndicatorHTML += `<span class="text-cyan-400 text-xs ml-1" title="Hatırlatıcı: ${item.reminderDate}">🔔</span>`;
    div.className = `bg-primary p-4 rounded-lg shadow-md flex flex-col justify-between border ${overdueClass} transition-colors duration-300`;
    div.dataset.id = item.id;
    div.dataset.customerName = item.customerName;
    div.innerHTML = `
        <div>
            <div class="flex justify-between items-start">
                <button data-action="view-customer" class="item-customer-name font-semibold text-lg text-primary text-left flex items-center gap-2 hover:underline mb-2">${item.customerName} ${noteIndicatorHTML}</button>
                <div class="default-actions relative">
                    <button data-action="toggle-menu" class="p-2 -mt-2 -mr-2 text-secondary hover:accent-text rounded-full transition" title="Seçenekler">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
                    </button>
                    <div class="action-menu hidden absolute right-0 top-full mt-2 z-30 bg-tertiary border border-dynamic rounded-lg shadow-xl w-48 overflow-hidden">
                        <button data-action="deliver" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition text-green-400 hover:text-green-300"><span class="w-4">${icons.deliver}</span> Teslim Et</button>
                        <button data-action="share" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition"><span class="w-4">${icons.share}</span> Paylaş</button>
                        <button data-action="edit-note" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition"><span class="w-4">${icons.note}</span> Notu Düzenle</button>
                        <button data-action="edit-count" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition"><span class="w-4">${icons.edit}</span> Sayıyı Düzenle</button>
                        <button data-action="delete-item" class="w-full text-left p-3 flex items-center gap-3 hover:bg-slate-600 transition text-red-500 hover:text-red-400"><span class="w-4">${icons.cancel_item}</span> Kaydı Sil</button>
                    </div>
                </div>
            </div>
            <p class="item-subtext text-sm text-secondary">${formatRelativeTimeFn(item.createdAt)}</p>
        </div>
        <div class="mt-4 flex justify-between items-end">
            <div class="text-secondary text-xs"><p>${formatDateFn(item.createdAt).split(' ')[0]}</p></div>
            <div class="flex items-center gap-2">
                <div class="edit-count-actions hidden flex items-center gap-2">
                    <input type="number" value="${item.bagCount}" min="1" class="w-16 p-1 bg-secondary border border-dynamic text-primary rounded-md text-sm focus:ring-1 ring-accent transition">
                    <button data-action="save-count" class="p-2 text-green-400 hover:text-green-300 transition" title="Kaydet">${icons.save}</button>
                    <button data-action="cancel-edit-count" class="p-2 text-red-500 hover:text-red-400 transition" title="Vazgeç">${icons.cancel}</button>
                </div>
                <div class="item-bag-count-dynamic font-bold w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-xl">${item.bagCount}</div>
            </div>
        </div>`;
    return div;
}

export function renderDashboard(dom, allItems, settings, formatDateFn, formatRelativeTimeFn) {
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
    dom.dashboard.waitingCustomers.textContent = waitingCustomers.size;
    dom.dashboard.waitingBags.textContent = waitingBags;
    dom.dashboard.deliveredLastWeek.textContent = deliveredLastWeek;
    const sortedActive = [...activeItems].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    if (sortedActive.length > 0) {
        dom.dashboard.oldestCustomers.innerHTML = sortedActive.slice(0, 3).map(item => `
            <div class="flex justify-between items-center text-sm bg-tertiary/40 p-2 rounded-md">
                <span class="font-medium text-primary">${item.customerName}</span>
                <span class="text-secondary">${formatRelativeTimeFn(item.createdAt)}</span>
            </div>
        `).join('');
    } else {
        dom.dashboard.oldestCustomers.innerHTML = '<p class="text-secondary text-center py-4">Bekleyen müşteri yok.</p>';
    }
    const today = new Date().toISOString().slice(0, 10);
    const reminders = allItems.filter(item => item.reminderDate === today && item.status === 'active');
    if (reminders.length > 0) {
        dom.dashboard.reminders.innerHTML = reminders.map(item => `
            <div class="bg-tertiary/40 p-2 rounded-md">
                <p class="font-medium text-primary">${item.customerName}</p>
                <p class="text-sm text-secondary truncate">${item.note || 'Hatırlatma'}</p>
            </div>
        `).join('');
    } else {
        dom.dashboard.reminders.innerHTML = '<p class="text-secondary text-center py-4">Bugün için hatırlatma yok.</p>';
    }
    dom.dashboard.customTextTitle.textContent = settings.customTitle || 'GÜNÜN NOTU';
    dom.dashboard.customTextContent.innerHTML = `<p>${settings.customContent || 'Ayarlar menüsünden bu notu düzenleyebilirsiniz.'}</p>`;
}

export function renderItems(dom, items, sortState, viewMode, searchQuery, formatDateFn, formatRelativeTimeFn) {
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
    if (viewMode === 'list') {
        dom.itemList.classList.remove('hidden');
        dom.itemGrid.classList.add('hidden');
        sorted.forEach(item => dom.itemList.appendChild(createItemElement(item, formatDateFn, formatRelativeTimeFn)));
    } else {
        dom.itemList.classList.add('hidden');
        dom.itemGrid.classList.remove('hidden');
        sorted.forEach(item => dom.itemGrid.appendChild(createItemCardElement(item, formatDateFn, formatRelativeTimeFn)));
    }
}

function createArchiveItemElement(item, formatDateFn) {
    const div = document.createElement('div');
    div.className = 'bg-primary/50 opacity-70 p-4 rounded-lg shadow-md flex items-center justify-between border border-dynamic';
    div.dataset.id = item.id;
    const deliveredByHtml = item.deliveredBy ? `<p class="item-subtext text-xs text-secondary/80 mt-1">Teslim Eden: ${item.deliveredBy}</p>` : '';
    div.innerHTML = `
        <div class="item-details flex-1 flex items-center gap-4">
            <div class="item-bag-count-dynamic font-bold w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full text-xl">${item.bagCount}</div>
            <div class="flex-1">
                <p class="item-customer-name font-semibold text-lg text-primary/80">${item.customerName}</p>
                <p class="item-subtext text-sm text-secondary">Teslim Edildi: ${formatDateFn(item.deliveredAt)}</p>
                ${deliveredByHtml}
            </div>
        </div>
        <div class="item-actions flex items-center gap-2 ml-2">
            <button data-action="restore" class="p-2 text-secondary hover:text-yellow-400 rounded-full transition" title="Geri Yükle"><svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg></button>
            <button data-action="delete-permanent" class="p-2 text-secondary hover:text-red-500 rounded-full transition" title="Kalıcı Olarak Sil"><svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"/></svg></button>
        </div>`;
    return div;
}

export function renderArchive(dom, archivedItems, searchQuery, archiveCurrentPage, itemsPerPage, formatDateFn, onPageChange) {
    const filtered = archivedItems.filter(item => toTrUpperCase(item.customerName).includes(searchQuery));
    const sorted = [...filtered].sort((a, b) => (b.deliveredAt?.seconds || 0) - (a.deliveredAt?.seconds || 0));
    dom.emptyArchiveListMessage.style.display = filtered.length === 0 ? 'block' : 'none';
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

    // Önceki (<) Butonu
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '&lt;'; // Küçüktür işareti
    prevBtn.className = 'pagination-btn p-2 bg-tertiary rounded-lg hover:accent-bg transition disabled:opacity-50 disabled:cursor-not-allowed';
    prevBtn.disabled = archiveCurrentPage === 1;
    prevBtn.onclick = () => onPageChange(archiveCurrentPage - 1);
    dom.archivePagination.appendChild(prevBtn);

    // Sayfa Numaraları
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = 'pagination-btn p-2 bg-tertiary rounded-lg hover:accent-bg transition';
        if (i === archiveCurrentPage) btn.classList.add('active');
        btn.onclick = () => onPageChange(i);
        dom.archivePagination.appendChild(btn);
    }

    // Sonraki (>) Butonu
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '&gt;'; // Büyüktür işareti
    nextBtn.className = 'pagination-btn p-2 bg-tertiary rounded-lg hover:accent-bg transition disabled:opacity-50 disabled:cursor-not-allowed';
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
    
    const reportPanel = document.getElementById('panel-reports');
    const isVisible = reportPanel && !reportPanel.classList.contains('hidden'); 
    
    if (!isVisible) {
        if (window.dashboardCharts.trend) { window.dashboardCharts.trend.destroy(); window.dashboardCharts.trend = null; }
        if (window.dashboardCharts.dist) { window.dashboardCharts.dist.destroy(); window.dashboardCharts.dist = null; }
        if (window.dashboardCharts.top) { window.dashboardCharts.top.destroy(); window.dashboardCharts.top = null; }
        return;
    }

    if (range === null) {
        const activeBtn = document.querySelector('.report-range-btn.accent-bg') || document.querySelector('.report-range-btn[data-range="7"]');
        if(activeBtn) {
            activeBtn.classList.add('accent-bg');
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

    contentDiv.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-tertiary p-4 rounded-xl border border-dynamic relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-secondary text-sm">Toplam Poşet</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                </div>
                <div class="text-3xl font-bold text-primary">${totalBagsInRange}</div>
                <div class="text-xs text-secondary mt-1">Bu dönemde eklenen</div>
            </div>
            <div class="bg-tertiary p-4 rounded-xl border border-dynamic relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-secondary text-sm">Teslim Edildi</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div class="text-3xl font-bold text-primary">${deliveredBagsInRange}</div>
                <div class="text-xs text-secondary mt-1">Bu dönemde teslim edilen</div>
            </div>
            <div class="bg-tertiary p-4 rounded-xl border border-dynamic relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-secondary text-sm">Ort. Bekleme</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div class="text-3xl font-bold text-primary">${avgWaitTime}</div>
                <div class="text-xs text-secondary mt-1">Ortalama gün</div>
            </div>
            <div class="bg-tertiary p-4 rounded-xl border border-dynamic relative overflow-hidden">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-secondary text-sm">Bekleyen</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div class="text-3xl font-bold text-primary">${waitingBagsFromRange}</div>
                <div class="text-xs text-secondary mt-1">Bu dönemden kalan</div>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-tertiary p-4 rounded-xl border border-dynamic overflow-hidden">
                <h3 class="font-semibold text-primary mb-4">Günlük Aktivite Trendi</h3>
                <div id="chart-trend" class="w-full h-64 relative"></div>
            </div>

            <div class="bg-tertiary p-4 rounded-xl border border-dynamic overflow-hidden">
                <h3 class="font-semibold text-primary mb-4">Poşet Durum Dağılımı</h3>
                <div id="chart-distribution" class="w-full h-64 relative"></div>
            </div>
        </div>

        <div class="bg-tertiary p-4 rounded-xl border border-dynamic mt-6 overflow-hidden">
            <h3 class="font-semibold text-primary mb-4">En Çok İşlem Yapan 10 Müşteri</h3>
            <div id="chart-top-customers" class="w-full h-80 relative"></div>
        </div>
    `;

    if (typeof ApexCharts === 'undefined') return;

    if (window.dashboardCharts.trend) window.dashboardCharts.trend.destroy();
    if (window.dashboardCharts.dist) window.dashboardCharts.dist.destroy();
    if (window.dashboardCharts.top) window.dashboardCharts.top.destroy();

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
            height: '100%',
            width: '100%',
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: 'Inter, sans-serif',
            parentHeightOffset: 0
        },
        colors: ['#22c55e', '#3b82f6'], 
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 100]
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
            padding: { top: 0, right: 0, bottom: 0, left: 10 }
        },
        theme: { mode: 'dark' },
        tooltip: { theme: 'dark' },
        legend: { position: 'top' }
    };
    const chartTrend = new ApexCharts(document.querySelector("#chart-trend"), optionsTrend);
    chartTrend.render();
    window.dashboardCharts.trend = chartTrend;

    const optionsDist = {
        series: [waitingBagsFromRange, deliveredBagsInRange],
        labels: ['Bekleyen', 'Teslim Edilen'],
        chart: {
            type: 'donut',
            height: '100%',
            width: '100%',
            background: 'transparent',
            fontFamily: 'Inter, sans-serif',
            parentHeightOffset: 0
        },
        colors: ['#fbbf24', '#22c55e'], 
        plotOptions: {
            pie: {
                donut: {
                    size: '75%',
                    labels: {
                        show: true,
                        name: { color: '#94a3b8', offsetY: 20 },
                        value: { 
                            color: '#e2e8f0', 
                            fontSize: '24px', 
                            fontWeight: 'bold',
                            offsetY: -20,
                            formatter: function (val) { return val } 
                        },
                        total: {
                            show: true,
                            label: 'Toplam',
                            color: '#94a3b8',
                            fontSize: '14px',
                            formatter: function (w) {
                                return w.globals.seriesTotals.reduce((a, b) => a + b, 0)
                            }
                        }
                    }
                }
            }
        },
        stroke: { show: false },
        dataLabels: { enabled: false },
        legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
        theme: { mode: 'dark' }
    };
    const chartDist = new ApexCharts(document.querySelector("#chart-distribution"), optionsDist);
    chartDist.render();
    window.dashboardCharts.dist = chartDist;

    const optionsTop = {
        series: [{
            name: 'İşlem Sayısı',
            data: topCustomers.map(c => c[1])
        }],
        chart: {
            type: 'bar',
            height: '100%',
            width: '100%',
            toolbar: { show: false },
            background: 'transparent',
            fontFamily: 'Inter, sans-serif',
            parentHeightOffset: 0
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: true,
                barHeight: '60%',
                distributed: true 
            }
        },
        colors: ['#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6'], 
        dataLabels: {
            enabled: true,
            textAnchor: 'start',
            style: { colors: ['#fff'] },
            formatter: function (val, opt) {
                return val
            },
            offsetX: 0,
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
    const chartTop = new ApexCharts(document.querySelector("#chart-top-customers"), optionsTop);
    chartTop.render();
    window.dashboardCharts.top = chartTop;
}

export function getUnseenOverdueItems(allItems, seenNotifications, overDueDays = 20) {
    const now = new Date();
    return allItems.filter(item => {
        if (item.status !== 'active') return false;
        const itemDate = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt);
        const diffDays = Math.floor((now - itemDate) / (1000 * 60 * 60 * 24));
        return diffDays >= overDueDays && !seenNotifications.includes(item.id);
    });
}

export function getUnseenReminders(allItems, seenNotifications) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allItems.filter(item => {
        if (item.status !== 'active' || !item.reminderDate) return false;
        const [y, m, d] = item.reminderDate.split('-').map(Number);
        const reminderDate = new Date(y, m - 1, d);
        return reminderDate <= today && !seenNotifications.includes(item.id);
    });
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
    setTimeout(() => {
        dom.modalContainer.classList.add('hidden');
        dom.modalContent.innerHTML = '';
    }, 300);
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

export function showDeliverConfirmationModal(dom, item, deliveryPersonnel, formatDateFn) {
    return new Promise(resolve => {
        const bagCount = item.bagCount ?? 1;
        const optionsHtml = deliveryPersonnel.length > 0 ? deliveryPersonnel.map(p => `<option value="${p.name}">${p.name}</option>`).join('') : '<option value="" disabled>Lütfen ayarlardan personel ekleyin</option>';
        
        // Yerel saati doğru hesaplamak için (TZ offseti çıkararak düzeltme)
        const now = new Date();
        const local = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        const today = local.toISOString().slice(0, 10);
        const currentTime = local.toISOString().slice(11, 16);

        dom.modalContent.innerHTML = `
            <h3 class="text-xl font-semibold mb-2 text-primary">Teslimatı Onayla</h3>
            <p class="text-secondary mb-4">'${item.customerName}' adlı müşterinin poşetini teslim etmek istediğinizden emin misiniz?</p>
            <div class="space-y-4 mb-6">
                <div>
                    <label for="deliver-bag-count-input" class="block text-sm font-medium text-secondary mb-1">Teslim edilen poşet sayısı:</label>
                    <input type="number" id="deliver-bag-count-input" min="1" max="${bagCount}" value="${bagCount}" class="w-full p-2 bg-tertiary border border-dynamic rounded-lg focus:ring-2 ring-accent transition">
                    <p class="text-xs text-secondary mt-1">Müşterinin toplam ${bagCount} poşeti var. Kısmi teslim için sayıyı azaltın.</p>
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

        confirmBtn.addEventListener('click', () => {
            let count = 1;
            if (inputEl) {
                count = parseInt(inputEl.value, 10);
            }
            if (isNaN(count) || count < 1) count = 1;
            if (count > bagCount) count = bagCount;
            
            hideModalUI(dom);
            resolve({ 
                confirmed: true, 
                deliveredBy: select.value, 
                deliveryDate: dateInput.value, 
                deliveryTime: timeInput.value, 
                deliveredCount: count 
            });
        }, { once: true });

        cancelBtn.addEventListener('click', () => {
            hideModalUI(dom);
            resolve({ confirmed: false });
        }, { once: true });

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

export function showNotificationsModal(dom, allItems, seenNotifications, userId, formatRelativeTimeFn, onMarkAsRead, onMarkAllAsRead) {
    const unseenReminders = getUnseenReminders(allItems, seenNotifications);
    const unseenOverdue = getUnseenOverdueItems(allItems, seenNotifications);
    let modalHtml = `<div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-primary">Bildirimler</h3><button id="modal-close" class="p-1 text-secondary hover:text-primary transition">${icons.cancel}</button></div><div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">`;
    if (unseenReminders.length > 0) {
        modalHtml += `<div><h4 class="text-lg font-semibold text-cyan-300 mb-2">Bugünün Hatırlatmaları</h4><div class="space-y-2">`;
        unseenReminders.forEach(item => {
            modalHtml += `<div class="bg-tertiary/50 p-3 rounded-md flex justify-between items-center"><div><p class="text-primary font-medium">${item.customerName}</p><p class="text-sm text-cyan-200">${item.note || 'Hatırlatıcı'}</p></div><button data-notif-id="${item.id}" class="mark-as-read-btn text-sm bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-500 transition">Okundu</button></div>`;
        });
        modalHtml += `</div></div>`;
    }
    if (unseenOverdue.length > 0) {
        modalHtml += `<div><h4 class="text-lg font-semibold text-yellow-400 mb-2">Geciken Poşetler (20+ gün)</h4><div class="space-y-2">`;
        unseenOverdue.forEach(item => {
            modalHtml += `<div class="bg-tertiary/50 p-3 rounded-md flex justify-between items-center"><div><p class="text-primary font-medium">${item.customerName}</p><p class="text-sm text-yellow-300">${formatRelativeTimeFn(item.createdAt)}</p></div><button data-notif-id="${item.id}" class="mark-as-read-btn text-sm bg-slate-600 px-3 py-1 rounded-md hover:bg-slate-500 transition">Okundu</button></div>`;
        });
        modalHtml += `</div></div>`;
    }
    if (unseenReminders.length === 0 && unseenOverdue.length === 0) modalHtml += `<p class="text-center text-secondary py-4">Okunmamış bildirim bulunmuyor.</p>`;
    modalHtml += `</div>`;
    if (unseenReminders.length > 0 || unseenOverdue.length > 0) modalHtml += `<div class="mt-4 pt-4 border-t border-dynamic"><button id="mark-all-as-read" class="w-full bg-tertiary p-2 rounded-lg hover:bg-slate-600 transition">Tümünü Okundu İşaretle</button></div>`;
    dom.modalContent.innerHTML = modalHtml;
    showModalUI(dom);
    dom.modalContent.querySelector('#modal-close')?.addEventListener('click', () => hideModalUI(dom), { once: true });
    dom.modalContent.querySelector('#mark-all-as-read')?.addEventListener('click', () => { onMarkAllAsRead(); hideModalUI(dom); });
    dom.modalContent.querySelectorAll('.mark-as-read-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { onMarkAsRead(e.target.dataset.notifId); });
    });
}

export function showCustomerDetailModal(dom, customerName, allItems, formatDateFn, iconsRef, onClose, onExportPdf) {
    const customerItems = allItems.filter(item => item.customerName === customerName);
    const activeItem = customerItems.find(item => item.status === 'active');
    const deliveredItems = customerItems.filter(item => item.status === 'delivered').sort((a, b) => (b.deliveredAt?.seconds || 0) - (a.deliveredAt?.seconds || 0));
    let modalHtml = `<div class="flex justify-between items-start mb-4"><h3 class="text-2xl font-bold accent-text">${customerName}</h3><div class="flex items-center gap-2"><button id="export-customer-pdf-btn" class="p-2 text-secondary hover:text-rose-400 transition" title="Bu Müşterinin Geçmişini PDF Aktar">PDF</button><button id="modal-close" class="p-1 text-secondary hover:text-primary transition">${iconsRef.cancel}</button></div></div><div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2">`;
    if (activeItem) modalHtml += `<div><h4 class="text-lg font-semibold text-primary mb-2 border-b border-dynamic pb-1">Bekleyen Poşetler</h4><div class="bg-tertiary/50 p-3 rounded-md"><p><span class="font-semibold">${activeItem.bagCount}</span> adet poşet</p><p class="text-sm text-secondary mt-1">İlk Eklenme: ${formatDateFn(activeItem.createdAt)}</p>${(activeItem.additionalDates && activeItem.additionalDates.length > 0) ? activeItem.additionalDates.map(d => `<p class="text-xs text-secondary/80 pl-2">+ Eklenme: ${formatDateFn(d)}</p>`).join('') : ''}</div></div>`;
    if (deliveredItems.length > 0) modalHtml += `<div><h4 class="text-lg font-semibold text-primary mb-2 border-b border-dynamic pb-1">Teslim Edilenler</h4><div id="customer-delivered-list" class="space-y-2"></div><div id="customer-delivered-pagination" class="flex justify-center items-center mt-4 space-x-2"></div></div>`;
    if (activeItem && (activeItem.note || activeItem.reminderDate)) modalHtml += `<div><h4 class="text-lg font-semibold text-primary mb-2 border-b border-dynamic pb-1">Not ve Hatırlatıcı</h4><div class="bg-tertiary/50 p-3 rounded-md"><p class="whitespace-pre-wrap">${activeItem.note || '<i>Not girilmemiş.</i>'}</p>${activeItem.reminderDate ? `<p class="text-sm mt-2 text-cyan-300"><strong>Hatırlatıcı:</strong> ${activeItem.reminderDate}</p>` : ''}</div></div>`;
    if (!activeItem && deliveredItems.length === 0) modalHtml += `<p class="text-center text-secondary py-4">Bu müşteri için kayıt bulunamadı.</p>`;
    modalHtml += `</div>`;
    dom.modalContent.innerHTML = modalHtml;
    showModalUI(dom);
    const listContainer = document.getElementById('customer-delivered-list');
    const paginationContainer = document.getElementById('customer-delivered-pagination');
    const perPage = 5;
    const totalPages = Math.ceil(deliveredItems.length / perPage);
    const renderPage = (page) => {
        if (!listContainer) return;
        listContainer.innerHTML = '';
        const start = (page - 1) * perPage;
        deliveredItems.slice(start, start + perPage).forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-tertiary/50 p-3 rounded-md';
            div.innerHTML = `<p><span class="font-semibold">${item.bagCount}</span> adet poşet</p><p class="text-sm text-secondary mt-1">Teslim Tarihi: ${formatDateFn(item.deliveredAt)}</p><p class="text-xs text-secondary/80">Teslim Eden: ${item.deliveredBy || '-'}</p>`;
            listContainer.appendChild(div);
        });
        if (paginationContainer && totalPages > 1) {
            paginationContainer.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = 'pagination-btn p-2' + (i === page ? ' active' : '');
                btn.onclick = () => renderPage(i);
                paginationContainer.appendChild(btn);
            }
        }
    };
    renderPage(1);
    dom.modalContent.querySelector('#modal-close')?.addEventListener('click', () => hideModalUI(dom), { once: true });
    dom.modalContent.querySelector('#export-customer-pdf-btn')?.addEventListener('click', () => onExportPdf(customerName));
}

export function exportDataToJSON(allItems, allCustomers, deliveryPersonnel, settings) {
    const data = { allItems, allCustomers, deliveryPersonnel, settings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poset-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function exportToCSV(allItems, formatDateFn) {
    const activeItems = allItems.filter(item => item.status !== 'delivered');
    if (activeItems.length === 0) return false;
    const headers = 'Musteri Adi,Poset Sayisi,Not,Son Degisiklik Tarihi';
    const rows = activeItems.map(item => `"${item.customerName.replace(/"/g, '""')}",${item.bagCount},"${(item.note || '').replace(/"/g, '""')}",${formatDateFn(item.lastModified)}`);
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'poset_listesi.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    return true;
}

export function exportActiveItemsToPDF(activeItems, formatDateFn, jsPDF) {
    if (activeItems.length === 0) return false;
    const pdf = new jsPDF();
    pdf.text('Bekleyen Poset Listesi', 14, 16);
    const tableColumn = ['#', 'Musteri Adi', 'Poset Sayisi', 'Eklenme Tarihi'];
    const tableRows = activeItems.map((item, i) => [i + 1, toPdfAscii(item.customerName), item.bagCount, formatDateFn(item.createdAt).split(' ')[0]]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    pdf.save(`bekleyen-poset-listesi-${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
}

export function exportArchiveToPDF(archivedItems, formatDateFn, jsPDF) {
    if (archivedItems.length === 0) return false;
    const pdf = new jsPDF();
    pdf.text('Teslim Edilenler Arsivi', 14, 16);
    const tableColumn = ['#', 'Musteri Adi', 'Poset', 'Teslim Eden', 'Teslim Tarihi'];
    const tableRows = archivedItems.map((item, i) => [i + 1, toPdfAscii(item.customerName), item.bagCount, toPdfAscii(item.deliveredBy || '-'), formatDateFn(item.deliveredAt).split(' ')[0]]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    pdf.save(`teslim-edilenler-${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
}

export function exportReportsToPDF(allItems, formatDateFn, getDayDifferenceFn, jsPDF) {
    const deliveredItems = allItems.filter(item => item.status === 'delivered' && item.createdAt && item.deliveredAt).sort((a, b) => (b.deliveredAt?.seconds || 0) - (a.deliveredAt?.seconds || 0));
    if (deliveredItems.length === 0) return false;
    const pdf = new jsPDF();
    pdf.text('Teslim Edilen Poset Raporu', 14, 16);
    const tableColumn = ['Musteri Adi', 'Alinma Tarihi', 'Teslim Tarihi', 'Bekleme Suresi (Gun)'];
    const tableRows = deliveredItems.map(item => [toPdfAscii(item.customerName), formatDateFn(item.createdAt).split(' ')[0], formatDateFn(item.deliveredAt).split(' ')[0], getDayDifferenceFn(item.createdAt, item.deliveredAt)]);
    pdf.autoTable({ head: [tableColumn], body: tableRows, startY: 20 });
    pdf.save(`teslim-raporu-${new Date().toISOString().slice(0, 10)}.pdf`);
    return true;
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
        div.innerHTML = `<div class="person-display flex justify-between items-center"><span class="person-name-text text-primary text-sm">${person.name}</span><div class="flex items-center gap-2"><button data-person-action="edit" class="p-1 text-secondary hover:text-yellow-400 transition" title="Düzenle">${iconsRef.edit}</button><button data-person-action="delete" class="p-1 text-secondary hover:text-red-500 transition" title="Sil">${iconsRef.delete}</button></div></div><div class="person-edit hidden flex items-center gap-2"><input type="text" value="${person.name}" class="person-name-input flex-grow p-1 bg-secondary border border-dynamic text-primary rounded-md text-sm focus:ring-1 ring-accent transition"><div class="flex items-center gap-1"><button data-person-action="save-edit" class="p-1 text-green-400 hover:text-green-300 transition" title="Kaydet">${iconsRef.save}</button><button data-person-action="cancel-edit" class="p-1 text-red-500 hover:text-red-400 transition" title="İptal">${iconsRef.cancel}</button></div></div>`;
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
