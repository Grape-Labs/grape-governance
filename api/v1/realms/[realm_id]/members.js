import {
  decodeCursor,
  encodeCursor,
  getPathParam,
  getQueryValue,
  parseSort,
  sendError,
  sendJson,
  sendMethodNotAllowed,
} from '../../_http.js';
import { listRealmMembers, resolveProgramId } from '../../_data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }

  const realmId = String(getPathParam(req, 'realm_id', '') || '').trim();
  if (!realmId) {
    return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');
  }

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
