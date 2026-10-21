import React from "react";
import ProposalPreviewBoundary from "./ProposalPreviewBoundary";
import { useSearchParams } from "react-router-dom";
import {
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

export default function GovernanceDemo() {
  const [params, setParams] = useSearchParams();
  const [proposals, setProposals] = React.useState<any[]>([]);
  const [realm, setRealm] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [revision, setRevision] = React.useState(0);
  const [filter, setFilter] = React.useState("");
  const [expanded, setExpanded] = React.useState(false);
  const requested = params.get("proposal");
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
  const selected = requested
    ? proposals.find((item) => address(item.pubkey) === requested)
    : proposals[0];
  const selectedAddress = selected ? address(selected.pubkey) : "";
  React.useEffect(() => {
    setExpanded(false);
  }, [selectedAddress]);
  const visible = proposals.filter((item) =>
    String(item.account.name).toLowerCase().includes(filter.toLowerCase())
  );
  const select = (id: string) => {
    setParams({ proposal: id });
    setExpanded(false);
  };

  return (
    <div className="governance-demo gd-live">
      <div className="gd-shell">
        <header className="gd-header">
          <a href={`/dao/${GRAPE_REALM}`} className="gd-brand">
            <span className="gd-brand-icon">G</span> Grape DAO{" "}
            <span className="gd-brand-muted">/ Lab</span>
          </a>
          <span className="gd-demo-badge">
            <span /> Real proposals · Experimental layout
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
            <p>
              Real proposals, real votes. Explore a simpler view of Grape
              governance.
            </p>
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
            <div className="gd-workspace">
              <section
                aria-label="Selected proposal"
                className="gd-live-proposal"
              >
                {!selected ? (
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
                        setParams({});
                        setRevision((n) => n + 1);
                      }}
                    >
                      Refresh proposals
                    </button>
                  </div>
                ) : (
                  <ProposalPreviewBoundary
                    key={`${selectedAddress}:${revision}`}
                    originalUrl={`/proposal/${GRAPE_REALM}/${selectedAddress}`}
                    onRetry={() => setRevision((n) => n + 1)}
                  >
                    <GovernanceProposalV2View
                      key={`${selectedAddress}:${revision}`}
                      governanceAddress={GRAPE_REALM}
                      governanceProposal={selectedAddress}
                      item={selected}
                      realm={realm}
                      showGovernanceTitle={false}
                      renderSimple={(view: any) => (
                        <>
                          <article className="gd-main">
                            <div className="gd-card-top">
                              <span className="gd-eyebrow">
                                GRAPE DAO PROPOSAL
                              </span>
                              <span className="gd-pill">{view.stateLabel}</span>
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
                                    Open the full proposal details to read the
                                    author’s description and supporting
                                    material.
                                  </p>
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
                                      <span>{view.forPct.toFixed(1)}% For</span>
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
                              {view.hasVoted && (
                                <p role="status" className="gd-note">
                                  Your vote is recorded
                                  {view.hasVotedSide
                                    ? ` · ${view.hasVotedSide}`
                                    : ""}
                                  .
                                </p>
                              )}
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
                                  This proposal has multiple options. Open the
                                  full voting details to review and vote on each
                                  option.
                                </p>
                              )}
                              <details className="gd-live-power">
                                <summary>Your voting power</summary>
                                {view.power}
                              </details>
                              <div className="gd-actions">
                                <button
                                  className="gd-secondary"
                                  aria-expanded={expanded}
                                  aria-controls="gd-full-details"
                                  onClick={() => setExpanded((value) => !value)}
                                >
                                  {expanded
                                    ? "Hide full details"
                                    : "Review full proposal & instructions"}
                                </button>
                                <a
                                  href={`/proposal/${GRAPE_REALM}/${selectedAddress}`}
                                >
                                  Original page ↗
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
              <aside className="gd-sidebar">
                <section className="gd-scenarios">
                  <span className="gd-eyebrow">GRAPE DAO</span>
                  <h3>Choose a proposal.</h3>
                  <p>Active votes first, followed by recent proposals.</p>
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
                        aria-pressed={selectedAddress === address(item.pubkey)}
                        className={
                          selectedAddress === address(item.pubkey)
                            ? "is-selected"
                            : ""
                        }
                        onClick={() => select(address(item.pubkey))}
                      >
                        <span>
                          <strong>{item.account.name}</strong>
                          <small>
                            {states[item.account.state] || "Unknown"}
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
          )}
        </main>
        <footer className="gd-footer">
          <span>
            Experimental presentation · Existing governance transactions
          </span>
          <a href={`/dao/${GRAPE_REALM}`}>Return to Grape DAO ↗</a>
        </footer>
      </div>
    </div>
  );
}
