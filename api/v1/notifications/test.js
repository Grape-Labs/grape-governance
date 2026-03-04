import legacyTest from '../../notifications-test.js';
import { parseBody, sendMethodNotAllowed } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, req);
  }

  const body = parseBody(req);
  req.method = 'POST';
  req.body = {
    ...body,
    realm: body?.realm || body?.realm_id || '',
  };

  return legacyTest(req, res);
}
