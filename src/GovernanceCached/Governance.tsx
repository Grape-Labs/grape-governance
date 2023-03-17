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

import InfoIcon from '@mui/icons-material/Info';
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

function GetParticipants(props: any){
    const cachedGovernance = props.cachedGovernance;
    const governanceLookup = props.governanceLookup;
    const connection = new Connection(GRAPE_RPC_ENDPOINT);
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const governanceAddress = props.governanceAddress;
    const thisitem = props.item;
    //const [thisitem, setThisItem] = React.useState(props.item);
    const realm = props.realm;
    const [csvGenerated, setCSVGenerated] = React.useState(null); 
    const [jsonGenerated, setJSONGenerated] = React.useState(null);
    const [solanaVotingResultRows,setSolanaVotingResultRows] = React.useState(null);
    const [open, setOpen] = React.useState(false);
    const [tokenDecimals, setTokenDecimals] = React.useState(null);
    const [voteType, setVoteType] = React.useState(null);
    const [propVoteType, setPropVoteType] = React.useState(null); // 0 council, 1 token, 2 nft
    const [uniqueYes, setUniqueYes] = React.useState(0);
    const [uniqueNo, setUniqueNo] = React.useState(0);
    const [gist, setGist] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [thisGovernance, setThisGovernance] = React.useState(null);
    const [proposalAuthor, setProposalAuthor] = React.useState(null);
    const [governingMintInfo, setGoverningMintInfo] = React.useState(null);
    const [totalQuorum, setTotalQuorum] = React.useState(null);
    const [quorumTargetPercentage, setQuorumTargetPercentage] = React.useState(null);
    const [quorumTarget, setQuorumTarget] = React.useState(null);
    const [totalSupply, setTotalSupply] = React.useState(null);
    const [exceededQuorum, setExceededQuorum] = React.useState(null);
    const [exceededQuorumPercentage, setExceededQuorumPercentage] = React.useState(null);
    const [selectedDelegate, setSelectedDelegate] = React.useState("");
    const { publicKey, wallet, sendTransaction, signTransaction } = useWallet();
    const freeconnection = new Connection(TX_RPC_ENDPOINT);
    const [loadingParticipants, setLoadingParticipants] = React.useState(false);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const votingresultcolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true},
        { field: 'pubkey', headerName: 'PublicKey', width: 170, hide: true,
            renderCell: (params) => {
                return(params.value)
            }
        },
        { field: 'proposal', headerName: 'Proposal', width: 170, hide: true,
            renderCell: (params) => {
                return(params.value)
            }
        },
        { field: 'governingTokenOwner', headerName: 'Token Owner', width: 170, flex: 1,
            renderCell: (params) => {
                return(
                    <ExplorerView showSolanaProfile={true} grapeArtProfile={true} address={params.value} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
        },
        { field: 'voteAddress', headerName: 'Address', width: 150,
            renderCell: (params) => {
                return(
                    <ExplorerView address={params.value} type='address' shorten={4} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
        },
        { field: 'quorumWeight', headerName: 'Quorum Weight', headerAlign: 'center', width: 250, align: 'right', hide: totalQuorum ? false : true,
            renderCell: (params) => {
                return(
                    <>
                        {totalQuorum && params.value.voterWeight ?
                            <>
                            {(((parseInt(params.value.voterWeight)/Math.pow(10, params.value.decimals))/totalQuorum)*100).toFixed(2)} % 
                            </>
                        :
                            <>
                            {(params.value.legacyYes && params.value.legacyYes > 0) ?
                                `${(((parseInt(params.value.legacyYes)/Math.pow(10, params.value.decimals))/totalQuorum)*100).toFixed(2)} %`
                            :
                                `${(((parseInt(params.value.legacyNo)/Math.pow(10, params.value.decimals))/totalQuorum)*100).toFixed(2)} %`
                            }
                            </>
                        }
                        
                        
                    </>
                );
            }
        },
        { field: 'vote', headerName: 'Voting', headerAlign: 'center', width: 250, align: 'right',
            renderCell: (params) => {
                return(
                    <>
                        {params.value.vote ?
                            <Chip
                                variant="outlined"
                                color={params.value?.vote?.voteType === 0 ?
                                    'success'
                                    :
                                    'error'
                                }
                                icon={params?.value?.vote?.voteType === 0 ?
                                    <ThumbUpIcon color='success' fontSize='small' sx={{ml:1}} />
                                    :
                                    <ThumbDownIcon fontSize='small' sx={{color:'red',ml:1}}/>
                                }
                                label={params.value?.voterWeight > 1 ?
                                    `${getFormattedNumberToLocale(formatAmount(+(parseInt(params.value.voterWeight)/Math.pow(10, params.value.decimals)).toFixed(0)))} votes` 
                                    :
                                    `${getFormattedNumberToLocale(formatAmount(+(parseInt(params.value.voterWeight)/Math.pow(10, params.value.decimals)).toFixed(0)))} vote` 
                                }
                            />
                        :
                            <Chip
                                variant="outlined"
                                color={params.value?.legacyYes > 0 ?
                                    'success'
                                    :
                                    'error'
                                }
                                icon={params.value?.legacyYes > 0 ?
                                    <ThumbUpIcon fontSize='small' color='success' sx={{ml:1}} />
                                    :
                                    <ThumbDownIcon fontSize='small' sx={{color:'red',ml:1}}/>
                                }
                                label={params.value?.legacyYes > 0 ? 
                                        <>
                                        {params.value?.legacyYes > 1 ?
                                            `${getFormattedNumberToLocale(formatAmount(+(parseInt(params.value?.legacyYes)/Math.pow(10, params.value.decimals)).toFixed(0)))} votes` 
                                        :
                                            `${getFormattedNumberToLocale(formatAmount(+(parseInt(params.value?.legacyYes)/Math.pow(10, params.value.decimals)).toFixed(0)))} vote` 
                                        }
                                        </>
                                    :
                                        <>

                                        {params.value?.legacyNo > 1 ?
                                            `${getFormattedNumberToLocale(formatAmount(+(parseInt(params.value?.legacyNo)/Math.pow(10, params.value.decimals)).toFixed(0)))} votes` 
                                        :
                                            `${getFormattedNumberToLocale(formatAmount(+(parseInt(params.value?.legacyNo)/Math.pow(10, params.value.decimals)).toFixed(0)))} vote` 
                                        }
                                        </>
                                    }
                        />
                        
                        }
                    </>
                );
            }
        },
    ];

    const getGovernanceProps = async () => {
        let governance_item = null;
        let governance = null;
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){
                    governance_item = glitem;
                    if (glitem?.governance)
                        governance = glitem.governance;
                }
            }
        }

        if (!governance){
            governance = await getGovernance(connection, thisitem.account.governance);    
        }
        setThisGovernance(governance);
        
        //console.log("realm"+JSON.stringify(realm));
        //console.log("Single governance: "+JSON.stringify(governance));
        //console.log("thisitem "+JSON.stringify(thisitem))

        //const tor = await getTokenOwnerRecord(connection, new PublicKey(publicKey));
        //console.log("tor: "+JSON.stringify(tor));

        try{
            //console.log(">>>> "+JSON.stringify(thisitem.account))
            //const communityMintPromise = connection.getParsedAccountInfo(
            //    new PublicKey(governance.account.config.communityMint?.toBase58())
            //);

            let governingMintDetails = null;
            if (governance_item?.governingMintDetails){ // save even more RPC calls
                governingMintDetails = governance_item.governingMintDetails;
            }else{
                await connection.getParsedAccountInfo(
                    new PublicKey(thisitem.account.governingTokenMint)
                );
            }
            
            //console.log("communityMintPromise ("+thisitem.account.governingTokenMint+") "+JSON.stringify(governingMintPromise))
            setGoverningMintInfo(governingMintDetails);
            
            const communityWeight = governingMintDetails.value.data.parsed.info.supply - realm.account.config.minCommunityTokensToCreateGovernance.toNumber();
            //console.log("communityWeight: "+communityWeight);
            
            const communityMintMaxVoteWeightSource = realm.account.config.communityMintMaxVoteWeightSource
            const supplyFractionPercentage = communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
            const communityVoteThreshold = governance.account.config.communityVoteThreshold
            const councilVoteThreshold = governance.account.config.councilVoteThreshold
            
            //console.log("supplyFractionPercentage: "+supplyFractionPercentage)
            //console.log("communityVoteThreshold: "+JSON.stringify(communityVoteThreshold))
            //console.log("councilVoteThreshold: "+JSON.stringify(councilVoteThreshold))

            //const mintSupply = governingMintPromise.value.data.data.parsed.info.supply;
            //const mintDecimals = governingMintPromise.value.data.data.parsed.info.decimals; 
            
            const voteThresholdPercentage=
                realm.account.config.councilMint.toBase58() === thisitem.account.governingTokenMint.toBase58()
                ? councilVoteThreshold.value
                : communityVoteThreshold.value
            
            const tSupply = Number(governingMintDetails.value.data.parsed.info.supply/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals)) 
            
            setTotalSupply(tSupply);
            
            const totalVotes =
                Number(governingMintDetails.value.data.parsed.info.supply/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals))  *
                //Number(communityWeight/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals))  *
                (voteThresholdPercentage * 0.01) *
                  (Number(supplyFractionPercentage) / 100);
            
            //console.log("totalVotes: "+totalVotes)
            //console.log("voteThresholdPercentage: "+(voteThresholdPercentage * 0.01))
            //console.log("supplyFractionPercentage: "+(Number(supplyFractionPercentage) / 100))
            
            if (totalVotes && totalVotes > 0)
                setTotalQuorum(totalVotes);
            
            const qt = totalVotes-Number(thisitem.account.options[0].voteWeight)/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals);
            const yesVotes = Number(thisitem.account.options[0].voteWeight)/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals);
            
            const excess = yesVotes - totalVotes;
            
            if (excess > 0){
                setExceededQuorum(excess);
                setExceededQuorumPercentage(excess/totalVotes*100);
            }

            //console.log("yesVotes: "+yesVotes);
            const totalVotesNeeded = Math.ceil(totalVotes - yesVotes);

            if (qt < 0){
                setQuorumTargetPercentage(100);
            }else{
                setQuorumTargetPercentage((totalVotesNeeded / totalVotes) * 100);
                setQuorumTarget(totalVotesNeeded);
            }

        }catch(e){
            console.log('ERR: '+e)
        }
    }


    const handleCloseDialog = () => {
        setOpen(false);
    }

    const handleClickOpen = () => {
        setOpen(true);
        getVotingParticipants();
    };

    const handleClose = () => {
        setOpen(false);
    };

    const getVotingParticipants = async () => {
        setLoadingParticipants(true);

        let td = 6; // this is the default for NFT mints
        let vType = null;
        try{
            td = tokenMap.get(thisitem.account.governingTokenMint?.toBase58()).decimals;
            vType = 'Token';
            //console.log("tokenMap: "+tokenMap.get(thisitem.account.governingTokenMint?.toBase58()).decimals);
        }catch(e){
            //console.log("ERR: "+e);
        }
        
        if (realm.account.config?.councilMint?.toBase58() === thisitem?.account?.governingTokenMint?.toBase58()){
            vType = 'Council';
            td = 0;
        }
        
        if (!vType){
            // check if backed token
            // important check if we have already fetched this data already
            const btkn = await getBackedTokenMetadata(thisitem.account.governingTokenMint?.toBase58(), wallet);
            if (btkn){
                // get parent token name
                const parentToken = tokenMap.get(btkn.parentToken);
                vType = parentToken ? `${parentToken.name} Backed Token` : `Backed Token`;
                td = btkn.decimals;
            } else{
                vType = 'NFT';
                td = 6;
            }
        }
        setTokenDecimals(td);
        setVoteType(vType)

        if (vType){
            setPropVoteType(vType);

            //thisitem.account.tokenOwnerRecord;
            for (const item of memberMap){
                if (item.pubkey.toBase58() === thisitem.account.tokenOwnerRecord.toBase58()){
                    setProposalAuthor(item.account.governingTokenOwner.toBase58())
                    //console.log("member:" + JSON.stringify(item));
                }
            }
        }

        //if (thisitem.account?.state === 2){ // if voting state
            getGovernanceProps()
        //}


        /* RPC
        const voteRecord = await getVoteRecords({
            connection: connection,
            programId: new PublicKey(thisitem.owner),
            proposalPk: new PublicKey(thisitem.pubkey),
        });
        const voteResults = voteRecord.value;//JSON.parse(JSON.stringify(voteRecord));
        */
        // CACHE
        // fetch voting results
        let voteRecord = null;
        let from_cache = false;
        for (var vresults of cachedGovernance){
            if (thisitem.pubkey === vresults.pubkey){
                voteRecord = vresults.votingResults;
                from_cache = true;
            }
        }

        const voteResults = voteRecord;//JSON.parse(JSON.stringify(voteRecord));
        
        const votingResults = [];
        let csvFile = '';
        let uYes = 0;
        let uNo = 0;
        if (voteResults){
            let counter = 0;

            for (let item of voteResults){
                counter++;
                
                if (!from_cache){
                    if (item.voteType?.vote){
                        if (item.account?.vote?.voteType === 0){
                            uYes++;
                        }else{
                            uNo++;
                        }
                    } else{
                        if (item.account.voteWeight.yes && item.account.voteWeight.yes > 0){
                            uYes++;
                        } else{
                            uNo++;
                        }
                    }
                    
                    votingResults.push({
                        id:counter,
                        pubkey:item.pubkey.toBase58(),
                        proposal:item.account.proposal.toBase58(),
                        governingTokenOwner:item.account.governingTokenOwner.toBase58(),
                        voteAddress:item.pubkey.toBase58(),
                        quorumWeight:{
                            vote:item.account.vote,
                            voterWeight:(item.account?.voterWeight ?  item.account?.voterWeight.toNumber() : null),
                            legacyYes:(item.account?.voteWeight?.yes ?  item.account?.voteWeight?.yes.toNumber() : null),
                            legacyNo:(item.account?.voteWeight?.no ?  item.account?.voteWeight?.no.toNumber() : null),
                            decimals:(realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td),
                            councilMint:realm.account.config?.councilMint?.toBase58() ,
                            governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                        },
                        vote:{
                            vote:item.account.vote,
                            voterWeight:(item.account?.voterWeight ?  item.account?.voterWeight.toNumber() : null),
                            legacyYes:(item.account?.voteWeight?.yes ?  item.account?.voteWeight?.yes.toNumber() : null),
                            legacyNo:(item.account?.voteWeight?.no ?  item.account?.voteWeight?.no.toNumber() : null),
                            decimals:(realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td),
                            councilMint:realm.account.config?.councilMint?.toBase58() ,
                            governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                        }
                    })
                } else {   
                    
                    console.log(item.governingTokenOwner.toBase58() + ": "+item?.vote.voterWeight);
                    
                    if (item.vote?.vote){
                        if (item.vote?.vote?.voteType === 0){
                            uYes++;
                        }else{
                            uNo++;
                        }
                    } else{
                        if (item.vote.vote.voteWeight.yes && item.vote.vote.voteWeight.yes > 0){
                            uYes++;
                        } else{
                            uNo++;
                        }
                    }

                    votingResults.push({
                        id:counter,
                        pubkey:item.pubkey.toBase58(),
                        proposal:item.proposal.toBase58(),
                        governingTokenOwner:item.governingTokenOwner.toBase58(),
                        voteAddress:item.voteAddress.toBase58(),
                        quorumWeight:{
                            vote:item.vote.vote,
                            voterWeight:(item.vote?.voterWeight ?  (item.vote.voterWeight) : null),
                            legacyYes:(item.vote.legacyYes ?  (item.vote.legacyYes) : null),
                            legacyNo:(item.vote.legacyNo ?  (item.vote.legacyNo) : null),
                            decimals:(item.vote.decimals ?  (item.vote.decimals) : 0),
                            councilMint:realm.account.config?.councilMint?.toBase58() ,
                            governingTokenMint:thisitem.vote?.governingTokenMint.toBase58() 
                        },
                        vote:{
                            vote:item.vote.vote,
                            voterWeight:(item.vote?.voterWeight ?  (item.vote.voterWeight) : null),
                            legacyYes:(item.vote.legacyYes ?  (item.vote.legacyYes) : null),
                            legacyNo:(item.vote.legacyNo ?  (item.vote.legacyNo) : null),
                            decimals:(item.vote.decimals ?  (item.vote.decimals) : 0),
                            councilMint:realm.account.config?.councilMint?.toBase58() ,
                            governingTokenMint:thisitem.vote?.governingTokenMint.toBase58() 
                        }
                    });
                        
                }

                if (counter > 1)
                    csvFile += '\r\n';
                else
                    csvFile = 'tokenOwner,uiVotes,voterWeight,tokenDecimals,voteType,proposal\r\n';
                
                let voteType = 0;
                let voterWeight = 0;


                if (!from_cache){
                    if (item.account?.voterWeight){
                        voteType = item.account?.vote?.voteType;
                        voterWeight = Number(item.account?.voterWeight);
                    } else{
                        if (item.account?.voteWeight?.yes && item.account?.voteWeight?.yes > 0){
                            voteType = 0
                            voterWeight = item.account?.voteWeight?.yes
                        }else{
                            voteType = 1
                            voterWeight = item.account?.voteWeight?.no
                        }
                    }
                    csvFile += item.account.governingTokenOwner.toBase58()+','+(+((voterWeight)/Math.pow(10, (realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.account.proposal.toBase58()+'';
                
                } else{
                    if (item.vote?.voterWeight){
                        voteType = item.vote?.vote?.voteType;
                        voterWeight = Number(item.vote?.voterWeight);
                    } else{
                        if (item.vote?.voteWeight?.yes && item.account?.voteWeight?.yes > 0){
                            voteType = 0
                            voterWeight = item.vote?.voteWeight?.yes
                        }else{
                            voteType = 1
                            voterWeight = item.vote?.voteWeight?.no
                        }
                    }
                    csvFile += item.governingTokenOwner.toBase58()+','+(+((voterWeight)/Math.pow(10, (realm.account.config?.councilMint?.toBase58() === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint?.toBase58() === thisitem.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.proposal.toBase58()+'';
                    
                }
                
                //    csvFile += item.pubkey.toBase58();
            }
        }

        //console.log("votingResults: "+JSON.stringify(votingResults));

        votingResults.sort((a:any, b:any) => a?.vote.voterWeight < b?.vote.voterWeight ? 1 : -1); 

        if (!from_cache){
            try{
                const url = new URL(thisitem.account?.descriptionLink);
                const pathname = url.pathname;
                const parts = pathname.split('/');
                //console.log("pathname: "+pathname)
                let tGist = null;
                if (parts.length > 1)
                    tGist = parts[2];
                
                setGist(tGist);

                const rpd = await resolveProposalDescription(thisitem.account?.descriptionLink);
                setProposalDescription(rpd);
            } catch(e){
                console.log("ERR: "+e)
            }
        } else {
            try{
                const url = new URL(thisitem?.descriptionLink);
                const pathname = url.pathname;
                const parts = pathname.split('/');
                //console.log("pathname: "+pathname)
                let tGist = null;
                if (parts.length > 1)
                    tGist = parts[2];
                
                setGist(tGist);

                const rpd = await resolveProposalDescription(thisitem?.descriptionLink);
                setProposalDescription(rpd);
            } catch(e){
                console.log("ERR: "+e)
            }
        }

        setUniqueYes(uYes);
        setUniqueNo(uNo);

        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
            JSON.stringify(votingResults)
        )}`;

        //console.log("jsonString: "+JSON.stringify(jsonString));

        setJSONGenerated(jsonString);
        
        const jsonCSVString = encodeURI(`data:text/csv;chatset=utf-8,${csvFile}`);
        //console.log("jsonCSVString: "+JSON.stringify(jsonCSVString));
        
        setCSVGenerated(jsonCSVString); 
        
        setSolanaVotingResultRows(votingResults)
        //console.log("Vote Record: "+JSON.stringify(voteRecord));
        //console.log("This vote: "+JSON.stringify(thisitem));
        setLoadingParticipants(false);
    }

    function VoteForProposal(props:any){
        const type = props.type || 0;

        const isCommunityVote = propVoteType !== 'Council'; //realm.account.config?.councilMint?.toBase58() !== thisitem?.account.governingTokenMint;// realm?.communityMint === thisitem?.account.governingTokenMint;
        //console.log("isCommunityVote: "+JSON.stringify(isCommunityVote));
        
        const handleVoteYes = async () => {
            const proposal = {
                governanceId: thisitem.account.governance,
                proposalId: thisitem.pubkey,
                tokenOwnerRecord: thisitem.account.tokenOwnerRecord,
                governingTokenMint: thisitem.account.governingTokenMint
            }
            const transactionData = {proposal:proposal,action:0}
            console.log("realm: "+JSON.stringify(realm));
            console.log("thisitem/proposal: "+JSON.stringify(thisitem));
            console.log("thisGovernance: "+JSON.stringify(thisGovernance));
            
            const realmData = {
                pubKey:thisGovernance.pubkey,
                realmId:thisitem.pubkey,
                governanceId:thisitem.account.governance,
                communityMint: thisitem.account.governingTokenMint
            }

            const vvvt = await createCastVoteTransaction(
                realmData,
                publicKey.toBase58(),
                transactionData,
                memberMap,
                null,
                isCommunityVote
            );

            try{
                enqueueSnackbar(`Preparing to cast vote`,{ variant: 'info' });
                const signature = await sendTransaction(vvvt, freeconnection, {
                    skipPreflight: true,
                    preflightCommitment: "confirmed",
                });
                const snackprogress = (key:any) => (
                    <CircularProgress sx={{padding:'10px'}} />
                );
                const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
                //await connection.confirmTransaction(signature, 'processed');
                const latestBlockHash = await connection.getLatestBlockhash();
                await connection.confirmTransaction({
                    blockhash: latestBlockHash.blockhash,
                    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                    signature: signature}, 
                    'processed'
                );
                closeSnackbar(cnfrmkey);
                const action = (key:any) => (
                        <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                            Signature: {signature}
                        </Button>
                );
                
                enqueueSnackbar(`Congratulations, you have participated in voting for this Proposal`,{ variant: 'success', action });
            }catch(e:any){
                enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
            } 
            

        }

        return (
        <>
            {/*thisitem.account?.state === 2 && 
                <>{type === 0 ?
                        <Button
                            onClick={handleVoteYes}
                            sx={{borderRadius:'17px',textTransform:'none'}}
                        >Vote YES</Button>
                    :
                        <Button
                            sx={{borderRadius:'17px',textTransform:'none'}}
                        >Vote NO</Button>
                    }
                </>
            */}
        </>);
    }


    
    return (
        <>
            <Tooltip title='Get Voting Details for this Proposal'>
                <Button 
                    onClick={handleClickOpen}
                    sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                    <FitScreenIcon />
                </Button>
            </Tooltip>
            {!loadingParticipants &&
            <BootstrapDialog 
                maxWidth={"xl"}
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
                <BootstrapDialogTitle id="create-storage-pool" onClose={handleCloseDialog}>
                    Proposal Details
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    <Box sx={{ alignItems: 'center', textAlign: 'center',p:1}}>
                        <Typography variant='h5'>{thisitem.account?.name}</Typography>
                    </Box>
                    
                    {proposalAuthor &&
                        <Box sx={{ alignItems: 'center', textAlign: 'center'}}>
                            <Typography variant='body1'>Author: <ExplorerView showSolanaProfile={true} grapeArtProfile={true} address={proposalAuthor} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/></Typography>
                        </Box>
                    }
                    
                    <Box sx={{ alignItems: 'center', textAlign: 'center'}}>
                        {gist ?
                            <Box sx={{ alignItems: 'left', textAlign: 'left', p:1}}>
                                <Typography variant='body2'>
                                    <ReactMarkdown remarkPlugins={[[remarkGfm, {singleTilde: false}]]}>
                                        {proposalDescription}
                                    </ReactMarkdown>
                                </Typography>
                                
                                <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                    {/*
                                    <Gist id={gist} />
                                    */}
                                    <Button
                                        color='inherit'
                                        href={thisitem.account?.descriptionLink}
                                        sx={{borderRadius:'17px'}}
                                    >
                                        <GitHubIcon sx={{mr:1}} /> GIST
                                    </Button>
                                </Box>
                            </Box>
                            :
                            <>
                                {thisitem.account?.descriptionLink &&
                                    <>
                                        <Typography variant='body1'>{thisitem.account?.descriptionLink}</Typography>
                                    </>
                                }
                            </>
                        }
                        </Box>
                    

                    {propVoteType &&
                        <Box sx={{ alignItems: 'center', textAlign: 'center',p:1}}>
                            <Grid container spacing={0}>
                                
                                <Grid item xs={12} sm={6} md={6} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>For</>
                                        </Typography>
                                        <Typography variant="h3">
                                            {thisitem.account?.options && thisitem.account?.options[0]?.voteWeight && thisitem?.account?.denyVoteWeight && Number(thisitem.account?.options[0].voteWeight) > 0 ?
                                                <>
                                                {`${(((Number(thisitem.account?.options[0].voteWeight))/((Number(thisitem.account?.denyVoteWeight))+(Number(thisitem.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                </>
                                            :
                                                <>
                                                    {thisitem.account.yesVotesCount ?
                                                        <>{(Number(thisitem.account.yesVotesCount)/(Number(thisitem.account.noVotesCount)+thisitem.account.yesVotesCount.toNumber())*100).toFixed(2)}%</>
                                                    :
                                                        <>0%</>
                                                    }
                                                </>
                                            }                  
                                        </Typography>
                                        {thisitem.account?.options && thisitem.account?.options.length >= 0 ? 
                                            <Typography variant="caption">
                                                <Chip variant='outlined' color='success'
                                                    icon={<ThumbUpIcon color='success' fontSize='small' sx={{ml:1}} />}
                                                    label={getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.options[0].voteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                />
                                            </Typography>
                                        :
                                            <>
                                                {thisitem.account?.yesVotesCount && 
                                                    <Typography variant="caption">
                                                        <Chip variant='outlined' color='success'
                                                            icon={<ThumbUpIcon color='success' fontSize='small' sx={{ml:1}} />}
                                                            label={getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.yesVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                        />
                                                    </Typography>
                                                }
                                            </>
                                        }

                                        <VoteForProposal type={0} />
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={6} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Against</>
                                        </Typography>
                                        <Typography variant="h3">
                                            {thisitem.account?.options && thisitem.account?.options[0]?.voteWeight && thisitem?.account?.denyVoteWeight && Number(thisitem.account?.options[0].voteWeight) > 0 ?
                                                <>
                                                {`${(((Number(thisitem.account?.denyVoteWeight)/Math.pow(10, tokenDecimals))/((Number(thisitem.account?.denyVoteWeight)/Math.pow(10, tokenDecimals))+(Number(thisitem.account?.options[0].voteWeight)/Math.pow(10, tokenDecimals))))*100).toFixed(2)}%`}
                                                </>
                                            :
                                                <>
                                                    {thisitem.account.noVotesCount ?
                                                        <>{(Number(thisitem.account.noVotesCount)/(Number(thisitem.account.noVotesCount)+Number(thisitem.account.yesVotesCount))*100).toFixed(2)}%</>
                                                    :
                                                        <>0%</>
                                                    }
                                                </>
                                            }
                                        </Typography>
                                        {thisitem.account?.denyVoteWeight ?
                                            <Typography variant="caption">
                                                <Chip variant='outlined' color='error'
                                                    icon={<ThumbDownIcon color='error' fontSize='small' sx={{ml:1}} />}
                                                    label={getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.denyVoteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                />
                                            </Typography>
                                        :
                                            <>
                                                {thisitem.account?.noVotesCount && 
                                                    <Typography variant="caption">
                                                        <Chip variant='outlined' color='error'
                                                            icon={<ThumbDownIcon color='error' fontSize='small' sx={{ml:1}} />}
                                                            label={getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.noVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                        />
                                                    </Typography>
                                                }
                                            </>
                                        }
                                        <VoteForProposal type={1} />
                                    </Box>
                                </Grid>
                                
                                { 
                                    <Grid item xs={12}>
                                        {thisitem.account?.state === 3 ?
                                            <>
                                                 <Box sx={{ width: '100%' }}>
                                                    <BorderLinearProgress variant="determinate" value={100} />
                                                    <Typography variant='caption'>Passed</Typography>
                                                </Box>
                                            </>
                                        :
                                            <>
                                                {thisitem.account?.state !== 7 &&
                                                    <>
                                                        {totalQuorum && totalQuorum > 0 &&
                                                            <Box sx={{ width: '100%' }}>
                                                                <BorderLinearProgress variant="determinate" 
                                                                    value={quorumTargetPercentage < 100 ? 100-quorumTargetPercentage : 100} />
                                                                {quorumTarget ? 
                                                                    <Typography variant='caption'>{getFormattedNumberToLocale(formatAmount(quorumTarget))} more votes remaining to reach quorum</Typography>
                                                                :
                                                                    <Typography variant='caption'>Quorum Reached <CheckIcon sx={{fontSize:'10px'}} />  {exceededQuorumPercentage && `${exceededQuorumPercentage.toFixed(1)}% votes exceeded quorum`}</Typography>
                                                                }
                                                            </Box>
                                                        }
                                                    </>
                                                }
                                            </>
                                        }
                                    </Grid>
                                }
                                
                                <Grid item xs={12} sm={6} md={3} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Type</>
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            <Tooltip title={
                                                <>{governingMintInfo &&
                                                    <>
                                                    {`Mint: ${thisitem.account.governingTokenMint}`}
                                                    {totalSupply &&
                                                        <>
                                                        <br />
                                                        {`Supply: 
                                                            ${getFormattedNumberToLocale(totalSupply)}`
                                                        }
                                                        </>
                                                    }
                                                    {totalQuorum &&
                                                        <>
                                                            <br />
                                                            {`Quorum: ${getFormattedNumberToLocale(+(totalQuorum).toFixed(0))}`}
                                                        </>
                                                    }
                                                    </>
                                                    }
                                                </>
                                                }>
                                                <Chip
                                                    variant="outlined"
                                                    label={propVoteType}
                                                />
                                            </Tooltip>
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>Participation</>
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            <Tooltip title='Unique Votes / Total Votes casted from Participants'>
                                                <Button
                                                    sx={{borderRadius:'17px'}}
                                                    variant="text"
                                                    color="inherit"
                                                >
                                                <>
                                                {solanaVotingResultRows && solanaVotingResultRows.length}
                                                </>&nbsp;/&nbsp;
                                                <>
                                                    {thisitem.account?.options && thisitem.account?.options.length >= 0 ? 
                                                        <Typography variant="caption">
                                                            {getFormattedNumberToLocale(formatAmount(+((Number(thisitem.account.options[0].voteWeight) + Number(thisitem.account.denyVoteWeight))/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                        </Typography>
                                                    :
                                                        <>
                                                            {thisitem.account?.yesVotesCount && 
                                                                <Typography variant="caption">
                                                                    {getFormattedNumberToLocale(formatAmount(+((Number(thisitem.account.yesVotesCount) + Number(thisitem.account.noVotesCount)) /Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                </Typography>
                                                            }
                                                        </>
                                                    }
                                                </>
                                                </Button>
                                            </Tooltip>
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            <>General Sentiment</>
                                        </Typography>
                                        <Typography variant="subtitle2">
                                            <Tooltip title='Unique For Votes / Unique Against Votes'>
                                                <Button
                                                    sx={{borderRadius:'17px'}}
                                                    variant="text"
                                                    color="inherit"
                                                >
                                                    {uniqueYes} / {uniqueNo}
                                                </Button>
                                            </Tooltip>
                                        </Typography>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} sm={6} md={3} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            Export
                                        </Typography>
                                        <Typography variant="subtitle2">
                                        <ButtonGroup size="small" color='inherit'>
                                            {jsonGenerated &&
                                                <Tooltip title="Download Voter Participation JSON file">
                                                    <Button
                                                        sx={{borderBottomLeftRadius:'17px',borderTopLeftRadius:'17px'}}
                                                        download={`${thisitem.pubkey.toBase58()}.csv`}
                                                        href={jsonGenerated}
                                                    >
                                                        <DownloadIcon /> JSON
                                                    </Button>
                                                </Tooltip>
                                            }

                                            {csvGenerated &&
                                                <Tooltip title="Download Voter Participation CSV file">
                                                    <Button
                                                        sx={{borderBottomRightRadius:'17px',borderTopRightRadius:'17px'}}
                                                        download={`${thisitem.pubkey.toBase58()}.csv`}
                                                        href={csvGenerated}
                                                    >
                                                        <DownloadIcon /> CSV
                                                    </Button>
                                                </Tooltip>
                                            }
                                        </ButtonGroup>
                                        
                                        </Typography>
                                    </Box>
                                </Grid>

                                {thisitem.account?.votingAt &&
                                    <Grid item xs={12} sm={6} md={3} key={1}>
                                        <Box
                                            className='grape-store-stat-item'
                                            sx={{borderRadius:'24px',m:2,p:1}}
                                        >
                                            <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                <>Started At</>
                                            </Typography>
                                            <Typography variant="subtitle2">
                                                {moment.unix(Number(thisitem.account?.votingAt)).format("MMMM Da, YYYY, h:mm a")}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                }
                                
                                <Grid item xs={12} sm={6} md={3} key={1}>
                                    <Box
                                        className='grape-store-stat-item'
                                        sx={{borderRadius:'24px',m:2,p:1}}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                            {thisitem.account?.votingCompletedAt ?
                                                <>Ended At</>
                                            :
                                                <>Ends At</>
                                            }
                                        </Typography>
                                        <Typography variant="subtitle2">
                                                {thisGovernance && thisGovernance?.account?.config?.maxVotingTime ?
                                                    <>
                                                        {thisitem.account?.votingAt &&
                                                            `${moment.unix(Number(thisitem.account?.votingAt)+thisGovernance?.account?.config?.maxVotingTime).format("MMMM Da, YYYY, h:mm a")}`
                                                        }
                                                    </>
                                                :
                                                    <>
                                                    {thisitem.account?.votingCompletedAt ?
                                                        `${moment.unix(thisitem.account?.votingCompletedAt).format("MMMM Da, YYYY, h:mm a")}`
                                                    :
                                                        `Ended`
                                                    }
                                                    </>
                                                }
                                        </Typography>
                                    </Box>
                                </Grid>

                                {thisitem?.account?.options &&
                                    <Grid item xs={12} sm={6} md={3} key={1}>
                                        <Box
                                            className='grape-store-stat-item'
                                            sx={{borderRadius:'24px',m:2,p:1}}
                                        >
                                            <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                <>Time Left</>
                                            </Typography>
                                            <Typography variant="subtitle2">
                                                {thisGovernance && thisGovernance?.account?.config?.maxVotingTime ?
                                                    <>
                                                        {thisitem.account?.votingAt &&
                                                            <>
                                                                {thisitem.account?.votingCompletedAt ?
                                                                    `Ended ${moment.unix(Number(thisitem.account?.votingAt)+thisGovernance?.account?.config?.maxVotingTime).fromNow()}`
                                                                :
                                                                    `Ending ${moment.unix(Number(thisitem.account?.votingAt)+thisGovernance?.account?.config?.maxVotingTime).fromNow()}`
                                                                }
                                                            </>
                                                        }
                                                    </>
                                                :
                                                    `Ended`
                                                }
                        
                                            </Typography>
                                        </Box>
                                    </Grid>
                                }

                                {thisitem.account?.state &&
                                    <Grid item xs={12} sm={6} md={3} key={1}>
                                        <Box
                                            className='grape-store-stat-item'
                                            sx={{borderRadius:'24px',m:2,p:1}}
                                        >
                                            <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                <>Status</>
                                            </Typography>
                                            <Typography variant="subtitle2">
                                                <Button color='inherit' sx={{color:'white',borderRadius:'17px'}} href={`https://realms.today/dao/${governanceAddress}/proposal/${thisitem?.pubkey}`} target='_blank'>
                                                    {GOVERNANNCE_STATE[thisitem.account?.state]} <OpenInNewIcon sx={{ml:1}} fontSize='small'/>
                                                </Button>
                                            </Typography>
                                        </Box>
                                    </Grid> 
                                }
                                
                            </Grid>

                        </Box>
                    }

                    {solanaVotingResultRows ?
                        <div style={{ height: 600, width: '100%' }}>
                            <div style={{ display: 'flex', height: '100%' }}>
                                <div style={{ flexGrow: 1 }}>
                                    
                                        <DataGrid
                                            rows={solanaVotingResultRows}
                                            columns={votingresultcolumns}
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
                    
                </DialogContent> 
            </BootstrapDialog>
            }
        </>
    )
}

function RenderGovernanceTable(props:any) {
    const endTimer = props.endTimer;
    const realm = props.realm;
    const memberMap = props.memberMap;
    const thisToken = props.thisToken;
    const tokenMap = props.tokenMap;
    const governanceAddress = props.governanceAddress;
    const governanceType = props.governanceType;
    const governanceLookup = props.governanceLookup;
    const cachedGovernance = props.cachedGovernance;
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const governanceToken = props.governanceToken;
    const proposals = props.proposals;
    const nftBasedGovernance = props.nftBasedGovernance;
    const token = props.token;
    const connection = new Connection(GRAPE_RPC_ENDPOINT);
    const { publicKey } = useWallet();
    const [propTokenDecimals, setPropTokenDecimals] = React.useState(token?.decimals || 6);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - proposals.length) : 0;

    const handleChangePage = (event:any, newPage:number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event:any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    function GetProposalStatus(props: any){
        const thisitem = props.item;
        const [thisGovernance, setThisGovernance] = React.useState(props.cachedGovernnace);

        React.useEffect(() => { 
            if (thisitem.account?.state === 2){ // if voting state
                if (!thisGovernance){
                    //console.log("get gov props")
                    //getGovernanceProps()
                }
            }
        }, [thisitem, !thisGovernance]);

        // calculate time left
        // /60/60/24 to get days
        
        return (
            <>
                <TableCell  align="center">
                    <Typography variant="h6">
                        <Tooltip title={
                            <>
                                <>
                                {thisGovernance?.governance?.account?.config?.maxVotingTime ?
                                    `Ending ${moment.unix(Number(thisitem.account?.votingAt)+(Number(thisGovernance?.governance?.account?.config?.maxVotingTime))).fromNow()}`
                                :
                                    <>
                                    {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                        <>{`Started: ${thisitem.account?.votingAt && (moment.unix(Number((thisitem.account?.votingAt))).format("MMMM Da, YYYY, h:mm a"))}`}<br/>{`Ended: ${thisitem.account?.votingAt && (moment.unix(Number((thisitem.account?.votingCompletedAt))).format("MMMM Da, YYYY, h:mm a"))}`}</>
                                    :
                                        `Created: ${thisitem.account?.votingAt && (moment.unix(Number((thisitem.account?.votingAt))).format("MMMM D, YYYY, h:mm a"))}`
                                    }
                                    </>
                                } 
                                </>
                            </>
                            }>
                            
                            <Button sx={{borderRadius:'17px',color:'inherit',textTransform:'none'}}>
                                {GOVERNANNCE_STATE[thisitem.account?.state]}
                                    <>
                                    {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                        <>
                                            { (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                                <CheckCircleOutlineIcon sx={{ fontSize:"small", color:"green",ml:1}} />
                                            :
                                                <CancelOutlinedIcon sx={{ fontSize:"small", color:"red",ml:1}} />
                                            }
                                        </>
                                    :
                                        <>
                                        { thisitem.account?.state === 2 ?
                                            <TimerIcon sx={{ fontSize:"small",ml:1}} />
                                        
                                        : 
                                            <CancelOutlinedIcon sx={{ fontSize:"small", color:"red",ml:1}} />
                                        }
                                        </>
                                    }
                                    </>
                            </Button>
                        </Tooltip>
                    </Typography>
                </TableCell>
            </>
        )
    }

    React.useEffect(() => { 
        endTimer();
    }, []);

    if (loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} color="inherit" />
            </Box>
            
        )
    }

    
        return (
            
            <TableContainer component={Paper} sx={{background:'none'}}>
                <Table sx={{ minWidth: 650 }}>
                    <StyledTable sx={{ minWidth: 500 }} size="small" aria-label="Portfolio Table">
                        <TableHead>
                            <TableRow>
                                <TableCell><Typography variant="caption">Name</Typography></TableCell>
                                <TableCell align="center" sx={{width:"12.5%"}}><Typography variant="caption">Proposed</Typography></TableCell>
                                <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">Yes</Typography></TableCell>
                                <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">No</Typography></TableCell>
                                <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">Status</Typography></TableCell>
                                <TableCell align="center"><Typography variant="caption">Details</Typography></TableCell>
                                
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/*proposals && (proposals).map((item: any, index:number) => (*/}
                            {proposals && 
                            <>  
                                {(rowsPerPage > 0
                                    ? proposals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    : proposals
                                ).map((item:any, index:number) => (
                                <>
                                    {/*console.log("item: "+JSON.stringify(item))*/}
                                    {item?.pubkey && item?.account &&
                                        <>
                                            <TableRow key={index} sx={{borderBottom:"none"}}>
                                                <TableCell>
                                                    <Typography variant="h6" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                        {item.account?.descriptionLink ?
                                                            <Tooltip title={
                                                                <Typography variant="body2">
                                                                    {item.account?.descriptionLink}
                                                                </Typography>}>
                                                                <Button sx={{ml:-1,borderRadius:'17px',textAlign:'left',textTransform:'none'}} color='inherit' >
                                                                    <Typography variant="h6">
                                                                    {item.account?.name} <InfoIcon sx={{ml:1, fontSize:16 }}/>
                                                                    </Typography></Button>
                                                            </Tooltip>
                                                        :
                                                            <>
                                                            {item.account?.name}
                                                            </>
                                                        }

                                                        {realm.account.config?.councilMint?.toBase58() === item.account?.governingTokenMint?.toBase58() ?
                                                            <Tooltip title='Council Vote'><Button color='inherit' sx={{ml:1,borderRadius:'17px'}}><AssuredWorkloadIcon sx={{ fontSize:16 }} /></Button></Tooltip>
                                                            :
                                                            <>
                                                            {tokenMap.get(item.account.governingTokenMint.toBase58()) ?
                                                                <></>
                                                            :
                                                                <>
                                                                    {governanceType === 1 ?
                                                                        <></>
                                                                    :
                                                                    <Tooltip title='NFT Vote'><Button color='inherit' sx={{ml:1,borderRadius:'17px'}}><ImageOutlinedIcon sx={{ fontSize:16 }} /></Button></Tooltip>
                                                                    }
                                                                </>
                                                            }
                                                            </>
                                                        }
                                                        
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                        {`${item.account?.votingAt ? (moment.unix(Number((item.account?.votingAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                    </Typography>

                                                </TableCell>
                                                <TableCell>
                                                    {item.account.yesVotesCount &&
                                                        <Typography variant="h6">
                                                            
                                                            <Tooltip title={realm.account.config?.councilMint?.toBase58() === item.account?.governingTokenMint?.toBase58() ?
                                                                    <>{Number(item.account.yesVotesCount)}</>
                                                                :
                                                                <>
                                                                        <>
                                                                        {(Number(item.account.yesVotesCount)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) )).toFixed(0)}</>
                                                                    

                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'#eee'}}>
                                                                    {Number(item.account.yesVotesCount) > 0 ?
                                                                    <>
                                                                    {`${(((Number(item.account.yesVotesCount))/((Number(item.account.noVotesCount))+(Number(item.account.yesVotesCount))))*100).toFixed(2)}%`}
                                                                    </>
                                                                    :
                                                                    <>0%</>
        }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }

                                                    {item.account?.options && item.account?.options[0]?.voteWeight && 
                                                        <Typography variant="h6">
                                                            
                                                            {/*console.log("governingTokenMint: "+item.account.governingTokenMint.toBase58())*/}
                                                            {/*console.log("vote: "+JSON.stringify(item.account))*/}
                                                            
                                                            <Tooltip title={realm.account.config?.councilMint?.toBase58() === item.account?.governingTokenMint?.toBase58() ?
                                                                    <>{Number(item.account?.options[0].voteWeight)}</>
                                                                :
                                                                <>
                                                                        <>
                                                                        {(Number(item.account?.options[0].voteWeight)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) )).toFixed(0)}</>
                                                                    

                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'white'}}>
                                                                    {Number(item.account?.options[0].voteWeight) > 0 ?
                                                                    <>
                                                                    {`${(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                    </>
                                                                    :
                                                                    <>0%</>
        }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }
                                                    {item.account?.options && item.account?.options[0]?.voterWeight && 
                                                        <Typography variant="h6">
                                                            {/*console.log("vote: "+JSON.stringify(item.account))*/}
                                                            <Tooltip title={tokenMap.get(item.account.governingTokenMint.toBase58()) ?
                                                                <>
                                                                {(Number(item.account?.options[0].voterWeight)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) )).toFixed(0)}
                                                                </>
                                                                :
                                                                <>
                                                                    {Number(item.account?.options[0].voterWeight)}
                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'white'}}>
                                                                    {Number(item.account?.options[0].voterWeight) > 0 ?
                                                                    <>
                                                                    {`${(((Number(item.account?.options[0].voterWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voterWeight))))*100).toFixed(2)}%`}
                                                                    </>
                                                                    :
                                                                    <>0%</>
        }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }
                                                </TableCell>
                                                <TableCell>

                                                    {item.account.noVotesCount &&
                                                            <Typography variant="h6">
                                                                
                                                                <Tooltip title={realm.account.config?.councilMint?.toBase58() === item.account?.governingTokenMint?.toBase58() ?
                                                                        <>{Number(item.account.noVotesCount)}</>
                                                                    :
                                                                    <>
                                                                            <>
                                                                            {(Number(item.account.noVotesCount)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) )).toFixed(0)}</>
                                                                        

                                                                    </>
                                                                    }
                                                                >
                                                                    <Button sx={{color:'#eee'}}>
                                                                        {Number(item.account.noVotesCount) > 0 ?
                                                                        <>
                                                                        {`${(((Number(item.account.noVotesCount))/((Number(item.account.noVotesCount))+(Number(item.account.yesVotesCount))))*100).toFixed(2)}%`}
                                                                        </>
                                                                        :
                                                                        <>0%</>
            }
                                                                    </Button>
                                                                </Tooltip>
                                                            </Typography>
                                                    }

                                                    
                                                    {item.account?.denyVoteWeight && 
                                                        <Typography variant="h6">
                                                            <Tooltip title={Number(item.account?.denyVoteWeight) <= 1 ?
                                                                <>
                                                                    {Number(item.account?.denyVoteWeight)}
                                                                </>
                                                                :
                                                                <>
                                                                    {(Number(item.account?.denyVoteWeight)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) )).toFixed(0)}
                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'white'}}>
                                                                    {Number(item.account?.denyVoteWeight) > 0 ?
                                                                    <>
                                                                    {`${(((Number(item.account?.denyVoteWeight)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) ))/((Number(item.account?.denyVoteWeight)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) ))+(Number(item.account?.options[0].voteWeight)/Math.pow(10, (tokenMap.get(item.account.governingTokenMint?.toBase58()) ? tokenMap.get(item.account.governingTokenMint?.toBase58()).decimals : 6) ))))*100).toFixed(2)}%`}
                                                                    </>:
                                                                    <>0%</>
                                                                    }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }
                                                </TableCell>
                                                <GetProposalStatus item={item} cachedGovernance={cachedGovernance} />
                                                <TableCell align="center">
                                                    <GetParticipants governanceLookup={governanceLookup} governanceAddress={governanceAddress} cachedGovernance={cachedGovernance} item={item} realm={realm} tokenMap={tokenMap} memberMap={memberMap} governanceToken={governanceToken} />
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    }
                                </>

                            ))}
                            {/*emptyRows > 0 && (
                                <TableRow style={{ height: 53 * emptyRows }}>
                                    <TableCell colSpan={5} />
                                </TableRow>
                            )*/}
                            </>
                            }
                        </TableBody>
                        
                        <TableFooter>
                            <TableRow>
                                <TablePagination
                                rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                                colSpan={5}
                                count={proposals && proposals.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                SelectProps={{
                                    inputProps: {
                                    'aria-label': 'rows per page',
                                    },
                                    native: true,
                                }}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                ActionsComponent={TablePaginationActions}
                                />
                            </TableRow>
                        </TableFooter>
                        
                        
                    </StyledTable>
                </Table>
            </TableContainer>
        )
}

export function GovernanceCachedView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const governanceAddress = urlParams;
    const [cachedRealm, setCachedRealm] = React.useState(null);
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
                //const grealm = await getRealm(new Connection(GRAPE_RPC_ENDPOINT), new PublicKey(governanceAddress))
                let grealm = null;
                if (cachedRealm){
                    console.log("Realm from cache")
                    setRealm(cachedRealm);
                    grealm = cachedRealm;
                } else{
                    grealm = await getRealm(new Connection(GRAPE_RPC_ENDPOINT), new PublicKey(governanceAddress))
                    setRealm(grealm);
                }
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
                    
                    console.log("Fetching via cache...")
                    
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

                    //const rawTokenOwnerRecords = await getAllTokenOwnerRecords(new Connection(GRAPE_RPC_ENDPOINT), grealm.owner, realmPk)
                    //setMemberMap(rawTokenOwnerRecords);

                    //const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);

                    //const gpbgprops = await getProposalsByGovernance(new Connection(THEINDEX_RPC_ENDPOINT), programId, new PublicKey(collectionAuthority.governancePublicKey || collectionAuthority.governance));
                    //console.log("gpbgprops: "+JSON.stringify(gpbgprops));
                    
                    
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
        setCachedRealm(null);
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){
                    if (glitem?.realm)
                        setCachedRealm(glitem?.realm)
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
                    inner.quorumWeight.voterWeight = Number("0x"+inner.quorumWeight.voterWeight).toString()
                    inner.vote.voterWeight = Number("0x"+inner.vote.voterWeight).toString()

                    inner.quorumWeight.legacyYes = Number("0x"+inner.quorumWeight.legacyYes).toString()
                    inner.vote.legacyYes = Number("0x"+inner.vote.legacyYes).toString()
                    inner.quorumWeight.legacyNo = Number("0x"+inner.quorumWeight.legacyNo).toString()
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
    
    //if (publicKey){
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
                    
                    <LinearProgress color="inherit" />
                    
                </Box>
            )
        } else{
            if (proposals && tokenMap){
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
                                        {publicKey &&
                                            <Typography variant="h4" align="right">
                                                <VotingPower tokenArray={tokenArray} participatingRealm={participatingRealm} />
                                            </Typography>
                                        }
                                    </Grid>
                                </Grid>
                                {/*
                                <Typography variant="caption">
                                    <Tooltip title={
                                        <>
                                            Council Mint: {realm.account.config.councilMint.toBase58()}<br/>
                                            Community Mint Max Vote Weight: {realm.account.config.communityMintMaxVoteWeightSource.value.toNumber()/1000000}<br/>
                                            <>Min Community Tokens to Create Governance: {realm.account.config.minCommunityTokensToCreateGovernance.toNumber()/1000000}</>
                                        </>
                                    }>
                                        <Button>
                                        {realm.pubkey.toBase58()}
                                        </Button>
                                    </Tooltip>
                                </Typography>
                                */}
                            </>
                        }

                                <Box sx={{ alignItems: 'center', textAlign: 'center',p:1}}>
                                    <Grid container spacing={0}>
                                        <Grid item xs={12} sm={4} md={4} key={1}>
                                            <Box
                                                className='grape-store-stat-item'
                                                sx={{borderRadius:'24px',m:2,p:1}}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Proposals/Success Rate</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            Total proposals created in this governance<br/>Success rate is calculated on successfully completed proposals
                                                        </>
                                                    }>
                                                    <Button
                                                        color='inherit'
                                                        sx={{
                                                            borderRadius:'17px'
                                                        }}
                                                    >
                                                        <Typography variant="h3">
                                                            {totalProposals}/{((totalPassed/totalProposals)*100).toFixed(1)}%
                                                        </Typography>
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        <Grid item xs={12} sm={4} md={4} key={1}>
                                            <Box
                                                className='grape-store-stat-item'
                                                sx={{borderRadius:'24px',m:2,p:1}}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Total Casted Votes</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            Total votes casted for this governnace
                                                        </>
                                                    }>
                                                    <Button
                                                        color='inherit'
                                                        sx={{
                                                            borderRadius:'17px'
                                                        }}
                                                    >
                                                        <Typography variant="h3">
                                                            {getFormattedNumberToLocale(totalVotesCasted)}
                                                        </Typography>
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        
                                        <Grid item xs={12} sm={4} md={4} key={1}>
                                            <Box
                                                className='grape-store-stat-item'
                                                sx={{borderRadius:'24px',m:2,p:1}}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Passing/Defeated</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            Total proposals passed / Total proposals defeated
                                                        </>
                                                    }>
                                                    <Button
                                                        color='inherit'
                                                        sx={{
                                                            borderRadius:'17px'
                                                        }}
                                                    >
                                                        <Typography variant="h3">
                                                            <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{totalPassed}</Badge>/
                                                            <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{totalDefeated}</Badge>
                                                        </Typography>
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        
                                    </Grid>
                                </Box>
                                  
                                
                        <RenderGovernanceTable 
                            governanceLookup={governanceLookup} 
                            endTimer={endTimer} 
                            cachedGovernance={cachedGovernance} 
                            memberMap={memberMap} 
                            governanceType={governanceType} 
                            governingTokenDecimals={governingTokenDecimals} 
                            governingTokenMint={governingTokenMint} 
                            tokenMap={tokenMap} 
                            realm={realm} 
                            thisToken={thisToken} 
                            proposals={proposals} 
                            nftBasedGovernance={nftBasedGovernance} 
                            governanceAddress={governanceAddress} />
                        
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
    /*
    } else{
        // check if participant in this governance?
        return (
            <Box
                sx={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    p:4
                }} 
            > 
                    <WalletDialogProvider className="grape-wallet-provider">
                        <WalletMultiButton className="grape-wallet-button">
                            Connect your wallet
                        </WalletMultiButton>
                    </WalletDialogProvider> 
            </Box>
        )
    }*/
}