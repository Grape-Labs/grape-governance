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
      if (!options || options.length === 1) return "Voted For";
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
  if (account.options && account.options.length !== 1) return null;
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
