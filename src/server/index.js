import express from 'express';
import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs/promises'; // Use fs/promises for async/await support
import path from 'path';
import App from '../App'; // Adjust path as necessary

const server = express();
const PORT = process.env.PORT || 3000;
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://governance.so';
const GRAPHQL_ENDPOINT = 'https://grape.shyft.to/v1/graphql/';
const DEFAULT_OG_IMAGE =
  'https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png';

const PROGRAM_NAME_CANDIDATES = [
  'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
  'Marinade_DAO',
  'Mango',
  'Psy_Finance',
  'Jet_Custody',
  'Pyth_Governance',
  'MonkeDAO',
  'Helium',
  'MEAN_DAO',
  'Orca',
  'ALLOVR_DAO',
  'Metaplex_DAO',
  'Metaplex_Genesis',
  'Metaplex_Found',
  'Serum',
  'SOCEAN',
  'JungleDeFi_DAO',
  'Jito',
];

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizePubkey(value) {
  if (!value) return null;
  const input = String(value).trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input)) return null;
  return input;
}

function resolveRouteContext(reqUrl) {
  const parts = reqUrl.pathname.split('/').filter(Boolean);
  const context = {
    routeType: 'default',
    governancePk: null,
    proposalPk: null,
    pathname: reqUrl.pathname,
    search: reqUrl.search || '',
  };

  if (parts.length >= 3 && (parts[0] === 'proposal' || parts[0] === 'embedproposal')) {
    context.routeType = 'proposal';
    context.governancePk = sanitizePubkey(parts[1]);
    context.proposalPk = sanitizePubkey(parts[2]);
    return context;
  }

  if (parts.length >= 2 && (parts[0] === 'dao' || parts[0] === 'governance' || parts[0] === 'embedgovernance')) {
    context.routeType = 'dao';
    context.governancePk = sanitizePubkey(parts[1]);
    context.proposalPk =
      sanitizePubkey(parts[2]) ||
      sanitizePubkey(reqUrl.searchParams.get('proposal')) ||
      sanitizePubkey(reqUrl.searchParams.get('proposalPk'));
    return context;
  }

  return context;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function createProposalLookupQuery(proposalPk) {
  const fields = PROGRAM_NAME_CANDIDATES.map(
    (programName, index) => `
      p${index}v2: ${programName}_ProposalV2(limit: 1, where: { pubkey: { _eq: "${proposalPk}" } }) {
        pubkey
        name
        governance
      }
      p${index}v1: ${programName}_ProposalV1(limit: 1, where: { pubkey: { _eq: "${proposalPk}" } }) {
        pubkey
        name
        governance
      }
    `
  ).join('\n');

  return `query ProposalMeta { ${fields} }`;
}

async function fetchProposalMeta(proposalPk) {
  if (!proposalPk) return null;

  try {
    const query = createProposalLookupQuery(proposalPk);
    const response = await fetchWithTimeout(
      GRAPHQL_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip',
        },
        body: JSON.stringify({ query }),
      },
      3500
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const data = payload?.data;
    if (!data) return null;

    for (let index = 0; index < PROGRAM_NAME_CANDIDATES.length; index++) {
      const v2Result = data[`p${index}v2`];
      if (Array.isArray(v2Result) && v2Result.length > 0) {
        return v2Result[0];
      }

      const v1Result = data[`p${index}v1`];
      if (Array.isArray(v1Result) && v1Result.length > 0) {
        return v1Result[0];
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
}

function buildMetaTags(context, proposalMeta) {
  const proposalTitle = proposalMeta?.name ? String(proposalMeta.name).trim() : null;
  const governancePk = context.governancePk;
  const proposalPk = context.proposalPk;

  let title = 'Governance | Powered by Grape';
  let description = 'Governance | Discover & Participate in DAOs on Solana | Powered by Grape';
  let canonicalUrl = `${SITE_ORIGIN}${context.pathname}${context.search}`;

  if (context.routeType === 'proposal' && proposalPk) {
    title = proposalTitle
      ? `${proposalTitle} | Governance Proposal`
      : `Governance Proposal ${proposalPk}`;
    description = proposalTitle
      ? `View proposal "${proposalTitle}" on Governance by Grape${governancePk ? ` in ${governancePk}` : ''}.`
      : `View governance proposal ${proposalPk} on Governance by Grape.`;
  } else if (context.routeType === 'dao' && governancePk) {
    if (proposalPk) {
      title = proposalTitle
        ? `${proposalTitle} | DAO ${governancePk}`
        : `DAO ${governancePk} Proposal`;
      description = proposalTitle
        ? `View proposal "${proposalTitle}" in DAO ${governancePk} on Governance by Grape.`
        : `View DAO ${governancePk} proposal ${proposalPk} on Governance by Grape.`;
    } else {
      title = `DAO ${governancePk} | Governance by Grape`;
      description = `Explore DAO ${governancePk} proposals and governance activity on Governance by Grape.`;
    }
  }

  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const escapedUrl = escapeHtml(canonicalUrl);
  const escapedImage = escapeHtml(DEFAULT_OG_IMAGE);

  return `
            <meta name="msapplication-TileImage" content="./public/AppIcons/apple-icon-144x144.png">
            <meta name="msapplication-TileColor" content="#180A1E">
            <meta name="description" content="${escapedDescription}" />
            <title>${escapedTitle}</title>
            <link rel="canonical" href="${escapedUrl}">
            <meta property="og:url" content="${escapedUrl}">
            <meta property="og:type" content="website">
            <meta property="og:title" content="${escapedTitle}">
            <meta property="og:description" content="${escapedDescription}">
            <meta property="og:image" content="${escapedImage}">
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="${escapedTitle}">
            <meta name="twitter:site" content="@grapeprotocol">
            <meta name="twitter:description" content="${escapedDescription}">
            <meta name="twitter:image" content="${escapedImage}">
            <meta name="twitter:image:alt" content="${escapedTitle}">
        `;
}

function injectMetaBlock(indexHtml, metaTags) {
  if (/<helmet>[\s\S]*<\/helmet>/i.test(indexHtml)) {
    return indexHtml.replace(/<helmet>[\s\S]*<\/helmet>/i, `<helmet>${metaTags}\n        </helmet>`);
  }

  return indexHtml.replace('</head>', `${metaTags}\n    </head>`);
}

server.use(express.static(path.resolve('dist'))); // Serve static files from the dist folder

server.get('*', async (req, res) => {
  try {
    const requestUrl = new URL(req.originalUrl, SITE_ORIGIN);
    const routeContext = resolveRouteContext(requestUrl);
    const proposalMeta = routeContext.proposalPk
      ? await fetchProposalMeta(routeContext.proposalPk)
      : null;
    const metaTags = buildMetaTags(routeContext, proposalMeta);

    let appString = '';
    try {
      appString = renderToString(<App />);
    } catch (renderError) {
      console.error('SSR render fallback to shell:', renderError);
    }
    
    const indexHtml = await fs.readFile(path.resolve('dist/index.html'), 'utf8');
    const hydratedHtml = indexHtml.replace('<div id="app"></div>', `<div id="app">${appString}</div>`);
    const html = injectMetaBlock(hydratedHtml, metaTags);

    res.send(html);
  } catch (error) {
    console.error('Error loading page', error);
    res.status(500).send('Error loading page');
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
