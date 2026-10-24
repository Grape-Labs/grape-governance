import React from "react";
import { Dialog, useMediaQuery } from "@mui/material";
import { useWallet } from "@solana/wallet-adapter-react";
import ProposalPreviewBoundary from "./ProposalPreviewBoundary";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import DaoPageLayout from "./DaoPageLayout";
import ProposalShare from "./ProposalShare";
import ProposalSettings from "./ProposalSettings";
import VoterBreakdown from "./VoterBreakdown";
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

function ProposalTimeline({ entries, state }: { entries: any[]; state: number }) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    const update = () => setNow(Date.now() / 1000);
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);
  const active = state === 2;
  const current = now == null ? -1 : entries.reduce((last, entry, index) =>
    entry.at && entry.at <= now ? index : last, -1);
  return <ol className="gd-proposal-timeline" aria-label="Proposal timeline">
    {entries.map((entry, index) => {
      const next = entries[index + 1];
      const reached = now != null && entry.at && entry.at <= now;
      const progress = reached && next?.at > entry.at
        ? Math.max(0, Math.min(1, (now! - entry.at) / (next.at - entry.at))) : 0;
      const isCurrent = current === index && active;
      return <li key={entry.key} className={isCurrent ? "is-current" : reached ? "is-reached" : ""}
        aria-current={isCurrent ? "step" : undefined}>
        <div className="gd-timeline-track" aria-hidden="true">
          <i /><span style={{ width: `${progress * 100}%` }} />
        </div>
        <span>{entry.label}{isCurrent ? " · Now" : ""}</span>
        {entry.at ? <time dateTime={new Date(entry.at * 1000).toISOString()}
          title={new Date(entry.at * 1000).toLocaleString(undefined, { dateStyle: "full", timeStyle: "long" })}>
          {new Date(entry.at * 1000).toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
          })}
        </time> : <span className="gd-timeline-pending">Pending</span>}
      </li>;
    })}
  </ol>;
}

function ProposalFrame({ mobile, open, onClose, children }: {
  mobile: boolean; open: boolean; onClose: () => void; children: React.ReactNode;
}) {
  if (!mobile) return <>{children}</>;
  return <Dialog open={open} onClose={onClose} fullScreen
    PaperProps={{ className: "governance-demo gd-live gd-mobile-proposal-dialog", "aria-label": "Selected proposal" }}>
    <div className="gd-mobile-proposal-toolbar">
      <button type="button" className="gd-secondary" onClick={onClose}>← Back to proposals</button>
      <a href="#gd-proposal-vote">Voting ↓</a>
    </div>
    {children}
  </Dialog>;
}

export default function GovernanceDemo({
  landing = false,
  governanceAddress,
}: {
  landing?: boolean;
  governanceAddress?: string;
}) {
  const mobile = useMediaQuery("(max-width:950px)");
  const route = useParams();
  const realmAddress = governanceAddress || route.governance || route.handlekey || GRAPE_REALM;
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
        const liveRealm = await getRealmIndexed(realmAddress);
        if (!liveRealm) throw new Error("DAO could not be loaded.");
        const owner = address(liveRealm.owner);
        const rules = await getAllGovernancesIndexed(realmAddress, owner);
        const rows = await getAllProposalsIndexed(
          rules.map((rule) => address(rule.pubkey)),
          owner,
          realmAddress
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
  }, [revision, realmAddress]);
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
          realmAddress,
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
  }, [walletAddress, realm, revision, realmAddress]);
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
  const daoName = realm?.account?.name || "DAO";
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
    if (landing) navigate(`/proposal/${realmAddress}/${id}`);
    else setParams({ proposal: id });
    setExpanded(false);
  };

  const closeProposal = () => {
    if (landing || route.proposal) navigate(`/dao/${realmAddress}`);
    else setParams({});
    setExpandedFor(null);
  };

  return (
    <DaoPageLayout experimental={!landing} governanceAddress={realmAddress}>
      <main>
        <div className="gd-intro">
          <span className="gd-eyebrow">{daoName} GOVERNANCE</span>
          <h1>
            Your DAO.
            <br />
            <span>A clearer decision.</span>
          </h1>
          <p>Real proposals. Real votes.</p>
        </div>
        {loading ? (
          <p role="status">Loading DAO proposals…</p>
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
            <div className="gd-workspace">
              <ProposalFrame key={mobile ? requested || "list" : "desktop"} mobile={mobile} open={!!requested} onClose={closeProposal}>
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
                        ? "Proposal not found in this DAO"
                        : "No proposals found"}
                    </h2>
                    <p>Select a proposal from the list or refresh.</p>
                    <button
                      className="gd-secondary"
                      onClick={() => {
                        if (landing) navigate(`/dao/${realmAddress}`);
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
                    originalUrl={`/proposal/${realmAddress}/${selectedAddress}?view=advanced`}
                    onRetry={() => setRevision((n) => n + 1)}
                  >
                    <GovernanceProposalV2View
                      key={`${selectedAddress}:${revision}`}
                      governanceAddress={realmAddress}
                      governanceProposal={selectedAddress}
                      item={selected}
                      showGovernanceTitle={false}
                      renderSimple={(view: any) => (
                        <>
                          <article className="gd-main">
                            <div className="gd-card-top">
                              <span className="gd-eyebrow">
                                {daoName} PROPOSAL
                              </span>
                              <div className="gd-proposal-tools">
                                <span className="gd-pill">{view.stateLabel}</span>
                                {view.electorate && <span className="gd-pill">{view.electorate}{view.isPoll ? " poll" : " vote"}</span>}
                                <ProposalShare realm={realmAddress} proposal={selectedAddress} title={view.proposal.account.name} />
                              </div>
                            </div>
                            <div className="gd-content">
                              <h2>{view.proposal.account.name}</h2>
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
                                          <a key={provider} href={`https://verification.governance.so/dao/${realmAddress}/wallet/${view.author.address}`}
                                            target="_blank" rel="noopener noreferrer">{provider} ↗</a>
                                        ))}
                                      </div>
                                    )}
                                    <span>Power reflects current deposits, excluding delegation and plugin adjustments.</span>
                                    <a href={`https://vine.governance.so/dao/${realmAddress}`} target="_blank" rel="noopener noreferrer">
                                      Vine / OG Reputation{view.author.season != null ? ` · Season ${view.author.season}${view.author.previousSeason ? " (previous)" : ""}` : ""} ↗
                                    </a>
                                  </div>
                                </details>
                              )}
                              {view.timeline?.length > 0 && (
                                <ProposalTimeline entries={view.timeline} state={view.proposal.account.state} />
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
                                    <VoterBreakdown records={view.voterRecords ?? null} proposal={view.proposal} count={view.sentiment?.total} />
                                    {view.sentiment ? <>
                                      <div className="gd-vote-metrics">
                                        <span>{view.sentiment.for} For</span>
                                        <span>{view.sentiment.against} Against</span>
                                        {view.sentiment.other > 0 && <span>{view.sentiment.other} Other</span>}
                                      </div>
                                    </> : <p>Voter counts unavailable</p>}
                                  </section>
                                </div>
                              )}
                              {view.isMultiChoiceProposal && <VoterBreakdown records={view.voterRecords ?? null} proposal={view.proposal} count={view.sentiment?.total} />}
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
                                    ? view.recordedChoice || `Vote recorded${
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
                              <section id="gd-proposal-vote" className="gd-voting-section" aria-label="Proposal voting">
                              {view.actions ? (
                                <>
                                  <div className={view.isMultiChoiceProposal ? "gd-ballot-container" : "gd-live-actions"}>
                                    {view.actions}
                                  </div>
                                  <p className="gd-footnote">
                                    These are real voting actions. Review the
                                    wallet transaction before signing.
                                  </p>
                                </>
                              ) : (
                              <div className="gd-vote-unavailable" role="status">
                                <strong>{view.warning ? "Review required before voting" : view.isMultiChoiceProposal ? "Choose your voting option" : view.proposal.account.state !== 2 ? "Voting is closed" : "Voting controls unavailable"}</strong>
                                <p>{view.warning ? "Review the security findings and proposal instructions before continuing to the advanced voting view." : view.isMultiChoiceProposal ? "This proposal uses multiple voting options. Open the advanced view to review and vote." : view.proposal.account.state !== 2 ? `Proposal status: ${view.stateLabel}.` : "Open the advanced view to check voting availability for this proposal."}</p>
                                {view.proposal.account.state === 2 && <a className="gd-secondary" href={`/proposal/${realmAddress}/${selectedAddress}?view=advanced`}>Review proposal & voting options ↗</a>}
                              </div>)}
                              </section>
                              <div className="gd-actions gd-proposal-footer">
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
                                <div className="gd-proposal-footer-tools">
                                <ProposalSettings settings={view.settings} management={view.management}
                                  advancedUrl={`/proposal/${realmAddress}/${selectedAddress}?view=advanced`} />
                                </div>
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
              </ProposalFrame>
              <aside
                id="gd-proposal-browser"
                tabIndex={-1}
                className="gd-sidebar"
              >
                <section className="gd-scenarios">
                  <span className="gd-eyebrow">{daoName}</span>
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
            ? `${daoName} governance`
            : "Experimental presentation · Existing governance transactions"}
        </span>
      </footer>
    </DaoPageLayout>
  );
}
