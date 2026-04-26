/**
 * @capacitor/core ve @capacitor/app ESM dosyalarını assets/vendor altına kopyalar.
 * @capacitor/app içindeki '@capacitor/core' importlarını göreli yola çevirir (Android WebView / import map olmadan çalışsın).
 * copy-www ve postinstall tarafından çağrılır.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function patchAppEsmImports(appEsmDest) {
  for (const f of ['index.js', 'web.js']) {
    const p = path.join(appEsmDest, f);
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/from\s+['"]@capacitor\/core['"]/g, "from '../capacitor-core.js'");
    fs.writeFileSync(p, s);
  }
}

function ensureCapacitorVendor() {
  const vendorRoot = path.join(root, 'assets', 'vendor');
  const coreSrc = path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'index.js');
  const coreDest = path.join(vendorRoot, 'capacitor-core.js');
  const appEsmSrc = path.join(root, 'node_modules', '@capacitor', 'app', 'dist', 'esm');
  const appEsmDest = path.join(vendorRoot, 'capacitor-app');
  if (!fs.existsSync(coreSrc) || !fs.existsSync(appEsmSrc)) {
    console.warn('Capacitor vendor atlandı (node_modules eksik). npm install çalıştırın.');
    return;
  }
  fs.mkdirSync(vendorRoot, { recursive: true });
  fs.copyFileSync(coreSrc, coreDest);
  rmrf(appEsmDest);
  fs.cpSync(appEsmSrc, appEsmDest, { recursive: true });
  patchAppEsmImports(appEsmDest);
}

ensureCapacitorVendor();
