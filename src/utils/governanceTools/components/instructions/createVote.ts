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
  import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
  
import { GatewayClient } from '@solana/governance-program-library/dist'  

//  import { SPL_PUBLIC_KEY, RPC_CONNECTION } from "../constants/Solana";
import { RPC_CONNECTION } from '../../../../utils/grapeTools/constants';  

import {
  tryGetRealmConfig,
  getRealmConfig,
  getRealmConfigAddress,
  Realm,
  withCastVote,
  Vote,
  VoteChoice,
  VoteKind,
  getGovernanceProgramVersion,
  GOVERNANCE_CHAT_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "@solana/spl-governance";


import {
  NFT_PLUGINS_PKS,
  getRegistrarPDA,
  getVoterPDA,
  getVoterWeightRecord,
  getVoterWeightPDA,
  getMaxVoterWeightRecord,
} from "./account";
// end plugin stuff

import { getVotingPlugin } from './getVotePlugin';

const connection = RPC_CONNECTION;

export const createCastVoteTransaction = async (
    selectedRealm: any,
    walletPublicKey: PublicKey,
    transactionData: any,
    membersMapItem: any,
    selectedDelegate: string,
    isCommunityVote: boolean,
    multiChoice: any,
    type: Number,
    //votePlugin?: VotingClient | undefined
) => {
    const { proposal, action } = transactionData;
    const walletPubkey = new PublicKey(walletPublicKey);
    let tokenOwnerRecord = null;
    const governanceAuthority = walletPubkey;
    
    //const { wallet } = useWallet(); 

    console.log("walletPublicKey "+walletPubkey.toBase58())

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
      console.log("tokenOwnerRecord: "+JSON.stringify(tokenOwnerRecord))

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

      //if (new PublicKey(selectedRealm!.pubkey).toBase58() === "DA5G7QQbFioZ6K33wQcH8fVdgFcnaDjLD7DLQkapZg5X") {
      //  programVersion = 2;
      //} else {
        programVersion = await getGovernanceProgramVersion(
          connection,
          new PublicKey(selectedRealm!.owner)
        );
      //}
      
      // PLUGIN STUFF
      const realmConfig = await tryGetRealmConfig(RPC_CONNECTION, new PublicKey(selectedRealm.owner), new PublicKey(selectedRealm.pubkey));
      //console.log("realm config "+JSON.stringify(config));
      /*
      const configPk = await getRealmConfigAddress(selectedRealm.owner, selectedRealm.pubkey)
      console.log("configPk "+JSON.stringify(configPk));
      if (configPk){
        const configRc = await getRealmConfig(RPC_CONNECTION, configPk);
        console.log("realm configRc "+JSON.stringify(configRc));
      }*/

      let votePlugin = null;
      // // TODO: update this to handle any vsr plugin, rn only runs for mango dao
      
      //console.log("selectedRealm: "+JSON.stringify(selectedRealm))
      
      let hasVoterWeight = false;
      if (selectedRealm?.account?.config?.useCommunityVoterWeightAddin){
        console.log("Has Voter Weight Plugin!");
        hasVoterWeight = true;
      }

      let hasMaxVoterWeight = false;
      if (selectedRealm?.account?.config?.useMaxCommunityVoterWeightAddin){
        console.log("Has MAX Voter Weight Addin!");
        hasMaxVoterWeight = true;
      }

      if (hasVoterWeight || realmConfig?.account?.communityTokenConfig?.voterWeightAddin){
        console.log("vwa: "+realmConfig.account.communityTokenConfig.voterWeightAddin.toBase58())
        //if (selectedRealm.pubkey === "DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE") {
          votePlugin = await getVotingPlugin(
            selectedRealm,
            proposal.governingTokenMint,
            walletPublicKey,
            realmConfig.account.communityTokenConfig.voterWeightAddin
          );
          
          //console.log("Vote Plugin: "+JSON.stringify(votePlugin))

          if (votePlugin){
            const updateVoterWeightRecordIx = await votePlugin.client.program.methods
              .updateVoterWeightRecord()
              .accounts({
                registrar: votePlugin.registrar,
                voter: votePlugin.voter,
                voterWeightRecord: votePlugin.voterWeightPk,
                systemProgram: SYSTEM_PROGRAM_ID,
              })
              .instruction()

              instructions.push(updateVoterWeightRecordIx);
          }else{
            return null;
          }
        //}
      }

      const isNftPlugin = config?.account.communityTokenConfig.voterWeightAddin && NFT_PLUGINS_PKS.includes(config?.account.communityTokenConfig.voterWeightAddin?.toBase58())
      
      const createCastNftVoteTicketIxs: TransactionInstruction[] = []
      const pluginCastVoteIxs: TransactionInstruction[] = []

      let nftPlugin = null;
      if (isNftPlugin){
        /*
        nftPlugin = await votePlugin?.withCastPluginVote(
          pluginCastVoteIxs,
          proposal,
          tokenOwnerRecord,
          createCastNftVoteTicketIxs
        )*/
        return false;
      }

      if (new PublicKey(selectedRealm.pubkey).toBase58() === "652CA3GEcZjxVvEjCiMeAxuyFG6GaPHZeN6yh4cNJ1Ns"){
        console.log("hard coded nft com...")
        return null;
      }
      // END PLUGIN STUFF
      
      //console.log("programId: "+selectedRealm.owner);
      /*
      console.log("programVersion: "+programVersion)
      console.log("selectedRealm.owner: "+selectedRealm.owner)
      console.log("selectedRealm.pubkey: "+selectedRealm.pubkey)
      console.log("proposal.governanceId: "+proposal.governanceId)
      console.log("proposal.proposalId: "+proposal.proposalId)
      console.log("proposal.tokenOwnerRecord: "+proposal.tokenOwnerRecord)
      console.log("proposal.governingTokenMint: "+proposal.governingTokenMint)
      console.log("tokenRecordPublicKey: "+JSON.stringify(tokenRecordPublicKey))
      console.log("vote type: "+JSON.stringify(Vote.fromYesNoVote(action)));
      console.log("votePlugin?.voterWeightPk: "+JSON.stringify(votePlugin?.voterWeightPk));
      console.log("votePlugin?.maxVoterWeightRecord: "+JSON.stringify(votePlugin?.maxVoterWeightRecord));
      console.log("multiChoice: " +multiChoice);
      */
    
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
      
      /*
      const pluginAddresses = await votingPlugin?.withCastPluginVote(
        instructions,
        proposal,
        new PublicKey(tokenRecordPublicKey)
        //createCastNftVoteTicketIxs
      )*/

      //console.log("votePlugin: "+JSON.stringify(votePlugin));
      
      /*
      const pluginAddresses = await votingPlugin?.withCastPluginVote(
        instructions,
        proposal,
        proposal.tokenOwnerRecord
        //createCastNftVoteTicketIxs
      )*/

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
        voteDirection, //Vote.fromYesNoVote(action), //  *Vote* class? 1 = no, 0 = yes
        payer,
        hasVoterWeight ? votePlugin?.voterWeightPk : nftPlugin ? nftPlugin?.voterWeightPk : votePlugin?.voterWeightPk,
        hasMaxVoterWeight ? votePlugin?.maxVoterWeightRecord : nftPlugin ? nftPlugin?.maxVoterWeightRecord : votePlugin?.maxVoterWeightRecord
      );

      //console.log("HERE after withCastVote")
      
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

}