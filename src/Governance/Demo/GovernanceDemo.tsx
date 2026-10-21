import React from "react";
import "./governance-demo.css";

type Choice = "yes" | "no";
type Stage = "decide" | "review" | "result";
const scenarios = [
  {
    asset: "SOL",
    title: "Should the DAO buy SOL?",
    description:
      "Allocate 5,000 USDC from the treasury to SOL and hold it for 30 days.",
    budget: "5,000 USDC",
    result: "approved",
    yes: 72,
    participation: 68,
  },
  {
    asset: "ZEC",
    title: "Should the DAO buy ZEC?",
    description:
      "Allocate 3,000 USDC from the treasury to ZEC and review the allocation after 30 days.",
    budget: "3,000 USDC",
    result: "threshold",
    yes: 61,
    participation: 24,
  },
  {
    asset: "BTC",
    title: "Should the DAO buy BTC?",
    description:
      "Allocate 8,000 USDC from the treasury to wrapped BTC and hold it for 30 days.",
    budget: "8,000 USDC",
    result: "rejected",
    yes: 36,
    participation: 74,
  },
];

export default function GovernanceDemo() {
  const [scenarioIndex, setScenarioIndex] = React.useState(0);
  const [stage, setStage] = React.useState<Stage>("decide");
  const [choice, setChoice] = React.useState<Choice | null>(null);
  const heading = React.useRef<HTMLHeadingElement>(null);
  const scenario = scenarios[scenarioIndex];
  const reset = (index = scenarioIndex) => {
    setScenarioIndex(index);
    setChoice(null);
    setStage("decide");
  };
  React.useEffect(() => {
    heading.current?.focus();
  }, [stage, scenarioIndex]);
  const outcome =
    scenario.result === "approved"
      ? "Proposal approved"
      : scenario.result === "threshold"
      ? "Participation target not reached"
      : "Proposal rejected";
  const explanation =
    scenario.result === "approved"
      ? "The participation target was met and YES received the majority. The proposal is ready for execution."
      : scenario.result === "threshold"
      ? "Too little voting power participated to meet this demo’s target. The purchase will not proceed."
      : "The participation target was met and NO received the majority. The purchase will not proceed.";

  return (
    <div className="governance-demo">
      <div className="gd-shell">
        <header className="gd-header">
          <a href="/" className="gd-brand">
            <span className="gd-brand-icon">G</span> Governance{" "}
            <span className="gd-brand-muted">/ Lab</span>
          </a>
          <span className="gd-demo-badge">
            <span /> Interactive demo
          </span>
        </header>
        <main>
          <div className="gd-intro">
            <span className="gd-eyebrow">A CLEARER WAY TO PARTICIPATE</span>
            <h1>
              Big decisions.
              <br />
              <span>Simple steps.</span>
            </h1>
            <p>
              Understand the proposal. Make your choice. See what happens next.
            </p>
          </div>
          <div className="gd-workspace">
            <section className="gd-main" aria-label="Proposal experiment">
              <div className="gd-card-top">
                <span className="gd-eyebrow">
                  EXAMPLE DAO <span className="gd-dot">·</span> TREASURY
                </span>
                <span className="gd-pill">Simulated data</span>
              </div>
              <ol className="gd-steps" aria-label="Voting steps">
                {["Decide", "Review", "Outcome"].map((label, index) => (
                  <li
                    key={label}
                    aria-current={
                      index === ["decide", "review", "result"].indexOf(stage)
                        ? "step"
                        : undefined
                    }
                    className={
                      index <= ["decide", "review", "result"].indexOf(stage)
                        ? "is-active"
                        : ""
                    }
                  >
                    <span>{index + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>
              <div className="gd-content">
                <div
                  className={`gd-asset ${
                    stage === "result" ? `gd-${scenario.result}` : ""
                  }`}
                  aria-hidden="true"
                >
                  {stage === "result"
                    ? scenario.result === "approved"
                      ? "✓"
                      : "—"
                    : scenario.asset.slice(0, 1)}
                </div>
                <h2 ref={heading} tabIndex={-1}>
                  {stage === "result"
                    ? outcome
                    : stage === "review"
                    ? "Ready to confirm your choice?"
                    : scenario.title}
                </h2>
                <p className="gd-description">
                  {stage === "result" ? explanation : scenario.description}
                </p>
                {stage === "decide" && (
                  <>
                    <div className="gd-facts">
                      <div>
                        <span>Proposed allocation</span>
                        <strong>{scenario.budget}</strong>
                      </div>
                      <div>
                        <span>Your voting power</span>
                        <strong>1,000 votes</strong>
                      </div>
                    </div>
                    <fieldset className="gd-choices">
                      <legend>What would you like the DAO to do?</legend>
                      {(["yes", "no"] as Choice[]).map((value) => (
                        <label
                          key={value}
                          className={`gd-choice gd-${value} ${
                            choice === value ? "is-selected" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name="demo-vote"
                            value={value}
                            checked={choice === value}
                            onChange={() => setChoice(value)}
                          />
                          <span className="gd-choice-title">
                            {value === "yes" ? "↗ YES" : "↘ NO"}
                          </span>
                          <span>
                            {value === "yes"
                              ? `Buy ${scenario.asset}`
                              : "Keep the treasury as it is"}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="gd-primary"
                      disabled={!choice}
                      onClick={() => setStage("review")}
                    >
                      Review my choice <span aria-hidden="true">→</span>
                    </button>
                    <p className="gd-footnote">
                      You can change your choice before confirming.
                    </p>
                  </>
                )}
                {stage === "review" && (
                  <>
                    <div className={`gd-review gd-${choice}`}>
                      <span>Your choice</span>
                      <strong>
                        {choice === "yes"
                          ? `YES · Buy ${scenario.asset}`
                          : `NO · Don’t buy ${scenario.asset}`}
                      </strong>
                      <span>1,000 simulated votes</span>
                    </div>
                    <p className="gd-note">
                      This records a demo vote only. No wallet connection,
                      transaction, or tokens are needed.
                    </p>
                    <div className="gd-actions">
                      <button
                        className="gd-secondary"
                        onClick={() => setStage("decide")}
                      >
                        Change choice
                      </button>
                      <button
                        className="gd-primary"
                        onClick={() => setStage("result")}
                      >
                        Confirm demo vote <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </>
                )}
                {stage === "result" && (
                  <>
                    <div className="gd-result-summary">
                      <div>
                        <span>Your recorded choice</span>
                        <strong>{choice?.toUpperCase()} · 1,000 votes</strong>
                      </div>
                      <div>
                        <span>Your tokens</span>
                        <strong>Unchanged</strong>
                      </div>
                    </div>
                    <div className="gd-tally">
                      <div>
                        <strong>Final vote</strong>
                        <span>
                          {scenario.yes}% YES · {100 - scenario.yes}% NO
                        </span>
                      </div>
                      <div
                        className="gd-bar"
                        role="img"
                        aria-label={`${scenario.yes} percent YES, ${
                          100 - scenario.yes
                        } percent NO`}
                      >
                        <span style={{ width: `${scenario.yes}%` }} />
                      </div>
                      <p>
                        {scenario.participation}% participation · 40% demo
                        target
                      </p>
                    </div>
                    <div className="gd-next">
                      <span className="gd-eyebrow">WHAT HAPPENS NEXT</span>
                      <p>
                        {scenario.result === "approved"
                          ? "An authorized execution transaction would carry out the purchase. Approval alone does not move treasury funds."
                          : "The treasury keeps its funds. Members can discuss a revised proposal."}
                      </p>
                    </div>
                    <div className="gd-actions">
                      <button className="gd-secondary" onClick={() => reset()}>
                        Try again
                      </button>
                      <button
                        className="gd-primary"
                        onClick={() =>
                          reset((scenarioIndex + 1) % scenarios.length)
                        }
                      >
                        Next scenario <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="gd-details">
                <details>
                  <summary>
                    Proposal details <span>Allocation & execution</span>
                  </summary>
                  <div>
                    <p>
                      <strong>Action:</strong> Exchange {scenario.budget} for{" "}
                      {scenario.asset} from the example treasury.
                    </p>
                    <p>
                      <strong>Review period:</strong> 30 days after execution.
                    </p>
                    <p>
                      This prototype contains no executable instructions. A live
                      proposal would show the exact asset, destination, minimum
                      received, and transaction simulation here.
                    </p>
                  </div>
                </details>
                <details>
                  <summary>
                    How this demo works <span>Rules & limitations</span>
                  </summary>
                  <div>
                    <p>
                      Each scenario has a predetermined outcome so you can
                      explore all three results. Your choice is recorded locally
                      for this interaction and does not change the example
                      totals.
                    </p>
                    <p>
                      For this demo, approval requires 40% participation and
                      more than 50% YES votes. These are illustrative rules, not
                      a representation of any live DAO’s SPL Governance
                      configuration.
                    </p>
                    <p>
                      This is a standard voting UI experiment. No bets, bonds,
                      payouts, or fund ownership are simulated.
                    </p>
                  </div>
                </details>
              </div>
            </section>
            <aside className="gd-sidebar">
              <section className="gd-scenarios">
                <span className="gd-eyebrow">EXPLORE THE DEMO</span>
                <h3>Three ways a vote can end.</h3>
                <p>Choose a scenario to walk through the experience.</p>
                <div className="gd-scenario-list">
                  {scenarios.map((item, index) => (
                    <button
                      key={item.asset}
                      aria-pressed={scenarioIndex === index}
                      className={scenarioIndex === index ? "is-selected" : ""}
                      onClick={() => reset(index)}
                    >
                      <span className="gd-scenario-number">0{index + 1}</span>
                      <span>
                        <strong>Buy {item.asset}</strong>
                        <small>
                          {item.result === "approved"
                            ? "Approved"
                            : item.result === "threshold"
                            ? "Low participation"
                            : "Rejected"}
                        </small>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="gd-sandbox-note">
                <span aria-hidden="true">◇</span>
                <div>
                  <strong>A space to experiment</strong>
                  <p>
                    All amounts and outcomes are examples. Your wallet and the
                    live governance pages are unaffected.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </main>
        <footer className="gd-footer">
          <span>
            Governance Lab <span className="gd-dot">/</span> Proposal experience
            v1
          </span>
          <a href="/">Return to governance ↗</a>
        </footer>
      </div>
    </div>
  );
}
