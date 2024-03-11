import { 
    getRealm, 
    getProposal,
    getAllProposals, 
    getGovernance, 
    getGovernanceAccounts, 
    getGovernanceChatMessages, 
    getTokenOwnerRecord, 
    getTokenOwnerRecordsByOwner, 
    getAllTokenOwnerRecords,
    getMaxVoterWeightRecord,
    getRealmConfigAddress, 
    getGovernanceAccount, 
    getAccountTypes, 
    ProposalTransaction,
    pubkeyFilter,
    GovernanceAccountType, 
    tryGetRealmConfig, 
    getRealmConfig,
    InstructionData  } from '@solana/spl-governance';
import { 
        getRealmIndexed,
        getProposalIndexed,
        getProposalNewIndexed,
        getAllProposalsIndexed,
        getGovernanceIndexed,
        getAllGovernancesIndexed,
        getAllTokenOwnerRecordsIndexed,
        getProposalInstructionsIndexed,
} from './api/queries';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import axios from "axios";
import BN from 'bn.js'
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { getMint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token-v2";
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { InstructionMapping } from "../utils/grapeTools/InstructionMapping";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernancePower from './GovernancePower';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Link, useParams, useSearchParams } from "react-router-dom";

import { decodeMetadata } from '../utils/grapeTools/utils';
import grapeTheme from  '../utils/config/theme';

import {
  Typography,
  Button,
  Grid,
  Box,
  Table,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
  ButtonGroup,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Collapse,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemAvatar,
  ListItemText,
  Avatar,
  TextField,
  TextareaAutosize
} from '@mui/material/';

import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineOppositeContent,
    TimelineDot,
} from '@mui/lab'

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';
 
import { IntegratedGovernanceProposalDialogView } from './IntegratedGovernanceProposal';
import { getAllProposalSignatoryRecords, getAllProposalSignatories, ManageGovernanceProposal } from './ManageGovernanceProposal';
import { VoteForProposal } from './GovernanceVote';
import { InstructionView } from './GovernanceInstructionView';
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import ArticleIcon from '@mui/icons-material/Article';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import SegmentIcon from '@mui/icons-material/Segment';
import BallotIcon from '@mui/icons-material/Ballot';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CircleIcon from '@mui/icons-material/Circle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CodeIcon from '@mui/icons-material/Code';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckIcon from '@mui/icons-material/Check';
import GitHubIcon from '@mui/icons-material/GitHub';
import DownloadIcon from '@mui/icons-material/Download';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { 
    PROXY, 
    RPC_CONNECTION, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI,
    SHYFT_KEY } from '../utils/grapeTools/constants';
import { 
    formatAmount, 
    getFormattedNumberToLocale,
    VSR_PLUGIN_PKS } from '../utils/grapeTools/helpers'

//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

function trimAddress(addr: string) {
    if (!addr) return addr;
    const start = addr.substring(0, 8);
    const end = addr.substring(addr.length - 4);
    return `${start}...${end}`;
}

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

const GOVERNANCE_STATE = {
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
}

export function GovernanceProposalV2View(props: any){
    const [searchParams, setSearchParams] = useSearchParams();
    const {governance} = useParams<{ governance: string }>();
    const {proposal} = useParams<{ proposal: string }>();
    const showGovernanceTitle = props.showGovernanceTitle !== undefined ? props.showGovernanceTitle : true;
    const background = null; //props?.background ? props.background : null;
    const textColor = null; //props?.textColor ? props.background : null;
    const showGovernanceNavigation = props.showGovernanceNavigation !== undefined ? props.showGovernanceNavigation : true;
    
    const governanceAddress = searchParams.get("governance") || governance || props?.governanceAddress;
    const [thisitem, setThisitem] = React.useState(props?.item);
    const [proposalSignatories, setProposalSignatories] = React.useState(null);
    const proposalPk = props?.governanceProposal || thisitem?.pubkey || proposal || searchParams.get("proposal");
    //const [governanceAddress, setGovernanceAddress] = React.useState(props?.governanceAddress);
    const connection = RPC_CONNECTION;
    const [cachedGovernance, setCachedGovernance] = React.useState(props?.cachedGovernance || null);
    const [governanceLookup, setGovernanceLookup] = React.useState(props?.governanceLookup || null);
    const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
    const [memberMap, setMemberMap] = React.useState(props?.memberMap);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(props?.memberMap);
    const [realmName, setRealmName] = React.useState(null);
    //const thisitem = props?.item;
    //const governanceToken = props.governanceToken;
    //const [thisitem, setThisItem] = React.useState(props.item);
    const [realm, setRealm] = React.useState(props?.realm);
    
    const [loadingValidation, setLoadingValidation] = React.useState(false);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
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
    const [gDocs, setGoogleDocs] = React.useState(null);
    const [gitBook, setGitBook] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [thisGovernance, setThisGovernance] = React.useState(null);
    const [proposalAuthor, setProposalAuthor] = React.useState(null);
    const [governingMintInfo, setGoverningMintInfo] = React.useState(null);
    const [totalQuorum, setTotalQuorum] = React.useState(null);
    const [votingDecimals, setVotingDecimals] = React.useState(0);
    const [totalVoteThresholdPercentage, setTotalVoteThresholdPercentage] = React.useState(null);
    const [totalSupplyFractionPercentage, setTotalSupplyFractionPercentage] = React.useState(null);
    const [quorumTargetPercentage, setQuorumTargetPercentage] = React.useState(null);
    const [quorumTarget, setQuorumTarget] = React.useState(null);
    const [totalSupply, setTotalSupply] = React.useState(null);
    const [proposalInstructions, setProposalInstructions] = React.useState(null);
    const [instructionOwnerRecord, setInstructionOwnerRecord] = React.useState(null);
    const [instructionOwnerRecordATA, setInstructionOwnerRecordATA] = React.useState(null);
    const [exceededQuorum, setExceededQuorum] = React.useState(null);
    const [exceededQuorumPercentage, setExceededQuorumPercentage] = React.useState(null);
    const [selectedDelegate, setSelectedDelegate] = React.useState("");
    const { publicKey, wallet, sendTransaction } = useWallet();
    const [loadingParticipants, setLoadingParticipants] = React.useState(false);
    const [forVotes, setForVotes] = React.useState(0);
    const [againstVotes, setAgainstVotes] = React.useState(0);
    const [multiVoteSentiment, setMultiVoteSentiment] = React.useState(null);
    const [hasVoted, setHasVoted] = React.useState(false);
    const [hasVotedVotes, setHasVotedVotes] = React.useState(null);
    const [cachedTokenMeta, setCachedTokenMeta] = React.useState([{mint: "A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK", logo: "https://arweave.net/4-3-xg9otuhR3BZ72MVk6-QB0tqBZAniXfsvAawEdHI", name: "VINE"}]);
    //const cachedTokenMeta = new Array();
    const [castedYesVotes, setCastedYesVotes] = React.useState(null);
    const [excessVotes, setExcessVotes] = React.useState(null);
    const [openInstructions, setOpenInstructions] = React.useState(false);
    const [expandInfo, setExpandInfo] = React.useState(false);
    const [reload, setReload] = React.useState(false);
    
    const toggleInfoExpand = () => {
        setExpandInfo(!expandInfo)
    };
    

    const handleClickOpenInstructions = () => {
        setOpenInstructions(!openInstructions);
    }

    const handleCopyClick = () => {
        enqueueSnackbar(`Copied!`,{ variant: 'success' });
    };

    const votingresultcolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true},
        { field: 'pubkey', headerName: 'PublicKey', minWidth: 170, hide: true,
            renderCell: (params) => {
                return(params.value)
            }
        },
        { field: 'proposal', headerName: 'Proposal', width: 170, hide: true, sortable: false,
            renderCell: (params) => {
                return(params.value)
            }
        },
        { field: 'governingTokenOwner', headerName: 'Token Owner', minWidth: 170, flex: 1,
            renderCell: (params) => {
                return(
                    <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={params.value} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
        },
        { field: 'voteAddress', headerName: 'Address', minWidth: 150, sortable: false,
            renderCell: (params) => {
                return(
                    <ExplorerView address={params.value} type='address' shorten={4} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
        },
        { field: 'quorumWeight', headerName: 'Quorum Weight', headerAlign: 'center', width: 250, align: 'right', hide: totalQuorum ? false : true, sortable : false,
            renderCell: (params) => {
                return(
                    <>
                        {totalQuorum && totalQuorum > 1 ?
                            <>
                                {params.value.voterWeight ?
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
                            :
                            <>
                                -
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
                                    <>
                                    {getFormattedNumberToLocale(formatAmount(+(Number(params.value.voterWeight)/Math.pow(10, +params.value.decimals)).toFixed(0)))} votes
                                    {params.value?.multipleChoice ?
                                        <> <BallotIcon fontSize='small' sx={{ml:1,verticalAlign:'middle'}} />: 
                                            {params.value?.multipleChoice.map((item: any, index:number) => (
                                                <>
                                                    {item.weightPercentage > 0 ?
                                                        <> {index+1} </>
                                                    :<></>
                                                    }
                                                </>
                                            ))
                                            }
                                        </>
                                        :
                                        <></>
                                    }
                                    </>
                                    :
                                    <>{getFormattedNumberToLocale(formatAmount(+(Number(params.value.voterWeight)/Math.pow(10, +params.value.decimals)).toFixed(0)))} vote</>
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
                                            `${getFormattedNumberToLocale(formatAmount(+(Number(params.value?.legacyYes)/Math.pow(10, params.value.decimals)).toFixed(0)))} votes` 
                                        :
                                            `${getFormattedNumberToLocale(formatAmount(+(Number(params.value?.legacyYes)/Math.pow(10, params.value.decimals)).toFixed(0)))} vote` 
                                        }
                                        </>
                                    :
                                        <>

                                        {params.value?.legacyNo > 1 ?
                                            `${getFormattedNumberToLocale(formatAmount(+(Number(params.value?.legacyNo)/Math.pow(10, params.value.decimals)).toFixed(0)))} votes` 
                                        :
                                            `${getFormattedNumberToLocale(formatAmount(+(Number(params.value?.legacyNo)/Math.pow(10, params.value.decimals)).toFixed(0)))} vote` 
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

        //if (!governance){ // temporary until we cache all governances for a single realm
            governance = await getGovernanceIndexed(governanceAddress, thisitem?.owner, new PublicKey(thisitem.account.governance).toBase58());   
            //console.log("results: "+JSON.stringify(governance)); 
            
            //governance = await getGovernance(connection, thisitem.account.governance);   
            //console.log("results: "+JSON.stringify(governance)); 
            //const governance_i = await getAllGovernancesIndexed(governanceAddress);
            //console.log("ri: "+JSON.stringify(governance_i));

        //}
        
        //console.log(" governance:" +JSON.stringify(governance));

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
            //if (governance_item?.governingMintDetails){ // save even more RPC calls
            //    governingMintDetails = governance_item.governingMintDetails;
            //}else{
                governingMintDetails = await connection.getParsedAccountInfo(
                    new PublicKey(thisitem.account.governingTokenMint)
                );
            //}
            
            //console.log("communityMintPromise ("+thisitem.account.governingTokenMint+") "+JSON.stringify(governingMintPromise))
            setGoverningMintInfo(governingMintDetails);
            
            const communityWeight = governingMintDetails.value.data.parsed.info.supply - Number(realm.account.config.minCommunityTokensToCreateGovernance);
            //console.log("communityWeight: "+communityWeight);
            
            const communityMintMaxVoteWeightSource = realm.account.config?.communityMintMaxVoteWeightSource
            let supplyFractionPercentage = null;
            if (communityMintMaxVoteWeightSource?.fmtSupplyFractionPercentage)
                supplyFractionPercentage = +communityMintMaxVoteWeightSource?.fmtSupplyFractionPercentage();
            else 
                supplyFractionPercentage = governance_item?.communityFmtSupplyFractionPercentage

            // check if we have this cached
            //console.log("supplyFractionPercentage: "+JSON.stringify(supplyFractionPercentage))
            if (supplyFractionPercentage){
                const communityVoteThreshold = governance.account.config.communityVoteThreshold
                const councilVoteThreshold = governance.account.config.councilVoteThreshold
                
                const voteThresholdPercentage=
                    new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(thisitem.account.governingTokenMint).toBase58()
                    ? councilVoteThreshold.value
                    : communityVoteThreshold.value
                
                const tSupply = Number(governingMintDetails.value.data.parsed.info.supply/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals)) 
                
                //console.log("tSupply: "+tSupply)
                //console.log("voteThresholdPercentage: "+voteThresholdPercentage)
                //console.log("supplyFractionPercentage: "+supplyFractionPercentage)

                setTotalSupply(tSupply);
                
                let totalVotes = new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(thisitem.account.governingTokenMint).toBase58() ?
                    tSupply  *
                    (voteThresholdPercentage / 100)
                    :
                    tSupply  *
                    (voteThresholdPercentage / 100) *
                    (Number(supplyFractionPercentage) / 100);
                
                setTotalVoteThresholdPercentage(voteThresholdPercentage);
                setTotalSupplyFractionPercentage(Number(supplyFractionPercentage));
                //console.log("tSupply "+tSupply+"*"+voteThresholdPercentage+"*0.01*"+ (Number(supplyFractionPercentage) / 100))

                //console.log("totalQuorum: "+totalVotes)
                //console.log("decimals: "+governingMintDetails.value.data.parsed.info.decimals);
                //console.log("supply: "+governingMintDetails.value.data.parsed.info.supply);
                //console.log("voteThresholdPercentage: "+(voteThresholdPercentage * 0.01))
                //console.log("supplyFractionPercentage: "+(Number(supplyFractionPercentage) / 100))
                
                //console.log("Quorum: "+totalVotes);
                //console.log("tSupply: "+tSupply);
                //console.log("voteThresholdPercentage: "+voteThresholdPercentage/100);
                //console.log("supplyFractionPercentage: "+(Number(supplyFractionPercentage) / 100));
                //console.log("quorum Council: "+(tSupply  * (voteThresholdPercentage / 100)))
                //console.log("quorum Community: "+(tSupply  * (voteThresholdPercentage / 100) * (Number(supplyFractionPercentage) / 100)))
                
                if (totalVotes && totalVotes > 0)
                    setTotalQuorum(totalVotes);
                
                const qt = totalVotes-Number(thisitem.account.options[0].voteWeight)/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals);
                
                setVotingDecimals(governingMintDetails?.value?.data.parsed?.info?.decimals || 0);

                // we may need to adjust this for realtime quorum calculating
                const yesVotes = Number(thisitem.account.options[0].voteWeight)/Math.pow(10, governingMintDetails.value.data.parsed.info.decimals);
                
                const excess = yesVotes - totalVotes;
                
                setCastedYesVotes(yesVotes);
                setExcessVotes(excess);

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

                return totalVotes
            }
            
        }catch(e){
            console.log('ERR: '+e)
        }
    }

    const [expanded, setExpanded] = React.useState<string | false>(false);
    const handleChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const [instructionTransferDetails, setInstructionTransferDetails] = React.useState([]);
    
    // Custom function to read a big UInt64LE
    function readBigUInt64LE(buffer:any) {
        return BigInt(buffer[0]) +
        (BigInt(buffer[1]) << BigInt(8)) +
        (BigInt(buffer[2]) << BigInt(16)) +
        (BigInt(buffer[3]) << BigInt(24)) +
        (BigInt(buffer[4]) << BigInt(32)) +
        (BigInt(buffer[5]) << BigInt(40)) +
        (BigInt(buffer[6]) << BigInt(48)) +
        (BigInt(buffer[7]) << BigInt(56));
    }

    const getVotingParticipants = async () => {
        setLoadingParticipants(true);

        let td = 0; // this is the default for NFT mints
        let vType = null;

        // this method is not correct, migrate to set decimals by an RPC:
        const tokenInfo = await getMint(RPC_CONNECTION, new PublicKey(thisitem.account.governingTokenMint));
        
        const decimals = tokenInfo?.decimals;
        td = decimals;
        vType = 'Token';
        if (!td){
            try{
                //console.log("checking token: "+new PublicKey(thisitem.account.governingTokenMint).toBase58());
                td = tokenMap.get(new PublicKey(thisitem.account.governingTokenMint).toBase58()).decimals;
                vType = 'Token';
                //console.log("tokenMap: "+td);
            }catch(e){
                const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                //console.log("found: "+JSON.stringify(token.value.data.parsed.info.decimals))

                td = await token.value.data.parsed.info.decimals;
                vType = 'Token';
                //console.log("ERR: "+e);
            }
            
            if (realm.account.config?.councilMint){
                if (new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(thisitem.account.governingTokenMint).toBase58()){
                    vType = 'Council';
                    //td = 0;
                }
            }
            
            if (!vType){
                // check if backed token
                // important check if we have already fetched this data already
                const btkn = await getBackedTokenMetadata(new PublicKey(thisitem.account.governingTokenMint).toBase58(), wallet);
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
        }
        setTokenDecimals(td);
        setVoteType(vType)
        
        if (vType){
            setPropVoteType(vType);

            //thisitem.account.tokenOwnerRecord;
            console.log("has memberMap: "+`${memberMap ? `true`:`false`}`)
            if (memberMap){
                for (const item of memberMap){
                    if (item && item.pubkey && item.pubkey.toBase58){
                        if (item.pubkey.toBase58() === new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()){
                            setProposalAuthor(item.account.governingTokenOwner.toBase58())
                            console.log("member:" + JSON.stringify(item));
                        }
                    } else{
                        if (item.pubkey === new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()){
                            setProposalAuthor(item.account.governingTokenOwner)
                            console.log("member:" + JSON.stringify(item));
                        }
                    }
                    
                }
            }
        }

        // get all signatories

        if (thisitem.account.state === 0 || thisitem.account.state === 1){
            if (thisitem.account.signatoriesCount > 1){
                // how many signed off? check signatoriesSignedOffCount
                console.log("test "+new PublicKey(thisitem.owner || realm.owner).toBase58());
                const allSignatoryRecords = await getAllProposalSignatoryRecords(new PublicKey(thisitem.owner || realm.owner), new PublicKey(thisitem.pubkey), new PublicKey(governanceAddress))
                console.log("allSignatoryRecords: "+JSON.stringify(allSignatoryRecords));
                setProposalSignatories(allSignatoryRecords)
            }
        }

        //if (thisitem.account?.state === 2){ // if voting state
            const thisQuorum = await getGovernanceProps()
        //}
        
        // CACHE
        // fetch voting results
        let voteRecord = null;
        let from_cache = false;
        
        let vresults = null;
        if (cachedGovernance){
            //console.log("cachedGovernance: "+JSON.stringify(cachedGovernance));
            for (var vitem of cachedGovernance){
                if (thisitem.pubkey.toBase58() === vitem.pubkey.toBase58()){
                    vresults = vitem;
                    //console.log("vitem: "+JSON.stringify(vitem));
                }
            }
        }

        //if (!vresults){
            //const gp = await getProposal(RPC_CONNECTION, thisitem.pubkey);
            const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddress, thisitem?.owner);
            const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
            const gp = await getProposalIndexed(governanceRulesStrArr, null, governanceAddress, proposalPk);
            //const gpiv2 = await getProposalNewIndexed(thisitem.pubkey);
            //console.log("gp: "+JSON.stringify(gp));
            //console.log("gpiv2: "+JSON.stringify(gpiv2));
            
            if (gp){
                vresults = JSON.parse(JSON.stringify(gp));
            }
        //}
        

        

        {
            if (vresults){
                
                voteRecord = vresults.votingResults;

                const signOff = Number(vresults.account.signingOffAt);
                let cachedFetch = null;
                let isFresh = false;
                for (let glitem of governanceLookup){
                    if (glitem.governanceAddress === governanceAddress){
                        cachedFetch = Number(glitem.lastTimestamp);
                        
                    }
                }
                
                //console.log("Voting Prop: "+JSON.stringify(vresults))
                //console.log("FRESH CHECK: "+(moment.unix(signOff).toLocaleString()) + " vs " + (moment.unix(Number(cachedFetch)).toLocaleString()))
                if (signOff > cachedFetch || vresults.account.state === 2){
                    console.log("RESULTS NOT CACHED YET");
                    isFresh = false;
                } else{
                    console.log("FRESH RESULTS")
                    isFresh = true;
                }

                if (!voteRecord &&
                    (Number("0x"+vresults?.account?.options[0]?.voteWeight) > 0 ||
                        Number("0x"+vresults?.account?.denyVoteWeight) > 0
                    )){
                        isFresh = false;
                    }


                // check if there are voters but no voter record!
                //console.log("vresults: "+JSON.stringify(vresults));
                
                if (!isFresh){ // voting state we can fetch via rpc
                    console.log("Fetching voting proposal current results via RPC")
                    from_cache = false;
                    const voteRecords = await getVoteRecords({
                        connection: connection,
                        programId: new PublicKey(thisitem.owner || realm.owner),
                        proposalPk: new PublicKey(thisitem.pubkey),
                    });
                    if (voteRecords?.value){
                        voteRecord = voteRecords.value;//JSON.parse(JSON.stringify(voteRecord));
                    }
                    
                } else{
                    console.log("Fetching proposal results via Cached Storage")
                    // check if our storage is fresh vs the ending time of the proposal
                    console.log("vresults "+JSON.stringify(vresults.account.signingOffAt))
                    
                    from_cache = true;
                    
                }
                
                // if this is voting we should fetch via RPC
                let instructions = null;
                
                if (!thisitem?.instructions || thisitem.account.state === 0){
                
                    //if (!thisitem?.instructions){
                        //instructions = await getProposalInstructionsIndexed(governanceAddress, new PublicKey(thisitem.pubkey).toBase58());
                        instructions = await getGovernanceAccounts(
                            connection,
                            new PublicKey(thisitem.owner || realm.owner),
                            ProposalTransaction,
                            [pubkeyFilter(1, new PublicKey(thisitem.pubkey))!]
                        );
                    
                        thisitem.instructions = instructions;
                    //}
                } else {
                    if (!thisitem?.instructions){
                        instructions = await getProposalInstructionsIndexed(governanceAddress, new PublicKey(thisitem.pubkey).toBase58());
                        /*
                        instructions = await getGovernanceAccounts(
                            connection,
                            new PublicKey(thisitem.owner || realm.owner),
                            ProposalTransaction,
                            [pubkeyFilter(1, new PublicKey(thisitem.pubkey))!]
                        );
                        */
                        thisitem.instructions = instructions;
                    }
                }
                
                //console.log("ix: "+JSON.stringify(thisitem.instructions))
                
                if (thisitem?.instructions){
                    let useInstructions = thisitem.instructions;
                    useInstructions.sort((a:any, b:any) => b?.account.instructionIndex < a?.account.instructionIndex ? 1 : -1); 
                    
                    setProposalInstructions(useInstructions);
                    
                    var ataArray = new Array();
                    if (useInstructions){
                        let cnt = 0;

                        const mintArr = new Array();
                        for (var instructionItem of useInstructions){
                            // use multiple accounts rather than a single account to get gai
                            // do a run through to get all mints and push to an array
                            for (let accountInstruction of instructionItem.account.instructions){
                                //console.log("pushing: "+new PublicKey(accountInstruction.accounts[0].pubkey).toBase58())
                                if (accountInstruction.accounts[0]?.pubkey)
                                    mintArr.push(new PublicKey(accountInstruction.accounts[0].pubkey))
                            }
                        }
                        
                        let mintResults = null;
                        if (mintArr && mintArr.length > 0){
                            const results = await RPC_CONNECTION.getMultipleParsedAccounts(mintArr);
                            mintResults = results.value;
                            //console.log("mintArrResults: "+JSON.stringify(mintResults));
                        }

                        for (var instructionItem of useInstructions){
                            
                            if (instructionItem.account?.instructions && instructionItem.account.instructions.length > 0){
                                for (var accountInstruction of instructionItem.account.instructions){
                                    for (var account of accountInstruction.accounts){
                                        var foundAta = false;
                                        if ((account?.pubkey)&&(!account.isSigner)){
                                            // check if exists
                                            for (var existing of ataArray){
                                                if (new PublicKey(existing).toBase58() === new PublicKey(account.pubkey).toBase58())
                                                    foundAta = true;
                                            }

                                            if (!foundAta){
                                                ataArray.push(new PublicKey(account.pubkey))
                                            }
                                        
                                        }
                                    }
                                }

                                for (var accountInstruction of instructionItem.account.instructions){
                                    //if (instructionItem?.account?.instructions[0].data && instructionItem.account.instructions[0].data.length > 0){
                                        const typeOfInstruction = accountInstruction.data[0];
                                        //console.log("instructionDetails "+JSON.stringify(instructionDetails))
                                        const programId = new PublicKey(instructionItem?.account?.instructions[0].programId).toBase58();
                                        const instructionInfo = InstructionMapping?.[programId]?.[typeOfInstruction];
                                        
                                        //console.log("typeOfInstruction "+JSON.stringify(typeOfInstruction))
                                        
                                        if (instructionInfo?.name === "Token Transfer"){

                                            // check if we have this in gai
                                            let gai = null;
                                            if (mintResults && mintResults.length > 0){
                                                gai = mintResults[cnt];
                                            } 

                                            if (!gai)
                                                gai = await connection.getParsedAccountInfo(new PublicKey(accountInstruction.accounts[0].pubkey))
                                            
                                            if (gai){
                                                // get token metadata
                                                
                                                const uri = `https://api.shyft.to/sol/v1/nft/read?network=mainnet-beta&token_record=true&refresh=false&token_address=${gai.data.parsed.info.mint}`;
                                                /*
                                                const meta = axios.get(uri, {
                                                    headers: {
                                                        'x-api-key': SHYFT_KEY
                                                    }
                                                    })
                                                    .then(response => {
                                                        if (response.data?.result){
                                                            return response.data.result;
                                                        }
                                                        //return null
                                                    })
                                                    .catch(error => 
                                                    {   
                                                        // revert to RPC
                                                        console.error(error);
                                                        //return null;
                                                    });
                                                */

                                                //setInstructionRecord(gai.value);
                                                let newObject = null;
                                                try{
                                                    const amountBN = new BN(accountInstruction?.data?.slice(1), 'le');
                                                    const decimals = gai?.data.parsed.info.tokenAmount?.decimals || 0;
                                                    const divisor = new BN(10).pow(new BN(decimals));

                                                    const amount = amountBN.div(divisor).toString(); 
                                                    //console.log("accountInstruction: "+JSON.stringify(accountInstruction));
                                                    newObject = {
                                                        type:"TokenTransfer",
                                                        pubkey: accountInstruction.accounts[0].pubkey,
                                                        mint: gai?.data.parsed.info.mint,
                                                        name: tokenMap.get(gai?.data.parsed.info.mint)?.symbol,
                                                        logoURI: tokenMap.get(gai?.data.parsed.info.mint)?.logoURI,
                                                        amount: amount,
                                                        data: accountInstruction.data,
                                                        destinationAta:accountInstruction.accounts[1].pubkey,
                                                    };

                                                    
                                                    //console.log("newObject "+JSON.stringify(newObject))
                                                    accountInstruction.info = newObject;
                                                } catch(e){
                                                    console.log("ERR: "+e);
                                                }
                                                accountInstruction.gai = gai;
                                                
                                                const hasInstruction = instructionTransferDetails.some(obj => obj.pubkey === instructionItem.account.instructions[0].accounts[0].pubkey);
                                                
                                                if (!hasInstruction){
                                                    //console.log("newObject: "+JSON.stringify(newObject))
                                                    setInstructionTransferDetails((prevArray) => [...prevArray, newObject]);
                                                }
                                                
                                            }
                                        } else if (programId === "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M"){
                                            
                                            console.log("DCA PROGRAM INSTRUCTION: "+JSON.stringify(instructionItem.account))
                                            
                                            if (accountInstruction?.data){

                                                //console.log("DCA string: "+JSON.stringify(instructionItem.account.instructions[0]));
                                                
                                                
                                                //console.log("DCA Base64: "+encodeURI(JSON.stringify(instructionItem.account.instructions[0]).toString("base64")))
                                                
                                                //console.log("programId")
                                                //const jsonData = require('./plugins/idl/'+instructionItem.account.instructions[0].programId+'.json');
                                                //const jsonData = require('./plugins/idl/JupiterDCA.json');
                                                ////const fileContent = await fs.readFileSync('./plugins/idl/JupiterDCA.json');
                                                let description = "";
                                                let u64BigInt, u64Number;
                                                let decodedIx;
                                                try {
                                                    /*
                                                    const filePath = './plugins/idl/'+instructionItem.account.instructions[0].programId+'.tsx';
                                                    const filePath2 = './plugins/idl/JupiterDCA.json';
                                                    
                                                    const data = import(filePath2);
                                                    const parsedData = JSON.parse(JSON.stringify(data));
                                                    //const parsedData = (data.idl);
                                                    //setJsonData(parsedData);
                                                    const borshCoder = new BorshCoder(parsedData);
                                                    */
                                                    
                                                    //const fileContent = await fs.readFile('./plugins/idl/JupiterDCA.json', options:{encoding:'utf-8'});
                                                    const jsonData = await require('./plugins/idl/DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M.json');
                                                    //const jsonData = require('./plugins/idl/'+instructionItem.account.instructions[0].programId+'.json');
                                                    //const fileContent = await fs.readFileSync('./plugins/idl/JupiterDCA.json');
                                                    
                                                    const borshCoder = new BorshCoder(JSON.parse(JSON.stringify(jsonData)));
                                                    // `4` is the index of the instruction which interacts with Candy Machine V2 
                                                    const instruction = instructionItem.account.instructions[0];
                                                    const hexString = instruction.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
                                                    decodedIx = borshCoder.instruction.decode(hexString, 'hex');
                                                    //const decodedIx = borshCoder.instruction.decode(instruction.data, 'base58')
                                                    
                                                    console.log("decodedIx: "+JSON.stringify(decodedIx));
                                                    
                                                    if (decodedIx){
                                                        if (decodedIx?.name){
                                                            description = "Name: "+decodedIx.name;
                                                        }
                                                        if (decodedIx.data?.inAmount){
                                                            u64BigInt = BigInt(decodedIx.data.inAmount);
                                                            u64Number = Number(u64BigInt);
                                                            description += " - In: "+u64Number;
                                                        }
                                                        if (decodedIx.data?.inAmountPerCycle){
                                                            u64BigInt = BigInt(decodedIx.data.inAmountPerCycle);
                                                            u64Number = Number(u64BigInt);
                                                            description += " - In p/Cycle: " + u64Number;
                                                        }
                                                        if (decodedIx.data?.cycleFrequency){
                                                            u64BigInt = BigInt(decodedIx.data.cycleFrequency);
                                                            u64Number = Number(u64BigInt);
                                                            description += " - Cycle Frequency: "+u64Number+"s";
                                                        }
                                                        if (decodedIx.data?.inAmount && decodedIx.data?.inAmountPerCycle){
                                                            u64BigInt = BigInt(decodedIx.data.inAmount);
                                                            u64Number = Number(u64BigInt);
                                                            var u64BigInt2 = BigInt(decodedIx.data.inAmountPerCycle);
                                                            var u64Number2 = Number(u64BigInt2);
                                                            

                                                            description += " - Cycles: "+Math.floor(u64Number/u64Number2)+"";
                                                        }
                                                        if (decodedIx.data?.minPrice){
                                                            u64BigInt = BigInt(decodedIx.data.minPrice);
                                                            u64Number = Number(u64BigInt);
                                                            description += " - Min Price: "+u64Number;
                                                        }
                                                        if (decodedIx.data?.maxPrice){
                                                            u64BigInt = BigInt(decodedIx.data.maxPrice);
                                                            u64Number = Number(u64BigInt);
                                                            description += " - Max Price: "+u64Number;
                                                        }
                                                        if (decodedIx.data?.startAt){
                                                            u64BigInt = BigInt(decodedIx.data.startAt);
                                                            u64Number = Number(u64BigInt);
                                                            description += " - Starting: "+u64Number;
                                                        }
                                                    }
                                                } catch (error) {
                                                    console.log(`ERR: ${error}`);
                                                }
                                                
                                                //const buffer = Buffer.from(instructionItem.account.instructions[0].data);
                                                const newObject = {
                                                    type:"DCA Program by Jupiter",
                                                    description:description,
                                                    decodedIx:decodedIx,
                                                    data:accountInstruction.data
                                                };
                                                accountInstruction.info = newObject;
                                            }

                                            //console.log("instructionItem.account.instructions[0] "+JSON.stringify(instructionItem.account.instructions[0]))
                                            //console.log("instructionItem.account.instructions[0].data "+JSON.stringify(instructionItem.account.instructions[0].data))
                                            //const buffer = Buffer.from(instructionItem.account.instructions[0].data);
                                            //console.log("instructionItem.account.instructions[0].data "+buffer.toString("utf-8"))
                                        } else if (programId === "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"){
                                            if (accountInstruction?.data){
                                                //const instruction = instructionItem.account.instructions[0];
                                                //const buffer = Buffer.from(instructionItem.account.instructions[0].data);
                                                
                                                let description = "SPL Governance Interaction";
                                                let decodedIx = null;
                                                try {
                                                    //const jsonData = await require('./plugins/idl/GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw.json');
                                                    const jsonData = await require('./plugins/idl/GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw.json');
                                                    const borshCoder = new BorshCoder(JSON.parse(JSON.stringify(jsonData)));
                                                    const instruction = accountInstruction;

                                                    //console.log("instruction.data: "+JSON.stringify(instruction.data))
                                                    const hexString = instruction.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
                                                    //console.log("hexString: "+hexString);
                                                    decodedIx = borshCoder.instruction.decode(hexString, 'hex');

                                                    //const decodedIx = borshCoder.instruction.decode(instruction.data, 'base58')
                                                    console.log("decodedIx: "+JSON.stringify(decodedIx));
                                                    if (!decodedIx){
                                                        const buffer = Buffer.from(accountInstruction.data);
                                                        description = buffer.toString("utf-8");
                                                    }
                                                } catch (error) {
                                                    console.log('ERR: ', error);
                                                    const buffer = Buffer.from(accountInstruction.data);
                                                    description = buffer.toString("utf-8");
                                                }

                                                const newObject = {
                                                    type:"SPL Governance Program by Solana",
                                                    decodedIx:decodedIx,
                                                    description:description,
                                                    data:accountInstruction.data
                                                };
                                                accountInstruction.info = newObject;
                                            }
                                        } else if (programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"){
                                            if (accountInstruction?.data){
                                                const buffer = Buffer.from(accountInstruction.data);
                                                const newObject = {
                                                    type:"Memo Program by Solana",
                                                    description:buffer.toString("utf-8"),
                                                    data:accountInstruction.data
                                                };
                                                accountInstruction.info = newObject;
                                            }
                                        } else {
                                            if (accountInstruction?.data){
                                                const buffer = Buffer.from(accountInstruction.data);
                                                const newObject = {
                                                    type:"Unknown Program",
                                                    description:buffer.toString("utf-8"),
                                                    data:accountInstruction.data
                                                };
                                                accountInstruction.info = newObject;
                                            }
                                        } 
                                    
                                }
                            }
                            cnt++;
                        }

                        /*
                        if (ataArray && ataArray.length <= 100 ){ // to fix add support for over 100 records for gma

                            const owners = await connection.getMultipleParsedAccounts(ataArray);
                            setInstructionOwnerRecord(owners.value);
                            setInstructionOwnerRecordATA(ataArray);
                        }*/

                        const chunks = [];
                        let chunk = [];

                        for (let i = 0; i < ataArray.length; i++) {
                            chunk.push(ataArray[i]);

                            if (chunk.length === 100) {
                                const owners = await connection.getMultipleParsedAccounts(chunk);
                                chunks.push(...owners.value);
                                chunk = [];
                            }
                        }

                        // Push any remaining records from the last chunk
                        if (chunk.length > 0) {
                            const owners = await connection.getMultipleParsedAccounts(chunk);
                            chunks.push(...owners.value);
                        }
                        setInstructionOwnerRecord(chunks);
                        setInstructionOwnerRecordATA(ataArray);

                        /* IMPORTANT Move to this for better efficiency
                        const chunkSize = 100;
                        const holderArr = new Array();
                        // Loop through the array in chunks
                        for (let i = 0; i < ataArray.length; i += chunkSize) {
                            // Slice the array to get a chunk of 100 items
                            const chunk = ataArray.slice(i, i + chunkSize);

                            // Fetch parsed account information for the current chunk
                            const accountInfo = await connection.getMultipleParsedAccounts(chunk);
                            if (accountInfo){
                                // Extract relevant data from the account information and parse it to ensure deep cloning
                                const holders = JSON.parse(JSON.stringify(accountInfo)).value.map(
                                (data:any, key:number) => {
                                    // Map the account data to a new format, extracting address and converting balance
                                    return {data};
                                }
                                );

                                holderArr.push(...holders);
                                // Process the fetched information as needed
                                console.log(`Processed ${holders.length} accounts in chunk ${i / chunkSize + 1}`);
                            }
                        }
                        */
                        
                    }
                    
                    
                }
            }
        }

        const voteResults = voteRecord;//JSON.parse(JSON.stringify(voteRecord));
        //console.log("1 voteResults.. " + JSON.stringify(voteResults))
        const votingResults = [];
        let csvFile = '';
        let uYes = 0;
        let uNo = 0;
        let castedYes = 0;
        let castedNo = 0;

        let mVoteSentiment = new Array();

        if (voteResults){
            let counter = 0;
            for (let item of voteResults){

                counter++;
                //console.log("counter: "+counter);
                //console.log("voter item: "+JSON.stringify(item));
                if (!from_cache){
                    let voterVotes = 0;
                    if (item.account?.vote){
                        if (item.account?.vote?.voteType === 0){
                            uYes++;
                            //console.log(item.account.governingTokenOwner.toBase58()+": "+item.account?.voterWeight)
                            voterVotes = (Number(item.account?.voterWeight));
                            castedYes += (Number(item.account?.voterWeight));
                        
                            //voterVotes = +(Number(item.account?.voterWeight) / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                            //castedYes += +(Number(item.account?.voterWeight) / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                        }else{
                            uNo++;
                            voterVotes = -1 * (Number(item.account?.voterWeight));
                            castedNo += (Number(item.account?.voterWeight));
                        }
                    } else{
                        if (item.account?.voteWeight?.yes && item.account.voteWeight.yes > 0){
                            uYes++;
                            voterVotes = (Number(item.account?.voteWeight?.yes));
                            castedYes += (Number(item.account?.voteWeight?.yes));
                        } else{
                            uNo++;
                            voterVotes = -1 * (Number(item.account?.voteWeight?.no));
                            castedNo += (Number(item.account?.voteWeight?.no));
                        }
                    }

                    if (publicKey){
                        if (publicKey.toBase58() === item.account.governingTokenOwner.toBase58()){
                            setHasVoted(true);
                            voterVotes = +(voterVotes / 10 ** ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td)).toFixed(0);
                            setHasVotedVotes(voterVotes);
                        }
                    }
                    
                    var multipleChoice = null;
                    if (item.account?.vote?.approveChoices && item.account?.vote?.approveChoices !== 'undefined' && item.account?.vote?.approveChoices.length > 1){
                        multipleChoice = item.account?.vote?.approveChoices;
                        
                        var multiItem = 0;
                        if (!mVoteSentiment){
                            mVoteSentiment = new Array(multipleChoice.length).fill(0);
                        }

                        for (var mcitem of multipleChoice){
                            if (mcitem.weightPercentage > 0){
                                if (!mVoteSentiment[multiItem]) mVoteSentiment[multiItem] = 0;
                                mVoteSentiment[multiItem]++;
                            }

                            multiItem++;
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
                            voterWeight:(item.account?.voterWeight ?  Number(item.account?.voterWeight) : null),
                            legacyYes:(item.account?.voteWeight?.yes ?  Number(item.account?.voteWeight?.yes) : null),
                            legacyNo:(item.account?.voteWeight?.no ?  Number(item.account?.voteWeight?.no) : null),
                            decimals:td,
                            councilMint: realm.account?.config?.councilMint ? new PublicKey(realm.account?.config?.councilMint).toBase58() : null,
                            governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                        },
                        vote:{
                            vote:item.account.vote,
                            voterWeight:(item.account?.voterWeight ?  Number(item.account?.voterWeight) : null),
                            legacyYes:(item.account?.voteWeight?.yes ?  Number(item.account?.voteWeight?.yes) : null),
                            legacyNo:(item.account?.voteWeight?.no ?  Number(item.account?.voteWeight?.no) : null),
                            decimals:td,
                            councilMint: realm.account?.config?.councilMint ? new PublicKey(realm.account?.config?.councilMint).toBase58() : null,
                            governingTokenMint:thisitem.account.governingTokenMint?.toBase58(),
                            multipleChoice: multipleChoice
                        }
                    })
                } else {   
                    
                    //console.log(item.governingTokenOwner.toBase58() + ": "+item?.vote.voterWeight);
                    

                    if (item.vote?.vote){
                        if (item.vote?.vote?.voteType === 0){
                            uYes++;
                        }else{
                            uNo++;
                        }
                    } else{
                        if (item.vote.vote?.voteWeight.yes && item.vote.vote.voteWeight.yes > 0){
                            uYes++;
                        } else{
                            uNo++;
                        }
                    }
                    
                    var multipleChoice = null;
                    if (item.vote?.vote?.approveChoices && item.vote?.vote?.approveChoices !== 'undefined' && item.vote?.vote?.approveChoices.length > 1){
                        multipleChoice = item.vote?.vote?.approveChoices;

                        var multiItem = 0;
                        if (!mVoteSentiment){
                            mVoteSentiment = new Array(multipleChoice.length).fill(0);
                        }

                        for (var mcitem of multipleChoice){
                            if (mcitem.weightPercentage > 0){
                                if (!mVoteSentiment[multiItem]) mVoteSentiment[multiItem] = 0;
                                mVoteSentiment[multiItem]++;
                            }

                            multiItem++;
                        }
                    }
                    //console.log("multipleChoice: "+JSON.stringify(multipleChoice));

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
                            decimals:td,
                            councilMint:(realm.account.config?.councilMint ? new PublicKey(realm.account.config?.councilMint).toBase58() : null),
                            governingTokenMint:thisitem.vote?.governingTokenMint.toBase58() 
                        },
                        vote:{
                            vote:item.vote.vote,
                            voterWeight:(item.vote?.voterWeight ?  (item.vote.voterWeight) : null),
                            legacyYes:(item.vote.legacyYes ?  (item.vote.legacyYes) : null),
                            legacyNo:(item.vote.legacyNo ?  (item.vote.legacyNo) : null),
                            decimals:td,
                            councilMint:(realm.account.config?.councilMint ? new PublicKey(realm.account.config?.councilMint).toBase58() : null),
                            governingTokenMint:thisitem.vote?.governingTokenMint.toBase58(),
                            multipleChoice: multipleChoice
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

                    
                    csvFile += item.account.governingTokenOwner.toBase58()+','+(+((voterWeight)/Math.pow(10, ((realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === thisitem.account.governingTokenMint?.toBase58()) ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint === thisitem.account.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.account.proposal.toBase58()+'';
                
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

                    csvFile += item.governingTokenOwner.toBase58()+','+(+((voterWeight)/Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint === thisitem.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.proposal.toBase58()+'';
                    
                }
                
                //    csvFile += item.pubkey.toBase58();
            }
        }

        //console.log("votingResults: "+JSON.stringify(votingResults));

        //castedYes = +castedYes;//+(castedYes / 10 ** ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td)).toFixed(0);
        

        //console.log("castedYes: "+castedYes);
        
        setForVotes(castedYes);
        setAgainstVotes(castedNo);

        setMultiVoteSentiment(mVoteSentiment);

        //setTotalQuorum(castedYes);

        //console.log("tSupply "+tSupply+"*"+voteThresholdPercentage+"*0.01*"+ (Number(supplyFractionPercentage) / 100))

        //console.log("totalQuorum: "+totalVotes)
        //console.log("decimals: "+governingMintDetails.value.data.parsed.info.decimals);
        //console.log("supply: "+governingMintDetails.value.data.parsed.info.supply);
        //console.log("voteThresholdPercentage: "+(voteThresholdPercentage * 0.01))
        //console.log("supplyFractionPercentage: "+(Number(supplyFractionPercentage) / 100))
        
        if (thisQuorum > 0){
            const totalVotesNeeded = Math.ceil(thisQuorum - castedYes);
            if (totalVotesNeeded <= 0){
                setQuorumTargetPercentage(100);
            }else{
                setQuorumTargetPercentage((totalVotesNeeded / castedYes) * 100);
                setQuorumTarget(totalVotesNeeded);
            }
        }

        votingResults.sort((a:any, b:any) => a?.vote.voterWeight < b?.vote.voterWeight ? 1 : -1); 
        
        try{

            const cleanString = thisitem.account?.descriptionLink.replace(/(\s+)(https?:\/\/[a-zA-Z0-9\.\/]+)/g, '$2');
                
            if (cleanString && cleanString.length > 0 && cleanString.includes('http')) {
                const url = new URL(cleanString);

                const pathname = url.pathname;
                const parts = pathname.split('/');
                //console.log("pathname: "+pathname)
                let tGist = null;
                if (parts.length > 1)
                    tGist = parts[2];

                if (url.hostname === "gist.github.com"){

                    setGist(tGist);
                    const rpd = await resolveProposalDescription(thisitem.account?.descriptionLink);
                    
                    // Regular expression to match image URLs
                    const imageUrlRegex = /https?:\/\/[^\s"]+\.(?:jpg|jpeg|gif|png)/gi;
                    const stringWithPreviews = rpd.replace(imageUrlRegex, (match:any, imageUrl:any) => {
                        return "![Image X]("+imageUrl+")";
                    });
                    setProposalDescription(rpd);
                } else if (url.hostname === "docs.google.com") {
                    setGoogleDocs(tGist);
                } else if (url.hostname.includes("gitbook.io")){
                    setGitBook(tGist);
                }
            }
        } catch(e){
            console.log("ERR: "+e)
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
        
        //console.log("votingResults: "+JSON.stringify(votingResults));
        
        setSolanaVotingResultRows(votingResults)
        //console.log("Vote Record: "+JSON.stringify(voteRecord));
        //console.log("This vote: "+JSON.stringify(thisitem));
        setLoadingParticipants(false);
    }

    // Custom render function to handle image previews
    const components = {
        image: ({ src, alt, title }) => (
            <img src={src} alt={alt} title={title} style={{ maxWidth: '90%' }} />
        ),
    };

    const BlogImage = (props:any) => {
        return <img {...props} style={{ maxWidth: "100%" }} />
      }

    const transformImageUri = (uri) => {
        // Add your image resizing logic here
        // Example: Append the query parameter "w=500" to resize the image to a width of 500px
        const resizedUri = `${uri}?w=500`;
        return resizedUri;
    };


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
                return tmap;
            });
        } catch(e){console.log("ERR: "+e)}
    }

    const getCachedGovernanceFromLookup = async (lookup?:any) => {
        let cached_governance = new Array();
        //setCachedRealm(null);

        let usingLookup = governanceLookup;
        if (lookup)
            usingLookup = lookup;

        if (usingLookup){
            for (let glitem of usingLookup){
                if (glitem.governanceAddress === governanceAddress){
                    //if (glitem?.realm)
                    //    setCachedRealm(glitem.realm);
                    if (glitem?.memberFilename){
                        const cached_members = await getFileFromLookup(glitem.memberFilename, storagePool);
                        if (cached_members)
                            setCachedMemberMap(cached_members);
                            // do we push this as a member map
                    }
                    //if (glitem?.totalVaultValue)
                    //    setTotalVaultValue(glitem.totalVaultValue);
                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);

                    //setCachedTimestamp(glitem.timestamp);
                }
            }
        }

        // convert values in governance to BigInt and PublicKeys accordingly
        let counter = 0;

        if (cached_governance){
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
            
            //console.log("cached_governance: "+JSON.stringify(cached_governance))

            setCachedGovernance(cached_governance);
            //getGovernanceParameters(cached_governance);
        } else{
            console.log("Governance Cache Not Found!");
        }
    }

    const getCachedSetup = async() => {
        if (!governanceLookup){
            const fglf = await fetchGovernanceLookupFile(storagePool);
            //console.log("fglf: "+JSON.stringify(fglf))
            setGovernanceLookup(fglf);
            
            //console.log("cachedGovernance: "+JSON.stringify(fglf))
            if (fglf){
                await getCachedGovernanceFromLookup(fglf);
            }
        }
        
        
    }

    const validateGovernanceSetup = async() => {
        
        setLoadingValidation(true);
        if (!tokenMap){
            await getTokens();
        }
        var grealm = null;
        var realmPk = null;
        var realmOwner = null;

        if (!realm){
            grealm = await getRealmIndexed(governanceAddress);
            //if (!grealm)
            //    grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
            //alert("no realm yet")
            realmPk = new PublicKey(grealm.pubkey);
            realmOwner = grealm.owner;
            setRealm(grealm);
            setRealmName(grealm?.account?.name);
        } else{
            setRealmName(realm.account?.name);
            realmOwner = realm.owner.toBase58();
            realmPk = new PublicKey(realm.pubkey);
        }

        if (!thisitem){
            console.log("Calling Index/RPC");
            //const prop = await getProposal(RPC_CONNECTION, new PublicKey(proposalPk));
            const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddress, realmOwner);
            const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
            const prop = await getProposalIndexed(governanceRulesStrArr, realmOwner, governanceAddress, proposalPk);
            
            setThisitem(prop);
        }
        
        if (!memberMap){
            let rawTokenOwnerRecords = null;
            let indexedTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(new PublicKey(realmPk).toBase58(), grealm.owner || realm.owner.toBase58());
            
            console.log("cachedMemberMap: "+JSON.stringify(cachedMemberMap));
            if (cachedMemberMap){
                console.log("** Members from Cache");
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
                rawTokenOwnerRecords = indexedTokenOwnerRecords;//cachedMemberMap;
            } else if (!indexedTokenOwnerRecords){
                console.log("** Members from RPC")
                rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
            } else{
                console.log("** Members from Index")
                rawTokenOwnerRecords = indexedTokenOwnerRecords;
            }
            console.log("Setting MemberMap")
            setMemberMap(rawTokenOwnerRecords);
        }

        console.log("Completed Gov Prop setup")

        setLoadingValidation(false);
    } 

    React.useEffect(() => { 

        if (!loadingValidation){
            console.log("Step 1.");
            getCachedSetup();
        }
    }, []);

    React.useEffect(() => { 
        if (!loadingValidation){
            if (//cachedGovernance && 
                !realm){
                console.log("Step 2.")
                validateGovernanceSetup();
            }
        }
    }, [governanceLookup, cachedGovernance, loadingValidation]);

    React.useEffect(() => { 

        if (//cachedGovernance &&
            (governanceLookup &&
            tokenMap &&
            memberMap &&
            thisitem &&
            realm) || reload){
            if (!loadingValidation){
                if (!loadingParticipants){
                    //console.log("C "+JSON.stringify(cachedGovernance))
                    console.log("Step 4.")
                    
                    if (reload){
                        setTimeout(() => {
                            // Your function code here
                            if (thisitem?.instructions)
                                thisitem.instructions = null;
                            getVotingParticipants();
                            setReload(false);
                          }, 7500);
                    } else{
                        getVotingParticipants();
                    }
                }
            }
            
        }
            /*
            if (thisitem.account?.state === 2){ // if voting state
                if (!thisGovernance){
                    //console.log("get gov props")
                    //getGovernanceProps()
                }
            }*/
    }, [loadingValidation, cachedGovernance, thisitem, !thisGovernance, governanceLookup, tokenMap, memberMap, realm, reload]);

    React.useEffect(() => { 
        // check again if this voter has voted:
        if (publicKey && solanaVotingResultRows){
            if (solanaVotingResultRows){
                for (let result of solanaVotingResultRows){
                    if (result.governingTokenOwner === publicKey.toBase58()){
                        setHasVoted(true);
                        const voterVotes = +(result.quorumWeight.voterWeight / 10 ** ((realm.account.config?.councilMint) === result.governingTokenMint?.toBase58() ? 0 : result.quorumWeight.decimals)).toFixed(0);
                        setHasVotedVotes(voterVotes);
                    }
                }
            }
        }
    }, [publicKey, solanaVotingResultRows]);

    React.useEffect(() => {

        if (background)
            document.body.style.backgroundColor = background;
        if (textColor)
            document.body.style.color = textColor;
        
        if (thisitem && !loadingParticipants){
            //console.log("Step 3.")
            //getVotingParticipants();
        }
    }, [publicKey, loadingValidation, thisitem]);

    return (
        <>
            <ThemeProvider theme={grapeTheme}>
                <Box
                    height='100%'
                >

                {!loadingValidation && !loadingParticipants && thisitem ?
                    <>
                        <Grid container>
                            <Grid item xs={12} sm={6}>
                                {showGovernanceTitle && realmName && 
                                    <>
                                        <Grid item xs={12} container justifyContent="flex-start">
                                            <Grid container>
                                                <Grid item xs={12}>
                                                    <Typography variant="h4">
                                                        {realmName && realmName}
                                                    </Typography>
                                                </Grid>
                                                
                                                {/*
                                                <Grid item xs={12}>
                                                    <Button
                                                        size='small'
                                                        sx={{color:'white', borderRadius:'17px'}}
                                                        href={`https://realms.today/dao/${governanceAddress}/proposal/${proposalPk}`}
                                                        target='blank'
                                                    >
                                                        <Typography variant="caption">
                                                        View on Realms <OpenInNewIcon fontSize='inherit'/>
                                                        </Typography>
                                                    </Button>
                                                </Grid>
                                                */}
                                            </Grid>
                                        </Grid>
                                    </>
                                }

                                {(showGovernanceTitle && proposalPk && realmName) ? 
                                    <Grid container direction='row'>
                                        <Grid item xs={12} container justifyContent="flex-start">
                                            
                                            <ButtonGroup
                                                variant="outlined" 
                                                color='inherit'
                                            >
                                                <Tooltip title={`Back to ${realmName ? realmName : ''} Governance`}>
                                                    <Button 
                                                        aria-label="back"
                                                        variant="outlined" 
                                                        color='inherit'
                                                        //href={`https://governance.so/governance/${governanceAddress}`}
                                                        component={Link}
                                                        to={`/governance/${governanceAddress}`}
                                                        sx={{
                                                            borderTopLeftRadius:'17px',
                                                            borderBottomLeftRadius:'17px',
                                                            borderColor:'rgba(255,255,255,0.05)',
                                                            fontSize:'10px'}}
                                                    >
                                                        <ArrowBackIcon fontSize='inherit' sx={{mr:1}} /> Back
                                                    </Button>
                                                </Tooltip>
                                        
                                            <CopyToClipboard 
                                                    text={`https://governance.so/proposal/${governanceAddress}/${proposalPk}`} 
                                                    onCopy={handleCopyClick}
                                                >
                                                    <Tooltip title={`Copy ${realmName ? realmName : ''} Governance Propoosal Link`}>
                                                        <Button
                                                            aria-label="copy"
                                                            variant="outlined" 
                                                            color='inherit'
                                                            sx={{
                                                                borderTopRightRadius:'17px',
                                                                borderBottomRightRadius:'17px',
                                                                borderColor:'rgba(255,255,255,0.05)',
                                                                fontSize:'10px'}}
                                                        >
                                                            <ContentCopyIcon fontSize='inherit' sx={{mr:1}} /> Copy
                                                        </Button>
                                                    </Tooltip>
                                            </CopyToClipboard>
                                            
                                            </ButtonGroup>
                                            <Tooltip title={`Visit ${realmName ? realmName : 'DAO'} on the Realms UI`}>
                                                <Button 
                                                    aria-label="back"
                                                    variant="outlined" 
                                                    color='inherit'
                                                    href={`https://realms.today/dao/${governanceAddress}/proposal/${thisitem?.pubkey}`}
                                                    target='blank'
                                                    sx={{
                                                        borderRadius:'17px',
                                                        borderColor:'rgba(255,255,255,0.05)',
                                                        fontSize:'10px'}}
                                                >
                                                    <OpenInNewIcon fontSize='inherit' sx={{mr:1}} /> Realms
                                                </Button>
                                            </Tooltip>
                                            
                                        </Grid>
                                    </Grid>
                                :
                                    <Grid container>
                                        <Grid item xs={12} container justifyContent="flex-start">
                                            
                                            <ButtonGroup
                                                variant="outlined" 
                                                color='inherit'
                                            >
                                                <CopyToClipboard 
                                                        text={`https://governance.so/proposal/${governanceAddress}/${proposalPk}`} 
                                                        onCopy={handleCopyClick}
                                                    >
                                                        <Tooltip title={`Copy ${realmName ? realmName : ''} Governance Propoosal Link`}>
                                                            <Button
                                                                variant="outlined" 
                                                                color='inherit'
                                                                aria-label="copy"
                                                                sx={{   
                                                                    borderTopLeftRadius:'17px',
                                                                    borderBottomLeftRadius:'17px',
                                                                    borderColor:'rgba(255,255,255,0.05)',
                                                                    fontSize:'10px'}}
                                                            >
                                                                <ContentCopyIcon fontSize='inherit' sx={{mr:1}} /> Copy
                                                            </Button>
                                                        </Tooltip>
                                                </CopyToClipboard>

                                                <Tooltip title={`Visit  ${realmName ? realmName : 'DAO'} on the Realms UI`}>
                                                    <Button 
                                                        aria-label="back"
                                                        href={`https://realms.today/dao/${governanceAddress}/proposal/${thisitem?.pubkey}`}
                                                        target='blank'
                                                        sx={{
                                                            borderTopRightRadius:'17px',
                                                            borderBottomRightRadius:'17px',
                                                            borderColor:'rgba(255,255,255,0.05)',
                                                            fontSize:'10px',
                                                        }}
                                                    >
                                                        <OpenInNewIcon fontSize='inherit' sx={{mr:1}} /> Realms
                                                    </Button>
                                                </Tooltip>
                                            </ButtonGroup>
                                        </Grid>
                                        
                                    </Grid>                       
                                }
                                </Grid>
                                {realm &&
                                <Grid item xs={12} sm={6} container justifyContent="flex-end">
                                    <GovernancePower governanceAddress={typeof realm.pubkey.toBase58 === 'function' ? realm.pubkey.toBase58() : realm.pubkey} realm={realm} />
                                </Grid>
                                }
                            </Grid>
                        

                        
                            <Box sx={{ alignItems: 'left', textAlign: 'left'}}>
                                <Divider sx={{mt:1,mb:1}}/>
                                <Grid container>
                                    <Grid item xs>
                                        <Grid container direction='row' alignItems='center'>
                                            <Grid item>
                                                {proposalAuthor ?
                                                    <Typography variant='subtitle1'>Author: <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={proposalAuthor} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/></Typography>
                                                    :
                                                    <>
                                                    {thisitem.account?.tokenOwnerRecord &&
                                                        <Typography variant='subtitle1'>Author Record: <ExplorerView address={new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/></Typography>
                                                    }
                                                    </>
                                                }
                                            </Grid>
                                            <Grid item>
                                                <Typography variant="caption" sx={{color:'#ccc'}}>
                                                    &nbsp;<Tooltip title="Drafted at"><Button color='inherit' sx={{textTransform:'none',fontSize:'12px',borderRadius:'17px',ml:1}}>{moment.unix(Number(thisitem.account?.draftAt)).format("MMMM D, YYYY, h:mm a")}</Button></Tooltip>
                                                </Typography>
                                            </Grid>
                                            
                                        </Grid>
                                        <Typography variant='subtitle1'>To: {voteType === 'Council' ? `Council`:`Community`} {/*propVoteType === 0 ? `Council`:`Community`*/}</Typography>
                                    </Grid>
                                    
                                    <Grid sx={{ alignItems: 'center', textAlign: 'right',
                                

                                            '@media (max-width: 900px)': {
                                                // Center the ButtonGroup on md and smaller screens
                                                width: '100%',
                                                justifyContent: 'center',
                                            },
                                        }}>
                                        {thisitem?.account?.voteType?.type === 1 ?
                                            <></>
                                        :
                                        <Grid container spacing={0} direction='row' alignItems='right' justifyContent='center'>

                                            <Grid item xs={6} sm={6} md={6} key={1}
                                                alignItems="right"
                                            >
                                                <Box
                                                    display='flex' 
                                                    sx={{
                                                        //background: 'rgba(0, 0, 0, 0.25)',
                                                        //borderRadius: '17px',
                                                        p:0.25,
                                                        //width:'260px',
                                                        justifyContent: 'center', // Center the content horizontally
                                                        mr:1,
                                                    }}
                                                    >
                                                    <ButtonGroup variant="outlined" aria-label="outlined primary button group" sx={{textAlign:'center',height:'70px'}}>
                                                        {/*thisitem.account?.options && thisitem.account?.options.length >= 0 ? 
                                                            <Button
                                                                color="success"
                                                                sx={{borderRadius:'17px',textTransform:'none'}}
                                                            >
                                                                
                                                                <Grid container direction="column" alignItems="center">
                                                                    <Grid item>
                                                                        <Grid container direction='row' alignItems='center'>
                                                                            <Grid item>
                                                                                <ThumbUpIcon fontSize='small' sx={{mr:1,ml:1}} />
                                                                            </Grid>
                                                                            <Grid item>
                                                                                {forVotes ? getFormattedNumberToLocale(formatAmount((forVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.options[0].voteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                            </Grid>
                                                                        </Grid>
                                                                    </Grid>
                                                                    
                                                                    <Grid item sx={{minWidth:'100px'}}>
                                                                        <Divider />
                                                                        <Grid>
                                                                            <Typography sx={{fontSize:'10px'}}>
                                                                                <>
                                                                                
                                                                                For <>{forVotes ? 
                                                                                <>
                                                                                    {(forVotes/(forVotes+againstVotes)*100).toFixed(2)}%
                                                                                </>
                                                                                :
                                                                                <>
                                                                                    {thisitem.account?.options && thisitem.account?.options[0]?.voteWeight && thisitem?.account?.denyVoteWeight && Number(thisitem.account?.options[0].voteWeight) > 0 ?
                                                                                        <>
                                                                                        {`${(((Number(thisitem.account?.options[0].voteWeight))/((Number(thisitem.account?.denyVoteWeight))+(Number(thisitem.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                                        </>
                                                                                    :
                                                                                        <>
                                                                                            {thisitem.account.yesVotesCount ?
                                                                                                <>{(Number(thisitem.account.yesVotesCount)/(Number(thisitem.account.noVotesCount)+Number(thisitem.account.yesVotesCount))*100).toFixed(2)}%</>
                                                                                            :
                                                                                                <>0%</>
                                                                                            }
                                                                                        </>
                                                                                    } 
                                                                                </>   
                                                                                }</></>
                                                                            </Typography>
                                                                        </Grid>
                                                                    </Grid>
                                                                </Grid>
                                                            </Button>
                                                        :
                                                            <>
                                                                {thisitem.account?.yesVotesCount && 
                                                                        <Button
                                                                            color="success"
                                                                            sx={{borderRadius:'17px'}}
                                                                        >
                                                                            <ThumbUpIcon color='success' fontSize='small' sx={{mr:1,ml:1}} />
                                                                            {forVotes ? getFormattedNumberToLocale(formatAmount((forVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.yesVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                        </Button>
                                                                }
                                                            </>
                                                        */}
                                                    {realm &&
                                                        <VoteForProposal 
                                                            title={`${
                                                                thisitem.account?.options && thisitem.account?.options.length >= 0 ? 
                                                                forVotes ? (+((forVotes / 10 ** tokenDecimals)).toFixed(0)).toLocaleString() : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.options[0].voteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))
                                                                :
                                                                forVotes ? (+((forVotes / 10 ** tokenDecimals)).toFixed(0)).toLocaleString() : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.yesVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))
                                                            }`}
                                                            subtitle={`For 
                                                                    ${forVotes ?
                                                                      (forVotes / (forVotes + againstVotes) * 100).toFixed(2) + '%'
                                                                      : (thisitem.account?.options &&
                                                                      thisitem.account?.options[0]?.voteWeight &&
                                                                      thisitem?.account?.denyVoteWeight &&
                                                                      Number(thisitem.account?.options[0].voteWeight) > 0) ?
                                                                      (((Number(thisitem.account?.options[0].voteWeight)) / ((Number(thisitem.account?.denyVoteWeight)) + (Number(thisitem.account?.options[0].voteWeight)))) * 100).toFixed(2) + '%'
                                                                      : thisitem.account.yesVotesCount ?
                                                                      (Number(thisitem.account.yesVotesCount) / (Number(thisitem.account.noVotesCount) + Number(thisitem.account.yesVotesCount)) * 100).toFixed(2) + '%'
                                                                      : '0%'
                                                                    }
                                                                `}
                                                            hovertext=""
                                                            showIcon={true} 
                                                            votingResultRows={solanaVotingResultRows}  
                                                            getVotingParticipants={getVotingParticipants} 
                                                            hasVotedVotes={hasVotedVotes} 
                                                            hasVoted={hasVoted} 
                                                            realm={realm} 
                                                            governanceAddress={governanceAddress}
                                                            thisitem={thisitem} 
                                                            type={0}
                                                            quorum={totalQuorum}
                                                            state={thisitem.account.state}
                                                            governanceRules={thisGovernance}
                                                            />
                                                        }
                                                    </ButtonGroup>
                                                </Box>
                                            </Grid>
                                            <Grid item xs={6} sm={6} md={6} key={1}>
                                                <Box
                                                    display='flex' 
                                                    sx={{
                                                        //background: 'rgba(0, 0, 0, 0.25)',
                                                        //borderRadius: '17px',
                                                        p:0.25,
                                                        //width:'260px',
                                                        justifyContent: 'center', // Center the content horizontally
                                                        //ml:1,
                                                        }}
                                                    >
                                                    <ButtonGroup variant="outlined" aria-label="outlined primary button group" sx={{height:'70px'}}>
                                                        {/*thisitem.account?.denyVoteWeight ?
                                                            <Button
                                                                    color="error"
                                                                    sx={{borderRadius:'17px',textTransform:'none'}}
                                                                >
                                                                    <Grid container direction="column" alignItems="center">
                                                                        <Grid item>
                                                                            <Grid container direction='row' alignItems='center'>
                                                                                <Grid item>
                                                                                    <ThumbDownIcon fontSize='small' sx={{mr:1,ml:1}} />
                                                                                </Grid>
                                                                                <Grid item>
                                                                                    {againstVotes ? getFormattedNumberToLocale(formatAmount((againstVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.denyVoteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                                </Grid>
                                                                            </Grid>
                                                                        </Grid>
                                                                        
                                                                        <Grid item sx={{minWidth:'100px'}}>
                                                                            <Divider />
                                                                            <Grid>
                                                                                <Typography sx={{fontSize:'10px'}}>
                                                                                    <>
                                                                                    
                                                                                    Against <>{againstVotes ? 
                                                                                        <>
                                                                                            {(againstVotes/(forVotes+againstVotes)*100).toFixed(2)}%
                                                                                        </>
                                                                                        :       
                                                                                        <>
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
                                                                                        </>
                                                                                    }</></>
                                                                                </Typography>
                                                                            </Grid>
                                                                        </Grid>
                                                                    </Grid>
                                                                    
                                                                    
                                                                    
                                                            </Button>
                                                        :
                                                            <>
                                                                {thisitem.account?.noVotesCount && 
                                                                    <Button
                                                                        color="error"
                                                                        sx={{borderRadius:'17px'}}
                                                                    >
                                                                        <ThumbDownIcon color='error' fontSize='small' sx={{mr:1}} />
                                                                        {againstVotes ? getFormattedNumberToLocale(formatAmount((againstVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.noVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                    </Button>
                                                                }
                                                            </>
                                                        */}
                                                        
                                                        <VoteForProposal 
                                                            title={`${
                                                                thisitem.account?.denyVoteWeight ?
                                                                againstVotes ? getFormattedNumberToLocale(formatAmount(+(againstVotes / 10 ** tokenDecimals).toFixed(0))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.denyVoteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))
                                                                :
                                                                againstVotes ? getFormattedNumberToLocale(formatAmount(+(againstVotes / 10 ** tokenDecimals).toFixed(0))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.noVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))
                                                            }`}
                                                            subtitle={`Against 
                                                                    ${againstVotes ?
                                                                        (againstVotes/(forVotes+againstVotes)*100).toFixed(2) + '%'
                                                                      : (thisitem.account?.options && thisitem.account?.options[0]?.voteWeight && 
                                                                        thisitem?.account?.denyVoteWeight && 
                                                                        Number(thisitem.account?.options[0].voteWeight) > 0) ?
                                                                        (((Number(thisitem.account?.denyVoteWeight)/Math.pow(10, tokenDecimals))/((Number(thisitem.account?.denyVoteWeight)/Math.pow(10, tokenDecimals))+(Number(thisitem.account?.options[0].voteWeight)/Math.pow(10, tokenDecimals))))*100).toFixed(2) + '%'
                                                                      : thisitem.account.noVotesCount ?
                                                                      (Number(thisitem.account.noVotesCount)/(Number(thisitem.account.noVotesCount)+Number(thisitem.account.yesVotesCount))*100).toFixed(2) + '%'
                                                                      : '0%'
                                                                    }
                                                                `}
                                                            hovertext=""
                                                            showIcon={true} 
                                                            votingResultRows={solanaVotingResultRows}  
                                                            getVotingParticipants={getVotingParticipants} 
                                                            hasVotedVotes={hasVotedVotes} 
                                                            hasVoted={hasVoted} 
                                                            realm={realm} 
                                                            governanceAddress={governanceAddress}
                                                            thisitem={thisitem} 
                                                            type={1}
                                                            quorum={totalQuorum}
                                                            state={thisitem.account.state}
                                                            governanceRules={thisGovernance} />
                                                    </ButtonGroup>
                                                </Box>
                                            </Grid>
                                        </Grid>
                                    }

                                    </Grid>
                                </Grid>
                            </Box>
                        

                        <Divider sx={{mt:1,mb:1}} />

                        <Grid container sx={{mb:1}}>
                            <Grid item md={8} sm={12} xs={12} sx={{mt:2}}>
                                <Box
                                    sx={{
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        borderRadius: '17px',
                                        p:1
                                    }}
                                >
                                    <Box sx={{ alignItems: 'left', textAlign: 'left',m:1}}>
                                        <Typography variant='h5'>{thisitem.account?.name}</Typography>
                                    </Box>
                                    
                                    <Box sx={{ alignItems: 'left', textAlign: 'left',m:1}}>
                                        {gist ?
                                            <Box sx={{ alignItems: 'left', textAlign: 'left'}}>
                                                <div
                                                    style={{
                                                        border: 'solid',
                                                        borderRadius: 15,
                                                        borderColor:'rgba(255,255,255,0.05)',
                                                        padding:4,
                                                    }} 
                                                >
                                                    <Typography variant='body2'>
                                                        <ReactMarkdown 
                                                            remarkPlugins={[[remarkGfm, {singleTilde: false}], remarkImages]} 
                                                            transformImageUri={transformImageUri}
                                                            children={proposalDescription}
                                                            components={{
                                                                // Custom component for overriding the image rendering
                                                                img: ({ node, ...props }) => (
                                                                <img
                                                                    {...props}
                                                                    style={{ width: '100%', height: 'auto' }} // Set the desired width and adjust height accordingly
                                                                />
                                                                ),
                                                            }}
                                                        />
                                                    </Typography>
                                                </div>
                                                <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                                    <Button
                                                        color='inherit'
                                                        target='_blank'
                                                        href={thisitem.account?.descriptionLink}
                                                        sx={{borderRadius:'17px'}}
                                                    >
                                                        <GitHubIcon sx={{mr:1}} /> GIST
                                                    </Button>
                                                </Box>
                                            </Box>
                                            :
                                            
                                            <>
                                                {gDocs ?
                                                <>
                                                    <Box sx={{ alignItems: 'left', textAlign: 'left'}}>
                                                        <Grid
                                                            style={{
                                                                border: 'none',
                                                                padding:4,
                                                            }} 
                                                        >
                                                            <iframe src={thisitem.account?.descriptionLink} width="100%" height="750px" style={{"border": "none"}}></iframe>
                                                        </Grid>
                                                            <>

                                                                <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                                                    <Button
                                                                        color='inherit'
                                                                        target='_blank'
                                                                        href={thisitem.account?.descriptionLink}
                                                                        sx={{borderRadius:'17px'}}
                                                                    >
                                                                        <ArticleIcon sx={{mr:1}} /> Google Docs
                                                                    </Button>
                                                                </Box>
                                                            </>
                                                    </Box>
                                                </>
                                                :
                                                    <>
                                                        {thisitem.account?.descriptionLink &&
                                                            <>
                                                                <Typography variant="body1" 
                                                                    color='gray' 
                                                                    sx={{ display: 'flex', alignItems: 'center' }}>
                                                                    {thisitem.account?.descriptionLink}
                                                                </Typography>
                                                                
                                                                {gitBook &&
                                                                    <>
                                                                        <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                                                            <Button
                                                                                color='inherit'
                                                                                target='_blank'
                                                                                href={thisitem.account?.descriptionLink}
                                                                                sx={{borderRadius:'17px'}}
                                                                            >
                                                                                <ArticleIcon sx={{mr:1}} /> GitBook
                                                                            </Button>
                                                                        </Box>
                                                                    </>
                                                                }
                                                            </>
                                                        }
                                                    </>
                                                }
                                            </>
                                        }
                                        
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item md={4} sm={12} xs={12} sx={{mt:2}}>
                                <Box
                                    sx={{
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        borderRadius: '17px',
                                        p:1,
                                        ml: window.matchMedia('(min-width: 900px)').matches ? 1 : 0,
                                    }}
                                >
                                    <Grid container>
                                        <Grid item xs={12} key={1}>
                                            
                                            {governingMintInfo &&
                                            <>
                                                {thisitem.account.governingTokenMint &&
                                                <Box sx={{ my: 3, mx: 2 }}>
                                                    <Grid container alignItems="center">
                                                    <Grid item xs>
                                                        <Typography gutterBottom variant="subtitle1" component="div">
                                                            Mint
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item>
                                                        <Typography gutterBottom variant="body1" component="div">
                                                                <ExplorerView
                                                                    address={thisitem.account.governingTokenMint?.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='white' fontSize='12px'
                                                                    showTokenMetadata={true}
                                                                    tokenMap={tokenMap}/>
                                                        </Typography>
                                                    </Grid>
                                                    </Grid>
                                                    <Typography color="text.secondary" variant="caption">
                                                        {propVoteType} used to vote for this proposal
                                                    </Typography>
                                                </Box>
                                                }

                                                {(totalQuorum && thisitem.account?.state === 2 && thisitem.account?.options &&  thisitem.account?.options.length === 1 && forVotes) ?
                                                    <Box sx={{ my: 3, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                Votes Required
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                {/* ((+(totalQuorum) - (Number(thisitem.account.options[0]?.voteWeight) / 10 ** votingDecimals)) */}
                                                                {(totalQuorum - (forVotes/10**votingDecimals)) > 0 ?
                                                                    <>
                                                                        {(+(totalQuorum - (forVotes/10**votingDecimals))
                                                                        .toFixed(0)).toLocaleString()}
                                                                    </>
                                                                    :<>Passing</>
                                                                }
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                        <Typography color="text.secondary" variant="caption">
                                                            {(totalQuorum - (forVotes/10**votingDecimals)) > 0 ?
                                                            <>
                                                                Remaining votes required for proposal to pass
                                                            </>
                                                            :
                                                            <>
                                                                Passing {(+((totalQuorum - (forVotes/10**votingDecimals)) * -1)
                                                                        .toFixed(0)).toLocaleString()} over quorum
                                                            </>
                                                            }
                                                            
                                                        </Typography>
                                                    </Box>
                                                :<></>}

                                                {(thisitem.account.signingOffAt && +thisitem.account.signingOffAt > 0 && thisitem.account.status !== 0 && thisitem.account.status !== 1) &&
                                                    <Box sx={{ my: 3, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                Time Left
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                {thisGovernance && thisGovernance?.account?.config?.baseVotingTime ?
                                                                    <>
                                                                        {thisitem.account?.draftAt &&
                                                                            <>
                                                                                {thisitem.account?.votingCompletedAt ?
                                                                                    `${moment.unix(Number(thisitem.account.signingOffAt)+Number(thisGovernance.account?.config.baseVotingTime)).fromNow()}`
                                                                                :
                                                                                    `Ending ${moment.unix(Number(thisitem.account.signingOffAt)+Number(thisGovernance.account.config.baseVotingTime)).fromNow()}`
                                                                                }
                                                                            </>
                                                                        }
                                                                    </>
                                                                :
                                                                    `Ended`
                                                                }
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                        <Typography color="text.secondary" variant="caption">
                                                            From now how much time left until this proposal ends (Cool Off: {moment.unix((Number(thisGovernance?.account?.config?.votingCoolOffTime))).hours() > 0 && `${moment.unix((Number(thisGovernance?.account?.config?.votingCoolOffTime))).hours()}hrs`})
                                                        </Typography>
                                                    </Box>
                                                }

                                                </>
                                            }

                                            {expandInfo &&
                                                <Box>

                                                    
                                                    {totalQuorum &&
                                                    <Box sx={{ my: 3, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                Quorum
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                {((+(totalQuorum).toFixed(1)).toLocaleString())}
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                        <Typography color="text.secondary" variant="caption">
                                                            Tokens needed for the proposal to pass *{(totalVoteThresholdPercentage)}% max vote threshhold
                                                        </Typography>
                                                    </Box>
                                                    }

                                                    {totalSupplyFractionPercentage &&
                                                    <Box sx={{ my: 3, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                Supply Fraction Percentage
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                {(totalSupplyFractionPercentage)}%
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                        <Typography color="text.secondary" variant="caption">
                                                            {(+((totalSupplyFractionPercentage/100)*totalSupply).toFixed(0)).toLocaleString()} calculated from {(totalSupply.toLocaleString())} supply
                                                        </Typography>
                                                    </Box>
                                                    }
                                                    
                                                    {(voteType !== 'Council' && realm && 
                                                        (realm?.account?.config?.useCommunityVoterWeightAddin || realm?.account?.communityTokenConfig?.voterWeightAddin)) &&
                                                        <Box sx={{ my: 3, mx: 2 }}>
                                                            <Grid container alignItems="center">
                                                            <Grid item xs>
                                                                <Typography gutterBottom variant="subtitle1" component="div">
                                                                    VSR
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item>
                                                                <Typography gutterBottom variant="body1" component="div">

                                                                    {(realm && 
                                                                        (realm?.account?.config?.useCommunityVoterWeightAddin || realm?.account?.communityTokenConfig?.voterWeightAddin)
                                                                        ) ?
                                                                        <>
                                                                            Using Voter Weight Plugin
                                                                        </>
                                                                    :
                                                                        ``
                                                                        
                                                                    }
                                                                </Typography>
                                                            </Grid>
                                                            </Grid>
                                                            <Typography color="text.secondary" variant="caption">
                                                                {realm?.account?.communityTokenConfig?.voterWeightAddin &&
                                                                <>
                                                                    VSR: {realm.account.communityTokenConfig.voterWeightAddin.toBase58()}
                                                                </>
                                                                }
                                                                {console.log("realm: "+JSON.stringify(realm))}
                                                            </Typography>
                                                        </Box>
                                                    }

                                                    
                                                    {/*totalSupply &&
                                                    <Box sx={{ my: 3, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                Token Supply
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                {(totalSupply.toLocaleString())}
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                        <Typography color="text.secondary" variant="caption">
                                                            Number of tokens in circulation
                                                        </Typography>
                                                    </Box>
                                                    */}
                                            
                                                    {(thisitem.account.signingOffAt && +thisitem.account.signingOffAt > 0 &&  thisitem.account.status !== 0 && thisitem.account.status !== 1) &&
                                                        <Box sx={{ my: 3, mx: 2 }}>
                                                            <Grid container alignItems="center">
                                                            <Grid item xs>
                                                                <Typography gutterBottom variant="subtitle1" component="div">
                                                                    General Sentiment
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item>
                                                                <Typography gutterBottom variant="body1" component="div">
                                                                    {uniqueYes} / {uniqueNo}
                                                                </Typography>
                                                            </Grid>
                                                            </Grid>
                                                            <Typography color="text.secondary" variant="caption">
                                                                Total unique voters voting for/against this proposal <sup>*</sup>{uniqueYes+uniqueNo} participants
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    
                                                    {(thisitem.account.signingOffAt && +thisitem.account.signingOffAt > 0 && (thisitem.account.status !== 0 && thisitem.account.status !== 1)) &&
                                                        <Box sx={{ my: 3, mx: 2 }}>
                                                            <Grid container alignItems="center">
                                                            <Grid item xs>
                                                                <Typography gutterBottom variant="subtitle1" component="div">
                                                                    Signed Off At
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item>
                                                                <Typography gutterBottom variant="body1" component="div">
                                                                    {moment.unix(Number(thisitem.account?.signingOffAt)).format("MMMM D, YYYY, h:mm a")}
                                                                </Typography>
                                                            </Grid>
                                                            </Grid>
                                                            <Typography color="text.secondary" variant="caption">
                                                                Timestamp that this proposal was signed off (voting started)
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    
                                                    {(thisitem.account.signingOffAt && +thisitem.account.signingOffAt > 0 && thisitem.account.status !== 0 && thisitem.account.status !== 1) &&
                                                        <Box sx={{ my: 3, mx: 2 }}>
                                                            <Grid container alignItems="center">
                                                            <Grid item xs>
                                                                <Typography gutterBottom variant="subtitle1" component="div">
                                                                    {(thisitem.account?.votingCompletedAt && +thisitem.account?.votingCompletedAt > 0) ?
                                                                        <>Ended At</>
                                                                    :
                                                                        <>Ends At</>
                                                                    }
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item>
                                                                <Typography gutterBottom variant="body1" component="div">
                                                                    {thisGovernance && thisGovernance?.account?.config?.baseVotingTime ?
                                                                        <>
                                                                            {thisitem.account?.draftAt &&
                                                                                `${moment.unix(Number(thisitem.account.signingOffAt)+(Number(thisGovernance.account.config.baseVotingTime))).format("MMMM D, YYYY, h:mm a")}`
                                                                            }
                                                                        </>
                                                                    :
                                                                        <>
                                                                        {thisitem.account?.votingCompletedAt ?
                                                                            `${moment.unix(thisitem.account.votingCompletedAt).format("MMMM D, YYYY, h:mm a")}`
                                                                        :
                                                                            `Ended`
                                                                        }
                                                                        </>
                                                                    }
                                                                </Typography>
                                                            </Grid>
                                                            </Grid>
                                                            <Typography color="text.secondary" variant="caption">
                                                                Calculated ending timestamp
                                                            </Typography>
                                                        </Box>
                                                    }

                                                    {/*
                                                    const baseVotingTime = (Number(allGovernances.find(obj => obj.pubkey.toBase58() === item.account.governance.toBase58())?.account?.config?.baseVotingTime));
                                                    const coolOffTime = (Number(allGovernances.find(obj => obj.pubkey.toBase58() === item.account.governance.toBase58())?.account?.config?.votingCoolOffTime));
                                                    
                                                    const timeEnding = Number(item.account?.signingOffAt) + baseVotingTime + coolOffTime;
                                                    const timeEndingDate = new Date(timeEnding);
                                                    const timeEndingTime = timeEndingDate.getTime() * 1000;
                                                    const currentDate = new Date();
                                                    const currentTime = currentDate.getTime();
                                                    const timeAgo = moment.unix(timeEnding).fromNow();
                                                    const endingStr = currentTime <= timeEndingTime ? `Ending ${timeAgo}` : ``;
                                                    const coolOffStr = moment.unix(coolOffTime).hours();
                                                    */}

                                                    <Box sx={{ my: 3, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                Status
                                                            </Typography>
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                
                                                                
                                                                {(publicKey && proposalAuthor === publicKey.toBase58() && +thisitem.account.state === 0) ?
                                                                    <> 
                                                                        <IntegratedGovernanceProposalDialogView 
                                                                            governanceAddress={governanceAddress}
                                                                            governanceRulesWallet={thisitem.account.governance}
                                                                            governingTokenMint={thisitem.account.governingTokenMint}
                                                                            proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                                            payerWallet={publicKey}
                                                                            governanceLookup={governanceLookup}
                                                                            editProposalAddress={thisitem.pubkey}
                                                                            setReload={setReload}
                                                                            title="Edit Proposal"
                                                                        />
                                                                    </>
                                                                    :<>
                                                                        {GOVERNANCE_STATE[thisitem.account?.state]}
                                                                    </>
                                                                }
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                        <Typography color="text.secondary" variant="caption">
                                                            Voting Status
                                                        </Typography>
                                                    </Box>

                                                    {(publicKey && proposalSignatories && proposalSignatories.length > 0 && +thisitem.account.state === 1) &&
                                                        <>
                                                            <Box sx={{ my: 3, mx: 2 }}>
                                                                <Grid container alignItems="center">
                                                                    <Grid item xs>
                                                                        <Typography gutterBottom variant="subtitle1" component="div">
                                                                            Signers {proposalSignatories.length}
                                                                        </Typography>
                                                                    </Grid>
                                                                    <Grid item>

                                                                        {proposalSignatories
                                                                            //.filter((obj:any,key:number) => obj.account.signatory.toBase58() === publicKey.toBase58() && obj.account.signedOff === false)
                                                                            .map((filteredItem:any) => (
                                                                                <>
                                                                                {/*
                                                                                <br/>Signer: {filteredItem.account.signatory.toBase58()}
                                                                                <><br/></>Status: {filteredItem.account.signedOff ? `true` : `false`}
                                                                                */}
                                                                                    {(filteredItem.account.signatory.toBase58() === publicKey.toBase58() && filteredItem.account.signedOff === false) ? 
                                                                                    
                                                                                        <Grid container alignItems="center">
                                                                                            <ManageGovernanceProposal 
                                                                                                governanceAddress={governanceAddress}
                                                                                                governanceRulesWallet={thisitem.account.governance}
                                                                                                governingTokenMint={thisitem.account.governingTokenMint}
                                                                                                proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                                                                payerWallet={publicKey}
                                                                                                governanceLookup={governanceLookup}
                                                                                                editProposalAddress={thisitem.pubkey}
                                                                                                realm={realm}
                                                                                                memberMap={memberMap}
                                                                                                setReload={setReload}
                                                                                                proposalSignatories={proposalSignatories}
                                                                                                mode={1} // signoff
                                                                                            />
                                                                                        </Grid>
                                                                                    :
                                                                                        <>
                                                                                            <br/>
                                                                                            <ButtonGroup>
                                                                                                <Button
                                                                                                    color='inherit'
                                                                                                    variant='text'
                                                                                                    disabled={true}
                                                                                                >
                                                                                                {filteredItem.account.signedOff ? 
                                                                                                    <CheckCircleIcon color='success' />
                                                                                                : 
                                                                                                    <RadioButtonUncheckedIcon />
                                                                                                }
                                                                                                </Button>
                                                                                                <ExplorerView 
                                                                                                    address={filteredItem.account.signatory.toBase58()} 
                                                                                                    type='address' 
                                                                                                    shorten={4} 
                                                                                                    hideTitle={false} 
                                                                                                    style='text' color='white' fontSize='14px' />
                                                                                            </ButtonGroup>
                                                                                        </>
                                                                                    }
                                                                                </>
                                                                        ))}
                                                                    </Grid>
                                                                    
                                                                </Grid>
                                                                <Typography color="text.secondary" variant="caption">
                                                                </Typography>
                                                            </Box>
                                                        </>
                                                    }

                                                    {(publicKey && proposalAuthor === publicKey.toBase58() && +thisitem.account.state === 0) ?
                                                        <>
                                                            <Box sx={{ my: 3, mx: 2 }}>
                                                                <Grid container alignItems="center">
                                                                    <ManageGovernanceProposal 
                                                                        governanceAddress={governanceAddress}
                                                                        governanceRulesWallet={thisitem.account.governance}
                                                                        governingTokenMint={thisitem.account.governingTokenMint}
                                                                        proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                                        payerWallet={publicKey}
                                                                        governanceLookup={governanceLookup}
                                                                        editProposalAddress={thisitem.pubkey}
                                                                        realm={realm}
                                                                        memberMap={memberMap}
                                                                        setReload={setReload}
                                                                        proposalSignatories={proposalSignatories}
                                                                        mode={1} // signoff
                                                                    />
                                                                </Grid>
                                                            </Box>
                                                            
                                                            <Box sx={{ my: 3, mx: 2 }}>
                                                                <Grid container alignItems="center">
                                                                    <ManageGovernanceProposal 
                                                                        governanceAddress={governanceAddress}
                                                                        governanceRulesWallet={thisitem.account.governance}
                                                                        governingTokenMint={thisitem.account.governingTokenMint}
                                                                        proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                                        payerWallet={publicKey}
                                                                        governanceLookup={governanceLookup}
                                                                        editProposalAddress={thisitem.pubkey}
                                                                        realm={realm}
                                                                        memberMap={memberMap}
                                                                        setReload={setReload}
                                                                        proposal={thisitem}
                                                                        proposalSignatories={proposalSignatories}
                                                                        mode={2} // add signer
                                                                    />
                                                                </Grid>
                                                            </Box>
                                                        {
                                                            <Box sx={{ my: 3, mx: 2 }}>
                                                                <Grid container alignItems="center">
                                                                    <ManageGovernanceProposal 
                                                                        governanceAddress={governanceAddress}
                                                                        governanceRulesWallet={thisitem.account.governance}
                                                                        governingTokenMint={thisitem.account.governingTokenMint}
                                                                        proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                                        payerWallet={publicKey}
                                                                        governanceLookup={governanceLookup}
                                                                        editProposalAddress={thisitem.pubkey}
                                                                        realm={realm}
                                                                        memberMap={memberMap}
                                                                        setReload={setReload}
                                                                        proposalSignatories={proposalSignatories}
                                                                        mode={3} // cancel
                                                                    />
                                                                </Grid>
                                                            </Box>
                                                        }
                                                            
                                                        </>
                                                        :<></>
                                                    }
                                                    
                                                    {(thisitem.account.signingOffAt && +thisitem.account.signingOffAt > 0 && +thisitem.account.state !== 0 && +thisitem.account.state !== 1 && csvGenerated) &&
                                                        <Box sx={{ my: 3, mx: 2 }}>
                                                            <Grid container alignItems="center">
                                                            <Grid item xs>
                                                                <Typography gutterBottom variant="subtitle1" component="div">
                                                                    Export
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item>
                                                                <Typography gutterBottom variant="body1" component="div">
                                                                    <Tooltip title="Download Voter Participation CSV file">
                                                                        <Button
                                                                            size="small"
                                                                            color='inherit'
                                                                            variant="outlined"
                                                                            sx={{borderRadius:'17px'}}
                                                                            download={`${thisitem.pubkey.toBase58()}.csv`}
                                                                            href={csvGenerated}
                                                                        >
                                                                            <DownloadIcon /> CSV
                                                                        </Button>
                                                                    </Tooltip>
                                                                </Typography>
                                                            </Grid>
                                                            </Grid>
                                                            <Typography color="text.secondary" variant="caption">
                                                                Export voter participation as a CSV file
                                                            </Typography>
                                                        </Box>
                                                    }
                                                </Box>
                                            }

                                            <Box sx={{ my: 3, mx: 2 }}>
                                                    <Grid container alignItems="center">
                                                        <Grid item xs>
                                                            
                                                        </Grid>
                                                        <Grid item>
                                                            <Typography gutterBottom variant="body1" component="div">
                                                                <Button
                                                                    size="small"
                                                                    color='inherit'
                                                                    variant="outlined"
                                                                    onClick={toggleInfoExpand}
                                                                    sx={{
                                                                        borderRadius:'17px',
                                                                        textTransform:'none',
                                                                    }}
                                                                >
                                                                    {expandInfo ? <><ExpandLess sx={{mr:1}}/> Less</> : <><ExpandMoreIcon sx={{mr:1}}/> More Info</>}
                                                                </Button>
                                                            </Typography>
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                        </Grid>
                                        
                                    </Grid>  
                                </Box>
                            </Grid>
                        </Grid>

                        {(proposalInstructions && proposalInstructions.length > 0) &&
                            <>
                            <Box
                                sx={{ 
                                    mb: 1, 
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '17px'
                                }}
                            > 
                                
                                    <ListItemButton 
                                        onClick={handleClickOpenInstructions}
                                        sx={{
                                            backgroundColor:'rgba(0,0,0,0.2)',
                                            borderRadius:'17px',
                                            borderBottomLeftRadius: openInstructions ? '0' : '17px',
                                            borderBottomRightRadius: openInstructions ? '0' : '17px', 
                                        }}
                                    >
                                        <ListItemIcon>
                                        <CodeIcon />
                                        </ListItemIcon>
                                        <ListItemText primary={<>
                                            Instructions
                                            &nbsp;{proposalInstructions[0].account.instructions.length > 1 ? proposalInstructions[0].account.instructions.length : proposalInstructions.length}
                                            </>
                                        } />
                                            {openInstructions ? <ExpandLess /> : <ExpandMoreIcon />}
                                    </ListItemButton>
                                    <Collapse in={openInstructions} timeout="auto" unmountOnExit
                                        sx={{
                                            borderBottomLeftRadius: openInstructions ? '17px' : '0',
                                            borderBottomRightRadius: openInstructions ? '17px' : '0', 
                                            backgroundColor:'rgba(0,0,0,0.2)'}}
                                    >
                                        
                                        <Box>
                                            {(instructionTransferDetails && instructionTransferDetails.length > 0) &&
                                                <Box
                                                    sx={{
                                                        p:1,
                                                        m:1,
                                                        borderRadius:'17px',
                                                        backgroundColor:'rgba(0,0,0,0.2)'}}
                                                >
                                                    <Typography variant="subtitle1">
                                                        Token Transfer Summary
                                                    </Typography>
                                                    <Typography variant="caption">

                                                        {Object.values(
                                                            instructionTransferDetails.reduce((result, item) => {
                                                                //console.log("item: "+JSON.stringify(item))
                                                                const { mint, amount, name, logoURI, destinationAta } = item;
                                                                if (!result[mint]) {
                                                                    result[mint] = { mint, totalAmount: 0, name, logoURI, uniqueDestinationAta: new Set() };
                                                                }
                                                                result[mint].totalAmount += +amount;
                                                                if (destinationAta)
                                                                    result[mint].uniqueDestinationAta.add(destinationAta);
                                                                return result;
                                                            }, {})
                                                            ).map((item) => (
                                                                <>
                                                                    <Grid container
                                                                        direction="row"
                                                                    >
                                                                        <Grid item>
                                                                            <ExplorerView
                                                                                address={item.mint} type='address' useLogo={item?.logoURI} 
                                                                                title={`${item.totalAmount.toLocaleString()} 
                                                                                    ${item?.name || (item?.mint && trimAddress(item.mint)) || 'Explore'}
                                                                                    to ${item.uniqueDestinationAta.size} unique wallet${(item.uniqueDestinationAta.size > 1) ? `s`:``}
                                                                                `} 
                                                                                hideTitle={false} style='text' color='white' fontSize='12px'
                                                                                showNftData={true} />
                                                                        </Grid>
                                                                    </Grid>
                                                                </>
                                                            )

                                                        )}
                                                    </Typography>
                                                </Box>
                                            }
                                        </Box>
                                        
                                        <Timeline>
                                            {proposalInstructions[0].account.instructions.length > 1 ?
                                            <>
                                                {proposalInstructions[0].account.instructions && (proposalInstructions[0].account.instructions).map((item: any, index:number) => (
                                                    <>
                                                        <InstructionView governingTokenMint={thisitem.account.governingTokenMint} setReload={setReload} realm={realm} proposalAuthor={proposalAuthor} state={thisitem.account.state} cachedTokenMeta={cachedTokenMeta} setInstructionTransferDetails={setInstructionTransferDetails} instructionTransferDetails={instructionTransferDetails} memberMap={memberMap} tokenMap={tokenMap} instruction={item} index={index} instructionOwnerRecord={instructionOwnerRecord} instructionOwnerRecordATA={instructionOwnerRecordATA} />
                                                    </>
                                                ))}
                                            </>
                                            :
                                            <>
                                                {proposalInstructions && (proposalInstructions).map((item: any, index:number) => (
                                                    <InstructionView governingTokenMint={thisitem.account.governingTokenMint} setReload={setReload} realm={realm} proposalAuthor={proposalAuthor} state={thisitem.account.state} cachedTokenMeta={cachedTokenMeta} setInstructionTransferDetails={setInstructionTransferDetails} instructionTransferDetails={instructionTransferDetails} memberMap={memberMap} tokenMap={tokenMap} instruction={item} index={index} instructionOwnerRecord={instructionOwnerRecord} instructionOwnerRecordATA={instructionOwnerRecordATA} />
                                                ))}
                                            </>
                                            }
                                        </Timeline>
                                    </Collapse>
                                    
                                </Box>
                            
                            </>
                        }
                            
                        {propVoteType &&
                            <Box sx={{ alignItems: 'center', textAlign: 'center',p:1,mb:2}}>
                                <Grid container spacing={0}>
                                    
                                    {thisitem?.account?.voteType?.type === 1 ?
                                        <Grid container spacing={0}>
                                            <Grid item xs={12} key={1}>
                                            Multiple Choice

                                            <List dense={true}>
                                                
                                            {(thisitem?.account?.options && thisitem?.account?.options.length > 0) &&
                                                <>
                                                    {(thisitem?.account?.options).map((mitem: any, mindex:number) => (
                                                        
                                                        <ListItem
                                                            secondaryAction={
                                                                <VoteForProposal 
                                                                    votingResultRows={solanaVotingResultRows} 
                                                                    getVotingParticipants={getVotingParticipants} 
                                                                    hasVotedVotes={hasVotedVotes} 
                                                                    hasVoted={hasVoted} 
                                                                    propVoteType={propVoteType} 
                                                                    realm={realm} 
                                                                    governanceAddress={governanceAddress}
                                                                    thisitem={thisitem} 
                                                                    type={0} 
                                                                    multiChoice={{index:mindex,proposal:thisitem}}
                                                                    state={thisitem.account.state}
                                                                    governanceRules={thisGovernance}
                                                                    />
                                                            }
                                                            >
                                                            <ListItemAvatar>
                                                                <Avatar>
                                                                <HowToVoteIcon />
                                                                </Avatar>
                                                            </ListItemAvatar>
                                                            <ListItemText
                                                                primary={mindex+1 + ': ' + mitem.label}
                                                                secondary={
                                                                    <>{
                                                                    (typeof mitem.voteWeight === "string" && /^[0-9A-Fa-f]+$/.test(mitem.voteWeight)) ?  
                                                                    Number(Number(parseInt(mitem.voteWeight,16) / Math.pow(10, tokenDecimals)).toFixed(0)).toLocaleString()
                                                                    : 
                                                                    Number(Number(mitem.voteWeight / Math.pow(10, tokenDecimals)).toFixed(0)).toLocaleString()
                                                                    }
                                                                    <>{(multiVoteSentiment && multiVoteSentiment[mindex]) ? ` - Voter Sentiment ${multiVoteSentiment[mindex]}` : <></>}</>
                                                                    </>
                                                                    
                                                                }
                                                            />
                                                        </ListItem>
                                                        
                                                    
                                                    ))}
                                                </>
                                            }   
                                                </List>

                                            </Grid>
                                        </Grid>
                                    :
                                        <></>
                                    }

                                    
                                    {(thisitem?.account?.options && thisitem?.account?.options.length > 0) ?
                                        <></>
                                    :
                                        <Grid item xs={12}>
                                            {(thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                                <>
                                                    <Box sx={{ width: '100%' }}>
                                                        <BorderLinearProgress variant="determinate" value={100} />
                                                        <Typography variant='caption'>{GOVERNANCE_STATE[thisitem.account.state]}</Typography>
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
                                    
                                </Grid>

                            </Box>
                        }

                        <Box sx={{mb:2}}>
                            <GovernanceRealtimeInfo governanceAddress={proposalPk} title={'Latest Activity'} tokenMap={tokenMap} />
                        </Box>

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
                    </>
                    :
                        <Grid 
                            xs={12}
                            sx={{textAlign:'center'}}
                        >
                            <CircularProgress color="inherit" />
                        </Grid>
                    }
                </Box>
            </ThemeProvider>
        </>
    )
}