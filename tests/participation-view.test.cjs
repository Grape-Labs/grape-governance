const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {transformSync}=require('@babel/core');
const {JSDOM}=require('jsdom');
const BN=require('bn.js');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://governance.so',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','DocumentFragment','Node','Event','MouseEvent'])global[key]=dom.window[key];
global.getComputedStyle=dom.window.getComputedStyle;
const React=require('react');
const {render,screen,fireEvent,cleanup}=require('@testing-library/react');
function compile(file,overrides={}) {
 const filename=path.resolve(file);
 const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
 const baseRequire=loaded.require.bind(loaded);
 loaded.require=id=>overrides[id]||baseRequire(id);
 loaded._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
 return loaded.exports;
}
const formatting=compile('src/Governance/participationFormatting.js');
const Participation=compile('src/Governance/GovernanceStatsParticipationTable.tsx',{
 './participationFormatting':formatting,
 '../utils/grapeTools/Explorer':()=>null,
 '@mui/x-data-grid':{DataGrid:({rows,columns})=>React.createElement('div',null,rows.map(row=>React.createElement('div',{key:row.id},columns.find(c=>c.field==='details').renderCell({row}))))},
 '@mui/x-date-pickers/AdapterDateFns':{AdapterDateFns:()=>null},
 '@mui/x-date-pickers/LocalizationProvider':{LocalizationProvider:({children})=>children},
 '@mui/x-date-pickers/DatePicker':{DatePicker:()=>null},
}).default;

test('wallet View opens vote history with council BN weights without crashing',()=>{
 try {
  render(React.createElement(Participation,{proposals:[],members:[],participantArray:[{
   wallet:'member-wallet',staked:{governingTokenDepositAmount:0,governingCouncilDepositAmount:1},voteStats:{total:1},
   voteHistory:[{proposalTitle:'Council proposal',proposalMint:'council',communityMint:'community',voteType:0,voteWeight:new BN('9007199254740993'),draftAt:1700000000}],
  }]}));
  fireEvent.click(screen.getByRole('button',{name:'View'}));
  assert.ok(screen.getByRole('dialog'));
  assert.ok(screen.getByText('Vote History for member-wallet'));
  assert.ok(screen.getByText('Council proposal'));
  assert.ok(screen.getByText('9,007,199,254,740,993'));
 } finally {cleanup();}
});
