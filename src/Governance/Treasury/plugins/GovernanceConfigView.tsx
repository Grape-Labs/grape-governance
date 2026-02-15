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
  Alert,
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
import { getAllTokenOwnerRecordsIndexed, getRealmConfigIndexed } from '../../api/queries';

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
type GovernanceSecurityGuideMode = 'balanced' | 'strict';
type RepairSeverity = 'critical' | 'warning' | 'info';
type RepairIssue = {
  id: string;
  severity: RepairSeverity;
  title: string;
  description: string;
  tab?: TabMode;
  actionLabel?: string;
  action?: () => void;
};

const GOVERNANCE_FORM_DEFAULTS = {
  minInstructionHoldUpTimeHours: 0,
  votingCoolOffTimeHours: 0,
  disableCommunityProposalCreation: false,
};

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

function isValidPublicKeyString(input: string): boolean {
  try {
    const value = (input || '').trim();
    if (!value) return false;
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
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

function percentile(sortedValues: number[], p: number): number {
  if (!sortedValues.length) return 0;
  const clamped = Math.max(0, Math.min(1, p));
  const idx = (sortedValues.length - 1) * clamped;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sortedValues[low];
  const w = idx - low;
  return sortedValues[low] * (1 - w) + sortedValues[high] * w;
}

function formatSuggestedUiAmount(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const maxDecimals = Math.min(6, Math.max(0, decimals));
  return value.toFixed(maxDecimals).replace(/\.?0+$/, '');
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
  const [repairMode, setRepairMode] = React.useState(false);
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

  const applyGovernanceSecurityGuide = React.useCallback((mode: GovernanceSecurityGuideMode) => {
    // Guide updates are non-destructive: only fill fields that still look unset/default.
    let changed = 0;
    const recommendedHoldUp = mode === 'strict' ? 4 : 1;
    const recommendedCoolOff = mode === 'strict' ? 8 : 1;

    if (Number(minInstructionHoldUpTimeHours || 0) === GOVERNANCE_FORM_DEFAULTS.minInstructionHoldUpTimeHours) {
      setMinInstructionHoldUpTimeHours(recommendedHoldUp);
      changed++;
    }

    if (Number(votingCoolOffTimeHours || 0) === GOVERNANCE_FORM_DEFAULTS.votingCoolOffTimeHours) {
      setVotingCoolOffTimeHours(recommendedCoolOff);
      changed++;
    }

    if (
      mode === 'strict' &&
      disableCommunityProposalCreation === GOVERNANCE_FORM_DEFAULTS.disableCommunityProposalCreation
    ) {
      setDisableCommunityProposalCreation(true);
      changed++;
    }

    if (changed > 0) {
      enqueueSnackbar(
        `${mode === 'strict' ? 'Strict' : 'Balanced'} guide applied to ${changed} unset field${changed === 1 ? '' : 's'}.`,
        { variant: 'success' }
      );
    } else {
      enqueueSnackbar('Guide skipped: existing values already set.', { variant: 'info' });
    }
  }, [
    minInstructionHoldUpTimeHours,
    votingCoolOffTimeHours,
    disableCommunityProposalCreation,
    enqueueSnackbar,
  ]);

  // Realm config fields
  const [realmAuthority, setRealmAuthority] = React.useState<string>('');
  const [communityMint, setCommunityMint] = React.useState<string>('');
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
  const [communityMinProposalGuidance, setCommunityMinProposalGuidance] = React.useState<{
    holders: number;
    activeHolders: number;
    balanced: string;
    strict: string;
    balancedEligiblePctAll: number;
    strictEligiblePctAll: number;
    balancedEligiblePctActive: number;
    strictEligiblePctActive: number;
  } | null>(null);
  const [communityMinProposalGuidanceLoading, setCommunityMinProposalGuidanceLoading] = React.useState(false);

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
    const community = toBase58OrEmpty(realm?.account?.communityMint);
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
    setCommunityMint(community);
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

  React.useEffect(() => {
    if (!open) return;
    const realmPk = toBase58OrEmpty(realm?.pubkey);
    const realmOwner = toBase58OrEmpty(realm?.owner);
    const communityMint = toBase58OrEmpty(realm?.account?.communityMint);
    if (!realmPk || !realmOwner || !communityMint) {
      setCommunityMinProposalGuidance(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setCommunityMinProposalGuidanceLoading(true);
        const records = await getAllTokenOwnerRecordsIndexed(realmPk, realmOwner, undefined, communityMint);
        if (cancelled) return;

        const holderRows = (Array.isArray(records) ? records : [])
          .map((item: any) => {
            const raw = toBnString(item?.account?.governingTokenDepositAmount, '0');
            const balance = Number(rawAmountToUiString(raw, communityMintDecimals));
            const totalVotes = toSafeInt(item?.account?.totalVotesCount, 0);
            const unrelinquished = toSafeInt(item?.account?.unrelinquishedVotesCount, 0);
            const outstanding = toSafeInt(item?.account?.outstandingProposalCount, 0);
            const isActive = totalVotes > 0 || unrelinquished > 0 || outstanding > 0;
            return {
              balance: Number.isFinite(balance) ? balance : 0,
              isActive,
            };
          })
          .filter((item: { balance: number }) => item.balance > 0);

        if (!holderRows.length) {
          setCommunityMinProposalGuidance(null);
          return;
        }

        const allBalances = holderRows.map((item: { balance: number }) => item.balance).sort((a: number, b: number) => a - b);
        const activeBalances = holderRows
          .filter((item: { isActive: boolean }) => item.isActive)
          .map((item: { balance: number }) => item.balance)
          .sort((a: number, b: number) => a - b);

        const holderCount = allBalances.length;
        const activeCount = activeBalances.length;
        const minActiveSample = Math.max(10, Math.ceil(holderCount * 0.05));
        const scoringPool = activeCount >= minActiveSample ? activeBalances : allBalances;

        // Higher anti-spam defaults:
        // Balanced targets roughly top 25% of the activity-weighted cohort.
        // Strict targets roughly top 10% of the activity-weighted cohort.
        const balancedQuantile = percentile(scoringPool, 0.75);
        const strictQuantile = percentile(scoringPool, 0.9);

        // Enforce a supply-based floor so whales can't lower threshold by sparse activity.
        const totalCommunityUiSupply = allBalances.reduce((acc: number, v: number) => acc + v, 0);
        const balancedSupplyFloor = totalCommunityUiSupply * 0.0025; // 0.25%
        const strictSupplyFloor = totalCommunityUiSupply * 0.005; // 0.50%

        const minGranularity = communityMintDecimals > 0 ? 1 / Math.pow(10, Math.min(communityMintDecimals, 6)) : 1;
        const balanced = Math.max(minGranularity, balancedQuantile, balancedSupplyFloor);
        const strict = Math.max(minGranularity, strictQuantile, strictSupplyFloor);

        const balancedEligibleAll = allBalances.filter((v: number) => v >= balanced).length;
        const strictEligibleAll = allBalances.filter((v: number) => v >= strict).length;
        const balancedEligibleActive = activeBalances.filter((v: number) => v >= balanced).length;
        const strictEligibleActive = activeBalances.filter((v: number) => v >= strict).length;

        setCommunityMinProposalGuidance({
          holders: holderCount,
          activeHolders: activeCount,
          balanced: formatSuggestedUiAmount(balanced, communityMintDecimals),
          strict: formatSuggestedUiAmount(strict, communityMintDecimals),
          balancedEligiblePctAll: Number(((balancedEligibleAll / holderCount) * 100).toFixed(1)),
          strictEligiblePctAll: Number(((strictEligibleAll / holderCount) * 100).toFixed(1)),
          balancedEligiblePctActive: activeCount > 0 ? Number(((balancedEligibleActive / activeCount) * 100).toFixed(1)) : 0,
          strictEligiblePctActive: activeCount > 0 ? Number(((strictEligibleActive / activeCount) * 100).toFixed(1)) : 0,
        });
      } catch (e) {
        console.log('Failed to compute community proposal threshold guidance', e);
        if (!cancelled) setCommunityMinProposalGuidance(null);
      } finally {
        if (!cancelled) setCommunityMinProposalGuidanceLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, realm, communityMintDecimals]);

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

  const parseUiNumberish = React.useCallback((value: string): number => {
    const n = Number((value || '').replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : NaN;
  }, []);

  const applyRealmRepairGuide = React.useCallback(() => {
    let changed = 0;

    const currentAuthority = toBase58OrEmpty(realm?.account?.authority);
    if (!realmAuthority && currentAuthority) {
      setRealmAuthority(currentAuthority);
      changed++;
    }

    const maxVotePct = Number(communityMintMaxVoteWeightPct);
    if (!Number.isFinite(maxVotePct) || maxVotePct <= 0 || maxVotePct > 100) {
      setCommunityMintMaxVoteWeightPct(100);
      changed++;
    }

    const minGovThreshold = parseUiNumberish(minCommunityTokensToCreateGovernance);
    if (!Number.isFinite(minGovThreshold) || minGovThreshold <= 0) {
      setMinCommunityTokensToCreateGovernance('1');
      changed++;
    }

    if (councilMint && !isValidPublicKeyString(councilMint)) {
      setCouncilMint('');
      changed++;
    }

    if (changed > 0) {
      enqueueSnackbar(`Realm repair guide applied to ${changed} field${changed === 1 ? '' : 's'}.`, {
        variant: 'success',
      });
    } else {
      enqueueSnackbar('Realm repair guide found no local changes to apply.', { variant: 'info' });
    }
  }, [
    realm,
    realmAuthority,
    communityMintMaxVoteWeightPct,
    minCommunityTokensToCreateGovernance,
    councilMint,
    parseUiNumberish,
    enqueueSnackbar,
  ]);

  const applyGovernanceRepairGuide = React.useCallback(() => {
    let changed = 0;

    const minCreateProposal = parseUiNumberish(minCommunityTokensToCreateProposal);
    if (!disableCommunityProposalCreation && (!Number.isFinite(minCreateProposal) || minCreateProposal <= 0)) {
      setMinCommunityTokensToCreateProposal(communityMinProposalGuidance?.strict || '1');
      changed++;
    }

    if (Number(minInstructionHoldUpTimeHours || 0) <= 0) {
      setMinInstructionHoldUpTimeHours(1);
      changed++;
    }
    if (Number(votingCoolOffTimeHours || 0) <= 0) {
      setVotingCoolOffTimeHours(1);
      changed++;
    }
    if (Number(depositExemptProposalCount || 0) > 0) {
      setDepositExemptProposalCount(0);
      changed++;
    }

    if (changed > 0) {
      enqueueSnackbar(`Governance repair guide applied to ${changed} field${changed === 1 ? '' : 's'}.`, {
        variant: 'success',
      });
    } else {
      enqueueSnackbar('Governance repair guide found no local changes to apply.', { variant: 'info' });
    }
  }, [
    minCommunityTokensToCreateProposal,
    disableCommunityProposalCreation,
    communityMinProposalGuidance,
    minInstructionHoldUpTimeHours,
    votingCoolOffTimeHours,
    depositExemptProposalCount,
    parseUiNumberish,
    enqueueSnackbar,
  ]);

  const repairIssues = React.useMemo<RepairIssue[]>(() => {
    const issues: RepairIssue[] = [];

    if (!realmAuthority) {
      issues.push({
        id: 'realm-authority-missing',
        severity: 'critical',
        title: 'Realm authority is missing',
        description: 'Load/refresh realm config before creating repair proposals.',
        tab: 'realm',
      });
    } else if (!isValidPublicKeyString(realmAuthority)) {
      issues.push({
        id: 'realm-authority-invalid',
        severity: 'critical',
        title: 'Realm authority is invalid',
        description: 'Realm authority must be a valid public key.',
        tab: 'realm',
      });
    }

    if (rulesWalletStr && realmAuthority && realmAuthority !== rulesWalletStr) {
      issues.push({
        id: 'realm-authority-mismatch',
        severity: 'warning',
        title: 'Realm authority is not the current governance wallet',
        description:
          canTransferToRulesWallet
            ? `Transfer authority to ${rulesWalletStr} to keep treasury and config management proposal-driven.`
            : `Current authority (${realmAuthority}) differs from governance wallet (${rulesWalletStr}).`,
        tab: 'realm',
        actionLabel: canTransferToRulesWallet ? 'Transfer Authority' : undefined,
        action: canTransferToRulesWallet ? handleTransferRealmAuthorityToRulesWallet : undefined,
      });
    }

    if (!communityMint || !isValidPublicKeyString(communityMint)) {
      issues.push({
        id: 'community-mint-invalid',
        severity: 'critical',
        title: 'Community mint is missing or invalid',
        description: 'Community mint is immutable after realm creation. If incorrect, create a new realm and migrate.',
        tab: 'realm',
      });
    }

    if (councilMint && !isValidPublicKeyString(councilMint)) {
      issues.push({
        id: 'council-mint-invalid',
        severity: 'warning',
        title: 'Council mint input is invalid',
        description: 'Clear or replace with a valid mint before building the realm config proposal.',
        tab: 'realm',
        actionLabel: 'Clear Council Mint',
        action: () => setCouncilMint(''),
      });
    }

    const realmPct = Number(communityMintMaxVoteWeightPct);
    if (!Number.isFinite(realmPct) || realmPct <= 0 || realmPct > 100) {
      issues.push({
        id: 'realm-max-vote-pct-invalid',
        severity: 'warning',
        title: 'Community max vote weight % is out of range',
        description: 'Value should be > 0 and <= 100.',
        tab: 'realm',
        actionLabel: 'Set to 100%',
        action: () => setCommunityMintMaxVoteWeightPct(100),
      });
    }

    const minGovCreate = parseUiNumberish(minCommunityTokensToCreateGovernance);
    if (!Number.isFinite(minGovCreate) || minGovCreate <= 0) {
      issues.push({
        id: 'realm-min-create-governance-invalid',
        severity: 'warning',
        title: 'Min community tokens to create governance is too low',
        description: 'Set a positive threshold to reduce governance wallet spam.',
        tab: 'realm',
        actionLabel: 'Set to 1',
        action: () => setMinCommunityTokensToCreateGovernance('1'),
      });
    }

    const minCreateProposal = parseUiNumberish(minCommunityTokensToCreateProposal);
    if (!disableCommunityProposalCreation && (!Number.isFinite(minCreateProposal) || minCreateProposal <= 0)) {
      issues.push({
        id: 'gov-min-create-proposal-invalid',
        severity: 'warning',
        title: 'Min community tokens to create proposal is too low',
        description: 'Set a positive threshold or disable community proposal creation.',
        tab: 'governance',
        actionLabel: 'Apply Strict Guide',
        action: () => applyGovernanceSecurityGuide('strict'),
      });
    }

    if (Number(minInstructionHoldUpTimeHours || 0) <= 0 || Number(votingCoolOffTimeHours || 0) <= 0) {
      issues.push({
        id: 'gov-timing-open',
        severity: 'info',
        title: 'Proposal timing protections are minimal',
        description: 'Hold-up and cool-off at zero increase execution risk and reduce reaction time.',
        tab: 'governance',
        actionLabel: 'Apply Balanced Guide',
        action: () => applyGovernanceSecurityGuide('balanced'),
      });
    }

    if (Number(depositExemptProposalCount || 0) > 0) {
      issues.push({
        id: 'gov-deposit-exempt',
        severity: 'info',
        title: 'Deposit exempt proposal count is non-zero',
        description: 'Keeping this at 0 helps reduce proposal spam in most DAOs.',
        tab: 'governance',
        actionLabel: 'Set to 0',
        action: () => setDepositExemptProposalCount(0),
      });
    }

    return issues;
  }, [
    realmAuthority,
    rulesWalletStr,
    canTransferToRulesWallet,
    handleTransferRealmAuthorityToRulesWallet,
    communityMint,
    councilMint,
    communityMintMaxVoteWeightPct,
    minCommunityTokensToCreateGovernance,
    minCommunityTokensToCreateProposal,
    disableCommunityProposalCreation,
    minInstructionHoldUpTimeHours,
    votingCoolOffTimeHours,
    depositExemptProposalCount,
    parseUiNumberish,
    applyGovernanceSecurityGuide,
  ]);

  const repairCounts = React.useMemo(() => ({
    critical: repairIssues.filter((i) => i.severity === 'critical').length,
    warning: repairIssues.filter((i) => i.severity === 'warning').length,
    info: repairIssues.filter((i) => i.severity === 'info').length,
  }), [repairIssues]);

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

          <Box
            sx={{
              mb: 2,
              p: 1.25,
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: repairMode ? 'rgba(255,193,7,0.06)' : 'rgba(255,255,255,0.03)',
            }}
          >
            <FormControlLabel
              control={
                <Switch
                  checked={repairMode}
                  onChange={(e) => setRepairMode(e.target.checked)}
                />
              }
              label="Repair Mode"
            />
            <Typography variant="caption" sx={{ display: 'block', opacity: 0.75, mb: repairMode ? 1 : 0 }}>
              Detect common misconfigurations and apply safe local fixes before creating repair proposals.
            </Typography>

            {repairMode && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  Found {repairCounts.critical} critical, {repairCounts.warning} warning, {repairCounts.info} advisory issue
                  {(repairCounts.critical + repairCounts.warning + repairCounts.info) === 1 ? '' : 's'}.
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setTabMode('realm');
                      applyRealmRepairGuide();
                    }}
                  >
                    Apply Realm Safe Repairs
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setTabMode('governance');
                      applyGovernanceRepairGuide();
                    }}
                  >
                    Apply Governance Safe Repairs
                  </Button>
                </Box>

                {repairIssues.length === 0 ? (
                  <Alert severity="success">No common repair issues detected in current form state.</Alert>
                ) : (
                  repairIssues.map((issue) => (
                    <Alert
                      key={issue.id}
                      severity={
                        issue.severity === 'critical'
                          ? 'error'
                          : issue.severity === 'warning'
                          ? 'warning'
                          : 'info'
                      }
                      action={
                        issue.action && issue.actionLabel ? (
                          <Button
                            color="inherit"
                            size="small"
                            onClick={() => {
                              if (issue.tab) setTabMode(issue.tab);
                              issue.action && issue.action();
                            }}
                          >
                            {issue.actionLabel}
                          </Button>
                        ) : undefined
                      }
                    >
                      <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
                        {issue.title}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {issue.description}
                      </Typography>
                    </Alert>
                  ))
                )}
              </Box>
            )}
          </Box>

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
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                    Anti-spam Security Guide
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', mb: 1 }}>
                    Guides are non-destructive and only fill fields that are still unset/default.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => applyGovernanceSecurityGuide('balanced')}
                    >
                      Apply Balanced Guide
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => applyGovernanceSecurityGuide('strict')}
                    >
                      Apply Strict Guide
                    </Button>
                  </Box>
                  <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                    Recommended: community proposal threshold around 0.1%-0.5% of community voting supply,
                    deposit exempt count at 0, council min at 1 (membership councils), and non-zero hold-up/cool-off.
                  </Typography>
                  {communityMinProposalGuidanceLoading ? (
                    <Typography variant="caption" sx={{ display: 'block', opacity: 0.65, mt: 0.6 }}>
                      Calculating holder-based recommendation...
                    </Typography>
                  ) : (
                    communityMinProposalGuidance && (
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.85, mt: 0.6 }}>
                        Activity-weighted guide ({communityMinProposalGuidance.holders} holders, {communityMinProposalGuidance.activeHolders} active): Balanced{' '}
                        <b>{communityMinProposalGuidance.balanced}</b> (~{communityMinProposalGuidance.balancedEligiblePctActive}% active / {communityMinProposalGuidance.balancedEligiblePctAll}% all) | Strict{' '}
                        <b>{communityMinProposalGuidance.strict}</b> (~{communityMinProposalGuidance.strictEligiblePctActive}% active / {communityMinProposalGuidance.strictEligiblePctAll}% all).
                      </Typography>
                    )
                  )}
                </Box>
              </Grid>

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

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Mint (immutable in SPL Governance)"
                  value={communityMint}
                  disabled
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
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  SPL Governance does not support changing the community mint of an existing realm. To change it, create a new realm and migrate governance.
                </Typography>
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
