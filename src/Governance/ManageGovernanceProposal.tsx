import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';

import {
  Typography,
  Button,
  Grid,
  Box,
  Table,
  TextField,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  DialogContent,
  CircularProgress,
  DialogActions,
  DialogContentText,
} from '@mui/material/';
 
import { 
    getRealms, 
    getGovernance,
    getVoteRecordsByVoter, 
    getTokenOwnerRecordAddress,
    getTokenOwnerRecordForRealm,  
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
    SignatoryRecord,
    withSignOffProposal,
    withAddSignatory,
    withCancelProposal,
    withRefundProposalDeposit,
    withFinalizeVote,
    getSignatoryRecordAddress,
    getAllProposals,
    getProposal,
    MultiChoiceType,
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

import { sendTransactions, prepareTransactions, SequenceType, WalletSigner, getWalletPublicKey } from '../utils/governanceTools/sendTransactions';
import { Signer, Connection, MemcmpFilter, TransactionMessage, PublicKey, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError, TransactionOrVersionedTransaction } from '@solana/wallet-adapter-base';
import { useSnackbar } from 'notistack';

import { 
  PROXY, 
  RPC_CONNECTION, 
  GGAPI_STORAGE_POOL, 
  GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';

import GovernanceCreateProposalView from './GovernanceCreateProposal';

import CancelIcon from '@mui/icons-material/Cancel';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import EditIcon from '@mui/icons-material/Edit';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import ApprovalIcon from '@mui/icons-material/Approval';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { AlreadyInitializedError } from '@metaplex-foundation/mpl-token-metadata';

export const getAllProposalSignatories = async(programId:PublicKey, proposalAddress:PublicKey) => {

    const memcmpFilter = {
        memcmp: {
            offset: 1,
            bytes: proposalAddress.toBase58(),
        },
    };

    const filters: MemcmpFilter[] = [
        memcmpFilter,
    ];


    //const memCmpFltr = new MemcmpFilter();
    //const AccountType extends GovernanceAccount;
    const filter = pubkeyFilter(1, proposalAddress)
    
    const signatoryResults = await getGovernanceAccounts(
        RPC_CONNECTION,
        programId,
        SignatoryRecord,
        [filter]
    );

    console.log("signatoryResults: "+JSON.stringify(signatoryResults));
    
    /*
    const programAccounts = await RPC_CONNECTION.getParsedProgramAccounts( //.getProgramAccounts(
        programId, {
            filters: filters,
        });
    
    const plt = new Array();
    */
    /*
    const proposalSignatories = new Array();
    for (var item of signatoryResults){
        proposalSignatories.push(item.pubkey);
    }*/

    //console.log("programAccounts: "+JSON.stringify(programAccounts));
    // consider mapping signatories with records
    return signatoryResults;
}

export const getAllProposalSignatoryRecords = async(programId:PublicKey, proposalAddress:PublicKey, realmPk:PublicKey) => {
    
    console.log("Start getAllProposalSignatories");

    const signatories = await getAllProposalSignatories(programId, proposalAddress);
    
    console.log("End getAllProposalSignatories");
    return signatories;

    //const memberMap = await getAllTokenOwnerRecordsIndexed(realmPk.toBase58());
    /*
    console.log("memberMap: "+JSON.stringify(memberMap))
    console.log("signatories: "+JSON.stringify(signatories))
    const signatoryMap = new Array();
    //for (let member of memberMap){
        for (let signatory of signatories){

            const signatoryRecordAddress = await getSignatoryRecordAddress(
                programId,
                proposalAddress,
                new PublicKey(signatory)
            )

            if (signatoryRecordAddress){
                console.log("signatoryRecordAddress: "+JSON.stringify(signatoryRecordAddress));
            }
        }
    //}


    return signatoryMap;
    */
}

export function ManageGovernanceProposal(props: any){
    const mode = props.mode;
    const cachedGovernance = props.cachedGovernance;
    const isCancelled = props.isCancelled || false;
    const setReload = props?.setReload;
    const proposal = props?.proposal;
    const proposalAuthor = props.proposalAuthor;
    const governanceLookup = props.governanceLookup;
    const governanceRulesWallet = props.governanceRulesWallet;
    const editProposalAddress = props.editProposalAddress;
    const governingTokenMint = props.governingTokenMint;
    const proposalInstructions = props?.proposalInstructions;
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
    
    const [openSignerPrompt, setOpenSignerPrompt] = React.useState(false);
    const [signer, setSigner] = React.useState(null);
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
    
    async function createAndSendV0TxInline(txInstructions: TransactionInstruction[]) {
        // Step 1 - Fetch Latest Blockhash
        let latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('confirmed');
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


    const handleFinalizeIx = async() => {
        

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
        
        const signatory = publicKey;

        const signatoryRecordAddress = await getSignatoryRecordAddress(
            programId,
            proposalAddress,
            signatory
        )

        const beneficiary = publicKey;
        const governanceAuthority = publicKey;
        
        await withFinalizeVote(
            instructions, // Sign Off proposal needs to be executed after inserting instructions hence we add it to insertInstructions
            programId,
            programVersion,
            realmPk,
            new PublicKey(governanceRulesWallet),
            proposalAddress,
            proposalAuthor,
            governingTokenMint,
            //signatory,
            //signatoryRecordAddress,
            undefined, // do we need prop author?
            /*signatoryRecordAddress,
            undefined,
            undefined,
            tokenOwnerRecordPk*/
        );

        // with instructions run a transaction and make it rain!!!
        if (instructions && instructions.length > 0){
            const signature = await createAndSendV0TxInline(instructions);
            if (signature){
                enqueueSnackbar(`Finalized Proposal - ${signature}`,{ variant: 'success' });
                
                if (setReload) 
                    setReload(true);

            } else{
                enqueueSnackbar(`Error`,{ variant: 'error' });
            }
            
            return null;
        }
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
        
        await withSignOffProposal(
            instructions, // Sign Off proposal needs to be executed after inserting instructions hence we add it to insertInstructions
            programId,
            programVersion,
            realmPk,
            new PublicKey(governanceRulesWallet),
            proposalAddress,
            signatory,
            signatoryRecordAddress,
            undefined, // do we need prop author?
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

    const handleFinalize = async() => {
        await handleFinalizeIx();
    }
    
    const handleAddSignatoryIx = async() => {

        console.log("proposal: "+JSON.stringify(proposal));
        
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
        let newTokenOwnerRecordPk = null;
        for (let member of memberMap){
            if (new PublicKey(member.account.governingTokenOwner).toBase58() === new PublicKey(signer).toBase58() &&
                new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                newTokenOwnerRecordPk = new PublicKey(member.pubkey);
        }*/

        console.log("new signatory address: "+signer)

        /*
        const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
            programId,
            realmPk,
            governingTokenMint,
            publicKey,
        );*/
        
        
        //const filter = pubkeyFilter(1, proposalAddress)
        
        const signatories = await getAllProposalSignatories(programId, proposalAddress);
        console.log("All Signatories "+JSON.stringify(signatories));
        
        const signatory = publicKey;
        
        const signatoryRecordAddress = await getSignatoryRecordAddress(
            programId,
            proposalAddress,
            signatory
        )
        
        const beneficiary = publicKey;
        const governanceAuthority = publicKey;
        const payer = publicKey;
        
        //alert("tokenOwnerRecordPk: "+JSON.stringify(tokenOwnerRecordPk))
        if (tokenOwnerRecordPk){
            console.log("programId: "+programId.toBase58());
            console.log("realmPk: "+realmPk.toBase58());
            console.log("governingTokenMint: "+governingTokenMint.toBase58());
            console.log("payer: "+payer.toBase58());
            console.log("tokenOwnerRecordPk: "+tokenOwnerRecordPk.toBase58())
            console.log("programVersion: "+programVersion)
            console.log("governanceAuthority: "+governanceAuthority.toBase58())
            //console.log("newTokenOwnerRecordPk: "+newTokenOwnerRecordPk.toBase58())
            console.log("new signer: "+signer)
            console.log("signatoryTokenOwnerRecordPk: "+signatoryRecordAddress.toBase58())
            
            await withAddSignatory(
                instructions,
                programId,
                programVersion,
                proposalAddress,
                tokenOwnerRecordPk,//tokenOwnerRecordPk,//new PublicKey(newAuthor),//tokenOwnerRecordPk,//new PublicKey(newAuthor),
                new PublicKey(governanceAuthority),//governanceAuthority,
                new PublicKey(signer),//signatoryRecordAddress,
                payer
            );    
            
            // with instructions run a transaction and make it rain!!!
            if (instructions && instructions.length > 0){
                const signature = await createAndSendV0TxInline(instructions);
                if (signature){
                    enqueueSnackbar(`Added signatory - ${signature}`,{ variant: 'success' });
                    
                    if (setReload) 
                        setReload(true);

                } else{
                    enqueueSnackbar(`Error`,{ variant: 'error' });
                }
                
                return null;
            }
        } else{
            enqueueSnackbar(`Error: Token Owner Record does not exist`,{ variant: 'error' });
        }
    }

    const handleCancelProposal = async() => {
        await handleCancelProposalIx();
    }

    const getProposalDepositPk = (
        proposal: PublicKey,
        proposalOwnerWallet: PublicKey,
        programId: PublicKey
      ) => {
        const [proposalDeposit] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('proposal-deposit'),
            proposal.toBuffer(),
            proposalOwnerWallet.toBuffer(),
          ],
          programId
        )
        return proposalDeposit
    }

    const handleCancelProposalIx = async() => {

        console.log("proposal: "+JSON.stringify(proposal));
        
        // check if proposal has any active instructions
        // if active instructions prompt for the user to remove those prior to cancellation to claim back rent
        let proceed = true;
        if (proposalInstructions && proposalInstructions.length > 0){
            console.log("prop ix: "+JSON.stringify(proposalInstructions));
            if (proposalInstructions[0].account.instructions.length > 0){
                const userConfirmed = window.confirm("This proposal has "+proposalInstructions[0].account.instructions.length+" instruction(s), did you know that you can claim back this rent?\n\n\nPress OK if you would like cancel this proposal without removing the instruction(s)\n\nPress Cancel to close this dialog, then expand the instructions and proceed to cancel each instructions to claim back rent, then proceed to cancel this proposal");
                if (!userConfirmed)
                    proceed = false;
            }
        }

        if (proceed){
            const programId = new PublicKey(realm.owner);
            
            const proposalAddress = new PublicKey(editProposalAddress);
            const realmPk = new PublicKey(governanceAddress);
            const programVersion = await getGovernanceProgramVersion(
                RPC_CONNECTION,
                programId,
            );
            
            /*
            let tokenOwnerRecordPk = null;
            for (let member of memberMap){
                if (new PublicKey(member.account.governingTokenOwner).toBase58() === publicKey.toBase58() &&
                    new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                    tokenOwnerRecordPk = new PublicKey(member.pubkey);
            }

            
            let newTokenOwnerRecordPk = null;
            for (let member of memberMap){
                if (new PublicKey(member.account.governingTokenOwner).toBase58() === new PublicKey(signer).toBase58() &&
                    new PublicKey(member.account.governingTokenMint).toBase58() === new PublicKey(governingTokenMint).toBase58())
                    newTokenOwnerRecordPk = new PublicKey(member.pubkey);
            }*/

            console.log("new signatory address: "+signer)

            
            const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
                programId,
                realmPk,
                governingTokenMint,
                publicKey,
            );
            
            
            //const filter = pubkeyFilter(1, proposalAddress)
            
            const signatories = await getAllProposalSignatories(programId, proposalAddress);
            console.log("All Signatories "+JSON.stringify(signatories));
            
            const signatory = publicKey;
            
            const signatoryRecordAddress = await getSignatoryRecordAddress(
                programId,
                proposalAddress,
                signatory
            )

            const beneficiary = publicKey;
            const governanceAuthority = publicKey;
            const payer = publicKey;

            console.log("proposalAddress: "+proposalAddress.toBase58());
            console.log("programId: "+programId.toBase58());
            console.log("realmPk: "+realmPk.toBase58());
            console.log("governingTokenMint: "+governingTokenMint.toBase58());
            console.log("payer: "+payer.toBase58());
            console.log("tokenOwnerRecordPk: "+tokenOwnerRecordPk.toBase58())
            console.log("programVersion: "+programVersion)
            console.log("governanceAuthority: "+governanceAuthority.toBase58())
            //console.log("newTokenOwnerRecordPk: "+newTokenOwnerRecordPk.toBase58())
            //console.log("new signer: "+signer)
            console.log("signatoryTokenOwnerRecordPk: "+signatoryRecordAddress.toBase58())
            
            let instructions: TransactionInstruction[] = [];
            await withCancelProposal(
                instructions,
                programId,
                programVersion,
                realmPk,
                new PublicKey(governanceRulesWallet),
                proposalAddress,
                tokenOwnerRecordPk,
                governanceAuthority
            );
            
            let refundAddress = null;
            const possibleTorDeposit = getProposalDepositPk(
                proposalAddress,
                tokenOwnerRecordPk,
                programId
            );

            const torDeposit = await RPC_CONNECTION.getBalance(possibleTorDeposit)
            
            
            //if (delegateDeposit && delegateDeposit > 0 && possibleDelegateDeposit) {
            //    refundAddress = proposalOwner.account.governanceDelegate;
            //} else if (torDeposit && torDeposit > 0) {
            //    refundAddress = tokenOwnerRecordPk;
            //}
            if (torDeposit && torDeposit > 0)
                refundAddress = tokenOwnerRecordPk
            
            //let refInstructions: TransactionInstruction[] = [];
            
            if (refundAddress){
                await withRefundProposalDeposit(
                    instructions,
                    programId!,
                    programVersion,
                    proposalAddress,
                    governanceAuthority
                );
            }

        //instructions.push(...refInstructions);

            // with instructions run a transaction and make it rain!!!
            if (instructions && instructions.length > 0){
                const signature = await createAndSendV0TxInline(instructions);
                if (signature){
                    enqueueSnackbar(`Cancelling Proposal - ${signature}`,{ variant: 'success' });
                    
                    if (setReload) 
                        setReload(true);

                } else{
                    enqueueSnackbar(`Error`,{ variant: 'error' });
                }
                
                return null;
            }
        }
    }

    const handleAddAuthor = async() => {
        handleCloseSigner();
        await handleAddSignatoryIx();
    }

    const handleClickOpenSigner = () => {
        setOpenSignerPrompt(true);
    };

    const handleCloseSigner = () => {
        setOpenSignerPrompt(false);
    };

    return (
        <>
            {mode === 1 ? // signoff
                <Tooltip title={<>Click to Sign Off Proposal<br/><br/>WARNING: By signing off, this proposal will no longer be editable and will be in voting status (*unless there are more signers required)</>}>
                    <Button 
                        onClick={handleSignOff}
                        variant='outlined'
                        color='inherit'
                        fullWidth={true}
                        sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                        Sign Off <ApprovalIcon fontSize="small" sx={{ml:1}}/>
                    </Button>
                </Tooltip>
            :
                <>
                {mode === 2 ? // add signatory
                    <>
                        <Tooltip title={<>Add Signer to this proposal</>}>
                            <Button 
                                onClick={handleClickOpenSigner}
                                variant='outlined'
                                color='inherit'
                                fullWidth={true}
                                sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                                Add Signer <GroupAddIcon fontSize="small" sx={{ml:1}}/>
                            </Button>
                        </Tooltip>

                        <Dialog open={openSignerPrompt} onClose={handleCloseSigner}>
                            <DialogTitle>Add Signer</DialogTitle>
                            <DialogContent>
                            <DialogContentText>
                                WARNING: Adding a signatory will require the new PublicKey to also Sign Off this proposal, this is ideal to use if more PublicKeys should validate the proposal before being put to vote (*Add/Remove Instructions for this proposal are supported only by the proposal author)
                            </DialogContentText>
                            <TextField
                                autoFocus
                                margin="dense"
                                id="signer"
                                label="Signer PublicKey"
                                type="text"
                                onChange={(e) => {
                                        setSigner(e.target.value)
                                }}
                                fullWidth
                                variant="standard"
                            />
                            </DialogContent>
                            <DialogActions>
                            <Button onClick={handleCloseSigner}>Cancel</Button>
                            <Button onClick={handleAddAuthor}
                                disabled={!signer}
                            >Add</Button>
                            </DialogActions>
                        </Dialog>
                    </>
                    :<>
                    {mode === 3 ? // cancel proposal
                        <>
                            <Tooltip title={<>Cancel Proposal<br/><br/>WARNING: If this proposal has instructions, please remove those instructions before cancelling in order to claim back rent. Rent will be lost if you do not remove the instructions prior to cancelling the proposal.</>}>
                                <Button 
                                    onClick={handleCancelProposal}
                                    variant='outlined'
                                    color='error'
                                    fullWidth={true}
                                    sx={{color:'error',textTransform:'none',borderRadius:'17px'}}>
                                    Cancel Proposal <CancelIcon fontSize="small" sx={{color:'error',ml:1}}/>
                                </Button>
                            </Tooltip>
                        </>
                        :<>
                            {mode === 4 ? // veto proposal
                                <>
                                    <Tooltip title={<>Veto Proposal<br/><br/>WARNING: If this proposal has instructions, please remove those instructions before cancelling in order to claim back rent. Rent will be lost if you do not remove the instructions prior to cancelling the proposal.</>}>
                                        <Button 
                                            onClick={handleCancelProposal}
                                            variant='outlined'
                                            color='error'
                                            fullWidth={true}
                                            sx={{color:'error',textTransform:'none',borderRadius:'17px'}}>
                                            Veto Proposal <CancelIcon fontSize="small" sx={{color:'error',ml:1}}/>
                                        </Button>
                                    </Tooltip>
                                </>
                                :<>
                                    {mode === 5 ?
                                        <>
                                            <Tooltip title={<>Click to Finalize this Proposal<br/><br/>NOTE: If there are instructions you will be able to execute those in the instructions section</>}>
                                                <Button 
                                                    onClick={handleFinalize}
                                                    variant='outlined'
                                                    color='inherit'
                                                    fullWidth={true}
                                                    sx={{color:'white',textTransform:'none',borderRadius:'17px'}}>
                                                    Finalize Proposal <ApprovalIcon fontSize="small" sx={{ml:1}}/>
                                                </Button>
                                            </Tooltip>
                                        </>
                                        :
                                        <></>
                                    }
                                </>
                            }
                        </>
                    }
                    </>
                }
                </>
            }
        </>
    )
}