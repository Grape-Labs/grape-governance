import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
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
  });
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

export default function VoterBreakdown({ records, proposal }: { records: any[] | null; proposal: any }) {
  const [open, setOpen] = React.useState(false);
  const rows = React.useMemo(() => voterRows(records || [], proposal.account), [records, proposal]);
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
    <button className="gd-voter-link" type="button" onClick={() => setOpen(true)}>Voter breakdown ↗</button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md"
      aria-labelledby="gd-voters-title" PaperProps={{ sx: { bgcolor: "#141e2b", color: "#edf2fa", borderRadius: 3 } }}>
      <DialogTitle id="gd-voters-title" sx={{ fontSize: 18 }}>Voter breakdown</DialogTitle>
      <DialogContent>
        <p style={{ fontSize: 12, color: "#a6b3c7" }}>Voting power recorded with each vote. Relinquished records are marked separately.</p>
        {records == null ? <p>Voter records unavailable.</p> : rows.length === 0 ? <p>No voter records yet.</p> :
          <div style={{ overflowX: "auto" }}>
            <table className="gd-voters-table">
              <thead><tr><th>Wallet</th><th>Vote</th><th>Voting power</th><th>Status</th></tr></thead>
              <tbody>{rows.map((row, index) => <tr key={row.record || index}>
                <td><a href={`https://explorer.solana.com/address/${row.wallet}`} target="_blank" rel="noopener noreferrer">{row.wallet}</a></td>
                <td>{row.choice}</td><td>{row.power}</td><td>{row.status}</td>
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
