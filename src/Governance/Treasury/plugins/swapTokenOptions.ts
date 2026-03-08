import { Connection, PublicKey } from '@solana/web3.js';
import { ENV, TokenListProvider } from '@solana/spl-token-registry';
import { APP_CLUSTER, RPC_CONNECTION } from '../../../utils/grapeTools/constants';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export type WalletTokenOption = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balanceUi: number;
  balanceRaw: string;
  logoURI?: string;
  isSol?: boolean;
};

let tokenMapPromise: Promise<Map<string, any>> | null = null;

const getRegistryChainId = () => (APP_CLUSTER === 'devnet' ? ENV.Devnet : ENV.MainnetBeta);

async function getTokenMap(): Promise<Map<string, any>> {
  if (!tokenMapPromise) {
    tokenMapPromise = new TokenListProvider()
      .resolve()
      .then((tokens) => {
        const tokenList = tokens.filterByChainId(getRegistryChainId()).getList();
        return tokenList.reduce((map, item) => {
          map.set(item.address, item);
          return map;
        }, new Map<string, any>());
      })
      .catch(() => new Map<string, any>());
  }
  return tokenMapPromise;
}

export function normalizeMintInput(value: string): string {
  const cleaned = `${value ?? ''}`.trim();
  if (!cleaned) return '';
  if (cleaned.toLowerCase() === 'sol') return SOL_MINT;
  return cleaned;
}

export function shortMintLabel(mint: string): string {
  if (!mint) return '';
  if (mint === SOL_MINT) return 'SOL';
  if (mint.length <= 10) return mint;
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

export function formatWalletTokenOptionLabel(option: WalletTokenOption): string {
  const balance =
    option.balanceUi >= 1000
      ? option.balanceUi.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : option.balanceUi.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const symbol = option.symbol || shortMintLabel(option.mint);
  return `${symbol} • ${balance}`;
}

export async function fetchGovernanceWalletTokenOptions(
  walletAddress: string,
  connection: Connection = RPC_CONNECTION
): Promise<WalletTokenOption[]> {
  const wallet = new PublicKey(walletAddress);
  const tokenMap = await getTokenMap();
  const [solBalanceLamports, tokenAccounts] = await Promise.all([
    connection.getBalance(wallet),
    connection.getParsedTokenAccountsByOwner(wallet, { programId: TOKEN_PROGRAM_ID }),
  ]);

  const byMint = new Map<string, WalletTokenOption>();
  const solBalanceUi = solBalanceLamports / 10 ** 9;

  byMint.set(SOL_MINT, {
    mint: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    balanceUi: solBalanceUi,
    balanceRaw: `${solBalanceLamports}`,
    logoURI: tokenMap.get(SOL_MINT)?.logoURI,
    isSol: true,
  });

  for (const account of tokenAccounts.value || []) {
    const parsedInfo: any = account.account.data?.parsed?.info;
    const mint = parsedInfo?.mint;
    if (!mint) continue;

    const uiTokenAmount = parsedInfo?.tokenAmount;
    const rawAmount = String(uiTokenAmount?.amount || '0');
    const decimals = Number(uiTokenAmount?.decimals || 0);
    const uiAmount = Number(uiTokenAmount?.uiAmount ?? uiTokenAmount?.uiAmountString ?? 0);
    if (!Number.isFinite(uiAmount) || uiAmount <= 0) continue;

    const existing = byMint.get(mint);
    const tokenMeta = tokenMap.get(mint);
    if (existing) {
      existing.balanceUi += uiAmount;
      existing.balanceRaw = `${BigInt(existing.balanceRaw) + BigInt(rawAmount)}`;
      continue;
    }

    byMint.set(mint, {
      mint,
      symbol: tokenMeta?.symbol || shortMintLabel(mint),
      name: tokenMeta?.name || shortMintLabel(mint),
      decimals,
      balanceUi: uiAmount,
      balanceRaw: rawAmount,
      logoURI: tokenMeta?.logoURI,
    });
  }

  return Array.from(byMint.values()).sort((a, b) => {
    if (a.isSol && !b.isSol) return -1;
    if (!a.isSol && b.isSol) return 1;
    if (b.balanceUi !== a.balanceUi) return b.balanceUi - a.balanceUi;
    return a.symbol.localeCompare(b.symbol);
  });
}
