// Firebase kütüphanelerini import et
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail, updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, addDoc, getDocs, updateDoc, deleteDoc, 
    onSnapshot, query, where, serverTimestamp, writeBatch, arrayUnion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase yapılandırması
const firebaseConfig = {
    apiKey: "AIzaSyDsIDN74rIPhYtdaTIkeGcrczxQEjr7-sw",
    authDomain: "emre-bebe-takip.firebaseapp.com",
    projectId: "emre-bebe-takip",
    storageBucket: "emre-bebe-takip.appspot.com",
    messagingSenderId: "174642780473",
    appId: "1:174642780473:web:89c50d5f80612c16e3f0e8"
};

// PDF kütüphanesini global scope'tan al
const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', () => {
    // DOM elementleri
    const dom = {
        loadingOverlay: document.getElementById('loading-overlay'),
        loadingText: document.getElementById('loading-text'),
        loadingSpinner: document.getElementById('loading-spinner'),
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
        emptyItemListMessage: document.getElementById('empty-item-list-message'),
        totalBagsCounter: document.getElementById('total-bags-counter'),
        totalCustomersCounter: document.getElementById('total-customers-counter'),
        sortAlphaBtn: document.getElementById('sort-alpha'),
        sortBagsBtn: document.getElementById('sort-bags'),
        sortDateBtn: document.getElementById('sort-date'),
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
        manageCustomersBtn: document.getElementById('manage-customers-btn'),
        manageDeliveryPersonnelBtn: document.getElementById('manage-delivery-personnel-btn'),
        exportJsonBtn: document.getElementById('export-json-btn'),
        importJsonBtn: document.getElementById('import-json-btn'),
        importFileInput: document.getElementById('import-file-input'),
        resetItemsBtn: document.getElementById('reset-items-btn'),
        resetAllBtn: document.getElementById('reset-all-btn'),
        modalContainer: document.getElementById('modal-container'),
        modalContentWrapper: document.getElementById('modal-content-wrapper'),
        modalContent: document.getElementById('modal-content'),
        notificationBell: document.getElementById('notification-bell'),
        notificationBadge: document.getElementById('notification-badge'),
        scrollToTopBtn: document.getElementById('scroll-to-top-btn'),
        shareTemplateInput: document.getElementById('share-template-input'),
        saveShareTemplateBtn: document.getElementById('save-share-template-btn'),
        customText: {
            titleInput: document.getElementById('custom-text-title-input'),
            contentInput: document.getElementById('custom-text-content-input'),
            saveBtn: document.getElementById('save-custom-text-btn')
        },
        dashboard: {
            waitingCustomers: document.getElementById('dashboard-waiting-customers'),
            waitingBags: document.getElementById('dashboard-waiting-bags'),
            deliveredLastWeek: document.getElementById('dashboard-delivered-last-week'),
            oldestCustomers: document.getElementById('dashboard-oldest-customers'),
            reminders: document.getElementById('dashboard-reminders'),
            customTextTitle: document.getElementById('dashboard-custom-text-title'),
            customTextContent: document.getElementById('dashboard-custom-text-content'),
        }
    };

    // Uygulama state'i
    let app, auth, db, userId, currentUser;
    let allItems = [], allCustomers = [], deliveryPersonnel = [], settings = {};
    let sortState = { type: 'alpha', direction: 'asc' };
    let archiveCurrentPage = 1, customerDetailCurrentPage = 1;
    const itemsPerPage = 10, customerDetailItemsPerPage = 5;
    let itemsUnsubscribe, customersUnsubscribe, deliveryPersonnelUnsubscribe;
    let seenNotifications = [];

    // --- YENİ EKLENEN HATA AYIKLAMA BÖLÜMÜ ---
    try {
        console.log("Uygulama başlatılıyor, Firebase ayarları yapılıyor...");
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        console.log("Firebase başarıyla başlatıldı. Kimlik doğrulama durumu bekleniyor...");

        onAuthStateChanged(auth, user => {
            console.log("Kimlik doğrulama durumu değişti:", user ? `Giriş yapıldı (${user.uid})` : "Giriş yapılmadı.");
            if (user) {
                userId = user.uid;
                // Tüm veri dinleyicilerini ve uygulama arayüzünü burada başlat.
                // Örn: initializeDataListeners();
                showAppUI(user);
            } else {
                // Oturum kapalıysa veya kullanıcı yoksa, tüm dinleyicileri durdur.
                // Örn: detachDataListeners();
                showAuthUI();
            }
        });

    } catch (error) {
        console.error("KRİTİK HATA: Firebase başlatılamadı!", error);
        dom.loadingText.textContent = `Hata: ${error.message}. Lütfen konsolu kontrol edin.`;
        if (dom.loadingSpinner) dom.loadingSpinner.style.display = 'none';
    }
    // --- HATA AYIKLAMA BÖLÜMÜ SONU ---


    // İkonlar
    const icons = {
        alpha_asc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.082 12.629 9.664 14H8.598l1.789-5.332h1.234L13.402 14h-1.12l-.419-1.371h-1.781zm1.57-1.055h-1.296l.648-2.042.648 2.042z"/><path d="M12.96 7.022c.16-.21.283-.417.371-.622h.043c.09.205.214.412.375.622L15.04 8.5h-1.2l-.71-1.258h-.043l-.71 1.258h-1.21l1.83-3.05zM4.5 2.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2a.5.5 0 0 0-.708-.708L4.5 12.293V2.5z"/></svg>',
        alpha_desc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.082 3.629 9.664 2H8.598l1.789 5.332h1.234L13.402 2h-1.12l-.419 1.371h-1.781zm1.57 1.055h-1.296l.648 2.042.648 2.042z"/><path d="M12.96 10.022c.16.21.283-.417.371.622h.043c.09-.205.214-.412.375-.622L15.04 8.5h-1.2l-.71 1.258h-.043l-.71-1.258h-1.21l1.83 3.05zM4.5 13.5a.5.5 0 0 1-1 0V3.707L2.354 4.854a.5.5 0 1 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L4.5 3.707V13.5z"/></svg>',
        bags_desc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11.5 2.707V14.5a.5.5 0 0 0 .5.5z"/><path fill-rule="evenodd" d="M2.5 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0v-13a.5.5 0 0 1 .5-.5z"/></svg>',
        bags_asc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L11.5 13.293V1.5a.5.5 0 0 1 .5-.5z"/><path fill-rule="evenodd" d="M2.5 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0v-13a.5.5 0 0 1 .5-.5z"/></svg>',
        date_desc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>',
        date_asc: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M10.854 8.854a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708 0l-1.5 1.5a.5.5 0 0 0 .708.708L7.5 6.707l2.646 2.647a.5.5 0 0 0 .708 0z"/><path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5zM1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4H1z"/></svg>',
        cancel_item: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"/></svg>',
        edit: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.293z"/></svg>',
        delete: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3V2h11v1z"/></svg>',
        save: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/></svg>',
        cancel: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/></svg>',
    };

    // Yardımcı Fonksiyonlar
    const toTrUpperCase = (str) => str ? str.toLocaleUpperCase('tr-TR') : '';
    const getSettingsFromStorage = () => JSON.parse(localStorage.getItem(`emanet-settings-${userId}`)) || { 
        theme: 'aurora', 
        fontSize: 16,
        customTitle: 'GÜNÜN NOTU',
        customContent: 'Ayarlar menüsünden bu notu düzenleyebilirsiniz.',
        shareTemplate: 'Merhaba, [Müşteri Adı] adına ayrılan [Poşet Sayısı] poşetiniz [Bekleme Süresi] gündür beklemektedir.'
    };
    const saveSettingsToStorage = (settings) => localStorage.setItem(`emanet-settings-${userId}`, JSON.stringify(settings));
    const formatDate = (iso) => {
        if(!iso) return '';
        const date = iso.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
        return date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short'});
    };
    const formatRelativeTime = (iso) => {
        if (!iso) return '';
        const date = iso.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
        const now = new Date();
        const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'gelecekte';
        if (diffDays === 0) return 'bugün';
        if (diffDays === 1) return 'dün';
        return `${diffDays} gün önce`;
    };
    function getDayDifference(date1, date2) {
        if (!date1 || !date2) return '-';
        const d1 = date1.seconds ? new Date(date1.seconds * 1000) : new Date(date1);
        const d2 = date2.seconds ? new Date(date2.seconds * 1000) : new Date(date2);
        const difference = d2.getTime() - d1.getTime();
        const days = Math.ceil(difference / (1000 * 3600 * 24));
        return days >= 0 ? days : '-';
    }
    function getWaitingDays(iso) {
        if (!iso) return 0;
        const date = iso.seconds ? new Date(iso.seconds * 1000) : new Date(iso);
        const now = new Date();
        const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 ? diffDays : 0;
    }
    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showSimpleMessageModal('Kopyalandı', 'Mesaj panoya kopyalandı.', true);
        } catch (err) {
            showSimpleMessageModal('Hata', 'Mesaj kopyalanamadı.');
        }
        document.body.removeChild(textarea);
    }

    // UI Fonksiyonları
    function showLoading(message) {
        dom.loadingText.textContent = message;
        dom.loadingOverlay.style.display = 'flex';
        dom.loadingOverlay.style.opacity = '1';
    }

    function hideLoading() {
        dom.loadingOverlay.style.opacity = '0';
        setTimeout(() => { dom.loadingOverlay.style.display = 'none'; }, 300);
    }

    function showAuthUI() {
        dom.appContainer.classList.add('hidden');
        dom.authContainer.classList.remove('hidden');
        dom.loginForm.classList.remove('hidden');
        dom.registerForm.classList.add('hidden');
        dom.forgotPasswordForm.classList.add('hidden');
        hideLoading();
    }

    function showAppUI(user) {
        currentUser = user;
        dom.authContainer.classList.add('hidden');
        dom.appContainer.classList.remove('hidden');
        dom.settingsUserEmail.textContent = user.email;
        hideLoading();
    }
    // Geri kalan tüm diğer fonksiyonlar ve event listener'lar buraya gelecek...
    // Bu dosyanın geri kalanını olduğu gibi bırakabilirsiniz.
});
