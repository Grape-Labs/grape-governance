import { getQueryValue, sendError, sendMethodNotAllowed } from '../../_http.js';
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
