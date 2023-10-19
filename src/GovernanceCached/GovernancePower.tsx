
import { PublicKey, TokenAmount, Connection, TransactionInstruction, Transaction } from '@solana/web3.js';
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { useWallet } from '@solana/wallet-adapter-react';
import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { 
    TOKEN_PROGRAM_ID, 
    getMint,
    getAssociatedTokenAddress
} from "@solana/spl-token-v2";
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

import {
  Typography,
  Tooltip,
  Button,
  Grid,
  Box,
  ButtonGroup,
  CircularProgress,
} from '@mui/material/';

import { useSnackbar } from 'notistack';

import DownloadIcon from '@mui/icons-material/Download';
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
    withDepositGoverningTokens,
    getGovernanceProgramVersion
} from '@solana/spl-governance';

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

export default function GovernancePower(props: any){
    const governanceAddress = props.governanceAddress;
    const [realm, setRealm] = React.useState(props?.realm || null);
    const [cachedMemberMap, setCachedMemberMap] = React.useState(props?.cachedMemberMap || false);
    const [rpcMemberMap, setRpcMemberMap] = React.useState(null);
    const [isParticipatingInDao, setIsParticipatingInDao] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [depositedCommunityMint, setDepositedCommunityMint] = React.useState(null);
    const [depositedCouncilMint, setDepositedCouncilMint] = React.useState(null);
    const [walletCommunityMintAddress, setWalletCommunityMintAddress] = React.useState(null);
    const [walletCouncilMintAddress, setWalletCouncilMintAddress] = React.useState(null);
    const [walletCommunityMint, setWalletCommunityMint] = React.useState(null);
    const [walletCouncilMint, setWalletCouncilMint] = React.useState(null);
    const { publicKey, wallet, sendTransaction } = useWallet();
    const [mintName, setMintName] = React.useState(null);
    const [mintDecimals, setMintDecimals] = React.useState(null);
    const [mintLogo, setMintLogo] = React.useState(null);
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
        const tokenMetadata = await Metadata.fromAccountAddress(RPC_CONNECTION, pda)

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
        
        console.log("realm: "+JSON.stringify(realm));

        if (realm){

            const communityMint = realm.account.communityMint;
            const councilMint = realm.account.config?.councilMint;

            setWalletCommunityMintAddress(communityMint);
            setWalletCouncilMintAddress(councilMint);

            const tokenOwnerRecord = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, new PublicKey(realm?.owner || SYSTEM_PROGRAM_ID), publicKey));

            //console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecord));

            // find all instances of this governanceAddress:
            let depCommunityMint = null;
            let depCouncilMint = null;
            for (let record of tokenOwnerRecord){
                if (record.account.realm.toBase58() === governanceAddress){
                    
                    if (record.account.governingTokenMint.toBase58() === communityMint){
                        const tki = await getTokenMintInfo(communityMint);
                        //console.log("tokenMintInfo: "+JSON.stringify(tki));
                        depCommunityMint = Number(record.account.governingTokenDepositAmount);
                    }
                    if (record.account.governingTokenMint.toBase58() === councilMint)
                        depCouncilMint = Number(record.account.governingTokenDepositAmount); 
                    
                }
            }

            if (depCommunityMint && Number(depCommunityMint) > 0)
                setDepositedCommunityMint(depCommunityMint);
            if (depCouncilMint && Number(depCouncilMint) > 0)
                setDepositedCouncilMint(depCouncilMint);

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
                        setWalletCommunityMint(titem.account.data.parsed.info.tokenAmount.amount);
                    } else if (titem.account.data.parsed.info.mint === councilMint){
                        setWalletCouncilMint(titem.account.data.parsed.info.tokenAmount.amount);
                    }
                }
            }

            // 1. Get wallet holdings
            // 2. Get Governance settings
            // 3. With Governance Community Mint & Governance Council Mint check if user has those in their wallet
            // 4. Also fetch user governance record and display the voting power accordingly
        }
    }

    React.useEffect(() => {
        if (publicKey && rpcMemberMap){
            const foundObject = findObjectByGoverningTokenOwner(rpcMemberMap, publicKey.toBase58(), true, 0)
            if (foundObject){
                setIsParticipatingInDao(true);
            }
        }
    }, [rpcMemberMap]);

    React.useEffect(() => {
        if (publicKey){
            setLoading(true);
            getWalletAndGovernanceOwner();
            setLoading(false);
        }
    }, [publicKey]);

    // 

    const depositVotesToGovernance = async(tokenAmount: number, mintAddress: string) => {
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

        const atomicAmount = tokenAmount;
        /*
        const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
            tokenAmount,
            decimals
        )*/

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
            atomicAmount
        )
        
        if (instructions.length != 1) {
            console.log("ERROR: Something went wrong");
        } else{

            
            
            if (instructions){

                const transaction = new Transaction();
                transaction.add(...instructions);

                try{
                    enqueueSnackbar(`Preparing to cast vote`,{ variant: 'info' });
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
                    // ???
                }catch(e:any){
                    enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                } 
            } else{
                alert("No voter record!")
            }
        }
    }

    function handleDepositMax(){
        //const selectedTokenMint = event.target.value as string;
        //setTokenMint(selectedTokenMint);
        depositVotesToGovernance(walletCommunityMint, walletCommunityMintAddress);
    }

    return(
        <Grid xs={12}>
        {(!publicKey && loading) ?
            <>loading...</>
        :
                <Box
                    m={1}
                    display="flex"
                    justifyContent="flex-end"
                    alignItems="flex-end"
                >
                    <Grid>
                        {(walletCommunityMint && walletCommunityMint > 0) &&
                            <ButtonGroup color='inherit' sx={{ ml: 1, fontSize:'10px', borderRadius:'17px' }}>
                                <Button 
                                    aria-label="Deposit"
                                    variant="outlined" 
                                    color='inherit'
                                    onClick={handleDepositMax}
                                    sx={{
                                        borderTopLeftRadius:'17px',
                                        borderBottomLeftRadius:'17px',
                                        borderColor:'rgba(255,255,255,0.05)',
                                        fontSize:'10px'}}
                                >
                                    <DownloadIcon fontSize='inherit' sx={{mr:1}}/> Deposit&nbsp;
                                    
                                    {(mintDecimals) ? 
                                    <>
                                        {(+(walletCommunityMint/10**mintDecimals)).toLocaleString()}
                                    </>
                                    :
                                    <>
                                        {walletCommunityMint}
                                    </>
                                    }
                                    {mintName ?
                                        <>&nbsp;{mintName}</>
                                        :<>&nbsp;Community</>

                                    }
                                </Button>
                                <Tooltip title="Advanced Deposit">
                                    <Button 
                                        disabled
                                        aria-label="Deposit"
                                        variant="outlined" 
                                        color='inherit'
                                        sx={{
                                            borderTopRightRadius:'17px',
                                            borderBottomRightRadius:'17px',
                                            borderColor:'rgba(255,255,255,0.05)',
                                            fontSize:'10px'}}
                                    ><SettingsIcon  fontSize='inherit' /></Button>
                                </Tooltip>
                            </ButtonGroup>
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
                        <Grid sx={{textAlign:'right', mt:1}}>
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
                                
                                
                                </>
                            }
                            {(depositedCommunityMint && depositedCouncilMint) && ` & `}
                            {depositedCouncilMint &&
                                <>
                                {(depositedCouncilMint).toLocaleString()} Council
                                </>
                            }
                            </Typography>
                        </Grid>
                    </Grid>
                </Box>
            }
        </Grid>
        
    );
}