import React from 'react';

import {
  Box,
  Button,
  ButtonGroup,
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
  Tooltip,
  Typography,
  useScrollTrigger,
} from '@mui/material/';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BallotIcon from '@mui/icons-material/Ballot';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import SortIcon from '@mui/icons-material/Sort';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import SearchIcon from '@mui/icons-material/Search';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewListIcon from '@mui/icons-material/ViewList';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import VerifiedIcon from '@mui/icons-material/Verified';
import RefreshIcon from '@mui/icons-material/Refresh';

import { PublicKey } from '@solana/web3.js';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernanceDirectoryCardView from './GovernanceDirectoryCardView';

import { initGrapeGovernanceDirectory } from './api/gspl_queries';
import { buildDirectoryFromGraphQL } from './api/queries';
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

type GovernanceLookupItem = {
  governanceAddress: string;
  governanceName: string;
  communityMint?: string;
  councilMint?: string;
  totalMembers: number;
  totalProposals: number;
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
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [searchFilter, setSearchFilter] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');
  const [filterVerified, setFilterVerified] = React.useState(false);
  const [filterActiveVoting, setFilterActiveVoting] = React.useState(false);
  const [filterHasTreasury, setFilterHasTreasury] = React.useState(false);

  const [sortingType, setSortingType] = React.useState<number>(3);
  const [sortingDirection, setSortingDirection] = React.useState<0 | 1>(0);

  const [gspl, setGSPL] = React.useState<any[]>([]);
  const [governanceTotalMembers, setGovernanceTotalMembers] = React.useState(0);
  const [governanceTotalProposals, setGovernanceTotalProposals] = React.useState(0);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncSource, setSyncSource] = React.useState<'graphql' | 'cache' | 'mixed'>('graphql');

  const buildMergedDirectory = React.useCallback(
    (
      gqlDirectory: any[],
      votingProposalsByGovernance: Record<string, any[]>,
      cachedLookup: any[],
      gsplEntries: any[]
    ) => {
      const cacheByGovernance = new Map<string, any>();
      for (const item of cachedLookup || []) {
        const key = governanceKey(item?.governanceAddress);
        if (key) cacheByGovernance.set(key, item);
      }

      const gsplByName = new Map<string, any>();
      for (const gsplEntry of gsplEntries || []) {
        const name = String(gsplEntry?.name || '')
          .trim()
          .toLowerCase();
        if (name) gsplByName.set(name, gsplEntry);
      }

      const mergedItems: GovernanceLookupItem[] = [];
      const seen = new Set<string>();

      for (const gqlItem of gqlDirectory || []) {
        const governanceAddress = governanceKey(gqlItem?.governanceAddress);
        if (!governanceAddress) continue;

        const cachedItem = cacheByGovernance.get(governanceAddress) || {};
        const governanceName =
          cachedItem?.governanceName || `Governance ${governanceAddress.slice(0, 6)}...`;

        const gsplMatch =
          cachedItem?.gspl ||
          gsplByName.get(
            String(governanceName)
              .trim()
              .toLowerCase()
          );

        const votingProposals = Array.isArray(votingProposalsByGovernance?.[governanceAddress])
          ? votingProposalsByGovernance[governanceAddress]
          : [];

        mergedItems.push({
          ...cachedItem,
          governanceAddress,
          governanceName,
          gspl: gsplMatch,
          votingProposals,
          totalMembers: toNumeric(cachedItem?.totalMembers, 0),
          totalProposals: toNumeric(gqlItem?.totalProposals, toNumeric(cachedItem?.totalProposals, 0)),
          totalProposalsVoting: toNumeric(
            gqlItem?.totalProposalsVoting,
            votingProposals.length || toNumeric(cachedItem?.totalProposalsVoting, 0)
          ),
          totalVaultValue: toNumeric(cachedItem?.totalVaultValue, 0),
          totalVaultStableCoinValue: toNumeric(cachedItem?.totalVaultStableCoinValue, 0),
          totalVaultSol: toNumeric(cachedItem?.totalVaultSol, 0),
          totalVaultSolValue: toNumeric(cachedItem?.totalVaultSolValue, 0),
          lastProposalDate:
            gqlItem?.lastProposalDate && gqlItem.lastProposalDate !== '0'
              ? gqlItem.lastProposalDate
              : cachedItem?.lastProposalDate || '0',
        });

        seen.add(governanceAddress);
      }

      for (const cachedItem of cachedLookup || []) {
        const governanceAddress = governanceKey(cachedItem?.governanceAddress);
        if (!governanceAddress || seen.has(governanceAddress)) continue;

        const governanceName =
          cachedItem?.governanceName || `Governance ${governanceAddress.slice(0, 6)}...`;
        const gsplMatch =
          cachedItem?.gspl ||
          gsplByName.get(
            String(governanceName)
              .trim()
              .toLowerCase()
          );

        const votingProposals = Array.isArray(votingProposalsByGovernance?.[governanceAddress])
          ? votingProposalsByGovernance[governanceAddress]
          : [];

        mergedItems.push({
          ...cachedItem,
          governanceAddress,
          governanceName,
          gspl: gsplMatch,
          votingProposals,
          totalMembers: toNumeric(cachedItem?.totalMembers, 0),
          totalProposals: toNumeric(cachedItem?.totalProposals, 0),
          totalProposalsVoting: votingProposals.length || toNumeric(cachedItem?.totalProposalsVoting, 0),
          totalVaultValue: toNumeric(cachedItem?.totalVaultValue, 0),
          totalVaultStableCoinValue: toNumeric(cachedItem?.totalVaultStableCoinValue, 0),
          totalVaultSol: toNumeric(cachedItem?.totalVaultSol, 0),
          totalVaultSolValue: toNumeric(cachedItem?.totalVaultSolValue, 0),
          lastProposalDate: cachedItem?.lastProposalDate || '0',
        });
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
        const [gsplEntriesRaw, graphQLResult, cachedLookupRaw, masterMembersRaw] = await Promise.all([
          initGrapeGovernanceDirectory().catch(() => []),
          buildDirectoryFromGraphQL({ includeMembers: false, proposalScanLimit: 5000 }).catch(
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

        const mergedDirectory = buildMergedDirectory(
          gqlDirectory,
          votingProposalsByGovernance,
          cachedLookup,
          gsplEntries
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

  React.useEffect(() => {
    let cancelled = false;

    const fetchMetadata = async () => {
      const metadataUris = Array.from(
        new Set(
          governanceLookup
            .map((item) => item?.gspl?.metadataUri)
            .filter((uri) => typeof uri === 'string' && uri.length > 0)
        )
      ).filter((uri) => !metadataMap[uri]);

      if (!metadataUris.length) return;

      const fetchedEntries = await Promise.all(
        metadataUris.map(async (uri) => {
          try {
            const response = await fetch(uri);
            if (!response.ok) {
              return null;
            }

            const metadata = await response.json();
            return [uri, metadata] as const;
          } catch (_e) {
            return null;
          }
        })
      );

      if (cancelled) return;

      setMetadataMap((currentMap) => {
        const nextMap = { ...currentMap };
        for (const entry of fetchedEntries) {
          if (entry) {
            nextMap[entry[0]] = entry[1];
          }
        }
        return nextMap;
      });
    };

    fetchMetadata();

    return () => {
      cancelled = true;
    };
  }, [governanceLookup, metadataMap]);

  const sortedGovernances = React.useMemo(() => {
    const items = [...governanceLookup];

    const pickSortValue = (item: GovernanceLookupItem) => {
      if (sortingType === 1) return toNumeric(item?.totalMembers, 0);
      if (sortingType === 2) return toNumeric(item?.totalProposals, 0);
      if (sortingType === 3) return toNumeric(item?.totalProposalsVoting, 0);
      if (sortingType === 4) return toNumeric(item?.totalVaultValue, 0);
      if (sortingType === 5) return Number(`0x${item?.lastProposalDate || '0'}`);
      if (sortingType === 6) return toNumeric(item?.totalVaultStableCoinValue, 0);
      return toNumeric(item?.totalProposalsVoting, 0);
    };

    items.sort((a, b) => {
      const aValue = pickSortValue(a);
      const bValue = pickSortValue(b);
      if (aValue === bValue) return 0;

      const directionMultiplier = sortingDirection === 0 ? -1 : 1;
      return aValue > bValue ? directionMultiplier : -directionMultiplier;
    });

    return items;
  }, [governanceLookup, sortingType, sortingDirection]);

  const filteredGovernances = React.useMemo(() => {
    const query = (searchFilter || '').trim();
    const normalizedQuery = query.replace(/\s+/g, '').toUpperCase();

    return sortedGovernances.filter((item: GovernanceLookupItem) => {
      if (filterVerified && !item?.gspl) return false;
      if (filterActiveVoting && !(toNumeric(item?.totalProposalsVoting, 0) > 0)) return false;

      const treasuryValue =
        toNumeric(item?.totalVaultValue, 0) + toNumeric(item?.totalVaultStableCoinValue, 0);
      if (filterHasTreasury && !(treasuryValue > 0)) return false;

      if (!query) return true;

      const metadata = item?.gspl?.metadataUri ? metadataMap[item.gspl.metadataUri] : null;
      const searchableName = String(
        metadata?.displayName || item?.governanceName || item?.governanceAddress || ''
      )
        .replace(/\s+/g, '')
        .toUpperCase();

      if (searchableName.includes(normalizedQuery)) return true;

      if (isValidSolanaPublicKey(query)) {
        return (
          String(item?.governanceAddress || '').includes(query) ||
          String(item?.communityMint || '').includes(query) ||
          String(item?.councilMint || '').includes(query)
        );
      }

      return false;
    });
  }, [
    sortedGovernances,
    searchFilter,
    filterVerified,
    filterActiveVoting,
    filterHasTreasury,
    metadataMap,
  ]);

  const totalLiveProposals = React.useMemo(
    () =>
      governanceLookup.reduce(
        (sum, item) => sum + toNumeric(item?.totalProposalsVoting, 0),
        0
      ),
    [governanceLookup]
  );

  const activeSortLabel =
    sortingType === 1
      ? 'Members'
      : sortingType === 2
      ? 'Proposals'
      : sortingType === 3
      ? 'Voting'
      : sortingType === 4
      ? 'Treasury'
      : sortingType === 5
      ? 'Latest'
      : 'Stablecoin Treasury';

  const syncSourceLabel =
    syncSource === 'graphql' ? 'GraphQL' : syncSource === 'mixed' ? 'GraphQL + cache' : 'Cache fallback';

  const syncTimeLabel = lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Not synced yet';

  const sortGovernance = (type: number) => {
    if (sortingType === type) {
      setSortingDirection((direction) => (direction === 0 ? 1 : 0));
    } else {
      setSortingType(type);
      setSortingDirection(0);
    }
  };

  const clearFilters = () => {
    setSearchFilter('');
    setFilterVerified(false);
    setFilterActiveVoting(false);
    setFilterHasTreasury(false);
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
            <Chip size="small" label={`Sorted by ${activeSortLabel}`} variant="outlined" />
          </Stack>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box
            sx={{
              position: 'sticky',
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

              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
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
                    icon={<AccountBalanceIcon />}
                    label="Has treasury"
                    color={filterHasTreasury ? 'primary' : 'default'}
                    variant={filterHasTreasury ? 'filled' : 'outlined'}
                    size="small"
                    onClick={() => setFilterHasTreasury((value) => !value)}
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

              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
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

      <Box sx={{ mb: 1.5 }}>
        <ButtonGroup color="inherit" size="small" variant="outlined" sx={{ borderRadius: '17px' }}>
          <Tooltip title="Sort by members">
            <Button onClick={() => sortGovernance(1)}>
              <GroupIcon />
              {sortingType === 1 &&
                (sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{ transform: 'scaleX(-1)' }} />)}
            </Button>
          </Tooltip>

          <Tooltip title="Sort by total proposals">
            <Button onClick={() => sortGovernance(2)}>
              <BallotIcon />
              {sortingType === 2 &&
                (sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{ transform: 'scaleX(-1)' }} />)}
            </Button>
          </Tooltip>

          <Tooltip title="Sort by proposals currently in voting">
            <Button onClick={() => sortGovernance(3)}>
              <HowToVoteIcon />
              {sortingType === 3 &&
                (sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{ transform: 'scaleX(-1)' }} />)}
            </Button>
          </Tooltip>

          <Tooltip title="Sort by latest proposal timestamp">
            <Button onClick={() => sortGovernance(5)}>
              <AccessTimeIcon />
              {sortingType === 5 &&
                (sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{ transform: 'scaleX(-1)' }} />)}
            </Button>
          </Tooltip>

          <Tooltip title="Sort by treasury value">
            <Button onClick={() => sortGovernance(4)}>
              <AccountBalanceIcon />
              {sortingType === 4 &&
                (sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{ transform: 'scaleX(-1)' }} />)}
            </Button>
          </Tooltip>

          <Tooltip title="Sort by stablecoin treasury value">
            <Button onClick={() => sortGovernance(6)}>
              <AttachMoneyIcon />
              {sortingType === 6 &&
                (sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{ transform: 'scaleX(-1)' }} />)}
            </Button>
          </Tooltip>
        </ButtonGroup>
      </Box>

      {!searchFilter && filteredGovernances.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <GovernanceRealtimeInfo
            governanceLookup={governanceLookup}
            governanceAddress={'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'}
            title={'Latest Activity'}
            expanded={true}
          />
        </Box>
      )}

      {filteredGovernances.length > 0 ? (
        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }} sx={{ mt: 0.5 }}>
          {filteredGovernances.map((item: GovernanceLookupItem, key: number) => {
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

      <ScrollTop {...props}>
        <Fab size="small" aria-label="scroll back to top">
          <KeyboardArrowUpIcon />
        </Fab>
      </ScrollTop>
    </Box>
  );
}
