/**
 * İlk kurulumda örnek dosyaları yerel (gitignored) yapılandırma kopyalarına dönüştürür.
 * Mevcut yerel dosyaların üzerine yazmaz.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function copyIfMissing(relExample, relDest) {
  const examplePath = path.join(root, relExample);
  const destPath = path.join(root, relDest);
  if (fs.existsSync(destPath)) return;
  if (!fs.existsSync(examplePath)) {
    console.warn('[ensure-local-firebase-files] Örnek bulunamadı, atlanıyor:', relExample);
    return;
  }
  fs.copyFileSync(examplePath, destPath);
  console.log('[ensure-local-firebase-files] Oluşturuldu:', relDest, '(düzenleyip kaydedin)');
}

copyIfMissing('assets/js/firebase-config.example.js', 'assets/js/firebase-config.js');
copyIfMissing('firebase-messaging-sw.example.js', 'firebase-messaging-sw.js');
