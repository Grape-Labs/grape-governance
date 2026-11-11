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

export function formatConfigTokenAmount(value: BN, decimals?: number): string {
  const raw = value.toString();
  if (decimals == null) return raw;
  if (raw === '18446744073709551615') return 'Disabled';
  const digits = raw.padStart(decimals + 1, '0');
  const whole = decimals ? digits.slice(0, -decimals) : digits;
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, '') : '';
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}

export function governanceConfigRows(config: any, decimals: { community?: number; council?: number } = {}): [string, string][] {
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
    [`Minimum community tokens to create a proposal${decimals.community == null ? ' (base units)' : ''}`, formatConfigTokenAmount(config.minCommunityTokensToCreateProposal, decimals.community)],
    ['Transaction hold-up time', duration(config.minInstructionHoldUpTime)],
    ['Voting period', duration(config.baseVotingTime)],
    ['Community vote tipping', tipping(config.communityVoteTipping)],
    ['Council vote threshold', threshold(config.councilVoteThreshold)],
    ['Council veto threshold', threshold(config.councilVetoVoteThreshold)],
    [`Minimum council tokens to create a proposal${decimals.council == null ? ' (base units)' : ''}`, formatConfigTokenAmount(config.minCouncilTokensToCreateProposal, decimals.council)],
  ];
  if (config.votingCoolOffTime != null) rows.push(
    ['Council vote tipping', tipping(config.councilVoteTipping)],
    ['Community veto threshold', threshold(config.communityVetoVoteThreshold)],
    ['Voting cool-off time', duration(config.votingCoolOffTime)],
    ['Deposit-exempt proposal count', String(config.depositExemptProposalCount)],
  );
  return rows;
}

// Realm config has distinct v1/v2/v3 suffixes (0, 2, and 6 bytes).
export function decodeRealmConfig(data: Uint8Array) {
  if (data[0] !== 22 || ![19, 21, 25].includes(data.length)) return null;
  try {
    const buffer = Buffer.from(data);
    let offset = 1;
    const bool = () => { const n = buffer.readUInt8(offset++); if (n > 1) throw new Error('Invalid boolean'); return !!n; };
    const u64 = () => { const n = new BN(buffer.subarray(offset, offset + 8), 'le'); offset += 8; return n; };
    const useCouncilMint = bool();
    const minCommunityTokensToCreateGovernance = u64();
    const type = buffer.readUInt8(offset++);
    if (type > 1) return null;
    const value = u64();
    const tokenConfig = () => {
      const useVoterWeightAddin = bool();
      const useMaxVoterWeightAddin = bool();
      const tokenType = buffer.readUInt8(offset++);
      if (tokenType > 2) throw new Error('Invalid token type');
      return { useVoterWeightAddin, useMaxVoterWeightAddin, tokenType };
    };
    const config: any = { kind: 'realm', version: data.length === 19 ? 1 : data.length === 21 ? 2 : 3, useCouncilMint, minCommunityTokensToCreateGovernance, communityMintMaxVoteWeightSource: { type, value } };
    if (config.version === 2) config.communityTokenConfigArgs = { useVoterWeightAddin: bool(), useMaxVoterWeightAddin: bool() };
    if (config.version === 3) {
      config.communityTokenConfigArgs = tokenConfig();
      config.councilTokenConfigArgs = tokenConfig();
    }
    return config;
  } catch { return null; }
}

export function decodeConfigInstruction(data: Uint8Array) {
  return decodeGovernanceConfig(data) || decodeRealmConfig(data);
}

export function realmConfigRows(config: any, decimals: { community?: number } = {}, accounts: string[] = []): [string, string][] {
  const source = config.communityMintMaxVoteWeightSource;
  const rows: [string, string][] = [
    [`Minimum community tokens to create governance${decimals.community == null ? ' (base units)' : ''}`, formatConfigTokenAmount(config.minCommunityTokensToCreateGovernance, decimals.community)],
    ['Community maximum vote weight', source.type === 0 ? `${formatConfigTokenAmount(source.value, 8)}% of supply` : `${formatConfigTokenAmount(source.value)} (absolute weight)`],
    ['Council mint', config.useCouncilMint ? accounts[2] || 'Unavailable' : 'Disabled'],
  ];
  let accountIndex = (config.useCouncilMint ? 4 : 2) + 2; // system program and realm config
  for (const [label, token] of [['Community', config.communityTokenConfigArgs], ['Council', config.councilTokenConfigArgs]] as const) {
    if (!token) continue;
    if (token.tokenType != null) rows.push([`${label} token type`, ['Liquid', 'Membership', 'Dormant'][token.tokenType]]);
    for (const [field, title] of [['useVoterWeightAddin', 'voter weight add-in'], ['useMaxVoterWeightAddin', 'max voter weight add-in']]) {
      rows.push([`${label} ${title}`, token[field] ? accounts[accountIndex++] || 'Unavailable' : 'Disabled']);
    }
  }
  return rows;
}
