import { Program, Provider, web3 } from '@coral-xyz/anchor'
import {
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import { SYSTEM_PROGRAM_ID } from '@solana/spl-governance'
import { IDL, VoterStakeRegistry } from './voter_stake_registry'
import { getRegistrarPDA, getVoterPDA, getVoterWeightPDA } from './account'


export const VSR_PLUGIN_PKS: string[] = [
  '4Q6WW2ouZ6V3iaNm56MTd5n2tnTm4C5fiH8miFHnAFHo',
  'vsr2nfGVNHmSY8uxoBGqq8AQbwz3JwaEaHqGbsTPXqQ',
  'VotEn9AWwTFtJPJSMV5F9jsMY6QwWM5qn3XP9PATGW7',
  'VoteWPk9yyGmkX4U77nEWRJWpcc8kUfrPoghxENpstL',
  'VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS',
  '5sWzuuYkeWLBdAv3ULrBfqA51zF7Y4rnVzereboNDCPn',
]

export const DEFAULT_VSR_ID = new web3.PublicKey(
  'vsr2nfGVNHmSY8uxoBGqq8AQbwz3JwaEaHqGbsTPXqQ'
)
export const MARINADE_VSR_ID = new web3.PublicKey(
  'VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS'
)
export const MANGO_VSR_ID = new web3.PublicKey(
  'vsr2nfGVNHmSY8uxoBGqq8AQbwz3JwaEaHqGbsTPXqQ'
)

export class VsrClient {
  constructor(
    public program: Program<VoterStakeRegistry>,
    public devnet?: boolean
  ) {}

  getRegistrarPDA(realm: PublicKey, mint: PublicKey) {
    return getRegistrarPDA(realm, mint, this.program.programId)
  }

  getVoterPDA(registrar: PublicKey, walletPk: PublicKey) {
    return getVoterPDA(registrar, walletPk, this.program.programId)
  }

  getVoterWeightRecordPDA(registrar: PublicKey, walletPk: PublicKey) {
    return getVoterWeightPDA(registrar, walletPk, this.program.programId)
  }

  async createVoterWeightRecord(
    voter: PublicKey,
    realm: PublicKey,
    mint: PublicKey
  ): Promise<TransactionInstruction> {
    const { registrar } = await this.getRegistrarPDA(realm, mint)
    const { voter: voterPda, voterBump } = await this.getVoterPDA(registrar, voter)
    const { voterWeightPk, voterWeightBump } = await this.getVoterWeightRecordPDA(
      registrar,
      voter
    )

    return this.program.methods
      .createVoter(voterBump, voterWeightBump)
      .accounts({
        registrar,
        voter: voterPda,
        voterAuthority: voter,
        voterWeightRecord: voterWeightPk,
        payer: voter,
        systemProgram: SYSTEM_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction()
  }

  async updateVoterWeightRecord(
    voter: PublicKey,
    realm: PublicKey,
    mint: PublicKey
  ): Promise<{ pre: TransactionInstruction[] }> {
    const { registrar } = await this.getRegistrarPDA(realm, mint)
    const { voter: voterPda } = await this.getVoterPDA(registrar, voter)
    const { voterWeightPk } = await this.getVoterWeightRecordPDA(registrar, voter)
    const instruction = await this.program.methods
      .updateVoterWeightRecord()
      .accounts({
        registrar,
        voter: voterPda,
        voterWeightRecord: voterWeightPk,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction()

    return { pre: [instruction] }
  }

  static async connect(
    provider: Provider,
    programId: web3.PublicKey = DEFAULT_VSR_ID,
    devnet?: boolean
  ): Promise<VsrClient> {
    const idl = IDL

    return new VsrClient(
      new Program<VoterStakeRegistry>(
        idl as VoterStakeRegistry,
        programId,
        provider
      ) as Program<VoterStakeRegistry>,
      devnet
    )
  }
}
