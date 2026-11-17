import React from 'react';
import { Box, Button, Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export function VotingPowerDetails({ cards }: { cards: any[] }) {
  return <Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: cards.length > 1 ? 'repeat(2,minmax(0,1fr))' : '1fr' }, gap: 1.5 }}>
      {cards.map(card => <Box key={card.title} component="section" aria-label={`${card.title} voting power`} sx={{ p: 2, minWidth: 0, borderRadius: '14px', border: '1px solid rgba(168,191,214,0.14)', bgcolor: 'rgba(255,255,255,0.025)' }}>
        <Typography sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.8, fontWeight: 600, color: '#9aafc4', mb: 1 }}>{card.title}</Typography>
        <Typography sx={{ fontSize: { xs: 25, sm: 28 }, fontWeight: 650, letterSpacing: -0.8, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', mb: 2 }}>{card.total}</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 0.75, mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: '#8fa4ba' }}>Your power</Typography><Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{card.own}</Typography>
          <Typography sx={{ fontSize: 12, color: '#8fa4ba' }}>Delegated to you</Typography><Typography sx={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{card.incoming}</Typography>
        </Box>
        <Box sx={{ borderTop: '1px solid rgba(168,191,214,0.1)', pt: 1.25, mb: 1.5 }}>
          <Typography sx={{ fontSize: 12, color: card.canDeposit ? '#b6ecd5' : '#8fa4ba' }}>{card.available} tokens available to deposit</Typography>
          {card.delegate && <Typography title={card.delegate} sx={{ fontSize: 11, color: '#8fa4ba', mt: 0.75 }}>Voting delegate · {card.delegate.slice(0, 4)}…{card.delegate.slice(-4)}</Typography>}
        </Box>
        {card.action}
      </Box>)}
    </Box>
    <Typography sx={{ fontSize: 11, color: '#8297ad', mt: 2, lineHeight: 1.6 }}>Community and council vote separately. Manage deposits, withdrawals and delegates for either.</Typography>
  </Box>;
}

export default function CompactGovernancePower({ label, detail, deposit, loading, error, onRetry, children }: any) {
  const [open, setOpen] = React.useState(false);
  const text = loading ? 'Voting power…' : error ? 'Power unavailable' : label;
  return <>
    <button type="button" className="gd-compact-power" title={error || detail} aria-label={loading ? 'Loading your voting power' : error || detail}
      aria-haspopup="dialog" onClick={() => { setOpen(true); if (error) onRetry?.(); }}>
      <span>{text}</span>{!loading && !error && deposit && <span className="gd-compact-power-deposit">Deposit tokens ↗</span>}
    </button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="voting-power-title"
      BackdropProps={{ sx: { bgcolor: 'rgba(4,10,18,0.72)', backdropFilter: 'blur(6px)' } }}
      PaperProps={{ sx: { background: 'linear-gradient(145deg,#192735 0%,#111b28 100%)', color: '#edf2fa', borderRadius: '20px', border: '1px solid rgba(168,191,214,0.18)', boxShadow: '0 24px 80px rgba(0,0,0,0.4)', m: 2, width: 'calc(100% - 32px)' } }}>
      <DialogTitle component="div" sx={{ px: { xs: 2.5, sm: 3 }, pt: 3, pb: 2.5 }}>
        <Typography sx={{ color: '#89b9aa', fontSize: 9, fontWeight: 600, letterSpacing: 2, mb: 0.75 }}>YOUR DAO MEMBERSHIP</Typography>
        <Typography id="voting-power-title" component="h2" sx={{ fontSize: 23, fontWeight: 650, letterSpacing: -0.5, lineHeight: 1.25 }}>Voting power</Typography>
        <IconButton aria-label="Close voting power" onClick={() => setOpen(false)} size="small" sx={{ position: 'absolute', right: 16, top: 16, color: '#9aafc4', border: '1px solid rgba(168,191,214,0.12)', borderRadius: 2 }}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, pb: 3 }}>{error ? <><Typography role="alert" sx={{fontSize:13,color:'#b0bdcd'}}>{error}</Typography><Button onClick={onRetry} sx={{color:'#b6ecd5'}}>Retry</Button></> : children}</DialogContent>
    </Dialog>
  </>;
}
