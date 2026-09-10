export class ProviderError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function configuredKeys(env = process.env) {
  const key = env.REACT_APP_API_HELIUS?.trim();
  return key ? [key] : [];
}

export async function providerRequest(service, makeUrl, options = {}) {
  const [key] = configuredKeys();
  if (!key) throw new ProviderError('PROVIDER_NOT_CONFIGURED',
    'Grant tracking is not configured on this deployment. Set REACT_APP_API_HELIUS in the Vercel Production environment and redeploy.');
  try {
    const response = await fetch(makeUrl(encodeURIComponent(key)), {
      ...options, signal: AbortSignal.timeout(8000),
    });
    if ([401, 403].includes(response.status)) throw new ProviderError('PROVIDER_ACCESS_DENIED',
      'Helius rejected REACT_APP_API_HELIUS. Check that this key permits server requests and transaction-history access, then redeploy.');
    if (response.status === 429) throw new ProviderError('PROVIDER_RATE_LIMITED',
      'The transaction provider is rate-limiting requests. Please wait briefly and retry.', 429);
    if (!response.ok) throw new Error('Upstream error');
    const data = await response.json();
    if (data.error || (service === 'history' ? !Array.isArray(data) : !Array.isArray(data.result?.value))) {
      throw new Error('Invalid response');
    }
    return data;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (['TimeoutError', 'AbortError'].includes(error.name)) throw new ProviderError('PROVIDER_TIMEOUT',
      'The transaction provider took too long to respond. Please retry.', 504);
    throw new ProviderError('PROVIDER_UNAVAILABLE', 'The transaction provider is temporarily unavailable. Please retry.', 502);
  }
}
