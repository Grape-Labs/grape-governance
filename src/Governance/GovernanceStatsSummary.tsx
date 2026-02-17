import React, { useEffect, useMemo, useState } from 'react';
import { Box, Grid, LinearProgress, Paper, Tooltip, Typography } from '@mui/material';
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
    mostParticipatedProposal?: {
        title: string;
        pubkey: string;
        totalVotes: number;
        state?: string;
    } | null;
    averageVotesPerProposal?: string | number | null;
    proposalParticipationStats?: {
        title: string;
        pubkey: string;
        totalVotes: number;
        state?: string;
    }[];
}

type StatCardProps = {
    title: string;
    value: string;
    tooltip: string;
    hint?: string;
    progress?: number | null;
    accent?: string;
};

const safeNumber = (value: any): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

const toPercent = (value: any): number | null => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(100, Math.max(0, parsed));
};

const fmt = (value: number | null | undefined, digits = 1): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return Number(value).toFixed(digits);
};

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <Box sx={{ mb: 1, mt: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.86rem', letterSpacing: 0.3, color: 'rgba(255,255,255,0.92)' }}>
            {title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.62)' }}>
            {subtitle}
        </Typography>
    </Box>
);

const StatCard = ({ title, value, tooltip, hint, progress, accent = '#8ec5ff' }: StatCardProps) => (
    <Tooltip title={tooltip}>
        <Paper
            elevation={0}
            sx={{
                p: 1.25,
                borderRadius: '16px',
                height: '100%',
                background: 'linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'help',
            }}
        >
            <Typography variant="caption" sx={{ color: accent, letterSpacing: 0.25, textTransform: 'uppercase' }}>
                {title}
            </Typography>
            <Typography
                sx={{
                    mt: 0.25,
                    fontSize: '1.42rem',
                    fontWeight: 700,
                    lineHeight: 1.2,
                    color: 'rgba(255,255,255,0.96)',
                    wordBreak: 'break-word',
                }}
            >
                {value}
            </Typography>
            {hint ? (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.45, color: 'rgba(255,255,255,0.66)' }}>
                    {hint}
                </Typography>
            ) : null}
            {typeof progress === 'number' ? (
                <Box sx={{ mt: 0.8 }}>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                            height: 6,
                            borderRadius: 99,
                            backgroundColor: 'rgba(255,255,255,0.14)',
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 99,
                                background: accent,
                            },
                        }}
                    />
                </Box>
            ) : null}
        </Paper>
    </Tooltip>
);

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
        activeParticipationPercentage,
        votingParticipationPercentage,
        top10GovernanceShare,
        councilVoteShare,
        top10Participants,
        mostParticipatedProposal,
        averageVotesPerProposal,
        proposalParticipationStats,
    } = props;

    const [averageVotesPerParticipant, setAverageVotesPerParticipant] = useState<string | null>(null);
    const [medianVotesFormatted, setMedianVotesFormatted] = useState<string | null>(null);
    const [delegationRate, setDelegationRate] = useState<string | null>(null);

    useEffect(() => {
        if (!members?.length) return;
        const deposits = members.map((m) => safeNumber(m.governingTokenDepositAmount)).sort((a, b) => a - b);
        const activeCount = safeNumber(activeParticipants);

        const avg = activeCount
            ? deposits.reduce((a, b) => a + b, 0) / activeCount / Math.pow(10, governingTokenDecimals || 0)
            : null;
        const mid = Math.floor(deposits.length / 2);
        const median = deposits.length % 2 === 0 ? (deposits[mid - 1] + deposits[mid]) / 2 : deposits[mid];

        const delegatedCount = members.filter((p) => !!p.governanceDelegate).length;
        const delRate = activeCount ? (delegatedCount / activeCount) * 100 : null;

        setAverageVotesPerParticipant(avg?.toFixed(1) || null);
        setMedianVotesFormatted((median / Math.pow(10, governingTokenDecimals || 0)).toFixed(1));
        setDelegationRate(delRate?.toFixed(1) || null);
    }, [members, activeParticipants, governingTokenDecimals]);

    const derived = useMemo(() => {
        const rows = proposalParticipationStats || [];
        const votes = rows.map((r) => safeNumber(r.totalVotes)).sort((a, b) => a - b);
        const totalProposals = rows.length;
        const proposalsWithVotes = votes.filter((v) => v > 0).length;
        const zeroVoteProposals = Math.max(totalProposals - proposalsWithVotes, 0);
        const totalVotes = votes.reduce((sum, value) => sum + value, 0);
        const medianVotes = votes.length
            ? (votes.length % 2 === 0
                ? (votes[(votes.length / 2) - 1] + votes[votes.length / 2]) / 2
                : votes[Math.floor(votes.length / 2)])
            : null;

        const normalize = (state?: string) => String(state || '').toLowerCase();
        const passed = rows.filter((r) => {
            const s = normalize(r.state);
            return s.includes('succeeded') || s.includes('completed') || s.includes('executing');
        }).length;
        const defeated = rows.filter((r) => normalize(r.state).includes('defeated')).length;
        const completed = rows.filter((r) => normalize(r.state).includes('completed')).length;
        const resolved = passed + defeated;

        const passRate = resolved > 0 ? (passed / resolved) * 100 : null;
        const completionRate = passed > 0 ? (completed / passed) * 100 : null;
        const engagementRate = totalProposals > 0 ? (proposalsWithVotes / totalProposals) * 100 : null;

        return {
            totalProposals,
            proposalsWithVotes,
            zeroVoteProposals,
            totalVotes,
            medianVotes,
            passRate,
            completionRate,
            engagementRate,
        };
    }, [proposalParticipationStats]);

    const activePct = activeParticipationPercentage ?? fmt(totalParticipants ? (safeNumber(activeParticipants) / safeNumber(totalParticipants)) * 100 : null, 1);
    const votingPct = votingParticipationPercentage ?? fmt(totalParticipants ? (safeNumber(votingParticipants) / safeNumber(totalParticipants)) * 100 : null, 1);
    const top10Share = top10GovernanceShare ?? fmt(top10Participants?.percentageOfGovernanceSupply, 1);
    const councilShare = councilVoteShare ?? '-';
    const activationGap = Math.max(safeNumber(votingParticipants) - safeNumber(activeParticipants), 0);

    const depositedVotesDisplay =
        totalDepositedVotes !== null && totalDepositedVotes !== undefined
            ? getFormattedNumberToLocale((safeNumber(totalDepositedVotes) / Math.pow(10, governingTokenDecimals || 0)).toFixed(0))
            : '-';
    const circulatingSupplyPct = circulatingSupply?.value?.amount
        ? ((safeNumber(totalDepositedVotes) / safeNumber(circulatingSupply.value.amount)) * 100).toFixed(1)
        : null;

    const skewRatio = averageVotesPerParticipant && medianVotesFormatted && safeNumber(medianVotesFormatted) > 0
        ? safeNumber(averageVotesPerParticipant) / safeNumber(medianVotesFormatted)
        : null;

    return (
        <Box sx={{ p: 1 }}>
            <SectionHeader
                title="Voter Base"
                subtitle="Participation quality and member behavior"
            />
            <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Active / Voting / Total"
                        value={`${safeNumber(activeParticipants)}/${safeNumber(votingParticipants)}/${safeNumber(totalParticipants)}`}
                        hint="staked / ever-voted / members"
                        tooltip="Snapshot of voter base quality."
                        accent="#8ec5ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Active Participation"
                        value={`${activePct}%`}
                        progress={toPercent(activePct)}
                        hint="active members ratio"
                        tooltip="Percent of members with currently staked governance power."
                        accent="#72d38c"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Voting Participation"
                        value={`${votingPct}%`}
                        progress={toPercent(votingPct)}
                        hint="historical voter ratio"
                        tooltip="Percent of members that have ever voted."
                        accent="#f8bc72"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Delegation Rate"
                        value={delegationRate ? `${delegationRate}%` : '-'}
                        progress={toPercent(delegationRate)}
                        hint="among active voters"
                        tooltip="Share of active members using a governance delegate."
                        accent="#d0a6ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Voting-Active Gap"
                        value={`${activationGap}`}
                        hint="voted but currently unstaked"
                        tooltip="Members who voted historically but have no active stake now."
                        accent="#9bc6ff"
                    />
                </Grid>
            </Grid>

            <SectionHeader
                title="Proposal Quality"
                subtitle="Engagement and outcomes from proposal voting activity"
            />
            <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Total Proposals"
                        value={`${derived.totalProposals}`}
                        hint={`${derived.totalVotes} total votes`}
                        tooltip="Total proposal count in this realm snapshot."
                        accent="#b5d58b"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Proposals With Votes"
                        value={`${derived.proposalsWithVotes}`}
                        progress={toPercent(derived.engagementRate)}
                        hint={`${fmt(derived.engagementRate, 1)}% engaged`}
                        tooltip="Proposals that received at least one vote."
                        accent="#8bc5a8"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Zero-Vote Proposals"
                        value={`${derived.zeroVoteProposals}`}
                        hint="needs visibility"
                        tooltip="Proposals with no voting engagement."
                        accent="#e39a7a"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Avg / Median Votes"
                        value={`${averageVotesPerProposal ?? '-'} / ${fmt(derived.medianVotes, 1)}`}
                        hint="votes per proposal"
                        tooltip="Average and median vote counts per proposal."
                        accent="#9bc6ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Pass Rate"
                        value={derived.passRate !== null ? `${fmt(derived.passRate, 1)}%` : '-'}
                        progress={toPercent(derived.passRate)}
                        hint="resolved proposals only"
                        tooltip="Passed / (passed + defeated) using proposal states."
                        accent="#72d38c"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Execution Completion"
                        value={derived.completionRate !== null ? `${fmt(derived.completionRate, 1)}%` : '-'}
                        progress={toPercent(derived.completionRate)}
                        hint="completed among passed"
                        tooltip="Completed / passed proposals."
                        accent="#66c7d9"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Top Participated"
                        value={mostParticipatedProposal ? `${safeNumber(mostParticipatedProposal.totalVotes)}` : '-'}
                        hint={mostParticipatedProposal?.title || 'no vote activity yet'}
                        tooltip={mostParticipatedProposal?.title || 'No proposal vote activity yet.'}
                        accent="#f0b16c"
                    />
                </Grid>
            </Grid>

            <SectionHeader
                title="Capital Signals"
                subtitle="Stake distribution and governance capital concentration"
            />
            <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Deposited Votes"
                        value={totalDepositedCouncilVotes ? `${depositedVotesDisplay} / ${safeNumber(totalDepositedCouncilVotes)}` : depositedVotesDisplay}
                        hint="community / council"
                        tooltip="Current deposited voting capital."
                        accent="#98d0ad"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="% Circulating Supply"
                        value={circulatingSupplyPct ? `${circulatingSupplyPct}%` : '-'}
                        progress={toPercent(circulatingSupplyPct)}
                        hint="staked supply ratio"
                        tooltip="Community deposited votes divided by circulating supply."
                        accent="#79c9dd"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Top 10 Share"
                        value={top10Share !== '-' ? `${top10Share}%` : '-'}
                        progress={toPercent(top10Share)}
                        hint="governance concentration"
                        tooltip="Share of governance stake held by top 10 participants."
                        accent="#a8b9ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Council Share"
                        value={councilShare !== '-' ? `${councilShare}%` : '-'}
                        progress={toPercent(councilShare)}
                        hint="council weight contribution"
                        tooltip="Council votes as portion of community voting capital."
                        accent="#d6b57d"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Avg Deposit / Active"
                        value={averageVotesPerParticipant ? getFormattedNumberToLocale(Number(averageVotesPerParticipant)) : '-'}
                        hint="community units"
                        tooltip="Average deposited community stake per active member."
                        accent="#9ac3d8"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Median Deposit / Active"
                        value={medianVotesFormatted ? getFormattedNumberToLocale(Number(medianVotesFormatted)) : '-'}
                        hint="community units"
                        tooltip="Median deposited community stake per active member."
                        accent="#8abbd0"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Deposit Skew (Avg/Med)"
                        value={skewRatio !== null ? fmt(skewRatio, 2) : '-'}
                        hint="higher = more concentrated"
                        tooltip="Average-to-median ratio of active deposits."
                        accent="#c6a4ff"
                    />
                </Grid>
            </Grid>
        </Box>
    );
}
