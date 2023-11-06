import React, { useState } from 'react';
import { PublicKey, Signer, TransactionInstruction, Transaction, Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { styled, useTheme } from '@mui/material/styles';
//import { Client } from "discord.js";
import { useSnackbar } from 'notistack';
//import useWindowSize from 'react-use/lib/useWindowSize'
//import Confetti from 'react-confetti'
import Confetti from 'react-dom-confetti';
import { QueryClientProvider } from 'react-query';

import { DynamicContextProvider, DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { SolanaWalletConnectors } from "@dynamic-labs/solana";
import { useEmailVerificationRequest } from '@dynamic-labs/sdk-react';

import {
  Typography,
  Tooltip,
  ButtonGroup,
  Button,
  IconButton,
  Grid,
  Chip,
  Box,
  Divider,
  Table,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  TextField,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';

import { 
  ALCHEMY_ETH_KEY, 
  WALLET_CONNECT_PROJECT_ID,
  DYNAMICXYZ_KEY,
} from '../../utils/grapeTools/constants';

import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import { createCastVoteTransaction } from '../../utils/governanceTools/components/instructions/createVote';

import { parseMintNaturalAmountFromDecimalAsBN } from '../../utils/grapeTools/helpers';

import { 
  RPC_CONNECTION,
  FRICTIONLESS_WALLET,
  FRICTIONLESS_BG,
} from '../../utils/grapeTools/constants';

import ExplorerView from '../../utils/grapeTools/Explorer';
import { ParamType } from 'ethers/lib/utils';

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: theme.palette.grey[theme.palette.mode === 'light' ? 200 : 800],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: theme.palette.mode === 'light' ? '#1a90ff' : '#ffffff',
    },
  }));

const StyledTable = styled(Table)(({ theme }) => ({
    '& .MuiTableCell-root': {
        borderBottom: '1px solid rgba(255,255,255,0.05)'
    },
}));

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}
  
const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
  
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

function MultiChainOathView(props:any) {
    const generatePublicKeyFromString = props.generatePublicKeyFromString;
    const setLoading = props.setLoading;

    const [generatedPin, setGeneratedPin] = React.useState(null);
    const [pinCode, setPinCode] = React.useState(null);
    const [ethWalletAddress, setEthWalletAddress] = React.useState(null);
    const [validEmail, setValidEmail] = React.useState(null);
    const [open, setOpen] = React.useState(false);
    
    const recoveredAddress = React.useRef<string>()
    
    function generateVerificationCode() {
        // Generate a random 6-digit code
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        setGeneratedPin(verificationCode);
        return verificationCode.toString();
    }




    const handleSignMessage = async () => {
      try {
        const pin = generateVerificationCode();
        const message = pin;
        //useSignMessage({message});
        
        //console.log('Signature:', signature);
      } catch (error) {
        console.error('Error signing message:', error);
      }
    };
    /*
    React.useEffect(() => {
      ;(async () => {
        if (generatedPin && signMessageData) {
          const recoveredAddress = await recoverMessageAddress({
            message: generatedPin,
            signature: signMessageData,
          })
          //setRecoveredAddress(recoveredAddress)
          if (recoveredAddress)
            handleLogin();
        }
      })()
    }, [signMessageData])
    */
    async function handleLogin() {
        setLoading(true)
        try {
          // handle login...
          generatePublicKeyFromString(ethWalletAddress);
          setLoading(false)
          setOpen(false);
        } catch (error) {
          console.log("error", error);
          setLoading(false)
        }
    }

    const handleCloseDialog = () => {
        setOpen(false);
    }

    const handleClickOpen = () => {
        setOpen(true);
        //getVotingParticipants();
    };

    const handleClose = () => {
        setOpen(false);
    };

    function Profile() {
      const { primaryWallet, user } = useDynamicContext();
      const primaryWalletAddress = primaryWallet?.address;
      if (primaryWalletAddress){
        return <>{primaryWalletAddress}</>
      } else  
        return <></>

      /*
      const { address } = useAccount()
      const { connect } = useConnect({
        connector: new InjectedConnector(),
      })
      const { disconnect } = useDisconnect()
    
      React.useEffect(() =>{
        if (address){
          handleSignMessage();
          //handleLogin();
        }
      }, [address])

      if (address)
        return (
          <div>
            <Box sx={{textAlign:'center'}}>
            Connected to {address}
            </Box>

            <Box sx={{textAlign:'center'}}>
              <Button 
                variant='outlined'
                onClick={() => disconnect()}
                //disabled
                sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>Disconnect</Button>
            </Box>
          </div>
        )
      return (
          <div>
            <Box sx={{textAlign:'center'}}>
              <Button 
                variant='outlined'
                sx={{color:'white',textTransform:'none',borderRadius:'17px'}}
                onClick={() => connect()}>Connect Wallet</Button>
              </Box>
          </div>
      );
      */
     return <></>
    }

    return (

        <>
            <Box
                sx={{mt:2}}
            >
                <Tooltip title='Connect Ethereum Wallet'>
                    <Button 
                        variant='outlined'
                        onClick={handleClickOpen}
                        //disabled
                        sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                        <AccountBalanceWalletIcon sx={{mr:1}}/>
                        MultiChain
                    </Button>
                </Tooltip>
            </Box>

            <BootstrapDialog 
                maxWidth={"xl"}
                fullWidth={true}
                open={open} onClose={handleClose}
                PaperProps={{
                    style: {
                        background: '#13151C',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '20px'
                    }
                    }}
                >
                <BootstrapDialogTitle id="create-storage-pool" onClose={handleCloseDialog}>
                    Connect
                </BootstrapDialogTitle>
                <DialogContent>

                    <Box sx={{textAlign:'center'}}>
                        <Typography variant="caption">To get started you will need to connect with your Ethereum wallet</Typography>
                    </Box>

                    
                    <FormControl fullWidth sx={{mt:1, mb:2}}>
                    {/*isLoading && <p>Signing message...</p>}
                    {!isLoading && (
                     
                        <Button 
                            variant="contained"
                            onClick={handleSignMessage}
                            //disabled={(!emailAddress || !pinCode) || (+pinCode !== +generatedPin)}  
                        >
                            <LinkIcon sx={{mr:1}}/> Sign, Connect &amp; Participate
                        </Button>
                    )*/}
                    
                      <DynamicContextProvider 
                        settings={{ 
                          environmentId: DYNAMICXYZ_KEY,
                          walletConnectors: [ EthereumWalletConnectors, SolanaWalletConnectors ],
                        }}> 
                        <DynamicWidget /> 
                        <Profile />
                      </DynamicContextProvider> 
                    </FormControl>
                </DialogContent>
            </BootstrapDialog>
        </>
    );
}

export default MultiChainOathView;