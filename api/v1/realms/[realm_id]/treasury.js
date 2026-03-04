import { getPathParam, getQueryValue, sendError, sendJson, sendMethodNotAllowed } from '../../_http.js';
import { requireApiAccess } from '../../_auth.js';
import { getRealmTreasury, resolveProgramId } from '../../_data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) {
    return;
  }

  const realmId = String(getPathParam(req, 'realm_id', '') || '').trim();
  if (!realmId) {
    return sendError(res, req, 400, 'INVALID_ARGUMENT', 'realm_id is required');
  }

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
