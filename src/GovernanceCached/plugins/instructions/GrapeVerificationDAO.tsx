import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, AddressLookupTableAccount, AddressLookupTableInstruction, AddressLookupTableProgram } from '@solana/web3.js';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

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
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  InputAdornment,
  FormControl,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import {
  fetchGovernanceLookupFile,
  getFileFromLookup
} from '../../CachedStorageHelpers';

import {  
  GGAPI_STORAGE_POOL } from '../../../utils/grapeTools/constants';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VerifiedIcon from '@mui/icons-material/Verified';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';

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

export function GrapeVerificationDAO(props: any){
  const ownerAddress = props?.address;
  const setVerifiedDAODestinationWalletArray = props?.setVerifiedDAODestinationWalletArray;
  const governanceLookup = props?.governanceLookup;
  const governanceAddress = props?.governanceAddress;
  
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | false>(false);
  const handleChange =
  (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
  };

  const getAndVerifyFromDAOMembers = async(address: string) => {
    setLoading(true);
    
    console.log("Fetching DAO Cached Members "+address);

    const plt = new Array();
    if (governanceAddress){
      let cached_members = new Array();
      
      let mfile = null;
      for (let glitem of governanceLookup){
        if (glitem.governanceAddress === governanceAddress)
          mfile = glitem.memberFilename;
      }
      if (mfile){

        cached_members = await getFileFromLookup(mfile, GGAPI_STORAGE_POOL);

        if (cached_members){
          
          //console.log("cached_members: "+JSON.stringify(cached_members))

          const simpleArray = cached_members
            .filter((item: any) => 
                Number("0x"+item.account.governingTokenDepositAmount) > 0)  
            .map((item: any, key: number) => {
              return item.account.governingTokenOwner;
            });
          

          plt.push({
            pubkey: governanceAddress, //item.account.governingTokenOwner,
            size: simpleArray.length,
            info: simpleArray
          });
          
        }
      }
    }

    
    if (setVerifiedDAODestinationWalletArray){
      //console.log("plt: "+JSON.stringify(plt))
      setVerifiedDAODestinationWalletArray(plt);
    }
    
    setLoading(false);
    return null;
  }

  const handleVerifyAllAddressBooks = () => {
    if (!loading && ownerAddress){
      getAndVerifyFromDAOMembers(ownerAddress);
    }
};

    return (
        <>
            <Tooltip title='Grape Verification: via DAO Members'>
                <Button 
                  size="small"
                  onClick={handleVerifyAllAddressBooks}
                  color='warning'
                  sx={{color:'white',textTransform:'none',borderRadius:'17px',ml:1}}>
                  {loading ?
                    <CircularProgress color="inherit" sx={{p:'10px'}} />
                  :
                    <>
                      <CheckCircleIcon sx={{mr:1, fontSize:'12px'}}/> DAO
                    </>
                  }
                </Button>
            </Tooltip>
           
        </>
    )
}