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
//import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';

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

import GovernanceNavigation from './GovernanceNavigation'; 
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

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
    const renderCount = props.renderCount;
    const setRenderCount = props.setRenderCount;
    const governanceStartDate = props.governanceStartDate;
    const governanceEndDate = props.governanceEndDate;
    const [loadingTable, setLoadingTable] = React.useState(false);
    const setGovernnaceChartData = props.setGovernanceChartData;
    const setMetricsVoters = props.setMetricsVoters;
    const setMetricsAverageVotesPerParticipant = props.setMetricsAverageVotesPerParticipant;
    const setMetricsAverageParticipation = props.setMetricsAverageParticipation;
    const setMetricsActiveVoters = props.setMetricsActiveVoters;
    const setMetricsEligibleVoters = props.setMetricsEligibleVoters;
    const setMetricsTotalVotesDeposited = props.setMetricsTotalVotesDeposited;
    const setMetricsTotalVotesCasted = props.setMetricsTotalVotesCasted;
    const setMetricsTotalProposals = props.setMetricsTotalProposals;
    const setMetricsParticipationRate = props.setMetricsParticipationRate;
    const setMetricsHighestParticipation = props.setMetricsHighestParticipation;
    const setMetricsHighestParticipationProposalName = props.setMetricsHighestParticipationProposalName;

    const setMetricsCommunityPassed = props.setMetricsCommunityPassed;
    const setMetricsCommunityDefeated = props.setMetricsCommunityDefeated;
    const setMetricsCommunityResultsRate = props.setMetricsCommunityResultsRate;
    const setMetricsProposalsPerMonth = props.setMetricsProposalsPerMonth;
    const setMetricsRetention = props.setMetricsRetention;
    const setMetricsActiveRetention = props.setMetricsActiveRetention;
    const setMetricsTotalStaked = props.setMetricsTotalStaked;

    const endTimer = props.endTimer;
    const cachedGovernance = props.cachedGovernance;
    const memberMap = props.memberMap;
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
        { field: 'currentvotes', headerName: 'Current Voting Power', width: 120, hide: false, align: 'right',
            renderCell: (params) => {
                return(
                    <>{params.value}</>
                )
            }
        },
        { field: 'councilvotes', headerName: 'Council', width: 50, hide: false, align: 'right',},
        { field: 'totalproposalscreated', headerName: 'Proposals Created', width: 140, hide: false, align: 'right',},
        { field: 'totalvotes', headerName: 'Total Votes Casted', width: 140, hide: false, align: 'right',},
        { field: 'totalvotesfor', headerName: 'Total Votes For', width: 140, hide: false, align: 'right',},
        { field: 'totalvotesagainst', headerName: 'Total Votes Against', width: 170, hide: false, align: 'right',},
        { field: 'totalproposalparticipation', headerName: 'Total Proposal Participation', width: 140, hide: false, align: 'right',},
        { field: 'totalproposalsfor', headerName: 'Total Proposals For', width: 170, hide: false, align: 'right',},
        { field: 'totalproposalsagainst', headerName: 'Total Proposals Against', width: 170, hide: false, align: 'right',},
        { field: 'totalcouncilproposalscreated', headerName: 'Council Props Created', width: 140, hide: false, align: 'right',},
        { field: 'totalcouncilvotes', headerName: 'Council Participation', width: 140, hide: false, align: 'right',},
        { field: 'totalcouncilvotesfor', headerName: 'Council For', width: 170, hide: false, align: 'right',},
        { field: 'totalcouncilvotesagainst', headerName: 'Council Against', width: 170, hide: false, align: 'right',},
    ]

    const exportFile = async(csvFile:string, fileName:string) => {
        //setStatus(`File generated! - ${finalList.length} proposals`);
        
        if (csvFile){
            const jsonCSVString = `data:text/csv;chatset=utf-8,${csvFile}`;
            setCSVGenerated(jsonCSVString);
        }
    }

    const renderVoterRecords = async () => {
        
        // we need to make a new object and push the voters
        var voterArray = new Array();
        let totalEligibleVoters = 0;
        let totalActiveVoters = 0;
        let totalVotesDeposited = 0;
        let totalCommunityParticipation = 0;
        let totalCommunityProposals = 0;
        let totalVotesCasted = 0;
        let totalProposals = 0;
        let totalCommunityPassed = 0;
        let totalCommunityDefeated = 0;
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
        setLoadingTable(true);
        
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
                        if (memberMap){
                        for (var memberItem of memberMap){
                                if (new PublicKey(memberItem.pubkey).toBase58() === authorPk.toBase58()){
                                    authorAddress = new PublicKey(memberItem.account.governingTokenOwner).toBase58()
                                }
                            }
                            
                        }
                    }

                    if (item?.votingResults){
                        participationCount = 0;
                        for (var inner_item of item.votingResults){

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
                                if (participant.pubkey === inner_item.governingTokenOwner.toBase58()){
                                    //inner_item.councilMint 
                                    //inner_item.governingTokenMint
                                    //inner_item.decimals
                                    
                                    if (realm.account.config?.councilMint && (new PublicKey(realm.account.config?.councilMint).toBase58() === item.account.governingTokenMint.toBase58())){ // Council Votes
                                        //console.log("council vote...")

                                        if (inner_item?.vote){
                                            if (inner_item?.vote?.vote?.voteType === 0){
                                                if ((inner_item?.vote?.voterWeight) > 0){
                                                    totalproposalsfor = 1; 
                                                    totalcouncilvotesfor = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);
                                                    totalcouncilvotes = (totalcouncilvotesfor);
                                                }
                                            } else{
                                                totalcouncilvotesagainst = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//inner_item?.vote?.voterWeight; //getFormattedNumberToLocale(formatAmount(+(parseInt(inner_item?.vote?.voterWeight)/Math.pow(10, inner_item?.vote?.decimals)).toFixed(0)));
                                                totalcouncilvotes = (totalcouncilvotesagainst);
                                            }
                                        } else if (inner_item?.vote?.legacyYes) {
                                            if (inner_item?.vote?.legacyYes > 0){
                                                totalcouncilvotesfor = +((inner_item?.vote?.legacyYes)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyYes);
                                                totalcouncilvotes = (totalcouncilvotesfor);
                                            } else if (inner_item?.vote?.legacyNo > 0){
                                                totalcouncilvotesagainst = +((inner_item?.vote?.legacyNo)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyNo);
                                                totalcouncilvotes = (totalcouncilvotesagainst);
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
                                                }
                                            } else{
                                                totalproposalsagainst = 1; 
                                                totalvotesagainst = +((inner_item?.vote?.voterWeight)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//inner_item?.vote?.voterWeight; //getFormattedNumberToLocale(formatAmount(+(parseInt(inner_item?.vote?.voterWeight)/Math.pow(10, inner_item?.vote?.decimals)).toFixed(0)));
                                                totalvotes = (totalvotesagainst);
                                            }
                                        } else if (inner_item?.vote?.legacyYes) {
                                            if (inner_item?.vote?.legacyYes > 0){
                                                totalproposalsfor = 1;
                                                totalvotesfor = +((inner_item?.vote?.legacyYes)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyYes);
                                                totalvotes = (totalvotesfor);
                                            } else if (inner_item?.vote?.legacyNo > 0){
                                                totalproposalsagainst = 1;
                                                totalvotesagainst = +((inner_item?.vote?.legacyNo)/Math.pow(10, +inner_item?.vote?.decimals)).toFixed(0);//(inner_item?.vote?.legacyNo);
                                                totalvotes = (totalvotesagainst);
                                            }
                                        }
                                    }

                                    foundParticipant = true;
                                    
                                    //totalVotesDeposited+=depositedgovernancevotes;

                                    if ((totalvotes>0)&&(participant.totalvotes <= 0))
                                        totalActiveVoters++;
                                    totalVotesCasted+=totalvotes;
                                    
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

                                }
                                
                            }
                            
                            if (!foundParticipant){
                                depositedgovernancevotes = 0;
                                depositedcouncilvotes = 0;
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
                                })
                                voter++;
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
                                pbi.count++;
                                if (item.account.state === 3 || item.account.state === 5) 
                                    pbi.cpassing++
                                if (item.account.state === 7)
                                    pbi.cdefeated++
                            }
                        }

                        if (!pbi_found){
                            propsByMonth.push({
                                'date':monthts,
                                'cpassing':(item.account.state === 3 || item.account.state === 5) ? 1 : 0,
                                'cdefeated':(item.account.state === 7) ? 1 :0,

                                //'cparticipating':,
                                'count':1
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
                        csvFile = 'pubkey,totalproposalscreated,depositedvotes,councildepositedvotes,totalvotes,totalvotesfor,totalvotesagainst,totalproposalparticipation,totalproposalsfor,totalproposalsagainst,totalcouncilproposalscreated,totalcouncilvotes,totalcouncilvotesfor,totalcouncilvotesagainst\r\n';
                    csvFile += voter_item.pubkey+','+voter_item.totalproposalscreated+','+voter_item.currentvotes+','+voter_item.councilvotes+','+voter_item.totalvotes+','+voter_item.totalvotesfor+','+voter_item.totalvotesagainst+','+voter_item.totalproposalparticipation+','+voter_item.totalproposalsfor+','+voter_item.totalproposalsagainst+','+voter_item.totalcouncilproposalscreated+','+voter_item.totalcouncilvotes+','+voter_item.totalcouncilvotesfor+','+voter_item.totalcouncilvotesagainst;
                    counter++;

                    tStakedVotes += voter_item.currentvotes;
                    tVotesCasted += voter_item.totalvotes;
                    tCouncilVotes += voter_item.councilvotes;
                    tDepositedCouncilVotesCasted += voter_item.totalcouncilvotes;
                
                    tParticipants++;
                }

                

            }

            var counter = 0;
            tParticipants = 0;
            tStakedVotes = 0;
            tVotesCasted = 0;
            tCouncilVotes = 0;
            tDepositedCouncilVotesCasted = 0;
            for (var member_item of memberMap){
                if (realm.account.config?.councilMint){
                    if (new PublicKey(member_item.account?.governingTokenMint).toBase58() !== new PublicKey(realm.account.config?.councilMint).toBase58()){
                        tStakedVotes += Number("0x"+member_item.account.governingTokenDepositAmount);//record.account.totalVotesCount;
                        tVotesCasted += member_item.account.totalVotesCount;//record.account.governingTokenDepositAmount.toNumber();
                        tParticipants++;
                    } else{
                        tCouncilVotes += member_item.account.totalVotesCount;
                        tDepositedCouncilVotesCasted += Number(member_item.account.governingTokenDepositAmount);
                    }
                } else{
                    tStakedVotes += Number("0x"+member_item.account.governingTokenDepositAmount);//record.account.totalVotesCount;
                    tVotesCasted += member_item.account.totalVotesCount;//record.account.governingTokenDepositAmount.toNumber();
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

        setVoterRecordRows(voterArray);
        try{
            console.log(tParticipants+"("+memberMap.length+"): "+tStakedVotes+ " (decimals: "+governingTokenDecimals+")")
            if (tStakedVotes > 0)
                setMetricsTotalStaked(Number((tStakedVotes/Math.pow(10, +governingTokenDecimals)).toFixed(0)))

            setMetricsHighestParticipationProposalName(highestParticipationProposalName);
            //console.log("highest participation: "+highestParticipation)
            setMetricsHighestParticipation(highestParticipation);

            setGovernnaceChartData(propsByMonth);

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
            setMetricsTotalProposals(totalCommunityProposals);
            if (totalEligibleVoters > 0)
                setMetricsParticipationRate((((totalCommunityParticipation/totalCommunityProposals)/totalEligibleVoters)*100).toFixed(2));
            else
                setMetricsParticipationRate(null);
            setMetricsCommunityPassed(totalCommunityPassed);
            setMetricsCommunityDefeated(totalCommunityDefeated);
            
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

export function GovernanceReputationView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const governanceAddress = urlParams;
    const [renderCount, setRenderCount] = React.useState(0);
    //const governanceAddress = props.governanceAddress;
    const [loading, setLoading] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(null);
    const [realm, setRealm] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const connection = RPC_CONNECTION;
    const { publicKey, wallet } = useWallet();
    const [proposals, setProposals] = React.useState(null);
    const [participating, setParticipating] = React.useState(false)
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
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);

    const [metricsVoters, setMetricsVoters] = React.useState(null);
    const [metricsAverageVotesPerParticipant, setMetricsAverageVotesPerParticipant] = React.useState(null);
    const [metricsEligibleVoters, setMetricsEligibleVoters] = React.useState(null);
    const [metricsAverageParticipation, setMetricsAverageParticipation] = React.useState(null);
    const [metricsTotalVotesDeposited, setMetricsTotalVotesDeposited] = React.useState(null);
    const [metricsTotalVotesCasted, setMetricsTotalVotesCasted] = React.useState(null);
    const [metricsTotalProposals, setMetricsTotalProposals] = React.useState(null);
    const [metricsParticipationRate, setMetricsParticipationRate] = React.useState(null);

    const [metricsCommunityPassed, setMetricsCommunityPassed] = React.useState(null);
    const [metricsCommunityDefeated, setMetricsCommunityDefeated] = React.useState(null);
    const [metricsProposalsPerMonth, setMetricsProposalsPerMonth] = React.useState(null);
    const [metricsRetention, setMetricsRetention] = React.useState(null);
    const [metricsActiveRetention, setMetricsActiveRetention] = React.useState(null);
    const [metricsHighestParticipation, setMetricsHighestParticipation] = React.useState(null);
    const [metricsHighestParticipationProposalName, setMetricsHighestParticipationProposalName] = React.useState(null);
    const [metricsTotalStaked, setMetricsTotalStaked] = React.useState(null);

    const [governanceStartDate, setGovernanceStartDate] = React.useState(null);
    const [governanceEndDate, setGovernanceEndDate] = React.useState(null);


    const [governanceChartData, setGovernanceChartData] = React.useState(null);

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
                if (tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58())){
                    setGovernanceType(0);
                    gTD = tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58()).decimals;
                    setGoverningTokenDecimals(gTD);
                } else{
                    const btkn = await getBackedTokenMetadata(new PublicKey(grealm.account?.communityMint).toBase58(), wallet);
                    if (btkn){
                        setGovernanceType(1);
                        gTD = btkn.decimals;
                        setGoverningTokenDecimals(gTD)
                    } else{
                        setGovernanceType(2);
                        gTD = 0;
                        setGoverningTokenDecimals(gTD);
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
                            
                            const tryRealmConfig = await tryGetRealmConfig(
                                connection,
                                programId,
                                realmPk
                            )
                            
                            //console.log("tryRealmConfig: "+JSON.stringify(tryRealmConfig));
                            //setRealmConfig(realmConfigPK)

                            if (realmConfig && realmConfig?.account && realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin){
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

    React.useEffect(() => {
        if (tokenMap){
            callGovernanceLookup();
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

                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);
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
                    <Typography variant="caption">Loading Governance Metrics {governanceAddress}</Typography>
                    
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
                                                REPUTATION BUILDER
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </>
                        }

                        <Box sx={{ alignItems: 'center', textAlign: 'center',p:1,mt:2}}>
                            <Typography variant="h4">
                                Build &amp; reward your community for historical SPL Governance Participation
                            </Typography>
                            <Typography variant="h6">
                                coming soon...
                            </Typography>
                        </Box>
                        
                        
                        
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Cached<br/>
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
                        <Typography variant="caption">Governance Reputation Builder {governanceAddress}</Typography>
                        
                    </Box>);
            }
            
        }
    
}