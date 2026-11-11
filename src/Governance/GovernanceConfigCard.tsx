import React from 'react';
import { RPC_CONNECTION } from '../utils/grapeTools/constants';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { PublicKey } from '@solana/web3.js';
import { getNativeTreasuryAddress, getGovernance, getRealm, getRealmConfig, getRealmConfigAddress } from '@solana/spl-governance';
import { governanceConfigRows, realmConfigRows, currentRealmConfigRows, compareConfigRows } from './governanceConfigSummary';

function AddressRow({ label, address }: { label: string; address?: string }) {
    const [copied, setCopied] = React.useState(false);
    React.useEffect(() => {
        if (!copied) return;
        const timer = setTimeout(() => setCopied(false), 2000);
        return () => clearTimeout(timer);
    }, [copied]);
    return <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere', minWidth: 0 }}>{address || 'Unavailable'}</Typography>
            {address && <>
                <CopyToClipboard text={address} onCopy={() => setCopied(true)}>
                    <Tooltip title={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}><IconButton size="small" aria-label={`Copy ${label.toLowerCase()}`}><ContentCopyIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                </CopyToClipboard>
                <Tooltip title="View in explorer"><IconButton size="small" component="a" href={`https://explorer.solana.com/address/${address}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${label.toLowerCase()} in explorer`}><OpenInNewIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            </>}
        </Box>
    </Box>;
}

export default function GovernanceConfigCard({ config, instruction, decimals = {}, onInspect, executed = false }: {
    config: any;
    instruction: { programId?: PublicKey; keys?: { pubkey: PublicKey }[] };
    decimals?: { community?: number; council?: number };
    onInspect?: () => void;
    executed?: boolean;
}) {
    const isRealm = config.kind === 'realm';
    // SetGovernanceConfig's first account is the governance being changed.
    const governance = instruction?.keys?.[0]?.pubkey?.toBase58();
    const program = instruction?.programId?.toBase58();
    const [treasury, setTreasury] = React.useState<{ governance: string; program: string; address: string } | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        if (!isRealm && governance && program) {
            getNativeTreasuryAddress(new PublicKey(program), new PublicKey(governance)).then(address => {
                if (!cancelled) setTreasury({ governance, program, address: address.toBase58() });
            }).catch(() => { if (!cancelled) setTreasury(null); });
        }
        return () => { cancelled = true; };
    }, [governance, program, isRealm]);
    const rows = isRealm ? realmConfigRows(config, decimals, instruction?.keys?.map(key => key.pubkey.toBase58())) : governanceConfigRows(config, decimals);
    const [refresh, setRefresh] = React.useState(0);
    const [baseline, setBaseline] = React.useState<{ key: string; config?: any; tokens?: any; error?: string; partial?: boolean } | null>(null);
    const baselineKey = `${program}:${governance}:${isRealm}:${refresh}`;
    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                if (!governance || !program) throw new Error('Missing target account');
                const target = new PublicKey(governance);
                if (isRealm) {
                    const realm = await getRealm(RPC_CONNECTION, target);
                    let tokens: any;
                    let partial = false;
                    try {
                        const address = await getRealmConfigAddress(new PublicKey(program), target);
                        tokens = (await getRealmConfig(RPC_CONNECTION, address)).account;
                        if (!tokens.realm.equals(target)) throw new Error('Realm mismatch');
                    } catch { tokens = undefined; partial = true; }
                    if (!cancelled) setBaseline({ key: baselineKey, config: realm.account.config, tokens, partial });
                } else {
                    const account = await getGovernance(RPC_CONNECTION, target);
                    if (!cancelled) setBaseline({ key: baselineKey, config: account.account.config });
                }
            } catch {
                if (!cancelled) setBaseline({ key: baselineKey, error: 'Current configuration could not be loaded.' });
            }
        };
        load();
        return () => { cancelled = true; };
    }, [baselineKey, governance, program, isRealm]);
    const current = baseline?.key === baselineKey ? baseline : null;
    const currentRows = current?.config ? (isRealm
        ? currentRealmConfigRows(current.config, current.tokens, decimals)
        : governanceConfigRows(current.config, decimals)) : undefined;
    const comparisons = compareConfigRows(rows, currentRows);
    const changes = comparisons.filter(row => row.changed === true).length;
    const groups = [
        { title: 'Community', rows: comparisons.filter(({ label }) => /community/i.test(label)) },
        { title: 'Council', rows: comparisons.filter(({ label }) => /council/i.test(label)) },
        { title: 'Voting & execution', rows: comparisons.filter(({ label }) => !/community|council/i.test(label)) },
    ].filter(group => group.rows.length > 0);
    return <Box sx={{ my: 2, border: '1px solid rgba(100,190,255,0.3)', borderRadius: 3, overflow: 'hidden', background: 'rgba(100,190,255,0.04)' }}>
        <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box>
                <Typography variant="h6">{isRealm ? 'Update realm config' : 'Update governance config'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{executed ? 'Instruction values compared with live configuration. Historical pre-execution settings are unavailable.' : 'Compare current on-chain settings with the proposed values. Current settings may change before execution.'}</Typography>
            </Box>
            {onInspect && <Button size="small" variant="outlined" onClick={onInspect} sx={{ flexShrink: 0, borderRadius: 2 }}>Inspect</Button>}
        </Box>
        <Box sx={{ mx: { xs: 2, sm: 2.5 }, mb: 2.5, p: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <AccountBalanceWalletOutlinedIcon fontSize="small" sx={{ color: 'primary.light' }} />
                <Typography variant="subtitle2">{isRealm ? 'Affected realm' : 'Affected governance / treasury'}</Typography>
            </Box>
            <Box sx={{ display: 'grid', gap: 1.5 }}>
                <AddressRow label={isRealm ? "Realm" : "Governance"} address={governance} />
                {isRealm ? <AddressRow label="Authorizing realm authority" address={instruction?.keys?.[1]?.pubkey?.toBase58()} /> : <AddressRow label="Native treasury (derived address)" address={treasury?.governance === governance && treasury?.program === program ? treasury.address : undefined} />}
            </Box>
        </Box>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" role="status">
                {!current ? 'Loading current configuration…' : current.error || `${changes} ${executed ? 'difference' : 'change'}${changes === 1 ? '' : 's'}${current.partial ? ' · Some current settings are unavailable' : ''}`}
            </Typography>
            <Button size="small" disabled={!current} onClick={() => setRefresh(value => value + 1)}>Refresh</Button>
        </Box>
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${groups.length}, minmax(0, 1fr))` }, gap: 2 }}>
            {groups.map(group => <Box key={group.title} sx={{ minWidth: 0, p: 2, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: 1 }}>{group.title}</Typography>
                <Box component="dl" sx={{ m: 0 }}>
                    {group.rows.map(({ label, value, previous, changed }) => <Box key={label} sx={{ my: 0.75, p: 1.25, borderRadius: 1.5, bgcolor: changed ? 'rgba(100,190,255,0.08)' : 'transparent', borderLeft: changed ? '2px solid rgba(100,190,255,0.8)' : '2px solid transparent' }}>
                        <Box component="dt" sx={{ mb: 1 }}>
                            <Typography variant="body2" color="text.secondary">{label}</Typography>
                            {changed !== null && <Typography variant="caption" sx={{ color: changed ? 'primary.light' : 'text.secondary' }}>{changed ? (executed ? 'Different' : 'Changed') : (executed ? 'Matches live' : 'Unchanged')}</Typography>}
                        </Box>
                        <Box component="dd" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', gap: 1, alignItems: 'start' }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Current (live)</Typography>
                                <Typography variant="body2" sx={{ overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>{previous ?? (!current ? 'Loading…' : 'Unavailable')}</Typography>
                            </Box>
                            <Typography aria-hidden="true" color="text.secondary" sx={{ pt: 2.5 }}>→</Typography>
                            <Box>
                                <Typography variant="caption" color="text.secondary">{executed ? 'Instruction value' : 'Proposed'}</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums', color: changed ? 'primary.light' : 'text.primary' }}>{value}</Typography>
                            </Box>
                        </Box>
                    </Box>)}
                </Box>
            </Box>)}
        </Box>
    </Box>;
}
