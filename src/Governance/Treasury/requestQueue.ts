// Shared by every wallet card: limiting each card separately still creates bursts.
export function createTreasuryRequestQueue(intervalMs = 400, ttlMs = 30_000) {
    let tail: Promise<any> = Promise.resolve();
    let nextStart = 0;
    const pending = new Map<string, Promise<any>>();
    const cache = new Map<string, { value: any; expires: number }>();
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    return function request<T>(key: string, fetchValue: () => Promise<T>): Promise<T> {
        const now = Date.now();
        for (const [cachedKey, entry] of cache) {
            if (entry.expires <= now) cache.delete(cachedKey);
        }
        const cached = cache.get(key);
        if (cached) return Promise.resolve(cached.value);
        if (pending.has(key)) return pending.get(key)!;
        const result = tail.then(async () => {
            for (let attempt = 0; ; attempt++) {
                await sleep(Math.max(0, nextStart - Date.now()));
                nextStart = Date.now() + intervalMs;
                try {
                    const value = await fetchValue();
                    cache.set(key, { value, expires: Date.now() + ttlMs });
                    return value;
                } catch (error) {
                    if (attempt >= 2 || !/429|too many requests/i.test(String(error))) throw error;
                    // Hold the shared queue during backoff, so other cards don't retry in a burst.
                    nextStart = Date.now() + 2000 * (2 ** attempt);
                }
            }
        });
        pending.set(key, result);
        tail = result.then(() => { pending.delete(key); }, () => { pending.delete(key); });
        return result;
    };
}

export const treasuryRpcRequest = createTreasuryRequestQueue();
export const treasuryPriceRequest = createTreasuryRequestQueue(1500);
