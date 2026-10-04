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

import GovernanceDirectoryCardView from './GovernanceDirectoryCardView';
import CreateSplGovernanceDaoButton from './CreateNewDAO/CreateSplGovernanceDaoButton';

import { initGrapeGovernanceDirectory } from './api/gspl_queries';
import { fetchMythicRealmMetadata, mergeDaoMetadata } from './api/realmMetadata';
import {
  getAllGovernancesFromAllPrograms,
  getRealmIndexed,
  getRealmsIndexed,
  govOwners,
  getWalletGovernanceMemberships,
} from './api/queries';
import {
  fetchGovernanceLookupFile,
} from './CachedStorageHelpers';

import { fetchRecentDirectoryActivity } from './api/recentDirectoryActivity';

import { RPC_CONNECTION, GGAPI_STORAGE_POOL } from '../utils/grapeTools/constants';
import { buildParticipatingDirectory, directorySummary, directoryRealmKey, rankDirectoryByProposals } from './directorySummary';

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
  return directoryRealmKey(item);
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
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [filterVerified, setFilterVerified] = React.useState(false);

  const [visibleCount, setVisibleCount] = React.useState(48);

  const [walletMemberships, setWalletMemberships] = React.useState<any[]>([]);
  const [membershipWallet, setMembershipWallet] = React.useState('');
  const [walletFavoritesLoading, setWalletFavoritesLoading] = React.useState(false);
  const [walletError, setWalletError] = React.useState<string | null>(null);
  const [walletRefresh, setWalletRefresh] = React.useState(0);
  const [recentProposals, setRecentProposals] = React.useState<any[]>([]);
  const [activityStatus, setActivityStatus] = React.useState('Checking recent proposals…');
  React.useEffect(() => {
    let cancelled = false;
    setActivityStatus('Checking recent proposals…');
    fetchRecentDirectoryActivity(RPC_CONNECTION, [DEFAULT_GOVERNANCE_PROGRAM_NAME, ...govOwners.map(owner => owner.owner)])
      .then(result => {
        if (cancelled) return;
        setRecentProposals(result.proposals);
        setActivityStatus(result.partial ? 'Recent activity is incomplete' : result.proposals.length ? `New proposals first · ${result.scanned} recent transactions checked` : `No new proposals found in ${result.scanned} recent transactions`);
      }).catch(() => { if (!cancelled) setActivityStatus('Recent activity unavailable'); });
    return () => { cancelled = true; };
  }, [walletRefresh]);
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

        const [gsplEntriesRaw, cachedLookupRaw] = await Promise.all([
          initGrapeGovernanceDirectory().catch(() => []),
          fetchGovernanceLookupFile(GGAPI_STORAGE_POOL).catch(() => null),
        ]);

        const gsplEntries = Array.isArray(gsplEntriesRaw) ? gsplEntriesRaw : [];
        const gqlDirectory: any[] = [];
        const votingProposalsByGovernance = {};
        const cachedLookup = Array.isArray(cachedLookupRaw) ? cachedLookupRaw : [];
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
    setWalletMemberships([]);
    setMembershipWallet(walletAddress);
    setWalletError(null);
    setWalletFavoritesLoading(!!walletAddress);
    if (!walletAddress) return;

    const load = async () => {
      try {
        const { records, failedPrograms } = await getWalletGovernanceMemberships(walletAddress);
        if (cancelled) return;
        // Keep membership records even when voting power is held by a plugin.
        setWalletMemberships(records);
        if (failedPrograms.length) {
          setWalletError('Some DAOs could not be checked. Retry to complete your memberships.');
        }
      } catch (error) {
        if (!cancelled) setWalletError('Unable to check your DAOs. Please retry.');
      } finally {
        if (!cancelled) setWalletFavoritesLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [walletAddress, walletRefresh]);

  const sortedGovernances = React.useMemo(() =>
    rankDirectoryByProposals(governanceLookup, recentProposals), [governanceLookup, recentProposals]);

  const filteredGovernances = React.useMemo(() => {
    const query = (searchFilter || '').trim();
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);

    return sortedGovernances.filter((item: GovernanceLookupItem) => {
      if (filterVerified && !item?.gspl) return false;

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
    metadataMap,
    mythicMetadataMap,
  ]);

  const favoriteGovernances = React.useMemo(() =>
    rankDirectoryByProposals(buildParticipatingDirectory(
      membershipWallet === walletAddress ? walletMemberships : [], governanceLookup
    ), recentProposals), [walletMemberships, governanceLookup, membershipWallet, walletAddress, recentProposals]);

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
    setVisibleCount(viewMode === 'grid' ? 48 : 80);
  }, [viewMode, searchFilter, filterVerified]);

  React.useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      const lookahead = visibleCount;
      const metadataUris = Array.from(
        new Set(
          [...favoriteGovernances, ...nonFavoriteGovernances.slice(0, lookahead)]
            .map((item) => item?.gspl?.metadataUri)
            .filter((uri) => typeof uri === 'string' && uri.length > 0)
        )
      ).filter((uri) => !Object.prototype.hasOwnProperty.call(metadataMap, uri) && !metadataInFlight.current.has(uri));

      if (!metadataUris.length) return;

      const batch = metadataUris.slice(0, 10);
      for (const uri of batch) metadataInFlight.current.add(uri);

      const fetchedEntries = await Promise.all(
        batch.map(async (uri) => {
          try {
            const response = await fetch(uri);
            if (!response.ok) return [uri, null] as const;
            const metadata = await response.json();
            return [uri, metadata] as const;
          } catch (_e) {
            return [uri, null] as const;
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
      const lookahead = visibleCount;
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
            if (!realm) return [realmAddress, null] as const;
            const metadata = { displayName: realm.account?.name, ...await fetchMythicRealmMetadata(realm) };
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

  const hasMoreGovernances = displayedGovernances.length < nonFavoriteGovernances.length;
  const summary = React.useMemo(() => directorySummary(governanceLookup), [governanceLookup]);

  const clearFilters = () => {
    setSearchFilter('');
    setFilterVerified(false);
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
          'linear-gradient(160deg, #111923, #0c1017 65%)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="overline" sx={{ color: '#89a8bd', letterSpacing: 2 }}>GOVERNANCE / SOLANA</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -1 }}>Discover your next decision.</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>Your DAOs, their latest proposals, and a place to take part.</Typography>
        </Box>
        <CreateSplGovernanceDaoButton />
      </Stack>
      <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap" sx={{ mb: 2.5, color: 'text.secondary' }}>
        <Typography variant="body2"><strong style={{ color: '#eef4fa' }}>{summary.daos.toLocaleString()}</strong> DAOs in directory</Typography>
        <Typography variant="body2"><strong style={{ color: '#eef4fa' }}>{summary.verified.toLocaleString()}</strong> verified</Typography>
        {walletAddress && <Typography variant="body2"><strong style={{ color: '#eef4fa' }}>{favoriteGovernances.length}</strong> memberships</Typography>}
      </Stack>
      <Typography variant="caption" title="Checks up to 100 recent governance transactions, then ranks the proposals found. Results are reused for five minutes. This is not a complete global proposal feed." sx={{ display: 'block', mb: 1.5, color: '#89a8bd' }}>{activityStatus}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
        <TextField fullWidth size="small" placeholder="Find a DAO" value={searchFilter}
          onChange={event => setSearchFilter(event.target.value)}
          inputProps={{ 'aria-label': 'Search DAOs' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip icon={<VerifiedIcon />} label="Verified" variant={filterVerified ? 'filled' : 'outlined'}
            color={filterVerified ? 'primary' : 'default'} onClick={() => setFilterVerified(value => !value)} />
          <ToggleButtonGroup exclusive size="small" value={viewMode} onChange={(_, mode) => mode && setViewMode(mode)}>
            <ToggleButton value="grid" aria-label="Grid view"><ViewModuleIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="list" aria-label="List view"><ViewListIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} disabled={refreshing}
            onClick={() => { void loadGovernanceDirectory(true); setWalletRefresh(value => value + 1); }}>Refresh</Button>
        </Stack>
      </Stack>
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
          p: 0,
        }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }} useFlexGap flexWrap="wrap">
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.25 }}>
              Participating DAOs
            </Typography>
            <Chip
              size="small"
              icon={<HowToVoteIcon />}
              label={
                walletFavoritesLoading || membershipWallet !== walletAddress
                  ? 'Checking your DAOs...'
                  : `${favoriteGovernances.length} DAO${favoriteGovernances.length === 1 ? '' : 's'}`
              }
              variant="outlined"
              sx={{ borderRadius: '999px' }}
            />
          </Stack>

          <Typography variant="body2" sx={{ opacity: 0.78, mb: walletFavoritesLoading ? 1 : 1.25 }}>
            Communities you’ve joined or represent.
          </Typography>

          {walletError && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Typography role="status" variant="body2" color="warning.main">{walletError}</Typography>
              <Button size="small" onClick={() => setWalletRefresh(value => value + 1)}>Retry</Button>
            </Stack>
          )}
          {walletFavoritesLoading || membershipWallet !== walletAddress ? (
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
                    <GovernanceDirectoryCardView item={item} metadata={metadata} directoryOnly />
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
                {walletError ? 'Membership results are incomplete.' : 'No DAO membership records found for this wallet.'}
              </Typography>
            </Box>
          )}
        </Box>
      )}


      {nonFavoriteGovernances.length > 0 && (
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: -0.25, mt: 3, mb: 1.5 }}>
          All Other DAOs
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
                <GovernanceDirectoryCardView item={item} metadata={metadata} directoryOnly />
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

      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mt: 3, opacity: 0.65 }}>
        {[['Grape DAO', 'https://grapedao.org'], ['Reputation', 'https://vine.governance.so'], ['Verification', 'https://verification.governance.so']].map(([label, href]) => (
          <Button key={href} component="a" href={href} target="_blank" rel="noopener noreferrer" size="small" color="inherit">{label}</Button>
        ))}
      </Stack>
      {hasMoreGovernances && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            onClick={() => setVisibleCount((current) => current + (viewMode === 'grid' ? 36 : 60))}
          >
            Load More ({nonFavoriteGovernances.length - displayedGovernances.length} remaining)
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
