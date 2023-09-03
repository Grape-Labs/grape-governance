import {
    PublicKey,
    ConfirmedSignatureInfo,
    Connection,
    LAMPORTS_PER_SOL,
    Keypair,
    Transaction,
    TransactionInstruction,
    sendAndConfirmTransaction,
  } from "@solana/web3.js";
  
//  import { SPL_PUBLIC_KEY, RPC_CONNECTION } from "../constants/Solana";
import { RPC_CONNECTION } from '../../../../utils/grapeTools/constants';  

import {
  Realm,
  withCastVote,
  Vote,
  VoteChoice,
  VoteKind,
  getGovernanceProgramVersion,
  GOVERNANCE_CHAT_PROGRAM_ID,
} from "@solana/spl-governance";
// plugin stuff
import { Wallet } from "@project-serum/anchor";
import { VsrClient } from "@blockworks-foundation/voter-stake-registry-client/index";
import {
  getRegistrarPDA,
  getVoterPDA,
  getVoterWeightPDA,
} from "./account";
// end plugin stuff
  
const connection = RPC_CONNECTION;

export const createCastVoteTransaction = async (
    selectedRealm: Realm,
    walletPublicKey: PublicKey,
    transactionData: any,
    membersMapItem: any,
    selectedDelegate: string,
    isCommunityVote: boolean,
    multiChoice: any,
    type: Number
) => {
    const { proposal, action } = transactionData;
    const walletPubkey = new PublicKey(walletPublicKey);
    let tokenOwnerRecord = null;
    const governanceAuthority = walletPubkey;
    
    //console.log("walletPublicKey "+walletPubkey.toBase58())

    //console.log("membersMapItem: "+JSON.stringify(membersMapItem));

    //if (membersMap[walletPubkey.toBase58()] && !selectedDelegate) {
    if (membersMapItem){
      tokenOwnerRecord = membersMapItem;//membersMap[walletPubkey.toBase58()];
    } else {
      if (selectedDelegate)
        tokenOwnerRecord = membersMapItem;// membersMap[selectedDelegate];
    }

    //console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecord));
    
    if (tokenOwnerRecord){
      console.log("isCommunityVote "+isCommunityVote)
      //console.log("tokenOwnerRecord?.communityPublicKey "+tokenOwnerRecord?.communityPublicKey)
      //console.log("tokenOwnerRecord?.councilPublicKey "+tokenOwnerRecord?.councilPublicKey)

      const tokenRecordPublicKey = tokenOwnerRecord?.pubkey;//.account?.governingTokenMint;
      
      //console.log("tokenRecordPublicKey: "+tokenRecordPublicKey)

      //isCommunityVote
      //  ? tokenOwnerRecord?.communityPublicKey
      //  : tokenOwnerRecord?.councilPublicKey;
    
      const payer = walletPubkey;
      const instructions: TransactionInstruction[] = [];
      let programVersion = null;
    
      // metaplex dao fails this and needs to be harcoded for now

      //console.log("realm: "+JSON.stringify(selectedRealm));

      if (new PublicKey(selectedRealm.pubkey).toBase58() === "DA5G7QQbFioZ6K33wQcH8fVdgFcnaDjLD7DLQkapZg5X") {
        programVersion = 2;
      } else {
        programVersion = await getGovernanceProgramVersion(
          connection,
          new PublicKey(selectedRealm.owner)
        );
      }
    
      // PLUGIN STUFF
      // let votePlugin;
      // // TODO: update this to handle any vsr plugin, rn only runs for mango dao
      // if (
      //   selectedRealm?.realmId ===
      //   "DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE"
      // ) {
      //   votePlugin = await getVotingPlugin(
      //     selectedRealm,
      //     walletKeypair,
      //     new PublicKey(tokenOwnerRecord.walletId),
      //     instructions
      //   );
      // }
      // END PLUGIN STUFF
      

      //console.log("programId: "+selectedRealm.owner);
      
      //console.log("programVersion: "+programVersion)
      //console.log("selectedRealm.owner: "+selectedRealm.owner)
      //console.log("selectedRealm.pubkey: "+selectedRealm.pubkey)
      //console.log("proposal.governanceId: "+proposal.governanceId)
      //console.log("proposal.proposalId: "+proposal.proposalId)
      //console.log("proposal.tokenOwnerRecord: "+proposal.tokenOwnerRecord)
      //console.log("proposal.governingTokenMint: "+proposal.governingTokenMint)
      //console.log("tokenRecordPublicKey: "+JSON.stringify(tokenRecordPublicKey))
      //console.log("vote type: "+JSON.stringify(Vote.fromYesNoVote(action)));
      
      console.log("multiChoice: " +multiChoice);

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
        


      //will run only if any plugin is connected with realm
      /*
      const plugin = await votingPlugin?.withCastPluginVote(
        instructions,
        proposal,
        tokenOwnerRecord
      )*/

      /*
      const vote = voteKind === VoteKind.Approve
      ? new Vote({
          voteType: VoteKind.Approve,
          approveChoices: [new VoteChoice({ rank: 0, weightPercentage: 100 })],
          deny: undefined,
          veto: undefined,
        })
      : voteKind === VoteKind.Deny
      ? new Vote({
          voteType: VoteKind.Deny,
          approveChoices: undefined,
          deny: true,
          veto: undefined,
        })
      : voteKind == VoteKind.Veto
      ? new Vote({
          voteType: VoteKind.Veto,
          veto: true,
          deny: undefined,
          approveChoices: undefined,
        })
      : new Vote({
          voteType: VoteKind.Abstain,
          veto: undefined,
          deny: undefined,
          approveChoices: undefined,
        })
        */

      //console.log("selectedRealm: "+JSON.stringify(selectedRealm));
      //console.log("voteDirection: "+JSON.stringify(voteDirection));
      
      await withCastVote(
        instructions,
        new PublicKey(selectedRealm!.owner), //  realm/governance PublicKey
        programVersion, // version object, version of realm
        new PublicKey(selectedRealm!.pubkey), // realms publicKey
        new PublicKey(proposal.governanceId), // proposal governance Public key
        new PublicKey(proposal.proposalId), // proposal public key
        new PublicKey(proposal.tokenOwnerRecord), // proposal token owner record, publicKey
        new PublicKey(tokenRecordPublicKey), // publicKey of tokenOwnerRecord
        governanceAuthority, // wallet publicKey
        new PublicKey(proposal.governingTokenMint), // proposal governanceMint Authority
        voteDirection,
        //Vote.fromYesNoVote(action), //  *Vote* class? 1 = no, 0 = yes
        payer,
        null,
        null
        // TODO: handle plugin stuff here.
        // plugin?.voterWeightPk,
        //plugin?.maxVoterWeightRecord
      );

      console.log("HERE after withCastVote")

      const recentBlock = await connection.getLatestBlockhash();
    
      //const transaction = new Transaction({ feePayer: walletPubkey });
      const transaction = new Transaction();
      transaction.feePayer = walletPubkey;
      transaction.recentBlockhash = recentBlock.blockhash;
      transaction.add(...instructions);
      
      return transaction;
    } else{
        return null;
    }


  };
  
  const getVotingPlugin = async (
    selectedRealm: any,
    walletKeypair: any,
    walletPubkey: any,
    instructions: any
  ) => {
    const options = Provider.defaultOptions();//AnchorProvider.defaultOptions();
    const provider = new Provider(
      connection,
      walletKeypair as unknown as Wallet,
      options
    );
    const client = await VsrClient.connect(provider, false);
    const clientProgramId = client!.program.programId;
    const { registrar } = await getRegistrarPDA(
      new PublicKey(selectedRealm!.realmId),
      new PublicKey(selectedRealm!.communityMint),
      clientProgramId
    );
    const { voter } = await getVoterPDA(registrar, walletPubkey, clientProgramId);
    const { voterWeightPk } = await getVoterWeightPDA(
      registrar,
      walletPubkey,
      clientProgramId
    );
  
    const updateVoterWeightRecordIx = await client!.program.methods
      .updateVoterWeightRecord()
      .accounts({
        registrar,
        voter,
        voterWeightRecord: voterWeightPk,
        systemProgram: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
      })
      .instruction();
  
    return { voterWeightPk, maxVoterWeightRecord: undefined };
};