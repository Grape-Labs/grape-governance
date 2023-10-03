import React, { useEffect, useState, useCallback, memo, Suspense } from "react";
import pako from 'pako';
import axios from "axios";
import moment from "moment";
import * as anchor from "@project-serum/anchor";
import { RestClient, NftMintsByOwnerRequest, NftMintPriceByCreatorAvgRequest, CollectionFloorpriceRequest } from '@hellomoon/api';
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
    SYSTEM_PROGRAM_ID
} from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import {
    getRegistrarPDA,
    getVoterPDA,
    getVoterWeightPDA,
  } from "../utils/governanceTools/components/instructions/account";
import { VsrClient } from "@blockworks-foundation/voter-stake-registry-client/index";
import { Provider, Wallet, AnchorProvider } from "@project-serum/anchor";
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';
import { getJupiterPrices } from '../utils/grapeTools/helpers';
import { gistApi, resolveProposalDescription } from '../utils/grapeTools/github';

import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

import { 
    tryGetName,
} from '@cardinal/namespaces';

import { getProfilePicture } from '@solflare-wallet/pfp';
import { findDisplayName } from '../utils/name-service';

import {
    Box,
    Grid,
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

import { Connection, Keypair, PublicKey, TokenAccountsFilter, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { ShdwDrive, ShadowFile } from "@shadow-drive/sdk";
import {
    fetchGovernanceLookupFile,
    fetchLookupFile,
    getFileFromLookup,
    formatBytes,
    loadWalletKey
} from '../GovernanceCached/CachedStorageHelpers'; 
import { useSnackbar } from 'notistack';

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from '@solana/wallet-adapter-base';

import { 
    RPC_CONNECTION,
    PROXY,
    HELIUS_API,
    HELLO_MOON_BEARER,
    GGAPI_STORAGE_POOL,
    GGAPI_STORAGE_URI,
    PRIMARY_STORAGE_WALLET,
    RPC_ENDPOINT,
    WS_ENDPOINT,
    TWITTER_PROXY
} from '../utils/grapeTools/constants';

import WarningIcon from '@mui/icons-material/Warning';
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

class MyWallet implements anchor.Wallet {

    constructor(readonly payer: Keypair) {
        this.payer = payer
    }

    async signTransaction(tx: Transaction): Promise<Transaction> {
        tx.partialSign(this.payer);
        return tx;
    }

    async signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
        return txs.map((t) => {
            t.partialSign(this.payer);
            return t;
        });
    }

    get publicKey(): PublicKey {
        return this.payer.publicKey;
    }
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
/*
  const getTokens = async (setTokenMap:any) => {
    const tarray:any[] = [];
    try{
        const tlp = await new TokenListProvider().resolve().then(tokens => {
            const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
            const tmap = tokenList.reduce((map, item) => {
                tarray.push({address:item.address, decimals:item.decimals})
                map.set(item.address, item);
                return map;
            },new Map())
            if (setTokenMap) setTokenMap(tmap);
            return tmap;
        });
} catch(e){console.log("ERR: "+e)}
}*/

const getVotingPlugin = async (
    selectedRealm: any,
    walletKeypair: any,
    walletPubkey: any,
    instructions: any
  ) => {
    const options = AnchorProvider.defaultOptions();
    const provider = new AnchorProvider(
      RPC_CONNECTION,
      walletKeypair as unknown as Wallet,
      options
    );
    const client = await VsrClient.connect(provider, false);
    const clientProgramId = client!.program.programId;
    const { registrar } = await getRegistrarPDA(
      new PublicKey(selectedRealm!.realmId),
      new PublicKey(selectedRealm!.communityMint),
      clientProgramId
    );
    const { voter } = await getVoterPDA(registrar, walletPubkey, clientProgramId);
    const { voterWeightPk } = await getVoterWeightPDA(
      registrar,
      walletPubkey,
      clientProgramId
    );
    
    const updateVoterWeightRecordIx = await client!.program.methods
      .updateVoterWeightRecord()
      .accounts({
        registrar,
        voter,
        voterWeightRecord: voterWeightPk,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction();
  
    return { voterWeightPk, maxVoterWeightRecord: undefined };
};

const getTokens = async () => {
    const tarray:any[] = [];
    try{
        const tlp = await new TokenListProvider()
        .resolve()
        .then(tokens => {
            const tokenList = tokens.filterByChainId(ENV.MainnetBeta).getList();
            const tmap = tokenList.reduce((map, item) => {
                tarray.push({address:item.address, decimals:item.decimals})
                map.set(item.address, item);
                return map;
            },new Map())
            //setTokenMap(tmap);
            return tmap;
        });
        return tlp;
    } catch(e){console.log("ERR: "+e)}
}

export const cronFetch = async(
    setStatus:any, 
    setPrimaryStatus:any, 
    enqueueSnackbar:any, 
    closeSnackbar:any) => {
    
    // STEP 1 call and load all variables needed
    const storageSettings = await initStorage(null, null, null, null);
    const tokensMapped = await getTokens();
    const lookupSettings = await getGovernanceLookup(null, null, GGAPI_STORAGE_POOL);

    // STEP 2 call and process snapshot
    /*
    await processGovernanceUploadSnapshotAll(
            false, 
            null,
            lookupSettings.lookup, 
            tokensMapped, 
            storageSettings.wallet, 
            RPC_CONNECTION, 
            GGAPI_STORAGE_POOL, 
            storageSettings.autocomplete,
            storageSettings.drive,
            null, null, null, null, null, null, null, null, null, null);
    */
    console.log("HELLO SPL CRON!");


}

const getGovernanceFromLookup  = async (fileName:string, storagePool: any) => {
    try{
        const fgl = await fetchLookupFile(fileName, storagePool);
        return fgl;
    }catch(e){
        return null;
    }
} 

const fetchRealm = async(address:string) => {
    const grealm = await getRealm(RPC_CONNECTION, new PublicKey(address))
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

// remove any duplicates
const removeDuplicateSignatures = (array) => {
    const uniqueSignatures = [];
    return array.filter((item) => {
        if (!uniqueSignatures.includes(item.signature)) {
        uniqueSignatures.push(item.signature);
        return true;
        }
        return false;
    });
};

const getSocialConnections = async(address: string) => {
    const connection = RPC_CONNECTION;

    const fetchSolflareProfilePicture = async () => {
        //setLoadingPicture(true);  
            try{
                const { isAvailable, url } = await getProfilePicture(connection, new PublicKey(address));
                
                let img_url = url;
                if (url)
                    img_url = url.replace(/width=100/g, 'width=256');
                //setProfilePictureUrl(img_url);
                //setHasProfilePicture(isAvailable);
                //countRef.current++;
                return img_url;
            }catch(e){
                console.log("ERR: "+e)
            }
        //setLoadingPicture(false);
    }

    const fetchSolanaSocialConnections = async () => {
        //console.log("fetching tryGetName: "+address);
        //setTwitterRegistration(null);
        //setHasSolanaDomain(false);
        let found_cardinal = false;

        const registrationInfo = {
            solflare: {
                pfp: null,
            },
            cardinal: {
                pfp: null,
                handle: null,
            },
            bonfida: {
                handle: null,
            }
        }

        registrationInfo.solflare.pfp = await fetchSolflareProfilePicture();

        //const cardinalResolver = new CardinalTwitterIdentityResolver(ggoconnection);
        try{
            //const cardinal_registration = await cardinalResolver.resolve(new PublicKey(address));
            //const identity = await cardinalResolver.resolveReverse(address);
            //console.log("identity "+JSON.stringify(cardinal_registration))
            
            const cardinal_registration = await tryGetName(
                connection, 
                new PublicKey(address)
            );

            if (cardinal_registration){
                found_cardinal = true;
                //console.log("cardinal_registration: "+JSON.stringify(cardinal_registration));
                //setHasSolanaDomain(true);
                //setSolanaDomain(cardinal_registration[0]);
                //setTwitterRegistration(cardinal_registration[0]);
                registrationInfo.cardinal.handle = cardinal_registration[0];
                const url = `${TWITTER_PROXY}https://api.twitter.com/2/users/by&usernames=${cardinal_registration[0].slice(1)}&user.fields=profile_image_url,public_metrics`;
                const response = await axios.get(url);
                if (response?.data?.data[0]?.profile_image_url){
                    //setProfilePictureUrl(response?.data?.data[0]?.profile_image_url);
                    //setHasProfilePicture(true);
                    registrationInfo.cardinal.pfp = response?.data?.data[0]?.profile_image_url;
                }
            }
        }catch(e){
            console.log("ERR: "+e);
        }

        if (!found_cardinal){
            const domain = await findDisplayName(connection, address);
            if (domain) {
                if (domain[0] !== address) {
                    //setHasSolanaDomain(true);
                    //setSolanaDomain(domain[0]);
                    registrationInfo.bonfida.handle = domain[0];
                }
            }
        }

        return registrationInfo;
    };

    
    const socialConnections = await fetchSolanaSocialConnections();

    return socialConnections;
}

const getTokenTransfers = async (sourceAddress: string, tokenMintAddress: string, destinationAddress: string, excludeAddress: string[]) => {
    
    // HELIUS:
    let hasnext = true;
    let tokenTransfers = null;
    let lastSignature = null;
    while (hasnext){
        let before = "";
        if (lastSignature)
            before = "&before="+lastSignature;
        const url = "https://api.helius.xyz/v0/addresses/"+sourceAddress+"/transactions?api-key="+HELIUS_API+before;
        const { data } = await axios.get(url)
        //console.log("parsed transactions: ", data)

        if (tokenMintAddress){
            
            const filteredData = data.filter(item =>
                item.tokenTransfers.some(transfer => transfer.mint === tokenMintAddress)
            );

            const filteredData2 = excludeAddress ? filteredData.filter(item =>
                item.tokenTransfers.some(transfer => !excludeAddress.includes(transfer?.fromUserAccount))
            ) : filteredData;
            
            const finalData = filteredData2.map(item => ({
                tokenTransfers: item.tokenTransfers,
                timestamp: item.timestamp,
                signature: item.signature,
            }));
            
            //console.log("finalData for ("+tokenMintAddress+"): "+JSON.stringify(finalData));
            //console.log("last tx "+sourceAddress+": "+JSON.stringify(finalData[finalData.length-1]));

            if (data.length > 1){
                hasnext = true;
                //console.log("data here "+JSON.stringify(data[data.length-1]));
                lastSignature = data[data.length-1].signature;
                //console.log("last signature: "+lastSignature);
            } else{
                hasnext = false;
            }

            if (tokenTransfers)
                tokenTransfers = tokenTransfers.concat(finalData);
            else
                tokenTransfers = finalData;
            
            //return finalData;
        }
        //return data;
        
    }
    //console.log("HELIUS token transfers for "+sourceAddress+": "+tokenTransfers.length+" - "+JSON.stringify(tokenTransfers));
    return tokenTransfers;
    
    /*
    const connection = RPC_CONNECTION;
    
    let hasnext = true;
    let offset = 0;
    let limit = 50;
    let resultcount = 0;
    const govTx = new Array();
    while (hasnext){
        //if (setPrimaryStatus) setPrimaryStatus("Fetching Governance Transactions ("+(offset+1)+" - "+(offset+limit)+")");
        const apiUrl = "https://api.solscan.io/account/token/txs";
        
        const response = await axios.get(
            apiUrl, {
            params: {
                address:sourceAddress,
                token_address:tokenAddress,
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

    return govTx;
    */
    
    /*
    try {
        // Get token mint address
        const tokenMintAddress = new PublicKey(tokenAddress);

        // Fetch token account data
        const sourceWalletPublicKey = new PublicKey(sourceAddress);
        const destinationWallet = new PublicKey(destinationAddress);
        
        // Fetch token transfers
        const tokenTransferSignatures = await connection.getConfirmedSignaturesForAddress2(
            sourceWalletPublicKey,
            { limit: 100 } // Adjust the limit as needed
          );
  
        console.log("tokenTransfers: "+JSON.stringify(tokenTransferSignatures))


          // Fetch transaction details for each transfer
        const transfersWithDestination = await Promise.all(
            tokenTransferSignatures.map(async (transfer) => {
              const transaction = await connection.getParsedTransaction(transfer.signature);
              const destination = transaction.transaction.message.accountKeys.find(
                (accountKey) => accountKey.pubkey.toBase58() === destinationAddress
              );
              if (destination) {

                console.log("transaction: "+JSON.stringify(transaction));
                //console.log("transfer: "+JSON.stringify(transfer));

                return {
                  signature: transfer.signature,
                  block: transfer.blockTime,
                  amount: destination?.amount,
                };
              }
              return null;
            })
          );


          // Filter out null values and format transfers
            const validTransfers = transfersWithDestination.filter((transfer) => transfer !== null);
            const formattedTransfers = validTransfers.map((transfer) => ({
            signature: transfer.signature,
            block: transfer.block,
            amount: transfer.amount,
            }));
        
        console.log("filteredTransfers: "+JSON.stringify(formattedTransfers))
        //setTransfers(transfersToDestination);
      } catch (error) {
        console.error('Error fetching token transfers:', error);
      }
    */

    // HELLO MOON

    /*
    const url = PROXY+"https://rest-api.hellomoon.io/v0/token/transfers";

    const config = {
        headers: {
            accept: `application/json`,
            authorization: `Bearer ${HELLO_MOON_BEARER}`,
            'content-type': `application/json`
        },
    };

    hasnext = true;
    offset = 0;
    limit = 1000;
    resultcount = 0;
    const govTx = new Array();
    while (hasnext){
        const data = {
            "type": "transfer",
            "sourceOwner": sourceAddress,
            //"destinationOwner": destinationAddress,
            "mint": tokenMintAddress,
            "limit": limit,
        }

        //console.log("calling "+ JSON.stringify(url))
        //console.log("data "+ JSON.stringify(data))

        const response = await axios.post(url, data, config);
        console.log("HM response: "+ JSON.stringify(response))
        console.log("HM response data: "+ JSON.stringify(response?.data?.data))

        hasnext = false;
    }
    
    return null;
    //return response;
    */

  };

const getAllDomains = async(address: string) => {
    const domain = await findDisplayName(RPC_CONNECTION, address);
    if (domain) {
        //if (domain[0] !== address) {
            //setHasSolanaDomain(true);
            //setSolanaDomain(domain[0]);
            //registrationInfo.bonfida.handle = domain[0];
            return domain;
        //}
    }
    return null;
}

const fetchGovernance = async(address:string, grealm:any, tokenMap: any, governanceLookupItem: any, storagePool: any, wallet: any, setPrimaryStatus: any, setStatus: any) => {
    //const finalList = new Array();
    //setLoading(true);
    //setProposals(null);
    //setCurrentUploadInfo(null);

    let rpcLabel = '';
    const parsedURL = new URL(RPC_ENDPOINT);
    // Split the hostname by '.' and get the last two parts
    const parts = parsedURL.hostname.split('.');
    const mainDomain = parts.slice(-2).join('.');
    rpcLabel = mainDomain;
    
    if (setStatus) setStatus("Fetching Governance - Source: "+rpcLabel);
    const connection = RPC_CONNECTION;
    //console.log("Fetching governance "+address);
    //const grealm = await getRealm(RPC_CONNECTION, new PublicKey(address))
    //setRealm(grealm);

    if (setPrimaryStatus) setPrimaryStatus("Governance Fetched");
    
    let hoursDiff = 0;
    if (governanceLookupItem?.timestamp){
        const lookupTimestamp = moment.unix(Number(governanceLookupItem.timestamp));
        const nowTimestamp = moment();
        hoursDiff = nowTimestamp.diff(lookupTimestamp, 'hours');
        console.log("Governance Cache Hours Ago: "+JSON.stringify(hoursDiff));
    }

    //console.log("Governance: "+JSON.stringify(grealm));

    let gTD = null;
    let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account?.communityMint))
    //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
    gTD = tokenDetails.value.data.parsed.info.decimals;
    if (!gTD){
        if (tokenMap.get(grealm.account?.communityMint.toBase58())){
            //setGovernanceType(0);
            gTD = tokenMap.get(grealm.account?.communityMint.toBase58()).decimals;
            //setGoverningTokenDecimals(gTD);
        } else{
            const btkn = await getBackedTokenMetadata(grealm.account?.communityMint.toBase58(), wallet);
            if (btkn){
                //setGovernanceType(1);
                gTD = btkn.decimals;
                //setGoverningTokenDecimals(gTD)
            } else{
                //setGovernanceType(2);
                gTD = 0;
                //setGoverningTokenDecimals(gTD);
            }
        }
    }

    if (setPrimaryStatus) setPrimaryStatus("Governance Type Verified");

    const realmPk = grealm.pubkey;

    //const treasury = await getNativeTreasuryAddress(programId, realmPk);
    let rawGovernances = await fetchGovernanceVaults(grealm);
    
    const rawFilteredVaults = rawGovernances.filter(
        (gov) =>
          gov.account.accountType === GovernanceAccountType.TokenGovernanceV1 ||
          gov.account.accountType === GovernanceAccountType.TokenGovernanceV2 ||
          gov.account.accountType === GovernanceAccountType.MintGovernanceV1 ||
          gov.account.accountType === GovernanceAccountType.MintGovernanceV2 ||
          gov.account.accountType === GovernanceAccountType.ProgramGovernanceV1 ||
          gov.account.accountType === GovernanceAccountType.ProgramGovernanceV2 ||
          gov.account.accountType === GovernanceAccountType.ProposalV1 ||
          gov.account.accountType === GovernanceAccountType.ProposalV2 ||
          gov.account.accountType === GovernanceAccountType.GovernanceV1 ||
          gov.account.accountType === GovernanceAccountType.GovernanceV2
    );
    
    //setGovernanceVaults(rawFilteredVaults);
    
    const vaultsInfo = rawFilteredVaults.map((governance) => {
        return {
            pubkey: governance.pubkey.toBase58(), // program that controls vault/token account
            vaultId: governance.account?.governedAccount.toBase58(), // vault/token account where tokens are held
            governance: governance,
            isGovernanceVault: true,
            nativeTreasuryAddress: null,
            domains: null,
        };
    });

    //console.log("vaultsInfo: ("+vaultsInfo.length+") "+JSON.stringify(vaultsInfo))

    const rawNativeSolAddresses = await Promise.all(
        rawGovernances.map((x) =>
            getNativeTreasuryAddress(
            //@ts-ignore
            new PublicKey(grealm.owner),
            x!.pubkey
            )
        )
    );

    // add the native treasury address for governance rules
    rawNativeSolAddresses.forEach((rawAddress, index) => {
        vaultsInfo[index].nativeTreasuryAddress = rawAddress
    });

    //console.log("rawNativeSolAddresses: ("+rawNativeSolAddresses.length+") "+JSON.stringify(rawNativeSolAddresses))

    //console.log("rawNativeSolAddresses: "+JSON.stringify(rawNativeSolAddresses))
   
    rawNativeSolAddresses.forEach((rawAddress, index) => {
        vaultsInfo.push({
          pubkey: rawAddress.toBase58(), // program that controls vault/token account
          vaultId: index.toString(), // vault/token account where tokens are held
          governance: null,
          isGovernanceVault: false,
        });
    });



    //console.log("rawNativeSolAddresses: "+JSON.stringify(rawNativeSolAddresses))
    if (setPrimaryStatus) setPrimaryStatus("Fetching Treasury Sol Balance");

    const vaultSolBalancesPromise = await Promise.all(
        vaultsInfo.map((vault) =>
          connection.getBalance(new PublicKey(vault?.pubkey))
        )
    );


    /*
    const STAKING_PROGRAM_ID = new PublicKey('Stake11111111111111111111111111111111111111');
    
    const vaultStakeBalancesPromise = await Promise.all(
        vaultsInfo.map((vault) =>
            connection.getProgramAccounts(STAKING_PROGRAM_ID, {
                filters: [
                { dataSize: 200 }, // make sure to filter for only stake accounts
                { memcmp: { offset: 32, bytes: new PublicKey(vault?.pubkey).toBase58() } }, // filter for stake accounts associated with the wallet address
                ],
            })
        )
    );

    const mystake = await connection.getProgramAccounts(STAKING_PROGRAM_ID, {
        filters: [
        { dataSize: 200 }, // make sure to filter for only stake accounts
        { memcmp: { offset: 32, bytes: new PublicKey("---").toBase58() } }, // filter for stake accounts associated with the wallet address
        ],
    })


    console.log("Staked: "+JSON.stringify(vaultStakeBalancesPromise));
    console.log("My Staked: "+JSON.stringify(mystake));
    */

    if (setPrimaryStatus) setPrimaryStatus("Fetching Treasury Token Accounts");
    
    const vaultsWithTokensPromise = await Promise.all(
        vaultsInfo.map((vault) =>
          connection.getParsedTokenAccountsByOwner(
            new PublicKey(vault.pubkey),
            {
              programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            }
          )
        )
    );

    console.log("vaultsWithTokensPromise: "+JSON.stringify(vaultsWithTokensPromise))

    if (setPrimaryStatus) setPrimaryStatus("Fetching Treasury NFTs");

    const client = new RestClient(HELLO_MOON_BEARER);
    const vaultsWithNftsPromise = await Promise.all(
        vaultsInfo.map((vault) =>
            client.send(new NftMintsByOwnerRequest({
                ownerAccount: vault.pubkey,
                limit: 1000
            }))
        )
    );

    //console.log("vaultSolBalancesPromise "+JSON.stringify(vaultSolBalancesPromise));
    //console.log("vaultsWithTokensPromise "+JSON.stringify(vaultsWithTokensPromise));
    console.log("vaultsWithNftsPromise "+JSON.stringify(vaultsWithNftsPromise));
    
    // loop through all tokens to get their respective values
    
    const vaultsInflated = new Array();
    let x = 0;
    for (var gv of vaultsInfo){ // reformat to something pretty ;)
        console.log("vault: "+JSON.stringify(gv));

        const domainsForAddress = await getAllDomains(gv.pubkey);
        console.log("SNS: "+JSON.stringify(domainsForAddress));
        
        vaultsInflated.push({
            vault:gv,
            solBalance:vaultSolBalancesPromise[x],
            tokens:vaultsWithTokensPromise[x],
            nfts:vaultsWithNftsPromise[x].data,
            domains:domainsForAddress,
        })
        x++;
    }

    //console.log("vaultsInflated: "+JSON.stringify(vaultsInflated))

    let totalVaultValue = 0;
    let totalVaultSol = 0;
    let totalVaultSolValue = 0;
    let totalVaultNftValue = 0;
    let totalVaultNftValueSol = 0;
    let totalVaultNftValueUSDC = 0;
    const treasuryAssets = new Array();
    const cgArray = ["solana"]//new Array();
    const cgMintArray = ["So11111111111111111111111111111111111111112"];

    for (var vi of vaultsInflated){
        //console.log('VAULT: '+JSON.stringify(gv))
        console.log('***************************************************');
        console.log('*** TOKEN BALANCE: '+new PublicKey(vi.vault.pubkey).toBase58())+" ***";

        var assetsIdentified = 0;
        var assetsNotIdentified = 0;
        var nftsIdentified = 0;
        const identifiedAssets = new Array();
        const notIdentifiedAssets = new Array();
        
        //console.log("SOL Balance: "+vi.solBalance);

        //console.log("vi.tokens:" + JSON.stringify(vi.tokens))

        if (vi?.tokens){
            for (const thisitem of vi.tokens.value){
                const ta = thisitem.account.data.parsed.info.tokenAmount.amount;
                const td = thisitem.account.data.parsed.info.tokenAmount.decimals;
                const tf = thisitem.account.data.parsed.info.tokenAmount.amount/Math.pow(10, (thisitem.account.data.parsed.info.tokenAmount.decimals || 0));;
                let tn = tokenMap.get(new PublicKey(thisitem.account.data.parsed.info.mint).toBase58())?.name;
                let tl = tokenMap.get(new PublicKey(thisitem.account.data.parsed.info.mint).toBase58())?.logoURI;
                const cgid = tokenMap.get(new PublicKey(thisitem.account.data.parsed.info.mint).toBase58())?.extensions?.coingeckoId;

                if (!tn){
                    
                    //const getTokenMintInfo = async() => {
                    try{
                        const mint_address = new PublicKey(thisitem.account.data.parsed.info.mint)
                        const [pda, bump] = await PublicKey.findProgramAddress([
                            Buffer.from("metadata"),
                            PROGRAM_ID.toBuffer(),
                            new PublicKey(mint_address).toBuffer(),
                        ], PROGRAM_ID)
                        const tokenMetadata = await Metadata.fromAccountAddress(connection, pda)
                        
                        if (tokenMetadata?.data?.name)
                            tn = (tokenMetadata.data.name);
                        
                        if (tokenMetadata?.data?.uri){
                            try{
                                const metadata = await window.fetch(tokenMetadata.data.uri)
                                .then(
                                    (res: any) => res.json())
                                .catch((error) => {
                                    // Handle any errors that occur during the fetch or parsing JSON
                                    console.error("Error fetching data:", error);
                                });
                                
                                if (metadata && metadata?.image){
                                    if (metadata.image)
                                        tl = (metadata.image);
                                }
                            }catch(err){
                                console.log("ERR 1: ",err);
                            }
                        }
                    }catch(e){
                        console.log("ERR 2: ",e)
                    }
                }

                if ((ta > 0) && (ta !== 1 && td !== 0)){
                    assetsIdentified++;
                    
                    //console.log(tn+": "+tf);
                    
                    thisitem.account.tokenMap = {
                        tokenAddress:new PublicKey(thisitem.account.data.parsed.info.mint).toBase58(),
                        tokenAmount:ta,
                        tokenDecimals:td,
                        tokenUiAmount:tf,
                        tokenName:tn,
                        tokenLogo:tl,
                        tokenCgId:cgid
                    }
                    
                    var cgFound = false;
                    for (var cgitem of cgArray){ // only fetch this ones
                        if (cgitem === cgid)
                            cgFound;
                    }
                    if ((!cgFound) && (cgid)){
                        cgArray.push(cgid);
                    }
                    cgMintArray.push(new PublicKey(thisitem.account.data.parsed.info.mint).toBase58());
                } else{
                    // these could be NFTs or other assets not in the tokenMap
                    //console.log("-------:::::: "+tn+": "+tf);
                    assetsNotIdentified++;
                    notIdentifiedAssets.push({
                        tokenAddress:new PublicKey(thisitem.account.data.parsed.info.mint).toBase58(),
                        tokenAmount:ta,
                        tokenDecimals:td,
                        tokenUiAmount:tf,
                    })

                    // try hellomoon?
                    //const client = new RestClient(HELLO_MOON_BEARER);
                }
            }
        }

        if (setPrimaryStatus) setPrimaryStatus("Fetching Treasury NFT Floor Prices");

        if (vi?.nfts){
            for (const thisitem of vi.nfts){
                console.log("Getting floor price for: "+thisitem.nftMint)
                console.log("HM: "+thisitem?.helloMoonCollectionId)
                
                console.log("URI: "+JSON.stringify(thisitem?.metadataJson?.uri))
                
                if (thisitem?.metadataJson?.uri){
                    try{
                        const metadata = await window.fetch(thisitem.metadataJson.uri).then(
                            (res: any) => res.json());
                        if (metadata?.image)
                            thisitem.metadataImage = metadata.image;
                    }catch(merr){
                        console.log("ERR: "+merr);
                    }
                }

                if (thisitem?.helloMoonCollectionId){
                    if (setPrimaryStatus) setPrimaryStatus("Fetching Treasury NFT Floor Prices ("+thisitem.nftMint+")");
                    const results = await client.send(new CollectionFloorpriceRequest({
                        helloMoonCollectionId: thisitem.helloMoonCollectionId,
                        limit: 1000
                    }))
                        .then(x => {
                            //console.log; 
                            return x;})
                        .catch(console.error);

                        if (results?.data){
                            for (var resitem of results.data){
                                //console.log("FLR price for "+thisitem.nftMint+": "+(+resitem.floorPriceLamports/10**9))
                                if (+resitem.floorPriceLamports > 0){
                                    thisitem.listingCount = resitem.listing_count;
                                    thisitem.floorPriceLamports = resitem.floorPriceLamports;
                                    nftsIdentified++;
                                    totalVaultNftValueSol += +resitem.floorPriceLamports;
                                    console.log("adding: "+(+resitem.floorPriceLamports))
                                    console.log("totalVaultNftValueSol: "+totalVaultNftValueSol)
                                    //totalVaultNftValue += resitem.floorPriceLamports
                                    setPrimaryStatus("Treasury NFT Floor Prices ("+thisitem.nftMint+" floor at "+resitem.floorPriceLamports+" lamports)");
                                    break;
                                    //setPrimaryStatus("Treasury NFT Floor Prices ("+thisitem.nftMint+" floor at "+(+resitem.floorPriceLamports/10**9)+" lamports)");
                                }
                                
                            }
                        }
                } // use Helius or traditional RPC as an alternative 
                
                /*else{
                    const results = await client.send(new NftMintPriceByCreatorAvgRequest({
                        nftMint: thisitem.nftMint,
                        limit: 1000
                    }))
                        .then(x => {
                            //console.log; 
                            return x;})
                        .catch(console.error);
                    
                    //console.log("results: "+JSON.stringify(results));
                    
                    if (results?.data){
                        for (var resitem of results.data){
                            console.log("AVG price for: "+resitem.avg_usd_price)
                            if (+resitem.avg_usd_price > 0){
                                thisitem.numSales = resitem.num_sales;
                                thisitem.avgUsdPrice = resitem.avg_usd_price;
                                nftsIdentified++;
                                totalVaultNftValue += resitem.avg_usd_price
                            }
                            
                        }
                    }
                }*/
            }
        }
        if (assetsNotIdentified > 0)
            console.log("Assets not identified (possibly NFTs or not mapped tokens): "+assetsNotIdentified)
        console.log("Total Tokens: "+(assetsIdentified+assetsNotIdentified));
    }

    // consider jupiter as a backup... (per token address)

    if (setPrimaryStatus) setPrimaryStatus("Fetching Prices from Jupiter");

    const cgp = await getJupiterPrices(cgMintArray);

    if (setPrimaryStatus) setPrimaryStatus("Associating Fetched Prices from Jupiter");
    let totalVaultStableCoinValue = 0;
    for (var ia of vaultsInflated){
        let vaultValue = 0;
        
        console.log("*********** "+new PublicKey(ia.vault.pubkey).toBase58()+ " ***********");
        for (var iat of ia?.tokens.value){
            if (iat.account?.tokenMap){
                if (cgp[iat.account.tokenMap.tokenAddress]){
                    ia.cgInfo = cgp[iat.account.tokenMap.tokenAddress]
                    vaultValue += cgp[iat.account.tokenMap.tokenAddress].price*iat.account.tokenMap.tokenUiAmount;
                    totalVaultValue += cgp[iat.account.tokenMap.tokenAddress].price*iat.account.tokenMap.tokenUiAmount;

                    // check if stable coin?
                    if ((iat.account.tokenMap.tokenAddress === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")||
                        (iat.account.tokenMap.tokenAddress === "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")||
                        (iat.account.tokenMap.tokenAddress === "BQcdHdAQW1hczDbBi9hiegXAR7A98Q9jx3X3iBBBDiq4")||
                        (iat.account.tokenMap.tokenAddress === "D3KdBta3p53RV5FoahnJM5tP45h6Fd3AyFYgXTJvGCaK")||
                        (iat.account.tokenMap.tokenAddress === "Ea5SjE2Y6yvCeW5dYTn7PYMuW5ikXkvbGdcmSnXeaLjS")){
                        totalVaultStableCoinValue += cgp[iat.account.tokenMap.tokenAddress].price*iat.account.tokenMap.tokenUiAmount
                    }
                }

                /*
                if (cgp[iat.account.tokenMap.tokenAddress]){
                    console.log("tokenAddress: "+iat.account.tokenMap.tokenAddress);
                    console.log("tokenUiAmount: "+iat.account.tokenMap.tokenUiAmount);
                    console.log("convertedValue: "+cgp[iat.account.tokenMap.tokenAddress].price*iat.account.tokenMap.tokenUiAmount);
                }*/
                
            
            }
        }
        //ia.solToUsd = cgp['solana'].usd;
        ia.solToUsd = cgp['So11111111111111111111111111111111111111112'].price;
        ia.solUsdValue = (ia.solBalance > 0 ? cgp['So11111111111111111111111111111111111111112'].price*(ia.solBalance/(10 ** 9)) : 0);
        console.log("Total NFT Sol Value: "+(totalVaultNftValueSol/(10 ** 9)))
        console.log("Aggregate Total NFT Sol Value: "+(totalVaultNftValueSol/(10 ** 9)))
        totalVaultNftValueUSDC = (totalVaultNftValueSol > 0 ? cgp['So11111111111111111111111111111111111111112'].price*(totalVaultNftValueSol/(10 ** 9)) : 0);
        vaultValue += ia.solUsdValue;
        totalVaultSolValue += ia.solUsdValue;
        totalVaultSol += ia.solBalance > 0 ? ia.solBalance/(10 ** 9) : 0;
        totalVaultValue += ia.solUsdValue;
        console.log(new PublicKey(ia.vault.pubkey).toBase58()+" vaultSolValue ("+(ia.solBalance/(10 ** 9))+"): "+ia.solUsdValue);
        
        console.log(new PublicKey(ia.vault.pubkey).toBase58()+" vaultValue: "+vaultValue);
    
    }
    //console.log("vaultsInflated: "+JSON.stringify(vaultsInflated));
    
    // using the same order we can push the results accordingly
    
    console.log("total value: "+totalVaultValue); 
    //setGovernanceVaultTotalValue(totalVaultValue);
    //setGovernanceVaultStableCoinValue(totalVaultStableCoinValue);
    //setGovernanceVaultNftValue(totalVaultNftValue);
    //console.log("Vaults: "+JSON.stringify(treasuryAssets));
    //setGovernanceVaultsDetails(vaultsInflated);
    const governanceVaultsString = JSON.stringify(vaultsInflated);
    //setVaultsStringGenerated(governanceVaultsString);
    
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
                        //setNftBasedGovernance(true);
                    }
                }
            }catch(errs){
                console.log("ERR: "+errs)
            }
        }

        if (setPrimaryStatus) setPrimaryStatus("Fetching Governance Transactions");
        // https://api.solscan.io/account/token/txs?address=By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip&offset=0&limit=50&cluster=

        // this will be used to monitor inflows / outflows?
        // .fetch
        let hasnext = true;
        let offset = 0;
        let limit = 50;
        let resultcount = 0;
        const govTx = new Array();
        while (hasnext){
            if (setPrimaryStatus) setPrimaryStatus("Fetching Governance Transactions ("+(offset+1)+" - "+(offset+limit)+")");
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
        //setGovernanceTransactions(govTx);
        

        if (setPrimaryStatus) setPrimaryStatus("Fetching Token Owner Records");

        // to do get member map
        
        // check #tokens deposited

        // loop all token holders and get the assets they have in their wallet matching the governingtokenmint
        // grealm.account?.communityMint.toBase58()
        //console.log("communityMint: "+JSON.stringify(grealm.account?.communityMint.toBase58()))
        //console.log("rawTokenOwnerRecords "+JSON.stringify(rawTokenOwnerRecords))
        
        const commMint = grealm.account?.communityMint;
        var governanceEmitted = [];
        let getAwards = false; // adjust if we want to get rewards for the following emitting pubkeys
        if (!getAwards || hoursDiff > (24*30)){ // refresh every 30 days
        //    getAwards = true;
        }
        
        let linkedWallets = {
        //    "7pPJt2xoEoPy8x8Hf2D6U6oLfNa5uKmHHRwkENVoaxmA":"222pEN8xcEwjVbtZfF7HaFRvxGsjBbWj3mqFWV8dNgL1",
        }
        let excludeSignatures = [
            "2hrrpPLsuVD9bmpNkGSFSQQ9akP69hwwN4ZgVeh55Pha8Xz4GqD2HwYYEWjeFZPbPEM6es6coDeXVsYnSrH7qgqG",
            "53pmQGjzEroW72MBEqFac8yNEAW9yXqFGTu3ZBQykobkVNjcioajzBMjGt2w8Pve7mwbQzxpXMTWZfrv63JzH1L6"
        ]
        
        if (commMint && getAwards){
            if (commMint.toBase58() === "8upjSpvjcdpuzhfR1zriwg5NXkwDruejqNE9WNbPRtyA"){
                // check all governance wallets and build a list
                const voterRewardsEmitWallets = [
                    //"AWaMVkukciGYPEpJbnmSXPJzVxuuMFz1gWYBkznJ2qbq",
                    //"6jEQpEnoSRPP8A2w6DWDQDpqrQTJvG4HinaugiBGtQKD",
                    //"mRh2wFi6rQEoFzWKQ2KsyMySZ36NEmyL5qTv7H6J7vs",
                    //"7ZNjtUgPYL8kNfoPewEnafy4TiKWMs3QsQNYkGx9TawJ",
                    //"Ef3AHWKWeowSugvyWkpdDGiKK8vBxXGcABfnABKb5rTr",
                    //"F3RJjd9Zotaj7PKL7yHvJgyjzxq2iwV4rWDim3rGFLKV",
                    "EjPvwq8GB2isU7JakaQk2pPmonJrTCTpsJastBcmm7XT",
                    "6WQ1cjJWPz9Ab72iL1myK19Uza8ESty9STSq4WBXkde9",
                    "7qzjXQqT6jxEFTfbTLvQv6vrsYDJUPvk9XVsk7yxKncD",
                    "9eYJBViDGBXcf61WQfUDdwxtKyVjjLxyKtEhKs35SPnU",
                    "6XnsmBGrbRRsvRLWpZMHZhKEFJZGDvJ5QmqcC6niASYp",
                    "8uLbghsxMg6HBrMG494xihP4i8LZmfLr5Qiqdo5KYKUp",
                    "4WJBTv6f3byCMu8ZAxBXe4MVEPt5ZnTkKowR9xzm17JL",
                    "CKpFpBw3ZoDN6ZV62tkqKoJua7oqes328XgyewttKT28",
                    //"E44MSZKzey1sEYhPvUk6MjgUTQNmFEEUahxmdPkBtAND",
                    "9n4wcMKGcUSWGmeCNt5gbprqkLjLaWK6j9JcCxyDscHx",
                    "8V1nn3jG6uXHcHyBgLt5iaMNFSPdsmAsXV8zjizYaLHz",
                    "F5UMGig7FFAg6XNkdtT9EyC7Yzq9wGrqWbfccE6DE4Y2", // squads bounty
                    "4aBKsrMXHmMq5i3jYi8CfZjhNmmMJqcC1D37QPAz55hV", // meanfi?
                    //"GXGVxwRmxKPC7agUS97RdA9FkWwQmvF6MDTEPLwsSDJy" // user wallet (ATA) that has sent out emissions
                ];
                
                const excludeAddress = [
                    "7ZNjtUgPYL8kNfoPewEnafy4TiKWMs3QsQNYkGx9TawJ",
                    "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip"
                ];

                for (var rewardsWallet of voterRewardsEmitWallets){
                    const emitted_governance = await getTokenTransfers(rewardsWallet, commMint.toBase58(), null, excludeAddress);
                    if (emitted_governance && emitted_governance.length > 0){
                        //console.log("emitted: "+emitted_governance);
                        governanceEmitted = governanceEmitted.concat(emitted_governance);
                    }
                }

                governanceEmitted = removeDuplicateSignatures(governanceEmitted);
            }
        }

        console.log("Total emitted wallets: "+governanceEmitted.length);
        
        //console.log("rawTokenOwnerRecords "+JSON.stringify(rawTokenOwnerRecords))
        // get unique members
        const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(grealm.owner), realmPk)
        //setMemberMap(rawTokenOwnerRecords);
        // fetch current records if available
        let cached_members = new Array();
        if (governanceLookupItem?.memberFilename){
            cached_members = await getFileFromLookup(governanceLookupItem.memberFilename, storagePool);
        }

        // check token owner records
        let mcount = 0;
        for (const owner of rawTokenOwnerRecords){
            mcount++;
            if (setPrimaryStatus) setPrimaryStatus("Fetching Token Owner Records - "+mcount+" of "+rawTokenOwnerRecords.length+" Member Wallet Balance");
            const tokenOwnerRecord = owner.account.governingTokenOwner;
            
            // IMPORTANT to speed this up check first tx for mmember wallet...

            var hasBeenFound = false;
            var hasFtd = false;
            var hasMltsg = false;
            var hasWalletCommunityBalance = false;
            var hasWalletCouncilBalance = false;
            var hasAwards = false;
            if (cached_members && cached_members.length > 0){
                for (let cachedOwner of cached_members){ // smart fetching so we do not query this call again
                    if (cachedOwner.account.governingTokenOwner === tokenOwnerRecord.toBase58()){
                        hasBeenFound = true;
                        
                        // get any handles / domains linked
                        if (cachedOwner?.socialConnections){
                            owner.socialConnections = cachedOwner?.socialConnections;
                        } else{
                            const socialConnections = await getSocialConnections(tokenOwnerRecord.toBase58());
                            if (socialConnections){
                                owner.socialConnections = socialConnections;
                                console.log("socialConnections "+tokenOwnerRecord.toBase58()+": "+JSON.stringify(socialConnections))
                            }else {
                                owner.socialConnections = null;
                                console.log("no socialConnections for "+tokenOwnerRecord.toBase58()+"")
                            }
                        }
                        
                        if (cachedOwner?.firstTransactionDate){
                            owner.firstTransactionDate = cachedOwner.firstTransactionDate;
                            hasFtd = true;
                        }
                        if (cachedOwner?.multisigs){
                            owner.multisigs = cachedOwner?.multisigs;
                            hasMltsg = true;
                        }
                        if (cachedOwner?.walletBalance){
                            owner.walletBalance = cachedOwner.walletBalance;
                            hasWalletCommunityBalance = true;
                        }
                        if (cachedOwner?.walletCouncilBalance){
                            owner.walletCouncilBalance = cachedOwner.walletCouncilBalance;
                            hasWalletCouncilBalance = true;
                        }
                        if (cachedOwner?.governanceAwards && cachedOwner?.governanceAwardDetails){
                            if (!getAwards){
                                owner.governanceAwards = cachedOwner.governanceAwards;
                                owner.governanceAwardDetails = cachedOwner.governanceAwardDetails;
                                hasAwards = true;
                            }
                        }
                        
                    }
                }
            }

            if (!hasBeenFound){

            }

            if (!hasAwards){
                if (grealm.account?.communityMint){
                    // get all emitted to this wallet
                    // we should save also all instances to keep historic data
                    if (governanceEmitted && governanceEmitted.length > 0){
                        for (let emitItem of governanceEmitted){
                            if (!excludeSignatures.some(address => emitItem.signature.includes(address))){
                                if (emitItem.tokenTransfers){
                                    for (let tTransfer of emitItem.tokenTransfers){
                                        let awardWallet = false;
                                        
                                        let linkedWallet = null;
                                        if (linkedWallets.hasOwnProperty(tokenOwnerRecord.toBase58())) {
                                            linkedWallet = linkedWallets[tokenOwnerRecord.toBase58()];
                                        }

                                        if (tTransfer.toUserAccount === tokenOwnerRecord.toBase58() &&
                                            tTransfer.toUserAccount !== "GrapevviL94JZRiZwn2LjpWtmDacXU8QhAJvzpUMMFdL"){
                                                awardWallet = true;
                                        } else if (tTransfer.toUserAccount === linkedWallet &&
                                            tTransfer.toUserAccount !== "GrapevviL94JZRiZwn2LjpWtmDacXU8QhAJvzpUMMFdL"){
                                                awardWallet = true;
                                        }                                        

                                        if (awardWallet){
                                            if (owner?.governanceAwards){
                                                owner.governanceAwards += +tTransfer.tokenAmount;
                                                owner.governanceAwardDetails.push({
                                                    tokenTransfers:tTransfer,
                                                    signature:emitItem.signature,
                                                    timestamp:emitItem.timestamp
                                                });
                                            }else{
                                                owner.governanceAwards = +tTransfer.tokenAmount;
                                                owner.governanceAwardDetails = new Array();
                                                owner.governanceAwardDetails.push({
                                                    tokenTransfers:tTransfer,
                                                    signature:emitItem.signature,
                                                    timestamp:emitItem.timestamp
                                                });
                                            }
                                            //if (+tTransfer.tokenAmount >= 200000)
                                            //    console.log("Emitted rewards (> 200k) "+tTransfer.toUserAccount+" (source: "+tTransfer.fromUserAccount+"): "+tTransfer.tokenAmount+" balance: "+owner.governanceAwards + " - sig: "+emitItem.signature)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            /*
            //if (!hasWalletCommunityBalance || hoursDiff > (24*3)){ // refresh every 3 days
                //if (tokenOwnerRecord.toBase58() === 'KirkNf6VGMgc8dcbp5Zx3EKbDzN6goyTBMKN9hxSnBT'){
                //if (tokenOwnerRecord.toBase58() === '3PKhzE9wuEkGPHHu2sNCvG86xNtDJduAcyBPXpE6cSNt'){
                    const url = `https://api.helius.xyz/v0/addresses/${tokenOwnerRecord.toBase58()}/transactions?api-key=${HELIUS_API}&type=TRANSFER`
                    const response = await fetch(url);
                    const data = await response.json();
                    console.log(tokenOwnerRecord.toBase58()+" wallet transactions: ", data);
                //}
            //}
            */

            if (!hasWalletCommunityBalance || hoursDiff > (24*3)){ // refresh every 3 days
                if (grealm.account?.communityMint){
                    const balance = await connection.getParsedTokenAccountsByOwner(tokenOwnerRecord,{mint:grealm.account.communityMint});
                    //console.log(tokenOwnerRecord.toBase58()+" "+JSON.stringify(balance));
                    if (balance?.value[0]?.account?.data?.parsed?.info)    
                        owner.walletBalance = balance.value[0].account.data.parsed.info;
                }
            }
            if (!hasWalletCouncilBalance || hoursDiff > (24*30)){ // refresh every 30 days
                if (grealm.account?.councilMint){
                    const balance = await connection.getParsedTokenAccountsByOwner(tokenOwnerRecord,{mint:grealm.account.councilMint});
                    //console.log(tokenOwnerRecord.toBase58()+" "+JSON.stringify(balance));
                    if (balance?.value[0]?.account?.data?.parsed?.info)    
                        owner.walletCouncilBalance = balance.value[0].account.data.parsed.info;
                }
            }
            
            if (!hasMltsg || hoursDiff > (24*15)){ // refresh every 15 days
                try{
                    const squadsMultisigs = "https://rust-api-sd2oj.ondigitalocean.app/multisig?address="+tokenOwnerRecord.toBase58()+"&useProd=true"
                    const multisigs = await window.fetch(squadsMultisigs).then(
                        (res: any) => res.json());
                    if (multisigs?.multisigs)
                        owner.multisigs = multisigs;
                    else
                        owner.multisigs = {multisigs:[]};
                }catch(merr){
                    console.log("ERR: "+merr);
                }
            }

            if (!hasFtd){
                let ftd = await getFirstTransactionDate(tokenOwnerRecord.toBase58());
                if (ftd){
                    const txBlockTime = moment.unix(ftd)
                    owner.firstTransactionDate = ftd;
                    console.log("First Transaction Date for "+tokenOwnerRecord.toBase58()+": "+txBlockTime.format('llll'));
                    if (setPrimaryStatus) setPrimaryStatus("Fetching Token Owner Records - "+mcount+" of "+rawTokenOwnerRecords.length+" Member Wallet Balance - "+tokenOwnerRecord.toBase58()+" "+txBlockTime.format(''));
                }
            }

        }

        if (setPrimaryStatus) setPrimaryStatus("Fetching All Proposals");

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
        let lastpropdate = null
        if (sortedResults && sortedResults.length > 0)
            if (sortedResults[0].account?.draftAt)
                lastpropdate = sortedResults[0].account?.draftAt
        
    //setLastProposalDate(lastpropdate)
        
    //setPrimaryStatus("Fetched Governance: "+grealm.account.name+" "+address+" with "+sortedResults.length+" proposals");
    //setGovernanceName(grealm.account.name);

    //console.log("proposals: "+JSON.stringify(sortedResults));
    //setTotalCouncilProposals(council);
    //setTotalDefeated(defeated);
    //setTotalPassed(passed);
    //setTotalProposalsVoting(voting);
    //setTotalProposals(sortedResults.length);
    //setTotalTotalVotesCasted(ttvc);

    //setProposals(sortedResults);

    //setMax(sortedResults.length);
    //setLoading(false);
    
    const governanceDetails = {
        address: address,
        totalVaultValue: totalVaultValue,
        totalVaultSol: totalVaultSol,
        totalVaultSolValue: totalVaultSolValue,
        totalVaultStableCoinValue:totalVaultStableCoinValue,
        totalVaultNftValue:totalVaultNftValueUSDC,
        vaultsInflated: vaultsInflated,
        governanceVaultsString: governanceVaultsString,
        governanceVaults: rawFilteredVaults,
        memberMap: rawTokenOwnerRecords,
        proposals: sortedResults,
        totalProposals: sortedResults.length,
        totalProposalsVoting: voting,
        totalPassed: passed,
        totalDefeated: defeated,
        totalCouncilProposals: council,
        governanceName: grealm.account.name,
        lastProposalDate: lastpropdate,
        transactions: govTx
    }
    
    return governanceDetails;
}

const fetchProposalData = async(address:string, finalList:any, forceSkip:boolean, this_realm: any, connection: Connection, wallet: any, tokenMap: any, storagePool: any, governanceLookup: any, setSecondaryStatus: any, setProgress: any) => {
    
    let govAddress = address;
    
    //setSolanaVotingResultRows(null);
    let x=0;
    let length = finalList.length;
    //setMax(length);
    let MIN = 0;
    const normalise = (value:number) => ((value - MIN) * 100) / (length - MIN);

    let cached_governance = new Array();
    if (governanceLookup){
        for (let glitem of governanceLookup){
            if (new PublicKey(glitem.governanceAddress).toBase58() === new PublicKey(govAddress).toBase58()){
                //console.log(glitem.governanceAddress + " vs " + new PublicKey(governanceAddress).toBase58())
                cached_governance = await getGovernanceFromLookup(glitem.filename, storagePool);
            }
        }
    }

    let ggv = null;
    for (var thisitem of finalList){
        x++;
        if (forceSkip)
            if (setSecondaryStatus) setSecondaryStatus("Fetching "+x+" of "+length);
        else
            if (setSecondaryStatus) setSecondaryStatus("Smart Fetching "+x+" of "+length);
        
        console.log("Processing: "+x+" of "+length);

        if (setProgress) setProgress((prevProgress:any) => (prevProgress >= 100 ? 0 : normalise(x)));
        
        try {
            let skip_process = false;
            if (cached_governance && cached_governance.length > 0){
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

            console.log("******* PROP ("+x+") FETCH *******")
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
                //console.log("vrs check 0 "+JSON.stringify(this_realm));
                //setLoadingParticipants(true);

                let td = 6; // this is the default for NFT mints
                let vType = null;
                try{
                    td = tokenMap.get(thisitem?.account?.governingTokenMint?.toBase58()).decimals;
                    vType = 'Token';
                    //console.log("tokenMap: "+tokenMap.get(thisitem.account.governingTokenMint?.toBase58()).decimals);
                }catch(e){
                    //console.log("ERR: "+e);
                }
                
                //console.log("vrs check 0 "+JSON.stringify(this_realm));

                if (this_realm?.account?.config?.councilMint){
                    if (this_realm.account.config.councilMint?.toBase58() === thisitem?.account?.governingTokenMint?.toBase58()){
                        vType = 'Council';
                        td = 0;
                    }
                }

                //console.log("vrs check 1")

                if (!vType){
                    // check if backed token
                    // important check if we have already fetched this data already
                    const btkn = await getBackedTokenMetadata(thisitem?.account?.governingTokenMint?.toBase58(), wallet);
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
                //setTokenDecimals(td);
                //setVoteType(vType)

                //console.log("vrs check 2 m:"+JSON.stringify(memberMap))

                if (vType){
                    //setPropVoteType(vType);
                    /*
                    for (const item of memberMap){
                        if (item.pubkey.toBase58() === thisitem.account.tokenOwnerRecord.toBase58()){
                            setProposalAuthor(item.account.governingTokenOwner.toBase58())
                            //console.log("member:" + JSON.stringify(item));
                        }
                    }*/
                }

                //console.log("vrs check 3")

                //console.log("CALLING getGovernanceProps ********************--------------------------------")
                ggv = await getGovernanceProps(thisitem, this_realm, connection);
                //console.log("CALLED ggv ********************--------------------------------"+ggv)
                
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

                    //console.log("vrs check inner 1")
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

                        //console.log("VRS pushing "+counter)
                        //console.log("VRS pushing item "+JSON.stringify(item))

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
                                decimals:((this_realm.account.config?.councilMint && this_realm.account.config?.councilMint?.toBase58() === thisitem.account.governingTokenMint?.toBase58()) ? 0 : td),
                                councilMint:(this_realm.account.config?.councilMint ? new PublicKey(this_realm.account.config?.councilMint).toBase58() : null),
                                governingTokenMint:thisitem.account.governingTokenMint?.toBase58() 
                            }
                        }

                        vrs.push(vrs_item)

                        //console.log("PUSHED "+JSON.stringify(vrs_item))
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

                //setUniqueYes(uYes);
                //setUniqueNo(uNo);
                
                thisitem.votingResults = vrs;
                thisitem.instructions = instructions;
            }
        } catch (e) { // Handle errors from invalid calls
            
        }
    }

    //console.log("setting finalList: "+JSON.stringify(finalList))
    //setSolanaVotingResultRows(finalList)

    return {
        ggv:ggv,
        finalList:finalList};
}

const getGovernanceProps = async (thisitem: any, this_realm: any, connection: Connection) => {
    const governance = await getGovernance(connection, thisitem.account.governance);
    
    //console.log("FETCHING THIS GOV")
    //getGovernanceAccounts();
    
    //setThisGovernance(governance);
    
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
        //setGoverningMintInfo(governingMintPromise);
        
        const communityWeight = governingMintPromise.value.data.parsed.info.supply - this_realm.account.config.minCommunityTokensToCreateGovernance.toNumber();
        //console.log("communityWeight: "+communityWeight);
        
        const communityMintMaxVoteWeightSource = this_realm.account.config.communityMintMaxVoteWeightSource
        const supplyFractionPercentage = communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
        const communityVoteThreshold = governance.account.config.communityVoteThreshold
        const councilVoteThreshold = governance.account.config.councilVoteThreshold
        
        //console.log("supplyFractionPercentage: "+supplyFractionPercentage)
        //console.log("communityVoteThreshold: "+JSON.stringify(communityVoteThreshold))
        //console.log("councilVoteThreshold: "+JSON.stringify(councilVoteThreshold))

        //const mintSupply = governingMintPromise.value.data.data.parsed.info.supply;
        //const mintDecimals = governingMintPromise.value.data.data.parsed.info.decimals; 
        
        const voteThresholdPercentage= 
            (this_realm.account.config?.councilMint && new PublicKey(this_realm.account.config?.councilMint).toBase58() === thisitem.account.governingTokenMint.toBase58())
            ? councilVoteThreshold.value
            : communityVoteThreshold.value
        
        const tSupply = Number(governingMintPromise.value.data.parsed.info.supply/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals)) 
        
        //setTotalSupply(tSupply);
        
        const totalVotes =
            Number(governingMintPromise.value.data.parsed.info.supply/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals))  *
            //Number(communityWeight/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals))  *
            (voteThresholdPercentage * 0.01) *
              (Number(supplyFractionPercentage) / 100);
        
        //console.log("totalVotes: "+totalVotes)
        //console.log("voteThresholdPercentage: "+(voteThresholdPercentage * 0.01))
        //console.log("supplyFractionPercentage: "+(Number(supplyFractionPercentage) / 100))
        
        //if (totalVotes && totalVotes > 0)
        //    setTotalQuorum(totalVotes);
        
        const qt = totalVotes-thisitem.account.options[0].voteWeight.toNumber()/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals);
        const yesVotes = thisitem.account.options[0].voteWeight.toNumber()/Math.pow(10, governingMintPromise.value.data.parsed.info.decimals);
        
        const excess = yesVotes - totalVotes;
        
        if (excess > 0){
            //setExceededQuorum(excess);
            //setExceededQuorumPercentage(excess/totalVotes*100);
        }

        //console.log("yesVotes: "+yesVotes);
        const totalVotesNeeded = Math.ceil(totalVotes - yesVotes);

        if (qt < 0){
            //setQuorumTargetPercentage(100);
        }else{
            //setQuorumTargetPercentage((totalVotesNeeded / totalVotes) * 100);
            //setQuorumTarget(totalVotesNeeded);
        }

        let ggv = {
            governance:governance,
            governanceMintInfo:governingMintPromise,
        }

        //console.log("source ggv: "+JSON.stringify(ggv))

        return ggv;

    }catch(e){
        console.log('ERR: '+e)

        return null;
    }
}

const getFirstTransactionDate = async(walletAddress:string) => {
    const connection = RPC_CONNECTION;
    const publicKey = new PublicKey(walletAddress);
    //const transactionHistory = await connection.getConfirmedSignaturesForAddress2(publicKey, { limit: 1 });
    const pullLimit = 100; // this is a hard limit for now so we do not stall our requests
    // wallet would be limited to 100k tx if more we should boost this
    let signaturesArray = [];
    let pullAttempts = 0;
    let pullRequests = 0;
    let isEmpty = false;
    while (!isEmpty) {
        try {
            const lastSignature = signaturesArray[signaturesArray.length - 1];
            const requestSignatures = await connection.getConfirmedSignaturesForAddress2(publicKey, {
                before: lastSignature,
                limit: 1000
            });
            

            if (pullRequests > pullLimit) {
                isEmpty = true;
            }
            
            console.log("pullRequests: "+pullRequests);
            if (!(requestSignatures.length > 0)) {
                pullAttempts++;
                isEmpty = true;
            } else {
                const newlyFetchedSignatureArray = requestSignatures.map(data => data.signature);
                signaturesArray = signaturesArray.concat(newlyFetchedSignatureArray);
            }
            pullRequests++;
        }
        catch (e) {
            console.log(e);
        }
    }

    if (signaturesArray.length === 0) {
      return null;
    }

    //console.log("signaturesArray: "+JSON.stringify(signaturesArray))
    const firstTransactionSignature = signaturesArray[signaturesArray.length - 1];
    //console.log("firstTransactionSignature: "+JSON.stringify(firstTransactionSignature))
    //const transactionDetails = await connection.getConfirmedTransaction(firstTransactionSignature);
    if (firstTransactionSignature){    
        const transactionDetails = (await connection.getParsedTransaction(firstTransactionSignature, {"commitment":"confirmed","maxSupportedTransactionVersion":0}));
        if (transactionDetails?.blockTime){
            const txBlockTime = moment.unix(transactionDetails.blockTime);
            //console.log("txBlockTime: "+txBlockTime.format('YYYY-MM-DD HH:mm'))
            //const txSlot = moment(new Date(transactionDetails.slot * 1000));
            //console.log("txSlot: "+txSlot.format('YYYY-MM-DD HH:mm'))

            //return new Date(transactionDetails.slot * 1000);
            return transactionDetails.blockTime;
        } else{
            return null;
        }
    } else{
        return null;
    }
}

const generateMasterVoterRecord = async(connection: Connection, governanceLookup: any, storagePool: any, sentRealm: any) => {

    // 1. loop through all governances
    // 2. for each governance fetch the membersMap
    // 3. Append to a new array of members and add if member is not present
    // 4. this list will be used for global reporting
    const masterVoterRecord = new Array();
    for (const governance of governanceLookup){
        if (governance?.governanceAddress){

            // fetch governance file
            //getFileFromLookup
            let cached_members = new Array();
            if (governance?.memberFilename){
                cached_members = await getFileFromLookup(governance.memberFilename, storagePool);

                let grealm = sentRealm;
                if (!grealm)
                    grealm = await fetchRealm(governance.governanceAddress);
                let governingTokenDecimals = 0;

                //console.log("grealm: "+JSON.stringify(grealm));
                
                if (grealm.account?.communityMint){
                    let tokenDetails = await connection.getParsedAccountInfo(new PublicKey(grealm.account.communityMint))
                    //console.log("tokenDetails: "+JSON.stringify(tokenDetails))
                    governingTokenDecimals = tokenDetails.value.data.parsed.info.decimals;
                }

                if (cached_members){ // check what to push
                    
                    for (const cachedOwner of cached_members){
                        let firstTransactionDate = null;
                        let walletBalance = null;
                        let multisigs = null;
                        let address = cachedOwner.account.governingTokenOwner;
                        let masterRecordFound = false;
                        if (cachedOwner?.firstTransactionDate)
                            firstTransactionDate = cachedOwner.firstTransactionDate;
                        if (cachedOwner?.walletBalance)
                            walletBalance = cachedOwner.walletBalance;
                        if (cachedOwner?.multisigs)
                            multisigs = cachedOwner.multisigs;

                        // check if master member exists
                        if (masterVoterRecord && masterVoterRecord.length > 0){
                            for (const masterOwner of masterVoterRecord){
                                if (masterOwner.address === address){
                                    masterRecordFound = true;
                                    
                                    masterOwner.participating.push({
                                        governanceAddress: governance.governanceAddress,
                                        governanceName: governance.governanceName,
                                        staked:
                                        {
                                            governingTokenDepositAmount:(+((Number("0x"+cachedOwner.account.governingTokenDepositAmount))/Math.pow(10, governingTokenDecimals || 0)).toFixed(0)),
                                            governingCouncilDepositAmount:((Number("0x"+cachedOwner.account.governingCouncilDepositAmount) > 0) ? Number(cachedOwner.account.governingCouncilDepositAmount) : 0),
                                        },
                                        unstaked:Number(walletBalance),
                                        rawRecord:cachedOwner
                                    })

                                }
                            }
                        }
                        if (!masterRecordFound){
                            masterVoterRecord.push({
                                address:address,
                                firstTransactionDate:firstTransactionDate,
                                walletBalance:walletBalance,
                                multisigs:multisigs,
                                participating:[{
                                    governanceAddress: governance.governanceAddress,
                                    governanceName: governance.governanceName,
                                    staked:
                                    {
                                        governingTokenDepositAmount:(+((Number("0x"+cachedOwner.account.governingTokenDepositAmount))/Math.pow(10, governingTokenDecimals || 0)).toFixed(0)),
                                        governingCouncilDepositAmount:((Number("0x"+cachedOwner.account.governingCouncilDepositAmount) > 0) ? Number(cachedOwner.account.governingCouncilDepositAmount) : 0),
                                    },
                                    unstaked:Number(walletBalance),
                                    rawRecord:cachedOwner
                                }]
                            })
                        }
                    }
                }
            }
        }
        
    }

    //console.log("masterVoterRecord: "+JSON.stringify(masterVoterRecord));

    return masterVoterRecord;
}
  

// STEP 1.
const processGovernance = async(address:string, sent_realm:any, tokenMap: any, governanceLookupItem: any, storagePool: any, currentWallet: any, setPrimaryStatus: any, setStatus: any) => {
    // Second drive creation (otherwise wallet is not connected when done earlier)
    if (address){
        let fgovernance = null;
        
        let grealm = sent_realm;
        if (!grealm) 
            grealm = await fetchRealm(address);

            
        fgovernance = await fetchGovernance(address, grealm, tokenMap, governanceLookupItem, storagePool, currentWallet, setPrimaryStatus, setStatus);
        
        return fgovernance;
    }
}

// STEP 2.
const processProposals = async(address:string, finalList:any, forceSkip:boolean, this_realm: any, governanceData: any, connection: Connection, tokenMap: any, storagePool: any, governanceLookup: any, setSecondaryStatus: any, setProgress: any) => {
    if (finalList){
        
        let using_realm = this_realm;
        //if (!using_realm)
        //    using_realm = realm;

        const fpd = await fetchProposalData(address, finalList, forceSkip, using_realm, connection, useWallet, tokenMap, storagePool, governanceLookup, setSecondaryStatus, setProgress);
        
        if (fpd.finalList){
            
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
            
            const fileName = address+'.json';

            exportFile(fpd.finalList, null, fileName);
            const proposalsString = JSON.stringify(fpd.finalList);
            
            // do following to get the members

            const usingMemberMap = governanceData?.memberMap;
            const membersString = JSON.stringify(usingMemberMap);
            const usingTransactions = governanceData?.transactions;
            const governanceTransactionsString = JSON.stringify(usingTransactions);
            
            const propFiles = {
                proposalsString: proposalsString,
                membersString: membersString,
                governanceTransactionsString: governanceTransactionsString,
                ggv: fpd.ggv
            }


            return propFiles;
        }
    }
}

const exportFile = async(finalList:string, csvFile:string, fileName:string) => {
    //setStatus(`File generated! - ${finalList.length} proposals`);
        const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
            JSON.stringify(finalList)
        )}`;
        
        //console.log("encoded: "+JSON.stringify(finalList))
        
        //setStringGenerated(JSON.stringify(finalList));
        //setFileGenerated(jsonString);
        
        if (csvFile){
            const jsonCSVString = `data:text/csv;chatset=utf-8,${csvFile}`;
            //setCSVGenerated(jsonCSVString);
        }

        return jsonString;
        //const link = document.createElement("a");
        //link.href = jsonString;
        //link.download = fileName+".json";
        //link.click(); 
}

const returnJSON = async(generatedString:string, fileName:string) => {
    //setStatus("File generated!");
    
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
    
    console.log("with compression size (pending): "+compressed_blob.size);
    
    return compressed_blob;
}

const fileToDataUri = (file:any) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target.result)
    };
    reader.readAsDataURL(file);
})

const initStorage  = async (setThisDrive: any, setCurrentWallet: any, wallet: any, setStorageAutocomplete: any) => {

    // use soft wallet...

    //const fromKeypair = Keypair.generate();
    let drive = null;
    var secretKey = null;
    
    try{
        //fetchedKeypair = await loadWalletKey('./keypair.json')
        if (PRIMARY_STORAGE_WALLET)
            secretKey = JSON.parse(PRIMARY_STORAGE_WALLET);
        //else // this is no longer needed
        //    secretKey = require('./keypair.json');
    }catch (ferr){
        console.log("ERR: "+ferr);
    }

    const isBrowser = process.env.BROWSER || (typeof window !== "undefined" && !window.process?.hasOwnProperty("type"));

    if (secretKey){
        const fromKeypair = Keypair.fromSecretKey(
            Uint8Array.from(secretKey)
        );
        const kpwallet = new MyWallet(fromKeypair);
        
        console.log("Initializing SHDW with soft wallet "+kpwallet.publicKey.toBase58())
        drive = await new ShdwDrive(RPC_CONNECTION, kpwallet).init();
        //const testing = drive.userInfo;
        //console.log("drive: "+JSON.stringify(testing));
        if (setThisDrive) setThisDrive(drive);

        if (setCurrentWallet) setCurrentWallet(kpwallet.publicKey.toBase58());

    } else{
        if (wallet){
            console.log("Initializing SHDW wallet adapter "+wallet.publicKey.toBase58())
            const drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
            //console.log("drive: "+JSON.stringify(drive));
            if (setThisDrive) setThisDrive(drive);

            if (setCurrentWallet) setCurrentWallet(wallet.publicKey.toBase58());
        }
    }
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
            if (setStorageAutocomplete) setStorageAutocomplete(strgAccounts);

        return {
            autocomplete: strgAccounts,
            drive: drive,
            wallet: wallet?.publicKey ? wallet.publicKey.toBase58() : null
        }
    }catch(e){
        console.log("ERR: "+e);
        return null;
    }
}     

function blobToFile(theBlob: Blob, fileName: string){       
    return new File([theBlob], fileName, { lastModified: new Date().getTime(), type: theBlob.type })
}

const getGovernanceLookup  = async (setGovernanceAutocomplete:any, setGovernanceLookup:any, storagePool: any) => {
    const fgl = await fetchGovernanceLookupFile(storagePool);
    if (fgl && fgl.length > 0){
        const lookupAutocomplete = new Array();

        //const sorted = fgl.sort((a:any, b:any) => a?.totalProposals < b?.totalProposals ? 1 : -1); 
        const presorted = fgl.sort((a:any, b:any) => (b?.totalVaultValue < a?.totalVaultValue && a?.totalVaultValue > 1) ? 1 : -1); 
        const sorted = presorted.sort((a:any, b:any) => (a?.totalProposalsVoting < b?.totalProposalsVoting) ? 1 : -1); 
        
        for (var item of sorted){
            lookupAutocomplete.push({
                label: item.governanceName,
                value: item.governanceAddress,
                totalProposals: item.totalProposals,
                totalProposalsVoting: item.totalProposalsVoting,
                lastProposalDate: item.lastProposalDate,
            });
        }
        if (setGovernanceAutocomplete) setGovernanceAutocomplete(lookupAutocomplete);

        if (setGovernanceLookup) setGovernanceLookup(sorted);

        return {
            lookup: lookupAutocomplete,
            autocomplete: sorted
        }
    }
}   


const uploadToStoragePool = async (drive: any, files: File, storagePublicKey: PublicKey, fileName: string, enqueueSnackbar: any, closeSnackbar:any) => { 
    try{
        if (enqueueSnackbar) enqueueSnackbar(`Preparing to upload ${fileName} to ${storagePublicKey.toString()}`,{ variant: 'info' });
        const snackprogress = (key:any) => (
            <CircularProgress sx={{padding:'10px'}} />
        );
        let cnfrmkey = null;
        if (enqueueSnackbar){ cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });}
        
        const signedTransaction = await drive.uploadMultipleFiles(storagePublicKey, [files]);
        let count = 0;
        for (var file of signedTransaction){
            if (file.status === "Uploaded."){
                count++;
            }
        }
        
        if (closeSnackbar) closeSnackbar(cnfrmkey);
        const snackaction = (key:any) => (
            <>
                Uploaded {count} files
            </>
        );
        if (enqueueSnackbar) enqueueSnackbar(`Transaction Confirmed`,{ variant: 'success', action:snackaction });
    }catch(e){
        if (closeSnackbar) closeSnackbar();
        if (enqueueSnackbar) enqueueSnackbar(`${JSON.stringify(e)}`,{ variant: 'error' });
        console.log("Error: "+JSON.stringify(e));
        //console.log("Error: "+JSON.stringify(e));
    }
}

const uploadReplaceToStoragePool = async (drive:any, newFile: File, existingFileUrl: string, storagePublicKey: PublicKey, version: string, fileName: string, enqueueSnackbar: any, closeSnackbar:any) => { 
    try{
        
        if (enqueueSnackbar) enqueueSnackbar(`Preparing to upload/replace ${fileName} to ${storagePublicKey.toString()}`,{ variant: 'info' });
        const snackprogress = (key:any) => (
            <CircularProgress sx={{padding:'10px'}} />
        );
        let cnfrmkey = null;
        if (enqueueSnackbar){ cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });}
        
        const signedTransaction = await drive.editFile(new PublicKey(storagePublicKey), existingFileUrl, newFile, version || 'v2');
        
        if (signedTransaction?.finalized_location){
            
            if (closeSnackbar) closeSnackbar(cnfrmkey);
            const snackaction = (key:any) => (
                <Button>
                    File replaced
                </Button>
            );
            if (enqueueSnackbar) enqueueSnackbar(`Transaction Confirmed`,{ variant: 'success', action:snackaction });
        } else{

        }
    }catch(e){
        if (closeSnackbar) closeSnackbar();
        if (enqueueSnackbar) enqueueSnackbar(`${JSON.stringify(e)}`,{ variant: 'error' });
        console.log("Error: "+JSON.stringify(e));
        //console.log("Error: "+JSON.stringify(e));
    } 
}

const deleteStoragePoolFile = async (drive:any, storagePublicKey: PublicKey, file: string, version: string, enqueueSnackbar: any, closeSnackbar:any) => { 
    try{
        if (enqueueSnackbar) enqueueSnackbar(`Preparing to delete ${file}`,{ variant: 'info' });
        const snackprogress = (key:any) => (
            <CircularProgress sx={{padding:'10px'}} />
        );
        //console.log(storagePublicKey + "/"+storageAccount+" - file: "+file);
        let cnfrmkey = null;
        if (enqueueSnackbar) { cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });}
        
        const signedTransaction = await drive.deleteFile(storagePublicKey, 'https://shdw-drive.genesysgo.net/'+storagePublicKey.toBase58()+'/'+file, version || 'v2');
        console.log("signedTransaction; "+JSON.stringify(signedTransaction))
        
        if (closeSnackbar) closeSnackbar(cnfrmkey);
        const snackaction = (key:any) => (
            <Button href={`https://explorer.solana.com/tx/${signedTransaction.txid}`} target='_blank'  sx={{color:'white'}}>
                {signedTransaction.message}
            </Button>
        );
        if (enqueueSnackbar) enqueueSnackbar(`Transaction Confirmed`,{ variant: 'success', action:snackaction });
        /*
        setTimeout(function() {
            getStorageFiles(storageAccount.publicKey);
        }, 2000);
        */
    }catch(e){
        if (closeSnackbar) closeSnackbar();
        if (enqueueSnackbar) enqueueSnackbar(`${e}`,{ variant: 'error' });
        console.log("Error: "+e);
        //console.log("Error: "+JSON.stringify(e));
    } 
}

const updateGovernanceMasterMembersFile = async(drive: any, connection: Connection, governanceLookup: any, storagePool: string, sentRealm: any, masterMembersFound: boolean, setCurrentUploadInfo: any, enqueueSnackbar:any, closeSnackbar:any) => {
    const storageAccountPK = storagePool;
    const masterVoterRecordArray = await generateMasterVoterRecord(connection, governanceLookup, storagePool, sentRealm);
    //console.log("masterVoterRecordArray: "+JSON.stringify(masterVoterRecordArray));
    const fileName = "governance_mastermembers.json";
    const uploadFile = await returnJSON(JSON.stringify(masterVoterRecordArray), fileName);
    console.log("upload ("+masterMembersFound+"): "+JSON.stringify(uploadFile));

    const fileSize  = uploadFile.size;
    const fileStream = blobToFile(uploadFile, fileName);
    
    if (masterMembersFound){ // replace
        console.log("Replacing Governance Master Members");
        if (setCurrentUploadInfo) setCurrentUploadInfo("Replacing "+fileName+" - "+formatBytes(fileSize));
        const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+fileName;
        console.log("storageAccountFile "+storageAccountFile);
        console.log("storageAccountPK "+storageAccountPK);
        await uploadReplaceToStoragePool(drive, fileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2', fileName, enqueueSnackbar, closeSnackbar);
    }else{ // add
        if (setCurrentUploadInfo) setCurrentUploadInfo("Adding "+fileName+" - "+formatBytes(fileSize));
        await uploadToStoragePool(drive, fileStream, new PublicKey(storageAccountPK), fileName, enqueueSnackbar, closeSnackbar);
    }
}

const updateGovernanceLookupFile = async(drive:any, sentRealm:any, address: string, governanceFetchedDetails: any, ggv:any, fileName:string, memberFileName:string, governanceTransactionsFileName: string, governanceVaultsFileName: string, timestamp:number, lookupFound:boolean, storagePool: any, connection: Connection, governanceLookup: any, setCurrentUploadInfo: any, governanceAutocomplete: any, setGovernanceLookup: any, enqueueSnackbar: any, closeSnackbar: any) => {
    // this should be called each time we update with governance
    const storageAccountPK = storagePool;
    let govAddress = address;
    const govFileName = fileName;
    //if (!govAddress)
    //    govAddress = governanceAddress;
    let this_realm = sentRealm;// || realm;
    const lookup = new Array();
    console.log("Storage Pool: "+storagePool+" | Lookup File found: "+JSON.stringify(lookupFound))
    //console.log("this_realm: "+JSON.stringify(this_realm));
    //console.log("governanceLookup: "+JSON.stringify(governanceLookup));

    // we are refetching the lookup prior to pushing to avoid any intermediated changes
    // this should be handled with a locking mechanism
    const freshGovernanceLookup = await fetchGovernanceLookupFile(storagePool);

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
            for (var item of freshGovernanceLookup){
                //if (cntr === 0)
                //console.log("governanceFetchedDetails: "+JSON.stringify(governanceFetchedDetails));

                if (item.governanceAddress === address){
                    item.version++;
                    item.filename = govFileName;
                    item.memberFilename = memberFileName;
                    item.governanceTransactionsFilename = governanceTransactionsFileName;
                    item.governanceVaultsFilename = governanceVaultsFileName;
                    item.realm = this_realm;
                    if (this_realm.account.config?.communityMintMaxVoteWeightSource)
                        item.communityFmtSupplyFractionPercentage = this_realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
                    item.governance = ggv?.governance;
                    item.governances = governanceFetchedDetails?.governanceVaults,
                    item.governingMintDetails = ggv?.governanceMintInfo;
                    item.lastProposalDate = governanceFetchedDetails?.lastProposalDate;
                    //item.tokenSupply = ggv?.totalSupply || totalSupply;
                    //item.totalQuorum = ggv?.totalQuorum || totalQuorum;
                    //item.tokenCouncilSupply = ggv?.totalCouncilSupply || totalSupply;
                    //item.totalCouncilQuorum = ggv?.totalCouncilQuorum || totalQuorum;
                    item.lastTimestamp = item.timestamp;
                    item.lastMembers = item.totalMembers;
                    item.lastProposals = item.totalProposals;
                    item.lastCouncilProposals = item.totalCouncilProposals;
                    item.lastVaultValue = item.totalVaultValue;
                    item.lastVaultSolValue = item.totalVaultSolValue;
                    item.lastVaultStableCoinValue = item.totalVaultStableCoinValue;
                    item.lastVaultNftValue = item.totalVaultNftValue;
                    item.totalProposals = governanceFetchedDetails?.totalProposals;
                    item.totalProposalsVoting = governanceFetchedDetails?.totalProposalsVoting;
                    item.totalCouncilProposals = governanceFetchedDetails?.totalCouncilProposals;
                    item.timestamp = timestamp;
                    item.totalMembers = governanceFetchedDetails?.memberMap.length || null;
                    item.totalVaultValue = governanceFetchedDetails?.totalVaultValue;
                    item.totalVaultSol = governanceFetchedDetails?.totalVaultSol;
                    item.totalVaultSolValue = governanceFetchedDetails?.totalVaultSolValue;
                    item.totalVaultStableCoinValue = governanceFetchedDetails?.totalVaultStableCoinValue;
                    item.totalVaultNftValue = governanceFetchedDetails?.totalVaultNftValue;
                    govFound = true;
                }

                //console.log("size: "+new Set(memberMap).size)
                cntr++;
            }
            console.log("Lookup has "+cntr+" entries");
            if (!govFound){
                console.log("Adding new Governance to Lookup");
                //console.log("governanceFetchedDetails "+JSON.stringify(governanceFetchedDetails))
                let communityFmtSupplyFractionPercentage = null;
                if (this_realm.account.config?.communityMintMaxVoteWeightSource)
                    communityFmtSupplyFractionPercentage = this_realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();
                //let memberCount = 0;
                //if (memberMap)
                //    memberCount = new Set(memberMap).size; // memberMap.length;
                
                freshGovernanceLookup.push({
                    governanceAddress:govAddress,
                    governanceName:governanceFetchedDetails?.governanceName,
                    version:0,
                    timestamp:timestamp,
                    filename:govFileName,
                    memberFilename: memberFileName,
                    governanceTransactionsFilename: governanceTransactionsFileName,
                    governanceVaultsFilename: governanceVaultsFileName,
                    realm:this_realm,
                    communityFmtSupplyFractionPercentage: communityFmtSupplyFractionPercentage,
                    governance: ggv?.governance,
                    governances: governanceFetchedDetails?.governanceVaults,
                    governingMintDetails: ggv?.governanceMintInfo,
                    totalProposals: governanceFetchedDetails?.totalProposals,
                    totalProposalsVoting: governanceFetchedDetails?.totalProposalsVoting,
                    totalCouncilProposals: governanceFetchedDetails?.totalCouncilProposals,
                    lastProposalDate: governanceFetchedDetails?.lastProposalDate,
                    //tokenSupply: ggv?.totalSupply || totalSupply,
                    //totalQuorum: ggv?.totalQuorum || totalQuorum,
                    //tokenCouncilSupply: ggv?.totalCouncilSupply || totalSupply,
                    //totalCouncilQuorum: ggv?.totalCouncilQuorum || totalQuorum,
                    totalMembers: governanceFetchedDetails?.memberMap.length || null,
                    totalVaultValue: governanceFetchedDetails?.totalVaultValue,
                    totalVaultSolValue: governanceFetchedDetails?.totalVaultSolValue,
                    totalVaultSol: governanceFetchedDetails?.totalVaultSol,
                    totalVaultStableCoinValue: governanceFetchedDetails?.totalVaultStableCoinValue,
                    totalVaultNftValue: governanceFetchedDetails?.totalVaultNftValue,

                });
            }
            
            //console.log("lookup: "+JSON.stringify(lookup))

            const cleanLookup = new Array();
            for (var item of freshGovernanceLookup){ // cleanup lookup!
                if (item.governanceName){
                    cleanLookup.push(item);
                }
            }

            console.log("Original: "+freshGovernanceLookup.length);
            console.log("Cleaned: "+(freshGovernanceLookup.length-cleanLookup.length)+" New Total: "+cleanLookup.length);

            console.log("Replacing Governance Lookup");
            const uploadFile = await returnJSON(JSON.stringify(cleanLookup), "governance_lookup.json");
            const fileSize  = uploadFile.size;
            if (setCurrentUploadInfo) setCurrentUploadInfo("Replacing "+"governance_lookup.json"+" - "+formatBytes(fileSize));
            
            const fileStream = blobToFile(uploadFile, "governance_lookup.json");
            const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/governance_lookup.json';
            console.log("storageAccountFile "+storageAccountFile);
            console.log("storageAccountPK "+storageAccountPK);
            await uploadReplaceToStoragePool(drive, fileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2', fileName, enqueueSnackbar, closeSnackbar);
        } else{ // create governanceLookup

            let communityFmtSupplyFractionPercentage = null;
            if (this_realm.account.config?.communityMintMaxVoteWeightSource)
                communityFmtSupplyFractionPercentage = this_realm.account.config.communityMintMaxVoteWeightSource.fmtSupplyFractionPercentage();

            lookup.push({
                governanceAddress:govAddress,
                governanceName:governanceFetchedDetails?.governanceName,
                version:0,
                timestamp:timestamp,
                filename:govFileName,
                memberFilename: memberFileName,
                governanceTransactionsFilename: governanceTransactionsFileName,
                governanceVaultsFilename: governanceVaultsFileName,
                realm:this_realm,
                communityFmtSupplyFractionPercentage: communityFmtSupplyFractionPercentage,
                governance: ggv?.governance,
                governances: governanceFetchedDetails?.governanceVaults,
                governingMintDetails: ggv?.governanceMintInfo,
                totalProposals: governanceFetchedDetails?.totalProposals,
                totalProposalsVoting: governanceFetchedDetails?.totalProposalsVoting,
                totalCouncilProposals: governanceFetchedDetails?.totalCouncilProposals,
                lastProposalDate: governanceFetchedDetails?.lastProposalDate,
                //tokenSupply: ggv?.totalSupply || totalSupply,
                //totalQuorum: ggv?.totalQuorum || totalQuorum,
                totalMembers: governanceFetchedDetails?.memberMap.length || null,
                totalVaultValue: governanceFetchedDetails?.totalVaultValue,
                totalVaultSolValue: governanceFetchedDetails?.totalVaultSolValue,
                totalVaultSol: governanceFetchedDetails?.totalVaultSol,
                totalVaultStableCoinValue: governanceFetchedDetails?.totalVaultStableCoinValue,
                totalVaultNftValue: governanceFetchedDetails?.totalVaultNftValue,
            });
            
            console.log("Uploading new Governance Lookup");

            let fileName = "governance_lookup.json";
            const uploadFile = await returnJSON(JSON.stringify(lookup),fileName);
            const fileStream = blobToFile(uploadFile, fileName);
            const fileSize  = uploadFile.size;
            if (setCurrentUploadInfo) setCurrentUploadInfo("Adding "+fileName+" - "+formatBytes(fileSize));
            await uploadToStoragePool(drive, fileStream, new PublicKey(storageAccountPK), fileName, enqueueSnackbar, closeSnackbar);
            // update autocomplete
            try{
                governanceAutocomplete.push({
                    label: governanceFetchedDetails?.governanceName, 
                    value: govAddress,
                    totalProposals: governanceFetchedDetails?.totalProposals,
                    totalProposalsVoting: governanceFetchedDetails?.totalProposalsVoting,
                    lastProposalDate: governanceFetchedDetails?.lastProposalDate
                })
            }catch(e){
                console.log("ERR: "+e);
            }
            
            if (setGovernanceLookup) setGovernanceLookup(lookup);
        }
    } else{
        console.log("ERR: realm could not be loaded - "+JSON.stringify(this_realm))
    }
}

const handleUploadToStoragePool = async (sentRealm: any, address: string, passedProposalsString: string,passedMembersString: string,passedTransactionsString: string,passedVaultsString: string, governanceFetchedDetails: any, ggv: any, thisDrive:any, storagePool: any, setCurrentUploadInfo: any, setCronBookmark: any, enqueueSnackbar: any, closeSnackbar: any, connection: Connection, governanceLookup: any, governanceAutocomplete: any, setGovernanceLookup: any) => {
    const timestamp = Math.floor(new Date().getTime() / 1000);
    let govAddress = address;
    //if (address)
    //    govAddress = address;

    const fileName = govAddress+'_'+timestamp+'.json';
    const memberFileName = govAddress+'_members_'+timestamp+'.json';
    const governanceTransactionsFileName = govAddress+'_transactions_'+timestamp+'.json';
    const governanceVaultsFileName = govAddress+'_vaults_'+timestamp+'.json';
    
    const storageAccountPK = storagePool;

    let current_proposals_to_use = null;
    let current_members_to_use = null;
    let current_transactions_to_use = null;
    let current_vaults_to_use = null;

    if (passedProposalsString)
        current_proposals_to_use = passedProposalsString
    if (passedMembersString)
        current_members_to_use = passedMembersString
    if (passedTransactionsString)
        current_transactions_to_use = passedTransactionsString
    if (passedVaultsString)
        current_vaults_to_use = passedVaultsString
    
    //exportJSON(fileGenerated, fileName);
    console.log("preparing to upload: "+fileName);
    //if (!thisDrive){

        //const fromKeypair = Keypair.generate();
        let drive = null;
        var secretKey = null;
        
        try{
            //fetchedKeypair = await loadWalletKey('./keypair.json')
            if (PRIMARY_STORAGE_WALLET)
                secretKey = JSON.parse(PRIMARY_STORAGE_WALLET);
            //else // this is no longer needed
            //    secretKey = require('./keypair.json');
        }catch (ferr){
            console.log("ERR: "+ferr);
        }

        const isBrowser = process.env.BROWSER || (typeof window !== "undefined" && !window.process?.hasOwnProperty("type"));

        if (secretKey){
            const fromKeypair = Keypair.fromSecretKey(
                Uint8Array.from(secretKey)
            );
            const kpwallet = new MyWallet(fromKeypair);
            
            console.log("Initializing SHDW with soft wallet "+kpwallet.publicKey.toBase58())
            drive = await new ShdwDrive(RPC_CONNECTION, kpwallet).init();
            const testing = drive.userInfo;
            console.log("drive: "+JSON.stringify(testing));
        } else{

            console.log("Browser: "+isBrowser);
            //console.log("Initializing SHDW with wallet adapter "+kpwallet.publicKey.toBase58())
            //drive = await new ShdwDrive(RPC_CONNECTION, wallet).init();
        }

        //console.log("drive: "+JSON.stringify(drive));
        //setThisDrive(drive);
        //alert("Drive not initialized, initializing now...");
    //} 
    
    {
        // check if either file is set
        
        if ((current_proposals_to_use) &&
            (current_members_to_use)){
            
            //console.log("current_members_to_use "+JSON.stringify(current_members_to_use));

            console.log("1: "+JSON.stringify(storageAccountPK))
            const uploadProposalFile = await returnJSON(current_proposals_to_use, fileName);
            console.log("2: "+JSON.stringify(storageAccountPK))
            const uploadMembersFile = await returnJSON(current_members_to_use, memberFileName);
            console.log("3: "+JSON.stringify(storageAccountPK))
            const uploadTransactionsFile = await returnJSON(current_transactions_to_use, governanceTransactionsFileName);
            console.log("4: "+JSON.stringify(storageAccountPK))
            const uploadVaultsFile = await returnJSON(current_vaults_to_use, governanceVaultsFileName);
            
            //const fileBlob = await fileToDataUri(uploadFile);
            // auto check if this file exists (now we manually do this)
            let found = false;
            let foundMembers = false;
            let foundTransactions = false;
            let foundVaults = false;
            let lookupFound = false;
            let masterMembersFound = false;
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
                        } else if (item === governanceVaultsFileName){
                            foundVaults = true;
                        } else if (item === 'governance_lookup.json'){
                            lookupFound = true;
                        } else if (item === 'governance_mastermembers.json'){
                            masterMembersFound = true;
                        }
                    }
                }

                // update master members
                console.log("1 of 6. Storage Pool: "+storageAccountPK+" | MasterMembers found: "+JSON.stringify(masterMembersFound));
                await updateGovernanceMasterMembersFile(drive, connection, governanceLookup, storagePool, sentRealm, masterMembersFound, setCurrentUploadInfo, enqueueSnackbar, closeSnackbar);
                
                // proceed to add propsals
                console.log("2 of 6. Storage Pool: "+storageAccountPK+" | File ("+fileName+") found: "+JSON.stringify(found));
                
                const proposalFileStream = blobToFile(uploadProposalFile, fileName);
                const proposalFileSize  = uploadProposalFile.size;

                //const allFileStreams = new Array();
                //allFileStreams.push(proposalFileStream)

                if (found){
                    const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+fileName;
                    setCurrentUploadInfo("Replacing "+fileName+" - "+formatBytes(proposalFileSize));
                    await uploadReplaceToStoragePool(drive, proposalFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2', fileName, enqueueSnackbar, closeSnackbar);
                }else{
                    setCurrentUploadInfo("Adding "+fileName+" - "+formatBytes(proposalFileSize));
                    await uploadToStoragePool(drive, proposalFileStream, new PublicKey(storageAccountPK), fileName, enqueueSnackbar, closeSnackbar);
                    //await uploadToStoragePool([proposalFileStream,membersFileStream,governanceTransactionsFileName,governanceVaultsFileName], new PublicKey(storageAccountPK));
                }

                // proceed to add members
                console.log("3 of 6. Storage Pool: "+storageAccountPK+" | Members ("+memberFileName+") found: "+JSON.stringify(foundMembers));
                
                const membersFileStream = blobToFile(uploadMembersFile, memberFileName);
                const memberFileSize  = uploadMembersFile.size;
                if (foundMembers){
                    const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+memberFileName;
                    setCurrentUploadInfo("Replacing "+memberFileName+" - "+formatBytes(memberFileSize));
                    await uploadReplaceToStoragePool(drive, membersFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2', fileName, enqueueSnackbar, closeSnackbar);
                }else{
                    setCurrentUploadInfo("Adding "+memberFileName+" - "+formatBytes(memberFileSize));
                    await uploadToStoragePool(drive, membersFileStream, new PublicKey(storageAccountPK), fileName, enqueueSnackbar, closeSnackbar);
                }

                // proceed to add transactions
                console.log("4 of 6. Storage Pool: "+storageAccountPK+" | Transactions ("+governanceTransactionsFileName+") found: "+JSON.stringify(foundTransactions));
                
                const transactionsFileStream = blobToFile(uploadTransactionsFile, governanceTransactionsFileName);
                const transactionsFileSize  = uploadTransactionsFile.size;
                if (foundTransactions){
                    const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+foundTransactions;
                    setCurrentUploadInfo("Replacing "+governanceTransactionsFileName+" - "+formatBytes(transactionsFileSize));
                    await uploadReplaceToStoragePool(drive, transactionsFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2', fileName, enqueueSnackbar, closeSnackbar);
                }else{
                    setCurrentUploadInfo("Adding "+governanceTransactionsFileName+" - "+formatBytes(transactionsFileSize));
                    await uploadToStoragePool(drive, transactionsFileStream, new PublicKey(storageAccountPK), fileName, enqueueSnackbar, closeSnackbar);
                }

                // proceed to add vaults
                console.log("5 of 6. Storage Pool: "+storageAccountPK+" | Vaults ("+governanceVaultsFileName+") found: "+JSON.stringify(foundVaults));
                
                const vaultsFileStream = blobToFile(uploadVaultsFile, governanceVaultsFileName);
                const vaultsFileSize  = uploadVaultsFile.size;
                if (foundVaults){
                    const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+foundVaults;
                    setCurrentUploadInfo("Replacing "+governanceVaultsFileName+" - "+formatBytes(vaultsFileSize));
                    await uploadReplaceToStoragePool(drive, vaultsFileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2', fileName, enqueueSnackbar, closeSnackbar);
                }else{
                    setCurrentUploadInfo("Adding "+governanceVaultsFileName+" - "+formatBytes(vaultsFileSize));
                    await uploadToStoragePool(drive, vaultsFileStream, new PublicKey(storageAccountPK), fileName, enqueueSnackbar, closeSnackbar);
                }
                

                // update lookup
                console.log("6 of 6. Storage Pool: "+storageAccountPK+" | Lookup");
                
                await updateGovernanceLookupFile(drive, sentRealm, address, governanceFetchedDetails, ggv, fileName, memberFileName, governanceTransactionsFileName, governanceVaultsFileName, timestamp, lookupFound, storagePool, connection, governanceLookup, setCurrentUploadInfo, governanceAutocomplete, setGovernanceLookup, enqueueSnackbar, closeSnackbar);

                // delay a bit and update to show that the files have been added
                setCurrentUploadInfo("SPL Governance DSC "+address+" updated!");

                //setEllapsedTime(moment(new Date()))
                setCronBookmark(address);

            }catch(e){
                console.log("ERR: "+e);
            }
        } else{ // check what is missing
            //if (!stringGenerated){

            //}
            //if (!proposal_file){

            //}
            //if (!membersStringGenerated){

            //}
            //if (!member_file){
                
            //}
        }
    }
}

const processGovernanceUploadSnapshotAll = async(
    force:boolean, 
    address: string, 
    governanceLookup: any, 
    tokenMap: any, 
    currentWallet: any, 
    connection: Connection, 
    storagePool: any, 
    governanceAutocomplete: any, 
    thisDrive: any, 
    setLoading: any, 
    setBatchStatus: any, 
    setPrimaryStatus: any, 
    setSecondaryStatus: any, 
    setProgress: any, 
    setCurrentUploadInfo: any, 
    setCronBookmark: any, 
    enqueueSnackbar: any, 
    closeSnackbar: any, 
    setGovernanceLookup: any) => {

    if (setLoading) setLoading(true);

    if (setSecondaryStatus) setSecondaryStatus("Starting...")

    if (governanceLookup){
        let startTime = moment(new Date());
        let count = 0;
        let processedGovernance = false;
        for (var item of governanceLookup){
            var skip = false;
            
            const lookupTimestamp = moment.unix(Number(item.timestamp));
            const nowTimestamp = moment();
            const hoursDiff = nowTimestamp.diff(lookupTimestamp, 'hours');
            console.log("hrs diff: "+hoursDiff);
            if (hoursDiff < 6) // don't process if less than 6 hrs of last fetch
                skip = true;
            
            if (address){
                skip = true;
                if (setBatchStatus) setBatchStatus("Fetching an existing Governance: "+address);
                if (item.governanceAddress === address)
                    skip = false;
            }

            //if (count > 20){ // process 1 for now to verify it works
            if (!skip){
                processedGovernance = true;
                let elapsedTime = moment(new Date());
                let elapsedDuration = moment.duration(elapsedTime.diff(startTime));
                console.log("Fetching Governance ("+(count+1)+" of "+governanceLookup.length+"): "+item.governanceName+" "+item.governanceAddress+" ("+elapsedDuration.humanize()+")")
                if (setBatchStatus) setBatchStatus("Fetching Governance ("+(count+1)+" of "+governanceLookup.length+"): "+item.governanceName+" "+item.governanceAddress+" "+elapsedDuration.humanize()+"");
                
                if (setProgress) setProgress(0);
                const grealm = await fetchRealm(item.governanceAddress);
                if (setSecondaryStatus) setSecondaryStatus("Processing Governance");
                const governanceData = await processGovernance(item.governanceAddress, grealm, tokenMap, item, storagePool, currentWallet, setPrimaryStatus, setSecondaryStatus);
                if (setProgress) setProgress(1);
                if (setSecondaryStatus) setSecondaryStatus("Processing Proposals");
                const processedFiles = await processProposals(item.governanceAddress, governanceData.proposals, force, grealm, governanceData, connection, tokenMap, storagePool, governanceLookup, setSecondaryStatus, setProgress);

                //console.log("processedFiles.proposalsString "+JSON.stringify(processedFiles.proposalsString))
                if (setSecondaryStatus) setSecondaryStatus("Uploading to Storage Pool");
                await handleUploadToStoragePool(grealm, item.governanceAddress, processedFiles.proposalsString, processedFiles.membersString, processedFiles.governanceTransactionsString, governanceData.governanceVaultsString, governanceData, processedFiles.ggv, thisDrive, storagePool, setCurrentUploadInfo, setCronBookmark, enqueueSnackbar, closeSnackbar, connection, governanceLookup, governanceAutocomplete, setGovernanceLookup);
                if (setSecondaryStatus) setSecondaryStatus("Processing Complete!");
                
                // Second drive creation (otherwise wallet is not connected when done earlier)
            }
            count++;
        }   

        // if we have not found this governance
        if (address && !processedGovernance){
            console.log("Adding Governance: "+address+"")
            if (setBatchStatus) setBatchStatus("Adding Governance: "+address+"");
            
            const grealm = await fetchRealm(address);
            const governanceData = await processGovernance(address, grealm, tokenMap, null, storagePool, currentWallet, setPrimaryStatus, setSecondaryStatus);
            const processedFiles = await processProposals(item.governanceAddress, governanceData.proposals, force, grealm, governanceData, connection, tokenMap, storagePool, governanceLookup, setSecondaryStatus, setProgress);

            //console.log("processedFiles.proposalsString "+JSON.stringify(processedFiles.proposalsString))

            await handleUploadToStoragePool(grealm, address, processedFiles.proposalsString, processedFiles.membersString, processedFiles.governanceTransactionsString, governanceData.governanceVaultsString, governanceData, processedFiles.ggv, thisDrive, storagePool, setCurrentUploadInfo, setCronBookmark, enqueueSnackbar, closeSnackbar, connection, governanceLookup, governanceAutocomplete, setGovernanceLookup);
            
        }

        let endTime = moment(new Date());
        let elapsedDuration = moment.duration(endTime.diff(startTime));
        if (setBatchStatus) setBatchStatus("Batch completed in "+elapsedDuration.humanize()+"")
        
    } 
    if (setLoading) setLoading(false);
    return null;
}


export function GovernanceSnapshotView (this: any, props: any) {
	const wallet = useWallet();
    const connection = RPC_CONNECTION;
    
    const [progress, setProgress] = React.useState(0);
    const [secondaryStatus, setSecondaryStatus] = React.useState(null);
    const [batchStatus, setBatchStatus] = React.useState(null);
    const [primaryStatus, setPrimaryStatus] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [fileGenerated, setFileGenerated] = React.useState(null);
    const [governanceAddress, setGovernanceAddress] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [currentUploadInfo, setCurrentUploadInfo] = React.useState(null);
    const [thisDrive, setThisDrive] = React.useState(null);
    const [governanceLookup, setGovernanceLookup] = React.useState(null);
    const [governanceAutocomplete, setGovernanceAutocomplete] = React.useState(null);
    const [storageAutocomplete, setStorageAutocomplete] = React.useState(null);
    const [storagePool, setStoragePool] = React.useState(GGAPI_STORAGE_POOL);
    const [rpcAutocomplete, setRpcAutocomplete] = React.useState([
        {
            label: new URL(RPC_ENDPOINT).hostname.split('.').slice(-2).join('.'),
            value: RPC_ENDPOINT
        }
    ]);

    const [rpcProvider, setRPCProviderPool] = React.useState(RPC_ENDPOINT);
    const [cronBookmark, setCronBookmark] = React.useState(null);
    const [currentWallet, setCurrentWallet] = React.useState(null);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();
    const onError = useCallback(
        (error: WalletError) => {
            enqueueSnackbar(error.message ? `${error.name}: ${error.message}` : error.name, { variant: 'error' });
            console.error(error);
        },
        [enqueueSnackbar]
    );
    
    const handleStoragePoolPurge = async () => {
        // deleteStoragePoolFile()
    }

    const initCachingSystem = async () => {
        const storageSettings = await initStorage(setThisDrive, setCurrentWallet, wallet, setStorageAutocomplete);
        const tokensMapped = await getTokens();
        setTokenMap(tokensMapped);
        const lookupSettings = await getGovernanceLookup(setGovernanceAutocomplete, setGovernanceLookup, storagePool);
    }

    React.useEffect(() => { 
        if (!tokenMap){
            initCachingSystem();  
        }

        /* CHECK FOR GOVERNANCE PROGRAM CHANGES */
        
        //const wssconnection = new Connection(RPC_ENDPOINT, {wsEndpoint:'WS_ENDPOINT'});
        /*
        const thisProgram = programId; //new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
        const wssconnection = new Connection(WS_ENDPOINT, {wsEndpoint:'WS_ENDPOINT'});
        (async () => {
            wssconnection.onAccountChange(thisProgram, (accountInfo) => {
                console.log('Governance Program account changed:', accountInfo);
                // Handle the account change here
            });

        })();
        */
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
                    maxWidth: '100ch',
                }}
                spacing={2}
                noValidate
                autoComplete="off"
                >
                
                <Typography variant="h6" sx={{textAlign:'center'}}>
                    Governance by Grape<br/>Decentralized Caching<br/>
                    {currentWallet && <Typography variant="caption">Storage Wallet: {currentWallet}</Typography>}
                </Typography>

                {rpcAutocomplete ?
                    <Autocomplete
                        freeSolo
                        disablePortal
                        id="combo-box-demo"
                        options={rpcAutocomplete}
                        getOptionLabel={(option) => option.value}
                        renderOption={(props, option) => (
                            <Box component="li" sx={{ '& > img': { mr: 2, flexShrink: 0 } }} {...props}>
                                <Grid container>
                                    <Grid xs={12}>
                                        <Typography variant="subtitle1">{option.label}</Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        )}
                        onChange={(e, sel) => setRPCProviderPool(sel?.value)} 
                        renderInput={(params) => <TextField {...params} onChange={(e) => setRPCProviderPool(e.target.value)} label="RPC Provider" />}
                    />
                    :
                    <TextField 
                            fullWidth 
                            label="Enter a custom RPC pool address" 
                            //value={rpcProvider || RPC_CONNECTION}
                            onChange={(e) => setRPCProviderPool(e.target.value)}/>
                }


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

                    <Tooltip title="Process all Governances this will loop through all cached governances and fetch all props respectively, to add a Governance manually add the governance address in the bottom and fetch using the bottom fetch button">
                        <Button 
                            onClick ={() => 
                                processGovernanceUploadSnapshotAll(
                                    false, 
                                    null,
                                    governanceLookup, 
                                    tokenMap, 
                                    currentWallet, 
                                    new Connection(rpcProvider || RPC_ENDPOINT), 
                                    storagePool, 
                                    governanceAutocomplete, 
                                    thisDrive, 
                                    setLoading, 
                                    setBatchStatus, 
                                    setPrimaryStatus, 
                                    setSecondaryStatus, 
                                    setProgress, 
                                    setCurrentUploadInfo,
                                    setCronBookmark, 
                                    enqueueSnackbar, 
                                    closeSnackbar, 
                                    setGovernanceLookup)} 
                            disabled={(!storagePool && governanceLookup) || (!wallet) || loading || (!tokenMap)}
                            variant='contained'
                            color='error'
                            sx={{color:'black'}}
                        >
                            Fetch All! <WarningIcon sx={{ml:1}} />
                        </Button>
                    </Tooltip>

                    <Typography variant="body2" sx={{textAlign:'center'}}>
                        {batchStatus}
                    </Typography>

                
                {(!loading && tokenMap) &&
                    <>
                    {governanceAutocomplete ?
                        <Autocomplete
                            freeSolo
                            disablePortal
                            id="combo-box-demo"
                            options={governanceAutocomplete}
                            getOptionLabel={(option) => option.label}
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
                        size='small'
                    >
                        <Tooltip title="Process selected Governance & upload to selected storage pool">
                            <Button 
                                onClick ={() =>  
                                    processGovernanceUploadSnapshotAll(
                                        false, 
                                        governanceAddress,
                                        governanceLookup, 
                                        tokenMap, 
                                        currentWallet, 
                                        new Connection(rpcProvider || RPC_ENDPOINT), 
                                        storagePool, 
                                        governanceAutocomplete, 
                                        thisDrive, 
                                        setLoading, 
                                        setBatchStatus, 
                                        setPrimaryStatus, 
                                        setSecondaryStatus, 
                                        setProgress, 
                                        setCurrentUploadInfo, 
                                        setCronBookmark, 
                                        enqueueSnackbar, 
                                        closeSnackbar, 
                                        setGovernanceLookup)} //processGovernanceUploadSnapshotJobStep1(governanceAddress, false)} 
                                disabled={(!governanceAddress) || (!storagePool || loading)}
                                variant='contained'
                                color='inherit'
                                sx={{color:'black'}}
                            >
                                Fetch <BoltIcon sx={{ml:1}} />
                            </Button>
                        </Tooltip>
                        <Tooltip title="WARNING: This will refetch/force fetch all governance proposals & proposal participation again regardless of cache">
                            <Button 
                                onClick ={() => 
                                    processGovernanceUploadSnapshotAll(
                                        true, 
                                        governanceAddress,
                                        governanceLookup, 
                                        tokenMap, 
                                        currentWallet, 
                                        new Connection(rpcProvider || RPC_ENDPOINT), 
                                        storagePool, 
                                        governanceAutocomplete, 
                                        thisDrive, 
                                        setLoading, 
                                        setBatchStatus, 
                                        setPrimaryStatus, 
                                        setSecondaryStatus, 
                                        setProgress, 
                                        setCurrentUploadInfo, 
                                        setCronBookmark, 
                                        enqueueSnackbar, 
                                        closeSnackbar, 
                                        setGovernanceLookup)}
                                disabled={(!governanceAddress) || (!storagePool || loading)}
                                variant='contained'
                                color='warning'
                            >
                                Refetch <HourglassBottomIcon sx={{ml:1}} />
                            </Button>
                        </Tooltip>
                    </ButtonGroup>

                    </>
                }

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
                    {secondaryStatus}
                </Typography>
                
                {currentUploadInfo &&
                    <Typography variant='caption' sx={{textAlign:'center'}}>
                        {currentUploadInfo}
                    </Typography>
                }

                {fileGenerated &&
                    <>
                        <ButtonGroup>                    
                            {/*
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
                            */}
                            
                            {/*
                            <Tooltip title="Upload to your selected storage pool - *SHDW Storage Pool will need to be created for adding to your decentralized storage pool">
                                <Button
                                    color="inherit"
                                    disabled={!storageAutocomplete ? true : false}
                                    onClick={e => handleUploadToStoragePool(null, null, null, null, null, null, null, null)}
                                    sx={{ml:1,borderRadius:'17px'}}
                                >
                                    <CloudUploadIcon />
                                </Button>
                            </Tooltip>
                            */}
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
