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
        const programId = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
        
        // 1. Get all token owner records by this wallet
        const ownerRecords = await getTokenOwnerRecordsByOwnerIndexed(null, programId.toBase58(), new PublicKey(pubkey).toBase58());

        console.log("Owner Records:", ownerRecords);

        const torPubkeys = ownerRecords.map(tor => tor.pubkey.toBase58());

        // 2. Get all proposals (across all governances)
        const allGovernances = await getAllGovernancesIndexed(null, programId.toBase58());

        console.log("All Governances:", allGovernances);


        const govKeys = allGovernances.map(g => g.pubkey.toBase58());
        const proposals = await getAllProposalsIndexed(govKeys, programId, null);

        console.log("All Proposals:", proposals);

        // 3. Filter proposals where the tokenOwnerRecord matches one of the user's
        const filtered = proposals.filter(p =>
            torPubkeys.includes(p.account.tokenOwnerRecord?.toBase58())
        );

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