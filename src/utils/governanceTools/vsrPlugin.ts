import { AnchorProvider } from '@coral-xyz/anchor';
import { AccountInfo, PublicKey } from '@solana/web3.js';

import { RPC_CONNECTION } from '../grapeTools/constants';
import { VsrClient } from './components/instructions/client';
import { getRegistrarPDA } from './components/instructions/account';

const READONLY_WALLET_PK = new PublicKey('11111111111111111111111111111111');

const createReadonlyWalletAdapter = () => ({
  publicKey: READONLY_WALLET_PK,
  signTransaction: async (tx: any) => tx,
  signAllTransactions: async (txs: any) => txs,
});

const toPublicKeyOrNull = (value: PublicKey | string | null | undefined): PublicKey | null => {
  try {
    if (!value) return null;
    if (value instanceof PublicKey) return value;
    return new PublicKey(value);
  } catch {
    return null;
  }
};

export type VsrRegistrarInfo = {
  client: VsrClient;
  registrar: PublicKey;
  registrarAccountInfo: AccountInfo<Buffer>;
  registrarState: any;
};

export const getReadonlyVsrClient = async (programId: PublicKey | string) => {
  const resolvedProgramId = toPublicKeyOrNull(programId);
  if (!resolvedProgramId) {
    throw new Error('Invalid VSR program id');
  }

  const provider = new AnchorProvider(
    RPC_CONNECTION,
    createReadonlyWalletAdapter() as any,
    AnchorProvider.defaultOptions()
  );

  return VsrClient.connect(provider, resolvedProgramId, false);
};

export const getVsrRegistrarInfo = async (
  programId: PublicKey | string | null | undefined,
  realmPk: PublicKey | string | null | undefined,
  mintPk: PublicKey | string | null | undefined
): Promise<VsrRegistrarInfo | null> => {
  const resolvedProgramId = toPublicKeyOrNull(programId);
  const resolvedRealmPk = toPublicKeyOrNull(realmPk);
  const resolvedMintPk = toPublicKeyOrNull(mintPk);

  if (!resolvedProgramId || !resolvedRealmPk || !resolvedMintPk) {
    return null;
  }

  try {
    const client = await getReadonlyVsrClient(resolvedProgramId);
    const { registrar } = await getRegistrarPDA(
      resolvedRealmPk,
      resolvedMintPk,
      client.program.programId
    );
    const registrarAccountInfo = await RPC_CONNECTION.getAccountInfo(registrar);

    if (!registrarAccountInfo?.data) {
      return null;
    }

    const registrarState = client.program.coder.accounts.decode(
      'registrar',
      registrarAccountInfo.data
    );

    return {
      client,
      registrar,
      registrarAccountInfo,
      registrarState,
    };
  } catch {
    return null;
  }
};

export const isVsrPluginForRealm = async (
  programId: PublicKey | string | null | undefined,
  realmPk: PublicKey | string | null | undefined,
  mintPk: PublicKey | string | null | undefined
): Promise<boolean> => {
  return !!(await getVsrRegistrarInfo(programId, realmPk, mintPk));
};
