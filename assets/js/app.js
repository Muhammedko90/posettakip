/**
 * Ana başlatıcı ve olay dinleyicileri
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import * as auth from './auth.js';
import * as dataManager from './data-manager.js';
import * as ui from './ui-renderer.js';

document.addEventListener('DOMContentLoaded', () => {
    const dom = ui.getDomRefs();
    const { jsPDF } = window.jspdf || {};

    let app, authInstance, db, userId, currentUser;
    let allItems = [];
    let allCustomers = [];
    let deliveryPersonnel = [];
    let settings = {};
    let sortState = { type: 'alpha', direction: 'asc' };
    
    // Varsayılan görünüm 'grid' olarak ayarlandı
    let viewMode = 'grid'; 
    let isFullWidth = false; // Tam ekran durumu

    let archiveCurrentPage = 1;
    const itemsPerPage = 10;
    let itemsUnsubscribe = null;
    let customersUnsubscribe = null;
    let deliveryPersonnelUnsubscribe = null;
    let settingsUnsubscribe = null;
    let seenNotifications = [];
    const customerDetailItemsPerPage = 5;
    let appLogicInitialized = false;
    
    // Telegram Bot Değişkenleri
    let isTelegramPolling = false; 
    let telegramPollTimeout = null; 
    let lastKnownBotToken = null;

    function showLoadingMsg(msg) { ui.showLoading(dom, msg); }
    function hideLoadingMsg() { ui.hideLoading(dom); }

    function renderAll() {
        const activeItems = allItems.filter(item => item.status !== 'delivered');
        const archivedItems = allItems.filter(item => item.status === 'delivered');
        ui.renderDashboard(dom, allItems, settings, ui.formatDate, ui.formatRelativeTime);
        ui.renderItems(dom, activeItems, sortState, viewMode, ui.toTrUpperCase(dom.customerNameInput?.value || ''), ui.formatDate, ui.formatRelativeTime);
        ui.renderArchive(dom, archivedItems, ui.toTrUpperCase(dom.searchArchiveInput?.value || ''), archiveCurrentPage, itemsPerPage, ui.formatDate, (page) => { archiveCurrentPage = page; renderAll(); });
        ui.renderNotes(dom, allItems, ui.formatDate);
        ui.renderOverdueReport(allItems, ui.formatRelativeTime);
        ui.renderPeriodicReport(allItems, null, ui.formatDate);
        ui.checkAndDisplayNotifications(dom, allItems, seenNotifications, ui.getUnseenReminders, ui.getUnseenOverdueItems);
    }

    // Tam ekran geçiş fonksiyonu
    function toggleFullWidth(enable) {
        isFullWidth = enable;
        settings.isFullWidth = enable;
        
        if (enable) {
            dom.appContainer.classList.remove('container', 'mx-auto', 'max-w-5xl');
            dom.appContainer.classList.add('w-full', 'px-4'); // Kenarlara yapışmaması için padding
            if (dom.toggleWidthBtn) dom.toggleWidthBtn.innerHTML = ui.icons.collapse;
        } else {
            dom.appContainer.classList.add('container', 'mx-auto', 'max-w-5xl');
            dom.appContainer.classList.remove('w-full', 'px-4');
            if (dom.toggleWidthBtn) dom.toggleWidthBtn.innerHTML = ui.icons.expand;
        }
        
        // Raporlar sekmesindeysek grafikleri yeniden çiz (genişlik değiştiği için)
        const activeTab = document.querySelector('.tab-active');
        if (activeTab && activeTab.id === 'tab-reports') {
            const activeBtn = document.querySelector('.report-range-btn.accent-bg');
            const range = activeBtn ? activeBtn.dataset.range : null;
            setTimeout(() => {
                requestAnimationFrame(() => {
                    ui.renderPeriodicReport(allItems, range, ui.formatDate);
                });
            }, 300); // Transition süresi kadar bekle
        }
    }

    // Telegram Bildirim Fonksiyonu (Çoklu Gönderim)
    async function sendTelegramNotification(message, chatId = null) {
        if (!settings.telegramBotToken) return;
        
        // Eğer özel bir chat ID verilmediyse ayarlardakileri kullan
        let targets = [];
        if (chatId) {
            targets = [chatId];
        } else if (settings.telegramChatId) {
            targets = settings.telegramChatId.split(',').map(id => id.trim()).filter(id => id);
        }

        if (targets.length === 0) return;
        
        for (const targetId of targets) {
            const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
            try {
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: targetId, text: message, parse_mode: 'Markdown' })
                });
            } catch (error) {
                console.error("Telegram hatası:", error);
            }
        }
    }

    // --- YENİ TELEGRAM DOSYA GÖNDERME FONKSİYONU ---
    async function sendTelegramDocument(chatId, blob, filename, caption = '') {
        if (!settings.telegramBotToken) return;
        
        const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendDocument`;
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', blob, filename);
        if (caption) formData.append('caption', caption);

        try {
            await fetch(url, {
                method: 'POST',
                body: formData
            });
        } catch (error) {
            console.error("Telegram dosya gönderme hatası:", error);
        }
    }

    // --- TELEGRAM BOT KOMUT DİNLEME MANTIĞI ---
    function startTelegramBotListener() {
        if (telegramPollTimeout) clearTimeout(telegramPollTimeout);
        // Eğer token değişmediyse ve çalışıyorsa dokunma
        if (isTelegramPolling && settings.telegramBotToken === lastKnownBotToken) return;
        
        lastKnownBotToken = settings.telegramBotToken;
        isTelegramPolling = true;
        console.log("Telegram Bot: Dinleme başlatıldı (Long Polling)...");
        pollTelegram();
    }

    async function pollTelegram() {
        // Döngü koşulları
        if (!userId || !settings.telegramBotToken || !isTelegramPolling) {
            isTelegramPolling = false;
            return;
        }

        const offset = (settings.telegramLastUpdateId || 0) + 1;
        const url = `https://api.telegram.org/bot${settings.telegramBotToken}/getUpdates?offset=${offset}&timeout=10`;

        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.result.length > 0) {
                    let maxId = settings.telegramLastUpdateId || 0;
                    let hasUpdates = false;

                    for (const update of data.result) {
                        if (update.update_id > maxId) maxId = update.update_id;
                        if (update.message && update.message.text) {
                            await processTelegramCommand(update.message);
                            hasUpdates = true;
                        }
                    }

                    if (hasUpdates && maxId > (settings.telegramLastUpdateId || 0)) {
                        settings.telegramLastUpdateId = maxId;
                        await dataManager.saveSettings(db, userId, { telegramLastUpdateId: maxId });
                    }
                }
            }
        } catch (err) {
            // Hata durumunda bekle
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        if (isTelegramPolling) {
            telegramPollTimeout = setTimeout(pollTelegram, 100); 
        }
    }

    async function processTelegramCommand(message) {
        const text = message.text.trim();
        const chatId = message.chat.id;
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        
        // Yetkili Chat ID kontrolü
        const allowedIds = (settings.telegramChatId || '').split(',').map(id => id.trim());
        if (!allowedIds.includes(String(chatId)) && command !== '/id') {
            return; 
        }

        let reply = "";

        try {
            switch (command) {
                case '/ekle': {
                    if (parts.length < 2) { reply = "⚠️ Kullanım: `/ekle [Müşteri Adı] [Adet (Opsiyonel)]`\nÖrn: `/ekle Ahmet 2`"; break; }
                    
                    let bagCount = 1;
                    let nameParts = parts.slice(1);
                    const lastPart = nameParts[nameParts.length - 1];
                    
                    if (!isNaN(lastPart) && nameParts.length > 1) {
                        bagCount = parseInt(lastPart);
                        nameParts.pop(); 
                    }
                    
                    const customerName = ui.toTrUpperCase(nameParts.join(' '));
                    const activeItems = allItems.filter(item => item.status === 'active');
                    const existingItem = activeItems.find(item => ui.toTrUpperCase(item.customerName) === customerName);
                    
                    if (existingItem) {
                        const datesToAdd = Array(bagCount).fill(null).map(() => new Date());
                        await dataManager.addBagsToExistingItem(db, userId, existingItem.id, { bagCount: existingItem.bagCount + bagCount }, datesToAdd);
                        reply = `✅ *${customerName}* müşterisine ${bagCount} poşet eklendi.\n🔢 Yeni Toplam: ${existingItem.bagCount + bagCount}`;
                    } else {
                        const customerExists = allCustomers.some(c => ui.toTrUpperCase(c.name) === customerName);
                        if (!customerExists) {
                            await dataManager.addCustomer(db, userId, customerName);
                        }
                        await dataManager.addItem(db, userId, {
                            customerName, bagCount, note: '', status: 'active',
                            deliveredAt: null, deliveredBy: null, additionalDates: [], reminderDate: null
                        });
                        reply = `🆕 *${customerName}* adına ${bagCount} poşet ile yeni kayıt açıldı.`;
                    }
                    break;
                }

                case '/teslim':
                case '/tset': {
                    if (parts.length < 2) { reply = "⚠️ Kullanım: `/teslim [Müşteri Adı] [Adet]`\nÖrn: `/teslim Ahmet 1`"; break; }

                    let count = 1;
                    let nameParts = parts.slice(1);
                    const lastPart = nameParts[nameParts.length - 1];
                    
                    if (!isNaN(lastPart) && nameParts.length > 1) {
                        count = parseInt(lastPart);
                        nameParts.pop();
                    }

                    const customerName = ui.toTrUpperCase(nameParts.join(' '));
                    const item = allItems.find(i => i.status === 'active' && ui.toTrUpperCase(i.customerName) === customerName);

                    if (!item) {
                        reply = `❌ *${customerName}* adında bekleyen poşet bulunamadı.`;
                    } else {
                        const totalBags = Number(item.bagCount);
                        const toDeliver = Math.min(count, totalBags);
                        const deliveryPerson = "Bot Uzaktan"; 

                        if (toDeliver >= totalBags) {
                            await updateItem(item.id, { status: 'delivered', deliveredAt: new Date(), deliveredBy: deliveryPerson, note: '', reminderDate: null });
                            reply = `✅ *${customerName}* poşetlerinin TAMAMI (${toDeliver} adet) teslim edildi.\n🚚 Teslim Eden: ${deliveryPerson}`;
                        } else {
                            const remaining = totalBags - toDeliver;
                            const currentDates = [...(item.additionalDates || [])];
                            const newAdditionalDates = currentDates.slice(0, Math.max(0, currentDates.length - toDeliver));
                            await updateItem(item.id, { bagCount: remaining, additionalDates: newAdditionalDates });
                            await dataManager.addItem(db, userId, {
                                customerName: item.customerName,
                                bagCount: toDeliver,
                                status: 'delivered',
                                deliveredAt: new Date(),
                                deliveredBy: deliveryPerson,
                                note: '',
                                reminderDate: null,
                                additionalDates: []
                            });
                            reply = `✅ *${customerName}* poşetlerinden ${toDeliver} adedi teslim edildi.\n🚚 Teslim Eden: ${deliveryPerson}\nKalan: ${remaining}`;
                        }
                    }
                    break;
                }

                case '/sil': {
                    if (parts.length < 2) { reply = "⚠️ Kullanım: `/sil [Müşteri Adı]`"; break; }
                    
                    const customerName = ui.toTrUpperCase(parts.slice(1).join(' '));
                    const item = allItems.find(i => i.status === 'active' && ui.toTrUpperCase(i.customerName) === customerName);

                    if (!item) {
                        reply = `❌ Silinecek kayıt bulunamadı: ${customerName}`;
                    } else {
                        await dataManager.deleteItem(db, userId, item.id);
                        reply = `🗑️ *${customerName}* kaydı silindi.`;
                    }
                    break;
                }

                case '/bekleyen': {
                    const activeItems = allItems.filter(i => i.status === 'active');
                    if (activeItems.length === 0) {
                        reply = "📂 Bekleyen poşet yok.";
                    } else {
                        let msg = "📋 *Bekleyen Müşteriler:*\n";
                        activeItems.forEach(i => {
                            msg += `▪️ ${i.customerName}: ${i.bagCount} adet\n`;
                        });
                        reply = msg;
                    }
                    break;
                }

                case '/iade': {
                    if (parts.length < 2) { reply = "⚠️ Kullanım: `/iade [Müşteri Adı] [Adet]`"; break; }
                    
                    let count = 1;
                    let nameParts = parts.slice(1);
                    const lastPart = nameParts[nameParts.length - 1];
                    
                    if (!isNaN(lastPart) && nameParts.length > 1) {
                        count = parseInt(lastPart);
                        nameParts.pop();
                    }
                    
                    const customerName = ui.toTrUpperCase(nameParts.join(' '));
                    
                    await dataManager.addItem(db, userId, {
                        customerName, 
                        bagCount: count, 
                        note: 'İADE İŞLEMİ', 
                        status: 'active',
                        deliveredAt: null, 
                        deliveredBy: null, 
                        additionalDates: [], 
                        reminderDate: null
                    });
                    
                    reply = `🔄 *${customerName}* için ${count} adet poşet İADE alındı ve listeye eklendi.`;
                    break;
                }

                case '/id': {
                    reply = `🆔 Sizin Chat ID'niz: \`${chatId}\``;
                    break;
                }

                case '/ping': {
                    reply = "🏓 Pong! Bot çevrimiçi ve dinliyor.";
                    break;
                }

                case '/yenile': {
                    isTelegramPolling = false;
                    setTimeout(startTelegramBotListener, 1000);
                    reply = "🔄 Bot bağlantısı yenilendi.";
                    break;
                }

                case '/yedekal': {
                    const data = { allItems, allCustomers, deliveryPersonnel, settings };
                    const jsonString = JSON.stringify(data, null, 2);
                    const blob = new Blob([jsonString], { type: 'application/json' });
                    const filename = `yedek-${new Date().toISOString().slice(0, 10)}.json`;
                    
                    await sendTelegramDocument(chatId, blob, filename, "📦 Sistem Yedeği");
                    return; 
                }

                case '/pdf': {
                    const activeItems = allItems.filter(i => i.status === 'active');
                    if (activeItems.length === 0) {
                        reply = "📂 Listede bekleyen poşet yok, PDF oluşturulamadı.";
                    } else if (jsPDF) {
                        const blob = ui.getActiveItemsPDFBlob(activeItems, ui.formatDate, jsPDF);
                        if (blob) {
                            const filename = `bekleyenler-${new Date().toISOString().slice(0, 10)}.pdf`;
                            await sendTelegramDocument(chatId, blob, filename, "📄 Bekleyen Poşet Listesi");
                            return;
                        } else {
                            reply = "⚠️ PDF oluşturulurken hata oluştu.";
                        }
                    } else {
                         reply = "⚠️ PDF kütüphanesi yüklenemedi.";
                    }
                    break;
                }

                case '/duyuru': {
                    const announcement = parts.slice(1).join(' ');
                    if (!announcement) { reply = "⚠️ Mesaj yazmadınız. Örn: `/duyuru Yarın kapalıyız`"; break; }
                    
                    await sendTelegramNotification(`📢 *DUYURU*\n\n${announcement}`);
                    return; 
                }

                case '/ozet': {
                    const activeCount = allItems.filter(i => i.status === 'active').length;
                    const activeBags = allItems.filter(i => i.status === 'active').reduce((sum, i) => sum + i.bagCount, 0);
                    
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todayDelivered = allItems.filter(i => {
                        if (i.status !== 'delivered' || !i.deliveredAt) return false;
                        const d = i.deliveredAt.seconds ? new Date(i.deliveredAt.seconds * 1000) : new Date(i.deliveredAt);
                        return d.toISOString().slice(0, 10) === todayStr;
                    });
                    const todayDeliveredBags = todayDelivered.reduce((sum, i) => sum + i.bagCount, 0);

                    reply = `📊 *Günlük Özet*\n\n📦 Bekleyen Poşet: ${activeBags}\n👥 Bekleyen Müşteri: ${activeCount}\n✅ Bugün Teslim Edilen: ${todayDeliveredBags}`;
                    break;
                }

                case '/gunsonu': {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    
                    const todayAdded = allItems.filter(i => {
                        const d = i.createdAt?.seconds ? new Date(i.createdAt.seconds * 1000) : new Date(i.createdAt);
                        return d.toISOString().slice(0, 10) === todayStr;
                    });
                    const addedCount = todayAdded.reduce((sum, i) => sum + i.bagCount, 0);

                    const todayDelivered = allItems.filter(i => {
                        if (i.status !== 'delivered' || !i.deliveredAt) return false;
                        const d = i.deliveredAt.seconds ? new Date(i.deliveredAt.seconds * 1000) : new Date(i.deliveredAt);
                        return d.toISOString().slice(0, 10) === todayStr;
                    });
                    const deliveredCount = todayDelivered.reduce((sum, i) => sum + i.bagCount, 0);

                    const waitingCount = allItems.filter(i => i.status === 'active').reduce((sum, i) => sum + i.bagCount, 0);

                    reply = `🌙 *Gün Sonu Raporu* (${todayStr})\n\n➕ Eklenen Poşet: ${addedCount}\n✅ Teslim Edilen: ${deliveredCount}\n📦 Kalan (Devir): ${waitingCount}\n\nİyi akşamlar!`;
                    break;
                }

                case '/help':
                case '/yardim': {
                    reply = "🤖 *Bot Komutları:*\n\n" +
                            "➕ `/ekle [İsim] [Adet]`\n" +
                            "✅ `/teslim [İsim] [Adet]`\n" +
                            "🔄 `/iade [İsim] [Adet]`\n" +
                            "🗑️ `/sil [İsim]`\n" +
                            "📋 `/bekleyen` - Listeyi gör\n" +
                            "📄 `/pdf` - Listeyi indir\n" +
                            "📊 `/ozet` - Anlık durum\n" +
                            "🌙 `/gunsonu` - Detaylı rapor\n" +
                            "📢 `/duyuru [Mesaj]` - Herkese mesaj\n" +
                            "💾 `/yedekal` - Veri yedeği\n" +
                            "🆔 `/id` - ID öğren\n" +
                            "❓ `/help` - Bu menü";
                    break;
                }

                default:
                    // Bilinmeyen komut
                    return;
            }
            
            if (reply) sendTelegramNotification(reply, chatId);

        } catch (err) {
            console.error("Bot komut hatası:", err);
            sendTelegramNotification("⚠️ İşlem sırasında bir hata oluştu.", chatId);
        }
    }

    function listenToData() {
        if (!userId) return;
        if (itemsUnsubscribe) itemsUnsubscribe();
        if (customersUnsubscribe) customersUnsubscribe();
        if (deliveryPersonnelUnsubscribe) deliveryPersonnelUnsubscribe();
        if (settingsUnsubscribe) settingsUnsubscribe();

        itemsUnsubscribe = dataManager.listenToItems(db, userId, (items) => {
            allItems = items;
            renderAll();
        });

        customersUnsubscribe = dataManager.listenToCustomers(db, userId, (customers) => {
            allCustomers = customers;
            const modalList = document.getElementById('modal-customers-list');
            if (modalList && !dom.modalContainer.classList.contains('hidden')) {
                const customerInput = document.getElementById('modal-customer-input');
                ui.renderCustomerModalList('modal-customers-list', allCustomers, customerInput?.value || '', ui.toTrUpperCase, ui.icons);
            }
        });

        deliveryPersonnelUnsubscribe = dataManager.listenToDeliveryPersonnel(db, userId, (personnel) => {
            deliveryPersonnel = personnel;
            const modalList = document.getElementById('modal-personnel-list');
            if (modalList && !dom.modalContainer.classList.contains('hidden')) {
                ui.renderDeliveryPersonnelModalList('modal-personnel-list', deliveryPersonnel, ui.icons);
            }
        });

        const settingsRef = { current: null };
        settingsUnsubscribe = dataManager.listenToSettings(db, userId, (newSettings) => {
            // Ayarlar güncellendiğinde botu etkilememesi için flag'leri kontrol et
            const oldBotToken = settings.telegramBotToken;
            settings = newSettings;
            
            if (!settingsRef.current) {
                settingsRef.current = true;
                dataManager.saveSettings(db, userId, settings);
            }
            
            // Genişlik ayarı
            if (settings.hasOwnProperty('isFullWidth')) {
                toggleFullWidth(settings.isFullWidth);
            } else {
                toggleFullWidth(false);
            }
            
            // Eğer bot token değiştiyse veya bot durmuşsa başlat
            if (settings.telegramBotToken) {
                if (settings.telegramBotToken !== oldBotToken) {
                    isTelegramPolling = false; // Eski döngüyü durdur
                    setTimeout(() => startTelegramBotListener(), 1000); // Yenisini başlat
                } else if (!isTelegramPolling) {
                    startTelegramBotListener();
                }
            } else {
                isTelegramPolling = false;
            }

            ui.applySettings(dom, settings, viewMode, () => ui.updateViewToggleButtons(dom, viewMode));
            renderAll();
        });
    }

    // --- Otomatik Raporlama (Cron benzeri yapı) ---
    setInterval(() => {
        if (!settings.telegramReportTime || !userId) return;

        const now = new Date();
        const day = now.getDay(); // 0: Pazar
        
        if (day === 0) return;

        const currentTime = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        const todayStr = now.toISOString().slice(0, 10);

        if (currentTime === settings.telegramReportTime && settings.lastReportDate !== todayStr) {
            
            const realActiveItems = allItems.filter(item => item.status === 'active');
            
            let message = "";
            if (realActiveItems.length === 0) {
                message = "Günaydın! ☀️\n\nŞu anda bekleyen poşet bulunmamaktadır. İyi çalışmalar!";
            } else {
                const totalBags = realActiveItems.reduce((sum, item) => sum + item.bagCount, 0);
                const totalCustomers = realActiveItems.length;
                message = `Günaydın! ☀️\n\n📋 *Günlük Rapor*\n👥 Bekleyen Müşteri: ${totalCustomers}\n🛍️ Bekleyen Poşet: ${totalBags}\n\nİyi çalışmalar!`;
            }

            sendTelegramNotification(message);

            settings.lastReportDate = todayStr;
            dataManager.saveSettings(db, userId, settings);
        }
    }, 60000); 

    function initializeAppLogic() {
        if (!userId) return;
        if (appLogicInitialized) return;
        appLogicInitialized = true;
        seenNotifications = JSON.parse(localStorage.getItem(`seenNotifications-${userId}`)) || [];
        ui.updateSortButtons(dom, sortState);
        ui.switchTab('anasayfa', true);
        listenToData();
        setupAppEventListeners();
    }

    async function handleAddItem(e) {
        e.preventDefault();
        const customerName = ui.toTrUpperCase(dom.customerNameInput.value.trim());
        const bagCount = parseInt(dom.bagCountInput.value, 10);
        if (!customerName || isNaN(bagCount) || bagCount < 1) return;
        try {
            const activeItems = allItems.filter(item => item.status === 'active');
            const existingItem = activeItems.find(item => ui.toTrUpperCase(item.customerName) === customerName);
            if (existingItem) {
                const datesToAdd = Array(bagCount).fill(null).map(() => new Date());
                await dataManager.addBagsToExistingItem(db, userId, existingItem.id, { bagCount: existingItem.bagCount + bagCount }, datesToAdd);
                
                sendTelegramNotification(`📦 *Poşet Eklendi (Mevcut Müşteri)*\n\n👤 Müşteri: ${customerName}\n➕ Eklenen: ${bagCount} Adet\n🔢 Toplam: ${existingItem.bagCount + bagCount} Adet\n📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}`);

            } else {
                const customerExists = allCustomers.some(c => c.name.toLowerCase() === customerName.toLowerCase());
                if (!customerExists) {
                    await dataManager.addCustomer(db, userId, customerName);
                }
                await dataManager.addItem(db, userId, {
                    customerName, bagCount, note: '', status: 'active',
                    deliveredAt: null, deliveredBy: null, additionalDates: [], reminderDate: null
                });

                sendTelegramNotification(`🆕 *Yeni Müşteri Kaydı*\n\n👤 Müşteri: ${customerName}\n🛍️ Adet: ${bagCount}\n📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}`);
            }
            dom.addItemForm.reset();
            dom.bagCountInput.value = 1;
            dom.customerNameInput.focus();
        } catch (error) {
            console.error("Error in handleAddItem:", error);
            ui.showSimpleMessageModal(dom, "Hata", "Kayıt eklenirken bir hata oluştu.");
        }
    }

    async function updateItem(id, data) {
        if (data.note !== undefined) data.note = ui.toTrUpperCase(data.note);
        await dataManager.updateItem(db, userId, id, data);
    }

    async function handleMainContentClick(e) {
        const button = e.target.closest('button[data-action]');
        if (!button) return;
        const parentMenu = button.closest('.action-menu');
        if (parentMenu && button.dataset.action !== 'toggle-menu') {
            parentMenu.classList.add('hidden');
        }
        const action = button.dataset.action;
        const itemDiv = button.closest('div[data-id]');

        if (action === 'view-customer') {
            const customerName = itemDiv?.dataset.customerName;
            if (customerName) ui.showCustomerDetailModal(dom, customerName, allItems, ui.formatDate, ui.icons, () => ui.hideModalUI(dom), (name) => { if (jsPDF) ui.exportCustomerHistoryToPDF(name, allItems, ui.formatDate, jsPDF); });
            return;
        }

        if (action === 'toggle-menu') {
            const allMenus = document.querySelectorAll('.action-menu');
            const currentMenu = button.nextElementSibling;
            allMenus.forEach(menu => { if (menu !== currentMenu) menu.classList.add('hidden'); });
            currentMenu.classList.toggle('hidden');
            return;
        }

        if (!itemDiv) return;
        const id = itemDiv.dataset.id;
        const item = allItems.find(i => i.id === id);
        if (!item) return;
        const defaultActions = itemDiv.querySelector('.default-actions');
        const editCountActions = itemDiv.querySelector('.edit-count-actions');

        switch (action) {
            case 'increment-bag':
                await updateItem(id, { bagCount: item.bagCount + 1, additionalDates: arrayUnion(new Date()) });
                break;
            case 'decrement-bag':
                if (item.bagCount > 1) {
                    const currentDates = [...(item.additionalDates || [])];
                    currentDates.sort((a, b) => (a.seconds || a.getTime() / 1000) - (b.seconds || b.getTime() / 1000));
                    currentDates.pop();
                    await updateItem(id, { bagCount: item.bagCount - 1, additionalDates: currentDates });
                }
                break;
            case 'share': {
                const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : new Date(item.createdAt || new Date());
                const diffDays = Math.max(0, Math.floor((new Date() - date) / (1000 * 60 * 60 * 24)));
                const message = (settings.shareTemplate || '').replace(/\[Müşteri Adı\]/gi, item.customerName).replace(/\[Poşet Sayısı\]/gi, item.bagCount).replace(/\[Bekleme Süresi\]/gi, diffDays);
                if (navigator.share) {
                    try { await navigator.share({ text: message }); } catch (err) { console.error('Share failed:', err); }
                } else {
                    ui.showSimpleMessageModal(dom, 'Paylaşım Desteklenmiyor', 'Cihazınız bu özelliği desteklemiyor. Mesajı kopyalayarak paylaşabilirsiniz: <br><br><code class="bg-tertiary p-2 rounded-md block break-words">' + message + '</code>');
                }
                break;
            }
            case 'deliver': {
                const result = await ui.showDeliverConfirmationModal(dom, item, deliveryPersonnel, ui.formatDate);
                if (result.confirmed && result.deliveredBy) {
                    const deliveryTimestamp = result.deliveryDate ? new Date(`${result.deliveryDate}T${result.deliveryTime || '00:00:00'}`) : new Date();
                    const totalBags = Number(item.bagCount) || 1;
                    const requested = parseInt(result.deliveredCount, 10);
                    const toDeliver = isNaN(requested) || requested < 1 ? totalBags : Math.min(requested, totalBags);
                    if (toDeliver >= totalBags) {
                        await updateItem(id, { status: 'delivered', deliveredAt: deliveryTimestamp, deliveredBy: result.deliveredBy, note: '', reminderDate: null });
                    } else {
                        const remaining = totalBags - toDeliver;
                        const currentDates = [...(item.additionalDates || [])];
                        currentDates.sort((a, b) => (a.seconds ?? a.getTime?.() / 1000 ?? 0) - (b.seconds ?? b.getTime?.() / 1000 ?? 0));
                        const newAdditionalDates = currentDates.slice(0, Math.max(0, currentDates.length - toDeliver));
                        await updateItem(id, { bagCount: remaining, additionalDates: newAdditionalDates });
                        await dataManager.addItem(db, userId, {
                            customerName: item.customerName,
                            bagCount: toDeliver,
                            status: 'delivered',
                            deliveredAt: deliveryTimestamp,
                            deliveredBy: result.deliveredBy,
                            note: '',
                            reminderDate: null,
                            additionalDates: []
                        });
                    }
                    
                    // Telegram Bildirimi (Teslimat)
                    sendTelegramNotification(`✅ *Teslimat Yapıldı*\n\n👤 Müşteri: ${item.customerName}\n🛍️ Teslim Edilen: ${toDeliver} Adet\n🚚 Teslim Eden: ${result.deliveredBy}\n📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}`);
                }
                break;
            }
            case 'restore':
                if (await ui.showConfirmationModal(dom, `'${item.customerName}' adlı kaydı bekleyenler listesine geri yüklemek istiyor musunuz?`, "Geri Yükle")) {
                    const targetName = ui.toTrUpperCase(item.customerName).trim();
                    const existingActiveItem = allItems.find(i => 
                        i.status === 'active' && 
                        ui.toTrUpperCase(i.customerName).trim() === targetName &&
                        i.id !== item.id
                    );

                    if (existingActiveItem) {
                        const totalBags = Number(existingActiveItem.bagCount) + Number(item.bagCount);
                        const mergedDates = [
                            ...(existingActiveItem.additionalDates || []),
                            ...(item.additionalDates || [])
                        ];

                        await updateItem(existingActiveItem.id, { 
                            bagCount: totalBags,
                            additionalDates: mergedDates,
                            lastModified: new Date()
                        });

                        await dataManager.deleteItem(db, userId, id);
                        ui.showSimpleMessageModal(dom, "Birleştirildi", `Bu müşterinin bekleyen bir kaydı bulundu. Poşetler birleştirildi. (Toplam: ${totalBags})`, true);
                    } else {
                        await updateItem(id, { 
                            status: 'active', 
                            deliveredAt: null, 
                            deliveredBy: null,
                            lastModified: new Date()
                        });
                    }
                }
                break;
            case 'delete-permanent':
            case 'delete-item':
                if (await ui.showConfirmationModal(dom, `'${item.customerName}' adlı kayıt kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?`, "Kaydı Sil", true)) {
                    await dataManager.deleteItem(db, userId, id);
                    
                    // Telegram Bildirimi (Kayıt Silindi)
                    sendTelegramNotification(`🗑️ *Kayıt Silindi*\n\n👤 Müşteri: ${item.customerName}\n🔢 Poşet: ${item.bagCount}\n📅 Tarih: ${new Date().toLocaleDateString('tr-TR')}`);
                }
                break;
            case 'edit-note': {
                const result = await ui.showNoteModal(dom, item);
                if (result.confirmed) {
                    await updateItem(id, { note: result.note, reminderDate: result.reminderDate });
                }
                break;
            }
            case 'delete-note-from-tab':
                if (await ui.showConfirmationModal(dom, `'${item.customerName}' adlı kaydın notunu ve hatırlatıcısını silmek istediğinizden emin misiniz?`, "Notu Sil", true)) {
                    await updateItem(id, { note: '', reminderDate: null });
                }
                break;
            case 'edit-count':
                if (defaultActions) defaultActions.parentElement.classList.add('hidden');
                editCountActions.classList.remove('hidden');
                const input = editCountActions.querySelector('input');
                input.focus();
                input.select();
                break;
            case 'cancel-edit-count':
                editCountActions.classList.add('hidden');
                if (defaultActions) defaultActions.parentElement.classList.remove('hidden');
                break;
            case 'save-count': {
                const saveInput = editCountActions.querySelector('input');
                const newBagCount = parseInt(saveInput.value, 10);
                if (isNaN(newBagCount) || newBagCount < 1) {
                    ui.showSimpleMessageModal(dom, "Geçersiz Sayı", "Poşet sayısı en az 1 olmalıdır.");
                    return;
                }
                const oldBagCount = item.bagCount;
                const countDifference = newBagCount - oldBagCount;
                const updatePayload = { bagCount: newBagCount };
                if (countDifference !== 0) {
                    const currentDates = [...(item.additionalDates || [])];
                    let newDates;
                    if (countDifference > 0) {
                        newDates = [...currentDates, ...Array(countDifference).fill(null).map(() => new Date())];
                    } else {
                        newDates = currentDates.slice(0, countDifference);
                    }
                    updatePayload.additionalDates = newDates;
                }
                await updateItem(id, updatePayload);
                editCountActions.classList.add('hidden');
                if (defaultActions) defaultActions.parentElement.classList.remove('hidden');
                break;
            }
        }
    }

    async function handleSettingsPanelClick(e) {
        const button = e.target.closest('button');
        if (!button) return;
        if (button.dataset.theme) {
            settings.theme = button.dataset.theme;
            await dataManager.saveSettings(db, userId, settings);
            ui.applySettings(dom, settings, viewMode, () => ui.updateViewToggleButtons(dom, viewMode));
            return;
        }
        switch (button.id) {
            case 'settings-logout-btn':
                auth.logout(authInstance);
                break;
            case 'change-password-btn':
                ui.showChangePasswordModal(dom, async (currentPass, newPass) => {
                    showLoadingMsg('Şifre değiştiriliyor...');
                    await auth.reauthenticate(currentUser, currentPass);
                    await auth.changePassword(currentUser, newPass);
                    hideLoadingMsg();
                    ui.hideModalUI(dom);
                    await ui.showSimpleMessageModal(dom, 'Başarılı', 'Şifreniz başarıyla değiştirildi.', true);
                });
                break;
            case 'manage-customers-btn':
                await showCustomerManagementModal();
                break;
            case 'manage-delivery-personnel-btn':
                await showDeliveryPersonnelManagementModal();
                break;
            case 'save-custom-text-btn':
                settings.customTitle = dom.customText.titleInput.value.trim();
                settings.customContent = dom.customText.contentInput.value.trim();
                await dataManager.saveSettings(db, userId, settings);
                await ui.showSimpleMessageModal(dom, 'Başarılı', 'Ana sayfa notu kaydedildi.', true);
                break;
            case 'save-share-template-btn':
                settings.shareTemplate = dom.shareTemplate.input.value.trim();
                await dataManager.saveSettings(db, userId, settings);
                await ui.showSimpleMessageModal(dom, 'Başarılı', 'Paylaşım şablonu kaydedildi.', true);
                break;
            // YENİ: Telegram ayarlarını kaydederken şifre iste
            case 'save-telegram-settings-btn': {
                // DOM elementlerini kontrol et (Hata önleyici)
                if (!dom.telegram || !dom.telegram.botTokenInput || !dom.telegram.chatIdInput) {
                    ui.showSimpleMessageModal(dom, "Hata", "Ayar alanları yüklenemedi. Lütfen sayfayı yenileyin.");
                    return;
                }

                const password = await ui.showPasswordConfirmationModal(dom, "Güvenlik Kontrolü", "Telegram bildirim ayarlarını değiştirmek için lütfen hesap şifrenizi girin.", "Onayla");
                if (password) {
                    showLoadingMsg('Doğrulanıyor...');
                    try {
                        await auth.reauthenticate(currentUser, password);
                        
                        settings.telegramBotToken = dom.telegram.botTokenInput.value.trim();
                        settings.telegramChatId = dom.telegram.chatIdInput.value.trim();
                        
                        if (dom.telegram.reportTimeInput) {
                            settings.telegramReportTime = dom.telegram.reportTimeInput.value;
                        }
                        
                        await dataManager.saveSettings(db, userId, settings);
                        hideLoadingMsg();
                        await ui.showSimpleMessageModal(dom, 'Başarılı', 'Telegram ayarları güvenle kaydedildi.', true);
                        
                        // Ayarlar değişince botu (tekrar) başlat/kontrol et
                        if (settings.telegramBotToken) {
                             if (!isTelegramPolling) startTelegramBotListener();
                        } else {
                             isTelegramPolling = false; 
                        }
                        
                    } catch (error) {
                        hideLoadingMsg();
                        const errMsg = error.code === 'auth/wrong-password' ? "Şifre yanlış." : "Bir hata oluştu: " + error.message;
                        ui.showSimpleMessageModal(dom, "Hata", errMsg);
                    }
                }
                break;
            }
            case 'export-json-btn':
                ui.exportDataToJSON(allItems, allCustomers, deliveryPersonnel, settings);
                break;
            case 'import-json-btn':
                dom.importFileInput.click();
                break;
            case 'export-active-pdf-btn':
                if (jsPDF) { if (!ui.exportActiveItemsToPDF(allItems.filter(i => i.status !== 'delivered'), ui.formatDate, jsPDF)) ui.showSimpleMessageModal(dom, "Bilgi", "Dışa aktarılacak bekleyen poşet yok."); }
                break;
            case 'export-csv-btn':
                if (!ui.exportToCSV(allItems, ui.formatDate)) ui.showSimpleMessageModal(dom, "Bilgi", "Dışa aktarılacak veri yok.");
                break;
            case 'reset-items-btn':
            case 'reset-all-btn': {
                const isResetAll = button.id === 'reset-all-btn';
                const title = isResetAll ? "Tüm Verileri Sıfırla" : "Poşet Listesini Sıfırla";
                const message = isResetAll ? "Bu hesaptaki TÜM müşteri ve poşet verilerini kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz." : "Tüm bekleyen ve teslim edilen poşet kayıtlarınızı kalıcı olarak silmek üzeresiniz. Müşteri listeniz etkilenmeyecektir.";
                const confirmText = isResetAll ? "Evet, Tüm Verilerimi Sil" : "Evet, Poşetleri Sil";
                const password = await ui.showPasswordConfirmationModal(dom, title, `${message} Devam etmek için lütfen hesap şifrenizi girin.`, confirmText, true);
                if (password) {
                    showLoadingMsg('Kimlik doğrulanıyor...');
                    try {
                        await auth.reauthenticate(currentUser, password);
                        if (isResetAll) {
                            await dataManager.resetAllData(db, userId);
                        } else {
                            showLoadingMsg('Poşetler siliniyor...');
                            await dataManager.resetItems(db, userId, allItems.map(i => i.id));
                        }
                        hideLoadingMsg();
                        await ui.showSimpleMessageModal(dom, 'Başarılı', isResetAll ? 'Bu hesaptaki tüm verileriniz başarıyla silindi.' : 'Poşet listesi başarıyla sıfırlandı.', true);
                    } catch (error) {
                        hideLoadingMsg();
                        ui.showSimpleMessageModal(dom, "Hata", "Şifre yanlış. İşlem iptal edildi.");
                    }
                }
                break;
            }
        }
    }

    function handleSort(type) {
        if (sortState.type === type) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.type = type;
            sortState.direction = (type === 'alpha') ? 'asc' : 'desc';
        }
        ui.updateSortButtons(dom, sortState);
        ui.renderItems(dom, allItems.filter(item => item.status !== 'delivered'), sortState, viewMode, ui.toTrUpperCase(dom.customerNameInput?.value || ''), ui.formatDate, ui.formatRelativeTime);
    }

    function handleViewChange(mode) {
        viewMode = mode;
        settings.viewMode = mode;
        dataManager.saveSettings(db, userId, settings);
        ui.updateViewToggleButtons(dom, viewMode);
        ui.renderItems(dom, allItems.filter(item => item.status !== 'delivered'), sortState, viewMode, ui.toTrUpperCase(dom.customerNameInput?.value || ''), ui.formatDate, ui.formatRelativeTime);
    }

    async function showCustomerManagementModal() {
        ui.showModalUI(dom);
        dom.modalContent.innerHTML = `<div class="flex flex-col h-[70vh]"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-primary">Müşteri Yönetimi</h3><button id="modal-close" class="p-1 text-secondary hover:text-primary transition">${ui.icons.cancel}</button></div><div id="modal-customer-error" class="hidden text-center p-2 mb-2 bg-red-500/20 text-red-300 rounded-md text-sm"></div><form id="modal-customer-form" class="flex gap-2 mb-4"><input type="text" id="modal-customer-input" placeholder="Müşteri Ara veya Yeni Müşteri Ekle..." class="flex-grow p-2 bg-secondary border border-dynamic text-primary rounded-lg focus:ring-2 ring-accent transition" required><button type="submit" class="accent-bg text-white font-semibold px-4 rounded-lg accent-bg-hover transition">Ekle</button></form><div id="modal-customers-list" class="flex-grow overflow-y-auto space-y-2 pr-2"></div></div>`;
        const closeBtn = dom.modalContent.querySelector('#modal-close');
        const customerForm = document.getElementById('modal-customer-form');
        const customerInput = document.getElementById('modal-customer-input');
        const errorDiv = document.getElementById('modal-customer-error');
        const listContainer = document.getElementById('modal-customers-list');
        closeBtn.addEventListener('click', () => ui.hideModalUI(dom), { once: true });
        const showModalError = (msg) => { errorDiv.textContent = msg; errorDiv.classList.remove('hidden'); setTimeout(() => errorDiv.classList.add('hidden'), 3000); };
        customerInput.addEventListener('input', () => ui.renderCustomerModalList('modal-customers-list', allCustomers, customerInput.value, ui.toTrUpperCase, ui.icons));
        listContainer.addEventListener('click', async (ev) => {
            const btn = ev.target.closest('button[data-cust-action]');
            if (!btn) return;
            const action = btn.dataset.custAction;
            const customerDiv = btn.closest('div[data-customer-id]');
            const customerId = customerDiv.dataset.customerId;
            const displayView = customerDiv.querySelector('.customer-display');
            const editView = customerDiv.querySelector('.customer-edit');
            const deleteConfirmView = customerDiv.querySelector('.customer-delete-confirm');
            switch (action) {
                case 'delete': displayView.classList.add('hidden'); deleteConfirmView.classList.remove('hidden'); break;
                case 'cancel-delete': deleteConfirmView.classList.add('hidden'); displayView.classList.remove('hidden'); break;
                case 'confirm-delete':
                    if (await ui.showConfirmationModal(dom, "Bu müşteriyi silmek, müşteriye ait TÜM poşet kayıtlarını da kalıcı olarak silecektir. Emin misiniz?", "Evet, Sil", true)) {
                        showLoadingMsg('Müşteri ve ilişkili poşetler siliniyor...');
                        await dataManager.deleteCustomerAndItems(db, userId, customerId, customerDiv.dataset.customerName);
                        hideLoadingMsg();
                    }
                    break;
                case 'edit': displayView.classList.add('hidden'); editView.classList.remove('hidden'); editView.querySelector('input').focus(); break;
                case 'cancel-edit': editView.classList.add('hidden'); displayView.classList.remove('hidden'); break;
                case 'save-edit': {
                    const input = editView.querySelector('.customer-name-input');
                    const newName = input.value.trim();
                    const oldName = customerDiv.dataset.customerName;
                    if (!newName) { showModalError("Müşteri adı boş olamaz."); return; }
                    if (ui.toTrUpperCase(newName) === ui.toTrUpperCase(oldName)) { editView.classList.add('hidden'); displayView.classList.remove('hidden'); return; }
                    const isDuplicate = allCustomers.some(c => ui.toTrUpperCase(c.name) === ui.toTrUpperCase(newName) && c.id !== customerId);
                    if (isDuplicate) { showModalError("Bu isimde başka bir müşteri zaten var."); return; }
                    if (await ui.showConfirmationModal(dom, `'${oldName}' ismini '${newName}' olarak değiştirmek istediğinizden emin misiniz? Bu işlem müşterinin tüm geçmiş kayıtlarını da güncelleyecektir.`, "Evet, Değiştir")) {
                        showLoadingMsg('Müşteri adı ve ilgili poşetler güncelleniyor...');
                        await dataManager.updateCustomerNameAndItems(db, userId, customerId, oldName, ui.toTrUpperCase(newName));
                        hideLoadingMsg();
                    }
                    break;
                }
            }
        });
        customerForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const name = ui.toTrUpperCase(customerInput.value.trim());
            if (name && !allCustomers.some(c => ui.toTrUpperCase(c.name) === name)) {
                await dataManager.addCustomer(db, userId, name);
                customerInput.value = '';
                customerInput.dispatchEvent(new Event('input'));
            } else if (name) showModalError('Bu müşteri zaten mevcut.');
        });
        ui.renderCustomerModalList('modal-customers-list', allCustomers, '', ui.toTrUpperCase, ui.icons);
    }

    async function showDeliveryPersonnelManagementModal() {
        ui.showModalUI(dom);
        dom.modalContent.innerHTML = `<div class="flex flex-col h-[70vh]"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-primary">Teslim Eden Kişi Yönetimi</h3><button id="modal-close" class="p-1 text-secondary hover:text-primary transition">${ui.icons.cancel}</button></div><div id="modal-personnel-error" class="hidden text-center p-2 mb-2 bg-red-500/20 text-red-300 rounded-md text-sm"></div><form id="modal-personnel-form" class="flex gap-2 mb-4"><input type="text" id="modal-personnel-input" placeholder="Yeni Kişi Ekle..." class="flex-grow p-2 bg-secondary border border-dynamic text-primary rounded-lg focus:ring-2 ring-accent transition" required><button type="submit" class="accent-bg text-white font-semibold px-4 rounded-lg accent-bg-hover transition">Ekle</button></form><div id="modal-personnel-list" class="flex-grow overflow-y-auto space-y-2 pr-2"></div></div>`;
        const closeBtn = dom.modalContent.querySelector('#modal-close');
        const form = document.getElementById('modal-personnel-form');
        const input = document.getElementById('modal-personnel-input');
        const errorDiv = document.getElementById('modal-personnel-error');
        const listContainer = document.getElementById('modal-personnel-list');
        closeBtn.addEventListener('click', () => ui.hideModalUI(dom), { once: true });
        const showModalError = (msg) => { errorDiv.textContent = msg; errorDiv.classList.remove('hidden'); setTimeout(() => errorDiv.classList.add('hidden'), 3000); };
        listContainer.addEventListener('click', async (ev) => {
            const btn = ev.target.closest('button[data-person-action]');
            if (!btn) return;
            const action = btn.dataset.personAction;
            const personDiv = btn.closest('div[data-person-id]');
            const personId = personDiv.dataset.personId;
            const displayView = personDiv.querySelector('.person-display');
            const editView = personDiv.querySelector('.person-edit');
            switch (action) {
                case 'delete':
                    if (await ui.showConfirmationModal(dom, "Bu kişiyi silmek istediğinizden emin misiniz?", "Evet, Sil", true)) {
                        await dataManager.deleteDeliveryPerson(db, userId, personId);
                    }
                    break;
                case 'edit': displayView.classList.add('hidden'); editView.classList.remove('hidden'); editView.querySelector('input').focus(); break;
                case 'cancel-edit': editView.classList.add('hidden'); displayView.classList.remove('hidden'); break;
                case 'save-edit': {
                    const nameInput = editView.querySelector('.person-name-input');
                    const newName = ui.toTrUpperCase(nameInput.value.trim());
                    const oldName = personDiv.dataset.personName;
                    if (!newName) { showModalError("İsim boş olamaz."); return; }
                    if (newName === oldName) { editView.classList.add('hidden'); displayView.classList.remove('hidden'); return; }
                    if (deliveryPersonnel.some(p => ui.toTrUpperCase(p.name) === newName && p.id !== personId)) { showModalError("Bu isimde başka bir kişi zaten var."); return; }
                    await dataManager.updateDeliveryPerson(db, userId, personId, newName);
                    break;
                }
            }
        });
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const name = ui.toTrUpperCase(input.value.trim());
            if (!name) return;
            if (deliveryPersonnel.some(p => ui.toTrUpperCase(p.name) === name)) { showModalError('Bu kişi zaten mevcut.'); return; }
            await dataManager.addDeliveryPerson(db, userId, name);
            input.value = '';
        });
        ui.renderDeliveryPersonnelModalList('modal-personnel-list', deliveryPersonnel, ui.icons);
    }

    function setupAppEventListeners() {
        dom.addItemForm?.addEventListener('submit', handleAddItem);
        dom.searchArchiveInput?.addEventListener('input', () => {
            archiveCurrentPage = 1;
            renderAll();
        });
        document.getElementById('export-archive-pdf-btn')?.addEventListener('click', () => {
            const archived = allItems.filter(item => item.status === 'delivered' && ui.toTrUpperCase(item.customerName).includes(ui.toTrUpperCase(dom.searchArchiveInput.value))).sort((a, b) => (b.deliveredAt?.seconds || 0) - (a.deliveredAt?.seconds || 0));
            if (jsPDF) { if (!ui.exportArchiveToPDF(archived, ui.formatDate, jsPDF)) ui.showSimpleMessageModal(dom, "Bilgi", "Arşivde dışa aktarılacak veri yok."); }
        });
        document.getElementById('export-reports-pdf-btn')?.addEventListener('click', () => {
            if (jsPDF) { if (!ui.exportReportsToPDF(allItems, ui.formatDate, ui.getDayDifference, jsPDF)) ui.showSimpleMessageModal(dom, "Bilgi", "Rapor oluşturulacak teslim edilmiş poşet bulunmuyor."); }
        });
        dom.sortAlphaBtn?.addEventListener('click', () => handleSort('alpha'));
        dom.sortBagsBtn?.addEventListener('click', () => handleSort('bags'));
        dom.sortDateBtn?.addEventListener('click', () => handleSort('date'));
        dom.viewListBtn?.addEventListener('click', () => handleViewChange('list'));
        dom.viewGridBtn?.addEventListener('click', () => handleViewChange('grid'));
        dom.mainContent?.addEventListener('click', handleMainContentClick);
        const onMarkNotifAsRead = (itemId) => {
            if (!seenNotifications.includes(itemId)) seenNotifications.push(itemId);
            localStorage.setItem(`seenNotifications-${userId}`, JSON.stringify([...new Set(seenNotifications)]));
            ui.checkAndDisplayNotifications(dom, allItems, seenNotifications, ui.getUnseenReminders, ui.getUnseenOverdueItems);
            ui.showNotificationsModal(dom, allItems, seenNotifications, userId, ui.formatRelativeTime, onMarkNotifAsRead, onMarkAllNotifsRead);
        };
        const onMarkAllNotifsRead = () => {
            const unseenR = ui.getUnseenReminders(allItems, seenNotifications);
            const unseenO = ui.getUnseenOverdueItems(allItems, seenNotifications);
            seenNotifications.push(...unseenR.map(i => i.id), ...unseenO.map(i => i.id));
            localStorage.setItem(`seenNotifications-${userId}`, JSON.stringify([...new Set(seenNotifications)]));
            ui.checkAndDisplayNotifications(dom, allItems, seenNotifications, ui.getUnseenReminders, ui.getUnseenOverdueItems);
        };
        dom.notificationBell?.addEventListener('click', () => {
            ui.showNotificationsModal(dom, allItems, seenNotifications, userId, ui.formatRelativeTime, onMarkNotifAsRead, onMarkAllNotifsRead);
        });
        // Yeni buton dinleyicisi
        dom.toggleWidthBtn?.addEventListener('click', () => {
            toggleFullWidth(!isFullWidth);
            dataManager.saveSettings(db, userId, settings); // Ayarı kaydet
        });
        document.querySelector('#panel-settings')?.addEventListener('click', handleSettingsPanelClick);
        dom.importFileInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (await ui.showConfirmationModal(dom, "Mevcut tüm verileriniz bu yedeklemedeki verilerle değiştirilecektir. Bu işlem geri alınamaz. Emin misiniz?", "Onayla ve Yükle", true)) {
                        if (!data.allItems || !data.allCustomers) { ui.showSimpleMessageModal(dom, 'Hata', 'Geçersiz yedek dosyası formatı.'); return; }
                        showLoadingMsg('Mevcut veriler siliniyor...');
                        await dataManager.importDataFromJSON(db, userId, data, allItems, allCustomers, deliveryPersonnel, ui.toTrUpperCase);
                        hideLoadingMsg();
                        await ui.showSimpleMessageModal(dom, 'Başarılı', 'Veriler başarıyla geri yüklendi.', true);
                    }
                } catch (err) {
                    ui.showSimpleMessageModal(dom, 'Hata', 'Yedek dosyası okunurken hata oluştu.');
                }
            };
            reader.readAsText(file);
            e.target.value = null;
        });
        document.getElementById('font-size-slider')?.addEventListener('input', (e) => {
            settings.fontSize = e.target.value;
            document.getElementById('font-size-preview').textContent = `${settings.fontSize}px`;
            document.body.style.fontSize = `${settings.fontSize}px`;
        });
        document.getElementById('font-size-slider')?.addEventListener('change', (e) => {
            settings.fontSize = e.target.value;
            dataManager.saveSettings(db, userId, settings);
        });
        document.querySelectorAll('.report-range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.report-range-btn').forEach(b => b.classList.remove('accent-bg'));
                btn.classList.add('accent-bg');
                ui.renderPeriodicReport(allItems, btn.dataset.range, ui.formatDate);
            });
        });
        // Sekme butonları: document üzerinde delegation (nav her zaman hazır olmayabilir)
        document.body.addEventListener('click', (e) => {
            const button = e.target.closest('nav button.tab-button');
            if (button && button.id && button.id.startsWith('tab-')) {
                e.preventDefault();
                const targetTab = button.id.replace('tab-', '');
                ui.switchTab(targetTab);

                // Raporlar sekmesine tıklandığında grafiklerin düzgün yüklenmesi için tetikleyici
                if (targetTab === 'reports') {
                    const activeBtn = document.querySelector('.report-range-btn.accent-bg');
                    const range = activeBtn ? activeBtn.dataset.range : null;
                    
                    // Grafikleri görünür olduktan sonra çiz
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            ui.renderPeriodicReport(allItems, range, ui.formatDate);
                        });
                    }, 300);
                }
            }
        });
        dom.customerNameInput?.addEventListener('input', () => {
            const searchTerm = ui.toTrUpperCase(dom.customerNameInput.value.trim());
            dom.clearCustomerNameBtn?.classList.toggle('hidden', searchTerm.length === 0);
            const activeItems = allItems.filter(item => item.status !== 'delivered');
            ui.renderItems(dom, activeItems, sortState, viewMode, searchTerm, ui.formatDate, ui.formatRelativeTime);
            dom.suggestionsBox.innerHTML = '';
            if (searchTerm.length === 0) { dom.suggestionsBox.classList.add('hidden'); return; }
            const filteredCustomers = allCustomers.filter(c => ui.toTrUpperCase(c.name).includes(searchTerm)).map(c => c.name);
            if (filteredCustomers.length > 0) {
                filteredCustomers.forEach(name => {
                    const div = document.createElement('div');
                    div.textContent = name;
                    div.className = 'p-3 hover:bg-slate-600 cursor-pointer text-primary';
                    div.addEventListener('click', () => {
                        dom.customerNameInput.value = name;
                        dom.suggestionsBox.classList.add('hidden');
                        ui.renderItems(dom, activeItems, sortState, viewMode, ui.toTrUpperCase(name), ui.formatDate, ui.formatRelativeTime);
                        dom.bagCountInput.focus();
                    });
                    dom.suggestionsBox.appendChild(div);
                });
                dom.suggestionsBox.classList.remove('hidden');
            } else {
                dom.suggestionsBox.classList.add('hidden');
            }
        });
        dom.clearCustomerNameBtn?.addEventListener('click', () => {
            dom.customerNameInput.value = '';
            dom.clearCustomerNameBtn.classList.add('hidden');
            dom.customerNameInput.dispatchEvent(new Event('input'));
            dom.customerNameInput.focus();
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.relative')) dom.suggestionsBox?.classList.add('hidden');
            const openMenu = document.querySelector('.action-menu:not(.hidden)');
            if (openMenu && !e.target.closest('.default-actions')) openMenu.classList.add('hidden');
        });
        dom.scrollToTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        window.addEventListener('scroll', () => {
            if (dom.scrollToTopBtn) {
                if (window.scrollY > 200) dom.scrollToTopBtn.classList.add('visible');
                else dom.scrollToTopBtn.classList.remove('visible');
            }
        });
    }

    // --- Uygulamayı başlatan kod ---
    async function startApp() {
        try {
            app = initializeApp(firebaseConfig);
            authInstance = getAuth(app);
            db = getFirestore(app);
            auth.setupAuthEventListeners(authInstance, dom, {
                showLoading: showLoadingMsg,
                hideLoading: hideLoadingMsg,
                onLoginSuccess: (user) => {
                    currentUser = user;
                    userId = user.uid;
                    hideLoadingMsg();
                    ui.showAppUI(dom, user);
                    initializeAppLogic();
                },
                onRegisterSuccess: (user) => {
                    currentUser = user;
                    userId = user.uid;
                    hideLoadingMsg();
                    ui.showAppUI(dom, user);
                    initializeAppLogic();
                }
            });
            showLoadingMsg("Kimlik durumu kontrol ediliyor...");

            // onAuthStateChanged hiç tetiklenmezse (ağ/persistence takılı kalırsa) 8 sn sonra yükleme ekranını kapat
            const AUTH_TIMEOUT_MS = 8000;
            const authTimeoutId = setTimeout(() => {
                console.warn("Kimlik kontrolü zaman aşımı – giriş ekranı gösteriliyor.");
                hideLoadingMsg();
                ui.showAuthUI(dom);
            }, AUTH_TIMEOUT_MS);

            onAuthStateChanged(authInstance, (user) => {
                clearTimeout(authTimeoutId);
                hideLoadingMsg(); // Önce yükleme ekranını kapat (hata olsa bile)
                try {
                    if (user) {
                        currentUser = user;
                        userId = user.uid;
                        ui.showAppUI(dom, user);
                        initializeAppLogic();
                    } else {
                        userId = null;
                        currentUser = null;
                        appLogicInitialized = false;
                        if (itemsUnsubscribe) itemsUnsubscribe();
                        if (customersUnsubscribe) customersUnsubscribe();
                        if (deliveryPersonnelUnsubscribe) deliveryPersonnelUnsubscribe();
                        if (settingsUnsubscribe) settingsUnsubscribe();
                        allItems = [];
                        allCustomers = [];
                        deliveryPersonnel = [];
                        settings = {};
                        ui.showAuthUI(dom);
                    }
                } catch (err) {
                    console.error("Auth state işlenirken hata:", err);
                    ui.showAuthUI(dom);
                }
            });
        } catch (error) {
            console.error("Başlatma hatası:", error);
            hideLoadingMsg();
            alert("Uygulama başlatılamadı: " + error.message);
        }
    }

    startApp();
});
