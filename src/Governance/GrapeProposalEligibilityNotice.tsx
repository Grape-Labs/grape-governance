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
  if (!eligibility?.required) return null;
  return <Box role="status" sx={{ p: 2, m: 1,  whiteSpace: 'normal', borderRadius: 2, border: '1px solid', borderColor: eligibility.allowed ? 'success.main' : 'warning.main' }}>
    <Typography variant="subtitle2">Connected wallet · Grape DAO proposal eligibility</Typography>
    {eligibility.wallet && <Typography variant="caption" sx={{ display: 'block', overflowWrap: 'anywhere' }}>{eligibility.wallet}</Typography>}
    {(['verification', 'reputation'] as const).map(kind => <Typography key={kind} variant="body2" sx={{ mt: 1, color: eligibility.checks?.[kind]?.passed ? 'success.main' : 'text.primary' }}>
      <strong>{kind === 'verification' ? 'Verification' : 'Reputation'}:</strong> {eligibility.checks?.[kind]?.message || (eligibility.wallet ? 'Checking…' : 'Connect wallet')}
    </Typography>)}
    <Typography variant="body2" sx={{ mt: 0.5 }}>Creating a proposal requires positive DAO reputation and active verification.</Typography>
    <Typography variant="body2" sx={{ mt: 0.5 }}>{eligibility.message}</Typography>
    <Button size="small" onClick={eligibility.retry}>Recheck</Button>
    <Button size="small" href="https://verification.governance.so" target="_blank" rel="noopener noreferrer">Verification</Button>
    <Button size="small" href="https://reputation.governance.so" target="_blank" rel="noopener noreferrer">Reputation</Button>
  </Box>;
}
