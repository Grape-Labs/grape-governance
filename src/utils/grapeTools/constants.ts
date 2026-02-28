import { Connection } from '@solana/web3.js';
import STATIC_LOGO from '../../public/governance-logo.svg';
import STATIC_CREATOR_LOGO from '../../public/Element_46x.png';
import FRICTIONLESS_ASSET_1 from '../../public/isolated_graphic_frictionless.jpeg';
import FRICTIONLESS_LOGO_ASSET from '../../public/frictionless_logo.png';
import GIST_BANNER_ASSET from '../../public/gist_banner.png';
import APP_ICON_ASSET from '../../public/icon.png';
import GRAPE_LOGO_ASSET from '../../public/apple-grape-touch-icon.png';
import VINE_LOGO_ASSET from '../../public/vine.jpg';
export const FRICTIONLESS_LOGO = FRICTIONLESS_LOGO_ASSET;
export const FRICTIONLESS_BG = FRICTIONLESS_ASSET_1;
export const GIST_LOGO = GIST_BANNER_ASSET;
export const APP_LOGO = STATIC_LOGO;
export const APP_ICON = APP_ICON_ASSET;
export const GRAPE_LOGO = GRAPE_LOGO_ASSET;
export const CREATOR_LOGO = STATIC_CREATOR_LOGO;
export const VINE_LOGO = VINE_LOGO_ASSET;
export const TX_RPC_ENDPOINT = process.env.REACT_APP_API_TX_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const QUICKNODE_RPC_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT;
export const QUICKNODE_RPC_DEVNET_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_DEVNET_ENDPOINT;
export const HELIUS_RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key='+process.env.REACT_APP_API_HELIUS;
export const HELIUS_RPC_DEVNET_ENDPOINT = 'https://devnet.helius.xyz/?api-key='+process.env.REACT_APP_API_HELIUS;
export const ALCHEMY_RPC_ENDPOINT = process.env.REACT_APP_API_ALCHEMY_RPC_ENDPOINT;
export const ALCHEMY_RPC_DEVNET_ENDPOINT = process.env.REACT_APP_API_ALCHEMY_RPC_DEVNET_ENDPOINT;
export const HELLO_MOON_BEARER = process.env.REACT_APP_API_HELLOMOON_API_KEY;
export const HELLO_MOON_ENDPOINT = HELLO_MOON_BEARER ? `https://rpc.hellomoon.io/${HELLO_MOON_BEARER}` : null;
export const HELLO_MOON_DEVNET_ENDPOINT = HELLO_MOON_BEARER ? `https://rpc-devnet.hellomoon.io/${HELLO_MOON_BEARER}` : null;
export const SHYFT_KEY = process.env.REACT_APP_API_SHYFT_KEY;
export const FLUX_RPC_ENDPOINT = process.env.REACT_APP_API_FLUX_RPC_ENDPOINT || null;
export const SHYFT_RPC_ENDPOINT = SHYFT_KEY ? `https://rpc.shyft.to?api_key=${SHYFT_KEY}` : null;
export const SHYFT_RPC_DEVNET_ENDPOINT = SHYFT_KEY ? `https://devnet-rpc.shyft.to?api_key=${SHYFT_KEY}` : null;
export type AppCluster = 'mainnet' | 'devnet';

const DEFAULT_RPC_ENDPOINTS: Record<AppCluster, string> = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
};

const DEFAULT_WS_ENDPOINTS: Record<AppCluster, string> = {
  mainnet: 'wss://api.mainnet-beta.solana.com',
  devnet: 'wss://api.devnet.solana.com',
};

const PREFERRED_CLUSTER_STORAGE_KEY = 'preferred_cluster';
const LEGACY_PREFERRED_RPC_STORAGE_KEY = 'preferred_rpc';
const PREFERRED_RPC_STORAGE_KEYS: Record<AppCluster, string> = {
  mainnet: 'preferred_rpc_mainnet',
  devnet: 'preferred_rpc_devnet',
};

const normalizeCluster = (value: string | null | undefined): AppCluster => {
  const normalized = String(value || '').toLowerCase();
  return normalized === 'devnet' ? 'devnet' : 'mainnet';
};

const getLocalStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const RPC_OPTIONS_BY_CLUSTER: Record<AppCluster, Record<string, string | null | undefined>> = {
  mainnet: {
    QUICKNODE: QUICKNODE_RPC_ENDPOINT,
    ALCHEMY: ALCHEMY_RPC_ENDPOINT,
    SHYFT: SHYFT_RPC_ENDPOINT,
    HELLO_MOON: HELLO_MOON_ENDPOINT,
    HELIUS: HELIUS_RPC_ENDPOINT,
    FLUX: FLUX_RPC_ENDPOINT,
  },
  devnet: {
    QUICKNODE: QUICKNODE_RPC_DEVNET_ENDPOINT,
    ALCHEMY: ALCHEMY_RPC_DEVNET_ENDPOINT,
    SHYFT: SHYFT_RPC_DEVNET_ENDPOINT,
    HELLO_MOON: HELLO_MOON_DEVNET_ENDPOINT,
    HELIUS: HELIUS_RPC_DEVNET_ENDPOINT,
  },
};

const BLOCKED_RPC_SUFFIXES = ['genesysgo.net'];

const isBlockedRpcHost = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BLOCKED_RPC_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
};

const isUsableRpcUrl = (url: string | null | undefined): url is string => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  if (isBlockedRpcHost(trimmed)) return false;
  return true;
};

const getRpcStorageKey = (cluster: AppCluster): string => PREFERRED_RPC_STORAGE_KEYS[cluster];

const getRpcOptionsForCluster = (cluster: AppCluster): Record<string, string | null | undefined> =>
  RPC_OPTIONS_BY_CLUSTER[cluster];

const ENV_CLUSTER = normalizeCluster(process.env.REACT_APP_SOLANA_CLUSTER);

export const getPreferredCluster = (): AppCluster => {
  const storage = getLocalStorage();
  const stored = storage?.getItem(PREFERRED_CLUSTER_STORAGE_KEY);
  const selected = normalizeCluster(stored || ENV_CLUSTER);

  if (storage && stored !== selected) {
    storage.setItem(PREFERRED_CLUSTER_STORAGE_KEY, selected);
  }

  return selected;
};

export const setPreferredCluster = (cluster: AppCluster) => {
  const storage = getLocalStorage();
  if (!storage) return;
  storage.setItem(PREFERRED_CLUSTER_STORAGE_KEY, normalizeCluster(cluster));
};

export const APP_CLUSTER: AppCluster = getPreferredCluster();

export const getPreferredRpc = (cluster: AppCluster = APP_CLUSTER) => {
  const storage = getLocalStorage();
  const rpcStorageKey = getRpcStorageKey(cluster);
  const preferred =
    storage?.getItem(rpcStorageKey) ||
    (cluster === 'mainnet' ? storage?.getItem(LEGACY_PREFERRED_RPC_STORAGE_KEY) : null);
  const clusterRpcOptions = getRpcOptionsForCluster(cluster);
  const candidates = [
    preferred,
    clusterRpcOptions.QUICKNODE,
    clusterRpcOptions.ALCHEMY,
    clusterRpcOptions.SHYFT,
    clusterRpcOptions.HELLO_MOON,
    clusterRpcOptions.HELIUS,
    clusterRpcOptions.FLUX,
    DEFAULT_RPC_ENDPOINTS[cluster],
  ];

  const selected = candidates.find((candidate) => isUsableRpcUrl(candidate));
  if (!selected) return DEFAULT_RPC_ENDPOINTS[cluster];

  // Self-heal stale/blocked stored preference per cluster.
  if (storage && preferred && preferred !== selected) {
    storage.setItem(rpcStorageKey, selected);
    if (cluster === 'mainnet') {
      storage.setItem(LEGACY_PREFERRED_RPC_STORAGE_KEY, selected);
    }
  }

  return selected;
};

export const setPreferredRpc = (url: string, cluster: AppCluster = APP_CLUSTER) => {
  const storage = getLocalStorage();
  if (!storage) return;
  const rpcStorageKey = getRpcStorageKey(cluster);

  if (!isUsableRpcUrl(url)) {
    storage.removeItem(rpcStorageKey);
    if (cluster === 'mainnet') {
      storage.removeItem(LEGACY_PREFERRED_RPC_STORAGE_KEY);
    }
    return;
  }
  storage.setItem(rpcStorageKey, url);
  if (cluster === 'mainnet') {
    storage.setItem(LEGACY_PREFERRED_RPC_STORAGE_KEY, url);
  }
};

export const RPC_OPTIONS = getRpcOptionsForCluster(APP_CLUSTER);
export const RPC_MAINNET_ENDPOINT = getPreferredRpc('mainnet');
export const RPC_DEVNET_ENDPOINT = getPreferredRpc('devnet');
export const RPC_ENDPOINT = getPreferredRpc(APP_CLUSTER);
export const WS_ENDPOINT =
  RPC_ENDPOINT && /^https?:\/\//i.test(RPC_ENDPOINT)
    ? RPC_ENDPOINT.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://')
    : DEFAULT_WS_ENDPOINTS[APP_CLUSTER];
export const ALCHEMY_ETH_KEY = process.env.REACT_APP_API_ALCHEMY_ETH || null;
export const WALLET_CONNECT_PROJECT_ID = process.env.REACT_APP_API_WALLET_CONNECT_PROJECT_ID || null;
export const DYNAMICXYZ_KEY = process.env.REACT_APP_API_DYNAMICXYZ_KEY || null;
export const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';

export const RPC_CONNECTION = new Connection(
    RPC_ENDPOINT, 'confirmed'
);
export const RPC_DEVNET_CONNECTION = new Connection(
    RPC_DEVNET_ENDPOINT, 'confirmed'
);

export const DEFAULT_PRIORITY_RATE = 20000; // Medium Level microLamport Fee Rate
export const DEFAULT_MAX_PRIORITY_RATE = 1000000; // Medium Level microLamport Fee Rate

export const MAILGUN_KEY = process.env.REACT_APP_API_MAILGUN_KEY || null;
export const MAILGUN_DOMAIN = process.env.REACT_APP_API_MAILGUN_DOMAIN || null;
export const ME_API = process.env.REACT_APP_API_ME || null;
export const ME_KEYBASE = process.env.REACT_APP_API_ME_KEYBASE || null;
export const SOFLARE_NOTIFICATIONS_API_KEY = process.env.REACT_APP_API_KEY_SOLFLARE_NOTIFICATIONS || '';
export const PROXY = process.env.REACT_APP_API_PROXY || '';
export const CLOUDFLARE_IPFS_CDN = 'https://cloudflare-ipfs.com';
export const HELIUS_API = process.env.REACT_APP_API_HELIUS || null;
export const TWITTER_PROXY = process.env.REACT_APP_API_TWITTER_PROXY || null;
export const GGAPI_STORAGE_POOL = process.env.REACT_APP_API_GGAPI_STORAGE_POOL || "EwMD4x7m2Hsay5KfyFwuDMUPtnvw4XmRFYhByorwdkL4";
export const GGAPI_STORAGE_URI = (process.env.REACT_APP_API_GGAPI_STORAGE_URI || '').trim();
export const APP_WHITELIST = process.env.REACT_APP_API_WHITELIST || null;
export const APP_GOVERNANCEPROPWHITELIST = process.env.REACT_APP_API_GOVERNANCEPROPWHITELIST || null;

export const APP_EXTENSION_LULU = process.env.REACT_APP_API_EXTENSION_LULU || null;

export const APP_GITHUB_CLIENT_ID = process.env.APP_GITHUB_CLIENT_ID || null;

export const PRIMARY_STORAGE_WALLET = process.env.REACT_APP_API_PRIMARY_STORAGE_WALLET || null;
export const SECONDARY_STORAGE_WALLET = process.env.REACT_APP_API_SECONDARY_STORAGE_WALLET || null;
export const TERTIARY_STORAGE_WALLET = process.env.REACT_APP_API_TERTIARY_STORAGE_WALLET || null;
export const FRICTIONLESS_WALLET = process.env.REACT_APP_API_FRICTIONLESS_WALLET || null;

export const PROP_TOKEN = process.env.REACT_APP_API_PROP_TOKEN || "5Hb1JX2H85yBua97USwJYJH5pURUVirL2s3WBpp3QGfV";
export const METRICS_TOKEN = process.env.REACT_APP_API_METRICS_TOKEN || "CmtdUmxdML91oNUGj4qiEnWffcYibfUJPCJwaPkhWogc";
export const ADMIN_TOKEN = process.env.REACT_APP_API_METRICS_TOKEN || "CmtdUmxdML91oNUGj4qiEnWffcYibfUJPCJwaPkhWogc";

export const BLACKLIST_WALLETS = ["4nd2Ryy5asxoBdXiZsd8JKzRhZ1RdSaNCxADNSF3KaRT", "GZCxBgjj1mSsixBss2bdLHvqEGncDTY3KuvzBs4Q8q5R", "CLJZf8tTqVxcet3QbBZa7Sroyhhj3BUBdXp7pDR7dpgH", "HnsSGWY4f3HdA9a23WZbheF2HHrzwtr3Unyyv92w6nWB"];
