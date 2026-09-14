import BigNumber from 'bignumber.js';

// Compare only observed vote records. This does not infer a historical wallet
// balance or attribute a position decrease to specific swaps.
export function votingPowerDrop(votes, current, referenceRecord) {
  const usable = votes.filter(v => v.weight != null && new BigNumber(v.weight).isFinite() && new BigNumber(v.weight).gt(0));
  const reference = referenceRecord ? usable.find(v => v.record === referenceRecord) :
    usable.reduce((peak,v) => !peak || new BigNumber(v.weight).gt(peak.weight) ? v : peak, null);
  const now = current == null ? null : new BigNumber(current);
  if (!reference || !now?.isFinite() || now.isNegative()) return null;
  const difference = new BigNumber(reference.weight).minus(now);
  return {reference, current:now.toFixed(), difference:difference.toFixed(),
    percent:difference.div(reference.weight).times(100).toFixed()};
}

// Display a transfer-out / transfer-back pair as its net movement in that
// transaction. Keep gross amounts available in details, not as apparent losses.
export function netTransferEvents(events) {
  const transfers = new Map();
  const result = [];
  for (const event of events) {
    if (!['transfer','incoming'].includes(event.type)) {result.push(event);continue;}
    const group = transfers.get(event.signature) || {...event, incoming:new BigNumber(0),outgoing:new BigNumber(0)};
    group[event.type === 'incoming' ? 'incoming' : 'outgoing'] = group[event.type === 'incoming' ? 'incoming' : 'outgoing'].plus(event.amount);
    transfers.set(event.signature,group);
  }
  for (const group of transfers.values()) {
    const net = group.incoming.minus(group.outgoing);
    result.push({...group,type:net.gt(0)?'incoming':net.lt(0)?'transfer':'roundtrip',
      amount:net.abs().toFixed(),grossIncoming:group.incoming.toFixed(),grossOutgoing:group.outgoing.toFixed()});
  }
  return result.sort((a,b)=>b.timestamp-a.timestamp);
}

// Only use a reconciled timeline. Compare completed transactions, excluding
// temporary positions between instructions in a withdraw/redeposit transaction.
export function governancePositionDrop(history, current) {
  if (!history) return null;
  const completed = new Map();
  for (const change of history) completed.set(change.signature, change);
  const references = [...completed.values()].map(change => ({
    ...change, record:change.id, weight:change.position, source:'governance',
  }));
  return votingPowerDrop(references,current);
}

// Daily closing positions avoid counting a temporary full withdrawal followed
// by redeposit on the same UTC day as a 100% lasting reduction. Cumulative
// decreases can exceed the net loss because subsequent deposits restore power.
export function governanceReductionHistory(history, current) {
  const peak = governancePositionDrop(history,current);
  if (!peak) return null;
  const start = history.findIndex(c=>c.id===peak.reference.record);
  const daily = new Map();
  for (const change of history.slice(start)) {
    if (!Number.isFinite(change.timestamp) || change.timestamp <= 0) return null;
    daily.set(new Date(change.timestamp*1000).toISOString().slice(0,10),change);
  }
  let previous = new BigNumber(peak.reference.weight);
  let low = previous;
  let cumulative = new BigNumber(0);
  const reductions=[];
  for (const [date,change] of daily) {
    const position=new BigNumber(change.position);
    const decrease=previous.minus(position);
    if(decrease.gt(0)) {
      cumulative=cumulative.plus(decrease);
      reductions.push({date,signature:change.signature,before:previous.toFixed(),after:position.toFixed(),amount:decrease.toFixed()});
    }
    low=BigNumber.minimum(low,position);
    previous=position;
  }
  const basis=new BigNumber(peak.reference.weight);
  return {reductions,cumulative:cumulative.toFixed(),cumulativePercent:cumulative.div(basis).times(100).toFixed(),
    lowest:low.toFixed(),drawdown:basis.minus(low).toFixed(),drawdownPercent:basis.minus(low).div(basis).times(100).toFixed()};
}
