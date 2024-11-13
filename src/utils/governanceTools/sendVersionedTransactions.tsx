import {
  Connection,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  PublicKey,
  ComputeBudgetProgram,
  Keypair,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { AnchorWallet } from "@solana/wallet-adapter-react";

export enum SequenceType {
  Sequential,
  Parallel,
  StopOnFailure,
}

export type WalletSigner = Pick<
  AnchorWallet,
  'publicKey' | 'signTransaction' | 'signAllTransactions'
>

export const sendVersionedTransactions = async (
  connection: Connection,
  wallet: WalletSigner,
  instructionSet: TransactionInstruction[][],
  signersSet: Keypair[][],
  sequenceType: SequenceType = SequenceType.Parallel,
  commitment: 'confirmed' | 'finalized' = 'confirmed',
  successCallback: (txid: string, index: number, total: number) => void = (_txid, _index, _total) => null,
  failCallback: (reason: string, index: number, total: number) => boolean = (_reason, _index, _total) => false,
): Promise<any> => {
  if (!wallet?.publicKey) throw new Error('Wallet not connected!');

  const unsignedTxns: VersionedTransaction[] = [];
  const blockhash = await connection.getLatestBlockhash(commitment);
  
  console.log(`Using blockhash: ${blockhash.blockhash} at valid height: ${blockhash.lastValidBlockHeight}`);

  for (let i = 0; i < instructionSet.length; i++) {
    const instructions = instructionSet[i];
    const signers = signersSet[i];

    if (instructions.length === 0) continue;

    // Add Compute Budget Instructions (if needed)
    const computeBudgetInstructions = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }), // Adjust as needed
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10000 }), // Priority fee
    ];

    // Combine all instructions
    const allInstructions = [...computeBudgetInstructions, ...instructions];

    // Create TransactionMessage
    const message = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash.blockhash,
      instructions: allInstructions,
    }).compileToV0Message();

    // Create VersionedTransaction
    const transaction = new VersionedTransaction(message);

    // Add Partial Signatures
    if (signers.length > 0) {
      transaction.sign(signers);
    }

    unsignedTxns.push(transaction);
  }

  // Sign All Transactions
  const signedTxns = await wallet.signAllTransactions(unsignedTxns);

  // Sending Transactions
  const sendPromises = [];
  for (let i = 0; i < signedTxns.length; i++) {
    const tx = signedTxns[i];

    const sendPromise = connection.sendTransaction(tx, {
      skipPreflight: true,
      maxRetries: 5,
    });

    sendPromises.push(
      sendPromise
        .then((txid) => {
          console.log(`Transaction ${i + 1}/${signedTxns.length} sent with txid: ${txid}`);
          successCallback(txid, i, signedTxns.length);
          return txid;
        })
        .catch((reason) => {
          console.error(`Transaction ${i + 1}/${signedTxns.length} failed:`, reason);
          failCallback(reason.toString(), i, signedTxns.length);
          if (sequenceType === SequenceType.StopOnFailure) {
            throw new Error(`Transaction ${i + 1} failed, stopping sequence`);
          }
        }),
    );
  }

  if (sequenceType === SequenceType.Sequential) {
    // Sequential processing
    for (const promise of sendPromises) {
      await promise;
    }
  } else {
    // Parallel processing
    await Promise.all(sendPromises);
  }

  return signedTxns.length;
};
