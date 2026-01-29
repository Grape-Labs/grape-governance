// GovernanceTreasury.tsx (drop-in updated)
// Changes:
// - Loads token list (tokenMap) on mount
// - Fixes React keys (no duplicate key={1})
// - Refetches when route params change
// - Safer async lifecycle + cancellation to avoid stale setState
// - Memoizes totals
// - Sorts wallet cards by treasury value (walletValue desc)
//   (WalletCardView should update item.walletValue and trigger a state tick)

import React from 'react';
import { PublicKey } from '@solana/web3.js';
import { ENV, TokenListProvider } from '@solana/spl-token-registry';
import { getMint } from "@solana/spl-token-v2";

import { useWallet } from '@solana/wallet-adapter-react';
import { useParams } from "react-router-dom";

import {
  Typography,
  Button,
  Grid,
  Box,
  Tooltip,
  LinearProgress,
} from '@mui/material/';

import WalletCardView from './Treasury/WalletCardView';
import { GovernanceHeaderView } from './GovernanceHeaderView';
import GovernanceNavigation from './GovernanceNavigation';

import {
  getRealmIndexed,
  getAllGovernancesIndexed,
} from '../Governance/api/queries';

import { getNativeTreasuryAddress } from '@solana/spl-governance';
import { initGrapeGovernanceDirectory } from './api/gspl_queries';

import {
  RPC_CONNECTION,
  GGAPI_STORAGE_POOL
} from '../utils/grapeTools/constants';

export function GovernanceTreasuryView(props: any) {
  const { address } = useParams<{ address: string }>();
  const { rules } = useParams<{ rules: string }>();

  const governanceAddress = address;
  const filterRulesWallet = rules;

  const [storagePool] = React.useState(GGAPI_STORAGE_POOL);

  const [startTime, setStartTime] = React.useState<number | null>(null);
  const [endTime, setEndTime] = React.useState<number | null>(null);

  const [loading, setLoading] = React.useState(false);

  const [realm, setRealm] = React.useState<any>(null);
  const [realmName, setRealmName] = React.useState<string | null>(null);

  const [tokenMap, setTokenMap] = React.useState<Map<string, any> | null>(null);
  const [tokenArray, setTokenArray] = React.useState<{ address: string; decimals: number }[] | null>(null);

  const [governanceValue, setGovernanceValue] = React.useState<any[]>([]);
  const [communityMintDecimals, setCommunityMintDecimals] = React.useState(0);

  const [governanceWallets, setGovernanceWallets] = React.useState<any[] | null>(null);

  const [gsplMetadata, setGSPLMetadata] = React.useState<any>(null);

  // forces re-render when children mutate wallet objects (walletValue) in-place
  const [walletSortTick, setWalletSortTick] = React.useState(0);

  const { publicKey } = useWallet(); // kept (even if unused) so drop-in won't break other edits

  const getTokens = React.useCallback(async () => {
    const tarray: { address: string; decimals: number }[] = [];
    try {
      const tokens = await new TokenListProvider().resolve();
      const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();

      const tokenMp = tokenList.reduce((map, item) => {
        tarray.push({ address: item.address, decimals: item.decimals });
        map.set(item.address, item);
        return map;
      }, new Map<string, any>());

      setTokenMap(tokenMp);
      setTokenArray(tarray);

      return tokenMp;
    } catch (e) {
      console.log("ERR(getTokens): " + e);
      return null;
    }
  }, []);

  const fetchRealm = React.useCallback(async (addr: string) => {
    if (!addr) return;

    const rlm = await getRealmIndexed(addr);
    if (!rlm) return;

    try {
      if (rlm?.account?.communityMint && rlm.account.communityMint.toBase58()) {
        const mintInfo = await getMint(RPC_CONNECTION, rlm.account.communityMint);
        setCommunityMintDecimals(mintInfo.decimals || 0);
      }
    } catch (e) {
      console.log("ERR(fetchRealm mint): " + e);
    }

    setRealm(rlm);
    setRealmName(rlm.account?.name || null);
  }, []);

  // main loader: gets all governances, computes native treasury, loads GSPL metadata
  const fetchGovernances = React.useCallback(async (addr: string, rlm: any, rulesWallet?: string | null) => {
    const tmpGovernanceAddresses = await getAllGovernancesIndexed(addr);

    if (!tmpGovernanceAddresses || !rlm) {
      setGovernanceWallets([]);
      return;
    }

    const governanceAddresses: any[] = [];
    for (const item of tmpGovernanceAddresses) {
      if (rulesWallet) {
        if (rulesWallet === item.pubkey.toBase58()) governanceAddresses.push(item);
      } else {
        governanceAddresses.push(item);
      }
    }

    // compute native treasuries
    const rawNativeSolAddresses = await Promise.all(
      governanceAddresses.map((x) =>
        getNativeTreasuryAddress(
          // rlm.owner can be string or PublicKey-ish depending on source
          new PublicKey(rlm.owner),
          x!.pubkey
        )
      )
    );

    if (governanceAddresses.length === rawNativeSolAddresses.length) {
      for (let i = 0; i < governanceAddresses.length; i++) {
        governanceAddresses[i].nativeTreasuryAddress = rawNativeSolAddresses[i];
        // WalletCardView can update this with actual $ value later
        governanceAddresses[i].walletValue = governanceAddresses[i].walletValue || 0;
      }
    }

    setGovernanceWallets(governanceAddresses);

    // GSPL directory + optional metadata json
    try {
      const fetchedgspl = await initGrapeGovernanceDirectory();
      let gsplMeta: any = null;

      if (fetchedgspl && rlm) {
        for (const diritem of fetchedgspl) {
          if (rlm.account?.name === diritem.name) {
            if (diritem.metadataUri) {
              try {
                const response = await fetch(diritem.metadataUri);
                if (response.ok) {
                  const metadata = await response.json();
                  gsplMeta = { gspl: diritem, metadata };
                } else {
                  console.error("Failed to fetch metadata:", diritem.metadataUri);
                }
              } catch (error) {
                console.error("Error fetching metadata:", error);
              }
            }
            if (!gsplMeta) gsplMeta = { gspl: diritem };
            break;
          }
        }
      }

      setGSPLMetadata(gsplMeta);
    } catch (e) {
      console.log("ERR(fetchGovernances gspl): " + e);
    }
  }, []);

  // load token map once
  React.useEffect(() => {
    getTokens();
  }, [getTokens]);

  // refetch realm whenever address changes
  React.useEffect(() => {
    setRealm(null);
    setRealmName(null);
    setGovernanceWallets(null);
    setGovernanceValue([]);
    setGSPLMetadata(null);
    setStartTime(null);
    setEndTime(null);

    if (governanceAddress) fetchRealm(governanceAddress);
  }, [governanceAddress, fetchRealm]);

  // when realm is available, fetch governances (and treasuries)
  React.useEffect(() => {
    if (!realm || !governanceAddress) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setStartTime(Date.now());
      setEndTime(null);

      try {
        await fetchGovernances(governanceAddress, realm, filterRulesWallet || null);
      } catch (e) {
        console.log("ERR(fetchGovernances effect): " + e);
      } finally {
        if (!cancelled) {
          setEndTime(Date.now());
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [realm, governanceAddress, filterRulesWallet, fetchGovernances]);

  // totals (memoized)
  const totals = React.useMemo(() => {
    const totalVal = (governanceValue || []).reduce((s, i) => s + (Number(i?.totalVal) || 0), 0);
    const stableVal = (governanceValue || []).reduce((s, i) => s + (Number(i?.stableAccountVal) || 0), 0);
    const solVal = (governanceValue || []).reduce((s, i) => s + (Number(i?.solAccountVal) || 0), 0);
    const solHeld = (governanceValue || []).reduce((s, i) => s + (Number(i?.totalGovernanceSol) || 0), 0);
    return { totalVal, stableVal, solVal, solHeld };
  }, [governanceValue]);

  // sort wallets by walletValue (desc). walletSortTick forces resort when children mutate item.walletValue.
  const sortedWallets = React.useMemo(() => {
    const arr = Array.isArray(governanceWallets) ? [...governanceWallets] : [];
    arr.sort((a: any, b: any) => (Number(b?.walletValue) || 0) - (Number(a?.walletValue) || 0));
    return arr;
  }, [governanceWallets, walletSortTick]);

  const formatUSD = (n: number) =>
    `$${Number((Number(n) || 0).toFixed(2)).toLocaleString()}`;

  const toTreasuryBase58 = (nativeTreasuryAddress: any) => {
    try {
      const pk = nativeTreasuryAddress instanceof PublicKey
        ? nativeTreasuryAddress
        : new PublicKey(nativeTreasuryAddress);
      return pk.toBase58();
    } catch (e) {
      return "";
    }
  };

  return (
    <>
      {(loading && !governanceWallets) ? (
        <Box
          sx={{
            mt: 6,
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '17px',
            p: 4,
            alignItems: 'center',
            textAlign: 'center'
          }}
        >
          <Typography variant="caption">Loading Governance Treasury {governanceAddress}</Typography>
          <LinearProgress color="inherit" />
        </Box>
      ) : (
        <Box
          sx={{
            mt: 6,
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '17px',
            overflow: 'hidden',
            p: 1,
          }}
        >
          {realmName && (
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
          )}

          {filterRulesWallet ? null : (
            <Box sx={{ p: 1 }}>
              <Grid container spacing={1}>
                <Grid item xs={12} md={4} lg={4} key="total">
                  <Box sx={{ borderRadius: '24px', m: 0, p: 1, background: 'rgba(0, 0, 0, 0.2)' }}>
                    <Typography variant="body2" sx={{ color: '#2ecc71' }}>
                      <>Treasury</>
                    </Typography>

                    <Box sx={{ borderRadius: '17px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Tooltip title={<>Total Token Value (value does not include NFT floor prices)</>}>
                        <Button color="inherit" sx={{ borderRadius: '17px' }}>
                          <Grid container sx={{ verticalAlign: 'bottom', textAlign: 'center' }}>
                            <Typography variant="h4" sx={{ textAlign: 'center' }}>
                              {formatUSD(totals.totalVal)}
                            </Typography>
                          </Grid>
                        </Button>
                      </Tooltip>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4} lg={4} key="stable">
                  <Box sx={{ borderRadius: '24px', m: 0, p: 1, background: 'rgba(0, 0, 0, 0.2)' }}>
                    <Typography variant="body2" sx={{ color: '#2ecc71' }}>
                      <>Stable Coin Treasury</>
                    </Typography>

                    <Box sx={{ borderRadius: '17px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Tooltip title={<>Total Value in stable coins</>}>
                        <Button color="inherit" sx={{ borderRadius: '17px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <Grid container sx={{ verticalAlign: 'bottom' }}>
                            <Typography variant="h4" sx={{ textAlign: 'center' }}>
                              {formatUSD(totals.stableVal)}
                            </Typography>
                          </Grid>
                        </Button>
                      </Tooltip>
                    </Box>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4} lg={4} key="sol">
                  <Box sx={{ borderRadius: '24px', m: 0, p: 1, background: 'rgba(0, 0, 0, 0.2)' }}>
                    <Typography variant="body2" sx={{ color: '#2ecc71' }}>
                      <>Solana Treasury</>
                    </Typography>

                    <Box sx={{ borderRadius: '17px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <Tooltip title={<>Total Value in <strong>{Number(totals.solHeld.toFixed(2)).toLocaleString()}</strong> SOL held</>}>
                        <Button color="inherit" sx={{ borderRadius: '17px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <Grid container sx={{ verticalAlign: 'bottom' }}>
                            <Typography variant="h4" sx={{ textAlign: 'center' }}>
                              {formatUSD(totals.solVal)}
                            </Typography>
                          </Grid>
                        </Button>
                      </Tooltip>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          <Box sx={{ mt: 2, mb: 2 }}>
            <Grid
              container
              spacing={4}
              direction="row"
              justifyContent="center"
              alignItems="flex-start"
            >
              {sortedWallets.map((item: any) => {
                const key = item?.pubkey?.toBase58?.() || toTreasuryBase58(item.nativeTreasuryAddress) || Math.random().toString(36);
                const walletAddress = toTreasuryBase58(item.nativeTreasuryAddress);

                return (
                  <Grid key={key} item lg={4} md={6} sm={12} xs={12}>
                    <WalletCardView
                      realm={realm}
                      rulesWallet={item}
                      governanceWallets={governanceWallets}
                      governanceAddress={governanceAddress}
                      setGovernanceValue={setGovernanceValue}
                      governanceValue={governanceValue}
                      communityMintDecimals={communityMintDecimals}
                      tokenMap={tokenMap}
                      onWalletValueUpdated={() => setWalletSortTick((x) => x + 1)}
                      walletAddress={new PublicKey(item.nativeTreasuryAddress).toBase58()}
                    />
                  </Grid>
                );
              })}
            </Grid>
          </Box>

          {endTime != null && startTime != null && (
            <Typography variant="caption" sx={{ textAlign: 'center' }}>
              Rendering Time: {Math.floor(((endTime - startTime) / 1000) % 60)}s ({Math.floor(endTime - startTime)}ms) Realtime<br />
              Cache Node: {storagePool}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}