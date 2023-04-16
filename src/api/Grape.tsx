import { 
    getRealm, 
    getAllProposals, 
    getGovernance, 
    getGovernanceAccounts, 
    getGovernanceChatMessages, 
    getTokenOwnerRecord, 
    getTokenOwnerRecordsByOwner, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    getGovernanceAccount, 
    getAccountTypes, 
    GovernanceAccountType, 
    tryGetRealmConfig, 
    getRealmConfig,
    InstructionData  } from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { PublicKey, TokenAmount, Connection } from '@solana/web3.js';
import { getAccount, getMint } from '@solana/spl-token-v2'
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletDialogProvider, WalletMultiButton } from "@solana/wallet-adapter-material-ui";
import { WalletError, WalletNotConnectedError } from '@solana/wallet-adapter-base';
import React, { useCallback } from 'react';
import { Link, useParams, useSearchParams } from "react-router-dom";
import { styled, useTheme } from '@mui/material/styles';
import { DataGrid, GridColDef, GridValueGetterParams } from '@mui/x-data-grid';
import Gist from 'react-gist';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { InstructionMapping } from "../utils/grapeTools/InstructionMapping";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import moment from 'moment';

import PropTypes from 'prop-types';
import { 
    PROXY, 
    RPC_CONNECTION,
    TX_RPC_ENDPOINT, 
    GGAPI_STORAGE_POOL, 
    GGAPI_STORAGE_URI } from '../utils/grapeTools/constants';
import { formatAmount, getFormattedNumberToLocale } from '../utils/grapeTools/helpers'

import {
    fetchGovernanceLookupFile,
    getFileFromLookup
} from '../GovernanceCached/CachedStorageHelpers'; 

export function ApiView(props: any){
    const [loading, setLoading] = React.useState(false);
    const [addresses, setAddresses] = React.useState(null);
    const storagePool = GGAPI_STORAGE_POOL;
    const [searchParams, setSearchParams] = useSearchParams();
    const {handlekey} = useParams<{ handlekey: string }>();
    const urlParams = searchParams.get("pkey") || searchParams.get("address") || handlekey;
    const governanceAddress = urlParams;

    let governanceFilterType = 2;
    const startDate = moment(new Date()).subtract(60, "days");
    const endDate = moment(new Date());
    const governanceStartDate = startDate.unix();
    const governanceEndDate = endDate.unix();
    const governancePropsToUse = 2;

    const callGovernanceProposalswithLookup = async() => {
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
                        //console.log("draft at "+Number(item.account?.draftAt))
                        if ((Number(proposal.account?.draftAt) >= governanceStartDate) && 
                            (Number(proposal.account?.draftAt) <= governanceEndDate)){
                                console.log("Skipping Prop "+proposal.pubkey)
                                skipProp = false;
                            }
                    }
                }
            }
            
            if (!skipProp){
                console.log("Proposal "+proposal.pubkey)
                withProp.push(proposal);
                
                for (let votingResults of proposal.votingResults){
                    particantAddresses.push(new PublicKey(votingResults.governingTokenOwner).toBase58())
                //    console.log("results: "+JSON.stringify(votingResults))
                }
            }
            count++;
        }

        
        setAddresses(particantAddresses)
    }


    React.useEffect(() => { 
        if (!loading){
            callGovernanceProposalswithLookup();
        }
    }, []);

    return (
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
    );

}