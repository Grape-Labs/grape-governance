import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { PublicKey } from '@solana/web3.js';
import { RPC_CONNECTION } from '../utils/grapeTools/constants';
import { assertGrapeProposalEligibility, GRAPE_PROPOSAL_REALM } from './api/grapeProposalEligibility';

export function useGrapeProposalEligibility(realm: string, wallet: string) {
  const required = realm === GRAPE_PROPOSAL_REALM;
  const key = `${realm}:${wallet}`;
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState({ key: '', allowed: false, message: '' });
  React.useEffect(() => {
    let cancelled = false;
    if (!required || !wallet) return;
    setResult({ key, allowed: false, message: 'Checking reputation and verification…' });
    assertGrapeProposalEligibility(RPC_CONNECTION, new PublicKey(realm), new PublicKey(wallet))
      .then(() => { if (!cancelled) setResult({ key, allowed: true, message: 'Reputation and verification confirmed.' }); })
      .catch(error => { if (!cancelled) setResult({ key, allowed: false, message: error.message }); });
    return () => { cancelled = true; };
  }, [key, required, attempt]);
  return { required, allowed: !required || (!!wallet && result.key === key && result.allowed),
    message: !wallet ? 'Connect your wallet to check eligibility.' : result.key === key ? result.message : 'Checking reputation and verification…',
    retry: () => setAttempt(value => value + 1) };
}

export default function GrapeProposalEligibilityNotice({ eligibility }: { eligibility: ReturnType<typeof useGrapeProposalEligibility> }) {
  if (!eligibility?.required) return null;
  return <Box role="status" sx={{ p: 2, m: 1, maxWidth: 480, whiteSpace: 'normal', borderRadius: 2, border: '1px solid', borderColor: eligibility.allowed ? 'success.main' : 'warning.main' }}>
    <Typography variant="subtitle2">Grape DAO proposal requirements</Typography>
    <Typography variant="body2" sx={{ mt: 0.5 }}>Creating a proposal requires positive DAO reputation and active verification.</Typography>
    <Typography variant="body2" sx={{ mt: 0.5 }}>{eligibility.message}</Typography>
    <Button size="small" onClick={eligibility.retry}>Recheck</Button>
    <Button size="small" href="https://verification.governance.so" target="_blank" rel="noopener noreferrer">Verification</Button>
    <Button size="small" href="https://reputation.governance.so" target="_blank" rel="noopener noreferrer">Reputation</Button>
  </Box>;
}
