const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {parse}=require('@babel/parser');
const traverse=require('@babel/traverse').default;
test('proposal pagination spans the four declared columns without phantom columns',()=>{
 const ast=parse(fs.readFileSync('src/Governance/Governance.tsx','utf8'),{sourceType:'module',plugins:['typescript','jsx']});
 let checked=0;
 traverse(ast,{JSXElement(path){
   const opening=path.node.openingElement;
   if(opening.name.name!=='StyledTable')return;
   const columns=path.node.children.find(node=>node.type==='JSXElement' && node.openingElement.name.name==='colgroup');
   if(!columns)return;
   const count=columns.children.filter(node=>node.type==='JSXElement' && node.openingElement.name.name==='col').length;
   assert.equal(count,4);
   path.traverse({JSXOpeningElement(child){
     if(child.node.name.name!=='TablePagination')return;
     const span=child.node.attributes.find(attr=>attr.name?.name==='colSpan');
     assert.equal(span.value.expression.value,count);
     checked++;
   }});
 }});
 assert.equal(checked,1);
});
