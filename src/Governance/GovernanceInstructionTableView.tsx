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
import { Signer, Connection, TransactionMessage, PublicKey, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
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
import DeveloperModeIcon from '@mui/icons-material/DeveloperMode';
import BallotIcon from '@mui/icons-material/Ballot';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
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
    const memberMap = props.memberMap;
    const tokenMap = props.tokenMap;
    const cachedTokenMeta = props.cachedTokenMeta;
    const [iVLoading, setIVLoading] = React.useState(false);
    const { publicKey, sendTransaction, signTransaction } = useWallet();
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    
    const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    
    async function createAndSendV0TxInline(txInstructions: TransactionInstruction[]) {
        // Step 1 - Fetch Latest Blockhash
        let latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
        console.log("   ✅ - Fetched latest blockhash. Last valid height:", latestBlockhash.lastValidBlockHeight);
      
        // Step 2 - Generate Transaction Message
        const messageV0 = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: txInstructions
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
      

    const handleRemoveIx = async(instruction:any) => {

        //console.log("instruction "+JSON.stringify(instruction));
        //console.log("instructionDetails: "+JSON.stringify(instructionDetails))

        const programId = new PublicKey(realm.owner);
        let instructions: TransactionInstruction[] = [];
        const proposal = new PublicKey(instruction.account.proposal);
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
        );
        
        const proposalTransaction = new PublicKey(instruction.account.pubkey || instruction.pubkey);

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
        
        console.log("Preparing Remove Instruction Selected");
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
        { field: 'status', headerName: 'Status', minWidth: 75, hide: false},
        { field: 'accounts', headerName: 'Accounts', minWidth: 70, hide: true},
        { field: 'signers', headerName: 'Signers', minWidth: 70, hide: true},
        { field: 'data', headerName: 'Data', hide: true},
        { field: 'description', headerName: 'Description', minWidth: 500, resizable:true, hide: false},
        { field: 'program', headerName: 'Program', minWidth: 120, resizable:true, hide: false},
        { field: 'manage', headerName: 'Manage', hide: false,
            
            renderCell: (params) => {
                return(
                    (publicKey && proposalAuthor === publicKey.toBase58() && state === 0) ?
                        <>
                            <Tooltip title="Remove Transaction &amp; Claim Rent Back">
                                <IconButton 
                                    sx={{ml:1}}
                                    color='error'
                                    onClick={e => handleRemoveIx(proposalIx[0].account.instructions.length > 1 ? proposalIx[0].account.instructions[params.value] : proposalIx[params.value])}
                                >
                                    <DeleteIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        </>
                        :
                        <>-</>
                    
                )
            }
        }, // allow to delete or execute ix
    ]

    function findOwnerRecord(destinationAta:any){
        //console.log("Json: "+JSON.stringify(instructionOwnerRecordATA));
        const index = instructionOwnerRecordATA.findIndex(key => key.equals(destinationAta));
        //return index;
        return new PublicKey(instructionOwnerRecord[index].data.parsed.info.owner).toBase58();

    }

    function createIxTable(){
        let ixarr = new Array();
        console.log("proposalIx: "+JSON.stringify(proposalIx));
        if (proposalIx[0].account.instructions.length > 1){
            if (proposalIx[0].account.instructions){
                proposalIx[0].account.instructions.sort((a, b) => b.account.instructionIndex - a.account.instructionIndex);

                (proposalIx[0].account.instructions).map((item: any, index:number) => (
                    //for (const member of members){
                        ixarr.push({
                            id:index,
                            index:item.account.instructionIndex,
                            ix:item.pubkey,
                            status:item.account.executionStatus,
                            accounts:'',
                            signers:'',
                            data:item.account.instructions[0].data,
                            description:"DA "+item?.account?.instructions[0].info.description,
                            program: new PublicKey(item?.account?.instructions[0].programId).toBase58(),
                            manage:item.account.instructionIndex,
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
                        description = item?.account?.instructions[0].info.description;
                    }
                    //description = item?.account?.instructions[0].info.description + ' > ' + (item?.account?.instructions[0].info?.destinationAta ? findOwnerRecord(item?.account?.instructions[0].info?.destinationAta) : '')
                    
                    ixarr.push({
                        id:index,
                        index:item.account.instructionIndex,
                        ix:item.pubkey,
                        status:item.account.executionStatus,
                        accounts: JSON.stringify(accounts),
                        signers: signers.join('<br/> '),
                        data:item.account.instructions[0].data,
                        description:description,
                        program: new PublicKey(item?.account?.instructions[0].programId).toBase58(),
                        manage:item.account.instructionIndex,
                    })
                })
            }
        }
        setIxRows(ixarr);
    }

    React.useEffect(() => { 
        if (proposalIx){
            createIxTable();
        }
    }, [proposalIx]);

    return (
        <>
        
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
                                    
                                
                                />
                        </div>
                    </div>
                </div>
            }
        </>
    );
}