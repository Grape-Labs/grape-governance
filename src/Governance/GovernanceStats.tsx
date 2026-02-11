import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import axios from "axios";
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import moment from 'moment';
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults";
import {getRealms, RequestStatus} from "gspl-directory";
import {publicKey as UmiPK} from "@metaplex-foundation/umi";

import { GovernanceStatsSummaryView } from './GovernanceStatsSummary';

import { 
    tryGetName,
} from '@cardinal/namespaces';

//import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend, BarChart, Bar } from 'recharts';
//import { BarChart, LineChart } from '@mui/x-charts';

import {
    Chart,
    BarSeries,
    LineSeries,
    Title,
    ArgumentAxis,
    ValueAxis,
    Legend
  } from '@devexpress/dx-react-chart-material-ui';
import { Stack, Animation } from '@devexpress/dx-react-chart';
//import { withStyles } from '@mui/styles';

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
  Card, 
  CardContent,
  Chip,
} from '@mui/material/';

import { GovernanceHeaderView } from './GovernanceHeaderView';
import GovernanceStatsParticipationTableView from './GovernanceStatsParticipationTable';
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

import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
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
    getRealmIndexed,
    getProposalIndexed,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getRealmConfigIndexed,
    getVoteRecordsIndexed,
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
    9:'Vetoed',
}
const EXCLUDED_COMMUNITY_STATES = new Set<number>([6, 9]); // cancelled + vetoed

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

export function GovernanceStatsView(props: any) {
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
    
    const [loadingMessage, setLoadingMessage] = React.useState("Loading Stats...");
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
    const [gspl, setGSPL] = React.useState(null);
    const [gsplMetadata, setGSPLMetadata] = React.useState(null);

    const [quorumPercentage, setQuorumPercentage] = React.useState<string | null>(null);
    const [activeParticipationPercentage, setActiveParticipationPercentage] = React.useState<string | null>(null);
    const [votingParticipationPercentage, setVotingParticipationPercentage] = React.useState<string | null>(null);
    const [top10GovernanceShare, setTop10GovernanceShare] = React.useState<string | null>(null);
    const [councilVoteShare, setCouncilVoteShare] = React.useState<string | null>(null);

    const [mostParticipatedProposal, setMostParticipatedProposal] = React.useState(null);
    const [averageVotesPerProposal, setAverageVotesPerProposal] = React.useState(null);
    const [proposalParticipationStats, setProposalParticipationStats] = React.useState([]);

    const [proposalsPerMonthArray, setProposalsPerMonthArray] = React.useState<any[]>([]);
    const [participationArray, setParticipationArray] = React.useState<any[]>([]);

    const [governanceProposals, setGovernanceProposals] = React.useState<any[]>([]);
    const [governanceParticipants, setGovernanceParticipants] = React.useState<any[]>([]);

    const [flaggedAuthors, setFlaggedAuthors] = React.useState<any[]>([]);
    const [showFlaggedAuthors, setShowFlaggedAuthors] = React.useState(false);

    const [paginationModel, setPaginationModel] = React.useState<GridPaginationModel>({
        page: 0,
        pageSize: 10,
    });

    const CONFIG = UmiPK("GrVTaSRsanVMK7dP4YZnxTV6oWLcsFDV1w6MHGvWnWCS");
    const initGrapeGovernanceDirectory = async() => {
        try{
            const umi = createUmi(RPC_CONNECTION);
            const entries = await getRealms(umi, CONFIG, RequestStatus.Approved);
            //console.log("Entries: "+JSON.stringify(entries));
            return entries;
        } catch(e){
            console.log("Could not load GSPDL");
        }
    }

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

    function getProposalAuthorKey(p: any): string | null {
        // 1) best: explicit proposer / author if present
        const proposer =
            p?.account?.proposer?.toBase58?.() ||
            p?.account?.proposer?.toString?.();

        if (proposer) return proposer;

        // 2) tokenOwnerRecord (then map TOR -> wallet using trecords later)
        const tor =
            p?.account?.tokenOwnerRecord?.toBase58?.() ||
            p?.account?.tokenOwnerRecord?.toString?.();

        if (tor) return `TOR:${tor}`;

        return null;
    }

    const getGovernanceMembers = async () => {
        if (!loading){
            setLoading(true);
            let grealm = null;
            try{  
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                
                console.log("Governance: "+governanceAddress);
                
                if (cachedRealm){
                    console.log("Realm from cache")
                    grealm = cachedRealm;
                } else{
                    grealm = await getRealmIndexed(governanceAddress);
                }
                const realmPk = new PublicKey(grealm.pubkey);
                setRealm(grealm);
                setRealmName(grealm.account.name);
                
                //const config = await tryGetRealmConfig(RPC_CONNECTION, new PublicKey(grealm.owner), new PublicKey(grealm.pubkey));
                const config = await getRealmConfigIndexed(null, grealm.owner, realmPk);

                if (config?.account?.communityTokenConfig?.voterWeightAddin){
                    setPluginDao(true);
                }

                //console.log("realm: "+JSON.stringify(grealm))

                setGoverningTokenMint(new PublicKey(grealm.account.communityMint).toBase58());
                // with realm check if this is a backed token
                let thisTokenDecimals = 0;

                let gTD = null;
                let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account?.communityMint))
                //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
                gTD = tokenDetails.value.data.parsed.info.decimals;
                thisTokenDecimals = gTD;
                setGoverningTokenDecimals(thisTokenDecimals);
                
                const tknSupply = await connection.getTokenSupply(new PublicKey(grealm.account.communityMint));

                //const governingMintPromise = await connection.getParsedAccountInfo(grealm.account.communityMint);
                if (tknSupply)
                    setCirculatingSupply(tknSupply);
                
                
                // THE FOLLOWING WILL GET ALL PROPOSALS
                // THIS WILL BE A METRIC USED TO GET ALL PROPOSALS CREATED WITH A VOTER RECORD
                const governanceRulesIndexed = await getAllGovernancesIndexed(governanceAddress, grealm?.owner);
                const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
            
                setLoadingMessage("Loading Proposals...");
                const gap = await getAllProposalsIndexed(governanceRulesStrArr, null, governanceAddress);

                const communityMintStr = new PublicKey(grealm.account.communityMint).toBase58();

                const filteredGap = (gap || []).filter((p: any) => {
                    const state = Number(p?.account?.state ?? -1);

                    const proposalMintStr =
                        p?.account?.governingTokenMint?.toBase58?.() ||
                        p?.account?.governingTokenMint?.toString?.() ||
                        "";

                    const isCommunityProposal = proposalMintStr === communityMintStr;

                    // exclude ONLY community proposals that are cancelled/vetoed
                    if (isCommunityProposal && EXCLUDED_COMMUNITY_STATES.has(state)) return false;

                    return true;
                });


                const gapAll = gap || []; // all proposals (includes vetoed/cancelled)
                const gapFiltered = gapAll.filter((p: any) => {
                    const state = Number(p?.account?.state ?? -1);

                    const proposalMintStr =
                        p?.account?.governingTokenMint?.toBase58?.() ||
                        p?.account?.governingTokenMint?.toString?.() ||
                        "";

                    const isCommunityProposal = proposalMintStr === communityMintStr;

                    // exclude ONLY community proposals that are cancelled/vetoed from normal stats
                    if (isCommunityProposal && EXCLUDED_COMMUNITY_STATES.has(state)) return false;

                    return true;
                });

                setGovernanceProposals(gapFiltered);

                const excludedCommunityProposals = gapAll.filter((p: any) => {
                const state = Number(p?.account?.state ?? -1);

                const mintStr =
                    p?.account?.governingTokenMint?.toBase58?.() ||
                    p?.account?.governingTokenMint?.toString?.() ||
                    "";

                const isCommunityProposal = mintStr === communityMintStr;
                return isCommunityProposal && EXCLUDED_COMMUNITY_STATES.has(state);
                });

                const flaggedAuthorsMap: Record<string, any> = {};

                for (const p of excludedCommunityProposals) {
                const state = Number(p?.account?.state ?? -1);
                const authorKey = getProposalAuthorKey(p);
                if (!authorKey) continue;

                const k = authorKey;
                if (!flaggedAuthorsMap[k]) {
                    flaggedAuthorsMap[k] = {
                    authorKey: k, // wallet or TOR:xxx
                    vetoed: 0,
                    cancelled: 0,
                    totalFlagged: 0,
                    proposals: [],
                    lastFlaggedAt: 0,
                    };
                }

                if (state === 9) flaggedAuthorsMap[k].vetoed++;
                if (state === 6) flaggedAuthorsMap[k].cancelled++;

                flaggedAuthorsMap[k].totalFlagged++;
                const ts = Number(p?.account?.draftAt ?? p?.account?.votingAt ?? 0);
                flaggedAuthorsMap[k].lastFlaggedAt = Math.max(flaggedAuthorsMap[k].lastFlaggedAt, ts);

                flaggedAuthorsMap[k].proposals.push({
                    pubkey: p.pubkey.toBase58(),
                    title: p.account?.name,
                    state: GOVERNANNCE_STATE[state] || String(state),
                    draftAt: p.account?.draftAt ?? null,
                    votingAt: p.account?.votingAt ?? null,
                });
                }

                const flaggedAuthorsArray = Object.values(flaggedAuthorsMap)
                .sort((a: any, b: any) => b.totalFlagged - a.totalFlagged);

                //console.log("gap: ", gap);
                //setGovernanceProposals(gap);
                //setGovernanceProposals(filteredGap);

                const proposalsPerMonth = gap.reduce((acc, p) => {
                    const votingAt = p.account?.votingAt;
                    if (!votingAt) return acc;

                    const date = new Date(votingAt * 1000);
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

                    acc[key] = (acc[key] || 0) + 1;
                    return acc;
                    }, {});

                const tproposalsPerMonthArray = Object.entries(proposalsPerMonth)
                    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                    .map(([month, count]) => ({ month, count }));

                setProposalsPerMonthArray(tproposalsPerMonthArray);
                setLoadingMessage("Getting Participation...");
                const allVoteRecords: any[] = [];

                for (let i = 0; i < filteredGap.length; i++) {
                const proposal = filteredGap[i];
                setLoadingMessage(`${i + 1} of ${filteredGap.length} Proposal Participation...`);

                // Skip drafts
                if (Number(proposal?.account?.state) === 0) continue;

                const voteRecords = await getVoteRecordsIndexed(
                    proposal.pubkey.toBase58(),
                    grealm?.owner,
                    governanceAddress,
                    true
                );

                // Attach to proposal if needed
                proposal.voteRecords = voteRecords;

                let recordsArray: any[] = [];
                if (Array.isArray(voteRecords)) {
                    recordsArray = voteRecords;
                } else if (voteRecords && typeof voteRecords === "object" && "value" in voteRecords) {
                    recordsArray = (voteRecords as any).value ?? [];
                }

                allVoteRecords.push(...recordsArray);
                }

                setLoadingMessage("Processing Participation Data...");

                // Build proposal metadata lookup
                const proposalMetaMap: Record<string, any> = {};
                for (const p of filteredGap) {
                    proposalMetaMap[p.pubkey.toBase58()] = {
                        title: p.account.name,
                        mint: p.account.governingTokenMint.toBase58(),
                        draftAt: p.account.draftAt,
                        signingOffAt: p.account.signingOffAt,
                        votingAt: p.account.votingAt,
                        votingCompletedAt: p.account.votingCompletedAt,
                        proposalState: p.account.state,
                    };
                }

                const proposalParticipationStats = filteredGap
                    .filter(p => Array.isArray(p.voteRecords))
                    .map(p => ({
                        title: p.account.name,
                        pubkey: p.pubkey.toBase58(),
                        totalVotes: p.voteRecords.length,
                        state: GOVERNANNCE_STATE[p.account.state] || 'Unknown',
                    }));
                
                // Group vote records by wallet
                const voteRecordMap = {};
                for (const vr of allVoteRecords) {
                    const wallet = vr.account.governingTokenOwner;
                    const proposalId = vr.account.proposal;
                    const proposalMeta = proposalMetaMap[proposalId] || {};

                    if (!voteRecordMap[wallet]) voteRecordMap[wallet] = [];

                    voteRecordMap[wallet].push({
                        pubkey:proposalId,
                        proposalTitle: proposalMeta.title,
                        proposalMint: proposalMeta.mint,
                        voteType: vr.account.vote?.voteType,
                        voteWeight: vr.account.voterWeight ?? 0,
                        draftAt: proposalMeta.draftAt,
                        signingOffAt: proposalMeta.signingOffAt,
                        votingAt: proposalMeta.votingAt,
                        votingCompletedAt: proposalMeta.votingCompletedAt,
                        proposalState: proposalMeta.proposalState,
                        communityMint: new PublicKey(grealm?.account?.communityMint).toBase58(),
                        communityDecimals: thisTokenDecimals,
                        rawVote: vr.account.vote,
                    });
                }

                setLoadingMessage("Fetching Participants...");
                // Fetch token owner records
                let trecords = null;
                const indexedTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(
                    realmPk.toBase58(),
                    grealm.owner
                );
                trecords = indexedTokenOwnerRecords;

                const torToWallet: Record<string, string> = {};
                for (const r of trecords) {
                // r.pubkey is the TokenOwnerRecord account address
                const torPk = r?.pubkey?.toBase58?.() || String(r?.pubkey);
                const walletPk = r?.account?.governingTokenOwner?.toBase58?.() || String(r?.account?.governingTokenOwner);
                if (torPk && walletPk) torToWallet[torPk] = walletPk;
                }

                const resolvedFlaggedAuthors = flaggedAuthorsArray.map((a: any) => {
                if (typeof a.authorKey === "string" && a.authorKey.startsWith("TOR:")) {
                    const tor = a.authorKey.slice(4);
                    return { ...a, wallet: torToWallet[tor] || null, tor };
                }
                return { ...a, wallet: a.authorKey, tor: null };
                });

                setFlaggedAuthors(resolvedFlaggedAuthors);

                // Build participant array
                setLoadingMessage("Merging Data...");
                // Step 1: Group token owner records by wallet
                const groupedRecords = {};

                for (const trecord of trecords) {
                    const wallet = trecord.account.governingTokenOwner.toBase58();
                    const mint = trecord.account.governingTokenMint.toBase58();

                    if (!groupedRecords[wallet]) {
                        groupedRecords[wallet] = {
                        wallet,
                        voteHistory: [],
                        staked: {
                            governingTokenDepositAmount: 0,
                            governingCouncilDepositAmount: 0,
                        },
                        };
                    }

                    // Apply decimals only for community mint
                    if (mint === grealm.account.communityMint.toBase58()) {
                        groupedRecords[wallet].staked.governingTokenDepositAmount +=
                        +(Number(trecord.account.governingTokenDepositAmount || 0) / Math.pow(10, thisTokenDecimals || 0)).toFixed(0);
                    } else {
                        // Council mint always uses 0 decimals (raw integer)
                        groupedRecords[wallet].staked.governingCouncilDepositAmount +=
                        Number(trecord.account.governingTokenDepositAmount || 0);
                    }
                }

                // Step 2: Merge vote history and compute stats
                const participantArray = [];

                for (const wallet in groupedRecords) {
                    const record = groupedRecords[wallet];
                    const voteHistory = voteRecordMap[wallet] || [];

                    const voteStats = {
                        total: voteHistory.length,
                        approve: voteHistory.filter(v => v.voteType === 0).length,
                        deny: voteHistory.filter(v => v.voteType === 1).length,
                        abstain: voteHistory.filter(v => v.voteType === 2).length,
                    };

                    // Determine first/last participation by draftAt
                    const draftTimestamps = voteHistory
                        .map(v => v.draftAt)
                        .filter(ts => typeof ts === 'number' && ts > 0);

                    const firstVoteAt = draftTimestamps.length > 0 ? Math.min(...draftTimestamps) : null;
                    const lastVoteAt = draftTimestamps.length > 0 ? Math.max(...draftTimestamps) : null;

                    participantArray.push({
                        wallet,
                        voteStats,
                        voteHistory,
                        firstVoteAt,
                        lastVoteAt,
                        staked: record.staked,
                    });
                }

                const participationMap = {};
                participantArray.forEach((p) => {
                    const seenMonths = new Set();
                    p.voteHistory.forEach(v => {
                        const date = new Date((v.draftAt || 0) * 1000);
                        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        if (!seenMonths.has(key)) {
                        participationMap[key] = (participationMap[key] || new Set()).add(p.wallet);
                        seenMonths.add(key);
                        }
                    });
                });

                // Convert Set to count
                const tparticipationArray = Object.entries(participationMap)
                    .map(([month, set]) => ({ month, voters: set?.size }))
                    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

                setParticipationArray(tparticipationArray);

                const sortedProposalsByParticipation = proposalParticipationStats.sort((a, b) => b.totalVotes - a.totalVotes);

                const mostParticipatedProposal = sortedProposalsByParticipation[0];
                const averageVotesPerProposal = proposalParticipationStats.length > 0
                ? (proposalParticipationStats.reduce((sum, p) => sum + p.totalVotes, 0) / proposalParticipationStats.length).toFixed(1)
                : null;

                // Optional: save to state
                setMostParticipatedProposal(mostParticipatedProposal);
                setAverageVotesPerProposal(averageVotesPerProposal);
                setProposalParticipationStats(proposalParticipationStats);

                setGovernanceParticipants(participantArray);

                console.log("participantArray:", participantArray);


                // now loop through all token owner records and then merge with the vote records so that we can get the stats in one place per voter record


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

                    const quorumPercentage = circulatingSupply?.value?.amount
                        ? ((totalDepositedVotes / circulatingSupply.value.amount) * 100).toFixed(2)
                        : null;

                    const activeParticipationPercentage = totalParticipants
                        ? ((activeParticipants / totalParticipants) * 100).toFixed(1)
                        : null;

                    const votingParticipationPercentage = totalParticipants
                        ? ((votingParticipants / totalParticipants) * 100).toFixed(1)
                        : null;

                    const top10GovernanceShare = top10Participants
                        ? top10Participants.percentageOfGovernanceSupply.toFixed(2)
                        : null;

                    const councilVoteShare = totalDepositedCouncilVotes && totalDepositedVotes
                        ? ((totalDepositedCouncilVotes / totalDepositedVotes) * 100).toFixed(2)
                        : null;

                    setQuorumPercentage(quorumPercentage);
                    setActiveParticipationPercentage(activeParticipationPercentage);
                    setVotingParticipationPercentage(votingParticipationPercentage);
                    setTop10GovernanceShare(top10GovernanceShare);
                    setCouncilVoteShare(councilVoteShare);

                    if (top10)
                        setTop10Participants(top10);
                    setMembers(sortedResults);
                }
            
            }catch(e){console.log("ERR: "+e)}
        
            setLoadingMessage("Fetching GSPL...");

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
            }
        }
        setLoadingMessage("Done");
                
        setLoading(false);
        endTimer();
    }

    const startTimer = () => {
        setStartTime(Date.now());
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    React.useEffect(() => {
        if (governanceAddress){
            getGovernanceMembers();
        }
    }, []);

    
    React.useEffect(() => { 
        if (!loading){
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);

    const sortedFlaggedAuthors = React.useMemo(() => {
        return (flaggedAuthors || [])
            .slice()
            .sort((a: any, b: any) =>
            (Number(b.vetoed || 0) - Number(a.vetoed || 0)) ||
            (Number(b.totalFlagged || 0) - Number(a.totalFlagged || 0)) ||
            (Number(b.lastFlaggedAt || 0) - Number(a.lastFlaggedAt || 0))
            );
        }, [flaggedAuthors]);



    
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
                    <Typography variant="caption">Loading Governance Stats {governanceAddress}
                        <>
                        <br/>
                        {loadingMessage && <>{loadingMessage}</>}
                        <br/>
                        </>
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
                                    <GovernanceHeaderView
                                        governanceName={realmName}
                                        governanceAddress={governanceAddress}
                                        gsplMetadata={gsplMetadata}
                                    />
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

                        {proposalsPerMonthArray?.length > 0 && (
                            <Card sx={{ my: 4 }}>
                                <CardContent>
                                    <Paper sx={{ overflowX: 'auto' }}>
                                        <Chart data={proposalsPerMonthArray}>
                                        <ArgumentAxis/>
                                        <ValueAxis />

                                        <BarSeries valueField="count" argumentField="month" name="Proposals" />
                                        <Animation />
                                        <Title text="Monthly Proposal Count" />
                                        </Chart>
                                    </Paper>
                                </CardContent>
                            </Card>
                            )}

                        <GovernanceStatsSummaryView
                            activeParticipants={activeParticipants}
                            votingParticipants={votingParticipants}
                            totalParticipants={totalParticipants}
                            totalDepositedVotes={totalDepositedVotes}
                            totalDepositedCouncilVotes={totalDepositedCouncilVotes}
                            governingTokenDecimals={governingTokenDecimals}
                            circulatingSupply={circulatingSupply}
                            members={members}
                            quorumPercentage={quorumPercentage}
                            activeParticipationPercentage={activeParticipationPercentage}
                            votingParticipationPercentage={votingParticipationPercentage}
                            top10GovernanceShare={top10GovernanceShare}
                            councilVoteShare={councilVoteShare}
                            top10Participants={top10Participants}
                            mostParticipatedProposal={mostParticipatedProposal}
                            averageVotesPerProposal={averageVotesPerProposal}
                            proposalParticipationStats={proposalParticipationStats}
                        />

                        {/*participationArray?.length > 0 && (
                            <Card sx={{ my: 4 }}>
                                <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Voter Participation Per Month
                                </Typography>
                                <Paper sx={{ overflowX: 'auto' }}>
                                    <Chart data={participationArray}>
                                    <ArgumentAxis />
                                    <ValueAxis />

                                    <LineSeries valueField="voters" argumentField="month" name="Voters" />

                                    <Animation />
                                    <Legend />
                                    <Title text="Monthly Voter Participation" />
                                    </Chart>
                                </Paper>
                                </CardContent>
                            </Card>
                        )*/}

                        <GovernanceStatsParticipationTableView
                            proposals={governanceProposals}
                            members={members}
                            participantArray={governanceParticipants}
                            onDateRangeCalculated={({ start, end }) => {
                                console.log('Calculated date range:', start, end);
                                // set default filters or use it elsewhere
                            }}
                            />


                                                   {sortedFlaggedAuthors?.length > 0 && (
                                <Paper
                                    elevation={0}
                                    sx={{
                                    my: 1.5,
                                    px: 1.25,
                                    py: 0.75,
                                    borderRadius: 2,
                                    background: "rgba(0,0,0,0.35)",
                                    border: "1px solid rgba(255,255,255,0.08)",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1 }}>
                                        Flagged authors
                                        </Typography>

                                        <Chip
                                        size="small"
                                        label={sortedFlaggedAuthors.length}
                                        sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: 12 } }}
                                        />

                                        {showFlaggedAuthors && (
                                        <Typography variant="caption" sx={{ opacity: 0.75, lineHeight: 1 }}>
                                            sorted by vetoes
                                        </Typography>
                                        )}
                                    </Box>

                                    <Tooltip title={showFlaggedAuthors ? "Hide flagged authors" : "Show flagged authors"}>
                                        <IconButton
                                        size="small"
                                        onClick={() => setShowFlaggedAuthors((v) => !v)}
                                        sx={{ p: 0.5 }}
                                        >
                                        {showFlaggedAuthors ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                                        </IconButton>
                                    </Tooltip>
                                    </Box>

                                    <Collapse in={showFlaggedAuthors} timeout="auto" unmountOnExit>
                                    <Box sx={{ mt: 1 }}>
                                        <DataGrid
                                        autoHeight
                                        density="compact"
                                        disableRowSelectionOnClick
                                        hideFooterSelectedRowCount
                                        rows={sortedFlaggedAuthors.map((x, idx) => ({ id: idx, ...x }))}
                                        columns={[
                                            {
                                            field: "wallet",
                                            headerName: "Author",
                                            flex: 1,
                                            minWidth: 220,
                                            renderCell: (params) =>
                                                params.value ? (
                                                <ExplorerView address={params.value} type="address" />
                                                ) : (
                                                <Typography variant="caption">Unknown</Typography>
                                                ),
                                            },
                                            { field: "vetoed", headerName: "Veto", width: 80 },
                                            { field: "cancelled", headerName: "Canc", width: 80 },
                                            { field: "totalFlagged", headerName: "Total", width: 80 },
                                            {
                                            field: "lastFlaggedAt",
                                            headerName: "Last",
                                            width: 120,
                                            valueGetter: (p) =>
                                                p?.row?.lastFlaggedAt ? moment.unix(Number(p.row.lastFlaggedAt)).fromNow() : "",
                                            },
                                        ]}
                                        initialState={{ pagination: { page: 0, pageSize: 5 } }}
                                        rowsPerPageOptions={[5, 10, 25]}
                                        sx={{
                                            border: "none",
                                            "& .MuiDataGrid-columnHeaders": { minHeight: 34, maxHeight: 34 },
                                            "& .MuiDataGrid-columnHeader": { py: 0 },
                                            "& .MuiDataGrid-cell": { py: 0 },
                                        }}
                                        />
                                    </Box>
                                    </Collapse>
                                </Paper>
                                )}
                        
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime<br/>
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
                        <Typography variant="caption">Governance Stats {governanceAddress}</Typography>
                        
                    </Box>
                );
                
            }
            
        }
    
}