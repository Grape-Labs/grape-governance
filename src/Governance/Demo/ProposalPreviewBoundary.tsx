import React from "react";

export default class ProposalPreviewBoundary extends React.Component<
  {
    children: React.ReactNode;
    originalUrl: string;
    onRetry: () => void;
  },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Proposal preview failed:", error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="gd-main gd-content" role="alert">
        <h2>This proposal preview could not be displayed.</h2>
        <p>
          You can retry, select another proposal, or open the original page.
        </p>
        <div className="gd-actions">
          <button className="gd-secondary" onClick={this.props.onRetry}>
            Retry proposal
          </button>
          <a href={this.props.originalUrl}>Open original proposal ↗</a>
        </div>
      </div>
    );
  }
}
