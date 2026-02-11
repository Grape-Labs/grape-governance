import { DataGrid, GridColDef } from '@mui/x-data-grid';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { PublicKey, Connection, TransactionInstruction, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { Chip, Divider, Button, ButtonGroup, Grid, Typography, Box, LinearProgress, TextField, CircularProgress, Tooltip, IconButton } from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSnackbar } from 'notistack';
import { RPC_CONNECTION } from '../utils/grapeTools/constants';
import ExplorerView from '../utils/grapeTools/Explorer';

import { RenderDescription } from "./RenderDescription";

import { 
    getRealmIndexed,
    getAllProposalsFromAllPrograms,
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    fetchRealmNameFromRulesWallet,
    getTokenOwnerRecordsByOwnerIndexed
} from './api/queries';

import GetGovernanceFromRulesView from './GetGovernanceFromRules';

import moment from 'moment';

import LinkIcon from '@mui/icons-material/Link';
import ShareIcon from '@mui/icons-material/Share';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { filterE } from 'fp-ts/lib/Witherable';

import InputAdornment from "@mui/material/InputAdornment";
import WalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ClearIcon from "@mui/icons-material/Clear";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import BoltIcon from "@mui/icons-material/Bolt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RefreshIcon from "@mui/icons-material/Refresh";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import HowToVoteIcon from "@mui/icons-material/HowToVote";
import GroupsIcon from "@mui/icons-material/Groups";
import DescriptionIcon from "@mui/icons-material/Description";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import {
  Card,
  CardContent,
  Stack,
  Tabs,
  Tab,
  Avatar,
  Skeleton,
  Paper,
} from "@mui/material";

import { GridToolbar } from "@mui/x-data-grid";

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 15,
  borderRadius: '17px',
  [`& .MuiLinearProgress-bar`]: {
    borderRadius: '0px',
    backgroundColor: theme.palette.mode === 'light' ? '#1a90ff' : '#ffffff',
  },
}));


function shortenPk(pk: string, n = 4) {
  if (!pk) return "";
  if (pk.length <= n * 2 + 3) return pk;
  return `${pk.slice(0, n)}…${pk.slice(-n)}`;
}

function sumVotes(rows: any[]) {
  // votes stored as locale string currently; best effort parse:
  // "1,234.56" -> 1234.56 (works for en-US; if you need i18n-safe, store numeric too)
  let total = 0;
  for (const r of rows || []) {
    const v = Number(String(r.governingTokenDepositAmount).replace(/,/g, ""));
    if (!Number.isNaN(v)) total += v;
  }
  return total;
}

export function MyGovernanceView(props: any){
  const { walletAddress } = useParams();
  const [pubkey, setPubkey] = React.useState(walletAddress || props?.pubkey || '');
  const [governanceRecordRows, setGovernanceRecordRows] = React.useState<any[]>([]);
  const [createdProposals, setCreatedProposals] = React.useState<any[]>([]);
  const [participatingDaos, setParticipatingDaos] = React.useState<any[]>([]);
  const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
  const [loadingGovernance, setLoadingGovernance] = React.useState(false);
  const [refresh, setRefresh] = React.useState(true);
  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
    const [tab, setTab] = React.useState<0 | 1>(0);

  const daoCount = governanceRecordRows?.length || 0;
  const proposalCount = createdProposals?.length || 0;
  const totalVotes = sumVotes(governanceRecordRows);

    const councilCount = governanceRecordRows.filter((r) => r.memberType === "council").length;
    const communityCount = governanceRecordRows.filter((r) => r.memberType === "community").length;

    const [touched, setTouched] = React.useState(false);

const isValidPubkey = React.useMemo(() => {
  if (!pubkey) return false;
  try {
    // allow base58 pubkey
    new PublicKey(pubkey);
    return true;
  } catch {
    return false;
  }
}, [pubkey]);

const canLoad = !!pubkey && isValidPubkey && !loadingGovernance;

const loadNow = React.useCallback(() => {
  if (!isValidPubkey) {
    enqueueSnackbar("Invalid wallet address", { variant: "warning" });
    return;
  }
  setRefresh(true);
}, [isValidPubkey, enqueueSnackbar]);

const pasteFromClipboard = React.useCallback(async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) {
      setPubkey(t.trim());
      setTouched(true);
    }
  } catch {
    enqueueSnackbar("Clipboard access denied", { variant: "error" });
  }
}, [enqueueSnackbar]);

  const shareUrl = React.useMemo(() => {
    if (!pubkey) return "";
    return `${window.location.origin}/profile/${pubkey}`;
  }, [pubkey]);

  const governancecolumns: GridColDef[] = [
    { field: "governance", headerName: "Governance", minWidth: 180, flex: 1 },

    {
        field: "memberType",
        headerName: "Role",
        width: 140,
        sortable: true,
        renderCell: (params) => {
        const t = params.value as "council" | "community" | "unknown";
        if (t === "council") return <Chip size="small" label="Council" color="warning" variant="outlined" />;
        if (t === "community") return <Chip size="small" label="Community" color="success" variant="outlined" />;
        return <Chip size="small" label="Unknown" variant="outlined" />;
        },
    },

    {
        field: "governingTokenMint",
        headerName: "Governing Mint",
        width: 160,
        renderCell: (params) => (
        <ExplorerView
            address={params.value}
            type="address"
            shorten={4}
            style="text"
            color="white"
            fontSize="14px"
        />
        ),
    },

    { field: "governingTokenDepositAmount", headerName: "Votes", width: 140 },

    {
        field: "details",
        headerName: "",
        width: 150,
        renderCell: (params) => (
        <Button variant="contained" color="info" href={`/dao/${params.value}`} sx={{ borderRadius: "17px" }}>
            View
        </Button>
        ),
    },
    ];

  const fetchGovernance = async () => {
    const programId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
    setLoadingGovernance(true);

    try {
      const ownerRecords = await getTokenOwnerRecordsByOwnerIndexed(null, programId, new PublicKey(pubkey).toBase58());
      const rows = [];
      const daos = [];
      const mintArr = ownerRecords.map(o => new PublicKey(o.account.governingTokenMint));
      const mintResults = (await RPC_CONNECTION.getMultipleParsedAccounts(mintArr)).value;

      for (let i = 0; i < ownerRecords.length; i++) {
        const item = ownerRecords[i];
        const realm = await getRealmIndexed(item.account.realm.toBase58());
        const decimals = mintResults[i]?.data?.parsed?.info?.decimals || 0;
        const votes = (item.account.governingTokenDepositAmount.toNumber() / 10 ** decimals).toLocaleString();
        const torMint = item.account.governingTokenMint?.toBase58
        ? item.account.governingTokenMint.toBase58()
        : new PublicKey(item.account.governingTokenMint).toBase58();

        // SPL-Governance realm fields differ by indexer shape; handle both common ones:
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

        let memberType: "council" | "community" | "unknown" = "unknown";
        if (councilMint && torMint === councilMint) memberType = "council";
        else if (communityMint && torMint === communityMint) memberType = "community";

        rows.push({
        id: i,
        governance: realm.account.name,
        memberType, // ✅ new
        governingTokenMint: torMint,
        governingTokenDepositAmount: votes,
        details: item.account.realm.toBase58(),
        });
        daos.push(realm);
      }

      setGovernanceRecordRows(rows);
      setParticipatingDaos(daos);
    } catch (e) {
      enqueueSnackbar("Error loading governance info", { variant: 'error' });
    }

    setLoadingGovernance(false);
  };

    const fetchUserProposals = async () => {
        const userPk = new PublicKey(pubkey);
        const programId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');

        // 1. Get all TORs owned by the user (across all realms)
        const ownerRecords = await getTokenOwnerRecordsByOwnerIndexed(null, programId.toBase58(), userPk.toBase58());

        const torPubkeys: PublicKey[] = [];
        const realmPubkeys: Set<string> = new Set();

        for (const tor of ownerRecords) {
            try {
                const torPk = new PublicKey(tor.pubkey);
                torPubkeys.push(torPk);

                if (tor.account?.realm) {
                    realmPubkeys.add(tor.account.realm.toBase58());
                }
            } catch (e) {
                console.warn('Invalid TOR entry:', tor, e);
            }
        }

        console.log("✅ User's TORs:", torPubkeys.map(pk => pk.toBase58()));
        console.log("✅ Realms from TORs:", Array.from(realmPubkeys));

        const proposalMap = new Map<string, any>();

        for (const realmPk of realmPubkeys) {
            // 🧠 Only get governances for this realm
            const realmGovernances = await getAllGovernancesIndexed(realmPk, programId.toBase58());
            const govKeys = realmGovernances.map(g => g.pubkey.toBase58());

            if (govKeys.length === 0) {
                console.warn(`⚠️ No governances found for realm ${realmPk}`);
                continue;
            }

            // 🧠 Now only get proposals for this realm and its governances
            const realmProposals = await getAllProposalsIndexed(govKeys, programId, realmPk);
            console.log(`📦 Realm ${realmPk} proposals fetched:`, realmProposals.length);

            for (const proposal of realmProposals) {
                proposalMap.set(proposal.pubkey.toBase58(), proposal); // 🧼 avoids duplicates
            }
        }

        const allProposals = Array.from(proposalMap.values());

        console.log(`📊 Total unique proposals fetched: ${allProposals.length}`);

        // 3. Filter proposals authored by user's TORs
        const filtered = allProposals.filter(p => {
            if (!p.account.tokenOwnerRecord) return false;
            return torPubkeys.some(torPk => torPk.equals(p.account.tokenOwnerRecord));
        });

        // 🔽 Sort by draft date descending
        filtered.sort((a, b) => b.account.draftAt - a.account.draftAt);


        console.log(`🎯 Final matched proposals: ${filtered.length}`);
        setCreatedProposals(filtered);
    };

    
React.useEffect(() => {
    if (walletAddress && pubkey !== walletAddress) {
        setPubkey(walletAddress);
        setRefresh(true);
    }
}, [walletAddress]);

  React.useEffect(() => {
    if (pubkey && refresh) {
      fetchGovernance();
      fetchUserProposals();
      setRefresh(false);
    }
  }, [pubkey, refresh]);

  React.useEffect(() => {
    // Only auto-fill if pubkey is empty and no manual input has been made yet
    if (!pubkey && publicKey && refresh) {
        setPubkey(publicKey.toBase58());
    }
    }, [publicKey, pubkey, refresh]);

  return (
    <Box sx={{ mt: 4 }}>
      {/* HERO / HEADER */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid",
          borderColor: "divider",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0))",
          backdropFilter: "blur(10px)",
          overflow: "hidden",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
            {/* Top row: title + actions */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar
                  sx={{
                    width: 44,
                    height: 44,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                  }}
                >
                  <AccountCircleIcon />
                </Avatar>

                <Box>
                  <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                    Profile
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {!pubkey ? "Enter a wallet to load activity" : !isValidPubkey ? "Invalid wallet address" : shortenPk(pubkey, 5)}
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
                        window.open(`https://solscan.io/account/${pubkey}`, "_blank");
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
                          .then(() =>
                            enqueueSnackbar("Link copied to clipboard!", {
                              variant: "success",
                            })
                          )
                          .catch(() =>
                            enqueueSnackbar("Failed to copy link.", {
                              variant: "error",
                            })
                          );
                      }}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>

                <Tooltip title="Reload">
                  <IconButton
                    size="small"
                    onClick={() => setRefresh(true)}
                    disabled={!pubkey}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

{/* Wallet command bar */}
<Box
  sx={{
    p: 1.5,
    borderRadius: 3,
    border: "1px solid",
    borderColor: "divider",
    backgroundColor: "rgba(255,255,255,0.02)",
  }}
>
  <Grid container spacing={1.25} alignItems="center">
    <Grid item xs={12} md>
      <TextField
        fullWidth
        value={pubkey}
        placeholder="Paste wallet address (Solana public key)"
        onChange={(e) => {
          setPubkey(e.target.value);
          setTouched(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") loadNow();
        }}
        error={touched && !!pubkey && !isValidPubkey}
        helperText={
          touched && !!pubkey && !isValidPubkey
            ? "That doesn’t look like a valid Solana public key."
            : "Tip: press Enter to load"
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
                        setPubkey("");
                        setTouched(true);
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
          "& .MuiOutlinedInput-root": {
            borderRadius: 999,
          },
        }}
      />
    </Grid>

    <Grid item xs={12} md="auto">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          variant="outlined"
          disabled={!publicKey || loadingGovernance}
          onClick={() => {
            setPubkey(publicKey?.toBase58() || "");
            setTouched(true);
            setRefresh(true);
          }}
          sx={{ borderRadius: 999, whiteSpace: "nowrap" }}
        >
          Use My Wallet
        </Button>

        <Button
          variant="contained"
          onClick={loadNow}
          disabled={!canLoad}
          startIcon={!loadingGovernance ? <BoltIcon /> : undefined}
          sx={{ borderRadius: 999, minWidth: 140, whiteSpace: "nowrap" }}
        >
          {loadingGovernance ? "Loading…" : "Load"}
        </Button>
      </Stack>
    </Grid>
  </Grid>
</Box>

            {/* Quick stats */}
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 3, height: "100%" }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <GroupsIcon />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        DAOs participating
                      </Typography>
                      {loadingGovernance ? (
                        <Skeleton width={120} />
                      ) : (
                        <Typography variant="h6">{daoCount}</Typography>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 3, height: "100%" }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <HowToVoteIcon />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total deposited votes
                      </Typography>
                      {loadingGovernance ? (
                        <Skeleton width={160} />
                      ) : (
                        <Typography variant="h6">
                          {totalVotes.toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </Grid>

              <Grid item xs={12} md={4}>
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 3, height: "100%" }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <DescriptionIcon />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Proposals created
                      </Typography>
                      {loadingGovernance ? (
                        <Skeleton width={120} />
                      ) : (
                        <Typography variant="h6">{proposalCount}</Typography>
                      )}
                    </Box>
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </CardContent>

        {/* Tabs */}
        <Box sx={{ px: { xs: 1, md: 2 }, borderTop: "1px solid", borderColor: "divider" }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 48 }}
          >
            <Tab label={`Participation (${daoCount})`} sx={{ minHeight: 48 }} />
            <Tab label={`Created Proposals (${proposalCount})`} sx={{ minHeight: 48 }} />
          </Tabs>
        </Box>
      </Card>

      {/* BODY */}
      <Box sx={{ mt: 2 }}>
        {loadingGovernance && <LinearProgress sx={{ borderRadius: 99, mb: 2 }} />}

        {tab === 0 && (
          <Card
            elevation={0}
            sx={{
              mt: 2,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                DAOs Participating In
              </Typography>

              <DataGrid
                rows={governanceRecordRows}
                columns={governancecolumns}
                autoHeight
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 10, page: 0 } },
                }}
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
                  "& .MuiDataGrid-columnHeaders": {
                    borderRadius: 2,
                  },
                  "& .MuiDataGrid-row": {
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  },
                  "& .MuiDataGrid-cell": {
                    borderBottom: "none",
                  },
                  "& .MuiDataGrid-virtualScroller": {
                    borderRadius: 2,
                  },
                  "& .MuiDataGrid-footerContainer": {
                    borderTop: "1px solid",
                    borderColor: "divider",
                  },
                  "& .MuiDataGrid-row:nth-of-type(odd)": {
                    backgroundColor: "rgba(255,255,255,0.02)",
                  },
                }}
              />

              {!loadingGovernance && daoCount === 0 && (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    No DAO participation found for this wallet.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        )}

        {tab === 1 && (
          <Card
            elevation={0}
            sx={{
              mt: 2,
              borderRadius: 4,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Created Proposals
              </Typography>

              {loadingGovernance ? (
                <Stack spacing={2}>
                  <Skeleton height={64} />
                  <Skeleton height={64} />
                  <Skeleton height={64} />
                </Stack>
              ) : createdProposals?.length > 0 ? (
                <Stack spacing={2}>
                  {createdProposals.map((p, idx) => (
                    <GetGovernanceFromRulesView
                      key={p?.pubkey?.toBase58?.() || idx}
                      rulesWallet={p.account.governance?.toBase58()}
                      proposal={p.pubkey.toBase58()}
                      name={p.account.name}
                      description={p.account.descriptionLink}
                      draftAt={p.account.draftAt}
                      item={p}
                      state={p.account.state}
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
        )}
      </Box>
    </Box>
  );
}