
import React, { useCallback } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import axios from 'axios';
import moment from 'moment';
import { Connection, PublicKey } from '@solana/web3.js';
import { getProposal, getRealm, getTokenOwnerRecord } from '@solana/spl-governance';
import { getMint } from '@solana/spl-token';

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
  Chip,
} from '@mui/material/';

import ExplorerView from '../utils/grapeTools/Explorer';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';

import { 
    SHYFT_KEY,
    RPC_CONNECTION
} from '../utils/grapeTools/constants';

const REALTIME_MAINNET_CONNECTION = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const REALTIME_SEEN_STORAGE_PREFIX = 'governance-realtime-last-seen:';

type ProposalInsight = {
    author: string;
    proposalTypeLabel: 'Community' | 'Council';
    votingPower: number;
    votingPowerLabel: string;
};

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

function toBase58Safe(value: any): string {
    try {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (value?.toBase58) return value.toBase58();
        return String(value);
    } catch {
        return '';
    }
}

function parseRawVoteWeight(raw: any): bigint {
    try {
        if (raw === null || raw === undefined) return 0n;
        if (typeof raw === 'bigint') return raw;
        if (typeof raw === 'number') return Number.isFinite(raw) ? BigInt(Math.trunc(raw)) : 0n;
        if (typeof raw === 'string') {
            const value = raw.trim();
            if (!value) return 0n;
            if (value.startsWith('0x') || value.startsWith('0X')) return BigInt(value);
            if (/^-?\d+$/.test(value)) return BigInt(value);
            const parsed = Number(value);
            return Number.isFinite(parsed) ? BigInt(Math.trunc(parsed)) : 0n;
        }
        return BigInt(raw?.toString?.() || 0);
    } catch {
        return 0n;
    }
}

function voteWeightToUi(raw: any, decimals = 0): number {
    const d = Math.max(0, Number(decimals || 0));
    const value = parseRawVoteWeight(raw);
    if (d === 0) return Number(value);
    const base = 10n ** BigInt(d);
    const whole = value / base;
    const frac = value % base;
    return Number(whole) + Number(frac) / Math.pow(10, d);
}

function formatCompactNumber(value: any): string {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0';
    const compact = new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 2,
    }).format(numeric);
    return compact.replace(/K/g, 'k').replace(/M/g, 'm').replace(/B/g, 'b').replace(/T/g, 't');
}

function getTokenMapDecimals(tokenMap: any, mintAddress: string): number | null {
    if (!tokenMap || !mintAddress) return null;
    const fromMap = typeof tokenMap?.get === 'function' ? tokenMap.get(mintAddress) : tokenMap?.[mintAddress];
    const decimals = fromMap?.decimals;
    return Number.isFinite(Number(decimals)) ? Number(decimals) : null;
}

function formatActionLabel(actionType: any): string {
    const rawType = String(actionType || '').trim();
    if (!rawType || rawType === 'UNKNOWN') return '';
    return rawType
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function buildActionSummary(actions: any[]): { count: number; label: string } | null {
    if (!Array.isArray(actions) || actions.length === 0) return null;

    const counts = new Map<string, number>();
    const orderedLabels: string[] = [];
    for (const action of actions) {
        const label = formatActionLabel(action?.type) || 'Unknown';
        if (!counts.has(label)) orderedLabels.push(label);
        counts.set(label, (counts.get(label) || 0) + 1);
    }

    const parts = orderedLabels.map((label) => {
        const count = counts.get(label) || 0;
        return count > 1 ? `${label} x${count}` : label;
    });

    const preview = parts.slice(0, 2).join(' • ');
    const remaining = parts.length - 2;
    const suffix = remaining > 0 ? ` +${remaining} more` : '';

    return {
        count: actions.length,
        label: `${actions.length} action${actions.length === 1 ? '' : 's'}: ${preview}${suffix}`,
    };
}

function getEventTimestampMs(event: any): number {
    const ts = event?.timestamp;
    if (!ts) return 0;
    const parsed = moment(ts);
    return parsed.isValid() ? parsed.valueOf() : 0;
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
    const [proposalInsights, setProposalInsights] = React.useState<Record<string, ProposalInsight>>({});
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [fadeIn, setFadeIn] = React.useState(true);
    const [carouselData, setCarousel] = React.useState(null);
    const [lastSeenTimestamp, setLastSeenTimestamp] = React.useState(0);
    const fadeTime = 1000;
    
    const [openInstructions, setOpenInstructions] = React.useState(expanded);
    const proposalAuthorInFlight = React.useRef<Set<string>>(new Set());
    const latestAcknowledgedTimestampRef = React.useRef(0);
    const mintDecimalsCacheRef = React.useRef<Record<string, number>>({});
    const seenStorageKey = React.useMemo(
        () => `${REALTIME_SEEN_STORAGE_PREFIX}${String(address || 'unknown')}`,
        [address]
    );
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
    const newEventCount = React.useMemo(
        () => lastSeenTimestamp > 0
            ? realtimeEvents.filter((event) => getEventTimestampMs(event) > lastSeenTimestamp).length
            : 0,
        [lastSeenTimestamp, realtimeEvents]
    );

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

    const resolveProposalInsight = React.useCallback(async (proposalAddress: string, _realmAddress?: string) => {
        if (!proposalAddress || proposalInsights[proposalAddress] || proposalAuthorInFlight.current.has(proposalAddress)) {
            return;
        }

        proposalAuthorInFlight.current.add(proposalAddress);

        try {
            const resolveFromConnection = async (connection: Connection): Promise<ProposalInsight | null> => {
                const proposal = await getProposal(connection as any, new PublicKey(proposalAddress));
                const tokenOwnerRecordPk =
                    proposal?.account?.tokenOwnerRecord?.toBase58?.() || proposal?.account?.tokenOwnerRecord;
                if (!tokenOwnerRecordPk) return null;

                const tokenOwnerRecord = await getTokenOwnerRecord(connection as any, new PublicKey(tokenOwnerRecordPk));
                const author = tokenOwnerRecord?.account?.governingTokenOwner?.toBase58?.() || '';
                if (!author) return null;

                const proposalMint = toBase58Safe(proposal?.account?.governingTokenMint);
                const proposalRealm = toBase58Safe(proposal?.account?.realm) || _realmAddress || '';
                let proposalTypeLabel: 'Community' | 'Council' = 'Community';
                let decimals = getTokenMapDecimals(tokenMap, proposalMint) ?? mintDecimalsCacheRef.current[proposalMint];

                if (proposalRealm) {
                    try {
                        const realm = await getRealm(connection as any, new PublicKey(proposalRealm));
                        const councilMint = toBase58Safe(realm?.account?.config?.councilMint);
                        if (councilMint && proposalMint === councilMint) {
                            proposalTypeLabel = 'Council';
                            decimals = 0;
                        }
                    } catch {
                        // Continue with defaults if realm lookup fails.
                    }
                }

                if (proposalTypeLabel === 'Community' && proposalMint && (decimals === null || decimals === undefined)) {
                    try {
                        const mintInfo = await getMint(connection as any, new PublicKey(proposalMint));
                        decimals = mintInfo?.decimals ?? 0;
                        mintDecimalsCacheRef.current[proposalMint] = decimals;
                    } catch {
                        decimals = 0;
                    }
                }

                const votingPower = voteWeightToUi(tokenOwnerRecord?.account?.governingTokenDepositAmount || 0, decimals || 0);
                const votingPowerLabel =
                    proposalTypeLabel === 'Council'
                        ? `${formatCompactNumber(votingPower)} council`
                        : `${formatCompactNumber(votingPower)} votes`;

                return {
                    author,
                    proposalTypeLabel,
                    votingPower,
                    votingPowerLabel,
                };
            };

            let insight: ProposalInsight | null = null;
            try {
                insight = await resolveFromConnection(RPC_CONNECTION as any);
            } catch {
                insight = null;
            }

            if (!insight) {
                try {
                    insight = await resolveFromConnection(REALTIME_MAINNET_CONNECTION);
                } catch {
                    insight = null;
                }
            }

            if (insight?.author) {
                setProposalInsights((current) => {
                    if (
                        current[proposalAddress]?.author === insight?.author &&
                        current[proposalAddress]?.proposalTypeLabel === insight?.proposalTypeLabel &&
                        current[proposalAddress]?.votingPower === insight?.votingPower
                    ) {
                        return current;
                    }
                    return {
                        ...current,
                        [proposalAddress]: insight as ProposalInsight,
                    };
                });
            }
        } catch (error) {
            // Keep UI responsive; author field is an optional enrichment.
            console.log('Could not resolve proposal insight', error);
        } finally {
            proposalAuthorInFlight.current.delete(proposalAddress);
        }
    }, [proposalInsights, tokenMap]);

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
        const proposalInsight = proposalAddress ? proposalInsights[proposalAddress] || null : null;
        const resolvedAuthor = proposalInsight?.author || '';
        const isProposalEvent = Boolean(proposalAddress || firstInfo?.proposal_name);
        const proposalAuthorAddress = resolvedAuthor || (isProposalEvent ? context.directCreator : '');
        const proposalTypeLabel = proposalInsight?.proposalTypeLabel || '';
        const votingPowerLabel = proposalInsight?.votingPowerLabel || '';
        const actorAddress = !isProposalEvent ? context.directCreator : '';
        const authorResolutionPending = Boolean(
            isProposalEvent &&
            proposalAddress &&
            !proposalAuthorAddress &&
            proposalAuthorInFlight.current.has(proposalAddress)
        );
        const actionSummary = buildActionSummary(event.actions);
        const isNewEvent = lastSeenTimestamp > 0 && getEventTimestampMs(event) > lastSeenTimestamp;

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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.35 }}>
                        <Typography variant="subtitle1">{actionLabel}</Typography>
                        {proposalTypeLabel && (
                            <Chip
                                size="small"
                                label={`${proposalTypeLabel} Proposal`}
                                sx={{
                                    height: 20,
                                    bgcolor: proposalTypeLabel === 'Council' ? 'rgba(255,179,71,0.18)' : 'rgba(88,166,255,0.16)',
                                    color: proposalTypeLabel === 'Council' ? '#ffd18a' : '#9ac7ff',
                                }}
                            />
                        )}
                        {isNewEvent && (
                            <Chip
                                size="small"
                                label="New"
                                color="error"
                                sx={{ height: 20 }}
                            />
                        )}
                    </Box>
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
                    {proposalAuthorAddress && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Proposal Author: {shortenAddress(proposalAuthorAddress)}{votingPowerLabel ? ` • ${votingPowerLabel}` : ''}
                        </Typography>
                    )}
                    {authorResolutionPending && (
                        <Typography variant="caption" sx={{ display: 'block', opacity: 0.75 }}>
                            Proposal Author: resolving...
                        </Typography>
                    )}
                    {actorAddress && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Actor: {shortenAddress(actorAddress)}
                        </Typography>
                    )}
                    {actionSummary && (
                        <Typography variant="caption" sx={{ display: 'block' }}>
                            Summary: {actionSummary.label}
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
                            {(firstAction.type && firstAction.type !== 'UNKNOWN') ?
                                <Typography variant="h6">{capitalizeFirstLetter(firstAction.type.replace(/_/g, ' '))}</Typography>
                                :
                                <Typography variant="h6">
                                    {(sourceProtocolAddress && 
                                        (sourceProtocolAddress === "VoteMBhDCqGLRgYpp9o7DGyq81KNmwjXQRAHStjtJsS")) ?
                                        'Marinade VSR Interaction'
                                        :
                                        ((sourceProtocolAddress && 
                                            ((sourceProtocolAddress === "GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J") ||
                                            sourceProtocolAddress === "4Q6WW2ouZ6V3iaNm56MTd5n2tnTm4C5fiH8miFHnAFHo")) ?
                                            'Mango VSR Interaction'
                                            :
                                            'Governance Event'
                                        )
                                    }
                                </Typography>
                            }
                            {proposalTypeLabel && (
                                <Chip
                                    size="small"
                                    label={`${proposalTypeLabel} Proposal`}
                                    sx={{
                                        height: 22,
                                        bgcolor: proposalTypeLabel === 'Council' ? 'rgba(255,179,71,0.18)' : 'rgba(88,166,255,0.16)',
                                        color: proposalTypeLabel === 'Council' ? '#ffd18a' : '#9ac7ff',
                                    }}
                                />
                            )}
                            {isNewEvent && <Chip size="small" label="New" color="error" sx={{ height: 22 }} />}
                        </Box>
                        
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
                        {proposalAuthorAddress &&
                            <Grid>
                                <Typography variant="body2">Proposal Author: 
                                    <ExplorerView
                                        address={proposalAuthorAddress}
                                        type='address'
                                        shorten={8}
                                        hideTitle={false}
                                        hideIcon={true}
                                        style='text'
                                        color='inherit'
                                        fontSize='10px'
                                    />
                                    {votingPowerLabel ? ` • ${votingPowerLabel}` : ''}
                                </Typography>  
                            </Grid>
                        }
                        {authorResolutionPending &&
                            <Grid>
                                <Typography variant="body2">Proposal Author: resolving...</Typography>
                            </Grid>
                        }
                        {actorAddress &&
                            <Grid>
                                <Typography variant="body2">Actor: 
                                    <ExplorerView
                                        address={actorAddress}
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
                        {actionSummary &&
                            <Grid>
                                <Typography variant="body2">Summary: {actionSummary.label}</Typography>
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
        setProposalInsights({});
        void fetchRealtimeEvents();
    }, [address, fetchRealtimeEvents]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = window.localStorage.getItem(seenStorageKey);
        const parsed = stored ? Number(stored) : 0;
        setLastSeenTimestamp(Number.isFinite(parsed) ? parsed : 0);
    }, [seenStorageKey]);

    React.useEffect(() => {
        if (!Array.isArray(realtimeEvents) || realtimeEvents.length === 0) return;

        const candidates = new Map<string, string | undefined>();
        for (const event of realtimeEvents) {
            const context = extractProposalContext(event);
            const proposalAddress = context.proposalAddress;
            if (!proposalAddress) continue;
            if (proposalInsights[proposalAddress]) continue;
            const realmAddress = context.realmAddress;
            candidates.set(proposalAddress, realmAddress || undefined);
        }

        if (candidates.size === 0) return;

        for (const [proposalAddress, realmAddress] of candidates.entries()) {
            void resolveProposalInsight(proposalAddress, realmAddress);
        }
    }, [proposalInsights, realtimeEvents, resolveProposalInsight]);

    const selectedEvent = React.useMemo(() => {
        if (!Array.isArray(realtimeEvents) || realtimeEvents.length === 0) return null;
        return realtimeEvents[currentIndex] || realtimeEvents[0];
    }, [currentIndex, realtimeEvents]);

    React.useEffect(() => {
        if (!selectedEvent) return;
        const context = extractProposalContext(selectedEvent);
        if (!context.proposalAddress) return;
        if (proposalInsights[context.proposalAddress]) return;
        void resolveProposalInsight(context.proposalAddress, context.realmAddress || undefined);
    }, [proposalInsights, resolveProposalInsight, selectedEvent]);

    React.useEffect(() => {
        if (!openInstructions || !Array.isArray(realtimeEvents) || realtimeEvents.length === 0) return;
        if (typeof window === 'undefined') return;
        const latestTimestamp = realtimeEvents.reduce((max, event) => {
            const ts = getEventTimestampMs(event);
            return ts > max ? ts : max;
        }, 0);
        if (!latestTimestamp || latestTimestamp <= latestAcknowledgedTimestampRef.current) return;
        latestAcknowledgedTimestampRef.current = latestTimestamp;
        window.localStorage.setItem(seenStorageKey, String(latestTimestamp));
    }, [openInstructions, realtimeEvents, seenStorageKey]);

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
                    <ListItemText primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <span>{title ? title : 'Live'}</span>
                            {newEventCount > 0 && (
                                <Chip
                                    size="small"
                                    label={`${newEventCount} new`}
                                    color="error"
                                    sx={{ height: 20 }}
                                />
                            )}
                        </Box>
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
