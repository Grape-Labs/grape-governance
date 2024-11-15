import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
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

import {
    getHashedName,
    getNameAccountKey,
    NameRegistryState,
    performReverseLookup,
    getTwitterRegistry,
    transferNameOwnership,
    ROOT_DOMAIN_ACCOUNT,
} from '@bonfida/spl-name-service';

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
  Checkbox
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

export default function SNSView(props: any) {
    const [snsRecords, setSNSRecords] = React.useState(props?.snsrecords || null);
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.pubkey?.toBase58() || governanceWallet?.vault?.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [tokenMaxAmountRaw, setTokenMaxAmountRaw] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const [selectedRecord, setSelectedRecord] = React.useState(null);
    const [destinationAddress, setDestinationAddress] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    

    async function transferSNSRecord() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        const toWallet = new PublicKey(destinationAddress);
               
        const transaction = new Transaction();
        
        const createTransferInstruction: TransactionInstruction = await transferNameOwnership(
            connection,
            selectedRecord.substring(0,selectedRecord.indexOf('.sol')),
            toWallet,
            //fromWallet,
            undefined,
            ROOT_DOMAIN_ACCOUNT
        )
        
        transaction.add(createTransferInstruction)
        
        setTransactionInstructions(transaction);
        
        return null;
    }

    const getAllDomains = async(address: string) => {
        const domain = await findDisplayName(RPC_CONNECTION, address);
        if (domain) {
            return domain;
        }
        return null;
    }

    function SNSSelect() {

        const handleSNSSelected = (event: SelectChangeEvent) => {
            const selSNS = event.target.value as string;
            setSelectedRecord(selSNS);
            /*
            const selectedAta = event.target.value as string;
            setTokenAta(selectedAta);
            //const selectedTokenMint = event.target.value as string;
            
            // with token mint traverse to get the mint info if > 0 amount
            let decimals = 0;
            let meta = null;
            {governanceWallet && governanceWallet.tokens.value
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((item: any, key: number) => {
                    if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                        item.account.data.parsed.info.tokenAmount.amount > 0) {
                            if (item.pubkey === selectedAta){
                                setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                setTokenMaxAmountRaw(item.account.data.parsed.info.tokenAmount.amount);
                                //setTokenAta(item.pubkey);
                                setTokenMint(item.account.data.parsed.info.mint);
                                setTokenDecimals(item.account.data.parsed.info.tokenAmount.decimals);
                            }
                    } else {
                        if (item.pubkey === selectedAta){
                            setTokenMaxAmount(0);
                            setTokenMaxAmountRaw(0);
                            setTokenMint(item.account.data.parsed.info.mint);
                            setTokenDecimals(item.account.data.parsed.info.tokenAmount.decimals);
                        }
                    }
            })}
            */
            //collectionMetadata = await getMetadata(new PublicKey(holdingsSelected[item * maxLen + holding].metadata_decoded.collection.key));
        };

        return (
          <>
            <Box sx={{ minWidth: 120, ml:1 }}>
              <FormControl fullWidth sx={{mb:2}}>
                <InputLabel id="governance-snsrecord-select-label">Record</InputLabel>
                <Select
                  labelId="governance-snsrecord-select-label"
                  id="governance-snsrecord-select"
                  value={selectedRecord}
                  label="Record"
                  onChange={handleSNSSelected}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200, // Adjust this value as needed
                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                      },
                    },
                  }}
                >
                    {snsRecords && snsRecords
                            .map((item: any, key: number) => {
                                
                                
                                    //console.log("mint: "+item.account.data.parsed.info.mint)

                                    return (
                                        <MenuItem key={key} value={item}>
                                            {/*console.log("wallet: "+JSON.stringify(item))*/}
                                            
                                            <Grid container
                                                alignItems="center"
                                            >
                                                <Grid item xs={12}>
                                                    {item}
                                                </Grid>
                                            </Grid>
                                        </MenuItem>
                                    );
                            
                            })}
                    
                </Select>
              </FormControl>
            </Box>
          </>
        );
      }

    function prepareAndReturnInstructions(){

        //await transferTokens;


        let description = "";

        description = `Closing ${tokenAmount.toLocaleString()} ${tokenMint}`;
        
        setInstructionsObject({
            "type":`SNS Transfer`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
    }

    function isValidSolanaPublicKey(publicKeyString:string) {
        // Regular expression for Solana public key validation
        //const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        //return solanaPublicKeyRegex.test(publicKey);
        if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
            return false;
          }
        
          // Regular expression for Solana public key validation
          const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        
          // Check if the publicKey matches the Solana public key pattern
          return solanaPublicKeyRegex.test(publicKeyString);
    }

    function handleDestinationAddressChange(text:string){
        // add validation here
        if (isValidSolanaPublicKey(text)){
            setDestinationAddress(text);
        }
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            setLoadingWallet(true);
            
            // get records here
            const records = await getAllDomains(wallet);
            
            setSNSRecords(records);

            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }
    
    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault?.pubkey || governanceWallet?.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    return (
        <Box
            sx={{
                m:1,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:1
            }} 
        >
            <Box
                sx={{mb:4}}
            >
                <Typography variant="h5">
                    <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                        <Grid item>
                            <Avatar variant="rounded" alt={'Bonfida'} src={'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTYiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA1NiA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTI4IDRMMjguMDE1NCAxNy4xMDAzIiBzdHJva2U9IndoaXRlIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik01Mi40NjAzIDQ2LjAxMDNMNDEuMzIzMSAzOS40NTUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTQuMDk4OTQgNDYuMDEwM0wxNS4yMzYxIDM5LjQ1NSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNMjguMDA4NyAzMi4wMTA5TDE1IDI0LjQ4OThMMjguMDA4NyAxNi45NzE5TDQxIDI0LjUyMDZMMjguMDA4NyAzMi4wMTA5WiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTI4LjAyMDcgNDYuOTY5TDE1LjAxNjcgMzkuNTA1N0wxNSAyNC40ODk4TDI4LjAyMDcgMzIuMDEwOVY0Ni45NjlaIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTI4IDQ2Ljk2OUw0MS4wMDMzIDM5LjUzOTFWMjQuNTIwNkwyOCAzMi4wMTA5VjQ2Ljk2OVoiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNNTIgNDYuMDEwMlYxOC4wMzIxTDI3Ljk5OTcgNC4wNDIzNkw0IDE4LjAzMjFWNDYuMDEwMkwyNy45OTk3IDU5Ljk5OTlMNTIgNDYuMDEwMloiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLW1pdGVybGltaXQ9IjEwIi8+CjxwYXRoIGQ9Ik0yOC4wMDAxIDMyLjA0NTZMMjcuMjQzOCAzMy4zNDFMMjcuOTk4OCAzMy43ODE4TDI4Ljc1NDUgMzMuMzQyMUwyOC4wMDAxIDMyLjA0NTZaTTMuMjgyODkgMTkuMzUxOEwyNy4yNDM4IDMzLjM0MUwyOC43NTY0IDMwLjc1MDJMNC43OTU0OCAxNi43NjExTDMuMjgyODkgMTkuMzUxOFpNMjguNzU0NSAzMy4zNDIxTDUyLjc5MzYgMTkuMzUyOUw1MS4yODQ3IDE2Ljc2TDI3LjI0NTYgMzAuNzQ5MkwyOC43NTQ1IDMzLjM0MjFaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjggMzIuMDQ1N1Y1OS45OTk5IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjMiIHN0cm9rZS1taXRlcmxpbWl0PSIxMCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+Cjwvc3ZnPgo='} />
                        </Grid>
                        <Grid item xs sx={{ml:1}}>
                            <strong>SNS</strong> Transfer Plugin
                        </Grid>
                    </Grid>
                </Typography>
            </Box>

            {/*
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth 
                    label="From Governance Wallet" 
                    id="fullWidth"
                    value={fromAddress}
                    type="text"
                    onChange={(e) => {
                    //    setFromAddress(e.target.value);
                    }}
                    disabled
                    sx={{borderRadius:'17px'}} 
                />
            </FormControl>
            */}
            
            {snsRecords &&
                <SNSSelect />
            }

            <FormControl fullWidth  sx={{mb:2}}>
                
                <TextField 
                    fullWidth 
                    label="Destination Address" 
                    id="fullWidth"
                    type="text"
                    onChange={(e) => {
                        handleDestinationAddressChange(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'center' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {(!destinationAddress) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid recipient address!</Typography>
                    </Grid>
                : <></>
                }
            </FormControl>

            {(selectedRecord && destinationAddress) ?
                <>  
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
                        }}
                    >
                        <Typography variant="h6">Preview/Summary</Typography>
                        <Typography variant="caption">
                            Record <strong>{selectedRecord}</strong><br/>
                            Transfer To <strong>{destinationAddress}</strong>
                        </Typography>
                    </Box>
                
                </>
            :
                <Box
                    sx={{textAlign:'center'}}
                >
                    <Typography variant="caption">Select a record & set a destination address</Typography>
                </Box>
            }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (selectedRecord) &&
                            (destinationAddress)
                        )
                        }
                        onClick={transferSNSRecord}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}>
                        Preview Instructions</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
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

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance SNS Record Transfer Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}