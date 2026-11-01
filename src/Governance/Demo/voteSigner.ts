import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { treasuryRpcRequest } from '../Treasury/requestQueue';

export type VoteSigner = { address: string; signature: string };
const address = (value: any) => value?.toBase58?.() || String(value || '');

// CastVote's governanceAuthority is account 5; payer is account 8.
// Inspect inner instructions too: a governance authority may sign through CPI.
export function findVoteSigner(tx: any, program: string, proposal: string, record: string): string | null {
    if (!tx?.meta || tx.meta.err) return null;
    const instructions = [...(tx.transaction?.message?.instructions || []),
        ...(tx.meta.innerInstructions || []).flatMap((group: any) => group.instructions || [])];
    let signer: string | null = null;
    for (const ix of instructions) {
        if (address(ix.programId) !== program || !ix.data || !ix.accounts) continue;
        try {
            if (bs58.decode(ix.data)[0] !== 13) continue;
        } catch { continue; }
        if (address(ix.accounts[2]) !== proposal || address(ix.accounts[6]) !== record) continue;
        signer = address(ix.accounts[5]) || null;
    }
    return signer;
}

export async function lookupVoteSigner(connection: any, proposal: string, record: string): Promise<VoteSigner | null> {
    const prefix = `${connection.rpcEndpoint}:vote-signer`;
    const request = <T,>(key: string, read: () => Promise<T>) => treasuryRpcRequest(`${prefix}:${key}`, read);
    const account: any = await request(`program:${proposal}`, () => connection.getAccountInfo(new PublicKey(proposal)));
    if (!account?.owner) return null;
    let before: string | undefined;
    // Bound history work; never infer a signer from today's delegate assignment.
    for (let page = 0; page < 5; page++) {
        const signatures: any = await request(`history:${record}:${before || ''}`, () =>
            connection.getSignaturesForAddress(new PublicKey(record), { limit: 20, before }));
        for (const entry of signatures) {
            if (entry.err) continue;
            const tx = await request(`tx:${entry.signature}`, () => connection.getParsedTransaction(entry.signature, {
                maxSupportedTransactionVersion: 0, commitment: 'confirmed',
            }));
            // Missing newer history could conceal a recast. Don't attribute an older vote.
            if (!tx) return null;
            const signer = findVoteSigner(tx, address(account.owner), proposal, record);
            if (signer) return { address: signer, signature: entry.signature };
        }
        if (signatures.length < 20) break;
        before = signatures[signatures.length - 1].signature;
    }
    return null;
}
