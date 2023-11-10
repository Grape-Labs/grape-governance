import { ApolloClient, InMemoryCache, gql } from '@apollo/client';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { 
    SHYFT_KEY } from '../../utils/grapeTools/constants';

const client = new ApolloClient({
    uri: 'https://programs.shyft.to/v0/graphql/?api_key='+SHYFT_KEY,
    cache: new InMemoryCache(),
  });

function GET_QUERY_PROPOSALS(governanceArray?:string[]){

    if (governanceArray){
        return gql`
        query MyQuery {
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV2(offset: 0, where: {governance: {_in: [${governanceArray.map(pubkey => `"${pubkey}"`).join(', ')}]}}) {
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
            GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV1(offset: 0, where: {governance: {_in: [${governanceArray.map(pubkey => `"${pubkey}"`).join(', ')}]}}) {
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
                GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV2(offset: 0) {
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
                GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV1(offset: 0) {
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

export const getRealmIndexed = async (filterRealm?:any) => {
    if (filterRealm){
        const { data } = await client.query({ query: GET_QUERY_REALM(filterRealm) });
        // normalize data
        const allRules = new Array();
        console.log("data: "+JSON.stringify(data));
        
        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_RealmV2"].map((item) => {
            allRules.push({
                pubkey: new PublicKey(filterRealm),
                //owner: new PublicKey(item.owner),
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

        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_RealmV1"].map((item) => {
            allRules.push({
                pubkey: new PublicKey(filterRealm),
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

        return allRules && allRules[0];
    }
};

export const getAllGovernancesIndexed = async (filterRealm?:any) => {
    if (filterRealm){
        const { data } = await client.query({ query: GET_QUERY_RULES(filterRealm) });
        // normalize data
        const allRules = new Array();
        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_GovernanceV2"].map((item) => {
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

        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_GovernanceV1"].map((item) => {
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

        return allRules;
    }
};

export const getAllTokenOwnerRecordsIndexed = async (filterRealm?:any) => {
    if (filterRealm){
        
        const { data } = await client.query({ query: GET_QUERY_MEMBERS(filterRealm) });
        // normalize data
        const allRules = new Array();
        
        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_TokenOwnerRecordV2"].map((item) => {
            allRules.push({
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

        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_TokenOwnerRecordV1"].map((item) => {
            allRules.push({
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

        return allRules;
        
    }
};

export const getAllProposalsIndexed = async (filterGovernance?:any, realmOwner?:any) => {
    const { data } = await client.query({ query: GET_QUERY_PROPOSALS(filterGovernance) });

    const allProposals = new Array();

    data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV2"].map((account) => {
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
            owner: realmOwner ? new PublicKey(realmOwner) : null,
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

    data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV1"].map((account) => {
        allProposals.push({
            owner: realmOwner ? new PublicKey(realmOwner) : null,
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
    
    return allProposals;
};