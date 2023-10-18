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
import { Buffer } from "buffer";
import BN from "bn.js";
import * as anchor from '@project-serum/anchor';
import { Metadata, PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { useWallet } from '@solana/wallet-adapter-react';

import { RPC_CONNECTION } from '../../../utils/grapeTools/constants';
import { RegexTextField } from '../../../utils/grapeTools/RegexTextField';

import { styled } from '@mui/material/styles';

import { createCastVoteTransaction } from '../../../utils/governanceTools/components/instructions/createVote';

import { 
    getGovernanceProgramVersion,
    withDepositGoverningTokens,
    getRealm,
    getRealms,
    getAllProposals,
    getTokenOwnerRecordsByOwner,
    getAllTokenOwnerRecords,
    serializeInstructionToBase64,
  } from '@solana/spl-governance';

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

import { parseMintNaturalAmountFromDecimalAsBN } from '../../../utils/grapeTools/helpers';

import JoinLeftIcon from '@mui/icons-material/JoinLeft';
import WarningIcon from '@mui/icons-material/Warning';
import SendIcon from '@mui/icons-material/Send';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CircularProgress from '@mui/material/CircularProgress';
import HelpIcon from '@mui/icons-material/Help';
import CloseIcon from '@mui/icons-material/Close';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ArrowCircleRightOutlinedIcon from '@mui/icons-material/ArrowCircleRightOutlined';
import { number } from 'prop-types';

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

export default function InterDAOView(props: any) {
    const payerWallet = props?.payerWallet || null;
    const setInstructionsObject = props?.setInstructionsObject;
    const governanceLookup = props?.governanceLookup;
    const [governance, setGovernance] = React.useState(null);
    const [governanceWallet, setGovernanceWallet] = React.useState(props?.governanceWallet);
    const [consolidatedGovernanceWallet, setConsolidatedGovernanceWallet] = React.useState(null);
    const [fromAddress, setFromAddress] = React.useState(governanceWallet?.vault.pubkey);
    const [tokenMint, setTokenMint] = React.useState(null);
    const [tokenAmount, setTokenAmount] = React.useState(0.0);
    const [transactionInstructions, setTransactionInstructions] = React.useState(null);
    const [payerInstructions, setPayerInstructions] = React.useState(null);
    const [tokenMaxAmount, setTokenMaxAmount] = React.useState(null);
    const [tokenMaxAmountRaw, setTokenMaxAmountRaw] = React.useState(null);
    const [transactionEstimatedFee, setTransactionEstimatedFee] = React.useState(null);
    const [selectedRecord, setSelectedRecord] = React.useState(null);
    const [daoToParticipateAddress, setDaoToParticipateAddress] = React.useState(null);
    const [daoToParticipatePropAddress, setDaoToParticipatePropAddress] = React.useState(null);
    const [loadingWallet, setLoadingWallet] = React.useState(false);
    const [participatingGovernanceRecordRows, setParticipatingGovernanceRecordRows] = React.useState(null);
    const [participatingGovernanceProposalsRecordRows, setParticipatingGovernanceProposalsRecordRows] = React.useState(null);
    const { publicKey } = useWallet();
    const connection = RPC_CONNECTION;
    
    //console.log("governanceWallet: "+JSON.stringify(governanceWallet));

    

    async function participateInDAOProposal() {
        const transaction = new Transaction();
        
        // we need to fetch the governance details either her or a step before
        
        /*
        const programId = governance.owner;
        console.log("programId: "+JSON.stringify(programId));
        const programVersion = await getGovernanceProgramVersion(
            connection,
            programId,
          )
        console.log("programVersion: "+JSON.stringify(programVersion));

        */
        
        //    setMemberMap(rawTokenOwnerRecords);
       
        const realmPk = new PublicKey(daoToParticipateAddress);
        
        console.log("daoToParticipateAddress: "+daoToParticipateAddress);
        console.log("daoToParticipatePropAddress: "+daoToParticipatePropAddress);
        
        let selgovernance = null;
        let proposalId = daoToParticipatePropAddress;
        let tokenOwnerRecord = null;
        let governingTokenMint = null;
        let programId = null;
        for (let prop of participatingGovernanceProposalsRecordRows){
            
            if (prop.pubkey.toBase58() === daoToParticipatePropAddress){
                console.log("boom "+JSON.stringify(prop));
                selgovernance = prop.account.governance;
                governingTokenMint = prop.account.governingTokenMint;
                tokenOwnerRecord = prop.account.tokenOwnerRecord;
                programId = prop.owner;
            }
        }
        
        const proposal = {
            governanceId: selgovernance,
            proposalId: proposalId,
            tokenOwnerRecord: tokenOwnerRecord,
            governingTokenMint: governingTokenMint
        }
        const transactionData = {proposal:proposal,action:0} // 0 = yes

        //console.log("governance: "+JSON.stringify(governance));

        const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, programId, realmPk)
        
        
        const memberItem = rawTokenOwnerRecords.find(item => 
            (item.account.governingTokenOwner.toBase58() === fromAddress && 
            item.account.governingTokenMint.toBase58() === governingTokenMint.toBase58()));

        console.log("memberItem: "+JSON.stringify(memberItem));
        
        
        
        //console.log("memberItemSimple: "+JSON.stringify(memberItemSimple));
        //console.log("memberItem: "+JSON.stringify(memberItem));

        //console.log("tokenOwnerRecord: "+JSON.stringify(thisitem.account.tokenOwnerRecord));
        
        //console.log("Proposal: "+JSON.stringify(proposal));
        //console.log("realmData: "+JSON.stringify(realmData));
        //console.log("memberItem: "+JSON.stringify(memberItem));

        //console.log("memberMapReduced: "+JSON.stringify(memberMapReduced));

        // check if voter can participate

        const type = 0;//props?.type || 0;
        const multiChoice = null;//props?.multiChoice || null;
        const isCommunityVote = true; //propVoteType !== 'Council';

        if (publicKey && memberItem) {
            
            const vvvt = await createCastVoteTransaction(
                governance,//realm,
                new PublicKey(fromAddress),//publicKey,
                transactionData,
                memberItem,
                null,
                isCommunityVote,
                multiChoice,
                type
            );

            if (vvvt){

                //const transaction = new Transaction();
                //transaction.add(...instructions);

                //console.log("TX: "+JSON.stringify(transaction));
                setTransactionInstructions(vvvt);
            } else{
                console.log("No instructions!");
            }
        }
        /*
            //console.log("vvvt: "+JSON.stringify(vvvt));
            /*
            if (vvvt){
                try{
                    enqueueSnackbar(`Preparing to cast vote`,{ variant: 'info' });
                    const signature = await sendTransaction(vvvt, connection, {
                        skipPreflight: true,
                        preflightCommitment: "confirmed",
                    });
                    const snackprogress = (key:any) => (
                        <CircularProgress sx={{padding:'10px'}} />
                    );
                    const cnfrmkey = enqueueSnackbar(`Confirming transaction`,{ variant: 'info', action:snackprogress, persist: true });
                    //await connection.confirmTransaction(signature, 'processed');
                    const latestBlockHash = await connection.getLatestBlockhash();
                    await connection.confirmTransaction({
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
                    
                    enqueueSnackbar(`Congratulations, you have participated in voting for this Proposal`,{ variant: 'success', action });

                    // trigger a refresh here...
                    getVotingParticipants();
                }catch(e:any){
                    enqueueSnackbar(e.message ? `${e.name}: ${e.message}` : e.name, { variant: 'error' });
                } 
            } else{
                alert("No voter record!")
            }
           
        }
         */
        /*
        if (instructions.length != 1) {
            console.log("ERROR: Something went wrong");
        } else{

            if (instructions){

                const transaction = new Transaction();
                transaction.add(...instructions);

                console.log("TX: "+JSON.stringify(transaction));
                setTransactionInstructions(transaction);
            } else{
                console.log("No instructions!");
            }
        }
        */
        
        return null;
    }

    
    function prepareAndReturnInstructions(){

        //await transferTokens;

        let description = "";

        description = `Inter DAO voting ${daoToParticipateAddress} on proposal${daoToParticipatePropAddress} with full Governance Power`;
        
        setInstructionsObject({
            "type":`Inter DAO Participation`,
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

    function handleSetDaoToJoinAddressChange(text:string){
        // add validation here
        //console.log("checking: "+text);
        if (isValidSolanaPublicKey(text)){
            //console.log("setDaoToJoinAddress complete!");
            setDaoToParticipateAddress(text);
        } else{
            setDaoToParticipateAddress(null);
        }
    }

    function handleSetDaoToParticipateAddressChange(text:string){
        // add validation here
        //console.log("checking: "+text);
        if (isValidSolanaPublicKey(text)){
            //console.log("setDaoToJoinAddress complete!");
            setDaoToParticipatePropAddress(text);
        } else{
            setDaoToParticipatePropAddress(null);
        }
    }

    
    const handleDaoProposalSelected = (event: SelectChangeEvent) => {
        const selectedDaoProp = event.target.value as string;
        console.log("checking: "+selectedDaoProp)
        if (isValidSolanaPublicKey(selectedDaoProp)){
            //console.log("setDaoToJoinAddress complete!");
            setDaoToParticipatePropAddress(selectedDaoProp);
        } else{
            setDaoToParticipatePropAddress(null);
        }
    }
    const handleDaoSelected = (event: SelectChangeEvent) => {
        const selectedDao = event.target.value as string;
        console.log("checking: "+selectedDao)
        if (isValidSolanaPublicKey(selectedDao)){
            //console.log("setDaoToJoinAddress complete!");
            setDaoToParticipateAddress(selectedDao);
        } else{
            setDaoToParticipateAddress(null);
        }
    }

    async function getAndUpdateWalletHoldings(wallet:string){
        try{
            setLoadingWallet(true);
            const solBalance = await connection.getBalance(new PublicKey(wallet));

            const tokenBalance = await connection.getParsedTokenAccountsByOwner(
                new PublicKey(wallet),
                {
                programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                }
            )
            // loop through governanceWallet
            governanceWallet.solBalance = solBalance;
            const itemsToAdd = [];

            console.log("governanceWallet "+JSON.stringify(governanceWallet));
            if (tokenBalance?.value){
                for (let titem of tokenBalance?.value){
                    if (governanceWallet.tokens.value){
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
                        }
                    }
                }
            }

            governanceWallet.tokens.value = itemsToAdd;//[...governanceWallet.tokens.value, ...itemsToAdd];
            setConsolidatedGovernanceWallet(governanceWallet);
            setLoadingWallet(false);
        } catch(e){
            console.log("ERR: "+e);
            setLoadingWallet(false);
        }

    }



    async function fetchGovernanceSpecifications(address:string){
        console.log("fetching specs");
        const rlm = await getRealm(RPC_CONNECTION, new PublicKey(address || daoToParticipateAddress));
        if (rlm){
            console.log("realm: "+JSON.stringify(rlm));
            setGovernance(rlm);
        }
    }

    function TokenSelect(props:any) {
        const filter = props.filter;

        const handleMintSelected = (event: SelectChangeEvent) => {
            const selectedTokenMint = event.target.value as string;
            setTokenMint(selectedTokenMint);

            
            // with token mint traverse to get the mint info if > 0 amount
            {governanceWallet && governanceWallet.tokens.value
                //.sort((a:any,b:any) => (b.solBalance - a.solBalance) || b.tokens?.value.length - a.tokens?.value.length)
                .map((item: any, key: number) => {
                    if (item.account.data?.parsed?.info?.tokenAmount?.amount &&
                        item.account.data.parsed.info.tokenAmount.amount > 0) {
                            if (item.account.data.parsed.info.mint === selectedTokenMint){
                                setTokenMaxAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                                setTokenAmount(item.account.data.parsed.info.tokenAmount.amount/10 ** item.account.data.parsed.info.tokenAmount.decimals);
                            }
                    }
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
                    const tokenMetadata = await Metadata.fromAccountAddress(connection, pda)
                    
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
                <InputLabel id="governance-token-select-label">Select Token</InputLabel>
                <Select
                  labelId="governance-token-select-label"
                  id="governance-token-select"
                  value={tokenMint}
                  label="Select Token"
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
                    {governanceWallet && governanceWallet.tokens.value
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
                                        <MenuItem key={key} value={item.account.data.parsed.info.mint}>
                                            {/*console.log("wallet: "+JSON.stringify(item))*/}
                                            
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
                                                        {/*item.vault?.nativeTreasury?.solBalance/(10 ** 9)*/}

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
                            })}
                    
                </Select>
              </FormControl>
            </Box>
          </>
        );
      }
    
    const handleTokenAmountChange = (e) => {
        // Remove leading zeros using a regular expression
        const cleanedValue = e.target.value.replace(/^0+/, '');
    
        setTokenAmount(cleanedValue);
    };
    

    React.useEffect(() => {
        if (governanceWallet && !consolidatedGovernanceWallet && !loadingWallet) {
            getAndUpdateWalletHoldings(governanceWallet?.vault.pubkey);
            //setConsolidatedGovernanceWallet(gWallet);
        }
    }, [governanceWallet, consolidatedGovernanceWallet]);


    const fetchGovernanceProposals = async () => {

        const gprops = await getAllProposals(RPC_CONNECTION, governance.owner, new PublicKey(daoToParticipateAddress))

        const rpcprops = new Array();
        for (const props of gprops){
            for (const prop of props){
                if (prop){
                    if (prop.account.state === 2)
                        rpcprops.push(prop);
                }
            }
        }
        const sortedRPCResults = rpcprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
        
        setParticipatingGovernanceProposalsRecordRows(sortedRPCResults);
        //console.log("sortedRPCResults: "+JSON.stringify(sortedRPCResults));

    }

    React.useEffect(() => {
        if (daoToParticipateAddress && governance){
            //console.log("here we go!");
            fetchGovernanceProposals();
        }
    }, [daoToParticipateAddress, governance]);
    
    React.useEffect(() => {
        if (daoToParticipateAddress){
            console.log("here we go!");
            fetchGovernanceSpecifications(null);
        }
    }, [daoToParticipateAddress]);

    const fetchGovernance = async () => {
        //setLoadingPosition('Governance');
        const GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
        const programId = new PublicKey(GOVERNANCE_PROGRAM_ID);
        
        /*
        try{
            //console.log("fetching tor ");
            const tor = await getTokenOwnerRecord(txonnection, new PublicKey(pubkey));
            //console.log("tor "+JSON.stringify(tor));
        }catch(e){
            console.log("ERR: "+e);
        }*/

        try{
            //console.log("fetching realms ");
            const rlms = await getRealms(RPC_CONNECTION, [programId]);
            //console.log("rlms "+JSON.stringify(rlms));

            const uTable = rlms.reduce((acc, it) => (acc[it.pubkey.toBase58()] = it, acc), {})
            //setRealms(uTable);
            
            const ownerRecordsbyOwner = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, programId, new PublicKey(fromAddress));
        
            //console.log("ownerRecordsbyOwner "+JSON.stringify(ownerRecordsbyOwner))
            const selectedDao: any[] = [];
            
            let cnt = 0;
            //console.log("all uTable "+JSON.stringify(uTable))
        
            for (const item of ownerRecordsbyOwner){
                const realm = uTable[item.account.realm.toBase58()];
                //console.log("realm: "+JSON.stringify(realm))
                const name = realm.account.name;
                let votes = item.account.governingTokenDepositAmount.toNumber().toString();
                
                if (realm.account.config?.councilMint?.toBase58() === item?.account?.governingTokenMint?.toBase58()){
                    votes = item.account.governingTokenDepositAmount.toNumber() + ' Council';
                }else{
                    votes = Number("0x"+item.account.governingTokenDepositAmount) + ' Community';
                    /*
                    const thisToken = tokenMap.get(item.account.governingTokenMint.toBase58());
                    if (thisToken){
                        votes = (new TokenAmount(+item.account.governingTokenDepositAmount, thisToken.decimals).format())
                    } else{
                        const btkn = await getBackedTokenMetadata(realm.account?.communityMint.toBase58(), wallet);
                        if (btkn){
                            const parentToken = tokenMap.get(btkn.parentToken).name;
                            const vote_count =  (new TokenAmount(+item.account.governingTokenDepositAmount, btkn.decimals).format());
                            if (+vote_count > 0)
                                votes = (new TokenAmount(+item.account.governingTokenDepositAmount, btkn.decimals).format());
                            else
                                votes = parentToken + ' Backed Token';

                        }else{
                            votes = 'NFT';
                        }
                    }
                    */
                } 
                
                console.log("Participating in "+name);
                console.log("With "+votes+" of "+item.account.governingTokenMint.toBase58()+" votes");

                console.log("gov: "+JSON.stringify(item))

                selectedDao.push({
                    id:cnt,
                    pubkey:item.pubkey,
                    name:name,
                    realm:item.account.realm,
                    owner:item.owner,
                    governingTokenMint:item.account.governingTokenMint.toBase58(),
                    governingTokenDepositAmount:votes,
                    unrelinquishedVotesCount:item.account.unrelinquishedVotesCount,
                    totalVotesCount:item.account.totalVotesCount,
                    details:item.account.realm.toBase58(),
                    link:item.account.realm
                });
                cnt++;
            }
            
            setParticipatingGovernanceRecordRows(selectedDao);

        }catch(e){
            console.log("ERR: "+e);
        }
        
    }

    const fetchGovernancePositions = async () => {
        //setLoadingGovernance(true);
        await fetchGovernance();
        //setLoadingGovernance(false);
    }

    React.useEffect(() => {
        if (fromAddress){
            fetchGovernancePositions();
        }
    }, [fromAddress]);


    return (
        <Box
            sx={{
                m:2,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '17px',
                overflow: 'hidden',
                p:4
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
                            <strong>Inter DAO</strong>&nbsp;Plugin
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
            <>
                <FormControl fullWidth  sx={{mb:2}}>
                    
                    {!participatingGovernanceRecordRows ?
                        <TextField 
                            fullWidth 
                            label="DAO Address" 
                            id="fullWidth"
                            type="text"
                            onChange={(e) => {
                                handleSetDaoToJoinAddressChange(e.target.value);
                                
                            }}
                            inputProps={{
                                style: { textAlign: 'center' },
                            }}
                            sx={{borderRadius:'17px'}} 
                        />
                    :
                        <>
                            <InputLabel id="governance-token-select-label">Select a DAO</InputLabel>
                            <Select
                                labelId="governance-dao-select-label"
                                id="governance-dao-select"
                                label="Select a DAO"
                                onChange={handleDaoSelected}
                                MenuProps={{
                                    PaperProps: {
                                    style: {
                                        maxHeight: 200, // Adjust this value as needed
                                        overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                                    },
                                    },
                                }}
                            >
                            {(participatingGovernanceRecordRows
                                //.filter((item: any) => 
                                //    item.account.data?.parsed?.info?.tokenAmount?.amount > 0
                                //)
                                //.sort((a: any, b: any) => 
                                //    b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                                //)
                                .map((item: any, key: number) => {
                                    
                                    //console.log("mint: "+item.account.data.parsed.info.mint)

                                    return (
                                        <MenuItem key={key} value={item.realm.toBase58()}>
                                            {/*console.log("wallet: "+JSON.stringify(item))*/}
                                            
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
                                                        {item.name}
                                                    </Grid>
                                                    </Grid>
                                                    <Grid item xs sx={{textAlign:'right'}}>
                                                        <Typography variant="h6">
                                                            {item.governingTokenDepositAmount}
                                                        </Typography>
                                                    </Grid>
                                                </Grid>  
                                                </Grid>
                                            </Grid>
                                        </MenuItem>
                                    );
                                }))}
                        
                            </Select>
                        
                        </>


                    }
                </FormControl>
                {(!daoToParticipateAddress) ? 
                    <Grid sx={{textAlign:'right',}}>
                        <Typography variant="caption" color="error">WARNING: Invalid DAO address!</Typography>
                    </Grid>
                : 
                    <>
                    {governance ?
                            <>
                                <Box
                                    sx={{ m:2,
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '17px',
                                        overflow: 'hidden',
                                        p:4
                                    }}
                                >
                                    <Grid sx={{textAlign:'right',}}>
                                        <Typography variant="h6">{governance.account.name}<br/></Typography>
                                        <Typography variant="caption" color="success">
                                            
                                            Community Mint: {governance.account.communityMint.toBase58()}
                                            {governance.account.config.councilMint &&
                                                <>
                                                <br/>Council Mint: {governance.account.config.councilMint.toBase58()}
                                                </>
                                            }
                                        </Typography>
                                    </Grid>
                                </Box>


                                <FormControl fullWidth  sx={{mb:2}}>
                

                                {!participatingGovernanceProposalsRecordRows ?
                                    
                                    <TextField 
                                        fullWidth 
                                        label="Proposal Address" 
                                        id="governance-daoprop-select"
                                        type="text"
                                        onChange={(e) => {
                                            handleSetDaoToParticipateAddressChange(e.target.value);
                                            
                                        }}
                                        inputProps={{
                                            style: { textAlign: 'center' },
                                        }}
                                        sx={{borderRadius:'17px'}} 
                                    />
                                :
                                    <>
                                        <InputLabel id="governance-token-select-label">Select a proposal</InputLabel>
                                        <Select
                                            labelId="governance-daoprop-select-label"
                                            id="governance-daoprop-select"
                                            label="Select a proposal"
                                            onChange={handleDaoProposalSelected}
                                            MenuProps={{
                                                PaperProps: {
                                                style: {
                                                    maxHeight: 200, // Adjust this value as needed
                                                    overflowY: 'auto', // Add vertical scrollbar if content overflows maxHeight
                                                },
                                                },
                                            }}
                                        >
                                        {(participatingGovernanceProposalsRecordRows
                                            //.filter((item: any) => 
                                            //    item.account.data?.parsed?.info?.tokenAmount?.amount > 0
                                            //)
                                            //.sort((a: any, b: any) => 
                                            //    b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
                                            //)
                                            .map((item: any, key: number) => {
                                                
                                                return (
                                                    <MenuItem key={key} value={item.pubkey.toBase58()}>
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
                                                                    {item.account.name}
                                                                </Grid>
                                                                </Grid>
                                                                <Grid item xs sx={{textAlign:'center'}}>
                                                                    <Typography variant="caption">
                                                                        {item.account.descriptionLink}
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>  
                                                            </Grid>
                                                        </Grid>
                                                    </MenuItem>
                                                );
                                            }))}
                                    
                                        </Select>
                                    
                                    </>


                                }
                            </FormControl>

                            </>
                        :
                            <></>
                    }
                    </>
                }
            </>

            <FormControl fullWidth  sx={{mb:2}}>
                
            </FormControl>
            
            {(daoToParticipateAddress && daoToParticipatePropAddress) ?
                <>  
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
                        }}
                    >
                        <Typography variant="h6">Preview/Summary</Typography>
                        <Typography variant="caption">
                            Voting for DAO: <strong>{daoToParticipateAddress}</strong><br/>
                            Proposal Voting: <strong>{daoToParticipatePropAddress}</strong><br/>
                            Vote Type <strong>???</strong><br/>
                            Vote Weight <strong>???</strong> Tokens<br/>
                            <Button
                                href={`https://governance.so/proposal/${daoToParticipateAddress}/${daoToParticipatePropAddress}`}
                                target="_blank"
                            >
                                View Proposal
                            </Button>
                        </Typography>
                    </Box>
                
                </>
            :
                <Box
                    sx={{textAlign:'center'}}
                >
                    <Typography variant="caption">Enter a valid DAO address, select the token</Typography>
                </Box>
            }

                <Grid sx={{textAlign:'right', mb:2}}>
                    <Button 
                        disabled={!(
                            (daoToParticipateAddress) &&
                            (daoToParticipatePropAddress)
                        )
                        }
                        onClick={participateInDAOProposal}
                        variant="contained"
                        color="info"
                        sx={{borderRadius:'17px'}}>
                        Preview Instructions</Button>
                </Grid>
                
                {transactionInstructions && 
                    <Box
                        sx={{ m:2,
                            background: 'rgba(0, 0, 0, 0.2)',
                            borderRadius: '17px',
                            overflow: 'hidden',
                            p:4
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
                <Typography variant="caption" sx={{color:'#ccc'}}>Governance Inter DAO Plugin developed by Grape Protocol</Typography>
            </Box>

            
        </Box>
    )

}