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
  getProposal,
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
import { createCastVoteTransaction } from '../../../utils/governanceTools/components/instructions/createVote';
import {
  getAllGovernancesIndexed,
  getAllProposalsIndexed,
  getProposalNewIndexed,
  getRealmIndexed,
} from '../../api/queries';

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

type IntraDaoAction = 'join' | 'deposit' | 'grant' | 'create' | 'vote';

type JoinedDao = {
  realm: string;
  mint: string;
  tokenOwnerRecord: string;
  label: string;
  daoName: string;
};

type LiveVoteProposal = {
  pubkey: string;
  title: string;
  governance: string;
  governingTokenMint: string;
  votingAt: number;
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
  const [grantParticipantWallet, setGrantParticipantWallet] = React.useState('');
  const [grantAmount, setGrantAmount] = React.useState('');
  const [bulkGrantEnabled, setBulkGrantEnabled] = React.useState(false);
  const [bulkGrantRows, setBulkGrantRows] = React.useState('');
  const [targetProposalName, setTargetProposalName] = React.useState('IntraDAO Proposal');
  const [targetProposalDescription, setTargetProposalDescription] = React.useState(
    'Proposal created via IntraDAO extension'
  );
  const [voteProposalAddress, setVoteProposalAddress] = React.useState('');
  const [voteForProposal, setVoteForProposal] = React.useState(true);
  const [voteProposalTitle, setVoteProposalTitle] = React.useState<string | null>(null);
  const [isFetchingVoteProposalTitle, setIsFetchingVoteProposalTitle] = React.useState(false);
  const [isFetchingLiveVoteProposals, setIsFetchingLiveVoteProposals] = React.useState(false);
  const [liveVoteProposals, setLiveVoteProposals] = React.useState<LiveVoteProposal[]>([]);

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
    } else if (action === 'vote') {
      setProposalTitle('IntraDAO: Vote for Proposal');
      setProposalDescription('Cast a vote from treasury on a target DAO proposal.');
    }
  }, [action]);

  React.useEffect(() => {
    if (action === 'create') {
      setIsDraft(true);
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
      const uniqueRealms = Array.from(
        new Set(
          (ownerRecords || [])
            .map((record) => record?.account?.realm?.toBase58?.())
            .filter((pk): pk is string => !!pk)
        )
      );

      const realmNameMap = new Map<string, string>();
      await Promise.all(
        uniqueRealms.map(async (realmPk) => {
          try {
            const indexedRealm = await getRealmIndexed(realmPk, localProgramId.toBase58());
            const indexedName = cleanValue(indexedRealm?.account?.name || indexedRealm?.name || '');
            if (indexedName) {
              realmNameMap.set(realmPk, indexedName);
              return;
            }
          } catch {
            // Fallback to RPC below.
          }

          try {
            const rpcRealm = await getRealm(RPC_CONNECTION, new PublicKey(realmPk));
            const rpcName = cleanValue(rpcRealm?.account?.name || '');
            if (rpcName) {
              realmNameMap.set(realmPk, rpcName);
            }
          } catch {
            // Ignore missing realm names.
          }
        })
      );

      const dedupe = new Map<string, JoinedDao>();

      for (const record of ownerRecords || []) {
        const realmPk = record?.account?.realm?.toBase58?.();
        const mintPk = record?.account?.governingTokenMint?.toBase58?.();
        if (!realmPk || !mintPk) continue;
        const key = `${realmPk}:${mintPk}`;
        if (dedupe.has(key)) continue;
        const daoName = realmNameMap.get(realmPk) || shortenString(realmPk, 4, 4);
        dedupe.set(key, {
          realm: realmPk,
          mint: mintPk,
          tokenOwnerRecord: record.pubkey.toBase58(),
          daoName,
          label: `${daoName} (${realmPk}) · ${shortenString(mintPk, 4, 4)}`,
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

  const fetchVoteProposalTitle = React.useCallback(async () => {
    if (action !== 'vote') {
      setVoteProposalTitle(null);
      return;
    }
    const proposalAddress = cleanValue(voteProposalAddress);
    const proposalPk = toPublicKeySafe(proposalAddress);
    if (!proposalPk) {
      setVoteProposalTitle(null);
      return;
    }

    try {
      setIsFetchingVoteProposalTitle(true);
      const targetRealmPk = toPublicKeySafe(cleanValue(targetRealm));
      let targetRealmOwner: string | undefined;
      if (targetRealmPk) {
        try {
          const targetRealmData = await getRealm(RPC_CONNECTION, targetRealmPk);
          targetRealmOwner = targetRealmData?.owner?.toBase58?.() || targetRealmData?.owner;
        } catch {
          // Ignore realm-owner resolution failure; indexed lookup has fallback behavior.
        }
      }
      const indexedProposal = await getProposalNewIndexed(
        proposalPk.toBase58(),
        targetRealmOwner,
        targetRealmPk?.toBase58?.()
      );
      const resolvedTitle = cleanValue(
        indexedProposal?.account?.name || indexedProposal?.name || ''
      );
      setVoteProposalTitle(resolvedTitle || null);
    } catch (error) {
      console.warn('Failed to resolve vote proposal title via Shyft index', error);
      setVoteProposalTitle(null);
    } finally {
      setIsFetchingVoteProposalTitle(false);
    }
  }, [action, targetRealm, voteProposalAddress]);

  const fetchLiveVoteProposals = React.useCallback(async () => {
    if (action !== 'vote') {
      setLiveVoteProposals([]);
      return;
    }

    const targetRealmPk = toPublicKeySafe(cleanValue(targetRealm));
    if (!targetRealmPk) {
      setLiveVoteProposals([]);
      return;
    }

    try {
      setIsFetchingLiveVoteProposals(true);
      const targetRealmData = await getRealm(RPC_CONNECTION, targetRealmPk);
      const targetRealmOwner =
        targetRealmData?.owner?.toBase58?.() ||
        targetRealmData?.owner ||
        'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

      const governances = await getAllGovernancesIndexed(
        targetRealmPk.toBase58(),
        targetRealmOwner
      );
      const governanceKeys = Array.from(
        new Set(
          (governances || [])
            .map((item: any) => item?.pubkey?.toBase58?.() || item?.pubkey)
            .filter((key: any): key is string => !!key)
        )
      );

      if (governanceKeys.length === 0) {
        setLiveVoteProposals([]);
        return;
      }

      const indexedProposals = await getAllProposalsIndexed(
        governanceKeys,
        targetRealmOwner,
        targetRealmPk.toBase58()
      );
      const selectedMint = cleanValue(targetMint);
      const selectedMintPk = toPublicKeySafe(selectedMint);

      const normalizedProposals = (Array.isArray(indexedProposals) ? indexedProposals.flat(Infinity as any) : [])
        .filter((proposal: any) => proposal?.pubkey && proposal?.account)
        .filter((proposal: any) => Number(proposal?.account?.state ?? -1) === 2)
        .filter((proposal: any) => {
          if (!selectedMintPk) return true;
          const proposalMint = proposal?.account?.governingTokenMint?.toBase58?.() || proposal?.account?.governingTokenMint;
          return cleanValue(proposalMint) === selectedMintPk.toBase58();
        })
        .map((proposal: any) => ({
          pubkey: proposal.pubkey?.toBase58?.() || proposal.pubkey,
          title: cleanValue(proposal?.account?.name || 'Untitled Proposal'),
          governance: proposal?.account?.governance?.toBase58?.() || proposal?.account?.governance || '',
          governingTokenMint:
            proposal?.account?.governingTokenMint?.toBase58?.() || proposal?.account?.governingTokenMint || '',
          votingAt: Number(proposal?.account?.votingAt ?? proposal?.account?.draftAt ?? 0) || 0,
        }))
        .filter((proposal: LiveVoteProposal) => !!proposal.pubkey);

      normalizedProposals.sort((a: LiveVoteProposal, b: LiveVoteProposal) => b.votingAt - a.votingAt);
      setLiveVoteProposals(normalizedProposals);
    } catch (error) {
      console.warn('Failed to fetch live voting proposals', error);
      setLiveVoteProposals([]);
    } finally {
      setIsFetchingLiveVoteProposals(false);
    }
  }, [action, targetRealm, targetMint]);

  React.useEffect(() => {
    if (action !== 'vote') {
      setVoteProposalTitle(null);
      setIsFetchingVoteProposalTitle(false);
      setLiveVoteProposals([]);
      setIsFetchingLiveVoteProposals(false);
      return;
    }
    const proposalAddress = cleanValue(voteProposalAddress);
    if (!proposalAddress) {
      setVoteProposalTitle(null);
      return;
    }
    const timer = window.setTimeout(() => {
      fetchVoteProposalTitle();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [action, voteProposalAddress, targetRealm, fetchVoteProposalTitle]);

  React.useEffect(() => {
    if (action !== 'vote') return;
    const targetRealmValue = cleanValue(targetRealm);
    if (!targetRealmValue) {
      setLiveVoteProposals([]);
      return;
    }
    const timer = window.setTimeout(() => {
      fetchLiveVoteProposals();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [action, targetRealm, targetMint, fetchLiveVoteProposals]);

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
    const { treasuryPk, realmPk, mintPk, programId, programVersion } = await resolveTargetContext();
    const mintInfo = await getMint(RPC_CONNECTION as any, mintPk);
    const sourceAta = await getAssociatedTokenAddress(
      mintPk,
      treasuryPk,
      true
    );

    const ixs: TransactionInstruction[] = [];
    const appendGrant = async (participantPk: PublicKey, amountRaw: string, rowNum?: number) => {
      const cleanAmount = cleanValue(amountRaw);
      if (!cleanAmount || Number(cleanAmount) <= 0 || Number.isNaN(Number(cleanAmount))) {
        throw new Error(
          rowNum
            ? `Invalid amount at line ${rowNum}. Amount must be greater than zero.`
            : 'Grant amount must be greater than zero'
        );
      }

      const amountBn = parseMintNaturalAmountFromDecimalAsBN(cleanAmount, mintInfo.decimals);
      await withDepositGoverningTokens(
        ixs,
        programId,
        programVersion,
        realmPk,
        sourceAta,
        mintPk,
        participantPk,
        treasuryPk,
        treasuryPk,
        amountBn,
        false
      );
    };

    if (!bulkGrantEnabled) {
      const participantPk = toPublicKeySafe(cleanValue(grantParticipantWallet));
      if (!participantPk) throw new Error('Invalid participant wallet');
      await appendGrant(participantPk, grantAmount);
      return ixs;
    }

    const rows = cleanValue(bulkGrantRows)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => !!line);
    if (rows.length === 0) throw new Error('No bulk grant rows provided');

    for (let i = 0; i < rows.length; i++) {
      const [participantRaw, amountRaw] = rows[i].split(',').map((part) => cleanValue(part));
      if (!participantRaw || !amountRaw) {
        throw new Error(`Invalid bulk row at line ${i + 1}. Expected: participant,amount`);
      }
      const participantPk = toPublicKeySafe(participantRaw);
      if (!participantPk) {
        throw new Error(`Invalid participant public key at line ${i + 1}`);
      }
      await appendGrant(participantPk, amountRaw, i + 1);
    }

    return ixs;
  };

  const buildVoteForProposalInstructions = async (): Promise<TransactionInstruction[]> => {
    const { treasuryPk, realmPk, mintPk } = await resolveTargetContext();
    const proposalPk = toPublicKeySafe(cleanValue(voteProposalAddress));
    if (!proposalPk) throw new Error('Invalid proposal address');

    const selectedRealm = await getRealm(RPC_CONNECTION, realmPk);
    const proposal = await getProposal(RPC_CONNECTION, proposalPk);
    if (!proposal) throw new Error('Target proposal not found');

    const treasuryTorPk = await getTokenOwnerRecordAddress(
      new PublicKey(selectedRealm.owner),
      realmPk,
      mintPk,
      treasuryPk
    );
    const treasuryTorInfo = await RPC_CONNECTION.getAccountInfo(treasuryTorPk);
    if (!treasuryTorInfo) {
      throw new Error('Treasury has no token owner record in the target DAO for this mint. Join/deposit first.');
    }

    const isCommunityVote =
      selectedRealm?.account?.communityMint?.toBase58?.() ===
      proposal.account.governingTokenMint.toBase58();

    const voteTx = await createCastVoteTransaction(
      selectedRealm as any,
      treasuryPk,
      {
        proposal: {
          governanceId: proposal.account.governance.toBase58(),
          proposalId: proposalPk.toBase58(),
          tokenOwnerRecord: proposal.account.tokenOwnerRecord.toBase58(),
          governingTokenMint: proposal.account.governingTokenMint.toBase58(),
        },
        action: voteForProposal ? 0 : 1,
      },
      { pubkey: treasuryTorPk.toBase58() },
      null,
      isCommunityVote,
      null,
      voteForProposal ? 0 : 1
    );

    if (!voteTx || !Array.isArray(voteTx.instructions) || voteTx.instructions.length === 0) {
      throw new Error('Failed to create vote instruction');
    }

    return voteTx.instructions;
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
      } else if (action === 'vote') {
        builtIxs = await buildVoteForProposalInstructions();
      }

      if (!builtIxs.length) {
        throw new Error('No instructions were generated');
      }

      const fallbackTitleByAction: Record<IntraDaoAction, string> = {
        join: 'IntraDAO: Join DAO',
        deposit: 'IntraDAO: Deposit to DAO',
        grant: 'IntraDAO: Grant Voting Power',
        create: 'IntraDAO: Create External Proposal',
        vote: 'IntraDAO: Vote for Proposal',
      };

      const fallbackDescriptionByAction: Record<IntraDaoAction, string> = {
        join: `Join target DAO realm ${cleanValue(targetRealm)} using mint ${cleanValue(targetMint)}.`,
        deposit: `Deposit ${cleanValue(depositAmount)} of ${cleanValue(targetMint)} into target DAO realm ${cleanValue(targetRealm)}.`,
        grant: bulkGrantEnabled
          ? `Grant voting power in realm ${cleanValue(targetRealm)} using ${cleanValue(targetMint)} to bulk participants.`
          : `Grant ${cleanValue(grantAmount)} of ${cleanValue(targetMint)} voting power in realm ${cleanValue(targetRealm)} to ${cleanValue(grantParticipantWallet)}.`,
        create: `Create external proposal on governance ${cleanValue(targetGovernance)} using queued instructions.`,
        vote: `${voteForProposal ? 'Approve' : 'Deny'} proposal ${cleanValue(voteProposalAddress)}${voteProposalTitle ? ` (${voteProposalTitle})` : ''} in realm ${cleanValue(targetRealm)}.`,
      };

      const effectiveDraft = action === 'create' ? true : isDraft;

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
        draft: effectiveDraft,
        queueOnly: false,
        skipQueueEntry: action === 'create',
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

  const actionButtonLabel = React.useMemo(() => {
    if (isBuilding) return 'Building...';
    if (action === 'create') return 'Create IntraDAO Proposal Draft';
    return 'Create IntraDAO Proposal';
  }, [action, isBuilding]);

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
                    <MenuItem value="vote">5. Vote for Proposal</MenuItem>
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
                    <>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Participant Wallet"
                          variant="filled"
                          value={grantParticipantWallet}
                          onChange={(event) => setGrantParticipantWallet(event.target.value)}
                          onKeyDown={stopInputKeyPropagation}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Grant Amount"
                          variant="filled"
                          value={grantAmount}
                          onChange={(event) => setGrantAmount(event.target.value)}
                          onKeyDown={stopInputKeyPropagation}
                          helperText="Amount in token units (not raw atoms)."
                        />
                      </Grid>
                    </>
                  ) : (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Bulk Rows (participant,amount)"
                        variant="filled"
                        value={bulkGrantRows}
                        onChange={(event) => setBulkGrantRows(event.target.value)}
                        onKeyDown={stopInputKeyPropagation}
                        multiline
                        minRows={5}
                        helperText="One per line. Example: participantPubkey,amount"
                      />
                    </Grid>
                  )}
                </>
              ) : null}

              {action === 'vote' ? (
                <>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="intradao-live-vote-proposal-label">Live Voting Proposals</InputLabel>
                        <Select
                          labelId="intradao-live-vote-proposal-label"
                          label="Live Voting Proposals"
                          value={liveVoteProposals.some((item) => item.pubkey === voteProposalAddress) ? voteProposalAddress : ''}
                          onChange={(event) => {
                            const selectedProposalPk = cleanValue(event.target.value);
                            setVoteProposalAddress(selectedProposalPk);
                            const selected = liveVoteProposals.find((proposal) => proposal.pubkey === selectedProposalPk);
                            setVoteProposalTitle(selected?.title || null);
                          }}
                          onKeyDown={stopInputKeyPropagation}
                        >
                          <MenuItem value="">None</MenuItem>
                          {liveVoteProposals.map((proposal) => (
                            <MenuItem key={proposal.pubkey} value={proposal.pubkey}>
                              {proposal.title} ({proposal.pubkey})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <IconButton
                        size="small"
                        onClick={fetchLiveVoteProposals}
                        disabled={isFetchingLiveVoteProposals}
                      >
                        {isFetchingLiveVoteProposals ? (
                          <CircularProgress size={16} />
                        ) : (
                          <RefreshIcon fontSize="small" />
                        )}
                      </IconButton>
                    </Box>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.75 }}>
                      {isFetchingLiveVoteProposals
                        ? 'Loading live voting proposals via Shyft...'
                        : `Live proposals found: ${liveVoteProposals.length}`}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Target Proposal Address"
                      variant="filled"
                      value={voteProposalAddress}
                      onChange={(event) => setVoteProposalAddress(event.target.value)}
                      onKeyDown={stopInputKeyPropagation}
                      helperText={
                        isFetchingVoteProposalTitle
                          ? 'Resolving proposal title via Shyft...'
                          : voteProposalTitle
                          ? `Proposal title: ${voteProposalTitle}`
                          : 'Enter a proposal address to resolve its title via Shyft.'
                      }
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={voteForProposal}
                          onChange={(event) => setVoteForProposal(event.target.checked)}
                        />
                      }
                      label={voteForProposal ? 'Vote For (Approve)' : 'Vote Against (Deny)'}
                    />
                  </Grid>
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
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                      This action creates a draft proposal from the current queue.
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
                  {actionButtonLabel}
                </Button>
              ) : null}
            </Box>
          </DialogActions>
        </DialogContent>
      </BootstrapDialog>
    </>
  );
}
