const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:3100';
const realm = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
const proposal = 'GXXQU2JniSFa1QZqW2xRn3hwYoLFRhz83LjgR6VFVHK';
async function run() {
  for (const route of ['/', '/directory', `/dao/${realm}`, `/dao/${realm}?view=advanced`, `/council/${realm}`]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /__NEXT_DATA__/);
  }
  const health = await fetch(base + '/api/v1/health');
  assert.ok([200, 401, 503].includes(health.status), 'health route/auth handler');
  assert.match(health.headers.get('content-type'), /json/);
  assert.equal((await fetch(base + '/api/notifications-scan', {method: 'PUT'})).status, 405);
  assert.equal((await fetch(base + '/api/proposal-image?realm=bad&proposal=bad')).status, 400);
  assert.equal((await fetch(base + '/proposal/bad/bad')).status, 404);
  const redirect = await fetch(base + `/api/proposal-preview?realm=${realm}&proposal=${proposal}`, {redirect:'manual'});
  assert.equal(redirect.status,307);
  assert.equal(redirect.headers.get('location'), `/proposal/${realm}/${proposal}`);
  for (const prefix of ['proposal', 'embedproposal']) {
    const response = await fetch(`${base}/${prefix}/${realm}/${proposal}`);
    assert.equal(response.status,200);
    const html = await response.text();
    assert.ok(html.includes(`og:image`));
    assert.ok(html.includes(`/api/proposal-image?realm=${realm}`));
    assert.ok(html.includes('__NEXT_DATA__'));
  }
  assert.equal((await fetch(base + '/assets/missing-logo.svg')).status,404);
  const validImage = await fetch(`${base}/api/proposal-image?realm=${realm}&proposal=${proposal}`);
  assert.equal(validImage.status,200);
  assert.match(validImage.headers.get('content-type'),/image\/png/);
  assert.equal(Buffer.from(await validImage.arrayBuffer()).subarray(1,4).toString(),'PNG');
  const manifest = await (await fetch(base + '/manifest.webmanifest')).json();
  assert.ok(manifest.icons.every(icon => icon.src.startsWith('/assets/')));
  const worker = await fetch(base + '/serviceWorker.js');
  assert.equal(worker.status,200);
  assert.match(worker.headers.get('cache-control'),/no-cache/);
  assert.ok(!(await worker.text()).includes('process.env'));
  const image = await fetch(base + '/assets/governance-logo.svg');
  assert.equal(image.status,200);
  assert.match(image.headers.get('content-type'),/svg/);
  assert.match(await image.text(),/<svg/);
  console.log('Next production routes, APIs, proposal metadata, worker, manifest, and logo passed.');
}
run().catch(error => {console.error(error.message);process.exitCode=1;});
