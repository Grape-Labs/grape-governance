import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import createMultisigWallet from '../../utils/createMultisigWallet'; // your internal function
import { useSnackbar } from 'notistack';

export default function MultiSigDAOCreator() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { enqueueSnackbar } = useSnackbar();

  const [realmName, setRealmName] = useState('');
  const [members, setMembers] = useState(['']);
  const [voteThreshold, setVoteThreshold] = useState('60');
  const [submitting, setSubmitting] = useState(false);

  const handleChangeAddress = (value: string, index: number) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  const handleAddMember = () => setMembers([...members, '']);

  const handleSubmit = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      enqueueSnackbar('Connect your wallet first.', { variant: 'error' });
      return;
    }

    if (!realmName || members.some((m) => !m)) {
      enqueueSnackbar('Please fill in all fields.', { variant: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const result = await createMultisigWallet({
        connection,
        wallet,
        realmName,
        tokensToGovernThreshold: undefined,
        useSupplyFactor: true,
        communityAbsoluteMaxVoteWeight: undefined,
        communityMintSupplyFactor: undefined,
        communityYesVotePercentage: 'disabled',
        existingCommunityMintPk: undefined,
        transferCommunityMintAuthority: true,
        createCouncil: true,
        existingCouncilMintPk: undefined,
        transferCouncilMintAuthority: true,
        communityTokenConfig: {
          tokenType: 2, // Dormant
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        },
        councilTokenConfig: {
          tokenType: 1, // Membership
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        },
        councilWalletPks: members.map((m) => new PublicKey(m)),
        skipRealmAuthority: false,
        _programVersion: 3,
        councilYesVotePercentage: voteThreshold,
      });

      if (result?.realmPk) {
        enqueueSnackbar('Multi-Sig DAO created successfully!', { variant: 'success' });
        window.location.href = `/dao/${result.realmPk.toBase58()}`;
      } else {
        throw new Error('Creation failed.');
      }
    } catch (err) {
      console.error(err);
      enqueueSnackbar(err.message || 'Transaction failed', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box maxWidth={600} mx="auto" mt={4}>
      <Typography variant="h5" gutterBottom>Create a Multi-Sig DAO</Typography>

      <TextField
        fullWidth
        label="DAO Name"
        margin="normal"
        value={realmName}
        onChange={(e) => setRealmName(e.target.value)}
      />

      <Typography variant="subtitle1" mt={2}>Council Members</Typography>
      {members.map((addr, i) => (
        <TextField
          key={i}
          fullWidth
          label={`Member ${i + 1} Address`}
          margin="dense"
          value={addr}
          onChange={(e) => handleChangeAddress(e.target.value, i)}
        />
      ))}
      <Button onClick={handleAddMember} sx={{ mt: 1 }}>
        + Add Member
      </Button>

      <TextField
        fullWidth
        label="Approval Threshold (%)"
        type="number"
        margin="normal"
        value={voteThreshold}
        onChange={(e) => setVoteThreshold(e.target.value)}
      />

      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmit}
        disabled={submitting}
        fullWidth
        sx={{ mt: 3 }}
      >
        {submitting ? <CircularProgress size={24} /> : 'Create DAO'}
      </Button>
    </Box>
  );
}