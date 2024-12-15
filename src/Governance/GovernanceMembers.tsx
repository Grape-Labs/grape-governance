import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import axios from "axios";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import moment from 'moment';

import { 
    tryGetName,
} from '@cardinal/namespaces';

import { CardinalTwitterIdentityResolver } from '@dialectlabs/identity-cardinal';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import BN from 'bn.js';
import { styled, useTheme } from '@mui/material/styles';
import {
  Typography,
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
  Collapse,
  Tooltip,
  CircularProgress,
  LinearProgress,
} from '@mui/material/';

import GovernanceNavigation from './GovernanceNavigation'; 
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import ExplorerView from '../utils/grapeTools/Explorer';
import { getProfilePicture } from '@solflare-wallet/pfp';
import { findDisplayName } from '../utils/name-service';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import Chat from '@mui/icons-material/Chat';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';

import { 
    tryGetRealmConfig,
    getRealm, 
    getAllTokenOwnerRecords } from '@solana/spl-governance';
import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
} from './api/queries';

import PropTypes from 'prop-types';
import { 
    RPC_CONNECTION, 
    GGAPI_STORAGE_POOL } from '../utils/grapeTools/constants';

const GOVERNANNCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing with Errors!',
}

TablePaginationActions.propTypes = {
    count: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired,
    page: PropTypes.number.isRequired,
    rowsPerPage: PropTypes.number.isRequired,
};

function TablePaginationActions(props) {
    const theme = useTheme();
    const { count, page, rowsPerPage, onPageChange } = props;
  
    const handleFirstPageButtonClick = (event) => {
        onPageChange(event, 0);
    };

    const handleBackButtonClick = (event) => {
        onPageChange(event, page - 1);
    };
  
    const handleNextButtonClick = (event) => {
        onPageChange(event, page + 1);
    };
  
    const handleLastPageButtonClick = (event) => {
        onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
    };
    
    return (
        <Box sx={{ flexShrink: 0, ml: 2.5 }}>
            <IconButton
                onClick={handleFirstPageButtonClick}
                disabled={page === 0}
                aria-label="first page"
            >
                {theme.direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />}
            </IconButton>
            <IconButton
                onClick={handleBackButtonClick}
                disabled={page === 0}
                aria-label="previous page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowRight />
                ) : (
                    <KeyboardArrowLeft />
                )}
            </IconButton>
            <IconButton
                onClick={handleNextButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="next page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowLeft />
                ) : (
                    <KeyboardArrowRight />
                )}
            </IconButton>
            <IconButton
                onClick={handleLastPageButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="last page"
            >
                {theme.direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />}
            </IconButton>
        </Box>
    );
  }

function RenderGovernanceMembersTable(props:any) {
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const participating = props.participating;
    const members = props.members;
    const circulatingSupply = props.circulatingSupply;
    const totalDepositedVotes = props.totalDepositedVotes;
    const [memberVotingResults, setMemberVotingResults] = React.useState(null);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - members.length) : 0;
    const token = props.token;
    const governingTokenMint = props?.governingTokenMint;
    const governingTokenDecimals = props?.governingTokenDecimals || 0;
    
    
    const memberresultscolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', minWidth: 70, hide: true},
        { field: 'address', headerName: 'Address', minWidth: 70, hide: true},
        { field: 'record', headerName: 'Record', minWidth: 70, hide: true},
        { field: 'delegate', headerName: 'Delegate', minWidth: 200, hide: true},
        { field: 'member', headerName: 'Member', minWidth: 200, flex: 1,
            renderCell: (params) => {
                return(
                    <>
                    <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={params.value.address} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='18px' />
                    {Number(params.value.governingCouncilDepositAmount) > 0 &&
                        <Grid item>
                            <Tooltip title={`Council Member - Votes: ${Number(params.value.governingCouncilDepositAmount)}`}><Button color='inherit' sx={{ml:1,borderRadius:'17px'}}><AssuredWorkloadIcon /></Button></Tooltip>
                        </Grid>
                    }</>
                )
            }
        },
        { field: 'staked', headerName: 'Votes Staked', minWidth: 170, flex: 1, headerAlign: 'center', align: 'right',
            sortable: true, // Enable sorting on this column
            sortComparator: (v1, v2, cellParams1, cellParams2) => {
                // Custom sorting logic based on governanceRewards field
                const param1 = cellParams1.value.governingTokenDepositAmount || 0;
                const param2 = cellParams2.value.governingTokenDepositAmount || 0;
                return param1 - param2;
            },   
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {getFormattedNumberToLocale(params.value.governingTokenDepositAmount)}
                    </Typography>
                )
            }
        },
        { field: 'unstaked', headerName: 'Not Staked', minWidth: 170, headerAlign: 'center', align: 'right', hide: true,
            renderCell: (params) => {
                return(
                    <Typography variant="caption">
                        {getFormattedNumberToLocale(params.value)}
                    </Typography>
                )
            }
        },
        { field: 'percentDepositedGovernance', headerName: '% of Deposited Governance', minWidth: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {params.value}%
                    </Typography>
                )
            }
        },
        { field: 'percentSupply', headerName: '% of Supply', minWidth: 170, headerAlign: 'center', align: 'right',
            renderCell: (params) => {
                return(
                    <Typography variant="h6">
                        {params.value}%
                    </Typography>
                )
            }
        },
    ];


    const handleChangePage = (event:any, newPage:number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event:any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    /*
    const getProposals = async (GOVERNANCE_PROGRAM_ID:string) => {
        if (!loading){
            setLoading(true);
            
        }
        setLoading(false);
    }*/

    const createMemberTableRows = async() => {
        const mmbr = new Array();
        let x = 0;
        for (const member of members){
            mmbr.push({
                id:x+1,
                address: member.governingTokenOwner.toBase58(),
                delegate: member?.governanceDelegate ? member.governanceDelegate.toBase58() : null,
                record: member.pubkey.toBase58(),
                member:{
                    address: member.governingTokenOwner.toBase58(),
                    governingCouncilDepositAmount:((Number(member.governingCouncilDepositAmount) > 0) ? Number(member.governingCouncilDepositAmount) : 0),
                    },
                staked:
                    {
                        governingTokenDepositAmount:(+((Number(member.governingTokenDepositAmount))/Math.pow(10, governingTokenDecimals || 0)).toFixed(0)),
                        governingCouncilDepositAmount:((Number(member.governingCouncilDepositAmount) > 0) ? Number(member.governingCouncilDepositAmount) : 0),
                    },
                unstaked:Number(member.walletBalanceAmount),
                percentDepositedGovernance:Number(member.governingTokenDepositAmount) > 0 ? ((+Number(member.governingTokenDepositAmount)/totalDepositedVotes)*100).toFixed(2) : 0,
                percentSupply:Number(member.governingTokenDepositAmount) > 0 ? ((Number(member.governingTokenDepositAmount)/circulatingSupply.value.amount)*100).toFixed(2) : 0,
            })
            x++;
        }

        console.log("mmbr: "+JSON.stringify(mmbr))
        setMemberVotingResults(mmbr);
    }

    React.useEffect(() => {
        if (members && !memberVotingResults){
            createMemberTableRows();
        }
    }, [members]);

    if(loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} />
            </Box>
        )
    }
    
    return (
        
        <>
            {memberVotingResults &&
                <div style={{ height: 600, width: '100%' }}>
                    <div style={{ display: 'flex', height: '100%' }}>
                        <div style={{ flexGrow: 1 }}>
                                
                                <DataGrid
                                    //rows={mapMemberObject(memberVotingResults)}
                                    rows={memberVotingResults}
                                    columns={memberresultscolumns}
                                    //disableColumnFilter
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
            }
        </>
    )
}

export function GovernanceMembersView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const governanceAddress = urlParams;
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [cachedRealm, setCachedRealm] = React.useState(null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(null);
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    
    const [loading, setLoading] = React.useState(false);
    const [members, setMembers] = React.useState(null);
    const connection = RPC_CONNECTION;
    const { publicKey, wallet } = useWallet();
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [participating, setParticipating] = React.useState(false)
    const [participatingRealm, setParticipatingRealm] = React.useState(null)
    const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [totalDepositedVotes, setTotalDepositedVotes] = React.useState(null);
    const [totalCouncilVotes, setTotalCouncilVotes] = React.useState(null);
    const [totalParticipants, setTotalParticipants] = React.useState(null);
    const [activeParticipants, setActiveParticipants] = React.useState(null);
    const [votingParticipants, setVotingParticipants] = React.useState(null);
    const [totalVotesCasted, setTotalVotesCasted] = React.useState(null);
    const [totalUnstakedVotes, setTotalUnstakedVotes] = React.useState(null);
    const [totalDepositedCouncilVotes, setDepositedTotalCouncilVotes] = React.useState(null);
    const [top10Participants, setTop10Participants] = React.useState(null);
    const [governingTokenMint, setGoverningTokenMint] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [circulatingSupply, setCirculatingSupply] = React.useState(null);
    const [csvGenerated, setCSVGenerated] = React.useState(null);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);
    const [recordCount, setRecordCount] = React.useState(null);
    const [pluginDao, setPluginDao] = React.useState(null);

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            let tmap  = null;
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tokenMp = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map());
                setTokenMap(tokenMp);
                setTokenArray(tarray);
                tmap = tokenMp;
            });
            return tmap;
        } catch(e){console.log("ERR: "+e); return null;}
    }

    

    const getGovernanceMembers = async () => {
        if (!loading){
            setLoading(true);
            try{
                
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                
                console.log("SPL Governnace: "+governanceAddress);
                
                /*
                const ownerRecordsbyOwner = await getTokenOwnerRecordsByOwner(connection, programId, publicKey);
                // check if part of this realm
                let pcp = false;
                for (let ownerRecord of ownerRecordsbyOwner){
                    
                    if (ownerRecord.account.realm.toBase58() === governanceAddress){
                        pcp = true;
                        setParticipatingRealm(realm);
                    }
                }
                setParticipating(pcp);
                */
                
                let grealm = null;
                if (cachedRealm){
                    console.log("Realm from cache")
                    grealm = cachedRealm;
                } else{
                    grealm = await getRealmIndexed(governanceAddress);
                }
                const realmPk = new PublicKey(grealm.pubkey);
                setRealm(grealm);
                setRealmName(grealm.account.name);
                
                const config = await tryGetRealmConfig(RPC_CONNECTION, new PublicKey(grealm.owner), new PublicKey(grealm.pubkey));

                if (config?.account?.communityTokenConfig?.voterWeightAddin){
                    setPluginDao(true);
                }

                //console.log("realm: "+JSON.stringify(grealm))

                setGoverningTokenMint(new PublicKey(grealm.account.communityMint).toBase58());
                // with realm check if this is a backed token
                let thisTokenDecimals = 0;

                /*
                if (tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58())){
                    thisTokenDecimals = tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58()).decimals;
                    setGoverningTokenDecimals(thisTokenDecimals);
                } else{
                    const btkn = await getBackedTokenMetadata(new PublicKey(grealm.account?.communityMint).toBase58(), wallet);
                    if (btkn){
                        thisTokenDecimals = btkn.decimals;
                        setGoverningTokenDecimals(thisTokenDecimals)
                    } else{ 
                        thisTokenDecimals = 6;
                        setGoverningTokenDecimals(thisTokenDecimals);
                    }
                }
                */

                let gTD = null;
                let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account?.communityMint))
                //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
                gTD = tokenDetails.value.data.parsed.info.decimals;
                thisTokenDecimals = gTD;
                setGoverningTokenDecimals(thisTokenDecimals);
                
                setGoverningTokenDecimals(thisTokenDecimals);

                const tknSupply = await connection.getTokenSupply(new PublicKey(grealm.account.communityMint));

                //const governingMintPromise = await connection.getParsedAccountInfo(grealm.account.communityMint);
                if (tknSupply)
                    setCirculatingSupply(tknSupply);
                
                let trecords = null;

                const indexedTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(realmPk.toBase58(), grealm.owner)
                //rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
                trecords = indexedTokenOwnerRecords;
                
                //console.log("indexTokenOwnerRecords: ("+indexedTokenOwnerRecords.length+") "+JSON.stringify(indexedTokenOwnerRecords));
                //console.log("grealm: "+JSON.stringify(grealm))
                let hasVoterWeight = false;
                if (grealm?.account?.config?.useCommunityVoterWeightAddin){
                    console.log("Has Voter Weight Plugin!");
                    hasVoterWeight = true;
                }

                let hasMaxVoterWeight = false;
                if (grealm?.account?.config?.useMaxCommunityVoterWeightAddin){
                    console.log("Has MAX Voter Weight Addin!");
                    hasMaxVoterWeight = true;
                }
                
                {

                    /*
                    if (cachedMemberMap){
                        console.log("Members from cache");
                        // merge with cachedMemberMap?
                        for (var rRecord of indexedTokenOwnerRecords){
                            for (var cRecord of cachedMemberMap){
                                if (rRecord.pubkey.toBase58() === cRecord.pubkey){
                                    rRecord.socialConnections = cRecord.socialConnections;
                                    rRecord.firstTransactionDate = cRecord.firstTransactionDate;
                                    rRecord.multisigs = cRecord.multisigs;
                                }
                            }
                        }
                        trecords = indexedTokenOwnerRecords;//cachedMemberMap;
                    } else if (!indexedTokenOwnerRecords){
                        trecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
                    }
                    */

                    //console.log("trecords: "+JSON.stringify(trecords));

                    //let sortedResults = trecords.sort((a,b) => (a.account?.outstandingProposalCount < b.account?.outstandingProposalCount) ? 1 : -1);
                    //const sortedResults = trecords.sort((a,b) => (a.account?.totalVotesCount < b.account?.totalVotesCount) ? 1 : -1);
                    
                    //const sortedResults = trecords.sort((a,b) => (a.account?.governingTokenDepositAmount.toNumber() < b.account?.governingTokenDepositAmount.toNumber()) ? 1 : -1);
                    
                    // generate a super array with merged information
                    let participantArray = new Array();
                    let tUnstakedVotes = 0;
                    let tVotes = 0;
                    let tCouncilVotes = 0;
                    let tVotesCasted = 0;
                    let tDepositedCouncilVotesCasted = 0;
                    let tParticipants = 0;
                    let aParticipants = 0;
                    let lParticipants = 0;
                    let csvFile = '';
                    let cntr = 0;

                    for (let record of trecords){
                        //console.log("record ("+(cntr+1)+"): "+JSON.stringify(record));
                        setRecordCount(cntr+1 + " of " + trecords.length);
                        let foundParticipant = false;
                        if (trecords.length < 3000){
                            for (let participant of participantArray){
                                if (new PublicKey(participant.governingTokenOwner).toBase58() === new PublicKey(record.account.governingTokenOwner).toBase58()){
                                    foundParticipant = true;
                                    participant.governanceDelegate = record.account?.governanceDelegate ? new PublicKey(record.account.governanceDelegate) : null,
                                    participant.governingTokenMint = (new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account.config?.councilMint).toBase58()) ? new PublicKey(record.account.governingTokenMint) : participant.governingTokenMint;
                                    participant.totalVotesCount = (new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account.config?.councilMint).toBase58()) ? Number(record.account.totalVotesCount) : participant.totalVotesCount;
                                    participant.councilVotesCount = (new PublicKey(record.account.governingTokenMint).toBase58() === new PublicKey(grealm.account.config?.councilMint).toBase58()) ? Number(record.account.totalVotesCount) : participant.councilVotesCount;
                                    participant.governingTokenDepositAmount = (new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account.config?.councilMint).toBase58()) ? Number(record.account.governingTokenDepositAmount) : participant.governingTokenDepositAmount;
                                    participant.governingCouncilDepositAmount = (new PublicKey(record.account.governingTokenMint).toBase58() === new PublicKey(grealm.account.config?.councilMint).toBase58()) ? Number(record.account.governingTokenDepositAmount) : participant.governingCouncilDepositAmount;
                                    
                                    if (record.account.governingTokenMint === record.walletBalance?.mint){
                                        //tUnstakedVotes += (record.walletBalance?.tokenAmount?.amount ? +(+record.walletBalance.tokenAmount.amount /Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)).toFixed(0) : 0);
                                        participant.walletBalanceAmount = (record.walletBalance?.tokenAmount?.amount ? (+record.walletBalance.tokenAmount.amount /Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)).toFixed(0) : null);
                                    }
                                    if (new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account.config.councilMint).toBase58()){
                                        tVotes += Number(record.account.governingTokenDepositAmount);//record.account.totalVotesCount;
                                        tVotesCasted += record.account.totalVotesCount;//record.account.governingTokenDepositAmount.toNumber();
                                    } else{
                                        tCouncilVotes += record.account.totalVotesCount;
                                        tDepositedCouncilVotesCasted += Number(record.account.governingTokenDepositAmount);
                                    }
                                }
                            }
                        }
                        if (!foundParticipant){
                                //console.log("record: "+JSON.stringify(record));
                                
                                if (grealm.account.config?.councilMint) {
                                    participantArray.push({
                                        pubkey:new PublicKey(record.pubkey),
                                        governanceDelegate:record.account?.governanceDelegate ? new PublicKey(record.account.governanceDelegate) : null,
                                        governingTokenMint:(new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account.config?.councilMint).toBase58()) ? new PublicKey(record.account.governingTokenMint) : null,
                                        governingTokenOwner:new PublicKey(record.account.governingTokenOwner),
                                        totalVotesCount:(new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account.config?.councilMint).toBase58()) ? Number(record.account.totalVotesCount) : 0,
                                        councilVotesCount:(new PublicKey(record.account.governingTokenMint).toBase58() === new PublicKey(grealm.account.config?.councilMint).toBase58()) ? Number(record.account.totalVotesCount) : 0,
                                        governingTokenDepositAmount:(new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account?.config.councilMint).toBase58()) ? Number(record.account.governingTokenDepositAmount) : new BN(0),
                                        governingCouncilDepositAmount:(new PublicKey(record.account.governingTokenMint).toBase58() === new PublicKey(grealm.account?.config.councilMint).toBase58()) ? Number(record.account.governingTokenDepositAmount) : new BN(0),
                                        walletBalanceAmount: (record.walletBalance?.tokenAmount?.amount ? (+record.walletBalance.tokenAmount.amount /Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)).toFixed(0) : null)
                                    });
                                    tUnstakedVotes += (record.walletBalance?.tokenAmount?.amount ? +(+record.walletBalance.tokenAmount.amount /Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)).toFixed(0) : 0);
                                    
                                    if (new PublicKey(record.account.governingTokenMint).toBase58() !== new PublicKey(grealm.account?.config.councilMint).toBase58()){
                                        tVotes += Number(record.account.governingTokenDepositAmount);
                                        tVotesCasted += Number(record.account.totalVotesCount);
                                    } else{
                                        tCouncilVotes += Number(record.account.totalVotesCount);
                                        tDepositedCouncilVotesCasted += Number(record.account.governingTokenDepositAmount);
                                    }
                                } else{

                                    participantArray.push({
                                        pubkey:new PublicKey(record.pubkey),
                                        governanceDelegate:record.account?.governanceDelegate ? new PublicKey(record.account.governanceDelegate) : null,
                                        governingTokenMint:new PublicKey(record.account.governingTokenMint),
                                        governingTokenOwner:new PublicKey(record.account.governingTokenOwner),
                                        totalVotesCount:Number(record.account.totalVotesCount),
                                        councilVotesCount:0,
                                        governingTokenDepositAmount:Number(record.account.governingTokenDepositAmount),
                                        governingCouncilDepositAmount:new BN(0),
                                        walletBalanceAmount: (record.walletBalance?.tokenAmount?.amount ? (+record.walletBalance.tokenAmount.amount /Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)).toFixed(0) : null)
                                    });
                                    
                                    tUnstakedVotes += (record.walletBalance?.tokenAmount?.amount ? +(+record.walletBalance.tokenAmount.amount /Math.pow(10, record.walletBalance.tokenAmount.decimals || 0)).toFixed(0) : 0);
                                    tVotes += Number(record.account.governingTokenDepositAmount);
                                    tVotesCasted += record.account.totalVotesCount;
                                }
                                if (record.account.totalVotesCount > 0)
                                    aParticipants++;
                                if ((Number(record.account.governingTokenDepositAmount) > 0) || (Number(record.account.governingTokenDepositAmount) > 0))
                                    lParticipants++;
                                tParticipants++; // all time
                        }
                        cntr++;
                    }

                    let pcount = 0;
                    for (let singleParticipant of participantArray){
                            if (pcount > 0)
                                csvFile += '\r\n';
                            else
                                csvFile = 'Member,VotesDeposited,TokenDecimals,RawVotesDeposited,CouncilVotesDeposited\r\n';
                            
                            let formattedDepositedAmount = (+(((singleParticipant.governingTokenDepositAmount))/Math.pow(10, thisTokenDecimals || 0)).toFixed(0));
                            //csvFile += record.account.governingTokenOwner.toBase58()+','+record.account.governingTokenDepositAmount.toNumber();
                            csvFile += singleParticipant.governingTokenOwner.toBase58()+','+formattedDepositedAmount+','+thisTokenDecimals+','+Number(singleParticipant.governingTokenDepositAmount)+','+Number(singleParticipant.governingCouncilDepositAmount);
                        
                            pcount++;
                    }

                    const jsonCSVString = encodeURI(`data:text/csv;chatset=utf-8,${csvFile}`);
                    //console.log("jsonCSVString: "+JSON.stringify(jsonCSVString));
                    
                    setCSVGenerated(jsonCSVString);
                    setRecordCount(null);
                    setTotalUnstakedVotes(tUnstakedVotes > 0 ? tUnstakedVotes : null);
                    setTotalDepositedVotes(tVotes > 0 ? tVotes : null);
                    setTotalVotesCasted(tVotesCasted > 0 ? tVotesCasted : null);
                    setTotalCouncilVotes(tCouncilVotes > 0 ? tCouncilVotes : null);
                    setDepositedTotalCouncilVotes(tDepositedCouncilVotesCasted > 0 ? tDepositedCouncilVotesCasted : null);
                    setTotalParticipants(tParticipants > 0 ? tParticipants : null);
                    setActiveParticipants(lParticipants > 0 ? lParticipants : null);
                    setVotingParticipants(aParticipants > 0 ? aParticipants : null);

                    //console.log("participantArray: "+JSON.stringify(participantArray));
                    const presortedResults = participantArray.sort((a,b) => (a.totalVotesCount > b.totalVotesCount) ? 1 : -1);
                    const sortedResults = presortedResults.sort((a,b) => (Number(a.governingTokenDepositAmount) < Number(b.governingTokenDepositAmount)) ? 1 : -1);

                    let top10 = null;
                    let count = 0;
                    let totalTopVotes = 0;
                    let totalTopSupply = 0;
                    let totalTopCirculatingSupply = 0;
                    let totalTopGovernanceSupply = 0;
                    for (var member of sortedResults){
                        if (count < 10){
                            console.log("member " +JSON.stringify(member))
                            totalTopVotes += Number(member.governingTokenDepositAmount)/Math.pow(10, thisTokenDecimals || 0);
                            if (tknSupply && Number(tknSupply.value.amount) > 0){
                                totalTopCirculatingSupply += (Number(member.governingTokenDepositAmount)/Number(tknSupply.value.amount))*100
                                totalTopGovernanceSupply += (Number(member.governingTokenDepositAmount)/tVotes)*100
                            }
                        }
                        count++
                    }

                    top10 = {
                        votes:totalTopVotes,
                        percentageOfSupply:totalTopCirculatingSupply,
                        percentageOfGovernanceSupply:totalTopGovernanceSupply
                    }

                    if (top10)
                        setTop10Participants(top10);
                    setMembers(sortedResults);
                }
            
            }catch(e){console.log("ERR: "+e)}
        }
        setLoading(false);
        endTimer();
    }

    const getCachedGovernanceFromLookup = async () => {
        
        let cached_governance = new Array();
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){

                    if (glitem?.realm){
                        setCachedRealm(glitem?.realm);
                    }
                    if (glitem?.memberFilename){
                        const cached_members = await getFileFromLookup(glitem.memberFilename, storagePool);
                        setCachedMemberMap(cached_members);
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
                cupdated.account.options[0].voteWeight = Number(cupdated.account.options[0].voteWeight)
            if (cupdated.account?.denyVoteWeight)
                cupdated.account.denyVoteWeight = Number(cupdated.account.denyVoteWeight).toString()

            if (cupdated.account?.yesVotesCount)
                cupdated.account.yesVotesCount = Number(cupdated.account.yesVotesCount).toString()
            if (cupdated.account?.noVotesCount)
                cupdated.account.noVotesCount = Number(cupdated.account.noVotesCount).toString()
            
            cupdated.account.draftAt = Number(cupdated.account.draftAt).toString()
            cupdated.account.signingOffAt = Number(cupdated.account.signingOffAt).toString()
            cupdated.account.votingAt = Number(cupdated.account.votingAt).toString()
            cupdated.account.votingAtSlot = Number(cupdated.account.votingAtSlot).toString()
            cupdated.account.vetoVoteWeight = Number(cupdated.account.vetoVoteWeight).toString()
            cupdated.account.votingCompletedAt = Number(cupdated.account.votingCompletedAt).toString()

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
        //getGovernance(cached_governance);
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    React.useEffect(() => {
        if (cachedGovernance && governanceAddress){
            getGovernanceMembers();
        }
    }, [cachedGovernance]);

    React.useEffect(() => {
        if (governanceLookup){
            getCachedGovernanceFromLookup();
        }
    }, [governanceLookup, governanceAddress]);
    
    React.useEffect(() => { 
        if (tokenMap){  
            startTimer();
            callGovernanceLookup();
        }
    }, [tokenMap]);

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
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Typography variant="caption">Loading Governance Members {governanceAddress}
                        <><br/>For DAOs with over 2k voters this may take a minute</>
                        {recordCount && 
                            <><br/>Record: {recordCount}</>}
                    </Typography>
                    
                    <LinearProgress color="inherit" />
                </Box>
            )
        } else{
            if (members){
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
                        }} 
                    > 
                        {realm &&
                            <>
                                <Grid container>
                                    <Grid item xs={6} container justifyContent="flex-start">
                                        <Grid container>
                                            <Grid item xs={12}>
                                                <Typography variant="h4">
                                                    {realmName}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Tooltip title={`Share ${realmName ? realmName : ''} Governance Members`}>
                                                    <Button
                                                        aria-label="share"
                                                        variant="outlined"
                                                        color="inherit"
                                                        onClick={() => {
                                                            if (navigator.share) {
                                                                navigator.share({
                                                                    title: `${realmName} Governance`,
                                                                    text: `Visit the ${realmName} DAO:`,
                                                                    url: `https://governance.so/members/${governanceAddress}`
                                                                }).catch((error) => console.error('Error sharing:', error));
                                                            } else {
                                                                alert("Your browser doesn't support the Share API.");
                                                            }
                                                        }}
                                                        sx={{
                                                            borderRadius:'17px',
                                                            borderColor:'rgba(255,255,255,0.05)',
                                                            fontSize:'10px'}}
                                                    >
                                                        <ShareIcon fontSize='inherit' sx={{mr:1}} /> Share
                                                    </Button>
                                                </Tooltip>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={6} container justifyContent="flex-end">
                                        <GovernanceNavigation governanceAddress={governanceAddress} />
                                    </Grid>
                                </Grid>
                            </>
                        }
                        {pluginDao ?
                            <>
                                <Box sx={{ p:1, textAlign:'center'}}>
                                    <Typography variant="h5">This DAO is using a Voter Plugin additional voter stake weight information coming soon...</Typography>
                                </Box>
                            </>
                        :
                            <></>
                        }
                            {(totalDepositedVotes || totalCouncilVotes) &&
                                <Box sx={{ p:1}}>
                                    <Grid container spacing={1}>
                                        <Grid item xs={12} md={6} lg={3} key={1}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:0,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)'
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Active{votingParticipants && `/Participating`}/All Voters</>
                                                </Typography>
                                                <Grid
                                                    container
                                                    justifyContent='center'
                                                    alignItems='center'
                                                    sx={{}}
                                                >
                                                    <Tooltip title={<>
                                                            <strong>Active:</strong> Currently Active Deposited<br/>
                                                            <strong>Participating:</strong> All time Participating voters<br/>
                                                            <strong>All:</strong> Total Lifetime Deposited in Governance</>
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
                                                                    {activeParticipants}{votingParticipants && `/${votingParticipants}`}/{totalParticipants}
                                                                </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Grid>
                                            </Box>
                                        </Grid>
                                        
                                        <Grid item xs={12} md={6} lg={3} key={2}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:0,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)'
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Top 10</>
                                                </Typography>
                                                {top10Participants &&
                                                    <Grid
                                                        container
                                                        justifyContent='center'
                                                        alignItems='center'
                                                        sx={{}}
                                                    >
                                                        <Tooltip title={<>
                                                                    <Typography variant="subtitle2">
                                                                        <strong>Top 10:</strong>
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        <ul>
                                                                            <li>Holders have {getFormattedNumberToLocale(+(top10Participants.votes.toFixed(0)))} votes deposited</li>
                                                                            <li>Hold {top10Participants.percentageOfGovernanceSupply.toFixed(1)}% of the total deposited in Governance</li>
                                                                            <li>Comprise {top10Participants.percentageOfSupply.toFixed(1)}% of the total token supply</li>
                                                                        </ul>
                                                                    </Typography>
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
                                                                        {getFormattedNumberToLocale(top10Participants.votes.toFixed(0))}
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Grid>
                                                }
                                            </Box>
                                        </Grid>

                                        {/*
                                        <Grid item xs={12} md={6} lg={3} key={2}>
                                            <Box
                                                sx={{borderRadius:'24px',m:2,p:1}}
                                            >
                                                <Typography variant="body2" sx={{color:'yellow'}}>
                                                    <>Total Votes</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            {totalVotesCasted && <>Total Votes Casted</>}
                                                            {(totalVotesCasted && totalDepositedCouncilVotes) &&
                                                                <>/</>
                                                            }
                                                            {totalCouncilVotes && <>Total Council Votes Casted</>}
                                                        </>
                                                    }>
                                                    <Button
                                                        color='inherit'
                                                        sx={{
                                                            borderRadius:'17px'
                                                        }}
                                                    >
                                                        <Typography variant="h3">
                                                            {totalVotesCasted && <>{totalVotesCasted}</>}
                                                            {(totalVotesCasted && totalDepositedCouncilVotes) &&
                                                                <>/</>
                                                            }
                                                            {totalCouncilVotes && <>{totalCouncilVotes}</>}
                                                        </Typography>
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        */}
                                        
                                        <Grid item xs={12} md={6} lg={3} key={3}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:0,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)'
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Total Votes Deposited</>
                                                </Typography>
                                                <Grid
                                                    container
                                                    justifyContent='center'
                                                    alignItems='center'
                                                    sx={{}}
                                                >
                                                    <Tooltip title={<>
                                                        {totalUnstakedVotes ?
                                                                <>
                                                                    <Typography variant="subtitle2">
                                                                        <strong>Total Not Staked:</strong>
                                                                    </Typography>
                                                                    <Typography variant="body2">
                                                                        
                                                                        <ul>
                                                                        {/*totalVotesCasted && <>Total Votes Deposited</>}
                                                                        {(totalVotesCasted && totalDepositedCouncilVotes) &&
                                                                            <>/</>
                                                                        }
                                                                        {totalCouncilVotes && <>Total Council Votes Deposited</>*/}
                                                                        
                                                                        <li>{getFormattedNumberToLocale(totalUnstakedVotes)} held in voter wallets</li> : <li>-</li>}
                                                                        </ul>
                                                                    </Typography>
                                                                </>:<>Votes Deposited &amp; Eligible to participate in this DAO</>}
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
                                                                    {totalDepositedVotes &&
                                                                        <>
                                                                            {getFormattedNumberToLocale(+((totalDepositedVotes)/Math.pow(10, governingTokenDecimals || 0)).toFixed(0))}
                                                                        </>
                                                                    }
                                                                    {(totalDepositedVotes && totalDepositedCouncilVotes) &&
                                                                        <>/</>
                                                                    }
                                                                    {totalDepositedCouncilVotes && <>{totalDepositedCouncilVotes}</>}
                                                                </Typography>
                                                            </Grid>
                                                        </Button>
                                                    </Tooltip>
                                                </Grid>
                                                
                                            </Box>
                                        </Grid>
                                        {circulatingSupply && 
                                            <Grid item xs={12} md={6} lg={3} key={4}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:0,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)'
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>% Circulating Supply</>
                                                    </Typography>
                                                    <Grid
                                                        container
                                                        justifyContent='center'
                                                        alignItems='center'
                                                        sx={{}}
                                                    >
                                                        <Tooltip title={<>
                                                                Calculated from the total token circulating supply
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
                                                                        {circulatingSupply.value.amount > 0 ?
                                                                            <>
                                                                                {((totalDepositedVotes/circulatingSupply.value.amount)*100).toFixed(1)}%
                                                                            </>
                                                                        :
                                                                            <>-</>
                                                                        }
                                                                    </Typography>
                                                                </Grid>
                                                            </Button>
                                                        </Tooltip>
                                                    </Grid>
                                                </Box>
                                            </Grid>
                                        }
                                        
                                    </Grid>
                                    {/*
                                    <LinearProgress color={((totalMintsOnCurve)/totalMints*100) < 50 ?'error' : 'success'} variant="determinate" value={(totalMintsOnCurve)/totalMints*100} />
                                        <Typography variant='caption'>
                                            {((totalMintsOnCurve)/totalMints*100).toFixed(0)}% held on a valid wallet address (address on a Ed25519 curve)
                                        </Typography>
                                    */}
                                </Box>
                            }

                        <RenderGovernanceMembersTable members={members} memberMap={cachedMemberMap} participating={participating} tokenMap={tokenMap} governingTokenMint={governingTokenMint} governingTokenDecimals={governingTokenDecimals} circulatingSupply={circulatingSupply} totalDepositedVotes={totalDepositedVotes} />
                    
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime Hybrid Caching<br/>
                                {cachedTimestamp &&
                                    <>Cached: {moment.unix(Number(cachedTimestamp)).format("MMMM D, YYYY, h:mm a") }<br/></>
                                }
                                Cache Node: {storagePool}
                            </Typography>
                        }
                    </Box>
                                
                );
            }else{
                /*
                if (!participating){
                    return (
                        <Box
                            sx={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                p:4
                            }} 
                        > 
                            <Typography variant="h4">
                                You are not participating in this governance
                            </Typography>
                        </Box>
                    );
                } else {
                    */
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
                        <Typography variant="caption">Governance Members {governanceAddress}</Typography>
                        
                    </Box>
                );
                
            }
            
        }
    
}