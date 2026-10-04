const key = (value: any): string => value?.toBase58?.() || (typeof value === 'string' ? value : value?.pubkey ? key(value.pubkey) : '');

export const directoryRealmKey = (item: any): string => key(
  item?.realm || item?.governance?.account?.realm || item?.governance?.realm || item?.governanceAddress
);

// A token owner record is membership evidence even with zero deposited tokens:
// staking and reputation plugins can provide voting power outside that record.
export function buildParticipatingDirectory(records: any[], directory: any[]): any[] {
  const byRealm = new Map(directory.map(item => [directoryRealmKey(item), item]));
  const realms = new Set<string>();
  for (const record of records) {
    const realm = key(record?.account?.realm);
    if (realm) realms.add(realm);
  }
  return Array.from(realms, realm => byRealm.get(realm) || {
    governanceAddress: realm,
    realm,
    governanceName: `DAO ${realm.slice(0, 4)}…${realm.slice(-4)}`,
  }).sort((a, b) => String(a.governanceName).localeCompare(String(b.governanceName)));
}

export function directorySummary(directory: any[]) {
  const unique = new Map(directory.map(item => [directoryRealmKey(item), item]));
  unique.delete('');
  const items = Array.from(unique.values());
  return {
    daos: items.length,
    verified: items.filter(item => !!item.gspl).length,
    councils: items.filter(item => !!key(item.councilMint || item.realm?.account?.config?.councilMint)).length,
  };
}

// Rank only the bounded, deduplicated proposal window supplied by the activity source.
export function rankDirectoryByProposals(directory: any[], proposals: any[], limit = 100): any[] {
  const unique = new Map<string, any>();
  for (const proposal of proposals) {
    const address = key(proposal.pubkey);
    if (address) unique.set(address, proposal);
  }
  const timestamp = (proposal: any) => Number(proposal.account?.draftAt?.toString?.() ?? proposal.draftAt ?? 0) || 0;
  const recent = Array.from(unique.values()).sort((a, b) => timestamp(b) - timestamp(a)).slice(0, Math.min(100, Math.max(0, limit)));
  const governanceRealms = new Map<string, string>();
  for (const item of directory) {
    const realm = directoryRealmKey(item);
    for (const governance of [...(item.governances || []), ...(item.governanceRules || []), item.governance].filter(Boolean)) {
      const address = key(governance);
      if (address) governanceRealms.set(address, realm);
    }
  }
  const activity = new Map<string, { count: number; latestAt: number; latestName: string; proposals: any[] }>();
  for (const proposal of recent) {
    const realm = key(proposal.realm) || governanceRealms.get(key(proposal.account?.governance || proposal.governance));
    if (!realm) continue;
    const current = activity.get(realm);
    if (current) { current.count += 1; if (current.proposals.length < 2) current.proposals.push(proposal); }
    else activity.set(realm, { count: 1, latestAt: timestamp(proposal), latestName: proposal.account?.name || proposal.name || '', proposals: [proposal] });
  }
  return directory.map(item => ({ ...item, recentActivity: activity.get(directoryRealmKey(item)) })).sort((a, b) =>
    (b.recentActivity?.latestAt || 0) - (a.recentActivity?.latestAt || 0) ||
    String(a.governanceName || '').localeCompare(String(b.governanceName || ''))
  );
}
