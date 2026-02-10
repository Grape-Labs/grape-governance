// BatchSendView.tsx
// Drop-in Extension Plugin: Batch Transfer (SOL + SPL via CSV)
// Usage: add <BatchSendView .../> into ExtensionsMenuView just like Send/CustomIx/etc.

import { AnchorProvider, web3 } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getMint,
} from "@solana/spl-token-v2";

import React, { useCallback } from "react";
import axios from "axios";

import { RPC_CONNECTION } from "../../../utils/grapeTools/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import { styled } from "@mui/material/styles";

import {
  Typography,
  Button,
  Grid,
  Box,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
  TextField,
  FormControl,
  InputAdornment,
  ListItemIcon,
  Chip,
} from "@mui/material/";

import { useSnackbar } from "notistack";

import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import SettingsIcon from "@mui/icons-material/Settings";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";

import AdvancedProposalView from "./AdvancedProposalView";

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
  const { children, onClose, ...other } = props;

  return (
    <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: "absolute",
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  "& .MuDialogContent-root": { padding: theme.spacing(2) },
  "& .MuDialogActions-root": { padding: theme.spacing(1) },
}));

type ParsedRow = {
  to: string;
  amount: number;
};

function parseCsvRecipients(input: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = [];
  const errors: string[] = [];

  const lines = (input || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  lines.forEach((line, i) => {
    // allow: "address,amount" or "address amount"
    const parts = line.includes(",")
      ? line.split(",").map((p) => p.trim())
      : line.split(/\s+/).map((p) => p.trim());

    const addr = parts[0];
    const amtStr = parts[1];

    if (!addr || !amtStr) {
      errors.push(`Line ${i + 1}: expected "address, amount"`);
      return;
    }

    let pkOk = true;
    try {
      // eslint-disable-next-line no-new
      new PublicKey(addr);
    } catch {
      pkOk = false;
    }
    if (!pkOk) {
      errors.push(`Line ${i + 1}: invalid address`);
      return;
    }

    const amt = Number(amtStr);
    if (!Number.isFinite(amt) || amt <= 0) {
      errors.push(`Line ${i + 1}: invalid amount`);
      return;
    }

    rows.push({ to: addr, amount: amt });
  });

  return { rows, errors };
}

async function getMintDecimalsSafe(mint: PublicKey): Promise<number> {
  // Prefer spl-token getMint; if it fails, try parsed account
  try {
    const m = await getMint(RPC_CONNECTION as any, mint, "confirmed", TOKEN_PROGRAM_ID);
    return m.decimals;
  } catch {
    const info = await RPC_CONNECTION.getParsedAccountInfo(mint, "confirmed");
    const dec = (info?.value as any)?.data?.parsed?.info?.decimals;
    if (typeof dec === "number") return dec;
    throw new Error("Unable to fetch mint decimals");
  }
}

const toLamports = (sol: number) => Math.floor(sol * web3.LAMPORTS_PER_SOL);

const toTokenAmount = (ui: number, decimals: number) => {
  // avoid float rounding surprises for most common values; still best-effort.
  const scale = 10 ** decimals;
  return BigInt(Math.floor(ui * scale + 1e-9));
};

// Helper function to split instructions into chunks
const chunkInstructions = (instructions: TransactionInstruction[], chunkSize: number) => {
  const chunks: TransactionInstruction[][] = [];
  for (let i = 0; i < instructions.length; i += chunkSize) {
    chunks.push(instructions.slice(i, i + chunkSize));
  }
  return chunks;
};

export default function BatchSendView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;

  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>(null);
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(null);
  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  // Form
  const [mode, setMode] = React.useState<"SOL" | "SPL">("SOL");
  const [mintAddress, setMintAddress] = React.useState<string>("");
  const [csv, setCsv] = React.useState<string>("");

  // UX state
  const [loading, setLoading] = React.useState(false);
  const [previewCount, setPreviewCount] = React.useState(0);
  const [previewTotal, setPreviewTotal] = React.useState(0);

  const { enqueueSnackbar } = useSnackbar();

  const onError = useCallback(
    (error: WalletError) => {
      enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: "error" });
      // eslint-disable-next-line no-console
      console.error(error);
    },
    [enqueueSnackbar]
  );

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account.config.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.communityMint);
    }
  };

  const handleAdvancedToggle = () => setOpenAdvanced(!openAdvanced);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };
  const handleCloseDialog = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const simulateIx = async (transaction: Transaction): Promise<boolean> => {
    try {
      const { blockhash } = await RPC_CONNECTION.getLatestBlockhash();
      const payerKey = new PublicKey(governanceNativeWallet);
      const transactionIxs: TransactionInstruction[] = transaction.instructions;

      for (const instructionChunk of chunkInstructions(transactionIxs, 10)) {
        const message = new TransactionMessage({
          payerKey,
          recentBlockhash: blockhash,
          instructions: instructionChunk,
        }).compileToV0Message();

        const vtx = new VersionedTransaction(message);
        const simulationResult = await RPC_CONNECTION.simulateTransaction(vtx);

        if (simulationResult.value.err) {
          // eslint-disable-next-line no-console
          console.error("Chunk simulation failed:", simulationResult.value.err);
          return false;
        }
      }
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("simulateIx error:", e);
      return false;
    }
  };

  const computePreview = React.useCallback(() => {
    const { rows } = parseCsvRecipients(csv);
    setPreviewCount(rows.length);
    setPreviewTotal(rows.reduce((s, r) => s + (Number.isFinite(r.amount) ? r.amount : 0), 0));
  }, [csv]);

  React.useEffect(() => computePreview(), [computePreview]);

  React.useEffect(() => {
    // governance mint selection logic matches your other views
    setIsGoverningMintSelectable(false);
    if (realm && realm?.account.config?.councilMint) {
      setGoverningMint(realm?.account.config.councilMint);
      setIsGoverningMintCouncilSelected(true);
      if (realm && realm?.account?.communityMint) {
        if (Number(rulesWallet?.account?.config?.minCommunityTokensToCreateProposal) !== 18446744073709551615) {
          setGoverningMint(realm?.account.communityMint);
          setIsGoverningMintSelectable(true);
          setIsGoverningMintCouncilSelected(false);
        }
      }
    } else {
      if (realm && realm?.account?.communityMint) {
        setGoverningMint(realm?.account.communityMint);
        setIsGoverningMintCouncilSelected(false);
      }
    }
  }, []);

  const handleBuildBatchTransfer = async () => {
    if (!governanceNativeWallet) {
      enqueueSnackbar("Missing governance native wallet", { variant: "error" });
      return;
    }

    const { rows, errors } = parseCsvRecipients(csv);
    if (errors.length) {
      enqueueSnackbar(errors[0], { variant: "error" });
      return;
    }
    if (!rows.length) {
      enqueueSnackbar("No recipients found", { variant: "error" });
      return;
    }

    if (mode === "SPL") {
      try {
        // eslint-disable-next-line no-new
        new PublicKey(mintAddress);
      } catch {
        enqueueSnackbar("Invalid mint address", { variant: "error" });
        return;
      }
    }

    setLoading(true);

    try {
      const from = new PublicKey(governanceNativeWallet);
      const ixs: TransactionInstruction[] = [];

      if (mode === "SOL") {
        for (const r of rows) {
          ixs.push(
            SystemProgram.transfer({
              fromPubkey: from,
              toPubkey: new PublicKey(r.to),
              lamports: toLamports(r.amount),
            })
          );
        }

        const totalSol = rows.reduce((s, r) => s + r.amount, 0);
        const title = proposalTitle || `Batch SOL Transfer (${rows.length})`;
        const desc =
          proposalDescription ||
          `Batch transfer ${totalSol.toFixed(4)} SOL to ${rows.length} recipient(s).`;

        const ok = await simulateIx(new Transaction().add(...ixs));
        if (!ok) {
          enqueueSnackbar("Simulation failed (one or more transfers may fail)", { variant: "error" });
          setLoading(false);
          return;
        }

        if (handleCloseExtMenu) handleCloseExtMenu();
        setOpen(false);

        setInstructions({
          title,
          description: desc,
          ix: ixs,
          aix: [],
          nativeWallet: governanceNativeWallet,
          governingMint,
          draft: isDraft,
        });
        setExpandedLoader(true);
        setLoading(false);
        return;
      }

      // SPL mode
      const mint = new PublicKey(mintAddress);
      const decimals = await getMintDecimalsSafe(mint);

      // Governance source token account (ATA)
      const sourceAta = await getAssociatedTokenAddress(mint, from, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

      // Ensure source ATA exists (if not, this proposal will fail; warn early)
      const srcInfo = await RPC_CONNECTION.getAccountInfo(sourceAta);
      if (!srcInfo) {
        enqueueSnackbar("Source token account (ATA) does not exist for governance wallet", { variant: "error" });
        setLoading(false);
        return;
      }

      // For recipients: create ATA if missing, then transfer
      // Note: Account existence checks are network calls; do in parallel.
      const recipients = rows.map((r) => ({
        toPk: new PublicKey(r.to),
        uiAmount: r.amount,
      }));

      const ataList = await Promise.all(
        recipients.map(async (r) => {
          const ata = await getAssociatedTokenAddress(
            mint,
            r.toPk,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          );
          const info = await RPC_CONNECTION.getAccountInfo(ata);
          return { ata, exists: !!info, owner: r.toPk, uiAmount: r.uiAmount };
        })
      );

      for (const item of ataList) {
        if (!item.exists) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              from, // payer (governance wallet)
              item.ata,
              item.owner,
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        const amount = toTokenAmount(item.uiAmount, decimals);
        ixs.push(
          createTransferInstruction(
            sourceAta,
            item.ata,
            from,
            amount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      const totalUi = rows.reduce((s, r) => s + r.amount, 0);
      const title = proposalTitle || `Batch SPL Transfer (${rows.length})`;
      const desc =
        proposalDescription ||
        `Batch transfer ${totalUi.toFixed(4)} tokens (mint ${mint.toBase58().slice(0, 6)}...) to ${rows.length} recipient(s).`;

      const ok = await simulateIx(new Transaction().add(...ixs));
      if (!ok) {
        enqueueSnackbar("Simulation failed (ATAs/transfer may fail)", { variant: "error" });
        setLoading(false);
        return;
      }

      if (handleCloseExtMenu) handleCloseExtMenu();
      setOpen(false);

      setInstructions({
        title,
        description: desc,
        ix: ixs,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
      });
      setExpandedLoader(true);
      setLoading(false);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(e);
      enqueueSnackbar(e?.message || "Failed to build batch transfer", { variant: "error" });
      setLoading(false);
    }
  };

  return (
    <>
      <MenuItem onClick={publicKey ? handleClickOpen : undefined}>
        <ListItemIcon>
          <AccountBalanceWalletIcon fontSize="small" />
        </ListItemIcon>
        Batch Transfer
      </MenuItem>

      <BootstrapDialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            background: "#13151C",
            border: "1px solid rgba(255,255,255,0.05)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "20px",
          },
        }}
      >
        <BootstrapDialogTitle id="batch-send-dialog" onClose={handleCloseDialog}>
          Batch Transfer
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: "center", mb: 2 }}>
            Paste recipients as <b>address, amount</b> per line. Builds a proposal with many transfers.
          </DialogContentText>

          {loading && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
            </Box>
          )}

          <FormControl fullWidth>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as any)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                >
                  <MenuItem value="SOL">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <SendIcon fontSize="small" />
                      SOL Transfers
                    </Box>
                  </MenuItem>
                  <MenuItem value="SPL">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <SendIcon fontSize="small" />
                      SPL Token Transfers (ATA-aware)
                    </Box>
                  </MenuItem>
                </TextField>
              </Grid>

              {mode === "SPL" && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Token Mint Address"
                    value={mintAddress}
                    onChange={(e) => setMintAddress(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                    helperText="Transfers will be sent from governance wallet’s ATA for this mint."
                  />
                </Grid>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={6}
                  label="Recipients CSV"
                  placeholder={`Example:\n3v7G...abc, 0.25\n9kQ1...xyz, 1.5`}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Box
                  sx={{
                    mx: 0.65,
                    px: 1.5,
                    py: 1,
                    borderRadius: "12px",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                      Preview
                    </Typography>
                    <Typography variant="body2" sx={{ color: "white", fontWeight: 600 }}>
                      {previewCount} recipient(s)
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={
                      mode === "SOL"
                        ? `Total: ${previewTotal.toFixed(4)} SOL`
                        : `Total: ${previewTotal.toFixed(4)} tokens`
                    }
                    sx={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}
                  />
                </Box>
              </Grid>
            </Grid>
          </FormControl>

          {openAdvanced ? (
            <AdvancedProposalView
              governanceAddress={(props.governanceAddress || realm?.pubkey?.toBase58?.()) ?? ""}
              proposalTitle={proposalTitle}
              setProposalTitle={setProposalTitle}
              proposalDescription={proposalDescription}
              setProposalDescription={setProposalDescription}
              toggleGoverningMintSelected={toggleGoverningMintSelected}
              isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
              isGoverningMintSelectable={isGoverningMintSelectable}
              isDraft={isDraft}
              setIsDraft={setIsDraft}
              setEditProposalAddress={() => {}}
              editProposalAddress={null}
            />
          ) : null}

          <Box sx={{ m: 2, textAlign: "center" }}>
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>

          <DialogActions sx={{ display: "flex", justifyContent: "space-between", p: 0, pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              {publicKey ? (
                <Button
                  size="small"
                  onClick={handleAdvancedToggle}
                  sx={{
                    p: 1,
                    borderRadius: "17px",
                    justifyContent: "flex-start",
                    "&:hover .MuiSvgIcon-root.claimIcon": { color: "rgba(255,255,255,0.90)" },
                  }}
                  startIcon={
                    <SettingsIcon
                      className="claimIcon"
                      sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }}
                    />
                  }
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: "flex" }}>
              {publicKey ? (
                <Button
                  autoFocus
                  disabled={loading}
                  onClick={handleBuildBatchTransfer}
                  sx={{
                    p: 1,
                    borderRadius: "17px",
                    "&:hover .MuiSvgIcon-root": { color: "rgba(255,255,255,0.90)" },
                  }}
                  startIcon={<SendIcon sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }} />}
                >
                  Create Batch Proposal
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}