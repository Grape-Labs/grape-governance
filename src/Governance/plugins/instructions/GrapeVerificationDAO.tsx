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
  getAllTokenOwnerRecords,
  getRealm,
  getTokenOwnerRecordsByOwner,
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
  const destinationWalletArray = props?.destinationWalletArray;
  const { enqueueSnackbar } = useSnackbar();
  
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | false>(false);
  const handleChange =
  (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
  };

  const getAndVerifyFromDAOMembers = async() => {
    setLoading(true);
    try {
      if (!governanceAddress) throw new Error('No DAO realm address was provided');

      const realmPk = new PublicKey(governanceAddress);
      const realm = await getRealm(RPC_CONNECTION, realmPk);
      const programId = realm.owner;
      const destinations = Array.from(new Set<string>(
        (Array.isArray(destinationWalletArray) ? destinationWalletArray : [])
          .map((item: any) => String(item?.address || item || '').trim())
          .filter(Boolean)
      ));

      let records: any[] = [];
      if (destinations.length > 0 && destinations.length <= 20) {
        const concurrency = 5;
        for (let index = 0; index < destinations.length; index += concurrency) {
          const batch = destinations.slice(index, index + concurrency);
          const results = await Promise.all(
            batch.map((destination) =>
              getTokenOwnerRecordsByOwner(RPC_CONNECTION, programId, new PublicKey(destination)).catch(() => [])
            )
          );
          records.push(...results.flat());
        }
        records = records.filter((record: any) => record?.account?.realm?.equals?.(realmPk));
      } else {
        records = await getAllTokenOwnerRecords(RPC_CONNECTION, programId, realmPk);
      }

      const verifiedByOwner = new Map<string, bigint>();
      for (const record of records) {
        const member = record?.account?.governingTokenOwner?.toBase58?.();
        if (!member) continue;
        let deposit = 0n;
        try {
          deposit = BigInt(record?.account?.governingTokenDepositAmount?.toString?.() || '0');
        } catch {}
        if (deposit <= 0n) continue;
        verifiedByOwner.set(member, (verifiedByOwner.get(member) || 0n) + deposit);
      }

      const simpleArray = Array.from(verifiedByOwner.keys());
      const objectArray = Array.from(verifiedByOwner.entries()).map(([member, deposit]) => ({
        governingTokenOwner: member,
        governingTokenDepositAmount: deposit.toString(),
      }));

      setVerifiedDAODestinationWalletArray?.([
        { pubkey: governanceAddress, size: simpleArray.length, info: simpleArray },
      ]);
      setVerifiedDAODestinationWalletObjectArray?.([
        { pubkey: governanceAddress, size: objectArray.length, info: objectArray },
      ]);
      enqueueSnackbar(
        `${simpleArray.length} destination${simpleArray.length === 1 ? '' : 's'} verified as active DAO members`,
        { variant: simpleArray.length > 0 ? 'success' : 'warning' }
      );
    } catch (error: any) {
      console.error('DAO member verification failed', error);
      setVerifiedDAODestinationWalletArray?.([]);
      setVerifiedDAODestinationWalletObjectArray?.([]);
      enqueueSnackbar(error?.message || 'DAO member verification failed', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const handleVerifyAllAddressBooks = () => {
    if (!loading && governanceAddress){
      void getAndVerifyFromDAOMembers();
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
