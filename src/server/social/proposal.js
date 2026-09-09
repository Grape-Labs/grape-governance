import { Connection, PublicKey } from '@solana/web3.js';
import { getProposal, getRealm, getGovernance, ProposalState } from '@solana/spl-governance';

export const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://governance.so';
export const shortKey = (key) => `${key.slice(0, 6)}…${key.slice(-6)}`;
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export function parseProposalRequest(req) {
  const url = new URL(req.url, SITE_ORIGIN);
  const query = req.query || Object.fromEntries(url.searchParams);
  const parts = url.pathname.split('/').filter(Boolean);
  const realm = query.realm || parts[1];
  const proposal = query.proposal || parts[2];
  for (const key of [realm, proposal]) {
    if (typeof key !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)) {
      throw new Error('Invalid proposal address');
    }
    new PublicKey(key);
  }
  return { realm, proposal };
}

function rpcEndpoint() {
  return process.env.SOCIAL_RPC_ENDPOINT || process.env.REACT_APP_API_HELIUS_RPC_ENDPOINT ||
    (process.env.REACT_APP_API_HELIUS ? `https://mainnet.helius-rpc.com/?api-key=${process.env.REACT_APP_API_HELIUS}` : null) ||
    process.env.REACT_APP_API_QUICKNODE_RPC_ENDPOINT ||
    (process.env.REACT_APP_API_SHYFT_KEY ? `https://rpc.shyft.to/?api_key=${process.env.REACT_APP_API_SHYFT_KEY}` : null) ||
    'https://api.mainnet-beta.solana.com';
}

// Read the chain directly: newly created drafts may not be indexed yet.
export async function loadProposalPreview(context, connection) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const rpc = connection || new Connection(rpcEndpoint(), {
      commitment: 'confirmed',
      disableRetryOnRateLimit: true,
      fetch: (url, options) => fetch(url, { ...options, signal: controller.signal }),
    });
    const [proposal, realm] = await Promise.all([
      getProposal(rpc, new PublicKey(context.proposal)),
      getRealm(rpc, new PublicKey(context.realm)),
    ]);
    const governance = await getGovernance(rpc, proposal.account.governance);
    if (!governance.account.realm.equals(new PublicKey(context.realm)) ||
        !proposal.owner.equals(realm.owner) || !proposal.owner.equals(governance.owner)) {
      throw new Error('Proposal does not belong to this DAO');
    }
    return {
      ...context,
      title: proposal.account.name,
      dao: realm.account.name,
      state: (ProposalState[proposal.account.state] || 'Unknown').replace(/([a-z])([A-Z])/g, '$1 $2'),
      available: true,
    };
  } catch (_error) {
    // Do not cache temporary RPC failures or missing accounts as a generic preview.
    return { ...context, title: `Proposal ${shortKey(context.proposal)}`, dao: `DAO ${shortKey(context.realm)}`, state: 'View proposal', available: false };
  } finally {
    clearTimeout(timeout);
  }
}

export function previewMeta(preview) {
  const canonical = `${SITE_ORIGIN}/proposal/${preview.realm}/${preview.proposal}`;
  const image = `${SITE_ORIGIN}/api/proposal-image?realm=${preview.realm}&proposal=${preview.proposal}&v=1`;
  const title = `${preview.title} | ${preview.dao}`;
  const description = preview.available
    ? `${preview.state} proposal in ${preview.dao}. Review and participate on Governance by Grape.`
    : 'Review this proposal on Governance by Grape.';
  const tag = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  return `<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${escapeHtml(canonical)}">
${tag('name', 'description', description)}
${Object.entries({ 'og:type': 'website', 'og:site_name': 'Governance by Grape', 'og:url': canonical,
    'og:title': title, 'og:description': description, 'og:image': image,
    'og:image:type': 'image/png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': title,
  }).map(([key, value]) => tag('property', key, value)).join('\n')}
${Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': title,
    'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': title,
  }).map(([key, value]) => tag('name', key, value)).join('\n')}`;
}

export function injectPreview(html, preview) {
  // Remove static/Helmet metadata so crawlers see exactly one value for each field.
  return html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, '')
    .replace(/<head\b[^>]*>/i, (head) => `${head}\n${previewMeta(preview)}\n`);
}

export function cacheControl(preview) {
  return preview.available ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=60' : 'no-store';
}
