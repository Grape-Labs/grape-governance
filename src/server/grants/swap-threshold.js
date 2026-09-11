import BigNumber from 'bignumber.js';

// Walk finalized history newest-first from an anchored wallet balance. Incoming
// transfers must be reversed too, including deposits returned from governance.
export function assessSwaps(transactions, rows, wallet, mint, snapshot) {
  let balance = snapshot?.balance == null ? null : new BigNumber(snapshot.balance);
  if (!balance?.isFinite() || balance.isNegative()) balance = null;
  const assessed = new Map();
  const seen = new Set();
  let previousSlot = snapshot?.slot;
  for (const tx of transactions) {
    if (seen.has(tx.signature)) continue;
    seen.add(tx.signature);
    if (!Number.isSafeInteger(tx.slot) || tx.slot < 111491819 ||
        !Number.isSafeInteger(previousSlot) || tx.slot > previousSlot) balance = null;
    previousSlot = tx.slot;
    if (tx.transactionError) continue;
    if (!Array.isArray(tx.accountData)) balance = null;
    const changes = (tx.accountData || []).flatMap(a => a.tokenBalanceChanges || [])
      .filter(c => c.mint === mint && c.userAccount === wallet);
    let delta = new BigNumber(0);
    for (const change of changes) {
      const raw = change.rawTokenAmount;
      if (!raw || !/^-?\d+$/.test(raw.tokenAmount) || !Number.isInteger(raw.decimals) || raw.decimals < 0 || raw.decimals > 255) {
        balance = null; break;
      }
      delta = delta.plus(new BigNumber(raw.tokenAmount).shiftedBy(-raw.decimals));
    }
    const relevantTransfer = (tx.tokenTransfers || []).some(t =>
      t.mint === mint && (t.fromUserAccount === wallet || t.toUserAccount === wallet));
    const swap = rows.find(r => r.signature === tx.signature && r.type === 'swap');
    if ((relevantTransfer || swap) && !changes.length) balance = null;
    if (balance) {
      balance = balance.minus(delta);
      if (balance.isNegative()) balance = null;
    }
    if (swap) {
      const valid = balance?.gt(0) && new BigNumber(swap.amount).lte(balance);
      assessed.set(tx.signature, {
        holdingsBefore: valid ? balance.toFixed() : null,
        swapPercent: valid ? new BigNumber(swap.amount).div(balance).times(100).toFixed() : null,
        // Compare exact amounts; never compare a rounded display percentage.
        thresholdExceeded: valid ? new BigNumber(swap.amount).times(10).gte(balance) : null,
      });
    }
  }
  return {
    rows: rows.map(row => row.type === 'swap' ? {...row, ...assessed.get(row.signature)} : row),
    snapshot: {slot: snapshot?.slot ?? null, balance: balance?.toFixed() ?? null},
  };
}
