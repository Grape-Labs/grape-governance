import React from 'react';
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import { useSnackbar } from 'notistack';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import SettingsIcon from '@mui/icons-material/Settings';
import RefreshIcon from '@mui/icons-material/Refresh';
import CloseIcon from '@mui/icons-material/Close';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TokenIcon from '@mui/icons-material/Token';

import AdvancedProposalView from './AdvancedProposalView';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { shortenString } from '../../../utils/grapeTools/helpers';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MintLayout,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token-v2';

import {
  VINE_REP_PROGRAM_ID,
  fetchAllSpaces,
  fetchConfig,
  fetchProjectMetadata,
  buildInitializeConfigIx,
  buildUpsertProjectMetadataIx,
  buildSetAuthorityIx,
  buildSetSeasonIx,
  buildSetDecayBpsIx,
  buildSetRepMintIx,
  buildAddReputationIx,
  buildResetReputationIx,
  buildTransferReputationIx,
  buildCloseReputationIx,
} from '@grapenpm/vine-reputation-client';

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

type OgAction =
  | 'initialize'
  | 'upsert_metadata'
  | 'set_authority'
  | 'set_season'
  | 'set_decay'
  | 'set_rep_mint'
  | 'add_points'
  | 'reset_user'
  | 'transfer_user'
  | 'close_reputation';

const U64_MAX = 18446744073709551615n;

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

const parsePublicKey = (value: string, label: string): PublicKey => {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Invalid ${label} public key`);
  }
};

const parseU16 = (value: string, label: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`${label} must be an integer between 0 and 65535`);
  }
  return parsed;
};

const parseU64 = (value: string, label: string): bigint => {
  const clean = `${value || ''}`.trim();
  if (!/^\d+$/.test(clean)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  const parsed = BigInt(clean);
  if (parsed < 0n || parsed > U64_MAX) {
    throw new Error(`${label} must be within u64 range`);
  }
  return parsed;
};

const parseOptionalU16 = (value: string): number | undefined => {
  const clean = `${value || ''}`.trim();
  if (!clean.length) return undefined;
  return parseU16(clean, 'Season');
};

const parseMintDecimals = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed > 12) {
    throw new Error('Mint decimals must be an integer between 0 and 12');
  }
  return parsed;
};

const pow10n = (exp: number): bigint => 10n ** BigInt(exp);

const parseTokenUiAmountToRawNumber = (value: string, decimals: number): number => {
  const clean = `${value || ''}`.trim();
  if (!clean.length) return 0;
  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error('Initial supply must be a non-negative number');
  }
  const [wholePart, fracPartRaw = ''] = clean.split('.');
  if (fracPartRaw.length > decimals) {
    throw new Error(`Initial supply has too many decimal places (max ${decimals})`);
  }
  const fracPart = fracPartRaw.padEnd(decimals, '0');
  const raw = BigInt(wholePart || '0') * pow10n(decimals) + BigInt(fracPart || '0');
  if (raw > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Initial supply too large');
  }
  return Number(raw);
};

const actionLabel: Record<OgAction, string> = {
  initialize: 'Initialize Space',
  upsert_metadata: 'Upsert Metadata URI',
  set_authority: 'Set Authority',
  set_season: 'Set Season',
  set_decay: 'Set Decay BPS',
  set_rep_mint: 'Set REP Mint',
  add_points: 'Add Reputation Points',
  reset_user: 'Reset User Reputation',
  transfer_user: 'Transfer User Reputation',
  close_reputation: 'Close User Reputation',
};

export default function OgReputationView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [loadingSpaces, setLoadingSpaces] = React.useState(false);
  const [loadingSpaceDetails, setLoadingSpaceDetails] = React.useState(false);
  const [building, setBuilding] = React.useState(false);
  const [creatingRepMint, setCreatingRepMint] = React.useState(false);

  const [proposalTitle, setProposalTitle] = React.useState<string | null>('OG Reputation Action');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Execute an OG Reputation Spaces instruction.'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);

  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);

  const [action, setAction] = React.useState<OgAction>('add_points');
  const [daoId, setDaoId] = React.useState<string>('');
  const [spaces, setSpaces] = React.useState<any[]>([]);
  const [spaceConfig, setSpaceConfig] = React.useState<any>(null);
  const [spaceMetadata, setSpaceMetadata] = React.useState<any>(null);
  const [spaceAuthorityMatch, setSpaceAuthorityMatch] = React.useState<boolean | null>(null);

  const [repMint, setRepMint] = React.useState<string>('');
  const [newMintDecimals, setNewMintDecimals] = React.useState<string>('0');
  const [newMintInitialSupply, setNewMintInitialSupply] = React.useState<string>('0');
  const [initialSeason, setInitialSeason] = React.useState<string>('1');
  const [metadataUri, setMetadataUri] = React.useState<string>('');
  const [newAuthority, setNewAuthority] = React.useState<string>('');
  const [newSeason, setNewSeason] = React.useState<string>('');
  const [decayBps, setDecayBps] = React.useState<string>('0');
  const [user, setUser] = React.useState<string>('');
  const [amount, setAmount] = React.useState<string>('0');
  const [addPointsBatchCsv, setAddPointsBatchCsv] = React.useState<string>('');
  const [season, setSeason] = React.useState<string>('');
  const [fromUser, setFromUser] = React.useState<string>('');
  const [toUser, setToUser] = React.useState<string>('');
  const [closeSeason, setCloseSeason] = React.useState<string>('');
  const [closeRecipient, setCloseRecipient] = React.useState<string>('');

  const parseBatchAddPointsInput = React.useCallback((value: string) => {
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));

    const totals = new Map<string, bigint>();
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const [walletRaw, amountRaw] = line.split(',').map((item) => item.trim());
      if (!walletRaw) {
        throw new Error(`Invalid batch row ${i + 1}: missing wallet`);
      }
      const walletBase58 = parsePublicKey(walletRaw, `wallet at row ${i + 1}`).toBase58();
      const parsedAmount =
        amountRaw === undefined || amountRaw === ''
          ? 1n
          : parseU64(amountRaw, `amount at row ${i + 1}`);

      const prev = totals.get(walletBase58) || 0n;
      const next = prev + parsedAmount;
      if (next > U64_MAX) {
        throw new Error(`Total points overflow for wallet ${walletBase58}`);
      }
      totals.set(walletBase58, next);
    }

    return {
      rowCount: lines.length,
      walletCount: totals.size,
      totals,
    };
  }, []);

  const governanceAuthoritySet = React.useMemo(() => {
    const candidates = new Set<string>();
    try {
      if (governanceAddress) candidates.add(new PublicKey(governanceAddress).toBase58());
    } catch {
      // ignore
    }
    try {
      if (governanceNativeWallet) candidates.add(new PublicKey(governanceNativeWallet).toBase58());
    } catch {
      // ignore
    }
    try {
      if (rulesWallet?.pubkey) candidates.add(new PublicKey(rulesWallet.pubkey).toBase58());
    } catch {
      // ignore
    }
    return candidates;
  }, [governanceAddress, governanceNativeWallet, rulesWallet?.pubkey]);

  const isGovernanceAuthority = React.useCallback(
    (authority: any) => {
      try {
        if (!authority) return false;
        const authorityBase58 =
          typeof authority?.toBase58 === 'function'
            ? authority.toBase58()
            : new PublicKey(authority).toBase58();
        return governanceAuthoritySet.has(authorityBase58);
      } catch {
        return false;
      }
    },
    [governanceAuthoritySet]
  );

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

  const loadSpaceDetails = React.useCallback(async (spaceDaoId: string) => {
    if (!spaceDaoId) return;
    setLoadingSpaceDetails(true);
    try {
      const daoPk = new PublicKey(spaceDaoId);
      const [config, metadata] = await Promise.all([
        fetchConfig(RPC_CONNECTION, daoPk),
        fetchProjectMetadata(RPC_CONNECTION, daoPk),
      ]);
      setSpaceConfig(config);
      setSpaceMetadata(metadata);
      setSpaceAuthorityMatch(config ? isGovernanceAuthority(config?.authority) : null);
      if (config?.repMint?.toBase58?.()) {
        setRepMint(config.repMint.toBase58());
      }
      if (config?.currentSeason !== undefined && config?.currentSeason !== null) {
        const seasonValue = `${config.currentSeason}`;
        if (!season) setSeason(seasonValue);
        if (!newSeason) setNewSeason(seasonValue);
      }
      if (metadata?.metadataUri && !metadataUri) {
        setMetadataUri(metadata.metadataUri);
      }
    } catch (e) {
      setSpaceConfig(null);
      setSpaceMetadata(null);
      setSpaceAuthorityMatch(null);
    } finally {
      setLoadingSpaceDetails(false);
    }
  }, [isGovernanceAuthority, metadataUri, newSeason, season]);

  const refreshSpaces = async () => {
    setLoadingSpaces(true);
    try {
      const pid = new PublicKey(VINE_REP_PROGRAM_ID);
      const results = await fetchAllSpaces(RPC_CONNECTION, pid);
      const ownedSpaces = (results || []).filter((space: any) =>
        isGovernanceAuthority(space?.authority)
      );
      setSpaces(ownedSpaces);
      if (!daoId && ownedSpaces?.length > 0) {
        const firstDao = ownedSpaces[0].daoId?.toBase58?.() || '';
        setDaoId(firstDao);
        if (firstDao) {
          await loadSpaceDetails(firstDao);
        }
      } else if (daoId) {
        await loadSpaceDetails(daoId);
      }
      enqueueSnackbar(
        `Loaded ${ownedSpaces?.length || 0} governance-owned spaces (${results?.length || 0} total)`,
        { variant: 'info' }
      );
    } catch (e: any) {
      enqueueSnackbar(`Failed to load spaces: ${e?.message || `${e}`}`, { variant: 'error' });
    } finally {
      setLoadingSpaces(false);
    }
  };

  const onDaoChanged = async (nextDaoId: string) => {
    setDaoId(nextDaoId);
    if (nextDaoId) {
      await loadSpaceDetails(nextDaoId);
    } else {
      setSpaceConfig(null);
      setSpaceMetadata(null);
      setSpaceAuthorityMatch(null);
    }
  };

  React.useEffect(() => {
    if (daoId) return;
    if (governanceNativeWallet) {
      setDaoId(governanceNativeWallet);
      return;
    }
    if (governanceAddress) {
      setDaoId(governanceAddress);
    }
  }, [daoId, governanceAddress, governanceNativeWallet]);

  const handleSetDaoToTreasury = async () => {
    if (!governanceNativeWallet) {
      enqueueSnackbar('Treasury wallet unavailable', { variant: 'warning' });
      return;
    }
    await onDaoChanged(governanceNativeWallet);
  };

  const handleSetDaoToRealm = async () => {
    if (!governanceAddress) {
      enqueueSnackbar('Realm address unavailable', { variant: 'warning' });
      return;
    }
    await onDaoChanged(governanceAddress);
  };

  const handleGenerateRandomDaoId = () => {
    const randomDao = Keypair.generate().publicKey.toBase58();
    setDaoId(randomDao);
    setSpaceConfig(null);
    setSpaceMetadata(null);
    setSpaceAuthorityMatch(null);
    enqueueSnackbar(`Generated random DAO ID: ${shortenString(randomDao, 6, 6)}`, {
      variant: 'info',
    });
  };

  const handleCreateRepMint = async () => {
    if (!publicKey) {
      enqueueSnackbar('Connect wallet to create mint', { variant: 'warning' });
      return;
    }
    if (!governanceNativeWallet) {
      enqueueSnackbar('Missing governance native wallet', { variant: 'error' });
      return;
    }

    setCreatingRepMint(true);
    try {
      const treasuryPk = new PublicKey(governanceNativeWallet);
      const mintKeypair = Keypair.generate();
      const decimals = parseMintDecimals(newMintDecimals);
      const mintRent = await connection.getMinimumBalanceForRentExemption(MintLayout.span);
      const initialRawAmount = parseTokenUiAmountToRawNumber(newMintInitialSupply, decimals);

      const tx = new Transaction();
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          lamports: mintRent,
          space: MintLayout.span,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      tx.add(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      if (initialRawAmount > 0) {
        const ownerAta = await getAssociatedTokenAddress(
          mintKeypair.publicKey,
          publicKey,
          true,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        const ataInfo = await connection.getAccountInfo(ownerAta);
        if (!ataInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              publicKey,
              ownerAta,
              publicKey,
              mintKeypair.publicKey,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }
        tx.add(
          createMintToCheckedInstruction(
            mintKeypair.publicKey,
            ownerAta,
            publicKey,
            initialRawAmount,
            decimals,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      tx.add(
        createSetAuthorityInstruction(
          mintKeypair.publicKey,
          publicKey,
          'MintTokens',
          treasuryPk,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = publicKey;

      const sig = await sendTransaction(tx, connection, {
        signers: [mintKeypair],
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      let confirmed = false;
      try {
        const confirmation = await connection.confirmTransaction(
          {
            signature: sig,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          'confirmed'
        );
        if (!confirmation.value.err) {
          confirmed = true;
        } else {
          throw new Error(`Mint transaction failed: ${JSON.stringify(confirmation.value.err)}`);
        }
      } catch {
        const status = await connection.getSignatureStatus(sig, {
          searchTransactionHistory: true,
        });

        if (!status?.value?.err) {
          const confirmationStatus = status?.value?.confirmationStatus;
          if (confirmationStatus === 'confirmed' || confirmationStatus === 'finalized') {
            confirmed = true;
          }
        }

        if (!confirmed) {
          const txDetails = await connection.getTransaction(sig, {
            commitment: 'confirmed',
          });
          if (txDetails && !txDetails.meta?.err) {
            confirmed = true;
          }
        }

        if (!confirmed) {
          throw new Error(
            'Mint transaction confirmation timed out. Check explorer with signature: ' + sig
          );
        }
      }

      const mintAddress = mintKeypair.publicKey.toBase58();
      setRepMint(mintAddress);
      enqueueSnackbar(`Created REP mint: ${mintAddress} (${shortenString(sig, 6, 6)})`, { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(`Failed to create REP mint: ${e?.message || `${e}`}`, { variant: 'error' });
    } finally {
      setCreatingRepMint(false);
    }
  };

  const buildInstruction = async (): Promise<TransactionInstruction[]> => {
    if (!governanceNativeWallet) {
      throw new Error('Missing governance native wallet');
    }
    const authorityPk = parsePublicKey(governanceNativeWallet, 'governance native wallet');
    const payerPk = authorityPk;
    const daoPk = parsePublicKey(daoId, 'DAO ID');

    switch (action) {
      case 'initialize': {
        const repMintPk = parsePublicKey(repMint, 'REP mint');
        const seasonValue = parseU16(initialSeason, 'Initial season');
        return [await buildInitializeConfigIx({
          daoId: daoPk,
          repMint: repMintPk,
          initialSeason: seasonValue,
          authority: authorityPk,
          payer: payerPk,
        })];
      }
      case 'upsert_metadata': {
        const uri = `${metadataUri || ''}`.trim();
        if (!uri.length) throw new Error('Metadata URI is required');
        return [await buildUpsertProjectMetadataIx({
          daoId: daoPk,
          authority: authorityPk,
          payer: payerPk,
          metadataUri: uri,
        })];
      }
      case 'set_authority': {
        const nextAuthority = parsePublicKey(newAuthority, 'new authority');
        return [await buildSetAuthorityIx({
          daoId: daoPk,
          authority: authorityPk,
          newAuthority: nextAuthority,
        })];
      }
      case 'set_season': {
        const value = parseU16(newSeason, 'New season');
        return [await buildSetSeasonIx({
          daoId: daoPk,
          authority: authorityPk,
          newSeason: value,
        })];
      }
      case 'set_decay': {
        const value = parseU16(decayBps, 'Decay BPS');
        if (value > 10000) throw new Error('Decay BPS must be <= 10000');
        return [await buildSetDecayBpsIx({
          daoId: daoPk,
          authority: authorityPk,
          decayBps: value,
        })];
      }
      case 'set_rep_mint': {
        const mintPk = parsePublicKey(repMint, 'REP mint');
        return [await buildSetRepMintIx({
          daoId: daoPk,
          authority: authorityPk,
          newRepMint: mintPk,
        })];
      }
      case 'add_points': {
        const seasonValue = parseOptionalU16(season);
        const batchInput = `${addPointsBatchCsv || ''}`.trim();
        if (batchInput.length > 0) {
          const parsed = parseBatchAddPointsInput(batchInput);
          if (!parsed.walletCount) {
            throw new Error('No valid wallets found in batch input');
          }
          const entries = Array.from(parsed.totals.entries());
          const built = await Promise.all(
            entries.map(async ([walletBase58, points]) =>
              buildAddReputationIx({
                conn: RPC_CONNECTION,
                daoId: daoPk,
                authority: authorityPk,
                payer: payerPk,
                user: new PublicKey(walletBase58),
                amount: points,
                season: seasonValue,
              })
            )
          );
          return built.map((item) => item.ix);
        }

        const userPk = parsePublicKey(user, 'user');
        const value = parseU64(amount, 'Points amount');
        const response = await buildAddReputationIx({
          conn: RPC_CONNECTION,
          daoId: daoPk,
          authority: authorityPk,
          payer: payerPk,
          user: userPk,
          amount: value,
          season: seasonValue,
        });
        return [response.ix];
      }
      case 'reset_user': {
        const userPk = parsePublicKey(user, 'user');
        const seasonValue = parseOptionalU16(season);
        const response = await buildResetReputationIx({
          conn: RPC_CONNECTION,
          daoId: daoPk,
          authority: authorityPk,
          user: userPk,
          season: seasonValue,
        });
        return [response.ix];
      }
      case 'transfer_user': {
        const oldWallet = parsePublicKey(fromUser, 'from user');
        const newWallet = parsePublicKey(toUser, 'to user');
        const seasonValue = parseOptionalU16(season);
        return [await buildTransferReputationIx({
          conn: RPC_CONNECTION,
          daoId: daoPk,
          authority: authorityPk,
          payer: payerPk,
          oldWallet,
          newWallet,
          season: seasonValue,
        })];
      }
      case 'close_reputation': {
        const userPk = parsePublicKey(user, 'user');
        const closeSeasonValue = parseU16(closeSeason, 'Close season');
        const recipientPk = parsePublicKey(
          closeRecipient || governanceNativeWallet,
          'close recipient'
        );
        const response = await buildCloseReputationIx({
          daoId: daoPk,
          user: userPk,
          season: closeSeasonValue,
          authority: authorityPk,
          recipient: recipientPk,
        });
        return [response.ix];
      }
      default:
        throw new Error('Unsupported action');
    }
  };

  const handleCreateProposal = async () => {
    setBuilding(true);
    try {
      const ixs = await buildInstruction();
      const actionName = actionLabel[action];
      const daoShort = daoId ? shortenString(daoId, 6, 6) : 'space';
      const isBatchAdd =
        action === 'add_points' &&
        `${addPointsBatchCsv || ''}`
          .split(/\r?\n/)
          .some((line) => line.trim().length > 0 && !line.trim().startsWith('#'));
      const batchSummary = isBatchAdd ? parseBatchAddPointsInput(addPointsBatchCsv) : null;
      const defaultDescription = isBatchAdd
        ? `Batch add reputation points to ${batchSummary?.walletCount || ixs.length} wallet(s) for ${daoShort}.`
        : `Execute OG Reputation Spaces action "${actionName}" for ${daoShort}.`;

      setInstructions({
        title:
          proposalTitle ||
          (isBatchAdd
            ? `OG Reputation: Batch Add Points (${batchSummary?.walletCount || ixs.length})`
            : `OG Reputation: ${actionName}`),
        description: proposalDescription || defaultDescription,
        ix: ixs,
        aix: [],
        allowMissingAccountsPreflight: true,
        useVersionedTransactions: true,
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
      });

      setExpandedLoader(true);
      setOpen(false);
      if (handleCloseExtMenu) handleCloseExtMenu();
    } catch (e: any) {
      enqueueSnackbar(`Failed to build OG Reputation instruction: ${e?.message || `${e}`}`, {
        variant: 'error',
      });
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <Tooltip title="OG Reputation Spaces" placement="right">
        <MenuItem onClick={publicKey ? handleOpen : undefined}>
          <ListItemIcon>
            <WorkspacePremiumIcon fontSize="small" />
          </ListItemIcon>
          OG Reputation Spaces
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
        <BootstrapDialogTitle id="og-reputation-dialog" onClose={handleClose}>
          OG Reputation Spaces
        </BootstrapDialogTitle>

        <DialogContent>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Discover OG Reputation Spaces and queue governance actions for reputation operations.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: 0.65 }}>
                  <Button
                    size="small"
                    onClick={refreshSpaces}
                    disabled={loadingSpaces}
                    startIcon={<RefreshIcon fontSize="small" />}
                    sx={{ borderRadius: '14px' }}
                  >
                    {loadingSpaces ? 'Loading Spaces...' : 'Refresh Spaces'}
                  </Button>
                  <Chip
                    size="small"
                    label={`Found: ${spaces.length}`}
                    sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}
                  />
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Select Discovered Space (optional)"
                  value={daoId}
                  onChange={(e) => onDaoChanged(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                >
                  <MenuItem value="">Manual DAO ID Entry</MenuItem>
                  {spaces.map((space: any) => {
                    const value = space?.daoId?.toBase58?.() || '';
                    const seasonValue = space?.currentSeason ?? 'n/a';
                    return (
                      <MenuItem key={value} value={value}>
                        {shortenString(value, 6, 6)} | Season {seasonValue}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="DAO ID"
                  value={daoId}
                  onChange={(e) => setDaoId(e.target.value)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                />
                <Box sx={{ px: 0.65, pt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSetDaoToTreasury}
                    disabled={!governanceNativeWallet}
                    sx={{ borderRadius: '10px', textTransform: 'none' }}
                  >
                    Use Treasury
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleSetDaoToRealm}
                    disabled={!governanceAddress}
                    sx={{ borderRadius: '10px', textTransform: 'none' }}
                  >
                    Use Realm
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleGenerateRandomDaoId}
                    startIcon={<AutoFixHighIcon fontSize="small" />}
                    sx={{ borderRadius: '10px', textTransform: 'none' }}
                  >
                    Random DAO ID
                  </Button>
                </Box>
              </Grid>

              {daoId ? (
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
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      Space snapshot
                    </Typography>
                    {loadingSpaceDetails ? (
                      <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.55)' }}>
                        Loading config...
                      </Typography>
                    ) : (
                      <>
                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.75)' }}>
                          Authority: {spaceConfig?.authority?.toBase58?.() ? shortenString(spaceConfig.authority.toBase58(), 6, 6) : 'N/A'}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            color:
                              spaceAuthorityMatch === null
                                ? 'rgba(255,255,255,0.6)'
                                : spaceAuthorityMatch
                                ? 'rgba(140,255,178,0.85)'
                                : 'rgba(255,175,175,0.85)',
                          }}
                        >
                          Governance authority match: {spaceAuthorityMatch === null ? 'N/A' : spaceAuthorityMatch ? 'Yes' : 'No'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.75)' }}>
                          REP Mint: {spaceConfig?.repMint?.toBase58?.() ? shortenString(spaceConfig.repMint.toBase58(), 6, 6) : 'N/A'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.75)' }}>
                          Season: {spaceConfig?.currentSeason ?? 'N/A'} | Decay BPS: {spaceConfig?.decayBps ?? 'N/A'}
                        </Typography>
                        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.65)' }}>
                          Metadata URI: {spaceMetadata?.metadataUri || 'N/A'}
                        </Typography>
                      </>
                    )}
                  </Box>
                </Grid>
              ) : null}

              <Grid item xs={12}>
                <TextField
                  select
                  fullWidth
                  label="Action"
                  value={action}
                  onChange={(e) => setAction(e.target.value as OgAction)}
                  variant="filled"
                  sx={{ m: 0.65 }}
                >
                  <MenuItem value="initialize">Initialize Space</MenuItem>
                  <MenuItem value="upsert_metadata">Upsert Metadata URI</MenuItem>
                  <MenuItem value="set_authority">Set Authority</MenuItem>
                  <MenuItem value="set_season">Set Season</MenuItem>
                  <MenuItem value="set_decay">Set Decay BPS</MenuItem>
                  <MenuItem value="set_rep_mint">Set REP Mint</MenuItem>
                  <MenuItem value="add_points">Add Reputation Points</MenuItem>
                  <MenuItem value="reset_user">Reset User Reputation</MenuItem>
                  <MenuItem value="transfer_user">Transfer User Reputation</MenuItem>
                  <MenuItem value="close_reputation">Close User Reputation</MenuItem>
                </TextField>
              </Grid>

              {(action === 'initialize' || action === 'set_rep_mint') && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="REP Mint"
                      value={repMint}
                      onChange={(e) => setRepMint(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box
                      sx={{
                        mx: 0.65,
                        p: 1.25,
                        borderRadius: '12px',
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mb: 1 }}>
                        No REP mint yet? Create one from connected wallet and auto-fill it here.
                      </Typography>
                      <Grid container spacing={1}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label="Decimals"
                            value={newMintDecimals}
                            onChange={(e) => setNewMintDecimals(e.target.value)}
                            variant="filled"
                            sx={{ m: 0 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label="Initial Supply"
                            value={newMintInitialSupply}
                            onChange={(e) => setNewMintInitialSupply(e.target.value)}
                            variant="filled"
                            sx={{ m: 0 }}
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Button
                            size="small"
                            fullWidth
                            variant="outlined"
                            onClick={handleCreateRepMint}
                            disabled={creatingRepMint || !publicKey || !governanceNativeWallet}
                            startIcon={<TokenIcon fontSize="small" />}
                            sx={{ borderRadius: '10px', textTransform: 'none', height: '100%' }}
                          >
                            {creatingRepMint ? 'Creating...' : 'Create REP Mint'}
                          </Button>
                        </Grid>
                      </Grid>
                    </Box>
                  </Grid>
                </>
              )}

              {action === 'initialize' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Initial Season (u16)"
                    value={initialSeason}
                    onChange={(e) => setInitialSeason(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {action === 'upsert_metadata' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Metadata URI"
                    value={metadataUri}
                    onChange={(e) => setMetadataUri(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {action === 'set_authority' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="New Authority"
                    value={newAuthority}
                    onChange={(e) => setNewAuthority(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {action === 'set_season' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="New Season (u16)"
                    value={newSeason}
                    onChange={(e) => setNewSeason(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {action === 'set_decay' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Decay BPS (0-10000)"
                    value={decayBps}
                    onChange={(e) => setDecayBps(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {(action === 'reset_user' || action === 'close_reputation') && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="User"
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {action === 'add_points' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="User"
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Points Amount (u64)"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={4}
                      label="Batch CSV (optional)"
                      placeholder={`wallet,amount\\nwallet\\n# wallet with no amount defaults to 1`}
                      value={addPointsBatchCsv}
                      onChange={(e) => setAddPointsBatchCsv(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                    <Typography variant="caption" sx={{ px: 1.2, color: 'rgba(255,255,255,0.65)' }}>
                      Batch format: `wallet,amount` or `wallet`. Duplicate wallets are summed. If batch has rows, it takes precedence over single user/amount.
                    </Typography>
                  </Grid>
                </>
              )}

              {(action === 'add_points' || action === 'reset_user' || action === 'transfer_user') && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Season (optional, u16)"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    variant="filled"
                    sx={{ m: 0.65 }}
                  />
                </Grid>
              )}

              {action === 'transfer_user' && (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="From User"
                      value={fromUser}
                      onChange={(e) => setFromUser(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="To User"
                      value={toUser}
                      onChange={(e) => setToUser(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                </>
              )}

              {action === 'close_reputation' && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Close Season (u16)"
                      value={closeSeason}
                      onChange={(e) => setCloseSeason(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Recipient (optional)"
                      value={closeRecipient}
                      onChange={(e) => setCloseRecipient(e.target.value)}
                      variant="filled"
                      sx={{ m: 0.65 }}
                    />
                  </Grid>
                </>
              )}
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
            <Typography variant="caption">Vine Reputation client integration (@grapenpm/vine-reputation-client).</Typography>
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

            <Box sx={{ display: 'flex' }}>
              {publicKey ? (
                <Button
                  size="small"
                  onClick={handleCreateProposal}
                  disabled={building}
                  sx={{ p: 1, borderRadius: '17px' }}
                  startIcon={<WorkspacePremiumIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {building ? 'Building...' : 'Create Reputation Proposal'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
