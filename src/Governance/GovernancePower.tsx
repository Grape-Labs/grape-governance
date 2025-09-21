
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import bs58 from 'bs58';

import { 
    TOKEN_PROGRAM_ID, 
    getMint,
    getAssociatedTokenAddress
} from "@solana/spl-token-v2";
import { publicKey as umiPublicKey  } from '@metaplex-foundation/umi'
import { Metadata, TokenRecord, fetchDigitalAsset, MPL_TOKEN_METADATA_PROGRAM_ID, getCreateMetadataAccountV3InstructionDataSerializer } from "@metaplex-foundation/mpl-token-metadata";
import {createUmi} from "@metaplex-foundation/umi-bundle-defaults"
            
import { RegexTextField } from '../utils/grapeTools/RegexTextField';
import ExplorerView from '../utils/grapeTools/Explorer';

import { styled, useTheme } from '@mui/material/styles';

import {
  Typography,
  Tooltip,
  Button,
  Grid,
  Box,
  IconButton,
  ButtonGroup,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Divider,
  List, 
  ListItem, 
  ListItemText,
  OutlinedInput,
  InputAdornment,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import CancelIcon from '@mui/icons-material/Cancel';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import SettingsIcon from '@mui/icons-material/Settings';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import GroupIcon from '@mui/icons-material/Group';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import AddCircle from '@mui/icons-material/AddCircle';

import { 
    withDepositGoverningTokens,
    withWithdrawGoverningTokens,
    withSetGovernanceDelegate,
} from '@solana/spl-governance';
import { getGrapeGovernanceProgramVersion } from '../utils/grapeTools/helpers';

import { 
    getRealmIndexed,
    getProposalIndexed,
    getProposalNewIndexed,
    getAllProposalsIndexed,
    getGovernanceIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getTokenOwnerRecordsByRealmIndexed,
    getRealmConfigIndexed
} from './api/queries';

import { 
    shortenString, 
    parseMintNaturalAmountFromDecimalAsBN } from '../utils/grapeTools/helpers';

import { 
    RPC_CONNECTION,
} from '../utils/grapeTools/constants';

import { 
    findObjectByGoverningTokenOwner
  } from '../utils/grapeTools/helpers';
//import { LogoutIcon } from '@dynamic-labs/sdk-react-core';

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
}

// ==== add near your imports (below constants) ====

const cardSX = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "16px",
  p: 1.5,
};

const sectionSX = {
  m: 2,
  background: "rgba(255,255,255,0.03)",
  borderRadius: "16px",
  p: 2,
  width: "100%",
  minWidth: "360px",
};

function fmt(amount?: number | string | null, decimals = 0, digits = 0): string {
  if (amount == null) return "0";
  const n = Number(amount) / Math.pow(10, decimals);
  if (!isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function fmtInt(amount?: number | string | null, decimals = 0): string {
  if (amount == null) return "0";
  const n = Math.floor(Number(amount) / Math.pow(10, decimals));
  if (!isFinite(n)) return "0";
  return n.toLocaleString();
}

const BootstrapDialogTitle = (props: DialogTitleProps) => {
    const { children, onClose, ...other } = props;
  
    return (
      <DialogTitle sx={{ m: 0, p: 2 }} {...other}>
        {children}
        {onClose ? (
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        ) : null}
      </DialogTitle>
    );
};

const BootstrapDialog = styled(Dialog)(({ theme }) => ({
    '& .MuDialogContent-root': {
      padding: theme.spacing(2),
    },
    '& .MuDialogActions-root': {
      padding: theme.spacing(1),
    },
}));
  
export default function GovernancePower(props: any){
    const governanceAddress = props.governanceAddress;
    const [realm, setRealm] = React.useState(props?.realm || null);
    //const [cachedMemberMap, setCachedMemberMap] = React.useState(props?.cachedMemberMap || false);
    const [rpcMemberMap, setRpcMemberMap] = React.useState(null);
    const [isParticipatingInDao, setIsParticipatingInDao] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [depositedCommunityMint, setDepositedCommunityMint] = React.useState(null);
    const [depositedCouncilMint, setDepositedCouncilMint] = React.useState(null);
    const [walletCommunityMintAddress, setWalletCommunityMintAddress] = React.useState(null);
    const [walletCouncilMintAddress, setWalletCouncilMintAddress] = React.useState(null);
    const [walletCommunityMintAmount, setWalletCommunityMintAmount] = React.useState(null);
    const [walletCouncilMintAmount, setWalletCouncilMintAmount] = React.useState(null);
    const { publicKey, wallet, sendTransaction } = useWallet();
    const [mintName, setMintName] = React.useState(null);
    const [mintDecimals, setMintDecimals] = React.useState(null);
    const [mintLogo, setMintLogo] = React.useState(null);
    const [refresh, setRefresh] = React.useState(false);
    const [isCouncilSelected, setIsCouncilSelected] = React.useState(false);
    const [currentCommunityDelegate, setCurrentCommunityDelegate] = React.useState(null);
    const [currentCouncilDelegate, setCurrentCouncilDelegate] = React.useState(null);
    const [currentCommunityDelegateFrom, setCurrentCommunityDelegateFrom] = React.useState(null);
    const [currentCouncilDelegateFrom, setCurrentCouncilDelegateFrom] = React.useState(null);
    const [currentCommunityDelegateFromAmount, setCurrentCommunityDelegateFromAmount] = React.useState(null);
    const [currentCouncilDelegateFromAmount, setCurrentCouncilDelegateFromAmount] = React.useState(null);
    const [isPlugin, setIsPlugin] = React.useState(false);
    const [realmConfig, setRealmConfig] = React.useState(null);

    const { enqueueSnackbar, closeSnackbar } = useSnackbar();


    const getTokenMintInfo = async(mintAddress:string) => {
        
        const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(mintAddress));

        //const tokenName = mintInfo.name;
        
        //JSON.stringify(mintInfo);

        const decimals = mintInfo.decimals;
        setMintDecimals(decimals);
        
        const mint_address = new PublicKey(mintAddress)
        
        const umi = createUmi(RPC_CONNECTION);
        const asset = await fetchDigitalAsset(umi, umiPublicKey(mint_address.toBase58()));

        //console.log("Asset: ",(asset))

        if (asset){
            if (asset?.metadata?.name)
                setMintName(asset.metadata.name.trim());
            if (asset?.metadata?.uri){
                try{
                    const metadata = await window.fetch(asset.metadata.uri)
                    .then(
                        (res: any) => res.json())
                    .catch((error) => {
                        // Handle any errors that occur during the fetch or parsing JSON
                        console.error("Error fetching data:", error);
                    });
                    
                    if (metadata && metadata?.image){
                        if (metadata.image)
                            setMintLogo(metadata.image);
                    }
                }catch(err){
                    console.log("ERR: ",err);
                }
            }
        }

        return asset?.metadata;
    }

    async function getWalletAndGovernanceOwner(){
        //console.log("realm.owner? "+realm?.owner)
        //console.log("governnaceAddress "+governanceAddress)
        //const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, new PublicKey(realm?.owner || SYSTEM_PROGRAM_ID), new PublicKey(governanceAddress));
        //console.log("rawTokenOwnerRecords: "+rawTokenOwnerRecords);
        //setRpcMemberMap(rawTokenOwnerRecords);
        
        //console.log("realm: "+JSON.stringify(realm));

        if (realm){
            let communityMint = null;
            if (typeof realm.account.communityMint.toBase58 === 'function') {
                communityMint = realm.account.communityMint.toBase58();
            } else {
                communityMint = realm.account.communityMint;
            }

            let councilMint = null;
            if (realm.account.config?.councilMint?.toBase58) {
                councilMint = realm.account.config.councilMint.toBase58();
            } else {
                councilMint = realm.account.config.councilMint;
            }
            
            setWalletCommunityMintAddress(communityMint);
            setWalletCouncilMintAddress(councilMint);

            console.log("Start tryGetRealmConfig");
            //alert('get realm config...');
            //const config = await tryGetRealmConfig(RPC_CONNECTION, new PublicKey(realm?.owner), new PublicKey(realm?.pubkey));
            const config = await getRealmConfigIndexed(null, new PublicKey(realm?.owner), new PublicKey(realm?.pubkey));
            let plugin = false;
            setIsPlugin(false);
            if (config?.account?.communityTokenConfig?.voterWeightAddin){
                plugin = true;
                setIsPlugin(true);
                setRealmConfig(config);
            }

            //console.log("End tryGetRealmConfig");

            //const tokenOwnerRecord = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, new PublicKey(realm?.owner || SYSTEM_PROGRAM_ID), publicKey);
            //console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecordV1));
            const tokenOwnerRecord = await getTokenOwnerRecordsByRealmIndexed(governanceAddress, new PublicKey(realm?.owner).toBase58(), publicKey.toBase58());

            //console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecord));
            // find all instances of this governanceAddress:
            let depCommunityMint = null;
            let depCouncilMint = null;
            let depCommunityDelegate = null;
            let depCouncilDelegate = null;
            let fetchedTMI = false;
            setCurrentCommunityDelegate(null);
            setCurrentCouncilDelegate(null);
            setCurrentCommunityDelegateFrom(null);
            setCurrentCouncilDelegateFrom(null);
            setCurrentCommunityDelegateFromAmount(null);
            setCurrentCouncilDelegateFromAmount(null);
            
            for (let record of tokenOwnerRecord){
                if (record.account.realm.toBase58() === governanceAddress){
                    
                    if (record.account.governingTokenOwner.toBase58() === publicKey.toBase58()){
                        if (record.account.governingTokenMint.toBase58() === communityMint){
                            const tki = await getTokenMintInfo(communityMint);
                            fetchedTMI = true;
                            //console.log("tokenMintInfo: "+JSON.stringify(tki));
                            depCommunityMint = Number(record.account.governingTokenDepositAmount);
                            depCommunityDelegate = record.account?.governanceDelegate;
                        }else if (record.account.governingTokenMint.toBase58() === councilMint){
                            depCouncilMint = Number(record.account.governingTokenDepositAmount); 
                            depCouncilDelegate = record.account?.governanceDelegate;
                        }
                        //console.log("record "+JSON.stringify(record));
                    } else if (record.account.governanceDelegate.toBase58() === publicKey.toBase58()){
                        if (record.account.governingTokenMint.toBase58() === communityMint){
                            setCurrentCommunityDelegateFrom(record.account.governingTokenOwner.toBase58());
                            setCurrentCommunityDelegateFromAmount(Number(record.account.governingTokenDepositAmount));
                        } else if (record.account.governingTokenMint.toBase58() === councilMint){
                            setCurrentCouncilDelegateFrom(record.account.governingTokenOwner.toBase58());
                            setCurrentCouncilDelegateFromAmount(Number(record.account.governingTokenDepositAmount));
                        }
                        //console.log("delegate "+JSON.stringify(record));
                    }

                }
            }

            //console.log("de com: "+depCommunityDelegate);
            //console.log("dep con: "+depCouncilDelegate);

            if (depCommunityMint && Number(depCommunityMint) > 0){
                setDepositedCommunityMint(depCommunityMint);
                if (depCommunityDelegate)
                    setCurrentCommunityDelegate(depCommunityDelegate.toBase58());
            } 
            // do not change this to an else (we show both council/community)
            if (depCouncilMint && Number(depCouncilMint) > 0){
                setDepositedCouncilMint(depCouncilMint);
                if (depCouncilDelegate)
                    setCurrentCouncilDelegate(depCouncilDelegate.toBase58());
            }

            //const govOwnerRecord = await getTokenOwnerRecord(RPC_CONNECTION, publicKey);

            //console.log("govOwnerRecord: "+JSON.stringify(govOwnerRecord));

            const tokenBalance = await RPC_CONNECTION.getParsedTokenAccountsByOwner(
                publicKey,
                {
                programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                }
            )
            
            if (tokenBalance?.value){
                for (let titem of tokenBalance?.value){
                    if (titem.account.data.parsed.info.mint === communityMint){
                       setWalletCommunityMintAmount(titem.account.data.parsed.info.tokenAmount.amount);
                        if (!fetchedTMI)
                            await getTokenMintInfo(communityMint);
                    } else if (titem.account.data.parsed.info.mint === councilMint){
                        setWalletCouncilMintAmount(titem.account.data.parsed.info.tokenAmount.amount);
                    }
                }
            }
        }
    }

    React.useEffect(() => {
        if (publicKey && rpcMemberMap){

            //const foundObject = findObjectByGoverningTokenOwner(rpcMemberMap, publicKey.toBase58(), true, 0)
            const foundObject = getTokenOwnerRecordsByRealmIndexed(governanceAddress, null, publicKey.toBase58());
            if (foundObject){
                setIsParticipatingInDao(true);
            }
        }
    }, [rpcMemberMap]);

    React.useEffect(() => {
        if (publicKey || refresh){
            setLoading(true);
            getWalletAndGovernanceOwner();
            setLoading(false);
            setRefresh(false);
        }
    }, [publicKey, refresh]);

    const setGovernanceDelegate = async(mintAddress: string, delegateAddress: string) => {
        const withMint = new PublicKey(mintAddress);
        const delegate = delegateAddress ? new PublicKey(delegateAddress) : null;
        const programId = new PublicKey(realm.owner);
        //console.log("programId: "+JSON.stringify(programId));
        const realmPk = new PublicKey(realm.pubkey);
        const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realmPk);
        //console.log("programVersion: "+JSON.stringify(programVersion));

        //const tokenInfo = await getMint(RPC_CONNECTION, withMint);
        /*
        const userAtaPk = await getAssociatedTokenAddress(
            withMint,
            publicKey, // owner
            true
          )
        */

        //console.log("userATA: "+JSON.stringify(userAtaPk))
        // Extract the mint authority
        //const mintAuthority = tokenInfo.mintAuthority ? new PublicKey(tokenInfo.mintAuthority) : null;
        //const decimals = tokenInfo.decimals;


        const instructions: TransactionInstruction[] = []
        
        // also relinquish recursively if needed:
        // withRelinquishVote
        
        /*
        console.log("programId: "+programId);
        console.log("programVersion: "+programVersion);
        console.log("realmPk: "+realmPk);
        console.log("withMint: "+withMint);
        console.log("publicKey: "+publicKey);
        console.log("delegate: "+delegate);
        */

        await withSetGovernanceDelegate(
            instructions,
            programId,
            programVersion,
            realmPk,
            withMint,
            publicKey,
            publicKey,
            delegate
        );
        
        
        if (instructions){
            const transaction = new Transaction();
            transaction.add(...instructions);
            
            console.log("TX: "+JSON.stringify(transaction))

            try{
                enqueueSnackbar(`Preparing to set your delegated voting power `,{ variant: 'info' });
                const signature = await sendTransaction(transaction, RPC_CONNECTION, {
                    skipPreflight: true,
                    preflightCommitment: "confirmed",
                });
                const snackprogress = (key:any) => (
                    <CircularProgress sx={{padding:'10px'}} />
                );
                const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
                //await connection.confirmTransaction(signature, 'processed');
                const latestBlockHash = await RPC_CONNECTION.getLatestBlockhash();
                await RPC_CONNECTION.confirmTransaction({
                    blockhash: latestBlockHash.blockhash,
                    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                    signature: signature}, 
                    'finalized'
                );
                closeSnackbar(cnfrmkey);
                const action = (key:any) => (
                        <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                            Signature: {shortenString(signature,5,5)}
                        </Button>
                );
                
                enqueueSnackbar(`Congratulations, you now have adjusted your delegated governance power`,{ variant: 'success', action });

                // trigger a refresh here...
                setRefresh(true);
            }catch(e:any){
                enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
            } 
        } else{
            //alert("No voter record!")
            console.log("ERROR: Something went wrong");
            enqueueSnackbar(`Instructions Error`, { variant: 'error' });
        }
        
    }

    const withdrawVotesToGovernance = async(tokenAmount: number, tokenDecimals: number, mintAddress: string) => {
        const withMint = new PublicKey(mintAddress);
        const programId = new PublicKey(realm.owner);
        const realmPk = new PublicKey(realm.pubkey);
        const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realmPk);
        console.log("programVersion: "+JSON.stringify(programVersion));

        const tokenInfo = await getMint(RPC_CONNECTION, withMint);
        
        const userAtaPk = await getAssociatedTokenAddress(
            withMint,
            publicKey, // owner
            true
          )

        console.log("userATA: "+JSON.stringify(userAtaPk))
        // Extract the mint authority
        const mintAuthority = tokenInfo.mintAuthority ? new PublicKey(tokenInfo.mintAuthority) : null;
        const decimals = tokenInfo.decimals;

        //const atomicAmount = tokenAmount;
        /*
        const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
            tokenAmount,
            tokenDecimals
        )*/

        const instructions: TransactionInstruction[] = []
       

        // also relinquish recursively if needed:
        // withRelinquishVote
        
        await withWithdrawGoverningTokens(
            instructions,
            programId,
            programVersion,
            realmPk,
            userAtaPk,
            withMint,
            publicKey,
        )
        
        if (instructions.length != 1) {
            console.log("ERROR: Something went wrong");
            enqueueSnackbar(`Instructions Error`, { variant: 'error' });
        } else{
            if (instructions){

                const transaction = new Transaction();
                transaction.add(...instructions);
                
                console.log("TX: "+JSON.stringify(transaction))

                try{
                    enqueueSnackbar(`Preparing to withdraw governance power`,{ variant: 'info' });
                    const signature = await sendTransaction(transaction, RPC_CONNECTION, {
                        skipPreflight: true,
                        preflightCommitment: "confirmed",
                    });
                    const snackprogress = (key:any) => (
                        <CircularProgress sx={{padding:'10px'}} />
                    );
                    const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
                    //await connection.confirmTransaction(signature, 'processed');
                    const latestBlockHash = await RPC_CONNECTION.getLatestBlockhash();
                    await RPC_CONNECTION.confirmTransaction({
                        blockhash: latestBlockHash.blockhash,
                        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                        signature: signature}, 
                        'finalized'
                    );
                    closeSnackbar(cnfrmkey);
                    const action = (key:any) => (
                            <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                                Signature: {shortenString(signature,5,5)}
                            </Button>
                    );
                    
                    enqueueSnackbar(`Congratulations, you now have withdrawn your governance power`,{ variant: 'success', action });

                    // trigger a refresh here...
                    setRefresh(true);
                }catch(e:any){
                    enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                } 
            } else{
                alert("No voter record!")
            }
        }
    }

    const depositVotesToGovernance = async(tokenAmount: number, tokenDecimals: number, mintAddress: string) => {
        const withMint = new PublicKey(mintAddress);
        const programId = new PublicKey(realm.owner);
        console.log("programId: "+JSON.stringify(programId));

        if (isPlugin){
            alert("Plugin/VSR/NFT Deposits Coming Soon - use the Realms UI to deposit your tokens to this Governance")
        } else {
            const realmPk = new PublicKey(realm.pubkey);
            const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realmPk);
            
            const tokenInfo = await getMint(RPC_CONNECTION, withMint);
            
            const userAtaPk = await getAssociatedTokenAddress(
                withMint,
                publicKey, // owner
                true
            )

            console.log("userATA: "+JSON.stringify(userAtaPk))
            // Extract the mint authority
            const mintAuthority = tokenInfo.mintAuthority ? new PublicKey(tokenInfo.mintAuthority) : null;
            const decimals = tokenInfo.decimals;

            //const atomicAmount = tokenAmount;
            
            const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
                tokenAmount,
                tokenDecimals
            )

            const instructions: TransactionInstruction[] = []
            /*
            console.log("realm: "+realmPk.toBase58())
            console.log("governingTokenSource / userAtaPk: "+userAtaPk.toBase58())
            console.log("governingTokenMint: "+withMint.toBase58())
            console.log("governingTokenOwner: "+publicKey.toBase58())
            //console.log("governingTokenSourceAuthority: "+mintAuthority?.toBase58())
            //console.log("payer: "+fromWallet.toBase58())
            console.log("amount: "+atomicAmount);
            */
            
            await withDepositGoverningTokens(
                instructions,
                programId,
                programVersion,
                realmPk,
                userAtaPk,
                withMint,
                publicKey,
                publicKey,
                publicKey,
                atomicAmount,
                false
            )
            
            if (instructions.length != 1) {
                console.log("ERROR: Something went wrong");
                enqueueSnackbar(`Instructions Error`, { variant: 'error' });
            } else{
                if (instructions){

                    const transaction = new Transaction();
                    transaction.add(...instructions);
                    
                    console.log("TX: "+JSON.stringify(transaction))

                    /*
                    const meSigner = "IF WE ARE SENDING DIRECTLY TO A DAO WALLET";
                    for (var instruction of transaction.instructions){
                        for (var key of instruction.keys){
                            if (key.pubkey.toBase58() === meSigner){
                                key.isSigner = false;
                            }
                        }
                    }*/

                    try{
                        enqueueSnackbar(`Preparing to deposit governance power`,{ variant: 'info' });
                        const signature = await sendTransaction(transaction, RPC_CONNECTION, {
                            skipPreflight: true,
                            preflightCommitment: "confirmed",
                        });
                        const snackprogress = (key:any) => (
                            <CircularProgress sx={{padding:'10px'}} />
                        );
                        const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
                        //await connection.confirmTransaction(signature, 'processed');
                        const latestBlockHash = await RPC_CONNECTION.getLatestBlockhash();
                        await RPC_CONNECTION.confirmTransaction({
                            blockhash: latestBlockHash.blockhash,
                            lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                            signature: signature}, 
                            'finalized'
                        );
                        closeSnackbar(cnfrmkey);
                        const action = (key:any) => (
                                <Button href={`https://explorer.solana.com/tx/${signature}`} target='_blank'  sx={{color:'white'}}>
                                    Signature: {shortenString(signature,5,5)}
                                </Button>
                        );
                        
                        enqueueSnackbar(`Congratulations, you now have more governance power`,{ variant: 'success', action });

                        // trigger a refresh here...
                        setRefresh(true);
                    }catch(e:any){
                        enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                    } 
                } else{
                    alert("No voter record!")
                }
            }
        }
    }

    function handleDepositCommunityMax(){
        //const selectedTokenMint = event.target.value as string;
        //setTokenMint(selectedTokenMint);
        depositVotesToGovernance(walletCommunityMintAmount, 0, walletCommunityMintAddress);
    
    }
    function handleDepositCouncilMax(){
        //const selectedTokenMint = event.target.value as string;
        //setTokenMint(selectedTokenMint);
        depositVotesToGovernance(walletCouncilMintAmount, 0, walletCouncilMintAddress);
    }

    function handleWithdrawCommunityMax(){
        withdrawVotesToGovernance(walletCommunityMintAmount, 0, walletCommunityMintAddress)
    }
    function handleWithdrawCouncilMax(){
        withdrawVotesToGovernance(walletCouncilMintAmount, 0, walletCouncilMintAddress)
    }

    function AdvancedCommunityVoteDepositPrompt(props: any){
        const selectedMintName = props?.mintName;
        const inlineAdvanced = props?.inlineAdvanced;
        const selectedMintAddress = props?.mintAddress;
        const selectedMintAvailableAmount = props?.mintAvailableAmount;
        const selectedMintDepositedAmount = props?.mintVotingPower;
        const isCouncil= props?.isCouncil;
        const decimals = isCouncil ? 0 : (props?.decimals || mintDecimals);

        const [delegatedStr, setDelegatedStr] = React.useState<string | null>(null);
        const [open, setOpen] = React.useState(false);
        const [newDepositAmount, setNewDepositAmount] = React.useState<number>(
            Number(selectedMintAvailableAmount) > 0 ? Number(selectedMintAvailableAmount) / Math.pow(10, decimals) : 0
        );

        const handleClickOpen = () => setOpen(true);
        const handleClose = () => setOpen(false);
        const handleSetDelegateStr = (e: any) => setDelegatedStr(e.target.value?.trim() || null);

        function handleClickRemoveDelegate(){
            setGovernanceDelegate(selectedMintAddress, null);
        }
        function handleClickSetDelegate(){
            if (!delegatedStr) return;
            if (!isCouncil && delegatedStr === currentCommunityDelegate) return;
            if ( isCouncil && delegatedStr === currentCouncilDelegate) return;
            if (delegatedStr === publicKey.toBase58()) return;
            setGovernanceDelegate(selectedMintAddress, delegatedStr);
        }

        function handleAdvancedDepositVotesToGovernance(){
            const maxHuman = Number(selectedMintAvailableAmount)/Math.pow(10, decimals);
            const amt = Number(newDepositAmount || 0);
            if (amt > 0 && amt <= maxHuman){
            depositVotesToGovernance(amt, decimals, selectedMintAddress);
            } else {
            // fallback to max
            depositVotesToGovernance(maxHuman, decimals, selectedMintAddress);
            }
            setOpen(false);
        }
        function handleAdvancedDepositMaxVotesToGovernance(){
            const maxHuman = Number(selectedMintAvailableAmount)/Math.pow(10, decimals);
            depositVotesToGovernance(maxHuman, decimals, selectedMintAddress);
            setOpen(false);
        }

        const deposited = fmtInt(selectedMintDepositedAmount, decimals);
        const inWallet = fmt(selectedMintAvailableAmount, decimals);
        const afterDeposit = (() => {
            const base = Number(selectedMintDepositedAmount)/Math.pow(10, decimals);
            const add = Number(newDepositAmount || 0) || Number(selectedMintAvailableAmount)/Math.pow(10, decimals);
            return Math.floor(base + add).toLocaleString();
        })();

        const hasAvailable = Number(selectedMintAvailableAmount) > 0;

        return (
            <>
            <Tooltip title="Advanced (amount, delegate, withdraw)">
                <IconButton
                aria-label="Advanced"
                color={inlineAdvanced ? 'inherit' : 'success'}
                onClick={handleClickOpen}
                sx={{ fontSize:'10px', minWidth: inlineAdvanced ? 0 : undefined }}
                >
                <SettingsIcon sx={{ fontSize: inlineAdvanced ? 16 : 18 }} />
                </IconButton>
            </Tooltip>

            <Dialog open={open} onClose={handleClose}
                PaperProps={{
                style: {
                    background: '#13151C',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 20
                }
                }}
            >
                <BootstrapDialogTitle id="advanced" onClose={handleClose}>
                Advanced
                </BootstrapDialogTitle>

                <DialogContent>
                <DialogContentText component="div">
                    <Grid container>
                    {/* Totals card */}
                    <Box sx={sectionSX}>
                        {hasAvailable && (
                        <>
                            <Box sx={{ mb: 2 }}>
                            <Grid container alignItems="center">
                                <Grid item xs>
                                <Typography variant="h6">New total after deposit</Typography>
                                </Grid>
                                <Grid item>
                                <Typography variant="h6">{afterDeposit}</Typography>
                                </Grid>
                            </Grid>
                            <Typography color="text.secondary" variant="body2">
                                Estimated voting power after this deposit
                            </Typography>
                            </Box>
                            <Divider variant="middle" />
                        </>
                        )}

                        <Box sx={{ mt: hasAvailable ? 2 : 0 }}>
                        <Grid container alignItems="center">
                            <Grid item xs>
                            <Typography variant="subtitle2">Deposited</Typography>
                            </Grid>
                            <Grid item>
                            <Typography variant="body1">{deposited}</Typography>
                            </Grid>
                        </Grid>
                        <Typography color="text.secondary" variant="caption">
                            Your current voting power
                            <Tooltip title="Withdraw">
                            <IconButton
                                aria-label="Withdraw"
                                color="inherit"
                                onClick={isCouncil ? handleWithdrawCouncilMax : handleWithdrawCommunityMax}
                                sx={{ ml: 1 }}
                                size="small"
                            >
                                <LogoutIcon fontSize="inherit" />
                            </IconButton>
                            </Tooltip>
                        </Typography>
                        </Box>

                        {hasAvailable && (
                        <Box sx={{ mt: 2 }}>
                            <Grid container alignItems="center">
                            <Grid item xs>
                                <Typography variant="subtitle2">In Wallet</Typography>
                            </Grid>
                            <Grid item>
                                <Typography variant="body1">{inWallet}</Typography>
                            </Grid>
                            </Grid>
                            <Typography color="text.secondary" variant="caption">
                            Undeposited voting power available in your wallet
                            </Typography>
                        </Box>
                        )}

                        <Box sx={{ mt: 2 }}>
                        <Grid container justifyContent="flex-end" alignItems="center">
                            <Grid item>
                            <ExplorerView
                                address={selectedMintAddress}
                                title={`Governing Mint ${selectedMintName ? selectedMintName : `${selectedMintAddress.slice(0, 3)}...${selectedMintAddress.slice(-3)}`}`}
                                type="address" shorten={8} hideTitle={false} style="text" color="white" fontSize="14px"
                                showTokenMetadata={true}
                            />
                            </Grid>
                        </Grid>
                        </Box>
                    </Box>

                    {/* Delegation card */}
                    <Box sx={sectionSX}>
                        <Box>
                        <Grid container alignItems="center" spacing={1}>
                            <Grid item xs>
                            <Typography variant="h6">Delegation</Typography>
                            </Grid>
                            <Grid item>
                            <OutlinedInput
                                size="small"
                                sx={{ borderRadius: '14px' }}
                                placeholder="Delegate address"
                                onChange={handleSetDelegateStr}
                                endAdornment={
                                <InputAdornment position="end">
                                    <IconButton
                                    aria-label="Save Delegate"
                                    onClick={handleClickSetDelegate}
                                    edge="end"
                                    color="success"
                                    disabled={
                                        !delegatedStr ||
                                        delegatedStr === publicKey.toBase58() ||
                                        (!isCouncil && currentCommunityDelegate === delegatedStr) ||
                                        (isCouncil && currentCouncilDelegate === delegatedStr)
                                    }
                                    >
                                    <SaveIcon />
                                    </IconButton>
                                </InputAdornment>
                                }
                            />
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 1 }}>
                            { (isCouncil ? currentCouncilDelegate : currentCommunityDelegate) ? (
                            <Grid container alignItems="center" spacing={1}>
                                <Grid item>
                                <ExplorerView 
                                    address={isCouncil ? currentCouncilDelegate : currentCommunityDelegate} 
                                    title={isCouncil ? `You delegate to: ${currentCouncilDelegate.slice(0, 4)}...${currentCouncilDelegate.slice(-4)}` :
                                            `You delegate to: ${currentCommunityDelegate.slice(0, 4)}...${currentCommunityDelegate.slice(-4)}`} 
                                    type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='10px' /> 
                                </Grid>
                                <Grid item>
                                <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    onClick={handleClickRemoveDelegate}
                                    startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                                    sx={{ borderRadius: "12px", textTransform: "none" }}
                                >
                                    Remove
                                </Button>
                                </Grid>
                            </Grid>
                            ) : (
                            <Typography variant="caption" color="text.secondary">
                                Delegate your voting power to another wallet
                            </Typography>
                            )}
                        </Box>
                        </Box>
                    </Box>

                    {/* Incoming delegations */}
                    {currentCommunityDelegateFrom && !isCouncil && (
                        <Box sx={sectionSX}>
                        <Typography variant="subtitle1" gutterBottom>Incoming Delegations — Community</Typography>
                        <Typography color="text.secondary" variant="body2">
                            <ExplorerView 
                                address={currentCommunityDelegateFrom} 
                                title={`${fmt(currentCommunityDelegateFromAmount, decimals)} — from: ${currentCommunityDelegateFrom.slice(0, 4)}...${currentCommunityDelegateFrom.slice(-4)}`}
                                type="address" shorten={4} style="text" color="white" fontSize="14px" />
                        </Typography>
                        </Box>
                    )}
                    {currentCouncilDelegateFrom && isCouncil && (
                        <Box sx={sectionSX}>
                        <Typography variant="subtitle1" gutterBottom>Incoming Delegations — Council</Typography>
                        <Typography color="text.secondary" variant="body2">
                            <ExplorerView 
                                address={currentCouncilDelegateFrom} 
                                title={`${fmt(currentCouncilDelegateFromAmount, decimals)} — from: ${currentCouncilDelegateFrom.slice(0, 4)}...${currentCouncilDelegateFrom.slice(-4)}`}
                                type="address" shorten={4} style="text" color="white" fontSize="14px" />
                        </Typography>
                        </Box>
                    )}
                    </Grid>
                </DialogContentText>

                {hasAvailable && (
                    <RegexTextField
                    regex={/[^0-9]+\.?[^0-9]/gi}
                    autoFocus
                    autoComplete="off"
                    margin="dense"
                    id="preview_deposit_id"
                    label="Amount to deposit"
                    type="text"
                    fullWidth
                    variant="standard"
                    value={newDepositAmount}
                    defaultValue={Number(selectedMintAvailableAmount)/Math.pow(10, decimals)}
                    helperText={
                        <Grid sx={{ textAlign:'right' }}>
                        <Typography variant="caption" color="info">
                            <Button
                            variant="text" size="small"
                            onClick={() => setNewDepositAmount(Number(selectedMintAvailableAmount)/Math.pow(10, decimals))}
                            sx={{ borderRadius:'14px' }}
                            >
                            Max
                            </Button>
                        </Typography>
                        </Grid>
                    }
                    onChange={(e: any) => setNewDepositAmount(Number(e.target.value || 0))}
                    inputProps={{ style: { textAlign:'center', fontSize: 32 } }}
                    />
                )}
                </DialogContent>

                {hasAvailable && (
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                    color="success"
                    onClick={handleAdvancedDepositVotesToGovernance}
                    sx={{ borderRadius:'14px', textTransform: 'none' }}
                    disabled={Number(newDepositAmount) <= 0 || Number(newDepositAmount) > (Number(selectedMintAvailableAmount)/Math.pow(10, decimals))}
                    >
                    <LoginIcon sx={{ mr:1 }} /> Deposit
                    </Button>
                    {/* If you want a 1-click max: */}
                    {/* <Button color="success" variant="outlined" onClick={handleAdvancedDepositMaxVotesToGovernance} sx={{ borderRadius:'14px', textTransform:'none' }}>
                    Deposit Max
                    </Button> */}
                </DialogActions>
                )}
            </Dialog>
            </>
        );
    }

    return(
        <Grid xs={12}>
        {(!publicKey && loading) ?
            <>loading...</>
        :
            <>
                {(publicKey &&
                (((walletCommunityMintAmount && walletCommunityMintAmount > 0)) ||
                (walletCouncilMintAmount && walletCouncilMintAmount > 0)) ||
                (depositedCommunityMint || depositedCouncilMint)) ?
                <Box
                    m={1}
                    display="flex"
                    justifyContent="flex-end"
                    alignItems="flex-end"
                >
                    <Grid
                        sx={{
                            background: 'rgba(0, 0, 0, 0.05)',
                            borderRadius: '17px',
                            p:1,
                            minWidth:'216px',
                            textAlign:'right'
                        }}
                    >
                        {(walletCommunityMintAmount && walletCommunityMintAmount > 0) &&
                            <ButtonGroup color='inherit' sx={{ fontSize:'10px', borderRadius:'17px' }}>
                                <Button 
                                    aria-label="Deposit"
                                    variant="contained" 
                                    color='success'
                                    onClick={handleDepositCommunityMax}
                                    sx={{
                                        borderTopLeftRadius:'17px',
                                        borderBottomLeftRadius:'17px',
                                        borderColor:'rgba(255,255,255,0.05)',
                                        fontSize:'10px',
                                        textTransform:'none',
                                    }}
                                >
                                    <DownloadIcon sx={{fontSize:'14px',mr:1}}/> Deposit&nbsp;
                                    <strong>
                                    {(mintDecimals) ? 
                                    <>
                                        {(+(walletCommunityMintAmount/10**mintDecimals)).toLocaleString()}
                                    </>
                                    :
                                    <>
                                        {walletCommunityMintAmount}
                                    </>
                                    }
                                    </strong>
                                    {mintName ?
                                        <>&nbsp;{mintName}</>
                                        :<>&nbsp;Community</>

                                    }
                                </Button>
                                <AdvancedCommunityVoteDepositPrompt 
                                    mintVotingPower={depositedCommunityMint} 
                                    mintAvailableAmount={walletCommunityMintAmount} 
                                    mintAddress={walletCommunityMintAddress} 
                                    mintName={mintName} 
                                    decimals={mintDecimals} />
                            </ButtonGroup>
                        }

                        {(walletCouncilMintAmount && walletCouncilMintAmount > 0) &&
                            <Button 
                                aria-label="Deposit"
                                variant='outlined'
                                color='inherit'
                                onClick={handleDepositCouncilMax}
                                sx={{
                                    ml:1,
                                    borderRadius:'17px',
                                    borderColor:'rgba(255,255,255,0.05)',
                                    fontSize:'10px',
                                    textTransform:'none',
                                }}
                            >
                                <DownloadIcon sx={{fontSize:'14px',mr:1}}/> Deposit {walletCouncilMintAmount} Council
                            </Button>
                        }

                        {/*
                        <ButtonGroup color='inherit' sx={{ ml: 1, fontSize:'10px', borderRadius:'17px' }}>
                            <Button 
                                aria-label="Deposit"
                                variant="outlined" 
                                color='inherit'
                                sx={{
                                    borderTopLeftRadius:'17px',
                                    borderBottomLeftRadius:'17px',
                                    borderColor:'rgba(255,255,255,0.05)',
                                    fontSize:'10px'}}
                            >
                                Deposit X Council Tokens
                            </Button>
                            <Button 
                                aria-label="Deposit"
                                variant="outlined" 
                                color='inherit'
                                sx={{
                                    borderTopRightRadius:'17px',
                                    borderBottomRightRadius:'17px',
                                    borderColor:'rgba(255,255,255,0.05)',
                                    fontSize:'10px'}}
                            ><SettingsIcon  fontSize='inherit' /></Button>
                        </ButtonGroup>
                        */}
                        <Grid sx={{textAlign:'right', mt:1, 
                              mb: ((walletCouncilMintAmount && walletCouncilMintAmount > 0) || (walletCommunityMintAmount && walletCommunityMintAmount > 0)) ? 0 : 1
                        }}>
                            <Typography sx={{fontSize:'12px'}}>
                                {depositedCommunityMint &&
                                    <>

                                        {(mintDecimals) ? 
                                        <>
                                            {(+(depositedCommunityMint/10**mintDecimals).toFixed(0)).toLocaleString()}
                                        </>
                                        :
                                        <>
                                            {depositedCommunityMint}
                                        </>
                                        }
                                        {mintName ?
                                            <>&nbsp;{mintName}</>
                                            :<>&nbsp;Community</>

                                        }
                                    
                                        <AdvancedCommunityVoteDepositPrompt 
                                            inlineAdvanced={true} 
                                            mintVotingPower={depositedCommunityMint} 
                                            mintAvailableAmount={walletCommunityMintAmount} 
                                            mintAddress={walletCommunityMintAddress} 
                                            mintName={mintName} 
                                            decimals={mintDecimals} />
                                    
                                    </>
                                }
                            {(depositedCommunityMint && depositedCouncilMint) && ` & `}
                            {depositedCouncilMint &&
                                <>
                                {(depositedCouncilMint).toLocaleString()} Council
                                <AdvancedCommunityVoteDepositPrompt 
                                    isCouncil={true} 
                                    inlineAdvanced={true} 
                                    mintVotingPower={depositedCouncilMint} 
                                    mintAvailableAmount={walletCouncilMintAmount} 
                                    mintAddress={walletCouncilMintAddress} 
                                    decimals={0} />
                                
                                </>
                            }
                            </Typography>
                        </Grid>
                    </Grid>
                </Box>  
                :<></>
                }
            </>
            }
        </Grid>
        
    );
}