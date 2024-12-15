import {
  Commitment,
  Connection,
  RpcResponseAndContext,
  SignatureStatus,
  SimulatedTransactionResponse,
  Transaction,
  TransactionMessage,
  TransactionInstruction,
  TransactionSignature,
  Keypair,
  VersionedMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
  GetRecentPrioritizationFeesConfig,
} from '@solana/web3.js';
//import  SignerWalletAdapter  from "@project-serum/sol-wallet-adapter";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { 
  RPC_CONNECTION,
  DEFAULT_PRIORITY_RATE,
  DEFAULT_MAX_PRIORITY_RATE } from '../grapeTools/constants';
import { sendVersionedTransactions } from "./sendVersionedTransactions";

// TODO: sendTransactions() was imported from Oyster as is and needs to be reviewed and updated
// In particular common primitives should be unified with send.tsx and also ensure the same resiliency mechanism
// is used for monitoring transactions status and timeouts

const sleep = (ttl: number) =>
  new Promise((resolve) => setTimeout(() => resolve(true), ttl))

export type WalletSigner = Pick<
  AnchorWallet,
  'publicKey' | 'signTransaction' | 'signAllTransactions'
>

export function getWalletPublicKey(wallet: WalletSigner) {
  if (!wallet.publicKey) {
    throw new Error('Wallet not connected!')
  }

  return wallet.publicKey
}

async function awaitTransactionSignatureConfirmation(
  txid: TransactionSignature,
  timeout: number,
  connection: Connection,
  commitment: Commitment = 'recent',
  queryStatus = false
) {
  let done = false
  let status: SignatureStatus | null = {
    slot: 0,
    confirmations: 0,
    err: null,
  }
  let subId = 0
  await new Promise((resolve, reject) => {
    const fn = async () => {
      setTimeout(() => {
        if (done) {
          return
        }
        done = true
        reject({ timeout: true })
      }, timeout)
      try {
        subId = connection.onSignature(
          txid,
          (result, context) => {
            done = true
            status = {
              err: result.err,
              slot: context.slot,
              confirmations: 0,
            }
            if (result.err) {
              console.log('Rejected via websocket', result.err)
              reject(result.err)
            } else {
              console.log('Resolved via websocket', result)
              resolve(result)
            }
          },
          commitment
        )
      } catch (e) {
        done = true
        console.error('WS error in setup', txid, e)
      }
      while (!done && queryStatus) {
        // eslint-disable-next-line no-loop-func
        const fn = async () => {
          try {
            const signatureStatuses = await connection.getSignatureStatuses([
              txid,
            ])
            status = signatureStatuses && signatureStatuses.value[0]
            if (!done) {
              if (!status) {
                console.log('REST null result for', txid, status)
              } else if (status.err) {
                console.log('REST error for', txid, status)
                done = true
                reject(status.err)
              } else if (!status.confirmations) {
                console.log('REST no confirmations for', txid, status)
              } else {
                console.log('REST confirmation for', txid, status)
                done = true
                resolve(status)
              }
            }
          } catch (e) {
            if (!done) {
              console.log('REST connection error: txid', txid, e)
            }
          }
        }
        fn()
        await sleep(2000)
      }
    }
    fn()
  })
    .catch((err) => {
      if (err.timeout && status) {
        status.err = { timeout: true }
      }

      //@ts-ignore
      if (connection._signatureSubscriptions[subId])
        connection.removeSignatureListener(subId)
    })
    .then((_) => {
      //@ts-ignore
      if (connection._signatureSubscriptions[subId])
        connection.removeSignatureListener(subId)
    })
  done = true
  return status
}

//////////////////////////////////////////////
export async function simulateTransaction(
  connection: Connection,
  transaction: Transaction,
  commitment: Commitment
): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
  // @ts-ignore
  transaction.recentBlockhash = await connection._recentBlockhash(
    // @ts-ignore
    connection._disableBlockhashCaching
  )

  const signData = transaction.serializeMessage()
  // @ts-ignore
  const wireTransaction = transaction._serialize(signData)
  const encodedTransaction = wireTransaction.toString('base64')
  const config: any = { encoding: 'base64', commitment }
  const args = [encodedTransaction, config]

  // @ts-ignore
  const res = await connection._rpcRequest('simulateTransaction', args)
  if (res.error) {
    throw new Error('failed to simulate transaction: ' + res.error.message)
  }
  return res.result
}
///////////////////////////////////////
export const getUnixTs = () => {
  return new Date().getTime() / 1000
}

const DEFAULT_TIMEOUT = 30000
/////////////////////////////////////////////////
export async function sendSignedTransaction({
  signedTransaction,
  connection,
  timeout = DEFAULT_TIMEOUT,
}: {
  signedTransaction: Transaction
  connection: Connection
  sendingMessage?: string
  sentMessage?: string
  successMessage?: string
  timeout?: number
}): Promise<{ txid: string; slot: number }> {

  // Add priority fee
  const rawTransaction = signedTransaction.serialize()
  const startTime = getUnixTs()
  let slot = 0

  /*
async function createAndSendV0Tx(RPC_CONNECTION: Connection, wallet: WalletSigner, txInstructions: TransactionInstruction[]) {
  // Step 1 - Fetch Latest Blockhash
  let latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
  console.log("   ✅ - Fetched latest blockhash. Last valid height:", latestBlockhash.lastValidBlockHeight);

  // Step 2 - Generate Transaction Message
  const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions
  }).compileToV0Message();
  console.log("   ✅ - Compiled transaction message");
  const transaction = new VersionedTransaction(messageV0);

  // Step 3 - Sign your transaction with the required `Signers`
  //transaction.addSignature(publicKey);
  //transaction.sign(wallet);
  //const signedTransaction = await signTransaction(transaction);
  //const signedTx = await signTransaction(transaction);
  console.log("   ✅ - Transaction Signed");

  // Step 4 - Send our v0 transaction to the cluster
  //const txid = await RPC_CONNECTION.sendTransaction(signedTransaction, { maxRetries: 5 });
  
  //const tx = new Transaction();
  //tx.add(txInstructions[0]);


  const txid = await sendTransaction(transaction, RPC_CONNECTION, {
      skipPreflight: true,
      preflightCommitment: "confirmed"
  });
  
  console.log("   ✅ - Transaction sent to network with txid: "+txid);

  // Step 5 - Confirm Transaction 
  //const snackprogress = (key:any) => (<CircularProgress sx={{padding:'10px'}} />);
  //const cnfrmkey = enqueueSnackbar(`Confirming Speed Dial Creation`,{ variant: 'info', action:snackprogress, persist: true });
  const confirmation = await RPC_CONNECTION.confirmTransaction({
      signature: txid,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  });
  //closeSnackbar(cnfrmkey);
  if (confirmation.value.err) { 
  //    enqueueSnackbar(`Speed Dial Error`,{ variant: 'error' });
      throw new Error("   ❌ - Transaction not confirmed.") }

  console.log('🎉 Transaction succesfully confirmed!', '\n', `https://explorer.solana.com/tx/${txid}`);
  return txid;
}
*/

  const txid: TransactionSignature = await connection.sendRawTransaction(
    rawTransaction,
    {
      skipPreflight: true,
      maxRetries: 5,
    }
  )
  
  let done = false
  ;(async () => {
    while (!done && getUnixTs() - startTime < timeout) {
      try{
        await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 5,
        })
        await sleep(1000)
      } catch(e){
        try{
          await sleep(2000)
          await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true,
            maxRetries: 20,
          })
          await sleep(1000)
        }catch(e2){
          console.log("Status: Internal Error");
        }
      }
    }
  })()
  try {
    const confirmation = await awaitTransactionSignatureConfirmation(
      txid,
      timeout,
      connection,
      'recent',
      true
    )

    if (confirmation.err) {
      console.error(confirmation.err)
      throw new Error('Transaction failed: Custom instruction error')
    }

    slot = confirmation?.slot || 0
  } catch (err) {
    /*if (err.timeout) {
      throw new Error('Timed out awaiting confirmation on transaction')
    }*/
    let simulateResult: SimulatedTransactionResponse | null = null
    try {
      simulateResult = (
        await simulateTransaction(connection, signedTransaction, 'single')
      ).value
    } catch (e) {
      //
    }
    if (simulateResult && simulateResult.err) {
      if (simulateResult.logs) {
        for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
          const line = simulateResult.logs[i]
          if (line.startsWith('Program log: ')) {
            throw new Error(
              'Transaction failed: ' + line.slice('Program log: '.length)
            )
          }
        }
      }
      throw new Error(JSON.stringify(simulateResult.err))
    }
    // throw new Error('Transaction failed');
  } finally {
    done = true
  }

  console.log('Latency', txid, getUnixTs() - startTime)
  return { txid, slot }
}
export enum SequenceType {
  Sequential,
  Parallel,
  StopOnFailure,
}

const addSignerToInstructions = (transaction, signer) => {
  transaction.instructions.forEach((instruction) => {
      // Check if the signer is already part of the instruction
      const isSignerIncluded = instruction.keys.some(
          (key) => key.pubkey.equals(signer.publicKey) && key.isSigner
      );

      if (!isSignerIncluded) {
          // Clone the keys array and add the signer
          const newKeys = [
              ...instruction.keys,
              {
                  pubkey: signer.publicKey,
                  isSigner: true,
                  isWritable: false, // Adjust based on your requirements
              },
          ];

          // Create a new instruction with the updated keys
          const newInstruction = new TransactionInstruction({
              programId: instruction.programId,
              keys: newKeys,
              data: instruction.data,
          });

          // Replace the old instruction with the new one
          const index = transaction.instructions.indexOf(instruction);
          if (index !== -1) {
              transaction.instructions[index] = newInstruction;
          }
      }
  });

  return transaction;
};

/////////////////////////////////////////
export const sendTransactions = async (
  connection: Connection,
  wallet: WalletSigner,
  //authTransaction: Transaction,
  instructionSet: TransactionInstruction[][],
  signersSet: Keypair[][],
  sequenceType: SequenceType = SequenceType.Parallel,
  commitment: Commitment = 'singleGossip',
  successCallback: (txid: string, ind: number, len: number) => void = (_txid, _ind, _len) => null,
  failCallback: (reason: string, ind: number, len: number) => boolean = (_txid, _ind, _len) =>
    false,
  startIxIndex?: number,
  block?: {
    blockhash: string
    //feeCalculator: FeeCalculator
  }
): Promise<any> => {
  
  if (!wallet?.publicKey) throw new Error('Wallet not connected!')
  const unsignedTxns: Transaction[] = []

  if (!block) {
    block = await connection.getLatestBlockhash(commitment)
  }

  let average_priority_fee = null;
  let medianPrioritizationFee = null;
  
  try{    
    const rpf = await RPC_CONNECTION.getRecentPrioritizationFees();
    if (rpf){
      console.log("rpf: "+JSON.stringify(rpf));
      
      const totalPrioritizationFee = rpf.reduce((total, item) => total + item.prioritizationFee, 0);
      const averagePrioritizationFee = totalPrioritizationFee / rpf.length;

      average_priority_fee = Math.floor(averagePrioritizationFee);
      console.log("Average Prioritization Fee: "+ average_priority_fee);
      
      const sortedPrioritizationFees = rpf.map(item => item.prioritizationFee).sort((a, b) => a - b);

      // Step 2: Determine the middle element(s)
      const middleIndex = Math.floor(sortedPrioritizationFees.length / 2);

      // Step 3: Calculate the median
      if (sortedPrioritizationFees.length % 2 === 0) {
          // If even number of elements, average the two middle elements
          medianPrioritizationFee = (sortedPrioritizationFees[middleIndex - 1] + sortedPrioritizationFees[middleIndex]) / 2;
      } else {
          // If odd number of elements, take the middle element
          medianPrioritizationFee = sortedPrioritizationFees[middleIndex];
      }

      // If you need the median as an integer, you can use Math.floor or Math.ceil
      medianPrioritizationFee = Math.floor(medianPrioritizationFee);

      console.log("Median Prioritization Fee: "+ medianPrioritizationFee);

      if (medianPrioritizationFee > DEFAULT_MAX_PRIORITY_RATE){
        medianPrioritizationFee = DEFAULT_PRIORITY_RATE;
      }
      // lamports = Math.min(lamports, data.prioritizationFee);
      // const fee =  BN.max(BN.max(globalFeeRate, localFeeRate), new BN(8000));
      // return BN.min(fee, this.maxFeeMicroLamports);
    }
  }catch(e){
    console.log("ERR: "+e);
  }
  
  const PRIORITY_RATE = medianPrioritizationFee ? medianPrioritizationFee : DEFAULT_PRIORITY_RATE; // 10000; // MICRO_LAMPORTS 
  const SEND_AMT = 0.01 * LAMPORTS_PER_SOL;
  const PRIORITY_FEE_IX = ComputeBudgetProgram.setComputeUnitPrice({microLamports: PRIORITY_RATE});
  console.log("Adding priority fee at the rate of "+PRIORITY_RATE+ " micro lamports");
  
  //console.log("sendTx Signers: "+JSON.stringify(signersSet));

  for (let i = 0; i < instructionSet.length; i++) {
    console.log("Checking Ix set "+i);
    const instructions = instructionSet[i]
    const signers = signersSet[i]

    if (instructions.length === 0) {
      continue
    }

    let transaction = new Transaction();

    instructions.forEach((instruction) => transaction.add(instruction))

    //if (authTransaction && authTransaction.instructions.length > 0){
    //  console.log("Has auth instructions: "+JSON.stringify(authTransaction));
      //transaction.add(authTransaction);
    //}
    
    transaction.recentBlockhash = block.blockhash;
    transaction.feePayer = wallet.publicKey;
    transaction.add(PRIORITY_FEE_IX);
    
    transaction.instructions.forEach((instruction, index) => {
      console.log(`Instruction ${index}:`, instruction.keys.map(key => ({
          pubkey: key.pubkey.toBase58(),
          isSigner: key.isSigner,
      })));
  });

    console.log("signers: "+JSON.stringify(signers));

    const flattenedSigners = signers.flat();
    if (flattenedSigners && flattenedSigners.length > 0) {
      for (var signer of flattenedSigners){
        
        if (signer && signer?.publicKey){
          console.log("Signer: "+signer.publicKey?.toBase58())
          // check if this is a signer

          let foundSigner = false;
          
          // Check if the signer is required in the transaction
            const requiresSigner = transaction.instructions.some((ix) =>
              ix.keys.some((key) => key.pubkey.equals(signer.publicKey) && key.isSigner)
          );

          if (requiresSigner) {
              console.log("Partially signing the transaction...");
              transaction.partialSign(signer);  // Correct way to partially sign
          } else {
              console.warn("Signer not required in the transaction.");
          }
          /*
          transaction.instructions.forEach((ix) => {
            if (ix.keys.some((key) => key.pubkey.equals(signer.publicKey))) {
                foundSigner = true;
                console.log("partially signing...");
                transaction.partialSign(signer);
            }
          });
          */
        
          if (!foundSigner){
            /*
            const serializedTransaction = transaction.serialize({
              requireAllSignatures: false,
              verifySignatures: false,
            });
            console.log("serializedTx");
            const deserializedTransaction = Transaction.from(serializedTransaction);
            console.log("deserialized tx");
            
            const signature = deserializedTransaction.signatures.find(sig =>
              sig.publicKey.equals(signer.publicKey)
            )?.signature;
            transaction.addSignature(signer.publicKey, signature);  
            */
            console.log("Adding Signer: "+signer.publicKey.toBase58())
            transaction = addSignerToInstructions(transaction, signer);
            //transaction.feePayer = signer.publicKey;
            //transaction.setSigners(signer.publicKey); //.addSignature() .setSigners(wallet!.publicKey!, ...signers.map((s) => s.publicKey))
            transaction.partialSign(signer);
            console.log("Added signer");
          }
          
        }
        
      }
      if (signers.length > 0) {
        console.log("tx: "+JSON.stringify(transaction));
      }

      //console.log("Transaction after adding signer: "+JSON.stringify(transaction));

      //transaction.partialSign(...signers);
    }

    console.log("Signed...")
    
    unsignedTxns.push(transaction)
  }

  const signedTxns = await wallet.signAllTransactions(unsignedTxns)
  const pendingTxns: Promise<{ txid: string; slot: number }>[] = []
  const completedTxns: Promise<{ txid: string; slot: number }>[] = []
  //const walletPkTest = getWalletPublicKey(wallet);
  //console.log('Wallet Test:', walletPkTest.toBase58());
  //console.log('signedTxns' +JSON.stringify(signedTxns));
  
  const breakEarlyObject = { breakEarly: false }

  // Inspect signatures
  signedTxns.forEach((txn, index) => {
    console.log(`Transaction ${index + 1}:`);
    txn.signatures.forEach(({ publicKey, signature }, signerIndex) => {
      console.log(
        `Signer ${signerIndex + 1}: ${publicKey.toBase58()} - ${signature ? "Signed" : "Not Signed"}`
      );
    });
  });

  /*
  const confirmation = await RPC_CONNECTION.confirmTransaction({
      signature: txid,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  });
  */
  //closeSnackbar(cnfrmkey);
  let startIndex = 0;//startIxIndex || 0;

  for (let i = startIndex; i < signedTxns.length; i++) {
    console.log('i:',i);
    const signedTxnPromise = sendSignedTransaction({
      connection,
      signedTransaction: signedTxns[i],
    })

    signedTxnPromise
    .then(({ txid }) => {
      console.log("First Pass (ix: "+i+" of "+signedTxns.length+"): Success!");
      successCallback(txid, i, signedTxns.length);
    })
    .catch((_reason) => {
      /*
      // @ts-ignore
      console.log("First Pass Failed (ix: "+i+"): Attmepting second pass...");
      // Add a 2-second delay before retrying
      if (enqueueSnackbar)
        enqueueSnackbar(`First Attempt Failed: Attempting second attempt at tx ${i+1}`,{ variant: 'info' });

      setTimeout(() => {
        const signedTxnPromise2 = sendSignedTransaction({
          connection,
          signedTransaction: signedTxns[i],
        });
        signedTxnPromise2
          .then(({ txid }) => {
            console.log("Second Pass (ix: "+i+"): Success!");
            successCallback(txid, i);
          })
          .catch((_reason) => {
            */
            // @ts-ignore
            console.log("Second Pass (ix: "+i+" of "+signedTxns.length+"): Failed, processing has stopped!");
            try{
              if (failCallback){
                failCallback("Failed Tx", i, signedTxns.length);
                if (sequenceType == SequenceType.StopOnFailure) {
                  breakEarlyObject.breakEarly = true;
                }
              }
            }catch(err){
              console.log("Failback ERR: "+err);
            }
            /*
          });
      }, 2000); // 2-second delay
      */
    });

    //if (closeSnackbar)
    //  closeSnackbar(cnfrmkey);
    
    if (sequenceType != SequenceType.Parallel) {
      await signedTxnPromise
      if (breakEarlyObject.breakEarly) {
        return i // Return the txn we failed on by index
      }
      completedTxns.push(signedTxnPromise);
    } else {
      pendingTxns.push(signedTxnPromise)
    }
  }

  if (sequenceType != SequenceType.Parallel) {
    await Promise.all(pendingTxns)
  }

  const response = {
    signedTxns: signedTxns.length,
    completedTxns
  }

  return response;//signedTxns.length
}

export const prepareTransactions = async (
  connection: Connection,
  wallet: WalletSigner,
  //authTransaction: Transaction,
  instructionSet: TransactionInstruction[][],
  signersSet: Keypair[][],
  sequenceType: SequenceType = SequenceType.Parallel,
  commitment: Commitment = 'singleGossip',
  successCallback: (txid: string, ind: number) => void = (_txid, _ind) => null,
  failCallback: (reason: string, ind: number) => boolean = (_txid, _ind) =>
    false,
  block?: {
    blockhash: string
    //feeCalculator: FeeCalculator
  }
): Promise<any> => {
  if (!wallet.publicKey) throw new Error('Wallet not connected!')
  const unsignedTxns: Transaction[] = []

  if (!block) {
    block = await connection.getLatestBlockhash(commitment)
  }

  const bigTx = new Transaction();
  for (let i = 0; i < instructionSet.length; i++) {
    const instructions = instructionSet[i]
    const signers = signersSet[i]

    if (instructions.length === 0) {
      continue
    }

    const transaction = new Transaction();

    instructions.forEach((instruction) => 
      transaction.add(instruction)
    )

    instructions.forEach((instruction) => 
      bigTx.add(instruction)
    )

    //if (authTransaction && authTransaction.instructions.length > 0){
    //  console.log("Has auth instructions: "+JSON.stringify(authTransaction));
      //transaction.add(authTransaction);
    //}
    
    transaction.recentBlockhash = block.blockhash;
    transaction.feePayer = wallet.publicKey;
    bigTx.recentBlockhash = block.blockhash;
    bigTx.feePayer = wallet.publicKey;
    /*
    transaction.setSigners(
      // fee payed by the wallet owner
      wallet.publicKey,
      ...signers.map((s) => s.publicKey)
    )*/
    
    if (signers.length > 0) {
      transaction.partialSign(...signers);
      bigTx.partialSign(...signers);
    }
    
    unsignedTxns.push(transaction)
  }
  return bigTx;
}
