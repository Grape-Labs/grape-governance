import React from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';

export default function BatchRecipientsInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [error, setError] = React.useState('');
  return <Box sx={{ mt: 1 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Paste wallets and amounts</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
      In Excel or Google Sheets, select the wallet and amount columns, copy, then paste below. CSV works too. A header row is optional.
    </Typography>
    <TextField fullWidth multiline minRows={6} label="Wallets and amounts" value={value}
      placeholder={'Wallet\tAmount\nWallet address\t100\nAnother wallet address\t250.5'}
      onChange={event => { onChange(event.target.value); setError(''); }}
      variant="filled" inputProps={{ spellCheck: false, 'aria-label': 'Paste wallet and amount columns' }}
      helperText="Two columns: wallet first, amount second. Tabs, commas, semicolons, or spaces are detected automatically. Use a decimal point for fractions." />
    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
      <Button component="label" size="small" sx={{ textTransform: 'none' }}>Or open a CSV file
        <input hidden type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain" onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try { onChange(await file.text()); setError(''); }
          catch { setError('Could not read this file. Copy and paste its two columns instead.'); }
        }} />
      </Button>
      {value && <Button size="small" onClick={() => onChange('')} sx={{ textTransform: 'none' }}>Clear</Button>}
    </Box>
    {error && <Alert severity="error">{error}</Alert>}
  </Box>;
}
