import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';


import {
  Typography,
  Button,
  Grid,
  Box,
  Table,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  CircularProgress,
} from '@mui/material/';
 
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

import { sendTransactions, prepareTransactions, SequenceType, WalletSigner, getWalletPublicKey } from '../utils/governanceTools/sendTransactions';
import { Signer, Connection, TransactionMessage, PublicKey, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError, TransactionOrVersionedTransaction } from '@solana/wallet-adapter-base';
import { useSnackbar } from 'notistack';

import { 
  PROXY, 
  RPC_CONNECTION,
  TX_RPC_ENDPOINT, 
  GGAPI_STORAGE_POOL, 
  GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';

import GovernanceCreateProposalView from './GovernanceCreateProposal';

import EditIcon from '@mui/icons-material/Edit';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import ApprovalIcon from '@mui/icons-material/Approval';

export function SignOffGovernanceProposal(props: any){
    const cachedGovernance = props.cachedGovernance;
    const isCancelled = props.isCancelled || false;
    const setReload = props?.setReload;
    const proposalAuthor = props.proposalAuthor;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const tokenMap = props.tokenMap;
    const memberMap = props.memberMap;
    const governanceAddress = props.governanceAddress;
    const governanceToken = props.governanceToken;
    const thisitem = props.item;
    const title = props?.title;
    const description = props?.description;
    const state = props?.state;
    const isCouncil = props?.isCouncil;
    const governanceType = props?.governanceType;
    //const [thisitem, setThisItem] = React.useState(props.item);
    const realm = props.realm;
    
    const { publicKey, sendTransaction, signTransaction } = useWallet();

    const [open, setEditPropOpen] = React.useState(false);
    
    const [expanded, setExpanded] = React.useState<string | false>(false);
    const handleChange =
    (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );


    
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


    const handleSignOffIx = async() => {

        //console.log("instruction "+JSON.stringify(instruction));
        //console.log("instructionDetails: "+JSON.stringify(instructionDetails))

        const programId = new PublicKey(realm.owner);
        let instructions: TransactionInstruction[] = [];
        
        const proposalAddress = new PublicKey(editProposalAddress);
        const realmPk = new PublicKey(governanceAddress);
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
        );
        
        let tokenOwnerRecordPk = null;
        for (let member of memberMap){
            if (new PublicKey(member.account.governingTokenOwner).toBase58() === publicKey.toBase58() &&
                new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                tokenOwnerRecordPk = new PublicKey(member.pubkey);
        }

        /*
        const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
            programId,
            realmPk,
            governingTokenMint,
            publicKey,
        );*/
        
        const signatory = publicKey;

        const signatoryRecordAddress = await getSignatoryRecordAddress(
            programId,
            proposalAddress,
            signatory
        )

        const beneficiary = publicKey;
        const governanceAuthority = publicKey;
        
        withSignOffProposal(
            instructions, // Sign Off proposal needs to be executed after inserting instructions hence we add it to insertInstructions
            programId,
            programVersion,
            realmPk,
            new PublicKey(governanceRulesWallet),
            proposalAddress,
            signatory,
            signatoryRecordAddress,
            undefined,
            /*signatoryRecordAddress,
            undefined,
            undefined,
            tokenOwnerRecordPk*/
        );


        
        // with instructions run a transaction and make it rain!!!
        if (instructions && instructions.length > 0){
            const signature = await createAndSendV0TxInline(instructions);
            if (signature){
                enqueueSnackbar(`Signed Off Proposal - ${signature}`,{ variant: 'success' });
                
                if (setReload) 
                    setReload(true);

            } else{
                enqueueSnackbar(`Error`,{ variant: 'error' });
            }
            
            return null;
        }
    }


    const handleSignOff = async() => {
        await handleSignOffIx();
    }



    return (
        <>
            <Tooltip title={<>Click to Sign Off Proposal<br/><br/>WARNING: By signing off, this proposal will no longer be editable and will be in voting status</>}>
                <Button 
                    onClick={handleSignOff}
                    variant='outlined'
                    color='inherit'
                    fullWidth={true}
                    sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                    Sign Off <ApprovalIcon fontSize="small" sx={{ml:1}}/>
                </Button>
            </Tooltip>
        </>
    )
}