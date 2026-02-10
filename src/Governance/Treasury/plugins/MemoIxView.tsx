"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from "@solana/wallet-adapter-base";
import { styled } from "@mui/material/styles";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  IconButton,
  ListItemIcon,
} from "@mui/material";
import { useSnackbar } from "notistack";

import CodeIcon from "@mui/icons-material/Code";
import NotesIcon from "@mui/icons-material/Notes";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";

import AdvancedProposalView from "./AdvancedProposalView";
import { RPC_CONNECTION } from "../../../utils/grapeTools/constants";

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
          sx={{ position: "absolute", right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
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

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export default function MemoIxView(props: any) {
  const governanceRulesWallet = props.governanceRulesWallet;
  const [editProposalAddress, setEditProposalAddress] = useState(props?.editProposalAddress);

    const useButtonText = props?.useButtonText;
    const useButtonType = props?.useButtonType;
    const realm = props?.realm;
    const governanceAddress = props.governanceAddress || realm.pubkey.toBase58();

    const handleCloseExtMenu = props?.handleCloseExtMenu;
    const expandedLoader = props?.expandedLoader;
    const setExpandedLoader = props?.setExpandedLoader;
    const setInstructions = props?.setInstructions;
    const governanceNativeWallet = props?.governanceNativeWallet;
    const rulesWallet = props?.rulesWallet;
    
  const { publicKey } = useWallet();
  const wallet = useWallet();

  const [open, setOpen] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState(false);

  const [proposalTitle, setProposalTitle] = useState<string | null>("Add Memo");
  const [proposalDescription, setProposalDescription] = useState<string | null>(null);

  const [governingMint, setGoverningMint] = useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = useState(true);
  const [isDraft, setIsDraft] = useState(false);

  const [memoText, setMemoText] = useState<string>("");
  const [memoPreset, setMemoPreset] = useState<string>("custom");

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

  const handleAdvancedToggle = () => setOpenAdvanced((v) => !v);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const presetText = useMemo(() => {
    if (memoPreset === "discussion") return "Discussion: ";
    if (memoPreset === "link") return "Link: ";
    if (memoPreset === "audit") return "Audit Note: ";
    return "";
  }, [memoPreset]);

  useEffect(() => {
    // mirror your existing mint logic
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

  // simulate like your other plugins
  const simulateIx = async (transaction: Transaction): Promise<boolean> => {
    try {
      const { blockhash } = await RPC_CONNECTION.getLatestBlockhash();
      const payerKey = new PublicKey(governanceNativeWallet);
      const message = new TransactionMessage({
        payerKey,
        recentBlockhash: blockhash,
        instructions: transaction.instructions,
      }).compileToV0Message();
      const vtx = new VersionedTransaction(message);
      const simulationResult = await RPC_CONNECTION.simulateTransaction(vtx);
      if (simulationResult.value.err) {
        console.error("Simulation failed:", simulationResult.value.err);
        return false;
      }
      return true;
    } catch (e) {
      console.error("Simulation error:", e);
      return false;
    }
  };

  const buildMemoIx = (text: string) => {
    const data = Buffer.from(text, "utf8");
    return new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [], // Memo program does not require accounts
      data,
    });
  };

  const handleCreateProposal = async () => {
    if (handleCloseExtMenu) handleCloseExtMenu();
    setOpen(false);

    if (!governanceNativeWallet) {
      enqueueSnackbar("Missing governance native wallet", { variant: "error" });
      return;
    }

    const text = (presetText + memoText).trim();
    if (!text) {
      enqueueSnackbar("Please enter a memo", { variant: "error" });
      return;
    }

    // keep memo reasonably sized
    if (text.length > 500) {
      enqueueSnackbar("Memo is too long (max 500 chars)", { variant: "warning" });
      return;
    }

    const ix = buildMemoIx(text);
    const tx = new Transaction().add(ix);

    const ok = await simulateIx(tx);
    if (!ok) {
      enqueueSnackbar("Transaction simulation failed", { variant: "error" });
      return;
    }

    const propIx = {
      title: proposalTitle || "Add Memo",
      description: proposalDescription || `Write an on-chain memo (${text.length} chars)`,
      ix: tx.instructions,
      aix: [],
      nativeWallet: governanceNativeWallet,
      governingMint: governingMint,
        draft: isDraft,
        editProposalAddress: editProposalAddress,
    };

    setInstructions(propIx);
    setExpandedLoader(true);
  };

  return (
    <>
      <Tooltip title="On-chain Memo" placement="right">
        {useButtonText && useButtonType === 1 ? (
          <Button
            onClick={publicKey && handleClickOpen}
            fullWidth
            color="primary"
            size="large"
            variant="contained"
            sx={{ backgroundColor: "rgba(255,255,255,0.05)", pl: 2, pr: 2, ml: 1, mr: 1 }}
            startIcon={<NotesIcon />}
          >
            {useButtonText}
          </Button>
        ) : useButtonText && (useButtonType === 2 || useButtonType === 3) ? (
          <Button
            color={"inherit"}
            variant="text"
            onClick={publicKey && handleClickOpen}
            sx={{
              m: 0,
              p: 0,
              "&:hover .MuiSvgIcon-root": { opacity: 1 },
            }}
            startIcon={<NotesIcon sx={{ color: "rgba(255,255,255,0.25)", opacity: 0, pl: 1, fontSize: "10px" }} />}
          >
            <Typography variant={useButtonType === 2 ? `h5` : `subtitle1`} sx={{ color: "white" }}>
              {useButtonText}
            </Typography>
          </Button>
        ) : (
          <MenuItem onClick={publicKey && handleClickOpen}>
            <ListItemIcon>
                <NotesIcon fontSize="small" style={{ marginRight: 8 }} />
            </ListItemIcon>
            Memo
          </MenuItem>
        )}
      </Tooltip>

      <BootstrapDialog
        fullWidth={true}
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
        <BootstrapDialogTitle id="memo-dialog" onClose={handleClose}>
          On-chain Memo
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: "center", mb: 2 }}>
            Write a small on-chain note (Memo program). Great for links, context, and audit trails.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Preset"
                  value={memoPreset}
                  onChange={(e) => setMemoPreset(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                >
                  <MenuItem value="custom">Custom</MenuItem>
                  <MenuItem value="discussion">Discussion</MenuItem>
                  <MenuItem value="link">Link</MenuItem>
                  <MenuItem value="audit">Audit Note</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Memo"
                  multiline
                  minRows={3}
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                  helperText={`${(presetText + memoText).trim().length}/500 chars`}
                  InputProps={{
                    startAdornment: presetText ? (
                      <InputAdornment position="start">
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)" }}>
                          {presetText}
                        </Typography>
                      </InputAdornment>
                    ) : undefined,
                  }}
                />
              </Grid>
            </Grid>
          </FormControl>

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
                  startIcon={<SettingsIcon className="claimIcon" sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }} />}
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: "flex", p: 0 }}>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={handleCreateProposal}
                  sx={{
                    p: 1,
                    borderRadius: "17px",
                    "&:hover .MuiSvgIcon-root": { color: "rgba(255,255,255,0.90)" },
                  }}
                  startIcon={<NotesIcon sx={{ color: "rgba(255,255,255,0.25)", fontSize: "14px!important" }} />}
                >
                  Create Memo Instruction
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}