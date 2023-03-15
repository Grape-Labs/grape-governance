import { getRealm, getAllProposals, getGovernance, getGovernanceAccounts, getGovernanceChatMessages, getTokenOwnerRecord, getTokenOwnerRecordsByOwner, getAllTokenOwnerRecords, getRealmConfigAddress, getGovernanceAccount, getAccountTypes, GovernanceAccountType, tryGetRealmConfig, getRealmConfig  } from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
} from '@mui/material/';

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
import { PROXY, GRAPE_RPC_ENDPOINT, TX_RPC_ENDPOINT, GGAPI_STORAGE_POOL, GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

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
    const endTime = props.endTimer;
    const cachedGovernance = props.cachedGovernance;
    const memberMap = props.memberMap;
    const governanceType = props.governanceType;
    const governanceTokenDecimals = props.governanceTokenDecimals;
    const governaningTokenMint = props.governingTokenMint;
    const tokenMap = props.tokenMap;
    const realm = props.realm;
    const thisToken = props.thisToken;
    const proposals = props.proposals;
    const nftBasedGovernance = props.nftBasedGovernance;
    const governanceAddress = props.governanceAddress;
    const [csvGenerated, setCSVGenerated] = React.useState(null);

    const [voterRecordRows, setVoterRecordRows] = React.useState(null);
    const votingrecordcolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true},
        { field: 'pubkey', headerName: 'PublicKey', width: 260, hide: false},
        { field: 'totalproposalscreated', headerName: 'Proposals Created', width: 140, hide: false},
        { field: 'totalvotes', headerName: 'Total Votes Casted', width: 140, hide: false},
        { field: 'totalvotesfor', headerName: 'Total Votes For', width: 140, hide: false},
        { field: 'totalvotesagainst', headerName: 'Total Votes Against', width: 170, hide: false},
        { field: 'totalproposalparticipation', headerName: 'Total Proposal Participation', width: 140, hide: false},
        { field: 'totalproposalsfor', headerName: 'Total Proposals For', width: 170, hide: false},
        { field: 'totalproposalsagainst', headerName: 'Total Proposals Against', width: 170, hide: false},
        { field: 'totalcouncilvotes', headerName: 'Council Participation', width: 140, hide: false},
        { field: 'totalcouncilvotesfor', headerName: 'Council For', width: 170, hide: false},
        { field: 'totalcouncilvotesagainst', headerName: 'Council Against', width: 170, hide: false},
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
        if (cachedGovernance){
            var voter = 0;
            let csvFile = '';
            for (var item of cachedGovernance){
                const authorPk = item.account.tokenOwnerRecord;
                let authorAddress = null;
                if (authorPk){
                    if (memberMap){
                       for (var memberItem of memberMap){
                            if (memberItem.pubkey.toBase58() === authorPk.toBase58()){
                                authorAddress = memberItem.account.governingTokenOwner.toBase58()
                            }
                        }
                        
                    }
                    
                }

                // item.account.governingTokenOwner.toBase58()
                for (var inner_item of item.votingResults){

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
                        propcreator = 1;
                        console.log("FOUND!")
                    }

                    for (var participant of voterArray){
                        //console.log("t: "+JSON.stringify(item.account))
                        
                        if (participant.pubkey === inner_item.governingTokenOwner.toBase58()){
                            //inner_item.councilMint 
                            //inner_item.governingTokenMint
                            //inner_item.decimals
                            
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

                            foundParticipant = true;
                            
                            participant.totalproposalscreated += propcreator;
                            participant.totalvotes += totalvotes;
                            participant.totalvotesfor += totalvotesfor;
                            participant.totalvotesagainst += totalvotesagainst;
                            participant.totalproposalparticipation += totalproposalparticipation;
                            participant.totalproposalsfor += totalproposalsfor;
                            participant.totalproposalsagainst += totalproposalsagainst;
                            participant.totalcouncilvotes += totalcouncilvotes;
                            participant.totalcouncilvotesfor += totalcouncilvotesfor;
                            participant.totalcouncilvotesagainst += totalcouncilvotesagainst;
                        }
                    }
                    
                    if (!foundParticipant){
                        voterArray.push({
                            id: voter+1,
                            pubkey: inner_item.governingTokenOwner.toBase58(),
                            totalproposalscreated: propcreator,
                            totalvotes: totalvotes,
                            totalvotesfor: totalvotesfor,
                            totalvotesagainst: totalvotesagainst,
                            totalproposalparticipation: totalproposalparticipation,
                            totalproposalsfor: totalproposalsfor,
                            totalproposalsagainst: totalproposalsagainst,
                            totalcouncilvotes: totalcouncilvotes,
                            totalcouncilvotesfor: totalcouncilvotesfor,
                            totalcouncilvotesagainst: totalcouncilvotesagainst,
                        })
                        voter++;
                    }

                }

                var counter = 0;
                for (var voter_item of voterArray){
                    if (counter > 0)
                        csvFile += '\r\n';
                    else
                        csvFile = 'pubkey,totalproposalscreated,totalvotes,totalvotesfor,totalvotesagainst,totalproposalparticipation,totalproposalsfor,totalproposalsagainst,totalcouncilvotes,totalcouncilvotesfor,totalcouncilvotesagainst\r\n';
                    csvFile += voter_item.pubkey+','+voter_item.totalproposalscreated+','+voter_item.totalvotes+','+voter_item.totalvotesfor+','+voter_item.totalvotesagainst+','+voter_item.totalproposalparticipation+','+voter_item.totalproposalsfor+','+voter_item.totalproposalsagainst+','+voter_item.totalcouncilvotes+','+voter_item.totalcouncilvotesfor+','+voter_item.totalcouncilvotesagainst;
                    counter++;
                }


            }

            exportFile(csvFile, governanceAddress+'_metrics.csv')
        }

        setVoterRecordRows(voterArray);

    }

    React.useEffect(() => { 
        if (!voterRecordRows && cachedGovernance)
            renderVoterRecords();
    }, []);

    return (
        <>

            {csvGenerated &&
                <Tooltip title="Download SPL Governance CSV file">
                    <Button
                        download={`${governanceAddress}_metrics.csv`}
                        href={csvGenerated}
                    >
                        <DownloadIcon /> CSV
                    </Button>
                </Tooltip>
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
            <LinearProgress />
        }
        </>

    );

}

export function GovernanceMetricsView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const governanceAddress = urlParams;

    //const governanceAddress = props.governanceAddress;
    const [loading, setLoading] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [realm, setRealm] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const connection = new Connection(GRAPE_RPC_ENDPOINT);
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

    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);

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

    const getGovernance = async (cached_governance:any) => {
        if (!loading){
            startTimer();
            setLoading(true);
            try{
                    
                console.log("SPL Governance: "+governanceAddress);
                
                //console.log("cached_governance: "+JSON.stringify(cached_governance));
                
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                
                const grealm = await getRealm(new Connection(GRAPE_RPC_ENDPOINT), new PublicKey(governanceAddress))
                setRealm(grealm);

                const realmPk = grealm.pubkey;
                const rawTokenOwnerRecords = await getAllTokenOwnerRecords(new Connection(GRAPE_RPC_ENDPOINT), grealm.owner, realmPk)
                setMemberMap(rawTokenOwnerRecords);
                
                let gTD = null;
                if (tokenMap.get(grealm.account?.communityMint.toBase58())){
                    setGovernanceType(0);
                    gTD = tokenMap.get(grealm.account?.communityMint.toBase58()).decimals;
                    setGoverningTokenDecimals(gTD);
                } else{
                    const btkn = await getBackedTokenMetadata(grealm.account?.communityMint.toBase58(), wallet);
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
                    
                    console.log("Cached it is...")
                    
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

                    const gprops = await getAllProposals(new Connection(GRAPE_RPC_ENDPOINT), grealm.owner, realmPk);
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

                    const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.votingAt != null ? b.account?.votingAt : 0) - (a.account?.votingAt != null ? a.account?.votingAt : 0)))
                    
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

    const fetchGovernanceLookupFile = async() => {
        try{
            const url = GGAPI_STORAGE_URI+"/"+storagePool+'/governance_lookup.json';
            const response = await window.fetch(url, {
                method: 'GET',
                headers: {
                }
              });

              const string = await response.text();
              const json = string === "" ? {} : JSON.parse(string);
              setGovernanceLookup(json);
              return json;
        } catch(e){
            console.log("ERR: "+e)
            return null;
        }
    }

    React.useEffect(() => {
        if (tokenMap){
            fetchGovernanceLookupFile();
        }
    }, [tokenMap]);

    React.useEffect(() => {
        if (governanceLookup){
            getCachedGovernanceFromLookup();
        }
    }, [governanceLookup, governanceAddress]);
    
    
    React.useEffect(() => {
        if (cachedGovernance && governanceAddress){
            getGovernance(cachedGovernance);
        }
    }, [cachedGovernance]);

    const fetchGovernanceFile = async(fileName:string) => {
        try{
            const url = GGAPI_STORAGE_URI+"/"+GGAPI_STORAGE_POOL+'/'+fileName+'';
            const response = await window.fetch(url, {
                method: 'GET',
                headers: {
                }
              });
              const string = await response.text();
              const json = string === "" ? {} : JSON.parse(string);
              
              return json;
        } catch(e){
            console.log("ERR: "+e)
            return null;
        }
    }

    const getGovernanceFromLookup  = async (fileName:string) => {
        const fgl = await fetchGovernanceFile(fileName);
        return fgl;
    } 
    
    const getCachedGovernanceFromLookup = async () => {
        
        let cached_governance = new Array();
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){

                    if (glitem?.realm){
                        const rawTokenOwnerRecords = await getAllTokenOwnerRecords(new Connection(GRAPE_RPC_ENDPOINT), new PublicKey(glitem?.realm.owner), new PublicKey(glitem?.realm.pubkey))
                        setMemberMap(rawTokenOwnerRecords);
                    }

                    cached_governance = await getGovernanceFromLookup(glitem.filename);
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
        getGovernance(cached_governance);
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
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Typography variant="caption">Loading Governance {governanceAddress}...</Typography>
                    
                    <LinearProgress />
                    
                </Box>
            )
        } else{
            if (proposals && memberMap && tokenMap){
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }} 
                    > 
                        {realm &&
                            <>
                                <Grid container>
                                    <Grid item xs={12} sm={6} container justifyContent="flex-start">
                                        <Typography variant="h4">
                                            {realm.account.name}

                                            <Button
                                                size='small'
                                                sx={{ml:1, color:'white', borderRadius:'17px'}}
                                                href={'https://realms.today/dao/'+(governanceAddress)}
                                                target='blank'
                                            >
                                                <OpenInNewIcon/>
                                            </Button>
                                        
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6} container justifyContent="flex-end">
                                        METRICS
                                    </Grid>
                                </Grid>
                            </>
                        }

                        <RenderVoterRecordTable memberMap={memberMap} endTimer={endTimer} cachedGovernance={cachedGovernance} memberMap={memberMap} governanceType={governanceType} governingTokenDecimals={governingTokenDecimals} governingTokenMint={governingTokenMint} tokenMap={tokenMap} realm={realm} thisToken={thisToken} proposals={proposals} nftBasedGovernance={nftBasedGovernance} governanceAddress={governanceAddress} />
                        
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Cached<br/>
                                Cache Node: {storagePool}
                                <br/>* This is the time taken to capture all proposals & proposal details
                            </Typography>
                        }
                    </Box>
                                
                );
            }else{
                return (<></>);
            }
            
        }
    
}