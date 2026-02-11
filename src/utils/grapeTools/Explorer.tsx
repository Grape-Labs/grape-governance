// ExplorerView.tsx — drop-in replacement (MUI v5)
// Goals vs your current version:
// - Cleaner/denser button + menu UI (less bulky)
// - No menu "jump" (uses Popover positioning + compact paddings)
// - Optional lazy fetch: only fetch profile/domain/balance when menu opens
// - Better blacklisted/off-curve affordances
// - Safer effects + no noisy console logs
// - Keeps your existing props API as much as possible

import React from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { styled } from "@mui/material/styles";
import { useSnackbar } from "notistack";
import { Link } from "react-router-dom";
import { PublicKey } from "@solana/web3.js";
import QRCode from "react-qr-code";
import axios from "axios";

import { getProfilePicture } from "@solflare-wallet/pfp";
import { findDisplayName } from "../name-service";

import {
  RPC_CONNECTION,
  TWITTER_PROXY,
  SHYFT_KEY,
  HELIUS_API,
  BLACKLIST_WALLETS,
} from "./constants";

import {
  Avatar,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  Grid,
  Box,
  ListItemText,
  Typography,
  Paper,
  Divider,
  Tooltip,
  Dialog,
  DialogContent,
  DialogContentText,
  IconButton,
  Chip,
  CircularProgress,
} from "@mui/material";

import SolCurrencyIcon from "../../components/static/SolCurrencyIcon";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import TwitterIcon from "@mui/icons-material/Twitter";
import ExploreOutlinedIcon from "@mui/icons-material/ExploreOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExploreIcon from "@mui/icons-material/Explore";
import PersonIcon from "@mui/icons-material/Person";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloseIcon from "@mui/icons-material/Close";

import { trimAddress } from "./WalletAddress";
import { ValidateCurve } from "../grapeTools/WalletAddress";
import { decodeMetadata } from "../grapeTools/utils";

const StyledMenu = styled(Menu)(({ theme }) => ({
  "& .MuiPaper-root": {
    borderRadius: 14,
    minWidth: 240,
    background: "rgba(10,10,10,0.94)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0px 10px 30px rgba(0,0,0,0.35)",
  },
  "& .MuiMenuItem-root": {
    minHeight: 36,
    paddingTop: 6,
    paddingBottom: 6,
  },
}));

function isSamePk(a?: string, b?: string) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

function safeBase58(pk: any): string | null {
  try {
    if (!pk) return null;
    if (typeof pk === "string") return pk;
    if (pk?.toBase58) return pk.toBase58();
    if (pk?.toString) return pk.toString();
    return String(pk);
  } catch {
    return null;
  }
}

export default function ExplorerView(props: any) {
  const address: string = props.address;
  const title = props.title || null;
  const showAddress = props.showAddress || false;
  const memberMap = props?.memberMap || null;
  const type = props.type || "address";
  const buttonStyle = props?.style || "text"; // default to less bulky
  const buttonColor = props?.color || "inherit";
  const hideTitle = props?.hideTitle || false;
  const hideIcon = props?.hideIcon || false;
  const fontSize = props?.fontSize || "13px";
  const useLogo = props?.useLogo || null;
  const grapeArtProfile = props?.grapeArtProfile || false;
  const shorten = props?.shorten || 0;
  const dao = props?.dao;
  const governance = props?.governance;

  const showSolanaProfile = props.showSolanaProfile || null;
  const showNftData = props.showNftData || null;
  const showSolBalance = props.showSolBalance || null;

  const showTokenMetadata = props?.showTokenMetadata;
  const tokenMap = props?.tokenMap;

  const connection = RPC_CONNECTION;

  const isBlacklisted =
    !!address &&
    BLACKLIST_WALLETS.some((w: string) => w?.toLowerCase?.() === address.toLowerCase());

  const offCurve = !!address && type === "address" && !ValidateCurve(address);

  const { enqueueSnackbar } = useSnackbar();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Display name / metadata
  const [solanaDomain, setSolanaDomain] = React.useState<string | null>(null);
  const [hasSolanaDomain, setHasSolanaDomain] = React.useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = React.useState<string | null>(null);
  const [hasProfilePicture, setHasProfilePicture] = React.useState<boolean>(false);
  const [twitterRegistration, setTwitterRegistration] = React.useState<string | null>(null);

  // QR + Balance
  const [openDialog, setOpenDialog] = React.useState(false);
  const [solBalance, setSolBalance] = React.useState<number | null>(null);

  // Lazy loading flags
  const [loadingMeta, setLoadingMeta] = React.useState(false);
  const metaFetchedRef = React.useRef(false);

  const handleClick = (event: any) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleCopyClick = () => {
    enqueueSnackbar("Copied!", { variant: "success" });
    handleClose();
  };

  const handleOpenQR = () => setOpenDialog(true);
  const handleCloseQR = () => {
    setOpenDialog(false);
    handleClose();
  };

  const label = React.useMemo(() => {
    if (title) return title;
    if (hideTitle) return "";
    if (solanaDomain) return solanaDomain;
    if (shorten && shorten > 0) return trimAddress(address, shorten);
    return address;
  }, [title, hideTitle, solanaDomain, shorten, address]);

  const secondary = React.useMemo(() => {
    if (!showAddress) return null;
    if (!hasSolanaDomain) return null;
    return shorten && shorten > 0 ? trimAddress(address, shorten) : address;
  }, [showAddress, hasSolanaDomain, shorten, address]);

  // ---------- fetchers (now opt-in / lazy) ----------

  const fetchFromTokenMap = React.useCallback(async () => {
    if (!tokenMap || !address) return false;
    const titem = tokenMap.get(address);
    if (titem?.name) {
      setSolanaDomain(titem.name);
      setHasSolanaDomain(true);
    }
    if (titem?.logoURI) {
      setProfilePictureUrl(titem.logoURI);
      setHasProfilePicture(true);
    }
    return !!titem;
  }, [tokenMap, address]);

  const fetchSolanaDomain = React.useCallback(async () => {
    if (!address) return;
    setTwitterRegistration(null);
    setHasSolanaDomain(false);

    const domain = await findDisplayName(connection, address);
    if (domain && domain[0] && domain[0] !== address) {
      setHasSolanaDomain(true);
      setSolanaDomain(domain[0]);
    }
  }, [connection, address]);

  const fetchProfilePicture = React.useCallback(async () => {
    if (!address) return;
    try {
      const { isAvailable, url } = await getProfilePicture(connection, new PublicKey(address));
      if (url) {
        const img = url.replace(/width=100/g, "width=256");
        setProfilePictureUrl(img);
        setHasProfilePicture(true);
      } else {
        setHasProfilePicture(isAvailable);
      }
    } catch {
      // ignore
    }
  }, [connection, address]);

  const fetchSolBalance = React.useCallback(async () => {
    if (!address) return;
    try {
      const balance = await connection.getBalance(new PublicKey(address));
      setSolBalance(+((balance / 1e9).toFixed(3)));
    } catch {
      // ignore
    }
  }, [connection, address]);

  const fetchNftMetadata = React.useCallback(async () => {
    if (!address || !HELIUS_API) return;

    try {
      // Use Helius getAsset first
      const uri = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API}`;
      const response = await fetch(uri, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "text",
          method: "getAsset",
          params: { id: address },
        }),
      });

      const { result } = await response.json();
      if (result) {
        const name = result?.content?.metadata?.name;
        const image = result?.content?.links?.image;
        if (name) {
          setSolanaDomain(name);
          setHasSolanaDomain(true);
        }
        if (image) {
          setProfilePictureUrl(image);
          setHasProfilePicture(true);
        }
        return;
      }

      // Fallback: metaplex metadata PDA
      const MD_PUBKEY = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
      const [pda] = await PublicKey.findProgramAddress(
        [Buffer.from("metadata"), MD_PUBKEY.toBuffer(), new PublicKey(address).toBuffer()],
        MD_PUBKEY
      );

      const tokendata = await connection.getParsedAccountInfo(new PublicKey(pda));
      if (tokendata?.value?.data) {
        const buf = Buffer.from(tokendata.value.data as any, "base64");
        const meta_final = decodeMetadata(buf);

        const nm = meta_final?.data?.name;
        if (nm) {
          setSolanaDomain(nm);
          setHasSolanaDomain(true);
        }
        if (meta_final?.data?.uri) {
          const urimeta = await window.fetch(meta_final.data.uri).then((res: any) => res.json());
          const image = urimeta?.image;
          if (image) {
            setProfilePictureUrl(image);
            setHasProfilePicture(true);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [address, connection]);

  // Seed from memberMap immediately (fast path)
  React.useEffect(() => {
    if (!showSolanaProfile || !address) return;

    // set quick initial label
    setSolanaDomain(shorten && shorten > 0 ? trimAddress(address, shorten) : address);
    setHasSolanaDomain(false);
    setHasProfilePicture(false);
    setProfilePictureUrl(null);
    setTwitterRegistration(null);

    if (!memberMap) return;

    try {
      for (const member of memberMap) {
        const owner = safeBase58(member?.account?.governingTokenOwner);
        if (isSamePk(owner, address)) {
          const sc = member?.socialConnections;
          if (sc?.solflare?.pfp) {
            setProfilePictureUrl(sc.solflare.pfp);
            setHasProfilePicture(true);
          }
          if (sc?.bonfida?.handle) {
            setSolanaDomain(sc.bonfida.handle);
            setHasSolanaDomain(true);
          }
          if (sc?.cardinal?.handle) {
            setSolanaDomain(sc.cardinal.handle);
            setHasSolanaDomain(true);
            setTwitterRegistration(sc.cardinal.handle);
          }
          if (sc?.cardinal?.pfp) {
            setProfilePictureUrl(sc.cardinal.pfp);
            setHasProfilePicture(true);
          }
          break;
        }
      }
    } catch {
      // ignore
    }
  }, [showSolanaProfile, address, shorten, memberMap]);

  // Lazy fetch on menu open (only once per address)
  React.useEffect(() => {
    if (!open) return;
    if (!address) return;
    if (metaFetchedRef.current) return;

    let alive = true;
    (async () => {
      setLoadingMeta(true);

      // Token map is cheapest
      const gotTokenMap = await fetchFromTokenMap();

      // Only do heavier calls if needed/allowed by props
      if (!alive) return;

      if (!gotTokenMap && showSolanaProfile) {
        await Promise.all([fetchSolanaDomain(), fetchProfilePicture()]);
      }

      if (!alive) return;

      if (showNftData) await fetchNftMetadata();
      if (showSolBalance) await fetchSolBalance();

      if (!alive) return;
      metaFetchedRef.current = true;
      setLoadingMeta(false);
    })();

    return () => {
      alive = false;
    };
  }, [
    open,
    address,
    showSolanaProfile,
    showNftData,
    showSolBalance,
    fetchFromTokenMap,
    fetchSolanaDomain,
    fetchProfilePicture,
    fetchNftMetadata,
    fetchSolBalance,
  ]);

  // Reset lazy flag if address changes
  React.useEffect(() => {
    metaFetchedRef.current = false;
    setLoadingMeta(false);
  }, [address]);

  // ---------- render ----------

  return (
    <>
      <Tooltip
        title={
            isBlacklisted
            ? "This wallet is blacklisted"
            : offCurve
                ? "Program address (PDA)"
                : "Open menu"
        }
        >
        <Button
          aria-controls={open ? "explorer-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={open ? "true" : undefined}
          onClick={handleClick}
          variant={buttonStyle}
          color="inherit"
          sx={{
            m: 0,
            borderRadius: "14px",
            textTransform: "none",
            px: 1,
            minHeight: 34,
            color: buttonColor,
            ...(isBlacklisted
              ? { border: "1px solid rgba(255,165,0,0.35)", background: "rgba(255,165,0,0.08)" }
              : {}),
          }}
          startIcon={
            hideIcon ? null : (
                <>
                {profilePictureUrl ? (
                    <Avatar alt={address} src={profilePictureUrl} sx={{ width: 26, height: 26, bgcolor: "rgb(0,0,0)" }} />
                ) : useLogo ? (
                    <Avatar alt={address} src={useLogo} sx={{ width: 26, height: 26, bgcolor: "rgb(0,0,0)" }} />
                ) : isBlacklisted ? (
                    <WarningAmberIcon sx={{ color: "orange", fontSize }} />
                ) : (
                    <ExploreIcon sx={{ color: buttonColor, fontSize }} />
                )}
                </>
            )
            }
        >
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
            <Typography sx={{ fontSize, color: buttonColor, lineHeight: 1.15 }}>
              {label}
            </Typography>
            {!!secondary && (
              <Typography variant="caption" sx={{ opacity: 0.75, lineHeight: 1.1 }}>
                {secondary}
              </Typography>
            )}
          </Box>
        </Button>
      </Tooltip>

      <StyledMenu
        id="explorer-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: "left", vertical: "top" }}
        anchorOrigin={{ horizontal: "left", vertical: "bottom" }}
      >
        {/* Header row inside the menu */}
        <Box sx={{ px: 1.25, pt: 1, pb: 0.75, display: "flex", alignItems: "center", gap: 1 }}>
          {profilePictureUrl ? (
            <Avatar src={profilePictureUrl} sx={{ width: 28, height: 28 }} />
          ) : (
            <Avatar sx={{ width: 28, height: 28, bgcolor: "rgba(255,255,255,0.08)" }}>
              {(address || "").slice(0, 2)}
            </Avatar>
          )}

          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }} noWrap>
              {solanaDomain || (shorten ? trimAddress(address, shorten) : address)}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }} noWrap>
              {shorten ? trimAddress(address, 4) : address}
            </Typography>
          </Box>

          {loadingMeta ? (
            <CircularProgress size={16} />
          ) : (
            <Chip
            size="small"
            label={type === "tx" ? "TX" : offCurve ? "PDA" : "PK"}
            sx={{
                height: 20,
                opacity: 0.85,
                "& .MuiChip-label": { px: 0.75, fontSize: 11 },
            }}
            />
          )}

          <IconButton size="small" onClick={handleClose} sx={{ p: 0.5, ml: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ opacity: 0.12 }} />

        <CopyToClipboard text={address} onCopy={handleCopyClick}>
          <MenuItem onClick={handleClose}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Copy address" />
          </MenuItem>
        </CopyToClipboard>

        {grapeArtProfile && (
          <>
            <MenuItem onClick={handleOpenQR}>
              <ListItemIcon>
                <QrCode2Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="QR code" />
            </MenuItem>

            {typeof solBalance === "number" && (
              <Tooltip title="SOL balance">
                <MenuItem>
                  <ListItemIcon>
                    <SolCurrencyIcon sx={{ color: "white" }} />
                  </ListItemIcon>
                  <ListItemText primary={`${solBalance} SOL`} />
                </MenuItem>
              </Tooltip>
            )}

            <Divider sx={{ opacity: 0.12 }} />
          </>
        )}

        {grapeArtProfile && (
          <>
            <MenuItem
              component="a"
              target="_blank"
              href={`https://governance.so/profile/${address}`}
              onClick={handleClose}
            >
              <ListItemIcon>
                <ContactPageIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Governance profile" />
              <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
            </MenuItem>

            <MenuItem
              component="a"
              target="_blank"
              href={`https://grape.art/identity/${address}`}
              onClick={handleClose}
            >
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Grape identity" />
              <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
            </MenuItem>

            <Divider sx={{ opacity: 0.12 }} />
          </>
        )}

        {governance && (
          <>
            <MenuItem
              component="a"
              target="_blank"
              href={`https://governance.so/treasury/${dao}/${governance}`}
              onClick={handleClose}
            >
              <ListItemIcon>
                <AccountBalanceIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Treasury wallet" />
              <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
            </MenuItem>

            <Divider sx={{ opacity: 0.12 }} />
          </>
        )}

        {/* Explorers */}
        <MenuItem
          component="a"
          href={`https://explorer.solana.com/${type}/${address}`}
          target="_blank"
          onClick={handleClose}
        >
          <ListItemIcon>
            <ExploreOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Solana Explorer" />
          <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
        </MenuItem>

        <MenuItem
          component="a"
          href={`https://translator.shyft.to/${type === "address" ? "address" : "tx"}/${address}`}
          target="_blank"
          onClick={handleClose}
        >
          <ListItemIcon>
            <ExploreOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Shyft translator" />
          <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
        </MenuItem>

        <MenuItem
          component="a"
          href={`https://solscan.io/${type === "address" ? "account" : type}/${address}`}
          target="_blank"
          onClick={handleClose}
        >
          <ListItemIcon>
            <ExploreOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Solscan" />
          <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
        </MenuItem>

        <MenuItem
          component="a"
          href={`https://solana.fm/${type}/${address}`}
          target="_blank"
          onClick={handleClose}
        >
          <ListItemIcon>
            <ExploreOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="SolanaFM" />
          <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
        </MenuItem>

        <MenuItem
          component="a"
          href={`https://solanabeach.io/${type === "address" ? "address" : "transaction"}/${address}`}
          target="_blank"
          onClick={handleClose}
        >
          <ListItemIcon>
            <ExploreOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Solana Beach" />
          <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
        </MenuItem>

        {twitterRegistration && (
          <>
            <Divider sx={{ opacity: 0.12 }} />
            <MenuItem
              component="a"
              href={`https://twitter.com/${twitterRegistration}`}
              target="_blank"
              onClick={handleClose}
            >
              <ListItemIcon>
                <TwitterIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Twitter" />
              <OpenInNewIcon sx={{ opacity: 0.6 }} fontSize="small" />
            </MenuItem>
          </>
        )}
      </StyledMenu>

      {/* QR dialog */}
      <Dialog open={openDialog} onClose={handleCloseQR} PaperProps={{ sx: { borderRadius: 2 } }}>
        <Box sx={{ px: 2, pt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            QR Code
          </Typography>
          <IconButton onClick={handleCloseQR} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent>
          <DialogContentText component="div">
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              sx={{
                borderRadius: 2,
                backgroundColor: "#111",
                p: 2,
                mb: 2,
                border: "1px solid rgba(255,255,255,0.1)",
                maxWidth: 256,
                mx: "auto",
              }}
            >
              <QRCode
                size={256}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                value={address}
                viewBox={`0 0 256 256`}
                fgColor="#ffffff"
                bgColor="#111111"
              />
            </Box>

            <Typography variant="caption" sx={{ display: "block", textAlign: "center", opacity: 0.85 }}>
              {address}
            </Typography>
            <Typography variant="caption" sx={{ display: "block", textAlign: "center", opacity: 0.6, mt: 0.5 }}>
              Send to this address
            </Typography>
          </DialogContentText>
        </DialogContent>
      </Dialog>
    </>
  );
}