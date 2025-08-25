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
export type GovernanceLookup = Record<string, unknown>;

let legacyCache: GovernanceLookup | null = null;

async function loadLegacy(): Promise<GovernanceLookup | null> {
  if (legacyCache) return legacyCache;
  try {
    // Works with either default or named exports
    const mod = await import('../Governance/api/legacy_lookup');
    legacyCache =
      (mod as any).default ??
      (mod as any).LEGACY_LOOKUP ??
      (mod as any).legacyLookup ??
      (mod as any).lookup ??
      (mod as any);
    return legacyCache;
  } catch (e) {
    console.error('fetchGovernanceLookupFile: failed to load legacy_lookup', e);
    return null;
  }
}

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

export const fetchGovernanceLookupFile = async (
  storagePool: string
): Promise<GovernanceLookup | null> => {
  // Build URL. If you intentionally leave it empty, we’ll skip to legacy.
  const url =
    storagePool
      ? `${GGAPI_STORAGE_URI}/${storagePool}/governance_lookup.json#${Date.now()}`
      : '';

  // If URL is falsy, go straight to the legacy file.
  if (!url) {
    return await loadLegacy();
  }

  try {
    const res = await timeoutFetch(url, 8000);
    if (!res.ok) {
      console.warn(
        `fetchGovernanceLookupFile: HTTP ${res.status} for ${url}`
      );
      return await loadLegacy();
    }

    // Protect against bad JSON
    try {
      const data = (await res.json()) as GovernanceLookup;
      return data ?? (await loadLegacy());
    } catch (jsonErr) {
      console.warn('fetchGovernanceLookupFile: invalid JSON, using legacy', jsonErr);
      return await loadLegacy();
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('fetchGovernanceLookupFile: request timed out');
    } else {
      console.error('fetchGovernanceLookupFile: fetch failed', err);
    }
    return await loadLegacy();
  }
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