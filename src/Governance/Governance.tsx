import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import grapeTheme from  '../utils/config/theme';
import { ThemeProvider } from '@mui/material/styles';

import { initGrapeGovernanceDirectory } from './api/gspl_queries';

import {
    Avatar,
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
    TextField,
    Tooltip,
    LinearProgress,
    DialogTitle,
    Dialog,
    FormGroup,
    FormControlLabel,
    Switch,
    ButtonGroup,
    Chip,
} from '@mui/material/';

import { Helmet } from 'react-helmet';
import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernanceNavigation from './GovernanceNavigation'; 
import GovernancePower from './GovernancePower';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import { GovernanceProposalDialog } from './GovernanceProposalDialog';
import { GovernanceHeaderView } from './GovernanceHeaderView';
import moment from 'moment';

import VerifiedIcon from '@mui/icons-material/Verified';
import ShareIcon from '@mui/icons-material/Share';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CloseIcon from '@mui/icons-material/Close';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import TimerIcon from '@mui/icons-material/Timer';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';

import PropTypes from 'prop-types';
import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI,
    SHYFT_KEY,
    HELIUS_API } from '../utils/grapeTools/constants';

import {  
    getRealmConfigAddress  } from '@solana/spl-governance';

import { 
    getRealmIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getVoteRecordsByVoterIndexed,
    getRealmConfigIndexed,
} from './api/queries';

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

const VotesLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 10,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: theme.palette.mode === 'light' ? '#EC7063' : 'rgba(176, 58, 46,0.4)',
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: theme.palette.mode === 'light' ? '#52BE80' : '#52BE80',
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

const normalizePkString = (pk: any): string | null => {
    try {
        if (!pk) return null;
        if (typeof pk?.toBase58 === 'function') return pk.toBase58();
        if (typeof pk === 'string') return new PublicKey(pk).toBase58();
        return null;
    } catch {
        return null;
    }
};

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

function RenderGovernanceTable(props:any) {
    const endTimer = props.endTimer;
    const realm = props.realm;
    const memberMap = props.memberMap;
    const thisToken = props.thisToken;
    const tokenMap = props.tokenMap;
    const governingTokenDecimals = props.governingTokenDecimals;
    const governanceAddress = props.governanceAddress;
    const governanceType = props.governanceType;
    const governanceLookup = props.governanceLookup;
    const cachedGovernance = props.cachedGovernance;
    const votesForWallet = props?.votesForWallet;
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const governanceToken = props.governanceToken;
    const proposals = props.proposals;
    const allProposals = props?.allProposals;
    const nftBasedGovernance = props.nftBasedGovernance;
    const token = props.token;
    const { publicKey } = useWallet();
    const [propTokenDecimals, setPropTokenDecimals] = React.useState(token?.decimals || 6);
    const [filteredGovernance, setFilteredGovernance] = React.useState('');
    //const [filterState, setFilterState] = React.useState(true);
    const filterState = props.filterState;
    const setFilterState = props.setFilterState;
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const searchQuery = (filteredGovernance || '').trim().toLowerCase();
    const proposalCounters = React.useMemo(() => {
        const list = Array.isArray(proposals) ? proposals : [];
        let voting = 0;
        let draft = 0;
        let passed = 0;
        let defeated = 0;
        let polls = 0;
        let withInstructions = 0;
        for (const item of list) {
            const state = Number(item?.account?.state);
            const isPoll = Number(item?.account?.voteType?.type) === 1;
            const hasInstructions = (() => {
                const v1Count = Number(item?.account?.instructionsCount ?? 0);
                if (Number.isFinite(v1Count) && v1Count > 0) return true;
                if (Array.isArray(item?.account?.options)) {
                    return item.account.options.some((opt: any) => {
                        const count = Number(opt?.instructionsCount ?? 0);
                        const next = Number(opt?.instructionsNextIndex ?? 0);
                        const exec = Number(opt?.instructionsExecutedCount ?? 0);
                        return (Number.isFinite(count) && count > 0) ||
                            (Number.isFinite(next) && next > 0) ||
                            (Number.isFinite(exec) && exec > 0);
                    });
                }
                return false;
            })();
            if (state === 2) voting++;
            if (state === 0) draft++;
            if (state === 3 || state === 5) passed++;
            if (state === 7 || state === 9) defeated++;
            if (isPoll) polls++;
            if (hasInstructions) withInstructions++;
        }
        return {
            all: list.length,
            voting,
            draft,
            passed,
            defeated,
            polls,
            withInstructions,
        };
    }, [proposals]);

    const getProposalVoteStats = React.useCallback((item: any) => {
        const councilMint = realm?.account?.config?.councilMint
            ? new PublicKey(realm.account.config.councilMint).toBase58()
            : null;
        const proposalMint = normalizePkString(item?.account?.governingTokenMint);
        const isCouncilVote = !!councilMint && !!proposalMint && councilMint === proposalMint;
        const decimals = isCouncilVote ? 0 : Number(governingTokenDecimals || 0);
        const hasLegacy = item?.account?.yesVotesCount !== undefined || item?.account?.noVotesCount !== undefined;
        const yes = hasLegacy
            ? voteWeightToUi(item?.account?.yesVotesCount || 0, decimals)
            : voteWeightToUi(item?.account?.options?.[0]?.voteWeight || 0, decimals);
        const no = hasLegacy
            ? voteWeightToUi(item?.account?.noVotesCount || 0, decimals)
            : voteWeightToUi(item?.account?.denyVoteWeight || 0, decimals);
        const total = Math.max(0, yes + no);
        const yesPct = total > 0 ? (yes / total) * 100 : 0;
        return { yes, no, total, yesPct };
    }, [realm, governingTokenDecimals]);

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
    }, [memberMap]);

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
    }, [memberMap]);

    const shortAddress = (address?: string | null) => {
        if (!address) return 'unknown';
        if (address.length <= 10) return address;
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };

    const getProposalAuthorAddress = React.useCallback((item: any): string | null => {
        const direct = normalizePkString(item?.account?.governingTokenOwner);
        if (direct) return direct;

        const tor = normalizePkString(item?.account?.tokenOwnerRecord);
        if (tor && tokenOwnerRecordToAuthor.has(tor)) {
            return tokenOwnerRecordToAuthor.get(tor) || null;
        }
        return null;
    }, [tokenOwnerRecordToAuthor]);

    const getProposalAuthorMeta = React.useCallback((item: any) => {
        const author = getProposalAuthorAddress(item);
        const proposalMint = normalizePkString(item?.account?.governingTokenMint);
        const councilMint = normalizePkString(realm?.account?.config?.councilMint);
        const isCouncil = !!councilMint && !!proposalMint && councilMint === proposalMint;
        const proposalTypeLabel = isCouncil ? 'Council' : 'Community';
        const voteDecimals = isCouncil ? 0 : Number(governingTokenDecimals || 0);

        const tor = normalizePkString(item?.account?.tokenOwnerRecord);
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
            votingPower,
        };
    }, [getProposalAuthorAddress, realm, governingTokenDecimals, tokenOwnerRecordToMember, memberMap]);

    const authorVetoCounts = React.useMemo(() => {
        const counts = new Map<string, number>();
        const source = Array.isArray(allProposals) ? allProposals : (Array.isArray(proposals) ? proposals : []);
        for (const proposal of source) {
            if (Number(proposal?.account?.state) !== 9) continue; // vetoed
            const author = getProposalAuthorAddress(proposal);
            if (!author) continue;
            counts.set(author, (counts.get(author) || 0) + 1);
        }
        return counts;
    }, [allProposals, proposals, getProposalAuthorAddress]);

    const getProposalStateAccent = (state: number) => {
        if (state === 2) return '#58a6ff';
        if (state === 3 || state === 5) return '#4caf50';
        if (state === 7 || state === 9) return '#ef5350';
        if (state === 0) return '#ffb74d';
        return 'rgba(255,255,255,0.2)';
    };

    const filteredProposals = React.useMemo(() => {
        if (!Array.isArray(proposals)) return [];
        let scoped = proposals;
        if (statusFilter !== 'all') {
            scoped = proposals.filter((item: any) => {
                const state = Number(item?.account?.state);
                const isPoll = Number(item?.account?.voteType?.type) === 1;
                if (statusFilter === 'voting') return state === 2;
                if (statusFilter === 'draft') return state === 0;
                if (statusFilter === 'passed') return state === 3 || state === 5;
                if (statusFilter === 'defeated') return state === 7 || state === 9;
                if (statusFilter === 'polls') return isPoll;
                if (statusFilter === 'instructions') {
                    const v1Count = Number(item?.account?.instructionsCount ?? 0);
                    if (Number.isFinite(v1Count) && v1Count > 0) return true;
                    if (Array.isArray(item?.account?.options)) {
                        return item.account.options.some((opt: any) => {
                            const count = Number(opt?.instructionsCount ?? 0);
                            const next = Number(opt?.instructionsNextIndex ?? 0);
                            const exec = Number(opt?.instructionsExecutedCount ?? 0);
                            return (Number.isFinite(count) && count > 0) ||
                                (Number.isFinite(next) && next > 0) ||
                                (Number.isFinite(exec) && exec > 0);
                        });
                    }
                    return false;
                }
                return true;
            });
        }
        if (!searchQuery) return scoped;
        return scoped.filter((item: any) => {
            const name = item?.account?.name?.toLowerCase?.() || '';
            const desc = item?.account?.descriptionLink?.toLowerCase?.() || '';
            const pk =
                item?.pubkey?.toBase58?.()?.toLowerCase?.() ||
                item?.pubkey?.toString?.()?.toLowerCase?.() ||
                '';
            return name.includes(searchQuery) || desc.includes(searchQuery) || pk.includes(searchQuery);
        });
    }, [proposals, searchQuery, statusFilter]);

    const visibleProposals = React.useMemo(() => {
        if (rowsPerPage > 0) {
            return filteredProposals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
        }
        return filteredProposals;
    }, [filteredProposals, rowsPerPage, page]);

    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - filteredProposals.length) : 0;
    const [hasVoted, setHasVoted] = React.useState(false);

    const handleChangePage = (event:any, newPage:number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event:any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleFilterStateChange = () => {
        setFilterState(!filterState);
    }

    React.useEffect(() => {
        if (rowsPerPage <= 0) return;
        const maxPage = Math.max(0, Math.ceil(filteredProposals.length / rowsPerPage) - 1);
        if (page > maxPage) {
            setPage(maxPage);
        }
    }, [filteredProposals.length, rowsPerPage, page]);

    React.useEffect(() => {
        setPage(0);
    }, [statusFilter, searchQuery]);
    
    function GetProposalStatus(props: any){
        const thisitem = props.item;
        const [thisGovernance, setThisGovernance] = React.useState(props.cachedGovernnace);
        const [hasVotedForProp, setHasVotedForProp] = React.useState(false);

        const findProposalVote = (proposalId: string, voterPublicKey: string, voteRecords: any) => {
            // Find the record matching the proposal and voter, and check if voterWeight > 0
            if (voteRecords && voteRecords.length > 0){
                const record = voteRecords.find(
                    item =>
                        item.account.proposal.toBase58() === proposalId &&
                        item.account.governingTokenOwner.toBase58() === voterPublicKey &&
                        item.account.voterWeight > 0
                );
            
                if (record) {
                    console.log("User has voted on the proposal ("+proposalId+"):", record);
                    return true;
                } else {
                    console.log("User has not voted on this proposal ("+proposalId+" - "+voterPublicKey+").");
                    return false;
                }
            }
            //return false;
        };

        React.useEffect(() => { 
            if (publicKey && thisitem?.pubkey && votesForWallet){
                setHasVotedForProp(findProposalVote(thisitem?.pubkey?.toBase58(), publicKey?.toBase58(), votesForWallet));
            }
        }, [publicKey, thisitem, votesForWallet]);

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
                                {thisGovernance?.governance?.account?.config?.baseVotingTime ?
                                    `Ending ${moment.unix(Number(thisitem.account?.signingOffAt)+(Number(thisGovernance?.governance?.account?.config?.baseVotingTime))).fromNow()}`
                                :
                                    <>
                                    {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                       <>
                                       Drafted: {thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))} 
                                       <br/> Signed Off: {thisitem.account?.signingOffAt && (moment.unix(Number((thisitem.account?.signingOffAt))).format("MMMM D, YYYY, h:mm a"))}
                                       <br/> Ended: {thisitem.account?.votingCompletedAt && (moment.unix(Number((thisitem.account?.votingCompletedAt))).format("MMMM D, YYYY, h:mm a"))}
                                       </>
                                    :
                                        <>
                                        {thisitem.account?.state === 0 ?
                                            `Drafted: ${thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))}`
                                        :
                                            <>
                                            Drafted: {thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))} 
                                            <br/> Signed Off: {thisitem.account?.signingOffAt && (moment.unix(Number((thisitem.account?.signingOffAt))).format("MMMM D, YYYY, h:mm a"))}
                                            </>
                                        }
                                        </>
                                    }
                                    </>
                                }
                                    {publicKey &&
                                    <> 
                                    {hasVotedForProp ?
                                        <><br/>You voted</>
                                    :
                                        <><br/>You have not voted for this proposal</>
                                    }
                                    </>
                                    }
                                </>
                            </>
                            }>
                            
                            <Button sx={{borderRadius:'17px',color:'inherit',textTransform:'none'}}>
                                {GOVERNANCE_STATE[thisitem.account?.state]}
                                    <>

                                    {(publicKey && hasVotedForProp) ?
                                            <CheckCircleOutlineIcon sx={{ fontSize:"small", color:"green",ml:1}} />
                                        :
                                            <>
                                                {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                                <>
                                                    { (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                                        <></>
                                                    :
                                                        <>
                                                        {thisitem.account?.state === 4 ? 
                                                            <PlayCircleOutlineIcon sx={{ fontSize:"small", color:"green",ml:1}} />
                                                        :
                                                            <CancelOutlinedIcon sx={{ fontSize:"small", color:"red",ml:1}} />
                                                        }
                                                        </>
                                                    }
                                                </>
                                            :
                                                <>
                                                { thisitem.account?.state === 2 ?
                                                    <TimerIcon sx={{ fontSize:"small",ml:1}} />
                                                
                                                : 
                                                    <>
                                                    { thisitem.account?.state === 0 ? 
                                                        <AccessTimeIcon sx={{ fontSize:"small", color:"gray",ml:1}} />
                                                    :
                                                    <>
                                                        {thisitem.account?.state === 4 ? 
                                                            <PlayCircleOutlineIcon sx={{ fontSize:"small", color:"green",ml:1}} />
                                                        :
                                                            <CancelOutlinedIcon sx={{ fontSize:"small", color:"red",ml:1}} />
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
                            </Button>
                        </Tooltip>
                    </Typography>
                </TableCell>
            </>
        )
    }

    React.useEffect(() => { 
        if (realm)
            endTimer();
    }, [realm]);

    if (loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} color="inherit" />
            </Box>
            
        )
    }

    
        return (
            <>
                <Box
                    sx={{
                        mb: 1.5,
                        p: 1.2,
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(80,120,255,0.12) 0%, rgba(39,190,154,0.08) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1 }}>
                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.35)', mr: 1, my: 0.5 }} />
                        <TextField 
                            id="input-with-sx" 
                            fullWidth 
                            size='small'
                            label="Search Proposals" 
                            value={filteredGovernance}
                            variant='standard'
                            onChange={(e) => setFilteredGovernance(e.target.value)} />
                    </Box>

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 0.8 }}>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'all' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('all')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            All ({proposalCounters.all})
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'voting' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('voting')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            Live ({proposalCounters.voting})
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'draft' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('draft')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            Draft ({proposalCounters.draft})
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'passed' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('passed')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            Passed ({proposalCounters.passed})
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'defeated' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('defeated')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            Defeated ({proposalCounters.defeated})
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'polls' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('polls')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            Polls ({proposalCounters.polls})
                        </Button>
                        <Button
                            size="small"
                            color="inherit"
                            variant={statusFilter === 'instructions' ? 'contained' : 'outlined'}
                            onClick={() => setStatusFilter('instructions')}
                            sx={{ borderRadius: '12px', textTransform: 'none' }}
                        >
                            With Instructions ({proposalCounters.withInstructions})
                        </Button>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                            Showing {filteredProposals.length.toLocaleString()} proposal{filteredProposals.length === 1 ? '' : 's'}
                        </Typography>
                        {!!searchQuery && (
                            <Button
                                size="small"
                                color="inherit"
                                onClick={() => setFilteredGovernance('')}
                                sx={{ borderRadius: '14px', textTransform: 'none', minWidth: 0, px: 1.2 }}
                            >
                                Clear Search
                            </Button>
                        )}
                    </Box>
                </Box>
                
                <TableContainer component={Paper} sx={{background:'none'}}>
                    <Table sx={{ minWidth: 650 }}>
                        <StyledTable sx={{ minWidth: 500 }} size="small" aria-label="Portfolio Table">
                            <TableHead>
                                <TableRow>
                                    <TableCell><Typography variant="caption" sx={{width:"50%"}}>Title</Typography></TableCell>
                                    <TableCell align="center" sx={{width:"15%"}}><Typography variant="caption">Proposed</Typography></TableCell>
                                    {/*
                                    <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">Yes</Typography></TableCell>
                                    <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">No</Typography></TableCell>
                                    */}
                                    <TableCell align="center" sx={{width:"10%"}}><Typography variant="caption">Results</Typography></TableCell>
                                    <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">Status</Typography></TableCell>
                                    {/*<TableCell align="center"><Typography variant="caption">Details</Typography></TableCell>*/}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {/*proposals && (proposals).map((item: any, index:number) => (*/}
                                {proposals && 
                                <>  
                                    {visibleProposals.map((item:any, index:number) => {
                                    const voteStats = getProposalVoteStats(item);
                                    const isPoll = Number(item?.account?.voteType?.type) === 1;
                                    const proposalAuthorMeta = getProposalAuthorMeta(item);
                                    const vetoedByAuthor = proposalAuthorMeta?.author
                                        ? (authorVetoCounts.get(proposalAuthorMeta.author) || 0)
                                        : 0;
                                    const isFlaggedMaliciousAuthor = vetoedByAuthor > 3;
                                    return (
                                    <>
                                        {/*console.log("item ("+index+"): "+JSON.stringify(item))*/}
                                        {item?.pubkey && item?.account && item.account?.options && item.account?.options.length > 0 &&
                                            <>
                                                
                                                <TableRow
                                                    key={index}
                                                    sx={{
                                                        borderBottom: "none",
                                                        transition: 'background-color 180ms ease',
                                                        '&:hover': { background: 'rgba(255,255,255,0.05)' },
                                                        '& > .MuiTableCell-root:first-of-type': {
                                                            borderLeft: `3px solid ${getProposalStateAccent(Number(item.account?.state))}`,
                                                            pl: 1.2,
                                                        },
                                                    }}
                                                >
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                                                            <GovernanceProposalDialog 
                                                                governanceType={governanceType} 
                                                                isCancelled={+item.account.state === 6 ? true : false} 
                                                                isCouncil={realm.account.config?.councilMint ? new PublicKey(realm.account.config.councilMint).toBase58() === new PublicKey(item.account?.governingTokenMint).toBase58() : false} 
                                                                state={item.account?.state} title={item.account?.name} 
                                                                description={item.account?.descriptionLink} 
                                                                governanceLookup={governanceLookup} 
                                                                governanceAddress={governanceAddress} 
                                                                cachedGovernance={(cachedGovernance !== proposals) ? proposals : cachedGovernance} 
                                                                item={item} 
                                                                realm={realm} 
                                                                tokenMap={tokenMap} 
                                                                memberMap={memberMap} 
                                                                governanceToken={governanceToken}
                                                            />
                                                            <Tooltip
                                                                title={
                                                                    proposalAuthorMeta?.author
                                                                        ? `${proposalAuthorMeta.author} • ${proposalAuthorMeta.proposalTypeLabel} power: ${getFormattedNumberToLocale(proposalAuthorMeta.votingPower)}`
                                                                        : 'Author unavailable'
                                                                }
                                                            >
                                                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)', pl: 1.8, display: 'block', textAlign: 'left' }}>
                                                                    by {shortAddress(proposalAuthorMeta?.author)} • power {formatCompactNumber(proposalAuthorMeta?.votingPower || 0)}
                                                                </Typography>
                                                            </Tooltip>
                                                            <Box sx={{ pl: 1.8, display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                                                                <Chip
                                                                    size="small"
                                                                    label={`${proposalAuthorMeta?.proposalTypeLabel || 'Unknown'} Proposal`}
                                                                    sx={{
                                                                        height: 20,
                                                                        fontSize: '0.65rem',
                                                                        borderRadius: '8px',
                                                                        backgroundColor:
                                                                            proposalAuthorMeta?.proposalTypeLabel === 'Council'
                                                                                ? 'rgba(103, 58, 183, 0.25)'
                                                                                : 'rgba(46, 204, 113, 0.22)',
                                                                        color: 'rgba(255,255,255,0.9)',
                                                                    }}
                                                                />
                                                                {isFlaggedMaliciousAuthor && (
                                                                    <Tooltip title={`Author has ${vetoedByAuthor} vetoed proposals. Flagged as malicious.`}>
                                                                        <Chip
                                                                            size="small"
                                                                            icon={<WarningAmberIcon sx={{ fontSize: '0.8rem !important' }} />}
                                                                            label={`Risk: ${vetoedByAuthor} vetoed`}
                                                                            sx={{
                                                                                height: 20,
                                                                                fontSize: '0.65rem',
                                                                                borderRadius: '8px',
                                                                                backgroundColor: 'rgba(244, 67, 54, 0.22)',
                                                                                color: 'rgba(255,255,255,0.95)',
                                                                            }}
                                                                        />
                                                                    </Tooltip>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                            {`${item.account?.draftAt ? (moment.unix(Number((item.account?.draftAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                        </Typography>

                                                    </TableCell>

                                                    {/*item?.account?.voteType?.type === 1 ?
                                                        <>
                                                            <TableCell 
                                                                colSpan={2}
                                                                sx={{textAlign:'center'}}>Multiple Choice Poll
                                                            </TableCell>
                                                        </>
                                                    :
                                                        <>

                                                        <TableCell>
                                                            {item.account.yesVotesCount ?
                                                                <Typography variant="h6">
                                                                    
                                                                    <Tooltip title={realm.account.config?.councilMint === item.account?.governingTokenMint?.toBase58() ?
                                                                            <>{Number(item.account.yesVotesCount).toLocaleString()}</>
                                                                        :
                                                                        <>
                                                                                <>
                                                                                {
                                                                                (Number(Number(item.account.yesVotesCount)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()
                                                                                }</>
                                                                            

                                                                        </>
                                                                        }
                                                                    >
                                                                        <Button sx={{color:'#eee',borderRadius:'17px',textTransform:'none'}}>
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
                                                            :
                                                                <Typography variant="h6">
                                                                    
                                                                    <Tooltip title={(realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(item.account?.governingTokenMint).toBase58()) ?
                                                                        <>{Number(Number(item.account?.options[0].voteWeight)).toLocaleString()}</>
                                                                        :
                                                                        <>
                                                                            {Number((Number(item.account?.options[0].voteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                        </>

                                                                        }
                                                                    >
                                                                        <Button sx={{color:'white',borderRadius:'17px',textTransform:'none'}}>
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
                                                            {(item.account?.options && item.account?.options[0]?.voterWeight) &&
                                                                <Typography variant="h6">
                                                                    <Tooltip title={tokenMap.get(item.account.governingTokenMint.toBase58()) ?
                                                                        <>
                                                                        {Number((Number(item.account?.options[0].voterWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                        </>
                                                                        :
                                                                        <>
                                                                            {Number(item.account?.options[0].voterWeight).toLocaleString()}
                                                                        </>
                                                                        }
                                                                    >
                                                                        <Button sx={{color:'white',borderRadius:'17px',textTransform:'none'}}>
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

                                                            {item.account?.noVotesCount &&
                                                                    <Typography variant="h6">
                                                                        
                                                                        <Tooltip title={realm.account.config?.councilMint === item.account?.governingTokenMint?.toBase58() ?
                                                                                <>{Number(item.account.noVotesCount).toLocaleString()}</>
                                                                            :
                                                                            <>
                                                                                <>{Number((Number(item.account.noVotesCount)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}</>
                                                                            </>
                                                                            }
                                                                        >
                                                                            <Button sx={{color:'#eee',borderRadius:'17px',textTransform:'none'}}>
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
                                                        
                                                            
                                                            {item.account?.denyVoteWeight && 
                                                                <Typography variant="h6">
                                                                    <Tooltip title={Number(item.account?.denyVoteWeight) <= 1 ?
                                                                        <>
                                                                            {Number(item.account?.denyVoteWeight).toLocaleString()}
                                                                        </>
                                                                        :
                                                                        <>
                                                                            {Number((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                        </>
                                                                        }
                                                                    >
                                                                        <Button sx={{color:'white',borderRadius:'17px',textTransform:'none'}}>
                                                                            {Number(item.account?.denyVoteWeight) > 0 ?
                                                                            <>
                                                                            {`${(((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals ))/((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals ))+(Number(item.account?.options[0].voteWeight)/Math.pow(10, governingTokenDecimals ))))*100).toFixed(2)}%`}
                                                                            </>:
                                                                            <>0%</>
                                                                            }
                                                                        </Button>
                                                                    </Tooltip>
                                                                </Typography>
                                                            }
                                                        </TableCell>
                                                        </>
                                                    */}

                                                    {isPoll ?
                                                        <TableCell 
                                                            sx={{textAlign:'center'}}>
                                                            <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.85)' }}>
                                                                Poll
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                                                                {formatCompactNumber(voteStats.total)} responses
                                                            </Typography>
                                                        </TableCell>
                                                    :
                                                        <TableCell>
                                                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                                    <Tooltip title={
                                                                        <>
                                                                            {item.account.yesVotesCount ?
                                                                        
                                                                            <>
                                                                            
                                                                                YES:&nbsp;
                                                                                {(realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(item.account?.governingTokenMint).toBase58()) ?
                                                                                <>{Number(Number(item.account?.options[0].voteWeight)).toLocaleString()}</>
                                                                                :
                                                                                <>
                                                                                    {Number((Number(item.account?.options[0].voteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                                </>
                                                                                }
                                                                                <br/>
                                                                                NO:&nbsp;
                                                                                {item.account?.noVotesCount &&
                                                                                <>
                                                                                    {realm.account.config?.councilMint === item.account?.governingTokenMint?.toBase58() ?
                                                                                        <>{Number(item.account.noVotesCount).toLocaleString()}</>
                                                                                    :
                                                                                    <>
                                                                                        <>{Number((Number(item.account.noVotesCount)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}</>
                                                                                    </>
                                                                                    }
                                                                                </>
                                                                                }
                                                                            </>
                                                                            :
                                                                            <>YES:&nbsp;
                                                                                {(realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(item.account?.governingTokenMint).toBase58()) ?
                                                                                    <>{Number(Number(item.account?.options[0].voteWeight)).toLocaleString()}</>
                                                                                    :
                                                                                    <>
                                                                                        {Number((Number(item.account?.options[0].voteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                                    </>
                                                                                }
                                                                                <br/>
                                                                                NO:&nbsp;
                                                                                {Number(item.account?.denyVoteWeight) <= 1 ?
                                                                                    <>
                                                                                        {Number(item.account?.denyVoteWeight).toLocaleString()}
                                                                                    </>
                                                                                    :
                                                                                    <>
                                                                                        {Number((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                                    </>
                                                                                }
                                                                            </>
                                                                            }
                                                                        </>
                                                                    }
                                                                    >
                                                                        <Button sx={{width:'100%',color:'#eee',borderRadius:'17px',textTransform:'none'}}>
                                                                            <Box sx={{ width: '100%', mr: 1 }}>
                                                                                <VotesLinearProgress 
                                                                                    variant="determinate" 
                                                                                    value={voteStats.yesPct}
                                                                                    sx={{
                                                                                        bgcolor: (item.account?.state !== 2) ? 'gray' : 'inherit', // Background color when grayed out
                                                                                        '& .MuiLinearProgress-bar': {
                                                                                          backgroundColor: (item.account?.state !== 2) ? 'gray' : '#primary.main', // Foreground color when grayed out
                                                                                        },
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                            <Box sx={{ minWidth: 35 }}>
                                                                                <Typography
                                                                                    variant="caption"
                                                                                    color={(item.account?.state === 2) ? `white` : `gray`}
                                                                                >{`${voteStats.yesPct.toFixed(2)}%`}</Typography>
                                                                            </Box>
                                                                        </Button>
                                                                    </Tooltip>
                                                                    <Box sx={{ ml: 1, minWidth: 90, textAlign: 'right' }}>
                                                                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.82)', lineHeight: 1.2 }}>
                                                                            Y {formatCompactNumber(voteStats.yes)} / N {formatCompactNumber(voteStats.no)}
                                                                        </Typography>
                                                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.2 }}>
                                                                            {formatCompactNumber(voteStats.total)} total
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                        </TableCell>
                                                    }
                                                    <GetProposalStatus item={item} cachedGovernance={cachedGovernance} castedVotesForWallet={votesForWallet} />
                                                    {/*
                                                    <TableCell align="center">
                                                        <GovernanceProposalDialog governanceLookup={governanceLookup} governanceAddress={governanceAddress} cachedGovernance={cachedGovernance} item={item} realm={realm} tokenMap={tokenMap} memberMap={memberMap} governanceToken={governanceToken} />
                                                    </TableCell>
                                                    */}
                                                </TableRow>
                                                    
                                            </>
                                        }
                                    </>
                                    )})}
                                {visibleProposals.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 5, borderBottom: 'none' }}>
                                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                                                No proposals match your search.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
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
                                    colSpan={6}
                                    count={filteredProposals.length}
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
                    <Box
                        display="flex"
                        justifyContent="flex-end"
                        sx={{
                            alignItems:"right",
                            m:1
                        }}
                    >
                        <FormGroup row>
                            <FormControlLabel control={<Switch onChange={handleFilterStateChange} size="small" />} label={<><Typography variant="caption">Show Cancelled Proposals</Typography></>} />
                        </FormGroup>
                    </Box>
                </TableContainer>
            </>
        )
}

export function GovernanceCachedView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const { handlekey, proposal: routeProposalPk } = useParams<{ handlekey: string; proposal?: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const sharedProposalPk =
      searchParams.get("proposal") ||
      searchParams.get("proposalPk") ||
      routeProposalPk ||
      null;
    const showGovernanceTitle = props.showGovernanceTitle !== undefined ? props.showGovernanceTitle : true;
    const background = null; //props?.background ? props.background : null;
    const textColor = null; //props?.textColor ? props.background : null;

    const showGovernanceNavigation = props.showGovernanceNavigation !== undefined ? props.showGovernanceNavigation : true;
    
    const governanceAddress = urlParams;
    const [cachedRealm, setCachedRealm] = React.useState(null);
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    //const governanceAddress = props.governanceAddress;
    const [loading, setLoading] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(null);
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const connection = RPC_CONNECTION;
    const { publicKey, wallet } = useWallet();
    const [proposals, setProposals] = React.useState(null);
    const [allProposals, setAllProposals] = React.useState(null);
    const [participating, setParticipating] = React.useState(false)
    const [participatingRealm, setParticipatingRealm] = React.useState(null)
    const [nftBasedGovernance, setNftBasedGovernance] = React.useState(false);
    const [thisToken, setThisToken] = React.useState(null);
    const [totalVaultValue, setTotalVaultValue] = React.useState(null);
    const [totalProposals, setTotalProposals] = React.useState(null);
    const [totalActualProposals, setTotalActualProposals] = React.useState(null);
    const [totalPassed, setTotalPassed] = React.useState(null);
    const [totalDefeated, setTotalDefeated] = React.useState(null);
    const [totalVotesCasted, setTotalVotesCasted] = React.useState(null);
    const [totalCouncilVotesCasted, setTotalCouncilVotesCasted] = React.useState(null);
    const [governingTokenMint, setGoverningTokenMint] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [governanceType, setGovernanceType] = React.useState(0);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);
    const [isParticipatingInDao, setParticipatingInDao] = React.useState(false);
    const [filterState, setFilterState] = React.useState(true);
    const [allGovernances, setAllGovernances] = React.useState(null);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [daoName, setDaoName] = React.useState(null);
    const [daoIcon, setDaoIcon] = React.useState(null);
    const [votesForWallet, setVotesForWallet] = React.useState(null);
    const [gspl, setGSPL] = React.useState(null);
    const [gsplMetadata, setGSPLMetadata] = React.useState(null);

    const sharedProposalItem = React.useMemo(() => {
        if (!sharedProposalPk || !proposals || !Array.isArray(proposals)) {
            return null;
        }

        return (
            proposals.find((proposalItem: any) => {
                const proposalKey = proposalItem?.pubkey?.toBase58?.()
                    || proposalItem?.pubkey?.toString?.()
                    || null;
                return proposalKey === sharedProposalPk;
            }) || null
        );
    }, [sharedProposalPk, proposals]);

    const governanceShareTitle = sharedProposalItem?.account?.name
        ? `${sharedProposalItem.account.name} ${realmName ? `| ${realmName}` : ''}`
        : `${realmName || governanceAddress} Governance`;
    const governanceShareDescription = sharedProposalItem?.account?.name
        ? `Proposal ${sharedProposalItem.account.name}${realmName ? ` in ${realmName}` : ''} powered by Governance.so by Grape`
        : `${realmName || governanceAddress} powered by Governance.so by Grape`;
    const governanceShareUrl = sharedProposalPk
        ? `https://governance.so/proposal/${governanceAddress}/${sharedProposalPk}`
        : `https://governance.so/dao/${governanceAddress}`;

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

    const getGovernanceParameters = async () => {
        let grealm = null;
        if (!loading){
            setRealm(null);
            setRealmName(null);
            setMemberMap(null);

            startTimer();
            setLoading(true);
            try{
                    
                console.log("SPL Governance: "+governanceAddress);
                
                //console.log("cached_governance: "+JSON.stringify(cached_governance));
                
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                grealm = await getRealmIndexed(governanceAddress);
                
                //if (!grealm)
                //    grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
                //console.log("grealm: "+JSON.stringify(grealm));
                setRealm(grealm);
                setRealmName(grealm.account.name);
                
                //let ggov = await getGovernance(RPC_CONNECTION, new PublicKey(grealm.owner))
                
                const realmPk = new PublicKey(grealm?.pubkey);
                //const governanceRules = await getAllGovernances(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk);
                //console.log("all rules: "+JSON.stringify(governanceRules))
                // setAllGovernances(governanceRules);
                const governanceRulesIndexed = await getAllGovernancesIndexed(realmPk.toBase58(), grealm?.owner);
                const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
                //console.log("all rules indexed: "+JSON.stringify(governanceRulesIndexed))
                setAllGovernances(governanceRulesIndexed);
                //console.log("realmPk: "+realmPk)
                const indexedTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(realmPk.toBase58(), new PublicKey(grealm?.owner).toBase58())
                //console.log("indexTokenOwnerRecords "+JSON.stringify(indexedTokenOwnerRecords));
                //let rawTokenOwnerRecords = indexedTokenOwnerRecords;
                
                //rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
                console.log("indexedTokenOwnerRecords "+indexedTokenOwnerRecords?.length);
                /*
                if (cachedMemberMap && cachedMemberMap.length > 0){ // we should consider merging
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
                    rawTokenOwnerRecords = indexedTokenOwnerRecords;//cachedMemberMap;
                } else if (!indexedTokenOwnerRecords){
                    rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
                }*/
                
                //console.log("here?")
                
                setMemberMap(indexedTokenOwnerRecords);
                
                let gTD = 0;
                
                let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account?.communityMint));
                // do we need to use DAS for this to make it faster?

                //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
                gTD = tokenDetails.value.data.parsed.info.decimals;
                
                setGoverningTokenDecimals(gTD);

                if (grealm.account?.communityMint){
                    try{
                        
                        //const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                        //td = await token.value.data.parsed.info.decimals;
                        //setGovernanceType(0);
                        

                        if (tokenMap.get(new PublicKey(grealm.account.communityMint).toBase58())){
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
                                const token = await connection.getParsedAccountInfo(new PublicKey(grealm.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                                console.log("found: "+JSON.stringify(token.value.data.parsed.info.decimals))
                                if (token.value.data.parsed.info.decimals > 0)
                                    setGovernanceType(0);
                                else
                                    setGovernanceType(2);
                                //gTD = 0;
                                //setGoverningTokenDecimals(gTD);
                            }
                        }
                    } catch(emt){
                        //const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                        //console.log("found: "+JSON.stringify(token.value.data.parsed.info.decimals))
                        setGovernanceType(0);
                    }
                }
                
                const gprops = await getAllProposalsIndexed(governanceRulesStrArr, grealm?.owner, governanceAddress);
                    //console.log("gprops: "+JSON.stringify(gprops));    
                    //console.log("B realm: "+JSON.stringify(grealm));

                    //console.log("communityMintMaxVoteWeightSource: " + grealm.account.config.communityMintMaxVoteWeightSource.value.toNumber());
                    
                    if (grealm?.account?.config?.useCommunityVoterWeightAddin){
                        
                        console.log("Getting Realm Config Address")
                        
                        const realmConfigPk = await getRealmConfigAddress(
                            programId,
                            realmPk
                        )
                        //console.log("realmConfigPk: "+JSON.stringify(realmConfigPk));
                        try{ 


                            console.log("Getting Realm Config")

                            /*
                            const realmConfig = await getRealmConfig(
                                connection,
                                realmConfigPk
                            )
                            */

                            const realmConfig = await getRealmConfigIndexed(
                                //realmConfigPk,
                                null,
                                programId,
                                realmPk,
                            )

                            

                            console.log("realmConfig: "+JSON.stringify(realmConfig));
                            /*
                            const tryRealmConfig = await tryGetRealmConfig(
                                connection,
                                programId,
                                realmPk
                            )*/
                            
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
                    
                    //const gprops = await getAllProposals(RPC_CONNECTION, grealm.owner, realmPk);
                    //const gprops = await getAllProposalsIndexed(governanceRulesStrArr, grealm?.owner);
                    const allprops: any[] = [];
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    let ttcvc = 0;
                    const councilMint = normalizePkString(grealm?.account?.config?.councilMint);
                    
                    const rpcprops = new Array();
                    for (const props of gprops){
                        if (props && props.length > 0){
                            for (const prop of props){
                                if (prop){
                                    rpcprops.push(prop);
                                }
                            }
                        } else{
                            rpcprops.push(props);
                        }
                    }
                        
                    for (const prop of rpcprops){
                        
                            allprops.push(prop);
                            
                            if (prop.account?.state === 3 || prop.account?.state === 5)
                                passed++;
                            else if (prop.account?.state === 7)
                                defeated++;

                            const proposalMint = normalizePkString(prop.account?.governingTokenMint);
                            const isCouncilProposal = !!councilMint && !!proposalMint && councilMint === proposalMint;
                            const voteDecimals = isCouncilProposal ? 0 : (gTD || 0);

                            let yesVotes = 0;
                            let noVotes = 0;

                            if (prop.account?.yesVotesCount !== undefined || prop.account?.noVotesCount !== undefined) {
                                yesVotes = voteWeightToUi(prop.account?.yesVotesCount || 0, voteDecimals);
                                noVotes = voteWeightToUi(prop.account?.noVotesCount || 0, voteDecimals);
                            } else if (prop.account?.options?.length > 0 || prop.account?.denyVoteWeight !== undefined) {
                                yesVotes = voteWeightToUi(prop.account?.options?.[0]?.voteWeight || 0, voteDecimals);
                                noVotes = voteWeightToUi(prop.account?.denyVoteWeight || 0, voteDecimals);
                            }

                            const castedVotesForProposal = yesVotes + noVotes;
                            if (Number.isFinite(castedVotesForProposal) && castedVotesForProposal >= 0) {
                                if (isCouncilProposal) {
                                    ttcvc += castedVotesForProposal;
                                } else {
                                    ttvc += castedVotesForProposal;
                                }
                            }
                        
                    }
                    

                    const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                    
                    setTotalDefeated(defeated);
                    setTotalPassed(passed);
                    setTotalActualProposals(+defeated+passed);
                    setTotalProposals(sortedResults.length);
                    setTotalVotesCasted(ttvc);
                    setTotalCouncilVotesCasted(ttcvc);
                    setAllProposals(allprops);
                    setProposals(sortedResults);

                
            }catch(e){console.log("ERR: "+e)}
        }

        const fetchedgspl = await initGrapeGovernanceDirectory();
        setGSPL(fetchedgspl);
        console.log("fetchedgspl: "+JSON.stringify(fetchedgspl));
        let gsplMeta = null;
        if (fetchedgspl && grealm){
            for (var diritem of fetchedgspl){
                if (grealm.account.name === diritem.name){ // also make sure that diritem.governanceProgram ===item.parent?
                    // check if there is also metadata and fetch it 
                    if (diritem.metadataUri) {
                        try {
                            const response = await fetch(diritem.metadataUri);
                            if (response.ok) {
                                const metadata = await response.json();
                                gsplMeta = {
                                    gspl:diritem,
                                    metadata: metadata
                                }
                            } else {
                                console.error("Failed to fetch metadata:", diritem.metadataUri);
                            }
                        } catch (error) {
                            console.error("Error fetching metadata:", error);
                        }
                    }

                    if (!gsplMeta){
                        gsplMeta = {
                            gspl:diritem,
                        }
                    }

                    setGSPLMetadata(gsplMeta);
                    console.log("GSPL Entry found for "+diritem.name);
                }
            }
        } else {
            if (realm){
                console.log("Fetch community mint if available and set token metadata accordingly");
                if (realm.account?.communityMint){
                    // use DAS to efficiently get the token metadata
                    // only use this call if we do not have GSPL
                    fetchTokenData(new PublicKey(realm.account.communityMint).toBase58());
                }
            }
        }
    
        // filter for only this governance
        // setGSPLMetadata

        setLoading(false);
    }

    React.useEffect(() => {
        if (allProposals){
            const sortByDraftAtDesc = (a: any, b: any) =>
            ((b.account?.draftAt ?? 0) - (a.account?.draftAt ?? 0));

            if (filterState) {
            const tmpProps = allProposals
                .filter((item) => ![6, 9].includes(item.account?.state))
                .sort(sortByDraftAtDesc);

            console.log("Showing only valid props (excluding executed + vetoed)");
            setProposals(tmpProps);
            } else {
            const tmpProps = allProposals
                .sort(sortByDraftAtDesc);

            console.log("Showing all props");
            setProposals(tmpProps);
            }
        }
    }, [cachedGovernance, allProposals, filterState]);
    
    // we should have a step 4 where we get the token used and set an icon with the token metadata if available
    /*
    
    //for brevity, we're not including the isDesktop function here
    let iconUrl = isDesktop() ? '/desktop.png' : '/mobile.png';
    let manifest = { 
    name: "App name",
    icons: [{
        src: iconUrl, 
        sizes: "512x512", 
        type:"image/png"
    }]
    };
    let content = encodeURIComponent(JSON.stringify(manifest));
    let url = "data:application/manifest+json,"+content;
    let element = document.createElement('link');
    element.setAttribute('rel', 'manifest');
    element.setAttribute('href', url);
    document.querySelector('head').appendChild(element);
    
    */

    const fetchTokenData = async(address:string) => {
        try{
            if (HELIUS_API && !gsplMetadata){
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
                        setDaoName(result.content.metadata.name);
                    }
                    const image = result?.content?.links?.image;
                    
                    if (image){
                        setDaoIcon(image);
                    } else { // check token registry if token exists
                        if (governanceAddress === "899YG3yk4F66ZgbNWLHriZHTXSKk9e1kvsKEquW7L6Mo"){
                            setDaoIcon("https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey/logo.png");
                        }
                    }
                }
            }
        } catch(e){
            console.log("ERR: "+e);
        }
    }

    React.useEffect(() => {
        if (daoName && daoIcon){
            // use helmet to adjust header and set manifest accordingly if needed
            /*
            const img = daoIcon;
            const text = `Welcome to ${daoName}, download this App to get started with an imersive experience!!!`;
            const notification = new Notification("Welcome", { body: text, icon: img });
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") {
                  // The tab has become visible so clear the now-stale Notification.
                  notification.close();
                }
            });
            alert("HERE...")
            */
            //let iconUrl = isDesktop() ? '/desktop.png' : '/mobile.png';
            let manifest = { 
                name: `${daoName} DAO`,
                short_name: {daoName},
                description: `${daoName} Governance, participate, collaborate & learn on everything going on in ${daoName} quickly and easily from the convenience of your device #OPOS`,
                id: `${daoName.replace(/\s/g, '')}.governance.so`,
                dir: "ltr",
                lang: "en",
                orientation: "any",
                scope: `/`,
                start_url: `https://www.governance.so/dao/${governanceAddress}`,
                background_color: "#23063C",
                theme_color: "#23063C",
                display: "standalone",
                display_override: [
                    "window-controls-overlay",
                    "standalone",
                    "browser"
                ],
                icons: [{
                    src: daoIcon, 
                    sizes: "512x512", 
                    type:"image/png"
                }],
                shortcuts: [
                    {
                    name: "Realtime",
                    url: "../realtime",
                    description: "See what is going on in realtime from all DAOs on Solana",
                    icons: [
                        {
                        src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/shortcut_feed.png",
                        sizes: "192x192"
                        }
                    ]
                    },
                    {
                    name: "Profile",
                    url: "../profile",
                    description: "View the DAOs you are participating in",
                    icons: [
                        {
                        src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/shortcut_user.png",
                        sizes: "192x192"
                        }
                    ]
                    }
                ],
                categories: [
                    "utilities"
                ],
                screenshots : [
                {
                    src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/scrn_proposal.png",
                    sizes: "1290x2796",
                    type: "image/png",
                    platform: "android",
                    form_factor: "narrow",
                    label: "Proposal View"
                },
                {
                    src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/scrn_realtime.png",
                    sizes: "1290x2796",
                    type: "image/png",
                    platform: "android",
                    form_factor: "narrow",
                    label: "Realtime"
                },
                {
                    src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/scrn_governance.png",
                    sizes: "1290x2796",
                    type: "image/png",
                    platform: "android",
                    form_factor: "narrow",
                    label: "Directory"
                },
                {
                    src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/scrn_wallet.png",
                    sizes: "1290x2796",
                    type: "image/png",
                    platform: "android",
                    form_factor: "narrow",
                    label: "Mobile Wallet"
                },
                {
                    src: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/scrn_connect_tools.png",
                    sizes: "2796x1290",
                    type: "image/png",
                    platform: "android",
                    form_factor: "narrow",
                    label: "DAO Voter Management"
                }
                ]
            };

            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) {
                manifestLink.parentNode.removeChild(manifestLink);
            }
            let content = encodeURIComponent(JSON.stringify(manifest));
            let url = "data:application/manifest+json,"+content;
            let element = document.createElement('link');
            element.setAttribute('rel', 'manifest');
            element.setAttribute('href', url);
            document.querySelector('head').appendChild(element);

            // update also the touch icon

            element = document.createElement('link');
            element.setAttribute('rel', 'apple-touch-icon');
            element.setAttribute('sizes', '512x512');
            element.setAttribute('href', daoIcon);
            document.querySelector('head').appendChild(element);
            
        } else { // revert to original JSON
            const manifestLink = document.querySelector('link[rel="manifest"]');
            if (manifestLink) {
                manifestLink.parentNode.removeChild(manifestLink);
            }
            let url = '/up_/manifest.webmanifest';
            let element = document.createElement('link');
            element.setAttribute('rel', 'manifest');
            element.setAttribute('href', url);
            document.querySelector('head').appendChild(element);

            const appleTouchIconLink = document.querySelector('link[rel="apple-touch-icon"]');
            if (appleTouchIconLink) {
                appleTouchIconLink.parentNode.removeChild(appleTouchIconLink);
            }

            element = document.createElement('link');
            element.setAttribute('rel', 'apple-touch-icon');
            element.setAttribute('sizes', '512x512');
            element.setAttribute('href', 'https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/touch-icon.png');
            document.querySelector('head').appendChild(element);
        }
    }, [daoName, daoIcon]);

    
    const POLLING_INTERVAL_MS = 600000; // 60 mins, adjust as needed

    React.useEffect(() => {
        if (!governanceAddress) return;

        let intervalId: NodeJS.Timeout;

        const loadAndPoll = async () => {
            console.log("Step 2.");
            await getGovernanceParameters();

            // Start interval after first load
            intervalId = setInterval(() => {
                console.log("Refreshing governance data...");
                getGovernanceParameters();
            }, POLLING_INTERVAL_MS);
        };

        loadAndPoll();

        // Cleanup on unmount or governanceAddress change
        return () => {
            if (intervalId) clearInterval(intervalId);
        };

    }, [governanceAddress]);
    
    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    const getVotesForWallet = async() => {
        const votes = await getVoteRecordsByVoterIndexed(realm?.owner?.toBase58(),governanceAddress,publicKey.toBase58());
        // here lets cache this so we can display it nice
        setVotesForWallet(votes);
    }

    React.useEffect(() => {
        if (publicKey && governanceAddress){
            getVotesForWallet();
        }

    }, [publicKey, governanceAddress]);

    React.useEffect(() => {
        if (background)
            document.body.style.backgroundColor = background;
        if (textColor)
            document.body.style.color = textColor;
        
        if (tokenMap){
            console.log("Step 1.")
            //callGovernanceLookup();
            getGovernanceParameters();
        }
    }, [tokenMap]);

    React.useEffect(() => { 
        if (!loading){
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);
    
    const getCachedGovernanceFromLookup = async () => {
        let cached_governance = new Array();
        setCachedRealm(null);
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){
                    if (glitem?.realm)
                        setCachedRealm(glitem.realm);
                    if (glitem?.memberFilename){
                        const cached_members = await getFileFromLookup(glitem.memberFilename, storagePool);
                        setCachedMemberMap(cached_members);
                    }
                    if (glitem?.totalVaultValue)
                        setTotalVaultValue(glitem.totalVaultValue);
                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);

                    setCachedTimestamp(glitem.timestamp);
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
            
            setCachedGovernance(cached_governance);
        } else{
            console.log("ERROR: Cached Governance for "+governanceAddress+" try to refetch cache for this address");
        }
        //getGovernanceParameters(cached_governance);
    }

    const startTimer = () => {
        setStartTime(Date.now());
        setEndTime(null);
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    const safeMetricNumber = (value: any): number => {
        const parsed = Number(value ?? 0);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const communityVotesCasted = safeMetricNumber(totalVotesCasted);
    const hasCouncilVotes = totalCouncilVotesCasted !== null && totalCouncilVotesCasted !== undefined;
    const councilVotesCasted = safeMetricNumber(totalCouncilVotesCasted);
    const resolvedProposalCount = safeMetricNumber(totalActualProposals);
    const totalProposalCount = safeMetricNumber(totalProposals);
    const passedProposalCount = safeMetricNumber(totalPassed);
    const defeatedProposalCount = safeMetricNumber(totalDefeated);
    const passRate = resolvedProposalCount > 0 ? (passedProposalCount / resolvedProposalCount) * 100 : 0;
    const participationCoverage = totalProposalCount > 0 ? (resolvedProposalCount / totalProposalCount) * 100 : 0;

    //if (publicKey){
        if(loading){
            return (
                <ThemeProvider theme={grapeTheme}>
                    <Box
                        sx={{
                            width:'100%',
                            mt: showGovernanceNavigation ? 6 : 0,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            p: showGovernanceNavigation ? 4 : 0,
                            pt:4,
                            pb:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="caption" sx={{color:'white'}}>Loading Governance Proposals {governanceAddress}</Typography>
                        
                        <LinearProgress color="inherit" />
                        
                    </Box>
                </ThemeProvider>
            )
        } else{
            if (proposals && tokenMap && memberMap && realm){
                return (
                    <>
                        <Box
                            sx={{
                                width:'100%',
                                mt: showGovernanceNavigation ? 6 : 0,
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                overflow: 'hidden',
                                p: showGovernanceNavigation ? 1 : 0,
                                color: 'white',
                            }} 
                        > 
                            <Helmet>
                                <meta name="description" content={governanceShareDescription} />
                                <title>{governanceShareTitle}</title>

                                <meta property="og:url" content={governanceShareUrl}/>
                                <meta property="og:type" content="website"/>
                                <meta property="og:title" content={governanceShareTitle}/>
                                <meta property="og:description" content={governanceShareDescription}/>
                                <meta property="og:image" content="https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png"/>

                                <meta name="twitter:card" content="summary_large_image"/>
                                <meta name="twitter:title" content={governanceShareTitle}/>
                                <meta name="twitter:site" content="@grapeprotocol"/>
                                <meta name="twitter:description" content={governanceShareDescription}/>
                                <meta name="twitter:image" content="https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/governancesocialsplashv2.png"/>
                                <meta name="twitter:image:alt" content={governanceShareTitle}/>
                            </Helmet>

                            {realm &&
                                <>
                                    <Grid container
                                        sx={{
                                        }}
                                    >
                                        
                                        <GovernanceHeaderView
                                            governanceName={realmName}
                                            governanceAddress={governanceAddress}
                                            gsplMetadata={gsplMetadata}
                                        />
                                        {(showGovernanceNavigation && realm) ?
                                            <Grid item sm={6} container justifyContent="flex-end">
                                                <GovernanceNavigation governanceAddress={governanceAddress} cachedMemberMap={cachedMemberMap} realm={realm} />
                                                <ThemeProvider theme={grapeTheme}>  
                                                    <GovernancePower governanceAddress={governanceAddress} realm={realm} />
                                                </ThemeProvider>
                                            </Grid>
                                            :<></>
                                        }
                                    </Grid>

                                    <Box 
                                        sx={{
                                            mt:1,
                                            ml:1,
                                            mr:1,}}
                                    >
                                        <GovernanceRealtimeInfo governanceAddress={governanceAddress} title={'Live'} tokenMap={tokenMap} />
                                    </Box>

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

                            
                                    <Box sx={{ 
                                        p:1}}>
                                        <Grid container spacing={1}>
                                        {/*
                                        <Grid item xs={12} sm={6} md={6} lg={3} key={1}>
                                                <Box
                                                    sx={{
                                                        borderRadius:'24px',
                                                        m:0,
                                                        p:1,
                                                        background: 'rgba(0, 0, 0, 0.2)',
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                        <>Treasury</>
                                                    </Typography>
                                                    <Grid
                                                        container
                                                        justifyContent='center'
                                                        alignItems='center'
                                                        sx={{}}
                                                    >
                                                        <Tooltip title={<>
                                                                Treasury total holdings value
                                                                </>
                                                            }>
                                                                <Button
                                                                    color='inherit'
                                                                    sx={{
                                                                        borderRadius:'17px',
                                                                    }}
                                                                >
                                                                    <Grid container
                                                                    sx={{
                                                                        verticalAlign: 'bottom'}}
                                                                    >
                                                                        {totalVaultValue ?
                                                                            <Typography variant="h4">
                                                                                ${getFormattedNumberToLocale(totalVaultValue.toFixed(2))} 
                                                                            </Typography>
                                                                        :<>-</>
                                                                        }
                                                                    </Grid>
                                                                </Button>
                                                        </Tooltip>
                                                    </Grid>
                                                </Box>
                                            </Grid>
                                        */}

                                            <Grid item xs={12} sm={6} md={4} lg={4} key="casted-votes">
                                                <Tooltip
                                                    title={
                                                        <>
                                                            Total vote weight cast in this governance.
                                                            <br />
                                                            {hasCouncilVotes ? 'Community / Council split shown.' : 'Community votes only.'}
                                                        </>
                                                    }
                                                >
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            borderRadius: '16px',
                                                            m: 0,
                                                            p: 1.25,
                                                            height: '100%',
                                                            background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            cursor: 'help',
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: '#8ec5ff', letterSpacing: 0.25, textTransform: 'uppercase' }}
                                                        >
                                                            Casted Vote Weight
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                mt: 0.35,
                                                                fontSize: '1.55rem',
                                                                fontWeight: 700,
                                                                lineHeight: 1.15,
                                                                color: 'rgba(255,255,255,0.96)',
                                                            }}
                                                        >
                                                            {formatCompactNumber(communityVotesCasted)}
                                                            {hasCouncilVotes ? ` / ${formatCompactNumber(councilVotesCasted)}` : ''}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.55, color: 'rgba(255,255,255,0.66)' }}>
                                                            Community{hasCouncilVotes ? ' / Council' : ''}
                                                        </Typography>
                                                    </Paper>
                                                </Tooltip>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={4} lg={4} key="proposal-success-rate">
                                                <Tooltip
                                                    title={
                                                        <>
                                                            Resolved proposals and pass rate.
                                                            <br />
                                                            Pass rate = Passed / Resolved.
                                                        </>
                                                    }
                                                >
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            borderRadius: '16px',
                                                            m: 0,
                                                            p: 1.25,
                                                            height: '100%',
                                                            background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            cursor: 'help',
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: '#72d38c', letterSpacing: 0.25, textTransform: 'uppercase' }}
                                                        >
                                                            Proposals / Pass Rate
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                mt: 0.35,
                                                                fontSize: '1.55rem',
                                                                fontWeight: 700,
                                                                lineHeight: 1.15,
                                                                color: 'rgba(255,255,255,0.96)',
                                                            }}
                                                        >
                                                            {resolvedProposalCount} / {passRate.toFixed(1)}%
                                                        </Typography>
                                                        <Box sx={{ mt: 1 }}>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={Math.min(100, Math.max(0, passRate))}
                                                                sx={{
                                                                    height: 6,
                                                                    borderRadius: 99,
                                                                    backgroundColor: 'rgba(255,255,255,0.14)',
                                                                    '& .MuiLinearProgress-bar': {
                                                                        borderRadius: 99,
                                                                        backgroundColor: '#72d38c',
                                                                    },
                                                                }}
                                                            />
                                                        </Box>
                                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.55, color: 'rgba(255,255,255,0.66)' }}>
                                                            {totalProposalCount} total proposals • {participationCoverage.toFixed(1)}% resolved
                                                        </Typography>
                                                    </Paper>
                                                </Tooltip>
                                            </Grid>

                                            <Grid item xs={12} sm={6} md={4} lg={4} key="passing-defeated">
                                                <Tooltip title="Total proposals passed versus defeated.">
                                                    <Paper
                                                        elevation={0}
                                                        sx={{
                                                            borderRadius: '16px',
                                                            m: 0,
                                                            p: 1.25,
                                                            height: '100%',
                                                            background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            cursor: 'help',
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: '#f8bc72', letterSpacing: 0.25, textTransform: 'uppercase' }}
                                                        >
                                                            Passing / Defeated
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                mt: 0.35,
                                                                fontSize: '1.55rem',
                                                                fontWeight: 700,
                                                                lineHeight: 1.15,
                                                                color: 'rgba(255,255,255,0.96)',
                                                            }}
                                                        >
                                                            {passedProposalCount} / {defeatedProposalCount}
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                                                            <Chip
                                                                size="small"
                                                                icon={<ThumbUpIcon sx={{ fontSize: 14 }} />}
                                                                label={`${passedProposalCount} passed`}
                                                                sx={{ bgcolor: 'rgba(114, 211, 140, 0.16)', color: 'rgba(255,255,255,0.92)' }}
                                                            />
                                                            <Chip
                                                                size="small"
                                                                icon={<ThumbDownIcon sx={{ fontSize: 14 }} />}
                                                                label={`${defeatedProposalCount} defeated`}
                                                                sx={{ bgcolor: 'rgba(230, 95, 95, 0.16)', color: 'rgba(255,255,255,0.92)' }}
                                                            />
                                                        </Box>
                                                    </Paper>
                                                </Tooltip>
                                            </Grid>
                                            
                                        </Grid>
                                    </Box>
                                    
                            <ThemeProvider theme={grapeTheme}>       
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
                                    allProposals={allProposals}
                                    nftBasedGovernance={nftBasedGovernance} 
                                    filterState={filterState}
                                    setFilterState={setFilterState}
                                    governanceAddress={governanceAddress}
                                    votesForWallet={votesForWallet} />
                            </ThemeProvider>
                            {endTime &&
                                <Grid
                                    sx={{
                                        m: showGovernanceNavigation ? 0 : 2,
                                    }}
                                >
                                    <Typography 
                                        variant="caption"
                                        sx={{
                                            textAlign:'center'
                                        }}
                                    >
                                        Alternative UI: 
                                        <Button 
                                            aria-label="back"
                                            variant="text" 
                                            color='inherit'
                                            href={`https://realms.today/dao/${governanceAddress}`}
                                            target='blank'
                                            sx={{
                                                borderColor:'rgba(255,255,255,0.05)',
                                                fontSize:'10px'}}
                                        >
                                            <OpenInNewIcon fontSize='inherit' sx={{mr:1}} /> Visit the Realms UI
                                        </Button>
                                        <br/>
                                        Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime<br/>
                                        {cachedTimestamp &&
                                            <>Cached: {moment.unix(Number(cachedTimestamp)).format("MMMM D, YYYY, h:mm a") }<br/></>
                                        }
                                        Cache Node: {storagePool}<br/>
                                    </Typography>

                                    {showGovernanceNavigation ? 
                                        <></> : 
                                        <Box
                                            sx={{
                                                color:'rgba(255,255,255,0.5)',
                                                width:'100%',
                                                alignItems: 'center', textAlign: 'center'
                                            }} 
                                        > 
                                            <Typography variant='subtitle1'>Powered by Governance by Grape</Typography>
                                        </Box>
                                    }
                                </Grid>
                            }
                        </Box>
                    </>        
                );
            }else{
                return (
                    <ThemeProvider theme={grapeTheme}>
                        <Box
                            sx={{
                                width:'100%',
                                mt: showGovernanceNavigation ? 6 : 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                borderRadius: '17px',
                                p: showGovernanceNavigation ? 4 : 0,
                                pt:4,
                                pb:4,
                                alignItems: 'center', textAlign: 'center'
                            }} 
                        > 
                            <Typography variant="caption" sx={{color:'white'}}>Governance Proposals {governanceAddress}</Typography>
                        </Box>
                    </ThemeProvider>
                );
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
