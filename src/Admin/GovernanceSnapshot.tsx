import React, { useEffect, useState, useCallback, memo, Suspense } from "react";
import axios from "axios";
import { getRealm, getAllProposals, getGovernance, getProposal, getInstructionDataFromBase64, getGovernanceAccounts, getGovernanceChatMessages, getTokenOwnerRecord, getTokenOwnerRecordsByOwner, getAllTokenOwnerRecords, getRealmConfigAddress, getGovernanceAccount, getAccountTypes, GovernanceAccountType, tryGetRealmConfig, getRealmConfig  } from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';

import {
    Box,
    TextField,
    Button,
    ButtonGroup,
    LinearProgress,
    Typography,
    Stack,
    Tooltip,
    Autocomplete,
    Alert
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { LinearProgressProps } from '@mui/material/LinearProgress';

import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ShdwDrive, ShadowFile } from "@shadow-drive/sdk";
import {
    formatBytes
} from '../GovernanceCached/CachedStorageHelpers'; 
import { useSnackbar } from 'notistack';

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from '@solana/wallet-adapter-base';

import { 
    RPC_CONNECTION,
    PROXY,
    HELIUS_API,
    GGAPI_STORAGE_POOL,
    GGAPI_STORAGE_URI,
} from '../utils/grapeTools/constants';

import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import CircularProgress from '@mui/material/CircularProgress';

const GOVERNANCE_STATE = {
    0:'Draft',
    1:'Signing Off',
    2:'Voting',
    3:'Succeeded',
    4:'Executing',
    5:'Completed',
    6:'Cancelled',
    7:'Defeated',
    8:'Executing w/errors!',
}

function LinearProgressWithLabel(props: LinearProgressProps & { value: number }) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress variant="determinate" {...props} />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">{`${Math.round(
            props.value,
          )}%`}</Typography>
        </Box>
      </Box>
    );
  }

export function GovernanceSnapshotView (this: any, props: any) {
	const wallet = useWallet();
    const connection = RPC_CONNECTION;
    
    const [progress, setProgress] = React.useState(0);
    const [status, setStatus] = React.useState(null);
    const [primaryStatus, setPrimaryStatus] = React.useState(null);
    const [helperText, setHelperText] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [fileGenerated, setFileGenerated] = React.useState(null);
    const [csvGenerated, setCSVGenerated] = React.useState(null);
    const [stringGenerated, setStringGenerated] = React.useState(null);
    const [membersStringGenerated, setMembersStringGenerated] = React.useState(null);
    const [governanceAddress, setGovernanceAddress] = React.useState(null);
    const [governanceName, setGovernanceName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [governanceType, setGovernanceType] = React.useState(0);
    const [nftBasedGovernance, setNftBasedGovernance] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [lastProposalDate, setLastProposalDate] = React.useState(null);
    const [totalCouncilProposals, setTotalCouncilProposals] = React.useState(null);
    const [totalProposals, setTotalProposals] = React.useState(null);
    const [totalProposalsVoting, setTotalProposalsVoting] = React.useState(null);
    const [totalPassed, setTotalPassed] = React.useState(null);
    const [totalDefeated, setTotalDefeated] = React.useState(null);
    const [totalVotesCasted, setTotalTotalVotesCasted] = React.useState(null);
    const [proposals, setProposals] = React.useState(null);
    const [jsonGenerated, setJSONGenerated] = React.useState(null);
    const [solanaVotingResultRows,setSolanaVotingResultRows] = React.useState(null);
    const [loadingParticipants, setLoadingParticipants] = React.useState(false);

    const [tokenDecimals, setTokenDecimals] = React.useState(null);
    const [voteType, setVoteType] = React.useState(null);
    const [propVoteType, setPropVoteType] = React.useState(null); // 0 council, 1 token, 2 nft
    const [uniqueYes, setUniqueYes] = React.useState(0);
    const [uniqueNo, setUniqueNo] = React.useState(0);
    const [gist, setGist] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [thisGovernance, setThisGovernance] = React.useState(null);
    const [proposalAuthor, setProposalAuthor] = React.useState(null);
    const [governingMintInfo, setGoverningMintInfo] = React.useState(null);
    const [totalQuorum, setTotalQuorum] = React.useState(null);
    const [quorumTargetPercentage, setQuorumTargetPercentage] = React.useState(null);
    const [quorumTarget, setQuorumTarget] = React.useState(null);
    const [totalSupply, setTotalSupply] = React.useState(null);
    const [exceededQuorum, setExceededQuorum] = React.useState(null);
    const [exceededQuorumPercentage, setExceededQuorumPercentage] = React.useState(null);
    const [selectedDelegate, setSelectedDelegate] = React.useState("");
    const [realm, setRealm] = React.useState(null);
    const [MAX, setMax] = React.useState(100);
    const MIN = 0;
    const [thisDrive, setThisDrive] = React.useState(null);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [governanceAutocomplete, setGovernanceAutocomplete] = React.useState(null);
    const [storageAutocomplete, setStorageAutocomplete] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );

    const getTokens = async () => {
        const tarray:any[] = [];
        try{
            const tlp = await new TokenListProvider().resolve().then(tokens => {
                const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
                const tmap = tokenList.reduce((map, item) => {
                    tarray.push({address:item.address, decimals:item.decimals})
                    map.set(item.address, item);
                    return map;
                },new Map())
                setTokenMap(tmap);
                setTokenArray(tarray);
                return tmap;
            });
        } catch(e){console.log("ERR: "+e)}
    }

    const getGovernanceFromLookup  = async (fileName:string) => {
        const fgl = await fetchGovernanceFile(fileName);
        return fgl;
    }  

    const fetchGovernance = async(address:string) => {
        //const finalList = new Array();
        setLoading(true);
        setProposals(null);
        setStatus("Fetching Governance - Source: Q");
        const connection = RPC_CONNECTION;//new Connection(GRAPE_RPC_ENDPOINT);
        //console.log("Fetching governance "+address);
        const grealm = await getRealm(RPC_CONNECTION, new PublicKey(address))
        setRealm(grealm);

        setPrimaryStatus("Governance Fetched");
        
        //console.log("Governance: "+JSON.stringify(grealm));

        let gTD = null;
        if (tokenMap.get(grealm.account?.communityMint.toBase58())){
            setGovernanceType(0);
            gTD = tokenMap.get(grealm.account?.communityMint.toBase58()).decimals;
            setGoverningTokenDecimals(gTD);
        } else{
            const btkn = await getBackedTokenMetadata(grealm.account?.communityMint.toBase58(), wallet);
            if (btkn){
                setGovernanceType(1);
                gTD = btkn.decimals;
                setGoverningTokenDecimals(gTD)
            } else{
                setGovernanceType(2);
                gTD = 0;
                setGoverningTokenDecimals(gTD);
            }
        }


        setPrimaryStatus("Governance Type Verified");

        const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
        const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
        const realmPk = grealm.pubkey;
        if (grealm?.account?.config?.useCommunityVoterWeightAddin){
            //{
                const realmConfigPk = await getRealmConfigAddress(
                    programId,
                    realmPk
                )
                //console.log("realmConfigPk: "+JSON.stringify(realmConfigPk));
                try{ 
                    const realmConfig = await getRealmConfig(
                        connection,
                        realmConfigPk
                    )
                    //console.log("realmConfig: "+JSON.stringify(realmConfig));
                    
                    const tryRealmConfig = await tryGetRealmConfig(
                        connection,
                        programId,
                        realmPk
                    )
                    
                    //console.log("tryRealmConfig: "+JSON.stringify(tryRealmConfig));
                    //setRealmConfig(realmConfigPK)
                    
                    if (realmConfig && realmConfig?.account && realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin){
                        if (realmConfig?.account?.communityTokenConfig.maxVoterWeightAddin.toBase58() === 'GnftV5kLjd67tvHpNGyodwWveEKivz3ZWvvE3Z4xi2iw'){ // NFT based community
                            setNftBasedGovernance(true);
                        }
                    }
                }catch(errs){
                    console.log("ERR: "+errs)
                }
            }

            setPrimaryStatus("Fetching Token Owner Records");

            // to do get member map
            const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, grealm.owner, realmPk)
            // check #tokens deposited
            setMemberMap(rawTokenOwnerRecords);
            // get unique members


            setPrimaryStatus("Fetching All Proposals");

            const gprops = await getAllProposals(RPC_CONNECTION, grealm.owner, realmPk);
                    
            const allprops: any[] = [];
            let passed = 0;
            let defeated = 0;
            let ttvc = 0;
            let council = 0;
            let voting = 0;
            let count = 0;

            for (const props of gprops){
                for (const prop of props){
                    
                    /*
                    if (count < 1){
                        const prop_details = await getProposal(new Connection(GRAPE_RPC_ENDPOINT), prop.pubkey);
                        console.log("prop_details: "+JSON.stringify(prop_details))
                    }*/

                    // check if community or council
                    if (grealm.account.config?.councilMint && (grealm.account.config?.councilMint.toBase58() === prop.account.governingTokenMint.toBase58()))
                        council++;
                    
                    if (prop){
                        allprops.push(prop);
                        if (prop.account.state === 3 || prop.account.state === 5)
                            passed++;
                        else if (prop.account.state === 7)
                            defeated++;
                        else if (prop.account.state === 2)
                            voting++;
                        
                        if (prop.account?.yesVotesCount && prop.account?.noVotesCount){
                            //console.log("tmap: "+JSON.stringify(tokenMap));
                            //console.log("item a: "+JSON.stringify(prop))
                            if (tokenMap){
                                ttvc += +(((Number(prop.account?.yesVotesCount) + Number(prop.account?.noVotesCount))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                            }
                            
                        } else if (prop.account?.options) {
                            //console.log("item b: "+JSON.stringify(prop))
                            if (tokenMap){
                                ttvc += +(((Number(prop.account?.options[0].voteWeight) + Number(prop.account?.denyVoteWeight))/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                            }
                        }
                    }
                    count++;
                }
            }

            const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.votingAt != null ? b.account?.votingAt : 0) - (a.account?.votingAt != null ? a.account?.votingAt : 0)))
            
            // get first date
            if (sortedResults && sortedResults.length > 0)
                if (sortedResults[0].account?.draftAt)
                    setLastProposalDate(sortedResults[0].account?.draftAt)
            
            setPrimaryStatus("Fetched Governance: "+grealm.account.name+" "+address+" with "+sortedResults.length+" proposals");
            setGovernanceName(grealm.account.name);

            //console.log("proposals: "+JSON.stringify(sortedResults));
            setTotalCouncilProposals(council);
            setTotalDefeated(defeated);
            setTotalPassed(passed);
            setTotalProposalsVoting(voting);
            setTotalProposals(sortedResults.length);
            setTotalTotalVotesCasted(ttvc);

            setProposals(sortedResults);

        setMax(sortedResults.length);
        setLoading(false);
        return sortedResults;
    }

    const getGovernanceProps = async (thisitem) => {
        const governance = await getGovernance(connection, thisitem.account.governance);
        setThisGovernance(governance);
        
        //console.log("realm"+JSON.stringify(realm));
        //console.log("Single governance: "+JSON.stringify(governance));
        //console.log("thisitem "+JSON.stringify(thisitem))

        //const tor = await getTokenOwnerRecord(connection, new PublicKey(publicKey));
        //console.log("tor: "+JSON.stringify(tor));

        try{
            //console.log(">>>> "+JSON.stringify(thisitem.account))
            //const communityMintPromise = connection.getParsedAccountInfo(
            //    new PublicKey(governance.account.config.communityMint?.toBase58())
            //);

            const governingMintPromise = 
                await connection.getParsedAccountInfo(
                    new PublicKey(thisitem.account.governingTokenMint)
                );
            //console.log("communityMintPromise ("+thisitem.account.governingTokenMint+") "+JSON.stringify(governingMintPromise))
            setGoverningMintInfo(governingMintPromise);
            
            const communityWeight = governingMintPromise.value.data.parsed.info.supply - realm.account.config.minCommunityTokensToCreateGovernance.toNumber();
            //console.log("communityWeight: "+communityWeight);
            
            const communityMintMaxVoteWeightSource = realm.account.config.communityMintMaxVoteWeightSource
            const supplyFractionPercentage = communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
            const communityVoteThreshold = governance.account.config.communityVoteThreshold
            const councilVoteThreshold = governance.account.config.councilVoteThreshold
            
            //console.log("supplyFractionPercentage: "+supplyFractionPercentage)
            //console.log("communityVoteThreshold: "+JSON.stringify(communityVoteThreshold))
            //console.log("councilVoteThreshold: "+JSON.stringify(councilVoteThreshold))

            //const mintSupply = governingMintPromise.value.data.data.parsed.info.supply;
            //const mintDecimals = governingMintPromise.value.data.data.parsed.info.decimals; 
            
            const voteThresholdPercentage=
                realm.account.config.councilMint.toBase58() === thisitem.account.governingTokenMint.toBase58()
                ? councilVoteThreshold.value
                : communityVoteThreshold.value
            
            
            const tSupply = Number(governingMintPromise.value.data.parsed.info.supply/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals)) 
            
            setTotalSupply(tSupply);
            
            const totalVotes =
                Number(governingMintPromise.value.data.parsed.info.supply/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals))  *
                //Number(communityWeight/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals))  *
                (voteThresholdPercentage * 0.01) *
                  (Number(supplyFractionPercentage) / 100);
            
            //console.log("totalVotes: "+totalVotes)
            //console.log("voteThresholdPercentage: "+(voteThresholdPercentage * 0.01))
            //console.log("supplyFractionPercentage: "+(Number(supplyFractionPercentage) / 100))
            
            if (totalVotes && totalVotes > 0)
                setTotalQuorum(totalVotes);
            
            const qt = totalVotes-thisitem.account.options[0].voteWeight.toNumber()/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals);
            const yesVotes = thisitem.account.options[0].voteWeight.toNumber()/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals);
            
            const excess = yesVotes - totalVotes;
            
            if (excess > 0){
                setExceededQuorum(excess);
                setExceededQuorumPercentage(excess/totalVotes*100);
            }

            //console.log("yesVotes: "+yesVotes);
            const totalVotesNeeded = Math.ceil(totalVotes - yesVotes);

            if (qt < 0){
                setQuorumTargetPercentage(100);
            }else{
                setQuorumTargetPercentage((totalVotesNeeded / totalVotes) * 100);
                setQuorumTarget(totalVotesNeeded);
            }

        }catch(e){
            console.log('ERR: '+e)
        }
    }

    const fetchProposalData = async(finalList:any, forceSkip:boolean) => {
        let x=0;
        let length = finalList.length;
        setMax(length);
        const normalise = (value:number) => ((value - MIN) * 100) / (length - MIN);

        let cached_governance = new Array();
        if (governanceLookup){
            for (let glitem of governanceLookup){
                if (glitem.governanceAddress === governanceAddress){
                    cached_governance = await getGovernanceFromLookup(glitem.filename);
                }
            }
        }

        //console.log("cached_governance: "+JSON.stringify(cached_governance));

        for (var thisitem of finalList){
            x++;
            setStatus("Fetching "+x+" of "+length);
            
            setProgress((prevProgress) => (prevProgress >= 100 ? 0 : normalise(x)));
            
            try {
                let skip_process = false;
                if (cached_governance.length > 0){
                    for (let cgov of cached_governance){
                        if (cgov.pubkey === thisitem.pubkey.toBase58()){
                            if ((cgov.account.state === 1)||
                                (cgov.account.state === 3)||
                                (cgov.account.state === 4)||
                                (cgov.account.state === 5)||
                                (cgov.account.state === 6)||
                                (cgov.account.state === 7)||
                                (cgov.account.state === 8)){
                                    thisitem.votingResults = cgov.votingResults;
                                    if (!forceSkip)
                                        skip_process = true;
                                }

                                /*
                                    const GOVERNANCE_STATE = {
                                        0:'Draft',
                                        1:'Signing Off',
                                        2:'Voting',
                                        3:'Succeeded',
                                        4:'Executing',
                                        5:'Completed',
                                        6:'Cancelled',
                                        7:'Defeated',
                                        8:'Executing w/errors!',
                                    }
                                */
                        }
                    }
                }
                //console.log("Skipping ("+thisitem.pubkey.toBase58()+"): "+skip_process);
                if (!skip_process){
                    // do magic here...
                    console.log("Fetching proposal details via RPC ("+thisitem.pubkey.toBase58()+")");
                    //console.log("item: "+JSON.stringify(thisitem));

                    //setLoadingParticipants(true);

                    let td = 6; // this is the default for NFT mints
                    let vType = null;
                    try{
                        td = tokenMap.get(thisitem.account.governingTokenMint?.toBase58()).decimals;
                        vType = 'Token';
                        //console.log("tokenMap: "+tokenMap.get(thisitem.account.governingTokenMint?.toBase58()).decimals);
                    }catch(e){
                        //console.log("ERR: "+e);
                    }
                    
                    if (realm.account.config?.councilMint?.toBase58() === thisitem?.account?.governingTokenMint?.toBase58()){
                        vType = 'Council';
                        td = 0;
                    }
                    
                    if (!vType){
                        // check if backed token
                        // important check if we have already fetched this data already
                        const btkn = await getBackedTokenMetadata(thisitem.account.governingTokenMint?.toBase58(), wallet);
                        if (btkn){
                            // get parent token name
                            const parentToken = tokenMap.get(btkn.parentToken);
                            vType = parentToken ? `${parentToken.name} Backed Token` : `Backed Token`;
                            td = btkn.decimals;
                        } else{
                            vType = 'NFT';
                            td = 6;
                        }
                    }
                    setTokenDecimals(td);
                    setVoteType(vType)

                    if (vType){
                        setPropVoteType(vType);
                        
                        //thisitem.account.tokenOwnerRecord;
                        for (const item of memberMap){
                            if (item.pubkey.toBase58() === thisitem.account.tokenOwnerRecord.toBase58()){
                                setProposalAuthor(item.account.governingTokenOwner.toBase58())
                                //console.log("member:" + JSON.stringify(item));
                            }
                        }
                    }

                    //if (thisitem.account?.state === 2){ // if voting state
                        getGovernanceProps(thisitem)
                    //}

                    const voteRecord = await getVoteRecords({
                        connection: connection,
                        programId: new PublicKey(thisitem.owner),
                        proposalPk: new PublicKey(thisitem.pubkey),
                    });

                    const vrs = [];
                    let csvFile = '';
                    let uYes = 0;
                    let uNo = 0;
                    if (voteRecord?.value){
                        let counter = 0;

                        for (let item of voteRecord.value){
                            counter++;
                            //console.log("item: "+JSON.stringify(item))
                            if (item.account?.vote){
                                if (item.account?.vote?.voteType === 0){
                                    uYes++;
                                }else{
                                    uNo++;
                                }
                            } else{
                                if (item.account.voteWeight.yes && item.account.voteWeight.yes > 0){
                                    uYes++;
                                } else{
                                    uNo++;
                                }
                            }

                            vrs.push({
                                id:counter,
                                pubkey:item.pubkey.toBase58(),
                                proposal:item.account.proposal.toBase58(),
                                governingTokenOwner:item.account.governingTokenOwner.toBase58(),
                                voteAddress:item.pubkey.toBase58(),
                                vote:{
                                    vote:item.account.vote,
                                    voterWeight:(item.account?.voterWeight ?  item.account?.voterWeight.toNumber() : null),
                                    legacyYes:(item.account?.voteWeight?.yes ?  item.account?.voteWeight?.yes.toNumber() : null),
                                    legacyNo:(item.account?.voteWeight?.no ?  item.account?.voteWeight?.no.toNumber() : null),
                                    decimals:(realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td),
                                    councilMint:realm.account.config?.councilMint?.toBase58() ,
                                    governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                                }
                            })
                            if (counter > 1)
                                csvFile += '\r\n';
                            else
                                csvFile = 'tokenOwner,uiVotes,voterWeight,tokenDecimals,voteType,proposal\r\n';
                            
                            let voteType = 0;
                            let voterWeight = 0;
                            if (item.account?.voterWeight){
                                voteType = item.account?.vote?.voteType;
                                voterWeight = item.account?.voterWeight.toNumber();
                            } else{
                                if (item.account?.voteWeight?.yes && item.account?.voteWeight?.yes > 0){
                                    voteType = 0
                                    voterWeight = item.account?.voteWeight?.yes
                                }else{
                                    voteType = 1
                                    voterWeight = item.account?.voteWeight?.no
                                }
                            }
                            
                            csvFile += item.account.governingTokenOwner.toBase58()+','+(+((voterWeight)/Math.pow(10, (realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.account.proposal.toBase58()+'';
                            //    csvFile += item.pubkey.toBase58();
                        }
                    }

                    vrs.sort((a:any, b:any) => a?.vote.voterWeight < b?.vote.voterWeight ? 1 : -1); 
                    
                    /*
                    if (thisitem.account?.descriptionLink){
                        try{
                            const url = new URL(thisitem.account?.descriptionLink);
                            const pathname = url.pathname;
                            const parts = pathname.split('/');
                            //console.log("pathname: "+pathname)
                            let tGist = null;
                            if (parts.length > 1)
                                tGist = parts[2];
                            
                            setGist(tGist);

                            const rpd = await resolveProposalDescription(thisitem.account?.descriptionLink);
                            setProposalDescription(rpd);
                        } catch(e){
                            console.log("ERR: "+e)
                        }
                    }
                    */

                    setUniqueYes(uYes);
                    setUniqueNo(uNo);
                    
                    thisitem.votingResults = vrs;
                }
            } catch (e) { // Handle errors from invalid calls
                
            }
        }

        //console.log("finalList: "+JSON.stringify(finalList))
        setSolanaVotingResultRows(finalList)

        return finalList;
    }
    
    const exportFile = async(finalList:string, csvFile:string, fileName:string) => {
        setStatus(`File generated! - ${finalList.length} proposals`);
            const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
                JSON.stringify(finalList)
            )}`;
            
            //console.log("encoded: "+JSON.stringify(finalList))
            
            setStringGenerated(JSON.stringify(finalList));
            setFileGenerated(jsonString);
            
            if (csvFile){
                const jsonCSVString = `data:text/csv;chatset=utf-8,${csvFile}`;
                setCSVGenerated(jsonCSVString);
            }
            //const link = document.createElement("a");
            //link.href = jsonString;
            //link.download = fileName+".json";
            //link.click(); 
    }
    

    const returnJSON = async(generatedString:string, fileName:string) => {
        setStatus("File generated!");
        
        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
            JSON.stringify(generatedString, null, 2)
        )}`;
        
        const bytes = new TextEncoder().encode(jsonString);
        
        const blob_json = new Blob([bytes], {
            type: "application/json;charset=utf-8"
        });

        const blob = new Blob([generatedString], {
            type: "application/text"
        });
        
        const text = await new Response(blob).text()
        //console.log("text: "+text);
        console.log("size: "+blob.size);

        //const url = URL.createObjectURL(blob);
        //console.log("blob size: "+blob.size);
        //const buff = Buffer.from(jsonString);
        //console.log("jsonString: " + JSON.stringify(jsonString));
        //console.log("blob: " + JSON.stringify(blob));
        //console.log("buff: " + JSON.stringify(buff));
        return blob;
    }

    const fileToDataUri = (file:any) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve(event.target.result)
        };
        reader.readAsDataURL(file);
        })
    
    const uploadToStoragePool = async (files: File, storagePublicKey: PublicKey) => { 
        try{
            enqueueSnackbar(`Preparing to upload some files to ${storagePublicKey.toString()}`,{ variant: 'info' });
            const snackprogress = (key:any) => (
                <CircularProgress sx={{padding:'10px'}} />
            );
            const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
            const signedTransaction = await thisDrive.uploadMultipleFiles(storagePublicKey, [files]);
            let count = 0;
            for (var file of signedTransaction){
                if (file.status === "Uploaded."){
                    count++;
                }
            }
            
            closeSnackbar(cnfrmkey);
            const snackaction = (key:any) => (
                <>
                    Uploaded {count} files
                </>
            );
            enqueueSnackbar(`Transaction Confirmed`,{ variant: 'success', action:snackaction });
        }catch(e){
            closeSnackbar();
            enqueueSnackbar(`${JSON.stringify(e)}`,{ variant: 'error' });
            console.log("Error: "+JSON.stringify(e));
            //console.log("Error: "+JSON.stringify(e));
        } 
    }

    const uploadReplaceToStoragePool = async (newFile: File, existingFileUrl: string, storagePublicKey: PublicKey, version: string) => { 
        try{
            enqueueSnackbar(`Preparing to upload/replace some files to ${storagePublicKey.toString()}`,{ variant: 'info' });
            const snackprogress = (key:any) => (
                <CircularProgress sx={{padding:'10px'}} />
            );
            const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
            
            const signedTransaction = await thisDrive.editFile(new PublicKey(storagePublicKey), existingFileUrl, newFile, version || 'v2');
            
            if (signedTransaction?.finalized_location){
                closeSnackbar(cnfrmkey);
                const snackaction = (key:any) => (
                    <Button>
                        File replaced
                    </Button>
                );
                enqueueSnackbar(`Transaction Confirmed`,{ variant: 'success', action:snackaction });
            } else{

            }
        }catch(e){
            closeSnackbar();
            enqueueSnackbar(`${JSON.stringify(e)}`,{ variant: 'error' });
            console.log("Error: "+JSON.stringify(e));
            //console.log("Error: "+JSON.stringify(e));
        } 
    }

    const deleteStoragePoolFile = async (storagePublicKey: PublicKey, file: string, version: string) => { 
        try{
            enqueueSnackbar(`Preparing to delete ${file}`,{ variant: 'info' });
            const snackprogress = (key:any) => (
                <CircularProgress sx={{padding:'10px'}} />
            );
            //console.log(storagePublicKey + "/"+storageAccount+" - file: "+file);
            const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
            
            const signedTransaction = await thisDrive.deleteFile(storagePublicKey, 'https://shdw-drive.genesysgo.net/'+storagePublicKey.toBase58()+'/'+file, version || 'v2');
            console.log("signedTransaction; "+JSON.stringify(signedTransaction))
            
            closeSnackbar(cnfrmkey);
            const snackaction = (key:any) => (
                <Button href={`https://explorer.solana.com/tx/${signedTransaction.txid}`} target='_blank'  sx={{color:'white'}}>
                    {signedTransaction.message}
                </Button>
            );
            enqueueSnackbar(`Transaction Confirmed`,{ variant: 'success', action:snackaction });
            /*
            setTimeout(function() {
                getStorageFiles(storageAccount.publicKey);
            }, 2000);
            */
        }catch(e){
            closeSnackbar();
            enqueueSnackbar(`${e}`,{ variant: 'error' });
            console.log("Error: "+e);
            //console.log("Error: "+JSON.stringify(e));
        } 
    }

    const processGovernance = async(updateAuthority:string) => {
        // Second drive creation (otherwise wallet is not connected when done earlier)
        const drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
        setThisDrive(drive);

        if (governanceAddress){
            let finalList = null;
            setFileGenerated(null);
            
            setLoading(true);
            
            finalList = await fetchGovernance(governanceAddress);
            
            setLoading(false);
        }
    }

    const processProposals = async(finalList:any, forceSkip:boolean) => {
        if (finalList){
            setLoading(true);
            
            const finalProposalList = await fetchProposalData(finalList, forceSkip);
            
            if (finalProposalList){
                
                const csvArrayFile = new Array();
                
                let csvFile = '';
                var counter = 0;
                for (var item of finalList){
                    csvArrayFile.push(item.address);
                    if (counter > 0)
                        csvFile += '\r\n';
                    csvFile += item.address;
                    counter++;
                }
                //setCSVGenerated(csvFile);
                setCSVGenerated(null);
                
                const fileName = governanceAddress+'.json';

                exportFile(finalList, null, fileName);
                // do teh following to get the members
                setMembersStringGenerated(JSON.stringify(memberMap));
            
            }
            
            setLoading(false);
        }
    }

    const fetchGovernanceFile = async(fileName:string) => {
        try{
            const url = GGAPI_STORAGE_URI+"/"+storagePool+'/'+fileName+'';
            const response = await window.fetch(url, {
                method: 'GET',
                headers: {
                }
              });
              const string = await response.text();
              const json = string === "" ? {} : JSON.parse(string);
              return json;
        } catch(e){
            console.log("ERR: "+e)
            return null;
        }
    }

    const fetchGovernanceLookupFile = async() => {
        try{
            const url = GGAPI_STORAGE_URI+"/"+storagePool+'/governance_lookup.json';
            const response = await window.fetch(url, {
                method: 'GET',
                headers: {
                }
              });

              const string = await response.text();
              const json = string === "" ? {} : JSON.parse(string);

              const lookupAutocomplete = new Array();
                for (var item of json){
                    lookupAutocomplete.push({
                        label: item.governanceName,
                        value: item.governanceAddress,
                        totalProposals: item.totalProposals,
                        totalProposalsVoting: item.totalProposalsVoting,
                        lastProposalDate: item.lastProposalDate,
                    });
                }
                setGovernanceAutocomplete(lookupAutocomplete);

              return json;
        } catch(e){
            console.log("ERR: "+e)
            return null;
        }
    }

    const updateGovernanceLookupFile = async(fileName:string, memberFileName:string, timestamp:number, lookupFound:boolean) => {
        // this should be called each time we update with governance
        const storageAccountPK = storagePool;

        const lookup = new Array();
        console.log("Storage Pool: "+storagePool+" | Lookup File found: "+JSON.stringify(lookupFound))
        if (lookupFound){ // update governanceLookup
            // with the file found, lets generate the lookup as an array
            var govFound = false;
            let cntr = 0;

            //console.log("realm: "+JSON.stringify(realm))
            const governingMintDetails = 
                await connection.getParsedAccountInfo(
                    new PublicKey(realm.account.communityMint)
                );

            for (var item of governanceLookup){
                if (item.governanceAddress === governanceAddress){
                    item.version++;
                    item.timestamp = timestamp;
                    item.filename = fileName;
                    item.memberFilename = memberFileName;
                    item.realm = realm;
                    if (realm.account.config?.communityMintMaxVoteWeightSource)
                        item.communityFmtSupplyFractionPercentage = realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
                    item.governance = thisGovernance;
                    item.governingMintDetails = governingMintDetails;
                    item.totalProposals = totalProposals;
                    item.totalProposalsVoting = totalProposalsVoting;
                    item.totalCouncilProposals = totalCouncilProposals;
                    item.lastProposalDate = lastProposalDate;
                    item.tokenSupply = totalSupply;
                    item.totalQuorum = totalQuorum;
                    govFound = true;
                }
                //console.log("size: "+new Set(memberMap).size)
                cntr++;
            }
            console.log("Lookup has "+cntr+" entries");
            if (!govFound){
                let communityFmtSupplyFractionPercentage = null;
                if (realm.account.config?.communityMintMaxVoteWeightSource)
                    communityFmtSupplyFractionPercentage = realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
                //let memberCount = 0;
                //if (memberMap)
                //    memberCount = new Set(memberMap).size; // memberMap.length;

                governanceLookup.push({
                    governanceAddress:governanceAddress,
                    governanceName:governanceName,
                    version:0,
                    timestamp:timestamp,
                    filename:fileName,
                    memberFilename: memberFileName,
                    realm:realm,
                    communityFmtSupplyFractionPercentage: communityFmtSupplyFractionPercentage,
                    governance: thisGovernance,
                    governingMintDetails: governingMintDetails,
                    totalProposals: totalProposals,
                    totalProposalsVoting: totalProposalsVoting,
                    totalCouncilProposals: totalCouncilProposals,
                    lastProposalDate: lastProposalDate,
                    //memberCount: memberCount,
                    tokenSupply: totalSupply,
                    totalQuorum: totalQuorum,
                });
            }
            
            console.log("Replacing Governance Lookup");
            const uploadFile = await returnJSON(JSON.stringify(governanceLookup), "governance_lookup.json");
            const fileStream = blobToFile(uploadFile, "governance_lookup.json");
            const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/governance_lookup.json';
            await uploadReplaceToStoragePool(fileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
        } else{ // create governanceLookup
            lookup.push({
                governanceAddress:governanceAddress,
                governanceName:governanceName,
                version:0,
                timestamp:timestamp,
                filename:fileName
            });
            
            console.log("Uploading new Governance Lookup");
            const uploadFile = await returnJSON(JSON.stringify(lookup), "governance_lookup.json");
            const fileStream = blobToFile(uploadFile, "governance_lookup.json");
            await uploadToStoragePool(fileStream, new PublicKey(storageAccountPK));

            // update autocomplete
            governanceAutocomplete.push({
                label: governanceName, 
                value: governanceAddress,
                totalProposals: totalProposals,
                totalProposalsVoting: totalProposalsVoting,
                lastProposalDate: lastProposalDate
            })

            setGovernanceLookup(lookup);
        }
    }

    function blobToFile(theBlob: Blob, fileName: string){       
        return new File([theBlob], fileName, { lastModified: new Date().getTime(), type: theBlob.type })
    }

    const handleStoragePoolPurge = async () => {
        // deleteStoragePoolFile()
    }

    const handleUploadToStoragePool = async () => {
        const timestamp = Math.floor(new Date().getTime() / 1000);
        const fileName = governanceAddress+'_'+timestamp+'.json';
        const memberFileName = governanceAddress+'_members_'+timestamp+'.json';
        const storageAccountPK = storagePool;
        
        //exportJSON(fileGenerated, fileName);
        console.log("preparing to upload: "+fileName);
        if (!thisDrive){
            const drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
            //console.log("drive: "+JSON.stringify(drive));
            setThisDrive(drive);
            alert("Drive not initialized, initializing now...");
        } else{
            const uploadFile = await returnJSON(stringGenerated, fileName);
            const uploadMembersFile = await returnJSON(membersStringGenerated, fileName);
            //const fileBlob = await fileToDataUri(uploadFile);
            // auto check if this file exists (now we manually do this)
            let found = false;
            let foundMembers = false;
            let lookupFound = false;
            try{
                const response = await thisDrive.listObjects(new PublicKey(storageAccountPK))

                if (response?.keys){
                    for (var item of response.keys){
                        if (item === fileName){
                            found = true;
                        } else if (item === memberFileName){
                            foundMembers = true;
                        } else if (item === 'governance_lookup.json'){
                            lookupFound = true;
                        }
                    }
                }

                // update lookup
                console.log("1. Storage Pool: "+storageAccountPK+" | Lookup");
                
                await updateGovernanceLookupFile(fileName, memberFileName, timestamp, lookupFound);

                // proceed to add propsals
                console.log("2. Storage Pool: "+storageAccountPK+" | File ("+fileName+") found: "+JSON.stringify(found));
            
                const fileStream = blobToFile(uploadFile, fileName);
                if (found){
                    const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+fileName;
                    await uploadReplaceToStoragePool(fileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
                }else{
                    await uploadToStoragePool(fileStream, new PublicKey(storageAccountPK));
                }

                // proceed to add members
                console.log("3. Storage Pool: "+storageAccountPK+" | Members ("+memberFileName+") found: "+JSON.stringify(foundMembers));
                
                const membersFileStream = blobToFile(uploadMembersFile, memberFileName);
                if (foundMembers){
                    const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+memberFileName;
                    await uploadReplaceToStoragePool(membersFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
                }else{
                    await uploadToStoragePool(membersFileStream, new PublicKey(storageAccountPK));
                }
                
            }catch(e){
                console.log("ERR: "+e);
            }
        }
    }

    const getGovernanceLookup  = async () => {
        const fgl = await fetchGovernanceLookupFile();
        if (fgl && fgl.length > 0){
            const sorted = fgl.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
            setGovernanceLookup(sorted);
        }
    }      


    const initStorage  = async () => {
        const drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
        //console.log("drive: "+JSON.stringify(drive));
        setThisDrive(drive);

        try{
            const response = await drive.getStorageAccounts("v2");
            //console.log("Storage Accounts: "+JSON.stringify(response))

            const strgAccounts = new Array();
            for (var item of response){

                const body = {
                    storage_account: item.publicKey.toBase58()
                };
                //console.log("body: "+JSON.stringify(body))
                
                const response = await window.fetch('https://shadow-storage.genesysgo.net/storage-account-info', {
                    method: "POST",
                    body: JSON.stringify(body),
                    headers: { "Content-Type": "application/json" },
                });
            
                const json = await response.json();


                strgAccounts.push({
                    label: item.account.identifier,
                    value: item.publicKey.toBase58(),
                    storage: item.account.storage,
                    currentUsage:json.current_usage,
                });
            }
            if (strgAccounts.length > 0)
                setStorageAutocomplete(strgAccounts);
        }catch(e){
            console.log("ERR: "+e);
        }
    }      

    React.useEffect(() => { 
        if (!tokenMap){
            initStorage();
            getTokens();
            getGovernanceLookup();
        }
    }, []);

    return (
        <Box
            m={1}
            display = "flex"
            justifyContent='center'
            alignItems='center'
            sx={{
                mt:2,
                maxWidth: '100%',
                background: 'rgba(0,0,0,0.5)',
                borderRadius: '24px'
            }}
        >
            <Stack
                component="form"
                m={2}
                sx={{
                    width: '35ch',
                }}
                spacing={2}
                noValidate
                autoComplete="off"
                >
                
                <Typography variant="h6" sx={{textAlign:'center'}}>
                    SPL Governance<br/>Decentralized Caching
                </Typography>

                {storageAutocomplete ?
                    <Autocomplete
                        freeSolo
                        disablePortal
                        id="combo-box-demo"
                        options={storageAutocomplete}
                        getOptionLabel={(option) => option.value}
                        renderOption={(props, option) => (
                            <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                                <Typography variant="body2">{option.label}</Typography>
                                {
                                <Typography variant="caption">
                                    <small>&nbsp;({option?.currentUsage && <>{formatBytes(option.currentUsage)} of </>}{formatBytes(option.storage)})</small>
                                </Typography>
                                }
                            </Box>
                        )}
                        onChange={(e, sel) => setStoragePool(sel?.value)} 
                        renderInput={(params) => <TextField {...params} onChange={(e) => setStoragePool(e.target.value)} label="Storage Pool" />}
                    />
                :
                    <TextField 
                        fullWidth 
                        label="Enter a storage pool address" 
                        value={storagePool}
                        onChange={(e) => setStoragePool(e.target.value)}/>
                    
                }

                
                {governanceAutocomplete ?
                    <Autocomplete
                        freeSolo
                        disablePortal
                        id="combo-box-demo"
                        options={governanceAutocomplete}
                        getOptionLabel={(option) => option.value}
                        renderOption={(props, option) => (
                            <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                              {option.label}
                              &nbsp;
                              <small>(
                                {option.totalProposalsVoting ? <><strong>{option.totalProposalsVoting} voting</strong> of </> : ``}
                                {option.totalProposals})
                              </small>
                              
                            </Box>
                        )}
                        onChange={(e, sel) => setGovernanceAddress(sel?.value)} 
                        renderInput={(params) => <TextField {...params} onChange={(e) => setGovernanceAddress(e.target.value)} label="Governance" />}
                    />
                :
                    <TextField 
                        fullWidth 
                        label="Enter a governance address" 
                        onChange={(e) => setGovernanceAddress(e.target.value)}/>
                    
                }
                
                <Button 
                    onClick ={() => processGovernance(governanceAddress)} 
                    disabled={!governanceAddress}
                    variant='contained'
                >
                    Fetch Governance
                </Button>
                
                <Typography variant="body2" sx={{textAlign:'center'}}>
                    {primaryStatus}
                </Typography>
                
                <ButtonGroup>
                    <Button 
                        onClick ={() => processProposals(proposals, false)} 
                        disabled={(!proposals)}
                        variant='contained'
                        title="Uses smart RPC fetches to fetch only non-completed proposals"
                    >
                        Generate Historical Governance Snapshot
                    </Button>
                    <Button 
                        onClick ={() => processProposals(proposals, true)} 
                        disabled={(!proposals)}
                        color="warning"
                        variant='contained'
                        title="Regenerates via RPC all proposals"
                    >
                        Force Fetch
                    </Button>
                </ButtonGroup>

                <Typography variant='subtitle1' sx={{textAlign:'center'}}>
                    {status}
                </Typography>

                {fileGenerated &&
                    <>
                        <ButtonGroup>                    
                            <Tooltip title="Download SPL Governance Cached JSON file">
                                <Button
                                    color="inherit"
                                    download={`${governanceAddress}.json`}
                                    href={fileGenerated}
                                    sx={{borderRadius:'17px'}}
                                >
                                    <DownloadIcon /> JSON
                                </Button>
                            </Tooltip>
                            {csvGenerated &&
                                <Tooltip title="Download SPL Governance CSV file">
                                    <Button
                                        color="inherit"
                                        download={`${governanceAddress}.csv`}
                                        href={csvGenerated}
                                        sx={{borderRadius:'17px'}}
                                    >
                                        <DownloadIcon /> CSV
                                    </Button>
                                </Tooltip>
                            }

                            <Tooltip title="Upload to your selected storage pool - *SHDW Storage Pool will need to be created for adding to your decentralized storage pool">
                                <Button
                                    color="inherit"
                                    disabled={!storageAutocomplete ? true : false}
                                    onClick={handleUploadToStoragePool}
                                    sx={{ml:1,borderRadius:'17px'}}
                                >
                                    <CloudUploadIcon />
                                </Button>
                            </Tooltip>
                            {/*
                            <Tooltip title="Purge historical files">
                                <Button
                                    color='inherit'
                                    disabled={!storageAutocomplete ? true : false}
                                    onClick={handleStoragePoolPurge}
                                    sx={{ml:1,borderRadius:'17px'}}
                                >
                                    <DeleteForeverIcon color='error' />
                                </Button>
                            </Tooltip>
                            */}
                        </ButtonGroup>
                        
                        {!storageAutocomplete &&
                            <Alert severity="error">
                                WARNING: The admin currently uses SHDW Storage to upload cache files to your storage pool, you will need to create a SHDW Drive Storage Pool to upload the generated files
                            </Alert>
                        }
                    </>
                }

                <Box sx={{ width: '100%' }}>
                    <LinearProgressWithLabel color="inherit" value={progress} />
                </Box>
            </Stack>
            
        </Box>
    );
}