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
  const [toAddAddresses, setToAddAddresses] = React.useState(null);
  const [entryAddress, setEntryAddress] = React.useState(null);
    
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

  function clearLookupTable() {
      setEntryAddress(null);
      setToAddAddresses(null);
      setTransactionInstructions(null);
  }

  const handleAddToLookupTable = () => {
    addToLookupTable(new PublicKey(ltAddress));
  };
  const addToLookupTable = async (lookupTableAddress: PublicKey) => {
    // Step 1 - Fetch our address lookup table
    //const lookupTableAccount = await RPC_CONNECTION.getAddressLookupTable(new PublicKey(address))
    const fromWallet = new PublicKey(fromAddress);
               
      const transaction = new Transaction();
      
      const addAddressesInstruction = await AddressLookupTableProgram.extendLookupTable({
        payer: fromWallet,
        authority: fromWallet,
        lookupTable: lookupTableAddress,
        addresses: toAddAddresses,
    });

      transaction.add(addAddressesInstruction);

      setTransactionInstructions(transaction);
      setOpen(false);
  }


  const handleCloseLookupTable = () => {
    closeLookupTable(new PublicKey(ltAddress));
  };

  const closeLookupTable = async (lookupTableAddress: PublicKey) => {
    // Step 1 - Fetch our address lookup table
    //const lookupTableAccount = await RPC_CONNECTION.getAddressLookupTable(new PublicKey(address))
    const fromWallet = new PublicKey(fromAddress);
               
      const transaction = new Transaction();
      
      const deactivateAddressBookInstruction = AddressLookupTableProgram.deactivateLookupTable({
        lookupTable: lookupTableAddress,
          authority: fromWallet,
      });

      transaction.add(deactivateAddressBookInstruction);


      const closeAddressBookInstruction = AddressLookupTableProgram.closeLookupTable({
          lookupTable: lookupTableAddress,
          authority: fromWallet,
          recipient: fromWallet,
      });

      transaction.add(closeAddressBookInstruction);

      setTransactionInstructions(transaction);
      setOpen(false);
  }

  function isValidSolanaPublicKey(publicKeyString:string) {
    // Regular expression for Solana public key validation
    if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
        return false;
    }
    
    // Regular expression for Solana public key validation
    const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    // Check if the publicKey matches the Solana public key pattern
    let status = solanaPublicKeyRegex.test(publicKeyString);
    try{
        if (status){
            const pk = new PublicKey(publicKeyString);
            if (pk)
                return true;
            else
                return false;
        }
    }catch(e){
        return false;
    }
  }

  function handleAddEntry(){
    if (entryAddress && entryAddress.length > 0){

        if (toAddAddresses){
            if (!toAddAddresses.includes(entryAddress) && !ltMembers.includes(entryAddress)){
                if (isValidSolanaPublicKey(entryAddress)){
                    toAddAddresses.push(new PublicKey(entryAddress));
                    setEntryAddress(null);
                }
            }
        }else{
          if (!ltMembers.includes(entryAddress)){
            if (isValidSolanaPublicKey(entryAddress)){
                setToAddAddresses(new Array(new PublicKey(entryAddress)));
                setEntryAddress(null);
            }
          }
        }
    }  
  }
  function handleAddressChange(text:string){
    // add validation here
    if (isValidSolanaPublicKey(text)){
        setEntryAddress(text);
    }
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
  }, [ltMembers]);


    return (
        <>
            <Tooltip title='View Speed Dial Details'>
                <IconButton 
                  size="small"
                  onClick={handleClickOpen}
                  color='inherit'
                  sx={{color:'white',textTransform:'none',ml:1}}>
                  <FindInPageIcon sx={{fontSize:'18px'}} />
                </IconButton>
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
                    Speed Dial<br/>
                    <Typography variant="caption">
                      <ExplorerView address={ltAddress} type='address' shorten={8} title={`${ltAddress.slice(0, 3)}...${ltAddress.slice(-3)} with ${ltMembers.length} entries`} hideTitle={false} style='text' color='white' fontSize='12px' /> 
                    </Typography>
                </BootstrapDialogTitle>
                <DialogContent>
                    
                    {ltMembers &&
                      <>
                        <Box sx={{ alignItems: 'center', textAlign: 'left', p:1}}>
                            <FormControl fullWidth  sx={{mb:2}}>
                              <TextField
                                  fullWidth
                                  label="Add Address to Speed Dial"
                                  id="fullWidth"
                                  type="text"
                                  value={entryAddress ? entryAddress : ''}
                                  onChange={(e) => {
                                      handleAddressChange(e.target.value);
                                  }}
                                  InputProps={{
                                      style: { textAlign: 'center' },
                                      endAdornment: (
                                      <InputAdornment position="end">
                                          <Button variant="contained" color="primary"
                                              onClick={handleAddEntry}
                                              disabled={!entryAddress || !isValidSolanaPublicKey(entryAddress)}
                                          >
                                          Add
                                          </Button>
                                      </InputAdornment>
                                      ),
                                  }}
                                  sx={{ borderRadius: '17px' }}
                                  />
                              </FormControl>  
                            
                            {(toAddAddresses && toAddAddresses.length > 0) &&
                              <>
                              <List>
                                {toAddAddresses.map((member: any, key: number) => (
                                  <ListItem key={key}>
                                    <ListItemText primary={(
                                      <ExplorerView showSolanaProfile={true} grapeArtProfile={true} address={member.toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='18px' />
                                    )} />
                                  </ListItem>
                                ))}
                                <Button
                                  onClick={clearLookupTable}
                                  color="error"
                                  size="small"
                                  sx={{borderRadius:'17px'}}
                                >Clear</Button>
                              </List>
                              <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                <Tooltip title="Add addresses to the existing Speed Dial">
                                  <Button
                                      variant="contained"
                                      color='info'
                                      onClick={handleAddToLookupTable}
                                      sx={{}}
                                  >
                                      Add To Speed Dial
                                  </Button>
                                </Tooltip>
                            </Box>
                              </>
                            }

                            <Divider light />

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
    
                                <Tooltip title="Close account and return the rent to the treasury wallet">
                                  <Button
                                      variant="contained"
                                      color='error'
                                      onClick={handleCloseLookupTable}
                                      sx={{}}
                                  >
                                      Delete
                                  </Button>
                                </Tooltip>
                            </Box>
                        </Box>
                      </>
                    }
                                            
                </DialogContent> 
            </BootstrapDialog>
        </>
    )
}