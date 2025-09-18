import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    updatePassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, addDoc, getDocs, updateDoc, deleteDoc, 
    onSnapshot, query, where, serverTimestamp, writeBatch, arrayUnion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- ÖNEMLİ AÇIKLAMA: GITHUB & FIREBASE API ANAHTARI ---
// GitHub'a kod yüklerken "API anahtarı sızdırıldı" gibi bir güvenlik uyarısı alabilirsiniz.
// Bu durum, aşağıdaki `firebaseConfig` nesnesindeki `apiKey` yüzündendir.
//
// 1. BU BİR HATA DEĞİLDİR: Firebase'in web uygulamaları için sağladığı API anahtarları
//    "gizli" bilgi değildir. Bu anahtar, uygulamanızın hangi Firebase projesine
//    ait olduğunu belirtir.
//
// 2. GÜVENLİK NASIL SAĞLANIR?: Uygulamanızın gerçek güvenliği, API anahtarını gizlemekle
//    değil, Firebase konsolunda yazacağınız "Güvenlik Kuralları" (Security Rules)
//    ile sağlanır. Bu kurallar, veritabanınıza kimin, ne koşulda erişebileceğini belirler.
//
// 3. GITHUB UYARISINI GEÇME: Eğer GitHub bu dosyanın yüklenmesini engellerse,
//    deponuzun (repository) "Security" -> "Secret scanning alerts" bölümüne gidin.
//    Orada bu anahtarla ilgili uyarıyı bulup "false positive" (yanlış alarm) veya
//    "used in production" (kullanımda) olarak işaretleyerek sorunu çözebilirsiniz.
//
// Bu anahtarı silerseniz uygulama çalışmaz. Bu yüzden olduğu gibi bırakın.
const firebaseConfig = {
    apiKey: "AIzaSyDsIDN74rIPhYtdaTIkeGcrczxQEjr7-sw",
    authDomain: "emre-bebe-takip.firebaseapp.com",
    projectId: "emre-bebe-takip",
    storageBucket: "emre-bebe-takip.appspot.com",
    messagingSenderId: "174642780473",
    appId: "1:174642780473:web:89c50d5f80612c16e3f0e8"
};

// PDF kütüphanesini global scope'tan alıyoruz.
const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', () => {
    // DOM elementlerini tek bir objede toplayarak kod okunurluğunu artırıyoruz.
    const dom = {
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
        // Settings
        shareTemplateInput: document.getElementById('share-template-input'),
        saveShareTemplateBtn: document.getElementById('save-share-template-btn'),
        customText: {
            titleInput: document.getElementById('custom-text-title-input'),
            contentInput: document.getElementById('custom-text-content-input'),
            saveBtn: document.getElementById('save-custom-text-btn')
        },
        // Dashboard Elements
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

    // Uygulama state'ini (durumunu) yöneten değişkenler
    let app, auth, db, userId, currentUser;
    let allItems = [];
    let allCustomers = [];
    let deliveryPersonnel = [];
    let settings = {};
    let sortState = { type: 'alpha', direction: 'asc' };
    let archiveCurrentPage = 1;
    const itemsPerPage = 10;
    let itemsUnsubscribe = null;
    let customersUnsubscribe = null;
    let deliveryPersonnelUnsubscribe = null;
    let seenNotifications = []; 
    let customerDetailCurrentPage = 1;
    const customerDetailItemsPerPage = 5;

    // Sık kullanılan ikonları bir objede topluyoruz.
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
        textarea.style.position = 'fixed'; // Prevent scrolling to bottom of page in MS Edge.
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

    // UI Fonksiyonları (Yükleme, Arayüz Geçişleri)
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

    // Authentication (Giriş/Kayıt) Fonksiyonları
    function setupAuthEventListeners() {
        dom.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoading('Giriş yapılıyor...');
            dom.loginError.classList.add('hidden');
            const email = dom.loginForm['login-email'].value;
            const password = dom.loginForm['login-password'].value;
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                dom.loginError.textContent = "Giriş başarısız. E-posta veya şifre hatalı.";
                dom.loginError.classList.remove('hidden');
                hideLoading();
            }
        });

        dom.registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showLoading('Hesap oluşturuluyor...');
            dom.registerError.classList.add('hidden');
            const email = dom.registerForm['register-email'].value;
            const password = dom.registerForm['register-password'].value;
             if(password.length < 6) {
                dom.registerError.textContent = 'Şifre en az 6 karakter olmalıdır.';
                dom.registerError.classList.remove('hidden');
                hideLoading();
                return;
            }
            try {
                await createUserWithEmailAndPassword(auth, email, password);
            } catch (error) {
                dom.registerError.textContent = "Kayıt başarısız. Bu e-posta zaten kullanılıyor olabilir.";
                dom.registerError.classList.remove('hidden');
                hideLoading();
            }
        });
        
        dom.forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = dom.forgotPasswordForm['forgot-email'].value;
            showLoading('Sıfırlama linki gönderiliyor...');
            dom.forgotError.classList.add('hidden');
            dom.forgotSuccess.classList.add('hidden');
            try {
                await sendPasswordResetEmail(auth, email);
                dom.forgotSuccess.textContent = 'Sıfırlama linki e-posta adresinize gönderildi.';
                dom.forgotSuccess.classList.remove('hidden');
            } catch(error) {
                dom.forgotError.textContent = 'E-posta gönderilemedi. Adresin doğru olduğundan emin olun.';
                dom.forgotError.classList.remove('hidden');
            } finally {
                hideLoading();
            }
        });

        dom.logoutBtn.addEventListener('click', () => {
            signOut(auth);
        });

        dom.showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dom.loginForm.classList.add('hidden');
            dom.registerForm.classList.remove('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
        });

        dom.showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            dom.loginForm.classList.remove('hidden');
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
        });
        
        dom.forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            dom.loginForm.classList.add('hidden');
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.remove('hidden');
        });

        dom.backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            dom.loginForm.classList.remove('hidden');
            dom.registerForm.classList.add('hidden');
            dom.forgotPasswordForm.classList.add('hidden');
        });
    }
    
    // Ayarlar ve Render Fonksiyonları
    function applySettings() {
        document.body.className = 'bg-secondary text-primary'; // Reset classes
        if(settings.theme) {
            document.body.classList.add(`theme-${settings.theme}`);
        }
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === settings.theme);
        });

        document.body.style.fontSize = `${settings.fontSize}px`;
        const fontSizeSlider = document.getElementById('font-size-slider');
        const fontSizePreview = document.getElementById('font-size-preview');
        if(fontSizeSlider) fontSizeSlider.value = settings.fontSize;
        if(fontSizePreview) fontSizePreview.textContent = `${settings.fontSize}px`;

        // Özel not ayarlarını yükle
        if(dom.customText.titleInput) dom.customText.titleInput.value = settings.customTitle || '';
        if(dom.customText.contentInput) dom.customText.contentInput.value = settings.customContent || '';
        if(dom.shareTemplateInput) dom.shareTemplateInput.value = settings.shareTemplate || '';
    }

    function renderAll() {
        const activeItems = allItems.filter(item => item.status !== 'delivered');
        const archivedItems = allItems.filter(item => item.status === 'delivered');
        renderDashboard(activeItems, archivedItems);
        renderItems(activeItems);
        renderArchive(archivedItems);
        renderNotes();
        renderReports();
        checkAndDisplayNotifications();
    }

    function renderDashboard(activeItems, archivedItems) {
        // Stat Cards
        const waitingCustomers = new Set(activeItems.map(item => item.customerName));
        const waitingBags = activeItems.reduce((sum, item) => sum + item.bagCount, 0);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const deliveredLastWeek = archivedItems.filter(item => {
            const deliveredDate = item.deliveredAt?.seconds ? new Date(item.deliveredAt.seconds * 1000) : new Date(item.deliveredAt);
            return deliveredDate >= sevenDaysAgo;
        }).reduce((sum, item) => sum + item.bagCount, 0); // Poşet sayısını topla

        dom.dashboard.waitingCustomers.textContent = waitingCustomers.size;
        dom.dashboard.waitingBags.textContent = waitingBags;
        dom.dashboard.deliveredLastWeek.textContent = deliveredLastWeek;

        // Oldest 3 Customers
        const sortedActiveItems = [...activeItems].sort((a, b) => {
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime() / 1000;
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime() / 1000;
            return dateA - dateB;
        });

        if(sortedActiveItems.length > 0) {
            dom.dashboard.oldestCustomers.innerHTML = sortedActiveItems.slice(0, 3).map(item => `
                <div class="flex justify-between items-center text-sm bg-tertiary/40 p-2 rounded-md">
                    <span class="font-medium text-primary">${item.customerName}</span>
                    <span class="text-secondary">${formatRelativeTime(item.createdAt)}</span>
                </div>
            `).join('');
        } else {
            dom.dashboard.oldestCustomers.innerHTML = '<p class="text-secondary text-center py-4">Bekleyen müşteri yok.</p>';
        }

        // Daily Reminders
        const today = new Date().toISOString().slice(0, 10);
        const reminders = allItems.filter(item => item.reminderDate === today && item.status === 'active');
        if(reminders.length > 0) {
            dom.dashboard.reminders.innerHTML = reminders.map(item => `
                <div class="bg-tertiary/40 p-2 rounded-md">
                    <p class="font-medium text-primary">${item.customerName}</p>
                    <p class="text-sm text-secondary truncate">${item.note || 'Hatırlatma'}</p>
                </div>
            `).join('');
        } else {
            dom.dashboard.reminders.innerHTML = '<p class="text-secondary text-center py-4">Bugün için hatırlatma yok.</p>';
        }

        // Custom Text
        dom.dashboard.customTextTitle.textContent = settings.customTitle || 'GÜNÜN NOTU';
        dom.dashboard.customTextContent.innerHTML = `<p>${settings.customContent || 'Ayarlar menüsünden bu notu düzenleyebilirsiniz.'}</p>`;
    }
    
    function renderItems(items) {
        const searchQuery = toTrUpperCase(dom.customerNameInput.value);
        let filteredItems = items.filter(item => toTrUpperCase(item.customerName).includes(searchQuery));
        
        dom.totalBagsCounter.textContent = filteredItems.reduce((sum, item) => sum + item.bagCount, 0);
        const customerNames = new Set(filteredItems.map(item => item.customerName));
        dom.totalCustomersCounter.textContent = customerNames.size;

        const direction = sortState.direction === 'asc' ? 1 : -1;
        filteredItems.sort((a, b) => {
            if (sortState.type === 'alpha') return a.customerName.localeCompare(b.customerName, 'tr') * direction;
            if (sortState.type === 'bags') return (a.bagCount - b.bagCount) * direction;
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt || 0).getTime();
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt || 0).getTime();
            return (dateB - dateA) * direction;
        });
        
        dom.itemList.innerHTML = '';
        dom.emptyItemListMessage.style.display = filteredItems.length === 0 ? 'block' : 'none';
        dom.emptyItemListMessage.textContent = searchQuery ? `"${searchQuery}" İLE EŞLEŞEN SONUÇ BULUNAMADI.` : `HENÜZ BEKLEYEN POŞET BULUNMUYOR.`;
        filteredItems.forEach(item => dom.itemList.appendChild(createItemElement(item)));
    }

     function createItemElement(item) {
        const div = document.createElement('div');
        const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt || new Date());
        
        // Gün farkını, günün saatini göz ardı ederek hesapla. Bu,
        // formatRelativeTime fonksiyonundaki mantıkla tutarlılık sağlar.
        const now = new Date();
        const diffDays = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / (1000 * 60 * 60 * 24));

        const overdueClass = (() => {
            if (diffDays >= 20) return 'border-red-500/60 bg-red-500/10';
            if (diffDays >= 10 && diffDays <= 19) return 'border-yellow-500/60 bg-yellow-500/10';
            return 'border-dynamic';
        })();

        let noteIndicatorHTML = '';
        if(item.note) {
            noteIndicatorHTML += `<span class="accent-text text-xs" title="Not Mevcut">●</span>`;
        }
        if(item.reminderDate) {
             noteIndicatorHTML += `<span class="text-cyan-400 text-xs ml-1" title="Hatırlatıcı: ${item.reminderDate}">🔔</span>`;
        }
        
        let historyHtml = '';
        if (item.createdAt) {
            historyHtml += `<p class="item-subtext text-sm text-secondary">Eklendi: ${formatDate(item.createdAt).split(' ')[0]} (${formatRelativeTime(item.createdAt)})</p>`;
        } else {
            historyHtml += '<p class="item-subtext text-sm text-secondary">Eklenme tarihi yok</p>';
        }
        if (item.additionalDates && Array.isArray(item.additionalDates) && item.additionalDates.length > 0) {
            const otherAdditions = item.additionalDates.map(date => {
                return `<p class="item-subtext text-xs text-secondary/80 pl-2">+ Poşet Eklendi: ${formatDate(date).split(' ')[0]} (${formatRelativeTime(date)})</p>`;
            }).join('');
            historyHtml += otherAdditions;
        }
        
        div.className = `bg-primary p-4 rounded-lg shadow-md flex items-center justify-between border ${overdueClass} transition-colors duration-300`;
        div.dataset.id = item.id;
        div.dataset.customerName = item.customerName;
        div.innerHTML = `
            <div class="item-details flex-1 flex items-center gap-4">
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button data-action="decrement-bag" class="bg-tertiary text-primary w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-600 transition disabled:opacity-50" ${item.bagCount <= 1 ? 'disabled' : ''}>-</button>
                    <span class="item-bag-count-dynamic font-bold w-12 h-12 flex items-center justify-center rounded-full text-xl">${item.bagCount}</span>
                    <button data-action="increment-bag" class="bg-tertiary text-primary w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-600 transition">+</button>
                </div>
                <div class="flex-1">
                    <button data-action="view-customer" class="item-customer-name font-semibold text-lg text-primary text-left flex items-center gap-2 hover:underline">${item.customerName} ${noteIndicatorHTML}</button>
                    ${historyHtml}
                </div>
            </div>
            <div class="item-actions flex items-center gap-1 sm:gap-2 ml-2">
                <div class="default-actions flex items-center gap-1 sm:gap-2">
                    <button data-action="share" class="p-2 text-secondary hover:accent-text rounded-full transition" title="Paylaş"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M13.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2.5a2.5 2.5 0 1 1 .603 1.628l-6.718 3.12a2.499 2.499 0 0 1 0 1.504l6.718 3.12a2.5 2.5 0 1 1-.488.876l-6.718-3.12a2.5 2.5 0 1 1 0-3.256l6.718-3.12A2.5 2.5 0 0 1 11 2.5zm-8.5 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg></button>
                    <button data-action="edit-count" class="p-2 text-secondary hover:accent-text rounded-full transition" title="Poşet Sayısını Düzenle">${icons.edit}</button>
                    <button data-action="edit-note" class="p-2 text-secondary hover:accent-text rounded-full transition ${item.note || item.reminderDate ? 'accent-text' : ''}" title="Notu ve Hatırlatıcıyı Düzenle"><svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M4.5 12.5A.5.5 0 0 1 5 12h3.793l1.147-1.146a.5.5 0 0 1 .708.708l-2 2a.5.5 0 0 1-.708 0l-2-2a.5.5 0 0 1 .5-.5m.5 2.5a.5.5 0 0 1 0-1h4a.5.5 0 0 1 0 1z"/><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1z"/></svg></button>
                    <button data-action="deliver" class="p-2 text-green-400 hover:text-green-300 rounded-full transition" title="Teslim Et"><svg class="pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M12.736 3.97a.733.733 0 0 1 1.047 0c.286.289.29.756.01 1.05L7.88 12.01a.733.733 0 0 1-1.065.02L3.217 8.384a.757.757 0 0 1 0-1.06.733.733 0 0 1 1.047 0l3.052 3.093 5.4-6.425z"/></svg></button>
                    <button data-action="delete-item" class="p-2 text-red-500 hover:text-red-400 rounded-full transition" title="Kaydı Sil">${icons.cancel_item}</button>
// ... existing code ... -->
            dom.customerNameInput.dispatchEvent(new Event('input'));
            dom.customerNameInput.focus();
        });
        document.addEventListener("click", (e) => {
            if (!e.target.closest('.relative')) {
                dom.suggestionsBox.classList.add("hidden");
            }
        });

        // Yukarı Çık Butonu Mantığı
        window.addEventListener('scroll', () => {
            dom.scrollToTopBtn.classList.toggle('hidden', window.scrollY < 300);
        });
        dom.scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function listenToData() {
        if (!userId) return;
// ... existing code ... -->
        const editCountActions = itemDiv.querySelector('.edit-count-actions');
        switch (action) {
            case 'increment-bag': {
                const newBagCount = item.bagCount + 1;
                const datesToAdd = [new Date()];
                const newDates = [...(item.additionalDates || []), ...datesToAdd];
                await updateItem(id, { bagCount: newBagCount, additionalDates: newDates });
                break;
            }
            case 'decrement-bag': {
                if (item.bagCount <= 1) return;
                const newBagCount = item.bagCount - 1;
                const newDates = [...(item.additionalDates || [])];
                newDates.pop(); // En son ekleneni sil
                await updateItem(id, { bagCount: newBagCount, additionalDates: newDates });
                break;
            }
            case 'share': {
                const waitingDays = getWaitingDays(item.createdAt);
                const message = settings.shareTemplate
                    .replace(/\[Müşteri Adı\]/g, item.customerName)
                    .replace(/\[Poşet Sayısı\]/g, item.bagCount)
                    .replace(/\[Bekleme Süresi\]/g, waitingDays);
                
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Müşteri Poşet Durumu',
                            text: message,
                        });
                    } catch (error) {
                        console.error('Paylaşım hatası:', error);
                    }
                } else {
                    copyToClipboard(message);
                }
                break;
            }
            case 'deliver': {
                const result = await showDeliverConfirmationModal(item);
                if (result.confirmed) {
// ... existing code ... -->
                 }
                 
                 switch(button.id) {
                    case 'settings-logout-btn':
                        signOut(auth);
                        break;
                    case 'change-password-btn':
                        showChangePasswordModal();
                        break;
                    case 'manage-customers-btn':
                         showCustomerManagementModal();
                         break;
                    case 'manage-delivery-personnel-btn':
                         showDeliveryPersonnelManagementModal();
                         break;
                    case 'save-share-template-btn': {
                        settings.shareTemplate = dom.shareTemplateInput.value;
                        saveSettingsToStorage(settings);
                        showSimpleMessageModal('Başarılı', 'Paylaşım şablonu kaydedildi.', true);
                        break;
                    }
                    case 'save-custom-text-btn': {
                        settings.customTitle = dom.customText.titleInput.value.trim();
                        settings.customContent = dom.customText.contentInput.value.trim();
// ... existing code ... -->

