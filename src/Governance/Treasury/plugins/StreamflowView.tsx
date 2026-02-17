import React from 'react';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  ListItemIcon,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import WaterfallChartIcon from '@mui/icons-material/WaterfallChart';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useSnackbar } from 'notistack';
import BN from 'bn.js';
import { getMint } from '@solana/spl-token-v2';
import {
  ICluster,
  PROGRAM_ID,
  SolanaStreamClient,
  StreamDirection,
  StreamType,
  getBN,
} from '@streamflow/stream';

import AdvancedProposalView from './AdvancedProposalView';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';

const STREAMFLOW_APP_URL = 'https://app.streamflow.finance/';
const STREAMFLOW_METADATA_SIZE = 1104;

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

function cleanValue(value: string): string {
  return `${value ?? ''}`.trim();
}

function detectStreamflowCluster(endpoint?: string): ICluster {
  const normalized = `${endpoint ?? ''}`.toLowerCase();
  if (normalized.includes('devnet') || normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return ICluster.Devnet;
  }
  if (normalized.includes('testnet')) {
    return ICluster.Testnet;
  }
  return ICluster.Mainnet;
}

function resolveStreamflowProgramId(cluster: ICluster): string {
  const clusterProgramId = (PROGRAM_ID as any)?.[cluster];
  if (typeof clusterProgramId === 'string' && clusterProgramId.length > 0) {
    return clusterProgramId;
  }
  const fallback = (PROGRAM_ID as any)?.[ICluster.Mainnet];
  if (typeof fallback === 'string' && fallback.length > 0) {
    return fallback;
  }
  throw new Error('Streamflow PROGRAM_ID is missing for the active cluster');
}

function toLocalDatetimeInputValue(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function isPositiveNumber(value: string): boolean {
  const v = cleanValue(value);
  if (!/^\d+(\.\d+)?$/.test(v)) return false;
  return Number(v) > 0;
}

function isNonNegativeNumber(value: string): boolean {
  const v = cleanValue(value);
  if (!/^\d+(\.\d+)?$/.test(v)) return false;
  return Number(v) >= 0;
}

export default function StreamflowView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Create Streamflow Stream');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Create a Streamflow vesting stream from treasury.'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const [recipient, setRecipient] = React.useState('');
  const [tokenMint, setTokenMint] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [cliffAmount, setCliffAmount] = React.useState('0');
  const [streamName, setStreamName] = React.useState('Governance Stream');
  const [startAt, setStartAt] = React.useState<string>(
    toLocalDatetimeInputValue(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [periodSeconds, setPeriodSeconds] = React.useState('86400');
  const [periodCount, setPeriodCount] = React.useState('30');

  const [canTopup, setCanTopup] = React.useState(false);
  const [cancelableBySender, setCancelableBySender] = React.useState(true);
  const [cancelableByRecipient, setCancelableByRecipient] = React.useState(false);
  const [transferableBySender, setTransferableBySender] = React.useState(false);
  const [transferableByRecipient, setTransferableByRecipient] = React.useState(false);
  const [automaticWithdrawal, setAutomaticWithdrawal] = React.useState(false);

  const [isBuilding, setIsBuilding] = React.useState(false);
  const [loadingCreatedStreams, setLoadingCreatedStreams] = React.useState(false);
  const [createdStreamsError, setCreatedStreamsError] = React.useState<string | null>(null);
  const [createdStreams, setCreatedStreams] = React.useState<Array<{ id: string; stream: any }>>([]);

  const streamflowCluster = React.useMemo(
    () => detectStreamflowCluster((RPC_CONNECTION as any)?.rpcEndpoint),
    []
  );
  const streamflowClient = React.useMemo(
    () => new SolanaStreamClient((RPC_CONNECTION as any)?.rpcEndpoint, streamflowCluster),
    [streamflowCluster]
  );

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

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

  const handleClickOpen = () => setOpen(true);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

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

  const formatUnixTimestamp = (ts?: number): string => {
    if (!ts || !Number.isFinite(ts) || ts <= 0) return 'N/A';
    try {
      return new Date(ts * 1000).toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const fetchCreatedStreams = React.useCallback(async () => {
    if (!governanceNativeWallet) {
      setCreatedStreams([]);
      setCreatedStreamsError('Missing governance native wallet');
      return;
    }

    setLoadingCreatedStreams(true);
    setCreatedStreamsError(null);
    try {
      const senderPk = new PublicKey(governanceNativeWallet);
      const streamEntries = await streamflowClient.get({
        address: senderPk.toBase58(),
        direction: StreamDirection.Outgoing,
        type: StreamType.All,
      });

      const mapped = (streamEntries || []).map(([id, stream]) => ({ id, stream }));
      mapped.sort((a, b) => Number(b?.stream?.createdAt || 0) - Number(a?.stream?.createdAt || 0));
      setCreatedStreams(mapped);
    } catch (error: any) {
      const message = error?.message || `${error}`;
      setCreatedStreams([]);
      setCreatedStreamsError(message);
      console.error('Failed to fetch Streamflow streams', error);
    } finally {
      setLoadingCreatedStreams(false);
    }
  }, [governanceNativeWallet, streamflowClient]);

  React.useEffect(() => {
    if (!open) return;
    fetchCreatedStreams();
  }, [open, fetchCreatedStreams]);

  const queueStreamflowStream = async () => {
    if (isBuilding) return;

    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    const cleanRecipient = cleanValue(recipient);
    const cleanTokenMint = cleanValue(tokenMint);
    const cleanAmount = cleanValue(amount);
    const cleanCliffAmount = cleanValue(cliffAmount || '0');
    const cleanPeriodSeconds = cleanValue(periodSeconds);
    const cleanPeriodCount = cleanValue(periodCount);
    const cleanName = cleanValue(streamName || 'Governance Stream');

    let recipientPk: PublicKey;
    let tokenMintPk: PublicKey;
    let senderPk: PublicKey;

    try {
      recipientPk = new PublicKey(cleanRecipient);
      tokenMintPk = new PublicKey(cleanTokenMint);
      senderPk = new PublicKey(governanceNativeWallet);
    } catch {
      enqueueSnackbar('Recipient, token mint, or treasury wallet is invalid', { variant: 'error' });
      return;
    }

    if (!isPositiveNumber(cleanAmount)) {
      enqueueSnackbar('Amount must be a positive number', { variant: 'error' });
      return;
    }

    if (!isNonNegativeNumber(cleanCliffAmount)) {
      enqueueSnackbar('Cliff amount must be zero or a positive number', { variant: 'error' });
      return;
    }

    const periodSecondsInt = Number(cleanPeriodSeconds);
    const periodCountInt = Number(cleanPeriodCount);
    if (!Number.isInteger(periodSecondsInt) || periodSecondsInt < 1) {
      enqueueSnackbar('Period seconds must be an integer greater than 0', { variant: 'error' });
      return;
    }
    if (!Number.isInteger(periodCountInt) || periodCountInt < 1) {
      enqueueSnackbar('Number of periods must be an integer greater than 0', { variant: 'error' });
      return;
    }

    const startTs = Math.floor(new Date(startAt).getTime() / 1000);
    if (!Number.isFinite(startTs) || startTs <= 0) {
      enqueueSnackbar('Invalid start date/time', { variant: 'error' });
      return;
    }

    setIsBuilding(true);
    try {
      const mintAccountInfo = await RPC_CONNECTION.getAccountInfo(tokenMintPk);
      if (!mintAccountInfo) {
        enqueueSnackbar('Token mint account not found', { variant: 'error' });
        return;
      }

      const tokenProgramId = mintAccountInfo.owner;
      const mintInfo = await getMint(RPC_CONNECTION as any, tokenMintPk, 'confirmed' as any, tokenProgramId as any);
      const decimals = mintInfo.decimals;

      const totalAmountBn = getBN(Number(cleanAmount), decimals);
      const cliffAmountBn = getBN(Number(cleanCliffAmount), decimals);

      if (cliffAmountBn.gt(totalAmountBn)) {
        enqueueSnackbar('Cliff amount can not exceed total amount', { variant: 'error' });
        return;
      }

      const remainingBn = totalAmountBn.sub(cliffAmountBn);
      const periodCountBn = new BN(periodCountInt);
      if (!remainingBn.isZero() && !remainingBn.mod(periodCountBn).isZero()) {
        enqueueSnackbar('Amount after cliff must divide evenly by period count', { variant: 'error' });
        return;
      }

      const amountPerPeriodBn = remainingBn.isZero() ? new BN(0) : remainingBn.div(periodCountBn);
      if (!remainingBn.isZero() && amountPerPeriodBn.lte(new BN(0))) {
        enqueueSnackbar('Per-period amount must be greater than zero', { variant: 'error' });
        return;
      }

      const streamflowProgramId = new PublicKey(resolveStreamflowProgramId(streamflowCluster));
      const metadataSeed = `sf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`.slice(0, 32);
      const metadataPubkey = await PublicKey.createWithSeed(senderPk, metadataSeed, streamflowProgramId);

      const { ixs } = await streamflowClient.prepareCreateUncheckedInstructions(
        {
          recipient: recipientPk.toBase58(),
          tokenId: tokenMintPk.toBase58(),
          start: startTs,
          amount: totalAmountBn,
          period: periodSecondsInt,
          cliff: startTs,
          cliffAmount: cliffAmountBn,
          amountPerPeriod: amountPerPeriodBn,
          name: cleanName,
          canTopup,
          canUpdateRate: false,
          canPause: false,
          cancelableBySender,
          cancelableByRecipient,
          transferableBySender,
          transferableByRecipient,
          automaticWithdrawal,
          withdrawalFrequency: automaticWithdrawal ? periodSecondsInt : 0,
          partner: senderPk.toBase58(),
        },
        {
          sender: { publicKey: senderPk },
          isNative: false,
          metadataPubKeys: [metadataPubkey],
        }
      );

      if (ixs.length < 2) {
        enqueueSnackbar('Unexpected Streamflow SDK instruction layout', { variant: 'error' });
        return;
      }

      const createUncheckedIx = ixs[ixs.length - 1];
      const metadataCreateCandidateIx = ixs[ixs.length - 2];
      const preIxs = ixs.slice(0, -2);

      const metadataSignerFound =
        metadataCreateCandidateIx.programId.equals(SystemProgram.programId) &&
        metadataCreateCandidateIx.keys.some((k) => k.pubkey.equals(metadataPubkey) && k.isSigner);
      if (!metadataSignerFound) {
        enqueueSnackbar('Could not identify metadata setup instruction from SDK', { variant: 'error' });
        return;
      }

      const rentLamports = await RPC_CONNECTION.getMinimumBalanceForRentExemption(STREAMFLOW_METADATA_SIZE);
      const createMetadataWithSeedIx = SystemProgram.createAccountWithSeed({
        fromPubkey: senderPk,
        basePubkey: senderPk,
        seed: metadataSeed,
        newAccountPubkey: metadataPubkey,
        lamports: rentLamports,
        space: STREAMFLOW_METADATA_SIZE,
        programId: streamflowProgramId,
      });

      const proposalIxs: TransactionInstruction[] = [...preIxs, createMetadataWithSeedIx, createUncheckedIx];
      const unsupportedSigner = proposalIxs.some((ix) =>
        ix.keys.some((key) => key.isSigner && !key.pubkey.equals(senderPk))
      );
      if (unsupportedSigner) {
        enqueueSnackbar('Found unsupported extra signer in generated instructions', { variant: 'error' });
        return;
      }

      const endTs = startTs + periodSecondsInt * periodCountInt;
      const defaultDescription = [
        `Create Streamflow stream from treasury.`,
        `Recipient: ${recipientPk.toBase58()}.`,
        `Mint: ${tokenMintPk.toBase58()}.`,
        `Amount: ${cleanAmount} (decimals ${decimals}).`,
        `Cliff: ${cleanCliffAmount}.`,
        `Period: ${periodSecondsInt}s x ${periodCountInt}.`,
        `Start: ${new Date(startTs * 1000).toISOString()}.`,
        `End: ${new Date(endTs * 1000).toISOString()}.`,
      ].join(' ');

      setInstructions({
        title: cleanValue(proposalTitle || 'Create Streamflow Stream') || 'Create Streamflow Stream',
        description: cleanValue(proposalDescription || defaultDescription) || defaultDescription,
        ix: proposalIxs,
        aix: [],
        allowMissingAccountsPreflight: true,
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
        useVersionedTransactions: true,
      });

      setExpandedLoader(true);
      setOpen(false);
      if (handleCloseExtMenu) handleCloseExtMenu();
    } catch (error: any) {
      const message = error?.message || `${error}`;
      enqueueSnackbar(`Failed to build Streamflow instructions: ${message}`, { variant: 'error' });
      console.error('Streamflow instruction build failed', error);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <>
      <Tooltip title="Streamflow" placement="right">
        <MenuItem onClick={publicKey ? handleClickOpen : undefined}>
          <ListItemIcon>
            <WaterfallChartIcon fontSize="small" />
          </ListItemIcon>
          Streamflow
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
        <BootstrapDialogTitle id="streamflow-dialog" onClose={handleClose}>
          Streamflow
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Build a Streamflow stream creation instruction set for treasury governance execution.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={1.25}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Recipient Wallet"
                  variant="filled"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="SPL Token Mint"
                  variant="filled"
                  value={tokenMint}
                  onChange={(e) => setTokenMint(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                  helperText="SPL streams only in this view (native SOL mode is not enabled here)."
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Total Amount"
                  variant="filled"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Cliff Amount"
                  variant="filled"
                  value={cliffAmount}
                  onChange={(e) => setCliffAmount(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Stream Name"
                  variant="filled"
                  value={streamName}
                  onChange={(e) => setStreamName(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Start At"
                  type="datetime-local"
                  variant="filled"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Period Seconds"
                  variant="filled"
                  value={periodSeconds}
                  onChange={(e) => setPeriodSeconds(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Number of Periods"
                  variant="filled"
                  value={periodCount}
                  onChange={(e) => setPeriodCount(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={<Switch size="small" checked={canTopup} onChange={(e) => setCanTopup(e.target.checked)} />}
                  label="Can Topup"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={cancelableBySender}
                      onChange={(e) => setCancelableBySender(e.target.checked)}
                    />
                  }
                  label="Cancelable By Sender"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={cancelableByRecipient}
                      onChange={(e) => setCancelableByRecipient(e.target.checked)}
                    />
                  }
                  label="Cancelable By Recipient"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={transferableBySender}
                      onChange={(e) => setTransferableBySender(e.target.checked)}
                    />
                  }
                  label="Transferable By Sender"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={transferableByRecipient}
                      onChange={(e) => setTransferableByRecipient(e.target.checked)}
                    />
                  }
                  label="Transferable By Recipient"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={automaticWithdrawal}
                      onChange={(e) => setAutomaticWithdrawal(e.target.checked)}
                    />
                  }
                  label="Automatic Withdrawal"
                />
              </Grid>
            </Grid>
          </FormControl>

          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Created Streams</Typography>
              <Button
                size="small"
                onClick={fetchCreatedStreams}
                disabled={loadingCreatedStreams}
                sx={{ minWidth: 'auto' }}
              >
                Refresh
              </Button>
            </Box>

            {loadingCreatedStreams ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption">Loading streams...</Typography>
              </Box>
            ) : null}

            {!loadingCreatedStreams && createdStreamsError ? (
              <Typography variant="caption" sx={{ color: 'error.main' }}>
                Failed to load streams: {createdStreamsError}
              </Typography>
            ) : null}

            {!loadingCreatedStreams && !createdStreamsError && createdStreams.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                No created streams found for this treasury.
              </Typography>
            ) : null}

            {!loadingCreatedStreams && !createdStreamsError && createdStreams.length > 0 ? (
              <Stack spacing={1} sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                {createdStreams.map(({ id, stream }) => {
                  const isClosed = !!stream?.closed;
                  const depositedRaw =
                    stream?.depositedAmount && typeof stream.depositedAmount.toString === 'function'
                      ? stream.depositedAmount.toString()
                      : `${stream?.depositedAmount ?? '0'}`;
                  return (
                    <Box
                      key={id}
                      sx={{
                        p: 1,
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 1,
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                        {stream?.name || 'Unnamed Stream'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        ID: {id}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Recipient: {stream?.recipient || 'N/A'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Mint: {stream?.mint || 'N/A'}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Deposited (raw): {depositedRaw}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        Start: {formatUnixTimestamp(Number(stream?.start || 0))}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        End: {formatUnixTimestamp(Number(stream?.end || 0))}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', color: isClosed ? 'warning.main' : 'success.main' }}
                      >
                        Status: {isClosed ? 'Closed' : 'Active'}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            ) : null}
          </Box>

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

            <Box sx={{ display: 'flex', p: 0, gap: 1 }}>
              <Button
                size="small"
                component="a"
                href={STREAMFLOW_APP_URL}
                target="_blank"
                rel="noreferrer"
                sx={{ p: 1, borderRadius: '17px' }}
                startIcon={<OpenInNewIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
              >
                Open Streamflow
              </Button>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={queueStreamflowStream}
                  disabled={isBuilding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<WaterfallChartIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {isBuilding ? 'Building...' : 'Queue Stream'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
