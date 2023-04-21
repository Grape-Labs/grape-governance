import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Link } from "react-router-dom";

import {
    Box,
    Badge,
    Grid,
    Card,
    CardActions,
    CardContent,
    Button,
    ButtonGroup,
    TextField,
    Tooltip,
    Typography,
    LinearProgress,
    linearProgressClasses
} from '@mui/material/';

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

import { GGAPI_STORAGE_POOL } from '../utils/grapeTools/constants';
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


function GovernanceCardView(props:any) {
    const item = props.item;
    const randomColor = Math.floor(Math.random()*16777215).toString(16);
    //console.log("randomColor: "+randomColor)

    return (
        <Card sx={{ 
            borderRadius: '17px',
            background: 'linear-gradient(to right, rgba(0,0,0,0.50) 40%, #'+randomColor+' 200%)' }}>
        <CardContent>
            <Grid container>
                <Grid item xs={12} sm={8} container justifyContent="flex-start">
                    <Typography sx={{ fontSize: 10, color:'rgba(255,255,255,0.1)' }} gutterBottom>
                        Governance {item?.governanceAddress &&
                            <>{item.governanceAddress}</>
                        }
                    </Typography>
                </Grid>
                <Grid item xs={12} sm={4} container justifyContent="flex-end">
                    {item.totalProposalsVoting && item.totalProposalsVoting > 0 ?
                        <Tooltip title={
                            <>Voting: {item.totalProposalsVoting} Active Proposal{item.totalProposalsVoting > 1 ? `s`:``}</>}>
                            <Button
                                color='inherit'
                                sx={{borderRadius:'17px'}}
                            >
                                <Badge badgeContent={item.totalProposalsVoting} color="success"><HowToVoteIcon /></Badge>
                                
                            </Button>
                        </Tooltip>
                    :
                        <></>
                    }
                </Grid>
            </Grid>
                <Tooltip title={`View ${item.governanceName} Governance`}>
                    <Button 
                        component={Link}
                        to={'/cachedgovernance/'+item.governanceAddress}
                        size="large"
                        color='inherit'
                        sx={{borderRadius:'17px',textTransform:'none'}}
                        >
                        <Typography variant="h4" component="div">
                            {item.governanceName}
                        </Typography>
                    </Button>
                </Tooltip>
                
                <Box
                    sx={{
                        borderRadius:'24px',
                        m:1,
                        p:1,
                        background: 'rgba(0, 0, 0, 0.2)'
                    }}
                >

                    {item?.totalVaultValue?
                        <>{item.totalVaultValue > 1 ?
                        <Typography variant="body2">
                            <>Treasury <strong>{getFormattedNumberToLocale(Number(item.totalVaultValue).toFixed(2))} USD</strong></>
                        </Typography>
                        :<></>}
                        </>
                        :<></>
                    }

                    {item?.totalVaultStableCoinValue?
                        <>{item.totalVaultStableCoinValue > 1 ?
                        <Typography variant="body2">
                            <>Treasury in Stable Coin <strong>{getFormattedNumberToLocale(Number(item.totalVaultStableCoinValue).toFixed(2))} USD</strong></>
                        </Typography>
                        :<></>}
                        </>
                        :<></>
                    }

                    {item?.totalVaultNftValue?
                        <>{item.totalVaultStableCoinValue > 1 ?
                        <Typography variant="body2">
                            <>Treasury NFT Floor Price <strong>{getFormattedNumberToLocale(Number(item.totalVaultNftValue).toFixed(2))} USD</strong></>
                        </Typography>
                        :<></>}
                        </>
                        :<></>
                    }

                    {(item.totalMembers && item.totalMembers > 0) &&
                        <Typography variant="body2">
                            <>All Time Members <strong>{item.totalMembers}</strong></>
                        </Typography>
                    }
                    <Typography variant="body2">
                        {item?.totalProposals &&
                            <>Total Proposals <strong>{item.totalProposals}</strong>
                                {item?.totalCouncilProposals ?
                                    <>{item.totalCouncilProposals > 0 &&
                                        <><br/>{item.totalProposals - item.totalCouncilProposals} community / {item.totalCouncilProposals} council</>
                                    }
                                    </>
                                    :<></>
                                }
                            </>
                        }
                        <br />
                        {item?.lastProposalDate &&
                            <Tooltip title={
                                <> {moment.unix(Number("0x"+item.lastProposalDate)).format("MMMM D, YYYY, h:mm a") }</>
                            }>
                                <Button
                                    color='inherit'
                                    sx={{borderRadius:'17px',textTransform:'none'}}
                                >
                                Last Proposal {timeAgo(Number("0x"+item.lastProposalDate).toString())}
                                </Button>
                            </Tooltip>
                        }
                    </Typography>
                </Box>
        </CardContent>
        <CardActions>
            {/*
            <Tooltip title="Cached method will fetch Governance will load all proposals & proposal details">
                <Button 
                    component={Link}
                    to={'/cachedgovernance/'+item.governanceAddress}
                    size="small"
                    color='inherit'
                    sx={{borderRadius:'17px',textTransform:'none'}}
                    >View Governance via Cache</Button>
            </Tooltip>
            */}
            {/*
            <Tooltip title="RPC method will fetch Governance via RPC calls (additional RPC calls are needed per proposal, significantly increasing the load time)">
                <Button 
                    component={Link}
                    to={'/rpcgovernance/'+item.governanceAddress}
                    size="small"
                    color='inherit'
                    sx={{borderRadius:'17px',textTransform:'none'}}>View via RPC</Button>
                </Tooltip>
            */}
            {item.timestamp &&
                <Typography marginLeft='auto' variant='caption'>Cached: {moment.unix(Number(item.timestamp)).format("MMMM D, YYYY, h:mm a") }</Typography>
            }
        </CardActions>
        </Card>
    );
}

export function GovernanceDirectoryView() {
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [loading, setLoading] = React.useState(false);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [searchFilter, setSearchFilter] = React.useState(null);
    const [governanceLastVaultValue, setGovernanceLastVaultValue] = React.useState(null);
    const [governanceLastVaultStableCoinValue, setGovernanceLastVaultStableCoinValue] = React.useState(null);
    const [governanceLastMembers, setGovernanceLastMembers] = React.useState(null);
    const [governanceLastProposals, setGovernanceLastProposals] = React.useState(null);
    
    
    const [governanceTotalVaultValue, setGovernanceTotalVaultValue] = React.useState(null);
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
                display="flex"
                justifyContent="flex-end"
                alignItems="flex-end"
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
        );
    }
    
    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        const fgmmf = await fetchGovernanceMasterMembersFile(storagePool);

        // pre sort
        const exportFglf = new Array();
        if (fglf && fglf.length > 0){
            
            const prepresorted = fglf.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
            const presorted = prepresorted.sort((a:any, b:any) => (b?.totalProposalsVoting < a?.totalProposalsVoting) ? 1 : -1); 
            const sorted = presorted.sort((a:any, b:any) => (a?.totalVaultValue < b?.totalVaultValue && b?.totalVaultValue > 1) ? 1 : -1); 
            //const sorted = fglf.sort((a:any, b:any) => (a.totalVaultStableCoinValue != null ? a.totalVaultStableCoinValue : Infinity) - (b.totalVaultStableCoinValue != null ? b.totalVaultStableCoinValue : Infinity)); 
            setGovernanceLookup(sorted);
            
            // fetch some summary data
            let totalVaultValue = 0;
            let totalVaultStableCoinValue = 0;
            let totalGovernanceProposals = 0;
            let totalGovernanceMembers = 0;
            let lastVaultValue = 0;
            let lastVaultStableCoinValue = 0;
            let lastGovernanceProposals = 0;
            let lastGovernanceMembers = 0;
            for (let item of sorted){
                if (item?.totalVaultValue)
                    totalVaultValue += item.totalVaultValue;
                if (item?.totalVaultStableCoinValue)
                    totalVaultStableCoinValue += item.totalVaultStableCoinValue;
                totalGovernanceMembers += item.totalMembers;
                totalGovernanceProposals += item?.totalProposals ? item.totalProposals : 0;

                //console.log("item "+JSON.stringify(item));

                if (item?.lastVaultValue)
                    lastVaultValue += +item.lastVaultValue;
                if (item?.lastVaultStableCoinValue)
                    lastVaultStableCoinValue += +item.lastVaultStableCoinValue;
                if (item?.lastMembers)
                    lastGovernanceMembers += +item.lastMembers;
                if (item?.lastProposals)
                    lastGovernanceProposals += +item.lastProposals;
                
            }

            setGovernanceLastVaultValue(lastVaultValue);
            setGovernanceLastVaultStableCoinValue(lastVaultStableCoinValue);
            setGovernanceLastMembers(lastGovernanceMembers);
            setGovernanceLastProposals(lastGovernanceProposals);

            setGovernanceTotalVaultValue(totalVaultValue);
            setGovernanceTotalVaultStableCoinValue(totalVaultStableCoinValue);
            setGovernanceTotalVotingRecordMembers(totalGovernanceMembers);
            setGovernanceTotalProposals(totalGovernanceProposals);

            if (fgmmf && fgmmf.length > 0)
                setGovernanceTotalMembers(fgmmf.length)
            else
                setGovernanceTotalMembers(totalGovernanceMembers)

            let multisigParticipation = 0;
            for (var masterMember of fgmmf){
                //console.log("masterMember: "+JSON.stringify(masterMember))
                if (masterMember?.multisigs?.multisigs && masterMember.multisigs.multisigs.length > 0)
                    multisigParticipation += 1;//masterMember.multisigs.length; 
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
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Grid container sx={{mb:2}}>
                        <Grid item xs={12} sm={6} container justifyContent="flex-start"
                            sx={{textAlign:'left',mb:2}}
                        >
                            <Grid container>
                                <Grid item xs={12}>
                                    <Typography variant="h4">
                                        Governance Directory
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="caption">
                                        {governanceLookup && governanceLookup.length} Cached
                                    </Typography>
                                </Grid>
                            </Grid>
                        </Grid>
                        <Grid item xs={12} sm={6} container justifyContent="flex-end"
                            sx={{textAlign:'right'}}
                        >
                            <Grid container>
                                <Grid item xs={12}>
                                    <TextField 
                                        size="small"
                                        id="search-governances" 
                                        label="Search" 
                                        variant="outlined"
                                        onChange={(e) => setSearchFilter(e.target.value)}
                                        />
                                </Grid>
                            </Grid>
                        </Grid>
                    </Grid>

                    <Box sx={{ 
                        p:1}}>
                        <Grid container spacing={0}>
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
                                    <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'left'}}>
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
                                    <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'left'}}>
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
                                        p:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                    }}
                                >
                                    <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'left'}}>
                                        <>Unique Voters</>
                                    </Typography>
                                    <Tooltip title={<>
                                            {governanceTotalParticipatingMultisigs && <>Total Participating in Multisigs {governanceTotalParticipatingMultisigs  ? getFormattedNumberToLocale(governanceTotalParticipatingMultisigs) : 0}</>}
                                            <br/>All time members throughout all governances:
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
                                    <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'left'}}>
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
                        
                        </Grid>
                    </Box>
                    
                    <GovernanceDirectorySorting />
                    
                    <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
                        {governanceLookup.map((item: any,key:number) => (
                            <>
                            {searchFilter ?
                                <>
                                    {item.governanceName.toUpperCase().includes(searchFilter.toUpperCase()) &&
                                        <Grid item xs={12} sm={6} md={4} key={key}>
                                            <GovernanceCardView 
                                                item={item}
                                            />
                                        </Grid>
                                    }
                                </>
                                :
                                <Grid item xs={12} sm={6} key={key}>
                                    <GovernanceCardView 
                                        item={item}
                                    />
                                </Grid>
                            }
                            </>
                        ))}
                    </Grid>
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