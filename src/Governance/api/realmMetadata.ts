import { Buffer } from 'buffer';
import { BorshCoder, Idl } from '@coral-xyz/anchor';
import { getNativeTreasuryAddress } from '@solana/spl-governance';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';

import { RPC_CONNECTION } from '../../utils/grapeTools/constants';

export const MYTHIC_METADATA_PROGRAM_ID = new PublicKey(
  'metaThtkusoWYDvHBFXfvc93Z3d8iBeDZ4DVyq8SYVR'
);

const MYTHIC_NAMESPACE_SEED = Buffer.from('mythic_metadata');
const METADATA_SEED = Buffer.from('metadata');
const METADATA_KEY_SEED = Buffer.from('metadata_key');
const REALM_METADATA_KEY_ID = 20000n;

const MYTHIC_METADATA_IDL: Idl = {
  version: '0.1.0',
  name: 'mythic_metadata',
  instructions: [],
  accounts: [
    {
      name: 'metadata',
      type: {
        kind: 'struct',
        fields: [
          { name: 'subject', type: 'publicKey' },
          { name: 'metadataKeyId', type: 'u64' },
          { name: 'issuingAuthority', type: 'publicKey' },
          { name: 'updateSlot', type: 'u64' },
          { name: 'updateAuthority', type: { option: 'publicKey' } },
          { name: 'items', type: { vec: { defined: 'MetadataItem' } } },
          { name: 'collections', type: { vec: { defined: 'MetadataCollection' } } },
          { name: 'bump', type: 'u8' },
        ],
      },
    },
  ],
  types: [
    {
      name: 'MetadataCollection',
      type: {
        kind: 'struct',
        fields: [
          { name: 'metadataKeyId', type: 'u64' },
          { name: 'updateSlot', type: 'u64' },
          { name: 'updateAuthority', type: { option: 'publicKey' } },
          { name: 'items', type: { vec: { defined: 'MetadataItem' } } },
        ],
      },
    },
    {
      name: 'MetadataItem',
      type: {
        kind: 'struct',
        fields: [
          { name: 'metadataKeyId', type: 'u64' },
          { name: 'updateSlot', type: 'u64' },
          { name: 'value', type: 'bytes' },
        ],
      },
    },
  ],
};

const coder = new BorshCoder(MYTHIC_METADATA_IDL);

const mythicMetadataLabels = [
  'realm-metadata',
  'displayName',
  'daoImage',
  'bannerImage',
  'shortDescription',
  'category',
  'website',
  'twitter',
  'discord',
  'keywords',
] as const;

const mythicMetadataKeyMap = new Map<string, string>(
  mythicMetadataLabels.map((label, index) => [(20000 + index).toString(), label])
);

export type DaoMetadata = {
  displayName?: string;
  daoImage?: string;
  ogImage?: string;
  bannerImage?: string;
  shortDescription?: string;
  category?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  keywords?: string;
  github?: string;
  [key: string]: any;
};

export type RealmMetadataBundle = {
  gspl?: any;
  mythic?: DaoMetadata | null;
  metadata?: DaoMetadata | null;
};

function toPublicKeySafe(value: any): PublicKey | null {
  try {
    if (!value) return null;
    if (value instanceof PublicKey) return value;
    if (typeof value?.toBase58 === 'function') return new PublicKey(value.toBase58());
    return new PublicKey(value);
  } catch (_e) {
    return null;
  }
}

function cleanString(value: any): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function mergeDefinedValues(base?: DaoMetadata | null, override?: DaoMetadata | null): DaoMetadata | null {
  if (!base && !override) return null;

  const next: DaoMetadata = { ...(base || {}) };
  for (const [key, value] of Object.entries(override || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    next[key] = value;
  }

  if (!next.ogImage && next.daoImage) {
    next.ogImage = next.daoImage;
  }

  return Object.keys(next).length > 0 ? next : null;
}

function deriveMetadataKeyPda(metadataKeyId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [MYTHIC_NAMESPACE_SEED, METADATA_KEY_SEED, u64ToLeBuffer(metadataKeyId)],
    MYTHIC_METADATA_PROGRAM_ID
  )[0];
}

function deriveMetadataPda(metadataMetadataKey: PublicKey, issuingAuthority: PublicKey, subject: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      MYTHIC_NAMESPACE_SEED,
      METADATA_SEED,
      metadataMetadataKey.toBuffer(),
      issuingAuthority.toBuffer(),
      subject.toBuffer(),
    ],
    MYTHIC_METADATA_PROGRAM_ID
  )[0];
}

function u64ToLeBuffer(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  let remainder = value;
  for (let i = 0; i < 8; i += 1) {
    buffer[i] = Number(remainder & 0xffn);
    remainder >>= 8n;
  }
  return buffer;
}

function decodeMythicMetadataAccount(data: Buffer): DaoMetadata | null {
  try {
    const decoded = coder.accounts.decode('metadata', data) as any;
    const items = Array.isArray(decoded?.items) ? decoded.items : [];
    const metadata: DaoMetadata = {};

    for (const item of items) {
      const keyLabel = mythicMetadataKeyMap.get(String(item?.metadataKeyId?.toString?.() || ''));
      if (!keyLabel) continue;

      const rawValue = Buffer.isBuffer(item?.value)
        ? item.value
        : Array.isArray(item?.value)
        ? Buffer.from(item.value)
        : Buffer.from(item?.value || []);
      const stringValue = cleanString(rawValue.toString('utf8'));
      if (!stringValue) continue;

      metadata[keyLabel] = stringValue;
    }

    if (!metadata.ogImage && metadata.daoImage) {
      metadata.ogImage = metadata.daoImage;
    }

    return Object.keys(metadata).length > 0 ? metadata : null;
  } catch (error) {
    console.error('Failed to decode Mythic metadata account', error);
    return null;
  }
}

async function fetchGsplMetadataByEntry(entry: any): Promise<any> {
  if (!entry) return null;
  if (!entry?.metadataUri) {
    return { gspl: entry, metadata: null };
  }

  try {
    const response = await fetch(entry.metadataUri);
    if (!response.ok) {
      return { gspl: entry, metadata: null };
    }

    const metadata = await response.json();
    return { gspl: entry, metadata };
  } catch (error) {
    console.error('Failed to fetch GSPL metadata', error);
    return { gspl: entry, metadata: null };
  }
}

function findGsplEntryForRealm(realm: any, gsplEntries?: any[] | null): any | null {
  const realmName = cleanString(realm?.account?.name);
  if (!realmName || !Array.isArray(gsplEntries)) return null;
  return gsplEntries.find((entry) => cleanString(entry?.name) === realmName) || null;
}

export async function fetchMythicRealmMetadata(
  realm: any,
  connection: Connection = RPC_CONNECTION
): Promise<DaoMetadata | null> {
  const realmPk = toPublicKeySafe(realm?.pubkey);
  const governanceProgramId = toPublicKeySafe(realm?.owner);
  const authority = toPublicKeySafe(realm?.account?.authority);

  if (!realmPk || !governanceProgramId || !authority) {
    return null;
  }

  const metadataKey = deriveMetadataKeyPda(REALM_METADATA_KEY_ID);
  const candidateIssuers: PublicKey[] = [];

  try {
    const authorityAccountInfo = await connection.getAccountInfo(authority);
    if (authorityAccountInfo && !authorityAccountInfo.owner.equals(SystemProgram.programId)) {
      candidateIssuers.push(await getNativeTreasuryAddress(governanceProgramId, authority));
    }
  } catch (_e) {
    // Fallback to trying the authority directly below.
  }

  candidateIssuers.push(authority);

  const attempted = new Set<string>();
  for (const issuer of candidateIssuers) {
    const issuerKey = issuer.toBase58();
    if (attempted.has(issuerKey)) continue;
    attempted.add(issuerKey);

    try {
      const metadataAddress = deriveMetadataPda(metadataKey, issuer, realmPk);
      const accountInfo = await connection.getAccountInfo(metadataAddress);
      if (!accountInfo?.data) continue;

      const decoded = decodeMythicMetadataAccount(accountInfo.data);
      if (decoded) return decoded;
    } catch (_e) {
      // Try the next issuer candidate.
    }
  }

  return null;
}

export async function resolveRealmMetadata(
  realm: any,
  gsplEntries?: any[] | null,
  connection: Connection = RPC_CONNECTION
): Promise<RealmMetadataBundle | null> {
  if (!realm) return null;

  const gsplEntry = findGsplEntryForRealm(realm, gsplEntries);
  const [gsplMetadata, mythicMetadata] = await Promise.all([
    fetchGsplMetadataByEntry(gsplEntry).catch(() => null),
    fetchMythicRealmMetadata(realm, connection).catch(() => null),
  ]);

  const mergedMetadata = mergeDefinedValues(gsplMetadata?.metadata || null, mythicMetadata);

  if (!gsplMetadata && !mythicMetadata && !mergedMetadata) {
    return null;
  }

  return {
    gspl: gsplMetadata?.gspl || gsplEntry || undefined,
    mythic: mythicMetadata,
    metadata: mergedMetadata,
  };
}

export function mergeDaoMetadata(base?: DaoMetadata | null, override?: DaoMetadata | null): DaoMetadata | null {
  return mergeDefinedValues(base, override);
}
