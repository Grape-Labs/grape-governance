
import { PublicKey, SystemProgram, TransactionInstruction, Transaction, TransactionMessage, VersionedTransaction } from '@solana/web3.js'

import { 
  getRealms, 
  getGovernance,
  getVoteRecordsByVoter, 
  getTokenOwnerRecordAddress,
  getTokenOwnerRecordForRealm, 
  getTokenOwnerRecordsByOwner, 
  getGovernanceAccounts, 
  pubkeyFilter, 
  TokenOwnerRecord, 
  //withCreateProposal,
  VoteType, 
  serializeInstructionToBase64,
  createInstructionData,
  withInsertTransaction,
  withRemoveTransaction,
  InstructionData,
  AccountMetaData,
  getRealm,
  withSignOffProposal,
  withAddSignatory,
  getSignatoryRecordAddress,
  getAllProposals,
  MultiChoiceType,
  ProposalTransaction,
  tryGetRealmConfig,
} from '@solana/spl-governance';
import {
  withCreateProposal,
} from '@realms-today/spl-governance'
import { getGrapeGovernanceProgramVersion } from '../../utils/grapeTools/helpers';
import { 
  getRealmIndexed,
  getProposalIndexed,
  getProposalNewIndexed,
  getAllProposalsIndexed,
  getGovernanceIndexed,
  getAllGovernancesIndexed,
  getAllTokenOwnerRecordsIndexed,
  getTokenOwnerRecordsByRealmIndexed,
  getProposalInstructionsIndexed
} from '../api/queries';

import { getVotingPlugin } from '../../utils/governanceTools/components/instructions/getVotePlugin';
import { 
  RPC_CONNECTION } from '../../utils/grapeTools/constants';  

import { chunks } from '../../utils/governanceTools/helpers';
import { sendTransactions, prepareTransactions, WalletSigner, getWalletPublicKey } from '../../utils/governanceTools/sendTransactions';
import { sendTransactionsV3,
  SequenceType,
  txBatchesToInstructionSetWithSigners
 } from '../../utils/governanceTools/sendTransactionsV3';
import { sendVersionedTransactions } from '../../utils/governanceTools/sendVersionedTransactions';



import { AnyMxRecord } from 'dns';

async function simulateInstructions(connection, instructions, payerPublicKey) {
  try {
      // Fetch the latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

      // Create a transaction message
      const messageV0 = new TransactionMessage({
          payerKey: payerPublicKey,
          recentBlockhash: blockhash,
          instructions: instructions,
      }).compileToV0Message();

      // Create a versioned transaction for simulation
      const transaction = new VersionedTransaction(messageV0);

      // Simulate the transaction
      const simulationResult = await connection.simulateTransaction(transaction);

      if (simulationResult.value.err) {
          console.error("Simulation failed with error:", simulationResult.value.err);
          return JSON.stringify(simulationResult.value.err);
          //throw new Error(`Simulation failed: ${JSON.stringify(simulationResult.value.err)}`);
      }

      console.log("Simulation successful:", simulationResult.value);
      return simulationResult.value;
  } catch (error) {
      console.error("Error simulating transaction:", error);
      throw error;
  }
}

export async function createProposalInstructionsLegacy(
    programId: PublicKey, 
    realmPk: PublicKey,
    governancePk: PublicKey,
    governingTokenMint: PublicKey,
    walletPk:PublicKey, 
    name:string,
    description:string, 
    connection: any, 
    transactionInstr: Transaction, //: InstructionsAndSignersSet, 
    authTransaction: Transaction,
    wallet: WalletSigner,
    sendTransaction: any,
    isDraft?: boolean,
    returnTx?: boolean,
    payer?: PublicKey,
    editAddress?: PublicKey,
    successCallback?: any,
    failCallback?: any,
    startIndex?: number,
  ): Promise<any>{//Promise<Transaction> {

    //console.log('inDAOProposal instructionArray before adding DAO Instructions:'+JSON.stringify(transactionInstr));
    //let initialInstructions: TransactionInstruction[] = [];
    let signers: any[] = [];

    let instructions: TransactionInstruction[] = [];
    
    const programVersion = await getGrapeGovernanceProgramVersion(
      connection,
      programId,
      realmPk
    );

    //const realmPk = new PublicKey('DcR6g5EawaEoTRYcnuBjtD26VSVjWNoi1C1hKJWwvcup');
    //const governancePk = new PublicKey('JAbgQLj9MoJ2Kvie8t8Y6z6as3Epf7rDp87Po3wFwrNK');
    //const name = name;
    const descriptionLink = description;
    //const governingTokenMint = new PublicKey('9Z7SQ1WMiDNaHu2cX823sZxD2SQpscoLGkyeLAHEqy9r');
    //const walletPk = new PublicKey(walletPublicKey);
    
    //extras
    const governingTokenMintAuthority = new PublicKey('Dg4LFS33D4jMaSzQVLbFst6PB5svY9KcMHqWyJTth4bM');
    const communityTokenMint = new PublicKey('DGPzmXUt39qwNca5diqsWHK7P9w2jtrP6jNt7MH8AhEq');
    const realmAuthority = new PublicKey('8zhQAf4KmJKBPH1hUT8QCQJEcXF78DdoKHoNqxX3dJDj');
    //const realm = await getRealm(connection, realmPk);

    const signatory = walletPk;
    console.log("1");
    //extra
    //const solTreasury = new PublicKey(COLLABORATION_SOL_TREASURY);
    //const communityTokenMint = realm?.account?.communityMint;
    //const realmAuthority = realm?.account?.authority;

    // Explicitly request the version before making RPC calls to work around race conditions in resolving
    // the version for RealmInfo
    
    // V2 Approve/Deny configuration
    const options = ['Approve'];
    const isMulti = options.length > 1
    const useDenyOption = !isMulti
    
    const voteType = isMulti
    ? VoteType.MULTI_CHOICE(
        MultiChoiceType.FullWeight,
        1,
        options.length,
        options.length
      )
    : VoteType.SINGLE_CHOICE

    console.log("2");
    
    let tokenOwnerRecordPk = null;
    
    if (editAddress){
      const governanceRulesIndexed = await getAllGovernancesIndexed(realmPk.toBase58(), programId.toBase58());
      const governanceRulesStrArr = governanceRulesIndexed.map(item => item.pubkey.toBase58());
      const gp = await getProposalIndexed(governanceRulesStrArr, null, realmPk.toBase58(), editAddress.toBase58());
      tokenOwnerRecordPk = gp?.account?.tokenOwnerRecord;
    }

    if (!tokenOwnerRecordPk){
      tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
        programId,
        realmPk,
        governingTokenMint,
        walletPk,
      );
      if (tokenOwnerRecordPk)
        console.log("Using getTokenOwnerRecordAddress: "+tokenOwnerRecordPk.toBase58());
    }

    if (!tokenOwnerRecordPk){
      console.log("no token owner record pk... fetching proposal");

      const memberMap = await getAllTokenOwnerRecordsIndexed(realmPk.toBase58(), null, walletPk.toBase58());
      for (let member of memberMap){
          if (new PublicKey(member.account.governingTokenOwner).toBase58() === walletPk.toBase58() &&
              new PublicKey(member.account.governingTokenMint).toBase58() === governingTokenMint.toBase58()){
            // check if same token owner also
            //console.log("member found: "+JSON.stringify(member));
            tokenOwnerRecordPk = new PublicKey(member.pubkey);
          }
      }
    }

    const governanceAuthority = walletPk
    console.log("programId: "+programId.toBase58());
    console.log("programVersion: "+programVersion);
    console.log("realmPk: "+realmPk.toBase58());
    console.log("governingTokenMint: "+governingTokenMint.toBase58());
    console.log("governancePk: "+governancePk.toBase58());
    console.log("walletPk: "+walletPk.toBase58());
    console.log("payer: "+payer.toBase58());
    console.log("tokenOwnerRecordPk: "+tokenOwnerRecordPk.toBase58())
    console.log("governanceAuthority: "+governanceAuthority.toBase58())
    
    // we have the following already cached so this should be passed:
    console.log("3");
    const governance = await getGovernance(connection, governancePk);
    
    console.log("governance: "+JSON.stringify(governance));
    
    const proposalIndex = governance?.account?.proposalCount;

    //will run only if plugin is connected with realm
    /*const voterWeight = await withUpdateVoterWeightRecord(
      instructions,
      wallet.publicKey!,
      realm,
      client
    );*/

    console.log("4");
    
    //const signatory = walletPk
    //const payer = walletPk
    
    //will run only if plugin is connected with realm
    /*
    const plugin = await client?.withUpdateVoterWeightRecord(
      instructions,
      tokenOwnerRecordPk,
      'createProposal',
      createNftTicketsIxs
    )*/
    let proposalAddress = null;
    let ixCount = 0;
    
    console.log("editAddress "+JSON.stringify(editAddress));
    
    if (!editAddress){
      console.log("Creating Proposal");
      let votePlugin = null;
      let hasVoterWeight = false;
      
      const selectedRealmIndexed = await getRealmIndexed(realmPk.toBase58());
      
      if (selectedRealmIndexed?.account?.config?.useCommunityVoterWeightAddin){
        console.log("Has Voter Weight Plugin!");
        hasVoterWeight = true;
      }

      let hasMaxVoterWeight = false;
      if (selectedRealmIndexed?.account?.config?.useMaxCommunityVoterWeightAddin){
        console.log("Has MAX Voter Weight Addin!");
        hasMaxVoterWeight = true;
      }

      const realmConfig = await tryGetRealmConfig(RPC_CONNECTION, new PublicKey(selectedRealmIndexed.owner), new PublicKey(selectedRealmIndexed.pubkey));
      
      if (realmConfig){
        
        // checking plugin
        console.log("realmConfig: "+JSON.stringify(realmConfig));
        
          if (hasVoterWeight || realmConfig?.account?.communityTokenConfig?.voterWeightAddin){
            console.log("vwa: "+realmConfig.account.communityTokenConfig.voterWeightAddin.toBase58())
            
            votePlugin = await getVotingPlugin(
                selectedRealmIndexed,
                governingTokenMint,
                walletPk,
                realmConfig.account.communityTokenConfig.voterWeightAddin
            )
            
            //console.log("Vote Plugin: "+JSON.stringify(votePlugin))
            
            if (votePlugin){
              console.log("Using Voter Plugin");
            } else {
              console.log("No Voter Plugin");
            }
          
        } else{
          console.log("No Voter/Max Voter Weight Set");
        }
      }
      
      proposalAddress = await withCreateProposal(
        instructions,
        programId,
        programVersion,
        realmPk!,
        governancePk,
        tokenOwnerRecordPk,
        name,
        descriptionLink,
        governingTokenMint,
        governanceAuthority,
        proposalIndex,
        voteType,
        options,
        useDenyOption,
        payer,
        votePlugin?.voterWeightPk
      );
      
      console.log("Proposal Address: "+proposalAddress.toBase58());
      
      await withAddSignatory(
        instructions,
        programId,
        programVersion,
        proposalAddress,
        tokenOwnerRecordPk,
        governanceAuthority,
        signatory,
        payer
      );

      console.log("Signatory added: "+signatory.toBase58());
      
      // simulate this
      const simulationResult = await simulateInstructions(RPC_CONNECTION, instructions, payer)
      console.log("🔍 - Simulation result:", simulationResult);

    } else {
      console.log("Editing Proposal");
      proposalAddress = editAddress;
      
      // revert to use this when SHYFT properly adjusts the total ix
      //const ix = await getProposalInstructionsIndexed(realmPk.toBase58(), proposalAddress);
      
      const ix = await getGovernanceAccounts(
        connection,
        new PublicKey(programId),
        ProposalTransaction,
        [pubkeyFilter(1, new PublicKey(proposalAddress))!]
      );

      //console.log("ix: "+JSON.stringify(ix));
      for (var ixItem of ix){
        if (ixCount - 1 < ixItem.account.instructionIndex){
          ixCount = ixItem.account.instructionIndex + 1;
        }
      } 

      console.log("Last Ix Index: "+ixCount);
      
      if (ixCount <= 0){
        if (ix && ix.length > 0) { 
          ixCount = ix.length;
          console.log("1 setting here with ix: "+ixCount);
        } 
        
        if (ix && ix.length > 0 && ix[0]?.account?.instructions && ix[0].account.instructions.length > 0){
          if (ixCount <= 1){
            ixCount = 0;
            ixCount = ix[0].account.instructions.length;
            console.log("2 setting here with ix: "+ixCount);
          
          }
        }
      }
    }

    console.log("proposal Address: "+proposalAddress.toBase58())

    // TODO: Return signatoryRecordAddress from the SDK call
    const signatoryRecordAddress = await getSignatoryRecordAddress(
      programId,
      proposalAddress,
      signatory
    )
    
    const insertInstructions: TransactionInstruction[] = [];
    //we don't have any prerequisiteInstructions to execute so we will leave this null
    const prerequisiteInstructions: TransactionInstruction[] = [];
    //const authInstructions: TransactionInstruction[] = [];

    if (authTransaction){
      //console.log("auth: "+JSON.stringify(authTransaction))
      
      /*
      let authinstructionData: InstructionData[]=[];
      for (var authinstruction of authTransaction.instructions){
        instructionData.push(createInstructionData(authinstruction));
      }
      */
      //for(let r= 0; r < authTransaction.instructions.length; r++) {
        //authInstructions.push(authTransaction[r]);
      //}
    }
      

    //loop InsertTransactions based on number of intrsuctions in transactionInstr
    let instructionData: InstructionData[]=[];
    for (var instruction of transactionInstr.instructions){
      const cid = createInstructionData(instruction);
      console.log("Pushing: "+JSON.stringify(instruction).length);
      instructionData.push(cid);
    }
    

    for(let j= 0; j < transactionInstr.instructions.length; j++) {
      
      //console.log("ixCount: "+ixCount);
      //console.log("j: "+j);
      //console.log("At Ix Index: "+(ixCount+j));

      let startTxIndex = startIndex || 0;

      if (startTxIndex > 0){
        if (ixCount+j > startTxIndex-2)
          startTxIndex = startTxIndex-2;
        else
          startTxIndex = startTxIndex-1;
      }

      if (j >= startTxIndex){ // we are adding this in case ix fails and we need to retry with remaining instructions
        
        console.log("Inserting tx: "+j);

        await withInsertTransaction(
          insertInstructions,
          programId,
          programVersion,
          governancePk,
          proposalAddress,
          tokenOwnerRecordPk,
          walletPk,
          ixCount+j-startTxIndex,
          0,
          0,
          [instructionData[j]],
          walletPk
        );

      }
    }
    console.log("5");

    if (authTransaction && authTransaction.instructions.length > 0){
      for (var instruction of authTransaction.instructions){ 
        prerequisiteInstructions.push(instruction);
        //instructions.push(instruction)
        //instructions.unshift(instruction);
      }
    }

    console.log("6");
    
    if (!isDraft || isDraft === null || isDraft === undefined){
      withSignOffProposal(
        insertInstructions, // Sign Off proposal needs to be executed after inserting instructions hence we add it to insertInstructions
        programId,
        programVersion,
        realmPk,
        governancePk,
        proposalAddress,
        signatory,
        signatoryRecordAddress,
        undefined,
        /*signatoryRecordAddress,
        undefined,
        undefined,
        tokenOwnerRecordPk*/
      );
    }
    
    const insertChunks = chunks(insertInstructions, 1);
    const signerChunks = Array(insertChunks.length).fill([]);
    //console.log('connection publicKey:', connection)
    console.log(`Creating proposal using ${insertChunks.length} chunks`);

    //return null;
    
    if (!returnTx || returnTx === null || returnTx === undefined){
      
      console.log(`Sending Transactions...`);
      try{

        console.log("instructions: "+JSON.stringify(instructions));

        /*
        const stresponsev3 = await sendTransactionsV3(
          connection,
          wallet,
          instructions,
        );*/



        const stresponse = await sendTransactions(
            connection,
            wallet,
            [prerequisiteInstructions, instructions, ...insertChunks],
            [[], [], ...signerChunks],
            SequenceType.Sequential,
            null,
            successCallback,
            failCallback,
            startIndex,
          );

          console.log(`Proposal: ${JSON.stringify(proposalAddress)}`);
          console.log(`Sending complete: ${JSON.stringify(stresponse)}`);

          const response = {
            address:proposalAddress,
            response:stresponse
          };
          
          return response;
      } catch(e){
        console.log("ERR: ", e)
        if (proposalAddress){
          const response = {
            address:proposalAddress,
            response:null
          };
        } else{

          // we should attempt to continue here where dropped off?
          failCallback();

          return null;
        }
      }
    } else {

      const transactionResponse = await prepareTransactions(
        connection,
        wallet,
        [prerequisiteInstructions, instructions, ...insertChunks],
        [[], [], ...signerChunks],
        SequenceType.Sequential
      );


      /*
      // return transaction instructions here
      const transaction = new Transaction();
      if (instructions && instructions.length > 0){
        transaction.add(...instructions);
        transaction.add(...insertInstructions);
      } else {
        console.log("Intra DAO: No Ix set!")
      }
      return transaction;
      */

      return transactionResponse;
    }
    //return proposalAddress;
    

}