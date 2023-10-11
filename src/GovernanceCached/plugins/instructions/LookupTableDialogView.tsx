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
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';
import ExplorerView from '../../../utils/grapeTools/Explorer';
import moment from 'moment';

import FindInPageIcon from '@mui/icons-material/FindInPage';
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

export function LookupTableDialogView(props: any){
  const fromAddress = props?.fromAddress;
  const ltAddress = props?.address;
  const [ltMembers, setLTMembers] = React.useState(props?.members);
  const [toAddMembers, setToAddMembers] = React.useState(null);
  const setTransactionInstructions = props?.setTransactionInstructions;
  const [open, setOpen] = React.useState(false);
    
  const [expanded, setExpanded] = React.useState<string | false>(false);
  const handleChange =
  (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
      setExpanded(isExpanded ? panel : false);
  };

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const handleCloseDialog = () => {
        setOpen(false);
    }

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };

  const getLookupTableDetails = async() => {
    if (ltAddress){
      // do something = await something
      // set()
    }

  }

  const handleCloseLookupTable = () => {
    closeLookupTable(ltAddress);
};

  const closeLookupTable = async (lookupTableAddress:string) => {
    // Step 1 - Fetch our address lookup table
    //const lookupTableAccount = await RPC_CONNECTION.getAddressLookupTable(new PublicKey(address))
    const fromWallet = new PublicKey(fromAddress);
               
      const transaction = new Transaction();
      
      const closeAddressBookInstruction = await AddressLookupTableProgram.closeLookupTable({
          lookupTable: new PublicKey(lookupTableAddress),
          authority: fromWallet,
          recipient: fromWallet,
      });

      transaction.add(closeAddressBookInstruction);

      setTransactionInstructions(transaction);
      setOpen(false);
  }

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
    if (members.length > 0)
      setLTMembers(members)
  }


  React.useEffect(() => {
    if (!ltMembers && ltAddress){
        findAddressesInTable(ltAddress);
    }
    //console.log('members: '+JSON.stringify(ltMembers));

  }, [ltMembers]);


    return (
        <>
            <Tooltip title='View Address Book Details'>
                <Button 
                  size="small"
                  onClick={handleClickOpen}
                  color='inherit'
                  sx={{color:'white',textTransform:'none',borderRadius:'17px',ml:1}}>
                  <FindInPageIcon sx={{fontSize:'18px'}} />
                </Button>
            </Tooltip>
            
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
                    Address Book {ltMembers.length} Members
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    {ltMembers &&
                      <>
                        <Box sx={{ alignItems: 'center', textAlign: 'left', p:1}}>
                            <List>
                              {ltMembers.map((member: any, key: number) => (
                                <ListItem key={key}>
                                  <ListItemText primary={(
                                    <ExplorerView showSolanaProfile={true} grapeArtProfile={true} address={member} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='18px' />
                                  )} />
                                </ListItem>
                              ))}
                            </List>
                            
                            <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                <Button
                                    color='primary'
                                    sx={{borderRadius:'17px'}}
                                    disabled
                                >
                                    Add Entry
                                </Button>
                                <Button
                                    color='error'
                                    onClick={handleCloseLookupTable}
                                    sx={{borderRadius:'17px'}}
                                >
                                    Delete
                                </Button>
                            </Box>
                        </Box>
                      </>
                    }
                                            
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}