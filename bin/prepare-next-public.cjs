const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require('@next/env').loadEnvConfig(root);
const out = path.join(root, 'public');
fs.mkdirSync(out, {recursive: true});
fs.cpSync(path.join(root, 'src/public'), path.join(out, 'assets'), {
  recursive: true, filter: source => !/\.(sketch|DS_Store)$/.test(source),
});
fs.cpSync(path.join(root, 'src/public/locales'), path.join(out, 'locales'), {recursive: true});
fs.cpSync(path.join(root, 'src/public/assets/icons'), path.join(out, 'icons'), {recursive: true});
const manifest = fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8').replaceAll('./src/public/', '/assets/');
fs.writeFileSync(path.join(out, 'manifest.webmanifest'), manifest);
let worker = fs.readFileSync(path.join(root, 'src/serviceWorker.js'), 'utf8');
worker = worker.replace(/process\.env\.(REACT_APP_FIREBASE_[A-Z_]+)/g, (_, key) => JSON.stringify(process.env[key] || ''));
fs.writeFileSync(path.join(out, 'serviceWorker.js'), worker);
