const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {transformSync}=require('@babel/core');
const filename=path.resolve('src/Governance/GovernanceDirectoryCardView.tsx');
const loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=Module._nodeModulePaths(path.dirname(filename));
const base=loaded.require.bind(loaded);
loaded.require=id=>({
 'react-router-dom':{useNavigate:()=>()=>{},Link:({to,children,...props})=>React.createElement('a',{...props,href:to},children)},
 '../utils/grapeTools/constants':{GRAPE_LOGO:''},
 '../utils/grapeTools/utils':{toRealmsV2Image:value=>value},
}[id]||base(id));
loaded._compile(transformSync(fs.readFileSync(filename,'utf8'),{filename,configFile:false,babelrc:false,presets:['@babel/preset-typescript','@babel/preset-react'],plugins:['@babel/plugin-transform-modules-commonjs']}).code,filename);
const Card=loaded.exports.default;
const item={governanceAddress:'realm-a',governanceName:'Example DAO',lastProposalDate:'65a00000',totalMembers:123,totalProposals:456,totalProposalsVoting:7};
test('homepage card hides dates and stale activity while retaining the DAO link',()=>{
 const html=renderToStaticMarkup(React.createElement(Card,{item,directoryOnly:true}));
 assert.ok(html.includes('Example DAO'));
 assert.ok(html.includes('/dao/realm-a'));
 for(const text of ['123 members','456 proposals','7 voting','No live votes',new Date(parseInt(item.lastProposalDate,16)*1000).toLocaleDateString()])assert.ok(!html.includes(text),text);
});
test('other card consumers retain their existing statistics',()=>{
 const html=renderToStaticMarkup(React.createElement(Card,{item}));
 assert.ok(html.includes('123 members'));
 assert.ok(html.includes('456 proposals'));
});
