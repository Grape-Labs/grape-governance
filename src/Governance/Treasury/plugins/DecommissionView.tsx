import React from 'react';
import { styled } from '@mui/material/styles';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token-v2';
import {
  createSetRealmAuthority,
  SetRealmAuthorityAction,
} from '@solana/spl-governance';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  ListItemIcon,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import RefreshIcon from '@mui/icons-material/Refresh';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { getGrapeGovernanceProgramVersion } from '../../../utils/grapeTools/helpers';
import AdvancedProposalView from './AdvancedProposalView';

type EmptyTokenAccount = {
  tokenAccount: string;
  mint: string;
  decimals: number;
  selected: boolean;
};

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
            position: 'absolute',
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
  '& .MuDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

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

function shortenPk(pk: string): string {
  if (!pk || pk.length < 10) return pk;
  return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
}

function toSolString(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
}

export default function DecommissionView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [loadingTreasuryState, setLoadingTreasuryState] = React.useState(false);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>(
    'Decommission Treasury'
  );
  const [proposalDescription, setProposalDescription] = React.useState<
    string | null
  >('Drain treasury, optionally close empty token accounts, and lock realm authority.');
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const [treasuryBalanceLamports, setTreasuryBalanceLamports] = React.useState(0);
  const [emptyTokenAccounts, setEmptyTokenAccounts] = React.useState<EmptyTokenAccount[]>([]);

  const [destinationWallet, setDestinationWallet] = React.useState('');
  const [leaveSolBuffer, setLeaveSolBuffer] = React.useState('0.01');

  const [includeDrainSol, setIncludeDrainSol] = React.useState(true);
  const [includeCloseEmptyTokenAccounts, setIncludeCloseEmptyTokenAccounts] = React.useState(true);
  const [includeLockRealmAuthority, setIncludeLockRealmAuthority] = React.useState(false);
  const [confirmLockRealmAuthority, setConfirmLockRealmAuthority] = React.useState(false);

  const realmAuthority = toBase58(realm?.account?.authority);
  const selectedGovernanceWallet = toBase58(rulesWallet?.pubkey);
  const governanceAddress = toBase58(realm?.pubkey);

  const canLockRealmAuthority =
    Boolean(realmAuthority) &&
    Boolean(selectedGovernanceWallet) &&
    realmAuthority === selectedGovernanceWallet;

  const hasTreasuryWallet = Boolean(governanceNativeWallet && toBase58(governanceNativeWallet));

  const selectedCloseAccountCount = React.useMemo(
    () => emptyTokenAccounts.filter((item) => item.selected).length,
    [emptyTokenAccounts]
  );

  const toggleGoverningMintSelected = (council: boolean) => {
    const councilMint = toBase58(realm?.account?.config?.councilMint);
    const communityMint = toBase58(realm?.account?.communityMint || realm?.communityMint);
    if (council && councilMint) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(communityMint || councilMint);
    }
  };

  React.useEffect(() => {
    if (!open) return;

    const councilMint = toBase58(realm?.account?.config?.councilMint);
    const communityMint = toBase58(realm?.account?.communityMint || realm?.communityMint);
    const communityCreationDisabled =
      Number(rulesWallet?.account?.config?.minCommunityTokensToCreateProposal) ===
      18446744073709551615;

    const canUseCommunity = Boolean(communityMint) && !communityCreationDisabled;
    const canUseCouncil = Boolean(councilMint);

    if (canUseCouncil) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(councilMint);
      setIsGoverningMintSelectable(canUseCommunity);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(communityMint);
      setIsGoverningMintSelectable(false);
    }
  }, [open, realm, rulesWallet]);

  const fetchTreasuryState = React.useCallback(async () => {
    const treasuryPkStr = toBase58(governanceNativeWallet);
    if (!treasuryPkStr) return;

    try {
      setLoadingTreasuryState(true);
      const treasuryPk = new PublicKey(treasuryPkStr);
      const [balanceLamports, tokenAccountsResp] = await Promise.all([
        RPC_CONNECTION.getBalance(treasuryPk, 'confirmed'),
        RPC_CONNECTION.getParsedTokenAccountsByOwner(
          treasuryPk,
          { programId: TOKEN_PROGRAM_ID },
          'confirmed'
        ),
      ]);

      setTreasuryBalanceLamports(balanceLamports || 0);

      const emptyAccounts: EmptyTokenAccount[] = [];
      for (const item of tokenAccountsResp.value || []) {
        const parsedInfo = (item.account as any)?.data?.parsed?.info;
        const tokenAmount = parsedInfo?.tokenAmount;
        const rawAmount = String(tokenAmount?.amount || '0');
        if (rawAmount !== '0') continue;

        emptyAccounts.push({
          tokenAccount: item.pubkey.toBase58(),
          mint: toBase58(parsedInfo?.mint),
          decimals: Number(tokenAmount?.decimals || 0),
          selected: true,
        });
      }
      setEmptyTokenAccounts(emptyAccounts);
    } catch (e: any) {
      console.log('Failed to fetch treasury state', e);
      enqueueSnackbar(e?.message || 'Failed to fetch treasury state', { variant: 'error' });
    } finally {
      setLoadingTreasuryState(false);
    }
  }, [governanceNativeWallet, enqueueSnackbar]);

  React.useEffect(() => {
    if (!open) return;
    if (!destinationWallet && publicKey) {
      setDestinationWallet(publicKey.toBase58());
    }
    fetchTreasuryState();
  }, [open, destinationWallet, publicKey, fetchTreasuryState]);

  const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const buildProposalDescription = (
    drainLamports: number,
    closeCount: number,
    includeLock: boolean
  ): string => {
    const parts: string[] = [];
    if (drainLamports > 0) {
      parts.push(`Drain ${toSolString(drainLamports)} SOL from treasury.`);
    }
    if (closeCount > 0) {
      parts.push(`Close ${closeCount} empty token account${closeCount === 1 ? '' : 's'}.`);
    }
    if (includeLock) {
      parts.push('Remove (lock) realm authority.');
    }
    if (parts.length === 0) {
      return 'Decommission treasury configuration update.';
    }
    return parts.join(' ');
  };

  const handleGenerateProposal = async () => {
    try {
      if (!hasTreasuryWallet) {
        enqueueSnackbar('Missing governance treasury wallet.', { variant: 'error' });
        return;
      }
      if (!governingMint) {
        enqueueSnackbar('No governing mint selected.', { variant: 'error' });
        return;
      }

      const destination = (destinationWallet || '').trim();
      if ((includeDrainSol || includeCloseEmptyTokenAccounts) && !destination) {
        enqueueSnackbar('Destination wallet is required for treasury decommission actions.', {
          variant: 'error',
        });
        return;
      }

      let destinationPk: PublicKey | null = null;
      if (destination) {
        destinationPk = new PublicKey(destination);
        const destinationAccountInfo = await RPC_CONNECTION.getAccountInfo(destinationPk, 'confirmed');
        if (!destinationAccountInfo) {
          enqueueSnackbar(
            'Destination wallet does not exist on-chain. Use an initialized wallet address.',
            { variant: 'error' }
          );
          return;
        }
      }

      if (includeLockRealmAuthority && !canLockRealmAuthority) {
        enqueueSnackbar(
          'Current wallet is not the realm authority governance wallet. Lock step is unavailable here.',
          { variant: 'error' }
        );
        return;
      }
      if (includeLockRealmAuthority && !confirmLockRealmAuthority) {
        enqueueSnackbar('Confirm irreversible realm authority lock before continuing.', {
          variant: 'error',
        });
        return;
      }

      const treasuryPk = new PublicKey(toBase58(governanceNativeWallet));
      const proposalIxs: TransactionInstruction[] = [];

      let drainLamports = 0;
      if (includeDrainSol) {
        const latestBalance = await RPC_CONNECTION.getBalance(treasuryPk, 'confirmed');
        const keepSol = Math.max(0, Number(leaveSolBuffer || '0'));
        const keepLamports = Math.floor(keepSol * LAMPORTS_PER_SOL);
        drainLamports = Math.max(0, latestBalance - keepLamports);
        if (drainLamports > 0 && destinationPk) {
          proposalIxs.push(
            SystemProgram.transfer({
              fromPubkey: treasuryPk,
              toPubkey: destinationPk,
              lamports: drainLamports,
            })
          );
        }
      }

      let closeCount = 0;
      if (includeCloseEmptyTokenAccounts && destinationPk) {
        const closableAccounts = emptyTokenAccounts.filter((item) => item.selected);
        closeCount = closableAccounts.length;
        for (const tokenAccount of closableAccounts) {
          proposalIxs.push(
            createCloseAccountInstruction(
              new PublicKey(tokenAccount.tokenAccount),
              destinationPk,
              treasuryPk,
              [],
              TOKEN_PROGRAM_ID
            )
          );
        }
      }

      if (includeLockRealmAuthority) {
        const programId = new PublicKey(toBase58(realm?.owner || rulesWallet?.owner));
        const realmPk = new PublicKey(toBase58(realm?.pubkey));
        const realmAuthorityPk = new PublicKey(realmAuthority);
        const programVersion = await getGrapeGovernanceProgramVersion(
          RPC_CONNECTION,
          programId,
          realmPk
        );

        proposalIxs.push(
          createSetRealmAuthority(
            programId,
            programVersion,
            realmPk,
            realmAuthorityPk,
            undefined,
            SetRealmAuthorityAction.Remove
          )
        );
      }

      if (!proposalIxs.length) {
        enqueueSnackbar('No executable instructions were generated.', { variant: 'error' });
        return;
      }

      const fallbackTitle = includeLockRealmAuthority
        ? 'Decommission Treasury and Lock Realm Authority'
        : 'Decommission Treasury';
      const fallbackDescription = buildProposalDescription(
        drainLamports,
        closeCount,
        includeLockRealmAuthority
      );

      setInstructions({
        title: (proposalTitle || '').trim() || fallbackTitle,
        description: (proposalDescription || '').trim() || fallbackDescription,
        ix: proposalIxs,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
      });

      setExpandedLoader(true);
      handleClose();
    } catch (e: any) {
      console.log('Failed to create decommission proposal', e);
      enqueueSnackbar(e?.message || 'Failed to create decommission proposal', {
        variant: 'error',
      });
    }
  };

  return (
    <>
      <Tooltip title="Decommission" placement="right">
        <MenuItem onClick={publicKey ? () => setOpen(true) : undefined}>
          <ListItemIcon>
            <PowerSettingsNewIcon fontSize="small" style={{ marginRight: 8 }} />
          </ListItemIcon>
          Decommission
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
        <BootstrapDialogTitle id="decommission-dialog" onClose={handleClose}>
          Decommission Treasury
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Safe decommission flow: drain SOL, optionally close empty token accounts, and optionally
            remove realm authority.
          </DialogContentText>

          <Box sx={{ mb: 2 }}>
            <Grid container spacing={1} alignItems="center">
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Treasury Wallet
                </Typography>
                <Typography variant="body2">
                  {hasTreasuryWallet ? toBase58(governanceNativeWallet) : 'Not available'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={7}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Treasury SOL Balance
                </Typography>
                <Typography variant="body2">{toSolString(treasuryBalanceLamports)} SOL</Typography>
              </Grid>
              <Grid item xs={12} sm={5} sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                <Button
                  size="small"
                  onClick={fetchTreasuryState}
                  disabled={loadingTreasuryState || !hasTreasuryWallet}
                  startIcon={<RefreshIcon fontSize="small" />}
                >
                  Refresh
                </Button>
              </Grid>
            </Grid>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <FormControl fullWidth>
            <FormControlLabel
              control={
                <Switch
                  checked={includeDrainSol}
                  onChange={(e) => setIncludeDrainSol(e.target.checked)}
                />
              }
              label="Drain treasury SOL"
            />
          </FormControl>

          {(includeDrainSol || includeCloseEmptyTokenAccounts) && (
            <Grid container spacing={1} sx={{ mb: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Destination Wallet"
                  variant="filled"
                  value={destinationWallet}
                  onChange={(e) => setDestinationWallet(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              {includeDrainSol && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Leave SOL Buffer"
                    variant="filled"
                    value={leaveSolBuffer}
                    onChange={(e) => setLeaveSolBuffer(e.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
              )}
            </Grid>
          )}

          <FormControl fullWidth>
            <FormControlLabel
              control={
                <Switch
                  checked={includeCloseEmptyTokenAccounts}
                  onChange={(e) => setIncludeCloseEmptyTokenAccounts(e.target.checked)}
                />
              }
              label={`Close empty token accounts (${selectedCloseAccountCount}/${emptyTokenAccounts.length})`}
            />
          </FormControl>

          {includeCloseEmptyTokenAccounts && (
            <Box
              sx={{
                maxHeight: 140,
                overflow: 'auto',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                p: 1,
                mb: 1,
              }}
            >
              {emptyTokenAccounts.length === 0 ? (
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  No empty SPL token accounts found.
                </Typography>
              ) : (
                emptyTokenAccounts.map((item) => (
                  <FormControlLabel
                    key={item.tokenAccount}
                    control={
                      <Checkbox
                        size="small"
                        checked={item.selected}
                        onChange={(e) =>
                          setEmptyTokenAccounts((prev) =>
                            prev.map((tokenAccount) =>
                              tokenAccount.tokenAccount === item.tokenAccount
                                ? { ...tokenAccount, selected: e.target.checked }
                                : tokenAccount
                            )
                          )
                        }
                      />
                    }
                    label={
                      <Typography variant="caption">
                        {shortenPk(item.tokenAccount)} • mint {shortenPk(item.mint)}
                      </Typography>
                    }
                  />
                ))
              )}
            </Box>
          )}

          <FormControl fullWidth>
            <FormControlLabel
              control={
                <Switch
                  checked={includeLockRealmAuthority}
                  onChange={(e) => setIncludeLockRealmAuthority(e.target.checked)}
                  disabled={!canLockRealmAuthority}
                />
              }
              label="Remove/lock realm authority"
            />
          </FormControl>

          {includeLockRealmAuthority && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={confirmLockRealmAuthority}
                  onChange={(e) => setConfirmLockRealmAuthority(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption">
                  I understand this action is irreversible.
                </Typography>
              }
            />
          )}

          {!canLockRealmAuthority && (
            <Alert severity="info" sx={{ mt: 1 }}>
              Lock step is unavailable in this wallet. Realm authority is{' '}
              <strong>{realmAuthority || 'unknown'}</strong>, but selected governance wallet is{' '}
              <strong>{selectedGovernanceWallet || 'unknown'}</strong>.
            </Alert>
          )}

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
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>

          <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p: 0, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0 }}>
              {publicKey ? (
                <Button
                  size="small"
                  onClick={() => setOpenAdvanced((prev) => !prev)}
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
                  onClick={handleGenerateProposal}
                  disabled={loadingTreasuryState || !hasTreasuryWallet}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={
                    includeLockRealmAuthority ? (
                      <WarningAmberIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />
                    ) : (
                      <PowerSettingsNewIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />
                    )
                  }
                >
                  Create Decommission Proposal
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
