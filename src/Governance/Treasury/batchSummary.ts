import BigNumber from 'bignumber.js';
import { PublicKey } from '@solana/web3.js';

// One parser drives both the preview and the instructions submitted for approval.
export function parseBatchRecipients(input: string) {
  const rows: { wallet: string; amount: string; line: number }[] = [];
  const errors: string[] = [];
  let first = true;
  input.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).forEach((rawLine, index) => {
    if (!rawLine.trim()) return;
    const line = rawLine.trim();
    const delimiter = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
    const fields: string[] = [];
    let value = '', quoted = false;
    // Handle CSV quoted cells, including Excel's quoted thousands separators.
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) { fields.push(value.trim()); value = ''; }
      else value += char;
    }
    fields.push(value.trim());
    const parts = fields.length === 1 ? line.split(/\s+/) : fields;
    const walletHeader = /^(wallet|wallet address|address|recipient|recipient wallet|participant|participant wallet)$/i;
    const amountHeader = /^(amount|tokens|token amount|grant amount)$/i;
    if (first && parts.length === 2 && walletHeader.test(parts[0]) && amountHeader.test(parts[1])) { first = false; return; }
    first = false;
    if (quoted || parts.length !== 2 || !parts[0] || !parts[1]) {
      errors.push(`Row ${index + 1}: paste two columns — wallet and amount`); return;
    }
    let wallet: string;
    try { wallet = new PublicKey(parts[0]).toBase58(); }
    catch { errors.push(`Row ${index + 1}: invalid wallet`); return; }
    let amountText = parts[1];
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(amountText)) amountText = amountText.replace(/,/g, '');
    const amount = new BigNumber(amountText);
    if (!/^\d+(\.\d+)?$/.test(amountText) || !amount.isFinite() || !amount.isGreaterThan(0) || !Number.isFinite(Number(amountText))) {
      errors.push(`Row ${index + 1}: enter a positive amount using a decimal point`); return;
    }
    rows.push({ wallet, amount: amount.toFixed(), line: index + 1 });
  });
  return { rows, errors };
}

export function summarizeBatch(input: string, _allowWhitespace = false) {
  const { rows, errors } = parseBatchRecipients(input);
  const wallets = new Set(rows.map(row => row.wallet));
  const total = rows.reduce((sum, row) => sum.plus(row.amount), new BigNumber(0));
  return { total: total.toFixed(), recipientCount: wallets.size, rowCount: rows.length, duplicateCount: rows.length - wallets.size, errors };
}
