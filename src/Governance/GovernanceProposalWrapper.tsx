import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback, Suspense } from 'react';
import { styled, useTheme } from '@mui/material/styles';

import { SnackbarProvider } from 'notistack';

import {
  Typography,
  Button,
  Grid,
  Box,
  Table,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  Chip,
  Backdrop,
  ButtonGroup,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Paper,
  
} from '@mui/material/';

import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineOppositeContent,
    TimelineDot,
} from '@mui/lab'

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';
 
import { GovernanceProposalV2View } from "./GovernanceProposalV2";

import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

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

const GOVERNANCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing w/errors!',
}

const renderLoader = () => <p>Loading</p>;

export function GovernanceProposalWrapper(props: any){
    const beta = props?.beta ? props.beta : false;
    const cachedGovernance = props.cachedGovernance;
    const governanceLookup = props.governanceLookup;
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const governanceAddress = props.governanceAddress;
    const governanceToken = props.governanceToken;
    const thisitem = props.item;
    //const [thisitem, setThisItem] = React.useState(props.item);
    const realm = props.realm;
    
    return (
        <>
            <Box
                sx={{
                    mt:6,
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    overflow: 'hidden',
                    p:4
                }} 
            >       
                <GovernanceProposalV2View showGovernanceTitle={true} governanceLookup={governanceLookup} governanceAddress={governanceAddress} cachedGovernance={cachedGovernance} item={thisitem} realm={realm} tokenMap={tokenMap} memberMap={memberMap} governanceToken={governanceToken} />
              
            
            </Box>                         
            
        </>
    )
}