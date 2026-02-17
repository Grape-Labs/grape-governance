import React from 'react';
import { styled } from '@mui/material/styles';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  createBurnInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token-v2';
import {
  Avatar,
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
  InputLabel,
  ListItemIcon,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';

import AdvancedProposalView from './AdvancedProposalView';
import {
  HELIUS_API,
  QUICKNODE_RPC_ENDPOINT,
  RPC_CONNECTION,
  SHYFT_KEY,
} from '../../../utils/grapeTools/constants';
import {
  parseMintNaturalAmountFromDecimalAsBN,
  shortenString,
} from '../../../utils/grapeTools/helpers';
import { TokenInfo, TokenListProvider } from '@solana/spl-token-registry';

type TreasuryTokenAccount = {
  tokenAccount: string;
  mint: string;
  owner: string;
  amountRaw: string;
  decimals: number;
  amountUi: string;
};

type TokenMetadata = {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  source: 'das' | 'shyft' | 'registry' | 'unknown';
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

function cleanValue(value: string): string {
  return `${value ?? ''}`.trim();
}

function toPublicKeySafe(value?: string | null): PublicKey | null {
  if (!value) return null;
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function toBigIntSafe(value: string): bigint {
  try {
    return BigInt(value || '0');
  } catch {
    return 0n;
  }
}

function normalizeImageFromDas(asset: any): string | null {
  const directImage = cleanValue(asset?.content?.links?.image || '');
  if (directImage) return directImage;
  const files = Array.isArray(asset?.content?.files) ? asset.content.files : [];
  const imageFile = files.find((file: any) => `${file?.mime || ''}`.startsWith('image/'));
  const fileUri = cleanValue(imageFile?.uri || '');
  return fileUri || null;
}

function normalizeShyftMetadata(payload: any): TokenMetadata | null {
  const result = payload?.result || payload;
  if (!result) return null;
  const mint = cleanValue(result?.address || result?.mint || result?.token_address || '');
  const name = cleanValue(result?.name || result?.info?.name || result?.metadata?.name || '');
  const symbol = cleanValue(result?.symbol || result?.info?.symbol || result?.metadata?.symbol || '');
  const image = cleanValue(
    result?.image ||
      result?.logo ||
      result?.logo_uri ||
      result?.logoURI ||
      result?.metadata?.image ||
      ''
  );

  if (!name && !symbol && !image) return null;
  return {
    mint,
    name: name || 'Unknown Token',
    symbol,
    image: image || null,
    source: 'shyft',
  };
}

export default function TokenHousekeepingView(props: any) {
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
  const [isLoadingAccounts, setIsLoadingAccounts] = React.useState(false);
  const [isBuilding, setIsBuilding] = React.useState(false);

  const [tokenAccounts, setTokenAccounts] = React.useState<TreasuryTokenAccount[]>([]);
  const [selectedTokenAccount, setSelectedTokenAccount] = React.useState('');
  const [isResolvingTokenMetadata, setIsResolvingTokenMetadata] = React.useState(false);
  const [tokenMetadataByMint, setTokenMetadataByMint] = React.useState<Record<string, TokenMetadata>>({});

  const [burnEnabled, setBurnEnabled] = React.useState(true);
  const [burnEntireBalance, setBurnEntireBalance] = React.useState(true);
  const [burnAmount, setBurnAmount] = React.useState('');
  const [closeEnabled, setCloseEnabled] = React.useState(true);
  const [closeDestination, setCloseDestination] = React.useState('');

  const [proposalTitle, setProposalTitle] = React.useState<string | null>(
    'Token Housekeeping'
  );
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Burn and/or close treasury token accounts for housekeeping.'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);
  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);
  const tokenRegistryRef = React.useRef<Map<string, TokenInfo> | null>(null);

  const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  React.useEffect(() => {
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
      setIsGoverningMintSelectable(false);
      setIsGoverningMintCouncilSelected(true);
      return;
    }
    if (hasCommunity) {
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
      setIsGoverningMintSelectable(false);
      setIsGoverningMintCouncilSelected(false);
    }
  }, [realm, rulesWallet]);

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account?.config?.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
    }
  };

  const ensureTokenRegistry = React.useCallback(async () => {
    if (tokenRegistryRef.current) return tokenRegistryRef.current;
    try {
      const tokenList = await new TokenListProvider().resolve();
      const list = tokenList.filterByClusterSlug('mainnet-beta').getList();
      const map = new Map<string, TokenInfo>();
      for (const token of list || []) {
        map.set(token.address, token);
      }
      tokenRegistryRef.current = map;
      return map;
    } catch {
      const empty = new Map<string, TokenInfo>();
      tokenRegistryRef.current = empty;
      return empty;
    }
  }, []);

  const fetchDasMetadata = React.useCallback(async (mint: string): Promise<TokenMetadata | null> => {
    const endpoints: string[] = [];
    if (QUICKNODE_RPC_ENDPOINT) endpoints.push(QUICKNODE_RPC_ENDPOINT);
    if (HELIUS_API) endpoints.push(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API}`);
    if (SHYFT_KEY) endpoints.push(`https://rpc.shyft.to/?api_key=${SHYFT_KEY}`);

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'token-housekeeping-metadata',
            method: 'getAsset',
            params: { id: mint },
          }),
        });
        if (!response.ok) continue;
        const payload = await response.json();
        const asset = payload?.result;
        if (!asset) continue;

        const name = cleanValue(asset?.content?.metadata?.name || '');
        const symbol = cleanValue(asset?.content?.metadata?.symbol || '');
        const image = normalizeImageFromDas(asset);
        if (!name && !symbol && !image) continue;

        return {
          mint,
          name: name || 'Unknown Token',
          symbol,
          image,
          source: 'das',
        };
      } catch {
        // try next endpoint
      }
    }
    return null;
  }, []);

  const fetchShyftMetadata = React.useCallback(async (mint: string): Promise<TokenMetadata | null> => {
    if (!SHYFT_KEY) return null;
    try {
      const uri = `https://api.shyft.to/sol/v1/token/get_info?network=mainnet-beta&token_address=${mint}`;
      const response = await fetch(uri, {
        method: 'GET',
        headers: {
          'x-api-key': SHYFT_KEY,
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });
      if (!response.ok) return null;
      const payload = await response.json();
      const meta = normalizeShyftMetadata(payload);
      if (!meta) return null;
      return { ...meta, mint };
    } catch {
      return null;
    }
  }, []);

  const resolveTokenMetadata = React.useCallback(
    async (mint: string): Promise<TokenMetadata> => {
      const normalizedMint = cleanValue(mint);
      if (!normalizedMint) {
        return {
          mint: '',
          name: 'Unknown Token',
          symbol: '',
          image: null,
          source: 'unknown',
        };
      }

      const current = tokenMetadataByMint[normalizedMint];
      if (current) return current;

      const das = await fetchDasMetadata(normalizedMint);
      if (das) return das;

      const shyft = await fetchShyftMetadata(normalizedMint);
      if (shyft) return shyft;

      const registry = await ensureTokenRegistry();
      const token = registry.get(normalizedMint);
      if (token) {
        return {
          mint: normalizedMint,
          name: cleanValue(token.name) || 'Unknown Token',
          symbol: cleanValue(token.symbol || ''),
          image: cleanValue(token.logoURI || '') || null,
          source: 'registry',
        };
      }

      return {
        mint: normalizedMint,
        name: 'Unknown Token',
        symbol: '',
        image: null,
        source: 'unknown',
      };
    },
    [ensureTokenRegistry, fetchDasMetadata, fetchShyftMetadata, tokenMetadataByMint]
  );

  const refreshTokenAccounts = React.useCallback(async () => {
    const treasuryPk = toPublicKeySafe(cleanValue(governanceNativeWallet));
    if (!treasuryPk) {
      setTokenAccounts([]);
      return;
    }

    try {
      setIsLoadingAccounts(true);
      const tokenAccountsResp = await RPC_CONNECTION.getParsedTokenAccountsByOwner(
        treasuryPk,
        { programId: TOKEN_PROGRAM_ID },
        'confirmed'
      );

      const parsedAccounts: TreasuryTokenAccount[] = (tokenAccountsResp?.value || [])
        .map((item) => {
          const info = (item?.account as any)?.data?.parsed?.info;
          const tokenAmount = info?.tokenAmount;
          if (!info?.mint || !tokenAmount) return null;
          return {
            tokenAccount: item.pubkey.toBase58(),
            mint: cleanValue(info.mint),
            owner: cleanValue(info.owner),
            amountRaw: cleanValue(String(tokenAmount.amount || '0')) || '0',
            decimals: Number(tokenAmount.decimals || 0),
            amountUi: cleanValue(String(tokenAmount.uiAmountString ?? tokenAmount.uiAmount ?? '0')) || '0',
          };
        })
        .filter((item): item is TreasuryTokenAccount => !!item)
        .sort((a, b) => {
          const aAmt = toBigIntSafe(a.amountRaw);
          const bAmt = toBigIntSafe(b.amountRaw);
          if (aAmt === bAmt) return a.tokenAccount.localeCompare(b.tokenAccount);
          return bAmt > aAmt ? 1 : -1;
        });

      setTokenAccounts(parsedAccounts);
      if (parsedAccounts.length > 0) {
        const existing = parsedAccounts.find((item) => item.tokenAccount === selectedTokenAccount);
        if (!existing) {
          setSelectedTokenAccount(parsedAccounts[0].tokenAccount);
        }
      } else {
        setSelectedTokenAccount('');
      }

      const uniqueMints = Array.from(new Set(parsedAccounts.map((item) => item.mint).filter(Boolean)));
      const missingMints = uniqueMints.filter((mint) => !tokenMetadataByMint[mint]);
      if (missingMints.length > 0) {
        setIsResolvingTokenMetadata(true);
        const resolved = await Promise.all(
          missingMints.map(async (mint) => {
            const meta = await resolveTokenMetadata(mint);
            return [mint, meta] as const;
          })
        );
        setTokenMetadataByMint((prev) => {
          const next = { ...prev };
          for (const [mint, meta] of resolved) {
            next[mint] = meta;
          }
          return next;
        });
        setIsResolvingTokenMetadata(false);
      }
    } catch (error: any) {
      console.error('Failed to fetch treasury token accounts', error);
      enqueueSnackbar(error?.message || 'Failed to fetch treasury token accounts', {
        variant: 'error',
      });
      setTokenAccounts([]);
      setIsResolvingTokenMetadata(false);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, [
    governanceNativeWallet,
    selectedTokenAccount,
    enqueueSnackbar,
    resolveTokenMetadata,
    tokenMetadataByMint,
  ]);

  React.useEffect(() => {
    if (!open) return;
    refreshTokenAccounts();
    if (!closeDestination && governanceNativeWallet) {
      setCloseDestination(governanceNativeWallet);
    }
  }, [open, closeDestination, governanceNativeWallet, refreshTokenAccounts]);

  const selectedAccount = React.useMemo(
    () => tokenAccounts.find((item) => item.tokenAccount === selectedTokenAccount) || null,
    [tokenAccounts, selectedTokenAccount]
  );
  const selectedTokenMetadata = React.useMemo(() => {
    if (!selectedAccount?.mint) return null;
    return tokenMetadataByMint[selectedAccount.mint] || null;
  }, [selectedAccount, tokenMetadataByMint]);

  const expectedBurnAmountRaw = React.useMemo(() => {
    if (!selectedAccount || !burnEnabled) return 0n;
    if (burnEntireBalance) return toBigIntSafe(selectedAccount.amountRaw);
    const value = cleanValue(burnAmount);
    if (!value) return 0n;
    try {
      const parsed = parseMintNaturalAmountFromDecimalAsBN(value, selectedAccount.decimals);
      return BigInt(parsed.toString());
    } catch {
      return 0n;
    }
  }, [selectedAccount, burnEnabled, burnEntireBalance, burnAmount]);

  const expectedRemainingRaw = React.useMemo(() => {
    if (!selectedAccount) return 0n;
    const current = toBigIntSafe(selectedAccount.amountRaw);
    const burn = expectedBurnAmountRaw;
    if (burn >= current) return 0n;
    return current - burn;
  }, [selectedAccount, expectedBurnAmountRaw]);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const buildInstructions = async (): Promise<TransactionInstruction[]> => {
    const treasuryPk = toPublicKeySafe(cleanValue(governanceNativeWallet));
    if (!treasuryPk) throw new Error('Missing governance treasury wallet');
    if (!selectedAccount) throw new Error('Select a treasury token account');

    const tokenAccountPk = new PublicKey(selectedAccount.tokenAccount);
    const mintPk = new PublicKey(selectedAccount.mint);
    const ownerPk = new PublicKey(selectedAccount.owner);
    if (!ownerPk.equals(treasuryPk)) {
      throw new Error('Selected token account is not owned by treasury wallet');
    }

    const ixs: TransactionInstruction[] = [];
    if (!burnEnabled && !closeEnabled) {
      throw new Error('Enable at least one operation: Burn or Close');
    }

    if (burnEnabled) {
      if (expectedBurnAmountRaw <= 0n) {
        throw new Error('Burn amount must be greater than zero');
      }
      const current = toBigIntSafe(selectedAccount.amountRaw);
      if (expectedBurnAmountRaw > current) {
        throw new Error('Burn amount exceeds current token account balance');
      }
      ixs.push(
        createBurnInstruction(
          tokenAccountPk,
          mintPk,
          treasuryPk,
          expectedBurnAmountRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    if (closeEnabled) {
      const destinationPk = toPublicKeySafe(cleanValue(closeDestination));
      if (!destinationPk) {
        throw new Error('Invalid close destination wallet');
      }
      if (expectedRemainingRaw > 0n) {
        throw new Error('Cannot close a non-empty token account. Burn full balance first or disable close.');
      }
      ixs.push(
        createCloseAccountInstruction(
          tokenAccountPk,
          destinationPk,
          treasuryPk,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    return ixs;
  };

  const queueHousekeepingProposal = async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    try {
      const ixs = await buildInstructions();
      const defaultTitle =
        burnEnabled && closeEnabled
          ? 'Token Housekeeping: Burn and Close'
          : burnEnabled
          ? 'Token Housekeeping: Burn'
          : 'Token Housekeeping: Close Account';
      const defaultDescription = burnEnabled
        ? `Housekeeping for token account ${selectedAccount?.tokenAccount}: burn ${
            burnEntireBalance ? 'full balance' : cleanValue(burnAmount)
          } and${closeEnabled ? '' : ' do not'} close account.`
        : `Close empty token account ${selectedAccount?.tokenAccount}.`;

      setInstructions({
        title: cleanValue(proposalTitle || defaultTitle) || defaultTitle,
        description: cleanValue(proposalDescription || defaultDescription) || defaultDescription,
        ix: ixs,
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
      });
      setExpandedLoader(true);
      handleClose();
    } catch (error: any) {
      const message = error?.message || `${error}`;
      enqueueSnackbar(`Token housekeeping build failed: ${message}`, { variant: 'error' });
      console.error('Token housekeeping build failed', error);
    } finally {
      setIsBuilding(false);
    }
  };

  return (
    <>
      <Tooltip title="Token Housekeeping" placement="right">
        <MenuItem onClick={publicKey ? () => setOpen(true) : undefined}>
          <ListItemIcon>
            <DeleteSweepIcon fontSize="small" />
          </ListItemIcon>
          Token Housekeeping
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
        <BootstrapDialogTitle id="token-housekeeping-dialog" onClose={handleClose}>
          Token Housekeeping
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Burn and/or close treasury token accounts to keep the treasury clean.
          </DialogContentText>

          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id="token-housekeeping-account-label">Treasury Token Account</InputLabel>
                  <Select
                    labelId="token-housekeeping-account-label"
                    label="Treasury Token Account"
                    value={selectedTokenAccount}
                    onChange={(event) => setSelectedTokenAccount(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  >
                    {tokenAccounts.length === 0 ? <MenuItem value="">None found</MenuItem> : null}
                    {tokenAccounts.map((item) => (
                      <MenuItem key={item.tokenAccount} value={item.tokenAccount}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                          <Avatar
                            src={tokenMetadataByMint[item.mint]?.image || undefined}
                            sx={{ width: 20, height: 20 }}
                          />
                          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <Typography variant="body2" sx={{ lineHeight: 1.2 }}>
                              {tokenMetadataByMint[item.mint]?.name || shortenString(item.mint, 4, 4)}
                              {tokenMetadataByMint[item.mint]?.symbol
                                ? ` (${tokenMetadataByMint[item.mint]?.symbol})`
                                : ''}
                            </Typography>
                            <Typography variant="caption" sx={{ opacity: 0.75, lineHeight: 1.2 }}>
                              {`${item.amountUi} · ${shortenString(item.tokenAccount, 4, 4)}`}
                            </Typography>
                          </Box>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  size="small"
                  onClick={refreshTokenAccounts}
                  disabled={isLoadingAccounts}
                >
                  {isLoadingAccounts ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.75 }}>
                {isResolvingTokenMetadata
                  ? 'Resolving token metadata via DAS/Shyft/Registry...'
                  : `Metadata cache: ${Object.keys(tokenMetadataByMint).length} token(s)`}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Mint / Token"
                variant="filled"
                value={
                  selectedAccount
                    ? `${selectedTokenMetadata?.name || 'Unknown Token'}${
                        selectedTokenMetadata?.symbol ? ` (${selectedTokenMetadata.symbol})` : ''
                      } - ${selectedAccount.mint}`
                    : ''
                }
                onKeyDown={stopInputKeyPropagation}
                disabled
              />
              {selectedTokenMetadata ? (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.75 }}>
                  Metadata source: {selectedTokenMetadata.source.toUpperCase()}
                </Typography>
              ) : null}
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Current Balance"
                variant="filled"
                value={selectedAccount ? `${selectedAccount.amountUi} (raw: ${selectedAccount.amountRaw})` : ''}
                onKeyDown={stopInputKeyPropagation}
                disabled
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={burnEnabled}
                    onChange={(event) => setBurnEnabled(event.target.checked)}
                  />
                }
                label="Burn Tokens"
              />
            </Grid>

            {burnEnabled ? (
              <>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={burnEntireBalance}
                        onChange={(event) => setBurnEntireBalance(event.target.checked)}
                      />
                    }
                    label="Burn Full Balance"
                  />
                </Grid>
                {!burnEntireBalance ? (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Burn Amount"
                      variant="filled"
                      value={burnAmount}
                      onChange={(event) => setBurnAmount(event.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                      helperText={`Amount in token units (${selectedAccount?.decimals ?? 0} decimals).`}
                    />
                  </Grid>
                ) : null}
              </>
            ) : null}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={closeEnabled}
                    onChange={(event) => setCloseEnabled(event.target.checked)}
                  />
                }
                label="Close Token Account"
              />
            </Grid>

            {closeEnabled ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Close Destination Wallet"
                  variant="filled"
                  value={closeDestination}
                  onChange={(event) => setCloseDestination(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                  helperText="Receives rent when token account is closed."
                />
              </Grid>
            ) : null}

            <Grid item xs={12}>
              <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                Expected remaining after burn: {expectedRemainingRaw.toString()} raw units.
              </Typography>
              {closeEnabled && expectedRemainingRaw > 0n ? (
                <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                  Close will fail unless remaining balance is zero.
                </Typography>
              ) : null}
            </Grid>
          </Grid>

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
                  onClick={queueHousekeepingProposal}
                  disabled={isBuilding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<DeleteSweepIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {isBuilding ? 'Building...' : 'Create Housekeeping Proposal'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
