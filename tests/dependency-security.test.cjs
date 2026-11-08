const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const semver = require('semver');
const lock = fs.readFileSync('yarn.lock', 'utf8');
const entries = lock.split('\n\n').flatMap(block => {
  const name = block.match(/^"?(@?[^@\s",]+(?:\/[^@\s",]+)?)@/);
  const version = block.match(/^  version "([^"]+)"/m);
  return name && version ? [{ name: name[1], version: version[1] }] : [];
});
test('reported vulnerable dependencies stay patched or absent', () => {
  const ranges = {
    protobufjs: '<7.6.6', joi: '<17.13.9', 'node-forge': '<1.4.3',
    'body-parser': '<1.20.9', 'source-map-js': '<1.2.2', compression: '<1.8.2',
    'node-fetch': '<2.6.7', got: '<11.8.5', 'git-clone': '*', taffydb: '*', ip: '*',
    'decode-uri-component': '<0.5.1', jsonwebtoken: '<9.0.0', json5: '>=2 <2.2.2',
    luxon: '>=2 <2.5.2', '@sideway/formula': '<3.0.1', webpack: '>=5 <5.112.2',
    'tough-cookie': '<4.1.3', semver: '>=7 <7.5.2 || >=6 <6.3.1 || >=2 <5.7.2',
    'word-wrap': '<1.2.4', '@adobe/css-tools': '<4.3.1', graphql: '>=16.3 <16.8.1',
    'get-func-name': '<2.0.1', postcss: '<8.5.23', '@babel/traverse': '<7.23.2',
    'crypto-js': '<4.2.0', 'browserify-sign': '<4.2.2', undici: '<6.29.1',
    'follow-redirects': '<1.16.2', axios: '<1.21.0', 'es5-ext': '<0.10.63', jose: '<2.0.7',
  };
  for (const {name, version} of entries) {
    if (ranges[name]) assert.equal(semver.satisfies(version, ranges[name]), false, `${name}@${version}`);
  }
});
test('CommonJS decoder handles valid, malformed, and adversarial input', {timeout: 3000}, () => {
  const decode = require('../vendor/decode-uri-component/index.cjs');
  assert.equal(decode('%E2%9C%93'), '✓');
  assert.equal(decode('%FF%41'), '%FFA');
  assert.equal(decode('%C2'), '\uFFFD');
  assert.equal(decode('%FF'.repeat(20000)), '%FF'.repeat(20000));
  assert.equal(decode('%25FF'.repeat(20000)), '%FF'.repeat(20000));
  assert.throws(() => decode(null), TypeError);
  assert.equal(require('query-string').parse('title=%E2%9C%93').title, '✓');
});

test('updated authentication and HTTP dependencies retain expected APIs', async () => {
  const {generateKeyPairSync} = require('node:crypto');
  const jwt = require('jsonwebtoken');
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const token = jwt.sign({sub: 'security-regression'}, privateKey, {algorithm: 'RS256'});
  assert.equal(jwt.verify(token, publicKey, {algorithms: ['RS256']}).sub, 'security-regression');
  assert.throws(() => jwt.verify(token, publicKey, {algorithms: ['HS256']}));
  assert.equal(typeof require('firebase-admin').initializeApp, 'function');
  assert.equal(typeof require('jose').JWT.verify, 'function');
  assert.equal(typeof require('@discordjs/rest').REST, 'function');
  const {MockAgent, request} = require('undici');
  const dispatcher = new MockAgent();
  dispatcher.disableNetConnect();
  dispatcher.get('https://security.invalid').intercept({path: '/'}).reply(200, 'ok');
  try {
    const response = await request('https://security.invalid/', {dispatcher});
    assert.equal(await response.body.text(), 'ok');
  } finally {
    await dispatcher.close();
  }
  const axios = require('axios');
  const response = await axios.get('https://security.invalid/', {adapter: async config => ({
    config, status: 200, statusText: 'OK', headers: {}, data: 'ok',
  })});
  assert.equal(response.data, 'ok');
});
