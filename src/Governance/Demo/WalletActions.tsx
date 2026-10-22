import React from "react";
import { Button, Menu, MenuItem } from "@mui/material";
export default function WalletActions({ address }: { address: string }) {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);
  const [message, setMessage] = React.useState("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setMessage("Copied"); }
    catch { setMessage("Select the address below to copy"); }
  };
  return <>
    <Button size="small" title={address} aria-label={`Wallet actions for ${address}`} aria-haspopup="menu"
      aria-expanded={!!anchor} onClick={event => { setMessage(""); setAnchor(event.currentTarget); }}
      sx={{ color: "#b6ecd5", textTransform: "none", fontSize: 12, p: 0, minWidth: 0 }}>
      {address.slice(0, 4)}…{address.slice(-4)} ▾
    </Button>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}
      PaperProps={{ sx: { bgcolor: "#1a2938", color: "#edf2fa", maxWidth: 340, '& .MuiMenuItem-root': { fontSize: 13 } } }}>
      <MenuItem onClick={copy}>Copy wallet address</MenuItem>
      <MenuItem component="a" href={`https://solscan.io/account/${address}`} target="_blank" rel="noopener noreferrer">Solscan ↗</MenuItem>
      <MenuItem component="a" href={`https://explorer.solana.com/address/${address}`} target="_blank" rel="noopener noreferrer">Solana Explorer ↗</MenuItem>
      <li style={{ padding: "8px 16px", fontSize: 11, overflowWrap: "anywhere", userSelect: "text" }}>{address}<span role="status" style={{ display: "block", color: "#64dfb1" }}>{message}</span></li>
    </Menu>
  </>;
}
