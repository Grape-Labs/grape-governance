import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { analyzePayments, analyzeRecipient } from '../src/server/grants/analyze.js';

let workingKey;

async function providerRequest(makeUrl, options = {}) {
  const keys = [...new Set([
    process.env.GRANT_TRACKING_HELIUS_API_KEY, workingKey,
    process.env.REACT_APP_API_HELIUS, process.env.REACT_APP_API_HELIUS_BKP2,
    process.env.REACT_APP_API_HELIUS_BKP3, process.env.REACT_APP_API_HELIUS_BKP4,
  ].filter(Boolean))];
  const deadline = Date.now() + 11000;
  for (const key of keys) {
    if (Date.now() >= deadline) break;
    try {
      const response = await fetch(makeUrl(encodeURIComponent(key)), {
        ...options, signal: AbortSignal.timeout(Math.min(2500, deadline - Date.now())),
      });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.error) continue;
      workingKey = key;
      return data;
    } catch { /* Try another configured key; never log credentials. */ }
  }
  throw new Error('Provider unavailable');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  const query = req.query || {};
  const { wallet, mint, mode, before } = query;
  try {
    for (const key of [wallet, mint]) {
      if (typeof key !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(key)) throw new Error();
      new PublicKey(key);
    }
    if (!['payments','recipient','balance'].includes(mode)) throw new Error();
    if (before && (typeof before !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(before))) throw new Error();
    if (mode === 'recipient' && (!/^\d+$/.test(query.since) || Number(query.since) <= 0)) throw new Error();
  } catch {
    return res.status(400).json({error:'Enter valid wallet and mint addresses and a valid tracking date.'});
  }
  try {
    if (mode === 'balance') {
      const data = await providerRequest(key => `https://mainnet.helius-rpc.com/?api-key=${key}`, {
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTokenAccountsByOwner',params:[wallet,{mint},{encoding:'jsonParsed',commitment:'confirmed'}]}),
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
    if (before) url.searchParams.set('before',before);
    const transactions=await providerRequest(key => `${url}&api-key=${key}`);
    if (!Array.isArray(transactions)) throw new Error();
    const oldest=transactions.at(-1);
    const reachedDate = mode === 'recipient' && oldest?.timestamp < Number(query.since);
    const next = transactions.length === 100 && !reachedDate ? oldest.signature : null;
    const rows=mode === 'payments' ? analyzePayments(transactions,wallet,mint) : analyzeRecipient(transactions,wallet,mint,Number(query.since));
    res.setHeader('Cache-Control','private, max-age=30');
    return res.status(200).json({rows,next,scanned:transactions.length,oldest:oldest?.timestamp || null});
  } catch {
    return res.status(502).json({error:'Transaction provider unavailable. Check the server Helius key and try again. No missing data has been counted as zero.'});
  }
}
