// src/utils/governanceTools/votes/VetoVote.tsx
//
// Drop-in “Council veto” row + canonical Veto Vote builder for SPL-Governance.
// Designed to look good in the right-side “More Info” panel (same style as Export).
//
// Usage (place above Export section):
//   <VetoVoteRow
//     realm={realm}
//     proposal={thisitem}
//     memberMap={memberMap}
//     councilVoterRecord={councilVoterRecord} // optional, speeds it up
//     publicKey={publicKey}
//     sendTransaction={sendTransaction}
//     getVotingParticipants={getVotingParticipants}
//   />

import React from "react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Vote, VoteKind, withCastVote } from "@solana/spl-governance";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Tooltip,
  Typography,
  CircularProgress,
} from "@mui/material";

import GavelIcon from "@mui/icons-material/Gavel";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { RPC_CONNECTION, BLACKLIST_WALLETS } from "../utils/grapeTools/constants";
import { getGrapeGovernanceProgramVersion, shortenString } from "../utils/grapeTools/helpers";
import { getAllTokenOwnerRecordsIndexed } from "../Governance/api/queries";
import { useSnackbar } from "notistack";

// ----------------------------
// Types
// ----------------------------
export type VetoVote = Vote;

type AnyRealm = any;
type AnyProposal = any;

export type VetoVoteRowProps = {
  realm: AnyRealm;
  proposal: AnyProposal;

  memberMap?: any[] | null;
  councilVoterRecord?: any | null;

  publicKey: PublicKey | null;
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>;
  getVotingParticipants?: () => void;

  // UI
  title?: string;
  caption?: string;
};

// ----------------------------
// Canonical VETO vote builder
// ----------------------------
export function makeVetoVote(): VetoVote {
  return new Vote({
    voteType: VoteKind.Veto,
    approveChoices: undefined,
    deny: undefined,
    veto: true,
  });
}

// ----------------------------
// Guards
// ----------------------------
function getCouncilMint58(realm: AnyRealm): string {
  return realm?.account?.config?.councilMint?.toBase58?.() || "";
}

function getProposalMint58(proposal: AnyProposal): string {
  return proposal?.account?.governingTokenMint?.toBase58?.() || "";
}

function isVotingState(proposal: AnyProposal): boolean {
  return proposal?.account?.state === 2;
}

function canShowVeto(realm: AnyRealm, proposal: AnyProposal, walletPk58?: string) {
  const councilMint58 = getCouncilMint58(realm);
  if (!councilMint58) return false;

  const proposalMint58 = getProposalMint58(proposal);
  if (!proposalMint58) return false;

  // Veto is only meaningful when proposal is COMMUNITY (i.e. not council-mint proposal)
  if (proposalMint58 === councilMint58) return false;

  if (!isVotingState(proposal)) return false;
  if (!walletPk58) return false;

  return true;
}

// ----------------------------
// Component
// ----------------------------
export function VetoVoteRow(props: VetoVoteRowProps) {
  const {
    realm,
    proposal,
    memberMap,
    councilVoterRecord,
    publicKey,
    sendTransaction,
    getVotingParticipants,
    title = "Council veto",
    caption = "Council-only action for community proposals",
  } = props;

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const [openConfirm, setOpenConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const walletPk58 = publicKey?.toBase58?.();
  const isBlacklisted = !!walletPk58 && BLACKLIST_WALLETS.includes(walletPk58);

  // Don’t render unless it applies
  if (!canShowVeto(realm, proposal, walletPk58)) return null;

  const councilMint58 = getCouncilMint58(realm);

  const handleVetoVote = async () => {
    try {
      if (!publicKey) {
        enqueueSnackbar("Wallet not connected.", { variant: "error" });
        return;
      }
      if (isBlacklisted) {
        enqueueSnackbar("An error occured, please try again later!", { variant: "error" });
        return;
      }

      setBusy(true);

      // Load TORs if needed
      let rawTokenOwnerRecords: any[] = Array.isArray(memberMap) ? memberMap : [];
      if (!rawTokenOwnerRecords.length) {
        rawTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(
          new PublicKey(realm.pubkey).toBase58(),
          new PublicKey(realm.owner).toBase58(),
          walletPk58
        );
      }

      // Council TOR for THIS wallet
      const councilMe =
        councilVoterRecord ||
        rawTokenOwnerRecords.find(
          (item: any) =>
            item?.account?.governingTokenOwner?.toBase58?.() === walletPk58 &&
            item?.account?.governingTokenMint?.toBase58?.() === councilMint58
        );

      if (!councilMe) {
        enqueueSnackbar("You do not have council veto power.", { variant: "error" });
        return;
      }

      const cnfrmkey = enqueueSnackbar("Preparing council veto…", {
        variant: "info",
        persist: true,
      });

      const programId = new PublicKey(realm.owner);
      const realmPk = new PublicKey(realm.pubkey);

      const programVersion = await getGrapeGovernanceProgramVersion(
        RPC_CONNECTION,
        programId,
        realmPk
      );

      const instructions: TransactionInstruction[] = [];

      await withCastVote(
        instructions,
        programId,
        programVersion,
        realmPk,
        new PublicKey(proposal.account.governance),
        new PublicKey(proposal.pubkey),
        new PublicKey(proposal.account.tokenOwnerRecord), // proposal owner record (community)
        new PublicKey(councilMe.pubkey),                  // voter TOR (council)
        publicKey,                                        // governanceAuthority
        new PublicKey(councilMint58),                      // voteGoverningTokenMint (council mint)
        makeVetoVote(),                                   // vote
        publicKey                                         // payer
      );

      const tx = new Transaction().add(...instructions);
      const { blockhash, lastValidBlockHeight } =
        await RPC_CONNECTION.getLatestBlockhash("confirmed");

      tx.feePayer = publicKey;
      tx.recentBlockhash = blockhash;

      const sig = await sendTransaction(tx, RPC_CONNECTION, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      await RPC_CONNECTION.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      closeSnackbar(cnfrmkey);

      enqueueSnackbar("Council veto submitted.", {
        variant: "success",
        action: () => (
          <Button
            href={`https://explorer.solana.com/tx/${sig}`}
            target="_blank"
            sx={{ color: "white" }}
          >
            {shortenString(sig, 5, 5)}
          </Button>
        ),
      });

      setOpenConfirm(false);
      setTimeout(() => getVotingParticipants?.(), 1200);
    } catch (e: any) {
      console.error("Veto failed:", e);
      enqueueSnackbar(e?.message || "Veto failed", { variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Row wrapper (matches your right panel “block” layout) */}
      <Box sx={{ my: 2, mx: 2 }}>
        <Grid container alignItems="center" spacing={1}>
          <Grid item xs>
            <Grid container alignItems="center" spacing={1}>
              <Grid item>
                <GavelIcon sx={{ opacity: 0.85 }} fontSize="small" />
              </Grid>
              <Grid item>
                <Typography gutterBottom variant="subtitle1" component="div" sx={{ mb: 0 }}>
                  {title}
                </Typography>
              </Grid>
            </Grid>

            <Typography color="text.secondary" variant="caption">
              {caption}
            </Typography>
          </Grid>

          <Grid item>
            <Tooltip title="Open council veto">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  onClick={() => setOpenConfirm(true)}
                  disabled={busy}
                  endIcon={busy ? <CircularProgress size={14} /> : <ChevronRightIcon fontSize="small" />}
                  sx={{
                    borderRadius: "17px",
                    textTransform: "none",
                    borderColor: "rgba(255,255,255,0.12)",
                  }}
                >
                  Veto
                </Button>
              </span>
            </Tooltip>
          </Grid>
        </Grid>
      </Box>

      <Dialog
        open={openConfirm}
        onClose={() => !busy && setOpenConfirm(false)}
        PaperProps={{
          style: {
            background: "#13151C",
            borderRadius: "20px",
            border: "1px solid rgba(255,255,255,0.08)",
          },
        }}
      >
        <DialogTitle>Confirm council veto</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "#ccc" }}>
            This will cast a <b>VETO</b> using your council voting power.
            <br />
            This action is irreversible for this proposal.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            color="warning"
            variant="outlined"
            startIcon={<GavelIcon />}
            onClick={handleVetoVote}
            disabled={busy}
            sx={{ borderRadius: "17px" }}
          >
            {busy ? "Submitting…" : "Confirm veto"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}