import { getPathParam, getQueryValue, sendError, sendJson, sendMethodNotAllowed } from '../_http.js';
import { getProposal } from '../_data.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }

  const proposalId = String(getPathParam(req, 'proposal_id', '') || '').trim();
  if (!proposalId) {
    return sendError(res, req, 400, 'INVALID_ARGUMENT', 'proposal_id is required');
  }

  try {
    const proposal = await getProposal({
      proposalId,
      realmId: getQueryValue(req, 'realm_id'),
      programId: getQueryValue(req, 'program_id'),
    });
    if (!proposal) {
      return sendError(res, req, 404, 'NOT_FOUND', 'Proposal not found', {
        proposal_id: proposalId,
      });
    }
    return sendJson(res, 200, { data: proposal });
  } catch (error) {
    return sendError(res, req, 500, 'INTERNAL', 'Failed to fetch proposal', {
      details: String(error?.message || error),
    });
  }
}
