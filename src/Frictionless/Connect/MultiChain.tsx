import React, { useState } from 'react';
import { PublicKey, Signer, TransactionInstruction, Transaction, Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { styled, useTheme } from '@mui/material/styles';
//import { Client } from "discord.js";
import { useSnackbar } from 'notistack';
//import useWindowSize from 'react-use/lib/useWindowSize'
//import Confetti from 'react-confetti'
import Confetti from 'react-dom-confetti';
import { QueryClientProvider } from 'react-query';

//import { DynamicContextProvider, DynamicWidget, useDynamicContext } from '@dynamic-labs/sdk-react-core';
//import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
//import { SolanaWalletConnectors } from "@dynamic-labs/solana";

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
  APP_LOGO,
} from '../../utils/grapeTools/constants';

import FingerprintIcon from '@mui/icons-material/Fingerprint';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import { createCastVoteTransaction } from '../../utils/governanceTools/components/instructions/createVote';

import { parseMintNaturalAmountFromDecimalAsBN } from '../../utils/grapeTools/helpers';

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
    const [fromDisconnect, setFromDisconnect] = React.useState(false);
    const [generatedPin, setGeneratedPin] = React.useState(null);
    const [pinCode, setPinCode] = React.useState(null);
    const [connectedAddress, setConnectedAddress] = React.useState("");
    const [connectedUser, setConnectedUser] = React.useState(null);
    const [disconnectWallet, setDisconnectWallet] = React.useState(null);
    const [authMode, setAuthMode] = React.useState(null);
    const [open, setOpen] = React.useState(false);
    const [autoConnect, setAutoConnect] = React.useState(false);

    const recoveredAddress = React.useRef<string>()
    
    function generateVerificationCode() {
        // Generate a random 6-digit code
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        setGeneratedPin(verificationCode);
        return verificationCode.toString();
    }

    async function handleLogin() {
        setLoading(true)
        try {
          generatePublicKeyFromString(connectedAddress);
          setLoading(false)
          setOpen(false);
          setAutoConnect(false);
        } catch (error) {
          console.log("error", error);
          setLoading(false)
        }
    }

    const handleCloseDialog = () => {
        setOpen(false);
    }

    const handleClickOpen = () => {
      //if (primaryWallet)
      setOpen(true);
      setDisconnectWallet(true);
      setConnectedAddress(null);
    };

    const handleClose = () => {
        setOpen(false);
    };

    
    React.useEffect(() => {
      if (connectedAddress){
        if (autoConnect)
          handleLogin();
        console.log("connectedAddress "+JSON.stringify(connectedAddress));
      }
        
    }, [connectedAddress])
    
    React.useEffect(() => {
      if (connectedUser){
        //handleLogin();
        console.log("connectedUser "+JSON.stringify(connectedUser?.verifiedCredentials));
        
        console.log("connectedUser email "+JSON.stringify(connectedUser?.email));
      }
    }, [connectedUser])

    React.useEffect(() => {
      if (authMode)
        console.log("authMode: "+JSON.stringify(authMode));
    }, [authMode])
    
    function DisconnectComponent() {
      //const { handleLogOut } = useDynamicContext();
    
      const handleUserLogOut = () => {
      //  handleLogOut();
      };
      
      return (
        <>
          <Grid container xs={12} alignContent={"center"} justifyContent={"center"} sx={{mt:2}}>
            <ButtonGroup sx={{borderRadius:'17px'}}>
              <Tooltip title="Disconnect">
                <Button color="inherit" variant="outlined" onClick={handleUserLogOut} sx={{borderRadius:'17px'}}>
                  <LinkOffIcon fontSize="inherit" sx={{mr:1}}/> Disconnect
                </Button>
              </Tooltip>
              <Tooltip title="Connect with Frictionless">
                <Button aria-label="connect" color="primary" variant="outlined" onClick={handleLogin} sx={{borderRadius:'17px'}}>
                  <LinkIcon fontSize="inherit" sx={{mr:1}} /> Connect
                </Button>
              </Tooltip>
            </ButtonGroup>
          </Grid>
        </>
      );
    }


    function Profile() {
      /*
      const { authMode, primaryWallet, user } = useDynamicContext();
      
      //console.log("user: "+JSON.stringify(user))

      const primaryWalletAddress = primaryWallet?.address;
      const userEmail = user?.email;
      //const twitterHandle = user?.identities.find(identity => identity.provider === 'twitter')?.username;
      //const discordHandle = user?.identities.find(identity => identity.provider === 'discord')?.username;
      const userHandle = user?.username || user?.verifiedCredentials[0].oauthUsername;
      
      const getConnectedAccounts = async () => {
        const connectedAccounts = await primaryWallet?.connector.getConnectedAccounts();
        return connectedAccounts;
      };

      if (userHandle){
        //console.log("using handle "+userHandle)
        setConnectedUser(userHandle);
        setConnectedAddress(userHandle);
        setAuthMode(authMode);
        return <><DisconnectComponent /></>
      }else if (userEmail){
        //console.log("using email")
        setConnectedUser(user);
        setConnectedAddress(userEmail);
        setAuthMode(authMode);
        return <><DisconnectComponent /></>
      } else if (primaryWalletAddress){
        //console.log("using wallet")
        setConnectedUser(user);
        setConnectedAddress(primaryWalletAddress);
        setAuthMode(authMode);
        return <><DisconnectComponent /></>
      }
      if (autoConnect && connectedAddress){
        handleLogin();
      }
      */
    }

    React.useEffect(() => {
      generateVerificationCode();
    }, [])

    return (

        <>
            <Box
                sx={{mt:2}}
            >
                <Tooltip title='Connect with Blockchain Wallet or Web2 Identity'>
                    <Button 
                        variant='outlined'
                        onClick={handleClickOpen}
                        //disabled
                        sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                        <FingerprintIcon sx={{mr:1}}/>
                        Get started!
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
                        <Typography variant="caption">Verify & connect with Frictionless</Typography>
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
                      <Grid container alignContent={"center"} justifyContent={"center"} sx={{textAlign:'center'}}>
                        {/*generatedPin &&
                          <DynamicContextProvider 

                            settings={{ 
                              initialAuthenticationMode: 'connect-and-sign',
                              environmentId: DYNAMICXYZ_KEY,
                              walletConnectors: [ EthereumWalletConnectors, SolanaWalletConnectors ],
                              appName: "Governance by Grape",
                              appLogoUrl: "https://shdw-drive.genesysgo.net/5nwi4maAZ3v3EwTJtcg9oFfenQUX7pb9ry4KuhyUSawK/logo_grape.png",
                              siweStatement: "You will need to sign this message to continue. *** Frictionless Pin: "+generatedPin+" ***",
                              eventsCallbacks: {
                                onSignedMessage: ({ messageToSign, signedMessage }) => {
                                  // here we can login no need to use the Profile
                                  console.log(
                                    `onSignedMessage was called: ${messageToSign}, ${signedMessage}`
                                  );
                                  //const { authMode, primaryWallet, user } = useDynamicContext();
                                  //const primaryWalletAddress = primaryWallet?.address;
                                  setAutoConnect(true);
                                  //handleLogin(primaryWalletAddress);
                                },
                                onLinkSuccess: () => {
                                  console.log("Link Success!")
                                },
                                onEmailVerificationSuccess: () => {
                                  console.log(
                                    `Email Verification Success!`
                                  );
                                  //const { authMode, primaryWallet, user } = useDynamicContext();
                                  //const userEmail = user?.email;
                                  setAutoConnect(true);
                                  //handleLogin(userEmail);
                                },
                                onAuthSuccess: () => {
                                  console.log("OAuth Verification Success!")
                                  //const { authMode, primaryWallet, user } = useDynamicContext();
                                  //const userHandle = user?.username || user?.verifiedCredentials[0].oauthUsername;
                                  setAutoConnect(true);
                                  //handleLogin(userHandle);
                                }
                              },
                            }}> 
                            <DynamicWidget 
                              innerButtonComponent={<button>Connect &amp; Get Started</button>}
                            /> 
                            <Profile />
                          </DynamicContextProvider> 
                        */}
                      </Grid>
                    </FormControl>
                </DialogContent>

            </BootstrapDialog>
        </>
    );
}

export default MultiChainOathView;