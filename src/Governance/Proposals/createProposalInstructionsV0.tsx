// createProposalInstructionsV0.tsx
import {
  AddressLookupTableProgram,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js'
import { BN } from '@project-serum/anchor'

import {
  Governance,
  ProgramAccount,
  VoteType,
  withCreateProposal,
  withAddSignatory,
  withInsertTransaction,
  withSignOffProposal,
  getSignatoryRecordAddress,
  getTokenOwnerRecordAddress,
  createInstructionData,
  MultiChoiceType,
} from '@solana/spl-governance'

import { getGrapeGovernanceProgramVersion } from '../../utils/grapeTools/helpers'
import {
  sendTransactionsV3,
  SequenceType,
  txBatchesToInstructionSetWithSigners,
} from '../../utils/governanceTools/sendTransactionsV3'

import {
  getProposalIndexed,
  getAllGovernancesIndexed,
  getAllTokenOwnerRecordsIndexed,
} from '../api/queries'

import { chunks } from '../../utils/governanceTools/helpers'
import { UiInstruction } from '../../utils/governanceTools/proposalCreationTypes'
import { WalletSigner } from '../../utils/governanceTools/sendTransactions'
import { sendSignAndConfirmTransactions } from '../../utils/governanceTools/v0_tools/modifiedMangolana'

/* -------------------------------------------------- */
/* Helpers                                            */
/* -------------------------------------------------- */

export const deduplicateObjsFilter = (v, i, a) =>
  i === a.findIndex((t) => JSON.stringify(t) === JSON.stringify(v))

export interface InstructionDataWithHoldUpTime {
  data: any
  holdUpTime: number
  prerequisiteInstructions: TransactionInstruction[]
  chunkBy?: number
  signers?: Keypair[]
  prerequisiteInstructionsSigners?: (Keypair | null)[]
}

/* -------------------------------------------------- */
/* Main Entry                                         */
/* -------------------------------------------------- */

export async function createProposalInstructionsV0(
  token_realm_program_id: PublicKey,
  realmPk: PublicKey,
  governancePk: PublicKey,
  governingTokenMint: PublicKey,
  walletPk: PublicKey,
  name: string,
  description: string,
  connection: any,
  _transactionInstr: any,
  _authTransaction: any,
  wallet: WalletSigner,
  _sendTransaction: any,
  instructionsData: InstructionDataWithHoldUpTime[],
  isDraft = false,
  _returnTx?: boolean,
  payer: PublicKey = walletPk,
  editAddress?: PublicKey,
  callbacks?: Parameters<typeof sendTransactionsV3>[0]['callbacks'],
  proposalConfig?: {
    options?: string[]
    voteType?: 'single' | 'multi'
    useDenyOption?: boolean
    maxVoterOptions?: number
    maxWinningOptions?: number
    optionInstructionSets?: Array<{
      optionIndex: number
      holdUpTime?: number
      ix?: TransactionInstruction[]
    }>
  }
): Promise<{ address: PublicKey; transactionSuccess: boolean }> {
  const programId = new PublicKey(token_realm_program_id)
  const signatory = walletPk

  /* -------------------------------------------- */
  /* Program / Governance setup                   */
  /* -------------------------------------------- */

  const programVersion = await getGrapeGovernanceProgramVersion(
    connection,
    programId,
    realmPk
  )

  let tokenOwnerRecordPk: PublicKey | null = null

  if (editAddress) {
    const governances = await getAllGovernancesIndexed(
      realmPk.toBase58(),
      programId.toBase58()
    )
    const gp = await getProposalIndexed(
      governances.map((g) => g.pubkey.toBase58()),
      null,
      realmPk.toBase58(),
      editAddress.toBase58()
    )
    tokenOwnerRecordPk = gp?.account?.tokenOwnerRecord
  }

  if (!tokenOwnerRecordPk) {
    tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
      programId,
      realmPk,
      governingTokenMint,
      walletPk
    )
  }

  if (!tokenOwnerRecordPk) {
    const records = await getAllTokenOwnerRecordsIndexed(
      realmPk.toBase58(),
      null,
      walletPk.toBase58()
    )
    const match = records.find(
      (r) =>
        r.account.governingTokenOwner === walletPk.toBase58() &&
        r.account.governingTokenMint === governingTokenMint.toBase58()
    )
    if (!match) throw new Error('TokenOwnerRecord not found')
    tokenOwnerRecordPk = new PublicKey(match.pubkey)
  }

  const governance = await connection.getAccountInfo(governancePk)
  const proposalIndex =
    (governance as any)?.account?.proposalCount ?? new BN(0)

  /* -------------------------------------------- */
  /* Proposal creation                            */
  /* -------------------------------------------- */

  const baseInstructions: TransactionInstruction[] = []

  const requestedOptions = Array.isArray(proposalConfig?.options)
    ? proposalConfig.options
        .map((item) => `${item ?? ''}`.trim())
        .filter((item) => !!item)
    : []

  const options = requestedOptions.length > 0 ? requestedOptions : ['Approve']

  const isMultiChoice =
    proposalConfig?.voteType === 'multi' || (proposalConfig?.voteType !== 'single' && options.length > 1)

  const maxVoterOptions = isMultiChoice
    ? Math.max(
        1,
        Math.min(
          proposalConfig?.maxVoterOptions ?? options.length,
          options.length
        )
      )
    : 1

  const maxWinningOptions = isMultiChoice
    ? Math.max(
        1,
        Math.min(
          proposalConfig?.maxWinningOptions ?? options.length,
          options.length
        )
      )
    : 1

  const voteType = isMultiChoice
    ? VoteType.MULTI_CHOICE(
        MultiChoiceType.FullWeight,
        1,
        maxVoterOptions,
        maxWinningOptions
      )
    : VoteType.SINGLE_CHOICE

  const useDenyOption =
    proposalConfig?.useDenyOption !== undefined
      ? !!proposalConfig.useDenyOption
      : !isMultiChoice

  let proposalAddress: PublicKey

  if (!editAddress) {
    proposalAddress = await withCreateProposal(
      baseInstructions,
      programId,
      programVersion,
      realmPk,
      governancePk,
      tokenOwnerRecordPk,
      name,
      description,
      governingTokenMint,
      walletPk,
      proposalIndex,
      voteType,
      options,
      useDenyOption,
      payer
    )

    await withAddSignatory(
      baseInstructions,
      programId,
      programVersion,
      proposalAddress,
      tokenOwnerRecordPk,
      walletPk,
      signatory,
      payer
    )
  } else {
    proposalAddress = editAddress
  }

  const signatoryRecord = await getSignatoryRecordAddress(
    programId,
    proposalAddress,
    signatory
  )

  /* -------------------------------------------- */
  /* Insert proposal instructions                 */
  /* -------------------------------------------- */

  const insertInstructions: TransactionInstruction[] = []
  const prerequisiteInstructions: TransactionInstruction[] = []
  const prerequisiteSigners: (Keypair | null)[] = []

  const all = instructionsData.filter((x) => x.data)
  const optionInstructionIndexByOption = new Map<number, number>()

  const chunkSize =
    Math.min(...all.map((x) => x.chunkBy ?? 2)) || 2

  for (const [idx, ix] of all.entries()) {
    if (ix.prerequisiteInstructions?.length) {
      prerequisiteInstructions.push(...ix.prerequisiteInstructions)
    }
    if (ix.prerequisiteInstructionsSigners?.length) {
      prerequisiteSigners.push(...ix.prerequisiteInstructionsSigners)
    }

    await withInsertTransaction(
      insertInstructions,
      programId,
      programVersion,
      governancePk,
      proposalAddress,
      tokenOwnerRecordPk,
      walletPk,
      idx,
      0,
      ix.holdUpTime ?? 0,
      [ix.data],
      payer
    )
  }
  optionInstructionIndexByOption.set(0, all.length)

  const optionInstructionSets = Array.isArray(proposalConfig?.optionInstructionSets)
    ? proposalConfig.optionInstructionSets
    : []

  for (const set of optionInstructionSets) {
    const optionIndex = Number(set?.optionIndex)
    if (!Number.isFinite(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
      continue
    }
    const optionIxs = Array.isArray(set?.ix) ? set.ix : []
    if (optionIxs.length === 0) continue

    for (const optionIx of optionIxs) {
      const instructionData = createInstructionData(optionIx)
      const nextIndex = optionInstructionIndexByOption.get(optionIndex) ?? 0
      await withInsertTransaction(
        insertInstructions,
        programId,
        programVersion,
        governancePk,
        proposalAddress,
        tokenOwnerRecordPk,
        walletPk,
        nextIndex,
        optionIndex,
        Number.isFinite(set?.holdUpTime as number) ? (set?.holdUpTime as number) : 0,
        [instructionData],
        payer
      )
      optionInstructionIndexByOption.set(optionIndex, nextIndex + 1)
    }
  }

  if (!isDraft) {
    withSignOffProposal(
      insertInstructions,
      programId,
      programVersion,
      realmPk,
      governancePk,
      proposalAddress,
      signatory,
      signatoryRecord,
      tokenOwnerRecordPk
    )
  }

  /* -------------------------------------------- */
  /* Chunk + LUT creation                         */
  /* -------------------------------------------- */

  const instructionChunks = [
    ...chunks(prerequisiteInstructions, chunkSize),
    baseInstructions,
    ...chunks(insertInstructions, chunkSize),
  ]

  const signerChunks = instructionChunks.map(() => [])

  const txes = instructionChunks.map((chunk, i) => ({
    instructionsSet: txBatchesToInstructionSetWithSigners(
      chunk,
      signerChunks,
      i
    ),
    sequenceType: SequenceType.Sequential,
  }))

  const keys = txes
    .flatMap((x) =>
      x.instructionsSet.flatMap((y) =>
        y.transactionInstruction.keys.map((k) => k.pubkey)
      )
    )

  const slot = await connection.getSlot()
  const [createLutIx, lutAddress] =
    AddressLookupTableProgram.createLookupTable({
      authority: payer,
      payer,
      recentSlot: slot,
    })

  const extendIxs = chunks(keys, 20).map((c) =>
    AddressLookupTableProgram.extendLookupTable({
      payer,
      authority: payer,
      lookupTable: lutAddress,
      addresses: c,
    })
  )

  await sendSignAndConfirmTransactions({
    connection,
    wallet,
    transactionInstructions: [
      { instructionsSet: [{ transactionInstruction: createLutIx }], sequenceType: SequenceType.Sequential },
      ...extendIxs.map((ix) => ({
        instructionsSet: [{ transactionInstruction: ix }],
        sequenceType: SequenceType.Sequential,
      })),
    ],
  })

  const lut = (await connection.getAddressLookupTable(lutAddress)).value
  if (!lut) throw new Error('Lookup table not found')

  /* -------------------------------------------- */
  /* Final send                                   */
  /* -------------------------------------------- */

  await sendTransactionsV3({
    callbacks,
    connection,
    wallet,
    transactionInstructions: txes,
    lookupTableAccounts: [lut],
  })

  return {
    address: proposalAddress,
    transactionSuccess: true,
  }
}
