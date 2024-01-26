// governance ui VoteStakeRegistry/sdk/accounts.tsx

import { BN } from "@project-serum/anchor";
import { MintInfo } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export const VSR_PLUGIN_PKS: string[] = [
  '4Q6WW2ouZ6V3iaNm56MTd5n2tnTm4C5fiH8miFHnAFHo',
  'vsr2nfGVNHmSY8uxoBGqq8AQbwz3JwaEaHqGbsTPXqQ',
  'VotEn9AWwTFtJPJSMV5F9jsMY6QwWM5qn3XP9PATGW7',
  'VoteWPk9yyGmkX4U77nEWRJWpcc8kUfrPoghxENpstL',
  'VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS',
  '5sWzuuYkeWLBdAv3ULrBfqA51zF7Y4rnVzereboNDCPn',
]

export const DEFAULT_NFT_VOTER_PLUGIN =
  'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw'

export const DEFAULT_NFT_VOTER_PLUGIN_V2 =
  'GnftVc21v2BRchsRa9dGdrVmJPLZiRHe9j2offnFTZFg'
  
export const NFT_PLUGINS_PKS: string[] = [
  DEFAULT_NFT_VOTER_PLUGIN,
  'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw',
  'GnftVc21v2BRchsRa9dGdrVmJPLZiRHe9j2offnFTZFg', // v2, supporting compressed nft
]

export const GATEWAY_PLUGINS_PKS: string[] = [
  'Ggatr3wgDLySEwA2qEjt1oiw4BUzp5yMLJyz21919dq6',
  'GgathUhdrCWRHowoRKACjgWhYHfxCEdBi5ViqYN6HVxk', // v2, supporting composition
]

export const PYTH_PLUGIN_PK: string[] = [
  'pytS9TjG1qyAZypk7n8rw8gfW9sUaqqYyMhJQ4E7JCQ',
]

export interface Voter {
  deposits: Deposit[];
  voterAuthority: PublicKey;
  registrar: PublicKey;
  //there are more fields but no use for them on ui yet
}

export type TokenProgramAccount<T> = {
  publicKey: PublicKey;
  account: T;
};

export interface votingMint {
  baselineVoteWeightScaledFactor: BN;
  digitShift: number;
  grantAuthority: PublicKey;
  lockupSaturationSecs: BN;
  maxExtraLockupVoteWeightScaledFactor: BN;
  mint: PublicKey;
}

export type LockupType = "none" | "monthly" | "cliff" | "constant" | "daily"; //there is also daily type but not used on ui yet
export interface Registrar {
  governanceProgramId: PublicKey;
  realm: PublicKey;
  realmAuthority: PublicKey;
  realmGoverningTokenMint: PublicKey;
  votingMints: votingMint[];
  //there are more fields but no use for them on ui yet
}
interface LockupKind {
  none: object;
  daily: object;
  monthly: object;
  cliff: object;
  constant: object;
}
interface Lockup {
  endTs: BN;
  kind: LockupKind;
  startTs: BN;
}
export interface Deposit {
  allowClawback: boolean;
  amountDepositedNative: BN;
  amountInitiallyLockedNative: BN;
  isUsed: boolean;
  lockup: Lockup;
  votingMintConfigIdx: number;
}
export interface DepositWithMintAccount extends Deposit {
  mint: TokenProgramAccount<MintInfo>;
  index: number;
  available: BN;
  vestingRate: BN | null;
  currentlyLocked: BN;
  nextVestingTimestamp: BN | null;
  votingPower: BN;
  votingPowerBaseline: BN;
}

export const emptyPk = "11111111111111111111111111111111";

export const getRegistrarPDA = async (
  realmPk: PublicKey,
  mint: PublicKey,
  clientProgramId: PublicKey
) => {
  
  const [registrar, registrarBump] = PublicKey.findProgramAddressSync(
  //const [registrar, registrarBump] = await PublicKey.findProgramAddress(
    [Buffer.from("registrar"), realmPk.toBuffer(), mint.toBuffer()],
    clientProgramId
  );
  return {
    registrar,
    registrarBump
  };
};

export const getVoterPDA = async (
  registrar: PublicKey,
  walletPk: PublicKey,
  clientProgramId: PublicKey
) => {

  const [voter, voterBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("voter"), registrar.toBuffer(), walletPk.toBuffer()], clientProgramId);
  /*
  const [voter, voterBump] = await PublicKey.findProgramAddress(
    [registrar.toBuffer(), Buffer.from("voter"), walletPk.toBuffer()],
    clientProgramId
  );*/

  return {
    voter,
    voterBump,
  };
};

export const getVoterWeightRecord = async (
  realmPk: PublicKey,
  mint: PublicKey,
  walletPk: PublicKey,
  clientProgramId: PublicKey
) => {
  console.log("realmPk: "+realmPk.toBase58());
  const [voterWeightPk, voterWeightBump] = PublicKey.findProgramAddressSync(
  //const [voterWeightPk, voterWeightBump] = await PublicKey.findProgramAddress(
      [
      Buffer.from("voter-weight-record"),
      realmPk.toBuffer(),
      mint.toBuffer(),
      walletPk.toBuffer(),
    ],
    clientProgramId
  );

  return {
    voterWeightPk,
    voterWeightBump,
  };
};

export const getMaxVoterWeightRecord = async (
  realmPk: PublicKey,
  mint: PublicKey,
  clientProgramId: PublicKey
) => {
  const [maxVoterWeightRecord,maxVoterWeightRecordBump] = PublicKey.findProgramAddressSync(
  //const [maxVoterWeightRecord,maxVoterWeightRecordBump] = await PublicKey.findProgramAddress(
      [
      Buffer.from('max-voter-weight-record'),
      realmPk.toBuffer(),
      mint.toBuffer(),
    ],
    clientProgramId
  )
  return {
    maxVoterWeightRecord,
    maxVoterWeightRecordBump,
  }
}

