import React, { useCallback } from 'react';
import { WalletError, WalletNotConnectedError, WalletSignMessageError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import {
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
    performReverseLookup,
    getTwitterRegistry,
} from '@bonfida/spl-name-service';

import { styled } from '@mui/material/styles';

import {
  Dialog,
  Button,
  ButtonGroup,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  FormHelperText,
  MenuItem,
  InputLabel,
  Select,
  IconButton,
  Avatar,
  Grid,
  Paper,
  Typography,
  Box,
  Alert
} from '@mui/material';

import ExplorerView from '../../../utils/grapeTools/Explorer';

import { SelectChangeEvent } from '@mui/material/Select';
import { MakeLinkableAddress, ValidateAddress } from '../../../utils/grapeTools/WalletAddress'; // global key handling
import { useSnackbar } from 'notistack';

import { withSend } from "@cardinal/token-manager";

import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';

export default function tokenTransferPlugin(props: any) {
    const [payerAddress, setPayerAddress] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(null);
    const [toAddress, setToAddress] = React.useState(null);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0);

    const connection = RPC_CONNECTION;
    
    async function transferTokens() {
        const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(tokenMint);
        const amountToSend = +tokenAmount;
        console.log("amountToSend: "+amountToSend)
        const tokenAccount = new PublicKey(mintPubkey);
        
        /*
        let GRAPE_TT_MEMO = {
            status:1, // status
            type:memotype, // AMA - SETUP 
            ref:memoref, // SOURCE
            notes:memonotes
        };*/
        
        /*
        if (memoText){
            memonotes = memoText
        }*/
        
        const transaction = new Transaction();

        if (tokenMint === "So11111111111111111111111111111111111111112"){ // Check if SOL
            const decimals = 9;
            const adjustedAmountToSend = +(amountToSend * Math.pow(10, decimals)).toFixed(0);
            
            transaction.add(
                SystemProgram.transfer({
                    fromPubkey: fromWallet,
                    toPubkey: toWallet,
                    lamports: adjustedAmountToSend,
                })
            );/*.add(
                new TransactionInstruction({
                    keys: [{ pubkey: fromWallet, isSigner: true, isWritable: true }],
                    data: Buffer.from(JSON.stringify(memoText || ''), 'utf-8'),
                    programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
                })
            );*/
        } else{  
            
            // check if cardinal wrapped..
            const type = 0;
            console.log("mint: "+ tokenMint);
            //console.log("cardinal wrapped: "+JSON.stringify(icwt));

            
            const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
            const accountParsed = JSON.parse(JSON.stringify(accountInfo.value.data));
            const decimals = accountParsed.parsed.info.decimals;
            
            //tokenMintAddress
            /*
            console.log("TOKEN_PROGRAM_ID: "+TOKEN_PROGRAM_ID.toBase58())
            console.log("ASSOCIATED_TOKEN_PROGRAM_ID: "+ASSOCIATED_TOKEN_PROGRAM_ID.toBase58())
            console.log("mintPubkey: "+mintPubkey.toBase58())
            console.log("fromWallet: "+fromWallet.toBase58())
            console.log("toWallet: "+toWallet.toBase58())
            */
            try{
                const fromTokenAccount = await getAssociatedTokenAddress(
                    mintPubkey,
                    fromAddress,
                    true
                )

                const fromPublicKey = fromWallet;
                const destPublicKey = toWallet;
                const destTokenAccount = await getAssociatedTokenAddress(
                    mintPubkey,
                    destPublicKey,
                    true
                )
                const receiverAccount = await connection.getAccountInfo(
                    destTokenAccount
                )

                if (receiverAccount === null) {
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            fromPublicKey, // or use payerWallet
                            destTokenAccount,
                            destPublicKey,
                            mintPubkey,
                            TOKEN_PROGRAM_ID,
                            ASSOCIATED_TOKEN_PROGRAM_ID
                        )
                    )
                }

                const amount = (amountToSend * Math.pow(10, decimals));
                transaction.add(
                    createTransferInstruction(
                        fromTokenAccount,
                        destTokenAccount,
                        fromPublicKey,
                        amount
                    )
                )
                
                /*
                if (memoText && memoText.length > 0){
                    transaction.add(
                        new TransactionInstruction({
                            keys: [{ pubkey: fromWallet, isSigner: true, isWritable: true }],
                            data: Buffer.from(JSON.stringify(memoText || ''), 'utf-8'),
                            programId: new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
                        })
                    );
                }
                */
                return transaction;
            } catch(err:any){
                console.log("ERR: "+JSON.stringify(err));
            }
            
            
        }

        return null;

    }

    


}