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
import createTokenizedRealm from '../../utils/createTokenizedRealm'; // your actual function
import { useSnackbar } from 'notistack';

const PROGRAM_VERSION = 3;

export default function CommunityDAOCreator() {
  const wallet = useWallet();
  const { connection } = useConnection();
  const { enqueueSnackbar } = useSnackbar();

  const [realmName, setRealmName] = useState('');
  const [communityMintAddress, setCommunityMintAddress] = useState('');
  const [voteThreshold, setVoteThreshold] = useState('60');
  const [addCouncil, setAddCouncil] = useState(false);
  const [councilMembers, setCouncilMembers] = useState(['']);
  const [submitting, setSubmitting] = useState(false);

  const handleCouncilChange = (value: string, index: number) => {
    const updated = [...councilMembers];
    updated[index] = value;
    setCouncilMembers(updated);
  };

  const handleAddCouncilMember = () => setCouncilMembers([...councilMembers, '']);

  const handleSubmit = async () => {
    if (!wallet.connected || !wallet.publicKey) {
      enqueueSnackbar('Connect your wallet first.', { variant: 'error' });
      return;
    }

    if (!realmName || !communityMintAddress) {
      enqueueSnackbar('Please fill in all required fields.', { variant: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const result = await createTokenizedRealm({
        connection,
        wallet,
        pluginList: [], // add plugins like ['token_voter'] as needed
        coefficientA: 0,
        coefficientB: 0,
        coefficientC: 0,
        civicPass: '',
        programIdAddress: undefined,
        realmName,
        tokensToGovernThreshold: undefined,
        useSupplyFactor: true,
        communityAbsoluteMaxVoteWeight: undefined,
        communityMintSupplyFactor: undefined,
        communityYesVotePercentage: voteThreshold,
        existingCommunityMintPk: new PublicKey(communityMintAddress),
        transferCommunityMintAuthority: true,
        createCouncil: addCouncil,
        existingCouncilMintPk: undefined,
        transferCouncilMintAuthority: true,
        communityTokenConfig: {
          tokenType: 1, // Liquid
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        },
        councilTokenConfig: {
          tokenType: addCouncil ? 1 : 0, // Membership or Dormant
          voterWeightAddin: undefined,
          maxVoterWeightAddin: undefined,
        },
        councilWalletPks: addCouncil ? councilMembers.map((a) => new PublicKey(a)) : [],
        skipRealmAuthority: false,
        _programVersion: PROGRAM_VERSION,
        councilYesVotePercentage: addCouncil ? voteThreshold : undefined,
      });

      if (result?.realmPk) {
        enqueueSnackbar('Community DAO created successfully!', { variant: 'success' });
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
      <Typography variant="h5" gutterBottom>Create a Community DAO</Typography>

      <TextField
        fullWidth
        label="DAO Name"
        margin="normal"
        value={realmName}
        onChange={(e) => setRealmName(e.target.value)}
      />

      <TextField
        fullWidth
        label="Community Token Mint Address"
        margin="normal"
        value={communityMintAddress}
        onChange={(e) => setCommunityMintAddress(e.target.value)}
      />

      <TextField
        fullWidth
        label="Yes Vote Threshold (%)"
        type="number"
        margin="normal"
        value={voteThreshold}
        onChange={(e) => setVoteThreshold(e.target.value)}
      />

      <Box mt={2}>
        <Button onClick={() => setAddCouncil(!addCouncil)} variant="outlined">
          {addCouncil ? 'Remove Council' : 'Add Council Members'}
        </Button>
      </Box>

      {addCouncil && (
        <Box mt={2}>
          <Typography variant="subtitle1">Council Members</Typography>
          {councilMembers.map((addr, i) => (
            <TextField
              key={i}
              fullWidth
              label={`Member ${i + 1}`}
              margin="dense"
              value={addr}
              onChange={(e) => handleCouncilChange(e.target.value, i)}
            />
          ))}
          <Button onClick={handleAddCouncilMember} sx={{ mt: 1 }}>
            + Add Member
          </Button>
        </Box>
      )}

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