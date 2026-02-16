import React from 'react';
import { styled } from '@mui/material/styles';
import { useWallet } from '@solana/wallet-adapter-react';
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
  IconButton,
  ListItemIcon,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import PollIcon from '@mui/icons-material/Poll';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import AdvancedProposalView from './AdvancedProposalView';

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
          sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuDialogContent-root': { padding: theme.spacing(2) },
  '& .MuDialogActions-root': { padding: theme.spacing(1) },
}));

function cleanOptionValue(input: string): string {
  return `${input ?? ''}`.trim();
}

export default function CreatePollView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Create Poll');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>('Create a poll proposal with custom options.');
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(true);

  const [pollOptions, setPollOptions] = React.useState<string[]>(['Option 1', 'Option 2']);

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account?.config?.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
    }
  };

  React.useEffect(() => {
    setIsGoverningMintSelectable(false);

    const hasCouncil = !!realm?.account?.config?.councilMint;
    const hasCommunity = !!(realm?.account?.communityMint || realm?.communityMint);
    const canUseCommunity =
      hasCommunity &&
      Number(rulesWallet?.account?.config?.minCommunityTokensToCreateProposal) !== 18446744073709551615;

    if (hasCouncil && canUseCommunity) {
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
      setIsGoverningMintSelectable(true);
      setIsGoverningMintCouncilSelected(false);
      return;
    }

    if (hasCouncil) {
      setGoverningMint(realm?.account?.config?.councilMint);
      setIsGoverningMintCouncilSelected(true);
      return;
    }

    if (hasCommunity) {
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
      setIsGoverningMintCouncilSelected(false);
    }
  }, [realm, rulesWallet]);

  const handleAdvancedToggle = () => setOpenAdvanced((prev) => !prev);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const handleOptionChange = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleAddOption = () => {
    setPollOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCreatePollProposal = () => {
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    const dedupedOptions: string[] = [];
    const seen = new Set<string>();
    pollOptions.forEach((raw) => {
      const value = cleanOptionValue(raw);
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      dedupedOptions.push(value);
    });
    const cleanOptions = dedupedOptions;
    if (cleanOptions.length < 2) {
      enqueueSnackbar('Add at least 2 unique poll options.', { variant: 'error' });
      return;
    }

    const title = cleanOptionValue(proposalTitle || 'Create Poll') || 'Create Poll';
    const description =
      cleanOptionValue(proposalDescription || 'Create a poll proposal with custom options.') ||
      'Create a poll proposal with custom options.';

    const proposalVoteType = 'multi';

    setInstructions({
      title,
      description,
      ix: [],
      aix: [],
      queueOnly: false,
      useVersionedTransactions: true,
      nativeWallet: governanceNativeWallet,
      governingMint,
      draft: isDraft,
      editProposalAddress,
      allowNoInstructions: true,
      proposalOptions: cleanOptions,
      proposalVoteType,
      proposalUseDenyOption: false,
      proposalMaxVoterOptions: cleanOptions.length,
      proposalMaxWinningOptions: cleanOptions.length,
    });

    setExpandedLoader(true);
    handleClose();
  };

  return (
    <>
      <Tooltip title="Create Poll" placement="right">
        <MenuItem onClick={publicKey ? handleClickOpen : undefined}>
          <ListItemIcon>
            <PollIcon fontSize="small" style={{ marginRight: 8 }} />
          </ListItemIcon>
          Create Poll
        </MenuItem>
      </Tooltip>

      <BootstrapDialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={handleClose}
        onKeyDown={stopInputKeyPropagation}
        PaperProps={{
          style: {
            background: '#13151C',
            border: '1px solid rgba(255,255,255,0.05)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
          },
        }}
      >
        <BootstrapDialogTitle id="create-poll-dialog" onClose={handleClose}>
          Create Poll
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Create a poll proposal with multiple options.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={1.25}>
              {pollOptions.map((value, index) => (
                <Grid item xs={12} key={`poll-option-${index}`}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Poll Option ${index + 1}`}
                      variant="filled"
                      value={value}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveOption(index)}
                      disabled={pollOptions.length <= 2}
                      color="inherit"
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Grid>
              ))}

              <Grid item xs={12}>
                <Button
                  size="small"
                  onClick={handleAddOption}
                  startIcon={<AddIcon fontSize="small" />}
                  sx={{ borderRadius: '17px', textTransform: 'none' }}
                >
                  Add Option
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="caption" sx={{ opacity: 0.72, display: 'block' }}>
                  Poll proposals are non-executable on this governance program. Create a pure poll here, then submit a separate executable proposal for the winning action.
                </Typography>
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

          <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{ m: 2, textAlign: 'center' }}>
            <Typography variant="caption">Made with &lt;3 by Grape</Typography>
          </Box>

          <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p: 0, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0 }}>
              {publicKey ? (
                <Button
                  size="small"
                  onClick={handleAdvancedToggle}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    justifyContent: 'flex-start',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<SettingsIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: 'flex', p: 0 }}>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={handleCreatePollProposal}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<PollIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Create Poll Proposal
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
