
import { Keypair, PublicKey, TransactionInstruction, Transaction, AddressLookupTableProgram} from '@solana/web3.js'
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
  getGovernance,
  getTokenOwnerRecordAddress,
  createInstructionData,
  pubkeyFilter, 
  getGovernanceAccounts,
  ProposalTransaction,
} from '@solana/spl-governance';
import { getGrapeGovernanceProgramVersion } from '../../utils/grapeTools/helpers';
import { 
  sendTransactionsV3, 
  SequenceType, 
  txBatchesToInstructionSetWithSigners 
} from '../../utils/governanceTools/sendTransactionsV3';
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

import { chunks } from '../../utils/governanceTools/helpers';
import { UiInstruction } from '../../utils/governanceTools/proposalCreationTypes'

import { sendTransactions, WalletSigner, getWalletPublicKey } from '../../utils/governanceTools/sendTransactions';
//import { AnyMxRecord } from 'dns';
import { sendSignAndConfirmTransactions } from '../../utils/governanceTools/v0_tools/modifiedMangolana'

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
    returnTx?: boolean,
    payer?: PublicKey,
    editAddress?: PublicKey,
    callbacks?: Parameters<typeof sendTransactionsV3>[0]['callbacks']
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

    const SECONDS_PER_DAY = 86400
    function getTimestampFromDays(days: number) {
      return days * SECONDS_PER_DAY
    }
    const getDefaultInstructionProps = (
      x: UiInstruction,
      selectedGovernance: ProgramAccount<Governance> | null
    ) => ({
      holdUpTime: x.customHoldUpTime
        ? getTimestampFromDays(x.customHoldUpTime)
        : selectedGovernance?.account?.config.minInstructionHoldUpTime,
      prerequisiteInstructions: x.prerequisiteInstructions || [],
      signers: x.signers,
      prerequisiteInstructionsSigners: x.prerequisiteInstructionsSigners || [],
      chunkBy: x.chunkBy || 2,
    })
    //will run only if plugin is connected with realm
    /*const voterWeight = await withUpdateVoterWeightRecord(
      instructions,
      wallet.publicKey!,
      realm,
      client
    );*/
      
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
      //const ix = await getProposalInstructionsIndexed(realmPk.toBase58(), proposalAddress);
      
      const ix = await getGovernanceAccounts(
        connection,
        new PublicKey(programId),
        ProposalTransaction,
        [pubkeyFilter(1, new PublicKey(proposalAddress))!]
      );
      
      
      console.log("Editing Proposal");
      
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
   
    let UiInstructions: UiInstruction[] = []
    //console.log('instructionsData: '+JSON.stringify(instructionsData));
    const additionalInstructions = UiInstructions//instructionsData[0].data.data.
    .flatMap((instruction) =>
      instruction.additionalSerializedInstructions
        ?.filter(
          (value, index, self) =>
            index === self.findIndex((t) => t === value)
        )
        .map((x) => ({
          data: x ? getInstructionDataFromBase64(x) : null,
          ...getDefaultInstructionProps(instruction, governance),
        }))
    )
    .filter((x) => x) as InstructionDataWithHoldUpTime[]

    const insertInstructions: TransactionInstruction[] = [];
    //we don't have any prerequisiteInstructions to execute so we will leave this null
    const prerequisiteInstructions: TransactionInstruction[] = [];
    //const authInstructions: TransactionInstruction[] = [];
    const allInstructionsData = [
      ...additionalInstructions,
      ...instructionsData,
    ]
    
    //const chunkBys = instructionsData
    const chunkBys = allInstructionsData
    .filter((x) => x.chunkBy)
    .map((x) => x.chunkBy!)

    const lowestChunkBy = chunkBys.length ? Math.min(...chunkBys) : 2

    //console.log('additionalInstructions: ', additionalInstructions);
    //console.log('allInstructionData: ', allInstructionsData);
    for (const [index, instruction] of allInstructionsData//instructionsData
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
    //console.log('insertInstructions: ',insertInstructions);

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
        /////////////////////////////////////////////////////////
        //START ADDITIONAL CODE FROM createLUTproposals
        ////////////////////////////////////////////////////////
        const keys = txes
        .map((x) =>
          x.instructionsSet.map((y) =>
            y.transactionInstruction.keys.map((z) => z.pubkey)
          )
        )
        .flat()
        .flat()
        //start lookup implementation
        const slot = await connection.getSlot()
        const [
          lookupTableInst,
          lookupTableAddress,
        ] = AddressLookupTableProgram.createLookupTable({
          authority: payer,
          payer: payer,
          recentSlot: slot,
        })
        //end lookup implementation
        // add addresses to the `lookupTableAddress` table via an `extend` instruction
        // need to split into multiple instructions because of the ~20 address limit
        // https://docs.solana.com/developing/lookup-tables#:~:text=NOTE%3A%20Due%20to,transaction%27s%20memory%20limits.
        // const extendInstruction = AddressLookupTableProgram.extendLookupTable({
        //   payer: payer,
        //   authority: payer,
        //   lookupTable: lookupTableAddress,
        //   addresses: keys,
        // })
        //start lookup implementation
        const extendInstructions = chunks(keys, 15).map((chunk) =>
          AddressLookupTableProgram.extendLookupTable({
            payer: payer,
            authority: payer,
            lookupTable: lookupTableAddress,
            addresses: chunk,
          })
        )
        //end lookup implementation
        // Send this `extendInstruction` in a transaction to the cluster
        // to insert the listing of `addresses` into your lookup table with address `lookupTableAddress`
        //start lookup implementation
        console.log('lookup table address:', lookupTableAddress.toBase58())
        let resolve = undefined
        const promise = new Promise((r) => {
          //@ts-ignore
          resolve = r
        })
        // TODO merge all into one call of sendSignAndConfirmTransactions, so the user only signs once
        await sendSignAndConfirmTransactions({
          connection,
          wallet,
          transactionInstructions: [
            {
              instructionsSet: [{ transactionInstruction: lookupTableInst }],
              sequenceType: SequenceType.Sequential,
            },
            ...extendInstructions.map((x) => {
              return {
                instructionsSet: [{ transactionInstruction: x }],
                sequenceType: SequenceType.Sequential,
              }
            }),
          ],
          callbacks: {
            afterAllTxConfirmed: resolve,
          },
        })
        await promise
        
        const lookupTableAccount = await connection
          .getAddressLookupTable(lookupTableAddress, { commitment: 'singleGossip' })
          .then((res) => res.value)
        if (lookupTableAccount === null) throw new Error()
        //end lookup implementation
        ////////////////////////////////////////////////////
        //END ADDITIONAL CODE FROM createLUTproposals  
        ///////////////////////////////////////////////////
        let transactionSuccess = false;
        try {
          const stresponse = await sendTransactionsV3({
            callbacks,
            connection,
            wallet,
            transactionInstructions: txes,
            lookupTableAccounts: [lookupTableAccount],
            //if not using lookuptable implementation we wouloud pass the variable as below instead
            //lookupTableAccounts: [],
          });
          /*const stresponse =  await sendTransactionsV3({
              connection, 
              wallet, 
              transactionInstructions: txes
              //[prerequisiteInstructions, instructions, ...insertChunks],
          });*/
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