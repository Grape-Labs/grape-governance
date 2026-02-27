
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

import { Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

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
    withRelinquishVote,
} from '@solana/spl-governance';
import { getGrapeGovernanceProgramVersion } from '../utils/grapeTools/helpers';

import { 
    getProposalNewIndexed,
    getTokenOwnerRecordsByOwnerIndexed,
    getTokenOwnerRecordsByRealmIndexed,
    getRealmConfigIndexed,
    getVoteRecordsByVoterIndexed,
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
import { getUnrelinquishedVoteRecords } from '../utils/governanceTools/models/api';
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

function toBase58Safe(value: any): string {
    try {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (typeof value?.toBase58 === 'function') return value.toBase58();
        return new PublicKey(value).toBase58();
    } catch (_e) {
        return '';
    }
}

function toNumberSafe(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'bigint') return Number(value);

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    if (typeof value?.toNumber === 'function') {
        try {
            return value.toNumber();
        } catch (_e) {
            return 0;
        }
    }

    if (typeof value?.toString === 'function') {
        const parsed = Number(value.toString());
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
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
            
            //if (realm.pubkey != "9mS8GuMx2MkZGMSwa2k87HNLTFZ1ssa9mJ1RkGFKcGyQ"){

              if (config?.account?.communityTokenConfig?.voterWeightAddin){
                  plugin = true;
                  setIsPlugin(true);
                  setRealmConfig(config);
              }
            //}

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

    const relinquishVotesForDaoMint = async (mintAddress: string) => {
        if (!publicKey) {
            enqueueSnackbar(`Wallet not connected`, { variant: 'error' });
            return { attempted: 0, succeeded: 0, failed: 0 };
        }
        if (!realm?.pubkey || !realm?.owner) {
            enqueueSnackbar(`Realm is not loaded`, { variant: 'error' });
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        const withMint = new PublicKey(mintAddress);
        const programId = new PublicKey(realm.owner);
        const realmPk = new PublicKey(realm.pubkey);
        const programVersion = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, programId, realmPk);
        const connectedWallet = publicKey.toBase58();
        const realmPkStr = realmPk.toBase58();
        const withMintStr = withMint.toBase58();

        // Profile page fetches owner records by wallet first, then filters by realm + mint.
        // This avoids missing TORs when governanceDelegate differs from governingTokenOwner.
        const ownerTokenRecords =
            (await getTokenOwnerRecordsByOwnerIndexed(
                realmPkStr,
                programId.toBase58(),
                connectedWallet
            )) || [];

        const tokenOwnerRecord = ownerTokenRecords.find((record: any) =>
            toBase58Safe(record?.account?.realm) === realmPkStr &&
            toBase58Safe(record?.account?.governingTokenOwner) === connectedWallet &&
            toBase58Safe(record?.account?.governingTokenMint) === withMintStr
        );

        if (!tokenOwnerRecord?.pubkey) {
            enqueueSnackbar(`No token owner record found for this DAO + mint`, { variant: 'warning' });
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        const unrelinquishedHint = toNumberSafe(tokenOwnerRecord?.account?.unrelinquishedVotesCount);
        if (unrelinquishedHint <= 0) {
            enqueueSnackbar(`No unrelinquished DAO votes found for this mint`, { variant: 'info' });
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        // Canonical source: chain-level unrelinquished records for this TOR.
        let voteRecords: any[] = [];
        let usedIndexedFallback = false;
        try {
            const unrelinquishedVoteRecords = await getUnrelinquishedVoteRecords(
                RPC_CONNECTION,
                programId,
                new PublicKey(tokenOwnerRecord.pubkey)
            );
            voteRecords = Array.isArray(unrelinquishedVoteRecords) ? unrelinquishedVoteRecords : [];
        } catch (e) {
            console.log("RPC unrelinquished vote lookup failed", e);
            voteRecords = [];
        }

        // Fallback only when RPC lookup returns nothing.
        if (!voteRecords.length) {
            try {
                const indexedVoteRecords = await getVoteRecordsByVoterIndexed(
                    programId.toBase58(),
                    realmPkStr,
                    connectedWallet
                );
                voteRecords = (Array.isArray(indexedVoteRecords) ? indexedVoteRecords : []).filter(
                    (record: any) => record?.account?.isRelinquished !== true
                );
                usedIndexedFallback = voteRecords.length > 0;
                if (usedIndexedFallback) {
                    enqueueSnackbar(`Using indexed vote-record fallback. Results may lag RPC.`, { variant: 'warning' });
                }
            } catch (e) {
                console.log("Indexed vote-record fallback failed", e);
            }
        }

        if (!voteRecords.length) {
            enqueueSnackbar(`No unrelinquished DAO votes found for this mint`, { variant: 'info' });
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        // Profile-style resolution: map only the proposals referenced by our vote records.
        const proposalByPk = new Map<string, any>();
        const seenVoteRecordPks = new Set<string>();
        let proposalLookupFailures = 0;

        const relevantVoteRecords: any[] = [];
        for (const voteRecord of voteRecords) {
            try {
                const voteRecordPk = toBase58Safe(voteRecord?.pubkey);
                if (!voteRecordPk || seenVoteRecordPks.has(voteRecordPk)) continue;

                const proposalPk = toBase58Safe(voteRecord?.account?.proposal);
                if (!proposalPk) continue;

                let proposal = proposalByPk.get(proposalPk);
                if (!proposal?.account) {
                    try {
                        proposal = await getProposalNewIndexed(
                            proposalPk,
                            programId.toBase58(),
                            realmPkStr
                        );
                        if (proposal?.account) {
                            proposalByPk.set(proposalPk, proposal);
                        }
                    } catch (lookupErr) {
                        proposalLookupFailures += 1;
                        console.log("Per-proposal fallback lookup failed", lookupErr);
                    }
                }
                if (!proposal?.account) continue;

                const proposalMint = toBase58Safe(proposal?.account?.governingTokenMint);
                if (proposalMint !== withMintStr) continue;

                const proposalGovernancePk = toBase58Safe(proposal?.account?.governance);
                if (!proposalGovernancePk) continue;

                relevantVoteRecords.push({
                    voteRecordPk,
                    proposalPk,
                    proposalGovernancePk,
                });
                seenVoteRecordPks.add(voteRecordPk);
            } catch (err) {
                console.log("Skipping vote record during relinquish scan", err);
            }
        }

        if (!usedIndexedFallback && unrelinquishedHint > 0 && relevantVoteRecords.length < unrelinquishedHint) {
            enqueueSnackbar(
                `Found ${relevantVoteRecords.length}/${unrelinquishedHint} vote(s) to relinquish for this mint.`,
                { variant: 'warning' }
            );
        }

        if (!relevantVoteRecords.length) {
            enqueueSnackbar(`No unrelinquished DAO votes found for this mint`, { variant: 'info' });
            return { attempted: 0, succeeded: 0, failed: 0 };
        }

        const relinquishInstructions: TransactionInstruction[] = [];
        let buildFailures = 0;

        enqueueSnackbar(`Relinquishing ${relevantVoteRecords.length} vote(s)...`, { variant: 'info' });

        for (const item of relevantVoteRecords) {
            try {
                await withRelinquishVote(
                    relinquishInstructions,
                    programId,
                    programVersion,
                    realmPk,
                    new PublicKey(item.proposalGovernancePk),
                    new PublicKey(item.proposalPk),
                    new PublicKey(toBase58Safe(tokenOwnerRecord.pubkey)),
                    withMint,
                    new PublicKey(item.voteRecordPk),
                    publicKey,
                    publicKey
                );
            } catch (e) {
                console.log("Failed to build relinquish vote instruction", e);
                buildFailures++;
            }
        }

        const RELINQUISH_IXS_PER_TX = 4;
        const chunks: TransactionInstruction[][] = [];
        for (let i = 0; i < relinquishInstructions.length; i += RELINQUISH_IXS_PER_TX) {
            chunks.push(relinquishInstructions.slice(i, i + RELINQUISH_IXS_PER_TX));
        }

        let succeeded = 0;
        let failed = buildFailures;
        for (const chunk of chunks) {
            try {
                const transaction = new Transaction().add(...chunk);
                const signature = await sendTransaction(transaction, RPC_CONNECTION, {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                });

                const latestBlockHash = await RPC_CONNECTION.getLatestBlockhash();
                await RPC_CONNECTION.confirmTransaction(
                    {
                        blockhash: latestBlockHash.blockhash,
                        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                        signature: signature,
                    },
                    'confirmed'
                );
                succeeded += chunk.length;
            } catch (e) {
                console.log("Relinquish vote batch tx failed", e);
                failed += chunk.length;
            }
        }

        if (succeeded > 0) {
            enqueueSnackbar(`Relinquished ${succeeded} vote(s)`, { variant: 'success' });
        }
        if (failed > 0) {
            enqueueSnackbar(`${failed} vote relinquish transaction(s) failed`, { variant: 'warning' });
        }
        if (proposalLookupFailures > 0) {
            enqueueSnackbar(`${proposalLookupFailures} proposal lookup(s) failed while scanning votes`, { variant: 'warning' });
        }

        return { attempted: relevantVoteRecords.length, succeeded, failed };
    };

    const relinquishVotesAndWithdrawToWallet = async (mintAddress: string, isCouncilMint?: boolean) => {
        const relinquishResult = await relinquishVotesForDaoMint(mintAddress);
        if (relinquishResult.failed > 0) {
            enqueueSnackbar(`Some vote relinquish operations failed. Withdraw may still fail.`, { variant: 'warning' });
        }

        if (isCouncilMint) {
            withdrawVotesToGovernance(walletCouncilMintAmount, 0, mintAddress);
        } else {
            withdrawVotesToGovernance(walletCommunityMintAmount, 0, mintAddress);
        }
    };

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

  
function AdvancedCommunityVoteDepositPrompt(props: any) {
  const selectedMintName = props?.mintName;
  const inlineAdvanced = props?.inlineAdvanced;
  const selectedMintAddress = props?.mintAddress;
  const selectedMintAvailableAmount = props?.mintAvailableAmount;
  const selectedMintDepositedAmount = props?.mintVotingPower;
  const isCouncil = props?.isCouncil;
  const decimals = isCouncil ? 0 : (props?.decimals || mintDecimals);

  const [delegatedStr, setDelegatedStr] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [relinquishingVotes, setRelinquishingVotes] = React.useState(false);

  const maxHuman = React.useMemo(() => {
    const v = Number(selectedMintAvailableAmount || 0) / Math.pow(10, decimals);
    return Number.isFinite(v) ? v : 0;
  }, [selectedMintAvailableAmount, decimals]);

  const [newDepositAmount, setNewDepositAmount] = React.useState<number>(
    Number(selectedMintAvailableAmount) > 0 ? maxHuman : 0
  );

  const currentDelegate = isCouncil ? currentCouncilDelegate : currentCommunityDelegate;

  const handleClickOpen = () => {
    setDelegatedStr(currentDelegate || null);
    setNewDepositAmount(Number(selectedMintAvailableAmount) > 0 ? maxHuman : 0);
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  const handleSetDelegateStr = (e: any) => {
    const v = String(e?.target?.value || "").trim();
    setDelegatedStr(v.length ? v : null);
  };

  const delegateLooksValid = React.useMemo(() => {
    const s = delegatedStr || "";
    if (!s) return false;
    try {
      new PublicKey(s);
      return true;
    } catch {
      return false;
    }
  }, [delegatedStr]);

  function handleClickRemoveDelegate() {
    setGovernanceDelegate(selectedMintAddress, null);
  }

  function handleClickSetDelegate() {
    if (!delegatedStr) return;
    if (!isCouncil && delegatedStr === currentCommunityDelegate) return;
    if (isCouncil && delegatedStr === currentCouncilDelegate) return;
    if (delegatedStr === publicKey.toBase58()) return;
    if (!delegateLooksValid) return;

    setGovernanceDelegate(selectedMintAddress, delegatedStr);
  }

  function handleAdvancedDepositVotesToGovernance() {
    const amt = Number(newDepositAmount || 0);
    if (amt > 0 && amt <= maxHuman) {
      depositVotesToGovernance(amt, decimals, selectedMintAddress);
    } else {
      depositVotesToGovernance(maxHuman, decimals, selectedMintAddress);
    }
    setOpen(false);
  }

  const handleRelinquishOnly = async () => {
    try {
      setRelinquishingVotes(true);
      await relinquishVotesForDaoMint(selectedMintAddress);
    } finally {
      setRelinquishingVotes(false);
    }
  };

  const deposited = fmtInt(selectedMintDepositedAmount, decimals);
  const inWallet = fmt(selectedMintAvailableAmount, decimals);

  const afterDeposit = React.useMemo(() => {
    const base = Number(selectedMintDepositedAmount || 0) / Math.pow(10, decimals);
    const add = Number(newDepositAmount || 0) || maxHuman;
    const total = base + add;

    const maxFrac = decimals === 0 ? 0 : 2;
    return total.toLocaleString(undefined, { maximumFractionDigits: maxFrac });
  }, [selectedMintDepositedAmount, decimals, newDepositAmount, maxHuman]);

  const hasAvailable = Number(selectedMintAvailableAmount || 0) > 0;

  const disableSave =
    !delegatedStr ||
    delegatedStr === publicKey.toBase58() ||
    (!isCouncil && currentCommunityDelegate === delegatedStr) ||
    (isCouncil && currentCouncilDelegate === delegatedStr) ||
    !delegateLooksValid;

  const disableDeposit = Number(newDepositAmount) <= 0 || Number(newDepositAmount) > maxHuman;

  // ---------- UI styles (less round, more “premium”) ----------
  const dialogSX = {
    "& .MuiDialog-paper": {
      width: "min(760px, calc(100vw - 28px))",
      maxWidth: "760px",
      background: "linear-gradient(180deg, #13151C 0%, #10121A 100%)",
      border: "1px solid rgba(255,255,255,0.10)",
      borderRadius: 6,
      overflow: "hidden",
    },
  };

  const topbarSX = {
    px: 2,
    py: 1.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  };

  const contentSX = { px: 2, py: 2 };

  const panelSX = {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 6,
    p: 1.5,
  };

  const metricRowSX = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 2,
    py: 0.75,
    borderBottom: "1px dashed rgba(255,255,255,0.08)",
    "&:last-of-type": { borderBottom: "none" },
  };

  const metricLabelSX = { fontSize: 12, opacity: 0.75 };
  const metricValueSX = { fontSize: 14, fontWeight: 700 };

  return (
    <>
      <Tooltip title="Advanced (amount, delegate, withdraw)">
        <IconButton
          aria-label="Advanced"
          color={inlineAdvanced ? "inherit" : "success"}
          onClick={handleClickOpen}
          sx={{ p: inlineAdvanced ? 0.5 : 1 }}
        >
          <SettingsIcon sx={{ fontSize: inlineAdvanced ? 16 : 18 }} />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={handleClose} sx={dialogSX}>
        {/* Top bar */}
        <Box sx={topbarSX}>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>
              Advanced
            </Typography>
            <Typography sx={{ fontSize: 12, opacity: 0.7, mt: 0.25 }}>
              Deposit, withdraw, and manage delegation
            </Typography>
          </Box>

          <IconButton onClick={handleClose} sx={{ opacity: 0.85 }}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={contentSX}>
          <Grid container spacing={1.5}>
            {/* LEFT: Summary */}
            <Grid item xs={12} md={5}>
              <Box sx={panelSX}>
                <Box sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
                    Voting power
                  </Typography>
                </Box>

                {hasAvailable && (
                  <Box sx={metricRowSX}>
                    <Typography sx={metricLabelSX}>After deposit</Typography>
                    <Typography sx={{ ...metricValueSX, fontSize: 16 }}>{afterDeposit}</Typography>
                  </Box>
                )}

                <Box sx={metricRowSX}>
                  <Typography sx={metricLabelSX}>Deposited</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={metricValueSX}>{deposited}</Typography>
                    <Tooltip title="Withdraw max">
                      <IconButton
                        size="small"
                        onClick={isCouncil ? handleWithdrawCouncilMax : handleWithdrawCommunityMax}
                        sx={{
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 10,
                          p: 0.75,
                        }}
                      >
                        <LogoutIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    disabled={relinquishingVotes}
                    onClick={handleRelinquishOnly}
                    sx={{ textTransform: "none", borderRadius: 2 }}
                  >
                    {relinquishingVotes ? 'Relinquishing...' : 'Relinquish DAO Votes'}
                  </Button>
                </Box>

                {hasAvailable && (
                  <Box sx={metricRowSX}>
                    <Typography sx={metricLabelSX}>In wallet</Typography>
                    <Typography sx={metricValueSX}>{inWallet}</Typography>
                  </Box>
                )}

                <Divider sx={{ opacity: 0.12, my: 1.25 }} />

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 12, opacity: 0.7 }}>Governing mint</Typography>
                  <ExplorerView
                    address={selectedMintAddress}
                    title={
                      selectedMintName
                        ? `Mint: ${selectedMintName}`
                        : `Mint: ${selectedMintAddress.slice(0, 3)}...${selectedMintAddress.slice(-3)}`
                    }
                    type="address"
                    shorten={8}
                    hideTitle={false}
                    style="text"
                    color="white"
                    fontSize="12px"
                    showTokenMetadata={true}
                  />
                </Box>
              </Box>
            </Grid>

            {/* RIGHT: Delegation (everything in one cohesive block) */}
            <Grid item xs={12} md={7}>
              <Box sx={panelSX}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 800 }}>Delegation</Typography>
                  {currentDelegate ? (
                    <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                      Active
                    </Typography>
                  ) : (
                    <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                      Not set
                    </Typography>
                  )}
                </Box>

                {/* Current delegate row */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    p: 1,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(0,0,0,0.18)",
                    mb: 1.25,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    {currentDelegate ? (
                      <ExplorerView
                        address={currentDelegate}
                        title={`You delegate to: ${currentDelegate.slice(0, 4)}...${currentDelegate.slice(-4)}`}
                        type="address"
                        shorten={8}
                        hideTitle={false}
                        style="text"
                        color="white"
                        fontSize="12px"
                      />
                    ) : (
                      <Typography sx={{ fontSize: 12, opacity: 0.75 }}>
                        Delegate your voting power to another wallet.
                      </Typography>
                    )}
                  </Box>

                  {currentDelegate && (
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      onClick={handleClickRemoveDelegate}
                      startIcon={<CancelIcon sx={{ fontSize: 14 }} />}
                      sx={{ borderRadius: 10, textTransform: "none", whiteSpace: "nowrap" }}
                    >
                      Remove
                    </Button>
                  )}
                </Box>

                {/* Edit delegate input + actions */}
                <Grid container spacing={1} alignItems="center">
                  <Grid item xs={12}>
                    <OutlinedInput
                      value={delegatedStr || ""}
                      size="small"
                      placeholder="Enter delegate address"
                      onChange={handleSetDelegateStr}
                      sx={{
                        borderRadius: 12,
                        width: "100%",
                        "& input": { fontSize: 13 },
                      }}
                      endAdornment={
                        <InputAdornment position="end">
                          <Tooltip title={disableSave ? "Enter a valid new address" : "Save delegate"}>
                            <span>
                              <IconButton
                                aria-label="Save Delegate"
                                onClick={handleClickSetDelegate}
                                edge="end"
                                color="success"
                                disabled={disableSave}
                                sx={{
                                  borderRadius: 10,
                                  border: "1px solid rgba(255,255,255,0.10)",
                                  ml: 0.5,
                                }}
                              >
                                <SaveIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </InputAdornment>
                      }
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setDelegatedStr(currentDelegate || null)}
                        disabled={!currentDelegate}
                        sx={{ borderRadius: 10, textTransform: "none" }}
                      >
                        Use current
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setDelegatedStr(null)}
                        disabled={!delegatedStr}
                        sx={{ borderRadius: 10, textTransform: "none" }}
                      >
                        Clear
                      </Button>

                      {/* lightweight validity hint */}
                      {delegatedStr && (
                        <Typography sx={{ fontSize: 12, opacity: delegateLooksValid ? 0.75 : 0.9, ml: "auto" }}>
                          {delegateLooksValid ? "Valid address" : "Invalid address"}
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Incoming delegations (make it optional & compact) */}
            {(currentCommunityDelegateFrom && !isCouncil) && (
              <Grid item xs={12}>
                <Accordion
                  sx={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                  }}
                  defaultExpanded={false}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                      Incoming delegations — Community
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <ExplorerView
                      address={currentCommunityDelegateFrom}
                      title={`${fmt(currentCommunityDelegateFromAmount, decimals)} — from: ${currentCommunityDelegateFrom.slice(0, 4)}...${currentCommunityDelegateFrom.slice(-4)}`}
                      type="address"
                      shorten={4}
                      style="text"
                      color="white"
                      fontSize="12px"
                    />
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {(currentCouncilDelegateFrom && isCouncil) && (
              <Grid item xs={12}>
                <Accordion
                  sx={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 6,
                    "&:before": { display: "none" },
                    overflow: "hidden",
                  }}
                  defaultExpanded={false}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                      Incoming delegations — Council
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <ExplorerView
                      address={currentCouncilDelegateFrom}
                      title={`${fmt(currentCouncilDelegateFromAmount, decimals)} — from: ${currentCouncilDelegateFrom.slice(0, 4)}...${currentCouncilDelegateFrom.slice(-4)}`}
                      type="address"
                      shorten={4}
                      style="text"
                      color="white"
                      fontSize="12px"
                    />
                  </AccordionDetails>
                </Accordion>
              </Grid>
            )}

            {/* Amount + Deposit actions (compact single row) */}
            {hasAvailable && (
              <Grid item xs={12}>
                <Box
                  sx={{
                    ...panelSX,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1.5,
                    flexWrap: "wrap",
                  }}
                >
                  <Box sx={{ minWidth: 240, flex: 1 }}>
                    <RegexTextField
                      regex={/[^0-9]+\.?[^0-9]/gi}
                      autoComplete="off"
                      margin="dense"
                      id="preview_deposit_id"
                      label="Amount to deposit"
                      type="text"
                      fullWidth
                      variant="standard"
                      value={newDepositAmount}
                      defaultValue={maxHuman}
                      onChange={(e: any) => setNewDepositAmount(Number(e.target.value || 0))}
                      inputProps={{ style: { textAlign: "left", fontSize: 22, paddingTop: 6 } }}
                      helperText={
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
                            Max: {maxHuman.toLocaleString(undefined, { maximumFractionDigits: decimals === 0 ? 0 : 2 })}
                          </Typography>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => setNewDepositAmount(maxHuman)}
                            sx={{ borderRadius: 10, textTransform: "none" }}
                          >
                            Max
                          </Button>
                        </Box>
                      }
                    />
                  </Box>

                  <Button
                    color="success"
                    variant="outlined"
                    onClick={handleAdvancedDepositVotesToGovernance}
                    disabled={disableDeposit}
                    sx={{
                      borderRadius: 12,
                      textTransform: "none",
                      px: 2,
                      height: 40,
                      alignSelf: "flex-end",
                    }}
                  >
                    <LoginIcon sx={{ mr: 1 }} /> Deposit
                  </Button>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
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
