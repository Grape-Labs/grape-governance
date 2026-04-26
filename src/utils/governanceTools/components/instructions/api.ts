import { PublicKey } from '@solana/web3.js'

import type { LockupType, Voter } from './accounts'
import { VsrClient } from './client'

export const tryGetVoter = async (
  voterPk: PublicKey,
  client?: VsrClient
): Promise<Voter | undefined> => {
  if (!client) {
    return undefined
  }

  const fetchNullable = (client.program.account.voter as any)?.fetchNullable
  if (typeof fetchNullable === 'function') {
    return (await fetchNullable(voterPk)) as Voter | undefined
  }

  try {
    return (await client.program.account.voter.fetch(voterPk)) as Voter
  } catch (_e) {
    return undefined
  }
}

export const getMintCfgIdx = async (
  registrarPk: PublicKey,
  mintPk: PublicKey,
  client?: VsrClient
) => {
  if (!client) {
    throw 'no vote registry plugin'
  }

  const registrar = (await client.program.account.registrar.fetch(
    registrarPk
  )) as any
  const mintCfgIdx = (registrar?.votingMints || []).findIndex(
    (config: any) => config?.mint?.toBase58?.() === mintPk.toBase58()
  )

  if (mintCfgIdx < 0) {
    throw 'Mint is not configured for this vote registry'
  }

  return mintCfgIdx
}

export const getPeriod = (
  lockUpPeriodInDays: number,
  lockupKind: LockupType
) => {
  if (lockupKind === 'none') {
    return 0
  }

  if (lockupKind === 'monthly') {
    return Math.max(0, Math.trunc(lockUpPeriodInDays))
  }

  return Math.max(0, Math.trunc(lockUpPeriodInDays * 24 * 60 * 60))
}
