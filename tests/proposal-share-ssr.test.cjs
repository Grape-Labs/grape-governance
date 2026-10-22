const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
const React = require('react');
const { renderToString } = require('react-dom/server');
test('share button renders on the server without browser APIs', () => {
  const module = { exports: {} };
  const code = transformSync(fs.readFileSync('src/Governance/Demo/ProposalShare.tsx','utf8'), {
    filename:'ProposalShare.tsx',configFile:false,babelrc:false,
    presets:['@babel/preset-typescript','@babel/preset-react'],
    plugins:['@babel/plugin-transform-modules-commonjs'],
  }).code;
  new Function('module','exports','require','navigator','window',code)(module,module.exports,require,undefined,undefined);
  const html = renderToString(React.createElement(module.exports.default,{realm:'realm',proposal:'proposal',title:'A proposal'}));
  assert.match(html,/aria-label="Share proposal"/);
  assert.ok(!html.includes('Link copied'));
});
