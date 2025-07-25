import React, { useCallback } from 'react';
import { ComputeBudgetProgram, Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionMessage, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, 
    createTransferInstruction,
    getMint } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { publicKey as umiPublicKey  } from '@metaplex-foundation/umi'
import { Metadata, 
    TokenRecord, 
    fetchDigitalAsset, 
    MPL_TOKEN_METADATA_PROGRAM_ID, 
    getCreateMetadataAccountV3InstructionDataSerializer } from "@metaplex-foundation/mpl-token-metadata";
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults"
import { useWallet } from '@solana/wallet-adapter-react';

import { 
    RPC_CONNECTION,
    FRICTIONLESS_WALLET } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import {
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
    performReverseLookup,
    getTwitterRegistry,
} from '@bonfida/spl-name-service';

import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';

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
  LinearProgress
} from '@mui/material';

import { 
    shortenString,
    isGated,
    findObjectByGoverningTokenOwner,
    convertSecondsToLegibleFormat,
  } from '../../../utils/grapeTools/helpers';
  

import Confetti from 'react-dom-confetti';
import SolIcon from '../../../components/static/SolIcon';
import SolCurrencyIcon from '../../../components/static/SolCurrencyIcon';

import ExplorerView from '../../../utils/grapeTools/Explorer';
import { GrapeVerificationSpeedDial } from './GrapeVerificationSpeedDial';
import { GrapeVerificationDAO } from './GrapeVerificationDAO';
import { LookupTableIntegratedDialogView } from './LookupTableIntegratedDialogView';
import { SelectChangeEvent } from '@mui/material/Select';
import { MakeLinkableAddress, ValidateAddress } from '../../../utils/grapeTools/WalletAddress'; // global key handling
import { useSnackbar } from 'notistack';

//import { withSend } from "@cardinal/token-manager";

import PersonIcon from '@mui/icons-material/Person';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
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
    width: '100%', // Keep full width
    backgroundColor: '#333', // Dark background color
    color: '#fff', // White text for contrast
    border: '1px solid rgba(255, 255, 255, 0.2)', // Add a subtle border for clarity
    padding: theme.spacing(0.5), // Reduce padding for a smaller appearance
    fontSize: '12px', // Smaller font size for compactness
    lineHeight: '1.4', // Adjust line height for tighter spacing
    borderRadius: theme.shape.borderRadius, // Keep consistent border radius
    resize: 'none', // Prevent manual resizing for consistency
    outline: 'none', // Remove focus outline
    boxSizing: 'border-box', // Ensure padding does not affect total width
}));

const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_000_000, // Adjust based on your needs
});

export default function TokenTransferView(props: any) {
    const governanceAddress = props?.governanceAddress;
    const governanceLookup = props?.governanceLookup;
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [governanceRulesWallet, setGovernanceRulesWallet] = React.useState(props?.governanceRulesWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [hasBeenCalled, setHasBeenCalled] = React.useState(false);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.nativeTreasuryAddress?.toBase58() || governanceWallet?.vault?.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
    const [tokenAta, setTokenAta] = React.useState(null);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    let maxDestinationWalletLen = 50;
    const [verifiedDestinationWalletArray, setVerifiedDestinationWalletArray] = React.useState(null);
    const [verifiedDAODestinationWalletArray, setVerifiedDAODestinationWalletArray] = React.useState(null);
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [destinationString, setDestinationString] = React.useState(null);
    const [distributionType, setDistributionType] = React.useState(false);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const [tokenAmountStr, setTokenAmountStr] = React.useState(null);
    const [simulationResults, setSimulationResults] = React.useState(null);
    const [isCalculating, setIsCalculating] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    const tokenMetadataCache = new Map<string, { name: string; logo: string }>();
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    const [availableTokens, setAvailableTokens] = React.useState([
        {
            mint:"So11111111111111111111111111111111111111112",
            name:"SOL",
            symbol:"SOL",
            decimals:9,
            logo:"https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png"
        },{
            mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            name:"USDC",
            symbol:"USDC",
            decimals:6,
            logo:"https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png"
        },{
            mint:"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
            name:"USDT",
            symbol:"USDT",
            decimals:6,
            logo:"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg"
        },{
            mint:"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
            name:"mSol",
            symbol:"mSol",
            decimals:9,
            logo:"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png"
        },{
            mint:"8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA",
            name:"GRAPE",
            symbol:"GRAPE",
            decimals:6,
            logo:"https://lh3.googleusercontent.com/y7Wsemw9UVBc9dtjtRfVilnS1cgpDt356PPAjne5NvMXIwWz9_x7WKMPH99teyv8vXDmpZinsJdgiFQ16_OAda1dNcsUxlpw9DyMkUk=s0"
        },{
            mint:"AZsHEMXd36Bj1EMNXhowJajpUXzrKcK57wW4ZGXVa7yR",
            name:"GUAC",
            symbol:"GUAC",
            decimals:5,
            logo:"https://shdw-drive.genesysgo.net/36JhGq9Aa1hBK6aDYM4NyFjR5Waiu9oHrb44j1j8edUt/image.png"
        },{
            mint:"BaoawH9p2J8yUK9r5YXQs3hQwmUJgscACjmTkh8rMwYL",
            name:"ALL",
            symbol:"ALL",
            decimals:6,
            logo:"https://arweave.net/FY7yQGrLCAvKAup_SYEsHDoTRZXsttuYyQjvHTnOrYk"
        },{
            mint:"DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
            name:"BONK",
            symbol:"BONK",
            decimals:5,
            logo:"https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I"
        }]);
    
    const objectToken = {};
    availableTokens.forEach(token => {
        objectToken[token.mint] = token;
    }); 

    const simulateIx = async (transaction: Transaction): Promise<boolean> => {
        try {
            const { blockhash } = await connection.getLatestBlockhash();
            const payerKey = new PublicKey(fromAddress);
            const transactionIxs: TransactionInstruction[] = transaction.instructions;

            for (const instructionChunk of chunkInstructions(transactionIxs, 10)) { // Adjust chunk size as needed
                const message = new TransactionMessage({
                    payerKey,
                    recentBlockhash: blockhash,
                    instructions: instructionChunk,
                }).compileToV0Message();
    
                const transaction = new VersionedTransaction(message);
    
                // Simulate the chunk
                const simulationResult = await connection.simulateTransaction(transaction);
                setSimulationResults(simulationResult.value.logs);
    
                if (simulationResult.value.err) {
                    console.error("Chunk simulation failed with error:", simulationResult.value.err);
                    return false;
                }
    
                console.log("Chunk simulation successful.");
            }
    
            return true;
        } catch (error) {
            console.error("Error simulating large transaction:", error);
            return false;
        }
    };
    
    // Helper function to split instructions into chunks
    const chunkInstructions = (instructions: TransactionInstruction[], chunkSize: number) => {
        const chunks = [];
        for (let i = 0; i < instructions.length; i += chunkSize) {
            chunks.push(instructions.slice(i, i + chunkSize));
        }
        return chunks;
    };


    async function transferTokens() {
        //const payerWallet = new PublicKey(payerAddress);
        //const fromWallet = new PublicKey(fromAddress);

        let fromWallet = null;
        {consolidatedGovernanceWallet && consolidatedGovernanceWallet
            //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
            .map((governanceItem: any, key: number) => {
                governanceItem.tokens
                    .map((item: any, key: number) => {
                        if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                            item.account.data.parsed.info.tokenAmount.amount > 0) {
                                //if (item.account.data.parsed.info.mint === selectedTokenMint){
                                if (new PublicKey(item.pubkey).toBase58() === tokenAta){
                                    console.log("Found Token: "+JSON.stringify(item)) // item.account.data.parsed.info.owner?
                                    console.log("Found Owner: "+JSON.stringify(item.account.data.parsed.info.owner)) // item.account.data.parsed.info.owner?
                                    fromWallet = new PublicKey(item.account.data.parsed.info.owner);
                                    //setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                    //setTokenMint(item.account.data.parsed.info.mint);
                                }
                        }
                    })
                })}
        
        console.log("tokenATA: "+tokenAta);
        
        //const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(tokenMint);
        const amountToSend = +tokenAmount;
        console.log("amountToSend: "+amountToSend)
        const tokenAccount = new PublicKey(mintPubkey);
        
        const transaction = new Transaction();
        const pTransaction = new Transaction();
        
        if (tokenMint === "So11111111111111111111111111111111111111112"){ // Check if SOL
            fromWallet = new PublicKey(fromAddress);
            const decimals = 9;
            for (let index = 0; index < destinationWalletArray.length; index++) {
                const destinationObject = destinationWalletArray[index];
                const amount = Math.floor((destinationObject.amount * Math.pow(10, decimals)));
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: fromWallet,
                        toPubkey: new PublicKey(destinationObject.address),
                        lamports: amount,
                    })
                );
            }
            
            setTransactionInstructions(transaction);
            const status =  await simulateIx(transaction);
            // Estimate the transaction fee
            try{
                /*
                console.log("Getting estimated fees");
                
                const latestBlockHash = (await connection.getLatestBlockhash()).blockhash;
                transaction.recentBlockhash = latestBlockHash;
                transaction.feePayer = fromWallet;
                const feeInLamports = (await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed')).value;
                console.log("Estimated fee in lamports: ",feeInLamports);
                setTransactionEstimatedFee(feeInLamports/10 ** 9);
                */
            }catch(e){
                console.log("FEE ERR: ",e);
            }
        } else{  
            //console.log("mint: "+ tokenMint);
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
                        const transactionInstruction = createAssociatedTokenAccountInstruction(
                            publicKey || fromPublicKey, // or use payerWallet
                            destTokenAccount,
                            destPublicKey,
                            mintPubkey,
                            TOKEN_PROGRAM_ID,
                            ASSOCIATED_TOKEN_PROGRAM_ID
                        );
                        //transaction.add(transactionInstruction);
                        if (publicKey)
                            pTransaction.add(transactionInstruction);
                        else
                            transaction.add(transactionInstruction);
                    }

                    const amount = Math.floor((destinationObject.amount * Math.pow(10, decimals)));

                    transaction.add(
                        createTransferInstruction(
                            new PublicKey(tokenAta || fromTokenAccount),
                            destTokenAccount,
                            fromPublicKey,
                            amount
                        )
                    )
                }
                
                setPayerInstructions(pTransaction);
                setTransactionInstructions(transaction);
                
                const simTx = new Transaction();
                simTx.add(transaction);
                simTx.instructions.unshift(computeBudgetIx); // Add it at the beginning
                const status =  await simulateIx(simTx);
                return transaction;
            } catch(err){
                console.log("GEN ERR: "+JSON.stringify(err));
            }
            
        }
        return null;
    }

    function TokenSelect() {
        
        const handleMintSelected = (event: SelectChangeEvent) => {
            //const selectedTokenMint = event.target.value as string;
            // use the ATA not the mint:
            const selectedTokenAta = event.target.value as string;

            //setTokenMint(selectedTokenMint);
            setTokenAta(selectedTokenAta);
            if (pluginType === 4){
                // with token mint traverse to get the mint info if > 0 amount
                {consolidatedGovernanceWallet && consolidatedGovernanceWallet
                    //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                    .map((governanceItem: any, key: number) => {
                        governanceItem.tokens
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount > 0) {
                                        //if (item.account.data.parsed.info.mint === selectedTokenMint){
                                        //console.log("Item: "+JSON.stringify(item))
                                        if (new PublicKey(item.pubkey).toBase58() === selectedTokenAta){
                                            //console.log("Found Token: "+item.account.data.parsed.info.mint)
                                            setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                            setTokenMint(item.account.data.parsed.info.mint);
                                        }
                                }
                            })
                        })}
            } else{
                setTokenMaxAmount(governanceWallet.solBalance/10 ** 9)
            }
        };

        function ShowTokenMintInfo(props: any){
            const mintAddress = props.mintAddress;
            const [mintName, setMintName] = React.useState(null);
            const [mintLogo, setMintLogo] = React.useState(null);

            const getTokenMintInfo = async(mintAddress:string) => {
        
                const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(mintAddress));
        
                //const tokenName = mintInfo.name;
                
                //JSON.stringify(mintInfo);
        
                const decimals = mintInfo.decimals;
                //setMintDecimals(decimals);
                
                const mint_address = new PublicKey(mintAddress)
                
                let foundLogo = false;
                let foundName = false;
                if (tokenMap && tokenMap.length > 0){ // check token map
                    let tl = tokenMap.get(mint_address.toBase58())?.logoURI;
                    if (tl){
                        setMintLogo(tl);
                        foundLogo = true;
                        setMintName(tokenMap.get(mint_address.toBase58())?.name);
                        foundName = true;
                    }
                } else {
                    
                    if (objectToken[mint_address.toBase58()]){
                        setMintLogo(objectToken[mint_address.toBase58()].logo);
                        foundLogo = true;
                    }
                }

                if (!foundName && !foundLogo){
                    const umi = createUmi(RPC_CONNECTION);
                    const asset = await fetchDigitalAsset(umi, umiPublicKey(mint_address.toBase58()));
            
                    //console.log("Asset: ",(asset))
            
                    if (asset){
                        if (asset?.metadata?.name)
                            setMintName(asset.metadata.name.trim());
                        if (!foundLogo && asset?.metadata?.uri){
                            try{
                                const metadata = await window.fetch(asset.metadata.uri)
                                .then(
                                    (res: any) => res.json())
                                .catch((error) => {
                                    // Handle any errors that occur during the fetch or parsing JSON
                                    console.error("Error fetching data:", error);
                                });
                                
                                if (metadata && metadata?.image){
                                    if (metadata.image)
                                        setMintLogo(metadata.image);
                                }else if (tokenMap){ // check token map
                                    let tn = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.name;
                                    setMintName(tn);
                                    let tl = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.logoURI;
                                    setMintLogo(tl);
                                }
                            }catch(err){
                                console.log("ERR: ",err);
                            }
                        }
                    }
                    return asset?.metadata;
                }
            }

            React.useEffect(() => { 
                if (mintAddress && !mintName){
                    getTokenMintInfo(mintAddress);
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
                        <>{shortenString(mintAddress,5,5)}</>
                    }
                </>
            )

        }
      
        return (
          <>
            <Box sx={{ minWidth: 120, ml:1 }}>
                {loadingWallet ?
                <>Loading Tokens...</>
                :
                <FormControl fullWidth sx={{mb:2}}>
                    <InputLabel id="governance-token-select-label">{pluginType === 4 ? 'Token' : 'Select'}</InputLabel>
                    <Select
                    labelId="governance-token-select-label"
                    id="governance-token-select"
                    value={tokenAta}
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
                        {pluginType === 4 && consolidatedGovernanceWallet && 
                            consolidatedGovernanceWallet.map((governanceItem: any, govKey: number) => (
                                governanceItem.tokens
                                .filter((item: any) => 
                                    // Adjust filter logic if you want to show tokens with zero balance
                                    item?.pubkey && 
                                    item?.account?.data?.parsed?.info?.mint && 
                                    Number(item.account.data?.parsed?.info?.tokenAmount?.amount) > 0
                                )
                                .sort((a: any, b: any) => 
                                    Number(b.account.data?.parsed?.info?.tokenAmount?.amount) - 
                                    Number(a.account.data?.parsed?.info?.tokenAmount?.amount)
                                )
                                .map((item: any) => (
                                    <MenuItem key={`${govKey}-${item.pubkey}`} value={new PublicKey(item.pubkey).toBase58()}>
                                        <Grid container alignItems="center">
                                            <Grid item xs={12}>
                                                <Grid container>
                                                    <Grid item sm={8}>
                                                    <Grid container direction="row" justifyContent="left" alignItems="left">
                                                        {item.account?.tokenMap?.tokenName ? (
                                                        <Grid container direction="row" alignItems="center">
                                                            <Grid item>
                                                            <Avatar 
                                                                alt={item.account?.tokenMap?.tokenName || "Token"} 
                                                                src={item.account?.tokenMap?.tokenLogo && item.account.tokenMap.tokenLogo} 
                                                            />
                                                            </Grid>
                                                            <Grid item sx={{ ml: 1 }}>
                                                            <Typography variant="h6">
                                                                {item.account?.tokenMap?.tokenName || "Token"}
                                                            </Typography>
                                                            </Grid>
                                                        </Grid>
                                                        ) : (
                                                            <>-</>
                                                        )}
                                                    </Grid>
                                                    </Grid>
                                                    <Grid item xs sx={{ textAlign: 'right' }}>
                                                    <Typography variant="h6">
                                                        {(Number(item.account.data.parsed.info.tokenAmount.amount) / 
                                                        10 ** item.account.data.parsed.info.tokenAmount.decimals
                                                        ).toLocaleString()}
                                                    </Typography>
                                                    </Grid>
                                                </Grid>
                                                <Grid item xs={12} sx={{ textAlign: 'center', mt: -1 }}>
                                                    <Typography variant="caption" sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', pt: 1 }}>
                                                    {shortenString(item.account.data.parsed.info.mint, 5, 5)}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                    </MenuItem>
                                ))
                            ))}
                            
                        {pluginType === 5 &&
                            
                            <MenuItem key={1} value={'So11111111111111111111111111111111111111112'} selected>
                                <Grid container
                                    alignItems="center"
                                >
                                    <Grid item sm={8}>
                                        <Grid
                                            container
                                            direction="row"
                                            justifyContent="left"
                                            alignItems="left"
                                        >

                                            <Grid 
                                                container
                                                alignItems="center"
                                            >
                                            <Grid item>
                                                    <Avatar alt='SOL' src='https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png' />
                                                </Grid>
                                                <Grid item sx={{ml:1}}>
                                                    <Typography variant="h6">
                                                    SOL
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                    <Grid item xs sx={{textAlign:'right'}}>
                                        <Typography variant="h6">
                                            {/*item.vault?.nativeTreasury?.solBalance/(10 ** 9)*/}

                                            {(governanceWallet.solBalance/10 ** 9).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                </Grid>
                                        
                            </MenuItem>
                        }
                        
                    </Select>
                </FormControl>
                }
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
        const cleanedText = text.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, '$1');
        setTokenAmountStr(cleanedText);
        setTokenAmount(parseFloat(cleanedText))
    }

    
    React.useEffect(() => {
        if (tokenAmount){
            //const cleanedText = tokenAmountStr.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, '$1');
            setTokenAmountStr(tokenAmount);
            setTokenAmount(tokenAmount)
            
        }
    },[tokenAmount]);
    
    function calculateDestinationsEvenly(destinations:string, destinationAmount: number){
        const destinationsStr = destinations.replace(/['"]/g, '');;
        
        if (destinationsStr && destinationsStr.length > 0) {
            const destinationArray = destinationsStr
                .split(/,|\n/) // Split by comma or newline
                .map(destination => destination.trim().split(',')[0]) // Ignore numeric values after comma
                .filter(destination => destination);

            // Use a Set to filter out duplicates
            const uniqueDestinationsSet = new Set(destinationArray);

            // Convert the Set back to an array to preserve order and uniqueness
            let uniqueValidDestinations = Array.from(uniqueDestinationsSet)
                .filter(destination => isValidSolanaPublicKey(destination)) // Filter valid addresses
                .map(destination => ({
                    address: destination,
                    amount: ((tokenAmount || destinationAmount) / uniqueDestinationsSet.size),
                }));

            //console.log(tokenAmount + " - "+ destinationAmount);
            //console.log("uniqueDestinationsSet.size: "+ uniqueDestinationsSet.size);

            if (uniqueValidDestinations.length > maxDestinationWalletLen)
                uniqueValidDestinations = uniqueValidDestinations.slice(0, maxDestinationWalletLen);
            
            uniqueValidDestinations.forEach(destination => {
                destination.amount = ((tokenAmount || destinationAmount) / uniqueValidDestinations.length);
            });
            
            //console.log("uniqueValidDestinations: "+ uniqueValidDestinations.length);

            setDestinationWalletArray(uniqueValidDestinations);
        } else{
            setDestinationWalletArray(null);
        }
    }
    
    async function calculateDestinations(destination) {
        setIsCalculating(true);
        if (destination.includes('\t') && destination.includes(',')) {
            destination = destination.replace(/,/g, '');
        }
    
        const destinationsStr = destination.replace(/['"]/g, '').replace(/[\t]/g, ',');
        const destinationArray = destinationsStr.split('\n').map(item => item.trim()).filter(item => item !== '');
    
        const uniqueDestinationsMap = new Map();
        let totalAmount = 0;
        let columnToUse = null;
    
        let totalColumn1 = 0;
        let totalColumn2 = 0;
    
        // **First pass: Calculate totals without modifying the map**
        for (const destination of destinationArray) {
            let parts = destination.split(',').map(part => part.trim());
    
            if (parts.length === 3) {
                const amount1 = parseFloat(parts[1]);
                const amount2 = parseFloat(parts[2]);
    
                if (!isNaN(amount1)) totalColumn1 += amount1;
                if (!isNaN(amount2)) totalColumn2 += amount2;
            }
        }
    
        // **Prompt user ONCE if both columns have valid totals**
        if (totalColumn1 > 0 && totalColumn2 > 0) {
            columnToUse = await askUserWhichColumnToUse(totalColumn1, totalColumn2);
        } else {
            columnToUse = totalColumn2 > 0 ? 2 : 1; // Default to a valid column
        }
    
        // **Second pass: Process the destinations using the chosen column**
        for (const destination of destinationArray) {
            let parts = destination.split(',').map(part => part.trim());
    
            let address = '';
            let amountStr = '';
    
            if (parts.length === 3) {
                address = parts[0];
                amountStr = parts[columnToUse];
            } else if (parts.length === 2) {
                [address, amountStr] = parts;
            }
    
            if (isValidSolanaPublicKey(address)) {
                const amount = parseFloat(amountStr);
    
                if (!isNaN(amount)) {
                    totalAmount += amount;
                    if (uniqueDestinationsMap.has(address)) {
                        uniqueDestinationsMap.get(address).amount += amount;
                    } else {
                        uniqueDestinationsMap.set(address, { address, amount });
                    }
                }
            }
        }
    
        let uniqueDestinations = Array.from(uniqueDestinationsMap.values());
    
        if (uniqueDestinations.length > maxDestinationWalletLen) {
            uniqueDestinations = uniqueDestinations.slice(0, maxDestinationWalletLen);
        }
    
        if (totalAmount === 0 && tokenAmount > 0) {
            calculateDestinationsEvenly(destination, tokenAmount);
        } else {
            setTokenAmount(totalAmount);
            setDestinationWalletArray(uniqueDestinations);
        }
        setIsCalculating(false);
    }
    
    // **Ensure this function is only called ONCE per execution**
    async function askUserWhichColumnToUse(totalColumn1, totalColumn2) {
        return new Promise((resolve) => {
            setTimeout(() => {
                let choice = window.prompt(
                    `A third column was detected.\n` +
                    `Enter '1' for total calculated amount: ${totalColumn1}\n` +
                    `Enter '2' for the total amount: ${totalColumn2}`,
                    "1"
                );
                resolve(choice === "2" ? 2 : 1); // Default to column 1 if invalid input
            }, 0);
        });
    }
    
    function calculateDestinationsOriginal(destination:string) {

        if (destination.includes('\t') && destination.includes(',')){ // here remove all commas
            destination = destination.replace(/,/g, '');
        }

        const destinationsStr = destination.replace(/['"]/g, '').replace(/[\t]/g, ',');
        const destinationArray = destinationsStr.split('\n').map(item => item.trim()).filter(item => item !== '');
        
        const uniqueDestinationsMap = new Map();
        let totalAmount = 0;
        
        for (const destination of destinationArray) {
            let address = '';
            let amountStr = '';

            if (destination.includes('\t')){
                [address, amountStr] = destination.split('\t');
            } else{
                [address, amountStr] = destination.split(',');
            }

            address = address.trim();

            //const [address2, amountStr2] = destination.split('\t');
            //const [address, amountStr] = destination.split('    ');
            //const [address, amountStr] = destination.split(/[,|\t| {4}| {1}|⟶]/);

          if (isValidSolanaPublicKey(address)) {
            const amount = parseFloat(amountStr);
            
            if (!isNaN(amount)) {
                totalAmount+=amount;
                if (uniqueDestinationsMap.has(address)) {
                    // If the address already exists, update the amount
                    uniqueDestinationsMap.get(address).amount += amount;
                } else {
                    // If it's a new address, add it to the map
                    uniqueDestinationsMap.set(address, { address, amount });
                }
            }
          }
        }
      
        // Convert the map values to an array
        let uniqueDestinations = Array.from(uniqueDestinationsMap.values());
        
        if (uniqueDestinations.length > maxDestinationWalletLen)
            uniqueDestinations = uniqueDestinations.slice(0, maxDestinationWalletLen);


        if (totalAmount === 0 && tokenAmount > 0){
            calculateDestinationsEvenly(destination, tokenAmount)
        } else{
            setTokenAmount(totalAmount);
            setDestinationWalletArray(uniqueDestinations);
        }
    } 
    
    function handleAddMyWallet(){
        if (publicKey){
            if (!destinationString)
                setDestinationString(publicKey.toBase58());
            else if (destinationString.length <= 0)
                setDestinationString(publicKey.toBase58());
            else if (destinationString.includes(publicKey.toBase58()))
                return;
            else
                setDestinationString(destinationString + "\n" + publicKey.toBase58());
        }
    }

    function handleDestinationWalletChange(destinations:string){
        //console.log("String changed...")
        setDestinationString(destinations);
    }

    const handleDistrubtionTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDistributionType(event.target.checked);
      };

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

    const getTokens = async (setTokenMap:any) => {
        const tarray:any[] = [];
        try{
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tmap = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map())
                if (setTokenMap) setTokenMap(tmap);
                return tmap;
            });
    } catch(e){console.log("ERR: "+e)}
    }

    async function fetchWalletHoldings(wallet:string){
        
        if (!tokenMap){
            const tmap = await getTokens(setTokenMap);
            setTokenMap(tmap);
        }

        let solBalance = 0;

        if (wallet === governanceWallet?.vault?.pubkey || wallet === governanceWallet?.nativeTreasuryAddress?.toBase58() || wallet === governanceWallet?.pubkey?.toBase58()){
            
            console.log("wallet: "+wallet);
            if (governanceWallet?.vault?.pubkey)
                solBalance = await connection.getBalance(new PublicKey(governanceWallet.vault.pubkey));
            else
                solBalance = await connection.getBalance(new PublicKey(governanceWallet?.nativeTreasuryAddress));
            //if (governanceWallet?.vault?.pubkey ){
            governanceWallet.solBalance = solBalance;
            setTokenMaxAmount(governanceWallet.solBalance/10 ** 9)
            /*
            } else{
                if (!governanceWallet.solBalance && consolidatedGovernanceWallet?.solBalance){
                    setTokenMaxAmount(consolidatedGovernanceWallet.solBalance)
                } else{
                    console.log("max: "+governanceWallet.solBalance)
                    setTokenMaxAmount(governanceWallet.solBalance)
                }
            }*/
        }
        if (pluginType === 5)
            setTokenMint("So11111111111111111111111111111111111111112");

        console.log("getting parsed tokens: "+wallet);
        const tokenBalance = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(wallet),
            {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            }
        )
        // loop through governanceWallet
        const itemsToAdd = [];

        if (tokenBalance && tokenBalance?.value){
            for (let titem of tokenBalance.value){
                itemsToAdd.push(titem);
                    
                    /*
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
                    }*/
                
            }
        }

        // return a more easy to read object?
        const walletObject = {
            pubkey: wallet,
            solBalance: solBalance,
            tokens: itemsToAdd,
        }
        return walletObject;
    }

    async function getAndUpdateWalletHoldings(){
        try{
            setLoadingWallet(true);
            //console.log("1. governanceWallet: "+JSON.stringify(governanceWallet));
            //console.log("fetching governanceWallet: "+(governanceWallet?.vault?.pubkey || governanceWallet?.pubkey.toBase58()));
            const gwToAdd = await fetchWalletHoldings(governanceWallet?.vault?.pubkey || governanceWallet?.nativeTreasuryAddress?.toBase58());
            //console.log("fetching rules now rules: "+governanceRulesWallet);
            const rwToAdd = await fetchWalletHoldings(governanceRulesWallet);


            // add metadata!
            const getTokenMintInfo = async(mintAddress:string) => {
        
                const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(mintAddress));
        
                //const tokenName = mintInfo.name;
                
                //JSON.stringify(mintInfo);
        
                const decimals = mintInfo.decimals;
                //setMintDecimals(decimals);
                
                const mint_address = new PublicKey(mintAddress)
                
                let logo = null;
                let name = null;
                if (tokenMap && tokenMap.length > 0){ // check token map
                    if (tokenMap.get(mint_address.toBase58())?.logoURI){
                        logo = tokenMap.get(mint_address.toBase58())?.logoURI;
                    }
                    if (tokenMap.get(mint_address.toBase58())?.name)
                        name = tokenMap.get(mint_address.toBase58())?.name;
                } else {
                    if (objectToken[mint_address.toBase58()]){
                        logo = objectToken[mint_address.toBase58()].logo;
                        name = objectToken[mint_address.toBase58()].name;
                    }
                }

                if (!name || !logo){
                    const umi = createUmi(RPC_CONNECTION);
                    const asset = await fetchDigitalAsset(umi, umiPublicKey(mint_address.toBase58()));
            
                    //console.log("Asset: ",(asset))
            
                    if (asset){
                        if (asset?.metadata?.name)
                            name = asset.metadata.name.trim();
                        if (!logo && asset?.metadata?.uri){
                            try{
                                const metadata = await window.fetch(asset.metadata.uri)
                                .then(
                                    (res: any) => res.json())
                                .catch((error) => {
                                    // Handle any errors that occur during the fetch or parsing JSON
                                    console.error("Error fetching data:", error);
                                });
                                
                                if (metadata && metadata?.image){
                                    if (metadata.image)
                                        logo = metadata.image;
                                }else if (tokenMap){ // check token map
                                    let tn = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.name;
                                    name = tn;
                                    let tl = tokenMap.get(new PublicKey(mint_address.toBase58()).toBase58())?.logoURI;
                                    logo = tl;
                                }
                            }catch(err){
                                console.log("ERR: ",err);
                            }
                        }
                    }
                }
                return {name:name,logo:logo};
            }
            // Preload metadata for tokens
            const addMetadataToTokens = async (tokens: any[]) => {
                const tokenPromises = tokens.map(async (item: any) => {
                    try{
                        const mintAddress = item.account?.data?.parsed?.info?.mint;
                        if (mintAddress) {
                            const metadata = await getTokenMintInfo(mintAddress);
                            //console.log('found '+JSON.stringify(metadata));
                            item.account.tokenMap = item.account.tokenMap || {};
                            item.account.tokenMap.tokenName = metadata?.name || "Unknown Token";
                            item.account.tokenMap.tokenLogo = metadata?.logo || null;
                        }
                    }catch(e){
                        console.log("ERR: "+e);
                    }
                    return item;
                });
        
                return Promise.all(tokenPromises);
            };

            gwToAdd.tokens = await addMetadataToTokens(gwToAdd.tokens || []);
            rwToAdd.tokens = await addMetadataToTokens(rwToAdd.tokens || []);

            //governanceWallet.tokens.value = gwToAdd;//[...governanceWallet.tokens.value, ...itemsToAdd];
            //governanceRulesWallet. = rwToAdd;

            //console.log("Rules Wallet: " +JSON.stringify(rwToAdd));
            //console.log("Wallet: " +JSON.stringify(gwToAdd));

            const walletObjects = [gwToAdd, rwToAdd];

            setConsolidatedGovernanceWallet(walletObjects);

            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }

    React.useEffect(() => { 
        if (!isCalculating){
            if (destinationString && tokenAmount && distributionType){
                calculateDestinationsEvenly(destinationString, tokenAmount);
            } else if (destinationString){
                calculateDestinations(destinationString);
            } else{
                setDestinationWalletArray(null);
            }
        }
    }, [destinationString, tokenAmount, distributionType]);

    React.useEffect(() => {
        if (publicKey.toBase58() === 'FDw92PNX4FtibvkDm7nd5XJUAg6ChTcVqMaFmG7kQ9JP'){
            maxDestinationWalletLen = 2000;
        }
    },[publicKey]);

    const findPubkey = (address:string) => {
        try{
            const entry = verifiedDestinationWalletArray.find((item) => item.info.addresses.includes(address));
            //console.log("checking: "+address+" vs "+entry)
            if (entry) {
                return entry.pubkey.toBase58();
            }
            return null; // Address not found
        }catch(e){console.log("ERR: "+e)}
    };
    const findDAOPubkey = (address:string) => {
        try{
            //console.log("verifiedDAODestinationWalletArray: "+JSON.stringify(verifiedDAODestinationWalletArray))
            const entry = verifiedDAODestinationWalletArray.find((item) => item.info.includes(address));
            //console.log("checking: "+address+" entry "+JSON.stringify(entry))
            if (entry) {
                return entry.pubkey;
            }
            return null; // Address not found
        }catch(e){console.log("ERR: "+e)}
    };
    
    /*
    React.useEffect(() => {
        //const addressToFind = 'XYZ';
        //const pubkey = findPubkey(addressToFind);
    }, []);
    */

    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings();
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    return (
        <Box
            sx={{
                m:1,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:1
            }} 
        >
            <Box
                sx={{mb:4}}
            >
                <Typography variant="h5">{pluginType === 4 ? 'Token' : 'SOL'} Transfer Plugin</Typography>
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
            
            {loadingWallet ? 
                <>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <Grid 
                            container 
                            alignItems="center" 
                            justifyContent="center" 
                            spacing={1}
                            sx={{ textAlign: 'center' }}
                        >
                            <Grid item>
                            <CircularProgress size="20px" />
                            </Grid>
                            <Grid item>
                            <Typography variant="body1">Loading Tokens...</Typography>
                            </Grid>
                        </Grid>
                    </FormControl>
                </>
            :
            <>
                {consolidatedGovernanceWallet ?
                    <TokenSelect />
                :
                <>-</>
                }
                </>
            
            }
            
            <FormControl fullWidth  sx={{mb:2}}>
                <Grid container alignContent="center" alignItems="center" direction="row" xs={12}>
                    <Grid item xs>
                        
                        {/*
                        <TextField 
                            fullWidth 
                            label="Amount" 
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
                            //regex={/[^0-9]+\.?[^0-9]/gi}
                            regex={/[^0-9.]+/gi}
                            autoFocus
                            autoComplete='off'
                            margin="dense"
                            id="amount"
                            label='Amount'
                            type="text"
                            fullWidth
                            variant="outlined"
                            value={tokenAmountStr}
                            onChange={(e:any) => {
                                handleTokenAmountChange(e.target.value);
                            }}
                            inputProps={{
                                style: { 
                                    textAlign:'center', 
                                    fontSize: '20px'
                                }
                            }}
                        />
                        {tokenMaxAmount ?
                            <Grid xs="auto" sx={{textAlign:'right',}}>
                                <Tooltip title={
                                    <>
                                    Distribute Evenly<br/>
                                    For custom amounts please use the following format:
                                    address,amount
                                    </>}>
                                    <FormControlLabel control={
                                        <Checkbox 
                                            defaultChecked={distributionType}
                                            onChange={handleDistrubtionTypeChange}
                                        />
                                        }
                                        label='Even'/>

                                </Tooltip>
                            
                                <ButtonGroup size='small'>
                                    <Button
                                        onClick={(e:any)=> {
                                            setTokenAmount(tokenMaxAmount);
                                        }}
                                    >Max</Button>
                                    <Button
                                        onClick={(e:any)=> {
                                            setTokenAmount(tokenMaxAmount/2);
                                        }}
                                    >Half</Button>
                                </ButtonGroup>
                            </Grid>
                        : <></>
                        }
                        {tokenMaxAmount && tokenAmount > tokenMaxAmount ? 
                            <Grid sx={{textAlign:'right',}}>
                                <Typography variant="caption" color="error">WARNING: This proposal may fail if the token balance is insufficient!</Typography>
                            </Grid>
                        : <></>
                        }

                        {(pluginType === 5 && tokenMaxAmount <= 0.001)&&
                            <Grid sx={{textAlign:'right',}}>
                                <Typography variant="caption" color="error">Balance greater than rent is required to do a transfer</Typography>
                            </Grid>
                        }
                    </Grid>
                </Grid>
            </FormControl>
            
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth
                    label="Enter destination Wallet *for multiple wallets add 1 wallet per line (seperate with a comma/tab for custom distribution per wallet)"
                    multiline
                    rows={4}
                    maxRows={4}
                    value={destinationString}
                    //defaultValue={destinationString}
                    onChange={(e) => {
                            handleDestinationWalletChange(e.target.value)
                    }}
                    InputLabelProps={{ shrink: true }}
                    //sx={{maxlength:maxDestinationWalletLen}}
                    />
                <Grid sx={{textAlign:'right',}}>
                    <Typography variant="caption">{destinationWalletArray ? destinationWalletArray.length > 0 ? maxDestinationWalletLen - destinationWalletArray.length : maxDestinationWalletLen : maxDestinationWalletLen} wallets remaining</Typography>
                    <LookupTableIntegratedDialogView address={fromAddress} integrationType={1} buttonSize={12} setDestinationString={setDestinationString} destinationString={destinationString} />
                    <Tooltip title='Add my Wallet'>
                        <IconButton 
                                size="small"
                                onClick={handleAddMyWallet}
                                color='inherit'
                                sx={{color:'white',textTransform:'none',ml:1}}>
                            <PersonIcon sx={{fontSize:'18px'}} />
                        </IconButton>
                    </Tooltip>
                </Grid>
            </FormControl>    
                
            
            
                {(tokenAmount && destinationWalletArray && destinationWalletArray.length > 0 && tokenMint) ?
                    <>  
                        {destinationWalletArray.length > 0 ?
                        <>
                            {destinationWalletArray.length === 1 ?
                                <Box
                                    sx={{ m:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:1
                                    }}
                                >
                                    <Typography variant="h6">Preview/Summary <GrapeVerificationSpeedDial address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDestinationWalletArray={setVerifiedDestinationWalletArray} /> <GrapeVerificationDAO governanceAddress={governanceAddress} governanceLookup={governanceLookup} address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDAODestinationWalletArray={setVerifiedDAODestinationWalletArray} /></Typography>
                                    <Typography variant="caption">
                                    Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to <strong>{destinationWalletArray[0].address} {verifiedDestinationWalletArray ? 
                                        (
                                            findPubkey(destinationWalletArray[0].address) ? (
                                                <Tooltip title={`Grape Verified on ${findPubkey(destinationWalletArray[0].address)} via Speed Dial`}>
                                                    <IconButton
                                                        size="small" sx={{}}
                                                    >
                                                        <VerifiedIcon sx={{ color:'yellow',fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <>
                                                {verifiedDestinationWalletArray.length > 0 &&
                                                    <Tooltip title={`This address is not part of a Speed Dial`}>
                                                        <IconButton
                                                            size="small" sx={{}}
                                                        >
                                                            <WarningIcon color="warning" sx={{ fontSize: '12px' }}/>
                                                        </IconButton>
                                                    </Tooltip>
                                                }
                                                </>
                                            )
                                        ):<></>}
                                        {verifiedDAODestinationWalletArray ? 
                                        (
                                            findDAOPubkey(destinationWalletArray[0].address) ? (
                                                <Tooltip title={`DAO Verified on ${findDAOPubkey(destinationWalletArray[0].address)}`}>
                                                    <IconButton
                                                        size="small" sx={{}}
                                                    >
                                                        <CheckCircleIcon color='primary' sx={{ fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title={`Could not find a voter record for this address, or voter has no voting power`}>
                                                    <IconButton
                                                        size="small" sx={{}}
                                                    >
                                                        <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            )
                                        ):<></>}
                                    </strong>
                                    </Typography>
                                </Box>
                            :
                                <Box
                                    sx={{ m:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:1
                                    }}
                                >
                                    <Typography variant="h6">Preview/Summary <GrapeVerificationSpeedDial address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDestinationWalletArray={setVerifiedDestinationWalletArray}/> <GrapeVerificationDAO governanceAddress={governanceAddress} governanceLookup={governanceLookup} address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDAODestinationWalletArray={setVerifiedDAODestinationWalletArray}  /></Typography>
                                    <Typography variant="caption">
                                        Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to {destinationWalletArray.length} recipient(s):<br/>
                                        {destinationWalletArray.map((destination:any, index:number) => (
                                            <li key={index}>
                                                {destination.address.trim()}{' '}
                                                    {verifiedDestinationWalletArray ? (
                                                        findPubkey(destination.address) ? (
                                                            <Tooltip title={`Grape Verified on ${findPubkey(destination.address)} via Speed Dial`}>
                                                                <IconButton size="small" sx={{}}>
                                                                    <VerifiedIcon sx={{ color:'yellow', fontSize: '12px' }}/>
                                                                </IconButton>
                                                            </Tooltip>
                                                        ) : (
                                                            <>
                                                                {verifiedDestinationWalletArray.length > 0 &&
                                                                    <Tooltip title={`This address is not part of a Speed Dial`}>
                                                                        <IconButton
                                                                            size="small" sx={{}}
                                                                        >
                                                                            <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                }
                                                            </>
                                                        )
                                                        ) : (
                                                        ''
                                                    )}
                                                    
                                                    {verifiedDAODestinationWalletArray ? 
                                                        (
                                                            findDAOPubkey(destination.address) ? (
                                                                <Tooltip title={`DAO Verified on ${findDAOPubkey(destination.address)}`}>
                                                                    <IconButton
                                                                        size="small" sx={{}}
                                                                    >
                                                                        <CheckCircleIcon color='primary' sx={{ fontSize: '12px' }}/>
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip title={`Could not find a voter record for this address, or voter has no voting power`}>
                                                                    <IconButton
                                                                        size="small" sx={{}}
                                                                    >
                                                                        <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )
                                                        ):<></>}
                                                      
                                                    {' '}
                                                    - {destination.amount.toLocaleString()} tokens
                                            </li>
                                        ))}
                                    </Typography>
                                </Box>
                            }
                        </>
                        :<></>
                        }
                    </>
                :
                    <Box
                        sx={{textAlign:'center'}}
                    >
                        <Typography variant="caption">Start by selecting a token, amount and wallet destination address</Typography>
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
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:2
                        }}
                    >
                        <Typography variant="h6">Transaction Instructions</Typography>
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(transactionInstructions, null, 2)}
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
            {simulationResults && 
                <Box
                    sx={{ m:1,
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '17px',
                        overflow: 'hidden',
                        p:2
                    }}
                >
                    <Typography variant="h6">Simulation</Typography>
                
                    <CustomTextarea
                        minRows={6}
                        value={JSON.stringify(simulationResults, null, 2)}
                        readOnly
                    />
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance {pluginType === 4 ? 'Token' : 'SOL'} Transfer Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}