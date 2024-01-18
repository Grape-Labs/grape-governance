
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';

import { 
    TOKEN_PROGRAM_ID, 
    getMint,
    getAssociatedTokenAddress
} from "@solana/spl-token-v2";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

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
    getRealm, 
    getTokenOwnerRecord,
    getTokenOwnerRecordsByOwner,
    getTokenOwnerRecordForRealm,
    getTokenOwnerRecordAddress,
    getAllTokenOwnerRecords, 
    SYSTEM_PROGRAM_ID,
    withRelinquishVote,
    withDepositGoverningTokens,
    withWithdrawGoverningTokens,
    getGovernanceProgramVersion,
    withSetGovernanceDelegate,
} from '@solana/spl-governance';

import { 
    getRealmIndexed,
    getProposalIndexed,
    getProposalNewIndexed,
    getAllProposalsIndexed,
    getGovernanceIndexed,
    getAllGovernancesIndexed,
    getAllTokenOwnerRecordsIndexed,
    getTokenOwnerRecordsByRealmIndexed,
} from './api/queries';

import { parseMintNaturalAmountFromDecimalAsBN } from '../utils/grapeTools/helpers';

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

import { 
    findObjectByGoverningTokenOwner
  } from '../utils/grapeTools/helpers';
//import { LogoutIcon } from '@dynamic-labs/sdk-react-core';

export interface DialogTitleProps {
    id: string;
    children?: React.ReactNode;
    onClose: () => void;
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
    const [currentDelegate, setCurrentDelegate] = React.useState(null);
    const { enqueueSnackbar, closeSnackbar } = useSnackbar();


    const getTokenMintInfo = async(mintAddress:string) => {
        
        const mintInfo = await getMint(RPC_CONNECTION, new PublicKey(mintAddress));

        //const tokenName = mintInfo.name;
        
        //JSON.stringify(mintInfo);

        const decimals = mintInfo.decimals;
        setMintDecimals(decimals);
        
        const mint_address = new PublicKey(mintAddress)
        const [pda, bump] = await PublicKey.findProgramAddress([
            Buffer.from("metadata"),
            PROGRAM_ID.toBuffer(),
            new PublicKey(mint_address).toBuffer(),
        ], PROGRAM_ID)
        let tokenMetadata = null;
        try{
            tokenMetadata = await Metadata.fromAccountAddress(RPC_CONNECTION, pda)
        }catch(e){console.log("ERR: "+e)}

        if (tokenMetadata?.data?.name)
            setMintName(tokenMetadata.data.name);
        
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
                        setMintLogo(metadata.image);
                }
            }catch(err){
                console.log("ERR: ",err);
            }
        }

        return tokenMetadata?.data;
        
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

            //const tokenOwnerRecord = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, new PublicKey(realm?.owner || SYSTEM_PROGRAM_ID), publicKey);
            //console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecordV1));
            const tokenOwnerRecord = await getTokenOwnerRecordsByRealmIndexed(governanceAddress, null, publicKey.toBase58());

            //console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecord));
            // find all instances of this governanceAddress:
            let depCommunityMint = null;
            let depCouncilMint = null;
            let depCommunityDelegate = null;
            let depCouncilDelegate = null;
            let fetchedTMI = false;
            for (let record of tokenOwnerRecord){
                if (record.account.realm.toBase58() === governanceAddress){
                
                    if (record.account.governingTokenMint.toBase58() === communityMint){
                        const tki = await getTokenMintInfo(communityMint);
                        fetchedTMI = true;
                        //console.log("tokenMintInfo: "+JSON.stringify(tki));
                        depCommunityMint = Number(record.account.governingTokenDepositAmount);
                        depCommunityDelegate = record.account?.governanceDelegate;
                    }
                    if (record.account.governingTokenMint.toBase58() === councilMint)
                        depCouncilMint = Number(record.account.governingTokenDepositAmount); 
                        depCouncilDelegate = record.account?.governanceDelegate;
                    
                }
            }
            
            if (depCommunityMint && Number(depCommunityMint) > 0){
                setDepositedCommunityMint(depCommunityMint);
                if (depCommunityDelegate)
                    setCurrentDelegate(depCommunityDelegate.toBase58());
            } 
            // do not change this to an else (we show both council/community)
            if (depCouncilMint && Number(depCouncilMint) > 0){
                setDepositedCouncilMint(depCouncilMint);
                if (depCouncilDelegate)
                    setCurrentDelegate(depCouncilDelegate.toBase58());
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
        console.log("programId: "+JSON.stringify(programId));
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
          )
        
        console.log("programVersion: "+JSON.stringify(programVersion));

        const realmPk = new PublicKey(realm.pubkey);
        
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


        const instructions: TransactionInstruction[] = []
       

        // also relinquish recursively if needed:
        // withRelinquishVote
        
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
        
        if (instructions.length != 1) {
            console.log("ERROR: Something went wrong");
            enqueueSnackbar(`Instructions Error`, { variant: 'error' });
        } else{
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
                                Signature: {signature}
                            </Button>
                    );
                    
                    enqueueSnackbar(`Congratulations, you now have adjusted your delegated governance power`,{ variant: 'success', action });

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

    const withdrawVotesToGovernance = async(tokenAmount: number, tokenDecimals: number, mintAddress: string) => {
        const withMint = new PublicKey(mintAddress);
        const programId = new PublicKey(realm.owner);
        console.log("programId: "+JSON.stringify(programId));
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
          )
        
        console.log("programVersion: "+JSON.stringify(programVersion));

        const realmPk = new PublicKey(realm.pubkey);
        
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
                                Signature: {signature}
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
        const programVersion = await getGovernanceProgramVersion(
            RPC_CONNECTION,
            programId,
          )
        
        console.log("programVersion: "+JSON.stringify(programVersion));

        const realmPk = new PublicKey(realm.pubkey);
        
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
            publicKey,//new PublicKey("33JTjvdTrmmtQuvTzr9rdCkYU1eAGkErQLdoPkcRvyaC"),//publicKey,
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
                                Signature: {signature}
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
        // generateMEEditListingInstructions(selectedTokenMint:string, selectedTokenAtaString: string, price: number, newPrice: number)
        const [delegatedStr, setDelegatedStr] = React.useState(null);

        const [open, setOpen] = React.useState(false);
        const [newDepositAmount, setNewDepositAmount] = React.useState(selectedMintAvailableAmount/10**decimals);

        const handleClickOpen = () => {
            setOpen(true);
        };

        const handleClose = () => {
            setOpen(false);
        };

        const handleSetDelegateStr = (event) => {
            setDelegatedStr(event.target.value); // Update delegateStr with the input value
        };

        
        function handleClickRemoveDelegate(){
            setGovernanceDelegate(walletCommunityMintAddress, null);
        }

        function handleClickSetDelegate(){
            if (delegatedStr){
                if (delegatedStr !== currentDelegate){
                    // also check if pubkey is valid...
                    setGovernanceDelegate(walletCommunityMintAddress, delegatedStr);
                }
            }
        }

        function handleAdvancedDepositVotesToGovernance(){
            if (newDepositAmount && newDepositAmount > 0){
                depositVotesToGovernance(newDepositAmount, decimals, walletCommunityMintAddress);
                setOpen(false);
            } else {
                handleDepositCommunityMax();
                setOpen(false);
            }
        }
        function handleAdvancedDepositMaxVotesToGovernance(){
            handleDepositCommunityMax();
            setOpen(false);
        }

        return (
            <>
            
                <Tooltip title="Delegation &amp; Advanced Tools">
                    <IconButton
                        aria-label="Advanced"
                        color={inlineAdvanced ? 'inherit' : 'success'}
                        onClick={handleClickOpen}
                        sx={{
                            borderColor:'rgba(255,255,255,0.05)',
                            fontSize:'10px',
                            minWidth: inlineAdvanced ? '0' : undefined,
                            //p: inlineAdvanced ? undefined : 1,
                        }}
                    ><SettingsIcon  sx={{fontSize: inlineAdvanced ? '10px' : '14px',}} /></IconButton>
                </Tooltip>

                <Dialog open={open} onClose={handleClose}
                    PaperProps={{
                        style: {
                            background: '#13151C',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '20px'
                        }
                    }}
                >
                    <BootstrapDialogTitle id="create-storage-pool" onClose={handleClose}>
                        Advanced
                    </BootstrapDialogTitle>
                    
                    <DialogContent>
                    <DialogContentText>
                        <Grid container>
                            <Box sx={{
                                    m:2,
                                    background: 'rgba(0, 0, 0, 0.1)',
                                    borderRadius: '17px',
                                    p:1,
                                    width:"100%",
                                    minWidth:'360px'
                                }}>
                                {selectedMintAvailableAmount > 0 &&
                                    <>
                                    <Box sx={{ my: 3, mx: 2 }}>
                                        <Grid container alignItems="center">
                                        <Grid item xs>
                                            <Typography gutterBottom variant="h5" component="div">
                                            New Voting Power
                                            </Typography>
                                        </Grid>
                                        <Grid item>
                                            {newDepositAmount ?
                                            <Typography gutterBottom variant="h6" component="div">
                                                {(Number(((selectedMintDepositedAmount/10**decimals)+(+newDepositAmount)).toFixed(0))).toLocaleString()}
                                            </Typography>
                                            :
                                            <Typography gutterBottom variant="h6" component="div">
                                                {(Number((((+selectedMintDepositedAmount + +selectedMintAvailableAmount)/10**decimals)).toFixed(0))).toLocaleString()}
                                            </Typography>
                                            }
                                        </Grid>
                                        </Grid>
                                        <Typography color="text.secondary" variant="body2">
                                            Total voting power after depositing
                                        </Typography>
                                    </Box>

                                    <Divider variant="middle" />
                                    </>
                                }
                                <Box sx={{ my: 3, mx: 2 }}>
                                    <Grid container alignItems="center">
                                    <Grid item xs>
                                        <Typography gutterBottom variant="subtitle1" component="div">
                                            Voting Power
                                        </Typography>
                                    </Grid>
                                    <Grid item>
                                        <Typography gutterBottom variant="body1" component="div">
                                            {(Number((selectedMintDepositedAmount/10**decimals).toFixed(0))).toLocaleString()}
                                        </Typography>
                                    </Grid>
                                    </Grid>
                                    <Typography color="text.secondary" variant="caption">
                                        This is your current voting power 
                                            <Tooltip title="Withdraw">
                                                <IconButton 
                                                        aria-label="Deposit"
                                                        color='inherit'
                                                        onClick={isCouncil ? handleWithdrawCouncilMax : handleWithdrawCommunityMax}
                                                        sx={{
                                                            borderRadius:'17px',
                                                            borderColor:'rgba(255,255,255,0.05)',
                                                            ml:1,
                                                        }}
                                                    >
                                                    <LogoutIcon sx={{fontSize:'12px'}} />
                                                </IconButton>
                                            </Tooltip>
                                    </Typography>
                                </Box>
                                
                                {selectedMintAvailableAmount > 0 &&
                                    <Box sx={{ my: 3, mx: 2 }}>
                                        <Grid container alignItems="center">
                                        <Grid item xs>
                                            <Typography gutterBottom variant="subtitle1" component="div">
                                            Available to Deposit
                                            </Typography>
                                        </Grid>
                                        <Grid item>
                                            <Typography gutterBottom variant="body1" component="div">
                                            {(selectedMintAvailableAmount/10**decimals).toLocaleString()}
                                            </Typography>
                                        </Grid>
                                        </Grid>
                                        <Typography color="text.secondary" variant="caption">
                                        This is the voting power you have in your wallet
                                        </Typography>
                                    </Box>
                                }
                                <Box sx={{ my: 3, mx: 2 }}>
                                    <Grid container alignItems="center">
                                    <Grid item xs>
                                        
                                    </Grid>
                                    <Grid item>
                                        <Typography gutterBottom variant="body1" component="div">
                                            <ExplorerView 
                                                address={selectedMintAddress} 
                                                title={`Governing Mint ${selectedMintName ? selectedMintName : `${selectedMintAddress.slice(0, 3)}...${selectedMintAddress.slice(-3)}`}`} 
                                                type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='14px' 
                                                showTokenMetadata={true} /> 
                                        </Typography>
                                    </Grid>
                                    </Grid>
                                </Box>

                            </Box>

                            <Box sx={{
                                    m:2,
                                    background: 'rgba(0, 0, 0, 0.1)',
                                    borderRadius: '17px',
                                    p:1,
                                    width:"100%",
                                    minWidth:'360px'
                                }}>
                                <Box sx={{ my: 3, mx: 2 }}>
                                    <Grid container alignItems="center">
                                        <Grid item xs>
                                            <Typography gutterBottom variant="h5" component="div">
                                            Delegation
                                            </Typography>
                                        </Grid>
                                        <Grid item
                                            sx={{ alignItems: 'right' }}
                                        >
                                            <OutlinedInput
                                                size={'small'}
                                                sx={{borderRadius:'17px'}}
                                                //value={currentDelegate}
                                                onChange={handleSetDelegateStr}
                                                endAdornment={
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            aria-label="Save Delegate"
                                                            onClick={handleClickSetDelegate}
                                                            edge="end"
                                                            color={'success'}
                                                            disabled={
                                                                (!delegatedStr) ||
                                                                (delegatedStr === publicKey.toBase58()) ||
                                                                (currentDelegate === delegatedStr)
                                                            }
                                                        >
                                                            <SaveIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                }
                                            />
                                        </Grid>
                                    </Grid>
                                    <Typography color="text.secondary" variant="caption">
                                        
                                        {currentDelegate ?
                                            <>
                                                <Grid container direction='row'>
                                                    <ExplorerView 
                                                        address={currentDelegate} 
                                                        title={`Delegated to ${currentDelegate.slice(0, 4)}...${currentDelegate.slice(-4)}`} 
                                                        type='address' shorten={8} hideTitle={false} style='text' color='white' fontSize='10px' /> 
                                                    
                                                    <IconButton
                                                        aria-label="Remove Delegate"
                                                        onClick={handleClickRemoveDelegate}
                                                        edge="end"
                                                        color={'error'}
                                                        sx={{fontSize:'10px'}}
                                                    >
                                                        <CancelIcon />
                                                    </IconButton>
                                                </Grid>
                                            </>
                                            :<>Delegate your voting power to another wallet</>
                                        }
                                    </Typography>
                                </Box>
                            </Box>

                        </Grid>
                    </DialogContentText>
                    
                    {selectedMintAvailableAmount > 0 &&
                        <RegexTextField
                            regex={/[^0-9]+\.?[^0-9]/gi}
                            autoFocus
                            autoComplete='off'
                            margin="dense"
                            id="preview_deposit_id"
                            label='Set the amount to deposit'
                            type="text"
                            fullWidth
                            variant="standard"
                            value={newDepositAmount}
                            defaultValue={(selectedMintAvailableAmount/10**decimals)}
                            helperText={
                                <Grid sx={{textAlign:'right',}}>
                                    <Typography variant="caption" color="info">
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={(e) => setNewDepositAmount(selectedMintAvailableAmount/10**decimals)}
                                            sx={{borderRadius:'17px'}}
                                        >
                                            Max
                                        </Button>
                                    </Typography>
                                </Grid>
                            }
                            onChange={(e: any) => {
                                setNewDepositAmount(e.target.value)}
                            }
                            inputProps={{
                                style: { 
                                    textAlign:'center', 
                                    fontSize: '34px'
                                }
                            
                            }}
                        
                        />
                    }
                        
                    {/*
                    <TextField
                        autoFocus
                        margin="dense"
                        id="newlistprice"
                        label="New List Price"
                        type="text"
                        fullWidth
                        variant="standard"
                        onChange={(e) => setNewListPrice(e.target.value)}
                        />*/}
                    </DialogContent>
                    {selectedMintAvailableAmount > 0 &&
                        <DialogActions>
                            
                            
                            <Button color="success" onClick={handleAdvancedDepositVotesToGovernance}
                                sx={{borderRadius:'17px'}}
                                disabled={
                                    (newDepositAmount <= (selectedMintAvailableAmount/10**decimals)) ? false : true
                                }
                            ><LoginIcon fontSize='inherit' sx={{mr:1}}/> Deposit</Button>
                            {/*
                            <ButtonGroup>
                                <Button color="success" onClick={handleAdvancedDepositVotesToGovernance}
                                    sx={{borderTopLeftRadius:'17px',borderBottomLeftRadius:'17px'}}
                                    disabled={
                                        newDepositAmount ? false : true
                                    }
                                ><DownloadIcon fontSize='inherit' sx={{mr:1}}/> Deposit</Button>
                                <Button color="success" onClick={handleAdvancedDepositMaxVotesToGovernance}
                                    sx={{borderTopRightRadius:'17px',borderBottomRightRadius:'17px'}}
                                ><DownloadIcon fontSize='inherit' sx={{mr:1}}/> Deposit Max</Button>
                            </ButtonGroup>
                            */}
                        </DialogActions>
                    }
                </Dialog>
            </>

        )
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
                                <AdvancedCommunityVoteDepositPrompt mintVotingPower={depositedCommunityMint} mintAvailableAmount={walletCommunityMintAmount} mintAddress={walletCommunityMintAddress} mintName={mintName} decimals={mintDecimals} />
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
                                    
                                        <AdvancedCommunityVoteDepositPrompt inlineAdvanced={true} mintVotingPower={depositedCommunityMint} mintAvailableAmount={walletCommunityMintAmount} mintAddress={walletCommunityMintAddress} mintName={mintName} decimals={mintDecimals} />
                                    
                                    </>
                                }
                            {(depositedCommunityMint && depositedCouncilMint) && ` & `}
                            {depositedCouncilMint &&
                                <>
                                {(depositedCouncilMint).toLocaleString()} Council
                                <AdvancedCommunityVoteDepositPrompt isCouncil={true} inlineAdvanced={true} mintVotingPower={depositedCouncilMint} mintAvailableAmount={walletCouncilMintAmount} mintAddress={walletCouncilMintAddress} decimals={0} />
                                
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