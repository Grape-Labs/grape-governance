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
  TableBody,
  Stack
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { CopyToClipboard } from 'react-copy-to-clipboard';
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

function generateCSV(rows) {
  const header = ['Wallet', 'Community Staked', 'Council Staked', 'Total Votes', '% Participation', 'Approve', 'Deny', 'Abstain', 'First Vote', 'Last Vote'];
  const csvRows = [header.join(',')];

  rows.forEach(r => {
    csvRows.push([
      r.wallet,
      r.staked.governingTokenDepositAmount,
      r.staked.governingCouncilDepositAmount,
      r.proposalCreatedCount || 0,
      r.voteStats.total,
      r.voteStats.participationPercent,
      r.voteStats.approve,
      r.voteStats.deny,
      r.voteStats.abstain,
      formatDate(r.firstVoteAt),
      formatDate(r.lastVoteAt)
    ].join(','));
  });

  return csvRows.join('\n');
}

export default function ParticipationStatsTable({ proposals, members, participantArray, onDateRangeCalculated }) {
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [rows, setRows] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [csvText, setCsvText] = useState('');
    
  useEffect(() => {
    const start = startDate ? new Date(startDate.setHours(0, 0, 0, 0)) : null;
    const end = endDate ? new Date(endDate.setHours(23, 59, 59, 999)) : null;
    const startSec = start ? Math.floor(start.getTime() / 1000) : null;
    const endSec = end ? Math.floor(end.getTime() / 1000) : null;

    const filteredProposals = proposals.filter((p) => {
        const ts = p.account.votingAt?.toNumber?.() || 0;
        return (!startSec || ts >= startSec) && (!endSec || ts <= endSec);
    });

    const activeProposalIds = filteredProposals.map(p => p.pubkey.toBase58());
    const activeProposalCount = activeProposalIds.length;

    // Create a map from tokenOwnerRecord pubkey to governingTokenOwner wallet
    const tokenOwnerRecordToWallet = members.reduce((acc, member) => {
        const torKey = member.pubkey?.toBase58?.();
        const wallet = member.governingTokenOwner?.toBase58?.();
        if (torKey && wallet) {
            acc[torKey] = wallet;
        }
        return acc;
    }, {});

    //console.log('🔄 TokenOwnerRecord → Wallet mapping:', tokenOwnerRecordToWallet);

    const proposalsCreatedInRangeByWallet = proposals.reduce((acc, p) => {
        const tokenOwnerRecordKey = p.account.tokenOwnerRecord?.toBase58?.();
        const votingAt = p?.account?.votingAt ? Number(p.account.votingAt) : 0;
        //console.log(`🔄 Proposal: ${p.pubkey.toBase58()}, TokenOwnerRecord: ${tokenOwnerRecordKey}, VotingAt: ${votingAt}`);
        const wallet = tokenOwnerRecordToWallet[tokenOwnerRecordKey];

        if (!wallet) {
            //console.log(`❌ No wallet found for tokenOwnerRecord: ${tokenOwnerRecordKey}`);
            return acc;
        }

        const inRange =
            (!startSec && !endSec) ||
            (!startSec && endSec && votingAt <= endSec) ||
            (startSec && !endSec && votingAt >= startSec) ||
            (startSec && endSec && votingAt >= startSec && votingAt <= endSec);

        if (inRange) {
            acc[wallet] = (acc[wallet] || 0) + 1;
        }

        return acc;
        }, {});
    /*
    const lastProposal = [...proposals]
        .sort((a, b) => (b.account.votingAt?.toNumber?.() || 0) - (a.account.votingAt?.toNumber?.() || 0))[0];

        if (lastProposal) {
        const torKey = lastProposal.account.tokenOwnerRecord?.toBase58?.();
        const votingAt = lastProposal.account.votingAt?.toNumber?.();
        const wallet = tokenOwnerRecordToWallet[torKey];

        console.log('🧪 Last Proposal:');
        console.log('Proposal Title:', lastProposal.account.name);
        console.log('TokenOwnerRecord:', torKey);
        console.log('Mapped Wallet:', wallet || '❌ Not found in tokenOwnerRecordToWallet');
    }
    */

    const updated = participantArray
        .map((p) => {
            const filteredVotes = p.voteHistory.filter(v => {
                const ts = v.draftAt || 0;
                return (!startSec || ts >= startSec) && (!endSec || ts <= endSec);
            });

            const participationPercent = filteredVotes.length > 0
                ? Math.round((filteredVotes.length / proposals.length) * 100)
                : 0;

            const allTimestamps = p.voteHistory.map(v => v.draftAt).filter(Boolean);
            const firstParticipation = allTimestamps.length ? Math.min(...allTimestamps) : null;
            const lastParticipation = allTimestamps.length ? Math.max(...allTimestamps) : null;

            // Count vote types in-range
            const approve = filteredVotes.filter(v => v.voteType === 0).length;
            const deny = filteredVotes.filter(v => v.voteType === 1).length;
            const abstain = filteredVotes.filter(v => v.voteType === 2).length;

            return {
                ...p,
                voteStats: {
                    ...p.voteStats,
                    participationPercent,
                    filteredVotes: filteredVotes.length,
                    approve,
                    deny,
                    abstain
                },
                proposalCreatedCount: proposalsCreatedInRangeByWallet[p.wallet] || 0,
                firstParticipation,
                lastParticipation,
            };
        })
        .filter((p) => {
            const lastTs = p.lastParticipation;
            return (!startSec && !endSec) ||
                (!startSec && endSec && lastTs <= endSec) ||
                (startSec && !endSec && lastTs >= startSec) ||
                (startSec && endSec && lastTs >= startSec && lastTs <= endSec);
        });

    setRows(updated);
    setCsvText(generateCSV(updated));

    const allFirstDates = updated.map(r => r.firstParticipation).filter(Boolean);
    const allLastDates = updated.map(r => r.lastParticipation).filter(Boolean);
    const globalMin = allFirstDates.length ? Math.min(...allFirstDates) : null;
    const globalMax = allLastDates.length ? Math.max(...allLastDates) : null;

    if (onDateRangeCalculated && (globalMin || globalMax)) {
        onDateRangeCalculated({
        start: globalMin ? new Date(globalMin * 1000) : null,
        end: globalMax ? new Date(globalMax * 1000) : null,
        });
    }
    }, [startDate, endDate, proposals, participantArray]);

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>DAO Participation Statistics</Typography>

      <Grid container spacing={2} mb={2} alignItems="center">
        <Grid item>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="Start Date" value={startDate} onChange={setStartDate} slotProps={{ textField: { fullWidth: true } }} />
          </LocalizationProvider>
        </Grid>
        <Grid item>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker label="End Date" value={endDate} onChange={setEndDate} slotProps={{ textField: { fullWidth: true } }} />
          </LocalizationProvider>
        </Grid>
        {startDate && endDate && (
          <Grid item>
            <Button variant="contained" onClick={() => { setStartDate(null); setEndDate(null); }}>Clear</Button>
          </Grid>
        )}
        <Grid item>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => {
              const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', 'dao_participation_stats.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}>Export CSV</Button>
            <CopyToClipboard text={csvText}>
              <Button variant="outlined">Copy CSV</Button>
            </CopyToClipboard>
          </Stack>
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
                width: 200,
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
                width: 120,
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
                width: 120,
                valueGetter: (p) => p.row.staked.governingCouncilDepositAmount,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right'
              },
              {
                field: 'proposalCreatedCount',
                headerName: 'Created',
                width: 100,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right',
              },
              {
                field: 'votesInRange',
                headerName: 'Votes',
                width: 100,
                valueGetter: (p) => p.row.voteStats.filteredVotes,
                align: 'right',
                headerAlign: 'right',
              },
              {
                field: 'totalVotes',
                headerName: 'Total Votes',
                width: 120,
                valueGetter: (p) => p.row.voteStats.total,
                sortComparator: (v1, v2) => v1 - v2,
                align: 'right',
                headerAlign: 'right',
                hide: true
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
                            ? ((Number(v.voteWeight) / Math.pow(10, v.communityDecimals || 0)).toFixed(0)).toLocaleString()
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