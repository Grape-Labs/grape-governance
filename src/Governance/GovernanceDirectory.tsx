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
import WhatshotIcon from '@mui/icons-material/Whatshot';
import VerifiedIcon from '@mui/icons-material/Verified';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { PublicKey } from '@solana/web3.js';
import GRAPE_LOGO_SQUARE from '../public/grape_logo_square.png';
import OG_LOGO_SQUARE from '../public/og_logo_square.png';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernanceDirectoryCardView from './GovernanceDirectoryCardView';
import CreateSplGovernanceDaoButton from './CreateNewDAO/CreateSplGovernanceDaoButton';

import { initGrapeGovernanceDirectory } from './api/gspl_queries';
import {
  buildDirectoryFromGraphQL,
  getAllGovernancesFromAllPrograms,
  getRealmsIndexed,
  govOwners,
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
  return value?.toBase58?.() || (typeof value === 'string' ? value : String(value || ''));
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
  const [metadataMap, setMetadataMap] = React.useState<{ [key: string]: any }>({});
  const [governanceLookup, setGovernanceLookup] = React.useState<GovernanceLookupItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [searchFilter, setSearchFilter] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [filterVerified, setFilterVerified] = React.useState(false);
  const [filterActiveVoting, setFilterActiveVoting] = React.useState(false);
  const [filterOver100Proposals, setFilterOver100Proposals] = React.useState(false);

  const [visibleCount, setVisibleCount] = React.useState(48);

  const [gspl, setGSPL] = React.useState<any[]>([]);
  const [governanceTotalMembers, setGovernanceTotalMembers] = React.useState(0);
  const [governanceTotalProposals, setGovernanceTotalProposals] = React.useState(0);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncSource, setSyncSource] = React.useState<'graphql' | 'cache' | 'mixed'>('graphql');
  const metadataInFlight = React.useRef<Set<string>>(new Set());

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

        const [gsplEntriesRaw, graphQLResult, cachedLookupRaw, masterMembersRaw] = await Promise.all([
          initGrapeGovernanceDirectory().catch(() => []),
          buildDirectoryFromGraphQL({ includeMembers: false, proposalScanLimit: 4000 }).catch(
            () => ({ directory: [], votingProposalsByGovernance: {} })
          ),
          fetchGovernanceLookupFile(GGAPI_STORAGE_POOL).catch(() => null),
          fetchGovernanceMasterMembersFile(GGAPI_STORAGE_POOL).catch(() => null),
        ]);

        const gsplEntries = Array.isArray(gsplEntriesRaw) ? gsplEntriesRaw : [];
        const gqlDirectory = Array.isArray(graphQLResult?.directory) ? graphQLResult.directory : [];
        const votingProposalsByGovernance = graphQLResult?.votingProposalsByGovernance || {};
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
          setError('No directory data available from GraphQL or cache.');
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

      const metadata = item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : null;
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
  ]);

  React.useEffect(() => {
    setVisibleCount(viewMode === 'grid' ? 48 : 80);
  }, [viewMode, searchFilter, filterVerified, filterActiveVoting, filterOver100Proposals]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      const lookahead = Math.max(visibleCount + 24, 84);
      const metadataUris = Array.from(
        new Set(
          filteredGovernances
            .slice(0, lookahead)
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
  }, [filteredGovernances, visibleCount, metadataMap]);

  const displayedGovernances = React.useMemo(
    () => filteredGovernances.slice(0, visibleCount),
    [filteredGovernances, visibleCount]
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

  const hasMoreGovernances = displayedGovernances.length < filteredGovernances.length;

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
        mt: 6,
        borderRadius: '24px',
        p: { xs: 2, md: 3 },
        background:
          'radial-gradient(1200px 600px at 18% 0%, rgba(16, 118, 255, 0.22), transparent 62%), radial-gradient(900px 480px at 90% 12%, rgba(0, 190, 135, 0.18), transparent 55%), radial-gradient(700px 350px at 50% 100%, rgba(255, 153, 0, 0.1), transparent 60%), rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Grid container spacing={1.5} sx={{ mb: 2.25 }}>
        <Grid item xs={12} md={6}>
          <Box
            component="a"
            href="https://vine.governance.so"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: '16px',
              textDecoration: 'none',
              color: 'inherit',
              background:
                'linear-gradient(120deg, rgba(18, 120, 255, 0.26), rgba(0, 178, 128, 0.18))',
              border: '1px solid rgba(255,255,255,0.14)',
              transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                borderColor: 'rgba(255,255,255,0.24)',
                background:
                  'linear-gradient(120deg, rgba(18, 120, 255, 0.33), rgba(0, 178, 128, 0.24))',
              },
            }}
          >
            <Box
              component="img"
              src={OG_LOGO_SQUARE}
              alt="OG Reputation Space"
              sx={{
                width: 50,
                height: 50,
                borderRadius: '12px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
                OG Reputation Spaces
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.84 }}>
                On-chain reputation by Grape
              </Typography>
            </Box>
            <OpenInNewIcon fontSize="small" sx={{ opacity: 0.85 }} />
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box
            component="a"
            href="https://verification.governance.so"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: '16px',
              textDecoration: 'none',
              color: 'inherit',
              background:
                'linear-gradient(120deg, rgba(255, 170, 0, 0.24), rgba(255, 97, 61, 0.2))',
              border: '1px solid rgba(255,255,255,0.14)',
              transition: 'transform 120ms ease, border-color 120ms ease, background 120ms ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                borderColor: 'rgba(255,255,255,0.24)',
                background:
                  'linear-gradient(120deg, rgba(255, 170, 0, 0.3), rgba(255, 97, 61, 0.27))',
              },
            }}
          >
            <Box
              component="img"
              src={GRAPE_LOGO_SQUARE}
              alt="Grape Verification"
              sx={{
                width: 50,
                height: 50,
                borderRadius: '12px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.16)',
              }}
            />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
                Grape Verification
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.84 }}>
                On-chain verification by Grape
              </Typography>
            </Box>
            <OpenInNewIcon fontSize="small" sx={{ opacity: 0.85 }} />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2} alignItems="center" id="back-to-top-anchor">
        <Grid item xs={12} md={7} sx={{ textAlign: 'left' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }} useFlexGap flexWrap="wrap">
            <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>
              DAO Directory
            </Typography>
            <Chip
              size="small"
              icon={<VerifiedIcon />}
              label={`${gspl?.length || 0} verified`}
              variant="outlined"
              sx={{ borderRadius: '999px' }}
            />
            <Chip
              size="small"
              icon={<WhatshotIcon />}
              label={`${totalLiveProposals.toLocaleString()} live votes`}
              variant="outlined"
              sx={{ borderRadius: '999px' }}
            />
            <Chip
              size="small"
              label={syncSourceLabel}
              variant="outlined"
              color={syncSource === 'cache' ? 'warning' : 'success'}
              sx={{ borderRadius: '999px' }}
            />
          </Stack>

          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            Proposal freshness and active voting are synced from GraphQL. Cache data is only used to enrich fields not available from GraphQL.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} useFlexGap flexWrap="wrap">
            <Chip size="small" label={`${governanceLookup.length || 0} active DAOs`} />
            <Chip
              size="small"
              label={`${governanceTotalMembers ? getFormattedNumberToLocale(governanceTotalMembers) : 0} unique voters`}
            />
            <Chip
              size="small"
              label={`${governanceTotalProposals ? getFormattedNumberToLocale(governanceTotalProposals) : 0} proposals`}
            />
          </Stack>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box
            sx={{
              position: { xs: 'static', md: 'sticky' },
              top: 12,
              zIndex: 10,
              p: 1.5,
              borderRadius: '18px',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Stack spacing={1.25}>
              <TextField
                fullWidth
                size="small"
                label="Search DAOs, governance address, mint..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    icon={<VerifiedIcon />}
                    label="Verified"
                    color={filterVerified ? 'primary' : 'default'}
                    variant={filterVerified ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterVerified((value) => !value)}
                  />
                  <Chip
                    icon={<HowToVoteIcon />}
                    label="Voting now"
                    color={filterActiveVoting ? 'primary' : 'default'}
                    variant={filterActiveVoting ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterActiveVoting((value) => !value)}
                  />
                  <Chip
                    icon={<WhatshotIcon />}
                    label=">100 proposals"
                    color={filterOver100Proposals ? 'primary' : 'default'}
                    variant={filterOver100Proposals ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterOver100Proposals((value) => !value)}
                  />
                </Stack>

                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={viewMode}
                  onChange={(_, mode) => mode && setViewMode(mode)}
                >
                  <ToggleButton value="grid">
                    <ViewModuleIcon fontSize="small" />
                  </ToggleButton>
                  <ToggleButton value="list">
                    <ViewListIcon fontSize="small" />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                justifyContent="space-between"
              >
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Last synced: {syncTimeLabel}
                </Typography>

                <Button
                  color="inherit"
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshIcon fontSize="small" />}
                  onClick={() => loadGovernanceDirectory(true)}
                  disabled={refreshing}
                >
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </Button>
              </Stack>

              <Stack direction="row" justifyContent="flex-end">
                <CreateSplGovernanceDaoButton />
              </Stack>
            </Stack>
          </Box>
        </Grid>
      </Grid>

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

      {!searchFilter && filteredGovernances.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <GovernanceRealtimeInfo
            key={latestActivityAddress}
            governanceLookup={governanceLookup}
            governanceAddress={latestActivityAddress}
            title={'Latest Activity'}
            expanded={false}
            compact={true}
          />
        </Box>
      )}

      {filteredGovernances.length > 0 ? (
        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mt: 0.5 }}>
          {displayedGovernances.map((item: GovernanceLookupItem, key: number) => {
            const metadata = item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : {};

            return (
              <Grid
                item
                key={item?.governanceAddress || key}
                xs={12}
                sm={viewMode === 'grid' ? 6 : 12}
                md={viewMode === 'grid' ? 4 : 12}
              >
                <GovernanceDirectoryCardView item={item} metadata={metadata} />
              </Grid>
            );
          })}
        </Grid>
      ) : (
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
      )}

      {hasMoreGovernances && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setVisibleCount((current) => current + (viewMode === 'grid' ? 36 : 60))}
          >
            Load More ({filteredGovernances.length - displayedGovernances.length} remaining)
          </Button>
        </Box>
      )}

      <ScrollTop {...props}>
        <Fab size="small" aria-label="scroll back to top">
          <KeyboardArrowUpIcon />
        </Fab>
      </ScrollTop>
    </Box>
  );
}
