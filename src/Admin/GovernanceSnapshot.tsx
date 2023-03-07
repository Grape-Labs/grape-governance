import React, { useEffect, useState, useCallback, memo, Suspense } from "react";
import axios from "axios";
import { getRealm, getAllProposals, getGovernance, getGovernanceAccounts, getGovernanceChatMessages, getTokenOwnerRecord, getTokenOwnerRecordsByOwner, getAllTokenOwnerRecords, getRealmConfigAddress, getGovernanceAccount, getAccountTypes, GovernanceAccountType, tryGetRealmConfig, getRealmConfig  } from '@solana/spl-governance';
import { getVoteRecords } from '../utils/governanceTools/getVoteRecords';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { getBackedTokenMetadata } from '../utils/grapeTools/strataHelpers';

import {
    Box,
    TextField,
    Button,
    ButtonGroup,
    LinearProgress,
    Typography,
    Stack,
    Tooltip
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { LinearProgressProps } from '@mui/material/LinearProgress';

import { Connection, PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ShdwDrive, ShadowFile } from "@shadow-drive/sdk";
import { useSnackbar } from 'notistack';

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletError } from '@solana/wallet-adapter-base';

import { 
    GRAPE_RPC_ENDPOINT,
    PROXY,
    CLOUDFLARE_IPFS_CDN,
    HELIUS_API 
} from '../utils/grapeTools/constants';

import CircularProgress from '@mui/material/CircularProgress';

const GOVERNANNCE_STATE = {
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
    const [progress, setProgress] = React.useState(0);
    const [status, setStatus] = React.useState(null);
    const [primaryStatus, setPrimaryStatus] = React.useState(null);
    const [helperText, setHelperText] = React.useState(null);
    const [loading, setLoading] = React.useState(false);
    const [fileGenerated, setFileGenerated] = React.useState(null);
    const [csvGenerated, setCSVGenerated] = React.useState(null);
    const [stringGenerated, setStringGenerated] = React.useState(null);
    const [governanceAddress, setGovernanceAddress] = React.useState(null);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [tokenArray, setTokenArray] = React.useState(null);
    const [governingTokenDecimals, setGoverningTokenDecimals] = React.useState(null);
    const [governanceType, setGovernanceType] = React.useState(0);
    const [nftBasedGovernance, setNftBasedGovernance] = React.useState(false);
    const [memberMap, setMemberMap] = React.useState(null);
    const [totalProposals, setTotalProposals] = React.useState(null);
    const [totalPassed, setTotalPassed] = React.useState(null);
    const [totalDefeated, setTotalDefeated] = React.useState(null);
    const [totalVotesCasted, setTotalTotalVotesCasted] = React.useState(null);
    const [proposals, setProposals] = React.useState(null);

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

    const fetchGovernance = async(address:string) => {
        const finalList = new Array();
        setLoading(true);

        setStatus("Fetching Governance - Source: The Index");
        const connection = new Connection(GRAPE_RPC_ENDPOINT);
        console.log("Fetching governance "+address);
        const grealm = await getRealm(new Connection(GRAPE_RPC_ENDPOINT), new PublicKey(address))
        setRealm(grealm);

        setPrimaryStatus("Governance Fetched");
        
        console.log("Governance: "+JSON.stringify(grealm));

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

            const rawTokenOwnerRecords = await getAllTokenOwnerRecords(new Connection(GRAPE_RPC_ENDPOINT), grealm.owner, realmPk)

            setMemberMap(rawTokenOwnerRecords);


            setPrimaryStatus("Fetching All Proposals");

            const gprops = await getAllProposals(new Connection(GRAPE_RPC_ENDPOINT), grealm.owner, realmPk);



            try{
                if (finalList && finalList.length <= 0){
                    
                    const allprops: any[] = [];
                    let passed = 0;
                    let defeated = 0;
                    let ttvc = 0;
                    
                    for (const props of gprops){
                        for (const prop of props){
                            if (prop){
                                allprops.push(prop);
                                if (prop.account.state === 3 || prop.account.state === 5)
                                    passed++;
                                else if (prop.account.state === 7)
                                    defeated++;
    
                                
                                if (prop.account?.yesVotesCount && prop.account?.noVotesCount){
                                    //console.log("tmap: "+JSON.stringify(tokenMap));
                                    //console.log("item a: "+JSON.stringify(prop))
                                    if (tokenMap){
                                        ttvc += +(((prop.account?.yesVotesCount.toNumber() + prop.account?.noVotesCount.toNumber())/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                                    }
                                    
                                } else if (prop.account?.options) {
                                    //console.log("item b: "+JSON.stringify(prop))
                                    if (tokenMap){
                                        ttvc += +(((prop.account?.options[0].voteWeight.toNumber() + prop.account?.denyVoteWeight.toNumber())/Math.pow(10, (gTD ? gTD : 6) )).toFixed(0))
                                    }
                                }
                            }
                        }
                    }

                    const sortedResults = allprops.sort((a:any, b:any) => ((b.account?.votingAt != null ? b.account?.votingAt : 0) - (a.account?.votingAt != null ? a.account?.votingAt : 0)))
                    
                    setPrimaryStatus("Fetched Governance: "+grealm.account.name+" "+address+" with "+sortedResults.length+" proposals");

                    console.log("proposals: "+JSON.stringify(sortedResults));

                    setTotalDefeated(defeated);
                    setTotalPassed(passed);
                    setTotalProposals(sortedResults.length);
                    setTotalTotalVotesCasted(ttvc);

                    setProposals(sortedResults);

                    
                }
            }catch(e){
                console.log("ERR: "+e);
            }
        setMax(finalList.length);
        setLoading(false);
        return finalList;
    }

    const fetchMintListMetaData = async(finalList:any) => {
        let x=0;
        let length = finalList.length;
        setMax(length);
        const normalise = (value:number) => ((value - MIN) * 100) / (length - MIN);

        for (var item of finalList){
            setStatus("Fetching "+x+" of "+length);
            x++;
            setProgress((prevProgress) => (prevProgress >= 100 ? 0 : normalise(x)));
            
            let image = null;
            let attributes = null;
            try {
                let file_metadata = item.json;
                let file_metadata_url = new URL(file_metadata);
                
                const IPFS = 'https://ipfs.io';
                const IPFS_2 = "https://nftstorage.link/ipfs";
                          
                if (file_metadata.startsWith(IPFS) || file_metadata.startsWith(IPFS_2)){
                    file_metadata = CLOUDFLARE_IPFS_CDN+file_metadata_url.pathname;
                }

                const metadata = await window.fetch(PROXY+file_metadata)
                .then(
                    (res: any) => res.json()
                );
                image = metadata.image;
                attributes = metadata?.attributes;
                //return metadata;
            } catch (e) { // Handle errors from invalid calls
            }
            item.image = image;
            item.attributes = attributes;
        }
            // prepare to export if this is fetched (will take a good 10mins to fetch 10k collection)
            /*
            if (!jsonToImage && item.metadata.uri){
                const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
                    JSON.stringify(finalList)
                )}`;
                const link = document.createElement("a");
                link.href = jsonString;
                link.download = updateAuthority.substring(0,9)+".json";
                link.click();
            }*/
        return finalList;
    }
    
    const exportFile = async(finalList:string, csvFile:string, fileName:string) => {
        setStatus(`File generated! - ${finalList.length} mints`);
            const jsonString = `data:text/json;chatset=utf-8,${encodeURIComponent(
                JSON.stringify(finalList)
            )}`;
            
            setStringGenerated(JSON.stringify(finalList));
            setFileGenerated(jsonString);
            
            const jsonCSVString = `data:text/csv;chatset=utf-8,${csvFile}`;
            
            setCSVGenerated(jsonCSVString); 
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
        console.log("text: "+text);
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

    const processGovernance = async(updateAuthority:string) => {
        
        const drive = await new ShdwDrive(new Connection(GRAPE_RPC_ENDPOINT), wallet).init();
        //console.log("drive: "+JSON.stringify(drive));
        setThisDrive(drive);
        
        if (governanceAddress){
            let finalList = null;
            setFileGenerated(null);
            
            setLoading(true);
            
            finalList = await fetchGovernance(governanceAddress);
            
            if (finalList){
                /*
                const finalMintList = await fetchMintListMetaData(finalList);
                
                if (finalMintList){
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
                    const fileName = governanceAddress+'.json';
                    exportFile(finalList, csvFile, fileName);
                }
                */
            }
            setLoading(false);
        }
    }

    function blobToFile(theBlob: Blob, fileName: string){       
        return new File([theBlob], fileName, { lastModified: new Date().getTime(), type: theBlob.type })
    }

    const handleUploadToStoragePool = async () => {
        const fileName = governanceAddress+'.json';
        //exportJSON(fileGenerated, fileName);
        
        if (!thisDrive){
            // set drive again here?
            alert("Drive not initialized...");
        } else{
            const storageAccountPK = '5pKmUSyh4VEpVhCCYon1kFf6fn5REtmk1rz4sGXyMrAZ';
            const uploadFile = await returnJSON(stringGenerated, fileName);
            //const fileBlob = await fileToDataUri(uploadFile);
            // auto check if this file exists (now we manually do this)
            
            const response = await thisDrive.listObjects(new PublicKey(storageAccountPK))

            let found = false;
            if (response?.keys){
                for (var item of response.keys){
                    if (item === fileName){
                        found = true;
                    }
                }
            }

            console.log("File found: "+JSON.stringify(found))

            const fileType = null;
            /*
            const fd = new FormData();
            fd.append("file",
                new Blob([uploadFile], {type: fileType}),
                fileName
            );*/

            //const fileStream = new File([uploadFile], fileName);
            const fileStream = blobToFile(uploadFile, fileName);
            //const altStream = <ShadowFile>{uploadFile, fileName}
            /*
            const fileStream = new File([uploadFile], fileName, 
                {
                    lastModified: new Date().getTime()
                });
            */
            if (found){
                const storageAccountFile = 'https://shdw-drive.genesysgo.net/'+storageAccountPK+'/'+fileName;
                uploadReplaceToStoragePool(fileStream, storageAccountFile, new PublicKey(storageAccountPK), 'v2');
            }else{
                uploadToStoragePool(fileStream, new PublicKey(storageAccountPK));
            }
        }
    }

    const processMintAddress = async(updateAuthority:string) => {
        
        setFileGenerated(null);

        if(governanceAddress){
            // get from mint address the collectionaddress and/or update authority and then pass this call again
            /*
            let mint_address = new PublicKey(mintAddress);
            let [pda, bump] = await PublicKey.findProgramAddress([
                Buffer.from("metadata"),
                METAPLEX_PROGRAM_ID.toBuffer(),
                new PublicKey(mint_address).toBuffer(),
            ], METAPLEX_PROGRAM_ID)

            console.log("PDA ("+mintAddress+"): "+pda);
            const metadata = await qnconnection.getAccountInfo(pda);

            if (metadata?.data){
                try{
                    let meta_primer = metadata;
                    let buf = Buffer.from(metadata.data);
                    //console.log("HERE!")
                    let meta_final = decodeMetadata(buf);
                    //console.log("meta_final: "+JSON.stringify(meta_final));

                    if (meta_final.updateAuthority){
                        setUpdateAuthorityAddress(meta_final.updateAuthority);
                        if (meta_final?.collection){
                            setCollectionAddress(meta_final?.collection.key);
                        } else{
                            setCollectionAddress(meta_final.updateAuthority)
                        }
                    }
                } catch(e){
                    console.log("ERR: "+e);
                }
            }
            */
        }
    }

    React.useEffect(() => { 
        if (!tokenMap){
            getTokens();
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
                    Grape Governance API
                </Typography>

                <TextField 
                    fullWidth 
                    label="Enter a governance address" 
                    onChange={(e) => setGovernanceAddress(e.target.value)}/>
                
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
                
                <Button 
                    //onClick ={() => processProposals(governanceAddress)} 
                    disabled={(!proposals)}
                    variant='contained'
                >
                    Generate Historical Governance Snapshot
                </Button>

                <Typography variant='subtitle1' sx={{textAlign:'center'}}>
                    {status}
                </Typography>

                {fileGenerated &&
                    <ButtonGroup>                    
                        <Tooltip title="Download Grape Governance JSON file">
                            <Button
                                download={`${governanceAddress}.json`}
                                href={fileGenerated}
                            >
                                <DownloadIcon /> JSON
                            </Button>
                        </Tooltip>
                        <Tooltip title="Download Grape Governance CSV file">
                            <Button
                                download={`${governanceAddress}.csv`}
                                href={csvGenerated}
                            >
                                <DownloadIcon /> CSV
                            </Button>
                        </Tooltip>
                        <Tooltip title="Upload to Grape Governance decentralized storage pool (used for Grape Governance API)">
                            <Button
                                onClick={handleUploadToStoragePool}
                                sx={{ml:1}}
                            >
                                <CloudUploadIcon />
                            </Button>
                        </Tooltip>
                    </ButtonGroup>

                }

                <Box sx={{ width: '100%' }}>
                    <LinearProgressWithLabel value={progress} />
                </Box>
            </Stack>
            
        </Box>
    );
}