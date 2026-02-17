import React from 'react';
import { Buffer } from 'buffer';
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';
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
import TokenIcon from '@mui/icons-material/Token';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import { useSnackbar } from 'notistack';
import {
  getCreateMetadataAccountV3InstructionDataSerializer,
  getUpdateMetadataAccountV2InstructionDataSerializer,
} from '@metaplex-foundation/mpl-token-metadata';
import AdvancedProposalView from './AdvancedProposalView';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

type MetadataActionMode = 'auto' | 'create' | 'update';

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

function requirePubkey(value: string, label: string): PublicKey {
  try {
    return new PublicKey(cleanValue(value));
  } catch {
    throw new Error(`Invalid ${label}`);
  }
}

function toPublicKeySafe(value?: string | null): PublicKey | null {
  try {
    if (!value) return null;
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function deriveMetadataPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  )[0];
}

function parseBps(value: string): number {
  const normalized = cleanValue(value);
  if (!/^\d+$/.test(normalized)) throw new Error('Seller fee bps must be a non-negative integer');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10000) {
    throw new Error('Seller fee bps must be between 0 and 10000');
  }
  return parsed;
}

async function metadataExistsForMint(mint: PublicKey): Promise<boolean> {
  const pda = deriveMetadataPda(mint);
  const account = await RPC_CONNECTION.getAccountInfo(pda);
  return !!account;
}

export default function TokenMetadataView(props: any) {
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
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [isCheckingMetadata, setIsCheckingMetadata] = React.useState(false);
  const [metadataExists, setMetadataExists] = React.useState<boolean | null>(null);

  const [actionMode, setActionMode] = React.useState<MetadataActionMode>('auto');
  const [mintAddress, setMintAddress] = React.useState('');
  const [mintAuthority, setMintAuthority] = React.useState('');
  const [payerAddress, setPayerAddress] = React.useState('');
  const [updateAuthority, setUpdateAuthority] = React.useState('');
  const [newUpdateAuthority, setNewUpdateAuthority] = React.useState('');
  const [name, setName] = React.useState('');
  const [symbol, setSymbol] = React.useState('');
  const [uri, setUri] = React.useState('');
  const [sellerFeeBps, setSellerFeeBps] = React.useState('0');
  const [isMutable, setIsMutable] = React.useState(true);
  const [applyPrimarySaleHappened, setApplyPrimarySaleHappened] = React.useState(true);
  const [primarySaleHappened, setPrimarySaleHappened] = React.useState(true);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>('Token Metadata');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Create or update token metadata for a governed mint.'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);
  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const stopInputKeyPropagation = (event: React.KeyboardEvent) => {
    event.stopPropagation();
  };

  React.useEffect(() => {
    const fallback = cleanValue(governanceNativeWallet || '');
    setMintAuthority(fallback);
    setPayerAddress(fallback);
    setUpdateAuthority(fallback);
    setNewUpdateAuthority('');
  }, [governanceNativeWallet]);

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

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const mint = toPublicKeySafe(mintAddress);
      if (!mint || !open) {
        setMetadataExists(null);
        return;
      }
      setIsCheckingMetadata(true);
      try {
        const exists = await metadataExistsForMint(mint);
        if (!cancelled) setMetadataExists(exists);
      } catch {
        if (!cancelled) setMetadataExists(null);
      } finally {
        if (!cancelled) setIsCheckingMetadata(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [mintAddress, open]);

  const toggleGoverningMintSelected = (council: boolean) => {
    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(realm?.account?.config?.councilMint);
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(realm?.account?.communityMint || realm?.communityMint);
    }
  };

  const handleAdvancedToggle = () => setOpenAdvanced((prev) => !prev);
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const buildCreateInstruction = (mint: PublicKey, metadataPda: PublicKey): TransactionInstruction => {
    const payer = requirePubkey(payerAddress, 'Payer');
    const mintAuthorityPk = requirePubkey(mintAuthority, 'Mint Authority');
    const updateAuthorityPk = requirePubkey(updateAuthority, 'Update Authority');
    const bps = parseBps(sellerFeeBps);

    const data = Buffer.from(
      getCreateMetadataAccountV3InstructionDataSerializer().serialize({
        data: {
          name: cleanValue(name),
          symbol: cleanValue(symbol),
          uri: cleanValue(uri),
          sellerFeeBasisPoints: bps,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable,
        collectionDetails: null,
      })
    );

    return new TransactionInstruction({
      programId: TOKEN_METADATA_PROGRAM_ID,
      keys: [
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: mintAuthorityPk, isSigner: true, isWritable: false },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: updateAuthorityPk, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    });
  };

  const buildUpdateInstruction = (metadataPda: PublicKey): TransactionInstruction => {
    const updateAuthorityPk = requirePubkey(updateAuthority, 'Update Authority');
    const bps = parseBps(sellerFeeBps);
    const nextUpdateAuthority = cleanValue(newUpdateAuthority)
      ? requirePubkey(newUpdateAuthority, 'New Update Authority')
      : null;

    const data = Buffer.from(
      getUpdateMetadataAccountV2InstructionDataSerializer().serialize({
        data: {
          name: cleanValue(name),
          symbol: cleanValue(symbol),
          uri: cleanValue(uri),
          sellerFeeBasisPoints: bps,
          creators: null,
          collection: null,
          uses: null,
        },
        newUpdateAuthority: nextUpdateAuthority ? nextUpdateAuthority.toBase58() : null,
        primarySaleHappened: applyPrimarySaleHappened ? primarySaleHappened : null,
        isMutable,
      })
    );

    return new TransactionInstruction({
      programId: TOKEN_METADATA_PROGRAM_ID,
      keys: [
        { pubkey: metadataPda, isSigner: false, isWritable: true },
        { pubkey: updateAuthorityPk, isSigner: true, isWritable: false },
      ],
      data,
    });
  };

  const createTokenMetadataProposal = async () => {
    if (isBuilding) return;
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    setIsBuilding(true);
    try {
      const mint = requirePubkey(mintAddress, 'Mint');
      const metadataPda = deriveMetadataPda(mint);

      const onchainMetadataExists =
        metadataExists === null ? await metadataExistsForMint(mint) : metadataExists;

      const resolvedAction =
        actionMode === 'auto' ? (onchainMetadataExists ? 'update' : 'create') : actionMode;

      if (!cleanValue(name) || !cleanValue(symbol) || !cleanValue(uri)) {
        throw new Error('Name, Symbol and URI are required');
      }

      const ix =
        resolvedAction === 'create'
          ? buildCreateInstruction(mint, metadataPda)
          : buildUpdateInstruction(metadataPda);

      const defaultTitle =
        resolvedAction === 'create'
          ? `Create token metadata for ${mint.toBase58()}`
          : `Update token metadata for ${mint.toBase58()}`;
      const defaultDescription =
        resolvedAction === 'create'
          ? 'Create Metaplex token metadata account for governed mint.'
          : 'Update Metaplex token metadata account for governed mint.';

      setInstructions({
        title: cleanValue(proposalTitle || defaultTitle) || defaultTitle,
        description: cleanValue(proposalDescription || defaultDescription) || defaultDescription,
        ix: [ix],
        aix: [],
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
        queueOnly: false,
        skipQueueEntry: true,
      });

      setExpandedLoader(true);
      setOpen(false);
      if (handleCloseExtMenu) handleCloseExtMenu();
    } catch (error: any) {
      const message = error?.message || `${error}`;
      enqueueSnackbar(`Token metadata instruction build failed: ${message}`, { variant: 'error' });
      // eslint-disable-next-line no-console
      console.error('Token metadata instruction build failed', error);
    } finally {
      setIsBuilding(false);
    }
  };

  const metadataPdaPreview = React.useMemo(() => {
    const mint = toPublicKeySafe(mintAddress);
    if (!mint) return null;
    return deriveMetadataPda(mint).toBase58();
  }, [mintAddress]);

  return (
    <>
      <Tooltip title="Token Metadata (Realms style create/update)">
        <MenuItem onClick={publicKey ? handleOpen : undefined}>
          <ListItemIcon>
            <TokenIcon fontSize="small" />
          </ListItemIcon>
          Token Metadata
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
        <BootstrapDialogTitle id="token-metadata-dialog" onClose={handleClose}>
          Token Metadata
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Auto create if missing, update if already present.
          </DialogContentText>

          <Grid container spacing={1.25}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel id="token-metadata-action-label">Action</InputLabel>
                <Select
                  labelId="token-metadata-action-label"
                  label="Action"
                  value={actionMode}
                  onChange={(event) => setActionMode(event.target.value as MetadataActionMode)}
                >
                  <MenuItem value="auto">Auto (create or update)</MenuItem>
                  <MenuItem value="create">Create only</MenuItem>
                  <MenuItem value="update">Update only</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Mint Address"
                variant="filled"
                value={mintAddress}
                onChange={(event) => setMintAddress(event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Name"
                variant="filled"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Symbol"
                variant="filled"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Metadata URI"
                variant="filled"
                value={uri}
                onChange={(event) => setUri(event.target.value)}
                helperText="Provide URI to JSON metadata (e.g. Irys/Arweave/IPFS URL)."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Seller Fee Basis Points"
                variant="filled"
                value={sellerFeeBps}
                onChange={(event) => setSellerFeeBps(event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Update Authority (signer)"
                variant="filled"
                value={updateAuthority}
                onChange={(event) => setUpdateAuthority(event.target.value)}
              />
            </Grid>

            {(actionMode === 'auto' || actionMode === 'create') ? (
              <>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Mint Authority (create signer)"
                    variant="filled"
                    value={mintAuthority}
                    onChange={(event) => setMintAuthority(event.target.value)}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Payer (create signer)"
                    variant="filled"
                    value={payerAddress}
                    onChange={(event) => setPayerAddress(event.target.value)}
                  />
                </Grid>
              </>
            ) : null}

            {(actionMode === 'auto' || actionMode === 'update') ? (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="New Update Authority (optional)"
                  variant="filled"
                  value={newUpdateAuthority}
                  onChange={(event) => setNewUpdateAuthority(event.target.value)}
                />
              </Grid>
            ) : null}

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={isMutable}
                    onChange={(event) => setIsMutable(event.target.checked)}
                  />
                }
                label="Mutable"
              />
            </Grid>

            {(actionMode === 'auto' || actionMode === 'update') ? (
              <>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={applyPrimarySaleHappened}
                        onChange={(event) => setApplyPrimarySaleHappened(event.target.checked)}
                      />
                    }
                    label="Set Primary Sale Happened Flag"
                  />
                </Grid>
                {applyPrimarySaleHappened ? (
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={primarySaleHappened}
                          onChange={(event) => setPrimarySaleHappened(event.target.checked)}
                        />
                      }
                      label={`Primary Sale Happened: ${primarySaleHappened ? 'true' : 'false'}`}
                    />
                  </Grid>
                ) : null}
              </>
            ) : null}

            <Grid item xs={12}>
              <Box sx={{ p: 1, border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px' }}>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                  Program: {TOKEN_METADATA_PROGRAM_ID.toBase58()}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                  Metadata PDA: {metadataPdaPreview || 'Enter valid mint'}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                  On-chain metadata exists:{' '}
                  {isCheckingMetadata
                    ? 'checking...'
                    : metadataExists === null
                    ? 'unknown'
                    : metadataExists
                    ? 'yes'
                    : 'no'}
                </Typography>
              </Box>
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

          <Box alignItems="center" alignContent="center" justifyContent="center" sx={{ m: 2, textAlign: 'center' }}>
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

            <Box sx={{ display: 'flex', p: 0 }}>
              {publicKey ? (
                <Button
                  autoFocus
                  onClick={createTokenMetadataProposal}
                  disabled={isBuilding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<TokenIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {isBuilding ? 'Building...' : 'Create Metadata Proposal'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
