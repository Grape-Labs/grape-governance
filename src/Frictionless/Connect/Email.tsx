import React, { useState } from 'react';
import { PublicKey, Signer, TransactionInstruction, Transaction, Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
import { styled, useTheme } from '@mui/material/styles';
//import { Client } from "discord.js";
import { useSnackbar } from 'notistack';
//import useWindowSize from 'react-use/lib/useWindowSize'
//import Confetti from 'react-confetti'
import Confetti from 'react-dom-confetti';

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

import EmailIcon from '@mui/icons-material/Email';
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

function EmailOathView(props:any) {
    const generatePublicKeyFromString = props.generatePublicKeyFromString;
    const setLoading = props.setLoading;

    const [generatedPin, setGeneratedPin] = React.useState(null);
    const [pinCode, setPinCode] = React.useState(null);
    const [emailAddress, setEmailAddress] = React.useState(null);
    const [validEmail, setValidEmail] = React.useState(null);
    const [open, setOpen] = React.useState(false);

    function generateVerificationCode() {
        // Generate a random 6-digit code
        const verificationCode = Math.floor(100000 + Math.random() * 900000);
        setGeneratedPin(verificationCode);
        return verificationCode.toString();
    }

    async function handleLogin() {
        setLoading(true)
        try {
          // handle login...
          generatePublicKeyFromString(emailAddress);
          setLoading(false)
          setOpen(false);
        } catch (error) {
          console.log("error", error);
          setLoading(false)
        }
    }

    const handleEmailChange = (text:string) => {
    
        const regex = /[^\w]+/g;
        const filteredInput = text.replace(regex, '');
        
        // check if valid email
        const emailRegex = /^[A-Z0-9. _%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
        if (emailRegex.test(text)){
          setValidEmail(text);
          generateVerificationCode();
        } else{
          setValidEmail(null);
          setGeneratedPin(null);
        }
    
        setEmailAddress(filteredInput)
      };

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

    return (

        <>
            <Box
                sx={{mt:2}}
            >
                <Tooltip title='Connect via Email'>
                    <Button 
                        variant='outlined'
                        onClick={handleClickOpen}
                        sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                        <EmailIcon sx={{mr:1}}/>
                        Email
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
                        <Typography variant="caption">To get started enter your email</Typography>
                    </Box>

                    <FormControl fullWidth  sx={{mt:1,mb:2}}>
                        <TextField
                        label="Email"
                        onChange={(e) => handleEmailChange(e.target.value)}
                        type="email"
                        />
                    </FormControl>
                    <FormControl fullWidth  sx={{mb:2}}>
                        <TextField
                        label="Pin"
                        onChange={(e) => setPinCode(e.target.value)}
                        type="password"
                        disabled={!validEmail}
                        helperText={(validEmail && generatedPin) && `Enter ${generatedPin}`}
                        />


                    </FormControl>
                    <FormControl fullWidth sx={{mb:2}}>
                        <Button 
                            variant="contained"
                            onClick={handleLogin}
                            disabled={(!emailAddress || !pinCode) || (+pinCode !== +generatedPin)}  
                        >
                            <LinkIcon sx={{mr:1}}/> Connect &amp; Participate
                        </Button>
                    </FormControl>
                </DialogContent>
            </BootstrapDialog>
        </>
    );
}

export default EmailOathView;