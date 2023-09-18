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
  getAllProposals,
} from '@solana/spl-governance';

import { chunks } from '../../utils/governanceTools/helpers';

import { AnyMxRecord } from 'dns';

export async function createProposalInstructions(
    token_realm_program_id: PublicKey, 
    realmPk: PublicKey,
    governancePk: PublicKey,
    governingTokenMint: PublicKey,
    walletPk:PublicKey, 
    name:string,
    description:string, 
    connection: any, 
    transactionInstr: Transaction, //: InstructionsAndSignersSet, 
    sendTransaction: any): Promise<Transaction> {
    
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
    const voteType = VoteType.SINGLE_CHOICE;
    const options = ['Approve'];
    const useDenyOption = true;
    console.log("2");
    
    console.log("programId: "+programId.toBase58());
    console.log("realmPk: "+realmPk.toBase58());
    console.log("governingTokenMint: "+governingTokenMint.toBase58());
    console.log("governancePk: "+governancePk.toBase58());
    console.log("walletPk: "+walletPk.toBase58());

    const tokenOwnerRecordPk = await getTokenOwnerRecordAddress(
      programId,
      realmPk,
      governingTokenMint,
      walletPk,
    );
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

    const proposalAddress = await withCreateProposal(
      instructions,
      programId,
      programVersion,
      realmPk,
      governancePk,
      tokenOwnerRecordPk,
      name,
      descriptionLink,
      governingTokenMint,
      walletPk,
      proposalIndex,
      voteType,
      options,
      useDenyOption,
      walletPk,
    );
    
    const insertInstructions: TransactionInstruction[] = [];
    //we don't have any prerequisiteInstructions to execute so we will leave this null
    const prerequisiteInstructions: TransactionInstruction[] = [];

    //loop InsertTransactions based on number of intrsuctions in transactionInstr
    let instructionData: InstructionData[]=[];
    for (var instruction of transactionInstr.instructions){
      instructionData.push(createInstructionData(instruction));
    }
    
    for(let j= 0; j < transactionInstr.instructions.length; j++) {
      await withInsertTransaction(
        insertInstructions,
        programId,
        programVersion,
        governancePk,
        proposalAddress,
        tokenOwnerRecordPk,
        walletPk,
        j,
        0,
        0,
        [instructionData[j]],
        walletPk
      );
    }
    console.log("5")

    withSignOffProposal(
      insertInstructions, // Sign Off proposal needs to be executed after inserting instructions hence we add it to insertInstructions
      programId,
      programVersion,
      realmPk,
      governancePk,
      proposalAddress,
      signatory,
      /*signatoryRecordAddress,
      undefined*/
      undefined,
      tokenOwnerRecordPk
    );
  
    const insertChunks = chunks(insertInstructions, 1);
    const signerChunks = Array(insertChunks.length).fill([]);
    //console.log('connection publicKey:', connection)
    console.log(`Creating proposal using ${insertChunks.length} chunks`);


    return null;
    
    
    
   await sendTransaction(
      connection,
      wallet,
      [prerequisiteInstructions, instructions, ...insertChunks],
      [[], [], ...signerChunks],
      SequenceType.Sequential
    );
  
    //return proposalAddress;
    

}