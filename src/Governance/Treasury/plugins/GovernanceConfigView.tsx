import React from 'react';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
import {
  createSetRealmAuthority,
  createSetGovernanceConfig,
  createSetRealmConfig,
  GovernanceConfig,
  SetRealmAuthorityAction,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  MintMaxVoteWeightSource,
  MintMaxVoteWeightSourceType,
  GoverningTokenConfigAccountArgs,
  GoverningTokenType,
} from '@solana/spl-governance';
import { getMint } from '@solana/spl-token-v2';

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
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  ListItemIcon,
  MenuItem,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';

import SettingsIcon from '@mui/icons-material/Settings';
import CloseIcon from '@mui/icons-material/Close';

import { useSnackbar } from 'notistack';

import AdvancedProposalView from './AdvancedProposalView';
import { getGrapeGovernanceProgramVersion } from '../../../utils/grapeTools/helpers';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { getRealmConfigIndexed } from '../../api/queries';

const U64_MAX = '18446744073709551615';

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

type TabMode = 'governance' | 'realm';

function toBase58OrEmpty(value: any): string {
  try {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value?.toBase58) return value.toBase58();
    return String(value);
  } catch {
    return '';
  }
}

function toSafeInt(value: any, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function toSafeFloat(value: any, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function toBnString(value: any, fallback = '0'): string {
  try {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') {
      if (value.startsWith('0x')) {
        return new BN(value.slice(2), 16).toString();
      }
      if (value.length === 0) return fallback;
      return value;
    }
    if (typeof value === 'number') return Math.floor(value).toString();
    if (typeof value === 'bigint') return value.toString();
    if (value?.toString) return value.toString();
    return fallback;
  } catch {
    return fallback;
  }
}

function rawAmountToUiString(rawAmount: string, decimals: number): string {
  const raw = new BN(toBnString(rawAmount, '0'));
  if (decimals <= 0) return raw.toString();

  const divisor = new BN(10).pow(new BN(decimals));
  const whole = raw.div(divisor).toString();
  const fraction = raw
    .mod(divisor)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole;
}

function uiAmountToRawBn(amount: string, decimals: number, label: string): BN {
  const normalized = (amount || '').trim().replace(/,/g, '');
  if (!normalized) return new BN(0);
  if (!/^\d*\.?\d*$/.test(normalized)) {
    throw new Error(`${label} must be a valid number`);
  }

  const [wholePartRaw, fractionPartRaw = ''] = normalized.split('.');
  const wholePart = wholePartRaw || '0';
  const fractionPart = fractionPartRaw || '';

  if (fractionPart.length > decimals) {
    throw new Error(`${label} supports up to ${decimals} decimal places`);
  }

  const base = new BN(10).pow(new BN(decimals));
  const wholeBn = new BN(wholePart).mul(base);
  const fractionPadded = fractionPart.padEnd(decimals, '0') || '0';
  const fractionBn = new BN(fractionPadded);
  return wholeBn.add(fractionBn);
}

function parseOptionalPublicKey(input: string): PublicKey | undefined {
  const value = (input || '').trim();
  if (!value) return undefined;
  return new PublicKey(value);
}

function parseRequiredPublicKey(input: string, label: string): PublicKey {
  const value = (input || '').trim();
  if (!value) throw new Error(`${label} is required`);
  return new PublicKey(value);
}

function thresholdValue(value: number, type: VoteThresholdType): number | undefined {
  if (type === VoteThresholdType.Disabled) return undefined;
  const v = Math.max(0, Math.min(100, Math.floor(value || 0)));
  return v;
}

function tokenTypeFromConfig(value: any, fallback: GoverningTokenType): GoverningTokenType {
  const asInt = toSafeInt(value, fallback);
  if (asInt === GoverningTokenType.Liquid) return GoverningTokenType.Liquid;
  if (asInt === GoverningTokenType.Dormant) return GoverningTokenType.Dormant;
  return GoverningTokenType.Membership;
}

function voteTippingFromConfig(value: any, fallback: VoteTipping): VoteTipping {
  const asInt = toSafeInt(value, fallback);
  if (asInt === VoteTipping.Early) return VoteTipping.Early;
  if (asInt === VoteTipping.Disabled) return VoteTipping.Disabled;
  return VoteTipping.Strict;
}

export default function GovernanceConfigView(props: any) {
  const realm = props?.realm;
  const rulesWallet = props?.rulesWallet;
  const governanceNativeWallet = props?.governanceNativeWallet;
  const handleCloseExtMenu = props?.handleCloseExtMenu;
  const setExpandedLoader = props?.setExpandedLoader;
  const setInstructions = props?.setInstructions;

  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const { enqueueSnackbar } = useSnackbar();

  const governanceAddress = props?.governanceAddress || toBase58OrEmpty(realm?.pubkey);

  const [open, setOpen] = React.useState(false);
  const [openAdvanced, setOpenAdvanced] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [transferringAuthority, setTransferringAuthority] = React.useState(false);
  const [tabMode, setTabMode] = React.useState<TabMode>('governance');

  const [proposalTitle, setProposalTitle] = React.useState<string>('');
  const [proposalDescription, setProposalDescription] = React.useState<string>('');
  const [editProposalAddress, setEditProposalAddress] = React.useState<string | null>(null);
  const [isDraft, setIsDraft] = React.useState(false);

  const [governingMint, setGoverningMint] = React.useState<string>('');
  const [isGoverningMintSelectable, setIsGoverningMintSelectable] = React.useState(true);
  const [isGoverningMintCouncilSelected, setIsGoverningMintCouncilSelected] = React.useState(true);

  // Governance config fields
  const [communityVoteThresholdType, setCommunityVoteThresholdType] = React.useState<VoteThresholdType>(VoteThresholdType.YesVotePercentage);
  const [communityVoteThresholdValue, setCommunityVoteThresholdValue] = React.useState<number>(60);
  const [minCommunityTokensToCreateProposal, setMinCommunityTokensToCreateProposal] = React.useState<string>('1');
  const [disableCommunityProposalCreation, setDisableCommunityProposalCreation] = React.useState(false);

  const [baseVotingTimeHours, setBaseVotingTimeHours] = React.useState<number>(72);
  const [minInstructionHoldUpTimeHours, setMinInstructionHoldUpTimeHours] = React.useState<number>(0);
  const [votingCoolOffTimeHours, setVotingCoolOffTimeHours] = React.useState<number>(0);
  const [depositExemptProposalCount, setDepositExemptProposalCount] = React.useState<number>(0);

  const [communityVoteTipping, setCommunityVoteTipping] = React.useState<VoteTipping>(VoteTipping.Strict);
  const [minCouncilTokensToCreateProposal, setMinCouncilTokensToCreateProposal] = React.useState<string>('1');
  const [councilVoteThresholdType, setCouncilVoteThresholdType] = React.useState<VoteThresholdType>(VoteThresholdType.YesVotePercentage);
  const [councilVoteThresholdValue, setCouncilVoteThresholdValue] = React.useState<number>(60);
  const [councilVetoVoteThresholdType, setCouncilVetoVoteThresholdType] = React.useState<VoteThresholdType>(VoteThresholdType.YesVotePercentage);
  const [councilVetoVoteThresholdValue, setCouncilVetoVoteThresholdValue] = React.useState<number>(60);
  const [communityVetoVoteThresholdType, setCommunityVetoVoteThresholdType] = React.useState<VoteThresholdType>(VoteThresholdType.YesVotePercentage);
  const [communityVetoVoteThresholdValue, setCommunityVetoVoteThresholdValue] = React.useState<number>(60);
  const [councilVoteTipping, setCouncilVoteTipping] = React.useState<VoteTipping>(VoteTipping.Strict);

  // Realm config fields
  const [realmAuthority, setRealmAuthority] = React.useState<string>('');
  const [councilMint, setCouncilMint] = React.useState<string>('');
  const [communityMintMaxVoteWeightPct, setCommunityMintMaxVoteWeightPct] = React.useState<number>(100);
  const [minCommunityTokensToCreateGovernance, setMinCommunityTokensToCreateGovernance] = React.useState<string>('1');
  const [communityMintDecimals, setCommunityMintDecimals] = React.useState<number>(0);
  const [councilMintDecimals, setCouncilMintDecimals] = React.useState<number>(0);

  const [communityTokenType, setCommunityTokenType] = React.useState<GoverningTokenType>(GoverningTokenType.Liquid);
  const [communityVoterWeightAddin, setCommunityVoterWeightAddin] = React.useState<string>('');
  const [communityMaxVoterWeightAddin, setCommunityMaxVoterWeightAddin] = React.useState<string>('');

  const [councilTokenType, setCouncilTokenType] = React.useState<GoverningTokenType>(GoverningTokenType.Membership);
  const [councilVoterWeightAddin, setCouncilVoterWeightAddin] = React.useState<string>('');
  const [councilMaxVoterWeightAddin, setCouncilMaxVoterWeightAddin] = React.useState<string>('');

  const toggleGoverningMintSelected = React.useCallback(
    (council: boolean) => {
      const community = toBase58OrEmpty(realm?.account?.communityMint);
      const councilMintPk = toBase58OrEmpty(realm?.account?.config?.councilMint);

      if (council && councilMintPk) {
        setIsGoverningMintCouncilSelected(true);
        setGoverningMint(councilMintPk);
      } else {
        setIsGoverningMintCouncilSelected(false);
        setGoverningMint(community);
      }
    },
    [realm]
  );

  React.useEffect(() => {
    const council = toBase58OrEmpty(realm?.account?.config?.councilMint);
    const community = toBase58OrEmpty(realm?.account?.communityMint);

    if (council) {
      setIsGoverningMintCouncilSelected(true);
      setGoverningMint(council);
      setIsGoverningMintSelectable(Boolean(community));
    } else {
      setIsGoverningMintCouncilSelected(false);
      setGoverningMint(community);
      setIsGoverningMintSelectable(false);
    }
  }, [realm]);

  const initializeGovernanceConfig = React.useCallback(
    (communityDecimals: number, councilDecimals: number) => {
    const cfg = rulesWallet?.account?.config;
    if (!cfg) return;

    const commThresholdType = toSafeInt(cfg?.communityVoteThreshold?.type, VoteThresholdType.YesVotePercentage) as VoteThresholdType;
    const councilThresholdType = toSafeInt(cfg?.councilVoteThreshold?.type, VoteThresholdType.YesVotePercentage) as VoteThresholdType;
    const councilVetoType = toSafeInt(cfg?.councilVetoVoteThreshold?.type, VoteThresholdType.YesVotePercentage) as VoteThresholdType;
    const communityVetoType = toSafeInt(cfg?.communityVetoVoteThreshold?.type, VoteThresholdType.YesVotePercentage) as VoteThresholdType;

    const minCommunityStr = toBnString(cfg?.minCommunityTokensToCreateProposal, '1');

    setCommunityVoteThresholdType(commThresholdType);
    setCommunityVoteThresholdValue(toSafeInt(cfg?.communityVoteThreshold?.value, 60));
    setMinCommunityTokensToCreateProposal(
      minCommunityStr === U64_MAX ? '0' : rawAmountToUiString(minCommunityStr, communityDecimals)
    );
    setDisableCommunityProposalCreation(minCommunityStr === U64_MAX);

    setBaseVotingTimeHours(toSafeFloat(cfg?.baseVotingTime, 72 * 3600) / 3600);
    setMinInstructionHoldUpTimeHours(toSafeFloat(cfg?.minInstructionHoldUpTime, 0) / 3600);
    setVotingCoolOffTimeHours(toSafeFloat(cfg?.votingCoolOffTime, 0) / 3600);
    setDepositExemptProposalCount(toSafeInt(cfg?.depositExemptProposalCount, 0));

    setCommunityVoteTipping(voteTippingFromConfig(cfg?.communityVoteTipping, VoteTipping.Strict));
    setMinCouncilTokensToCreateProposal(
      rawAmountToUiString(toBnString(cfg?.minCouncilTokensToCreateProposal, '1'), councilDecimals)
    );
    setCouncilVoteThresholdType(councilThresholdType);
    setCouncilVoteThresholdValue(toSafeInt(cfg?.councilVoteThreshold?.value, 60));
    setCouncilVetoVoteThresholdType(councilVetoType);
    setCouncilVetoVoteThresholdValue(toSafeInt(cfg?.councilVetoVoteThreshold?.value, 60));
    setCommunityVetoVoteThresholdType(communityVetoType);
    setCommunityVetoVoteThresholdValue(toSafeInt(cfg?.communityVetoVoteThreshold?.value, 60));
    setCouncilVoteTipping(voteTippingFromConfig(cfg?.councilVoteTipping, VoteTipping.Strict));
    },
    [rulesWallet]
  );

  const initializeRealmConfig = React.useCallback(async (communityDecimals: number) => {
    if (!realm) return;

    const authority = toBase58OrEmpty(realm?.account?.authority);
    const council = toBase58OrEmpty(realm?.account?.config?.councilMint);
    const minCommunityToCreateGov = toBnString(
      realm?.account?.config?.minCommunityTokensToCreateGovernance,
      '1'
    );

    let pct = 100;
    try {
      const src = realm?.account?.config?.communityMintMaxVoteWeightSource;
      const sourceValue = Number(toBnString(src?.value, MintMaxVoteWeightSource.SUPPLY_FRACTION_BASE.toString()));
      const base = Number(MintMaxVoteWeightSource.SUPPLY_FRACTION_BASE.toString());
      if (base > 0 && Number.isFinite(sourceValue)) {
        pct = Math.max(0, Math.min(100, (sourceValue / base) * 100));
      }
    } catch {
      pct = 100;
    }

    setRealmAuthority(authority);
    setCouncilMint(council);
    setCommunityMintMaxVoteWeightPct(pct);
    setMinCommunityTokensToCreateGovernance(rawAmountToUiString(minCommunityToCreateGov, communityDecimals));

    try {
      const config = await getRealmConfigIndexed(null, realm?.owner, realm?.pubkey);
      const commCfg = config?.account?.communityTokenConfig;
      const cCfg = config?.account?.councilTokenConfig;

      if (commCfg) {
        setCommunityTokenType(tokenTypeFromConfig(commCfg?.tokenType, GoverningTokenType.Liquid));
        setCommunityVoterWeightAddin(toBase58OrEmpty(commCfg?.voterWeightAddin));
        setCommunityMaxVoterWeightAddin(toBase58OrEmpty(commCfg?.maxVoterWeightAddin));
      }

      if (cCfg) {
        setCouncilTokenType(tokenTypeFromConfig(cCfg?.tokenType, GoverningTokenType.Membership));
        setCouncilVoterWeightAddin(toBase58OrEmpty(cCfg?.voterWeightAddin));
        setCouncilMaxVoterWeightAddin(toBase58OrEmpty(cCfg?.maxVoterWeightAddin));
      }
    } catch {
      // keep defaults
    }
  }, [realm]);

  const fetchMintDecimals = React.useCallback(async () => {
    let nextCommunityDecimals = 0;
    let nextCouncilDecimals = 0;

    try {
      const communityMintPk = realm?.account?.communityMint;
      if (communityMintPk) {
        const communityMintInfo = await getMint(RPC_CONNECTION as any, new PublicKey(toBase58OrEmpty(communityMintPk)));
        nextCommunityDecimals = communityMintInfo?.decimals || 0;
      }
    } catch {
      nextCommunityDecimals = 0;
    }

    try {
      const councilMintPk = realm?.account?.config?.councilMint;
      if (councilMintPk) {
        const councilMintInfo = await getMint(RPC_CONNECTION as any, new PublicKey(toBase58OrEmpty(councilMintPk)));
        nextCouncilDecimals = councilMintInfo?.decimals || 0;
      }
    } catch {
      nextCouncilDecimals = 0;
    }

    return {
      communityDecimals: nextCommunityDecimals,
      councilDecimals: nextCouncilDecimals,
    };
  }, [realm]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const { communityDecimals, councilDecimals } = await fetchMintDecimals();
      if (cancelled) return;

      setCommunityMintDecimals(communityDecimals);
      setCouncilMintDecimals(councilDecimals);
      initializeGovernanceConfig(communityDecimals, councilDecimals);
      initializeRealmConfig(communityDecimals);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, fetchMintDecimals, initializeGovernanceConfig, initializeRealmConfig]);

  const closeAll = () => {
    setOpen(false);
    if (handleCloseExtMenu) handleCloseExtMenu();
  };

  const buildProposalObject = (
    ix: TransactionInstruction[],
    fallbackTitle: string,
    fallbackDescription: string
  ) => ({
    title: (proposalTitle || '').trim() || fallbackTitle,
    description: (proposalDescription || '').trim() || fallbackDescription,
    ix,
    aix: [],
    nativeWallet: governanceNativeWallet,
    governingMint,
    draft: isDraft,
    editProposalAddress,
  });

  const getProgramInfo = async () => {
    const programId = parseRequiredPublicKey(
      toBase58OrEmpty(realm?.owner || rulesWallet?.owner),
      'Governance program ID'
    );
    const realmPk = parseRequiredPublicKey(toBase58OrEmpty(realm?.pubkey), 'Realm');
    const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realmPk);
    return { programId, realmPk, programVersion };
  };

  const handleTransferRealmAuthorityToRulesWallet = async () => {
    try {
      if (!publicKey || !sendTransaction) {
        enqueueSnackbar('Connect wallet first.', { variant: 'error' });
        return;
      }

      const targetAuthorityStr = toBase58OrEmpty(rulesWallet?.pubkey);
      if (!targetAuthorityStr) {
        enqueueSnackbar('No governance wallet available to transfer authority to.', { variant: 'error' });
        return;
      }

      const currentAuthorityPk = parseRequiredPublicKey(realmAuthority, 'Realm authority');
      if (currentAuthorityPk.toBase58() !== publicKey.toBase58()) {
        enqueueSnackbar('Connected wallet is not the current realm authority.', { variant: 'error' });
        return;
      }

      const targetAuthorityPk = new PublicKey(targetAuthorityStr);
      if (targetAuthorityPk.toBase58() === currentAuthorityPk.toBase58()) {
        enqueueSnackbar('Realm authority is already set to this governance wallet.', { variant: 'info' });
        return;
      }

      setTransferringAuthority(true);
      const { programId, realmPk, programVersion } = await getProgramInfo();

      const ix = createSetRealmAuthority(
        programId,
        programVersion,
        realmPk,
        currentAuthorityPk,
        targetAuthorityPk,
        SetRealmAuthorityAction.SetChecked
      );

      const tx = new Transaction().add(ix);
      const signature = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 5,
      } as any);

      const latest = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        'confirmed'
      );

      setRealmAuthority(targetAuthorityPk.toBase58());
      enqueueSnackbar(`Realm authority transferred to ${targetAuthorityPk.toBase58()}`, { variant: 'success' });
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to transfer realm authority', { variant: 'error' });
    } finally {
      setTransferringAuthority(false);
    }
  };

  const connectedWalletIsRealmAuthority =
    Boolean(publicKey) && Boolean(realmAuthority) && publicKey!.toBase58() === realmAuthority.trim();
  const rulesWalletStr = toBase58OrEmpty(rulesWallet?.pubkey);
  const canTransferToRulesWallet =
    connectedWalletIsRealmAuthority && Boolean(rulesWalletStr) && rulesWalletStr !== realmAuthority.trim();

  const buildGovernanceConfigFromForm = React.useCallback(
    () =>
      new GovernanceConfig({
        communityVoteThreshold: new VoteThreshold({
          type: communityVoteThresholdType,
          value: thresholdValue(communityVoteThresholdValue, communityVoteThresholdType),
        }),
        minCommunityTokensToCreateProposal: disableCommunityProposalCreation
          ? new BN(U64_MAX)
          : uiAmountToRawBn(
              minCommunityTokensToCreateProposal,
              communityMintDecimals,
              'Min Community Tokens To Create Proposal'
            ),
        minInstructionHoldUpTime: Math.max(0, Math.floor((minInstructionHoldUpTimeHours || 0) * 3600)),
        baseVotingTime: Math.max(3600, Math.floor((baseVotingTimeHours || 0) * 3600)),
        communityVoteTipping,
        minCouncilTokensToCreateProposal: uiAmountToRawBn(
          minCouncilTokensToCreateProposal,
          councilMintDecimals,
          'Min Council Tokens To Create Proposal'
        ),
        councilVoteThreshold: new VoteThreshold({
          type: councilVoteThresholdType,
          value: thresholdValue(councilVoteThresholdValue, councilVoteThresholdType),
        }),
        councilVetoVoteThreshold: new VoteThreshold({
          type: councilVetoVoteThresholdType,
          value: thresholdValue(councilVetoVoteThresholdValue, councilVetoVoteThresholdType),
        }),
        communityVetoVoteThreshold: new VoteThreshold({
          type: communityVetoVoteThresholdType,
          value: thresholdValue(communityVetoVoteThresholdValue, communityVetoVoteThresholdType),
        }),
        councilVoteTipping,
        votingCoolOffTime: Math.max(0, Math.floor((votingCoolOffTimeHours || 0) * 3600)),
        depositExemptProposalCount: Math.max(0, Math.floor(depositExemptProposalCount || 0)),
      }),
    [
      communityVoteThresholdType,
      communityVoteThresholdValue,
      disableCommunityProposalCreation,
      minCommunityTokensToCreateProposal,
      communityMintDecimals,
      minInstructionHoldUpTimeHours,
      baseVotingTimeHours,
      communityVoteTipping,
      minCouncilTokensToCreateProposal,
      councilMintDecimals,
      councilVoteThresholdType,
      councilVoteThresholdValue,
      councilVetoVoteThresholdType,
      councilVetoVoteThresholdValue,
      communityVetoVoteThresholdType,
      communityVetoVoteThresholdValue,
      councilVoteTipping,
      votingCoolOffTimeHours,
      depositExemptProposalCount,
    ]
  );

  const handleCreateGovernanceConfigProposal = async () => {
    try {
      if (!rulesWallet?.pubkey) {
        enqueueSnackbar('Missing governance rules wallet', { variant: 'error' });
        return;
      }

      setLoading(true);
      const { programId, programVersion } = await getProgramInfo();
      const governancePk = parseRequiredPublicKey(toBase58OrEmpty(rulesWallet.pubkey), 'Governance rules wallet');

      const governanceConfig = buildGovernanceConfigFromForm();

      const ix = createSetGovernanceConfig(programId, programVersion, governancePk, governanceConfig);
      const proposal = buildProposalObject(
        [ix],
        'Update Governance Config',
        'Update SPL Governance configuration for this governance account.'
      );

      closeAll();
      setInstructions(proposal);
      setExpandedLoader(true);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to build governance config proposal', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRealmConfigProposal = async () => {
    try {
      setLoading(true);
      const { programId, realmPk, programVersion } = await getProgramInfo();

      const authorityPk = parseRequiredPublicKey(realmAuthority, 'Realm authority');
      const councilMintPk = parseOptionalPublicKey(councilMint);

      const base = Number(MintMaxVoteWeightSource.SUPPLY_FRACTION_BASE.toString());
      const pct = Math.max(0, Math.min(100, Number(communityMintMaxVoteWeightPct || 0)));
      const sourceValue = Math.round((pct / 100) * base);

      const mintMaxVoteWeightSource = new MintMaxVoteWeightSource({
        type: MintMaxVoteWeightSourceType.SupplyFraction,
        value: new BN(sourceValue.toString()),
      });

      const communityTokenConfig = new GoverningTokenConfigAccountArgs({
        voterWeightAddin: parseOptionalPublicKey(communityVoterWeightAddin),
        maxVoterWeightAddin: parseOptionalPublicKey(communityMaxVoterWeightAddin),
        tokenType: communityTokenType,
      });

      const councilTokenConfig = new GoverningTokenConfigAccountArgs({
        voterWeightAddin: parseOptionalPublicKey(councilVoterWeightAddin),
        maxVoterWeightAddin: parseOptionalPublicKey(councilMaxVoterWeightAddin),
        tokenType: councilTokenType,
      });

      const ix = await createSetRealmConfig(
        programId,
        programVersion,
        realmPk,
        authorityPk,
        councilMintPk,
        mintMaxVoteWeightSource,
        uiAmountToRawBn(
          minCommunityTokensToCreateGovernance,
          communityMintDecimals,
          'Min Community Tokens To Create Governance'
        ),
        communityTokenConfig,
        councilTokenConfig,
        undefined
      );

      const proposal = buildProposalObject(
        [ix],
        'Update Realm Config',
        'Update SPL Governance realm-level configuration.'
      );

      closeAll();
      setInstructions(proposal);
      setExpandedLoader(true);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to build realm config proposal', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Manage Governance + Realm Settings" placement="right">
        <MenuItem onClick={publicKey ? () => setOpen(true) : undefined}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Governance Config
        </MenuItem>
      </Tooltip>

      <BootstrapDialog
        fullWidth
        maxWidth="md"
        open={open}
        onClose={closeAll}
        PaperProps={{
          style: {
            background: '#13151C',
            border: '1px solid rgba(255,255,255,0.05)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
          },
        }}
      >
        <DialogTitle sx={{ m: 0, p: 2 }}>
          SPL Governance Config Editor
          <IconButton
            aria-label="close"
            onClick={closeAll}
            sx={{ position: 'absolute', right: 8, top: 8, color: (theme) => theme.palette.grey[500] }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <DialogContentText sx={{ mb: 2, textAlign: 'center' }}>
            Build proposal instructions to update Governance and Realm configuration.
          </DialogContentText>

          <Tabs
            value={tabMode}
            onChange={(_, value) => setTabMode(value)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ mb: 2 }}
          >
            <Tab value="governance" label="Governance Config" />
            <Tab value="realm" label="Realm Config" />
          </Tabs>

          {tabMode === 'governance' && (
            <Grid container spacing={1.2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Vote Threshold (%)"
                  type="number"
                  value={communityVoteThresholdValue}
                  onChange={(e) => setCommunityVoteThresholdValue(toSafeInt(e.target.value, 0))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <TextField
                    select
                    label="Community Threshold Type"
                    value={communityVoteThresholdType}
                    onChange={(e) => setCommunityVoteThresholdType(Number(e.target.value) as VoteThresholdType)}
                  >
                    <MenuItem value={VoteThresholdType.YesVotePercentage}>Yes %</MenuItem>
                    <MenuItem value={VoteThresholdType.QuorumPercentage}>Quorum %</MenuItem>
                    <MenuItem value={VoteThresholdType.Disabled}>Disabled</MenuItem>
                  </TextField>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={disableCommunityProposalCreation}
                      onChange={(e) => setDisableCommunityProposalCreation(e.target.checked)}
                    />
                  }
                  label="Disable community proposal creation (set u64 max)"
                />
              </Grid>

              {!disableCommunityProposalCreation && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label={`Min Community Tokens To Create Proposal (decimals: ${communityMintDecimals})`}
                    value={minCommunityTokensToCreateProposal}
                    onChange={(e) => setMinCommunityTokensToCreateProposal(e.target.value || '0')}
                  />
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Min Council Tokens To Create Proposal (decimals: ${councilMintDecimals})`}
                  value={minCouncilTokensToCreateProposal}
                  onChange={(e) => setMinCouncilTokensToCreateProposal(e.target.value || '0')}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Base Voting Time (hours)"
                  type="number"
                  value={baseVotingTimeHours}
                  onChange={(e) => setBaseVotingTimeHours(toSafeFloat(e.target.value, 1))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Instruction Hold-up (hours)"
                  type="number"
                  value={minInstructionHoldUpTimeHours}
                  onChange={(e) => setMinInstructionHoldUpTimeHours(toSafeFloat(e.target.value, 0))}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Voting Cool-off (hours)"
                  type="number"
                  value={votingCoolOffTimeHours}
                  onChange={(e) => setVotingCoolOffTimeHours(toSafeFloat(e.target.value, 0))}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Deposit Exempt Proposal Count"
                  type="number"
                  value={depositExemptProposalCount}
                  onChange={(e) => setDepositExemptProposalCount(toSafeInt(e.target.value, 0))}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Community Vote Tipping"
                  value={communityVoteTipping}
                  onChange={(e) => setCommunityVoteTipping(Number(e.target.value) as VoteTipping)}
                >
                  <MenuItem value={VoteTipping.Strict}>Strict</MenuItem>
                  <MenuItem value={VoteTipping.Early}>Early</MenuItem>
                  <MenuItem value={VoteTipping.Disabled}>Disabled</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Council Approval Threshold (%)"
                  type="number"
                  value={councilVoteThresholdValue}
                  onChange={(e) => setCouncilVoteThresholdValue(toSafeInt(e.target.value, 0))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Council Approval Threshold Type"
                  value={councilVoteThresholdType}
                  onChange={(e) => setCouncilVoteThresholdType(Number(e.target.value) as VoteThresholdType)}
                >
                  <MenuItem value={VoteThresholdType.YesVotePercentage}>Yes %</MenuItem>
                  <MenuItem value={VoteThresholdType.QuorumPercentage}>Quorum %</MenuItem>
                  <MenuItem value={VoteThresholdType.Disabled}>Disabled</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Council Veto Threshold (%)"
                  type="number"
                  value={councilVetoVoteThresholdValue}
                  onChange={(e) => setCouncilVetoVoteThresholdValue(toSafeInt(e.target.value, 0))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Council Veto Threshold Type"
                  value={councilVetoVoteThresholdType}
                  onChange={(e) => setCouncilVetoVoteThresholdType(Number(e.target.value) as VoteThresholdType)}
                >
                  <MenuItem value={VoteThresholdType.YesVotePercentage}>Yes %</MenuItem>
                  <MenuItem value={VoteThresholdType.QuorumPercentage}>Quorum %</MenuItem>
                  <MenuItem value={VoteThresholdType.Disabled}>Disabled</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Veto Threshold (%)"
                  type="number"
                  value={communityVetoVoteThresholdValue}
                  onChange={(e) => setCommunityVetoVoteThresholdValue(toSafeInt(e.target.value, 0))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Community Veto Threshold Type"
                  value={communityVetoVoteThresholdType}
                  onChange={(e) => setCommunityVetoVoteThresholdType(Number(e.target.value) as VoteThresholdType)}
                >
                  <MenuItem value={VoteThresholdType.YesVotePercentage}>Yes %</MenuItem>
                  <MenuItem value={VoteThresholdType.QuorumPercentage}>Quorum %</MenuItem>
                  <MenuItem value={VoteThresholdType.Disabled}>Disabled</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Council Vote Tipping"
                  value={councilVoteTipping}
                  onChange={(e) => setCouncilVoteTipping(Number(e.target.value) as VoteTipping)}
                >
                  <MenuItem value={VoteTipping.Strict}>Strict</MenuItem>
                  <MenuItem value={VoteTipping.Early}>Early</MenuItem>
                  <MenuItem value={VoteTipping.Disabled}>Disabled</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          )}

          {tabMode === 'realm' && (
            <Grid container spacing={1.2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Realm Authority"
                  value={realmAuthority}
                  onChange={(e) => setRealmAuthority(e.target.value)}
                />
              </Grid>

              {connectedWalletIsRealmAuthority && (
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ opacity: 0.85 }}>
                      Connected wallet is current realm authority.
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={!canTransferToRulesWallet || transferringAuthority}
                      onClick={handleTransferRealmAuthorityToRulesWallet}
                    >
                      {transferringAuthority ? 'Transferring...' : 'Transfer to Current Governance Wallet'}
                    </Button>
                  </Box>
                </Grid>
              )}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Council Mint (optional)"
                  value={councilMint}
                  onChange={(e) => setCouncilMint(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Min Community Tokens To Create Governance (decimals: ${communityMintDecimals})`}
                  value={minCommunityTokensToCreateGovernance}
                  onChange={(e) => setMinCommunityTokensToCreateGovernance(e.target.value || '0')}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Mint Max Vote Weight (%)"
                  type="number"
                  value={communityMintMaxVoteWeightPct}
                  onChange={(e) => setCommunityMintMaxVoteWeightPct(toSafeFloat(e.target.value, 100))}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Community Token Type"
                  value={communityTokenType}
                  onChange={(e) => setCommunityTokenType(Number(e.target.value) as GoverningTokenType)}
                >
                  <MenuItem value={GoverningTokenType.Liquid}>Liquid</MenuItem>
                  <MenuItem value={GoverningTokenType.Membership}>Membership</MenuItem>
                  <MenuItem value={GoverningTokenType.Dormant}>Dormant</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Voter Weight Addin"
                  value={communityVoterWeightAddin}
                  onChange={(e) => setCommunityVoterWeightAddin(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Max Voter Weight Addin"
                  value={communityMaxVoterWeightAddin}
                  onChange={(e) => setCommunityMaxVoterWeightAddin(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Council Token Type"
                  value={councilTokenType}
                  onChange={(e) => setCouncilTokenType(Number(e.target.value) as GoverningTokenType)}
                >
                  <MenuItem value={GoverningTokenType.Liquid}>Liquid</MenuItem>
                  <MenuItem value={GoverningTokenType.Membership}>Membership</MenuItem>
                  <MenuItem value={GoverningTokenType.Dormant}>Dormant</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Council Voter Weight Addin"
                  value={councilVoterWeightAddin}
                  onChange={(e) => setCouncilVoterWeightAddin(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Council Max Voter Weight Addin"
                  value={councilMaxVoterWeightAddin}
                  onChange={(e) => setCouncilMaxVoterWeightAddin(e.target.value)}
                />
              </Grid>

            </Grid>
          )}

          {openAdvanced ? (
            <Box sx={{ mt: 2 }}>
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
            </Box>
          ) : null}

          <Box sx={{ mt: 1.5, textAlign: 'center' }}>
            <Typography variant="caption">Made with ❤️ by Grape</Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ display: 'flex', justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            size="small"
            onClick={() => setOpenAdvanced((v) => !v)}
            startIcon={<SettingsIcon sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px!important' }} />}
          >
            Advanced
          </Button>

          <Button
            autoFocus
            disabled={loading || !publicKey}
            onClick={tabMode === 'governance' ? handleCreateGovernanceConfigProposal : handleCreateRealmConfigProposal}
            startIcon={<SettingsIcon sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px!important' }} />}
          >
            {loading ? 'Building...' : 'Create Proposal'}
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </>
  );
}
