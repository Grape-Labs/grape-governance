import {
  decodeCursor,
  encodeCursor,
  getPathParam,
  getQueryValue,
  sendError,
  sendJson,
  sendMethodNotAllowed,
} from '../../_http.js';
import { requireApiAccess } from '../../_auth.js';
import { getProposalVotes } from '../../_data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) {
    return;
  }

  const proposalId = String(getPathParam(req, 'proposal_id', '') || '').trim();
  if (!proposalId) {
    return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');
  }

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
