import legacyScan from '../../notifications-scan.js';
import { parseBody, sendMethodNotAllowed } from '../_http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendMethodNotAllowed(res, req);
  }

  const body = parseBody(req);
  const realms = Array.isArray(body?.realm_ids) ? body.realm_ids : [];
  const realmCsv = realms
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .join(',');

  req.method = 'POST';
  req.body = {
    ...body,
    realm: body?.realm || realmCsv || '',
    dryRun: body?.dryRun ?? body?.dry_run ?? false,
  };

  return legacyScan(req, res);
}
