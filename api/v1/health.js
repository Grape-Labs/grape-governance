import { requireApiAccess } from './_auth.js';
import { SHYFT_GRAPHQL_ENDPOINT } from './_graphql.js';
import { sendJson, sendMethodNotAllowed } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) {
    return;
  }

  sendJson(res, 200, {
    data: {
      status: 'ok',
      service: 'governance.so-api',
      version: 'v1',
      timestamp: new Date().toISOString(),
      dependencies: {
        graphql_endpoint: SHYFT_GRAPHQL_ENDPOINT,
      },
    },
  });
}
