import {
  decodeCursor,
  encodeCursor,
  getPathParam,
  getQueryValue,
  sendError,
  sendJson,
  sendMethodNotAllowed,
} from '../../_http.js';
import { listRealmWallets, resolveProgramId } from '../../_data.js';

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
