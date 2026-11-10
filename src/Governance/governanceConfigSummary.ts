import BN from 'bn.js';

// SPL Governance Borsh layouts: v1/v2 share the prefix; v3 adds five fields.
export function decodeGovernanceConfig(data: Uint8Array) {
  if (data[0] !== 19) return null;
  try {
    const buffer = Buffer.from(data);
    let offset = 1;
    const u8 = () => buffer.readUInt8(offset++);
    const u32 = () => { const value = buffer.readUInt32LE(offset); offset += 4; return value; };
    const u64 = () => {
      if (offset + 8 > buffer.length) throw new Error('Truncated integer');
      const value = new BN(buffer.subarray(offset, offset + 8), 'le'); offset += 8; return value;
    };
    const threshold = () => {
      const type = u8();
      if (type > 2) throw new Error('Unknown threshold');
      return { type, value: type === 2 ? undefined : u8() };
    };
    const tipping = () => { const value = u8(); if (value > 2) throw new Error('Unknown tipping'); return value; };
    const config: any = {
      communityVoteThreshold: threshold(), minCommunityTokensToCreateProposal: u64(),
      minInstructionHoldUpTime: u32(), baseVotingTime: u32(), communityVoteTipping: tipping(),
      councilVoteThreshold: threshold(), councilVetoVoteThreshold: threshold(), minCouncilTokensToCreateProposal: u64(),
    };
    if (offset < buffer.length) Object.assign(config, {
      councilVoteTipping: tipping(), communityVetoVoteThreshold: threshold(),
      votingCoolOffTime: u32(), depositExemptProposalCount: u8(),
    });
    return offset === buffer.length ? config : null;
  } catch { return null; }
}

export function governanceConfigRows(config: any): [string, string][] {
  const threshold = (value: any) => value?.type === 2 ? 'Disabled' : value?.value != null
    ? `${value.value}%${value.type === 1 ? ' quorum' : ''}` : 'Unavailable';
  const duration = (seconds: number) => {
    if (seconds === 0) return '0 seconds';
    return [[86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']]
      .map(([unit, label]) => {
        const count = Math.floor(seconds / Number(unit));
        seconds %= Number(unit);
        return count ? `${count} ${label}${count === 1 ? '' : 's'}` : '';
      }).filter(Boolean).join(' ');
  };
  const tipping = (value: number) => ['Strict', 'Early', 'Disabled'][value] || 'Unavailable';
  const rows: [string, string][] = [
    ['Community vote threshold', threshold(config.communityVoteThreshold)],
    ['Minimum community tokens to create a proposal (base units)', config.minCommunityTokensToCreateProposal.toString()],
    ['Transaction hold-up time', duration(config.minInstructionHoldUpTime)],
    ['Voting period', duration(config.baseVotingTime)],
    ['Community vote tipping', tipping(config.communityVoteTipping)],
    ['Council vote threshold', threshold(config.councilVoteThreshold)],
    ['Council veto threshold', threshold(config.councilVetoVoteThreshold)],
    ['Minimum council tokens to create a proposal (base units)', config.minCouncilTokensToCreateProposal.toString()],
  ];
  if (config.votingCoolOffTime != null) rows.push(
    ['Council vote tipping', tipping(config.councilVoteTipping)],
    ['Community veto threshold', threshold(config.communityVetoVoteThreshold)],
    ['Voting cool-off time', duration(config.votingCoolOffTime)],
    ['Deposit-exempt proposal count', String(config.depositExemptProposalCount)],
  );
  return rows;
}
