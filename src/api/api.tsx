import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import React from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";

import moment from 'moment';

import { 
    PROXY, 
    RPC_CONNECTION,
    TX_RPC_ENDPOINT, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';

import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from '../GovernanceCached/CachedStorageHelpers'; 

export function ApiView(props: any){
    const [loading, setLoading] = React.useState(false);
    const [addresses, setAddresses] = React.useState([]);
    const storagePool = GGAPI_STORAGE_POOL;
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const {querytype} = useParams<{ querytype: string }>();
    const {queryvar1} = useParams<{ queryvar1: string }>();
    const {queryvar2} = useParams<{ queryvar2: string }>();

    const urlParams = searchParams.get("address") || handlekey;
    const governanceAddress = urlParams;

    let governanceFilterType = querytype ? +querytype : 2;
    let daysAgo = queryvar1 ? +queryvar1 : 60;
    
    let governancePropsToUse = 2;
    if (governanceFilterType === 1)
        governancePropsToUse = queryvar1 ? +queryvar1 : 2;
    
    let votingPowerRequired = queryvar2 ? +queryvar2 : 0;

    //console.log("governanceAddress "+governanceAddress)
    //console.log("handlekey "+handlekey)
    //console.log("querytype "+querytype)
    //console.log("queryvar1 "+queryvar1)
    //console.log("queryvar2 "+queryvar2)

    let startDate = moment(new Date()).subtract(daysAgo, "days");
    let endDate = moment(new Date());
    const governanceStartDate = startDate.unix();
    const governanceEndDate = endDate.unix();
    
    const callGovernanceProposalswithLookup = async() => {
        setLoading(true);
        const fglf = await fetchGovernanceLookupFile(storagePool);
        const withProp = new Array();

        let particantAddresses = new Array();
        let governanceProposals = null;
        let cached_governance = null;
        let cached_members = null;
        console.log("checking "+governanceAddress);
        for (var governance of fglf){
            if (governance.governanceAddress === governanceAddress){
                if (governance?.memberFilename){
                    cached_members = await getFileFromLookup(governance.memberFilename, storagePool);
                }
                cached_governance = await getFileFromLookup(governance.filename, storagePool);
            }
        }

        // parse the results
        let count = 0;
        console.log(cached_governance.length+" Governances Fetched")
        for (var proposal of cached_governance){
            let skipProp = false;
            
            if (governanceFilterType === 1){
                if (count >= governancePropsToUse)
                    skipProp = true;
            } else if (governanceFilterType === 2){
                if (governanceStartDate && governanceEndDate){
                    if (governanceStartDate < governanceEndDate){
                        skipProp = true;
                        // check if proposal draft date is within start/end
                        if (proposal.account?.draftAt){
                            //console.log("date: "+proposal.account.draftAt)
                            //console.log("draft at "+moment.unix(Number("0x"+proposal.account.draftAt)).format("YYYY-MM-DD") + " vs "+moment.unix(governanceStartDate).format("YYYY-MM-DD")+" < "+moment.unix(governanceEndDate).format("YYYY-MM-DD"))
                            //console.log("draft at "+(Number("0x"+proposal.account.draftAt)) + " vs "+(governanceStartDate)+" < "+(governanceEndDate))
                            if ((Number("0x"+proposal.account?.draftAt) >= Number(governanceStartDate)) && 
                                (Number("0x"+proposal.account?.draftAt) <= Number(governanceEndDate))){
                                    //console.log("Using Prop "+proposal.pubkey)
                                    skipProp = false;
                                }
                        }
                    }
                }
            }
            
            if (!skipProp){
                //console.log("Proposal "+proposal.pubkey)
                withProp.push(proposal);
                
                for (let votingResults of proposal.votingResults){
                    let skipRecord = false;
                    if (votingPowerRequired > 0){ 
                        let voterWeight = votingResults.vote.voterWeight/Math.pow(10, votingResults.vote.decimals);
                        if (voterWeight >= votingPowerRequired){
                            skipRecord = false;
                            //console.log("Pushing ("+votingResults.governingTokenOwner+"): "+voterWeight)    
                        } else{
                            skipRecord = true;
                            //console.log("Skipping ("+votingResults.governingTokenOwner+"): "+voterWeight)    
                        }
                        
                    }

                    if (!skipRecord){
                        var found = false;
                        for (let existingVoter of particantAddresses){ // supress duplicates
                            if (existingVoter === new PublicKey(votingResults.governingTokenOwner).toBase58())
                                found = true;
                        }

                        if (!found)
                            particantAddresses.push(new PublicKey(votingResults.governingTokenOwner).toBase58())
                    }
                }
            }
            count++;
        }
        setAddresses(particantAddresses)
        setLoading(false);
    }


    React.useEffect(() => { 
        if (!loading){
            callGovernanceProposalswithLookup();
        }
    }, []);

    return (
        <>
        {addresses.map((item: any, index:number) => (
            <>{index>0 && `,`}{item}</>
        ))}
        
        {/*
        <>
        {!loading ?
            <>
            {addresses ?
                <>
                    {addresses.map((item: any, index:number) => (
                        <>{index>0 && `,`}{item}</>
                    ))}
                </>
            :
                <>
                </>
            }
            </>
            :<>Loading</>
            }
        </>*/}
        </>
    );

}