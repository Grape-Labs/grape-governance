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
