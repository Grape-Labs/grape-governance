import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import ProposalPreviewBoundary from "./ProposalPreviewBoundary";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import DaoPageLayout from "./DaoPageLayout";
import ProposalShare from "./ProposalShare";
import { recordedVoteLabel, proposalListStatus, compareProposalPriority } from "./proposalListStatus";
import {
  getVoteRecordsByVoterIndexed,
  getRealmIndexed,
  getAllGovernancesIndexed,
  getAllProposalsIndexed,
} from "../api/queries";
import { GovernanceProposalV2View } from "../GovernanceProposalV2";
import "./governance-demo.css";

export const GRAPE_REALM = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
const states = [
  "Draft",
  "Signing off",
  "Voting",
  "Succeeded",
  "Executing",
  "Completed",
  "Cancelled",
  "Defeated",
  "Execution error",
  "Vetoed",
];
const address = (value: any) => value?.toBase58?.() || String(value || "");

export default function GovernanceDemo({
  landing = false,
}: {
  landing?: boolean;
}) {
  const route = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { publicKey } = useWallet();
  const walletAddress = address(publicKey);
  const [voteHistory, setVoteHistory] = React.useState<{
    wallet: string;
    voted: Map<string, any>;
    status: string;
  }>({ wallet: "", voted: new Map(), status: "loading" });
  const [proposals, setProposals] = React.useState<any[]>([]);
  const [realm, setRealm] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const [filter, setFilter] = React.useState("");
  const [expandedFor, setExpandedFor] = React.useState<string | null>(null);
  const requested = route.proposal || params.get("proposal");
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const liveRealm = await getRealmIndexed(GRAPE_REALM);
        if (!liveRealm) throw new Error("Grape DAO could not be loaded.");
        const owner = address(liveRealm.owner);
        const rules = await getAllGovernancesIndexed(GRAPE_REALM, owner);
        const rows = await getAllProposalsIndexed(
          rules.map((rule) => address(rule.pubkey)),
          owner,
          GRAPE_REALM
        );
        const sorted = [...rows].sort(compareProposalPriority);
        if (!cancelled) {
          setRealm(liveRealm);
          setProposals(sorted);
        }
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Unable to load proposals."
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [revision]);
  React.useEffect(() => {
    if (!walletAddress || !realm) return;
    let cancelled = false;
    let running = false;
    setVoteHistory({
      wallet: walletAddress,
      voted: new Map(),
      status: "loading",
    });
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const records = await getVoteRecordsByVoterIndexed(
          address(realm.owner),
          GRAPE_REALM,
          walletAddress
        );
        if (!Array.isArray(records))
          throw new Error("Vote history unavailable");
        const voted = new Map<string, any>(
          records
            .filter((record) => !record.account?.isRelinquished)
            .map((record) => [address(record.account?.proposal), record])
        );
        if (!cancelled)
          setVoteHistory({ wallet: walletAddress, voted, status: "ready" });
      } catch {
        if (!cancelled)
          setVoteHistory({
            wallet: walletAddress,
            voted: new Map(),
            status: "error",
          });
      } finally {
        running = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [walletAddress, realm, revision]);
  const voteLabel = (id: string) =>
    !walletAddress
      ? null
      : voteHistory.wallet !== walletAddress || voteHistory.status === "loading"
      ? "Checking vote…"
      : voteHistory.status === "error"
      ? "Vote unavailable"
      : voteHistory.voted.has(id)
      ? recordedVoteLabel(voteHistory.voted.get(id), proposals.find((item) => address(item.pubkey) === id)?.account)
      : "Not voted";
  const activeCount = proposals.filter(
    (item) => item.account.state === 2
  ).length;
  const noActiveVotes = !requested && activeCount === 0;
  const selected = requested
    ? proposals.find((item) => address(item.pubkey) === requested)
    : proposals[0];
  const selectedAddress = selected ? address(selected.pubkey) : "";
  const expanded = expandedFor === selectedAddress;
  const setExpanded = (value: boolean | ((previous: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(expanded) : value;
    setExpandedFor(next ? selectedAddress : null);
  };
  const visible = proposals.filter((item) =>
    String(item.account.name).toLowerCase().includes(filter.toLowerCase())
  );
  const select = (id: string) => {
    if (landing) navigate(`/proposal/${GRAPE_REALM}/${id}`);
    else setParams({ proposal: id });
    setExpanded(false);
  };

  return (
    <DaoPageLayout experimental={!landing}>
      <main>
        <div className="gd-intro">
          <span className="gd-eyebrow">GRAPE GOVERNANCE</span>
          <h1>
            Your DAO.
            <br />
            <span>A clearer decision.</span>
          </h1>
          <p>Real proposals. Real votes.</p>
        </div>
        {loading ? (
          <p role="status">Loading Grape DAO proposals…</p>
        ) : error ? (
          <div role="alert">
            <p>{error}</p>
            <button
              className="gd-secondary"
              onClick={() => setRevision((n) => n + 1)}
            >
              Retry loading
            </button>
          </div>
        ) : (
          <>
            <a className="gd-mobile-proposals" href="#gd-proposal-browser">
              Browse proposals · {activeCount} active{" "}
              <span aria-hidden="true">↓</span>
            </a>
            <div className="gd-workspace">
              <section
                aria-label="Selected proposal"
                className="gd-live-proposal"
              >
                {noActiveVotes ? (
                  <section
                    className="gd-main gd-empty-state"
                    aria-labelledby="gd-empty-title"
                  >
                    <span className="gd-empty-icon" aria-hidden="true">
                      ✓
                    </span>
                    <h2 id="gd-empty-title">No active votes</h2>
                    <p>
                      You’re all caught up. There’s nothing open for voting
                      right now.
                    </p>
                    {proposals.length > 0 ? (
                      <>
                        <h3>Recent decisions</h3>
                        <div className="gd-scenario-list gd-recent-decisions">
                          {proposals.slice(0, 3).map((item) => (
                            <button
                              key={address(item.pubkey)}
                              onClick={() => select(address(item.pubkey))}
                            >
                              <span>
                                <strong>{item.account.name}</strong>
                                <small>
                                  {states[item.account.state] || "Unknown"}
                                </small>
                              </span>
                              <span aria-hidden="true">↗</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="gd-footnote">
                        No proposals have been found for this DAO yet.
                      </p>
                    )}
                    <button
                      className="gd-secondary"
                      onClick={() => setRevision((n) => n + 1)}
                    >
                      Check for new proposals
                    </button>
                  </section>
                ) : !selected ? (
                  <div className="gd-main gd-content">
                    <h2>
                      {requested
                        ? "Proposal not found in Grape DAO"
                        : "No proposals found"}
                    </h2>
                    <p>Select a proposal from the list or refresh.</p>
                    <button
                      className="gd-secondary"
                      onClick={() => {
                        if (landing) navigate(`/dao/${GRAPE_REALM}`);
                        else setParams({});
                        setRevision((n) => n + 1);
                      }}
                    >
                      Refresh proposals
                    </button>
                  </div>
                ) : (
                  <ProposalPreviewBoundary
                    key={`${selectedAddress}:${revision}`}
                    originalUrl={`/proposal/${GRAPE_REALM}/${selectedAddress}?view=advanced`}
                    onRetry={() => setRevision((n) => n + 1)}
                  >
                    <GovernanceProposalV2View
                      key={`${selectedAddress}:${revision}`}
                      governanceAddress={GRAPE_REALM}
                      governanceProposal={selectedAddress}
                      item={selected}
                      showGovernanceTitle={false}
                      renderSimple={(view: any) => (
                        <>
                          <article className="gd-main">
                            <div className="gd-card-top">
                              <span className="gd-eyebrow">
                                GRAPE DAO PROPOSAL
                              </span>
                              <div className="gd-proposal-tools">
                                <span className="gd-pill">{view.stateLabel}</span>
                                <ProposalShare realm={GRAPE_REALM} proposal={selectedAddress} title={view.proposal.account.name} />
                              </div>
                            </div>
                            <div className="gd-content">
                              <h2>{view.proposal.account.name}</h2>
                              <p className="gd-description">
                                {view.proposal.account.state === 2
                                  ? "Review the proposal and choose whether to support it."
                                  : `This proposal is ${view.stateLabel.toLowerCase()}. Its recorded outcome is shown below.`}
                              </p>
                              {view.author && (
                                <details className="gd-author">
                                  <summary>
                                    <span>By <strong>{view.author.address.slice(0, 4)}…{view.author.address.slice(-4)}</strong></span>
                                    <span title="Current deposited voting power; excludes delegated power and plugin adjustments">
                                      {view.author.power == null ? "Power unavailable" : `${view.author.power} ${view.author.powerType.toLowerCase()} power`}
                                    </span>
                                    <span className={view.author.verification === "Verified" ? "gd-author-verified" : ""}>{view.author.verification}</span>
                                    <span>{view.author.reputation}</span>
                                  </summary>
                                  <div className="gd-author-details">
                                    <a href={`https://explorer.solana.com/address/${view.author.address}`} target="_blank" rel="noopener noreferrer">{view.author.address} ↗</a>
                                    {view.author.verificationProviders?.length > 0 && (
                                      <div className="gd-author-providers" aria-label="Verified with">
                                        <span>Verified with</span>
                                        {view.author.verificationProviders.map((provider: string) => (
                                          <a key={provider} href={`https://verification.governance.so/dao/${GRAPE_REALM}/wallet/${view.author.address}`}
                                            target="_blank" rel="noopener noreferrer">{provider} ↗</a>
                                        ))}
                                      </div>
                                    )}
                                    <span>Power reflects current deposits, excluding delegation and plugin adjustments.</span>
                                    <a href={`https://vine.governance.so/dao/${GRAPE_REALM}`} target="_blank" rel="noopener noreferrer">
                                      Vine / OG Reputation{view.author.season != null ? ` · Season ${view.author.season}${view.author.previousSeason ? " (previous)" : ""}` : ""} ↗
                                    </a>
                                  </div>
                                </details>
                              )}
                              {view.timeline?.length > 0 && (
                                <ol className="gd-proposal-timeline" aria-label="Proposal timeline">
                                  {view.timeline.map((entry: any) => (
                                    <li key={entry.key}>
                                      <span>{entry.label}</span>
                                      {entry.at ? (
                                        <time dateTime={new Date(entry.at * 1000).toISOString()}
                                          title={new Date(entry.at * 1000).toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" })}>
                                          {new Date(entry.at * 1000).toLocaleString(undefined, {
                                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                                            timeZoneName: "short",
                                          })}
                                        </time>
                                      ) : <span className="gd-timeline-pending">Pending</span>}
                                    </li>
                                  ))}
                                </ol>
                              )}
                              {view.warning && (
                                <div className="gd-live-warning" role="alert">
                                  {view.warning}
                                  <button
                                    className="gd-secondary"
                                    onClick={() => setExpanded(true)}
                                  >
                                    Review security and instructions
                                  </button>
                                </div>
                              )}
                              <div className="gd-live-description">
                                {view.description || (
                                  <p>
                                    {view.descriptionLoading
                                      ? "Loading proposal description…"
                                      : view.descriptionError ||
                                        "No inline description available."}
                                  </p>
                                )}
                                {view.descriptionUrl && (
                                  <a
                                    href={view.descriptionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Read original description ↗
                                  </a>
                                )}
                              </div>
                              {!view.isMultiChoiceProposal && (
                                <div className="gd-vote-overview">
                                  <section className="gd-vote-panel" aria-label="Approval progress">
                                    <h3>Approval</h3>

                                    <div className="gd-bar" role="progressbar" aria-label="Approval progress"
                                      aria-valuemin={0} aria-valuemax={100}
                                      aria-valuenow={view.approval ? Math.min(100, Math.max(0, view.approval.progress)) : undefined}
                                      aria-valuetext={view.approval ? `${view.forVotes} For; ${view.approval.target} target` : "Threshold unavailable"}>
                                      <span style={{ width: `${view.approval ? Math.min(100, Math.max(0, view.approval.progress)) : 0}%`,
                                        background: view.approval?.passing ? undefined : "#85caff" }} />
                                    </div>
                                    <div className="gd-vote-metrics">
                                      <span>{view.forVotes} For · {view.forPct.toFixed(1)}%</span>
                                      <span>{view.againstVotes} Against</span>
                                      <span>{view.approval ? `${view.approval.target} target` : "Threshold unavailable"}</span>
                                    </div>
                                    {view.approval && view.proposal.account.state === 2 && (
                                      <p className={view.approval.passing ? "gd-passing" : ""}
                                        title={view.approval.passing
                                          ? `${view.approval.surplus} above the approval target. For leads Against.`
                                          : `${view.approval.remaining} more For votes needed to reach the target and lead Against.`}>
                                        {view.approval.passing
                                          ? `Passing · +${view.approval.surplusCompact ?? view.approval.surplus} above target`
                                          : `${view.approval.remainingCompact ?? view.approval.remaining} more For needed`}
                                      </p>
                                    )}
                                  </section>
                                  <section className="gd-vote-panel" aria-label="Voter sentiment">
                                    <h3>Voter sentiment</h3>
                                    {view.sentiment ? <>
                                      <strong className="gd-voter-count" title="One count per token-owner wallet">{view.sentiment.total} wallets</strong>
                                      <div className="gd-vote-metrics">
                                        <span>{view.sentiment.for} For</span>
                                        <span>{view.sentiment.against} Against</span>
                                        {view.sentiment.other > 0 && <span>{view.sentiment.other} Other</span>}
                                      </div>
                                    </> : <p>Voter counts unavailable</p>}
                                  </section>
                                </div>
                              )}
                              <section
                                className="gd-live-power"
                                aria-label="Your participation"
                              >
                                <span className="gd-eyebrow">
                                  YOUR PARTICIPATION
                                </span>
                                <p role="status">
                                  {!view.connected
                                    ? "Connect your wallet to check your vote."
                                    : view.hasVoted
                                    ? `Vote recorded${
                                        view.hasVotedSide
                                          ? ` · ${view.hasVotedSide}`
                                          : ""
                                      }`
                                    : "You have not voted on this proposal."}
                                </p>
                                {view.power}
                              </section>
                              <section className="gd-execution-summary">
                                <h3>
                                  {view.instructionCount == null
                                    ? "Checking executable instructions…"
                                    : view.instructionCount > 0
                                    ? `${
                                        view.instructionCount
                                      } executable transaction${
                                        view.instructionCount === 1 ? "" : "s"
                                      }`
                                    : "No executable transactions attached"}
                                </h3>
                                <p>
                                  {view.instructionCount > 0
                                    ? "Approval authorizes these actions. Review amounts, recipients, and permission changes."
                                    : "The proposal description is not a substitute for checking its on-chain instructions."}
                                </p>
                                <div className="gd-asset-summary">
                                  {(view.assetSummary || []).map(
                                    (asset: any) => (
                                      <span key={asset.mint}>
                                        <strong>
                                          {Number(
                                            asset.amount
                                          ).toLocaleString()}{" "}
                                          {asset.name}
                                        </strong>
                                        <span>
                                          {" "}
                                          · {asset.recipients} recipient
                                          {asset.recipients === 1 ? "" : "s"}
                                        </span>
                                      </span>
                                    )
                                  )}
                                </div>
                                <button
                                  className="gd-secondary"
                                  onClick={() => setExpanded(true)}
                                >
                                  Review instructions & recipient checks
                                </button>
                              </section>
                              {view.actions && (
                                <>
                                  <div className="gd-live-actions">
                                    {view.actions}
                                  </div>
                                  <p className="gd-footnote">
                                    These are real voting actions. Review the
                                    wallet transaction before signing.
                                  </p>
                                </>
                              )}
                              {view.isMultiChoiceProposal && (
                                <p className="gd-note">
                                  This proposal has multiple options. Use the
                                  original page to review and vote on each
                                  option.
                                </p>
                              )}
                              <div className="gd-actions">
                                <button
                                  className="gd-secondary"
                                  aria-expanded={expanded}
                                  aria-controls="gd-full-details"
                                  onClick={() => setExpanded((value) => !value)}
                                >
                                  {expanded
                                    ? "Hide execution plan"
                                    : "Review execution plan & risks"}
                                </button>
                                <a
                                  href={`/proposal/${GRAPE_REALM}/${selectedAddress}?view=advanced`}
                                >
                                  Advanced proposal ↗
                                </a>
                              </div>
                            </div>
                          </article>
                          {expanded && (
                            <section
                              id="gd-full-details"
                              className="gd-full-details"
                              aria-label="Full proposal review"
                            >
                              {view.details}
                            </section>
                          )}
                        </>
                      )}
                    />
                  </ProposalPreviewBoundary>
                )}
              </section>
              <aside
                id="gd-proposal-browser"
                tabIndex={-1}
                className="gd-sidebar"
              >
                <section className="gd-scenarios">
                  <span className="gd-eyebrow">GRAPE DAO</span>
                  <h3>
                    {activeCount ? "Proposals" : "Proposal history"}{" "}
                    <span className="gd-active-count">
                      {
                        proposals.filter((item) => item.account.state === 2)
                          .length
                      }{" "}
                      voting
                    </span>
                  </h3>
                  <label className="gd-search">
                    Search proposals
                    <input
                      value={filter}
                      onChange={(event) => setFilter(event.target.value)}
                      type="search"
                      placeholder="Search by title"
                    />
                  </label>
                  <div className="gd-scenario-list gd-proposal-list">
                    {visible.map((item) => {
                      const tally = proposalListStatus(item.account);
                      return (
                      <button
                        key={address(item.pubkey)}
                        aria-pressed={selectedAddress === address(item.pubkey)}
                        className={`${
                          selectedAddress === address(item.pubkey)
                            ? "is-selected"
                            : ""
                        } ${
                          item.account.state === 2 ? "is-voting" : "is-past"
                        }`}
                        onClick={() => select(address(item.pubkey))}
                      >
                        <span>
                          <strong>{item.account.name}</strong>
                          <small>
                            <span className="gd-list-state">
                              {item.account.state === 2
                                ? "● Voting"
                                : states[item.account.state] || "Unknown"}
                            </span>
                            {voteLabel(address(item.pubkey)) && (
                              <span className="gd-vote-label">
                                {voteLabel(address(item.pubkey))}
                              </span>
                            )}
                          </small>
                          {tally && <small className="gd-list-tally" title={tally.detail}>{tally.label}</small>}
                        </span>
                      </button>
                    );})}
                    {!visible.length && <p>No matching proposals.</p>}
                  </div>
                  <button
                    className="gd-secondary"
                    onClick={() => setRevision((n) => n + 1)}
                  >
                    Refresh proposals
                  </button>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
      <footer className="gd-footer">
        <span>
          {landing
            ? "Grape DAO governance"
            : "Experimental presentation · Existing governance transactions"}
        </span>
      </footer>
    </DaoPageLayout>
  );
}
