import { 
    withRemoveTransaction,
    withExecuteTransaction,
    InstructionData
} from '@solana/spl-governance';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import { getProposalInstructionsIndexed } from './api/queries';
import BN from 'bn.js';
import base58 from 'bs58';
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token-v2";
import { Signer, Connection, TransactionMessage, PublicKey, Transaction, VersionedTransaction, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError, TransactionOrVersionedTransaction } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';


import {CopyToClipboard} from 'react-copy-to-clipboard';
import { Link, useParams, useSearchParams } from "react-router-dom";

import { decodeMetadata } from '../utils/grapeTools/utils';
import { getGrapeGovernanceProgramVersion } from '../utils/grapeTools/helpers';
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
 
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import WarningIcon from '@mui/icons-material/Warning';
import VerifiedIcon from '@mui/icons-material/Verified';
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
import SearchIcon from '@mui/icons-material/Search';

import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
import NavItem from '../components/nav-section/vertical/nav-item';
import { generateKeyPairSync } from 'crypto';

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

function shortPk(addr?: string | null) {
    if (!addr) return '—';
    if (addr.length <= 8) return addr;
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
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

function escapeCsvValue(value: any) {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function getInstructionStatusLabel(status: any) {
    return Number(status) === 0 ? 'Pending' : 'Executed';
}

const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEh84bYQNJ9Y7fA1aC33mW7zk1g';

function buildInstructionCsv(rows: any[], proposal: any) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return '';
    }

    const sortedRows = [...rows].sort(
        (a: any, b: any) => Number(a?.index ?? 0) - Number(b?.index ?? 0)
    );

    const proposalName = proposal?.account?.name || '';
    const proposalAddress =
        proposal?.pubkey?.toBase58?.() ||
        (proposal?.pubkey ? `${proposal.pubkey}` : '');

    const csvRows = [];

    if (proposalName) {
        csvRows.push(`Proposal,${escapeCsvValue(proposalName)}`);
    }
    if (proposalAddress) {
        csvRows.push(`Proposal Address,${escapeCsvValue(proposalAddress)}`);
    }
    if (csvRows.length > 0) {
        csvRows.push('');
    }

    csvRows.push('Index,Transaction,Description,Program,Status,Accounts,Signers');

    sortedRows.forEach((row: any) => {
        csvRows.push([
            escapeCsvValue(row?.index ?? ''),
            escapeCsvValue(row?.ix ?? ''),
            escapeCsvValue(row?.description ?? ''),
            escapeCsvValue(row?.program ?? ''),
            escapeCsvValue(getInstructionStatusLabel(row?.status)),
            escapeCsvValue(row?.accounts ?? ''),
            escapeCsvValue(row?.signers ?? ''),
        ].join(','));
    });

    return csvRows.join('\r\n');
}

export function InstructionTableView(props: any) {
    
    const proposalIx = props.proposalInstructions;
    
    //const index = props.index;
    const sentProp = props.proposal;
    const proposalAuthor = props?.proposalAuthor;
    const hasProposalAuthority = props?.hasProposalAuthority;
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
    const governanceNativeWallet = props?.governanceNativeWallet;
    const memberMap = props.memberMap;
    const verifiedDestinationWalletArray = props?.verifiedDestinationWalletArray;
    const verifiedDAODestinationWalletArray = props?.verifiedDAODestinationWalletArray;
    
    const [instructionSet, setInstructionSet] = React.useState(null);
    const [failedExecuteKeys, setFailedExecuteKeys] = React.useState<string[]>([]);
    const { publicKey, sendTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const EXECUTE_ALL_MAX_BATCH_SIZE = 1100;
    const EXECUTE_ALL_MAX_BATCH_INSTRUCTIONS = 4;
    
    const findPubkey = (address:string) => {
        try{
            const entry = verifiedDestinationWalletArray.find((item) => item.info.addresses.includes(address));
            //console.log("checking: "+address+" vs "+entry)
            if (entry) {
                return entry.pubkey.toBase58();
            }
            return null; // Address not found
        }catch(e){console.log("ERR: "+e)}
    };
    const findDAOPubkey = (address:string) => {
        try{
            console.log("verifiedDAODestinationWalletArray: "+JSON.stringify(verifiedDAODestinationWalletArray))
            const entry = verifiedDAODestinationWalletArray.find((item) => item.info.includes(address));
            console.log("checking: "+address+" entry "+JSON.stringify(entry))
            if (entry) {
                return entry.pubkey;
            }
            return null; // Address not found
        }catch(e){console.log("ERR: "+e)}
    };

    async function createAndSendLargeTransaction(txInstructions: TransactionInstruction[], chunkSize: number = 5) {
        // Split txInstructions into smaller chunks
        const instructionChunks = [];
        for (let i = 0; i < txInstructions.length; i += chunkSize) {
            instructionChunks.push(txInstructions.slice(i, i + chunkSize));
        }
    
        console.log(`Total chunks to send: ${instructionChunks.length}`);
    
        let lastTxid = '';
        
        const snackprogress = (key: any) => (
            <CircularProgress sx={{ padding: '10px' }} />
        );
        enqueueSnackbar(`Sending Transaction Chunks ${instructionChunks.length}`, { variant: 'info', action: snackprogress });
        
        for (const [index, chunk] of instructionChunks.entries()) {
            console.log(`Sending chunk ${index + 1} of ${instructionChunks.length}`);
            
            const latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
    
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

            // Send each transaction
            const txid = await sendTransaction(transaction, RPC_CONNECTION, {
                skipPreflight: true,
                preflightCommitment: "confirmed",
                maxRetries: 5,
            });
            
            console.log(`✅ - Transaction ${index + 1} sent with txid: ${txid}`);
          
            const cnfrmkey = enqueueSnackbar(`Confirming Transaction ${index + 1} of ${instructionChunks.length}`, { variant: 'info', action: snackprogress, persist: true });
            
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

    async function createAndSendV0TxInline(txInstructions: TransactionInstruction[]) {
        // Step 1 - Fetch Latest Blockhash
        let latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
        console.log("   ✅ - Fetched latest blockhash. Last valid height:", latestBlockhash.lastValidBlockHeight);
        
        // Step 1: Estimate compute units based on the number of instructions
        const estimatedComputeUnits = estimateComputeUnits(txInstructions.length);

        // Step 2: Set a base fee per compute unit (microLamports)
        const baseMicroLamportsPerUnit = 5000; // Adjust this value as needed

        // Step 3: Add a validator tip per compute unit
        const validatorTip = 0;//2000; // Additional tip per compute unit (0.000002 SOL)

        // Step 4: Calculate the total priority fee
        const totalPriorityFee = calculatePriorityFee(estimatedComputeUnits, baseMicroLamportsPerUnit);

        console.log(`Estimated compute units: ${estimatedComputeUnits}`);
        console.log(`Total priority fee: ${totalPriorityFee} microLamports`);

        // Add compute budget instructions for priority fees and validator tips
        const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: baseMicroLamportsPerUnit + validatorTip, // Total fee including priority and validator tip
        });

        const computeUnitLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
            units: estimatedComputeUnits, // Use the estimated compute units
        });

        // Step 3 - Combine Priority Fee Instructions with Other Instructions
        const allInstructions = [
            priorityFeeInstruction,
            computeUnitLimitInstruction,
            ...txInstructions, // Append your original instructions
        ];

        // Step 2 - Generate Transaction Message
        const messageV0 = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: allInstructions
        }).compileToV0Message();
        console.log("   ✅ - Compiled transaction message");
        const transaction = new VersionedTransaction(messageV0);
        
        console.log("   ✅ - Transaction Signed");
      
        // Step 4 - Send our v0 transaction to the cluster
        //const txid = await RPC_CONNECTION.sendTransaction(transaction, { maxRetries: 5 });
        
        //const tx = new Transaction();
        //tx.add(txInstructions[0]);
        
        const txid = await sendTransaction(transaction, RPC_CONNECTION, {
            skipPreflight: true,
            preflightCommitment: "confirmed",
            maxRetries: 5
        });
        
        console.log("   ✅ - Transaction sent to network with txid: "+txid);
      
        // Step 5 - Confirm Transaction 
        const snackprogress = (key:any) => (
            <CircularProgress sx={{padding:'10px'}} />
        );
        const cnfrmkey = enqueueSnackbar(`Confirming Transaction`,{ variant: 'info', action:snackprogress, persist: true });
        const confirmation = await RPC_CONNECTION.confirmTransaction({
            signature: txid,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        });
        closeSnackbar(cnfrmkey);
        if (confirmation.value.err) { 
            enqueueSnackbar(`Transaction Error`,{ variant: 'error' });
            throw new Error("   ❌ - Transaction not confirmed.") }
      
        console.log('🎉 Transaction succesfully confirmed!', '\n', `https://explorer.solana.com/tx/${txid}`);
        return txid;
    }

    const handleExecuteIx = async(instructionSets:any[]) => {
        const programId = new PublicKey(realm.owner);
        const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realm.pubkey);

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
        /*
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
                [...instruction.account?.getAllInstructions()] // Assuming this returns the instructions for this set
            );
        }*/
        const refreshLiveInstructionState = async () => {
            try {
                const proposalPk = sentProp?.pubkey?.toBase58?.() || `${sentProp?.pubkey ?? ''}`;
                if (!proposalPk) {
                    return Array.isArray(proposalIx) ? proposalIx : [];
                }

                const liveInstructionSets = await getProposalInstructionsIndexed(
                    realm?.pubkey?.toBase58?.(),
                    proposalPk,
                    realm?.owner?.toBase58?.() || `${realm?.owner ?? ''}`
                );

                if (Array.isArray(liveInstructionSets)) {
                    createIxTable(liveInstructionSets);
                    return liveInstructionSets;
                }
            } catch (e) {
                console.warn('Failed to refresh live proposal instructions', e);
            }

            return Array.isArray(proposalIx) ? proposalIx : [];
        };

        const requestedInstructionKeys = new Set(
            (instructionSets || [])
                .map((instruction: any) => getInstructionSetPubkey(instruction))
                .filter((key: string) => !!key)
        );

        if (!requestedInstructionKeys.size) {
            enqueueSnackbar(`No pending instructions found`, { variant: 'warning' });
            return null;
        }

        let executedNowCount = 0;
        let skippedCompletedCount = 0;
        let walletApprovalCount = 0;

        try {
            while (requestedInstructionKeys.size > 0) {
                const liveInstructionSets = await refreshLiveInstructionState();
                const liveByPubkey = new Map<string, any>();

                for (const item of liveInstructionSets || []) {
                    const key = getInstructionSetPubkey(item);
                    if (key) {
                        liveByPubkey.set(key, item);
                    }
                }

                const pendingInstructionSets = Array.from(requestedInstructionKeys)
                    .map((key) => {
                        const liveItem = liveByPubkey.get(key);
                        if (!liveItem) {
                            requestedInstructionKeys.delete(key);
                            return null;
                        }

                        if (getInstructionSetStatus(liveItem) !== 0) {
                            requestedInstructionKeys.delete(key);
                            skippedCompletedCount += 1;
                            return null;
                        }

                        return liveItem;
                    })
                    .filter(Boolean)
                    .sort((a: any, b: any) => getInstructionSetIndex(a) - getInstructionSetIndex(b));

                if (!pendingInstructionSets.length) {
                    break;
                }

                const executeBatch = await buildExecuteBatch(
                    pendingInstructionSets,
                    programId,
                    programVersion
                );

                if (!executeBatch?.instructions?.length) {
                    enqueueSnackbar(`No executable instruction batches were built`, { variant: 'warning' });
                    return null;
                }

                try {
                    await createAndSendV0TxInline(executeBatch.instructions);
                    walletApprovalCount += 1;
                    executedNowCount += executeBatch.keys.length;
                    executeBatch.keys.forEach((key: string) => requestedInstructionKeys.delete(key));
                    setFailedExecuteKeys((current) =>
                        current.filter((key) => !executeBatch.keys.includes(key))
                    );

                    enqueueSnackbar(
                        `Executed batch ${walletApprovalCount} (${describeBatch(executeBatch.indexes || [])})`,
                        { variant: 'success' }
                    );
                } catch (e: any) {
                    const errMessage = e?.message || `${e}`;
                    console.error("Execute-all live batching failed", {
                        batchIndexes: executeBatch.indexes,
                        error: errMessage,
                    });
                    setFailedExecuteKeys((current) =>
                        Array.from(new Set([...current, ...executeBatch.keys]))
                    );
                    await refreshLiveInstructionState();
                    enqueueSnackbar(
                        `Execution halted at ${describeBatch(executeBatch.indexes || [])}: ${errMessage}`,
                        { variant: 'error' }
                    );
                    if (setReload) setReload(true);
                    return null;
                }
            }

            await refreshLiveInstructionState();

            if (!executedNowCount && skippedCompletedCount > 0) {
                enqueueSnackbar(
                    `Skipped ${skippedCompletedCount} instruction${skippedCompletedCount > 1 ? 's' : ''} already completed`,
                    { variant: 'info' }
                );
                if (setReload) setReload(true);
                return null;
            }

            if (!executedNowCount) {
                enqueueSnackbar(`No proposal transactions were executed`, { variant: 'warning' });
                if (setReload) setReload(true);
                return null;
            }

            enqueueSnackbar(
                `Executed ${executedNowCount} proposal transaction${executedNowCount > 1 ? 's' : ''} in ${walletApprovalCount} wallet approval${walletApprovalCount > 1 ? 's' : ''}${skippedCompletedCount ? `, skipped ${skippedCompletedCount} already completed` : ''}`,
                { variant: 'success' }
            );
            if (setReload) setReload(true);
            return null;
        } catch (e: any) {
            const errMessage = e?.message || `${e}`;
            console.error("Execute-all failed", errMessage);
            await refreshLiveInstructionState();
            enqueueSnackbar(`Execution halted: ${errMessage}`, { variant: 'error' });
            if (setReload) setReload(true);
            return null;
        }
    }

    const handleRemoveIx = async(instructionSets:any[]) => {

        //console.log("instruction "+JSON.stringify(instruction));
        //console.log("instructionDetails: "+JSON.stringify(instructionDetails))
        const programId = new PublicKey(realm.owner);
        let instructions: TransactionInstruction[] = [];
        
        const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realm.pubkey);
        
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
    const [inspectorTarget, setInspectorTarget] = React.useState<any>(null);
    const [inspectorTab, setInspectorTab] = React.useState<'parsed' | 'accounts' | 'simulation'>('parsed');
    const [inspectorIx, setInspectorIx] = React.useState<TransactionInstruction | null>(null);
    const [inspectorParsed, setInspectorParsed] = React.useState<any>(null);
    const [inspectorAccountRows, setInspectorAccountRows] = React.useState<any[]>([]);
    const [inspectorAccountLoading, setInspectorAccountLoading] = React.useState(false);
    const [inspectorSimulationLoading, setInspectorSimulationLoading] = React.useState(false);
    const [inspectorSimulation, setInspectorSimulation] = React.useState<any>(null);
    const [inspectorFeePayer, setInspectorFeePayer] = React.useState<PublicKey | null>(null);
    const [inspectorFeePayerSource, setInspectorFeePayerSource] = React.useState<string>('none');
    const [inspectorError, setInspectorError] = React.useState<string | null>(null);

    const toPublicKeySafe = (value: any): PublicKey | null => {
        try {
            if (!value) return null;
            if (value instanceof PublicKey) return value;
            if (typeof value?.toBase58 === 'function') return new PublicKey(value.toBase58());
            return new PublicKey(value);
        } catch {
            return null;
        }
    };

    const estimateVersionedTransactionSize = React.useCallback(
        (instructions: TransactionInstruction[], recentBlockhash: string) => {
            if (!publicKey) return Number.MAX_SAFE_INTEGER;
            try {
                const message = new TransactionMessage({
                    payerKey: publicKey,
                    recentBlockhash,
                    instructions,
                }).compileToV0Message();
                return new VersionedTransaction(message).serialize().length;
            } catch (e) {
                console.warn('Failed to estimate execute transaction size', e);
                return Number.MAX_SAFE_INTEGER;
            }
        },
        [publicKey]
    );

    const getInstructionSetPubkey = React.useCallback((instructionSet: any) => {
        try {
            return (
                instructionSet?.pubkey?.toBase58?.() ||
                instructionSet?.account?.pubkey?.toBase58?.() ||
                `${instructionSet?.pubkey || instructionSet?.account?.pubkey || ''}`
            );
        } catch {
            return '';
        }
    }, []);

    const getInstructionSetIndex = React.useCallback((instructionSet: any, fallback = 0) => {
        return Number(instructionSet?.account?.instructionIndex ?? fallback);
    }, []);

    const getInstructionSetStatus = React.useCallback((instructionSet: any) => {
        return Number(instructionSet?.account?.executionStatus ?? 0);
    }, []);

    const describeBatch = React.useCallback((indexes: number[]) => {
        if (!indexes.length) return 'unknown indexes';
        return indexes.length > 1
            ? `indexes ${indexes[0]}-${indexes[indexes.length - 1]}`
            : `index ${indexes[0]}`;
    }, []);

    const getInstructionSetInstructions = React.useCallback((instructionSet: any) => {
        if (!instructionSet) return [];
        if (typeof instructionSet?.account?.getAllInstructions === 'function') {
            const all = instructionSet.account.getAllInstructions();
            return Array.isArray(all) ? all : [];
        }
        if (Array.isArray(instructionSet?.account?.instructions)) {
            return instructionSet.account.instructions;
        }
        if (instructionSet?.account?.instruction) {
            return [instructionSet.account.instruction];
        }
        return [];
    }, []);

    const getKnownTokenOwnerForAta = React.useCallback(
        (instructionSet: any, mint: string, destinationAta: string) => {
            const instructionKey = getInstructionSetPubkey(instructionSet);
            const entries = Array.isArray(instructionTransferDetails) ? instructionTransferDetails : [];
            const match = entries.find((item: any) => {
                const itemInstructionKey =
                    item?.ix?.toBase58?.() ||
                    `${item?.ix ?? ''}`;
                const itemMint =
                    item?.mint?.toBase58?.() ||
                    `${item?.mint ?? ''}`;
                const itemDestinationAta =
                    item?.destinationAta?.toBase58?.() ||
                    `${item?.destinationAta ?? ''}`;

                return (
                    itemInstructionKey === instructionKey &&
                    itemMint === mint &&
                    itemDestinationAta === destinationAta
                );
            });

            return (
                match?.tokenOwner ||
                match?.recipientWallet ||
                null
            );
        },
        [getInstructionSetPubkey, instructionTransferDetails]
    );

    const resolveTokenTransferAtaTargets = React.useCallback(
        async (instructionSet: any) => {
            const targets: Array<{
                destinationAta: PublicKey;
                mint: PublicKey;
                tokenProgramId: PublicKey;
                tokenOwner: string | null;
            }> = [];
            const seen = new Set<string>();
            const rawInstructions = getInstructionSetInstructions(instructionSet);

            for (const rawInstruction of rawInstructions) {
                const normalizedIx = normalizeInstructionFromAny(rawInstruction);
                if (!normalizedIx) continue;

                const programIdString = normalizedIx.programId.toBase58();
                if (
                    programIdString !== TOKEN_PROGRAM_ID.toBase58() &&
                    programIdString !== TOKEN_2022_PROGRAM_ID
                ) {
                    continue;
                }

                const discr = normalizedIx.data?.[0];
                let mintPk: PublicKey | null = null;
                let destinationAtaPk: PublicKey | null = null;

                if (discr === 3 && normalizedIx.keys.length >= 2) {
                    destinationAtaPk = normalizedIx.keys[1].pubkey;
                    mintPk = toPublicKeySafe(rawInstruction?.info?.mint || rawInstruction?.mint);

                    if (!mintPk) {
                        try {
                            const sourceAtaPk = normalizedIx.keys[0].pubkey;
                            const sourceInfo = await RPC_CONNECTION.getParsedAccountInfo(sourceAtaPk, 'confirmed');
                            const parsedInfo = (sourceInfo?.value as any)?.data?.parsed?.info;
                            mintPk = toPublicKeySafe(parsedInfo?.mint);
                        } catch (e) {
                            console.warn('Failed to resolve source mint for token transfer ATA helper', e);
                        }
                    }
                } else if (discr === 12 && normalizedIx.keys.length >= 3) {
                    mintPk = normalizedIx.keys[1].pubkey;
                    destinationAtaPk = normalizedIx.keys[2].pubkey;
                } else {
                    continue;
                }

                if (!mintPk || !destinationAtaPk) continue;

                const destinationAta = destinationAtaPk.toBase58();
                const mint = mintPk.toBase58();
                const key = `${programIdString}:${mint}:${destinationAta}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const tokenOwner =
                    rawInstruction?.info?.tokenOwner ||
                    rawInstruction?.info?.recipientWallet ||
                    getKnownTokenOwnerForAta(instructionSet, mint, destinationAta);

                targets.push({
                    destinationAta: destinationAtaPk,
                    mint: mintPk,
                    tokenProgramId: normalizedIx.programId,
                    tokenOwner,
                });
            }

            return targets;
        },
        [getInstructionSetInstructions, getKnownTokenOwnerForAta]
    );

    const hasCreateAtaHelper = React.useCallback(
        (instructionSet: any) => {
            const rawInstructions = getInstructionSetInstructions(instructionSet);
            return rawInstructions.some((rawInstruction) => {
                const normalizedIx = normalizeInstructionFromAny(rawInstruction);
                if (!normalizedIx) return false;

                const programIdString = normalizedIx.programId.toBase58();
                if (
                    programIdString !== TOKEN_PROGRAM_ID.toBase58() &&
                    programIdString !== TOKEN_2022_PROGRAM_ID
                ) {
                    return false;
                }

                const discr = normalizedIx.data?.[0];
                return discr === 3 || discr === 12;
            });
        },
        [getInstructionSetInstructions]
    );

    const handleCreateAtaHelper = React.useCallback(
        async (instructionSet: any) => {
            try {
                if (!publicKey) {
                    enqueueSnackbar('Connect wallet to create recipient ATA.', { variant: 'warning' });
                    return null;
                }

                const targets = await resolveTokenTransferAtaTargets(instructionSet);
                if (!targets.length) {
                    enqueueSnackbar('No token transfer ATA helper is available for this instruction.', { variant: 'info' });
                    return null;
                }

                const helperInstructions: TransactionInstruction[] = [];
                let alreadyExistsCount = 0;

                for (const target of targets) {
                    const existingAta = await RPC_CONNECTION.getAccountInfo(target.destinationAta, 'confirmed');
                    if (existingAta) {
                        alreadyExistsCount += 1;
                        continue;
                    }

                    let tokenOwnerPk = toPublicKeySafe(target.tokenOwner);
                    if (!tokenOwnerPk) {
                        const enteredOwner = window.prompt(
                            `Enter the recipient wallet for ATA ${target.destinationAta.toBase58()}`
                        );
                        tokenOwnerPk = toPublicKeySafe(enteredOwner?.trim());
                    }

                    if (!tokenOwnerPk) {
                        enqueueSnackbar('Recipient wallet is required to create the ATA.', { variant: 'warning' });
                        return null;
                    }

                    const derivedAta = await getAssociatedTokenAddress(
                        target.mint,
                        tokenOwnerPk,
                        true,
                        target.tokenProgramId,
                        ASSOCIATED_TOKEN_PROGRAM_ID
                    );

                    if (!derivedAta.equals(target.destinationAta)) {
                        enqueueSnackbar('Recipient wallet does not match the transfer destination ATA.', { variant: 'error' });
                        return null;
                    }

                    helperInstructions.push(
                        createAssociatedTokenAccountInstruction(
                            publicKey,
                            target.destinationAta,
                            tokenOwnerPk,
                            target.mint,
                            target.tokenProgramId,
                            ASSOCIATED_TOKEN_PROGRAM_ID
                        )
                    );
                }

                if (!helperInstructions.length) {
                    enqueueSnackbar(
                        alreadyExistsCount > 0
                            ? `Recipient ATA already exists for ${alreadyExistsCount} transfer${alreadyExistsCount > 1 ? 's' : ''}.`
                            : 'No missing recipient ATA found.',
                        { variant: 'info' }
                    );
                    return null;
                }

                const signature = await createAndSendV0TxInline(helperInstructions);
                enqueueSnackbar(
                    `Created ${helperInstructions.length} recipient ATA${helperInstructions.length > 1 ? 's' : ''}${alreadyExistsCount ? `, skipped ${alreadyExistsCount} existing` : ''} - ${signature}`,
                    { variant: 'success' }
                );
                if (setReload) setReload(true);
                return signature;
            } catch (e: any) {
                enqueueSnackbar(e?.message || 'Failed to create recipient ATA.', { variant: 'error' });
                return null;
            }
        },
        [createAndSendV0TxInline, enqueueSnackbar, publicKey, resolveTokenTransferAtaTargets, setReload]
    );

    const buildExecuteBatch = React.useCallback(
        async (
            orderedInstructionSets: any[],
            programId: PublicKey,
            programVersion: number
        ) => {
            if (!orderedInstructionSets.length) {
                return null;
            }

            const latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('confirmed');
            const batchInstructions: TransactionInstruction[] = [];
            const batchIndexes: number[] = [];
            const batchKeys: string[] = [];

            for (let i = 0; i < orderedInstructionSets.length; i++) {
                const instruction = orderedInstructionSets[i];
                const instructionIndex = getInstructionSetIndex(instruction, i);
                const proposal = new PublicKey(instruction.account.proposal);
                const proposalTransaction = new PublicKey(instruction.account.pubkey || instruction.pubkey);

                let txi: InstructionData[] = [];
                if (typeof instruction.account?.getAllInstructions === 'function') {
                    txi = instruction.account.getAllInstructions();
                } else if (Array.isArray(instruction.account?.instructions)) {
                    txi = instruction.account.instructions;
                }

                const executeIxs: TransactionInstruction[] = [];
                await withExecuteTransaction(
                    executeIxs,
                    programId,
                    programVersion,
                    governanceRulesWallet,
                    proposal,
                    proposalTransaction,
                    txi
                );

                if (!executeIxs.length) {
                    throw new Error(`No execute instruction built for tx index ${instructionIndex}`);
                }

                const nextBatch = [...batchInstructions, ...executeIxs];
                const exceedsInstructionCount =
                    batchIndexes.length >= EXECUTE_ALL_MAX_BATCH_INSTRUCTIONS;
                const exceedsTxSize =
                    batchInstructions.length > 0 &&
                    estimateVersionedTransactionSize(nextBatch, latestBlockhash.blockhash) > EXECUTE_ALL_MAX_BATCH_SIZE;

                if (batchInstructions.length > 0 && (exceedsInstructionCount || exceedsTxSize)) {
                    break;
                }

                batchInstructions.push(...executeIxs);
                batchIndexes.push(instructionIndex);
                batchKeys.push(getInstructionSetPubkey(instruction));
            }

            if (!batchInstructions.length) {
                return null;
            }

            return {
                instructions: batchInstructions,
                indexes: batchIndexes,
                keys: batchKeys,
            };
        },
        [
            EXECUTE_ALL_MAX_BATCH_INSTRUCTIONS,
            EXECUTE_ALL_MAX_BATCH_SIZE,
            estimateVersionedTransactionSize,
            getInstructionSetIndex,
            getInstructionSetPubkey,
            governanceRulesWallet,
        ]
    );

    const toInstructionDataBuffer = (value: any): Buffer => {
        try {
            if (value === null || value === undefined) return Buffer.alloc(0);
            if (Buffer.isBuffer(value)) return value;
            if (value instanceof Uint8Array) return Buffer.from(value);
            if (Array.isArray(value)) return Buffer.from(value);
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (!trimmed) return Buffer.alloc(0);
                if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
                    return Buffer.from(trimmed, 'hex');
                }
                return Buffer.from(trimmed, 'base64');
            }
            if (Array.isArray(value?.data)) return Buffer.from(value.data);
            return Buffer.from(value);
        } catch {
            return Buffer.alloc(0);
        }
    };

    const normalizeInstructionFromAny = (ix: any): TransactionInstruction | null => {
        if (!ix) return null;
        if (ix instanceof TransactionInstruction) return ix;

        const programId = toPublicKeySafe(ix?.programId || ix?.program_id || ix?.program);
        if (!programId) return null;

        const rawKeys = Array.isArray(ix?.keys)
            ? ix.keys
            : Array.isArray(ix?.accounts)
            ? ix.accounts
            : [];

        const keys = rawKeys
            .map((k: any) => {
                const pubkey = toPublicKeySafe(k?.pubkey ?? k?.publicKey ?? k);
                if (!pubkey) return null;
                return {
                    pubkey,
                    isSigner: !!(k?.isSigner ?? k?.is_signer),
                    isWritable: !!(k?.isWritable ?? k?.is_writable),
                };
            })
            .filter(Boolean) as Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>;

        try {
            return new TransactionInstruction({
                programId,
                keys,
                data: toInstructionDataBuffer(ix?.data),
            });
        } catch {
            return null;
        }
    };

    const extractRawInstruction = (instructionSet: any): any => {
        if (!instructionSet) return null;
        if (typeof instructionSet?.account?.getAllInstructions === 'function') {
            const all = instructionSet.account.getAllInstructions();
            if (Array.isArray(all) && all.length > 0) return all[0];
        }
        if (Array.isArray(instructionSet?.account?.instructions) && instructionSet.account.instructions.length > 0) {
            return instructionSet.account.instructions[0];
        }
        if (instructionSet?.account?.instruction) return instructionSet.account.instruction;
        return null;
    };

    const resolveInspectableInstruction = React.useCallback(
        async (instructionSet: any) => {
            const tryResolve = (candidate: any) => {
                const rawCandidate =
                    extractRawInstruction(candidate) ||
                    candidate?.instruction ||
                    candidate?.account?.instruction ||
                    candidate;
                const normalizedCandidate = normalizeInstructionFromAny(rawCandidate);
                if (!normalizedCandidate) {
                    return null;
                }
                return {
                    instructionSet: candidate,
                    rawIx: rawCandidate,
                    normalizedIx: normalizedCandidate,
                };
            };

            const initialResolved = tryResolve(instructionSet);
            if (initialResolved) {
                return initialResolved;
            }

            try {
                const proposalPk = sentProp?.pubkey?.toBase58?.() || `${sentProp?.pubkey ?? ''}`;
                const instructionPk = getInstructionSetPubkey(instructionSet);
                if (!proposalPk || !instructionPk) {
                    return null;
                }

                const liveInstructionSets = await getProposalInstructionsIndexed(
                    realm?.pubkey?.toBase58?.(),
                    proposalPk,
                    realm?.owner?.toBase58?.() || `${realm?.owner ?? ''}`
                );

                const liveMatch = (Array.isArray(liveInstructionSets) ? liveInstructionSets : []).find(
                    (item: any) => getInstructionSetPubkey(item) === instructionPk
                );

                if (!liveMatch) {
                    return null;
                }

                return tryResolve(liveMatch);
            } catch (e) {
                console.warn('Failed to resolve inspectable instruction from live proposal data', e);
                return null;
            }
        },
        [getInstructionSetPubkey, realm?.owner, realm?.pubkey, sentProp?.pubkey]
    );

    const resolveSimulationFeePayer = async (ix: TransactionInstruction) => {
        const candidates: Array<{ pubkey: PublicKey; source: string }> = [];
        const seen = new Set<string>();
        const addCandidate = (pk: PublicKey | null, source: string) => {
            if (!pk) return;
            const key = pk.toBase58();
            if (seen.has(key)) return;
            seen.add(key);
            candidates.push({ pubkey: pk, source });
        };

        addCandidate(publicKey ? new PublicKey(publicKey) : null, 'connected_wallet');
        addCandidate(toPublicKeySafe(governanceNativeWallet), 'native_wallet');
        addCandidate(toPublicKeySafe(governanceRulesWallet), 'rules_wallet');
        ix.keys.forEach((k) => {
            if (k.isSigner || k.isWritable) addCandidate(k.pubkey, 'instruction_account');
        });

        if (!candidates.length) {
            return { feePayer: null as PublicKey | null, source: 'none', checkedCount: 0 };
        }

        const capped = candidates.slice(0, 48);
        try {
            const infos: any[] = [];
            for (let i = 0; i < capped.length; i += 100) {
                const chunk = capped.slice(i, i + 100).map((c) => c.pubkey);
                const chunkInfos = await RPC_CONNECTION.getMultipleAccountsInfo(chunk, 'confirmed');
                infos.push(...chunkInfos);
            }
            const idx = infos.findIndex((item) => !!item);
            if (idx >= 0) {
                return {
                    feePayer: capped[idx].pubkey,
                    source: capped[idx].source,
                    checkedCount: capped.length,
                };
            }
        } catch (e) {
            console.log('resolveSimulationFeePayer inspector lookup error', e);
        }

        return {
            feePayer: capped[0].pubkey,
            source: `${capped[0].source}_missing`,
            checkedCount: capped.length,
        };
    };

    const auditInstructionAccounts = async (ix: TransactionInstruction, feePayer: PublicKey | null) => {
        const roleMap = new Map<string, Set<string>>();
        const addRole = (pk: PublicKey, role: string) => {
            const key = pk.toBase58();
            const roles = roleMap.get(key) || new Set<string>();
            roles.add(role);
            roleMap.set(key, roles);
        };

        if (feePayer) addRole(feePayer, 'fee_payer');
        addRole(ix.programId, 'program_id');
        ix.keys.forEach((k, idx) => {
            addRole(k.pubkey, `${k.isSigner ? 'signer' : 'account'}:${k.isWritable ? 'w' : 'r'}#${idx}`);
        });

        const pubkeys = Array.from(roleMap.keys()).map((k) => new PublicKey(k));
        try {
            const infos: any[] = [];
            for (let i = 0; i < pubkeys.length; i += 100) {
                const chunk = pubkeys.slice(i, i + 100);
                const chunkInfos = await RPC_CONNECTION.getMultipleAccountsInfo(chunk, 'confirmed');
                infos.push(...chunkInfos);
            }

            const rows = pubkeys.map((pk, idx) => {
                const info = infos[idx];
                return {
                    pubkey: pk.toBase58(),
                    roles: Array.from(roleMap.get(pk.toBase58()) || []),
                    exists: !!info,
                    owner: info?.owner?.toBase58?.() || '-',
                    lamports: info?.lamports ?? null,
                    executable: !!info?.executable,
                    dataLen: info?.data ? info.data.length : 0,
                };
            });

            return {
                checkedCount: rows.length,
                missingCount: rows.filter((r) => !r.exists).length,
                rows,
            };
        } catch (e: any) {
            return {
                checkedCount: pubkeys.length,
                missingCount: 0,
                rows: [],
                error: e?.message || `${e}`,
            };
        }
    };

    const handleInspectIx = async (instructionSet: any) => {
        try {
            setInspectorError(null);
            setInspectorSimulation(null);
            setInspectorTab('parsed');
            const resolvedInstruction = await resolveInspectableInstruction(instructionSet);
            if (!resolvedInstruction) {
                setInspectorTarget(instructionSet);
                setInspectorIx(null);
                setInspectorParsed(null);
                setInspectorAccountRows([]);
                setInspectorError('Could not parse instruction');
                return;
            }

            const { instructionSet: inspectableTarget, rawIx, normalizedIx } = resolvedInstruction;
            setInspectorTarget(inspectableTarget);

            setInspectorIx(normalizedIx);
            setInspectorParsed({
                programId: normalizedIx.programId.toBase58(),
                keyCount: normalizedIx.keys.length,
                dataBase64: normalizedIx.data.toString('base64'),
                dataHex: normalizedIx.data.toString('hex'),
                info: rawIx?.info || inspectableTarget?.account?.instructions?.[0]?.info || null,
                decodedIx: rawIx?.decodedIx || inspectableTarget?.account?.instructions?.[0]?.decodedIx || null,
            });

            setInspectorAccountLoading(true);
            const feePayerResolution = await resolveSimulationFeePayer(normalizedIx);
            setInspectorFeePayer(feePayerResolution.feePayer);
            setInspectorFeePayerSource(feePayerResolution.source);
            const accountAudit = await auditInstructionAccounts(normalizedIx, feePayerResolution.feePayer);
            setInspectorAccountRows(accountAudit.rows || []);
            if (accountAudit?.error) {
                setInspectorError(`Account audit failed: ${accountAudit.error}`);
            }
        } catch (e: any) {
            setInspectorError(e?.message || `${e}`);
        } finally {
            setInspectorAccountLoading(false);
        }
    };

    const runInspectorSimulation = async () => {
        if (!inspectorIx) return;
        try {
            setInspectorSimulationLoading(true);
            setInspectorError(null);
            const feePayerResolution = await resolveSimulationFeePayer(inspectorIx);
            const simFeePayer = feePayerResolution.feePayer;
            if (!simFeePayer) {
                setInspectorSimulation({
                    status: 'missing_fee_payer',
                    message: 'No valid fee payer resolved for simulation',
                    simulationFeePayerSource: feePayerResolution.source,
                });
                return;
            }

            const latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('confirmed');
            const tx = new Transaction({
                feePayer: simFeePayer,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            });
            tx.add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 350000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
                inspectorIx
            );

            const accountAudit = await auditInstructionAccounts(inspectorIx, simFeePayer);
            const simulationResult = await RPC_CONNECTION.simulateTransaction(tx);
            const simValue = simulationResult?.value || {};
            const simErr = simValue?.err || (simulationResult as any)?.err || null;
            const logs = Array.isArray(simValue?.logs) ? simValue.logs : [];
            const unitsConsumed = simValue?.unitsConsumed ?? null;
            setInspectorSimulation({
                status: simErr ? 'failed' : 'ok',
                error: simErr,
                logs,
                unitsConsumed,
                message: simErr ? 'Simulation failed' : 'Simulation successful',
                simulationFeePayer: simFeePayer.toBase58(),
                simulationFeePayerSource: feePayerResolution.source,
                accountAudit: {
                    checkedCount: accountAudit.checkedCount || 0,
                    missingCount: accountAudit.missingCount || 0,
                },
            });
            if (accountAudit?.rows) setInspectorAccountRows(accountAudit.rows);
        } catch (e: any) {
            setInspectorSimulation({
                status: 'failed',
                error: e?.message || `${e}`,
            });
        } finally {
            setInspectorSimulationLoading(false);
        }
    };

    const handleRedirectIx = async(instructionSets:any[]) => {
        const tx = [];
        // now lets get all tx items
        for (const instruction of instructionSets) {
            const txi = getInstructionSetInstructions(instruction);

            if (txi && txi.length > 0) {
                const first = txi[0];
                const normalizedIx = normalizeInstructionFromAny(first);
                const dataBuffer = normalizedIx?.data
                    ? Buffer.from(normalizedIx.data)
                    : Array.isArray(first.data)
                    ? Buffer.from(first.data)
                    : Buffer.from(first.data, 'base64');

                const transactionInstruction = new TransactionInstruction({
                    keys: normalizedIx?.keys?.length
                        ? normalizedIx.keys.map((key: any) => ({
                            pubkey: new PublicKey(key.pubkey),
                            isSigner: key.isSigner,
                            isWritable: key.isWritable,
                        }))
                        : first.accounts.map((key: any) => ({
                            pubkey: new PublicKey(key.pubkey),
                            isSigner: key.isSigner,
                            isWritable: key.isWritable,
                        })),
                    programId: normalizedIx?.programId
                        ? new PublicKey(normalizedIx.programId)
                        : new PublicKey(first.programId),
                    data: dataBuffer,
                });

                tx.push(transactionInstruction);
            }
        }

        const latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('confirmed');
        const messageV0 = new TransactionMessage({
            payerKey: new PublicKey(governanceNativeWallet || governanceRulesWallet), //publicKey, // consider using the governance native wallet here
            recentBlockhash: latestBlockhash.blockhash,
            instructions: tx,//[new TransactionInstruction(txi)], // instructions
        }).compileToV0Message();
        
        console.log("Transaction:", tx);
        //console.log("Serialized Message:", transaction.serializeMessage().toString("base64"));
        const serializedMessage = Buffer.from(messageV0.serialize()).toString('base64'); // Use Buffer for Base64 conversion
        //const message = messageV0.serialize?.toString('base64');
            //messageV0 instanceof Transaction
            //? messageV0?.serializeMessage()?.toString('base64')
            //: null//Buffer.from(messageV0?.message?.serialize()).toString('base64')
        console.log("Serialized Message:", serializedMessage);

            if (serializedMessage){
                const inspectorUrl = `https://explorer.solana.com/tx/inspector?signatures=[]&message=${encodeURIComponent(serializedMessage)}`;

                if (inspectorUrl) {
                    window.open(inspectorUrl, "_blank"); // Open the URL in a new tab // Redirect to the saved URL
                    return inspectorUrl;
                }
            }

        return null;
    };

    const ixColumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', hide: true},
        { field: 'index', headerName: 'Index', hide: false},
        { field: 'ix', headerName: 'IX', minWidth: 120, hide: false,
            
            renderCell: (params) => {
                return(
                    <ExplorerView showSolanaProfile={true} memberMap={memberMap} grapeArtProfile={true} address={new PublicKey(params.value).toBase58()} type='address' shorten={3} hideTitle={false} style='text' color='white' fontSize='14px' />
                )
            }
            
        },
        { field: 'accounts', headerName: 'Accounts', minWidth: 70, hide: true},
        { field: 'signers', headerName: 'Signers', minWidth: 70, hide: true},
        { field: 'data', headerName: 'Data', hide: true},
        { field: 'description', headerName: 'Description', minWidth: 500, resizable:true, hide: false},
        { field: 'program', headerName: 'Program', minWidth: 120, resizable:true, hide: false},
        { field: 'verification', headerName: 'Verification', minWidth: 75, hide: state !== 0,
            renderCell: (params) => {
                let destPK = (params?.value?.account?.instructions && params?.value?.account?.instructions[0]?.info?.tokenOwner) ?  new PublicKey(params.value.account.instructions[0].info.tokenOwner) : null;//new PublicKey("6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD");//new PublicKey("KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT");
                if (!destPK){ // sol transfer?
                    destPK = (params?.value?.account?.instructions && params?.value?.account?.instructions[0]?.accounts && params?.value?.account?.instructions[0]?.accounts.length > 1) ?  new PublicKey(params.value.account.instructions[0].accounts[1].pubkey) : null;
                }

                    return(
                        <>
                            {(publicKey && state === 0 && destPK) ? 
                                <>
                                    {/*destPK.toBase58().trim()}{' '}*/}
                                        {verifiedDestinationWalletArray ? (
                                            findPubkey(destPK.toBase58()) ? (
                                                <Tooltip title={`Grape Verified on ${findPubkey(destPK.toBase58())} via Speed Dial`}>
                                                    <IconButton size="small" sx={{}}>
                                                        <VerifiedIcon sx={{ color:'yellow', fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <>
                                                    {verifiedDestinationWalletArray.length > 0 &&
                                                        <Tooltip title={`This address is not part of a Speed Dial`}>
                                                            <IconButton
                                                                size="small" sx={{}}
                                                            >
                                                                <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                            </IconButton>
                                                        </Tooltip>
                                                    }
                                                </>
                                            )
                                            ) : (
                                            ''
                                        )}

                                        {verifiedDAODestinationWalletArray ? 
                                            (
                                                findDAOPubkey(destPK.toBase58()) ? (
                                                    <Tooltip title={`DAO Verified on ${findDAOPubkey(destPK.toBase58())}`}>
                                                        <IconButton
                                                            size="small" sx={{}}
                                                        >
                                                            <CheckCircleIcon color='primary' sx={{ fontSize: '12px' }}/>
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip title={`Could not find a voter record for this address, or voter has no voting power`}>
                                                        <IconButton
                                                            size="small" sx={{}}
                                                        >
                                                            <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                        </IconButton>
                                                    </Tooltip>
                                                )
                                                
                                            ):<></>}
                                </>
                            :<></>}
                        </>
                        
                    )
            }
        },
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
                    ((typeof hasProposalAuthority === 'boolean' ? hasProposalAuthority : (publicKey && proposalAuthor === publicKey.toBase58())) && state === 0) ?
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
                                {hasCreateAtaHelper(params.value) ? (
                                    <Tooltip title="Create recipient ATA with your wallet before execution">
                                        <IconButton
                                            sx={{ml:1}}
                                            color='warning'
                                            onClick={e => handleCreateAtaHelper(params.value)}
                                        >
                                            <AccountBalanceWalletIcon fontSize='small' />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
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
        { field: 'inspector', headerName: 'Inspect', hide: !publicKey,
            renderCell: (params) => {
                return(
                <>{publicKey && params.value ?
                    <Tooltip title="Inspect Instruction">
                        <IconButton 
                            sx={{ml:1}}
                            color='success'
                            onClick={e => handleInspectIx(params.value)}
                        >
                            <SearchIcon fontSize='small' />
                        </IconButton>
                    </Tooltip>
                    :<></>}
                </>
                );
            }
        },
    ]

    function findOwnerRecord(destinationAta:any){
        try {
            if (!instructionOwnerRecordATA || !instructionOwnerRecord) {
                return new PublicKey(destinationAta).toBase58();
            }
            const destinationPk = new PublicKey(destinationAta);
            const index = instructionOwnerRecordATA.findIndex((key: any) => key?.equals?.(destinationPk));
            let owner = destinationPk.toBase58();
            if (index >= 0 && instructionOwnerRecord[index]?.data?.parsed?.info?.owner){
                owner = instructionOwnerRecord[index].data?.parsed?.info?.owner;
            }
            return new PublicKey(owner).toBase58();
        } catch {
            return `${destinationAta ?? ''}`;
        }
    }

    function createIxTable(sourceProposalIx: any = proposalIx){
        let ixarr = new Array();
        let ixarray = new Array();
        console.log("proposalIx: "+JSON.stringify(sourceProposalIx));
        if (!Array.isArray(sourceProposalIx) || sourceProposalIx.length === 0) {
            setIxRows([]);
            setInstructionSet([]);
            return;
        }

        // Some indexed payloads nest proposal transactions under the first item.
        // Normal path is already a flat array of proposal transactions.
        const maybeNested = sourceProposalIx[0]?.account?.instructions;
        const rawTxRows = (
            Array.isArray(maybeNested) &&
            maybeNested.length > 0 &&
            maybeNested[0]?.account?.instructionIndex !== undefined
        )
            ? maybeNested
            : sourceProposalIx;

        const txRows = [...rawTxRows].sort(
            (a: any, b: any) =>
                Number(b?.account?.instructionIndex ?? 0) - Number(a?.account?.instructionIndex ?? 0)
        );

        txRows.map((item: any, index:number) => {
            const itemInstructions = typeof item?.account?.getAllInstructions === 'function'
                ? item.account.getAllInstructions()
                : Array.isArray(item?.account?.instructions)
                    ? item.account.instructions
                    : [];

            const allAccounts = itemInstructions.flatMap((ix: any) =>
                Array.isArray(ix?.accounts) ? ix.accounts : []
            );

            const accounts = Array.from(new Set(
                allAccounts
                    .filter((account: any) => !account?.isSigner)
                    .map((account: any) =>
                        account?.pubkey?.toBase58?.() || `${account?.pubkey ?? ''}`
                    )
                    .filter((value: string) => !!value)
            ));

            const signers = Array.from(new Set(
                allAccounts
                    .filter((account: any) => !!account?.isSigner)
                    .map((account: any) =>
                        account?.pubkey?.toBase58?.() || `${account?.pubkey ?? ''}`
                    )
                    .filter((value: string) => !!value)
            ));

            const descriptions = itemInstructions
                .map((ix: any) => {
                    const infoDescription = ix?.info?.description;
                    if (!infoDescription) return null;
                    if (ix?.info?.destinationAta) {
                        try {
                            const resolvedDestination =
                                ix?.info?.tokenOwner || findOwnerRecord(ix.info.destinationAta);
                            const ataStr =
                                ix.info.destinationAta?.toBase58?.() ||
                                new PublicKey(ix.info.destinationAta).toBase58();
                            return infoDescription
                                .replace(ataStr, resolvedDestination)
                                .replace(shortPk(ataStr), resolvedDestination);
                        } catch {
                            return infoDescription;
                        }
                    }
                    return infoDescription;
                })
                .filter(Boolean);

            const description =
                descriptions.length > 0
                    ? descriptions.join(" | ")
                    : `Transaction with ${itemInstructions.length} instruction${itemInstructions.length === 1 ? '' : 's'}`;

            const programIds = Array.from(new Set(
                itemInstructions
                    .map((ix: any) => {
                        try {
                            return ix?.programId?.toBase58?.()
                                || (ix?.programId ? new PublicKey(ix.programId).toBase58() : null);
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean)
            ));

            const program =
                programIds.length === 1
                    ? programIds[0]
                    : `${programIds.length} programs`;

            const itemPubkey = item?.pubkey?.toBase58?.() || `${item?.pubkey ?? ''}`;

            ixarr.push({
                id:index,
                index:Number(item?.account?.instructionIndex ?? index),
                ix:itemPubkey,
                accounts: accounts.join(' | '),
                signers: signers.join(' | '),
                data:itemInstructions?.[0]?.data ?? null,
                description:description,
                program: program,
                verification:item,
                status:item?.account?.executionStatus ?? 0,
                manage:item,
                inspector:item,
            });

            if ((item?.account?.executionStatus ?? 1) === 0 && !failedExecuteKeys.includes(itemPubkey))
                ixarray.push(item);
        });

        setIxRows(ixarr);
        setInstructionSet(ixarray)
    }

    React.useEffect(() => {
        setFailedExecuteKeys([]);
    }, [sentProp?.pubkey?.toBase58?.()]);

    React.useEffect(() => { 
        if (proposalIx){
            createIxTable();
        }
    }, [failedExecuteKeys, proposalIx]);

    const instructionCsv = ixRows ? buildInstructionCsv(ixRows, sentProp) : '';
    const instructionCsvHref = instructionCsv
        ? `data:text/csv;charset=utf-8,${encodeURIComponent(instructionCsv)}`
        : null;
    const instructionCsvFilename = `${
        sentProp?.pubkey?.toBase58?.() || 'proposal'
    }_instructions.csv`;

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
                <div style={{ width: '100%', position: 'relative' }}>
                    {instructionCsvHref && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                zIndex: 2,
                            }}
                        >
                            <Tooltip title="Download the instruction table as CSV">
                                <Button
                                    size="small"
                                    color='inherit'
                                    variant="text"
                                    sx={{
                                        borderRadius:'17px',
                                        textTransform: 'none',
                                        minWidth: 'auto',
                                        backgroundColor: 'rgba(14,24,40,0.72)',
                                        backdropFilter: 'blur(6px)',
                                    }}
                                    download={instructionCsvFilename}
                                    href={instructionCsvHref}
                                >
                                    <DownloadIcon fontSize='small' sx={{ mr: 0.75 }} />
                                    CSV
                                </Button>
                            </Tooltip>
                        </Box>
                    )}
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
                </div>
            }
            {inspectorTarget && (
                <Box
                    sx={{
                        mt: 2,
                        p: 1.5,
                        borderRadius: '14px',
                        border: '1px solid rgba(255,255,255,0.18)',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                    }}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                            Instruction Inspector
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                size="small"
                                variant={inspectorTab === 'parsed' ? 'contained' : 'outlined'}
                                sx={{ borderRadius: '10px', textTransform: 'none' }}
                                onClick={() => setInspectorTab('parsed')}
                            >
                                Parsed
                            </Button>
                            <Button
                                size="small"
                                variant={inspectorTab === 'accounts' ? 'contained' : 'outlined'}
                                sx={{ borderRadius: '10px', textTransform: 'none' }}
                                onClick={() => setInspectorTab('accounts')}
                            >
                                Accounts
                            </Button>
                            <Button
                                size="small"
                                variant={inspectorTab === 'simulation' ? 'contained' : 'outlined'}
                                sx={{ borderRadius: '10px', textTransform: 'none' }}
                                onClick={() => setInspectorTab('simulation')}
                            >
                                Simulation
                            </Button>
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setInspectorTarget(null);
                                    setInspectorIx(null);
                                    setInspectorParsed(null);
                                    setInspectorAccountRows([]);
                                    setInspectorSimulation(null);
                                    setInspectorError(null);
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>

                    {inspectorError && (
                        <Typography variant="caption" sx={{ color: '#ffb4b4', display: 'block', mb: 1 }}>
                            {inspectorError}
                        </Typography>
                    )}

                    {inspectorTab === 'parsed' && (
                        <Box sx={{ display: 'grid', gap: 1 }}>
                            <Typography variant="caption">
                                Program: {inspectorParsed?.programId || '-'}
                            </Typography>
                            <Typography variant="caption">
                                Accounts: {inspectorParsed?.keyCount ?? 0}
                            </Typography>
                            <Typography variant="caption">
                                Fee payer source: {inspectorFeePayerSource}
                            </Typography>
                            <TextField
                                size="small"
                                label="Instruction Info"
                                value={inspectorParsed?.info ? JSON.stringify(inspectorParsed.info, null, 2) : '-'}
                                multiline
                                minRows={4}
                                maxRows={10}
                                fullWidth
                                InputProps={{ readOnly: true }}
                            />
                            <TextField
                                size="small"
                                label="Decoded"
                                value={inspectorParsed?.decodedIx ? JSON.stringify(inspectorParsed.decodedIx, null, 2) : '-'}
                                multiline
                                minRows={4}
                                maxRows={10}
                                fullWidth
                                InputProps={{ readOnly: true }}
                            />
                            <TextField
                                size="small"
                                label="Data (base64)"
                                value={inspectorParsed?.dataBase64 || '-'}
                                multiline
                                minRows={2}
                                maxRows={5}
                                fullWidth
                                InputProps={{ readOnly: true }}
                            />
                        </Box>
                    )}

                    {inspectorTab === 'accounts' && (
                        <Box>
                            {inspectorAccountLoading ? (
                                <LinearProgress sx={{ borderRadius: '8px' }} />
                            ) : (
                                <Box sx={{ maxHeight: 300, overflow: 'auto', display: 'grid', gap: 0.8 }}>
                                    {inspectorAccountRows.map((row, idx) => (
                                        <Box
                                            key={`${row.pubkey}-${idx}`}
                                            sx={{
                                                p: 1,
                                                borderRadius: '10px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                backgroundColor: row.exists ? 'rgba(255,255,255,0.02)' : 'rgba(244,67,54,0.1)',
                                            }}
                                        >
                                            <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                                                {row.pubkey}
                                            </Typography>
                                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                                                Roles: {(row.roles || []).join(', ') || '-'}
                                            </Typography>
                                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                                                Exists: {row.exists ? 'yes' : 'no'} | Owner: {row.owner || '-'}
                                            </Typography>
                                            <Typography variant="caption" sx={{ display: 'block', opacity: 0.8 }}>
                                                Lamports: {row.lamports !== null && row.lamports !== undefined ? Number(row.lamports).toLocaleString() : '-'}
                                                {' '}| Executable: {row.executable ? 'yes' : 'no'} | Data: {row.dataLen ?? 0}
                                            </Typography>
                                        </Box>
                                    ))}
                                    {inspectorAccountRows.length === 0 && (
                                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                            No account metadata available.
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Box>
                    )}

                    {inspectorTab === 'simulation' && (
                        <Box sx={{ display: 'grid', gap: 1 }}>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    sx={{ borderRadius: '10px', textTransform: 'none' }}
                                    disabled={!inspectorIx || inspectorSimulationLoading}
                                    onClick={runInspectorSimulation}
                                >
                                    {inspectorSimulationLoading ? 'Simulating...' : 'Run Simulation'}
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{ borderRadius: '10px', textTransform: 'none' }}
                                    disabled={!inspectorTarget}
                                    onClick={() => handleRedirectIx([inspectorTarget])}
                                >
                                    Open Explorer Inspector
                                </Button>
                            </Box>
                            {inspectorSimulation && (
                                <TextField
                                    size="small"
                                    label="Simulation Result"
                                    value={JSON.stringify(inspectorSimulation, null, 2)}
                                    multiline
                                    minRows={6}
                                    maxRows={18}
                                    fullWidth
                                    InputProps={{ readOnly: true }}
                                />
                            )}
                            {!inspectorSimulation && (
                                <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                    Run simulation to view logs, error, compute units, and account preflight status.
                                </Typography>
                            )}
                        </Box>
                    )}
                </Box>
            )}
        </>
    );
}
