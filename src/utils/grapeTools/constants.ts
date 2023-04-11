import { Connection } from '@solana/web3.js';
import STATIC_LOGO from '../../public/logotype-realms-blue-white.svg';
import STATIC_CREATOR_LOGO from '../../public/Element_46x.png';
export const APP_LOGO = STATIC_LOGO;
export const CREATOR_LOGO = STATIC_CREATOR_LOGO;
export const TX_RPC_ENDPOINT = process.env.REACT_APP_API_TX_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const QUICKNODE_RPC_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const HELIUS_RPC_ENDPOINT = 'https://rpc.helius.xyz/?api-key='+process.env.REACT_APP_API_HELIUS;
export const RPC_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const HELLO_MOON_BEARER = process.env.REACT_APP_API_HELLOMOON_API_KEY;

/*
export const RPC_CONNECTION = new Connection(
    "https://rest-api.hellomoon.io/v0/rpc",
    {
      httpHeaders: {
        Authorization: `Bearer ${HELLO_MOON_BEARER}`,
      },
    }
);
*/
export const RPC_CONNECTION = new Connection(
    RPC_ENDPOINT
);

export const SOFLARE_NOTIFICATIONS_API_KEY = process.env.REACT_APP_API_KEY_SOLFLARE_NOTIFICATIONS || '';
export const PROXY = process.env.REACT_APP_API_PROXY || '';
export const CLOUDFLARE_IPFS_CDN = 'https://cloudflare-ipfs.com';
export const HELIUS_API = process.env.REACT_APP_API_HELIUS || null;
export const TWITTER_PROXY = process.env.REACT_APP_API_TWITTER_PROXY || null;
export const GGAPI_STORAGE_POOL = process.env.REACT_APP_API_GGAPI_STORAGE_POOL || "EwMD4x7m2Hsay5KfyFwuDMUPtnvw4XmRFYhByorwdkL4";
export const GGAPI_STORAGE_URI = 'https://shdw-drive.genesysgo.net';
export const APP_WHITELIST = process.env.REACT_APP_API_WHITELIST || null;

export const PRIMARY_STORAGE_WALLET = process.env.REACT_APP_API_PRIMARY_STORAGE_WALLET || null;
export const SECONDARY_STORAGE_WALLET = process.env.REACT_APP_API_SECONDARY_STORAGE_WALLET || null;
export const TERTIARY_STORAGE_WALLET = process.env.REACT_APP_API_TERTIARY_STORAGE_WALLET || null;