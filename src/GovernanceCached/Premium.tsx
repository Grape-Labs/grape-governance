import * as React from 'react';
import { useParams, useSearchParams } from "react-router-dom";

import {
    Box,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography
} from '@mui/material'

import { GovernanceMetricsView } from './GovernanceMetrics';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';

import { 
  APP_WHITELIST 
} from '../utils/grapeTools/constants';

export function PremiumView (this: any, props: any) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeStep, setActiveStep] = React.useState(0);
  const { publicKey, connect } = useWallet();
  const {handlekey} = useParams<{ handlekey: string }>();
  const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey || props?.handlekey;

  const isWhitelisted = (address: string) => {
    if (APP_WHITELIST){
      if (APP_WHITELIST.length > 0){
        const whitelist = APP_WHITELIST.split(",");
        for (const item of whitelist){
          if (address === item)
            return true;
        }
      }
      /*
      if (address === APP_WHITELIST)
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
          <GovernanceMetricsView handlekey={urlParams} />
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
                <Typography variant='h4'>Grape Governance<br/>Decentralized Caching</Typography>
                </p>
                <WalletDialogProvider className="grape-wallet-provider">
                  <WalletMultiButton className="grape-wallet-button">
                    Connect your wallet
                  </WalletMultiButton>
                </WalletDialogProvider>
              <p>
              <Typography variant='h5'>This is a premium feature and requires your wallet to hold the Grape Governance Access Token or to be Whitelisted</Typography>
              </p>
            </Box>
          </>
      }
    </Box>
  );
}