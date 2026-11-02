import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { councilDelegationAccess } from './councilDelegationPolicy';

// Navigation and page share one read, including while it is in flight.
const snapshots = new Map<string, { expires: number; request: Promise<any> }>();
export function useCouncilDelegation(realmAddress: string) {
    const { publicKey } = useWallet();
    const wallet = publicKey?.toBase58() || '';
    const key = `${realmAddress}:${wallet}`;
    const [revision, refresh] = React.useReducer(value => value + 1, 0);
    const [state, setState] = React.useState<any>({ key: '', loading: true });
    React.useEffect(() => {
        let cancelled = false;
        if (!wallet) { setState({ key, loading: false }); return; }
        setState({ key, loading: true });
        let entry = snapshots.get(key);
        if (!entry || entry.expires < Date.now() || revision) {
            const request = import('./councilDelegation').then(api => api.loadCouncilDelegation(realmAddress));
            entry = { request, expires: Date.now() + 30_000 };
            snapshots.set(key, entry);
            request.catch(() => { if (snapshots.get(key)?.request === request) snapshots.delete(key); });
        }
        entry.request.then(data => { if (!cancelled) setState({ key, loading: false, ...data }); },
            () => { if (!cancelled) setState({ key, loading: false, error: 'Council access could not be verified. Please retry.' }); });
        return () => { cancelled = true; };
    }, [key, revision]);
    const current = state.key === key ? state : { loading: !!wallet };
    const access = councilDelegationAccess(current.realm, current.records || [], wallet);
    return { ...current, ...access, wallet, refresh };
}
