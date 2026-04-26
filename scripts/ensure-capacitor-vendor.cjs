/**
 * @capacitor/core, @capacitor/app, @capacitor/filesystem ve @capacitor/share ESM dosyalarını
 * assets/vendor altına kopyalar. ESM içindeki '@capacitor/core' importlarını göreli yola çevirir
 * ve uzantısız ./web, ./definitions importlarına .js ekler (Android WebView / import map yok).
 * copy-www ve postinstall tarafından çağrılır.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function patchEsmImports(esmDir, coreRelativePath) {
  if (!fs.existsSync(esmDir)) return;
  const entries = fs.readdirSync(esmDir);
  for (const f of entries) {
    if (!f.endsWith('.js')) continue;
    const p = path.join(esmDir, f);
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/from\s+['"]@capacitor\/core['"]/g, `from '${coreRelativePath}'`);
    s = s.replace(/import\(\s*['"]@capacitor\/core['"]\s*\)/g, `import('${coreRelativePath}')`);
    s = s.replace(/from\s+['"](\.\.?\/[^'"]+?)['"]/g, (m, p1) => {
      if (/\.[a-zA-Z0-9]+$/.test(p1)) return m;
      return `from '${p1}.js'`;
    });
    s = s.replace(/import\(\s*['"](\.\.?\/[^'"]+?)['"]\s*\)/g, (m, p1) => {
      if (/\.[a-zA-Z0-9]+$/.test(p1)) return m;
      return `import('${p1}.js')`;
    });
    fs.writeFileSync(p, s);
  }
}

function copyPluginEsm(pkgName, destFolderName, coreRelativePath) {
  const vendorRoot = path.join(root, 'assets', 'vendor');
  const src = path.join(root, 'node_modules', '@capacitor', pkgName, 'dist', 'esm');
  const dest = path.join(vendorRoot, destFolderName);
  if (!fs.existsSync(src)) {
    console.warn(`Capacitor ${pkgName} vendor atlandı (node_modules eksik).`);
    return;
  }
  rmrf(dest);
  fs.cpSync(src, dest, { recursive: true });
  patchEsmImports(dest, coreRelativePath);
}

function ensureCapacitorVendor() {
  const vendorRoot = path.join(root, 'assets', 'vendor');
  const coreSrc = path.join(root, 'node_modules', '@capacitor', 'core', 'dist', 'index.js');
  const coreDest = path.join(vendorRoot, 'capacitor-core.js');
  if (!fs.existsSync(coreSrc)) {
    console.warn('Capacitor core vendor atlandı (node_modules eksik). npm install çalıştırın.');
    return;
  }
  fs.mkdirSync(vendorRoot, { recursive: true });
  fs.copyFileSync(coreSrc, coreDest);

  copyPluginEsm('app', 'capacitor-app', '../capacitor-core.js');
  copyPluginEsm('filesystem', 'capacitor-filesystem', '../capacitor-core.js');
  copyPluginEsm('share', 'capacitor-share', '../capacitor-core.js');
}

ensureCapacitorVendor();
