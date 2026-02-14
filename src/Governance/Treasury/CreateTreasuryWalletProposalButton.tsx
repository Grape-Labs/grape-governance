import React from 'react';
import BN from 'bn.js';
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { useWallet, useAnchorWallet } from '@solana/wallet-adapter-react';
import {
  GovernanceConfig,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  getRealm,
  getTokenOwnerRecordAddress,
  withCreateGovernance,
  withCreateNativeTreasury,
  createInstructionData,
} from '@solana/spl-governance';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material/';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useSnackbar } from 'notistack';

import { getGrapeGovernanceProgramVersion } from '../../utils/grapeTools/helpers';
import { RPC_CONNECTION } from '../../utils/grapeTools/constants';
import { createProposalInstructionsV0 } from '../Proposals/createProposalInstructionsV0';

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

function toBn(value: any, fallback = '0'): BN {
  try {
    if (value === undefined || value === null) return new BN(fallback);
    if (BN.isBN(value)) return value as BN;
    if (typeof value === 'string' && value.startsWith('0x')) {
      return new BN(value.slice(2), 16);
    }
    return new BN(value.toString());
  } catch {
    return new BN(fallback);
  }
}

function toVoteThreshold(value: any, fallbackValue = 60): VoteThreshold {
  const type = Number(value?.type);
  const resolvedType = Number.isFinite(type) ? type : VoteThresholdType.YesVotePercentage;
  const resolvedValue = Number(value?.value);

  return new VoteThreshold({
    type: resolvedType,
    value:
      resolvedType === VoteThresholdType.Disabled
        ? undefined
        : Number.isFinite(resolvedValue)
          ? resolvedValue
          : fallbackValue,
  });
}

function buildGovernanceConfigFromRules(sourceConfig: any): GovernanceConfig {
  return new GovernanceConfig({
    communityVoteThreshold: toVoteThreshold(sourceConfig?.communityVoteThreshold, 60),
    minCommunityTokensToCreateProposal: toBn(sourceConfig?.minCommunityTokensToCreateProposal, '1'),
    minInstructionHoldUpTime: Number(sourceConfig?.minInstructionHoldUpTime || 0),
    baseVotingTime: Math.max(3600, Number(sourceConfig?.baseVotingTime || 3600)),
    communityVoteTipping: Number(sourceConfig?.communityVoteTipping ?? VoteTipping.Strict),
    minCouncilTokensToCreateProposal: toBn(sourceConfig?.minCouncilTokensToCreateProposal, '1'),
    councilVoteThreshold: toVoteThreshold(sourceConfig?.councilVoteThreshold, 60),
    councilVetoVoteThreshold: toVoteThreshold(sourceConfig?.councilVetoVoteThreshold, 60),
    communityVetoVoteThreshold: toVoteThreshold(sourceConfig?.communityVetoVoteThreshold, 60),
    councilVoteTipping: Number(sourceConfig?.councilVoteTipping ?? VoteTipping.Strict),
    votingCoolOffTime: Number(sourceConfig?.votingCoolOffTime || 0),
    depositExemptProposalCount: Number(sourceConfig?.depositExemptProposalCount || 0),
  });
}

export default function CreateTreasuryWalletProposalButton(props: any) {
  const realm = props?.realm;
  const governanceAddress = props?.governanceAddress;
  const governanceWallets = Array.isArray(props?.governanceWallets) ? props.governanceWallets : [];
  const onCreated = props?.onCreated;

  const { publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { enqueueSnackbar } = useSnackbar();

  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [selectedRulesWallet, setSelectedRulesWallet] = React.useState('');
  const [walletLabel, setWalletLabel] = React.useState('');
  const [proposalTitle, setProposalTitle] = React.useState('');
  const [proposalDescription, setProposalDescription] = React.useState('');
  const [createNativeTreasury, setCreateNativeTreasury] = React.useState(true);
  const [isDraft, setIsDraft] = React.useState(true);
  const [governingMintChoice, setGoverningMintChoice] = React.useState<'community' | 'council'>('community');

  const communityMint = toBase58OrEmpty(realm?.account?.communityMint);
  const councilMint = toBase58OrEmpty(realm?.account?.config?.councilMint);
  const hasCouncilMint = Boolean(councilMint);

  React.useEffect(() => {
    if (!open) return;
    if (!selectedRulesWallet && governanceWallets.length > 0) {
      setSelectedRulesWallet(toBase58OrEmpty(governanceWallets[0]?.pubkey));
    }
  }, [open, selectedRulesWallet, governanceWallets]);

  React.useEffect(() => {
    if (!open) return;
    if (hasCouncilMint) {
      setGoverningMintChoice('council');
    } else {
      setGoverningMintChoice('community');
    }
  }, [open, hasCouncilMint]);

  const handleCreateProposal = async () => {
    try {
      if (!publicKey || !anchorWallet) {
        enqueueSnackbar('Connect wallet first.', { variant: 'error' });
        return;
      }

      if (!realm || !governanceAddress) {
        enqueueSnackbar('Realm context unavailable.', { variant: 'error' });
        return;
      }

      if (!selectedRulesWallet) {
        enqueueSnackbar('Select governance rules wallet.', { variant: 'error' });
        return;
      }

      const rulesWallet = governanceWallets.find(
        (item: any) => toBase58OrEmpty(item?.pubkey) === selectedRulesWallet
      );
      if (!rulesWallet) {
        enqueueSnackbar('Selected governance wallet not found.', { variant: 'error' });
        return;
      }

      const selectedMint =
        governingMintChoice === 'council' ? councilMint || communityMint : communityMint || councilMint;
      if (!selectedMint) {
        enqueueSnackbar('No governing mint available for proposal creation.', { variant: 'error' });
        return;
      }

      setLoading(true);

      const programId = new PublicKey(toBase58OrEmpty(realm?.owner));
      const realmPk = new PublicKey(toBase58OrEmpty(realm?.pubkey || governanceAddress));
      const governancePk = new PublicKey(selectedRulesWallet);
      const governingMintPk = new PublicKey(selectedMint);
      const createAuthorityPk = governancePk;

      const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realmPk);
      const governanceTokenOwnerRecordPk = await getTokenOwnerRecordAddress(
        programId,
        realmPk,
        governingMintPk,
        governancePk
      );
      const governanceTorAccountInfo = await RPC_CONNECTION.getAccountInfo(governanceTokenOwnerRecordPk);

      const walletTokenOwnerRecordPk = await getTokenOwnerRecordAddress(
        programId,
        realmPk,
        governingMintPk,
        publicKey
      );
      const walletTorAccountInfo = await RPC_CONNECTION.getAccountInfo(walletTokenOwnerRecordPk);

      const indexedRealmAuthorityStr = toBase58OrEmpty(realm?.account?.authority);
      let effectiveRealmAuthorityPk = indexedRealmAuthorityStr
        ? new PublicKey(indexedRealmAuthorityStr)
        : null;

      try {
        const rpcRealm = await getRealm(RPC_CONNECTION, realmPk);
        const rpcRealmAuthorityStr = toBase58OrEmpty(rpcRealm?.account?.authority);
        if (rpcRealmAuthorityStr) {
          effectiveRealmAuthorityPk = new PublicKey(rpcRealmAuthorityStr);
        }
      } catch (realmFetchErr) {
        console.log('Unable to fetch realm authority from RPC, using indexed realm authority');
      }

      const isRealmAuthorityGovernance =
        Boolean(effectiveRealmAuthorityPk) &&
        effectiveRealmAuthorityPk!.toBase58() === governancePk.toBase58();

      const tokenOwnerRecordPk = governanceTorAccountInfo
        ? governanceTokenOwnerRecordPk
        : walletTorAccountInfo
          ? walletTokenOwnerRecordPk
          : governanceTokenOwnerRecordPk;

      if (!governanceTorAccountInfo && !walletTorAccountInfo && !isRealmAuthorityGovernance) {
        throw new Error(
          'No token owner record found for selected governance or your wallet for this mint. You need membership in the selected governing mint first.'
        );
      }

      if (!governanceTorAccountInfo && !isRealmAuthorityGovernance) {
        if (governanceWallets.length > 1) {
          throw new Error(
            'Selected governance has no token owner record for the chosen mint and is not the realm authority governance. Choose a different governing mint or governance wallet.'
          );
        }

        enqueueSnackbar(
          'Only one governance wallet found. Proceeding with your wallet token owner record for proposal creation.',
          { variant: 'info' }
        );
      }

      const ix: TransactionInstruction[] = [];
      const governanceConfig = buildGovernanceConfigFromRules(rulesWallet?.account?.config);
      const createdGovernancePk = await withCreateGovernance(
        ix,
        programId,
        programVersion,
        realmPk,
        undefined,
        governanceConfig,
        tokenOwnerRecordPk,
        createAuthorityPk,
        createAuthorityPk
      );

      if (createNativeTreasury) {
        await withCreateNativeTreasury(ix, programId, programVersion, createdGovernancePk, createAuthorityPk);
      }

      const instructionsData = ix.map((instruction) => ({
        data: createInstructionData(instruction),
        holdUpTime: undefined,
        prerequisiteInstructions: [],
        chunkBy: 1,
      }));

      const label = (walletLabel || '').trim();
      const title = (proposalTitle || '').trim() || (label ? `Add Treasury Wallet: ${label}` : 'Add Treasury Wallet');
      const description =
        (proposalDescription || '').trim() ||
        `Create a new treasury wallet governance${label ? ` (${label})` : ''}. New governance: ${createdGovernancePk.toBase58()}${createNativeTreasury ? ' with native treasury initialization.' : '.'}`;

      const response = await createProposalInstructionsV0(
        programId,
        realmPk,
        governancePk,
        governingMintPk,
        publicKey,
        title,
        description,
        RPC_CONNECTION,
        new Transaction(),
        new Transaction(),
        anchorWallet as any,
        null,
        instructionsData,
        isDraft,
        false,
        publicKey
      );

      enqueueSnackbar(
        response?.address
          ? `Created proposal ${response.address.toBase58()}`
          : 'Created treasury wallet proposal',
        { variant: 'success' }
      );

      setOpen(false);
      if (onCreated) onCreated(response);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to create treasury wallet proposal', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Create a proposal to add a new treasury wallet using selected governance rules">
        <span>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setOpen(true)}
            disabled={!publicKey || governanceWallets.length === 0}
            sx={{ borderRadius: '12px', textTransform: 'none' }}
          >
            New Treasury Wallet
          </Button>
        </span>
      </Tooltip>

      <Dialog open={open} onClose={() => !loading && setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceWalletIcon fontSize="small" />
          Create Treasury Wallet Proposal
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            This builds proposal instructions to create a new governance wallet (and optional native treasury) using the selected governance config.
          </Typography>

          <Grid container spacing={1.2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <InputLabel id="rules-wallet-select-label">Governance Rules Wallet</InputLabel>
              <Select
                fullWidth
                size="small"
                labelId="rules-wallet-select-label"
                value={selectedRulesWallet}
                onChange={(e) => setSelectedRulesWallet(e.target.value)}
              >
                {governanceWallets.map((item: any, idx: number) => {
                  const pubkey = toBase58OrEmpty(item?.pubkey);
                  const nativeWallet = toBase58OrEmpty(item?.nativeTreasuryAddress);
                  return (
                    <MenuItem key={`${pubkey}-${idx}`} value={pubkey}>
                      {pubkey.slice(0, 8)}...{pubkey.slice(-4)} ({nativeWallet.slice(0, 6)}...{nativeWallet.slice(-4)})
                    </MenuItem>
                  );
                })}
              </Select>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Wallet Label (optional)"
                value={walletLabel}
                onChange={(e) => setWalletLabel(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <InputLabel id="governing-mint-select-label">Governing Mint</InputLabel>
              <Select
                fullWidth
                size="small"
                labelId="governing-mint-select-label"
                value={governingMintChoice}
                onChange={(e) => setGoverningMintChoice(e.target.value as 'community' | 'council')}
              >
                <MenuItem value="community">Community</MenuItem>
                {hasCouncilMint && <MenuItem value="council">Council</MenuItem>}
              </Select>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Proposal Title (optional)"
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Proposal Description (optional)"
                multiline
                minRows={3}
                value={proposalDescription}
                onChange={(e) => setProposalDescription(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={createNativeTreasury}
                    onChange={(e) => setCreateNativeTreasury(e.target.checked)}
                  />
                }
                label="Initialize native treasury account"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} />}
                label="Create as draft proposal"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreateProposal} disabled={loading || !publicKey}>
            {loading ? 'Creating...' : 'Create Proposal'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
