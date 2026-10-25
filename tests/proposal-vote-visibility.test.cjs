const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const parser=require('@babel/parser');
const traverse=require('@babel/traverse').default;
const generate=require('@babel/generator').default;
const ast=parser.parse(fs.readFileSync('src/Governance/GovernanceProposalV2.tsx','utf8'),{sourceType:'module',plugins:['typescript','jsx']});
let actionGate;
traverse(ast,{ObjectProperty({node}){
 if(node.key.name==='actions' && node.value.type==='ConditionalExpression') actionGate=generate(node.value.test).code;
}});
assert.ok(actionGate,'Simple proposal view supplies voting controls');
const visible=new Function('realm','showProminentSecurityWarning','grapeDaoSafetySignals',`return !!(${actionGate});`);
test('switching to a review-flagged proposal preserves voting and vote-management controls',()=>{
 assert.equal(visible({},false,{isBlockedProposal:false}),true);
 assert.equal(visible({},true,{isBlockedProposal:false}),true);
 assert.equal(visible({},false,{isBlockedProposal:false}),true);
});
test('known malicious proposals stay blocked and missing realm cannot render voting controls',()=>{
 assert.equal(visible({},true,{isBlockedProposal:true}),false);
 assert.equal(visible(null,false,{isBlockedProposal:false}),false);
});
