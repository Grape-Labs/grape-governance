import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction,
    createBurnInstruction,
    getMint,
} from "@solana/spl-token-v2";
import { Buffer } from "buffer";
import BN from "bn.js";
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
    getRealm,
    serializeInstructionToBase64,
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

import { parseMintNaturalAmountFromDecimalAsBN } from '../../../utils/grapeTools/helpers';

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
    const payerWallet = props?.payerWallet || null;
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceLookup = props?.governanceLookup;
    const [governance, setGovernance] = React.useState(null);
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
    const [daoToJoinAddress, setDaoToJoinAddress] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    

    async function joinDAO() {
        //const payerWallet = new PublicKey(payerAddress);
        const fromWallet = new PublicKey(fromAddress);
        const toJoinPk = new PublicKey(daoToJoinAddress);
               
        const transaction = new Transaction();
        
        // we need to fetch the governance details either her or a step before
        
        const programId = governance.owner;
        console.log("programId: "+JSON.stringify(programId));
        const programVersion = await getGovernanceProgramVersion(
            connection,
            programId,
          )
        
        console.log("programVersion: "+JSON.stringify(programVersion));

        const realmPk = new PublicKey(governance.pubkey);
        
        const communityMint = new PublicKey(governance.account.communityMint);

        //const testInfo = await connection.getAccountInfo(communityMint);
        //const testInfo = await connection.getParsedAccountInfo(communityMint);

        //console.log("testInfo: "+JSON.stringify(testInfo))

        const tokenInfo = await getMint(RPC_CONNECTION, communityMint);
        
        const userAtaPk = await getAssociatedTokenAddress(
            new PublicKey(communityMint),
            fromWallet, // owner
            true
          )

        // Extract the mint authority
        const mintAuthority = tokenInfo.mintAuthority ? new PublicKey(tokenInfo.mintAuthority) : null;
        const decimals = tokenInfo.decimals;

        //console.log("mintAuthority: "+mintAuthority.toBase58());
        console.log("decimals: "+decimals);
        
        const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
            500,
            decimals
        )
s
        const instructions: TransactionInstruction[] = []
        /*
        console.log("realm: "+realmPk.toBase58())
        console.log("governingTokenSource / userAtaPk: "+userAtaPk.toBase58())
        console.log("governingTokenMint: "+communityMint.toBase58())
        console.log("governingTokenOwner: "+fromWallet.toBase58())
        console.log("governingTokenSourceAuthority: "+mintAuthority?.toBase58())
        console.log("payer: "+fromWallet.toBase58())
        console.log("amount: "+atomicAmount);
        */
        await withDepositGoverningTokens(
            instructions,
            programId,
            programVersion,
            realmPk,
            userAtaPk,
            communityMint,
            fromWallet,
            fromWallet,
            fromWallet,
            atomicAmount
        )
        
        if (instructions.length != 1) {
            console.log("ERROR: Something went wrong");
        } else{

            if (instructions){

                const transaction = new Transaction();
                transaction.add(...instructions);

                console.log("TX: "+JSON.stringify(transaction));
                setTransactionInstructions(transaction);
            } else{
                console.log("No instructions!");
            }
        }
        
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

    function handleSetDaoToJoinAddressChange(text:string){
        // add validation here
        console.log("checking: "+text);
        if (isValidSolanaPublicKey(text)){
            console.log("setDaoToJoinAddress complete!");
            setDaoToJoinAddress(text);
        } else{
            setDaoToJoinAddress(null);
        }
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            setLoadingWallet(true);
            // we will need this so we can review what eligible tokens the user has

            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }

    async function fetchGovernanceSpecifications(address:string){
        console.log("fetching specs");
        const rlm = await getRealm(RPC_CONNECTION, new PublicKey(address || daoToJoinAddress));
        if (rlm){
            console.log("realm: "+JSON.stringify(rlm));
            setGovernance(rlm);
        }
    }

    
    
    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    React.useEffect(() => {
        if (daoToJoinAddress){
            console.log("here we go!");
            fetchGovernanceSpecifications(null);
        }
    }, [daoToJoinAddress]);

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
                            <strong>Join DAO</strong> Plugin
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
                        handleSetDaoToJoinAddressChange(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'center' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {(!daoToJoinAddress) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : 
                    <>{governance ?
                            <>
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="caption" color="success">
                                        {governance.account.name}<br/>
                                        Community Mint: {governance.account.communityMint.toBase58()}
                                        {governance.account.config.councilMint &&
                                            <>
                                            <br/>Council Mint: {governance.account.config.councilMint.toBase58()}
                                            </>
                                        }
                                    </Typography>
                                </Grid>
                            </>
                        :
                            <></>
                    }
                    </>
                }
            </FormControl>

            <FormControl fullWidth  sx={{mb:2}}>
                {/*
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
                }*/}
                <Box
                    sx={{textAlign:'center'}}
                >
                    <Typography variant="caption">ToDo: Use verified DAO Dropdown, ADD Eligibility Check & Custom amount up to Max avail to Join</Typography>
                </Box>
                
            </FormControl>

            {(selectedRecord && daoToJoinAddress) ?
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
                            DAO to Join <strong>{daoToJoinAddress}</strong><br/>
                            Using Mint: <strong>???</strong><br/>
                            With <strong>???</strong> Tokens<br/>
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
                            (daoToJoinAddress)
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