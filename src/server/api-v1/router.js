import legacyRegister from '../../../api/notifications-register.js';
import legacyScan from '../../../api/notifications-scan.js';
import legacyTest from '../../../api/notifications-test.js';
import { getRealmAllowlist } from '../../../api/_realmPushConfig.js';
import { getApiKey, requireApiAccess } from './_auth.js';
import {
  DEFAULT_CLUSTER,
  DEFAULT_PROGRAM_ID,
  getProposal,
  getProposalEvents,
  getProposalInstructions,
  getProposalVotes,
  getRealm,
  getRealmStats,
  getRealmTreasury,
  listProposalFeed,
  listRealmMembers,
  listRealmParticipants,
  listRealmProposals,
  listRealms,
  listRealmWallets,
  resolveProgramId,
} from './_data.js';
import { SHYFT_GRAPHQL_ENDPOINT } from './_graphql.js';
import {
  decodeCursor,
  encodeCursor,
  getQueryValue,
  parseBody,
  parseSort,
  sendError,
  sendJson,
  sendMethodNotAllowed,
  toNumber,
} from './_http.js';

function getPathSuffix(req) {
  const queryPath = req?.query?.path;
  if (Array.isArray(queryPath)) {
    return queryPath.join('/');
  }
  if (typeof queryPath === 'string' && queryPath.trim()) {
    return queryPath.trim().replace(/^\/+/, '');
  }

  const url = String(req?.url || '/');
  const parsed = new URL(url, 'http://localhost');
  return parsed.pathname.replace(/^\/api\/v1\/?/, '').replace(/^\/+/, '');
}

function splitPathSegments(req) {
  const suffix = getPathSuffix(req);
  if (!suffix) return [];
  return suffix
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

function isGet(req) {
  return String(req?.method || '').toUpperCase() === 'GET';
}

function getConfiguredReadRpm() {
  return Math.max(1, Math.trunc(toNumber(process.env.API_V1_READ_RPM, 20)));
}

function getConfiguredAdminRpm() {
  return Math.max(1, Math.trunc(toNumber(process.env.API_V1_ADMIN_RPM, 5)));
}

async function handleIndex(req, res) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;

  return sendJson(res, 200, {
    data: {
      api_version: 'v1',
      service: 'governance.so-api',
      endpoints: ['/health', '/meta', '/realms', '/proposals/{proposal_id}', '/events/proposals'],
    },
  });
}

async function handleHealth(req, res) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;

  return sendJson(res, 200, {
    data: {
      status: 'ok',
      service: 'governance.so-api',
      version: 'v1',
      timestamp: new Date().toISOString(),
      dependencies: {
        graphql_endpoint: SHYFT_GRAPHQL_ENDPOINT,
      },
    },
  });
}

async function handleMeta(req, res) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;

  const apiKey = getApiKey(req);
  return sendJson(res, 200, {
    data: {
      api_version: 'v1',
      default_cluster: DEFAULT_CLUSTER,
      default_program_id: DEFAULT_PROGRAM_ID,
      realms_allowlist: getRealmAllowlist(),
      auth: {
        api_key_present: Boolean(apiKey),
      },
      rate_limits: {
        read_rpm: getConfiguredReadRpm(),
        admin_rpm: getConfiguredAdminRpm(),
      },
    },
  });
}

async function handleRealms(req, res) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;

  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const { sortBy, sortOrder } = parseSort(req, 'name', 'asc');
    const programId = resolveProgramId({ programId: getQueryValue(req, 'program_id') });

    const result = await listRealms({
      programId,
      search: getQueryValue(req, 'search'),
      verified: getQueryValue(req, 'verified'),
      activeVoting: getQueryValue(req, 'active_voting'),
      minProposals: getQueryValue(req, 'min_proposals'),
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
      sortBy,
      sortOrder,
    });

    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor !== null ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to list realms', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmGet(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });
    const realm = await getRealm({ realmId, programId });
    if (!realm) {
      return sendError(res, req, 404, 'NOT_FOUND', 'Realm not found', { realm_id: realmId });
    }
    return sendJson(res, 200, { data: realm });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch realm', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmStats(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });
    const stats = await getRealmStats(realmId, programId);
    return sendJson(res, 200, { data: stats });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch realm stats', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmMembers(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const { sortBy, sortOrder } = parseSort(req, 'voting_power', 'desc');
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });

    const result = await listRealmMembers({
      realmId,
      programId,
      mint: getQueryValue(req, 'mint', 'all'),
      minVotingPower: getQueryValue(req, 'min_voting_power'),
      includeInactive: getQueryValue(req, 'include_inactive'),
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
      sortBy,
      sortOrder,
    });

    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor !== null ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to list realm members', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmTreasury(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });
    const summary = await getRealmTreasury({ realmId, programId });
    return sendJson(res, 200, { data: summary });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch treasury summary', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmWallets(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });
    const result = await listRealmWallets({
      realmId,
      programId,
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
    });

    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to list wallets', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmProposals(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const { sortBy, sortOrder } = parseSort(req, 'draft_at', 'desc');
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });
    const result = await listRealmProposals({
      realmId,
      programId,
      state: getQueryValue(req, 'state'),
      fromTs: getQueryValue(req, 'from_ts'),
      toTs: getQueryValue(req, 'to_ts'),
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
      sortBy,
      sortOrder,
    });

    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to list proposals', {
      details: String(error?.message || error),
    });
  }
}

async function handleRealmParticipants(req, res, realmId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!realmId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');

  try {
    const programId = resolveProgramId({
      realmId,
      programId: getQueryValue(req, 'program_id'),
    });
    const result = await listRealmParticipants({
      realmId,
      programId,
      mode: getQueryValue(req, 'mode', 'days'),
      proposalCount: getQueryValue(req, 'proposal_count'),
      days: getQueryValue(req, 'days'),
      minVoteWeight: getQueryValue(req, 'min_vote_weight'),
      minStakedWeight: getQueryValue(req, 'min_staked_weight'),
    });

    const format = String(getQueryValue(req, 'format', 'json') || 'json').toLowerCase();
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.status(200).send(result.participants.join(','));
      return;
    }

    return sendJson(res, 200, {
      data: {
        realm_id: result.realm_id,
        mode: result.mode,
        proposal_count: result.proposal_count,
        participants: result.participants,
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to list participants', {
      details: String(error?.message || error),
    });
  }
}

async function handleProposalGet(req, res, proposalId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!proposalId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');

  try {
    const proposal = await getProposal({
      proposalId,
      realmId: getQueryValue(req, 'realm_id'),
      programId: getQueryValue(req, 'program_id'),
    });
    if (!proposal) {
      return sendError(res, req, 404, 'NOT_FOUND', 'Proposal not found', { proposal_id: proposalId });
    }
    return sendJson(res, 200, { data: proposal });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch proposal', {
      details: String(error?.message || error),
    });
  }
}

async function handleProposalInstructions(req, res, proposalId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!proposalId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');

  try {
    const result = await getProposalInstructions({
      proposalId,
      realmId: getQueryValue(req, 'realm_id'),
      programId: getQueryValue(req, 'program_id'),
    });
    return sendJson(res, 200, {
      data: result.data,
      meta: {
        proposal_id: proposalId,
        program_id: result.program_id,
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch proposal instructions', {
      details: String(error?.message || error),
    });
  }
}

async function handleProposalVotes(req, res, proposalId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!proposalId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');

  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const result = await getProposalVotes({
      proposalId,
      realmId: getQueryValue(req, 'realm_id'),
      programId: getQueryValue(req, 'program_id'),
      side: getQueryValue(req, 'side'),
      minWeight: getQueryValue(req, 'min_weight'),
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
    });
    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
      meta: {
        proposal_id: proposalId,
        program_id: result.program_id,
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch proposal votes', {
      details: String(error?.message || error),
    });
  }
}

async function handleProposalEvents(req, res, proposalId) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  if (!proposalId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');

  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const result = await getProposalEvents({
      proposalId,
      realmId: getQueryValue(req, 'realm_id'),
      programId: getQueryValue(req, 'program_id'),
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
    });
    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch proposal events', {
      details: String(error?.message || error),
    });
  }
}

async function handleEventsProposals(req, res) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  try {
    const cursor = decodeCursor(getQueryValue(req, 'cursor'));
    const result = await listProposalFeed({
      realmId: getQueryValue(req, 'realm_id'),
      eventType: getQueryValue(req, 'event_type'),
      fromTs: getQueryValue(req, 'from_ts'),
      toTs: getQueryValue(req, 'to_ts'),
      limit: getQueryValue(req, 'limit'),
      offset: cursor.offset,
    });
    return sendJson(res, 200, {
      data: result.data,
      page: {
        next_cursor: result.nextCursor ? encodeCursor(result.nextCursor) : null,
        has_more: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch proposal events feed', {
      details: String(error?.message || error),
    });
  }
}

async function handleEventsProposalsStream(req, res) {
  if (!isGet(req)) return sendMethodNotAllowed(res, req);
  if (!requireApiAccess(req, res, { scope: 'read' })) return;
  try {
    const snapshot = await listProposalFeed({
      realmId: getQueryValue(req, 'realm_id'),
      eventType: getQueryValue(req, 'event_type'),
      limit: getQueryValue(req, 'limit', 25),
      offset: 0,
    });
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.write('event: snapshot\n');
    res.write(`data: ${JSON.stringify(snapshot.data)}\n\n`);
    res.end();
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to stream proposal events', {
      details: String(error?.message || error),
    });
  }
}

async function handleNotificationsSubscriptions(req, res) {
  const method = String(req?.method || '').toUpperCase();
  if (method !== 'POST' && method !== 'DELETE') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) return;

  const body = parseBody(req);
  const realmId = String(body?.realm_id || body?.realm || '').trim();
  const token = String(body?.token || '').trim();
  const enabled = method === 'DELETE' ? false : body?.enabled !== false;

  req.method = 'POST';
  req.body = { realm: realmId, token, enabled };
  return legacyRegister(req, res);
}

async function handleNotificationsScan(req, res) {
  if (String(req?.method || '').toUpperCase() !== 'POST') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'admin' })) return;

  const body = parseBody(req);
  const realms = Array.isArray(body?.realm_ids) ? body.realm_ids : [];
  const realmCsv = realms
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(',');

  req.method = 'POST';
  req.body = {
    ...body,
    realm: body?.realm || realmCsv || '',
    dryRun: body?.dryRun ?? body?.dry_run ?? false,
  };
  return legacyScan(req, res);
}

async function handleNotificationsTest(req, res) {
  if (String(req?.method || '').toUpperCase() !== 'POST') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'admin' })) return;

  const body = parseBody(req);
  req.method = 'POST';
  req.body = { ...body, realm: body?.realm || body?.realm_id || '' };
  return legacyTest(req, res);
}

export default async function routeApiV1(req, res) {
  const segments = splitPathSegments(req);
  if (segments.length === 0) {
    return handleIndex(req, res);
  }

  if (segments[0] === 'health') {
    return handleHealth(req, res);
  }
  if (segments[0] === 'meta') {
    return handleMeta(req, res);
  }

  if (segments[0] === 'realms') {
    if (segments.length === 1) return handleRealms(req, res);
    const realmId = segments[1];
    if (segments.length === 2) return handleRealmGet(req, res, realmId);
    if (segments[2] === 'stats') return handleRealmStats(req, res, realmId);
    if (segments[2] === 'members') return handleRealmMembers(req, res, realmId);
    if (segments[2] === 'treasury') return handleRealmTreasury(req, res, realmId);
    if (segments[2] === 'wallets') return handleRealmWallets(req, res, realmId);
    if (segments[2] === 'proposals') return handleRealmProposals(req, res, realmId);
    if (segments[2] === 'participants') return handleRealmParticipants(req, res, realmId);
    return sendError(res, req, 404, 'NOT_FOUND', 'Route not found');
  }

  if (segments[0] === 'proposals') {
    const proposalId = segments[1] || '';
    if (!proposalId) return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');
    if (segments.length === 2) return handleProposalGet(req, res, proposalId);
    if (segments[2] === 'instructions') return handleProposalInstructions(req, res, proposalId);
    if (segments[2] === 'votes') return handleProposalVotes(req, res, proposalId);
    if (segments[2] === 'events') return handleProposalEvents(req, res, proposalId);
    return sendError(res, req, 404, 'NOT_FOUND', 'Route not found');
  }

  if (segments[0] === 'events' && segments[1] === 'proposals') {
    if (segments.length === 2) return handleEventsProposals(req, res);
    if (segments[2] === 'stream') return handleEventsProposalsStream(req, res);
    return sendError(res, req, 404, 'NOT_FOUND', 'Route not found');
  }

  if (segments[0] === 'notifications') {
    if (segments[1] === 'subscriptions') return handleNotificationsSubscriptions(req, res);
    if (segments[1] === 'scan') return handleNotificationsScan(req, res);
    if (segments[1] === 'test') return handleNotificationsTest(req, res);
    return sendError(res, req, 404, 'NOT_FOUND', 'Route not found');
  }

  return sendError(res, req, 404, 'NOT_FOUND', 'Route not found');
}
