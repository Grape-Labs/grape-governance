import { 
    getGovernanceAccounts,
    pubkeyFilter,
    ProposalTransaction,
    getNativeTreasuryAddress } from '@solana/spl-governance';
import { Buffer } from 'buffer';
import DOMPurify from "dompurify";
import { 
        getRealmIndexed,
        getProposalIndexed,
        getVoteRecordsIndexed,
        getProposalNewIndexed,
        getAllProposalsIndexed,
        getGovernanceIndexed,
        getAllGovernancesIndexed,
        getAllTokenOwnerRecordsIndexed,
        getProposalInstructionsIndexed,
} from './api/queries';
import { VoteKind } from "@solana/spl-governance";
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import { Helmet } from 'react-helmet';
import axios from "axios";
import BN from 'bn.js'
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import {
    AccountLayout,
    getMint, 
    TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token-v2";
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction, SystemInstruction } from '@solana/web3.js';
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
import removeInvalidImages from './removeInvalidImages';

import { GrapeVerificationSpeedDial } from './plugins/instructions/GrapeVerificationSpeedDial';
import { GrapeVerificationDAO } from './plugins/instructions/GrapeVerificationDAO';
import ErrorBoundary from './ErrorBoundary';
import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernancePower from './GovernancePower';
import GovernanceDiscussion from './GovernanceDiscussion';
import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Link, useParams, useSearchParams } from "react-router-dom";

//import BufferLayout from 'buffer-layout';
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
  TextareaAutosize,
  Stack,
  useMediaQuery,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';
 
import { IntegratedGovernanceProposalDialogView } from './IntegratedGovernanceProposal';
import { getAllProposalSignatoryRecords, getAllProposalSignatories, ManageGovernanceProposal } from './ManageGovernanceProposal';
import { VoteForProposal } from './GovernanceVote';

import { VetoVoteRow } from './GovernanceVetoVote';
import { InstructionTableView } from './GovernanceInstructionTableView';
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import ShareIcon from '@mui/icons-material/Share';
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
    SHYFT_KEY,
    HELIUS_API,
    BLACKLIST_WALLETS,
    GIST_LOGO } from '../utils/grapeTools/constants';
import { 
    formatAmount, 
    getFormattedNumberToLocale,
    VSR_PLUGIN_PKS } from '../utils/grapeTools/helpers'

import { RenderDescription } from './RenderDescription';

//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

function trimAddress(addr: string) {
    if (!addr) return addr;
    const start = addr.substring(0, 8);
    const end = addr.substring(addr.length - 4);
    return `${start}...${end}`;
}

const SUPPLY_FRACTION_BASE = new BN('10000000000');

function toNumberOrNull(value: any): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
}

function toBase58Safe(value: any): string {
    try {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (value?.toBase58) return value.toBase58();
        return String(value);
    } catch {
        return "";
    }
}

function getSupplyFractionPercentage(source: any, fallback?: any): number | null {
    try {
        if (source && Number(source?.type) === 0 && source?.value !== undefined && source?.value !== null) {
            const raw = new BN(source.value.toString());
            // SPL Governance percent = (supplyFraction / 10_000_000_000) * 100
            const percent = raw.mul(new BN(10000)).div(SUPPLY_FRACTION_BASE).toNumber() / 100;
            return percent;
        }
    } catch (e) {
        console.log("ERR: getSupplyFractionPercentage source parse", e);
    }

    if (fallback !== undefined && fallback !== null) {
        const fallbackStr = typeof fallback === 'string' ? fallback.replace(/,/g, '') : fallback;
        return toNumberOrNull(fallbackStr);
    }

    return null;
}

const parseRawVoteWeight = (raw: any): bigint => {
    try {
        if (raw === null || raw === undefined) return 0n;
        if (typeof raw === 'bigint') return raw;
        if (typeof raw === 'number') {
            if (!Number.isFinite(raw)) return 0n;
            return BigInt(Math.trunc(raw));
        }
        if (typeof raw === 'string') {
            const value = raw.trim();
            if (!value) return 0n;
            if (value.startsWith('0x') || value.startsWith('0X')) return BigInt(value);
            if (/^-?\d+$/.test(value)) return BigInt(value);
            const n = Number(value);
            return Number.isFinite(n) ? BigInt(Math.trunc(n)) : 0n;
        }
        return BigInt(raw?.toString?.() || 0);
    } catch {
        return 0n;
    }
};

const voteWeightToUi = (raw: any, decimals = 0): number => {
    const d = Math.max(0, Number(decimals || 0));
    const value = parseRawVoteWeight(raw);
    if (d === 0) return Number(value);
    const base = 10n ** BigInt(d);
    const whole = value / base;
    const frac = value % base;
    return Number(whole) + Number(frac) / Math.pow(10, d);
};

const formatCompactNumber = (value: any): string => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    const compact = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 2,
    }).format(n);
    return compact.replace(/K/g, 'k').replace(/M/g, 'm').replace(/B/g, 'b').replace(/T/g, 't');
};

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
    const [irys, setIrys] = React.useState<string | null>(null);
    const [irysUrl, setIrysUrl] = React.useState<string | null>(null);
    const [irysLoading, setIrysLoading] = React.useState(false);
    const [irysHtml, setIrysHtml] = React.useState<string | null>(null);
    const [irysError, setIrysError] = React.useState<string | null>(null);
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
    const [openDiscussion, setOpenDiscussion] = React.useState(false);
    const [expandInfo, setExpandInfo] = React.useState(false);
    const [reload, setReload] = React.useState(false);
    const [governanceRules, setGovernanceRules] = React.useState(null);
    const [governanceNativeWallet, setGovernanceNativeWallet] = React.useState(null);

    const [verifiedDestinationWalletArray, setVerifiedDestinationWalletArray] = React.useState(null);
    const [verifiedDAODestinationWalletArray, setVerifiedDAODestinationWalletArray] = React.useState(null);
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [councilVoterRecord, setCouncilVoterRecord] = React.useState<any | null>(null);

    const [loadingMessage, setLoadingMessage] = React.useState(null);

    const [vetoCount, setVetoCount] = React.useState<number | null>(null);
    const [vetoVoters, setVetoVoters] = React.useState<any[]>([]);

    const normalizePkString = React.useCallback((value: any): string | null => {
        try {
            if (!value) return null;
            if (typeof value === "string") return new PublicKey(value).toBase58();
            if (value?.toBase58) return value.toBase58();
            return new PublicKey(value).toBase58();
        } catch {
            try {
                return typeof value === "string" ? value : String(value);
            } catch {
                return null;
            }
        }
    }, []);

    const tokenOwnerRecordToAuthor = React.useMemo(() => {
        const map = new Map<string, string>();
        if (!Array.isArray(memberMap)) return map;
        for (const member of memberMap) {
            const tor = normalizePkString(member?.pubkey);
            const owner = normalizePkString(member?.account?.governingTokenOwner);
            if (tor && owner && !map.has(tor)) {
                map.set(tor, owner);
            }
        }
        return map;
    }, [memberMap, normalizePkString]);

    const tokenOwnerRecordToMember = React.useMemo(() => {
        const map = new Map<string, any>();
        if (!Array.isArray(memberMap)) return map;
        for (const member of memberMap) {
            const tor = normalizePkString(member?.pubkey);
            if (tor && !map.has(tor)) {
                map.set(tor, member);
            }
        }
        return map;
    }, [memberMap, normalizePkString]);

    const getProposalAuthorAddress = React.useCallback((item: any): string | null => {
        const direct = normalizePkString(item?.account?.governingTokenOwner);
        if (direct) return direct;

        const tor = normalizePkString(item?.account?.tokenOwnerRecord);
        if (tor && tokenOwnerRecordToAuthor.has(tor)) {
            return tokenOwnerRecordToAuthor.get(tor) || null;
        }
        return null;
    }, [normalizePkString, tokenOwnerRecordToAuthor]);

    const proposalAuthorAddress = React.useMemo(() => {
        const fromState = normalizePkString(proposalAuthor);
        if (fromState) return fromState;
        return getProposalAuthorAddress(thisitem);
    }, [proposalAuthor, normalizePkString, getProposalAuthorAddress, thisitem]);

    const authorVetoedProposalCount = React.useMemo(() => {
        if (!proposalAuthorAddress) return 0;
        const source = Array.isArray(cachedGovernance) && cachedGovernance.length > 0
            ? cachedGovernance
            : (thisitem ? [thisitem] : []);
        let count = 0;
        for (const proposal of source) {
            if (Number(proposal?.account?.state) !== 9) continue;
            const author = getProposalAuthorAddress(proposal);
            if (author && author === proposalAuthorAddress) {
                count++;
            }
        }
        return count;
    }, [proposalAuthorAddress, cachedGovernance, thisitem, getProposalAuthorAddress]);

    const AUTHOR_VETO_WARNING_THRESHOLD = 5;
    const isFlaggedMaliciousAuthor = authorVetoedProposalCount >= AUTHOR_VETO_WARNING_THRESHOLD;

    const authorVotingMeta = React.useMemo(() => {
        const author = proposalAuthorAddress;
        const proposalMint = normalizePkString(thisitem?.account?.governingTokenMint);
        const councilMint = normalizePkString(realm?.account?.config?.councilMint);
        const isCouncil = !!councilMint && !!proposalMint && councilMint === proposalMint;
        const proposalTypeLabel = isCouncil ? 'Council' : 'Community';
        const voteDecimals = isCouncil ? 0 : Number(tokenDecimals ?? votingDecimals ?? 0);

        const tor = normalizePkString(thisitem?.account?.tokenOwnerRecord);
        let memberRecord: any = null;
        if (tor && tokenOwnerRecordToMember.has(tor)) {
            memberRecord = tokenOwnerRecordToMember.get(tor);
        } else if (author && Array.isArray(memberMap)) {
            memberRecord = memberMap.find((member: any) => {
                const owner = normalizePkString(member?.account?.governingTokenOwner);
                const mint = normalizePkString(member?.account?.governingTokenMint);
                return owner === author && mint === proposalMint;
            }) || null;
        }

        const rawDeposit = memberRecord?.account?.governingTokenDepositAmount;
        const votingPower = voteWeightToUi(rawDeposit || 0, voteDecimals);

        return {
            author,
            proposalTypeLabel,
            voteDecimals,
            votingPower,
            hasMemberRecord: !!memberRecord,
        };
    }, [
        proposalAuthorAddress,
        thisitem,
        realm,
        tokenDecimals,
        votingDecimals,
        tokenOwnerRecordToMember,
        memberMap,
        normalizePkString,
    ]);

    const authorInlineMeta = React.useMemo(() => {
        const powerLabel = `${authorVotingMeta.proposalTypeLabel} power ${formatCompactNumber(authorVotingMeta.votingPower)}`;
        const vetoLabel = isFlaggedMaliciousAuthor
            ? ` • vetoed ${authorVetoedProposalCount}`
            : '';
        return `${powerLabel}${vetoLabel}`;
    }, [authorVotingMeta, isFlaggedMaliciousAuthor, authorVetoedProposalCount]);


    const [snack, setSnack] = React.useState({ open: false, msg: "" });
    const showSnack = (msg) => setSnack({ open: true, msg });
    const closeSnack = (_, reason) => { if (reason !== "clickaway") setSnack({ open: false, msg: "" }); };

    const proposalUrl = `https://governance.so/proposal/${governanceAddress}/${proposalPk}`;
    const realmsUrl = `https://realms.today/dao/${governanceAddress}/proposal/${thisitem?.pubkey}`;

    const handleShare = () => {
    if (navigator.share) {
        navigator
        .share({
            title: `${realmName || "DAO"} Governance Proposal`,
            text: `Check out this governance proposal on ${realmName || "this DAO"}:`,
            url: proposalUrl,
        })
        .catch(() => {});
    } else {
        showSnack("Sharing isn’t supported in this browser. Link copied instead.");
        try {
        navigator.clipboard?.writeText?.(proposalUrl);
        } catch (e) {}
    }
    };

    const handleCopy = () => {
    handleCopyClick?.();
    showSnack("Link copied");
    };

    const toggleInfoExpand = () => {
        setExpandInfo(!expandInfo)
    };
    

    const handleClickOpenInstructions = () => {
        setOpenInstructions(!openInstructions);
    }

    const handleClickOpenDiscussion = () => {
        setOpenDiscussion(!openDiscussion);
    }

    const handleCopyClick = () => {
        enqueueSnackbar(`Copied!`,{ variant: 'success' });
    };

    async function fetchIrysText(url: string) {
        const res = await fetch(url, {
            headers: { Accept: "text/html,text/plain,*/*" },
        });
        if (!res.ok) throw new Error(`Irys fetch failed (${res.status})`);
        return await res.text();
    }

    function stripHtmlToText(html: string) {
        const div = document.createElement("div");
        div.innerHTML = html;
        return (div.textContent || div.innerText || "").trim();
    }

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

    const getCouncilTorForWallet = React.useCallback(() => {
        try {
            if (!publicKey) return null;
            const councilMint = realm?.account?.config?.councilMint;
            if (!councilMint) return null;

            const my58 = publicKey.toBase58();
            const councilMint58 = councilMint.toBase58();

            const list: any[] = memberMap || [];
            return (
            list.find(
                (r: any) =>
                r?.account?.governingTokenOwner?.toBase58?.() === my58 &&
                r?.account?.governingTokenMint?.toBase58?.() === councilMint58
            ) || null
            );
        } catch {
            return null;
        }
        }, [publicKey, realm, memberMap]);

    const getGovernanceProps = async () => {
        let governance_item = null;
        let governance = null;
        
        setLoadingMessage("Loading Governance...");

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
            
            setLoadingMessage("Loading Governance Mint...");
            setGoverningMintInfo(governingMintDetails);
            
            const communityWeight = governingMintDetails.value.data.parsed.info.supply - Number(realm.account.config.minCommunityTokensToCreateGovernance);
            console.log("communityWeight: "+communityWeight);
            
            const communityMintMaxVoteWeightSource = realm.account.config?.communityMintMaxVoteWeightSource

            console.log("communityMintMaxVoteWeightSource: "+JSON.stringify(communityMintMaxVoteWeightSource));
            const supplyFractionPercentage = getSupplyFractionPercentage(
                communityMintMaxVoteWeightSource,
                governance_item?.communityFmtSupplyFractionPercentage
            );

            // check if we have this cached
            console.log("supplyFractionPercentage: "+JSON.stringify(supplyFractionPercentage))
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

    const fetchOwnerRecord = (recordpk:any) => {
        var index = 0;
        if (instructionOwnerRecordATA){
            for (var item of instructionOwnerRecordATA){
                if (new PublicKey(item).toBase58() === new PublicKey(recordpk).toBase58()){
                    if (instructionOwnerRecord[index]?.data?.parsed?.info){
                        return instructionOwnerRecord[index].data.parsed.info;
                        //setOwnerRecord(instructionOwnerRecord[index].data.parsed.info);
                    }
                }
                index++;
            }
        }
    }

    const fetchTokenName = async(address:string) => {
        try{
            if (HELIUS_API){
                const uri = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API}`;
                const response = await fetch(uri, {
                    method: 'POST',
                    headers: {
                    "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "id": "text",
                    "method": "getAsset",
                    "params": {
                        id: address,
                    }
                    }),
                });
                /*
                const uri = `https://rpc.shyft.to/?api_key=${SHYFT_KEY}`;
                const response = await fetch(uri, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'rpc-id',
                        method: 'getAsset',
                        params: {
                            id: address
                        },
                    }),
                    });
                    */ 
                const { result } = await response.json();
                
                if (result){
                    if (result?.content?.metadata?.name){
                        //setSolanaDomain(result?.content?.metadata?.name);
                        return result?.content?.metadata?.name;
                        //setDaoName(result.content.metadata.name);
                    }
                    return null;
                }
            }
        } catch(e){
            console.log("ERR: "+e);
        }
    }

    function escapeCSV(value) {
        if (value == null) {
            return '';
        }
        const stringValue = value.toString();
        // Check if the value contains any characters that need escaping
        if (/[",\n\r]/.test(stringValue)) {
            // Escape double quotes by replacing " with ""
            const escaped = stringValue.replace(/"/g, '""');
            // Enclose the field in double quotes
            return `"${escaped}"`;
        }
        return stringValue;
    }

    const extractFirstHttpUrl = (value?: string | null): string | null => {
        if (!value) return null;
        const trimmed = value.trim();
        if (!trimmed) return null;

        try {
            return new URL(trimmed).toString();
        } catch {
            // Fall through to extracting embedded URLs from mixed text.
        }

        const match = trimmed.match(/https?:\/\/[^\s<>"')\]]+/i);
        if (!match?.[0]) return null;
        const candidate = match[0].replace(/[.,;!?]+$/, '');

        try {
            return new URL(candidate).toString();
        } catch {
            return null;
        }
    };

    const getVotingParticipants = async () => {
        setLoadingParticipants(true);

        let td = 0; // this is the default for NFT mints
        let vType = null;


        setLoadingMessage("Loading Voting Participants...");
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
            //console.log("memberMap "+memberMap.length);
            if (memberMap){
                let count = 0;

                for (const item of memberMap){
                    //console.log("looping "+count++);
                    if (item && item.pubkey && item.pubkey?.toBase58()){
                        //console.log("checking tokenOwnerRecord: "+thisitem.account.tokenOwnerRecord);
                        //console.log("checking: "+item.pubkey)
                        if (new PublicKey(item.pubkey).toBase58() === new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()){
                            setProposalAuthor(item.account.governingTokenOwner.toBase58())
                            console.log("member:" + JSON.stringify(item));
                        }
                    } else{
                        if (new PublicKey(item.pubkey).toBase58() === new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()){
                            setProposalAuthor(new PublicKey(item.account.governingTokenOwner).toBase58())
                            console.log("member:" + JSON.stringify(item));
                        }
                    } 
                    
                }
            }
        }

        // get all signatories
        //if (thisitem.account.state === 0 || thisitem.account.state === 1){
            //console.log("signatories: "+thisitem.account.signatoriesCount);

            if (thisitem.account.signatoriesCount > 0){
                // how many signed off? check signatoriesSignedOffCount
                //console.log("test "+new PublicKey(thisitem.owner || realm.owner).toBase58());
                //alert("Getting signatories");
                
                setLoadingMessage("Loading Additional Signatory Records...");
                const allSignatoryRecords = await getAllProposalSignatoryRecords(new PublicKey(thisitem.owner || realm.owner), new PublicKey(thisitem.pubkey), new PublicKey(governanceAddress))
                console.log("allSignatoryRecords: "+JSON.stringify(allSignatoryRecords));
                setProposalSignatories(allSignatoryRecords)
            }
        //}

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


        setLoadingMessage("Loading Governances...");

        //if (!vresults){
            //const gp = await getProposal(RPC_CONNECTION, thisitem.pubkey);
            const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddress, thisitem?.owner);
            const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
        
        setLoadingMessage("Loading Proposal...");
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
                let isFresh = true;
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
                    console.log("Start getVoteRecord");

                    // these are the voting participants lets fetch this via graphql now

                    from_cache = false;

                    setLoadingMessage("Loading Vote Records...");
                    const voteRecords = await getVoteRecordsIndexed(
                        thisitem.pubkey,
                        (thisitem.owner || realm.owner),
                        governanceAddress
                    );

                    if (voteRecords?.value){
                        voteRecord = voteRecords.value;//JSON.parse(JSON.stringify(voteRecord));
                    } else if (voteRecords){
                        voteRecord = voteRecords;
                    }

                    console.log("End getVoteRecords");
                    
                    //console.log("voteRecord: "+JSON.stringify(voteRecord));
                    
                } else{
                    console.log("Fetching proposal results via Cached Storage")
                    // check if our storage is fresh vs the ending time of the proposal
                    console.log("vresults "+JSON.stringify(vresults.account.signingOffAt))
                    
                    from_cache = true;
                }

                
                // if this is voting we should fetch via RPC
                let instructions = null;
                const hasIndexedInstructionHint =
                    Array.isArray(thisitem?.account?.options) &&
                    thisitem.account.options.some(
                        (option: any) => Number(option?.instructionsCount || 0) > 0
                    );
                const expectedInstructionCount =
                    Array.isArray(thisitem?.account?.options)
                        ? thisitem.account.options.reduce(
                              (sum: number, option: any) => sum + Number(option?.instructionsCount || 0),
                              0
                          )
                        : 0;
                const cachedInstructionCount = Array.isArray(thisitem?.instructions)
                    ? thisitem.instructions.length
                    : 0;
                const hasLikelyStaleInstructionCache =
                    expectedInstructionCount > 0 &&
                    cachedInstructionCount > 0 &&
                    cachedInstructionCount < expectedInstructionCount;
                
                if (
                    !Array.isArray(thisitem?.instructions) ||
                    (hasIndexedInstructionHint && thisitem.instructions.length === 0) ||
                    hasLikelyStaleInstructionCache
                ) {

                    setLoadingMessage("Loading Proposal Instructions...");
                    //instructions = await getProposalInstructionsIndexed(governanceAddress, new PublicKey(thisitem.pubkey).toBase58());
                    /*
                    const test = await getGovernanceAccounts(
                                RPC_CONNECTION,
                                new PublicKey(thisitem.owner || realm.owner),
                                ProposalTransaction,
                                [pubkeyFilter(1, new PublicKey(proposalPk))!]
                            );
                    console.log("test: "+JSON.stringify(test));
                    */      
                    instructions = await getProposalInstructionsIndexed(governanceAddress, new PublicKey(thisitem.pubkey).toBase58());
                    thisitem.instructions = instructions;
                }

                if (thisitem?.instructions){
                    let useInstructions = thisitem.instructions;
                    //console.log("ix index: "+JSON.stringify(useInstructions));
                    useInstructions = useInstructions.sort((a:any, b:any) => b?.account.instructionIndex < a?.account.instructionIndex ? 1 : -1); 
                    
                    //useInstructions = useInstructions.reverse();

                    setProposalInstructions(useInstructions);
                    
                    var ataArray = new Array();
                    if (useInstructions){
                        let cnt = 0;
                            
                        
                    
                        // Collect all unique mint PublicKeys from useInstructions
                        const mintSet = new Set<string>();

                        for (const instructionItem of useInstructions) {
                        for (const accountInstruction of instructionItem.account.instructions) {
                            const pubkey = accountInstruction.accounts?.[0]?.pubkey;
                            if (pubkey) {
                            mintSet.add(pubkey); // use string form to prevent duplicate PublicKey instances
                            }
                        }
                        }

                        // Convert Set to array of PublicKey objects
                        const mintArr = Array.from(mintSet, (key) => new PublicKey(key));

                        // Fetch parsed accounts
                        let mintResults = [];

                        if (mintArr.length > 0) {
                        const { value } = await RPC_CONNECTION.getMultipleParsedAccounts(mintArr);
                        mintResults = value?.filter(Boolean) || [];
                        }
                        /*
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
                        if (mintArr && mintArr?.length > 0){
                            const results = await RPC_CONNECTION.getMultipleParsedAccounts(mintArr);
                            mintResults = results.value;
                            //console.log("mintArrResults: "+JSON.stringify(mintResults));
                        }
                        */
                        
                        // === Add this before your loop ===

                        const uniquePubkeys = new Set();
                        // Step 1: Collect unique and valid pubkeys from accountInstruction.accounts[0]
                        for (const instructionItem of useInstructions) {
                            if (instructionItem.account?.instructions?.length > 0) {
                                for (const accountInstruction of instructionItem.account.instructions) {
                                    const rawPubkey = accountInstruction.accounts?.[0]?.pubkey;
                                    if (rawPubkey) {
                                        try {
                                            const key = new PublicKey(rawPubkey).toBase58();
                                            uniquePubkeys.add(key); // Set ensures uniqueness
                                        } catch (e) {
                                            console.warn("Invalid pubkey:", rawPubkey, e);
                                        }
                                    }
                                }
                            }
                        }

                        // Step 2: Batch fetch all accounts using getMultipleAccountsInfo
                        const pubkeyList = [...uniquePubkeys].map(key => new PublicKey(key));
                        const allResults = new Map();
                        const chunkSize = 100;

                        for (let i = 0; i < pubkeyList.length; i += chunkSize) {
                            const chunk = pubkeyList.slice(i, i + chunkSize);
                            const infos = await connection.getMultipleAccountsInfo(chunk);
                            chunk.forEach((key, idx) => {
                                allResults.set(key.toBase58(), infos[idx]);
                            });
                        }

                        
                        let lastMint = null;
                        let lastMintName = null;
                        let lastMintDecimals = null;
                        let thisMint = null;
                        let thisMintName = null;
                        let thisMintDecimals = null;
                        
                        for (var instructionItem of useInstructions){
                            
                            setLoadingMessage(`Loading Instruction ${cnt+1} of ${useInstructions.length}...`);

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

                                const U64 = (buf: number[] | Uint8Array, offset = 0) =>
                                new BN(Buffer.from(buf).slice(offset, offset + 8), "le");
                                const U32 = (buf: number[] | Uint8Array, offset = 0) =>
                                new BN(Buffer.from(buf).slice(offset, offset + 4), "le");

                                const toDecimalAmount = (amountBN: BN, decimals: number) => {
                                    if (decimals <= 0) return amountBN.toString(); // integer
                                    const base = new BN(10).pow(new BN(decimals));
                                    // avoid toNumber() overflow: do a decimal string
                                    const q = amountBN.div(base).toString();
                                    const r = amountBN.mod(base).toString().padStart(decimals, "0").replace(/0+$/, "");
                                    return r.length ? `${q}.${r}` : q;
                                };

                                const formatAmount = (s: string, minFrac = 2, maxFrac = 6) => {
                                    if (!s.includes(".")) return Number(s).toLocaleString();
                                    const n = Number(s);
                                    return n.toLocaleString(undefined, { minimumFractionDigits: minFrac, maximumFractionDigits: maxFrac });
                                };
                                
                                const shortPk = (pk?: unknown): string => {
                                    if (typeof pk !== 'string') return '—';
                                    if (pk.length <= 8) return pk;
                                    return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
                                };

                                for (var accountInstruction of instructionItem.account.instructions){
                                    //if (instructionItem?.account?.instructions[0].data && instructionItem.account.instructions[0].data.length > 0){
                                        const typeOfInstruction = accountInstruction.data[0];
                                        //console.log("instructionDetails "+JSON.stringify(instructionDetails))
                                        let programId = "";
                                        try {
                                            programId = new PublicKey(
                                                accountInstruction?.programId ||
                                                    instructionItem?.account?.instructions?.[0]?.programId
                                            ).toBase58();
                                        } catch {
                                            programId = "";
                                        }
                                        const instructionInfo = InstructionMapping?.[programId]?.[typeOfInstruction];
                                        const instructionPubkey =
                                            instructionItem?.pubkey?.toBase58?.() || `${instructionItem?.pubkey ?? ""}`;
                                        const instructionSourcePubkey =
                                            accountInstruction?.accounts?.[0]?.pubkey?.toBase58?.() ||
                                            `${accountInstruction?.accounts?.[0]?.pubkey ?? ""}`;
                                        const instructionDataHex = Buffer.from(accountInstruction?.data || []).toString("hex");
                                        const instructionDetailKey = `${instructionPubkey}:${programId}:${instructionSourcePubkey}:${instructionDataHex}`;
                                        const appendInstructionTransferDetail = (newObject: any) => {
                                            if (!newObject || !setInstructionTransferDetails) return;
                                            const normalizedObject = {
                                                ...newObject,
                                                ix: newObject?.ix || instructionPubkey,
                                                _detailKey: instructionDetailKey,
                                            };
                                            setInstructionTransferDetails((prevArray: any[]) => {
                                                const existing = Array.isArray(prevArray) ? prevArray : [];
                                                if (existing.some((obj: any) => obj?._detailKey === instructionDetailKey)) {
                                                    return existing;
                                                }
                                                return [...existing, normalizedObject];
                                            });
                                        };
                                        
                                        if (programId === "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"){//(instructionInfo?.name === "Token Transfer"){

                                            // check if we have this in gai
                                            let gai = null;
                                            if (mintResults && mintResults.length > 0){
                                                gai = mintResults[cnt];
                                            } 

                                            if (!gai){
                                                //gai = await connection.getParsedAccountInfo(new PublicKey(accountInstruction.accounts[0].pubkey))
                                            
                                                // === Inside your main loop, REPLACE this ===
                                                // gai = await getParsedAccountInfoCached(new PublicKey(accountInstruction.accounts[0].pubkey));

                                                // === WITH this ===
                                                const pubkey = new PublicKey(accountInstruction.accounts[0].pubkey);
                                                gai = allResults.get(pubkey.toBase58());

                                                // === Also replace: ===
                                                // let tai = await getParsedAccountInfoCached(tokenMintAccount);
                                                // === WITH ===
                                                //const tai = allResults.get(tokenMintAccount.toBase58());

                                                // If tokenMintAccount is not guaranteed to be in the original set, you can fallback to:
                                                // const tai = allResults.get(tokenMintAccount.toBase58()) || await connection.getParsedAccountInfo(tokenMintAccount);

                                                // === Notes ===
                                                // Ensure all `accountInstruction.accounts[0].pubkey` and `tokenMintAccount` values you expect are added to `uniquePubkeys` before batch fetch.
                                                // You can extend this to cover other accounts too (e.g. accounts[2], accounts[3]) as needed.
                                            }

                                            if (gai){
                                                // get token metadata
                                                //console.log("gai: "+JSON.stringify(gai))
                                                //console.log("accountInstruction: "+JSON.stringify(accountInstruction));
                                                /*
                                                const uri = `https://api.shyft.to/sol/v1/nft/read?network=mainnet-beta&token_record=true&refresh=false&token_address=${gai?.data?.parsed?.info?.mint}`;
                                                
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

                                                    // To handle decimals, use .toNumber() for both the amount and divisor
                                                    let adjustedAmount = amountBN.toNumber() / divisor.toNumber(); 

                                                    // Now adjustedAmount will properly reflect decimal values
                                                    console.log("Adjusted Amount:", adjustedAmount);
                                                   // Detect if decimals should be displayed (more than 0)
                                                    let amount = (adjustedAmount % 1 === 0)
                                                        ? adjustedAmount.toLocaleString() // No decimals, just format as integer
                                                        : adjustedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

                                                    let symbol = null;//`${gai?.data.parsed.info.mint.slice(0, 3)}...${gai?.data.parsed.info.mint.slice(-3)}`;
                                                    let tname = null;
                                                    let logo = null;    
                                                    
                                                    if (tokenMap){
                                                        const tmap = tokenMap.get(new PublicKey(gai?.data.parsed.info.mint).toBase58());
                                                        if (tmap){
                                                            console.log("tmap: "+JSON.stringify(tmap))
                                                            if (!tname)
                                                                tname = tmap?.name;
                                                            if (!symbol)
                                                                symbol = tmap?.symbol;
                                                            if (!logo)
                                                                logo = tmap?.logoURI;
                                                        }
                                                    }

                                                    if (!symbol)
                                                        symbol = `${gai?.data.parsed.info.mint.slice(0, 3)}...${gai?.data.parsed.info.mint.slice(-3)}`;

                                                    newObject = {
                                                        type:"TokenTransfer",
                                                        ix: instructionItem.pubkey,
                                                        pubkey: accountInstruction.accounts[0].pubkey,
                                                        mint: gai?.data.parsed.info.mint,
                                                        name: tname,
                                                        logoURI: logo,
                                                        amount: parseFloat(amount.replace(/,/g, '')), //amount,
                                                        data: accountInstruction.data,
                                                        destinationAta:accountInstruction.accounts[1].pubkey,
                                                        description:amount+' '+symbol+' to '+accountInstruction.accounts[1].pubkey,
                                                    };
                                                    
                                                    //console.log("newObject "+JSON.stringify(newObject))
                                                    accountInstruction.info = newObject;
                                                } catch(e){
                                                    console.log("ERR: "+e);
                                                }
                                                accountInstruction.gai = gai;
                                                
                                                appendInstructionTransferDetail(newObject);
                                            }
                                        } else if (programId === "TbpjRtCg2Z2n2Xx7pFm5HVwsjx9GPJ5MsrfBvCoQRNL"){//(instructionInfo?.name === "Batch Token Transfer"){

                                            // check if we have this in gai
                                            let gai = null;
                                            if (mintResults && mintResults.length > 0){
                                                gai = mintResults[cnt];
                                            } 

                                            if (!gai){
                                                //gai = await connection.getParsedAccountInfo(new PublicKey(accountInstruction.accounts[0].pubkey))
                                                const pubkey = new PublicKey(accountInstruction.accounts[0].pubkey);
                                                gai = allResults.get(pubkey.toBase58());
                                            }
                                            if (gai){
                                                // get token metadata
                                                console.log("gai: "+JSON.stringify(gai))

                                                //setInstructionRecord(gai.value);
                                                let newObject = null;
                                                try{
                                                    const amountBN = new BN(accountInstruction?.data?.slice(1), 'le');
                                                    const decimals = gai?.data.parsed.info.tokenAmount?.decimals || 0;
                                                    const divisor = new BN(10).pow(new BN(decimals));

                                                    // To handle decimals, use .toNumber() for both the amount and divisor
                                                    let adjustedAmount = amountBN.toNumber() / divisor.toNumber(); 

                                                    // Now adjustedAmount will properly reflect decimal values
                                                    console.log("Adjusted Amount:", adjustedAmount);
                                                   // Detect if decimals should be displayed (more than 0)
                                                    let amount = (adjustedAmount % 1 === 0)
                                                        ? adjustedAmount.toLocaleString() // No decimals, just format as integer
                                                        : adjustedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

                                                    let symbol = null;//`${gai?.data.parsed.info.mint.slice(0, 3)}...${gai?.data.parsed.info.mint.slice(-3)}`;
                                                    let tname = null;
                                                    let logo = null;    
                                                    
                                                    if (tokenMap){
                                                        const tmap = tokenMap.get(new PublicKey(gai?.data.parsed.info.mint).toBase58());
                                                        if (tmap){
                                                            console.log("tmap: "+JSON.stringify(tmap))
                                                            if (!tname)
                                                                tname = tmap?.name;
                                                            if (!symbol)
                                                                symbol = tmap?.symbol;
                                                            if (!logo)
                                                                logo = tmap?.logoURI;
                                                        }
                                                    }

                                                    if (!symbol)
                                                        symbol = `${gai?.data.parsed.info.mint.slice(0, 3)}...${gai?.data.parsed.info.mint.slice(-3)}`;

                                                    newObject = {
                                                        type:"BatchTokenTransfer",
                                                        ix: instructionItem.pubkey,
                                                        pubkey: accountInstruction.accounts[0].pubkey,
                                                        mint: gai?.data.parsed.info.mint,
                                                        name: tname,
                                                        logoURI: logo,
                                                        amount: parseFloat(amount.replace(/,/g, '')), //amount,
                                                        data: accountInstruction.data,
                                                        destinationAta:accountInstruction.accounts[1].pubkey,
                                                        description:amount+' '+symbol+' to '+accountInstruction.accounts[1].pubkey,
                                                    };
                                                    
                                                    //console.log("newObject "+JSON.stringify(newObject))
                                                    accountInstruction.info = newObject;
                                                } catch(e){
                                                    console.log("ERR: "+e);
                                                }
                                                accountInstruction.gai = gai;
                                                
                                                appendInstructionTransferDetail(newObject);
                                                
                                            }
                                        } else if (
                                            programId === "11111111111111111111111111111111" &&
                                            (typeOfInstruction === 2 || typeOfInstruction === 11)
                                        ){// SOL Transfer / TransferWithSeed

                                            // check if we have this in gai
                                            let gai = null;
                                            if (mintResults && mintResults.length > 0){
                                                gai = mintResults[cnt];
                                            } 

                                            if (!gai){
                                                //gai = await connection.getParsedAccountInfo(new PublicKey(accountInstruction.accounts[0].pubkey))
                                                const pubkey = new PublicKey(accountInstruction.accounts[0].pubkey);
                                                gai = allResults.get(pubkey.toBase58());
                                            }
                                            
                                            if (gai){
                                                
                                                console.log("SOL IX: "+JSON.stringify(accountInstruction));

                                                //setInstructionRecord(gai.value);
                                                let newObject = null;
                                                try{
                                                    
                                                    const amountBuffer = accountInstruction?.data.slice(4, 12);
                                                    const amountBN = new BN(amountBuffer, 'le');
                                                    const lamports = amountBN.toString();
                                                    console.log("Lamports: ",lamports);
                                                    // Convert lamports to SOL (1 SOL = 1,000,000,000 lamports)
                                                    const solAmountString = toDecimalAmount(amountBN, 9);
                                                    const solAmountNumber = Number(solAmountString);
                                                    let amount = Number.isFinite(solAmountNumber)
                                                        ? (
                                                            solAmountNumber % 1 === 0
                                                                ? solAmountNumber.toLocaleString()
                                                                : solAmountNumber.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                                                        )
                                                        : solAmountString;

                                                    let symbol = "SOL";
                                                    newObject = {
                                                        type:"SOL Transfer",
                                                        ix: instructionItem.pubkey,
                                                        pubkey: accountInstruction.accounts[0].pubkey,
                                                        mint: "So11111111111111111111111111111111111111112",//"SOL",//gai?.data.parsed.info.mint,
                                                        name: symbol,
                                                        logoURI: "https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png",//tokenMap.get(gai?.data.parsed.info.mint)?.logoURI,
                                                        amount: Number.isFinite(solAmountNumber) ? solAmountNumber : 0,
                                                        data: accountInstruction.data,
                                                        destinationAta:accountInstruction.accounts[1].pubkey,
                                                        description:amount+' '+symbol+' to '+accountInstruction.accounts[1].pubkey,
                                                    };
                                                    
                                                    //console.log("newObject "+JSON.stringify(newObject))
                                                    accountInstruction.info = newObject;
                                                } catch(e){
                                                    console.log("ERR: "+e);
                                                }
                                                accountInstruction.gai = gai;
                                                appendInstructionTransferDetail(newObject);
                                                
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
                                                
                                                let description = "GSPL Governance Interaction";
                                                let decodedIx = null;
                                                let amount = null;
                                                let mint = null;
                                                let symbol = null;
                                                let logo = null;
                                                let destinationAta = null;

                                                try {
                                                    const amountBN = new BN(accountInstruction?.data?.slice(1), 'le');
                                                    //console.log("amount BN: "+amountBN);

                                                    if (Number(amountBN) > 0){

                                                        let gai = null;
                                                        if (mintResults && mintResults.length > 0){
                                                            gai = mintResults[cnt];
                                                        } 

                                                        if (!gai){
                                                            //gai = await connection.getParsedAccountInfo(new PublicKey(accountInstruction.accounts[0].pubkey))
                                                            const pubkey = new PublicKey(accountInstruction.accounts[0].pubkey);
                                                            gai = allResults.get(pubkey.toBase58());
                                                        }
                                                        //console.log("GAI: "+JSON.stringify(gai));
                                                        const decimals = gai?.data?.parsed?.info?.tokenAmount?.decimals || 0;
                                                        const divisor = new BN(10).pow(new BN(decimals));
                                                        amount = Number(amountBN.div(divisor)).toLocaleString(); 
                                                        
                                                        let tname = null;
                                                        // check if this is a Grape Proposal and use the token decimals to format it
                                                        
                                                        if (accountInstruction.accounts.length > 3){
                                                            //console.log("account: "+accountInstruction?.accounts[2].pubkey.toBase58());
                                                            //console.log("accounts: "+JSON.stringify(accountInstruction?.accounts));
                                                            if (decimals <= 0){
                                                                let tokenMintAccount = accountInstruction?.accounts[2].pubkey;
                                                                
                                                                //let tai = await connection.getParsedAccountInfo(tokenMintAccount);
                                                                let tai = allResults.get(tokenMintAccount.toBase58()) || await connection.getParsedAccountInfo(tokenMintAccount);

                                                                let tdecimals = 0;
                                                                
                                                                if (tai && tai?.value.data?.parsed?.info?.tokenAmount?.decimals){
                                                                    //console.log("tai "+JSON.stringify(tai?.value.data?.parsed?.info?.mint));
                                                                    thisMint = tai?.value.data?.parsed?.info?.mint;
                                                                    mint = thisMint;
                                                                    //console.log("l v t " + lastMint + " v "+ thisMint);
                                                                    if ((tai?.value.data?.parsed?.info?.mint) && (lastMint !== thisMint)){
                                                                        tname = await fetchTokenName(tai?.value.data?.parsed?.info?.mint);
                                                                        thisMintName = tname;
                                                                        symbol = tname;
                                                                    } else {
                                                                        tname = lastMintName;
                                                                        thisMintName = tname;
                                                                        symbol = tname;
                                                                    }
                                                                    
                                                                    tdecimals = tai?.value.data?.parsed?.info?.tokenAmount?.decimals || 0;
                                                                    thisMintDecimals = tdecimals;
                                                                    if (tdecimals > 0){
                                                                        let tdivisor = new BN(10).pow(new BN(tdecimals));
                                                                        amount = Number(amountBN.div(tdivisor)).toLocaleString(); 
                                                                    }
                                                                    lastMint = thisMint;
                                                                    lastMintName = thisMintName;
                                                                    lastMintDecimals = thisMintDecimals;
                                                                }
                                                            }

                                                            if (tokenMap){
                                                                const tmap = tokenMap.get(thisMint);
                                                                if (tmap){
                                                                    if (!tname)
                                                                        tname = tmap?.name;
                                                                        lastMintName = thisMintName = tname;
                                                                    if (!symbol)
                                                                        symbol = tmap?.symbol;
                                                                    if (!logo)
                                                                        logo = tmap?.logoURI;
                                                                }
                                                            }

                                                            if (!symbol)
                                                                symbol = `${gai?.data.parsed.info.mint.slice(0, 3)}...${gai?.data.parsed.info.mint.slice(-3)}`;
                                                            
                                                            destinationAta = accountInstruction?.accounts[3].pubkey;
                                                            console.log("Grant "+amount+" "+tname+" to "+accountInstruction?.accounts[3].pubkey.toBase58());
                                                            description = "Grant "+amount+" "+tname+" to "+accountInstruction?.accounts[3].pubkey.toBase58();
                                                        } else{
                                                            description = "Amount "+amount;
                                                        }
                                                    } else {

                                                        //const jsonData = await require('./plugins/idl/GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw.json');
                                                        const jsonData = await require('./plugins/idl/GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw.json');
                                                        const borshCoder = new BorshCoder(JSON.parse(JSON.stringify(jsonData)));
                                                        //const borshCoder = new BorshCoder(JSON.parse(jsonData));

                                                        console.log("borshCoder: "+JSON.stringify(borshCoder));
                                                        
                                                        const instruction = instructionItem.account.instructions[0];

                                                        console.log("Ix: "+JSON.stringify(instruction));
                                                        //const instruction = accountInstruction;
                                                        const hexString = instruction.data.map(byte => byte.toString(16).padStart(2, '0')).join('');
                                                        console.log("hexString: "+JSON.stringify(hexString));
                                                        decodedIx = borshCoder.instruction.decode(hexString, 'hex');
                                                        
                                                        //const decodedIx = borshCoder.instruction.decode(instruction.data, 'base58')
                                                        console.log("decodedIx: "+JSON.stringify(decodedIx));
                                                        if (!decodedIx){
                                                            const buffer = Buffer.from(accountInstruction.data);
                                                            description = buffer.toString("utf-8");
                                                        }
                                                    }
                                                } catch (error) {
                                                    console.log('ERR: ', error);
                                                    const buffer = Buffer.from(accountInstruction.data);
                                                    description = buffer.toString("utf-8");
                                                }

                                                const newObject = {
                                                    type:"SPL Governance Program by Solana",
                                                    ix: instructionItem.pubkey,
                                                    decodedIx:decodedIx,
                                                    amount: amount ? parseFloat(amount.replace(/,/g, '')) : null, //amount,
                                                    pubkey: accountInstruction.accounts[0].pubkey,
                                                    mint: mint,
                                                    name: symbol,
                                                    //logoURI: tokenMap.get(gai?.data.parsed.info.mint)?.logoURI,
                                                    description: description,
                                                    destinationAta: destinationAta,
                                                    data:accountInstruction.data
                                                };
                                                accountInstruction.info = newObject;

                                                //if (amount > 0){
                                                    appendInstructionTransferDetail(newObject);
                                                //}
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
                                        } else if (programId === "TokenzQdBNbLqP5VEh84bYQNJ9Y7fA1aC33mW7zk1g") {
                                            // Token-2022 Transfer / TransferChecked (basic support like SPL Token)
                                            let gai = null;
                                            if (mintResults?.length) gai = mintResults[cnt];
                                            if (!gai) {
                                                const pubkey = new PublicKey(accountInstruction.accounts[0].pubkey);
                                                gai = allResults.get(pubkey.toBase58());
                                            }
                                            if (gai) {
                                                try {
                                                // same layout assumption as Token: first byte = ix enum, then amount u64
                                                const amountBN = U64(accountInstruction.data, 1);
                                                const decimals = gai?.data?.parsed?.info?.tokenAmount?.decimals || 0;

                                                const decimalStr = toDecimalAmount(amountBN, decimals);
                                                const amount = decimalStr.includes(".")
                                                    ? formatAmount(decimalStr)
                                                    : Number(decimalStr).toLocaleString();

                                                let symbol: string | null = null;
                                                let tname: string | null = null;
                                                let logo: string | null = null;
                                                const mint = gai?.data?.parsed?.info?.mint;

                                                if (tokenMap && mint) {
                                                    const tmap = tokenMap.get(new PublicKey(mint).toBase58());
                                                    if (tmap) {
                                                    tname ??= tmap.name;
                                                    symbol ??= tmap.symbol;
                                                    logo ??= tmap.logoURI;
                                                    }
                                                }
                                                symbol ??= `${mint.slice(0, 3)}...${mint.slice(-3)}`;

                                                const newObject = {
                                                    type: "Token2022Transfer",
                                                    ix: instructionItem.pubkey,
                                                    pubkey: accountInstruction.accounts[0].pubkey,
                                                    mint,
                                                    name: tname,
                                                    logoURI: logo,
                                                    amount: parseFloat(amount.replace(/,/g, "")),
                                                    data: accountInstruction.data,
                                                    destinationAta: accountInstruction.accounts[1]?.pubkey,
                                                    description: `${amount} ${symbol} to ${accountInstruction.accounts[1]?.pubkey}`,
                                                };
                                                accountInstruction.info = newObject;

                                                appendInstructionTransferDetail(newObject);
                                                } catch (e) {
                                                console.log("Token-2022 ERR:", e);
                                                }
                                            }
                                        } else if (programId === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") {
                                            // Create Associated Token Account
                                            const payer = accountInstruction.accounts[0]?.pubkey;
                                            const ata   = accountInstruction.accounts[1]?.pubkey;
                                            const owner = accountInstruction.accounts[2]?.pubkey;
                                            const mint  = accountInstruction.accounts[3]?.pubkey;

                                            accountInstruction.info = {
                                                type: "CreateAssociatedTokenAccount",
                                                payer,
                                                ata,
                                                owner,
                                                mint,
                                                description: `Create ATA ${shortPk(ata)} for owner ${shortPk(owner)} / mint ${shortPk(mint)} (payer ${shortPk(payer)})`,
                                                data: accountInstruction.data,
                                            };
                                        } else if (programId === "ComputeBudget111111111111111111111111111111") {
                                            const tag = accountInstruction.data?.[0] ?? 255;
                                            let description = "Compute Budget: Unknown";

                                            try {
                                                if (tag === 1) {
                                                const limit = U32(accountInstruction.data, 1).toNumber();
                                                description = `Compute Budget: SetComputeUnitLimit = ${limit}`;
                                                } else if (tag === 2) {
                                                const microLamports = U64(accountInstruction.data, 1).toString();
                                                description = `Compute Budget: SetComputeUnitPrice = ${microLamports} micro-lamports/unit`;
                                                } else if (tag === 3) {
                                                const size = U32(accountInstruction.data, 1).toNumber();
                                                description = `Compute Budget: SetLoadedAccountsDataSizeLimit = ${size} bytes`;
                                                }
                                            } catch (e) {
                                                console.log("ComputeBudget decode error", e);
                                            }

                                            accountInstruction.info = {
                                                type: "ComputeBudget",
                                                description,
                                                data: accountInstruction.data,
                                            };
                                        } else if (programId === "AddressLookupTab1e1111111111111111111111111") {
                                            // Simple tag by opcode (first byte)
                                            const tag = accountInstruction.data?.[0] ?? 255;
                                            const table = accountInstruction.accounts[0]?.pubkey;
                                            const auth  = accountInstruction.accounts[1]?.pubkey;
                                            let op = "Unknown ALT op";

                                            if (tag === 0) op = "Create Address Lookup Table";
                                            else if (tag === 1) op = "Freeze/Extend (Add Addresses)";
                                            else if (tag === 2) op = "Deactivate";
                                            else if (tag === 3) op = "Close";

                                            accountInstruction.info = {
                                                type: "AddressLookupTable",
                                                table,
                                                authority: auth,
                                                description: `${op} on table ${shortPk(table)} (authority ${shortPk(auth)})`,
                                                data: accountInstruction.data,
                                            };
                                        } else if (programId === "Stake11111111111111111111111111111111111111") {
                                            const data = accountInstruction.data || [];
                                            const tag = data.length >= 4 ? U32(data, 0).toNumber() : 255;
                                            const stakeAcc = accountInstruction.accounts?.[0]?.pubkey;
                                            let authAcc = accountInstruction.accounts?.[1]?.pubkey;
                                            let toAcc: string | undefined = accountInstruction.accounts?.[2]?.pubkey;
                                            const normalizePk = (pk?: unknown): string | null => {
                                                try {
                                                    return pk ? new PublicKey(pk as string).toBase58() : null;
                                                } catch {
                                                    return typeof pk === "string" ? pk : null;
                                                }
                                            };
                                            const stakeAccStr = normalizePk(stakeAcc);

                                            const findDelegatedLamports = (): BN | null => {
                                                if (!stakeAccStr) return null;
                                                const allStakeIxs = instructionItem.account.instructions || [];

                                                // If this delegate comes from a split flow, use the split amount first.
                                                for (const ix of allStakeIxs) {
                                                    try {
                                                        const ixProgramId = new PublicKey(ix.programId).toBase58();
                                                        const ixData = ix.data || [];
                                                        if (ixProgramId !== "Stake11111111111111111111111111111111111111") continue;
                                                        if (ixData.length < 12) continue;
                                                        if (U32(ixData, 0).toNumber() !== 3) continue; // Split

                                                        const splitStakeAcc = normalizePk(ix.accounts?.[1]?.pubkey);
                                                        if (splitStakeAcc === stakeAccStr) {
                                                            return U64(ixData, 4);
                                                        }
                                                    } catch (e) {
                                                        console.log("Stake split lookup decode error", e);
                                                    }
                                                }

                                                // Otherwise, use the stake account funding from create account.
                                                for (const ix of allStakeIxs) {
                                                    try {
                                                        const ixProgramId = new PublicKey(ix.programId).toBase58();
                                                        const ixData = ix.data || [];
                                                        if (ixProgramId !== "11111111111111111111111111111111") continue;
                                                        if (ixData.length < 12) continue;
                                                        if (U32(ixData, 0).toNumber() !== 0) continue; // CreateAccount

                                                        const account0 = normalizePk(ix.accounts?.[0]?.pubkey);
                                                        const account1 = normalizePk(ix.accounts?.[1]?.pubkey);
                                                        if (account0 === stakeAccStr || account1 === stakeAccStr) {
                                                            return U64(ixData, 4);
                                                        }
                                                    } catch (e) {
                                                        console.log("System create account lookup decode error", e);
                                                    }
                                                }

                                                return null;
                                            };

                                            const names: Record<number,string> = {
                                                0: "Initialize",
                                                1: "Authorize",
                                                2: "DelegateStake",
                                                3: "Split",
                                                4: "Withdraw",
                                                5: "Deactivate",
                                                6: "SetLockup",
                                                7: "Merge",
                                                8: "AuthorizeWithSeed",
                                                9: "InitializeChecked",
                                                10: "AuthorizeChecked",
                                                11: "AuthorizeCheckedWithSeed",
                                                12: "SetLockupChecked",
                                            };
                                            let title = names[tag] || "UnknownStakeInstruction";
                                            let extra = "";
                                            let amountLamports: string | null = null;
                                            let amountSol: number | null = null;

                                            try {
                                                if (tag === 4 /* Withdraw */) {
                                                // layout: u32 instruction + u64 lamports
                                                const lamportsBN = U64(data, 4);
                                                const solStr = toDecimalAmount(lamportsBN, 9);
                                                amountLamports = lamportsBN.toString();
                                                amountSol = Number(solStr);
                                                toAcc = accountInstruction.accounts?.[1]?.pubkey;
                                                authAcc = accountInstruction.accounts?.[4]?.pubkey;
                                                extra = ` – Withdraw ${formatAmount(solStr)} SOL to ${shortPk(toAcc)}`;
                                                } else if (tag === 2 /* Delegate */) {
                                                const voteAcc = accountInstruction.accounts?.[1]?.pubkey;
                                                authAcc = accountInstruction.accounts?.[5]?.pubkey || accountInstruction.accounts?.[2]?.pubkey;
                                                const delegatedLamportsBN = findDelegatedLamports();
                                                if (delegatedLamportsBN) {
                                                    const delegatedSolStr = toDecimalAmount(delegatedLamportsBN, 9);
                                                    amountLamports = delegatedLamportsBN.toString();
                                                    amountSol = Number(delegatedSolStr);
                                                    extra = ` – Delegate ${formatAmount(delegatedSolStr)} SOL from ${shortPk(stakeAcc)} to vote ${shortPk(voteAcc)}`;
                                                } else {
                                                    extra = ` – Delegate ${shortPk(stakeAcc)} to vote ${shortPk(voteAcc)}`;
                                                }
                                                } else if (tag === 5 /* Deactivate */) {
                                                authAcc = accountInstruction.accounts?.[2]?.pubkey;
                                                extra = ` – Deactivate stake ${shortPk(stakeAcc)}`;
                                                } else if (tag === 3 /* Split */) {
                                                // layout: u32 instruction + u64 lamports
                                                const lamportsBN = U64(data, 4);
                                                const solStr = toDecimalAmount(lamportsBN, 9);
                                                amountLamports = lamportsBN.toString();
                                                amountSol = Number(solStr);
                                                toAcc = accountInstruction.accounts?.[1]?.pubkey;
                                                authAcc = accountInstruction.accounts?.[2]?.pubkey;
                                                extra = ` – Split ${formatAmount(solStr)} SOL to ${shortPk(toAcc)}`;
                                                } else if (tag === 7 /* Merge */) {
                                                toAcc = accountInstruction.accounts?.[1]?.pubkey;
                                                authAcc = accountInstruction.accounts?.[4]?.pubkey;
                                                extra = ` – Merge ${shortPk(toAcc)} into ${shortPk(stakeAcc)}`;
                                                }
                                            } catch (e) {
                                                console.log("Stake decode error", e);
                                            }

                                            accountInstruction.info = {
                                                type: "StakeProgram",
                                                op: title,
                                                stakeAccount: stakeAcc,
                                                authority: authAcc,
                                                destination: toAcc,
                                                lamports: amountLamports,
                                                amount: amountSol,
                                                description: `Stake: ${title}${extra}`,
                                                data,
                                            };  
                                        } else if (programId === "11111111111111111111111111111111") {
                                            // You already handle raw SOL Transfer above.
                                            // Augment with CreateAccount / TransferWithSeed recognition.
                                            const data = accountInstruction.data || [];
                                            const tag = data.length >= 4 ? U32(data, 0).toNumber() : 255;

                                            if (tag !== 2 /* transfer */) {
                                                try {
                                                if (tag === 0 /* CreateAccount */) {
                                                    const lamports = U64(data, 4);
                                                    const space    = U64(data, 12); // u64
                                                    const newAcc   = accountInstruction.accounts[0]?.pubkey; // new
                                                    const funder   = accountInstruction.accounts[1]?.pubkey; // from
                                                    const solStr   = toDecimalAmount(lamports, 9);
                                                    accountInstruction.info = {
                                                    type: "SystemProgram",
                                                    op: "CreateAccount",
                                                    newAccount: newAcc,
                                                    funder,
                                                    lamports: Number(solStr),
                                                    space: Number(space.toString()),
                                                    description: `CreateAccount ${shortPk(newAcc)} funded by ${shortPk(funder)} with ${formatAmount(solStr)} SOL, space ${space.toString()} bytes`,
                                                    data: accountInstruction.data,
                                                    };
                                                } else if (tag === 1 /* Assign */) {
                                                    const account = accountInstruction.accounts[0]?.pubkey;
                                                    const programOwner = accountInstruction.accounts[1]?.pubkey;
                                                    accountInstruction.info = {
                                                    type: "SystemProgram",
                                                    op: "Assign",
                                                    account,
                                                    programOwner,
                                                    description: `Assign ${shortPk(account)} to program ${shortPk(programOwner)}`,
                                                    data: accountInstruction.data,
                                                    };
                                                } else if (tag === 3 /* CreateAccountWithSeed */) {
                                                    try {
                                                        const ix = new TransactionInstruction({
                                                            programId: new PublicKey(programId),
                                                            keys: (accountInstruction.accounts || []).map((key: any) => ({
                                                                pubkey: new PublicKey(key.pubkey),
                                                                isSigner: !!key.isSigner,
                                                                isWritable: !!key.isWritable,
                                                            })),
                                                            data: Buffer.from(accountInstruction.data || []),
                                                        });
                                                        const decoded = SystemInstruction.decodeCreateWithSeed(ix as any);
                                                        const lamportsBN = new BN(decoded.lamports.toString());
                                                        const solStr = toDecimalAmount(lamportsBN, 9);
                                                        accountInstruction.info = {
                                                            type: "SystemProgram",
                                                            op: "CreateAccountWithSeed",
                                                            newAccount: decoded.newAccountPubkey?.toBase58?.() || accountInstruction.accounts?.[1]?.pubkey,
                                                            base: decoded.basePubkey?.toBase58?.() || accountInstruction.accounts?.[0]?.pubkey,
                                                            ownerProgram: decoded.programId?.toBase58?.(),
                                                            seed: decoded.seed,
                                                            lamports: decoded.lamports?.toString?.(),
                                                            space: decoded.space?.toString?.(),
                                                            description: `CreateAccountWithSeed ${shortPk(decoded.newAccountPubkey?.toBase58?.())} with ${formatAmount(solStr)} SOL`,
                                                            data: accountInstruction.data,
                                                        };
                                                    } catch {
                                                        accountInstruction.info = {
                                                            type: "SystemProgram",
                                                            op: "CreateAccountWithSeed",
                                                            description: `CreateAccountWithSeed for ${shortPk(accountInstruction.accounts?.[1]?.pubkey)}`,
                                                            data: accountInstruction.data,
                                                        };
                                                    }
                                                } else if (tag === 11 /* TransferWithSeed */) {
                                                    // layout: u32 instruction + u64 lamports
                                                    const lamports = U64(data, 4);
                                                    const solStr = toDecimalAmount(lamports, 9);
                                                    const from = accountInstruction.accounts[0]?.pubkey;
                                                    const to   = accountInstruction.accounts[1]?.pubkey;
                                                    accountInstruction.info = {
                                                    type: "SystemProgram",
                                                    op: "TransferWithSeed",
                                                    from, to,
                                                    lamports: Number(solStr),
                                                    description: `TransferWithSeed ${formatAmount(solStr)} SOL from ${shortPk(from)} to ${shortPk(to)}`,
                                                    data,
                                                    };
                                                }
                                                // else fall back to your existing SOL Transfer branch above (already handled)
                                                } catch (e) {
                                                console.log("System extra decode error", e);
                                                }
                                            }   
                                        } else if (programId === "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s") {
                                            // High-level only (full decode requires IDL + variant tables)
                                            const metadataAcc = accountInstruction.accounts[0]?.pubkey;
                                            const mint        = accountInstruction.accounts[1]?.pubkey;
                                            const authority   = accountInstruction.accounts[2]?.pubkey;

                                            accountInstruction.info = {
                                                type: "MetaplexTokenMetadata",
                                                metadata: metadataAcc,
                                                mint,
                                                authority,
                                                description: `Token Metadata op on mint ${shortPk(mint)} (metadata ${shortPk(metadataAcc)})`,
                                                data: accountInstruction.data, // keep raw for advanced view
                                            };     
                                        } else {
                                            if (accountInstruction?.data) {
                                                const buf = Buffer.from(accountInstruction.data);
                                                const hex = buf.toString("hex");
                                                const b64 = buf.toString("base64");

                                                const acctSummary = (accountInstruction.accounts || [])
                                                .map((a: any, i: number) => `#${i}: ${a?.pubkey}${a?.isSigner ? " (signer)" : ""}${a?.isWritable ? " (w)" : ""}`)
                                                .join(", ");

                                                accountInstruction.info = {
                                                type: "Unknown Program",
                                                description: `Raw(utf8): ${buf.toString("utf-8")}`,
                                                hex,
                                                base64: b64,
                                                accounts: acctSummary,
                                                data: accountInstruction.data,
                                                };
                                            }
                                        }
                                        /*                               
                                        else {
                                            if (accountInstruction?.data){
                                                const buffer = Buffer.from(accountInstruction.data);
                                                const newObject = {
                                                    type:"Unknown Program",
                                                    description:buffer.toString("utf-8"),
                                                    data:accountInstruction.data
                                                };
                                                accountInstruction.info = newObject;
                                            }
                                        } */
                                    
                                }
                            }
                            cnt++;
                        }

                        setLoadingMessage(`Loading Multiple Account Info for ${useInstructions.length} accounts...`);
                        const chunks = [];
                        let chunk = [];

                        for (let i = 0; i < ataArray?.length; i++) {
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
                    }
                    
                    
                }
            }
        }

        // --- After voteRecord has been set (either from RPC/indexer or cache) ---
        const rawVoteRecords = Array.isArray(voteRecord) ? voteRecord : [];

        // Your cached shape uses item.vote.vote
        // Your fresh/indexed shape uses item.account.vote
        const vetoCount = rawVoteRecords.reduce((acc, it) => {
        const v = it?.account?.vote ?? it?.vote?.vote; // normalize
        // SPL-Gov: Veto is VoteKind.Veto OR v.veto === true (defensive)
        const isVeto =
            v?.voteType === VoteKind.Veto ||
            v?.veto === true;

        return acc + (isVeto ? 1 : 0);
        }, 0);

        // If you want it in React state (so you can pass it to <VetoVoteRow />)
        setVetoCount?.(vetoCount); // or setProposalVetoCount(vetoCount)

        const vetoWalletMap = new Map<string, any>();
        rawVoteRecords.forEach((it: any, index: number) => {
            const v = it?.account?.vote ?? it?.vote?.vote;
            const isVeto = v?.voteType === VoteKind.Veto || v?.veto === true;
            if (!isVeto) return;

            const governingTokenOwner =
                toBase58Safe(it?.account?.governingTokenOwner) ||
                toBase58Safe(it?.governingTokenOwner) ||
                toBase58Safe(it?.vote?.governingTokenOwner);
            const voteAddress = toBase58Safe(it?.pubkey) || toBase58Safe(it?.voteAddress);
            const voterWeightRaw =
                it?.account?.voterWeight ??
                it?.vote?.voterWeight ??
                it?.account?.voteWeight?.yes ??
                it?.account?.voteWeight?.no ??
                it?.vote?.voteWeight?.yes ??
                it?.vote?.voteWeight?.no;
            const voterWeight = voterWeightRaw !== undefined && voterWeightRaw !== null ? Number(voterWeightRaw) : null;

            const key = `${governingTokenOwner || voteAddress || index}`;
            if (!vetoWalletMap.has(key)) {
                vetoWalletMap.set(key, {
                    id: key,
                    governingTokenOwner,
                    voteAddress,
                    voterWeight: Number.isFinite(voterWeight) ? voterWeight : null,
                });
            }
        });
        setVetoVoters(Array.from(vetoWalletMap.values()));

        const voteResults = voteRecord;//JSON.parse(JSON.stringify(voteRecord));
        //console.log("1 voteResults.. " + JSON.stringify(voteResults))
        const votingResults = [];
        let csvFile = '';
        let uYes = 0;
        let uNo = 0;
        let castedYes = 0;
        let castedNo = 0;

        let mVoteSentiment = new Array();

        if (voteResults && voteResults.length > 0){
            let counter = 0;
            for (let item of voteResults){
                setLoadingMessage(`Loading Voting Results ${counter+1} of ${voteResults.length} voters...`);
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
                    csvFile = 'Voter,Vote,Votes Casted,Voter Weight,Token Decimals,Vote Type,Proposal\r\n';
                
                let voteType = 0;
                let voterWeight = 0;
                let voteDirection = 'No';
                if (!from_cache){
                    if (item.account?.voterWeight){
                        voteType = item.account?.vote?.voteType;
                        voterWeight = Number(item.account?.voterWeight);
                        if (voteType === 0)
                            voteDirection = 'Yes';
                        else
                            voteDirection = 'No';
                    } else{
                        if (item.account?.voteWeight?.yes && item.account?.voteWeight?.yes > 0){
                            voteType = 0
                            voterWeight = item.account?.voteWeight?.yes;
                            voteDirection = 'Yes';
                        }else{
                            voteType = 1
                            voterWeight = item.account?.voteWeight?.no;
                            voteDirection = 'No';
                        }
                    }
                    
                    csvFile += item.account.governingTokenOwner.toBase58()+','+voteDirection+','+(+((voterWeight)/Math.pow(10, ((realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === thisitem.account.governingTokenMint?.toBase58()) ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint === thisitem.account.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.account.proposal.toBase58()+'';
                
                } else{
                    if (item.vote?.voterWeight){
                        voteType = item.vote?.vote?.voteType;
                        voterWeight = Number(item.vote?.voterWeight);
                        if (voteType === 0)
                            voteDirection = 'Yes';
                        else
                            voteDirection = 'No';
                    } else{
                        if (item.vote?.voteWeight?.yes && item.account?.voteWeight?.yes > 0){
                            voteType = 0
                            voterWeight = item.vote?.voteWeight?.yes;
                            voteDirection = 'Yes';
                        }else{
                            voteType = 1
                            voterWeight = item.vote?.voteWeight?.no;
                            voteDirection = 'No';
                        }
                    }

                    csvFile += item.governingTokenOwner.toBase58()+','+voteDirection+','+(+((voterWeight)/Math.pow(10, ((realm.account.config?.councilMint) === thisitem.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint === thisitem.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.proposal.toBase58()+'';
                    
                }

                
                //    csvFile += item.pubkey.toBase58();
            }
            let prepend = '';
            prepend += 'Proposal,'+escapeCSV(thisitem.account?.name)+',,,,,,';
            prepend += '\r\n';
            prepend += 'Total Voters,'+counter+',,,,,,';
            prepend += '\r\n';
            prepend += 'Total Yes,'+uYes+',,,,,,';
            prepend += '\r\n';
            prepend += 'Total No,'+uNo+',,,,,,';
            prepend += '\r\n';
            prepend += '\r\n';
            csvFile = prepend + csvFile;
            
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
            const descriptionUrl = extractFirstHttpUrl(thisitem.account?.descriptionLink);
            if (descriptionUrl) {
                let url: URL | null = null;
                try {
                    url = new URL(descriptionUrl);
                } catch (e) {
                    // If description text includes malformed URL content, skip link-specific rendering only.
                    console.warn("Invalid URL:", thisitem.account?.descriptionLink, e);
                }

                if (!url) {
                    setGist(null);
                    setGoogleDocs(null);
                    setGitBook(null);
                    setIrys(null);
                } else {

                    const hostname = (url.hostname || "").toLowerCase();
                    const parts = (url.pathname || "").split("/");

                    // gist id is typically /{user}/{gistId}[...]
                    const gistId = parts.length > 2 ? parts[2] : null;

                    // reset (optional but prevents stale state)
                    setGist(null);
                    setGoogleDocs(null);
                    setGitBook(null);
                    setIrys(null);

                    if (hostname === "gist.github.com") {
                        setGist(gistId);

                        const rpd = await resolveProposalDescription(descriptionUrl);

                        const imageUrlRegex = /https?:\/\/[^\s"]+\.(?:jpg|jpeg|gif|png)/gi;
                        const targetUrl =
                        "https://shdw-drive.genesysgo.net/4HMWqo1YLwnxuVbh4c8KXMcZvQj4aw7oxnNmWVm4RmVV/Screenshot_2023-05-28_at_10.43.34.png";

                        const stringWithPreviews = rpd.replace(imageUrlRegex, (match: string) => {
                        if (match === targetUrl) return GIST_LOGO;
                        return `![Image X](${match})`;
                        });

                        setProposalDescription(stringWithPreviews);
                    } else if (hostname === "docs.google.com") {
                        setGoogleDocs(descriptionUrl); // store the URL (or a flag if you prefer)
                    } else if (hostname.includes("gitbook.io")) {
                        setGitBook(descriptionUrl); // store the URL (or a flag)
                    } else if (hostname.endsWith("irys.xyz")) {
                        setIrysLoading(true);
                        setIrysError(null);
                        setIrysUrl(url.href);

                        try {
                            const raw = await fetchIrysText(url.href);

                            // Sanitize. Keep basic formatting tags; block scripts, onclick, etc.
                            const safe = DOMPurify.sanitize(raw, {
                            USE_PROFILES: { html: true },
                            // Optional: if you want to allow images and links (safe defaults are ok)
                            // ADD_TAGS: ["img"],
                            // ADD_ATTR: ["target", "rel"],
                            });

                            setIrysHtml(safe);
                        } catch (e: any) {
                            setIrysHtml(null);
                            setIrysError(e?.message || "Failed to load Irys content");
                        } finally {
                            setIrysLoading(false);
                        }
                    }
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
        
        //console.log("realm: "+JSON.stringify(realm));

        //if (!realm){
        {
            grealm = await getRealmIndexed(governanceAddress);
            //if (!grealm)
            //    grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
            //alert("no realm yet")
            realmPk = new PublicKey(grealm.pubkey);
            realmOwner = grealm.owner;
            setRealm(grealm);
            setRealmName(grealm?.account?.name);
            //console.log("grealm: "+JSON.stringify(grealm));
        }/* else{
            setRealmName(realm.account?.name);
            realmOwner = realm.owner.toBase58();
            realmPk = new PublicKey(realm.pubkey);
        }*/

        const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddress, realmOwner);
        setGovernanceRules(governanceRulesIndexed);

        if (!thisitem || reload){
            console.log("Calling Index/RPC");
            //const prop = await getProposal(RPC_CONNECTION, new PublicKey(proposalPk));
            const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
            const prop = await getProposalIndexed(governanceRulesStrArr, realmOwner, governanceAddress, proposalPk);
            //console.log("prop: "+JSON.stringify(prop));
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
            }/* else if (!indexedTokenOwnerRecords){
                console.log("** Members from RPC")
                rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk);
            }*/ else{
                console.log("** Members from Index")
                rawTokenOwnerRecords = indexedTokenOwnerRecords;
            }
            console.log("Setting MemberMap");
            setMemberMap(rawTokenOwnerRecords);
        }
    
        console.log("Completed Gov Prop setup")

        setLoadingValidation(false);
    } 

    const fetchNativeTreasuryAddress = async(governance:any) => {
        
        const nta = await getNativeTreasuryAddress(
            //@ts-ignore
            new PublicKey(realm.owner),
            new PublicKey(governance)
        )

        setGovernanceNativeWallet(nta);
    }

    const getGroupedInstructions = (ixTransferDetails) => {
        /*
        const uniqueInstructions = Array.from(
            new Map(
                ixTransferDetails.map(item => {
                    const key = `${item.ix}_${item.mint}_${item.destinationAta}`;
                    return [key, item];
                })
            ).values()
        );*/

        return Object.values(
            ixTransferDetails.reduce((result, item) => {
                if (item && typeof item === 'object') {
                    const { mint, amount, name, logoURI, destinationAta } = item;
                    if (!mint || !destinationAta) return result;

                    if (!result[mint]) {
                        result[mint] = {
                            mint,
                            name,
                            logoURI,
                            destinationAmounts: {},
                            totalAmount: 0,
                        };
                    }

                    const group = result[mint];
                    const parsedAmount = parseFloat(amount) || 0;

                    group.destinationAmounts[destinationAta] = (group.destinationAmounts[destinationAta] || 0) + parsedAmount;
                    group.totalAmount += parsedAmount;

                    console.log(`[DEBUG] ix: ${item.ix}, mint: ${mint}, dest: ${destinationAta}, amount: ${parsedAmount}`);
                }
                return result;
            }, {})
        );
    };

    React.useEffect(() => { 
        if (thisitem && !governanceNativeWallet){
            fetchNativeTreasuryAddress(thisitem.account.governance);
        }
    }, [thisitem]);

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
    }, [governanceLookup, loadingValidation]);

    React.useEffect(() => {
        setCouncilVoterRecord(getCouncilTorForWallet());
    }, [getCouncilTorForWallet]);

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
                            // we need to updat the status of the proposal every time
                            // thisitem.account?.state
                            validateGovernanceSetup();
                            
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
    }, [loadingValidation, thisitem, !thisGovernance, governanceLookup, tokenMap, memberMap, realm, reload]);

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

    const fetchTokenOwner = async (ataPublicKey:PublicKey) => {
        try {
            
            // Fetch account info
            const accountInfo = await connection.getAccountInfo(ataPublicKey);

            if (accountInfo && accountInfo.owner.equals(TOKEN_PROGRAM_ID)) {
                const accountData = AccountLayout.decode(new Uint8Array(accountInfo.data));
                return new PublicKey(accountData.owner).toBase58();
            } else {
                console.error('Account not found or is not an ATA.');
                return null;
            }
        } catch (error) {
            console.error('Error fetching token owner:', error);
            return null;
        }
    };


    const populateArrayWithOwners = async (instructionTransferDetails: any[]) => {
        // Step 1: Collect unique destinationAta public keys
        const uniqueAtas = new Set(
            instructionTransferDetails
                .filter(item => item?.amount > 0 && item.destinationAta)
                .map(item => new PublicKey(item.destinationAta).toBase58())
        );

        // Step 2: Batch fetch all ATAs using getMultipleAccountsInfo
        const ataPubkeys = [...uniqueAtas].map(key => new PublicKey(key));
        const ataOwnerMap = new Map();
        const chunkSize = 100;

        for (let i = 0; i < ataPubkeys.length; i += chunkSize) {
            const chunk = ataPubkeys.slice(i, i + chunkSize);
            const infos = await connection.getMultipleAccountsInfo(chunk);
            chunk.forEach((pubkey, idx) => {
                ataOwnerMap.set(pubkey.toBase58(), infos[idx]);
            });
        }

        // Step 3: Build the final populated array
        const populatedArray = instructionTransferDetails
            .filter(item => item?.amount > 0)
            .map(item => {
                const ataKey = new PublicKey(item.destinationAta).toBase58();
                const ataInfo = ataOwnerMap.get(ataKey);
                let tokenOwner = null;

                if (ataInfo && ataInfo.owner.equals(TOKEN_PROGRAM_ID)) {
                    const accountData = AccountLayout.decode(new Uint8Array(ataInfo.data));
                    tokenOwner = new PublicKey(accountData.owner).toBase58();
                    item.tokenOwner = tokenOwner;
                }

                return {
                    amount: item.amount,
                    mint: item.mint,
                    address: tokenOwner || item.destinationAta, // fallback to destinationAta
                };
            });

        // Step 4: Update state
        setDestinationWalletArray(populatedArray);
    };

    const populateArrayWithOwnersSingle = async (instructionTransferDetails:any) => {
        const populatedArray = await Promise.all(
            instructionTransferDetails
                .filter(item => item?.amount > 0)
                .map(async (item) => {
                    const tokenOwner = await fetchTokenOwner(item.destinationAta);
                    if (tokenOwner)
                        item.tokenOwner = tokenOwner;
                    return {
                        amount: item.amount,
                        mint: item.mint,
                        address: tokenOwner || item.destinationAta, // Fallback if owner fetch fails
                    };
                })
        );
        //console.log("instructionTransferDetails: "+JSON.stringify(instructionTransferDetails));
        //console.log("populatedArray: "+JSON.stringify(populatedArray))
        setDestinationWalletArray(populatedArray);
        //return populatedArray;
    };

    const fetchedAtasRef = React.useRef<Set<string>>(new Set());

    React.useEffect(() => {
        const runPopulate = async () => {
            if (!instructionTransferDetails || instructionTransferDetails.length === 0) return;

            // Extract all unique destination ATAs from current data
            const incomingAtas = new Set(
                instructionTransferDetails
                    .filter(item => item?.amount > 0 && item.destinationAta)
                    .map(item => new PublicKey(item.destinationAta).toBase58())
            );

            // Only call populateArrayWithOwners if there's a new ATA we haven't seen before
            const newAtas = [...incomingAtas].filter(ata => !fetchedAtasRef.current.has(ata));

            if (newAtas.length > 0) {
                await populateArrayWithOwners(instructionTransferDetails);

                // Add to the seen list
                newAtas.forEach(ata => fetchedAtasRef.current.add(ata));
            }
        };

        runPopulate();
    }, [instructionTransferDetails]);

    const proposalState = Number(thisitem?.account?.state ?? -1);
    const proposalStateLabel = GOVERNANCE_STATE[proposalState] || "Unknown";
    const proposalTargetLabel = voteType === "Council" ? "Council" : "Community";
    const proposalTransactionCount = (() => {
        if (!Array.isArray(proposalInstructions) || proposalInstructions.length === 0) return 0;
        const nestedTxRows = proposalInstructions?.[0]?.account?.instructions;
        if (
            proposalInstructions.length === 1 &&
            Array.isArray(nestedTxRows) &&
            nestedTxRows.length > 0 &&
            nestedTxRows[0]?.account?.instructionIndex !== undefined
        ) {
            return nestedTxRows.length;
        }
        return proposalInstructions.length;
    })();
    const proposalInstructionCount =
        proposalTransactionCount;
    const isMobile = useMediaQuery('(max-width:600px)');
    const isTablet = useMediaQuery('(max-width:900px)');
    const detailsEmbedHeight = isMobile ? 420 : isTablet ? 560 : 750;
    const votesTableHeight = isMobile ? 460 : isTablet ? 540 : 600;
    const hasProposalDescription = Boolean(
        irysUrl ||
        gist ||
        gDocs ||
        (thisitem?.account?.descriptionLink && `${thisitem.account.descriptionLink}`.trim().length > 0)
    );

    const panelSx = {
        background: 'rgba(16,22,34,0.86)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.24)',
    };
    const heroPanelSx = {
        ...panelSx,
        background: 'rgba(18,25,38,0.9)',
    };
    const softActionButtonSx = {
        borderRadius: "10px",
        borderColor: "rgba(255,255,255,0.16)",
        textTransform: "none",
        fontSize: 12,
        minHeight: 32,
        background: 'rgba(255,255,255,0.02)',
        boxShadow: 'none',
        '&:hover': {
            borderColor: "rgba(255,255,255,0.26)",
            background: 'rgba(255,255,255,0.06)',
        },
    };
    const metaChipSx = {
        color: 'rgba(255,255,255,0.95)',
        border: '1px solid rgba(255,255,255,0.16)',
        boxShadow: 'none',
        borderRadius: '7px',
        '& .MuiChip-label': {
            px: 0.95,
            fontSize: '0.73rem',
        },
    };
    const sectionDividerSx = {
        mt: 0.5,
        mb: 1.3,
        borderColor: 'rgba(255,255,255,0.08)',
    };
    const sectionLabelSx = {
        display: 'inline-flex',
        px: 0,
        py: 0,
        borderRadius: 0,
        fontSize: '0.62rem',
        letterSpacing: 0.35,
        textTransform: 'uppercase',
        color: 'rgba(180,192,208,0.8)',
        border: 'none',
        background: 'transparent',
    };

    return (
        <>
            <ThemeProvider theme={grapeTheme}>
                <Box
                    height='100%'
                    sx={{
                        width: '100%',
                        maxWidth: 1480,
                        mx: 'auto',
                        px: { xs: 0.5, sm: 1 },
                        pb: 1.5,
                    }}
                >

                {!loadingValidation && !loadingParticipants && thisitem ?
                    <>
                        
                        <Helmet>
                            <meta name="msapplication-TileImage" content="./public/ms-icon-144x144.png"/>
                            <meta name="msapplication-TileColor" content="#180A1E"/>
                            <meta name="msapplication-TileImage" content="./public/ms-icon-144x144.png"/>
                        
                            <meta name="description" content={`Proposal ${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``} powered by Governance.so by Grape`} />
                            <title>{`${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``}`}</title>
                            
                            <meta property="og:url" content="https://governance.so"/>
                            <meta property="og:type" content="website"/>
                            <meta property="og:title" content={`${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``} `}/>
                            <meta property="og:description" content={`Proposal ${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``}  powered by Governance.so by Grape`}/>
                            <meta property="og:image" content="https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png"/>  
                            
                            <meta name="twitter:card" content="summary_large_image"/>
                            <meta name="twitter:title" content={`${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``} `}/>
                            <meta name="twitter:site" content="@grapeprotocol"/>
                            <meta name="twitter:description" content={`Proposal ${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``}  powered by Governance.so by Grape`}/>
                            <meta name="twitter:image" content="https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png"/>
                            <meta name="twitter:image:alt" content={`${thisitem.account?.name} ${realmName ? ` | ${realmName}` : ``} `}/>
                        </Helmet>
                        

                        {/* =========================
               Header: title + actions + power
               ========================= */}
            <Box sx={{ mb: 1.25, p: { xs: 1, sm: 1.25 }, ...heroPanelSx }}>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1}
                alignItems={{ xs: "flex-start", md: "center" }}
                justifyContent="space-between"
              >
                <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                  <Typography sx={sectionLabelSx}>Proposal Overview</Typography>
                  {showGovernanceTitle && realmName && (
                    <Typography
                      variant="h4"
                      sx={{
                        lineHeight: 1.1,
                        fontSize: { xs: '1.3rem', sm: '1.65rem', md: '2rem' },
                        wordBreak: 'break-word',
                      }}
                    >
                      {realmName}
                    </Typography>
                  )}
                  <Typography
                    variant="h5"
                    sx={{
                      lineHeight: 1.2,
                      fontWeight: 700,
                      fontSize: { xs: '1.05rem', sm: '1.22rem', md: '1.34rem' },
                      color: 'rgba(235,247,255,0.95)',
                      maxWidth: { xs: '100%', md: 820 },
                      wordBreak: 'break-word',
                    }}
                  >
                    {thisitem?.account?.name}
                  </Typography>

	                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" alignItems={{ xs: "stretch", sm: "center" }}>
                    {showGovernanceTitle && proposalPk && realmName && (
                      <Tooltip title={`Back to ${realmName} Governance`}>
                        <Button
                          aria-label="back"
                          variant="outlined"
                          color="inherit"
                          component={Link}
                          to={`/governance/${governanceAddress}`}
                          sx={{ ...softActionButtonSx, width: { xs: '100%', sm: 'auto' } }}
                        >
                          <ArrowBackIcon fontSize="inherit" sx={{ mr: 1 }} />
                          Back
                        </Button>
                      </Tooltip>
                    )}

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                      <CopyToClipboard text={proposalUrl} onCopy={handleCopy}>
                        <Tooltip title={`Copy proposal link`}>
                          <Button
                            aria-label="copy"
                            variant="outlined"
                            color="inherit"
                            size="small"
                            sx={{ ...softActionButtonSx, width: { xs: '100%', sm: 'auto' } }}
                          >
                            <ContentCopyIcon fontSize="inherit" sx={{ mr: 1 }} />
                            Copy
                          </Button>
                        </Tooltip>
                      </CopyToClipboard>

                      <Tooltip title={`Share proposal`}>
                        <Button
                          aria-label="share"
                          onClick={handleShare}
                          variant="outlined"
                          color="inherit"
                          size="small"
                          sx={{ ...softActionButtonSx, width: { xs: '100%', sm: 'auto' } }}
                        >
                          <ShareIcon fontSize="inherit" sx={{ mr: 1 }} />
                          Share
                        </Button>
                      </Tooltip>

                      </Stack>
			                  </Stack>
                      <Box sx={{ mt: 0.2 }}>
                        <Tooltip title="Open on Realms">
                          <Typography
                            component="a"
                            href={realmsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.45,
                              fontSize: '0.69rem',
                              color: 'rgba(208,226,244,0.56)',
                              textDecoration: 'none',
                              '&:hover': {
                                color: 'rgba(232,242,252,0.8)',
                                textDecoration: 'underline',
                              },
                            }}
                          >
                            View on Realms
                            <OpenInNewIcon sx={{ fontSize: '0.84rem' }} />
                          </Typography>
                        </Tooltip>
                      </Box>

                      <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
                        <Chip
                          size="small"
                          label={proposalStateLabel}
                          sx={{
                            ...metaChipSx,
                            bgcolor:
                              proposalState === 5 ? 'rgba(114, 211, 140, 0.14)' :
                              proposalState === 7 ? 'rgba(230, 95, 95, 0.14)' :
                              proposalState === 2 ? 'rgba(142, 197, 255, 0.14)' :
                              'rgba(255,255,255,0.08)',
                          }}
                        />
                        <Chip
                          size="small"
                          label={`${proposalTargetLabel} Proposal`}
                          sx={{
                            ...metaChipSx,
                            bgcolor: 'rgba(255,255,255,0.05)',
                          }}
                        />
                        <Chip
                          size="small"
                          icon={<CodeIcon sx={{ fontSize: '0.95rem !important' }} />}
                          label={`${proposalInstructionCount} instruction${proposalInstructionCount === 1 ? '' : 's'}`}
                          sx={{
                            ...metaChipSx,
                            bgcolor: 'rgba(255,255,255,0.05)',
                          }}
                        />
                      </Stack>
	                </Stack>
                
                {realm && (
                  <Box sx={{ mt: { xs: 1, md: 0 } }}>
                    <GovernancePower
                      governanceAddress={typeof realm.pubkey.toBase58 === "function" ? realm.pubkey.toBase58() : realm.pubkey}
                      realm={realm}
                    />
                  </Box>
                )}
              </Stack>
            </Box>

	            <Box sx={{ textAlign: "left" }}>
		              <Divider sx={sectionDividerSx} />

              {/* =========================
                 Author + drafted + vote tiles
                 ========================= */}
              <Typography sx={{ ...sectionLabelSx, mb: 0.8 }}>Voting Snapshot</Typography>
              <Grid container spacing={1} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    {proposalAuthorAddress ? (
                      <Typography variant="subtitle1" sx={{ m: 0 }}>
                        Author:&nbsp;
                        <ExplorerView
                          showSolanaProfile={true}
                          memberMap={memberMap}
                          grapeArtProfile={true}
                          address={proposalAuthorAddress}
                          type="address"
                          shorten={8}
                          hideTitle={false}
                          style="text"
                          color="white"
                          fontSize="12px"
                        />
                        <Box
                          component="span"
                          sx={{
                            ml: 0.7,
                            fontSize: '0.73rem',
                            color: isFlaggedMaliciousAuthor ? 'rgba(255,120,120,0.88)' : 'rgba(255,255,255,0.6)',
                          }}
                        >
                          {`• ${authorInlineMeta}`}
                        </Box>
                      </Typography>
                    ) : thisitem.account?.tokenOwnerRecord ? (
                      <Typography variant="subtitle1" sx={{ m: 0 }}>
                        Author Record:&nbsp;
                        <ExplorerView
                          address={new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()}
                          type="address"
                          shorten={8}
                          hideTitle={false}
                          style="text"
                          color="white"
                          fontSize="12px"
                        />
                        <Box
                          component="span"
                          sx={{
                            ml: 0.7,
                            fontSize: '0.73rem',
                            color: isFlaggedMaliciousAuthor ? 'rgba(255,120,120,0.88)' : 'rgba(255,255,255,0.6)',
                          }}
                        >
                          {`• ${authorInlineMeta}`}
                        </Box>
                      </Typography>
                    ) : null}

	                    <Tooltip title="Drafted at">
                          <Chip
                            size="small"
                            label={moment.unix(Number(thisitem.account?.draftAt)).format("MMMM D, YYYY, h:mm a")}
                            sx={{
                              height: 24,
                              borderRadius: '8px',
                              bgcolor: 'rgba(255,255,255,0.10)',
                              color: 'rgba(255,255,255,0.95)',
                              border: '1px solid rgba(255,255,255,0.1)',
                            }}
                          />
	                    </Tooltip>
                  </Stack>

                      <Box sx={{ mt: 0.85, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={`Type: ${proposalTargetLabel} Proposal`}
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.04)',
                            color: 'rgba(255,255,255,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                      </Box>
	                </Grid>

                <Grid item xs={12} md={6} sx={{ display: "flex", justifyContent: { xs: "center", md: "flex-end" } }}>
                  {thisitem?.account?.voteType?.type === 1 ? null : (
                    <Grid container spacing={1} sx={{ maxWidth: 520 }} justifyContent="center">
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                          
                            {realm && (
                              <VoteForProposal
                                title={`${
                                  thisitem.account?.options && thisitem.account?.options.length >= 0
                                    ? forVotes
                                      ? (+((forVotes / 10 ** tokenDecimals)).toFixed(0)).toLocaleString()
                                      : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.options[0].voteWeight) / Math.pow(10, tokenDecimals)).toFixed(0)))
                                    : forVotes
                                    ? (+((forVotes / 10 ** tokenDecimals)).toFixed(0)).toLocaleString()
                                    : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.yesVotesCount) / Math.pow(10, tokenDecimals)).toFixed(0)))
                                }`}
                                subtitle={`For ${
                                  forVotes
                                    ? (forVotes / (forVotes + againstVotes) * 100).toFixed(2) + "%"
                                    : (thisitem.account?.options &&
                                        thisitem.account?.options[0]?.voteWeight &&
                                        thisitem?.account?.denyVoteWeight &&
                                        Number(thisitem.account?.options[0].voteWeight) > 0)
                                    ? (((Number(thisitem.account?.options[0].voteWeight)) / ((Number(thisitem.account?.denyVoteWeight)) + (Number(thisitem.account?.options[0].voteWeight)))) * 100).toFixed(2) + "%"
                                    : thisitem.account.yesVotesCount
                                    ? (Number(thisitem.account.yesVotesCount) / (Number(thisitem.account.noVotesCount) + Number(thisitem.account.yesVotesCount)) * 100).toFixed(2) + "%"
                                    : "0%"
                                }`}
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
                            )}
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
                            {realm && (
                              <VoteForProposal
                                title={`${
                                  thisitem.account?.denyVoteWeight
                                    ? againstVotes
                                      ? getFormattedNumberToLocale(formatAmount(+(againstVotes / 10 ** tokenDecimals).toFixed(0)))
                                      : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.denyVoteWeight) / Math.pow(10, tokenDecimals)).toFixed(0)))
                                    : againstVotes
                                    ? getFormattedNumberToLocale(formatAmount(+(againstVotes / 10 ** tokenDecimals).toFixed(0)))
                                    : getFormattedNumberToLocale(formatAmount(+(Number(thisitem.account.noVotesCount) / Math.pow(10, tokenDecimals)).toFixed(0)))
                                }`}
                                subtitle={`Against ${
                                  againstVotes
                                    ? (againstVotes / (forVotes + againstVotes) * 100).toFixed(2) + "%"
                                    : (thisitem.account?.options &&
                                        thisitem.account?.options[0]?.voteWeight &&
                                        thisitem?.account?.denyVoteWeight &&
                                        Number(thisitem.account?.options[0].voteWeight) > 0)
                                    ? (((Number(thisitem.account?.denyVoteWeight) / Math.pow(10, tokenDecimals)) / ((Number(thisitem.account?.denyVoteWeight) / Math.pow(10, tokenDecimals)) + (Number(thisitem.account?.options[0].voteWeight) / Math.pow(10, tokenDecimals)))) * 100).toFixed(2) + "%"
                                    : thisitem.account.noVotesCount
                                    ? (Number(thisitem.account.noVotesCount) / (Number(thisitem.account.noVotesCount) + Number(thisitem.account.yesVotesCount)) * 100).toFixed(2) + "%"
                                    : "0%"
                                }`}
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
                                governanceRules={thisGovernance}
                              />
                            )}
                        </Box>
                      </Grid>
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </Box>
                        

	                        <Divider sx={sectionDividerSx} />

                        <Grid container spacing={1.25} sx={{ mb: 1.25 }}>
                            <Grid item md={8} sm={12} xs={12} sx={{ mt: { xs: 1, md: 1.5 } }}>
                                <Box sx={{
                                    p: { xs: 1, sm: 1.25 },
                                    ...panelSx,
                                }}>
                                    <Typography sx={{ ...sectionLabelSx, ml: { xs: 0.75, sm: 1 }, mb: 0.75 }}>Proposal Details</Typography>
                                    {!hasProposalDescription && (
                                        <Box sx={{ alignItems: 'left', textAlign: 'left', m: { xs: 0.75, sm: 1 } }}>
                                            <Typography
                                                variant='h6'
                                                sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1rem', sm: '1.12rem', md: '1.2rem' } }}
                                            >
                                                {thisitem.account?.name}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Box sx={{ alignItems: "left", textAlign: "left", m: { xs: 0.75, sm: 1 } }}>
                                    {irysUrl ? (
                                          <Box sx={{ alignItems: "left", textAlign: "left" }}>
                                                <Box
                                                    sx={{
                                                        border: "1px solid rgba(255,255,255,0.10)",
                                                        borderRadius: "14px",
                                                        p: { xs: 1, sm: 1.25 },
                                                        bgcolor: 'rgba(0,0,0,0.14)',
                                                    }}
                                                >
                                                {irysLoading ? (
                                                    <Typography variant="body2">Loading Irys…</Typography>
                                                ) : irysError ? (
                                                    <Typography variant="body2" color="error">
                                                    {irysError}
                                                    </Typography>
                                                ) : (
                                                    <div
                                                    // safe because we sanitized with DOMPurify
                                                    dangerouslySetInnerHTML={{ __html: irysHtml || "" }}
                                                    style={{
                                                        // Make it look good in your dark UI
                                                        fontSize: 14,
                                                        lineHeight: 1.7,
                                                        wordBreak: "break-word",
                                                    }}
                                                    />
                                                )}
                                                </Box>

                                                <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                                <Button
                                                    color="inherit"
                                                    target="_blank"
                                                    href={irysUrl}
                                                    sx={{ borderRadius: "17px" }}
                                                >
                                                    View Irys
                                                </Button>
                                                </Box>
                                            </Box>
                                        ) : gist ? (
                                        // --- your existing GIST branch unchanged ---
                                        <Box sx={{ alignItems: "left", textAlign: "left" }}>
                                        <Box
                                            sx={{
                                                border: "1px solid rgba(255,255,255,0.10)",
                                                borderRadius: "14px",
                                                p: { xs: 0.75, sm: 1 },
                                                bgcolor: 'rgba(0,0,0,0.14)',
                                            }}
                                        >
                                            <Typography variant="body2">
                                            <ErrorBoundary>
                                                {window.location.hostname !== "localhost" ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkImages]}
                                                    children={proposalDescription}
                                                    components={{
                                                    img: ({ node, ...props }) => (
                                                        <img {...props} style={{ width: "100%", height: "auto" }} />
                                                    ),
                                                    a: ({ node, ...props }) => {
                                                        const href = props.href || "";
                                                        const safe = /^(https?:|mailto:|tel:|#)/i.test(href);
                                                        return (
                                                        <a
                                                            {...props}
                                                            href={safe ? href : undefined}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color: "#1976d2", textDecoration: "underline" }}
                                                        >
                                                            {props.children}
                                                        </a>
                                                        );
                                                    },
                                                    }}
                                                />
                                                ) : (
                                                <p>Markdown rendering is disabled on localhost.</p>
                                                )}
                                            </ErrorBoundary>
                                            </Typography>
                                        </Box>

                                        <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                            <Button
                                            color="inherit"
                                            target="_blank"
                                            href={thisitem.account?.descriptionLink}
                                            sx={{ borderRadius: "17px" }}
                                            >
                                            <GitHubIcon sx={{ mr: 1 }} /> GIST
                                            </Button>
                                        </Box>
                                        </Box>
                                    ) : (
                                        // --- your existing non-gist branch unchanged ---
                                        <>
                                        {gDocs ? (
                                            <Box sx={{ alignItems: "left", textAlign: "left" }}>
                                            <Grid style={{ border: "none", padding: 4 }}>
                                                <iframe
                                                src={thisitem.account?.descriptionLink}
                                                width="100%"
                                                height={`${detailsEmbedHeight}px`}
                                                style={{ border: "none" }}
                                                />
                                            </Grid>

                                            <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                                <Button
                                                color="inherit"
                                                target="_blank"
                                                href={thisitem.account?.descriptionLink}
                                                sx={{ borderRadius: "17px" }}
                                                >
                                                <ArticleIcon sx={{ mr: 1 }} /> Google Docs
                                                </Button>
                                            </Box>
                                            </Box>
                                        ) : (
                                            <>
                                            {thisitem.account?.descriptionLink ? (
                                                <>
                                                <Typography
                                                    variant="body1"
                                                    color="gray"
                                                    sx={{ display: "flex", alignItems: "center" }}
                                                >
                                                    <RenderDescription
                                                    title={thisitem.account?.name}
                                                    description={thisitem.account?.descriptionLink}
                                                    fallback={proposalPk?.toBase58()}
                                                    />
                                                </Typography>

                                                {gitBook && (
                                                    <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                                    <Button
                                                        color="inherit"
                                                        target="_blank"
                                                        href={thisitem.account?.descriptionLink}
                                                        sx={{ borderRadius: "17px" }}
                                                    >
                                                        <ArticleIcon sx={{ mr: 1 }} /> GitBook
                                                    </Button>
                                                    </Box>
                                                )}
                                                </>
                                            ) : (
                                                <Typography
                                                variant="body1"
                                                color="gray"
                                                sx={{ display: "flex", alignItems: "center" }}
                                                >
                                                <RenderDescription
                                                    title={thisitem.account?.name}
                                                    description={thisitem.account?.descriptionLink}
                                                    fallback={proposalPk?.toBase58()}
                                                />
                                                </Typography>
                                            )}
                                            </>
                                        )}
                                        </>
                                    )}
                                    </Box>
                                </Box>
                            </Grid>
                            <Grid item md={4} sm={12} xs={12} sx={{ mt: { xs: 0.5, md: 1.5 } }}>
                                <Box
                                    sx={{
                                        p: { xs: 1, sm: 1.25 },
                                        ml: { xs: 0, md: 1 },
                                        position: { xs: 'relative', md: 'sticky' },
                                        top: { xs: 'auto', md: 10 },
                                        ...panelSx,
                                    }}
                                >
                                    <Typography sx={{ ...sectionLabelSx, ml: { xs: 0.75, sm: 1 }, mt: 0.25, mb: 0.85 }}>Governance Actions</Typography>
                                    <Grid container>
                                        <Grid item xs={12} key={1}>
                                            
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

                                            {governingMintInfo &&
                                            <>

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
                                                                    :
                                                                    <>Passing</>
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

                                                <VetoVoteRow
                                                    realm={realm}
                                                    proposal={thisitem}
                                                    memberMap={memberMap}
                                                    councilVoterRecord={councilVoterRecord}
                                                    publicKey={publicKey}
                                                    sendTransaction={sendTransaction}
                                                    getVotingParticipants={getVotingParticipants}
                                                    vetoCount={vetoCount ?? undefined}
                                                    vetoVoters={vetoVoters}
                                                    />


                                                {
                                                (publicKey &&
                                                    +thisitem.account.state === 2 &&
                                                    (() => {
                                                    // Inline function to check if the proposal has ended including the cooldown time
                                                    const signingOffAt = Number(thisitem.account?.signingOffAt || 0);
                                                    const baseVotingTime = Number(thisGovernance.account?.config?.baseVotingTime || 0);
                                                    const votingCoolOffTime = Number(thisGovernance.account?.config?.votingCoolOffTime || 0);

                                                    // Calculate end times
                                                    const votingEndTime = signingOffAt + baseVotingTime;
                                                    const totalEndTime = votingEndTime + votingCoolOffTime;
                                                    const currentTime = moment().unix();
                                                    
                                                    // Return true if the current time has passed the total end time including cooldown
                                                    return currentTime >= totalEndTime;
                                                    })()
                                                ) ? (
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
                                                            mode={5} // finalize
                                                            state={thisitem.account.state}
                                                        />
                                                        </Grid>
                                                    </Box>
                                                    </>
                                                ) : (
                                                    <></>
                                                )
                                                }
                                                        

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

                                                    {
                                                        <Box sx={{ my: 3, mx: 2 }}>
                                                            <Grid container alignItems="center">
                                                                <Grid item xs>
                                                                    <Typography gutterBottom variant="subtitle1" component="div">
                                                                        Wallet
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item>
                                                                    {governanceNativeWallet &&
                                                                    <Typography gutterBottom variant="body1" component="div">
                                                                        <ExplorerView 
                                                                            address={governanceNativeWallet && governanceNativeWallet.toBase58()}
                                                                            governance={thisitem.account.governance && thisitem.account.governance.toBase58()}
                                                                            dao={governanceAddress && new PublicKey(governanceAddress).toBase58()}
                                                                            type='address' 
                                                                            shorten={4} 
                                                                            hideTitle={false} 
                                                                            style='text' color='white' fontSize='14px' />
                                                                    </Typography>
                                                                    }
                                                                </Grid>
                                                            </Grid>
                                                            <Typography color="text.secondary" variant="caption">
                                                                Rules {thisitem.account.governance.toBase58()}
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

                                                    
                                                   {(publicKey && proposalSignatories && proposalSignatories.length > 0) &&
                                                        <>
                                                            <Box sx={{ my: 3, mx: 2 }}>
                                                                <Grid container alignItems="center">
                                                                    <Grid item xs>
                                                                        <Typography gutterBottom variant="subtitle1" component="div">
                                                                            Signers {(proposalSignatories.length && proposalSignatories.length > 1) ? `${proposalSignatories.length}` : ``}
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
                                                                                    
                                                                                    {(filteredItem.account.signatory.toBase58() === publicKey.toBase58() && filteredItem.account.signedOff === false) ? 
                                                                                        <>
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
                                                                                        </>
                                                                                    :
                                                                                        <>
                                                                                            
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
                                                                        <IntegratedGovernanceProposalDialogView 
                                                                            governanceAddress={governanceAddress}
                                                                            governanceRulesWallet={thisitem.account.governance}
                                                                            governingTokenMint={thisitem.account.governingTokenMint}
                                                                            proposalAuthor={thisitem.account.tokenOwnerRecord}
                                                                            payerWallet={publicKey}
                                                                            governanceLookup={governanceLookup}
                                                                            editProposalAddress={thisitem.pubkey}
                                                                            setReload={setReload}
                                                                            title="Add Instructions"
                                                                            useButton={5}
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
                                                                        proposalInstructions={proposalInstructions}
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
                                    mb: 1.5,
                                    width: '100%',
                                    ...panelSx,
                                }}
                            >
                                
                                    <Typography sx={{ ...sectionLabelSx, ml: 1.25, mt: 1.1, mb: 0.9 }}>Executable Plan</Typography>
                                
                                    <ListItemButton 
                                        onClick={handleClickOpenInstructions}
                                        sx={{
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius:'17px',
                                            borderBottomLeftRadius: openInstructions ? '0' : '17px',
                                            borderBottomRightRadius: openInstructions ? '0' : '17px',
                                            borderBottom: openInstructions ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                            py: 1.15,
                                        }}
                                    >
                                        <ListItemIcon>
                                        <CodeIcon />
                                        </ListItemIcon>
                                        <ListItemText primary={<>
                                            Instructions
                                            &nbsp;{proposalTransactionCount}
                                            </>
                                        } />
                                            {openInstructions ? <ExpandLess /> : <ExpandMoreIcon />}
                                    </ListItemButton>
                                    <Collapse in={openInstructions} timeout="auto" unmountOnExit
                                        sx={{
                                            borderBottomLeftRadius: openInstructions ? '17px' : '0',
                                            borderBottomRightRadius: openInstructions ? '17px' : '0', 
                                            backgroundColor:'rgba(14,24,40,0.26)'}}
                                    >
                                        
                                        <Box>
                                            {(instructionTransferDetails && instructionTransferDetails.length > 0) && (
                                                <Box
                                                    sx={{
                                                        p: { xs: 0.85, sm: 1 },
                                                        m: { xs: 0.85, sm: 1 },
                                                        borderRadius: '17px',
                                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                    }}
                                                >
                                                    <Typography variant="subtitle1">
                                                        Instructions Summary
                                                    </Typography>
                                                    <Typography variant="caption">
                                                        {getGroupedInstructions(instructionTransferDetails).map((item, key, array) => (
                                                            <Grid container direction="row" key={item.mint}>
                                                                <Grid item>
                                                                    {(item && item.totalAmount > 0 && Object.keys(item.destinationAmounts).length > 0) && (
                                                                        <>
                                                                            <ExplorerView
                                                                                address={item.mint}
                                                                                type="address"
                                                                                useLogo={item.logoURI}
                                                                                title={`${item.totalAmount.toLocaleString()} ${item.name || trimAddress(item.mint)} to ${Object.keys(item.destinationAmounts).length} unique wallet${Object.keys(item.destinationAmounts).length > 1 ? 's' : ''}`}
                                                                                hideTitle={false}
                                                                                style="text"
                                                                                color="white"
                                                                                fontSize="12px"
                                                                                showNftData={true}
                                                                            />

                                                                            {(publicKey && key === array.length - 1 && thisitem.account?.state === 0) && (
                                                                                <>
                                                                                    <GrapeVerificationSpeedDial
                                                                                        address={governanceNativeWallet.toBase58()}
                                                                                        destinationWalletArray={destinationWalletArray}
                                                                                        setVerifiedDestinationWalletArray={setVerifiedDestinationWalletArray}
                                                                                    />
                                                                                    <GrapeVerificationDAO
                                                                                        governanceAddress={governanceAddress}
                                                                                        governanceLookup={governanceLookup}
                                                                                        address={governanceNativeWallet.toBase58()}
                                                                                        destinationWalletArray={destinationWalletArray}
                                                                                        setVerifiedDAODestinationWalletArray={setVerifiedDAODestinationWalletArray}
                                                                                    />
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </Grid>
                                                            </Grid>
                                                        ))}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </Box>
                                        
                                            
                                        <InstructionTableView   
                                            proposalInstructions={proposalInstructions}
                                            proposal={thisitem} 
                                            governanceNativeWallet={governanceNativeWallet}
                                            governanceRulesWallet={thisitem.account.governance}
                                            governingTokenMint={thisitem.account.governingTokenMint} 
                                            setReload={setReload} 
                                            realm={realm} 
                                            proposalAuthor={proposalAuthor} 
                                            state={thisitem.account.state} 
                                            cachedTokenMeta={cachedTokenMeta} 
                                            setInstructionTransferDetails={setInstructionTransferDetails} 
                                            instructionTransferDetails={instructionTransferDetails} 
                                            memberMap={memberMap} 
                                            tokenMap={tokenMap} 
                                            //instruction={item} 
                                            //index={index} 
                                            verifiedDestinationWalletArray={verifiedDestinationWalletArray}
                                            verifiedDAODestinationWalletArray={verifiedDAODestinationWalletArray}
                                            instructionOwnerRecord={instructionOwnerRecord} 
                                            instructionOwnerRecordATA={instructionOwnerRecordATA}
                                        />
                                        

                                        {/*
                                        <Timeline>
                                            {proposalInstructions[0].account.instructions.length > 1 ?
                                            <>
                                                {proposalInstructions[0].account.instructions && (proposalInstructions[0].account.instructions).map((item: any, index:number) => (
                                                    <>
                                                    
                                                        <InstructionView proposal={thisitem} governingTokenMint={thisitem.account.governingTokenMint} setReload={setReload} realm={realm} proposalAuthor={proposalAuthor} state={thisitem.account.state} cachedTokenMeta={cachedTokenMeta} setInstructionTransferDetails={setInstructionTransferDetails} instructionTransferDetails={instructionTransferDetails} memberMap={memberMap} tokenMap={tokenMap} instruction={item} index={index} instructionOwnerRecord={instructionOwnerRecord} instructionOwnerRecordATA={instructionOwnerRecordATA} />
                                                    </>
                                                ))}
                                            </>
                                            :
                                            <>
                                                {proposalInstructions && (proposalInstructions).map((item: any, index:number) => (
                                                    <InstructionView proposal={thisitem} governingTokenMint={thisitem.account.governingTokenMint} setReload={setReload} realm={realm} proposalAuthor={proposalAuthor} state={thisitem.account.state} cachedTokenMeta={cachedTokenMeta} setInstructionTransferDetails={setInstructionTransferDetails} instructionTransferDetails={instructionTransferDetails} memberMap={memberMap} tokenMap={tokenMap} instruction={item} index={index} instructionOwnerRecord={instructionOwnerRecord} instructionOwnerRecordATA={instructionOwnerRecordATA} />
                                                ))}
                                            </>
                                            }
                                        </Timeline>
                                        */}
                                        
                                    </Collapse>
                                    
                                </Box>
                            
                            </>
                        }
                            
                        {propVoteType &&
                            <Box sx={{
                                alignItems: 'center',
                                textAlign: 'center',
                                p: 1.25,
                                mb: 2,
                                ...panelSx,
                            }}>
                                <Typography sx={{ ...sectionLabelSx, mb: 0.8 }}>Voting Breakdown</Typography>
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

                        <Box sx={{ mb: 2, ...panelSx, p: 1.1 }}>
                            <Typography sx={{ ...sectionLabelSx, mb: 0.7 }}>Realtime Feed</Typography>
                            <GovernanceRealtimeInfo governanceAddress={proposalPk} title={'Latest Activity'} tokenMap={tokenMap} />
                        </Box>

                        <Box sx={{ mb: 2, ...panelSx }}>
                            <Typography sx={{ ...sectionLabelSx, ml: 1.25, mt: 1.1, mb: 0.9 }}>Discussion</Typography>
                            <ListItemButton
                                onClick={handleClickOpenDiscussion}
                                sx={{
                                    mx: 1,
                                    mb: openDiscussion ? 0 : 1,
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '14px',
                                    borderBottomLeftRadius: openDiscussion ? 0 : '14px',
                                    borderBottomRightRadius: openDiscussion ? 0 : '14px',
                                    borderBottom: openDiscussion ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                    py: 1,
                                }}
                            >
                                <ListItemIcon>
                                    <SegmentIcon />
                                </ListItemIcon>
                                <ListItemText primary="Conversation Thread" />
                                {openDiscussion ? <ExpandLess /> : <ExpandMoreIcon />}
                            </ListItemButton>
                            <Collapse
                                in={openDiscussion}
                                timeout="auto"
                                unmountOnExit
                                sx={{
                                    mx: 1,
                                    mb: 1,
                                    borderBottomLeftRadius: '14px',
                                    borderBottomRightRadius: '14px',
                                    backgroundColor: 'rgba(14,24,40,0.26)',
                                }}
                            >
                                <Box sx={{ p: { xs: 0.75, sm: 1 } }}>
                                    <GovernanceDiscussion
                                        governanceAddress={governanceAddress}
                                        proposalAddress={thisitem?.pubkey}
                                        governanceRulesWallet={thisitem.account.governance}
                                        governingTokenMint={thisitem.account.governingTokenMint}
                                        proposalAuthor={thisitem.account.tokenOwnerRecord}
                                        proposalInstructions={proposalInstructions}
                                        payerWallet={publicKey}
                                        governanceLookup={governanceLookup}
                                        realm={realm}
                                        memberMap={memberMap}
                                        proposalSignatories={proposalSignatories}
                                    />
                                </Box>
                            </Collapse>
                        </Box>

                        {solanaVotingResultRows ?
                            <Box sx={{ p: 1.1, ...panelSx }}>
                                <Typography sx={{ ...sectionLabelSx, mb: 0.8 }}>Voter Ledger</Typography>
                                <div style={{ height: votesTableHeight, width: '100%' }}>
                                <div style={{ display: 'flex', height: '100%' }}>
                                    <div style={{ flexGrow: 1 }}>
                                        
                                            <DataGrid
                                                rows={solanaVotingResultRows}
                                                columns={votingresultcolumns}
                                                pageSize={25}
                                                rowsPerPageOptions={[]}
                                                sx={{
                                                    borderRadius:'17px',
                                                    borderColor:'rgba(255,255,255,0.16)',
                                                    background: 'rgba(12,18,28,0.7)',
                                                    '& .MuiDataGrid-columnHeaders': {
                                                        background: 'rgba(255,255,255,0.04)',
                                                        borderBottom: '1px solid rgba(255,255,255,0.12)',
                                                    },
                                                    '& .MuiDataGrid-row:nth-of-type(even)': {
                                                        backgroundColor: 'rgba(255,255,255,0.02)',
                                                    },
                                                    '& .MuiDataGrid-row:hover': {
                                                        backgroundColor: 'rgba(255,255,255,0.06)',
                                                    },
                                                    '& .MuiDataGrid-cell':{
                                                        borderColor:'rgba(255,255,255,0.14)'
                                                    }}}
                                                sortingOrder={['asc', 'desc', null]}
                                                disableSelectionOnClick
                                            />
                                    </div>
                                </div>
                            </div>
                            </Box>
                        :
                            <LinearProgress color="inherit" />
                        }
                    </>
                    :
                        <Grid 
                            xs={12}
                            sx={{textAlign:'center'}}
                        >
                            <CircularProgress color="inherit" /><br/>
                            <small>{loadingMessage || 'Loading...'}</small>
                        </Grid>
                    }
                </Box>
            </ThemeProvider>
        </>
    )
}
