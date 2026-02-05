// src/utils/governanceTools/votes/VetoVote.tsx
//
// Drop-in “Veto” row + canonical Veto Vote builder for SPL-Governance.
// Autodetects whether veto should be cast with Council mint or Community mint,
// depending on which governing token mint the proposal uses.
//
// Supports:
// - Council veto on Community proposals
// - Community veto on Council proposals (if realm has community mint)
//
// Usage (place above Export section):
//   <VetoVoteRow
//     realm={realm}
//     proposal={thisitem}
//     memberMap={memberMap}
//     councilVoterRecord={councilVoterRecord} // optional fast-path for council veto
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

  // Optional fast-path for council veto only (kept for backwards compatibility)
  councilVoterRecord?: any | null;

  publicKey: PublicKey | null;
  sendTransaction: (tx: Transaction, connection: any, opts?: any) => Promise<string>;
  getVotingParticipants?: () => void;

  // UI (optional override; if omitted we auto-label)
  title?: string;
  caption?: string;

  vetoCount?: number; // number of VoteRecords that are VoteKind.Veto for this proposal
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
// Helpers
// ----------------------------
function getCouncilMint58(realm: AnyRealm): string {
  return realm?.account?.config?.councilMint?.toBase58?.() || "";
}

// Realms objects vary in shape across codebases; try both common spots
function getCommunityMint58(realm: AnyRealm): string {
  return (
    realm?.account?.communityMint?.toBase58?.() ||
    (typeof realm?.communityMint === "string" ? realm.communityMint : realm?.communityMint?.toBase58?.()) ||
    ""
  );
}

function getProposalMint58(proposal: AnyProposal): string {
  return proposal?.account?.governingTokenMint?.toBase58?.() || "";
}

function isVotingState(proposal: AnyProposal): boolean {
  return proposal?.account?.state === 2;
}

type VetoMode =
  | { ok: true; vetoMint58: string; label: string; caption: string }
  | { ok: false; reason: string };

function detectVetoMode(realm: AnyRealm, proposal: AnyProposal): VetoMode {
  const councilMint58 = getCouncilMint58(realm);
  const communityMint58 = getCommunityMint58(realm);
  const proposalMint58 = getProposalMint58(proposal);

  if (!proposalMint58) return { ok: false, reason: "missing proposal mint" };

  // If proposal is council-mint, veto (if supported) should be with community mint
  if (councilMint58 && proposalMint58 === councilMint58) {
    if (!communityMint58) return { ok: false, reason: "no community mint" };
    return {
      ok: true,
      vetoMint58: communityMint58,
      label: "Community veto",
      caption: "Community veto action for council proposals",
    };
  }

  // Otherwise proposal is community-mint (or non-council), veto should be with council mint
  if (councilMint58 && proposalMint58 !== councilMint58) {
    return {
      ok: true,
      vetoMint58: councilMint58,
      label: "Council veto",
      caption: "Council veto action for community proposals",
    };
  }

  return { ok: false, reason: "no council mint" };
}

function canShowVetoRow(realm: AnyRealm, proposal: AnyProposal, walletPk58?: string) {
  if (!walletPk58) return false;
  if (!isVotingState(proposal)) return false;

  const mode = detectVetoMode(realm, proposal);
  if (!mode.ok) return false;

  // Defensive: veto mint must be different than proposal mint (should be by definition)
  const proposalMint58 = getProposalMint58(proposal);
  if (!proposalMint58 || mode.vetoMint58 === proposalMint58) return false;

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
  } = props;

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const [openConfirm, setOpenConfirm] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const walletPk58 = publicKey?.toBase58?.();
  const isBlacklisted = !!walletPk58 && BLACKLIST_WALLETS.includes(walletPk58);

  // Don’t render unless it applies
  if (!canShowVetoRow(realm, proposal, walletPk58)) return null;

  const mode = detectVetoMode(realm, proposal);
  if (!mode.ok) return null;

  const title = props.title ?? mode.label;
  const caption = props.caption ?? mode.caption;

  const vetoCount = props.vetoCount;

  const vetoMint58 = mode.vetoMint58;
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

      // Optional fast path ONLY if veto mint is council
      const canUseCouncilFastPath = !!councilVoterRecord && vetoMint58 === councilMint58;

      // Veto TOR for THIS wallet (council or community depending on mode)
      const vetoVoterRecord =
        (canUseCouncilFastPath ? councilVoterRecord : null) ||
        rawTokenOwnerRecords.find(
          (item: any) =>
            item?.account?.governingTokenOwner?.toBase58?.() === walletPk58 &&
            item?.account?.governingTokenMint?.toBase58?.() === vetoMint58
        );

      if (!vetoVoterRecord) {
        enqueueSnackbar("You do not have veto power for this proposal.", { variant: "error" });
        return;
      }

      const cnfrmkey = enqueueSnackbar(`Preparing ${title.toLowerCase()}…`, {
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
        new PublicKey(proposal.account.tokenOwnerRecord), // proposal owner record (same field for both cases)
        new PublicKey(vetoVoterRecord.pubkey),            // voter TOR (auto-selected)
        publicKey,                                        // governanceAuthority
        new PublicKey(vetoMint58),                         // voteGoverningTokenMint (auto-selected)
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

      enqueueSnackbar(`${title} submitted.`, {
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
                <Typography gutterBottom variant="subtitle1" component="div" sx={{ mb: 0, display: "flex", gap: 1, alignItems: "center" }}>
                {title}

                {typeof vetoCount === "number" && (
                    <Box
                    component="span"
                    sx={{
                        fontSize: 12,
                        px: 1,
                        py: 0.25,
                        borderRadius: "999px",
                        border: "1px solid rgba(255,255,255,0.14)",
                        color: "rgba(255,255,255,0.85)",
                    }}
                    >
                    {vetoCount} veto{vetoCount === 1 ? "" : "es"}
                    </Box>
                )}
                </Typography>
              </Grid>
            </Grid>

            <Typography color="text.secondary" variant="caption">
              {caption}
            </Typography>
          </Grid>

          <Grid item>
            <Tooltip title={`Open ${title.toLowerCase()}`}>
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
        <DialogTitle>Confirm {title.toLowerCase()}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "#ccc" }}>
            This will cast a <b>VETO</b> using your{" "}
            <b>{title.toLowerCase().includes("council") ? "council" : "community"}</b>{" "}
            voting power.
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