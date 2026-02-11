import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Link } from "react-router-dom";

import { initGrapeGovernanceDirectory } from './api/gspl_queries';
import { buildDirectoryFromGraphQL } from "./api/queries"; // adjust path if needed

import {
    Box,
    Badge,
    Grid,
    Card,
    CardActions,
    CardContent,
    IconButton,
    Button,
    ButtonGroup,
    TextField,
    Tooltip,
    Typography,
    LinearProgress,
    linearProgressClasses,
    Fab,
    Fade,
    useScrollTrigger,
    TableContainer,
    Table,
    TableBody,
    TableRow,
    TableCell,
    Paper,
} from '@mui/material/';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernanceDirectoryCardView from "./GovernanceDirectoryCardView";
import GovernanceParticipationView from "./GovernanceParticipationView";

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BallotIcon from '@mui/icons-material/Ballot';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import SortIcon from '@mui/icons-material/Sort';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SearchIcon from "@mui/icons-material/Search";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import WhatshotIcon from "@mui/icons-material/Whatshot";
import VerifiedIcon from "@mui/icons-material/Verified";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'

import {
    fetchGovernanceLookupFile,
    fetchGovernanceMasterMembersFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

import {
    timeAgo
} from '../utils/grapeTools/WalletAddress'

import { GGAPI_STORAGE_POOL, 
    RPC_CONNECTION, 
    RPC_ENDPOINT,
    GRAPE_LOGO } from '../utils/grapeTools/constants';
import moment from 'moment';

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

interface Props {
    /**
     * Injected by the documentation to work in an iframe.
     * You won't need it on your project.
     */
    window?: () => Window;
    children: React.ReactElement;
}

function isValidSolanaPublicKey(publicKeyString:string) {
    // Regular expression for Solana public key validation
    if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
        return false;
    }
    
    // Regular expression for Solana public key validation
    const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    // Check if the publicKey matches the Solana public key pattern
    let status = solanaPublicKeyRegex.test(publicKeyString);
    try{
        if (status){
            const pk = new PublicKey(publicKeyString);
            if (pk)
                return true;
            else
                return false;
        }
    }catch(e){
        return false;
    }
}

function ScrollTop(props: Props) {
    const { children, window } = props;
    // Note that you normally won't need to set the window ref as useScrollTrigger
    // will default to window.
    // This is only being set here because the demo is in an iframe.
    const trigger = useScrollTrigger({
      target: window ? window() : undefined,
      disableHysteresis: true,
      threshold: 100,
    });
  
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (
        (event.target as HTMLDivElement).ownerDocument || document
      ).querySelector('#back-to-top-anchor');
  
      if (anchor) {
        anchor.scrollIntoView({
          block: 'center',
        });
      }
    };
  
    return (
      <Fade in={trigger}>
        <Box
          onClick={handleClick}
          role="presentation"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
        >
          {children}
        </Box>
      </Fade>
    );
  }

function toHexNo0x(ts: number) {
  // your UI expects a hex string WITHOUT 0x prefix
  if (!ts || ts <= 0) return "0";
  return Math.floor(ts).toString(16);
}

function safeNum(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function govKey(x: any): string {
  return x?.toBase58?.() || (typeof x === "string" ? x : String(x || ""));
}

async function overlayGraphQLVoting(sortedItems: any[]) {
  const { directory, votingProposalsByGovernance } = await buildDirectoryFromGraphQL({
    includeMembers: false,
    proposalScanLimit: 5000,
  });

  const gqlByGov = new Map<string, any>();
  for (const d of directory || []) {
    const k = govKey(d?.governanceAddress);
    if (k) gqlByGov.set(k, d);
  }

  return sortedItems.map((it: any) => {
    const k = govKey(it?.governanceAddress);

    const overlay = gqlByGov.get(k);
    const votingList = (k && votingProposalsByGovernance?.[k]) ? votingProposalsByGovernance[k] : [];

    if (!overlay) {
      return {
        ...it,
        votingProposals: votingList,
        totalProposalsVoting: votingList.length || (it.totalProposalsVoting || 0),
      };
    }

    const merged: any = {
      ...it,
      votingProposals: votingList,
      totalProposalsVoting: Number.isFinite(Number(overlay.totalProposalsVoting))
        ? Number(overlay.totalProposalsVoting)
        : votingList.length || (it.totalProposalsVoting || 0),
    };

    if (overlay?.lastProposalDate && overlay.lastProposalDate !== "0") {
      merged.lastProposalDate = overlay.lastProposalDate;
    }

    return merged;
  });
}

export function GovernanceDirectoryView(props: Props) {
    const { publicKey } = useWallet();
    
    const [metadataMap, setMetadataMap] = React.useState<{ [key: string]: any }>({});

    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [loading, setLoading] = React.useState(false);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [searchFilter, setSearchFilter] = React.useState(null);
    const [governanceLastVaultValue, setGovernanceLastVaultValue] = React.useState(null);
    const [governanceLastVaultSolValue, setGovernanceLastVaultSolValue] = React.useState(null);
    const [governanceLastVaultSol, setGovernanceLastVaultSol] = React.useState(null);
    const [governanceLastVaultStableCoinValue, setGovernanceLastVaultStableCoinValue] = React.useState(null);
    const [governanceLastMembers, setGovernanceLastMembers] = React.useState(null);
    const [governanceLastProposals, setGovernanceLastProposals] = React.useState(null);
    const [gspl, setGSPL] = React.useState(null);
    
    const [governanceTotalVaultValue, setGovernanceTotalVaultValue] = React.useState(null);
    const [governanceTotalVaultSolValue, setGovernanceTotalVaultSolValue] = React.useState(null);
    const [governanceTotalVaultSol, setGovernanceTotalVaultSol] = React.useState(null);
    const [governanceTotalVaultStableCoinValue, setGovernanceTotalVaultStableCoinValue] = React.useState(null);
    const [governanceTotalMembers, setGovernanceTotalMembers] = React.useState(null);
    const [governanceTotalVotingRecordMembers, setGovernanceTotalVotingRecordMembers] = React.useState(null);
    const [governanceTotalParticipatingMultisigs, setGovernanceTotalParticipatingMultisigs] = React.useState(null);
    const [governanceTotalProposals, setGovernanceTotalProposals] = React.useState(null);
    const [sortingType, setSortingType] = React.useState(null);
    const [sortingDirection, setSortingDirection] = React.useState(null);

    const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
    const [filterVerified, setFilterVerified] = React.useState(false);
    const [filterActiveVoting, setFilterActiveVoting] = React.useState(false);
    const [filterHasTreasury, setFilterHasTreasury] = React.useState(false);

const sortGovernance = (type: number) => {
  if (!governanceLookup) return;

  let direction = sortingDirection;
  direction = direction === 0 ? 1 : 0;

  const base = Array.from(governanceLookup); // ✅ no mutation
  let sorted = base;

  if (type === 1 && direction === 0) sorted = base.sort((a: any, b: any) => (a?.totalMembers < b?.totalMembers ? 1 : -1));
  else if (type === 1 && direction === 1) sorted = base.sort((a: any, b: any) => (b?.totalMembers < a?.totalMembers ? 1 : -1));
  else if (type === 2 && direction === 0) sorted = base.sort((a: any, b: any) => (a?.totalProposals < b?.totalProposals ? 1 : -1));
  else if (type === 2 && direction === 1) sorted = base.sort((a: any, b: any) => (b?.totalProposals < a?.totalProposals ? 1 : -1));
  else if (type === 3 && direction === 0) sorted = base.sort((a: any, b: any) => (a?.totalProposalsVoting < b?.totalProposalsVoting ? 1 : -1));
  else if (type === 3 && direction === 1) sorted = base.sort((a: any, b: any) => (b?.totalProposalsVoting < a?.totalProposalsVoting ? 1 : -1));
  else if (type === 4 && direction === 0) sorted = base.sort((a: any, b: any) => (a?.totalVaultValue < b?.totalVaultValue ? 1 : -1));
  else if (type === 4 && direction === 1) sorted = base.sort((a: any, b: any) => (b?.totalVaultValue < a?.totalVaultValue ? 1 : -1));
  else if (type === 5 && direction === 0) sorted = base.sort((a: any, b: any) => (Number("0x" + a.lastProposalDate) < Number("0x" + b.lastProposalDate) ? 1 : -1));
  else if (type === 5 && direction === 1) sorted = base.sort((a: any, b: any) => (Number("0x" + b.lastProposalDate) < Number("0x" + a.lastProposalDate) ? 1 : -1));
  else if (type === 6 && direction === 0) sorted = base.sort((a: any, b: any) => (a?.totalVaultStableCoinValue < b?.totalVaultStableCoinValue ? 1 : -1));
  else if (type === 6 && direction === 1) sorted = base.sort((a: any, b: any) => (b?.totalVaultStableCoinValue < a?.totalVaultStableCoinValue ? 1 : -1));

  setSortingType(type);
  setSortingDirection(direction);
  setGovernanceLookup(sorted);
};

const filteredGovernances = React.useMemo(() => {
  if (!governanceLookup) return [];

  const q = (searchFilter || "").trim();
  const qUpper = q.replace(/\s+/g, "").toUpperCase();

  return governanceLookup.filter((item: any) => {
    if (filterVerified && !item?.gspl) return false;
    if (filterActiveVoting && !(item?.totalProposalsVoting > 0)) return false;

    const treasury = (item?.totalVaultValue || 0) + (item?.totalVaultStableCoinValue || 0);
    if (filterHasTreasury && !(treasury > 0)) return false;

    if (!q) return true;

    const nameMatch = (item?.governanceName || "").replace(/\s+/g, "").toUpperCase().includes(qUpper);
    if (nameMatch) return true;

    if (isValidSolanaPublicKey(q)) {
      return (
        (item?.governanceAddress || "").includes(q) ||
        (item?.communityMint || "").includes(q) ||
        (item?.councilMint || "").includes(q)
      );
    }

    return false;
  });
}, [governanceLookup, searchFilter, filterVerified, filterActiveVoting, filterHasTreasury]);

    function GovernanceDirectorySorting(props: any){
        
        return(
            <Box
                m={1}
                //margin
                sx={{alignItems: 'center', textAlign: 'center',p:2,borderRadius:'17px',background:'rgba(0,0,0,0.025)'}}
                >
                    
                    <Box
                        display="flex"
                        justifyContent="flex-end"
                        sx={{
                            alignItems:"right"
                        }}
                    >      
                            <ButtonGroup
                                color='inherit'
                                size='small'
                                variant='outlined'
                                sx={{borderRadius:'17px'}}
                            >
                                <Tooltip title={
                                        <>Sort by Members {sortingType === 1 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(1)}
                                    > <GroupIcon /> {sortingType === 1 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>

                                <Tooltip title={
                                        <>Sort by Proposals {sortingType === 3 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(2)}
                                    > <BallotIcon /> {sortingType === 2 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>
                                <Tooltip title={
                                        <>Sort by Currently Voting Proposals {sortingType === 2 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(3)}
                                    > <HowToVoteIcon /> {sortingType === 3 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>

                                <Tooltip title={
                                        <>Sort by Most Recent Proposals {sortingType === 2 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(5)}
                                    > <AccessTimeIcon /> {sortingType === 5 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>
                                
                                <Tooltip title={
                                        <>Sort by Treasury {sortingType === 4 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(4)}
                                    > <AccountBalanceIcon /> {sortingType === 4 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                    
                                </Tooltip>

                                <Tooltip title={
                                        <>Sort by Total Stable Coin in Treasury {sortingType === 6 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(6)}
                                    > <AttachMoneyIcon /> {sortingType === 6 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                    
                                </Tooltip>
                                
                            </ButtonGroup> 
                    </Box>
            </Box>
        );
    }
    
    const callGovernanceLookup = async() => {
        
        const gspldir = await initGrapeGovernanceDirectory();
        const fglf = await fetchGovernanceLookupFile(storagePool);
        const fgmmf = await fetchGovernanceMasterMembersFile(storagePool);

        //console.log("fglf: "+JSON.stringify(fglf));

        // pre sort
        const exportFglf = new Array();
        if (fglf && fglf.length > 0){
            
            const prepresorted = fglf.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
            const presorted = prepresorted.sort((a:any, b:any) => (b?.totalProposalsVoting < a?.totalProposalsVoting) ? 1 : -1); 
            let sorted = presorted.sort((a:any, b:any) => (a?.totalVaultValue < b?.totalVaultValue && b?.totalVaultValue > 1) ? 1 : -1);

            // go through it one more time to merge gspldir data
            for (var item of sorted){
            if (gspldir){
                for (var diritem of gspldir){
                if (item.governanceName === diritem.name){
                    item.gspl = diritem;
                    console.log("GSPL Entry found for "+item.governanceName);
                }
                }
            }
            }

            // ✅ Overlay GraphQL voting counts AFTER GSPL merge, BEFORE setGovernanceLookup
            try {
            sorted = await overlayGraphQLVoting(sorted);
            console.log("GraphQL overlay applied (voting counts)");
            } catch (e) {
            console.warn("GraphQL overlay failed; using cached voting counts", e);
            }

            setGovernanceLookup(sorted);
            
            // fetch some summary data
            let totalVaultValue = 0;
            let totalVaultSolValue = 0;
            let totalVaultSol = 0;
            let totalVaultStableCoinValue = 0;
            let totalGovernanceProposals = 0;
            let totalGovernanceMembers = 0;
            let lastVaultValue = 0;
            let lastVaultSolValue = 0;
            let lastVaultSol = 0;
            let lastVaultStableCoinValue = 0;
            let lastGovernanceProposals = 0;
            let lastGovernanceMembers = 0;
            for (let item of sorted){
                if (item?.totalVaultValue)
                    totalVaultValue += item.totalVaultValue;
                if (item?.totalVaultStableCoinValue)
                    totalVaultStableCoinValue += item.totalVaultStableCoinValue;
                if (item?.totalVaultSol){
                    totalVaultSol += item.totalVaultSol;
                }
                if (item?.totalVaultSolValue){
                    totalVaultSolValue += item.totalVaultSolValue;
                }
                totalGovernanceMembers += item.totalMembers;
                totalGovernanceProposals += item?.totalProposals ? item.totalProposals : 0;

                //console.log("item "+JSON.stringify(item));

                if (item?.lastVaultValue)
                    lastVaultValue += +item.lastVaultValue;
                if (item?.lastVaultSolValue)
                    lastVaultSolValue += +item.lastVaultSolValue;
                if (item?.lastVaultSol)
                    lastVaultSol += +item.lastVaultSol;
                if (item?.lastVaultStableCoinValue)
                    lastVaultStableCoinValue += +item.lastVaultStableCoinValue;
                if (item?.lastMembers)
                    lastGovernanceMembers += +item.lastMembers;
                if (item?.lastProposals)
                    lastGovernanceProposals += +item.lastProposals;
                
            }

            setGSPL(gspldir);

            setGovernanceLastVaultValue(lastVaultValue);
            setGovernanceLastVaultSolValue(lastVaultSolValue);
            setGovernanceLastVaultSol(lastVaultSol);
            setGovernanceLastVaultStableCoinValue(lastVaultStableCoinValue);
            setGovernanceLastMembers(lastGovernanceMembers);
            setGovernanceLastProposals(lastGovernanceProposals);

            setGovernanceTotalVaultSolValue(totalVaultSolValue);
            setGovernanceTotalVaultSol(totalVaultSol);

            setGovernanceTotalVaultValue(totalVaultValue);
            setGovernanceTotalVaultStableCoinValue(totalVaultStableCoinValue);
            setGovernanceTotalVotingRecordMembers(totalGovernanceMembers);
            setGovernanceTotalProposals(totalGovernanceProposals);

            if (fgmmf && fgmmf.length > 0)
                setGovernanceTotalMembers(fgmmf.length)
            else
                setGovernanceTotalMembers(totalGovernanceMembers)

            let multisigParticipation = 0;
            if (fgmmf){
                for (var masterMember of fgmmf){
                    //console.log("masterMember: "+JSON.stringify(masterMember))
                    if (masterMember?.multisigs?.multisigs && masterMember.multisigs.multisigs.length > 0)
                        multisigParticipation += 1;//masterMember.multisigs.length; 
                }
            }

            setGovernanceTotalParticipatingMultisigs(multisigParticipation);

            
            // export
            /*
            for (let item of sorted){
                exportFglf.push(
                    {
                        governanceAddress:item.governanceAddress,
                        governanceName:item.governanceName,
                        version:item.version,
                        timestamp:moment.unix(Number(item.timestamp)).format("YYYY-MM-DD HH:mm"),
                        filename:item.filename,
                        memberFilename:item.filename,
                        governanceTransactionsFilename:item.governanceTransactionsFilename,
                        totalMembers:item.totalMembers,
                        totalQuorum:item.totalQuorum,
                        communityTokenSupply:item.tokenSupply,
                        lastProposalDate:moment.unix(Number("0x"+item.lastProposalDate)).format("YYYY-MM-DD HH:mm"),
                        totalCouncilProposals:item.totalCouncilProposals,
                        totalProposalsVoting:item.totalProposalsVoting,
                        totalProposals:item.totalProposals,
                    }
                )
            }
            */
        }

        //console.log("exportable: "+JSON.stringify(exportFglf));
        setLoading(false);
    }


    React.useEffect(() => {
        const fetchMetadata = async () => {
            const newMetadataMap = { ...metadataMap };
            if (governanceLookup){
                await Promise.all(
                    governanceLookup.map(async (item:any) => {
                        if (item.gspl && item.gspl.metadataUri && !newMetadataMap[item.gspl.metadataUri]) {
                            try {
                                const response = await fetch(item.gspl.metadataUri);
                                if (response.ok) {
                                    const metadata = await response.json();
                                    newMetadataMap[item.gspl.metadataUri] = metadata;
                                } else {
                                    console.error("Failed to fetch metadata:", item.gspl.metadataUri);
                                }
                            } catch (error) {
                                console.error("Error fetching metadata:", error);
                            }
                        }
                    })
                );
            }
            setMetadataMap(newMetadataMap);
        };
        fetchMetadata();
    }, [governanceLookup]);

    React.useEffect(() => {
        if (!governanceLookup){
            setLoading(true);
            callGovernanceLookup();
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
                <Typography variant="caption">Loading Directory</Typography>
                
                <LinearProgress color="inherit" />
                
            </Box>
        )
    } else{
        if (governanceLookup){
            return (
<Box
  sx={{
    mt: 6,
    borderRadius: "24px",
    p: { xs: 2, md: 3 },
    background:
      "radial-gradient(1200px 600px at 20% 0%, rgba(130, 80, 255, 0.22), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(0, 200, 140, 0.18), transparent 55%), rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.08)",
    backdropFilter: "blur(10px)",
  }}
>
  {/* HERO */}
  <Grid container spacing={2} alignItems="center" id="back-to-top-anchor">
    <Grid item xs={12} md={7} sx={{ textAlign: "left" }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
          DAO Directory
        </Typography>
        <Chip
          size="small"
          icon={<VerifiedIcon />}
          label={`${gspl?.length || 0} verified`}
          variant="outlined"
          sx={{ borderRadius: "999px" }}
        />
        <Chip
          size="small"
          icon={<WhatshotIcon />}
          label="Live"
          variant="outlined"
          sx={{ borderRadius: "999px" }}
        />
      </Stack>

      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        Explore Solana SPL Governance DAOs — browse by treasury, members, proposals, and recent activity.
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} useFlexGap flexWrap="wrap">
        <Chip size="small" label={`${governanceLookup?.length || 0} active DAOs`} />
        <Chip size="small" label={`${governanceTotalMembers ? getFormattedNumberToLocale(governanceTotalMembers) : 0} unique voters`} />
        <Chip size="small" label={`${governanceTotalProposals ? getFormattedNumberToLocale(governanceTotalProposals) : 0} proposals`} />
      </Stack>
    </Grid>

    <Grid item xs={12} md={5}>
      {/* STICKY TOOLBAR */}
      <Box
        sx={{
          position: "sticky",
          top: 12,
          zIndex: 10,
          p: 1.5,
          borderRadius: "18px",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Stack spacing={1.25}>
          <TextField
            fullWidth
            size="small"
            label="Search DAOs, governance address, mint…"
            value={searchFilter || ""}
            onChange={(e) => setSearchFilter(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                icon={<VerifiedIcon />}
                label="Verified"
                color={filterVerified ? "primary" : "default"}
                variant={filterVerified ? "filled" : "outlined"}
                size="small"
                onClick={() => setFilterVerified((v) => !v)}
              />
              <Chip
                icon={<HowToVoteIcon />}
                label="Voting now"
                color={filterActiveVoting ? "primary" : "default"}
                variant={filterActiveVoting ? "filled" : "outlined"}
                size="small"
                onClick={() => setFilterActiveVoting((v) => !v)}
              />
              <Chip
                icon={<AccountBalanceIcon />}
                label="Has treasury"
                color={filterHasTreasury ? "primary" : "default"}
                variant={filterHasTreasury ? "filled" : "outlined"}
                size="small"
                onClick={() => setFilterHasTreasury((v) => !v)}
              />
            </Stack>

            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, v) => v && setViewMode(v)}
            >
              <ToggleButton value="grid">
                <ViewModuleIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>
      </Box>
    </Grid>
  </Grid>

  <Divider sx={{ my: 2, opacity: 0.15 }} />

  {/* Optional “Latest Activity” stays, but it looks better below the hero */}
  {(!searchFilter || (searchFilter && searchFilter.length <= 0)) && (
    <Box sx={{ mb: 1 }}>
      <GovernanceRealtimeInfo
        governanceLookup={governanceLookup}
        governanceAddress={"GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"}
        title={"Latest Activity"}
        expanded={true}
      />
    </Box>
  )}

  <GovernanceDirectorySorting />

  {/* LIST */}
  <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mt: 0.5 }}>
    {filteredGovernances.map((item: any, key: number) => {
      const metadata = item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : {};
      return (
        <Grid
          item
          key={item?.governanceAddress || key}
          xs={12}
          sm={viewMode === "grid" ? 6 : 12}
          md={viewMode === "grid" ? 4 : 12}
        >
          <GovernanceDirectoryCardView item={item} metadata={metadata} />
        </Grid>
      );
    })}
  </Grid>

  <ScrollTop {...props}>
    <Fab size="small" aria-label="scroll back to top">
      <KeyboardArrowUpIcon />
    </Fab>
  </ScrollTop>
</Box>
            )
        } else{
            return(
            <Box
                sx={{
                    mt:6,
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    p:4,
                    alignItems: 'center', textAlign: 'center'
                }} 
            > 
                <Grid 
                    className="grape-paper" 
                    container
                    alignContent="center"
                    justifyContent="center"
                    direction="column">
                    <Grid item>
                        <Typography 
                        align="center"
                        variant="h3">
                            Select a governance above to get started
                        </Typography>

                        <Typography 
                        align="center"
                        variant="caption">
                            NOTE:
                            <br/>
                            *Cached method will fetch Governance will load all proposals & proposal details
                            <br/>
                            *RPC method will fetch Governance via RPC calls (additional RPC calls are needed per proposal, significantly increasing the load time)
                        </Typography>
                        
                    </Grid>
                    </Grid>
            </Box>
            );

        }

    }
}