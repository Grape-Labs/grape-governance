"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeDecode = void 0;
const encodeDecode = (layout) => {
    const originalDecode = layout.decode.bind(layout);
    const decode = (buffer, offset = 0) => originalDecode(buffer, offset);
    const originalEncode = layout.encode.bind(layout);
    const encode = (value, buffer, offset = 0) => originalEncode(value, buffer, offset);
    return { decode, encode };
};
exports.encodeDecode = encodeDecode;
