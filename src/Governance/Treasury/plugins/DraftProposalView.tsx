import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  Button,
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
  const [mintChoice, setMintChoice] = React.useState<GoverningMintChoice>('community');

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

  const handleCreateDraft = () => {
    const title = (proposalTitle || '').trim();
    const description = (proposalDescription || '').trim();

    if (!title) {
      enqueueSnackbar('Proposal title is required.', { variant: 'error' });
      return;
    }

    const selectedMint =
      mintChoice === 'council'
        ? councilMint || communityMint
        : communityMint || councilMint;

    if (!selectedMint) {
      enqueueSnackbar('No valid governing mint found for this governance.', { variant: 'error' });
      return;
    }

    setInstructions({
      title,
      description: description || 'Draft proposal',
      ix: [],
      aix: [],
      nativeWallet: governanceNativeWallet,
      governingMint: selectedMint,
      draft: true,
      editProposalAddress: null,
    });

    setExpandedLoader(true);
    handleClose();
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
            This creates a proposal in draft state with no instructions.
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
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDraft} disabled={!publicKey}>
            Create Draft
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
