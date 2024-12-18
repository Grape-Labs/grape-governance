import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, AddressLookupTableAccount, AddressLookupTableInstruction, AddressLookupTableProgram } from '@solana/web3.js';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';

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

import { 
  getAllTokenOwnerRecords
} from '@solana/spl-governance';

import { 
  getRealmIndexed,
  getAllProposalsIndexed,
  getAllGovernancesIndexed,
  getAllTokenOwnerRecordsIndexed,
} from '../../api/queries';



import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import {
  fetchGovernanceLookupFile,
  getFileFromLookup
} from '../../CachedStorageHelpers';

import {  
  GGAPI_STORAGE_POOL, RPC_CONNECTION } from '../../../utils/grapeTools/constants';

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
  const daoName = props?.title;
  const ownerAddress = props?.address;
  const setVerifiedDAODestinationWalletArray = props?.setVerifiedDAODestinationWalletArray;
  const setVerifiedDAODestinationWalletObjectArray = props?.setVerifiedDAODestinationWalletObjectArray;
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
    
    console.log("Fetching DAO Members "+governanceAddress+" (voter: "+address+")");

    const plt = new Array();
    const plto = new Array();
    if (governanceAddress){
      let cached_members = new Array();
      
      let mfile = null;
      let programId = null;
      let realmPk = null;
      for (let glitem of governanceLookup){
        if (glitem.governanceAddress === governanceAddress){
          mfile = glitem.memberFilename;
          programId = new PublicKey(glitem.realm.owner);
          //console.log("glitem: "+JSON.stringify(glitem));
        }
      }
      //if (mfile){
        //cached_members = await getFileFromLookup(mfile, GGAPI_STORAGE_POOL);
        // const members = cached_members;
        //const rpc_members = await getAllTokenOwnerRecords(RPC_CONNECTION, programId,new PublicKey(governanceAddress));

        const indexedTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(governanceAddress, programId.toBase58())
        
        const members = JSON.parse(JSON.stringify(indexedTokenOwnerRecords));
        
        //if (cached_members){
        if (members){
          //console.log("cached_members: "+JSON.stringify(cached_members))

          const simpleArray = members
            .filter((item: any) => 
                Number("0x"+item.account.governingTokenDepositAmount) > 0)  
            .map((item: any, key: number) => {
              return item.account.governingTokenOwner;
            });

          // use this object array to show their current holdings
          const objectArray = members
            .filter((item: any) => 
                Number("0x"+item.account.governingTokenDepositAmount) > 0)  
            .map((item: any, key: number) => {
              return {
                governingTokenOwner: item.account.governingTokenOwner,
                governingTokenDepositAmount: item.account.governingTokenDepositAmount, 
              }
                ;
            });
          

          plt.push({
            pubkey: governanceAddress,
            size: simpleArray.length,
            info: simpleArray
          });
          plto.push({
            pubkey: governanceAddress,
            size: objectArray.length,
            info: objectArray
          });
          
        }
      }
    //}

    
    if (setVerifiedDAODestinationWalletArray){
      setVerifiedDAODestinationWalletArray(plt);
    }

    if (setVerifiedDAODestinationWalletObjectArray){
      setVerifiedDAODestinationWalletObjectArray(plto);
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
            <Tooltip title='Click for Grape Verification via DAO Members'>
                <Button 
                  size="small"
                  onClick={handleVerifyAllAddressBooks}
                  color='warning'
                  sx={{color:'white',textTransform:'none',borderRadius:'17px',ml:1}}>
                  {loading ?
                    <CircularProgress color="inherit" sx={{p:'10px'}} />
                  :
                    <>
                      <CheckCircleIcon sx={{mr:1, fontSize:'12px'}}/> {daoName} DAO
                    </>
                  }
                </Button>
            </Tooltip>
           
        </>
    )
}