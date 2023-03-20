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
    Tooltip,
    Typography,
    LinearProgress,
    linearProgressClasses
} from '@mui/material/';

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

    console.log("randomColor: "+randomColor)

    return (
        <Card sx={{ 
            borderRadius: '17px',
            background: 'linear-gradient(to right, rgba(0,0,0,0.50) 40%, #'+randomColor+' 200%)' }}>
        <CardContent>
            <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Governance
            </Typography>
            <Button 
                component={Link}
                to={'/cachedgovernance/'+item.governanceAddress}
                size="large"
                color='inherit'
                sx={{borderRadius:'17px',textTransform:'none'}}
                >
                <Typography variant="h5" component="div">
                {item.governanceName}
                </Typography></Button><br/>
            {item?.governanceAddress &&
                <Typography variant='caption' color="text.secondary">
                    {item.governanceAddress}
                </Typography>
            }
            <Typography variant="body2">
                {item?.totalProposals &&
                    <>Total Proposals {item.totalProposals}
                        {item?.totalCouncilProposals ?
                            <>{item?.totalCouncilProposals > 0 &&
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
                            sx={{borderRadius:'17px'}}
                        >
                        Last Proposal {timeAgo(Number("0x"+item.lastProposalDate).toString())}
                        </Button>
                    </Tooltip>
                }
            </Typography>
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

    const callGovernanceLookup = async() => {
        const fglf = await fetchGovernanceLookupFile(storagePool);
        // pre sort
        const sorted = fglf.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 

        setGovernanceLookup(sorted);
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
                        background: 'rgba(0, 0, 0, 0.6)',
                        borderRadius: '17px',
                        p:4,
                        alignItems: 'center', textAlign: 'center'
                    }} 
                > 
                    <Grid container>
                        <Grid item xs={12} container justifyContent="flex-start"
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
                    </Grid>

                    
                    <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
                        {governanceLookup.map((item: any,key:number) => (
                            <Grid item xs={12} sm={6} key={key}>
                                <GovernanceCardView 
                                    item={item}
                                />
                            </Grid>
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