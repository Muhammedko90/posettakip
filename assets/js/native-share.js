/**
 * Android (Capacitor) ve tarayıcı ortamları için ortak dosya kaydet/paylaş yardımcısı.
 * Native ortamda blob'u Filesystem cache'ine yazar, ardından sistem paylaşım sayfasını açar
 * (kullanıcı Drive, Dosyalar, WhatsApp vb. üzerinden kaydedebilir/paylaşabilir).
 * Tarayıcıda klasik <a download> akışı kullanılır.
 */

let _capacitorPromise = null;
async function loadCapacitor() {
    if (!_capacitorPromise) {
        _capacitorPromise = (async () => {
            try {
                const core = await import('../vendor/capacitor-core.js');
                if (!core?.Capacitor?.isNativePlatform?.()) return null;
                const fs = await import('../vendor/capacitor-filesystem/index.js');
                const sh = await import('../vendor/capacitor-share/index.js');
                return {
                    Capacitor: core.Capacitor,
                    Filesystem: fs.Filesystem,
                    Directory: fs.Directory,
                    Share: sh.Share,
                };
            } catch (err) {
                console.warn('Capacitor yüklenemedi, tarayıcı moduna düşülüyor.', err);
                return null;
            }
        })();
    }
    return _capacitorPromise;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı'));
        reader.onload = () => {
            const result = reader.result || '';
            const idx = String(result).indexOf(',');
            resolve(idx >= 0 ? String(result).slice(idx + 1) : String(result));
        };
        reader.readAsDataURL(blob);
    });
}

function browserDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Bir Blob'u dosya olarak kullanıcıya iletir.
 *  - Android (Capacitor): Cache dizinine yazar ve sistem paylaşım sayfasını açar.
 *  - Tarayıcı: <a download> ile indirir.
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ title?: string, dialogTitle?: string }} [opts]
 * @returns {Promise<{ method: 'web' | 'native', uri?: string }>}
 */
export async function saveOrShareBlob(blob, filename, opts = {}) {
    if (!(blob instanceof Blob)) throw new Error('saveOrShareBlob: Blob bekleniyor');
    const cap = await loadCapacitor();
    if (!cap) {
        browserDownload(blob, filename);
        return { method: 'web' };
    }
    const { Filesystem, Directory, Share } = cap;
    const data = await blobToBase64(blob);
    const safeName = filename.replace(/[\\/:*?"<>|]+/g, '_');
    const written = await Filesystem.writeFile({
        path: safeName,
        data,
        directory: Directory.Cache,
        recursive: true,
    });
    const uri = written?.uri;
    try {
        await Share.share({
            title: opts.title || filename,
            text: opts.title || filename,
            url: uri,
            dialogTitle: opts.dialogTitle || 'Dosyayı kaydet veya paylaş',
        });
    } catch (err) {
        const msg = String(err?.message || err || '').toLowerCase();
        if (!msg.includes('cancel')) {
            console.warn('Share başarısız, dosya cache içinde kaldı:', uri, err);
            throw err;
        }
    }
    return { method: 'native', uri };
}

/**
 * String içeriği (json/csv/txt) için kısa yol.
 */
export async function saveOrShareText(text, filename, mime, opts) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    return saveOrShareBlob(blob, filename, opts);
}

/**
 * jsPDF dokümanı için kısa yol — pdf.save() yerine kullanılır.
 */
export async function saveOrSharePdf(pdfDoc, filename, opts) {
    const blob = pdfDoc.output('blob');
    return saveOrShareBlob(blob, filename, opts);
}

/**
 * Native ortamda mıyız?
 */
export async function isNative() {
    const cap = await loadCapacitor();
    return !!cap;
}
