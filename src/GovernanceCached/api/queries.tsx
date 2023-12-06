import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { 
    SHYFT_KEY,
    RPC_CONNECTION } from '../../utils/grapeTools/constants';

import { 
    getGovernance,
    getProposal,
    getRealm, 
    getAllGovernances,
    getAllProposals, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    tryGetRealmConfig, 
    getRealmConfig  } from '@solana/spl-governance';

const govOwners = [
    {
        owner: 'GovMaiHfpVPw8BAM1mbdzgmSZYDw2tdP32J2fapoQoYs',
        name: 'Marinade_DAO',
        dao: '899YG3yk4F66ZgbNWLHriZHTXSKk9e1kvsKEquW7L6Mo'
    },
    {
        owner: 'GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J',
        name: 'Mango',
        dao: 'DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE'
    },
    {
        owner: 'GovHgfDPyQ1GwazJTDY2avSVY8GGcpmCapmmCsymRaGe',
        name: 'Psy_Finance',
        dao: 'FiG6YoqWnVzUmxFNukcRVXZC51HvLr6mts8nxcm7ScR8'
    },
    {
        owner: 'JPGov2SBA6f7XSJF5R4Si5jEJekGiyrwP2m7gSEqLUs',
        name: 'Jet_Custody',
        dao: 'FbpwgUzRPTneoZHDMNnM1zXb7Jm9iY8MzX2mAM8L6f43'
    },
    {
        owner: 'pytGY6tWRgGinSCvRLnSv4fHfBTMoiDGiCsesmHWM6U',
        name: 'Pyth_Governance',
        dao: '4ct8XU5tKbMNRphWy4rePsS9kBqPhDdvZoGpmprPaug4'
    },
    {
        owner: 'GMnke6kxYvqoAXgbFGnu84QzvNHoqqTnijWSXYYTFQbB',
        name: 'MonkeDAO',
        dao: 'B1CxhV1khhj7n5mi5hebbivesqH9mvXr5Hfh2nD2UCh6'
    },
]

function findGovOwnerByDao(dao) {
    const matchingGovOwner = govOwners.find((govOwner) => govOwner.dao === dao);
    if (!matchingGovOwner)
        return {
            owner: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
        }
    else
        return matchingGovOwner;
    //console.log("found: "+JSON.stringify(matchingGovOwner));
    
  }

/*

        'GovMaiHfpVPw8BAM1mbdzgmSZYDw2tdP32J2fapoQoYs': 'Marinade_DAO', +
        'GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J': 'Mango', + 
        'AEauWRrpn9Cs6GXujzdp1YhMmv2288kBt3SdEcPYEerr': 'Metaplex_DAO',
        'JPGov2SBA6f7XSJF5R4Si5jEJekGiyrwP2m7gSEqLUs': 'Jet_Custody', +
        'GovHgfDPyQ1GwazJTDY2avSVY8GGcpmCapmmCsymRaGe': 'Psy_Finance', +
        'GMnke6kxYvqoAXgbFGnu84QzvNHoqqTnijWSXYYTFQbB': 'MonkeDAO', +
       '5hAykmD4YGcQ7Am3N7nC9kyELq6CThAkU82nhNKDJiCy': 'SOCEAN',
       'jdaoDN37BrVRvxuXSeyR7xE5Z9CAoQApexGrQJbnj6V': 'JungleDeFi_DAO',
       'HT19EcD68zn7NoCF79b2ucQF8XaMdowyPt5ccS6g1PUx': 'Ratio_Finance',
       'GCockTxUjxuMdojHiABVZ5NKp6At8eTKDiizbPjiCo4m': 'Chicken_Tribe',
       'gUAedF544JeE6NYbQakQvribHykUNgaPJqcgf3UQVnY': 'Ukraine_SOL',
       'Ghope52FuF6HU3AAhJuAAyS2fiqbVhkAotb7YprL5tdS': 'RadRugsDAO',
       'MGovW65tDhMMcpEmsegpsdgvzb6zUwGsNjhXFxRAnjd': 'MEAN_DAO',
       'A7kmu2kUcnQwAVn8B4znQmGJeUrsJ1WEhYVMtmiBLkEr': 'Solend_DAO',
       'hgovkRU6Ghe1Qoyb54HdSLdqN7VtxaifBzRmh9jtd3S': 'Helium',
       'GmtpXy362L8cZfkRmTZMYunWVe8TyRjX5B7sodPZ63LJ': 'Metaplex_Found',
       'AVoAYTs36yB5izAaBkxRG67wL1AMwG3vo41hKtUSb8is': 'Serum',
       'GMpXgTSJt2nJ7zjD1RwbT2QyPhKqD2MjAZuEaLsfPYLF': 'Metaplex_Genesis',
       'J9uWvULFL47gtCPvgR3oN7W357iehn5WF2Vn9MJvcSxz': 'Orca',
        'pytGY6tWRgGinSCvRLnSv4fHfBTMoiDGiCsesmHWM6U': 'Pyth_Governance', +
       'ALLGnZikNaJQeN4KCAbDjZRSzvSefUdeTpk18yfizZvT': 'ALLOVR_DAO',
*/


const client = new ApolloClient({
    uri: 'https://programs.shyft.to/v0/graphql/?api_key='+SHYFT_KEY,
    cache: new InMemoryCache(),
});

function GET_QUERY_PROPOSALS(governanceArray?:string[], realmOwner?:string){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    if (governanceArray){
        return gql`
        query MyQuery {
            ${programId}_ProposalV2(offset: 0, where: {governance: {_in: [${governanceArray.map(pubkey => `"${pubkey}"`).join(', ')}]}}) {
            pubkey
            abstainVoteWeight
            closedAt
            denyVoteWeight
            descriptionLink
            draftAt
            executingAt
            executionFlags
            governance
            governingTokenMint
            lamports
            maxVoteWeight
            maxVotingTime
            name
            options
            reserved1
            signatoriesCount
            signatoriesSignedOffCount
            signingOffAt
            startVotingAt
            state
            tokenOwnerRecord
            vetoVoteWeight
            voteThreshold
            voteType
            votingAt
            votingAtSlot
            votingCompletedAt
            }
            ${programId}_ProposalV1(offset: 0, where: {governance: {_in: [${governanceArray.map(pubkey => `"${pubkey}"`).join(', ')}]}}) {
            pubkey
            closedAt
            descriptionLink
            draftAt
            executingAt
            executionFlags
            governance
            governingTokenMint
            instructionsCount
            instructionsExecutedCount
            instructionsNextIndex
            lamports
            maxVoteWeight
            name
            noVotesCount
            signatoriesCount
            signatoriesSignedOffCount
            signingOffAt
            state
            tokenOwnerRecord
            voteThreshold
            votingAt
            votingAtSlot
            votingCompletedAt
            yesVotesCount
            }
    }
    `;
    } else{
        return gql`
            query MyQuery {
                ${programId}_ProposalV2(offset: 0) {
                    pubkey
                    abstainVoteWeight
                    closedAt
                    denyVoteWeight
                    descriptionLink
                    draftAt
                    executingAt
                    executionFlags
                    governance
                    governingTokenMint
                    lamports
                    maxVoteWeight
                    maxVotingTime
                    name
                    options
                    reserved1
                    signatoriesCount
                    signatoriesSignedOffCount
                    signingOffAt
                    startVotingAt
                    state
                    tokenOwnerRecord
                    vetoVoteWeight
                    voteThreshold
                    voteType
                    votingAt
                    votingAtSlot
                    votingCompletedAt
                }
                ${programId}_ProposalV1(offset: 0) {
                    pubkey
                    closedAt
                    descriptionLink
                    draftAt
                    executingAt
                    executionFlags
                    governance
                    governingTokenMint
                    instructionsCount
                    instructionsExecutedCount
                    instructionsNextIndex
                    lamports
                    maxVoteWeight
                    name
                    noVotesCount
                    signatoriesCount
                    signatoriesSignedOffCount
                    signingOffAt
                    state
                    tokenOwnerRecord
                    voteThreshold
                    votingAt
                    votingAtSlot
                    votingCompletedAt
                    yesVotesCount
                }
        }
        `;
    }
}

function GET_QUERY_RULES(realm:string){
    return gql `
        query MyQuery {
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_GovernanceV2(limit: 100, where: {realm: {_eq: "${realm}"}}) {
            pubkey
            realm
            reserved
            lamports
            governedAccount
            config
            activeProposalCount
            }
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_GovernanceV1(limit:100, where: {realm: {_eq: "${realm}"}}) {
            pubkey
            config
            governedAccount
            lamports
            proposalsCount
            realm
            }
        }
        `
}

function GET_QUERY_MEMBERS(realm:string){
    return gql `
        query MyQuery {
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_TokenOwnerRecordV2(limit: 5000, where: {realm: {_eq: "${realm}"}}) {
                governanceDelegate
                governingTokenDepositAmount
                governingTokenMint
                governingTokenOwner
                lamports
                outstandingProposalCount
                realm
                reserved
                unrelinquishedVotesCount
                version
                pubkey      
            }
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_TokenOwnerRecordV1(limit:5000, where: {realm: {_eq: "${realm}"}}) {
                governanceDelegate
                governingTokenDepositAmount
                governingTokenMint
                governingTokenOwner
                lamports
                outstandingProposalCount
                realm
                reserved
                unrelinquishedVotesCount
                version
                pubkey            
            }
        }
        `
}

function GET_QUERY_REALM(realm:string){
    console.log("REALM: "+realm)
    return gql `
        query MyQuery {
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_RealmV1(where: {pubkey: {_eq: "${realm}"}}) {
                authority
                communityMint
                config
                name
                reserved
                
            }
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_RealmV2(where: {pubkey: {_eq: "${realm}"}}) {
                authority
                communityMint
                config
                name
                reserved
                
            }
        }
        `
}

export const getRealmIndexed = async (filterRealm?:any, realmOwner?:any) => {
    if (filterRealm){
        const { data } = await client.query({ query: GET_QUERY_REALM(filterRealm) });
        // normalize data
        const allRealms = new Array();
        console.log("data: "+JSON.stringify(data));
        const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

        data[programId+"_RealmV2"] && data[programId+"_RealmV2"].map((item) => {
            allRealms.push({
                pubkey: new PublicKey(filterRealm),
                owner: new PublicKey(programId),
                account: {
                    authority: new PublicKey(item.authority),
                    communityMint: new PublicKey(item.communityMint),
                    config: {
                        councilMint: new PublicKey(item.config.councilMint),
                        communityMintMaxVoteWeightSource: {
                            type:item.config.communityMintMaxVoteWeightSource.type,
                            value:item.config.communityMintMaxVoteWeightSource.value.toString(16)
                        },
                        minCommunityTokensToCreateGovernance: item.config.minCommunityTokensToCreateGovernance.toString(16),
                        useCommunityVoterWeightAddin: item.config.useCommunityVoterWeightAddin,
                        useMaxCommunityVoterWeightAddin: item.config.useMaxCommunityVoterWeightAddin,
                        reserved: item.config.reserved,
                    },
                    name: item.name,
                    //votingProposalCount: item.votingProposalCount,
                    //activeProposalCount: item.activeProposalCount
                }
            })
        });

        data[programId+"_RealmV1"] && data[programId+"_RealmV1"].map((item) => {
            allRealms.push({
                pubkey: new PublicKey(filterRealm),
                owner: new PublicKey(programId),
                account: {
                    authority: new PublicKey(item.authority),
                    communityMint: new PublicKey(item.communityMint),
                    config: {
                        councilMint: new PublicKey(item.config.councilMint),
                        communityMintMaxVoteWeightSource: {
                            type:item.config.communityMintMaxVoteWeightSource.type,
                            value:item.config.communityMintMaxVoteWeightSource.value.toString(16)
                        },
                        minCommunityTokensToCreateGovernance: item.config.minCommunityTokensToCreateGovernance.toString(16),
                        useCommunityVoterWeightAddin: item.config.useCommunityVoterWeightAddin,
                        useMaxCommunityVoterWeightAddin: item.config.useMaxCommunityVoterWeightAddin,
                        reserved: item.config.reserved,
                    },
                    name: item.name,
                    //votingProposalCount: item.votingProposalCount
                }
            })
        });

        if (!allRealms || allRealms.length <= 0){ // fallback to RPC call is governance not found in index
            const realm = await getRealm(RPC_CONNECTION, new PublicKey(realmOwner));
            allRealms.push(realm);
        }

        return allRealms && allRealms[0];
    }
};

export const getAllGovernancesIndexed = async (filterRealm?:any, realmOwner?:any) => {
    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    if (filterRealm){
        const { data } = await client.query({ query: GET_QUERY_RULES(filterRealm) });
        // normalize data
        const allRules = new Array();
        data[programId+"_GovernanceV2"] && data[programId+"_GovernanceV2"].map((item) => {
            allRules.push({
                pubkey: new PublicKey(item.pubkey),
                account: {
                    realm: new PublicKey(item.realm),
                    governedAccount: new PublicKey(item.governedAccount),
                    config: item.config,
                    activeProposalCount: item.activeProposalCount
                }
            })
        });

        data[programId+"_GovernanceV1"] && data[programId+"_GovernanceV1"].map((item) => {
            allRules.push({
                pubkey: new PublicKey(item?.pubkey),
                account: {
                    realm: new PublicKey(item.realm),
                    governedAccount: new PublicKey(item.governedAccount),
                    config: item.config,
                    proposalsCount: item.proposalsCount
                }
            })
        });

        if (!allRules || allRules.length <= 0){ // fallback to RPC call is governance not found in index
            const rules = await getAllGovernances(RPC_CONNECTION, new PublicKey(programId), new PublicKey(filterRealm));
            for (let item of rules)
                allRules.push(item);
        }
        
        return allRules;
    }
};

export const getAllTokenOwnerRecordsIndexed = async (filterRealm?:any, realmOwner?:any) => {
    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    if (filterRealm){
        
        const { data } = await client.query({ query: GET_QUERY_MEMBERS(filterRealm) });
        // normalize data
        const allResults = new Array();
        
        data[programId+"_TokenOwnerRecordV2"] && data[programId+"_TokenOwnerRecordV2"].map((item) => {
            allResults.push({
                //owner: new PublicKey(item.owner),
                pubkey: new PublicKey(item.pubkey),
                account: {
                    realm: new PublicKey(item.realm),
                    accountType: item.accountType,
                    governingTokenMint: new PublicKey(item.governingTokenMint),
                    governingTokenOwner: new PublicKey(item.governingTokenOwner),
                    governingTokenDepositAmount: item.governingTokenDepositAmount.toString(16),
                    unrelinquishedVotesCount: item.unrelinquishedVotesCount,
                    totalVotesCount: item.totalVotesCount,
                    outstandingProposalCount: item.outstandingProposalCount,
                    reserved: item.reserved,
                    version: item.version
                }
            })
        });

        data[programId+"_TokenOwnerRecordV1"] && data[programId+"_TokenOwnerRecordV1"].map((item) => {
            allResults.push({
                //owner: new PublicKey(item.owner),
                pubkey: new PublicKey(item.pubkey),
                account: {
                    realm: new PublicKey(item.realm),
                    accountType: item.accountType,
                    governingTokenMint: new PublicKey(item.governingTokenMint),
                    governingTokenOwner: new PublicKey(item.governingTokenOwner),
                    governingTokenDepositAmount: item.governingTokenDepositAmount.toString(16),
                    unrelinquishedVotesCount: item.unrelinquishedVotesCount,
                    totalVotesCount: item.totalVotesCount,
                    outstandingProposalCount: item.outstandingProposalCount,
                    reserved: item.reserved,
                    version: item.version
                }
            })
        });

        if (!allResults || allResults.length <= 0){ // fallback to RPC call is governance not found in index
            const rpcResults = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(programId), new PublicKey(filterRealm));
            return rpcResults;
            //allResults.push(...results);
        }

        //console.log("allResults "+JSON.stringify(allResults))
        return allResults;
        
    }
};

export const getProposalIndexed = async (filterGovernance?:any, realmOwner?:any, realmPk?:any, filterProposal?:any) => {

    let proposal = null;
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk);
    
    console.log("filterGovernance: "+filterGovernance);

    const { data } = await client.query({ query: GET_QUERY_PROPOSALS(filterGovernance, realmOwner) });
    
    const allProposals = await getAllProposalsIndexed (filterGovernance, realmOwner, realmPk);

    if (allProposals){
        for (var item of allProposals){
            if (item.pubkey.toBase58() === filterProposal){
                proposal = item;
            }
        }
    }

    if (!proposal){ // fallback to RPC call is governance not found in index
        const prop = await getProposal(RPC_CONNECTION, new PublicKey(filterProposal));
        return prop;
    }

    //console.log("allProposals: "+JSON.stringify(allProposals))
    return proposal;
}

export const getAllProposalsIndexed = async (filterGovernance?:any, realmOwner?:any, realmPk?:any) => {
    const { data } = await client.query({ query: GET_QUERY_PROPOSALS(filterGovernance, realmOwner) });

    const allProposals = new Array();

    const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk);
    
    data[programId+"_ProposalV2"] && data[programId+"_ProposalV2"].map((account) => {
        const options = account?.options?.map && account.options.map((option) => {
            return {
                label: option.label,
                voteWeight: parseInt(option.voteWeight, 16),
                voteResult: option.voteResult,
                instructionsExecutedCount: option.instructionsExecutedCount,
                instructionsCount: option.instructionsCount,
                instructionsNextIndex: option.instructionsNextIndex,
            };
        });
        
        allProposals.push({
            owner: programId === 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw' ? new PublicKey(programId) : null,
            pubkey: new PublicKey(account?.pubkey),
            account:{
                accountType: account.accountType,
                governance: new PublicKey(account.governance),
                governingTokenMint: new PublicKey(account.governingTokenMint),
                state: account.state,
                tokenOwnerRecord: new PublicKey(account.tokenOwnerRecord),
                signatoriesCount: account.signatoriesCount,
                signatoriesSignedOffCount: account.signatoriesSignedOffCount,
                descriptionLink: account.descriptionLink,
                name: account.name,
                voteType: account.voteType,
                options,
                denyVoteWeight: account?.denyVoteWeight ? parseInt(account.denyVoteWeight) : "00",
                reserved1: account.reserved1,
                draftAt: account.draftAt,
                signingOffAt: account.signingOffAt,
                votingAt: account.votingAt,
                votingAtSlot: account.votingAtSlot,
                executionFlags: account.executionFlags,
                vetoVoteWeight: account.vetoVoteWeight,
                abstainVoteWeight: account?.abstainVoteWeight,
                closedAt: account?.closedAt,
                executingAt: account?.executingAt,
                maxVoteWeight: account?.maxVoteWeight,
                maxVotingTime: account?.maxVotingTime,
                startVotingAt: account?.startVotingAt,
                voteThreshold: account?.voteThreshold,
                votingCompletedAt: account?.votingCompletedAt,
            }
        })
    });

    data[programId+"_ProposalV1"] && data[programId+"_ProposalV1"].map((account) => {
        allProposals.push({
            owner: programId === 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw' ? new PublicKey(programId) : null,
            pubkey: new PublicKey(account?.pubkey),
            account:{
                accountType: account.accountType,
                governance: new PublicKey(account.governance),
                governingTokenMint: new PublicKey(account.governingTokenMint),
                state: account.state,
                tokenOwnerRecord: new PublicKey(account.tokenOwnerRecord),
                signatoriesCount: account.signatoriesCount,
                signatoriesSignedOffCount: account.signatoriesSignedOffCount,
                descriptionLink: account.descriptionLink,
                name: account.name,
                voteType: account.voteType,
                reserved1: account.reserved1,
                draftAt: account.draftAt,
                signingOffAt: account.signingOffAt,
                votingAt: account.votingAt,
                votingAtSlot: account.votingAtSlot,
                executionFlags: account.executionFlags,
                vetoVoteWeight: account.vetoVoteWeight,
                abstainVoteWeight: account?.abstainVoteWeight,
                closedAt: account?.closedAt,
                executingAt: account?.executingAt,
                maxVoteWeight: account?.maxVoteWeight,
                maxVotingTime: account?.maxVotingTime,
                startVotingAt: account?.startVotingAt,
                voteThreshold: account?.voteThreshold,
                votingCompletedAt: account?.votingCompletedAt,
                yesVoteCount: account?.yesVoteCount ? parseInt(account.yesVoteCount) : "00",
                noVoteCount: account?.noVoteCount ? parseInt(account.noVoteCount) : "00",
            }
        })
    });
    
    
    if ((!allProposals || allProposals.length <= 0) && realmPk){ // fallback to RPC call is governance not found in index
        const allProps = await getAllProposals(RPC_CONNECTION, new PublicKey(realmOwner), new PublicKey(realmPk));
        for (let item of allProps)
            allProposals.push(item);
    }

    //console.log("allProposals: "+JSON.stringify(allProposals))

    return allProposals;
};