const DEFAULT_REALM = 'By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip';
const DEFAULT_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getRealmAllowlist() {
  const envRealms = splitCsv(process.env.REALM_PUSH_REALM_ALLOWLIST);
  if (envRealms.length > 0) return Array.from(new Set(envRealms));
  return [DEFAULT_REALM];
}

export function isRealmAllowed(realm) {
  if (!realm) return false;
  return getRealmAllowlist().includes(String(realm));
}

export function getProgramIdForRealm(realm) {
  const fallback = process.env.REALM_PUSH_PROGRAM_ID || DEFAULT_PROGRAM_ID;
  const rawOverrides = process.env.REALM_PUSH_REALM_PROGRAM_OVERRIDES;
  if (!rawOverrides) return fallback;

  try {
    const parsed = JSON.parse(rawOverrides);
    if (parsed && typeof parsed === 'object' && parsed[String(realm)]) {
      return String(parsed[String(realm)]);
    }
  } catch (e) {
    console.warn('Invalid REALM_PUSH_REALM_PROGRAM_OVERRIDES JSON');
  }

  return fallback;
}

export function getAppBaseUrl(req) {
  const explicit = process.env.REALM_PUSH_APP_URL || process.env.APP_URL;
  if (explicit) return String(explicit).replace(/\/+$/, '');

  const host = req?.headers?.host;
  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const protocol = forwardedProto ? String(forwardedProto) : 'https';
  if (host) return `${protocol}://${host}`;

  return 'https://governance.so';
}
