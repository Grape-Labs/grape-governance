const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {transformSync}=require('@babel/core');
const {JSDOM}=require('jsdom');
function load(file) {
 const module={exports:{}};
 const code=transformSync(fs.readFileSync(file,'utf8'),{filename:file,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 new Function('module','exports','require',code)(module,module.exports,id=>id==='../../utils/grapeTools/Explorer'?{default:()=>null,__esModule:true}:id==='./WalletActions'?load(path.resolve('src/Governance/Demo/WalletActions.tsx')):id==='./proposalListStatus'?load(path.resolve('src/Governance/Demo/proposalListStatus.ts')):require(id));
 return module.exports;
}
const {voterRows,voterWorkbook}=load(path.resolve('src/Governance/Demo/VoterBreakdown.tsx'));
test('voter breakdown retains exact decimal weights and vote direction',()=>{
 const rows=voterRows([{governingTokenOwner:'wallet',voteAddress:'record',isRelinquished:true,vote:{voterWeight:'123456789012345678',decimals:6,vote:{voteType:1}}}],{});
 assert.deepEqual(rows[0],{wallet:'wallet',record:'record',choice:'Against',power:'123456789012.345678',status:'Relinquished'});
});
test('Excel workbook is valid XML and treats formula-like values as strings',()=>{
 const xml=voterWorkbook([{wallet:'=1+1 & <wallet>',record:'record',choice:'For',power:'0.000001',status:'Recorded'}]);
 const doc=new JSDOM(xml,{contentType:'text/xml'}).window.document;
 assert.equal(doc.querySelectorAll('Row').length,2);
 assert.ok(xml.includes('ss:Type="String"'));
 assert.equal(doc.querySelectorAll('Row')[1].querySelector('Data').textContent,'=1+1 & <wallet>');
});
test('sorts exact power descending and formats grouped rounded values',()=>{
 const {formatVoterPower}=load(path.resolve('src/Governance/Demo/VoterBreakdown.tsx'));
 const rows=voterRows(['900719925474099300','900719925474099301','2'].map(raw=>({governingTokenOwner:raw,vote:{voterWeight:raw,decimals:2}})),{});
 assert.equal(rows[0].wallet,'900719925474099301');
 assert.equal(formatVoterPower('24379258.294536'),'24,379,258.29');
 assert.equal(formatVoterPower('999.999'),'1,000');
 assert.equal(formatVoterPower('Unavailable'),'Unavailable');
});
