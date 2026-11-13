import BigNumber from 'bignumber.js';
import BN from 'bn.js';
import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token-v2';
import { getTokenMap, shortMintLabel, WalletTokenOption } from './swapTokenOptions';

// The batch builder spends from the treasury ATA, so only offer balances it can spend.
export async function fetchBatchTransferTokens(connection: any, walletAddress: string): Promise<WalletTokenOption[]> {
  const owner = new PublicKey(walletAddress);
  const [accounts, registry] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    getTokenMap(),
  ]);
  const options = await Promise.all(accounts.value.map(async (account: any) => {
    const info = account.account.data?.parsed?.info;
    if (!info?.mint || !/^\d+$/.test(info.tokenAmount?.amount || '') || BigInt(info.tokenAmount.amount) === BigInt(0) || info.state === 'frozen') return null;
    const mint = new PublicKey(info.mint);
    const ata = await getAssociatedTokenAddress(mint, owner, true);
    if (!ata.equals(new PublicKey(account.pubkey))) return null;
    const meta = registry.get(info.mint);
    return {
      mint: info.mint,
      symbol: meta?.symbol || shortMintLabel(info.mint),
      name: meta?.name || 'Unlisted token',
      decimals: info.tokenAmount.decimals,
      balanceUi: Number(info.tokenAmount.uiAmountString || info.tokenAmount.uiAmount || 0),
      balanceRaw: info.tokenAmount.amount,
      logoURI: meta?.logoURI,
    } as WalletTokenOption;
  }));
  const candidates = options.filter((option): option is WalletTokenOption => !!option);
  // A wallet balance of one is not enough to identify an NFT: inspect mint supply.
  const zeroDecimalMints = candidates.filter(option => option.decimals === 0);
  const nftMints = new Set<string>();
  for (let offset = 0; offset < zeroDecimalMints.length; offset += 100) {
    const chunk = zeroDecimalMints.slice(offset, offset + 100);
    const mintAccounts = await connection.getMultipleAccountsInfo(chunk.map(option => new PublicKey(option.mint)));
    chunk.forEach((option, index) => {
      const account = mintAccounts[index];
      // Legacy SPL mint layout: supply at 36..44, decimals at 44.
      // Omit unverifiable zero-decimal mints as well as singleton NFT mints.
      if (!account || !account.owner.equals(TOKEN_PROGRAM_ID) || account.data.length < 82 ||
          new BN(Buffer.from(account.data).subarray(36, 44), 'le').lte(new BN(1))) {
        nftMints.add(option.mint);
      }
    });
  }
  return candidates.filter(option => !nftMints.has(option.mint)).sort((a, b) => {
    const named = (option: WalletTokenOption) => !!(registry.get(option.mint)?.name || registry.get(option.mint)?.symbol);
    if (named(a) !== named(b)) return named(a) ? -1 : 1;
    const amount = (option: WalletTokenOption) => new BigNumber(option.balanceRaw).shiftedBy(-option.decimals);
    return amount(b).comparedTo(amount(a)) || a.symbol.localeCompare(b.symbol) || a.mint.localeCompare(b.mint);
  });
}
