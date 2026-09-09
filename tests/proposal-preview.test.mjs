import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PublicKey } from '@solana/web3.js';
const realm = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
const proposal = 'GXXQU2JniSFa1QZqW2xRn3hwYoLFRhz83LjgR6VFVHK';
const owner = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
let fail = false;
let wrongRealm = false;
mock.module('@solana/spl-governance', { namedExports: {
  ProposalState: { 0: 'Draft' },
  getProposal: async () => {
    if (fail) throw new Error('RPC unavailable');
    return { owner, account: { name: 'Approve <GRIP> & "August"', state: 0, governance: owner } };
  },
  getRealm: async () => ({ owner, account: { name: 'Grape' } }),
  getGovernance: async () => ({ owner, account: { realm: wrongRealm ? owner : new PublicKey(realm) } }),
} });
const {parseProposalRequest, loadProposalPreview, injectPreview, cacheControl} = await import('../src/server/social/proposal.js');
const {renderProposalImage} = await import('../src/server/social/proposal-image.js');

test('validates direct and rewritten proposal URLs, rejects malformed or repeated keys', () => {
  assert.deepEqual(parseProposalRequest({url:`/proposal/${realm}/${proposal}`}), {realm,proposal});
  assert.deepEqual(parseProposalRequest({url:'/api/proposal-preview',query:{realm,proposal}}), {realm,proposal});
  assert.throws(()=>parseProposalRequest({url:'/api/proposal-image',query:{realm,proposal:['a','b']}}));
  assert.throws(()=>parseProposalRequest({url:'/proposal/<script>/bad'}));
});

test('new draft metadata replaces generic tags, escapes content and keeps app assets', async () => {
  const preview = await loadProposalPreview({realm,proposal}, {});
  assert.equal(preview.state, 'Draft');
  assert.equal(preview.available, true);
  const shell='<html><head><helmet><title>Generic</title><meta property="og:title" content="Generic"><meta name="twitter:image" content="old.png"></helmet><script src="/app.js"></script></head><body><div id="app"></div></body></html>';
  const html=injectPreview(shell,preview);
  assert.equal((html.match(/property="og:title"/g)||[]).length,1);
  assert.equal((html.match(/<title>/g)||[]).length,1);
  assert.ok(html.includes('Approve &lt;GRIP&gt; &amp; &quot;August&quot;'));
  assert.ok(html.includes('Draft proposal in Grape'));
  assert.ok(html.includes(`/api/proposal-image?realm=${realm}&amp;proposal=${proposal}`));
  assert.ok(html.includes('<script src="/app.js"></script>'));
  assert.ok(html.includes('<div id="app"></div>'));
  assert.ok(!html.includes('old.png'));
});

test('RPC errors and mismatched DAO never produce cached successful metadata', async () => {
  fail=true;
  assert.equal(cacheControl(await loadProposalPreview({realm,proposal},{})), 'no-store');
  fail=false;
  wrongRealm=true;
  assert.equal((await loadProposalPreview({realm,proposal},{})).available,false);
  wrongRealm=false;
});

test('generates a 1200 x 630 PNG including long titles', async () => {
  const image=renderProposalImage({realm,proposal,title:'Proposal title '.repeat(30),dao:'Grape DAO',state:'Draft'});
  const buffer=Buffer.from(await image.arrayBuffer());
  assert.equal(buffer.subarray(1,4).toString(),'PNG');
  assert.equal(buffer.readUInt32BE(16),1200);
  assert.equal(buffer.readUInt32BE(20),630);
});

test('Vercel serves proposal metadata before SPA fallback and bundles built HTML', async () => {
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.functions['api/proposal-preview.js'].includeFiles,'dist/index.html');
  assert.equal(config.rewrites[0].source,'/proposal/:realm/:proposal');
  assert.equal(config.rewrites[1].source,'/embedproposal/:realm/:proposal');
});

test('image endpoint serves PNG bytes and uncached fallback; invalid keys return 400', async () => {
  const {default: handler}=await import('../api/proposal-image.js');
  const response = () => ({
    headers: {}, statusCode: 200,
    setHeader(key,value) { this.headers[key]=value; },
    status(code) { this.statusCode=code; return this; },
    send(body) { this.body=body; return this; },
  });
  const res=response();
  await handler({url:'/api/proposal-image',query:{realm,proposal}},res);
  assert.equal(res.headers['Content-Type'],'image/png');
  assert.equal(res.body.subarray(1,4).toString(),'PNG');
  assert.ok(res.headers['Cache-Control'].includes('s-maxage=60'));
  fail=true;
  const fallback=response();
  await handler({url:'/api/proposal-image',query:{realm,proposal}},fallback);
  assert.equal(fallback.headers['Cache-Control'],'no-store');
  fail=false;
  const invalid=response();
  await handler({url:'/api/proposal-image',query:{realm,proposal:'invalid'}},invalid);
  assert.equal(invalid.statusCode,400);
});
