import { PublicKey } from '@solana/web3.js';
import { GovernanceAccountParser, Realm, RealmConfigAccount, TokenOwnerRecord } from '@solana/spl-governance';
import bs58 from 'bs58';
import BigNumber from 'bignumber.js';
import { providerRequest } from './provider.js';

export const GOVERNANCE_PROGRAM = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';
export function governanceAddresses(realm, mint, wallet) {
  const program = new PublicKey(GOVERNANCE_PROGRAM);
  const seeds = [Buffer.from('governance'),new PublicKey(realm).toBuffer(),new PublicKey(mint).toBuffer()];
  return {
    record:PublicKey.findProgramAddressSync([...seeds,new PublicKey(wallet).toBuffer()],program)[0].toBase58(),
    holding:PublicKey.findProgramAddressSync(seeds,program)[0].toBase58(),
    config:PublicKey.findProgramAddressSync([Buffer.from('realm-config'),new PublicKey(realm).toBuffer()],program)[0].toBase58(),
  };
}
const decode = (type, address, info) => {
  if (!info || info.owner !== GOVERNANCE_PROGRAM || !Array.isArray(info.data)) throw new Error('Unsupported governance account');
  return GovernanceAccountParser(type)(new PublicKey(address), {...info,owner:new PublicKey(info.owner),data:Buffer.from(info.data[0],'base64')}).account;
};
export async function governanceSnapshot(realm, mint, wallet, addresses) {
  const data = await providerRequest('balance',key=>`https://mainnet.helius-rpc.com/?api-key=${key}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getMultipleAccounts',params:[[realm,mint,addresses.record,addresses.config],{encoding:'base64',commitment:'finalized'}]}),
  });
  const [realmInfo,mintInfo,recordInfo,configInfo] = data.result.value;
  const realmAccount = decode(Realm,realm,realmInfo);
  if (realmAccount.communityMint.toBase58() !== mint) throw new Error('Wrong community mint');
  if (configInfo) {
    const config = decode(RealmConfigAccount,addresses.config,configInfo);
    if (config.realm.toBase58() !== realm) throw new Error('Wrong realm config');
    if (config.communityTokenConfig?.voterWeightAddin) throw new Error('Voter-weight plugins are not supported');
  } else if (realmAccount.config?.useCommunityVoterWeightAddin) throw new Error('Voter-weight plugins are not supported');
  if (mintInfo?.owner !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') throw new Error('Unsupported token program');
  const mintData = Buffer.from(mintInfo.data[0],'base64');
  if (mintData.length < 82) throw new Error('Invalid mint');
  const decimals = mintData[44];
  const record = recordInfo ? decode(TokenOwnerRecord,addresses.record,recordInfo) : null;
  if (record && (record.realm.toBase58() !== realm || record.governingTokenMint.toBase58() !== mint || record.governingTokenOwner.toBase58() !== wallet)) throw new Error('Wrong governance record');
  const slot = data.result.context?.slot;
  if (!Number.isSafeInteger(slot)) throw new Error('Missing finalized slot');
  return {slot,decimals,position:new BigNumber(record?.governingTokenDepositAmount.toString() ?? '0').shiftedBy(-decimals).toFixed()};
}
export function governanceChanges(transactions, realm, mint, wallet, addresses, decimals) {
  return transactions.flatMap(tx=>{
    if (tx.transactionError) return [];
    const rows=[];
    let index=0;
    const visit=instructions=>{
      for (const ix of instructions || []) {
        const id=`${tx.signature}:${index++}`;
        if (ix.programId === GOVERNANCE_PROGRAM && ix.accounts?.includes(addresses.record)) {
          let kind='unknown', amount='0';
          try {
            const data=bs58.decode(ix.data);
            const op=data[0], a=ix.accounts;
            if (op===1 && data.length===9 && a[0]===realm && a[1]===addresses.holding && a[3]===wallet && a[5]===addresses.record) kind='deposit';
            else if (op===2 && data.length===1 && a[0]===realm && a[1]===addresses.holding && a[3]===wallet && a[4]===addresses.record) kind='withdraw';
            else if (op===26 && data.length===9 && a[0]===realm && a[1]===addresses.holding && a[2]===addresses.record && a[3]===mint) kind='revoke';
            else if (op===23 && data.length===1 && a[0]===realm && a[1]===wallet && a[2]===addresses.record && a[3]===mint) kind='create';
            // Other known governance instructions do not change token deposits.
            else if (Number.isInteger(op) && op<=29 && ![1,2,23,26].includes(op)) kind=null;
            if (kind==='deposit'||kind==='revoke') amount=new BigNumber(Buffer.from(data).readBigUInt64LE(1).toString()).shiftedBy(-decimals).toFixed();
          } catch { /* Unknown records make the assessment unavailable. */ }
          if(kind) rows.push({id,signature:tx.signature,slot:tx.slot,timestamp:tx.timestamp,kind,amount});
        }
        visit(ix.innerInstructions);
      }
    };
    if (!Array.isArray(tx.instructions)) return [{id:tx.signature,signature:tx.signature,slot:tx.slot,kind:'unknown'}];
    visit(tx.instructions);
    return rows.reverse();
  });
}

// Vote records store the power actually used, including delegated votes. Missing
// records are retained as unavailable rather than zero votes; relinquished votes are labeled.
export async function governanceVotes(transactions, realm, mint, wallet, addresses, decimals) {
  const casts=[];
  const visit=(instructions,tx)=>{
    for(const ix of instructions||[]){
      try {
        const a=ix.accounts||[];
        if(ix.programId===GOVERNANCE_PROGRAM && bs58.decode(ix.data)[0]===13 &&
            a[0]===realm && a[4]===addresses.record && a[7]===mint) {
          casts.push({record:a[6],proposal:a[2],signature:tx.signature,timestamp:tx.timestamp,slot:tx.slot});
        }
      }catch{ /* Not a cast-vote instruction. */ }
      visit(ix.innerInstructions,tx);
    }
  };
  for(const tx of transactions)if(!tx.transactionError)visit(tx.instructions,tx);
  const unique=Array.from(new Map([...casts].reverse().map(c=>[c.record,c])).values()).sort((a,b)=>b.slot-a.slot);
  if(!unique.length)return [];
  const {VoteRecord,Proposal}=await import('@solana/spl-governance');
  const results=[];
  // getMultipleAccounts accepts at most 100 addresses.
  for(let offset=0;offset<unique.length;offset+=50){
    const batch=unique.slice(offset,offset+50);
    let values=[];
    try {
      const data=await providerRequest('balance',key=>`https://mainnet.helius-rpc.com/?api-key=${key}`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getMultipleAccounts',params:[batch.flatMap(c=>[c.record,c.proposal]),{encoding:'base64',commitment:'finalized'}]}),
      });
      values=data.result.value;
    }catch{ /* Preserve cast evidence even when enrichment fails. */ }
    for(const [i,cast] of batch.entries()){
      let name=null, weight=null, choice=null, relinquished=null;
      try{
        const proposal=decode(Proposal,cast.proposal,values[i*2+1]);
        if(proposal.governingTokenMint.toBase58()!==mint)throw new Error();
        name=proposal.name;
        const record=decode(VoteRecord,cast.record,values[i*2]);
        if(record.proposal.toBase58()!==cast.proposal || record.governingTokenOwner.toBase58()!==wallet)throw new Error();
        ({weight,choice,relinquished}=summarizeVote(record,proposal,decimals));
      }catch{weight=null;choice=null;}
      results.push({...cast,name,weight,choice,relinquished});
    }
  }
  return results;
}

export function summarizeVote(record, proposal, decimals) {
  const raw=record.voterWeight??record.voteWeight?.yes??record.voteWeight?.no;
  const amount=raw!=null?new BigNumber(raw.toString()).shiftedBy(-decimals):null;
  const weight=amount?.isFinite() && !amount.isNegative()?amount.toFixed():null;
  let choice=record.vote ? (['Approve','Deny','Abstain','Veto'][record.vote.voteType]??'Unknown') :
    record.voteWeight?.yes!=null?'Approve':record.voteWeight?.no!=null?'Deny':'Unknown';
  if(record.vote?.choices?.length && choice==='Approve'){
    choice=record.vote.choices.map((c,index)=>c.weightPercentage>0?`${proposal.options?.[index]?.label||`Option ${index+1}`}: ${c.weightPercentage}%`:null).filter(Boolean).join(', ');
  }
  return {weight,choice,relinquished:record.isRelinquished};
}
