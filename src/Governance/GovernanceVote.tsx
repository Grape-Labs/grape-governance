import { 
    withRelinquishVote,
    Vote, 
    withCastVote, 
    VoteKind } from "@solana/spl-governance";
import { getGrapeGovernanceProgramVersion } from '../utils/grapeTools/helpers';

import { 
    getAllProposalsIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getTokenOwnerRecordsByRealmIndexed,
} from './api/queries';

import { 
    shortenString,
  } from '../utils/grapeTools/helpers';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import BN from 'bn.js'
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token-v2";
import { 
    ComputeBudgetProgram,
    LAMPORTS_PER_SOL,
    PublicKey, 
    TokenAmount, 
    Connection, 
    TransactionInstruction, 
    Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';

import { trimAddress } from "../utils/grapeTools/WalletAddress";

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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  TextField,
  TextareaAutosize,
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  Menu,
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
 
import { InstructionView } from './GovernanceInstructionView';
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import ExplorerView from '../utils/grapeTools/Explorer';
import moment from 'moment';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
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
import MoreVertIcon from "@mui/icons-material/MoreVert";

import { 
    PROXY, 
    RPC_CONNECTION, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI,
    BLACKLIST_WALLETS } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'

//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

const StyledMenu = styled(Menu)(({ theme }) => ({
    '& .MuiMenu-root': {
    },
    '& .MuiMenu-box': {
        backgroundColor:'rgba(0,0,0,0.95)',
        borderRadius:'17px'
    },
}));

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
  
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));

export function VoteForProposal(props:any){
    const state = props?.state;
    const title = props?.title;
    const subtitle = props?.subtitle;
    const showIcon = props?.showIcon;
    const { publicKey, wallet, sendTransaction } = useWallet();
    const votingParticipants = props.votingResultRows;
    const getVotingParticipants = props.getVotingParticipants;
    const hasVotedVotes = props.hasVotedVotes;
    const hasVoted = props.hasVoted;
    const propVoteType = props?.propVoteType;
    const thisitem = props.thisitem;
    const realm = props?.realm;
    const governanceAddress = props.governanceAddress;
    const type = props.type || 0;
    const multiChoice = props.multiChoice || null;
    const [memberMap, setMemberMap] = React.useState(null);
    const [voterRecord, setVoterRecord] = React.useState(null);
    const [delegatedVoterRecord, setDelegatedVoterRecord] = React.useState(null);
    const [councilVoterRecord, setCouncilVoterRecord] = React.useState(null);
    const [councilDelegateVoterRecord, setCouncilDelegateVoterRecord] = React.useState(null);
    const [selectedIndex, setSelectedIndex] = React.useState(1);
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const [anchorElYes, setAnchorElYes] = React.useState(null);
    const [anchorElNo, setAnchorElNo] = React.useState(null);
    const openDelegateYes = Boolean(anchorElYes);
    const openDelegateNo = Boolean(anchorElNo);
    const quorum = props?.quorum;
    const governanceRules = props?.governanceRules;
    const [open, setOpen] = React.useState(false);
    const [anchorElMore, setAnchorElMore] = React.useState<null | HTMLElement>(null);
    const openMore = Boolean(anchorElMore);
    const handleOpenMore = (e: React.MouseEvent<HTMLElement>) => setAnchorElMore(e.currentTarget);
    const handleCloseMore = () => setAnchorElMore(null);

    const councilMint58 = realm?.account?.config?.councilMint?.toBase58?.() || "";
    const proposalMint58 = thisitem?.account?.governingTokenMint?.toBase58?.() || "";

    const StyledMenu = styled(Menu)(({ theme }) => ({
    "& .MuiPaper-root": {
        backgroundColor: "rgba(12,12,16,0.98)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        color: "#fff",
        minWidth: 340,
        boxShadow: "0 18px 55px rgba(0,0,0,0.65)",
        overflow: "hidden",
    },
    "& .MuiMenu-list": {
        paddingTop: 6,
        paddingBottom: 6,
    },
    "& .MuiMenuItem-root": {
        fontSize: 13,
        paddingTop: 10,
        paddingBottom: 10,
        whiteSpace: "normal",
        lineHeight: 1.25,
    },
    }));
    const isBlacklisted = BLACKLIST_WALLETS.includes(publicKey?.toBase58()) ? true : false;

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };
    /*
    console.log("memberMap: "+JSON.stringify(memberMap));
    const memberMapReduced = memberMap.reduce((map: any, item: any) => {
        //console.log("item: "+JSON.stringify(item.account.governingTokenOwner))
        //map.set(item.account.governingTokenOwner, item);
        map.set(item.pubkey, item);
        //console.log("map: "+JSON.stringify(map))
        return map;
    },new Map());

    const item = memberMap.find(item => 
        item.account.governingTokenOwner === "KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT"
        && item.account.governingTokenMint === thisitem.account.governingTokenMint);
    
    console.log("memberMap Item: "+JSON.stringify(item));
    */
    
    const isCommunityVote = realm?.communityMint === thisitem?.account.governingTokenMint ? true : false; // realm.account.config?.councilMint?.toBase58() === thisitem?.account.governingTokenMint ? false : true;// realm?.communityMint === thisitem?.account.governingTokenMint;
    //console.log("**  isCommunityVote: "+JSON.stringify(isCommunityVote));
    //console.log(">>>  realm.account.config?.councilMint?.toBase58(): "+JSON.stringify(realm.account.config?.councilMint?.toBase58()));
    //console.log(">>>  thisitem?.account.governingTokenMint: "+JSON.stringify(thisitem?.account.governingTokenMint));
    
    const handleVoteYes = async () => {
        await handleVote(0, null, true)
    }

    const handleVoteNo = async () => {
        await handleVote(1, null, true)
    }

    const handleRelinquishVotes = async (delegate?: string, withOwnerRecord?:boolean, withAllDelegates?:boolean) => {
        const wOwner = withOwnerRecord ? true : false;
        const wAllDelegates = withAllDelegates ? true : false;
        setAnchorElYes(false);
        setAnchorElNo(false);
        
        //console.log("thisitem.account.governingTokenMint: "+JSON.stringify(thisitem.account.governingTokenMint));

        //console.log("realm: "+JSON.stringify(realm))

        const programId = new PublicKey(realm.owner);
        
        let rawTokenOwnerRecords = null;
        if (memberMap){
            rawTokenOwnerRecords = memberMap;
        } else{
            rawTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(new PublicKey(realm.pubkey).toBase58(), realm.owner ? new PublicKey(realm.owner).toBase58() : null);
            //if (!rawTokenOwnerRecords)
            //    rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, programId, new PublicKey(realm.pubkey))
        }

        //console.log("rawTokenOwnerRecords: "+JSON.stringify(rawTokenOwnerRecords))
        // 6R78nYux2yVDtNBd8CBXojRtgkSmRvECvQsAtZMkcDWM
        
        let memberItem = voterRecord || rawTokenOwnerRecords.find(item => 
            (item.account.governingTokenOwner.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));

        
        console.log("memberItem: "+JSON.stringify(memberItem));
        
        let delegatedItems = delegatedVoterRecord || rawTokenOwnerRecords.filter(item => 
            (item.account?.governanceDelegate?.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));
        
        console.log("delegatedItems: "+JSON.stringify(delegatedItems))
        
        //console.log("tokenOwnerRecord: "+JSON.stringify(thisitem.account.tokenOwnerRecord));
        
        const proposal = {
            governanceId: thisitem.account.governance,
            proposalId: thisitem.pubkey,
            tokenOwnerRecord: thisitem.account.tokenOwnerRecord,
            governingTokenMint: thisitem.account.governingTokenMint
        }
        const transactionData = {proposal:proposal,action:0} // 0 = yes
        //console.log("realm: "+JSON.stringify(realm));
        //console.log("thisitem/proposal: "+JSON.stringify(thisitem));
        //console.log("thisGovernance: "+JSON.stringify(thisGovernance));
        
        /*
        const realmData = {
            pubKey:thisGovernance.pubkey,
            realmId:thisitem.pubkey,
            governanceId:thisitem.account.governance,
            communityMint: thisitem.account.governingTokenMint
        }*/

        //console.log("Proposal: "+JSON.stringify(proposal));
        //console.log("realmData: "+JSON.stringify(realmData));
        //console.log("memberItem: "+JSON.stringify(memberItem));

        //console.log("memberMapReduced: "+JSON.stringify(memberMapReduced));

        // check if voter can participate
        console.log("publicKey: "+publicKey.toBase58())
        if (publicKey && memberItem) {
            const voteTx = new Transaction();
            const beneficiary = publicKey;
            const governanceAuthority = publicKey;

            const realmPk = new PublicKey(realm.pubkey);
            const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, new PublicKey(realm.owner), new PublicKey(realm.pubkey));

            const tokenOwnerRecord = new PublicKey(memberItem.pubkey);
            const instructions: TransactionInstruction[] = [];
            //const prop = await getProposal(RPC_CONNECTION, transactionData.proposal);

            if (wOwner){ // vote for your own if delegate is not set and value of delegate is not = 1
                
                const hasVotedRecord = votingParticipants?.some(item => item.governingTokenOwner === publicKey.toBase58());
                const hasVotedItem = votingParticipants?.find(item => item.governingTokenOwner === publicKey.toBase58());
                /*
                console.log("programId: "+programId.toBase58())
                console.log("programVersion: "+programVersion)
                console.log("realm: "+JSON.stringify(realm))
                console.log("governance: "+new PublicKey(proposal.governanceId).toBase58())
                console.log("proposal: "+new PublicKey(proposal.proposalId).toBase58())
                console.log("governingTokenMint: "+new PublicKey(proposal.governingTokenMint).toBase58())
                console.log("voteRecord: "+new PublicKey(hasVotedItem.voteAddress).toBase58())
                console.log("governanceAuthority: "+governanceAuthority.toBase58())
                console.log("beneficiary: "+beneficiary.toBase58())
                */
                if (hasVotedRecord){
                    await withRelinquishVote(
                        instructions,
                        programId,
                        programVersion,
                        realm?.pubkey ? new PublicKey(realm.pubkey) : new PublicKey(governanceAddress),
                        new PublicKey(proposal.governanceId),
                        new PublicKey(proposal.proposalId),
                        new PublicKey(tokenOwnerRecord),//new PublicKey(proposal.tokenOwnerRecord),
                        new PublicKey(proposal.governingTokenMint),
                        new PublicKey(hasVotedItem.voteAddress),//voteRecord,
                        governanceAuthority,
                        beneficiary
                    )
                    const recentBlock = await RPC_CONNECTION.getLatestBlockhash();
                    //const transaction = new Transaction({ feePayer: walletPubkey });
                    const transaction = new Transaction();
                    transaction.feePayer = publicKey;
                    transaction.recentBlockhash = recentBlock.blockhash;

                    console.log("transaction: " + JSON.stringify(transaction));
                    if (instructions && instructions.length > 0)
                        voteTx.add(...instructions);
                }
            }
            
            if (voteTx){
                console.log("Removing vote as: "+publicKey.toBase58());
            }
            if (voteTx){

                //console.log("voteTx: " + JSON.stringify(voteTx));
                try{
                    enqueueSnackbar(`Preparing to withdraw vote`,{ variant: 'info' });
                    const signature = await sendTransaction(voteTx, RPC_CONNECTION, {
                        skipPreflight: true,
                        preflightCommitment: "confirmed",
                    });
                    const snackprogress = (key:any) => (
                        <CircularProgress sx={{padding:'10px'}} />
                    );
                    const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
                    //await connection.confirmTransaction(signature, 'processed');
                    const latestBlockHash = await RPC_CONNECTION.getLatestBlockhash();
                    await RPC_CONNECTION.confirmTransaction({
                        blockhash: latestBlockHash.blockhash,
                        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                        signature: signature}, 
                        'confirmed'
                    );

                    closeSnackbar(cnfrmkey);
                    const action = (key:any) => (
                            <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                                Signature: {shortenString(signature,5,5)}
                            </Button>
                    );
                    
                    enqueueSnackbar(`You have removed your partipation from this proposal`,{ variant: 'success', action });

                    // trigger a refresh here...
                    
                    const redirectTimer = setTimeout(() => {
                        setOpen(false);
                        getVotingParticipants();
                    }, 5000); // 5 seconds*/
                    //getVotingParticipants();
                }catch(e:any){
                    enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                } 
            } else{
                alert("No voter record!")
            }
            
        }
    }

    // Chunked vote sender for: own vote + delegate votes (all or single)
    // Notes:
    // - Sends multiple transactions when voting with many delegates to avoid tx size/compute limits
    // - Uses simulateTransaction for actionable logs
    // - Uses the SAME blockhash for send+confirm per tx (important!)
    // - Fixes memberItem mint comparison bug
    const handleVote = async (
    type: Number,
    delegate?: string,
    withOwnerRecord?: boolean,
    withAllDelegates?: boolean
    ) => {
    try {
        if (isBlacklisted) {
        enqueueSnackbar("An error occured, please try again later!", { variant: "error" });
        return;
        }

        const wOwner = !!withOwnerRecord;
        const wAllDelegates = !!withAllDelegates;

        setAnchorElYes(false);
        setAnchorElNo(false);

        if (!publicKey) {
        enqueueSnackbar("Wallet not connected.", { variant: "error" });
        return;
        }

        // NOTE: programId kept (though not used below) in case you need it for non-indexed paths
        const programId = new PublicKey(realm.owner);

        // Load token owner records
        let rawTokenOwnerRecords: any[] = [];
        if (memberMap) {
        rawTokenOwnerRecords = memberMap;
        } else {
        rawTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed(
            new PublicKey(realm.pubkey).toBase58(),
            realm.owner ? new PublicKey(realm.owner).toBase58() : null,
            publicKey.toBase58()
        );
        }

        // ---- Fix bug here: compare mint to thisitem.account.governingTokenMint, NOT "thisitem"
        const myPk58 = publicKey.toBase58();
        const proposalMint58 = thisitem?.account?.governingTokenMint?.toBase58?.() ?? "";

        const memberItem =
        voterRecord ||
        rawTokenOwnerRecords.find(
            (item: any) =>
            item?.account?.governingTokenOwner?.toBase58?.() === myPk58 &&
            item?.account?.governingTokenMint?.toBase58?.() === proposalMint58
        );

        const delegatedItems =
        delegatedVoterRecord ||
        rawTokenOwnerRecords.filter(
            (item: any) =>
            item?.account?.governanceDelegate?.toBase58?.() === myPk58 &&
            item?.account?.governingTokenMint?.toBase58?.() === proposalMint58
        );

        console.log("delegatedItems:", delegatedItems);

        const proposal = {
        governanceId: thisitem.account.governance,
        proposalId: thisitem.pubkey,
        tokenOwnerRecord: thisitem.account.tokenOwnerRecord,
        governingTokenMint: thisitem.account.governingTokenMint,
        };

        const transactionData = { proposal, action: 0 }; // 0 = yes (as per your original)

        if (!memberItem) {
        enqueueSnackbar("Voter Record Not Found!", { variant: "error" });
        return;
        }

        // -------------------------
        // Build vote instructions list
        // -------------------------
        const ixs: any[] = [];
        let supportedVote = true;

        // Helper: has already voted?
        const hasVoted = (owner58: string) =>
        votingParticipants.some((p: any) => p.governingTokenOwner === owner58);

        // Add "own vote" (optional)
        if (wOwner) {
        const iAlreadyVoted = hasVoted(myPk58);
        console.log("*** isCommunityVote:", isCommunityVote);

        if (!iAlreadyVoted) {
            const ix = await createCastVoteTransaction(
            realm,
            publicKey,
            transactionData,
            memberItem,
            null,
            isCommunityVote,
            multiChoice,
            type
            );

            if (ix) {
            ixs.push(ix);
            } else {
            supportedVote = false;
            enqueueSnackbar("Additional Plugin Voting Support Coming Soon (NFT, Gateway)", {
                variant: "error",
            });
            }
        }
        }

        // Add delegate votes
        if (delegatedItems && delegatedItems.length) {
        let addCnt = ixs.length; // count of votes we intend to include

        for (const delegateItem of delegatedItems) {
            const owner58 = delegateItem?.account?.governingTokenOwner?.toBase58?.();
            if (!owner58) continue;

            // skip if already voted
            if (hasVoted(owner58)) continue;

            // Determine whether this delegate should be included
            if (wAllDelegates) {
            // quorum limiting: only include up to quorum
            if (quorum && quorum > 0 && addCnt >= quorum) {
                continue;
            }

            const ix = await createCastVoteTransaction(
                realm,
                publicKey,
                transactionData,
                delegateItem,
                owner58, // delegator
                isCommunityVote,
                multiChoice,
                type
            );

            if (ix) {
                ixs.push(ix);
                addCnt++;
                console.log("Adding delegate vote for:", owner58);
            }
            } else if (delegate) {
            // single delegate mode
            if (delegate === owner58) {
                const ix = await createCastVoteTransaction(
                realm,
                publicKey,
                transactionData,
                delegateItem,
                owner58,
                isCommunityVote,
                multiChoice,
                type
                );
                if (ix) ixs.push(ix);
                break;
            }
            }
        }
        }

        if (!supportedVote) return;

        if (!ixs.length) {
        enqueueSnackbar("No eligible votes to cast (already voted / no delegates).", {
            variant: "warning",
        });
        return;
        }

        // -------------------------
        // Chunk & send transactions
        // -------------------------
        // Start small. Increase to 3–4 if you confirm it works reliably.
        const CHUNK_SIZE = 2;

        // Make instruction chunks
        const chunks: any[][] = [];
        for (let i = 0; i < ixs.length; i += CHUNK_SIZE) {
        chunks.push(ixs.slice(i, i + CHUNK_SIZE));
        }

        enqueueSnackbar(
        chunks.length > 1
            ? `Preparing to cast ${ixs.length} votes in ${chunks.length} transactions…`
            : `Preparing to cast vote…`,
        { variant: "info" }
        );

        const snackprogress = (key: any) => <CircularProgress sx={{ padding: "10px" }} />;

        // Send each chunk as its own transaction
        const sigs: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
        const voteTx = new Transaction();
        for (const ix of chunks[i]) voteTx.add(ix);

        // IMPORTANT: use same blockhash for send+confirm for this tx
        const { blockhash, lastValidBlockHeight } = await RPC_CONNECTION.getLatestBlockhash(
            "confirmed"
        );
        voteTx.recentBlockhash = blockhash;
        voteTx.feePayer = publicKey;

        // Optional: simulate to catch size/compute/account errors with logs
        try {
            const sim = await RPC_CONNECTION.simulateTransaction(voteTx);
            if (sim.value.err) {
            console.log("SIM ERR:", sim.value.err);
            console.log("SIM LOGS:", sim.value.logs);
            enqueueSnackbar(`Simulation failed: ${JSON.stringify(sim.value.err)}`, {
                variant: "error",
            });
            return;
            }
        } catch (e) {
            // simulation itself can fail sometimes on some RPCs; don’t hard stop unless you want to
            console.warn("simulateTransaction failed (continuing):", e);
        }

        const cnfrmkey = enqueueSnackbar(`Confirming transaction ${i + 1}/${chunks.length}`, {
            variant: "info",
            action: snackprogress,
            persist: true,
        });

        try {
            const signature = await sendTransaction(voteTx, RPC_CONNECTION, {
            skipPreflight: false, // IMPORTANT: get real errors
            preflightCommitment: "confirmed",
            });

            await RPC_CONNECTION.confirmTransaction(
            { signature, blockhash, lastValidBlockHeight },
            "confirmed"
            );

            sigs.push(signature);
            closeSnackbar(cnfrmkey);

            const action = (key: any) => (
            <Button
                href={`https://explorer.solana.com/tx/${signature}`}
                target="_blank"
                sx={{ color: "white" }}
            >
                Signature: {shortenString(signature, 5, 5)}
            </Button>
            );

            enqueueSnackbar(
            chunks.length > 1
                ? `Vote transaction ${i + 1}/${chunks.length} confirmed`
                : `Vote confirmed`,
            { variant: "success", action }
            );
        } catch (e: any) {
            closeSnackbar(cnfrmkey);
            console.error("vote tx failed:", e);
            enqueueSnackbar(e?.message ? `${e.name}: ${e.message}` : e?.name || "Vote failed", {
            variant: "error",
            });
            return; // stop on first failure; change if you want to continue remaining chunks
        }
        }

        // Refresh participants after last tx
        setTimeout(() => {
        getVotingParticipants();
        }, 5000);
    } catch (e: any) {
        console.error("handleVote fatal:", e);
        enqueueSnackbar(e?.message ? `${e.name}: ${e.message}` : e?.name || "Vote failed", {
        variant: "error",
        });
    }
    };

    
    const loadMemberMap = async() => {
        
        const rawTokenOwnerRecords = await getTokenOwnerRecordsByRealmIndexed(new PublicKey(realm.pubkey).toBase58(), realm.owner ? new PublicKey(realm.owner).toBase58() : null, publicKey.toBase58());
        setMemberMap(rawTokenOwnerRecords);

        let memberItem = rawTokenOwnerRecords.find(item => 
            (item.account.governingTokenOwner.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));
        
        setVoterRecord(memberItem);
        //console.log("memberItem: "+JSON.stringify(memberItem));
        
        let delegatedItems = rawTokenOwnerRecords.filter(item => 
            (item.account?.governanceDelegate?.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));
        
        setDelegatedVoterRecord(delegatedItems);
        //console.log("delegatedItems: "+JSON.stringify(delegatedItems));

        // check if this is a community proposal
        // if community proposal check if the voter is a council member & check if the delegate is a council member
        if (realm && realm.account && realm.account.config && realm.account.config?.councilMint &&
            realm.account.config.councilMint.toBase58() !== thisitem.account.governingTokenMint.toBase58()){
            // this is a community proposal so now lets check
                //rawTokenOwnerRecords
            console.log("community proposal, checking council members...");
            let councilMemberItem = rawTokenOwnerRecords.find(item => 
                (item.account.governingTokenOwner.toBase58() === publicKey.toBase58() && 
                 item.account.governingTokenMint.toBase58() === realm.account.config.councilMint.toBase58()));
                console.log("councilMemberItem: "+JSON.stringify(councilMemberItem));
            setCouncilVoterRecord(councilMemberItem);
            
            let councilDelegateMemberItem = rawTokenOwnerRecords.find(item => 
                (item.account.governanceDelegate.toBase58() === publicKey.toBase58() && 
                 item.account.governingTokenMint.toBase58() === realm.account.config.councilMint.toBase58()));
                console.log("delegateCouncilMemberItem: "+JSON.stringify(councilMemberItem));
            setCouncilDelegateVoterRecord(councilDelegateMemberItem);
        }
    }

    const handleDelegateOpenYesToggle = (event:any) => {
        setAnchorElYes(event.currentTarget);
    };
    const handleDelegateCloseYesToggle = () => {
        setAnchorElYes(null);
    };
    const handleDelegateOpenNoToggle = (event:any) => {
        setAnchorElNo(event.currentTarget);
    };
    const handleDelegateCloseNoToggle = () => {
        setAnchorElNo(null);
    };

    React.useEffect(() => { 
        if (!memberMap && publicKey){
            console.log("Step 1.")
            loadMemberMap();
        }
    }, [publicKey]);

    return (
  <>
    {!publicKey || thisitem.account?.state !== 2 ? (
      <>
        {type === 0 ? (
          <Button
            variant="outlined"
            color="success"
            disabled
            sx={{ borderRadius: "17px", textTransform: "none" }}
          >
            {title && subtitle && showIcon && (
              <Grid container direction="column" alignItems="center">
                <Grid item>
                  <Grid container direction="row" alignItems="center">
                    <Grid item>
                      {type === 0 ? (
                        <ThumbUpIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                      ) : (
                        <ThumbDownIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                      )}
                    </Grid>
                    <Grid item>{title}</Grid>
                  </Grid>
                </Grid>

                <Grid item sx={{ minWidth: "100px" }}>
                  <Divider />
                  <Grid sx={{ mt: 0.5 }}>
                    <Typography sx={{ fontSize: "10px" }}>{subtitle}</Typography>
                  </Grid>
                </Grid>
              </Grid>
            )}
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="error"
            disabled
            sx={{ borderRadius: "17px", textTransform: "none" }}
          >
            {title && subtitle && showIcon && (
              <Grid container direction="column" alignItems="center">
                <Grid item>
                  <Grid container direction="row" alignItems="center">
                    <Grid item>
                      {type === 0 ? (
                        <ThumbUpIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                      ) : (
                        <ThumbDownIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                      )}
                    </Grid>
                    <Grid item>{title}</Grid>
                  </Grid>
                </Grid>

                <Grid item sx={{ minWidth: "100px" }}>
                  <Divider />
                  <Grid sx={{ mt: 0.5 }}>
                    <Typography sx={{ fontSize: "10px" }}>{subtitle}</Typography>
                  </Grid>
                </Grid>
              </Grid>
            )}
          </Button>
        )}
      </>
    ) : (
      <>
        {thisitem.account?.state === 2 && publicKey && (
          <>
            {type === 0 ? (
              <>
                {/* YES: split button + delegates menu (keeps original delegate behavior) */}
                {!hasVoted ? (
                  <ButtonGroup
                    variant="outlined"
                    color="success"
                    sx={{
                      borderRadius: "18px",
                      overflow: "hidden",
                      "& .MuiButton-root": { textTransform: "none" },
                    }}
                  >
                    <Button
                      onClick={handleVoteYes}
                      sx={{ borderRadius: 0, px: 2, py: 1, minWidth: 210 }}
                    >
                      {title && subtitle && showIcon ? (
                        <Grid container direction="column" alignItems="center">
                          <Grid item>
                            <Grid container direction="row" alignItems="center">
                              <Grid item>
                                <ThumbUpIcon fontSize="small" sx={{ mr: 0.5 }} />
                              </Grid>
                              <Grid item>{title}</Grid>
                            </Grid>
                          </Grid>

                          <Grid item sx={{ minWidth: "140px" }}>
                            <Divider sx={{ my: 0.5, opacity: 0.35 }} />
                            <Typography sx={{ fontSize: "11px", opacity: 0.9 }}>
                              {subtitle}
                            </Typography>
                          </Grid>
                        </Grid>
                      ) : (
                        <>Vote{!multiChoice && " YES"}</>
                      )}
                    </Button>

                    {(delegatedVoterRecord && delegatedVoterRecord.length > 0) && (
                      <Button
                        size="small"
                        aria-controls={openDelegateYes ? "basic-yes-menu" : undefined}
                        aria-haspopup="true"
                        aria-expanded={openDelegateYes ? "true" : undefined}
                        onClick={handleDelegateOpenYesToggle}
                        sx={{ borderRadius: 0, px: 1.1, minWidth: 44 }}
                      >
                        <ArrowDropDownIcon />
                      </Button>
                    )}
                  </ButtonGroup>
                ) : (
                  // when already voted, keep the caret available (original behavior)
                  (delegatedVoterRecord && delegatedVoterRecord.length > 0) && (
                    <Button
                      size="small"
                      color="success"
                      aria-controls={openDelegateYes ? "basic-yes-menu" : undefined}
                      aria-haspopup="true"
                      aria-expanded={openDelegateYes ? "true" : undefined}
                      onClick={handleDelegateOpenYesToggle}
                      sx={{
                        borderRadius: "18px",
                        textTransform: "none",
                        minWidth: 44,
                      }}
                    >
                      <ArrowDropDownIcon />
                    </Button>
                  )
                )}

                {/* YES menu */}
                <StyledMenu
                  id="basic-yes-menu"
                  anchorEl={anchorElYes}
                  open={openDelegateYes}
                  onClose={handleDelegateCloseYesToggle}
                  MenuListProps={{ "aria-labelledby": "basic-button" }}
                  sx={{ zIndex: 9999 }}
                >
                  <ClickAwayListener onClickAway={handleDelegateCloseYesToggle}>
                    <MenuList id="split-yes-menu" autoFocusItem>
                      <MenuItem disabled={hasVoted} onClick={() => handleVote(0, null, true)}>
                        Vote only with my Voting Power
                      </MenuItem>

                      <Divider />

                      {delegatedVoterRecord &&
                        delegatedVoterRecord.map((option: any, index: number) => {
                          const owner58 =
                            option?.account?.governingTokenOwner?.toBase58?.() || "";
                          const already =
                            votingParticipants &&
                            votingParticipants.some((i: any) => i.governingTokenOwner === owner58);

                          return (
                            <MenuItem
                              key={`yes-${owner58}-${index}`}
                              disabled={already}
                              onClick={() => handleVote(0, owner58)}
                            >
                              <Typography variant="caption">
                                Vote with {trimAddress(owner58, 3)} delegated Voting Power
                                {already && <CheckCircleIcon fontSize="inherit" sx={{ ml: 1 }} />}
                              </Typography>
                            </MenuItem>
                          );
                        })}

                      <Divider />

                      <MenuItem onClick={() => handleVote(0, null, true, true)}>
                        Vote with all my delegated Voting Power
                      </MenuItem>
                    </MenuList>
                  </ClickAwayListener>
                </StyledMenu>
              </>
            ) : (
              <>
                {/* NO: keep your existing behavior (button + separate caret/menu) */}
                {!hasVoted && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={handleVoteNo}
                    sx={{ borderRadius: "17px", textTransform: "none" }}
                  >
                    {title && subtitle && showIcon ? (
                      <Grid container direction="column" alignItems="center">
                        <Grid item>
                          <Grid container direction="row" alignItems="center">
                            <Grid item>
                              {type === 0 ? (
                                <ThumbUpIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                              ) : (
                                <ThumbDownIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                              )}
                            </Grid>
                            <Grid item>{title}</Grid>
                          </Grid>
                        </Grid>

                        <Grid item sx={{ minWidth: "100px" }}>
                          <Divider />
                          <Grid sx={{ mt: 0.5 }}>
                            <Typography sx={{ fontSize: "10px" }}>{subtitle}</Typography>
                          </Grid>
                        </Grid>
                      </Grid>
                    ) : (
                      <>Vote NO</>
                    )}
                  </Button>
                )}

                {(delegatedVoterRecord && delegatedVoterRecord.length > 0) && (
                  <>
                    <Button
                      size="small"
                      color="error"
                      aria-controls={openDelegateNo ? "basic-no-menu" : undefined}
                      aria-haspopup="true"
                      aria-expanded={openDelegateNo ? "true" : undefined}
                      onClick={handleDelegateOpenNoToggle}
                      sx={{ borderRadius: "17px", textTransform: "none" }}
                    >
                      <ArrowDropDownIcon />
                    </Button>

                    <StyledMenu
                      id="basic-no-menu"
                      anchorEl={anchorElNo}
                      open={openDelegateNo}
                      onClose={handleDelegateCloseNoToggle}
                      MenuListProps={{ "aria-labelledby": "basic-no-button" }}
                      sx={{ zIndex: 9999 }}
                    >
                      <ClickAwayListener onClickAway={handleDelegateCloseNoToggle}>
                        <MenuList id="split-no-menu" autoFocusItem>
                          <MenuItem disabled={hasVoted} onClick={() => handleVote(1, null, true)}>
                            Vote only with my Voting Power
                          </MenuItem>

                          <Divider />

                          {delegatedVoterRecord &&
                            delegatedVoterRecord.map((option: any, index: number) => {
                              const owner58 =
                                option?.account?.governingTokenOwner?.toBase58?.() || "";
                              const already =
                                votingParticipants &&
                                votingParticipants.some((i: any) => i.governingTokenOwner === owner58);

                              return (
                                <MenuItem
                                  key={`no-${owner58}-${index}`}
                                  disabled={already}
                                  onClick={() => handleVote(1, owner58)}
                                >
                                  <Typography variant="caption">
                                    Vote with {trimAddress(owner58, 3)} delegated Voting Power
                                    {already && (
                                      <CheckCircleIcon fontSize="inherit" sx={{ ml: 1 }} />
                                    )}
                                  </Typography>
                                </MenuItem>
                              );
                            })}

                          <Divider />

                          <MenuItem onClick={() => handleVote(1, null, true, true)}>
                            Vote with all my delegated Voting Power
                          </MenuItem>
                        </MenuList>
                      </ClickAwayListener>
                    </StyledMenu>
                  </>
                )}
              </>
            )}
          </>
        )}

        {(hasVoted && publicKey) && (
          <>
            {title && subtitle && showIcon ? (
              <>
                <Tooltip
                  title={
                    Number(hasVotedVotes || 0) > 0
                      ? `You casted ${getFormattedNumberToLocale(hasVotedVotes)} votes for this proposal`
                      : Number(hasVotedVotes || 0) < 0
                      ? `You casted ${getFormattedNumberToLocale(hasVotedVotes)} votes against this proposal`
                      : ``
                  }
                >
                  <Button
                    variant="outlined"
                    onClick={() =>
                      state === 2 &&
                      (Number(hasVotedVotes || 0) > 0 || Number(hasVotedVotes || 0) < 0) &&
                      handleClickOpen()
                    }
                    color={type === 0 ? "success" : "error"}
                    sx={{ borderRadius: "17px", textTransform: "none" }}
                  >
                    <Grid container direction="column" alignItems="center">
                      <Grid item>
                        <Grid container direction="row" alignItems="center">
                          <Grid item>
                            {type === 0 ? (
                              <ThumbUpIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                            ) : (
                              <ThumbDownIcon fontSize="small" sx={{ mr: 0.25, ml: 0.25 }} />
                            )}
                          </Grid>
                          <Grid item>{title}</Grid>
                        </Grid>
                      </Grid>

                      <Grid item sx={{ minWidth: "100px" }}>
                        <Divider />
                        <Grid sx={{ mt: 0.5 }}>
                          <Typography sx={{ fontSize: "10px" }}>
                            <>
                              {subtitle}{" "}
                              {((Number(hasVotedVotes || 0) > 0 && type === 0) ||
                              (Number(hasVotedVotes || 0) < 0 && type === 1)) ? (
                                <CheckCircleIcon fontSize="inherit" />
                              ) : (
                                <></>
                              )}
                            </>
                          </Typography>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Button>
                </Tooltip>

                <Dialog
                  open={open}
                  onClose={handleClose}
                  PaperProps={{
                    style: {
                      background: "#13151C",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderTop: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "20px",
                    },
                  }}
                >
                  <BootstrapDialogTitle id="create-storage-pool" onClose={handleClose}>
                    Vote
                  </BootstrapDialogTitle>

                  <DialogContent>
                    <DialogContentText>
                      <Grid container>
                        <Box
                          sx={{
                            m: 2,
                            background: "rgba(0, 0, 0, 0.1)",
                            borderRadius: "17px",
                            p: 1,
                            width: "100%",
                            minWidth: "360px",
                          }}
                        >
                          <Box sx={{ my: 3, mx: 2 }}>
                            <Grid container alignItems="center">
                              <Grid item xs>
                                <Typography gutterBottom variant="h5" component="div">
                                  Voted
                                </Typography>
                              </Grid>
                              <Grid item>{Number(hasVotedVotes || 0).toLocaleString()}</Grid>
                            </Grid>
                            <Typography color="text.secondary" variant="body2">
                              Voting direction:{" "}
                              {Number(hasVotedVotes || 0) > 0
                                ? "For"
                                : Number(hasVotedVotes || 0) < 0
                                ? "Against"
                                : "—"}
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </DialogContentText>
                  </DialogContent>

                  <DialogActions>
                    <Button
                      color="success"
                      onClick={() => handleRelinquishVotes(null, true)}
                      sx={{ borderRadius: "17px" }}
                    >
                      <DownloadIcon fontSize="inherit" sx={{ mr: 1 }} /> Withdraw Vote
                    </Button>
                  </DialogActions>
                </Dialog>
              </>
            ) : (
              <>
                {Number(hasVotedVotes || 0) > 0 && type === 0 ? (
                  <Tooltip
                    title={
                      Number(hasVotedVotes || 0) > 0 &&
                      `You casted ${getFormattedNumberToLocale(hasVotedVotes)} votes for this proposal`
                    }
                  >
                    <Button
                      variant="outlined"
                      color="success"
                      sx={{ borderRadius: "17px", textTransform: "none" }}
                    >
                      <CheckCircleIcon />
                    </Button>
                  </Tooltip>
                ) : (
                  <>
                    {Number(hasVotedVotes || 0) < 0 && (
                      <Tooltip
                        title={
                          Number(hasVotedVotes || 0) < 0 &&
                          `You casted ${getFormattedNumberToLocale(hasVotedVotes * -1)} votes against this proposal`
                        }
                      >
                        <Button
                          variant="outlined"
                          color="error"
                          sx={{ borderRadius: "17px", textTransform: "none" }}
                        >
                          <CheckCircleIcon />
                        </Button>
                      </Tooltip>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </>
    )}
  </>
);
}