import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import WalletActions from "./WalletActions";
export default function ProposalSettings({ settings }: { settings: any }) {
  const [open, setOpen] = React.useState(false);
  return <>
    <button className="gd-settings-button" type="button" title="Proposal settings" aria-label="Proposal settings" onClick={() => setOpen(true)}><SettingsOutlinedIcon sx={{ fontSize: 18 }} /></button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="gd-settings-title"
      PaperProps={{ sx: { bgcolor: "#141e2b", color: "#edf2fa", borderRadius: 3 } }}>
      <DialogTitle id="gd-settings-title" sx={{ fontSize: 18 }}>Proposal settings</DialogTitle>
      <DialogContent>
        <p style={{ color: "#a6b3c7", fontSize: 12 }}>Read-only proposal context and current governance rules.</p>
        {!settings ? <p>Settings unavailable.</p> : <>
          <dl className="gd-settings-list">
            {settings.values.map(([label, value]: string[]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            {settings.addresses.filter(([, address]: string[]) => address).map(([label, address]: string[]) =>
              <div key={label}><dt>{label}</dt><dd><WalletActions address={address} /></dd></div>)}
          </dl>
          {settings.signers?.length > 0 && <>
            <h3 style={{ fontSize: 13 }}>Signatories</h3>
            <dl className="gd-settings-list">{settings.signers.map((signer: any) => <div key={signer.address}>
              <dt><WalletActions address={signer.address} /></dt><dd>{signer.signed ? "Signed" : "Pending"}</dd>
            </div>)}</dl>
          </>}
        </>}
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
