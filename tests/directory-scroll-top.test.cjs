const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { parse } = require('@babel/parser');
const { transformSync } = require('@babel/core');
const React = require('react');

const source = fs.readFileSync('src/Governance/GovernanceDirectory.tsx', 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const node = ast.program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'ScrollTop');
const code = transformSync(source.slice(node.start, node.end), {
  filename: 'ScrollTop.tsx', configFile: false, babelrc: false,
  presets: ['@babel/preset-typescript', '@babel/preset-react'],
}).code;
const ScrollTop = new Function('React', 'useScrollTrigger', 'Fade', 'Box', `${code}; return ScrollTop;`)(React, () => true, 'fade', 'box');

test('back-to-top scrolls the actual directory element to the start without navigating', () => {
  const calls = [];
  const topRef = { current: { scrollIntoView: options => calls.push(options) } };
  const button = ScrollTop({ topRef, children: React.createElement('button') });
  button.props.children.props.onClick();
  assert.deepEqual(calls, [{ block: 'start', behavior: 'auto' }]);
});

test('back-to-top tolerates an unmounted directory', () => {
  const button = ScrollTop({ topRef: { current: null } });
  assert.doesNotThrow(() => button.props.children.props.onClick());
});

test('directory wires its top element and button to the same ref', () => {
  const traverse = require('@babel/traverse').default;
  const refs = [];
  traverse(ast, {
    JSXOpeningElement({ node }) {
      for (const attr of node.attributes) {
        if (['ref', 'topRef'].includes(attr.name?.name) && attr.value?.expression?.name === 'topRef') {
          refs.push([node.name.name, attr.name.name]);
        }
      }
    },
  });
  assert.deepEqual(refs, [['Box', 'ref'], ['ScrollTop', 'topRef']]);
});
