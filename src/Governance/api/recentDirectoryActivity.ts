import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

const LIMIT = 100;
const TTL = 5 * 60 * 1000;
const caches = new WeakMap<object, Map<string, { expiresAt: number; result?: any; pending?: Promise<any> }>>();
const key = (value: any): string => value?.toBase58?.() || String(value || '');

export function proposalsFromTransaction(transaction: any, programIds: Set<string>): any[] {
  if (!transaction || transaction.meta?.err) return [];
  const instructions = [
    ...(transaction.transaction?.message?.instructions || []),
    ...(transaction.meta?.innerInstructions || []).flatMap((group: any) => group.instructions || []),
  ];
  const proposals = new Map<string, any>();
  for (const instruction of instructions) {
    if (!programIds.has(key(instruction.programId)) || !instruction.data || instruction.accounts?.length < 3) continue;
    try {
      const bytes = Buffer.from(bs58.decode(instruction.data));
      // SPL Governance CreateProposal: discriminator, Borsh name, description.
      if (bytes.length < 5 || bytes[0] !== 6) continue;
      const length = bytes.readUInt32LE(1);
      if (length > bytes.length - 5) continue;
      const pubkey = key(instruction.accounts[1]);
      proposals.set(pubkey, {
        pubkey, realm: key(instruction.accounts[0]), governance: key(instruction.accounts[2]),
        draftAt: transaction.blockTime || 0, name: bytes.subarray(5, 5 + length).toString('utf8'),
      });
    } catch { /* Ignore instructions that do not match the governance schema. */ }
  }
  return Array.from(proposals.values());
}

export async function fetchRecentDirectoryActivity(connection: any, programs: string[]) {
  const programIds = Array.from(new Set(programs)).sort();
  const cacheKey = programIds.join(',');
  let cache = caches.get(connection);
  if (!cache) { cache = new Map(); caches.set(connection, cache); }
  const previous = cache.get(cacheKey);
  if (previous?.pending) return previous.pending;
  if (previous?.result && previous.expiresAt > Date.now()) return previous.result;
  const pending = (async () => {
    const signatures = new Map<string, any>();
    let partial = false;
    // Only signature metadata is requested per program; transaction bodies are capped globally.
    for (let offset = 0; offset < programIds.length; offset += 3) {
      await Promise.all(programIds.slice(offset, offset + 3).map(async program => {
        try {
          const rows = await connection.getSignaturesForAddress(new PublicKey(program), { limit: LIMIT }, 'confirmed');
          for (const row of rows) if (!row.err) signatures.set(row.signature, row);
        } catch { partial = true; }
      }));
    }
    const latest = Array.from(signatures.values()).sort((a, b) => b.slot - a.slot).slice(0, LIMIT);
    const proposals = new Map<string, any>();
    for (let offset = 0; offset < latest.length; offset += 4) {
      await Promise.all(latest.slice(offset, offset + 4).map(async row => {
        try {
          const transaction = await connection.getParsedTransaction(row.signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
          if (!transaction) { partial = true; return; }
          for (const proposal of proposalsFromTransaction(transaction, new Set(programIds))) proposals.set(proposal.pubkey, proposal);
        } catch { partial = true; }
      }));
    }
    const result = { proposals: Array.from(proposals.values()).sort((a, b) => b.draftAt - a.draftAt).slice(0, LIMIT), partial, scanned: latest.length };
    cache!.set(cacheKey, { result, expiresAt: Date.now() + (partial ? 30000 : TTL) });
    return result;
  })();
  cache.set(cacheKey, { pending, expiresAt: 0 });
  try { return await pending; } catch (error) { cache.delete(cacheKey); throw error; }
}
