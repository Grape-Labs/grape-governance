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
