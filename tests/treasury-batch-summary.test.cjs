const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
const mod = {exports:{}};
new Function('require','module','exports',transformSync(fs.readFileSync('src/Governance/Treasury/batchSummary.ts','utf8'),{filename:'batchSummary.ts',configFile:false,babelrc:false,presets:['@babel/preset-typescript'],plugins:['@babel/plugin-transform-modules-commonjs']}).code)(require,mod,mod.exports);
const {summarizeBatch} = mod.exports;
const a='11111111111111111111111111111111';
const b='So11111111111111111111111111111111111111112';
test('sums every grant while counting repeated wallets only once',()=>{
 const summary = summarizeBatch(`${a},100\n${b},200\n${a},50`);
 assert.equal(summary.total,'350'); assert.equal(summary.recipientCount,2); assert.equal(summary.rowCount,3); assert.equal(summary.duplicateCount,1);
});
test('preserves fractional and large totals without floating-point rounding',()=>{
 assert.equal(summarizeBatch(`${a},0.1\n${b},0.2`).total,'0.3');
 assert.equal(summarizeBatch(`${a},9007199254740993.000000001\n${b},0.000000001`).total,'9007199254740993.000000002');
});
test('supports transfer whitespace format and flags invalid rows explicitly',()=>{
 assert.equal(summarizeBatch(`${a} 1.5`,true).total,'1.5');
 const summary=summarizeBatch(`${a},1\ninvalid,2\n${b},-2\n${b},NaN\n${b},2,extra`);
 assert.equal(summary.total,'1');assert.equal(summary.recipientCount,1);assert.equal(summary.errors.length,4);
 assert.equal(summarizeBatch('').total,'0');assert.equal(summarizeBatch('').recipientCount,0);
});
const {parseBatchRecipients} = mod.exports;
test('pastes Excel/Sheets cells with headers, tabs, blank lines and CRLF',()=>{
 const parsed=parseBatchRecipients(`\uFEFFWallet\tAmount\r\n${a}\t100\r\n\r\n${b}\t250.5\r\n`);
 assert.deepEqual(parsed.errors,[]);assert.deepEqual(parsed.rows.map(row=>[row.wallet,row.amount]),[[a,'100'],[b,'250.5']]);
 assert.equal(summarizeBatch(`Wallet\tAmount\n${a}\t100\n${b}\t250.5`).total,'350.5');
});
test('accepts quoted CSV, grouped amounts and semicolon-delimited exports',()=>{
 for(const input of [`"wallet","amount"\n"${a}","1,250.75"`,`Wallet;Amount\n${a};1250.75`, `Wallet\tAmount\n${a}\t1,250.75`]){
  const parsed=parseBatchRecipients(input);assert.deepEqual(parsed.errors,[]);assert.equal(parsed.rows[0].amount,'1250.75');
 }
});
test('rejects extra columns and reports source row numbers after headers',()=>{
 const parsed=parseBatchRecipients(`Wallet\tAmount\n${a}\t2\tunexpected\n${b}\t0\nwrong\t100`);
 assert.equal(parsed.rows.length,0);assert.equal(parsed.errors.length,3);
 assert.match(parsed.errors[0],/Row 2/);assert.match(parsed.errors[2],/Row 4/);
 assert.equal(parseBatchRecipients(`Wallet,Amount\n${a},"12`).errors.length,1);
});
