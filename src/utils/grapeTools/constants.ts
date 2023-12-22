import { Connection } from '@solana/web3.js';
import STATIC_LOGO from '../../public/grape_logo.svg';
import STATIC_CREATOR_LOGO from '../../public/Element_46x.png';
import FRICTIONLESS_ASSET_1 from '../../public/isolated_graphic_frictionless.jpeg';
import FRICTIONLESS_LOGO_ASSET from '../../public/frictionless_logo.png';
export const FRICTIONLESS_LOGO = FRICTIONLESS_LOGO_ASSET;
export const FRICTIONLESS_BG = FRICTIONLESS_ASSET_1;
export const APP_LOGO = STATIC_LOGO;
export const CREATOR_LOGO = STATIC_CREATOR_LOGO;
export const TX_RPC_ENDPOINT = process.env.REACT_APP_API_TX_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const QUICKNODE_RPC_ENDPOINT = process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const HELIUS_RPC_ENDPOINT = 'https://rpc.helius.xyz/?api-key='+process.env.REACT_APP_API_HELIUS;
export const ALCHEMY_RPC_ENDPOINT = process.env.REACT_APP_API_ALCHEMY_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
export const HELLO_MOON_BEARER = process.env.REACT_APP_API_HELLOMOON_API_KEY;
export const HELLO_MOON_ENDPOINT = HELLO_MOON_BEARER ? `https://rpc.hellomoon.io/${HELLO_MOON_BEARER}` : `https://api.mainnet-beta.solana.com`;
export const SHYFT_KEY = process.env.REACT_APP_API_SHYFT_KEY;
export const SHYFT_RPC_ENDPOINT = SHYFT_KEY ? `https://rpc.shyft.to?api_key=${SHYFT_KEY}` : `https://api.mainnet-beta.solana.com`;
export const RPC_ENDPOINT = SHYFT_RPC_ENDPOINT || ALCHEMY_RPC_ENDPOINT || QUICKNODE_RPC_ENDPOINT || ALCHEMY_RPC_ENDPOINT || HELLO_MOON_ENDPOINT || HELIUS_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';
//export const RPC_LABEL = QUICKNODE_RPC_ENDPOINT ? 'QuickNode' : 'Solana Mainnet'; 
export const WS_ENDPOINT = process.env?.REACT_APP_API_QUICKNODE_RPC_ENDPOINT ? process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT.replace('https://', 'wss://') : 'wss://api.mainnet-beta.solana.com';

export const ALCHEMY_ETH_KEY = process.env.REACT_APP_API_ALCHEMY_ETH || null;
export const WALLET_CONNECT_PROJECT_ID = process.env.REACT_APP_API_WALLET_CONNECT_PROJECT_ID || null;
export const DYNAMICXYZ_KEY = process.env.REACT_APP_API_DYNAMICXYZ_KEY || null;
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
    RPC_ENDPOINT, 'confirmed'
);

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
export const GGAPI_STORAGE_URI = 'https://shdw-drive.genesysgo.net';
export const APP_WHITELIST = process.env.REACT_APP_API_WHITELIST || null;
export const APP_GOVERNANCEPROPWHITELIST = process.env.REACT_APP_API_GOVERNANCEPROPWHITELIST || null;

export const PRIMARY_STORAGE_WALLET = process.env.REACT_APP_API_PRIMARY_STORAGE_WALLET || null;
export const SECONDARY_STORAGE_WALLET = process.env.REACT_APP_API_SECONDARY_STORAGE_WALLET || null;
export const TERTIARY_STORAGE_WALLET = process.env.REACT_APP_API_TERTIARY_STORAGE_WALLET || null;
export const FRICTIONLESS_WALLET = process.env.REACT_APP_API_FRICTIONLESS_WALLET || null;

export const PROP_TOKEN = process.env.REACT_APP_API_PROP_TOKEN || "5Hb1JX2H85yBua97USwJYJH5pURUVirL2s3WBpp3QGfV";
export const METRICS_TOKEN = process.env.REACT_APP_API_METRICS_TOKEN || "CmtdUmxdML91oNUGj4qiEnWffcYibfUJPCJwaPkhWogc";
export const ADMIN_TOKEN = process.env.REACT_APP_API_METRICS_TOKEN || "CmtdUmxdML91oNUGj4qiEnWffcYibfUJPCJwaPkhWogc";