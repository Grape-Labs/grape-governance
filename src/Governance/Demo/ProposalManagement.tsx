import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from "@mui/material";

export default function ProposalManagement({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return <>
    <button className="gd-secondary" type="button" onClick={() => setOpen(true)}>Manage proposal</button>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="gd-manage-title"
      PaperProps={{ sx: { bgcolor: "#141e2b", color: "#edf2fa", borderRadius: 3 } }}>
      <DialogTitle id="gd-manage-title" sx={{ fontSize: 18 }}>Manage proposal</DialogTitle>
      <DialogContent sx={{ '& .MuiButton-root': { fontSize: 12, borderRadius: 2, textTransform: 'none' }, '& .MuiTypography-root': { fontSize: 13 } }}>
        <p style={{ fontSize: 12, color: "#a6b3c7" }}>Available actions depend on your wallet and the proposal state. Review the wallet transaction before signing.</p>
        {open && children}
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Close</Button></DialogActions>
    </Dialog>
  </>;
}
