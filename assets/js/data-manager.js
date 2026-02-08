/**
 * Firestore veri çekme / yazma işlemleri
 */
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    serverTimestamp,
    writeBatch,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export function getDefaultSettings() {
    return {
        theme: 'aurora',
        fontSize: 16,
        viewMode: 'grid',
        isFullWidth: false, 
        customTitle: 'GÜNÜN NOTU',
        customContent: 'Ayarlar menüsünden bu notu düzenleyebilirsiniz.',
        shareTemplate: 'Merhaba, [Müşteri Adı] adına ayrılan [Poşet Sayısı] poşetiniz [Bekleme Süresi] gündür beklemektedir.',
        telegramBotToken: '', 
        telegramChatId: '',
        telegramReportTime: '09:00',
        lastReportDate: '',
        telegramLastUpdateId: 0 // Yeni: Botun okuduğu son mesaj ID'si
    };
}

/**
 * Ayarları Firestore'a kaydet
 */
export async function saveSettings(db, userId, settings) {
    if (!userId) return;
    const settingsRef = doc(db, 'users', userId, 'settings', 'appSettings');
    await setDoc(settingsRef, settings, { merge: true });
}

/**
 * Items koleksiyonunu dinle
 */
export function listenToItems(db, userId, onUpdate, onError) {
    const q = query(collection(db, 'users', userId, 'items'));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        onUpdate(items);
    }, onError || (err => console.error("Error listening to items:", err)));
}

/**
 * Customers koleksiyonunu dinle
 */
export function listenToCustomers(db, userId, onUpdate, onError) {
    const q = query(collection(db, 'users', userId, 'customers'));
    return onSnapshot(q, (snapshot) => {
        const customers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        onUpdate(customers);
    }, onError || (err => console.error("Error listening to customers:", err)));
}

/**
 * Delivery personnel koleksiyonunu dinle
 */
export function listenToDeliveryPersonnel(db, userId, onUpdate, onError) {
    const q = query(collection(db, 'users', userId, 'deliveryPersonnel'));
    return onSnapshot(q, (snapshot) => {
        const personnel = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
        onUpdate(personnel);
    }, onError || (err => console.error("Error listening to delivery personnel:", err)));
}

/**
 * Ayarlar belgesini dinle
 */
export function listenToSettings(db, userId, onUpdate, onError) {
    const settingsRef = doc(db, 'users', userId, 'settings', 'appSettings');
    return onSnapshot(settingsRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            onUpdate({ ...getDefaultSettings(), ...docSnapshot.data() });
        } else {
            onUpdate(getDefaultSettings());
        }
    }, onError || (err => console.error("Ayarlar dinlenirken hata:", err)));
}

/**
 * Yeni poşet kaydı ekle
 */
export async function addItem(db, userId, data) {
    const colRef = collection(db, 'users', userId, 'items');
    return addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp(),
        lastModified: serverTimestamp()
    });
}

/**
 * Var olan kayda poşet ekle (merge)
 */
export async function addBagsToExistingItem(db, userId, itemId, extraBags, additionalDates) {
    const itemRef = doc(db, 'users', userId, 'items', itemId);
    await updateDoc(itemRef, {
        bagCount: extraBags.bagCount,
        lastModified: serverTimestamp(),
        additionalDates: arrayUnion(...additionalDates)
    });
}

/**
 * Müşteri ekle
 */
export async function addCustomer(db, userId, name) {
    const colRef = collection(db, 'users', userId, 'customers');
    return addDoc(colRef, { name });
}

/**
 * Teslim eden kişi ekle
 */
export async function addDeliveryPerson(db, userId, name) {
    const colRef = collection(db, 'users', userId, 'deliveryPersonnel');
    return addDoc(colRef, { name });
}

/**
 * Kayıt güncelle
 */
export async function updateItem(db, userId, itemId, data) {
    const itemRef = doc(db, 'users', userId, 'items', itemId);
    await updateDoc(itemRef, { ...data, lastModified: serverTimestamp() });
}

/**
 * Kayıt sil
 */
export async function deleteItem(db, userId, itemId) {
    await deleteDoc(doc(db, 'users', userId, 'items', itemId));
}

/**
 * Müşteri sil
 */
export async function deleteCustomer(db, userId, customerId) {
    await deleteDoc(doc(db, 'users', userId, 'customers', customerId));
}

/**
 * Teslim eden kişi sil
 */
export async function deleteDeliveryPerson(db, userId, personId) {
    await deleteDoc(doc(db, 'users', userId, 'deliveryPersonnel', personId));
}

/**
 * Teslim eden kişi güncelle
 */
export async function updateDeliveryPerson(db, userId, personId, name) {
    const personRef = doc(db, 'users', userId, 'deliveryPersonnel', personId);
    await updateDoc(personRef, { name });
}

/**
 * Müşteri adını ve ilgili tüm item'ları güncelle
 */
export async function updateCustomerNameAndItems(db, userId, customerId, oldName, newName) {
    const batch = writeBatch(db);
    const customersRef = collection(db, 'users', userId, 'customers');
    const itemsRef = collection(db, 'users', userId, 'items');
    const customerRef = doc(customersRef, customerId);
    batch.update(customerRef, { name: newName });
    const itemsQuery = query(itemsRef, where('customerName', '==', oldName));
    const snapshot = await getDocs(itemsQuery);
    snapshot.docs.forEach(d => batch.update(d.ref, { customerName: newName }));
    await batch.commit();
}

/**
 * Müşteriye ait tüm item'ları ve müşteriyi sil
 */
export async function deleteCustomerAndItems(db, userId, customerId, customerName) {
    const batch = writeBatch(db);
    const itemsQuery = query(collection(db, 'users', userId, 'items'), where('customerName', '==', customerName));
    const itemsSnapshot = await getDocs(itemsQuery);
    itemsSnapshot.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'users', userId, 'customers', customerId));
    await batch.commit();
}

/**
 * Tüm item'ları sil (poşet listesini sıfırla)
 */
export async function resetItems(db, userId, itemIds) {
    const batch = writeBatch(db);
    const itemsRef = collection(db, 'users', userId, 'items');
    itemIds.forEach(id => batch.delete(doc(itemsRef, id)));
    await batch.commit();
}

/**
 * Tüm verileri sil (items, customers, deliveryPersonnel)
 */
export async function resetAllData(db, userId) {
    const batch = writeBatch(db);
    const collectionsToDelete = ['items', 'customers', 'deliveryPersonnel'];
    for (const collName of collectionsToDelete) {
        const snapshot = await getDocs(collection(db, 'users', userId, collName));
        snapshot.docs.forEach(d => batch.delete(d.ref));
    }
    await batch.commit();
}

/**
 * JSON'dan veri içe aktar (mevcut verileri silip yeni verileri yazar)
 */
export async function importDataFromJSON(db, userId, data, currentItems, currentCustomers, currentPersonnel, toTrUpperCase) {
    const itemsRef = collection(db, 'users', userId, 'items');
    const customersRef = collection(db, 'users', userId, 'customers');
    const personnelRef = collection(db, 'users', userId, 'deliveryPersonnel');

    const deleteBatch = writeBatch(db);
    currentItems.forEach(item => deleteBatch.delete(doc(itemsRef, item.id)));
    currentCustomers.forEach(c => deleteBatch.delete(doc(customersRef, c.id)));
    currentPersonnel.forEach(p => deleteBatch.delete(doc(personnelRef, p.id)));
    await deleteBatch.commit();

    const importBatch = writeBatch(db);
    if (data.allItems) {
        data.allItems.forEach(item => {
            const ref = doc(itemsRef);
            const clean = { ...item };
            delete clean.id;
            if (clean.customerName) clean.customerName = toTrUpperCase(clean.customerName);
            if (clean.note) clean.note = toTrUpperCase(clean.note);
            if (clean.createdAt && clean.createdAt.seconds) clean.createdAt = new Date(clean.createdAt.seconds * 1000);
            if (clean.lastModified && clean.lastModified.seconds) clean.lastModified = new Date(clean.lastModified.seconds * 1000);
            if (clean.deliveredAt && clean.deliveredAt.seconds) clean.deliveredAt = new Date(clean.deliveredAt.seconds * 1000);
            if (clean.additionalDates) clean.additionalDates = (clean.additionalDates || []).map(d => d && d.seconds ? new Date(d.seconds * 1000) : (d ? new Date(d) : null));
            importBatch.set(ref, clean);
        });
    }
    if (data.allCustomers) {
        data.allCustomers.forEach(customer => {
            const ref = doc(customersRef);
            const clean = { ...customer };
            delete clean.id;
            if (clean.name) clean.name = toTrUpperCase(clean.name);
            importBatch.set(ref, clean);
        });
    }
    if (data.deliveryPersonnel && Array.isArray(data.deliveryPersonnel)) {
        data.deliveryPersonnel.forEach(person => {
            const ref = doc(personnelRef);
            const clean = { ...person };
            delete clean.id;
            if (clean.name) clean.name = toTrUpperCase(clean.name);
            importBatch.set(ref, clean);
        });
    }
    await importBatch.commit();
}