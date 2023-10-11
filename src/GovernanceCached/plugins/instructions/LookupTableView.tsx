import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, AddressLookupTableAccount, AddressLookupTableInstruction, AddressLookupTableProgram, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction,
    createBurnInstruction
} from "@solana/spl-token-v2";
import * as anchor from '@project-serum/anchor';
//import { getMasterEdition, getMetadata } from '../utils/auctionHouse/helpers/accounts';
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
//import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { useWallet } from '@solana/wallet-adapter-react';

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import { styled } from '@mui/material/styles';

import {
  Dialog,
  Button,
  ButtonGroup,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  TextareaAutosize,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  MenuItem,
  InputLabel,
  Select,
  IconButton,
  Avatar,
  Grid,
  Paper,
  Typography,
  Box,
  Alert,
  Checkbox,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';

import Confetti from 'react-dom-confetti';
import SolIcon from '../../../components/static/SolIcon';
import SolCurrencyIcon from '../../../components/static/SolCurrencyIcon';

import ExplorerView from '../../../utils/grapeTools/Explorer';

import { SelectChangeEvent } from '@mui/material/Select';
import { MakeLinkableAddress, ValidateAddress } from '../../../utils/grapeTools/WalletAddress'; // global key handling
import { useSnackbar } from 'notistack';

//import { withSend } from "@cardinal/token-manager";
import { findDisplayName } from '../../../utils/name-service';

import { LookupTableDialogView } from "./LookupTableDialogView";

import MenuBookIcon from '@mui/icons-material/MenuBook';
import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';
import { number } from 'prop-types';

const confettiConfig = {
    angle: 90,
    spread: 360,
    startVelocity: 40,
    elementCount: 200,
    dragFriction: 0.12,
    duration: 4000,
    stagger: 3,
    width: "10px",
    height: "10px",
    perspective: "285px",
    colors: ["#f00", "#0f0", "#00f"]
};

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
    width: '100%', // Make it full width
    backgroundColor: '#333', // Change the background color to dark
    color: '#fff', // Change the text color to white or another suitable color
    border: 'none', // Remove the border (optional)
    padding: theme.spacing(1), // Add padding (optional)
}));

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export default function LookupTableView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [entryAddress, setEntryAddress] = React.useState(null);
    const [entryAddresses, setEntryAddresses] = React.useState(null);
    const [walletLookupTables, setWalletLookupTables] = React.useState(null);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    function clearLookupTable() {
        setEntryAddress(null);
        setEntryAddresses(null);
        setTransactionInstructions(null);
    }

    async function createLookupTable() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
               
        const transaction = new Transaction();
        
        const [lookupTableInst, lookupTableAddress] =
            AddressLookupTableProgram.createLookupTable({
                authority: fromWallet,
                payer: fromWallet,
                recentSlot: await RPC_CONNECTION.getSlot(),
            });

        transaction.add(lookupTableInst);

        const addAddressesInstruction = AddressLookupTableProgram.extendLookupTable({
            payer: fromWallet,
            authority: fromWallet,
            lookupTable: lookupTableAddress,
            addresses: entryAddresses,
        });

        transaction.add(addAddressesInstruction);

        setTransactionInstructions(transaction);
        
        return null;
    }

    const getAllLookupTables = async(address: string) => {
        
        const lookupTableProgramId = new PublicKey('AddressLookupTab1e1111111111111111111111111');
        const addressPk = new PublicKey(address);

        console.log("Fetching lookup tables for "+address);

        //let bytes = vec![1];
        //bytes.extend_from_slice(pubkey.as_ref());
        //const bytes = [1].concat(Array.from(addressPk.toBytes())); //[1].concat(addressPk.toBytes());

        /*
        enum: 4 bytes
        deactivation_slot: 8 bytes
        last_extended_slot: 8 bytes
        last_extended_slot_start_index: 1 byte
        authority: 33 bytes (1 byte for optionality, 32 bytes for the pubkey)
        */

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
        
        //console.log("programAccounts: "+JSON.stringify(programAccounts));
        //const updatedSet = new Set();

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

        console.log("plt " +JSON.stringify(plt))
       //const serializedPlt = plt.map((obj) => JSON.parse(JSON.stringify(obj)));
        
        //console.log("serializePlt: "+JSON.stringify(serializedPlt))
        
        setWalletLookupTables(plt);

        return null;
    }

    function prepareAndReturnInstructions(){

        //await transferTokens;

        let description = "";

        description = `LookupTable: ${JSON.stringify(entryAddresses)}`;
        
        setInstructionsObject({
            "type":`Create Address Book / LookupTable`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
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

    function handleAddressChange(text:string){
        // add validation here
        if (isValidSolanaPublicKey(text)){
            setEntryAddress(text);
        }
    }

    function handleAddEntry(){
        if (entryAddress && entryAddress.length > 0){
            if (entryAddresses){
                if (!entryAddresses.includes(entryAddress)){
                    if (isValidSolanaPublicKey(entryAddress)){
                        entryAddresses.push(new PublicKey(entryAddress));
                        setEntryAddress(null);
                    }
                }
            }else{
                if (isValidSolanaPublicKey(entryAddress)){
                    setEntryAddresses(new Array(new PublicKey(entryAddress)));
                    setEntryAddress(null);
                }
            }
        }
        
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            setLoadingWallet(true);
            
            // get records here
            const records = await getAllLookupTables(wallet);
            
            //setSNSRecords(records);

            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }
    
    React.useState(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    return (
        <Box
            sx={{
                m:2,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:4
            }} 
        >
            <Box
                sx={{mb:4}}
            >
                <Typography variant="h5">Address Book Plugin</Typography>
            </Box>

            <FormControl fullWidth  sx={{mb:2}}>
                <TextField
                    fullWidth
                    label="Address"
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

                {/*(!entryAddress) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">Enter a valid address!</Typography>
                    </Grid>
                : <></>
                */}
            </FormControl>

            {(entryAddresses && entryAddresses.length > 0) ?
                <>  
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }}
                    >
                        <Typography variant="h6">Preview/Summary</Typography>
                        <Typography variant="caption">
                            Add address <strong>{entryAddresses[entryAddresses.length-1].toBase58()}</strong><br/>
                            {entryAddresses.length > 1 &&
                                <>
                                To <strong>{JSON.stringify(entryAddresses)}</strong>
                                </>
                            }
                            <Button
                                onClick={clearLookupTable}
                                color="error"
                                size="small"
                                sx={{borderRadius:'17px'}}
                            >Clear</Button>
                        </Typography>
                    </Box>
                
                </>
            :
                <></>
            }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (entryAddresses) &&
                            (entryAddresses.length > 0)
                        )
                        }
                        onClick={createLookupTable}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}>
                        Preview Instructions</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }}
                    >
                        <Typography variant="h6">Transaction Instructions</Typography>
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(transactionInstructions)}
                            readOnly
                        /><br/>
                        {/*
                        <TextField 
                            fullWidth
                            label="Instructions"
                            multiline
                            rows={4}
                            maxRows={4}
                            value={JSON.stringify(transactionInstructions)}
                            disabled
                        />*/}

                        {transactionEstimatedFee &&
                            <Grid sx={{textAlign:'right'}}>
                                <Typography variant="caption">
                                    Estimated Fee {transactionEstimatedFee}
                                </Typography>
                            </Grid>
                        }
                    </Box>

                }

                
            <Grid sx={{textAlign:'right'}}>
                <Button 
                    disabled={!(
                        (transactionInstructions && JSON.stringify(transactionInstructions).length > 0)
                    )}
                    onClick={prepareAndReturnInstructions}
                    fullWidth
                    variant="contained"
                    color="warning"
                    sx={{borderRadius:'17px'}}>
                    Add to Proposal</Button>
            </Grid>

            {(walletLookupTables && walletLookupTables.length > 0) ?
                    <>  
                        <Box
                            sx={{ m:2,
                                background: 'rgba(0, 0, 0, 0.2)',
                                borderRadius: '17px',
                                overflow: 'hidden',
                                p:4
                            }}
                        >
                            <Typography variant="h6">Current Address Books / Lookup Tables</Typography>
                            <Typography variant="caption">
                                <List sx={{ width: '100%' }}>
                                    {walletLookupTables.map((item: any, key: number) => {
                                        return (
                                            <ListItem alignItems="flex-start">
                                                <ListItemAvatar>
                                                    <Avatar alt={item.pubkey.toBase58()}><MenuBookIcon /></Avatar>
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={`Account: ${item.pubkey.toBase58()}`}
                                                    secondary={
                                                        <React.Fragment>
                                                            {item.size} Wallets 
                                                            
                                                            <LookupTableDialogView address={item.pubkey.toBase58()} members={item.info.addresses} setTransactionInstructions={setTransactionInstructions}/>
                                                        </React.Fragment>
                                                    }
                                                    />
                                            </ListItem>
                                        );
                                    })}
                                </List>
                                {/*JSON.stringify(currentDCAs)*/}
                            </Typography>
                        </Box>
                        
                    </>
                :
                    <></>
                }

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Address Book Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}