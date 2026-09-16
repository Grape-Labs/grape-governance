import {test} from 'node:test';
import assert from 'node:assert/strict';
import {grantQualification as qualify} from '../src/Governance/Members/qualification.js';
const grants=[{recipient:'alice',amount:'100'},{recipient:'bob',amount:'999'}];
test('retention uses prior grants and inclusive 30% shortfall boundary',()=>{
 assert.equal(qualify(grants,'alice','70',true,false,30),'Below retention requirement');
 assert.equal(qualify(grants,'alice','70.01',true,false,30),'Meets retention requirement');
 assert.equal(qualify(grants,'alice','80',true,false,20),'Below retention requirement');
});
test('partial history and missing data never report confirmed qualification',()=>{
 assert.equal(qualify(grants,'alice','80',true,true,30),'Within threshold · partial history');
 assert.equal(qualify(grants,'alice',undefined,true,false,30),'Position unavailable');
 assert.equal(qualify(grants,'alice','NaN',true,false,30),'Position unavailable');
 assert.equal(qualify(grants,'alice','80',false,false,30),'Load grant history');
 assert.equal(qualify(grants,'new','80',true,false,30),'No prior grants');
});
