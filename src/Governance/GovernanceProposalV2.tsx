import { 
    getGovernanceAccounts,
    pubkeyFilter,
    ProposalTransaction,
    getNativeTreasuryAddress,
    getProposal,
} from '@solana/spl-governance';
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
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    decodeInstruction as decodeSplTokenInstruction,
    TokenInstruction as SplTokenInstruction,
    AuthorityType,
} from "@solana/spl-token-v2";
import {
    getCreateMetadataAccountV3InstructionDataSerializer,
    getUpdateMetadataAccountV2InstructionDataSerializer,
    getCreateMasterEditionV3InstructionDataSerializer,
    getVerifyCollectionInstructionDataSerializer,
    getSetAndVerifyCollectionInstructionDataSerializer,
    getSetAndVerifySizedCollectionItemInstructionDataSerializer,
} from "@metaplex-foundation/mpl-token-metadata";
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
import { hasGovernanceAuthorityForRecord } from './Proposals/proposalAuthority';

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

function toPositiveUnix(value: any): number | null {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
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

const getVoteSideFromRecord = (record: any): 'yes' | 'no' | 'unknown' | null => {
    const vote =
        record?.account?.vote ??
        record?.vote?.vote ??
        record?.quorumWeight?.vote;
    if (vote && vote?.voteType !== undefined && vote?.voteType !== null) {
        const voteType = Number(vote.voteType);
        if (voteType === 0) return 'yes';
        if (voteType === 1) return 'no';
        return 'unknown';
    }

    const legacyYes = parseRawVoteWeight(
        record?.account?.voteWeight?.yes ??
        record?.vote?.legacyYes ??
        record?.vote?.voteWeight?.yes ??
        record?.quorumWeight?.legacyYes
    );
    const legacyNo = parseRawVoteWeight(
        record?.account?.voteWeight?.no ??
        record?.vote?.legacyNo ??
        record?.vote?.voteWeight?.no ??
        record?.quorumWeight?.legacyNo
    );
    if (legacyYes > 0n) return 'yes';
    if (legacyNo > 0n) return 'no';

    const voterWeight = parseRawVoteWeight(
        record?.account?.voterWeight ??
        record?.vote?.voterWeight ??
        record?.quorumWeight?.voterWeight
    );
    if (voterWeight > 0n) return 'unknown';

    return null;
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
    const [hasVotedSide, setHasVotedSide] = React.useState<'yes' | 'no' | 'unknown' | null>(null);
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

    const fetchLiveProposalFromRpc = React.useCallback(async () => {
        try {
            const proposalPkStr = toBase58Safe(proposalPk || thisitem?.pubkey);
            if (!proposalPkStr) return null;
            const liveProposal = await getProposal(RPC_CONNECTION, new PublicKey(proposalPkStr));
            if (!liveProposal) return null;

            setThisitem((prev: any) => {
                if (!prev) return liveProposal;
                const merged: any = {
                    ...prev,
                    ...liveProposal,
                    account: {
                        ...prev.account,
                        ...liveProposal.account,
                    },
                };
                if (!merged.instructions && prev?.instructions) {
                    merged.instructions = prev.instructions;
                }
                return merged;
            });

            return liveProposal;
        } catch (e) {
            console.log("Error fetching live proposal via RPC", e);
            return null;
        }
    }, [proposalPk, thisitem?.pubkey]);

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

    const proposalAuthorityRecord = React.useMemo(() => {
        const tor = normalizePkString(thisitem?.account?.tokenOwnerRecord);
        if (!tor) return null;
        return tokenOwnerRecordToMember.get(tor) || null;
    }, [thisitem, normalizePkString, tokenOwnerRecordToMember]);

    const proposalAuthorityRole = React.useMemo(() => {
        const wallet58 = publicKey?.toBase58?.();
        if (!wallet58) return null;
        return hasGovernanceAuthorityForRecord(proposalAuthorityRecord, wallet58)
            ? (
                normalizePkString(proposalAuthorityRecord?.account?.governingTokenOwner) === wallet58
                    ? 'owner'
                    : 'delegate'
            )
            : null;
    }, [proposalAuthorityRecord, publicKey, normalizePkString]);

    const canManageDraftProposal = React.useMemo(
        () => !!publicKey && !!proposalAuthorityRole && +thisitem?.account?.state === 0,
        [publicKey, proposalAuthorityRole, thisitem]
    );

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

        setLoadingMessage("Loading Proposal...");
            const gp = await getProposalNewIndexed(
                toBase58Safe(thisitem?.pubkey || proposalPk),
                thisitem.owner || realm.owner,
                governanceAddress
            );
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
                for (let glitem of (governanceLookup || [])){
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

                        // Step 2: Batch fetch all accounts using parsed account data so
                        // downstream token decoding can read mint/decimals consistently.
                        const pubkeyList = [...uniquePubkeys].map(key => new PublicKey(key));
                        const allResults = new Map();
                        const chunkSize = 100;

                        for (let i = 0; i < pubkeyList.length; i += chunkSize) {
                            const chunk = pubkeyList.slice(i, i + chunkSize);
                            const { value: infos } = await connection.getMultipleParsedAccounts(chunk);
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

                                const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEh84bYQNJ9Y7fA1aC33mW7zk1g";
                                const SPL_TOKEN_PROGRAM_ID = TOKEN_PROGRAM_ID.toBase58();
                                const TOKEN_PROGRAM_IDS = new Set([
                                    SPL_TOKEN_PROGRAM_ID,
                                    TOKEN_2022_PROGRAM_ID,
                                ]);
                                const tokenAuthorityLabels: Record<number, string> = {
                                    [AuthorityType.MintTokens]: "mint authority",
                                    [AuthorityType.FreezeAccount]: "freeze authority",
                                    [AuthorityType.AccountOwner]: "account owner",
                                    [AuthorityType.CloseAccount]: "close authority",
                                };
                                const resolvePubkeyString = (pk?: any): string | null => {
                                    try {
                                        if (!pk) return null;
                                        if (typeof pk?.toBase58 === "function") return pk.toBase58();
                                        return new PublicKey(pk).toBase58();
                                    } catch {
                                        return typeof pk === "string" ? pk : null;
                                    }
                                };
                                const buildTxInstruction = (programPk: PublicKey, ixLike: any) =>
                                    new TransactionInstruction({
                                        programId: programPk,
                                        keys: (ixLike?.accounts || []).map((key: any) => ({
                                            pubkey: new PublicKey(key.pubkey),
                                            isSigner: !!key.isSigner,
                                            isWritable: !!key.isWritable,
                                        })),
                                        data: Buffer.from(ixLike?.data || []),
                                    });
                                const getAccountInfoFromCache = (pk?: any) => {
                                    const address = resolvePubkeyString(pk);
                                    return address ? allResults.get(address) : null;
                                };
                                const getParsedAccountInfo = (pk?: any) => {
                                    const accountInfo = getAccountInfoFromCache(pk) as any;
                                    return accountInfo?.data?.parsed?.info || accountInfo?.value?.data?.parsed?.info || null;
                                };
                                const getTokenAccountMint = (pk?: any): string | null =>
                                    getParsedAccountInfo(pk)?.mint || null;
                                const getTokenAccountDecimals = (pk?: any): number =>
                                    Number(getParsedAccountInfo(pk)?.tokenAmount?.decimals || 0);
                                const getTokenAccountOwner = (pk?: any): string | null =>
                                    getParsedAccountInfo(pk)?.owner || null;
                                const getTokenRecipientDisplay = (pk?: any) => {
                                    const destinationAta = resolvePubkeyString(pk);
                                    const tokenOwner = getTokenAccountOwner(destinationAta);
                                    return {
                                        destinationAta,
                                        tokenOwner,
                                        recipientWallet: tokenOwner || destinationAta,
                                    };
                                };
                                const getTokenPresentation = (mint?: string | null) => {
                                    let symbol = mint ? `${mint.slice(0, 3)}...${mint.slice(-3)}` : null;
                                    let name = symbol;
                                    let logoURI = null;

                                    if (mint && tokenMap) {
                                        const tmap = tokenMap.get(mint);
                                        if (tmap) {
                                            symbol = tmap.symbol || symbol;
                                            name = tmap.name || symbol;
                                            logoURI = tmap.logoURI || null;
                                        }
                                    }

                                    return { symbol, name, logoURI };
                                };
                                const createTokenAmountUi = (amountRaw: bigint | number | string, decimals: number) => {
                                    const amountBn = new BN(amountRaw.toString());
                                    const amountDecimal = toDecimalAmount(amountBn, decimals);
                                    const amountUi = amountDecimal.includes(".")
                                        ? formatAmount(amountDecimal)
                                        : Number(amountDecimal).toLocaleString();
                                    return {
                                        amountDecimal,
                                        amountUi,
                                        amountValue: parseFloat(amountUi.replace(/,/g, "")),
                                    };
                                };
                                const governanceVoteLabel = (vote: any) => {
                                    if (!vote || typeof vote !== "object") return "vote";
                                    if ("approve" in vote) return "approve";
                                    if ("deny" in vote) return "deny";
                                    if ("veto" in vote) return "veto";
                                    if ("abstain" in vote) return "abstain";
                                    return Object.keys(vote)[0] || "vote";
                                };
                                const compactJson = (value: any) => {
                                    try {
                                        return JSON.stringify(value);
                                    } catch {
                                        return String(value);
                                    }
                                };
                                const describeVoteThreshold = (value: any) => {
                                    if (!value || typeof value !== "object") return null;
                                    if ("yesVotePercentage" in value) {
                                        return `yes ${value.yesVotePercentage}%`;
                                    }
                                    if ("quorumPercentage" in value) {
                                        return `quorum ${value.quorumPercentage}%`;
                                    }
                                    if ("disabled" in value) {
                                        return "disabled";
                                    }
                                    return compactJson(value);
                                };
                                const describeVoteTipping = (value: any) => {
                                    if (!value || typeof value !== "object") return null;
                                    if ("strict" in value) return "strict";
                                    if ("early" in value) return "early";
                                    if ("disabled" in value) return "disabled";
                                    return compactJson(value);
                                };
                                const describeMintMaxVoterWeightSource = (value: any) => {
                                    if (!value || typeof value !== "object") return null;
                                    if ("supplyFraction" in value) {
                                        return `supply fraction ${value.supplyFraction}`;
                                    }
                                    if ("absolute" in value) {
                                        return `absolute ${value.absolute}`;
                                    }
                                    return compactJson(value);
                                };
                                const describeTokenConfigArgs = (value: any) => {
                                    if (!value || typeof value !== "object") return null;
                                    const parts = [];
                                    if (value.useVoterWeightAddin) parts.push("voter-weight addin");
                                    if (value.useMaxVoterWeightAddin) parts.push("max-voter-weight addin");
                                    if (value.tokenType) parts.push(`token type ${compactJson(value.tokenType)}`);
                                    return parts.join(", ");
                                };
                                const summarizeGovernanceConfig = (config: any) => {
                                    if (!config || typeof config !== "object") return null;
                                    const parts = [];
                                    const communityThreshold = describeVoteThreshold(
                                        config.communityVoteThreshold
                                    );
                                    const councilThreshold = describeVoteThreshold(
                                        config.councilVoteThreshold
                                    );
                                    const communityTipping = describeVoteTipping(
                                        config.communityVoteTipping
                                    );
                                    const councilTipping = describeVoteTipping(
                                        config.councilVoteTipping
                                    );
                                    if (communityThreshold) {
                                        parts.push(`community threshold ${communityThreshold}`);
                                    }
                                    if (councilThreshold) {
                                        parts.push(`council threshold ${councilThreshold}`);
                                    }
                                    if (config.minCommunityWeightToCreateProposal !== undefined) {
                                        parts.push(
                                            `min community proposal weight ${config.minCommunityWeightToCreateProposal}`
                                        );
                                    }
                                    if (config.minCouncilWeightToCreateProposal !== undefined) {
                                        parts.push(
                                            `min council proposal weight ${config.minCouncilWeightToCreateProposal}`
                                        );
                                    }
                                    if (config.minTransactionHoldUpTime !== undefined) {
                                        parts.push(`hold up ${config.minTransactionHoldUpTime}s`);
                                    }
                                    if (config.votingBaseTime !== undefined) {
                                        parts.push(`base voting ${config.votingBaseTime}s`);
                                    }
                                    if (config.votingCoolOffTime !== undefined) {
                                        parts.push(`cool off ${config.votingCoolOffTime}s`);
                                    }
                                    if (communityTipping) {
                                        parts.push(`community tipping ${communityTipping}`);
                                    }
                                    if (councilTipping) {
                                        parts.push(`council tipping ${councilTipping}`);
                                    }
                                    if (config.depositExemptProposalCount !== undefined) {
                                        parts.push(
                                            `deposit exempt proposals ${config.depositExemptProposalCount}`
                                        );
                                    }
                                    return parts.join(", ");
                                };
                                const summarizeRealmConfigArgs = (configArgs: any) => {
                                    if (!configArgs || typeof configArgs !== "object") return null;
                                    const parts = [];
                                    parts.push(
                                        configArgs.useCouncilMint ? "council mint enabled" : "council mint disabled"
                                    );
                                    if (configArgs.minCommunityWeightToCreateGovernance !== undefined) {
                                        parts.push(
                                            `min community governance weight ${configArgs.minCommunityWeightToCreateGovernance}`
                                        );
                                    }
                                    const maxWeightSource = describeMintMaxVoterWeightSource(
                                        configArgs.communityMintMaxVoterWeightSource
                                    );
                                    if (maxWeightSource) {
                                        parts.push(`community max voter weight ${maxWeightSource}`);
                                    }
                                    const communityTokenConfig = describeTokenConfigArgs(
                                        configArgs.communityTokenConfigArgs
                                    );
                                    if (communityTokenConfig) {
                                        parts.push(`community token config ${communityTokenConfig}`);
                                    }
                                    const councilTokenConfig = describeTokenConfigArgs(
                                        configArgs.councilTokenConfigArgs
                                    );
                                    if (councilTokenConfig) {
                                        parts.push(`council token config ${councilTokenConfig}`);
                                    }
                                    return parts.join(", ");
                                };
                                const describeGovernanceInstruction = (decodedIx: any, ixLike: any) => {
                                    const name = decodedIx?.name || "governance";
                                    const data = decodedIx?.data || {};
                                    switch (name) {
                                        case "createGovernance":
                                            return `Create account governance for ${shortPk(resolvePubkeyString(ixLike?.accounts?.[2]?.pubkey))}${summarizeGovernanceConfig(data?.config) ? ` with ${summarizeGovernanceConfig(data?.config)}` : ""}`;
                                        case "createProgramGovernance":
                                            return `Create program governance for ${shortPk(resolvePubkeyString(ixLike?.accounts?.[2]?.pubkey))}${data?.transferUpgradeAuthority ? " and transfer upgrade authority" : ""}${summarizeGovernanceConfig(data?.config) ? ` with ${summarizeGovernanceConfig(data?.config)}` : ""}`;
                                        case "createMintGovernance":
                                            return `Create mint governance for ${shortPk(resolvePubkeyString(ixLike?.accounts?.[2]?.pubkey))}${data?.transferMintAuthorities ? " and transfer mint authorities" : ""}${summarizeGovernanceConfig(data?.config) ? ` with ${summarizeGovernanceConfig(data?.config)}` : ""}`;
                                        case "createTokenGovernance":
                                            return `Create token governance for ${shortPk(resolvePubkeyString(ixLike?.accounts?.[2]?.pubkey))}${data?.transferAccountAuthorities ? " and transfer account authorities" : ""}${summarizeGovernanceConfig(data?.config) ? ` with ${summarizeGovernanceConfig(data?.config)}` : ""}`;
                                        case "createNativeTreasury":
                                            return `Create native treasury for governance ${shortPk(resolvePubkeyString(ixLike?.accounts?.[0]?.pubkey))}`;
                                        case "createProposal":
                                            return `Create proposal ${data?.name ? `"${data.name}"` : ""}${Array.isArray(data?.options) && data.options.length ? ` with ${data.options.length} option${data.options.length > 1 ? "s" : ""}` : ""}`.trim();
                                        case "addSignatory":
                                            return `Add signatory ${shortPk(resolvePubkeyString(ixLike?.accounts?.[3]?.pubkey))}`;
                                        case "signOffProposal":
                                            return `Sign off proposal ${shortPk(resolvePubkeyString(ixLike?.accounts?.[1]?.pubkey))}`;
                                        case "insertTransaction":
                                            return `Insert transaction at option ${Number(data?.optionIndex ?? 0)} index ${Number(data?.index ?? 0)}`;
                                        case "removeTransaction":
                                            return `Remove proposal transaction ${shortPk(resolvePubkeyString(ixLike?.accounts?.[2]?.pubkey))}`;
                                        case "castVote":
                                            return `Cast ${governanceVoteLabel(data?.vote)} vote`;
                                        case "finalizeVote":
                                            return `Finalize vote for proposal ${shortPk(resolvePubkeyString(ixLike?.accounts?.[1]?.pubkey))}`;
                                        case "relinquishVote":
                                            return `Relinquish vote`;
                                        case "executeTransaction":
                                            return `Execute proposal transaction ${shortPk(resolvePubkeyString(ixLike?.accounts?.[2]?.pubkey))}`;
                                        case "setGovernanceConfig":
                                            return `Update governance config${summarizeGovernanceConfig(data?.config) ? `: ${summarizeGovernanceConfig(data?.config)}` : ""}`;
                                        case "setRealmConfig":
                                            return `Update realm config${summarizeRealmConfigArgs(data?.configArgs) ? `: ${summarizeRealmConfigArgs(data?.configArgs)}` : ""}`;
                                        case "addRequiredSignatory":
                                            return `Add required signatory ${shortPk(resolvePubkeyString(data?.signatory || ixLike?.accounts?.[1]?.pubkey || ixLike?.accounts?.[2]?.pubkey))}`;
                                        case "removeRequiredSignatory":
                                            return `Remove required signatory ${shortPk(resolvePubkeyString(ixLike?.accounts?.[1]?.pubkey))}`;
                                        default:
                                            return name;
                                    }
                                };
                                const describeMetaplexInstruction = (ixLike: any) => {
                                    const data = Uint8Array.from(ixLike?.data || []);
                                    const accounts = ixLike?.accounts || [];
                                    const metadataAcc = resolvePubkeyString(accounts?.[0]?.pubkey);
                                    const mint = resolvePubkeyString(accounts?.[1]?.pubkey);
                                    const updateAuthority = resolvePubkeyString(accounts?.[4]?.pubkey || accounts?.[1]?.pubkey);
                                    const serializers = [
                                        {
                                            name: "CreateMetadataAccountV3",
                                            serializer: getCreateMetadataAccountV3InstructionDataSerializer(),
                                            description: `Create metadata for mint ${shortPk(mint)}`
                                        },
                                        {
                                            name: "UpdateMetadataAccountV2",
                                            serializer: getUpdateMetadataAccountV2InstructionDataSerializer(),
                                            description: `Update metadata ${shortPk(metadataAcc)}`
                                        },
                                        {
                                            name: "CreateMasterEditionV3",
                                            serializer: getCreateMasterEditionV3InstructionDataSerializer(),
                                            description: `Create master edition for mint ${shortPk(mint)}`
                                        },
                                        {
                                            name: "VerifyCollection",
                                            serializer: getVerifyCollectionInstructionDataSerializer(),
                                            description: `Verify collection for metadata ${shortPk(metadataAcc)}`
                                        },
                                        {
                                            name: "SetAndVerifyCollection",
                                            serializer: getSetAndVerifyCollectionInstructionDataSerializer(),
                                            description: `Set and verify collection for metadata ${shortPk(metadataAcc)}`
                                        },
                                        {
                                            name: "SetAndVerifySizedCollectionItem",
                                            serializer: getSetAndVerifySizedCollectionItemInstructionDataSerializer(),
                                            description: `Set and verify sized collection item ${shortPk(metadataAcc)}`
                                        },
                                    ];

                                    for (const candidate of serializers) {
                                        try {
                                            candidate.serializer.deserialize(data);
                                            return {
                                                type: "MetaplexTokenMetadata",
                                                op: candidate.name,
                                                metadata: metadataAcc,
                                                mint,
                                                authority: updateAuthority,
                                                description: candidate.description,
                                                data: ixLike?.data,
                                            };
                                        } catch (_e) {
                                            continue;
                                        }
                                    }

                                    return {
                                        type: "MetaplexTokenMetadata",
                                        metadata: metadataAcc,
                                        mint,
                                        authority: updateAuthority,
                                        description: `Token metadata op on mint ${shortPk(mint)} (metadata ${shortPk(metadataAcc)})`,
                                        data: ixLike?.data,
                                    };
                                };
                                const decodeSupportedTokenInstruction = (programIdString: string, ixLike: any) => {
                                    if (!TOKEN_PROGRAM_IDS.has(programIdString)) return null;
                                    try {
                                        const programPk = new PublicKey(programIdString);
                                        const decoded = decodeSplTokenInstruction(
                                            buildTxInstruction(programPk, ixLike),
                                            programPk
                                        ) as any;
                                        const instructionEnum = decoded?.data?.instruction;
                                        const isChecked =
                                            instructionEnum === SplTokenInstruction.TransferChecked ||
                                            instructionEnum === SplTokenInstruction.ApproveChecked ||
                                            instructionEnum === SplTokenInstruction.MintToChecked ||
                                            instructionEnum === SplTokenInstruction.BurnChecked;
                                        const tokenProgramLabel =
                                            programIdString === TOKEN_2022_PROGRAM_ID ? "Token2022" : "Token";

                                        if (
                                            instructionEnum === SplTokenInstruction.Transfer ||
                                            instructionEnum === SplTokenInstruction.TransferChecked
                                        ) {
                                            const source = resolvePubkeyString(decoded?.keys?.source?.pubkey || decoded?.keys?.source || decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const destination = resolvePubkeyString(decoded?.keys?.destination?.pubkey || decoded?.keys?.destination);
                                            const {
                                                destinationAta,
                                                tokenOwner,
                                                recipientWallet,
                                            } = getTokenRecipientDisplay(destination);
                                            const mint =
                                                resolvePubkeyString(decoded?.keys?.mint?.pubkey || decoded?.keys?.mint) ||
                                                getTokenAccountMint(source);
                                            const decimals = Number(
                                                decoded?.data?.decimals ?? getTokenAccountDecimals(source)
                                            );
                                            const amount = createTokenAmountUi(decoded?.data?.amount || 0, decimals);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type:
                                                    programIdString === TOKEN_2022_PROGRAM_ID
                                                        ? "Token2022Transfer"
                                                        : isChecked
                                                        ? "TokenTransferChecked"
                                                        : "TokenTransfer",
                                                ix: instructionItem.pubkey,
                                                pubkey: recipientWallet || destination,
                                                sourcePubkey: source,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                amount: amount.amountValue,
                                                data: ixLike?.data,
                                                destinationAta,
                                                tokenOwner,
                                                recipientWallet,
                                                description: `${amount.amountUi} ${meta.symbol} to ${recipientWallet || destination}`,
                                            };
                                        }

                                        if (
                                            instructionEnum === SplTokenInstruction.MintTo ||
                                            instructionEnum === SplTokenInstruction.MintToChecked
                                        ) {
                                            const mint = resolvePubkeyString(decoded?.keys?.mint?.pubkey || decoded?.keys?.mint);
                                            const destination = resolvePubkeyString(decoded?.keys?.destination?.pubkey || decoded?.keys?.destination);
                                            const {
                                                destinationAta,
                                                tokenOwner,
                                                recipientWallet,
                                            } = getTokenRecipientDisplay(destination);
                                            const decimals = Number(
                                                decoded?.data?.decimals ?? getTokenAccountDecimals(destination)
                                            );
                                            const amount = createTokenAmountUi(decoded?.data?.amount || 0, decimals);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}MintTo`,
                                                ix: instructionItem.pubkey,
                                                pubkey: mint,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                amount: amount.amountValue,
                                                data: ixLike?.data,
                                                destinationAta,
                                                tokenOwner,
                                                recipientWallet,
                                                description: `Mint ${amount.amountUi} ${meta.symbol} to ${recipientWallet || destination}`,
                                            };
                                        }

                                        if (
                                            instructionEnum === SplTokenInstruction.Burn ||
                                            instructionEnum === SplTokenInstruction.BurnChecked
                                        ) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const mint = resolvePubkeyString(decoded?.keys?.mint?.pubkey || decoded?.keys?.mint) || getTokenAccountMint(account);
                                            const decimals = Number(
                                                decoded?.data?.decimals ?? getTokenAccountDecimals(account)
                                            );
                                            const amount = createTokenAmountUi(decoded?.data?.amount || 0, decimals);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}Burn`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                amount: amount.amountValue,
                                                data: ixLike?.data,
                                                description: `Burn ${amount.amountUi} ${meta.symbol} from ${shortPk(account)}`,
                                            };
                                        }

                                        if (
                                            instructionEnum === SplTokenInstruction.Approve ||
                                            instructionEnum === SplTokenInstruction.ApproveChecked
                                        ) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const delegate = resolvePubkeyString(decoded?.keys?.delegate?.pubkey || decoded?.keys?.delegate);
                                            const mint =
                                                resolvePubkeyString(decoded?.keys?.mint?.pubkey || decoded?.keys?.mint) ||
                                                getTokenAccountMint(account);
                                            const decimals = Number(
                                                decoded?.data?.decimals ?? getTokenAccountDecimals(account)
                                            );
                                            const amount = createTokenAmountUi(decoded?.data?.amount || 0, decimals);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}Approve`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                amount: amount.amountValue,
                                                data: ixLike?.data,
                                                description: `Approve ${shortPk(delegate)} to spend up to ${amount.amountUi} ${meta.symbol} from ${shortPk(account)}`,
                                            };
                                        }

                                        if (instructionEnum === SplTokenInstruction.Revoke) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const mint = getTokenAccountMint(account);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}Revoke`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                data: ixLike?.data,
                                                description: `Revoke delegate on ${shortPk(account)}`,
                                            };
                                        }

                                        if (instructionEnum === SplTokenInstruction.SetAuthority) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const authorityType = Number(decoded?.data?.authorityType ?? -1);
                                            const newAuthority = resolvePubkeyString(decoded?.data?.newAuthority);
                                            const authorityLabel =
                                                tokenAuthorityLabels[authorityType] || "authority";
                                            return {
                                                type: `${tokenProgramLabel}SetAuthority`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                data: ixLike?.data,
                                                description: `Set ${authorityLabel} on ${shortPk(account)} to ${newAuthority ? shortPk(newAuthority) : "none"}`,
                                            };
                                        }

                                        if (instructionEnum === SplTokenInstruction.CloseAccount) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const destination = resolvePubkeyString(decoded?.keys?.destination?.pubkey || decoded?.keys?.destination);
                                            const mint = getTokenAccountMint(account);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}CloseAccount`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                data: ixLike?.data,
                                                destinationAta: destination,
                                                description: `Close token account ${shortPk(account)} and send rent to ${shortPk(destination)}`,
                                            };
                                        }

                                        if (instructionEnum === SplTokenInstruction.FreezeAccount) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const mint = resolvePubkeyString(decoded?.keys?.mint?.pubkey || decoded?.keys?.mint) || getTokenAccountMint(account);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}FreezeAccount`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                data: ixLike?.data,
                                                description: `Freeze token account ${shortPk(account)} for ${meta.symbol}`,
                                            };
                                        }

                                        if (instructionEnum === SplTokenInstruction.ThawAccount) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            const mint = resolvePubkeyString(decoded?.keys?.mint?.pubkey || decoded?.keys?.mint) || getTokenAccountMint(account);
                                            const meta = getTokenPresentation(mint);
                                            return {
                                                type: `${tokenProgramLabel}ThawAccount`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint,
                                                name: meta.name,
                                                logoURI: meta.logoURI,
                                                data: ixLike?.data,
                                                description: `Thaw token account ${shortPk(account)} for ${meta.symbol}`,
                                            };
                                        }

                                        if (instructionEnum === SplTokenInstruction.SyncNative) {
                                            const account = resolvePubkeyString(decoded?.keys?.account?.pubkey || decoded?.keys?.account);
                                            return {
                                                type: `${tokenProgramLabel}SyncNative`,
                                                ix: instructionItem.pubkey,
                                                pubkey: account,
                                                mint: "So11111111111111111111111111111111111111112",
                                                name: "Wrapped SOL",
                                                data: ixLike?.data,
                                                description: `Sync wrapped SOL account ${shortPk(account)}`,
                                            };
                                        }
                                    } catch (tokenDecodeError) {
                                        console.log("Token decode error:", tokenDecodeError);
                                    }

                                    return null;
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
                                        
                                        if (programId === SPL_TOKEN_PROGRAM_ID){
                                            const tokenInstructionInfo = decodeSupportedTokenInstruction(
                                                programId,
                                                accountInstruction
                                            );
                                            if (tokenInstructionInfo) {
                                                accountInstruction.info = tokenInstructionInfo;
                                                if (tokenInstructionInfo.destinationAta && tokenInstructionInfo.amount > 0) {
                                                    appendInstructionTransferDetail(tokenInstructionInfo);
                                                }
                                                continue;
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

                                                    const {
                                                        destinationAta,
                                                        tokenOwner,
                                                        recipientWallet,
                                                    } = getTokenRecipientDisplay(accountInstruction.accounts[1].pubkey);
                                                    newObject = {
                                                        type:"BatchTokenTransfer",
                                                        ix: instructionItem.pubkey,
                                                        pubkey: recipientWallet || accountInstruction.accounts[1].pubkey,
                                                        sourcePubkey: accountInstruction.accounts[0].pubkey,
                                                        mint: gai?.data.parsed.info.mint,
                                                        name: tname,
                                                        logoURI: logo,
                                                        amount: parseFloat(amount.replace(/,/g, '')), //amount,
                                                        data: accountInstruction.data,
                                                        destinationAta,
                                                        tokenOwner,
                                                        recipientWallet,
                                                        description:amount+' '+symbol+' to '+(recipientWallet || destinationAta),
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
                                                        pubkey: accountInstruction.accounts[1].pubkey,
                                                        sourcePubkey: accountInstruction.accounts[0].pubkey,
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
                                                                const taiInfo = (tai as any)?.value || tai;

                                                                let tdecimals = 0;
                                                                
                                                                if (taiInfo?.data?.parsed?.info?.tokenAmount?.decimals){
                                                                    //console.log("tai "+JSON.stringify(tai?.value.data?.parsed?.info?.mint));
                                                                    thisMint = taiInfo?.data?.parsed?.info?.mint;
                                                                    mint = thisMint;
                                                                    //console.log("l v t " + lastMint + " v "+ thisMint);
                                                                    if ((taiInfo?.data?.parsed?.info?.mint) && (lastMint !== thisMint)){
                                                                        tname = await fetchTokenName(taiInfo?.data?.parsed?.info?.mint);
                                                                        thisMintName = tname;
                                                                        symbol = tname;
                                                                    } else {
                                                                        tname = lastMintName;
                                                                        thisMintName = tname;
                                                                        symbol = tname;
                                                                    }
                                                                    
                                                                    tdecimals = taiInfo?.data?.parsed?.info?.tokenAmount?.decimals || 0;
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
                                                            const destinationWallet =
                                                                getTokenAccountOwner(destinationAta) ||
                                                                destinationAta?.toBase58?.() ||
                                                                `${destinationAta ?? ''}`;
                                                            console.log("Grant "+amount+" "+tname+" to "+destinationWallet);
                                                            description = "Grant "+amount+" "+tname+" to "+destinationWallet;
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

                                                if (decodedIx?.name) {
                                                    description = describeGovernanceInstruction(
                                                        decodedIx,
                                                        accountInstruction
                                                    );
                                                }

                                                const newObject = {
                                                    type:"SPL Governance Program by Solana",
                                                    ix: instructionItem.pubkey,
                                                    decodedIx:decodedIx,
                                                    amount: amount ? parseFloat(amount.replace(/,/g, '')) : null, //amount,
                                                    pubkey: getTokenAccountOwner(destinationAta) || accountInstruction.accounts[0].pubkey,
                                                    mint: mint,
                                                    name: symbol,
                                                    //logoURI: tokenMap.get(gai?.data.parsed.info.mint)?.logoURI,
                                                    description: description,
                                                    destinationAta: destinationAta,
                                                    tokenOwner: getTokenAccountOwner(destinationAta),
                                                    recipientWallet: getTokenAccountOwner(destinationAta) || destinationAta?.toBase58?.() || null,
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
                                        } else if (programId === TOKEN_2022_PROGRAM_ID) {
                                            const tokenInstructionInfo = decodeSupportedTokenInstruction(
                                                programId,
                                                accountInstruction
                                            );
                                            if (tokenInstructionInfo) {
                                                accountInstruction.info = tokenInstructionInfo;
                                                if (tokenInstructionInfo.destinationAta && tokenInstructionInfo.amount > 0) {
                                                    appendInstructionTransferDetail(tokenInstructionInfo);
                                                }
                                                continue;
                                            }
                                        } else if (programId === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL") {
                                            const ataTag = accountInstruction.data?.length
                                                ? Number(accountInstruction.data[0])
                                                : 0;
                                            const payer = accountInstruction.accounts[0]?.pubkey;
                                            const ata   = accountInstruction.accounts[1]?.pubkey;
                                            const owner = accountInstruction.accounts[2]?.pubkey;
                                            const mint  = accountInstruction.accounts[3]?.pubkey;
                                            let description = `Create ATA ${shortPk(ata)} for owner ${shortPk(owner)} / mint ${shortPk(mint)} (payer ${shortPk(payer)})`;
                                            let type = "CreateAssociatedTokenAccount";

                                            if (ataTag === 1) {
                                                type = "CreateAssociatedTokenAccountIdempotent";
                                                description = `Create ATA idempotent ${shortPk(ata)} for owner ${shortPk(owner)} / mint ${shortPk(mint)} (payer ${shortPk(payer)})`;
                                            } else if (ataTag === 2) {
                                                const ownerAta = accountInstruction.accounts[3]?.pubkey;
                                                const nestedMint = accountInstruction.accounts[4]?.pubkey;
                                                const destinationOwnerAta = accountInstruction.accounts[5]?.pubkey;
                                                type = "RecoverNestedAssociatedTokenAccount";
                                                description = `Recover nested ATA ${shortPk(ata)} to ${shortPk(destinationOwnerAta)} for owner ${shortPk(owner)} / owner ATA ${shortPk(ownerAta)} / nested mint ${shortPk(nestedMint)}`;
                                            }

                                            accountInstruction.info = {
                                                type,
                                                payer,
                                                ata,
                                                owner,
                                                mint,
                                                description,
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
                                                } else if (tag === 4 /* AdvanceNonceAccount */) {
                                                    const nonceAccount = accountInstruction.accounts[0]?.pubkey;
                                                    const nonceAuthority = accountInstruction.accounts[2]?.pubkey;
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "AdvanceNonceAccount",
                                                        nonceAccount,
                                                        nonceAuthority,
                                                        description: `Advance nonce account ${shortPk(nonceAccount)} by ${shortPk(nonceAuthority)}`,
                                                        data,
                                                    };
                                                } else if (tag === 5 /* WithdrawNonceAccount */) {
                                                    const nonceAccount = accountInstruction.accounts[0]?.pubkey;
                                                    const destination = accountInstruction.accounts[1]?.pubkey;
                                                    const lamports = U64(data, 4);
                                                    const solStr = toDecimalAmount(lamports, 9);
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "WithdrawNonceAccount",
                                                        nonceAccount,
                                                        destination,
                                                        lamports: Number(solStr),
                                                        description: `Withdraw ${formatAmount(solStr)} SOL from nonce account ${shortPk(nonceAccount)} to ${shortPk(destination)}`,
                                                        data,
                                                    };
                                                } else if (tag === 6 /* InitializeNonceAccount */) {
                                                    const nonceAccount = accountInstruction.accounts[0]?.pubkey;
                                                    const nonceAuthority = accountInstruction.accounts[2]?.pubkey;
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "InitializeNonceAccount",
                                                        nonceAccount,
                                                        nonceAuthority,
                                                        description: `Initialize nonce account ${shortPk(nonceAccount)} with authority ${shortPk(nonceAuthority)}`,
                                                        data,
                                                    };
                                                } else if (tag === 7 /* AuthorizeNonceAccount */) {
                                                    const nonceAccount = accountInstruction.accounts[0]?.pubkey;
                                                    const nonceAuthority = accountInstruction.accounts[1]?.pubkey;
                                                    const newAuthority = accountInstruction.accounts[2]?.pubkey;
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "AuthorizeNonceAccount",
                                                        nonceAccount,
                                                        nonceAuthority,
                                                        newAuthority,
                                                        description: `Authorize nonce account ${shortPk(nonceAccount)} to ${shortPk(newAuthority)}`,
                                                        data,
                                                    };
                                                } else if (tag === 8 /* Allocate */) {
                                                    const account = accountInstruction.accounts[0]?.pubkey;
                                                    const space = U64(data, 4);
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "Allocate",
                                                        account,
                                                        space: space.toString(),
                                                        description: `Allocate ${space.toString()} bytes for ${shortPk(account)}`,
                                                        data,
                                                    };
                                                } else if (tag === 9 /* AllocateWithSeed */) {
                                                    const account = accountInstruction.accounts[1]?.pubkey;
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "AllocateWithSeed",
                                                        account,
                                                        description: `AllocateWithSeed for ${shortPk(account)}`,
                                                        data,
                                                    };
                                                } else if (tag === 10 /* AssignWithSeed */) {
                                                    const account = accountInstruction.accounts[0]?.pubkey;
                                                    accountInstruction.info = {
                                                        type: "SystemProgram",
                                                        op: "AssignWithSeed",
                                                        account,
                                                        description: `AssignWithSeed for ${shortPk(account)}`,
                                                        data,
                                                    };
                                                }
                                                // else fall back to your existing SOL Transfer branch above (already handled)
                                                } catch (e) {
                                                console.log("System extra decode error", e);
                                                }
                                            }   
                                        } else if (programId === "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s") {
                                            accountInstruction.info = describeMetaplexInstruction(
                                                accountInstruction
                                            );
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
                            setHasVotedSide(getVoteSideFromRecord(item) || 'unknown');
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
        setLoadingMessage(null);
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
            setLoadingMessage("Loading governance lookup...");
            const fglf = await fetchGovernanceLookupFile(storagePool).catch((error) => {
                console.log("Governance lookup unavailable, continuing with live RPC data", error);
                return [];
            });
            //console.log("fglf: "+JSON.stringify(fglf))
            setGovernanceLookup(Array.isArray(fglf) ? fglf : []);
            
            //console.log("cachedGovernance: "+JSON.stringify(fglf))
            if (Array.isArray(fglf) && fglf.length > 0){
                await getCachedGovernanceFromLookup(fglf);
            }
        }
        
        
    }

    const validateGovernanceSetup = async() => {
        
        setLoadingValidation(true);
        setLoadingMessage("Preparing proposal...");
        if (!tokenMap){
            setLoadingMessage("Loading token metadata...");
            await getTokens();
        }
        var grealm = null;
        var realmPk = null;
        var realmOwner = null;
        
        //console.log("realm: "+JSON.stringify(realm));

        //if (!realm){
        {
            setLoadingMessage("Loading proposal realm...");
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

        setLoadingMessage("Loading governance accounts...");
        const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddress, realmOwner);
        setGovernanceRules(governanceRulesIndexed);

        if (!thisitem || reload){
            console.log("Calling Index/RPC");
            //const prop = await getProposal(RPC_CONNECTION, new PublicKey(proposalPk));
            setLoadingMessage("Loading proposal account...");
            const indexedProp = await getProposalNewIndexed(
                toBase58Safe(proposalPk),
                realmOwner,
                governanceAddress
            );

            let prop = indexedProp;
            const liveProposal = await fetchLiveProposalFromRpc();
            if (liveProposal) {
                const indexedState = Number(indexedProp?.account?.state ?? -1);
                const liveState = Number(liveProposal?.account?.state ?? -1);
                if (!prop || reload || liveState >= indexedState) {
                    prop = prop
                        ? {
                              ...prop,
                              ...liveProposal,
                              account: {
                                  ...prop.account,
                                  ...liveProposal.account,
                              },
                          }
                        : liveProposal;
                }
            }

            //console.log("prop: "+JSON.stringify(prop));
            setThisitem(prop);
        }

        if (!memberMap){
            setLoadingMessage("Loading proposal member records...");
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

        setLoadingMessage(null);
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
                    const destinationWallet = item?.tokenOwner || destinationAta;
                    if (!mint || !destinationWallet) return result;

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

                    group.destinationAmounts[destinationWallet] = (group.destinationAmounts[destinationWallet] || 0) + parsedAmount;
                    group.totalAmount += parsedAmount;

                    console.log(`[DEBUG] ix: ${item.ix}, mint: ${mint}, dest: ${destinationWallet}, amount: ${parsedAmount}`);
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
                        const refreshTimer = setTimeout(async () => {
                            // Your function code here
                            await fetchLiveProposalFromRpc();
                            await validateGovernanceSetup();
                            
                            await getVotingParticipants();
                            setReload(false);
                          }, 1500);
                        return () => clearTimeout(refreshTimer);
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
    }, [loadingValidation, thisitem, thisGovernance, governanceLookup, tokenMap, memberMap, realm, reload]);

    React.useEffect(() => { 
        // check again if this voter has voted:
        if (publicKey && solanaVotingResultRows){
            let matchedVote = false;
            if (solanaVotingResultRows){
                for (let result of solanaVotingResultRows){
                    if (result.governingTokenOwner === publicKey.toBase58()){
                        matchedVote = true;
                        setHasVoted(true);
                        setHasVotedSide(getVoteSideFromRecord(result) || 'unknown');
                        const voterVotes = +(result.quorumWeight.voterWeight / 10 ** ((realm.account.config?.councilMint) === result.governingTokenMint?.toBase58() ? 0 : result.quorumWeight.decimals)).toFixed(0);
                        setHasVotedVotes(voterVotes);
                        break;
                    }
                }
            }
            if (!matchedVote){
                setHasVoted(false);
                setHasVotedSide(null);
                setHasVotedVotes(null);
            }
        } else {
            setHasVoted(false);
            setHasVotedSide(null);
            setHasVotedVotes(null);
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
    const sidebarSectionCardSx = {
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(9,14,24,0.42)',
        overflow: 'hidden',
    };
    const sidebarSectionHeaderSx = {
        px: { xs: 1.15, sm: 1.3 },
        pt: 1.05,
        pb: 0.55,
    };
    const sidebarSectionTitleSx = {
        ...sectionLabelSx,
        color: 'rgba(224,232,242,0.92)',
        fontSize: '0.66rem',
        letterSpacing: 0.55,
    };
    const sidebarSectionSubtitleSx = {
        mt: 0.35,
        fontSize: '0.74rem',
        lineHeight: 1.45,
        color: 'rgba(154,168,188,0.72)',
    };
    const sidebarSectionDividerSx = {
        borderColor: 'rgba(255,255,255,0.08)',
    };
    const timelineAccent = 'rgba(61, 167, 255, 0.96)';
    const createdAt = toPositiveUnix(thisitem?.account?.draftAt);
    const votingStartedAt =
        toPositiveUnix(thisitem?.account?.signingOffAt) ??
        toPositiveUnix(thisitem?.account?.votingAt) ??
        toPositiveUnix(thisitem?.account?.startVotingAt);
    const governanceConfig = thisGovernance?.account?.config;
    const baseVotingTime =
        toPositiveUnix(governanceConfig?.baseVotingTime) ??
        toPositiveUnix(governanceConfig?.votingBaseTime) ??
        0;
    const coolOffTime = toPositiveUnix(governanceConfig?.votingCoolOffTime) ?? 0;
    const votingCompletedAt = toPositiveUnix(thisitem?.account?.votingCompletedAt);
    const scheduledEndsAt =
        votingStartedAt && baseVotingTime > 0 ? votingStartedAt + baseVotingTime : null;
    const resolvedEndsAt = votingCompletedAt ?? scheduledEndsAt;
    const coolOffStartsAt =
        coolOffTime > 0 && resolvedEndsAt
            ? Math.max(votingStartedAt ?? resolvedEndsAt, resolvedEndsAt - coolOffTime)
            : null;
    const timelineEntries = [
        {
            key: 'created',
            label: 'Created',
            at: createdAt,
        },
        {
            key: 'voting',
            label: votingStartedAt ? 'Voting' : 'Voting Pending',
            at: votingStartedAt,
        },
        ...(coolOffStartsAt
            ? [
                  {
                      key: 'cooloff',
                      label: 'Cool off',
                      at: coolOffStartsAt,
                  },
              ]
            : []),
        {
            key: 'ends',
            label: votingCompletedAt ? 'Ended' : 'Ends',
            at: resolvedEndsAt,
        },
    ];
    const nowUnix = moment().unix();
    const datedTimelineEntries = timelineEntries
        .map((entry, index) => ({ ...entry, index }))
        .filter((entry) => typeof entry.at === 'number' && entry.at > 0);
    let timelineAnchorIndex = 0;
    let timelineTargetIndex: number | null = null;
    let timelineSegmentProgress = 0;
    let timelineReachedIndex = -1;
    if (datedTimelineEntries.length > 0) {
        const firstTimelineEntry = datedTimelineEntries[0];
        if (nowUnix <= Number(firstTimelineEntry.at)) {
            timelineAnchorIndex = firstTimelineEntry.index;
            timelineTargetIndex =
                datedTimelineEntries.length > 1 ? datedTimelineEntries[1].index : null;
        } else {
            const reachedTimelinePosition = datedTimelineEntries.reduce(
                (lastReachedPosition, entry, position) =>
                    Number(entry.at) <= nowUnix ? position : lastReachedPosition,
                0
            );
            const reachedTimelineEntry = datedTimelineEntries[reachedTimelinePosition];
            const nextTimelineEntry = datedTimelineEntries[reachedTimelinePosition + 1];
            timelineAnchorIndex = reachedTimelineEntry.index;
            timelineReachedIndex = reachedTimelineEntry.index;
            if (
                nextTimelineEntry &&
                nextTimelineEntry.at &&
                reachedTimelineEntry.at &&
                Number(nextTimelineEntry.at) > Number(reachedTimelineEntry.at)
            ) {
                timelineTargetIndex = nextTimelineEntry.index;
                timelineSegmentProgress = Math.max(
                    0,
                    Math.min(
                        (nowUnix - Number(reachedTimelineEntry.at)) /
                            (Number(nextTimelineEntry.at) - Number(reachedTimelineEntry.at)),
                        1
                    )
                );
            }
        }
    }
    const proposalStateVisuals: Record<number, { accent: string; wash: string; border: string; shadow: string }> = {
        0: {
            accent: '#d9e6f2',
            wash: 'rgba(196, 210, 226, 0.16)',
            border: 'rgba(196, 210, 226, 0.24)',
            shadow: 'rgba(6, 10, 16, 0.42)',
        },
        2: {
            accent: '#52b7ff',
            wash: 'rgba(82, 183, 255, 0.18)',
            border: 'rgba(82, 183, 255, 0.28)',
            shadow: 'rgba(9, 43, 74, 0.42)',
        },
        3: {
            accent: '#6fe3a1',
            wash: 'rgba(111, 227, 161, 0.16)',
            border: 'rgba(111, 227, 161, 0.24)',
            shadow: 'rgba(10, 43, 28, 0.36)',
        },
        5: {
            accent: '#86efac',
            wash: 'rgba(134, 239, 172, 0.16)',
            border: 'rgba(134, 239, 172, 0.24)',
            shadow: 'rgba(10, 43, 28, 0.36)',
        },
        7: {
            accent: '#ff8f8f',
            wash: 'rgba(255, 143, 143, 0.16)',
            border: 'rgba(255, 143, 143, 0.24)',
            shadow: 'rgba(64, 18, 18, 0.34)',
        },
    };
    const proposalStateVisual =
        proposalStateVisuals[proposalState] || {
            accent: '#d7e3f4',
            wash: 'rgba(170, 188, 214, 0.12)',
            border: 'rgba(170, 188, 214, 0.2)',
            shadow: 'rgba(6, 10, 16, 0.32)',
        };
    const heroPanelStateSx = {
        ...heroPanelSx,
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${proposalStateVisual.border}`,
        background: `radial-gradient(circle at top left, ${proposalStateVisual.wash} 0%, rgba(18,25,38,0.96) 34%, rgba(10,14,22,0.98) 100%)`,
        boxShadow: `0 14px 34px ${proposalStateVisual.shadow}`,
        '&::before': {
            content: '""',
            position: 'absolute',
            inset: 'auto -12% -32% auto',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${proposalStateVisual.wash} 0%, rgba(0,0,0,0) 72%)`,
            pointerEvents: 'none',
        },
        '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 38%)',
            pointerEvents: 'none',
        },
    };
    const tokenScale = Math.pow(10, tokenDecimals || 0);
    const parseProposalVoteRaw = (value: any): number => {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    };
    const legacyForRaw =
        thisitem?.account?.options && thisitem.account.options.length > 0
            ? parseProposalVoteRaw(thisitem.account.options[0]?.voteWeight)
            : parseProposalVoteRaw(thisitem?.account?.yesVotesCount);
    const legacyAgainstRaw =
        thisitem?.account?.denyVoteWeight !== undefined && thisitem?.account?.denyVoteWeight !== null
            ? parseProposalVoteRaw(thisitem.account.denyVoteWeight)
            : parseProposalVoteRaw(thisitem?.account?.noVotesCount);
    const forRaw = Number(forVotes) > 0 ? Number(forVotes) : legacyForRaw;
    const againstRaw = Number(againstVotes) > 0 ? Number(againstVotes) : legacyAgainstRaw;
    const forUi = tokenScale > 0 ? forRaw / tokenScale : forRaw;
    const againstUi = tokenScale > 0 ? againstRaw / tokenScale : againstRaw;
    const totalCastUi = forUi + againstUi;
    const forPct = totalCastUi > 0 ? (forUi / totalCastUi) * 100 : 0;
    const againstPct = totalCastUi > 0 ? (againstUi / totalCastUi) * 100 : 0;
    const quorumProgressPct =
        totalQuorum && Number(totalQuorum) > 0
            ? Math.min((totalCastUi / Number(totalQuorum)) * 100, 100)
            : null;
    const quorumRemainingUi =
        totalQuorum && Number(totalQuorum) > 0
            ? Math.max(Number(totalQuorum) - totalCastUi, 0)
            : null;
    const formatMetricValue = (value: number) =>
        new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: value >= 100 ? 0 : 2,
        }).format(Number.isFinite(value) ? value : 0);
    const resolvedEndsRelative = resolvedEndsAt ? moment.unix(resolvedEndsAt).fromNow() : 'Awaiting voting';
    const heroSummaryText = `${
        proposalTargetLabel
    } proposal with ${proposalInstructionCount} executable instruction${
        proposalInstructionCount === 1 ? '' : 's'
    }${resolvedEndsAt ? `, scheduled ${votingCompletedAt ? 'to finish' : 'to close'} ${resolvedEndsRelative}.` : '.'}`;
    const voteSummaryPanelSx = {
        ...panelSx,
        background: 'linear-gradient(180deg, rgba(17,24,38,0.94) 0%, rgba(11,17,27,0.96) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 14px 34px rgba(0,0,0,0.22)',
    };
    const isMultiChoiceProposal = thisitem?.account?.voteType?.type === 1;
    const quorumRemainingLabel =
        quorumRemainingUi === null
            ? 'Awaiting threshold'
            : quorumRemainingUi > 0
            ? `${formatMetricValue(quorumRemainingUi)} votes left to quorum`
            : 'Quorum reached';

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

                {!loadingValidation && !loadingParticipants && thisitem ? (
                    <React.Fragment>
                        
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
            <Box sx={{ mb: 1.15, p: { xs: 0.95, sm: 1.1 }, ...heroPanelStateSx }}>
              <Grid container spacing={1} alignItems="flex-start">
                <Grid item xs={12} lg={realm ? 9 : 12}>
                  <Stack spacing={0.9} sx={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <Typography sx={sectionLabelSx}>Proposal Overview</Typography>
                    {showGovernanceTitle && realmName && (
                      <Typography
                        variant="h4"
                        sx={{
                          lineHeight: 1,
                          fontWeight: 700,
                          fontSize: { xs: '1.18rem', sm: '1.42rem', md: '1.64rem' },
                          color: 'rgba(214,228,244,0.88)',
                          letterSpacing: '-0.02em',
                          wordBreak: 'break-word',
                        }}
                      >
                        {realmName}
                      </Typography>
                    )}
                    <Typography
                      variant="h2"
                      sx={{
                        lineHeight: 1.02,
                        fontWeight: 800,
                        letterSpacing: '-0.035em',
                        fontSize: { xs: '1.42rem', sm: '1.88rem', md: '2.35rem' },
                        color: 'rgba(244,249,255,0.98)',
                        maxWidth: { xs: '100%', md: 880 },
                        textWrap: 'balance',
                        wordBreak: 'break-word',
                      }}
                    >
                      {thisitem?.account?.name}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        maxWidth: 720,
                        color: 'rgba(205,220,239,0.76)',
                        lineHeight: 1.58,
                        fontSize: { xs: '0.88rem', sm: '0.94rem' },
                      }}
                    >
                      {heroSummaryText}
                    </Typography>

                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                      {(proposalAuthorAddress || thisitem.account?.tokenOwnerRecord) && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: 'rgba(214,228,244,0.9)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.6,
                            fontSize: '0.8rem',
                          }}
                        >
                          <Box component="span" sx={{ color: 'rgba(180,192,208,0.72)' }}>
                            Proposed by
                          </Box>
                          {proposalAuthorAddress ? (
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
                          ) : (
                            <ExplorerView
                              address={new PublicKey(thisitem.account.tokenOwnerRecord).toBase58()}
                              type="address"
                              shorten={8}
                              hideTitle={false}
                              style="text"
                              color="white"
                              fontSize="12px"
                            />
                          )}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{ color: isFlaggedMaliciousAuthor ? 'rgba(255,120,120,0.88)' : 'rgba(182,196,214,0.72)' }}
                      >
                        {authorInlineMeta}
                      </Typography>
                      {isFlaggedMaliciousAuthor && (
                        <Chip
                          size="small"
                          label="Author flagged"
                          sx={{
                            ...metaChipSx,
                            height: 22,
                            bgcolor: 'rgba(255,116,116,0.14)',
                            color: '#fca5a5',
                            border: '1px solid rgba(255,116,116,0.28)',
                          }}
                        />
                      )}
                    </Stack>

                    <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
                      <Chip
                        size="small"
                        label={proposalStateLabel}
                        sx={{
                          ...metaChipSx,
                          bgcolor: proposalStateVisual.wash,
                          color: proposalStateVisual.accent,
                          border: `1px solid ${proposalStateVisual.border}`,
                          boxShadow: `0 0 0 1px ${proposalStateVisual.wash} inset`,
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
                      {hasVoted && (
                        <Chip
                          size="small"
                          icon={
                            hasVotedSide === 'yes' ? (
                              <ThumbUpIcon sx={{ fontSize: '0.95rem !important' }} />
                            ) : hasVotedSide === 'no' ? (
                              <ThumbDownIcon sx={{ fontSize: '0.95rem !important' }} />
                            ) : (
                              <CheckCircleIcon sx={{ fontSize: '0.95rem !important' }} />
                            )
                          }
                          label={
                            hasVotedSide === 'yes'
                              ? 'You voted: For'
                              : hasVotedSide === 'no'
                              ? 'You voted: Against'
                              : 'You voted'
                          }
                          sx={{
                            ...metaChipSx,
                            bgcolor:
                              hasVotedSide === 'yes'
                                ? 'rgba(82,190,128,0.18)'
                                : hasVotedSide === 'no'
                                ? 'rgba(236,112,99,0.18)'
                                : 'rgba(255,255,255,0.06)',
                            color:
                              hasVotedSide === 'yes'
                                ? '#86efac'
                                : hasVotedSide === 'no'
                                ? '#fca5a5'
                                : 'rgba(255,255,255,0.95)',
                            border:
                              hasVotedSide === 'yes'
                                ? '1px solid rgba(82,190,128,0.38)'
                                : hasVotedSide === 'no'
                                ? '1px solid rgba(236,112,99,0.38)'
                                : '1px solid rgba(255,255,255,0.1)',
                          }}
                        />
                      )}
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" alignItems={{ xs: 'stretch', sm: 'center' }}>
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

                      <CopyToClipboard text={proposalUrl} onCopy={handleCopy}>
                        <Tooltip title="Copy proposal link">
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

                      <Tooltip title="Share proposal">
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

                      <Tooltip title="Open on Realms">
                        <Button
                          component="a"
                          href={realmsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="text"
                          color="inherit"
                          size="small"
                          sx={{
                            ...softActionButtonSx,
                            borderColor: 'transparent',
                            background: 'rgba(255,255,255,0.03)',
                            color: 'rgba(220,233,247,0.82)',
                            '&:hover': {
                              borderColor: 'rgba(255,255,255,0.12)',
                              background: 'rgba(255,255,255,0.06)',
                            },
                          }}
                        >
                          View on Realms
                          <OpenInNewIcon sx={{ ml: 1, fontSize: '0.86rem' }} />
                        </Button>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Grid>

                {realm && (
                <Grid item xs={12} lg={3}>
                  <Stack spacing={0.8} sx={{ position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.03)',
                        p: 0.65,
                      }}
                    >
                      <GovernancePower
                        governanceAddress={typeof realm.pubkey.toBase58 === "function" ? realm.pubkey.toBase58() : realm.pubkey}
                        realm={realm}
                      />
                    </Box>
                  </Stack>
                </Grid>
                )}
              </Grid>
            </Box>

	            <Box sx={{ textAlign: "left" }}>
		              <Divider sx={sectionDividerSx} />

              <Box sx={{ ...voteSummaryPanelSx, p: { xs: 0.95, sm: 1.05 }, mb: 0.45 }}>
                <Typography sx={{ ...sectionLabelSx, mb: 0.55 }}>Voting Snapshot</Typography>

                {isMultiChoiceProposal && (
                  <Box
                    sx={{
                      borderRadius: '16px',
                      border: '1px solid rgba(74,167,255,0.2)',
                      bgcolor: 'rgba(25,41,62,0.46)',
                      px: 1.1,
                      py: 1.15,
                    }}
                  >
                    <Typography sx={{ ...sectionLabelSx, color: 'rgba(154,204,255,0.84)', mb: 0.45 }}>
                      Vote Actions
                    </Typography>
                    <Typography variant="subtitle1" sx={{ color: 'rgba(244,249,255,0.97)', fontWeight: 700 }}>
                      Choose an option below to cast your vote
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: 'rgba(194,205,222,0.76)', lineHeight: 1.6 }}>
                      This is a multiple choice proposal, so voting happens in the detailed option breakdown below rather than a single for/against pair.
                    </Typography>
                  </Box>
                )}

                {!isMultiChoiceProposal && (
                  <Stack spacing={0.85}>
                    <Box
                      sx={{
                        borderRadius: '16px',
                        border: hasVoted
                          ? '1px solid rgba(82,190,128,0.24)'
                          : '1px solid rgba(255,255,255,0.08)',
                        background: hasVoted
                          ? 'linear-gradient(180deg, rgba(17,34,28,0.86) 0%, rgba(12,19,18,0.9) 100%)'
                          : 'linear-gradient(180deg, rgba(21,30,45,0.9) 0%, rgba(12,18,29,0.92) 100%)',
                        px: { xs: 0.95, sm: 1.05 },
                        py: { xs: 0.95, sm: 1.05 },
                      }}
                    >
                      <Grid container spacing={0.8} alignItems="center" sx={{ mb: 0.85 }}>
                        <Grid item xs={12} md={7}>
                          <Stack spacing={0.35}>
                            <Typography sx={{ ...sectionLabelSx, color: hasVoted ? 'rgba(147,230,177,0.82)' : 'rgba(180,192,208,0.74)' }}>
                              Vote Actions
                            </Typography>
                            <Typography variant="subtitle1" sx={{ color: 'rgba(244,249,255,0.98)', fontWeight: 700 }}>
                              {hasVoted ? 'Manage your vote' : 'Cast your vote'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(190,204,223,0.76)', lineHeight: 1.55 }}>
                              {hasVoted
                                ? `You already voted ${hasVotedSide === 'yes' ? 'for' : hasVotedSide === 'no' ? 'against' : 'on'} this proposal. Use the controls below to review or update your position if governance rules allow it.`
                                : 'Voting is the primary action on this page. Choose a side below to participate in the proposal outcome.'}
                            </Typography>
                          </Stack>
                        </Grid>
                        <Grid item xs={12} md={5}>
                          <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                            <Chip
                              size="small"
                              label={hasVoted ? 'Vote recorded' : 'Vote open'}
                              sx={{
                                ...metaChipSx,
                                height: 24,
                                bgcolor: hasVoted ? 'rgba(82,190,128,0.18)' : 'rgba(74,167,255,0.14)',
                                color: hasVoted ? '#86efac' : 'rgba(214,236,255,0.92)',
                                border: hasVoted
                                  ? '1px solid rgba(82,190,128,0.32)'
                                  : '1px solid rgba(74,167,255,0.22)',
                              }}
                            />
                            <Chip
                              size="small"
                              label={
                                totalQuorum
                                  ? `${formatMetricValue(Number(totalQuorum))} quorum target`
                                  : 'Quorum pending'
                              }
                              sx={{ ...metaChipSx, height: 24, bgcolor: 'rgba(255,255,255,0.05)' }}
                            />
                          </Stack>
                        </Grid>
                      </Grid>

                      <Grid container spacing={1} justifyContent="center">
                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            {realm && (
                              <VoteForProposal
                                title={formatMetricValue(forUi)}
                                subtitle={`For ${forPct.toFixed(2)}%`}
                                hovertext=""
                                showIcon={true}
                                actionOnly={true}
                                votingResultRows={solanaVotingResultRows}
                                getVotingParticipants={getVotingParticipants}
                                hasVotedVotes={hasVotedVotes}
                                hasVoted={hasVoted}
                                hasVotedSide={hasVotedSide}
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
                        <Grid item xs={12} md={6}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                            {realm && (
                              <VoteForProposal
                                title={formatMetricValue(againstUi)}
                                subtitle={`Against ${againstPct.toFixed(2)}%`}
                                hovertext=""
                                showIcon={true}
                                actionOnly={true}
                                votingResultRows={solanaVotingResultRows}
                                getVotingParticipants={getVotingParticipants}
                                hasVotedVotes={hasVotedVotes}
                                hasVoted={hasVoted}
                                hasVotedSide={hasVotedSide}
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
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        gap: 0.85,
                        width: '100%',
                      }}
                    >
                      <Box
                        sx={{
                          borderRadius: '16px',
                          border: '1px solid rgba(88, 195, 129, 0.2)',
                          background: 'linear-gradient(180deg, rgba(24,48,36,0.78) 0%, rgba(13,26,20,0.88) 100%)',
                          px: 1,
                          py: 0.9,
                          minHeight: 82,
                        }}
                      >
                        <Typography sx={{ ...sectionLabelSx, color: 'rgba(147, 230, 177, 0.76)' }}>For</Typography>
                        <Typography variant="h5" sx={{ mt: 0.35, color: '#b8ffd1', fontWeight: 800, fontSize: { xs: '1.55rem', sm: '1.75rem' } }}>
                          {formatMetricValue(forUi)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(185,233,202,0.76)' }}>
                          {forPct.toFixed(1)}% of cast votes
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          borderRadius: '16px',
                          border: '1px solid rgba(99, 175, 255, 0.2)',
                          background: 'linear-gradient(180deg, rgba(17,37,59,0.82) 0%, rgba(11,20,31,0.9) 100%)',
                          px: 1,
                          py: 0.9,
                          minHeight: 82,
                        }}
                      >
                        <Typography sx={{ ...sectionLabelSx, color: 'rgba(154, 204, 255, 0.82)' }}>Quorum</Typography>
                        <Typography variant="h5" sx={{ mt: 0.35, color: 'rgba(234,245,255,0.98)', fontWeight: 800, fontSize: { xs: '1.55rem', sm: '1.75rem' } }}>
                          {quorumProgressPct !== null ? `${quorumProgressPct.toFixed(1)}%` : 'Pending'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(193,214,236,0.76)' }}>
                          {quorumRemainingLabel}
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          borderRadius: '16px',
                          border: '1px solid rgba(240, 114, 114, 0.18)',
                          background: 'linear-gradient(180deg, rgba(58,24,24,0.82) 0%, rgba(25,13,14,0.9) 100%)',
                          px: 1,
                          py: 0.9,
                          minHeight: 82,
                        }}
                      >
                        <Typography sx={{ ...sectionLabelSx, color: 'rgba(255, 174, 174, 0.8)' }}>Against</Typography>
                        <Typography variant="h5" sx={{ mt: 0.35, color: '#ffd0d0', fontWeight: 800, fontSize: { xs: '1.55rem', sm: '1.75rem' } }}>
                          {formatMetricValue(againstUi)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(240,198,198,0.76)' }}>
                          {againstPct.toFixed(1)}% of cast votes
                        </Typography>
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 2fr) minmax(0, 1fr)' },
                        gap: 0.85,
                        width: '100%',
                      }}
                    >
                      <Box>
                        <Box sx={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.035)', px: 1, py: 0.95, height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ color: 'rgba(234,243,252,0.96)' }}>
                            Vote split
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(180,192,208,0.76)' }}>
                            For versus against across currently cast votes
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.75,
                              height: 10,
                              borderRadius: 999,
                              overflow: 'hidden',
                              border: '1px solid rgba(255,255,255,0.08)',
                              bgcolor: 'rgba(255,255,255,0.06)',
                              position: 'relative',
                            }}
                          >
                            <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(236,112,99,0.92)' }} />
                            <Box
                              sx={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: `${Math.max(0, Math.min(forPct, 100))}%`,
                                bgcolor: 'rgba(82,190,128,0.98)',
                              }}
                            />
                          </Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.45 }}>
                            <Typography variant="caption" sx={{ color: '#9af0bb' }}>
                              For {forPct.toFixed(1)}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#ffb7b7' }}>
                              Against {againstPct.toFixed(1)}%
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                      <Box>
                        <Box sx={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.035)', px: 1, py: 0.95, height: '100%' }}>
                          <Typography variant="subtitle2" sx={{ color: 'rgba(234,243,252,0.96)' }}>
                            Quorum progress
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(180,192,208,0.76)' }}>
                            Cast votes compared with the passing threshold
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.75,
                              height: 10,
                              borderRadius: 999,
                              overflow: 'hidden',
                              border: '1px solid rgba(255,255,255,0.08)',
                              bgcolor: 'rgba(255,255,255,0.06)',
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                width: `${Math.max(0, Math.min(quorumProgressPct || 0, 100))}%`,
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, rgba(74,167,255,0.98) 0%, rgba(130,211,255,0.98) 100%)',
                              }}
                            />
                          </Box>
                          <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.55 }}>
                            <Typography variant="caption" sx={{ color: 'rgba(194,205,222,0.76)' }}>
                              {formatMetricValue(totalCastUi)} cast
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(194,205,222,0.76)' }}>
                              {totalQuorum ? `${formatMetricValue(Number(totalQuorum))} target` : 'Target pending'}
                            </Typography>
                          </Stack>
                        </Box>
                      </Box>
                    </Box>
                  </Stack>
                )}
              </Box>
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
                                <Stack
                                    sx={{
                                        ml: { xs: 0, md: 1 },
                                        position: { xs: 'relative', md: 'sticky' },
                                        top: { xs: 'auto', md: 10 },
                                        gap: 1.25,
                                    }}
                                >
                                    <Box
                                        sx={{
                                            p: { xs: 1, sm: 1.25 },
                                            ...panelSx,
                                        }}
                                    >
                                        <Typography sx={{ ...sectionLabelSx, ml: { xs: 0.75, sm: 1 }, mt: 0.25, mb: 0.85 }}>
                                            Timeline
                                        </Typography>
                                        <Box
                                            sx={{
                                                borderRadius: '14px',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                bgcolor: 'rgba(9,14,24,0.45)',
                                                px: { xs: 1, sm: 1.25 },
                                                py: { xs: 1.2, sm: 1.4 },
                                            }}
                                        >
                                            <Stack spacing={0}>
                                                {timelineEntries.map((entry, index) => {
                                                    const isAnchor = index === timelineAnchorIndex;
                                                    const isReached =
                                                        timelineReachedIndex >= 0
                                                            ? index <= timelineReachedIndex
                                                            : false;
                                                    const isFuture = !isReached && !isAnchor;
                                                    const isLast = index === timelineEntries.length - 1;
                                                    const connectorFillRatio = !isLast
                                                        ? index < timelineAnchorIndex
                                                            ? 1
                                                            : index === timelineAnchorIndex &&
                                                              timelineTargetIndex !== null
                                                            ? timelineSegmentProgress
                                                            : 0
                                                        : 0;
                                                    const showSegmentMarker =
                                                        index === timelineAnchorIndex &&
                                                        timelineTargetIndex !== null &&
                                                        timelineSegmentProgress > 0.04 &&
                                                        timelineSegmentProgress < 0.96;
                                                    return (
                                                        <Box
                                                            key={entry.key}
                                                            sx={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '20px minmax(0, 1fr)',
                                                                columnGap: 1.25,
                                                                minHeight: isLast ? 'auto' : 78,
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'center',
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        mt: 0.35,
                                                                        width: isAnchor ? 14 : 10,
                                                                        height: isAnchor ? 14 : 10,
                                                                        borderRadius: '50%',
                                                                        bgcolor:
                                                                            isReached || isAnchor
                                                                                ? timelineAccent
                                                                                : 'rgba(118,145,188,0.45)',
                                                                        border: isAnchor
                                                                            ? '3px solid rgba(61, 167, 255, 0.22)'
                                                                            : 'none',
                                                                        boxShadow: isAnchor
                                                                            ? '0 0 0 4px rgba(61, 167, 255, 0.12)'
                                                                            : 'none',
                                                                        zIndex: 1,
                                                                    }}
                                                                />
                                                                {!isLast && (
                                                                    <Box
                                                                        sx={{
                                                                            mt: 0.45,
                                                                            width: 4,
                                                                            flex: 1,
                                                                            minHeight: 42,
                                                                            borderRadius: 999,
                                                                            bgcolor: 'rgba(118,145,188,0.26)',
                                                                            opacity: isFuture ? 0.55 : 1,
                                                                            position: 'relative',
                                                                            overflow: 'visible',
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            sx={{
                                                                                position: 'absolute',
                                                                                inset: '0 auto auto 0',
                                                                                width: '100%',
                                                                                height: `${Math.max(
                                                                                    0,
                                                                                    Math.min(connectorFillRatio, 1)
                                                                                ) * 100}%`,
                                                                                borderRadius: 999,
                                                                                bgcolor: timelineAccent,
                                                                            }}
                                                                        />
                                                                        {showSegmentMarker && (
                                                                            <Box
                                                                                sx={{
                                                                                    position: 'absolute',
                                                                                    left: '50%',
                                                                                    top: `calc(${(
                                                                                        timelineSegmentProgress * 100
                                                                                    ).toFixed(2)}% - 7px)`,
                                                                                    transform: 'translateX(-50%)',
                                                                                    width: 14,
                                                                                    height: 14,
                                                                                    borderRadius: '50%',
                                                                                    bgcolor: '#9dd6ff',
                                                                                    border: '3px solid rgba(61, 167, 255, 0.2)',
                                                                                    boxShadow: '0 0 0 4px rgba(61, 167, 255, 0.12)',
                                                                                    zIndex: 2,
                                                                                }}
                                                                            />
                                                                        )}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                            <Box sx={{ pb: isLast ? 0 : 1.15 }}>
                                                                <Typography
                                                                    variant="subtitle1"
                                                                    sx={{
                                                                        fontWeight: isAnchor ? 700 : 600,
                                                                        color: isFuture
                                                                            ? 'rgba(226,235,246,0.82)'
                                                                            : 'rgba(244,248,255,0.96)',
                                                                        lineHeight: 1.15,
                                                                    }}
                                                                >
                                                                    {entry.label}
                                                                </Typography>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        mt: 0.45,
                                                                        color: entry.at
                                                                            ? 'rgba(194,205,222,0.82)'
                                                                            : 'rgba(140,154,176,0.72)',
                                                                    }}
                                                                >
                                                                    {entry.at
                                                                        ? moment.unix(entry.at).format('MMM D, YYYY, h:mma')
                                                                        : 'Pending'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    );
                                                })}
                                            </Stack>
                                        </Box>
                                    </Box>
                                    <Box
                                        sx={{
                                            p: { xs: 1, sm: 1.25 },
                                            ...panelSx,
                                        }}
                                    >
                                    <Typography sx={{ ...sectionLabelSx, ml: { xs: 0.75, sm: 1 }, mt: 0.25, mb: 0.85 }}>Governance Actions</Typography>
                                    <Grid container>
                                        <Grid item xs={12} key={1}>
                                            <Stack spacing={1.1} sx={{ px: { xs: 0.5, sm: 0.75 }, pb: 0.45 }}>
                                                <Box sx={sidebarSectionCardSx}>
                                                    <Box sx={sidebarSectionHeaderSx}>
                                                        <Typography sx={sidebarSectionTitleSx}>Status</Typography>
                                                        <Typography sx={sidebarSectionSubtitleSx}>
                                                            Lifecycle, wallet context, and timing for this proposal.
                                                        </Typography>
                                                    </Box>
                                                    <Divider sx={sidebarSectionDividerSx} />

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
                                                                            tokenMap={tokenMap} />
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
                                                                                                    `${moment.unix(Number(thisitem.account.signingOffAt) + Number(thisGovernance.account?.config.baseVotingTime)).fromNow()}`
                                                                                                    :
                                                                                                    `Ending ${moment.unix(Number(thisitem.account.signingOffAt) + Number(thisGovernance.account.config.baseVotingTime)).fromNow()}`
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
                                                        <>
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

                                                            <Box sx={{ my: 3, mx: 2 }}>
                                                                <Grid container alignItems="center">
                                                                    <Grid item xs>
                                                                        <Typography gutterBottom variant="subtitle1" component="div">
                                                                            Status
                                                                        </Typography>
                                                                    </Grid>
                                                                    <Grid item>
                                                                        <Typography gutterBottom variant="body1" component="div">
                                                                            {canManageDraftProposal ?
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
                                                                                : <>
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
                                                        </>
                                                    }
                                                </Box>

                                                <Box sx={sidebarSectionCardSx}>
                                                    <Box sx={sidebarSectionHeaderSx}>
                                                        <Typography sx={sidebarSectionTitleSx}>Participation</Typography>
                                                        <Typography sx={sidebarSectionSubtitleSx}>
                                                            Thresholds, voter sentiment, and signatory progress.
                                                        </Typography>
                                                    </Box>
                                                    <Divider sx={sidebarSectionDividerSx} />

                                                    {governingMintInfo &&
                                                        <>
                                                            {(totalQuorum && thisitem.account?.state === 2 && thisitem.account?.options && thisitem.account?.options.length === 1 && forVotes) ?
                                                                <Box sx={{ my: 3, mx: 2 }}>
                                                                    <Grid container alignItems="center">
                                                                        <Grid item xs>
                                                                            <Typography gutterBottom variant="subtitle1" component="div">
                                                                                Votes Required
                                                                            </Typography>
                                                                        </Grid>
                                                                        <Grid item>
                                                                            <Typography gutterBottom variant="body1" component="div">
                                                                                {(totalQuorum - (forVotes / 10 ** votingDecimals)) > 0 ?
                                                                                    <>
                                                                                        {(+(totalQuorum - (forVotes / 10 ** votingDecimals))
                                                                                            .toFixed(0)).toLocaleString()}
                                                                                    </>
                                                                                    :
                                                                                    <>Passing</>
                                                                                }
                                                                            </Typography>
                                                                        </Grid>
                                                                    </Grid>
                                                                    <Typography color="text.secondary" variant="caption">
                                                                        {(totalQuorum - (forVotes / 10 ** votingDecimals)) > 0 ?
                                                                            <>
                                                                                Remaining votes required for proposal to pass
                                                                            </>
                                                                            :
                                                                            <>
                                                                                Passing {(+((totalQuorum - (forVotes / 10 ** votingDecimals)) * -1)
                                                                                    .toFixed(0)).toLocaleString()} over quorum
                                                                            </>
                                                                        }
                                                                    </Typography>
                                                                </Box>
                                                                : <></>}

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
                                                                        {(+((totalSupplyFractionPercentage / 100) * totalSupply).toFixed(0)).toLocaleString()} calculated from {(totalSupply.toLocaleString())} supply
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
                                                                        {console.log("realm: " + JSON.stringify(realm))}
                                                                    </Typography>
                                                                </Box>
                                                            }

                                                            {(thisitem.account.signingOffAt && +thisitem.account.signingOffAt > 0 && thisitem.account.status !== 0 && thisitem.account.status !== 1) &&
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
                                                                        Total unique voters voting for/against this proposal <sup>*</sup>{uniqueYes + uniqueNo} participants
                                                                    </Typography>
                                                                </Box>
                                                            }

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
                                                                                {proposalSignatories.map((filteredItem: any) => (
                                                                                    <>
                                                                                        <br />
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
                                                                                            <></>
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
                                                        </Box>
                                                    }
                                                </Box>

                                                <Box sx={sidebarSectionCardSx}>
                                                    <Box sx={sidebarSectionHeaderSx}>
                                                        <Typography sx={sidebarSectionTitleSx}>Controls</Typography>
                                                        <Typography sx={sidebarSectionSubtitleSx}>
                                                            Management actions, exports, and deeper proposal tools.
                                                        </Typography>
                                                    </Box>
                                                    <Divider sx={sidebarSectionDividerSx} />

                                                    {governingMintInfo &&
                                                        <>
                                                            {(publicKey &&
                                                                +thisitem.account.state === 2 &&
                                                                (() => {
                                                                    const signingOffAt = Number(thisitem.account?.signingOffAt || 0);
                                                                    const baseVotingTime = Number(thisGovernance.account?.config?.baseVotingTime || 0);
                                                                    const votingCoolOffTime = Number(thisGovernance.account?.config?.votingCoolOffTime || 0);
                                                                    const votingEndTime = signingOffAt + baseVotingTime;
                                                                    const totalEndTime = votingEndTime + votingCoolOffTime;
                                                                    const currentTime = moment().unix();
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
                                                            )}
                                                        </>
                                                    }

                                                    {expandInfo &&
                                                        <>
                                                            {canManageDraftProposal ?
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
                                                                </>
                                                                : <></>
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
                                                                                        sx={{ borderRadius: '17px' }}
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
                                                        </>
                                                    }

                                                    <Divider sx={sidebarSectionDividerSx} />
                                                    <Box sx={{ my: 2.2, mx: 2 }}>
                                                        <Grid container alignItems="center">
                                                            <Grid item xs />
                                                            <Grid item>
                                                                <Typography gutterBottom variant="body1" component="div">
                                                                    <Button
                                                                        size="small"
                                                                        color='inherit'
                                                                        variant="outlined"
                                                                        onClick={toggleInfoExpand}
                                                                        sx={{
                                                                            borderRadius: '17px',
                                                                            textTransform: 'none',
                                                                        }}
                                                                    >
                                                                        {expandInfo ? <><ExpandLess sx={{ mr: 1 }} /> Less</> : <><ExpandMoreIcon sx={{ mr: 1 }} /> More Info</>}
                                                                    </Button>
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>
                                                    </Box>
                                                </Box>
                                            </Stack>
                                        </Grid>
                                    </Grid>
                                </Box>
                                </Stack>

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
                                            hasProposalAuthority={canManageDraftProposal}
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
                                                                    hasVotedSide={hasVotedSide}
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
                            <GovernanceRealtimeInfo governanceAddress={proposalPk} resourceType="proposal" title={'Latest Activity'} tokenMap={tokenMap} />
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
                    </React.Fragment>
                    ) : (
                        <Box
                            sx={{
                                width: '100%',
                                mt: 6,
                                p: { xs: 3, sm: 4 },
                                borderRadius: '17px',
                                background: 'rgba(0, 0, 0, 0.6)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                textAlign: 'center',
                            }}
                        >
                            <CircularProgress color="inherit" size={34} sx={{ mb: 2 }} />
                            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
                                {loadingMessage || 'Loading proposal...'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', display: 'block', mt: 0.75, mb: 2 }}>
                                {toBase58Safe(proposalPk)}
                            </Typography>
                            <LinearProgress color="inherit" sx={{ borderRadius: '10px', maxWidth: 520, mx: 'auto' }} />
                        </Box>
                    )}
                </Box>
            </ThemeProvider>
        </>
    )
}
