import legacyRegister from '../../notifications-register.js';
import { parseBody, sendMethodNotAllowed } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return sendMethodNotAllowed(res, req);
  }

  const body = parseBody(req);
  const realmId = String(body?.realm_id || body?.realm || '').trim();
  const token = String(body?.token || '').trim();
  const enabled = req.method === 'DELETE' ? false : body?.enabled !== false;

  req.method = 'POST';
  req.body = {
    realm: realmId,
    token,
    enabled,
  };

  return legacyRegister(req, res);
}
