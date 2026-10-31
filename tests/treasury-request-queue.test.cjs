const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
const Module = require('node:module');
const filename = require('node:path').resolve('src/Governance/Treasury/requestQueue.ts');
const loaded = new Module(filename, module);
loaded._compile(transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, configFile: false, babelrc: false,
    presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code, filename);
const { createTreasuryRequestQueue } = loaded.exports;

test('nine wallets share a paced queue; overlapping calls and successful results are reused', async () => {
    const request = createTreasuryRequestQueue(8);
    let active = 0, maxActive = 0, calls = 0;
    const starts = [];
    const fetchValue = async () => {
        calls++;
        starts.push(Date.now());
        maxActive = Math.max(maxActive, ++active);
        await new Promise(resolve => setTimeout(resolve, 2));
        active--;
        return 42;
    };
    const jobs = Array.from({ length: 54 }, (_, i) => request(String(i), fetchValue));
    jobs.push(request('0', fetchValue));
    assert.deepEqual(await Promise.all(jobs), Array(55).fill(42));
    assert.equal(await request('0', fetchValue), 42);
    assert.equal(calls, 54);
    assert.equal(maxActive, 1);
    assert.ok(starts.at(-1) - starts[0] >= 53 * 7);
});

test('failed reads are not cached and do not block subsequent wallets', async () => {
    const request = createTreasuryRequestQueue(0);
    await assert.rejects(request('failed', async () => { throw Error('offline'); }), /offline/);
    assert.equal(await request('next', async () => 7), 7);
    assert.equal(await request('failed', async () => 9), 9);
});

test('expired balances are refreshed', async () => {
    const request = createTreasuryRequestQueue(0, 1);
    assert.equal(await request('wallet', async () => 1), 1);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(await request('wallet', async () => 2), 2);
});

test('429 retries hold the shared queue until recovery', async () => {
    const request = createTreasuryRequestQueue(0);
    const events = [];
    let attempts = 0;
    const first = request('limited', async () => {
        events.push('limited');
        if (++attempts === 1) throw Error('HTTP 429');
        return 1;
    });
    const second = request('next', async () => { events.push('next'); return 2; });
    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepEqual(events, ['limited', 'limited', 'next']);
});
