import {
  decodeCursor,
  encodeCursor,
  getQueryValue,
  parseSort,
  sendError,
  sendJson,
  sendMethodNotAllowed,
} from '../_http.js';
import { listRealms, resolveProgramId } from '../_data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }

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
