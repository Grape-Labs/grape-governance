import * as React from 'react';

import {
    Box,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    LinearProgress
} from '@mui/material'

import { GovernanceSnapshotView } from './GovernanceSnapshot';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';
import DiscordIcon from '../components/static/DiscordIcon';

import { 
  APP_WHITELIST,
  ADMIN_TOKEN
} from '../utils/grapeTools/constants';

import { 
  isGated
} from '../utils/grapeTools/helpers';

const steps = [
  'Collection Snapshot by UA/Collection',  
  'Collection Snapshot by Creator',  
  'Holder Snapshot'];

export function AdminView (this: any, props: any) {
  const [activeStep, setActiveStep] = React.useState(0);
  const [skipped, setSkipped] = React.useState(new Set<number>());
  const { publicKey, connect } = useWallet();
  const [loading, setLoading] = React.useState(false);
  const [verified, setVerified] = React.useState(false);

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

  const getVerificationStatus = async() => {
    if (ADMIN_TOKEN){
      const verify = await isGated(publicKey.toBase58(), ADMIN_TOKEN);
      console.log("Governance Verified Status: "+JSON.stringify(verify));
      setVerified(verify);
      //if (!verify) // uncomment if we have more to load
    }
    setLoading(false);
  }

  React.useEffect(() => { 
    if (!loading && publicKey){
      setLoading(true);
      if (!verified)
        getVerificationStatus();
    }
  }, [publicKey]);
  
  return (
    <Box sx={{ width: '100%', mt:6 }}>
      {loading ?
          <>
            <Box
                  sx={{
                      mt:6,
                      background: 'rgba(0, 0, 0, 0.6)',
                      borderRadius: '17px',
                      p:4,
                      alignItems: 'center', textAlign: 'center'
                  }} 
              > 
                  <Typography variant="caption">Loading Governance: Processing Admin Verification</Typography>
                  
                  <LinearProgress color="inherit" />
                  
            </Box>
          </>
      :   
        <Box sx={{ width: '100%', mt:6 }}>
          {verified ?
            <GovernanceSnapshotView />
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
                  <Typography variant='h4'>Governance by Grape</Typography>
                  </p>
                  {!publicKey &&
                    <WalletDialogProvider className="grape-wallet-provider">
                      <WalletMultiButton className="grape-wallet-button">
                        Connect your wallet
                      </WalletMultiButton>
                    </WalletDialogProvider>
                  }
                <p>
                <Typography variant='h5'>You need to be holding the ADMIN access token to manage Governance</Typography>

                <Typography variant='body1'>Reach out to the Grape DAO on 
                <Button 
                    target='_blank' href={`https://discord.gg/grapedao`}
                    color='inherit'
                    sx={{
                    verticalAlign: 'middle',
                    display: 'inline-flex',
                    borderRadius:'17px',
                    m:1,
                    textTransform:'none'
                }}>
                    <DiscordIcon sx={{mt:1,fontSize:27.5,color:'white'}} /> <strong>Discord</strong>
                </Button> to get started</Typography>
                </p>
              </Box>
            </>
          }
        </Box>
      }
      </Box>
  );
}