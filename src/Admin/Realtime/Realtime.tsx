import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme, keyframes } from '@mui/material/styles';
import DOMPurify from "dompurify";
import ErrorBoundary from '../../Governance/ErrorBoundary';

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
  TextField,
  InputBase,
  Tooltip,
  LinearProgress,
  LinearProgressProps,
  Divider,
  Chip,
  DialogTitle,
  Dialog,
  Badge,
  FormGroup,
  FormControlLabel,
  Switch,
  Fade,
  Input,
  InputLabel,
  InputAdornment,
  Card,
  CardActions,
  CardContent,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';

import { SwitchProps } from '@mui/material/Switch';

import { createSvgIcon } from '@mui/material/utils';

import { RenderDescription } from '../../Governance/RenderDescription';

import { gistApi, resolveProposalDescription } from '../../utils/grapeTools/github';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

const CustomSearchIcon = createSvgIcon(
    <svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 27 27" fill="none">
    <g clip-path="url(#clip0_39_77)">
    <path d="M26.6844 25.175L18.6237 17.1157C21.9815 12.9992 21.7391 6.91123 17.9055 3.07369C15.9246 1.0886 13.2896 0 10.4853 0C7.68097 0 5.05051 1.0886 3.06965 3.07369C-1.02472 7.1628 -1.02472 13.8179 3.06965 17.907C5.05051 19.8875 7.68554 20.9807 10.4898 20.9807C12.9327 20.9807 15.2476 20.1528 17.114 18.6251L25.1747 26.6844C25.3851 26.8948 25.6596 27 25.9295 27C26.1994 27 26.4785 26.8948 26.6844 26.6844C27.1007 26.2682 27.1007 25.5867 26.6844 25.1704V25.175ZM4.58388 16.393C1.32668 13.1364 1.32668 7.83974 4.58388 4.58767C6.16216 3.00966 8.25739 2.14061 10.4898 2.14061C12.7223 2.14061 14.8175 3.00966 16.3958 4.58767C19.653 7.84432 19.653 13.1409 16.3958 16.393C14.8175 17.971 12.7223 18.8401 10.4898 18.8401C8.25739 18.8401 6.16216 17.971 4.58388 16.393Z" fill="#AEADAD"/>
    <path d="M6.70653 4.67458C6.17128 4.92157 5.9334 5.55735 6.18501 6.09707C6.43204 6.63223 7.06793 6.8655 7.60775 6.6185C7.63977 6.60478 10.9336 5.13197 14.0078 7.94952C14.2136 8.13705 14.4744 8.23311 14.7306 8.23311C15.0188 8.23311 15.307 8.11418 15.522 7.88549C15.92 7.45096 15.8926 6.77402 15.458 6.37151C11.3453 2.60258 6.90324 4.58767 6.71568 4.67458H6.70653Z" fill="#AEADAD"/>
    </g>
    <defs>
    <clipPath id="clip0_39_77">
    <rect width="27" height="27" fill="white"/>
    </clipPath>
    </defs>
    </svg>,
    'Search'
)

import ExplorerView from '../../utils/grapeTools/Explorer';

import { useSnackbar } from 'notistack';

import GovernanceNavigation from '../../Governance/GovernanceNavigation'; 
import GovernancePower from '../../Governance/GovernancePower';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from '../../Governance/CachedStorageHelpers'; 
import { createCastVoteTransaction } from '../../utils/governanceTools/components/instructions/createVote';
import { GovernanceProposalDialog } from '../../Governance/GovernanceProposalDialog';
import moment from 'moment';

import ArticleIcon from '@mui/icons-material/Article';
import GitHubIcon from '@mui/icons-material/GitHub';
import HistoryIcon from '@mui/icons-material/History';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VerifiedIcon from '@mui/icons-material/Verified';
import ModeIcon from '@mui/icons-material/Mode';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import CheckIcon from '@mui/icons-material/Check';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
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
import IconButton from '@mui/material/IconButton';

import '@khmyznikov/pwa-install';

import PropTypes from 'prop-types';
import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI,
    FRICTIONLESS_BG,
    APP_ICON,
    APP_LOGO,
    GIST_LOGO,
} from '../../utils/grapeTools/constants';

import { 
    getAllProposalsFromAllPrograms,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    fetchRealmNameFromRulesWallet,
    getAllTokenOwnerRecordsIndexed
} from '../../Governance/api/queries';
import { getRealm, getTokenOwnerRecord } from '@solana/spl-governance';

import { formatAmount, getFormattedNumberToLocale } from '../../utils/grapeTools/helpers'
import ProgressBar from '../../components/progress-bar/progress-bar';
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

const transformImageUri = (uri) => {
    // Add your image resizing logic here
    // Example: Append the query parameter "w=500" to resize the image to a width of 500px
    const resizedUri = `${uri}?w=500`;
    return resizedUri;
};

const IOSSwitch = styled((props: SwitchProps) => (
    <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
  ))(({ theme }) => ({
    width: 42,
    height: 26,
    padding: 0,
    '& .MuiSwitch-switchBase': {
      padding: 0,
      margin: 2,
      transitionDuration: '300ms',
      '&.Mui-checked': {
        transform: 'translateX(16px)',
        color: '#fff',
        '& + .MuiSwitch-track': {
          backgroundColor: theme.palette.mode === 'dark' ? '#2ECA45' : '#65C466',
          opacity: 1,
          border: 0,
        },
        '&.Mui-disabled + .MuiSwitch-track': {
          opacity: 0.5,
        },
      },
      '&.Mui-focusVisible .MuiSwitch-thumb': {
        color: '#33cf4d',
        border: '6px solid #fff',
      },
      '&.Mui-disabled .MuiSwitch-thumb': {
        color:
          theme.palette.mode === 'light'
            ? theme.palette.grey[100]
            : theme.palette.grey[600],
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: theme.palette.mode === 'light' ? 0.7 : 0.3,
      },
    },
    '& .MuiSwitch-thumb': {
      boxSizing: 'border-box',
      width: 22,
      height: 22,
    },
    '& .MuiSwitch-track': {
      borderRadius: 26 / 2,
      backgroundColor: theme.palette.mode === 'light' ? '#E9E9EA' : '#39393D',
      opacity: 1,
      transition: theme.transitions.create(['background-color'], {
        duration: 500,
      }),
    },
}));

const BlinkingDotContainer = styled("div")({
    width: 12.5,
    height: 12.5,
    borderRadius: "50%",
    backgroundColor: "red",
    animation: `blinking-dot 1s ease-in-out infinite`,
    display: 'inline-block',
});
const BlinkingDot = () => {
    return (
      <BlinkingDotContainer>
        <Fade in={true}>
          <div style={{ width: 5, height: 5, borderRadius: "50%" }} />
        </Fade>
      </BlinkingDotContainer>
    );
  };

type BorderLinearProgressProps = LinearProgressProps & {
    valueYes?: number;
    valueNo?: number;
};

const BorderLinearProgress = styled(LinearProgress)<BorderLinearProgressProps>(({ theme, valueYes, valueNo }) => ({
    marginTop: 6,
    marginBottom: 8,
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: valueNo ? '#AB4D47' : theme.palette.grey[900],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: valueYes ? '#5C9F62' : valueNo ? '#AB4D47' : theme.palette.grey[900],
      width: valueYes ? `${valueYes}%` : '0%',
    },
  }));

const StyledTable = styled(Table)(({ theme }) => ({
    /*
    '& .MuiTableCell-root': {
        borderBottom: '1px solid rgba(255,255,255,0.05)'
    },*/
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

const REALTIME_PROPOSALS_LAST_SEEN_STORAGE_KEY = 'governance-realtime-proposals-last-seen';
const realtimePulse = keyframes`
  0% { transform: translateY(0px); box-shadow: 0 0 0 rgba(0,0,0,0); }
  50% { transform: translateY(-2px); box-shadow: 0 14px 32px rgba(8, 12, 18, 0.26); }
  100% { transform: translateY(0px); box-shadow: 0 0 0 rgba(0,0,0,0); }
`;
const realtimeBadgePulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 111, 97, 0.28); }
  70% { box-shadow: 0 0 0 10px rgba(255, 111, 97, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 111, 97, 0); }
`;
const realtimeRefreshFlash = keyframes`
  0% { box-shadow: 0 0 0 rgba(0,0,0,0), 0 0 0 rgba(88,166,255,0); }
  25% { box-shadow: 0 22px 54px rgba(9,14,21,0.34), 0 0 0 1px rgba(88,166,255,0.18); }
  100% { box-shadow: 0 0 0 rgba(0,0,0,0), 0 0 0 rgba(88,166,255,0); }
`;

function toBase58Safe(value: any): string {
    try {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (value?.toBase58) return value.toBase58();
        return String(value);
    } catch {
        return '';
    }
}

function parseRawVoteWeight(raw: any): bigint {
    try {
        if (raw === null || raw === undefined) return 0n;
        if (typeof raw === 'bigint') return raw;
        if (typeof raw === 'number') return Number.isFinite(raw) ? BigInt(Math.trunc(raw)) : 0n;
        if (typeof raw === 'string') {
            const value = raw.trim();
            if (!value) return 0n;
            if (value.startsWith('0x') || value.startsWith('0X')) return BigInt(value);
            if (/^-?\d+$/.test(value)) return BigInt(value);
            const parsed = Number(value);
            return Number.isFinite(parsed) ? BigInt(Math.trunc(parsed)) : 0n;
        }
        return BigInt(raw?.toString?.() || 0);
    } catch {
        return 0n;
    }
}

function voteWeightToUi(raw: any, decimals = 0): number {
    const value = parseRawVoteWeight(raw);
    const normalizedDecimals = Math.max(0, Number(decimals || 0));
    if (normalizedDecimals === 0) return Number(value);
    const base = 10n ** BigInt(normalizedDecimals);
    const whole = value / base;
    const frac = value % base;
    return Number(whole) + Number(frac) / Math.pow(10, normalizedDecimals);
}

function formatCompactNumber(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0';
    const compact = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 2,
    }).format(numeric);
    return compact.replace(/K/g, 'k').replace(/M/g, 'm').replace(/B/g, 'b').replace(/T/g, 't');
}

function getDraftTimestampMs(raw: any): number {
    const numeric = Number(raw?.toString?.() ?? raw ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return numeric * 1000;
}

function getProposalCardSummary(item: any): string {
    const options = Array.isArray(item?.account?.options) ? item.account.options : [];
    const instructionCount = options.reduce((sum: number, option: any) => {
        const next = Number(option?.instructionsNextIndex ?? 0);
        return sum + (Number.isFinite(next) ? next : 0);
    }, 0);

    if (item?.account?.voteType?.type === 1) {
        return `${options.length} options${instructionCount > 0 ? ` • ${instructionCount} instruction${instructionCount === 1 ? '' : 's'}` : ''}`;
    }

    if (instructionCount > 0) {
        return `${instructionCount} instruction${instructionCount === 1 ? '' : 's'}`;
    }

    return options.length > 2 ? `${options.length} options` : 'No instructions';
}

function formatExactTimestamp(unixValue: any): string {
    const numeric = Number(unixValue?.toString?.() ?? unixValue ?? 0);
    if (!Number.isFinite(numeric) || numeric <= 0) return 'Unknown time';
    return moment.unix(numeric).format('MMM D, YYYY, h:mm:ss a');
}

function formatReadablePercent(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return '0%';
    if (numeric >= 100) return '100%+';
    const maximumFractionDigits = numeric >= 50 ? 0 : numeric >= 10 ? 1 : 2;
    return `${numeric.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits,
    })}%`;
}

function getTurnoutLabel(voteStats: any): string {
    if (voteStats?.turnoutPct === null || voteStats?.turnoutPct === undefined) return 'Turnout unavailable';
    return `${formatReadablePercent(voteStats.turnoutPct)} turnout`;
}

function getTurnoutTooltip(voteStats: any): string {
    if (voteStats?.turnoutPct === null || voteStats?.turnoutPct === undefined) return 'Turnout unavailable';
    const turnoutLabel = getTurnoutLabel(voteStats);
    const participatingVotes = formatCompactNumber(voteStats?.total ?? 0);
    const maxVoteWeight = Number(voteStats?.maxVoteWeight ?? 0);
    const maxVotesLabel = maxVoteWeight > 0 ? formatCompactNumber(maxVoteWeight) : null;
    const thresholdLabel =
        voteStats?.thresholdPct !== null && voteStats?.thresholdPct !== undefined
            ? ` • threshold ${formatReadablePercent(voteStats.thresholdPct)}`
            : '';

    return `${turnoutLabel} of voting power • ${participatingVotes} votes participating${maxVotesLabel ? ` / ${maxVotesLabel} max` : ''}${thresholdLabel}`;
}

function preserveChipTone(config: {
    background?: string;
    bgcolor?: string;
    color?: string;
    border?: string;
    borderColor?: string;
}) {
    const stableState: Record<string, string> = {};
    if (config.background) stableState.background = config.background;
    if (config.bgcolor) stableState.backgroundColor = config.bgcolor;
    if (config.color) stableState.color = config.color;
    if (config.border) stableState.border = config.border;
    if (config.borderColor) stableState.borderColor = config.borderColor;

    return {
        '&:hover': stableState,
        '&:active': stableState,
        '&.Mui-focusVisible': stableState,
        '& .MuiChip-label': {
            color: 'inherit',
        },
        '& .MuiChip-icon': {
            color: 'inherit',
        },
    };
}

function getVoteThresholdPercent(voteThreshold: any): number | null {
    if (voteThreshold === null || voteThreshold === undefined) return null;
    if (typeof voteThreshold === 'number') return Number.isFinite(voteThreshold) ? voteThreshold : null;
    if (typeof voteThreshold === 'string') {
        const parsed = Number(voteThreshold);
        return Number.isFinite(parsed) ? parsed : null;
    }
    const candidates = [
        voteThreshold?.value,
        voteThreshold?.percentage,
        voteThreshold?.yesVotePercentage,
        voteThreshold?.votePercentage,
    ];
    for (const candidate of candidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function getProposalVoteStats(item: any) {
    const yesRaw = Number(item?.account?.options?.[0]?.voteWeight ?? item?.account?.yesVoteCount ?? 0);
    const noRaw = Number(item?.account?.denyVoteWeight ?? item?.account?.noVoteCount ?? 0);
    const yes = Number.isFinite(yesRaw) ? yesRaw : 0;
    const no = Number.isFinite(noRaw) ? noRaw : 0;
    const total = Math.max(0, yes + no);
    const yesPct = total > 0 ? (yes / total) * 100 : 0;
    const noPct = total > 0 ? (no / total) * 100 : 0;
    const maxVoteWeightRaw = Number(item?.account?.maxVoteWeight ?? 0);
    const maxVoteWeight = Number.isFinite(maxVoteWeightRaw) ? maxVoteWeightRaw : 0;
    const turnoutPct = maxVoteWeight > 0 ? (total / maxVoteWeight) * 100 : null;
    const thresholdPct = getVoteThresholdPercent(item?.account?.voteThreshold);
    const thresholdProgressPct =
        thresholdPct !== null && turnoutPct !== null && thresholdPct > 0
            ? Math.min(100, (turnoutPct / thresholdPct) * 100)
            : null;

    return {
        yes,
        no,
        total,
        yesPct,
        noPct,
        maxVoteWeight,
        turnoutPct,
        thresholdPct,
        thresholdProgressPct,
    };
}

function getProposalDecisionSignal(item: any, proposalTypeLabel: 'Community' | 'Council' | ''): string | null {
    const voteStats = getProposalVoteStats(item);
    const instructionCount = Array.isArray(item?.account?.options)
        ? item.account.options.reduce((sum: number, option: any) => sum + Math.max(0, Number(option?.instructionsNextIndex ?? 0)), 0)
        : 0;
    const isPoll = item?.account?.voteType?.type === 1;

    if (proposalTypeLabel === 'Council') return 'Council vote';
    if (Number(item?.account?.state) === 0) {
        if (instructionCount <= 0) return isPoll ? 'Poll only' : '0 instructions';
        return `${instructionCount} executable ${instructionCount === 1 ? 'instruction' : 'instructions'}`;
    }
    if (voteStats.turnoutPct !== null) {
        if (voteStats.turnoutPct >= 20) return 'High participation';
        if (voteStats.turnoutPct <= 5) return 'Low turnout';
        return 'Building turnout';
    }
    return instructionCount > 0 ? `${instructionCount} instructions queued` : null;
}

function getProposalIdentityLabel(governanceName?: string | null): string {
    const text = String(governanceName || 'DAO').trim();
    if (!text) return 'DA';
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function getProposalStateTone(state: number) {
    if (state === 2) {
        return {
            accent: '#58a6ff',
            soft: 'rgba(88,166,255,0.15)',
            border: 'rgba(88,166,255,0.28)',
            text: '#d7ebff',
            glow: '0 18px 44px rgba(26, 76, 126, 0.18)',
        };
    }
    if (state === 3 || state === 5) {
        return {
            accent: '#5ec98f',
            soft: 'rgba(94,201,143,0.15)',
            border: 'rgba(94,201,143,0.24)',
            text: '#d8f6e5',
            glow: '0 18px 44px rgba(22, 88, 55, 0.18)',
        };
    }
    if (state === 0) {
        return {
            accent: '#f2bf6d',
            soft: 'rgba(242,191,109,0.15)',
            border: 'rgba(242,191,109,0.24)',
            text: '#fff1d5',
            glow: '0 18px 44px rgba(93, 64, 21, 0.16)',
        };
    }
    return {
        accent: '#f0746a',
        soft: 'rgba(240,116,106,0.14)',
        border: 'rgba(240,116,106,0.22)',
        text: '#ffe0dc',
        glow: '0 18px 44px rgba(99, 33, 28, 0.18)',
    };
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
  
    const handleFirstPageButtonClick = (event:any) => {
        onPageChange(event, 0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBackButtonClick = (event:any) => {
        onPageChange(event, page - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  
    const handleNextButtonClick = (event:any) => {
        onPageChange(event, page + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  
    const handleLastPageButtonClick = (event:any) => {
        onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const proposals = props.proposals;
    const { publicKey } = useWallet();
    const [filteredGovernance, setFilteredGovernance] = React.useState(null);
    //const [filterState, setFilterState] = React.useState(true);
    const filterState = props.filterState;
    const setFilterState = props.setFilterState;
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    const governanceLookup = props.governanceLookup;
    const updatedProposalKeys = Array.isArray(props?.updatedProposalKeys) ? props.updatedProposalKeys : [];
    const [lastSeenTimestamp] = React.useState<number>(() => {
        if (typeof window === 'undefined') return 0;
        const stored = window.localStorage.getItem(REALTIME_PROPOSALS_LAST_SEEN_STORAGE_KEY);
        const parsed = stored ? Number(stored) : 0;
        return Number.isFinite(parsed) ? parsed : 0;
    });
    
    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - proposals.length) : 0;
    
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
        if (!Array.isArray(proposals) || proposals.length === 0) return;
        if (typeof window === 'undefined') return;
        const latestDraftTimestamp = proposals.reduce((max: number, proposal: any) => {
            const ts = getDraftTimestampMs(proposal?.account?.draftAt);
            return ts > max ? ts : max;
        }, 0);
        if (latestDraftTimestamp > 0) {
            window.localStorage.setItem(REALTIME_PROPOSALS_LAST_SEEN_STORAGE_KEY, String(latestDraftTimestamp));
        }
    }, [proposals]);
    
    function GetProposalStatus(props: any){
        const thisitem = props.item;
        const stateTone = getProposalStateTone(Number(thisitem.account?.state));
        
        React.useEffect(() => { 
            if (thisitem.account?.state === 2){ // if voting state
                //if (!thisGovernance){
                    //console.log("get gov props")
                    //getGovernanceProps()
                //}
            }
        }, [thisitem]);

        // calculate time left
        // /60/60/24 to get days
        
        return (
            <>
                   
                <Chip variant="outlined" 
                    
                    sx={{
                        borderRadius:'999px',
                        p:'4px 12px',
                        color: stateTone.text,
                        borderColor: stateTone.border,
                        background: stateTone.soft,
                        backdropFilter: 'blur(10px)',
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px ${stateTone.soft}`,
                        ...preserveChipTone({
                            background: stateTone.soft,
                            color: stateTone.text,
                            borderColor: stateTone.border,
                        }),
                    }}
                    avatar={
                        <>
                        {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                            <>
                                { (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                    <CheckIcon />
                                :
                                    <CancelOutlinedIcon />
                                }
                            </>
                        :
                            <>
                            { thisitem.account?.state === 2 ?
                                <AccessTimeIcon />
                            : 
                                <>
                                    { (thisitem.account?.state === 0) ?
                                        <ModeIcon />
                                    :
                                        <CancelOutlinedIcon />
                                    }
                                </>
                            }
                            </>
                        }
                        </>

                    }
                    label={
                        <>
                            <Typography variant="body2">
                                {GOVERNANCE_STATE[thisitem.account?.state]}
                            </Typography>
                        </>
                    }/>
            </>
        )
    }
    
    const conditionalTextDecoration = (item) => {
        if (item.account?.state === 6) {
          return "line-through";
        } else {
          return "";
        }
      };

    function isValidURL(urlString:string) {
        try {
          const url = new URL(urlString);
          return true;
        } catch (error) {
          return false;
        }
    }

    async function fetchIrysText(url: string) {
        const res = await fetch(url, {
            headers: { Accept: "text/html,text/plain,*/*" },
        });
        if (!res.ok) throw new Error(`Irys fetch failed (${res.status})`);
        return await res.text();
    }
    
    function GetGovernanceFromRulesView(props:any){
        const rulesWallet = props.rulesWallet;
        const proposal = props.proposal;
        const name = props?.name;
        const description = props?.description;
        const [descriptionMarkdown, setDescriptionMarkdown] = React.useState(null);
        const state = props?.state;
        const draftAt = props.draftAt;
        const item = props?.item;
        const [gist, setGist] = React.useState(null);
        const [gDocs, setGoogleDocs] = React.useState(null);
        const [gitBook, setGitBook] = React.useState(null);
        const [irys, setIrys] = React.useState<string | null>(null);
        const [irysUrl, setIrysUrl] = React.useState<string | null>(null);
        const [irysLoading, setIrysLoading] = React.useState(false);
        const [irysHtml, setIrysHtml] = React.useState<string | null>(null);
        const [irysError, setIrysError] = React.useState<string | null>(null);
        

        const [governanceInfo, setGovernanceInfo] = React.useState(null);
        const [proposalAuthor, setProposalAuthor] = React.useState('');
        const [proposalTypeLabel, setProposalTypeLabel] = React.useState<'Community' | 'Council' | ''>('');
        const [authorVotingPowerLabel, setAuthorVotingPowerLabel] = React.useState('');
        const [proposalMetaLoading, setProposalMetaLoading] = React.useState(false);
        const lastSeenTimestamp = props?.lastSeenTimestamp || 0;
        const wasUpdatedRecently = props?.wasUpdatedRecently === true;
        const isNewProposal = lastSeenTimestamp > 0 && getDraftTimestampMs(draftAt) > lastSeenTimestamp;
        const proposalSummary = React.useMemo(() => getProposalCardSummary(item), [item]);
        const stateTone = React.useMemo(() => getProposalStateTone(Number(state)), [state]);
        const proposalVoteStats = React.useMemo(() => getProposalVoteStats(item), [item]);
        const draftTimestampMs = React.useMemo(() => getDraftTimestampMs(draftAt), [draftAt]);
        const exactDraftTimestamp = React.useMemo(() => formatExactTimestamp(draftAt), [draftAt]);
        const proposalDecisionSignal = React.useMemo(
            () => getProposalDecisionSignal(item, proposalTypeLabel),
            [item, proposalTypeLabel]
        );
        const proposalTypeIcon = proposalTypeLabel === 'Council' ? <AssuredWorkloadIcon fontSize="inherit" /> : <EditNoteIcon fontSize="inherit" />;
        const governanceIdentity = getProposalIdentityLabel(governanceInfo?.governanceName);

        React.useEffect(() => {
        const loadGovernanceInfo = async () => {
            if (rulesWallet) {
                const result = await fetchRealmNameFromRulesWallet(rulesWallet, item.owner);
                if (result) {
                    const { name, realm } = result;
                    setGovernanceInfo({
                        governanceName: name,
                        governanceAddress: realm,
                    });
                    console.log("Found governance name:", name);
                    console.log("Proposal:", item?.owner?.toBase58?.() ?? item?.owner);
                }
            }
        };

        loadGovernanceInfo();
    }, [rulesWallet]);

        React.useEffect(() => {
            let cancelled = false;

            const loadProposalMeta = async () => {
                const tokenOwnerRecordPk = item?.account?.tokenOwnerRecord;
                const realmPk = item?.account?.realm || governanceInfo?.governanceAddress;
                const governingMintPk = item?.account?.governingTokenMint;
                if (!tokenOwnerRecordPk || !realmPk || !governingMintPk) return;

                setProposalMetaLoading(true);
                try {
                    const realmPublicKey = new PublicKey(toBase58Safe(realmPk));
                    const indexedOwnerRecords = await getAllTokenOwnerRecordsIndexed(
                        realmPublicKey.toBase58(),
                        item?.owner?.toBase58?.() || item?.owner
                    ).catch(() => []);

                    let tokenOwnerRecord = Array.isArray(indexedOwnerRecords)
                        ? indexedOwnerRecords.find(
                            (record: any) =>
                                toBase58Safe(record?.pubkey) === toBase58Safe(tokenOwnerRecordPk)
                        ) || null
                        : null;

                    const realm = await getRealm(RPC_CONNECTION as any, realmPublicKey);

                    if (!tokenOwnerRecord) {
                        tokenOwnerRecord = await getTokenOwnerRecord(
                            RPC_CONNECTION as any,
                            new PublicKey(toBase58Safe(tokenOwnerRecordPk))
                        );
                    }

                    if (cancelled) return;

                    const author = toBase58Safe(tokenOwnerRecord?.account?.governingTokenOwner);
                    const governingMint = toBase58Safe(governingMintPk);
                    const councilMint = toBase58Safe(realm?.account?.config?.councilMint);
                    const isCouncilProposal = Boolean(councilMint && governingMint && councilMint === governingMint);
                    const proposalType: 'Community' | 'Council' = isCouncilProposal ? 'Council' : 'Community';
                    let decimals = 0;

                    if (!isCouncilProposal) {
                        try {
                            const mintInfo = await getMint(RPC_CONNECTION as any, new PublicKey(governingMint));
                            decimals = mintInfo?.decimals || 0;
                        } catch {
                            decimals = 0;
                        }
                    }

                    const votingPower = voteWeightToUi(tokenOwnerRecord?.account?.governingTokenDepositAmount || 0, decimals);
                    const powerLabel =
                        proposalType === 'Council'
                            ? `${formatCompactNumber(votingPower)} council`
                            : `${formatCompactNumber(votingPower)} votes`;

                    setProposalAuthor(author);
                    setProposalTypeLabel(proposalType);
                    setAuthorVotingPowerLabel(powerLabel);
                } catch (error) {
                    if (!cancelled) {
                        console.log('Failed to load realtime proposal metadata', error);
                    }
                } finally {
                    if (!cancelled) {
                        setProposalMetaLoading(false);
                    }
                }
            };

            void loadProposalMeta();

            return () => {
                cancelled = true;
            };
        }, [governanceInfo, item]);

        const shortenWordRegex: RegExp = /^(.{6})(?:\.(.{6}))?$/;

        const shortenWord: (word: string) => string = (word: string) => {
        if (word.length > 40) {
            return word.substring(0,6)+"..."+word.substring(word.length-8,word.length);
        } else {
            return word;
        }
        };

        const shortenString: (string: string) => string = (string: string) => {
        return string.split(' ').map(shortenWord).join(' ');
        };

        
        function replaceUrls(paragraphText:string) {
            //console.log("checking: "+paragraphText);
            const regex = /(((https?|ftp):\/\/)(?:[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%"_<>.~#?&//=]*))?)/g;
            const matches = paragraphText.matchAll(regex);
            let replacedText = paragraphText;

            for (const [, fullUrl] of matches) {
                const domain = fullUrl.split('/')[2];
                replacedText = replacedText.replace(fullUrl, `[LINK] - ${domain}`);
            }
            
            //const pattern = /\b.{40,}\b/g;
            //console.log("checking: "+replacedText);
            const shortenedText = shortenString(replacedText);//replacedText.replace(/\b\w{40,}\b/g, (match) => `${match.slice(0, 40)}...`);
            //replacedText.replace(/\b\w{40,}\b/g, (match) => `${match.slice(0, 40)}...`);

            return shortenedText;
        }

        const resolveDescription = async(descriptionStr: string) => {

            try{
                const cleanString = descriptionStr.replace(/(\s+)(https?:\/\/[a-zA-Z0-9\.\/]+)/g, '$2');
                if (cleanString && cleanString.length > 0 && cleanString.includes("http")) {
                    let url: URL;
                    try {
                        url = new URL(cleanString);
                    } catch (e) {
                        // if cleanString is somehow not a valid absolute URL, bail safely
                        console.warn("Invalid URL:", cleanString, e);
                        return;
                    }
    
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
    
                        const rpd = await resolveProposalDescription(cleanString);
    
                        const imageUrlRegex = /https?:\/\/[^\s"]+\.(?:jpg|jpeg|gif|png)/gi;
                        const targetUrl =
                        "https://shdw-drive.genesysgo.net/4HMWqo1YLwnxuVbh4c8KXMcZvQj4aw7oxnNmWVm4RmVV/Screenshot_2023-05-28_at_10.43.34.png";
    
                        const stringWithPreviews = rpd.replace(imageUrlRegex, (match: string) => {
                        if (match === targetUrl) return GIST_LOGO;
                        return `![Image X](${match})`;
                        });
    
                        setDescriptionMarkdown(stringWithPreviews);
                    } else if (hostname === "docs.google.com") {
                        setGoogleDocs(cleanString); // store the URL (or a flag if you prefer)
                    } else if (hostname.includes("gitbook.io")) {
                        setGitBook(cleanString); // store the URL (or a flag)
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
            } catch(e){
                console.log("ERR: "+e)
            }
        }

        React.useEffect(() => {
            if (description){
                resolveDescription(description)
            }
        }, []);


        const isLocalhost =
            typeof window !== 'undefined' &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        return (
            <>
                
                    <>
                        
                            <Button 
                                component={governanceInfo && governanceInfo.governanceName && Link}
                                to={(governanceInfo && governanceInfo.governanceName) && `/proposal/${governanceInfo.governanceAddress}/${proposal}`}
                                /*
                                href={(governanceInfo && governanceInfo.governanceName) && `https://governance.so/proposal/${governanceInfo.governanceAddress}/${proposal}`}
                                target='_blank'
                                */
                                color='inherit'
                                sx={{
                                    borderRadius:'30px',
                                    p:0.75,
                                    m:0,
                                    textTransform:'none',
                                    width:'100%',
                                    textDecoration: (state === 6) ? 'line-through' : 'none',
                                    alignItems: 'stretch',
                                    transition: 'transform 180ms ease, filter 180ms ease',
                                    '&:hover': {
                                        backgroundColor: 'transparent',
                                        transform: 'translateY(-2px)',
                                        filter: 'brightness(1.04)',
                                    }
                                }}
                                //disabled={!governanceInfo}
                            >
                                <Box
                                    sx={{
                                        position: 'relative',
                                        overflow: 'hidden',
                                        borderRadius:'24px',
                                        background: `linear-gradient(180deg, rgba(23,29,38,0.92) 0%, rgba(16,20,28,0.94) 100%)`,
                                        border: `1px solid ${stateTone.border}`,
                                        boxShadow: stateTone.glow,
                                        p:2,
                                        width:'100%',
                                        backdropFilter: 'blur(18px)',
                                        animation: isNewProposal || wasUpdatedRecently ? `${realtimePulse} 2.8s ease-in-out 1` : 'none',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 16,
                                            bottom: 16,
                                            left: 0,
                                            width: 5,
                                            borderRadius: '0 999px 999px 0',
                                            background: `linear-gradient(180deg, ${stateTone.accent} 0%, rgba(255,255,255,0.22) 100%)`,
                                            boxShadow: `0 0 22px ${stateTone.soft}`,
                                        },
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(140deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 42%)',
                                            pointerEvents: 'none',
                                        },
                                        ...(wasUpdatedRecently ? {
                                            boxShadow: `${stateTone.glow}, 0 0 0 1px rgba(88,166,255,0.22)`,
                                            animation: `${realtimeRefreshFlash} 2.2s ease-out 1`,
                                        } : {})
                                    }}
                                >
                                    <Grid container>
                                        <Grid item xs={12} sx={{

                                        }}>
                                            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.95, pl:1.25, pr:1 }}>
                                                <Box
                                                    sx={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: '10px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: `linear-gradient(180deg, ${stateTone.soft} 0%, rgba(255,255,255,0.05) 100%)`,
                                                        border: `1px solid ${stateTone.border}`,
                                                        color: stateTone.text,
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        letterSpacing: '0.08em',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {governanceIdentity}
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography
                                                        variant="overline"
                                                        sx={{
                                                            color:'rgba(201, 212, 226, 0.72)',
                                                            textAlign:'left',
                                                            display: 'block',
                                                            letterSpacing: '0.14em',
                                                            fontSize: '0.67rem',
                                                            lineHeight: 1.2,
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        {(governanceInfo && governanceInfo.governanceName) ?
                                                            governanceInfo.governanceName
                                                            :
                                                            `DNV Proposal ${shortenString(item.pubkey.toBase58())}`
                                                        }
                                                    </Typography>
                                                </Box>
                                            </Box>

                                            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.15, mt: 0.2, pl: 1.25, pr:1 }}>
                                                {proposalTypeLabel && (
                                                    <Chip
                                                        size="small"
                                                        icon={proposalTypeIcon}
                                                        label={`${proposalTypeLabel} Proposal`}
                                                        sx={{
                                                            height: 22,
                                                            borderRadius: '999px',
                                                            bgcolor: proposalTypeLabel === 'Council' ? 'rgba(255,179,71,0.12)' : 'rgba(88,166,255,0.12)',
                                                            color: proposalTypeLabel === 'Council' ? '#ffd18a' : '#9ac7ff',
                                                            border: `1px solid ${proposalTypeLabel === 'Council' ? 'rgba(255,209,138,0.18)' : 'rgba(154,199,255,0.18)'}`,
                                                            ...preserveChipTone({
                                                                bgcolor: proposalTypeLabel === 'Council' ? 'rgba(255,179,71,0.12)' : 'rgba(88,166,255,0.12)',
                                                                color: proposalTypeLabel === 'Council' ? '#ffd18a' : '#9ac7ff',
                                                                border: `1px solid ${proposalTypeLabel === 'Council' ? 'rgba(255,209,138,0.18)' : 'rgba(154,199,255,0.18)'}`,
                                                            }),
                                                            '& .MuiChip-icon': {
                                                                color: 'inherit',
                                                                fontSize: '0.9rem',
                                                            },
                                                        }}
                                                    />
                                                )}
                                                <Chip
                                                    size="small"
                                                    label={
                                                        proposalAuthor
                                                            ? `By ${shortenString(proposalAuthor)}${authorVotingPowerLabel ? ` with ${authorVotingPowerLabel}` : ''}`
                                                            : `By ${proposalMetaLoading ? 'resolving...' : 'unavailable'}`
                                                    }
                                                    sx={{
                                                        height: 22,
                                                        borderRadius: '999px',
                                                        bgcolor: 'rgba(255,255,255,0.04)',
                                                        color: 'rgba(235,239,244,0.84)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        ...preserveChipTone({
                                                            bgcolor: 'rgba(255,255,255,0.04)',
                                                            color: 'rgba(235,239,244,0.84)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                        }),
                                                    }}
                                                />
                                                <Tooltip title={exactDraftTimestamp}>
                                                    <Chip
                                                        size="small"
                                                        icon={(state === 0 || state === 2) ?
                                                            <HourglassTopIcon fontSize='small'/>
                                                            :
                                                            <HourglassBottomIcon fontSize='small'/>
                                                        }
                                                        label={draftTimestampMs > 0 ? moment(draftTimestampMs).fromNow() : 'Unknown time'}
                                                        sx={{
                                                            height: 22,
                                                            borderRadius:'999px',
                                                            color:'rgba(230,236,243,0.8)',
                                                            fontSize:'11px',
                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                            background:'rgba(255,255,255,0.05)',
                                                            ...preserveChipTone({
                                                                background: 'rgba(255,255,255,0.05)',
                                                                color: 'rgba(230,236,243,0.8)',
                                                                border: '1px solid rgba(255,255,255,0.08)',
                                                            }),
                                                        }}
                                                    />
                                                </Tooltip>
                                                {proposalDecisionSignal && (
                                                    <Chip
                                                        size="small"
                                                        label={proposalDecisionSignal}
                                                        sx={{
                                                            height: 22,
                                                            borderRadius: '999px',
                                                            bgcolor: 'rgba(255,255,255,0.035)',
                                                            color: 'rgba(221,228,236,0.82)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            ...preserveChipTone({
                                                                bgcolor: 'rgba(255,255,255,0.035)',
                                                                color: 'rgba(221,228,236,0.82)',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                            }),
                                                        }}
                                                    />
                                                )}
                                                {isNewProposal && (
                                                    <Chip
                                                        size="small"
                                                        label="New"
                                                        color="error"
                                                        sx={{
                                                            height: 22,
                                                            borderRadius: '999px',
                                                            animation: `${realtimeBadgePulse} 2.2s ease-out infinite`,
                                                            ...preserveChipTone({
                                                                bgcolor: '#d32f2f',
                                                                color: '#fff',
                                                            }),
                                                        }}
                                                    />
                                                )}
                                                <Chip
                                                    size="small"
                                                    label={proposalSummary}
                                                    variant="outlined"
                                                    sx={{
                                                        height: 22,
                                                        borderRadius: '999px',
                                                        borderColor: 'rgba(255,255,255,0.1)',
                                                        color: '#a7b0bb',
                                                        background: 'rgba(255,255,255,0.025)',
                                                        ...preserveChipTone({
                                                            background: 'rgba(255,255,255,0.025)',
                                                            color: '#a7b0bb',
                                                            borderColor: 'rgba(255,255,255,0.1)',
                                                        }),
                                                    }}
                                                />
                                            </Box>
                                            
                                            <Grid container>
                                                <Grid item sm={8} xs={12}
                                                    sx={{
                                                        textAlign:'left'
                                                    }}
                                                >
                                                    <Typography 
                                                        variant="h6"
                                                        color={stateTone.text} 
                                                        //color="white"
                                                        sx={{
                                                            textDecoration: (state === 6) ? 'line-through' : 'none',
                                                            pl: 1.25,
                                                            pr: 1,
                                                            mb: 1,
                                                            fontWeight: 700,
                                                            lineHeight: 1.08,
                                                            letterSpacing: '-0.02em',
                                                        }}
                                                    >
                                                        {shortenString(name)}
                                                    </Typography>

                                                    <Box
                                                        sx={{
                                                            display: { xs: 'flex', sm: 'none' },
                                                            flexWrap: 'wrap',
                                                            alignItems: 'center',
                                                            gap: 0.75,
                                                            px: 1.25,
                                                            pb: 1,
                                                        }}
                                                    >
                                                        <GetProposalStatus item={item} />
                                                        {proposalVoteStats.total > 0 && (
                                                            <Chip
                                                                size="small"
                                                                label={`${proposalVoteStats.yesPct.toFixed(0)} / ${proposalVoteStats.noPct.toFixed(0)}`}
                                                                sx={{
                                                                    height: 22,
                                                                    borderRadius: '999px',
                                                                    color: 'rgba(235,239,244,0.86)',
                                                                    background: 'rgba(255,255,255,0.05)',
                                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                                    ...preserveChipTone({
                                                                        background: 'rgba(255,255,255,0.05)',
                                                                        color: 'rgba(235,239,244,0.86)',
                                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                                    }),
                                                                }}
                                                            />
                                                        )}
                                                        {proposalVoteStats.turnoutPct !== null && (
                                                            <Tooltip title={getTurnoutTooltip(proposalVoteStats)}>
                                                                <Chip
                                                                    size="small"
                                                                    label={getTurnoutLabel(proposalVoteStats)}
                                                                    sx={{
                                                                        height: 22,
                                                                        borderRadius: '999px',
                                                                        color: 'rgba(208,216,226,0.82)',
                                                                        background: 'rgba(255,255,255,0.04)',
                                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                                        ...preserveChipTone({
                                                                            background: 'rgba(255,255,255,0.04)',
                                                                            color: 'rgba(208,216,226,0.82)',
                                                                            border: '1px solid rgba(255,255,255,0.08)',
                                                                        }),
                                                                    }}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                    </Box>

                                                    <Grid
                                                        item
                                                        xs={12}
                                                        sx={{
                                                            mb: 1,
                                                            minWidth: 0,
                                                            width: '100%',
                                                            overflow: 'hidden',
                                                            '& img, & video, & canvas, & svg': {
                                                                maxWidth: '100%',
                                                                height: 'auto',
                                                            },
                                                            '& iframe': {
                                                                maxWidth: '100%',
                                                            },
                                                            '& pre, & code': {
                                                                whiteSpace: 'pre-wrap',
                                                                wordBreak: 'break-word',
                                                            },
                                                            '& table': {
                                                                display: 'block',
                                                                width: '100%',
                                                                overflowX: 'auto',
                                                            },
                                                        }}
                                                        >
                                                        {irysUrl ? (
                                          <Box
                                                sx={{
                                                    alignItems: "left",
                                                    textAlign: "left",
                                                    width: '100%',
                                                    minWidth: 0,
                                                    overflow: 'hidden',
                                                    '& *': {
                                                        maxWidth: '100%',
                                                    },
                                                    '& img, & video, & iframe': {
                                                        maxWidth: '100%',
                                                        height: 'auto',
                                                    },
                                                    '& table': {
                                                        display: 'block',
                                                        width: '100%',
                                                        overflowX: 'auto',
                                                    },
                                                    '& pre': {
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-word',
                                                        overflowX: 'auto',
                                                    },
                                                    '& a': {
                                                        overflowWrap: 'anywhere',
                                                    },
                                                    '& p, & div, & span, & li, & h1, & h2, & h3, & h4, & h5, & h6': {
                                                        overflowWrap: 'anywhere',
                                                        wordBreak: 'break-word',
                                                    },
                                                }}
                                            >
                                                <div
                                                style={{
                                                    border: "solid",
                                                    borderRadius: 15,
                                                    borderColor: "rgba(255,255,255,0.05)",
                                                    padding: 12,
                                                    maxWidth: "100%",
                                                    overflow: "hidden",
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
                                                        lineHeight: 1.6,
                                                        wordBreak: "break-word",
                                                        overflowWrap: "anywhere",
                                                        maxWidth: "100%",
                                                        width: "100%",
                                                        overflowX: "hidden",
                                                    }}
                                                    />
                                                )}
                                                </div>

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
                                        <Box sx={{ alignItems: "left", textAlign: "left", width:'100%', minWidth:0, overflow:'hidden' }}>
                                        <div
                                            style={{
                                            border: "solid",
                                            borderRadius: 15,
                                            borderColor: "rgba(255,255,255,0.05)",
                                            padding: 4,
                                            maxWidth: "100%",
                                            overflow: "hidden",
                                            }}
                                        >
                                            <Typography variant="body2">
                                            <ErrorBoundary>
                                                {window.location.hostname !== "localhost" ? (
                                                <ReactMarkdown
                                                    remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkImages]}
                                                    children={description}
                                                    components={{
                                                    img: ({ node, ...props }) => (
                                                        <img {...props} style={{ width: "100%", height: "auto", maxWidth: "100%" }} />
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
                                                            style={{ color: "#1976d2", textDecoration: "underline", overflowWrap: "anywhere", wordBreak: "break-word" }}
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
                                        </div>

                                        <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                            <Button
                                            color="inherit"
                                            target="_blank"
                                            href={description}
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
                                                src={description}
                                                width="100%"
                                                height="750px"
                                                style={{ border: "none" }}
                                                />
                                            </Grid>

                                            <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                                <Button
                                                color="inherit"
                                                target="_blank"
                                                href={description}
                                                sx={{ borderRadius: "17px" }}
                                                >
                                                <ArticleIcon sx={{ mr: 1 }} /> Google Docs
                                                </Button>
                                            </Box>
                                            </Box>
                                        ) : (
                                            <>
                                            {description ? (
                                                <>
                                                <Typography
                                                    variant="body1"
                                                    color="gray"
                                                    sx={{ display: "flex", alignItems: "center" }}
                                                >
                                                    <RenderDescription
                                                    title={name}
                                                    description={description}
                                                    fallback={proposal}
                                                    />
                                                </Typography>

                                                {gitBook && (
                                                    <Box sx={{ alignItems: "right", textAlign: "right", p: 1 }}>
                                                    <Button
                                                        color="inherit"
                                                        target="_blank"
                                                        href={description}
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
                                                    title={name}
                                                    description={description}
                                                    fallback={proposal}
                                                />
                                                </Typography>
                                            )}
                                            </>
                                        )}
                                        </>
                                    )}
                                                    </Grid>
                                                </Grid>
                                                
                                                <Divider orientation="vertical" flexItem
                                                    sx={{
                                                    borderColor: stateTone.border,
                                                    opacity: 0.8,
                                                    // Responsive visibility for mobile devices
                                                    '@media (max-width: 600px)': {
                                                        display: 'none',
                                                    },
                                                    }}
                                                >
                                                    
                                                </Divider>
                                                
                                                <Grid item xs
                                                    sx={{textAlign:'right', pl: { xs: 1.25, sm: 1.5 }, display: { xs: 'none', sm: 'block' }}}
                                                >
                                                    <Grid sx={{mb:2}}>
                                                        <GetProposalStatus item={item} />
                                                    </Grid>
                                                    
                                                    {state === 2 ?
                                                        <>
                                                            <Grid container sx={{ml:1, alignItems:'center', mb: 0.35}}>
                                                                <Grid item xs alignContent={'left'} justifyContent={'left'}>
                                                                    <Typography variant="body2" sx={{color:'#dbf6e8',mr:1,textAlign:'left', fontWeight:700}}>
                                                                        For {proposalVoteStats.yesPct.toFixed(1)}%
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item xs alignContent={'right'} justifyContent={'right'}>
                                                                    <Typography variant="body2" sx={{color:'#ffd9d5',mr:1, fontWeight:700}}>
                                                                        Against {proposalVoteStats.noPct.toFixed(1)}%
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid xs={12}>
                                                                    
                                                                    <BorderLinearProgress variant="determinate" 
                                                                        value={100}
                                                                        valueYes={
                                                                            +(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)
                                                                        }
                                                                        valueNo={
                                                                            +(((Number(item.account?.denyVoteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)
                                                                        } 
                                                                    />
                                                                </Grid>
                                                                {proposalVoteStats.turnoutPct !== null && (
                                                                    <Grid xs={12}>
                                                                        <Tooltip title={getTurnoutTooltip(proposalVoteStats)}>
                                                                            <Typography variant="caption" sx={{ display:'block', mt:0.55, color:'rgba(210,218,228,0.78)', textAlign:'left' }}>
                                                                                {getTurnoutLabel(proposalVoteStats)}
                                                                                {proposalVoteStats.thresholdPct !== null ? ` • threshold ${formatReadablePercent(proposalVoteStats.thresholdPct)}` : ''}
                                                                            </Typography>
                                                                        </Tooltip>
                                                                    </Grid>
                                                                )}
                                                            </Grid>  
                                                        </>
                                                    :
                                                        <Grid>

                                                            <Grid container>
                                                                <Grid item xs alignContent={'right'} justifyContent={'right'}>
                                                                    <Typography variant="body2" sx={{color:'#dbf6e8',mr:1, fontWeight:700}}>
                                                                        For
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item>
                                                                    <Typography variant="body2" sx={{color:"#5ec98f"}}>
                                                                        {proposalVoteStats.yesPct.toFixed(1)}%
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>

                                                            <Grid container sx={{mb:1}}>
                                                                <Grid item xs alignContent={'right'} justifyContent={'right'}>
                                                                    <Typography variant="body2" sx={{color:'#ffd9d5',mr:1, fontWeight:700}}>
                                                                        Against
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item>
                                                                    <Typography variant="body2" sx={{color:"#AB4D47"}}>
                                                                        {proposalVoteStats.noPct.toFixed(1)}%
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>

                                                            {proposalVoteStats.turnoutPct !== null && (
                                                                <Tooltip title={getTurnoutTooltip(proposalVoteStats)}>
                                                                    <Typography variant="caption" sx={{ display:'block', mb:1, color:'rgba(210,218,228,0.78)' }}>
                                                                        {getTurnoutLabel(proposalVoteStats)}
                                                                        {proposalVoteStats.thresholdPct !== null ? ` • threshold ${formatReadablePercent(proposalVoteStats.thresholdPct)}` : ''}
                                                                    </Typography>
                                                                </Tooltip>
                                                            )}

                                                        </Grid>
                                                    }

                                                    {governanceInfo &&
                                                        <Grid

                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'flex-end',
                                                                alignItems: 'flex-end',
                                                                mt: 2
                                                            }}
                                                        >
                                                            <Button 
                                                                variant="text" 
                                                                //color="white"
                                                                startIcon={<ZoomOutMapIcon 
                                                                    fontSize='small'
                                                                    sx={{
                                                                        color:"#ddd"}}
                                                                    />}
                                                                sx={{
                                                                    borderRadius:'999px',
                                                                    px: 1.2,
                                                                    py: 0.5,
                                                                    background: 'rgba(255,255,255,0.04)',
                                                                    border: '1px solid rgba(255,255,255,0.08)',
                                                                    '&:hover': {
                                                                        background: 'rgba(255,255,255,0.08)',
                                                                    }
                                                                }}
                                                                >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{color:'#ddd'}}
                                                                >
                                                                Expand
                                                                </Typography>
                                                            </Button>
                                                        </Grid>
                                                    }
                                                </Grid>
                                            </Grid>
                                        
                                            
                                        </Grid>
                                        
                                    </Grid>
                                </Box>
                            </Button>
                    </>
            </>
        );
    }

    React.useEffect(() => { 
        if (proposals)
            endTimer();
    }, [proposals]);

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
                        ml:1,
                        mr:1,
                        mb:2,
                        p: { xs: 1, sm: 1.25 },
                        borderRadius: '28px',
                        background: 'linear-gradient(180deg, rgba(10,14,20,0.34) 0%, rgba(10,14,20,0.18) 100%)',
                        backdropFilter: 'blur(12px)',
                    }}>
                    <Grid container direction="row" alignItems="center">
                        <Grid item sm={8} xs={12}
                            sx={{mb:1}}
                        >
                            <TextField 
                                id="input-with-sx" 
                                fullWidth
                                //label="Search Proposals or protocol" 
                                value={(filteredGovernance && filteredGovernance.length > 0) ? filteredGovernance : null}
                                variant='outlined'
                                onChange={(e) => setFilteredGovernance(e.target.value)} 
                                InputProps={{
                                    startAdornment: 
                                        <InputAdornment position="start">
                                            <CustomSearchIcon sx={{ color: 'rgba(255,255,255,0.2)', mr: 1, my: 0.5 }} />
                                        </InputAdornment>,
                                }}
                                sx={{
                                    '.MuiInputBase-input': { fontSize: '16px' },
                                    backgroundColor:'rgba(255,255,255,0.045)',
                                    borderRadius:'20px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                    "& fieldset": {
                                    border: "none",
                                    },
                                }}
                            />
                        </Grid>

                        <Grid
                            xs
                            display="flex"
                            justifyContent="flex-end"
                            sx={{
                                alignItems:"center",
                                
                            }}
                        >
                            <FormGroup row>
                                <FormControlLabel control={<IOSSwitch onChange={handleFilterStateChange} size="small" />} label={<><Typography variant="body2" sx={{ml:1, color:'rgba(230,236,243,0.8)'}}>Show Cancelled Proposals</Typography></>} />
                            </FormGroup>
                        </Grid>
                    </Grid>
                </Box>
                
                <TableContainer component={Paper} sx={{background:'transparent', boxShadow:'none'}}>
                    <Table sx={{ }}>
                        <StyledTable sx={{  }} size="small" aria-label="Proposals Table">
                            
                            <TableBody
                                sx={{
                                    background:'none',
                                    p:0,
                                    m:0,
                                    mb:2,
                                    width:'100%'
                                }}
                            >
                                {/*proposals && (proposals).map((item: any, index:number) => (*/}
                                {proposals && 
                                <>  
                                    {(
                                        (filteredGovernance && filteredGovernance.length > 3) ? 
                                        proposals
                                        .filter((item: any) => 
                                            ( 
                                                item.account?.name?.toLowerCase().includes(filteredGovernance.toLowerCase()) 
                                            || 
                                                item.account?.descriptionLink?.toLowerCase().includes(filteredGovernance.toLowerCase())
                                            )
                                        )
                                        //.filter((item: any) => filterState ? (item.account?.state !== 6) : true)
                                        : 
                                        (rowsPerPage > 0
                                            ? proposals
                                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                //.filter((item: any) => filterState ? (item.account?.state !== 6) : true)
                                            : proposals
                                        )
                                        /*
                                        rowsPerPage > 0
                                        ? proposals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        : proposals*/
                                    ).map((item:any, index:number) => (
                                        <>
                                            {/*console.log("item ("+index+"): "+JSON.stringify(item))*/}
                                            {item?.pubkey && item?.account && item.account?.options && item.account?.options.length > 0 &&
                                                <>
                                                    {/*(item.account?.options[0].voteWeight && item.account?.state === 2) ?
                                                        <TableRow sx={{border:'none'}}>
                                                            <TableCell colSpan={7} sx={{borderBottom:'none!important'}}>
                                                                <Box sx={{ width: '100%' }}>
                                                                    <VotesLinearProgress variant="determinate" value={(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100)} />
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                            :<></>*/}
                                                
                                                    <TableRow 
                                                        key={index} sx={{ 
                                                            borderBottom: 'unset!important', 
                                                            backgroundColor:'none',
                                                            m:0,
                                                            p:0,
                                                            pb:2,
                                                            borderRadius: '17px',
                                                            }}>
                                                        {/*
                                                        <TableCell align="left"
                                                            sx={{borderBottom:'none'}}
                                                        >
                                                            <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`} >
                                                                <GetGovernanceFromRulesView
                                                                    governanceLookup={governanceLookup}
                                                                    rulesWallet={item.account.governance?.toBase58()}
                                                                    proposal={item.pubkey.toBase58()}
                                                                />
                                                            </Typography>
                                                        </TableCell>
                                                        */}
                                                        <TableCell sx={{
                                                            m:0,
                                                            mt:0,
                                                            p:0,
                                                            border:'none',
                                                            }}>
                                                            <Typography variant="caption" 
                                                                color={(item.account?.state === 2) ? `white` : `gray`} 
                                                                sx={{ textDecoration: (item.account?.state === 6) ? 'line-through' : 'none' }}>
                                                                
                                                                <GetGovernanceFromRulesView
                                                                    governanceLookup={governanceLookup}
                                                                    rulesWallet={item.account.governance?.toBase58()}
                                                                    proposal={item.pubkey.toBase58()}
                                                                    name={item.account?.name}
                                                                    description={item.account?.descriptionLink}
                                                                    state={item.account?.state}
                                                                    draftAt={item.account.draftAt}
                                                                    item={item}
                                                                    lastSeenTimestamp={lastSeenTimestamp}
                                                                    wasUpdatedRecently={updatedProposalKeys.includes(toBase58Safe(item.pubkey))}
                                                                />

                                                            </Typography>
                                                        </TableCell>
                                                        {/*
                                                        <TableCell
                                                        >
                                                            <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                                {`${item.account?.draftAt ? (moment.unix(Number((item.account.draftAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell
                                                        >
                                                            <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                                {`${item.account?.signingOffAt ? (moment.unix(Number((item.account?.signingOffAt))).format("MMM D, YYYY, h:mm a")) : `N/A`}`}
                                                            </Typography>
                                                        </TableCell>
                                                        
                                                        {item?.account?.voteType?.type === 1 ?
                                                            <>
                                                                <TableCell 
                                                                    colSpan={2}
                                                                    sx={{textAlign:'center',}}>Multiple Choice Poll
                                                                </TableCell>
                                                            </>
                                                        :
                                                            <>
                                                        
                                                            <TableCell sx={{}}>
                                                                {Number(item.account?.options[0].voteWeight) > 0 ?
                                                                <>
                                                                {`${(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                </>
                                                                :
                                                                <>0%</>
                                                                }
                                                            </TableCell>
                                                            <TableCell sx={{}}>
                                                                {Number(item.account?.denyVoteWeight) > 0 ?
                                                                <>
                                                                {`${(((Number(item.account?.denyVoteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                </>:
                                                                <>0%</>
                                                                }
                                                            </TableCell>
                                                            </>
                                                        }
                                                        <TableCell  align="center"
                                                            sx={{}}
                                                        >
                                                            <GetProposalStatus item={item} />
                                                        </TableCell>
                                                        */}
                                                        

                                                    </TableRow>
                                                    {/*
                                                    <TableRow sx={{pb:2, backgroundColor:'rgba(255,255,255,0.025)'}}>
                                                        <TableCell  align="center" colSpan={6} sx={{borderBottom: '1px solid rgba(255,255,255,0.3)',mt:0,mb:0,pt:0,pb:0}}>
                                                        <Grid container xs={12}
                                                            sx={{
                                                                width:'100%',
                                                                mt: 1,
                                                                mb: 1,
                                                                background: 'rgba(0, 0, 0, 0.2)',
                                                                borderTop: '1px solid rgba(0,0,0,0.3)',
                                                                borderRadius: '17px',
                                                                overflow: 'hidden',
                                                                p: 1,
                                                                color: 'gray',
                                                            }} 
                                                        >
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                Governing Mint <ExplorerView
                                                                    address={item.account.governingTokenMint?.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                Rules <ExplorerView
                                                                    address={item.account.governance?.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                Proposal <ExplorerView
                                                                    address={item.pubkey.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                    Author Record <ExplorerView
                                                                        address={item.account?.tokenOwnerRecord?.toBase58()} 
                                                                        type='address'
                                                                        shorten={8}
                                                                        hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>
                                                        </TableCell>
                                                    </TableRow>
                                                    */}
                                                        
                                                </>
                                            }
                                        </>

                                    )
                                )}
                                </>
                                }
                            </TableBody>
                            
                            <Grid 
                                display="flex"
                                justifyContent="flex-end"
                                sx={{ 
                                    m:1,
                                    mt:2,
                                    borderRadius:'22px',
                                    background:'none',
                                }}>
                                <TableFooter
                                    sx={{
                                        background:'rgba(14,18,24,0.7)',
                                        border:'1px solid rgba(255,255,255,0.08)',
                                        borderRadius:'22px',
                                        backdropFilter:'blur(14px)',
                                    }}
                                >
                                    <TableRow
                                        sx={{
                                        }}
                                    >
                                        <TablePagination
                                            rowsPerPageOptions={[5, 10, 25, 50, 100]}
                                            labelRowsPerPage={"Rows:"}
                                            showLastButton={false}
                                            colSpan={1}
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
                                            sx={{
                                                mt:2,
                                                borderRadius:'22px',
                                                color:'rgba(225,232,240,0.8)',
                                            }}
                                        />
                                    </TableRow>
                                </TableFooter>
                            </Grid>
                            
                        </StyledTable>
                    </Table>
                </TableContainer>
            </>
        )
}

export function GovernanceRealtimeView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const storagePool = GGAPI_STORAGE_POOL;
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [proposals, setProposals] = React.useState(null);
    const [allProposals, setAllProposals] = React.useState(null);
    const [filterState, setFilterState] = React.useState(true);
    const [lastRefreshTime, setLastRefreshTime] = React.useState<number | null>(null);
    const [refreshNow, setRefreshNow] = React.useState(Date.now());
    const [updatedProposalKeys, setUpdatedProposalKeys] = React.useState<string[]>([]);
    const previousProposalFingerprintRef = React.useRef<Map<string, string>>(new Map());
    const hasHydratedRealtimeRef = React.useRef(false);
    const updatedKeysTimeoutRef = React.useRef<number | null>(null);
    const renderDurationMs =
        startTime !== null && endTime !== null
            ? Math.max(0, endTime - startTime)
            : null;
    const renderDurationLabel =
        renderDurationMs === null
            ? ''
            : renderDurationMs < 1000
                ? `${renderDurationMs}ms`
                : `${(renderDurationMs / 1000).toFixed(renderDurationMs >= 10000 ? 1 : 2)}s (${renderDurationMs}ms)`;

    React.useEffect(() => {
        const interval = window.setInterval(() => {
            setRefreshNow(Date.now());
        }, 30000);
        return () => window.clearInterval(interval);
    }, []);

    React.useEffect(() => {
        return () => {
            if (updatedKeysTimeoutRef.current) {
                window.clearTimeout(updatedKeysTimeoutRef.current);
            }
        };
    }, []);
    
    const getGovernanceParameters = async () => {
        if (!loading){
            
            startTimer();
            setAllProposals(null);
            setProposals(null);
            setLoading(true);
            try{
                
                    console.log("Fetching via hybrid cache...")
                    
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    let tcvc = 0;
                    const hybridCache = true;

                    //console.log("ggov: "+JSON.stringify(ggov));
                    //console.log("proposalCount: "+grealm?.account?.proposalCount);
                    const gprops = await getAllProposalsFromAllPrograms();
                    
                    //console.log("Indexed Proposals: "+JSON.stringify(gprops));
                    //const gprops = await getAllProposals(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk);
                    // with the results compare with cached_governance
                    //console.log("All Proposals: "+JSON.stringify(gpropsRpc))
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
                    const sortedRPCResults = rpcprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                    const nextFingerprintMap = new Map<string, string>();
                    const nextUpdatedKeys: string[] = [];
                    for (const proposal of sortedRPCResults) {
                        const proposalPk = toBase58Safe(proposal?.pubkey);
                        if (!proposalPk) continue;
                        const fingerprint = JSON.stringify({
                            state: proposal?.account?.state,
                            draftAt: proposal?.account?.draftAt,
                            votingCompletedAt: proposal?.account?.votingCompletedAt,
                            signingOffAt: proposal?.account?.signingOffAt,
                            yes: proposal?.account?.options?.[0]?.voteWeight ?? proposal?.account?.yesVoteCount ?? 0,
                            no: proposal?.account?.denyVoteWeight ?? proposal?.account?.noVoteCount ?? 0,
                            instructions: proposal?.account?.options?.map?.((option: any) => option?.instructionsNextIndex ?? 0) || [],
                        });
                        nextFingerprintMap.set(proposalPk, fingerprint);
                        if (
                            hasHydratedRealtimeRef.current &&
                            previousProposalFingerprintRef.current.get(proposalPk) !== fingerprint
                        ) {
                            nextUpdatedKeys.push(proposalPk);
                        }
                    }
                    previousProposalFingerprintRef.current = nextFingerprintMap;
                    if (hasHydratedRealtimeRef.current) {
                        setUpdatedProposalKeys(nextUpdatedKeys);
                        if (updatedKeysTimeoutRef.current) {
                            window.clearTimeout(updatedKeysTimeoutRef.current);
                        }
                        updatedKeysTimeoutRef.current = window.setTimeout(() => {
                            setUpdatedProposalKeys([]);
                        }, 9000);
                    } else {
                        hasHydratedRealtimeRef.current = true;
                    }
                    setLastRefreshTime(Date.now());
                    //console.log("prop: "+JSON.stringify(sortedRPCResults[0]))
                    setAllProposals(sortedRPCResults);
                    setProposals(sortedRPCResults);
                    
            }catch(e){console.log("ERR: "+e)}
        }
        setLoading(false);
    }

    React.useEffect(() => {
        if (allProposals){
            if (filterState){
                const tmpProps = allProposals
                    .filter((item) => item.account?.state !== 6)
                    .sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                
                console.log("Showing only valid props")
                setProposals(tmpProps)
            } else{
                const tmpProps = allProposals
                    .sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                
                console.log("Showing all props")
                setProposals(tmpProps)
            }
        }
    }, [allProposals, filterState]);
    
    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    React.useEffect(() => { 
        if (!loading){
            callGovernanceLookup();
            getGovernanceParameters();
        }
        
        const interval = setInterval(() => {
            getGovernanceParameters();
          }, 300000); // Call getGovernanceParameters every 5 minutes (300000 milliseconds)
        
          return () => {
            clearInterval(interval); // Clear the interval when the component unmounts to prevent memory leaks
        };
    }, []);
    
    const startTimer = () => {
        setStartTime(Date.now());
        setEndTime(null);
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    
        if(loading){
            return (
                <Grid
                        sx={{
                        p: 1}}
                    >
                        <Box
                            sx={{
                                width:'100%',
                                background: 'linear-gradient(180deg, rgba(13, 17, 24, 0.88) 0%, rgba(10, 14, 20, 0.78) 100%)',
                                borderRadius: '28px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                boxShadow: '0 24px 60px rgba(5, 9, 15, 0.28)',
                                mt:2,
                                p: 2,
                                pt: 4,
                                pb: 4,
                                alignItems: 'center', textAlign: 'center',
                                backdropFilter: 'blur(18px)',
                            }} 
                        > 
                            <Typography variant="overline" sx={{color:'rgba(173,183,197,0.72)', letterSpacing:'0.14em'}}>Live Sync</Typography>
                            <Typography variant="h6" sx={{color:'white', mt:0.6, mb:0.5}}>Loading governance proposal flow</Typography>
                            <Typography variant="body2" sx={{color:'rgba(209,217,226,0.74)', mb:1.4}}>
                                Pulling the latest drafts, votes, and outcomes across supported DAOs.
                            </Typography>
                            <LinearProgress color="inherit" sx={{ borderRadius:'999px', height:8 }} />
                        
                    </Box>
                </Grid>
            )
        } else{
            if (proposals){
                return (
                    <Grid
                        sx={{
                        p: 1}}
                    >
                        <pwa-install
                            //manual-apple="true"
                            //manual-chrome="true"
                            //disable-chrome="true"
                          
                            install-description="Custom call to install text"
                            disable-install-description="true"
                            disable-screenshots="true"
                            manifest-url="/up_/manifest.webmanifest"
                            name="Governance"
                            description="Governance.so | Next-gen DAO tooling for better proposals, faster execution, and real ownership. #OPOS"         
                            icon={APP_ICON}
                        ></pwa-install>

                        <Box
                            sx={{
                                width:'100%',
                                background: 'linear-gradient(180deg, rgba(10, 14, 20, 0.82) 0%, rgba(8, 11, 17, 0.74) 100%)',
                                borderRadius: '32px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                boxShadow: '0 28px 80px rgba(5, 9, 15, 0.32)',
                                mt:2,
                                p: 2,
                                pt: 4,
                                pb: 4,
                                alignItems: 'center', textAlign: 'center',
                                backdropFilter: 'blur(22px)',
                                // Responsive padding for mobile devices
                                '@media (max-width: 600px)': {
                                    p: 0,
                                    mt:0.25,
                                },
                            }} 
                        > 
                        
                        
                            <Box
                                sx={{
                                    position: 'relative',
                                    overflow: 'hidden',
                                    background: `linear-gradient(180deg, rgba(16, 20, 27, 0.94) 0%, rgba(11, 14, 19, 0.96) 100%)`,
                                    borderRadius: '28px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    m:2,
                                    p: 4,
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                                    // Responsive padding for mobile devices
                                    '@media (max-width: 600px)': {
                                        m: 0,
                                        p: 0,
                                        pt:0.5,
                                    },
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        inset: 0,
                                        pointerEvents: 'none',
                                        background: 'radial-gradient(circle at top right, rgba(88,166,255,0.10), transparent 30%), radial-gradient(circle at bottom left, rgba(94,201,143,0.08), transparent 28%)',
                                    }
                                }}
                                > 

                            <Grid container direction="row" sx={{
                                ml:1,
                                mr:1,
                                mb:2,
                                }}>
                                <Grid item xs>
                                    <Typography variant="h4" sx={{ textAlign: "left", letterSpacing:'-0.03em', fontWeight:700, color:'#eef3f8' }}>
                                        Realtime Proposals <BlinkingDot />
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            textAlign:'left',
                                            color:'rgba(173, 183, 197, 0.78)',
                                            mt:0.6,
                                            maxWidth:'52rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Box component="span">
                                            Watch drafts, votes, and outcomes move across Solana DAOs in a single live surface.
                                        </Box>
                                        {lastRefreshTime && (
                                            <Tooltip title={moment(lastRefreshTime).format('MMM D, YYYY, h:mm:ss a')}>
                                                <Box
                                                    component="span"
                                                    sx={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 0.7,
                                                        color: 'rgba(173, 183, 197, 0.74)',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    <Box
                                                        component="span"
                                                        sx={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: '999px',
                                                            background: 'rgba(94,201,143,0.9)',
                                                            boxShadow: '0 0 10px rgba(94,201,143,0.35)',
                                                            flexShrink: 0,
                                                        }}
                                                    />
                                                    {refreshNow ? `Updated ${moment(lastRefreshTime).fromNow()}` : 'Updated'}
                                                </Box>
                                            </Tooltip>
                                        )}
                                    </Typography>
                                </Grid>
                                <Grid item alignContent="right">
                                    <Box sx={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:0.8, '@media (max-width: 600px)': { mr:1.5 } }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                            textAlign: "left",
                                            fontSize: "10px",
                                            color: "rgba(173, 183, 197, 0.72)",
                                            a: {
                                                display: 'inline-block',
                                                color: 'rgba(220,228,236,0.82)',
                                                textDecoration: 'none',
                                                '&:hover': {
                                                textDecoration: 'none',
                                                },
                                            },
                                            img: {
                                                maxHeight: '14px',
                                                verticalAlign: 'middle',
                                            },
                                            }}
                                        >
                                            Powered by<br />
                                            <Tooltip title="Go to Home">
                                                <a href="https://governance.so" target="_blank" rel="noopener noreferrer">
                                                <img src={APP_LOGO} alt="Governance.so" />
                                                </a>
                                            </Tooltip>
                                        </Typography>
                                    </Box>
                                    </Grid>
                            </Grid>
                                
                                <RenderGovernanceTable 
                                    endTimer={endTimer} 
                                    proposals={proposals} 
                                    filterState={filterState}
                                    setFilterState={setFilterState}
                                    governanceLookup={governanceLookup}
                                    lastRefreshTime={lastRefreshTime}
                                    refreshNow={refreshNow}
                                    updatedProposalKeys={updatedProposalKeys}
                                />
                                    
                                    
                                {renderDurationMs !== null &&
                                    <Grid
                                        sx={{
                                            m: 0,
                                            textAlign:'left',
                                            // Responsive padding for mobile devices
                                            '@media (max-width: 600px)': {
                                                ml:1,
                                                mb:1,
                                            },
                                        }}
                                        >
                                            <Typography 
                                                variant="caption"
                                                sx={{
                                                textAlign:'left'
                                            }}
                                        >
                                            Render time: {renderDurationLabel}<br/>
                                        </Typography>

                                    </Grid>
                                }
                            </Box>  
                        </Box>
                    </Grid> 
                );
            }else{
                return (
                    <Box
                        sx={{
                            width:'100%',
                            mt: 6,
                            background: 'linear-gradient(180deg, rgba(13, 17, 24, 0.84) 0%, rgba(10, 14, 20, 0.72) 100%)',
                            borderRadius: '24px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            boxShadow: '0 24px 60px rgba(5, 9, 15, 0.24)',
                            p: 4,
                            pt:4,
                            pb:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="overline" sx={{color:'rgba(173,183,197,0.72)', letterSpacing:'0.14em'}}>Quiet Feed</Typography>
                        <Typography variant="h6" sx={{color:'white', mt:0.6, mb:0.5}}>No proposals to show right now</Typography>
                        <Typography variant="body2" sx={{color:'rgba(209,217,226,0.74)'}}>
                            Try widening the search, toggling cancelled proposals, or wait for the next refresh cycle.
                        </Typography>
                    </Box>
                );
            }
            
        }
    
}
