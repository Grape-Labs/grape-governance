import React, { useEffect, useState, useCallback, memo, Suspense } from "react";
import pako from 'pako';
import axios from "axios";
import { 
    getRealm, 
    getAllProposals, 
    getGovernance, 
    getProposal, 
    getInstructionDataFromBase64, 
    getGovernanceAccounts, 
    getGovernanceChatMessages, 
    getTokenOwnerRecord, 
    getTokenOwnerRecordsByOwner, 
    getAllTokenOwnerRecords, 
    getRealmConfigAddress, 
    getGovernanceAccount, 
    getAccountTypes, 
    tryGetRealmConfig, 
    getNativeTreasuryAddress,
    getAllGovernances,
    GovernanceAccountType,
    getRealmConfig,
    ProposalTransaction,
    pubkeyFilter,
} from '@solana/spl-governance';
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

import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import BoltIcon from '@mui/icons-material/Bolt';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { LinearProgressProps } from '@mui/material/LinearProgress';

import { Connection, PublicKey, TokenAccountsFilter, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { ShdwDrive, ShadowFile } from "@shadow-drive/sdk";
import {
    fetchGovernanceLookupFile,
    fetchLookupFile,
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
import Bolt from "@mui/icons-material/Bolt";

const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);

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
    const [transactionsStringGenerated, setTransactionsStringGenerated] = React.useState(null);
    const [governanceAddress, setGovernanceAddress] = React.useState(null);
    const [governanceName, setGovernanceName] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [governanceType, setGovernanceType] = React.useState(0);
    const [nftBasedGovernance, setNftBasedGovernance] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [governanceTransactions, setGovernanceTransactions] = React.useState(null);
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
    const [currentUploadInfo, setCurrentUploadInfo] = React.useState(null);
    const [tokenDecimals, setTokenDecimals] = React.useState(null);
    const [voteType, setVoteType] = React.useState(null);
    const [propVoteType, setPropVoteType] = React.useState(null); // 0 council, 1 token, 2 nft
    const [uniqueYes, setUniqueYes] = React.useState(0);
    const [uniqueNo, setUniqueNo] = React.useState(0);
    const [gist, setGist] = React.useState(null);
    const [proposalDescription, setProposalDescription] = React.useState(null);
    const [processCron, setProcessCron] = React.useState(false);
    const [snapshotJob, setSnapshotJob] = React.useState(false);
    const [forceFetch, setForceFetch] = React.useState(false);
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
    const [governanceVaults, setGovernanceVaults] = React.useState(null);

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
        const fgl = await fetchLookupFile(fileName, storagePool);
        return fgl;
    } 
    
    const fetchRealm = async(address:string) => {
        const connection = RPC_CONNECTION;
        //console.log("Fetching governance "+address);
        const grealm = await getRealm(RPC_CONNECTION, new PublicKey(address))
        setRealm(grealm);
        return grealm;
    }

    const fetchGovernanceVaults = async(grealm:any) => {
        const connection = RPC_CONNECTION;

        const rawGovernances = await getAllGovernances(
            connection,
            new PublicKey(grealm.owner),
            new PublicKey(grealm.pubkey)
        );
        
        return rawGovernances;
    }

    const fetchGovernance = async(address:string, grealm:any) => {
        //const finalList = new Array();
        setLoading(true);
        setProposals(null);
        setCurrentUploadInfo(null);
        setStatus("Fetching Governance - Source: Q");
        const connection = RPC_CONNECTION;
        //console.log("Fetching governance "+address);
        //const grealm = await getRealm(RPC_CONNECTION, new PublicKey(address))
        //setRealm(grealm);

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

        const realmPk = grealm.pubkey;

        //const treasury = await getNativeTreasuryAddress(programId, realmPk);
        let fgv = await fetchGovernanceVaults(grealm);
        
        setGovernanceVaults(fgv);
        // should we do a deep dive at this level with the vaults?
        // absolutely 

        for (var gv of fgv){
            //console.log('VAULT: '+JSON.stringify(gv))

            let balance = connection.getBalance(new PublicKey(gv.pubkey))

            console.log('SOL BALANCE: '+gv.pubkey.toBase58()+ " - " +JSON.stringify(balance));

            const resp = await connection.getParsedTokenAccountsByOwner(gv.pubkey, {programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")});
            const resultValues = resp.value;
            
            const holdings: any[] = [];
            for (const item of resultValues){
                //let buf = Buffer.from(item.account, 'base64');
                //console.log("item: "+JSON.stringify(item));
                if (item.account.data.parsed.info.tokenAmount.amount > 0)
                    holdings.push(item);
                // consider using https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json to view more details on the tokens held
            } 

            const sortedholdings = JSON.parse(JSON.stringify(holdings));
            sortedholdings.sort((a:any,b:any) => (b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount));

            console.log('***');
            console.log('*** TOKEN BALANCE: '+gv.pubkey.toBase58())+" ***";

            var assetsIdentified = 0;
            var assetsNotIdentified = 0;
            for (const thisitem of sortedholdings){
                const ta = thisitem.account.data.parsed.info.tokenAmount.amount;
                const td = thisitem.account.data.parsed.info.tokenAmount.decimals;
                const tf = thisitem.account.data.parsed.info.tokenAmount.amount/Math.pow(10, (thisitem.account.data.parsed.info.tokenAmount.decimals || 0));;
                const tn = tokenMap.get(new PublicKey(thisitem.account.data.parsed.info.mint).toBase58())?.name;
                const tl = tokenMap.get(new PublicKey(thisitem.account.data.parsed.info.mint).toBase58())?.logoURI;

                if ((ta > 0)&&(tn)){
                    assetsIdentified++;
                    console.log(tn+": "+tf+" "+tl);
                } else{
                    assetsNotIdentified++;
                }
            }
            if (assetsNotIdentified > 0)
                console.log("Assets not identified (possibly NFTs or not mapped tokens): "+assetsNotIdentified)
            console.log("Total Tokens: "+(assetsIdentified+assetsNotIdentified));
        }
        
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
                    
                    /*
                    const tryRealmConfig = await tryGetRealmConfig(
                        connection,
                        programId,
                        realmPk
                    )*/
                    
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



            setPrimaryStatus("Fetching Governance Transactions");
            // https://api.solscan.io/account/token/txs?address=By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip&offset=0&limit=50&cluster=

            // this will be used to monitor inflows / outflows?
            // .fetch
            let hasnext = true;
            let offset = 0;
            let limit = 50;
            let resultcount = 0;
            const govTx = new Array();
            while (hasnext){
                setPrimaryStatus("Fetching Governance Transactions ("+(offset+1)+" - "+(offset+limit)+")");
                const apiUrl = "https://api.solscan.io/account/token/txs";
            
                const response = await axios.get(
                    apiUrl, {
                    params: {
                        address:address,
                        offset:offset,
                        limit:limit,
                        cluster:""
                    },
                }).then((res) => {
                    return res;
                }).catch((err) => {
                    return null;  
                })
                offset+=limit;
                
                if (response){
                    //console.log("response: "+JSON.stringify(response.data.data.tx.transactions));
                    //console.log("total: "+JSON.stringify(response.data.data.tx.total));
                    //console.log("hasnext: "+JSON.stringify(response.data.data.tx.hasNext));
                    hasnext = response.data.data.tx.hasNext;
                    // total = response.data.data.total
                    // hasnext = response.data.data.hasnext
                    //setGovernanceTransactions(response.data.transactions);
                    for (var tx of response.data.data.tx.transactions){
                        govTx.push(tx);
                    }
                } else{
                    hasnext = false;
                }
            }
            setGovernanceTransactions(govTx);
            
            setPrimaryStatus("Fetching Token Owner Records");

            // to do get member map
            const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
            // check #tokens deposited

            // loop all token holders and get the assets they have in their wallet matching the governingtokenmint
            // grealm.account?.communityMint.toBase58()
            //console.log("communityMint: "+JSON.stringify(grealm.account?.communityMint.toBase58()))
            //console.log("rawTokenOwnerRecords "+JSON.stringify(rawTokenOwnerRecords))

            const newMemberMap = new Array();
            
            let mcount = 0;
            for (const owner of rawTokenOwnerRecords){
                mcount++;
                setPrimaryStatus("Fetching Token Owner Records - "+mcount+" of "+rawTokenOwnerRecords.length+" Member Wallet Balance");
                const tokenOwnerRecord = owner.account.governingTokenOwner;
                
                const balance = await connection.getParsedTokenAccountsByOwner(tokenOwnerRecord,{mint:grealm.account?.communityMint});
                
                //console.log(tokenOwnerRecord.toBase58()+" "+JSON.stringify(balance));
                if (balance?.value[0]?.account?.data?.parsed?.info)    
                    owner.walletBalance = balance.value[0].account.data.parsed.info;
            }

            //console.log("rawTokenOwnerRecords "+JSON.stringify(rawTokenOwnerRecords))

            setMemberMap(rawTokenOwnerRecords);
            // get unique members

            setPrimaryStatus("Fetching All Proposals");

            const gprops = await getAllProposals(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk);
                    
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
                        const prop_details = await getProposal(RPC_CONNECTION, prop.pubkey);
                        console.log("prop_details: "+JSON.stringify(prop_details))
                    }*/

                    // check if community or council
                    if (grealm.account.config?.councilMint && (new PublicKey(grealm.account.config?.councilMint).toBase58() === prop.account.governingTokenMint.toBase58()))
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

            const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
            
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

    const getGovernanceProps = async (thisitem: any) => {
        const governance = await getGovernance(connection, thisitem.account.governance);
        
        //getGovernanceAccounts();
        
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
                (realm.account.config?.councilMint && new PublicKey(realm.account.config?.councilMint).toBase58() === thisitem.account.governingTokenMint.toBase58())
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

    const fetchProposalData = async(finalList:any, forceSkip:boolean, this_realm: any) => {
        setSolanaVotingResultRows(null);
        let x=0;
        let length = finalList.length;
        setMax(length);
        const normalise = (value:number) => ((value - MIN) * 100) / (length - MIN);

        let cached_governance = new Array();
        if (governanceLookup){
            for (let glitem of governanceLookup){
                
                if (new PublicKey(glitem.governanceAddress).toBase58() === new PublicKey(governanceAddress).toBase58()){
                    //console.log(glitem.governanceAddress + " vs " + new PublicKey(governanceAddress).toBase58())
                    cached_governance = await getGovernanceFromLookup(glitem.filename);
                }
            }
        }
        
        if (cached_governance){
            for (var thisitem of finalList){
                x++;
                if (forceSkip)
                    setStatus("Fetching "+x+" of "+length);
                else
                    setStatus("Smart Fetching "+x+" of "+length);
                
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
                                        if (cgov?.instructions)
                                            thisitem.instructions = cgov.instructions;
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

                    //console.log("******* PROP ("+x+") FETCH *******")
                    //console.log("status ("+thisitem.pubkey.toBase58()+"): "+skip_process);
                    if (!skip_process){
                        // do magic here...
                        console.log("Fetching proposal details via RPC ("+thisitem.pubkey.toBase58()+")");

                        let instructions = null;
                        
                        if (thisitem.pubkey){
                            instructions = await getGovernanceAccounts(
                                connection,
                                new PublicKey(thisitem.owner),
                                ProposalTransaction,
                                [pubkeyFilter(1, new PublicKey(thisitem.pubkey))!]
                            );
                            
                            //if (instructions)
                            //    console.log("instructions: "+JSON.stringify(instructions))
                        }

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
                        
                        //console.log("vrs check 0 "+JSON.stringify(this_realm));

                        if (this_realm.account.config?.councilMint){
                            if (this_realm.account.config?.councilMint?.toBase58() === thisitem?.account?.governingTokenMint?.toBase58()){
                                vType = 'Council';
                                td = 0;
                            }
                        }

                        //console.log("vrs check 1")

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

                        //console.log("vrs check 2 m:"+JSON.stringify(memberMap))

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

                        //console.log("vrs check 3")

                        
                        //if (thisitem.account?.state === 2){ // if voting state
                            await getGovernanceProps(thisitem)
                        //}

                        const voteRecord = await getVoteRecords({
                            connection: connection,
                            programId: new PublicKey(thisitem.owner),
                            proposalPk: new PublicKey(thisitem.pubkey),
                        });

                        //console.log("vrs check 4")
                        const vrs = [];
                        let csvFile = '';
                        let uYes = 0;
                        let uNo = 0;
                        if (voteRecord?.value){
                            let counter = 0;

                            for (let item of voteRecord.value){
                                counter++;
                                
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

                                //if (counter === 1)
                                //    console.log("item ("+thisitem.pubkey+"): "+JSON.stringify(item))

                                //console.log("VRS pushing "+counter)

                                const vrs_item = {
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
                                        decimals:((realm.account.config?.councilMint && realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58()) ? 0 : td),
                                        councilMint:(realm.account.config?.councilMint ? new PublicKey(realm.account.config?.councilMint).toBase58() : null),
                                        governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                                    }
                                }

                                vrs.push(vrs_item)

                                //console.log("pushed "+JSON.stringify(vrs_item))
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
                                
                                //csvFile += item.account.governingTokenOwner.toBase58()+','+(+((voterWeight)/Math.pow(10, (new PublicKey(realm.account.config?.councilMint).toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td))).toFixed(0))+','+(voterWeight)+','+(new PublicKey(realm.account.config?.councilMint).toBase58() === thisitem.account.governingTokenMint?.toBase58() ? 0 : td)+','+voteType+','+item.account.proposal.toBase58()+'';
                                //    csvFile += item.pubkey.toBase58();
                            }
                        }

                        console.log("Prop Participation: "+vrs.length)

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
                        thisitem.instructions = instructions;
                    }
                } catch (e) { // Handle errors from invalid calls
                    
                }
            }

            //console.log("finalList: "+JSON.stringify(finalList))
            setSolanaVotingResultRows(finalList)

            return finalList;
        } else{
            return null;
        }
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

            return jsonString;
            //const link = document.createElement("a");
            //link.href = jsonString;
            //link.download = fileName+".json";
            //link.click(); 
    }
    

    const returnJSON = async(generatedString:string, fileName:string) => {
        setStatus("File generated!");
        
        /*
        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
            JSON.stringify(generatedString, null, 2)
        )}`;
        
        const bytes = new TextEncoder().encode(jsonString);
        
        const blob_json = new Blob([bytes], {
            type: "application/json;charset=utf-8"
        });
        */
        const blob = new Blob([generatedString], {
            type: "application/text"
        });
        
        //const text = await new Response(blob).text()
        //console.log("text: "+text);
        console.log("Original size: "+blob.size);

        
        // Compress the JSON string using pako
        const compressed = pako.deflate(generatedString, { to: 'string' });
        
        const compressed_blob = new Blob([compressed], {
            type: "application/octet-stream"
        });
        
        //const compressed_text = await new Response(compressed_blob).text()
        //console.log("text: "+text);
        console.log("with compression size (pending): "+compressed_blob.size);
        
        //const url = URL.createObjectURL(blob);
        //console.log("blob size: "+blob.size);
        //const buff = Buffer.from(jsonString);
        //console.log("jsonString: " + JSON.stringify(jsonString));
        //console.log("blob: " + JSON.stringify(blob));
        //console.log("buff: " + JSON.stringify(buff));
        //return blob;
        return compressed_blob;
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


    // CRON STEP! Handled fetching and uploading in one go
    const processGovernanceUploadSnapshotJobStep1 = async(updateAuthority:string, force:boolean) => {
        setSnapshotJob(false);
        setProcessCron(false);
        setForceFetch(force);
        setRealm(null);
        setProposals(null);
        setMemberMap(null);
        setSolanaVotingResultRows(null);
        console.log("******* CALLING FETCH *******")
        if (governanceAddress){
            const grealm = await fetchRealm(updateAuthority)
            setRealm(grealm);
            console.log("******* REALM FETCHED *******")
            const finalList = await processGovernance(updateAuthority, grealm);
            console.log("******* GOVERNANCE FETCHED *******")
            setSnapshotJob(true);
        }
    }
    const processGovernanceUploadSnapshotJobStep2 = async() => {
        if (proposals && realm){
            const membersString = await processProposals(proposals, forceFetch, realm); // set to true if we want to force fetch all
            console.log("******* PROPOSALS FETCHED *******")
            setProcessCron(true);
            setLoading(false);
        }
    }

    React.useEffect(() => {
        if (snapshotJob &&
            proposals && 
            memberMap &&
            realm){
            processGovernanceUploadSnapshotJobStep2();     
        }
    }, [snapshotJob, proposals, realm]);

    // use an effect to properly upload
    React.useEffect(() => { 
        if (processCron){
            console.log("process cron "+processCron)
            //console.log("thisGovernance "+JSON.stringify(thisGovernance))
            //console.log("solanaVotingResultRows "+JSON.stringify(solanaVotingResultRows))
            if (realm &&
                proposals &&
                memberMap &&
                solanaVotingResultRows){
                    
                console.log("process cron & realms data loaded")

                handleUploadToStoragePool();
                setProcessCron(false);
            }
        }
    }, [processCron, realm, proposals, solanaVotingResultRows, memberMap]);


    // STEP 1.
    const processGovernance = async(updateAuthority:string, sent_realm:any) => {
        // Second drive creation (otherwise wallet is not connected when done earlier)
        const drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
        setThisDrive(drive);

        if (governanceAddress){
            let finalList = null;
            setFileGenerated(null);
            
            setLoading(true);
            
            let grealm = sent_realm;
            if (!grealm) 
                grealm = await fetchRealm(governanceAddress);

            finalList = await fetchGovernance(governanceAddress, grealm);
            
            return finalList;

            setLoading(false);
        }
    }

    // STEP 2.
    const processProposals = async(finalList:any, forceSkip:boolean, this_realm: any) => {
        if (finalList){
            setLoading(true);
            setCurrentUploadInfo(null);

            let using_realm = this_realm;
            if (!using_realm)
                using_realm;

            
            const finalProposalList = await fetchProposalData(finalList, forceSkip, using_realm);
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
                const membersString = JSON.stringify(memberMap);
                setMembersStringGenerated(membersString);
                const governanceTransactionsString = JSON.stringify(governanceTransactions);
                setTransactionsStringGenerated(governanceTransactionsString);

                return membersString;
            }
            
            setLoading(false);
        }
    }

    const updateGovernanceLookupFile = async(fileName:string, memberFileName:string, governanceTransactionsFileName: string, timestamp:number, lookupFound:boolean) => {
        // this should be called each time we update with governance
        const storageAccountPK = storagePool;

        let this_realm = realm;
        const lookup = new Array();
        console.log("Storage Pool: "+storagePool+" | Lookup File found: "+JSON.stringify(lookupFound))
        //console.log("this_realm: "+JSON.stringify(this_realm));
        //console.log("governanceLookup: "+JSON.stringify(governanceLookup));
        


        if (this_realm){
            //console.log("realm: "+JSON.stringify(realm))
            const governingMintDetails = 
                await connection.getParsedAccountInfo(
                    new PublicKey(this_realm.account.communityMint)
                );

            if (lookupFound){ // update governanceLookup
                // with the file found, lets generate the lookup as an array
                var govFound = false;
                let cntr = 0;

                //console.log("realm: "+JSON.stringify(realm))
                
                //console.log("governanceLookup: "+JSON.stringify(governanceLookup));

                for (var item of governanceLookup){
                    if (item.governanceAddress === governanceAddress){
                        item.version++;
                        item.timestamp = timestamp;
                        item.filename = fileName;
                        item.memberFilename = memberFileName;
                        item.governanceTransactionsFilename = governanceTransactionsFileName;
                        item.realm = this_realm;
                        if (this_realm.account.config?.communityMintMaxVoteWeightSource)
                            item.communityFmtSupplyFractionPercentage = this_realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
                        item.governance = thisGovernance;
                        item.governanceVaults = governanceVaults;
                        item.governingMintDetails = governingMintDetails;
                        item.totalProposals = totalProposals;
                        item.totalProposalsVoting = totalProposalsVoting;
                        item.totalCouncilProposals = totalCouncilProposals;
                        item.lastProposalDate = lastProposalDate;
                        item.tokenSupply = totalSupply;
                        item.totalQuorum = totalQuorum;
                        item.totalMembers = memberMap ? memberMap.length : null;
                        govFound = true;
                    }
                    //console.log("size: "+new Set(memberMap).size)
                    cntr++;
                }
                console.log("Lookup has "+cntr+" entries");
                if (!govFound){
                    let communityFmtSupplyFractionPercentage = null;
                    if (this_realm.account.config?.communityMintMaxVoteWeightSource)
                        communityFmtSupplyFractionPercentage = this_realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
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
                        governanceTransactionsFilename: governanceTransactionsFileName,
                        realm:this_realm,
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
                        totalMembers: memberMap ? memberMap.length : null,
                    });
                }
                
                console.log("Replacing Governance Lookup");
                const uploadFile = await returnJSON(JSON.stringify(governanceLookup), "governance_lookup.json");
                const fileSize  = uploadFile.size;
                setCurrentUploadInfo("Replacing "+"governance_lookup.json"+" - "+formatBytes(fileSize));
                
                const fileStream = blobToFile(uploadFile, "governance_lookup.json");
                const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/governance_lookup.json';
                await uploadReplaceToStoragePool(fileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
            } else{ // create governanceLookup

                let communityFmtSupplyFractionPercentage = null;
                if (this_realm.account.config?.communityMintMaxVoteWeightSource)
                    communityFmtSupplyFractionPercentage = this_realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();

                lookup.push({
                    governanceAddress:governanceAddress,
                    governanceName:governanceName,
                    version:0,
                    timestamp:timestamp,
                    filename:fileName,
                    memberFilename: memberFileName,
                    governanceTransactionsFilename: governanceTransactionsFileName,
                    realm:this_realm,
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
                
                console.log("Uploading new Governance Lookup");
                const uploadFile = await returnJSON(JSON.stringify(lookup), "governance_lookup.json");
                const fileStream = blobToFile(uploadFile, "governance_lookup.json");
                const fileSize  = uploadFile.size;
                setCurrentUploadInfo("Adding "+"governance_lookup.json"+" - "+formatBytes(fileSize));
                await uploadToStoragePool(fileStream, new PublicKey(storageAccountPK));
                // update autocomplete
                try{
                    governanceAutocomplete.push({
                        label: governanceName, 
                        value: governanceAddress,
                        totalProposals: totalProposals,
                        totalProposalsVoting: totalProposalsVoting,
                        lastProposalDate: lastProposalDate
                    })
                }catch(e){
                    console.log("ERR: "+e);
                }
                
                setGovernanceLookup(lookup);
            }
        } else{
            console.log("ERR: realm could not be loaded - "+JSON.stringify(this_realm))
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
        const governanceTransactionsFileName = governanceAddress+'_transactions_'+timestamp+'.json';
        
        const storageAccountPK = storagePool;

        let current_proposals_to_use = stringGenerated;
        let current_members_to_use = membersStringGenerated;
        let current_transactions_to_use = transactionsStringGenerated;

        //exportJSON(fileGenerated, fileName);
        console.log("preparing to upload: "+fileName);
        if (!thisDrive){
            const drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
            //console.log("drive: "+JSON.stringify(drive));
            setThisDrive(drive);
            alert("Drive not initialized, initializing now...");
        } else{
            // check if either file is set
            
            if ((stringGenerated) &&
                (membersStringGenerated)){
                
                console.log("1: "+JSON.stringify(storageAccountPK))
                const uploadProposalFile = await returnJSON(current_proposals_to_use, fileName);
                console.log("2: "+JSON.stringify(storageAccountPK))
                const uploadMembersFile = await returnJSON(current_members_to_use, memberFileName);
                console.log("3: "+JSON.stringify(storageAccountPK))
                const uploadTransactionsFile = await returnJSON(current_transactions_to_use, governanceTransactionsFileName);
                
                //const fileBlob = await fileToDataUri(uploadFile);
                // auto check if this file exists (now we manually do this)
                let found = false;
                let foundMembers = false;
                let foundTransactions = false;
                let lookupFound = false;
                try{
                    console.log("storageAccountPK: "+JSON.stringify(storageAccountPK))
                    const response = await thisDrive.listObjects(new PublicKey(storageAccountPK))

                    if (response?.keys){
                        for (var item of response.keys){
                            if (item === fileName){
                                found = true;
                            } else if (item === memberFileName){
                                foundMembers = true;
                            } else if (item === governanceTransactionsFileName){
                                foundTransactions = true;
                            } else if (item === 'governance_lookup.json'){
                                lookupFound = true;
                            }
                        }
                    }

                    // update lookup
                    console.log("1. Storage Pool: "+storageAccountPK+" | Lookup");
                    
                    await updateGovernanceLookupFile(fileName, memberFileName, governanceTransactionsFileName, timestamp, lookupFound);

                    // proceed to add propsals
                    console.log("2. Storage Pool: "+storageAccountPK+" | File ("+fileName+") found: "+JSON.stringify(found));
                    
                    const proposalFileStream = blobToFile(uploadProposalFile, fileName);
                    const proposalFileSize  = uploadProposalFile.size;
                    if (found){
                        const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+fileName;
                        setCurrentUploadInfo("Replacing "+fileName+" - "+formatBytes(proposalFileSize));
                        await uploadReplaceToStoragePool(proposalFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
                    }else{
                        setCurrentUploadInfo("Adding "+fileName+" - "+formatBytes(proposalFileSize));
                        await uploadToStoragePool(proposalFileStream, new PublicKey(storageAccountPK));
                    }

                    // proceed to add members
                    console.log("3. Storage Pool: "+storageAccountPK+" | Members ("+memberFileName+") found: "+JSON.stringify(foundMembers));
                    
                    const membersFileStream = blobToFile(uploadMembersFile, memberFileName);
                    const memberFileSize  = uploadMembersFile.size;
                    if (foundMembers){
                        const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+memberFileName;
                        setCurrentUploadInfo("Replacing "+memberFileName+" - "+formatBytes(memberFileSize));
                        await uploadReplaceToStoragePool(membersFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
                    }else{
                        setCurrentUploadInfo("Adding "+memberFileName+" - "+formatBytes(memberFileSize));
                        await uploadToStoragePool(membersFileStream, new PublicKey(storageAccountPK));
                    }

                    // proceed to add members
                    console.log("4. Storage Pool: "+storageAccountPK+" | Members ("+governanceTransactionsFileName+") found: "+JSON.stringify(foundTransactions));
                    
                    const transactionsFileStream = blobToFile(uploadTransactionsFile, governanceTransactionsFileName);
                    const transactionsFileSize  = uploadTransactionsFile.size;
                    if (foundTransactions){
                        const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+foundTransactions;
                        setCurrentUploadInfo("Replacing "+governanceTransactionsFileName+" - "+formatBytes(transactionsFileSize));
                        await uploadReplaceToStoragePool(transactionsFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
                    }else{
                        setCurrentUploadInfo("Adding "+governanceTransactionsFileName+" - "+formatBytes(transactionsFileSize));
                        await uploadToStoragePool(transactionsFileStream, new PublicKey(storageAccountPK));
                    }
                    
                    // delay a bit and update to show that the files have been added
                    setCurrentUploadInfo("SPL Governance DSC "+governanceAddress+" updated!");

                }catch(e){
                    console.log("ERR: "+e);
                }
            } else{ // check what is missing
                if (!stringGenerated){

                }
                //if (!proposal_file){

                //}
                if (!membersStringGenerated){

                }
                //if (!member_file){
                    
                //}
            }
        }
    }

    const getGovernanceLookup  = async () => {
        const fgl = await fetchGovernanceLookupFile(storagePool);
        if (fgl && fgl.length > 0){
            const lookupAutocomplete = new Array();
            for (var item of fgl){
                lookupAutocomplete.push({
                    label: item.governanceName,
                    value: item.governanceAddress,
                    totalProposals: item.totalProposals,
                    totalProposalsVoting: item.totalProposalsVoting,
                    lastProposalDate: item.lastProposalDate,
                });
            }
            setGovernanceAutocomplete(lookupAutocomplete);


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
                

                <ButtonGroup
                    fullWidth
                >
                    <Tooltip title="Process selected Governance & upload to selected storage pool">
                        <Button 
                            onClick ={() => processGovernanceUploadSnapshotJobStep1(governanceAddress, false)} 
                            disabled={(!governanceAddress) || (!storagePool)}
                            variant='contained'
                            color='inherit'
                            sx={{color:'black'}}
                        >
                            Fetch Governance <BoltIcon />
                        </Button>
                    </Tooltip>
                    <Tooltip title="WARNING: This will refetch/force fetch all governance proposals & proposal participation again regardless of cache">
                        <Button 
                            onClick ={() => processGovernanceUploadSnapshotJobStep1(governanceAddress, true)} 
                            disabled={(!governanceAddress) || (!storagePool)}
                            variant='contained'
                            color='warning'
                        >
                            Refetch <HourglassBottomIcon />
                        </Button>
                    </Tooltip>
                </ButtonGroup>

                {/*
                <ButtonGroup
                    fullWidth
                >
                    <Button 
                        onClick ={() => processGovernance(governanceAddress, null)} 
                        disabled={!governanceAddress}
                        variant='contained'
                    >
                        Fetch Governance
                    </Button>
                </ButtonGroup>
                */}
                <Typography variant="body2" sx={{textAlign:'center'}}>
                    {primaryStatus}
                </Typography>
                {/*
                <ButtonGroup>
                    <Button 
                        onClick ={() => processProposals(proposals, false, realm)} 
                        disabled={(!proposals)}
                        variant='contained'
                        title="Uses smart RPC fetches to fetch only non-completed proposals"
                    >
                        Generate Historical Governance Snapshot
                    </Button>
                    <Button 
                        onClick ={() => processProposals(proposals, true, realm)} 
                        disabled={(!proposals)}
                        color="warning"
                        variant='contained'
                        title="Regenerates via RPC all proposals"
                    >
                        Force Fetch
                    </Button>
                </ButtonGroup>
                */}

                <Typography variant='subtitle1' sx={{textAlign:'center'}}>
                    {status}
                </Typography>
                {currentUploadInfo &&
                    <Typography variant='caption' sx={{textAlign:'center'}}>
                        {currentUploadInfo}
                    </Typography>
                }

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
                                    onClick={e => handleUploadToStoragePool()}
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