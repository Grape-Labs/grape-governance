const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {checkClientAssets} = require('../bin/check-client-assets.cjs');

test('asset check rejects empty image modules even when stale image files exist', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'client-assets-'));
  try {
    const names = ['governance-logo.hash.svg','gist_banner.hash.png','icon.hash.png','apple-grape-touch-icon.hash.png'];
    for (const name of names) fs.writeFileSync(path.join(directory, name), 'asset');
    fs.writeFileSync(path.join(directory, 'index.html'), '<script type=module src=/app.js></script>');
    fs.writeFileSync(path.join(directory, 'app.js'), 'const image = {};');
    fs.writeFileSync(path.join(directory, 'stale.js'), JSON.stringify(names));
    assert.throws(() => checkClientAssets(directory), /no URL for governance-logo/);
    const imports = Object.fromEntries(names.map((name,i) => [`asset${i}`, '/' + name]));
    fs.writeFileSync(path.join(directory, 'index.html'), `<script type=importmap>${JSON.stringify({imports})}</script><script type=module src=/app.js></script>`);
    fs.writeFileSync(path.join(directory, 'app.js'), names.map((_,i) => `import.meta.resolve("asset${i}");`).join('\n'));
    assert.doesNotThrow(() => checkClientAssets(directory));
    fs.unlinkSync(path.join(directory, names[0]));
    assert.throws(() => checkClientAssets(directory), /no URL for governance-logo/);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
