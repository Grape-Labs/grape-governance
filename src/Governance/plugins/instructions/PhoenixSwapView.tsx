import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import moment from "moment";

import * as Phoenix from "@ellipsis-labs/phoenix-sdk";

import { getJupiterPrices, convertSecondsToLegibleFormat } from '../../../utils/grapeTools/helpers';

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import {
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
    performReverseLookup,
    getTwitterRegistry,
} from '../../../utils/web3/snsCompat';

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

export default function PhoenixSwapView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceWallet = props?.governanceWallet;
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.pubkey?.toBase58() || governanceWallet?.vault?.pubkey);
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
        let toDecimals = 6;
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
        
        let integerTokenAmount = Math.floor(tokenAmount * Math.pow(10, fromDecimals));
        const inAmount = BigInt(integerTokenAmount);
        console.log("inAmount: "+inAmount);
        
        // SOL/USDC
        const marketAddress = new PublicKey(
            "4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg"
        );
        
        console.log("1");
        const marketAccount = await connection.getAccountInfo(
            marketAddress,
            "confirmed"
        );
        if (!marketAccount) {
            throw Error(
                "Market account not found for address: " + marketAddress.toBase58()
            );
        }
        console.log("2");
        const client = await Phoenix.Client.createWithMarketAddresses(connection, [
            marketAddress,
        ]);
        console.log("3");
        const marketState = client.marketStates.get(marketAddress.toBase58());
        if (marketState === undefined) {
            throw Error("Market not found");
        }

        const slippage = 0.008;
        
        console.log("sippage: "+slippage);

        // Submit a market order buying 100 USDC worth of SOL
        const orderPacket = marketState.getSwapOrderPacket({
            side: Phoenix.Side.Bid,
            inAmount: 1,
            slippage: slippage,
        });
        const swapIx = marketState.createSwapInstruction(orderPacket, fromWalletAddress);
        
        // get serialized transactions for the swap
        setTransactionInstructions(swapIx);
        
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

    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet) 
            getAndUpdateWalletHoldings(governanceWallet?.vault?.pubkey || governanceWallet?.pubkey);
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
                            <Avatar alt={'Phoenix DEX'} src={'data:image/png;base64,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'} />
                        </Grid>
                        <Grid item xs sx={{ml:1}}>
                            <strong>Phoenix</strong> Swap Plugin
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Phoenix Swap Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}
