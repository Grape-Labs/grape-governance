import { PublicKey } from '@solana/web3.js'

import { getAllTokenOwnerRecordsIndexed } from '../api/queries'

export const toBase58Safe = (value: any): string | null => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value?.toBase58 === 'function') return value.toBase58()
  return null
}

export const getRecordDepositAmount = (record: any): number => {
  const raw =
    record?.account?.governingTokenDepositAmount?.toString?.() ??
    `${record?.account?.governingTokenDepositAmount ?? 0}`
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : 0
}

export const formatGovernanceTokenAmount = (
  rawAmount: any,
  decimals = 0,
  maxFractionDigits = 6
): string => {
  const raw = toBigIntSafe(rawAmount)
  if (raw === null) return '0'
  const safeDecimals = Math.max(0, Number(decimals || 0))
  if (safeDecimals === 0) return raw.toString()

  const divisor = 10n ** BigInt(safeDecimals)
  const whole = raw / divisor
  const fraction = raw % divisor
  if (fraction === 0n) return whole.toString()

  const fractionStr = fraction.toString().padStart(safeDecimals, '0')
  const trimmedFraction = fractionStr.replace(/0+$/, '')
  const clippedFraction = trimmedFraction.slice(0, maxFractionDigits)
  return clippedFraction.length > 0
    ? `${whole.toString()}.${clippedFraction}`
    : whole.toString()
}

export const getProposalAuthorSelectionStorageKey = (
  realm58?: string | null,
  mint58?: string | null
) => `grape_proposal_author:${realm58 || 'unknown'}:${mint58 || 'unknown'}`

export const U64_MAX_PROPOSAL_THRESHOLD = '18446744073709551615'

export const toBigIntSafe = (value: any): bigint | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return BigInt(Math.trunc(value))
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed === 'ffffffffffffffff') return BigInt(U64_MAX_PROPOSAL_THRESHOLD)
    try {
      return BigInt(trimmed)
    } catch {
      return null
    }
  }
  if (typeof value?.toString === 'function') {
    try {
      return toBigIntSafe(value.toString())
    } catch {
      return null
    }
  }
  return null
}

export const getProposalCreationRequirement = (
  governanceConfig: any,
  isCouncilMint: boolean
) => {
  const rawThreshold = isCouncilMint
    ? governanceConfig?.minCouncilTokensToCreateProposal
    : governanceConfig?.minCommunityTokensToCreateProposal
  const threshold = toBigIntSafe(rawThreshold)
  const disabled =
    threshold !== null && threshold.toString() === U64_MAX_PROPOSAL_THRESHOLD

  return {
    threshold,
    disabled,
  }
}

export const getProposalAuthorEligibility = (
  record: any,
  governanceConfig: any,
  proposalMint58?: string | null,
  councilMint58?: string | null
) => {
  const recordMint58 = toBase58Safe(record?.account?.governingTokenMint)
  const isCouncilMint =
    !!proposalMint58 &&
    !!councilMint58 &&
    proposalMint58 === councilMint58 &&
    recordMint58 === proposalMint58
  const requirement = getProposalCreationRequirement(governanceConfig, isCouncilMint)
  const depositAmount = toBigIntSafe(
    record?.account?.governingTokenDepositAmount?.toString?.() ??
      `${record?.account?.governingTokenDepositAmount ?? 0}`
  )

  if (requirement.disabled) {
    return {
      eligible: false,
      reason: isCouncilMint
        ? 'Council proposal creation is disabled for this governance.'
        : 'Community proposal creation is disabled for this governance.',
      threshold: requirement.threshold,
      depositAmount,
    }
  }

  if (requirement.threshold !== null && depositAmount !== null && depositAmount < requirement.threshold) {
    return {
      eligible: false,
      reason: `Requires at least ${requirement.threshold.toString()} deposited voting tokens.`,
      threshold: requirement.threshold,
      depositAmount,
    }
  }

  return {
    eligible: true,
    reason: null,
    threshold: requirement.threshold,
    depositAmount,
  }
}

export const annotateProposalAuthorCandidates = (
  records: any[] = [],
  governanceConfig: any,
  proposalMint58?: string | null,
  councilMint58?: string | null
) =>
  records.map((record: any) => ({
    ...record,
    proposalAuthorEligibility: getProposalAuthorEligibility(
      record,
      governanceConfig,
      proposalMint58,
      councilMint58
    ),
  }))

export const findProposalAuthorCandidates = (
  records: any[] = [],
  authority58?: string | null,
  mint58?: string | null
) => {
  if (!authority58 || !mint58) {
    return {
      directRecord: null,
      delegatedRecords: [],
      allCandidates: [],
      bestRecord: null,
    }
  }

  const matchingRecords = records.filter(
    (item: any) => toBase58Safe(item?.account?.governingTokenMint) === mint58
  )

  const directRecord =
    matchingRecords.find(
      (item: any) =>
        toBase58Safe(item?.account?.governingTokenOwner) === authority58
    ) || null

  const delegatedRecords = matchingRecords.filter(
    (item: any) =>
      toBase58Safe(item?.account?.governingTokenOwner) !== authority58 &&
      toBase58Safe(item?.account?.governanceDelegate) === authority58
  )

  const allCandidates = [...matchingRecords].sort((left: any, right: any) => {
    const depositDiff =
      getRecordDepositAmount(right) - getRecordDepositAmount(left)

    if (depositDiff !== 0) return depositDiff

    const leftIsDirect =
      toBase58Safe(left?.account?.governingTokenOwner) === authority58 ? 1 : 0
    const rightIsDirect =
      toBase58Safe(right?.account?.governingTokenOwner) === authority58 ? 1 : 0

    return rightIsDirect - leftIsDirect
  })

  return {
    directRecord,
    delegatedRecords,
    allCandidates,
    bestRecord: allCandidates[0] || null,
  }
}

export const getGovernanceAuthorityRoleForRecord = (
  record: any,
  authority58?: string | null
): 'owner' | 'delegate' | null => {
  if (!record || !authority58) return null

  const owner58 = toBase58Safe(record?.account?.governingTokenOwner)
  if (owner58 === authority58) return 'owner'

  const delegate58 = toBase58Safe(record?.account?.governanceDelegate)
  if (delegate58 === authority58) return 'delegate'

  return null
}

export const hasGovernanceAuthorityForRecord = (
  record: any,
  authority58?: string | null
) => getGovernanceAuthorityRoleForRecord(record, authority58) !== null

export const resolveProposalAuthorRecord = async (
  realmPk: PublicKey,
  realmOwner: PublicKey | string | null | undefined,
  authorityPk: PublicKey,
  governingTokenMint: PublicKey
) => {
  const records = await getAllTokenOwnerRecordsIndexed(
    realmPk.toBase58(),
    toBase58Safe(realmOwner) || undefined,
    authorityPk.toBase58()
  )

  return findProposalAuthorCandidates(
    Array.isArray(records) ? records : [],
    authorityPk.toBase58(),
    governingTokenMint.toBase58()
  )
}

// Mirrors SPL Governance cancellation: owner/delegate, and no completed vote.
export const canCancelProposal = (
  proposal: any,
  ownerRecord: any,
  authority58: string | null | undefined,
  config?: any,
  now = Math.floor(Date.now() / 1000)
): boolean => {
  const account = proposal?.account
  if (account?.state == null || !hasGovernanceAuthorityForRecord(ownerRecord, authority58)) return false
  const record58 = toBase58Safe(ownerRecord?.pubkey)
  if (!record58 || record58 !== toBase58Safe(account.tokenOwnerRecord)) return false
  const state = Number(account.state)
  if (state === 0 || state === 1) return true
  if (state !== 2 || !config) return false
  const start = Number(account.votingAt ?? account.signingOffAt)
  const base = Number(config.votingBaseTime ?? config.baseVotingTime)
  const coolOff = Number(config.votingCoolOffTime ?? 0)
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(base) || base <= 0 ||
      !Number.isFinite(coolOff) || coolOff < 0 || !Number.isFinite(now)) return false
  return now <= start + base + coolOff
}
