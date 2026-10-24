/** Display-only scaling of the Python quadrat result; never reflows or reorders signs. */
export function fitQuadrat(quadrat, maxWidth=164, maxHeight=86) {
  const valid=n=>typeof n==='number'&&Number.isFinite(n);
  if(!quadrat||!valid(quadrat.width)||!valid(quadrat.height)||
     quadrat.width<=0||quadrat.height<=0||!Array.isArray(quadrat.signs)||
     !quadrat.signs.length||!valid(maxWidth)||!valid(maxHeight)||
     maxWidth<=0||maxHeight<=0)throw new TypeError('Invalid quadrat preview geometry');
  const scale=Math.min(maxWidth/quadrat.width,maxHeight/quadrat.height);
  const signs=quadrat.signs.map(glyph=>{
    if(!glyph||typeof glyph.sign!=='string'||!glyph.sign||
       ![glyph.x,glyph.y,glyph.width,glyph.height].every(valid)||
       glyph.x<0||glyph.y<0||glyph.width<=0||glyph.height<=0||
       glyph.x+glyph.width>quadrat.width+0.00001||
       glyph.y+glyph.height>quadrat.height+0.00001)
      throw new TypeError('Invalid sign geometry');
    return {sign:glyph.sign,x:glyph.x*scale,y:glyph.y*scale,
      width:glyph.width*scale,height:glyph.height*scale,
      fontSize:glyph.height*scale*1.2};
  });
  return {width:quadrat.width*scale,height:quadrat.height*scale,signs};
}
