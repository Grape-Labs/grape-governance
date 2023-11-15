
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import axios from 'axios';
import moment from 'moment';

import {
  Typography,
  Tooltip,
  IconButton,
  Button,
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  ButtonGroup,
  Fade,
  CircularProgress,
} from '@mui/material/';

import ExplorerView from '../utils/grapeTools/Explorer';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

import { 
    SHYFT_KEY
} from '../utils/grapeTools/constants';

import { 
    findObjectByGoverningTokenOwner
  } from '../utils/grapeTools/helpers';

const BlinkingDotContainer = styled("div")({
    width: 10,
    height: 10,
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

export default function GovernanceRealtimeInfo(props: any){
    const address = props.governanceAddress;
    const title = props.title;
    const expanded = props?.expanded || false;
    const [showLive, setShowLive] = React.useState(expanded);
    const [realtimeEventsLoaded, setRealtimeEventsLoaded] = React.useState(false);
    const [loadingRealtimeEvents, setLoadingRealtimeEvents] = React.useState(false);
    const [realtimeEvents, setRealtimeEvents] = React.useState(null);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [fadeIn, setFadeIn] = React.useState(true);
    const [carouselData, setCarousel] = React.useState(null);
    const fadeTime = 1000;
    
    const [openInstructions, setOpenInstructions] = React.useState(expanded);

    const handleClickOpenInstructions = () => {
        setOpenInstructions(!openInstructions);
    }

    function fetchRealtimeEvents(){

        const uri = `https://api.shyft.to/sol/v1/transaction/history?network=mainnet-beta&account=${address}&enable_raw=true`;

        axios.get(uri, {
        headers: {
            'x-api-key': SHYFT_KEY
        }
        })
        .then(response => {
            if (response.data?.result)
                setRealtimeEvents(response.data.result); // Update the realtimeEvents state with the response data
            //console.log(response.data); // Log the response data to the console
        })
        .catch(error => console.error(error));

        setRealtimeEventsLoaded(false);
    }

    const EventItem = ({ event }) => {
        
        return (
          <>
            <Fade
                in={fadeIn}
                timeout={{
                enter: fadeTime*2,
                exit: fadeTime*2,
                }}
            >
                <div>
                    <Grid sx={{color:'gray'}}>
                        {(event.actions[0].type && event.actions[0].type !== 'UNKNOWN') ?
                            <Grid>
                                <Typography variant="h6">{event.actions[0].type.replace(/_/g, ' ')}</Typography>  
                            </Grid>
                            :
                            <> 
                                {(event.actions[0]?.source_protocol?.address && 
                                    (event.actions[0].source_protocol?.address === "VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS")) &&
                                    <>Marinade VSR Interaction</>
                                } 
                                {(event.actions[0]?.source_protocol?.address && 
                                    (event.actions[0].source_protocol?.address === "GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J") ||
                                    event.actions[0].source_protocol?.address === "4Q6WW2ouZ6V3iaNm56MTd5n2tnTm4C5fiH8miFHnAFHo") &&
                                    <>Mango VSR Interaction</>
                                } 
                            </>
                        }
                        {(event.actions[0].info?.proposal_name) &&
                            <Grid>
                                <Typography variant="subtitle1">Name: {event.actions[0].info?.proposal_name}</Typography>  
                            </Grid>
                        }
                        {(event.actions[0].info?.proposal) &&
                            <Grid>
                                <Typography variant="subtitle1">Proposal: 
                                    <ExplorerView
                                        address={event.actions[0].info.proposal} type='address'
                                        shorten={8}
                                        hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='10px'/>
                                </Typography>  
                            </Grid>
                        }
                        {(event.actions[0].info?.vote_governing_token) &&
                            <Grid>
                                <Typography variant="body2">Token:
                                    <ExplorerView
                                        address={event.actions[0].info?.vote_governing_token} type='address'
                                        shorten={8}
                                        hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                </Typography>  
                            </Grid>
                        }
                        {(event.actions[0].info?.vote_type) &&
                            <Grid>
                                <Typography variant="body2">Vote: {event.actions[0].info?.vote_type}</Typography>  
                            </Grid>
                        }

                        {(event.actions.length > 1 && event.actions[1].info?.amount) &&
                            <Grid>
                                <Typography variant="body2">Amount: {event.actions[1].info.amount.toLocaleString()}</Typography>  
                            </Grid>
                        }
                        <Grid>
                            {(event.actions.length > 1 && event.actions[1].info?.sender) &&
                                <Grid item>
                                    <Typography variant="caption">From: 
                                        <ExplorerView
                                            address={event.actions[1].info.sender} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                    </Typography>  
                                </Grid>
                            }
                            {(event.actions.length > 1 && event.actions[1].info?.receiver) &&
                                <Grid item>
                                    <Typography variant="caption">To: 
                                        <ExplorerView
                                            address={event.actions[1].info.receiver} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                    </Typography>  
                                </Grid>
                            }
                            {(event.actions.length > 1 && event.actions[1].info?.token) &&
                                <Grid item>
                                    <Typography variant="caption">Token: 
                                        <ExplorerView
                                            address={event.actions[1].info.token} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                    </Typography>  
                                </Grid>
                            }
                            {(event.fee_payer) &&
                                <Grid item>
                                    <Typography variant="caption">Fee Payer: 
                                        <ExplorerView
                                            address={event.fee_payer} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                    </Typography>  
                                </Grid>
                            }
                        </Grid>

                        {/*
                        <Grid>
                            <Typography variant="caption">log: {JSON.stringify(event.actions)}</Typography>
                        </Grid>
                        */}
                        <Grid>
                            <Typography variant="caption" sx={{color:'#999'}}>
                                {moment(event.timestamp).fromNow()}
                            </Typography>
                        </Grid>

                    </Grid>
                </div>
            </Fade>
          </>
        );
      };


    
    let animationIndex = 1;
    React.useEffect(() => {
        if (showLive){
            if (realtimeEvents && realtimeEvents.length > 0) {
                const animationInterval = setInterval(() => {
                // Move this line inside the setTimeout callback
                // setFadeIn(false);
            
                //  setTimeout(() => {
                    setRealtimeEventsLoaded(true);
                    setFadeIn(false); // Move this line here
            
                    if (animationIndex < realtimeEvents.length) {
                    setCurrentIndex(animationIndex);
                    setFadeIn(true);
            
                    animationIndex++;
                    } else {
                    animationIndex = 0;
                    }
                //  }, 2000);
                }, 4000);
            
                //return () => clearInterval(animationInterval);
                if (animationIndex === realtimeEvents.length - 1) {
                    clearInterval(animationInterval);
                }
            }
        }
      }, [realtimeEvents, showLive]);
    

    function toggleLive(){
        setShowLive(!showLive);
        if (showLive)
            setCurrentIndex(0);
    }

    React.useEffect(() => {
        if (!realtimeEventsLoaded){
            setLoadingRealtimeEvents(true);
            fetchRealtimeEvents();
            setLoadingRealtimeEvents(false);
        }
    }, []);

    return(
        <Grid xs={12}>
            
            <Box
                sx={{ 
                    mb: 1, 
                    width: '100%',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '17px'
                }}
            > 
                
                <ListItemButton 
                    onClick={handleClickOpenInstructions}
                    sx={{
                        backgroundColor:'rgba(0,0,0,0.2)',
                        borderRadius:'17px',
                        borderBottomLeftRadius: openInstructions ? '0' : '17px',
                        borderBottomRightRadius: openInstructions ? '0' : '17px', 
                    }}
                >
                    <ListItemIcon>
                        <BlinkingDot />
                    </ListItemIcon>
                    <ListItemText primary={<>
                        {title ?
                            <>{title}</>
                        :
                            <>Live</>
                        }
                        </>
                    } />
                        {openInstructions ? <ExpandLess /> : <ExpandMoreIcon />}
                </ListItemButton>
                <Collapse in={openInstructions} timeout="auto" unmountOnExit
                    sx={{
                        borderBottomLeftRadius: openInstructions ? '17px' : '0',
                        borderBottomRightRadius: openInstructions ? '17px' : '0', 
                        backgroundColor:'rgba(0,0,0,0.1)'}}
                >
                    {loadingRealtimeEvents ?
                        <><CircularProgress color='inherit' /></>
                    :
                        <Box sx={{p:2}}>
                            {(realtimeEvents && realtimeEvents.length > 0) &&
                            <>
                                <EventItem event={realtimeEvents[currentIndex]} />
                            </>
                            }
                        </Box>   
                    }
                    </Collapse>
            </Box>
            
        </Grid>
    );
}