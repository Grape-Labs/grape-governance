import React from 'react';

import {
  Box,
  Button,
  Chip,
  Divider,
  Fab,
  Fade,
  Grid,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useScrollTrigger,
} from '@mui/material/';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import VerifiedIcon from '@mui/icons-material/Verified';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernanceDirectoryCardView from './GovernanceDirectoryCardView';
import CreateSplGovernanceDaoButton from './CreateNewDAO/CreateSplGovernanceDaoButton';

import { initGrapeGovernanceDirectory } from './api/gspl_queries';
import { fetchMythicRealmMetadata, mergeDaoMetadata } from './api/realmMetadata';
import {
  getAllGovernancesFromAllPrograms,
  getRealmIndexed,
  getRealmsIndexed,
  govOwners,
  getTokenOwnerRecordsByOwnerAcrossProgramsIndexed,
} from './api/queries';
import {
  fetchGovernanceLookupFile,
  fetchGovernanceMasterMembersFile,
} from './CachedStorageHelpers';

import { GGAPI_STORAGE_POOL } from '../utils/grapeTools/constants';
import { getFormattedNumberToLocale } from '../utils/grapeTools/helpers';

interface Props {
  window?: () => Window;
  children?: React.ReactElement;
}

const DEFAULT_GOVERNANCE_PROGRAM_NAME = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

type GovernanceLookupItem = {
  governanceAddress: string;
  governanceName: string;
  communityMint?: string;
  councilMint?: string;
  totalMembers: number;
  totalProposals: number;
  totalCommunityProposals?: number;
  totalCouncilProposals?: number;
  totalProposalsVoting: number;
  totalVaultValue: number;
  totalVaultStableCoinValue: number;
  totalVaultSol: number;
  totalVaultSolValue: number;
  lastProposalDate: string;
  votingProposals?: any[];
  gspl?: any;
  [key: string]: any;
};

function toNumeric(value: any, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function governanceKey(value: any): string {
  if (value?.toBase58?.()) return value.toBase58();
  if (typeof value === 'string') return value;
  if (value?.pubkey?.toBase58?.()) return value.pubkey.toBase58();
  if (typeof value?.pubkey === 'string') return value.pubkey;
  return String(value || '');
}

function governanceRealmKey(item: any): string {
  return governanceKey(
    item?.realm || item?.governance?.account?.realm || item?.governance?.realm || item?.governanceAddress
  );
}

function normalizeName(value: any): string {
  return String(value || '').trim();
}

function normalizeSearchText(value: any): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function hasNamedGovernance(governanceName: string, governanceAddress?: string): boolean {
  const name = normalizeName(governanceName);
  if (!name) return false;
  if (name.toLowerCase() === 'governance') return false;

  if (governanceAddress) {
    const fallbackLabel = `Governance ${governanceAddress.slice(0, 6)}...`;
    if (name === fallbackLabel) return false;
  }

  return true;
}

function isValidSolanaPublicKey(publicKeyString: string): boolean {
  if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
    return false;
  }

  const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  const looksValid = solanaPublicKeyRegex.test(publicKeyString);

  if (!looksValid) {
    return false;
  }

  try {
    return !!new PublicKey(publicKeyString);
  } catch (_e) {
    return false;
  }
}

function ScrollTop(props: Props) {
  const { children, window } = props;

  const trigger = useScrollTrigger({
    target: window ? window() : undefined,
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = ((event.target as HTMLDivElement).ownerDocument || document).querySelector(
      '#back-to-top-anchor'
    );

    if (anchor) {
      anchor.scrollIntoView({ block: 'center' });
    }
  };

  return (
    <Fade in={trigger}>
      <Box onClick={handleClick} role="presentation" sx={{ position: 'fixed', bottom: 16, right: 16 }}>
        {children}
      </Box>
    </Fade>
  );
}

export function GovernanceDirectoryView(props: Props) {
  const { publicKey } = useWallet();
  const [metadataMap, setMetadataMap] = React.useState<{ [key: string]: any }>({});
  const [mythicMetadataMap, setMythicMetadataMap] = React.useState<{ [key: string]: any }>({});
  const [governanceLookup, setGovernanceLookup] = React.useState<GovernanceLookupItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [searchFilter, setSearchFilter] = React.useState('');
  const [showActivity, setShowActivity] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [filterVerified, setFilterVerified] = React.useState(false);
  const [filterActiveVoting, setFilterActiveVoting] = React.useState(false);
  const [filterOver100Proposals, setFilterOver100Proposals] = React.useState(false);

  const [visibleCount, setVisibleCount] = React.useState(12);

  const [gspl, setGSPL] = React.useState<any[]>([]);
  const [governanceTotalMembers, setGovernanceTotalMembers] = React.useState(0);
  const [governanceTotalProposals, setGovernanceTotalProposals] = React.useState(0);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncSource, setSyncSource] = React.useState<'graphql' | 'cache' | 'mixed'>('graphql');
  const [favoriteRealmVoteTotals, setFavoriteRealmVoteTotals] = React.useState<Record<string, number>>({});
  const [walletFavoritesLoading, setWalletFavoritesLoading] = React.useState(false);
  const metadataInFlight = React.useRef<Set<string>>(new Set());
  const mythicMetadataInFlight = React.useRef<Set<string>>(new Set());
  const walletAddress = publicKey?.toBase58?.() || '';

  const buildMergedDirectory = React.useCallback(
    (
      gqlDirectory: any[],
      votingProposalsByGovernance: Record<string, any[]>,
      cachedLookup: any[],
      gsplEntries: any[],
      indexedRealms: any[],
      indexedGovernances: any[]
    ) => {
      const gsplByExactName = new Map<string, any>();
      const gsplByCompactName = new Map<string, any>();
      for (const gsplEntry of gsplEntries || []) {
        const name = normalizeName(gsplEntry?.name);
        const exactName = name.toLowerCase();
        const compactName = normalizeSearchText(name);
        if (exactName) gsplByExactName.set(exactName, gsplEntry);
        if (compactName) gsplByCompactName.set(compactName, gsplEntry);
      }

      const gqlByGovernance = new Map<string, any>();
      for (const gqlItem of gqlDirectory || []) {
        const key = governanceKey(gqlItem?.governanceAddress);
        if (!key) continue;
        gqlByGovernance.set(key, gqlItem);
      }

      const getHexTimestamp = (value: any): number => {
        const parsed = Number(`0x${String(value || '0').replace(/^0x/i, '')}`);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      const governanceKeysByRealm = new Map<string, Set<string>>();
      for (const governanceItem of indexedGovernances || []) {
        const governancePubkey = governanceKey(governanceItem?.pubkey);
        const governanceRealm = governanceKey(governanceItem?.account?.realm || governanceItem?.realm);
        if (!governancePubkey || !governanceRealm) continue;
        if (!governanceKeysByRealm.has(governanceRealm)) {
          governanceKeysByRealm.set(governanceRealm, new Set());
        }
        governanceKeysByRealm.get(governanceRealm)?.add(governancePubkey);
      }

      const aggregateGovernanceStats = (governanceKeys: string[]) => {
        let totalProposalsFromGraphQL = 0;
        let latestProposalTimestampFromGraphQL = 0;
        let totalVotingFromGraphQL = 0;
        const votingProposalAccumulator: any[] = [];

        for (const governancePk of governanceKeys) {
          const gqlItem = gqlByGovernance.get(governancePk);
          if (gqlItem) {
            totalProposalsFromGraphQL += toNumeric(gqlItem?.totalProposals, 0);
            totalVotingFromGraphQL += toNumeric(gqlItem?.totalProposalsVoting, 0);
            latestProposalTimestampFromGraphQL = Math.max(
              latestProposalTimestampFromGraphQL,
              getHexTimestamp(gqlItem?.lastProposalDate)
            );
          }

          const votingProposals = Array.isArray(votingProposalsByGovernance?.[governancePk])
            ? votingProposalsByGovernance[governancePk]
            : [];
          if (votingProposals.length > 0) {
            votingProposalAccumulator.push(...votingProposals);
          }
        }

        const dedupedVotingProposals: any[] = [];
        const seenProposalPubkeys = new Set<string>();
        for (const proposal of votingProposalAccumulator) {
          const proposalKey = String(proposal?.pubkey || '');
          if (!proposalKey || seenProposalPubkeys.has(proposalKey)) continue;
          seenProposalPubkeys.add(proposalKey);
          dedupedVotingProposals.push(proposal);
        }

        dedupedVotingProposals.sort((a, b) => toNumeric(b?.votingAt, 0) - toNumeric(a?.votingAt, 0));

        return {
          totalProposalsFromGraphQL,
          latestProposalTimestampFromGraphQL,
          totalVotingFromGraphQL,
          dedupedVotingProposals,
        };
      };

      const getRealmGovernanceContext = (
        cachedItem: any
      ): { expectedRealmKey: string | null; keys: string[] } => {
        const realmCandidates = [
          governanceKey(cachedItem?.realm),
          governanceKey(cachedItem?.governance?.account?.realm),
          governanceKey(cachedItem?.governance?.realm),
          governanceKey(cachedItem?.governanceAddress),
        ].filter((candidate) => isValidSolanaPublicKey(candidate));

        const expectedRealmKey = realmCandidates.length > 0 ? realmCandidates[0] : null;

        const belongsToExpectedRealm = (entry: any): boolean => {
          if (!expectedRealmKey) return true;
          const entryRealm = governanceKey(entry?.account?.realm || entry?.realm);
          if (!entryRealm) return true;
          return entryRealm === expectedRealmKey;
        };

        const keys = new Set<string>();

        const realmKey = governanceKey(cachedItem?.governanceAddress);
        if (realmKey) keys.add(realmKey);

        const governanceKeyLists = [
          cachedItem?.governances,
          cachedItem?.governanceRules,
        ];

        for (const keyList of governanceKeyLists) {
          if (!Array.isArray(keyList)) continue;
          for (const entry of keyList) {
            if (!belongsToExpectedRealm(entry)) continue;
            const entryKey = governanceKey(entry?.pubkey);
            if (entryKey) keys.add(entryKey);
          }
        }

        const primaryGovernanceEntry = cachedItem?.governance;
        const primaryGovernanceKey = governanceKey(primaryGovernanceEntry?.pubkey);
        const primaryGovernanceRealm = governanceKey(
          primaryGovernanceEntry?.account?.realm || primaryGovernanceEntry?.realm
        );
        if (primaryGovernanceKey) keys.add(primaryGovernanceKey);

        if (
          expectedRealmKey &&
          primaryGovernanceKey &&
          primaryGovernanceRealm &&
          primaryGovernanceRealm !== expectedRealmKey
        ) {
          keys.delete(primaryGovernanceKey);
        }

        return { expectedRealmKey, keys: Array.from(keys) };
      };

      const mergedItems: GovernanceLookupItem[] = [];
      const consumedGovernanceKeys = new Set<string>();
      const governanceToRealm = new Map<string, string>();

      for (const governanceItem of indexedGovernances || []) {
        const governancePubkey = governanceKey(governanceItem?.pubkey);
        const governanceRealm = governanceKey(governanceItem?.account?.realm || governanceItem?.realm);
        if (governancePubkey && governanceRealm) {
          governanceToRealm.set(governancePubkey, governanceRealm);
        }
      }

      for (const cachedItem of cachedLookup || []) {
        const governanceAddress = governanceKey(cachedItem?.governanceAddress);
        if (!governanceAddress) continue;

        const directGSPLMatch = cachedItem?.gspl || null;
        const cachedNameCandidates = [
          cachedItem?.governanceName,
          cachedItem?.name,
          cachedItem?.realmName,
          cachedItem?.governance?.account?.name,
          directGSPLMatch?.name,
        ];

        let governanceName = '';
        for (const candidate of cachedNameCandidates) {
          const normalized = normalizeName(candidate);
          if (normalized) {
            governanceName = normalized;
            break;
          }
        }

        const gsplMatch =
          directGSPLMatch ||
          (governanceName
            ? gsplByExactName.get(String(governanceName).trim().toLowerCase()) ||
              gsplByCompactName.get(normalizeSearchText(governanceName))
            : null);

        if (!governanceName) {
          governanceName = normalizeName(gsplMatch?.name);
        }

        if (!hasNamedGovernance(governanceName, governanceAddress)) {
          continue;
        }

        const { expectedRealmKey, keys: realmGovernanceKeys } = getRealmGovernanceContext(cachedItem);
        if (expectedRealmKey) {
          for (const realmGovernanceKey of realmGovernanceKeys) {
            governanceToRealm.set(realmGovernanceKey, expectedRealmKey);
          }
        }

        const {
          totalProposalsFromGraphQL,
          latestProposalTimestampFromGraphQL,
          totalVotingFromGraphQL,
          dedupedVotingProposals,
        } = aggregateGovernanceStats(realmGovernanceKeys);
        for (const realmGovernanceKey of realmGovernanceKeys) {
          if (gqlByGovernance.has(realmGovernanceKey) || (votingProposalsByGovernance?.[realmGovernanceKey]?.length || 0) > 0) {
            consumedGovernanceKeys.add(realmGovernanceKey);
          }
        }

        const cachedLastProposalTimestamp = getHexTimestamp(cachedItem?.lastProposalDate);
        const mergedLastProposalTimestamp = Math.max(
          latestProposalTimestampFromGraphQL,
          cachedLastProposalTimestamp
        );
        const cachedTotalProposals = toNumeric(cachedItem?.totalProposals, 0);
        const cachedCouncilProposals = toNumeric(cachedItem?.totalCouncilProposals, 0);
        const hasConsistentCachedSplit =
          cachedTotalProposals > 0 && cachedTotalProposals >= cachedCouncilProposals;

        const mergedTotalProposals = hasConsistentCachedSplit
          ? cachedTotalProposals
          : totalProposalsFromGraphQL > 0
          ? totalProposalsFromGraphQL
          : cachedTotalProposals;

        const mergedCouncilProposals = hasConsistentCachedSplit
          ? cachedCouncilProposals
          : Math.min(cachedCouncilProposals, mergedTotalProposals);

        const mergedCommunityProposals = hasConsistentCachedSplit
          ? cachedTotalProposals - cachedCouncilProposals
          : Math.max(mergedTotalProposals - mergedCouncilProposals, 0);

        mergedItems.push({
          ...cachedItem,
          governanceAddress,
          governanceName,
          gspl: gsplMatch,
          votingProposals: dedupedVotingProposals,
          totalMembers: toNumeric(cachedItem?.totalMembers, 0),
          totalProposals: mergedTotalProposals,
          totalCommunityProposals: mergedCommunityProposals,
          totalCouncilProposals: mergedCouncilProposals,
          totalProposalsVoting: dedupedVotingProposals.length || totalVotingFromGraphQL,
          totalVaultValue: toNumeric(cachedItem?.totalVaultValue, 0),
          totalVaultStableCoinValue: toNumeric(cachedItem?.totalVaultStableCoinValue, 0),
          totalVaultSol: toNumeric(cachedItem?.totalVaultSol, 0),
          totalVaultSolValue: toNumeric(cachedItem?.totalVaultSolValue, 0),
          lastProposalDate:
            mergedLastProposalTimestamp > 0
              ? mergedLastProposalTimestamp.toString(16)
              : '0',
        });
      }

      const existingRealmOrGovernanceKeys = new Set(
        mergedItems.map((item) => governanceKey(item?.governanceAddress)).filter(Boolean)
      );

      for (const realmItem of indexedRealms || []) {
        const realmAddress = governanceKey(realmItem?.pubkey || realmItem?.account?.realm);
        if (!realmAddress || existingRealmOrGovernanceKeys.has(realmAddress)) continue;

        const realmName = normalizeName(realmItem?.account?.name);
        const gsplMatch = realmName
          ? gsplByExactName.get(realmName.toLowerCase()) ||
            gsplByCompactName.get(normalizeSearchText(realmName))
          : null;
        const governanceName =
          realmName ||
          normalizeName(gsplMatch?.name) ||
          `Realm ${realmAddress.slice(0, 6)}...`;

        const realmGovernanceKeys = Array.from(governanceKeysByRealm.get(realmAddress) || []);
        const {
          totalProposalsFromGraphQL,
          latestProposalTimestampFromGraphQL,
          totalVotingFromGraphQL,
          dedupedVotingProposals,
        } = aggregateGovernanceStats(realmGovernanceKeys);

        for (const realmGovernanceKey of realmGovernanceKeys) {
          if (gqlByGovernance.has(realmGovernanceKey) || (votingProposalsByGovernance?.[realmGovernanceKey]?.length || 0) > 0) {
            consumedGovernanceKeys.add(realmGovernanceKey);
          }
        }

        mergedItems.push({
          governanceAddress: realmAddress,
          governanceName,
          communityMint: governanceKey(realmItem?.account?.communityMint) || undefined,
          councilMint: governanceKey(realmItem?.account?.config?.councilMint) || undefined,
          votingProposals: dedupedVotingProposals,
          totalMembers: 0,
          totalProposals: totalProposalsFromGraphQL,
          totalCommunityProposals: totalProposalsFromGraphQL,
          totalCouncilProposals: 0,
          totalProposalsVoting:
            dedupedVotingProposals.length > 0
              ? dedupedVotingProposals.length
              : totalVotingFromGraphQL,
          totalVaultValue: 0,
          totalVaultStableCoinValue: 0,
          totalVaultSol: 0,
          totalVaultSolValue: 0,
          lastProposalDate:
            latestProposalTimestampFromGraphQL > 0
              ? latestProposalTimestampFromGraphQL.toString(16)
              : '0',
          gspl: gsplMatch || undefined,
        } as GovernanceLookupItem);
        existingRealmOrGovernanceKeys.add(realmAddress);
      }

      for (const [governanceAddress, gqlItem] of gqlByGovernance.entries()) {
        if (consumedGovernanceKeys.has(governanceAddress)) continue;
        if (governanceToRealm.has(governanceAddress)) continue;

        const governanceName = normalizeName(gqlItem?.governanceName || gqlItem?.name);
        if (!hasNamedGovernance(governanceName, governanceAddress)) continue;
        const gsplMatch = governanceName
          ? gsplByExactName.get(governanceName.toLowerCase()) ||
            gsplByCompactName.get(normalizeSearchText(governanceName))
          : null;

        const votingProposals = Array.isArray(votingProposalsByGovernance?.[governanceAddress])
          ? votingProposalsByGovernance[governanceAddress]
          : [];

        mergedItems.push({
          governanceAddress,
          governanceName,
          votingProposals,
          totalMembers: 0,
          totalProposals: toNumeric(gqlItem?.totalProposals, 0),
          totalCommunityProposals: toNumeric(gqlItem?.totalProposals, 0),
          totalCouncilProposals: 0,
          totalProposalsVoting:
            votingProposals.length > 0
              ? votingProposals.length
              : toNumeric(gqlItem?.totalProposalsVoting, 0),
          totalVaultValue: 0,
          totalVaultStableCoinValue: 0,
          totalVaultSol: 0,
          totalVaultSolValue: 0,
          lastProposalDate: gqlItem?.lastProposalDate || '0',
          gspl: gsplMatch || undefined,
        } as GovernanceLookupItem);
      }

      return mergedItems;
    },
    []
  );

  const loadGovernanceDirectory = React.useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        const realmProgramNames = Array.from(
          new Set([
            DEFAULT_GOVERNANCE_PROGRAM_NAME,
            ...(govOwners || []).map((owner) => owner?.name).filter((name): name is string => !!name),
          ])
        );

        const fetchAllIndexedRealms = async () => {
          const realmBatches = await Promise.all(
            realmProgramNames.map((programName) => getRealmsIndexed(programName).catch(() => []))
          );

          const flattened: any[] = [];
          for (const batch of realmBatches) {
            if (!Array.isArray(batch)) continue;
            for (const entry of batch) {
              if (Array.isArray(entry)) {
                flattened.push(...entry);
              } else if (entry) {
                flattened.push(entry);
              }
            }
          }
          return flattened;
        };

        const [gsplEntriesRaw, cachedLookupRaw, masterMembersRaw] = await Promise.all([
          initGrapeGovernanceDirectory().catch(() => []),
          fetchGovernanceLookupFile(GGAPI_STORAGE_POOL).catch(() => null),
          fetchGovernanceMasterMembersFile(GGAPI_STORAGE_POOL).catch(() => null),
        ]);

        const gsplEntries = Array.isArray(gsplEntriesRaw) ? gsplEntriesRaw : [];
        const gqlDirectory: any[] = [];
        const votingProposalsByGovernance = {};
        const cachedLookup = Array.isArray(cachedLookupRaw) ? cachedLookupRaw : [];
        const masterMembers = Array.isArray(masterMembersRaw) ? masterMembersRaw : [];
        const shouldLoadIndexedFallback = gqlDirectory.length === 0 && cachedLookup.length === 0;
        let indexedRealms: any[] = [];
        let indexedGovernances: any[] = [];

        if (shouldLoadIndexedFallback) {
          const [indexedRealmsRaw, indexedGovernancesRaw] = await Promise.all([
            fetchAllIndexedRealms().catch(() => []),
            getAllGovernancesFromAllPrograms().catch(() => []),
          ]);
          indexedRealms = Array.isArray(indexedRealmsRaw) ? indexedRealmsRaw : [];
          indexedGovernances = Array.isArray(indexedGovernancesRaw) ? indexedGovernancesRaw : [];
        }

        const mergedDirectory = buildMergedDirectory(
          gqlDirectory,
          votingProposalsByGovernance,
          cachedLookup,
          gsplEntries,
          indexedRealms,
          indexedGovernances
        );

        setGovernanceLookup(mergedDirectory);
        setGSPL(gsplEntries);
        setLastSyncedAt(Date.now());

        if (gqlDirectory.length > 0 && cachedLookup.length > 0) {
          setSyncSource('mixed');
        } else if (gqlDirectory.length > 0) {
          setSyncSource('graphql');
        } else {
          setSyncSource('cache');
        }

        const totalMembersFromDirectory = mergedDirectory.reduce(
          (sum, item) => sum + toNumeric(item?.totalMembers, 0),
          0
        );
        const totalProposalsFromDirectory = mergedDirectory.reduce(
          (sum, item) => sum + toNumeric(item?.totalProposals, 0),
          0
        );

        setGovernanceTotalMembers(masterMembers.length > 0 ? masterMembers.length : totalMembersFromDirectory);
        setGovernanceTotalProposals(totalProposalsFromDirectory);

        if (!mergedDirectory.length) {
          setError('No directory data available from RPC or cache.');
        }
      } catch (e) {
        console.error('Failed to load governance directory:', e);
        setError('Failed to load governance directory. Please try again.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [buildMergedDirectory]
  );

  React.useEffect(() => {
    loadGovernanceDirectory(false);
  }, [loadGovernanceDirectory]);

  React.useEffect(() => {
    let cancelled = false;

    const loadWalletFavorites = async () => {
      if (!walletAddress) {
        setFavoriteRealmVoteTotals({});
        setWalletFavoritesLoading(false);
        return;
      }

      setWalletFavoritesLoading(true);
      try {
        const ownerRecords = await getTokenOwnerRecordsByOwnerAcrossProgramsIndexed(walletAddress);
        if (cancelled) return;

        const nextFavoriteRealmVoteTotals: Record<string, number> = {};
        for (const ownerRecord of ownerRecords || []) {
          const realmKey = governanceKey(ownerRecord?.account?.realm);
          const depositAmount = toNumeric(
            ownerRecord?.account?.governingTokenDepositAmount?.toString?.() ??
              ownerRecord?.account?.governingTokenDepositAmount,
            0
          );

          if (!realmKey || !(depositAmount > 0)) continue;
          nextFavoriteRealmVoteTotals[realmKey] =
            (nextFavoriteRealmVoteTotals[realmKey] || 0) + depositAmount;
        }

        setFavoriteRealmVoteTotals(nextFavoriteRealmVoteTotals);
      } catch (favoriteError) {
        console.error('Failed to load wallet favorites', favoriteError);
        if (!cancelled) {
          setFavoriteRealmVoteTotals({});
        }
      } finally {
        if (!cancelled) {
          setWalletFavoritesLoading(false);
        }
      }
    };

    loadWalletFavorites();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  const sortedGovernances = React.useMemo(() => {
    const items = [...governanceLookup];
    items.sort((a, b) => {
      const liveVotesDiff =
        toNumeric(b?.totalProposalsVoting, 0) - toNumeric(a?.totalProposalsVoting, 0);
      if (liveVotesDiff !== 0) return liveVotesDiff;

      const latestProposalDiff =
        Number(`0x${b?.lastProposalDate || '0'}`) - Number(`0x${a?.lastProposalDate || '0'}`);
      if (latestProposalDiff !== 0) return latestProposalDiff;

      const totalProposalDiff = toNumeric(b?.totalProposals, 0) - toNumeric(a?.totalProposals, 0);
      if (totalProposalDiff !== 0) return totalProposalDiff;

      const membersDiff = toNumeric(b?.totalMembers, 0) - toNumeric(a?.totalMembers, 0);
      if (membersDiff !== 0) return membersDiff;

      const aName = normalizeName(a?.governanceName || a?.governanceAddress).toLowerCase();
      const bName = normalizeName(b?.governanceName || b?.governanceAddress).toLowerCase();
      return aName.localeCompare(bName);
    });

    return items;
  }, [governanceLookup]);

  const filteredGovernances = React.useMemo(() => {
    const query = (searchFilter || '').trim();
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    return sortedGovernances.filter((item: GovernanceLookupItem) => {
      if (filterVerified && !item?.gspl) return false;
      if (filterActiveVoting && !(toNumeric(item?.totalProposalsVoting, 0) > 0)) return false;
      if (filterOver100Proposals && !(toNumeric(item?.totalProposals, 0) > 100)) return false;

      if (!query) return true;

      const gsplMetadata = item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : null;
      const realmAddress = governanceRealmKey(item);
      const mythicMetadata = realmAddress ? mythicMetadataMap[realmAddress] : null;
      const metadata = mergeDaoMetadata(gsplMetadata, mythicMetadata);
      const searchFields = [
        metadata?.displayName,
        metadata?.shortDescription,
        metadata?.website,
        metadata?.twitter,
        metadata?.discord,
        metadata?.github,
        item?.governanceName,
        item?.governanceAddress,
        item?.communityMint,
        item?.councilMint,
        item?.gspl?.name,
      ]
        .map((field) => String(field || '').trim().toLowerCase())
        .filter(Boolean);

      if (searchFields.length === 0) return false;

      const searchable = searchFields.join(' ');
      const compactSearchable = searchable.replace(/\s+/g, '');
      const compactQuery = normalizeSearchText(query);

      if (compactQuery && compactSearchable.includes(compactQuery)) {
        return true;
      }

      return queryTerms.every((term) => {
        if (searchable.includes(term)) return true;
        const compactTerm = normalizeSearchText(term);
        return compactTerm.length > 0 && compactSearchable.includes(compactTerm);
      });
    });
  }, [
    sortedGovernances,
    searchFilter,
    filterVerified,
    filterActiveVoting,
    filterOver100Proposals,
    metadataMap,
    mythicMetadataMap,
  ]);

  const favoriteGovernances = React.useMemo(() => {
    const favoriteRealmKeys = new Set(Object.keys(favoriteRealmVoteTotals));
    if (!favoriteRealmKeys.size) return [];

    return filteredGovernances
      .filter((item) => favoriteRealmKeys.has(governanceRealmKey(item)))
      .sort((a, b) => {
        const liveVotesDiff =
          toNumeric(b?.totalProposalsVoting, 0) - toNumeric(a?.totalProposalsVoting, 0);
        if (liveVotesDiff !== 0) return liveVotesDiff;

        const totalProposalDiff = toNumeric(b?.totalProposals, 0) - toNumeric(a?.totalProposals, 0);
        if (totalProposalDiff !== 0) return totalProposalDiff;

        const membersDiff = toNumeric(b?.totalMembers, 0) - toNumeric(a?.totalMembers, 0);
        if (membersDiff !== 0) return membersDiff;

        const favoriteVoteDiff =
          toNumeric(
            favoriteRealmVoteTotals[governanceRealmKey(b)],
            0
          ) - toNumeric(favoriteRealmVoteTotals[governanceRealmKey(a)], 0);
        if (favoriteVoteDiff !== 0) return favoriteVoteDiff;

        return normalizeName(a?.governanceName || a?.governanceAddress).localeCompare(
          normalizeName(b?.governanceName || b?.governanceAddress)
        );
      });
  }, [favoriteRealmVoteTotals, filteredGovernances]);

  const favoriteGovernanceAddressSet = React.useMemo(
    () => new Set(favoriteGovernances.map((item) => governanceKey(item?.governanceAddress)).filter(Boolean)),
    [favoriteGovernances]
  );

  const nonFavoriteGovernances = React.useMemo(
    () =>
      filteredGovernances.filter(
        (item) => !favoriteGovernanceAddressSet.has(governanceKey(item?.governanceAddress))
      ),
    [favoriteGovernanceAddressSet, filteredGovernances]
  );

  React.useEffect(() => {
    setVisibleCount(viewMode === 'grid' ? 12 : 20);
  }, [viewMode, searchFilter, filterVerified, filterActiveVoting, filterOver100Proposals]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      const lookahead = Math.max(visibleCount + 24, 84);
      const metadataUris = Array.from(
        new Set(
          [...favoriteGovernances, ...nonFavoriteGovernances.slice(0, lookahead)]
            .map((item) => item?.gspl?.metadataUri)
            .filter((uri) => typeof uri === 'string' && uri.length > 0)
        )
      ).filter((uri) => !metadataMap[uri] && !metadataInFlight.current.has(uri));

      if (!metadataUris.length) return;

      const batch = metadataUris.slice(0, 10);
      for (const uri of batch) metadataInFlight.current.add(uri);

      const fetchedEntries = await Promise.all(
        batch.map(async (uri) => {
          try {
            const response = await fetch(uri);
            if (!response.ok) return null;
            const metadata = await response.json();
            return [uri, metadata] as const;
          } catch (_e) {
            return null;
          } finally {
            metadataInFlight.current.delete(uri);
          }
        })
      );

      if (cancelled) return;

      setMetadataMap((currentMap) => {
        const nextMap = { ...currentMap };
        for (const entry of fetchedEntries) {
          if (entry) nextMap[entry[0]] = entry[1];
        }
        return nextMap;
      });
    };

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [favoriteGovernances, nonFavoriteGovernances, visibleCount, metadataMap]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchMythicMetadata = async () => {
      const lookahead = Math.max(visibleCount + 24, 84);
      const realmAddresses = Array.from(
        new Set(
          [...favoriteGovernances, ...nonFavoriteGovernances.slice(0, lookahead)]
            .map((item) => governanceRealmKey(item))
            .filter((realmAddress) => typeof realmAddress === 'string' && realmAddress.length > 0)
        )
      ).filter(
        (realmAddress) =>
          !Object.prototype.hasOwnProperty.call(mythicMetadataMap, realmAddress) &&
          !mythicMetadataInFlight.current.has(realmAddress)
      );

      if (!realmAddresses.length) return;

      const batch = realmAddresses.slice(0, 8);
      for (const realmAddress of batch) mythicMetadataInFlight.current.add(realmAddress);

      const fetchedEntries = await Promise.all(
        batch.map(async (realmAddress) => {
          try {
            const realm = await getRealmIndexed(realmAddress);
            if (!realm) return null;
            const metadata = await fetchMythicRealmMetadata(realm);
            return [realmAddress, metadata] as const;
          } catch (_e) {
            return [realmAddress, null] as const;
          } finally {
            mythicMetadataInFlight.current.delete(realmAddress);
          }
        })
      );

      if (cancelled) return;

      setMythicMetadataMap((currentMap) => {
        const nextMap = { ...currentMap };
        for (const entry of fetchedEntries) {
          if (entry) nextMap[entry[0]] = entry[1];
        }
        return nextMap;
      });
    };

    fetchMythicMetadata();

    return () => {
      cancelled = true;
    };
  }, [favoriteGovernances, nonFavoriteGovernances, visibleCount, mythicMetadataMap]);

  const displayedGovernances = React.useMemo(
    () => nonFavoriteGovernances.slice(0, visibleCount),
    [nonFavoriteGovernances, visibleCount]
  );

  const latestActivityAddress = React.useMemo(() => {
    const validItems = sortedGovernances.filter((item) =>
      isValidSolanaPublicKey(governanceKey(item?.governanceAddress))
    );
    if (!validItems.length) return DEFAULT_GOVERNANCE_PROGRAM_NAME;

    const activeVoting = validItems.find((item) => toNumeric(item?.totalProposalsVoting, 0) > 0);
    if (activeVoting) return governanceKey(activeVoting?.governanceAddress);

    const withRecentProposal = validItems.find(
      (item) => Number(`0x${item?.lastProposalDate || '0'}`) > 0
    );
    if (withRecentProposal) return governanceKey(withRecentProposal?.governanceAddress);

    return governanceKey(validItems[0]?.governanceAddress) || DEFAULT_GOVERNANCE_PROGRAM_NAME;
  }, [sortedGovernances]);

  const hasMoreGovernances = displayedGovernances.length < nonFavoriteGovernances.length;

  const totalLiveProposals = React.useMemo(
    () =>
      governanceLookup.reduce(
        (sum, item) => sum + toNumeric(item?.totalProposalsVoting, 0),
        0
      ),
    [governanceLookup]
  );

  const syncSourceLabel =
    syncSource === 'graphql' ? 'GraphQL' : syncSource === 'mixed' ? 'GraphQL + cache' : 'Cache fallback';

  const syncTimeLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Not synced yet';

  const clearFilters = () => {
    setSearchFilter('');
    setFilterVerified(false);
    setFilterActiveVoting(false);
    setFilterOver100Proposals(false);
  };

  if (loading) {
    return (
      <Box
        sx={{
          mt: 6,
          background: 'rgba(0, 0, 0, 0.55)',
          borderRadius: '20px',
          p: 4,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <Typography variant="body2" sx={{ mb: 1 }}>
          Loading Governance Directory...
        </Typography>
        <LinearProgress color="inherit" />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        mt: { xs: 2, md: 4 },
        borderRadius: '24px',
        p: { xs: 2, md: 4 },
        background: 'rgba(16, 12, 24, 0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box id="back-to-top-anchor" sx={{ pt: { xs: 2, md: 4 }, pb: 4, maxWidth: 720 }}>
        <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.55)', letterSpacing: 2 }}>
          Governance on Solana
        </Typography>
        <Typography component="h1" sx={{ mt: 1, mb: 1.5, fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.12 }}>
          Find your DAO. Have your say.
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: { xs: 16, md: 18 } }}>
          Explore communities, review proposals, and take part in the decisions that matter to you.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Find a DAO"
          placeholder="Search by name, address, or token mint"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          sx={{ maxWidth: 720, '& .MuiOutlinedInput-root': { borderRadius: 3, background: 'rgba(255,255,255,0.03)' } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        />
        <Button
          color="inherit"
          variant={filterActiveVoting ? 'contained' : 'outlined'}
          startIcon={<HowToVoteIcon />}
          aria-pressed={filterActiveVoting}
          onClick={() => setFilterActiveVoting(value => !value)}
          sx={{ whiteSpace: 'nowrap', minWidth: 150, py: 1.5 }}
        >Voting now</Button>
      </Stack>

      <Box component="details" sx={{ mb: 3, color: 'rgba(255,255,255,0.7)', '& > summary': { cursor: 'pointer', py: 1, width: 'fit-content', fontSize: 14 } }}>
        <Box component="summary">Directory options{filterVerified || filterOver100Proposals ? ' · filters active' : ''}</Box>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Chip icon={<VerifiedIcon />} label="Verified" clickable onClick={() => setFilterVerified(value => !value)} color={filterVerified ? 'primary' : 'default'} variant={filterVerified ? 'filled' : 'outlined'} />
            <Chip label=">100 proposals" clickable onClick={() => setFilterOver100Proposals(value => !value)} color={filterOver100Proposals ? 'primary' : 'default'} variant={filterOver100Proposals ? 'filled' : 'outlined'} />
            <ToggleButtonGroup exclusive size="small" value={viewMode} aria-label="Directory layout" onChange={(_,mode) => mode && setViewMode(mode)}>
              <ToggleButton value="grid" aria-label="Grid layout"><ViewModuleIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="list" aria-label="List layout"><ViewListIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
            <Button color="inherit" size="small" onClick={clearFilters}>Reset filters</Button>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="caption">Updated {syncTimeLabel}</Typography>
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => loadGovernanceDirectory(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh directory'}</Button>
          </Stack>
        </Stack>
      </Box>

      {(refreshing || error) && (
        <Box sx={{ mt: 2 }}>
          {refreshing && <LinearProgress color="inherit" />}
          {error && (
            <Typography variant="caption" sx={{ display: 'block', mt: refreshing ? 1 : 0, color: '#ffb3b3' }}>
              {error}
            </Typography>
          )}
        </Box>
      )}

      <Divider sx={{ my: 2, opacity: 0.15 }} />

      {walletAddress && (
        <Box sx={{
          mb: 2.5,
          p: 2,
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent',
        }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }} useFlexGap flexWrap="wrap">
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.25 }}>
              Your DAOs
            </Typography>
            <Chip
              size="small"
              icon={<HowToVoteIcon />}
              label={
                walletFavoritesLoading
                  ? 'Checking wallet votes...'
                  : `${favoriteGovernances.length} DAO${favoriteGovernances.length === 1 ? '' : 's'}`
              }
              variant="outlined"
              sx={{ borderRadius: '999px' }}
            />
          </Stack>

          <Typography variant="body2" sx={{ opacity: 0.78, mb: walletFavoritesLoading ? 1 : 1.25 }}>
            DAOs where you currently have deposited voting power.
          </Typography>

          {walletFavoritesLoading ? (
            <LinearProgress color="inherit" />
          ) : favoriteGovernances.length > 0 ? (
            <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
              {favoriteGovernances.map((item: GovernanceLookupItem, key: number) => {
                const metadata = mergeDaoMetadata(
                  item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : null,
                  mythicMetadataMap[governanceRealmKey(item)] || null
                ) || {};

                return (
                  <Grid
                    item
                    key={`${item?.governanceAddress || key}-favorite`}
                    xs={12}
                    sm={viewMode === 'grid' ? 6 : 12}
                    md={viewMode === 'grid' ? 4 : 12}
                  >
                    <GovernanceDirectoryCardView item={item} metadata={metadata} compact />
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Box
              sx={{
                p: 2,
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                No participating DAOs found for the connected wallet under the current filters.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {nonFavoriteGovernances.length > 0 && (
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.25, mt: 3, mb: 1.5 }}>
          {walletAddress && favoriteGovernances.length ? 'Explore more DAOs' : 'Explore DAOs'}
        </Typography>
      )}

      {nonFavoriteGovernances.length > 0 ? (
        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mt: 0.5 }}>
          {displayedGovernances.map((item: GovernanceLookupItem, key: number) => {
            const metadata = mergeDaoMetadata(
              item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : null,
              mythicMetadataMap[governanceRealmKey(item)] || null
            ) || {};

            return (
              <Grid
                item
                key={item?.governanceAddress || key}
                xs={12}
                sm={viewMode === 'grid' ? 6 : 12}
                md={viewMode === 'grid' ? 4 : 12}
              >
                <GovernanceDirectoryCardView item={item} metadata={metadata} compact />
              </Grid>
            );
          })}
        </Grid>
      ) : filteredGovernances.length === 0 ? (
        <Box
          sx={{
            p: 3,
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            textAlign: 'center',
          }}
        >
          <Typography variant="body1" sx={{ mb: 1 }}>
            No DAOs match the current filters.
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, mb: 2 }}>
            Try clearing the search query or turning off one of the active filters.
          </Typography>
          <Button size="small" variant="outlined" color="inherit" onClick={clearFilters}>
            Clear Filters
          </Button>
        </Box>
      ) : null}

      {hasMoreGovernances && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setVisibleCount((current) => current + (viewMode === 'grid' ? 12 : 20))}
          >
            Load More ({nonFavoriteGovernances.length - displayedGovernances.length} remaining)
          </Button>
        </Box>
      )}

      <Divider sx={{ mt: 5, mb: 2, opacity: 0.15 }} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button color="inherit" onClick={() => setShowActivity(value => !value)} aria-expanded={showActivity}>{showActivity ? 'Hide recent activity' : 'Recent activity'}</Button>
          <CreateSplGovernanceDaoButton />
        </Stack>
        <Box component="details" sx={{ '& summary': { cursor: 'pointer', fontSize: 14, color: 'rgba(255,255,255,0.6)' } }}>
          <Box component="summary">More from Grape</Box>
          <Stack spacing={0.5} sx={{ pt: 1 }}>
            <Button component="a" href="https://grapedao.org" target="_blank" rel="noopener noreferrer" color="inherit">Grape DAO</Button>
            <Button component="a" href="https://vine.governance.so" target="_blank" rel="noopener noreferrer" color="inherit">OG Reputation Spaces</Button>
            <Button component="a" href="https://verification.governance.so" target="_blank" rel="noopener noreferrer" color="inherit">Grape Verification</Button>
          </Stack>
        </Box>
      </Stack>
      {showActivity && <Box sx={{ mt: 2 }}><GovernanceRealtimeInfo key={latestActivityAddress} governanceLookup={governanceLookup} governanceAddress={latestActivityAddress} title="Recent activity" expanded={false} compact={true} /></Box>}

      <ScrollTop {...props}>
        <Fab size="small" aria-label="scroll back to top">
          <KeyboardArrowUpIcon />
        </Fab>
      </ScrollTop>
    </Box>
  );
}
