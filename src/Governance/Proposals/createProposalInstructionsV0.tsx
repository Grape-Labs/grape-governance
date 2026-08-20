// createProposalInstructionsV0.tsx
import {
  AddressLookupTableProgram,
  Keypair,
  PACKET_DATA_SIZE,
  PublicKey,
  TransactionMessage,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js'
import { BN } from '@project-serum/anchor'

import {
  VoteType,
  getGovernance,
  tryGetRealmConfig,
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
} from '../../utils/governanceTools/sendTransactionsV3'

import {
  getProposalIndexed,
  getAllGovernancesIndexed,
  getRealmIndexed,
  getGovernanceIndexed,
} from '../api/queries'

import { chunks } from '../../utils/governanceTools/helpers'
import { WalletSigner } from '../../utils/governanceTools/sendTransactions'
import { sendSignAndConfirmTransactions } from '../../utils/governanceTools/v0_tools/modifiedMangolana'
import { getVotingPluginWithUpdate } from '../../utils/governanceTools/components/instructions/getVotePlugin'
import { resolveProposalAuthorRecord } from './proposalAuthority'

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

type ProposalV0Result = {
  address: PublicKey
  transactionSuccess: boolean
  preview?: boolean
  transactionInstructions?: ReturnType<typeof buildTransactionBatch>[]
}

const uniqueKeypairs = (signers: Array<Keypair | null | undefined>) => {
  const byPublicKey = new Map<string, Keypair>()
  signers.forEach((signer) => {
    if (signer?.publicKey) byPublicKey.set(signer.publicKey.toBase58(), signer)
  })
  return Array.from(byPublicKey.values())
}

const requiredSignersForInstructions = (
  instructions: TransactionInstruction[],
  candidates: Array<Keypair | null | undefined>
) => {
  const required = new Set(
    instructions.flatMap((instruction) =>
      instruction.keys
        .filter((key) => key.isSigner)
        .map((key) => key.pubkey.toBase58())
    )
  )
  return uniqueKeypairs(candidates).filter((signer) =>
    required.has(signer.publicKey.toBase58())
  )
}

function buildTransactionBatch(
  instructions: TransactionInstruction[],
  signerCandidates: Array<Keypair | null | undefined> = []
) {
  const signers = requiredSignersForInstructions(instructions, signerCandidates)
  return {
    instructionsSet: instructions.map((transactionInstruction, index) => ({
      transactionInstruction,
      signers: index === 0 ? signers : [],
    })),
    sequenceType: SequenceType.Sequential,
  }
}

const uniquePublicKeys = (keys: PublicKey[]) => {
  const byAddress = new Map<string, PublicKey>()
  keys.forEach((key) => byAddress.set(key.toBase58(), key))
  return Array.from(byAddress.values())
}

const normalizeHoldUpTime = (value: unknown, minimum: number) => {
  const requested = Number(value)
  return Number.isFinite(requested)
    ? Math.max(minimum, Math.floor(requested))
    : minimum
}

const transactionNeedsLookupTable = (
  payer: PublicKey,
  instructions: TransactionInstruction[]
) => {
  try {
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: PublicKey.default.toBase58(),
      instructions,
    }).compileToV0Message()
    return new VersionedTransaction(message).serialize().length > PACKET_DATA_SIZE
  } catch {
    return true
  }
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
  authTransaction: any,
  wallet: WalletSigner,
  _sendTransaction: any,
  instructionsData: InstructionDataWithHoldUpTime[],
  isDraft = false,
  returnTx?: boolean,
  payer: PublicKey = walletPk,
  editAddress?: PublicKey,
  callbacks?: Parameters<typeof sendTransactionsV3>[0]['callbacks'],
  proposalConfig?: {
    options?: string[]
    voteType?: 'single' | 'multi'
    useDenyOption?: boolean
    maxVoterOptions?: number
    maxWinningOptions?: number
    instructionChunkBy?: number
    optionInstructionSets?: Array<{
      optionIndex: number
      holdUpTime?: number
      ix?: TransactionInstruction[]
    }>
  },
  proposalAuthority?: {
    tokenOwnerRecordPk?: PublicKey | null
    governanceAuthority?: PublicKey | null
    signatory?: PublicKey | null
  }
): Promise<ProposalV0Result> {
  const programId = new PublicKey(token_realm_program_id)
  const governanceAuthority =
    proposalAuthority?.governanceAuthority || walletPk
  const signatory = proposalAuthority?.signatory || governanceAuthority

  /* -------------------------------------------- */
  /* Program / Governance setup                   */
  /* -------------------------------------------- */

  const programVersion = await getGrapeGovernanceProgramVersion(
    connection,
    programId,
    realmPk
  )

  let tokenOwnerRecordPk: PublicKey | null = null

  if (proposalAuthority?.tokenOwnerRecordPk) {
    tokenOwnerRecordPk = proposalAuthority.tokenOwnerRecordPk
  } else if (editAddress) {
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
    const authorResolution = await resolveProposalAuthorRecord(
      realmPk,
      programId,
      walletPk,
      governingTokenMint
    )
    if (authorResolution?.bestRecord?.pubkey) {
      tokenOwnerRecordPk = new PublicKey(authorResolution.bestRecord.pubkey)
    }
  }

  if (!tokenOwnerRecordPk) {
    const derivedTokenOwnerRecordPk = await getTokenOwnerRecordAddress(
      programId,
      realmPk,
      governingTokenMint,
      walletPk
    )
    const tokenOwnerRecordAccount = await connection.getAccountInfo(
      derivedTokenOwnerRecordPk
    )
    if (tokenOwnerRecordAccount) {
      tokenOwnerRecordPk = derivedTokenOwnerRecordPk
    }
  }

  if (!tokenOwnerRecordPk) throw new Error('TokenOwnerRecord not found')

  const indexedGovernance = await getGovernanceIndexed(
    realmPk.toBase58(),
    programId.toBase58(),
    governancePk.toBase58()
  )
  const proposalIndex = indexedGovernance?.account?.proposalCount ?? new BN(0)
  const governance = await getGovernance(connection, governancePk)
  const minInstructionHoldUpTime =
    governance?.account?.config?.minInstructionHoldUpTime ?? 0

  /* -------------------------------------------- */
  /* Proposal creation                            */
  /* -------------------------------------------- */

  const baseInstructions: TransactionInstruction[] = []
  let votePlugin: any = null;

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
    const selectedRealmIndexed = await getRealmIndexed(realmPk.toBase58())
    try {
      const realmConfig = selectedRealmIndexed
        ? await tryGetRealmConfig(
            connection,
            new PublicKey(selectedRealmIndexed.owner),
            new PublicKey(selectedRealmIndexed.pubkey)
          )
        : null

      const councilMint = selectedRealmIndexed?.account?.config?.councilMint
      const isCouncilMint =
        councilMint && new PublicKey(councilMint).equals(governingTokenMint)
      const governingTokenConfig = isCouncilMint
        ? realmConfig?.account?.councilTokenConfig
        : realmConfig?.account?.communityTokenConfig
      const voterWeightAddin = governingTokenConfig?.voterWeightAddin

      if (selectedRealmIndexed && voterWeightAddin) {
        votePlugin = await getVotingPluginWithUpdate(
          selectedRealmIndexed,
          governingTokenMint,
          governanceAuthority,
          voterWeightAddin
        )

        if (!votePlugin?.voterWeightPk) {
          throw new Error('The realm requires a voter-weight plugin, but no voter-weight record could be prepared.')
        }
        if (votePlugin.instructions?.length) baseInstructions.push(...votePlugin.instructions)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `${error}`
      throw new Error(`Unable to prepare the required voter-weight plugin: ${message}`)
    }

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
      governanceAuthority,
      proposalIndex,
      voteType,
      options,
      useDenyOption,
      payer,
      votePlugin?.voterWeightPk
    )

    await withAddSignatory(
      baseInstructions,
      programId,
      programVersion,
      proposalAddress,
      tokenOwnerRecordPk,
      governanceAuthority,
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
  const instructionSigners: Keypair[] = []

  if (authTransaction?.instructions?.length) {
    prerequisiteInstructions.push(...authTransaction.instructions)
  }

  const all = instructionsData.filter((x) => x.data)
  const optionInstructionIndexByOption = new Map<number, number>()

  const chunkSize =
    Math.min(...all.map((x) => x.chunkBy ?? 2)) || 2

  const groupedCoreInstructions: Array<{ holdUpTime: number; items: any[] }> = []
  for (let idx = 0; idx < all.length; ) {
    const current = all[idx]
    const requestedChunk = Math.max(1, Math.floor(Number(current?.chunkBy ?? 1)))
    const chunk = all.slice(idx, idx + requestedChunk)

    chunk.forEach((item) => {
      if (item.prerequisiteInstructions?.length) {
        prerequisiteInstructions.push(...item.prerequisiteInstructions)
      }
      if (item.prerequisiteInstructionsSigners?.length) {
        prerequisiteSigners.push(...item.prerequisiteInstructionsSigners)
      }
      if (item.signers?.length) instructionSigners.push(...item.signers)
    })

    groupedCoreInstructions.push({
      holdUpTime: normalizeHoldUpTime(
        current.holdUpTime,
        minInstructionHoldUpTime
      ),
      items: chunk.map((item) => item.data).filter(Boolean),
    })
    idx += requestedChunk
  }

  for (const [idx, grouped] of groupedCoreInstructions.entries()) {
    await withInsertTransaction(
      insertInstructions,
      programId,
      programVersion,
      governancePk,
      proposalAddress,
      tokenOwnerRecordPk,
      governanceAuthority,
      idx,
      0,
      grouped.holdUpTime,
      grouped.items,
      payer
    )
  }
  optionInstructionIndexByOption.set(0, groupedCoreInstructions.length)

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
        governanceAuthority,
        nextIndex,
        optionIndex,
        normalizeHoldUpTime(set?.holdUpTime, minInstructionHoldUpTime),
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

  const signerCandidates = uniqueKeypairs([
    ...prerequisiteSigners,
    ...instructionSigners,
  ])
  const instructionChunks = [
    ...chunks(prerequisiteInstructions, chunkSize),
    baseInstructions,
    ...chunks(insertInstructions, chunkSize),
  ].filter((chunk) => chunk.length > 0)

  const txes = instructionChunks.map((chunk) =>
    buildTransactionBatch(chunk, signerCandidates)
  )

  // Preview/fee estimation must be read-only. In particular, do not create an
  // address lookup table here because that is an on-chain state mutation.
  if (returnTx) {
    return {
      address: proposalAddress,
      transactionSuccess: false,
      preview: true,
      transactionInstructions: txes,
    }
  }

  const keys = uniquePublicKeys(txes
    .flatMap((x) =>
      x.instructionsSet.flatMap((y) =>
        y.transactionInstruction.keys.map((k) => k.pubkey)
      )
    ))

  const needsLookupTable = instructionChunks.some((chunk) =>
    transactionNeedsLookupTable(payer, chunk)
  )
  let lookupTableAccounts = undefined

  if (needsLookupTable) {
    if (keys.length > 256) {
      throw new Error(`Proposal transactions require ${keys.length} lookup-table addresses; the maximum is 256.`)
    }

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
        buildTransactionBatch([createLutIx]),
        ...extendIxs.map((ix) => buildTransactionBatch([ix])),
      ],
    })

    const lut = (await connection.getAddressLookupTable(lutAddress)).value
    if (!lut) throw new Error('Lookup table not found')
    lookupTableAccounts = [lut]
  }

  /* -------------------------------------------- */
  /* Final send                                   */
  /* -------------------------------------------- */

  await sendTransactionsV3({
    callbacks,
    connection,
    wallet,
    transactionInstructions: txes,
    lookupTableAccounts,
  })

  return {
    address: proposalAddress,
    transactionSuccess: true,
  }
}
