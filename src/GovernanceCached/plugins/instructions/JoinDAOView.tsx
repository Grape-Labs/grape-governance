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

import { styled } from '@mui/material/styles';

import { 
    getGovernanceProgramVersion,
    withDepositGoverningTokens,
  } from '@solana/spl-governance';

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

import JoinLeftIcon from '@mui/icons-material/JoinLeft';
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

export default function JoinDAOView(props: any) {
    const [snsRecords, setSNSRecords] = React.useState(props?.snsrecords || null);
    const payerWallet = props?.payerWallet || null;
    const pluginType = props?.pluginType || 4; // 1 Token 2 SOL
    const setInstructionsObject = props?.setInstructionsObject;
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
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
    
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    

    async function joinDAO() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        const toWallet = new PublicKey(destinationAddress);
               
        const transaction = new Transaction();
        
        /*
        const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
            form.amount,
            form.mintInfo.decimals
        )
            
        const programVersion = await fetchProgramVersion(
            connection.current,
            form.realm.programId
        )*/

        const instructions: TransactionInstruction[] = []
        
        // we need to fetch the governance details either her or a step before
        
        /*
        const txi = await withDepositGoverningTokens(
            instructions,
            form.realm.programId,
            programVersion,
            form.realm.realmId,
            form.governedAccount.pubkey,
            selectedRealm?.account.communityMint,
            form.governedAccount.extensions.token.account.owner,
            form.governedAccount.extensions.token.account.owner,
            fromWallet,
            atomicAmount // amount to participate with
          )
        
        transaction.add(txi)
        */
        setTransactionInstructions(transaction);
        
        return null;
    }

    
    function prepareAndReturnInstructions(){

        //await transferTokens;


        let description = "";

        description = `Closing ${tokenAmount.toLocaleString()} ${tokenMint}`;
        
        setInstructionsObject({
            "type":`Join DAO`,
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
                <Typography variant="h5">
                    <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                        <Grid item>
                            <JoinLeftIcon sx={{ fontSize: 50, display: 'flex', alignItems: 'center' }} />
                        </Grid>
                        <Grid item xs sx={{ml:1, display: 'flex', alignItems: 'center'}}>
                            <strong>Join DAO</strong> Transfer Plugin
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
            
            <FormControl fullWidth  sx={{mb:2}}>
                
                <TextField 
                    fullWidth 
                    label="DAO Address" 
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
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : <></>
                }
            </FormControl>

            {(selectedRecord && destinationAddress) ?
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
                            DAO to Join <strong>{destinationAddress}</strong><br/>
                            Using Mint: <strong>{destinationAddress}</strong><br/>
                            With <strong>{destinationAddress}</strong> Tokens<br/>
                        </Typography>
                    </Box>
                
                </>
            :
                <Box
                    sx={{textAlign:'center'}}
                >
                    <Typography variant="caption">Enter a valid DAO address</Typography>
                </Box>
            }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (destinationAddress)
                        )
                        }
                        onClick={joinDAO}
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

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Join DAO Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}