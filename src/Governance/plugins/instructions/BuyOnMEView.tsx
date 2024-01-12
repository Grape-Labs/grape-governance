import React, { useCallback } from 'react';
import axios from 'axios';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, VersionedMessage, TransactionInstruction, TransactionMessage } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from '@solana/wallet-adapter-react';
import * as anchor from '@project-serum/anchor';

import { 
    RPC_CONNECTION, 
    ME_API,
    PROXY,
} from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import { styled } from '@mui/material/styles';

import {
  Dialog,
  Button,
  ButtonGroup,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  TextareaAutosize,
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
  Checkbox,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
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

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
    width: '100%', // Make it full width
    backgroundColor: '#333', // Change the background color to dark
    color: '#fff', // Change the text color to white or another suitable color
    border: 'none', // Remove the border (optional)
    padding: theme.spacing(1), // Add padding (optional)
}));

export default function BuyOnMEView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const [selectedTokenStats, setSelectedTokenStats] = React.useState(null);
    const [selectedMintInfo, setSelectedMintInfo] = React.useState(null);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    async function createV0Tx(txInstructions: TransactionInstruction[]) {
        // Step 1 - Fetch Latest Blockhash
        let latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
        console.log("   ✅ - Fetched latest blockhash. Last Valid Height:", latestBlockhash.lastValidBlockHeight);
    
        // Step 2 - Generate Transaction Message
        const messageV0 = new TransactionMessage({
            payerKey: new PublicKey(fromAddress),
            recentBlockhash: latestBlockhash.blockhash,
            instructions: txInstructions
        }).compileToV0Message();
        console.log("   ✅ - Compiled Transaction Message");
        const transaction = new VersionedTransaction(messageV0);
        return transaction;
        // Step 3 - Sign your transaction with the required `Signers`
        /*
        transaction.sign([new PublicKey(fromAddress)]);
        console.log("   ✅ - Transaction Signed");
    
        // Step 4 - Send our v0 transaction to the cluster
        const txid = await RPC_CONNECTION.sendTransaction(transaction, { maxRetries: 5 });
        console.log("   ✅ - Transaction sent to network");
    
        // Step 5 - Confirm Transaction 
        const confirmation = await RPC_CONNECTION.confirmTransaction({
            signature: txid,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        });
        if (confirmation.value.err) { throw new Error("   ❌ - Transaction not confirmed.") }
        console.log('🎉 Transaction Successfully Confirmed!', '\n', `https://explorer.solana.com/tx/${txid}?cluster=devnet`);
        */
    }
    

    async function generateMEBuyInstructions(mintAddress:string, tokenAddress:string, price:number, seller:string, auctionHouse:string) {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();
        
        /*
            Generate ME Buy Instructions
        */                
        try {

            const buyer_referral = ''//publicKey.toBase58();
            const seller_referral = 0;
            /*
            const tokenAta = await getAssociatedTokenAddress(
                mintPubkey,
                fromWallet,
                true
            );
            */
            
            
            console.log("buyer: "+fromWallet.toBase58());
            console.log("seller: "+seller);
            console.log("auctionHouse: "+auctionHouse);
            console.log("tokenAta: "+tokenAddress);
            console.log("tokenMint: "+mintAddress);
            //console.log("tokenPDA: "+meListing[0].pdaAddress);
            console.log("price: "+price);
            
            const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/instructions/buy_now";
            //const apiUrl = PROXY+"https://hyper.solana.fm/v3/instructions/buy_now";
            
            //const meAuctionHouseAddress = "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe";
            
            const res = await axios.get(
                apiUrl,
                {
                params: {
                    //network:"mainnet",
                    buyer: fromWallet.toBase58(),
                    seller: seller,
                    auctionHouseAddress: auctionHouse,
                    tokenMint: mintAddress,
                    tokenATA: tokenAddress,
                    price: price,
                    sellerExpiry:-1,
                    //expiry: 0,
                    //sellerReferal: 0,
                    //expiry: -1,
                },
                headers: { Authorization: "Bearer " + ME_API }
                }
            );
            //console.log("TX: "+JSON.stringify(res));
            
            // convert tx
            
            const txSigned = res.data.txSigned;
            const txSignedBuf = Buffer.from(txSigned, 'base64');
            const tx = Transaction.from(txSignedBuf);
            
            const latestBlockHash = (await connection.getLatestBlockhash()).blockhash;
            tx.recentBlockhash = latestBlockHash;
            tx.feePayer = fromWallet;
            
            //const txn = transaction.add(txSigned);
            
            // remove ME as a signer
            const meSigner = "NTYeYJ1wr4bpM5xo6zx5En44SvJFAd35zTxxNoERYqd";
            for (var instruction of tx.instructions){
                for (var key of instruction.keys){
                    if (key.pubkey.toBase58() === meSigner){
                        key.isSigner = false;
                    }
                }
            }
            console.log("*** SERIALIZED ***");
            console.log(tx.serializeMessage().toString("base64"));
            setTransactionInstructions(tx);
            return transaction;
            
            /*
            const txV0Signed = res.data.v0.txSigned;
            const v0Tx = await createV0Tx(txV0Signed);
            
            console.log("   ✅ - DONE Transaction Message");
            
            setTransactionInstructions(v0Tx);
            return transaction;
            */
        }catch(e){
            console.log("FEE ERR: ",e);
            return null;
        }
        
    }

    async function getMintInfo(address:string){
        //const fromWallet = new PublicKey(fromAddress);
        
        //const apiUrl = PROXY+"https://hyper.solana.fm/v3/collections/"+collection+"/stats";
        const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/tokens/"+address+"/listings";

        const options = {method: 'GET', headers: {accept: 'application/json'}};
        //axios.defaults.headers.common["Origin"] = "https://governance.so";
        //const resp = await axios.get(apiUrl, {
        const resp = await window.fetch(apiUrl, options)
            .then(response => response.json())
            .then(response => {
                //console.log("Tokens: "+JSON.stringify(response))
                return response;
            }
            )
            .catch(err => console.error(err));

        //const json = await resp.json();
        // set only listed NFTs
        if (resp){
            return resp[0];
        }
        return null;
    }

    async function getCollectionStats(collection:string){
        //const fromWallet = new PublicKey(fromAddress);
            
        //const apiUrl = PROXY+"https://hyper.solana.fm/v3/collections/"+collection+"/stats";
        const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/collections/"+collection+"/stats";

        const options = {method: 'GET', headers: {accept: 'application/json'}};
        //axios.defaults.headers.common["Origin"] = "https://governance.so";
        //const resp = await axios.get(apiUrl, {
        const resp = await window.fetch(apiUrl, options)
            .then(response => response.json())
            .then(response => {
                //console.log("Tokens: "+JSON.stringify(response))
                return response;
            }
            )
            .catch(err => console.error(err));

        //const json = await resp.json();
        // set only listed NFTs
        if (resp){
            return resp;
        }
        return null;
    }

    const fetchMintStatsInfo = async(address:string) => {
        // use /listings first
        console.log("mint address: "+address)
        const mintInfo = await getMintInfo(address);
        console.log("Mint Info: "+JSON.stringify(mintInfo));
        if (mintInfo){
            setSelectedMintInfo(mintInfo);
            const collectionStats = await getCollectionStats(mintInfo.token.collection);
            if (collectionStats){
                setSelectedTokenStats(collectionStats);
                console.log("Collection Stats: "+JSON.stringify(collectionStats));
            }else{
                setSelectedMintInfo(null);
                setSelectedTokenStats(null);
            }
        } else{
            
        }
    }

    function prepareAndReturnInstructions(){

        //await transferTokens;
        let description = "";

        description = `Buy ${tokenMint} on Magic Eden`;
        /*
        if (destinationWalletArray.length === 1){
            description = `Sending ${tokenAmount.toLocaleString()} ${tokenMint} to ${destinationWalletArray[0].address}`;
        } else{
            description = `Sending ${tokenAmount.toLocaleString()} ${tokenMint} to ${destinationWalletArray.length} recipients: `;
            description += destinationWalletArray
                .map((destination: any) => `${destination.address.trim()} - ${destination.amount.toLocaleString()} tokens`)
                .join(', ');
        }
        */
        setInstructionsObject({
            "type":`Magic Eden Buy Mint Plugin`,
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

    function isValidSolanaPublicKey(publicKeyString:string) {
        // Regular expression for Solana public key validation
        if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
            return false;
        }
        
        // Regular expression for Solana public key validation
        const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        
        // Check if the publicKey matches the Solana public key pattern
        let status = solanaPublicKeyRegex.test(publicKeyString);
        try{
            if (status){
                const pk = new PublicKey(publicKeyString);
                if (pk)
                    return true;
                else
                    return false;
            }
        }catch(e){
            return false;
        }
    }

    React.useEffect(() => {
        if (tokenMint){
            fetchMintStatsInfo(tokenMint);
        }
    }, [tokenMint]);


    function handleTokenMintAddress(address:string){
        if (isValidSolanaPublicKey(address))
            setTokenMint(address);
    }

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
                <Typography variant="h5">
                    <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                        <Grid item>
                            <Avatar variant="rounded" alt={'Magic Eden'} src={'https://downloads.intercomcdn.com/i/o/326487/8399b8e845fc45a0b0ac50c8/8c1046fe692522734b0ee9e39bd2d77b.png'} />
                        </Grid>
                        <Grid item xs sx={{ml:1}}>
                            <strong>Magic Eden</strong> Buy Mint Plugin
                        </Grid>
                    </Grid>
                </Typography>
            </Box>

            
            <FormControl fullWidth  sx={{mb:2}}>
                
                <TextField 
                    fullWidth 
                    label="Token Mint Address" 
                    id="fullWidth"
                    //value={tokenMint}
                    type="text"
                    onChange={(e) => {
                        handleTokenMintAddress(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'right' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
            
            </FormControl>
            
            
                {(tokenMint) ?
                    <> 
                        {selectedMintInfo &&   
                            
                            <Box
                                sx={{ m:2,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:4
                                }}
                            >
                                <List>
                                    
                                    <ListItem alignItems="flex-start">
                                        <ListItemAvatar>
                                            <Avatar alt={selectedMintInfo.token.name} src={selectedMintInfo.token.image} sx={{ width: 56, height: 56 }} />
                                        </ListItemAvatar>
                                        <ListItemText
                                        primary={
                                            <><Typography variant='h5'>{selectedMintInfo.token.name}</Typography></>
                                        }
                                        secondary={
                                            <>
                                                <Typography
                                                    sx={{ display: 'inline' }}
                                                    component="span"
                                                    variant="body2"
                                                    color="text.primary"
                                                >
                                                    {selectedMintInfo.token.listStatus === "listed" ?
                                                        <>
                                                            <strong>{selectedMintInfo.token.price} SOL</strong>
                                                        </>
                                                    :
                                                        <>Not Listed</>
                                                    }
                                                </Typography>
                                                <br/>
                                                Collection {selectedMintInfo.token.collectionName}<br/>
                                                Owner: <ExplorerView grapeArtProfile={true} showSolanaProfile={true} address={selectedMintInfo.seller} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                                
                                                {selectedMintInfo.token.listStatus === "listed" &&
                                                    <>
                                                        <ButtonGroup variant="contained" sx={{mt:2}}>
                                                            {fromAddress===selectedMintInfo.seller ?
                                                                <Button disabled>This address is the lister!</Button>
                                                            :
                                                                <Button
                                                                    color="primary"
                                                                    disabled={(fromAddress === selectedMintInfo.seller)}
                                                                    onClick={() => generateMEBuyInstructions(selectedMintInfo.token.mintAddress, selectedMintInfo.token.tokenAddress, selectedMintInfo.token.price, selectedMintInfo.seller, selectedMintInfo.auctionHouse)}
                                                                >Buy</Button>
                                                            }
                                                            <Button
                                                                color="info"
                                                                href={`https://magiceden.io/item-details/${selectedMintInfo.token.mintAddress}`}
                                                                target="_blank"
                                                                sx={{ml:1}}
                                                            >
                                                                View listing on Magic Eden
                                                            </Button>
                                                        </ButtonGroup>
                                                    </>
                                                }
                                            </>
                                        }
                                        />
                                    </ListItem>
                                
                                </List>
                            </Box>
                        }

                        {selectedTokenStats &&
                            <Box
                                sx={{
                                    m:1,
                                    background: 'rgba(0, 0, 0, 0.1)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:2,
                                }}
                            >
                                
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="h5">Collection Stats</Typography>
                                    <Typography variant="caption">
                                        Currently Listed: {selectedTokenStats.listedCount}<br/>
                                        Floor: {(selectedTokenStats.floorPrice / 10 ** 9).toLocaleString()} SOL<br/>
                                        Volume: {(selectedTokenStats.volumeAll / 10 ** 9).toLocaleString()} SOL<br/>
                                    </Typography>
                                </Grid>
                            </Box>
                        } 
                    </>
                :
                    <Box
                        sx={{textAlign:'center'}}
                    >
                        <Typography variant="caption">Start by entering a valid mint address</Typography>
                    </Box>
                }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled
                        //onClick={generateMEBuyInstructions}
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
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(transactionInstructions)}
                            readOnly
                        /><br/>
                        {/*
                        <TextField 
                            fullWidth
                            label="Instructions"
                            multiline
                            rows={4}
                            maxRows={4}
                            value={JSON.stringify(transactionInstructions)}
                            disabled
                        />*/}
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Magic Eden Buy Mint Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}
