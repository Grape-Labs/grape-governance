import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  TextField,
  Card,
  CardContent,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import ExplorerView from '../utils/grapeTools/Explorer';

function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleDateString();
}

function votingTypeToText(type) {
  if (type === 0) return 'Approve';
  if (type === 1) return 'Deny';
  if (type === 2) return 'Abstain';
  return 'Unknown';
}

export default function ParticipationStatsTable({ proposals, participantArray }) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);

  useEffect(() => {
    const filteredProposals = proposals.filter((p) => {
      const ts = p.account.votingAt?.toNumber?.() || 0;
      return (!startDate || ts >= startDate.getTime() / 1000) && (!endDate || ts <= endDate.getTime() / 1000);
    });

    const activeProposalIds = filteredProposals.map(p => p.pubkey.toBase58());
    const activeProposalCount = activeProposalIds.length;

    const updated = participantArray.map((p) => {
      const filteredVotes = p.voteHistory.filter(v => activeProposalIds.includes(v.pubkey));
      const participationPercent = activeProposalCount > 0 ? Math.round((filteredVotes.length / activeProposalCount) * 100) : 0;

      const allTimestamps = filteredVotes.map(v => v.draftAt).filter(Boolean);
      const firstParticipation = allTimestamps.length ? Math.min(...allTimestamps) : null;
      const lastParticipation = allTimestamps.length ? Math.max(...allTimestamps) : null;

      return {
        ...p,
        voteStats: {
          ...p.voteStats,
          participationPercent,
          filteredVotes: filteredVotes.length,
        },
        firstParticipation,
        lastParticipation,
      };
    });

    setRows(updated);
  }, [startDate, endDate, proposals, participantArray]);

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>DAO Participation Statistics</Typography>

      <Grid container spacing={2} mb={2}>
        <Grid item>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="Start Date" value={startDate} onChange={setStartDate} renderInput={(params) => <TextField {...params} />} />
          </LocalizationProvider>
        </Grid>
        <Grid item>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="End Date" value={endDate} onChange={setEndDate} renderInput={(params) => <TextField {...params} />} />
          </LocalizationProvider>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <DataGrid
            rows={rows.map((r, i) => ({ id: i, ...r }))}
            columns={[
              {
                field: 'wallet',
                headerName: 'Wallet',
                flex: 1,
                renderCell: (params) => (
                  <ExplorerView
                    showSolanaProfile={true}
                    grapeArtProfile={true}
                    address={params.value}
                    type='address'
                    shorten={8}
                    hideTitle={false}
                    style='text'
                    color='white'
                    fontSize='14px'
                  />
                )
              },
              {
                field: 'communityStaked',
                headerName: 'Community Staked',
                width: 150,
                valueGetter: (p) => (p.row.staked.governingTokenDepositAmount),
                sortComparator: (v1, v2) => v1 - v2,
                renderCell: (params) => (
                    params.value.toLocaleString()
                ),
                align: 'right',
                headerAlign: 'right'
              },
              {
                field: 'councilStaked',
                headerName: 'Council Staked',
                width: 150,
                valueGetter: (p) => p.row.staked.governingCouncilDepositAmount,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right'
              },
              {
                field: 'totalVotes',
                headerName: 'Total Votes',
                width: 120,
                valueGetter: (p) => p.row.voteStats.total,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right'
              },
              {
                field: 'participation',
                headerName: '% Participation',
                width: 150,
                valueGetter: (p) => p.row.voteStats.participationPercent,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right',
                hide: true
              },
              {
                field: 'approve',
                headerName: 'Approve',
                width: 100,
                valueGetter: (p) => p.row.voteStats.approve,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right'
              },
              {
                field: 'deny',
                headerName: 'Deny',
                width: 100,
                valueGetter: (p) => p.row.voteStats.deny,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right'
              },
              {
                field: 'abstain',
                headerName: 'Abstain',
                width: 100,
                valueGetter: (p) => p.row.voteStats.abstain,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right',
                hide: true
              },
              {
                field: 'firstParticipation',
                headerName: 'First Vote',
                width: 130,
                valueGetter: (p) => formatDate(p.row.firstVoteAt),
              },
              {
                field: 'lastParticipation',
                headerName: 'Last Vote',
                width: 130,
                valueGetter: (p) => formatDate(p.row.lastVoteAt),
              },
              {
                field: 'details',
                headerName: '',
                width: 80,
                renderCell: (params) => (
                  <Button size="small" onClick={() => setSelectedWallet(params.row)}>View</Button>
                ),
                sortable: false,
              },
            ]}
            autoHeight
            disableSelectionOnClick
            initialState={{
              sorting: {
                sortModel: [
                  { field: 'communityStaked', sort: 'desc' },
                  { field: 'councilStaked', sort: 'desc' },
                  { field: 'totalVotes', sort: 'desc' }
                ]
              }
            }}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedWallet} onClose={() => setSelectedWallet(null)} maxWidth="md" fullWidth>
        <DialogTitle>
            Vote History for {selectedWallet?.wallet}
        </DialogTitle>
        <DialogContent>
            {selectedWallet?.voteHistory?.length ? (
            <Table size="small">
                <TableHead>
                <TableRow>
                    <TableCell>Proposal</TableCell>
                    <TableCell>Vote Type</TableCell>
                    <TableCell>Weight</TableCell>
                    <TableCell>Date</TableCell>
                </TableRow>
                </TableHead>
                <TableBody>
                {selectedWallet.voteHistory.map((v, i) => (
                    <TableRow key={i}>
                    <TableCell>{v.proposalTitle || v.proposalId}</TableCell>
                    <TableCell>{votingTypeToText(v.voteType)}</TableCell>
                    <TableCell align="right">
                        {v.proposalMint === v.communityMint
                            ? (Number(v.voteWeight) / Math.pow(10, v.communityDecimals || 0)).toFixed(0).toLocaleString()
                            : v.voteWeight}
                    </TableCell>
                    <TableCell>{formatDate(v.draftAt)}</TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            ) : (
            <Typography>No participation data available.</Typography>
            )}
        </DialogContent>
        </Dialog>
    </Box>
  );
}