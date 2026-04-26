/**
 * Gradient Border Effect — tek bir pointermove dinleyicisi tüm kartları çalıştırır.
 *
 * Kullanım: HTML'de istediğiniz karta `class="gradient-border"` ekleyin.
 * CSS değişkenleri `--gb-x` ve `--gb-y` imleç pozisyonuna göre güncellenir;
 * `--gb-opacity` ise imleç kart üzerindeyken yumuşakça açılır/kapanır.
 *
 * Notlar:
 *  - rAF ile throttle edilir (her frame'de en fazla bir güncelleme).
 *  - Mobil/dokunmatik cihazlarda CSS @media (hover: none) ile zaten gizlenir;
 *    yine de listener'ı pointer:fine olmayanlarda hiç bağlamayız.
 */
(function initGradientBorder() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // Dokunmatik / hover desteği yok ise efekt zaten görsel olarak kapalı,
    // pointer dinleyicisini bağlamaya gerek yok.
    try {
        if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;
    } catch (_) { /* yoksay */ }

    const SELECTOR = '.gradient-border';
    const ACTIVE_OPACITY = '1';
    const INACTIVE_OPACITY = '0';

    let pendingEvent = null;
    let rafId = 0;
    const activeCards = new Set();

    function applyUpdate() {
        rafId = 0;
        const evt = pendingEvent;
        pendingEvent = null;
        if (!evt) return;

        const target = evt.target instanceof Element ? evt.target : null;
        const card = target ? target.closest(SELECTOR) : null;

        // Aktif kart listesini güncelle: imleç şu anda card içinde mi?
        if (card) {
            if (!activeCards.has(card)) {
                activeCards.add(card);
                card.style.setProperty('--gb-opacity', ACTIVE_OPACITY);
            }
            const rect = card.getBoundingClientRect();
            const x = evt.clientX - rect.left;
            const y = evt.clientY - rect.top;
            card.style.setProperty('--gb-x', x.toFixed(1) + 'px');
            card.style.setProperty('--gb-y', y.toFixed(1) + 'px');
        }

        // İmleç başka bir karta geçtiyse veya hiçbir karta üzerinde değilse,
        // önceki aktif kartlardan bu olayın hedefine ait olmayanları kapat.
        if (activeCards.size > 0) {
            for (const prev of activeCards) {
                if (prev === card) continue;
                if (!prev.isConnected) {
                    activeCards.delete(prev);
                    continue;
                }
                const r = prev.getBoundingClientRect();
                const inside =
                    evt.clientX >= r.left && evt.clientX <= r.right &&
                    evt.clientY >= r.top  && evt.clientY <= r.bottom;
                if (!inside) {
                    prev.style.setProperty('--gb-opacity', INACTIVE_OPACITY);
                    activeCards.delete(prev);
                }
            }
        }
    }

    function onPointerMove(e) {
        pendingEvent = e;
        if (!rafId) rafId = window.requestAnimationFrame(applyUpdate);
    }

    function onPointerLeaveWindow() {
        for (const card of activeCards) {
            card.style.setProperty('--gb-opacity', INACTIVE_OPACITY);
        }
        activeCards.clear();
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeaveWindow);
    window.addEventListener('blur', onPointerLeaveWindow);
})();
