import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import grapeTheme from  '../utils/config/theme';
import { ThemeProvider } from '@mui/material/styles';

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
  TextField,
  Tooltip,
  LinearProgress,
  DialogTitle,
  Dialog,
  Badge,
  FormGroup,
  FormControlLabel,
  Switch,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';
import { useSnackbar } from 'notistack';

import GovernanceNavigation from './GovernanceNavigation'; 
import GovernancePower from './GovernancePower';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 
import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';
import { GovernanceProposalDialog } from './GovernanceProposalDialog';
import moment from 'moment';

import SearchIcon from '@mui/icons-material/Search';
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

import { 
    getGovernance,
    getRealm, 
    getAllGovernances,
    getAllProposals, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    tryGetRealmConfig, 
    getRealmConfig  } from '@solana/spl-governance';

import { 
    getAllProposalsIndexed,
    getAllGovernancesIndexed
} from './api/queries';

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

const VotesLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 10,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: theme.palette.mode === 'light' ? '#EC7063' : 'rgba(176, 58, 46,0.4)',
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: theme.palette.mode === 'light' ? '#52BE80' : '#52BE80',
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
    const [loading, setLoading] = React.useState(false);
    //const [proposals, setProposals] = React.useState(props.proposals);
    const proposals = props.proposals;
    const { publicKey } = useWallet();
    const [filteredGovernance, setFilteredGovernance] = React.useState(null);
    //const [filterState, setFilterState] = React.useState(true);
    const filterState = props.filterState;
    const setFilterState = props.setFilterState;
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

    const handleFilterStateChange = () => {
        setFilterState(!filterState);
    }
    
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
                                    `Ending ${moment.unix(Number(thisitem.account?.signingOffAt)+(Number(thisGovernance?.governance?.account?.config?.baseVotingTime))).fromNow()}`
                                :
                                    <>
                                    {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                                        <>{`Started: ${thisitem.account?.signingOffAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))}`}<br/>{`Ended: ${thisitem.account?.draftAt && (moment.unix(Number((thisitem.account?.votingCompletedAt))).format("MMMM D, YYYY, h:mm a"))}`}</>
                                    :
                                        `Created: ${thisitem.account?.signingOffAt && (moment.unix(Number((thisitem.account?.draftAt))).format("MMMM D, YYYY, h:mm a"))}`
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
        if (proposals)
            endTimer();
    }, [proposals]);

    if (loading){
        return (
            <Box sx={{ width: '100%' }}>
                <LinearProgress sx={{borderRadius:'10px;'}} color="inherit" />
            </Box>
            
        )
    }

    
        return (
            <>
                <Box sx={{ display: 'flex', alignItems: 'flex-end', mb:2 }}>
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.2)', mr: 1, my: 0.5 }} />
                    <TextField 
                        id="input-with-sx" 
                        fullWidth 
                        size='small'
                        label="Search Proposals" 
                        value={filteredGovernance}
                        variant='standard'
                        onChange={(e) => setFilteredGovernance(e.target.value)} />
                </Box>
                
                <TableContainer component={Paper} sx={{background:'none'}}>
                    <Table sx={{ minWidth: 650 }}>
                        <StyledTable sx={{ minWidth: 500 }} size="small" aria-label="Portfolio Table">
                            <TableHead>
                                <TableRow>
                                    <TableCell><Typography variant="caption">Name</Typography></TableCell>
                                    <TableCell align="center" sx={{width:"12.5%"}}><Typography variant="caption">Drafted</Typography></TableCell>
                                    <TableCell align="center" sx={{width:"12.5%"}}><Typography variant="caption">Signed Off</Typography></TableCell>
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
                                    {(
                                        (filteredGovernance && filteredGovernance.length > 3) ? 
                                        proposals
                                        .filter((item: any) => 
                                            ( 
                                                item.account?.name?.toLowerCase().includes(filteredGovernance.toLowerCase()) 
                                            || 
                                                item.account?.descriptionLink?.toLowerCase().includes(filteredGovernance.toLowerCase())
                                            )
                                        )
                                        //.filter((item: any) => filterState ? (item.account?.state !== 6) : true)
                                        : 
                                        (rowsPerPage > 0
                                            ? proposals
                                                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                                //.filter((item: any) => filterState ? (item.account?.state !== 6) : true)
                                            : proposals
                                        )
                                        /*
                                        rowsPerPage > 0
                                        ? proposals.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        : proposals*/
                                    ).map((item:any, index:number) => (
                                    <>
                                        {/*console.log("item ("+index+"): "+JSON.stringify(item))*/}
                                        {item?.pubkey && item?.account && item.account?.options && item.account?.options.length > 0 &&
                                            <>
                                                {(item.account?.options[0].voteWeight && item.account?.state === 2) ?
                                                    <TableRow sx={{border:'none'}}>
                                                        <TableCell colSpan={6} sx={{borderBottom:'none!important'}}>
                                                            <Box sx={{ width: '100%' }}>
                                                                <VotesLinearProgress variant="determinate" value={(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100)} />
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                :<></>}

                                                <TableRow key={index} sx={{borderBottom:"none"}}>
                                                    <TableCell>
                                                        <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                            <Grid container>
                                                                <Grid item xs={12}>
                                                                    <Typography variant="body1">
                                                                        {item.account?.name}
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item xs={12}>
                                                                    {item.account?.descriptionLink}
                                                                </Grid>
                                                            </Grid>
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                            {`${item.account?.draftAt ? (moment.unix(Number((item.account.draftAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                            {`${item.account?.signingOffAt ? (moment.unix(Number((item.account?.signingOffAt))).format("MMM D, YYYY, h:mm a")) : `N/A`}`}
                                                        </Typography>
                                                    </TableCell>
                                                    
                                                    {item?.account?.voteType?.type === 1 ?
                                                        <>
                                                            <TableCell 
                                                                colSpan={2}
                                                                sx={{textAlign:'center'}}>Multiple Choice Poll
                                                            </TableCell>
                                                        </>
                                                    :
                                                        <>
                                                    
                                                        <TableCell>
                                                            ...
                                                        </TableCell>
                                                        <TableCell>
                                                            ...
                                                        </TableCell>
                                                        </>
                                                    }
                                                    <TableCell>...</TableCell>
                                                    <TableCell align="center">
                                                        ...
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
                                    colSpan={6}
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
                    <Box
                        display="flex"
                        justifyContent="flex-end"
                        sx={{
                            alignItems:"right",
                            m:1
                        }}
                    >
                        <FormGroup row>
                            <FormControlLabel control={<Switch onChange={handleFilterStateChange} size="small" />} label={<><Typography variant="caption">Show Cancelled Proposals</Typography></>} />
                        </FormGroup>
                    </Box>
                </TableContainer>
            </>
        )
}

export function GovernanceRealtimeView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
   
    const [startTime, setStartTime] = React.useState(null);
    const [endTime, setEndTime] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [proposals, setProposals] = React.useState(null);
    const [allProposals, setAllProposals] = React.useState(null);
    const [filterState, setFilterState] = React.useState(true);
    
    const getGovernanceParameters = async () => {
        if (!loading){
            

            startTimer();
            setLoading(true);
            try{
                    
                
                
                    
                    console.log("Fetching via hybrid cache...")
                    
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    let tcvc = 0;
                    const hybridCache = true;

                    //console.log("ggov: "+JSON.stringify(ggov));
                    //console.log("proposalCount: "+grealm?.account?.proposalCount);

                        const gprops = await getAllProposalsIndexed();
                        //console.log("Indexed Proposals: "+JSON.stringify(gprops));
                        //const gprops = await getAllProposals(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk);
                        // with the results compare with cached_governance
                        //console.log("All Proposals: "+JSON.stringify(gpropsRpc))
                        const rpcprops = new Array();
                        for (const props of gprops){
                            if (props && props.length > 0){
                                for (const prop of props){
                                    if (prop){
                                        rpcprops.push(prop);
                                    }
                                }
                            } else{
                                rpcprops.push(props);
                            }
                        }
                        const sortedRPCResults = rpcprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                    
                    setAllProposals(sortedRPCResults);
                    setProposals(sortedRPCResults);

                
            }catch(e){console.log("ERR: "+e)}
        }
        setLoading(false);
    }

    React.useEffect(() => {
        if (allProposals){
            if (filterState){
                console.log("allProposals: "+JSON.stringify(allProposals))
                const tmpProps = allProposals
                    .filter((item) => item.account?.state !== 6)
                    .sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                
                console.log("Showing only valid props")
                setProposals(tmpProps)
            } else{
                const tmpProps = allProposals
                    .sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
                
                console.log("Showing all props")
                setProposals(tmpProps)
            }
        }
    }, [allProposals, filterState]);
    
    React.useEffect(() => { 
        if (!loading){
            getGovernanceParameters();
        }
    }, []);
    
    const startTimer = () => {
        setStartTime(Date.now());
        setEndTime(null);
    }

    const endTimer = () => {
        setEndTime(Date.now())
    }

    
        if(loading){
            return (
                <ThemeProvider theme={grapeTheme}>
                    <Box
                        sx={{
                            width:'100%',
                            mt: 6,
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            p: 4,
                            pt:4,
                            pb:4,
                            alignItems: 'center', textAlign: 'center'
                        }} 
                    > 
                        <Typography variant="caption" sx={{color:'white'}}>Loading Governance Proposals</Typography>
                        
                        <LinearProgress color="inherit" />
                        
                    </Box>
                </ThemeProvider>
            )
        } else{
            if (proposals){
                return (
                    <ThemeProvider theme={grapeTheme}>
                        <Box
                            sx={{
                                width:'100%',
                                mt: 6,
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                overflow: 'hidden',
                                p: 4,
                                color: 'white',
                            }} 
                        > 
                            
                        <>
                            <Grid container
                                sx={{
                                    m: 0,
                                }}
                            >
                                <Grid item xs={12} sm={6} container justifyContent="flex-start">
                                    <Grid container>
                                        <Grid item xs={12}>
                                            <Typography variant="h4">
                                                Realtime Governance Proposals
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Grid>
                                
                            </Grid>
                        </>
                            

                            
                                    
                              
                        <RenderGovernanceTable 
                            endTimer={endTimer} 
                            proposals={proposals} 
                            filterState={filterState}
                            setFilterState={setFilterState}
                        />
                            
                            
                            {endTime &&
                                <Grid
                                    sx={{
                                        m: 0,
                                    }}
                                >
                                    <Typography 
                                        variant="caption"
                                        sx={{
                                            textAlign:'center'
                                        }}
                                    >
                                        Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Hybrid Caching<br/>
                                    </Typography>

                                </Grid>
                            }
                        </Box>
                    </ThemeProvider>        
                );
            }else{
                return (
                    <ThemeProvider theme={grapeTheme}>
                        <Box
                            sx={{
                                width:'100%',
                                mt: 6,
                                background: 'rgba(0, 0, 0, 0.5)',
                                borderRadius: '17px',
                                p: 4,
                                pt:4,
                                pb:4,
                                alignItems: 'center', textAlign: 'center'
                            }} 
                        > 
                            <Typography variant="caption" sx={{color:'white'}}>Governance Proposals</Typography>
                        </Box>
                    </ThemeProvider>
                );
            }
            
        }
    
}