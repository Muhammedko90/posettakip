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
    let sortState = { type: 'date', direction: 'desc' };
    let archiveCurrentPage = 1, customerDetailCurrentPage = 1;
    const itemsPerPage = 10, customerDetailItemsPerPage = 5;
    let itemsUnsubscribe, customersUnsubscribe, deliveryPersonnelUnsubscribe;
    let seenNotifications = [];

    // Firebase Başlatma ve Kimlik Doğrulama
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
                showAppUI(user);
                initializeDataListeners(); // << YENİ: Veri dinleyicilerini başlat
            } else {
                userId = null;
                showAuthUI();
                detachDataListeners(); // << YENİ: Veri dinleyicilerini durdur
            }
        });

    } catch (error) {
        console.error("KRİTİK HATA: Firebase başlatılamadı!", error);
        dom.loadingText.textContent = `Hata: ${error.message}. Lütfen konsolu kontrol edin.`;
        if (dom.loadingSpinner) dom.loadingSpinner.style.display = 'none';
    }
    
    // --- KİMLİK DOĞRULAMA FORM İŞLEMLERİ ---
    dom.showRegisterBtn.addEventListener('click', (e) => { e.preventDefault(); dom.loginForm.classList.add('hidden'); dom.forgotPasswordForm.classList.add('hidden'); dom.registerForm.classList.remove('hidden'); });
    dom.showLoginBtn.addEventListener('click', (e) => { e.preventDefault(); dom.registerForm.classList.add('hidden'); dom.forgotPasswordForm.classList.add('hidden'); dom.loginForm.classList.remove('hidden'); });
    dom.forgotPasswordLink.addEventListener('click', (e) => { e.preventDefault(); dom.loginForm.classList.add('hidden'); dom.registerForm.classList.add('hidden'); dom.forgotPasswordForm.classList.remove('hidden'); });
    dom.backToLoginLink.addEventListener('click', (e) => { e.preventDefault(); dom.forgotPasswordForm.classList.add('hidden'); dom.registerForm.classList.add('hidden'); dom.loginForm.classList.remove('hidden'); });

    dom.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = dom.loginForm['login-email'].value;
        const password = dom.loginForm['login-password'].value;
        showLoading('Giriş yapılıyor...');
        dom.loginError.classList.add('hidden');
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                dom.loginError.textContent = getAuthErrorMessage(error.code);
                dom.loginError.classList.remove('hidden');
                hideLoading();
            });
    });

    dom.registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = dom.registerForm['register-email'].value;
        const password = dom.registerForm['register-password'].value;
        showLoading('Hesap oluşturuluyor...');
        dom.registerError.classList.add('hidden');
        createUserWithEmailAndPassword(auth, email, password)
            .catch(error => {
                dom.registerError.textContent = getAuthErrorMessage(error.code);
                dom.registerError.classList.remove('hidden');
                hideLoading();
            });
    });
    
    dom.forgotPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = dom.forgotPasswordForm['forgot-email'].value;
        showLoading('E-posta gönderiliyor...');
        dom.forgotError.classList.add('hidden');
        dom.forgotSuccess.classList.add('hidden');
        sendPasswordResetEmail(auth, email)
            .then(() => {
                dom.forgotSuccess.textContent = 'Sıfırlama bağlantısı e-posta adresinize gönderildi.';
                dom.forgotSuccess.classList.remove('hidden');
                hideLoading();
            })
            .catch(error => {
                dom.forgotError.textContent = getAuthErrorMessage(error.code);
                dom.forgotError.classList.remove('hidden');
                hideLoading();
            });
    });

    dom.logoutBtn.addEventListener('click', () => {
        showLoading('Çıkış yapılıyor...');
        detachDataListeners(); // << YENİ: Dinleyicileri durdur
        signOut(auth).catch(error => {
            console.error('Çıkış hatası:', error);
            hideLoading();
        });
    });

    function getAuthErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/invalid-email': return 'Geçersiz e-posta adresi.';
            case 'auth/user-not-found':
            case 'auth/wrong-password': return 'E-posta veya şifre hatalı.';
            case 'auth/email-already-in-use': return 'Bu e-posta adresi zaten kullanılıyor.';
            case 'auth/weak-password': return 'Şifre en az 6 karakter olmalıdır.';
            default: return 'Bir hata oluştu. Lütfen tekrar deneyin.';
        }
    }
    
    // --- YENİ: VERİ YÖNETİMİ VE DİNLEYİCİLER ---
    
    function initializeDataListeners() {
        if (!userId) return;
        
        // Items (Poşetler) dinleyicisi
        const itemsRef = collection(db, 'users', userId, 'items');
        const q = query(itemsRef, where('status', '==', 'waiting'));
        
        itemsUnsubscribe = onSnapshot(q, (snapshot) => {
            allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Bekleyen poşetler güncellendi:", allItems.length);
            renderAll();
        }, (error) => {
            console.error("Poşetleri dinlerken hata oluştu: ", error);
        });
        
        // Diğer dinleyiciler (customers, settings vs.) buraya eklenecek.
    }

    function detachDataListeners() {
        if (itemsUnsubscribe) {
            itemsUnsubscribe();
            itemsUnsubscribe = null;
            console.log('Poşet dinleyicisi durduruldu.');
        }
        // Diğer dinleyici durdurucuları buraya eklenecek.
    }
    
    // --- YENİ: ARAYÜZ GÜNCELLEME (RENDER) FONKSİYONLARI ---

    function renderAll() {
        renderItemList();
        renderDashboard();
        // Diğer render fonksiyonları buraya eklenecek
    }
    
    function renderDashboard() {
        const waitingItems = allItems.filter(item => item.status === 'waiting');
        const totalBags = waitingItems.reduce((sum, item) => sum + item.bagCount, 0);
        const uniqueCustomers = [...new Set(waitingItems.map(item => toTrUpperCase(item.customerName)))];
        
        dom.dashboard.waitingCustomers.textContent = uniqueCustomers.length;
        dom.dashboard.waitingBags.textContent = totalBags;
        
        // Diğer dashboard metrikleri buraya eklenecek
    }

    function renderItemList() {
        dom.itemList.innerHTML = ''; // Listeyi temizle
        
        // Sıralama Mantığı
        const sortedItems = [...allItems].sort((a, b) => {
            if (sortState.type === 'alpha') {
                return sortState.direction === 'asc' 
                    ? a.customerName.localeCompare(b.customerName, 'tr') 
                    : b.customerName.localeCompare(a.customerName, 'tr');
            }
            if (sortState.type === 'bags') {
                return sortState.direction === 'asc' ? a.bagCount - b.bagCount : b.bagCount - a.bagCount;
            }
            // Varsayılan: date
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return sortState.direction === 'asc' ? dateA - dateB : dateB - dateA;
        });

        if (sortedItems.length === 0) {
            dom.emptyItemListMessage.classList.remove('hidden');
        } else {
            dom.emptyItemListMessage.classList.add('hidden');
            sortedItems.forEach(item => {
                const itemEl = document.createElement('div');
                itemEl.className = 'bg-primary p-4 rounded-xl shadow-lg border border-dynamic flex items-center justify-between gap-4';
                itemEl.innerHTML = `
                    <div class="flex-grow">
                        <p class="font-semibold text-lg text-primary">${item.customerName}</p>
                        <p class="text-sm text-secondary">${formatDate(item.createdAt)}</p>
                    </div>
                    <div class="text-center">
                        <span class="text-2xl font-bold accent-text">${item.bagCount}</span>
                        <p class="text-xs text-secondary">Poşet</p>
                    </div>
                `; // Butonlar (teslim et, sil vb.) daha sonra eklenecek
                dom.itemList.appendChild(itemEl);
            });
        }
        
        const totalBags = allItems.reduce((sum, item) => sum + item.bagCount, 0);
        const totalCustomers = [...new Set(allItems.map(item => toTrUpperCase(item.customerName)))].length;
        dom.totalBagsCounter.textContent = totalBags;
        dom.totalCustomersCounter.textContent = totalCustomers;
    }
    
    // --- YENİ: FORM VE BUTON OLAYLARI ---

    // Yeni Poşet Ekleme Formu
    dom.addItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const customerName = toTrUpperCase(dom.customerNameInput.value.trim());
        const bagCount = parseInt(dom.bagCountInput.value, 10);

        if (customerName && bagCount > 0) {
            const newItem = {
                customerName: customerName,
                bagCount: bagCount,
                createdAt: serverTimestamp(),
                status: 'waiting' // 'waiting', 'delivered'
            };

            const itemsRef = collection(db, 'users', userId, 'items');
            addDoc(itemsRef, newItem)
                .then(() => {
                    console.log("Yeni poşet eklendi.");
                    dom.addItemForm.reset();
                    dom.customerNameInput.focus();
                })
                .catch(error => {
                    console.error("Poşet eklenirken hata oluştu:", error);
                    // Kullanıcıya hata mesajı gösterilebilir
                });
        }
    });

    // --- YENİ: SEKME (TAB) YÖNETİMİ ---
    const tabs = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('.panel');

    function switchTab(tabId) {
        tabs.forEach(tab => {
            tab.classList.toggle('tab-active', tab.id === `tab-${tabId}`);
        });
        panels.forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `panel-${tabId}`);
        });
        console.log(`${tabId} sekmesi açıldı.`);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.id.replace('tab-', '');
            switchTab(tabId);
        });
    });

    // Başlangıçta ana sayfayı göster
    switchTab('anasayfa');
    
    
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
});

