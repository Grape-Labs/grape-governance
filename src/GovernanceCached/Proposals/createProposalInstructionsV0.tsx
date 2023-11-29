
import { Keypair, PublicKey, TransactionInstruction, Transaction, } from '@solana/web3.js'
import { BN, web3 } from '@project-serum/anchor';

import { 
  getInstructionDataFromBase64,
  Governance,
  ProgramAccount,
  Realm,
  TokenOwnerRecord,
  VoteType,
  withCreateProposal,
  getSignatoryRecordAddress,
  RpcContext,
  withInsertTransaction,
  InstructionData,
  withSignOffProposal,
  withAddSignatory,
  MultiChoiceType,
  getGovernanceProgramVersion,
  getGovernance,
  getTokenOwnerRecordAddress,
  createInstructionData,
} from '@solana/spl-governance';
import { 
  sendTransactionsV3, 
  SequenceType, 
  txBatchesToInstructionSetWithSigners 
} from '../../utils/governanceTools/sendTransactionsV3';
import { chunks } from '../../utils/governanceTools/helpers';
import { UiInstruction } from '../../utils/governanceTools/proposalCreationTypes'

import { sendTransactions, WalletSigner, getWalletPublicKey } from '../../utils/governanceTools/sendTransactions';
//import { AnyMxRecord } from 'dns';

export const deduplicateObjsFilter = (value, index, self) =>
  index === self.findIndex((t) => JSON.stringify(t) === JSON.stringify(value))

export interface InstructionDataWithHoldUpTime {
  data: InstructionData | null
  holdUpTime: number | undefined
  prerequisiteInstructions: TransactionInstruction[]
  chunkBy?: number
  signers?: Keypair[]
  prerequisiteInstructionsSigners?: (Keypair | null)[]
}

export class InstructionDataWithHoldUpTime {
  constructor({
    instruction,
    governance,
  }: {
    instruction: UiInstruction
    governance?: ProgramAccount<Governance>
  }) {
    this.data = instruction.serializedInstruction
      ? getInstructionDataFromBase64(instruction.serializedInstruction)
      : null
    this.holdUpTime =
      typeof instruction.customHoldUpTime !== 'undefined'
        ? instruction.customHoldUpTime
        : governance?.account?.config.minInstructionHoldUpTime
    this.prerequisiteInstructions = instruction.prerequisiteInstructions || []
    this.chunkBy = instruction.chunkBy || 2
    this.prerequisiteInstructionsSigners =
      instruction.prerequisiteInstructionsSigners || []
  }
}



export async function createProposalInstructionsV0(
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
    instructionsData: InstructionDataWithHoldUpTime[],
    isDraft?: boolean,
    ): Promise<any>{//Promise<Transaction> {
    
    //console.log('inDAOProposal instructionArray before adding DAO Instructions:'+JSON.stringify(transactionInstr));
    //let initialInstructions: TransactionInstruction[] = [];
    //let signers: any[] = [];
    //const prerequisiteInstructions: TransactionInstruction[] = []
    const prerequisiteInstructionsSigners: (Keypair | null)[] = []
    // sum up signers
    const signers: Keypair[] = instructionsData.flatMap((x) => x.signers ?? [])

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
    /*const governingTokenMintAuthority = new PublicKey('Dg4LFS33D4jMaSzQVLbFst6PB5svY9KcMHqWyJTth4bM');
    const communityTokenMint = new PublicKey('DGPzmXUt39qwNca5diqsWHK7P9w2jtrP6jNt7MH8AhEq');
    const realmAuthority = new PublicKey('8zhQAf4KmJKBPH1hUT8QCQJEcXF78DdoKHoNqxX3dJDj');*/
    //const realm = await getRealm(connection, realmPk);

    const signatory = walletPk;
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
    console.log("tokenOwnerRecordPk: "+tokenOwnerRecordPk.toBase58())
    console.log("programVersion: "+programVersion)
    console.log("governanceAuthority: "+governanceAuthority.toBase58())
    
    // we have the following already cached so this should be passed:
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

    //const signatory = walletPk
    const payer = walletPk
    
    //will run only if plugin is connected with realm
    /*
    const plugin = await client?.withUpdateVoterWeightRecord(
      instructions,
      tokenOwnerRecordPk,
      'createProposal',
      createNftTicketsIxs
    )*/

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
      governanceAuthority,
      proposalIndex,
      voteType,
      options,
      useDenyOption,
      payer,
      //plugin?.voterWeightPk
    );

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

    const chunkBys = instructionsData
    .filter((x) => x.chunkBy)
    .map((x) => x.chunkBy!)

    const lowestChunkBy = chunkBys.length ? Math.min(...chunkBys) : 2

    for (const [index, instruction] of instructionsData
      .filter((x) => x.data)
      .entries()) {
      if (instruction.data) {
        if (instruction.prerequisiteInstructions) {
          prerequisiteInstructions.push(...instruction.prerequisiteInstructions)
        }
        if (instruction.prerequisiteInstructionsSigners) {
          prerequisiteInstructionsSigners.push(
            ...instruction.prerequisiteInstructionsSigners
          )
        }
        await withInsertTransaction(
          insertInstructions,
          programId,
          programVersion,
          //governance,
          governancePk,
          proposalAddress,
          //tokenOwnerRecord.pubkey,
          tokenOwnerRecordPk,
          governanceAuthority,
          index,
          0,
          instruction.holdUpTime || 0,
          [instruction.data],
          payer
        )
      }
    }
/*    
    if (authTransaction){
      //let authinstructionData: InstructionData[]=[];
      //for (var authinstruction of authTransaction.instructions){
        //instructionData.push(createInstructionData(authinstruction));
      //}
      //for(let r= 0; r < authTransaction.instructions.length; r++) {
        //authInstructions.push(authTransaction[r]);
      //}
    }
      

    //loop InsertTransactions based on number of intrsuctions in transactionInstr
    
    let instructionData: InstructionData[]=[];
    for (var instruction of transactionInstr.instructions){
      const cid = createInstructionData(instruction);
      //console.log("Pushing: "+JSON.stringify(instruction).length);
      //const tx = new Transaction();
      //tx.add(instruction);
      //console.log("Tx Size: "+tx.serialize().length);
      instructionData.push(cid);
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

    if (authTransaction && authTransaction.instructions.length > 0){
      for (var instruction of authTransaction.instructions){ 
        instructions.push(instruction)
        //instructions.unshift(instruction);
      }
    }
*/

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
    
    /*const insertChunks = chunks(insertInstructions, 1);
    const signerChunks = Array(insertChunks.length).fill([]);*/
    const insertChunks = chunks(insertInstructions, lowestChunkBy)
    const signerChunks = Array(insertChunks.length)
    //console.log('connection publicKey:', connection)
    //console.log(`Creating proposal using ${insertChunks.length} chunks`);
    signerChunks.push(...chunks(signers, lowestChunkBy))
    signerChunks.fill([])
    //return null;
    const deduplicatedPrerequisiteInstructions = prerequisiteInstructions.filter(
      deduplicateObjsFilter
    )
  
    const deduplicatedPrerequisiteInstructionsSigners = prerequisiteInstructionsSigners.filter(
      deduplicateObjsFilter
    )
  
    const prerequisiteInstructionsChunks = chunks(
      deduplicatedPrerequisiteInstructions,
      lowestChunkBy
    )
  
    const prerequisiteInstructionsSignersChunks = chunks(
      deduplicatedPrerequisiteInstructionsSigners,
      lowestChunkBy
    ).filter((keypairArray) => keypairArray.filter((keypair) => keypair))
  
    const signersSet = [
      ...prerequisiteInstructionsSignersChunks,
      [],
      ...signerChunks,
    ]


    if (!sendTransaction){
      
      console.log(`Sending Transactions...`);
      try{

        //console.log("instructions: "+JSON.stringify(instructions));

        const txes = [
            ...prerequisiteInstructionsChunks,
            instructions,
            ...insertChunks,
          ].map((txBatch, batchIdx) => {
            return {
              instructionsSet: txBatchesToInstructionSetWithSigners(
                txBatch,
                signersSet,
                batchIdx
              ),
              sequenceType: SequenceType.Sequential,
            }
          })
        let transactionSuccess = false;
        try {
          const stresponse =  await sendTransactionsV3({
              connection, 
              wallet, 
              transactionInstructions: txes
              //[prerequisiteInstructions, instructions, ...insertChunks],
          });
          // Assuming `sendTransactionsV3` resolves to a meaningful value on success
          transactionSuccess = true;
          console.log('Transaction successful:', transactionSuccess);
        } catch (error) {
          // Handle errors here
          transactionSuccess = false;
          console.log('Transaction failed:', transactionSuccess);
        }           
        /*stresponse
        .then((result) => {
          // Handle the successful result here
          transactionSuccess = true;
          console.log('Transaction successful:', transactionSuccess);
          
        })
        .catch((error) => {
          // Handle errors here
          transactionSuccess = false;
          console.error('Transaction failed:', transactionSuccess);       
        });*/
        const response = {
            address:proposalAddress,
            transactionSuccess
        };
        return response;

      } catch(e){
        console.log("ERR: ", e)
        if (proposalAddress){
          const response = {
            address:proposalAddress,
            transactionSuccess:false
          };
        } else{
          return null;
        }
      }
    } else {
      // return transaction instructions here
    }
}