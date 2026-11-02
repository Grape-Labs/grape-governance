export const delegationAddress = (value: any): string => value?.toBase58?.() || String(value || '');
const deposited = (record: any) => {
    try { return BigInt(record.account.governingTokenDepositAmount.toString()) > 0n; } catch { return false; }
};
export function councilDelegationAccess(realm: any, records: any[], wallet: string) {
    const councilMint = delegationAddress(realm?.account?.config?.councilMint);
    const realmAddress = delegationAddress(realm?.pubkey);
    const council = councilMint ? records.filter(record =>
        delegationAddress(record.account.realm) === realmAddress &&
        delegationAddress(record.account.governingTokenMint) === councilMint && deposited(record)) : [];
    const owned = wallet ? council.filter(record => delegationAddress(record.account.governingTokenOwner) === wallet) : [];
    const incoming = wallet ? council.filter(record => delegationAddress(record.account.governanceDelegate) === wallet &&
        delegationAddress(record.account.governingTokenOwner) !== wallet) : [];
    return { councilMint, owned, incoming, allowed: owned.length > 0 || incoming.length > 0 };
}
export function councilDelegationMembers(realm: any, records: any[]) {
    const mints = [delegationAddress(realm?.account?.communityMint), delegationAddress(realm?.account?.config?.councilMint)].filter(Boolean);
    return [...new Set<string>(records.filter(record =>
        delegationAddress(record.account.realm) === delegationAddress(realm?.pubkey) &&
        mints.includes(delegationAddress(record.account.governingTokenMint)) && deposited(record)
    ).map(record => delegationAddress(record.account.governingTokenOwner)))].sort();
}
