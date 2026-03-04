import { parseBoolean, sendError, splitCsv, toNumber } from './_http.js';

const WINDOW_MS = 60 * 1000;
const RATE_BUCKETS = new Map();

function getHeaderValue(req, key) {
  const value = req?.headers?.[key];
  if (Array.isArray(value)) return value[0] || '';
  return String(value || '');
}

function normalizeSecretValues(values) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
}

function getSecretSetFromEnv(envKeys) {
  const joined = envKeys
    .map((envKey) => process.env[envKey])
    .filter(Boolean)
    .join(',');
  return new Set(normalizeSecretValues(splitCsv(joined)));
}

function wildcardMatch(input, pattern) {
  if (!pattern) return false;
  if (pattern === '*') return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(input);
}

function matchesAnyPattern(value, patterns) {
  if (!value || !Array.isArray(patterns) || patterns.length === 0) return false;
  for (const pattern of patterns) {
    if (wildcardMatch(value, pattern)) return true;
  }
  return false;
}

function getForwardedFor(req) {
  const forwarded = getHeaderValue(req, 'x-forwarded-for');
  if (!forwarded) return '';
  const first = forwarded.split(',')[0]?.trim();
  return first || '';
}

function getClientIp(req) {
  return (
    getForwardedFor(req) ||
    getHeaderValue(req, 'x-real-ip') ||
    req?.socket?.remoteAddress ||
    req?.connection?.remoteAddress ||
    ''
  );
}

function getRateLimitForScope(scope = 'read') {
  const readRpm = Math.max(1, Math.trunc(toNumber(process.env.API_V1_READ_RPM, 20)));
  const adminRpm = Math.max(1, Math.trunc(toNumber(process.env.API_V1_ADMIN_RPM, 5)));
  return scope === 'admin' ? adminRpm : readRpm;
}

function checkRateLimit(bucketId, limit, now = Date.now()) {
  const windowStart = now - WINDOW_MS;
  const records = RATE_BUCKETS.get(bucketId) || [];
  const active = records.filter((ts) => ts > windowStart);
  if (active.length >= limit) {
    RATE_BUCKETS.set(bucketId, active);
    const retryAfterSec = Math.max(1, Math.ceil((active[0] + WINDOW_MS - now) / 1000));
    return {
      ok: false,
      retryAfterSec,
      remaining: 0,
    };
  }
  active.push(now);
  RATE_BUCKETS.set(bucketId, active);
  return {
    ok: true,
    retryAfterSec: 0,
    remaining: Math.max(0, limit - active.length),
  };
}

function setRateHeaders(res, limit, remaining, retryAfterSec = 0) {
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + 60));
  if (retryAfterSec > 0) {
    res.setHeader('Retry-After', String(retryAfterSec));
  }
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

  if (!required) return false;

  const bearer = getBearerToken(req);
  const xCron = getHeaderValue(req, 'x-cron-secret');
  const xPush = getHeaderValue(req, 'x-push-test-secret');

  return bearer === required || xCron === required || xPush === required;
}

function enforceAllowedOrigin(req, res) {
  const allowlist = normalizeSecretValues(splitCsv(process.env.API_V1_ALLOWED_ORIGINS || ''));
  if (allowlist.length === 0) return true;
  const origin = getHeaderValue(req, 'origin');
  if (!origin) return true;
  if (matchesAnyPattern(origin, allowlist)) return true;
  sendError(res, req, 403, 'FORBIDDEN', 'Origin is not allowed');
  return false;
}

function enforceAllowedIp(req, res) {
  const allowlist = normalizeSecretValues(splitCsv(process.env.API_V1_IP_ALLOWLIST || ''));
  if (allowlist.length === 0) return true;
  const clientIp = getClientIp(req);
  if (!clientIp) {
    sendError(res, req, 403, 'FORBIDDEN', 'Client IP is required');
    return false;
  }
  if (matchesAnyPattern(clientIp, allowlist)) return true;
  sendError(res, req, 403, 'FORBIDDEN', 'IP is not allowed');
  return false;
}

function enforceApiKey(req, res, scope = 'read') {
  const readKeys = getSecretSetFromEnv(['API_V1_KEYS', 'GOVSO_API_KEYS']);
  const adminKeys = getSecretSetFromEnv(['API_V1_ADMIN_KEYS', 'GOVSO_ADMIN_KEYS']);
  const token = String(getApiKey(req) || '').trim();

  if (scope === 'admin') {
    if (isAdminAuthorized(req)) return true;
    if (adminKeys.size > 0 && token && adminKeys.has(token)) return true;
    sendError(res, req, 401, 'UNAUTHORIZED', 'Admin token required');
    return false;
  }

  const accepted = new Set([...readKeys, ...adminKeys]);
  if (accepted.size === 0) {
    sendError(res, req, 503, 'FORBIDDEN', 'API access not configured');
    return false;
  }
  if (!token) {
    sendError(res, req, 401, 'UNAUTHORIZED', 'API token required');
    return false;
  }
  if (!accepted.has(token)) {
    sendError(res, req, 403, 'FORBIDDEN', 'Invalid API token');
    return false;
  }
  return true;
}

function enforceRateLimit(req, res, scope = 'read') {
  const limit = getRateLimitForScope(scope);
  const key = String(getApiKey(req) || getClientIp(req) || 'anonymous');
  const bucketId = `${scope}:${key}`;
  const result = checkRateLimit(bucketId, limit);
  setRateHeaders(res, limit, result.remaining, result.retryAfterSec);
  if (!result.ok) {
    sendError(res, req, 429, 'RATE_LIMITED', 'Rate limit exceeded');
    return false;
  }
  return true;
}

export function requireApiAccess(req, res, { scope = 'read' } = {}) {
  const strict = parseBoolean(process.env.API_V1_STRICT ?? 'true', true);
  if (!strict) return true;

  if (!enforceAllowedOrigin(req, res)) return false;
  if (!enforceAllowedIp(req, res)) return false;
  if (!enforceApiKey(req, res, scope)) return false;
  if (!enforceRateLimit(req, res, scope)) return false;

  return true;
}
