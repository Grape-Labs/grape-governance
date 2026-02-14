import React from 'react';
import BN from 'bn.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAssociatedTokenAddress,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token-v2';
import {
  GovernanceConfig,
  GoverningTokenConfigAccountArgs,
  GoverningTokenType,
  MintMaxVoteWeightSource,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  getNativeTreasuryAddress,
  withCreateGovernance,
  withDepositGoverningTokens,
  withCreateRealm,
} from '@solana/spl-governance';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import GroupsIcon from '@mui/icons-material/Groups';
import Diversity3Icon from '@mui/icons-material/Diversity3';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmark';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material/';
import { DEFAULT_NFT_VOTER_PLUGIN_V2 } from '../../utils/grapeTools/helpers';

type DaoType = 'multisig' | 'community' | 'nft';

const GOVERNANCE_PROGRAM_ID = new PublicKey('GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw');
const PROGRAM_VERSION = 3;
const MAX_MEMBERS = 10;
const U64_MAX = '18446744073709551615';

function parseUniquePublicKeys(input: string, label: string): PublicKey[] {
  const values = (input || '')
    .split(/[\n,\s]+/)
    .map((v) => v.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(values));
  const parsed: PublicKey[] = [];
  for (const value of unique) {
    try {
      parsed.push(new PublicKey(value));
    } catch {
      throw new Error(`Invalid ${label} address: ${value}`);
    }
  }
  return parsed;
}

export default function CreateSplGovernanceDaoButton() {
  const [open, setOpen] = React.useState(false);
  const [daoType, setDaoType] = React.useState<DaoType>('multisig');
  const [submitting, setSubmitting] = React.useState(false);

  const [realmName, setRealmName] = React.useState('');
  const [minCommunityTokens, setMinCommunityTokens] = React.useState('1');

  const [multisigMembers, setMultisigMembers] = React.useState('');

  const [communityMint, setCommunityMint] = React.useState('');
  const [useCouncil, setUseCouncil] = React.useState(false);
  const [councilMembers, setCouncilMembers] = React.useState('');

  const [nftPluginProgram, setNftPluginProgram] = React.useState(DEFAULT_NFT_VOTER_PLUGIN_V2);
  const [nftCommunityMint, setNftCommunityMint] = React.useState('');
  const [createInitialTreasury, setCreateInitialTreasury] = React.useState(true);

  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!publicKey) return;
    if (!multisigMembers.trim()) {
      setMultisigMembers(publicKey.toBase58());
    }
  }, [publicKey, multisigMembers]);

  const resetState = React.useCallback(() => {
    setDaoType('multisig');
    setRealmName('');
    setMinCommunityTokens('1');
    setCommunityMint('');
    setUseCouncil(false);
    setCouncilMembers('');
    setNftPluginProgram(DEFAULT_NFT_VOTER_PLUGIN_V2);
    setNftCommunityMint('');
    setCreateInitialTreasury(true);
  }, []);

  const closeDialog = () => {
    if (submitting) return;
    setOpen(false);
    resetState();
  };

  const sendAndConfirm = React.useCallback(
    async (instructions: TransactionInstruction[], signers: Keypair[] = []) => {
      if (!publicKey) throw new Error('Wallet not connected');
      if (!instructions.length) return '';

      const tx = new Transaction().add(...instructions);
      const signature = await sendTransaction(tx, connection, {
        signers,
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

      return signature;
    },
    [connection, publicKey, sendTransaction]
  );

  const appendNewMintCreation = React.useCallback(
    async (instructions: TransactionInstruction[], signers: Keypair[], decimals = 0) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const mintKeypair = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemptMint(connection);

      instructions.push(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: 82,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        })
      );

      instructions.push(
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        )
      );

      signers.push(mintKeypair);
      return mintKeypair.publicKey;
    },
    [connection, publicKey]
  );

  const mintMembershipTokens = React.useCallback(
    async (mint: PublicKey, members: PublicKey[]) => {
      if (!publicKey || members.length === 0) return;

      const maxInstructionsPerTx = 10;
      let chunk: TransactionInstruction[] = [];

      const flushChunk = async () => {
        if (!chunk.length) return;
        await sendAndConfirm(chunk);
        chunk = [];
      };

      for (const member of members) {
        const ata = await getAssociatedTokenAddress(
          mint,
          member,
          false,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        const memberIxs: TransactionInstruction[] = [];
        const ataInfo = await connection.getAccountInfo(ata);
        if (!ataInfo) {
          memberIxs.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              ata,
              member,
              mint,
              TOKEN_PROGRAM_ID,
              ASSOCIATED_TOKEN_PROGRAM_ID
            )
          );
        }

        memberIxs.push(createMintToInstruction(mint, ata, publicKey, 1, [], TOKEN_PROGRAM_ID));

        if (chunk.length + memberIxs.length > maxInstructionsPerTx) {
          await flushChunk();
        }
        chunk.push(...memberIxs);
      }

      await flushChunk();
    },
    [connection, publicKey, sendAndConfirm]
  );

  const lockMintAuthorities = React.useCallback(
    async (mints: PublicKey[]) => {
      if (!publicKey || !mints.length) return;

      const uniqueMints = Array.from(new Set(mints.map((mint) => mint.toBase58()))).map(
        (mint) => new PublicKey(mint)
      );
      const lockIxs: TransactionInstruction[] = [];

      for (const mint of uniqueMints) {
        lockIxs.push(
          createSetAuthorityInstruction(
            mint,
            publicKey,
            AuthorityType.MintTokens,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
        lockIxs.push(
          createSetAuthorityInstruction(
            mint,
            publicKey,
            AuthorityType.FreezeAccount,
            null,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      await sendAndConfirm(lockIxs);
    },
    [publicKey, sendAndConfirm]
  );

  const buildDefaultGovernanceConfig = React.useCallback((type: DaoType) => {
    const communityThresholdType =
      type === 'multisig' ? VoteThresholdType.Disabled : VoteThresholdType.YesVotePercentage;

    return new GovernanceConfig({
      communityVoteThreshold: new VoteThreshold({
        type: communityThresholdType,
        value: communityThresholdType === VoteThresholdType.Disabled ? undefined : 60,
      }),
      minCommunityTokensToCreateProposal: new BN(type === 'multisig' ? U64_MAX : '1'),
      minInstructionHoldUpTime: 0,
      baseVotingTime: 72 * 3600,
      communityVoteTipping: VoteTipping.Strict,
      minCouncilTokensToCreateProposal: new BN(1),
      councilVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: 60,
      }),
      councilVetoVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: 60,
      }),
      communityVetoVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: 60,
      }),
      councilVoteTipping: VoteTipping.Strict,
      votingCoolOffTime: 0,
      depositExemptProposalCount: 0,
    });
  }, []);

  const createInitialTreasuryGovernance = React.useCallback(
    async (realmPk: PublicKey, governingMintPk: PublicKey, type: DaoType) => {
      if (!publicKey) throw new Error('Wallet not connected');

      const sourceAta = await getAssociatedTokenAddress(
        governingMintPk,
        publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const sourceAccount = await connection.getAccountInfo(sourceAta);
      if (!sourceAccount) {
        throw new Error(
          `No governance token account found for ${publicKey.toBase58()}. Ensure creator holds at least 1 voting token.`
        );
      }

      const governanceIxs: TransactionInstruction[] = [];
      const tokenOwnerRecordPk = await withDepositGoverningTokens(
        governanceIxs,
        GOVERNANCE_PROGRAM_ID,
        PROGRAM_VERSION,
        realmPk,
        sourceAta,
        governingMintPk,
        publicKey,
        publicKey,
        publicKey,
        new BN(1)
      );

      const governancePk = await withCreateGovernance(
        governanceIxs,
        GOVERNANCE_PROGRAM_ID,
        PROGRAM_VERSION,
        realmPk,
        undefined,
        buildDefaultGovernanceConfig(type),
        tokenOwnerRecordPk,
        publicKey,
        publicKey
      );

      await sendAndConfirm(governanceIxs);
      const nativeTreasuryPk = await getNativeTreasuryAddress(GOVERNANCE_PROGRAM_ID, governancePk);

      return { governancePk, nativeTreasuryPk };
    },
    [buildDefaultGovernanceConfig, connection, publicKey, sendAndConfirm]
  );

  const handleCreateDao = async () => {
    if (!connected || !publicKey) {
      enqueueSnackbar('Connect your wallet first.', { variant: 'error' });
      return;
    }

    const nextRealmName = realmName.trim();
    if (!nextRealmName) {
      enqueueSnackbar('DAO name is required.', { variant: 'error' });
      return;
    }

    let minCommunityBn: BN;
    try {
      minCommunityBn = new BN((minCommunityTokens || '1').trim() || '1');
    } catch {
      enqueueSnackbar('Min community tokens must be a valid integer.', { variant: 'error' });
      return;
    }

    if (minCommunityBn.lt(new BN(1))) {
      enqueueSnackbar('Min community tokens must be at least 1.', { variant: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const setupInstructions: TransactionInstruction[] = [];
      const setupSigners: Keypair[] = [];
      const createdMintsToLock: PublicKey[] = [];

      let communityMintPk: PublicKey;
      let councilMintPk: PublicKey | undefined = undefined;
      let councilMembersPks: PublicKey[] = [];

      let communityTokenConfig: GoverningTokenConfigAccountArgs;
      let councilTokenConfig: GoverningTokenConfigAccountArgs | undefined = undefined;

      if (daoType === 'multisig') {
        councilMembersPks = parseUniquePublicKeys(multisigMembers, 'member');
        if (!councilMembersPks.length) {
          throw new Error('At least one council member is required for Multi-sig DAO.');
        }
        if (councilMembersPks.length > MAX_MEMBERS) {
          throw new Error(`Multi-sig DAO currently supports up to ${MAX_MEMBERS} members per create flow.`);
        }

        communityMintPk = await appendNewMintCreation(setupInstructions, setupSigners, 0);
        councilMintPk = await appendNewMintCreation(setupInstructions, setupSigners, 0);
        createdMintsToLock.push(communityMintPk, councilMintPk);

        communityTokenConfig = new GoverningTokenConfigAccountArgs({
          tokenType: GoverningTokenType.Dormant,
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        });

        councilTokenConfig = new GoverningTokenConfigAccountArgs({
          tokenType: GoverningTokenType.Membership,
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        });
      } else if (daoType === 'community') {
        if (!communityMint.trim()) {
          throw new Error('Community mint is required for Community DAO.');
        }
        communityMintPk = new PublicKey(communityMint.trim());

        if (useCouncil) {
          councilMembersPks = parseUniquePublicKeys(councilMembers, 'council member');
          if (councilMembersPks.length > MAX_MEMBERS) {
            throw new Error(
              `Community DAO council setup currently supports up to ${MAX_MEMBERS} members per create flow.`
            );
          }
          councilMintPk = await appendNewMintCreation(setupInstructions, setupSigners, 0);
          createdMintsToLock.push(councilMintPk);
          councilTokenConfig = new GoverningTokenConfigAccountArgs({
            tokenType: GoverningTokenType.Membership,
            voterWeightAddin: undefined,
            maxVoterWeightAddin: undefined,
          });
        }

        communityTokenConfig = new GoverningTokenConfigAccountArgs({
          tokenType: GoverningTokenType.Liquid,
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        });
      } else {
        const nftPlugin = nftPluginProgram.trim();
        const nftPluginPk = nftPlugin ? new PublicKey(nftPlugin) : undefined;

        if (nftCommunityMint.trim()) {
          communityMintPk = new PublicKey(nftCommunityMint.trim());
        } else {
          communityMintPk = await appendNewMintCreation(setupInstructions, setupSigners, 0);
          createdMintsToLock.push(communityMintPk);
        }

        communityTokenConfig = new GoverningTokenConfigAccountArgs({
          tokenType: GoverningTokenType.Membership,
          voterWeightAddin: nftPluginPk,
          maxVoterWeightAddin: nftPluginPk,
        });
      }

      const realmPk = await withCreateRealm(
        setupInstructions,
        GOVERNANCE_PROGRAM_ID,
        PROGRAM_VERSION,
        nextRealmName,
        publicKey,
        communityMintPk,
        publicKey,
        councilMintPk,
        MintMaxVoteWeightSource.FULL_SUPPLY_FRACTION,
        minCommunityBn,
        communityTokenConfig,
        councilTokenConfig
      );

      await sendAndConfirm(setupInstructions, setupSigners);

      if (councilMintPk && councilMembersPks.length > 0) {
        await mintMembershipTokens(councilMintPk, councilMembersPks);
      }

      let treasuryInfo: { governancePk: PublicKey; nativeTreasuryPk: PublicKey } | null = null;
      if (createInitialTreasury) {
        const preferredGoverningMint = councilMintPk || communityMintPk;
        treasuryInfo = await createInitialTreasuryGovernance(
          realmPk,
          preferredGoverningMint,
          daoType
        );
      }

      if (createdMintsToLock.length > 0) {
        await lockMintAuthorities(createdMintsToLock);
      }

      const successMessage = treasuryInfo
        ? `DAO created: ${realmPk.toBase58()} | Treasury: ${treasuryInfo.nativeTreasuryPk.toBase58()}`
        : `DAO created successfully: ${realmPk.toBase58()}`;

      enqueueSnackbar(successMessage, { variant: 'success' });
      closeDialog();
      navigate(`/dao/${realmPk.toBase58()}`);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar(e?.message || 'Failed to create DAO', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        size="small"
        variant="contained"
        color="primary"
        startIcon={<AddCircleOutlineIcon fontSize="small" />}
        onClick={() => setOpen(true)}
      >
        Create DAO
      </Button>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="md">
        <DialogTitle>Create SPL Governance DAO</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Alert severity="info">
              This creates a new realm on SPL Governance. For Multi-sig and optional council setups, this flow also
              creates a council mint and distributes one membership token per council member.
            </Alert>

            <Tabs
              value={daoType}
              onChange={(_, value) => setDaoType(value)}
              textColor="inherit"
              indicatorColor="secondary"
              variant="fullWidth"
            >
              <Tab icon={<GroupsIcon fontSize="small" />} iconPosition="start" value="multisig" label="Multi-sig" />
              <Tab
                icon={<Diversity3Icon fontSize="small" />}
                iconPosition="start"
                value="community"
                label="Community"
              />
              <Tab
                icon={<CollectionsBookmarkIcon fontSize="small" />}
                iconPosition="start"
                value="nft"
                label="NFT DAO"
              />
            </Tabs>

            <TextField
              fullWidth
              size="small"
              label="DAO Name"
              value={realmName}
              onChange={(e) => setRealmName(e.target.value)}
            />

            <TextField
              fullWidth
              size="small"
              label="Min Community Tokens To Create Governance"
              value={minCommunityTokens}
              onChange={(e) => setMinCommunityTokens(e.target.value)}
              helperText="Realm-level minimum to create governance accounts."
            />

            <FormControlLabel
              control={
                <Switch
                  checked={createInitialTreasury}
                  onChange={(e) => setCreateInitialTreasury(e.target.checked)}
                />
              }
              label="Create initial treasury governance wallet"
            />

            {daoType === 'multisig' && (
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={4}
                label="Council Member Wallets (one per line)"
                value={multisigMembers}
                onChange={(e) => setMultisigMembers(e.target.value)}
                helperText={`Up to ${MAX_MEMBERS} members in this flow.`}
              />
            )}

            {daoType === 'community' && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="Community Mint Address"
                  value={communityMint}
                  onChange={(e) => setCommunityMint(e.target.value)}
                />
                <FormControlLabel
                  control={<Switch checked={useCouncil} onChange={(e) => setUseCouncil(e.target.checked)} />}
                  label="Create council mint and distribute council membership tokens"
                />
                {useCouncil && (
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={4}
                    label="Council Member Wallets (one per line)"
                    value={councilMembers}
                    onChange={(e) => setCouncilMembers(e.target.value)}
                    helperText={`Up to ${MAX_MEMBERS} members in this flow.`}
                  />
                )}
              </>
            )}

            {daoType === 'nft' && (
              <>
                <TextField
                  fullWidth
                  size="small"
                  label="NFT Voter Plugin Program"
                  value={nftPluginProgram}
                  onChange={(e) => setNftPluginProgram(e.target.value)}
                  helperText="Used as both voterWeightAddin and maxVoterWeightAddin."
                />
                <TextField
                  fullWidth
                  size="small"
                  label="Community Mint Address (optional)"
                  value={nftCommunityMint}
                  onChange={(e) => setNftCommunityMint(e.target.value)}
                  helperText="Leave empty to auto-create a 0-decimal mint for the realm."
                />
              </>
            )}

            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              Wallet must be connected and able to pay transaction fees for mint and realm account creation.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDao}
            disabled={submitting || !connected || !publicKey}
          >
            {submitting ? 'Creating...' : 'Create DAO'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
