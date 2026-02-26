import { 
    withRemoveTransaction,
    withExecuteTransaction,
    InstructionData
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
 
import { createAndSendV0Tx } from './Proposals/proposalHelperInstructions'
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
    const governanceNativeWallet = props?.governanceNativeWallet;
    const memberMap = props.memberMap;
    const verifiedDestinationWalletArray = props?.verifiedDestinationWalletArray;
    const verifiedDAODestinationWalletArray = props?.verifiedDAODestinationWalletArray;
    
    const [instructionSet, setInstructionSet] = React.useState(null);
    const { publicKey, sendTransaction, signTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    
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
        const orderedInstructionSets = [...(instructionSets || [])].sort((a: any, b: any) => {
            const aIndex = Number(a?.account?.instructionIndex ?? 0);
            const bIndex = Number(b?.account?.instructionIndex ?? 0);
            return aIndex - bIndex;
        });

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
       for (const instruction of orderedInstructionSets) {
            const proposal = new PublicKey(instruction.account.proposal);
            const proposalTransaction = new PublicKey(instruction.account.pubkey || instruction.pubkey);

            console.log("Preparing Execute Instruction Selected");
            console.log("Handling instruction for transaction: " + proposalTransaction.toBase58());
            
            let txi: InstructionData[] = [];

            if (typeof instruction.account?.getAllInstructions === 'function') {
                txi = instruction.account.getAllInstructions();
            } else if (Array.isArray(instruction.account?.instructions)) {
                txi = instruction.account.instructions;
            }

            await withExecuteTransaction(
                instructions,
                programId,
                programVersion,
                governanceRulesWallet,
                proposal,
                proposalTransaction,
                txi
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
            setInspectorTarget(instructionSet);

            const rawIx = extractRawInstruction(instructionSet);
            const normalizedIx = normalizeInstructionFromAny(rawIx);
            if (!normalizedIx) {
                setInspectorIx(null);
                setInspectorParsed(null);
                setInspectorAccountRows([]);
                setInspectorError('Could not parse instruction');
                return;
            }

            setInspectorIx(normalizedIx);
            setInspectorParsed({
                programId: normalizedIx.programId.toBase58(),
                keyCount: normalizedIx.keys.length,
                dataBase64: normalizedIx.data.toString('base64'),
                dataHex: normalizedIx.data.toString('hex'),
                info: rawIx?.info || instructionSet?.account?.instructions?.[0]?.info || null,
                decodedIx: rawIx?.decodedIx || instructionSet?.account?.instructions?.[0]?.decodedIx || null,
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
            let txi: any[] | undefined = undefined;
            if (typeof instruction.account?.getAllInstructions === 'function') {
                // From RPC: getAllInstructions() is available
                txi = instruction.account.getAllInstructions();
            } else if (Array.isArray(instruction.account?.instructions)) {
                // From GraphQL: instructions is an array
                txi = instruction.account.instructions;
            }

            if (txi && txi.length > 0) {
                const first = txi[0];
                const dataBuffer = Array.isArray(first.data)
                    ? Buffer.from(first.data)
                    : Buffer.from(first.data, 'base64');

                const transactionInstruction = new TransactionInstruction({
                    keys: first.accounts.map((key: any) => ({
                        pubkey: new PublicKey(key.pubkey),
                        isSigner: key.isSigner,
                        isWritable: key.isWritable,
                    })),
                    programId: new PublicKey(first.programId),
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
                            verification:item,
                            status:item.account.executionStatus,
                            manage:item,
                            inspector:item
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
                    
                    if (index === 0){
                        console.log('first ix: '+JSON.stringify(item.account.instructions[0]))
                    }

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
                        verification:item,
                        status:item.account.executionStatus,
                        manage:item,
                        inspector:item,
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
