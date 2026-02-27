import pako from 'pako';
import { GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import moment from "moment";

// Constants
const DEFAULT_HEADERS = {
    method: 'GET',
    headers: {},
};

// Utility to format bytes
export const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Generic function to fetch and decompress files
const fetchAndDecompressFile = async (url: string): Promise<any> => {
    try {
        const response = await window.fetch(url, DEFAULT_HEADERS);
        const compressed = await response.arrayBuffer();

        try {
            const decompressed = pako.inflate(new Uint8Array(compressed), { to: 'string' });
            return decompressed === "" ? {} : JSON.parse(decompressed);
        } catch (decompressionError) {
            console.error("Error decompressing file:", decompressionError);
            return null;
        }
    } catch (fetchError) {
        console.error("Error fetching file:", fetchError);
        return null;
    }
};

// Fetch governance lookup file
/*
export const fetchGovernanceLookupFile = async (storagePool: string): Promise<any> => {
    const url = `${GGAPI_STORAGE_URI}/${storagePool}/governance_lookup.json#${moment().unix()}`;
    return fetchAndDecompressFile(url);
};*/
// types are optional — adapt to your real shape

async function timeoutFetch(
  input: RequestInfo | URL,
  ms = 8000,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

// ===== helpers for legacy .txt =====
function sanitizeRaw(s: string): string {
  // Strip BOM if present and trim
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.trim();
}

// Accepts bare base64, or base64 wrapped in quotes or data URLs
function extractBase64Candidate(s: string): string | null {
  // If someone saved: export const X = "....";
  const quoted = s.match(/["'`]([A-Za-z0-9+/_=\s-]+)["'`]/);
  if (quoted?.[1]?.length > 64) s = quoted[1];

  // If someone pasted a data URL:
  const dataUrl = s.match(/base64,([A-Za-z0-9+/_= \s-]+)/);
  if (dataUrl?.[1]?.length > 64) s = dataUrl[1];

  // Allow URL-safe base64 and strip all non-base64 chars + whitespace
  s = s.replace(/[^A-Za-z0-9+/_=\\s-]/g, "").replace(/\s+/g, "");
  s = s.replace(/-/g, "+").replace(/_/g, "/");

  if (!s) return null;
  // Pad to multiple of 4
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);

  return s.length >= 64 ? s : null;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function looksLikeHex(s: string): boolean {
  const t = s.replace(/\s+/g, "");
  return t.length > 0 && /^[0-9a-fA-F]+$/.test(t) && t.length % 2 === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const t = hex.replace(/\s+/g, "");
  const out = new Uint8Array(t.length / 2);
  for (let i = 0; i < t.length; i += 2) out[i / 2] = parseInt(t.slice(i, i + 2), 16);
  return out;
}

// ===== fixed legacy loader (.txt holding base64 or hex of deflated JSON) =====
const legacyUrl = new URL('../Governance/api/legacy_lookup.txt', import.meta.url).toString();

export async function loadLegacyFromSrc(): Promise<any | null> {
  try {
    const url = legacyUrl + (legacyUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('legacy txt HTTP', res.status);
      return null;
    }

    const raw = sanitizeRaw(await res.text());
    if (!raw) return {};

    // Case 1: the file is just plain JSON (uncompressed)
    if (raw.startsWith('{') || raw.startsWith('[')) {
      const parsed = JSON.parse(raw);
      console.log("parsed",parsed);
      return parsed;
    }

    // Case 2: base64 of compressed bytes (preferred)
    let bytes: Uint8Array | null = null;
    const b64 = extractBase64Candidate(raw);
    if (b64) {
      try {
        bytes = b64ToBytes(b64);
      } catch {
        // fall through to hex attempt
      }
    }

    // Case 3: hex of compressed bytes
    if (!bytes) {
      if (!looksLikeHex(raw)) {
        console.error('legacy txt: not valid base64 or hex; cannot decode');
        return null;
      }
      bytes = hexToBytes(raw);
    }

    // Decompress — you generated with pako.deflate, so inflate first
    try {
      const jsonStr = pako.inflate(bytes, { to: 'string' }) as string;
      return jsonStr ? JSON.parse(jsonStr) : {};
    } catch (defErr) {
      // If you ever ship gzip instead
      try {
        const jsonStr = pako.ungzip(bytes, { to: 'string' }) as string;
        return jsonStr ? JSON.parse(jsonStr) : {};
      } catch (gzErr) {
        console.error('legacy txt: deflate & gzip both failed', { defErr, gzErr });
        return null;
      }
    }
  } catch (e) {
    console.error('loadLegacyFromSrc failed:', e);
    return null;
  }
}
/*
const legacyUrl = new URL('../Governance/api/legacy_lookup.txt', import.meta.url).toString();
// If you can, prefer a real binary file: '../Governance/api/legacy_lookup.deflate'

export async function loadLegacyFromSrc(): Promise<any | null> {
  return fetchAndDecompressFile(legacyUrl);
}
*/

// 2) Network fetch with safety (rejects HTML/CF error pages, 5s timeout)
async function fetchAndDecompressFileSafe(url: string, ms = 5000): Promise<any | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || ct.includes("text/html")) return null;

    const buf = new Uint8Array(await res.arrayBuffer());
    const isGzip = buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    const isZlib = buf.length >= 2 && buf[0] === 0x78 && (buf[1] === 0x9c || buf[1] === 0xda);

    if (isGzip) return JSON.parse(pako.ungzip(buf, { to: "string" }) || "{}");
    if (isZlib) return JSON.parse(pako.inflate(buf, { to: "string" }) || "{}");

    const text = new TextDecoder().decode(buf);
    if (text.trim().startsWith("<")) return null; // HTML guard
    return text ? JSON.parse(text) : {};
  } catch (e) {
    console.warn("fetchAndDecompressFileSafe failed:", e);
    return null;
  } finally {
    clearTimeout(id);
  }
}

function withCacheBust(u: string, v = Date.now().toString()): string {
  return u + (u.includes('?') ? '&' : '?') + 'v=' + v;
}

export const fetchGovernanceLookupFile = async (pool: string): Promise<any | null> => {
  // Try legacy first (since you’re testing it)
  const legacy = await loadLegacyFromSrc();
  if (legacy) return legacy;

  if (pool && GGAPI_STORAGE_URI) {
    const netUrlBase = `${GGAPI_STORAGE_URI}/${pool}/governance_lookup.json`;
    const netUrl = withCacheBust(netUrlBase);
    try {
      const net = await withTimeout(fetchAndDecompressFileSafe(netUrl), 5000);
      if (net) return net;
    } catch (e) {
      console.warn('network path failed/timeout', e);
    }
  }
  return null; // or {}
};

/*
// Fetch governance master members file
export const fetchGovernanceMasterMembersFile = async (storagePool: string): Promise<any> => {
    const url = `${GGAPI_STORAGE_URI}/${storagePool}/governance_mastermembers.json`;
    return fetchAndDecompressFile(url);
};*/

// Use this for mastermembers
export const fetchGovernanceMasterMembersFile = async (
  storagePool: string
): Promise<any | null> => {
  if (!GGAPI_STORAGE_URI || !storagePool) return null;
  const url = `${GGAPI_STORAGE_URI}/${storagePool}/governance_mastermembers.json`;
  return fetchAndDecompressFileSafe(url, 5000); // 5s cap
};

/*
// Generic function to fetch any lookup file
export const fetchLookupFile = async (fileName: string, storagePool: string): Promise<any> => {
    const url = `${GGAPI_STORAGE_URI}/${storagePool}/${fileName}`;
    return fetchAndDecompressFile(url);
};*/
// Generic function to fetch any lookup file (safe, with timeout)
export const fetchLookupFile = async (
  fileName: string,
  storagePool: string,
  ms = 5000
): Promise<any | null> => {
  if (!GGAPI_STORAGE_URI || !storagePool || !fileName) return null;
  const url = `${GGAPI_STORAGE_URI}/${storagePool}/${fileName}`;
  return fetchAndDecompressFileSafe(url, ms);
};

// Get file from lookup
export const getFileFromLookup = async (fileName: string, storagePool: string): Promise<any> => {
    return fetchLookupFile(fileName, storagePool);
};

// Load wallet key from a keypair file
export function loadWalletKey(keypair: string): Keypair {
    if (!keypair || keypair === "") {
        throw new Error("Keypair is required!");
    }

    try {
        const loaded = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(keypair).toString()))
        );
        return loaded;
    } catch (error) {
        console.error("Error loading wallet key:", error);
        throw error;
    }
}
