import { PublicKey, SystemProgram, TransactionInstruction, Connection } from '@solana/web3.js';

export const STAKING_VOTER_PLUGIN_PROGRAM_ID =
  'VTRqoZfjUKHh65rGvMCZfEr2jBk89w8qqhM1q7Ph4KX';

const UPDATE_VOTER_WEIGHT_DISCRIMINATOR = Buffer.from([
  92, 35, 133, 94, 230, 70, 14, 157,
]);

export type StakingVoterRegistrar = {
  pubkey: PublicKey;
  realm: PublicKey;
  governanceProgramId: PublicKey;
  governingTokenMint: PublicKey;
  stakingProgramId: PublicKey;
  stakePool: PublicKey;
  bump: number;
};

export type StakingVoterUpdate = {
  instruction: TransactionInstruction;
  voterWeightPk: PublicKey;
  registrar: StakingVoterRegistrar;
  stakeAccount: PublicKey;
};

export const isStakingVoterPlugin = (programId: PublicKey | string | null | undefined): boolean => {
  try {
    if (!programId) return false;
    const resolved = typeof programId === 'string' ? new PublicKey(programId) : programId;
    return resolved.toBase58() === STAKING_VOTER_PLUGIN_PROGRAM_ID;
  } catch {
    return false;
  }
};

export const getStakingVoterRegistrarAddress = (
  realmPk: PublicKey,
  pluginProgramId: PublicKey
): PublicKey => {
  const [registrar] = PublicKey.findProgramAddressSync(
    [Buffer.from('registrar'), realmPk.toBuffer()],
    pluginProgramId
  );
  return registrar;
};

export const getStakingVoterWeightAddress = (
  registrarPk: PublicKey,
  voterAuthority: PublicKey,
  pluginProgramId: PublicKey
): PublicKey => {
  const [voterWeightPk] = PublicKey.findProgramAddressSync(
    [Buffer.from('voter-weight-record'), registrarPk.toBuffer(), voterAuthority.toBuffer()],
    pluginProgramId
  );
  return voterWeightPk;
};

export const getStakingStakeAccountAddress = (
  stakePool: PublicKey,
  voterAuthority: PublicKey,
  stakingProgramId: PublicKey
): PublicKey => {
  const [stakeAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('stake_account'), stakePool.toBuffer(), voterAuthority.toBuffer()],
    stakingProgramId
  );
  return stakeAccount;
};

export const decodeStakingVoterRegistrar = (
  pubkey: PublicKey,
  data: Buffer
): StakingVoterRegistrar => {
  if (!data || data.length < 169) {
    throw new Error('Invalid staking voter registrar account');
  }

  return {
    pubkey,
    realm: new PublicKey(data.slice(8, 40)),
    governanceProgramId: new PublicKey(data.slice(40, 72)),
    governingTokenMint: new PublicKey(data.slice(72, 104)),
    stakingProgramId: new PublicKey(data.slice(104, 136)),
    stakePool: new PublicKey(data.slice(136, 168)),
    bump: data[168],
  };
};

export const getStakingVoterRegistrar = async (
  connection: Connection,
  realmPk: PublicKey,
  pluginProgramId: PublicKey
): Promise<StakingVoterRegistrar | null> => {
  const registrarPk = getStakingVoterRegistrarAddress(realmPk, pluginProgramId);
  const registrarInfo = await connection.getAccountInfo(registrarPk);
  if (!registrarInfo?.data) return null;
  return decodeStakingVoterRegistrar(registrarPk, registrarInfo.data);
};

export const getStakingVoterStakeAmount = async (
  connection: Connection,
  stakeAccount: PublicKey
): Promise<number> => {
  const stakeAccountInfo = await connection.getAccountInfo(stakeAccount);
  if (!stakeAccountInfo?.data || stakeAccountInfo.data.length < 80) return 0;
  return Number(stakeAccountInfo.data.readBigUInt64LE(72));
};

export const createStakingVoterUpdateInstruction = async (
  connection: Connection,
  realmPk: PublicKey,
  voterAuthority: PublicKey,
  payer: PublicKey,
  pluginProgramId: PublicKey
): Promise<StakingVoterUpdate | null> => {
  const registrar = await getStakingVoterRegistrar(connection, realmPk, pluginProgramId);
  if (!registrar) return null;

  const voterWeightPk = getStakingVoterWeightAddress(
    registrar.pubkey,
    voterAuthority,
    pluginProgramId
  );
  const stakeAccount = getStakingStakeAccountAddress(
    registrar.stakePool,
    voterAuthority,
    registrar.stakingProgramId
  );

  const instruction = new TransactionInstruction({
    programId: pluginProgramId,
    keys: [
      { pubkey: voterAuthority, isSigner: true, isWritable: false },
      { pubkey: registrar.pubkey, isSigner: false, isWritable: false },
      { pubkey: voterWeightPk, isSigner: false, isWritable: true },
      { pubkey: stakeAccount, isSigner: false, isWritable: false },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: UPDATE_VOTER_WEIGHT_DISCRIMINATOR,
  });

  return {
    instruction,
    voterWeightPk,
    registrar,
    stakeAccount,
  };
};
