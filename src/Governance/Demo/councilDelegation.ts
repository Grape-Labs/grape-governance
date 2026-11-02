import { PublicKey, Transaction } from '@solana/web3.js';
import { getRealm, getAllTokenOwnerRecords, withSetGovernanceDelegate } from '@solana/spl-governance';
import { RPC_CONNECTION } from '../../utils/grapeTools/constants';
import { getGrapeGovernanceProgramVersion } from '../../utils/grapeTools/helpers';
import { getGrapeProposalEligibility } from '../api/grapeProposalEligibility';
import { councilDelegationAccess, councilDelegationMembers } from './councilDelegationPolicy';

export async function loadCouncilDelegation(realmAddress: string) {
    const realm = await getRealm(RPC_CONNECTION, new PublicKey(realmAddress));
    const records = await getAllTokenOwnerRecords(RPC_CONNECTION, realm.owner, realm.pubkey);
    return { realm, records };
}
export async function checkCouncilRecipient(realmAddress: string, recipient: string) {
    const checks = await getGrapeProposalEligibility(RPC_CONNECTION, new PublicKey(realmAddress), new PublicKey(recipient));
    // The shared checks are also used by proposal creation; use delegation-specific copy here.
    const clean = (check: { passed: boolean; message: string }) => ({ ...check,
        message: check.message.replace(/to create a proposal/g, 'to receive council delegation') });
    return { verification: clean(checks.verification), reputation: clean(checks.reputation) };
}
export async function prepareCouncilDelegation(realmAddress: string, owner: string, recipient: string | null) {
    // Re-read chain state immediately before asking the wallet to sign.
    const { realm, records } = await loadCouncilDelegation(realmAddress);
    const access = councilDelegationAccess(realm, records, owner);
    if (!access.owned.length) throw new Error('Only the council token owner can change this delegation.');
    if (recipient) {
        if (recipient === owner) throw new Error('Choose another DAO member, or revoke your delegation.');
        if (!councilDelegationMembers(realm, records).includes(recipient)) throw new Error('The recipient must be an existing DAO member with deposited governing tokens.');
        const checks = await checkCouncilRecipient(realmAddress, recipient);
        const failures = [checks.verification, checks.reputation].filter(check => !check.passed);
        if (failures.length) throw new Error(failures.map(check => check.message).join(' '));
    }
    const version = await getGrapeGovernanceProgramVersion(RPC_CONNECTION, realm.owner, realm.pubkey);
    const instructions = [];
    await withSetGovernanceDelegate(instructions, realm.owner, version, realm.pubkey,
        new PublicKey(access.councilMint), new PublicKey(owner), new PublicKey(owner), recipient ? new PublicKey(recipient) : null);
    const transaction = new Transaction().add(...instructions);
    const blockhash = await RPC_CONNECTION.getLatestBlockhash('confirmed');
    transaction.feePayer = new PublicKey(owner);
    transaction.recentBlockhash = blockhash.blockhash;
    return { transaction, blockhash };
}
export async function confirmCouncilDelegation(signature: string, blockhash: { blockhash: string; lastValidBlockHeight: number }) {
    const result = await RPC_CONNECTION.confirmTransaction({ signature, ...blockhash }, 'confirmed');
    if (result.value.err) throw new Error('The delegation transaction failed on chain.');
}
