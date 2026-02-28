
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import axios from 'axios';
import moment from 'moment';
import { Connection, PublicKey } from '@solana/web3.js';
import { getProposal, getTokenOwnerRecord } from '@solana/spl-governance';

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

import { 
    SHYFT_KEY,
    RPC_CONNECTION
} from '../utils/grapeTools/constants';

const REALTIME_MAINNET_CONNECTION = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

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

function shortenAddress(value: any, left = 6, right = 4): string {
    const text = String(value || '');
    if (!text) return '';
    if (text.length <= left + right + 3) return text;
    return `${text.slice(0, left)}...${text.slice(-right)}`;
}

function firstNonEmptyString(candidates: any[]): string {
    for (const value of candidates) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }
    return '';
}

function extractProposalContext(event: any): { proposalAddress: string; realmAddress: string; directCreator: string } {
    const actions = Array.isArray(event?.actions) ? event.actions : [];
    let proposalAddress = '';
    let realmAddress = '';
    let directCreator = '';

    for (const action of actions) {
        const info = action?.info || {};

        if (!proposalAddress) {
            proposalAddress = firstNonEmptyString([
                info?.proposal,
                info?.proposal_address,
                info?.proposalAddress,
            ]);
        }

        if (!realmAddress) {
            realmAddress = firstNonEmptyString([
                info?.realm_address,
                info?.realm,
                info?.realmAddress,
            ]);
        }

        if (!directCreator) {
            directCreator = firstNonEmptyString([
                info?.proposal_authority,
                info?.proposal_creator,
                info?.proposalOwner,
                info?.governing_token_owner,
                info?.governingTokenOwner,
                info?.token_owner,
                info?.creator,
                info?.owner,
            ]);
        }
    }

    return { proposalAddress, realmAddress, directCreator };
}

export default function GovernanceRealtimeInfo(props: any){
    const governanceLookup = props?.governanceLookup;
    const address = props.governanceAddress;
    const title = props.title;
    const expanded = props?.expanded || false;
    const compact = props?.compact === true;
    const tokenMap = props?.tokenMap;
    const [showLive, setShowLive] = React.useState(expanded);
    const [realtimeEventsLoaded, setRealtimeEventsLoaded] = React.useState(false);
    const [loadingRealtimeEvents, setLoadingRealtimeEvents] = React.useState(false);
    const [realtimeEvents, setRealtimeEvents] = React.useState<any[]>([]);
    const [proposalAuthors, setProposalAuthors] = React.useState<Record<string, string>>({});
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [fadeIn, setFadeIn] = React.useState(true);
    const [carouselData, setCarousel] = React.useState(null);
    const fadeTime = 1000;
    
    const [openInstructions, setOpenInstructions] = React.useState(expanded);
    const proposalAuthorInFlight = React.useRef<Set<string>>(new Set());
    const realmNameByAddress = React.useMemo(() => {
        const map = new Map<string, string>();
        if (!Array.isArray(governanceLookup)) return map;
        for (const item of governanceLookup) {
            const key = String(item?.governanceAddress || '');
            if (!key) continue;
            const value = String(item?.governanceName || '');
            if (!value) continue;
            map.set(key, value);
        }
        return map;
    }, [governanceLookup]);

    const handleClickOpenInstructions = () => {
        const nextOpenState = !openInstructions;
        setOpenInstructions(nextOpenState);
        setShowLive(nextOpenState);
    }

    const fetchRealtimeEvents = React.useCallback(async () => {
        if (!address || !SHYFT_KEY) {
            setRealtimeEvents([]);
            setRealtimeEventsLoaded(true);
            return;
        }

        const uri = `https://api.shyft.to/sol/v1/transaction/history?network=mainnet-beta&account=${address}&tx_num=20`;
        setLoadingRealtimeEvents(true);
        try {
            const response = await axios.get(uri, {
                headers: {
                    'x-api-key': SHYFT_KEY
                },
                timeout: 12000,
            });
            const events = Array.isArray(response?.data?.result) ? response.data.result : [];
            setRealtimeEvents(events);
        } catch (error) {
            console.error('Failed to fetch realtime governance events', error);
            setRealtimeEvents([]);
        } finally {
            setLoadingRealtimeEvents(false);
            setRealtimeEventsLoaded(true);
        }
    }, [address]);

    const resolveProposalAuthor = React.useCallback(async (proposalAddress: string, _realmAddress?: string) => {
        if (!proposalAddress || proposalAuthors[proposalAddress] || proposalAuthorInFlight.current.has(proposalAddress)) {
            return;
        }

        proposalAuthorInFlight.current.add(proposalAddress);

        try {
            const resolveFromConnection = async (connection: Connection): Promise<string> => {
                const proposal = await getProposal(connection as any, new PublicKey(proposalAddress));
                const tokenOwnerRecordPk =
                    proposal?.account?.tokenOwnerRecord?.toBase58?.() || proposal?.account?.tokenOwnerRecord;
                if (!tokenOwnerRecordPk) return '';

                const tokenOwnerRecord = await getTokenOwnerRecord(connection as any, new PublicKey(tokenOwnerRecordPk));
                return tokenOwnerRecord?.account?.governingTokenOwner?.toBase58?.() || '';
            };

            let governingTokenOwner = '';
            try {
                governingTokenOwner = await resolveFromConnection(RPC_CONNECTION as any);
            } catch {
                governingTokenOwner = '';
            }

            if (!governingTokenOwner) {
                try {
                    governingTokenOwner = await resolveFromConnection(REALTIME_MAINNET_CONNECTION);
                } catch {
                    governingTokenOwner = '';
                }
            }

            if (governingTokenOwner) {
                setProposalAuthors((current) => {
                    if (current[proposalAddress] === governingTokenOwner) return current;
                    return {
                        ...current,
                        [proposalAddress]: governingTokenOwner,
                    };
                });
            }
        } catch (error) {
            // Keep UI responsive; author field is an optional enrichment.
            console.log('Could not resolve proposal author', error);
        } finally {
            proposalAuthorInFlight.current.delete(proposalAddress);
        }
    }, [proposalAuthors]);

    function capitalizeFirstLetter(sentence:string) {
        let newsSentence = sentence.toLowerCase();
        //return newsSentence.charAt(0).toUpperCase() + newsSentence.slice(1);
        return newsSentence
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    const EventItem = ({ event, compactMode = false }) => {
        if (!event?.actions || event.actions.length === 0) {
            return (
                <Typography variant="caption" sx={{color:'#999'}}>
                    Unknown governance event payload
                </Typography>
            );
        }
        const firstAction = event.actions[0] || {};
        const secondAction = event.actions[1] || {};
        const firstInfo = firstAction.info || {};
        const secondInfo = secondAction.info || {};
        const sourceProtocolAddress = firstAction?.source_protocol?.address;
        const context = extractProposalContext(event);
        const realmAddress = context.realmAddress || firstInfo?.realm_address || '';
        const realmName = realmAddress ? realmNameByAddress.get(realmAddress) : '';
        const proposalAddress = context.proposalAddress || String(firstInfo?.proposal || '');
        const resolvedAuthor = proposalAddress ? proposalAuthors[proposalAddress] || '' : '';
        const creatorAddress = context.directCreator || resolvedAuthor;

        let displayedAmount: any = null;
        for (const action of event.actions) {
            if (action?.info?.amount !== undefined && action?.info?.amount !== null) {
                displayedAmount = action.info.amount;
                break;
            }
        }

        if (compactMode) {
            const actionLabel =
                firstAction.type && firstAction.type !== 'UNKNOWN'
                    ? capitalizeFirstLetter(String(firstAction.type).replace(/_/g, ' '))
                    : 'Governance Event';

            return (
                <Grid sx={{ color: 'gray' }}>
                    <Typography variant="subtitle1">{actionLabel}</Typography>
                    {realmName && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            DAO: {realmName}
                        </Typography>
                    )}
                    {firstInfo?.proposal_name && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Proposal: {firstInfo.proposal_name}
                        </Typography>
                    )}
                    {firstInfo?.proposal && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Proposal ID: {shortenAddress(firstInfo.proposal)}
                        </Typography>
                    )}
                    {creatorAddress && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Creator: {shortenAddress(creatorAddress)}
                        </Typography>
                    )}
                    {(displayedAmount !== null && displayedAmount !== undefined) && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Amount: {displayedAmount?.toLocaleString?.() || displayedAmount}
                        </Typography>
                    )}
                    <Typography variant="caption" sx={{color:'#999', display:'block', mt:0.5}}>
                        {moment(event.timestamp).fromNow()}
                    </Typography>
                </Grid>
            );
        }
        
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
                        {(firstAction.type && firstAction.type !== 'UNKNOWN') ?
                            <Grid>
                                <Typography variant="h6">{capitalizeFirstLetter(firstAction.type.replace(/_/g, ' '))}</Typography>  
                            </Grid>
                            :
                            <> 
                                {(sourceProtocolAddress && 
                                    (sourceProtocolAddress === "VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS")) &&
                                    <>Marinade VSR Interaction</>
                                } 
                                {(sourceProtocolAddress && 
                                    (sourceProtocolAddress === "GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J") ||
                                    sourceProtocolAddress === "4Q6WW2ouZ6V3iaNm56MTd5n2tnTm4C5fiH8miFHnAFHo") &&
                                    <>Mango VSR Interaction</>
                                } 
                            </>
                        }
                        
                        {(realmName && realmAddress) &&
                            <Grid>
                                <Typography variant="subtitle1" key={realmAddress}>
                                    {realmName}
                                </Typography>
                                {/*
                                <Typography variant="body2">DAO:
                                    <ExplorerView
                                        address={event.actions[0].info?.realm_address} type='address'
                                        shorten={8}
                                        hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                </Typography>  
                                */}
                            </Grid>
                        }

                        {(firstInfo?.proposal_name) &&
                            <Grid>
                                <Typography variant="subtitle1">Name: {firstInfo?.proposal_name}</Typography>  
                            </Grid>
                        }
                        {(firstInfo?.proposal) &&
                            <Grid>
                                <Typography variant="subtitle1">Proposal: 
                                    <ExplorerView
                                        address={firstInfo.proposal} type='address'
                                        shorten={8}
                                        hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='10px'/>
                                </Typography>  
                            </Grid>
                        }
                        {creatorAddress &&
                            <Grid>
                                <Typography variant="body2">Creator: 
                                    <ExplorerView
                                        address={creatorAddress}
                                        type='address'
                                        shorten={8}
                                        hideTitle={false}
                                        hideIcon={true}
                                        style='text'
                                        color='inherit'
                                        fontSize='10px'
                                    />
                                </Typography>  
                            </Grid>
                        }

                        {(firstInfo?.vote_governing_token) &&
                            <Grid>
                                <Typography variant="body2">Token:
                                    <ExplorerView
                                        address={firstInfo?.vote_governing_token} type='address'
                                        shorten={8}
                                        hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='12px'
                                        tokenMap={tokenMap}
                                        showTokenMetadata={true}/>
                                </Typography>  
                            </Grid>
                        }
                        {(firstInfo?.vote_type) &&
                            <Grid>
                                <Typography variant="body2">Vote: {firstInfo?.vote_type}</Typography>  
                            </Grid>
                        }

                        {(displayedAmount !== null && displayedAmount !== undefined) &&
                            <Grid>
                                <Typography variant="body2">Amount: {displayedAmount?.toLocaleString?.() || displayedAmount}</Typography>
                            </Grid>
                        }

                        <Grid>
                            {(event.actions.length > 1 && secondInfo?.sender) &&
                                <Grid item>
                                    <Typography variant="caption">From: 
                                        <ExplorerView
                                            address={secondInfo.sender} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                    </Typography>  
                                </Grid>
                            }
                            {(event.actions.length > 1 && secondInfo?.receiver) &&
                                <Grid item>
                                    <Typography variant="caption">To: 
                                        <ExplorerView
                                            address={secondInfo.receiver} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit' fontSize='9px'/>
                                    </Typography>  
                                </Grid>
                            }
                            {(event.actions.length > 1 && secondInfo?.token) &&
                                <Grid item>
                                    <Typography variant="caption">Token: 
                                        <ExplorerView
                                            address={secondInfo.token} type='address'
                                            shorten={8}
                                            hideTitle={false} hideIcon={true} style='text' color='inherit'  fontSize='12px'
                                            tokenMap={tokenMap}
                                            showTokenMetadata={true}/>
                                    </Typography>  
                                </Grid>
                            }
                            {(firstInfo?.vote_record_address) &&
                                <Grid>
                                    <Typography variant="caption">Voter Record: {firstInfo.vote_record_address}</Typography>  
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


    
    const animationIndexRef = React.useRef(1);
    React.useEffect(() => {
        if (!openInstructions || !showLive || !Array.isArray(realtimeEvents) || realtimeEvents.length <= 1) {
            return;
        }

        animationIndexRef.current = 1;
        const animationInterval = window.setInterval(() => {
            setRealtimeEventsLoaded(true);
            setFadeIn(false);

            if (animationIndexRef.current < realtimeEvents.length) {
                setCurrentIndex(animationIndexRef.current);
                setFadeIn(true);
                animationIndexRef.current += 1;
            } else {
                animationIndexRef.current = 0;
            }
        }, 4000);

        return () => {
            window.clearInterval(animationInterval);
        };
      }, [openInstructions, realtimeEvents, showLive]);
    

    React.useEffect(() => {
        setRealtimeEventsLoaded(false);
        setCurrentIndex(0);
        setRealtimeEvents([]);
        setProposalAuthors({});
        void fetchRealtimeEvents();
    }, [address, fetchRealtimeEvents]);

    React.useEffect(() => {
        if (!Array.isArray(realtimeEvents) || realtimeEvents.length === 0) return;

        const candidates = new Map<string, string | undefined>();
        for (const event of realtimeEvents) {
            const context = extractProposalContext(event);
            const proposalAddress = context.proposalAddress;
            if (!proposalAddress) continue;
            if (proposalAuthors[proposalAddress]) continue;
            const realmAddress = context.realmAddress;
            candidates.set(proposalAddress, realmAddress || undefined);
        }

        if (candidates.size === 0) return;

        for (const [proposalAddress, realmAddress] of candidates.entries()) {
            void resolveProposalAuthor(proposalAddress, realmAddress);
        }
    }, [proposalAuthors, realtimeEvents, resolveProposalAuthor]);

    const selectedEvent = React.useMemo(() => {
        if (!Array.isArray(realtimeEvents) || realtimeEvents.length === 0) return null;
        return realtimeEvents[currentIndex] || realtimeEvents[0];
    }, [currentIndex, realtimeEvents]);

    React.useEffect(() => {
        if (!selectedEvent) return;
        const context = extractProposalContext(selectedEvent);
        if (!context.proposalAddress) return;
        if (proposalAuthors[context.proposalAddress]) return;
        void resolveProposalAuthor(context.proposalAddress, context.realmAddress || undefined);
    }, [proposalAuthors, resolveProposalAuthor, selectedEvent]);

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
                        <Box sx={{p:2, display:'flex', justifyContent:'center'}}>
                            <CircularProgress color='inherit' size={22} />
                        </Box>
                    :
                        <Box sx={{p:2}}>
                            {selectedEvent ? (
                                <EventItem event={selectedEvent} compactMode={compact} />
                            ) : (
                                <Typography variant="caption" sx={{color:'#999'}}>
                                    No recent governance activity found for this address.
                                </Typography>
                            )}
                        </Box>   
                    }
                    </Collapse>
            </Box>
            
        </Grid>
    );
}
