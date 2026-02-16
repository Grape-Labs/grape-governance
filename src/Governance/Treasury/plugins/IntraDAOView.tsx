import React from 'react';
import { styled } from '@mui/material/styles';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createInstructionData,
  getGovernance,
  getRealm,
  getSignatoryRecordAddress,
  getTokenOwnerRecordAddress,
  getTokenOwnerRecordsByOwner,
  VoteType,
  withAddSignatory,
  withCreateProposal,
  withCreateTokenOwnerRecord,
  withDepositGoverningTokens,
  withInsertTransaction,
  withSetGovernanceDelegate,
  withSignOffProposal,
} from '@solana/spl-governance';
import { getAssociatedTokenAddress, getMint } from '@solana/spl-token-v2';
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
  FormControlLabel,
} from '@mui/material/';
import HubIcon from '@mui/icons-material/Hub';
import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSnackbar } from 'notistack';

import AdvancedProposalView from './AdvancedProposalView';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import {
  getGrapeGovernanceProgramVersion,
  parseMintNaturalAmountFromDecimalAsBN,
  shortenString,
} from '../../../utils/grapeTools/helpers';

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

type IntraDaoAction = 'join' | 'deposit' | 'grant' | 'create';

type JoinedDao = {
  realm: string;
  mint: string;
  tokenOwnerRecord: string;
  label: string;
};

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

function normalizeInstruction(ix: any): TransactionInstruction | null {
  if (!ix) return null;
  if (ix instanceof TransactionInstruction) return ix;
  try {
    const programId = ix?.programId
      ? ix.programId instanceof PublicKey
        ? ix.programId
        : new PublicKey(ix.programId)
      : null;
    if (!programId) return null;
    const keys = Array.isArray(ix?.keys)
      ? ix.keys
          .map((k: any) => {
            try {
              const pubkey =
                k?.pubkey instanceof PublicKey ? k.pubkey : new PublicKey(k?.pubkey);
              return {
                pubkey,
                isSigner: !!k?.isSigner,
                isWritable: !!k?.isWritable,
              };
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      : [];

    let data: Buffer;
    if (Buffer.isBuffer(ix?.data)) {
      data = ix.data;
    } else if (ix?.data instanceof Uint8Array) {
      data = Buffer.from(ix.data);
    } else if (Array.isArray(ix?.data)) {
      data = Buffer.from(ix.data);
    } else if (typeof ix?.data === 'string') {
      try {
        data = Buffer.from(ix.data, 'base64');
      } catch {
        data = Buffer.alloc(0);
      }
    } else {
      data = Buffer.alloc(0);
    }

    return new TransactionInstruction({
      programId,
      keys: keys as any,
      data,
    });
  } catch {
    return null;
  }
}

function normalizeInstructionArray(raw: any): TransactionInstruction[] {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return arr.map((ix) => normalizeInstruction(ix)).filter((ix): ix is TransactionInstruction => !!ix);
}

export default function IntraDAOView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceAddress = props?.governanceAddress || realm?.pubkey?.toBase58?.() || '';
  const governanceNativeWallet = props?.governanceNativeWallet;
  const instructionQueue = props?.instructionQueue;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { publicKey } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [isFetchingJoinedDaos, setIsFetchingJoinedDaos] = React.useState(false);

  const [action, setAction] = React.useState<IntraDaoAction>('join');
  const [targetRealm, setTargetRealm] = React.useState('');
  const [targetGovernance, setTargetGovernance] = React.useState('');
  const [targetMint, setTargetMint] = React.useState('');
  const [depositAmount, setDepositAmount] = React.useState('');
  const [delegateWallet, setDelegateWallet] = React.useState('');
  const [bulkGrantEnabled, setBulkGrantEnabled] = React.useState(false);
  const [bulkGrantRows, setBulkGrantRows] = React.useState('');
  const [targetProposalName, setTargetProposalName] = React.useState('IntraDAO Proposal');
  const [targetProposalDescription, setTargetProposalDescription] = React.useState(
    'Proposal created via IntraDAO extension'
  );

  const [joinedDaos, setJoinedDaos] = React.useState<JoinedDao[]>([]);
  const [selectedJoinedDao, setSelectedJoinedDao] = React.useState('');

  const [proposalTitle, setProposalTitle] = React.useState<string | null>('IntraDAO: Join DAO');
  const [proposalDescription, setProposalDescription] = React.useState<string | null>(
    'Join another DAO using the treasury wallet.'
  );
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);
  const [governingMint, setGoverningMint] = React.useState<any>(null);
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(false);
  const [clearQueueAfterCreate, setClearQueueAfterCreate] = React.useState(false);

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

  React.useEffect(() => {
    if (action === 'join') {
      setProposalTitle('IntraDAO: Join DAO');
      setProposalDescription('Join another DAO using the treasury wallet.');
    } else if (action === 'deposit') {
      setProposalTitle('IntraDAO: Deposit to DAO');
      setProposalDescription('Deposit governance tokens from treasury into another DAO.');
    } else if (action === 'grant') {
      setProposalTitle('IntraDAO: Grant Voting Power');
      setProposalDescription('Grant delegated voting power in a joined DAO.');
    } else if (action === 'create') {
      setProposalTitle('IntraDAO: Create External Proposal');
      setProposalDescription('Create a proposal in another DAO using queued executable instructions.');
    }
  }, [action]);

  const handleClickOpen = () => setOpen(true);

  const handleClose = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const fetchJoinedDaos = React.useCallback(async () => {
    if (!governanceNativeWallet) {
      setJoinedDaos([]);
      return;
    }

    try {
      setIsFetchingJoinedDaos(true);
      const localProgramId = toPublicKeySafe(
        realm?.owner?.toBase58 ? realm.owner.toBase58() : realm?.owner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
      );
      const ownerPk = toPublicKeySafe(governanceNativeWallet);
      if (!localProgramId || !ownerPk) {
        setJoinedDaos([]);
        return;
      }

      const ownerRecords = await getTokenOwnerRecordsByOwner(
        RPC_CONNECTION,
        localProgramId,
        ownerPk
      );
      const dedupe = new Map<string, JoinedDao>();

      for (const record of ownerRecords || []) {
        const realmPk = record?.account?.realm?.toBase58?.();
        const mintPk = record?.account?.governingTokenMint?.toBase58?.();
        if (!realmPk || !mintPk) continue;
        const key = `${realmPk}:${mintPk}`;
        if (dedupe.has(key)) continue;
        dedupe.set(key, {
          realm: realmPk,
          mint: mintPk,
          tokenOwnerRecord: record.pubkey.toBase58(),
          label: `${shortenString(realmPk, 4, 4)} (${shortenString(mintPk, 4, 4)})`,
        });
      }

      setJoinedDaos(Array.from(dedupe.values()));
    } catch (error) {
      console.error('Failed to fetch joined DAOs', error);
      setJoinedDaos([]);
    } finally {
      setIsFetchingJoinedDaos(false);
    }
  }, [governanceNativeWallet, realm?.owner]);

  React.useEffect(() => {
    if (!open) return;
    fetchJoinedDaos();
  }, [open, fetchJoinedDaos]);

  const handleSelectJoinedDao = (value: string) => {
    setSelectedJoinedDao(value);
    const found = joinedDaos.find((item) => `${item.realm}:${item.mint}` === value);
    if (!found) return;
    setTargetRealm(found.realm);
    setTargetMint(found.mint);
  };

  const resolveTargetContext = async () => {
    const treasuryPk = toPublicKeySafe(governanceNativeWallet);
    const realmPk = toPublicKeySafe(cleanValue(targetRealm));
    const mintPk = toPublicKeySafe(cleanValue(targetMint));
    if (!treasuryPk) throw new Error('Missing governance native wallet');
    if (!realmPk) throw new Error('Invalid target DAO realm');
    if (!mintPk) throw new Error('Invalid target governing mint');

    const realmData = await getRealm(RPC_CONNECTION, realmPk);
    const programId =
      realmData?.owner instanceof PublicKey
        ? realmData.owner
        : new PublicKey(realmData?.owner?.toBase58?.() || realmData?.owner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');

    const programVersion = await getGrapeGovernanceProgramVersion(
      RPC_CONNECTION,
      programId,
      realmPk
    );

    return { treasuryPk, realmPk, mintPk, programId, programVersion };
  };

  const buildJoinDaoInstructions = async (): Promise<TransactionInstruction[]> => {
    const { treasuryPk, realmPk, mintPk, programId, programVersion } = await resolveTargetContext();
    const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
      programId,
      realmPk,
      mintPk,
      treasuryPk
    );

    const tokenOwnerRecordInfo = await RPC_CONNECTION.getAccountInfo(tokenOwnerRecordPk);
    if (tokenOwnerRecordInfo) {
      throw new Error(`Treasury already joined this DAO for this mint. TOR: ${tokenOwnerRecordPk.toBase58()}`);
    }

    const ixs: TransactionInstruction[] = [];
    await withCreateTokenOwnerRecord(
      ixs,
      programId,
      programVersion,
      realmPk,
      treasuryPk,
      mintPk,
      treasuryPk
    );
    return ixs;
  };

  const buildDepositDaoInstructions = async (): Promise<TransactionInstruction[]> => {
    const { treasuryPk, realmPk, mintPk, programId, programVersion } = await resolveTargetContext();
    const cleanAmount = cleanValue(depositAmount);
    if (!cleanAmount || Number(cleanAmount) <= 0 || Number.isNaN(Number(cleanAmount))) {
      throw new Error('Deposit amount must be greater than zero');
    }

    const mintInfo = await getMint(RPC_CONNECTION as any, mintPk);
    const depositAmountBn = parseMintNaturalAmountFromDecimalAsBN(cleanAmount, mintInfo.decimals);
    const sourceAta = await getAssociatedTokenAddress(
      mintPk,
      treasuryPk,
      true
    );

    const ixs: TransactionInstruction[] = [];
    await withDepositGoverningTokens(
      ixs,
      programId,
      programVersion,
      realmPk,
      sourceAta,
      mintPk,
      treasuryPk,
      treasuryPk,
      treasuryPk,
      depositAmountBn,
      false
    );
    return ixs;
  };

  const buildGrantVotingPowerInstructions = async (): Promise<TransactionInstruction[]> => {
    const ixs: TransactionInstruction[] = [];
    if (!bulkGrantEnabled) {
      const { treasuryPk, realmPk, mintPk, programId, programVersion } = await resolveTargetContext();
      const delegatePk = toPublicKeySafe(cleanValue(delegateWallet));
      if (!delegatePk) throw new Error('Invalid delegate wallet');

      await withSetGovernanceDelegate(
        ixs,
        programId,
        programVersion,
        realmPk,
        mintPk,
        treasuryPk,
        treasuryPk,
        delegatePk
      );
      return ixs;
    }

    const treasuryPk = toPublicKeySafe(governanceNativeWallet);
    if (!treasuryPk) throw new Error('Missing governance native wallet');

    const rows = cleanValue(bulkGrantRows)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !!line)
      .map((line, idx) => {
        const [realmRaw, mintRaw, delegateRaw] = line.split(',').map((part) => cleanValue(part));
        if (!realmRaw || !mintRaw || !delegateRaw) {
          throw new Error(`Invalid bulk row at line ${idx + 1}. Expected: realm,mint,delegate`);
        }
        const realmPk = toPublicKeySafe(realmRaw);
        const mintPk = toPublicKeySafe(mintRaw);
        const delegatePk = toPublicKeySafe(delegateRaw);
        if (!realmPk || !mintPk || !delegatePk) {
          throw new Error(`Invalid public key at line ${idx + 1}`);
        }
        return { realmPk, mintPk, delegatePk, rowNum: idx + 1 };
      });

    if (rows.length === 0) {
      throw new Error('No bulk grant rows provided');
    }

    const dedupe = new Set<string>();
    const realmProgramCache = new Map<string, { programId: PublicKey; programVersion: number }>();

    for (const row of rows) {
      const dedupeKey = `${row.realmPk.toBase58()}:${row.mintPk.toBase58()}`;
      if (dedupe.has(dedupeKey)) {
        throw new Error(
          `Duplicate realm+mint target at line ${row.rowNum}. Keep only one delegate per realm/mint in a bulk request.`
        );
      }
      dedupe.add(dedupeKey);

      let programContext = realmProgramCache.get(row.realmPk.toBase58());
      if (!programContext) {
        const realmData = await getRealm(RPC_CONNECTION, row.realmPk);
        const programId =
          realmData?.owner instanceof PublicKey
            ? realmData.owner
            : new PublicKey(
                realmData?.owner?.toBase58?.() ||
                  realmData?.owner ||
                  'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
              );
        const programVersion = await getGrapeGovernanceProgramVersion(
          RPC_CONNECTION,
          programId,
          row.realmPk
        );
        programContext = { programId, programVersion };
        realmProgramCache.set(row.realmPk.toBase58(), programContext);
      }

      await withSetGovernanceDelegate(
        ixs,
        programContext.programId,
        programContext.programVersion,
        row.realmPk,
        row.mintPk,
        treasuryPk,
        treasuryPk,
        row.delegatePk
      );
    }

    return ixs;
  };

  const getQueuedExecutableInstructions = (): TransactionInstruction[] => {
    const queueItems = Array.isArray(instructionQueue) ? instructionQueue : [];
    const normalized: TransactionInstruction[] = [];
    queueItems.forEach((item: any) => {
      const payloadIxs = normalizeInstructionArray(item?.payload?.ix);
      normalized.push(...payloadIxs);
    });
    return normalized;
  };

  const buildCreateExternalProposalInstructions = async (): Promise<TransactionInstruction[]> => {
    const { treasuryPk, realmPk, mintPk, programId, programVersion } = await resolveTargetContext();
    const governancePk = toPublicKeySafe(cleanValue(targetGovernance));
    if (!governancePk) throw new Error('Invalid target governance');

    const proposalName = cleanValue(targetProposalName) || 'IntraDAO Proposal';
    const proposalDesc = cleanValue(targetProposalDescription) || 'Proposal created via IntraDAO extension';

    const queuedIxs = getQueuedExecutableInstructions();
    if (queuedIxs.length === 0) {
      throw new Error('No queued executable instructions found');
    }

    const unsupportedSigner = queuedIxs.some((ix) =>
      ix.keys.some((key) => key.isSigner && !key.pubkey.equals(treasuryPk))
    );
    if (unsupportedSigner) {
      throw new Error(
        'Queued instructions contain signer accounts other than treasury wallet. These cannot be executed by IntraDAO proposal creation.'
      );
    }

    const governanceData = await getGovernance(
      RPC_CONNECTION,
      programId,
      governancePk
    );

    const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
      programId,
      realmPk,
      mintPk,
      treasuryPk
    );
    const proposalIndex = governanceData?.account?.proposalCount;
    const holdUpTime = Number(governanceData?.account?.config?.minInstructionHoldUpTime || 0);

    const ixs: TransactionInstruction[] = [];

    const proposalPk = await withCreateProposal(
      ixs,
      programId,
      programVersion,
      realmPk,
      governancePk,
      tokenOwnerRecordPk,
      proposalName,
      proposalDesc,
      mintPk,
      treasuryPk,
      proposalIndex,
      VoteType.SINGLE_CHOICE,
      ['Approve'],
      true,
      treasuryPk
    );

    await withAddSignatory(
      ixs,
      programId,
      programVersion,
      proposalPk,
      tokenOwnerRecordPk,
      treasuryPk,
      treasuryPk,
      treasuryPk
    );

    for (let idx = 0; idx < queuedIxs.length; idx++) {
      await withInsertTransaction(
        ixs,
        programId,
        programVersion,
        governancePk,
        proposalPk,
        tokenOwnerRecordPk,
        treasuryPk,
        idx,
        0,
        holdUpTime,
        [createInstructionData(queuedIxs[idx])],
        treasuryPk
      );
    }

    const signatoryRecordPk = await getSignatoryRecordAddress(
      programId,
      proposalPk,
      treasuryPk
    );

    withSignOffProposal(
      ixs,
      programId,
      programVersion,
      realmPk,
      governancePk,
      proposalPk,
      treasuryPk,
      signatoryRecordPk,
      tokenOwnerRecordPk
    );

    return ixs;
  };

  const queueIntraDaoAction = async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    try {
      let builtIxs: TransactionInstruction[] = [];
      if (action === 'join') {
        builtIxs = await buildJoinDaoInstructions();
      } else if (action === 'deposit') {
        builtIxs = await buildDepositDaoInstructions();
      } else if (action === 'grant') {
        builtIxs = await buildGrantVotingPowerInstructions();
      } else if (action === 'create') {
        builtIxs = await buildCreateExternalProposalInstructions();
      }

      if (!builtIxs.length) {
        throw new Error('No instructions were generated');
      }

      const fallbackTitleByAction: Record<IntraDaoAction, string> = {
        join: 'IntraDAO: Join DAO',
        deposit: 'IntraDAO: Deposit to DAO',
        grant: 'IntraDAO: Grant Voting Power',
        create: 'IntraDAO: Create External Proposal',
      };

      const fallbackDescriptionByAction: Record<IntraDaoAction, string> = {
        join: `Join target DAO realm ${cleanValue(targetRealm)} using mint ${cleanValue(targetMint)}.`,
        deposit: `Deposit ${cleanValue(depositAmount)} of ${cleanValue(targetMint)} into target DAO realm ${cleanValue(targetRealm)}.`,
        grant: `Set governance delegate for realm ${cleanValue(targetRealm)} to ${cleanValue(delegateWallet)}.`,
        create: `Create external proposal on governance ${cleanValue(targetGovernance)} using queued instructions.`,
      };

      setInstructions({
        title: cleanValue(proposalTitle || fallbackTitleByAction[action]) || fallbackTitleByAction[action],
        description:
          cleanValue(proposalDescription || fallbackDescriptionByAction[action]) ||
          fallbackDescriptionByAction[action],
        ix: builtIxs,
        aix: [],
        allowMissingAccountsPreflight: true,
        nativeWallet: governanceNativeWallet,
        governingMint,
        draft: isDraft,
        editProposalAddress,
      });

      if (action === 'create' && clearQueueAfterCreate && typeof props?.clearInstructionQueue === 'function') {
        props.clearInstructionQueue();
      }

      setExpandedLoader(true);
      setOpen(false);
      if (handleCloseExtMenu) handleCloseExtMenu();
    } catch (error: any) {
      const message = error?.message || `${error}`;
      enqueueSnackbar(`IntraDAO instruction build failed: ${message}`, { variant: 'error' });
      console.error('IntraDAO instruction build failed', error);
    } finally {
      setIsBuilding(false);
    }
  };

  const queueCount = React.useMemo(() => {
    return getQueuedExecutableInstructions().length;
  }, [instructionQueue]);

  return (
    <>
      <Tooltip title="IntraDAO: Join/deposit/delegate/create proposal in another DAO" placement="right">
        <MenuItem onClick={publicKey ? handleClickOpen : undefined}>
          <ListItemIcon>
            <HubIcon fontSize="small" />
          </ListItemIcon>
          IntraDAO
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
        <BootstrapDialogTitle id="intradao-dialog" onClose={handleClose}>
          IntraDAO
        </BootstrapDialogTitle>

        <DialogContent onKeyDown={stopInputKeyPropagation}>
          <DialogContentText sx={{ textAlign: 'center', mb: 2 }}>
            Build cross-DAO governance instructions with treasury as authority.
          </DialogContentText>

          <FormControl fullWidth>
            <Grid container spacing={1.25}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel id="intradao-action-label">Action</InputLabel>
                  <Select
                    labelId="intradao-action-label"
                    label="Action"
                    value={action}
                    onChange={(event) => setAction(event.target.value as IntraDaoAction)}
                    onKeyDown={stopInputKeyPropagation}
                  >
                    <MenuItem value="join">1. Join a DAO</MenuItem>
                    <MenuItem value="deposit">2. Deposit to that DAO</MenuItem>
                    <MenuItem value="grant">3. Grant Voting Power</MenuItem>
                    <MenuItem value="create">4. Create Proposal from Queue</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="intradao-joined-label">Use Participating DAO</InputLabel>
                    <Select
                      labelId="intradao-joined-label"
                      label="Use Participating DAO"
                      value={selectedJoinedDao}
                      onChange={(event) => handleSelectJoinedDao(event.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    >
                      <MenuItem value="">None</MenuItem>
                      {joinedDaos.map((item) => (
                        <MenuItem key={`${item.realm}:${item.mint}`} value={`${item.realm}:${item.mint}`}>
                          {item.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <IconButton
                    size="small"
                    onClick={fetchJoinedDaos}
                    disabled={isFetchingJoinedDaos}
                  >
                    {isFetchingJoinedDaos ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                  </IconButton>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Target DAO Realm"
                  variant="filled"
                  value={targetRealm}
                  onChange={(event) => setTargetRealm(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Target Governing Mint"
                  variant="filled"
                  value={targetMint}
                  onChange={(event) => setTargetMint(event.target.value)}
                  onKeyDown={stopInputKeyPropagation}
                />
              </Grid>

              {action === 'deposit' ? (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Deposit Amount"
                    variant="filled"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    onKeyDown={stopInputKeyPropagation}
                  />
                </Grid>
              ) : null}

              {action === 'grant' ? (
                <>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={bulkGrantEnabled}
                          onChange={(event) => setBulkGrantEnabled(event.target.checked)}
                        />
                      }
                      label="Enable Bulk Grant"
                    />
                  </Grid>
                  {!bulkGrantEnabled ? (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Delegate Wallet"
                        variant="filled"
                        value={delegateWallet}
                        onChange={(event) => setDelegateWallet(event.target.value)}
                        onKeyDown={stopInputKeyPropagation}
                        helperText="Tip: paste the wallet that should receive delegated voting power."
                      />
                    </Grid>
                  ) : (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Bulk Rows (realm,mint,delegate)"
                        variant="filled"
                        value={bulkGrantRows}
                        onChange={(event) => setBulkGrantRows(event.target.value)}
                        onKeyDown={stopInputKeyPropagation}
                        multiline
                        minRows={5}
                        helperText="One per line. Example: realmPubkey,mintPubkey,delegatePubkey"
                      />
                    </Grid>
                  )}
                </>
              ) : null}

              {action === 'create' ? (
                <>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Governance"
                      variant="filled"
                      value={targetGovernance}
                      onChange={(event) => setTargetGovernance(event.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Proposal Name"
                      variant="filled"
                      value={targetProposalName}
                      onChange={(event) => setTargetProposalName(event.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Proposal Description"
                      variant="filled"
                      value={targetProposalDescription}
                      onChange={(event) => setTargetProposalDescription(event.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                      multiline
                      minRows={2}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                      Queue source instructions: {queueCount}
                    </Typography>
                    {queueCount === 0 ? (
                      <Typography variant="caption" sx={{ display: 'block', color: 'warning.main' }}>
                        No queued instructions found. Add executable instructions first.
                      </Typography>
                    ) : null}
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={clearQueueAfterCreate}
                          onChange={(event) => setClearQueueAfterCreate(event.target.checked)}
                        />
                      }
                      label="Clear queue after building this action"
                    />
                  </Grid>
                </>
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

          <Box alignItems={'center'} alignContent={'center'} justifyContent={'center'} sx={{ m: 2, textAlign: 'center' }}>
            <Typography variant="caption">Made with &lt;3 by Grape</Typography>
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
                  onClick={queueIntraDaoAction}
                  disabled={isBuilding}
                  sx={{
                    p: 1,
                    borderRadius: '17px',
                    '&:hover .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.90)' },
                  }}
                  startIcon={<HubIcon sx={{ color: 'rgba(255,255,255,0.25)', fontSize: '14px!important' }} />}
                >
                  {isBuilding ? 'Building...' : 'Queue IntraDAO Action'}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
