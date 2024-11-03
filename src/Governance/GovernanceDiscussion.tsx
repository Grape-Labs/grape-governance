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
    GOVERNANCE_CHAT_PROGRAM_ID,
    getGovernanceChatMessages,
} from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
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

export default function GovernanceDiscussion(props: any){
    const [expandInfo, setExpandInfo] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [discussionMessages, setDiscussionMessages] = React.useState(null);
    const proposalPk = props?.proposalAddress;

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

        console.log("Messages Loaded: "+JSON.stringify(messages));

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
                                                {discussionMessages && discussionMessages.map((message: any, index: number) => {
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

                            <Box sx={{ mx: 1, mt: 3 }}>
                                <Grid container alignItems="center">
                                    <Grid item xs>
                                    </Grid>
                                    <Grid item>
                                        <Button
                                            size="small"
                                            color='inherit'
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