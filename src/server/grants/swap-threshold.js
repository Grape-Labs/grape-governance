import BigNumber from 'bignumber.js';

// Governance history must be complete and reconcile to the finalized on-chain
// deposit amount. A withdrawal preserves its prior position as the policy basis
// until a later deposit/revocation changes the governance position.
export function assessGovernanceSwaps(rows, changes, snapshot, complete) {
  const unavailable = () => rows.map(row => row.type === 'swap' ? {...row,
    governanceBasis:null, basisSignature:null, swapPercent:null, thresholdExceeded:null} : row);
  if (!complete || !snapshot || !Number.isSafeInteger(snapshot.slot)) return unavailable();
  let position = new BigNumber(0);
  let basis = new BigNumber(0);
  let basisSignature = null;
  const timeline = [];
  let priorSlot = 0;
  const seen = new Set();
  // Changes arrive in descending transaction order; reverse preserves same-slot
  // instruction order without guessing from timestamps.
  for (const change of [...changes].reverse()) {
    if (seen.has(change.id)) continue;
    seen.add(change.id);
    if (!Number.isSafeInteger(change.slot) || change.slot < priorSlot || change.slot > snapshot.slot || change.kind === 'unknown') return unavailable();
    priorSlot = change.slot;
    const amount = new BigNumber(change.amount ?? 0);
    if (!amount.isFinite() || amount.isNegative()) return unavailable();
    if (change.kind === 'deposit') {
      position = position.plus(amount);
      basis = position;
    } else if (change.kind === 'withdraw') {
      // SPL Governance withdraws the entire native token deposit.
      if (position.gt(0)) basis = position;
      position = new BigNumber(0);
    } else if (change.kind === 'revoke') {
      position = position.minus(amount);
      basis = position;
    } else if (change.kind !== 'create') return unavailable();
    if (position.isNegative()) return unavailable();
    basisSignature = change.signature;
    timeline.push({...change, basis:basis.toFixed(), basisSignature});
  }
  if (!position.eq(snapshot.position)) return unavailable();
  return rows.map(row => {
    if (row.type !== 'swap') return row;
    // Same-slot transactions have no reliable inter-stream ordering. Do not
    // invent a denominator, even if the swap and withdrawal share a transaction.
    const ambiguous = timeline.some(c => c.slot === row.slot);
    const preceding = timeline.filter(c => c.slot < row.slot).at(-1);
    const denominator = new BigNumber(preceding?.basis ?? 0);
    const amount = new BigNumber(row.amount);
    const valid = !ambiguous && Number.isSafeInteger(row.slot) && row.slot <= snapshot.slot && denominator.gt(0) && amount.isFinite() && amount.gt(0);
    return {...row, governanceBasis:valid?denominator.toFixed():null,
      basisSignature:valid?preceding.basisSignature:null,
      swapPercent:valid?amount.div(denominator).times(100).toFixed():null,
      thresholdExceeded:valid?amount.times(10).gte(denominator):null};
  });
}
