import { Buffer } from "buffer";
import { sha256 } from "@ethersproject/sha2";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import * as sns from "@bonfida/spl-name-service";
import BN from "bn.js";

type SnsAny = any;

const snsAny = sns as SnsAny;

function asPublicKey(value: unknown, fallback: string): PublicKey {
  try {
    if (value instanceof PublicKey) return value;
    if (value) return new PublicKey(value as string);
  } catch {
    // Fall through to fallback.
  }
  return new PublicKey(fallback);
}

function normalizeIx(value: unknown): TransactionInstruction[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item: any) => item && item.programId && item.keys && item.data) as TransactionInstruction[];
  }
  if ((value as any).programId && (value as any).keys && (value as any).data) {
    return [value as TransactionInstruction];
  }
  return [];
}

function normalizeRegisterResult(value: unknown): [TransactionInstruction[], TransactionInstruction[]] {
  if (Array.isArray(value) && value.length === 2 && Array.isArray(value[0]) && Array.isArray(value[1])) {
    return [normalizeIx(value[0]), normalizeIx(value[1])];
  }
  const all = normalizeIx(value);
  return [[], all];
}

function parseRegistryState(data: Buffer) {
  return {
    parentName: new PublicKey(data.slice(0, 32)),
    owner: new PublicKey(data.slice(32, 64)),
    class: new PublicKey(data.slice(64, 96)),
    data: data.slice(96),
  };
}

async function retrieveRegistryFallback(connection: Connection, nameAccountKey: PublicKey) {
  const info = await connection.getAccountInfo(nameAccountKey);
  if (!info?.data) {
    throw new Error("Invalid name account provided");
  }
  return {
    registry: parseRegistryState(info.data),
    nftOwner: null,
  };
}

async function retrieveRegistryBatchFallback(connection: Connection, nameAccountKeys: PublicKey[]) {
  const result: ({ data: Buffer } | undefined)[] = [];
  const keys = [...nameAccountKeys];
  while (keys.length > 0) {
    const chunk = keys.splice(0, 100);
    const infos = await connection.getMultipleAccountsInfo(chunk);
    for (const info of infos) {
      if (!info?.data) {
        result.push(undefined);
      } else {
        result.push(parseRegistryState(info.data));
      }
    }
  }
  return result;
}

export const HASH_PREFIX: string = typeof snsAny.HASH_PREFIX === "string" ? snsAny.HASH_PREFIX : "SPL Name Service";

export const NAME_PROGRAM_ID: PublicKey = asPublicKey(
  snsAny.NAME_PROGRAM_ID,
  "namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX"
);

export const ROOT_DOMAIN_ACCOUNT: PublicKey = asPublicKey(
  snsAny.ROOT_DOMAIN_ACCOUNT,
  "58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx"
);

export const BONFIDA_FIDA_BNB: PublicKey = asPublicKey(
  snsAny.BONFIDA_FIDA_BNB,
  "AUoZ3YAhV3b2rZeEH93UMZHXUZcTramBvb4d9YEVySkc"
);

export const TWITTER_VERIFICATION_AUTHORITY: PublicKey = asPublicKey(
  snsAny.TWITTER_VERIFICATION_AUTHORITY,
  "FvPH7PrVrLGKPfqaf3xJodFTjZriqrAXXLTVWEorTFBi"
);

export const TWITTER_ROOT_PARENT_REGISTRY_KEY: PublicKey = asPublicKey(
  snsAny.TWITTER_ROOT_PARENT_REGISTRY_KEY,
  "4YcexoW3r78zz16J2aqmukBLRwGq6rAvWzJpkYAXqebv"
);

const REVERSE_LOOKUP_CLASS: PublicKey = asPublicKey(
  snsAny.REVERSE_LOOKUP_CLASS,
  "33m47vH6Eav6jr5Ry86XjhRft2jRBLDnDgPSHoquXi2Z"
);

export class NameRegistryState {
  static HEADER_LEN = 96;

  static async retrieve(connection: Connection, nameAccountKey: PublicKey) {
    if (snsAny.NameRegistryState?.retrieve) {
      return snsAny.NameRegistryState.retrieve(connection, nameAccountKey);
    }
    return retrieveRegistryFallback(connection, nameAccountKey);
  }

  static async retrieveBatch(connection: Connection, nameAccountKeys: PublicKey[]) {
    if (snsAny.NameRegistryState?.retrieveBatch) {
      return snsAny.NameRegistryState.retrieveBatch(connection, nameAccountKeys);
    }
    return retrieveRegistryBatchFallback(connection, nameAccountKeys);
  }
}

export class ReverseTwitterRegistryState {
  static async retrieve(connection: Connection, reverseRegistryKey: PublicKey) {
    if (snsAny.ReverseTwitterRegistryState?.retrieve) {
      return snsAny.ReverseTwitterRegistryState.retrieve(connection, reverseRegistryKey);
    }
    throw new Error("ReverseTwitterRegistryState.retrieve is unavailable in this SNS SDK version");
  }
}

export async function getHashedName(name: string): Promise<Buffer> {
  if (typeof snsAny.getHashedName === "function") {
    return snsAny.getHashedName(name);
  }
  const input = HASH_PREFIX + name;
  const str = sha256(Buffer.from(input, "utf8")).slice(2);
  return Buffer.from(str, "hex");
}

export async function getNameAccountKey(
  hashedName: Buffer,
  nameClass?: PublicKey,
  nameParent?: PublicKey
): Promise<PublicKey> {
  if (typeof snsAny.getNameAccountKey === "function") {
    return snsAny.getNameAccountKey(hashedName, nameClass, nameParent);
  }

  const seeds = [hashedName, nameClass ? nameClass.toBuffer() : Buffer.alloc(32), nameParent ? nameParent.toBuffer() : Buffer.alloc(32)];
  const [nameAccountKey] = await PublicKey.findProgramAddress(seeds, NAME_PROGRAM_ID);
  return nameAccountKey;
}

export async function performReverseLookup(connection: Connection, nameAccount: PublicKey): Promise<string> {
  if (typeof snsAny.performReverseLookup === "function") {
    return snsAny.performReverseLookup(connection, nameAccount);
  }
  if (typeof snsAny.reverseLookup === "function") {
    return snsAny.reverseLookup(connection, nameAccount);
  }

  const hashedReverseLookup = await getHashedName(nameAccount.toBase58());
  const reverseLookupAccount = await getNameAccountKey(hashedReverseLookup, REVERSE_LOOKUP_CLASS);
  const { registry } = await NameRegistryState.retrieve(connection, reverseLookupAccount);
  if (!registry?.data) {
    throw new Error("Could not retrieve name data");
  }
  const nameLength = new BN(registry.data.slice(0, 4), "le").toNumber();
  return registry.data.slice(4, 4 + nameLength).toString();
}

export async function performReverseLookupBatch(
  connection: Connection,
  nameAccounts: PublicKey[]
): Promise<(string | undefined)[]> {
  if (typeof snsAny.performReverseLookupBatch === "function") {
    return snsAny.performReverseLookupBatch(connection, nameAccounts);
  }
  if (typeof snsAny.reverseLookupBatch === "function") {
    return snsAny.reverseLookupBatch(connection, nameAccounts);
  }

  const reverseLookupAccounts: PublicKey[] = [];
  for (const nameAccount of nameAccounts) {
    const hashedReverseLookup = await getHashedName(nameAccount.toBase58());
    const reverseLookupAccount = await getNameAccountKey(hashedReverseLookup, REVERSE_LOOKUP_CLASS);
    reverseLookupAccounts.push(reverseLookupAccount);
  }

  const names = await NameRegistryState.retrieveBatch(connection, reverseLookupAccounts);

  return names.map((name: any) => {
    if (name === undefined || name.data === undefined) {
      return undefined;
    }
    const nameLength = new BN(name.data.slice(0, 4), "le").toNumber();
    return name.data.slice(4, 4 + nameLength).toString();
  });
}

export async function getAllDomains(connection: Connection, wallet: PublicKey): Promise<PublicKey[]> {
  if (typeof snsAny.getAllDomains === "function") {
    return snsAny.getAllDomains(connection, wallet);
  }

  const filters = [
    { memcmp: { offset: 32, bytes: wallet.toBase58() } },
    { memcmp: { offset: 0, bytes: ROOT_DOMAIN_ACCOUNT.toBase58() } },
  ];
  const accounts = await connection.getProgramAccounts(NAME_PROGRAM_ID, {
    filters,
    dataSlice: { offset: 0, length: 0 },
  });
  return accounts.map((item) => item.pubkey);
}

export async function getDomainKeysWithReverses(
  connection: Connection,
  wallet: PublicKey
): Promise<Array<{ pubKey: PublicKey; domain?: string }>> {
  if (typeof snsAny.getDomainKeysWithReverses === "function") {
    return snsAny.getDomainKeysWithReverses(connection, wallet);
  }

  const pubkeys = await getAllDomains(connection, wallet);
  const names = await performReverseLookupBatch(connection, pubkeys);
  return pubkeys.map((pubKey, index) => ({ pubKey, domain: names[index] || undefined }));
}

export async function getTokenizedDomains(
  connection: Connection,
  owner: PublicKey
): Promise<Array<{ key: PublicKey; mint?: PublicKey; reverse?: string }>> {
  if (typeof snsAny.getTokenizedDomains === "function") {
    return snsAny.getTokenizedDomains(connection, owner);
  }
  return [];
}

export async function getMultiplePrimaryDomains(
  connection: Connection,
  wallets: PublicKey[]
): Promise<Array<string | undefined>> {
  if (typeof snsAny.getMultiplePrimaryDomains === "function") {
    return snsAny.getMultiplePrimaryDomains(connection, wallets);
  }
  return wallets.map(() => undefined);
}

export async function findSubdomains(connection: Connection, parentKey: PublicKey): Promise<string[]> {
  if (typeof snsAny.findSubdomains === "function") {
    return snsAny.findSubdomains(connection, parentKey);
  }
  return [];
}

export function getTwitterRegistry(...args: any[]) {
  if (typeof snsAny.getTwitterRegistry === "function") {
    return snsAny.getTwitterRegistry(...args);
  }
  throw new Error("getTwitterRegistry is unavailable in this SNS SDK version");
}

export async function transferNameOwnership(...args: any[]): Promise<TransactionInstruction> {
  if (typeof snsAny.transferNameOwnership === "function") {
    return snsAny.transferNameOwnership(...args);
  }
  throw new Error("transferNameOwnership is unavailable in this SNS SDK version");
}

export function transferInstruction(...args: any[]): TransactionInstruction {
  if (typeof snsAny.transferInstruction === "function") {
    return snsAny.transferInstruction(...args);
  }
  throw new Error("transferInstruction is unavailable in this SNS SDK version");
}

export async function createNameRegistry(...args: any[]): Promise<TransactionInstruction> {
  if (typeof snsAny.createNameRegistry === "function") {
    return snsAny.createNameRegistry(...args);
  }
  throw new Error("createNameRegistry is unavailable in this SNS SDK version");
}

export async function createSubdomain(
  connection: Connection,
  subdomain: string,
  owner: PublicKey,
  space = 2000,
  feePayer?: PublicKey
): Promise<TransactionInstruction[]> {
  if (typeof snsAny.createSubdomain === "function") {
    return snsAny.createSubdomain(connection, subdomain, owner, space, feePayer);
  }

  const normalized = `${subdomain || ""}`.trim().toLowerCase().replace(/\.sol$/, "");
  const parts = normalized.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid subdomain format. Expected: sub.parent.sol");
  }

  const subLabel = parts[0];
  const parentLabel = parts[1];
  const parentHashed = await getHashedName(parentLabel);
  const parentNameAccount = await getNameAccountKey(parentHashed, undefined, ROOT_DOMAIN_ACCOUNT);

  const ix = await createNameRegistry(
    connection,
    `\0${subLabel}`,
    Math.max(1, Math.floor(Number(space) || 1)),
    feePayer || owner,
    owner,
    undefined,
    undefined,
    parentNameAccount
  );
  return [ix];
}

export async function transferSubdomain(
  connection: Connection,
  subdomain: string,
  newOwner: PublicKey,
  isParentOwnerSigner = false,
  owner?: PublicKey
): Promise<TransactionInstruction> {
  if (typeof snsAny.transferSubdomain === "function") {
    return snsAny.transferSubdomain(connection, subdomain, newOwner, isParentOwnerSigner, owner);
  }

  const normalized = `${subdomain || ""}`.trim().toLowerCase().replace(/\.sol$/, "");
  const parts = normalized.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid subdomain format. Expected: sub.parent.sol");
  }

  const subLabel = parts[0];
  const parentLabel = parts[1];
  const parentHashed = await getHashedName(parentLabel);
  const parentNameAccount = await getNameAccountKey(parentHashed, undefined, ROOT_DOMAIN_ACCOUNT);
  const subHashed = await getHashedName(`\0${subLabel}`);
  const subNameAccount = await getNameAccountKey(subHashed, undefined, parentNameAccount);

  let currentOwner = owner;
  if (!currentOwner) {
    const existing = await NameRegistryState.retrieve(connection, subNameAccount);
    currentOwner = existing.registry.owner;
  }

  let parentOwner: PublicKey | undefined;
  if (isParentOwnerSigner) {
    const parentState = await NameRegistryState.retrieve(connection, parentNameAccount);
    parentOwner = parentState.registry.owner;
  }

  return transferInstruction(
    NAME_PROGRAM_ID,
    subNameAccount,
    newOwner,
    currentOwner,
    undefined,
    isParentOwnerSigner ? parentNameAccount : undefined,
    parentOwner
  );
}

export async function registerDomainName(
  name: string,
  space: number,
  buyer: PublicKey,
  buyerTokenAccount: PublicKey,
  connection?: Connection,
  quoteMint?: PublicKey
): Promise<[TransactionInstruction[], TransactionInstruction[]]> {
  const attempts: Array<() => Promise<unknown>> = [];

  if (typeof snsAny.registerDomainNameV2 === "function") {
    if (connection && quoteMint) {
      attempts.push(() => snsAny.registerDomainNameV2(connection, name, space, buyer, buyerTokenAccount, quoteMint));
      attempts.push(() => snsAny.registerDomainNameV2(name, space, buyer, buyerTokenAccount, connection, quoteMint));
    }
    if (connection) {
      attempts.push(() => snsAny.registerDomainNameV2(connection, name, space, buyer, buyerTokenAccount));
      attempts.push(() => snsAny.registerDomainNameV2(name, space, buyer, buyerTokenAccount, connection));
    }
    if (quoteMint) {
      attempts.push(() => snsAny.registerDomainNameV2(name, space, buyer, buyerTokenAccount, quoteMint));
    }
    attempts.push(() => snsAny.registerDomainNameV2(name, space, buyer, buyerTokenAccount));
  }

  if (typeof snsAny.registerDomainName === "function") {
    attempts.push(() => snsAny.registerDomainName(name, space, buyer, buyerTokenAccount));
  }

  let lastErr: unknown;
  for (const call of attempts) {
    try {
      const result = await call();
      return normalizeRegisterResult(result);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("registerDomainName is unavailable in this SNS SDK version");
}
