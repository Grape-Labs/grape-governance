import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { 
    RPC_CONNECTION } from '../../../utils/grapeTools/constants';

async function transferTokenInstruction(tokenMintAddress: string, from: string, to: string, amount: number) {
    const fromWallet = new PublicKey(from);
    const toWallet = new PublicKey(to);
    const mintPubkey = new PublicKey(tokenMintAddress);
    const amountToSend = +amount;
    const tokenAccount = new PublicKey(mintPubkey);
    const connection = RPC_CONNECTION;

    if (tokenMintAddress == "So11111111111111111111111111111111111111112"){ // Check if SOL
        const decimals = 9;
        const adjustedAmountToSend = amountToSend;//amountToSend * Math.pow(10, decimals);
        const transaction = new Transaction()
        .add(
            SystemProgram.transfer({
                fromPubkey: fromWallet,
                toPubkey: toWallet,
                lamports: adjustedAmountToSend,
            })
        );
        
        return transaction;
    } else{

        // check if cardinal wrapped..
        const type = 0;
        //const icwt = await isCardinalWrappedToken(connection, tokenMintAddress);
        console.log("mint: "+ tokenMintAddress);
        //console.log("cardinal wrapped: "+JSON.stringify(icwt));

        
            const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
            const accountParsed = JSON.parse(JSON.stringify(accountInfo.value.data));
            //const decimals = accountParsed.parsed.info.decimals;


            const fromTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                fromWallet
            )

            const fromPublicKey = fromWallet
            const destPublicKey = toWallet
            const destTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                destPublicKey
            )
            const receiverAccount = await connection.getAccountInfo(
                destTokenAccount
            )

            const transaction = new Transaction()
            if (receiverAccount === null) {
                transaction.add(
                createAssociatedTokenAccountInstruction(
                    fromPublicKey,
                    destTokenAccount,
                    destPublicKey,
                    mintPubkey,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
                )
            }

            transaction.add(
                createTransferInstruction(
                    fromTokenAccount,
                    destTokenAccount,
                    fromPublicKey,
                    amount
                )
            )
            //console.log("transaction: "+JSON.stringify(transaction))
            return transaction;
        
    }
}