const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');

test('pure bigint layouts round-trip exact unsigned values in CJS and ESM',async()=>{
 const cjs=require('@solana/buffer-layout-utils');
 const esm=await import('@solana/buffer-layout-utils');
 for(const layouts of [cjs,esm]) for(const [name,bits] of [['u64',64],['u128',128],['u192',192],['u256',256]]) {
  const layout=layouts[name]();
  for(const value of [0n,1n,(1n<<BigInt(bits))-1n]) {
   const buffer=Buffer.alloc(bits/8);assert.equal(layout.encode(value,buffer),bits/8);assert.equal(layout.decode(buffer),value);
  }
  assert.throws(()=>layout.encode(-1n,Buffer.alloc(bits/8)),RangeError);
  assert.throws(()=>layout.encode(1n<<BigInt(bits),Buffer.alloc(bits/8)),RangeError);
 }
 const codec=require('../vendor/buffer-layout-utils/bigint-codec.cjs');
 assert.equal(codec.toBigIntLE(Buffer.alloc(10000,255)),(1n<<80000n)-1n);
 assert.deepEqual(codec.toBufferBE(0x1234n,2),Buffer.from([0x12,0x34]));
 assert.throws(()=>codec.toBufferLE(1n,-1),RangeError);
});
test('Solana SDKs retain transaction, key and SPL token encoding compatibility',()=>{
 const web3=require('@solana/web3.js');
 const treasury=web3.Keypair.generate(),recipient=web3.Keypair.generate().publicKey;
 const tx=new web3.Transaction({recentBlockhash:web3.Keypair.generate().publicKey.toBase58(),feePayer:treasury.publicKey}).add(web3.SystemProgram.transfer({fromPubkey:treasury.publicKey,toPubkey:recipient,lamports:1234567}));
 tx.sign(treasury);assert.equal(tx.verifySignatures(),true);
 const decoded=web3.Transaction.from(tx.serialize());assert.equal(web3.SystemInstruction.decodeTransfer(decoded.instructions[0]).lamports,1234567n);
 const spl=require('@solana/spl-token'); const legacy=require('@solana/spl-token-v2');
 for(const sdk of [spl,legacy]) {
  const ix=sdk.createTransferInstruction(recipient,recipient,treasury.publicKey,9007199254740993n);
  assert.ok(Buffer.from(ix.data).includes(Buffer.from('0100000000002000','hex')));
 }
 assert.equal(typeof require('@solana/spl-governance').withExecuteTransaction,'function');
});
test('patched cryptographic and process dependencies preserve expected APIs',()=>{
 const pbkdf2=require('pbkdf2');
 assert.deepEqual(pbkdf2.pbkdf2Sync('password','salt',2,32,'sha256'),crypto.pbkdf2Sync('password','salt',2,32,'sha256'));
 const {ec:EC}=require('elliptic');const ec=new EC('secp256k1');const key=ec.keyFromPrivate('01');const hash=crypto.createHash('sha256').update('proposal').digest();const signature=key.sign(hash);assert.equal(key.verify(hash,signature),true);
 const secp=require('tiny-secp256k1');const secret=Buffer.alloc(32);secret[31]=1;const publicKey=secp.pointFromScalar(secret);const signed=secp.sign(hash,secret);assert.equal(secp.verify(hash,publicKey,signed),true);
 assert.equal(require('cross-spawn').sync(process.execPath,['-e','process.exit(0)']).status,0);
 const temporary=require('tmp').dirSync({unsafeCleanup:true});temporary.removeCallback();
});
test('patched tar extracts normal files and rejects traversal entries',async()=>{
 const os=require('node:os');const path=require('node:path');const {Readable}=require('node:stream');const {pipeline}=require('node:stream/promises');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'grape-security-tar-'));const destination=path.join(root,'extract');fs.mkdirSync(destination);
 try {
  const pack=require('tar-stream').pack();const chunks=[];pack.on('data',chunk=>chunks.push(chunk));
  const ready=new Promise((resolve,reject)=>{pack.on('end',resolve);pack.on('error',reject);});
  pack.entry({name:'safe.txt'},'safe');pack.entry({name:'../escaped.txt'},'blocked');pack.finalize();await ready;
  const warnings=[];
  await pipeline(Readable.from(Buffer.concat(chunks)),require('tar').x({cwd:destination,onwarn:code=>warnings.push(code)}));
  assert.equal(fs.readFileSync(path.join(destination,'safe.txt'),'utf8'),'safe');assert.equal(fs.existsSync(path.join(root,'escaped.txt')),false);assert.ok(warnings.length>0);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('upgraded glob keeps npm tooling matching and abort handling compatible',async()=>{
 const path=require('node:path');const parent=path.dirname(require.resolve('cacache/package.json'));
 const glob=require(require.resolve('glob',{paths:[parent]}));
 const files=glob.globSync('tests/*security*.cjs');assert.ok(files.includes('tests/security-crypto-layout.test.cjs'));
 const controller=new AbortController();controller.abort(new Error('cancelled'));
 await assert.rejects(glob.glob('**/*',{cwd:'vendor',signal:controller.signal}),/cancelled/);
});
