import * as React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { PublicKey } from '@solana/web3.js';
import { RPC_CONNECTION } from '../utils/grapeTools/constants';
import { getGrapeProposalEligibility, GRAPE_PROPOSAL_REALM } from './api/grapeProposalEligibility';

export function useGrapeProposalEligibility(realm: string, wallet: string) {
  const required = realm === GRAPE_PROPOSAL_REALM;
  const key = `${realm}:${wallet}`;
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<{ key: string; allowed: boolean; message: string; checks?: Awaited<ReturnType<typeof getGrapeProposalEligibility>> }>({ key: '', allowed: false, message: '' });
  React.useEffect(() => {
    let cancelled = false;
    if (!required || !wallet) return;
    setResult({ key, allowed: false, message: 'Checking reputation and verification…' });
    getGrapeProposalEligibility(RPC_CONNECTION, new PublicKey(realm), new PublicKey(wallet))
      .then(checks => { if (!cancelled) setResult({ key, checks, allowed: checks.verification.passed && checks.reputation.passed, message: checks.verification.passed && checks.reputation.passed ? 'Eligible to create proposals.' : 'Proposal creation is blocked until both requirements are confirmed.' }); })
      .catch(error => { if (!cancelled) setResult({ key, allowed: false, message: error.message }); });
    return () => { cancelled = true; };
  }, [key, required, attempt]);
  return { required, wallet, checks: wallet && result.key === key ? result.checks : undefined, allowed: !required || (!!wallet && result.key === key && result.allowed),
    message: !wallet ? 'Connect your wallet to check eligibility.' : result.key === key ? result.message : 'Checking reputation and verification…',
    retry: () => setAttempt(value => value + 1) };
}

export const GrapeProposalEligibilityContext = React.createContext<ReturnType<typeof useGrapeProposalEligibility> | undefined>(undefined);

export function GrapeExtensionEligibilityNotice() {
  const eligibility = React.useContext(GrapeProposalEligibilityContext);
  return eligibility ? <GrapeProposalEligibilityNotice eligibility={eligibility} /> : null;
}

export default function GrapeProposalEligibilityNotice({ eligibility }: { eligibility: ReturnType<typeof useGrapeProposalEligibility> }) {
  if (!eligibility?.required || eligibility.allowed) return null;
  const missing = eligibility.checks
    ? [!eligibility.checks.verification.passed && 'verification', !eligibility.checks.reputation.passed && 'reputation'].filter(Boolean).join(' and ')
    : '';
  const label = !eligibility.wallet ? 'Connect a wallet to create a proposal.'
    : missing ? `Proposal blocked: ${missing} required.`
    : eligibility.message.startsWith('Checking') ? 'Checking proposal eligibility…' : 'Unable to confirm eligibility. Retry to create a proposal.';
  return <Box role="status" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, py: 0.75, color: 'text.secondary' }}>
    <Typography variant="caption">{label}</Typography>
    <Button size="small" color="inherit" onClick={eligibility.retry} sx={{ minWidth: 0, p: 0, fontSize: 12 }}>Retry</Button>
  </Box>;
}
