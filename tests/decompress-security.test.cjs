const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { gzipSync } = require('node:zlib');

// Resolve exactly as the legacy download helper does.
const downloadRequire = createRequire(require.resolve('download'));
const decompress = downloadRequire('decompress');
const tar = require('tar-stream');

async function archive(entries) {
    const pack = tar.pack();
    const chunks = [];
    const collected = (async () => {
        for await (const chunk of pack) chunks.push(chunk);
        return gzipSync(Buffer.concat(chunks));
    })();
    for (const entry of entries) {
        pack.entry(entry, entry.type === 'symlink' ? undefined : 'safe content');
    }
    pack.finalize();
    return collected;
}

async function workspace(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'grape-decompress-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}

test('legacy CommonJS caller extracts tar.gz with strip and supports memory output', async t => {
    const root = await workspace(t);
    const input = await archive([{ name: 'repo/readme.txt' }]);
    const pending = decompress(input, root, { strip: 1 });
    assert.equal(typeof pending.then, 'function');
    await pending;
    assert.equal(await fs.readFile(path.join(root, 'readme.txt'), 'utf8'), 'safe content');
    const files = await decompress(input, { strip: 1 });
    assert.equal(files[0].path, 'readme.txt');
    assert.equal(files[0].data.toString(), 'safe content');
});

test('rejects symlink chains whose physical target escapes the output directory', async t => {
    const root = await workspace(t);
    const output = path.join(root, 'output');
    const outside = path.join(root, 'outside');
    await fs.mkdir(outside);
    await fs.writeFile(path.join(outside, 'sentinel'), 'unchanged');
    const input = await archive([
        { name: 'a', type: 'symlink', linkname: '.' },
        { name: 'b', type: 'symlink', linkname: 'a/../outside' },
    ]);
    await assert.rejects(decompress(input, output), /outside|escapes/);
    await assert.rejects(fs.lstat(path.join(output, 'b')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(outside, 'sentinel'), 'utf8'), 'unchanged');
});
