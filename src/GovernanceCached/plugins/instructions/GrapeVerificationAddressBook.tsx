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
import ExplorerView from '../../../utils/grapeTools/Explorer';
import moment from 'moment';

import VerifiedIcon from '@mui/icons-material/Verified';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DescriptionIcon from '@mui/icons-material/Description';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CodeIcon from '@mui/icons-material/Code';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CheckIcon from '@mui/icons-material/Check';
import GitHubIcon from '@mui/icons-material/GitHub';
import DownloadIcon from '@mui/icons-material/Download';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';
import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';

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

export function GrapeVerificationAddressBook(props: any){
  const ownerAddress = props?.address;
  const [addressBooks, setAddressBooks] = React.useState(null);
  const setVerifiedDestinationWalletArray = props?.setVerifiedDestinationWalletArray;
  
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [expanded, setExpanded] = React.useState<string | false>(false);
  const handleChange =
  (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
  };

  const findAddressesInTable = async(address:string) => {
    // Step 1 - Fetch our address lookup table
    const lookupTableAccount = await RPC_CONNECTION.getAddressLookupTable(new PublicKey(address))
    console.log(`Successfully found lookup table: `, lookupTableAccount.value?.key.toString());

    // Step 2 - Make sure our search returns a valid table
    if (!lookupTableAccount.value) return;

    // Step 3 - Log each table address to console
    const members = new Array();
    for (let i = 0; i < lookupTableAccount.value.state.addresses.length; i++) {
        const address = lookupTableAccount.value.state.addresses[i];
        console.log(`   Address ${(i + 1)}: ${address.toBase58()}`);
        members.push(address);
    }
    //if (members.length > 0)
      //setLTMembers(members)
  }

  const getAndVerifyFromAllLookupTables = async(address: string) => {
    setLoading(true);
    const lookupTableProgramId = new PublicKey('AddressLookupTab1e1111111111111111111111111');
    const addressPk = new PublicKey(address);

    console.log("Fetching Address Books / LookupTables for "+address);

    const size = 58;
    const filters = [
        /*
        {
            dataSize: size,
        },*/
        {
          memcmp: {
            offset: 22,
            bytes: addressPk.toBase58()
          },
        },
      ];
    
    const programAccounts = await RPC_CONNECTION.getParsedProgramAccounts( //.getProgramAccounts(
        lookupTableProgramId, {
            filters
    });
    
    const plt = new Array();
    for (var item of programAccounts){
        if (item.account.data.parsed.info.authority === addressPk.toBase58()){
            //console.log("programItem Found "+JSON.stringify(item));
            // we can explore pushing the object later on
            plt.push({
                pubkey: item.pubkey,
                size: item.account.data.parsed.info?.addresses ? item.account.data.parsed.info.addresses.length : 0,
                info: item.account.data.parsed.info
            })
        }
    }

    setAddressBooks(plt);
    if (setVerifiedDestinationWalletArray){
      setVerifiedDestinationWalletArray(plt);
    }

    setLoading(false);
    return null;
  }

  const handleVerifyAllAddressBooks = () => {
    if (!addressBooks && ownerAddress){
      getAndVerifyFromAllLookupTables(ownerAddress);
    }
};

    return (
        <>
            <Tooltip title='Grape Verification: using your on-chain Address Books'>
                <Button 
                  size="small"
                  onClick={handleVerifyAllAddressBooks}
                  color='warning'
                  sx={{color:'white',textTransform:'none',borderRadius:'17px',ml:1}}>
                  {loading ?
                    <CircularProgress color="inherit" sx={{p:'10px'}} />
                  :
                    <>
                      <VerifiedIcon sx={{mr:1, fontSize:'12px'}}/> Verify
                    </>
                  }
                </Button>
            </Tooltip>
           
        </>
    )
}