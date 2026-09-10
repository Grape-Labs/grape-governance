import {test} from 'node:test';
import assert from 'node:assert/strict';
import BN from 'bn.js';
import {PublicKey} from '@solana/web3.js';
import {formatVoteWeight,voteProposalTitle} from '../src/Governance/participationFormatting.js';

test('council BN weights are renderable text without unsafe number conversion',()=>{
 assert.equal(formatVoteWeight({voteWeight:new BN('9007199254740993'),proposalMint:'council',communityMint:'community'}),'9,007,199,254,740,993');
});
test('community weights retain decimals and support SDK PublicKey mints',()=>{
 const mint=new PublicKey('11111111111111111111111111111111');
 assert.equal(formatVoteWeight({voteWeight:new BN('1234567890'),proposalMint:mint,communityMint:mint.toBase58(),communityDecimals:6}),'1,234.56789');
 assert.equal(formatVoteWeight({voteWeight:new BN('9007199254740993123456'),proposalMint:'mint',communityMint:'mint',communityDecimals:6}),'9,007,199,254,740,993.123456');
});
test('missing metadata and invalid weights remain safe to render',()=>{
 assert.equal(formatVoteWeight({voteWeight:new BN(42)}),'42');
 assert.equal(formatVoteWeight({}),'0');
 assert.equal(formatVoteWeight({voteWeight:{}}),'—');
 assert.equal(voteProposalTitle({pubkey:new PublicKey('11111111111111111111111111111111')}),'11111111111111111111111111111111');
});
