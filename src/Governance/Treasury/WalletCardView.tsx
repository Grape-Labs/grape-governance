import * as React from 'react';
import { PublicKey, TokenAmount, Connection, Transaction } from '@solana/web3.js';
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import axios from "axios";
import moment from 'moment';
import { styled } from '@mui/material/styles';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import { red } from '@mui/material/colors';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import QRCode from "react-qr-code";
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';
import { useWallet } from '@solana/wallet-adapter-react';

import { createProposalInstructionsLegacy } from '../Proposals/createProposalInstructionsLegacy';

import { 
    RPC_CONNECTION,
    SHYFT_KEY
} from '../../utils/grapeTools/constants';

import { 
    shortenString,
    isGated,
    findObjectByGoverningTokenOwner,
    convertSecondsToLegibleFormat,
    getJupiterPrices,
    GOVERNANCE_STATE,
  } from '../../utils/grapeTools/helpers';

import { green } from '@mui/material/colors';
import {
    Accordion,
    AccordionActions,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Card,
    CardHeader,
    CardMedia,
    CardContent,
    CardActions,
    Collapse,
    Button,
    Grid,
    Box,
    Paper,
    Avatar,
    Table,
    TableContainer,
    TableCell,
    TableHead,
    TableBody,
    TableFooter,
    TableRow,
    TablePagination,
    Tooltip,
    CircularProgress,
    LinearProgress,
    Menu,
    MenuItem,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Skeleton,
    Badge,
    Divider,
    Chip,
    Snackbar,
    Alert,
    Dialog,
    DialogContentText,
    MobileStepper,
    Stepper,
    Step,
    StepButton,
    ListItemIcon,
    Stack,
  } from '@mui/material/';

import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
} from './../api/queries';

import { GovernanceProposalDialog } from '../GovernanceProposalDialog';
import ExtensionsMenuView from './plugins/ExtensionsMenu';
import SendView from './plugins/SendView';
import { IntegratedGovernanceProposalDialogView } from '../IntegratedGovernanceProposal';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import ErrorIcon from '@mui/icons-material/Error';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import InfoIcon from '@mui/icons-material/Info';
import CompressIcon from '@mui/icons-material/Compress';
import SettingsIcon from '@mui/icons-material/Settings';
import SendIcon from '@mui/icons-material/Send';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import WarningIcon from '@mui/icons-material/Warning';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SavingsIcon from '@mui/icons-material/Savings';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import GridViewIcon from '@mui/icons-material/GridView';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { getNativeTreasuryAddress } from '@solana/spl-governance';

interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
  }

  const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
  }));

export default function WalletCardView(props:any) {
    const [expanded, setExpanded] = React.useState(false);
    const [expandedNft, setExpandedNft] = React.useState(false);
    const [expandedStake, setExpandedStake] = React.useState(false);
    const [expandedProps, setExpandedProps] = React.useState(false);
    const timer = React.useRef<number>();
    // on direct links handle the event that the rules are not being sent over and only the wallet is sent for rules
    const rulesWallet = props?.rulesWallet;
    
    const walletAddress = props?.walletAddress;
    const rulesWalletAddress = rulesWallet ? new PublicKey(rulesWallet.pubkey).toBase58() : props?.rulesWalletAddress;

    const tokenMap = props?.tokenMap;
    const communityMintDecimals = props?.communityMintDecimals;
    const governanceAddress = props?.governanceAddress;
    const governanceValue = props?.governanceValue;
    const setGovernanceValue = props?.setGovernanceValue;
    const governanceWallets = props?.governanceWallets;

    const shortWalletAddress = shortenString(walletAddress,5,5);
    const shortRulesWalletAddress = shortenString(rulesWalletAddress,5,5);
    const [nativeSol, setNativeSol] = React.useState(null);
    const [rulesSol, setRulesSol] = React.useState(null);
    const [nativeTokens, setNativeTokens] = React.useState(null);
    const [rulesTokens, setRulesTokens] = React.useState(null);
    const [nativeNftTokens, setNativeNftTokens] = React.useState(null);
    const [rulesNftTokens, setRulesNftTokens] = React.useState(null);
    const [tokenMintArray, setTokenMintArray] = React.useState(null);
    const [usdcValue, setUsdcValue] = React.useState(null);
    const [realm, setRealm] = React.useState(props?.realm);
    const [nativeDomains, setNativeDomains] = React.useState(null);
    const [rulesDomains, setRulesDomains] = React.useState(null);
    const [proposals, setProposals] = React.useState(null);
    const [nativeStakeAccounts, setNativeStakeAccounts] = React.useState(null);
    const [rulesStakeAccounts, setRulesStakeAccounts] = React.useState(null);
    const [totalStableWalletValue, setTotalStableWalletValue] = React.useState(null);
    const [totalWalletValue, setTotalWalletValue] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const isLoading = React.useRef(false);
    const [loadingPrices, setLoadingPrices] = React.useState(false);
    const [isCopied, setIsCopied] = React.useState(false);
    const [selectedNativeWallet, setSelectedNativeWallet] = React.useState(null);

    const [expandedLoader, setExpandedLoader] = React.useState(false);
    const [instructions, setInstructions] = React.useState(null);
    const [simulationFailed, setSimulationFailed] = React.useState(false);
    const [openDialog, setOpenDialog] = React.useState(false);
    const [loadingPropCreation, setLoadingPropCreation] = React.useState(false);
    const [loadingText, setLoadingText] = React.useState(null);
    const [proposalCreated, setProposalCreated] = React.useState(false);
    const [loaderSuccess, setLoaderSuccess] = React.useState(false);
    const [loaderCreationComplete, setLoaderCreationComplete] = React.useState(false);
    const [masterWallet, setMasterWallet] = React.useState(null);
    
    const { publicKey } = useWallet();
    const anchorWallet = useAnchorWallet();

    const handleClickOpenDialog = (event:any) => {
        setOpenDialog(true);
    };
    const handleCloseDialog = () => {
        setOpenDialog(false);
    };

    const handleCopy = () => {
        setIsCopied(true);
    };
    
    const handleCloseSnackbar = () => {
        setIsCopied(false);
    };

    function SettingsMenu() {
        const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
        const open = Boolean(anchorEl);
        const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
          setAnchorEl(event.currentTarget);
        };
        const handleClose = () => {
          setAnchorEl(null);
        };
      
        return (
          <div>
            <IconButton
              id="basic-button"
              aria-controls={open ? 'basic-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
              onClick={handleClick}
            >
                <MoreVertIcon />
            </IconButton>
            <Menu
              id="basic-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleClose}
              MenuListProps={{
                'aria-labelledby': 'basic-button',
              }}
            >
                {loading ?
                <></>
                :
                    <>
                    {publicKey ?
                        <>
                        <IntegratedGovernanceProposalDialogView 
                            governanceAddress={governanceAddress}
                            intraDao={false}
                            governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                            //governingTokenMint={thisitem.account.governingTokenMint}
                            //proposalAuthor={thisitem.account.tokenOwnerRecord}
                            //payerWallet={publicKey}
                            //governanceLookup={governanceLookup}
                            //editProposalAddress={thisitem.pubkey}
                            //setReload={setReload}
                            governanceWallets={governanceWallets}
                            useButton={4} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                            useButtonText={"Create Proposal"}
                            title="Create Proposal"
                            //usePlugin={1}
                        />
                        <Divider light />
                        </>
                        :
                        <></>
                    }
                    </>
                }
                <Typography variant="caption" sx={{color:'#919EAB'}}>

                    <List sx={{ width: '100%' }}>
                        <ListItem>
                            
                            <Grid container>
                                <Grid xs={12}>
                                <strong>Governing Mint</strong>
                                </Grid>
                                <Grid xs={12}>
                                
                                {(realm && realm?.account.config?.councilMint) &&
                                <>
                                Council: 
                                    <CopyToClipboard text={realm?.account.config?.councilMint} onCopy={handleCopy}>
                                        <Button 
                                            color={'inherit'} 
                                            variant='text' 
                                            sx={{m:0,
                                                ml:1,
                                                p:0,
                                                pl:1,
                                                pr:1,
                                                fontWeight:'normal',
                                                fontSize:'12px',
                                                minWidth:'' , 
                                                    '&:hover .MuiSvgIcon-root.copyIcon': {
                                                        display: 'block',
                                                    }
                                                }}
                                            startIcon={
                                                <>
                                                    <FileCopyIcon 
                                                        className="copyIcon"
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            display: 'none',
                                                            fontSize:"14px!important"}} />
                                                </>
                                                }
                                        >
                                            {shortenString(realm?.account.config?.councilMint.toBase58(),5,5)}
                                        </Button>
                                    </CopyToClipboard><br/>
                                </>}
                                    Community: 
                                        <CopyToClipboard text={realm?.account.communityMint} onCopy={handleCopy}>
                                            <Button 
                                                color={'inherit'} 
                                                variant='text'
                                                sx={{m:0,
                                                    ml:1,
                                                    p:0,
                                                    pl:1,
                                                    pr:1,
                                                    fontWeight:'normal',
                                                    fontSize:'12px',
                                                    minWidth:'' , 
                                                        '&:hover .MuiSvgIcon-root.copyIcon': {
                                                            display: 'block',
                                                        }
                                                    }}
                                                startIcon={
                                                    <>
                                                        <FileCopyIcon 
                                                            className="copyIcon"
                                                            sx={{
                                                                color:'rgba(255,255,255,0.25)',
                                                                display: 'none',
                                                                fontSize:"14px!important"}} />
                                                    </>
                                                    }
                                            >
                                                {shortenString(realm?.account.communityMint.toBase58(),5,5)}
                                            </Button>
                                        </CopyToClipboard>
                                </Grid>
                            </Grid>
                        </ListItem>
                        
                        <ListItem>
                            <Grid container>
                                <Grid xs={12}>
                                <strong>Proposal Creation Minimum</strong>
                                </Grid>
                                <Grid xs={12}>
                                
                                {Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) === 18446744073709551615 ?
                                <>
                                Council: {Number(rulesWallet.account.config.minCouncilTokensToCreateProposal)}
                                </>:<></>}
                                
                                {Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) === 18446744073709551615 ?
                                    <><br/>Community: N/A</>
                                :
                                    <>
                                    <br/>
                                    Community: {
                                        communityMintDecimals ?
                                            (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal)/10**communityMintDecimals).toLocaleString()
                                        :
                                            Number(rulesWallet.account.config.minCommunityTokensToCreateProposal)
                                        }
                                    </>
                                }
                                </Grid>
                            </Grid>
                        </ListItem>
                        <ListItem>
                            <Grid container>
                                <Grid xs={12}>
                                <strong>Vote Threshold</strong>
                                </Grid>
                                <Grid xs={12}>
                                {rulesWallet.account.config?.councilVoteThreshold?.value ?
                                <>
                                Council: {rulesWallet.account.config.councilVoteThreshold.value}%
                                </>:<></>}
                                {(rulesWallet.account.config?.communityVoteThreshold && rulesWallet.account.config.communityVoteThreshold?.value) ?
                                <><br/>
                                Community: {rulesWallet.account.config.communityVoteThreshold.value}%
                                </>:<></>}
                                </Grid>
                            </Grid>
                        </ListItem>
                        <ListItem>
                            Voting Time: {((rulesWallet.account.config.baseVotingTime/60)/60).toFixed(0)}h
                        </ListItem>
                        
                        <ListItem>
                            <Grid alignItems='center'>
                                <Typography variant="caption" sx={{fontSize:'10px'}}>
                                *These are the rules that define this Governance Wallet
                                </Typography>
                            </Grid>
                        </ListItem>
                    </List>
                    
                </Typography>
                <Divider light />
                    <CopyToClipboard text={rulesWalletAddress} onCopy={handleCopy}>
                        
                            <Tooltip title="Rules Wallet">
                                <MenuItem
                                    color={'inherit'} 
                                    sx={{mt:0.5}}
                                >
                                    <ListItemIcon>
                                        <SettingsIcon fontSize="small" />
                                    </ListItemIcon>
                                    {shortRulesWalletAddress} 
                                </MenuItem>
                                </Tooltip>
                    </CopyToClipboard>
                {/*
                <MenuItem>Voting Time {((rulesWallet.account.config.baseVotingTime/60)/60).toFixed(0)}h</MenuItem>
                <MenuItem>Proposal Creation Council Minimum {rulesWallet.account.config.minCouncilTokensToCreateProposal}</MenuItem>
                <MenuItem>Council Vote Threshhold {rulesWallet.account.config.councilVoteThreshold.value}%</MenuItem>
                <MenuItem>Council Veto Threshhold {rulesWallet.account.config.councilVetoVoteThreshold.value}%</MenuItem>
                <MenuItem>Proposal Creation Community Minimum {rulesWallet.account.config.minCouncilTokensToCreateProposal}</MenuItem>
                */}
            </Menu>
          </div>
        );
      }

      const getWalletNftBalance = async(tokenOwnerRecord: PublicKey) => {

        if (SHYFT_KEY) {
            try{
                const uri = `https://rpc.shyft.to/?api_key=${SHYFT_KEY}`;
    
                const response = await fetch(uri, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'rpc-id',
                        method: 'getAssetsByOwner',
                        params: {
                            ownerAddress: tokenOwnerRecord.toBase58(),
                            page: 1, // Starts at 1
                            limit: 1000
                        },
                    }),
                    });
                const { result } = await response.json();
                //dasMeta = result.items;
                return result?.items;
                /*
                console.log("Assets owned by a wallet: ", result.items);
                */
            } catch(err){
                console.log("DAS: Err");
                return null;
            }
        }
    }

    const getWalletValue = async() => {
        setLoadingPrices(true);
        const cgp = await getJupiterPrices(tokenMintArray);

        //const solToUsd = cgp['So11111111111111111111111111111111111111112'].price;
        //const solUsdValue = (ia.solBalance > 0 ? cgp['So11111111111111111111111111111111111111112'].price*(ia.solBalance/(10 ** 9)) : 0);

        setUsdcValue(cgp);

        setLoadingPrices(false);
    }
    
    const getWalletAllTokenBalance = async(tokenOwnerRecord: PublicKey) => {
    
        const uri = `https://api.shyft.to/sol/v1/wallet/all_tokens?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
    
        return axios.get(uri, {
            headers: {
                'x-api-key': SHYFT_KEY
            }
            })
            .then(response => {
                if (response.data?.result){
                    return response.data.result;
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
    
    const getWalletBalance = async(tokenOwnerRecord: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/wallet/balance?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
        
        return axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response.data?.result){
                    console.log("balance for "+tokenOwnerRecord.toBase58()+": "+response.data.result?.balance)
                    return response.data.result?.balance;
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

    const getWalletStakeAccounts = async(tokenOwnerRecord: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/wallet/stake_accounts?network=mainnet-beta&wallet_address=${tokenOwnerRecord.toBase58()}`;
        
        return axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response.data?.result?.data){
                    return response.data.result.data;
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

    const getWalletDomains = async(tokenOwnerRecord: PublicKey) => {
        
        const uri = `https://api.shyft.to/sol/v1/wallet/get_domains?network=mainnet-beta&wallet=${tokenOwnerRecord.toBase58()}`;
        
        return axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                }
                })
            .then(response => {
                if (response.data?.result){
                    return response.data.result;
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

    const getAllWalletDomains = async() => {
        // get domains
        const domains1 = await getWalletDomains(new PublicKey(walletAddress));
        const domains2 = await getWalletDomains(new PublicKey(rulesWalletAddress));
        
        setNativeDomains(domains1);
        setRulesDomains(domains2);
        rulesWallet.domains = domains1;
    }

    const getWalletBalances = async() =>{
        setLoading(true);
        isLoading.current = true;
        try{
            // get total sol
            const sol1 = await getWalletBalance(new PublicKey(walletAddress));
            const sol2 = await getWalletBalance(new PublicKey(rulesWalletAddress));
            
            // get total tokens
            const token1 = await getWalletAllTokenBalance(new PublicKey(walletAddress));
            const token2 = await getWalletAllTokenBalance(new PublicKey(rulesWalletAddress));
            // consolidate tokens?
            const tArray = ["So11111111111111111111111111111111111111112"];
            
            token1 && token1
                .map((item: any,key:number) => ( 
                    tArray.push(item.address)
            ));
            token2 && token2
                .map((item: any,key:number) => ( 
                    tArray.push(item.address)
            ));
            setTokenMintArray(tArray);
            
            
            // get nft balance
            const nft1 = await getWalletNftBalance(new PublicKey(walletAddress));
            const nft2 = await getWalletNftBalance(new PublicKey(rulesWalletAddress));

            
            // get stake accounts
            //const stake1 = await getWalletStakeAccounts(new PublicKey(walletAddress));
            //const stake2 = await getWalletStakeAccounts(new PublicKey(rulesWalletAddress));
            
            const props = await getAllProposalsIndexed([rulesWalletAddress], null, governanceAddress);

            setProposals(props);

            // put to unified array
            setNativeSol(sol1);
            setRulesSol(sol2);
                
            setNativeTokens(token1);
            setRulesTokens(token2);

            setNativeNftTokens(nft1);
            setRulesNftTokens(nft2);

            //setNativeStakeAccounts(stake1);
            //setRulesStakeAccounts(stake2);
                    
            // unify tokens?
            // think of how we can display them unified if needed

            const mWallet = {
                nativeSol: sol1,
                rulesSol: sol2,
                nativeTokens: token1,
                rulesTokens: token2,
                nativeNftTokens: nft1,
                rulesNftTokens: nft2,
            }
            setMasterWallet(mWallet);

            setLoading(false);
            isLoading.current = false;

            getAllWalletDomains(); // push this after loading
        } catch (error) {
            // Handle errors
        } 
        finally {
            setLoading(false); // Ensure this is called in the finally block
            isLoading.current = false;
        }
    }

    const fetchRealm = async() =>{
        const rlm = await getRealmIndexed(governanceAddress);
        if (rlm)
            setRealm(rlm);
    }

    const StakeAccountsView = () => {
        const [loadingStake, setLoadingStake] = React.useState(false);
        const [nativeStake, setNativeStake] = React.useState(null);

        const fetchStakeAccounts = async() =>{
            setLoadingStake(true);
            //isLoading.current = true;
            try{
               
                // get stake accounts
                const stake1 = await getWalletStakeAccounts(new PublicKey(walletAddress));
                //const stake2 = await getWalletStakeAccounts(new PublicKey(rulesWalletAddress));

                //setNativeStakeAccounts(stake1);
                setNativeStake(stake1);
                setLoadingStake(false);
            }catch(e){
                setLoadingStake(false);
            }
        }

        const handleAddressCopy = () => {
            setIsCopied(true);
        };

        React.useEffect(() => { 
            if (!loadingStake && !nativeStake){
                fetchStakeAccounts();
            }
        }, []);


        return (
            <>
                {loadingStake ?
                    <Grid container justifyContent={'center'} alignContent={'center'} sx={{mt:2}}>
                        <CircularProgress />        
                    </Grid>
                :
                <>
                    {(nativeStake && nativeStake.length > 0) ? nativeStake
                        .sort((a:any,b:any) => (b.total_amount - a.total_amount))
                        .map((item: any,key:number) => (  
                            <> 
                                <ListItem
                                    secondaryAction={
                                        <Box sx={{textAlign:'right'}}>
                                            <Typography variant="subtitle1" sx={{color:'white'}}>
                                                {item.total_amount}
                                            </Typography>
                                            <Typography variant="caption" sx={{color:'#919EAB'}}>
                                            {usdcValue ? 
                                                <>{usdcValue['So11111111111111111111111111111111111111112'] ? 
                                                    <>${(((item.total_amount) * usdcValue['So11111111111111111111111111111111111111112']?.price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))}</>
                                                    :<></>
                                                }</>
                                            :<></>}</Typography>
                                        </Box>
                                    }
                                    key={key}
                                >
                                    <ListItemAvatar>
                                        <Avatar>
                                            <AccessTimeIcon />
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={
                                            <CopyToClipboard text={item.stake_account_address} onCopy={handleAddressCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        p:0,
                                                        textAlign:'right',
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                    <Typography variant="subtitle1" sx={{color:'white'}}>{shortenString(item.stake_account_address,5,5)}</Typography>
                                                </Button>
                                            </CopyToClipboard>
                                        } 
                                        secondary={
                                            <>
                                            {item.status}
                                            </>
                                        }
                                        />
                                </ListItem>
                                {key+1 < nativeStake.length && <Divider variant="inset" component="li" light />}
                            </>
                        ))
                    :<>
                        <Grid container justifyContent={'center'} alignContent={'center'} sx={{mt:2}}>
                            <Typography variant="caption" sx={{color:'#919EAB'}}>
                                No stake accounts for this address
                            </Typography>
                        </Grid>
                    </>
                    }
                </>
                }
            </>
        )
    }


    React.useEffect(() => { 
        
        if (usdcValue && 
            (nativeSol && nativeSol > 0 || rulesSol && rulesSol > 0) &&
            (nativeTokens && rulesTokens)){
            let totalVal = 0;
            let tokenStableAccountVal = 0;
            let tokenAccountVal = 0;
            let stakeAccountVal = 0;
            let solAccountVal = usdcValue['So11111111111111111111111111111111111111112']?.price ? usdcValue['So11111111111111111111111111111111111111112']?.price*(+nativeSol + +rulesSol) : 0;
            //alert(usdcValue['So11111111111111111111111111111111111111112'].price + " " +(+nativeSol + +rulesSol));
            totalVal += solAccountVal;
            
            if (nativeTokens){
                for (let item of nativeTokens){
                    if (usdcValue[item.address]){
                        tokenAccountVal += usdcValue[item.address].price * item.balance;
                    }

                    if (item.address === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" ||
                        item.address === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" ||
                        item.address === "BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4" ||
                        item.address === "D3KdBta3p53RV5FoahnJM5tP45h6Fd3AyFYgXTJvGCaK" ||
                        item.address === "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS"){
                            if (usdcValue[item.address] && usdcValue[item.address]?.price)
                                tokenStableAccountVal += usdcValue[item.address].price * item.balance;
                    }
                }
            }
            if (rulesTokens){
                for (let item of rulesTokens){
                    if (usdcValue[item.address]){
                        tokenAccountVal += usdcValue[item.address].price * item.balance;
                    }

                    if (item.address === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" ||
                        item.address === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" ||
                        item.address === "BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4" ||
                        item.address === "D3KdBta3p53RV5FoahnJM5tP45h6Fd3AyFYgXTJvGCaK" ||
                        item.address === "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS"){
                            if (usdcValue[item.address] && usdcValue[item.address]?.price)
                                tokenStableAccountVal += usdcValue[item.address].price * item.balance;
                    }
                }
            }
            totalVal+=tokenAccountVal;

            if (nativeStakeAccounts){
                for (let item of nativeStakeAccounts){
                    stakeAccountVal += item.total_amount * usdcValue['So11111111111111111111111111111111111111112']?.price
                }
            } 
            if (rulesStakeAccounts){
                for (let item of rulesStakeAccounts){
                    stakeAccountVal += item.total_amount * usdcValue['So11111111111111111111111111111111111111112']?.price
                }
            } 

            /*
            LOOP THROUGH ALL DAO WALLETS TO GET THE VALUE
            */
            totalVal+=stakeAccountVal;
            setTotalStableWalletValue(tokenStableAccountVal);
            setTotalWalletValue(totalVal);
            rulesWallet.walletValue = totalVal;
            rulesWallet.solBalance = +nativeSol + +rulesSol;

            const newGovernanceObject = {
                address: walletAddress,
                totalVal: totalVal,
                solAccountVal: solAccountVal,
                stableAccountVal:tokenStableAccountVal,
                totalGovernanceSol: (+nativeSol + +rulesSol),
              };
              
            // Check if an object with the same address already exists in the array
            const isAddressUnique = !governanceValue.some(obj => obj.address === walletAddress);
            
            // If the address is unique, push the new object
            if (isAddressUnique) {
                setGovernanceValue(prevState => [...prevState, newGovernanceObject]);
            }
        }
    }, [usdcValue, nativeSol, rulesSol, nativeTokens, rulesTokens, nativeStakeAccounts, rulesStakeAccounts]);

    React.useEffect(() => { 
        if (!realm){
            fetchRealm();
        }
    }, [realm]);

    React.useEffect(() => { 
        if (tokenMintArray && tokenMintArray.length > 0){
            getWalletValue();
        }
    }, [tokenMintArray]);

    React.useEffect(() => { 
        //if (!loading){
        if (!isLoading.current) {    
            if (walletAddress && rulesWalletAddress){
                console.log("rulesWallet: "+JSON.stringify(rulesWallet))
                getWalletBalances();
            }
        }
    }, [walletAddress, rulesWalletAddress]);
    
    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    const handleExpandNftClick = () => {
        setExpandedNft(!expandedNft);
    }

    const handleExpandStakeClick = () => {
        setExpandedStake(!expandedStake);
    }
    const handleExpandPropsClick = () => {
        setExpandedProps(!expandedProps);
    }

    const handleProposalTxSimulation = async() => {
        try{
            if (instructions){
                console.log("3...");
                setLoaderCreationComplete(false);
                setLoaderSuccess(false);
                setSimulationFailed(false);
                const { blockhash, lastValidBlockHeight } = await RPC_CONNECTION.getLatestBlockhash('confirmed');
                
                let transaction = new Transaction({
                    feePayer: new PublicKey(instructions.nativeWallet),
                    blockhash,
                    lastValidBlockHeight,
                })

                console.log("ix: "+JSON.stringify(instructions.ix));
                console.log("aix: "+JSON.stringify(instructions.aix));

                transaction.add(...instructions.ix);// we should simulate when sending back to the wallet...
                
                if (instructions?.aix){
                    //if (instructions?.aix)
                    //    transaction.add(...instructions.aix)
                    // run another sim for author
                    console.log("Has Auth Ix");
                }

                console.log("Getting estimated fees");
                const latestBlockHash = (await RPC_CONNECTION.getLatestBlockhash()).blockhash;
                transaction.recentBlockhash = latestBlockHash;
                transaction.feePayer = new PublicKey(instructions.nativeWallet);
                const simulationResult = await RPC_CONNECTION.simulateTransaction(transaction);
                //console.log("sim results..."+JSON.stringify(simulationResult));
                if (simulationResult?.err || simulationResult?.value?.err) {
                    console.error('Transaction simulation failed:', simulationResult);
                    setSimulationFailed(true);
                    setLoaderCreationComplete(true);
                    //return;
                } else {
                    console.log('simulationResult: '+JSON.stringify(simulationResult));
                    const computeUnits = simulationResult.value?.unitsConsumed; //simulationResult.value?.transaction?.message.recentBlockhashFeeCalculator.totalFees;
                    //const lamportsPerSol = 1000000000;
                    const sol = computeUnits / 10 ** 9;
                    console.log(`Estimated fee: ${sol}`);
                    //setTransactionEstimatedFee(sol);//feeInLamports/10 ** 9;
                }
                //transaction = await wallet.signTransaction(transaction);
                //const rawTransaction = transaction.serialize();
                //const txid = await connection.sendRawTransaction(rawTransaction, {
                //skipPreflight: true,
                //});

                console.log("Transaction: "+JSON.stringify(transaction));

                setLoaderSuccess(true);
            }
        } catch(e){
            console.log("ERR: "+e);
            setSimulationFailed(true);
            setLoaderCreationComplete(true);
        }
        
    }

    const handleProposalTxCreation = async() => {
        
        if (instructions){

            console.log("programId: " + realm?.owner?.toBase58());

            const programId = realm?.owner?.toBase58();

            // get rules wallet from native wallet
            let ixRulesWallet = null;
            let useGoverningMint = instructions?.governingMint;
            let hasChoice = 0;
            
            for (const item of governanceWallets){
                if (item.nativeTreasuryAddress.toBase58() === instructions.nativeWallet){
                    ixRulesWallet = item.pubkey.toBase58();
                    if (!instructions?.governingMint){
                        console.log("wallet details: "+JSON.stringify(item));
                        console.log("realm: "+JSON.stringify(realm));
                        
                        // THIS NEEDS SOME WORK:
                        if (instructions.governingMint && (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615)){ // && threshold 
                            useGoverningMint = realm.account.communityMint;
                        } else{
                            if (item?.account.config?.communityVoteThreshold?.value){ // has commmunity support
                                useGoverningMint = realm.account.communityMint;
                                hasChoice++;
                            }

                            if (item?.account.config?.councilVoteThreshold?.value){ // has council support
                                useGoverningMint = realm.account.config.councilMint;
                                hasChoice++;
                            }
                        }

                    }
                }
            }

            // check what mints are available if we have returned no mints from the extension plugin
            
            if (ixRulesWallet){
                console.log("Using Rules: "+ixRulesWallet);

                const isDraft = instructions.draft ? instructions.draft : true;
                const returnTx = false;
                
                const transaction = new Transaction();
                const authTransaction = new Transaction();

                // check which mint should be used (council or community)
                // assume council for now but this should be toggled in the previous step or from the claim view
                console.log("adding tx ix")
                
                transaction.add(...instructions.ix);

                if (instructions?.aix && instructions.aix.length > 0){
                    authTransaction.add(...instructions.aix);
                }

                console.log("with Governing Mint: "+useGoverningMint)

                console.log("sending to createProposalInstructionsLegacy")
                setLoadingText("Creating Proposal...");
                setLoadingPropCreation(true);
                
                /*
                console.log("programId: "+new PublicKey(programId).toBase58())
                console.log("governanceAddress: "+new PublicKey(governanceAddress).toBase58())
                console.log("ixRulesWallet: "+new PublicKey(ixRulesWallet).toBase58())
                console.log("useGoverningMint: "+new PublicKey(useGoverningMint).toBase58())
                console.log("publicKey: "+new PublicKey(publicKey).toBase58())
                console.log("title: "+instructions.title)
                console.log("description: "+instructions.description)
                */
                
                const propResponse = await createProposalInstructionsLegacy(
                    new PublicKey(programId),
                    new PublicKey(governanceAddress),
                    new PublicKey(ixRulesWallet),
                    new PublicKey(useGoverningMint),
                    publicKey,
                    instructions.title,
                    instructions.description,
                    RPC_CONNECTION,
                    transaction,
                    authTransaction,
                    anchorWallet,
                    null,
                    isDraft,
                    returnTx,
                    publicKey,
                    null
                );

                setLoadingPropCreation(false);
                if (propResponse){
                    setLoadingText("New Proposal Created!");
                }

                setLoaderCreationComplete(true);
                
            }


        }
    }

    React.useEffect(() => {     
        if (expandedLoader && !loaderSuccess){ // remove to add simulatipon and proposal instruction building here 
            if (instructions){
                handleProposalTxSimulation();
            }
        }
        if (expandedLoader && loaderSuccess && !simulationFailed){
            handleProposalTxCreation();
        }
    }, [expandedLoader, loaderSuccess]);

    React.useEffect(() => {     
        
        if (expandedLoader && loaderCreationComplete){
            timer.current = window.setTimeout(() => {
                setExpandedLoader(false);
                setLoaderSuccess(false);
            }, 2000);
        }
    
    }, [expandedLoader, loadingPropCreation, loaderCreationComplete]);


    React.useEffect(() => {
        return () => {
          clearTimeout(timer.current);
        };
    }, []);
    

    function TokenExpandComponent(props:any) {
        const item = props?.item;
        const type = props?.type;

        const [expanded, setExpanded] = React.useState(false);
      
        return (
            <>
                <ListItem
                    sx={{m:0,mt:'-30px',p:0}}
                >   
                        <Grid container justifyContent={'center'} alignItems={'center'}>
                            <Grid item xs={12}>
                                <Tooltip title="Show More Info">
                                    <IconButton 
                                        sx={{
                                            m:0,mt:'-28px',
                                            ml:'16px',
                                            p:0,
                                            color:'rgba(255,255,255,0.02)',
                                            '&:hover': {
                                                color: 'rgba(255,255,255,0.5)',
                                            },}}
                                        onClick={() => setExpanded(!expanded)}
                                    >
                                        {expanded ? 
                                            <KeyboardArrowUpIcon sx={{ fontSize: 40 }} />
                                        :
                                            <KeyboardArrowDownIcon sx={{ fontSize: 40 }} />
                                        }
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                            <Collapse in={expanded} timeout="auto" unmountOnExit>
                                {(type && type === 1) ?
                                    <Grid container sx={{p:2,pl:8,pr:1}}>
                                        
                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>Address</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <CopyToClipboard text={item.id} onCopy={handleCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        ml:1,
                                                        p:0,
                                                        color:'#919EAB',
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                {shortenString(item.id,5,5)}
                                                </Button>
                                            </CopyToClipboard>
                                        </Grid>
                                        
                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>Description</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <Box sx={{pr:3, color:'#919EAB'}}>
                                            {item.content.metadata.description}
                                            </Box>
                                        </Grid>

                                        {item.content.metadata?.token_standard && 
                                            <>
                                                <Grid item xs={6}>
                                                    <Typography variant='caption' sx={{color:'#919EAB'}}>Standard</Typography>
                                                </Grid>
                                                <Grid item xs={6} sx={{textAlign:'right'}}>
                                                    <Box sx={{pr:3, color:'#919EAB'}}>
                                                    {item.content.metadata.token_standard}
                                                    </Box>
                                                </Grid>
                                            </>
                                        }

                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>Royalties</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <Box sx={{pr:3, color:'#919EAB'}}>
                                            {+item.royalty.percent*100}% {item.compression.royalty_model}
                                            </Box>
                                        </Grid>

                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>Compressed</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <Box sx={{pr:3, color:'#919EAB'}}>
                                            {item.compression.compressed ? `Yes`:`No`}
                                            </Box>
                                        </Grid>

                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>Ownership Model</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <Box sx={{pr:3, color:'#919EAB'}}>
                                            {item.ownership.ownership_model}
                                            </Box>
                                        </Grid>


                                        {(item?.grouping && item.grouping.length > 0) &&
                                            <>
                                                <Grid item xs={6}>
                                                    <Typography variant='caption' sx={{color:'#919EAB'}}>Collection</Typography>
                                                </Grid>
                                                <Grid item xs={6} sx={{textAlign:'right'}}>
                                                    <CopyToClipboard text={item.grouping[0].group_value} onCopy={handleCopy}>
                                                        <Button 
                                                            color={'inherit'} 
                                                            variant='text' 
                                                            sx={{m:0,
                                                                ml:1,
                                                                p:0,
                                                                color:'#919EAB',
                                                                mintWidth:'' , 
                                                                    '&:hover .MuiSvgIcon-root': {
                                                                        opacity: 1,
                                                                    },
                                                                }}
                                                            endIcon={
                                                            <FileCopyIcon 
                                                                fontSize={'small'} 
                                                                sx={{
                                                                    color:'rgba(255,255,255,0.25)',
                                                                    pr:1,
                                                                    opacity: 0,
                                                                    fontSize:"10px"}} />
                                                            }
                                                            
                                                        >
                                                        {shortenString(item.grouping[0].group_value,5,5)}
                                                        </Button>
                                                    </CopyToClipboard>
                                                </Grid>
                                            </>
                                        }

                                        {item.ownership?.delegate &&
                                            <>
                                                <Grid item xs={6}>
                                                    <Typography variant='caption' sx={{color:'#919EAB'}}>Delegate</Typography>
                                                </Grid>
                                                <Grid item xs={6} sx={{textAlign:'right'}}>
                                                    <CopyToClipboard text={item.ownership.delegate} onCopy={handleCopy}>
                                                        <Button 
                                                            color={'inherit'} 
                                                            variant='text' 
                                                            sx={{m:0,
                                                                ml:1,
                                                                p:0,
                                                                color:'#919EAB',
                                                                mintWidth:'' , 
                                                                    '&:hover .MuiSvgIcon-root': {
                                                                        opacity: 1,
                                                                    },
                                                                }}
                                                            endIcon={
                                                            <FileCopyIcon 
                                                                fontSize={'small'} 
                                                                sx={{
                                                                    color:'rgba(255,255,255,0.25)',
                                                                    pr:1,
                                                                    opacity: 0,
                                                                    fontSize:"10px"}} />
                                                            }
                                                            
                                                        >
                                                        {shortenString(item.ownership.delegate,5,5)}
                                                        </Button>
                                                    </CopyToClipboard>
                                                </Grid>
                                            </>
                                        }

                                    </Grid>
                                :
                                    <Grid container sx={{p:2,pl:8,pr:1}}>
                                        <Grid item xs={6}>
                                            <b>{item.info.name}</b> <Typography variant='caption' sx={{color:'#919EAB'}}>{item.info.symbol}</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <CopyToClipboard text={item.address} onCopy={handleCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        ml:1,
                                                        p:0,
                                                        color:'#919EAB',
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                {shortenString(item.address,5,5)}
                                                </Button>
                                            </CopyToClipboard>
                                        </Grid>

                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>ATA</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <CopyToClipboard text={item.associated_account} onCopy={handleCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        ml:1,
                                                        p:0,
                                                        color:'#919EAB',
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                {shortenString(item.associated_account,5,5)}
                                                </Button>
                                            </CopyToClipboard>
                                        </Grid>

                                        <Grid item xs={6}>
                                            <Typography variant='caption' sx={{color:'#919EAB'}}>Decimals</Typography>
                                        </Grid>
                                        <Grid item xs={6} sx={{textAlign:'right'}}>
                                            <Box sx={{pr:3, color:'#919EAB'}}>
                                            {item.info.decimals}
                                            </Box>
                                        </Grid>

                                    </Grid>
                                }
                        </Collapse>
                    </Grid>
                </ListItem>
            </>
        )
    } 

    
    return (
        <>
        <Card>
        <CardHeader
            avatar={
                <Avatar aria-label={walletAddress}>
                    <Jazzicon diameter={50} seed={jsNumberForAddress("0x"+walletAddress)} />
                </Avatar>
            }
            action={
                <SettingsMenu/>
            }
            title={ 
                <CopyToClipboard text={walletAddress} onCopy={handleCopy}>
                    <Button 
                        color={'inherit'} 
                        variant='text'
                        sx={{ 
                            '&:hover .MuiSvgIcon-root': {
                                opacity: 1,
                            },
                        }}
                        endIcon={
                            <FileCopyIcon 
                                fontSize={'small'} 
                                sx={{
                                    color:'rgba(255,255,255,0.25)',
                                    opacity: 0,
                                    fontSize:"10px"}} />
                        }
                    >
                        <Typography variant="h6">
                            {shortWalletAddress}
                        </Typography>
                    </Button>
                </CopyToClipboard>
            }
            subheader={
                <>
                </>

            }
        />

        <Grid sx={{mt:1}}>
            <Divider light>
                {(nativeDomains && nativeDomains.length > 0) &&
                <Chip variant='outlined' label={nativeDomains[0].name} size="small" />
                }
            </Divider>
        </Grid>

        <Grid container
            sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}}
        > 

            <Grid xs={12} sx={{display: 'flex', justifyContent: 'center'}}>
            
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={150} height={60} sx={{m:1,p:0}} />
                :
                    <h1>{
                        totalWalletValue ?
                        `$${(totalWalletValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))}`
                        :
                        `-`}
                    </h1>

                    
                }
                
            </Grid>
            <Grid xs={6} sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}} >
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={'90%'} height={60} sx={{m:1,p:0}} />
                :
                    <Button 
                        size="large" 
                        variant="contained" 
                        onClick={handleClickOpenDialog}
                        color='primary'
                        fullWidth
                        sx={{backgroundColor:'rgba(255,255,255,0.05)',pl:2,pr:2,ml:1,mr:1}}>Receive</Button>
                }
            </Grid>
            <Grid xs={6} sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}}>
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={'90%'} height={60} sx={{m:1,p:0}} />
                :
                    <IntegratedGovernanceProposalDialogView 
                        governanceAddress={governanceAddress}
                        intraDao={false}
                        governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                        //governingTokenMint={thisitem.account.governingTokenMint}
                        //proposalAuthor={thisitem.account.tokenOwnerRecord}
                        //payerWallet={publicKey}
                        //governanceLookup={governanceLookup}
                        //editProposalAddress={thisitem.pubkey}
                        //setReload={setReload}
                        
                        governanceWallets={governanceWallets}
                        useButton={1} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                        useButtonText={"Send"}
                        title="Send"
                        usePlugin={4}
                    />
                }
            </Grid>

            
            
        </Grid>
        <CardContent sx={{p:0,mt:2}}>
            <Typography variant="body2" color="text.secondary">
                <List sx={{ width: '100%' }}>

                    {(loading || loadingPrices) ?
                        <>
                            <ListItem
                                secondaryAction={
                                    <>
                                        <Skeleton
                                            animation="wave"
                                            height={20}
                                            width="120px"
                                            style={{ marginBottom: 4, textAlign: 'right' }}
                                            />
                                        <Skeleton
                                            animation="wave"
                                            height={20}
                                            width="120px"
                                            style={{ marginBottom: 4, textAlign: 'right' }}
                                            />
                                    </>
                                }
                                sx={{mb:1}}
                            >
                                <ListItemAvatar>
                                    <Skeleton animation="wave" variant="circular" width={40} height={40} />
                                </ListItemAvatar>
                                <ListItemText 
                                        primary={
                                            <Skeleton
                                                animation="wave"
                                                height={20}
                                                width="140px"
                                                style={{ marginBottom: 4 }}
                                                />
                                        }
                                        secondary={
                                            <Skeleton
                                                animation="wave"
                                                height={20}
                                                width="100px"
                                                style={{ marginBottom: 2 }}
                                                />
                                        }
                                        
                                />
                            </ListItem>
                            <Divider component="li" light />
                        </>
                    :
                        <>
                            <ListItem
                                secondaryAction={
                                    <Box sx={{textAlign:'right'}}>
                                        <Box>
                                            {(nativeSol && rulesSol && nativeSol > 0 && rulesSol > 0 ) ?
                                                <IntegratedGovernanceProposalDialogView 
                                                    governanceAddress={governanceAddress}
                                                    intraDao={false}
                                                    governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                    //governingTokenMint={thisitem.account.governingTokenMint}
                                                    //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                    //payerWallet={publicKey}
                                                    //governanceLookup={governanceLookup}
                                                    //editProposalAddress={thisitem.pubkey}
                                                    //setReload={setReload}
                                                    
                                                    governanceWallets={governanceWallets}
                                                    useButton={2} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                    useButtonText={
                                                        (nativeSol && rulesSol) ? `${(nativeSol+rulesSol).toFixed(6)}`
                                                        :`Send`}
                                                    title="Send"
                                                    usePlugin={5}
                                                />
                                            :
                                                <>
                                                    <Typography variant={`h5`} sx={{color:'white'}}>
                                                        {(nativeSol || rulesSol) ?
                                                            `${(+nativeSol + +rulesSol).toFixed(6)}`:`-`}
                                                        </Typography>
                                                </>
                                            }
                                        </Box>
                                        <Typography variant="caption" sx={{color:'#919EAB'}}>
                                            {usdcValue ? 
                                                <>{usdcValue['So11111111111111111111111111111111111111112'] ? 
                                                    <>${(((nativeSol+rulesSol) * usdcValue['So11111111111111111111111111111111111111112']?.price).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))}</>
                                                    :<></>
                                                }</>
                                            :<></>}</Typography>
                                    </Box>
                                }
                                sx={{mb:1}}
                            >
                                <ListItemAvatar>
                                    <Avatar
                                        src='https://solana-cdn.com/cdn-cgi/image/width=100/https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
                                    >
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText 
                                    primary={
                                        <CopyToClipboard text={walletAddress} onCopy={handleCopy}>
                                            <Button 
                                                color={'inherit'} 
                                                variant='text' 
                                                sx={{m:0,
                                                    p:0,
                                                    mintWidth:'' , 
                                                        '&:hover .MuiSvgIcon-root': {
                                                            opacity: 1,
                                                        },
                                                    }}
                                                endIcon={
                                                  <FileCopyIcon 
                                                    fontSize={'small'} 
                                                    sx={{
                                                        color:'rgba(255,255,255,0.25)',
                                                        pr:1,
                                                        opacity: 0,
                                                        fontSize:"10px"}} />
                                                }
                                            >
                                                <Typography variant="subtitle1" sx={{color:'white'}}>Solana</Typography>
                                            </Button>
                                        </CopyToClipboard>
                                    } 
                                    secondary={<Typography variant="caption">{usdcValue && `$${usdcValue['So11111111111111111111111111111111111111112']?.price && usdcValue['So11111111111111111111111111111111111111112'].price.toFixed(2)}`}</Typography>}
                                    />
                            </ListItem>
                            <Divider component="li" light />
                        </>
                    }
                </List>
                
                
            </Typography>
        </CardContent>
        <CardActions disableSpacing>
            <CopyToClipboard text={`https://governance.so/treasury/${governanceAddress}/${rulesWalletAddress}`} onCopy={handleCopy}>
                <IconButton aria-label="share" 
                //    disabled={true}
                >
                    <ShareIcon />
                </IconButton>
            </CopyToClipboard>
            {loading ?
                <></>
            :
                <>
                    <ExtensionsMenuView 
                        realm={realm}
                        rulesWallet={rulesWallet}
                        governanceNativeWallet={walletAddress} 
                        expandedLoader={expandedLoader} 
                        setExpandedLoader={setExpandedLoader}
                        instructions={instructions}
                        setInstructions={setInstructions}
                        setSelectedNativeWallet={setSelectedNativeWallet}
                        masterWallet={masterWallet}
                        usdcValue={usdcValue}
                    />
                </>
            }
            {proposals && proposals.length > 0 &&
                <Tooltip title="Show Proposal Activity">
                    <Badge color="primary" badgeContent={proposals.length} max={999}>
                        <IconButton 
                            //expand={expandedStake}
                            onClick={handleExpandPropsClick}
                            aria-expanded={expandedProps}
                            aria-label="Proposals"
                            color={expandedProps ? 'inherit' : 'rgba(145, 158, 171, 0.8)'}
                        >
                            <SyncAltIcon />
                        </IconButton>
                    </Badge>
                </Tooltip>
            }

            {!isLoading.current &&
                <Tooltip title="Show Stake Accounts">
                    <Badge color="primary" max={999}>
                        <IconButton 
                            //expand={expandedStake}
                            onClick={handleExpandStakeClick}
                            aria-expanded={expandedStake}
                            aria-label="Stake Accounts"
                            color={expandedStake ? 'inherit' : 'rgba(145, 158, 171, 0.8)'}
                        >
                            <SavingsIcon />
                        </IconButton>
                    </Badge>
                </Tooltip>
            }

            {((nativeNftTokens && nativeNftTokens.length > 0) || (rulesNftTokens && rulesNftTokens.length > 0 )) &&
                <Tooltip title="Show NFTs">
                    <Badge color="primary" badgeContent={nativeNftTokens?.length + rulesNftTokens?.length} max={999}>
                        <IconButton 
                            //expand={expandedNft}
                            onClick={handleExpandNftClick}
                            aria-expanded={expandedNft}
                            aria-label="Show NFTs"
                            color={expandedNft ? 'inherit' : 'rgba(145, 158, 171, 0.8)'}
                        >
                            <GridViewIcon />
                        </IconButton>
                    </Badge>
                </Tooltip>
            }
            <Grid container justifyContent={'right'} sx={{mr:1}}>
                {((nativeTokens && nativeTokens.length > 0) || (rulesTokens && rulesTokens.length > 0)) &&
                <>
                    <Tooltip title="Show Tokens">
                        <Badge color="primary" badgeContent={nativeTokens?.length + rulesTokens?.length} max={999}>
                            <ExpandMore
                                expand={expanded}
                                onClick={handleExpandClick}
                                aria-expanded={expanded}
                                aria-label="Show Tokens"
                                color={expanded ? 'inherit' : 'rgba(145, 158, 171, 0.8)'}
                                >
                                    <ExpandMoreIcon />
                            </ExpandMore>
                        </Badge>
                    </Tooltip>
                </>
                }
            </Grid>
        </CardActions>

        <Collapse in={expandedLoader} timeout="auto" unmountOnExit>
            <List sx={{ width: '100%' }} component="div" disablePadding>
                <Divider light component="li" />
                <ListItem>
                    {loaderSuccess ?
                        <>
                            {simulationFailed ? 
                                <Grid container justifyContent={'center'} alignContent={'center'} sx={{mt:2,textAlign:'center'}}>
                                    <Grid item xs={12}>
                                        <ErrorIcon fontSize="large" color="error" />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="caption" sx={{ color: red[500] }}>Proposal Tx Simulation Failed</Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="caption">A complete Governance Wallet Experience with ❤️ by Grape #OPOS</Typography>
                                    </Grid>
                                </Grid>
                            :
                                <>
                                    <Grid container justifyContent={'center'} alignContent={'center'} sx={{mt:2,textAlign:'center'}}>
                                        <Grid item xs={12}>
                                            {loadingPropCreation ?
                                                <CircularProgress color="success" />
                                            :
                                                <CheckCircleIcon fontSize="large" color="success" />
                                            }
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="caption" sx={{ color: green[500] }}>{loadingText ? loadingText : `Proposal Tx Created`}</Typography>

                                        </Grid>
                                        <Grid item xs={12}>
                                            <Typography variant="caption">A complete Governance Wallet Experience with ❤️ by Grape #OPOS</Typography>
                                        </Grid>
                                    </Grid>
                                    
                                </>

                            }
                        </>
                    :
                        <Grid container justifyContent={'center'} alignContent={'center'} sx={{mt:2,textAlign:'center'}}>
                            <Grid item xs={12}>
                                <CircularProgress color="success" />
                            </Grid>
                            <Grid item xs={12}>
                                <Typography variant="caption" sx={{ color: green[500] }}>Generating Proposal Tx</Typography>
                            </Grid>
                        </Grid>
                    }
                </ListItem>
            </List>
        </Collapse>

        <Collapse in={expanded} timeout="auto" unmountOnExit>
            {(loading || loadingPrices) ?
                <Skeleton variant="rounded" width={'100%'} height={50} />
            :
                <CardContent sx={{ p:0, '& .MuiCardContent-root:last-child': { pb: 0,}, }}>
                    <List sx={{ width: '100%' }} component="div" disablePadding>
                        <Divider light>
                            <Chip label={`Tokens ${nativeTokens && nativeTokens.length}`} size="small" />
                        </Divider>
                        
                        {nativeTokens && nativeTokens
                            //.sort((a:any,b:any) => (b.balance - a.balance))
                            .sort((a, b) => {
                                const priceA = usdcValue[a.address]?.price;
                                const priceB = usdcValue[b.address]?.price;
                                
                                if (priceA !== undefined && priceB !== undefined) {
                                    return (b.balance * priceB) - (a.balance * priceA);
                                  } else if (priceA !== undefined) {
                                    // If only the first token has a price, it should come first
                                    return -1;
                                  } else if (priceB !== undefined) {
                                    // If only the second token has a price, it should come first
                                    return 1;
                                  } else {
                                    // If neither has a price, fall back to sorting by balance
                                    return b.balance - a.balance;
                                  }
                            })
                            //.sort((a:any,b:any) => ((usdcValue && (usdcValue[b.address] && usdcValue[a.address]) && (b.balance * usdcValue[b.address]?.price)-(a.balance * usdcValue[a.address]?.price))) || (b.balance - a.balance))
                            //.sort((a:any,b:any) => (b.balance - a.balance))
                            .map((item: any,key:number) => (   
                                <>
                                    
                                    <ListItem
                                        secondaryAction={
                                            <Box sx={{textAlign:'right'}}>
                                                <Box>
                                                    
                                                    <SendView 
                                                        realm={realm}
                                                        rulesWallet={rulesWallet}
                                                        governanceNativeWallet={walletAddress} 
                                                        expandedLoader={expandedLoader} 
                                                        setExpandedLoader={setExpandedLoader}
                                                        instructions={instructions}
                                                        setInstructions={setInstructions}
                                                        setSelectedNativeWallet={setSelectedNativeWallet}
                                                        masterWallet={masterWallet}
                                                        usdcValue={usdcValue}
                                                        useButtonText={
                                                            item.balance.toLocaleString()
                                                        }
                                                        preSelectedTokenAta={
                                                            item.associated_account
                                                        }
                                                        useButtonType={3}
                                                    />
                                                    
                                                    
                                                {/* 
                                                    <IntegratedGovernanceProposalDialogView 
                                                        governanceAddress={governanceAddress}
                                                        intraDao={false}
                                                        governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                        //governingTokenMint={thisitem.account.governingTokenMint}
                                                        //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                        //payerWallet={publicKey}
                                                        //governanceLookup={governanceLookup}
                                                        //editProposalAddress={thisitem.pubkey}
                                                        //setReload={setReload}

                                                        governanceWallets={governanceWallets}
                                                        useButton={3} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                        useButtonText={
                                                            item.balance.toLocaleString()
                                                        }
                                                        title="Send"
                                                        usePlugin={4}
                                                    />
                                                */}
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
                                                src={item.info.image}
                                            >
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText 
                                            primary={
                                                <CopyToClipboard text={item.address} onCopy={handleCopy}>
                                                    <Button 
                                                        color={'inherit'} 
                                                        variant='text' 
                                                        sx={{m:0,
                                                            p:0,
                                                            mintWidth:'' , 
                                                                '&:hover .MuiSvgIcon-root': {
                                                                    opacity: 1,
                                                                },
                                                            }}
                                                        endIcon={
                                                        <FileCopyIcon 
                                                            fontSize={'small'} 
                                                            sx={{
                                                                color:'rgba(255,255,255,0.25)',
                                                                pr:1,
                                                                opacity: 0,
                                                                fontSize:"10px"}} />
                                                        }
                                                        
                                                    >
                                                        <Typography variant="subtitle1" sx={{color:'white'}}>{item.info.name}</Typography>
                                                    </Button>
                                                </CopyToClipboard>
                                            }
                                            secondary={
                                                <>
                                                    <Typography variant="caption">
                                                        {usdcValue ? 
                                                            <>{usdcValue[item.address] ? 
                                                                <>${usdcValue[item.address]?.price.toFixed(6)}</>
                                                                :<></>
                                                            }</>
                                                        :<></>}</Typography>
                                                        
                                                    {/*
                                                    <Typography variant="caption">ATA {shortenString(item.associated_account,5,5)}</Typography>
                                                    */}
                                                </>
                                            }
                                            />
                                    </ListItem>
                                    
                                    <TokenExpandComponent item={item} />
                                    
                                    
                                    {key+1 < nativeTokens.length && <Divider variant="inset" light component="li" />}
                                
                                </>
                                
                            ))
                        }
                        
                        {(rulesTokens && rulesTokens.length > 0) &&
                            <Divider light>
                                <Chip label={`Rules Wallet Tokens ${rulesTokens && rulesTokens.length}`} size="small" />
                            </Divider>
                        }

                        {rulesTokens && rulesTokens
                            //.sort((a:any,b:any) => (b.balance - a.balance))
                            .sort((a, b) => {
                                const priceA = usdcValue[a.address]?.price;
                                const priceB = usdcValue[b.address]?.price;
                                
                                if (priceA !== undefined && priceB !== undefined) {
                                    return (b.balance * priceB) - (a.balance * priceA);
                                  } else if (priceA !== undefined) {
                                    // If only the first token has a price, it should come first
                                    return -1;
                                  } else if (priceB !== undefined) {
                                    // If only the second token has a price, it should come first
                                    return 1;
                                  } else {
                                    // If neither has a price, fall back to sorting by balance
                                    return b.balance - a.balance;
                                  }
                            })
                            .map((item: any,key:number) => (   
                                <>
                                <ListItem
                                    secondaryAction={
                                        <Box sx={{textAlign:'right'}}>
                                            <Box>

                                                <SendView 
                                                    realm={realm}
                                                    rulesWallet={rulesWallet}
                                                    governanceNativeWallet={walletAddress} 
                                                    expandedLoader={expandedLoader} 
                                                    setExpandedLoader={setExpandedLoader}
                                                    instructions={instructions}
                                                    setInstructions={setInstructions}
                                                    setSelectedNativeWallet={setSelectedNativeWallet}
                                                    masterWallet={masterWallet}
                                                    usdcValue={usdcValue}
                                                    useButtonText={
                                                        item.balance.toLocaleString()
                                                    }
                                                    preSelectedTokenAta={
                                                        item.associated_account
                                                    }
                                                    useButtonType={3}
                                                />

                                                {/*
                                                <IntegratedGovernanceProposalDialogView 
                                                    governanceAddress={governanceAddress}
                                                    intraDao={false}
                                                    governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                    //governingTokenMint={thisitem.account.governingTokenMint}
                                                    //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                    //payerWallet={publicKey}
                                                    //governanceLookup={governanceLookup}
                                                    //editProposalAddress={thisitem.pubkey}
                                                    //setReload={setReload}

                                                    governanceWallets={governanceWallets}
                                                    useButton={3} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                    useButtonText={
                                                        item.balance.toLocaleString()
                                                    }
                                                    title="Send"
                                                    usePlugin={4}
                                                />
                                                */}
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
                                            src={item.info.image}
                                        >
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={
                                            <CopyToClipboard text={item.address} onCopy={handleCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        p:0,
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                    <Typography variant="subtitle1" sx={{color:'white'}}>{item.info.name}</Typography>
                                                </Button>
                                            </CopyToClipboard>
                                        } 
                                        secondary={
                                            <>
                                                <Typography variant="caption">
                                                    {usdcValue ? 
                                                        <>{usdcValue[item.address] ? 
                                                            <>${usdcValue[item.address]?.price.toFixed(6)}</>
                                                            :<></>
                                                        }</>
                                                    :<></>}</Typography>
                                                {/*
                                                <Typography variant="caption">ATA {shortenString(item.associated_account,5,5)}</Typography>
                                                */}
                                            </>
                                        }
                                        />
                                </ListItem>
                                <TokenExpandComponent item={item} />
                                {key+1 < rulesTokens.length && <Divider variant="inset" component="li" light />}
                                </>
                            ))
                        }
                    </List>

                </CardContent>
            }
        </Collapse>

        <Collapse in={expandedStake} timeout="auto" unmountOnExit>
            <CardContent sx={{ p:0 }}>
                <List sx={{ width: '100%' }}>
                    <Divider light>
                        <Chip label="Stake Accounts" size="small" />
                    </Divider>
                    <StakeAccountsView />
                </List>
            </CardContent>
        </Collapse>

        <Collapse in={expandedProps} timeout="auto" unmountOnExit>
            <CardContent sx={{ p:0 }}>
                <List sx={{ width: '100%' }}>
                    <Divider light>
                        <Chip label={`Proposals ${proposals && proposals.length}`} size="small" />
                    </Divider>
                    {(proposals && proposals.length > 0) && proposals
                        .sort((a:any,b:any) => (b.account?.draftAt - a.account?.draftAt))
                        .map((item: any,key:number) => (  
                            <> 
                                <ListItem
                                    secondaryAction={
                                        <Box sx={{textAlign:'right'}}>
                                            <Typography variant="subtitle1" sx={{color:'white'}}>
                                                
                                                {item?.pubkey &&
                                                    <GovernanceProposalDialog governanceAddress={governanceAddress} governanceProposal={item?.pubkey?.toBase58()} />
                                                }
                                                
                                                {/*
                                                <Tooltip title="View Proposal">
                                                    <IconButton
                                                        href={item?.pubkey ? `https://governance.so/proposal/${governanceAddress}/${item?.pubkey.toBase58()}` : `#`}
                                                        target='_blank'
                                                        size='small'
                                                    >
                                                        <ZoomOutMapIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                */}
                                            </Typography>
                                            <Typography variant="caption" sx={{color:'#919EAB'}}>
                                                {item.account?.signingOffAt ?
                                                    <>{moment.unix(Number((item.account?.signingOffAt))).format("MMMM D, YYYY, h:mm a")}</>
                                                :
                                                    <>{moment.unix(Number((item.account?.draftAt))).format("MMMM D, YYYY, h:mm a")}</>
                                                }
                                            </Typography>
                                        </Box>
                                    }
                                    key={key}
                                >
                                    <ListItemAvatar>
                                        <Avatar>
                                            {/*
                                                0:'Draft',
                                                1:'Signing Off',
                                                2:'Voting',
                                                3:'Succeeded',
                                                4:'Executing',
                                                5:'Completed',
                                                6:'Cancelled',
                                                7:'Defeated',
                                                8:'Executing w/errors!',
                                                9:'Vetoed',
                                            */}
                                            {item.account?.state ?
                                                <>
                                                {item.account.state === 0 ?
                                                    <EditNoteIcon />
                                                :
                                                    <>
                                                    {item.account.state === 2 ?
                                                            <HowToVoteIcon />
                                                        :
                                                        <>
                                                            {item.account.state === 3 ?
                                                                    <ThumbUpIcon color={'success'}  />
                                                                :
                                                                <>
                                                                    {(item.account.state === 7 || item.account.state === 9) ?
                                                                            <ThumbDownIcon color={'error'} />
                                                                        :
                                                                        <>
                                                                            {(item.account.state === 4 || item.account.state === 8) ?
                                                                                    <AccessTimeIcon />
                                                                                :
                                                                                <>
                                                                                    {(item.account.state === 6) ?
                                                                                            <CancelIcon color={'error'}  />
                                                                                        :
                                                                                        <>
                                                                                            {(item.account.state === 5) ?
                                                                                                <CheckCircleIcon color={'success'} />
                                                                                            :
                                                                                                <HowToVoteIcon />
                                                                                            }
                                                                                        </>
                                                                                    }
                                                                                </>
                                                                            }
                                                                        </>
                                                                    }
                                                                </>
                                                            }
                                                        </>
                                                    }
                                                    </>
                                                
                                                }
                                                </>
                                                :<><EditNoteIcon /></>
                                            }
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={
                                            <CopyToClipboard text={item?.pubkey && item.pubkey.toBase58()} onCopy={handleCopy}>
                                                <Button color={'inherit'} variant='text' sx={{m:0,p:0}}>
                                                    <Typography variant="subtitle1" sx={{color:'white'}}>{item.account?.name && item.account?.name.substring(0,20)+"..."}</Typography>
                                                </Button>
                                            </CopyToClipboard>
                                        } 
                                        secondary={
                                            <>
                                            {item.account?.state ? GOVERNANCE_STATE[+item.account.state]:``}
                                            </>
                                        }
                                        />
                                </ListItem>
                                
                                {/*
                                    owner: new PublicKey(ownerItem.owner),
                                    pubkey: new PublicKey(account?.pubkey),
                                    account:{
                                        accountType: account.accountType,
                                        governance: new PublicKey(account.governance),
                                        governingTokenMint: new PublicKey(account.governingTokenMint),
                                        state: account.state,
                                        tokenOwnerRecord: new PublicKey(account.tokenOwnerRecord),
                                        signatoriesCount: account.signatoriesCount,
                                        signatoriesSignedOffCount: account.signatoriesSignedOffCount,
                                        descriptionLink: account.descriptionLink,
                                        name: account.name,
                                        voteType: account.voteType,
                                        options,
                                        denyVoteWeight: account?.denyVoteWeight ? parseInt(account.denyVoteWeight) : "00",
                                        reserved1: account.reserved1,
                                        draftAt: account.draftAt,
                                        signingOffAt: account.signingOffAt,
                                        votingAt: account.votingAt,
                                        votingAtSlot: account.votingAtSlot,
                                        executionFlags: account.executionFlags,
                                        vetoVoteWeight: account.vetoVoteWeight,
                                        abstainVoteWeight: account?.abstainVoteWeight,
                                        closedAt: account?.closedAt,
                                        executingAt: account?.executingAt,
                                        maxVoteWeight: account?.maxVoteWeight,
                                        maxVotingTime: account?.maxVotingTime,
                                        startVotingAt: account?.startVotingAt,
                                        voteThreshold: account?.voteThreshold,
                                        votingCompletedAt: account?.votingCompletedAt,
                                    }
                                }
                                */}
                            {key+1 < proposals.length && <Divider variant="inset" component="li" light />}
                            </>  
                        ))
                        
                    }
                </List>
            </CardContent>
        </Collapse>
        
        <Collapse in={expandedNft} timeout="auto" unmountOnExit>
            <CardContent sx={{ p:0 }}>
                <List sx={{ width: '100%' }}>
                    <Divider light>
                        <Chip label={`Collectibles ${nativeNftTokens && nativeNftTokens.length}`} size="small" />
                    </Divider>
                    {nativeNftTokens && nativeNftTokens
                        .sort((a:any,b:any) => (a.compression.compressed - b.compression.compressed))
                        .map((item: any,key:number) => (   
                            <>
                                <ListItem
                                    secondaryAction={
                                        <Box>
                                            <IntegratedGovernanceProposalDialogView 
                                                governanceAddress={governanceAddress}
                                                intraDao={false}
                                                governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                //governingTokenMint={thisitem.account.governingTokenMint}
                                                //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                //payerWallet={publicKey}
                                                //governanceLookup={governanceLookup}
                                                //editProposalAddress={thisitem.pubkey}
                                                //setReload={setReload}

                                                governanceWallets={governanceWallets}
                                                useButton={3} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                useButtonText={
                                                    1
                                                }
                                                title="Send"
                                                usePlugin={4}
                                            />
                                        </Box>
                                    }
                                    key={key}
                                >
                                    <ListItemAvatar>
                                        <Avatar
                                            src={item.content.links.image}
                                        >
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={
                                            <CopyToClipboard text={item.id} onCopy={handleCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        p:0,
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                    <Typography variant="subtitle1" sx={{color:'white'}}>{item.content.metadata.name}</Typography>
                                                </Button>
                                            </CopyToClipboard>
                                        } 
                                        secondary={
                                            <>
                                            {item.content.metadata.symbol}
                                            {item.compression.compressed ? <><CompressIcon sx={{fontSize:'11px',ml:1}}/></>:<></>}</>
                                        }
                                        />
                                </ListItem>
                                <TokenExpandComponent item={item} type={1} />

                                {key+1 < nativeNftTokens.length && <Divider variant="inset" component="li" light/>}
                            </>
                        ))
                    }

                    {(rulesNftTokens && rulesNftTokens.length > 0) &&
                        <Divider light>
                            <Chip label={`Rules Wallet Collectibles ${rulesNftTokens && rulesNftTokens.length}`} size="small" />
                        </Divider>
                    }

                    {rulesNftTokens && rulesNftTokens
                        .sort((a:any,b:any) => (a.compression.compressed - b.compression.compressed))
                        .map((item: any,key:number) => (   
                            <>
                                <ListItem
                                    secondaryAction={
                                        <Box>
                                            <IntegratedGovernanceProposalDialogView 
                                                governanceAddress={governanceAddress}
                                                intraDao={false}
                                                governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                //governingTokenMint={thisitem.account.governingTokenMint}
                                                //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                //payerWallet={publicKey}
                                                //governanceLookup={governanceLookup}
                                                //editProposalAddress={thisitem.pubkey}
                                                //setReload={setReload}

                                                governanceWallets={governanceWallets}
                                                useButton={3} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                useButtonText={
                                                    1
                                                }
                                                title="Send"
                                                usePlugin={4}
                                            />
                                        </Box>
                                    }
                                    key={key}
                                >
                                    <ListItemAvatar>
                                        <Avatar
                                            src={item.content.links.image}
                                        >
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={
                                            <CopyToClipboard text={item.id} onCopy={handleCopy}>
                                                <Button 
                                                    color={'inherit'} 
                                                    variant='text' 
                                                    sx={{m:0,
                                                        p:0,
                                                        mintWidth:'' , 
                                                            '&:hover .MuiSvgIcon-root': {
                                                                opacity: 1,
                                                            },
                                                        }}
                                                    endIcon={
                                                    <FileCopyIcon 
                                                        fontSize={'small'} 
                                                        sx={{
                                                            color:'rgba(255,255,255,0.25)',
                                                            pr:1,
                                                            opacity: 0,
                                                            fontSize:"10px"}} />
                                                    }
                                                    
                                                >
                                                    <Typography variant="subtitle1" sx={{color:'white'}}>{item.content.metadata.name}</Typography>
                                                </Button>
                                            </CopyToClipboard>
                                        } 
                                        secondary={
                                            <>
                                            {item.content.metadata.symbol}
                                            {item.compression.compressed ? <><CompressIcon sx={{fontSize:'11px',ml:1}}/></>:<></>}</>
                                        }
                                        />
                                </ListItem>
                                <TokenExpandComponent item={item} type={1} />

                                {key+1 < rulesNftTokens.length && <Divider variant="inset" component="li" light />}
                            </>
                            
                        ))
                    }
                </List>

            </CardContent>
        </Collapse>
        
        <BootstrapDialog
            onClose={handleCloseDialog}
            aria-labelledby="customized-dialog-title"
            open={openDialog}
            PaperProps={{
                style: {
                    boxShadow: '3',
                    borderRadius: '17px',
                    padding:2,
                    },
                }}
        >
            <DialogContentText id="alert-dialog-description">
                <div style={{ height: "auto", margin: "0 auto", maxWidth: "256px", marginTop:"10px",borderRadius: "10px",padding:10, backgroundColor:'#fff',border:'2px solid black' }}>
                    <QRCode
                        size={256}
                        style={{ height: "auto", maxWidth: "100%" }}
                        value={walletAddress}
                        viewBox={`0 0 256 256`}
                    />
                </div>

                <Grid container>
                    <Grid item xs={12} textAlign={'center'}>
                        <Typography variant='caption'>Send to this Native Address</Typography>
                    </Grid>
                    <Grid item xs={12} textAlign={'center'}>
                        <CopyToClipboard text={walletAddress} onCopy={handleCopy}>
                        <Button 
                                color={'inherit'} 
                                variant='text' 
                                sx={{m:0,
                                    p:0,
                                    mintWidth:'' , 
                                        '&:hover .MuiSvgIcon-root': {
                                            opacity: 1,
                                        },
                                    }}
                                endIcon={
                                    <FileCopyIcon 
                                        fontSize={'small'} 
                                        sx={{
                                            color:'rgba(255,255,255,0.25)',
                                            pr:1,
                                            opacity: 0,
                                            fontSize:"10px"}} />
                                    }
                            >
                                <Typography variant='caption'>{walletAddress}</Typography>
                            </Button>
                        </CopyToClipboard>
                    </Grid>
                    
                </Grid>
                
            </DialogContentText>
        </BootstrapDialog>

        
    </Card>
        <Snackbar
            open={isCopied}
            autoHideDuration={2000}
            onClose={handleCloseSnackbar}
            sx={{zIndex:'99999'}}
        >
            <Alert onClose={handleCloseSnackbar} severity="success">
            Copied to clipboard!
            </Alert>
        </Snackbar>
    </>
        
    );
}
