import React from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import ProposalPreviewBoundary from "./ProposalPreviewBoundary";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import GrapeDaoNavigation from "./GrapeDaoNavigation";
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
    voted: Set<string>;
    status: string;
  }>({ wallet: "", voted: new Set(), status: "loading" });
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
        const sorted = [...rows].sort((a, b) => {
          const active =
            Number(b.account.state === 2) - Number(a.account.state === 2);
          return (
            active ||
            Number(b.account.draftAt || 0) - Number(a.account.draftAt || 0)
          );
        });
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
      voted: new Set(),
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
        const voted = new Set<string>(
          records
            .filter((record) => !record.account?.isRelinquished)
            .map((record) => address(record.account?.proposal))
        );
        if (!cancelled)
          setVoteHistory({ wallet: walletAddress, voted, status: "ready" });
      } catch {
        if (!cancelled)
          setVoteHistory({
            wallet: walletAddress,
            voted: new Set(),
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
      ? "Voted"
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
    <div className="governance-demo gd-live">
      <div className="gd-shell">
        <GrapeDaoNavigation />
        <header className="gd-header">
          <a href={`/dao/${GRAPE_REALM}`} className="gd-brand">
            <span className="gd-brand-icon">G</span> Governance{" "}
            <span className="gd-brand-muted">/ Lab</span>
          </a>
          <span className="gd-demo-badge">
            <span />{" "}
            {landing
              ? "Live DAO governance"
              : "Real proposals · Experimental layout"}
          </span>
        </header>
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
                                <span className="gd-pill">
                                  {view.stateLabel}
                                </span>
                              </div>
                              <div className="gd-content">
                                <h2>{view.proposal.account.name}</h2>
                                <p className="gd-description">
                                  {view.proposal.account.state === 2
                                    ? "Review the proposal and choose whether to support it."
                                    : `This proposal is ${view.stateLabel.toLowerCase()}. Its recorded outcome is shown below.`}
                                </p>
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
                                  <div className="gd-facts">
                                    <div>
                                      <span>For</span>
                                      <strong>{view.forVotes}</strong>
                                    </div>
                                    <div>
                                      <span>Against</span>
                                      <strong>{view.againstVotes}</strong>
                                    </div>
                                  </div>
                                )}
                                {!view.isMultiChoiceProposal &&
                                  view.totalCastUi > 0 && (
                                    <div className="gd-tally">
                                      <div>
                                        <strong>
                                          Share of For / Against votes
                                        </strong>
                                        <span>
                                          {view.forPct.toFixed(1)}% For
                                        </span>
                                      </div>
                                      <div
                                        className="gd-bar"
                                        role="img"
                                        aria-label={`${view.forPct.toFixed(
                                          1
                                        )} percent For`}
                                      >
                                        <span
                                          style={{ width: `${view.forPct}%` }}
                                        />
                                      </div>
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
                                    onClick={() =>
                                      setExpanded((value) => !value)
                                    }
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
                      {visible.map((item) => (
                        <button
                          key={address(item.pubkey)}
                          aria-pressed={
                            selectedAddress === address(item.pubkey)
                          }
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
                          </span>
                        </button>
                      ))}
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
          <a href={`/dao/${GRAPE_REALM}`}>Return to Grape DAO ↗</a>
        </footer>
      </div>
    </div>
  );
}
