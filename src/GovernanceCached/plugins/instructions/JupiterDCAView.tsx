import { CloseDCAParams, CreateDCAParams, DCA, type DepositParams, type WithdrawParams, Network } from '@jup-ag/dca-sdk';
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js';
//import dotenv from 'dotenv';
//dotenv.config();

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';

export default function TokenTransferView(props: any) {
  const publicKey = props.publicKey;
  const connection = RPC_CONNECTION;
  const dca = new DCA(connection, Network.MAINNET);
  //const user = Keypair.fromSecretKey(new Uint8Array(JSON.parse(process.env.USER_PRIVATE_KEY))); // create a .env file and include your wallet private key as an array

  const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  const BONK = new PublicKey('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263');

  // e.g. if your input mint is USDC and output mint is SOL and you only want to buy SOL when price is < 20 USDC. minOutAmountPerCycle should be 
  // (ui_in_amount_per_cycle / human_price) * lamports_per_sol
  
  async function createDCA() {
    const params: CreateDCAParams = {
      user: publicKey,
      inAmount: BigInt(5_000_000), // buy a total of 5 USDC over 5 days
      inAmountPerCycle: BigInt(1_000_000), // buy using 1 USDC each day
      cycleSecondsApart: BigInt(86400), // 1 day between each order -> 60 * 60 * 24
      inputMint: USDC, // sell
      outputMint: BONK, // buy
      minOutAmountPerCycle: null,  // refer to Integration doc
      maxOutAmountPerCycle: null, // refer to Integration doc
      startAt: null, // unix timestamp in seconds
      userInTokenAccount: null, // optional: if the inputMint token is not in an Associated Token Account but some other token account, pass in the PublicKey of the token account, otherwise, leave it undefined
    };

    const { tx, dcaPubKey } = await dca.createDCA(params);
    return tx;
    //const txid = await sendAndConfirmTransaction(connection, tx, [user]);

    //console.log('Create DCA: ', { txid });

    //return dcaPubKey;
  }

  // this is for withdrawing from program ATA
  async function withdraw(dcaPubKey) {
    // it's possible to withdraw in-tokens only or out-tokens only or both in and out tokens together. See WithdrawParams for more details
    const params: WithdrawParams = {
      user: publicKey,
      dca: dcaPubKey,
      inputMint: USDC,
      withdrawInAmount: BigInt(1_000_000),
    };

    const { tx } = await dca.withdraw(params);

    return tx;
    //const txid = await sendAndConfirmTransaction(connection, tx, [user]);

    //console.log('Withdraw: ', { txid });
  }

  async function closeDCA(dcaPubKey) {
    const params: CloseDCAParams = {
      user: publicKey,
      dca: dcaPubKey,
    };

    const { tx } = await dca.closeDCA(params);

    return tx;
    //const txid = await sendAndConfirmTransaction(connection, tx, [user]);

    //console.log('Close DCA: ', { txid });
  }
  /*
  async function main() {
    const dcaPubKey = await createDCA();
    console.log('DCA Pub Key: ', { dcaPubKey });

    const dcaAccount = await dca.fetchDCA(dcaPubKey);
    console.log('DCA Account Data: ', { dcaAccount });

    const dcaAccounts = await dca.getCurrentByUser(publicKey);
    console.log({ dcaAccounts });

    await dca.getBalancesByAccount(dcaPubKey);

    await withdraw(dcaPubKey);

    await closeDCA(dcaPubKey);
  }*/
}
//main();