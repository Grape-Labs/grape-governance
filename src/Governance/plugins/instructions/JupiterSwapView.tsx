import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import moment from "moment";

import { CloseDCAParams, CreateDCAParams, DCA, type DepositParams, type WithdrawParams, Network } from '@jup-ag/dca-sdk';

import { getJupiterPrices, convertSecondsToLegibleFormat } from '../../../utils/grapeTools/helpers';

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
  TextareaAutosize,
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
  Alert,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Switch,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  InputAdornment,
  OutlinedInput
} from '@mui/material';

import Confetti from 'react-dom-confetti';
import SolIcon from '../../../components/static/SolIcon';
import SolCurrencyIcon from '../../../components/static/SolCurrencyIcon';

import ExplorerView from '../../../utils/grapeTools/Explorer';

import { SelectChangeEvent } from '@mui/material/Select';
import { MakeLinkableAddress, ValidateAddress } from '../../../utils/grapeTools/WalletAddress'; // global key handling
import { useSnackbar } from 'notistack';

//import { withSend } from "@cardinal/token-manager";

import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import CodeIcon from '@mui/icons-material/Code';
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

export default function JupiterSwapView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceWallet = props?.governanceWallet;
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey || governanceWallet?.pubkey);
    const [toMintAddress, setToMintAddress] = React.useState(null);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenDecimals, setTokenDecimals] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const maxDestinationWalletLen = 20;
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [destinationString, setDestinationString] = React.useState(null);
    const [distributionType, setDistributionType] = React.useState(true);
    const [period, setPeriod] = React.useState(null);
    const [periodDuration, setPeriodDuration] = React.useState(1);
    const [minOutAmountPerCycle, setMinOutAmountPerCycle] = React.useState(null);
    const [maxOutAmountPerCycle, setMaxOutAmountPerCycle] = React.useState(null);
    const [pricingStrategy, setPricingStrategy] = React.useState(false);
    const [currentBuyPrice, setCurrentBuyPrice] = React.useState(null);
    const [currentDCAs, setCurrentDCAs] = React.useState([]);
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const connection = RPC_CONNECTION;
    
    const availableTokens = [{
        mint:"So11111111111111111111111111111111111111112",
        name:"SOL",
        decimals:9,
        logo:"https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png"
    },{
        mint:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        name:"USDC",
        decimals:6,
        logo:"https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png"
    },{
        mint:"Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        name:"USDT",
        decimals:6,
        logo:"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg"
    },{
        mint:"mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
        name:"mSol",
        decimals:9,
        logo:"https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png"
    },{
        mint:"8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA",
        name:"GRAPE",
        decimals:6,
        logo:"https://lh3.googleusercontent.com/y7Wsemw9UVBc9dtjtRfVilnS1cgpDt356PPAjne5NvMXIwWz9_x7WKMPH99teyv8vXDmpZinsJdgiFQ16_OAda1dNcsUxlpw9DyMkUk=s0"
    }];

    const objectToken = {};
    availableTokens.forEach(token => {
        objectToken[token.mint] = token;
    }); 

    
    async function setupSwap() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWalletAddress = new PublicKey(fromAddress);
        const fromMintAddressPk = new PublicKey(tokenMint);
        const toMintAddressPk = new PublicKey(toMintAddress);
        //const dca = new DCA(connection, Network.MAINNET);
        let toDecimals = 0;
        let fromDecimals = tokenDecimals;

        for (var item of availableTokens){
            if (item.mint === toMintAddress)
                toDecimals = item.decimals;
            if (item.mint === tokenMint)
                fromDecimals = item.decimals
        }

        if (!fromDecimals){
            {governanceWallet && governanceWallet.tokens.value
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((item: any, key: number) => {
                    if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                        item.account.data.parsed.info.tokenAmount.amount > 0) {
                            if (item.account.data.parsed.info.mint === tokenMint){
                                fromDecimals = item.account.data.parsed.info.tokenAmount.decimals;
                            }
                    }
            })}
        }

        //const transaction = new Transaction();
        //const pTransaction = new Transaction();
        
        let integerTokenAmount = Math.floor(tokenAmount * Math.pow(10, fromDecimals));
        const inAmount = BigInt(integerTokenAmount);
        
        const quoteResponse = await (
            await fetch('https://quote-api.jup.ag/v6/quote?inputMint='+tokenMint+'&outputMint='+toMintAddress+'&amount='+inAmount+'&slippageBps=50&maxAccounts=54'
            )
          ).json();
        
        // const routes = data;

        // get serialized transactions for the swap
        if (quoteResponse){
            /*
            const instructions = await (
                await fetch('https://quote-api.jup.ag/v6/swap-instructions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    userPublicKey:fromAddress,
                    // quoteResponse from /quote api
                    quoteResponse,
                })
            })
            ).json();

            */

            const transactions = await (
                await fetch('https://quote-api.jup.ag/v6/swap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    // route from /quote api
                    //route: routes[0],
                    quoteResponse,
                    //quoteResponse,
                    // user public key to be used for the swap
                    userPublicKey: fromWalletAddress.toBase58(),
                    // auto wrap and unwrap SOL. default is true
                    wrapUnwrapSol: true,//wrapUnwrapSOL: true,
                    asLegacyTransaction:true,
                    // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
                    // This is the ATA account for the output token where the fee will be sent to. If you are swapping from SOL->USDC then this would be the USDC ATA you want to collect the fee.
                    // feeAccount: "fee_account_public_key"
                })
                })
            ).json();
            
            if (transactions){
                const { swapTransaction } = transactions;

                //const { tx, dcaPubKey } = await dca.createDCA(params);
                
                //const latestBlockHash = await connection.getLatestBlockhash();
                //tx.recentBlockhash = latestBlockHash;

                //console.log("DCA B64: "+tx.serializeMessage().toString("base64"));
                //setPayerInstructions(pTransaction);
                
                const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
                
                const tx = Transaction.from(swapTransactionBuf);
                
                let transaction = VersionedTransaction.deserialize(swapTransactionBuf);
                
                //const rawTx = transaction.serialize();
                //const deserializedTransaction = Transaction.from(swapTransactionBuf);
                
                /*
                const {
                    tokenLedgerInstruction, // If you are using `useTokenLedger = true`.
                    computeBudgetInstructions, // The necessary instructions to setup the compute budget.
                    setupInstructions, // Setup missing ATA for the users.
                    swapInstruction: swapInstructionPayload, // The actual swap instruction.
                    cleanupInstruction, // Unwrap the SOL if `wrapAndUnwrapSol = true`.
                    addressLookupTableAddresses, // The lookup table addresses that you can use if you are using versioned transaction.
                } = instructions;
                
                //const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
                
                console.log("instructions: "+JSON.stringify(instructions));

                const swapInstruction = new TransactionInstruction({
                    programId: new PublicKey(swapInstructionPayload.programId),
                    keys: swapInstructionPayload.accounts.map((key) => ({
                    pubkey: new PublicKey(key.pubkey),
                        isSigner: key.isSigner,
                        isWritable: key.isWritable,
                    })),
                    data: Buffer.from(swapInstructionPayload.data, "base64"),
                });

                console.log("tx: "+JSON.stringify(swapInstruction));

            //tx.add(new TransactionInstruction(instructions));
                const tx = new Transaction();
                */
                //tx.add(swapInstruction);
                
                const latestBlockHash = (await connection.getLatestBlockhash()).blockhash;
                tx.recentBlockhash = latestBlockHash;
                tx.feePayer = fromWalletAddress;
                
                /*
                const simulationResult = await connection.simulateTransaction(tx);
                if (simulationResult?.err) {
                    console.error('Transaction simulation failed:', simulationResult);
                    return;
                }else{
                    console.log('simulationResult: '+JSON.stringify(simulationResult));
                    const computeUnits = simulationResult.value?.unitsConsumed; //simulationResult.value?.transaction?.message.recentBlockhashFeeCalculator.totalFees;
                    //const lamportsPerSol = 1000000000;
                    const sol = computeUnits / 10 ** 9;
                    console.log(`Estimated fee: ${sol}`);
                    //setTransactionEstimatedFee(sol);//feeInLamports/10 ** 9;
                }
                */

                /*
                const serializedTransaction = swapTransaction.serialize();
                const transactionSize = serializedTransaction.length;
                console.log(`Transaction size: ${transactionSize} bytes`);
                */
                setTransactionInstructions(tx);
                // Estimate the transaction fee
            } else{
                console.log("No Tx for Swap!");
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
                                setTokenDecimals(item.account.data.parsed.info.tokenAmount.decimals);
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
                    let tokenMetadata = null;
                    try{
                        tokenMetadata = await Metadata.fromAccountAddress(connection, pda)
                    }catch(e){console.log("ERR: "+e)}
                    
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
                    {(governanceWallet && governanceWallet.solBalance > 0) &&
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

                                <Grid item xs={12} sx={{textAlign:'center',mt:-1}}>
                                    <Typography variant="caption" sx={{borderTop:'1px solid rgba(255,255,255,0.05)',pt:1}}>
                                        {'So11111111111111111111111111111111111111112'}
                                    </Typography>
                                </Grid>
                            </Grid>
                                    
                        </MenuItem>
                    }

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
                                    item.account.data.parsed.info.tokenAmount.decimals > 0) {
                                
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
                                    //return null; // Don't render anything for items without nativeTreasuryAddress
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

        // If there is a decimal part and it has more than 9 decimal places, truncate it
        if (parts[1] && parts[1].length > 9) {
            parts[1] = parts[1].slice(0, 9);
        }

        // Join the parts back together
        const withFractionalPart = parts.join('.');

        // Update the input field value
        // event.target.value = withFractionalPart;

        // Set tokenAmount as a float
        setTokenAmount(parseFloat(withFractionalPart));
    }

    function ToBuySelect() {
      
        const handleToBuyChange = (event: SelectChangeEvent) => {
            setToMintAddress(event.target.value as string);
          
        };

        const getTokenPrice = async() => { 
            /*
            const cgp = await getJupiterPrices([toMintAddress],tokenMint);
            if (cgp[toMintAddress]?.price)
                setCurrentBuyPrice(cgp[toMintAddress].price);
            */
            
            const cgp = await getJupiterPrices([tokenMint],toMintAddress);
            if (cgp[tokenMint]?.price)
                setCurrentBuyPrice(cgp[tokenMint].price);
            
        }

        React.useEffect(() => { 
            if (toMintAddress)
                getTokenPrice()
        }, [toMintAddress]);
            if (toMintAddress){
                
                // set currentBuyPrice
                // 
            }
      
        return (
          <Box sx={{ minWidth: 120, ml:1, mb:1 }}>
            <FormControl fullWidth>
              <InputLabel id="token-buy-select">To Swap</InputLabel>
              <Select
                labelId="token-buy-select"
                id="token-buy-select"
                value={toMintAddress}
                label="To Swap"
                onChange={handleToBuyChange}
                MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200, // Adjust this value as needed
                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                      },
                    },
                }}
              >
                {availableTokens.map((item: any, key: number) => {
                    return(
                    <MenuItem value={item.mint} key={key}>
                        <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                            <Grid item>
                                <Avatar alt={item.name} src={item.logo} />
                            </Grid>
                            <Grid item xs sx={{ml:1}}>
                                <Grid container
                                    direction="row"
                                    alignItems="center">
                                        <Grid item>
                                            <Typography variant="h6">
                                                {item.name}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs sx={{textAlign:'right'}}>
                                            <Typography variant="caption">
                                                {item.mint}
                                            </Typography>
                                        </Grid>
                                </Grid>

                            </Grid>
                        </Grid>
                    </MenuItem>);
                })}
              </Select>
                {currentBuyPrice &&
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption">Current Price: {currentBuyPrice}</Typography>
                    </Grid>
                }
            </FormControl>
          </Box>
        );
    }

    function prepareAndReturnInstructions(){

        let description = "";

        if (toMintAddress){
            description = `SWAP - `;
            description +=  `From: ${tokenAmount} ${tokenMint} - `;
            description +=  `To: ${toMintAddress} - `;
        }
        
        setInstructionsObject({
            "type":`SWAP`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            //setLoadingWallet(true);
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
            //setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            //setLoadingWallet(false);
        }

    }

    React.useState(() => {
        if (governanceWallet && !consolidatedGovernanceWallet) 
            getAndUpdateWalletHoldings(governanceWallet?.vault.pubkey);
    }, [governanceWallet, consolidatedGovernanceWallet]);

    React.useEffect(() => { 
        /*
        if (destinationString && tokenAmount && distributionType){
            calculateDestinationsEvenly(destinationString, tokenAmount);
        } else if (destinationString){
            calculateDestinations(destinationString);
        }
        */
    }, [destinationString, tokenAmount, distributionType]);


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
                            <Avatar alt={'Jupiter Aggregator'} src={'https://jup.ag/svg/jupiter-logo.svg'} />
                        </Grid>
                        <Grid item xs sx={{ml:1}}>
                            <strong>Jupiter</strong> Swap Plugin
                        </Grid>
                    </Grid>
                </Typography>
            </Box>
            
            {consolidatedGovernanceWallet &&
                <TokenSelect />
            }
            
            <FormControl fullWidth  sx={{mb:2}}>
                <Grid container alignContent="center" alignItems="center" direction="row" xs={12} spacing={1}>
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
            
            <ToBuySelect />  
                
                
                {(tokenAmount && toMintAddress && tokenMint) ?
                    <>  
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
                            <strong>Swap</strong>
                            <br/>
                            From: {tokenAmount} {objectToken[tokenMint] ? objectToken[tokenMint].name : tokenMint}<br/>
                            To: {objectToken[toMintAddress] ? objectToken[toMintAddress].name : toMintAddress}<br/>
                            </Typography>
                        </Box>
                        
                    </>
                :
                    <></>
                }

                <Grid sx={{textAlign:'right', mb:2}}>
                        
                        <Button 
                            disabled={(!(
                                (tokenAmount && toMintAddress && tokenMint)
                            ))
                            }
                            onClick={setupSwap}
                            variant="contained"
                            color="info"
                            sx={{borderRadius:'17px'}}>
                            Preview Instructions</Button>

                        
                    
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Jupiter Swap Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}