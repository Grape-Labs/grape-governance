const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
let sdk;
const ready = import('../node_modules/@grapenpm/vine-reputation-client/dist/index.mjs').then(value => { sdk = value; });
const { PublicKey } = require('@solana/web3.js');
const mod = { exports: {} };
let decode;
const loaded = ready.then(() => {
new Function('require', 'module', 'exports', transformSync(fs.readFileSync('src/Governance/ogReputationInstructions.ts', 'utf8'), {
 filename: 'ogReputationInstructions.ts', configFile: false, babelrc: false,
 presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code)(name => name === '@grapenpm/vine-reputation-client' ? sdk : name === 'buffer' ? require('buffer/') : require(name), mod, mod.exports);
decode = mod.exports.describeOgReputationInstruction;
});
const key = new PublicKey('11111111111111111111111111111111');
test('decodes real SDK initialization and administrative instructions', async () => {
 await loaded;
 const args = { daoId: key, authority: key, payer: key, repMint: key, initialSeason: 7 };
 const ix = await sdk.buildInitializeConfigIx(args);
 assert.match((await decode(ix)).description, /season 7 and authority/);
 for (const [builder, extra, pattern] of [
  ['buildSetAuthorityIx', { newAuthority: key }, /Transfer control/],
  ['buildSetSeasonIx', { newSeason: 8 }, /season 8/],
  ['buildSetDecayBpsIx', { decayBps: 125 }, /1.25%/],
  ['buildSetRepMintIx', { newRepMint: key }, /Change REP mint/],
  ['buildUpsertProjectMetadataIx', { metadataUri: 'https://example.org/profile.json' }, /https:\/\/example.org\/profile.json/],
 ]) assert.match((await decode(await sdk[builder]({ ...args, ...extra }))).description, pattern);
});
test('shows exact u64 total rather than interpreting it as an increment', async () => {
 await loaded;
 const data = Buffer.alloc(16);
 data.set(await sdk.ixDiscriminator('addReputation'));
 data.writeBigUInt64LE(18446744073709551615n, 8);
 const info = await decode({ data, accounts: Array.from({length: 6}, () => ({pubkey: key})) });
 assert.match(info.description, /Set reputation total to 18446744073709551615/);
 assert.match(info.description, /stored total/);
});
test('unknown and truncated data stay reviewable without guessing', async () => {
 await loaded;
 const ix = await sdk.buildSetSeasonIx({ daoId: key, authority: key, newSeason: 3 });
 ix.data = ix.data.subarray(0, 9);
 assert.match((await decode(ix)).description, /malformed/);
 assert.match((await decode({data: Buffer.alloc(8)})).description, /Unrecognized/);
});

test('browser Buffer decodes real SDK point totals without Node-only methods', async () => {
 await loaded;
 const browserBuffer = require('buffer/').Buffer;
 assert.equal(typeof browserBuffer.alloc(8).readBigUInt64LE, 'undefined');
 // Reproduce the on-chain instruction format with browser Buffers and indexed account records.
 const data = browserBuffer.alloc(16);
 data.set(await sdk.ixDiscriminator('addReputation'));
 data.set([255,255,255,255,255,255,255,255], 8);
 const info = await decode({ data, accounts: Array.from({length:6}, () => ({pubkey:key.toBase58()})) });
 assert.equal(info.op, 'addReputation');
 assert.match(info.description, /18446744073709551615 points/);
});
