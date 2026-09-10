import BigNumber from 'bignumber.js';

function addressText(value) {
  return typeof value === 'string' ? value : value?.toBase58?.() || '';
}

export function formatVoteWeight(vote) {
  const value = vote.voteWeight;
  if (value === null || value === undefined) return '0';
  // SDK vote weights are BN instances. Never render the object or coerce it
  // through Number, which loses precision for large governance token weights.
  const weight = new BigNumber(value.toString());
  if (!weight.isFinite()) return '—';
  const mint = addressText(vote.proposalMint);
  const communityMint = addressText(vote.communityMint);
  const decimals = Number(vote.communityDecimals ?? 0);
  const isCommunity = mint && mint === communityMint;
  return (isCommunity && Number.isInteger(decimals) && decimals >= 0 && decimals <= 255
    ? weight.shiftedBy(-decimals)
    : weight).toFormat();
}

export function voteProposalTitle(vote) {
  return vote.proposalTitle || addressText(vote.proposalId) || addressText(vote.pubkey) || 'Unknown proposal';
}
