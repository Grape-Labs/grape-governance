import { web3 } from "@coral-xyz/anchor";
import React, { useCallback } from "react";
import axios from "axios";

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  Typography,
  Button,
  Grid,
  Box,
  Tooltip,
  DialogTitle,
  Dialog,
  DialogContent,
  DialogContentText,
  DialogActions,
  MenuItem,
  TextField,
  FormControl,
  InputAdornment,
  IconButton,
  Switch,
  FormControlLabel,
  Chip,
  ListItemIcon,
} from "@mui/material/";

import { styled } from "@mui/material/styles";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import { useSnackbar } from "notistack";

import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";

import AdvancedProposalView from "./AdvancedProposalView";
import { RPC_CONNECTION } from "../../../utils/grapeTools/constants";

// -------------------- Dialog header --------------------
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

// -------------------- Helpers --------------------
const SOL_MINT = "So11111111111111111111111111111111111111112"; // wSOL mint
const isPk = (s: string) => {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
};

const decodeJupIx = (ix: any) => {
  // Jupiter returns: { programId, accounts: [{pubkey,isSigner,isWritable}], data (base64) }
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: (ix.accounts || []).map((k: any) => ({
      pubkey: new PublicKey(k.pubkey),
      isSigner: !!k.isSigner,
      isWritable: !!k.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
};

async function getMintDecimals(mint: string): Promise<number> {
  // SOL/wSOL is 9 decimals
  if (mint === SOL_MINT) return 9;

  const pk = new PublicKey(mint);
  const ai = await RPC_CONNECTION.getParsedAccountInfo(pk);
  const parsed: any = ai?.value?.data;
  const dec = parsed?.parsed?.info?.decimals;

  if (typeof dec === "number") return dec;

  // Fallback (should not happen for real mint accounts)
  return 9;
}

const JUP_API_KEY = process.env.APP_JUP_API_KEY?.trim();

// if you have an API key, use api.jup.ag; otherwise use lite-api.jup.ag
const JUP_BASE = JUP_API_KEY ? "https://api.jup.ag" : "https://lite-api.jup.ag";

const JUP = {
  quoteUrl: `${JUP_BASE}/swap/v1/quote`,
  // keep your swap-instructions URL aligned with the same base:
  swapInstructionsUrl: `${JUP_BASE}/swap/v1/swap-instructions`,
  priceV3Url: `${JUP_BASE}/price/v3`, // (only for prices, not quote)
};

const jupHeaders = () => (JUP_API_KEY ? { "x-api-key": JUP_API_KEY } : {});

export default function JupiterSwapView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceNativeWallet = props?.governanceNativeWallet;

  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;
  const [editProposalAddress, setEditProposalAddress] = React.useState(props?.editProposalAddress);

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>(null);
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  // Swap form
  const [inputMint, setInputMint] = React.useState<string>(SOL_MINT);
  const [outputMint, setOutputMint] = React.useState<string>("");
  const [uiAmount, setUiAmount] = React.useState<string>("0.01");
  const [slippageBps, setSlippageBps] = React.useState<string>("50");
  const [wrapUnwrapSol, setWrapUnwrapSol] = React.useState<boolean>(true);
  const [onlyDirectRoutes, setOnlyDirectRoutes] = React.useState<boolean>(false);

  const [quoteSummary, setQuoteSummary] = React.useState<any>(null);
  const [loadingQuote, setLoadingQuote] = React.useState(false);

  const onError = useCallback(
    (error: WalletError) => {
      enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: "error" });
      console.error(error);
    },
    [enqueueSnackbar]
  );

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };
  const handleCloseDialog = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };
  const handleAdvancedToggle = () => setOpenAdvanced((v) => !v);

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account.config.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.communityMint);
    }
  };

  React.useEffect(() => {
    setIsGoverningMintSelectable(false);
    if (realm && realm?.account.config?.councilMint) {
      setGoverningMint(realm?.account.config.councilMint);
      setIsGoverningMintCouncilSelected(true);
      if (realm && realm?.account?.communityMint) {
        if (Number(rulesWallet.account.config.minCommunityTokensToCreateProposal) !== 18446744073709551615) {
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

  // ---- your existing chunk + simulate pattern (no ALT support here) ----
  const chunkInstructions = (instructions: TransactionInstruction[], chunkSize: number) => {
    const chunks: TransactionInstruction[][] = [];
    for (let i = 0; i < instructions.length; i += chunkSize) chunks.push(instructions.slice(i, i + chunkSize));
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
          console.error("Chunk simulation failed:", simulationResult.value.err);
          return false;
        }
      }
      return true;
    } catch (e) {
      console.error("simulateIx error:", e);
      return false;
    }
  };

  const normalizeMint = (m: string) => {
    const t = (m || "").trim();
    if (!t) return "";
    if (t.toLowerCase() === "sol") return SOL_MINT;
    return t;
  };

  const fetchQuote = async () => {
  if (!governanceNativeWallet) return;

  const inMint = normalizeMint(inputMint);
  const outMint = normalizeMint(outputMint);

  if (!isPk(inMint) || !isPk(outMint)) {
    enqueueSnackbar("Invalid mint(s). Use 'SOL' or a valid mint address.", { variant: "warning" });
    return;
  }

  const amt = Number(uiAmount);
  if (!Number.isFinite(amt) || amt <= 0) {
    enqueueSnackbar("Enter a valid amount > 0", { variant: "warning" });
    return;
  }

  setLoadingQuote(true);
  setQuoteSummary(null);

  try {
    const [inDec, outDec] = await Promise.all([getMintDecimals(inMint), getMintDecimals(outMint)]);
    const amountRaw = Math.floor(amt * Math.pow(10, inDec));
    const slip = Math.max(1, Math.min(5000, parseInt(slippageBps || "50", 10) || 50));

    const { data: quote } = await axios.get(JUP.quoteUrl, {
      params: {
        inputMint: inMint,
        outputMint: outMint,
        amount: amountRaw,            // uint64 in the spec; number is fine unless huge
        slippageBps: slip,            // uint16
        swapMode: "ExactIn",          // default per spec, but explicit is nice
        onlyDirectRoutes: onlyDirectRoutes, // boolean (don’t send "true"/"false" strings)
        // restrictIntermediateTokens: true, // default true per spec
        // maxAccounts: 20,
        // instructionVersion: "V1", // default
      },
      headers: jupHeaders(),
      timeout: 15_000,
    });

    if (!quote || (quote as any).error) {
      throw new Error((quote as any)?.error || "Quote failed");
    }

    const outAmountRaw = Number(quote.outAmount || 0);
    const outUi = outAmountRaw / Math.pow(10, outDec);

    setQuoteSummary({
      quote,
      inDec,
      outDec,
      amountRaw,
      outAmountRaw,
      outUi,
      routeCount: (quote.routePlan || []).length,
    });

    setProposalTitle("Jupiter Swap");
    setProposalDescription(
      `Swap ${amt} (${inMint === SOL_MINT ? "SOL" : inMint.slice(0, 4) + "..."}) → ` +
        `${outMint === SOL_MINT ? "SOL" : outMint.slice(0, 4) + "..."} (slippage ${slip} bps)`
    );
  } catch (e: any) {
    console.error(e);
    enqueueSnackbar(`Quote failed: ${e?.message || "unknown error"}`, { variant: "error" });
  } finally {
    setLoadingQuote(false);
  }
};

  const buildProposalFromQuote = async () => {
    if (!governanceNativeWallet) return;
    if (!quoteSummary?.quote) {
      enqueueSnackbar("Fetch a quote first", { variant: "warning" });
      return;
    }

    try {
      const quoteResponse = quoteSummary.quote;

      // Build instructions (preferred for composability)
    const { data: swapIxs } = await axios.post(
    JUP.swapInstructionsUrl,
    {
        quoteResponse,
        userPublicKey: governanceNativeWallet,
        wrapAndUnwrapSol: wrapUnwrapSol,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
    },
    {
        headers: { "Content-Type": "application/json", ...jupHeaders() },
        timeout: 20_000,
    }
    );

      if (!swapIxs || swapIxs.error) {
        throw new Error(swapIxs?.error || "swap-instructions failed");
      }

      const {
        tokenLedgerInstruction,
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction,
        cleanupInstruction,
        addressLookupTableAddresses,
      } = swapIxs;

      // NOTE: Your proposal pipeline appears to store raw TransactionInstructions.
      // swap-instructions can include ALTs; if present, warn because your simulate/build path doesn't include ALT accounts.
      if (Array.isArray(addressLookupTableAddresses) && addressLookupTableAddresses.length > 0) {
        enqueueSnackbar(
          `Warning: Jupiter returned ${addressLookupTableAddresses.length} Address Lookup Tables. If the proposal builder doesn't support ALTs, this swap may fail. Try smaller routes or onlyDirectRoutes.`,
          { variant: "warning" }
        );
      }

      const ixList: TransactionInstruction[] = [];

      if (tokenLedgerInstruction) ixList.push(decodeJupIx(tokenLedgerInstruction));
      (computeBudgetInstructions || []).forEach((ix: any) => ixList.push(decodeJupIx(ix)));
      (setupInstructions || []).forEach((ix: any) => ixList.push(decodeJupIx(ix)));
      if (swapInstruction) ixList.push(decodeJupIx(swapInstruction));
      if (cleanupInstruction) ixList.push(decodeJupIx(cleanupInstruction));

      if (ixList.length === 0) {
        throw new Error("No instructions returned by Jupiter");
      }

      const tx = new Transaction().add(...ixList);
      const ok = await simulateIx(tx);
      if (!ok) {
        enqueueSnackbar("Simulation failed. Try onlyDirectRoutes, increase slippage slightly, or reduce route complexity.", {
          variant: "error",
        });
        return;
      }

      if (handleCloseExtMenu) handleCloseExtMenu();
      setOpen(false);

      const propIx = {
        title: proposalTitle || "Jupiter Swap",
        description: proposalDescription || "Jupiter swap via Metis Swap API",
        ix: ixList,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint: governingMint,
        draft: isDraft,
        editProposalAddress: editProposalAddress,
      };

      setInstructions(propIx);
      setExpandedLoader(true);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(`Failed to build swap: ${e?.message || "unknown error"}`, { variant: "error" });
    }
  };

  return (
    <>
      <Tooltip title="Jupiter Swap" placement="right">
        <MenuItem onClick={publicKey && handleClickOpen}>
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          Jupiter Swap
        </MenuItem>
      </Tooltip>

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
        <BootstrapDialogTitle id="jup-swap-dialog" onClose={handleCloseDialog}>
          Jupiter Swap (Non-DCA)
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: "center", mb: 2 }}>
            Build a governance proposal that executes a Jupiter swap.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Input Mint (or 'SOL')"
                  value={inputMint}
                  onChange={(e) => setInputMint(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Output Mint"
                  value={outputMint}
                  onChange={(e) => setOutputMint(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount (UI units)"
                  type="number"
                  value={uiAmount}
                  onChange={(e) => setUiAmount(e.target.value)}
                  variant="filled"
                  inputProps={{ min: "0", step: "0.000001" }}
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Slippage (bps)"
                  type="number"
                  value={slippageBps}
                  onChange={(e) => setSlippageBps(e.target.value)}
                  variant="filled"
                  inputProps={{ min: "1", step: "1" }}
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: "flex", gap: 2, alignItems: "center", px: 0.65 }}>
                  <FormControlLabel
                    control={<Switch checked={wrapUnwrapSol} onChange={(e) => setWrapUnwrapSol(e.target.checked)} />}
                    label={<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Wrap/Unwrap SOL</Typography>}
                  />
                  <FormControlLabel
                    control={<Switch checked={onlyDirectRoutes} onChange={(e) => setOnlyDirectRoutes(e.target.checked)} />}
                    label={<Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Only Direct Routes</Typography>}
                  />
                </Box>
              </Grid>

              {quoteSummary ? (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      mx: 0.65,
                      p: 1.25,
                      borderRadius: "12px",
                      backgroundColor: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                        Quote summary
                      </Typography>
                      <Chip
                        size="small"
                        label={`${quoteSummary.routeCount} route hops`}
                        sx={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
                      />
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5, color: "white" }}>
                      Est. output: ~{Number(quoteSummary.outUi || 0).toFixed(6)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.4)" }}>
                      If simulation fails, try Only Direct Routes or reduce route complexity.
                    </Typography>
                  </Box>
                </Grid>
              ) : null}
            </Grid>
          </FormControl>

          {openAdvanced ? (
            <AdvancedProposalView
              governanceAddress={props.governanceAddress || realm.pubkey.toBase58()}
              proposalTitle={proposalTitle}
              setProposalTitle={setProposalTitle}
              proposalDescription={proposalDescription}
              setProposalDescription={setProposalDescription}
              toggleGoverningMintSelected={toggleGoverningMintSelected}
              isGoverningMintCouncilSelected={isGoverningMintCouncilSelected}
              isGoverningMintSelectable={isGoverningMintSelectable}
              isDraft={isDraft}
              setIsDraft={setIsDraft}
              setEditProposalAddress={props.setEditProposalAddress || (() => {})}
              editProposalAddress={props.editProposalAddress}
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
                  sx={{ p: 1, borderRadius: "17px", justifyContent: "flex-start" }}
                  startIcon={<SettingsIcon sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }} />}
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: "flex", gap: 1 }}>
              {publicKey ? (
                <>
                  <Button
                    size="small"
                    onClick={fetchQuote}
                    disabled={loadingQuote}
                    sx={{ p: 1, borderRadius: "17px" }}
                    startIcon={<SwapHorizIcon sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }} />}
                  >
                    {loadingQuote ? "Quoting..." : "Get Quote"}
                  </Button>

                  <Button
                    size="small"
                    onClick={buildProposalFromQuote}
                    disabled={!quoteSummary?.quote}
                    sx={{ p: 1, borderRadius: "17px" }}
                    startIcon={<SwapHorizIcon sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }} />}
                  >
                    Create Swap Proposal
                  </Button>
                </>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}