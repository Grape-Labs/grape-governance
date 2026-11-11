import React from 'react';
import { Box, Button, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { PublicKey } from '@solana/web3.js';
import { getNativeTreasuryAddress } from '@solana/spl-governance';
import { governanceConfigRows, realmConfigRows } from './governanceConfigSummary';

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

export default function GovernanceConfigCard({ config, instruction, decimals = {}, onInspect }: {
    config: any;
    instruction: { programId?: PublicKey; keys?: { pubkey: PublicKey }[] };
    decimals?: { community?: number; council?: number };
    onInspect?: () => void;
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
    const groups = [
        { title: 'Community', rows: rows.filter(([label]) => /community/i.test(label)) },
        { title: 'Council', rows: rows.filter(([label]) => /council/i.test(label)) },
        { title: 'Voting & execution', rows: rows.filter(([label]) => !/community|council/i.test(label)) },
    ].filter(group => group.rows.length > 0);
    return <Box sx={{ my: 2, border: '1px solid rgba(100,190,255,0.3)', borderRadius: 3, overflow: 'hidden', background: 'rgba(100,190,255,0.04)' }}>
        <Box sx={{ p: { xs: 2, sm: 2.5 }, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
            <Box>
                <Typography variant="h6">{isRealm ? 'Update realm config' : 'Update governance config'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Proposed settings for the {isRealm ? 'realm' : 'governance'} below. Applied when this instruction executes.</Typography>
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
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${groups.length}, minmax(0, 1fr))` }, gap: 2 }}>
            {groups.map(group => <Box key={group.title} sx={{ minWidth: 0, p: 2, bgcolor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                <Typography variant="overline" sx={{ color: 'primary.light', letterSpacing: 1 }}>{group.title}</Typography>
                <Box component="dl" sx={{ m: 0 }}>
                    {group.rows.map(([label, value]) => <Box key={label} sx={{ py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)', '&:last-child': { borderBottom: 0, pb: 0 } }}>
                        <Typography component="dt" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{label}</Typography>
                        <Typography component="dd" sx={{ m: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>
                            {['Disabled', 'Strict', 'Early'].includes(value) ? <Chip label={value} size="small" variant="outlined" sx={{ borderRadius: 1, fontWeight: 500 }} /> : value}
                        </Typography>
                    </Box>)}
                </Box>
            </Box>)}
        </Box>
    </Box>;
}
