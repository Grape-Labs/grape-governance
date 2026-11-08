const fs = require('node:fs');
const path = require('node:path');

// Check the active bundle, not stale assets left over from earlier builds.
function checkClientAssets(directory = 'dist') {
  const html = fs.readFileSync(path.join(directory, 'index.html'), 'utf8');
  const files = fs.readdirSync(directory);
  const imports = Object.assign({}, ...[...html.matchAll(/<script\b[^>]*type=["']?importmap["']?[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1]).imports || {}));
  const scripts = files.filter(name => name.endsWith('.js'));
  const pending = [...html.matchAll(/<script\b[^>]*\bsrc=["']?([^\s"'>]+)/g)]
    .map(match => path.basename(match[1].split('?')[0])).filter(name => scripts.includes(name));
  const visited = new Set();
  let activeCode = '';
  while (pending.length) {
    const name = pending.pop();
    if (visited.has(name)) continue;
    visited.add(name);
    const code = fs.readFileSync(path.join(directory, name), 'utf8');
    activeCode += code;
    for (const script of scripts) if (!visited.has(script) && code.includes(script)) pending.push(script);
  }
  for (const stem of ['governance-logo', 'gist_banner', 'icon', 'apple-grape-touch-icon']) {
    const emitted = files.filter(name => name.startsWith(stem + '.') && /\.(svg|png)$/.test(name));
    if (!emitted.some(name => activeCode.includes(name) || Object.entries(imports).some(([id, url]) =>
      path.basename(url) === name && activeCode.includes(JSON.stringify(id))))) {
      throw new Error(`Client bundle has no URL for ${stem}; check image imports use the url: pipeline.`);
    }
  }
}
module.exports = {checkClientAssets};
if (require.main === module) {
  checkClientAssets(process.argv[2]);
  console.log('Client logo and replacement assets have emitted URLs.');
}
