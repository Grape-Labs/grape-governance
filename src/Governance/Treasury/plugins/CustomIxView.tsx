// /src/Governance/Treasury/plugins/CustomIxView.tsx
// DROP-IN replacement for your existing CustomIxView.tsx
//
// What this improves:
// - Safer decoding (no crashes on bad input)
// - Supports multiple input shapes:
//    1) SPL-Governance base64-serialized instruction (getInstructionDataFromBase64)  ✅
//    2) Base64-serialized Solana Transaction (legacy) or VersionedTransaction       ✅ (best-effort)
// - Shows a preview + lightweight “linter” warnings before creating the proposal
// - Simulates before proceeding, and blocks if simulation fails
//
// Notes:
// - No new dependencies required.
// - Keeps your props/signature/AdvancedProposalView integration intact.

import { AnchorProvider, web3 } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  Transaction,
  VersionedTransaction,
  TransactionInstruction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token-v2";
import moment from "moment";
import axios from "axios";

import {
  getInstructionDataFromBase64,
} from "@solana/spl-governance";

import { RPC_CONNECTION } from "../../../utils/grapeTools/constants";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import React, { useCallback } from "react";
import { styled } from "@mui/material/styles";

import {
  Chip,
  Typography,
  Button,
  Grid,
  Box,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
  TextField,
  FormControl,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material/";

import { useSnackbar } from "notistack";

import CodeIcon from "@mui/icons-material/Code";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import IconButton from "@mui/material/IconButton";

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
  "& .MuDialogContent-root": {
    padding: theme.spacing(2),
  },
  "& .MuDialogActions-root": {
    padding: theme.spacing(1),
  },
}));

/* -----------------------------------------
   Helpers (safe decode + light lint)
----------------------------------------- */

function isProbablyBase64(s: string) {
  // allow URL-safe too
  const t = (s || "").trim().replace(/\s/g, "");
  if (!t) return false;
  if (t.length < 16) return false;
  if (t.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(t);
}

function safeBase64ToBuffer(s: string): Buffer | null {
  try {
    const t = (s || "").trim().replace(/\s/g, "");
    if (!isProbablyBase64(t)) return null;
    // normalize url-safe base64
    const norm = t.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(norm, "base64");
  } catch {
    return null;
  }
}

function shortPk(pk: string, n = 6) {
  if (!pk) return "";
  if (pk.length <= n * 2 + 3) return pk;
  return `${pk.slice(0, n)}…${pk.slice(-n)}`;
}

function toNum(x: any): number | null {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function summarizeKnownProgram(programId: PublicKey) {
  const pid = programId.toBase58();
  if (pid === SystemProgram.programId.toBase58()) return "System Program";
  if (pid === TOKEN_PROGRAM_ID.toBase58()) return "SPL Token Program";
  if (pid === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()) return "Associated Token Program";
  if (pid === ComputeBudgetProgram.programId.toBase58()) return "Compute Budget Program";
  return "Unknown Program";
}

type DecodedPreview = {
  kind: "governance_ix" | "legacy_tx" | "versioned_tx";
  instructions: TransactionInstruction[];
  primaryProgramId?: string;
  accountsTouched: number;
  signers: number;
  writables: number;
  dataBytes: number;
  warnings: string[];
  titleHint?: string;
  descriptionHint?: string;
};

function lintInstructions(ixs: TransactionInstruction[]): string[] {
  const warnings: string[] = [];

  // Basic sanity
  if (!ixs.length) warnings.push("No instructions found.");

  // Count characteristics
  let signers = 0;
  let writables = 0;
  let acctTotal = 0;

  for (const ix of ixs) {
    acctTotal += ix.keys?.length || 0;
    for (const k of ix.keys || []) {
      if (k.isSigner) signers += 1;
      if (k.isWritable) writables += 1;
    }
  }

  if (ixs.length > 10) warnings.push(`Large payload: ${ixs.length} instructions (may exceed governance limits).`);
  if (acctTotal > 60) warnings.push(`Touches many accounts (${acctTotal}). Double-check what’s being modified.`);
  if (writables > 20) warnings.push(`Many writable accounts (${writables}). Riskier transaction.`);
  if (signers > 5) warnings.push(`Many signer accounts (${signers}). Ensure the governance can satisfy these signers.`);

  // Simple “suspicious” check: unknown program + lots of writables
  const unknownHeavy = ixs.some((ix) => summarizeKnownProgram(ix.programId) === "Unknown Program" && (ix.keys?.length || 0) >= 10);
  if (unknownHeavy) warnings.push("Contains an unknown program instruction with many accounts. Verify programId + accounts.");

  return warnings;
}

function computePreview(ixs: TransactionInstruction[], kind: DecodedPreview["kind"], titleHint?: string, descriptionHint?: string): DecodedPreview {
  let signers = 0;
  let writables = 0;
  let accountsTouched = 0;
  let dataBytes = 0;

  for (const ix of ixs) {
    accountsTouched += ix.keys?.length || 0;
    dataBytes += ix.data?.length || 0;
    for (const k of ix.keys || []) {
      if (k.isSigner) signers += 1;
      if (k.isWritable) writables += 1;
    }
  }

  const warnings = lintInstructions(ixs);
  const primaryProgramId = ixs[0]?.programId?.toBase58?.() || undefined;

  return {
    kind,
    instructions: ixs,
    primaryProgramId,
    accountsTouched,
    signers,
    writables,
    dataBytes,
    warnings,
    titleHint,
    descriptionHint,
  };
}

async function decodeInputToInstructions(input: string): Promise<{ preview: DecodedPreview | null; error?: string }> {
  const raw = (input || "").trim();
  if (!raw) return { preview: null };

  // 1) Try SPL-Governance base64 serialized instruction
  // This is your primary desired format.
  try {
    const ix = getInstructionDataFromBase64(raw);
    if (ix?.programId && ix?.accounts && ix?.data != null) {
      const txIx = new TransactionInstruction({
        keys: ix.accounts,
        data: Buffer.from(ix.data),
        programId: ix.programId,
      });

      const titleHint = "Custom Instruction";
      const descriptionHint = `Custom instruction plugin • ${txIx.data?.length || 0} bytes • ${summarizeKnownProgram(txIx.programId)}`;
      return { preview: computePreview([txIx], "governance_ix", titleHint, descriptionHint) };
    }
  } catch {
    // ignore and fall through
  }

  // 2) Try base64 serialized legacy Transaction (wire)
  const buf = safeBase64ToBuffer(raw);
  if (buf) {
    // 2a) Legacy Transaction
    try {
      const legacy = Transaction.from(buf);
      const ixs = legacy.instructions || [];
      if (ixs.length) {
        const titleHint = "Custom Transaction (Legacy)";
        const descriptionHint = `Legacy transaction • ${ixs.length} instruction(s) • ${moment().format("YYYY-MM-DD HH:mm")}`;
        return { preview: computePreview(ixs, "legacy_tx", titleHint, descriptionHint) };
      }
    } catch {
      // ignore
    }

    // 2b) Versioned Transaction
    try {
      const u8 = Uint8Array.from(buf);
      const vtx = VersionedTransaction.deserialize(u8);
      // Decompile message into TransactionInstructions (best-effort)
      // NOTE: If address table lookups are used, decompile still works only if addresses are resolvable in message.
      try {
        const msg = TransactionMessage.decompile(vtx.message);
        const ixs = msg.instructions || [];
        if (ixs.length) {
          const titleHint = "Custom Transaction (v0)";
          const descriptionHint = `Versioned transaction • ${ixs.length} instruction(s) • ${moment().format("YYYY-MM-DD HH:mm")}`;
          return { preview: computePreview(ixs, "versioned_tx", titleHint, descriptionHint) };
        }
      } catch {
        // If decompile fails, still allow a generic preview
        return { preview: null, error: "Decoded a versioned transaction, but could not decompile its instructions (likely address tables). Paste a governance-serialized instruction instead." };
      }
    } catch {
      // ignore
    }
  }

  return { preview: null, error: "Could not decode. Paste a SPL-Governance base64 serialized instruction (recommended), or a base64 serialized transaction." };
}

/* -----------------------------------------
   Component
----------------------------------------- */

export default function CustomIxView(props: any) {
  const governanceLookup = props.governanceLookup;
  const governanceRulesWallet = props.governanceRulesWallet;
  const [editProposalAddress, setEditProposalAddress] = React.useState(props?.editProposalAddress);

  const preSelectedTokenAta = props?.preSelectedTokenAta;
  const useButtonText = props?.useButtonText;
  const useButtonType = props?.useButtonType;

  const usdcValue = props?.usdcValue;
  const realm = props?.realm;
  const governanceAddress = props.governanceAddress || realm.pubkey.toBase58();
  const rulesWallet = props?.rulesWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const governanceNativeWallet = props?.governanceNativeWallet;
  const { publicKey } = useWallet();
  const wallet = useWallet();

  const [open, setPropOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>(null);
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const [customIx, setCustomIx] = React.useState<string>("");
  const [decoding, setDecoding] = React.useState(false);
  const [decodeError, setDecodeError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<DecodedPreview | null>(null);

  const { enqueueSnackbar } = useSnackbar();

  const onError = useCallback(
    (error: WalletError) => {
      enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: "error" });
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

  const handleAdvancedToggle = () => {
    setOpenAdvanced((v) => !v);
  };

  const handleCloseDialog = () => {
    setPropOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const handleClickOpen = () => {
    setPropOpen(true);
  };

  const handleClose = () => {
    setPropOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  // Helper function to split instructions into chunks
  const chunkInstructions = (instructions: TransactionInstruction[], chunkSize: number) => {
    const chunks: TransactionInstruction[][] = [];
    for (let i = 0; i < instructions.length; i += chunkSize) {
      chunks.push(instructions.slice(i, i + chunkSize));
    }
    return chunks;
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
          console.error("Chunk simulation failed with error:", simulationResult.value.err);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Error simulating large transaction:", error);
      return false;
    }
  };

  // Decode whenever input changes (debounced)
  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const val = (customIx || "").trim();
      if (!val) {
        setDecodeError(null);
        setPreview(null);
        setProposalTitle(null);
        setProposalDescription(null);
        return;
      }

      setDecoding(true);
      setDecodeError(null);

      const { preview, error } = await decodeInputToInstructions(val);

      if (!alive) return;

      setPreview(preview);
      setDecodeError(error || null);

      if (preview) {
        setProposalTitle((prev) => prev ?? preview.titleHint ?? "Custom Instruction");
        setProposalDescription((prev) => prev ?? preview.descriptionHint ?? `Custom instruction • ${moment().format("YYYY-MM-DD HH:mm")}`);
      } else {
        // if invalid input, keep advanced closed unless user opened it explicitly
        // (don’t auto-close if already open; that’s annoying)
      }

      setDecoding(false);
    }, 350);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [customIx]);

  const handleProposalIx = async () => {
    if (handleCloseExtMenu) handleCloseExtMenu();
    setPropOpen(false);

    if (!governanceNativeWallet) {
      enqueueSnackbar("Missing governanceNativeWallet", { variant: "error" });
      return;
    }

    if (!preview || !preview.instructions?.length) {
      enqueueSnackbar("Paste a valid serialized instruction first.", { variant: "warning" });
      return;
    }

    try {
      const ixsTx = new Transaction().add(...preview.instructions);

      // simulate and BLOCK if fails
      const ok = await simulateIx(ixsTx);
      if (!ok) {
        enqueueSnackbar("Simulation failed — check instruction/program/accounts.", { variant: "error" });
        return;
      }

      const propIx = {
        title: proposalTitle || preview.titleHint || "Custom Instruction",
        description: proposalDescription || preview.descriptionHint || "Custom instruction via Custom Ix plugin",
        ix: ixsTx.instructions,
        aix: [], // keep your field shape
        nativeWallet: governanceNativeWallet,
        governingMint: governingMint,
        draft: isDraft,
      };

      console.log("propIx:", JSON.stringify(propIx));
      setInstructions(propIx);
      setExpandedLoader(true);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || "Failed to create proposal instruction", { variant: "error" });
    }
  };

  React.useEffect(() => {
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

  return (
    <>
      <Tooltip title="Custom Ix" placement="right">
        {useButtonText && useButtonType === 1 ? (
          <Button
            onClick={publicKey && handleClickOpen}
            fullWidth
            color="primary"
            size="large"
            variant="contained"
            sx={{ backgroundColor: "rgba(255,255,255,0.05)", pl: 2, pr: 2, ml: 1, mr: 1 }}
          >
            {useButtonText}
          </Button>
        ) : (
          <>
            {useButtonText && (useButtonType === 2 || useButtonType === 3) ? (
              <Button
                color={"inherit"}
                variant="text"
                onClick={publicKey && handleClickOpen}
                sx={{
                  m: 0,
                  p: 0,
                  "&:hover .MuiSvgIcon-root": { opacity: 1 },
                }}
                startIcon={
                  <CodeIcon
                    fontSize={"small"}
                    sx={{
                      color: "rgba(255,255,255,0.25)",
                      opacity: 0,
                      pl: 1,
                      fontSize: "10px",
                    }}
                  />
                }
              >
                <Typography variant={useButtonType === 2 ? `h5` : `subtitle1`} sx={{ color: "white" }}>
                  {useButtonText}
                </Typography>
              </Button>
            ) : (
              <MenuItem onClick={publicKey && handleClickOpen}>
                <ListItemIcon>
                  <CodeIcon fontSize="small" />
                </ListItemIcon>
                Custom Ix
              </MenuItem>
            )}
          </>
        )}
      </Tooltip>

      <BootstrapDialog
        fullWidth={true}
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
        <BootstrapDialogTitle id="extensions-dialog" onClose={handleCloseDialog}>
          Custom Ix
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: "center" }}>
            Paste a base64-serialized governance instruction (recommended) or a base64 transaction.
          </DialogContentText>

          <FormControl fullWidth sx={{ mt: 2, mb: 1 }}>
            <Grid xs={12}>
              <FormControl fullWidth>
                <TextField
                  fullWidth
                  label="Base64 encoded instruction (recommended) or base64 transaction"
                  id="customIx"
                  type="text"
                  value={customIx}
                  onChange={(e) => setCustomIx(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
              </FormControl>
            </Grid>
          </FormControl>

          {/* Decode / Preview */}
          {decoding ? (
            <Box sx={{ mt: 1, mb: 1 }}>
              <LinearProgress />
              <Typography variant="caption" sx={{ mt: 1, display: "block", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
                Decoding…
              </Typography>
            </Box>
          ) : decodeError ? (
            <Box sx={{ mt: 1 }}>
              <Chip label={decodeError} color="warning" variant="outlined" sx={{ maxWidth: "100%" }} />
            </Box>
          ) : preview ? (
            <Box sx={{ mt: 1, mb: 1 }}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: "12px",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Typography variant="subtitle2" sx={{ color: "rgba(255,255,255,0.8)" }}>
                  Preview
                </Typography>

                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)", display: "block", mt: 0.5 }}>
                  Type: {preview.kind} • Instructions: {preview.instructions.length} • Program:{" "}
                  {preview.primaryProgramId ? `${shortPk(preview.primaryProgramId, 8)} (${summarizeKnownProgram(new PublicKey(preview.primaryProgramId))})` : "N/A"}
                </Typography>

                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)", display: "block", mt: 0.5 }}>
                  Accounts touched: {preview.accountsTouched} • Writables: {preview.writables} • Signers: {preview.signers} • Data: {preview.dataBytes} bytes
                </Typography>

                {preview.warnings?.length ? (
                  <>
                    <Divider sx={{ my: 1, borderColor: "rgba(255,255,255,0.08)" }} />
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", display: "block", mb: 0.5 }}>
                      Safety checks
                    </Typography>
                    <List dense sx={{ p: 0 }}>
                      {preview.warnings.slice(0, 6).map((w, i) => (
                        <ListItem key={i} sx={{ py: 0.25 }}>
                          <ListItemText
                            primary={
                              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.55)" }}>
                                • {w}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </>
                ) : null}
              </Box>
            </Box>
          ) : null}

          {openAdvanced ? (
            <AdvancedProposalView
              governanceAddress={governanceAddress}
              proposalTitle={proposalTitle}
              setProposalTitle={setProposalTitle}
              proposalDescription={proposalDescription}
              setProposalDescription={setProposalDescription}
              toggleGoverningMintSelected={toggleGoverningMintSelected}
              isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
              isGoverningMintSelectable={isGoverningMintSelectable}
              isDraft={isDraft}
              setIsDraft={setIsDraft}
              setEditProposalAddress={setEditProposalAddress}
              editProposalAddress={editProposalAddress}
            />
          ) : null}

          <Box alignItems={"center"} alignContent={"center"} justifyContent={"center"} sx={{ m: 2, textAlign: "center" }}>
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>

          <DialogActions sx={{ display: "flex", justifyContent: "space-between", p: 0, pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", p: 0 }}>
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
                      sx={{
                        color: "rgba(255,255,255,0.25)",
                        fontSize: "14px!important",
                      }}
                    />
                  }
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: "flex", p: 0 }}>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={handleProposalIx}
                  disabled={!preview || !preview.instructions?.length}
                  sx={{
                    p: 1,
                    borderRadius: "17px",
                    "&:hover .MuiSvgIcon-root.claimNowIcon": { color: "rgba(255,255,255,0.90)" },
                  }}
                  startIcon={
                    <CodeIcon
                      sx={{
                        color: "rgba(255,255,255,0.25)",
                        fontSize: "14px!important",
                      }}
                    />
                  }
                >
                  Create with Custom Instruction
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}