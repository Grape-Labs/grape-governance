import React, { useMemo } from 'react';
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
    proposals?: any[];
    participationSeries?: {
        month: string;
        voters: number;
    }[];
    participantArray?: {
        voteStats?: {
            total?: number;
            approve?: number;
            deny?: number;
            abstain?: number;
        };
        voteHistory?: any[];
        wallet?: string;
    }[];
    flaggedAuthors?: {
        totalFlagged?: number;
        vetoed?: number;
        cancelled?: number;
        wallet?: string | null;
        authorKey?: string;
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
    if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
        const converted = value.toNumber();
        return Number.isFinite(converted) ? converted : 0;
    }
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

const PROPOSAL_STATE_LABELS: Record<number, string> = {
    0: 'Draft',
    1: 'Signing Off',
    2: 'Voting',
    3: 'Succeeded',
    4: 'Executing',
    5: 'Completed',
    6: 'Cancelled',
    7: 'Defeated',
    8: 'Executing with Errors',
    9: 'Vetoed',
};

const getProposalTimestamp = (proposal: any): number => {
    const rawValue =
        proposal?.account?.draftAt ??
        proposal?.account?.votingAt ??
        proposal?.draftAt ??
        proposal?.votingAt ??
        0;
    return safeNumber(rawValue);
};

const getProposalState = (proposal: any, fallbackState?: string): string => {
    if (fallbackState) return String(fallbackState);
    const numericState = safeNumber(proposal?.account?.state);
    return PROPOSAL_STATE_LABELS[numericState] || 'Unknown';
};

const getProposalAuthorKey = (proposal: any): string => {
    return String(
        proposal?.account?.proposer?.toBase58?.() ||
        proposal?.account?.proposer?.toString?.() ||
        proposal?.account?.tokenOwnerRecord?.toBase58?.() ||
        proposal?.account?.tokenOwnerRecord?.toString?.() ||
        ''
    );
};

const formatRelativeAge = (timestamp: number | null): string => {
    if (!timestamp) return '-';
    const ageDays = Math.max(0, Math.floor((Date.now() / 1000 - timestamp) / 86400));
    if (ageDays === 0) return 'today';
    if (ageDays < 30) return `${ageDays}d ago`;
    if (ageDays < 365) return `${Math.floor(ageDays / 30)}mo ago`;
    return `${fmt(ageDays / 365, ageDays < 730 ? 1 : 0)}y ago`;
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
        proposals,
        participationSeries,
        participantArray,
        flaggedAuthors,
    } = props;

    const memberStats = useMemo(() => {
        if (!members?.length) {
            return {
                averageVotesPerParticipant: null,
                medianVotesFormatted: null,
                delegationRate: null,
            };
        }

        const deposits = members.map((m) => safeNumber(m.governingTokenDepositAmount)).sort((a, b) => a - b);
        const activeCount = safeNumber(activeParticipants);

        const avg = activeCount
            ? deposits.reduce((a, b) => a + b, 0) / activeCount / Math.pow(10, governingTokenDecimals || 0)
            : null;
        const mid = Math.floor(deposits.length / 2);
        const median = deposits.length % 2 === 0 ? (deposits[mid - 1] + deposits[mid]) / 2 : deposits[mid];

        const delegatedCount = members.filter((p) => !!p.governanceDelegate).length;
        const delRate = activeCount ? (delegatedCount / activeCount) * 100 : null;

        return {
            averageVotesPerParticipant: avg?.toFixed(1) || null,
            medianVotesFormatted: (median / Math.pow(10, governingTokenDecimals || 0)).toFixed(1),
            delegationRate: delRate?.toFixed(1) || null,
        };
    }, [members, activeParticipants, governingTokenDecimals]);

    const derived = useMemo(() => {
        const rows = proposalParticipationStats || [];
        const proposalVoteMap = new Map(rows.map((row) => [row.pubkey, safeNumber(row.totalVotes)]));
        const proposalRows = (proposals || []).map((proposal: any) => {
            const pubkey =
                proposal?.pubkey?.toBase58?.() ||
                proposal?.pubkey?.toString?.() ||
                proposal?.pubkey ||
                '';
            const matchingStat = rows.find((row) => row.pubkey === pubkey);

            return {
                pubkey,
                title: proposal?.account?.name || matchingStat?.title || 'Untitled Proposal',
                totalVotes: proposalVoteMap.get(pubkey) || 0,
                state: getProposalState(proposal, matchingStat?.state),
                createdAt: getProposalTimestamp(proposal),
                authorKey: getProposalAuthorKey(proposal),
            };
        });

        const fallbackRows = proposalRows.length > 0
            ? proposalRows
            : rows.map((row) => ({
                pubkey: row.pubkey,
                title: row.title,
                totalVotes: safeNumber(row.totalVotes),
                state: row.state || 'Unknown',
                createdAt: 0,
                authorKey: '',
            }));

        const votes = fallbackRows.map((r) => safeNumber(r.totalVotes)).sort((a, b) => a - b);
        const totalProposals = fallbackRows.length;
        const proposalsWithVotes = votes.filter((v) => v > 0).length;
        const zeroVoteProposals = Math.max(totalProposals - proposalsWithVotes, 0);
        const totalVotes = votes.reduce((sum, value) => sum + value, 0);
        const medianVotes = votes.length
            ? (votes.length % 2 === 0
                ? (votes[(votes.length / 2) - 1] + votes[votes.length / 2]) / 2
                : votes[Math.floor(votes.length / 2)])
            : null;

        const normalize = (state?: string) => String(state || '').toLowerCase();
        const passed = fallbackRows.filter((r) => {
            const s = normalize(r.state);
            return s.includes('succeeded') || s.includes('completed') || s.includes('executing');
        }).length;
        const defeated = fallbackRows.filter((r) => normalize(r.state).includes('defeated')).length;
        const completed = fallbackRows.filter((r) => normalize(r.state).includes('completed')).length;
        const resolved = passed + defeated;

        const passRate = resolved > 0 ? (passed / resolved) * 100 : null;
        const completionRate = passed > 0 ? (completed / passed) * 100 : null;
        const engagementRate = totalProposals > 0 ? (proposalsWithVotes / totalProposals) * 100 : null;

        const proposalTimestamps = fallbackRows
            .map((row) => safeNumber(row.createdAt))
            .filter((value) => value > 0)
            .sort((a, b) => a - b);
        const proposalMonths = new Set(
            proposalTimestamps.map((timestamp) => new Date(timestamp * 1000).toISOString().slice(0, 7))
        );
        const averageGapDays = proposalTimestamps.length > 1
            ? proposalTimestamps
                .slice(1)
                .map((timestamp, index) => (timestamp - proposalTimestamps[index]) / 86400)
                .reduce((sum, value) => sum + value, 0) / (proposalTimestamps.length - 1)
            : null;
        const lastProposalAt = proposalTimestamps.length
            ? proposalTimestamps[proposalTimestamps.length - 1]
            : null;
        const recentProposalCount90d = proposalTimestamps.filter((timestamp) => timestamp >= (Date.now() / 1000) - (90 * 86400)).length;

        const authorKeys = fallbackRows.map((row) => row.authorKey).filter(Boolean);
        const uniqueAuthors = new Set(authorKeys);
        const proposalsPerAuthor = uniqueAuthors.size > 0 ? totalProposals / uniqueAuthors.size : null;

        const participatingVoters = (participantArray || []).filter((participant) => safeNumber(participant?.voteStats?.total) > 0);
        const repeatVoters = participatingVoters.filter((participant) => safeNumber(participant?.voteStats?.total) > 1).length;
        const repeatVoterRate = participatingVoters.length > 0
            ? (repeatVoters / participatingVoters.length) * 100
            : null;

        const monthlyParticipation = participationSeries || [];
        const peakMonthlyVoters = monthlyParticipation.length
            ? Math.max(...monthlyParticipation.map((row) => safeNumber(row.voters)))
            : null;
        const latestMonthlyVoters = monthlyParticipation.length
            ? safeNumber(monthlyParticipation[monthlyParticipation.length - 1]?.voters)
            : null;

        const flaggedProposalCount = (flaggedAuthors || []).reduce((sum, row) => sum + safeNumber(row.totalFlagged), 0);
        const flaggedAuthorCount = (flaggedAuthors || []).length;
        const flaggedProposalRate = totalProposals + flaggedProposalCount > 0
            ? (flaggedProposalCount / (totalProposals + flaggedProposalCount)) * 100
            : null;

        return {
            totalProposals,
            proposalsWithVotes,
            zeroVoteProposals,
            totalVotes,
            medianVotes,
            passRate,
            completionRate,
            engagementRate,
            lastProposalAt,
            proposalMonths: proposalMonths.size,
            proposalsPerAuthor,
            uniqueAuthors: uniqueAuthors.size,
            averageGapDays,
            repeatVoters,
            repeatVoterRate,
            peakMonthlyVoters,
            latestMonthlyVoters,
            recentProposalCount90d,
            flaggedProposalCount,
            flaggedAuthorCount,
            flaggedProposalRate,
        };
    }, [proposalParticipationStats, proposals, participantArray, participationSeries, flaggedAuthors]);

    const activePct = activeParticipationPercentage ?? fmt(totalParticipants ? (safeNumber(activeParticipants) / safeNumber(totalParticipants)) * 100 : null, 1);
    const votingPct = votingParticipationPercentage ?? fmt(totalParticipants ? (safeNumber(votingParticipants) / safeNumber(totalParticipants)) * 100 : null, 1);
    const top10Share = top10GovernanceShare ?? fmt(top10Participants?.percentageOfGovernanceSupply, 1);
    const councilShare = councilVoteShare ?? '-';

    const depositedVotesDisplay =
        totalDepositedVotes !== null && totalDepositedVotes !== undefined
            ? getFormattedNumberToLocale((safeNumber(totalDepositedVotes) / Math.pow(10, governingTokenDecimals || 0)).toFixed(0))
            : '-';
    const depositedCouncilVotesDisplay =
        totalDepositedCouncilVotes !== null && totalDepositedCouncilVotes !== undefined
            ? getFormattedNumberToLocale(safeNumber(totalDepositedCouncilVotes))
            : null;
    const circulatingSupplyPct = circulatingSupply?.value?.amount
        ? ((safeNumber(totalDepositedVotes) / safeNumber(circulatingSupply.value.amount)) * 100).toFixed(1)
        : null;

    const skewRatio = memberStats.averageVotesPerParticipant && memberStats.medianVotesFormatted && safeNumber(memberStats.medianVotesFormatted) > 0
        ? safeNumber(memberStats.averageVotesPerParticipant) / safeNumber(memberStats.medianVotesFormatted)
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
                        value={memberStats.delegationRate ? `${memberStats.delegationRate}%` : '-'}
                        progress={toPercent(memberStats.delegationRate)}
                        hint="among active voters"
                        tooltip="Share of active members using a governance delegate."
                        accent="#d0a6ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Repeat Voters"
                        value={derived.repeatVoterRate !== null ? `${fmt(derived.repeatVoterRate, 1)}%` : '-'}
                        progress={toPercent(derived.repeatVoterRate)}
                        hint={derived.repeatVoters ? `${derived.repeatVoters} members voted more than once` : 'no repeat voter history yet'}
                        tooltip="Share of participating members who have cast more than one vote."
                        accent="#7dd0c8"
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
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Proposal Authors"
                        value={`${derived.uniqueAuthors}`}
                        hint={derived.proposalsPerAuthor !== null ? `${fmt(derived.proposalsPerAuthor, 1)} proposals per author` : 'author data unavailable'}
                        tooltip="Distinct proposal creators represented in this governance snapshot."
                        accent="#d39ed9"
                    />
                </Grid>
            </Grid>

            <SectionHeader
                title="Activity & Risk"
                subtitle="Cadence, recency, and governance hygiene signals"
            />
            <Grid container spacing={1.25}>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Latest Proposal"
                        value={formatRelativeAge(derived.lastProposalAt)}
                        hint={derived.lastProposalAt ? new Date(derived.lastProposalAt * 1000).toLocaleDateString() : 'no proposal timestamp'}
                        tooltip="How recently the DAO published a proposal."
                        accent="#8dc1ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Proposal Cadence"
                        value={derived.proposalMonths > 0 ? `${fmt(derived.totalProposals / derived.proposalMonths, 1)}/mo` : '-'}
                        hint={derived.proposalMonths ? `${derived.proposalMonths} active proposal months` : 'no month history yet'}
                        tooltip="Average proposals created per active month."
                        accent="#8ad2a4"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Peak Monthly Voters"
                        value={derived.peakMonthlyVoters !== null ? `${derived.peakMonthlyVoters}` : '-'}
                        hint={derived.latestMonthlyVoters !== null ? `latest month: ${derived.latestMonthlyVoters}` : 'monthly participation unavailable'}
                        tooltip="Highest number of distinct wallets that voted in the same month."
                        accent="#f0c27a"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Flagged Proposals"
                        value={`${derived.flaggedProposalCount}`}
                        hint={derived.flaggedProposalRate !== null ? `${fmt(derived.flaggedProposalRate, 1)}% cancelled or vetoed` : 'no flagged proposals'}
                        tooltip="Community proposals that ended cancelled or vetoed."
                        accent="#f08c7a"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Avg Proposal Gap"
                        value={derived.averageGapDays !== null ? `${fmt(derived.averageGapDays, 1)}d` : '-'}
                        hint={derived.recentProposalCount90d ? `${derived.recentProposalCount90d} proposals in 90d` : 'no recent proposal activity'}
                        tooltip="Average days between proposal creation events."
                        accent="#b7a7ff"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Flagged Authors"
                        value={`${derived.flaggedAuthorCount}`}
                        hint="wallets with cancelled/vetoed history"
                        tooltip="Distinct proposal authors associated with flagged community proposals."
                        accent="#d9aa86"
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
                        value={depositedCouncilVotesDisplay ? `${depositedVotesDisplay} / ${depositedCouncilVotesDisplay}` : depositedVotesDisplay}
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
                        value={memberStats.averageVotesPerParticipant ? getFormattedNumberToLocale(Number(memberStats.averageVotesPerParticipant)) : '-'}
                        hint="community units"
                        tooltip="Average deposited community stake per active member."
                        accent="#9ac3d8"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4} lg={3}>
                    <StatCard
                        title="Median Deposit / Active"
                        value={memberStats.medianVotesFormatted ? getFormattedNumberToLocale(Number(memberStats.medianVotesFormatted)) : '-'}
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
