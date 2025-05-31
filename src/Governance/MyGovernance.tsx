import { DataGrid, GridColDef } from '@mui/x-data-grid';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { PublicKey, Connection, TransactionInstruction, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { Chip, Divider, Button, ButtonGroup, Grid, Typography, Box, LinearProgress, TextField, CircularProgress } from '@mui/material';
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

import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { filterE } from 'fp-ts/lib/Witherable';

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 15,
  borderRadius: '17px',
  [`& .MuiLinearProgress-bar`]: {
    borderRadius: '0px',
    backgroundColor: theme.palette.mode === 'light' ? '#1a90ff' : '#ffffff',
  },
}));

export function MyGovernanceView(props: any){
  const [pubkey, setPubkey] = React.useState(props?.pubkey || '');
  const [governanceRecordRows, setGovernanceRecordRows] = React.useState<any[]>([]);
  const [createdProposals, setCreatedProposals] = React.useState<any[]>([]);
  const [participatingDaos, setParticipatingDaos] = React.useState<any[]>([]);
  const [tokenMap, setTokenMap] = React.useState(props?.tokenMap);
  const [loadingGovernance, setLoadingGovernance] = React.useState(false);
  const [refresh, setRefresh] = React.useState(true);
  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const governancecolumns: GridColDef[] = [
    { field: 'governance', headerName: 'Governance', minWidth: 130, flex: 1 },
    { field: 'governingTokenMint', headerName: 'Governing Mint', width: 150, renderCell: (params) => <ExplorerView address={params.value} type='address' shorten={4} style='text' color='white' fontSize='14px' /> },
    { field: 'governingTokenDepositAmount', headerName: 'Votes', width: 130 },
    { field: 'details', headerName: '', width: 150, renderCell: (params) => <Button variant="contained" color="info" href={`/dao/${params.value}`} sx={{ borderRadius: '17px' }}>View</Button> }
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
        rows.push({
          id: i,
          governance: realm.account.name,
          governingTokenMint: item.account.governingTokenMint.toBase58(),
          governingTokenDepositAmount: votes,
          details: item.account.realm.toBase58()
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
    <Box sx={{ mt: 6, background: 'rgba(0,0,0,0.6)', borderRadius: '17px', p: 4 }}>
        <Grid container spacing={2} sx={{ mb: 3 }} alignItems="center">
            <Grid item xs={12} md={6}>
                <TextField
                fullWidth
                label="Enter wallet address"
                placeholder="Enter or paste a Solana public key"
                value={pubkey}
                onChange={(e) => setPubkey(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setRefresh(true); }}
                />
            </Grid>
            <Grid item xs={6} md={3}>
                <Button
                fullWidth
                variant="outlined"
                disabled={!publicKey}
                onClick={() => {
                    setPubkey(publicKey?.toBase58() || '');
                    setRefresh(true);
                }}
                >
                Use My Wallet
                </Button>
            </Grid>
            <Grid item xs={6} md={3}>
                <Button
                fullWidth
                variant="contained"
                onClick={() => setRefresh(true)}
                >
                Load Profile
                </Button>
            </Grid>
        </Grid>

      <Typography variant="h4" gutterBottom>Profile</Typography>

      {loadingGovernance ? <LinearProgress /> : (
        <>
          <Typography variant="h5" sx={{ mt: 3, mb: 1 }}>DAOs Participating In</Typography>
          <DataGrid
            rows={governanceRecordRows}
            columns={governancecolumns}
            pageSize={10}
            autoHeight
            sx={{ borderRadius: '17px', mb: 4 }}
          />
          {createdProposals?.length > 0 && (
            <Box sx={{ mt: 4 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>Created Proposals</Typography>
                {createdProposals.map((p, idx) => (
                    <>
                        <GetGovernanceFromRulesView
                            key={idx}
                            rulesWallet={p.account.governance?.toBase58()}
                            proposal={p.pubkey.toBase58()}
                            name={p.account.name}
                            description={p.account.descriptionLink}
                            draftAt={p.account.draftAt}
                            item={p}
                            state={p.account.state}
                        />
                    </>
                ))}
            </Box>
            )}
        </>
      )}
    </Box>
  );
}