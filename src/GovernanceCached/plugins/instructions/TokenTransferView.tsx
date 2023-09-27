import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from '@solana/wallet-adapter-react';

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

export default function TokenTransferView(props: any) {
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

    async function transferTokens() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        //const toWallet = new PublicKey(toAddress);
        const mintPubkey = new PublicKey(tokenMint);
        const amountToSend = +tokenAmount;
        console.log("amountToSend: "+amountToSend)
        const tokenAccount = new PublicKey(mintPubkey);
                
        const transaction = new Transaction();
        const pTransaction = new Transaction();

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
            setTransactionInstructions(transaction);
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
            return transaction;
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
                            payerWallet || fromPublicKey, // or use payerWallet
                            destTokenAccount,
                            destPublicKey,
                            mintPubkey,
                            TOKEN_PROGRAM_ID,
                            ASSOCIATED_TOKEN_PROGRAM_ID
                        );
                        //transaction.add(transactionInstruction);
                        pTransaction.add(transactionInstruction);
                    }

                    const amount = Math.floor((destinationObject.amount * Math.pow(10, decimals)));

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
                setPayerInstructions(pTransaction);
                setTransactionInstructions(transaction);
                // Estimate the transaction fee
                
                try{
                    /*
                    console.log("Getting estimated fees");
                    const latestBlockHash = (await connection.getLatestBlockhash()).blockhash;
                    transaction.recentBlockhash = latestBlockHash;
                    transaction.feePayer = fromWallet;
                    const simulationResult = await connection.simulateTransaction(transaction);
                    if (simulationResult?.err) {
                        console.error('Transaction simulation failed:', simulationResult);
                        return;
                    }else{
                        console.log('simulationResult: '+JSON.stringify(simulationResult));
                        const computeUnits = simulationResult.value?.unitsConsumed; //simulationResult.value?.transaction?.message.recentBlockhashFeeCalculator.totalFees;
                        //const lamportsPerSol = 1000000000;
                        const sol = computeUnits / 10 ** 9;
                        console.log(`Estimated fee: ${sol}`);
                        setTransactionEstimatedFee(sol);//feeInLamports/10 ** 9;
                    }
                    */
                    //const feeInLamports = (await connection.getFeeForMessage(transaction.compileMessage(), 'confirmed')).value;
                    //console.log("Estimated fee in lamports: ",feeInLamports);
                    //setTransactionEstimatedFee(feeInLamports/10 ** 9);
                }catch(e){
                    console.log("FEE ERR: ",e);
                }
                return transaction;
            } catch(err){
                console.log("GEN ERR: "+JSON.stringify(err));
            }
            
        }
        return null;
    }

    function TokenSelect() {

        const handleMintSelected = (event: SelectChangeEvent) => {
            const selectedTokenMint = event.target.value as string;
            setTokenMint(selectedTokenMint);

            if (pluginType === 4){
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
            } else{
                setTokenMaxAmount(governanceWallet.solBalance/10 ** 9)
            }
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
                    {(pluginType === 4 && governanceWallet) && governanceWallet.tokens.value
                            .filter((item: any) => 
                                item.account.data?.parsed?.info?.tokenAmount?.amount > 0
                            )
                            .sort((a: any, b: any) => 
                                b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                            )
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount > 0) {
                                
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
    
    function calculateDestinations(destination:string) {
        const destinationsStr = destination.replace(/['"]/g, '');
        const destinationArray = destinationsStr.split('\n').map(item => item.trim()).filter(item => item !== '');
        
        const uniqueDestinationsMap = new Map();
        let totalAmount = 0;

        for (const destination of destinationArray) {
          const [address, amountStr] = destination.split(',');
            
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
        if (destinationString && tokenAmount && distributionType){
            calculateDestinationsEvenly(destinationString, tokenAmount);
        } else if (destinationString){

            calculateDestinations(destinationString);
        }
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
            
            {consolidatedGovernanceWallet &&
                <TokenSelect />
            }
            
            <FormControl fullWidth  sx={{mb:2}}>
                <Grid container alignContent="center" alignItems="center" direction="row" xs={12}>
                    <Grid item xs="auto">
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
                    </Grid>
                    <Grid item xs>
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
                    label="Enter destination Wallet *for multiple wallets add 1 wallet per line (seperate with a comma for custom distribution per wallet)"
                    multiline
                    rows={4}
                    maxRows={4}
                    //value={destinationWallets}
                    onChange={(e) => {
                            handleDestinationWalletChange(e.target.value)
                    }}
                    //sx={{maxlength:maxDestinationWalletLen}}
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance {pluginType === 4 ? 'Token' : 'SOL'} Transfer Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}