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
import { getUnrelinquishedVoteRecords } from '../utils/governanceTools/models/api';
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
  Stack,
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
    const hasVotedSide = props.hasVotedSide || null;
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
    const delegatedVoteOptions = React.useMemo(
        () => (Array.isArray(delegatedVoterRecord) ? delegatedVoterRecord : []),
        [delegatedVoterRecord]
    );

    const StyledMenu = styled(Menu)(({ theme }) => ({
    "& .MuiPaper-root": {
        backgroundColor: "rgba(12,12,16,0.98)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 16,
        color: "#fff",
        minWidth: 0,
        width: "min(340px, calc(100vw - 24px))",
        maxWidth: "calc(100vw - 24px)",
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

    const toBase58Safe = React.useCallback((value: any): string => {
        if (!value) return "";
        if (typeof value === "string") return value;
        return value?.toBase58?.() || "";
    }, []);

    const communityMint58 = React.useMemo(
        () => toBase58Safe(realm?.account?.communityMint || realm?.communityMint),
        [realm?.account?.communityMint, realm?.communityMint, toBase58Safe]
    );

    const findMemberRecordForMint = React.useCallback(
        (records: any[] = [], owner58?: string | null, mint58?: string | null) => {
            if (!owner58 || !mint58) return null;
            return (
                records.find(
                    (item: any) =>
                        toBase58Safe(item?.account?.governingTokenOwner) === owner58 &&
                        toBase58Safe(item?.account?.governingTokenMint) === mint58
                ) || null
            );
        },
        [toBase58Safe]
    );

    const findDelegatedRecordsForMint = React.useCallback(
        (records: any[] = [], delegate58?: string | null, mint58?: string | null) => {
            if (!delegate58 || !mint58) return [];
            return records.filter(
                (item: any) =>
                    toBase58Safe(item?.account?.governanceDelegate) === delegate58 &&
                    toBase58Safe(item?.account?.governingTokenMint) === mint58
            );
        },
        [toBase58Safe]
    );

    const getVoteSideFromLocalRecord = React.useCallback((record: any): 'yes' | 'no' | 'unknown' | null => {
        const vote =
            record?.account?.vote ??
            record?.vote?.vote ??
            record?.quorumWeight?.vote;
        if (vote && vote?.voteType !== undefined && vote?.voteType !== null) {
            const voteType = Number(vote.voteType);
            if (voteType === 0) return 'yes';
            if (voteType === 1) return 'no';
            return 'unknown';
        }

        const legacyYes = Number(
            record?.account?.voteWeight?.yes ??
            record?.vote?.legacyYes ??
            record?.vote?.voteWeight?.yes ??
            record?.quorumWeight?.legacyYes ??
            0
        );
        const legacyNo = Number(
            record?.account?.voteWeight?.no ??
            record?.vote?.legacyNo ??
            record?.vote?.voteWeight?.no ??
            record?.quorumWeight?.legacyNo ??
            0
        );
        if (legacyYes > 0) return 'yes';
        if (legacyNo > 0) return 'no';

        const voterWeight = Number(
            record?.account?.voterWeight ??
            record?.vote?.voterWeight ??
            record?.quorumWeight?.voterWeight ??
            0
        );
        if (voterWeight > 0) return 'unknown';

        return null;
    }, []);

    const getVoteMagnitudeFromLocalRecord = React.useCallback((record: any): number => {
        const rawWeight = Number(
            record?.account?.voterWeight ??
            record?.vote?.voterWeight ??
            record?.quorumWeight?.voterWeight ??
            record?.account?.voteWeight?.yes ??
            record?.account?.voteWeight?.no ??
            record?.vote?.legacyYes ??
            record?.vote?.legacyNo ??
            record?.vote?.voteWeight?.yes ??
            record?.vote?.voteWeight?.no ??
            record?.quorumWeight?.legacyYes ??
            record?.quorumWeight?.legacyNo ??
            0
        );
        const decimals = Number(record?.quorumWeight?.decimals ?? record?.vote?.decimals ?? 0);
        const voteMint = toBase58Safe(
            record?.quorumWeight?.governingTokenMint ??
            record?.vote?.governingTokenMint ??
            record?.account?.governingTokenMint
        );
        const councilMint = toBase58Safe(
            record?.quorumWeight?.councilMint ??
            record?.vote?.councilMint
        );
        const scale = councilMint && voteMint && councilMint === voteMint ? 0 : decimals;
        return +(rawWeight / Math.pow(10, scale)).toFixed(0);
    }, [toBase58Safe]);
    const votedOwners = React.useMemo(() => {
        const owners = new Set<string>();
        if (!Array.isArray(votingParticipants)) return owners;

        for (const participant of votingParticipants) {
            if (participant?.governingTokenOwner) {
                owners.add(participant.governingTokenOwner);
            }
        }

        return owners;
    }, [votingParticipants]);
    const ownOwner58 = publicKey?.toBase58?.() || "";
    const ownRecordedVote = React.useMemo(
        () =>
            (Array.isArray(votingParticipants) ? votingParticipants : []).find(
                (participant: any) => participant?.governingTokenOwner === ownOwner58
            ) || null,
        [votingParticipants, ownOwner58]
    );
    const delegatedCastedVotes = React.useMemo(() => {
        const participants = Array.isArray(votingParticipants) ? votingParticipants : [];
        return delegatedVoteOptions
            .map((option: any) => {
                const owner58 = option?.account?.governingTokenOwner?.toBase58?.() || "";
                if (!owner58) return null;
                const voteRecord =
                    participants.find((participant: any) => participant?.governingTokenOwner === owner58) || null;
                if (!voteRecord) return null;
                return {
                    owner58,
                    memberItem: option,
                    voteRecord,
                    side: getVoteSideFromLocalRecord(voteRecord),
                    magnitude: getVoteMagnitudeFromLocalRecord(voteRecord),
                };
            })
            .filter(Boolean);
    }, [delegatedVoteOptions, votingParticipants, getVoteMagnitudeFromLocalRecord, getVoteSideFromLocalRecord]);
    const ownCastedVote = React.useMemo(() => {
        if (!ownRecordedVote) return null;
        return {
            owner58: ownOwner58,
            memberItem: voterRecord,
            voteRecord: ownRecordedVote,
            side: getVoteSideFromLocalRecord(ownRecordedVote),
            magnitude: getVoteMagnitudeFromLocalRecord(ownRecordedVote),
        };
    }, [ownRecordedVote, ownOwner58, voterRecord, getVoteMagnitudeFromLocalRecord, getVoteSideFromLocalRecord]);
    const castedVoteRows = React.useMemo(() => {
        const rows = [];
        if (ownCastedVote) {
            rows.push({
                ...ownCastedVote,
                label: "Your voting power",
                isOwn: true,
            });
        }
        for (const row of delegatedCastedVotes as any[]) {
            rows.push({
                ...row,
                label: `Delegated from ${trimAddress(row.owner58, 3)}`,
                isOwn: false,
            });
        }
        return rows;
    }, [ownCastedVote, delegatedCastedVotes]);
    const hasAnyCastedVotes = castedVoteRows.length > 0;
    const totalCastedVoteWeight = React.useMemo(
        () => castedVoteRows.reduce((sum: number, row: any) => sum + Number(row?.magnitude || 0), 0),
        [castedVoteRows]
    );
    const hasPendingDelegatedVotes = delegatedVoteOptions.some((option: any) => {
        const owner58 = option?.account?.governingTokenOwner?.toBase58?.() || "";
        return !!owner58 && !votedOwners.has(owner58);
    });
    const hasAnyDelegatedVotes = delegatedVoteOptions.length > 0;
    const canCastCombinedVote = !hasVoted || hasPendingDelegatedVotes;
    const currentOptionVoteSide = type === 0 ? 'yes' : 'no';
    const hasCastedVotesForCurrentOption = castedVoteRows.some(
        (row: any) => (row?.side || 'unknown') === currentOptionVoteSide
    );
    const voteMagnitude = Math.abs(Number(hasVotedVotes || 0));
    const voteDirectionLabel = hasVotedSide === 'yes' ? 'for' : hasVotedSide === 'no' ? 'against' : null;
    const votedForThisOption = (hasVotedSide === 'yes' && type === 0) || (hasVotedSide === 'no' && type === 1);
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
    
    const isCommunityVote = communityMint58 !== "" && communityMint58 === proposalMint58;
    //console.log("**  isCommunityVote: "+JSON.stringify(isCommunityVote));
    //console.log(">>>  realm.account.config?.councilMint?.toBase58(): "+JSON.stringify(realm.account.config?.councilMint?.toBase58()));
    //console.log(">>>  thisitem?.account.governingTokenMint: "+JSON.stringify(thisitem?.account.governingTokenMint));
    
    const handleVoteYes = async () => {
        await handleVote(0, null, true, true)
    }

    const handleVoteNo = async () => {
        await handleVote(1, null, true, true)
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
        
        let memberItem = findMemberRecordForMint(
            rawTokenOwnerRecords,
            publicKey.toBase58(),
            proposalMint58
        );

        
        console.log("memberItem: "+JSON.stringify(memberItem));
        
        let delegatedItems = findDelegatedRecordsForMint(
            rawTokenOwnerRecords,
            publicKey.toBase58(),
            proposalMint58
        );
        
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

        console.log("publicKey: "+publicKey.toBase58())
        if (!publicKey) return;

        const beneficiary = publicKey;
        const governanceAuthority = publicKey;
        const programVersion = await getGrapeGovernanceProgramVersion(
            RPC_CONNECTION,
            new PublicKey(realm.owner),
            new PublicKey(realm.pubkey)
        );
        const allVotingParticipants = Array.isArray(votingParticipants) ? votingParticipants : [];
        const findCastedVoteRecord = (owner58: string) =>
            allVotingParticipants.find((item: any) => item.governingTokenOwner === owner58) || null;
        const findUnrelinquishedVoteRecordForTor = async (tokenOwnerRecordPk: PublicKey) => {
            try {
                const voteRecords = await getUnrelinquishedVoteRecords(
                    RPC_CONNECTION,
                    programId,
                    tokenOwnerRecordPk
                );
                const matchingVoteRecord = (Array.isArray(voteRecords) ? voteRecords : []).find(
                    (item: any) =>
                        toBase58Safe(item?.account?.proposal) === toBase58Safe(proposal.proposalId)
                );
                if (matchingVoteRecord?.pubkey) {
                    return new PublicKey(toBase58Safe(matchingVoteRecord.pubkey));
                }
            } catch (error) {
                console.log("RPC unrelinquished vote lookup failed", error);
            }

            return null;
        };

        const relinquishTargets: Array<{
            label: string;
            memberItem: any;
            castedVoteRecord: any;
        }> = [];

        if (wOwner && memberItem) {
            const ownVoteRecord = findCastedVoteRecord(publicKey.toBase58());
            if (ownVoteRecord) {
                relinquishTargets.push({
                    label: "your voting power",
                    memberItem,
                    castedVoteRecord: ownVoteRecord,
                });
            }
        }

        if (delegatedItems && delegatedItems.length && (delegate || wAllDelegates)) {
            for (const delegateItem of delegatedItems) {
                const owner58 = delegateItem?.account?.governingTokenOwner?.toBase58?.();
                if (!owner58) continue;
                if (!wAllDelegates && delegate !== owner58) continue;

                const castedVoteRecord = findCastedVoteRecord(owner58);
                if (!castedVoteRecord) continue;

                relinquishTargets.push({
                    label: `delegated power from ${trimAddress(owner58, 3)}`,
                    memberItem: delegateItem,
                    castedVoteRecord,
                });

                if (delegate === owner58) break;
            }
        }

        if (!relinquishTargets.length) {
            enqueueSnackbar("No casted votes found to withdraw.", { variant: 'warning' });
            return;
        }

        try{
            enqueueSnackbar(
                relinquishTargets.length > 1 ? `Preparing ${relinquishTargets.length} vote withdrawals…` : `Preparing to withdraw vote`,
                { variant: 'info' }
            );
            const signatures: string[] = [];
            const snackprogress = (key:any) => (
                <CircularProgress sx={{padding:'10px'}} />
            );

            for (let index = 0; index < relinquishTargets.length; index++) {
                const target = relinquishTargets[index];
                const instructions: TransactionInstruction[] = [];
                const tokenOwnerRecordPk58 = toBase58Safe(target.memberItem?.pubkey);
                if (!tokenOwnerRecordPk58) {
                    enqueueSnackbar(`Could not find a token owner record for ${target.label}`, {
                        variant: 'warning',
                    });
                    continue;
                }
                const tokenOwnerRecordPk = new PublicKey(tokenOwnerRecordPk58);
                const voteRecordPk =
                    await findUnrelinquishedVoteRecordForTor(tokenOwnerRecordPk) ||
                    (target?.castedVoteRecord?.voteAddress
                        ? new PublicKey(toBase58Safe(target.castedVoteRecord.voteAddress))
                        : null);

                if (!voteRecordPk) {
                    enqueueSnackbar(`Could not find an unrelinquished vote record for ${target.label}`, {
                        variant: 'warning',
                    });
                    continue;
                }

                await withRelinquishVote(
                    instructions,
                    programId,
                    programVersion,
                    realm?.pubkey ? new PublicKey(realm.pubkey) : new PublicKey(governanceAddress),
                    new PublicKey(proposal.governanceId),
                    new PublicKey(proposal.proposalId),
                    tokenOwnerRecordPk,
                    new PublicKey(proposal.governingTokenMint),
                    voteRecordPk,
                    governanceAuthority,
                    beneficiary
                );

                if (!instructions.length) continue;

                const latestBlockHash = await RPC_CONNECTION.getLatestBlockhash();
                const voteTx = new Transaction();
                voteTx.feePayer = publicKey;
                voteTx.recentBlockhash = latestBlockHash.blockhash;
                voteTx.add(...instructions);

                let cnfrmkey = null;
                try {
                    cnfrmkey = enqueueSnackbar(
                        relinquishTargets.length > 1
                            ? `Confirming withdrawal ${index + 1}/${relinquishTargets.length}`
                            : `Confirming transaction`,
                        { variant: 'info', action:snackprogress, persist: true }
                    );

                    const signature = await sendTransaction(voteTx, RPC_CONNECTION, {
                        skipPreflight: false,
                        preflightCommitment: "confirmed",
                    });

                    await RPC_CONNECTION.confirmTransaction({
                        blockhash: latestBlockHash.blockhash,
                        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                        signature: signature},
                        'confirmed'
                    );

                    signatures.push(signature);
                } finally {
                    if (cnfrmkey) closeSnackbar(cnfrmkey);
                }
            }

            const latestSignature = signatures[signatures.length - 1];
            const action = latestSignature
                ? (key:any) => (
                    <Button href={`https://explorer.solana.com/tx/${latestSignature}`} target='_blank' sx={{color:'white'}}>
                        Signature: {shortenString(latestSignature,5,5)}
                    </Button>
                )
                : undefined;

            enqueueSnackbar(
                signatures.length > 1
                    ? `Removed ${signatures.length} casted votes from this proposal`
                    : `You have removed your participation from this proposal`,
                { variant: 'success', action }
            );

            setTimeout(() => {
                setOpen(false);
                getVotingParticipants();
            }, 3000);
        }catch(e:any){
            enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
        } 
    }

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

        const memberItem = findMemberRecordForMint(rawTokenOwnerRecords, myPk58, proposalMint58);

        const delegatedItems = findDelegatedRecordsForMint(rawTokenOwnerRecords, myPk58, proposalMint58);

        console.log("delegatedItems:", delegatedItems);

        const proposal = {
        governanceId: thisitem.account.governance,
        proposalId: thisitem.pubkey,
        tokenOwnerRecord: thisitem.account.tokenOwnerRecord,
        governingTokenMint: thisitem.account.governingTokenMint,
        };

        const transactionData = { proposal, action: 0 }; // 0 = yes (as per your original)

        if (wOwner && !memberItem) {
        enqueueSnackbar("Voter Record Not Found!", { variant: "error" });
        return;
        }

        const hasRecordedVote = (owner58: string) =>
        (Array.isArray(votingParticipants) ? votingParticipants : []).some(
            (p: any) => p.governingTokenOwner === owner58
        );

        const voteTargets: Array<{
        owner58: string;
        delegate: string | null;
        memberItem: any;
        label: string;
        }> = [];

        if (wOwner) {
        const iAlreadyVoted = hasRecordedVote(myPk58);
        if (!iAlreadyVoted && memberItem) {
            voteTargets.push({
            owner58: myPk58,
            delegate: null,
            memberItem,
            label: "your voting power",
            });
        }
        }

        if (delegatedItems && delegatedItems.length && (delegate || wAllDelegates)) {
        for (const delegateItem of delegatedItems) {
            const owner58 = delegateItem?.account?.governingTokenOwner?.toBase58?.();
            if (!owner58) continue;

            if (hasRecordedVote(owner58)) continue;

            if (wAllDelegates || delegate === owner58) {
                voteTargets.push({
                owner58,
                delegate: owner58,
                memberItem: delegateItem,
                label: `delegated power from ${trimAddress(owner58, 3)}`,
                });
            }

            if (delegate === owner58) {
                break;
            }
        }
        }

        if (!voteTargets.length) {
        enqueueSnackbar("No eligible votes to cast (already voted / no delegates).", {
            variant: "warning",
        });
        return;
        }

        enqueueSnackbar(
        voteTargets.length > 1
            ? `Preparing ${voteTargets.length} vote transactions…`
            : "Preparing to cast vote…",
        { variant: "info" }
        );
        const snackprogress = (key: any) => <CircularProgress sx={{ padding: "10px" }} />;
        try {
            const signatures: string[] = [];

            for (let index = 0; index < voteTargets.length; index++) {
            const target = voteTargets[index];
            const voteTx = await createCastVoteTransaction(
                realm,
                publicKey,
                transactionData,
                target.memberItem,
                target.delegate,
                isCommunityVote,
                multiChoice,
                type
            );

            if (!voteTx) {
                enqueueSnackbar("Additional Plugin Voting Support Coming Soon (NFT, Gateway)", {
                variant: "error",
                });
                return;
            }

            const { blockhash, lastValidBlockHeight } = await RPC_CONNECTION.getLatestBlockhash(
                "confirmed"
            );
            voteTx.recentBlockhash = blockhash;
            voteTx.feePayer = publicKey;

            try {
                const sim = await RPC_CONNECTION.simulateTransaction(voteTx);
                if (sim.value.err) {
                console.log("SIM ERR:", sim.value.err);
                console.log("SIM LOGS:", sim.value.logs);
                enqueueSnackbar(
                    `Simulation failed for ${target.label}: ${JSON.stringify(sim.value.err)}`,
                    { variant: "error" }
                );
                return;
                }
            } catch (e) {
                console.warn("simulateTransaction failed (continuing):", e);
            }

            let cnfrmkey = null;
            try {
                cnfrmkey = enqueueSnackbar(
                voteTargets.length > 1
                    ? `Confirming vote ${index + 1}/${voteTargets.length}`
                    : "Confirming transaction",
                {
                    variant: "info",
                    action: snackprogress,
                    persist: true,
                }
                );

                const signature = await sendTransaction(voteTx, RPC_CONNECTION, {
                skipPreflight: false,
                preflightCommitment: "confirmed",
                });

                await RPC_CONNECTION.confirmTransaction(
                    { signature, blockhash, lastValidBlockHeight },
                    "confirmed"
                );

                signatures.push(signature);
            } finally {
                if (cnfrmkey) {
                closeSnackbar(cnfrmkey);
                }
            }
            }

            const latestSignature = signatures[signatures.length - 1];
            const action = latestSignature
            ? (key: any) => (
                <Button
                href={`https://explorer.solana.com/tx/${latestSignature}`}
                target="_blank"
                sx={{ color: "white" }}
                >
                Signature: {shortenString(latestSignature, 5, 5)}
                </Button>
            )
            : undefined;

            enqueueSnackbar(
            signatures.length > 1
                ? `Confirmed ${signatures.length} votes with all available voting power`
                : "Vote confirmed",
            { variant: "success", action }
            );
        } catch (e: any) {
            console.error("vote tx failed:", e);
            enqueueSnackbar(e?.message ? `${e.name}: ${e.message}` : e?.name || "Vote failed", {
            variant: "error",
            });
            return;
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
        if (!publicKey || !realm?.pubkey) return;
        
        const rawTokenOwnerRecords = await getTokenOwnerRecordsByRealmIndexed(new PublicKey(realm.pubkey).toBase58(), realm.owner ? new PublicKey(realm.owner).toBase58() : null, publicKey.toBase58());
        setMemberMap(rawTokenOwnerRecords);

        let memberItem = findMemberRecordForMint(
            rawTokenOwnerRecords,
            publicKey.toBase58(),
            proposalMint58
        );
        
        setVoterRecord(memberItem);
        //console.log("memberItem: "+JSON.stringify(memberItem));
        
        let delegatedItems = findDelegatedRecordsForMint(
            rawTokenOwnerRecords,
            publicKey.toBase58(),
            proposalMint58
        );
        
        setDelegatedVoterRecord(delegatedItems);
        //console.log("delegatedItems: "+JSON.stringify(delegatedItems));

        // check if this is a community proposal
        // if community proposal check if the voter is a council member & check if the delegate is a council member
        if (realm && realm.account && realm.account.config && realm.account.config?.councilMint &&
            realm.account.config.councilMint.toBase58() !== thisitem.account.governingTokenMint.toBase58()){
            // this is a community proposal so now lets check
                //rawTokenOwnerRecords
            console.log("community proposal, checking council members...");
            let councilMemberItem = findMemberRecordForMint(
                rawTokenOwnerRecords,
                publicKey.toBase58(),
                realm.account.config.councilMint.toBase58()
            );
                console.log("councilMemberItem: "+JSON.stringify(councilMemberItem));
            setCouncilVoterRecord(councilMemberItem);
            
            let councilDelegateMemberItem =
                findDelegatedRecordsForMint(
                    rawTokenOwnerRecords,
                    publicKey.toBase58(),
                    realm.account.config.councilMint.toBase58()
                )?.[0] || null;
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
        if (publicKey && realm?.pubkey && proposalMint58){
            console.log("Step 1.")
            loadMemberMap();
        }
    }, [publicKey, realm?.pubkey, proposalMint58]);

    const voteTone = type === 0
        ? {
            main: "#2fb36d",
            dark: "#1f7a49",
            soft: "rgba(47,179,109,0.18)",
            border: "rgba(92,219,146,0.42)",
          }
        : {
            main: "#d45757",
            dark: "#8f3030",
            soft: "rgba(212,87,87,0.18)",
            border: "rgba(238,121,121,0.42)",
          };

    const splitVoteGroupSx = {
        borderRadius: "20px",
        overflow: "hidden",
        width: { xs: "100%", sm: "auto" },
        maxWidth: "100%",
        boxShadow: `0 14px 34px ${voteTone.soft}`,
        border: `1px solid ${voteTone.border}`,
        background: `linear-gradient(180deg, ${voteTone.soft}, rgba(15,18,24,0.9))`,
        "& .MuiButton-root": {
            textTransform: "none",
            borderColor: voteTone.border,
            color: "#fff",
        },
        "& .MuiButtonGroup-grouped:not(:last-of-type)": {
            borderColor: voteTone.border,
        },
    };

    const splitVoteMainButtonSx = {
        borderRadius: 0,
        px: { xs: 1.5, sm: 2.4 },
        py: 1.25,
        minHeight: 70,
        minWidth: { xs: 0, sm: 224 },
        width: { xs: "100%", sm: "auto" },
        maxWidth: "100%",
        background: `linear-gradient(180deg, ${voteTone.main}, ${voteTone.dark})`,
        fontWeight: 700,
        letterSpacing: 0.2,
        "&:hover": {
            background: `linear-gradient(180deg, ${voteTone.main}, ${voteTone.dark})`,
            filter: "brightness(1.06)",
        },
    };

    const splitVoteCaretButtonSx = {
        borderRadius: 0,
        px: 1.15,
        minWidth: 48,
        background: "rgba(6,10,16,0.34)",
        "&:hover": {
            background: "rgba(6,10,16,0.5)",
        },
    };

    const inactiveVoteButtonSx = {
        borderRadius: "20px",
        textTransform: "none",
        px: 2,
        py: 1.1,
        minHeight: 68,
        borderColor: voteTone.border,
        color: "#fff",
        background: "rgba(255,255,255,0.03)",
    };

    const castedVoteSummarySx = {
        borderRadius: "20px",
        textTransform: "none",
        px: 2,
        py: 1.15,
        minHeight: 68,
        borderColor: voteTone.border,
        color: "#fff",
        background: `linear-gradient(180deg, ${voteTone.soft}, rgba(255,255,255,0.04))`,
        boxShadow: `0 10px 28px ${voteTone.soft}`,
    };

    const renderManageVoteMenuItems = (side: 'yes' | 'no') => {
        if (!hasAnyCastedVotes) return null;
        const matchingDelegatedVotes = castedVoteRows.filter(
            (row: any) => !row.isOwn && (row.side || 'unknown') === side
        );
        const ownMatchesSide = ownCastedVote && (ownCastedVote.side || 'unknown') === side;

        return (
            <>
                <Divider />
                <MenuItem onClick={handleClickOpen}>
                    Manage casted votes
                </MenuItem>
                {ownMatchesSide && (
                    <MenuItem onClick={() => handleRelinquishVotes(null, true)}>
                        Withdraw my casted vote
                    </MenuItem>
                )}
                {matchingDelegatedVotes.map((row: any) => (
                    <MenuItem
                        key={`withdraw-${side}-${row.owner58}`}
                        onClick={() => handleRelinquishVotes(row.owner58)}
                    >
                        Withdraw delegated vote from {trimAddress(row.owner58, 3)}
                    </MenuItem>
                ))}
                {matchingDelegatedVotes.length > 1 && (
                    <MenuItem onClick={() => handleRelinquishVotes(null, false, true)}>
                        Withdraw all delegated casted votes
                    </MenuItem>
                )}
                {castedVoteRows.length > 1 && (
                    <MenuItem onClick={() => handleRelinquishVotes(null, true, true)}>
                        Withdraw all casted votes
                    </MenuItem>
                )}
            </>
        );
    };

    return (
  <>
    {!publicKey || thisitem.account?.state !== 2 ? (
      <>
        {type === 0 ? (
          <Button
            variant="outlined"
            color="success"
            disabled
            sx={inactiveVoteButtonSx}
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
            sx={inactiveVoteButtonSx}
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
                {canCastCombinedVote ? (
                  <ButtonGroup
                    variant="outlined"
                    color="success"
                    sx={splitVoteGroupSx}
                  >
                    <Button
                      onClick={handleVoteYes}
                      sx={splitVoteMainButtonSx}
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

                          <Grid item sx={{ minWidth: { xs: 0, sm: "140px" }, width: "100%" }}>
                            <Divider sx={{ my: 0.5, opacity: 0.35 }} />
                            <Typography sx={{ fontSize: "11px", opacity: 0.9, textAlign: "center" }}>
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
                        sx={splitVoteCaretButtonSx}
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
                        ...inactiveVoteButtonSx,
                        minWidth: 48,
                        px: 1.15,
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
                      <MenuItem disabled={!canCastCombinedVote} onClick={() => handleVote(0, null, true, true)}>
                        Vote with all Voting Power
                      </MenuItem>

                      <Divider />

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
                      <MenuItem disabled>
                        Cast delegated votes one at a time
                      </MenuItem>
                      {renderManageVoteMenuItems('yes')}
                    </MenuList>
                  </ClickAwayListener>
                </StyledMenu>
              </>
            ) : (
              <>
                {/* NO: keep your existing behavior (button + separate caret/menu) */}
                {canCastCombinedVote ? (
                  <ButtonGroup
                    variant="outlined"
                    color="error"
                    sx={splitVoteGroupSx}
                  >
                    <Button
                      onClick={handleVoteNo}
                      sx={splitVoteMainButtonSx}
                    >
                      {title && subtitle && showIcon ? (
                        <Grid container direction="column" alignItems="center">
                          <Grid item>
                            <Grid container direction="row" alignItems="center">
                              <Grid item>
                                <ThumbDownIcon fontSize="small" sx={{ mr: 0.5 }} />
                              </Grid>
                              <Grid item>{title}</Grid>
                            </Grid>
                          </Grid>
                          <Grid item sx={{ minWidth: { xs: 0, sm: "140px" }, width: "100%" }}>
                            <Divider sx={{ my: 0.5, opacity: 0.35 }} />
                            <Typography sx={{ fontSize: "11px", opacity: 0.9, textAlign: "center" }}>
                              {subtitle}
                            </Typography>
                          </Grid>
                        </Grid>
                      ) : (
                        <>Vote NO</>
                      )}
                    </Button>

                    {(delegatedVoterRecord && delegatedVoterRecord.length > 0) && (
                      <Button
                        size="small"
                        aria-controls={openDelegateNo ? "basic-no-menu" : undefined}
                        aria-haspopup="true"
                        aria-expanded={openDelegateNo ? "true" : undefined}
                        onClick={handleDelegateOpenNoToggle}
                        sx={splitVoteCaretButtonSx}
                      >
                        <ArrowDropDownIcon />
                      </Button>
                    )}
                  </ButtonGroup>
                ) : (
                  hasAnyDelegatedVotes && (
                    <Button
                      size="small"
                      color="error"
                      aria-controls={openDelegateNo ? "basic-no-menu" : undefined}
                      aria-haspopup="true"
                      aria-expanded={openDelegateNo ? "true" : undefined}
                      onClick={handleDelegateOpenNoToggle}
                      sx={{
                        ...inactiveVoteButtonSx,
                        minWidth: 48,
                        px: 1.15,
                      }}
                    >
                      <ArrowDropDownIcon />
                    </Button>
                  )
                )}

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
                      <MenuItem disabled={!canCastCombinedVote} onClick={() => handleVote(1, null, true, true)}>
                        Vote with all Voting Power
                      </MenuItem>

                      <Divider />

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
                      <MenuItem disabled>
                        Cast delegated votes one at a time
                      </MenuItem>
                      {renderManageVoteMenuItems('no')}
                    </MenuList>
                  </ClickAwayListener>
                </StyledMenu>
              </>
            )}
          </>
        )}

        {(hasAnyCastedVotes && publicKey && !canCastCombinedVote) && (
          <>
            {title && subtitle && showIcon ? (
              <>
                <Tooltip
                  title={
                    hasAnyCastedVotes
                      ? `${castedVoteRows.length} casted vote${castedVoteRows.length > 1 ? 's' : ''} ready to manage`
                      : ``
                  }
                >
                  <Button
                    variant="outlined"
                    onClick={() =>
                      state === 2 &&
                      hasAnyCastedVotes &&
                      handleClickOpen()
                    }
                    color={type === 0 ? "success" : "error"}
                    sx={castedVoteSummarySx}
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
                            {hasCastedVotesForCurrentOption
                              ? `${castedVoteRows.length} casted vote${castedVoteRows.length > 1 ? 's' : ''} to manage`
                              : subtitle}
                            {hasCastedVotesForCurrentOption ? (
                              <CheckCircleIcon fontSize="inherit" sx={{ ml: 0.5 }} />
                            ) : null}
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
                    Manage Casted Votes
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
                          <Box sx={{ my: 2.25, mx: 2 }}>
                            <Grid container alignItems="center" spacing={1}>
                              <Grid item xs>
                                <Typography gutterBottom variant="h5" component="div" sx={{ mb: 0.5 }}>
                                  Votes Casted
                                </Typography>
                                <Typography color="text.secondary" variant="body2">
                                  Withdraw your own vote or any delegated votes you cast from this proposal.
                                </Typography>
                              </Grid>
                              <Grid item>
                                <Chip
                                  size="small"
                                  label={`${castedVoteRows.length} vote${castedVoteRows.length > 1 ? 's' : ''}`}
                                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }}
                                  variant="outlined"
                                />
                              </Grid>
                            </Grid>
                            <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={`Total weight ${getFormattedNumberToLocale(totalCastedVoteWeight)}`}
                                sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.18)' }}
                                variant="outlined"
                              />
                              {hasPendingDelegatedVotes ? (
                                <Chip
                                  size="small"
                                  label="Pending delegated votes remain"
                                  sx={{ color: '#f8d58b', borderColor: 'rgba(248,213,139,0.35)' }}
                                  variant="outlined"
                                />
                              ) : (
                                <Chip
                                  size="small"
                                  label="All available delegated votes are casted"
                                  sx={{ color: '#8ee0ab', borderColor: 'rgba(142,224,171,0.35)' }}
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          </Box>
                        </Box>
                        <Box sx={{ px: 2, width: '100%' }}>
                          <List dense sx={{ py: 0 }}>
                            {castedVoteRows.map((row: any) => {
                              const sideLabel =
                                row?.side === 'yes'
                                  ? 'For'
                                  : row?.side === 'no'
                                  ? 'Against'
                                  : 'Cast';
                              const sideColor =
                                row?.side === 'yes'
                                  ? '#2fb36d'
                                  : row?.side === 'no'
                                  ? '#d45757'
                                  : '#9aa4b2';
                              return (
                                <React.Fragment key={`casted-${row.owner58}`}>
                                  <ListItem
                                    secondaryAction={
                                      <Button
                                        size="small"
                                        color="inherit"
                                        variant="outlined"
                                        sx={{ borderRadius: '14px', borderColor: 'rgba(255,255,255,0.12)' }}
                                        onClick={() =>
                                          row.isOwn
                                            ? handleRelinquishVotes(null, true)
                                            : handleRelinquishVotes(row.owner58)
                                        }
                                      >
                                        Withdraw
                                      </Button>
                                    }
                                  >
                                    <ListItemText
                                      primary={
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                                          <Typography variant="body2" sx={{ color: '#fff' }}>
                                            {row.label}
                                          </Typography>
                                          <Chip
                                            size="small"
                                            label={sideLabel}
                                            variant="outlined"
                                            sx={{ color: sideColor, borderColor: sideColor, height: 22 }}
                                          />
                                        </Stack>
                                      }
                                      secondary={
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                                          {getFormattedNumberToLocale(row.magnitude)} vote{Number(row.magnitude) === 1 ? '' : 's'}
                                        </Typography>
                                      }
                                    />
                                  </ListItem>
                                  <Divider component="li" light />
                                </React.Fragment>
                              );
                            })}
                          </List>
                        </Box>
                      </Grid>
                    </DialogContentText>
                  </DialogContent>

                  <DialogActions>
                    {castedVoteRows.length > 1 ? (
                      <Button
                        color="success"
                        onClick={() => handleRelinquishVotes(null, true, true)}
                        sx={{ borderRadius: "17px" }}
                      >
                        <DownloadIcon fontSize="inherit" sx={{ mr: 1 }} /> Withdraw All Casted Votes
                      </Button>
                    ) : (
                      <Button
                        color="success"
                        onClick={() => handleRelinquishVotes(null, true)}
                        sx={{ borderRadius: "17px" }}
                      >
                        <DownloadIcon fontSize="inherit" sx={{ mr: 1 }} /> Withdraw Vote
                      </Button>
                    )}
                  </DialogActions>
                </Dialog>
              </>
            ) : (
              <>
                {hasCastedVotesForCurrentOption && type === 0 ? (
                  <Tooltip
                    title={
                      hasAnyCastedVotes &&
                      `${castedVoteRows.length} casted vote${castedVoteRows.length > 1 ? 's' : ''} ready to manage`
                    }
                  >
                        <Button
                          variant="outlined"
                          color="success"
                          sx={castedVoteSummarySx}
                          onClick={() => hasAnyCastedVotes && handleClickOpen()}
                        >
                      <CheckCircleIcon />
                    </Button>
                  </Tooltip>
                ) : (
                  <>
                    {hasCastedVotesForCurrentOption && (
                      <Tooltip
                        title={
                          hasAnyCastedVotes &&
                          `${castedVoteRows.length} casted vote${castedVoteRows.length > 1 ? 's' : ''} ready to manage`
                        }
                      >
                        <Button
                          variant="outlined"
                          color="error"
                          sx={castedVoteSummarySx}
                          onClick={() => hasAnyCastedVotes && handleClickOpen()}
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
