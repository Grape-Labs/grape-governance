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

import {
    tryGetRealmConfig,
    getRealmConfig,
    getRealmConfigAddress,
    Realm,
    withCastVote,
    Vote,
    VoteChoice,
    VoteKind,
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

import { VsrClient } from './client';
import { RPC_CONNECTION } from '../../../../utils/grapeTools/constants';  

export const getVotingPlugin = async (
    selectedRealm: any,
    communityMint: any,
    walletPubkey: any,
    voterWeightAddin:any,
  ) => {
    const options = AnchorProvider.defaultOptions();//AnchorProvider.defaultOptions();
    
    const provider = new AnchorProvider(
        RPC_CONNECTION,
        walletPubkey,
        options
    );
    
    
    //const pluginPk =
    //  votingPop === 'community'
    //    ? realmConfig?.account.communityTokenConfig.voterWeightAddin
    //    : realmConfig?.account.councilTokenConfig.voterWeightAddin
    

    //const client = await VsrClient.connect(provider, false);

    const client = await VsrClient.connect(provider, voterWeightAddin, false);
    const clientProgramId = client!.program.programId;

    //const vwa = selectedRealm?.account?.communityTokenConfig?.voterWeightAddin
    //const vwa2 = selectedRealm?.account?.councilTokenConfig?.voterWeightAddin
    
    //console.log("vwa "+vwa?.toBase58())
    //console.log("vwa2 "+vwa2?.toBase58())

    console.log("clientProgramId "+clientProgramId.toBase58())
    
    console.log("realm: "+new PublicKey(selectedRealm.pubkey).toBase58());
    console.log("mint: "+communityMint.toBase58());
    
    const { registrar } = await getRegistrarPDA(
      new PublicKey(selectedRealm!.pubkey),
      new PublicKey(communityMint),
      clientProgramId
    );
    //const registrar = new PublicKey("4WQSYg21RrJNYhF4251XFpoy1uYbMHcMfZNLMXA3x5Mp");
    console.log("registrar: "+registrar.toBase58());
    const { voter } = await getVoterPDA(registrar, walletPubkey, clientProgramId);
    console.log("voter: "+voter.toBase58());

    //const { voterWeightPk } = await getVoterWeightRecord(
    //  new PublicKey(selectedRealm!.pubkey),
    //  communityMint,
    //  walletPubkey,
    //  clientProgramId
    //);
    
    const { voterWeightPk } = await getVoterWeightPDA(
      registrar,
      walletPubkey,
      clientProgramId,
    );
    
    const { maxVoterWeightRecord } = await getMaxVoterWeightRecord(
      registrar,
      communityMint,
      clientProgramId
    );

    console.log(walletPubkey.toBase58()+" voterWeightPk: "+voterWeightPk.toBase58());
    console.log(walletPubkey.toBase58()+" maxVoterWeightRecord: "+maxVoterWeightRecord?.toBase58());
    
    /*
    const updateVoterWeightRecordIx = await client!.program.methods
      .updateVoterWeightRecord()
      .accounts({
        registrar,
        voter,
        voterWeightRecord: voterWeightPk,
        systemProgram: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
      })
      .instruction();
    */
    return { voterWeightPk, maxVoterWeightRecord, client, registrar, voter };
}