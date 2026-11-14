import React from 'react';
import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import CopyToClipboard from 'react-copy-to-clipboard';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import { summarizeStakeAccounts } from './stakeAccountSummary';

export default function StakeAccountsPanel({ native, rules, loading, failed, solPrice, onCopy, onRetry }: any) {
  const summary = summarizeStakeAccounts(native, rules);
  const sol = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const usd = (value: number) => Number.isFinite(Number(solPrice)) && solPrice != null ? (value * Number(solPrice)).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : 'Price unavailable';
  if (loading) return <Box role="status" sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /><Typography variant="body2" sx={{ mt: 1 }}>Loading stake accounts…</Typography></Box>;
  if (failed) return <Box sx={{ p: 2 }}><Typography variant="body2">Could not load stake accounts.</Typography><Button onClick={onRetry}>Try again</Button></Box>;
  return <Box sx={{ px: 2, pb: 2, minWidth: 0 }}>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Stake accounts <Typography component="span" color="text.secondary">({summary.accounts.length})</Typography></Typography>
      <Button size="small" onClick={onRetry} sx={{ textTransform: 'none' }}>Refresh</Button>
    </Box>
    {!summary.accounts.length ? <Typography variant="body2" color="text.secondary">No stake accounts found for this treasury.</Typography> : <>
      <Box sx={{ p: 1.5, mb: 1.5, borderRadius: 2, bgcolor: 'rgba(130,210,185,0.06)', border: '1px solid rgba(130,210,185,0.18)' }}>
        <Typography variant="caption" color="text.secondary">Total in stake accounts · included in wallet value</Typography>
        <Typography sx={{ fontWeight: 700, fontSize: 20, overflowWrap: 'anywhere' }}>{sol(summary.total)} SOL</Typography>
        <Typography variant="body2" color="text.secondary">{usd(summary.total)}</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
          <Typography variant="caption">Staked {sol(summary.active)} SOL</Typography>
          <Typography variant="caption">Inactive {sol(summary.inactive)} SOL</Typography>
        </Box>
      </Box>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {summary.accounts.map(item => <Box key={item.address} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 0 }}>
          <CopyToClipboard text={item.address} onCopy={onCopy}>
            <Button title={`Copy stake account ${item.address}`} color="inherit" size="small" endIcon={<FileCopyOutlinedIcon sx={{ fontSize: '14px!important' }} />} sx={{ px: 0, minWidth: 0, maxWidth: '100%', textTransform: 'none', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
              {item.address.slice(0, 6)}…{item.address.slice(-6)}
            </Button>
          </CopyToClipboard>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 1.5 }}>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{sol(item.total)} SOL</Typography>
            <Typography variant="caption" color="text.secondary">{usd(item.total)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, my: 1 }}>
            <Chip size="small" variant="outlined" label={item.status} sx={{ height: 22, color: item.status === 'Staked' ? '#9ce3c6' : 'text.secondary', borderColor: 'rgba(255,255,255,0.18)' }} />
            {item.source === 'Governance' && <Chip size="small" variant="outlined" label="Governance wallet" sx={{ height: 22 }} />}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 1, color: 'text.secondary' }}>
            {([['Staked', item.active], ['Inactive', item.inactive], ['Rent reserve', item.rent]] as const).map(([label, amount]) => <React.Fragment key={label}><Typography variant="caption">{label}</Typography><Typography variant="caption" sx={{ textAlign: 'right' }}>{sol(amount)} SOL</Typography></React.Fragment>)}
          </Box>
        </Box>)}
      </Box>
    </>}
  </Box>;
}
