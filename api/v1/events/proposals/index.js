import {
  decodeCursor,
  encodeCursor,
  getQueryValue,
  sendError,
  sendJson,
  sendMethodNotAllowed,
} from '../../_http.js';
import { requireApiAccess } from '../../_auth.js';
import { listProposalFeed } from '../../_data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) {
    return;
  }

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
