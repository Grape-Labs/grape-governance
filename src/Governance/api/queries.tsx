import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { PublicKey, MemcmpFilter } from '@solana/web3.js';
//import gql from 'graphql-tag';
import { 
    RPC_CONNECTION } from '../../utils/grapeTools/constants';

import { initGrapeGovernanceDirectory } from '../api/gspl_queries';

import BN from 'bignumber.js';

import { 
    getGovernance,
    getProposal,
    getRealm, 
    getRealms,
    getAllGovernances,
    getAllProposals, 
    getAllTokenOwnerRecords,
    getTokenOwnerRecordsByOwner, 
    getRealmConfigAddress, 
    tryGetRealmConfig, 
    ProposalTransaction,
    getGovernanceAccounts,
    getNativeTreasuryAddress,
    pubkeyFilter,
    SignatoryRecord,
    getRealmConfig  } from '@solana/spl-governance';

import { getVoteRecords } from '../../utils/governanceTools/getVoteRecords';

export const govOwners = [
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
        owner: 'JPGov2SBA6f7XSJF5R4Si5jEJekGiyrwP2m7gSEqLUs',
        name: 'Jet_Custody',
        dao: 'ATnhhZJ74xg4mzxDyNQ5YAE1BZ98PhrhAsMS4xNXquvX'
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
    {
        owner: 'hgovkRU6Ghe1Qoyb54HdSLdqN7VtxaifBzRmh9jtd3S',
        name: 'Helium',
        dao: '2VfPJn8ML1hNBnsEBo7SzmG11UJc7gbY8b23A3K8expd'
    },
    {
        owner: 'MGovW65tDhMMcpEmsegpsdgvzb6zUwGsNjhXFxRAnjd',
        name: 'MEAN_DAO',
        dao: '5o6gEoeJBpuXT1H1ijFTq3KcSGx7ayabdG2hji7cB3FG'
    },
    {
        owner: 'J9uWvULFL47gtCPvgR3oN7W357iehn5WF2Vn9MJvcSxz',
        name: 'Orca',
        dao: '66Du7mXgS2KMQBUk6m9h3TszMjqZqdWhsG3Duuf69VNW'
    },
    {
        owner: 'ALLGnZikNaJQeN4KCAbDjZRSzvSefUdeTpk18yfizZvT',
        name: 'ALLOVR_DAO',
        dao: 'A7nud4wxpAySc7Ai11vwXtkez79tHvcEvSquFBxw4iDh'
    },
    {
        owner: 'AEauWRrpn9Cs6GXujzdp1YhMmv2288kBt3SdEcPYEerr',
        name: 'Metaplex_DAO',
        dao: 'DA5G7QQbFioZ6K33wQcH8fVdgFcnaDjLD7DLQkapZg5X'
    },
    {
        owner: 'GMpXgTSJt2nJ7zjD1RwbT2QyPhKqD2MjAZuEaLsfPYLF',
        name: 'Metaplex_Genesis',
        dao: 'Cdui9Va8XnKVng3VGZXcfBFF6XSxbqSi2XruMc7iu817'
    },
    {
        owner: 'GmtpXy362L8cZfkRmTZMYunWVe8TyRjX5B7sodPZ63LJ',
        name: 'Metaplex_Found',
        dao: '2sEcHwzsNBwNoTM1yAXjtF1HTMQKUAXf8ivtdpSpo9Fv'
    },
    {
        owner: 'AVoAYTs36yB5izAaBkxRG67wL1AMwG3vo41hKtUSb8is',
        name: 'Serum',
        dao: '3MMDxjv1SzEFQDKryT7csAvaydYtrgMAc3L9xL9CVLCg'
    },
    {
        owner: '5hAykmD4YGcQ7Am3N7nC9kyELq6CThAkU82nhNKDJiCy',
        name: 'SOCEAN',
        dao: '759qyfKDMMuo9v36tW7fbGanL63mZFPNbhU7zjPrkuGK'
    },
    {
        owner: 'jdaoDN37BrVRvxuXSeyR7xE5Z9CAoQApexGrQJbnj6V',
        name: 'JungleDeFi_DAO',
        dao: '5g94Ver64ruf9CGBL3k2oQGdKCUt4QKjN7NQojSrHAwH'
    },
    {
        owner: 'jtogvBNH3WBSWDYD5FJfQP2ZxNTuf82zL8GkEhPeaJx',
        name: 'Jito',
        dao: 'jjCAwuuNpJCNMLAanpwgJZ6cdXzLPXe2GfD6TaDQBXt'
    },
]

export function findGovOwnerByDao(dao:string, programId?:string) {
    const matchingGovOwner = govOwners.find((govOwner) => govOwner.dao === dao);
    if (!matchingGovOwner)
        return {
            name: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
            owner: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
            dao: dao
        }
    else
        return matchingGovOwner;
    //console.log("found: "+JSON.stringify(matchingGovOwner));
}

    /*
       'HT19EcD68zn7NoCF79b2ucQF8XaMdowyPt5ccS6g1PUx': 'Ratio_Finance',
       'GCockTxUjxuMdojHiABVZ5NKp6At8eTKDiizbPjiCo4m': 'Chicken_Tribe',
       'gUAedF544JeE6NYbQakQvribHykUNgaPJqcgf3UQVnY': 'Ukraine_SOL',
       'Ghope52FuF6HU3AAhJuAAyS2fiqbVhkAotb7YprL5tdS': 'RadRugsDAO',
       'A7kmu2kUcnQwAVn8B4znQmGJeUrsJ1WEhYVMtmiBLkEr': 'Solend_DAO',
    */


const client = new ApolloClient({
    //uri: 'https://programs.shyft.to/v0/graphql/?api_key='+SHYFT_KEY,
    uri: 'https://grape.shyft.to/v1/graphql/',
    cache: new InMemoryCache(),
    headers: {
        'Accept-Encoding': 'gzip'
    }
});

function GET_QUERY_PROPOSAL_INSTRUCTIONS(proposalPk?:string, realmOwner?:string){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    return gql`
        query MyQuery {
            ${programId}_ProposalTransactio(
            where: {proposal: {_eq: "${proposalPk}"}}
            ) {
                executedAt
                executionStatus
                holdUpTime
                instructions
                lamports
                optionIndex
                proposal
                instructionIndex
                pubkey
            }
        }
    `;
}

// This will show all votes casted by the governingTokenOwner in general
function GET_QUERY_VOTERRECORDS_BY_TOKENOWNER(realmOwner?:string, realmPk?:string, tokenOwner?:string){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    return gql`
        query MyQuery {
            ${programId}_VoteRecordV2(limit: 5000, where: {governingTokenOwner: {_eq: "${tokenOwner}"}}) {
                pubkey
                proposal
                governingTokenOwner
                isRelinquished,
                voterWeight,
                vote
            }
            ${programId}_VoteRecordV1(limit: 5000, where: {governingTokenOwner: {_eq: "${tokenOwner}"}}) {
                governingTokenOwner
                isRelinquished
                lamports
                proposal
                voteWeight
            }
        }
    `;
}

function GET_QUERY_VOTERRECORDS(proposalPk?:string, realmOwner?:string){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    return gql`
        query MyQuery {
            ${programId}_VoteRecordV2(limit: 100, where: {proposal: {_eq: "${proposalPk}"}}) {
                pubkey
                proposal
                governingTokenOwner
                isRelinquished,
                voterWeight,
                vote
            }
            ${programId}_VoteRecordV1(limit: 100, where: {proposal: {_eq: "${proposalPk}"}}) {
                governingTokenOwner
                isRelinquished
                lamports
                proposal
                voteWeight
            }
        }
    `;
}

function GET_QUERY_PROPOSAL(proposalPk?:string, realmOwner?:string){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
 
    return gql`
        query MyQuery {
            ${programId}_ProposalV2_by_pk(pubkey: ${proposalPk}) {
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
            ${programId}_ProposalV1_by_pk(pubkey: ${proposalPk}) {
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

function GET_QUERY_PROPOSALS(governanceArray?:string[], realmOwner?:string, programIds?:any[]){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    if (governanceArray){
        return gql`
            query MyQuery {
                ${programId}_ProposalV2(offset: 0, order_by: {draftAt: desc}, where: {governance: {_in: [${governanceArray.map(pubkey => `"${pubkey}"`).join(', ')}]}}) {
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
                ${programId}_ProposalV1(offset: 0, order_by: {draftAt: desc}, where: {governance: {_in: [${governanceArray.map(pubkey => `"${pubkey}"`).join(', ')}]}}) {
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
        
        if (programIds && programIds.length > 0){
            let query = ``;
            let cnt = 0;
            for (var item of programIds){
                //if (cnt < 2)
                query += `
                    ${item.name}_ProposalV2(offset: 0, order_by: {draftAt: desc}) {
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
                    ${item.name}_ProposalV1(offset: 0, order_by: {draftAt: desc}) {
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
                `
                
                cnt++;
                
            } 
            return gql`query MyQuery {${query}}`;
        }


        if (!programIds){
            return gql`
                query MyQuery {
                    ${programId}_ProposalV2(offset: 0, order_by: {draftAt: desc}) {
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
                    ${programId}_ProposalV1(offset: 0, order_by: {draftAt: desc}) {
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
}

function GET_QUERY_GOVERNANCE_BY_PUBKEY(rulesWallet: string, realmOwner?: string) {
    const programId = realmOwner ?? 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    return gql`
        query GovernanceByPubkey {
            ${programId}_GovernanceV2(where: { pubkey: { _eq: "${rulesWallet}" } }) {
                pubkey
                realm
            }
            ${programId}_GovernanceV1(where: { pubkey: { _eq: "${rulesWallet}" } }) {
                pubkey
                realm
            }
        }
    `;
}

function GET_QUERY_REALM_NAME(realm: string, realmOwner?: string) {
    const programId = realmOwner ?? 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    return gql`
        query RealmName {
            ${programId}_RealmV2(where: { pubkey: { _eq: "${realm}" } }) {
                name
                communityMint
            }
            ${programId}_RealmV1(where: { pubkey: { _eq: "${realm}" } }) {
                name
                communityMint
            }
        }
    `;
}

function GET_QUERY_RULES(realm:string, realmOwner:string){

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    return gql `
        query MyQuery {
            ${programId}_GovernanceV2(limit: 100, where: {realm: {_eq: "${realm}"}}) {
            pubkey
            realm
            reserved
            lamports
            governedAccount
            config
            activeProposalCount
            }
            ${programId}_GovernanceV1(limit:100, where: {realm: {_eq: "${realm}"}}) {
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

function GET_QUERY_MEMBERS(realm:string, realmOwner:string, pointer:number, tokenOwner:string, governingTokenMint?:string){
    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    if (tokenOwner && governingTokenMint){
        return gql `
            query MyQuery {
                ${programId}_TokenOwnerRecordV2(offset:${pointer}, 
                where: {
                    _and: [
                        { realm: {_eq: "${realm}"} },
                        { governingTokenOwner: { _eq: "${tokenOwner}" } },
                        { governingTokenMint: { _eq: "${governingTokenMint}" } }
                      ]
                }) {
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
                ${programId}_TokenOwnerRecordV1(offset:${pointer},
                where: {
                    _and: [
                        { realm: {_eq: "${realm}"} },
                        { governingTokenOwner: { _eq: "${tokenOwner}" } },
                        { governingTokenMint: { _eq: "${governingTokenMint}" } }
                    ]
                }) {
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
    } else if (tokenOwner){
        return gql `
            query MyQuery {
                ${programId}_TokenOwnerRecordV2(offset:"${pointer}", 
                where: {
                    _and: [
                        { realm: {_eq: "${realm}"} }, 
                        { governingTokenOwner: { _eq: "${tokenOwner}" } },
                        { governanceDelegate: { _eq: "${tokenOwner}" } }
                    ]
                }) {
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
                ${programId}_TokenOwnerRecordV1(offset:"${pointer}",
                where: {
                    _and: [
                        { realm: {_eq: "${realm}"} }, 
                        { governingTokenOwner: { _eq: "${tokenOwner}" } },
                        { governanceDelegate: { _eq: "${tokenOwner}" } }
                    ]
                }) {
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
    } else {
        return gql `
            query MyQuery {
                ${programId}_TokenOwnerRecordV2(offset:"${pointer}", 
                where: {
                    realm: {_eq: "${realm}"}
                }) {
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
                ${programId}_TokenOwnerRecordV1(offset:"${pointer}",
                where: {
                    realm: {_eq: "${realm}"}
                }) {
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
}

function GET_QUERY_REALMS(realmOwner?: string) {
  console.log("realmOwner:", realmOwner);

  const programId = realmOwner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

  return gql`
    query GetRealm {
      ${programId}_RealmV1 {
        pubkey
        authority
        communityMint
        config
        name
        reserved
      }
      ${programId}_RealmV2 {
        pubkey
        authority
        communityMint
        config
        name
        reserved
      }
    }
  `;
}

function GET_QUERY_REALM(realm?: string, realmOwner?: string) {
  console.log("realm:", realm);
  console.log("realmOwner:", realmOwner);

  const programId = realmOwner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

  const realmFilter = realm ? `(where: {pubkey: {_eq: "${realm}"}})` : '';

  return gql`
    query GetRealm {
      ${programId}_RealmV1${realmFilter} {
        pubkey
        authority
        communityMint
        config
        name
        reserved
      }
      ${programId}_RealmV2${realmFilter} {
        pubkey
        authority
        communityMint
        config
        name
        reserved
      }
    }
  `;
}

function GET_QUERY_ALL_TOKEN_OWNER_RECORDS(owner:string, realmOwner?:string){
    console.log("TokenOwner: "+owner)

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    return gql `
        query MyQuery {
            ${programId}_TokenOwnerRecordV1(where: {governingTokenOwner: {_eq: "${owner}"}}) {
                governingTokenOwner
                governingTokenMint
                governingTokenDepositAmount
                governanceDelegate
                lamports
                outstandingProposalCount
                pubkey
                realm
                reserved
                unrelinquishedVotesCount
                version
            }
            ${programId}_TokenOwnerRecordV2(where: {governingTokenOwner: {_eq: "${owner}"}}) {
                governanceDelegate
                governingTokenDepositAmount
                governingTokenMint
                governingTokenOwner
                lamports
                outstandingProposalCount
                pubkey
                realm
                reserved
                unrelinquishedVotesCount
                version
            }
        }
        `
}

export const getProposalInstructionsIndexed = async (filterRealm?: string, proposalPk?: string) => {
    const programId = findGovOwnerByDao(filterRealm)?.owner;
    const allProposalIx = [];

    let fallbackToRPC = false;

    try {
        const { data } = await client.query({
            query: GET_QUERY_PROPOSAL_INSTRUCTIONS(proposalPk, programId),
            fetchPolicy: 'no-cache',
        });

        const gqlKey = `${programId}_ProposalTransactio`;
        const indexedResults = data?.[gqlKey] || [];

        for (const item of indexedResults) {
            if (item?.instructions) {
                allProposalIx.push({
                    pubkey: new PublicKey(item.pubkey), // Placeholder — actual pubkey not included in GraphQL result
                    account: {
                        proposal: new PublicKey(proposalPk),
                        executedAt: item.executedAt,
                        executionStatus: item.executionStatus,
                        instructionIndex: item.instructionIndex,
                        holdUpTime: item.holdUpTime,
                        instructions: item.instructions.map((ixn) => ({
                            programId: new PublicKey(ixn.programId),
                            accounts: ixn.accounts.map((acts) => ({
                                pubkey: new PublicKey(acts.pubkey),
                                isSigner: acts.isSigner,
                                isWritable: acts.isWritable,
                            })),
                            data: ixn.data,
                        })),
                    },
                });
            }
        }
    } catch (e) {
        console.warn("GraphQL error for ProposalInstructions — falling back to RPC:", e);
        fallbackToRPC = true;
    }

    if (fallbackToRPC) {
        const rpcResults = await getGovernanceAccounts(
            RPC_CONNECTION,
            new PublicKey(programId),
            ProposalTransaction,
            [pubkeyFilter(1, new PublicKey(proposalPk))!]
        );
        allProposalIx.push(...rpcResults);
    }

    return allProposalIx;
};

export const getRealmsIndexed = async (programId?:string) => {
    if (programId){
        const allRealms = new Array();

        try{
            console.log("getRealmsIndexed: "+programId);
            const { data } = await client.query({ query: GET_QUERY_REALMS(programId), fetchPolicy: 'no-cache' });
            
            data[programId+"_RealmV2"] && data[programId+"_RealmV2"]?.map((item) => {
                allRealms.push({
                    pubkey: new PublicKey(item.pubkey),
                    owner: new PublicKey(programId),
                    account: {
                        realm: new PublicKey(item.pubkey),
                        authority: item?.authority ? new PublicKey(item.authority) : ``,
                        communityMint: new PublicKey(item.communityMint),
                        config: {
                            councilMint: item.config?.councilMint ? new PublicKey(item.config.councilMint) : ``,
                            communityMintMaxVoteWeightSource: {
                                type:item.config.communityMintMaxVoteWeightSource.type,
                                value:new BN(item.config.communityMintMaxVoteWeightSource.value)
                            },
                            minCommunityTokensToCreateGovernance: new BN(item.config.minCommunityTokensToCreateGovernance),
                            useCommunityVoterWeightAddin: item.config.useCommunityVoterWeightAddin,
                            useMaxCommunityVoterWeightAddin: item.config.useMaxCommunityVoterWeightAddin,
                            reserved: item.config.reserved,
                        },
                        name: item.name,
                    }
                })
            });

            data[programId+"_RealmV1"] && data[programId+"_RealmV1"]?.map((item) => {
                allRealms.push({
                    pubkey: new PublicKey(item.pubkey),
                    owner: new PublicKey(programId),
                    account: {
                        realm: new PublicKey(item.pubkey),
                        authority: item?.authority ? new PublicKey(item.authority) : ``,
                        communityMint: new PublicKey(item.communityMint),
                        config: {
                            councilMint: item.config?.councilMint ? new PublicKey(item.config.councilMint) : ``,
                            communityMintMaxVoteWeightSource: {
                                type:item.config.communityMintMaxVoteWeightSource.type,
                                value:new BN(item.config.communityMintMaxVoteWeightSource.value)
                            },
                            minCommunityTokensToCreateGovernance: new BN(item.config.minCommunityTokensToCreateGovernance),
                            useCommunityVoterWeightAddin: item.config.useCommunityVoterWeightAddin,
                            useMaxCommunityVoterWeightAddin: item.config.useMaxCommunityVoterWeightAddin,
                            reserved: item.config.reserved,
                        },
                        name: item.name,
                    }
                })
            });
        }catch(e){

            console.log("Realm Index Err reverting to RPC ",e);
        }

       if ((!allRealms || allRealms.length <= 0) && (programId)){ // fallback to RPC call is governance not found in index
                console.log("No indexed realm found reverting to RPC getRealm")
                const realm = await getRealms(RPC_CONNECTION, [new PublicKey(programId)]);
                allRealms.push(realm);
        } else{
            console.log("Indexed realm found!")
        }

        //console.log("allRealms: "+JSON.stringify(allRealms));        
        return allRealms;
    }
};

export const getRealmIndexed = async (filterRealm?:string, program?:string) => {
    if (filterRealm || program){
        const programId = program || findGovOwnerByDao(filterRealm)?.owner;
        
        const allRealms = new Array();

        try{
            const { data } = await client.query({ query: GET_QUERY_REALM(filterRealm, programId), fetchPolicy: 'no-cache' });
            // normalize data
            
            //console.log("data: "+JSON.stringify(data));
            
            data[programId+"_RealmV2"] && data[programId+"_RealmV2"]?.map((item) => {
                allRealms.push({
                    pubkey: new PublicKey(item.pubkey),
                    owner: new PublicKey(programId),
                    account: {
                        authority: new PublicKey(item.authority),
                        communityMint: new PublicKey(item.communityMint),
                        config: {
                            councilMint: new PublicKey(item.config.councilMint),
                            communityMintMaxVoteWeightSource: {
                                type:item.config.communityMintMaxVoteWeightSource.type,
                                value:new BN(item.config.communityMintMaxVoteWeightSource.value)
                            },
                            minCommunityTokensToCreateGovernance: new BN(item.config.minCommunityTokensToCreateGovernance),
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

            data[programId+"_RealmV1"] && data[programId+"_RealmV1"]?.map((item) => {
                allRealms.push({
                    pubkey: new PublicKey(item.pubkey),
                    owner: new PublicKey(programId),
                    account: {
                        authority: new PublicKey(item.authority),
                        communityMint: new PublicKey(item.communityMint),
                        config: {
                            councilMint: new PublicKey(item.config.councilMint),
                            communityMintMaxVoteWeightSource: {
                                type:item.config.communityMintMaxVoteWeightSource.type,
                                value:new BN(item.config.communityMintMaxVoteWeightSource.value)
                            },
                            minCommunityTokensToCreateGovernance: new BN(item.config.minCommunityTokensToCreateGovernance),
                            useCommunityVoterWeightAddin: item.config.useCommunityVoterWeightAddin,
                            useMaxCommunityVoterWeightAddin: item.config.useMaxCommunityVoterWeightAddin,
                            reserved: item.config.reserved,
                        },
                        name: item.name,
                        //votingProposalCount: item.votingProposalCount
                    }
                })
            });
        }catch(e){
            console.log("Realm Index Err reverting to RPC");
        }

       if ((!allRealms || allRealms.length <= 0) && (filterRealm || programId)){ // fallback to RPC call is governance not found in index
                console.log("No indexed realm found reverting to RPC getRealm")
                const realm = await getRealm(RPC_CONNECTION, new PublicKey(filterRealm));
                allRealms.push(realm);
        } else{
            console.log("Indexed realm found!")
        }

        console.log("allRealms: "+JSON.stringify(allRealms));        
        return allRealms && allRealms[0];
    }
};

export const getGovernanceIndexed = async (filterRealm?:any, realmOwner?:any, governancePk?:any) => {
    const allgovs = await getAllGovernancesIndexed(filterRealm, realmOwner);
    if (allgovs){
        for (let item of allgovs){
            if (item.pubkey.toBase58() === governancePk){
                return item;
            }
        }
    }
}

export const getAllGovernancesIndexed = async (filterRealm?: string, realmOwner?: string) => {
    const allRules = [];

    const programName = realmOwner
        ? realmOwner
        : findGovOwnerByDao(filterRealm)?.name || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    const programId = realmOwner
        ? realmOwner
        : findGovOwnerByDao(filterRealm)?.owner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    try {
        const query = filterRealm
            ? GET_QUERY_RULES(filterRealm, programName)
            : gql`
                query AllGovernances {
                    ${programName}_GovernanceV2(limit: 500) {
                        pubkey
                        realm
                        reserved
                        lamports
                        governedAccount
                        config
                        activeProposalCount
                    }
                    ${programName}_GovernanceV1(limit: 500) {
                        pubkey
                        config
                        governedAccount
                        lamports
                        proposalsCount
                        realm
                    }
                }
            `;

        const { data } = await client.query({ query, fetchPolicy: 'no-cache' });

        data[programName + "_GovernanceV2"]?.forEach((item) => {
            allRules.push({
                pubkey: new PublicKey(item.pubkey),
                owner: programId,
                account: {
                    realm: new PublicKey(item.realm),
                    governedAccount: new PublicKey(item.governedAccount),
                    config: item.config,
                    activeProposalCount: item.activeProposalCount
                }
            });
        });

        data[programName + "_GovernanceV1"]?.forEach((item) => {
            allRules.push({
                pubkey: new PublicKey(item.pubkey),
                owner: programId,
                account: {
                    realm: new PublicKey(item.realm),
                    governedAccount: new PublicKey(item.governedAccount),
                    config: item.config,
                    proposalsCount: item.proposalsCount
                }
            });
        });
    } catch (e) {
        console.log("Error fetching governances from index, reverting to RPC", e);

        if (filterRealm) {
            const rules = await getAllGovernances(RPC_CONNECTION, new PublicKey(programId), new PublicKey(filterRealm));
            for (let item of rules)
                allRules.push(item);
        }
    }

    return allRules;
};

export const getTokenOwnerRecordsByOwnerIndexed = async (filterRealm?:string, realmOwner?:string, tokenOwner?:string) => {
    const programId = findGovOwnerByDao(filterRealm)?.name ? findGovOwnerByDao(filterRealm).name : realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const { data } = await client.query({ query: GET_QUERY_ALL_TOKEN_OWNER_RECORDS(tokenOwner, realmOwner), fetchPolicy: 'no-cache' });

    const allResults = new Array();
    data[programId+"_TokenOwnerRecordV1"] && data[programId+"_TokenOwnerRecordV1"].map((item) => {
        allResults.push({
            owner: new PublicKey(programId),
            pubkey: new PublicKey(item.pubkey),
            account: {
                realm: new PublicKey(item.realm),
                accountType: item.accountType,
                governingTokenMint: new PublicKey(item.governingTokenMint),
                governingTokenOwner: new PublicKey(item.governingTokenOwner),
                governanceDelegate: item?.governanceDelegate ? new PublicKey(item.governanceDelegate):null,
                governingTokenDepositAmount: new BN(item.governingTokenDepositAmount),
                unrelinquishedVotesCount: item.unrelinquishedVotesCount,
                totalVotesCount: item.totalVotesCount,
                outstandingProposalCount: item.outstandingProposalCount,
                reserved: item.reserved,
                version: item.version
            }
        })
    });

    data[programId+"_TokenOwnerRecordV2"] && data[programId+"_TokenOwnerRecordV2"].map((item) => {
        allResults.push({
            owner: new PublicKey(programId),
            pubkey: new PublicKey(item.pubkey),
            account: {
                realm: new PublicKey(item.realm),
                accountType: item.accountType,
                governingTokenMint: new PublicKey(item.governingTokenMint),
                governingTokenOwner: new PublicKey(item.governingTokenOwner),
                governanceDelegate: item?.governanceDelegate ? new PublicKey(item.governanceDelegate):null,
                governingTokenDepositAmount: new BN(item.governingTokenDepositAmount),
                unrelinquishedVotesCount: item.unrelinquishedVotesCount,
                totalVotesCount: item.totalVotesCount,
                outstandingProposalCount: item.outstandingProposalCount,
                reserved: item.reserved,
                version: item.version
            }
        })
    });

    //console.log("data results indexed: "+JSON.stringify(allResults));
    
    if (!allResults){
        const allResultsRPC = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, new PublicKey(realmOwner), new PublicKey(tokenOwner));
        return allResultsRPC;
    }

    return allResults;
}

export const getTokenOwnerRecordsByRealmIndexed = async (filterRealm?:string, realmOwner?:string, tokenOwner?:string) => {

    const allTokenOwnerRecords = await getAllTokenOwnerRecordsIndexed (filterRealm, realmOwner);
    const ownerRecords = new Array();
    if (allTokenOwnerRecords && allTokenOwnerRecords.length > 0){
        for (var item of allTokenOwnerRecords){
            if (item.account.governingTokenOwner.toBase58() === tokenOwner ||
                (item.account?.governanceDelegate && item.account?.governanceDelegate?.toBase58() === tokenOwner)){
                ownerRecords.push(item);
            }
        }
    }

    if (!ownerRecords){
        //ownerRecords = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, new PublicKey(realmOwner), new PublicKey(tokenOwner));
    }

    return ownerRecords;
}

export const getAllTokenOwnerRecordsIndexed = async (filterRealm?:string, realmOwner?:string, tokenOwner?:string, governingTokenMint?:string) => {
    //const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    //const programName = realmOwner ? realmOwner : findGovOwnerByDao(filterRealm)?.name ? findGovOwnerByDao(filterRealm).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programName = findGovOwnerByDao(filterRealm)?.name ? findGovOwnerByDao(filterRealm).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(filterRealm)?.owner ? findGovOwnerByDao(filterRealm).owner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    if (filterRealm){
        let allResults = new Array();

        try{
            
            let hasMore = true;
            // consider how to iterate vs using RPC
            let x = 0;
            while (hasMore){
                console.log("Fetching tokenOwnerRecords page: "+x);
                const { data } = await client.query({ 
                    query: GET_QUERY_MEMBERS(filterRealm, programName, x, tokenOwner, governingTokenMint), fetchPolicy: 'no-cache'});//,
                    //variables: { first: 1000, after: x } });
                
                /*
                if (finalData && finalData.length  > 0){
                    finalData = [...finalData,...data];
                }else{
                    finalData = data;
                }*/
                
                hasMore = false;
                if (data[programName+"_TokenOwnerRecordV2"] && data[programName+"_TokenOwnerRecordV2"].length >= 1000){
                    hasMore = true;
                    console.log("found more v2");
                } else if (data[programName+"_TokenOwnerRecordV1"] && data[programName+"_TokenOwnerRecordV1"].length >= 1000) {
                    hasMore = true;
                    console.log("found more v1");
                } else {
                    hasMore = false;
                }

                data[programName+"_TokenOwnerRecordV2"] && data[programName+"_TokenOwnerRecordV2"].map((item) => {
                    allResults.push({
                        //owner: new PublicKey(item.owner),
                        pubkey: new PublicKey(item.pubkey),
                        account: {
                            realm: new PublicKey(item.realm),
                            accountType: item?.accountType,
                            governingTokenMint: new PublicKey(item.governingTokenMint),
                            governingTokenOwner: new PublicKey(item.governingTokenOwner),
                            governanceDelegate: item?.governanceDelegate ? new PublicKey(item.governanceDelegate):null,
                            governingTokenDepositAmount: new BN(item.governingTokenDepositAmount?.toString() || "0"),
                            unrelinquishedVotesCount: item.unrelinquishedVotesCount,
                            totalVotesCount: item.totalVotesCount,
                            outstandingProposalCount: item.outstandingProposalCount,
                            reserved: item.reserved,
                            version: item.version
                        }
                    })
                });
    
                data[programName+"_TokenOwnerRecordV1"] && data[programName+"_TokenOwnerRecordV1"].map((item) => {
                    allResults.push({
                        //owner: new PublicKey(item.owner),
                        pubkey: new PublicKey(item.pubkey),
                        account: {
                            realm: new PublicKey(item.realm),
                            accountType: item?.accountType,
                            governingTokenMint: new PublicKey(item.governingTokenMint),
                            governingTokenOwner: new PublicKey(item.governingTokenOwner),
                            governanceDelegate: item?.governanceDelegate ? new PublicKey(item.governanceDelegate):null,
                            governingTokenDepositAmount: new BN(item.governingTokenDepositAmount?.toString() || "0"),
                            unrelinquishedVotesCount: item.unrelinquishedVotesCount,
                            totalVotesCount: item.totalVotesCount,
                            outstandingProposalCount: item.outstandingProposalCount,
                            reserved: item.reserved,
                            version: item.version
                        }
                    })
                });

                x += 1000;
            }
            

            //console.log("allResults: "+JSON.stringify(allResults));
            // remove this once we properly iterate
            //if (allResults.length >= 1000)
            //    allResults = null;
        }catch(e){
            console.log("Error fetching token owner records, reverting to RPC");
        }

        if (!allResults || allResults.length <= 0){ // fallback to RPC call is governance not found in index
            console.log("No Members in Index attempting RPC");
            const rpcResults = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(programId), new PublicKey(filterRealm));
            return rpcResults;
            //allResults.push(...results);
        }

        //console.log("allResults "+JSON.stringify(allResults))
        return allResults;
        
    }
};



export const getProposalIndexed = async (filterGovernance?:any, realmOwner?:string, realmPk?:string, filterProposal?:string) => {

    let proposal = null;
    //const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk).owner;
    
    console.log("filterGovernance: "+filterGovernance);

    const allProposals = await getAllProposalsIndexed (filterGovernance, realmOwner, realmPk);

    try{
        if (allProposals && allProposals.length > 0 && allProposals[0].length > 1){
            //console.log("allProposals here: "+JSON.stringify(allProposals))
            for (var item of allProposals[0]){
                if (new PublicKey(item.pubkey).toBase58() === filterProposal){
                    proposal = item;
                }
            }
        } else if (allProposals && allProposals.length > 0){
            //console.log("allProposals here: "+JSON.stringify(allProposals))
            for (var item of allProposals){
                if (new PublicKey(item.pubkey).toBase58() === filterProposal){
                    proposal = item;
                }
            }
        }
    }catch(e){
        console.log("Single Prop ERR: "+e);
    }

    if (filterProposal){
        if (!proposal){ // fallback to RPC call is governance not found in index
            const prop = await getProposal(RPC_CONNECTION, new PublicKey(filterProposal));
            return prop;
        }
    }

    //console.log("allProposals: "+JSON.stringify(allProposals))
    return proposal;
}

export const getAllProposalsFromAllPrograms = async () => {
    const uniqueOwners = [];
    govOwners.forEach(govOwner => {
        const { owner, name, dao } = govOwner;
        const uniqueOwner = { owner, name, dao };
        if (!uniqueOwners.some(u => u.owner === owner)) {
            uniqueOwners.push(uniqueOwner);
        }
    });

    // default instance
    console.log("Fetching Proposals from Default Governance ProgramID");
    const allProposals = await getAllProposalsIndexed (null, null, null);

    console.log("allProposals: "+JSON.stringify(allProposals))

    // passing uniqueOwners array will do everything in a single call
    console.log("Fetching Proposals from Custom Governance Deployments");
    const batch_props = await getAllProposalsIndexed(null, null, null, uniqueOwners); 
    allProposals.push(...batch_props);
    /*
    for (var owner of uniqueOwners){
        console.log("Fetching Proposals from ProgramID: "+owner.name);
        const props = await getAllProposalsIndexed(null, owner.name, null);
        allProposals.push(...props);
    }
    */
    //console.log("allProposals: "+JSON.stringify(allProposals))

    // show up to the latest 1k props
    let resProps = allProposals;
    //if (allProposals.length > 3000)
    //    resProps = allProposals.slice(0, 3000);

    return resProps;
}

export const getAllGovernancesFromAllPrograms = async () => {
    const uniqueOwners = [];
    govOwners.forEach(govOwner => {
        const { owner, name, dao } = govOwner;
        const uniqueOwner = { owner, name, dao };
        if (!uniqueOwners.some(u => u.owner === owner)) {
            uniqueOwners.push(uniqueOwner);
        }
    });

    console.log("Fetching Governances from Default Governance ProgramID");
    const defaultGovernances = await getAllGovernancesIndexed(null, null).catch(() => []);

    console.log("Fetching Governances from Custom Governance Deployments");
    const customGovernanceBatches = await Promise.all(
        uniqueOwners.map((ownerItem) =>
            getAllGovernancesIndexed(null, ownerItem.name).catch(() => [])
        )
    );

    const allGovernances = [
        ...(Array.isArray(defaultGovernances) ? defaultGovernances : []),
        ...customGovernanceBatches.flat(),
    ];

    const deduped = [];
    const seenGovernanceKeys = new Set<string>();
    for (const governance of allGovernances) {
        const governancePk = governance?.pubkey?.toBase58?.();
        if (!governancePk || seenGovernanceKeys.has(governancePk)) continue;
        seenGovernanceKeys.add(governancePk);
        deduped.push(governance);
    }

    return deduped;
}

export const getAllProposalsIndexed = async (filterGovernance?:any, realmOwner?:any, realmPk?:any, uniqueOwners?:string[]) => {
    
    //console.log("realmOwner: " +realmOwner);
    //const programName = realmOwner ? realmOwner : findGovOwnerByDao(realmPk)?.name ? findGovOwnerByDao(realmPk).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programName = findGovOwnerByDao(realmPk)?.name ? findGovOwnerByDao(realmPk).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk)?.owner ? findGovOwnerByDao(realmPk).owner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const allProposals = new Array();

    try{

        //console.log("programId: "+programId);

        const { data } = await client.query({ query: GET_QUERY_PROPOSALS(filterGovernance, programName, uniqueOwners), fetchPolicy: 'no-cache' });
        if (uniqueOwners && data){
            for (var ownerItem of uniqueOwners){
                data[ownerItem.name+"_ProposalV2"] && data[ownerItem.name+"_ProposalV2"].map((account) => {
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
                        owner: new PublicKey(ownerItem.owner),
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
    
                data[ownerItem.name+"_ProposalV1"] && data[ownerItem.name+"_ProposalV1"].map((account) => {
                    allProposals.push({
                        owner: new PublicKey(ownerItem.owner),
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
            }   
        } else if (data){
            data[programName+"_ProposalV2"] && data[programName+"_ProposalV2"].map((account) => {
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

            data[programName+"_ProposalV1"] && data[programName+"_ProposalV1"].map((account) => {
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
        }
    } catch(e){
        console.log("Prop Index Err Reverting to RPC")
    }
    
    if ((!allProposals || allProposals.length <= 0) && realmPk){ // fallback to RPC call is governance not found in index
        const allProps = await getAllProposals(RPC_CONNECTION, new PublicKey(programId), new PublicKey(realmPk));
        if (allProps && allProps.length > 0)
            return allProps;
    } else{
        return allProposals;
    }
};

export const getProposalNewIndexed = async (proposalPk?:any, realmOwner?:any, realmPk?:any) => {

    //const programName = realmOwner ? realmOwner : findGovOwnerByDao(realmPk)?.name ? findGovOwnerByDao(realmPk).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programName = findGovOwnerByDao(realmPk)?.name ? findGovOwnerByDao(realmPk).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk)?.owner ? findGovOwnerByDao(realmPk).owner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    const indexedProp = new Array();

    try{

        const { data } = await client.query({ query: GET_QUERY_PROPOSAL(proposalPk, realmOwner), fetchPolicy: 'no-cache' });
        {
            data[programName+"_ProposalV2"] && data[programName+"_ProposalV2"].map((account) => {
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
                
                indexedProp.push({
                    owner: programId,
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

            data[programName+"_ProposalV1"] && data[programName+"_ProposalV1"].map((account) => {
                indexedProp.push({
                    owner: programId,
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
        }
    } catch(e){
        console.log("New Prop Index Err Reverting to RPC")
    }
    
    
    if ((!indexedProp || indexedProp.length <= 0) && realmPk){ // fallback to RPC call is governance not found in index
        const prop = await getProposal(RPC_CONNECTION, new PublicKey(proposalPk));
        return prop;
    } else{
        return indexedProp[0];
    }
};

export const getVoteRecordsByVoterIndexed = async (realmOwner?:any, realmPk?:any, tokenOwner?:any) => {
    const programName = findGovOwnerByDao(realmPk)?.name ? findGovOwnerByDao(realmPk).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk)?.owner ? findGovOwnerByDao(realmPk).owner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    const indexedRecord = new Array();

    try{
       // const { data } = await client.query({ query: GET_QUERY_VOTERRECORDS(proposalPk, realmOwner), fetchPolicy: 'no-cache' });
        const { data } = await client.query({ query: GET_QUERY_VOTERRECORDS_BY_TOKENOWNER(programId, realmPk, tokenOwner), fetchPolicy: 'no-cache' });
        {
            data[programName+"_VoteRecordV2"] && data[programName+"_VoteRecordV2"].map((account) => {
                indexedRecord.push({
                    owner: programId,
                    pubkey: new PublicKey(account?.pubkey),
                    account:{
                        accountType: account?.accountType || 12,
                        proposal: new PublicKey(account.proposal),
                        governingTokenOwner: new PublicKey(account.governingTokenOwner),
                        isRelinquished: account.isRelinquiched,
                        voterWeight: account.voterWeight,
                        vote: account.vote,
                    }
                })
            });

            data[programName+"_VoteRecordV1"] && data[programName+"_VoteRecordV1"].map((account) => {
                indexedRecord.push({
                    owner: programId,
                    pubkey: new PublicKey(account?.pubkey),
                    account:{
                        accountType: account?.accountType || 12,
                        proposal: new PublicKey(account.proposal),
                        governingTokenOwner: new PublicKey(account.governingTokenOwner),
                        isRelinquished: account.isRelinquiched,
                        voteWeight: account.voteWeight
                    }
                })
            });
        }

        console.log("VoteRecords: "+JSON.stringify(indexedRecord));
        return indexedRecord;
    } catch(e){
        console.log("Vote Record Index Err Cannot revert to RPC (no avail call atm)");
    }
}

export const getVoteRecordsIndexed = async (proposalPk?:any, realmOwner?:any, realmPk?:any, donotfallback?:boolean) => {
    
    const programName = findGovOwnerByDao(realmPk)?.name ? findGovOwnerByDao(realmPk).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(realmPk)?.owner ? findGovOwnerByDao(realmPk).owner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    const indexedRecord = new Array();

    try{
        
        const { data } = await client.query({ query: GET_QUERY_VOTERRECORDS(proposalPk, realmOwner), fetchPolicy: 'no-cache' });
            {
                data[programName+"_VoteRecordV2"] && data[programName+"_VoteRecordV2"].map((account) => {
                    indexedRecord.push({
                        owner: programId,
                        pubkey: new PublicKey(account?.pubkey),
                        account:{
                            accountType: account?.accountType || 12,
                            proposal: new PublicKey(account.proposal),
                            governingTokenOwner: new PublicKey(account.governingTokenOwner),
                            isRelinquished: account.isRelinquiched,
                            voterWeight: account.voterWeight,
                            vote: account.vote,
                        }
                    })
                });

                data[programName+"_VoteRecordV1"] && data[programName+"_VoteRecordV1"].map((account) => {
                    indexedRecord.push({
                        owner: programId,
                        pubkey: new PublicKey(account?.pubkey),
                        account:{
                            accountType: account?.accountType || 12,
                            proposal: new PublicKey(account.proposal),
                            governingTokenOwner: new PublicKey(account.governingTokenOwner),
                            isRelinquished: account.isRelinquiched,
                            voteWeight: account.voteWeight
                        }
                    })
                });
            }
        } catch(e){
            console.log("Vote Record Index Err Reverting to RPC");
        }
        
        if ((!indexedRecord || indexedRecord.length <= 0) && realmPk && !donotfallback){ // fallback to RPC call is governance not found in index
            console.log("Using RPC getVoteRecords");
            const voteRecords = await getVoteRecords({
                connection: RPC_CONNECTION,
                programId: new PublicKey(programId),
                proposalPk: new PublicKey(proposalPk),
            });
            //console.log("RPC voteRecord: "+JSON.stringify(voteRecords));
            return voteRecords;
        } else{
            //console.log("VoteRecords: "+JSON.stringify(indexedRecord));
            return indexedRecord;
        }
}

function GET_QUERY_SIGNATORYRECORDS(proposalPk?: string, realmOwner?: string) {
    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    return gql `
        query MyQuery {
            ${programId}_SignatoryRecordV2(limit: 100, where: { proposal: { _eq: "${proposalPk}" } }) {
                pubkey
                proposal
                signatory
                signedOff
                slot
                lamports
            }
            ${programId}_SignatoryRecordV1(limit: 100, where: { proposal: { _eq: "${proposalPk}" } }) {
                pubkey
                proposal
                signatory
                signedOff
                slot
                lamports
            }
        }
    `;
}

export const getSignatoryRecordsIndexed = async (proposalPk?: any, realmOwner?: any, realmPk?: any) => {
    const programName = findGovOwnerByDao(realmPk)?.name
        ? findGovOwnerByDao(realmPk).name
        : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner
        ? realmOwner
        : findGovOwnerByDao(realmPk)?.owner
        ? findGovOwnerByDao(realmPk).owner
        : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    const indexedRecord = [];
    try {
        const { data } = await client.query({
            query: GET_QUERY_SIGNATORYRECORDS(proposalPk, realmOwner),
            fetchPolicy: 'no-cache',
        });

        if (data[programName + '_SignatoryRecordV2']) {
            data[programName + '_SignatoryRecordV2'].forEach((account) => {
                indexedRecord.push({
                    owner: programId,
                    pubkey: new PublicKey(account.pubkey),
                    account: {
                        proposal: new PublicKey(account.proposal),
                        signatory: new PublicKey(account.signatory),
                        signedOff: account.signedOff,
                        slot: account.slot,
                        lamports: account.lamports,
                    },
                });
            });
        }

        if (data[programName + '_SignatoryRecordV1']) {
            data[programName + '_SignatoryRecordV1'].forEach((account) => {
                indexedRecord.push({
                    owner: programId,
                    pubkey: new PublicKey(account.pubkey),
                    account: {
                        proposal: new PublicKey(account.proposal),
                        signatory: new PublicKey(account.signatory),
                        signedOff: account.signedOff,
                        slot: account.slot,
                        lamports: account.lamports,
                    },
                });
            });
        }
    } catch (e) {
        console.log('Signatory Record Index Err. Falling back to RPC...');
        const memcmpFilter = {
                memcmp: {
                    offset: 1,
                    bytes: new PublicKey(proposalPk).toBase58(),
                },
            };
        
            const filters: MemcmpFilter[] = [
                memcmpFilter,
            ];
        
            const filter = pubkeyFilter(1, new PublicKey(proposalPk))
            const signatoryResults = await getGovernanceAccounts(
                RPC_CONNECTION,
                programId,
                SignatoryRecord,
                [filter]
            );

            return signatoryResults;
    }

    return indexedRecord;
};

function GET_QUERY_REALMCONFIG(realmConfigPk?: string, realmOwner?: string) {
    const programId = realmOwner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    const queryStr = `
        query GetRealmConfig {
            ${programId}_RealmConfig(where: { realm: { _eq: "${realmConfigPk}" } }) {
                realm
                communityTokenConfig
                councilTokenConfig
                lamports
                reserved
                slot
            }
        }
    `;

    return gql`${queryStr}`;
}

function resolvePublicKeyString(value?: any): string | null {
    if (!value) return null;
    try {
        if (typeof value === 'string') {
            const normalized = value.trim();
            if (!normalized || normalized === 'null' || normalized === 'undefined') return null;
            return new PublicKey(normalized).toBase58();
        }
        if (value?.toBase58) return value.toBase58();
        return null;
    } catch {
        return null;
    }
}

export const getRealmConfigIndexed = async (realmConfigPk?: any, realmOwner?: any, realmPk?: any) => {
    const resolvedRealmPk = resolvePublicKeyString(realmConfigPk) || resolvePublicKeyString(realmPk);
    if (!resolvedRealmPk) return null;

    const resolvedRealmOwner = resolvePublicKeyString(realmOwner);
    const programId = resolvedRealmOwner || findGovOwnerByDao(resolvedRealmPk)?.owner || 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programName = findGovOwnerByDao(resolvedRealmPk)?.name || programId;
    const explicitRealmConfigAddress = resolvePublicKeyString(realmConfigPk);

    const fetchViaRpcFallback = async () => {
        if (explicitRealmConfigAddress){
            const realmConfig = await getRealmConfig(
                RPC_CONNECTION,
                new PublicKey(explicitRealmConfigAddress)
            )
            return realmConfig;
        }

        if (programId && resolvedRealmPk){
            const realmConfig = await tryGetRealmConfig(
                RPC_CONNECTION,
                new PublicKey(programId),
                new PublicKey(resolvedRealmPk)
            );
            return realmConfig;
        }

        return null;
    };

    try {
        const { data } = await client.query({
            query: GET_QUERY_REALMCONFIG(resolvedRealmPk, programId),
            fetchPolicy: 'no-cache',
        });

        const result = data?.[programName + '_RealmConfig']?.[0];

        if (!result) {
            // Common for newly-created realms while indexers catch up.
            return await fetchViaRpcFallback();
        }

        return {
            owner: programId,
            pubkey: new PublicKey(result.realm),
            account: {
                communityTokenConfig: result.communityTokenConfig,
                councilTokenConfig: result.councilTokenConfig,
                lamports: result.lamports,
                reserved: result.reserved,
                slot: result.slot,
            },
        };
    } catch (e) {
        console.warn('Failed to fetch RealmConfig via Shyft index. Consider falling back to RPC.');
        return await fetchViaRpcFallback();
    }
};

export async function fetchRealmNameFromRulesWallet(
    rulesWallet: string,
    realmOwner: string = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw'
): Promise<{ realm: string; name: string } | null> {
    try {
        const { data: governanceData } = await client.query({
            query: GET_QUERY_GOVERNANCE_BY_PUBKEY(rulesWallet, realmOwner),
            fetchPolicy: 'no-cache',
        });

        const realm =
            governanceData?.[`${realmOwner}_GovernanceV2`]?.[0]?.realm ||
            governanceData?.[`${realmOwner}_GovernanceV1`]?.[0]?.realm;

        if (!realm) return null;

        const { data: realmData } = await client.query({
            query: GET_QUERY_REALM_NAME(realm, realmOwner),
            fetchPolicy: 'no-cache',
        });

        const name =
            realmData?.[`${realmOwner}_RealmV2`]?.[0]?.name ||
            realmData?.[`${realmOwner}_RealmV1`]?.[0]?.name;

        return name ? { realm, name } : null;
    } catch (err) {
        console.warn(`Failed to resolve realm name for rules wallet ${rulesWallet}:`, err);
        return null;
    }
}

function GET_QUERY_LATEST_PROPOSALS(programName: string, limit = 5000) {
  return gql`
    query LatestProposals {
      ${programName}_ProposalV2(limit: ${limit}, order_by: {draftAt: desc}) {
        pubkey
        governance
        draftAt
        state
      }
      ${programName}_ProposalV1(limit: ${limit}, order_by: {draftAt: desc}) {
        pubkey
        governance
        draftAt
        state
      }
    }
  `;
}

function GET_QUERY_REALM_UNIQUE_MEMBERS(programName: string, realm: string, limit = 50000) {
  return gql`
    query RealmUniqueMembers {
      ${programName}_TokenOwnerRecordV2(
        where: { realm: { _eq: "${realm}" } }
        distinct_on: governingTokenOwner
        limit: ${limit}
      ) {
        governingTokenOwner
      }
      ${programName}_TokenOwnerRecordV1(
        where: { realm: { _eq: "${realm}" } }
        distinct_on: governingTokenOwner
        limit: ${limit}
      ) {
        governingTokenOwner
      }
    }
  `;
}

type DirectoryItem = {
  governanceAddress: string;
  governanceName: string;
  communityMint?: string;
  councilMint?: string;
  totalMembers: number;
  totalProposals: number;
  totalProposalsVoting: number;
  lastProposalDate: string; // keep string
  timestamp: number;
  gspl?: any;
};

function toHexLike(ts: any) {
  // your current UI does: Number("0x"+item.lastProposalDate)
  // so we store a hex string WITHOUT the 0x prefix.
  // If ts is already hex-ish, keep it.
  if (ts == null) return "0";
  if (typeof ts === "string") {
    // Shyft sometimes gives "0x..." or plain number string
    const s = ts.startsWith("0x") ? ts.slice(2) : ts;
    // if it's numeric string, convert to hex
    if (/^\d+$/.test(s)) return Number(s).toString(16);
    return s;
  }
  if (typeof ts === "number") return ts.toString(16);
  return "0";
}

function toNum(x: any): number {
  const n = typeof x === "string" ? Number(x) : Number(x);
  return Number.isFinite(n) ? n : -1;
}

function isVotingState(state: any) {
  // SPL Governance voting is typically state=2, but some indexers may return string enums.
  const normalized = String(state ?? "").trim().toUpperCase();
  if (normalized === "VOTING") return true;
  return toNum(state) === 2;
}

function govKey(x: any): string {
  return x?.toBase58?.() || (typeof x === "string" ? x : String(x || ""));
}

export async function buildDirectoryFromGraphQL(options?: {
  includeMembers?: boolean;
  proposalScanLimit?: number;
}) {
  const proposalScanLimit = options?.proposalScanLimit ?? 0;

  const allProps = await getAllProposalsFromAllPrograms();
  const all = Array.isArray(allProps) ? allProps : [];

  const props =
    proposalScanLimit && proposalScanLimit > 0
      ? all
          .slice()
          .sort((a: any, b: any) => toNum(b?.account?.draftAt) - toNum(a?.account?.draftAt))
          .slice(0, proposalScanLimit)
      : all;

  const votingProposalsByGovernance: Record<string, any[]> = {};
  const latestByGov: Record<string, number> = {};
  const totalProposalsByGovernance: Record<string, number> = {};

  for (const p of props) {
    const acct = p?.account;
    if (!acct) continue;

    const governancePk = govKey(acct?.governance);
    if (!governancePk) continue;

    const draftAt = Math.max(0, toNum(acct?.draftAt));
    totalProposalsByGovernance[governancePk] =
      (totalProposalsByGovernance[governancePk] || 0) + 1;
    if (!latestByGov[governancePk] || draftAt > latestByGov[governancePk]) {
      latestByGov[governancePk] = draftAt;
    }

    if (!isVotingState(acct?.state)) continue;

    const parsedVotingAt = acct?.votingAt != null ? toNum(acct.votingAt) : -1;
    const parsedMaxVotingTime = acct?.maxVotingTime != null ? toNum(acct.maxVotingTime) : -1;
    const votingAt = parsedVotingAt > 0 ? parsedVotingAt : null;
    const maxVotingTime = parsedMaxVotingTime > 0 ? parsedMaxVotingTime : null;

    const votingEndsAt =
      votingAt != null && maxVotingTime != null ? votingAt + maxVotingTime : null;

    (votingProposalsByGovernance[governancePk] ||= []).push({
      pubkey: p?.pubkey?.toBase58?.() || String(p?.pubkey),
      name: acct?.name || "",
      state: toNum(acct?.state),
      votingAt,
      votingEndsAt,
      draftAt,
    });
  }

  for (const gov of Object.keys(votingProposalsByGovernance)) {
    votingProposalsByGovernance[gov].sort(
      (a, b) => {
        const voteSort = toNum(b.votingAt) - toNum(a.votingAt);
        if (voteSort !== 0) return voteSort;
        return toNum(b.draftAt) - toNum(a.draftAt);
      }
    );
  }

  const governanceKeys = new Set([
    ...Object.keys(totalProposalsByGovernance),
    ...Object.keys(votingProposalsByGovernance),
  ]);

  const directory = Array.from(governanceKeys).map((governanceAddress) => ({
    governanceAddress,
    totalProposals: totalProposalsByGovernance[governanceAddress] || 0,
    totalProposalsVoting: (votingProposalsByGovernance[governanceAddress] || []).length,
    lastProposalDate: toHexLike(latestByGov[governanceAddress] || 0),
  }));

  return { directory, votingProposalsByGovernance };
}
