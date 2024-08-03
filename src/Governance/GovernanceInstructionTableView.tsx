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
    
    const ixDetails = props.ixDetails;
    const [ixRows, setIxRows] = React.useState(null);
    const ixColumns: GridColDef[] = [
        { field: 'id', headerName: 'ID', hide: true},
        { field: 'index', headerName: 'Index', hide: false},
        { field: 'ix', headerName: 'IX', minWidth: 120, hide: false},
        { field: 'status', headerName: 'Status', minWidth: 75, hide: false},
        { field: 'accounts', headerName: 'Accounts', minWidth: 70, hide: true},
        { field: 'signers', headerName: 'Signers', minWidth: 70, hide: true},
        { field: 'data', headerName: 'Data', hide: true},
        { field: 'description', headerName: 'Description', minWidth: 500, resizable:true, hide: false},
        { field: 'program', headerName: 'Program', minWidth: 120, resizable:true, hide: false},
        { field: 'manage', headerName: 'Manage', hide: false}, // allow to delete or execute ix
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
                proposalIx[0].account.instructions.sort((a, b) => a.account.instructionIndex - b.account.instructionIndex);

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
                            manage:'',
                        })
                ));
            }
        } else{
            if (proposalIx){

                // Extract signers
                
                proposalIx.sort((a: any, b: any) => a.account.instructionIndex - b.account.instructionIndex);
            
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
                        manage:'',
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