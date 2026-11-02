import React from 'react';
import { useParams } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { RPC_CONNECTION } from '../../utils/grapeTools/constants';
import DaoPageLayout from './DaoPageLayout';
import WalletActions from './WalletActions';
import { useCouncilDelegation } from './useCouncilDelegation';
import { councilDelegationMembers, delegationAddress } from './councilDelegationPolicy';
import { checkCouncilRecipient, prepareCouncilDelegation, confirmCouncilDelegation } from './councilDelegation';

function DelegationContent({ realmAddress }: { realmAddress: string }) {
    const state = useCouncilDelegation(realmAddress);
    const { publicKey, sendTransaction } = useWallet();
    const activeWallet = React.useRef('');
    activeWallet.current = publicKey?.toBase58() || '';
    React.useEffect(() => () => { activeWallet.current = ''; }, []);
    const [search, setSearch] = React.useState('');
    const [recipient, setRecipient] = React.useState('');
    const [checks, setChecks] = React.useState<any>(null);
    const [checkRevision, retryChecks] = React.useReducer(value => value + 1, 0);
    const [checking, setChecking] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [signature, setSignature] = React.useState('');
    React.useEffect(() => {
        let cancelled = false;
        setChecks(null);
        setChecking(!!recipient);
        if (recipient) void checkCouncilRecipient(realmAddress, recipient).then(result => {
            if (!cancelled) setChecks(result);
        }).catch(() => {
            if (!cancelled) setError('Recipient checks are unavailable. Please retry the recipient checks.');
        }).finally(() => { if (!cancelled) setChecking(false); });
        return () => { cancelled = true; };
    }, [realmAddress, recipient, checkRevision]);
    const members = councilDelegationMembers(state.realm, state.records || []).filter(wallet => wallet !== state.wallet);
    const matches = members.filter(wallet => wallet.toLowerCase().includes(search.trim().toLowerCase()));
    const currentDelegate = delegationAddress(state.owned[0]?.account?.governanceDelegate);
    const eligible = checks?.verification.passed && checks?.reputation.passed;
    const submit = async (next: string | null) => {
        if (busy || !state.owned.length) return;
        const owner = state.wallet;
        setBusy(true); setError(''); setNotice('Rechecking council membership and recipient eligibility…'); setSignature('');
        try {
            const { transaction, blockhash } = await prepareCouncilDelegation(realmAddress, owner, next);
            if (activeWallet.current !== owner) throw new Error('Wallet changed. Reconnect and try again.');
            setNotice('Review the council delegation in your wallet.');
            const tx = await sendTransaction(transaction, RPC_CONNECTION, { skipPreflight: false, preflightCommitment: 'confirmed' });
            if (activeWallet.current !== owner) return;
            setSignature(tx); setNotice('Transaction submitted. Waiting for confirmation…');
            await confirmCouncilDelegation(tx, blockhash);
            if (activeWallet.current !== owner) return;
            setNotice(next ? 'Council delegation confirmed.' : 'Council delegation revoked.');
            setRecipient(''); setChecks(null); state.refresh();
        } catch (cause: any) {
            setError(cause?.message || 'Could not update council delegation.'); setNotice('');
        } finally { setBusy(false); }
    };
    if (!state.wallet) return <section className="gd-main gd-council-panel"><h2>Connect your council wallet</h2><p>Use the wallet button to connect. This page is available to council members and their current delegates.</p></section>;
    if (state.loading) return <section className="gd-main gd-council-panel" role="status">Checking council access…</section>;
    if (state.error) return <section className="gd-main gd-council-panel"><p role="alert">{state.error}</p><button className="gd-secondary" onClick={state.refresh}>Retry access check</button></section>;
    if (!state.allowed) return <section className="gd-main gd-council-panel"><h2>Council access required</h2><p>Only wallets with deposited council tokens or an active council delegation can use this page.</p><button className="gd-secondary" onClick={state.refresh}>Check again</button></section>;
    return <>
        <div className="gd-council-summary">
            <section className="gd-main gd-council-panel"><span className="gd-eyebrow">YOUR ROLE</span><h2>{state.owned.length ? 'Council member' : 'Council delegate'}</h2><WalletActions address={state.wallet} /><p>{state.owned.length ? 'Manage the voting authority for your council deposit.' : 'Vote on behalf of the council members listed below. Only each owner can change their delegation.'}</p></section>
            <section className="gd-main gd-council-panel"><span className="gd-eyebrow">DELEGATED TO YOU</span><h2>{state.incoming.length} council {state.incoming.length === 1 ? 'member' : 'members'}</h2>{state.incoming.length ? <ul>{state.incoming.map((record: any) => <li key={delegationAddress(record.pubkey)}><WalletActions address={delegationAddress(record.account.governingTokenOwner)} /></li>)}</ul> : <p>No council members currently delegate to this wallet.</p>}</section>
        </div>
        {state.owned.length > 0 && <section className="gd-main gd-council-panel">
            <span className="gd-eyebrow">YOUR COUNCIL DELEGATION</span>
            <h2>{currentDelegate ? 'Your current delegate' : 'Choose a council delegate'}</h2>
            {currentDelegate ? <div className="gd-council-current"><WalletActions address={currentDelegate} /><button className="gd-secondary" disabled={busy} onClick={() => submit(null)}>Revoke delegation</button></div> : <p>You currently retain your council voting authority.</p>}
            <p>Delegate all voting authority for your council deposit to one DAO member. Tokens stay in your deposit. Community delegation is unchanged, and you can replace or revoke this delegation at any time.</p>
            <label htmlFor="council-member-search">Find an existing DAO member</label>
            <input id="council-member-search" className="gd-council-search" value={search} disabled={busy} onChange={event => setSearch(event.target.value)} placeholder="Search by wallet address" />
            <p className="gd-footnote">Recipients must have deposited DAO governing tokens, active verification, and positive OG Reputation. Eligibility is checked again before signing.</p>
            <div className="gd-council-members" role="group" aria-label="DAO members">
                {matches.slice(0, 40).map(wallet => <button key={wallet} className={`gd-council-member ${recipient === wallet ? 'is-selected' : ''}`} disabled={busy} aria-label={`Select ${wallet}`} aria-pressed={recipient === wallet} onClick={() => { setRecipient(wallet); setError(''); }}><span>{wallet}</span><span>{recipient === wallet ? 'Selected' : 'Select'}</span></button>)}
                {!matches.length && <p>No matching DAO members.</p>}
                {matches.length > 40 && <p>Showing 40 of {matches.length} members. Search to narrow the list.</p>}
            </div>
            {recipient && <div className="gd-council-review"><h3>Recipient review</h3><WalletActions address={recipient} />
                {checking ? <p role="status">Checking verification and OG Reputation…</p> : checks && <ul>{[['Verification', checks.verification], ['OG Reputation', checks.reputation]].map(([label, check]: any) => <li key={label} className={check.passed ? 'gd-council-pass' : 'gd-council-fail'}>{check.passed ? '✓' : '×'} {label}: {check.message}</li>)}</ul>}
                <button className="gd-secondary" disabled={busy || checking} onClick={retryChecks}>Recheck recipient</button>{" "}
                <button className="gd-secondary" disabled={busy || checking || !eligible || recipient === currentDelegate} onClick={() => submit(recipient)}>{busy ? 'Updating delegation…' : currentDelegate ? 'Replace council delegate' : 'Delegate council voting authority'}</button>
            </div>}
        </section>}
        {notice && <p role="status">{notice}</p>}{error && <p role="alert" className="gd-council-fail">{error}</p>}
        {signature && <a className="gd-secondary" href={`https://explorer.solana.com/tx/${signature}`} target="_blank" rel="noopener noreferrer">View delegation transaction ↗</a>}
        <button className="gd-secondary" style={{ marginTop: 16 }} disabled={busy} onClick={state.refresh}>Refresh council delegation</button>
    </>;
}
export default function CouncilDelegationPage() {
    const { handlekey = '' } = useParams();
    const { publicKey } = useWallet();
    return <DaoPageLayout governanceAddress={handlekey} section="council" title="Council delegation" description="Trusted members. Shared council responsibility.">
        <DelegationContent key={`${handlekey}:${publicKey?.toBase58() || ''}`} realmAddress={handlekey} />
    </DaoPageLayout>;
}
