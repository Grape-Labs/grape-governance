import { 
    getGovernance,
    getRealm, 
    getAllProposals, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    tryGetRealmConfig, 
    getRealmConfig  } from '@solana/spl-governance';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';

import {
  Typography,
  Button,
  Grid,
  Box,
  Paper,
  Table,
  TableContainer,
  TableCell,
  TableHead,
  TableBody,
  TableFooter,
  TableRow,
  TablePagination,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  Badge,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import GovernanceNavigation from './GovernanceNavigation'; 
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import { GovernanceProposalDialog } from './GovernanceProposalDialog';
import moment from 'moment';

import InfoIcon from '@mui/icons-material/Info';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AssuredWorkloadIcon from '@mui/icons-material/AssuredWorkload';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import CloseIcon from '@mui/icons-material/Close';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import LastPageIcon from '@mui/icons-material/LastPage';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import TimerIcon from '@mui/icons-material/Timer';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import IconButton from '@mui/material/IconButton';

import PropTypes from 'prop-types';
import { 
    PROXY, 
    RPC_CONNECTION,
    TX_RPC_ENDPOINT, 
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

const GOVERNANCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing w/errors!',
}

TablePaginationActions.propTypes = {
    count: PropTypes.number.isRequired,
    onPageChange: PropTypes.func.isRequired,
    page: PropTypes.number.isRequired,
    rowsPerPage: PropTypes.number.isRequired,
};

function TablePaginationActions(props) {
    const theme = useTheme();
    const { count, page, rowsPerPage, onPageChange } = props;
  
    const handleFirstPageButtonClick = (event) => {
        onPageChange(event, 0);
    };

    const handleBackButtonClick = (event) => {
        onPageChange(event, page - 1);
    };
  
    const handleNextButtonClick = (event) => {
        onPageChange(event, page + 1);
    };
  
    const handleLastPageButtonClick = (event) => {
        onPageChange(event, Math.max(0, Math.ceil(count / rowsPerPage) - 1));
    };
    
    return (
        <Box sx={{ flexShrink: 0, ml: 2.5 }}>
            <IconButton
                onClick={handleFirstPageButtonClick}
                disabled={page === 0}
                aria-label="first page"
            >
                {theme.direction === "rtl" ? <LastPageIcon /> : <FirstPageIcon />}
            </IconButton>
            <IconButton
                onClick={handleBackButtonClick}
                disabled={page === 0}
                aria-label="previous page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowRight />
                ) : (
                    <KeyboardArrowLeft />
                )}
            </IconButton>
            <IconButton
                onClick={handleNextButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="next page"
            >
                {theme.direction === "rtl" ? (
                    <KeyboardArrowLeft />
                ) : (
                    <KeyboardArrowRight />
                )}
            </IconButton>
            <IconButton
                onClick={handleLastPageButtonClick}
                disabled={page >= Math.ceil(count / rowsPerPage) - 1}
                aria-label="last page"
            >
                {theme.direction === "rtl" ? <FirstPageIcon /> : <LastPageIcon />}
            </IconButton>
        </Box>
    );
  }

function RenderGovernanceTable(props:any) {
    const endTimer = props.endTimer;
    const realm = props.realm;
    const memberMap = props.memberMap;
    const thisToken = props.thisToken;
    const tokenMap = props.tokenMap;
    const governingTokenDecimals = props.governingTokenDecimals;
    const governanceAddress = props.governanceAddress;
    const governanceType = props.governanceType;
    const governanceLookup = props.governanceLookup;
    const cachedGovernance = props.cachedGovernance;
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const governanceToken = props.governanceToken;
    const proposals = props.proposals;
    const nftBasedGovernance = props.nftBasedGovernance;
    const token = props.token;
    const { publicKey } = useWallet();
    const [propTokenDecimals, setPropTokenDecimals] = React.useState(token?.decimals || 6);
    const [page, setPage] = React.useState(0);
    const [rowsPerPage, setRowsPerPage] = React.useState(10);
    // Avoid a layout jump when reaching the last page with empty rows.
    const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - proposals.length) : 0;

    const handleChangePage = (event:any, newPage:number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event:any) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };
    
    function GetProposalStatus(props: any){
        const thisitem = props.item;
        const [thisGovernance, setThisGovernance] = React.useState(props.cachedGovernnace);

        React.useEffect(() => { 
            if (thisitem.account?.state === 2){ // if voting state
                if (!thisGovernance){
                    //console.log("get gov props")
                    //getGovernanceProps()
                }
            }
        }, [thisitem, !thisGovernance]);

        // calculate time left
        // /60/60/24 to get days
        
        return (
            <>
                <TableCell  align="center">
                    <Typography variant="h6">
                        <Tooltip title={
                            <>
                                <>
                                {thisGovernance?.governance?.account?.config?.baseVotingTime ?
                                    `Ending ${moment.unix(Number(thisitem.account?.draftAt)+(Number(thisGovernance?.governance?.account?.config?.baseVotingTime))).fromNow()}`
                                :
                                    <>
                                    {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                        <>{`Started: ${thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))}`}<br/>{`Ended: ${thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.votingCompletedAt))).format("MMMM D, YYYY, h:mm a"))}`}</>
                                    :
                                        `Created: ${thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))}`
                                    }
                                    </>
                                } 
                                </>
                            </>
                            }>
                            
                            <Button sx={{borderRadius:'17px',color:'inherit',textTransform:'none'}}>
                                {GOVERNANCE_STATE[thisitem.account?.state]}
                                    <>
                                    {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                        <>
                                            { (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                                <CheckCircleOutlineIcon sx={{ fontSize:"small", color:"green",ml:1}} />
                                            :
                                                <CancelOutlinedIcon sx={{ fontSize:"small", color:"red",ml:1}} />
                                            }
                                        </>
                                    :
                                        <>
                                        { thisitem.account?.state === 2 ?
                                            <TimerIcon sx={{ fontSize:"small",ml:1}} />
                                        
                                        : 
                                            <CancelOutlinedIcon sx={{ fontSize:"small", color:"red",ml:1}} />
                                        }
                                        </>
                                    }
                                    </>
                            </Button>
                        </Tooltip>
                    </Typography>
                </TableCell>
            </>
        )
    }

    React.useEffect(() => { 
        if (realm)
            endTimer();
    }, [realm]);

    if (loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} color="inherit" />
            </Box>
            
        )
    }

    
        return (
            
            <TableContainer component={Paper} sx={{background:'none'}}>
                <Table sx={{ minWidth: 650 }}>
                    <StyledTable sx={{ minWidth: 500 }} size="small" aria-label="Portfolio Table">
                        <TableHead>
                            <TableRow>
                                <TableCell><Typography variant="caption">Name</Typography></TableCell>
                                <TableCell align="center" sx={{width:"12.5%"}}><Typography variant="caption">Proposed</Typography></TableCell>
                                <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">Yes</Typography></TableCell>
                                <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">No</Typography></TableCell>
                                <TableCell align="center" sx={{width:"1%"}}><Typography variant="caption">Status</Typography></TableCell>
                                <TableCell align="center"><Typography variant="caption">Details</Typography></TableCell>
                                
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {/*proposals && (proposals).map((item: any, index:number) => (*/}
                            {proposals && 
                            <>  
                                {(rowsPerPage > 0
                                    ? proposals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    : proposals
                                ).map((item:any, index:number) => (
                                <>
                                    {/*console.log("item: "+JSON.stringify(item))*/}
                                    {item?.pubkey && item?.account &&
                                        <>
                                            <TableRow key={index} sx={{borderBottom:"none"}}>
                                                <TableCell>
                                                    <GovernanceProposalDialog governanceType={governanceType} isCouncil={realm.account.config?.councilMint === new PublicKey(item.account?.governingTokenMint).toBase58()} state={item.account?.state} title={item.account?.name} description={item.account?.descriptionLink} governanceLookup={governanceLookup} governanceAddress={governanceAddress} cachedGovernance={(cachedGovernance !== proposals) ? proposals : cachedGovernance} item={item} realm={realm} tokenMap={tokenMap} memberMap={memberMap} governanceToken={governanceToken} />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                        {`${item.account?.draftAt ? (moment.unix(Number((item.account?.draftAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                    </Typography>

                                                </TableCell>
                                                <TableCell>
                                                    {item.account.yesVotesCount ?
                                                        <Typography variant="h6">
                                                            
                                                            <Tooltip title={realm.account.config?.councilMint === item.account?.governingTokenMint?.toBase58() ?
                                                                    <>{Number(item.account.yesVotesCount).toLocaleString()}</>
                                                                :
                                                                <>
                                                                        <>
                                                                        {
                                                                        (Number(Number(item.account.yesVotesCount)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()
                                                                        }</>
                                                                    

                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'#eee',borderRadius:'17px',textTransform:'none'}}>
                                                                    {Number(item.account.yesVotesCount) > 0 ?
                                                                        <>
                                                                        {`${(((Number(item.account.yesVotesCount))/((Number(item.account.noVotesCount))+(Number(item.account.yesVotesCount))))*100).toFixed(2)}%`}
                                                                        </>
                                                                    :
                                                                    <>0%</>
        }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    :
                                                        <Typography variant="h6">
                                                            {/*console.log("governingTokenMint: "+item.account.governingTokenMint.toBase58())*/}
                                                            {/*console.log("vote: "+JSON.stringify(item.account))*/}
                                                            
                                                            <Tooltip title={(realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === new PublicKey(item.account?.governingTokenMint).toBase58()) ?
                                                                <>{Number(Number(item.account?.options[0].voteWeight)).toLocaleString()}</>
                                                                :
                                                                <>
                                                                    {Number((Number(item.account?.options[0].voteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                </>

                                                                }
                                                            >
                                                                <Button sx={{color:'white',borderRadius:'17px',textTransform:'none'}}>
                                                                    {Number(item.account?.options[0].voteWeight) > 0 ?
                                                                    <>
                                                                    {`${(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                    </>
                                                                    :
                                                                    <>0%</>
        }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }
                                                    {(item.account?.options && item.account?.options[0]?.voterWeight) &&
                                                        <Typography variant="h6">
                                                            {/*console.log("vote: "+JSON.stringify(item.account))*/}
                                                            <Tooltip title={tokenMap.get(item.account.governingTokenMint.toBase58()) ?
                                                                <>
                                                                {Number((Number(item.account?.options[0].voterWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                </>
                                                                :
                                                                <>
                                                                    {Number(item.account?.options[0].voterWeight).toLocaleString()}
                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'white',borderRadius:'17px',textTransform:'none'}}>
                                                                    {Number(item.account?.options[0].voterWeight) > 0 ?
                                                                    <>
                                                                        {`${(((Number(item.account?.options[0].voterWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voterWeight))))*100).toFixed(2)}%`}
                                                                    </>
                                                                    :
                                                                    <>0%</>
        }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }
                                                </TableCell>
                                                <TableCell>

                                                    {item.account.noVotesCount &&
                                                            <Typography variant="h6">
                                                                
                                                                <Tooltip title={realm.account.config?.councilMint === item.account?.governingTokenMint?.toBase58() ?
                                                                        <>{Number(item.account.noVotesCount).toLocaleString()}</>
                                                                    :
                                                                    <>
                                                                        <>{Number((Number(item.account.noVotesCount)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}</>
                                                                    </>
                                                                    }
                                                                >
                                                                    <Button sx={{color:'#eee',borderRadius:'17px',textTransform:'none'}}>
                                                                        {Number(item.account.noVotesCount) > 0 ?
                                                                        <>
                                                                        {`${(((Number(item.account.noVotesCount))/((Number(item.account.noVotesCount))+(Number(item.account.yesVotesCount))))*100).toFixed(2)}%`}
                                                                        </>
                                                                        :
                                                                        <>0%</>
            }
                                                                    </Button>
                                                                </Tooltip>
                                                            </Typography>
                                                    }

                                                    
                                                    {item.account?.denyVoteWeight && 
                                                        <Typography variant="h6">
                                                            <Tooltip title={Number(item.account?.denyVoteWeight) <= 1 ?
                                                                <>
                                                                    {Number(item.account?.denyVoteWeight).toLocaleString()}
                                                                </>
                                                                :
                                                                <>
                                                                    {Number((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals )).toFixed(0)).toLocaleString()}
                                                                </>
                                                                }
                                                            >
                                                                <Button sx={{color:'white',borderRadius:'17px',textTransform:'none'}}>
                                                                    {Number(item.account?.denyVoteWeight) > 0 ?
                                                                    <>
                                                                    {`${(((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals ))/((Number(item.account?.denyVoteWeight)/Math.pow(10, governingTokenDecimals ))+(Number(item.account?.options[0].voteWeight)/Math.pow(10, governingTokenDecimals ))))*100).toFixed(2)}%`}
                                                                    </>:
                                                                    <>0%</>
                                                                    }
                                                                </Button>
                                                            </Tooltip>
                                                        </Typography>
                                                    }
                                                </TableCell>
                                                <GetProposalStatus item={item} cachedGovernance={cachedGovernance} />
                                                <TableCell align="center">
                                                    <GovernanceProposalDialog governanceLookup={governanceLookup} governanceAddress={governanceAddress} cachedGovernance={cachedGovernance} item={item} realm={realm} tokenMap={tokenMap} memberMap={memberMap} governanceToken={governanceToken} />
                                                </TableCell>
                                            </TableRow>
                                        </>
                                    }
                                </>

                            ))}
                            {/*emptyRows > 0 && (
                                <TableRow style={{ height: 53 * emptyRows }}>
                                    <TableCell colSpan={5} />
                                </TableRow>
                            )*/}
                            </>
                            }
                        </TableBody>
                        
                        <TableFooter>
                            <TableRow>
                                <TablePagination
                                rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                                colSpan={5}
                                count={proposals && proposals.length}
                                rowsPerPage={rowsPerPage}
                                page={page}
                                SelectProps={{
                                    inputProps: {
                                    'aria-label': 'rows per page',
                                    },
                                    native: true,
                                }}
                                onPageChange={handleChangePage}
                                onRowsPerPageChange={handleChangeRowsPerPage}
                                ActionsComponent={TablePaginationActions}
                                />
                            </TableRow>
                        </TableFooter>
                        
                        
                    </StyledTable>
                </Table>
            </TableContainer>
        )
}

export function GovernanceCachedView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const governanceAddress = urlParams;
    const [cachedRealm, setCachedRealm] = React.useState(null);
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    //const governanceAddress = props.governanceAddress;
    const [loading, setLoading] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(null);
    const [realm, setRealm] = React.useState(null);
    const [realmName, setRealmName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const connection = RPC_CONNECTION;
    const { publicKey, wallet } = useWallet();
    const [proposals, setProposals] = React.useState(null);
    const [participating, setParticipating] = React.useState(false)
    const [participatingRealm, setParticipatingRealm] = React.useState(null)
    const [nftBasedGovernance, setNftBasedGovernance] = React.useState(false);
    const [thisToken, setThisToken] = React.useState(null);
    const [totalVaultValue, setTotalVaultValue] = React.useState(null);
    const [totalProposals, setTotalProposals] = React.useState(null);
    const [totalPassed, setTotalPassed] = React.useState(null);
    const [totalDefeated, setTotalDefeated] = React.useState(null);
    const [totalVotesCasted, setTotalVotesCasted] = React.useState(null);
    const [totalCouncilVotesCasted, setTotalCouncilVotesCasted] = React.useState(null);
    const [governingTokenMint, setGoverningTokenMint] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [governanceType, setGovernanceType] = React.useState(0);
    const [cachedGovernance, setCachedGovernance] = React.useState(null);
    const [cachedTimestamp, setCachedTimestamp] = React.useState(null);

    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);

    const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    function VotingPower(props: any){
        const tArray = props.tokenArray;
        const pRealm = props.participatingRealm;
        //const [thisToken, setThisToken] = React.useState(null);

        React.useEffect(() => { 
            if (tArray){
                for (const token of tArray){
                    if (token.address === participatingRealm?.account?.governingTokenMint.toBase58()){
                        setThisToken(token);
                    }
                }
            }
        }, [pRealm]);

        return (
            <>
            {thisToken && 
                <>
                    {getFormattedNumberToLocale(formatAmount(parseInt(participatingRealm?.account?.governingTokenDepositAmount)/Math.pow(10, +thisToken?.decimals)))} votes
                </>
            }
            </>
        );

    }

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tmap = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map())
                setTokenMap(tmap);
                setTokenArray(tarray);
                return tmap;
            });
        } catch(e){console.log("ERR: "+e)}
    }

    const getGovernanceParameters = async (cached_governance:any) => {
        if (!loading){
            setRealm(null);
            setRealmName(null);
            setMemberMap(null);

            startTimer();
            setLoading(true);
            try{
                    
                console.log("SPL Governance: "+governanceAddress);
                
                //console.log("cached_governance: "+JSON.stringify(cached_governance));
                
                const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
                let grealm = null;

                if (cachedRealm){
                    console.log("Realm from cache");
                    //console.log("cacheRealm: "+JSON.stringify(cachedRealm))
                    grealm = cachedRealm;    
                } else{
                    grealm = await getRealm(RPC_CONNECTION, new PublicKey(governanceAddress))
                }
                setRealm(grealm);
                setRealmName(grealm.account.name);
                
                //let ggov = await getGovernance(RPC_CONNECTION, new PublicKey(grealm.owner))

                const realmPk = new PublicKey(grealm?.pubkey);
                //console.log("realmPk: "+realmPk)
                // Check if we have this cached
                //console.log("cachedMemberMap "+JSON.stringify(cachedMemberMap));
                let rawTokenOwnerRecords = null;
                if (cachedMemberMap){
                    console.log("Members from cache");
                    rawTokenOwnerRecords = cachedMemberMap;
                } else{
                    rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
                    
                }
                
                setMemberMap(rawTokenOwnerRecords);
                

                let gTD = 0;
                
                let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account?.communityMint))
                //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
                gTD = tokenDetails.value.data.parsed.info.decimals;
                
                setGoverningTokenDecimals(gTD);

                if (grealm.account?.communityMint){
                    try{
                        
                        //const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                        //td = await token.value.data.parsed.info.decimals;
                        //setGovernanceType(0);
                        
                        if (tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58())){
                            setGovernanceType(0);
                            //gTD = tokenMap.get(new PublicKey(grealm.account?.communityMint).toBase58()).decimals;
                            //setGoverningTokenDecimals(gTD);
                        } else{
                            const btkn = await getBackedTokenMetadata(new PublicKey(grealm.account?.communityMint).toBase58(), wallet);
                            if (btkn){ // Strata backed token
                                setGovernanceType(1);
                                //gTD = btkn.decimals;
                                //setGoverningTokenDecimals(gTD)
                            } else{ // NFT
                                const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                                console.log("found: "+JSON.stringify(token.value.data.parsed.info.decimals))
                                if (token.value.data.parsed.info.decimals > 0)
                                    setGovernanceType(0);
                                else
                                    setGovernanceType(2);
                                //gTD = 0;
                                //setGoverningTokenDecimals(gTD);
                            }
                        }
                    } catch(emt){
                        //const token = await connection.getParsedAccountInfo(new PublicKey(thisitem.account.governingTokenMint)) //await getMint(connection, new PublicKey(thisitem.account.governingTokenMint));
                        //console.log("found: "+JSON.stringify(token.value.data.parsed.info.decimals))
                        setGovernanceType(0);
                    }
                }
                

                if (cached_governance){
                    
                    console.log("Fetching via cache...")
                    
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    let tcvc = 0;
                    const hybridCache = true;

                    //console.log("ggov: "+JSON.stringify(ggov));
                    //console.log("proposalCount: "+grealm?.account?.proposalCount);

                    if (hybridCache){



                        const gprops = await getAllProposals(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk);
                        // with the results compare with cached_governance
                        console.log("gprops: "+JSON.stringify(gprops))
                        const rpcprops = new Array();
                        for (const props of gprops){
                            for (const prop of props){
                                if (prop){
                                    rpcprops.push(prop);
                                }
                            }
                        }
                        const sortedRPCResults = rpcprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
        
                        console.log(sortedRPCResults.length +" vs "+ cached_governance.length)
                        
                        
                        
                        if (rpcprops.length > cached_governance.length){
                            
                            cached_governance = sortedRPCResults;
                            console.log("Hybrid Cache: there is a new proposal we have not fetched")
                            // the following code will be used when we implement the GPA call to fetch only voting proposals
                            /*
                            // Check if each key in rpc_prop exists in cached_governance
                            gprops.forEach(obj => {
                                const found = cached_governance.some(
                                  cachedObj => cachedObj.pubkey.toBase58() === obj.pubkey.toBase58()
                                );
                                if (!found) {
                                  // Add the missing object to cached_governance
                                  cached_governance.push(JSON.stringify(obj));
                                }
                            });
                            */
                        } else{
                            console.log("Hybrid Cache: all proposals fetched")
                        }
                    }

                    const allprops: any[] = [];
                    for (var prop of cached_governance){
                        
                        //console.log("ITEM: "+JSON.stringify(prop))
                        if (prop.account.state === 3 || prop.account.state === 5)
                            passed++;
                        else if (prop.account.state === 7)
                            defeated++;
                    
                        if (prop.account?.yesVotesCount && prop.account?.noVotesCount){
                            //console.log("tmap: "+JSON.stringify(tokenMap));
                            //console.log("item a: "+JSON.stringify(prop))
                            //if (tokenMap){
                            if (grealm.account.config?.councilMint && new PublicKey(grealm.account.config?.councilMint).toBase58() === new PublicKey(prop.account?.governingTokenMint).toBase58()){
                                tcvc += +(((Number(prop.account?.yesVotesCount) + Number(prop.account?.noVotesCount))).toFixed(0))
                            } else{
                                ttvc += +(((Number(""+prop.account?.yesVotesCount) + Number(""+prop.account?.noVotesCount))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                            }
                             
                            
                        } else if (prop.account?.options) {
                            //console.log("item b: "+JSON.stringify(prop))
                            //if (tokenMap){
                            if (grealm.account.config?.councilMint && new PublicKey(grealm.account.config?.councilMint).toBase58() === new PublicKey(prop.account?.governingTokenMint).toBase58()){
                                tcvc += +(((Number(prop.account?.options[0].voteWeight) + Number(prop.account?.denyVoteWeight))).toFixed(0))
                            } else{
                                ttvc += +(((Number(""+prop.account?.options[0].voteWeight) + Number(""+prop.account?.denyVoteWeight))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                            }
                        }

                        allprops.push(prop);
                        
                    }

                    setTotalDefeated(defeated);
                    setTotalPassed(passed);
                    setTotalProposals(allprops.length);
                    setTotalCouncilVotesCasted(tcvc);
                    setTotalVotesCasted(ttvc);
                    
                    setProposals(allprops);

                } else {
                    
                    //console.log("B realm: "+JSON.stringify(grealm));

                    //console.log("communityMintMaxVoteWeightSource: " + grealm.account.config.communityMintMaxVoteWeightSource.value.toNumber());
                    
                    if (grealm?.account?.config?.useCommunityVoterWeightAddin){
                        const realmConfigPk = await getRealmConfigAddress(
                            programId,
                            realmPk
                        )
                        //console.log("realmConfigPk: "+JSON.stringify(realmConfigPk));
                        try{ 
                            const realmConfig = await getRealmConfig(
                                connection,
                                realmConfigPk
                            )
                            //console.log("realmConfig: "+JSON.stringify(realmConfig));
                            
                            const tryRealmConfig = await tryGetRealmConfig(
                                connection,
                                programId,
                                realmPk
                            )
                            
                            //console.log("tryRealmConfig: "+JSON.stringify(tryRealmConfig));
                            //setRealmConfig(realmConfigPK)

                            if (realmConfig && realmConfig?.account && realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin){
                                if (realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin.toBase58() === 'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw'){ // NFT based community
                                    setNftBasedGovernance(true);
                                }
                            }
                        }catch(errs){
                            console.log("ERR: "+errs)
                        }
                    }
                    
                    const gprops = await getAllProposals(RPC_CONNECTION, grealm.owner, realmPk);
                    const allprops: any[] = [];
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    
                    for (const props of gprops){
                        for (const prop of props){
                            if (prop){
                                allprops.push(prop);
                                if (prop.account.state === 3 || prop.account.state === 5)
                                    passed++;
                                else if (prop.account.state === 7)
                                    defeated++;
                            
                                if (prop.account?.yesVotesCount && prop.account?.noVotesCount){
                                    //console.log("tmap: "+JSON.stringify(tokenMap));
                                    //console.log("item a: "+JSON.stringify(prop))
                                    if (tokenMap){
                                        ttvc += +(((Number(prop.account?.yesVotesCount) + Number(prop.account?.noVotesCount))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                                    }
                                    
                                } else if (prop.account?.options) {
                                    //console.log("item b: "+JSON.stringify(prop))
                                    if (tokenMap){
                                        ttvc += +(((Number("0x"+prop.account?.options[0].voteWeight) + Number("0x"+prop.account?.denyVoteWeight))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                                    }
                                }
                            }
                        }
                    }

                    const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                    
                    setTotalDefeated(defeated);
                    setTotalPassed(passed);
                    setTotalProposals(sortedResults.length);
                    setTotalVotesCasted(ttvc);

                    setProposals(sortedResults);

                }
            }catch(e){console.log("ERR: "+e)}
        }
        setLoading(false);
    }

    React.useEffect(() => {
        if (cachedGovernance && governanceAddress){
            console.log("Step 3.")
            getGovernanceParameters(cachedGovernance);
        }
    }, [cachedGovernance]);

    React.useEffect(() => {
        if (governanceAddress && governanceLookup){
            console.log("Step 2.")
            getCachedGovernanceFromLookup();
        }
    }, [governanceLookup, governanceAddress]);
    
    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    React.useEffect(() => {
        if (tokenMap){
            console.log("Step 1.")
            callGovernanceLookup();
        }
    }, [tokenMap]);

    React.useEffect(() => { 
        if (!loading){
            if (!tokenMap){
                getTokens();
            }
        }
    }, []);
    
    const getCachedGovernanceFromLookup = async () => {
        let cached_governance = new Array();
        setCachedRealm(null);
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){
                    if (glitem?.realm)
                        setCachedRealm(glitem.realm);
                    if (glitem?.memberFilename){
                        const cached_members = await getFileFromLookup(glitem.memberFilename, storagePool);
                        setCachedMemberMap(cached_members);
                    }
                    if (glitem?.totalVaultValue)
                        setTotalVaultValue(glitem.totalVaultValue);
                    cached_governance = await getFileFromLookup(glitem.filename, storagePool);

                    setCachedTimestamp(glitem.timestamp);
                }
            }
        }

        // convert values in governance to BigInt and PublicKeys accordingly
        let counter = 0;
        for (let cupdated of cached_governance){

            cupdated.account.governance = new PublicKey(cupdated.account.governance);
            cupdated.account.governingTokenMint = new PublicKey(cupdated.account.governingTokenMint);
            cupdated.account.tokenOwnerRecord = new PublicKey(cupdated.account.tokenOwnerRecord);
            cupdated.owner = new PublicKey(cupdated.owner);
            cupdated.pubkey = new PublicKey(cupdated.pubkey);

            
            if (cupdated.account?.options && cupdated.account?.options[0]?.voteWeight)
                cupdated.account.options[0].voteWeight = Number("0x"+cupdated.account.options[0].voteWeight)
            if (cupdated.account?.denyVoteWeight)
                cupdated.account.denyVoteWeight = Number("0x"+cupdated.account.denyVoteWeight).toString()

            if (cupdated.account?.yesVotesCount)
                cupdated.account.yesVotesCount = Number("0x"+cupdated.account.yesVotesCount).toString()
            if (cupdated.account?.noVotesCount)
                cupdated.account.noVotesCount = Number("0x"+cupdated.account.noVotesCount).toString()
            
            
            cupdated.account.draftAt = Number("0x"+cupdated.account.draftAt).toString()
            cupdated.account.signingOffAt = Number("0x"+cupdated.account.signingOffAt).toString()
            cupdated.account.votingAt = Number("0x"+cupdated.account.votingAt).toString()
            cupdated.account.votingAtSlot = Number("0x"+cupdated.account.votingAtSlot).toString()
            cupdated.account.vetoVoteWeight = Number("0x"+cupdated.account.vetoVoteWeight).toString()
            cupdated.account.votingCompletedAt = Number("0x"+cupdated.account.votingCompletedAt).toString()

            // move to nested voting results
            if (cupdated?.votingResults){
                for (let inner of cupdated.votingResults){
                    inner.pubkey = new PublicKey(inner.pubkey);
                    inner.proposal = new PublicKey(inner.proposal);
                    inner.governingTokenOwner = new PublicKey(inner.governingTokenOwner);
                    inner.voteAddress = new PublicKey(inner.voteAddress);
                    if (inner.vote?.councilMint)
                        inner.vote.councilMint = new PublicKey(inner.vote.councilMint);
                    inner.vote.governingTokenMint = new PublicKey(inner.vote.governingTokenMint);
                    if (inner.vote?.councilMint)
                        inner.vote.councilMint = new PublicKey(inner.vote.councilMint);
                    inner.vote.governingTokenMint = new PublicKey(inner.vote.governingTokenMint);
                    /*
                    inner.quorumWeight.voterWeight = Number("0x"+inner.quorumWeight.voterWeight).toString()
                    inner.vote.voterWeight = Number("0x"+inner.vote.voterWeight).toString()

                    inner.quorumWeight.legacyYes = Number("0x"+inner.quorumWeight.legacyYes).toString()
                    inner.vote.legacyYes = Number("0x"+inner.vote.legacyYes).toString()
                    inner.quorumWeight.legacyNo = Number("0x"+inner.quorumWeight.legacyNo).toString()
                    inner.vote.legacyNo = Number("0x"+inner.vote.legacyNo).toString()
                    */
                }
            }

            counter++;
        }
        
        setCachedGovernance(cached_governance);
        //getGovernanceParameters(cached_governance);
    }

    const startTimer = () => {
        setStartTime(Date.now());
        setEndTime(null);
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    //if (publicKey){
        if(loading){
            return (
                <Box
                    sx={{
                        mt:6,
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Typography variant="caption">Loading Governance Proposals {governanceAddress}</Typography>
                    
                    <LinearProgress color="inherit" />
                    
                </Box>
            )
        } else{
            if (proposals && tokenMap && memberMap && realm){
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }} 
                    > 
                        {realm &&
                            <>
                                <Grid container>
                                    <Grid item xs={12} sm={6} container justifyContent="flex-start">
                                        <Grid container>
                                            <Grid item xs={12}>
                                                <Typography variant="h4">
                                                    {realmName}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Button
                                                    size='small'
                                                    sx={{color:'white', borderRadius:'17px'}}
                                                    href={'https://realms.today/dao/'+(governanceAddress)}
                                                    target='blank'
                                                >
                                                    <Typography variant="caption">
                                                    View on Realms <OpenInNewIcon fontSize='inherit'/>
                                                    </Typography>
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Grid>
                                    <Grid item xs={12} sm={6} container justifyContent="flex-end">
                                        <GovernanceNavigation governanceAddress={governanceAddress} />
                                    </Grid>
                                </Grid>
                                {/*
                                <Typography variant="caption">
                                    <Tooltip title={
                                        <>
                                            Council Mint: {realm.account.config.councilMint.toBase58()}<br/>
                                            Community Mint Max Vote Weight: {realm.account.config.communityMintMaxVoteWeightSource.value.toNumber()/1000000}<br/>
                                            <>Min Community Tokens to Create Governance: {realm.account.config.minCommunityTokensToCreateGovernance.toNumber()/1000000}</>
                                        </>
                                    }>
                                        <Button>
                                        {realm.pubkey.toBase58()}
                                        </Button>
                                    </Tooltip>
                                </Typography>
                                */}
                            </>
                        }

                        
                                <Box sx={{ 
                                    p:1}}>
                                    <Grid container spacing={0}>

                                    <Grid item xs={12} sm={6} md={3} lg={3} key={1}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:2,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)',
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Treasury</>
                                                </Typography>
                                                <Tooltip title={<>
                                                        Treasury total holdings value
                                                        </>
                                                    }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                            sx={{
                                                                verticalAlign: 'bottom'}}
                                                            >
                                                                {totalVaultValue ?
                                                                    <Typography variant="h4">
                                                                        ${getFormattedNumberToLocale(totalVaultValue.toFixed(2))} 
                                                                    </Typography>
                                                                :<>-</>
                                                                }
                                                            </Grid>
                                                        </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>


                                        <Grid item xs={12} sm={6} md={3} lg={3} key={1}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:2,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)',
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Total Casted Votes</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            Total votes casted for this governnace
                                                            {(totalCouncilVotesCasted && totalVotesCasted) ?
                                                                <><br/>Community/Council</>
                                                            :<></>
                                                            }
                                                        </>
                                                    }>
                                                        <Button
                                                            color='inherit'
                                                            sx={{
                                                                borderRadius:'17px'
                                                            }}
                                                        >
                                                            <Grid container
                                                            sx={{
                                                                verticalAlign: 'bottom'}}
                                                            >
                                                                {totalVotesCasted ?
                                                                    <Typography variant="h4">
                                                                        {getFormattedNumberToLocale(totalVotesCasted)} 
                                                                    </Typography>
                                                                :<></>
                                                                }

                                                                <Typography variant="h4" color="#999">
                                                                    {(totalCouncilVotesCasted && totalVotesCasted) ?
                                                                        <>/</>
                                                                    :<></>
                                                                    }
                                                                    {totalCouncilVotesCasted ?
                                                                        <>{totalCouncilVotesCasted}</>
                                                                    :<></>
                                                                    }
                                                                </Typography>
                                                                
                                                            </Grid>
                                                        </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>

                                        <Grid item xs={12} sm={6} md={3} lg={3} key={1}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:2,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)',
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Proposals/Success Rate</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            Total proposals created in this governance<br/>Success rate is calculated on successfully completed proposals
                                                        </>
                                                    }>
                                                    <Button
                                                        color='inherit'
                                                        sx={{
                                                            borderRadius:'17px',
                                                        }}
                                                    >   
                                                        <Grid container
                                                            sx={{
                                                                verticalAlign: 'bottom'}}
                                                        >
                                                            <Typography variant="h4">
                                                                {totalProposals}
                                                            </Typography>
                                                            <Typography variant="h6">/{((totalPassed/totalProposals)*100).toFixed(1)}%</Typography>
                                                        </Grid>
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        
                                        <Grid item xs={12} sm={6} md={3} lg={3} key={1}>
                                            <Box
                                                sx={{
                                                    borderRadius:'24px',
                                                    m:2,
                                                    p:1,
                                                    background: 'rgba(0, 0, 0, 0.2)',
                                                }}
                                            >
                                                <Typography variant="body2" sx={{color:'#2ecc71'}}>
                                                    <>Passing/Defeated</>
                                                </Typography>
                                                <Tooltip title={<>
                                                            Total proposals passed / Total proposals defeated
                                                        </>
                                                    }>
                                                    <Button
                                                        color='inherit'
                                                        sx={{
                                                            borderRadius:'17px'
                                                        }}
                                                    >
                                                        <Grid container
                                                            sx={{
                                                                verticalAlign: 'bottom'}}
                                                            >
                                                            <Typography variant="h4">
                                                                <Badge badgeContent={<ThumbUpIcon sx={{ fontSize: 10 }} />} color="success">{totalPassed}</Badge>/
                                                                <Badge badgeContent={<ThumbDownIcon sx={{ fontSize: 10 }} />} color="error">{totalDefeated}</Badge>
                                                            </Typography>
                                                        </Grid>
                                                    </Button>
                                                </Tooltip>
                                            </Box>
                                        </Grid>
                                        
                                    </Grid>
                                </Box>
                                  
                                
                        <RenderGovernanceTable 
                            governanceLookup={governanceLookup} 
                            endTimer={endTimer} 
                            cachedGovernance={cachedGovernance} 
                            memberMap={memberMap} 
                            governanceType={governanceType} 
                            governingTokenDecimals={governingTokenDecimals} 
                            governingTokenMint={governingTokenMint} 
                            tokenMap={tokenMap} 
                            realm={realm} 
                            thisToken={thisToken} 
                            proposals={proposals} 
                            nftBasedGovernance={nftBasedGovernance} 
                            governanceAddress={governanceAddress} />
                        
                        {endTime &&
                            <Typography 
                                variant="caption"
                                sx={{textAlign:'center'}}
                            >
                                Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Hybrid Caching<br/>
                                {cachedTimestamp &&
                                    <>Cached: {moment.unix(Number(cachedTimestamp)).format("MMMM D, YYYY, h:mm a") }<br/></>
                                }
                                Cache Node: {storagePool}<br/>
                                <br/>* This is the time taken to capture all proposals & proposal details - proposals currently voting are captured via RPC for realtime results
                            </Typography>
                        }
                    </Box>
                                
                );
            }else{
                return (
                    <Box
                        sx={{
                            mt:6,
                            background: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '17px',
                            p:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="caption">Governance Proposals {governanceAddress}</Typography>
                        
                    </Box>
                );
            }
            
        }
    /*
    } else{
        // check if participant in this governance?
        return (
            <Box
                sx={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    p:4
                }} 
            > 
                    <WalletDialogProvider className="grape-wallet-provider">
                        <WalletMultiButton className="grape-wallet-button">
                            Connect your wallet
                        </WalletMultiButton>
                    </WalletDialogProvider> 
            </Box>
        )
    }*/
}