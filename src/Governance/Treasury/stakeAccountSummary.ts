const number = (value: any) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function summarizeStakeAccounts(native: any[] = [], rules: any[] = []) {
  const unique = new Map<string, any>();
  for (const [items, source] of [[native, 'Treasury'], [rules, 'Governance']] as const) {
    for (const item of Array.isArray(items) ? items : []) {
      const key = item.stake_account_address || item.pubkey || item.address;
      const address = key?.toBase58?.() || (typeof key === 'string' ? key : '');
      if (!address || unique.has(address)) continue;
      const total = number(item.total_amount ?? (number(item.lamports) / 1e9));
      const rent = Math.min(total, number(item.rent));
      const state = String(item.state || item.status || '').toLowerCase();
      const delegated = ['active', 'activating', 'deactivating', 'delegated'].includes(state) || String(item.status || '').toLowerCase().includes('delegated');
      const active = delegated ? Math.min(Math.max(total - rent, 0), number(item.activationVerified ? item.active_amount : item.delegated_amount ?? item.active_amount)) : 0;
      const inactive = Math.max(total - active - rent, 0);
      unique.set(address, { address, total, rent, active, inactive, source,
        status: state === 'deactivating' ? 'Deactivating' : state === 'activating' ? 'Activating' : state === 'delegated' ? 'Delegated' : active > 0 ? 'Staked' : inactive > 0 ? 'Inactive' : 'Unknown' });
    }
  }
  const accounts = Array.from(unique.values()).sort((a, b) => b.total - a.total);
  return { accounts, total: accounts.reduce((sum, item) => sum + item.total, 0), active: accounts.reduce((sum, item) => sum + item.active, 0), inactive: accounts.reduce((sum, item) => sum + item.inactive, 0) };
}

export function upsertWalletValue(values: any[], entry: any) {
  const previous = (values || []).find(item => item.address === entry.address);
  if (previous && Object.keys(entry).every(key => previous[key] === entry[key])) return values;
  return [...(values || []).filter(item => item.address !== entry.address), entry];
}
