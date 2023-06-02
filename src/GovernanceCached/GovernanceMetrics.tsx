import { getRealm, getAllProposals, getGovernance, getGovernanceAccounts, getGovernanceChatMessages, getTokenOwnerRecord, getTokenOwnerRecordsByOwner, getAllTokenOwnerRecords, getRealmConfigAddress, getGovernanceAccount, getAccountTypes, GovernanceAccountType, tryGetRealmConfig, getRealmConfig  } from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import BN from 'bn.js';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import dayjs, { Dayjs } from 'dayjs';

import {
    Chart,
    BarSeries,
    Title,
    ArgumentAxis,
    ValueAxis,
    Legend
  } from '@devexpress/dx-react-chart-material-ui';
  import { Stack, Animation } from '@devexpress/dx-react-chart';

import { 
    DesktopDatePicker,
    MobileDatePicker,
    LocalizationProvider
} from '@mui/x-date-pickers/';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import {
  Typography,
  Button,
  Grid,
  Box,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Table,
  TableContainer,
  TableCell,
  TableHead,
  TableBody,
  TableFooter,
  TableRow,
  TablePagination,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  Chip,
  Badge,
  ButtonGroup,
  CircularProgress,
  Alert,
  TextField
} from '@mui/material/';

import { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';

import GovernanceNavigation from './GovernanceNavigation'; 
import {
    fetchGovernanceLookupFile,
    fetchGovernanceMasterMembersFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import HubIcon from '@mui/icons-material/Hub';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import GitHubIcon from '@mui/icons-material/GitHub';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CloseIcon from '@mui/icons-material/Close';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import TimerIcon from '@mui/icons-material/Timer';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import IconButton from '@mui/material/IconButton';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import HowToVoteIcon from '@mui/icons-material/HowToVote';

import PropTypes from 'prop-types';
import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

const Root = props => (
    <Legend.Root {...props} sx={{ display: 'flex', margin: 'auto', flexDirection: 'row' }} />
  );
  const Label = props => (
    <Legend.Label {...props} sx={{ whiteSpace: 'nowrap' }} />
  );

  const BootstrapTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} arrow classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.arrow}`]: {
      color: theme.palette.common.black,
    },
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: 'rgba(0,0,0,0.9)',
      borderRadius: '17px'
    },
  }));
  
const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: theme.palette.grey[theme.palette.mode === 'light' ? 200 : 800],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: theme.palette.mode === 'light' ? '#1a90ff' : '#ffffff',
    },
  }));

const StyledTable = styled(Table)(({ theme }) => ({
    '& .MuiTableCell-root': {
        borderBottom: '1px solid rgba(255,255,255,0.05)'
    },
}));

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

const GOVERNANNCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing w/errors!',
}

function RenderVoterRecordTable(props:any) {
    //const [governanceStartDate, setGovernanceStartDate] = React.useState(props.governanceStartDate);
    //const [governanceEndDate, setGovernanceEndDate] = React.useState(props.governanceEndDate);
    const cachedTransactionMap = props.cachedTransactionMap;
    const renderCount = props.renderCount;
    const setRenderCount = props.setRenderCount;
    const governanceStartDate = props.governanceStartDate;
    const governanceEndDate = props.governanceEndDate;
    const [loadingTable, setLoadingTable] = React.useState(false);
    const setMetricsObject = props.setMetricsObject;
    const setMetricsFlowsObject = props.setMetricsFlowsObject;
    
    const endTimer = props.endTimer;
    const cachedGovernance = props.cachedGovernance;
    const memberMap = props.memberMap;
    const governanceMasterMembers = props.governanceMasterMembers;
    const governanceType = props.governanceType;
    const governingTokenDecimals = props.governingTokenDecimals;
    const governaningTokenMint = props.governingTokenMint;
    const tokenMap = props.tokenMap;
    const realm = props.realm;
    const thisToken = props.thisToken;
    const proposals = props.proposals;
    const nftBasedGovernance = props.nftBasedGovernance;
    const governanceAddress = props.governanceAddress;
    const [csvGenerated, setCSVGenerated] = React.useState(null);
    //const [renderCount, setRenderCount] = React.useState(0);

    const awardsComparator = (v1, v2, cellParams1, cellParams2) => {
        // Get the nested object values
        const value1 = cellParams1.row.totalawards.governanceRewards;
        const value2 = cellParams2.row.totalawards.governanceRewards;

        // Perform comparison
        if (value1 < value2) {
        return -1;
        }
        if (value1 > value2) {
        return 1;
        }
        return 0;
    };

    const [voterRecordRows, setVoterRecordRows] = React.useState(null);
    const votingrecordcolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true},
        { field: 'pubkey', headerName: 'PublicKey', width: 260, hide: true},
        { field: 'voter', headerName: 'Voter', width: 260, hide: false,
            renderCell: (params) => {
                return(
                    <ExplorerView showSolanaProfile={true} grapeArtProfile={true} address={params.value} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
        },
        { field: 'currentvotes', headerName: 'Current Voting Power', width: 200, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{getFormattedNumberToLocale(Number(params.value))}</>
                )
            }
        },
        { field: 'totalawards', headerName: 'Total Awarded', width: 170, hide: false, align: 'right',
            sortable: true, // Enable sorting on this column
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                // Custom sorting logic based on governanceRewards field
                const governanceRewards1 = cellParams1.value.governanceRewards || 0;
                const governanceRewards2 = cellParams2.value.governanceRewards || 0;
                return governanceRewards1 - governanceRewards2;
            },
            renderCell: (params) => {
                return(
                    <>
                        {params.value &&
                            <>
                            <Tooltip title={
                                <ul>
                                    {params.value?.governanceRewardDetails &&
                                    <>
                                        
                                        {params.value.governanceRewardDetails.map((item: any, index:number) => (
                                            <li>
                                                <strong>{getFormattedNumberToLocale(Number(item.tokenTransfers.tokenAmount))}</strong> {moment.unix(Number(item?.timestamp)).format("YYYY-MM-DD HH:mm")}
                                                <br/><Typography sx={{fontSize:'8px'}}>{item.signature}</Typography>
                                            </li>)
                                        )}
                                    </>}
                                </ul>}>
                                <Button color='inherit' sx={{borderRadius:'17px'}}>
                                    {getFormattedNumberToLocale(Number(params.value.governanceRewards).toFixed(0))}
                                </Button>
                            </Tooltip>
                            </>
                        }
                    </>
                )
            }
        },
        { field: 'currentunstakedvotes', headerName: 'Unstaked Voting Power', width: 200, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{getFormattedNumberToLocale(Number(params.value))}</>
                )
            }
        },
        { field: 'unstakedpercentage', headerName: 'Unstaked %', width: 125, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{(params.value*100).toFixed(1)}%</>
                )
            }
        },
        { field: 'councilvotes', headerName: 'Council', width: 100, hide: false, align: 'right',},
        { field: 'councilunstakedvotes', headerName: 'Unstaked Council Votes', width: 100, hide: false, align: 'right',},
        { field: 'firstparticipationdate', headerName: 'First Participating Proposal Date', width: 200, hide: false, align: 'right',
        renderCell: (params) => {
            return(
                <>
                    {params.value ?
                        <>
                            {moment.unix(Number(params.value)).format("YYYY-MM-DD HH:mm")}
                        </>
                    :
                        <>No Participation</>
                    }
                </>
            )
        }
        },
        { field: 'lastparticipationdate', headerName: 'Last Participating Proposal Date', width: 200, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value ?
                            <>
                                {moment.unix(Number(params.value)).format("YYYY-MM-DD HH:mm")}
                            </>
                        :
                            <>No Participation</>
                        }
                    </>
                )
            }
        },
        { field: 'lastcommunityproposalcreated', headerName: 'Last Community Proposal Created Date', width: 200, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value ?
                            <>
                                {moment.unix(Number(params.value)).format("YYYY-MM-DD HH:mm")}
                            </>
                        :
                            <>-</>
                        }
                    </>
                )
            }
        },
        { field: 'lastcouncilproposalcreated', headerName: 'Last Council Proposal Created Date', width: 200, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value ?
                            <>
                                {moment.unix(Number(params.value)).format("YYYY-MM-DD HH:mm")}
                            </>
                        :
                            <>-</>
                        }
                    </>
                )
            }
        },
        { field: 'firstwallettransactiondate', headerName: 'Wallet Age', width: 200, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value ?
                            <>
                                {moment.unix(Number(params.value)).format("YYYY-MM-DD HH:mm")}
                            </>
                        :
                            <>-</>
                        }
                    </>
                )
            }
        },
        { field: 'totalproposalscreated', headerName: 'Proposals Created', width: 170, hide: false, align: 'right',},
        { field: 'communitypropcreatorpassed', headerName: 'Community Proposals Created & Passed', width: 170, hide: false, align: 'right',},
        { field: 'councilpropcreatorpassed', headerName: 'Council Proposals Created & Passed', width: 170, hide: false, align: 'right',},
        { field: 'totalvotes', headerName: 'Total Votes Casted', width: 170, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{getFormattedNumberToLocale(Number(params.value))}</>
                )
            }
        },
        { field: 'totalvotesfor', headerName: 'Total Votes For', width: 170, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{getFormattedNumberToLocale(Number(params.value))}</>
                )
            }
        },
        { field: 'totalvotesagainst', headerName: 'Total Votes Against', width: 170, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{getFormattedNumberToLocale(Number(params.value))}</>
                )
            }
        },
        { field: 'totalproposalparticipation', headerName: 'Total Proposal Participation', width: 170, hide: false, align: 'right',},
        { field: 'totalproposalsfor', headerName: 'Total Proposals For', width: 170, hide: false, align: 'right',},
        { field: 'totalproposalsagainst', headerName: 'Total Proposals Against', width: 170, hide: false, align: 'right',},
        { field: 'totalcouncilproposalscreated', headerName: 'Council Props Created', width: 170, hide: false, align: 'right',},
        { field: 'totalcouncilvotes', headerName: 'Council Participation', width: 170, hide: false, align: 'right',},
        { field: 'totalcouncilvotesfor', headerName: 'Council For', width: 170, hide: false, align: 'right',},
        { field: 'totalcouncilvotesagainst', headerName: 'Council Against', width: 170, hide: false, align: 'right',},
        { field: 'successfullcasts', headerName: 'Successfull Casts', width: 170, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value &&
                            <>{params.value}</>
                        }
                    </>
                )
            }
        },
        { field: 'successfullcastrate', headerName: 'Successfull Cast Rate', width: 170, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value &&
                            <>
                            {params.value*100 > 0.1 ?
                                <>
                                {(params.value*100).toFixed(1)}
                                </>
                                :
                                <>0</>
                            }%</>
                        }
                    </>
                )
            }
        },
        { field: 'ecosystemparticipation', headerName: 'Ecosystem DAO Participation', width: 170, hide: false, align: 'right',
            sortable: true, // Enable sorting on this column
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                // Custom sorting logic based on governanceRewards field
                const param1 = cellParams1.value.length || 0;
                const param2 = cellParams2.value.length || 0;
                return param1 - param2;
            },    
            renderCell: (params) => {
                return(
                    <>
                        {params.value &&
                            <>
                            <Tooltip title={
                                <ul>
                                    {params.value.map((item: any, index:number) => (
                                        <li>
                                            {item.governanceName} {item.staked.governingTokenDepositAmount > 0 && ` - Community`} {item.staked.governingCouncilDepositAmount > 0 && ` - Council`}
                                        </li>)
                                    )}
                                </ul>}>
                                <Button color='inherit' sx={{borderRadius:'17px'}}>
                                    {params.value.length}
                                </Button>
                            </Tooltip>
                            </>
                        }
                    </>
                )
            }
        },
        { field: 'multisigs', headerName: 'Other Multisig Participation', width: 170, hide: false, align: 'right',
            sortable: true, // Enable sorting on this column
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                // Custom sorting logic based on governanceRewards field
                const param1 = cellParams1.value.multisigs?.length || 0;
                const param2 = cellParams2.value.multisigs?.length || 0;
                return param1 - param2;
            },   
            renderCell: (params) => {
                return(
                    <>
                        {params.value &&
                            <>
                            <BootstrapTooltip 
                                sx={{bgcolor:'none'}}
                                title={
                                <List
                                    sx={{borderRadius:'17px',width: '100%',bgcolor:'rgba(0,0,0,0.25)'}}
                                >
                                    {params.value.multisigs && params.value.multisigs.length > 0 && params.value.multisigs.map((item: any, index:number) => (
                                        <ListItem>
                                            <Button
                                                color='inherit' 
                                                sx={{borderRadius:'17px',textTransform:'none'}}
                                                to={`https://v3.squads.so/dashboard/${Buffer.from(item.address).toString('base64')}`}
                                                target='_blank'
                                                component={Link}
                                            >
                                                <ListItemAvatar>
                                                {item.metadata?.image && item.metadata.image.length > 0 ?
                                                    <Avatar alt={item.address} src={item.metadata.image} />
                                                :
                                                    <Avatar alt={item.address} ><HubIcon /></Avatar>
                                                }
                                                    
                                                
                                                </ListItemAvatar>
                                                <ListItemText primary={<>{item.metadata.name} <OpenInNewIcon sx={{fontSize:'12px'}} /></>} secondary={<>
                                                    <Typography variant="caption">
                                                        Participants: <strong>{item.account.keys.length}</strong><br/>
                                                        {item.metadata.createdTime.toString().length > 10 ? moment(item.metadata.createdTime).format("YYYY-MM-DD HH:mm") : moment.unix(item.metadata.createdTime).format("YYYY-MM-DD HH:mm")}<br/>
                                                        <Typography sx={{fontSize:'7px'}}>{item.address}</Typography>
                                                        </Typography>
                                                </>} />
                                           </Button>
                                            
                                        
                                        </ListItem>)
                                    )}
                                </List>}>
                                <Button 
                                    color='inherit' 
                                    sx={{borderRadius:'17px'}}
                                    >
                                    {params.value.multisigs && params.value.multisigs.length}
                                </Button>
                            </BootstrapTooltip>
                            </>
                        }
                    </>
                )
            }
        },
    ]

    const exportFile = async(csvFile:string, fileName:string) => {
        //setStatus(`File generated! - ${finalList.length} proposals`);
        
        if (csvFile){
            const jsonCSVString = `data:text/csv;chatset=utf-8,${csvFile}`;
            setCSVGenerated(jsonCSVString);
        }
    }

    const renderGovernanceTransactionRecords = async () => {
        let count = 0;
        let inflows = 0;
        let outflows = 0;
        let nowinflows = 0;
        let nowoutflows = 0;
        let previousinflows = 0;
        let previousoutflows = 0;
        
        let tokenName = null;
        let tokenIcon = null;

        const transactionsData = new Array();
        const balanceOverTimeData = new Array();
        const nowstamp = moment(new Date()).format("YYYY-MM");
        const previousstamp = moment(new Date()).subtract(1, 'M').format("YYYY-MM");
        if (cachedTransactionMap){
            for (var transaction of cachedTransactionMap){
                //if (count < 3)
                //    console.log("transaction: "+JSON.stringify(transaction));
                
                    let timestamp = moment.unix(Number(transaction.blockTime)).format("YYYY-MM-DD HH:ss");
                    let monthstamp = moment.unix(Number(transaction.blockTime)).format("YYYY-MM");

                    var skip = false;
                    if (governanceStartDate && governanceEndDate){
                        if (governanceStartDate < governanceEndDate){
                            skip = true;
                            if ((Number(transaction.blockTime) >= governanceStartDate) && 
                                (Number(transaction.blockTime) <= governanceEndDate)){
                                console.log("Skipping TX")
                                skip = false;
                            }
                        }
                    }

                    if (!skip){
                        
                        let address = transaction.change.address;
                        let changeType = transaction.change.changeType;
                        let changeAmount = transaction.change.changeAmount/Math.pow(10, (transaction.change?.decimals || 0));
                        let tokenAddress = transaction.change.tokenAddress;
                        let prebalance = transaction.change?.preBalance/Math.pow(10, (transaction.change?.decimals || 0));
                        let postbalance = transaction.change?.postBalance/Math.pow(10, (transaction.change?.decimals || 0));
                        
                        tokenName = transaction.change?.tokenName;
                        tokenIcon = transaction.change?.tokenIcon;

                        if (new PublicKey(realm.account.communityMint).toBase58() === tokenAddress){
                            
                            if (prebalance > 0 && postbalance > 0)
                                balanceOverTimeData.push({
                                    date:monthstamp,
                                    prebalance:prebalance,
                                    postbalance:postbalance,
                                })
                            
                            //console.log(count+": "+timestamp+" "+address+" ("+tokenName+") "+tokenAddress+" "+changeType+" "+changeAmount)
                            if (changeAmount > 0){ //((changeType === "inc")||(changeAmount > 0)){ // inflow
                                inflows += changeAmount;
                                if (nowstamp === monthstamp)
                                    nowinflows += changeAmount;
                                if (previousstamp === monthstamp)
                                    previousinflows += changeAmount;
                                
                                var foundTd = false;
                                for (var td of transactionsData){
                                    if (td.date === monthstamp){
                                        foundTd = true;
                                        td.inflows += changeAmount;
                                    }
                                }
                                if (!foundTd){
                                    if (changeAmount > 0)
                                        transactionsData.push({
                                            date:monthstamp,
                                            inflows:changeAmount,
                                            outflows:0,
                                        })
                                }
                            } else {//if (changeType === "dec"){ // dec outflow - not always accurate
                                outflows += changeAmount;
                                if (nowstamp === monthstamp)
                                    nowoutflows += changeAmount;
                                if (previousstamp === monthstamp)
                                    previousoutflows += changeAmount;
                                
                                var foundTd = false;
                                for (var td of transactionsData){
                                    if (td.date === monthstamp){
                                        foundTd = true;
                                        td.outflows += changeAmount;
                                    }
                                }
                                if (!foundTd){
                                    if (changeAmount > 0)
                                        transactionsData.push({
                                            date:monthstamp,
                                            inflows:0,
                                            outflows:changeAmount,
                                        })
                                }
                            }
                        }
                    }
                
                    
                count++;
            }
        }

        console.log("All Inflows: "+inflows);
        console.log("All Outflows: "+inflows);

        const mfObj = {
            metricsInflows:Number(nowinflows.toFixed(0)),
            metricsOutflows:Number(nowoutflows.toFixed(0)),
            metricsPreviousInflows:Number(previousinflows.toFixed(0)),
            metricsPreviousOutflows:Number(previousoutflows.toFixed(0)),
            governanceTransactionsData:transactionsData.length > 0 ? transactionsData.reverse() : null,
            governanceBalanceOverTimeData:balanceOverTimeData.length > 0 ? balanceOverTimeData.reverse() : null,
            governanceCommunityTokenMintName:tokenName,
            governanceCommunityTokenMintLogo:tokenIcon

        }
        setMetricsFlowsObject(mfObj);
    }

    const renderVoterRecords = async () => {
        
        // we need to make a new object and push the voters
        var voterArray = new Array();
        let totalCouncilHolders = 0;
        let totalEligibleVoters = 0;
        let totalActiveVoters = 0;
        let totalVotesDeposited = 0;
        let totalCommunityParticipation = 0;
        let totalCouncilParticipation = 0;
        let totalCommunityProposals = 0;
        let totalCouncilProposals = 0;
        let totalVotesCasted = 0;
        let totalProposals = 0;
        let totalCommunityPassed = 0;
        let totalCommunityDefeated = 0;
        let totalCouncilPassed = 0;
        let totalCouncilDefeated = 0;
        let propsByMonth = new Array();
        
        let participantArray = new Array();
        let tStakedVotes = 0;
        let tCouncilVotes = 0;
        let tVotesCasted = 0;
        let tDepositedCouncilVotesCasted = 0;
        let tParticipants = 0;
        let aParticipants = 0;
        let lParticipants = 0;
        var highestParticipation = 0;
        var highestParticipationProposalName = null;
        var totalInstructions = 0;
        var totalProposalsWInstructions = 0;
        setLoadingTable(true);
        
        var foundVoter = false;
        var voterCount = 0;
        var counter = 0;
        
        
        const govmastermembermap = governanceMasterMembers.reduce((map:any, item:any) => {
            //tarray.push({address:item.address, decimals:item.decimals})
            map.set(item.address, item);
            return map;
        },new Map())

        //console.log("govmastermembermap: "+govmastermembermap);
        
        const govmembermap = memberMap.reduce((map:any, item:any) => {
            //tarray.push({address:item.address, decimals:item.decimals})
            map.set(item.pubkey, item);
            return map;
        },new Map())

        //console.log("govmembermap: "+JSON.stringify(govmembermap));

        for (var memberItem of memberMap){
            foundVoter = false;

            if (realm.account.config?.councilMint){
                if (new PublicKey(memberItem.account?.governingTokenMint).toBase58() == new PublicKey(realm.account.config?.councilMint).toBase58()){
                    let tmp = +(Number("0x"+memberItem.account.governingTokenDepositAmount));
                    if (tmp > 0)
                        totalCouncilHolders++;
                }
            }

            for (var voterItem of voterArray){
                if (memberItem.account.governingTokenOwner === voterItem.pubkey){
                    foundVoter = true;
                    var depositedgovernancevotes = 0;
                    var depositedcouncilvotes = 0;
                    if (new PublicKey(realm.account.communityMint).toBase58() === new PublicKey(memberItem.account.governingTokenMint).toBase58()){
                        depositedgovernancevotes = +((Number("0x"+memberItem.account.governingTokenDepositAmount)/Math.pow(10, +governingTokenDecimals)).toFixed(0));
                        voterItem.currentvotes = depositedgovernancevotes;
                    } else if (new PublicKey(realm.account.config.councilMint).toBase58() === new PublicKey(memberItem.account.governingTokenMint).toBase58()){
                        depositedcouncilvotes = +(Number("0x"+memberItem.account.governingTokenDepositAmount));
                        voterItem.councilvotes = depositedcouncilvotes;
                    }

                    totalVotesDeposited += depositedgovernancevotes;
                }
            }

            if (realm.account.config?.councilMint){
                if (new PublicKey(memberItem.account?.governingTokenMint).toBase58() !== new PublicKey(realm.account.config?.councilMint).toBase58()){
                    tVotesCasted += memberItem.account.totalVotesCount;//record.account.governingTokenDepositAmount.toNumber();
                    tParticipants++;
                } else{
                    tCouncilVotes += memberItem.account.totalVotesCount;
                    tDepositedCouncilVotesCasted += Number(memberItem.account.governingTokenDepositAmount);
                }
            } else{
                tVotesCasted += memberItem.account.totalVotesCount;//record.account.governingTokenDepositAmount.toNumber();
                tParticipants++;
            }
            
            if (!foundVoter){
                depositedgovernancevotes = 0;
                depositedcouncilvotes = 0;
                let unstakedgovernancevotes = 0;
                let unstakedcouncilvotes = 0;
                
                //if (new PublicKey(memberItem.account.governingTokenOwner).toBase58() === inner_item.governingTokenOwner.toBase58()){

                    //let governanceRewards = memberItem?.governanceAwards ? +memberItem.governanceAwards :  0;
                    let governanceRewardDetails = memberItem?.governanceAwardDetails ? memberItem.governanceAwardDetails :  null;
                    

                    let filteredGovernanceRewards = 0;
                    let filteredGovernanceRewardDetails = [];

                    if (governanceRewardDetails){
                        let governanceRewardDetailsParsed = governanceRewardDetails;// JSON.parse(governanceRewardDetails);
                        for (var rewardsItem of governanceRewardDetailsParsed){
                            let skipReward = false;
                            if (governanceStartDate && governanceEndDate){
                                if (governanceStartDate < governanceEndDate){
                                    skipReward = true;
                                    if ((Number(Number(rewardsItem?.timestamp)) >= governanceStartDate) && 
                                        (Number(Number(rewardsItem?.timestamp)) <= governanceEndDate)){
                                            console.log("Skipping Reward "+rewardsItem.signature)
                                            skipReward = false;
                                        }
                                }
                            }
                            if (!skipReward){
                                filteredGovernanceRewards += +rewardsItem.tokenTransfers.tokenAmount;
                                //console.log(">> filteredGovernanceRewards "+filteredGovernanceRewards + " vs " + rewardsItem.tokenTransfers.tokenAmount)
                                filteredGovernanceRewardDetails.push(rewardsItem);
                            }
                        }
                    }

                    if (new PublicKey(realm.account.communityMint).toBase58() === new PublicKey(memberItem.account.governingTokenMint).toBase58()){
                        depositedgovernancevotes = +(Number("0x"+memberItem.account.governingTokenDepositAmount)/Math.pow(10, +governingTokenDecimals)).toFixed(0);
                    }else if (new PublicKey(realm.account.config.councilMint).toBase58() === new PublicKey(memberItem.account.governingTokenMint).toBase58()){
                        depositedcouncilvotes = (Number("0x"+memberItem.account.governingTokenDepositAmount));
                    }
                    
                    //console.log(memberItem.account.governingTokenOwner+": "+rewards)
                    
                    unstakedgovernancevotes = (memberItem.walletBalance?.tokenAmount?.amount ? Number((+memberItem.walletBalance.tokenAmount.amount /Math.pow(10, memberItem.walletBalance.tokenAmount.decimals || 0)).toFixed(0)) : 0)
                
                    unstakedcouncilvotes = (memberItem?.walletCouncilBalance?.tokenAmount?.amount ? Number((+memberItem.walletCouncilBalance.tokenAmount.amount /Math.pow(10, memberItem.walletCouncilBalance.tokenAmount.decimals || 0)).toFixed(0)) : 0)
                //}
                if (depositedgovernancevotes>0)
                    totalEligibleVoters++;
                if (totalvotes>0)
                    totalActiveVoters++;

                totalVotesDeposited += +depositedgovernancevotes;
                
                let participation = govmastermembermap.get(new PublicKey(memberItem.account.governingTokenOwner).toBase58())?.participating;
                
                voterArray.push({
                    id: voterCount+1,
                    pubkey: new PublicKey(memberItem.account.governingTokenOwner).toBase58(),
                    voter: new PublicKey(memberItem.account.governingTokenOwner).toBase58(),
                    currentvotes: depositedgovernancevotes,
                    currentunstakedvotes: unstakedgovernancevotes,
                    unstakedpercentage: (+unstakedgovernancevotes > 0 && +depositedgovernancevotes > 0) ? (+unstakedgovernancevotes/+depositedgovernancevotes > 0.01) ?  +unstakedgovernancevotes/+depositedgovernancevotes : 0 : 0,
                    councilvotes: depositedcouncilvotes,
                    councilunstakedvotes: unstakedcouncilvotes,
                    totalproposalscreated: 0,
                    totalvotes: 0,
                    totalvotesfor: 0,
                    totalvotesagainst: 0,
                    totalproposalparticipation: 0,
                    totalproposalsfor: 0,
                    totalproposalsagainst: 0,
                    totalcouncilproposalscreated: 0,
                    totalcouncilvotes: 0,
                    totalcouncilvotesfor: 0,
                    totalcouncilvotesagainst: 0,
                    lastparticipationdate: null,
                    firstparticipationdate: null,
                    lastcommunityproposalcreated: null,
                    lastcouncilproposalcreated: null,
                    firstwallettransactiondate: memberItem?.firstTransactionDate ? memberItem.firstTransactionDate : null,
                    successfullcasts: 0,
                    councilpropcreatorpassed: 0,
                    communitypropcreatorpassed: 0,
                    totalawards:{ 
                        governanceRewards:filteredGovernanceRewards,
                        governanceRewardDetails:filteredGovernanceRewardDetails
                    },
                    ecosystemparticipation: participation,
                    multisigs: memberItem?.multisigs,
                                    
                })
                voterCount++;
            }
        }

        //console.log("total staked "+tStakedVotes)

        if (cachedGovernance){
            var voter = 0;
            let csvFile = '';
            let participationCount = 0;

            for (var item of cachedGovernance){

                let skipProp = false;
                if (governanceStartDate && governanceEndDate){
                    if (governanceStartDate < governanceEndDate){
                        skipProp = true;
                        // check if proposal draft date is within start/end
                        //console.log("draft at "+Number(item.account?.draftAt))
                        if ((Number(item.account?.draftAt) >= governanceStartDate) && 
                            (Number(item.account?.draftAt) <= governanceEndDate)){
                                console.log("Skipping Prop "+item.pubkey)
                                skipProp = false;
                            }
                    }
                }

                if (!skipProp){
                    const authorPk = item.account.tokenOwnerRecord;
                    let authorAddress = null;

                    if (authorPk){
                        if (govmembermap){

                            //for (var memberItem of memberMap){
                            //    if (new PublicKey(memberItem.pubkey).toBase58() === authorPk.toBase58()){
                                //console.log("member author 1: "+JSON.stringify((new PublicKey(authorPk).toBase58())));
                                //console.log("member author 2: "+JSON.stringify(govmembermap.get(new PublicKey(authorPk).toBase58())));
                                authorAddress = new PublicKey(govmembermap.get(new PublicKey(authorPk).toBase58())?.account.governingTokenOwner).toBase58()
                            //    }
                            //}
                            
                        }
                    }

                    if (item?.instructions && item?.instructions.length > 0){
                        totalProposalsWInstructions++;
                        totalInstructions+=item.instructions.length;
                        
                    }

                    if (item?.votingResults){
                        participationCount = 0;
                        
                        for (var inner_item of item.votingResults){

                            var councilpropcreatorpassed = 0;
                            var communitypropcreatorpassed = 0;
                            var councilpropcreator = 0;
                            var depositedgovernancevotes = 0;
                            var depositedcouncilvotes = 0;
                            var foundParticipant = false;
                            var propcreator = 0;
                            var totalvotes = 0;
                            
                            var totalvotesfor = 0;
                            var totalvotesagainst = 0;
                            var totalproposalparticipation = 1;
                            var totalproposalsfor = 0;
                            var totalproposalsagainst = 0;
                            var totalcouncilvotes = 0;
                            var totalcouncilvotesfor = 0;
                            var totalcouncilvotesagainst = 0;
                            
                            propcreator = 0;
                            //console.log(author+" v "+inner_item.governingTokenOwner.toBase58())
                            if (authorAddress === inner_item.governingTokenOwner.toBase58()){ // has created this proposal
                                if (realm.account.config?.councilMint && (new PublicKey(realm.account.config?.councilMint).toBase58() === item.account.governingTokenMint.toBase58())){ 
                                    councilpropcreator = 1;
                                } else{
                                    propcreator = 1;
                                }
                            }

                            var alltimehighvotes = 0;
                            participationCount++;
                            for (var participant of voterArray){
                                
                                //console.log("t: "+JSON.stringify(item.account))
                                let depositedgovernancevotes = 0;
                                let votersuccess = 0;
                                if (participant.pubkey === inner_item.governingTokenOwner.toBase58()){
                                    foundParticipant = true;
                                    //inner_item.councilMint 
                                    //inner_item.governingTokenMint
                                    //inner_item.decimals
                                    
                                    if (realm.account.config?.councilMint && (new PublicKey(realm.account.config?.councilMint).toBase58() === item.account.governingTokenMint.toBase58())){ // Council Votes
                                        //console.log("council vote...")
                                        totalCouncilParticipation++;

                                        if (inner_item?.vote){
                                            if (inner_item?.vote?.vote?.voteType === 0){
                                                if ((inner_item?.vote?.voterWeight) > 0){
                                                    totalproposalsfor = 1; 
                                                    totalcouncilvotesfor = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);
                                                    totalcouncilvotes = (totalcouncilvotesfor);
                                                    if (item.account.state === 3 || item.account.state === 5)
                                                        votersuccess = 1;
                                                }
                                            } else{
                                                totalcouncilvotesagainst = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//inner_item?.vote?.voterWeight; //getFormattedNumberToLocale(formatAmount(+(parseInt(inner_item?.vote?.voterWeight)/Math.pow(10, inner_item?.vote?.decimals)).toFixed(0)));
                                                totalcouncilvotes = (totalcouncilvotesagainst);
                                                if (item.account.state === 7)
                                                    votersuccess = 1;
                                            }
                                        } else if (inner_item?.vote?.legacyYes) {
                                            if (inner_item?.vote?.legacyYes > 0){
                                                totalcouncilvotesfor = +((inner_item?.vote?.legacyYes)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyYes);
                                                totalcouncilvotes = (totalcouncilvotesfor);
                                                if (item.account.state === 3 || item.account.state === 5)
                                                        votersuccess = 1;
                                            } else if (inner_item?.vote?.legacyNo > 0){
                                                totalcouncilvotesagainst = +((inner_item?.vote?.legacyNo)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyNo);
                                                totalcouncilvotes = (totalcouncilvotesagainst);
                                                if (item.account.state === 7)
                                                    votersuccess = 1;
                                            }
                                        }

                                    } else{ // Non Council
                                        //console.log("non council vote...")
                                        totalCommunityParticipation++;
                                        
                                        if (inner_item?.vote){
                                            if (inner_item?.vote?.vote?.voteType === 0){
                                                if ((inner_item?.vote?.voterWeight) > 0){
                                                    totalproposalsfor = 1; 
                                                    totalvotesfor = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);
                                                    totalvotes = (totalvotesfor);
                                                    if (item.account.state === 3 || item.account.state === 5)
                                                        votersuccess = 1;
                                                }
                                            } else{
                                                totalproposalsagainst = 1; 
                                                totalvotesagainst = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//inner_item?.vote?.voterWeight; //getFormattedNumberToLocale(formatAmount(+(parseInt(inner_item?.vote?.voterWeight)/Math.pow(10, inner_item?.vote?.decimals)).toFixed(0)));
                                                totalvotes = (totalvotesagainst);
                                                if (item.account.state === 7)
                                                    votersuccess = 1;
                                            }
                                        } else if (inner_item?.vote?.legacyYes) {
                                            if (inner_item?.vote?.legacyYes > 0){
                                                totalproposalsfor = 1;
                                                totalvotesfor = +((inner_item?.vote?.legacyYes)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyYes);
                                                totalvotes = (totalvotesfor);
                                                if (item.account.state === 3 || item.account.state === 5)
                                                    votersuccess = 1;
                                            } else if (inner_item?.vote?.legacyNo > 0){
                                                totalproposalsagainst = 1;
                                                totalvotesagainst = +((inner_item?.vote?.legacyNo)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyNo);
                                                totalvotes = (totalvotesagainst);
                                                if (item.account.state === 7)
                                                    votersuccess = 1;
                                            }
                                        }
                                    }

                                    //totalVotesDeposited+=depositedgovernancevotes;

                                    if (votersuccess === 1){
                                        if (authorAddress === inner_item.governingTokenOwner.toBase58()){ // has created this proposal
                                            if (realm.account.config?.councilMint && (new PublicKey(realm.account.config?.councilMint).toBase58() === item.account.governingTokenMint.toBase58())){ 
                                                councilpropcreatorpassed = 1;
                                            } else{
                                                communitypropcreatorpassed = 1;
                                            }
                                        }
                                    }

                                    if (authorAddress === inner_item.governingTokenOwner.toBase58()){ // has created this proposal
                                        if (realm.account.config?.councilMint && (new PublicKey(realm.account.config?.councilMint).toBase58() === item.account.governingTokenMint.toBase58())){ 
                                            if (!participant.lastcouncilproposalcreated)
                                                participant.lastcouncilproposalcreated = +item.account?.draftAt
                                            else if (+item.account?.draftAt && +item.account?.draftAt < participant.lastcouncilproposalcreated)
                                                participant.lastcouncilproposalcreated = +item.account?.draftAt
                                        } else{
                                            if (!participant.lastcommunityproposalcreated)
                                                participant.lastcommunityproposalcreated = +item.account?.draftAt
                                            else if (+item.account?.draftAt && +item.account?.draftAt < participant.lastcouncilproposalcreated)
                                                participant.lastcommunityproposalcreated = +item.account?.draftAt
                                        }
                                    }

                                    if ((totalvotes > 0)&&(participant.totalvotes <= 0))
                                        totalActiveVoters++;
                                    totalVotesCasted+=totalvotes;
                                    
                                    // if the voter is an NFT participant...
                                    console.log("nftBasedGovernance: "+nftBasedGovernance);
                                    
                                    if (!participant.lastparticipationdate){
                                        participant.lastparticipationdate = +item.account?.draftAt;
                                        if (nftBasedGovernance) 
                                            participant.currentvotes = totalvotes;
                                    }else if (+item.account?.draftAt && +item.account?.draftAt > participant.lastparticipation){
                                        participant.lastparticipationdate = +item.account?.draftAt;
                                        if (nftBasedGovernance) 
                                            participant.currentvotes = totalvotes;
                                    }
                                    if (!participant.firstparticipationdate)
                                        participant.firstparticipationdate = +item.account?.draftAt;
                                    else if (+item.account?.draftAt && +item.account?.draftAt < participant.firstparticipationdate)
                                        participant.firstparticipationdate = +item.account?.draftAt;
                                    

                                    /*
                                    for (var masterMember of governanceMasterMembers){
                                        console.log("checking in mastermembers")
                                        if (participant.pubkey === masterMember.pubkey){
                                            if (totalActiveVoters < 2)
                                                console.log("masterMember: "+JSON.stringify(masterMember));
                                        }
                                    }*/

                                    participant.totalproposalscreated += propcreator;
                                    participant.totalvotes += totalvotes;
                                    participant.totalvotesfor += totalvotesfor;
                                    participant.totalvotesagainst += totalvotesagainst;
                                    participant.totalproposalparticipation += totalproposalparticipation;
                                    participant.totalproposalsfor += totalproposalsfor;
                                    participant.totalproposalsagainst += totalproposalsagainst;
                                    participant.totalcouncilproposalscreated += councilpropcreator;
                                    participant.totalcouncilvotes += totalcouncilvotes;
                                    participant.totalcouncilvotesfor += totalcouncilvotesfor;
                                    participant.totalcouncilvotesagainst += totalcouncilvotesagainst;
                                    participant.successfullcasts += votersuccess;
                                    participant.successfullcastrate = participant.successfullcasts/participant.totalproposalparticipation;
                                    participant.councilpropcreatorpassed += councilpropcreatorpassed;
                                    participant.communitypropcreatorpassed += communitypropcreatorpassed;
                                    // check date for participant and add if date > current date
                                    
                                }

                                
                            }
                            
                            if (!foundParticipant){
                                //console.log("not found???")
                                /*
                                depositedgovernancevotes = 0;
                                depositedcouncilvotes = 0;
                                let unstakedgovernancevotes = 0;
                                
                                
                                for (var memberItem of memberMap){
                                    if (new PublicKey(memberItem.account.governingTokenOwner).toBase58() === inner_item.governingTokenOwner.toBase58()){
                                        
                                        // check if council member
                                        //realm.account.communityMint
                                        //realm.account.config.councilMint

                                        if (new PublicKey(realm.account.communityMint).toBase58() === new PublicKey(memberItem.account.governingTokenMint).toBase58()){
                                            depositedgovernancevotes = +(Number("0x"+memberItem.account.governingTokenDepositAmount)/Math.pow(10, +governingTokenDecimals)).toFixed(0);
                                        }else if (new PublicKey(realm.account.config.councilMint).toBase58() === new PublicKey(memberItem.account.governingTokenMint).toBase58()){
                                            depositedcouncilvotes = +(Number(memberItem.account.governingTokenDepositAmount));
                                        }

                                        unstakedgovernancevotes = (memberItem.walletBalance?.tokenAmount?.amount ? Number((+memberItem.walletBalance.tokenAmount.amount /Math.pow(10, memberItem.walletBalance.tokenAmount.decimals || 0)).toFixed(0)) : 0)
                                    }
                                }

                                if (depositedgovernancevotes>0)
                                    totalEligibleVoters++;
                                if (totalvotes>0)
                                    totalActiveVoters++;

                                totalVotesDeposited+=depositedgovernancevotes;
                                totalVotesCasted+=totalvotes;

                                voterArray.push({
                                    id: voter+1,
                                    pubkey: inner_item.governingTokenOwner.toBase58(),
                                    voter: inner_item.governingTokenOwner.toBase58(),
                                    currentvotes: depositedgovernancevotes,
                                    currentunstakedvotes: unstakedgovernancevotes,
                                    unstakedpercentage: +unstakedgovernancevotes/+depositedgovernancevotes,
                                    councilvotes: depositedcouncilvotes,
                                    totalproposalscreated: propcreator,
                                    totalvotes: totalvotes,
                                    totalvotesfor: totalvotesfor,
                                    totalvotesagainst: totalvotesagainst,
                                    totalproposalparticipation: totalproposalparticipation,
                                    totalproposalsfor: totalproposalsfor,
                                    totalproposalsagainst: totalproposalsagainst,
                                    totalcouncilproposalscreated: councilpropcreator,
                                    totalcouncilvotes: totalcouncilvotes,
                                    totalcouncilvotesfor: totalcouncilvotesfor,
                                    totalcouncilvotesagainst: totalcouncilvotesagainst,
                                    lastparticipationdate: +item.account?.draftAt,
                                    successfullcasts: 0
                                })
                                voter++;
                                */
                            }
                            
                        }
                        //let voterCount = voterArray.length;
                        if (participationCount > 0){
                            if (participationCount > highestParticipation){
                                console.log("voterCount: "+participationCount)
                                highestParticipation = participationCount;
                                highestParticipationProposalName = item.account?.name + ' on ' + moment.unix(Number(item.account?.draftAt)).format("YYYY-MM-DD") + ' '+GOVERNANNCE_STATE[item.account.state];
                            }
                        }
                    }

                    // item.account.governingTokenOwner.toBase58()
                    if (realm.account.config?.councilMint && (new PublicKey(realm.account.config?.councilMint).toBase58() === item.account.governingTokenMint.toBase58())){
                        // council stats
                        
                        totalCouncilProposals++;
                        if (item.account.state === 3 || item.account.state === 5)
                            totalCouncilPassed++;
                        else if (item.account.state === 7)
                            totalCouncilDefeated++;
                        
                        let monthts = moment.unix(Number(item.account?.draftAt)).format("YYYY-MM");
                        let pbi_found = false;
                        for (var pbi of propsByMonth){
                            if (pbi.date === monthts){
                                pbi_found = true;
                                pbi.councilcount++;
                                if (item.account.state === 3 || item.account.state === 5) 
                                    pbi.councilpassing++
                                if (item.account.state === 7)
                                    pbi.councildefeated++
                            }
                        }

                        if (!pbi_found){
                            propsByMonth.push({
                                'date':monthts,
                                'councilpassing':(item.account.state === 3 || item.account.state === 5) ? 1 : 0,
                                'councildefeated':(item.account.state === 7) ? 1 :0,
                                'communitypassing':0,
                                'communitydefeated':0,
                                'communitycount':0,
                                'councilcount':1
                            });
                        }
                        
                    } else{
                        totalCommunityProposals++;
                        if (item.account.state === 3 || item.account.state === 5)
                            totalCommunityPassed++;
                        else if (item.account.state === 7)
                            totalCommunityDefeated++;
                        // set the date array

                        //let monthts = moment.unix(Number(item.account?.votingAt)).format("YYYY-MM");
                        let monthts = moment.unix(Number(item.account?.draftAt)).format("YYYY-MM");
                        let pbi_found = false;
                        for (var pbi of propsByMonth){
                            if (pbi.date === monthts){
                                pbi_found = true;
                                pbi.communitycount++;
                                if (item.account.state === 3 || item.account.state === 5) 
                                    pbi.communitypassing++
                                if (item.account.state === 7)
                                    pbi.communitydefeated++
                            }
                        }

                        if (!pbi_found){
                            propsByMonth.push({
                                'date':monthts,
                                'councilpassing':0,
                                'councildefeated':0,
                                'communitypassing':(item.account.state === 3 || item.account.state === 5) ? 1 : 0,
                                'communitydefeated':(item.account.state === 7) ? 1 :0,
                                'communitycount':1,
                                'councilcount':0
                            });
                        }
                    }
                    
                }

                var counter = 0;
                tParticipants = 0;
                tStakedVotes = 0;
                tVotesCasted = 0;
                tCouncilVotes = 0;
                tDepositedCouncilVotesCasted = 0;
                for (var voter_item of voterArray){
                    if (counter > 0)
                        csvFile += '\r\n';
                    else
                        csvFile = 'pubkey,totalproposalscreated,communitypropcreatorpassed,depositedvotes,councildepositedvotes,unstakedvotes,firstparticipationdate,lastparticipationdate,totalvotes,totalvotesfor,totalvotesagainst,totalproposalparticipation,totalproposalsfor,totalproposalsagainst,totalcouncilproposalscreated,councilpropcreatorpassed,totalcouncilvotes,totalcouncilvotesfor,totalcouncilvotesagainst,rewards\r\n';
                    csvFile += voter_item.pubkey+','+voter_item.totalproposalscreated+','+voter_item.communitypropcreatorpassed+','+voter_item.currentvotes+','+voter_item.councilvotes+','+voter_item.currentunstakedvotes+','+voter_item.firstparticipationdate+','+voter_item.lastparticipationdate+','+voter_item.totalvotes+','+voter_item.totalvotesfor+','+voter_item.totalvotesagainst+','+voter_item.totalproposalparticipation+','+voter_item.totalproposalsfor+','+voter_item.totalproposalsagainst+','+voter_item.totalcouncilproposalscreated+','+voter_item.councilpropcreatorpassed+','+voter_item.totalcouncilvotes+','+voter_item.totalcouncilvotesfor+','+voter_item.totalcouncilvotesagainst+','+voter_item.totalawards.governanceRewards;
                    counter++;

                    //tStakedVotes += voter_item.currentvotes;
                    if (voter_item.totalvotes > 0)
                        tStakedVotes += voter_item.currentvotes
                    tVotesCasted += voter_item.totalvotes;
                    tCouncilVotes += voter_item.councilvotes;
                    tDepositedCouncilVotesCasted += voter_item.totalcouncilvotes;
                
                    tParticipants++;
                }

                

            }

            exportFile(csvFile, governanceAddress+'_metrics.csv')

            /*
            let pcount = 0;
            for (let singleParticipant of participantArray){
                    if (pcount > 0)
                        csvFile += '\r\n';
                    else
                        csvFile = 'Member,VotesDeposited,TokenDecimals,RawVotesDeposited,CouncilVotesDeposited\r\n';
                    
                    let formattedDepositedAmount = (+(((singleParticipant.governingTokenDepositAmount))/Math.pow(10, governingTokenDecimals || 0)).toFixed(0));
                    //csvFile += record.account.governingTokenOwner.toBase58()+','+record.account.governingTokenDepositAmount.toNumber();
                    csvFile += singleParticipant.governingTokenOwner.toBase58()+','+formattedDepositedAmount+','+governingTokenDecimals+','+Number(singleParticipant.governingTokenDepositAmount)+','+Number(singleParticipant.governingCouncilDepositAmount);
                
                    pcount++;
            }*/

        }

        const sortedResultsA = voterArray.sort((a,b) => (Number(b.councilvotes) < Number(a.councilvotes)) ? 1 : -1);
        const sortedResultsB = sortedResultsA.sort((a,b) => (Number(a.currentvotes) < Number(b.currentvotes)) ? 1 : -1);

        setVoterRecordRows(sortedResultsB);

        const sortedPropsByMonth = propsByMonth.reverse();

        try{
            /*
            console.log(tParticipants+"("+memberMap.length+"): "+tStakedVotes+ " (decimals: "+governingTokenDecimals+")")
            if (tStakedVotes > 0)
                setMetricsTotalStaked(Number((tStakedVotes).toFixed(0)))

            setMetricsHighestParticipationProposalName(highestParticipationProposalName);
            //console.log("highest participation: "+highestParticipation)
            setMetricsHighestParticipation(highestParticipation);

            // reverse to show in ascending order:
            
            setGovernnaceChartData(sortedPropsByMonth);

            setMetricsProposalsPerMonth(((totalCommunityProposals/propsByMonth.length)).toFixed(1))
            
            setMetricsVoters(voterArray.length)
            setMetricsAverageVotesPerParticipant(getFormattedNumberToLocale(formatAmount(+(totalVotesCasted/totalActiveVoters/totalCommunityProposals).toFixed(0))))
            if (totalCommunityParticipation > 0)
                setMetricsAverageParticipation((totalCommunityParticipation/totalCommunityProposals).toFixed(0))
            setMetricsActiveVoters(totalActiveVoters)
            setMetricsEligibleVoters(totalEligibleVoters)

            if (totalVotesDeposited > 0)
                setMetricsTotalVotesDeposited(totalVotesDeposited);
            else
                setMetricsTotalVotesDeposited(null);
            setMetricsTotalVotesCasted(getFormattedNumberToLocale(formatAmount(totalVotesCasted)));
            setMetricsTotalProposals(totalCommunityProposals+totalCouncilProposals);
            setMetricsTotalCommunityProposals(totalCommunityProposals);
            setMetricsTotalCouncilProposals(totalCouncilProposals)

            if (totalEligibleVoters > 0)
                setMetricsParticipationRate((((totalCommunityParticipation/totalCommunityProposals)/totalEligibleVoters)*100).toFixed(2));
            else
                setMetricsParticipationRate(null);
            setMetricsCommunityPassed(totalCommunityPassed);
            setMetricsCommunityDefeated(totalCommunityDefeated);

            setMetricsTotalInstructions(totalInstructions);
            setMetricsTotalProposalsWithInstructions(totalProposalsWInstructions);
            */
            const mObj = {
                totalStakedVotes:tStakedVotes > 0 ? tStakedVotes : null,
                highestParticipationProposalName:highestParticipationProposalName,
                highestParticipation:highestParticipation,
                governanceChartData:sortedPropsByMonth,
                proposalsCommunityPerMonth:((totalCommunityProposals/propsByMonth.length)).toFixed(1),
                proposalsCouncilPerMonth:((totalCouncilProposals/propsByMonth.length)).toFixed(1),
                voters:voterArray.length,
                averageVotesPerParticipant:getFormattedNumberToLocale(formatAmount(+(totalVotesCasted/totalActiveVoters/totalCommunityProposals).toFixed(0))),
                communityAverageParticipation:(totalCommunityParticipation > 0 ? (totalCommunityParticipation/totalCommunityProposals).toFixed(0) : null),
                councilAverageParticipation:(totalCouncilParticipation > 0 ? (totalCouncilParticipation/totalCouncilProposals).toFixed(0) : null),
                totalActiveVoters:totalActiveVoters,
                totalEligibleVoters:totalEligibleVoters,
                totalCouncilHolders:totalCouncilHolders,
                totalVotesDeposited:(totalVotesDeposited ? totalVotesDeposited : 0),
                totalVotesCasted:getFormattedNumberToLocale(formatAmount(totalVotesCasted)),
                totalProposals:totalCommunityProposals+totalCouncilProposals,
                totalCommunityProposals:totalCommunityProposals,
                totalCouncilProposals:totalCouncilProposals,
                communityParticipationRate:((totalEligibleVoters > 0) ? (((totalCommunityParticipation/totalCommunityProposals)/totalEligibleVoters)*100).toFixed(2) : null),
                councilParticipationRate:((totalCouncilHolders > 0) ? (((totalCouncilParticipation/totalCouncilProposals)/totalCouncilHolders)*100).toFixed(2) : null),
                totalCommunityPassed:totalCommunityPassed,
                totalCommunityDefeated:totalCommunityDefeated,
                totalCouncilPassed:totalCouncilPassed,
                totalCouncilDefeated:totalCouncilDefeated,
                totalInstructions:totalInstructions,
                totalProposalsWithInstructions:totalProposalsWInstructions
            }

            setMetricsObject(mObj);

        }catch(e){
            console.log("ERR: "+e);
        }
        
        endTimer();
        setLoadingTable(false);
    }

    React.useEffect(() => { 
        if (!voterRecordRows && cachedGovernance && !loadingTable){
            console.log("Rendering voter records " + renderCount)
            setRenderCount(renderCount+1);
            renderVoterRecords();
            renderGovernanceTransactionRecords();
        }
    }, []);

    React.useEffect(() => { 
        if (governanceStartDate && governanceEndDate){
            if (!loadingTable){
                renderVoterRecords();
            }
        }
    }, [governanceStartDate, governanceEndDate]);

    return (
        <>
            {csvGenerated &&

                <>
                <Grid container sx={{mb:2}}>
                    <Grid item xs={12} sm={6} container justifyContent="flex-start">
                        
                    </Grid>
                    <Grid item xs={12} sm={6} container justifyContent="flex-end">
                        <Tooltip title="Download the Governancne Metrics CSV File">
                            <Button
                                color='inherit'
                                variant='outlined'
                                download={`${governanceAddress}_metrics.csv`}
                                href={csvGenerated}
                                sx={{borderRadius:'17px'}}
                            >
                                <DownloadIcon /> CSV
                            </Button>
                        </Tooltip>
                    </Grid>
                </Grid>
                </>

                
            }
            
        {voterRecordRows ?
            <div style={{ height: 600, width: '100%' }}>
                <div style={{ display: 'flex', height: '100%' }}>
                    <div style={{ flexGrow: 1 }}>
                        
                            <DataGrid
                                rows={voterRecordRows}
                                columns={votingrecordcolumns}
                                pageSize={25}
                                rowsPerPageOptions={[]}
                                sx={{
                                    borderRadius:'17px',
                                    borderColor:'rgba(255,255,255,0.25)',
                                    '& .MuiDataGrid-cell':{
                                        borderColor:'rgba(255,255,255,0.25)'
                                    }}}
                                sortingOrder={['asc', 'desc', null]}
                                disableSelectionOnClick
                            />
                    </div>
                </div>
            </div>
        :
            <LinearProgress color="inherit" />
        }
        </>

    );

}

export function GovernanceMetricsView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey || props?.handlekey;
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const governanceAddress = urlParams;
    const [renderCount, setRenderCount] = React.useState(0);
    //const governanceAddress = props.governanceAddress;
    const [loading, setLoading] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(null);
    const [cachedTransactionMap, setCachedTransactionMap] = React.useState(null);
    const [realm, setRealm] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const connection = RPC_CONNECTION;
    const { publicKey, wallet } = useWallet();
    const [proposals, setProposals] = React.useState(null);
    const [participatingRealm, setParticipatingRealm] = React.useState(null)
    const [nftBasedGovernance, setNftBasedGovernance] = React.useState(false);
    const [thisToken, setThisToken] = React.useState(null);
    const [totalProposals, setTotalProposals] = React.useState(null);
    const [totalPassed, setTotalPassed] = React.useState(null);
    const [totalDefeated, setTotalDefeated] = React.useState(null);
    const [totalVotesCasted, setTotalTotalVotesCasted] = React.useState(null);
    const [governingTokenMint, setGoverningTokenMint] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [governanceType, setGovernanceType] = React.useState(0);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [cachedRealm, setCachedRealm] = React.useState(null);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [governanceMasterMembers, setGovernanceMasterMembers] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);

    const [metricsObject, setMetricsObject] = React.useState(null);
    const [metricsFlowsObject, setMetricsFlowsObject] = React.useState(null);
    const [governanceStartDate, setGovernanceStartDate] = React.useState(null);
    const [governanceEndDate, setGovernanceEndDate] = React.useState(null);
    
    const handleStartDateChange = (newValue: Dayjs | null) => {
        setGovernanceStartDate(newValue.unix());
    }

    const handleEndDateChange = (newValue: Dayjs | null) => {
        setGovernanceEndDate(newValue.unix())
        //setGovernanceEndDate(dayjs.unix(Number(newValue)));
    }

    // average proposals per month
    // voter retention (eligible/all time)
    // voter active retention (active/all time)
    // add search (start/end)
    // top 10 holders deposited
    // top 10 holder % against deposited
    // top 2 holders against quorum
    // Peak voter participation
    // Participating voters votes vs supply
    // quorum?

    const [metricsActiveVoters, setMetricsActiveVoters] = React.useState(null);

    const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    function VotingPower(props: any){
        const tArray = props.tokenArray;
        const pRealm = props.participatingRealm;
        //const [thisToken, setThisToken] = React.useState(null);

        React.useEffect(() => { 
            if (tArray){
                for (const token of tArray){
                    if (token.address === participatingRealm?.account?.governingTokenMint.toBase58()){
                        setThisToken(token);
                    }
                }
            }
        }, [pRealm]);

        return (
            <>
            {thisToken && 
                <>
                    {getFormattedNumberToLocale(formatAmount(parseInt(participatingRealm?.account?.governingTokenDepositAmount)/Math.pow(10, +thisToken?.decimals)))} votes
                </>
            }
            </>
        );

    }

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tmap = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map())
                setTokenMap(tmap);
                setTokenArray(tarray);
                return tmap;
            });
        } catch(e){console.log("ERR: "+e)}
    }

    const getGovernance = async (cached_governance:any, cached_member_map: any) => {
        if (!loading){
            startTimer();
            setLoading(true);
            try{
                    
                console.log("SPL Governance: "+governanceAddress);
                
                //console.log("cached_governance: "+JSON.stringify(cached_governance));
                
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                
                let grealm = null;
                if (cachedRealm){
                    console.log("Realm from cache")
                    grealm = cachedRealm;
                } else{
                    grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
                }
                setRealm(grealm);
                //setRealmName(grealm?.account?.name);
                const realmPk = grealm.pubkey;
                
                let rawTokenOwnerRecords = null;
                if (cached_member_map){
                    console.log("Using Cached Member Map")
                    rawTokenOwnerRecords = cached_member_map;
                } else{
                    console.log("RPC Member Map");
                    rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, grealm.owner, realmPk)
                }

                setMemberMap(rawTokenOwnerRecords);
                
                let gTD = null;
                let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account?.communityMint))
                //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
                gTD = tokenDetails.value.data.parsed.info.decimals;
                setGoverningTokenDecimals(gTD);
                
                if (grealm.account?.communityMint){
                    try{
                        if (tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58())){
                            setGovernanceType(0);
                            //gTD = tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58()).decimals;
                            //setGoverningTokenDecimals(gTD);
                        } else{
                            const btkn = await getBackedTokenMetadata(new PublicKey(grealm.account?.communityMint).toBase58(), wallet);
                            if (btkn){ // Strata backed token
                                setGovernanceType(1);
                                //gTD = btkn.decimals;
                                //setGoverningTokenDecimals(gTD)
                            } else{ // NFT
                                setGovernanceType(2);
                                //gTD = 0;
                                //setGoverningTokenDecimals(gTD);
                            }
                        }
                    } catch(emt){
                        if (tokenMap.get(grealm.account?.communityMint)){
                            setGovernanceType(0);
                            //gTD = tokenMap.get(grealm.account?.communityMint).decimals;
                            //setGoverningTokenDecimals(gTD);
                        } else{
                            const btkn = await getBackedTokenMetadata(grealm.account?.communityMint, wallet);
                            if (btkn){
                                setGovernanceType(1);
                                //gTD = btkn.decimals;
                                //setGoverningTokenDecimals(gTD)
                            } else{
                                setGovernanceType(2);
                                //gTD = 6;
                                //setGoverningTokenDecimals(gTD);
                            }
                        }
                    }
                }

                if (cached_governance){
                    
                    
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    const allprops: any[] = [];
                    for (var prop of cached_governance){
                        
                        //console.log("ITEM: "+JSON.stringify(prop))
                        if (prop.account.state === 3 || prop.account.state === 5)
                            passed++;
                        else if (prop.account.state === 7)
                            defeated++;
                    
                        if (prop.account?.yesVotesCount && prop.account?.noVotesCount){
                            //console.log("tmap: "+JSON.stringify(tokenMap));
                            //console.log("item a: "+JSON.stringify(prop))
                            if (tokenMap){
                                ttvc += +(((Number(prop.account?.yesVotesCount) + Number(prop.account?.noVotesCount))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                            }
                            
                        } else if (prop.account?.options) {
                            //console.log("item b: "+JSON.stringify(prop))
                            if (tokenMap){
                                ttvc += +(((Number(prop.account?.options[0].voteWeight) + Number(prop.account?.denyVoteWeight))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                            }
                        }

                        allprops.push(prop);
                        
                    }

                    // use the realm config from cache
                    const realmConfigPk = await getRealmConfigAddress(
                        programId,
                        realmPk
                    )
                    try{
                        const realmConfig = await getRealmConfig(
                            connection,
                            realmConfigPk
                        )

                        if (realmConfig && realmConfig?.account && realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin){
                            //console.log("maxVoterWeightAddinConfig: "+JSON.stringify(realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin));
                            if (realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin.toBase58() === 'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw'){ // NFT based community
                                setNftBasedGovernance(true);
                            }
                        }
                    }catch(errs){console.log("ERR: "+errs)}

                    setTotalDefeated(defeated);
                    setTotalPassed(passed);
                    setTotalProposals(allprops.length);
                    setTotalTotalVotesCasted(ttvc);
                    
                    setProposals(allprops);

                } else {
                    
                    //console.log("B realm: "+JSON.stringify(grealm));

                    //console.log("communityMintMaxVoteWeightSource: " + grealm.account.config.communityMintMaxVoteWeightSource.value.toNumber());
                    
                    if (grealm?.account?.config?.useCommunityVoterWeightAddin){
                        const realmConfigPk = await getRealmConfigAddress(
                            programId,
                            realmPk
                        )
                        //console.log("realmConfigPk: "+JSON.stringify(realmConfigPk));
                        try{ 
                            const realmConfig = await getRealmConfig(
                                connection,
                                realmConfigPk
                            )
                            //console.log("realmConfig: "+JSON.stringify(realmConfig));
                            /*
                            const tryRealmConfig = await tryGetRealmConfig(
                                connection,
                                programId,
                                realmPk
                            )*/
                            
                            //console.log("realmConfig: "+JSON.stringify(realmConfig));
                            //setRealmConfig(realmConfigPK)
                            
                            if (realmConfig && realmConfig?.account && realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin){
                                //console.log("maxVoterWeightAddinConfig: "+JSON.stringify(realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin));
                                if (realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin.toBase58() === 'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw'){ // NFT based community
                                    setNftBasedGovernance(true);
                                }
                            }
                        }catch(errs){
                            console.log("ERR: "+errs)
                        }
                    }

                    const gprops = await getAllProposals(RPC_CONNECTION, grealm.owner, realmPk);
                    const allprops: any[] = [];
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    
                    for (const props of gprops){
                        for (const prop of props){
                            if (prop){
                                allprops.push(prop);
                                if (prop.account.state === 3 || prop.account.state === 5)
                                    passed++;
                                else if (prop.account.state === 7)
                                    defeated++;
                            
                                if (prop.account?.yesVotesCount && prop.account?.noVotesCount){
                                    //console.log("tmap: "+JSON.stringify(tokenMap));
                                    //console.log("item a: "+JSON.stringify(prop))
                                    if (tokenMap){
                                        ttvc += +(((prop.account?.yesVotesCount.toNumber() + prop.account?.noVotesCount.toNumber())/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                                    }
                                    
                                } else if (prop.account?.options) {
                                    //console.log("item b: "+JSON.stringify(prop))
                                    if (tokenMap){
                                        ttvc += +(((prop.account?.options[0].voteWeight.toNumber() + prop.account?.denyVoteWeight.toNumber())/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                                    }
                                }
                            }
                        }
                    }

                    const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                    
                    setTotalDefeated(defeated);
                    setTotalPassed(passed);
                    setTotalProposals(sortedResults.length);
                    setTotalTotalVotesCasted(ttvc);

                    setProposals(sortedResults);

                }
            }catch(e){console.log("ERR: "+e)}
        }
        setLoading(false);
    }

    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    const callGovernanceMasterMembers = async() => {
        const fgmmf = await fetchGovernanceMasterMembersFile(storagePool);
        setGovernanceMasterMembers(fgmmf);
    }

    React.useEffect(() => {
        if (tokenMap){
            callGovernanceLookup();
            callGovernanceMasterMembers();
        }
    }, [tokenMap]);

    React.useEffect(() => {
        if (governanceLookup && !loading){
            getCachedGovernanceFromLookup();
        }
    }, [governanceLookup, governanceAddress]);
    
    React.useEffect(() => {
        if (cachedGovernance && governanceAddress && !loading){
            getGovernance(cachedGovernance, cachedMemberMap);
        }
    }, [cachedGovernance]);
    
    const getCachedGovernanceFromLookup = async () => {
        let cached_governance = new Array();
        let cached_member_map = null;
        let cached_transaction_map = null;
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){

                    if (glitem?.realm){
                        setCachedRealm(glitem?.realm);
                    }
                    if (glitem?.memberFilename){
                        cached_member_map = await getFileFromLookup(glitem.memberFilename, storagePool);
                        if (cached_member_map)
                            setCachedMemberMap(cached_member_map);
                    }
                    if (glitem?.governanceTransactionsFilename){
                        cached_transaction_map = await getFileFromLookup(glitem.governanceTransactionsFilename, storagePool);
                        //console.log("cached_transaction_map "+JSON.stringify(cached_transaction_map))
                        if (cached_transaction_map)
                            setCachedTransactionMap(cached_transaction_map);
                    }
                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);
                    setCachedTimestamp(glitem.timestamp);
                }
            }
        }

        // convert values in governance to BigInt and PublicKeys accordingly
        let counter = 0;
        for (let cupdated of cached_governance){

            cupdated.account.governance = new PublicKey(cupdated.account.governance);
            cupdated.account.governingTokenMint = new PublicKey(cupdated.account.governingTokenMint);
            cupdated.account.tokenOwnerRecord = new PublicKey(cupdated.account.tokenOwnerRecord);
            cupdated.owner = new PublicKey(cupdated.owner);
            cupdated.pubkey = new PublicKey(cupdated.pubkey);

            
            if (cupdated.account?.options && cupdated.account?.options[0]?.voteWeight)
                cupdated.account.options[0].voteWeight = Number("0x"+cupdated.account.options[0].voteWeight)
            if (cupdated.account?.denyVoteWeight)
                cupdated.account.denyVoteWeight = Number("0x"+cupdated.account.denyVoteWeight).toString()

            if (cupdated.account?.yesVotesCount)
                cupdated.account.yesVotesCount = Number("0x"+cupdated.account.yesVotesCount).toString()
            if (cupdated.account?.noVotesCount)
                cupdated.account.noVotesCount = Number("0x"+cupdated.account.noVotesCount).toString()
            
            cupdated.account.draftAt = Number("0x"+cupdated.account.draftAt).toString()
            cupdated.account.signingOffAt = Number("0x"+cupdated.account.signingOffAt).toString()
            cupdated.account.votingAt = Number("0x"+cupdated.account.votingAt).toString()
            cupdated.account.votingAtSlot = Number("0x"+cupdated.account.votingAtSlot).toString()
            cupdated.account.vetoVoteWeight = Number("0x"+cupdated.account.vetoVoteWeight).toString()
            cupdated.account.votingCompletedAt = Number("0x"+cupdated.account.votingCompletedAt).toString()

            // move to nested voting results
            if (cupdated?.votingResults){
                
                for (let inner of cupdated.votingResults){
                    inner.pubkey = new PublicKey(inner.pubkey);
                    inner.proposal = new PublicKey(inner.proposal);
                    inner.governingTokenOwner = new PublicKey(inner.governingTokenOwner);
                    inner.voteAddress = new PublicKey(inner.voteAddress);
                    if (inner.vote?.councilMint)
                        inner.vote.councilMint = new PublicKey(inner.vote.councilMint);
                    inner.vote.governingTokenMint = new PublicKey(inner.vote.governingTokenMint);
                    if (inner.vote?.councilMint)
                        inner.vote.councilMint = new PublicKey(inner.vote.councilMint);
                    inner.vote.governingTokenMint = new PublicKey(inner.vote.governingTokenMint);
                    /*
                    inner.vote.voterWeight = Number("0x"+inner.vote.voterWeight).toString()
                    inner.vote.legacyYes = Number("0x"+inner.vote.legacyYes).toString()
                    inner.vote.legacyNo = Number("0x"+inner.vote.legacyNo).toString()
                    */
                }
            }

            counter++;
        }
        
        setCachedGovernance(cached_governance);
        getGovernance(cached_governance, cached_member_map);
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    React.useEffect(() => { 
        if (!loading){
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);
    
        if(loading){
            return (
                <Box
                    sx={{
                        mt:6,
                        background: 'rgba(0, 0, 0, 0.5)',
                        borderRadius: '17px',
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Typography variant="caption">Crunching All Governance Metrics {governanceAddress}</Typography>
                    
                    <LinearProgress color="inherit" />
                    
                </Box>
            )
        } else{
            if (realm && proposals && memberMap && tokenMap && !loading){
            //if (proposals){
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }} 
                    > 
                        
                            {realm &&
                                <>
                                    <Grid container>
                                        <Grid item xs={12} sm={6} container justifyContent="flex-start">
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <Typography variant="h4">
                                                        {realm.account.name}
                                                        
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button
                                                        size='small'
                                                        sx={{color:'white', borderRadius:'17px'}}
                                                        href={'https://realms.today/dao/'+(governanceAddress)}
                                                        target='blank'
                                                    >
                                                        <Typography variant="caption">
                                                        View on Realms <OpenInNewIcon fontSize='inherit'/>
                                                        </Typography>
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                        <Grid item xs={12} sm={6} container justifyContent="flex-end">
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <GovernanceNavigation governanceAddress={governanceAddress} />
                                                </Grid>
                                                <Grid item xs={12} 
                                                    justifyContent="flex-end"
                                                    alignItems="flex-end"
                                                    sx={{textAlign:'right'}}>
                                                    HISTORICAL METRICS
                                                </Grid>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </>
                            }

                            <Box sx={{ alignItems: 'center', textAlign: 'center',p:1}}>

                                <div>
                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <DesktopDatePicker
                                            label="Start Date"
                                            inputFormat="YYYY/MM/DD"
                                            //value={value}
                                            onChange={handleStartDateChange}
                                            renderInput={(params:any) => <TextField {...params} />}
                                            sx={{mr:1, borderRadius:'17px'}}
                                            />
                                        <DesktopDatePicker
                                            label="End Date"
                                            inputFormat="YYYY/MM/DD"
                                            //value={value}
                                            onChange={handleEndDateChange}
                                            renderInput={(params:any) => <TextField {...params} />}
                                            sx={{ml:1, borderRadius:'17px'}}
                                            />
                                    </LocalizationProvider>

                                </div>

                            </Box>
                            
                            {metricsObject &&
                                <>
                                {metricsObject?.governanceChartData &&
                                    <Box>
                                        <Chart
                                            data={metricsObject.governanceChartData}
                                            >
                                            <ArgumentAxis />
                                            <ValueAxis />
                                                
                                                
                                                    <BarSeries
                                                        name="Community Proposals"
                                                        valueField="communitycount"
                                                        argumentField="date"
                                                    />
                                                    <BarSeries
                                                        name="Community Defeated"
                                                        valueField="communitydefeated"
                                                        argumentField="date"
                                                    />
                                                    <BarSeries
                                                        name="Community Passed"
                                                        valueField="communitypassing"
                                                        argumentField="date"
                                                    />
                                                
                                                    <BarSeries 
                                                        name="Council Proposals"
                                                        valueField="councilcount"
                                                        argumentField="date"
                                                    />
                                                    <BarSeries
                                                        name="Council Passed"
                                                        valueField="councilpassing"
                                                        argumentField="date"
                                                    />
                                                    <BarSeries
                                                        name="Council Defeated"
                                                        valueField="councildefeated"
                                                        argumentField="date"
                                                    />
                                                
                                            <Title text="Proposals" />
                                            <Legend position="bottom" rootComponent={Root} labelComponent={Label} />
                                            
                                            <Stack />
                                        </Chart>
                                    </Box>
                                }

                                <Box sx={{p:1}}>
                                        <Grid container spacing={0}>
                                            <Grid item xs={12} sm={4} md={4} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:2,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>All time Governance</>
                                                    </Typography>
                                                    <Tooltip title={<>
                                                            All time voters that have participated in at least one proposal
                                                            </>
                                                        }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                                sx={{
                                                                    verticalAlign: 'bottom'}}
                                                                >
                                                                    <Typography variant="h4">
                                                                    {metricsObject.voters}
                                                                    </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Box>
                                            </Grid>

                                            <Grid item xs={12} sm={4} md={4} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:2,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>Current Eligible Voters</>
                                                    </Typography>
                                                    <Tooltip title={<>
                                                            A voter that currently maintains voting power in this Governance (+0 votes staked at the time of cached snapshot)<br/>Community/Council
                                                            </>
                                                        }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                                sx={{
                                                                    verticalAlign: 'bottom'}}
                                                                >
                                                                {nftBasedGovernance ?
                                                                        <Typography variant="caption">
                                                                            NFT Based Governance
                                                                        </Typography>  
                                                                    :
                                                                        <Typography variant="h4">
                                                                            {metricsObject?.totalEligibleVoters > 0 && metricsObject.totalEligibleVoters}
                                                                            {(metricsObject?.totalCouncilHolders > 0 && metricsObject?.totalEligibleVoters > 0) && <>/</>}
                                                                            {metricsObject?.totalCouncilHolders > 0 && metricsObject?.totalCouncilHolders}
                                                                        </Typography>
                                                                }
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Box>
                                            </Grid>

                                            <Grid item xs={12} sm={4} md={4} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:2,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>All Time Active Voters</>
                                                    </Typography>
                                                    <Tooltip title={<>
                                                            Voted at least once & currently maintain voting power
                                                            </>
                                                        }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                                sx={{
                                                                    verticalAlign: 'bottom'}}
                                                                >
                                                                <Typography variant="h4">
                                                                    {(metricsObject?.totalActiveVoters && metricsObject.totalActiveVoters > 0) ? 
                                                                        metricsObject.totalActiveVoters
                                                                    :
                                                                        <>
                                                                             {metricsObject?.totalCouncilHolders > 0 && <>{metricsObject?.totalCouncilHolders}</>}
                                                                        </>
                                                                    }
                                                                </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Box>
                                            </Grid>
                                            
                                            {(metricsObject?.totalStakedVotes && metricsObject.totalStakedVotes > 0) &&
                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Total Votes Staked</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                The sum of all votes staked & that have participated in this Governance
                                                                {metricsObject?.totalStakedVotes && 
                                                                    <><br/><b>{getFormattedNumberToLocale(metricsObject.totalStakedVotes)}</b> staked & voted at least once</>
                                                                }
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                        {nftBasedGovernance ?
                                                                            <Typography variant="caption">
                                                                                NFT Based Governance
                                                                            </Typography>  
                                                                        :
                                                                            <>
                                                                            <Typography variant="h4">
                                                                                {metricsObject?.totalVotesDeposited && getFormattedNumberToLocale(formatAmount(metricsObject.totalVotesDeposited))}
                                                                            </Typography>    
                                                                            {metricsObject?.totalVotesDeposited && 
                                                                                <Typography variant="h6">
                                                                                    /{((metricsObject.totalStakedVotes/metricsObject.totalVotesDeposited)*100).toFixed(1)}%
                                                                                </Typography>
                                                                            }
                                                                            </>
                                                                        }
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                            }

                                            {metricsObject?.totalVotesCasted &&
                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Total Votes Casted</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Total all time votes casted for all proposals in this Governnace
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        {metricsObject?.totalVotesCasted && metricsObject.totalVotesCasted}
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                            }
                                            
                                            {metricsObject?.averageVotesPerParticipant &&
                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Average Votes Casted Per Participant</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                The average votes casted per participant/per proposal
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        {metricsObject.averageVotesPerParticipant && metricsObject.averageVotesPerParticipant}
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                            }

                                            <Grid item xs={12} sm={4} md={4} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:2,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>Proposals p/Month</>
                                                    </Typography>
                                                    <Tooltip title={<>
                                                            Community/Council
                                                            </>
                                                        }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                                sx={{
                                                                    verticalAlign: 'bottom'}}
                                                                >
                                                                <Typography variant="h4">
                                                                    {metricsObject?.proposalsCommunityPerMonth ? metricsObject.proposalsCommunityPerMonth : `-`}

                                                                    {(metricsObject?.proposalsCommunityPerMonth && metricsObject?.proposalsCouncilPerMonth) && <>/</>}

                                                                    {metricsObject?.proposalsCouncilPerMonth ? metricsObject.proposalsCouncilPerMonth : `-`}
                                                                </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Box>
                                            </Grid>

                                            <Grid item xs={12} sm={4} md={4} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:2,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>Average Participation</>
                                                    </Typography>
                                                    <Tooltip title={<>
                                                            Average Participation per Proposal<br/>
                                                            The rate at which an eligible voter will cast a vote in a proposal<br/>Community/Council
                                                            </>
                                                        }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                                sx={{
                                                                    verticalAlign: 'bottom'}}
                                                                >
                                                                <Typography variant="h4">
                                                                    {metricsObject?.communityAverageParticipation && metricsObject.communityAverageParticipation}
                                                                </Typography>
                                                                <Typography variant="h6">
                                                                {metricsObject.communityParticipationRate && 
                                                                    <>/{metricsObject.communityParticipationRate}%</>
                                                                }
                                                                </Typography>

                                                                <Typography variant="h4">
                                                                {(metricsObject?.communityAverageParticipation && metricsObject?.councilAverageParticipation) && <>&nbsp;-&nbsp;</>}
                                                                </Typography>

                                                                <Typography variant="h4">
                                                                    {metricsObject?.councilAverageParticipation && metricsObject.councilAverageParticipation}
                                                                </Typography>
                                                                <Typography variant="h6">
                                                                {metricsObject?.councilParticipationRate && 
                                                                    <>/{metricsObject.councilParticipationRate}%</>
                                                                }
                                                                </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Box>
                                            </Grid>

                                            <Grid item xs={12} sm={4} md={4} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:2,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>Highest Participation</>
                                                    </Typography>
                                                    <Tooltip title={<>
                                                            Highest participation on all proposals
                                                            <br/>
                                                            Proposal {metricsObject.highestParticipationProposalName}
                                                            </>
                                                        }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                                sx={{
                                                                    verticalAlign: 'bottom'}}
                                                                >
                                                                <Typography variant="h4">
                                                                    {metricsObject?.highestParticipation && metricsObject.highestParticipation}
                                                                </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Box>
                                            </Grid>
                                            
                                            {metricsObject.totalCommunityProposals > 0 &&
                                                <>
                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Community Proposals</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Total Community Proposals
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        {metricsObject.totalCommunityProposals && metricsObject.totalCommunityProposals}
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>

                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Community Results</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Passing / Defeated
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{metricsObject.totalCommunityPassed}</Badge>/
                                                                        <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{metricsObject.totalCommunityDefeated}</Badge>
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>

                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Community Success Rate</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Passing / Defeated
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{(metricsObject.totalCommunityPassed/metricsObject.totalCommunityProposals*100).toFixed(0)}%</Badge>/
                                                                        <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{(metricsObject.totalCommunityDefeated/metricsObject.totalCommunityProposals*100).toFixed(0)}%</Badge>
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                            </>
                                            }

                                            {metricsObject.totalCouncilProposals > 0 &&
                                                <>
                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Council Proposals</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Total Council Proposals
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        {metricsObject?.totalCouncilProposals && metricsObject.totalCouncilProposals}
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>

                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Council Results</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Passing / Defeated
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{metricsObject.totalCouncilPassed}</Badge>/
                                                                        <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{metricsObject.totalCouncilDefeated}</Badge>
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>


                                                <Grid item xs={12} sm={4} md={4} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Council Success Rate</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Passing / Defeated
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{(metricsObject.totalCouncilPassed/metricsObject.totalCouncilProposals*100).toFixed(0)}%</Badge>/
                                                                        <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{(metricsObject.totalCouncilDefeated/metricsObject.totalCouncilProposals*100).toFixed(0)}%</Badge>
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                            </>
                                            }
    
                                            {metricsObject?.totalInstructions ?
                                                <Grid item xs={12} sm={6} md={6} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Instructions</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Total Instructions from a total of {metricsObject.totalProposals} proposals
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        {metricsObject.totalInstructions}
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                                :<></>
                                            }

                                            {metricsObject.totalProposalsWithInstructions ?
                                                
                                                <Grid item xs={12} sm={6} md={6} key={1}>
                                                    <Box
                                                        sx={{
                                                            borderRadius:'24px',
                                                            m:2,
                                                            p:1,
                                                            background: 'rgba(0, 0, 0, 0.2)'
                                                        }}
                                                    >
                                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                            <>Proposal with Instructions</>
                                                        </Typography>
                                                        <Tooltip title={<>
                                                                Proposals with Instructions/Average Instructions per Proposal
                                                                </>
                                                            }>
                                                            <Button
                                                                color='inherit'
                                                                sx={{
                                                                    borderRadius:'17px'
                                                                }}
                                                            >
                                                                <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                    <Typography variant="h4">
                                                                        {metricsObject.totalProposalsWithInstructions}
                                                                    
                                                                    </Typography>
                                                                        <Typography variant="h6">
                                                                        /{((metricsObject.totalProposalsWithInstructions/metricsObject.totalProposals)).toFixed(1)}
                                                                        </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Box>
                                                </Grid>
                                                :<></>
                                            }

                                            {metricsFlowsObject &&
                                                <>
                                                {metricsFlowsObject?.metricsInflows ?
                                                    <>
                                                    {metricsFlowsObject.metricsOutflows ?
                                                    <Grid item xs={12} sm={6} md={6} key={1}>
                                                        <Box
                                                            sx={{
                                                                borderRadius:'24px',
                                                                m:2,
                                                                p:1,
                                                                background: 'rgba(0, 0, 0, 0.2)'
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                                <>Current Months Inflows/Outflows</>
                                                            </Typography>
                                                            <Tooltip title={<>
                                                                    Current Months Inflows/Outflows in Governance Votes (Community Mint: {metricsFlowsObject.governanceCommunityTokenMintName})
                                                                    </>
                                                                }>
                                                                <Button
                                                                    color='inherit'
                                                                    sx={{
                                                                        borderRadius:'17px'
                                                                    }}
                                                                >
                                                                    <Grid container
                                                                        sx={{
                                                                            verticalAlign: 'bottom'}}
                                                                        >
                                                                        <Typography variant="h4">
                                                                            {metricsFlowsObject?.metricsInflows && 
                                                                                <Badge badgeContent={<ArrowDownwardIcon sx={{ fontSize: 10 }} />} color="success">
                                                                                    {getFormattedNumberToLocale(metricsFlowsObject.metricsInflows)}
                                                                                </Badge>
                                                                            }
                                                                                /
                                                                            {metricsFlowsObject?.metricsOutflows && 
                                                                                <Badge badgeContent={<ArrowUpwardIcon sx={{ fontSize: 10 }} />} color="error">
                                                                                    {getFormattedNumberToLocale(metricsFlowsObject.metricsOutflows)}
                                                                                </Badge>
                                                                            }
                                                                        </Typography>
                                                                    </Grid>
                                                                </Button>
                                                            </Tooltip>
                                                        </Box>
                                                    </Grid>
                                                    :<></>}
                                                    </>:<></>
                                                }

                                                {metricsFlowsObject?.metricsPreviousInflows ?
                                                <>{metricsFlowsObject.metricsPreviousOutflows ?

                                                    <Grid item xs={12} sm={6} md={6} key={1}>
                                                        <Box
                                                            sx={{
                                                                borderRadius:'24px',
                                                                m:2,
                                                                p:1,
                                                                background: 'rgba(0, 0, 0, 0.2)'
                                                            }}
                                                        >
                                                            <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                                <>Previous Month Inflows/Outflows</>
                                                            </Typography>
                                                            <Tooltip title={<>
                                                                    Previous Month Inflows/Outflows in Governance Votes (Community Mint: {metricsFlowsObject.governanceCommunityTokenMintName})
                                                                    </>
                                                                }>
                                                                <Button
                                                                    color='inherit'
                                                                    sx={{
                                                                        borderRadius:'17px'
                                                                    }}
                                                                >
                                                                    <Grid container
                                                                        sx={{
                                                                            verticalAlign: 'bottom'}}
                                                                        >
                                                                        <Typography variant="h4">
                                                                            {metricsFlowsObject?.metricsPreviousInflows && 
                                                                                <Badge badgeContent={<ArrowDownwardIcon sx={{ fontSize: 10 }} />} color="success">
                                                                                    {getFormattedNumberToLocale(metricsFlowsObject.metricsPreviousInflows)}
                                                                                </Badge>
                                                                            }
                                                                                /
                                                                            {metricsFlowsObject?.metricsPreviousOutflows && 
                                                                                <Badge badgeContent={<ArrowUpwardIcon sx={{ fontSize: 10 }} />} color="error">
                                                                                    {getFormattedNumberToLocale(metricsFlowsObject.metricsPreviousOutflows)}
                                                                                </Badge>
                                                                            }
                                                                        </Typography>
                                                                    </Grid>
                                                                </Button>
                                                            </Tooltip>
                                                        </Box>
                                                    </Grid>
                                                    :<></>}
                                                    </>:<></>
                                                }
                                                </>
                                            }
                                        </Grid>
                                    </Box>
                                    
                                    {metricsFlowsObject &&
                                        <>
                                        {metricsFlowsObject?.governanceTransactionsData ?
                                        <>{metricsFlowsObject.governanceTransactionsData.length > 0 ?
                                            <Box>
                                                <Chart
                                                    data={metricsFlowsObject.governanceTransactionsData}
                                                    >
                                                    <ArgumentAxis />
                                                    <ValueAxis />
                                                        <BarSeries
                                                            name="Vote Inflow"
                                                            valueField="inflows"
                                                            argumentField="date"
                                                        />

                                                        <BarSeries
                                                            name="Vote Outflow"
                                                            valueField="outflows"
                                                            argumentField="date"
                                                        />
                                                    <Title text={`Governance Votes Inflows/Outflows in `+metricsFlowsObject.governanceCommunityTokenMintName} />
                                                    <Legend position="bottom" rootComponent={Root} labelComponent={Label} />
                                                    
                                                    <Stack />
                                                </Chart>
                                            </Box>
                                            :<></>
                                            }
                                            </>
                                        :<></>
                                        }

                                        {metricsFlowsObject?.governanceBalanceOverTimeData ?
                                        <>{metricsFlowsObject.governanceBalanceOverTimeData.length > 0 ?
                                            <Box>
                                                <Chart
                                                    data={metricsFlowsObject.governanceBalanceOverTimeData}
                                                    >
                                                    <ArgumentAxis />
                                                    <ValueAxis />
                                                        <BarSeries
                                                            name="Staked Votes"
                                                            valueField="postbalance"
                                                            argumentField="date"
                                                        />
                                                    <Title text={`Governance Growth in `+metricsFlowsObject.governanceCommunityTokenMintName} />
                                                    <Legend position="bottom" rootComponent={Root} labelComponent={Label} />
                                                    
                                                    <Stack />
                                                </Chart>
                                            </Box>
                                            :<></>
                                            }
                                            </>
                                        :<></>
                                        }
                                        </>
                                    }
                                </>
                            }
                                    
                            {(metricsObject?.totalVotesDeposited <= 0) &&
                                <Box
                                    sx={{textAlign:'center'}}
                                >
                                    <Alert 
                                        
                                        severity="info"
                                        sx={{borderRadius:'17px',m:2}}>*** NFT Voting Power Reflecting last participating proposal, more VSR/NFT voter metrics will be displayed soon ***</Alert>
                                </Box>
                            }


                            <RenderVoterRecordTable 
                                memberMap={memberMap} 
                                governanceMasterMembers={governanceMasterMembers}
                                endTimer={endTimer} 
                                cachedGovernance={cachedGovernance} 
                                governanceType={governanceType} 
                                governingTokenDecimals={governingTokenDecimals} 
                                governingTokenMint={governingTokenMint} 
                                tokenMap={tokenMap} 
                                realm={realm} 
                                thisToken={thisToken} 
                                proposals={proposals} 
                                nftBasedGovernance={nftBasedGovernance} 
                                governanceAddress={governanceAddress}
                                governanceStartDate={governanceStartDate}
                                governanceEndDate={governanceEndDate}
                                setRenderCount={setRenderCount}
                                renderCount={renderCount}
                                cachedTransactionMap={cachedTransactionMap}
                                setMetricsObject={setMetricsObject}
                                setMetricsFlowsObject={setMetricsFlowsObject} />
                            
                            {endTime &&
                                <Typography 
                                    variant="caption"
                                    sx={{textAlign:'center'}}
                                >
                                    Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Cached<br/>
                                    {cachedTimestamp &&
                                        <>Cached: {moment.unix(Number(cachedTimestamp)).format("MMMM D, YYYY, h:mm a") }<br/></>
                                    }
                                    Cache Node: {storagePool}
                                </Typography>
                            }
                    </Box>      
                );
            }else{
                return (
                
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '17px',
                            p:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="caption">Governance Metrics {governanceAddress}</Typography>
                        
                    </Box>
                );
            }
            
        }
    
}