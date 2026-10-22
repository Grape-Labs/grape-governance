import React from "react";

export default function ProposalShare({ realm, proposal, title }: {
  realm: string; proposal: string; title: string;
}) {
  const [status, setStatus] = React.useState("");
  const [manual, setManual] = React.useState(false);
  const url = `https://www.governance.so/proposal/${encodeURIComponent(realm)}/${encodeURIComponent(proposal)}`;
  const share = async () => {
    setStatus("");
    setManual(false);
    if (typeof navigator === "undefined") return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      setManual(true);
      setStatus("Copy the proposal link below");
    }
  };
  return <div className="gd-share">
    <button type="button" className="gd-share-button" aria-label="Share proposal" title="Share proposal" onClick={share}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
      </svg>
    </button>
    {status && <span className="gd-share-status" role="status">{status}</span>}
    {manual && <input aria-label="Proposal link" readOnly value={url} onFocus={event => event.target.select()} />}
  </div>;
}
