const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {transformSync} = require('@babel/core');
let route, params, mobile;
const mod = {exports: {}};
const code = transformSync(fs.readFileSync('src/Governance/Demo/GrapeDaoNavigation.tsx', 'utf8'), {
  filename: 'GrapeDaoNavigation.tsx', configFile: false, babelrc: false,
  presets: ['@babel/preset-typescript', '@babel/preset-react'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const mocks = {
  './governance-demo.css': {},
  './useCouncilDelegation': {useCouncilDelegation: () => ({allowed: false})},
  'react-router-dom': {
    useParams: () => route, useSearchParams: () => [params],
    Link: ({to, children, ...props}) => React.createElement('a', {...props, href: to}, children),
  },
  '@mui/material': {
    useMediaQuery: () => mobile,
    Menu: ({children}) => React.createElement('div', null, children),
    MenuItem: ({component: Component, ...props}) => React.createElement(Component, props),
  },
};
new Function('module', 'exports', 'require', code)(mod, mod.exports, id => id in mocks ? mocks[id] : require(id));
function links(pathParams, query, props = {}, isMobile = false) {
  route = pathParams; params = new URLSearchParams(query); mobile = isMobile;
  const html = renderToStaticMarkup(React.createElement(mod.exports.default, props));
  return [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g)]
    .map(([, href, body]) => ({href: href.replaceAll('&amp;', '&'), text: body.replace(/<[^>]+>/g, '')}));
}
test('desktop switch opens old UI and returns to new UI for the same proposal', () => {
  assert.deepEqual(links({governance: 'realm', proposal: 'ballot'}, 'tab=details')
    .find(link => link.text === 'Switch to old UI'), {href: '/proposal/realm/ballot?tab=details&view=advanced', text: 'Switch to old UI'});
  assert.deepEqual(links({governance: 'realm', proposal: 'ballot'}, 'tab=details&view=advanced', {section: 'advanced'})
    .find(link => link.text === 'Switch to new UI'), {href: '/proposal/realm/ballot?tab=details', text: 'Switch to new UI'});
});
test('overview switch works in both directions and preserves query-selected proposals', () => {
  assert.equal(links({handlekey: 'realm'}, '').find(link => link.text === 'Switch to old UI').href, '/dao/realm?view=advanced');
  assert.equal(links({handlekey: 'realm'}, 'view=advanced', {section: 'advanced'}).find(link => link.text === 'Switch to new UI').href, '/dao/realm');
  assert.equal(links({handlekey: 'realm'}, 'proposal=ballot').find(link => link.text === 'Switch to old UI').href, '/proposal/realm/ballot?view=advanced');
});
test('mobile overflow provides the same bidirectional switch', () => {
  for (const old of [false, true]) {
    const label = old ? 'Switch to new UI' : 'Switch to old UI';
    const link = links({governance: 'realm', proposal: 'ballot'}, old ? 'view=advanced' : '', {advanced: old}, true)
      .find(link => link.text === label);
    assert.equal(link.href, `/proposal/realm/ballot${old ? '' : '?view=advanced'}`);
  }
});
