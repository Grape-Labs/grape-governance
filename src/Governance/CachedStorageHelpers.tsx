import pako from 'pako';
import { GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { Keypair } from "@solana/web3.js";
import * as fs from "fs";
import moment from "moment";

export async function loadLegacyFromPublic(): Promise<any | null> {
  // adjust the path if you put it in a subfolder, e.g. /governance/legacy_lookup.deflate
  const url = `/legacy_lookup.deflate?v=${Date.now()}`; // cache-bust on updates
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn('loadLegacyFromPublic: HTTP', res.status);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    // Your blob looked like zlib/deflate (starts with 0x78 0x9C)
    const inflated = pako.inflate(bytes, { to: 'string' });
    return inflated ? JSON.parse(inflated) : {};
  } catch (e) {
    console.error('loadLegacyFromPublic failed:', e);
    return null;
  }
}

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

// Fetch governance master members file
export const fetchGovernanceMasterMembersFile = async (storagePool: string): Promise<any> => {
    const url = `${GGAPI_STORAGE_URI}/${storagePool}/governance_mastermembers.json`;
    return fetchAndDecompressFile(url);
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

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export const fetchGovernanceLookupFile = async (
  pool: string
): Promise<any | null> => {
  const url = pool
    ? `${GGAPI_STORAGE_URI}/${pool}/governance_lookup.json#${Date.now()}`
    : "";

  if (url) {
    try {
      // limit to 5 seconds
      const net = await withTimeout(fetchAndDecompressFile(url), 5000);
      if (net) return net;
    } catch (e) {
      if ((e as Error).message === "timeout") {
        console.warn("fetchGovernanceLookupFile: network fetch timed out");
      } else {
        console.error("fetchGovernanceLookupFile: fetch failed", e);
      }
    }
  }

  // fallback to local legacy copy
  return await loadLegacyFromPublic();
};

// Generic function to fetch any lookup file
export const fetchLookupFile = async (fileName: string, storagePool: string): Promise<any> => {
    const url = `${GGAPI_STORAGE_URI}/${storagePool}/${fileName}`;
    return fetchAndDecompressFile(url);
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