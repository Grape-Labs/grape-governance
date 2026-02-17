import React from 'react';
import axios from 'axios';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Button,
  Chip,
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
  Switch,
  TextField,
  Tooltip,
  Typography,
  FormControlLabel,
} from '@mui/material/';
import { useSnackbar } from 'notistack';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import AdvancedProposalView from './AdvancedProposalView';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SANCTUM_API_KEY = process.env.APP_SANCTUM_API_KEY?.trim() || '';
const SANCTUM_ORDER_URL = 'https://sanctum-api.ironforge.network/swap/token/order';

type SwapMode = 'ExactIn' | 'ExactOut';

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

const isPk = (s: string) => {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
};

const normalizeMint = (value: string): string => {
  const cleaned = `${value ?? ''}`.trim();
  if (!cleaned) return '';
  if (cleaned.toLowerCase() === 'sol') return SOL_MINT;
  return cleaned;
};

const loadLookupTables = async (vtx: VersionedTransaction): Promise<AddressLookupTableAccount[]> => {
  const lookups = vtx.message.addressTableLookups || [];
  if (!lookups.length) return [];

  const loaded: AddressLookupTableAccount[] = [];
  for (const lookup of lookups) {
    const res = await RPC_CONNECTION.getAddressLookupTable(lookup.accountKey);
    if (res?.value) loaded.push(res.value);
  }
  return loaded;
};

const decodeSanctumTxInstructions = async (txBase64: string): Promise<TransactionInstruction[]> => {
  const raw = Buffer.from(txBase64, 'base64');

  try {
    const legacy = Transaction.from(raw);
    if (legacy.instructions?.length) return legacy.instructions;
  } catch {
    // Intentionally ignore and try versioned decoding next.
  }

  const vtx = VersionedTransaction.deserialize(raw);
  const lookupTableAccounts = await loadLookupTables(vtx);
  const decompiled = TransactionMessage.decompile(vtx.message, { addressLookupTableAccounts: lookupTableAccounts });
  return decompiled.instructions;
};

const getMintDecimals = async (mint: string): Promise<number> => {
  if (mint === SOL_MINT) return 9;
  const mintPk = new PublicKey(mint);
  const account = await RPC_CONNECTION.getParsedAccountInfo(mintPk);
  const decimals = (account?.value?.data as any)?.parsed?.info?.decimals;
  return typeof decimals === 'number' ? decimals : 9;
};

export default function SanctumSwapView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Sanctum LST Swap');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>('Swap tokens through Sanctum Infinity.');
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const [inputMint, setInputMint] = React.useState<string>(SOL_MINT);
  const [outputLstMint, setOutputLstMint] = React.useState<string>('');
  const [uiAmount, setUiAmount] = React.useState<string>('0.1');
  const [mode, setMode] = React.useState<SwapMode>('ExactIn');
  const [priorityFeeAuto, setPriorityFeeAuto] = React.useState<boolean>(true);
  const [priorityFeeLamports, setPriorityFeeLamports] = React.useState<string>('0');
  const [loadingQuote, setLoadingQuote] = React.useState(false);
  const [quoteResponse, setQuoteResponse] = React.useState<any>(null);
  const [quoteContext, setQuoteContext] = React.useState<{
    inMint: string;
    outMint: string;
    inDecimals: number;
    outDecimals: number;
    amountRaw: number;
  } | null>(null);

  React.useEffect(() => {
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
    } else if (realm && realm?.account?.communityMint) {
      setGoverningMint(realm?.account.communityMint);
      setIsGoverningMintCouncilSelected(false);
    }
  }, [realm, rulesWallet]);

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
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const getOrder = async (includeSigner: boolean) => {
    const inMint = normalizeMint(inputMint);
    const outMint = normalizeMint(outputLstMint);
    if (!isPk(inMint) || !isPk(outMint)) {
      throw new Error("Invalid mint(s). Use 'SOL' or valid mint addresses.");
    }

    const parsedAmount = Number(uiAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Amount must be > 0');
    }

    const [inDecimals, outDecimals] = await Promise.all([getMintDecimals(inMint), getMintDecimals(outMint)]);
    const amountDecimals = mode === 'ExactIn' ? inDecimals : outDecimals;
    const amountRaw = Math.floor(parsedAmount * 10 ** amountDecimals);
    if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
      throw new Error('Amount is too small for token decimals');
    }

    const params: Record<string, string | number> = {
      input: inMint,
      outputLstMint: outMint,
      amount: amountRaw,
      mode,
    };

    if (SANCTUM_API_KEY) params.apiKey = SANCTUM_API_KEY;

    if (includeSigner) {
      if (!governanceNativeWallet || !isPk(governanceNativeWallet)) {
        throw new Error('Missing or invalid governance native wallet');
      }
      params.signer = governanceNativeWallet;
      params.priorityFee = priorityFeeAuto ? 'auto' : Math.max(0, parseInt(priorityFeeLamports || '0', 10) || 0);
    }

    const { data } = await axios.get(SANCTUM_ORDER_URL, {
      params,
      timeout: 20_000,
      headers: SANCTUM_API_KEY ? { 'x-api-key': SANCTUM_API_KEY } : undefined,
    });

    return {
      data,
      context: {
        inMint,
        outMint,
        inDecimals,
        outDecimals,
        amountRaw,
      },
    };
  };

  const fetchQuote = async () => {
    setLoadingQuote(true);
    setQuoteResponse(null);
    setQuoteContext(null);
    try {
      const { data, context } = await getOrder(false);
      setQuoteResponse(data);
      setQuoteContext(context);
      if (!SANCTUM_API_KEY) {
        enqueueSnackbar('Tip: set APP_SANCTUM_API_KEY for higher reliability and limits.', { variant: 'info' });
      }
      setProposalTitle('Sanctum LST Swap');
      setProposalDescription(
        `Swap ${uiAmount} ${context.inMint === SOL_MINT ? 'SOL' : `${context.inMint.slice(0, 4)}...`} -> ${
          context.outMint === SOL_MINT ? 'SOL' : `${context.outMint.slice(0, 4)}...`
        } via Sanctum (${mode}).`
      );
    } catch (error: any) {
      enqueueSnackbar(`Sanctum quote failed: ${error?.message || `${error}`}`, { variant: 'error' });
      console.error('Sanctum quote failed', error);
    } finally {
      setLoadingQuote(false);
    }
  };

  const buildSwapProposal = async () => {
    if (!quoteResponse && !publicKey) return;
    try {
      const { data, context } = await getOrder(true);
      if (!data?.tx || typeof data.tx !== 'string') {
        throw new Error('Sanctum response did not return transaction payload');
      }

      const ixs = await decodeSanctumTxInstructions(data.tx);
      if (!ixs.length) {
        throw new Error('No executable instructions decoded from Sanctum transaction');
      }

      setInstructions({
        title: proposalTitle || 'Sanctum LST Swap',
        description:
          proposalDescription ||
          `Sanctum swap ${context.inMint.slice(0, 4)}... -> ${context.outMint.slice(0, 4)}... (${mode}).`,
        ix: ixs,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
      });

      setExpandedLoader(true);
      setOpen(false);
      if (handleCloseExtMenu) handleCloseExtMenu();
    } catch (error: any) {
      enqueueSnackbar(`Failed to build Sanctum swap proposal: ${error?.message || `${error}`}`, { variant: 'error' });
      console.error('Sanctum swap proposal build failed', error);
    }
  };

  return (
    <>
      <Tooltip title="Sanctum LST Swap" placement="right">
        <MenuItem onClick={publicKey ? handleOpen : undefined}>
          <ListItemIcon>
            <CurrencyExchangeIcon fontSize="small" />
          </ListItemIcon>
          Sanctum LST Swap
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
        <BootstrapDialogTitle id="sanctum-swap-dialog" onClose={handleClose}>
          Sanctum LST Swap
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Build a governance proposal that executes a liquid staking swap via Sanctum.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Input Mint (or SOL)"
                  value={inputMint}
                  onChange={(e) => setInputMint(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Output LST Mint"
                  value={outputLstMint}
                  onChange={(e) => setOutputLstMint(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label={mode === 'ExactIn' ? 'Input Amount (UI)' : 'Output Amount (UI)'}
                  type="number"
                  value={uiAmount}
                  onChange={(e) => setUiAmount(e.target.value)}
                  variant="filled"
                  inputProps={{ min: '0', step: '0.000001' }}
                  sx={{ m: 0.65 }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as SwapMode)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                >
                  <MenuItem value="ExactIn">ExactIn</MenuItem>
                  <MenuItem value="ExactOut">ExactOut</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', px: 0.65 }}>
                  <FormControlLabel
                    control={<Switch checked={priorityFeeAuto} onChange={(e) => setPriorityFeeAuto(e.target.checked)} />}
                    label={
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Auto priority fee
                      </Typography>
                    }
                  />
                </Box>
              </Grid>

              {!priorityFeeAuto ? (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Priority Fee (lamports)"
                    type="number"
                    value={priorityFeeLamports}
                    onChange={(e) => setPriorityFeeLamports(e.target.value)}
                    variant="filled"
                    inputProps={{ min: '0', step: '1' }}
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              ) : null}

              {quoteResponse ? (
                <Grid item xs={12}>
                  <Box
                    sx={{
                      mx: 0.65,
                      p: 1.25,
                      borderRadius: '12px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        Sanctum quote
                      </Typography>
                      <Chip
                        size="small"
                        label={quoteResponse?.swapSrc || 'Sanctum'}
                        sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                      />
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                      In Amount: {quoteResponse?.inAmount ?? 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)' }}>
                      Out Amount: {quoteResponse?.outAmount ?? 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.7)' }}>
                      Fee Amount: {quoteResponse?.feeAmount ?? 'N/A'} | Fee %: {quoteResponse?.feePct ?? 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                      Tx payload is only returned when signer is included.
                    </Typography>
                  </Box>
                </Grid>
              ) : null}
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

          <Box sx={{ m: 2, textAlign: 'center' }}>
            <Typography variant="caption">Sanctum API order endpoint integration.</Typography>
          </Box>

          <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', p: 0, pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {publicKey ? (
                <Button
                  size="small"
                  onClick={handleAdvancedToggle}
                  sx={{ p: 1, borderRadius: '17px', justifyContent: 'flex-start' }}
                  startIcon={<SettingsIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  Advanced
                </Button>
              ) : null}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              {publicKey ? (
                <>
                  <Button
                    size="small"
                    onClick={fetchQuote}
                    disabled={loadingQuote}
                    sx={{ p: 1, borderRadius: '17px' }}
                    startIcon={<CurrencyExchangeIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                  >
                    {loadingQuote ? 'Quoting...' : 'Get Quote'}
                  </Button>

                  <Button
                    size="small"
                    onClick={buildSwapProposal}
                    disabled={!quoteResponse || !quoteContext}
                    sx={{ p: 1, borderRadius: '17px' }}
                    startIcon={<CurrencyExchangeIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
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
