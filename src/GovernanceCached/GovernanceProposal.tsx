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
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import BN from 'bn.js'
import * as fs from "fs";
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token-v2";
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
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
  Tooltip,
  LinearProgress,
  Chip,
  IconButton,
  ButtonGroup,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  List,
  ListItem,
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
 
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import BallotIcon from '@mui/icons-material/Ballot';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CodeIcon from '@mui/icons-material/Code';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
    TX_RPC_ENDPOINT, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
import { withTheme } from '@emotion/react';
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
    width: '100%', // Make it full width
    backgroundColor: '#333', // Change the background color to dark
    color: '#fff', // Change the text color to white or another suitable color
    border: 'none', // Remove the border (optional)
    padding: theme.spacing(1), // Add padding (optional)
  }));

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
}

export function GovernanceProposalView(props: any){
    const [searchParams, setSearchParams] = useSearchParams();
    const {governance} = useParams<{ governance: string }>();
    const {proposal} = useParams<{ proposal: string }>();

    const showGovernanceTitle = props.showGovernanceTitle !== undefined ? props.showGovernanceTitle : true;
    const background = null; //props?.background ? props.background : null;
    const textColor = null; //props?.textColor ? props.background : null;
    const showGovernanceNavigation = props.showGovernanceNavigation !== undefined ? props.showGovernanceNavigation : true;
    
    const governanceAddress = searchParams.get("governance") || governance || props?.governanceAddress;
    const [thisitem, setThisitem] = React.useState(props?.item);
    const proposalPk = searchParams.get("proposal") || thisitem?.pubkey || proposal;
    //const [governanceAddress, setGovernanceAddress] = React.useState(props?.governanceAddress);
    const connection = RPC_CONNECTION;
    const [cachedGovernance, setCachedGovernance] = React.useState(props?.cachedGovernance || null);
    const [governanceLookup, setGovernanceLookup] = React.useState(props?.governanceLookup || null);
    const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
    const [memberMap, setMemberMap] = React.useState(props?.memberMap);
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
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [thisGovernance, setThisGovernance] = React.useState(null);
    const [proposalAuthor, setProposalAuthor] = React.useState(null);
    const [governingMintInfo, setGoverningMintInfo] = React.useState(null);
    const [totalQuorum, setTotalQuorum] = React.useState(null);
    const [quorumTargetPercentage, setQuorumTargetPercentage] = React.useState(null);
    const [quorumTarget, setQuorumTarget] = React.useState(null);
    const [totalSupply, setTotalSupply] = React.useState(null);
    const [proposalInstructions, setProposalInstructions] = React.useState(null);
    const [instructionOwnerRecord, setInstructionOwnerRecord] = React.useState(null);
    const [instructionOwnerRecordATA, setInstructionOwnerRecordATA] = React.useState(null);
    const [exceededQuorum, setExceededQuorum] = React.useState(null);
    const [exceededQuorumPercentage, setExceededQuorumPercentage] = React.useState(null);
    const [selectedDelegate, setSelectedDelegate] = React.useState("");
    const { publicKey, wallet, sendTransaction, signTransaction } = useWallet();
    const [loadingParticipants, setLoadingParticipants] = React.useState(false);
    const [forVotes, setForVotes] = React.useState(0);
    const [againstVotes, setAgainstVotes] = React.useState(0);
    const [multiVoteSentiment, setMultiVoteSentiment] = React.useState(null);
    const [hasVoted, setHasVoted] = React.useState(false);
    const [hasVotedVotes, setHasVotedVotes] = React.useState(0);
    const [cachedTokenMeta, setCachedTokenMeta] = React.useState([{mint: "A6GComqUgUZ7mTqZcDrgnigPEdYDcw5yCumbHaaQxVKK", logo: "https://arweave.net/4-3-xg9otuhR3BZ72MVk6-QB0tqBZAniXfsvAawEdHI", name: "VINE"}]);
    //const cachedTokenMeta = new Array();
    const [castedYesVotes, setCastedYesVotes] = React.useState(null);
    const [excessVotes, setExcessVotes] = React.useState(null);
    
    const handleCopyClick = () => {
        enqueueSnackbar(`Copied!`,{ variant: 'success' });
    };

    const votingresultcolumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', width: 70, hide: true},
        { field: 'pubkey', headerName: 'PublicKey', width: 170, hide: true,
            renderCell: (params) => {
                return(params.value)
            }
        },
        { field: 'proposal', headerName: 'Proposal', width: 170, hide: true, sortable: false,
            renderCell: (params) => {
                return(params.value)
            }
        },
        { field: 'governingTokenOwner', headerName: 'Token Owner', width: 170, flex: 1,
            renderCell: (params) => {
                return(
                    <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={params.value} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
        },
        { field: 'voteAddress', headerName: 'Address', width: 150, sortable: false,
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
            governance = await getGovernance(connection, thisitem.account.governance);    
        //}

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
    const [instructionTransferSummary, setInstructionTransferSummary] = React.useState([]);
    const loadedInstructions = new Array();

    function InstructionView(props: any) {
        const index = props.index;
        const instructionOwnerRecord = props.instructionOwnerRecord;
        const instructionOwnerRecordATA = props.instructionOwnerRecordATA;
        const instruction = props.instruction;
        const instructionDetails = instruction.account?.instructions?.[0] || instruction.account?.instruction;
        const [iVLoading, setIVLoading] = React.useState(false);

        if (instructionDetails){
            const typeOfInstruction = instructionDetails?.data[0];
            //console.log("instructionDetails "+JSON.stringify(instructionDetails))
            const programId = new PublicKey(instructionDetails?.programId).toBase58();
            console.log("programId: "+programId);
            console.log("typeOfInstruction: "+typeOfInstruction)
            const instructionInfo = InstructionMapping?.[programId]?.[typeOfInstruction];
            // for ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL it will return no type as it is a single create ata account


            const OwnerRecord = (props:any) => {
                const pubkey = props.pubkey;
                const [ownerRecord, setOwnerRecord] = React.useState(null);
                
                const fetchOwnerRecord = () => {
                    //console.log("instructionOwnerRecord "+JSON.stringify(instructionOwnerRecord))
                    //console.log("instructionOwnerRecordATA "+JSON.stringify(instructionOwnerRecordATA))
                    var index = 0;
                    for (var item of instructionOwnerRecordATA){
                        if (new PublicKey(item).toBase58() === new PublicKey(pubkey).toBase58()){
                            if (instructionOwnerRecord[index]?.data?.parsed?.info){
                                setOwnerRecord(instructionOwnerRecord[index].data.parsed.info);
                                //console.log("instructionOwnerRecord[index] "+JSON.stringify(instructionOwnerRecord[index]))
                            }
                        }
                        index++;
                    }
                }

                React.useEffect(() => { 
                    if ((!ownerRecord)&&(pubkey)){
                        fetchOwnerRecord()
                    }
                }, [pubkey, instructionOwnerRecord]);

                return (
                    <>
                        {ownerRecord && 
                            <>
                                {ownerRecord?.owner ?
                                    <ExplorerView grapeArtProfile={true} showSolanaProfile={true} memberMap={memberMap} address={new PublicKey(ownerRecord.owner).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                :
                                    <Typography variant='caption'>*Raw Record: <br/>
                                        <Grid item xs zeroMinWidth>
                                            <Typography noWrap sx={{fontSize:'10px'}}>
                                                <CustomTextarea
                                                    minRows={2}
                                                    value={JSON.stringify(ownerRecord)}
                                                    readOnly
                                                /><br/>
                                            </Typography>
                                        </Grid>
                                    </Typography>
                                }

                                {(ownerRecord?.tokenAmount?.amount && +ownerRecord.tokenAmount.amount > 0) ? 
                                    <Grid> 
                                        <Tooltip title="Wallet Balance">
                                            <Button color='inherit'
                                                sx={{borderRadius:'17px'}}
                                            >
                                            <AccountBalanceWalletIcon fontSize='small' /> &nbsp;
                                            {getFormattedNumberToLocale(formatAmount(+(ownerRecord.tokenAmount.amount/Math.pow(10, (ownerRecord.tokenAmount?.decimals || 0))).toFixed(0)))}
                                            </Button>
                                        </Tooltip>
                                    </Grid>
                                :<></>
                                }
                            </>
                        }
                    </>
                )
            }

            const getObjectByMint = (mintValue:string) => {
                //if (cachedTokenMeta)
                //    console.log("cachedTokenMeta: "+JSON.stringify(cachedTokenMeta));

                if (cachedTokenMeta)
                    return cachedTokenMeta.find((item:any) => item.mint === mintValue);
                else
                    return null;
            };

            const getMetaplexMetadata = async(mint:String) => {
                
                const mint_address = new PublicKey(mint)
                const [pda, bump] = await PublicKey.findProgramAddress([
                    Buffer.from("metadata"),
                    METAPLEX_PROGRAM_ID.toBuffer(),
                    new PublicKey(mint_address).toBuffer(),
                ], METAPLEX_PROGRAM_ID)
                const meta_response = await connection.getAccountInfo(pda);
                //console.log("meta_response: "+JSON.stringify(meta_response));

                if (meta_response){
                    const meta_final = decodeMetadata(meta_response.data);
                    
                    //console.log("final: "+JSON.stringify(meta_final))

                    const file_metadata = meta_final.data.uri;

                    if (file_metadata && file_metadata.length > 0){
                        const file_metadata_url = new URL(file_metadata);

                        const IPFS = 'https://ipfs.io';
                        const IPFS_2 = "https://nftstorage.link/ipfs";
                        /*
                        if (file_metadata.startsWith(IPFS) || file_metadata.startsWith(IPFS_2)){
                            file_metadata = CLOUDFLARE_IPFS_CDN+file_metadata_url.pathname;
                        }*/
                        
                        //setCollectionRaw({meta_final,meta_response});
                        try{
                            const metadata = await window.fetch(file_metadata)
                            .then(
                                (res: any) => res.json())
                            .catch((error) => {
                                // Handle any errors that occur during the fetch or parsing JSON
                                console.error("Error fetching data:", error);
                                });
                            
                            if (metadata && metadata?.image){

                                return {
                                    mint: mint,
                                    logo: metadata.image,
                                    name: meta_final.data.name
                                }
                            }
                        }catch(err){
                            console.log("ERR: ",err);
                        }
                    }
                }
                return null;
            }

            const InstructionMemoRecord = (props:any) => {

                return (
                    <>
                        {JSON.stringify(instructionInfo)}
                    </>
                );

            }


            const InstructionTransferRecord = (props:any) => {
                //const pubkey = props.pubkey;
                const [instructionRecord, setInstructionRecord] = React.useState(null);
                const [iLoading, setILoading] = React.useState(false);

                const fetchTokenMetadata = async() => {
                    setILoading(true);
                    let destinationAta = null;
                    if (instruction.account.instructions[0].accounts.length > 0){
                        if (!instruction.account.instructions[0].isWritable)
                            destinationAta = instruction.account.instructions[0].accounts[1].pubkey;
                    }

                    let name = null;
                    let logo = null;

                    if (instruction.account.instructions[0]?.gai.value.data.parsed.info.mint){
                        if (tokenMap.get(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)){
                            name = tokenMap.get(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.symbol;
                            logo = tokenMap.get(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.logoURI;
                        } else{
                            // add caching support so we do not make this call numerous times
                            const cachedMint = getObjectByMint(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint);
                            
                            //console.log("cachedTokenMeta: ("+cachedMint+") "+JSON.stringify(cachedTokenMeta));
                            
                            if (! cachedMint && !iLoading){

                                /*
                                const gmm = await getMetaplexMetadata(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint);
                                if (gmm){
                                    name = gmm.name;
                                    logo = gmm.logo;
                                }
                                

                                const tokenMeta ={
                                    mint: instruction.account.instructions[0]?.gai.value.data.parsed.info.mint,
                                    name: gmm.name,
                                    logo: gmm.logo
                                }

                                if (cachedTokenMeta && cachedTokenMeta.length > 0)
                                    setCachedTokenMeta((prevTokenMeta:any) => [...prevTokenMeta, tokenMeta]);
                                else
                                    setCachedTokenMeta([tokenMeta])
                                
                                console.log("fin set "+instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)
                                */
                            } else{
                                name = cachedMint.name;
                                logo = cachedMint.logo;
                            }
                        }
                    }

                    const newObject = {
                        pubkey: instruction.account.instructions[0].accounts[0].pubkey,
                        mint: instruction.account.instructions[0]?.gai.value.data.parsed.info.mint,
                        name: name,
                        logoURI: logo,
                        amount: new BN(instructionDetails?.data?.slice(1), 'le').toNumber()/Math.pow(10, (instruction.account.instructions[0]?.gai.value.data.parsed.info.tokenAmount?.decimals || 0)),
                        destinationAta: destinationAta
                    };

                    const hasInstruction = instructionTransferDetails.some(obj => obj.pubkey === instruction.account.instructions[0].accounts[0].pubkey);

                    if (!hasInstruction)
                        setInstructionTransferDetails((prevArray) => [...prevArray, newObject]);

                    setILoading(false);
                }

                const fetchInstructionRecord = async() => {
                    setILoading(true);
                    
                    //console.log("instruction.account.instructions[0]?.info "+JSON.stringify(instruction))
                    if (instruction.account.instructions[0]?.info && instruction.account.instructions[0]?.gai){
                        setInstructionRecord(instruction.account.instructions[0]?.gai.value);
                    }    
                    setILoading(false);
                }

                /*
                React.useEffect(() => { 
                    if (instructionRecord){
                        fetchTokenMetadata();
                    }
                }, [instructionRecord]);
                */

                React.useEffect(() => { 
                    if (!iLoading && !instructionRecord && instruction.pubkey && instructionDetails) {
                        fetchInstructionRecord();
                    }
                    if (!iLoading && instructionRecord){
                        fetchTokenMetadata();
                    }
                }, [iLoading, instructionRecord, instruction.pubkey, instructionDetails]);

                return (
                    <>
                    {instructionRecord && 
                        <ExplorerView 
                            showSolanaProfile={false}  
                            address={instructionRecord.data.parsed.info.mint} type='address' useLogo={getObjectByMint(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.logo || tokenMap.get(instructionRecord.data.parsed.info.mint)?.logoURI} 
                            title={
                                `${(new BN(instructionDetails?.data?.slice(1), 'le').toNumber()/Math.pow(10, (instructionRecord.data.parsed.info.tokenAmount?.decimals || 0))).toLocaleString()} 
                                ${getObjectByMint(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.name || tokenMap.get(instructionRecord.data.parsed.info.mint)?.symbol || (instructionRecord.data.parsed.info.mint && trimAddress(instructionRecord.data.parsed.info.mint)) || 'Explore'}
                            `} 
                            hideTitle={false} style='text' color='white' fontSize='12px'/>
                    }
                    </>
                );
            }
            
            React.useEffect(() => { 
                
            }, []);

            if (!iVLoading){
                return(
                    <>{index > 0 && <Divider />}
                        
                        <TimelineItem>
                            
                            <TimelineOppositeContent
                                sx={{ m: 'auto 0' }}
                                align="right"
                                variant="body2"
                                color="text.secondary"
                                >

                                <Typography variant="subtitle1">
                                    Instruction {index+1} <ExplorerView address={new PublicKey(instruction.pubkey).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                </Typography>
                                <Typography>
                                    {instructionInfo?.name || <ExplorerView address={new PublicKey(instructionDetails.programId).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px'/>}
                                    
                                    {instructionInfo?.name === 'Token Transfer' &&
                                        <>  
                                        <br/>
                                            <InstructionTransferRecord />
                                        </>
                                    }
                                </Typography>
                                

                                
                            </TimelineOppositeContent>
                        
                            <TimelineSeparator>
                            <TimelineConnector />
                            <TimelineDot>
                                <CodeIcon />
                            </TimelineDot>
                            <TimelineConnector />
                            </TimelineSeparator>
                            <TimelineContent sx={{ py: '12px', px: 2 }}>
                            
                            <Typography variant="h6" component="span" color="#999">
                                Instruction Accounts
                            </Typography>
                            <Typography>

                                {instructionDetails?.accounts && (instructionDetails.accounts).map((item: any, iindex:number) => (
                                    <>
                                        {item.isSigner ? 
                                            <Grid textAlign='right'>
                                                <Typography variant="caption">
                                                    Signer: 
                                                    <ExplorerView showSolanaProfile={false} address={new PublicKey(item.pubkey).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                                </Typography>
                                            </Grid>
                                        :
                                        <>
                                            <OwnerRecord pubkey={item.pubkey} />
                                            
                                            <Typography variant="caption">
                                                
                                                ATA Account {iindex+1}: &nbsp;
                                                {item.isWritable && <>
                                                    <Tooltip title={item.isWritable ? `Writable` : `Writable: false`}>
                                                        <IconButton color='inherit' size='small'
                                                            sx={{borderRadius:'17px',textTransform:'none'}}
                                                        >
                                                            {item.isWritable ? 
                                                                <EditIcon sx={{fontSize:'12px'}} color='warning' />
                                                                :
                                                                <EditIcon sx={{fontSize:'12px'}} color='disabled' />
                                                            }
                                                        </IconButton>
                                                    </Tooltip>
                                                </>}

                                                <ExplorerView showSolanaProfile={false} address={new PublicKey(item.pubkey).toBase58()} type='address' shorten={0} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                                
                                            </Typography>
                                            <br/><br/>
                                        </>
                                        }
                                    </>
                                ))}

                            </Typography>
                            
                            {instructionDetails?.info?.description &&   
                                <Grid container sx={{mt:1}}>
                                    <Grid item>        
                                        <Typography variant="h6" component="span" color="#999">
                                            Description
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        {instructionDetails.info.description}
                                    </Grid>
                                </Grid>
                            }

                            {instructionDetails.info?.decodedIx && 
                                <Grid container sx={{mt:1}}>
                                    <Grid item>
                                        <Typography variant="h6" component="span" color="#999">
                                            Decoded
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Grid container>
                                            <Grid item xs>
                                                <CustomTextarea
                                                    minRows={4}
                                                    value={JSON.stringify(instructionDetails.info.decodedIx)}
                                                    readOnly
                                                />
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            }

                            {instructionDetails.info?.data && 
                                <Grid container sx={{mt:1}}>
                                    <Grid item>
                                        <Typography variant="h6" component="span" color="#999">
                                            Data
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Grid container>
                                            <Grid item xs>
                                                <CustomTextarea
                                                    minRows={4}
                                                    value={JSON.stringify(instructionDetails.info.data)}
                                                    readOnly
                                                />
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            }
                            </TimelineContent>
                        </TimelineItem>
                    </>
                );
            } else{
                return <></>
            } 
        } else{
            return <></>
        }
    }

    // Custom function to read a big UInt64LE
    function readBigUInt64LE(buffer) {
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
            try{
                //console.log("checking token: "+new PublicKey(thisitem.account.governingTokenMint).toBase58());
                td = tokenMap.get(new PublicKey(thisitem.account.governingTokenMint).toBase58()).decimals;
                vType = 'Token';
                //console.log("tokenMap: "+td);
            }catch(e){
                const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                console.log("found: "+JSON.stringify(token.value.data.parsed.info.decimals))

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
        setTokenDecimals(td);
        setVoteType(vType)
        
        if (vType){
            setPropVoteType(vType);

            //thisitem.account.tokenOwnerRecord;
            for (const item of memberMap){
                if (item.pubkey === new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()){
                    setProposalAuthor(item.account.governingTokenOwner)
                    //console.log("member:" + JSON.stringify(item));
                }
            }
        }
        
        //if (thisitem.account?.state === 2){ // if voting state
            const thisQuorum = await getGovernanceProps()
        //}

        // CACHE
        // fetch voting results
        let voteRecord = null;
        let from_cache = false;
        
        for (var vresults of cachedGovernance){
            
            if (thisitem.pubkey.toBase58() === vresults.pubkey.toBase58()){
                voteRecord = vresults.votingResults;

                if (thisitem.account.state === 2){ // voting state we can fetch via rpc
                    console.log("Fetching voting proposal current results via RPC")
                    from_cache = false;
                    const voteRecords = await getVoteRecords({
                        connection: connection,
                        programId: new PublicKey(thisitem.owner),
                        proposalPk: new PublicKey(thisitem.pubkey),
                    });
                    if (voteRecords?.value)
                        voteRecord = voteRecords.value;//JSON.parse(JSON.stringify(voteRecord));
                    
                } else{
                    console.log("Fetching proposal results via Cached Storage")
                    from_cache = true;
                }
            

                // if this is voting we should fetch via RPC

                
                let instructions = null;
                if (thisitem.account.state === 2 && !thisitem?.instructions){
                    //console.log("We are here... !!!!!")
                    if (thisitem.pubkey){
                        instructions = await getGovernanceAccounts(
                            connection,
                            new PublicKey(thisitem.owner),
                            ProposalTransaction,
                            [pubkeyFilter(1, new PublicKey(thisitem.pubkey))!]
                        );
                        thisitem.instructions = instructions;
                    }
                }


                if (thisitem?.instructions){
                    thisitem.instructions.sort((a:any, b:any) => b?.account.instructionIndex < a?.account.instructionIndex ? 1 : -1); 
                    setProposalInstructions(thisitem.instructions);
                    
                    // we need to optimize the proposal instructions rpc calls
                    
                    var ataArray = new Array();
                    if (thisitem.instructions){
                        for (var instructionItem of thisitem.instructions){
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

                                
                                if (instructionItem?.account?.instructions[0].data && instructionItem.account.instructions[0].data.length > 0){
                                    const typeOfInstruction = instructionItem.account.instructions[0].data[0];
                                    //console.log("instructionDetails "+JSON.stringify(instructionDetails))
                                    const programId = new PublicKey(instructionItem?.account?.instructions[0].programId).toBase58();
                                    const instructionInfo = InstructionMapping?.[programId]?.[typeOfInstruction];
                                    
                                    
                                    //console.log("instructionInfo "+JSON.stringify(instructionInfo))
                                    
                                    if (instructionInfo?.name === "Token Transfer"){
                                        const gai = await connection.getParsedAccountInfo(new PublicKey(instructionItem.account.instructions[0].accounts[0].pubkey))
                                        
                                        if (gai){
                                            //setInstructionRecord(gai.value);
                                            
                                            const newObject = {
                                                type:"TokeTransfer",
                                                pubkey: instructionItem.account.instructions[0].accounts[0].pubkey,
                                                mint: gai.value?.data.parsed.info.mint,
                                                name: tokenMap.get(gai.value?.data.parsed.info.mint)?.symbol,
                                                logoURI: tokenMap.get(gai.value?.data.parsed.info.mint)?.logoURI,
                                                amount: new BN(instructionItem.account.instructions[0]?.data?.slice(1), 'le').toNumber()/Math.pow(10, (gai.value?.data.parsed.info.tokenAmount?.decimals || 0)),
                                                data: instructionItem.account.instructions[0].data
                                            };

                                            //console.log("newObject "+JSON.stringify(newObject))
                                            instructionItem.account.instructions[0].info = newObject;
                                            instructionItem.account.instructions[0].gai = gai;
                                            
                                            /*
                                            const hasInstruction = instructionTransferDetails.some(obj => obj.pubkey === instructionItem.account.instructions[0].accounts[0].pubkey);
                
                                            if (!hasInstruction){
                                                setInstructionTransferDetails((prevArray) => [...prevArray, newObject]);
                                            }
                                            */
                                        }
                                    } else if (programId === "DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M"){
                                        
                                        console.log("DCA PROGRAM INSTRUCTION: "+JSON.stringify(instructionItem.account))
                                        
                                        if (instructionItem.account.instructions[0]?.data){

                                            console.log("DCA Base64: "+instructionItem.account.instructions[0]?.data.toString("base64"))
                                            
                                            //const fileContent = await fs.readFile('./plugins/idl/JupiterDCA.json', options:{encoding:'utf-8'});
                                            const jsonData = require('./plugins/idl/JupiterDCA.json');
                                            //const fileContent = await fs.readFileSync('./plugins/idl/JupiterDCA.json');
                                            
                                            const borshCoder = new BorshCoder(JSON.parse(JSON.stringify(jsonData)));

                                            // `4` is the index of the instruction which interacts with Candy Machine V2 
                                            const instruction = instructionItem.account.instructions[0];
                                            const hexString = instruction.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
                                            const decodedIx = borshCoder.instruction.decode(hexString, 'hex')
                                            //const decodedIx = borshCoder.instruction.decode(instruction.data, 'base58')
                                            
                                            console.log("decodedIx: "+JSON.stringify(decodedIx));
                                            let description = "";
                                            let u64BigInt, u64Number;

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

                                            //const buffer = Buffer.from(instructionItem.account.instructions[0].data);
                                            const newObject = {
                                                type:"DCA Program by Jupiter",
                                                description:description,
                                                decodedIx:decodedIx,
                                                data:instructionItem.account.instructions[0].data
                                            };
                                            instructionItem.account.instructions[0].info = newObject;
                                        }

                                        //console.log("instructionItem.account.instructions[0] "+JSON.stringify(instructionItem.account.instructions[0]))
                                        //console.log("instructionItem.account.instructions[0].data "+JSON.stringify(instructionItem.account.instructions[0].data))
                                        //const buffer = Buffer.from(instructionItem.account.instructions[0].data);
                                        //console.log("instructionItem.account.instructions[0].data "+buffer.toString("utf-8"))


                                    }else if (programId === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"){
                                        if (instructionItem.account.instructions[0]?.data){
                                            const buffer = Buffer.from(instructionItem.account.instructions[0].data);
                                            const newObject = {
                                                type:"Memo",
                                                description:buffer.toString("utf-8"),
                                                data:instructionItem.account.instructions[0].data
                                            };
                                            instructionItem.account.instructions[0].info = newObject;
                                        }
                                    }
                                }
                            }
                        }

                        if (ataArray && ataArray.length <= 100 ){ // to fix add support for over 100 records for gma
                            const owners = await connection.getMultipleParsedAccounts(ataArray);
                            setInstructionOwnerRecord(owners.value);
                            setInstructionOwnerRecordATA(ataArray);
                        }
                        
                    }
                    
                    
                }
            }
        }

        const voteResults = voteRecord;//JSON.parse(JSON.stringify(voteRecord));
        //console.log("1 here.. " + JSON.stringify(voteResults))
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
                            voterVotes = +(item.account?.voterWeight.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                            castedYes += +(item.account?.voterWeight.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                        }else{
                            uNo++;
                            voterVotes = -1 * +(item.account?.voterWeight.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                            castedNo += +(item.account?.voterWeight.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                        }
                    } else{
                        if (item.account.voteWeight.yes && item.account.voteWeight.yes > 0){
                            uYes++;
                            voterVotes = +(item.account?.voteWeight?.yes.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                            castedYes += +(item.account?.voteWeight?.yes.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                        } else{
                            uNo++;
                            voterVotes = -1 * +(item.account?.voteWeight?.no.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                            castedNo += +(item.account?.voteWeight?.no.toNumber() / Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0);
                        }
                    }

                    if (publicKey){

                        if (publicKey.toBase58() === item.account.governingTokenOwner.toBase58()){
                            setHasVoted(true);
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
                            voterWeight:(item.account?.voterWeight ?  item.account?.voterWeight.toNumber() : null),
                            legacyYes:(item.account?.voteWeight?.yes ?  item.account?.voteWeight?.yes.toNumber() : null),
                            legacyNo:(item.account?.voteWeight?.no ?  item.account?.voteWeight?.no.toNumber() : null),
                            decimals:td,
                            councilMint: realm.account?.config?.councilMint ? new PublicKey(realm.account?.config?.councilMint).toBase58() : null,
                            governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                        },
                        vote:{
                            vote:item.account.vote,
                            voterWeight:(item.account?.voterWeight ?  item.account?.voterWeight.toNumber() : null),
                            legacyYes:(item.account?.voteWeight?.yes ?  item.account?.voteWeight?.yes.toNumber() : null),
                            legacyNo:(item.account?.voteWeight?.no ?  item.account?.voteWeight?.no.toNumber() : null),
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
            const url = new URL(thisitem.account?.descriptionLink);
            const pathname = url.pathname;
            const parts = pathname.split('/');
            //console.log("pathname: "+pathname)
            let tGist = null;
            if (parts.length > 1)
                tGist = parts[2];
            
            setGist(tGist);
            
            const rpd = await resolveProposalDescription(thisitem.account?.descriptionLink);

            // Regular expression to match image URLs
            const imageUrlRegex = /https?:\/\/[^\s"]+\.(?:jpg|jpeg|gif|png)/gi;
            const stringWithPreviews = rpd.replace(imageUrlRegex, (match:any, imageUrl:any) => {
                return "![Image X]("+imageUrl+")";
            });
            

            setProposalDescription(rpd);
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
        
        setSolanaVotingResultRows(votingResults)
        //console.log("Vote Record: "+JSON.stringify(voteRecord));
        //console.log("This vote: "+JSON.stringify(thisitem));
        setLoadingParticipants(false);
    }

    function VoteForProposal(props:any){
        const type = props.type || 0;
        const multiChoice = props.multiChoice || null;

        /*
        console.log("memberMap: "+JSON.stringify(memberMap));
        const memberMapReduced = memberMap.reduce((map: any, item: any) => {
            //console.log("item: "+JSON.stringify(item.account.governingTokenOwner))
            //map.set(item.account.governingTokenOwner, item);
            map.set(item.pubkey, item);
            //console.log("map: "+JSON.stringify(map))
            return map;
        },new Map());

        const item = memberMap.find(item => 
            item.account.governingTokenOwner === "KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT"
            && item.account.governingTokenMint === thisitem.account.governingTokenMint);

        console.log("memberMap Item: "+JSON.stringify(item));
        */

        const isCommunityVote = propVoteType !== 'Council'; //realm.account.config?.councilMint?.toBase58() !== thisitem?.account.governingTokenMint;// realm?.communityMint === thisitem?.account.governingTokenMint;
        //console.log("isCommunityVote: "+JSON.stringify(isCommunityVote));
        
        const handleVoteYes = async () => {
            await handleVote(0)
        }

        const handleVoteNo = async () => {
            await handleVote(1)
        }

        const handleVote = async (type: Number) => {
            
            //console.log("thisitem.account.governingTokenMint: "+JSON.stringify(thisitem.account.governingTokenMint));

            const memberItem = memberMap.find(item => 
                (item.account.governingTokenOwner === publicKey.toBase58() && 
                item.account.governingTokenMint === thisitem.account.governingTokenMint.toBase58()));

            const memberItemSimple = memberMap.find(item => 
                    item.account.governingTokenOwner === publicKey.toBase58());
            
            //console.log("memberItemSimple: "+JSON.stringify(memberItemSimple));
            //console.log("memberItem: "+JSON.stringify(memberItem));

            //console.log("tokenOwnerRecord: "+JSON.stringify(thisitem.account.tokenOwnerRecord));
            
            const proposal = {
                governanceId: thisitem.account.governance,
                proposalId: thisitem.pubkey,
                tokenOwnerRecord: thisitem.account.tokenOwnerRecord,
                governingTokenMint: thisitem.account.governingTokenMint
            }
            const transactionData = {proposal:proposal,action:0} // 0 = yes
            //console.log("realm: "+JSON.stringify(realm));
            //console.log("thisitem/proposal: "+JSON.stringify(thisitem));
            //console.log("thisGovernance: "+JSON.stringify(thisGovernance));
            
            const realmData = {
                pubKey:thisGovernance.pubkey,
                realmId:thisitem.pubkey,
                governanceId:thisitem.account.governance,
                communityMint: thisitem.account.governingTokenMint
            }

            //console.log("Proposal: "+JSON.stringify(proposal));
            //console.log("realmData: "+JSON.stringify(realmData));
            //console.log("memberItem: "+JSON.stringify(memberItem));

            //console.log("memberMapReduced: "+JSON.stringify(memberMapReduced));

            // check if voter can participate

            if (publicKey && memberItem) {
                
                const vvvt = await createCastVoteTransaction(
                    realm,
                    publicKey,
                    transactionData,
                    memberItem,
                    null,
                    isCommunityVote,
                    multiChoice,
                    type
                );

                //console.log("vvvt: "+JSON.stringify(vvvt));
                
                if (vvvt){
                    try{
                        enqueueSnackbar(`Preparing to cast vote`,{ variant: 'info' });
                        const signature = await sendTransaction(vvvt, connection, {
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
                            'finalized'
                        );
                        closeSnackbar(cnfrmkey);
                        const action = (key:any) => (
                                <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                                    Signature: {signature}
                                </Button>
                        );
                        
                        enqueueSnackbar(`Congratulations, you have participated in voting for this Proposal`,{ variant: 'success', action });

                        // trigger a refresh here...
                        getVotingParticipants();
                    }catch(e:any){
                        enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                    } 
                } else{
                    alert("No voter record!")
                }
                
            }
        }

        return (
        <>
            {thisitem.account?.state === 2 && !hasVoted && publicKey &&
                <>
                    
                    {type === 0 ?
                        <Button
                            variant="outlined"
                            color='success'
                            onClick={handleVoteYes}
                            sx={{borderRadius:'17px',textTransform:'none'}}
                        >Vote{!multiChoice && ` YES`}</Button>
                    :
                        <Button
                            variant="outlined"
                            color='error'
                            onClick={handleVoteNo}
                            sx={{borderRadius:'17px',textTransform:'none'}}
                        >Vote NO</Button>
                    }
                </>
            }

            {hasVoted && publicKey &&
                <>
                    {(hasVotedVotes > 0 && type === 0) ?
                        <Tooltip title={`You casted ${getFormattedNumberToLocale(hasVotedVotes)} votes for this proposal`}>
                            <Button
                                variant="outlined"
                                color='success'
                                sx={{borderRadius:'17px',textTransform:'none'}}
                            ><CheckCircleIcon /></Button>
                        </Tooltip>
                    :
                        <>
                            {hasVotedVotes < 0 &&
                                <Tooltip title={`You casted ${getFormattedNumberToLocale(hasVotedVotes*-1)} votes against this proposal`}>
                                    <Button
                                        variant="outlined"
                                        color='error'
                                        sx={{borderRadius:'17px',textTransform:'none'}}
                                    ><CheckCircleIcon /></Button>
                                </Tooltip>
                            }
                        </>
                    }
                </>
            }
        </>);
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

    const getCachedGovernanceFromLookup = async () => {
        let cached_governance = new Array();
        //setCachedRealm(null);

        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){
                    //if (glitem?.realm)
                    //    setCachedRealm(glitem.realm);
                    if (glitem?.memberFilename){
                        const cached_members = await getFileFromLookup(glitem.memberFilename, storagePool);
                        setMemberMap(cached_members);
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
    }

    const validateGovernanceSetup = async() => {
        
        setLoadingValidation(true);

        if (!governanceLookup){
            const fglf = await fetchGovernanceLookupFile(storagePool);
            //console.log("fglf: "+JSON.stringify(fglf))
            setGovernanceLookup(fglf);
        }
        
        console.log("cachedGovernance: "+JSON.stringify(cachedGovernance))
        if (!cachedGovernance && governanceLookup){
            await getCachedGovernanceFromLookup();
        }
        
        if (!tokenMap){
            await getTokens();
        }
        var grealm = null;
        var realmPk = null;

        if (!thisitem && governanceLookup){
            console.log("Getting proposal via RPC");
            const prop = await getProposal(RPC_CONNECTION, new PublicKey(proposalPk));
            setThisitem(prop);
        }

        if (!realm){
            grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress));
            realmPk = new PublicKey(grealm?.pubkey);
            setRealm(grealm);
            setRealmName(grealm?.account?.name);
        } else{
            setRealmName(realm.account?.name);
        }
        if (!memberMap){
            const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
            setMemberMap(rawTokenOwnerRecords);
        }

        console.log("Completed Gov Prop setup")

        setLoadingValidation(false);
    } 

    React.useEffect(() => { 
        if (!loadingValidation){
            console.log("Step 1.")
            validateGovernanceSetup();
        }
    }, []);

    React.useEffect(() => { 
        
        if (!loadingValidation){
            console.log("Step 2.")
            validateGovernanceSetup();
        }
    }, [cachedGovernance, governanceLookup, loadingValidation]);

    /*
    React.useEffect(() => { 
        console.log("ok here...")
        if (!loadingValidation && cachedGovernance){
            console.log("B")
            validateGovernanceSetup();
        }
    }, [cachedGovernance]);
    */
    React.useEffect(() => { 
        
        if (cachedGovernance &&
            governanceLookup &&
            tokenMap &&
            memberMap &&
            thisitem &&
            realm){
            if (!loadingValidation){
                if (!loadingParticipants){
                    //console.log("C "+JSON.stringify(cachedGovernance))
                    console.log("Step 4.")
                    getVotingParticipants();
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
    }, [loadingValidation, thisitem, !thisGovernance, cachedGovernance, governanceLookup, tokenMap, memberMap, realm]);

    React.useEffect(() => {

        if (background)
            document.body.style.backgroundColor = background;
        if (textColor)
            document.body.style.color = textColor;
        
        if (thisitem && !loadingParticipants){
            console.log("Step 3.")
            getVotingParticipants();
        }
    }, [publicKey, loadingValidation, thisitem]);

    return (
        <>
            <ThemeProvider theme={grapeTheme}>
                <Box
                    height='100%'
                >

                {!loadingParticipants && thisitem ?
                    <>

                        {showGovernanceTitle && realmName && 
                            <Grid container>
                                <Grid item xs={12} sm={6} container justifyContent="flex-start">
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
                            </Grid>
                        }

                        {(showGovernanceTitle && proposalPk && realmName) ? 
                            <Grid container>
                                <Grid item xs={12} container justifyContent="flex-start">
                                    
                                    <ButtonGroup
                                        variant="outlined" 
                                        color='inherit'
                                    >
                                        <Tooltip title={`Back to  ${realmName} Governance`}>
                                            <Button 
                                                aria-label="back"
                                                variant="outlined" 
                                                color='inherit'
                                                href={`https://spl-gov.vercel.app/governance/${governanceAddress}`}
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
                                            text={`https://spl-gov.vercel.app/proposal/${governanceAddress}/${proposalPk}`} 
                                            onCopy={handleCopyClick}
                                        >
                                            <Tooltip title={`Copy ${realmName} Governance Propoosal Link`}>
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
                                    <Tooltip title={`Visit  ${realmName} on Realms`}>
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
                                                text={`https://spl-gov.vercel.app/proposal/${governanceAddress}/${proposalPk}`} 
                                                onCopy={handleCopyClick}
                                            >
                                                <Tooltip title={`Copy ${realmName} Governance Propoosal Link`}>
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

                                        <Tooltip title={`Visit  ${realmName} on Realms`}>
                                            <Button 
                                                aria-label="back"
                                                href={`https://realms.today/dao/${governanceAddress}/proposal/${thisitem?.pubkey}`}
                                                target='blank'
                                                sx={{
                                                    borderTopRightRadius:'17px',
                                                    borderBottomRightRadius:'17px',
                                                    borderColor:'rgba(255,255,255,0.05)',
                                                    fontSize:'10px'}}
                                            >
                                                <OpenInNewIcon fontSize='inherit' sx={{mr:1}} /> Realms
                                            </Button>
                                        </Tooltip>
                                    </ButtonGroup>
                                </Grid>
                            </Grid>                       
                        }


                        <Box sx={{ alignItems: 'center', textAlign: 'center',p:1}}>
                            <Typography variant='h5'>{thisitem.account?.name}</Typography>
                        </Box>
                        
                        {proposalAuthor &&
                            <Box sx={{ alignItems: 'center', textAlign: 'center'}}>
                                <Typography variant='body1'>Author: <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={proposalAuthor} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/></Typography>
                            </Box>
                        }
                        
                        <Box sx={{ alignItems: 'center', textAlign: 'center'}}>
                            {gist ?
                                <Box sx={{ alignItems: 'center', textAlign: 'left', p:1}}>
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
                        
                        {proposalInstructions &&
                            <Box 
                                sx={{ mt:2,mb:2 }}>
                                <Accordion 
                                    expanded={expanded === 'panel'+1} 
                                    onChange={handleChange('panel'+1)}
                                    className="panelibh-accordion"
                                >
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                        aria-controls="panelibh-content"
                                        className="panelibh-header"
                                        sx={{
                                            border:'none',
                                        }}
                                    >
                                        <Typography sx={{ flexShrink: 0 }}>
                                            Instructions 
                                        </Typography>
                                        
                                        <Typography sx={{ color: 'text.secondary' }}>&nbsp;{proposalInstructions.length}</Typography>
                                        
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Box>
                                            {(instructionTransferDetails && instructionTransferDetails.length > 0) &&
                                                <Box
                                                    sx={{
                                                        p:1,
                                                        borderRadius:'17px',
                                                        backgroundColor:'rgba(255,255,255,0.05)'}}
                                                >
                                                    <Typography variant="subtitle1">
                                                        Token Transfer Summary
                                                    </Typography>
                                                    <Typography variant="caption">

                                                        {Object.values(
                                                            instructionTransferDetails.reduce((result, item) => {
                                                                const { mint, amount, name, logoURI, destinationAta } = item;
                                                                if (!result[mint]) {
                                                                result[mint] = { mint, totalAmount: 0, name, logoURI, uniqueDestinationAta: new Set() };
                                                                }
                                                                result[mint].totalAmount += amount;
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
                                                                                hideTitle={false} style='text' color='white' fontSize='12px'/>
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
                                            {proposalInstructions && (proposalInstructions).map((item: any, index:number) => (
                                                <InstructionView instruction={item} index={index} instructionOwnerRecord={instructionOwnerRecord} instructionOwnerRecordATA={instructionOwnerRecordATA} />
                                            ))}
                                        </Timeline>
                                    </AccordionDetails>
                                </Accordion>
                            </Box>
                        }
                            
                        {propVoteType &&
                            <Box sx={{ alignItems: 'center', textAlign: 'center',p:1}}>
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
                                                                <VoteForProposal type={0} multiChoice={{index:mindex,proposal:thisitem}} />
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

                                                    {forVotes ? 
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
                                                    }              
                                                </Typography>
                                                <ButtonGroup variant="outlined" aria-label="outlined primary button group">
                                                    {thisitem.account?.options && thisitem.account?.options.length >= 0 ? 
                                                        <Button
                                                            color="success"
                                                            sx={{borderRadius:'17px'}}
                                                        >
                                                            <ThumbUpIcon color='success' fontSize='small' sx={{mr:1}} />
                                                            {forVotes ? getFormattedNumberToLocale(formatAmount((forVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.options[0].voteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                        </Button>
                                                        /*
                                                        <Chip variant='outlined' color='success'
                                                            icon={<ThumbUpIcon color='success' fontSize='small' sx={{ml:1}} />}
                                                            label={forVotes ? getFormattedNumberToLocale(formatAmount((forVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.options[0].voteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                        />
                                                        */
                                                    :
                                                        <>
                                                            {thisitem.account?.yesVotesCount && 
                                                                    <Button
                                                                        color="success"
                                                                        sx={{borderRadius:'17px'}}
                                                                    >
                                                                        <ThumbUpIcon color='success' fontSize='small' sx={{mr:1}} />
                                                                        {forVotes ? getFormattedNumberToLocale(formatAmount((forVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.yesVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                    </Button>
                                                                    /*
                                                                    <Chip variant='outlined' color='success'
                                                                        icon={<ThumbUpIcon color='success' fontSize='small' sx={{ml:1}} />}
                                                                        label={forVotes ? getFormattedNumberToLocale(formatAmount((forVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.yesVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                    />*/
                                                            }
                                                        </>
                                                    }

                                                    <VoteForProposal type={0} />
                                                </ButtonGroup>
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
                                                    {againstVotes ? 
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
                                                    }
                                                </Typography>
                                                <ButtonGroup variant="outlined" aria-label="outlined primary button group">
                                                    {thisitem.account?.denyVoteWeight ?
                                                        <Button
                                                                color="error"
                                                                sx={{borderRadius:'17px'}}
                                                            >
                                                                <ThumbDownIcon color='error' fontSize='small' sx={{mr:1}} />
                                                                {againstVotes ? getFormattedNumberToLocale(formatAmount((againstVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.denyVoteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                            </Button>
                                                        /*
                                                        <Chip variant='outlined' color='error'
                                                                icon={<ThumbDownIcon color='error' fontSize='small' sx={{ml:1}} />}
                                                                label={againstVotes ? getFormattedNumberToLocale(formatAmount((againstVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.denyVoteWeight)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                            />
                                                            */
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
                                                                /*
                                                                    <Chip variant='outlined' color='error'
                                                                        icon={<ThumbDownIcon color='error' fontSize='small' sx={{ml:1}} />}
                                                                        label={againstVotes ? getFormattedNumberToLocale(formatAmount((againstVotes))) : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.noVotesCount)/Math.pow(10, tokenDecimals)).toFixed(0)))}
                                                                    />
                                                                */
                                                            }
                                                        </>
                                                    }
                                                    <VoteForProposal type={1} />
                                                </ButtonGroup>
                                            </Box>
                                        </Grid>
                                    </Grid>
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
                                    
                                    <Grid item xs={12} sm={6} md={3} key={1}>
                                        <Box
                                            className='grape-store-stat-item'
                                            sx={{borderRadius:'24px',m:2,p:1}}
                                        >
                                            <Typography variant="body2">
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
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        color="inherit"
                                                        sx={{borderRadius:'17px'}}
                                                    >{propVoteType}</Button>
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
                                                            <>
                                                            {getFormattedNumberToLocale(formatAmount(+forVotes + +againstVotes))}
                                                            </>
                                                        {/*

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
                                                        */}
                                                    
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
                                                <Tooltip title='Unique For Voters / Unique Against Voters'>
                                                    <Button
                                                        sx={{borderRadius:'17px'}}
                                                        variant="text"
                                                        color="inherit"
                                                    >
                                                        {uniqueYes} / {uniqueNo}
                                                        {/*
                                                        <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{uniqueYes}</Badge>/
                                                        <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{uniqueNo}</Badge>
                                                        */}
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
                                            {/*ButtonGroup size="small" color='inherit'>
                                                {/*jsonGenerated &&
                                                    <Tooltip title="Download Voter Participation JSON file">
                                                        <Button
                                                            sx={{borderBottomLeftRadius:'17px',borderTopLeftRadius:'17px'}}
                                                            download={`${thisitem.pubkey.toBase58()}.csv`}
                                                            href={jsonGenerated}
                                                        >
                                                            <DownloadIcon /> JSON
                                                        </Button>
                                                    </Tooltip>
                                                */}

                                                {csvGenerated &&
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
                                                }
                                            {/*</ButtonGroup>*/}
                                            
                                            </Typography>
                                        </Box>
                                    </Grid>

                                    {thisitem.account?.draftAt &&
                                        <Grid item xs={12} sm={6} md={3} key={1}>
                                            <Box
                                                className='grape-store-stat-item'
                                                sx={{borderRadius:'24px',m:2,p:1}}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Started At</>
                                                </Typography>
                                                <Typography variant="subtitle2">
                                                    {moment.unix(Number(thisitem.account?.draftAt)).format("MMMM D, YYYY, h:mm a")}
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
                                                {(thisitem.account?.votingCompletedAt && thisitem.account?.votingCompletedAt > 0) ?
                                                    <>Ended At</>
                                                :
                                                    <>Ends At</>
                                                }
                                            </Typography>
                                            <Typography variant="subtitle2">
                                                    {thisGovernance && thisGovernance?.account?.config?.baseVotingTime ?
                                                        <>
                                                            {thisitem.account?.draftAt &&
                                                                `${moment.unix(Number(thisitem.account.draftAt)+(Number(thisGovernance.account.config.baseVotingTime))).format("MMMM D, YYYY, h:mm a")}`
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
                                                    {thisGovernance && thisGovernance?.account?.config?.baseVotingTime ?
                                                        <>
                                                            {thisitem.account?.draftAt &&
                                                                <>
                                                                    {thisitem.account?.votingCompletedAt ?
                                                                        `${moment.unix(Number(thisitem.account.draftAt)+Number(thisGovernance.account?.config.baseVotingTime)).fromNow()}`
                                                                    :
                                                                        `Ending ${moment.unix(Number(thisitem.account.draftAt)+Number(thisGovernance.account.config.baseVotingTime)).fromNow()}`
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
                                                        {GOVERNANCE_STATE[thisitem.account?.state]}
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