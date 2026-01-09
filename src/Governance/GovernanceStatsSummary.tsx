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
        mostParticipatedProposal,
        averageVotesPerProposal,
        proposalParticipationStats
    } = props;

    const [averageVotesPerParticipant, setAverageVotesPerParticipant] = useState<string | null>(null);
    const [medianVotesFormatted, setMedianVotesFormatted] = useState<string | null>(null);
    const [delegationRate, setDelegationRate] = useState<string | null>(null);
    const [proposalPassRate, setProposalPassRate] = useState<string | null>(null);
    const [proposalFailRate, setProposalFailRate] = useState<string | null>(null);
    const [avgTurnoutPercent, setAvgTurnoutPercent] = useState<string | null>(null);
    const [communityPassRate, setCommunityPassRate] = useState<string | null>(null);
    const [councilPassRate, setCouncilPassRate] = useState<string | null>(null);
    const [sleepingStakePercent, setSleepingStakePercent] = useState<string | null>(null);
    const [topHolderSharePercent, setTopHolderSharePercent] = useState<string | null>(null);
    const [effectiveVoterCount, setEffectiveVoterCount] = useState<string | null>(null);
    
    useEffect(() => {
        if (!members?.length) return;

        const rawDeposits = members.map(m => Number(m.governingTokenDepositAmount) || 0);
        const deposits = [...rawDeposits].sort((a, b) => a - b);

        const totalRawDeposited = rawDeposits.reduce((a, b) => a + b, 0);

        // Average / median (existing)
        const avg = activeParticipants && totalRawDeposited > 0
            ? (totalRawDeposited / activeParticipants / Math.pow(10, governingTokenDecimals))
            : null;

        const mid = Math.floor(deposits.length / 2);
        const median = deposits.length % 2 === 0
            ? (deposits[mid - 1] + deposits[mid]) / 2
            : deposits[mid];

        const delegatedCount = members.filter(p => !!p.governanceDelegate).length;
        const delRate = activeParticipants
            ? ((delegatedCount / activeParticipants) * 100)
            : null;

        setAverageVotesPerParticipant(avg?.toFixed(0) || null);
        setMedianVotesFormatted(
            totalRawDeposited > 0 ? (median / Math.pow(10, governingTokenDecimals)).toFixed(0) : null
        );
        setDelegationRate(delRate?.toFixed(1) || null);

        // NEW: Sleeping stake = stake from wallets that never voted
        if (totalRawDeposited > 0) {
            const sleepingRaw = members
                .filter(m => Number(m.totalVotesCount || 0) === 0)
                .reduce((sum, m) => sum + (Number(m.governingTokenDepositAmount) || 0), 0);

            const sleepingPct = (sleepingRaw / totalRawDeposited) * 100;
            setSleepingStakePercent(sleepingPct.toFixed(1));

            // Top holder share
            const maxDeposit = Math.max(...rawDeposits);
            const topShare = (maxDeposit / totalRawDeposited) * 100;
            setTopHolderSharePercent(topShare.toFixed(1));

            // Effective voter count (1 / Σ share_i²)
            const shares = rawDeposits
                .filter(v => v > 0)
                .map(v => v / totalRawDeposited);

            const hhi = shares.reduce((sum, s) => sum + s * s, 0);
            const effective = hhi > 0 ? (1 / hhi) : 0;
            setEffectiveVoterCount(effective.toFixed(1));
        } else {
            setSleepingStakePercent(null);
            setTopHolderSharePercent(null);
            setEffectiveVoterCount(null);
        }
    }, [members, activeParticipants, governingTokenDecimals]);

    useEffect(() => {
        if (!proposalParticipationStats || proposalParticipationStats.length === 0) {
            setProposalPassRate(null);
            setCommunityPassRate(null);
            setCouncilPassRate(null);
            return;
        }

        const communityMint = props.members?.[0]?.staked?.communityMint; 
        // You also have this as:
        // grealm.account.communityMint (passed as governingTokenMint)
        // so use:
        const cmMint = props.governingTokenDecimals !== undefined
            ? props.members[0].staked?.communityMint
            : null;

        const proposals = proposalParticipationStats;

        const communityProposals = proposals.filter(
            p => p.proposalMint === props.members?.[0]?.voteHistory?.[0]?.communityMint
        );

        const councilProposals = proposals.filter(
            p => p.proposalMint !== props.members?.[0]?.voteHistory?.[0]?.communityMint
        );

        const passed = (arr) =>
            arr.filter(p => p.state === "Succeeded" || p.state === "Completed").length;

        const commPassed = passed(communityProposals);
        const councilPassed = passed(councilProposals);

        const commRate = communityProposals.length
            ? ((commPassed / communityProposals.length) * 100).toFixed(1)
            : null;

        const councilRate = councilProposals.length
            ? ((councilPassed / councilProposals.length) * 100).toFixed(1)
            : null;

        setCommunityPassRate(commRate);
        setCouncilPassRate(councilRate);
    }, [proposalParticipationStats]);

    return (
        <Box sx={{ p: 1 }}>
            <Grid container spacing={1}>
                
                {mostParticipatedProposal ? (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Most Participated Proposal"
                        tooltip={mostParticipatedProposal.title || 'Most voted proposal'}
                        value={`${mostParticipatedProposal.totalVotes}`}
                        />
                    </Grid>
                    ) : (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Most Participated Proposal"
                        tooltip="No proposals with votes yet."
                        value={`-`}
                        />
                    </Grid>
                    )}
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Average Votes per Proposal"
                        tooltip="Average number of votes cast across all proposals in the realm."
                        value={`${averageVotesPerProposal}`}
                    />
                </Grid>
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Total Proposals"
                        tooltip="All Proposals in the realm."
                        value={`${proposalParticipationStats?.length || 0}`}
                    />
                </Grid>
                
                
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
                
                {/* SUPPLY / CONCENTRATION */}
                <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                    title="Total Votes Deposited"
                    tooltip="Total tokens staked into governance (and council if applicable)."
                    value={
                        totalDepositedVotes
                        ? `${getFormattedNumberToLocale(
                            (totalDepositedVotes / Math.pow(10, governingTokenDecimals)).toFixed(0)
                            )}${totalDepositedCouncilVotes ? ` / ${totalDepositedCouncilVotes}` : ''}`
                        : '-'
                    }
                    />
                </Grid>

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

                {top10GovernanceShare && (
                    <Grid item xs={12} md={6} lg={3}>
                    <StatBox
                        title="Top 10 Governance Share"
                        tooltip="Percentage of deposited governance supply held by the top 10 addresses."
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

                {/*proposalPassRate && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Proposal Pass Rate"
                        tooltip="Percentage of proposals that were passed (Succeeded or Completed)."
                        value={`${proposalPassRate}%`}
                        />
                    </Grid>
                )}

                {communityPassRate && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Community Pass Rate"
                        tooltip="Percentage of proposals passed using community token voting."
                        value={`${communityPassRate}%`}
                        />
                    </Grid>
                )}

                {councilPassRate && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Council Pass Rate"
                        tooltip="Percentage of proposals passed using council token voting."
                        value={`${councilPassRate}%`}
                        />
                    </Grid>
                )}

                {avgTurnoutPercent && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Avg Voter Turnout %"
                        tooltip="Average share of wallets that participate in a typical proposal."
                        value={`${avgTurnoutPercent}%`}
                        />
                    </Grid>
                )*/}

                {/*sleepingStakePercent && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Sleeping Stake %"
                        tooltip="Share of deposited governance tokens that belong to wallets that have never voted."
                        value={`${sleepingStakePercent}%`}
                        />
                    </Grid>
                    )*/}

                    {/*topHolderSharePercent && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Top Holder Share"
                        tooltip="Percentage of deposited governance tokens held by the single largest staker."
                        value={`${topHolderSharePercent}%`}
                        />
                    </Grid>
                    )*/}

                    {effectiveVoterCount && (
                    <Grid item xs={12} md={6} lg={3}>
                        <StatBox
                        title="Effective Voter Count"
                        tooltip="Number of equally powerful voters that would give the same concentration of voting power (1 / Σ share²)."
                        value={effectiveVoterCount}
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