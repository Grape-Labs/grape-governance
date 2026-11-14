import { Authorized, Lockup, PublicKey, StakeInstruction, StakeAuthorizationLayout, StakeProgram, VoteProgram, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export function singleStakeInstruction(result: any): TransactionInstruction {
  if (Array.isArray(result?.instructions)) {
    if (result.instructions.length !== 1) throw new Error('Expected exactly one stake instruction; refusing to discard instructions');
    return result.instructions[0];
  }
  return result;
}

export async function assertTreasuryStakeAuthority(connection: any, address: PublicKey, treasury: PublicKey, requireStaker = false) {
  const response = await connection.getParsedAccountInfo(address, 'confirmed');
  const account = response?.value;
  if (!account?.owner?.equals?.(StakeProgram.programId)) throw new Error('Account is not owned by the native Stake Program');
  const info = account.data?.parsed?.info;
  const authorized = info?.meta?.authorized;
  if (!authorized?.withdrawer || !new PublicKey(authorized.withdrawer).equals(treasury)) throw new Error('Treasury must hold withdrawal authority; refusing to manage externally controlled stake');
  if (requireStaker && (!authorized?.staker || !new PublicKey(authorized.staker).equals(treasury))) throw new Error('Treasury must hold stake authority for this action');
  return account;
}

const validateAmount = (lamports: number) => {
  if (!Number.isSafeInteger(lamports) || lamports <= 0) throw new Error('Stake amount must be a positive safe integer in lamports');
};

export async function buildTreasuryStake(connection: any, treasury: PublicKey, seed: string, lamports: number, vote: PublicKey) {
  validateAmount(lamports);
  const address = await PublicKey.createWithSeed(treasury, seed, StakeProgram.programId);
  if ((await connection.getAccountInfo(address, 'confirmed'))) throw new Error('Derived stake account already exists. Choose a new seed; existing accounts are never reused for new stakes.');
  const rent = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
  validateAmount(rent + lamports);
  return [
    SystemProgram.createAccountWithSeed({fromPubkey:treasury,newAccountPubkey:address,basePubkey:treasury,seed,lamports:rent+lamports,space:StakeProgram.space,programId:StakeProgram.programId}),
    StakeProgram.initialize({stakePubkey:address,authorized:new Authorized(treasury,treasury),lockup:new Lockup(0,0,treasury)}),
    singleStakeInstruction(StakeProgram.delegate({stakePubkey:address,authorizedPubkey:treasury,votePubkey:vote})),
  ];
}

export async function buildTreasurySplitDeactivate(connection: any, treasury: PublicKey, source: PublicKey, seed: string, lamports: number) {
  validateAmount(lamports);
  await assertTreasuryStakeAuthority(connection, source, treasury, true);
  const destination = await PublicKey.createWithSeed(treasury, seed, StakeProgram.programId);
  if (await connection.getAccountInfo(destination, 'confirmed')) throw new Error('Split destination already exists. Choose a new seed.');
  const rent = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
  // The SDK splitWithSeed() returns allocation AND split. We create with a treasury
  // seed instead, and retain only the explicitly verified Split instruction.
  const splitTransaction = StakeProgram.splitWithSeed({stakePubkey:source,authorizedPubkey:treasury,splitStakePubkey:destination,basePubkey:treasury,seed,lamports});
  const split = splitTransaction.instructions[splitTransaction.instructions.length - 1];
  if (StakeInstruction.decodeInstructionType(split) !== 'Split') throw new Error('Unexpected SDK split instruction layout');
  return [
    // Native on-chain guard: reauthorize the withdrawer to the SAME treasury.
    // If an RPC lied about ownership or it changed before execution, this fails
    // atomically instead of splitting into an account controlled by someone else.
    singleStakeInstruction(StakeProgram.authorize({stakePubkey:source,authorizedPubkey:treasury,newAuthorizedPubkey:treasury,stakeAuthorizationType:StakeAuthorizationLayout.Withdrawer})),
    SystemProgram.createAccountWithSeed({fromPubkey:treasury,newAccountPubkey:destination,basePubkey:treasury,seed,lamports:rent,space:StakeProgram.space,programId:StakeProgram.programId}),
    split,
    singleStakeInstruction(StakeProgram.deactivate({stakePubkey:destination,authorizedPubkey:treasury})),
  ];
}


export async function buildTreasuryDelegateExisting(connection: any, treasury: PublicKey, source: PublicKey, vote: PublicKey) {
  const account = await assertTreasuryStakeAuthority(connection, source, treasury, true);
  const parsed = account.data?.parsed;
  if (parsed?.type !== 'initialized') {
    let activation: any;
    try { activation = await connection.getStakeActivation(source, 'confirmed'); }
    catch { throw new Error('Cannot verify that this stake is fully inactive. Refresh using an RPC with activation support before delegating.'); }
    if (activation?.state !== 'inactive') throw new Error(`Stake is ${activation?.state || 'unverified'}. Wait until fully inactive before changing validator.`);
  }
  const voteAccount = await connection.getAccountInfo(vote, 'confirmed');
  if (!voteAccount?.owner?.equals?.(VoteProgram.programId)) throw new Error('Validator address must be a native vote account');
  return [
    singleStakeInstruction(StakeProgram.authorize({stakePubkey:source,authorizedPubkey:treasury,newAuthorizedPubkey:treasury,stakeAuthorizationType:StakeAuthorizationLayout.Withdrawer})),
    singleStakeInstruction(StakeProgram.delegate({stakePubkey:source,authorizedPubkey:treasury,votePubkey:vote})),
  ];
}
