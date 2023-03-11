import * as React from 'react';

import {
    Box,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography
} from '@mui/material'

import { GovernanceSnapshotView } from './GovernanceSnapshot';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';

import { 
  GRAPE_WHITELIST 
} from '../utils/grapeTools/constants';

const steps = [
  'Collection Snapshot by UA/Collection',  
  'Collection Snapshot by Creator',  
  'Holder Snapshot'];

export function AdminView (this: any, props: any) {
  const [activeStep, setActiveStep] = React.useState(0);
  const [skipped, setSkipped] = React.useState(new Set<number>());
  const { publicKey, connect } = useWallet();

  const isWhitelisted = (address: string) => {
    if (GRAPE_WHITELIST){
      if (GRAPE_WHITELIST.length > 0){
        const whitelist = GRAPE_WHITELIST.split(",");
        for (const item of whitelist){
          if (address === item)
            return true;
        }
      }
      /*
      if (address === GRAPE_WHITELIST)
        return true;
      */
      return false;
    } else{
      return false;
    }
  }
  
  return (
    <Box sx={{ width: '100%', mt:6 }}>
      {publicKey && isWhitelisted(publicKey.toBase58()) ?
        <>
          <GovernanceSnapshotView />
        </>
      :
        <>
          <Box 
              sx={{ 
                p:1,
                m:1,
                textAlign:'center',
                flexDirection: 'row', 
                maxWidth: '100%',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '24px'
              }}>
                <p>
                <Typography variant='h4'>SPL Governance<br/>Decentralized Caching</Typography>
                </p>
                <WalletDialogProvider className="grape-wallet-provider">
                  <WalletMultiButton className="grape-wallet-button">
                    Connect your wallet to begin
                  </WalletMultiButton>
                </WalletDialogProvider>
              <p>
              <Typography variant='h5'>You need to be whitelisted to access the SPL Governance | Decentralized Caching Admin Panel</Typography>
              </p>
            </Box>
          </>
      }
    </Box>
  );
}