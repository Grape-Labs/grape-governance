import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { 
    SHYFT_KEY,
    RPC_CONNECTION } from '../../utils/grapeTools/constants';

import BN from 'bignumber.js';

import { 
    getGovernance,
    getProposal,
    getRealm, 
    getAllGovernances,
    getAllProposals, 
    getAllTokenOwnerRecords,
    getTokenOwnerRecordsByOwner, 
    getRealmConfigAddress, 
    tryGetRealmConfig, 
    ProposalTransaction,
    getGovernanceAccounts,
    pubkeyFilter,
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

function findGovOwnerByDao(dao:string) {
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

function GET_QUERY_MEMBERS(realm:string, realmOwner:string, pointer:number, tokenOwner:string){
    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

    if (tokenOwner){
        return gql `
            query MyQuery {
                ${programId}_TokenOwnerRecordV2(offset:"${pointer}", 
                where: {
                    realm: {_eq: "${realm}"}
                    OR: [
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
                    realm: {_eq: "${realm}"}
                    OR: [
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

function GET_QUERY_REALM(realm:string, realmOwner?:string){
    console.log("REALM: "+realm)

    const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    return gql `
        query MyQuery {
            ${programId}_RealmV1(where: {pubkey: {_eq: "${realm}"}}) {
                authority
                communityMint
                config
                name
                reserved
                
            }
            ${programId}_RealmV2(where: {pubkey: {_eq: "${realm}"}}) {
                authority
                communityMint
                config
                name
                reserved
                
            }
        }
        `
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

export const getProposalInstructionsIndexed = async (filterRealm?:any, proposalPk?:any) => {
    
    
    const programId = findGovOwnerByDao(filterRealm)?.owner;

    const allProposalIx = new Array();
    try{
        const { data } = await client.query({ query: GET_QUERY_PROPOSAL_INSTRUCTIONS(proposalPk, programId), fetchPolicy: 'no-cache' });
        
        data[programId+"_ProposalTransactio"] && data[programId+"_ProposalTransactio"].map((item) => {
            if (item?.instructions){
                

                allProposalIx.push({
                    pubkey: new PublicKey(0),
                    account: {
                            pubkey: new PublicKey(item.pubkey),
                            proposal: new PublicKey(proposalPk),
                            executedAt: item.executedAt,
                            executionStatus: item.executionStatus,
                            instructionIndex: item?.instructionIndex,
                            holdUpTime: item.holdUpTime,
                            instructions: item.instructions.map((ixn) => {
                                return {
                                    programId: new PublicKey(ixn.programId),
                                    accounts: ixn.accounts.map((acts) => {
                                        return {
                                            pubkey: new PublicKey(acts.pubkey),
                                            isSigner: acts.isSigner,
                                            isWritable: acts.isWritable,
                                        }
                                    }),
                                    data: ixn.data,
                                }
                            })
                        }
                    }
                )
            
            }
        });
        
        //console.log("allProposalIx Index: "+JSON.stringify(allProposalIx));
    }catch(e){
        console.log("Ix Index Err reverting to RPC "+e);
    }

    
    if ((!allProposalIx || allProposalIx.length <= 0) && filterRealm){ // fallback to RPC call is governance not found in index
        const instructions = await getGovernanceAccounts(
            RPC_CONNECTION,
            new PublicKey(programId),
            ProposalTransaction,
            [pubkeyFilter(1, new PublicKey(proposalPk))!]
        );
        allProposalIx.push(...instructions);
    }
    //console.log("allProposalIx: "+JSON.stringify(allProposalIx));
    return allProposalIx;
    
    
}

export const getRealmIndexed = async (filterRealm?:any) => {
    if (filterRealm){
        const programId = findGovOwnerByDao(filterRealm)?.owner;
        
        const allRealms = new Array();

        try{
            const { data } = await client.query({ query: GET_QUERY_REALM(filterRealm, programId), fetchPolicy: 'no-cache' });
            // normalize data
            
            //console.log("data: "+JSON.stringify(data));
            
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

        //console.log("programId: "+programId);
        //console.log("allRealms: "+JSON.stringify(allRealms));

        if ((!allRealms || allRealms.length <= 0) && filterRealm){ // fallback to RPC call is governance not found in index
            console.log("No indexed realm found reverting to RPC getRealms")
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

export const getAllGovernancesIndexed = async (filterRealm?:any, realmOwner?:any) => {
    //const programId = realmOwner ? realmOwner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    //const programName = findGovOwnerByDao(filterRealm)?.name ? findGovOwnerByDao(filterRealm).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programName = findGovOwnerByDao(filterRealm)?.name ? findGovOwnerByDao(filterRealm).name : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    const programId = realmOwner ? realmOwner : findGovOwnerByDao(filterRealm)?.owner ? findGovOwnerByDao(filterRealm).owner : 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
    
    //console.log("programName: "+programName);

    const allRules = new Array();

    if (filterRealm){
        try{
            const { data } = await client.query({ query: GET_QUERY_RULES(filterRealm, programName), fetchPolicy: 'no-cache' });
            // normalize data
            
            data[programName+"_GovernanceV2"] && data[programName+"_GovernanceV2"].map((item) => {
                allRules.push({
                    pubkey: new PublicKey(item.pubkey),
                    owner: programId,
                    account: {
                        realm: new PublicKey(item.realm),
                        governedAccount: new PublicKey(item.governedAccount),
                        config: item.config, 
                        /*{
                            communityVoteThreshold: item.config.communityVoteThreshold,
                            minCommunityTokensToCreateProposal: new BN(item.config.minCommunityTokensToCreateProposal),
                            minInstructionHoldUpTime: item.config.minInstructionHoldUpTime,
                            baseVotingTime: item.config.baseVotingTime,
                            communityVoteTipping: item.config.communityVoteTipping,
                            minCouncilTokensToCreateProposal: new BN(item.config.minCouncilTokensToCreateProposal),
                            councilVoteThreshold: item.config.councilVoteThreshold,
                            councilVetoVoteThreshold: item.config.councilVetoVoteThreshold,
                            communityVetoVoteThreshold: item.config.communityVetoVoteThreshold,
                            councilVoteTipping: item.config.councilVoteTipping,
                            votingCoolOffTime: item.config.votingCoolOffTime,
                            depositExemptProposalCount: item.config.depositExemptProposalCount,
                        } ,*/
                        activeProposalCount: item.activeProposalCount
                    }
                })
            });

            data[programName+"_GovernanceV1"] && data[programName+"_GovernanceV1"].map((item) => {
                allRules.push({
                    pubkey: new PublicKey(item.pubkey),
                    owner: programId,
                    account: {
                        realm: new PublicKey(item.realm),
                        governedAccount: new PublicKey(item.governedAccount),
                        config: item.config,
                        proposalsCount: item.proposalsCount
                    }
                })
            });
        }catch(e){
            console.log("Error fetching all governances, reverting to RPC");
        }
        
        if (!allRules || allRules.length <= 0){ // fallback to RPC call is governance not found in index

            const rules = await getAllGovernances(RPC_CONNECTION, new PublicKey(programId), new PublicKey(filterRealm));
            for (let item of rules)
                allRules.push(item);
        }
        
        return allRules;
    }
};

export const getTokenOwnerRecordsByOwnerIndexed = async (filterRealm?:any, realmOwner?:any, tokenOwner?:any) => {
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

export const getTokenOwnerRecordsByRealmIndexed = async (filterRealm?:any, realmOwner?:any, tokenOwner?:any) => {

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

export const getAllTokenOwnerRecordsIndexed = async (filterRealm?:any, realmOwner?:any, tokenOwner?:any) => {
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
                    query: GET_QUERY_MEMBERS(filterRealm, programName, x, tokenOwner), fetchPolicy: 'no-cache'});//,
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
                            governingTokenDepositAmount: new BN(item.governingTokenDepositAmount),
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
                            governingTokenDepositAmount: new BN(item.governingTokenDepositAmount),
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

export const getProposalIndexed = async (filterGovernance?:any, realmOwner?:any, realmPk?:any, filterProposal?:any) => {

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
    // default instance
    console.log("Fetching Proposals from Default Governance ProgramID");
    const allProposals = await getAllProposalsIndexed (null, null, null);
    
    // prepare all custom programId instances and pass as a single fetch
    const uniqueOwners = [];
    govOwners.forEach(govOwner => {
        const { owner, name, dao } = govOwner;
        const uniqueOwner = { owner, name, dao };
        if (!uniqueOwners.some(u => u.owner === owner)) {
        uniqueOwners.push(uniqueOwner);
        }
    });
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


export const getVoteRecordsIndexed = async (proposalPk?:any, realmOwner?:any, realmPk?:any) => {
    
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
        
        if ((!indexedRecord || indexedRecord.length <= 0) && realmPk){ // fallback to RPC call is governance not found in index
            console.log("Using RPC getVoteRecords");
            const voteRecords = await getVoteRecords({
                connection: RPC_CONNECTION,
                programId: new PublicKey(programId),
                proposalPk: new PublicKey(proposalPk),
            });
            //console.log("RPC voteRecord: "+JSON.stringify(voteRecords));
            return voteRecords;
        } else{

            console.log("VoteRecords: "+JSON.stringify(indexedRecord));
            return indexedRecord;
        }
}