import React, { useState } from 'react';
import { PublicKey, Signer, TransactionInstruction, Transaction, Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { styled, useTheme } from '@mui/material/styles';
//import { Client } from "discord.js";
import { useSnackbar } from 'notistack';
//import useWindowSize from 'react-use/lib/useWindowSize'
//import Confetti from 'react-confetti'
import Confetti from 'react-dom-confetti';
import { WagmiConfig, createConfig, configureChains, mainnet, useSignMessage, useAccount, useConnect, useDisconnect } from 'wagmi';

import { alchemyProvider } from 'wagmi/providers/alchemy'
import { publicProvider } from 'wagmi/providers/public'
 
import { CoinbaseWalletConnector } from 'wagmi/connectors/coinbaseWallet'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { MetaMaskConnector } from 'wagmi/connectors/metaMask'
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect'

import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createCloseAccountInstruction,
  createBurnInstruction,
  getMint,
} from "@solana/spl-token-v2";

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
  Vote,
  VoteChoice,
  VoteKind,
  getGovernanceProgramVersion,
  withDepositGoverningTokens,
  getRealm,
  getRealms,
  withCastVote,
  getAllProposals,
  getProposal,
  getTokenOwnerRecordsByOwner,
  getVoteRecordsByVoter,
  withSetGovernanceDelegate,
  getAllTokenOwnerRecords,
  getTokenOwnerRecord,
  serializeInstructionToBase64,
  withCreateTokenOwnerRecord,
  
} from '@solana/spl-governance';

import { 
  ALCHEMY_ETH_KEY,
} from '../../utils/grapeTools/constants';

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [alchemyProvider({ apiKey: ALCHEMY_ETH_KEY }), publicProvider()],
)
 
// Set up wagmi config
const config = createConfig({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ chains }),
    new CoinbaseWalletConnector({
      chains,
      options: {
        appName: 'wagmi',
      },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: '...',
      },
    }),
    new InjectedConnector({
      chains,
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
  ],
  publicClient,
  webSocketPublicClient,
})

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

function EthOathView(props:any) {
    const generatePublicKeyFromString = props.generatePublicKeyFromString;
    const setLoading = props.setLoading;

    const [generatedPin, setGeneratedPin] = React.useState(null);
    const [pinCode, setPinCode] = React.useState(null);
    const [ethWalletAddress, setEthWalletAddress] = React.useState(null);
    const [validEmail, setValidEmail] = React.useState(null);
    const [open, setOpen] = React.useState(false);

    //const { signMessage, isLoading } = useSignMessage();

    function generateVerificationCode() {
        // Generate a random 6-digit code
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        setGeneratedPin(verificationCode);
        return verificationCode.toString();
    }

    const handleSignMessage = async () => {
      try {
        const message = 'This is the message to be signed.';
        //const signature = await signMessage(message);
        //console.log('Signature:', signature);
      } catch (error) {
        console.error('Error signing message:', error);
      }
    };
  

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
      const { address } = useAccount()
      const { connect } = useConnect({
        connector: new InjectedConnector(),
      })
      const { disconnect } = useDisconnect()
    
      React.useEffect(() =>{
        if (address){
          handleLogin();
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
      return <Button 
              variant='outlined'
              sx={{color:'white',textTransform:'none',borderRadius:'17px'}}
              onClick={() => connect()}>Connect Wallet</Button>
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
                        Ethereum
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
                        <Typography variant="caption">To get started you will need to sign a message with your Ethereum wallet</Typography>
                    </Box>

                    
                    <FormControl fullWidth sx={{mb:2}}>
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
                    <WagmiConfig config={config}>
                      <Profile />
                    </WagmiConfig>
                    </FormControl>
                </DialogContent>
            </BootstrapDialog>
        </>
    );
}

export default EthOathView;