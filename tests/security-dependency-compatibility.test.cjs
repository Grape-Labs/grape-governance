const {test} = require('node:test');
const assert = require('node:assert/strict');

test('patched protobuf keeps schema, binary and JSON conversion compatible', () => {
  const protobuf = require('protobufjs');
  const root = protobuf.parse('syntax = "proto3"; message Vote { string owner = 1; uint64 weight = 2; map<string, uint32> choices = 3; }').root;
  const Vote = root.lookupType('Vote');
  const value = {owner: 'delegate', weight: '9007199254740993', choices: {approve: 100}};
  const decoded = Vote.decode(Vote.encode(Vote.fromObject(value)).finish());
  assert.deepEqual(Vote.toObject(decoded, {longs: String}), value);
  assert.equal(Vote.verify({owner: 123}), 'owner: string expected');
  assert.equal(typeof require('@grpc/proto-loader').loadSync, 'function');
});

test('patched Joi validates existing schema features', () => {
  const Joi = require('joi');
  const schema = Joi.object({at: Joi.string().isoDate().required(), recipients: Joi.string().email({multiple: true})});
  assert.equal(schema.validate({at: '2026-11-08T12:00:00Z', recipients: 'one@example.com,two@example.com'}).error, undefined);
  assert.ok(schema.validate({at: 'invalid'}).error);
});

test('patched forge verifies signatures and rejects modified messages', () => {
  const forge = require('node-forge');
  const keys = forge.pki.rsa.generateKeyPair({bits: 2048});
  const message = forge.md.sha256.create().update('governance');
  const signature = keys.privateKey.sign(message);
  assert.equal(keys.publicKey.verify(message.digest().bytes(), signature), true);
  assert.equal(keys.publicKey.verify(forge.md.sha256.create().update('modified').digest().bytes(), signature), false);
});

test('patched source maps preserve generated-to-original locations', () => {
  const {SourceMapGenerator, SourceMapConsumer} = require('source-map-js');
  const generator = new SourceMapGenerator({file: 'bundle.js'});
  generator.addMapping({generated: {line: 1, column: 0}, original: {line: 4, column: 2}, source: 'proposal.ts'});
  const consumer = new SourceMapConsumer(generator.toJSON());
  const original = consumer.originalPositionFor({line: 1, column: 0});
  assert.equal(original.source, 'proposal.ts');
  assert.equal(original.line, 4);
  assert.equal(original.column, 2);
});

test('Express parses compressed JSON, compresses responses, and rejects invalid or oversized bodies', async () => {
  const http = require('node:http');
  const {gzipSync, gunzipSync} = require('node:zlib');
  const express = require('express');
  const app = express();
  app.use(require('compression')({threshold: 0}));
  app.use(require('body-parser').json({limit: 256}));
  app.post('/', (req, res) => res.json({received: req.body, padding: 'x'.repeat(1500)}));
  app.use((error, req, res, next) => res.status(error.status || 500).json({error: error.type}));
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {server.once('error', reject);server.listen(0, '127.0.0.1', resolve);});
  const send = (body, compressed = false) => new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port: server.address().port, path: '/', method: 'POST', headers: {
      'content-type': 'application/json', 'accept-encoding': 'gzip', 'content-length': body.length,
      ...(compressed ? {'content-encoding': 'gzip'} : {}),
    }}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));res.on('error', reject);
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks);
          resolve({status: res.statusCode, encoding: res.headers['content-encoding'],
            body: JSON.parse((res.headers['content-encoding'] === 'gzip' ? gunzipSync(data) : data).toString())});
        } catch (error) {reject(error);}
      });
    });
    req.on('error', reject);req.end(body);
  });
  try {
    const response = await send(gzipSync(Buffer.from('{"vote":"approve"}')), true);
    assert.equal(response.status, 200);
    assert.equal(response.encoding, 'gzip');
    assert.deepEqual(response.body.received, {vote: 'approve'});
    assert.equal((await send(Buffer.from('{bad json}'))).status, 400);
    assert.equal((await send(Buffer.from(JSON.stringify({oversized: 'x'.repeat(1000)})))).status, 413);
    assert.equal((await send(Buffer.concat([gzipSync(Buffer.from('{}')), Buffer.from('trailing garbage')]), true)).status, 400);
  } finally {server.closeAllConnections();await new Promise(resolve => server.close(resolve));}
});
