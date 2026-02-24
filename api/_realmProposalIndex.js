const SHYFT_GRAPHQL_ENDPOINT =
  process.env.REALM_PUSH_GRAPHQL_ENDPOINT || 'https://grape.shyft.to/v1/graphql/';

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    if (/^0x/i.test(trimmed)) {
      const parsedHex = Number.parseInt(trimmed, 16);
      return Number.isFinite(parsedHex) ? parsedHex : fallback;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function shortPk(pk) {
  if (!pk || pk.length < 10) return pk || '';
  return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
}

function ensureGraphqlIdentifier(value) {
  const candidate = String(value || '');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(candidate)) {
    throw new Error(`Invalid GraphQL identifier: ${candidate}`);
  }
  return candidate;
}

function graphqlQuote(value) {
  return JSON.stringify(String(value || ''));
}

async function runQuery(query) {
  const response = await fetch(SHYFT_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GraphQL request failed (${response.status}): ${body.slice(0, 350)}`);
  }

  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error(`GraphQL error: ${payload.errors[0]?.message || 'unknown error'}`);
  }
  return payload?.data || {};
}

export async function fetchRealmGovernancePubkeys(realmPk, programId) {
  const program = ensureGraphqlIdentifier(programId);
  const realm = graphqlQuote(realmPk);
  const query = `
    query RealmGovernance {
      ${program}_GovernanceV2(limit: 500, where: {realm: {_eq: ${realm}}}) {
        pubkey
      }
      ${program}_GovernanceV1(limit: 500, where: {realm: {_eq: ${realm}}}) {
        pubkey
      }
    }
  `;

  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_GovernanceV2`]) ? data[`${program}_GovernanceV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_GovernanceV1`]) ? data[`${program}_GovernanceV1`] : [];

  const governancePks = new Set();
  for (const row of [...v2, ...v1]) {
    if (row?.pubkey) governancePks.add(String(row.pubkey));
  }
  return Array.from(governancePks);
}

export function isVotingState(state) {
  const normalized = String(state ?? '').trim().toUpperCase();
  if (normalized === 'VOTING') return true;
  return toNumber(state, -1) === 2;
}

function normalizeProposal(row, fallbackGovernancePk) {
  const pubkey = String(row?.pubkey || '');
  const governance = String(row?.governance || fallbackGovernancePk || '');
  const name = String(row?.name || shortPk(pubkey));
  const state = row?.state;
  const draftAt = Math.max(0, toNumber(row?.draftAt, 0));
  const votingAt = Math.max(0, toNumber(row?.votingAt, 0));

  if (!pubkey || !governance) return null;
  return {
    pubkey,
    governance,
    name,
    state,
    draftAt,
    votingAt,
  };
}

async function fetchProposalsChunk(programId, governancePks, limitPerVersion = 2000) {
  if (!Array.isArray(governancePks) || governancePks.length === 0) return [];

  const program = ensureGraphqlIdentifier(programId);
  const governanceList = governancePks.map((pk) => graphqlQuote(pk)).join(', ');
  const query = `
    query RealmProposals {
      ${program}_ProposalV2(
        limit: ${limitPerVersion},
        order_by: {draftAt: desc},
        where: {governance: {_in: [${governanceList}]}}
      ) {
        pubkey
        governance
        name
        state
        draftAt
        votingAt
      }
      ${program}_ProposalV1(
        limit: ${limitPerVersion},
        order_by: {draftAt: desc},
        where: {governance: {_in: [${governanceList}]}}
      ) {
        pubkey
        governance
        name
        state
        draftAt
        votingAt
      }
    }
  `;

  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_ProposalV2`]) ? data[`${program}_ProposalV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_ProposalV1`]) ? data[`${program}_ProposalV1`] : [];

  const normalized = [];
  for (const row of [...v2, ...v1]) {
    const mapped = normalizeProposal(row, null);
    if (mapped) normalized.push(mapped);
  }
  return normalized;
}

export async function fetchRealmProposals(realmPk, programId) {
  const governancePks = await fetchRealmGovernancePubkeys(realmPk, programId);
  if (governancePks.length === 0) return [];

  const chunkSize = 150;
  const results = [];
  for (let i = 0; i < governancePks.length; i += chunkSize) {
    const chunk = governancePks.slice(i, i + chunkSize);
    const chunkRows = await fetchProposalsChunk(programId, chunk);
    results.push(...chunkRows);
  }

  const deduped = new Map();
  for (const proposal of results) {
    deduped.set(proposal.pubkey, proposal);
  }

  const proposals = Array.from(deduped.values());
  proposals.sort((a, b) => b.draftAt - a.draftAt);
  return proposals;
}
