import { 
        getRealmIndexed,
        getProposalIndexed,
        getVoteRecordsIndexed,
        getProposalNewIndexed,
        getAllProposalsIndexed,
        getGovernanceIndexed,
        getAllGovernancesIndexed,
        getAllTokenOwnerRecordsIndexed,
        getProposalInstructionsIndexed,
} from './queries';
/*
const getProposalParticipationStats = async (realmPk: string) => {
    const governanceRulesIndexed = await getAllGovernancesIndexed(realmPk, grealm?.owner);
    const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
    
    const allProposals = await getAllProposalsIndexed(undefined, undefined, realmPk);
    const allVoteRecords = await getVoteRecordsForAllProposalsInRealm(realmPk);

    const voteCounts = new Map<string, number>();
    for (const vote of allVoteRecords) {
        const key = vote.account.proposal.toBase58();
        voteCounts.set(key, (voteCounts.get(key) || 0) + 1);
    }

    let most = null, least = null;
    for (const prop of allProposals) {
        const count = voteCounts.get(prop.pubkey.toBase58()) || 0;
        if (!most || count > most.count) most = { proposal: prop, count };
        if (!least || count < least.count) least = { proposal: prop, count };
    }

    return { most, least };
};

const countProposalsByMintType = async (realmPk: string, communityMint: string, councilMint: string) => {
    const allProposals = await getAllProposalsIndexed(undefined, undefined, realmPk);

    let community = 0, council = 0;

    allProposals.forEach((p) => {
        if (p.account.governingTokenMint.toBase58() === communityMint) community++;
        else if (p.account.governingTokenMint.toBase58() === councilMint) council++;
    });

    return {
        total: allProposals.length,
        community,
        council,
    };
};

const calculateProposalSuccessRate = async (realmPk: string) => {
    const allProposals = await getAllProposalsIndexed(undefined, undefined, realmPk);

    let succeeded = 0;
    const total = allProposals.length;

    allProposals.forEach((p) => {
        if (p.account.state === 'Succeeded' || p.account.state === 3) succeeded++;
    });

    return {
        total,
        succeeded,
        failed: total - succeeded,
        successRate: ((succeeded / total) * 100).toFixed(1),
    };
};

const getInstructionStats = async (realmPk: string) => {
    const allProposals = await getAllProposalsIndexed(undefined, undefined, realmPk);
    let proposalsWithIx = 0;
    let totalInstructions = 0;

    for (const proposal of allProposals) {
        const instructions = await getProposalInstructionsIndexed(realmPk, proposal.pubkey.toBase58());
        if (instructions?.length > 0) {
            proposalsWithIx++;
            totalInstructions += instructions.length;
        }
    }

    return {
        proposalsWithIx,
        totalInstructions,
    };
};*/