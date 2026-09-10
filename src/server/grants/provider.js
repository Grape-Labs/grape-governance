const workingKeys = new Map();

export class ProviderError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function configuredKeys(env = process.env) {
  const values = [
    env.REACT_APP_API_HELIUS, env.HELIUS_API_KEY,
    env.REACT_APP_API_HELIUS, env.REACT_APP_API_HELIUS_BKP2,
    env.REACT_APP_API_HELIUS_BKP3, env.REACT_APP_API_HELIUS_BKP4,
  ];
  // Some deployments configure an RPC URL instead of a separate key.
  for (const value of [env.HELIUS_RPC_URL, env.HELIUS_RPC_ENDPOINT, env.REACT_APP_API_HELIUS_RPC_ENDPOINT]) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && (url.hostname === 'helius-rpc.com' || url.hostname.endsWith('.helius-rpc.com'))) {
        values.push(url.searchParams.get('api-key'));
      }
    } catch { /* Not a configured Helius RPC URL. */ }
  }
  return [...new Set(values.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean))];
}

export async function providerRequest(service, makeUrl, options = {}) {
  const configured = configuredKeys();
  if (!configured.length) throw new ProviderError('PROVIDER_NOT_CONFIGURED',
    'Grant tracking is not configured on this deployment. Set GRANT_TRACKING_HELIUS_API_KEY in the Vercel Production environment and redeploy.');
  // Only cache a preference within the configured keys and the same service.
  const preferred = workingKeys.get(service);
  const keys = [...configured].sort((a,b) => Number(b === preferred) - Number(a === preferred));
  const errors = [];
  const deadline = Date.now() + 24000;
  for (const key of keys) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) { errors.push('timeout'); break; }
    try {
      const response = await fetch(makeUrl(encodeURIComponent(key)), {
        ...options, signal: AbortSignal.timeout(Math.min(8000, remaining)),
      });
      if (!response.ok) {
        errors.push([401,403].includes(response.status) ? 'auth' : response.status === 429 ? 'rate' : 'upstream');
        continue;
      }
      const data = await response.json();
      if (data.error || (service === 'history' ? !Array.isArray(data) : !Array.isArray(data.result?.value))) {
        errors.push('upstream'); continue;
      }
      workingKeys.set(service, key);
      return data;
    } catch (error) {
      errors.push(['TimeoutError','AbortError'].includes(error.name) ? 'timeout' : 'upstream');
    }
  }
  if (errors.every(e => e === 'auth')) throw new ProviderError('PROVIDER_ACCESS_DENIED',
    'The configured Helius keys were rejected. Set a valid server key with transaction-history access as GRANT_TRACKING_HELIUS_API_KEY in Vercel and redeploy.');
  if (errors.includes('rate')) throw new ProviderError('PROVIDER_RATE_LIMITED',
    'The transaction provider is rate-limiting requests. Please wait briefly and retry.', 429);
  if (errors.includes('timeout')) throw new ProviderError('PROVIDER_TIMEOUT',
    'The transaction provider took too long to respond. Please retry.', 504);
  throw new ProviderError('PROVIDER_UNAVAILABLE', 'The transaction provider is temporarily unavailable. Please retry.', 502);
}
