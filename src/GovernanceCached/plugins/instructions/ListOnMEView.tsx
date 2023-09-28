import React, { useCallback } from 'react';
import axios from 'axios';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from '@solana/wallet-adapter-react';

import { RPC_CONNECTION, ME_KEYBASE } from '../../../utils/grapeTools/constants';
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
  FormControlLabel,
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
  Alert,
  Checkbox
} from '@mui/material';

import Confetti from 'react-dom-confetti';
import SolIcon from '../../../components/static/SolIcon';
import SolCurrencyIcon from '../../../components/static/SolCurrencyIcon';

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

const confettiConfig = {
    angle: 90,
    spread: 360,
    startVelocity: 40,
    elementCount: 200,
    dragFriction: 0.12,
    duration: 4000,
    stagger: 3,
    width: "10px",
    height: "10px",
    perspective: "285px",
    colors: ["#f00", "#0f0", "#00f"]
  };

export default function ListOnMEView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [hasBeenCalled, setHasBeenCalled] = React.useState(false);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenFloorPrice, setTokenFloorPrice] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    let maxDestinationWalletLen = 20;
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [destinationString, setDestinationString] = React.useState(null);
    const [distributionType, setDistributionType] = React.useState(false);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    async function generateMEInstructions() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        //const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(tokenMint);
        const amountToSend = +tokenAmount;
        console.log("amountToSend: "+amountToSend)
        const tokenAccount = new PublicKey(mintPubkey);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();
        
        /*
            Generate ME Listing Instructions
        */                
        try {
            const res = await axios.get(
                "https://api-mainnet.magiceden.dev/v2/instructions/sell",
                {
                params: {
                    //buyer: "keypair.publicKey.toBase58()",
                    seller: fromWallet,
                    auctionHouseAddress: "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe",
                    tokenMint: new PublicKey(tokenMint),
                    tokenAccount: "insert associated token account here",
                    price: tokenAmount,
                    //sellerReferal: 0,
                    //expiry: -1,
                },
                headers: { Authorization: "Bearer " + ME_KEYBASE },
                }
            );
            const txSigned = res.data.txSigned;
            const txn = transaction.add(txSigned);

            //setPayerInstructions(pTransaction);
            setTransactionInstructions(transaction);
            return transaction;
        }catch(e){
            console.log("FEE ERR: ",e);
            return null;
        }
        
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
                        item.account.data.parsed.info.tokenAmount.amount > 0 &&
                        item.account.data.parsed.info.tokenAmount.decimals === 0) {
                            if (item.account.data.parsed.info.mint === selectedTokenMint){
                                setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount);
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
                <InputLabel id="governance-token-select-label">{pluginType === 4 ? 'Token' : 'Select'}</InputLabel>
                <Select
                  labelId="governance-token-select-label"
                  id="governance-token-select"
                  value={tokenMint}
                  label="Token"
                  onChange={handleMintSelected}
                >
                    {(governanceWallet) && governanceWallet.tokens.value
                            .filter((item: any) => 
                                item.account.data?.parsed?.info?.tokenAmount?.amount > 0
                            )
                            .sort((a: any, b: any) => 
                                b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                            )
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount > 0 &&
                                    item.account.data.parsed.info.tokenAmount.decimals === 0) {
                                
                                    //console.log("mint: "+item.account.data.parsed.info.mint)

                                    return (
                                        <MenuItem key={key} value={item.account.data.parsed.info.mint}>
                                            {/*console.log("wallet: "+JSON.stringify(item))*/}
                                            
                                            <Grid container
                                                alignItems="center"
                                            >
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

        // Add a fractional part (even if zero) to ensure it's treated as a float
        const withFractionalPart = numericInput.includes('.') ? numericInput : numericInput + '.0';

        // Update the input field value
        // event.target.value = withFractionalPart;

        // Set tokenAmount as a float
        setTokenAmount(parseFloat(withFractionalPart));
    }

    
    function prepareAndReturnInstructions(){

        //await transferTokens;


        let description = "";

        if (destinationWalletArray.length === 1){
            description = `Sending ${tokenAmount.toLocaleString()} ${tokenMint} to ${destinationWalletArray[0].address}`;
        } else{
            description = `Sending ${tokenAmount.toLocaleString()} ${tokenMint} to ${destinationWalletArray.length} recipients: `;
            description += destinationWalletArray
                .map((destination: any) => `${destination.address.trim()} - ${destination.amount.toLocaleString()} tokens`)
                .join(', ');
        }
        
        setInstructionsObject({
            "type":`${pluginType === 4 ? `Token` : 'SOL'} Transfer`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            setLoadingWallet(true);
            const solBalance = await connection.getBalance(new PublicKey(wallet));

            const tokenBalance = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(wallet),
                {
                programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                }
            )
            // loop through governanceWallet
            governanceWallet.solBalance = solBalance;
            const itemsToAdd = [];

            console.log("governanceWallet "+JSON.stringify(governanceWallet));
            if (tokenBalance?.value){
                for (let titem of tokenBalance?.value){
                    if (governanceWallet.tokens.value){
                        let foundCached = false;
                        for (let gitem of governanceWallet.tokens.value){
                            if (titem.pubkey.toBase58() === gitem.pubkey){
                                foundCached = true;
                                gitem.account.data.parsed.info.tokenAmount.amount = titem.account.data.parsed.info.tokenAmount.amount;
                                gitem.account.data.parsed.info.tokenAmount.uiAmount = titem.account.data.parsed.info.tokenAmount.uiAmount;
                                itemsToAdd.push(gitem);
                            }
                        }
                        if (!foundCached) {
                            itemsToAdd.push(titem);
                        }
                    }
                }
            }

            governanceWallet.tokens.value = itemsToAdd;//[...governanceWallet.tokens.value, ...itemsToAdd];
            setConsolidatedGovernanceWallet(governanceWallet);
            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }

    React.useEffect(() => { 
       
    }, [destinationString, tokenAmount, distributionType]);

    React.useEffect(() => {
        if (publicKey.toBase58() === 'FDw92PNX4FtibvkDm7nd5XJUAg6ChTcVqMaFmG7kQ9JP'){
            maxDestinationWalletLen = 2000;
        }
    },[publicKey]);

    React.useState(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

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
                <Typography variant="h5">List on Magic Eden Plugin</Typography>
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
            
            {consolidatedGovernanceWallet &&
                <TokenSelect />
            }
            
            <FormControl fullWidth  sx={{mb:2}}>
                
                <TextField 
                    fullWidth 
                    label="List Price" 
                    id="fullWidth"
                    //value={tokenAmount}
                    type="text"
                    onChange={(e) => {
                        handleTokenAmountChange(e.target.value);
                        
                    }}
                    inputProps={{
                        inputMode: 'numeric', // Set inputMode for mobile support
                        pattern: '[0-9.]*', // Use pattern attribute to restrict input to digits
                        style: { textAlign: 'right' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {(tokenAmount && tokenAmount < tokenFloorPrice) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: You are listing bellow floor price!</Typography>
                    </Grid>
                : <></>
                }
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
                                    Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to {destinationWalletArray.length} recipient(s):<br/>
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
                        <Typography variant="caption">Start by selecting a token & list price</Typography>
                    </Box>
                }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (destinationWalletArray && destinationWalletArray.length > 0) &&
                            (tokenAmount && tokenAmount > 0)
                        )
                        }
                        onClick={generateMEInstructions}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}>
                        Preview Instructions</Button>
                    {/*
                    <Button 
                        disabled={!(
                            (destinationWalletArray && destinationWalletArray.length > 0) &&
                            (tokenAmount && tokenAmount > 0)
                        )}
                        onClick={prepareAndReturnInstructions}
                        variant="contained"
                        color="warning"
                        sx={{borderRadius:'17px'}}>
                        Add to Proposal</Button>
                    */}
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
                        {transactionEstimatedFee &&
                            <Grid sx={{textAlign:'right'}}>
                                <Typography variant="caption">
                                    Estimated Fee {transactionEstimatedFee}
                                </Typography>
                            </Grid>
                        }
                    </Box>

                }

            <Grid sx={{textAlign:'right'}}>
            <Button 
                disabled={!(
                    (transactionInstructions && JSON.stringify(transactionInstructions).length > 0)
                )}
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance {pluginType === 4 ? 'Token' : 'SOL'} List on Magic Eden Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}
