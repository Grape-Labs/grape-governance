import { fetchRealmProposals, isVotingState } from '../../../api/_realmProposalIndex.js';
import { getProgramIdForRealm, getRealmAllowlist } from '../../../api/_realmPushConfig.js';
import { ensureGraphqlIdentifier, graphqlQuote, runQuery } from './_graphql.js';
import {
  parseBoolean,
  parseLimit,
  paginateArray,
  sortByField,
  splitCsv,
  toNumber,
  toUnixSeconds,
  uniqueStrings,
} from './_http.js';

export const DEFAULT_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
export const DEFAULT_CLUSTER = process.env.REACT_APP_SOLANA_CLUSTER || 'mainnet';

const PROPOSAL_STATE_LABELS = {
  0: 'Draft',
  1: 'SigningOff',
  2: 'Voting',
  3: 'Succeeded',
  4: 'Executing',
  5: 'Completed',
  6: 'Cancelled',
  7: 'Defeated',
  8: 'ExecutingWithErrors',
  9: 'Vetoed',
};

function shortPk(pk) {
  if (!pk || pk.length < 10) return pk || '';
  return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
}

function normalizedProgramId(programId) {
  const candidate = String(programId || DEFAULT_PROGRAM_ID).trim() || DEFAULT_PROGRAM_ID;
  return ensureGraphqlIdentifier(candidate);
}

function parseProgramOverrides() {
  const raw = process.env.REALM_PUSH_REALM_PROGRAM_OVERRIDES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    return uniqueStrings(Object.values(parsed).map((value) => String(value || '')));
  } catch {
    return [];
  }
}

function getProgramCandidates({ programId, realmId } = {}) {
  const candidates = [];
  if (programId) candidates.push(String(programId));
  if (realmId) candidates.push(getProgramIdForRealm(realmId));
  candidates.push(DEFAULT_PROGRAM_ID);
  candidates.push(...parseProgramOverrides());
  return uniqueStrings(candidates).map((value) => normalizedProgramId(value));
}

export function resolveProgramId({ programId, realmId } = {}) {
  if (programId) return normalizedProgramId(programId);
  if (realmId) return normalizedProgramId(getProgramIdForRealm(realmId));
  return normalizedProgramId(DEFAULT_PROGRAM_ID);
}

function normalizeStateLabel(state) {
  const numeric = toNumber(state, Number.NaN);
  if (Number.isFinite(numeric) && PROPOSAL_STATE_LABELS[numeric]) {
    return PROPOSAL_STATE_LABELS[numeric];
  }
  const asString = String(state || '').trim();
  return asString || 'Unknown';
}

function normalizeRealmRow(row, programId) {
  const id = String(row?.pubkey || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(row?.name || shortPk(id)),
    program_id: programId,
    cluster: DEFAULT_CLUSTER,
    verified: false,
    proposal_count: null,
    member_count: null,
    active_proposals: null,
    treasury_value_usd: null,
    _raw: row,
  };
}

async function fetchRealmsRaw(programId, { offset = 0, limit = 100 } = {}) {
  const program = normalizedProgramId(programId);
  const safeOffset = Math.max(0, Math.trunc(toNumber(offset, 0)));
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(toNumber(limit, 100))));
  const query = `
    query RealmsList {
      ${program}_RealmV2(limit: ${safeLimit}, offset: ${safeOffset}) {
        pubkey
        authority
        communityMint
        config
        name
      }
      ${program}_RealmV1(limit: ${safeLimit}, offset: ${safeOffset}) {
        pubkey
        authority
        communityMint
        config
        name
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_RealmV2`]) ? data[`${program}_RealmV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_RealmV1`]) ? data[`${program}_RealmV1`] : [];
  const deduped = new Map();
  for (const row of [...v2, ...v1]) {
    const normalized = normalizeRealmRow(row, program);
    if (!normalized) continue;
    deduped.set(normalized.id, normalized);
  }
  return Array.from(deduped.values());
}

async function fetchRealmRawById(realmId, programId) {
  const program = normalizedProgramId(programId);
  const realm = graphqlQuote(realmId);
  const query = `
    query RealmById {
      ${program}_RealmV2(where: {pubkey: {_eq: ${realm}}}, limit: 1) {
        pubkey
        authority
        communityMint
        config
        name
      }
      ${program}_RealmV1(where: {pubkey: {_eq: ${realm}}}, limit: 1) {
        pubkey
        authority
        communityMint
        config
        name
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_RealmV2`]) ? data[`${program}_RealmV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_RealmV1`]) ? data[`${program}_RealmV1`] : [];
  const row = v2[0] || v1[0] || null;
  if (!row) return null;
  return normalizeRealmRow(row, program);
}

async function fetchRealmMemberCount(realmId, programId) {
  const program = normalizedProgramId(programId);
  const realm = graphqlQuote(realmId);
  const query = `
    query RealmMemberCount {
      ${program}_TokenOwnerRecordV2(
        where: {realm: {_eq: ${realm}}},
        distinct_on: governingTokenOwner,
        limit: 50000
      ) {
        governingTokenOwner
      }
      ${program}_TokenOwnerRecordV1(
        where: {realm: {_eq: ${realm}}},
        distinct_on: governingTokenOwner,
        limit: 50000
      ) {
        governingTokenOwner
      }
    }
  `;
  try {
    const data = await runQuery(query);
    const v2 = Array.isArray(data?.[`${program}_TokenOwnerRecordV2`])
      ? data[`${program}_TokenOwnerRecordV2`]
      : [];
    const v1 = Array.isArray(data?.[`${program}_TokenOwnerRecordV1`])
      ? data[`${program}_TokenOwnerRecordV1`]
      : [];
    const members = new Set();
    for (const row of [...v2, ...v1]) {
      const owner = String(row?.governingTokenOwner || '').trim();
      if (owner) members.add(owner);
    }
    return members.size;
  } catch {
    return null;
  }
}

export async function getRealmStats(realmId, programId) {
  const program = normalizedProgramId(programId);
  const proposals = await fetchRealmProposals(realmId, program);
  const proposalCount = proposals.length;
  const activeCount = proposals.reduce((count, proposal) => {
    return isVotingState(proposal?.state) ? count + 1 : count;
  }, 0);
  const latestDraftAt = proposals.reduce((maxValue, proposal) => {
    const draftAt = toUnixSeconds(proposal?.draftAt);
    return Math.max(maxValue, draftAt);
  }, 0);
  const memberCount = await fetchRealmMemberCount(realmId, program);

  return {
    realm_id: realmId,
    program_id: program,
    cluster: DEFAULT_CLUSTER,
    proposal_count: proposalCount,
    active_proposals: activeCount,
    member_count: memberCount,
    last_proposal_ts: latestDraftAt || null,
  };
}

async function hydrateRealm(realm, { includeStats = true } = {}) {
  if (!realm) return null;
  if (!includeStats) {
    const cleaned = { ...realm };
    delete cleaned._raw;
    return cleaned;
  }

  const stats = await getRealmStats(realm.id, realm.program_id);
  const hydrated = {
    ...realm,
    proposal_count: stats.proposal_count,
    member_count: stats.member_count,
    active_proposals: stats.active_proposals,
  };
  delete hydrated._raw;
  return hydrated;
}

export async function listRealms({
  programId,
  search,
  verified,
  activeVoting,
  minProposals,
  limit = 25,
  offset = 0,
  sortBy = 'name',
  sortOrder = 'asc',
} = {}) {
  const program = normalizedProgramId(programId);
  const safeLimit = parseLimit(limit, 25);
  const safeOffset = Math.max(0, Math.trunc(toNumber(offset, 0)));
  const fetchSize = Math.max(100, safeLimit * 4);
  const raw = await fetchRealmsRaw(program, { offset: safeOffset, limit: fetchSize });

  const normalizedSearch = String(search || '').trim().toLowerCase();
  const minProposalFilter = Math.max(0, Math.trunc(toNumber(minProposals, 0)));
  const wantsActiveFilter = parseBoolean(activeVoting, false);
  const wantsVerifiedFilter = verified !== undefined && verified !== null && verified !== '';
  const verifiedFilter = parseBoolean(verified, false);

  const filtered = [];
  let scanned = 0;
  for (const realm of raw) {
    scanned += 1;
    if (normalizedSearch) {
      const haystack = `${realm.id} ${realm.name}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) continue;
    }

    const hydrated = await hydrateRealm(realm, { includeStats: true });
    if (wantsVerifiedFilter && hydrated.verified !== verifiedFilter) continue;
    if (minProposalFilter > 0 && toNumber(hydrated.proposal_count, 0) < minProposalFilter) continue;
    if (wantsActiveFilter && toNumber(hydrated.active_proposals, 0) <= 0) continue;
    filtered.push(hydrated);
    if (filtered.length >= safeLimit) break;
  }

  const sortable = filtered.map((item) => ({ ...item }));
  const sortFieldMap = {
    name: 'name',
    proposal_count: 'proposal_count',
    member_count: 'member_count',
    active_proposals: 'active_proposals',
  };
  const resolvedSortField = sortFieldMap[sortBy] || 'name';
  const sorted = sortByField(sortable, resolvedSortField, sortOrder);

  const hasMore = scanned < raw.length || raw.length >= fetchSize;
  return {
    data: sorted,
    nextCursor: hasMore ? safeOffset + scanned : null,
    hasMore,
  };
}

export async function getRealm({ realmId, programId } = {}) {
  const programCandidates = getProgramCandidates({ programId, realmId });
  for (const candidate of programCandidates) {
    const realm = await fetchRealmRawById(realmId, candidate);
    if (!realm) continue;
    return hydrateRealm(realm, { includeStats: true });
  }
  return null;
}

function extractRealmMints(realmRaw) {
  const communityMint = String(
    realmRaw?.communityMint ||
      realmRaw?.config?.communityMint ||
      realmRaw?.config?.communityTokenMint ||
      ''
  ).trim();
  const councilMint = String(
    realmRaw?.config?.councilMint || realmRaw?.councilMint || ''
  ).trim();
  return {
    communityMint: communityMint || null,
    councilMint: councilMint || null,
  };
}

function normalizeMemberRecord(row) {
  const owner = String(row?.governingTokenOwner || '').trim();
  const mint = String(row?.governingTokenMint || '').trim();
  if (!owner || !mint) return null;

  return {
    id: `${owner}:${mint}`,
    governing_token_owner: owner,
    governing_token_mint: mint,
    governance_delegate: String(row?.governanceDelegate || '').trim() || null,
    voting_power: toNumber(row?.governingTokenDepositAmount, 0),
    unrelinquished_votes_count: Math.max(0, Math.trunc(toNumber(row?.unrelinquishedVotesCount, 0))),
    outstanding_proposal_count: Math.max(0, Math.trunc(toNumber(row?.outstandingProposalCount, 0))),
  };
}

async function fetchRealmMemberRows(realmId, programId, { offset = 0, limit = 100 } = {}) {
  const program = normalizedProgramId(programId);
  const realm = graphqlQuote(realmId);
  const safeOffset = Math.max(0, Math.trunc(toNumber(offset, 0)));
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(toNumber(limit, 100))));
  const query = `
    query RealmMembers {
      ${program}_TokenOwnerRecordV2(
        where: {realm: {_eq: ${realm}}},
        limit: ${safeLimit},
        offset: ${safeOffset}
      ) {
        governanceDelegate
        governingTokenDepositAmount
        governingTokenMint
        governingTokenOwner
        outstandingProposalCount
        unrelinquishedVotesCount
      }
      ${program}_TokenOwnerRecordV1(
        where: {realm: {_eq: ${realm}}},
        limit: ${safeLimit},
        offset: ${safeOffset}
      ) {
        governanceDelegate
        governingTokenDepositAmount
        governingTokenMint
        governingTokenOwner
        outstandingProposalCount
        unrelinquishedVotesCount
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_TokenOwnerRecordV2`])
    ? data[`${program}_TokenOwnerRecordV2`]
    : [];
  const v1 = Array.isArray(data?.[`${program}_TokenOwnerRecordV1`])
    ? data[`${program}_TokenOwnerRecordV1`]
    : [];
  const deduped = new Map();
  for (const row of [...v2, ...v1]) {
    const normalized = normalizeMemberRecord(row);
    if (!normalized) continue;
    deduped.set(normalized.id, normalized);
  }
  return Array.from(deduped.values());
}

export async function listRealmMembers({
  realmId,
  programId,
  mint = 'all',
  minVotingPower = 0,
  includeInactive = false,
  limit = 25,
  offset = 0,
  sortBy = 'voting_power',
  sortOrder = 'desc',
} = {}) {
  const program = normalizedProgramId(programId);
  const realmRaw = await fetchRealmRawById(realmId, program);
  if (!realmRaw) return { data: [], nextCursor: null, hasMore: false };
  const { communityMint, councilMint } = extractRealmMints(realmRaw._raw);

  const safeLimit = parseLimit(limit, 25);
  const safeOffset = Math.max(0, Math.trunc(toNumber(offset, 0)));
  const fetchSize = Math.max(100, safeLimit * 4);
  const rows = await fetchRealmMemberRows(realmId, program, { offset: safeOffset, limit: fetchSize });

  const safeMint = String(mint || 'all').toLowerCase();
  const filtered = rows
    .filter((row) => {
      if (safeMint === 'community' && communityMint) {
        return row.governing_token_mint === communityMint;
      }
      if (safeMint === 'council' && councilMint) {
        return row.governing_token_mint === councilMint;
      }
      return true;
    })
    .filter((row) => row.voting_power >= toNumber(minVotingPower, 0))
    .filter((row) => (parseBoolean(includeInactive, false) ? true : row.voting_power > 0))
    .map((row) => {
      const memberType =
        councilMint && row.governing_token_mint === councilMint
          ? 'council'
          : communityMint && row.governing_token_mint === communityMint
            ? 'community'
            : 'unknown';
      return {
        ...row,
        member_type: memberType,
      };
    });

  const sortFieldMap = {
    voting_power: 'voting_power',
    owner: 'governing_token_owner',
    outstanding_proposal_count: 'outstanding_proposal_count',
  };
  const resolvedSort = sortFieldMap[sortBy] || 'voting_power';
  const sorted = sortByField(filtered, resolvedSort, sortOrder);
  const paged = paginateArray(sorted, { offset: 0, limit: safeLimit });
  const hasMore = sorted.length > safeLimit || rows.length >= fetchSize;
  return {
    data: paged.data,
    nextCursor: hasMore ? safeOffset + paged.data.length : null,
    hasMore,
  };
}

async function fetchRealmGovernanceRows(realmId, programId) {
  const program = normalizedProgramId(programId);
  const realm = graphqlQuote(realmId);
  const query = `
    query RealmGovernanceAccounts {
      ${program}_GovernanceV2(where: {realm: {_eq: ${realm}}}, limit: 1000) {
        pubkey
        governedAccount
        activeProposalCount
      }
      ${program}_GovernanceV1(where: {realm: {_eq: ${realm}}}, limit: 1000) {
        pubkey
        governedAccount
        proposalsCount
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_GovernanceV2`]) ? data[`${program}_GovernanceV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_GovernanceV1`]) ? data[`${program}_GovernanceV1`] : [];
  const rows = [];
  for (const row of [...v2, ...v1]) {
    const governanceId = String(row?.pubkey || '').trim();
    const governed = String(row?.governedAccount || '').trim();
    if (!governanceId || !governed || governed === '11111111111111111111111111111111') continue;
    rows.push({
      id: `${governanceId}:${governed}`,
      governance_id: governanceId,
      governed_account: governed,
      active_proposal_count: Math.max(0, Math.trunc(toNumber(row?.activeProposalCount, row?.proposalsCount || 0))),
    });
  }
  return rows;
}

export async function listRealmWallets({ realmId, programId, limit = 25, offset = 0 } = {}) {
  const program = normalizedProgramId(programId);
  const rows = await fetchRealmGovernanceRows(realmId, program);
  const sorted = sortByField(rows, 'active_proposal_count', 'desc');
  return paginateArray(sorted, { offset, limit });
}

export async function getRealmTreasury({ realmId, programId } = {}) {
  const program = normalizedProgramId(programId);
  const wallets = await fetchRealmGovernanceRows(realmId, program);
  return {
    realm_id: realmId,
    program_id: program,
    wallet_count: wallets.length,
    total_value_usd: null,
    stablecoin_value_usd: null,
    sol_value_usd: null,
    wallets: wallets.slice(0, 50),
  };
}

function normalizeProposalRow(row, realmId = null) {
  const id = String(row?.pubkey || '').trim();
  if (!id) return null;
  const draftAt = toUnixSeconds(row?.draftAt);
  const votingAt = toUnixSeconds(row?.votingAt);
  const maxVotingTime = toUnixSeconds(row?.maxVotingTime);
  const votingEndsAt = votingAt > 0 && maxVotingTime > 0 ? votingAt + maxVotingTime : null;

  let yesVotes = null;
  let noVotes = null;
  let abstainVotes = null;
  if (Array.isArray(row?.options)) {
    for (const option of row.options) {
      const label = String(option?.label || '').toLowerCase();
      const voteWeight = toNumber(option?.voteWeight, 0);
      if (label === 'yes') yesVotes = voteWeight;
      if (label === 'no') noVotes = voteWeight;
      if (label === 'abstain') abstainVotes = voteWeight;
    }
  }
  if (row?.yesVotesCount !== undefined) yesVotes = toNumber(row?.yesVotesCount, yesVotes ?? 0);
  if (row?.noVotesCount !== undefined) noVotes = toNumber(row?.noVotesCount, noVotes ?? 0);
  if (row?.abstainVoteWeight !== undefined) abstainVotes = toNumber(row?.abstainVoteWeight, abstainVotes ?? 0);
  if (row?.denyVoteWeight !== undefined && noVotes === null) noVotes = toNumber(row?.denyVoteWeight, 0);

  return {
    id,
    realm_id: realmId,
    governance_id: String(row?.governance || '').trim() || null,
    name: String(row?.name || shortPk(id)),
    state: normalizeStateLabel(row?.state),
    state_code: toNumber(row?.state, -1),
    draft_at: draftAt || null,
    voting_at: votingAt || null,
    voting_ends_at: votingEndsAt,
    voting_completed_at: toUnixSeconds(row?.votingCompletedAt) || null,
    yes_votes: yesVotes,
    no_votes: noVotes,
    abstain_votes: abstainVotes,
    veto_votes: row?.vetoVoteWeight !== undefined ? toNumber(row?.vetoVoteWeight, 0) : null,
    description_link: String(row?.descriptionLink || '').trim() || null,
    max_voting_time: maxVotingTime || null,
  };
}

function matchesProposalStateFilter(proposal, stateFilter) {
  if (!stateFilter) return true;
  const filters = splitCsv(stateFilter).map((item) => item.trim().toLowerCase());
  if (filters.length === 0) return true;
  const stateName = String(proposal?.state || '').toLowerCase();
  const stateCode = String(proposal?.state_code ?? '').toLowerCase();
  return filters.includes(stateName) || filters.includes(stateCode);
}

async function fetchProposalRecordByProgram(proposalId, programId) {
  const program = normalizedProgramId(programId);
  const proposal = graphqlQuote(proposalId);
  const query = `
    query ProposalByPk {
      ${program}_ProposalV2(where: {pubkey: {_eq: ${proposal}}}, limit: 1) {
        pubkey
        governance
        name
        state
        draftAt
        votingAt
        maxVotingTime
        votingCompletedAt
        options
        abstainVoteWeight
        denyVoteWeight
        vetoVoteWeight
        descriptionLink
      }
      ${program}_ProposalV1(where: {pubkey: {_eq: ${proposal}}}, limit: 1) {
        pubkey
        governance
        name
        state
        draftAt
        votingAt
        yesVotesCount
        noVotesCount
        descriptionLink
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_ProposalV2`]) ? data[`${program}_ProposalV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_ProposalV1`]) ? data[`${program}_ProposalV1`] : [];
  if (v2[0]) return { row: v2[0], programId: program, version: 'v2' };
  if (v1[0]) return { row: v1[0], programId: program, version: 'v1' };
  return null;
}

async function fetchRealmIdFromGovernance(governanceId, programId) {
  if (!governanceId) return null;
  const program = normalizedProgramId(programId);
  const governance = graphqlQuote(governanceId);
  const query = `
    query GovernanceRealm {
      ${program}_GovernanceV2(where: {pubkey: {_eq: ${governance}}}, limit: 1) {
        realm
      }
      ${program}_GovernanceV1(where: {pubkey: {_eq: ${governance}}}, limit: 1) {
        realm
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_GovernanceV2`]) ? data[`${program}_GovernanceV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_GovernanceV1`]) ? data[`${program}_GovernanceV1`] : [];
  const realm = String(v2?.[0]?.realm || v1?.[0]?.realm || '').trim();
  return realm || null;
}

async function findProposalRecord({ proposalId, realmId, programId } = {}) {
  const candidates = getProgramCandidates({ programId, realmId });
  for (const candidate of candidates) {
    try {
      const result = await fetchProposalRecordByProgram(proposalId, candidate);
      if (result) return result;
    } catch {
      // continue probing next program id
    }
  }
  return null;
}

export async function listRealmProposals({
  realmId,
  programId,
  state,
  fromTs,
  toTs,
  limit = 25,
  offset = 0,
  sortBy = 'draft_at',
  sortOrder = 'desc',
} = {}) {
  const program = normalizedProgramId(programId);
  const proposals = await fetchRealmProposals(realmId, program);
  const normalized = proposals
    .map((row) => normalizeProposalRow(row, realmId))
    .filter(Boolean)
    .filter((proposal) => matchesProposalStateFilter(proposal, state))
    .filter((proposal) => {
      const draftAt = toUnixSeconds(proposal?.draft_at);
      const from = toUnixSeconds(fromTs);
      const to = toUnixSeconds(toTs);
      if (from > 0 && draftAt < from) return false;
      if (to > 0 && draftAt > to) return false;
      return true;
    });

  const sortFieldMap = {
    draft_at: 'draft_at',
    voting_at: 'voting_at',
    name: 'name',
    state: 'state',
  };
  const resolvedSort = sortFieldMap[sortBy] || 'draft_at';
  const sorted = sortByField(normalized, resolvedSort, sortOrder);
  return paginateArray(sorted, { offset, limit });
}

export async function getProposal({ proposalId, realmId, programId } = {}) {
  const found = await findProposalRecord({ proposalId, realmId, programId });
  if (!found) return null;

  const normalized = normalizeProposalRow(found.row, realmId || null);
  const resolvedRealmId =
    realmId || (await fetchRealmIdFromGovernance(normalized?.governance_id, found.programId));

  return {
    ...normalized,
    realm_id: resolvedRealmId,
    program_id: found.programId,
    version: found.version,
  };
}

export async function getProposalInstructions({ proposalId, realmId, programId } = {}) {
  const found = await findProposalRecord({ proposalId, realmId, programId });
  if (!found) return { data: [], program_id: resolveProgramId({ programId, realmId }) };
  const program = found.programId;
  const proposal = graphqlQuote(proposalId);
  const query = `
    query ProposalInstructions {
      ${program}_ProposalTransactio(where: {proposal: {_eq: ${proposal}}}, limit: 2000) {
        pubkey
        proposal
        optionIndex
        instructionIndex
        holdUpTime
        executedAt
        executionStatus
        instructions
        lamports
      }
    }
  `;
  const data = await runQuery(query);
  const rows = Array.isArray(data?.[`${program}_ProposalTransactio`])
    ? data[`${program}_ProposalTransactio`]
    : [];
  const instructions = rows.map((row) => ({
    id: String(row?.pubkey || ''),
    proposal_id: String(row?.proposal || proposalId),
    option_index: toNumber(row?.optionIndex, 0),
    instruction_index: toNumber(row?.instructionIndex, 0),
    hold_up_time: toNumber(row?.holdUpTime, 0),
    executed_at: toUnixSeconds(row?.executedAt) || null,
    execution_status: row?.executionStatus ?? null,
    instructions: row?.instructions ?? null,
    lamports: toNumber(row?.lamports, 0),
  }));
  return { data: instructions, program_id: program };
}

function extractVoteSide(record) {
  const voteType = toNumber(record?.vote?.voteType, Number.NaN);
  if (voteType === 0) return 'yes';
  if (voteType === 1) return 'no';
  if (voteType === 2) return 'abstain';
  if (voteType === 3) return 'veto';

  const rawVote = String(record?.vote || '').toLowerCase();
  if (rawVote.includes('yes') || rawVote.includes('approve')) return 'yes';
  if (rawVote.includes('no') || rawVote.includes('deny')) return 'no';
  if (rawVote.includes('abstain')) return 'abstain';
  if (rawVote.includes('veto')) return 'veto';

  const yes = toNumber(record?.voteWeight?.yes, 0);
  const no = toNumber(record?.voteWeight?.no, 0);
  if (yes > 0) return 'yes';
  if (no > 0) return 'no';
  return 'unknown';
}

function extractVoteWeight(record) {
  const voterWeight = toNumber(record?.voterWeight, 0);
  if (voterWeight > 0) return voterWeight;
  const yes = toNumber(record?.voteWeight?.yes, 0);
  const no = toNumber(record?.voteWeight?.no, 0);
  return Math.max(yes, no, 0);
}

async function fetchProposalVoteRows(proposalId, programId) {
  const program = normalizedProgramId(programId);
  const proposal = graphqlQuote(proposalId);
  const query = `
    query ProposalVotes {
      ${program}_VoteRecordV2(where: {proposal: {_eq: ${proposal}}}, limit: 5000) {
        pubkey
        proposal
        governingTokenOwner
        governingTokenMint
        isRelinquished
        voterWeight
        vote
      }
      ${program}_VoteRecordV1(where: {proposal: {_eq: ${proposal}}}, limit: 5000) {
        pubkey
        proposal
        governingTokenOwner
        governingTokenMint
        isRelinquished
        voteWeight
      }
    }
  `;
  const data = await runQuery(query);
  const v2 = Array.isArray(data?.[`${program}_VoteRecordV2`]) ? data[`${program}_VoteRecordV2`] : [];
  const v1 = Array.isArray(data?.[`${program}_VoteRecordV1`]) ? data[`${program}_VoteRecordV1`] : [];
  return {
    program,
    rows: [...v2, ...v1],
  };
}

export async function getProposalVotes({
  proposalId,
  realmId,
  programId,
  side,
  minWeight,
  limit = 25,
  offset = 0,
} = {}) {
  const found = await findProposalRecord({ proposalId, realmId, programId });
  const program = found?.programId || resolveProgramId({ programId, realmId });
  const raw = await fetchProposalVoteRows(proposalId, program);
  const normalizedSide = String(side || '').trim().toLowerCase();
  const minWeightFilter = toNumber(minWeight, 0);
  const votes = raw.rows
    .map((row) => {
      const voter = String(row?.governingTokenOwner || '').trim();
      if (!voter) return null;
      const parsedSide = extractVoteSide(row);
      const weight = extractVoteWeight(row);
      return {
        proposal_id: String(row?.proposal || proposalId),
        voter,
        side: parsedSide,
        weight,
        mint: String(row?.governingTokenMint || '').trim() || null,
        is_relinquished: row?.isRelinquished === true,
        cast_at: null,
        vote_record_id: String(row?.pubkey || '').trim() || null,
      };
    })
    .filter(Boolean)
    .filter((vote) => (normalizedSide ? vote.side === normalizedSide : true))
    .filter((vote) => vote.weight >= minWeightFilter);

  const sorted = sortByField(votes, 'weight', 'desc');
  const paged = paginateArray(sorted, { offset, limit });
  return {
    ...paged,
    program_id: raw.program,
  };
}

export async function getProposalEvents({ proposalId, realmId, programId, limit = 25, offset = 0 } = {}) {
  const proposal = await getProposal({ proposalId, realmId, programId });
  if (!proposal) return { data: [], nextCursor: null, hasMore: false };

  const events = [];
  if (proposal.draft_at) {
    events.push({
      type: 'created',
      ts: proposal.draft_at,
      proposal_id: proposal.id,
      realm_id: proposal.realm_id,
      name: proposal.name,
    });
  }
  if (proposal.voting_at) {
    events.push({
      type: 'voting_started',
      ts: proposal.voting_at,
      proposal_id: proposal.id,
      realm_id: proposal.realm_id,
      name: proposal.name,
    });
  }
  if (proposal.voting_completed_at) {
    events.push({
      type: 'state_changed',
      ts: proposal.voting_completed_at,
      proposal_id: proposal.id,
      realm_id: proposal.realm_id,
      name: proposal.name,
      state: proposal.state,
    });
  }

  const votes = await getProposalVotes({
    proposalId,
    realmId: proposal.realm_id,
    programId: proposal.program_id,
    limit: 50,
    offset: 0,
  });
  for (const vote of votes.data) {
    events.push({
      type: 'vote_cast',
      ts: vote.cast_at,
      proposal_id: proposal.id,
      realm_id: proposal.realm_id,
      voter: vote.voter,
      side: vote.side,
      weight: vote.weight,
    });
  }

  events.sort((a, b) => {
    const at = toUnixSeconds(a?.ts);
    const bt = toUnixSeconds(b?.ts);
    return bt - at;
  });

  return paginateArray(events, { offset, limit });
}

export async function listProposalFeed({
  realmId,
  eventType,
  fromTs,
  toTs,
  limit = 25,
  offset = 0,
} = {}) {
  const targetRealms = realmId ? [realmId] : getRealmAllowlist();
  const events = [];
  for (const realm of targetRealms) {
    const program = resolveProgramId({ realmId: realm });
    const proposals = await fetchRealmProposals(realm, program);
    for (const proposal of proposals.slice(0, 400)) {
      const normalized = normalizeProposalRow(proposal, realm);
      if (!normalized) continue;
      const draftAt = toUnixSeconds(normalized.draft_at);
      const votingAt = toUnixSeconds(normalized.voting_at);
      if (!eventType || eventType === 'created') {
        events.push({
          type: 'created',
          ts: draftAt,
          proposal_id: normalized.id,
          realm_id: realm,
          proposal_name: normalized.name,
          state: normalized.state,
        });
      }
      if ((!eventType || eventType === 'voting_started') && votingAt > 0) {
        events.push({
          type: 'voting_started',
          ts: votingAt,
          proposal_id: normalized.id,
          realm_id: realm,
          proposal_name: normalized.name,
          state: normalized.state,
        });
      }
    }
  }

  const from = toUnixSeconds(fromTs);
  const to = toUnixSeconds(toTs);
  const filtered = events.filter((event) => {
    const ts = toUnixSeconds(event?.ts);
    if (from > 0 && ts < from) return false;
    if (to > 0 && ts > to) return false;
    if (eventType && !['created', 'voting_started', 'state_changed'].includes(String(eventType))) return true;
    return true;
  });
  const sorted = sortByField(filtered, 'ts', 'desc');
  return paginateArray(sorted, { offset, limit });
}

async function fetchVotesByProposalIds(proposalIds, programId) {
  const program = normalizedProgramId(programId);
  const ids = uniqueStrings(proposalIds);
  if (ids.length === 0) return [];
  const rows = [];
  const chunkSize = 40;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const list = chunk.map((id) => graphqlQuote(id)).join(', ');
    const query = `
      query VotesByProposalIds {
        ${program}_VoteRecordV2(where: {proposal: {_in: [${list}]}} , limit: 5000) {
          proposal
          governingTokenOwner
          voterWeight
          vote
        }
        ${program}_VoteRecordV1(where: {proposal: {_in: [${list}]}} , limit: 5000) {
          proposal
          governingTokenOwner
          voteWeight
        }
      }
    `;
    const data = await runQuery(query);
    const v2 = Array.isArray(data?.[`${program}_VoteRecordV2`]) ? data[`${program}_VoteRecordV2`] : [];
    const v1 = Array.isArray(data?.[`${program}_VoteRecordV1`]) ? data[`${program}_VoteRecordV1`] : [];
    rows.push(...v2, ...v1);
  }
  return rows;
}

async function fetchDepositMapForOwners(realmId, owners, programId) {
  const program = normalizedProgramId(programId);
  const result = new Map();
  const uniqueOwners = uniqueStrings(owners);
  const chunkSize = 150;
  for (let i = 0; i < uniqueOwners.length; i += chunkSize) {
    const chunk = uniqueOwners.slice(i, i + chunkSize);
    const ownerList = chunk.map((owner) => graphqlQuote(owner)).join(', ');
    const realm = graphqlQuote(realmId);
    const query = `
      query DepositsByOwner {
        ${program}_TokenOwnerRecordV2(
          where: {
            _and: [
              {realm: {_eq: ${realm}}},
              {governingTokenOwner: {_in: [${ownerList}]}}
            ]
          },
          limit: 5000
        ) {
          governingTokenOwner
          governingTokenDepositAmount
        }
        ${program}_TokenOwnerRecordV1(
          where: {
            _and: [
              {realm: {_eq: ${realm}}},
              {governingTokenOwner: {_in: [${ownerList}]}}
            ]
          },
          limit: 5000
        ) {
          governingTokenOwner
          governingTokenDepositAmount
        }
      }
    `;
    const data = await runQuery(query);
    const v2 = Array.isArray(data?.[`${program}_TokenOwnerRecordV2`])
      ? data[`${program}_TokenOwnerRecordV2`]
      : [];
    const v1 = Array.isArray(data?.[`${program}_TokenOwnerRecordV1`])
      ? data[`${program}_TokenOwnerRecordV1`]
      : [];
    for (const row of [...v2, ...v1]) {
      const owner = String(row?.governingTokenOwner || '').trim();
      if (!owner) continue;
      const value = toNumber(row?.governingTokenDepositAmount, 0);
      const prev = result.get(owner) || 0;
      result.set(owner, Math.max(prev, value));
    }
  }
  return result;
}

export async function listRealmParticipants({
  realmId,
  programId,
  mode = 'days',
  proposalCount = 2,
  days = 60,
  minVoteWeight = 0,
  minStakedWeight = 0,
} = {}) {
  const program = normalizedProgramId(programId);
  const proposals = await fetchRealmProposals(realmId, program);
  const safeMode = String(mode || 'days').toLowerCase();
  const safeProposalCount = Math.max(1, Math.trunc(toNumber(proposalCount, 2)));
  const safeDays = Math.max(1, Math.trunc(toNumber(days, 60)));
  const now = Math.floor(Date.now() / 1000);
  const fromTs = now - safeDays * 24 * 60 * 60;

  const selectedProposals =
    safeMode === 'latest'
      ? proposals.slice(0, safeProposalCount)
      : proposals.filter((proposal) => toUnixSeconds(proposal?.draftAt) >= fromTs);

  const proposalIds = selectedProposals.map((proposal) => String(proposal?.pubkey || '')).filter(Boolean);
  const voteRows = await fetchVotesByProposalIds(proposalIds, program);
  const minVote = toNumber(minVoteWeight, 0);
  const minStaked = toNumber(minStakedWeight, 0);

  const candidateOwners = new Set();
  for (const row of voteRows) {
    const owner = String(row?.governingTokenOwner || '').trim();
    if (!owner) continue;
    const weight = extractVoteWeight(row);
    if (weight >= minVote) candidateOwners.add(owner);
  }

  let owners = Array.from(candidateOwners);
  if (minStaked > 0 && owners.length > 0) {
    const deposits = await fetchDepositMapForOwners(realmId, owners, program);
    owners = owners.filter((owner) => toNumber(deposits.get(owner), 0) >= minStaked);
  }

  owners.sort((a, b) => a.localeCompare(b));
  return {
    realm_id: realmId,
    mode: safeMode,
    proposal_count: selectedProposals.length,
    participants: owners,
    program_id: program,
  };
}
