function getHeaderValue(req, key) {
  const value = req?.headers?.[key];
  if (Array.isArray(value)) return value[0] || '';
  return String(value || '');
}

export function getBearerToken(req) {
  const auth = getHeaderValue(req, 'authorization');
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export function getApiKey(req) {
  const headerKey = getHeaderValue(req, 'x-api-key');
  if (headerKey) return headerKey;
  return getBearerToken(req);
}

export function isAdminAuthorized(req) {
  const required =
    process.env.REALM_PUSH_CRON_SECRET ||
    process.env.REALM_PUSH_TEST_SECRET ||
    process.env.CRON_SECRET ||
    '';

  if (!required) return true;

  const bearer = getBearerToken(req);
  const xCron = getHeaderValue(req, 'x-cron-secret');
  const xPush = getHeaderValue(req, 'x-push-test-secret');

  return bearer === required || xCron === required || xPush === required;
}
