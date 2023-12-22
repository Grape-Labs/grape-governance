
import { PublicKey, SystemProgram, TransactionInstruction, Transaction, } from '@solana/web3.js'
import { BN, web3 } from '@project-serum/anchor';

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
  withCreateProposal,
  VoteType, 
  getGovernanceProgramVersion,
  serializeInstructionToBase64,
  createInstructionData,
  withInsertTransaction,
  InstructionData,
  AccountMetaData,
  getRealm,
  withSignOffProposal,
  withAddSignatory,
  getSignatoryRecordAddress,
  getAllProposals,
  MultiChoiceType,
} from '@solana/spl-governance';

import { 
  getRealmIndexed,
  getProposalIndexed,
  getProposalNewIndexed,
  getAllProposalsIndexed,
  getGovernanceIndexed,
  getAllGovernancesIndexed,
  getAllTokenOwnerRecordsIndexed,
  getTokenOwnerRecordsByOwnerIndexed,
  getProposalInstructionsIndexed
} from '../api/queries';

import { chunks } from '../../utils/governanceTools/helpers';
import { sendTransactions, prepareTransactions, SequenceType, WalletSigner, getWalletPublicKey } from '../../utils/governanceTools/sendTransactions';

import { AnyMxRecord } from 'dns';

export async function createProposalInstructionsLegacy(
    token_realm_program_id: PublicKey, 
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
    editAddress?: PublicKey): Promise<any>{//Promise<Transaction> {
    
    //console.log('inDAOProposal instructionArray before adding DAO Instructions:'+JSON.stringify(transactionInstr));
    //let initialInstructions: TransactionInstruction[] = [];
    let signers: any[] = [];

    let instructions: TransactionInstruction[] = [];
    const programId = new PublicKey(token_realm_program_id);
    const programVersion = await getGovernanceProgramVersion(
      connection,
      programId,
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
    
    const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
      programId,
      realmPk,
      governingTokenMint,
      walletPk,
    );

    const governanceAuthority = walletPk
    console.log("programId: "+programId.toBase58());
    console.log("realmPk: "+realmPk.toBase58());
    console.log("governingTokenMint: "+governingTokenMint.toBase58());
    console.log("governancePk: "+governancePk.toBase58());
    console.log("walletPk: "+walletPk.toBase58());
    console.log("payer: "+payer.toBase58());
    console.log("tokenOwnerRecordPk: "+tokenOwnerRecordPk.toBase58())
    console.log("programVersion: "+programVersion)
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

    if (!editAddress){
      proposalAddress = await withCreateProposal(
        instructions,
        programId,
        programVersion,
        realmPk,
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
        //plugin?.voterWeightPk
      );
    

      console.log("Proposal Address: "+JSON.stringify(proposalAddress))
      
      await withAddSignatory(
        instructions,
        programId,
        programVersion,
        proposalAddress,
        tokenOwnerRecordPk,
        governanceAuthority,
        signatory,
        payer
      )
      
      
    } else{
      proposalAddress = editAddress;
      console.log("Editing Proposal");

      const ix = await getProposalInstructionsIndexed(realmPk.toBase58(), proposalAddress);
      if (ix && ix.length > 0) { 
        ixCount = ix.length;
      } 
      
      if (ix && ix.length > 0 && ix[0]?.account?.instructions && ix[0].account.instructions.length > 0){
        console.log("ixCount: "+ixCount)
        if (ixCount <= 1){
          ixCount = 0;
          ixCount = ix[0].account.instructions.length;
        }
      }
    }

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
      //const tx = new Transaction();
      //tx.add(instruction);
      //console.log("Tx Size: "+tx.serialize().length);
      instructionData.push(cid);
    }
    
    for(let j= 0; j < transactionInstr.instructions.length; j++) {

      //console.log("ixCount: "+ixCount);
      //console.log("j: "+j);
      console.log("At Ix Index: "+(ixCount+j));
      
      await withInsertTransaction(
        insertInstructions,
        programId,
        programVersion,
        governancePk,
        proposalAddress,
        tokenOwnerRecordPk,
        walletPk,
        ixCount+j,
        0,
        0,
        [instructionData[j]],
        walletPk
      );
    }
    console.log("5");

    if (authTransaction && authTransaction.instructions.length > 0){
      for (var instruction of authTransaction.instructions){ 
        //prerequisiteInstructions.push(instruction);
        //instructions.push(instruction)
        //instructions.unshift(instruction);
      }
    }

    console.log("6");
    
    if (!isDraft){
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
    
    if (!returnTx){
      
      console.log(`Sending Transactions...`);
      try{

        console.log("instructions: "+JSON.stringify(instructions));

        const stresponse = await sendTransactions(
            connection,
            wallet,
            [prerequisiteInstructions, instructions, ...insertChunks],
            [[], [], ...signerChunks],
            SequenceType.Sequential
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