import { governanceAddresses, governanceSnapshot, governanceChanges } from '../src/server/grants/governance-position.js';
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { analyzePayments, analyzeRecipient } from '../src/server/grants/analyze.js';

import { providerRequest, ProviderError } from '../src/server/grants/provider.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const query = req.query || {};
  const { wallet, mint, mode, before } = query;
  try {
    for (const key of [wallet, mint, ...(mode === 'governance' ? [query.realm] : [])]) {
      if (typeof key !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)) throw new Error();
      new PublicKey(key);
    }
    if (!['payments','recipient','balance','governance'].includes(mode)) throw new Error();
    if (before && (typeof before !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(before))) throw new Error();
    if (mode === 'recipient' && (!/^\d+$/.test(query.since) || Number(query.since) <= 0)) throw new Error();
  } catch {
    return res.status(400).json({error:'Enter valid wallet and mint addresses and a valid tracking date.'});
  }
  try {
    if (mode === 'governance') {
      const addresses = governanceAddresses(query.realm,mint,wallet);
      let snapshot;
      if (before) {
        const slot=Number(query.positionSlot), decimals=Number(query.decimals);
        if (!Number.isSafeInteger(slot)||slot<=0||!Number.isInteger(decimals)||decimals<0||decimals>255) {
          return res.status(400).json({error:'Invalid governance history cursor. Reopen wallet activity.'});
        }
        snapshot={slot,decimals};
      } else {
        snapshot=await governanceSnapshot(query.realm,mint,wallet,addresses);
      }
      const url=new URL(`https://api-mainnet.helius-rpc.com/v0/addresses/${addresses.record}/transactions`);
      url.searchParams.set('limit','100');
      url.searchParams.set('commitment','finalized');
      url.searchParams.set('sort-order','desc');
      url.searchParams.set('lte-slot',String(snapshot.slot));
      if(before) url.searchParams.set('before-signature',before);
      const transactions=await providerRequest('history',key=>`${url}&api-key=${key}`);
      const next=transactions.length===100?transactions.at(-1).signature:null;
      res.setHeader('Cache-Control','no-store');
      return res.status(200).json({changes:governanceChanges(transactions,query.realm,mint,wallet,addresses,snapshot.decimals),snapshot,next});
    }
    if (mode === 'balance') {
      const data = await providerRequest('balance', key => `https://mainnet.helius-rpc.com/?api-key=${key}`, {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccountsByOwner',params:[wallet,{mint},{encoding:'jsonParsed',commitment:'finalized'}]}),
      });
      if (data.error || !Array.isArray(data.result?.value)) throw new Error();
      const balance = data.result.value.reduce((sum, account) => {
        const token = account.account.data.parsed.info.tokenAmount;
        return sum.plus(new BigNumber(token.amount).shiftedBy(-token.decimals));
      }, new BigNumber(0));
      res.setHeader('Cache-Control','private, max-age=30');
      return res.status(200).json({balance:balance.toFixed()});
    }
    const url = new URL(`https://api-mainnet.helius-rpc.com/v0/addresses/${wallet}/transactions`);
    url.searchParams.set('limit','100');
    if (before) url.searchParams.set('before-signature',before);
    if (mode === 'recipient') {
      url.searchParams.set('token-accounts','balanceChanged');
      url.searchParams.set('commitment','finalized');
      url.searchParams.set('sort-order','desc');
    }
    const transactions=await providerRequest('history', key => `${url}&api-key=${key}`);
    if (!Array.isArray(transactions)) throw new Error();
    const oldest=transactions.at(-1);
    const reachedDate = mode === 'recipient' && oldest?.timestamp < Number(query.since);
    const next = transactions.length === 100 && !reachedDate ? oldest.signature : null;
    let rows=mode === 'payments' ? analyzePayments(transactions,wallet,mint) : analyzeRecipient(transactions,wallet,mint,Number(query.since));
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({rows,next,scanned:transactions.length,oldest:oldest?.timestamp || null});
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    if (error instanceof ProviderError) {
      return res.status(error.status).json({error:error.message, code:error.code});
    }
    return res.status(502).json({error:mode === 'governance' ? 'Governance position unavailable. The DAO may use an unsupported voting plugin, or its history could not be loaded.' : 'The transaction provider returned an unexpected response. Please retry.', code:'PROVIDER_RESPONSE_INVALID'});
  }
}
