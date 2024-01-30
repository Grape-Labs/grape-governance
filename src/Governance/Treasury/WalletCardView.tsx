import * as React from 'react';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import axios from "axios";
import moment from 'moment';
import { styled } from '@mui/material/styles';
import IconButton, { IconButtonProps } from '@mui/material/IconButton';
import { red } from '@mui/material/colors';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import QRCode from "react-qr-code";
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

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

import {
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
  } from '@mui/material/';

import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
} from './../api/queries';

import ExtensionsMenuView from './plugins/ExtensionsMenu';
import { IntegratedGovernanceProposalDialogView } from '../IntegratedGovernanceProposal';

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
    
    // on direct links handle the event that the rules are not being sent over and only the wallet is sent for rules
    const rulesWallet = props?.rulesWallet;
    
    const walletAddress = props?.walletAddress;
    
    const rulesWalletAddress = rulesWallet ? new PublicKey(rulesWallet.pubkey).toBase58() : props?.rulesWalletAddress;
                                                
    const tokenMap = props?.tokenMap;
    const communityMintDecimals = props?.communityMintDecimals;
    const governanceAddress = props?.governanceAddress;
    const governanceValue = props?.governanceValue;
    const setGovernanceValue = props?.setGovernanceValue;

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
    const [totalWalletValue, setTotalWalletValue] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const isLoading = React.useRef(false);
    const [loadingPrices, setLoadingPrices] = React.useState(false);
    const [isCopied, setIsCopied] = React.useState(false);

    const [openDialog, setOpenDialog] = React.useState(false);
    
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
                <IntegratedGovernanceProposalDialogView 
                    //governanceAddress={governanceAddress}
                    governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                    //governingTokenMint={thisitem.account.governingTokenMint}
                    //proposalAuthor={thisitem.account.tokenOwnerRecord}
                    //payerWallet={publicKey}
                    //governanceLookup={governanceLookup}
                    //editProposalAddress={thisitem.pubkey}
                    //setReload={setReload}
                    
                    useButton={4} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                    useButtonText={"Create Proposal"}
                    title="Create Proposal"
                    //usePlugin={1}
                />
                <Divider light />
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
                                        <CopyToClipboard text={realm?.communityMint} onCopy={handleCopy}>
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

            // get domains
            const domains1 = await getWalletDomains(new PublicKey(walletAddress));
            const domains2 = await getWalletDomains(new PublicKey(rulesWalletAddress));

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

            setNativeDomains(domains1);
            setRulesDomains(domains2);

            //setNativeStakeAccounts(stake1);
            //setRulesStakeAccounts(stake2);
                    
            // unify tokens?
            // think of how we can display them unified if needed
            setLoading(false);
            isLoading.current = false;
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
            let tokenAccountVal = 0;
            let stakeAccountVal = 0;
            let solAccountVal = usdcValue['So11111111111111111111111111111111111111112'].price*(+nativeSol + +rulesSol)
            //alert(usdcValue['So11111111111111111111111111111111111111112'].price + " " +(+nativeSol + +rulesSol));
            totalVal += solAccountVal;
            
            if (nativeTokens){
                for (let item of nativeTokens){
                    if (usdcValue[item.address]){
                        tokenAccountVal += usdcValue[item.address].price * item.balance;
                    }

                }
            }
            if (rulesTokens){
                for (let item of rulesTokens){
                    if (usdcValue[item.address]){
                        tokenAccountVal += usdcValue[item.address].price * item.balance;
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
            totalVal+=stakeAccountVal;
            setTotalWalletValue(totalVal);
            rulesWallet.walletValue = totalVal;

            const newGovernanceObject = {
                address: walletAddress,
                totalVal: totalVal,
                solAccountVal: solAccountVal,
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
    
    return (
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
                <>{
                (nativeDomains && nativeDomains.length > 0) &&
                    <>{nativeDomains[0].name}</>}   
                    
                </>

            }
        />

        <Grid sx={{mt:1}}>
            <Divider light />
        </Grid>

        <Grid container
            sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}}
        > 

            <Grid xs={12} sx={{display: 'flex', justifyContent: 'center'}}>
            
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={100} height={40} sx={{m:1,p:0}} />
                :
                    <h1>${
                        totalWalletValue &&
                        (totalWalletValue.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
                    }</h1>

                    
                }
                
            </Grid>
            <Grid xs={6} sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}} >
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={100} height={60} sx={{m:1,p:0}} />
                :
                    <Button 
                        size="large" 
                        variant="contained" 
                        onClick={handleClickOpenDialog}
                        color='primary'
                        sx={{backgroundColor:'rgba(255,255,255,0.05)',pl:2,pr:2}}>Receive</Button>
                }
            </Grid>
            <Grid xs={6} sx={{textAlign:'center', display: 'flex', justifyContent: 'center'}}>
                {(loading || loadingPrices) ?
                    <Skeleton variant="rounded" width={100} height={60} sx={{m:1,p:0}} />
                :
                    <IntegratedGovernanceProposalDialogView 
                        //governanceAddress={governanceAddress}
                        governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                        //governingTokenMint={thisitem.account.governingTokenMint}
                        //proposalAuthor={thisitem.account.tokenOwnerRecord}
                        //payerWallet={publicKey}
                        //governanceLookup={governanceLookup}
                        //editProposalAddress={thisitem.pubkey}
                        //setReload={setReload}
                        
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
                        <Skeleton variant="rounded" width={'100%'} height={50} />
                    :
                        <>
                            <ListItem
                                secondaryAction={
                                    <Box sx={{textAlign:'right'}}>
                                        <Box>
                                            <IntegratedGovernanceProposalDialogView 
                                                //governanceAddress={governanceAddress}
                                                governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                //governingTokenMint={thisitem.account.governingTokenMint}
                                                //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                //payerWallet={publicKey}
                                                //governanceLookup={governanceLookup}
                                                //editProposalAddress={thisitem.pubkey}
                                                //setReload={setReload}
                                                
                                                useButton={2} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                useButtonText={
                                                    (nativeSol && rulesSol) ? `${(nativeSol+rulesSol).toFixed(6)}`
                                                    :`Send`}
                                                title="Send"
                                                usePlugin={5}
                                            />
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
                                    secondary={<Typography variant="caption">{usdcValue && `$${usdcValue['So11111111111111111111111111111111111111112'].price.toFixed(2)}`}</Typography>}
                                    />
                            </ListItem>
                            <Divider component="li" light />
                        </>
                    }
                </List>
                
                
            </Typography>
        </CardContent>
        <CardActions disableSpacing>
            <IconButton aria-label="share" disabled={true}>
                <ShareIcon />
            </IconButton>
            <ExtensionsMenuView 
                governanceNativeWallet={walletAddress}
            />
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

            {nativeNftTokens && nativeNftTokens.length > 0 &&
                <Tooltip title="Show NFTs">
                    <Badge color="primary" badgeContent={nativeNftTokens.length + +rulesNftTokens?.length} max={999}>
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
                {nativeTokens && nativeTokens.length > 0 &&
                <>
                    <Tooltip title="Show Tokens">
                        <Badge color="primary" badgeContent={nativeTokens.length + +rulesTokens?.length} max={999}>
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
                                                <IntegratedGovernanceProposalDialogView 
                                                    //governanceAddress={governanceAddress}
                                                    governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                    //governingTokenMint={thisitem.account.governingTokenMint}
                                                    //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                    //payerWallet={publicKey}
                                                    //governanceLookup={governanceLookup}
                                                    //editProposalAddress={thisitem.pubkey}
                                                    //setReload={setReload}
                                                    useButton={3} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                    useButtonText={
                                                        item.balance.toLocaleString()
                                                    }
                                                    title="Send"
                                                    usePlugin={4}
                                                />
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
                                                <IntegratedGovernanceProposalDialogView 
                                                    //governanceAddress={governanceAddress}
                                                    governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                    //governingTokenMint={thisitem.account.governingTokenMint}
                                                    //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                    //payerWallet={publicKey}
                                                    //governanceLookup={governanceLookup}
                                                    //editProposalAddress={thisitem.pubkey}
                                                    //setReload={setReload}
                                                    useButton={3} // null edit draft // 1 main Send // 2 SOL Transfer // 3 Token Transfer 
                                                    useButtonText={
                                                        item.balance.toLocaleString()
                                                    }
                                                    title="Send"
                                                    usePlugin={4}
                                                />
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
                    {proposals && proposals
                        .sort((a:any,b:any) => (b.account?.draftAt - a.account?.draftAt))
                        .map((item: any,key:number) => (  
                            <> 
                                <ListItem
                                    secondaryAction={
                                        <Box sx={{textAlign:'right'}}>
                                            <Typography variant="subtitle1" sx={{color:'white'}}>
                                                <Tooltip title="View Proposal">
                                                    <IconButton
                                                        href={item?.pubkey ? `https://governance.so/proposal/${governanceAddress}/${item?.pubkey.toBase58()}` : `#`}
                                                        target='_blank'
                                                        size='small'
                                                    >
                                                        <ZoomOutMapIcon />
                                                    </IconButton>
                                                </Tooltip>
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
                                            {item.account?.state &&
                                                <>
                                                {item.account.state === 2 ?
                                                    <HowToVoteIcon />
                                                :
                                                    <>
                                                    {item.account.state === 0 ?
                                                            <EditNoteIcon />
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
                                            {item.account?.state && GOVERNANCE_STATE[item.account.state]}
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
                                                //governanceAddress={governanceAddress}
                                                governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                //governingTokenMint={thisitem.account.governingTokenMint}
                                                //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                //payerWallet={publicKey}
                                                //governanceLookup={governanceLookup}
                                                //editProposalAddress={thisitem.pubkey}
                                                //setReload={setReload}
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
                                                //governanceAddress={governanceAddress}
                                                governanceRulesWallet={new PublicKey(rulesWalletAddress)}
                                                //governingTokenMint={thisitem.account.governingTokenMint}
                                                //proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                //payerWallet={publicKey}
                                                //governanceLookup={governanceLookup}
                                                //editProposalAddress={thisitem.pubkey}
                                                //setReload={setReload}
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
                    },
                }}
        >
            <DialogContentText id="alert-dialog-description">
                <div style={{ height: "auto", margin: "0 auto", maxWidth: "100%", width: "100%", borderRadius: "10px", padding:10, backgroundColor:'#fff' }}>
                    <QRCode
                        size={256}
                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                        value={walletAddress}
                        viewBox={`0 0 256 256`}
                    />
                </div>

                <Grid container>
                    <Grid item xs={12} textAlign={'center'}>
                        <CopyToClipboard text={walletAddress} onCopy={handleCopy}>
                            <Button color={'inherit'} variant='text'>
                                <Typography variant='body2'>{walletAddress}</Typography>
                            </Button>
                        </CopyToClipboard>
                    </Grid>
                    <Grid item xs={12} textAlign={'center'}>
                        <Typography variant='caption'>Send to this SOL Address</Typography>
                    </Grid>
                </Grid>
                
            </DialogContentText>
        </BootstrapDialog>

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
    </Card>
        
    );
}
