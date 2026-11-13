const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {transformSync} = require('@babel/core');
const React = require('react');
const {PublicKey, SystemProgram} = require('@solana/web3.js');
function load(path, overrides = {}) {
 const mod = {exports:{}};
 const code = transformSync(fs.readFileSync(path, 'utf8'), {filename:path, configFile:false, babelrc:false, presets:['@babel/preset-typescript','@babel/preset-react'], plugins:['@babel/plugin-transform-modules-commonjs']}).code;
 new Function('require','module','exports',code)(name => overrides[name] || require(name),mod,mod.exports);
 return mod.exports;
}
const {batchInstructionDraft} = load('src/Governance/Treasury/batchInstructionDraft.ts');
test('draft bridge keeps every batch instruction in order and separates payer actions', () => {
 const key = new PublicKey('11111111111111111111111111111111');
 const ix = [1,2,3].map(lamports => SystemProgram.transfer({fromPubkey:key,toPubkey:key,lamports}));
 const payerIx = SystemProgram.transfer({fromPubkey:key,toPubkey:key,lamports:4});
 const draft = batchInstructionDraft({title:'Batch',description:'Three recipients',ix,aix:[payerIx]});
 assert.deepEqual(draft.governanceInstructions.instructions,ix);
 assert.deepEqual(draft.authorInstructions.instructions,[payerIx]);
 assert.equal(draft.description,'Three recipients');
 assert.equal(batchInstructionDraft({ix}).authorInstructions,null);
 assert.throws(()=>batchInstructionDraft({ix:[]}),/no instructions/);
});
test('quick actions open batch grants for the current DAO and preserve draft callbacks', () => {
 const Batch = () => null, Grant = () => null;
 const View = load('src/Governance/Treasury/TreasuryQuickActions.tsx', {
  './plugins/BatchSendView':{__esModule:true,default:Batch},
  './plugins/IntraDAOView':{__esModule:true,default:Grant},
 }).default;
 const callback = ()=>{};
 const tree = View({editingDraft:true,governanceAddress:'current-dao',realm:{account:{communityMint:{toBase58:()=> 'community-mint'}}},setInstructions:callback});
 const elements = [];
 function visit(node) { if (!React.isValidElement(node)) return; elements.push(node); React.Children.forEach(node.props.children, visit); }
 visit(tree);
 const grant = elements.find(el=>el.type===Grant), batch=elements.find(el=>el.type===Batch);
 assert.equal(grant.props.initialAction,'grant');
 assert.equal(grant.props.initialBulkGrant,true);
 assert.equal(grant.props.initialTargetRealm,'current-dao');
 assert.equal(grant.props.initialTargetMint,'community-mint');
 for(const el of [grant,batch]) {assert.equal(el.props.setInstructions,callback);assert.equal(el.props.editingDraft,true);assert.match(el.props.submitLabel,/instruction list/);}
});
