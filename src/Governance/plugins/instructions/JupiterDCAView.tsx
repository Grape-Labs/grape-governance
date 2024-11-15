import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import moment from "moment";
import axios from "axios";

import { CloseDCAParams, CreateDCAParams, DCA, type DepositParams, type WithdrawParams, Network } from '@jup-ag/dca-sdk';

import { shortenString, getJupiterPrices, convertSecondsToLegibleFormat } from '../../../utils/grapeTools/helpers';

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

export default function JupiterDCAView(props: any) {
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
    
    const [availableTokens, setAvailableTokens] = React.useState([
        /*{
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
        },*/{
            mint:"8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA",
            name:"GRAPE",
            symbol:"GRAPE",
            decimals:6,
            logo:"https://lh3.googleusercontent.com/y7Wsemw9UVBc9dtjtRfVilnS1cgpDt356PPAjne5NvMXIwWz9_x7WKMPH99teyv8vXDmpZinsJdgiFQ16_OAda1dNcsUxlpw9DyMkUk=s0"
        }/*,{
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
        }*/]);

    const objectToken = {};
    availableTokens.forEach(token => {
        objectToken[token.mint] = token;
    }); 

    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));
    async function getCurrentDCAAccounts(){
        if (fromAddress){
            const dca = new DCA(connection, Network.MAINNET);
            //console.log("governanceWallet "+fromAddress)
            const dcaAccounts = await dca.getCurrentByUser(new PublicKey(fromAddress));
            //console.log("dcaAccounts " + JSON.stringify(dcaAccounts));

            setCurrentDCAs(JSON.parse(JSON.stringify(dcaAccounts)));
        }
    }


    async function withdrawAndCloseDCAAccount(dcaWallet: string, dcaPubKey: string, inputMint: string, outputMint: string, withdrawInAmount: number, withdrawOutAmount: number){
       
        const transaction = new Transaction();
       
        //const tx1 = await withdrawDCA(dcaWallet, dcaPubKey, inputMint, outputMint, withdrawInAmount, withdrawOutAmount);
        const tx2 = await closeDCA(dcaWallet, dcaPubKey);

        //transaction.add(tx1);
        transaction.add(tx2);

        setTransactionInstructions(transaction);
        const description = "Withdraw from "+dcaWallet+" inputMint: "+inputMint+" outputMint: "+outputMint;

        setInstructionsObject({
            "type":`DCA`,
            "description":description,
            "governanceInstructions":transaction,
            "authorInstructions":null,
            "transactionEstimatedFee":transactionEstimatedFee,
        });

    }
    
    async function withdrawDCA(dcaWallet: string, dcaPubKey: string, inputMint: string, outputMint: string, withdrawInAmount: number, withdrawOutAmount: number) {
        // it's possible to withdraw in-tokens only or out-tokens only or both in and out tokens together. See WithdrawParams for more details
        console.log("inputMint: "+inputMint)
        
        const params: WithdrawParams = {
            user: new PublicKey(dcaWallet),
            dca: new PublicKey(dcaPubKey),
            inputMint: new PublicKey(inputMint),
            outputMint: null,
            withdrawInAmount: BigInt(withdrawInAmount),
            withdrawOutAmount: null,
        };
    
        const dca = new DCA(connection, Network.MAINNET);
        const { tx } = await dca.withdraw(params);
        return tx;
       // const txid = await sendAndConfirmTransaction(connection, tx, [user]);
    
        //console.log('Withdraw: ', { txid });
    }
    
    async function closeDCA(dcaWallet:string,dcaPubKey:string) {
        const params: CloseDCAParams = {
            user: new PublicKey(dcaWallet),
            dca: new PublicKey(dcaPubKey),
        };
    
        const dca = new DCA(connection, Network.MAINNET);
        const { tx } = await dca.closeDCA(params);

        return tx;
    
        //const txid = await sendAndConfirmTransaction(connection, tx, [user]);
    
        //console.log('Close DCA: ', { txid });
    }
    

    async function setupDCA() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWalletAddress = new PublicKey(fromAddress);
        const fromMintAddressPk = new PublicKey(tokenMint);
        const toMintAddressPk = new PublicKey(toMintAddress);
        const dca = new DCA(connection, Network.MAINNET);
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

        //const transaction = new Transaction();
        //const pTransaction = new Transaction();
        
        let integerTokenAmount = Math.floor(tokenAmount * Math.pow(10, fromDecimals));
        const inAmount = BigInt(integerTokenAmount);
        console.log("inAmount: "+inAmount);

        // second test:
        //let test = tokenAmount/10 ** decimals;
        //let testAmount = BigInt(test);
        //console.log("testAmount: "+testAmount);

        integerTokenAmount = Math.floor((tokenAmount * Math.pow(10, fromDecimals))/periodDuration);
        console.log("integerTokenAmount: "+integerTokenAmount);
        const inAmountPerCycle = BigInt(integerTokenAmount.toFixed(0));

        let biMinOutAmountPerCycle = null;
        if (minOutAmountPerCycle){
            integerTokenAmount = Math.floor(minOutAmountPerCycle * Math.pow(10, fromDecimals));
            biMinOutAmountPerCycle = BigInt(integerTokenAmount.toFixed(0));
        }

        let biMaxOutAmountPerCycle = null;
        if (biMaxOutAmountPerCycle){
            integerTokenAmount = Math.floor(maxOutAmountPerCycle * Math.pow(10, fromDecimals));
            biMaxOutAmountPerCycle = BigInt(integerTokenAmount.toFixed(0));
        }

        const params: CreateDCAParams = {
            user: fromWalletAddress,
            inAmount: inAmount, // buy a total of 5 USDC over 5 days
            inAmountPerCycle: BigInt(inAmountPerCycle), // buy using 1 USDC each day
            cycleSecondsApart: BigInt(period), // 1 day between each order -> 60 * 60 * 24
            inputMint: fromMintAddressPk, // sell
            outputMint: toMintAddressPk, // buy
            minOutAmountPerCycle: (minOutAmountPerCycle && minOutAmountPerCycle > 0) ? biMinOutAmountPerCycle : null,  // refer to Integration doc
            maxOutAmountPerCycle: (maxOutAmountPerCycle && maxOutAmountPerCycle > 0) ? biMaxOutAmountPerCycle : null, // refer to Integration doc
            startAt: null, // unix timestamp in seconds
            userInTokenAccount: null, // optional: if the inputMint token is not in an Associated Token Account but some other token account, pass in the PublicKey of the token account, otherwise, leave it undefined
          };
      
        const { tx, dcaPubKey } = await dca.createDCA(params);
        
        setTransactionInstructions(tx);
        // Estimate the transaction fee
            
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
                                        {shortenString('So11111111111111111111111111111111111111112',5,5)}
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
                                                            {shortenString(item.account.data.parsed.info.mint,5,5)}
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
              <InputLabel id="token-buy-select">To Buy</InputLabel>
              <Select
                labelId="token-buy-select"
                id="token-buy-select"
                value={toMintAddress}
                label="To Buy"
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
                                <Avatar alt={item.symbol} src={item.logo} />
                            </Grid>
                            <Grid item xs sx={{ml:1}}>
                                <Grid container
                                    direction="row"
                                    alignItems="center">
                                        <Grid item>
                                            <Typography variant="h6">
                                                {item.symbol}
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

    function PeriodSelect() {
      
        const handlePeriodChange = (event: SelectChangeEvent) => {
            setPeriod(event.target.value as string);
          
        };
      
        return (
          <Box sx={{ mt:1, ml:2 }}>
            <FormControl fullWidth>
              <InputLabel id="period-select">Every</InputLabel>
              <Select
                labelId="period-select"
                id="period-select"
                value={period}
                label="To Buy"
                onChange={handlePeriodChange}
              >
                <MenuItem value={60}>Minute</MenuItem>
                <MenuItem value={60*60}>Hour</MenuItem>
                <MenuItem value={60*60*24}>Day</MenuItem>
                <MenuItem value={60*60*26*7}>Week</MenuItem>
                <MenuItem value={60*60*26*31}>Month</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );
    }
    
    const handlePricingStrategyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPricingStrategy(event.target.checked);
      };

    function prepareAndReturnInstructions(){

        let description = "";

        if (toMintAddress){
            description = `Description - `;
            description +=  `Sell: ${tokenAmount} ${tokenMint} - `;
            description +=  `Buy: ${toMintAddress} - `;
            description +=  `Frequency: ${convertSecondsToLegibleFormat(period, true)} Cycles - `;
            description +=  `Duration: ${periodDuration} - `;
            description +=  `Amount p/cycle: ${(tokenAmount/periodDuration).toFixed(3)} ${tokenMint}`;
            if (pricingStrategy){
                if (minOutAmountPerCycle){
                    description +=  ` - Minumum Buy Mint Price per Cycle: ${minOutAmountPerCycle}`;
                }
                if (maxOutAmountPerCycle){
                    description +=  ` - Max Buy Mint Price per Cycle: ${maxOutAmountPerCycle}`;
                }
            }              
        }
        
        setInstructionsObject({
            "type":`DCA`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
    }

    async function getTokenList(){
        const uri = `https://token.jup.ag/strict`;
        
        return axios.get(uri, {
                headers: {
                //    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response?.data){
                    const tokenList = response.data;
                    console.log("tokenList: "+JSON.stringify(tokenList))
                    for (var item of tokenList){
                        // fix to push only what we have not already added
                        availableTokens.push({
                            mint:item.address,
                            name:item.name,
                            symbol:item.symbol,
                            decimals:item.decimals,
                            logo:item.logoURI
                        
                        });
                        //return response;
                    }
                }
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
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
        if (governanceWallet && !consolidatedGovernanceWallet){

            getAndUpdateWalletHoldings(governanceWallet?.vault?.pubkey || governanceWallet?.pubkey);
            getTokenList();
        }
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
                            <strong>Jupiter</strong> DCA Plugin
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
            
                {/*
                <FormControl fullWidth  sx={{mb:2}}>
                    <TextField 
                            fullWidth 
                            label="Set DCA To Mint Address" 
                            id="fullWidth"
                            //value={toAddress}
                            type="text"
                            onChange={(e) => {
                                setToMintAddress(e.target.value);
                            }}
                            disabled
                            sx={{borderRadius:'17px'}} 
                        />
                </FormControl>  
                    */}
                

                <ToBuySelect />  
                
                <Grid container direction="row" xs={12} spacing={1} sx={{mt:1}}>
                    <Grid sm={6}>
                        <PeriodSelect />  
                    </Grid>
                    <Grid sm={6}>
                        <FormControl fullWidth>
                            <TextField 
                                fullWidth 
                                label="Over" 
                                id="fullWidth"
                                type="text"
                                onChange={(e) => {
                                    setPeriodDuration(+e.target.value);
                                }}
                                InputProps={{
                                    endAdornment: <InputAdornment position="start">{period && convertSecondsToLegibleFormat(period, true)}</InputAdornment>,
                                }}
                                sx={{borderRadius:'17px'}} 
                            />
                        </FormControl> 
                        {(period && periodDuration) ?
                            <>
                            {((period*periodDuration > 31557600)) ?
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="caption" color="error">Up to 12m is supported during the beta phase</Typography>
                                </Grid>
                                :<></>
                            }
                            {(periodDuration > 0 && periodDuration < 1) ?
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="caption" color="error">At least 1 cycles are needed</Typography>
                                </Grid>
                                :<></>
                            }
                            </>
                            :<></>
                        }
                    </Grid>  
                </Grid>
                
                <FormControl fullWidth>
                    <FormGroup>
                        <FormControlLabel
                        control={
                            <Switch onChange={handlePricingStrategyChange} name="pricing_strategy" />
                        }
                        label={
                            <>
                            Custom Pricing Rules
                                <Typography variant="caption"><br/>Will execute only when the market price is within the desired Minimum and Maximum Price range</Typography>
                            </>}
                        />
                    </FormGroup>
                </FormControl>
                
                {pricingStrategy &&
                    <Grid container direction="row" xs={12} sx={{mt:1}} spacing={1} >
                        <Grid sm={6}>
                            <FormControl fullWidth>
                                <TextField 
                                    label="Min Price Per Cycle" 
                                    //value={toAddress}
                                    type="text"
                                    onChange={(e) => {
                                        setMinOutAmountPerCycle(+e.target.value);
                                    }}
                                    sx={{borderRadius:'17px'}} 
                                    InputProps={{
                                        endAdornment: <InputAdornment position="start">{(toMintAddress && objectToken[toMintAddress]) ? objectToken[toMintAddress].name : toMintAddress}  <VerticalAlignBottomIcon /></InputAdornment>,
                                    }}
                                />
                            </FormControl>   
                        </Grid>
                        <Grid sm={6}>
                            <FormControl fullWidth >
                                <TextField 
                                    label="Max Price Per Cycle" 
                                    //value={toAddress}
                                    type="text"
                                    onChange={(e) => {
                                        setMaxOutAmountPerCycle(+e.target.value);
                                    }}
                                    sx={{borderRadius:'17px'}} 
                                    InputProps={{
                                        endAdornment: <InputAdornment position="start">{(toMintAddress && objectToken[toMintAddress]) ? objectToken[toMintAddress].name : toMintAddress} <VerticalAlignTopIcon /></InputAdornment>,
                                    }}
                                />
                            </FormControl> 
                        </Grid>  
                    </Grid>
                }
                
                {(tokenAmount && toMintAddress && tokenMint && periodDuration && period) ?
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
                            <strong>Time Swap Description</strong>
                            <br/>
                            Sell: {tokenAmount} {objectToken[tokenMint] ? objectToken[tokenMint].name : tokenMint}<br/>
                            Buy: {objectToken[toMintAddress] ? objectToken[toMintAddress].name : toMintAddress}<br/>
                            Frequency: {convertSecondsToLegibleFormat(period, true)}<br/>
                            Over: {periodDuration}<br/>
                            Amount per cycle: {(tokenAmount/periodDuration).toFixed(3)} {objectToken[tokenMint] ? objectToken[tokenMint].name : tokenMint}<br/>
                            {pricingStrategy &&
                                <>
                                    {minOutAmountPerCycle &&
                                        <>Minumum Buy Mint Price per Cycle: {minOutAmountPerCycle} {objectToken[tokenMint] ? objectToken[tokenMint].name : tokenMint}<br/></>
                                    }
                                    {maxOutAmountPerCycle &&
                                        <>Max Buy Mint Price per Cycle: {maxOutAmountPerCycle} {objectToken[tokenMint] ? objectToken[tokenMint].name : tokenMint}<br/></>
                                    }
                                </>
                            }
                            Ends in : {convertSecondsToLegibleFormat((period*periodDuration).toFixed(0), false, periodDuration)} from proposal execution<br/>
                            </Typography>
                        </Box>
                        
                    </>
                :
                    <></>
                }

                <Grid sx={{textAlign:'right', mb:2}}>
                        
                        <Button 
                            disabled={(!(
                                (tokenAmount && toMintAddress && tokenMint && periodDuration && period)
                            ) || (period <= 1) || (period*periodDuration > 31557600)) && !loadingInstructions
                            }
                            onClick={setupDCA}
                            variant="contained"
                            color="info"
                            sx={{borderRadius:'17px'}}>
                            {loadingInstructions ? 
                                <><CircularProgress sx={{padding:'10px'}} /> Preparing Instructions</>
                                :
                                <>
                                Preview Instructions</>
                            }</Button>
                            
                </Grid>

                {transactionInstructions && 
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
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

            <Grid sx={{textAlign:'right',mt:2}}>
                <Button 
                    size="small"
                    onClick={getCurrentDCAAccounts}
                    variant="contained"
                    color="warning"
                    sx={{borderRadius:'17px'}}>
                    Active Orders</Button>
            </Grid>

                {(currentDCAs && currentDCAs.length > 0) ?
                    <>  
                        <Box
                            sx={{ m:1,
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '17px',
                                overflow: 'hidden',
                                p:1
                            }}
                        >
                            <Typography variant="h6">Current DCA / Scheduled Swaps for this Governance Wallet</Typography>
                            <Typography variant="caption">
                                <List sx={{ width: '100%' }}>
                                    {currentDCAs.map((item: any, key: number) => {
                                        return (
                                            <ListItem alignItems="flex-start">
                                                <ListItemAvatar>
                                                    <Avatar alt={item.publicKey}><CodeIcon /></Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={`Account: ${item.publicKey}`}
                                                    secondary={
                                                        <React.Fragment>
                                                            <Typography
                                                                sx={{ display: 'inline' }}
                                                                component="span"
                                                                variant="body2"
                                                                color="text.primary"
                                                            >
                                                                Selling: {objectToken[item.account.inputMint] ? objectToken[item.account.inputMint].name : item.account.inputMint}<br/>
                                                                Buying: {objectToken[item.account.outputMint] ? objectToken[item.account.outputMint].name : item.account.outputMint}<br/>
                                                            </Typography>
                                                            <br/>
                                                            <Typography variant="caption">
                                                                Created: {moment.unix(parseInt(item.account.createdAt,16)).toLocaleString()}<br/>
                                                                {objectToken[item.account.inputMint] ?
                                                                    <>
                                                                        Deposited: {parseInt(item.account.inDeposited,16)  / 10 ** objectToken[item.account.inputMint].decimals} {objectToken[item.account.inputMint] ? objectToken[item.account.inputMint].name : item.account.inputMint}<br/>
                                                                        Next Cycle: {parseInt(item.account.nextCycleAmountLeft,16) / 10 ** objectToken[item.account.inputMint].decimals} {objectToken[item.account.inputMint] ? objectToken[item.account.inputMint].name : ''} at {moment.unix(parseInt(item.account.nextCycleAt,16)).toLocaleString()}<br/>
                                                                    </>
                                                                :
                                                                    <>
                                                                        Deposited: {parseInt(item.account.inDeposited,16)}<br/>
                                                                        Next Cycle: {parseInt(item.account.nextCycleAmountLeft,16)} {item.account.inputMint} at {moment.unix(parseInt(item.account.nextCycleAt,16)).toLocaleString()}<br/>
                                                                        
                                                                    </>
                                                                }
                                                                Cycle: {convertSecondsToLegibleFormat(parseInt(item.account.cycleFrequency,16).toString())}<br/>
                                                                
                                                                {objectToken[item.account.outputMint] ?
                                                                    <>
                                                                        Withdrawn: {parseInt(item.account.outWithdrawn,16) / 10 ** objectToken[item.account.outputMint].decimals}<br/>
                                                                        Received: {parseInt(item.account.outReceived,16) / 10 ** objectToken[item.account.outputMint].decimals}<br/>
                                                                    </>
                                                                :
                                                                    <>
                                                                        Withdrawn: {parseInt(item.account.outWithdrawn,16)}<br/>
                                                                        Received: {parseInt(item.account.outReceived,16)}<br/>
                                                                    </>
                                                                }
                                                                
                                                            </Typography>
                                                            
                                                            <Button 
                                                                onClick={e => withdrawAndCloseDCAAccount(item.account.user, item.publicKey, item.account.inputMint, item.account.outputMint, 0, parseInt(item.account.nextCycleAmountLeft,16))}
                                                                size="small"
                                                                variant="contained"
                                                                color="error"
                                                                sx={{borderRadius:'17px',mt:1}}>
                                                                Withdraw & Close Account</Button>
                                                        </React.Fragment>
                                                    }
                                                    />
                                            </ListItem>
                                        );
                                    })}
                                </List>
                                {/*JSON.stringify(currentDCAs)*/}
                            </Typography>
                        </Box>
                        
                    </>
                :
                    <></>
                }

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Jupiter DCA Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}