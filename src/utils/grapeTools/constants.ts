import STATIC_LOGO from '../../public/grape_white_logo.svg';

export const TX_RPC_ENDPOINT = process.env.REACT_APP_API_TX_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const GRAPE_RPC_ENDPOINT = process.env.REACT_APP_API_GRAPE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const QUICKNODE_RPC_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const SOFLARE_NOTIFICATIONS_API_KEY = process.env.REACT_APP_API_KEY_SOLFLARE_NOTIFICATIONS || '';
export const PROXY = '';//process.env.REACT_APP_API_PROXY || '';
export const CLOUDFLARE_IPFS_CDN = 'https://cloudflare-ipfs.com';
export const HELIUS_API = process.env.REACT_APP_API_HELIUS || null;
//export const GRAPE_DRIVE = '/';

export const GRAPE_DRIVE = '/?storage=';

export const GRAPE_RPC_REFRESH = 25000;
export const GRAPE_TREASURY = 'GrapevviL94JZRiZwn2LjpWtmDacXU8QhAJvzpUMMFdL';

export const MARKET_LOGO = STATIC_LOGO;

export const BOARDING_PROGRAM_CONFIG = '2ZaLmrM1WUTYBE2NdsJRVLS5egAvVZwYUSZNJkVeijYq'
export const GRAPE_WHITELIST = process.env.REACT_APP_API_WHITELIST || null;