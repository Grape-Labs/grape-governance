import { getPathParam, getQueryValue, sendError, sendJson, sendMethodNotAllowed } from '../../_http.js';
import { requireApiAccess } from '../../_auth.js';
import { listRealmParticipants, resolveProgramId } from '../../_data.js';

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
