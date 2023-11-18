import * as React from 'react';
import { useParams, useSearchParams } from "react-router-dom";
import { PublicKey } from '@solana/web3.js';

import {
    Box,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    LinearProgress
} from '@mui/material'

import { 
  isGated
} from '../utils/grapeTools/helpers';

import { GovernanceMetricsView } from './GovernanceMetrics';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from '@solana/wallet-adapter-material-ui';

import DiscordIcon from '../components/static/DiscordIcon';

import { 
  APP_WHITELIST,
  RPC_CONNECTION,
  PROP_TOKEN,
  METRICS_TOKEN
} from '../utils/grapeTools/constants';
//import { signMessage } from 'viem/_types/accounts/utils/signMessage';

export function PremiumView (this: any, props: any) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeStep, setActiveStep] = React.useState(0);
  const { publicKey, signMessage } = useWallet();
  const {handlekey} = useParams<{ handlekey: string }>();
  const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey || props?.handlekey;
  const connection = RPC_CONNECTION;
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

    const message = "Grape Governance: Verifying Wallet";
    const messageBuffer = Buffer.from(message);
    let signedMessage = null
    try {
      const message = new TextEncoder().encode(
          `${
              window.location.host
          } wants you to sign in with your Solana account:\n${publicKey.toBase58()}\n\nPlease sign in.`
      );
      signedMessage = await signMessage(message);
      //setSignedMessage(signedMessage.toBase58());
    } catch (error) {
      console.error('Signing failed:', error);
    }
    
    if (signedMessage){
      if (METRICS_TOKEN){
        const verify = await isGated(publicKey.toBase58(), METRICS_TOKEN);
        console.log("Governance Verified Status: "+JSON.stringify(verify));
        setVerified(verify);
        //if (!verify) // uncomment if we have more to load
      }
    } else{
      setVerified(false);
    }
    setLoading(false);
  }

  React.useEffect(() => { 
    if (!loading && (publicKey)){
      setLoading(true);
      if (!verified){
        getVerificationStatus();
      }
    }
  }, [signMessage]);

  return (
    <>
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
                  <Typography variant="caption">Loading Governance: Metrics Verification</Typography>
                  
                  <LinearProgress color="inherit" />
                  
            </Box>
          </>
        :  
        <>
        
          <Box sx={{ width: '100%', mt:6 }}>
            {(verified && publicKey) ?
              <>
                <GovernanceMetricsView handlekey={urlParams} />
              </>
            :
              
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
                    <Typography variant='h5'>You need to be holding the METRICS access token to access powerful governance participation metrics for this DAO</Typography>

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
                
            }
        </Box>
        </>
      }
    </>
  );
}