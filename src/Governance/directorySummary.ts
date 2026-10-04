const key = (value: any): string => value?.toBase58?.() || (typeof value === 'string' ? value : '');

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
    councils: items.filter(item => !!key(item.councilMint)).length,
  };
}
