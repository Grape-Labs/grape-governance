import { Connection, LAMPORTS_PER_SOL, PublicKey, StakeProgram } from '@solana/web3.js';

const U64_MAX = '18446744073709551615';
const DEFAULT_STAKE_RENT_LAMPORTS = 2_282_880;

export async function fetchStakeAccountsByAuthorityRpc(
  connection: Connection,
  authority: PublicKey
): Promise<any[]> {
  const filtersForOffset = (offset: number) => [
    { dataSize: StakeProgram.space },
    { memcmp: { offset, bytes: authority.toBase58() } },
  ];

  // A treasury may be either the staker, withdrawer, or both.
  const [stakerAccounts, withdrawerAccounts] = await Promise.all([
    connection.getParsedProgramAccounts(StakeProgram.programId, { filters: filtersForOffset(12) }),
    connection.getParsedProgramAccounts(StakeProgram.programId, { filters: filtersForOffset(44) }),
  ]);

  const deduped = new Map<string, any>();
  for (const account of [...stakerAccounts, ...withdrawerAccounts]) {
    deduped.set(account.pubkey.toBase58(), account);
  }

  return Array.from(deduped.values()).map((account: any) => {
    const info = account.account.data?.parsed?.info || {};
    const delegation = info?.stake?.delegation;
    const deactivationEpoch = delegation?.deactivationEpoch ?? 'N/A';
    const totalLamports = Number(account.account.lamports || 0);
    const rentLamports = Number(info?.meta?.rentExemptReserve ?? DEFAULT_STAKE_RENT_LAMPORTS);
    const activeStakeLamports = Number(delegation?.stake || 0);
    const inactiveLamports = Math.max(0, totalLamports - activeStakeLamports - rentLamports);

    let state = info?.type || 'unknown';
    if (info?.type === 'delegated' && String(deactivationEpoch) === U64_MAX) state = 'active';
    else if (info?.type === 'delegated') state = 'deactivating';
    else if (info?.type === 'initialized') state = 'initialized';

    const pubkey = account.pubkey.toBase58();
    return {
      pubkey,
      stake_account_address: pubkey,
      vote_account_address: delegation?.voter || 'N/A',
      status: info?.type || 'unknown',
      state,
      total_amount: totalLamports / LAMPORTS_PER_SOL,
      active_amount: activeStakeLamports / LAMPORTS_PER_SOL,
      active_stake_amount: activeStakeLamports / LAMPORTS_PER_SOL,
      delegated_amount: activeStakeLamports / LAMPORTS_PER_SOL,
      rent: rentLamports / LAMPORTS_PER_SOL,
      inactive_amount: inactiveLamports / LAMPORTS_PER_SOL,
      lamports: totalLamports,
      activeStakeLamports,
      rentLamports,
      inactiveLamports,
    };
  });
}
