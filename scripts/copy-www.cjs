/**
 * Web kökünü Capacitor webDir (www) içine kopyalar — Android paketleme öncesi çalıştırın.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

const FILES = ['index.html', 'manifest.json', 'sw.js', 'firebase-messaging-sw.js', '.nojekyll'];

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

require('./ensure-capacitor-vendor.cjs');

rmrf(www);
fs.mkdirSync(www, { recursive: true });

for (const name of FILES) {
  const src = path.join(root, name);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(www, name));
  }
}

const assetsSrc = path.join(root, 'assets');
const assetsDest = path.join(www, 'assets');
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
}

console.log('www hazır:', www);
