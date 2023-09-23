import React, { useCallback } from 'react';
import { WalletError, WalletNotConnectedError, WalletSignMessageError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

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

//import { withSend } from "@cardinal/token-manager";

import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';
import { number } from 'prop-types';

export default function TokenTransferView(props: any) {
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceWallet = props?.governanceWallet;
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);

    const maxDestinationWalletLen = 10;
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [destinationString, setDestinationString] = React.useState(null);

    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    async function transferTokens() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        //const toWallet = new PublicKey(toAddress);
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
            for (let index = 0; index < destinationWalletArray.length; index++) {
                const destinationObject = destinationWalletArray[index];
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: fromWallet,
                        toPubkey: new PublicKey(destinationObject.address),
                        lamports: +(destinationObject.amount * Math.pow(10, decimals)).toFixed(0),
                    })
                );
            }
        } else{  
            console.log("mint: "+ tokenMint);
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
                for (let index = 0; index < destinationWalletArray.length; index++) {
                    const destinationObject = destinationWalletArray[index];
                    // getOrCreateAssociatedTokenAccount
                    const fromTokenAccount = await getAssociatedTokenAddress(
                        mintPubkey,
                        new PublicKey(fromWallet),
                        true
                    )

                    const fromPublicKey = new PublicKey(fromWallet);
                    const destPublicKey = new PublicKey(destinationObject.address);
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

                    const amount = (destinationObject.amount * Math.pow(10, decimals));
                    transaction.add(
                        createTransferInstruction(
                            fromTokenAccount,
                            destTokenAccount,
                            fromPublicKey,
                            amount
                        )
                    )
                }
                
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
                setTransactionInstructions(transaction);
                return transaction;
            } catch(err:any){
                console.log("ERR: "+JSON.stringify(err));
            }
            
            
        }

        return null;

    }

    function TokenSelect() {
      
        const handleMintSelected = (event: SelectChangeEvent) => {
            const selectedTokenMint = event.target.value as string;
            setTokenMint(selectedTokenMint);

            // with token mint traverse to get the mint info if > 0 amount
            {governanceWallet && governanceWallet.tokens.value
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((item: any, key: number) => {
                    if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                        item.account.data.parsed.info.tokenAmount.amount > 0) {
                            if (item.account.data.parsed.info.mint === selectedTokenMint){
                                setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                            }
                    }
            })}
        };

        function ShowTokenMintInfo(props: any){
            const mintAddress = props.mintAddress;
            const [mintName, setMintName] = React.useState(null);
            const [mintLogo, setMintLogo] = React.useState(null);

            const getTokenMintInfo = async() => {
                
                    const mint_address = new PublicKey(mintAddress)
                    const [pda, bump] = await PublicKey.findProgramAddress([
                        Buffer.from("metadata"),
                        PROGRAM_ID.toBuffer(),
                        new PublicKey(mint_address).toBuffer(),
                    ], PROGRAM_ID)
                    const tokenMetadata = await Metadata.fromAccountAddress(connection, pda)
                    
                    if (tokenMetadata?.data?.name)
                        setMintName(tokenMetadata.data.name);
                    
                    if (tokenMetadata?.data?.uri){
                        try{
                            const metadata = await window.fetch(tokenMetadata.data.uri)
                            .then(
                                (res: any) => res.json())
                            .catch((error) => {
                                // Handle any errors that occur during the fetch or parsing JSON
                                console.error("Error fetching data:", error);
                            });
                            
                            if (metadata && metadata?.image){
                                if (metadata.image)
                                    setMintLogo(metadata.image);
                            }
                        }catch(err){
                            console.log("ERR: ",err);
                        }
                    }
            }

            React.useEffect(() => { 
                if (mintAddress && !mintName){
                    getTokenMintInfo();
                }
            }, [mintAddress]);

            return ( 
                <>

                    {mintName ?
                        <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                            <Grid item>
                                <Avatar alt={mintName} src={mintLogo} />
                            </Grid>
                            <Grid item sx={{ml:1}}>
                                <Typography variant="h6">
                                {mintName}
                                </Typography>
                            </Grid>
                        </Grid>       
                    :
                    <>{mintAddress}</>
                }

                </>
            )

        }
      
        return (
          <>
            <Box sx={{ minWidth: 120, ml:1 }}>
              <FormControl fullWidth sx={{mb:2}}>
                <InputLabel id="governance-token-select-label">Token</InputLabel>
                <Select
                  labelId="governance-token-select-label"
                  id="governance-token-select"
                  value={tokenMint}
                  label="Token"
                  onChange={handleMintSelected}
                >
                  
                  {/*
                  
                    Add any SOL available from this wallet

                  */}
                  
                  {governanceWallet && governanceWallet.tokens.value
                    //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                    .map((item: any, key: number) => {
                      if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                            item.account.data.parsed.info.tokenAmount.amount > 0) {
                        
                        return (
                          <MenuItem key={key} value={item.account.data.parsed.info.mint}>
                              {/*console.log("wallet: "+JSON.stringify(item))*/}
                              
                              <Grid container>
                                <Grid item xs={12}>
                                  <Grid container>
                                    <Grid item sm={8}>
                                      <Grid
                                        container
                                        direction="row"
                                        justifyContent="left"
                                        alignItems="left"
                                      >

                                        {item.account?.tokenMap?.tokenName ?
                                            <Grid 
                                                container
                                                direction="row"
                                                alignItems="center"
                                            >
                                                <Grid item>
                                                    <Avatar alt={item.account.tokenMap.tokenName} src={item.account.tokenMap.tokenLogo} />
                                                </Grid>
                                                <Grid item sx={{ml:1}}>
                                                    <Typography variant="h6">
                                                    {item.account.tokenMap.tokenName}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        :
                                            <>
                                                <ShowTokenMintInfo mintAddress={item.account.data.parsed.info.mint} />
                                            </>
                                        }
                                      </Grid>
                                    </Grid>
                                    <Grid item xs sx={{textAlign:'right'}}>
                                      <Typography variant="h6">
                                        {/*item.vault?.nativeTreasury?.solBalance/(10 ** 9)*/}

                                        {(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals).toLocaleString()}
                                      </Typography>
                                    </Grid>
                                  </Grid>  

                                  <Grid item xs={12} sx={{textAlign:'center',mt:-1}}>
                                    <Typography variant="caption" sx={{borderTop:'1px solid rgba(255,255,255,0.05)',pt:1}}>
                                        {item.account.data.parsed.info.mint}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Grid>
                          </MenuItem>
                        );
                      } else {
                        return null; // Don't render anything for items without nativeTreasuryAddress
                      }
                    })}
                </Select>
              </FormControl>
            </Box>
          </>
        );
      }

    function isValidSolanaPublicKey(publicKeyString:string) {
        // Regular expression for Solana public key validation
        //const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        //return solanaPublicKeyRegex.test(publicKey);
        if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
            return false;
          }
        
          // Regular expression for Solana public key validation
          const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        
          // Check if the publicKey matches the Solana public key pattern
          return solanaPublicKeyRegex.test(publicKeyString);
    }

    function handleTokenAmountChange(text:string){
        // Use a regular expression to allow numeric input with optional decimals
        const numericInput = text.replace(/[^0-9.]/g, '');

        // Ensure there's only one decimal point
        const parts = numericInput.split('.');
        if (parts.length > 2) return; // More than one decimal point

        if (parts[1] && parts[1].length > 9) return; // More than 9 decimal places

        // Update the input field value
        //event.target.value = numericInput;
        text = numericInput;
        setTokenAmount(+numericInput);
    }

    function calculateDestinations(destinations:string, destinationAmount:number){
        const destinationsStr = destinations;

        if (destinationsStr && destinationsStr.length > 0) {
            const destinationArray = destinationsStr
            .split(/,|\n/) // Split by comma or newline
            .map(destination => destination.trim())
            .filter(destination => destination);

            // Use a Set to filter out duplicates
            const uniqueDestinationsSet = new Set(destinationArray);

            // Convert the Set back to an array to preserve order and uniqueness
            const uniqueValidDestinations = Array.from(uniqueDestinationsSet)
            .filter(destination => isValidSolanaPublicKey(destination)) // Filter valid addresses
            .map(destination => ({
                address: destination,
                amount: (tokenAmount || destinationAmount) / uniqueDestinationsSet.size,
            }));

            setDestinationWalletArray(uniqueValidDestinations);
        }
    }

    function handleDestinationWalletChange(destinations:string){
        setDestinationString(destinations);
    }

    function prepareAndReturnInstructions(){

        let description = "";

        if (destinationWalletArray.length === 1){
            description = `Sending ${tokenAmount.toLocaleString()} ${tokenMint} to ${destinationWalletArray[0].address}`;
        } else{
            description = `Sending ${tokenAmount.toLocaleString()} ${tokenMint} to: `;
            description += destinationWalletArray
                .map((destination: any) => `${destination.address.trim()} - ${destination.amount.toLocaleString()} tokens`)
                .join(', ');
        }
            

        setInstructionsObject({
            "type":"Token Transfer",
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":null
        });
    }

    React.useEffect(() => { 
        if (destinationString && tokenAmount){
            calculateDestinations(destinationString, tokenAmount);
        }
    }, [destinationString, tokenAmount]);


    return (
        <Box
            sx={{
                m:2,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:4
            }} 
        >
            <Box
                sx={{mb:4}}
            >
                <Typography variant="h5">Token Transfer Plugin</Typography>
            </Box>

            {/*
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth 
                    label="From Governance Wallet" 
                    id="fullWidth"
                    value={fromAddress}
                    type="text"
                    onChange={(e) => {
                    //    setFromAddress(e.target.value);
                    }}
                    disabled
                    sx={{borderRadius:'17px'}} 
                />
            </FormControl>
            */}
            
            <TokenSelect />
            
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth 
                    label="Amount" 
                    id="fullWidth"
                    value={tokenAmount}
                    type="text"
                    onChange={(e) => {
                        handleTokenAmountChange(e.target.value);
                        
                    }}
                    inputProps={{
                        inputMode: 'numeric', // Set inputMode for mobile support
                        pattern: '[0-9]*', // Use pattern attribute to restrict input to digits
                        style: { textAlign: 'right' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {tokenMaxAmount && tokenAmount > tokenMaxAmount ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: This proposal may fail if the token balance is insufficient!</Typography>
                    </Grid>
                : <></>
                }
            </FormControl>
            
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth
                    label="Enter destination Wallet *for multiple wallets add 1 wallet per line or seperate with a comma"
                    multiline
                    rows={4}
                    maxRows={4}
                    //value={destinationWallets}
                    onChange={(e) => {
                        if (!destinationWalletArray || destinationWalletArray.length < maxDestinationWalletLen)
                            handleDestinationWalletChange(e.target.value)
                        }}
                    
                    sx={{maxlength:maxDestinationWalletLen}}
                    />
                <Grid sx={{textAlign:'right',}}>
                    <Typography variant="caption">{destinationWalletArray ? destinationWalletArray.length > 0 ? maxDestinationWalletLen - destinationWalletArray.length : maxDestinationWalletLen : maxDestinationWalletLen} wallets remaining</Typography>
                </Grid>
            </FormControl>    
                
            
            
                {(tokenAmount && destinationWalletArray && destinationWalletArray.length > 0 && tokenMint) ?
                    <>  
                        {destinationWalletArray.length === 1 ?
                            <Box
                                sx={{ m:2,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:4
                                }}
                            >
                                <Typography variant="h6">Preview/Summary</Typography>
                                <Typography variant="caption">
                                Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to <strong>{destinationWalletArray[0].address}</strong>
                                </Typography>
                            </Box>
                        :
                            <Box
                                sx={{ m:2,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:4
                                }}
                            >
                                <Typography variant="h6">Preview/Summary</Typography>
                                <Typography variant="caption">
                                    Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to:<br/>
                                    {destinationWalletArray.map((destination:any, index:number) => (
                                        <li key={index}>
                                            {destination.address.trim()} - {destination.amount.toLocaleString()} tokens
                                        </li>
                                    ))}
                                </Typography>
                            </Box>
                        }
                    </>
                :
                    <Box
                        sx={{textAlign:'center'}}
                    >
                        <Typography variant="caption">Start by adding selecting a token, amount and wallet destination address</Typography>
                    </Box>
                }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (destinationWalletArray && destinationWalletArray.length > 0) &&
                            (tokenAmount && tokenAmount > 0)
                        )
                        }
                        onClick={transferTokens}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}>
                        Generate Instructions</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }}
                    >
                        <Typography variant="h6">Transaction Instructions</Typography>
                    
                        <TextField 
                            fullWidth
                            label="Instructions"
                            multiline
                            rows={4}
                            maxRows={4}
                            value={JSON.stringify(transactionInstructions)}
                            disabled
                        />
                    </Box>

                }

            <Grid sx={{textAlign:'right'}}>
            <Button 
                disabled={!(
                    (transactionInstructions && JSON.stringify(transactionInstructions).length > 0)
                )
                }
                onClick={prepareAndReturnInstructions}
                fullWidth
                variant="contained"
                color="warning"
                sx={{borderRadius:'17px'}}>
                Add to Proposal</Button>
            </Grid>

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Token Transfer Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}