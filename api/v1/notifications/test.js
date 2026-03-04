import legacyTest from '../../notifications-test.js';
import { requireApiAccess } from '../_auth.js';
import { parseBody, sendMethodNotAllowed } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'admin' })) {
    return;
  }

  const body = parseBody(req);
  req.method = 'POST';
  req.body = {
    ...body,
    realm: body?.realm || body?.realm_id || '',
  };

  return legacyTest(req, res);
}
