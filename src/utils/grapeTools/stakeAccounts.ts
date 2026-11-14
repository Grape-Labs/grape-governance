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
  const [stakerResult, withdrawerResult] = await Promise.allSettled([
    connection.getParsedProgramAccounts(StakeProgram.programId, { filters: filtersForOffset(12) }),
    connection.getParsedProgramAccounts(StakeProgram.programId, { filters: filtersForOffset(44) }),
  ]);

  if (stakerResult.status === 'rejected' && withdrawerResult.status === 'rejected') {
    throw new Error(
      `Stake authority queries failed: staker=${String(stakerResult.reason)}; withdrawer=${String(
        withdrawerResult.reason
      )}`
    );
  }

  // A provider can reject one indexed query while successfully returning the other.
  // Preserve those partial results and let the caller retry only when both fail.
  const stakerAccounts = stakerResult.status === 'fulfilled' ? stakerResult.value : [];
  const withdrawerAccounts = withdrawerResult.status === 'fulfilled' ? withdrawerResult.value : [];

  const deduped = new Map<string, any>();
  for (const account of [...stakerAccounts, ...withdrawerAccounts]) {
    deduped.set(account.pubkey.toBase58(), account);
  }

  const result: any[] = [];
  const values = Array.from(deduped.values());
  // Bound activation lookups for treasuries with many stake accounts.
  for (let offset = 0; offset < values.length; offset += 6) {
    result.push(...await Promise.all(values.slice(offset, offset + 6).map(async (account: any) => {
    const parsed = account.account.data?.parsed;
    const info = parsed?.info || {};
    const type = parsed?.type || info?.type;
    const delegation = info?.stake?.delegation;
    const deactivationEpoch = delegation?.deactivationEpoch ?? 'N/A';
    const totalLamports = Number(account.account.lamports || 0);
    const rentLamports = Number(info?.meta?.rentExemptReserve ?? DEFAULT_STAKE_RENT_LAMPORTS);
    const delegatedLamports = Number(delegation?.stake || 0);
    let activeStakeLamports = delegatedLamports;
    let state = type === 'initialized' ? 'inactive' : 'unverified';
    let activationVerified = type === 'initialized';
    if (type === 'delegated' || delegation) {
      state = String(deactivationEpoch) === U64_MAX ? 'delegated' : 'deactivating';
      try {
        const activation = await connection.getStakeActivation(account.pubkey, 'confirmed');
        if (['active', 'inactive', 'activating', 'deactivating'].includes(activation?.state)) {
          state = activation.state;
          activeStakeLamports = Number(activation.active || 0);
          activationVerified = true;
        }
      } catch {
        // Some RPCs no longer support activation lookups. Do not invent inactive
        // readiness from epoch age or confuse excess balance with the principal.
      }
    }
    if (state === 'inactive') activeStakeLamports = 0;
    const inactiveLamports = Math.max(0, totalLamports - activeStakeLamports - rentLamports);

    const pubkey = account.pubkey.toBase58();
    return {
      pubkey,
      stake_account_address: pubkey,
      vote_account_address: delegation?.voter || 'N/A',
      status: type || 'unverified',
      activationVerified,
      staker: info?.meta?.authorized?.staker,
      withdrawer: info?.meta?.authorized?.withdrawer,
      state,
      total_amount: totalLamports / LAMPORTS_PER_SOL,
      active_amount: activeStakeLamports / LAMPORTS_PER_SOL,
      active_stake_amount: activeStakeLamports / LAMPORTS_PER_SOL,
      delegated_amount: delegatedLamports / LAMPORTS_PER_SOL,
      rent: rentLamports / LAMPORTS_PER_SOL,
      inactive_amount: inactiveLamports / LAMPORTS_PER_SOL,
      lamports: totalLamports,
      activeStakeLamports,
      rentLamports,
      inactiveLamports,
    };
    })));
  }
  return result;
}
