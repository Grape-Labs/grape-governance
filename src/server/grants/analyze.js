import BigNumber from 'bignumber.js';
import bs58 from 'bs58';

const amount = (value) => {
  const n = new BigNumber(value ?? 0);
  return n.isFinite() && n.isPositive() ? n : new BigNumber(0);
};
const total = (rows, field) => rows.reduce((n, row) => n.plus(amount(row[field])), new BigNumber(0));

// SPL Governance deposits can credit a member while the tokens move into
// the realm holding account. Resolve the beneficiary from the deposit instruction.
function depositBeneficiaries(tx) {
  const deposits = [];
  const visit = (instructions) => {
    for (const ix of instructions || []) {
      if (ix.programId === 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw') {
        try {
          const data = Buffer.from(bs58.decode(ix.data));
          if (data.length === 9 && data[0] === 1 && ix.accounts?.length >= 6) {
            deposits.push({source:ix.accounts[2],destination:ix.accounts[1],recipient:ix.accounts[3],rawAmount:data.readBigUInt64LE(1).toString(),used:false});
          }
        } catch { /* Not a recognized deposit instruction. */ }
      }
      visit(ix.innerInstructions);
    }
  };
  visit(tx.instructions);
  return deposits;
}

// These are payments from a user-selected distributor, not inferred grant intent.
export function analyzePayments(transactions, distributor, mint) {
  const payments = [];
  const seen = new Set();
  for (const tx of transactions) {
    if (!tx.signature || seen.has(tx.signature) || tx.transactionError) continue;
    seen.add(tx.signature);
    const deposits = depositBeneficiaries(tx);
    for (const [index, transfer] of (tx.tokenTransfers || []).entries()) {
      if (transfer.mint !== mint || transfer.fromUserAccount !== distributor ||
          !transfer.toUserAccount || transfer.toUserAccount === distributor || !amount(transfer.tokenAmount).gt(0)) continue;
      // Do not label the distributor's own market trades as grants.
      if (tx.events?.swap || tx.type === 'SWAP') continue;
      const change = (tx.accountData || []).flatMap(a=>a.tokenBalanceChanges || []).find(c=>c.mint === mint && c.tokenAccount === transfer.fromTokenAccount);
      const decimals = change?.rawTokenAmount?.decimals;
      const deposit = Number.isInteger(decimals) ? deposits.find(d=>!d.used && d.source === transfer.fromTokenAccount && d.destination === transfer.toTokenAccount && new BigNumber(d.rawAmount).shiftedBy(-decimals).eq(transfer.tokenAmount)) : null;
      if (deposit) deposit.used = true;
      const recipient = deposit?.recipient || transfer.toUserAccount;
      if (recipient === distributor) continue;
      payments.push({ id: `${tx.signature}:${index}`, signature: tx.signature,
        timestamp: tx.timestamp, recipient, kind:deposit?'governance deposit':'transfer', amount: String(transfer.tokenAmount) });
    }
  }
  return payments;
}

export function analyzeRecipient(transactions, wallet, mint, since) {
  const events = [];
  const seen = new Set();
  for (const tx of transactions) {
    if (!tx.signature || seen.has(tx.signature) || tx.transactionError || !tx.timestamp || tx.timestamp < since) continue;
    seen.add(tx.signature);
    const transfers = (tx.tokenTransfers || []).filter(t => t.mint === mint && t.fromUserAccount === wallet && t.toUserAccount !== wallet);
    const outgoing = total(transfers, 'tokenAmount');
    const inputs = (tx.events?.swap?.tokenInputs || []).filter(t => t.mint === mint && t.userAccount === wallet);
    const swapped = inputs.reduce((sum, t) => {
      const raw = t.rawTokenAmount;
      return raw && Number.isInteger(raw.decimals) ? sum.plus(amount(raw.tokenAmount).shiftedBy(-raw.decimals)) : sum;
    }, new BigNumber(0));
    if (swapped.gt(0)) events.push({signature:tx.signature,timestamp:tx.timestamp,type:'swap',amount:swapped.toFixed()});
    const other = BigNumber.maximum(0, outgoing.minus(swapped));
    if (other.gt(0)) events.push({signature:tx.signature,timestamp:tx.timestamp,type:'transfer',amount:other.toFixed()});
  }
  return events;
}
