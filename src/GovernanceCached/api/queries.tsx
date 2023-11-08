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
            config
            governedAccount
            lamports
            proposalsCount
            realm
            }
        }
        `
}

export const getAllGovernancesIndexed = async (filterRealm?:any) => {
    if (filterRealm){
        const { data } = await client.query({ query: GET_QUERY_RULES(filterRealm) });
        // normalize data
        const allRules = new Array();

        data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_GovernanceV2"].map((item) => {
            allRules.push({
                pubkey: item.pubkey,
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
                pubkey: item.pubkey,
                account: {
                    realm: new PublicKey(item.realm),
                    governedAccount: new PublicKey(item.governedAccount),
                    config: item.config,
                    activeProposalCount: item.activeProposalCount
                }
            })
        });

        return allRules;
    }
};

export const getAllProposalsIndexed = async (filterGovernance?:any) => {
    const { data } = await client.query({ query: GET_QUERY_PROPOSALS(filterGovernance) });

    const allProposals = new Array();

    data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV2"].map((item) => {
        allProposals.push({
            pubkey: item.pubkey,
            account: {
                item
            }
        })
    });

    data["GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw_ProposalV1"].map((item) => {
        allProposals.push({
            pubkey: item.pubkey,
            account: {
                item
            }
        })
    });

    return allProposals;
};