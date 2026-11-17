'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Yarn 1 can leave nested packages from a restored deployment cache even after
// resolutions have hoisted their replacement. Never compile those stale SDKs.
function prepareDependencyTree(root = process.cwd()) {
  const modules = path.join(root, 'node_modules');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const expected = manifest.dependencies['@solana/web3.js'];
  const canonical = path.join(modules, '@solana', 'web3.js');
  const installed = JSON.parse(fs.readFileSync(path.join(canonical, 'package.json'), 'utf8')).version;
  if (installed !== expected) throw new Error(`Expected pinned @solana/web3.js ${expected}, found ${installed}. Run a frozen-lockfile install.`);
  const removed = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const packageDirectories = entry.name.startsWith('@')
        ? fs.readdirSync(path.join(directory, entry.name), {withFileTypes:true}).filter(child => child.isDirectory()).map(child => path.join(directory, entry.name, child.name))
        : [path.join(directory, entry.name)];
      for (const packageDirectory of packageDirectories) {
        const sdk = path.basename(packageDirectory) === 'web3.js' && path.basename(path.dirname(packageDirectory)) === '@solana';
        if (sdk && packageDirectory !== canonical) {
          const packageFile = path.join(packageDirectory, 'package.json');
          const version = fs.existsSync(packageFile) ? JSON.parse(fs.readFileSync(packageFile, 'utf8')).version : null;
          if (version !== expected) {
            fs.rmSync(packageDirectory, {recursive:true,force:true});
            removed.push(path.relative(root, packageDirectory));
            continue;
          }
        }
        visit(path.join(packageDirectory, 'node_modules'));
      }
    }
  }
  visit(modules);
  return {version: installed, removed};
}
module.exports = {prepareDependencyTree};
if (require.main === module) {
  const result = prepareDependencyTree();
  console.log(`Using @solana/web3.js ${result.version}; removed ${result.removed.length} stale cached SDK copies.`);
}
