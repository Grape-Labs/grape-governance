import { requireApiAccess } from './_auth.js';
import { sendJson, sendMethodNotAllowed } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) {
    return;
  }

  return sendJson(res, 200, {
    data: {
      api_version: 'v1',
      service: 'governance.so-api',
      endpoints: ['/health', '/meta', '/realms', '/proposals/{proposal_id}', '/events/proposals'],
    },
  });
}
