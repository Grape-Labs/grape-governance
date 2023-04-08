import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Link } from "react-router-dom";

import {
    Box,
    Grid,
    Card,
    CardActions,
    CardContent,
    Button,
    TextField,
    Tooltip,
    Typography,
    LinearProgress,
    linearProgressClasses
} from '@mui/material/';

import HowToVoteIcon from '@mui/icons-material/HowToVote';

import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'

import {
    fetchGovernanceLookupFile,
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
                            ><HowToVoteIcon /></Button>
                        </Tooltip>
                    :
                        <></>
                    }
                </Grid>
            </Grid>
            <Button 
                component={Link}
                to={'/cachedgovernance/'+item.governanceAddress}
                size="large"
                color='inherit'
                sx={{borderRadius:'17px',textTransform:'none'}}
                >
                <Typography variant="h4" component="div">
                    {item.governanceName}
                </Typography></Button>

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
            <Tooltip title="Cached method will fetch Governance will load all proposals & proposal details">
                <Button 
                    component={Link}
                    to={'/cachedgovernance/'+item.governanceAddress}
                    size="small"
                    color='inherit'
                    sx={{borderRadius:'17px',textTransform:'none'}}
                    >View Governance via Cache</Button>
            </Tooltip>
            <Tooltip title="RPC method will fetch Governance via RPC calls (additional RPC calls are needed per proposal, significantly increasing the load time)">
                <Button 
                    component={Link}
                    to={'/rpcgovernance/'+item.governanceAddress}
                    size="small"
                    color='inherit'
                    sx={{borderRadius:'17px',textTransform:'none'}}>via RPC</Button>
                </Tooltip>
            {item.timestamp &&
                <Typography marginLeft='auto' variant='caption'>Fetched: {moment.unix(Number(item.timestamp)).format("MMMM D, YYYY, h:mm a") }</Typography>
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
    const [governanceTotalVaultValue, setGovernanceTotalVaultValue] = React.useState(null);
    const [governanceTotalVaultStableCoinValue, setGovernanceTotalVaultStableCoinValue] = React.useState(null);
    const [governanceTotalMembers, setGovernanceTotalMembers] = React.useState(null);
    const [governanceTotalProposals, setGovernanceTotalProposals] = React.useState(null);

    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        // pre sort
        const exportFglf = new Array();
        if (fglf && fglf.length > 0){
            const sorted = fglf.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
            setGovernanceLookup(sorted);
            
            // fetch some summary data
            let totalVaultValue = 0;
            let totalVaultStableCoinValue = 0;
            let totalGovernanceProposals = 0;
            let totalGovernanceMembers = 0;
            for (let item of sorted){
                if (item?.totalVaultValue)
                    totalVaultValue += item.totalVaultValue;
                if (item?.totalVaultStableCoinValue)
                    totalVaultStableCoinValue += item.totalVaultStableCoinValue;
                totalGovernanceMembers += item.totalMembers;
                totalGovernanceProposals += item.totalProposals;
            }
            setGovernanceTotalVaultValue(totalVaultValue);
            setGovernanceTotalVaultStableCoinValue(totalVaultStableCoinValue);
            setGovernanceTotalMembers(totalGovernanceMembers);
            setGovernanceTotalProposals(totalGovernanceProposals);

            
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

        console.log("exportable: "+JSON.stringify(exportFglf));
        setLoading(false);
    }

    React.useEffect(() => {
        if (!governanceLookup){
            setLoading(true);
            console.log("Step 1.")
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
                            <Grid item xs={12} sm={6} md={3} key={1}>
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
                                            The total deposited in all SPL Governance accounts
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

                            <Grid item xs={12} sm={6} md={3} key={1}>
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
                                            The total value of stable coins deposited in SPL Governance (USDC, USDT, PAI)
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

                            <Grid item xs={12} sm={6} md={3} key={1}>
                                <Box
                                    sx={{
                                        borderRadius:'24px',
                                        m:2,
                                        p:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                    }}
                                >
                                    <Typography variant="body2" sx={{color:'#2ecc71', textAlign:'left'}}>
                                        <>Members</>
                                    </Typography>
                                    <Tooltip title={<>
                                            All time members throughout all governances
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

                            <Grid item xs={12} sm={3} md={3} key={1}>
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
                                            All time proposals from all governances
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