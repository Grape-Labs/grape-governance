import React, { useState } from 'react';
import { PublicKey, Signer, TransactionInstruction, Transaction, Keypair, TransactionMessage, VersionedTransaction, SystemProgram } from '@solana/web3.js';
//import { Client } from "discord.js";
import { useSnackbar } from 'notistack';

import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress, 
  createCloseAccountInstruction,
  createBurnInstruction,
  getMint,
} from "@solana/spl-token-v2";

import {
  Typography,
  Tooltip,
  ButtonGroup,
  Button,
  IconButton,
  Grid,
  Chip,
  Box,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material/';

import { 
  Vote,
  VoteChoice,
  VoteKind,
  getGovernanceProgramVersion,
  withDepositGoverningTokens,
  getRealm,
  getRealms,
  withCastVote,
  getAllProposals,
  getProposal,
  getTokenOwnerRecordsByOwner,
  getVoteRecordsByVoter,
  withSetGovernanceDelegate,
  getAllTokenOwnerRecords,
  getTokenOwnerRecord,
  serializeInstructionToBase64,
  withCreateTokenOwnerRecord,
  
} from '@solana/spl-governance';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

import { createCastVoteTransaction } from '../utils/governanceTools/components/instructions/createVote';

import { parseMintNaturalAmountFromDecimalAsBN } from '../utils/grapeTools/helpers';

import { 
  RPC_CONNECTION,
  FRICTIONLESS_WALLET,
  FRICTIONLESS_BG,
} from '../utils/grapeTools/constants';

import ExplorerView from '../utils/grapeTools/Explorer';

const sleep = (ttl: number) =>
  new Promise((resolve) => setTimeout(() => resolve(true), ttl))

function GrapeFrictionless() {
  const [loading, setLoading] = useState(false);
  const [openlogin, setSdk] = useState(undefined);
  const [account, setUserAccount] = useState(null);
  const [walletInfo, setUserAccountInfo] = useState(null);
  const [solanaPrivateKey, setPrivateKey] = useState(null);
  const [emailAddress, setEmailAddress] = useState(null);
  const [pinCode, setPinCode] = useState(null);
  const [generatedWallet, setGeneratedWallet] = useState(null)
  const [voteCastLoading, setVoteCastLoading] = React.useState(false);
  const [realm, setRealm] = React.useState(null);
  const frictionlessDao = 'Hr6PtVoKHTZETmJtjiYu9YeAFCMNUkDTv4qQV2kdDF2C';
  const frictionlessNativeTreasury = 'G1k3mtwhHC6553zzEM8qgU8qzy6mvRxkoRTrwdcsYkxL';
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [refreshProposals, setRefreshProposals] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    async function initializeOpenlogin() {
      /*
      const client = new Client(null);

      client.on("ready", () => {
        //this.setState({ isLoggedIn: true });
        console.log("User is logged in to Discord")
      });
      client.on("loggedIn", () => {
        //this.setState({ userId: client.user.id });
      });
      */
      setLoading(false);
    }
    initializeOpenlogin();
  }, []);

  const generatePublicKeyFromString = async (seedStr:string) => {
    //const programId = PublicKey.programId;
    const secretKey = JSON.parse(FRICTIONLESS_WALLET);

    if (secretKey){
      const fromKeypair = Keypair.fromSecretKey(
        Uint8Array.from(secretKey)
      );
      //const keypair = await PublicKey.createWithSeed(new PublicKey(frictionlessNativeTreasury), seedStr, fromKeypair.publicKey);

      //setGeneratedWallet({publicKey:keypair});

      // Derive the PDA address
      const programId = fromKeypair.publicKey;
      const seed = seedStr;
      let seedBytes = Buffer.from(seed, 'utf8');

      if (seedBytes.length < 32) {
        // Add more characters to the seed to make it at least 32 bytes long.
        seedBytes = Buffer.concat([seedBytes, Buffer.alloc(32 - seedBytes.length)]);
      }
      //const [pda, bump] = PublicKey.findProgramAddressSync([Buffer.from(seed)], programId);
      const pda = Keypair.fromSeed(seedBytes);//PublicKey.findProgramAddressSync([Buffer.from(seed)], programId);
      //console.log("pda: "+JSON.stringify(pda));
      //const seed = frictionlessNativeTreasury+seedStr+fromKeypair.publicKey;
      //const seedBytes = Buffer.from(seed, 'utf8');
      //const keypair = Keypair.fromSeed(seedBytes);
      
      setGeneratedWallet(pda);
    }
    //return keypair.publicKey.toString();
  };

  async function handleLogin() {
    setLoading(true)
    try {
      // handle login...
      generatePublicKeyFromString(emailAddress+pinCode);
      setLoading(false)
    } catch (error) {
      console.log("error", error);
      setLoading(false)
    }
  }

const findGoverningTokenOwner = (data: any, realm: PublicKey, governingTokenOwner:PublicKey) => {
  for (const account of data) {
    if (account.account.realm.toBase58() === realm.toBase58() && account.account.governingTokenOwner.toBase58() === governingTokenOwner.toBase58()) {
      return account;
    }
  }
  return null;
};

async function createAndSendV0Tx(txInstructions: TransactionInstruction[], payer: Keypair, pda: Keypair) {
  // Step 1 - Fetch Latest Blockhash
  let latestBlockhash = await RPC_CONNECTION.getLatestBlockhash('finalized');
  console.log("   ✅ - Fetched latest blockhash. Last valid height:", latestBlockhash.lastValidBlockHeight);

  // Step 2 - Generate Transaction Message
  const messageV0 = new TransactionMessage({
      payerKey: payer.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: txInstructions
  }).compileToV0Message();
  console.log("   ✅ - Compiled transaction message");
  const transaction = new VersionedTransaction(messageV0);

  

  // Step 3 - Sign your transaction with the required `Signers`
  //transaction.addSignature(publicKey);
  if (pda){
    /*
    const pdaFull = {publicKey:pda,secretKey:payer.secretKey};
    
    const accInfo = await RPC_CONNECTION.getAccountInfo(pda.publicKey);
    console.log(
      `Transacting from acc: ${pda.publicKey.toBase58()}, Owned by: ${accInfo?.owner.toBase58()}`
    );
    */
    //transaction.sign([pdaFull,payer]);
    transaction.sign([pda, payer]);
  } else{
    transaction.sign([payer]);
  }
  
  //const signedTransaction = await signTransaction(transaction);
  //const signedTx = await signTransaction(transaction);
  console.log("   ✅ - Transaction Signed");

  // Step 4 - Send our v0 transaction to the cluster
  //const txid = await RPC_CONNECTION.sendTransaction(signedTransaction, { maxRetries: 5 });
  
  //const tx = new Transaction();
  //tx.add(txInstructions[0]);

  const sim = await RPC_CONNECTION.simulateTransaction(transaction);
  console.log("Sim: "+JSON.stringify(sim));
  const fee = await RPC_CONNECTION.getFeeForMessage(messageV0);
  if (fee)
    console.log("Fee: "+(fee.value / 10 ** 9)+"SOL");
  
  if (sim){
    const txid = await RPC_CONNECTION.sendTransaction(transaction, { maxRetries: 5 });

    /*
    const txid = await sendTransaction(transaction, RPC_CONNECTION, {
        skipPreflight: true,
        preflightCommitment: "confirmed"
    });
    */
    console.log("   ✅ - Transaction sent to network with txid: "+txid);

    // Step 5 - Confirm Transaction 
    const snackprogress = (key:any) => (
        <CircularProgress sx={{padding:'10px'}} />
    );
    const cnfrmkey = enqueueSnackbar(`Sending Transaction to Blockchain`,{ variant: 'info', action:snackprogress, persist: true });
    const confirmation = await RPC_CONNECTION.confirmTransaction({
        signature: txid,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    });
    closeSnackbar(cnfrmkey);
    if (confirmation.value.err) { 
        enqueueSnackbar(`Vote Error`,{ variant: 'error' });
        throw new Error("   ❌ - Transaction not confirmed.") }
    
    console.log('🎉 Transaction succesfully confirmed!', '\n', `https://explorer.solana.com/tx/${txid}`);
    return txid;
  }
  return null;
}


const handleVote = async(direction:boolean, proposalAddress:PublicKey, proposalGovernance:PublicKey, proposalTokenOwnerRecord:PublicKey) => {
    setVoteCastLoading(true);

    const secretKey = JSON.parse(FRICTIONLESS_WALLET);
    let programId = null;
    let communityMint = null;
    let gRealm = null;

    if (secretKey){

      let realmPk = new PublicKey(frictionlessDao);
      
      // 1. Grant Dao if not a member:
      if (!realm){
        const rlm = await getRealm(RPC_CONNECTION, realmPk);
        gRealm = rlm;
        programId = rlm.owner;
        communityMint = rlm.account.communityMint;
      } else{
        gRealm = realm;
        programId = realm.owner;
        communityMint = realm.account.communityMint;
      }

      programId = gRealm.owner;

      const programVersion = await getGovernanceProgramVersion(
        RPC_CONNECTION,
        programId,
      )

      //const rpc_members = await getAllTokenOwnerRecords(RPC_CONNECTION, programId,realmPk);
      let tokenOwnerRecords = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, programId, generatedWallet.publicKey);

      console.log("singleTokenOwnerRecord: "+JSON.stringify(tokenOwnerRecords));
      
      const transaction = new Transaction();
      const ixCreateTokenOwnerRecord: TransactionInstruction[] = []
      const ixDepositGoverningTokens: TransactionInstruction[] = []
      const delVote: TransactionInstruction[] = []
      const ixVote: TransactionInstruction[] = []

      const fromKeypair = Keypair.fromSecretKey(
        Uint8Array.from(secretKey)
      );

      if (tokenOwnerRecords){
        //if (!findDAOPubkey(generatedPk, daoMembers)){
        if (!findGoverningTokenOwner(tokenOwnerRecords, realmPk, generatedWallet.publicKey)){
            console.log("Could not find Voter Record")
            await withCreateTokenOwnerRecord(
                ixCreateTokenOwnerRecord,
                gRealm.owner,
                programVersion,
                realmPk,
                generatedWallet.publicKey,
                communityMint,
                fromKeypair.publicKey,
            )
            transaction.add(...ixCreateTokenOwnerRecord);
        }

        const tokenInfo = await getMint(RPC_CONNECTION, communityMint);
        const decimals = tokenInfo.decimals;

        const atomicAmount = parseMintNaturalAmountFromDecimalAsBN(
            1,
            decimals
        )
        
        const userAtaPk = await getAssociatedTokenAddress(
            communityMint,
            fromKeypair.publicKey, // owner
            true
        )
        
        await withDepositGoverningTokens(
            ixDepositGoverningTokens,
            gRealm.owner,
            programVersion,
            realmPk,
            userAtaPk,
            communityMint,
            generatedWallet.publicKey, //fromWallet,
            fromKeypair.publicKey, //destPublicKey,
            fromKeypair.publicKey,
            atomicAmount,
            false
        );
        transaction.add(...ixDepositGoverningTokens);

        console.log("Deposit Tx ready");
        
        let txid = null;
        
        if (!findGoverningTokenOwner(tokenOwnerRecords, realmPk, generatedWallet.publicKey)){
          console.log("Creating Governance Token Owner Record "+generatedWallet.publicKey.toBase58());
          txid = await createAndSendV0Tx([...ixCreateTokenOwnerRecord, ...ixDepositGoverningTokens], fromKeypair, null);

          await sleep(2000);

          tokenOwnerRecords = await getTokenOwnerRecordsByOwner(RPC_CONNECTION, programId, generatedWallet.publicKey);
        } else{
          console.log("Governance Token Owner Record Exists");
        }
        
        //const rawTokenOwnerRecord = await getTokenOwnerRecord(RPC_CONNECTION, fromKeypair.publicKey);
        //console.log("rawTokenOwnerRecord: "+JSON.stringify(tokenOwnerRecordsByOwner));
        
        const foundRecord = findGoverningTokenOwner(tokenOwnerRecords, realmPk, generatedWallet.publicKey);
        if (txid && foundRecord){
          
          //const rawTokenOwnerRecords = await getAllTokenOwnerRecords(RPC_CONNECTION, gRealm.owner, realmPk);
          
          /*
          const memberItem = rawTokenOwnerRecords.find(item => 
              (item.account.governingTokenOwner.toBase58() === fromKeypair.publicKey.toBase58() && 
              item.account.governingTokenMint.toBase58() === communityMint.toBase58()));
            */
            let votingType = 0;
            if (!direction){
                votingType = 1;
            }
            
          let proposalType = true; // community
          let selgovernance = null;
          let proposalId = proposalAddress;
          let tokenOwnerRecord = null;
          let governingTokenMint = null;
          
          const type = votingType;
          const multiChoice = null;//props?.multiChoice || null;
          const isCommunityVote = proposalType; //propVoteType !== 'Council';
        
          console.log("Preparing Vote");

          let rank = 0;
          let weightPercentage = 100;
          if (multiChoice){
            //rank = multiChoice;
            //weightPercentage = 0;
          }
    
          const voteDirection = (type === 0 && multiChoice) ?
                new Vote({
                  voteType: VoteKind.Approve,
                  approveChoices: 
                    multiChoice.proposal.account.options.map((_o, index) => {
                      if (multiChoice.index === index)
                        return new VoteChoice({ rank: 0, weightPercentage: 100 })
                      else
                        return new VoteChoice({ rank: 0, weightPercentage: 0 })
                    }),
                  deny: undefined,
                  veto: undefined,
              })
          :
            type === 0 ?
              new Vote({
                  voteType: VoteKind.Approve,
                  approveChoices: [new VoteChoice({ rank: rank, weightPercentage: weightPercentage })],
                  deny: undefined,
                  veto: undefined,
              })
              :
                new Vote({
                  voteType: VoteKind.Deny,
                  approveChoices: undefined,
                  deny: true,
                  veto: undefined,
              })

          
          // delegate to parent:
          /*
          await withSetGovernanceDelegate(
            delVote,
            gRealm.owner,
            programVersion,
            realmPk,
            communityMint,
            generatedWallet.publicKey,
            fromKeypair.publicKey,//new PublicKey(generatedPk),
            fromKeypair.publicKey
          )*/
          
          /*
          console.log("Realm: "+gRealm.owner.toBase58());
          console.log("realmPk: "+realmPk.toBase58());
          console.log("proposalGovernance: "+proposalGovernance.toBase58());
          console.log("proposalAddress: "+proposalAddress.toBase58());
          console.log("proposalTokenOwnerRecord: "+proposalTokenOwnerRecord.toBase58());
          console.log("foundRecord.pubkey: "+foundRecord.pubkey.toBase58());
          console.log("generatedWallet.publicKey: "+generatedWallet.publicKey.toBase58());
          console.log("communityMint: "+communityMint.toBase58());
          console.log("fromKeypair.publicKey: "+fromKeypair.publicKey.toBase58());
          */

          await withCastVote(
            ixVote,
            gRealm.owner, //  realm/governance PublicKey
            programVersion, // version object, version of realm
            realmPk, // realms publicKey
            proposalGovernance, // proposal governance Public key
            proposalAddress, // proposal public key
            proposalTokenOwnerRecord, // proposal token owner record, publicKey
            foundRecord.pubkey, // publicKey of tokenOwnerRecord
            generatedWallet.publicKey, // wallet publicKey
            communityMint, //new PublicKey(proposal.governingTokenMint), // proposal governanceMint Authority
            voteDirection,
            fromKeypair.publicKey,
            null,
            null
            // TODO: handle plugin stuff here.
            // plugin?.voterWeightPk,
            //plugin?.maxVoterWeightRecord
          );

          if (ixVote){

            /*
            const meSigner = generatedWallet.publicKey;
            for (var instruction of ixVote){
                for (var key of instruction.keys){
                    if (key.pubkey.toBase58() === meSigner){
                      //key.isSigner = false;
                      //key.isWritable = true;
                    }
                }
            }*/
            
            //console.log("sending Tx "+JSON.stringify(ixVote));
            // 2. If member cast vote
            await createAndSendV0Tx([...ixVote], fromKeypair, generatedWallet);//new PublicKey(generatedPk));

            setRefreshProposals(!refreshProposals);

          }
      }

    }

    

      
  }
    


    setVoteCastLoading(false);
  }

  const handleYesVote = (proposal:PublicKey, governance: PublicKey, tokenOwnerRecord: PublicKey) => {
    handleVote(true, proposal, governance, tokenOwnerRecord);
  }
  const handleNoVote = (proposal:PublicKey, governance: PublicKey, tokenOwnerRecord: PublicKey) => {
    handleVote(false, proposal, governance, tokenOwnerRecord);
  }

  const handleEmailChange = (text:string) => {
    
    const regex = /[^\w]+/g;
    const filteredInput = text.replace(regex, '');
    setEmailAddress(filteredInput)
  };

  function ViewActiveProposalsForDAO(props:any) {
    const realmPk = props.address;
    const [proposalLoading, setProposalLoading] = React.useState(false);
    const [participatingGovernanceProposalsRecordRows, setParticipatingGovernanceProposalsRecordRows] = React.useState(null);
    const [generatedParticipation, setGeneratedParticipation] = React.useState(null);
    const [thisRealm, setThisRealm] = React.useState(null);
    
    const fetchGovernanceProposals = async () => {
      setProposalLoading(true);

      const rlm = await getRealm(RPC_CONNECTION, new PublicKey(realmPk));

      setThisRealm(rlm);
      const gprops = await getAllProposals(RPC_CONNECTION, rlm.owner, new PublicKey(realmPk))

      const rpcprops = new Array();
      for (const props of gprops){
          for (const prop of props){
              if (prop){
                  if (prop.account.state === 2){
                      rpcprops.push(prop);
                      //console.log("prop: "+JSON.stringify(prop))
                      /*
                      if (prop.account.governingTokenMint.toBase58() === selectedCommunityMint){
                          rpcprops.push(prop);
                      } else if (prop.account.governingTokenMint.toBase58() === selectedCouncilMint){
                          rpcprops.push(prop);
                      }*/
                  }
              }
          }
      }
      const sortedRPCResults = rpcprops.sort((a:any, b:any) => ((b.account?.draftAt != null ? b.account?.draftAt : 0) - (a.account?.draftAt != null ? a.account?.draftAt : 0)))
      
      setParticipatingGovernanceProposalsRecordRows(sortedRPCResults);
      
      const voteRecords = await getVoteRecordsByVoter(RPC_CONNECTION, rlm.owner, generatedWallet.publicKey);
      //console.log("voteRecords "+JSON.stringify(voteRecords));
      setGeneratedParticipation(voteRecords);
      
      //console.log("sortedRPCResults: "+JSON.stringify(sortedRPCResults));
      setProposalLoading(false);
  } 

  React.useEffect(() => {
    if (realmPk && !proposalLoading){
        fetchGovernanceProposals();
    }
    //if (realmPk && !proposalLoading && refreshProposals)
    //  fetchGovernanceProposals();
}, [realmPk, refreshProposals]);


    return (
      <Box
          sx={{
              width:'100%',
              mt: 6,
              background: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '17px',
              p: 4,
              alignItems: 'center', textAlign: 'center'
          }} 
      > 
        {proposalLoading ?
          <><CircularProgress /></>
        :
        <>
          {thisRealm ?
            <>
              <Typography variant="h4">{thisRealm?.account?.name}</Typography>
            </>
          :
            <>
              <Typography variant="h4">{realmPk}</Typography>
            </>
          }

          {participatingGovernanceProposalsRecordRows && (participatingGovernanceProposalsRecordRows
            //.filter((item: any) => 
            //    item.account.data?.parsed?.info?.tokenAmount?.amount > 0
            //)
            //.sort((a: any, b: any) => 
            //    b.account.data.parsed.info.tokenAmount.amount - a.account.data.parsed.info.tokenAmount.amount
            //)
            .map((item: any, key: number) => {
                
                return (
                        <Grid container
                            key={key}
                            alignItems="center"
                        >
                          {console.log("participatingGovernanceProposalsRecordRows: "+JSON.stringify(participatingGovernanceProposalsRecordRows))}
                            <Grid item xs={12}>
                            <Grid container>
                                <Grid item sm={8}>
                                <Grid
                                    container
                                    direction="row"
                                    justifyContent="left"
                                    alignItems="left"
                                >
                                  <Typography variant="h5">
                                    {item.account.name}
                                    <Tooltip title="Explore Proposal Details">
                                      <IconButton aria-label="disconnect" size="small" 
                                        href={`https://governance.so/proposal/${frictionlessDao}/${item.pubkey.toBase58()}`}
                                        target='blank'
                                        sx={{ml:1}}>
                                        <OpenInNewIcon fontSize="inherit" />
                                      </IconButton>
                                    </Tooltip>
                                  </Typography>
                                  <Typography variant="caption" sx={{textAlign:'left'}}>
                                    {item.account.descriptionLink}
                                  </Typography>
                                </Grid>
                                </Grid>
                                <Grid item xs sx={{textAlign:'center'}}>
                                    {voteCastLoading ?
                                      <CircularProgress />
                                    :
                                    <>
                                      {(generatedParticipation && generatedParticipation.length > 0 && generatedParticipation.map((gitem) => {
                                          return (gitem.account.proposal.toBase58() === item.pubkey.toBase58() &&
                                                  gitem.account.governingTokenOwner.toBase58() === generatedWallet.publicKey.toBase58()
                                                  );
                                      })) ?
                                        <>
                                          <Button
                                            variant="outlined"
                                            color="success"
                                            disabled
                                          >You have participated in this proposal</Button>
                                        </>
                                      :
                                        <ButtonGroup>
                                          <Button
                                            onClick={(e) => handleYesVote(item.pubkey, item.account.governance, item.account.tokenOwnerRecord)}
                                            color="success"
                                          >VOTE YES</Button>
                                          <Button
                                            onClick={(e) => handleNoVote(item.pubkey, item.account.governance, item.account.tokenOwnerRecord)}
                                            color="error"
                                          >VOTE NO</Button>

                                        </ButtonGroup>
                                      }
                                    </>
                                    }
                                </Grid>
                            </Grid>  
                            </Grid>
                        </Grid>
                );
            }))}
        </>
        }


      </Box>
    );
  }

  const handleLogout = async () => {
    setLoading(true)
    setPinCode(null);
    setEmailAddress(null);
    setGeneratedWallet(null);
    //await openlogin.logout();
    setLoading(false)
  };
  return (
    <>
    <Box
        sx={{
            width:'100%',
            mt: 6,
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '17px',
            p: 2,
            pt: 4,
            pb: 4,
            alignItems: 'center', textAlign: 'center',
            backgroundImage: `url(${FRICTIONLESS_BG})`,
            backgroundRepeat: "repeat",
            backgroundSize: "cover",
        }} 
    > 
      
      <Typography variant="h1" sx={{ textAlign: "center" }}>Frictionless Governance</Typography>
      <Divider>
        <Chip label="Grape x Solana" />
      </Divider>

      <Box
      sx={{
        background: `rgba(0, 0, 0, 0.8)`,
        borderRadius: '17px',
        m:2,
        p: 4}}
    > 


    {
    loading ?
      <div>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "center", alignItems: "center", margin: 20 }}>
              <CircularProgress />
          </div>
      </div> :
      <div>
        {
          (generatedWallet) ?
            <>
                    <p>
                      <Box
                        sx={{
                            width:'100%',
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '17px',
                            alignItems: 'center', textAlign: 'center'
                        }} 
                      > 
                        <Typography variant="h6">Blockchain Frictionless Address</Typography>
                        <Typography variant="caption">
                            <ButtonGroup>
                              <ExplorerView
                                address={generatedWallet.publicKey.toBase58()} type='address'
                                shorten={8}
                                hideTitle={false} style='text' color='white' fontSize='12px'/>
                            
                              <Tooltip title="Disconnect">
                                <Button aria-label="disconnect" color="inherit" variant="text" onClick={handleLogout} sx={{ml:1}}>
                                  <LinkOffIcon fontSize="inherit" />
                                </Button>
                              </Tooltip>
                            </ButtonGroup>
                        </Typography>
                        <Divider />
                        <Typography variant="h6"
                          sx={{
                            background: '-webkit-linear-gradient(90deg,#cf8d7c,#a77cb4)',
                            backgroundClip: 'text',
                            color: 'transparent',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >Smooth. Friendly. Intuitive.</Typography>
                        <Typography variant="caption">Solana Governance participation has never been more intuitive and easy for anyone to use, cast your vote for any eligible & active proposals now and be part of Blockchain history</Typography>
                        
                      </Box>
                    </p>

                    <p>
                      <ViewActiveProposalsForDAO address={frictionlessDao} />
                    </p>
            </>
             :
                
                <div className="loginContainer">
                    <Typography variant="h6"
                          sx={{
                            background: '-webkit-linear-gradient(90deg,#cf8d7c,#a77cb4)',
                            backgroundClip: 'text',
                            color: 'transparent',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}
                        >Natural. Easy. Accessible.</Typography>
                    <Typography variant="caption">This is how Governance on any Blockchain should be. Designed for anyone to participate!
                    <br/>To get started enter your email & a pin code</Typography>
                        
                    <FormControl fullWidth  sx={{mt:1,mb:2}}>
                      <TextField
                        label="Email"
                        onChange={(e) => handleEmailChange(e.target.value)}
                        type="email"
                      />
                    </FormControl>
                    <FormControl fullWidth  sx={{mb:2}}>
                      <TextField
                        label="Pin"
                        onChange={(e) => setPinCode(e.target.value)}
                        type="number"
                      />
                    </FormControl>
                    <FormControl fullWidth>
                      <Button 
                          variant="contained"
                          onClick={handleLogin}
                          disabled={!emailAddress || !pinCode}  
                        >
                          <LinkIcon sx={{mr:1}}/> Connect &amp; Participate
                      </Button>
                    </FormControl>
                </div>
        }

      </div>
    }

      </Box>
    </Box>
    </>
  );
}

export default GrapeFrictionless;