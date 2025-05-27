// GovernanceStatsSummaryView.tsx
import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography, Tooltip, Button } from '@mui/material';
import { getFormattedNumberToLocale } from '../utils/grapeTools/helpers';
interface GovernanceStatsProps {
    activeParticipants: number;
    totalParticipants: number;
    votingParticipants: number;
    totalDepositedVotes: number;
    totalDepositedCouncilVotes?: number;
    governingTokenDecimals: number;
    circulatingSupply?: { value: { amount: number } };
    members: any[];
    quorumPercentage?: string | null;
    activeParticipationPercentage?: string | null;
    votingParticipationPercentage?: string | null;
    top10GovernanceShare?: string | null;
    councilVoteShare?: string | null;
    top10Participants?: {
        votes: number;
        percentageOfSupply: number;
        percentageOfGovernanceSupply: number;
    };
}

export function GovernanceStatsSummaryView(props: GovernanceStatsProps) {
    const {
        activeParticipants,
        totalParticipants,
        votingParticipants,
        totalDepositedVotes,
        totalDepositedCouncilVotes,
        governingTokenDecimals,
        circulatingSupply,
        members,
        quorumPercentage,
        activeParticipationPercentage,
        votingParticipationPercentage,
        top10GovernanceShare,
        councilVoteShare,
        top10Participants,
    } = props;

    const [averageVotesPerParticipant, setAverageVotesPerParticipant] = useState<string | null>(null);
    const [medianVotesFormatted, setMedianVotesFormatted] = useState<string | null>(null);
    const [delegationRate, setDelegationRate] = useState<string | null>(null);

    useEffect(() => {
        if (members?.length) {
            const deposits = members.map(m => Number(m.governingTokenDepositAmount)).sort((a, b) => a - b);

            const avg = activeParticipants
                ? (deposits.reduce((a, b) => a + b, 0) / activeParticipants / Math.pow(10, governingTokenDecimals))
                : null;

            const mid = Math.floor(deposits.length / 2);
            const median = deposits.length % 2 === 0
                ? (deposits[mid - 1] + deposits[mid]) / 2
                : deposits[mid];

            const delegatedCount = members.filter(p => !!p.governanceDelegate).length;
            const delRate = activeParticipants ? ((delegatedCount / activeParticipants) * 100) : null;

            setAverageVotesPerParticipant(avg?.toFixed(0) || null);
            setMedianVotesFormatted((median / Math.pow(10, governingTokenDecimals)).toFixed(0));
            setDelegationRate(delRate?.toFixed(1) || null);
        }
    }, [members]);

    return (
        <Box sx={{ p: 1 }}>
            <Grid container spacing={1}>
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Active / Participating / All Voters"
                        tooltip="Active = Deposited, Participating = Ever Voted, All = Total Voters"
                        value={`${activeParticipants}${votingParticipants ? `/${votingParticipants}` : ''}/${totalParticipants}`}
                    />
                </Grid>
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Average Votes / Active Voter"
                        tooltip="Average deposited community votes per active governance participant."
                        value={getFormattedNumberToLocale(+averageVotesPerParticipant) || '-'}
                    />
                </Grid>
                {medianVotesFormatted && +medianVotesFormatted > 0 &&
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Median Votes Deposited"
                        tooltip="50% of voters have deposited more or less than this amount."
                        value={medianVotesFormatted || '-'}
                    />
                </Grid>
                }
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Delegation Rate"
                        tooltip="% of active voters who delegated their vote."
                        value={delegationRate ? `${delegationRate}%` : '-'}
                    />
                </Grid>
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Total Votes Deposited"
                        tooltip="Total tokens staked into governance (and council if applicable)."
                        value={
                            totalDepositedVotes
                                ? `${getFormattedNumberToLocale((totalDepositedVotes / Math.pow(10, governingTokenDecimals)).toFixed(0))}${totalDepositedCouncilVotes ? ` / ${totalDepositedCouncilVotes}` : ''}`
                                : '-'
                        }
                    />
                </Grid>

                
                {top10Participants && (
                    <>
                        <Grid item xs={12} md={6} lg={3}>
                            <StatBox
                                title="Top 10 Deposited"
                                tooltip="Tokens held by the top 10 participants in this governance."
                                value={`${getFormattedNumberToLocale(+top10Participants.votes.toFixed(0))}`}
                            />
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <StatBox
                                title="Top 10 Percentage of Governance Weight"
                                tooltip="The voting power of the top 10 participants as a percentage of the total deposited governance."
                                value={`${top10Participants.percentageOfGovernanceSupply.toFixed(1)}%`}
                            />
                        </Grid>
                        <Grid item xs={12} md={6} lg={3}>
                            <StatBox
                                title="Top 10 Percentage of Supply"
                                tooltip="The voting power of the top 10 participants as a percentage of the total token supply."
                                value={`${top10Participants.percentageOfSupply.toFixed(1)}%`}
                            />
                        </Grid>
                    </>
                )}
                {circulatingSupply && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                            title="% Circulating Supply"
                            tooltip="% of the token supply currently deposited in governance."
                            value={
                                circulatingSupply.value.amount > 0 && totalDepositedVotes
                                    ? `${((totalDepositedVotes / circulatingSupply.value.amount) * 100).toFixed(1)}%`
                                    : '-'
                            }
                        />
                    </Grid>
                )}

                {quorumPercentage && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                            title="Quorum %"
                            tooltip="Percentage of circulating supply deposited in governance."
                            value={`${quorumPercentage}%`}
                        />
                    </Grid>
                )}

                {activeParticipationPercentage && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                            title="Active Participation %"
                            tooltip="Percentage of total members currently active (staked)."
                            value={`${activeParticipationPercentage}%`}
                        />
                    </Grid>
                )}

                {votingParticipationPercentage && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                            title="Voting Participation %"
                            tooltip="Percentage of members who have ever voted."
                            value={`${votingParticipationPercentage}%`}
                        />
                    </Grid>
                )}

                {top10GovernanceShare && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                            title="Top 10 Governance Share"
                            tooltip="% of governance voting power held by top 10 voters."
                            value={`${top10GovernanceShare}%`}
                        />
                    </Grid>
                )}

                {councilVoteShare && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                            title="Council Share %"
                            tooltip="Portion of deposited votes held by the council mint."
                            value={`${councilVoteShare}%`}
                        />
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}

function StatBox({ title, tooltip, value }: { title: string; tooltip: string; value: string }) {
    return (
        <Box
            sx={{
                borderRadius: '24px',
                p: 1,
                background: 'rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                height: '100%' // optional, ensures consistent height if used in a grid
            }}
        >
            <Typography variant="body2" sx={{ color: '#2ecc71', mb: 1 }}>
                {title}
            </Typography>
            <Tooltip title={tooltip}>
                <Button color='inherit' sx={{ borderRadius: '17px' }}>
                    <Typography variant="h4">{value}</Typography>
                </Button>
            </Tooltip>
        </Box>
    );
}