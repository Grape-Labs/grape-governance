// This cache is for directory membership only, never voting power or eligibility.
export function createParticipatingDaoCache({storage = () => globalThis.localStorage, now = Date.now} = {}) {
  const memory = new Map();
  const pending = new Map();
  const ttl = 15 * 60 * 1000;
  const partialTtl = 60 * 1000;
  const keyFor = (wallet, endpoint) => `governance:participating:v1:${JSON.stringify([wallet, endpoint])}`;
  function read(wallet, endpoint) {
    const key = keyFor(wallet, endpoint);
    let entry = memory.get(key);
    if (!entry) {
      try { entry = JSON.parse(storage()?.getItem(key) || 'null'); } catch { return null; }
    }
    if (!entry || !Array.isArray(entry.realms) || !entry.realms.every(v => typeof v === 'string') ||
        !Array.isArray(entry.failedPrograms) || !entry.failedPrograms.every(v => typeof v === 'string') ||
        !Number.isFinite(entry.at) || entry.at > now()) return null;
    return {...entry, records:entry.realms.map(realm => ({account:{realm}})), fresh:now()-entry.at < (entry.failedPrograms.length ? partialTtl : ttl)};
  }
  async function load(wallet, endpoint, fetchMemberships, force = false) {
    const key = keyFor(wallet, endpoint);
    const cached = read(wallet, endpoint);
    if (!force && cached?.fresh) return cached;
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      const result = await fetchMemberships(wallet);
      if (!Array.isArray(result?.records) || !Array.isArray(result?.failedPrograms)) throw new Error('Invalid membership response');
      const realms = result.records.map(record => record.account?.realm?.toBase58?.() || record.account?.realm).filter(v => typeof v === 'string' && v);
      // A failed program must not remove previously discovered memberships.
      const entry = {at:now(), realms:[...new Set([...(result.failedPrograms.length ? cached?.realms || [] : []), ...realms])], failedPrograms:result.failedPrograms};
      memory.set(key, entry);
      if (memory.size > 32) memory.delete(memory.keys().next().value);
      try { storage()?.setItem(key, JSON.stringify(entry)); } catch { /* Storage can be unavailable or full. */ }
      return {...entry, records:entry.realms.map(realm => ({account:{realm}})), fresh:true};
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  }
  return {read, load};
}
export const participatingDaoCache = createParticipatingDaoCache();
