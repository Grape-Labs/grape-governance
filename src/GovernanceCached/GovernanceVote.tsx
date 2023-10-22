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
    getMaxVoterWeightRecord,
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
import BN from 'bn.js'
import { BorshCoder } from "@coral-xyz/anchor";
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token-v2";
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { styled, useTheme, ThemeProvider } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { InstructionMapping } from "../utils/grapeTools/InstructionMapping";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

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

import { 
    PROXY, 
    RPC_CONNECTION,
    TX_RPC_ENDPOINT, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
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

export function VoteForProposal(props:any){
    const { publicKey, wallet, sendTransaction } = useWallet();
    const votingParticipants = props.votingResultRows;
    const getVotingParticipants = props.getVotingParticipants;
    const hasVotedVotes = props.hasVotedVotes;
    const hasVoted = props.hasVoted;
    const propVoteType = props?.propVoteType;
    const thisitem = props.thisitem;
    const realm = props.realm;
    const type = props.type || 0;
    const multiChoice = props.multiChoice || null;
    const [memberMap, setMemberMap] = React.useState(null);
    const [voterRecord, setVoterRecord] = React.useState(null);
    const [delegatedVoterRecord, setDelegatedVoterRecord] = React.useState(null);
    const [selectedIndex, setSelectedIndex] = React.useState(1);
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const [anchorElYes, setAnchorElYes] = React.useState(null);
    const [anchorElNo, setAnchorElNo] = React.useState(null);
    const openDelegateYes = Boolean(anchorElYes);
    const openDelegateNo = Boolean(anchorElNo);
    
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
    const isCommunityVote = propVoteType !== 'Council'; //realm.account.config?.councilMint?.toBase58() !== thisitem?.account.governingTokenMint;// realm?.communityMint === thisitem?.account.governingTokenMint;
    //console.log("isCommunityVote: "+JSON.stringify(isCommunityVote));
    
    const handleVoteYes = async () => {
        await handleVote(0, null, true)
    }

    const handleVoteNo = async () => {
        await handleVote(1, null, true)
    }

    const handleVote = async (type: Number, delegate?: string, withOwnerRecord?:boolean, withAllDelegates?:boolean) => {
        const wOwner = withOwnerRecord ? true : false;
        const wAllDelegates = withAllDelegates ? true : false;
        setAnchorElYes(false);
        setAnchorElNo(false);
        
        //console.log("thisitem.account.governingTokenMint: "+JSON.stringify(thisitem.account.governingTokenMint));

        //console.log("realm: "+JSON.stringify(realm))

        const programId = new PublicKey(thisitem.owner);
        
        /*
        const ownerTokenRecord = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, programId, publicKey)
        console.log("ownerTokenRecord: "+JSON.stringify(ownerTokenRecord))

        let memberItem = ownerTokenRecord.find(item => 
            (item.account.governingTokenOwner.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));
        */
        
        let rawTokenOwnerRecords = null;
        if (memberMap){
            rawTokenOwnerRecords = memberMap;
        } else{
            rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, programId, new PublicKey(realm.pubkey))
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

        if (publicKey && memberItem) {
            
            const voteTx = new Transaction();
            
            if (wOwner){ // vote for your own if delegate is not set and value of delegate is not = 1
                
                const hasVoted = votingParticipants.some(item => item.governingTokenOwner === publicKey.toBase58());
                if (!hasVoted){
                    const tmpVote = await createCastVoteTransaction(
                        realm,
                        publicKey,
                        transactionData,
                        memberItem,
                        null,
                        isCommunityVote,
                        multiChoice,
                        type
                    );
                    voteTx.add(tmpVote);
                }
            }
            
            if (voteTx){
                console.log("Casting vote as: "+publicKey.toBase58());
            }

            if (delegatedItems){ // if we wanta to add all to vote
                let cnt = 0;
                for (var delegateItem of delegatedItems){ // if vote for all delegates + your own
                    // check with delegate
                    console.log("delegate setting: "+delegate);    
                    if (withAllDelegates){
                        // check if delegate has voted
                        const hasVoted = votingParticipants.some(item => item.governingTokenOwner === delegateItem.account.governingTokenOwner.toBase58());
                        if (!hasVoted){
                            
                            const delegateVoteTx = await createCastVoteTransaction(
                                realm,
                                publicKey,
                                transactionData,
                                delegateItem,
                                delegateItem.account.governingTokenOwner.toBase58(),//null,
                                isCommunityVote,
                                multiChoice,
                                type
                            );
                            
                            if (delegateVoteTx){
                                voteTx.add(delegateVoteTx);
                                console.log("Casting vote as a delegator for "+delegateItem.account.governingTokenOwner.toBase58())
                            }
                        }
                    } else if (delegate){ // if sinlge delegate
                        if (delegate === delegateItem.account.governingTokenOwner.toBase58()){
                            const delegateVoteTx = await createCastVoteTransaction(
                                realm,
                                publicKey,
                                transactionData,
                                delegateItem,
                                delegateItem.account.governingTokenOwner.toBase58(),
                                isCommunityVote,
                                multiChoice,
                                type
                            );
                            
                            if (delegateVoteTx)
                                voteTx.add(delegateVoteTx);
                        }
                    }
                    cnt++;

                }
            }

            //console.log("vvvt: "+JSON.stringify(vvvt));
            
            if (voteTx){

                console.log("voteTx: " + JSON.stringify(voteTx));
                try{
                    enqueueSnackbar(`Preparing to cast vote`,{ variant: 'info' });
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
                        'finalized'
                    );

                    closeSnackbar(cnfrmkey);
                    const action = (key:any) => (
                            <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                                Signature: {signature}
                            </Button>
                    );
                    
                    enqueueSnackbar(`Congratulations, you have participated in voting for this Proposal`,{ variant: 'success', action });

                    // trigger a refresh here...
                    /*
                    const redirectTimer = setTimeout(() => {
                        getVotingParticipants();
                    }, 3000); // 3 seconds*/
                    
                }catch(e:any){
                    enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                } 
            } else{
                alert("No voter record!")
            }
            
        }
    }

    const loadMemberMap = async() => {
        const programId = new PublicKey(thisitem.owner);
        const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, programId, new PublicKey(realm.pubkey))
        setMemberMap(rawTokenOwnerRecords);

        let memberItem = rawTokenOwnerRecords.find(item => 
            (item.account.governingTokenOwner.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));

        setVoterRecord(memberItem);
        console.log("memberItem: "+JSON.stringify(memberItem));
        
        let delegatedItems = rawTokenOwnerRecords.filter(item => 
            (item.account?.governanceDelegate?.toBase58() === publicKey.toBase58() && 
            item.account.governingTokenMint.toBase58() === thisitem.account.governingTokenMint.toBase58()));
        setDelegatedVoterRecord(delegatedItems);
        
        console.log("delegatedItems: "+JSON.stringify(delegatedItems));
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
        {thisitem.account?.state === 2 && !hasVoted && publicKey &&
            <>
                
                {type === 0 ?
                    <>
                    <Button
                        variant="outlined"
                        color='success'
                        onClick={handleVoteYes}
                        sx={{borderRadius:'17px',textTransform:'none'}}
                    >Vote{!multiChoice && ` YES`}</Button>
                    {(delegatedVoterRecord && delegatedVoterRecord.length > 0) &&
                        <>
                            <Button
                                size="small"
                                color='success'
                                aria-controls={openDelegateYes ? 'basic-yes-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={openDelegateYes ? 'true' : undefined}
                                onClick={handleDelegateOpenYesToggle}
                                sx={{borderRadius:'17px',textTransform:'none'}}
                            >
                                <ArrowDropDownIcon />
                            </Button>
                            
                            <StyledMenu
                                id="basic-yes-menu"
                                anchorEl={anchorElYes}
                                open={openDelegateYes}
                                onClose={handleDelegateCloseYesToggle}
                                MenuListProps={{
                                    'aria-labelledby': 'basic-button',
                                }}
                                sx={{zIndex:9999}}
                            >
                                <>
                                    <ClickAwayListener 
                                        onClickAway={handleDelegateCloseYesToggle}>
                                        <MenuList id="split-yes-menu" autoFocusItem>
                                            <MenuItem onClick={(event) => handleVote(0, null, true)}>Vote only with my Voting Power</MenuItem>
                                            <Divider />
                                            {delegatedVoterRecord.map((option, index) => (
                                                <MenuItem
                                                    key={`yes-${option}`}
                                                    disabled={votingParticipants.some(item => item.governingTokenOwner === option.account.governingTokenOwner.toBase58())}
                                                    //selected={index === selectedIndex}
                                                    //onClick={(event) => handleMenuItemClick(event, index)}
                                                    onClick={(event) => handleVote(0,option.account.governingTokenOwner.toBase58())}
                                                >
                                                    <Typography variant="caption">Vote with {trimAddress(option.account.governingTokenOwner.toBase58(),3)} delegated Voting Power
                                                    {votingParticipants.some(item => item.governingTokenOwner === option.account.governingTokenOwner.toBase58()) &&
                                                        <CheckCircleIcon fontSize='inherit' sx={{ml:1}} />
                                                    }
                                                    </Typography>
                                                </MenuItem>
                                            ))}
                                            <Divider />
                                            <MenuItem onClick={(event) => handleVote(0,null,true,true)}>Vote with all my delegated Voting Power</MenuItem>
                                            
                                        </MenuList>
                                    </ClickAwayListener>
                                </>
                                
                            </StyledMenu>
                            
                        </>
                    }
                    </>
                :
                    <>
                    <Button
                        variant="outlined"
                        color='error'
                        onClick={handleVoteNo}
                        sx={{borderRadius:'17px',textTransform:'none'}}
                    >Vote NO</Button>
                    {(delegatedVoterRecord && delegatedVoterRecord.length > 0) &&
                        <>
                            <Button
                                size="small"
                                color='error'
                                aria-controls={openDelegateNo ? 'basic-no-menu' : undefined}
                                aria-haspopup="true"
                                aria-expanded={openDelegateNo ? 'true' : undefined}
                                onClick={handleDelegateOpenNoToggle}
                                sx={{borderRadius:'17px',textTransform:'none'}}
                            >
                                <ArrowDropDownIcon />
                            </Button>
                            
                            <StyledMenu
                                id="basic-no-menu"
                                anchorEl={anchorElNo}
                                open={openDelegateNo}
                                onClose={handleDelegateCloseNoToggle}
                                MenuListProps={{
                                    'aria-labelledby': 'basic-no-button',
                                }}
                                sx={{zIndex:9999}}
                            >
                                <>
                                    <ClickAwayListener 
                                        onClickAway={handleDelegateCloseNoToggle}>
                                        <MenuList id="split-no-menu" autoFocusItem>
                                            <MenuItem onClick={(event) => handleVote(1, null, true)}>Vote only with my Voting Power</MenuItem>
                                            <Divider />
                                            {delegatedVoterRecord.map((option, index) => (
                                                <MenuItem
                                                    key={`no-${option}`}
                                                    disabled={votingParticipants.some(item => item.governingTokenOwner === option.account.governingTokenOwner.toBase58())}
                                                    //selected={index === selectedIndex}
                                                    //onClick={(event) => handleMenuItemClick(event, index)}
                                                    onClick={(event) => handleVote(1,option.account.governingTokenOwner.toBase58())}
                                                >
                                                    <Typography variant="caption">Vote with {trimAddress(option.account.governingTokenOwner.toBase58(),3)} delegated Voting Power
                                                    {votingParticipants.some(item => item.governingTokenOwner === option.account.governingTokenOwner.toBase58()) &&
                                                        <CheckCircleIcon fontSize='inherit' sx={{ml:1}} />
                                                    }
                                                    </Typography>
                                                </MenuItem>
                                            ))}
                                            <Divider />
                                            <MenuItem onClick={(event) => handleVote(1,null,true,true)}>Vote with all my delegated Voting Power</MenuItem>
                                            
                                        </MenuList>
                                    </ClickAwayListener>
                                </>
                                
                            </StyledMenu>
                            
                        </>
                    }
                    </>
                }
            </>
        }

        {hasVoted && publicKey &&
            <>
                {(hasVotedVotes > 0 && type === 0) ?
                    <Tooltip title={`You casted ${getFormattedNumberToLocale(hasVotedVotes)} votes for this proposal`}>
                        <Button
                            variant="outlined"
                            color='success'
                            sx={{borderRadius:'17px',textTransform:'none'}}
                        ><CheckCircleIcon /></Button>
                    </Tooltip>
                :
                    <>
                        {hasVotedVotes < 0 &&
                            <Tooltip title={`You casted ${getFormattedNumberToLocale(hasVotedVotes*-1)} votes against this proposal`}>
                                <Button
                                    variant="outlined"
                                    color='error'
                                    sx={{borderRadius:'17px',textTransform:'none'}}
                                ><CheckCircleIcon /></Button>
                            </Tooltip>
                        }
                    </>
                }
            </>
        }
    </>);
}