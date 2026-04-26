import React from 'react';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemIcon,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { useSnackbar } from 'notistack';
import CreateGistWithOAuth from '../../CreateGist';
import { getProposalInstructionsIndexed, getProposalNewIndexed } from '../../api/queries';

function toBase58(value: any): string {
  try {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value?.toBase58) return value.toBase58();
    return String(value);
  } catch {
    return '';
  }
}

type GoverningMintChoice = 'community' | 'council';

function extractProposalAddressInput(value: string): string {
  const input = `${value ?? ''}`.trim();
  if (!input) return '';

  const tryValidate = (candidate?: string | null): string => {
    const trimmed = `${candidate ?? ''}`.trim();
    if (!trimmed) return '';
    try {
      return new PublicKey(trimmed).toBase58();
    } catch {
      return '';
    }
  };

  const direct = tryValidate(input);
  if (direct) return direct;

  try {
    const parsedUrl = new URL(input);
    const segments = parsedUrl.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).trim())
      .filter(Boolean);

    const proposalSegmentIndex = segments.findIndex((segment) => segment.toLowerCase() === 'proposal');
    if (proposalSegmentIndex >= 0) {
      const fromProposalPath = tryValidate(segments[proposalSegmentIndex + 1]);
      if (fromProposalPath) return fromProposalPath;
    }

    for (const segment of segments) {
      const validated = tryValidate(segment);
      if (validated) return validated;
    }
  } catch {
    // Not a URL, fall through to token scan.
  }

  const base58Candidates = input.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g) || [];
  for (const candidate of base58Candidates) {
    const validated = tryValidate(candidate);
    if (validated) return validated;
  }

  return '';
}

function toPublicKeySafe(value: any): PublicKey | null {
  try {
    if (!value) return null;
    if (value instanceof PublicKey) return value;
    if (value?.toBase58) return new PublicKey(value.toBase58());
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function toInstructionDataBuffer(value: any): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return Buffer.from(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return Buffer.alloc(0);
    try {
      return Buffer.from(trimmed, 'base64');
    } catch {
      return Buffer.alloc(0);
    }
  }
  try {
    return Buffer.from(value);
  } catch {
    return Buffer.alloc(0);
  }
}

function normalizeInstruction(ix: any): TransactionInstruction | null {
  if (!ix) return null;
  if (ix instanceof TransactionInstruction) return ix;

  const programId = toPublicKeySafe(ix?.programId || ix?.program_id || ix?.program);
  const rawKeys = Array.isArray(ix?.keys) ? ix.keys : Array.isArray(ix?.accounts) ? ix.accounts : [];
  if (!programId) return null;

  const keys = rawKeys
    .map((k: any) => {
      const pubkey = toPublicKeySafe(k?.pubkey ?? k?.publicKey ?? k);
      if (!pubkey) return null;
      return {
        pubkey,
        isSigner: !!(k?.isSigner ?? k?.is_signer),
        isWritable: !!(k?.isWritable ?? k?.is_writable),
      };
    })
    .filter(Boolean) as Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;

  try {
    return new TransactionInstruction({
      programId,
      keys,
      data: toInstructionDataBuffer(ix?.data),
    });
  } catch {
    return null;
  }
}

function normalizeInstructionArray(raw: any): TransactionInstruction[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr
    .map((ix: any) => normalizeInstruction(ix))
    .filter((ix: TransactionInstruction | null): ix is TransactionInstruction => !!ix);
}

function extractCopiedProposalPayload(
  proposalInstructions: any[],
  sourceProposal: any
): {
  copiedInstructionCount: number;
  ix: TransactionInstruction[];
  proposalOptionInstructionSets: Array<{
    optionIndex: number;
    holdUpTime?: number;
    ix: TransactionInstruction[];
  }>;
  proposalOptions?: string[];
  proposalVoteType?: 'multi';
  proposalUseDenyOption?: boolean;
  proposalMaxVoterOptions?: number;
  proposalMaxWinningOptions?: number;
} {
  const normalizedInstructionRows = (Array.isArray(proposalInstructions) ? proposalInstructions : [])
    .map((item: any) => {
      const ix = normalizeInstructionArray(item?.account?.instructions);
      if (ix.length === 0) return null;

      const optionIndex = Number(item?.account?.optionIndex ?? 0);
      const instructionIndex = Number(item?.account?.instructionIndex ?? 0);
      const holdUpTime = Number(item?.account?.holdUpTime ?? 0);

      return {
        optionIndex: Number.isFinite(optionIndex) && optionIndex >= 0 ? optionIndex : 0,
        instructionIndex: Number.isFinite(instructionIndex) && instructionIndex >= 0 ? instructionIndex : 0,
        holdUpTime: Number.isFinite(holdUpTime) && holdUpTime >= 0 ? holdUpTime : 0,
        ix,
      };
    })
    .filter(
      (
        item:
          | {
              optionIndex: number;
              instructionIndex: number;
              holdUpTime: number;
              ix: TransactionInstruction[];
            }
          | null
      ): item is {
        optionIndex: number;
        instructionIndex: number;
        holdUpTime: number;
        ix: TransactionInstruction[];
      } => !!item
    )
    .sort((a, b) => {
      if (a.optionIndex !== b.optionIndex) return a.optionIndex - b.optionIndex;
      return a.instructionIndex - b.instructionIndex;
    })
    .map((item) => ({
      optionIndex: item.optionIndex,
      holdUpTime: item.holdUpTime,
        ix: item.ix,
      }));

  const copiedInstructionCount = normalizedInstructionRows.reduce(
    (sum, item) => sum + item.ix.length,
    0
  );

  const sourceOptionLabels = Array.isArray(sourceProposal?.account?.options)
    ? sourceProposal.account.options
        .map((option: any) => `${option?.label ?? option ?? ''}`.trim())
        .filter((value: string) => !!value)
    : [];

  const uniqueOptionIndexes = Array.from(
    new Set(normalizedInstructionRows.map((item) => item.optionIndex))
  );
  const shouldUseFlatIx =
    uniqueOptionIndexes.length <= 1 &&
    (uniqueOptionIndexes[0] ?? 0) === 0 &&
    sourceOptionLabels.length <= 1;

  if (shouldUseFlatIx) {
    return {
      copiedInstructionCount,
      ix: normalizedInstructionRows.flatMap((item) => item.ix),
      proposalOptionInstructionSets: [],
    };
  }

  if (sourceOptionLabels.length > 1) {
    return {
      copiedInstructionCount,
      ix: [],
      proposalOptionInstructionSets: normalizedInstructionRows,
      proposalOptions: sourceOptionLabels,
      proposalVoteType: 'multi',
      proposalUseDenyOption: false,
      proposalMaxVoterOptions: sourceOptionLabels.length,
      proposalMaxWinningOptions: sourceOptionLabels.length,
    };
  }

  return {
    copiedInstructionCount,
    ix: [],
    proposalOptionInstructionSets: normalizedInstructionRows,
  };
}

export default function DraftProposalView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [proposalTitle, setProposalTitle] = React.useState('');
  const [proposalDescription, setProposalDescription] = React.useState('');
  const [sourceProposalAddress, setSourceProposalAddress] = React.useState('');
  const [mintChoice, setMintChoice] = React.useState<GoverningMintChoice>('community');
  const [isCreatingDraft, setIsCreatingDraft] = React.useState(false);

  const communityMint = toBase58(realm?.account?.communityMint);
  const councilMint = toBase58(realm?.account?.config?.councilMint);

  const communityCreationDisabled =
    Number(rulesWallet?.account?.config?.minCommunityTokensToCreateProposal) === 18446744073709551615;

  const canUseCommunity = Boolean(communityMint) && !communityCreationDisabled;
  const canUseCouncil = Boolean(councilMint);

  React.useEffect(() => {
    if (canUseCommunity) {
      setMintChoice('community');
      return;
    }
    if (canUseCouncil) {
      setMintChoice('council');
    }
  }, [canUseCommunity, canUseCouncil]);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const handleCreateDraft = async () => {
    const title = (proposalTitle || '').trim();
    const description = (proposalDescription || '').trim();
    const copyFromProposalAddress = extractProposalAddressInput(sourceProposalAddress || '');

    let selectedMint =
      mintChoice === 'council'
        ? councilMint || communityMint
        : communityMint || councilMint;

    if (!selectedMint) {
      enqueueSnackbar('No valid governing mint found for this governance.', { variant: 'error' });
      return;
    }

    setIsCreatingDraft(true);
    try {
      let resolvedTitle = title;
      let resolvedDescription = description;
      let proposalIxPayload: any = {
        ix: [],
        aix: [],
      };

      if (copyFromProposalAddress) {
        let proposalPk: PublicKey;
        try {
          proposalPk = new PublicKey(copyFromProposalAddress);
        } catch {
          enqueueSnackbar('Source proposal address is invalid.', { variant: 'error' });
          return;
        }

        const sourceProposal = await getProposalNewIndexed(
          proposalPk.toBase58(),
          realm?.owner?.toBase58?.() || realm?.owner,
          realm?.pubkey?.toBase58?.() || realm?.pubkey
        );

        if (!sourceProposal?.account) {
          enqueueSnackbar('Unable to load the source proposal.', { variant: 'error' });
          return;
        }

        const sourceInstructions = await getProposalInstructionsIndexed(
          realm?.pubkey?.toBase58?.() || realm?.realm?.toBase58?.(),
          proposalPk.toBase58(),
          realm?.owner?.toBase58?.() || realm?.owner
        );

        const copiedPayload = extractCopiedProposalPayload(sourceInstructions, sourceProposal);
        if (copiedPayload.copiedInstructionCount === 0) {
          enqueueSnackbar('No proposal instructions were found to copy.', { variant: 'error' });
          return;
        }

        proposalIxPayload = {
          ix: copiedPayload.ix,
          aix: [],
          ...(copiedPayload.proposalOptionInstructionSets.length > 0
            ? {
                proposalOptionInstructionSets: copiedPayload.proposalOptionInstructionSets,
              }
            : {}),
          ...(copiedPayload.proposalOptions?.length
            ? {
                proposalOptions: copiedPayload.proposalOptions,
                proposalVoteType: copiedPayload.proposalVoteType,
                proposalUseDenyOption: copiedPayload.proposalUseDenyOption,
                proposalMaxVoterOptions: copiedPayload.proposalMaxVoterOptions,
                proposalMaxWinningOptions: copiedPayload.proposalMaxWinningOptions,
              }
            : {}),
        };

        resolvedTitle = resolvedTitle || `${sourceProposal?.account?.name || ''}`.trim();
        resolvedDescription =
          resolvedDescription || `${sourceProposal?.account?.descriptionLink || ''}`.trim();

        const sourceGoverningMint = toBase58(sourceProposal?.account?.governingTokenMint);
        if (sourceGoverningMint && (sourceGoverningMint === communityMint || sourceGoverningMint === councilMint)) {
          selectedMint = sourceGoverningMint;
        }
      }

      if (!resolvedTitle) {
        enqueueSnackbar('Proposal title is required.', { variant: 'error' });
        return;
      }

      setInstructions({
        title: resolvedTitle,
        description: resolvedDescription || 'Draft proposal',
        ...proposalIxPayload,
        nativeWallet: governanceNativeWallet,
        governingMint: selectedMint,
        draft: true,
        editProposalAddress: null,
      });

      if (copyFromProposalAddress) {
        enqueueSnackbar('Proposal instructions copied into draft.', { variant: 'success' });
      }

      setExpandedLoader(true);
      handleClose();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'Failed to create draft proposal.', { variant: 'error' });
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const stopMenuKeyHandling = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const mintSelectionDisabled = !canUseCouncil || !canUseCommunity;

  return (
    <>
      <Tooltip title="Create a draft proposal with title and description only" placement="right">
        <MenuItem onClick={publicKey ? () => setOpen(true) : undefined}>
          <ListItemIcon>
            <NoteAddIcon fontSize="small" />
          </ListItemIcon>
          Draft Proposal
        </MenuItem>
      </Tooltip>

      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        onKeyDown={stopMenuKeyHandling}
      >
        <DialogTitle>Quick Draft Proposal</DialogTitle>
        <DialogContent onKeyDown={stopMenuKeyHandling}>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            This creates a draft proposal. Optionally provide an existing proposal address to copy its instructions.
          </Typography>

          <TextField
            autoFocus
            fullWidth
            required
            margin="dense"
            label="Proposal Title"
            value={proposalTitle}
            onChange={(e) => setProposalTitle(e.target.value)}
            onKeyDown={stopMenuKeyHandling}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Proposal Description"
            value={proposalDescription}
            onChange={(e) => setProposalDescription(e.target.value)}
            multiline
            minRows={4}
            onKeyDown={stopMenuKeyHandling}
          />

          <TextField
            fullWidth
            margin="dense"
            label="Copy Instructions From Proposal"
            value={sourceProposalAddress}
            onChange={(e) => setSourceProposalAddress(e.target.value)}
            placeholder="Enter a proposal address or full governance.so proposal URL"
            onKeyDown={stopMenuKeyHandling}
            helperText="Optional. Supports a raw proposal address or a full proposal URL. This draft will copy the source proposal instructions and proposal options."
          />

          <Box sx={{ mt: 1, mb: 1 }}>
            <CreateGistWithOAuth
              onGistCreated={(url) => {
                setProposalDescription(url);
              }}
              defaultText={proposalDescription}
            />
          </Box>

          <FormControl fullWidth margin="dense" disabled={mintSelectionDisabled}>
            <InputLabel id="draft-governing-mint-label">Governing Mint</InputLabel>
            <Select
              labelId="draft-governing-mint-label"
              value={mintChoice}
              label="Governing Mint"
              onChange={(e) => setMintChoice(e.target.value as GoverningMintChoice)}
              onKeyDown={stopMenuKeyHandling}
            >
              {canUseCommunity && <MenuItem value="community">Community</MenuItem>}
              {canUseCouncil && <MenuItem value="council">Council</MenuItem>}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isCreatingDraft}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleCreateDraft} disabled={!publicKey || isCreatingDraft}>
            {isCreatingDraft ? <CircularProgress size={18} color="inherit" /> : 'Create Draft'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
