// Use only loaded account data: no per-card network requests.
export function recordedVoteLabel(record: any, proposal?: any): string {
  const account = record?.account || {};
  const vote = account.vote;
  const kind = vote?.voteType;
  if (kind != null) {
    if (Number(kind) === 1) return "Voted Against";
    if (Number(kind) === 2) return "Abstained";
    if (Number(kind) === 3) return "Voted Veto";
    if (Number(kind) === 0) {
      const options = proposal?.options;
      if (!options || (options.length === 1 && proposal?.denyVoteWeight != null)) return "Voted For";
      const selected = (vote.approveChoices || [])
        .map((choice: any, index: number) => Number(choice.weightPercentage) > 0 ? options[index]?.label : null)
        .filter(Boolean);
      return selected.length ? `Voted: ${selected.join(", ")}` : "Voted";
    }
  }
  if (Number(account.voteWeight?.yes) > 0) return "Voted For";
  if (Number(account.voteWeight?.no) > 0) return "Voted Against";
  return "Voted";
}

function weight(value: any): bigint | null {
  if (value == null) return null;
  // Do not silently calculate margins from already-rounded indexed numbers.
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  try {
    const text = value.toString();
    return /^\d+$/.test(text) ? BigInt(text) : null;
  } catch { return null; }
}

const percentage = (part: bigint, total: bigint) =>
  Number(part * 10000n / total) / 100;

export function proposalListStatus(account: any): { label: string; detail: string } | null {
  if (account?.state !== 2) return null;
  if (account.options && (account.options.length !== 1 || account.denyVoteWeight == null || Number(account.voteType?.type || 0) !== 0)) return null;
  const yes = weight(account.options?.[0]?.voteWeight ?? account.yesVotesCount);
  const no = weight(account.denyVoteWeight ?? account.noVotesCount);
  if (yes == null || no == null) return null;
  const total = yes + no;
  if (total === 0n) return { label: "No votes yet", detail: "No For or Against votes recorded." };
  const share = percentage(yes, total).toFixed(1);
  const threshold = account.voteThreshold;
  const max = weight(account.maxVoteWeight);
  // Only the standard yes-percentage rule is handled here; plugin/quorum
  // rules with unavailable data must never be described as passing.
  if (threshold?.type === 0 && Number.isInteger(threshold.value) &&
      threshold.value > 0 && threshold.value <= 100 && max != null && max > 0n) {
    const required = (max * BigInt(threshold.value) + 99n) / 100n;
    const passing = yes >= required && yes > no;
    const delta = percentage(yes >= required ? yes - required : required - yes, max).toFixed(1);
    return {
      label: `${passing ? "Passing" : "Not passing"} · ${share}% For`,
      detail: `${delta} percentage points ${yes >= required ? "above" : "below"} the approval threshold. For must also exceed Against. Current tally, not a final result.`,
    };
  }
  const margin = percentage(yes > no ? yes - no : no - yes, total).toFixed(1);
  return {
    label: `${yes === no ? "Tied" : yes > no ? "For leads" : "Against leads"} · ${share}% For`,
    detail: `${margin} percentage-point lead among votes cast. Approval threshold unavailable; this is not a passing prediction.`,
  };
}

// Count token-owner wallets, not vote weight or transaction signatures.
export function distinctVoterSentiment(records: any[]) {
  const wallets = new Map<string, Set<string>>();
  for (const record of records || []) {
    if (record.account?.isRelinquished || record.isRelinquished) continue;
    const owner = record.account?.governingTokenOwner ?? record.governingTokenOwner;
    const key = typeof owner === "string" ? owner : owner?.toBase58?.();
    if (!key) continue;
    const vote = record.account?.vote ?? record.vote?.vote;
    const kind = vote?.voteType;
    const yes = record.account?.voteWeight?.yes ?? record.vote?.legacyYes;
    const no = record.account?.voteWeight?.no ?? record.vote?.legacyNo;
    const side = kind != null
      ? (["for", "against", "abstain", "veto"][Number(kind)] || "other")
      : Number(yes) > 0 ? "for" : Number(no) > 0 ? "against" : "other";
    if (!wallets.has(key)) wallets.set(key, new Set());
    wallets.get(key)!.add(side);
  }
  const counts = { total: wallets.size, for: 0, against: 0, other: 0 };
  for (const sides of wallets.values()) {
    if (sides.size === 1 && sides.has("for")) counts.for++;
    else if (sides.size === 1 && sides.has("against")) counts.against++;
    else counts.other++;
  }
  return counts;
}

// Active votes always lead; an old draft can become the newest active vote.
export function compareProposalPriority(a: any, b: any): number {
  const aVoting = Number(a.account.state) === 2;
  const bVoting = Number(b.account.state) === 2;
  if (aVoting !== bVoting) return aVoting ? -1 : 1;
  const timestamp = (item: any, voting: boolean) => {
    const started = Number(item.account.votingAt);
    if (Number.isFinite(started) && started > 0) return started;
    // An unknown voting start must not masquerade as a newly opened vote.
    if (voting) return 0;
    return Number(item.account.draftAt) || 0;
  };
  return timestamp(b, bVoting) - timestamp(a, aVoting) ||
    (Number(b.account.draftAt) || 0) - (Number(a.account.draftAt) || 0);
}

export function proposalOutcome(account: any): { label: string; detail: string; tone: string } {
  const state = Number(account?.state);
  const poll = Array.isArray(account?.options) && account.denyVoteWeight == null;
  if ([3, 4, 5, 8].includes(state)) {
    if (poll) return { label: 'Poll closed', detail: 'View results', tone: 'neutral' };
    return { label: 'Passed', detail: ({ 3: 'Awaiting execution', 4: 'Executing', 5: 'Completed', 8: 'Execution error' })[state], tone: 'passed' };
  }
  if (state === 7) return { label: 'Defeated', detail: 'Did not pass', tone: 'failed' };
  if (state === 9) return { label: 'Vetoed', detail: 'Blocked by veto', tone: 'failed' };
  if (state === 6) return { label: 'Cancelled', detail: 'Withdrawn before completion', tone: 'neutral' };
  return { label: ({ 0: 'Draft', 1: 'Signing off', 2: 'Voting' })[state] || 'Unknown', detail: 'No final outcome', tone: 'neutral' };
}

// Summarize finalized ballots only; support is a share of votes cast, not quorum.
export function recentDecisionResult(account: any): string | null {
  if (![3, 4, 5, 7, 8].includes(Number(account?.state))) return null;
  const options = account.options;
  const binary = (!options || options.length === 1) &&
    (account.denyVoteWeight != null || account.noVotesCount != null) &&
    Number(account.voteType?.type || 0) === 0;
  if (binary) {
    const yes = weight(options?.[0]?.voteWeight ?? account.yesVotesCount);
    const no = weight(account.denyVoteWeight ?? account.noVotesCount);
    if (yes == null || no == null || yes + no === 0n) return null;
    return `${percentage(yes, yes + no).toFixed(1)}% For`;
  }
  // Use the recorded result instead of guessing a winner from vote totals.
  const winners = (options || []).filter((option: any) => Number(option.voteResult) === 1 && option.label);
  if (!winners.length) return null;
  return `${winners.length === 1 ? "Selected" : "Selected options"}: ${winners.map((option: any) => option.label).join(", ")}`;
}
