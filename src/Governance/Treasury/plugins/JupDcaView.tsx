import { AnchorProvider, web3 } from '@coral-xyz/anchor';
import { 
    Signer, 
    Connection, 
    PublicKey, 
    SystemProgram,
    TransactionMessage, 
    Transaction, 
    VersionedTransaction, 
    TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getOrCreateAssociatedTokenAccount, createAssociatedTokenAccount, createTransferInstruction } from "@solana/spl-token-v2";
import moment from "moment";
import axios from "axios";
import { CloseDCAParams, CreateDCAParams, DCA, type DepositParams, type WithdrawParams, Network } from '@jup-ag/dca-sdk';

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../../utils/grapeTools/constants';

import { 
    shortenString, 
    getJupiterPrices, 
    convertSecondsToLegibleFormat } from '../../../utils/grapeTools/helpers';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';

import {
    Avatar,
    Chip,
    Typography,
    Button,
    Grid,
    Box,
    Table,
    Tooltip,
    LinearProgress,
    DialogTitle,
    Dialog,
    DialogContent,
    DialogContentText,
    DialogActions,
    MenuItem,
    TextField,
    Stack,
    Switch,
    FormControl,
    FormControlLabel,
    InputAdornment,
    InputLabel,
    Select,
    List,
    ListItem,
    ListItemIcon,
    ListItemAvatar,
    ListItemText,
    SelectChangeEvent,
    FormGroup,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import CodeIcon from '@mui/icons-material/Code';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SendIcon from '@mui/icons-material/Send';
import SettingsIcon from '@mui/icons-material/Settings';
import GetAppIcon from '@mui/icons-material/GetApp';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

import AdvancedProposalView from './AdvancedProposalView';

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}
  
const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
    
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

export default function JupDcaExtensionView(props: any){
    const setReload = props?.setReload;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const governingTokenMint = props.governingTokenMint;
    const [editProposalAddress, setEditProposalAddress] = React.useState(props?.editProposalAddress);

    const preSelectedTokenAta = props?.preSelectedTokenAta;
    const useButtonText = props?.useButtonText;
    const useButtonType = props?.useButtonType;

    const masterWallet = props?.masterWallet;
    const usdcValue = props?.usdcValue;
    const realm = props?.realm;
    const governanceAddress = props.governanceAddress || realm.pubkey.toBase58();
    const rulesWallet = props?.rulesWallet;
    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const instructions = props?.instructions;
    const setInstructions = props?.setInstructions;

    const governanceNativeWallet = props?.governanceNativeWallet;
    const { publicKey } = useWallet();
    const wallet = useWallet();

    const [loading, setLoading] = React.useState(false);
    const [open, setPropOpen] = React.useState(false);
    const [openAdvanced, setOpenAdvanced] = React.useState(false);
    const [proposalTitle, setProposalTitle] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [governingMint, setGoverningMint] = React.useState(null);
    const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
    const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
    const [isDraft, setIsDraft] = React.useState(false);
    const [tokenSelected, setTokenSelected] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(null);
    const [tokenRecipient, setTokenRecipient] = React.useState(null);
    const [availableTokens, setAvailableTokens] = React.useState(null);

    const [toMintAddress, setToMintAddress] = React.useState(null);
    const [period, setPeriod] = React.useState(null);
    const [periodDuration, setPeriodDuration] = React.useState(2);
    const [minOutAmountPerCycle, setMinOutAmountPerCycle] = React.useState(null);
    const [maxOutAmountPerCycle, setMaxOutAmountPerCycle] = React.useState(null);
    const [pricingStrategy, setPricingStrategy] = React.useState(false);
    const [currentBuyPrice, setCurrentBuyPrice] = React.useState(null);
    const [currentDCAs, setCurrentDCAs] = React.useState([]);
    const [showCurrentDCAs, setShowCurrentDCAs] = React.useState(false);

    const [expanded, setExpanded] = React.useState<string | false>(false);
    
    const provider = new AnchorProvider(RPC_CONNECTION, wallet, {
        commitment: 'confirmed',
    });

    const solItem = {
        address:"So11111111111111111111111111111111111111112",
        associated_account:"So11111111111111111111111111111111111111112",
        balance:masterWallet?.nativeSol,
        info:{
            decimals:9,
            symbol:"SOL",
            name:"Solana",
            image: `https://solana-cdn.com/cdn-cgi/image/width=100/https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png`
        },
    }
    
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const toggleGoverningMintSelected = (council: boolean) => {
        if (council){
            setIsGoverningMintCouncilSelected(true);
            setGoverningMint(realm?.account.config.councilMint);
        } else{
            setIsGoverningMintCouncilSelected(false);
            setGoverningMint(realm?.communityMint);
        }
    }

    const handleAdvancedToggle = () => {
        setOpenAdvanced(!openAdvanced);
    }

    const handleCloseDialog = () => {
        setPropOpen(false);
        if (handleCloseExtMenu)
            handleCloseExtMenu();
    }

    const handleClickOpen = () => {
        setPropOpen(true);
    };

    const handleClose = () => {
        setPropOpen(false);
        if (handleCloseExtMenu)
            handleCloseExtMenu();
    };

    // Helper function to split instructions into chunks
    const chunkInstructions = (instructions: TransactionInstruction[], chunkSize: number) => {
        const chunks = [];
        for (let i = 0; i < instructions.length; i += chunkSize) {
            chunks.push(instructions.slice(i, i + chunkSize));
        }
        return chunks;
    };

    const simulateIx = async (transaction: Transaction): Promise<boolean> => {
        try {
            const { blockhash } = await RPC_CONNECTION.getLatestBlockhash();
            const payerKey = new PublicKey(governanceNativeWallet);
            const transactionIxs: TransactionInstruction[] = transaction.instructions;

            for (const instructionChunk of chunkInstructions(transactionIxs, 10)) { // Adjust chunk size as needed
                const message = new TransactionMessage({
                    payerKey,
                    recentBlockhash: blockhash,
                    instructions: instructionChunk,
                }).compileToV0Message();
    
                const transaction = new VersionedTransaction(message);
    
                // Simulate the chunk
                const simulationResult = await RPC_CONNECTION.simulateTransaction(transaction);
                //setSimulationResults(simulationResult.value.logs);
    
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

    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));
    async function getCurrentDCAAccounts(){
        if (governanceNativeWallet){
            const dca = new DCA(RPC_CONNECTION, Network.MAINNET);
            //console.log("governanceWallet "+fromAddress)
            const dcaAccounts = await dca.getCurrentByUser(new PublicKey(governanceNativeWallet));
            //console.log("dcaAccounts " + JSON.stringify(dcaAccounts));
            setCurrentDCAs(JSON.parse(JSON.stringify(dcaAccounts)));
            setShowCurrentDCAs(!showCurrentDCAs);
        }
    }

    
    async function withdrawAndCloseDCAAccount(dcaWallet: string, dcaPubKey: string, inputMint: string, outputMint: string, withdrawInAmount: number, withdrawOutAmount: number){
       
        const transaction = new Transaction();
       
        //const tx1 = await withdrawDCA(dcaWallet, dcaPubKey, inputMint, outputMint, withdrawInAmount, withdrawOutAmount);
        const tx2 = await closeDCA(dcaWallet, dcaPubKey);

        //transaction.add(tx1);
        transaction.add(tx2);


        const ixs = transaction; //await distributor.claimToken(new PublicKey(governanceNativeWallet));
        const aixs = new Transaction();

        //const ixts: TransactionInstruction[] = [];
        
        if (ixs || aixs){

            const description = "Withdraw from "+dcaWallet+" inputMint: "+inputMint+" outputMint: "+outputMint;
            const propIx = {
                title:"Close DCA",
                description:description,
                ix:ixs.instructions,
                aix:aixs?.instructions,
                nativeWallet:governanceNativeWallet,
                governingMint:governingMint,
                draft:isDraft,
                editProposalAddress: editProposalAddress,
            }

            //console.log("ixs: "+JSON.stringify(ixs))
            console.log("propIx: "+JSON.stringify(propIx))

            // simulate?
            const status =  await simulateIx(ixs);
            
            setInstructions(propIx);
            setExpandedLoader(true);
        }

        /*
        setTransactionInstructions(transaction);
        const description = "Withdraw from "+dcaWallet+" inputMint: "+inputMint+" outputMint: "+outputMint;

        setInstructionsObject({
            "type":`DCA`,
            "description":description,
            "governanceInstructions":transaction,
            "authorInstructions":null,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
        */

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
    
        const dca = new DCA(RPC_CONNECTION, Network.MAINNET);
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
    
        const dca = new DCA(RPC_CONNECTION, Network.MAINNET);
        const { tx } = await dca.closeDCA(params);

        return tx;
    
        //const txid = await sendAndConfirmTransaction(connection, tx, [user]);
    
        //console.log('Close DCA: ', { txid });
    }

    const handleProposalIx = async() => {
        if (handleCloseExtMenu)
            handleCloseExtMenu();
        setPropOpen(false);

        const tokenMint = tokenSelected.address;
        const tokenAta = tokenSelected.associated_account;
        //const transaction = new Transaction();
        const pTransaction = new Transaction();
        const fromWallet = new PublicKey(governanceNativeWallet);

        const fromMintAddressPk = new PublicKey(tokenMint);
        const toMintAddressPk = new PublicKey(toMintAddress);
        const dca = new DCA(RPC_CONNECTION, Network.MAINNET);
        let toDecimals = 6;
        let fromDecimals = tokenSelected?.decimals || toDecimals;

        for (var item of availableTokens){
            if (item.mint === toMintAddress)
                toDecimals = item.decimals;
            if (item.mint === tokenMint)
                fromDecimals = item.decimals
        }

        /*
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
        }*/

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
            user: fromWallet,
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
      
        console.log("params:", JSON.stringify(params, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        ));

        const { tx, dcaPubKey } = await dca.createDCA(params);


        const ixs = tx; //await distributor.claimToken(new PublicKey(governanceNativeWallet));
        const aixs = pTransaction;

        //const ixts: TransactionInstruction[] = [];
        
        if (ixs || aixs){

            const propIx = {
                title:proposalTitle,
                description:proposalDescription,
                ix:ixs.instructions,
                aix:aixs?.instructions,
                nativeWallet:governanceNativeWallet,
                governingMint:governingMint,
                draft:isDraft,
                editProposalAddress: editProposalAddress,
            }

            //console.log("ixs: "+JSON.stringify(ixs))
            console.log("propIx: "+JSON.stringify(propIx))

            // simulate?
            const status =  await simulateIx(ixs);


            setInstructions(propIx);
            setExpandedLoader(true);
        }

        
    }

    const RenderTokenItem = (props: any) => {
        const item = props?.item;
        const key = props?.key;
        const sol = props?.sol;
        
        return (
            <ListItem
                secondaryAction={
                    <Box sx={{textAlign:'right'}}>
                        <Box>
                            {item.balance?.toLocaleString()}
                        </Box>
                        <Typography variant="caption" sx={{color:'#919EAB'}}>
                        {usdcValue ? 
                            <>{usdcValue[item.address] ? 
                                <>${((item.balance * usdcValue[item.address]?.price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))}</>
                                :<></>
                            }</>
                        :<></>}</Typography>
                    </Box>
                }
                key={key}
            >
                <ListItemAvatar>
                    <Avatar
                        src={item?.info?.image}
                    >
                    </Avatar>
                </ListItemAvatar>
                <ListItemText 
                    primary={
                        
                        <Typography variant="subtitle1" sx={{color:'white'}}>{sol ? `Solana` : item?.info?.name}</Typography>
                            
                    }
                    secondary={
                        <>
                            <Typography variant="caption">
                                {usdcValue ? (
                                    <>
                                    {usdcValue[item?.address] && usdcValue[item?.address]?.price ? (
                                        <>${Number(usdcValue[item?.address]?.price)?.toFixed(4)}</>
                                    ) : (
                                        <>Price not available</> // Handle undefined or invalid price gracefully
                                    )}
                                    </>
                                ) : (
                                    <>Loading...</> // Handle case where `usdcValue` is not available
                                )}
                                </Typography>
                                
                            {/*
                            <Typography variant="caption">ATA {shortenString(item.associated_account,5,5)}</Typography>
                            */}
                        </>
                    }
                    />
            </ListItem>

        );
    }

    const RenderTokenSelected = (props: any) => {
        const ata = props.ata;
        const [thisTokenSelected, setThisTokenSelected] = React.useState(null);
        //const [found, setFound] = React.useState(false);

        React.useEffect(() => { 
            
            if (ata && masterWallet){
                
            }
            
            
        }, [ata, masterWallet, thisTokenSelected, tokenSelected]);

        
        return (

            <>
                {tokenSelected ?
                    <ListItem sx={{m:0,mr:1,p:0,pr:1}}>
                        <ListItemAvatar sx={{m:0,p:0}}>
                            <Avatar
                                src={tokenSelected.info.image}
                                alt={tokenSelected.info.name}
                                sx={{ width: 24, height: 24 }}
                            />
                        </ListItemAvatar>
                        <ListItemText sx={{m:0,p:0,ml:1}}
                            primary={tokenSelected.info.name}
                        />
                    </ListItem>
                :
                    <>{ata}</>
                }
                
            </>

        );
    }

    const adjustTokenAmount = (amountFixed?:number,amountPercent?:number) => {
        if (amountPercent){
            if (amountPercent > 0){
                if (tokenSelected.balance > 0){
                    setTokenAmount(tokenSelected.balance * amountPercent)
                }
            }
        }
    }

    const handleSetTokenAmount = (amount:string) => {
        if (amount){
            setTokenAmount(+amount);
        } else {
            setTokenAmount(0);
        }
    }
    
    React.useEffect(() => { 
        setIsGoverningMintSelectable(false);
        if (realm && realm?.account.config?.councilMint){
            setGoverningMint(realm?.account.config.councilMint);
            setIsGoverningMintCouncilSelected(true);
            if (realm && realm?.account?.communityMint){
                if (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615){
                    setGoverningMint(realm?.account.communityMint);
                    setIsGoverningMintSelectable(true);
                    setIsGoverningMintCouncilSelected(false);
                }
            }
        } else {
            if (realm && realm?.account?.communityMint){
                setGoverningMint(realm?.account.communityMint);
                setIsGoverningMintCouncilSelected(false);
            }
        }
        if (!availableTokens){
            getTokenList();
        }

    }, []);

    function generateInstructions(){
        if (tokenSelected && toMintAddress && period && periodDuration){
            if (tokenAmount && tokenAmount > 0){
                const title = "Swap "+tokenSelected.info.name
                setProposalTitle(title);
                const description = "Swapping "+tokenAmount.toLocaleString()+" "+tokenSelected.info.name+" to "+shortenString(toMintAddress,5,5)+" ("+period+"s x "+periodDuration+")";
                setProposalDescription(description);
            }
        }
    }

    React.useEffect(() => { 
        if (tokenSelected && toMintAddress && period && periodDuration){
            if (tokenAmount && tokenAmount > 0){
                generateInstructions();
                //setOpenAdvanced(true);

            }
        } else {
            setOpenAdvanced(false);
        }
    }, [tokenSelected, tokenAmount, toMintAddress, period, periodDuration]);
    
    React.useEffect(() => { 
        if (preSelectedTokenAta && masterWallet){
            var found = false;
            
            if (preSelectedTokenAta === 'So11111111111111111111111111111111111111112'){
                setTokenSelected(solItem);
                found = true;
            }
            if (!found && masterWallet?.nativeTokens && masterWallet.nativeTokens.length > 0){
                for (var item of masterWallet.nativeTokens){
                    if (item.associated_account === preSelectedTokenAta){
                        setTokenSelected(item);
                        found = true;
                        console.log("FOUND TOKEN and SET")
                    }
                }
            }
            if (!found && masterWallet?.rulesTokens && masterWallet.rulesTokens.length > 0){
                for (var item of masterWallet.rulesTokens){
                    if (item.associated_account === preSelectedTokenAta){
                        setTokenSelected(item);
                    }
                }
            }

        }
    }, [preSelectedTokenAta, masterWallet]);

    const handleSelectChange = (event: any) => {
        const tata = event.target.value;
        if (masterWallet){
            var found = false;
            
            if (tata === 'So11111111111111111111111111111111111111112'){
                setTokenSelected(solItem);
                found = true;
            }
            if (!found && masterWallet?.nativeTokens && masterWallet.nativeTokens.length > 0){
                for (var item of masterWallet.nativeTokens){
                    if (item.associated_account === tata){
                        setTokenSelected(item);
                        found = true;
                    }
                }
            }
            if (!found && masterWallet?.rulesTokens && masterWallet.rulesTokens.length > 0){
                for (var item of masterWallet.rulesTokens){
                    if (item.associated_account === tata){
                        setTokenSelected(item);
                    }
                }
            }

        }
    }

    function PeriodSelect() {
      
        const handlePeriodChange = (event: SelectChangeEvent) => {
            setPeriod(event.target.value as string);
          
        };
      
        return (
          
            <FormControl fullWidth>
              <InputLabel id="period-select">Every</InputLabel>
              <Select
                labelId="period-select"
                id="period-select"
                value={period}
                label="To Buy"
                onChange={handlePeriodChange}
                variant="filled"
                sx={{ m: 0.65 }}
              >
                <MenuItem value={60}>Minute</MenuItem>
                <MenuItem value={60*60}>Hour</MenuItem>
                <MenuItem value={60*60*24}>Day</MenuItem>
                <MenuItem value={60*60*26*7}>Week</MenuItem>
                <MenuItem value={60*60*26*31}>Month</MenuItem>
              </Select>
            </FormControl>
          
        );
    }
    
    const handlePricingStrategyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPricingStrategy(event.target.checked);
    };


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
                    let normalizedTokenList = new Array();
                    for (var item of tokenList){
                        // fix to push only what we have not already added
                        normalizedTokenList.push({
                            mint:item.address,
                            name:item.name,
                            symbol:item.symbol,
                            decimals:item.decimals,
                            logo:item.logoURI
                        
                        });
                        //return response;
                    }
                    setAvailableTokens(normalizedTokenList);
                }
 
                //console.log("availableTokens: "+JSON.stringify(availableTokens));
                return null
            })
            .catch(error => 
                {   
                    // revert to RPC
                    console.error(error);
                    return null;
                });
    }
    /*
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
    }); */
    
    const objectToken = {};

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
            
            
            const cgp = await getJupiterPrices([tokenSelected],toMintAddress);
            if (cgp[tokenSelected]?.price)
                setCurrentBuyPrice(cgp[tokenSelected].price);
            
        }

        React.useEffect(() => {
            if (availableTokens && availableTokens.length > 0){
                availableTokens.forEach(token => {
                    objectToken[token.mint] = token;
                }); 
            }
        }, [availableTokens]);

        React.useEffect(() => { 
            if (toMintAddress)
                getTokenPrice();
            

        }, [toMintAddress]);
            if (toMintAddress){
                
                // set currentBuyPrice
                // 
            }
      
        return (
          <>
            <FormControl fullWidth  sx={{mt:2,mb:2}}>
              <InputLabel id="token-buy-select">To</InputLabel>
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
                variant="filled"
                sx={{ m: 0.65 }}
              >
                {availableTokens && availableTokens.map((item: any, key: number) => {
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
          </>
        );
    }

    return (
        <>
            
            <Tooltip title="SWAP" placement="right">
                {useButtonText && useButtonType === 1 ?
                <>
                    <Button onClick={publicKey && handleClickOpen} fullWidth color='primary' size="large" variant="contained" sx={{backgroundColor:'rgba(255,255,255,0.05)',pl:2,pr:2,ml:1,mr:1}}>{useButtonText}</Button>
                </>
                :
                <>
                    {useButtonText && (useButtonType === 2 || useButtonType === 3) ? 
                        <>  
                            <Button color={'inherit'} variant='text' 
                                onClick={publicKey && handleClickOpen} 
                                sx={{m:0,p:0,
                                    '&:hover .MuiSvgIcon-root': {
                                        opacity: 1,
                                    },
                                }}
                                startIcon={
                                    <AccessTimeIcon 
                                        fontSize={'small'} 
                                        sx={{
                                            color:'rgba(255,255,255,0.25)',
                                            opacity: 0,
                                            pl:1,
                                            fontSize:"10px"}} />
                                }>
                                <Typography variant={useButtonType === 2 ? `h5`:`subtitle1`} sx={{color:'white'}}>
                                    {useButtonText}
                                </Typography>
                            </Button>
                        </>
                    :
                        <>
                            <MenuItem onClick={publicKey && handleClickOpen}>
                                <ListItemIcon>
                                    <AccessTimeIcon fontSize="small" />
                                </ListItemIcon>
                                DCA
                            </MenuItem>
                        </>
                    }
                </>}
            </Tooltip>
            
            <BootstrapDialog 
                //maxWidth={"xl"}
                fullWidth={true}
                open={open} onClose={handleClose}
                PaperProps={{
                    style: {
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px'
                    }
                    }}
                >
                <BootstrapDialogTitle 
                    id='extensions-dialog'
                    onClose={handleCloseDialog}
                >
                    DCA/Swap Extension
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <DialogContentText sx={{textAlign:'center'}}>
                        DCA / Scheduled Swap
                    </DialogContentText>
                    
                    <FormControl fullWidth  sx={{mt:2,mb:2}}>
                        
                        {tokenSelected ?
                            <Grid container direction='row' sx={{pl:2,pr:1}}>
                                <Grid item xs>
                                    <Typography variant='caption' sx={{color:'#919EAB'}}>
                                    You're swappping
                                    </Typography>
                                </Grid>
                                <Grid item>
                                    <Typography variant='caption' sx={{color:'#919EAB'}}>
                                        <>
                                            <Chip size="small" icon={<AccountBalanceWalletIcon sx={{ fontSize: 6 }} color='inherit' />} 
                                                label={(+tokenSelected.balance).toLocaleString()} 
                                                variant="outlined" 
                                                sx={{mr:1,border:'none;',color:'#919EAB'}} />
                                            <Chip 
                                                onClick={() => adjustTokenAmount(null,0.5)}
                                                label="Half" variant="outlined" size="small" sx={{mr:1,borderColor:'#919EAB',color:'#919EAB'}} />
                                            <Chip
                                                onClick={() => adjustTokenAmount(null,1)}
                                                label="Max" variant="outlined" size="small" sx={{borderColor:'#919EAB',color:'#919EAB'}}/>
                                        </>
                                        
                                    </Typography>
                                </Grid>
                            </Grid>
                        :
                        <></>
                        }
                        
                        <TextField
                            //label="With normal TextField"
                            id="token-amount"
                            variant="filled"
                            sx={{ p: 1, height:'none;', fontSize:'16px' }}
                            value={tokenAmount}
                            onChange={(e) => handleSetTokenAmount(e.target.value)}
                            InputProps={{
                                startAdornment: 
                                <InputAdornment position="start" sx={{ maxWidth:'50%',height:'none' }}>
                                    <FormControl sx={{ m: 1,mt:-1, minWidth: 120 }} size="small">
                                            
                                            <Select
                                                labelId="master-wallet"
                                                id="master-wallet"
                                                size='small'
                                                value={tokenSelected ? tokenSelected?.associated_account : ""}
                                                sx={{}}
                                                onChange={handleSelectChange}
                                                renderValue={() => <RenderTokenSelected ata={tokenSelected?.associated_account} />}
                                                /*
                                                renderValue={
                                                    (value) => <RenderTokenSelected ata={value} />
                                                }*/
                                            >

                                                {masterWallet?.nativeSol && masterWallet.nativeSol > 0 &&
                                                    <MenuItem value={"So11111111111111111111111111111111111111112"} key={0}>
                                                        <RenderTokenItem item={solItem} sol={true} key={0} />
                                                    </MenuItem>
                                                }

                                                {usdcValue && masterWallet?.nativeTokens && masterWallet.nativeTokens
                                                    .sort((a, b) => {
                                                        try {
                                                            const priceA = usdcValue?.[a?.address]?.price || 0;
                                                            const priceB = usdcValue?.[b?.address]?.price || 0;

                                                            if (priceA && priceB) {
                                                                return (b.balance * priceB) - (a.balance * priceA);
                                                            } else if (priceA) {
                                                                return -1;  // If only token A has a price, it comes first
                                                            } else if (priceB) {
                                                                return 1;   // If only token B has a price, it comes first
                                                            } else {
                                                                return b.balance - a.balance; // Fallback to balance sorting
                                                            }
                                                        } catch (error) {
                                                            console.error("Sorting error:", error);
                                                            return 0; // Default if comparison fails
                                                        }
                                                    })
                                                    .map((item: any, key: number) => (
                                                        <MenuItem value={item.associated_account} key={key+1}>
                                                            <RenderTokenItem item={item} />
                                                        </MenuItem>
                                                    ))
                                                }
                                            </Select> 
                                        
                                    </FormControl>
                                </InputAdornment>,
                                inputProps: {
                                    style: { textAlign: 'right', fontSize:'16px', height:'none;' }, // Align text input to the right
                                },
                            }}
                            
                        />
                    </FormControl>
                    
                    {availableTokens &&
                        <ToBuySelect />
                    }
                    
                    <Grid container direction="row" xs={12} sx={{mt:1}}>
                    <Grid xs={6}>
                        <PeriodSelect />  
                    </Grid>
                    <Grid xs={6}>
                        <FormControl fullWidth>
                            <TextField 
                                fullWidth 
                                label="Over" 
                                id="fullWidth"
                                type="text"
                                onChange={(e) => {
                                    setPeriodDuration(+e.target.value);
                                }}
                                value={periodDuration}
                                InputProps={{
                                    endAdornment: <InputAdornment position="start">{period && convertSecondsToLegibleFormat(period, true)}</InputAdornment>,
                                }}
                                variant="filled"
                                sx={{ m: 0.65 }}
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
                
                <Grid container direction="row" xs={12} sx={{mt:1}} >
                    <Grid>
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
                    </Grid>
                </Grid>
                
                {pricingStrategy &&
                    <Grid container direction="row" xs={12} sx={{mt:1}} >
                        <Grid xs={6}>
                            <FormControl fullWidth>
                                <TextField 
                                    label="Min Price Per Cycle" 
                                    //value={toAddress}
                                    type="text"
                                    onChange={(e) => {
                                        setMinOutAmountPerCycle(+e.target.value);
                                    }}
                                    variant="filled"
                                    sx={{ m: 0.65 }}
                                    //InputProps={{
                                    //    endAdornment: <InputAdornment position="start">{(toMintAddress && objectToken[toMintAddress]) ? objectToken[toMintAddress].name : toMintAddress}  <VerticalAlignBottomIcon /></InputAdornment>,
                                    //}}
                                />
                            </FormControl>   
                        </Grid>
                        <Grid xs={6}>
                            <FormControl fullWidth >
                                <TextField 
                                    label="Max Price Per Cycle" 
                                    //value={toAddress}
                                    variant="filled"
                                    sx={{ m: 0.65 }}
                                    onChange={(e) => {
                                        setMaxOutAmountPerCycle(+e.target.value);
                                    }}
                                    //InputProps={{
                                    //    endAdornment: <InputAdornment position="start">{(toMintAddress && objectToken[toMintAddress]) ? objectToken[toMintAddress].name : toMintAddress} <VerticalAlignTopIcon /></InputAdornment>,
                                    //}}
                                />
                            </FormControl> 
                        </Grid>  
                    </Grid>
                }

                {/*
                    <FormControl fullWidth  sx={{mb:2}}>
                        <TextField
                            label="Recipient"
                            id="recipient"
                            variant="filled"
                            sx={{ m: 0.65 }}
                            value={tokenRecipient}
                            onChange={(e) => handleSetTokenRecipient(e.target.value)}
                            InputLabelProps={{
                                shrink: !!tokenRecipient, // Set shrink based on value existence
                            }}
                        />
                        <Grid sx={{textAlign:'right',}}>
                            <Tooltip title='Send to my Wallet'>
                                <IconButton 
                                        size="small"
                                        onClick={handleAddMyWallet}
                                        color='inherit'
                                        sx={{color:'#919EAB',textTransform:'none',ml:1}}>
                                    <PersonIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        </Grid>
                    </FormControl>
                */}

                    {openAdvanced ? 
                        <>
                            <AdvancedProposalView 
                                governanceAddress={governanceAddress}
                                proposalTitle={proposalTitle}
                                setProposalTitle={setProposalTitle}
                                proposalDescription={proposalDescription}
                                setProposalDescription={setProposalDescription}
                                toggleGoverningMintSelected={toggleGoverningMintSelected}
                                isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
                                isGoverningMintSelectable={isGoverningMintSelectable}
                                isDraft={isDraft}
                                setIsDraft={setIsDraft}
                                setEditProposalAddress={setEditProposalAddress}
                                editProposalAddress={editProposalAddress}
                            />
                            
                        </>
                    :
                        <></>
                    }

                    {(tokenAmount && toMintAddress && tokenSelected && periodDuration && period && periodDuration > 0 && objectToken) ?
                        <>  
                            <Box
                                sx={{ m:2,
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    borderRadius: '17px',
                                    overflow: 'hidden',
                                    p:2
                                }}
                            >
                                <Typography variant="h6">Preview/Summary</Typography>
                                <Typography variant="caption">
                                <strong>Time Swap Description</strong>
                                <br/>
                                Sell: {tokenAmount} {objectToken[tokenSelected.address] ? objectToken[tokenSelected.address].name : tokenSelected.address}<br/>
                                Buy: {objectToken[toMintAddress] ? objectToken[toMintAddress].name : toMintAddress}<br/>
                                Frequency: {convertSecondsToLegibleFormat(period, true)}<br/>
                                Over: {periodDuration}<br/>
                                Amount per cycle: {(tokenAmount/periodDuration).toFixed(3)} {objectToken[tokenSelected.address] ? objectToken[tokenSelected.address].name : tokenSelected.address}<br/>
                                {pricingStrategy &&
                                    <>
                                        {minOutAmountPerCycle &&
                                            <>Minumum Buy Mint Price per Cycle: {minOutAmountPerCycle} {objectToken[tokenSelected.address] ? objectToken[tokenSelected.address].name : tokenSelected.address}<br/></>
                                        }
                                        {maxOutAmountPerCycle &&
                                            <>Max Buy Mint Price per Cycle: {maxOutAmountPerCycle} {objectToken[tokenSelected.address] ? objectToken[tokenSelected.address].name : tokenSelected.address}<br/></>
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

                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        {showCurrentDCAs ?
                            <>
                                {currentDCAs && currentDCAs.length > 0 ? <>
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
                                </>
                                :
                                <>No Active DCA/Scheduled Swaps</>
                                }
                            </>
                            :
                            <>
                            </>
                        }
                    </Box>


                    <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{m:2, textAlign:'center'}}>
                        <Typography variant="caption">Powered by Jupiter</Typography>
                    </Box>

                    <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p:0, pb:1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', p:0 }}>
                        {(publicKey && tokenAmount && tokenAmount > 0 && periodDuration && toMintAddress && tokenSelected) ?
                                <Button
                                    //disabled={!loading}
                                    size='small'
                                    onClick={handleAdvancedToggle}
                                    sx={{
                                        p:1,
                                        borderRadius:'17px',
                                        justifyContent: 'flex-start',
                                        '&:hover .MuiSvgIcon-root.claimIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                        <>
                                            <SettingsIcon 
                                                className="claimIcon"
                                                sx={{
                                                    color:'rgba(255,255,255,0.25)',
                                                    fontSize:"14px!important"}} />
                                        </>
                                    }
                                >
                                    Advanced
                                </Button>
                        : <></>
                        }
                        </Box>

                        <Box sx={{ display: 'flex', p:0 }}>
                            
                            {publicKey &&
                            <Button 
                                //size="small"
                                onClick={getCurrentDCAAccounts}
                                //variant="contained"
                                color="warning"
                                sx={{borderRadius:'17px'}}
                                >
                                Active Orders</Button>
                            }
                            
                            {(publicKey && tokenAmount && tokenAmount > 0 && periodDuration && toMintAddress && tokenSelected) ?
                                <Button 
                                    disabled={!toMintAddress && !loading && !period && !periodDuration}
                                    autoFocus 
                                    onClick={handleProposalIx}
                                    sx={{
                                        p:1,
                                        borderRadius:'17px',
                                        '&:hover .MuiSvgIcon-root.claimNowIcon': {
                                            color:'rgba(255,255,255,0.90)'
                                        }
                                    }}
                                    startIcon={
                                    <>
                                        <SwapHorizIcon 
                                            sx={{
                                                color:'rgba(255,255,255,0.25)',
                                                fontSize:"14px!important"}}
                                        />
                                    </>
                                    }
                                >
                                    DCA / SWAP
                                </Button>
                            : <></>
                            }
                        </Box>
                    </DialogActions>
                    
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}