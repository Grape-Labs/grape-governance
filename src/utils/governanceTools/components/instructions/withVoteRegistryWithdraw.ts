import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token-v2'
import { BN } from '@coral-xyz/anchor'
import {
  getRegistrarPDA,
  getVoterPDA,
  getVoterWeightPDA,
} from './account'
import { VsrClient } from './client'
import { withCreateTokenOwnerRecord } from '@solana/spl-governance'

export const withVoteRegistryWithdraw = async ({
  instructions,
  walletPk,
  mintPk,
  realmPk,
  amount,
  tokenOwnerRecordPubKey,
  depositIndex,
  communityMintPk,
  closeDepositAfterOperation,
  splProgramId,
  splProgramVersion,
  client,
  connection,
}: {
  instructions: TransactionInstruction[]
  walletPk: PublicKey
  mintPk: PublicKey
  realmPk: PublicKey
  communityMintPk: PublicKey
  amount: BN
  tokenOwnerRecordPubKey: PublicKey | undefined
  depositIndex: number
  connection: Connection
  splProgramId: PublicKey
  splProgramVersion: number
  //if we want to close deposit after doing operation we need to fill this because we can close only deposits that have 0 tokens inside
  closeDepositAfterOperation?: boolean
  client?: VsrClient
}) => {
  if (!client) {
    throw 'no vote registry plugin'
  }
  const clientProgramId = client!.program.programId

  const { registrar } = await getRegistrarPDA(
    realmPk,
    communityMintPk,
    client!.program.programId
  )
  const { voter } = await getVoterPDA(registrar, walletPk, clientProgramId)
  const { voterWeightPk } = await getVoterWeightPDA(
    registrar,
    walletPk,
    clientProgramId
  )

  const voterATAPk = await getAssociatedTokenAddress(mintPk, voter, true)

  const ataPk = await getAssociatedTokenAddress(mintPk, walletPk, true)
  const isExistingAta = await connection.getAccountInfo(ataPk)
  if (!isExistingAta) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        walletPk,
        ataPk,
        walletPk,
        mintPk,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
  }
  //spl governance tokenownerrecord pubkey
  if (!tokenOwnerRecordPubKey) {
    tokenOwnerRecordPubKey = await withCreateTokenOwnerRecord(
      instructions,
      splProgramId,
      splProgramVersion,
      realmPk,
      walletPk,
      communityMintPk,
      walletPk
    )
  }
  const withdrawInstruction = await client?.program.methods
    .withdraw(depositIndex!, amount)
    .accounts({
      registrar: registrar,
      voter: voter,
      voterAuthority: walletPk,
      tokenOwnerRecord: tokenOwnerRecordPubKey,
      voterWeightRecord: voterWeightPk,
      vault: voterATAPk,
      destination: ataPk,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
  instructions.push(withdrawInstruction)

  if (closeDepositAfterOperation) {
    const close = await client.program.methods
      .closeDepositEntry(depositIndex)
      .accounts({
        voter: voter,
        voterAuthority: walletPk,
      })
      .instruction()
    instructions.push(close)
  }
}
