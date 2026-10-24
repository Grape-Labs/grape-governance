// SPL Governance ballot shape. Keep validation shared by the UI and transaction builder.
export function ballotRules(account: any) {
  const options = account?.options || [{ label: 'For' }];
  const kind = Number(account?.voteType?.type ?? 0);
  const choiceType = Number(account?.voteType?.choiceType ?? 0);
  const multiple = kind === 1;
  const supported = (kind === 0 || kind === 1) && (!multiple || choiceType === 0 || choiceType === 1);
  const min = multiple ? Math.max(1, Number(account.voteType.minVoterOptions || 1)) : 1;
  const max = multiple ? Math.min(options.length, Number(account.voteType.maxVoterOptions || options.length)) : 1;
  const canDeny = !account?.options || account.denyVoteWeight != null;
  return { options, multiple, weighted: multiple && choiceType === 1, min, max, canDeny,
    poll: !!account?.options && !canDeny,
    binary: kind === 0 && options.length === 1 && canDeny,
    supported: supported && options.length > 0 && min <= max };
}

export function validateBallot(account: any, weights: number[]): string | null {
  const rules = ballotRules(account);
  if (!rules.supported) return 'This ballot configuration is not supported.';
  if (weights.length !== rules.options.length) return 'The ballot must include every proposal option.';
  if (weights.some(value => !Number.isInteger(value) || value < 0 || value > 100)) return 'Use whole percentages between 0 and 100.';
  const selected = weights.filter(value => value > 0).length;
  if (selected < rules.min || selected > rules.max) return rules.min === rules.max
    ? `Select ${rules.min} option${rules.min === 1 ? '' : 's'}.`
    : `Select between ${rules.min} and ${rules.max} options.`;
  if (rules.weighted && weights.reduce((sum, value) => sum + value, 0) !== 100) return 'Allocated voting power must total 100%.';
  if (!rules.weighted && weights.some(value => value !== 0 && value !== 100)) return 'Each selected option must receive full voting power.';
  return null;
}

export function ballotChoices(account: any, selection?: { weights?: number[]; index?: number }) {
  const rules = ballotRules(account);
  const weights = selection?.weights || rules.options.map((_: any, index: number) => index === (selection?.index ?? 0) ? 100 : 0);
  const error = validateBallot(account, weights);
  if (error) throw new Error(error);
  return weights.map(weightPercentage => ({ rank: 0, weightPercentage }));
}

export function voteAvailability(account: any, config: any, type: number, now = Date.now() / 1000): string | null {
  if (Number(account?.state) !== 2) return 'Voting is closed.';
  const started = Number(account?.votingAt || account?.signingOffAt || 0);
  const duration = Number(account?.maxVotingTime ?? config?.baseVotingTime ?? config?.votingBaseTime ?? 0);
  const coolOff = Number(config?.votingCoolOffTime || 0);
  if (started && duration > 0) {
    if (now > started + duration + coolOff) return 'Voting has ended. The proposal can be finalized.';
    if (type === 0 && now > started + duration) return 'The proposal is in cool-off. Only Against and veto votes are allowed.';
  }
  return null;
}
