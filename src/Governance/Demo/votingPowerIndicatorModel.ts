const positive = (value: any) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
export function compactGovernancePower(input: any) {
  const format = (value: any, decimals = 0) => (positive(value) / Math.pow(10, decimals)).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const community = positive(input.communityPower) + (input.plugin ? 0 : positive(input.incomingCommunity));
  const council = positive(input.councilPower) + positive(input.incomingCouncil);
  const depositCommunity = positive(input.availableCommunity) > 0;
  const depositCouncil = positive(input.availableCouncil) > 0;
  const deposit = depositCommunity || depositCouncil;
  const labels = [];
  if (community > 0 || input.plugin) labels.push(input.pluginUnknown ? 'Community: plugin' : `Community ${format(community, input.decimals)}`);
  if (council > 0) labels.push(`Council ${format(council)}`);
  const label = labels.length ? labels.join(' · ') : '0 voting power';
  const eligibility = [depositCommunity ? 'community' : '', depositCouncil ? 'council' : ''].filter(Boolean).join(' and ');
  return {
    label, deposit,
    communityTotal: input.pluginUnknown ? 'Plugin managed' : format(community, input.decimals),
    councilTotal: format(council),
    detail: `${label}. ${deposit ? `Your wallet holds ${eligibility} tokens available to deposit. ` : ''}${input.communityDelegate || input.councilDelegate ? 'You have assigned a voting delegate; these deposits still count only once per proposal. ' : ''}${input.plugin ? 'Community voting weight is plugin-managed; review details. ' : ''}Open voting power to deposit, withdraw, or manage delegation.`,
  };
}
