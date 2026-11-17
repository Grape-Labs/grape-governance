'use strict';
const {Buffer} = require('buffer');
function decode(bytes, littleEndian) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('Expected bytes');
  let value = BigInt(0);
  for (let i = 0; i < bytes.length; i++) value = (value << BigInt(8)) | BigInt(bytes[littleEndian ? bytes.length - 1 - i : i]);
  return value;
}
function encode(value, width, littleEndian) {
  if (typeof value !== 'bigint' || value < BigInt(0)) throw new RangeError('Expected an unsigned bigint');
  if (!Number.isSafeInteger(width) || width < 0 || width > 1048576) throw new RangeError('Invalid buffer width');
  if (value >= (BigInt(1) << (BigInt(width) * BigInt(8)))) throw new RangeError('Value exceeds buffer width');
  const bytes = Buffer.alloc(width);
  for (let i = 0; i < width; i++) {
    bytes[littleEndian ? i : width - 1 - i] = Number(value & BigInt(255));
    value >>= BigInt(8);
  }
  return bytes;
}
exports.toBigIntLE = bytes => decode(bytes, true);
exports.toBigIntBE = bytes => decode(bytes, false);
exports.toBufferLE = (value, width) => encode(value, width, true);
exports.toBufferBE = (value, width) => encode(value, width, false);
