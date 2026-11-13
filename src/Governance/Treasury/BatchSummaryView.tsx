import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { summarizeBatch } from './batchSummary';

export default function BatchSummaryView({ input, unit = 'tokens', allowWhitespace = false }: { input: string; unit?: string; allowWhitespace?: boolean }) {
  const summary = React.useMemo(() => summarizeBatch(input, allowWhitespace), [input, allowWhitespace]);
  return <Box aria-label="Batch summary" aria-live="polite" sx={{ mt: 1.5, p: 2, borderRadius: 2, border: '1px solid rgba(130,210,185,0.25)', background: 'rgba(130,210,185,0.05)' }}>
    <Typography variant="overline" color="text.secondary">{summary.errors.length ? 'Valid rows subtotal' : 'Batch summary'}</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mt: 0.5 }}>
      <Box><Typography variant="caption" color="text.secondary">Total amount</Typography><Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{summary.total} {unit}</Typography></Box>
      <Box><Typography variant="caption" color="text.secondary">Wallet recipients</Typography><Typography variant="h6">{summary.recipientCount}</Typography></Box>
    </Box>
    <Typography variant="caption" color="text.secondary">{summary.rowCount} valid row{summary.rowCount === 1 ? '' : 's'}{summary.duplicateCount > 0 ? ` · ${summary.duplicateCount} repeated wallet row(s). Every row’s amount is included in the total; wallets are counted once.` : ''}</Typography>
    {summary.errors.length > 0 && <Alert severity="warning" sx={{ mt: 1 }}>{summary.errors.length} invalid row(s). Fix these before building. {summary.errors.slice(0, 3).join('; ')}</Alert>}
  </Box>;
}
