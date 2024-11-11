import { 
    getRealms, 
    getGovernance,
    getVoteRecordsByVoter, 
    getTokenOwnerRecordAddress,
    getTokenOwnerRecordForRealm, 
    getTokenOwnerRecordsByOwner, 
    getGovernanceAccounts, 
    pubkeyFilter, 
    TokenOwnerRecord, 
    withCreateProposal,
    VoteType, 
    getGovernanceProgramVersion,
    serializeInstructionToBase64,
    createInstructionData,
    withInsertTransaction,
    withRemoveTransaction,
    withExecuteTransaction,
    InstructionData,
    AccountMetaData,
    getRealm,
    withSignOffProposal,
    withAddSignatory,
    getSignatoryRecordAddress,
    getAllProposals,
    MultiChoiceType,
} from '@solana/spl-governance';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import BN from 'bn.js';
import base58 from 'bs58';
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token-v2";
import { Signer, Connection, TransactionMessage, PublicKey, Transaction, VersionedTransaction, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError, TransactionOrVersionedTransaction } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { InstructionMapping } from "../utils/grapeTools/InstructionMapping";

import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Link, useParams, useSearchParams } from "react-router-dom";

import { decodeMetadata } from '../utils/grapeTools/utils';
import grapeTheme from  '../utils/config/theme';

import {
  Typography,
  Button,
  Grid,
  Box,
  Table,
  Tooltip,
  LinearProgress,
  Chip,
  IconButton,
  ButtonGroup,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  TextField,
  TextareaAutosize
} from '@mui/material/';

import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineOppositeContent,
    TimelineDot,
} from '@mui/lab'

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';
 
import { createAndSendV0Tx } from './Proposals/proposalHelperInstructions'
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import DeleteIcon from '@mui/icons-material/Delete';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import BallotIcon from '@mui/icons-material/Ballot';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CodeIcon from '@mui/icons-material/Code';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import GitHubIcon from '@mui/icons-material/GitHub';
import DownloadIcon from '@mui/icons-material/Download';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
import NavItem from '../components/nav-section/vertical/nav-item';

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
    width: '100%', // Make it full width
    backgroundColor: '#333', // Change the background color to dark
    color: '#fff', // Change the text color to white or another suitable color
    border: 'none', // Remove the border (optional)
    padding: theme.spacing(1), // Add padding (optional)
}));

function trimAddress(addr: string) {
    if (!addr) return addr;
    const start = addr.substring(0, 8);
    const end = addr.substring(addr.length - 4);
    return `${start}...${end}`;
}

function getExplorerUrl(
    endpoint: string,
    viewTypeOrItemAddress: 'inspector' | PublicKey | string,
    itemType = 'address'
  ) {
    const getClusterUrlParam = () => {
      let cluster = ''
      if (endpoint === 'localnet') {
        cluster = `custom&customUrl=${encodeURIComponent(
          'http://127.0.0.1:8899'
        )}`
      } else if (endpoint === 'https://api.devnet.solana.com') {
        // if the default free RPC for devnet is used
        cluster = 'devnet'
      } else if (endpoint === 'devnet') {
        // connection.cluster is passed in
        cluster = 'devnet'
      }
      
      return cluster ? `?cluster=${cluster}` : ''
    }
  
    return `https://explorer.solana.com/${itemType}/${viewTypeOrItemAddress}${getClusterUrlParam()}`
}

const estimateComputeUnits = (instructionsLength: number) => {
    // Estimate compute units based on the number of instructions. You can adjust this calculation.
    const baseUnits = 200_000; // Minimum compute units for a simple transaction
    const perInstructionUnits = 50_000; // Additional units for each instruction
    return baseUnits + perInstructionUnits * instructionsLength;
};

const calculatePriorityFee = (computeUnits: number, baseMicroLamportsPerUnit: number) => {
    // Calculate the total priority fee based on compute units and price per compute unit
    return computeUnits * baseMicroLamportsPerUnit;
};

export function InstructionTableView(props: any) {
    
    const proposalIx = props.proposalInstructions;
    
    //const index = props.index;
    const sentProp = props.proposal;
    const proposalAuthor = props?.proposalAuthor;
    const state = props.state; 
    const realm = props.realm;
    const setReload= props.setReload;
    const instructionOwnerRecord = props.instructionOwnerRecord;
    const instructionOwnerRecordATA = props.instructionOwnerRecordATA;
    //const instruction = props.instruction;
    const instructionTransferDetails = props.instructionTransferDetails;
    //const instructionDetails = instruction.account?.instructions?.[0] || instruction.account?.instruction || instruction;
    const setInstructionTransferDetails = props.setInstructionTransferDetails;
    const governingTokenMint = props.governingTokenMint;
    const governanceRulesWallet = props?.governanceRulesWallet;
    const memberMap = props.memberMap;
    const [instructionSet, setInstructionSet] = React.useState(null);
    const { publicKey, sendTransaction, signTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    
    async function createAndSendLargeTransaction(txInstructions, chunkSize = 5) {
        // Split txInstructions into smaller chunks
        const instructionChunks = [];
        for (let i = 0; i < txInstructions.length; i += chunkSize) {
            instructionChunks.push(txInstructions.slice(i, i + chunkSize));
        }
    
        console.log(`Total chunks to send: ${instructionChunks.length}`);
    
        let lastTxid = '';
        let latestBlockhash;
        let initialSignature;
    
        for (const [index, chunk] of instructionChunks.entries()) {
            console.log(`Sending chunk ${index + 1} of ${instructionChunks.length}`);
    
            if (index === 0) {
                // For the first chunk, fetch the latest blockhash and sign
                latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
            }
    
            const estimatedComputeUnits = estimateComputeUnits(chunk.length);
            const baseMicroLamportsPerUnit = 5000;
            const validatorTip = 0;
            const totalPriorityFee = calculatePriorityFee(estimatedComputeUnits, baseMicroLamportsPerUnit);
    
            const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
                microLamports: baseMicroLamportsPerUnit + validatorTip,
            });
    
            const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
                units: estimatedComputeUnits,
            });
    
            const allInstructions = [
                priorityFeeInstruction,
                computeUnitLimitInstruction,
                ...chunk,
            ];
    
            const messageV0 = new TransactionMessage({
                payerKey: publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: allInstructions,
            }).compileToV0Message();
    
            const transaction = new VersionedTransaction(messageV0);
    
            if (index === 0) {
                // Sign the first transaction
                await transaction.sign([payer]); // sign with your wallet or keypair once
    
                // Store the first signature for reuse in the next transactions
                initialSignature = transaction.signatures[0];
    
                console.log(`✅ - Initial transaction signed with signature: ${initialSignature.toString()}`);
            } else {
                // For subsequent chunks, reuse the initial signature and blockhash
                transaction.signatures = [initialSignature]; // Apply the stored signature
            }
    
            // Send each transaction
            const txid = await RPC_CONNECTION.sendRawTransaction(transaction.serialize(), {
                skipPreflight: true,
                maxRetries: 5,
            });
    
            console.log(`✅ - Transaction ${index + 1} sent with txid: ${txid}`);
    
            const snackprogress = (key) => (
                <CircularProgress sx={{ padding: '10px' }} />
            );
            const cnfrmkey = enqueueSnackbar(`Confirming Transaction ${index + 1}`, { variant: 'info', action: snackprogress, persist: true });
    
            const confirmation = await RPC_CONNECTION.confirmTransaction({
                signature: txid,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            });
    
            closeSnackbar(cnfrmkey);
    
            if (confirmation.value.err) {
                enqueueSnackbar(`Transaction ${index + 1} Error`, { variant: 'error' });
                throw new Error(`❌ - Transaction ${index + 1} not confirmed.`);
            }
    
            console.log(`🎉 Transaction ${index + 1} successfully confirmed!`, `https://explorer.solana.com/tx/${txid}`);
            lastTxid = txid;
        }
    
        return lastTxid; // Return the last transaction ID
    }
    
    const handleExecuteIx = async(instructionSets:any[]) => {

        const programId = new PublicKey(realm.owner);
        let instructions: TransactionInstruction[] = [];
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
        );
        
        let tokenOwnerRecordPk = null;
        
        if (!tokenOwnerRecordPk){
            tokenOwnerRecordPk = sentProp?.account?.tokenOwnerRecord;
            console.log("From proposal tokenOwnerRecordPk: "+JSON.stringify(tokenOwnerRecordPk));
        }

        if (!tokenOwnerRecordPk){
            for (let member of memberMap){
                if (new PublicKey(member.account.governingTokenOwner).toBase58() === publicKey.toBase58() &&
                    new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                    tokenOwnerRecordPk = new PublicKey(member.pubkey);
            }
        }
        
        /*
        if (!tokenOwnerRecordPk){
            tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
              programId,
              realm.pubkey,
              governingTokenMint,
              publicKey,
            );
            if (tokenOwnerRecordPk)
              console.log("Using getTokenOwnerRecordAddress: "+tokenOwnerRecordPk.toBase58());
        }*/
        
        // Iterate over each set of instructions
        for (const instruction of instructionSets) {
            const proposal = new PublicKey(instruction.account.proposal);
            const proposalTransaction = new PublicKey(instruction.account.pubkey || instruction.pubkey);
            console.log("Preparing Execute Instruction Selected");
            console.log("Handling instruction for transaction: " + proposalTransaction.toBase58());

            // Add the instructions from each set
            await withExecuteTransaction(
                instructions,
                programId,
                programVersion,
                governanceRulesWallet,
                proposal,
                proposalTransaction,
                [...instruction.account.getAllInstructions()] // Assuming this returns the instructions for this set
            );
        }
        
        // with instructions run a transaction and make it rain!!!
        if (instructions && instructions.length > 0){
            console.log("Sending "+instructions.length+" transactions");
            const signature = await createAndSendLargeTransaction(instructions);
            if (signature){
                enqueueSnackbar(`Transaction Executed from Proposal - ${signature}`,{ variant: 'success' });
                //pTransaction.add(lookupTableInst);
                //pTransaction.feePayer = publicKey;
                
                if (setReload) 
                    setReload(true);

            } else{
                enqueueSnackbar(`Error`,{ variant: 'error' });
            }
            
            return null;
        }
    }

    const handleRemoveIx = async(instructionSets:any[]) => {

        //console.log("instruction "+JSON.stringify(instruction));
        //console.log("instructionDetails: "+JSON.stringify(instructionDetails))
        const programId = new PublicKey(realm.owner);
        let instructions: TransactionInstruction[] = [];
        
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
        );
        
        let tokenOwnerRecordPk = null;
        
        if (!tokenOwnerRecordPk){
            tokenOwnerRecordPk = sentProp?.account?.tokenOwnerRecord;
            console.log("From proposal tokenOwnerRecordPk: "+JSON.stringify(tokenOwnerRecordPk));
        }

        if (!tokenOwnerRecordPk){
            for (let member of memberMap){
                if (new PublicKey(member.account.governingTokenOwner).toBase58() === publicKey.toBase58() &&
                    new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                    tokenOwnerRecordPk = new PublicKey(member.pubkey);
            }
        }
        
        /*
        if (!tokenOwnerRecordPk){
            tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
              programId,
              realmPk,
              governingTokenMint,
              publicKey,
            );
            if (tokenOwnerRecordPk)
              console.log("Using getTokenOwnerRecordAddress: "+tokenOwnerRecordPk.toBase58());
        }*/

        const beneficiary = publicKey;
        const governanceAuthority = publicKey;
        
        for (const instruction of instructionSets) {
            console.log("Preparing Remove Instruction Selected");
            const proposal = new PublicKey(instruction.account.proposal);
            const proposalTransaction = new PublicKey(instruction.account.pubkey || instruction.pubkey);
            console.log("Removing "+proposalTransaction.toBase58());
            await withRemoveTransaction(
                instructions,
                programId,
                programVersion,
                proposal,
                tokenOwnerRecordPk,
                governanceAuthority,
                proposalTransaction,
                beneficiary,
            )
        }
        
        // with instructions run a transaction and make it rain!!!
        if (instructions && instructions.length > 0){
            const signature = await createAndSendV0TxInline(instructions);
            if (signature){
                enqueueSnackbar(`Transaction Removed from Proposal - ${signature}`,{ variant: 'success' });
                //pTransaction.add(lookupTableInst);
                //pTransaction.feePayer = publicKey;
                
                if (setReload) 
                    setReload(true);

            } else{
                enqueueSnackbar(`Error`,{ variant: 'error' });
            }
            
            return null;
        }
    }


    const ixDetails = props.ixDetails;
    const [ixRows, setIxRows] = React.useState(null);
    const ixColumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', hide: true},
        { field: 'index', headerName: 'Index', hide: false},
        { field: 'ix', headerName: 'IX', minWidth: 120, hide: false,
            
            renderCell: (params) => {
                return(
                    <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={new PublicKey(params.value).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
            
        },
        { field: 'accounts', headerName: 'Accounts', minWidth: 70, hide: true},
        { field: 'signers', headerName: 'Signers', minWidth: 70, hide: true},
        { field: 'data', headerName: 'Data', hide: true},
        { field: 'description', headerName: 'Description', minWidth: 500, resizable:true, hide: false},
        { field: 'program', headerName: 'Program', minWidth: 120, resizable:true, hide: false},
        { field: 'status', headerName: 'Status', minWidth: 75, hide: false,
            renderCell: (params) => {
                return(
                    params.value === 0 ?
                            <><RadioButtonUncheckedIcon /></>
                        :
                            <><CheckCircleOutlineIcon /></>
                    
                )
            }
        },
        { field: 'manage', headerName: 'Manage', hide: !publicKey,
            
            renderCell: (params) => {
                return(// if this is still in draft state
                    (publicKey && proposalAuthor === publicKey.toBase58() && state === 0) ?
                        <>
                            <Tooltip title="Remove Transaction &amp; Claim Rent Back">
                                <IconButton 
                                    sx={{ml:1}}
                                    color='error'
                                    onClick={e => handleRemoveIx([params.value])}
                                >
                                    <DeleteIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        </>
                        :
                        <>{(publicKey && (state === 3 || state === 4 || state === 8) && (params.row.status === 0)) ?

                            <>
                                <Tooltip title="Execute Instruction">
                                    <IconButton 
                                        sx={{ml:1}}
                                        color='success'
                                        onClick={e => handleExecuteIx([params.value])}
                                    >
                                        <PlayCircleIcon fontSize='small' />
                                    </IconButton>
                                </Tooltip>
                            </>
                            :
                            <></>
                        }
                        </>
                    
                )
                
            }
        }, // allow to delete or execute ix
    ]

    function findOwnerRecord(destinationAta:any){
        //console.log("Json: "+JSON.stringify(instructionOwnerRecordATA));
        const index = instructionOwnerRecordATA.findIndex(key => key.equals(destinationAta));
        //return index;
        let owner = destinationAta;
        if (instructionOwnerRecord[index]?.data?.parsed?.info?.owner){
            owner = instructionOwnerRecord[index].data?.parsed?.info?.owner
        }
        return new PublicKey(owner).toBase58();

    }

    function createIxTable(){
        let ixarr = new Array();
        let ixarray = new Array();
        console.log("proposalIx: "+JSON.stringify(proposalIx));
        if (proposalIx[0].account.instructions.length > 1){
            if (proposalIx[0].account.instructions){
                proposalIx[0].account.instructions.sort((a: any, b: any) => b.account.instructionIndex - a.account.instructionIndex);

                (proposalIx[0].account.instructions).map((item: any, index:number) => (
                    //for (const member of members){
                        ixarr.push({
                            id:index,
                            index:item.account.instructionIndex,
                            ix:item.pubkey,
                            accounts:'',
                            signers:'',
                            data:item.account.instructions[0].data,
                            description:"DA "+item?.account?.instructions[0].info.description,
                            program: new PublicKey(item?.account?.instructions[0].programId).toBase58(),
                            status:item.account.executionStatus,
                            manage:item,
                        })
                ));
            }
        } else{
            if (proposalIx){

                // Extract signers
                
                proposalIx.sort((a: any, b: any) => b.account.instructionIndex - a.account.instructionIndex);
            
                (proposalIx).map((item: any, index:number) => {
                    
                    const accounts = item.account.instructions[0].accounts
                        .filter((account: any) => !account.isSigner)
                        .map((account: any) => account.pubkey);

                    const signers = item.account.instructions[0].accounts
                        .filter((account: any) => account.isSigner)
                        .map((account: any) => account.pubkey);
                        
                    let description = '';
                    if (item?.account?.instructions[0].info?.destinationAta){
                        description = item?.account?.instructions[0].info.description.replace(new PublicKey(item?.account?.instructions[0].info?.destinationAta.toBase58()), findOwnerRecord(item?.account?.instructions[0].info?.destinationAta));
                    } else{
                        description = item?.account?.instructions[0]?.info?.description;
                    }
                    //description = item?.account?.instructions[0].info.description + ' > ' + (item?.account?.instructions[0].info?.destinationAta ? findOwnerRecord(item?.account?.instructions[0].info?.destinationAta) : '')
                    
                    ixarr.push({
                        id:index,
                        index:item.account.instructionIndex,
                        ix:item.pubkey,
                        accounts: JSON.stringify(accounts),
                        signers: signers.join('<br/> '),
                        data:item.account.instructions[0].data,
                        description:description,
                        program: new PublicKey(item?.account?.instructions[0].programId).toBase58(),
                        //manage:item.account.instructionIndex,
                        status:item.account.executionStatus,
                        manage:item,
                    })

                    if (item.account.executionStatus === 0)
                        ixarray.push(item);
                })
            }
        }
        setIxRows(ixarr);
        setInstructionSet(ixarray)
    }

    React.useEffect(() => { 
        if (proposalIx){
            createIxTable();
        }
    }, [proposalIx]);

    return (
        <>
            {(publicKey && (state === 3 || state === 4 || state === 8) && instructionSet && instructionSet.length > 0) ?
                <Tooltip title="Execute All Instructions">
                    <Button 
                        sx={{ml:1,borderRadius:'17px'}}
                        color='success'
                        onClick={e => handleExecuteIx(instructionSet)}
                    >
                        <PlayCircleIcon fontSize='small' /> Execute {instructionSet.length} Instruction{instructionSet.length > 1 ? `s`:``}
                    </Button>
                </Tooltip>
            :<></>}
            {ixRows &&
                <div style={{ height: 600, width: '100%' }}>
                    <div style={{ display: 'flex', height: '100%' }}>
                        <div style={{ flexGrow: 1 }}>
                                <DataGrid
                                    rows={ixRows}
                                    columns={ixColumns}
                                    pageSize={25}
                                    rowsPerPageOptions={[]}
                                    sx={{
                                        borderRadius:'17px',
                                        borderColor:'rgba(255,255,255,0.25)',
                                        '& .MuiDataGrid-cell':{
                                            borderColor:'rgba(255,255,255,0.25)'
                                        }}}
                                    sortingOrder={['asc', 'desc', null]}
                                    initialState={{
                                        sorting: {
                                            sortModel: [{ field: 'index', sort: 'asc' }],
                                        },
                                    }}
                                />
                        </div>
                    </div>
                </div>
            }
        </>
    );
}