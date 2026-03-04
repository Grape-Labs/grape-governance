import { getRealmAllowlist } from '../_realmPushConfig.js';
import { getApiKey, requireApiAccess } from './_auth.js';
import { DEFAULT_CLUSTER, DEFAULT_PROGRAM_ID } from './_data.js';
import { sendJson, sendMethodNotAllowed } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, req);
  }
  if (!requireApiAccess(req, res, { scope: 'read' })) {
    return;
  }

  const apiKey = getApiKey(req);

  sendJson(res, 200, {
    data: {
      api_version: 'v1',
      default_cluster: DEFAULT_CLUSTER,
      default_program_id: DEFAULT_PROGRAM_ID,
      realms_allowlist: getRealmAllowlist(),
      auth: {
        api_key_present: Boolean(apiKey),
      },
      rate_limits: {
        anonymous_rpm: 60,
        api_key_rpm: 300,
        admin_rpm: 30,
      },
    },
  });
}
