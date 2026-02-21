import React, { useEffect, useMemo, useState } from 'react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { styled } from '@mui/material/styles';
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
  InputAdornment,
  LinearProgress,
  ListItemIcon,
  MenuItem,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import { useSnackbar } from 'notistack';
import CloseIcon from '@mui/icons-material/Close';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SettingsIcon from '@mui/icons-material/Settings';

import AdvancedProposalView from './AdvancedProposalView';
import {
  BPF_UPGRADE_LOADER_ID,
  getProgramDataAddress,
  getProgramDataAccount,
} from '@solana/spl-governance';

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

function shorten(value?: string | null, n = 6) {
  if (!value) return 'N/A';
  if (value.length <= n * 2 + 3) return value;
  return `${value.slice(0, n)}...${value.slice(-n)}`;
}

function makeSetAuthorityData() {
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  // UpgradeableLoaderInstruction::SetAuthority
  view.setUint32(0, 4, true);
  return data;
}

function makeUpgradeData() {
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  // UpgradeableLoaderInstruction::Upgrade
  view.setUint32(0, 3, true);
  return data;
}

function makeCloseData() {
  const data = new Uint8Array(4);
  const view = new DataView(data.buffer);
  // UpgradeableLoaderInstruction::Close
  view.setUint32(0, 5, true);
  return data;
}

export default function ProgramAuthorityView(props: any) {
  const realm = props?.realm;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.();
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const rulesWallet = props?.rulesWallet;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [funding, setFunding] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const [proposalTitle, setProposalTitle] = useState<string | null>('Transfer Program Upgrade Authority');
  const [proposalDescription, setProposalDescription] = useState<string | null>(
    'Transfer upgrade authority of a governed program via treasury execution.'
  );
  const [governingMint, setGoverningMint] = useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = useState(true);
  const [isDraft, setIsDraft] = useState(false);
  const [editProposalAddress, setEditProposalAddress] = useState(props?.editProposalAddress);

  const [programIdInput, setProgramIdInput] = useState('');
  const [newAuthorityInput, setNewAuthorityInput] = useState('');
  const [revokeAuthority, setRevokeAuthority] = useState(false);
  const [resolvedProgramData, setResolvedProgramData] = useState('');
  const [currentAuthority, setCurrentAuthority] = useState<string | null>(null);
  const [upgradeProgramIdInput, setUpgradeProgramIdInput] = useState('');
  const [bufferAddressInput, setBufferAddressInput] = useState('');
  const [spillAddressInput, setSpillAddressInput] = useState('');
  const [closeBufferAddressInput, setCloseBufferAddressInput] = useState('');
  const [closeRecipientInput, setCloseRecipientInput] = useState('');

  const [fundAmount, setFundAmount] = useState('');

  const isCurrentAuthorityTreasury = useMemo(() => {
    if (!currentAuthority || !governanceNativeWallet) return false;
    return currentAuthority === new PublicKey(governanceNativeWallet).toBase58();
  }, [currentAuthority, governanceNativeWallet]);

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account?.config?.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.communityMint || realm?.account?.communityMint);
    }
  };

  useEffect(() => {
    setIsGoverningMintSelectable(false);
    if (realm?.account?.config?.councilMint) {
      setGoverningMint(realm.account.config.councilMint);
      setIsGoverningMintCouncilSelected(true);
      if (
        realm?.account?.communityMint &&
        Number(rulesWallet?.account?.config?.minCommunityTokensToCreateProposal) !== 18446744073709551615
      ) {
        setGoverningMint(realm.account.communityMint);
        setIsGoverningMintSelectable(true);
        setIsGoverningMintCouncilSelected(false);
      }
    } else if (realm?.account?.communityMint) {
      setGoverningMint(realm.account.communityMint);
      setIsGoverningMintCouncilSelected(false);
    }
  }, [realm, rulesWallet]);

  const handleClickOpen = () => setOpen(true);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const handleCloseDialog = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  useEffect(() => {
    if (!spillAddressInput && governanceNativeWallet) {
      setSpillAddressInput(governanceNativeWallet);
    }
  }, [spillAddressInput, governanceNativeWallet]);

  useEffect(() => {
    if (!closeRecipientInput && governanceNativeWallet) {
      setCloseRecipientInput(governanceNativeWallet);
    }
  }, [closeRecipientInput, governanceNativeWallet]);

  const parsePublicKey = (value: string, label: string) => {
    const trimmed = value.trim();
    if (!trimmed) throw new Error(`${label} is required`);
    return new PublicKey(trimmed);
  };

  const refreshProgramAuthority = async () => {
    try {
      const programPk = parsePublicKey(programIdInput, 'Program id');
      const programAccount = await connection.getAccountInfo(programPk);
      if (!programAccount) {
        throw new Error('Program account does not exist');
      }
      if (!programAccount.executable) {
        throw new Error('Provided account is not an executable program');
      }

      const programDataPk = await getProgramDataAddress(programPk);
      setResolvedProgramData(programDataPk.toBase58());

      try {
        const programData = await getProgramDataAccount(connection, programPk);
        setCurrentAuthority(programData.authority ? programData.authority.toBase58() : null);
      } catch {
        setCurrentAuthority(null);
      }
    } catch (e: any) {
      setResolvedProgramData('');
      setCurrentAuthority(null);
      enqueueSnackbar(e?.message || 'Failed to resolve program authority', { variant: 'error' });
    }
  };

  const buildSetAuthorityIx = async () => {
    if (!governanceNativeWallet) {
      throw new Error('Missing treasury wallet address');
    }

    const programPk = parsePublicKey(programIdInput, 'Program id');
    const currentAuthorityPk = new PublicKey(governanceNativeWallet);
    const newAuthorityPk = revokeAuthority
      ? null
      : parsePublicKey(newAuthorityInput, 'New authority');

    const programDataPk = await getProgramDataAddress(programPk);

    const keys = [
      { pubkey: programDataPk, isSigner: false, isWritable: true },
      { pubkey: currentAuthorityPk, isSigner: true, isWritable: false },
    ];

    if (newAuthorityPk) {
      keys.push({ pubkey: newAuthorityPk, isSigner: false, isWritable: false });
    }

    return new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys,
      data: makeSetAuthorityData(),
    });
  };

  const buildUpgradeIx = async () => {
    if (!governanceNativeWallet) {
      throw new Error('Missing treasury wallet address');
    }

    const programPk = parsePublicKey(upgradeProgramIdInput, 'Program id');
    const bufferPk = parsePublicKey(bufferAddressInput, 'Buffer account');
    const spillPk = parsePublicKey(spillAddressInput || governanceNativeWallet, 'Spill account');
    const authorityPk = new PublicKey(governanceNativeWallet);

    const programDataPk = await getProgramDataAddress(programPk);

    return new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: programDataPk, isSigner: false, isWritable: true },
        { pubkey: programPk, isSigner: false, isWritable: true },
        { pubkey: bufferPk, isSigner: false, isWritable: true },
        { pubkey: spillPk, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: authorityPk, isSigner: true, isWritable: false },
      ],
      data: makeUpgradeData(),
    });
  };

  const buildCloseBufferIx = async () => {
    if (!governanceNativeWallet) {
      throw new Error('Missing treasury wallet address');
    }

    const closeAddress = parsePublicKey(closeBufferAddressInput, 'Buffer account');
    const recipient = parsePublicKey(
      closeRecipientInput || governanceNativeWallet,
      'Recipient account'
    );
    const authority = new PublicKey(governanceNativeWallet);

    return new TransactionInstruction({
      programId: BPF_UPGRADE_LOADER_ID,
      keys: [
        { pubkey: closeAddress, isSigner: false, isWritable: true },
        { pubkey: recipient, isSigner: false, isWritable: true },
        { pubkey: authority, isSigner: true, isWritable: false },
      ],
      data: makeCloseData(),
    });
  };

  const handleQueueInstruction = async () => {
    try {
      setLoading(true);

      if (!setInstructions || !setExpandedLoader) {
        throw new Error('Proposal builder is unavailable');
      }

      const ix = await buildSetAuthorityIx();

      const toAuthority = revokeAuthority
        ? 'None (revoke)'
        : new PublicKey(newAuthorityInput.trim()).toBase58();
      const title =
        proposalTitle ||
        `Set Program Authority: ${shorten(programIdInput.trim())}`;
      const description =
        proposalDescription ||
        `Set upgrade authority for ${programIdInput.trim()} to ${toAuthority}.`;

      setInstructions({
        title,
        description,
        ix: [ix],
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
        proposalInstructionType: 'Program Upgrade Authority',
      });

      setExpandedLoader(true);
      if (handleCloseExtMenu) handleCloseExtMenu();
      setOpen(false);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'Failed to queue authority instruction', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleQueueUpgradeInstruction = async () => {
    try {
      setLoading(true);

      if (!setInstructions || !setExpandedLoader) {
        throw new Error('Proposal builder is unavailable');
      }

      const ix = await buildUpgradeIx();
      const targetProgram = new PublicKey(upgradeProgramIdInput.trim()).toBase58();
      const bufferAccount = new PublicKey(bufferAddressInput.trim()).toBase58();
      const spillAccount = new PublicKey(
        (spillAddressInput || governanceNativeWallet || '').trim()
      ).toBase58();

      const title = proposalTitle || `Upgrade Program: ${shorten(targetProgram)}`;
      const description =
        proposalDescription ||
        `Upgrade ${targetProgram} using buffer ${bufferAccount}. Spill account: ${spillAccount}.`;

      setInstructions({
        title,
        description,
        ix: [ix],
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
        proposalInstructionType: 'Program Upgrade',
      });

      setExpandedLoader(true);
      if (handleCloseExtMenu) handleCloseExtMenu();
      setOpen(false);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'Failed to queue program upgrade instruction', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleQueueCloseBufferInstruction = async () => {
    try {
      setLoading(true);

      if (!setInstructions || !setExpandedLoader) {
        throw new Error('Proposal builder is unavailable');
      }

      const ix = await buildCloseBufferIx();
      const closeAddress = new PublicKey(closeBufferAddressInput.trim()).toBase58();
      const recipient = new PublicKey(
        (closeRecipientInput || governanceNativeWallet || '').trim()
      ).toBase58();

      const title = proposalTitle || `Close Buffer: ${shorten(closeAddress)}`;
      const description =
        proposalDescription ||
        `Close upgrade buffer ${closeAddress} and send reclaimed lamports to ${recipient}.`;

      setInstructions({
        title,
        description,
        ix: [ix],
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
        proposalInstructionType: 'Program Buffer Close',
      });

      setExpandedLoader(true);
      if (handleCloseExtMenu) handleCloseExtMenu();
      setOpen(false);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'Failed to queue close buffer instruction', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleFundTreasury = async () => {
    try {
      setFunding(true);

      if (!publicKey) throw new Error('Connect wallet first');
      if (!governanceNativeWallet) throw new Error('Treasury wallet not available');

      const amountNum = Number(fundAmount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error('Enter a valid SOL amount');
      }

      const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
      if (lamports <= 0) throw new Error('Amount is too small');

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(governanceNativeWallet),
          lamports,
        })
      );

      const signature = await sendTransaction(tx, connection, { skipPreflight: false });
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      enqueueSnackbar(`Treasury funded: ${signature}`, { variant: 'success' });
      setFundAmount('');
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'Funding treasury failed', { variant: 'error' });
    } finally {
      setFunding(false);
    }
  };

  return (
    <>
      <Tooltip title="Manage Program Authority & Fund Treasury" placement="right">
        <MenuItem onClick={publicKey ? handleClickOpen : undefined}>
          <ListItemIcon>
            <AdminPanelSettingsIcon fontSize="small" />
          </ListItemIcon>
          Program Authority
        </MenuItem>
      </Tooltip>

      <BootstrapDialog
        fullWidth
        maxWidth="sm"
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            background: '#13151C',
            border: '1px solid rgba(255,255,255,0.05)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
          },
        }}
      >
        <BootstrapDialogTitle id="program-authority-dialog" onClose={handleCloseDialog}>
          Program Authority
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Queue upgrade-authority changes using treasury execution, or directly fund treasury from your wallet.
          </DialogContentText>

          {(loading || funding) && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
            </Box>
          )}

          <Tabs value={tabValue} onChange={(_e, v) => setTabValue(v)} sx={{ mb: 2 }}>
            <Tab label="Queue Authority" />
            <Tab label="Program Upgrade" />
            <Tab label="Close Buffer" />
            <Tab label="Fund Treasury" />
          </Tabs>

          {tabValue === 0 && (
            <FormControl fullWidth>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Program ID"
                    value={programIdInput}
                    onChange={(e) => setProgramIdInput(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={refreshProgramAuthority}
                    sx={{ ml: 0.65, borderRadius: '10px', textTransform: 'none' }}
                  >
                    Check Current Authority
                  </Button>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ px: 1 }}>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                      ProgramData: {resolvedProgramData ? shorten(resolvedProgramData) : 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                      Current Authority: {currentAuthority ? shorten(currentAuthority) : 'Unknown'}
                    </Typography>
                    {currentAuthority && governanceNativeWallet && !isCurrentAuthorityTreasury && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                        Treasury is not current authority. Execution will fail unless authority is already treasury.
                      </Typography>
                    )}
                  </Box>
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
                    <Typography variant="body2" sx={{ mr: 1.5 }}>
                      Revoke authority
                    </Typography>
                    <Switch checked={revokeAuthority} onChange={(e) => setRevokeAuthority(e.target.checked)} />
                  </Box>
                </Grid>

                {!revokeAuthority && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="New Authority"
                      value={newAuthorityInput}
                      onChange={(e) => setNewAuthorityInput(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                      InputProps={{
                        endAdornment: governanceNativeWallet ? (
                          <InputAdornment position="end">
                            <Button
                              size="small"
                              onClick={() => setNewAuthorityInput(governanceNativeWallet)}
                              sx={{ textTransform: 'none' }}
                            >
                              Use Treasury
                            </Button>
                          </InputAdornment>
                        ) : undefined,
                      }}
                    />
                  </Grid>
                )}
              </Grid>
            </FormControl>
          )}

          {tabValue === 1 && (
            <FormControl fullWidth>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Program ID"
                    value={upgradeProgramIdInput}
                    onChange={(e) => setUpgradeProgramIdInput(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Buffer Account"
                    value={bufferAddressInput}
                    onChange={(e) => setBufferAddressInput(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Spill Account"
                    value={spillAddressInput}
                    onChange={(e) => setSpillAddressInput(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                    InputProps={{
                      endAdornment: governanceNativeWallet ? (
                        <InputAdornment position="end">
                          <Button
                            size="small"
                            onClick={() => setSpillAddressInput(governanceNativeWallet)}
                            sx={{ textTransform: 'none' }}
                          >
                            Use Treasury
                          </Button>
                        </InputAdornment>
                      ) : undefined,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ px: 1, display: 'block', opacity: 0.75 }}>
                    Ensure treasury is current upgrade authority and buffer authority before executing.
                  </Typography>
                </Grid>
              </Grid>
            </FormControl>
          )}

          {tabValue === 2 && (
            <FormControl fullWidth>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Buffer Account"
                    value={closeBufferAddressInput}
                    onChange={(e) => setCloseBufferAddressInput(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Recipient Account"
                    value={closeRecipientInput}
                    onChange={(e) => setCloseRecipientInput(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                    InputProps={{
                      endAdornment: governanceNativeWallet ? (
                        <InputAdornment position="end">
                          <Button
                            size="small"
                            onClick={() => setCloseRecipientInput(governanceNativeWallet)}
                            sx={{ textTransform: 'none' }}
                          >
                            Use Treasury
                          </Button>
                        </InputAdornment>
                      ) : undefined,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ px: 1, display: 'block', opacity: 0.75 }}>
                    Closes a loader-owned buffer and reclaims its lamports to the recipient account.
                  </Typography>
                </Grid>
              </Grid>
            </FormControl>
          )}

          {tabValue === 3 && (
            <FormControl fullWidth>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Treasury Wallet: {governanceNativeWallet ? shorten(governanceNativeWallet) : 'N/A'}
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Amount"
                    value={fundAmount}
                    onChange={(e) => setFundAmount(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                    inputProps={{ min: 0, step: 'any' }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">SOL</InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            </FormControl>
          )}

          {(tabValue === 0 || tabValue === 1 || tabValue === 2) && openAdvanced ? (
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

          <Box sx={{ m: 2, textAlign: 'center' }}>
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>

          <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p: 0, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0 }}>
              {tabValue === 0 || tabValue === 1 || tabValue === 2 ? (
                <Button
                  size="small"
                  onClick={() => setOpenAdvanced((v) => !v)}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    justifyContent: 'flex-start',
                    '&:hover .MuiSvgIcon-root.claimIcon': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<SettingsIcon className="claimIcon" sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Advanced
                </Button>
              ) : (
                <span />
              )}
            </Box>

            <Box sx={{ display: 'flex', p: 0 }}>
              {tabValue === 0 ? (
                <Button
                  autoFocus
                  onClick={handleQueueInstruction}
                  disabled={loading}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<AdminPanelSettingsIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Queue Authority Instruction
                </Button>
              ) : tabValue === 1 ? (
                <Button
                  autoFocus
                  onClick={handleQueueUpgradeInstruction}
                  disabled={loading}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<AdminPanelSettingsIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Queue Upgrade Instruction
                </Button>
              ) : tabValue === 2 ? (
                <Button
                  autoFocus
                  onClick={handleQueueCloseBufferInstruction}
                  disabled={loading}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<AdminPanelSettingsIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Queue Close Buffer
                </Button>
              ) : (
                <Button
                  autoFocus
                  onClick={handleFundTreasury}
                  disabled={funding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<AccountBalanceWalletIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Send to Treasury
                </Button>
              )}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
