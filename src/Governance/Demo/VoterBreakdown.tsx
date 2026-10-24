import React from "react";
import WalletActions from "./WalletActions";
import { distinctVoterSentiment } from "./proposalListStatus";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { recordedVoteLabel } from "./proposalListStatus";

export function voterRows(records: any[], proposal: any) {
  return (records || []).map(record => {
    const vote = record.vote || {};
    const raw = vote.voterWeight ?? vote.legacyYes ?? vote.legacyNo;
    const decimals = vote.councilMint && vote.councilMint === vote.governingTokenMint ? 0 : Number(vote.decimals || 0);
    let power = "Unavailable";
    try {
      if (raw != null) {
        const digits = BigInt(raw.toString()).toString().padStart(decimals + 1, "0");
        power = decimals ? digits.slice(0, -decimals) + "." + digits.slice(-decimals).replace(/0+$/, "") : digits;
        power = power.replace(/\.$/, "");
      }
    } catch { /* Keep unavailable rather than inventing a balance. */ }
    return {
      wallet: String(record.governingTokenOwner || ""),
      choice: recordedVoteLabel({ account: { vote: vote.vote, voteWeight: { yes: vote.legacyYes, no: vote.legacyNo } } }, proposal).replace(/^Voted /, ""),
      power,
      status: record.isRelinquished ? "Relinquished" : "Recorded",
      record: String(record.voteAddress || record.pubkey || ""),
    };
  }).sort((a, b) => {
    if (a.power === "Unavailable") return b.power === "Unavailable" ? 0 : 1;
    if (b.power === "Unavailable") return -1;
    const [aw, af = ""] = a.power.split(".");
    const [bw, bf = ""] = b.power.split(".");
    const scale = Math.max(af.length, bf.length);
    const av = BigInt(aw + af.padEnd(scale, "0"));
    const bv = BigInt(bw + bf.padEnd(scale, "0"));
    return av > bv ? -1 : av < bv ? 1 : 0;
  });
}

export function formatVoterPower(power: string) {
  if (power === "Unavailable") return power;
  const [whole, fraction = ""] = power.split(".");
  const rounded = BigInt(whole) * 100n + BigInt(fraction.padEnd(3, "0").slice(0, 2)) +
    (Number(fraction[2] || 0) >= 5 ? 1n : 0n);
  const integer = (rounded / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = (rounded % 100n).toString().padStart(2, "0").replace(/0+$/, "");
  return integer + (decimal ? "." + decimal : "");
}

export function voterWorkbook(rows: ReturnType<typeof voterRows>) {
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]!));
  const data = [["Wallet", "Vote", "Voting power", "Record status", "Vote record"], ...rows.map(row => [row.wallet, row.choice, row.power, row.status, row.record])];
  // SpreadsheetML: explicit string cells preserve wallet IDs and exact voting weights.
  return '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Voters"><Table>' +
    data.map(row => '<Row>' + row.map(cell => '<Cell><Data ss:Type="String">' + escape(cell) + '</Data></Cell>').join('') + '</Row>').join('') +
    '</Table></Worksheet></Workbook>';
}

export default function VoterBreakdown({ records, proposal, count }: { records: any[] | null; proposal: any; count?: number }) {
  const [open, setOpen] = React.useState(false);
  const rows = React.useMemo(() => voterRows(records || [], proposal.account), [records, proposal]);
  const stats = React.useMemo(() => distinctVoterSentiment(records || []), [records]);
  const binary = (!proposal.account?.options || (proposal.account.options.length === 1 && proposal.account.denyVoteWeight != null)) && Number(proposal.account?.voteType?.type || 0) === 0;
  const support = stats.total ? stats.for / stats.total * 100 : 0;
  const download = () => {
    const blob = new Blob([voterWorkbook(rows)], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `proposal-${proposal.pubkey?.toBase58?.() || proposal.pubkey || "votes"}-voters.xml`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <>
    <h3 className="gd-sentiment-heading">{binary ? "Voter sentiment" : "Voter records"} <button className="gd-voter-icon" type="button" aria-label="Open voter breakdown" title="Voter breakdown" onClick={() => setOpen(true)}>↗</button></h3>
    {count != null && <button type="button" className="gd-voter-count gd-voter-count-button" title="Open voter breakdown · One count per token-owner wallet" onClick={() => setOpen(true)}>{count} wallets</button>}
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"
      aria-labelledby="gd-voters-title" PaperProps={{ sx: { bgcolor: "#141e2b", color: "#edf2fa", borderRadius: 3 } }}>
      <DialogTitle id="gd-voters-title" sx={{ fontSize: 18 }}>Voter breakdown</DialogTitle>
      <DialogContent>
        <p style={{ fontSize: 12, color: "#a6b3c7" }}>Voting power recorded with each vote. Relinquished records are marked separately.</p>
        {records != null && <div className="gd-voter-stats">
          <section className="gd-voter-stat-card">
            <span className="gd-stat-label"><PeopleOutlineIcon sx={{ fontSize: 16 }} /> Participating wallets</span>
            <strong className="gd-stat-value">{stats.total.toLocaleString()}</strong>
            <small>Unique wallets · active records</small>
          </section>
          {binary && <><section className="gd-voter-stat-card">
            <span className="gd-stat-label">Vote split</span>
            <div className="gd-stat-split"><div><strong className="gd-stat-for">{stats.for.toLocaleString()}</strong><span>For</span></div><div><strong className="gd-stat-against">{stats.against.toLocaleString()}</strong><span>Against</span></div>{stats.other > 0 && <div><strong>{stats.other.toLocaleString()}</strong><span>Other</span></div>}</div>
            <div className="gd-stat-bar" aria-hidden="true"><span style={{ width: `${support}%` }} /><span style={{ width: `${stats.total ? stats.against / stats.total * 100 : 0}%` }} /></div>
          </section>
          <section className="gd-voter-stat-card gd-voter-support">
            <div><span className="gd-stat-label">Wallet support</span><strong className="gd-stat-value">{support.toFixed(1)}<small>%</small></strong><small>{stats.total ? "Of participating wallets voted for" : "No active votes yet"}</small></div>
            <svg className="gd-support-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" /><circle className="gd-support-ring-fill" cx="32" cy="32" r="26" pathLength="100" strokeDasharray={`${support} 100`} /><path d="m23 32 6 6 12-13" /></svg>
          </section></>}
        </div>}
        {records == null ? <p>Voter records unavailable.</p> : rows.length === 0 ? <p>No voter records yet.</p> :
          <div style={{ overflowX: "auto" }}>
            <table className="gd-voters-table">
              <thead><tr><th>Wallet</th><th>Vote</th><th className="gd-voter-power" aria-sort="descending">Voting power ↓</th><th>Status</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.record || index}>
                <td><WalletActions address={row.wallet} /></td>
                <td><span className="gd-voter-choice">{row.choice === "For" ? <ThumbUpIcon aria-hidden="true" sx={{ fontSize: 14, color: "#64dfb1" }} /> : row.choice === "Against" ? <ThumbDownIcon aria-hidden="true" sx={{ fontSize: 14, color: "#ef9199" }} /> : null}{row.choice}</span></td><td className="gd-voter-power" title={row.power}>{formatVoterPower(row.power)}</td><td>{row.status}</td>
              </tr>)}</tbody>
            </table>
          </div>}
      </DialogContent>
      <DialogActions>
        <Button onClick={download} disabled={!rows.length} title="Excel-compatible XML workbook">Export to Excel</Button>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </DialogActions>
    </Dialog>
  </>;
}
