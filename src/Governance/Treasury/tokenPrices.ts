// Balances can arrive before prices, or remain available after a price API failure.
export function sortTreasuryTokens<T extends {address: string; balance: number}>(tokens: T[] | null | undefined, prices: any): T[] {
    const price = (mint: string): number | null => {
        const value = prices?.[mint]?.usdPrice;
        if (value == null || value === '') return null;
        const number = Number(value);
        return Number.isFinite(number) && number >= 0 ? number : null;
    };
    const balance = (token: T) => Number.isFinite(Number(token.balance)) ? Number(token.balance) : 0;
    return [...(tokens || [])].sort((a, b) => {
        const aPrice = price(a.address), bPrice = price(b.address);
        if (aPrice != null && bPrice != null) return balance(b) * bPrice - balance(a) * aPrice;
        if (aPrice != null) return -1;
        if (bPrice != null) return 1;
        return balance(b) - balance(a);
    });
}
