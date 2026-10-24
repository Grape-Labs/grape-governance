import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from "@mui/material";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CloseIcon from "@mui/icons-material/Close";
import HowToVoteOutlinedIcon from "@mui/icons-material/HowToVoteOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import WalletActions from "./WalletActions";

export default function ProposalSettings({ settings, management, advancedUrl }: { settings: any; management?: React.ReactNode; advancedUrl?: string }) {
  const [open, setOpen] = React.useState(false);
  const value = (label: string) => settings?.values?.find(([name]: string[]) => name === label)?.[1] ?? "Unavailable";
  const signed = settings?.signers?.filter((signer: any) => signer.signed).length || 0;
  return <>
    <button className="gd-settings-button" type="button" title="Proposal tools" aria-label="Proposal tools" onClick={() => setOpen(true)}><SettingsOutlinedIcon sx={{ fontSize: 18 }} /></button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="gd-settings-title"
      PaperProps={{ className: "gd-settings-dialog", sx: { bgcolor: "#141e2b", color: "#edf2fa", borderRadius: 3 } }}>
      <DialogTitle id="gd-settings-title" component="div" sx={{ p: 2.5, pb: 2 }}>
        <div className="gd-settings-heading">
          <span className="gd-settings-emblem"><SettingsOutlinedIcon sx={{ fontSize: 22 }} /></span>
          <div><h2>Proposal tools</h2><p>Settings and available actions</p></div>
          <IconButton aria-label="Close proposal settings" onClick={() => setOpen(false)} sx={{ ml: "auto", color: "#a6b3c7" }}><CloseIcon fontSize="small" /></IconButton>
        </div>
      </DialogTitle>
      <DialogContent sx={{ px: 2.5, pb: 2 }}>
        {!settings ? <p>Settings unavailable.</p> : <>
          <div className="gd-settings-status"><span>Status</span><strong>{value("Status")}</strong></div>
          <div className="gd-settings-rule-grid">
            <section>
              <h3><HowToVoteOutlinedIcon sx={{ fontSize: 16 }} /> Approval</h3>
              <strong className="gd-settings-metric">{value("Vote threshold")}</strong>
              <p>Vote threshold</p>
              <div><span>Target power</span><b>{value("Approval target")}</b></div>
              <div><span>Veto votes</span><b>{value("Veto votes")}</b></div>
            </section>
            <section>
              <h3><ScheduleIcon sx={{ fontSize: 16 }} /> Voting window</h3>
              <strong className="gd-settings-metric">{value("Base voting period")}</strong>
              <p>Base voting period</p>
              <div><span>Cool off</span><b>{value("Cool-off period")}</b></div>
            </section>
          </div>
          <h3 className="gd-settings-section-title">Governance accounts</h3>
          <dl className="gd-settings-list">
            {settings.addresses.filter(([, address]: string[]) => address).map(([label, address]: string[]) =>
              <div key={label}><dt>{label}</dt><dd><WalletActions address={address} /></dd></div>)}
          </dl>
          {settings.signers?.length > 0 && <>
            <h3 className="gd-settings-section-title">Signatories <span>{signed} / {settings.signers.length} signed</span></h3>
            <dl className="gd-settings-list">{settings.signers.map((signer: any) => <div key={signer.address}>
              <dt><WalletActions address={signer.address} /></dt><dd className={signer.signed ? "gd-signer-signed" : ""}>{signer.signed ? "✓ Signed" : "Pending"}</dd>
            </div>)}</dl>
          </>}
        </>}
        {open && management && <section className="gd-settings-management">
          <h3 className="gd-settings-section-title">Manage proposal</h3>
          {management}
        </section>}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, borderTop: "1px solid #ffffff12", justifyContent: "space-between" }}>
        {advancedUrl ? <Button component="a" href={advancedUrl} sx={{ color: "#a6b3c7", textTransform: "none", fontSize: 12 }}>Advanced proposal ↗</Button> : <span />}

        <Button onClick={() => setOpen(false)} sx={{ color: "#b6ecd5", textTransform: "none" }}>Done</Button>
      </DialogActions>
    </Dialog>
  </>;
}
