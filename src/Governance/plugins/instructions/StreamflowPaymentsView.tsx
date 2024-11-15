import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import moment from "moment";

import * as Phoenix from "@ellipsis-labs/phoenix-sdk";

import { getJupiterPrices, convertSecondsToLegibleFormat } from '../../../utils/grapeTools/helpers';

import { 
    RPC_CONNECTION,
    RPC_ENDPOINT } from '../../../utils/grapeTools/constants';
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

import {
    GenericStreamClient,
    StreamflowSolana,
    Types,
} from "@streamflow/stream";

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

export default function StreamflowPaymentsView(props: any) {
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
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    
    const [canTopup, setCanTopup] = React.useState(false);
    const [cancelableBySender, setCancelableBySender] = React.useState(true);
    const [cancelableByRecipient, setCancelableByRecipient] = React.useState(true);
    const [transferableBySender, setTransferableBySender] = React.useState(true);
    const [transferableByRecipient, setTransferableByRecipient] = React.useState(true);
    const [automaticWithdrawal, setAutomaticWithdrawal] = React.useState(false);
    
    
    const connection = RPC_CONNECTION;
    
    const solanaClient = new StreamflowSolana.SolanaStreamClient(
        RPC_ENDPOINT
    );
    
    async function setupStreamingPayment() {
        
        const client = new GenericStreamClient<Types.IChain.Solana>({
            chain: Types.IChain.Solana, // Blockchain
            clusterUrl: RPC_ENDPOINT, // RPC cluster URL
            cluster: Types.ICluster.Mainnet, // (optional) (default: Mainnet)
            // ...rest chain specific params e.g. commitment for Solana
        });

        const fromWalletAddress = new PublicKey(fromAddress);
        let toDecimals = 6;

        let integerTokenAmount = Math.floor(tokenAmount * Math.pow(10, tokenDecimals));
        const inAmount = BigInt(integerTokenAmount);
        console.log("inAmount: "+inAmount);
        const fromMintAddressPk = new PublicKey(tokenMint);

        const recipients = [
            {
              recipient: "5Kxv3BwaL4xnRsqBWzgFy91YgUJuAUGb98DBGDedzNh9", // Solana recipient address.
              amount: 100 / 9 % 10, //getBN(100, 9), // depositing 100 tokens with 9 decimals mint.
              name: "Testing Streamflow plugin with Governance.so", // The stream name/subject.
              cliffAmount: 10 / 9 % 10, //getBN(10, 9), // amount released on cliff for this recipient
              amountPerPeriod: 1 / 9 % 10, //getBN(1, 9), //amount released every specified period epoch
            },
        ];
        /*
        const createStreamParams: Types.ICreateMultipleStreamData = {
            recipients: recipients, // Solana recipient address.
            tokenId: fromMintAddressPk.toBase58(), // SPL Token mint.
            start: 1643363040, // Timestamp (in seconds) when the stream/token vesting starts.
            period: 1, // Time step (period) in seconds per which the unlocking occurs.
            cliff: 1643363160, // Vesting contract "cliff" timestamp in seconds.
            canTopup: canTopup, // setting to FALSE will effectively create a vesting contract.
            cancelableBySender: cancelableBySender, // Whether or not sender can cancel the stream.
            cancelableByRecipient: cancelableByRecipient, // Whether or not recipient can cancel the stream.
            transferableBySender: transferableBySender, // Whether or not sender can transfer the stream.
            transferableByRecipient: transferableByRecipient, // Whether or not recipient can transfer the stream.
            automaticWithdrawal: automaticWithdrawal, // Whether or not a 3rd party (e.g. cron job, "cranker") can initiate a token withdraw/transfer.
            withdrawalFrequency: 10, // Relevant when automatic withdrawal is enabled. If greater than 0 our withdrawor will take care of withdrawals. If equal to 0 our withdrawor will skip, but everyone else can initiate withdrawals.
            partner: null, //  (optional) Partner's wallet address (string | null).
        };

        const solanaParams = {
            sender: fromWalletAddress, // SignerWalletAdapter or Keypair of Sender account
            //isNative: // [optional] [WILL CREATE A wSOL STREAM] Wether Stream or Vesting should be paid with Solana native token or not
        }

        try {
            const { txs } = await client.createMultiple(createStreamParams);
            // get serialized transactions for the swap
            setTransactionInstructions(txs);
        } catch (exception) {
        // handle exception
        }
        */

        /*
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
        */
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
                <MenuItem value={1}>Second</MenuItem>
                <MenuItem value={60}>Minute</MenuItem>
                <MenuItem value={60*60}>Hour</MenuItem>
                <MenuItem value={60*60*24}>Day</MenuItem>
                <MenuItem value={60*60*26*7}>Week</MenuItem>
                <MenuItem value={60*60*26*31}>Month</MenuItem>
                <MenuItem value={60*60*26*31*12}>Yearly</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );
    }

    React.useEffect(() => {
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
                            <Avatar alt={'Streamflow'} src={'https://app.streamflow.finance/static/media/streamflow-logo.554485a98857a4b75f31ebf5496d4267.svg'} />
                        </Grid>
                        <Grid item xs sx={{ml:1}}>
                            <strong>Streamflow</strong> Payments Plugin
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

            <FormControl fullWidth  sx={{mb:2}}>

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
                            {((period*periodDuration > (31557600*3))) ?
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="caption" color="error">Up to 36m is supported during the beta phase</Typography>
                                </Grid>
                                :<></>
                            }
                            {(periodDuration > 0 && periodDuration < 1) ?
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="caption" color="error">At least 1 cycles are needed, for a single cycle consider using the Token Transfer plugin</Typography>
                                </Grid>
                                :<></>
                            }
                            </>
                            :<></>
                        }
                    </Grid>  
                </Grid>

            </FormControl>
                
                
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
                            <strong>Payments</strong>
                            <br/>
                            {/*
                            From: {tokenAmount} {objectToken[tokenMint] ? objectToken[tokenMint].name : tokenMint}<br/>
                            To: {objectToken[toMintAddress] ? objectToken[toMintAddress].name : toMintAddress}<br/>
                            */}
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
                        onClick={setupStreamingPayment}
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Streamflow Payments Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}