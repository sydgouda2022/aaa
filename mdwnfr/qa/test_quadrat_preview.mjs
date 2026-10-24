import assert from 'node:assert/strict';
import {fitQuadrat} from '../web/quadrat_preview.mjs';

const source={width:20,height:30,signs:[
  {sign:'𓅓',x:2,y:3,width:8,height:10},
  {sign:'𓏏',x:11,y:3,width:7,height:10},
  {sign:'𓈖',x:4,y:16,width:12,height:10}
]};
const before=structuredClone(source);
const preview=fitQuadrat(source,100,60);
assert.equal(preview.width,40);
assert.equal(preview.height,60);
assert.deepEqual(preview.signs.map(g=>g.sign),['𓅓','𓏏','𓈖']);
assert.equal(preview.signs[1].x,22);
assert.equal(preview.signs[2].y,32);
assert.equal(preview.signs[0].fontSize,24);
assert.deepEqual(source,before,'Preview must never mutate Python geometry');
const wide=fitQuadrat(source,30,200);
assert.equal(wide.width,30);
assert.equal(wide.height,45);
for(const g of wide.signs)assert.ok(g.x+g.width<=wide.width+1e-7);
for(const broken of [
  {...source,height:0},
  {...source,signs:[]},
  {...source,signs:[{...source.signs[0],x:-1}]},
  {...source,signs:[{...source.signs[0],x:19}]},
  {...source,signs:[{...source.signs[0],height:Infinity}]}
])assert.throws(()=>fitQuadrat(broken),TypeError);
console.log('PASS: scaled native quadrat, sign order, fitting, unchanged geometry and invalid inputs');
