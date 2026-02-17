import React from 'react';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
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
  ListItemIcon,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import AdvancedProposalView from './AdvancedProposalView';
import { BASE_PRECISION, PRICE_PRECISION } from '@drift-labs/sdk/lib/browser/constants/numericConstants';
import { BulkAccountLoader } from '@drift-labs/sdk/lib/browser/accounts/bulkAccountLoader';
import { DriftClient } from '@drift-labs/sdk/lib/browser/driftClient';
import { PerpMarkets } from '@drift-labs/sdk/lib/browser/constants/perpMarkets';
import { PositionDirection } from '@drift-labs/sdk/lib/browser/types';
import { getMarketOrderParams } from '@drift-labs/sdk/lib/browser/orderParams';
import { initialize } from '@drift-labs/sdk/lib/browser/config';
import { BN } from '@coral-xyz/anchor';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';

const DRIFT_APP_URL = 'https://app.drift.trade';
const DRIFT_QUOTE_SPOT_MARKET_INDEX = 0;
const DEFAULT_MARKET = 'SOL-PERP';

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

function detectDriftEnv(endpoint?: string): 'devnet' | 'mainnet-beta' {
  const normalized = `${endpoint ?? ''}`.toLowerCase();
  if (normalized.includes('devnet') || normalized.includes('localhost') || normalized.includes('127.0.0.1')) {
    return 'devnet';
  }
  return 'mainnet-beta';
}

function precisionToDecimals(precision: BN): number {
  return Math.max(0, precision.toString().length - 1);
}

function isPositiveDecimal(value: string): boolean {
  const normalized = cleanValue(value);
  if (!normalized) return false;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return false;
  return Number(normalized) > 0;
}

function decimalToBn(value: string, precision: BN): BN | null {
  const normalized = cleanValue(value);
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

  const decimals = precisionToDecimals(precision);
  const [wholePart, fractionalPart = ''] = normalized.split('.');
  const wholeBn = new BN(wholePart || '0').mul(precision);
  const scaledFraction = fractionalPart.slice(0, decimals).padEnd(decimals, '0');
  const fractionBn = scaledFraction ? new BN(scaledFraction) : new BN(0);

  return wholeBn.add(fractionBn);
}

function bnToUiString(value: BN, decimals: number, maxFraction = 6): string {
  const negative = value.isNeg();
  const base = new BN(10).pow(new BN(decimals));
  const absolute = negative ? value.neg() : value;
  const whole = absolute.div(base).toString();
  const fraction = absolute.mod(base).toString().padStart(decimals, '0');
  const shownFraction = fraction.slice(0, Math.max(0, maxFraction)).replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole}${shownFraction ? `.${shownFraction}` : ''}`;
}

export default function DriftTradeView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Queue Drift Market Order');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Create executable Drift order instruction(s) for this governance wallet.'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const driftEnv = React.useMemo(() => detectDriftEnv((RPC_CONNECTION as any)?.rpcEndpoint), []);
  const marketOptions = React.useMemo(() => PerpMarkets[driftEnv] || [], [driftEnv]);

  const [market, setMarket] = React.useState(DEFAULT_MARKET);
  const [side, setSide] = React.useState('LONG');
  const [baseSize, setBaseSize] = React.useState('');
  const [notionalUsd, setNotionalUsd] = React.useState('');
  const [leverage, setLeverage] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isBuilding, setIsBuilding] = React.useState(false);

  const { publicKey, signTransaction, signAllTransactions } = useWallet();
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

  React.useEffect(() => {
    if (marketOptions.length === 0) return;
    const hasCurrent = marketOptions.some((item) => item.symbol.toUpperCase() === cleanValue(market).toUpperCase());
    if (!hasCurrent) {
      setMarket(marketOptions[0]?.symbol || DEFAULT_MARKET);
    }
  }, [marketOptions, market]);

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

  const queueDriftOrder = async () => {
    if (isBuilding) return;

    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    if (!publicKey || !signTransaction || !signAllTransactions) {
      enqueueSnackbar('Wallet must support signing to build Drift instructions', { variant: 'error' });
      return;
    }

    const cleanMarket = cleanValue(market || DEFAULT_MARKET).toUpperCase() || DEFAULT_MARKET;
    const cleanSide = cleanValue(side || 'LONG').toUpperCase() || 'LONG';
    const cleanBaseSize = cleanValue(baseSize || '');
    const cleanNotional = cleanValue(notionalUsd || '');
    const cleanLeverage = cleanValue(leverage || '');
    const cleanNotes = cleanValue(notes || '');

    const matchedMarket = marketOptions.find((item) => item.symbol.toUpperCase() === cleanMarket);
    if (!matchedMarket) {
      enqueueSnackbar('Invalid Drift market symbol', { variant: 'error' });
      return;
    }

    if (cleanSide !== 'LONG' && cleanSide !== 'SHORT') {
      enqueueSnackbar('Side must be LONG or SHORT', { variant: 'error' });
      return;
    }

    if (cleanBaseSize && !isPositiveDecimal(cleanBaseSize)) {
      enqueueSnackbar('Base size must be a positive number', { variant: 'error' });
      return;
    }

    if (!cleanBaseSize && !cleanNotional) {
      enqueueSnackbar('Provide Base Size or Notional USD', { variant: 'error' });
      return;
    }

    if (cleanNotional && !isPositiveDecimal(cleanNotional)) {
      enqueueSnackbar('Notional USD must be a positive number', { variant: 'error' });
      return;
    }

    if (cleanLeverage && !isPositiveDecimal(cleanLeverage)) {
      enqueueSnackbar('Leverage must be a positive number', { variant: 'error' });
      return;
    }

    setIsBuilding(true);
    let driftClient: any = null;

    try {
      const sdkConfig = initialize({ env: driftEnv });
      const accountLoader = new BulkAccountLoader(RPC_CONNECTION as any, 'confirmed', 600);
      const driftWallet = {
        publicKey,
        signTransaction,
        signAllTransactions,
      };

      driftClient = new DriftClient({
        connection: RPC_CONNECTION as any,
        wallet: driftWallet as any,
        programID: new PublicKey(sdkConfig.DRIFT_PROGRAM_ID) as any,
        env: driftEnv,
        accountSubscription: {
          type: 'polling',
          accountLoader,
        },
      } as any);

      await driftClient.subscribe();

      let baseAmount = cleanBaseSize ? decimalToBn(cleanBaseSize, BASE_PRECISION) : null;
      let derivedFromNotional = false;
      let oraclePriceDisplay = '';

      if (!baseAmount && cleanNotional) {
        const oracleData = driftClient.getOracleDataForPerpMarket(matchedMarket.marketIndex);
        if (!oracleData?.price || oracleData.price.lte(new BN(0))) {
          enqueueSnackbar('Could not load valid oracle price for this market', { variant: 'error' });
          return;
        }

        const notionalBn = decimalToBn(cleanNotional, PRICE_PRECISION);
        if (!notionalBn) {
          enqueueSnackbar('Invalid notional format', { variant: 'error' });
          return;
        }

        baseAmount = notionalBn.mul(BASE_PRECISION).div(oracleData.price);
        derivedFromNotional = true;
        oraclePriceDisplay = bnToUiString(oracleData.price, precisionToDecimals(PRICE_PRECISION), 4);
      }

      if (!baseAmount || baseAmount.lte(new BN(0))) {
        enqueueSnackbar('Order size is too small after precision conversion', { variant: 'error' });
        return;
      }

      const userAccountPubkey = await driftClient.getUserAccountPublicKey(0);
      const userAccountInfo = await RPC_CONNECTION.getAccountInfo(new PublicKey(userAccountPubkey.toBase58()));

      let initializeUserIxs: TransactionInstruction[] = [];
      let depositToTradeArgs:
        | {
            isMakingNewAccount: boolean;
            depositMarketIndex: number;
          }
        | undefined;

      if (!userAccountInfo) {
        const [initializeIxs] = await driftClient.getInitializeUserAccountIxs(0);
        initializeUserIxs = initializeIxs;
        depositToTradeArgs = {
          isMakingNewAccount: true,
          depositMarketIndex: DRIFT_QUOTE_SPOT_MARKET_INDEX,
        };
      } else if (!driftClient.hasUser(0)) {
        await driftClient.addUser(0);
      }

      const orderParams = getMarketOrderParams({
        marketIndex: matchedMarket.marketIndex,
        baseAssetAmount: baseAmount,
        direction: cleanSide === 'SHORT' ? PositionDirection.SHORT : PositionDirection.LONG,
      });

      const placeOrderIx = await driftClient.getPlacePerpOrderIx(orderParams, 0, depositToTradeArgs);
      const proposalIxs: TransactionInstruction[] = [...initializeUserIxs, placeOrderIx];

      const defaultDescription = [
        `Create a Drift ${cleanSide} market order on ${matchedMarket.symbol}.`,
        `Base size: ${bnToUiString(baseAmount, precisionToDecimals(BASE_PRECISION), 6)} ${matchedMarket.baseAssetSymbol}.`,
        derivedFromNotional
          ? `Derived from ~$${cleanNotional}${oraclePriceDisplay ? ` using oracle ~$${oraclePriceDisplay}` : ''}.`
          : '',
        cleanLeverage ? `Leverage note: ${cleanLeverage}x (position sizing is enforced by order size).` : '',
        cleanNotes ? `Notes: ${cleanNotes}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      setInstructions({
        title: cleanValue(proposalTitle || 'Queue Drift Market Order') || 'Queue Drift Market Order',
        description: cleanValue(proposalDescription || defaultDescription) || defaultDescription,
        ix: proposalIxs,
        aix: [],
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
      enqueueSnackbar(`Failed to build Drift order instructions: ${message}`, { variant: 'error' });
      console.error('Drift order instruction build failed', error);
    } finally {
      try {
        if (driftClient) {
          await driftClient.unsubscribe();
        }
      } catch (cleanupError) {
        console.warn('Failed to unsubscribe drift client', cleanupError);
      }
      setIsBuilding(false);
    }
  };

  return (
    <>
      <Tooltip title="Drift Trade" placement="right">
        <MenuItem onClick={publicKey ? handleClickOpen : undefined}>
          <ListItemIcon>
            <ShowChartIcon fontSize="small" />
          </ListItemIcon>
          Drift Trade
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
        <BootstrapDialogTitle id="drift-trade-dialog" onClose={handleClose}>
          Drift Trade
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Build executable Drift order instructions and queue them into a governance proposal.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={1.25}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Market"
                  variant="filled"
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                >
                  {marketOptions.map((item) => (
                    <MenuItem key={item.marketIndex} value={item.symbol}>
                      {item.symbol}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Side"
                  variant="filled"
                  value={side}
                  onChange={(e) => setSide(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                >
                  <MenuItem value="LONG">LONG</MenuItem>
                  <MenuItem value="SHORT">SHORT</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Base Size (preferred)"
                  variant="filled"
                  value={baseSize}
                  onChange={(e) => setBaseSize(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                  placeholder="e.g. 1.25"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notional USD"
                  variant="filled"
                  value={notionalUsd}
                  onChange={(e) => setNotionalUsd(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  helperText="Used only when Base Size is empty; converted with current oracle price."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Leverage"
                  variant="filled"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">x</InputAdornment>,
                  }}
                  helperText="Leverage is informational here; size drives risk."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Notes (optional)"
                  variant="filled"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ opacity: 0.72, display: 'block' }}>
                  Orders execute from the governance treasury Drift account. If no Drift user account exists, init instructions are included automatically.
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
                href={DRIFT_APP_URL}
                target="_blank"
                rel="noreferrer"
                sx={{ p: 1, borderRadius: '17px' }}
                startIcon={<OpenInNewIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
              >
                Open Drift
              </Button>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={queueDriftOrder}
                  disabled={isBuilding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<ShowChartIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {isBuilding ? 'Building...' : 'Queue Drift Order'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
