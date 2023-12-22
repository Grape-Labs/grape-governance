import { 
    getRealm, 
    getProposal,
    getAllProposals, 
    getGovernance, 
    getGovernanceAccounts, 
    getGovernanceChatMessages, 
    getTokenOwnerRecord, 
    getTokenOwnerRecordsByOwner, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    getGovernanceAccount, 
    getAccountTypes, 
    ProposalTransaction,
    pubkeyFilter,
    GovernanceAccountType, 
    tryGetRealmConfig, 
    getRealmConfig,
    InstructionData  } from '@solana/spl-governance';
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
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction, TransactionVersion } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError, TransactionOrVersionedTransaction } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { InstructionMapping } from "../utils/grapeTools/InstructionMapping";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

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
 
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

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
    TX_RPC_ENDPOINT, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'

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

/// Returns explorer inspector URL for the given transaction
async function getExplorerInspectorUrl(
    connection: Connection,
    transaction: TransactionOrVersionedTransaction<
      ReadonlySet<TransactionVersion>
    >
  ) {
    const SIGNATURE_LENGTH = 64
    
    const explorerUrl = new URL(
      getExplorerUrl('https://api.mainnet.solana.com', 'inspector', 'tx')
    )
  
    const signatures = transaction.signatures?.map((s) =>
      base58.encode(s.signature ?? Buffer.alloc(SIGNATURE_LENGTH))
    )
    explorerUrl.searchParams.append('signatures', JSON.stringify(signatures))
  
    const message =
      transaction instanceof Transaction
        ? transaction.serializeMessage().toString('base64')
        : Buffer.from(transaction.message.serialize()).toString('base64')
    explorerUrl.searchParams.append('message', message)
        
    /*
    if (connection.cluster === 'devnet') {
      explorerUrl.searchParams.append('cluster', 'devnet')
    }*/
  
    return explorerUrl.toString()
}

export function InstructionView(props: any) {
    const index = props.index;
    const instructionOwnerRecord = props.instructionOwnerRecord;
    const instructionOwnerRecordATA = props.instructionOwnerRecordATA;
    const instruction = props.instruction;
    const instructionTransferDetails = props.instructionTransferDetails;
    const instructionDetails = instruction.account?.instructions?.[0] || instruction.account?.instruction || instruction;
    const setInstructionTransferDetails = props.setInstructionTransferDetails;
    const memberMap = props.memberMap;
    const tokenMap = props.tokenMap;
    const cachedTokenMeta = props.cachedTokenMeta;
    const [iVLoading, setIVLoading] = React.useState(false);
    const { publicKey } = useWallet();
    
    const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

    if (instructionDetails){
        const typeOfInstruction = instructionDetails?.data[0];
        //console.log("instructionDetails "+JSON.stringify(instructionDetails))
        const programId = new PublicKey(instructionDetails?.programId).toBase58();
        console.log("programId: "+programId);
        console.log("typeOfInstruction: "+typeOfInstruction)
        const instructionInfo = InstructionMapping?.[programId]?.[typeOfInstruction];
        // for ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL it will return no type as it is a single create ata account

        const OwnerRecord = (props:any) => {
            const pubkey = props.pubkey;
            const [ownerRecord, setOwnerRecord] = React.useState(null);
            
            const fetchOwnerRecord = () => {
                //console.log("instructionOwnerRecord "+JSON.stringify(instructionOwnerRecord))
                //console.log("instructionOwnerRecordATA "+JSON.stringify(instructionOwnerRecordATA))
                var index = 0;
                if (instructionOwnerRecordATA){
                    for (var item of instructionOwnerRecordATA){
                        if (new PublicKey(item).toBase58() === new PublicKey(pubkey).toBase58()){
                            if (instructionOwnerRecord[index]?.data?.parsed?.info){
                                setOwnerRecord(instructionOwnerRecord[index].data.parsed.info);
                                //console.log("instructionOwnerRecord[index] "+JSON.stringify(instructionOwnerRecord[index]))
                            }
                        }
                        index++;
                    }
                }
            }

            React.useEffect(() => { 
                if ((!ownerRecord)&&(pubkey)){
                    fetchOwnerRecord()
                }
            }, [pubkey, instructionOwnerRecord]);

            return (
                <>
                    {ownerRecord && 
                        <>
                            {ownerRecord?.owner ?
                                <ExplorerView grapeArtProfile={true} showSolanaProfile={true} memberMap={memberMap} address={new PublicKey(ownerRecord.owner).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>
                            :
                                <Typography variant='caption'>*Raw Record: <br/>
                                    <Grid item xs zeroMinWidth>
                                        <Typography noWrap sx={{fontSize:'10px'}}>
                                            <CustomTextarea
                                                minRows={2}
                                                value={JSON.stringify(ownerRecord)}
                                                readOnly
                                            /><br/>
                                        </Typography>
                                    </Grid>
                                </Typography>
                            }

                            {(ownerRecord?.tokenAmount?.amount && +ownerRecord.tokenAmount.amount > 0) ? 
                                <Grid> 
                                    <Tooltip title="Wallet Balance">
                                        <Button color='inherit'
                                            sx={{borderRadius:'17px'}}
                                        >
                                        <AccountBalanceWalletIcon fontSize='small' /> &nbsp;
                                        {getFormattedNumberToLocale(formatAmount(+(ownerRecord.tokenAmount.amount/Math.pow(10, (ownerRecord.tokenAmount?.decimals || 0))).toFixed(0)))}
                                        </Button>
                                    </Tooltip>
                                </Grid>
                            :<></>
                            }
                        </>
                    }
                </>
            )
        }

        const getObjectByMint = (mintValue:string) => {
            //if (cachedTokenMeta)
            //    console.log("cachedTokenMeta: "+JSON.stringify(cachedTokenMeta));

            if (cachedTokenMeta)
                return cachedTokenMeta.find((item:any) => item.mint === mintValue);
            else
                return null;
        };

        const getMetaplexMetadata = async(mint:String) => {
            
            const mint_address = new PublicKey(mint)
            const [pda, bump] = await PublicKey.findProgramAddress([
                Buffer.from("metadata"),
                METAPLEX_PROGRAM_ID.toBuffer(),
                new PublicKey(mint_address).toBuffer(),
            ], METAPLEX_PROGRAM_ID)
            const meta_response = await RPC_CONNECTION.getAccountInfo(pda);
            //console.log("meta_response: "+JSON.stringify(meta_response));

            if (meta_response){
                const meta_final = decodeMetadata(meta_response.data);
                
                //console.log("final: "+JSON.stringify(meta_final))

                const file_metadata = meta_final.data.uri;

                if (file_metadata && file_metadata.length > 0){
                    const file_metadata_url = new URL(file_metadata);

                    const IPFS = 'https://ipfs.io';
                    const IPFS_2 = "https://nftstorage.link/ipfs";
                    /*
                    if (file_metadata.startsWith(IPFS) || file_metadata.startsWith(IPFS_2)){
                        file_metadata = CLOUDFLARE_IPFS_CDN+file_metadata_url.pathname;
                    }*/
                    
                    //setCollectionRaw({meta_final,meta_response});
                    try{
                        const metadata = await window.fetch(file_metadata)
                        .then(
                            (res: any) => res.json())
                        .catch((error) => {
                            // Handle any errors that occur during the fetch or parsing JSON
                            console.error("Error fetching data:", error);
                            });
                        
                        if (metadata && metadata?.image){

                            return {
                                mint: mint,
                                logo: metadata.image,
                                name: meta_final.data.name
                            }
                        }
                    }catch(err){
                        console.log("ERR: ",err);
                    }
                }
            }
            return null;
        }

        const InstructionMemoRecord = (props:any) => {

            return (
                <>
                    {JSON.stringify(instructionInfo)}
                </>
            );

        }


        const InstructionTransferRecord = (props:any) => {
            //const pubkey = props.pubkey;
            const [instructionRecord, setInstructionRecord] = React.useState(null);
            const [iLoading, setILoading] = React.useState(false);

            const fetchTokenMetadata = async() => {
                setILoading(true);
                let destinationAta = null;
                if (instruction.account.instructions[0].accounts.length > 0){
                    if (!instruction.account.instructions[0].isWritable)
                        destinationAta = instruction.account.instructions[0].accounts[1].pubkey;
                }

                let name = null;
                let logo = null;

                if (instruction.account.instructions[0]?.gai.value.data.parsed.info.mint){
                    if (tokenMap.get(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)){
                        name = tokenMap.get(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.symbol;
                        logo = tokenMap.get(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.logoURI;
                    } else{
                        // add caching support so we do not make this call numerous times
                        const cachedMint = getObjectByMint(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint);
                        
                        //console.log("cachedTokenMeta: ("+cachedMint+") "+JSON.stringify(cachedTokenMeta));
                        
                        if (! cachedMint && !iLoading){

                            /*
                            const gmm = await getMetaplexMetadata(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint);
                            if (gmm){
                                name = gmm.name;
                                logo = gmm.logo;
                            }
                            

                            const tokenMeta ={
                                mint: instruction.account.instructions[0]?.gai.value.data.parsed.info.mint,
                                name: gmm.name,
                                logo: gmm.logo
                            }

                            if (cachedTokenMeta && cachedTokenMeta.length > 0)
                                setCachedTokenMeta((prevTokenMeta:any) => [...prevTokenMeta, tokenMeta]);
                            else
                                setCachedTokenMeta([tokenMeta])
                            
                            console.log("fin set "+instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)
                            */
                        } else{
                            name = cachedMint.name;
                            logo = cachedMint.logo;
                        }
                    }
                }

                const amountBN = new BN(instructionDetails?.data?.slice(1), 'le');
                const decimals = instruction.account.instructions[0]?.gai.value?.data.parsed.info.tokenAmount?.decimals || 0;
                const divisor = new BN(10).pow(new BN(decimals));

                const amount = amountBN.div(divisor).toString(); 
                
                const newObject = {
                    pubkey: instruction.account.instructions[0].accounts[0].pubkey,
                    mint: instruction.account.instructions[0]?.gai.value.data.parsed.info.mint,
                    name: name,
                    logoURI: logo,
                    amount: amount,
                    destinationAta: destinationAta
                };

                const hasInstruction = instructionTransferDetails.some(obj => obj.pubkey === instruction.account.instructions[0].accounts[0].pubkey);

                if (!hasInstruction)
                    setInstructionTransferDetails((prevArray) => [...prevArray, newObject]);

                setILoading(false);
            }

            const fetchInstructionRecord = async() => {
                setILoading(true);
                
                //console.log("instruction.account.instructions[0]?.info "+JSON.stringify(instruction))
                if (instruction.account.instructions[0]?.info && instruction.account.instructions[0]?.gai){
                    setInstructionRecord(instruction.account.instructions[0]?.gai.value);
                }    
                setILoading(false);
            }

            /*
            React.useEffect(() => { 
                if (instructionRecord){
                    fetchTokenMetadata();
                }
            }, [instructionRecord]);
            */

            React.useEffect(() => { 
                if (!iLoading && !instructionRecord && instruction.pubkey && instructionDetails) {
                    fetchInstructionRecord();
                }
                if (!iLoading && instructionRecord){
                    fetchTokenMetadata();
                }
            }, [iLoading, instructionRecord, instruction.pubkey, instructionDetails]);

            return (
                <>
                {instructionRecord && 
                    <ExplorerView 
                        showSolanaProfile={false}
                        address={instructionRecord.data.parsed.info.mint}
                        type='address'
                        useLogo={getObjectByMint(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.logo || tokenMap.get(instructionRecord.data.parsed.info.mint)?.logoURI}
                        title={`${new BN(instructionDetails?.data?.slice(1), 'le')
                            .div(new BN(10).pow(new BN(instructionRecord.data.parsed.info.tokenAmount?.decimals || 0)))
                            .toString()
                            .toLocaleString()} 
                            ${getObjectByMint(instruction.account.instructions[0]?.gai.value.data.parsed.info.mint)?.name || tokenMap.get(instructionRecord.data.parsed.info.mint)?.symbol || (instructionRecord.data.parsed.info.mint && trimAddress(instructionRecord.data.parsed.info.mint)) || 'Explore'}
                        `}
                        hideTitle={false}
                        style='text'
                        color='white'
                        fontSize='12px'
                        showTokenMetadata={true}
                    />
                }
                </>
            );
        }

        const exploreTxItem = async(instructionTx:Transaction) => {
            const inspectUrl = await getExplorerInspectorUrl(RPC_CONNECTION, instructionTx)
            window.open(inspectUrl, '_blank')   
        }
        
        React.useEffect(() => { 
            
        }, []);

        if (!iVLoading){
            return(
                <>{index > 0 && <Divider />}
                    
                    <TimelineItem>
                        
                        <TimelineOppositeContent
                            sx={{ m: 'auto 0' }}
                            align="right"
                            variant="body2"
                            color="text.secondary"
                            >

                            <Typography variant="subtitle1">
                                Instruction {index+1} 
                                {/*<ExplorerView address={new PublicKey(instruction.pubkey).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>*/}
                            </Typography>
                            <Typography>
                                {instructionInfo?.name || <ExplorerView address={new PublicKey(instructionDetails.programId).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px'/>}
                                
                                {instructionInfo?.name === 'Token Transfer' &&
                                    <> 
                                    <br/>
                                        <InstructionTransferRecord />
                                    </>
                                }
                            </Typography>
                            

                            
                        </TimelineOppositeContent>
                    
                        <TimelineSeparator>
                        <TimelineConnector />
                        <TimelineDot>
                            <CodeIcon />
                        </TimelineDot>
                        <TimelineConnector />
                        </TimelineSeparator>
                        <TimelineContent sx={{ py: '12px', px: 2 }}>
                        
                        <Typography variant="h6" component="span" color="#999">
                            Instruction Accounts
                        </Typography>
                        <Typography>

                            {instructionDetails?.accounts && (instructionDetails.accounts).map((item: any, iindex:number) => (
                                <>
                                    {item.isSigner ? 
                                        <Grid textAlign='right'>
                                            <Typography variant="caption">
                                                Signer Account {iindex+1}: &nbsp; 
                                                <ExplorerView showSolanaProfile={false} address={new PublicKey(item.pubkey).toBase58()} type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                            </Typography>
                                        </Grid>
                                    :
                                    <>
                                        <OwnerRecord pubkey={item.pubkey} />
                                        
                                        <Typography variant="caption">
                                            
                                            Account {iindex+1}: &nbsp;
                                            {item.isWritable && <>
                                                <Tooltip title={item.isWritable ? `Writable` : `Writable: false`}>
                                                    <IconButton color='inherit' size='small'
                                                        sx={{borderRadius:'17px',textTransform:'none'}}
                                                    >
                                                        {item.isWritable ? 
                                                            <EditIcon sx={{fontSize:'12px'}} color='warning' />
                                                            :
                                                            <EditIcon sx={{fontSize:'12px'}} color='disabled' />
                                                        }
                                                    </IconButton>
                                                </Tooltip>
                                            </>}

                                            <ExplorerView showSolanaProfile={false} address={new PublicKey(item.pubkey).toBase58()} type='address' shorten={0} hideTitle={false} style='text' color='white' fontSize='12px'/>
                                            
                                        </Typography>
                                        <br/><br/>
                                    </>
                                    }
                                </>
                            ))}

                        </Typography>
                        
                        {instructionDetails?.info?.description &&   
                            <Grid container sx={{mt:1}}>
                                <Grid item>        
                                    <Typography variant="h6" component="span" color="#999">
                                        Description
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    {instructionDetails.info.description}
                                </Grid>
                            </Grid>
                        }

                        {instructionDetails.info?.decodedIx && 
                            <Grid container sx={{mt:1}}>
                                <Grid item>
                                    <Typography variant="h6" component="span" color="#999">
                                        Decoded
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Grid container>
                                        <Grid item xs>
                                            <CustomTextarea
                                                minRows={4}
                                                value={JSON.stringify(instructionDetails.info.decodedIx)}
                                                readOnly
                                            />
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </Grid>
                        }

                        {instructionDetails.info?.data ?
                            <Grid container sx={{mt:1}}>
                                <Grid item>
                                    <Typography variant="h6" component="span" color="#999">
                                        Data
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Grid container>
                                        <Grid item xs>
                                            <CustomTextarea
                                                minRows={4}
                                                value={JSON.stringify(instructionDetails.info.data)}
                                                readOnly
                                            />
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </Grid>
                        :
                        <>
                            {instructionDetails?.data && 
                                <Grid container sx={{mt:1}}>
                                    <Grid item>
                                        <Typography variant="h6" component="span" color="#999">
                                            Data
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Grid container>
                                            <Grid item xs>
                                                <CustomTextarea
                                                    minRows={4}
                                                    value={JSON.stringify(instructionDetails.data)}
                                                    readOnly
                                                />
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                </Grid>
                            }
                        </>
                        }

                        {/*
                        <IconButton 
                            onClick={e => exploreTxItem(instructionDetails)}
                            edge="end" 
                            aria-label="explore"
                            disabled={!publicKey}
                            >
                            <DeveloperModeIcon color="primary" />
                        </IconButton>
                        */}
                        </TimelineContent>
                    </TimelineItem>
                </>
            );
        } else{
            return <></>
        } 
    } else{
        return <></>
    }
}