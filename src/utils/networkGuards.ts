import axios from 'axios';

const BLOCKED_HOSTS = new Set(['shdw-drive.genesysgo.net']);

const INSTALL_FLAG = '__grapeNetworkGuardsInstalled__';
const AXIOS_INTERCEPTOR_FLAG = '__grapeBlockedHostAxiosInterceptorId__';

const BLOCKED_PAYLOAD = {
  error: {
    code: 'HOST_BLOCKED',
    message: 'Request skipped for blocked host',
  },
};

function getUrlFromFetchInput(input: RequestInfo | URL): string | null {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return null;
}

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

function isBlockedHostUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return BLOCKED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function createBlockedResponse(): Response {
  return new Response(JSON.stringify(BLOCKED_PAYLOAD), {
    status: 503,
    statusText: 'Blocked host',
    headers: { 'Content-Type': 'application/json' },
  });
}

export function installNetworkGuards() {
  if (typeof window === 'undefined') return;

  const globalScope = globalThis as Record<string, unknown>;
  if (globalScope[INSTALL_FLAG]) return;
  globalScope[INSTALL_FLAG] = true;

  const originalFetch = globalThis.fetch.bind(globalThis);
  const guardedFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = getUrlFromFetchInput(input);
    const resolved = rawUrl ? resolveUrl(rawUrl, window.location.href) : null;
    if (isBlockedHostUrl(resolved)) {
      console.warn('[network-guard] blocked fetch:', resolved);
      return Promise.resolve(createBlockedResponse());
    }
    return originalFetch(input, init);
  };

  globalThis.fetch = guardedFetch;
  window.fetch = guardedFetch;

  if (globalScope[AXIOS_INTERCEPTOR_FLAG] !== undefined) return;
  const interceptorId = axios.interceptors.request.use((config) => {
    const rawUrl = typeof config.url === 'string' ? config.url : null;
    const baseUrl =
      typeof config.baseURL === 'string' && config.baseURL.length > 0
        ? config.baseURL
        : window.location.href;
    const resolved = rawUrl ? resolveUrl(rawUrl, baseUrl) : null;
    if (isBlockedHostUrl(resolved)) {
      const error = new Error(`Blocked outbound request: ${resolved}`);
      (error as Error & { code?: string }).code = 'HOST_BLOCKED';
      return Promise.reject(error);
    }
    return config;
  });

  globalScope[AXIOS_INTERCEPTOR_FLAG] = interceptorId;
}
