import React, { useCallback } from 'react';
import { Signer, Connection, PublicKey, SystemProgram, Transaction, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID, 
    ASSOCIATED_TOKEN_PROGRAM_ID, 
    getAssociatedTokenAddress, 
    createCloseAccountInstruction,
    createBurnInstruction,
    getMint,
} from "@solana/spl-token-v2";
import { ENV, TokenListProvider, TokenInfo } from '@solana/spl-token-registry';
import { Buffer } from "buffer";
import BN from "bn.js";
import * as anchor from '@project-serum/anchor';
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from '@solana/wallet-adapter-react';

import { RPC_CONNECTION } from '../../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../../utils/grapeTools/RegexTextField';

import { styled } from '@mui/material/styles';

import { 
    getAllTokenOwnerRecords,
    withDepositGoverningTokens,
    withCreateTokenOwnerRecord,
    getRealm,
    serializeInstructionToBase64,
  } from '@solana/spl-governance';
import { getGrapeGovernanceProgramVersion } from '../../../../utils/grapeTools/helpers';

import {
  Dialog,
  Button,
  ButtonGroup,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  TextareaAutosize,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  MenuItem,
  InputLabel,
  Select,
  IconButton,
  Avatar,
  Grid,
  Paper,
  Typography,
  Box,
  Alert,
  Checkbox,
  SelectChangeEvent
} from '@mui/material';

import { parseMintNaturalAmountFromDecimalAsBN } from '../../../../utils/grapeTools/helpers';

import { GrapeVerificationSpeedDial } from './../GrapeVerificationSpeedDial';
import { GrapeVerificationDAO } from './../GrapeVerificationDAO';
import { LookupTableIntegratedDialogView } from './../LookupTableIntegratedDialogView';

import ExplorerView from '../../../../utils/grapeTools/Explorer';

import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import PersonIcon from '@mui/icons-material/Person';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import JoinLeftIcon from '@mui/icons-material/JoinLeft';
import SendIcon from '@mui/icons-material/Send';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';
import { number } from 'prop-types';
import { createProposalInstructionsV0, InstructionDataWithHoldUpTime } from '../../../Proposals/createProposalInstructionsV0';
import { UiInstruction } from '../../../../utils/governanceTools/proposalCreationTypes';

const confettiConfig = {
    angle: 90,
    spread: 360,
    startVelocity: 40,
    elementCount: 200,
    dragFriction: 0.12,
    duration: 4000,
    stagger: 3,
    width: "10px",
    height: "10px",
    perspective: "285px",
    colors: ["#f00", "#0f0", "#00f"]
};

const CustomTextarea = styled(TextareaAutosize)(({ theme }) => ({
    width: '100%', // Make it full width
    backgroundColor: '#333', // Change the background color to dark
    color: '#fff', // Change the text color to white or another suitable color
    border: 'none', // Remove the border (optional)
    padding: theme.spacing(1), // Add padding (optional)
}));

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
);

export default function IntraDAOGrantV0View(props: any) {
    const governanceAddress = props?.governanceAddress;
    const [governanceRulesWallet, setGovernanceRulesWallet] = React.useState(props?.governanceRulesWallet);
    const payerWallet = props?.payerWallet || null;
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceLookup = props?.governanceLookup;
    const [governance, setGovernance] = React.useState(null);
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [tokenMap, setTokenMap] = React.useState(null);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [tokenMaxAmountRaw, setTokenMaxAmountRaw] = React.useState(null);
    const [tokenAta, setTokenAta] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const [selectedRecord, setSelectedRecord] = React.useState(null);
    const [daoToJoinAddress, setDaoToJoinAddress] = React.useState(null);
    const [daoToJoinAddressStr, setDaoToJoinAddressStr] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [loadingInstructions, setLoadingInstructions] = React.useState(false);
    const [verifiedDestinationWalletArray, setVerifiedDestinationWalletArray] = React.useState(null);
    const [verifiedDAODestinationWalletArray, setVerifiedDAODestinationWalletArray] = React.useState(null);
    const [destinationWalletArray, setDestinationWalletArray] = React.useState(null);
    const [destinationString, setDestinationString] = React.useState(null);
    const [distributionType, setDistributionType] = React.useState(false);
    const [governanceWalletMinInstructHoldUpTime, setGovernanceWalletMinInstructHoldUpTime] = React.useState(props?.governanceWalletMinInstructHoldUpTime);
    const setInstructionsDataWithHoldUpTime = props?.setInstructionsDataWithHoldUpTime;
    let maxDestinationWalletLen = 50;
    
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    async function transferDAOPower() {
        //const payerWallet = new PublicKey(payerAddress);
        //const fromWallet = new PublicKey(fromAddress);
        const instructionsWithHoldupTime: InstructionDataWithHoldUpTime[] = []
        const prerequisiteInstructions: TransactionInstruction[] = []
        const serializedTransferToReceiptIxs: string[] = []
        setLoadingInstructions(true);
        let fromWallet = null;
        console.log("consolidatedGovernanceWallet: "+JSON.stringify(consolidatedGovernanceWallet))
        {consolidatedGovernanceWallet && consolidatedGovernanceWallet
            //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
            .map((governanceItem: any, key: number) => {
                governanceItem.tokens
                    .map((item: any, key: number) => {
                        if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                            item.account.data.parsed.info.tokenAmount.amount > 0) {
                                //if (item.account.data.parsed.info.mint === selectedTokenMint){
                                if (item.pubkey == tokenAta){
                                    console.log("Found Token: "+JSON.stringify(item)) // item.account.data.parsed.info.owner?
                                    console.log("Found Owner: "+JSON.stringify(item.account.data.parsed.info.owner)) // item.account.data.parsed.info.owner?
                                    fromWallet = new PublicKey(item.account.data.parsed.info.owner);
                                    //setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                    //setTokenMint(item.account.data.parsed.info.mint);
                                }
                        }
                    })
                })}
        

        

        const mintPubkey = new PublicKey(tokenMint);
        const amountToSend = +tokenAmount;
        const tokenAccount = new PublicKey(mintPubkey);
        
        const transaction = new Transaction();
        const pTransaction = new Transaction();

        //console.log("mint: "+ tokenMint);
        const accountInfo = await connection.getParsedAccountInfo(tokenAccount);
        const accountParsed = JSON.parse(JSON.stringify(accountInfo.value.data));
        const decimals = accountParsed.parsed.info.decimals;
        
        //tokenMintAddress
        /*
        console.log("TOKEN_PROGRAM_ID: "+TOKEN_PROGRAM_ID.toBase58())
        console.log("ASSOCIATED_TOKEN_PROGRAM_ID: "+ASSOCIATED_TOKEN_PROGRAM_ID.toBase58())
        console.log("mintPubkey: "+mintPubkey.toBase58())
        console.log("fromWallet: "+fromWallet.toBase58())
        console.log("toWallet: "+toWallet.toBase58())
        */
        try{

            const programId = governance.owner;
            //console.log("programId: "+JSON.stringify(programId));
            const realmPk = new PublicKey(governance.pubkey);
            const programVersion = await getGrapeGovernanceProgramVersion(
                connection,
                programId,
                realmPk
            )
            const tokenInfo = await getMint(RPC_CONNECTION, mintPubkey);
            
            const userAtaPk = await getAssociatedTokenAddress(
                mintPubkey,
                fromWallet, // owner
                true
            )

            // Extract the mint authority
            //const mintAuthority = tokenInfo.mintAuthority ? new PublicKey(tokenInfo.mintAuthority) : null;
            const decimals = tokenInfo.decimals;

            //console.log("mintAuthority: "+mintAuthority.toBase58());
            
            const transaction = new Transaction();
            for (let index = 0; index < destinationWalletArray.length; index++) {
                
                const destinationObject = destinationWalletArray[index];

                // getOrCreateAssociatedTokenAccount
                /*
                const fromTokenAccount = await getAssociatedTokenAddress(
                    mintPubkey,
                    new PublicKey(fromWallet),
                    true
                )*/

                const fromPublicKey = new PublicKey(fromWallet);
                const destPublicKey = new PublicKey(destinationObject.address);
                /*
                const destTokenAccount = await getAssociatedTokenAddress(
                    mintPubkey,
                    destPublicKey,
                    true
                )*/

                const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
                    destinationObject.amount,
                    decimals
                )
                /*
                console.log("**********");
                console.log("**********");
                console.log("programId: "+JSON.stringify(programId));
                console.log("programVersion: "+JSON.stringify(programVersion));
                console.log("realm: "+realmPk.toBase58())
                console.log("governingTokenSource / userAtaPk: "+userAtaPk.toBase58())
                console.log("governingTokenMint: "+mintPubkey.toBase58())
                console.log("governingTokenOwner: "+destPublicKey.toBase58())
                console.log("governingTokenSourceAuthority: "+fromWallet.toBase58())
                console.log("payer: "+fromWallet.toBase58())
                console.log("amount: "+atomicAmount);
                */
                await new Promise(resolve => {
                    setTimeout(resolve, 500); // 1000 milliseconds = 1 second
                });
                
                const ix: TransactionInstruction[] = []
                
                const rpc_members = await getAllTokenOwnerRecords(RPC_CONNECTION, programId,new PublicKey(realmPk.toBase58()));
                const members = JSON.parse(JSON.stringify(rpc_members));

                //if (cached_members){
                const daoMembers = new Array();
                if (members){
                    //console.log("cached_members: "+JSON.stringify(cached_members))

                    const simpleArray = members
                        .map((item: any, key: number) => {
                        return item.account.governingTokenOwner;
                        });
                    

                    daoMembers.push({
                        pubkey: governanceAddress, //item.account.governingTokenOwner,
                        size: simpleArray.length,
                        info: simpleArray
                    });
                
                }


                if (daoMembers){
                    if (!findDAOPubkey(destPublicKey.toBase58(), daoMembers)){
                        console.log("Could not find Voter Record")
                        await withCreateTokenOwnerRecord(
                            ix,
                            programId,
                            programVersion,
                            realmPk,
                            destPublicKey,
                            mintPubkey,
                            fromWallet,
                        )
                        transaction.add(...ix);
                        ix.forEach(instruction => {
                            const serializedInstruction = serializeInstructionToBase64(instruction);
                            console.log('serializedInstruction:', serializedInstruction);
                            serializedTransferToReceiptIxs.push(serializedInstruction);
                        });
                    }
                }

                const instructions: TransactionInstruction[] = []
                await withDepositGoverningTokens(
                    instructions,
                    programId,
                    programVersion,
                    realmPk,
                    userAtaPk,
                    mintPubkey,
                    destPublicKey, //fromWallet,
                    fromWallet, //destPublicKey,
                    fromWallet,
                    atomicAmount,
                    false
                );

                if (instructions.length != 1) {
                    console.log("ERROR: Something went wrong");
                } else{
                    if (instructions){
                        
                        for (var instruction of instructions){
                            for (var key of instruction.keys){ // force remove realmConfig which is set to writable by default
                                if (key.pubkey.toBase58() === "CH3w5UZF4TLvsvB6ARHg12SKCpkZfsDoR1Mh6HPfp5Qj"){
                                    key.isWritable = false;
                                }
                            }
                        }

                        console.log("Adding IX: "+JSON.stringify(instructions));
                        transaction.add(...instructions);
                        instructions.forEach(instruction => {
                            const serializedInstruction = serializeInstructionToBase64(instruction);
                            console.log('serializedInstruction:', serializedInstruction);
                            serializedTransferToReceiptIxs.push(serializedInstruction);
                        });
                    }
                }
            }

            //console.log('serializedTransferToReceiptIxs[0]:', serializedTransferToReceiptIxs[0]);
            //console.log('serializedTransferToReceiptIxs.slice(1):', serializedTransferToReceiptIxs.slice(1));
            const uiInstruction: UiInstruction = {
                governance: governanceRulesWallet,//treasuryAssetAccount.governance,
                serializedInstruction: serializedTransferToReceiptIxs[0],
                additionalSerializedInstructions:
                    serializedTransferToReceiptIxs.slice(1) || [],
                prerequisiteInstructions,
                isValid: true,
                customHoldUpTime:
                    governanceWalletMinInstructHoldUpTime,
            }
            //console.log('instructionsData: '+JSON.stringify(uiInstruction));
            
            const uiInstructions: UiInstruction[] = serializedTransferToReceiptIxs.map(
                (serializedInstruction) => ({
                  serializedInstruction,
                  additionalSerializedInstructions: [], // You can set it to an empty array or any other default value
                  isValid: true, // You can set it to a default value or based on your logic
                  governance: governanceRulesWallet, // Set it to your default value or logic
                  customHoldUpTime: governanceWalletMinInstructHoldUpTime, // Set it to your default value or logic
                  prerequisiteInstructions: prerequisiteInstructions, // Set it to your default value or logic
                })
            );
            
            const instructionDataArray: InstructionDataWithHoldUpTime[] = uiInstructions.map(
                (uiInstruction) =>
                  new InstructionDataWithHoldUpTime({
                    instruction: uiInstruction,
                    //governance: governanceRulesWallet,
                  })
            );
            setInstructionsDataWithHoldUpTime(instructionDataArray);
            //console.log('setInstructionsDataWithHoldUpTime sent:'+JSON.stringify(instructionDataArray));         

            setTransactionInstructions(transaction);
            setLoadingInstructions(false);
            return transaction;
        } catch(err){
            setLoadingInstructions(false);
            console.log("GEN ERR: "+JSON.stringify(err));
        }
            
        setLoadingInstructions(false);
        return null;
    }

    function prepareAndReturnInstructions(){

        //await transferTokens;
        let description = "";
        description = `Granting DAO Voting Power with ${tokenMint}`;
        if (destinationWalletArray.length === 1){
            description += ` using ${tokenAmount.toLocaleString()} Governance Power to ${destinationWalletArray[0].address}`;
        } else{
            description += ` using ${tokenAmount.toLocaleString()} Governance Power to ${destinationWalletArray.length} recipients: `;
            description += destinationWalletArray
                .map((destination: any) => `${destination.address.trim()} - ${destination.amount.toLocaleString()} tokens`)
                .join(', ');
        }

        setInstructionsObject({
            "type":`Grant DAO Voting Power`,
            "description":description,
            "governanceInstructions":transactionInstructions,
            "authorInstructions":payerInstructions,
            "transactionEstimatedFee":transactionEstimatedFee,
        });
    }

    function isValidSolanaPublicKey(publicKeyString:string) {
        // Regular expression for Solana public key validation
        //const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        //return solanaPublicKeyRegex.test(publicKey);
        if (typeof publicKeyString !== 'string' || publicKeyString.length === 0) {
            return false;
          }
        
          // Regular expression for Solana public key validation
          const solanaPublicKeyRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        
          // Check if the publicKey matches the Solana public key pattern
          return solanaPublicKeyRegex.test(publicKeyString);
    }

    function handleSetThisDao(){
        //alert(governanceAddress);
        handleSetDaoToJoinAddressChange(governanceAddress);
    }

    function handleSetDaoToJoinAddressChange(text:string){
        // add validation here
        console.log("checking: "+text);
        setDaoToJoinAddressStr(text);
        if (isValidSolanaPublicKey(text)){
            console.log("setDaoToJoinAddress complete!");
            setDaoToJoinAddress(text);
        } else{
            setDaoToJoinAddress(null);
        }
    }

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
    }

    async function fetchWalletHoldings(wallet:string){

        const tmap = await getTokens(setTokenMap);

        let solBalance = 0;
        solBalance = await connection.getBalance(new PublicKey(wallet));
        if (wallet === governanceWallet.vault.pubkey){
            governanceWallet.solBalance = solBalance;
        }

        const tokenBalance = await connection.getParsedTokenAccountsByOwner(
            new PublicKey(wallet),
            {
            programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
            }
        )
        // loop through governanceWallet
        const itemsToAdd = [];

        if (tokenBalance && tokenBalance?.value){
            for (let titem of tokenBalance.value){
                itemsToAdd.push(titem);
                    
                    /*
                    let foundCached = false;
                    for (let gitem of governanceWallet.tokens.value){
                        if (titem.pubkey.toBase58() === gitem.pubkey){
                            foundCached = true;
                            gitem.account.data.parsed.info.tokenAmount.amount = titem.account.data.parsed.info.tokenAmount.amount;
                            gitem.account.data.parsed.info.tokenAmount.uiAmount = titem.account.data.parsed.info.tokenAmount.uiAmount;
                            itemsToAdd.push(gitem);
                        }
                    }
                    if (!foundCached) {
                        itemsToAdd.push(titem);
                    }*/
                
            }
        }

        // return a more easy to read object?
        const walletObject = {
            pubkey: wallet,
            solBalance: solBalance,
            tokens: itemsToAdd,
        }

        return walletObject;
    }


    async function getAndUpdateWalletHoldings(){
        try{
            setLoadingWallet(true);
            const gwToAdd = await fetchWalletHoldings(governanceWallet.vault.pubkey);
            console.log("fetching rules now");
            const rwToAdd = await fetchWalletHoldings(governanceRulesWallet);

            const walletObjects = [gwToAdd, rwToAdd];

            setConsolidatedGovernanceWallet(walletObjects);

            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }

    async function fetchGovernanceSpecifications(address:string){
        console.log("fetching specs");
        const rlm = await getRealm(RPC_CONNECTION, new PublicKey(address || daoToJoinAddress));
        if (rlm){
            console.log("realm: "+JSON.stringify(rlm));
            setGovernance(rlm);
        }
    }

    function TokenSelect(props:any) {
        const filter = props.filter;

        const handleMintSelected = (event: SelectChangeEvent) => {
            //const selectedTokenMint = event.target.value as string;
            // use the ATA not the mint:
            const selectedTokenAta = event.target.value as string;
            //console.log("ATA: "+selectedTokenAta);
            //setTokenMint(selectedTokenMint);
            setTokenAta(selectedTokenAta);
            // with token mint traverse to get the mint info if > 0 amount
            {consolidatedGovernanceWallet && consolidatedGovernanceWallet
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((governanceItem: any, key: number) => {
                    governanceItem.tokens
                        .map((item: any, key: number) => {
                            
                            if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                item.account.data.parsed.info.tokenAmount.amount > 0) {
                                    //console.log("item: "+item.pubkey)
                                    //if (item.account.data.parsed.info.mint === selectedTokenMint){
                                    if (item.pubkey == selectedTokenAta){
                                        console.log("Found Token: "+item.account.data.parsed.info.mint)
                                        setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                        setTokenMint(item.account.data.parsed.info.mint);
                                    }
                            }
                        })
                    })}
        };

        function ShowTokenMintInfo(props: any){
            const mintAddress = props.mintAddress;
            const [mintName, setMintName] = React.useState(null);
            const [mintLogo, setMintLogo] = React.useState(null);

            const getTokenMintInfo = async() => {
                
                    const mint_address = new PublicKey(mintAddress)
                    const [pda, bump] = await PublicKey.findProgramAddress([
                        Buffer.from("metadata"),
                        PROGRAM_ID.toBuffer(),
                        new PublicKey(mint_address).toBuffer(),
                    ], PROGRAM_ID)
                    let tokenMetadata = null;
                    try{
                        tokenMetadata = await Metadata.fromAccountAddress(connection, pda)
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
            }

            React.useEffect(() => { 
                if (mintAddress && !mintName){
                    getTokenMintInfo();
                }
            }, [mintAddress]);

            return ( 
                <>

                    {mintName ?
                        <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                            <Grid item>
                                <Avatar alt={mintName} src={mintLogo} />
                            </Grid>
                            <Grid item sx={{ml:1}}>
                                <Typography variant="h6">
                                {mintName}
                                </Typography>
                            </Grid>
                        </Grid>       
                    :
                        <>{mintAddress}</>
                    }
                </>
            )

        }
      
        return (
          <>
            <Box sx={{ minWidth: 120, ml:1 }}>
              <FormControl fullWidth sx={{mb:2}}>
                <InputLabel id="governance-token-select-label">Select Governing Token Mint</InputLabel>
                <Select
                  labelId="governance-token-select-label"
                  id="governance-token-select"
                  value={tokenAta}
                  label="Select Governing Token Mint"
                  onChange={handleMintSelected}
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 200, // Adjust this value as needed
                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                      },
                    },
                  }}
                >


                    {(consolidatedGovernanceWallet) && 
                        
                        consolidatedGovernanceWallet.map((governanceItem: any, key: number) => {
                            
                            return (
                                governanceItem.tokens
                                    .filter((item: any) => 
                                        (item.account.data.parsed.info.mint === filter[0] || item.account.data.parsed.info.mint === filter[1]) &&
                                        item.account.data.parsed.info.tokenAmount.amount > 0

                                    )
                                    .map((item: any, key: number) => {
                                        
                                        //if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                        //    item.account.data.parsed.info.tokenAmount.amount > 0) {

                                            return (
                                                <MenuItem key={key} value={item.pubkey}>
                                                    
                                                    <Grid container
                                                        alignItems="center"
                                                    >
                                                        <Grid item xs={12}>
                                                        <Grid container>
                                                            <Grid item sm={8}>
                                                            <Grid
                                                                container
                                                                direction="row"
                                                                justifyContent="left"
                                                                alignItems="left"
                                                            >

                                                                {item.account?.tokenMap?.tokenName ?
                                                                    <Grid 
                                                                        container
                                                                        direction="row"
                                                                        alignItems="center"
                                                                    >
                                                                        <Grid item>
                                                                            <Avatar alt={item.account.tokenMap.tokenName} src={item.account.tokenMap.tokenLogo} />
                                                                        </Grid>
                                                                        <Grid item sx={{ml:1}}>
                                                                            <Typography variant="h6">
                                                                            {item.account.tokenMap.tokenName}
                                                                            </Typography>
                                                                        </Grid>
                                                                    </Grid>
                                                                :
                                                                    <>
                                                                        <ShowTokenMintInfo mintAddress={item.account.data.parsed.info.mint} />
                                                                    </>
                                                                }
                                                            </Grid>
                                                            </Grid>
                                                            <Grid item xs sx={{textAlign:'right'}}>
                                                            <Typography variant="h6">

                                                                {(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals).toLocaleString()}
                                                            </Typography>
                                                            </Grid>
                                                        </Grid>  

                                                        <Grid item xs={12} sx={{textAlign:'center',mt:-1}}>
                                                            <Typography variant="caption" sx={{borderTop:'1px solid rgba(255,255,255,0.05)',pt:1}}>
                                                                {item.account.data.parsed.info.mint}
                                                            </Typography>
                                                        </Grid>
                                                        </Grid>
                                                    </Grid>
                                                </MenuItem>
                                            );
                                        //} else {
                                        //    return null; // Don't render anything for items without nativeTreasuryAddress
                                        //}
                                    })
                            )
                            })
                            
                        }


                    {/*governanceWallet && governanceWallet.tokens.value
                    // ? item.account.data.parsed.info.mint === filter
                            
                            .filter((item: any) => 
                                item.account.data?.parsed?.info?.tokenAmount?.amount > 0
                            )
                            .sort((a: any, b: any) => 
                                b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                            )
                            .map((item: any, key: number) => {
                                
                                if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                                    item.account.data.parsed.info.tokenAmount.amount > 0 &&
                                    (item.account.data.parsed.info.mint === filter[0] || item.account.data.parsed.info.mint === filter[1])) {
                                
                                    //console.log("mint: "+item.account.data.parsed.info.mint)

                                    return (
                                        <MenuItem key={key} value={item.pubkey}>
                                            
                                            <Grid container
                                                alignItems="center"
                                            >
                                                <Grid item xs={12}>
                                                <Grid container>
                                                    <Grid item sm={8}>
                                                    <Grid
                                                        container
                                                        direction="row"
                                                        justifyContent="left"
                                                        alignItems="left"
                                                    >

                                                        {item.account?.tokenMap?.tokenName ?
                                                            <Grid 
                                                                container
                                                                direction="row"
                                                                alignItems="center"
                                                            >
                                                                <Grid item>
                                                                    <Avatar alt={item.account.tokenMap.tokenName} src={item.account.tokenMap.tokenLogo} />
                                                                </Grid>
                                                                <Grid item sx={{ml:1}}>
                                                                    <Typography variant="h6">
                                                                    {item.account.tokenMap.tokenName}
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>
                                                        :
                                                            <>
                                                                <ShowTokenMintInfo mintAddress={item.account.data.parsed.info.mint} />
                                                            </>
                                                        }
                                                    </Grid>
                                                    </Grid>
                                                    <Grid item xs sx={{textAlign:'right'}}>
                                                    <Typography variant="h6">

                                                        {(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals).toLocaleString()}
                                                    </Typography>
                                                    </Grid>
                                                </Grid>  

                                                <Grid item xs={12} sx={{textAlign:'center',mt:-1}}>
                                                    <Typography variant="caption" sx={{borderTop:'1px solid rgba(255,255,255,0.05)',pt:1}}>
                                                        {item.account.data.parsed.info.mint}
                                                    </Typography>
                                                </Grid>
                                                </Grid>
                                            </Grid>
                                        </MenuItem>
                                    );
                                } else {
                                    return null; // Don't render anything for items without nativeTreasuryAddress
                                }
                            })*/}
                    
                </Select>
              </FormControl>
            </Box>
          </>
        );
      }
    

    /*
    function handleTokenAmountChange(text:string){
        // Use a regular expression to allow numeric input with optional decimals
        const numericInput = text.replace(/[^0-9.]/g, '');

        // Ensure there's only one decimal point
        const parts = numericInput.split('.');
        if (parts.length > 2) return; // More than one decimal point

        if (parts[1] && parts[1].length > 9) return; // More than 9 decimal places

        // Add a fractional part (even if zero) to ensure it's treated as a float
        const withFractionalPart = numericInput.includes('.') ? numericInput : numericInput + '.0';

        // Update the input field value
        // event.target.value = withFractionalPart;

        // Set tokenAmount as a float
        setTokenAmount(parseFloat(withFractionalPart));
    }*/
    const handleTokenAmountChange = (e) => {
        // Remove leading zeros using a regular expression
        
            const cleanedValue = e.target.value.replace(/^0+/, '');
        
            setTokenAmount(cleanedValue);
    };

    const handleDistrubtionTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setDistributionType(event.target.checked);
    };

    
    function calculateDestinationsEvenly(destinations:string, destinationAmount: number){
        const destinationsStr = destinations.replace(/['"]/g, '');;
        
        if (destinationsStr && destinationsStr.length > 0) {
            const destinationArray = destinationsStr
                .split(/,|\n/) // Split by comma or newline
                .map(destination => destination.trim().split(',')[0]) // Ignore numeric values after comma
                .filter(destination => destination);

            // Use a Set to filter out duplicates
            const uniqueDestinationsSet = new Set(destinationArray);

            // Convert the Set back to an array to preserve order and uniqueness
            let uniqueValidDestinations = Array.from(uniqueDestinationsSet)
                .filter(destination => isValidSolanaPublicKey(destination)) // Filter valid addresses
                .map(destination => ({
                    address: destination,
                    amount: ((tokenAmount || destinationAmount) / uniqueDestinationsSet.size),
                }));

            //console.log(tokenAmount + " - "+ destinationAmount);
            //console.log("uniqueDestinationsSet.size: "+ uniqueDestinationsSet.size);

            if (uniqueValidDestinations.length > maxDestinationWalletLen)
                uniqueValidDestinations = uniqueValidDestinations.slice(0, maxDestinationWalletLen);
            
            uniqueValidDestinations.forEach(destination => {
                destination.amount = ((tokenAmount || destinationAmount) / uniqueValidDestinations.length);
            });
            
            //console.log("uniqueValidDestinations: "+ uniqueValidDestinations.length);

            setDestinationWalletArray(uniqueValidDestinations);
        } else{
            setDestinationWalletArray(null);
        }
    }
    
    function calculateDestinations(destination:string) {

        if (destination.includes('\t') && destination.includes(',')){ // here remove all commas
            destination = destination.replace(/,/g, '');
        }

        const destinationsStr = destination.replace(/['"]/g, '').replace(/[\t]/g, ',');
        const destinationArray = destinationsStr.split('\n').map(item => item.trim()).filter(item => item !== '');
        
        const uniqueDestinationsMap = new Map();
        let totalAmount = 0;
        
        for (const destination of destinationArray) {
            let address = '';
            let amountStr = '';

            if (destination.includes('\t')){
                [address, amountStr] = destination.split('\t');
            } else{
                [address, amountStr] = destination.split(',');
            }

            address = address.trim();

            //const [address2, amountStr2] = destination.split('\t');
            //const [address, amountStr] = destination.split('    ');
            //const [address, amountStr] = destination.split(/[,|\t| {4}| {1}|⟶]/);

          if (isValidSolanaPublicKey(address)) {
            const amount = parseFloat(amountStr);
            
            if (!isNaN(amount)) {
                totalAmount+=amount;
                if (uniqueDestinationsMap.has(address)) {
                    // If the address already exists, update the amount
                    uniqueDestinationsMap.get(address).amount += amount;
                } else {
                    // If it's a new address, add it to the map
                    uniqueDestinationsMap.set(address, { address, amount });
                }
            }
          }
        }
      
        // Convert the map values to an array
        let uniqueDestinations = Array.from(uniqueDestinationsMap.values());
        
        if (uniqueDestinations.length > maxDestinationWalletLen)
            uniqueDestinations = uniqueDestinations.slice(0, maxDestinationWalletLen);


        if (totalAmount === 0 && tokenAmount > 0){
            calculateDestinationsEvenly(destination, tokenAmount)
        } else{
            setTokenAmount(totalAmount);
            setDestinationWalletArray(uniqueDestinations);
        }
    } 
    
    React.useEffect(() => { 
        if (destinationString && tokenAmount && distributionType){
            calculateDestinationsEvenly(destinationString, tokenAmount);
        } else if (destinationString){
            calculateDestinations(destinationString);
        } else{
            setDestinationWalletArray(null);
        }
    }, [destinationString, tokenAmount, distributionType]);

    const findPubkey = (address:string) => {
        try{
            const entry = verifiedDestinationWalletArray.find((item) => item.info.addresses.includes(address));
            //console.log("checking: "+address+" vs "+entry)
            if (entry) {
                return entry.pubkey.toBase58();
            }
            return null; // Address not found
        }catch(e){console.log("ERR: "+e)}
    };
    const findDAOPubkey = (address:string, daoMembers?:any) => {
        try{
            if (daoMembers){
                const entry = daoMembers.find((item) => item.info.includes(address));
                if (entry) {
                    return entry.pubkey;
                }
            } else{
                const entry = verifiedDAODestinationWalletArray.find((item) => item.info.includes(address));
                if (entry) {
                    return entry.pubkey;
                }
            }
            return null; // Address not found
        }catch(e){console.log("ERR: "+e)}
    };

    function handleAddMyWallet(){
        if (!destinationString)
            setDestinationString(publicKey.toBase58());
        else if (destinationString.length <= 0)
            setDestinationString(publicKey.toBase58());
        else if (destinationString.includes(publicKey.toBase58()))
            return;
        else
            setDestinationString(destinationString + "\n" + publicKey.toBase58());
    }

    function handleDestinationWalletChange(destinations:string){
        //console.log("String changed...")
        setDestinationString(destinations);
    }

    
    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings();
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);

    React.useEffect(() => {
        if (daoToJoinAddress){
            fetchGovernanceSpecifications(null);
        }
    }, [daoToJoinAddress]);

    return (
        <Box
            sx={{
                m:1,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:1
            }} 
        >
            <Box
                sx={{mb:4}}
            >
                <Typography variant="h5">
                    <Grid 
                            container
                            direction="row"
                            alignItems="center"
                        >
                        <Grid item>
                            <JoinLeftIcon sx={{ fontSize: 50, display: 'flex', alignItems: 'center' }} />
                        </Grid>
                        <Grid item xs sx={{ml:1, display: 'flex', alignItems: 'center'}}>
                            <strong>Grant DAO Voting Power</strong>&nbsp;Plugin
                        </Grid>
                    </Grid>
                </Typography>
            </Box>

            {/*
            <FormControl fullWidth  sx={{mb:2}}>
                <TextField 
                    fullWidth 
                    label="From Governance Wallet" 
                    id="fullWidth"
                    value={fromAddress}
                    type="text"
                    onChange={(e) => {
                    //    setFromAddress(e.target.value);
                    }}
                    disabled
                    sx={{borderRadius:'17px'}} 
                />
            </FormControl>
            */}
            
            <FormControl fullWidth  sx={{mb:2}}>
                
                <TextField 
                    fullWidth 
                    label="DAO Address" 
                    id="fullWidth"
                    type="text"
                    value={daoToJoinAddress}
                    onChange={(e) => {
                        handleSetDaoToJoinAddressChange(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'center' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                <Grid sx={{textAlign:'right',}}>
                    <Tooltip title='Use this DAO'>
                        <IconButton 
                                size="small"
                                onClick={handleSetThisDao}
                                color='inherit'
                                sx={{color:'white',textTransform:'none',ml:1}}>
                            <CorporateFareIcon sx={{fontSize:'18px'}} />
                        </IconButton>
                    </Tooltip>
                </Grid>

                {(!daoToJoinAddress && (daoToJoinAddressStr && daoToJoinAddressStr.length > 0)) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : 
                    <>{governance ?
                            <>
                                 <Box
                                    sx={{ m:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:1
                                    }}
                                >
                                    <Grid sx={{textAlign:'right',}}>
                                        <Typography variant="h6">{governance.account.name}<br/></Typography>
                                        <Typography variant="caption" color="success">
                                            
                                                Community Mint: <ExplorerView
                                                                address={governance.account.communityMint.toBase58()} type='address'
                                                                shorten={8}
                                                                hideTitle={false} style='text' color='white' fontSize='12px'
                                                                showTokenMetadata={true}/>
                                            
                                                {governance.account.config.councilMint &&
                                                    <>
                                                    Council Mint: <ExplorerView
                                                                    address={governance.account.config.councilMint.toBase58()} type='address'
                                                                    shorten={8}
                                                                    hideTitle={false} style='text' color='white' fontSize='12px'/>
                                                    </>
                                                }
                                        </Typography>
                                    </Grid>
                                </Box>
                            </>
                        :
                            <></>
                    }
                    </>
                }
            </FormControl>

            <FormControl fullWidth  sx={{mb:2}}>
                {/*
                <TextField 
                    fullWidth 
                    label="DAO Address" 
                    id="fullWidth"
                    type="text"
                    onChange={(e) => {
                        handleDestinationAddressChange(e.target.value);
                        
                    }}
                    inputProps={{
                        style: { textAlign: 'center' },
                    }}
                    sx={{borderRadius:'17px'}} 
                />
                {(!destinationAddress) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : <></>
                }*/}
                
            </FormControl>
            
            {(daoToJoinAddress && governance) &&
                <>

                    <TokenSelect filter={[governance.account.communityMint.toBase58(), governance.account.config.councilMint ? governance.account.config.councilMint.toBase58() : '']} /> 
                    {/*
                    [{governance.account.communityMint.toBase58()}, governance.account.config.councilMint ? governance.account.config.councilMint : ''] }/>
                    */}

                    {tokenMint &&
                        <>
                            <FormControl fullWidth  sx={{mb:2}}>
                                <Grid container alignContent="center" alignItems="center" direction="row" xs={12}>
                                    <Grid item xs>
                                        
                                        {/*
                                        <TextField 
                                            fullWidth 
                                            label="Amount" 
                                            id="fullWidth"
                                            //value={tokenAmount}
                                            type="text"
                                            onChange={(e) => {
                                                handleTokenAmountChange(e.target.value);
                                            }}
                                            inputProps={{
                                                inputMode: 'numeric', // Set inputMode for mobile support
                                                pattern: '[0-9.]*', // Use pattern attribute to restrict input to digits
                                                style: { textAlign: 'right' },
                                            }}
                                            sx={{borderRadius:'17px'}} 
                                        />
                                        */}
                                        <RegexTextField
                                            regex={/[^0-9]+\.?[^0-9]/gi}
                                            autoFocus
                                            autoComplete='off'
                                            margin="dense"
                                            id="amount"
                                            label='Amount'
                                            type="text"
                                            fullWidth
                                            variant="outlined"
                                            value={tokenAmount > 0 ? tokenAmount : ''}
                                            onChange={handleTokenAmountChange}
                                            inputProps={{
                                                style: { 
                                                    textAlign:'center', 
                                                    fontSize: '20px'
                                                }
                                            }}
                                        />
                                        {tokenMaxAmount ?
                                            <Grid xs="auto" sx={{textAlign:'right',}}>
                                                <Tooltip title={
                                                    <>
                                                    Distribute Evenly<br/>
                                                    For custom amounts please use the following format:
                                                    address,amount
                                                    </>}>
                                                    <FormControlLabel control={
                                                        <Checkbox 
                                                            defaultChecked={distributionType}
                                                            onChange={handleDistrubtionTypeChange}
                                                        />
                                                        }
                                                        label='Even'/>

                                                </Tooltip>
                                            
                                                <ButtonGroup size='small'>
                                                    <Button
                                                        onClick={(e:any)=> {
                                                            setTokenAmount(tokenMaxAmount);
                                                        }}
                                                    >Max</Button>
                                                    <Button
                                                        onClick={(e:any)=> {
                                                            setTokenAmount(tokenMaxAmount/2);
                                                        }}
                                                    >Half</Button>
                                                </ButtonGroup>
                                            </Grid>
                                        : <></>
                                        }
                                        {tokenMaxAmount && tokenAmount > tokenMaxAmount ? 
                                            <Grid sx={{textAlign:'right',}}>
                                                <Typography variant="caption" color="error">WARNING: This proposal may fail if the token balance is insufficient!</Typography>
                                            </Grid>
                                        : <></>
                                        }

                                        {(tokenMaxAmount <= 0.001)&&
                                            <Grid sx={{textAlign:'right',}}>
                                                <Typography variant="caption" color="error">Balance greater than rent is required to do a transfer</Typography>
                                            </Grid>
                                        }
                                    </Grid>
                                </Grid>
                            </FormControl>
                             
                            <FormControl fullWidth  sx={{mb:2}}>
                                <Grid container alignContent="center" alignItems="center" direction="row" xs={12}>
                                    <TextField 
                                        fullWidth
                                        label="Enter destination Wallet *for multiple wallets add 1 wallet per line (seperate with a comma/tab for custom distribution per wallet)"
                                        multiline
                                        rows={4}
                                        maxRows={4}
                                        value={destinationString}
                                        defaultValue={destinationString}
                                        onChange={(e) => {
                                                handleDestinationWalletChange(e.target.value)
                                        }}
                                        InputLabelProps={{ shrink: true }}
                                        //sx={{maxlength:maxDestinationWalletLen}}
                                        />
                                </Grid>
                                <Grid sx={{textAlign:'right',}}>
                                    <LookupTableIntegratedDialogView address={fromAddress} integrationType={1} buttonSize={12} setDestinationString={setDestinationString} destinationString={destinationString} />
                                    <Tooltip title='Add my Wallet'>
                                        <IconButton 
                                                size="small"
                                                onClick={handleAddMyWallet}
                                                color='inherit'
                                                sx={{color:'white',textTransform:'none',ml:1}}>
                                            <PersonIcon sx={{fontSize:'18px'}} />
                                        </IconButton>
                                    </Tooltip>
                                </Grid>
                            </FormControl>
                        </>
                    }  
                                        
                </>
            }

            {(daoToJoinAddress && tokenAmount && destinationWalletArray && destinationWalletArray.length > 0 && tokenMint) ?
                    <>  
                        {destinationWalletArray.length > 0 ?
                        <>
                            {destinationWalletArray.length === 1 ?
                                <Box
                                    sx={{ m:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:1
                                    }}
                                >
                                    <Typography variant="h6">Preview/Summary <GrapeVerificationSpeedDial address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDestinationWalletArray={setVerifiedDestinationWalletArray} /> {governance && <GrapeVerificationDAO title={governance ? governance.account.name : null} governanceAddress={daoToJoinAddress} governanceLookup={governanceLookup} address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDAODestinationWalletArray={setVerifiedDAODestinationWalletArray} />}</Typography>
                                    <Typography variant="caption">
                                    DAO to Grant Voting Power <strong>{daoToJoinAddress}</strong><br/>
                                    Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to <strong>{destinationWalletArray[0].address} {verifiedDestinationWalletArray ? 
                                        (
                                            findPubkey(destinationWalletArray[0].address) ? (
                                                <Tooltip title={`Grape Verified on ${findPubkey(destinationWalletArray[0].address)} via Speed Dial`}>
                                                    <IconButton
                                                        size="small" sx={{}}
                                                    >
                                                        <VerifiedIcon sx={{ color:'yellow',fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <>
                                                {verifiedDestinationWalletArray.length > 0 &&
                                                    <Tooltip title={`This address is not part of a Speed Dial`}>
                                                        <IconButton
                                                            size="small" sx={{}}
                                                        >
                                                            <WarningIcon color="warning" sx={{ fontSize: '12px' }}/>
                                                        </IconButton>
                                                    </Tooltip>
                                                }
                                                </>
                                            )
                                        ):<></>}
                                        {verifiedDAODestinationWalletArray ? 
                                        (
                                            findDAOPubkey(destinationWalletArray[0].address) ? (
                                                <Tooltip title={`DAO Verified on ${findDAOPubkey(destinationWalletArray[0].address)}`}>
                                                    <IconButton
                                                        size="small" sx={{}}
                                                    >
                                                        <CheckCircleIcon color='primary' sx={{ fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            ) : (
                                                <Tooltip title={`Could not find a voter record for this address, or voter has no voting power`}>
                                                    <IconButton
                                                        size="small" sx={{}}
                                                    >
                                                        <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                    </IconButton>
                                                </Tooltip>
                                            )
                                        ):<></>}
                                    </strong>
                                    </Typography>
                                </Box>
                            :
                                <Box
                                    sx={{ m:1,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:1
                                    }}
                                >   
                                    <Typography variant="h6">Preview/Summary <GrapeVerificationSpeedDial address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDestinationWalletArray={setVerifiedDestinationWalletArray}/> {governance && <GrapeVerificationDAO title={governance ? governance.account.name : null} governanceAddress={daoToJoinAddress} governanceLookup={governanceLookup} address={fromAddress} destinationWalletArray={destinationWalletArray} setVerifiedDAODestinationWalletArray={setVerifiedDAODestinationWalletArray} />}</Typography>
                                    <Typography variant="caption">
                                        DAO to Grant Voting Power <strong>{daoToJoinAddress} {governance && governance.account.name}</strong> <br/>
                                        Sending <strong>{tokenAmount.toLocaleString()}</strong> {tokenMint} to {destinationWalletArray.length} recipient(s):<br/>
                                        {destinationWalletArray.map((destination:any, index:number) => (
                                            <li key={index}>
                                                {destination.address.trim()}{' '}
                                                    {verifiedDestinationWalletArray ? (
                                                        findPubkey(destination.address) ? (
                                                            <Tooltip title={`Grape Verified on ${findPubkey(destination.address)} via Speed Dial`}>
                                                                <IconButton size="small" sx={{}}>
                                                                    <VerifiedIcon sx={{ color:'yellow', fontSize: '12px' }}/>
                                                                </IconButton>
                                                            </Tooltip>
                                                        ) : (
                                                            <>
                                                                {verifiedDestinationWalletArray.length > 0 &&
                                                                    <Tooltip title={`This address is not part of a Speed Dial`}>
                                                                        <IconButton
                                                                            size="small" sx={{}}
                                                                        >
                                                                            <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                }
                                                            </>
                                                        )
                                                        ) : (
                                                        ''
                                                    )}
                                                    
                                                    {verifiedDAODestinationWalletArray ? 
                                                        (
                                                            findDAOPubkey(destination.address) ? (
                                                                <Tooltip title={`DAO Verified on ${findDAOPubkey(destination.address)}`}>
                                                                    <IconButton
                                                                        size="small" sx={{}}
                                                                    >
                                                                        <CheckCircleIcon color='primary' sx={{ fontSize: '12px' }}/>
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : (
                                                                <Tooltip title={`Could not find a voter record for this address, or voter has no voting power`}>
                                                                    <IconButton
                                                                        size="small" sx={{}}
                                                                    >
                                                                        <WarningIcon color="error" sx={{ fontSize: '12px' }}/>
                                                                    </IconButton>
                                                                </Tooltip>
                                                            )
                                                        ):<></>}
                                                      
                                                    {' '}
                                                    - {destination.amount.toLocaleString()} tokens
                                            </li>
                                        ))}
                                    </Typography>
                                </Box>
                            }
                        </>
                        :<></>
                        }
                    </>
                :
                    <Box
                        sx={{textAlign:'center'}}
                    >
                        <Typography variant="caption">Start by setting & DAO address, selecting a token, amount and wallet destination address</Typography>
                    </Box>
                }

            
                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (daoToJoinAddress) &&
                            ((tokenAmount > 0) &&
                            (tokenAmount <= tokenMaxAmount)) && !loadingInstructions
                        )
                        }
                        onClick={transferDAOPower}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}
                        >
                            {loadingInstructions ? 
                                <><CircularProgress sx={{padding:'10px'}} /> Preparing Instructions</>
                                :
                                <>
                                Preview Instructions</>
                            }</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:1,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:1
                        }}
                    >
                        <Typography variant="h6">Transaction Instructions</Typography>
                    
                        <CustomTextarea
                            minRows={6}
                            value={JSON.stringify(transactionInstructions)}
                            readOnly
                        /><br/>
                        {/*
                        <TextField 
                            fullWidth
                            label="Instructions"
                            multiline
                            rows={4}
                            maxRows={4}
                            value={JSON.stringify(transactionInstructions)}
                            disabled
                        />*/}

                        {transactionEstimatedFee &&
                            <Grid sx={{textAlign:'right'}}>
                                <Typography variant="caption">
                                    Estimated Fee {transactionEstimatedFee}
                                </Typography>
                            </Grid>
                        }
                    </Box>

                }

            <Grid sx={{textAlign:'right'}}>
            <Button 
                disabled={!(
                    (transactionInstructions && JSON.stringify(transactionInstructions).length > 0)
                )}
                onClick={prepareAndReturnInstructions}
                fullWidth
                variant="contained"
                color="warning"
                sx={{borderRadius:'17px'}}>
                Add to Proposal</Button>
            </Grid>

            
            <Box
                sx={{mt:4,textAlign:'center'}}
            >
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Grant DAO Voting Power Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}