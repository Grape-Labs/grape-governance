// decodeInstructions.ts
import {
  PublicKey,
  SystemProgram,
  StakeProgram,
  VersionedMessage,
  CompiledInstruction,
  TransactionInstruction,
} from '@solana/web3.js';

import { SystemInstruction, StakeInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

import BN from 'bn.js';
import { BorshCoder, Idl } from '@coral-xyz/anchor';

import bs58 from 'bs58';

function toBytes(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (Array.isArray(data) && typeof data[0] === 'number') return Uint8Array.from(data as number[]);
  if (typeof data === 'string') {
    // try base58
    try { return bs58.decode(data); } catch {}
    // try base64
    try { return Uint8Array.from(Buffer.from(data, 'base64')); } catch {}
    // fall back to utf-8 (best effort)
    return new TextEncoder().encode(data);
  }
  // last resort: empty
  return new Uint8Array();
}

/* ---------------- Types ---------------- */
export type TokenMapEntry = { name?: string; symbol?: string; logoURI?: string };
export type TokenMap = Map<string, TokenMapEntry>; // mint -> meta

export type ParsedAccountCacheValue = {
  data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } } };
};
export type ParsedAccountCache = Map<string, ParsedAccountCacheValue>; // pubkey -> parsed info

export type DecodedIxSummary = {
  program?: string;
  type: string;
  ix?: string;
  pubkey?: string | null;
  mint?: string | null;
  name?: string | null;
  logoURI?: string | null;
  amount?: number | null;
  data?: number[];
  destinationAta?: string | null;
  description?: string;
  decodedIx?: any;
  accounts?: string[]; // only for fallback
};

export type OptionalIdls = { jupiterDcaIdl?: Idl; governanceIdl?: Idl };

export type DecodeOptions = {
  message: VersionedMessage;
  accountKeysFromLookups?: { writable: PublicKey[]; readonly: PublicKey[] };
  accountCache?: ParsedAccountCache;
  tokenMap?: TokenMap;
  idls?: OptionalIdls;
  attachIxId?: (ix: CompiledInstruction) => string | undefined;
};

/* ---------------- Consts ---------------- */
const MEMO_PROGRAMS = [
  new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
  new PublicKey('Memo1UhkJRfHyvLMcVucJwxXeuD728eqVDDwQDxFMNo'),
];

const BATCH_TOKEN_PROGRAM = new PublicKey('TbpjRtCg2Z2n2Xx7pFm5HVwsjx9GPJ5MsrfBvCoQRNL');
const JUPITER_DCA_PROGRAM = new PublicKey('DCA265Vj8a9CEuX1eb1LWRnDT7uK6q1xMipnNyatn23M');
const GOVERNANCE_PROGRAM = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
const SOL_MINT = 'So11111111111111111111111111111111111111112';

/* ---------------- Utils ---------------- */
const hex = (u8: Uint8Array) => Array.from(u8).map(b => b.toString(16).padStart(2,'0')).join('');
const toB58 = (k?: PublicKey | string | null) => (k instanceof PublicKey ? k.toBase58() : (k ?? null));
const leU64 = (slice: Uint8Array) => new BN(Buffer.from(slice), 'le');

function formatAmountHuman(amount: BN, decimals = 0, maxFrac = 6): number {
  if (decimals <= 0) return amount.toNumber();
  const base = new BN(10).pow(new BN(decimals));
  const n = amount.toNumber() / base.toNumber();
  return Number(n.toLocaleString(undefined, { maximumFractionDigits: maxFrac }).replace(/,/g, ''));
}

function resolveTokenMeta(tokenMap?: TokenMap, mint?: string | null) {
  if (!tokenMap || !mint) return { name: null, symbol: null, logoURI: null };
  const t = tokenMap.get(mint);
  return { name: t?.name ?? null, symbol: t?.symbol ?? null, logoURI: t?.logoURI ?? null };
}



export function resolveAllAccountKeys(
  message: VersionedMessage,
  accountKeysFromLookups?: { writable: PublicKey[]; readonly: PublicKey[] }
): PublicKey[] {
  const keys = message.getAccountKeys({ accountKeysFromLookups });
  return [
    ...keys.staticAccountKeys,
    ...(keys.accountKeysFromLookups?.writable ?? []),
    ...(keys.accountKeysFromLookups?.readonly ?? []),
  ];
}

function ixAccountsToPubkeys(ix: CompiledInstruction, allKeys: PublicKey[]) {
  return ix.accounts.map(i => allKeys[i]);
}

function compiledIxToTxIx(ix: CompiledInstruction, allKeys: PublicKey[]): TransactionInstruction {
  const programId = allKeys[ix.programIdIndex];
  const keys = ix.accounts.map((index) => ({
    pubkey: allKeys[index],
    isSigner: false,
    isWritable: false,
  }));
  return new TransactionInstruction({
    programId,
    keys,
    data: Buffer.from(ix.data),
  });
}

/* ----------- Decoders: System / Stake / Memo ----------- */
function tryDecodeSystem(ix: CompiledInstruction, allKeys: PublicKey[]): DecodedIxSummary | null {
  try {
    const txIx = compiledIxToTxIx(ix, allKeys);
    const t = SystemInstruction.decodeInstructionType(txIx as any);
    if (t === 'Transfer') {
      const { fromPubkey, toPubkey, lamports } = SystemInstruction.decodeTransfer(txIx as any);
      const sol = Number(lamports) / 1_000_000_000;
      return {
        program: 'SystemProgram',
        type: 'SOL Transfer',
        pubkey: fromPubkey.toBase58(),
        destinationAta: toPubkey.toBase58(),
        amount: Number(sol.toLocaleString(undefined, { maximumFractionDigits: 6 }).replace(/,/g, '')),
        mint: SOL_MINT,
        name: 'SOL',
        logoURI:
          'https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png',
        data: Array.from(ix.data),
        description: `${sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL to ${toPubkey.toBase58()}`,
      };
    }
    return { program: 'SystemProgram', type: `system.${t}`, data: Array.from(ix.data) };
  } catch { return null; }
}

function tryDecodeStake(ix: CompiledInstruction, allKeys: PublicKey[]): DecodedIxSummary | null {
  try {
    const txIx = compiledIxToTxIx(ix, allKeys);
    const t = StakeInstruction.decodeInstructionType(txIx as any);
    const stakeIx = StakeInstruction as any;

    if (t === 'Deactivate') {
      const { stakePubkey, authorizedPubkey } = stakeIx.decodeDeactivate(txIx as any);
      return {
        program: 'Stake',
        type: 'stake.deactivate',
        pubkey: stakePubkey?.toBase58?.() ?? null,
        description: `Deactivate stake account (authorized: ${authorizedPubkey?.toBase58?.() ?? 'unknown'})`,
        data: Array.from(ix.data),
      };
    }

    if (t === 'Withdraw') {
      const decoded = stakeIx.decodeWithdraw(txIx as any);
      const lamports = Number(decoded?.lamports ?? 0);
      const sol = lamports / 1_000_000_000;
      return {
        program: 'Stake',
        type: 'stake.withdraw',
        pubkey: decoded?.stakePubkey?.toBase58?.() ?? null,
        destinationAta: decoded?.toPubkey?.toBase58?.() ?? null,
        amount: Number(sol.toLocaleString(undefined, { maximumFractionDigits: 6 }).replace(/,/g, '')),
        mint: SOL_MINT,
        name: 'SOL',
        logoURI:
          'https://cdn.jsdelivr.net/gh/saber-hq/spl-token-icons@master/icons/101/So11111111111111111111111111111111111111112.png',
        description: `${sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL to ${decoded?.toPubkey?.toBase58?.() ?? 'unknown'}`,
        data: Array.from(ix.data),
      };
    }

    if (t === 'Delegate') {
      const { stakePubkey, authorizedPubkey, votePubkey } = stakeIx.decodeDelegate(txIx as any);
      return {
        program: 'Stake',
        type: 'stake.delegate',
        pubkey: stakePubkey.toBase58(),
        destinationAta: votePubkey.toBase58(),
        description: `Delegate stake (authorized: ${authorizedPubkey.toBase58()})`,
        data: Array.from(ix.data),
      };
    }

    if (t === 'Split') {
      const decoded = stakeIx.decodeSplit(txIx as any);
      const lamports = Number(decoded?.lamports ?? 0);
      const sol = lamports / 1_000_000_000;
      return {
        program: 'Stake',
        type: 'stake.split',
        pubkey: decoded?.stakePubkey?.toBase58?.() ?? null,
        destinationAta: decoded?.splitStakePubkey?.toBase58?.() ?? null,
        amount: Number(sol.toLocaleString(undefined, { maximumFractionDigits: 6 }).replace(/,/g, '')),
        mint: SOL_MINT,
        name: 'SOL',
        description: `Split ${sol.toLocaleString(undefined, { maximumFractionDigits: 6 })} SOL to ${decoded?.splitStakePubkey?.toBase58?.() ?? 'new stake account'}`,
        data: Array.from(ix.data),
      };
    }

    if (t === 'Initialize') {
      const decoded = stakeIx.decodeInitialize(txIx as any);
      return {
        program: 'Stake',
        type: 'stake.initialize',
        pubkey: decoded?.stakePubkey?.toBase58?.() ?? null,
        description: decoded?.authorized
          ? `Initialize stake (staker: ${decoded.authorized.staker?.toBase58?.() ?? 'unknown'}, withdrawer: ${decoded.authorized.withdrawer?.toBase58?.() ?? 'unknown'})`
          : undefined,
        data: Array.from(ix.data),
      };
    }

    if (t === 'Authorize') {
      const decoded = stakeIx.decodeAuthorize(txIx as any);
      return {
        program: 'Stake',
        type: 'stake.authorize',
        pubkey: decoded?.stakePubkey?.toBase58?.() ?? null,
        description: `Authorize ${decoded?.stakeAuthorizationType ?? 'stake'} to ${decoded?.newAuthorizedPubkey?.toBase58?.() ?? 'unknown'}`,
        data: Array.from(ix.data),
      };
    }

    if (t === 'Merge' && typeof stakeIx.decodeMerge === 'function') {
      const decoded = stakeIx.decodeMerge(txIx as any);
      return {
        program: 'Stake',
        type: 'stake.merge',
        pubkey: decoded?.destinationStakePubkey?.toBase58?.() ?? decoded?.stakePubkey?.toBase58?.() ?? null,
        destinationAta: decoded?.sourceStakePubkey?.toBase58?.() ?? null,
        description: 'Merge stake accounts',
        data: Array.from(ix.data),
      };
    }

    return { program: 'Stake', type: `stake.${t}`, data: Array.from(ix.data) };
  } catch { return null; }
}

function tryDecodeMemo(ix: CompiledInstruction, programId: PublicKey): DecodedIxSummary | null {
  if (!MEMO_PROGRAMS.some(p => p.equals(programId))) return null;
  try {
    const memo = new TextDecoder().decode(Uint8Array.from(ix.data));
    return { program: 'Memo', type: 'memo', description: memo, data: Array.from(ix.data) };
  } catch {
    return { program: 'Memo', type: 'memo', description: hex(Uint8Array.from(ix.data)), data: Array.from(ix.data) };
  }
}

/* -------- SPL Token (manual: Transfer & TransferChecked) -------- */
function tryDecodeSplTokenManual(
  ix: CompiledInstruction,
  allKeys: PublicKey[],
  accountCache?: ParsedAccountCache,
  tokenMap?: TokenMap
): DecodedIxSummary | null {
  const data = Uint8Array.from(ix.data);
  if (data.length === 0) return null;

  const discr = data[0]; // TokenInstruction discriminator
  const accounts = ixAccountsToPubkeys(ix, allKeys);
  const u64 = (u8: Uint8Array) => leU64(u8);
  const accountParsed = (pk?: PublicKey) => (pk ? accountCache?.get(pk.toBase58()) : undefined);

  // Transfer (3): [3, amount(8 le)], accounts: 0=source, 1=dest, 2=owner
  if (discr === 3) {
    if (data.length < 1 + 8) return null;
    const source = accounts[0];
    const dest = accounts[1];
    const amountBN = u64(data.slice(1, 1 + 8));

    const srcParsed = accountParsed(source);
    const decimals = srcParsed?.data?.parsed?.info?.tokenAmount?.decimals ?? 0;
    const mint = srcParsed?.data?.parsed?.info?.mint ?? null;
    const amount = formatAmountHuman(amountBN, decimals);

    const meta = resolveTokenMeta(tokenMap, mint);
    const symbol = meta.symbol ?? (mint ? `${mint.slice(0, 3)}...${mint.slice(-3)}` : null);

    return {
      program: 'SPL Token',
      type: 'TokenTransfer',
      pubkey: source?.toBase58() ?? null,
      destinationAta: dest?.toBase58() ?? null,
      mint,
      name: meta.name ?? symbol,
      logoURI: meta.logoURI ?? null,
      amount,
      data: Array.from(ix.data),
      description: `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${meta.symbol ?? symbol ?? ''} to ${dest?.toBase58()}`,
    };
  }

  // TransferChecked (12): [12, amount(8 le), decimals(1)], accounts: 0=src,1=mint,2=dest,3=owner
  if (discr === 12) {
    if (data.length < 1 + 8 + 1) return null;
    const source = accounts[0];
    const mintPk = accounts[1];
    const dest = accounts[2];

    const amountBN = u64(data.slice(1, 1 + 8));
    const decimals = data[1 + 8];
    const mint = mintPk?.toBase58() ?? null;
    const amount = formatAmountHuman(amountBN, decimals);

    const meta = resolveTokenMeta(tokenMap, mint);
    const symbol = meta.symbol ?? (mint ? `${mint.slice(0, 3)}...${mint.slice(-3)}` : null);

    return {
      program: 'SPL Token',
      type: 'TokenTransferChecked',
      pubkey: source?.toBase58() ?? null,
      destinationAta: dest?.toBase58() ?? null,
      mint,
      name: meta.name ?? symbol,
      logoURI: meta.logoURI ?? null,
      amount,
      data: Array.from(ix.data),
      description: `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${meta.symbol ?? symbol ?? ''} to ${dest?.toBase58()}`,
    };
  }

  return null;
}

/* -------- Your special cases: Batch / DCA / Governance -------- */
function tryDecodeBatchTokenTransfer(
  ix: CompiledInstruction,
  allKeys: PublicKey[],
  tokenMap?: TokenMap,
  accountCache?: ParsedAccountCache
): DecodedIxSummary | null {
  try {
    const accounts = ixAccountsToPubkeys(ix, allKeys);
    const source = accounts[0];
    const dest = accounts[1];
    const dataU8 = Uint8Array.from(ix.data);
    const amountBN = leU64(dataU8.slice(1)); // like your code

    const gai = accountCache?.get(source.toBase58());
    const decimals = gai?.data?.parsed?.info?.tokenAmount?.decimals ?? 0;
    const mint = gai?.data?.parsed?.info?.mint ?? null;
    const amount = formatAmountHuman(amountBN, decimals);

    const meta = resolveTokenMeta(tokenMap, mint);
    const symbol = meta.symbol ?? (mint ? `${mint.slice(0, 3)}...${mint.slice(-3)}` : null);

    return {
      program: 'BatchTokenProgram',
      type: 'BatchTokenTransfer',
      pubkey: source?.toBase58(),
      destinationAta: dest?.toBase58() ?? null,
      mint,
      name: meta.name ?? symbol,
      logoURI: meta.logoURI ?? null,
      amount,
      data: Array.from(ix.data),
      description: `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${meta.symbol ?? symbol ?? ''} to ${dest?.toBase58()}`,
    };
  } catch { return null; }
}

function tryDecodeJupiterDca(
  ix: CompiledInstruction,
  programId: PublicKey,
  idl?: Idl
): DecodedIxSummary | null {
  if (!programId.equals(JUPITER_DCA_PROGRAM)) return null;
  const bytes = Uint8Array.from(ix.data);
  let decodedIx: any = null;
  try {
    if (idl) {
      const coder = new BorshCoder(idl);
      decodedIx = coder.instruction.decode(hex(bytes), 'hex');
    }
  } catch { /* ignore */ }

  // Build human string (best-effort)
  let description = '';
  try {
    const kv: string[] = [];
    if (decodedIx?.name) kv.push(`Name: ${decodedIx.name}`);
    const d = decodedIx?.data ?? {};
    const num = (k: string) => (d[k] != null ? Number(BigInt(d[k])) : undefined);
    const inAmt = num('inAmount');
    const inPer = num('inAmountPerCycle');
    const freq = num('cycleFrequency');
    const minP = num('minPrice');
    const maxP = num('maxPrice');
    const start = num('startAt');
    if (inAmt != null) kv.push(`In: ${inAmt}`);
    if (inPer != null) kv.push(`In p/Cycle: ${inPer}`);
    if (freq != null) kv.push(`Cycle Frequency: ${freq}s`);
    if (inAmt != null && inPer != null) kv.push(`Cycles: ${Math.floor(inAmt / inPer)}`);
    if (minP != null) kv.push(`Min Price: ${minP}`);
    if (maxP != null) kv.push(`Max Price: ${maxP}`);
    if (start != null) kv.push(`Starting: ${start}`);
    description = kv.join(' - ');
  } catch { /* ignore */ }

  return {
    program: 'JupiterDCA',
    type: 'DCA Program by Jupiter',
    decodedIx,
    data: Array.from(ix.data),
    description: description || undefined,
  };
}

function tryDecodeGovernance(
  ix: CompiledInstruction,
  programId: PublicKey,
  allKeys: PublicKey[],
  accountCache?: ParsedAccountCache,
  tokenMap?: TokenMap,
  idl?: Idl
): DecodedIxSummary | null {
  if (!programId.equals(GOVERNANCE_PROGRAM)) return null;

  const accounts = ixAccountsToPubkeys(ix, allKeys);
  const bytes = Uint8Array.from(ix.data);

  // optional IDL decode
  let decodedIx: any = null;
  try {
    if (idl) {
      const coder = new BorshCoder(idl);
      decodedIx = coder.instruction.decode(hex(bytes), 'hex');
    }
  } catch { /* ignore */ }

  // Heuristic like your “grant voting power”
  let amount: number | null = null;
  let mint: string | null = null;
  let destinationAta: string | null = null;
  let name: string | null = null;
  let logoURI: string | null = null;
  try {
    const amtBN = leU64(bytes.slice(1));
    if (amtBN.gt(new BN(0))) {
      const sourceAta = accounts[0];
      const gai = accountCache?.get(sourceAta.toBase58());
      const decimals = gai?.data?.parsed?.info?.tokenAmount?.decimals ?? 0;
      amount = formatAmountHuman(amtBN, decimals);

      if (accounts.length > 2) {
        const mintAcc = accounts[2];
        const mintInfo = accountCache?.get(mintAcc.toBase58());
        mint = mintInfo?.data?.parsed?.info?.mint ?? (gai?.data?.parsed?.info?.mint ?? null);
        const meta = resolveTokenMeta(tokenMap, mint ?? undefined);
        name = meta.name ?? meta.symbol ?? (mint ? `${mint.slice(0, 3)}...${mint.slice(-3)}` : null);
        logoURI = meta.logoURI ?? null;
        if (accounts.length > 3) destinationAta = accounts[3].toBase58();
      }
    }
  } catch { /* ignore */ }

  let description: string | undefined;
  if (amount != null && destinationAta) {
    description = `Grant ${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${name ?? ''} to ${destinationAta}`;
  }

  return {
    program: 'SPL Governance',
    type: 'SPL Governance Program by Solana',
    decodedIx,
    amount,
    mint,
    name,
    logoURI,
    destinationAta,
    data: Array.from(ix.data),
    description,
  };
}

/* ---------------- Public API ---------------- */
export function decodeCompiledInstructions(
  compiledIxs: CompiledInstruction[],
  opts: DecodeOptions
): { summaries: DecodedIxSummary[]; ataCandidates: Set<string> } {
  const { message, accountKeysFromLookups, accountCache, tokenMap, idls, attachIxId } = opts;
  const allKeys = resolveAllAccountKeys(message, accountKeysFromLookups);
  const ataCandidates = new Set<string>();
  const summaries: DecodedIxSummary[] = [];

  for (const ix of compiledIxs) {
    // collect non-signer candidates (like your ataArray harvesting)
    for (const idx of ix.accounts) {
      const pk = allKeys[idx];
      if (pk) ataCandidates.add(pk.toBase58());
    }

    const programId = allKeys[ix.programIdIndex];

    const memo = tryDecodeMemo(ix, programId);
    if (memo) { memo.ix = attachIxId?.(ix); summaries.push(memo); continue; }

    if (programId.equals(SystemProgram.programId)) {
      const sys = tryDecodeSystem(ix, allKeys);
      if (sys) { sys.ix = attachIxId?.(ix); summaries.push(sys); continue; }
    }

    if (programId.equals(StakeProgram.programId)) {
      const st = tryDecodeStake(ix, allKeys);
      if (st) { st.ix = attachIxId?.(ix); summaries.push(st); continue; }
    }

    if (programId.equals(TOKEN_PROGRAM_ID)) {
      const tok = tryDecodeSplTokenManual(ix, allKeys, accountCache, tokenMap);
      if (tok) { tok.ix = attachIxId?.(ix); summaries.push(tok); continue; }
    }

    if (programId.equals(BATCH_TOKEN_PROGRAM)) {
      const bt = tryDecodeBatchTokenTransfer(ix, allKeys, tokenMap, accountCache);
      if (bt) { bt.ix = attachIxId?.(ix); summaries.push(bt); continue; }
    }

    if (programId.equals(JUPITER_DCA_PROGRAM)) {
      const dca = tryDecodeJupiterDca(ix, programId, idls?.jupiterDcaIdl);
      if (dca) { dca.ix = attachIxId?.(ix); summaries.push(dca); continue; }
    }

    if (programId.equals(GOVERNANCE_PROGRAM)) {
      const gov = tryDecodeGovernance(ix, programId, allKeys, accountCache, tokenMap, idls?.governanceIdl);
      if (gov) { gov.ix = attachIxId?.(ix); summaries.push(gov); continue; }
    }

    // Fallback
    const fb: DecodedIxSummary = {
      program: programId.toBase58(),
      type: 'Unknown Program',
      accounts: ixAccountsToPubkeys(ix, allKeys).map(k => k.toBase58()),
      data: Array.from(ix.data),
      description: new TextDecoder().decode(Uint8Array.from(ix.data)).replace(/[^\x20-\x7E\n\r\t]/g, ''),
    };
    fb.ix = attachIxId?.(ix);
    summaries.push(fb);
  }

  return { summaries, ataCandidates };
}
