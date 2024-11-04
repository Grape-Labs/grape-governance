import { 
    getRealm, 
    getAllProposals, 
    getGovernance, 
    getGovernanceAccounts, 
    getTokenOwnerRecord, 
    getTokenOwnerRecordsByOwner, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    getGovernanceAccount, 
    getAccountTypes, 
    GovernanceAccountType, 
    tryGetRealmConfig, 
    getRealmConfig,
    InstructionData,
    getGovernanceChatMessagesByVoter,
    getTokenOwnerRecordAddress,
    GOVERNANCE_CHAT_PROGRAM_ID,
    getGovernanceChatMessages,
    withPostChatMessage,
    ChatMessageBody,
    ChatMessageBodyType,
} from '@solana/spl-governance';
import { 
    getRealmIndexed,
    getProposalIndexed,
    getProposalNewIndexed,
    getAllProposalsIndexed,
    getGovernanceIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getTokenOwnerRecordsByRealmIndexed,
    getProposalInstructionsIndexed
  } from './api/queries';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { 
    ComputeBudgetProgram,
    PublicKey, 
    TokenAmount, 
    Connection,  
    //createSolanaRpc,      
    Keypair,
    Signer,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js';
import { 
    shortenString, 
    parseMintNaturalAmountFromDecimalAsBN } from '../utils/grapeTools/helpers';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { InstructionMapping } from "../utils/grapeTools/InstructionMapping";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

import {
  Typography,
  Button,
  Grid,
  Box,
  Table,
  Tooltip,
  TextField,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  Chip,
  Backdrop,
  ButtonGroup,
  CircularProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  
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
 
import { GovernanceProposalView } from './GovernanceProposal';

import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close'; // Import the Close icon

import { 
    PROXY, 
    RPC_CONNECTION,
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: theme.palette.grey[theme.palette.mode === 'light' ? 200 : 800],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: theme.palette.mode === 'light' ? '#1a90ff' : '#ffffff',
    },
  }));

const StyledTable = styled(Table)(({ theme }) => ({
    '& .MuiTableCell-root': {
        borderBottom: '1px solid rgba(255,255,255,0.05)'
    },
}));

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

export default function GovernanceDiscussion(props: any){
    const [expandInfo, setExpandInfo] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [comment, setComment] = React.useState('');
    const [showAddComment, setShowAddComment] = React.useState(false);
    const [charCount, setCharCount] = React.useState(160);
    const [discussionMessages, setDiscussionMessages] = React.useState(null);
    const { publicKey, wallet, sendTransaction } = useWallet();

    const proposalPk = props?.proposalAddress;
    const realm = props?.realm;
    const governanceRulesWallet = props?.governanceRulesWallet;
    const governingTokenMint = props?.governingTokenMint;
    const memberMap = props?.memberMap;

    const handleAddCommentToggle = () => {
        setShowAddComment(!showAddComment);
    };

    const handleCommentChange = (event) => {
        const newComment = event.target.value;
        if (newComment.length <= 160) {
            setComment(newComment);
            setCharCount(160 - newComment.length);
        }
    };

    async function createAndSendV0TxInline(txInstructions: TransactionInstruction[], signers?: Keypair[]) {
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
        
        // Add the priority fee instructions to the transaction
        //transaction.add(priorityFeeInstruction, computeUnitLimitInstruction);


        // Step 2 - Generate Transaction Message
        const messageV0 = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: allInstructions
        }).compileToV0Message();
        console.log("   ✅ - Compiled transaction message");
        const transaction = new VersionedTransaction(messageV0);
        transaction.sign(signers);

        //const transaction = new Transaction();
        
            
        
            
            // Sign the transaction using the signers
            /*
            if (signers.length > 0) {
                const latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
                transaction.recentBlockhash = latestBlockhash.blockhash;
                transaction.feePayer = publicKey;
                transaction.partialSign(...signers);  // Sign the transaction with the additional signers
            }
            */
            
            //console.log("TX: "+JSON.stringify(transaction))
            


        console.log("   ✅ - Transaction Signed");
        
        const simulationResult = await RPC_CONNECTION.simulateTransaction(transaction);
        console.log("🔍 - Simulation result:", simulationResult);

        if (simulationResult.value.err) {
            console.error("❌ - Simulation failed with error:", simulationResult.value.err);
            throw new Error(`Simulation error: ${simulationResult.value.err}`);
        } else{
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
            try{
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
            }catch(e){
                enqueueSnackbar(`Transaction Error Exceeded Blockhash`,{ variant: 'error' });
                throw new Error("   ❌ - Transaction not confirmed.") 
            }
        }
        
    }

    const handleSubmitComment = async() => {
        
        const body = new ChatMessageBody({
            type: ChatMessageBodyType.Text,
            value: comment,
        });

        const governanceAuthority = publicKey;
        const payer = publicKey;

        const replyTo = null;
        const signers: Keypair[] = []
        const instructions: TransactionInstruction[] = []

        const programId = new PublicKey(realm?.owner);

        let tokenOwnerRecordPk = null;
    
        //console.log("governingTokenMint: "+JSON.stringify(governingTokenMint));

        for (let member of memberMap){
            if (new PublicKey(member.account.governingTokenOwner).toBase58() === publicKey.toBase58() &&
                new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                tokenOwnerRecordPk = new PublicKey(member.pubkey);
        }

        if (!tokenOwnerRecordPk){
            tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
                programId,
                realm.pubkey,
                governingTokenMint,
                publicKey,
            );
        }
          //if (tokenOwnerRecordPk)
          //  console.log("Using getTokenOwnerRecordAddress: "+tokenOwnerRecordPk.toBase58());
        
          /*
            console.log("programId: "+JSON.stringify(programId));
            console.log("realm: "+JSON.stringify(realm));
            console.log("tokenOwnerRecordPk: "+JSON.stringify(tokenOwnerRecordPk));
            console.log("governanceRulesWallet: "+JSON.stringify(governanceRulesWallet));
            console.log("proposalPk: "+JSON.stringify(proposalPk));
            console.log("governanceAuthority: "+JSON.stringify(governanceAuthority));
            console.log("body: "+JSON.stringify(body));
            */
        const ix = await withPostChatMessage(
            instructions,
            signers,
            GOVERNANCE_CHAT_PROGRAM_ID,
            programId,
            realm.pubkey,
            governanceRulesWallet,
            proposalPk,
            tokenOwnerRecordPk,
            governanceAuthority,
            payer,
            replyTo,
            body,
            null,//plugin?.voterWeightPk
        )

        console.log("signers:"+JSON.stringify(signers));
        
        // send Ix here
        if (instructions){
            if (instructions && instructions.length > 0){
                const signature = await createAndSendV0TxInline(instructions, signers);
                if (signature){
                    enqueueSnackbar(`Transaction completed - ${signature}`,{ variant: 'success' });
                    //pTransaction.add(lookupTableInst);
                    //pTransaction.feePayer = publicKey;
                    
                    console.log("Comment submitted: ", comment);
                    // Clear the input after submission
                    setComment('');
                    setCharCount(160);
                    setShowAddComment(false); // Close the comment box after submitting

                    if (!expandInfo)
                        setExpandInfo(true);
                    else
                        getGovernanceDiscussion();

                } else{
                    enqueueSnackbar(`Error`,{ variant: 'error' });
                }
                
                return null;
            }


        }
        
    };

    const toggleInfoExpand = () => {
        setExpandInfo(!expandInfo)
    };

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const convertHexToDateTime = (hex) => {
        // Convert hex to decimal
        const decimal = parseInt(hex, 16);
        
        // Convert to milliseconds (if your timestamp is in seconds, multiply by 1000)
        const date = new Date(decimal * 1000); // Adjust multiplication if needed
        
        return date;
    }

    const getGovernanceDiscussion = async() => {
        
        setLoading(true);

        const messages = await getGovernanceChatMessages(
            RPC_CONNECTION,
            GOVERNANCE_CHAT_PROGRAM_ID,
            proposalPk
        );

        //console.log("Messages Loaded: "+JSON.stringify(messages));

        setDiscussionMessages(messages);

        setLoading(false);
    
    }

    React.useEffect(() => {
        if (expandInfo){
            getGovernanceDiscussion();
        }
    }, [expandInfo]);


    return (
        <>
            <Grid item md={12} sm={12} xs={12} sx={{ mt: 2 }}>
                <Box
                    sx={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '17px',
                        p: 2,
                        ml: window.matchMedia('(min-width: 900px)').matches ? 1 : 0,
                    }}
                >
                    <Grid container>
                        <Grid item xs={12}>
                            <Box sx={{ mb: 2 }}>
                                <Typography gutterBottom variant="h6" component="div" sx={{ ml: 1 }}>
                                    Discussion
                                </Typography>
                            </Box>

                            <Box sx={{ mx: 1 }}>
                                {expandInfo && (
                                    <>
                                        {loading ? (
                                            <Grid 
                                                xs={12}
                                                sx={{ textAlign: 'center' }}
                                            >
                                                <CircularProgress color="inherit" />
                                            </Grid>
                                        ) : (
                                            <>
                                                {discussionMessages && discussionMessages
                                                .sort((a: any, b: any) => {
                                                    // Convert postedAt to a number and sort in descending order
                                                    const dateA = Number(a.account.postedAt);
                                                    const dateB = Number(b.account.postedAt);
                                                    return dateB - dateA; // Descending order
                                                })
                                                .map((message: any, index: number) => {
                                                    const postedAtDate = moment.unix(Number(message.account.postedAt));//convertHexToDateTime(message.account.postedAt);
                                                    const formattedDate = moment(postedAtDate).format('MMMM Do YYYY, h:mm:ss a');
                                                    const timeFromNow = moment(postedAtDate).fromNow();

                                                    return (
                                                        <Box
                                                            key={index}
                                                            sx={{
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                backgroundColor: index % 2 === 0 ? 'rgba(241, 241, 241, 0.1)' : 'rgba(224, 224, 224, 0.1)', // 80% transparency
                                                                borderRadius: '12px',
                                                                p: 2,
                                                                mb: 2,
                                                                boxShadow: 1,  // Adds a subtle shadow
                                                            }}
                                                        >
                                                            <Typography variant="body1" component="div" sx={{ mb: 1 }}>
                                                                {message.account.body.value}
                                                            </Typography>

                                                            <Grid container justifyContent="space-between" alignItems="center">
                                                                <Grid item>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {message.account.author.toBase58()} {/* Author */}
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {formattedDate} ({timeFromNow}) {/* Date and "time from now" */}
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>
                                                        </Box>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </>
                                )}
                            </Box>

                            {/* Add Comment Section */}
                            {showAddComment && (
                                <Box sx={{ mx: 1, mt: 2, p: 2, background: 'rgba(255, 255, 255, 0.1)', borderRadius: '10px' }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        rows={3}
                                        value={comment}
                                        onChange={handleCommentChange}
                                        variant="outlined"
                                        placeholder="Add your comment (max 160 characters)"
                                    />
                                    <Typography variant="caption" color="text.secondary">
                                        {charCount} characters left
                                    </Typography>
                                    <Box sx={{ mt: 2 }}>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleSubmitComment}
                                            disabled={comment.length === 0}
                                            sx={{
                                                borderRadius: '17px',
                                            }}
                                        >
                                            Submit Comment
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                            {/* Action Buttons Section: Add Comment on the Left, Show Comments on the Right */}
                                <Box sx={{ mx: 1, mt: 3 }}>
                                    <Grid container alignItems="center" justifyContent="space-between">
                                        
                                        <Grid item>
                                            {publicKey &&
                                            <Button
                                                size="small"
                                                color="inherit"
                                                variant="outlined"
                                                onClick={handleAddCommentToggle}
                                                sx={{
                                                    borderRadius: '17px',
                                                    textTransform: 'none',
                                                }}
                                                startIcon={showAddComment ? <CloseIcon /> : <AddIcon />}
                                            >
                                                {showAddComment ? 'Cancel' : 'Add Comment'}
                                            </Button>
                                            }
                                        </Grid>
                                        
                                        <Grid item>
                                            <Button
                                                size="small"
                                                color="inherit"
                                                variant="outlined"
                                                onClick={toggleInfoExpand}
                                                sx={{
                                                    borderRadius: '17px',
                                                    textTransform: 'none',
                                                }}
                                            >
                                                {expandInfo ? <><ExpandLess sx={{ mr: 1 }} /> Less</> : <><ExpandMoreIcon sx={{ mr: 1 }} /> Show Comments</>}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Grid>

        </>
    )
}