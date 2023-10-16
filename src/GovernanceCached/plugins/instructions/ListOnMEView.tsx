import React, { useCallback } from 'react';
import axios from 'axios';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
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
import { getMint } from '@solana/spl-token';

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
    const [mintMECollection, setMintMECollection] = React.useState(null);
    const [selectedTokenStats, setSelectedTokenStats] = React.useState(null);
    const [allMintAssociations, setAllMintAssociations] = React.useState(null);
    const [allWalletHoldingsOnME, setAllWalletHoldingsOnME] = React.useState(null);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));
    async function generateMEEditListingInstructions(selectedTokenMint:string, selectedTokenAtaString: string, price: number, newPrice: number) {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        //const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(selectedTokenMint);
        const listPrice = +tokenAmount;
        console.log("List Price: "+listPrice)
        const tokenAccount = new PublicKey(mintPubkey);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();
                     
        try {

            const buyer_referral = ''//publicKey.toBase58();
            const seller_referral = 0;
            
            let tokenAta = null;
            
            if (selectedTokenAtaString){
                tokenAta = new PublicKey(selectedTokenAtaString);
            } else{
                tokenAta = await getAssociatedTokenAddress(
                    mintPubkey,
                    fromWallet,
                    true
                );
            }
            
            const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/instructions/sell_change_price";
            //const apiUrl = PROXY+"https://hyper.solana.fm/v3/instructions/sell_change_price";
            const meAuctionHouseAddress = "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe";
            
            const res = await axios.get(
                apiUrl,
                {
                params: {
                    //network:"mainnet",
                    seller: fromWallet.toBase58(),
                    auctionHouseAddress: meAuctionHouseAddress,
                    tokenMint: selectedTokenMint,
                    tokenAccount: tokenAta.toBase58(),
                    price: price,
                    newPrice: newPrice,
                    expiry: -1,
                    //sellerReferal: 0,
                    //expiry: -1,
                },
                headers: { Authorization: "Bearer " + ME_API }
                }
            );
            const txSigned = res.data.txSigned;
            //const txSigned = res.data.v0.txSigned;
            // convert tx
            const txSignedBuf = Buffer.from(txSigned, 'base64');
            const tx = Transaction.from(txSignedBuf);
            
            const latestBlockHash = (await connection.getLatestBlockhash()).blockhash;
            tx.recentBlockhash = latestBlockHash;
            tx.feePayer = fromWallet;
            
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

    async function generateMECancelLlistingInstructions(selectedTokenMint:string, selectedTokenAtaString: string, sentPrice?: number) {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        const tokenAccount = new PublicKey(selectedTokenMint);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();
           
        const mintInfo = await getMintInfo(selectedTokenMint);
        console.log("mintInfo: "+JSON.stringify(mintInfo));

        const sellerReferral = mintInfo?.sellerReferral;
        const expiry = mintInfo?.expiry;
        const meAuctionHouseAddress = mintInfo?.auctionHouse ? mintInfo.auctionHouse : "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe";
        const price = mintInfo?.price ? mintInfo.price : sentPrice;
        // fetch token info here before we push again
        
        try {

            let tokenAta = null;
            
            if (selectedTokenAtaString){
                tokenAta = new PublicKey(selectedTokenAtaString);
            } else{
                tokenAta = await getAssociatedTokenAddress(
                    new PublicKey(selectedTokenMint),
                    fromWallet,
                    true
                );
            }

            const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/instructions/sell_cancel";
            //const apiUrl = PROXY+"https://hyper.solana.fm/v3/instructions/sell_cancel";
            
            console.log("seller: "+fromWallet.toBase58());
            console.log("meAuctionHouseAddress: "+meAuctionHouseAddress);
            console.log("tokenAta: "+tokenAta.toBase58());
            console.log("selectedTokenMint: "+selectedTokenMint);
            console.log("price: "+price);
            console.log("sellerReferral: "+sellerReferral);

            const res = await axios.get(
                apiUrl,
                {
                params: {
                    //network:"mainnet",
                    seller: fromWallet.toBase58(),
                    auctionHouseAddress: meAuctionHouseAddress,
                    tokenMint: selectedTokenMint,
                    tokenAccount: tokenAta.toBase58(),
                    price: price,
                    //sellerReferal: sellerReferral,
                    expiry: expiry,
                },
                headers: { Authorization: "Bearer " + ME_API }
                }
            );

            //console.log("tx: "+JSON.stringify(res.data));
            const txSigned = res.data.txSigned;
            //const txSigned = res.data.tx;
            // convert tx
            
            //const txn = anchor.web3.Transaction.from(Buffer.from(txSigned.data));
            const txSignedBuf = Buffer.from(txSigned, 'base64');
            const tx = Transaction.from(txSignedBuf);
            //const latestBlockHash = (await connection.getLatestBlockhash()).blockhash;
            //tx.recentBlockhash = latestBlockHash;
            tx.feePayer = fromWallet;
            
            //console.log("tx 2: "+JSON.stringify(res.data));

            const meSigner = "NTYeYJ1wr4bpM5xo6zx5En44SvJFAd35zTxxNoERYqd";
            for (var instruction of tx.instructions){// remove ME signer
                for (var key of instruction.keys){
                    if (key.pubkey.toBase58() === meSigner){
                        key.isSigner = false;
                    }
                } 
            }
            
            // Remove from instructions
            /*
            for (var instruction of tx.instructions) {
                instruction.keys = instruction.keys.filter((key) => {
                  return key.pubkey.toBase58() !== sellerReferral;
                });
            }*/
            

            //const meSigner = "NTYeYJ1wr4bpM5xo6zx5En44SvJFAd35zTxxNoERYqd";
            /*
            for (var instruction of tx.instructions){// remove ME signer
                for (var key of instruction.keys){
                    if (key.pubkey.toBase58() === sellerReferral){
                        key.pubkey = fromWallet;
                    }
                } 
            }*/
            
            //tx.signatures = null;
            //tx.addSignature(fromWallet, null);
            //console.log("sigs: "+ JSON.stringify(tx.signatures))
            
            //console.log("*** SERIALIZED ***");
            //console.log(tx.serializeMessage().toString("base64"));

            setTransactionInstructions(tx);
            return transaction;
        }catch(e){
            console.log("FEE ERR: ",e);
            return null;
        }
        
    }

    async function generateMEListInstructions() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        //const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(tokenMint);
        const listPrice = +tokenAmount;
        console.log("List Price: "+listPrice)
        const tokenAccount = new PublicKey(mintPubkey);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();
        
        /*
            Generate ME Listing Instructions
        */                
        try {

            const buyer_referral = ''//publicKey.toBase58();
            const seller_referral = 0;
            
            const tokenAta = await getAssociatedTokenAddress(
                mintPubkey,
                fromWallet,
                true
            );
            
            /*
            console.log("buyer: "+publicKey.toBase58());
            console.log("seller: "+meListing[0].seller);
            console.log("auctionHouse: "+meListing[0].auctionHouse);
            console.log("tokenAta: "+tokenAta.toBase58());
            console.log("tokenMint: "+meListing[0].tokenMint);
            console.log("tokenPDA: "+meListing[0].pdaAddress);
            console.log("price: "+meListing[0].price);
            console.log("seller_referral: "+seller_referral);
            */
            
            //const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/instructions/buy_now";
            //const apiUrl = PROXY+"https://hyper.solana.fm/v3/instructions/sell";
            //const apiUrl = PROXY+"https://api.magiceden.dev/v2/instructions/sell"
            const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/instructions/sell";
            //const apiUrl = PROXY+"https://hyper.solana.fm/v3/instructions/sell";
            
            const meAuctionHouseAddress = "E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe";
            
            //axios.defaults.headers.common["Origin"] = "https://governance.so";
            const res = await axios.get(
                apiUrl,
                {
                params: {
                    //network:"mainnet",
                    seller: fromWallet.toBase58(),
                    auctionHouseAddress: meAuctionHouseAddress,
                    tokenMint: tokenMint,
                    tokenAccount: tokenAta.toBase58(),
                    price: listPrice,
                    expiry: -1,
                    //sellerReferal: 0,
                    //expiry: -1,
                },
                headers: { Authorization: "Bearer " + ME_API }
                }
            );
            //console.log("TX: "+JSON.stringify(res));
            
            const txSigned = res.data.txSigned;
            // convert tx
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
        }catch(e){
            console.log("FEE ERR: ",e);
            return null;
        }
        
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

    function ViewAllListings (){
        const fromWallet = new PublicKey(fromAddress);
        //const [listings, setListings] = React.useState(null);

        const fetchListingsForToken = async() => {
            
            //const apiUrl = PROXY+"https://hyper.solana.fm/v3/wallets/"+fromAddress+"/activities";
            const apiUrl = PROXY+"https://api-mainnet.magiceden.dev/v2/wallets/"+fromAddress+"/tokens";

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
            setAllWalletHoldingsOnME(resp);
            return resp;
        }

        function EditListingPriceView(props: any){
            const selectedTokenName = props?.selectedTokenName;
            const selectedTokenMint = props?.selectedTokenMint;
            const selectedTokenAtaString = props?.selectedTokenAtaString;
            const price = props?.price;
            const [meStats, setMEStats] = React.useState(null);
            // generateMEEditListingInstructions(selectedTokenMint:string, selectedTokenAtaString: string, price: number, newPrice: number)

            const [open, setOpen] = React.useState(false);
            const [newListPrice, setNewListPrice] = React.useState(null);

            const handleClickOpen = () => {
                setOpen(true);
            };

            const handleClose = () => {
                setOpen(false);
            };

            function handleChangeListPrice(){
                if (selectedTokenMint && selectedTokenAtaString && price && newListPrice)
                    generateMEEditListingInstructions(selectedTokenMint, selectedTokenAtaString, price, newListPrice)
            }

            const fetchEditCollectionStats = async(selectedTokenMint:string) => {
                let meCollection = null;
                if (allWalletHoldingsOnME){
                    for (let item of allWalletHoldingsOnME){
                        if (item.mintAddress === selectedTokenMint){
                            //console.log("checking: "+JSON.stringify(item));
                            meCollection = item.collection;
                        }
                    }
                }
                if (meCollection){
                    const collectionStats = await getCollectionStats(meCollection);
                    console.log("Collection Stats: "+JSON.stringify(collectionStats));
                    setMEStats(collectionStats);
                }
            }

            const handleFetchTokenStats = async() => {
                fetchEditCollectionStats(selectedTokenMint);
                //const stats = fetchCollectionStats(selectedTokenMint);
                //setMEStats(stats);
            }

            React.useEffect(() => {
                if (selectedTokenMint && !meStats){
                    // fetch all listings in an async call
                    handleFetchTokenStats();
                }
            },[selectedTokenMint]);

            return (
                <>
                <Button
                    onClick={handleClickOpen}
                >Edit Price</Button>

                <Dialog open={open} onClose={handleClose}>
                    <DialogTitle>Edit Mint List Price</DialogTitle>
                    <DialogContent>
                    <DialogContentText>
                        <Grid container>

                            <Box
                                sx={{
                                    m:2,
                                    background: 'rgba(0, 0, 0, 0.1)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:1,
                                    width:"100%"
                                }}
                            >
                                <Grid container>

                                    <Grid container alignItems="center">
                                        <Grid item xs={12}>
                                            <Typography variant="h6">
                                                {selectedTokenName}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={12}>
                                        Address: <ExplorerView address={selectedTokenMint} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' /> 
                                    </Grid>
                                    <Grid item xs={12}>
                                        Current List Price: <strong>{price} SOL</strong>
                                    </Grid>
                                    <Grid item xs={12} alignItems='right'>
                                        <Button
                                            size="small"
                                            color="info"
                                            variant="text"
                                            href={`https://magiceden.io/item-details/${selectedTokenMint}`}
                                            target="_blank"

                                        >View Listing on Magic Eden
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Box>

                            <Divider />

                            {meStats &&
                                <Box
                                    sx={{
                                        m:2,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:1,
                                        width:"100%"
                                    }}
                                >
                                    <Grid container alignItems="center">
                                        <Grid item xs={12}>
                                            <Typography variant="h6">
                                                Collection Stats
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="caption">
                                            Currently Listed: {meStats.listedCount}<br/>
                                            Floor: {(meStats.floorPrice / 10 ** 9).toLocaleString()} SOL<br/>
                                            Volume: {(meStats.volumeAll / 10 ** 9).toLocaleString()} SOL<br/>
                                        </Typography>
                                    </Grid>
                                </Box>
                            }
                        </Grid>
                    </DialogContentText>
                    
                    <RegexTextField
                        regex={/[^0-9]+\.?[^0-9]/gi}
                        autoFocus
                        autoComplete='off'
                        margin="dense"
                        id="preview_sell_now_id"
                        label='Edit Listing Price'
                        type="text"
                        fullWidth
                        variant="standard"
                        //value={sell_now_amount}
                        onChange={(e: any) => {
                            setNewListPrice(e.target.value)}
                        }
                        inputProps={{
                            style: { 
                                textAlign:'center', 
                                fontSize: '34px'
                            }
                        }}
                    />
                    {/*
                    <TextField
                        autoFocus
                        margin="dense"
                        id="newlistprice"
                        label="New List Price"
                        type="text"
                        fullWidth
                        variant="standard"
                        onChange={(e) => setNewListPrice(e.target.value)}
                        />*/}
                    </DialogContent>
                    <DialogActions>
                    <Button color="info" onClick={handleClose}>Cancel</Button>
                    <Button color="primary" onClick={handleChangeListPrice}
                        disabled={
                            newListPrice ? false : true
                        }
                    >Change Price</Button>
                    </DialogActions>
                </Dialog>
                </>

            )
        }
        
        React.useEffect(() => {
            if (fromAddress && !allWalletHoldingsOnME){
                // fetch all listings in an async call
                fetchListingsForToken();
            }
        },[fromAddress]);

        return (
            <>
            {allWalletHoldingsOnME ?

            <>
                {(allWalletHoldingsOnME.length > 0 && allWalletHoldingsOnME.filter((item) => item.listStatus === "listed")) &&
                    <Typography variant="h6">Current Listings</Typography>
                }
                <List sx={{ width: '100%' }}>
                
                {allWalletHoldingsOnME.map((item: any, key: number) => {
                    if (item.listStatus === "listed") {

                        return(
                            <>
                                <ListItem alignItems="flex-start">
                                    <ListItemAvatar>
                                        <Avatar alt={item.name} src={item.image} />
                                    </ListItemAvatar>
                                    <ListItemText
                                    primary={
                                        <>{item.name}</>
                                    }
                                    secondary={
                                        <React.Fragment>
                                            <Typography
                                                sx={{ display: 'inline' }}
                                                component="span"
                                                variant="body2"
                                                color="text.primary"
                                            >
                                                {item.price} SOL
                                            </Typography> - {item.collectionName}
                                            <ButtonGroup sx={{ml:1}}>
                                                <EditListingPriceView 
                                                    selectedTokenName={item.name}
                                                    selectedTokenMint={item.mintAddress}
                                                    selectedTokenAtaString={item.tokenAddress}
                                                    price={item.price}
                                                />
                                                <Button
                                                    color="error"
                                                    onClick={() => generateMECancelLlistingInstructions(item.mintAddress, item.tokenAddress, item.price)}
                                                >Cancel Listing</Button>
                                            </ButtonGroup>
                                        </React.Fragment>
                                    }
                                    />
                                </ListItem>

                                <Divider variant="inset" component="li" />
                            
                            </>
                        );
                    }
                    return null;
                })}
                </List>
                </>
            :
                <></>
            }</>
        )
    }

    const fetchCollectionStats = async(selectedTokenMint:string) => {
        let meCollection = null;
        if (allWalletHoldingsOnME){
            for (let item of allWalletHoldingsOnME){
                if (item.mintAddress === selectedTokenMint){
                    //console.log("checking: "+JSON.stringify(item));
                    meCollection = item.collection;
                }
            }
        }
        if (meCollection){
            const collectionStats = await getCollectionStats(meCollection);
            console.log("Collection Stats: "+JSON.stringify(collectionStats));
            setSelectedTokenStats(collectionStats);
        }
    }

    React.useEffect(() => {
        if (tokenMint && allWalletHoldingsOnME){
            //fetchCollectionStats(tokenMint);
        }
    },[tokenMint]);

    function TokenSelect() {

        const handleMintSelected = (event: SelectChangeEvent) => {
            const selectedTokenMint = event.target.value as string;
            setTokenMint(selectedTokenMint);

            fetchCollectionStats(selectedTokenMint);

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
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200, // Adjust this value as needed
                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                      },
                    },
                  }}
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
                {selectedTokenStats &&
                    <Box
                        sx={{
                            m:1,
                            background: 'rgba(0, 0, 0, 0.1)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1,
                        }}
                    >
                        <Grid sx={{textAlign:'right',}}>
                            <Typography variant="caption">
                                Currently Listed: {selectedTokenStats.listedCount}<br/>
                                Floor: {(selectedTokenStats.floorPrice / 10 ** 9).toLocaleString()} SOL<br/>
                                Volume: {(selectedTokenStats.volumeAll / 10 ** 9).toLocaleString()} SOL<br/>
                            </Typography>
                        </Grid>
                    </Box>
                }
              </FormControl>
            </Box>
          </>
        );
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

        // IMPORTANT: Fix description here for edit & cancel
        description = `Listing ${tokenMint} for ${tokenAmount.toLocaleString()} on Magic Eden`;
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
            "type":`Magic Eden Listing Plugin`,
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
                            <strong>Magic Eden</strong> Listing Plugin
                        </Grid>
                    </Grid>
                </Typography>
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
                
                {/*
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
                */}
                <RegexTextField
                        regex={/[^0-9]+\.?[^0-9]/gi}
                        autoFocus
                        autoComplete='off'
                        margin="dense"
                        id="setListingPrice"
                        label='List Price'
                        type="text"
                        fullWidth
                        variant="outlined"
                        //value={tokenAmount}
                        onChange={(e: any) => {
                            handleTokenAmountChange(e.target.value)}
                        }
                        inputProps={{
                            style: { 
                                textAlign:'center', 
                                fontSize: '20px'
                            }
                        }}
                    />
                {(tokenAmount && tokenAmount < tokenFloorPrice) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: You are listing bellow floor price!</Typography>
                    </Grid>
                : <></>
                }
            </FormControl>
            
            
                {(tokenAmount && tokenMint) ?
                    <>  
                        
                    </>
                :
                    <Box
                        sx={{textAlign:'center'}}
                    >
                        <Typography variant="caption">Start by selecting a mint & set a list price</Typography>
                    </Box>
                }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (tokenMint) &&
                            (tokenAmount && tokenAmount > 0)
                        )
                        }
                        onClick={generateMEListInstructions}
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

                <ViewAllListings />
                
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Magic Eden Listing Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}
