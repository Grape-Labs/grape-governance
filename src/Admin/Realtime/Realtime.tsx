import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';

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
  InputBase,
  Tooltip,
  LinearProgress,
  LinearProgressProps,
  Divider,
  Chip,
  DialogTitle,
  Dialog,
  Badge,
  FormGroup,
  FormControlLabel,
  Switch,
  Fade,
  Input,
  InputLabel,
  InputAdornment,
  Card,
  CardActions,
  CardContent,
} from '@mui/material/';

import { linearProgressClasses } from '@mui/material/LinearProgress';

import { SwitchProps } from '@mui/material/Switch';

import { createSvgIcon } from '@mui/material/utils';

import { gistApi, resolveProposalDescription } from '../../utils/grapeTools/github';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkImages from 'remark-images';

const CustomSearchIcon = createSvgIcon(
    <svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 27 27" fill="none">
    <g clip-path="url(#clip0_39_77)">
    <path d="M26.6844 25.175L18.6237 17.1157C21.9815 12.9992 21.7391 6.91123 17.9055 3.07369C15.9246 1.0886 13.2896 0 10.4853 0C7.68097 0 5.05051 1.0886 3.06965 3.07369C-1.02472 7.1628 -1.02472 13.8179 3.06965 17.907C5.05051 19.8875 7.68554 20.9807 10.4898 20.9807C12.9327 20.9807 15.2476 20.1528 17.114 18.6251L25.1747 26.6844C25.3851 26.8948 25.6596 27 25.9295 27C26.1994 27 26.4785 26.8948 26.6844 26.6844C27.1007 26.2682 27.1007 25.5867 26.6844 25.1704V25.175ZM4.58388 16.393C1.32668 13.1364 1.32668 7.83974 4.58388 4.58767C6.16216 3.00966 8.25739 2.14061 10.4898 2.14061C12.7223 2.14061 14.8175 3.00966 16.3958 4.58767C19.653 7.84432 19.653 13.1409 16.3958 16.393C14.8175 17.971 12.7223 18.8401 10.4898 18.8401C8.25739 18.8401 6.16216 17.971 4.58388 16.393Z" fill="#AEADAD"/>
    <path d="M6.70653 4.67458C6.17128 4.92157 5.9334 5.55735 6.18501 6.09707C6.43204 6.63223 7.06793 6.8655 7.60775 6.6185C7.63977 6.60478 10.9336 5.13197 14.0078 7.94952C14.2136 8.13705 14.4744 8.23311 14.7306 8.23311C15.0188 8.23311 15.307 8.11418 15.522 7.88549C15.92 7.45096 15.8926 6.77402 15.458 6.37151C11.3453 2.60258 6.90324 4.58767 6.71568 4.67458H6.70653Z" fill="#AEADAD"/>
    </g>
    <defs>
    <clipPath id="clip0_39_77">
    <rect width="27" height="27" fill="white"/>
    </clipPath>
    </defs>
    </svg>,
    'Search'
)

import ExplorerView from '../../utils/grapeTools/Explorer';

import { useSnackbar } from 'notistack';

import GovernanceNavigation from '../../GovernanceCached/GovernanceNavigation'; 
import GovernancePower from '../../GovernanceCached/GovernancePower';
import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from '../../GovernanceCached/CachedStorageHelpers'; 
import { createCastVoteTransaction } from '../../utils/governanceTools/components/instructions/createVote';
import { GovernanceProposalDialog } from '../../GovernanceCached/GovernanceProposalDialog';
import moment from 'moment';

import GitHubIcon from '@mui/icons-material/GitHub';
import HistoryIcon from '@mui/icons-material/History';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VerifiedIcon from '@mui/icons-material/Verified';
import ModeIcon from '@mui/icons-material/Mode';
import EditNoteIcon from '@mui/icons-material/EditNote';
import SearchIcon from '@mui/icons-material/Search';
import InfoIcon from '@mui/icons-material/Info';
import CheckIcon from '@mui/icons-material/Check';
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
    GGAPI_STORAGE_URI,
    FRICTIONLESS_BG,
} from '../../utils/grapeTools/constants';

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
} from '../../GovernanceCached/api/queries';

import { formatAmount, getFormattedNumberToLocale } from '../../utils/grapeTools/helpers'
import ProgressBar from '../../components/progress-bar/progress-bar';
//import { RevokeCollectionAuthority } from '@metaplex-foundation/mpl-token-metadata';

const transformImageUri = (uri) => {
    // Add your image resizing logic here
    // Example: Append the query parameter "w=500" to resize the image to a width of 500px
    const resizedUri = `${uri}?w=500`;
    return resizedUri;
};

const IOSSwitch = styled((props: SwitchProps) => (
    <Switch focusVisibleClassName=".Mui-focusVisible" disableRipple {...props} />
  ))(({ theme }) => ({
    width: 42,
    height: 26,
    padding: 0,
    '& .MuiSwitch-switchBase': {
      padding: 0,
      margin: 2,
      transitionDuration: '300ms',
      '&.Mui-checked': {
        transform: 'translateX(16px)',
        color: '#fff',
        '& + .MuiSwitch-track': {
          backgroundColor: theme.palette.mode === 'dark' ? '#2ECA45' : '#65C466',
          opacity: 1,
          border: 0,
        },
        '&.Mui-disabled + .MuiSwitch-track': {
          opacity: 0.5,
        },
      },
      '&.Mui-focusVisible .MuiSwitch-thumb': {
        color: '#33cf4d',
        border: '6px solid #fff',
      },
      '&.Mui-disabled .MuiSwitch-thumb': {
        color:
          theme.palette.mode === 'light'
            ? theme.palette.grey[100]
            : theme.palette.grey[600],
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: theme.palette.mode === 'light' ? 0.7 : 0.3,
      },
    },
    '& .MuiSwitch-thumb': {
      boxSizing: 'border-box',
      width: 22,
      height: 22,
    },
    '& .MuiSwitch-track': {
      borderRadius: 26 / 2,
      backgroundColor: theme.palette.mode === 'light' ? '#E9E9EA' : '#39393D',
      opacity: 1,
      transition: theme.transitions.create(['background-color'], {
        duration: 500,
      }),
    },
}));

const BlinkingDotContainer = styled("div")({
    width: 12.5,
    height: 12.5,
    borderRadius: "50%",
    backgroundColor: "red",
    animation: `blinking-dot 1s ease-in-out infinite`,
    display: 'inline-block',
});
const BlinkingDot = () => {
    return (
      <BlinkingDotContainer>
        <Fade in={true}>
          <div style={{ width: 5, height: 5, borderRadius: "50%" }} />
        </Fade>
      </BlinkingDotContainer>
    );
  };

type BorderLinearProgressProps = LinearProgressProps & {
    valueYes?: number;
    valueNo?: number;
};

const BorderLinearProgress = styled(LinearProgress)<BorderLinearProgressProps>(({ theme, valueYes, valueNo }) => ({
    marginTop: 6,
    marginBottom: 8,
    height: 15,
    borderRadius: '17px',
    [`&.${linearProgressClasses.colorPrimary}`]: {
      backgroundColor: valueNo ? '#AB4D47' : theme.palette.grey[900],
    },
    [`& .${linearProgressClasses.bar}`]: {
      borderRadius: '0px',
      backgroundColor: valueYes ? '#5C9F62' : valueNo ? '#AB4D47' : theme.palette.grey[900],
      width: valueYes ? `${valueYes}%` : '0%',
    },
  }));

const StyledTable = styled(Table)(({ theme }) => ({
    /*
    '& .MuiTableCell-root': {
        borderBottom: '1px solid rgba(255,255,255,0.05)'
    },*/
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
    9:'Vetoed',
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
    const governanceLookup = props.governanceLookup;

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
        
        React.useEffect(() => { 
            if (thisitem.account?.state === 2){ // if voting state
                //if (!thisGovernance){
                    //console.log("get gov props")
                    //getGovernanceProps()
                //}
            }
        }, [thisitem]);

        // calculate time left
        // /60/60/24 to get days
        
        return (
            <>
                   
                <Chip variant="outlined" 
                    
                    sx={{
                        borderRadius:'17px',
                        p:'4px 12px',
                        color:
                            (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                `green`
                            :
                                (thisitem.account?.state === 2) ?
                                    `#A688FA` // voting
                                    :
                                    (thisitem.account?.state === 0) ?
                                        `gray`
                                        :
                                        `#AB4D47`,
                        borderColor:
                            (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                `green`
                            :
                                (thisitem.account?.state === 2) ?
                                    `#A688FA` // voting
                                    :
                                    (thisitem.account?.state === 0) ?
                                        `gray`
                                        :
                                        `#AB4D47`,
                        
                    }}
                    avatar={
                        <>
                        {(thisitem.account?.votingCompletedAt && Number(thisitem.account?.votingCompletedAt > 0)) ?
                            <>
                                { (thisitem.account?.state === 3 || thisitem.account?.state === 5) ?
                                    <CheckIcon />
                                :
                                    <CancelOutlinedIcon />
                                }
                            </>
                        :
                            <>
                            { thisitem.account?.state === 2 ?
                                <AccessTimeIcon />
                            
                            : 
                                <>
                                    { (thisitem.account?.state === 0) ?
                                        <ModeIcon />
                                    :
                                        <CancelOutlinedIcon />
                                    }
                                </>
                            }
                            </>
                        }
                        </>

                    }
                    label={
                        <>
                            <Typography variant="body2">
                                {GOVERNANCE_STATE[thisitem.account?.state]}
                            </Typography>
                        </>
                    }/>
            </>
        )
    }
    
    const conditionalTextDecoration = (item) => {
        if (item.account?.state === 6) {
          return "line-through";
        } else {
          return "";
        }
      };
    
    function GetGovernanceFromRulesView(props:any){
        const governanceLookup = props.governanceLookup;
        const rulesWallet = props.rulesWallet;
        const proposal = props.proposal;
        const name = props?.name;
        const description = props?.description;
        const [descriptionMarkdown, setDescriptionMarkdown] = React.useState(null);
        const state = props?.state;
        const draftAt = props.draftAt;
        const item = props?.item;
        const [gist, setGist] = React.useState(null);

        const [governanceInfo, setGovernanceInfo] = React.useState(null);

        React.useEffect(() => { 
            if (governanceLookup){
                for (let glitem of governanceLookup){
                    //console.log("glitem: "+JSON.stringify(glitem));
                    if (glitem?.governances){
                        for (let ggitem of glitem.governances){
                            if (ggitem.pubkey === rulesWallet){
                                setGovernanceInfo(glitem);
                                //console.log("found: "+glitem.governanceName);
                                //console.log("found governanceAddress: "+glitem.governanceAddress);
                            }
                        }
                    }
                }
            }
            

        }, [governanceLookup]);

        const resolveDescription = async(descriptionStr: string) => {
            try{
                const cleanString = description.replace(/(\s+)(https?:\/\/[a-zA-Z0-9\.\/]+)/g, '$2');
                const url = new URL(cleanString);
                const pathname = url.pathname;
                const parts = pathname.split('/');
                //console.log("pathname: "+pathname)
                let tGist = null;
                if (parts.length > 1)
                    tGist = parts[2];
                
                setGist(tGist);
                
                const rpd = await resolveProposalDescription(description);
    
                // Regular expression to match image URLs
                const imageUrlRegex = /https?:\/\/[^\s"]+\.(?:jpg|jpeg|gif|png)/gi;
                const stringWithPreviews = rpd.replace(imageUrlRegex, (match:any, imageUrl:any) => {
                    return "![Image X]("+imageUrl+")";
                });
                
    
                setDescriptionMarkdown(rpd);
            } catch(e){
                console.log("ERR: "+e)
            }
        }

        React.useEffect(() => {
            if (description){
                resolveDescription(description)
            }
        }, []);

        return (
            <>
                
                    <>
                        
                            <Button 
                                href={(governanceInfo && governanceInfo.governanceName) && `https://governance.so/proposal/${governanceInfo.governanceAddress}/${proposal}`}
                                target='_blank'
                                color='inherit'
                                sx={{
                                    borderRadius:'25px',
                                    p:1,
                                    m:0,
                                    textTransform:'none',
                                    width:'100%',
                                    textDecoration: (state === 6) ? 'line-through' : 'none'
                                }}
                                //disabled={!governanceInfo}
                            >
                                <Box
                                    sx={{
                                        borderRadius:'17px',
                                        background: '#2E2934',
                                        p:2,
                                        width:'100%'
                                    }}
                                >
                                    <Grid container>
                                        <Grid item xs={12} sx={{

                                        }}>
                                            
                                            <Typography variant="body2"
                                                sx={{
                                                    color:'gray',
                                                    textAlign:'left'
                                                }}
                                            >
                                                {(governanceInfo && governanceInfo.governanceName) ? 
                                                    <>
                                                        {governanceInfo.governanceName}
                                                    </>
                                                :
                                                    <>
                                                        <Typography sx={{fontSize:'9px'}}>
                                                            DNV Proposal 
                                                            <ExplorerView
                                                                address={item.pubkey.toBase58()} type='address'
                                                                shorten={8}
                                                                hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                            </Typography>
                                                        </>
                                                }
                                                
                                                
                                            </Typography>
                                            
                                            <Grid container>
                                                <Grid item sm={8} xs={12}
                                                    sx={{
                                                        textAlign:'left'
                                                    }}
                                                >
                                                    <Typography 
                                                        variant="h6"
                                                        color={(state === 2) ? `white` : `#ddd`} 
                                                        //color="white"
                                                        sx={{ textDecoration: (state === 6) ? 'line-through' : 'none' }}
                                                    >
                                                        {name}
                                                    </Typography>

                                                    <Grid item xs={12}
                                                        sx={{mb:1}}
                                                    >
                                                            
                                                            {gist ?
                                                                <Box sx={{ alignItems: 'left', textAlign: 'left'}}>
                                                                    <Grid
                                                                        style={{
                                                                            border: 'none',
                                                                            padding:4,
                                                                        }} 
                                                                    >
                                                                        <>
                                                                            <ReactMarkdown 
                                                                                remarkPlugins={[[remarkGfm, {singleTilde: false}], remarkImages]} 
                                                                                transformImageUri={transformImageUri}
                                                                                children={descriptionMarkdown}
                                                                                components={{
                                                                                    // Custom component for overriding the image rendering
                                                                                    img: ({ node, ...props }) => (
                                                                                    <img
                                                                                        {...props}
                                                                                        style={{ width: '100%', height: 'auto' }} // Set the desired width and adjust height accordingly
                                                                                    />
                                                                                    ),
                                                                                }}
                                                                            />
                                                                        </>
                                                                    </Grid>
                                                                    <Box sx={{ alignItems: 'right', textAlign: 'right',p:1}}>
                                                                        <Button
                                                                            color='inherit'
                                                                            target='_blank'
                                                                            href={description}
                                                                            sx={{borderRadius:'17px'}}
                                                                        >
                                                                            <GitHubIcon sx={{mr:1}} /> GIST
                                                                        </Button>
                                                                    </Box>
                                                                </Box>
                                                                :
                                                                <>
                                                                    {description &&
                                                                        <>
                                                                            <Typography variant="body1" 
                                                                                color='gray' 
                                                                                sx={{ display: 'flex', alignItems: 'center' }}>
                                                                                {description}
                                                                            </Typography>
                                                                        </>
                                                                    }
                                                                </>
                                                            }
                                                        
                                                        
                                                    </Grid>
                                                </Grid>
                                                
                                                <Divider orientation="vertical" flexItem
                                                    sx={{
                                                    // Responsive visibility for mobile devices
                                                    '@media (max-width: 600px)': {
                                                        display: 'none',
                                                    },
                                                    }}
                                                >
                                                    
                                                </Divider>
                                                
                                                <Grid item xs
                                                    sx={{textAlign:'right'}}
                                                >
                                                    <Grid sx={{mb:2}}>
                                                        <GetProposalStatus item={item} />
                                                    </Grid>
                                                    
                                                    {state === 2 ?
                                                        <>
                                                            <Grid container sx={{ml:1}}>
                                                                <Grid item xs alignContent={'left'} justifyContent={'left'}>
                                                                    <Typography variant="body2" sx={{color:'white',mr:1,textAlign:'left'}}>
                                                                        YES:&nbsp;
                                                                            {Number(item.account?.options[0].voteWeight) > 0 ?
                                                                            <>
                                                                            {`${(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                            </>
                                                                            :
                                                                            <>0%</>
                                                                        }
                                                                    
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item xs alignContent={'right'} justifyContent={'right'}>
                                                                    <Typography variant="body2" sx={{color:'white',mr:1}}>
                                                                        NO:&nbsp;
                                                                        {Number(item.account?.denyVoteWeight) > 0 ?
                                                                        <>
                                                                        {`${(((Number(item.account?.denyVoteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                        </>:
                                                                        <>0%</>
                                                                        }
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid xs={12}>
                                                                    
                                                                    <BorderLinearProgress variant="determinate" 
                                                                        value={100}
                                                                        valueYes={
                                                                            +(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)
                                                                        }
                                                                        valueNo={
                                                                            +(((Number(item.account?.denyVoteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)
                                                                        } 
                                                                    />
                                                                </Grid>
                                                            </Grid>  
                                                        </>
                                                    :
                                                        <Grid>

                                                            <Grid container>
                                                                <Grid item xs alignContent={'right'} justifyContent={'right'}>
                                                                    <Typography variant="body2" sx={{color:'white',mr:1}}>
                                                                        YES: 
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item>
                                                                    <Typography variant="body2" sx={{color:"green"}}>
                                                                        {Number(item.account?.options[0].voteWeight) > 0 ?
                                                                        <>
                                                                        {`${(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                        </>
                                                                        :
                                                                        <>0%</>
                                                                        }
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>

                                                            <Grid container sx={{mb:1}}>
                                                                <Grid item xs alignContent={'right'} justifyContent={'right'}>
                                                                    <Typography variant="body2" sx={{color:'white',mr:1}}>
                                                                        No:
                                                                    </Typography>
                                                                </Grid>
                                                                <Grid item>
                                                                    <Typography variant="body2" sx={{color:"#AB4D47"}}>
                                                                        {Number(item.account?.denyVoteWeight) > 0 ?
                                                                        <>
                                                                        {`${(((Number(item.account?.denyVoteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                        </>:
                                                                        <>0%</>
                                                                        }
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>

                                                        </Grid>
                                                    }
                                                    
                                                    <Grid sx={{mb:1}}>
                                                        <Chip
                                                            size="small"
                                                            icon={
                                                                <HistoryIcon />
                                                            }
                                                            label={moment.unix(draftAt).fromNow()}
                                                            sx={{
                                                                background:'#45404A',
                                                                borderRadius:'17px',
                                                            }}
                                                        />
                                                    </Grid>

                                                    {governanceInfo &&
                                                        <Grid

                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'flex-end',
                                                                alignItems: 'flex-end',
                                                                mt: 2
                                                            }}
                                                        >
                                                            <Button 
                                                                variant="text" 
                                                                //color="white"
                                                                startIcon={<ZoomOutMapIcon 
                                                                    fontSize='small'
                                                                    sx={{
                                                                        color:"#ddd"}}
                                                                    />}
                                                                sx={{
                                                                    borderRadius:'17px',
                                                                
                                                                }}
                                                                >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{color:'#ddd'}}
                                                                >
                                                                Expand
                                                                </Typography>
                                                            </Button>
                                                        </Grid>
                                                    }
                                                </Grid>
                                            </Grid>
                                        
                                            
                                        </Grid>
                                        
                                    </Grid>
                                </Box>
                            </Button>
                    </>
            </>
        );
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
                <Box 
                    sx={{ 
                        ml:1,
                        mr:1,
                        mb:2
                    }}>
                    <Grid container direction="row">
                        <Grid item sm={8} xs={12}
                            sx={{mb:1}}
                        >
                            <TextField 
                                id="input-with-sx" 
                                fullWidth
                                //label="Search Proposals or protocol" 
                                value={(filteredGovernance && filteredGovernance.length > 0) ? filteredGovernance : null}
                                variant='outlined'
                                onChange={(e) => setFilteredGovernance(e.target.value)} 
                                
                                InputProps={{
                                    startAdornment: 
                                        <InputAdornment position="start">
                                            <CustomSearchIcon sx={{ color: 'rgba(255,255,255,0.2)', mr: 1, my: 0.5 }} />
                                        </InputAdornment>,
                                }}
                                sx={{
                                    backgroundColor:'#2E2934',
                                    borderRadius:'17px',
                                    "& fieldset": {
                                    border: "none",
                                    },
                                }}
                            />
                        </Grid>

                        <Grid
                            xs
                            display="flex"
                            justifyContent="flex-end"
                            sx={{
                                alignItems:"right",
                                
                            }}
                        >
                            <FormGroup row>
                                <FormControlLabel control={<IOSSwitch onChange={handleFilterStateChange} size="small" />} label={<><Typography variant="body2" sx={{ml:1}}>Show Cancelled Proposals</Typography></>} />
                            </FormGroup>
                        </Grid>
                    </Grid>
                </Box>
                
                <TableContainer component={Paper} sx={{background:'none'}}>
                    <Table sx={{ }}>
                        <StyledTable sx={{  }} size="small" aria-label="Proposals Table">
                            
                            <TableBody
                                sx={{
                                    background:'none',
                                    p:0,
                                    m:0,
                                    mb:2,
                                    width:'100%'
                                }}
                            >
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
                                                    {/*(item.account?.options[0].voteWeight && item.account?.state === 2) ?
                                                        <TableRow sx={{border:'none'}}>
                                                            <TableCell colSpan={7} sx={{borderBottom:'none!important'}}>
                                                                <Box sx={{ width: '100%' }}>
                                                                    <VotesLinearProgress variant="determinate" value={(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100)} />
                                                                </Box>
                                                            </TableCell>
                                                        </TableRow>
                                            :<></>*/}
                                                
                                                    <TableRow 
                                                        key={index} sx={{ 
                                                            borderBottom: 'unset!important', 
                                                            backgroundColor:'none',
                                                            m:0,
                                                            p:0,
                                                            pb:2,
                                                            borderRadius: '17px',
                                                            }}>
                                                        {/*
                                                        <TableCell align="left"
                                                            sx={{borderBottom:'none'}}
                                                        >
                                                            <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`} >
                                                                <GetGovernanceFromRulesView
                                                                    governanceLookup={governanceLookup}
                                                                    rulesWallet={item.account.governance?.toBase58()}
                                                                    proposal={item.pubkey.toBase58()}
                                                                />
                                                            </Typography>
                                                        </TableCell>
                                                        */}
                                                        <TableCell sx={{
                                                            m:0,
                                                            mt:0,
                                                            p:0,
                                                            border:'none',
                                                            }}>
                                                            <Typography variant="caption" 
                                                                color={(item.account?.state === 2) ? `white` : `gray`} 
                                                                sx={{ textDecoration: (item.account?.state === 6) ? 'line-through' : 'none' }}>
                                                                
                                                                <GetGovernanceFromRulesView
                                                                    governanceLookup={governanceLookup}
                                                                    rulesWallet={item.account.governance?.toBase58()}
                                                                    proposal={item.pubkey.toBase58()}
                                                                    name={item.account?.name}
                                                                    description={item.account?.descriptionLink}
                                                                    state={item.account?.state}
                                                                    draftAt={item.account.draftAt}
                                                                    item={item}
                                                                />

                                                            </Typography>
                                                        </TableCell>
                                                        {/*
                                                        <TableCell
                                                        >
                                                            <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                                {`${item.account?.draftAt ? (moment.unix(Number((item.account.draftAt))).format("MMM D, YYYY, h:mm a")) : `-`}`}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell
                                                        >
                                                            <Typography variant="caption" color={(item.account?.state === 2) ? `white` : `gray`}>
                                                                {`${item.account?.signingOffAt ? (moment.unix(Number((item.account?.signingOffAt))).format("MMM D, YYYY, h:mm a")) : `N/A`}`}
                                                            </Typography>
                                                        </TableCell>
                                                        
                                                        {item?.account?.voteType?.type === 1 ?
                                                            <>
                                                                <TableCell 
                                                                    colSpan={2}
                                                                    sx={{textAlign:'center',}}>Multiple Choice Poll
                                                                </TableCell>
                                                            </>
                                                        :
                                                            <>
                                                        
                                                            <TableCell sx={{}}>
                                                                {Number(item.account?.options[0].voteWeight) > 0 ?
                                                                <>
                                                                {`${(((Number(item.account?.options[0].voteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                </>
                                                                :
                                                                <>0%</>
                                                                }
                                                            </TableCell>
                                                            <TableCell sx={{}}>
                                                                {Number(item.account?.denyVoteWeight) > 0 ?
                                                                <>
                                                                {`${(((Number(item.account?.denyVoteWeight))/((Number(item.account?.denyVoteWeight))+(Number(item.account?.options[0].voteWeight))))*100).toFixed(2)}%`}
                                                                </>:
                                                                <>0%</>
                                                                }
                                                            </TableCell>
                                                            </>
                                                        }
                                                        <TableCell  align="center"
                                                            sx={{}}
                                                        >
                                                            <GetProposalStatus item={item} />
                                                        </TableCell>
                                                        */}
                                                        

                                                    </TableRow>
                                                    {/*
                                                    <TableRow sx={{pb:2, backgroundColor:'rgba(255,255,255,0.025)'}}>
                                                        <TableCell  align="center" colSpan={6} sx={{borderBottom: '1px solid rgba(255,255,255,0.3)',mt:0,mb:0,pt:0,pb:0}}>
                                                        <Grid container xs={12}
                                                            sx={{
                                                                width:'100%',
                                                                mt: 1,
                                                                mb: 1,
                                                                background: 'rgba(0, 0, 0, 0.2)',
                                                                borderTop: '1px solid rgba(0,0,0,0.3)',
                                                                borderRadius: '17px',
                                                                overflow: 'hidden',
                                                                p: 1,
                                                                color: 'gray',
                                                            }} 
                                                        >
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                Governing Mint <ExplorerView
                                                                    address={item.account.governingTokenMint?.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                Rules <ExplorerView
                                                                    address={item.account.governance?.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                Proposal <ExplorerView
                                                                    address={item.pubkey.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={12} sm={6} md={3} >
                                                                <Typography sx={{fontSize:'9px'}}>
                                                                    Author Record <ExplorerView
                                                                        address={item.account?.tokenOwnerRecord?.toBase58()} 
                                                                        type='address'
                                                                        shorten={8}
                                                                        hideTitle={false} style='text' color='inherit' fontSize='9px'/>
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>
                                                        </TableCell>
                                                    </TableRow>
                                                    */}
                                                        
                                                </>
                                            }
                                        </>

                                    )
                                )}
                                </>
                                }
                            </TableBody>
                            
                            <Grid 
                                display="flex"
                                justifyContent="flex-end"
                                sx={{ 
                                    m:1,
                                    mt:2,
                                    borderRadius:'17px',
                                    background:'none',
                                }}>
                                <TableFooter
                                    sx={{
                                        backgroundColor:'#2E2934',
                                        borderRadius:'17px',
                                    }}
                                >
                                    <TableRow
                                        sx={{
                                        }}
                                    >
                                        <TablePagination
                                            rowsPerPageOptions={[5, 10, 25, { label: 'All', value: -1 }]}
                                            colSpan={1}
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
                                            sx={{
                                                mt:2,
                                                borderRadius:'17px',
                                            }}
                                        />
                                    </TableRow>
                                </TableFooter>
                            </Grid>
                            
                        </StyledTable>
                    </Table>
                </TableContainer>
            </>
        )
}

export function GovernanceRealtimeView(props: any) {
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const storagePool = GGAPI_STORAGE_POOL;
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
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
                    const gprops = await getAllProposalsIndexed(null, null, null); // default instance
                    // fetch also custom programs instances
                    
                    const mango = await getAllProposalsIndexed(null, "Mango", null); // mango
                    const marinade = await getAllProposalsIndexed(null, "Marinade_DAO", null); 
                    const pyth = await getAllProposalsIndexed(null, "Pyth_Governance", null); 
                    const jet = await getAllProposalsIndexed(null, "Jet_Custody", null); 
                    const psy = await getAllProposalsIndexed(null, "Psy_Finance", null);
                    const monke = await getAllProposalsIndexed(null, "MonkeDAO", null);
                    const helium = await getAllProposalsIndexed(null, "Helium", null);
                    
                    gprops.push(...mango, ...marinade, ...pyth, ...jet, ...psy, ...monke, ...helium);
                    
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
                    //console.log("prop: "+JSON.stringify(sortedRPCResults[0]))
                    setAllProposals(sortedRPCResults);
                    setProposals(sortedRPCResults);
                    
            }catch(e){console.log("ERR: "+e)}
        }
        setLoading(false);
    }

    React.useEffect(() => {
        if (allProposals){
            if (filterState){
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
    
    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        setGovernanceLookup(fglf);
    }

    React.useEffect(() => { 
        if (!loading){
            callGovernanceLookup();
            getGovernanceParameters();
        }
        
        const interval = setInterval(() => {
            getGovernanceParameters();
          }, 300000); // Call getGovernanceParameters every 5 minutes (300000 milliseconds)
        
          return () => {
            clearInterval(interval); // Clear the interval when the component unmounts to prevent memory leaks
        };
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
                <Grid
                        sx={{
                        p: 1}}
                    >
                        <Box
                            sx={{
                                width:'100%',
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                mt:2,
                                p: 2,
                                pt: 4,
                                pb: 4,
                                alignItems: 'center', textAlign: 'center',
                                //backgroundImage: `url(${FRICTIONLESS_BG})`,
                                backgroundRepeat: "repeat",
                                backgroundSize: "cover",
                                // Responsive padding for mobile devices
                                '@media (max-width: 600px)': {
                                    p: 0,
                                },
                            }} 
                        > 
                        <Typography variant="caption" sx={{color:'white'}}>Loading Governance Realtime Proposals</Typography>
                        
                        <LinearProgress color="inherit" />
                        
                    </Box>
                </Grid>
            )
        } else{
            if (proposals){
                return (
                    <Grid
                        sx={{
                        p: 1}}
                    >
                        <Box
                            sx={{
                                width:'100%',
                                background: 'rgba(0, 0, 0, 0.6)',
                                borderRadius: '17px',
                                mt:2,
                                p: 2,
                                pt: 4,
                                pb: 4,
                                alignItems: 'center', textAlign: 'center',
                                //backgroundImage: `url(${FRICTIONLESS_BG})`,
                                backgroundRepeat: "repeat",
                                backgroundSize: "cover",
                                // Responsive padding for mobile devices
                                '@media (max-width: 600px)': {
                                    p: 0,
                                },
                            }} 
                        > 
                        
                        
                            <Box
                                sx={{
                                    background: `#19141F`,
                                    borderRadius: '17px',
                                    m:2,
                                    p: 4,
                                    // Responsive padding for mobile devices
                                    '@media (max-width: 600px)': {
                                        m: 0,
                                        p: 0,
                                    },
                                }}
                                > 

                            <Grid container direction="row" sx={{
                                ml:1,
                                mr:1,
                                mb:2,
                                }}>
                                <Grid item xs>
                                    <Typography variant="h4" sx={{ textAlign: "left" }}>Realtime Proposals <BlinkingDot /></Typography>
                                </Grid>
                                <Grid item alignContent={"right"}>
                                    <Typography variant="body2" 
                                        sx={{ 
                                            textAlign:"left",
                                            fontSize:"10px",
                                            color:"gray",
                                            // Responsive padding for mobile devices
                                            '@media (max-width: 600px)': {
                                                mr:1.5,
                                            }, }}>
                                                Powered by<br/>GRAPE X SOLANA</Typography>

                                </Grid>
                            </Grid>
                                
                                <RenderGovernanceTable 
                                    endTimer={endTimer} 
                                    proposals={proposals} 
                                    filterState={filterState}
                                    setFilterState={setFilterState}
                                    governanceLookup={governanceLookup}
                                />
                                    
                                    
                                {endTime &&
                                    <Grid
                                        sx={{
                                            m: 0,
                                            textAlign:'left',
                                            // Responsive padding for mobile devices
                                            '@media (max-width: 600px)': {
                                                ml:1,
                                                mb:1,
                                            },
                                        }}
                                    >
                                        <Typography 
                                            variant="caption"
                                            sx={{
                                                textAlign:'left'
                                            }}
                                        >
                                            Rendering Time: {Math.floor(((endTime-startTime) / 1000) % 60)}s ({Math.floor((endTime-startTime))}ms) Realtime *Beta<br/>
                                        </Typography>

                                    </Grid>
                                }
                            </Box>  
                        </Box>
                    </Grid> 
                );
            }else{
                return (
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
                );
            }
            
        }
    
}