import { Connection } from '@solana/web3.js';
import STATIC_LOGO from '../../public/logotype-realms-blue-white.svg';
import STATIC_CREATOR_LOGO from '../../public/Element_46x.png';
export const APP_LOGO = STATIC_LOGO;
export const CREATOR_LOGO = STATIC_CREATOR_LOGO;

export const TX_RPC_ENDPOINT = process.env.REACT_APP_API_TX_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const GRAPE_RPC_ENDPOINT = process.env.REACT_APP_API_GRAPE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const QUICKNODE_RPC_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

/*
export const RPC_CONNECTION = new Connection(
    "https://rest-api.hellomoon.io/v0/rpc",
    {
      httpHeaders: {
        Authorization: `Bearer ${process.env.REACT_APP_API_HELLOMOON_API_KEY}`,
      },
    }
  );
*/
export const RPC_CONNECTION = new Connection(
    QUICKNODE_RPC_ENDPOINT
);

export const SOFLARE_NOTIFICATIONS_API_KEY = process.env.REACT_APP_API_KEY_SOLFLARE_NOTIFICATIONS || '';
export const PROXY = process.env.REACT_APP_API_PROXY || '';
export const CLOUDFLARE_IPFS_CDN = 'https://cloudflare-ipfs.com';
export const HELIUS_API = process.env.REACT_APP_API_HELIUS || null;
export const TWITTER_PROXY = process.env.REACT_APP_API_TWITTER_PROXY || null;

export const GRAPE_DRIVE = '/?storage=';

export const GGAPI_STORAGE_POOL = process.env.REACT_APP_API_GGAPI_STORAGE_POOL || "EwMD4x7m2Hsay5KfyFwuDMUPtnvw4XmRFYhByorwdkL4";

export const GGAPI_STORAGE_URI = 'https://shdw-drive.genesysgo.net';


export const APP_WHITELIST = process.env.REACT_APP_API_WHITELIST || null;