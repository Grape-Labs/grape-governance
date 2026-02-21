import React from 'react';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import { PublicKey } from '@solana/web3.js';
import { useParams } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSnackbar } from 'notistack';
import moment from 'moment';

import ExplorerView from '../utils/grapeTools/Explorer';
import { RPC_CONNECTION } from '../utils/grapeTools/constants';
import {
  getAllGovernancesIndexed,
  getAllProposalsIndexed,
  getRealmIndexed,
  getTokenOwnerRecordsByOwnerIndexed,
  getVoteRecordsByVoterIndexed,
} from './api/queries';
import GetGovernanceFromRulesView from './GetGovernanceFromRules';

import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ClearIcon from '@mui/icons-material/Clear';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import BoltIcon from '@mui/icons-material/Bolt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import GroupsIcon from '@mui/icons-material/Groups';
import DescriptionIcon from '@mui/icons-material/Description';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';

const DEFAULT_GOV_PROGRAM = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
const PROPOSAL_STATE_LABELS: Record<number, string> = {
  0: 'Draft',
  1: 'Signing Off',
  2: 'Voting',
  3: 'Succeeded',
  4: 'Executing',
  5: 'Completed',
  6: 'Cancelled',
  7: 'Defeated',
  8: 'Executing With Errors',
  9: 'Vetoed',
};

function shortenPk(pk: string, n = 4) {
  if (!pk) return '';
  if (pk.length <= n * 2 + 3) return pk;
  return `${pk.slice(0, n)}...${pk.slice(-n)}`;
}

function toNumberSafe(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    if (value.startsWith('0x')) {
      const parsedHex = parseInt(value, 16);
      return Number.isFinite(parsedHex) ? parsedHex : 0;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (typeof value?.toNumber === 'function') {
    try {
      return value.toNumber();
    } catch {
      return 0;
    }
  }

  if (typeof value?.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatLocalNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

function getProposalBucket(state: number): 'passed' | 'defeated' | 'vetoed' | 'cancelled' | 'active' | 'draft' | 'other' {
  if (state === 3 || state === 5) return 'passed';
  if (state === 7) return 'defeated';
  if (state === 9) return 'vetoed';
  if (state === 6) return 'cancelled';
  if (state === 0) return 'draft';
  if (state === 1 || state === 2 || state === 4) return 'active';
  return 'other';
}

function getVoteSideFromRecord(record: any): 'yes' | 'no' | 'abstain' | 'veto' | 'unknown' {
  const voteType = record?.account?.vote?.voteType;
  if (voteType !== undefined && voteType !== null) {
    const normalized = Number(voteType);
    if (normalized === 0) return 'yes';
    if (normalized === 1) return 'no';
    if (normalized === 2) return 'abstain';
    if (normalized === 3) return 'veto';
  }

  const legacyYes = toNumberSafe(record?.account?.voteWeight?.yes);
  const legacyNo = toNumberSafe(record?.account?.voteWeight?.no);
  if (legacyYes > 0) return 'yes';
  if (legacyNo > 0) return 'no';
  return 'unknown';
}

function getVoteWeightFromRecord(record: any): number {
  const voterWeight = toNumberSafe(record?.account?.voterWeight);
  if (voterWeight > 0) return voterWeight;
  const legacyYes = toNumberSafe(record?.account?.voteWeight?.yes);
  const legacyNo = toNumberSafe(record?.account?.voteWeight?.no);
  return Math.max(legacyYes, legacyNo, 0);
}

function voteSideLabel(side: 'yes' | 'no' | 'abstain' | 'veto' | 'unknown'): string {
  if (side === 'yes') return 'Yes';
  if (side === 'no') return 'No';
  if (side === 'abstain') return 'Abstain';
  if (side === 'veto') return 'Veto';
  return 'Unknown';
}

function getMemberType(realm: any, governingMint: string): 'council' | 'community' | 'unknown' {
  const communityMint =
    realm?.account?.communityMint?.toBase58?.() ||
    realm?.account?.communityMint ||
    realm?.account?.config?.communityMint?.toBase58?.() ||
    realm?.account?.config?.communityMint ||
    null;

  const councilMint =
    realm?.account?.config?.councilMint?.toBase58?.() ||
    realm?.account?.config?.councilMint ||
    realm?.account?.councilMint?.toBase58?.() ||
    realm?.account?.councilMint ||
    null;

  if (councilMint && governingMint === councilMint) return 'council';
  if (communityMint && governingMint === communityMint) return 'community';
  return 'unknown';
}

function getRealmName(realm: any, fallbackRealmPk: string): string {
  return realm?.account?.name || fallbackRealmPk;
}

const InsightCard = ({
  label,
  value,
  sublabel,
  icon,
  loading,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  loading: boolean;
}) => {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 3,
        height: '100%',
        borderColor: 'divider',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          sx={{
            width: 34,
            height: 34,
            bgcolor: 'rgba(255,255,255,0.08)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {icon}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            {label}
          </Typography>
          {loading ? (
            <Skeleton width={120} />
          ) : (
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              {value}
            </Typography>
          )}
          {sublabel ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {sublabel}
            </Typography>
          ) : null}
        </Box>
      </Stack>
    </Paper>
  );
};

export function MyGovernanceView(props: any) {
  const { walletAddress } = useParams();
  const initialWallet = walletAddress || props?.walletAddress || props?.pubkey || '';
  const [pubkey, setPubkey] = React.useState(initialWallet);
  const [governanceRecordRows, setGovernanceRecordRows] = React.useState<any[]>([]);
  const [tokenOwnerRecords, setTokenOwnerRecords] = React.useState<any[]>([]);
  const [createdProposals, setCreatedProposals] = React.useState<any[]>([]);
  const [voteHistoryRows, setVoteHistoryRows] = React.useState<any[]>([]);
  const [loadingGovernance, setLoadingGovernance] = React.useState(false);
  const [refresh, setRefresh] = React.useState(true);
  const [tab, setTab] = React.useState<0 | 1 | 2>(0);
  const [touched, setTouched] = React.useState(false);

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const isValidPubkey = React.useMemo(() => {
    if (!pubkey) return false;
    try {
      new PublicKey(pubkey);
      return true;
    } catch {
      return false;
    }
  }, [pubkey]);

  const canLoad = Boolean(pubkey && isValidPubkey && !loadingGovernance);

  const shareUrl = React.useMemo(() => {
    if (!pubkey) return '';
    return `${window.location.origin}/profile/${pubkey}`;
  }, [pubkey]);

  const loadNow = React.useCallback(() => {
    if (!isValidPubkey) {
      enqueueSnackbar('Invalid wallet address', { variant: 'warning' });
      return;
    }
    setRefresh(true);
  }, [enqueueSnackbar, isValidPubkey]);

  const pasteFromClipboard = React.useCallback(async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (value) {
        setPubkey(value.trim());
        setTouched(true);
      }
    } catch {
      enqueueSnackbar('Clipboard access denied', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const buildParticipationRows = React.useCallback(async (ownerRecords: any[]) => {
    if (!ownerRecords?.length) return [];

    const mintPubkeys = ownerRecords
      .map((record) => {
        try {
          return new PublicKey(record.account.governingTokenMint);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as PublicKey[];

    const realmPks = Array.from(
      new Set(
        ownerRecords
          .map((record) => {
            try {
              return new PublicKey(record.account.realm).toBase58();
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[]
      )
    );

    const [mintAccounts, realms] = await Promise.all([
      mintPubkeys.length > 0 ? RPC_CONNECTION.getMultipleParsedAccounts(mintPubkeys) : null,
      Promise.all(realmPks.map((realmPk) => getRealmIndexed(realmPk, DEFAULT_GOV_PROGRAM))),
    ]);

    const mintDecimalsByMint = new Map<string, number>();
    if (mintAccounts?.value?.length) {
      for (let i = 0; i < mintPubkeys.length; i++) {
        const mintPk = mintPubkeys[i].toBase58();
        const decimals = mintAccounts?.value?.[i]?.data?.parsed?.info?.decimals ?? 0;
        mintDecimalsByMint.set(mintPk, Number(decimals));
      }
    }

    const realmByPk = new Map<string, any>();
    realms.forEach((realm, idx) => {
      realmByPk.set(realmPks[idx], realm);
    });

    const rows = ownerRecords.map((record, index) => {
      const realmPk = new PublicKey(record.account.realm).toBase58();
      const realm = realmByPk.get(realmPk);

      const governingMint = new PublicKey(record.account.governingTokenMint).toBase58();
      const decimals = mintDecimalsByMint.get(governingMint) ?? 0;

      const baseUnits = toNumberSafe(record.account.governingTokenDepositAmount);
      const uiVotes = baseUnits / Math.pow(10, decimals);

      const delegate = record.account?.governanceDelegate
        ? new PublicKey(record.account.governanceDelegate).toBase58()
        : null;

      return {
        id: `${realmPk}-${governingMint}-${index}`,
        realmPk,
        governance: getRealmName(realm, realmPk),
        memberType: getMemberType(realm, governingMint),
        governingTokenMint: governingMint,
        governingMintDecimals: decimals,
        governingTokenDepositAmountRaw: uiVotes,
        governingTokenDepositAmount: formatLocalNumber(uiVotes, 3),
        unrelinquishedVotesCount: toNumberSafe(record.account?.unrelinquishedVotesCount),
        outstandingProposalCount: toNumberSafe(record.account?.outstandingProposalCount),
        governanceDelegate: delegate,
        details: realmPk,
      };
    });

    rows.sort((a, b) => b.governingTokenDepositAmountRaw - a.governingTokenDepositAmountRaw);
    return rows;
  }, []);

  const buildRealmProposalSet = React.useCallback(async (ownerRecords: any[]) => {
    const proposalByPk = new Map<string, any>();
    if (!ownerRecords?.length) {
      return {
        proposalByPk,
        allProposals: [] as any[],
      };
    }

    const realmPubkeys = new Set<string>();
    for (const record of ownerRecords) {
      try {
        realmPubkeys.add(new PublicKey(record.account?.realm).toBase58());
      } catch {
        // ignore malformed record
      }
    }

    const realmQueries = Array.from(realmPubkeys).map(async (realmPk) => {
      const realmGovernances = await getAllGovernancesIndexed(realmPk, DEFAULT_GOV_PROGRAM);
      const governancePubkeys = realmGovernances
        .map((item) => item?.pubkey?.toBase58?.())
        .filter(Boolean) as string[];

      if (!governancePubkeys.length) return [];
      return getAllProposalsIndexed(governancePubkeys, DEFAULT_GOV_PROGRAM, realmPk);
    });

    const realmProposalBatches = await Promise.all(realmQueries);
    for (const batch of realmProposalBatches) {
      (batch || []).forEach((proposal) => {
        const proposalPk = proposal?.pubkey?.toBase58?.();
        if (!proposalPk) return;
        proposalByPk.set(proposalPk, proposal);
      });
    }

    return {
      proposalByPk,
      allProposals: Array.from(proposalByPk.values()),
    };
  }, []);

  const buildCreatedProposals = React.useCallback(async (ownerRecords: any[], allProposals: any[]) => {
    if (!ownerRecords?.length || !allProposals?.length) return [];

    const torPubkeySet = new Set<string>();
    for (const record of ownerRecords) {
      try {
        torPubkeySet.add(new PublicKey(record.pubkey).toBase58());
      } catch {
        // ignore malformed record
      }
    }

    const authored = allProposals.filter((proposal) => {
      const tor = proposal?.account?.tokenOwnerRecord?.toBase58?.();
      return tor ? torPubkeySet.has(tor) : false;
    });

    authored.sort((a, b) => toNumberSafe(b?.account?.draftAt) - toNumberSafe(a?.account?.draftAt));
    return authored;
  }, []);

  const buildVoteHistoryRows = React.useCallback(
    async (walletPk: string, allProposals: any[], participationRows: any[]) => {
      if (!walletPk) return [];

      const allVotes = (await getVoteRecordsByVoterIndexed(DEFAULT_GOV_PROGRAM, '', walletPk)) || [];
      if (!Array.isArray(allVotes) || allVotes.length === 0) return [];

      const proposalByPk = new Map<string, any>();
      allProposals.forEach((proposal) => {
        const proposalPk = proposal?.pubkey?.toBase58?.();
        if (proposalPk) proposalByPk.set(proposalPk, proposal);
      });

      const decimalsByMint = new Map<string, number>();
      participationRows.forEach((row) => {
        if (row?.governingTokenMint) {
          decimalsByMint.set(row.governingTokenMint, Number(row?.governingMintDecimals ?? 0));
        }
      });

      const seenVoteRecords = new Set<string>();
      const rows: any[] = [];

      for (const voteRecord of allVotes) {
        const votePk = voteRecord?.pubkey?.toBase58?.();
        if (votePk && seenVoteRecords.has(votePk)) continue;
        if (votePk) seenVoteRecords.add(votePk);

        const proposalPk = voteRecord?.account?.proposal?.toBase58?.();
        if (!proposalPk) continue;

        const proposal = proposalByPk.get(proposalPk);
        const proposalMint = proposal?.account?.governingTokenMint?.toBase58?.();
        const mintDecimals = proposalMint ? decimalsByMint.get(proposalMint) : undefined;

        const rawWeight = getVoteWeightFromRecord(voteRecord);
        const voteWeightUi =
          mintDecimals !== undefined ? rawWeight / Math.pow(10, Math.max(0, mintDecimals)) : rawWeight;

        const voteSide = getVoteSideFromRecord(voteRecord);
        const proposalStateRaw = proposal?.account?.state;
        const proposalState =
          proposalStateRaw === undefined || proposalStateRaw === null ? -1 : toNumberSafe(proposalStateRaw);
        const draftAt = toNumberSafe(proposal?.account?.draftAt);
        const votingAt = toNumberSafe(proposal?.account?.votingAt);
        const completedAt = toNumberSafe(proposal?.account?.votingCompletedAt);
        const activityTs = completedAt || votingAt || draftAt || 0;

        rows.push({
          id: votePk || `${proposalPk}-${rows.length}`,
          proposalPk,
          proposalTitle: proposal?.account?.name || shortenPk(proposalPk, 6),
          proposalState,
          proposalStateLabel: PROPOSAL_STATE_LABELS[proposalState] || 'Unknown',
          governancePk: proposal?.account?.governance?.toBase58?.() || null,
          voteSide,
          voteSideLabel: voteSideLabel(voteSide),
          voteWeightRaw: rawWeight,
          voteWeightUi,
          voteWeightDisplay: formatLocalNumber(voteWeightUi, 3),
          castedAtTs: activityTs,
          castedAtLabel: activityTs > 0 ? moment.unix(activityTs).fromNow() : 'n/a',
          isRelinquished: voteRecord?.account?.isRelinquished === true,
        });
      }

      rows.sort((a, b) => b.castedAtTs - a.castedAtTs);
      return rows;
    },
    []
  );

  const fetchProfileData = React.useCallback(async () => {
    if (!pubkey || !isValidPubkey) return;

    setLoadingGovernance(true);
    try {
      const ownerRecords =
        (await getTokenOwnerRecordsByOwnerIndexed(
          undefined,
          DEFAULT_GOV_PROGRAM,
          new PublicKey(pubkey).toBase58()
        )) || [];

      const rows = await buildParticipationRows(ownerRecords);
      const { allProposals } = await buildRealmProposalSet(ownerRecords);
      const [authoredProposals, votesCastRows] = await Promise.all([
        buildCreatedProposals(ownerRecords, allProposals),
        buildVoteHistoryRows(pubkey, allProposals, rows),
      ]);

      setTokenOwnerRecords(ownerRecords);
      setGovernanceRecordRows(rows);
      setCreatedProposals(authoredProposals);
      setVoteHistoryRows(votesCastRows);
    } catch (error) {
      console.error('Profile load failed', error);
      enqueueSnackbar('Error loading profile activity', { variant: 'error' });
      setTokenOwnerRecords([]);
      setGovernanceRecordRows([]);
      setCreatedProposals([]);
      setVoteHistoryRows([]);
    } finally {
      setLoadingGovernance(false);
      setRefresh(false);
    }
  }, [
    buildCreatedProposals,
    buildParticipationRows,
    buildRealmProposalSet,
    buildVoteHistoryRows,
    enqueueSnackbar,
    isValidPubkey,
    pubkey,
  ]);

  React.useEffect(() => {
    if (refresh && isValidPubkey) fetchProfileData();
  }, [fetchProfileData, isValidPubkey, refresh]);

  React.useEffect(() => {
    if (walletAddress && walletAddress !== pubkey) {
      setPubkey(walletAddress);
      setTouched(false);
      setRefresh(true);
    }
  }, [pubkey, walletAddress]);

  React.useEffect(() => {
    if (!pubkey && publicKey) {
      setPubkey(publicKey.toBase58());
      setRefresh(true);
    }
  }, [publicKey, pubkey]);

  const profileInsights = React.useMemo(() => {
    const daoCount = governanceRecordRows.length;
    const councilCount = governanceRecordRows.filter((row) => row.memberType === 'council').length;
    const communityCount = governanceRecordRows.filter((row) => row.memberType === 'community').length;

    const totalDeposited = governanceRecordRows.reduce(
      (sum, row) => sum + toNumberSafe(row.governingTokenDepositAmountRaw),
      0
    );

    const totalUnrelinquished = tokenOwnerRecords.reduce(
      (sum, record) => sum + toNumberSafe(record?.account?.unrelinquishedVotesCount),
      0
    );

    const totalOutstanding = tokenOwnerRecords.reduce(
      (sum, record) => sum + toNumberSafe(record?.account?.outstandingProposalCount),
      0
    );

    const delegateTargets = new Set<string>();
    let delegatedRecords = 0;

    tokenOwnerRecords.forEach((record) => {
      const delegatePk = record?.account?.governanceDelegate?.toBase58?.();
      if (delegatePk && delegatePk !== pubkey) {
        delegatedRecords += 1;
        delegateTargets.add(delegatePk);
      }
    });

    const largestPosition = governanceRecordRows[0];

    return {
      daoCount,
      councilCount,
      communityCount,
      totalDeposited,
      totalUnrelinquished,
      totalOutstanding,
      delegatedRecords,
      uniqueDelegateTargets: delegateTargets.size,
      largestPosition,
    };
  }, [governanceRecordRows, pubkey, tokenOwnerRecords]);

  const proposalInsights = React.useMemo(() => {
    const stats = {
      total: createdProposals.length,
      draft: 0,
      active: 0,
      passed: 0,
      defeated: 0,
      vetoed: 0,
      cancelled: 0,
      firstProposalAt: 0,
      lastProposalAt: 0,
      successRate: null as number | null,
    };

    const draftTimestamps: number[] = [];

    createdProposals.forEach((proposal) => {
      const state = toNumberSafe(proposal?.account?.state);
      const bucket = getProposalBucket(state);
      if (bucket === 'draft') stats.draft += 1;
      if (bucket === 'active') stats.active += 1;
      if (bucket === 'passed') stats.passed += 1;
      if (bucket === 'defeated') stats.defeated += 1;
      if (bucket === 'vetoed') stats.vetoed += 1;
      if (bucket === 'cancelled') stats.cancelled += 1;

      const draftAt = toNumberSafe(proposal?.account?.draftAt);
      if (draftAt > 0) draftTimestamps.push(draftAt);
    });

    if (draftTimestamps.length) {
      stats.firstProposalAt = Math.min(...draftTimestamps);
      stats.lastProposalAt = Math.max(...draftTimestamps);
    }

    const closed = stats.passed + stats.defeated + stats.vetoed + stats.cancelled;
    stats.successRate = closed > 0 ? (stats.passed / closed) * 100 : null;

    return stats;
  }, [createdProposals]);

  const voteInsights = React.useMemo(() => {
    const stats = {
      total: voteHistoryRows.length,
      yes: 0,
      no: 0,
      abstain: 0,
      veto: 0,
      unknown: 0,
      uniqueProposals: new Set<string>(),
    };

    voteHistoryRows.forEach((row) => {
      stats.uniqueProposals.add(row.proposalPk);
      if (row.voteSide === 'yes') stats.yes += 1;
      else if (row.voteSide === 'no') stats.no += 1;
      else if (row.voteSide === 'abstain') stats.abstain += 1;
      else if (row.voteSide === 'veto') stats.veto += 1;
      else stats.unknown += 1;
    });

    return {
      total: stats.total,
      yes: stats.yes,
      no: stats.no,
      abstain: stats.abstain,
      veto: stats.veto,
      unknown: stats.unknown,
      uniqueProposals: stats.uniqueProposals.size,
    };
  }, [voteHistoryRows]);

  const voteHistoryColumns = React.useMemo<GridColDef[]>(() => {
    return [
      {
        field: 'proposalTitle',
        headerName: 'Proposal',
        minWidth: 260,
        flex: 1,
      },
      {
        field: 'voteSideLabel',
        headerName: 'Vote',
        minWidth: 120,
        renderCell: (params) => {
          const side = params.row?.voteSide as 'yes' | 'no' | 'abstain' | 'veto' | 'unknown';
          const color =
            side === 'yes'
              ? 'success'
              : side === 'no' || side === 'veto'
              ? 'error'
              : side === 'abstain'
              ? 'warning'
              : 'default';
          return <Chip size="small" color={color as any} variant="outlined" label={params.value} />;
        },
      },
      {
        field: 'voteWeightDisplay',
        headerName: 'Weight',
        minWidth: 130,
      },
      {
        field: 'proposalStateLabel',
        headerName: 'Proposal State',
        minWidth: 160,
      },
      {
        field: 'castedAtLabel',
        headerName: 'Activity',
        minWidth: 130,
      },
      {
        field: 'proposalPk',
        headerName: 'Proposal',
        minWidth: 180,
        renderCell: (params) => (
          <ExplorerView
            address={params.value}
            type="address"
            shorten={4}
            style="text"
            color="white"
            fontSize="13px"
          />
        ),
      },
    ];
  }, []);

  const governanceColumns = React.useMemo<GridColDef[]>(() => {
    return [
      {
        field: 'governance',
        headerName: 'DAO / Realm',
        minWidth: 220,
        flex: 1,
      },
      {
        field: 'memberType',
        headerName: 'Role',
        minWidth: 130,
        renderCell: (params) => {
          const role = params.value as 'council' | 'community' | 'unknown';
          if (role === 'council') return <Chip size="small" label="Council" color="warning" variant="outlined" />;
          if (role === 'community') return <Chip size="small" label="Community" color="success" variant="outlined" />;
          return <Chip size="small" label="Unknown" variant="outlined" />;
        },
      },
      {
        field: 'governingTokenDepositAmount',
        headerName: 'Deposited Votes',
        minWidth: 150,
      },
      {
        field: 'unrelinquishedVotesCount',
        headerName: 'Unrelinquished',
        minWidth: 140,
      },
      {
        field: 'outstandingProposalCount',
        headerName: 'Outstanding',
        minWidth: 130,
      },
      {
        field: 'governanceDelegate',
        headerName: 'Delegate',
        minWidth: 170,
        renderCell: (params) => {
          const delegate = params.value as string | null;
          if (!delegate) return <Typography variant="caption" color="text.secondary">None</Typography>;
          if (delegate === pubkey) return <Chip size="small" label="Self" variant="outlined" />;
          return (
            <ExplorerView
              address={delegate}
              type="address"
              shorten={4}
              style="text"
              color="white"
              fontSize="13px"
            />
          );
        },
      },
      {
        field: 'details',
        headerName: '',
        minWidth: 120,
        sortable: false,
        renderCell: (params) => (
          <Button variant="contained" color="info" href={`/dao/${params.value}`} sx={{ borderRadius: '17px' }}>
            View
          </Button>
        ),
      },
    ];
  }, [pubkey]);

  return (
    <Box sx={{ mt: 4 }}>
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0))',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                  }}
                >
                  <AccountCircleIcon />
                </Avatar>

                <Box>
                  <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                    Profile
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {!pubkey
                      ? 'Enter a wallet to load activity'
                      : !isValidPubkey
                      ? 'Invalid wallet address'
                      : shortenPk(pubkey, 6)}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Tooltip title="Open in explorer">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!pubkey}
                      onClick={() => {
                        if (!pubkey) return;
                        window.open(`https://solscan.io/account/${pubkey}`, '_blank');
                      }}
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Copy profile link">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!pubkey}
                      onClick={() => {
                        if (!shareUrl) return;
                        navigator.clipboard
                          .writeText(shareUrl)
                          .then(() => enqueueSnackbar('Link copied to clipboard!', { variant: 'success' }))
                          .catch(() => enqueueSnackbar('Failed to copy link.', { variant: 'error' }));
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Reload">
                  <IconButton size="small" onClick={() => setRefresh(true)} disabled={!pubkey || loadingGovernance}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <Box
              sx={{
                p: 1.5,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'rgba(255,255,255,0.02)',
              }}
            >
              <Grid container spacing={1.25} alignItems="center">
                <Grid item xs={12} md>
                  <TextField
                    fullWidth
                    value={pubkey}
                    placeholder="Paste wallet address (Solana public key)"
                    onChange={(e) => {
                      setPubkey(e.target.value.trim());
                      setTouched(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadNow();
                    }}
                    error={touched && !!pubkey && !isValidPubkey}
                    helperText={
                      touched && !!pubkey && !isValidPubkey
                        ? "That doesn't look like a valid Solana public key."
                        : 'Tip: press Enter to load'
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <WalletIcon fontSize="small" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Tooltip title="Paste">
                              <IconButton size="small" onClick={pasteFromClipboard}>
                                <ContentPasteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            <Tooltip title="Clear">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={!pubkey}
                                  onClick={() => {
                                    setPubkey('');
                                    setTouched(true);
                                    setRefresh(false);
                                  }}
                                >
                                  <ClearIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 999,
                      },
                    }}
                  />
                </Grid>

                <Grid item xs={12} md="auto">
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                      variant="outlined"
                      disabled={!publicKey || loadingGovernance}
                      onClick={() => {
                        setPubkey(publicKey?.toBase58() || '');
                        setTouched(true);
                        setRefresh(true);
                      }}
                      sx={{ borderRadius: 999, whiteSpace: 'nowrap' }}
                    >
                      Use My Wallet
                    </Button>

                    <Button
                      variant="contained"
                      onClick={loadNow}
                      disabled={!canLoad}
                      startIcon={!loadingGovernance ? <BoltIcon /> : undefined}
                      sx={{ borderRadius: 999, minWidth: 140, whiteSpace: 'nowrap' }}
                    >
                      {loadingGovernance ? 'Loading...' : 'Load'}
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            {isValidPubkey && pubkey ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 1.25,
                  borderRadius: 3,
                  borderColor: 'divider',
                  backgroundColor: 'rgba(255,255,255,0.015)',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Chip size="small" variant="outlined" label={`Wallet: ${shortenPk(pubkey, 8)}`} />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      proposalInsights.lastProposalAt > 0
                        ? `Last proposal: ${moment.unix(proposalInsights.lastProposalAt).fromNow()}`
                        : 'Last proposal: n/a'
                    }
                  />
                  <Chip
                    size="small"
                    variant="outlined"
                    label={
                      profileInsights.largestPosition
                        ? `Largest position: ${profileInsights.largestPosition.governance} (${formatLocalNumber(
                            toNumberSafe(profileInsights.largestPosition.governingTokenDepositAmountRaw),
                            3
                          )})`
                        : 'Largest position: n/a'
                    }
                  />
                </Stack>
              </Paper>
            ) : null}

            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="DAO Participation"
                  value={profileInsights.daoCount}
                  sublabel={`${profileInsights.communityCount} community / ${profileInsights.councilCount} council`}
                  icon={<GroupsIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>

              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="Deposited Vote Power"
                  value={formatLocalNumber(profileInsights.totalDeposited, 2)}
                  sublabel="Sum of current token-owner deposits"
                  icon={<HowToVoteIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>

              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="Authored Proposals"
                  value={proposalInsights.total}
                  sublabel={`${proposalInsights.active} active, ${proposalInsights.draft} draft`}
                  icon={<DescriptionIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>

              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="Votes Casted"
                  value={voteInsights.total}
                  sublabel={`Y ${voteInsights.yes} / N ${voteInsights.no} / A ${voteInsights.abstain} on ${voteInsights.uniqueProposals} proposals`}
                  icon={<HowToVoteIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>

              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="Author Outcomes"
                  value={`P ${proposalInsights.passed} / D ${proposalInsights.defeated} / V ${proposalInsights.vetoed}`}
                  sublabel={`${proposalInsights.cancelled} cancelled`}
                  icon={<CheckCircleOutlineIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>

              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="Author Success Rate"
                  value={proposalInsights.successRate === null ? 'n/a' : `${proposalInsights.successRate.toFixed(1)}%`}
                  sublabel="Based on finalized proposals only"
                  icon={<TimelineIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>

              <Grid item xs={12} sm={6} lg={4}>
                <InsightCard
                  label="Delegation & Commitments"
                  value={`${profileInsights.delegatedRecords} delegated / ${profileInsights.uniqueDelegateTargets} delegate targets`}
                  sublabel={`Unrelinquished: ${profileInsights.totalUnrelinquished} | Outstanding: ${profileInsights.totalOutstanding}`}
                  icon={<ShieldOutlinedIcon fontSize="small" />}
                  loading={loadingGovernance}
                />
              </Grid>
            </Grid>
          </Stack>
        </CardContent>

        <Box sx={{ px: { xs: 1, md: 2 }, borderTop: '1px solid', borderColor: 'divider' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ minHeight: 48 }}>
            <Tab label={`Participation (${profileInsights.daoCount})`} sx={{ minHeight: 48 }} />
            <Tab label={`Created Proposals (${proposalInsights.total})`} sx={{ minHeight: 48 }} />
            <Tab label={`Votes Casted (${voteInsights.total})`} sx={{ minHeight: 48 }} />
          </Tabs>
        </Box>
      </Card>

      <Box sx={{ mt: 2 }}>
        {loadingGovernance ? <LinearProgress sx={{ borderRadius: 99, mb: 2 }} /> : null}

        {tab === 0 ? (
          <Card
            elevation={0}
            sx={{
              mt: 2,
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                DAO Participation Details
              </Typography>

              <DataGrid
                rows={governanceRecordRows}
                columns={governanceColumns}
                autoHeight
                pageSizeOptions={[10, 25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 300 },
                  },
                }}
                sx={{
                  border: 0,
                  '& .MuiDataGrid-columnHeaders': {
                    borderRadius: 2,
                  },
                  '& .MuiDataGrid-row': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-cell': {
                    borderBottom: 'none',
                  },
                  '& .MuiDataGrid-virtualScroller': {
                    borderRadius: 2,
                  },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-row:nth-of-type(odd)': {
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  },
                }}
              />

              {!loadingGovernance && profileInsights.daoCount === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No DAO participation found for this wallet.
                  </Typography>
                </Box>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {tab === 1 ? (
          <Card
            elevation={0}
            sx={{
              mt: 2,
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="h6">Created Proposals</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={`Passed: ${proposalInsights.passed}`} color="success" />
                  <Chip size="small" variant="outlined" label={`Defeated: ${proposalInsights.defeated}`} color="error" />
                  <Chip size="small" variant="outlined" label={`Vetoed: ${proposalInsights.vetoed}`} color="warning" />
                  {proposalInsights.lastProposalAt > 0 ? (
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<WarningAmberIcon fontSize="small" />}
                      label={`Most recent: ${moment.unix(proposalInsights.lastProposalAt).format('MMM D, YYYY')}`}
                    />
                  ) : null}
                </Stack>
              </Stack>

              {loadingGovernance ? (
                <Stack spacing={2}>
                  <Skeleton height={64} />
                  <Skeleton height={64} />
                  <Skeleton height={64} />
                </Stack>
              ) : createdProposals.length > 0 ? (
                <Stack spacing={2}>
                  {createdProposals.map((proposal, idx) => (
                    <GetGovernanceFromRulesView
                      key={proposal?.pubkey?.toBase58?.() || idx}
                      rulesWallet={proposal.account.governance?.toBase58()}
                      proposal={proposal.pubkey.toBase58()}
                      name={proposal.account.name}
                      description={proposal.account.descriptionLink}
                      draftAt={proposal.account.draftAt}
                      item={proposal}
                      state={proposal.account.state}
                    />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No proposals created by this wallet (based on token owner records).
                </Typography>
              )}
            </CardContent>
          </Card>
        ) : null}

        {tab === 2 ? (
          <Card
            elevation={0}
            sx={{
              mt: 2,
              borderRadius: 4,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="h6">Vote Cast History</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" variant="outlined" label={`Yes: ${voteInsights.yes}`} color="success" />
                  <Chip size="small" variant="outlined" label={`No: ${voteInsights.no}`} color="error" />
                  <Chip size="small" variant="outlined" label={`Abstain: ${voteInsights.abstain}`} color="warning" />
                  <Chip size="small" variant="outlined" label={`Unique Proposals: ${voteInsights.uniqueProposals}`} />
                </Stack>
              </Stack>

              <DataGrid
                rows={voteHistoryRows}
                columns={voteHistoryColumns}
                autoHeight
                pageSizeOptions={[10, 25, 50]}
                initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                  toolbar: {
                    showQuickFilter: true,
                    quickFilterProps: { debounceMs: 300 },
                  },
                }}
                sx={{
                  border: 0,
                  '& .MuiDataGrid-columnHeaders': {
                    borderRadius: 2,
                  },
                  '& .MuiDataGrid-row': {
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-cell': {
                    borderBottom: 'none',
                  },
                  '& .MuiDataGrid-footerContainer': {
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  },
                  '& .MuiDataGrid-row:nth-of-type(odd)': {
                    backgroundColor: 'rgba(255,255,255,0.02)',
                  },
                }}
              />

              {!loadingGovernance && voteHistoryRows.length === 0 ? (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No vote history found for this wallet.
                  </Typography>
                </Box>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </Box>
    </Box>
  );
}
