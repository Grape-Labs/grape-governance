import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Link } from "react-router-dom";

import { initGrapeGovernanceDirectory } from './api/gspl_queries';

import {
    Box,
    Badge,
    Grid,
    Card,
    CardActions,
    CardContent,
    IconButton,
    Button,
    ButtonGroup,
    TextField,
    Tooltip,
    Typography,
    LinearProgress,
    linearProgressClasses,
    Fab,
    Fade,
    useScrollTrigger,
    TableContainer,
    Table,
    TableBody,
    TableRow,
    TableCell,
    Paper,
} from '@mui/material/';

import GovernanceRealtimeInfo from './GovernanceRealtimeInfo';
import GovernanceDirectoryCardView from "./GovernanceDirectoryCardView";
import GovernanceParticipationView from "./GovernanceParticipationView";

import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BallotIcon from '@mui/icons-material/Ballot';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import SortIcon from '@mui/icons-material/Sort';
import HowToVoteIcon from '@mui/icons-material/HowToVote';

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'

import {
    fetchGovernanceLookupFile,
    fetchGovernanceMasterMembersFile,
    getFileFromLookup
} from './CachedStorageHelpers'; 

import {
    timeAgo
} from '../utils/grapeTools/WalletAddress'

import { GGAPI_STORAGE_POOL, RPC_CONNECTION, RPC_ENDPOINT } from '../utils/grapeTools/constants';
import moment from 'moment';

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

interface Props {
    /**
     * Injected by the documentation to work in an iframe.
     * You won't need it on your project.
     */
    window?: () => Window;
    children: React.ReactElement;
}

function isValidSolanaPublicKey(publicKeyString:string) {
    // Regular expression for Solana public key validation
    if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
        return false;
    }
    
    // Regular expression for Solana public key validation
    const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    // Check if the publicKey matches the Solana public key pattern
    let status = solanaPublicKeyRegex.test(publicKeyString);
    try{
        if (status){
            const pk = new PublicKey(publicKeyString);
            if (pk)
                return true;
            else
                return false;
        }
    }catch(e){
        return false;
    }
}

function ScrollTop(props: Props) {
    const { children, window } = props;
    // Note that you normally won't need to set the window ref as useScrollTrigger
    // will default to window.
    // This is only being set here because the demo is in an iframe.
    const trigger = useScrollTrigger({
      target: window ? window() : undefined,
      disableHysteresis: true,
      threshold: 100,
    });
  
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (
        (event.target as HTMLDivElement).ownerDocument || document
      ).querySelector('#back-to-top-anchor');
  
      if (anchor) {
        anchor.scrollIntoView({
          block: 'center',
        });
      }
    };
  
    return (
      <Fade in={trigger}>
        <Box
          onClick={handleClick}
          role="presentation"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
        >
          {children}
        </Box>
      </Fade>
    );
  }

export function GovernanceDirectoryView(props: Props) {
    const { publicKey } = useWallet();
    
    const [metadataMap, setMetadataMap] = React.useState<{ [key: string]: any }>({});

    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [loading, setLoading] = React.useState(false);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [searchFilter, setSearchFilter] = React.useState(null);
    const [governanceLastVaultValue, setGovernanceLastVaultValue] = React.useState(null);
    const [governanceLastVaultSolValue, setGovernanceLastVaultSolValue] = React.useState(null);
    const [governanceLastVaultSol, setGovernanceLastVaultSol] = React.useState(null);
    const [governanceLastVaultStableCoinValue, setGovernanceLastVaultStableCoinValue] = React.useState(null);
    const [governanceLastMembers, setGovernanceLastMembers] = React.useState(null);
    const [governanceLastProposals, setGovernanceLastProposals] = React.useState(null);
    const [gspl, setGSPL] = React.useState(null);
    
    const [governanceTotalVaultValue, setGovernanceTotalVaultValue] = React.useState(null);
    const [governanceTotalVaultSolValue, setGovernanceTotalVaultSolValue] = React.useState(null);
    const [governanceTotalVaultSol, setGovernanceTotalVaultSol] = React.useState(null);
    const [governanceTotalVaultStableCoinValue, setGovernanceTotalVaultStableCoinValue] = React.useState(null);
    const [governanceTotalMembers, setGovernanceTotalMembers] = React.useState(null);
    const [governanceTotalVotingRecordMembers, setGovernanceTotalVotingRecordMembers] = React.useState(null);
    const [governanceTotalParticipatingMultisigs, setGovernanceTotalParticipatingMultisigs] = React.useState(null);
    const [governanceTotalProposals, setGovernanceTotalProposals] = React.useState(null);
    const [sortingType, setSortingType] = React.useState(null);
    const [sortingDirection, setSortingDirection] = React.useState(null);

    const sortGovernance = (type:number) => {
        let sorted = governanceLookup; 

        let direction = sortingDirection;
        if (direction === 0) direction = 1;
        else direction = 0;
        console.log("type: " + type+ " direction: "+direction)
        if (type === 1 && direction === 0){ // by members:
            sorted = governanceLookup.sort((a:any, b:any) => a?.totalMembers < b?.totalMembers ? 1 : -1); 
        } else if (type === 1 && direction === 1){ // by members:
            sorted = governanceLookup.sort((a:any, b:any) => b?.totalMembers < a?.totalMembers ? 1 : -1); 
        } else if (type === 2 && direction === 0){ // by props:
            sorted = governanceLookup.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
        } else if (type === 2 && direction === 1){ // by props:
            sorted = governanceLookup.sort((a:any, b:any) => b?.totalProposals < a?.totalProposals ? 1 : -1); 
        } else if (type === 3 && direction === 0){ // by voting props:
            sorted = governanceLookup.sort((a:any, b:any) => a?.totalProposalsVoting < b?.totalProposalsVoting ? 1 : -1); 
        } else if (type === 3 && direction === 1){ // by voting props:
            sorted = governanceLookup.sort((a:any, b:any) => b?.totalProposalsVoting < a?.totalProposalsVoting ? 1 : -1); 
        } else if (type === 4 && direction === 0){ // by treasury:
            sorted = governanceLookup.sort((a:any, b:any) => a?.totalVaultValue < b?.totalVaultValue ? 1 : -1); 
        } else if (type === 4 && direction === 1){ // by treasury:
            sorted = governanceLookup.sort((a:any, b:any) => b?.totalVaultValue < a?.totalVaultValue ? 1 : -1); 
        } else if (type === 5 && direction === 0){ // by last proposal date:
            sorted = governanceLookup.sort((a:any, b:any) => Number("0x"+a.lastProposalDate) < Number("0x"+b.lastProposalDate) ? 1 : -1); 
        } else if (type === 5 && direction === 1){ // by last proposal data:
            sorted = governanceLookup.sort((a:any, b:any) => Number("0x"+b.lastProposalDate) < Number("0x"+a.lastProposalDate) ? 1 : -1); 
        } else if (type === 6 && direction === 0){ // by stable coin:
            sorted = governanceLookup.sort((a:any, b:any) => a?.totalVaultStableCoinValue < b?.totalVaultStableCoinValue ? 1 : -1);
        } else if (type === 6 && direction === 1){ // by stable coin:
            sorted = governanceLookup.sort((a:any, b:any) => b?.totalVaultStableCoinValue < a?.totalVaultStableCoinValue ? 1 : -1);
        } 

        setSortingType(type);
        setSortingDirection(direction);
        setGovernanceLookup(sorted);
    }

    function GovernanceDirectorySorting(props: any){
        
        return(
            <Box
                m={1}
                //margin
                sx={{alignItems: 'center', textAlign: 'center',p:2,borderRadius:'17px',background:'rgba(0,0,0,0.025)'}}
                >
                    
                    <Box
                        display="flex"
                        justifyContent="flex-end"
                        sx={{
                            alignItems:"right"
                        }}
                    >      
                            <ButtonGroup
                                color='inherit'
                                size='small'
                                variant='outlined'
                                sx={{borderRadius:'17px'}}
                            >
                                <Tooltip title={
                                        <>Sort by Members {sortingType === 1 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(1)}
                                    > <GroupIcon /> {sortingType === 1 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>

                                <Tooltip title={
                                        <>Sort by Proposals {sortingType === 3 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(2)}
                                    > <BallotIcon /> {sortingType === 2 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>
                                <Tooltip title={
                                        <>Sort by Currently Voting Proposals {sortingType === 2 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(3)}
                                    > <HowToVoteIcon /> {sortingType === 3 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>

                                <Tooltip title={
                                        <>Sort by Most Recent Proposals {sortingType === 2 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(5)}
                                    > <AccessTimeIcon /> {sortingType === 5 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                </Tooltip>
                                
                                <Tooltip title={
                                        <>Sort by Treasury {sortingType === 4 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(4)}
                                    > <AccountBalanceIcon /> {sortingType === 4 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                    
                                </Tooltip>

                                <Tooltip title={
                                        <>Sort by Total Stable Coin in Treasury {sortingType === 6 ? <>{sortingDirection === 0 ? `Ascending` : `Descending`}</>:<></>}
                                        </>
                                    }>
                                    <Button
                                        onClick={e => sortGovernance(6)}
                                    > <AttachMoneyIcon /> {sortingType === 6 ? <>{sortingDirection === 0 ? <SortIcon /> : <SortIcon sx={{transform: 'scaleX(-1)'}} />}</>:<></>}
                                    </Button>
                                    
                                </Tooltip>
                                
                            </ButtonGroup> 
                    </Box>
            </Box>
        );
    }
    
    const callGovernanceLookup = async() => {
        
        const gspldir = await initGrapeGovernanceDirectory();
        const fglf = await fetchGovernanceLookupFile(storagePool);
        const fgmmf = await fetchGovernanceMasterMembersFile(storagePool);

        //console.log("fglf: "+JSON.stringify(fglf));

        // pre sort
        const exportFglf = new Array();
        if (fglf && fglf.length > 0){
            
            const prepresorted = fglf.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
            const presorted = prepresorted.sort((a:any, b:any) => (b?.totalProposalsVoting < a?.totalProposalsVoting) ? 1 : -1); 
            const sorted = presorted.sort((a:any, b:any) => (a?.totalVaultValue < b?.totalVaultValue && b?.totalVaultValue > 1) ? 1 : -1); 

            // go through it one more time to merge gspldir data
            for (var item of sorted){
                if (gspldir){
                    for (var diritem of gspldir){
                        if (item.governanceName === diritem.name){ // also make sure that diritem.governanceProgram ===item.parent?
                            item.gspl = diritem;
                            console.log("GSPL Entry found for "+item.governanceName);
                        }
                    }
                }
            }

            //const sorted = fglf.sort((a:any, b:any) => (a.totalVaultStableCoinValue != null ? a.totalVaultStableCoinValue : Infinity) - (b.totalVaultStableCoinValue != null ? b.totalVaultStableCoinValue : Infinity)); 
            setGovernanceLookup(sorted);
            
            // fetch some summary data
            let totalVaultValue = 0;
            let totalVaultSolValue = 0;
            let totalVaultSol = 0;
            let totalVaultStableCoinValue = 0;
            let totalGovernanceProposals = 0;
            let totalGovernanceMembers = 0;
            let lastVaultValue = 0;
            let lastVaultSolValue = 0;
            let lastVaultSol = 0;
            let lastVaultStableCoinValue = 0;
            let lastGovernanceProposals = 0;
            let lastGovernanceMembers = 0;
            for (let item of sorted){
                if (item?.totalVaultValue)
                    totalVaultValue += item.totalVaultValue;
                if (item?.totalVaultStableCoinValue)
                    totalVaultStableCoinValue += item.totalVaultStableCoinValue;
                if (item?.totalVaultSol){
                    totalVaultSol += item.totalVaultSol;
                }
                if (item?.totalVaultSolValue){
                    totalVaultSolValue += item.totalVaultSolValue;
                }
                totalGovernanceMembers += item.totalMembers;
                totalGovernanceProposals += item?.totalProposals ? item.totalProposals : 0;

                //console.log("item "+JSON.stringify(item));

                if (item?.lastVaultValue)
                    lastVaultValue += +item.lastVaultValue;
                if (item?.lastVaultSolValue)
                    lastVaultSolValue += +item.lastVaultSolValue;
                if (item?.lastVaultSol)
                    lastVaultSol += +item.lastVaultSol;
                if (item?.lastVaultStableCoinValue)
                    lastVaultStableCoinValue += +item.lastVaultStableCoinValue;
                if (item?.lastMembers)
                    lastGovernanceMembers += +item.lastMembers;
                if (item?.lastProposals)
                    lastGovernanceProposals += +item.lastProposals;
                
            }

            setGSPL(gspldir);

            setGovernanceLastVaultValue(lastVaultValue);
            setGovernanceLastVaultSolValue(lastVaultSolValue);
            setGovernanceLastVaultSol(lastVaultSol);
            setGovernanceLastVaultStableCoinValue(lastVaultStableCoinValue);
            setGovernanceLastMembers(lastGovernanceMembers);
            setGovernanceLastProposals(lastGovernanceProposals);

            setGovernanceTotalVaultSolValue(totalVaultSolValue);
            setGovernanceTotalVaultSol(totalVaultSol);

            setGovernanceTotalVaultValue(totalVaultValue);
            setGovernanceTotalVaultStableCoinValue(totalVaultStableCoinValue);
            setGovernanceTotalVotingRecordMembers(totalGovernanceMembers);
            setGovernanceTotalProposals(totalGovernanceProposals);

            if (fgmmf && fgmmf.length > 0)
                setGovernanceTotalMembers(fgmmf.length)
            else
                setGovernanceTotalMembers(totalGovernanceMembers)

            let multisigParticipation = 0;
            if (fgmmf){
                for (var masterMember of fgmmf){
                    //console.log("masterMember: "+JSON.stringify(masterMember))
                    if (masterMember?.multisigs?.multisigs && masterMember.multisigs.multisigs.length > 0)
                        multisigParticipation += 1;//masterMember.multisigs.length; 
                }
            }

            setGovernanceTotalParticipatingMultisigs(multisigParticipation);

            
            // export
            /*
            for (let item of sorted){
                exportFglf.push(
                    {
                        governanceAddress:item.governanceAddress,
                        governanceName:item.governanceName,
                        version:item.version,
                        timestamp:moment.unix(Number(item.timestamp)).format("YYYY-MM-DD HH:mm"),
                        filename:item.filename,
                        memberFilename:item.filename,
                        governanceTransactionsFilename:item.governanceTransactionsFilename,
                        totalMembers:item.totalMembers,
                        totalQuorum:item.totalQuorum,
                        communityTokenSupply:item.tokenSupply,
                        lastProposalDate:moment.unix(Number("0x"+item.lastProposalDate)).format("YYYY-MM-DD HH:mm"),
                        totalCouncilProposals:item.totalCouncilProposals,
                        totalProposalsVoting:item.totalProposalsVoting,
                        totalProposals:item.totalProposals,
                    }
                )
            }
            */
        }

        //console.log("exportable: "+JSON.stringify(exportFglf));
        setLoading(false);
    }


    React.useEffect(() => {
        const fetchMetadata = async () => {
            const newMetadataMap = { ...metadataMap };
            if (governanceLookup){
                await Promise.all(
                    governanceLookup.map(async (item:any) => {
                        if (item.gspl && item.gspl.metadataUri && !newMetadataMap[item.gspl.metadataUri]) {
                            try {
                                const response = await fetch(item.gspl.metadataUri);
                                if (response.ok) {
                                    const metadata = await response.json();
                                    newMetadataMap[item.gspl.metadataUri] = metadata;
                                } else {
                                    console.error("Failed to fetch metadata:", item.gspl.metadataUri);
                                }
                            } catch (error) {
                                console.error("Error fetching metadata:", error);
                            }
                        }
                    })
                );
            }
            setMetadataMap(newMetadataMap);
        };
        fetchMetadata();
    }, [governanceLookup]);

    React.useEffect(() => {
        if (!governanceLookup){
            setLoading(true);
            callGovernanceLookup();
        }
    }, []);
    

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
                <Typography variant="caption">Loading Directory</Typography>
                
                <LinearProgress color="inherit" />
                
            </Box>
        )
    } else{
        if (governanceLookup){
            return (
                <Box
                    sx={{
                        mt:6,
                        background: 'rgba(0, 0, 0, 0.5)',
                        borderRadius: '17px',
                        p:2,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Grid container sx={{mb:2}} id="back-to-top-anchor">
                        <Grid item xs={8} container justifyContent="flex-start"
                            sx={{textAlign:'left',mb:2}}
                        >
                            <Grid container>
                                <Grid item xs={12}>
                                    <Typography variant="h4">
                                        DAO Directory
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="caption">
                                        {gspl && gspl.length} Verified DAOs on the Grape GSPL
                                    </Typography>
                                    <Typography color='#555' fontSize="9px">{governanceLookup && governanceLookup.length} Active Solana DAOs | 2,500+ DAOs on SPL Governance</Typography>
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid item xs={4} container justifyContent="flex-end"
                            sx={{textAlign:'right'}}
                        >
                            <Grid container>
                                <Grid item xs={12}>
                                    {/*publicKey &&
                                        <Button
                                            variant='contained'
                                            color='inherit'
                                            sx={{backgroundColor:'white',mt:0.2,mr:1}}
                                            disabled
                                        >
                                            Create Governance
                                        </Button>
                                    */}
                                    
                                    <TextField 
                                        size="small"
                                        id="search-governances" 
                                        label="Search" 
                                        variant="outlined"
                                        onChange={(e) => setSearchFilter(e.target.value)}
                                        sx={{
                                            '.MuiInputBase-input': { fontSize: '16px' },
                                        }}
                                        />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>

                    
                    {(!searchFilter || (searchFilter && searchFilter.length <= 0)) &&
                    <>
                        <GovernanceParticipationView pubkey={publicKey} metadataMap={metadataMap} governanceLookup={governanceLookup} />

                        {/*
                        <Box sx={{mb:1}}>
                            <Box
                                sx={{ 
                                    mb: 1, 
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '17px'
                                }}
                            > 
                                Realtime
                            </Box>
                        </Box>
                        */}
                        
                        <Box sx={{mb:1}}>
                            <GovernanceRealtimeInfo governanceLookup={governanceLookup} governanceAddress={"GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"} title={'Latest Activity'} expanded={true} />
                        </Box>
                        
                        <Box sx={{ 
                            p:1}}>
                            <Grid container spacing={0}>
                                <Grid item xs={12} md={12} lg={6} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            ml:0,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Total Treasury Value</>
                                        </Typography>
                                        <Tooltip title={<>
                                                The total deposited in all SPL Governance accounts<br/>Last Fetch: {governanceLastVaultValue ? `$${getFormattedNumberToLocale(Number(governanceLastVaultValue.toFixed(2)))}` : 0}
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
                                                        {governanceTotalVaultValue ? `$${getFormattedNumberToLocale(Number(governanceTotalVaultValue.toFixed(2)))}` : 0}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Total in Stable Coins</>
                                        </Typography>
                                        <Tooltip title={<>
                                                The total value of stable coins deposited in SPL Governance (USDC, USDT, PAI)<br/>Last Fetch: {governanceLastVaultStableCoinValue ? `$${getFormattedNumberToLocale(Number(governanceLastVaultStableCoinValue.toFixed(2)))}` : 0}
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
                                                        {governanceTotalVaultStableCoinValue ? `$${getFormattedNumberToLocale(Number(governanceTotalVaultStableCoinValue.toFixed(2)))}` : 0}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            ml:0,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Total Treasury Sol Value</>
                                        </Typography>
                                        <Tooltip title={<>
                                                The total value of deposited Solana in all SPL Governance accounts<br/>Last Fetch: {governanceLastVaultSolValue ? `$${getFormattedNumberToLocale(Number(governanceLastVaultSolValue.toFixed(2)))}` : 0}
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
                                                        {governanceTotalVaultSolValue ? `$${getFormattedNumberToLocale(Number(governanceTotalVaultSolValue.toFixed(2)))}` : 0}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            ml:0,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Total Treasury Sol</>
                                        </Typography>
                                        <Tooltip title={<>
                                                The total Solana deposited in all SPL Governance accounts<br/>Last Fetch: {governanceLastVaultSol ? `$${getFormattedNumberToLocale(Number(governanceLastVaultSol.toFixed(2)))}` : 0}
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
                                                        {governanceTotalVaultSol ? <>{getFormattedNumberToLocale(Number(governanceTotalVaultSol.toFixed(2)))}<Typography variant="caption">Sol</Typography></> : 0}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Unique Voters</>
                                        </Typography>
                                        <Tooltip title={<>
                                                All time members throughout all governances:
                                                <br/>Current Voting Records: {governanceTotalVotingRecordMembers ? getFormattedNumberToLocale(governanceTotalVotingRecordMembers) : 0}
                                                <br/>Last Fetch Voting Records: {governanceLastMembers ? getFormattedNumberToLocale(governanceLastMembers) : 0}
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
                                                        {governanceTotalMembers ? getFormattedNumberToLocale(governanceTotalMembers) : 0}

                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            mr:0,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Proposals</>
                                        </Typography>
                                        <Tooltip title={<>
                                                All time proposals from all governances<br/>Last Fetch: {governanceLastProposals ? getFormattedNumberToLocale(governanceLastProposals) : 0}
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
                                                        {governanceTotalProposals ? getFormattedNumberToLocale(governanceTotalProposals) : 0}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} lg={3} key={1}>
                                    <Box
                                        sx={{
                                            borderRadius:'24px',
                                            m:2,
                                            p:1,
                                            background: 'rgba(0, 0, 0, 0.2)',
                                        }}
                                    >
                                        <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'center'}}>
                                            <>Voters Participating in Multisigs</>
                                        </Typography>
                                        <Tooltip title={<>
                                                Voters that are also participating in Squads Multisigs
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
                                                        {governanceTotalParticipatingMultisigs && <>{governanceTotalParticipatingMultisigs > 0  ? getFormattedNumberToLocale(governanceTotalParticipatingMultisigs) : `-`}</>}
                                                    </Typography>
                                                </Grid>
                                            </Button>
                                        </Tooltip>
                                    </Box>
                                </Grid>
                            
                            </Grid>
                        </Box>
                        </>
                    }
                    
                    <GovernanceDirectorySorting />
                    
                    <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
                        
                        {governanceLookup.map((item: any,key:number) => {
                            const metadata = (item?.gspl && item.gspl?.metadataUri) ? metadataMap[item.gspl.metadataUri] : {};
                            return (
                            <>
                            {searchFilter ?
                                <>
                                    {item.governanceName.replace(/\s+/g, '').toUpperCase()
                                        .includes(searchFilter.trim().replace(/\s+/g, '').toUpperCase()) ?
                                        <Grid item xs={12} sm={6} md={4} key={key}>
                                            <GovernanceDirectoryCardView 
                                                item={item}
                                                metadata={metadata} 
                                            />
                                        </Grid>
                                        :
                                        <>
                                            {isValidSolanaPublicKey(searchFilter.trim()) && 
                                                (item.governanceAddress.trim().includes(searchFilter.trim()) || 
                                                (item?.communityMint && item.communityMint.trim().includes(searchFilter.trim())) || 
                                                (item?.councilMint && item.councilMint.trim().includes(searchFilter.trim()))) && 
                                                (
                                                    <Grid item xs={12} sm={6} md={4} key={key}>
                                                        <GovernanceDirectoryCardView 
                                                            item={item}
                                                            metadata={metadata} 
                                                        />
                                                    </Grid>
                                                )
                                            }
                                        </>
                                    }
                                </>
                                :
                                <Grid item xs={12} sm={6} key={key}>
                                    {/*(item.realm.owner !== 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw') &&
                                        console.log(item.realm.account.name+": "+item.realm.owner)
                                    */}
                                    <GovernanceDirectoryCardView 
                                        item={item}
                                        metadata={metadata} 
                                    />
                                </Grid>
                            }
                            </>
                            )
                        })}
                    </Grid>

                    <ScrollTop {...props}>
                        <Fab size="small" aria-label="scroll back to top">
                        <KeyboardArrowUpIcon />
                        </Fab>
                    </ScrollTop>
                </Box>
            )
        } else{
            return(
            <Box
                sx={{
                    mt:6,
                    background: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '17px',
                    p:4,
                    alignItems: 'center', textAlign: 'center'
                }} 
            > 
                <Grid 
                    className="grape-paper" 
                    container
                    alignContent="center"
                    justifyContent="center"
                    direction="column">
                    <Grid item>
                        <Typography 
                        align="center"
                        variant="h3">
                            Select a governance above to get started
                        </Typography>

                        <Typography 
                        align="center"
                        variant="caption">
                            NOTE:
                            <br/>
                            *Cached method will fetch Governance will load all proposals & proposal details
                            <br/>
                            *RPC method will fetch Governance via RPC calls (additional RPC calls are needed per proposal, significantly increasing the load time)
                        </Typography>
                        
                    </Grid>
                    </Grid>
            </Box>
            );

        }

    }
}