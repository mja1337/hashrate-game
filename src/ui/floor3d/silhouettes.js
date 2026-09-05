"use strict";

/* MINER SILHOUETTES — one recognisable shape per machine in the catalogue, ported unchanged
   from the floor prototype. Deliberately readable rather than accurate: these are meant to be
   told apart at a glance across a room of two hundred, not to be product CAD. */

/* Catalogue-specific silhouettes, scaled for readability rather than product CAD.
   Hardware identity is independent of the chosen facility. */
const FloorMiners=(()=>{
  const profiles={
    laptop:{type:'laptop'},cpu:{type:'cpu'},'5870':{type:'gpu'},gpurig:{type:'rig'},fpga:{type:'fpga'},
    avalon:{type:'avalon',color:0xc6bbaa},
    s1:{type:'openasic',color:0x788f83,boards:2},
    s3:{type:'asic',color:0x849298,w:.93,h:.36,d:.73,fan:.15,fins:4,levels:2},
    s5:{type:'openasic',color:0xc2b8a3,boards:3},
    s7:{type:'asic',color:0xaaa998,w:.6,h:.43,d:.94,fan:.18,fins:5,levels:3},
    s9:{type:'asic',color:0xb7b8ae,w:.55,h:.43,d:1.08,fan:.18,fins:8,levels:3,psu:true},
    s17:{type:'asic',color:0x9cabb1,w:.9,h:.61,d:.73,fan:.21,fins:4,levels:2,dual:true},
    s19:{type:'asic',color:0xbac0be,w:.98,h:.55,d:.78,fan:.21,fins:7,levels:2,dual:true,psu:true},
    s19xp:{type:'asic',color:0xc5c9c1,w:.98,h:.55,d:.8,fan:.21,fins:10,levels:2,dual:true,psu:true,trim:0x65b7a5},
    s19hydro:{type:'hydro',color:0x8faeb6,w:1.08,h:.47,d:.85,levels:3,pipes:2},
    s21:{type:'asic',color:0xd2d3ca,w:1.16,h:.6,d:.84,fan:.23,fins:8,levels:2,dual:true,psu:true,trim:0xe4a14d},
    s21hydro:{type:'hydro',color:0xc6d0d0,w:1.22,h:.51,d:.95,levels:3,pipes:3},
    s21xp:{type:'asic',color:0xb0bdc2,w:1.16,h:.6,d:.87,fan:.23,fins:12,levels:2,dual:true,psu:true,trim:0x70c7dd}
  };
  function render(h,b,api){
    const {box,part,fan,C}=api,p=profiles[h.id];if(!p)throw Error('Missing visual: '+h.id);
    const {x,z}=b,id=b.id,accent=api.accent,on=b.status==='online';
    const B=(size,pos,color)=>box(size,[x+pos[0],pos[1],z+pos[2]],color,id);
    const F=(dx,y,dz,r)=>fan(x+dx,y,z+dz,r,id,on);
    const desk=(height=.78)=>{B([1.6,.09,1.1],[0,height,0],C.wood);for(const dx of [-.66,.66])for(const dz of [-.43,.43])B([.08,height,.08],[dx,height/2,dz],C.steel);};
    const led=(dx,y,dz,w=.05)=>box([w,.035,.024],[x+dx,y,z+dz],accent,id,true);
    const rail=(levels)=>{for(const dx of [-.73,.73])for(const dz of [-.52,.52])B([.07,2.08,.07],[dx,1.1,dz],C.steel);for(let j=0;j<levels;j++)B([1.54,.065,1.15],[0,.28+j*.66,0],C.edge);B([1.48,.12,.09],[0,2.13,.53],C.steel);led(0,2.13,.59,1.3);};
    if(p.type==='laptop'){
      desk();B([.87,.045,.62],[0,.86,.1],C.edge);
      part('box',[.9,.58,.045],[x,1.14,z-.2],C.dark,[-.15,0,0],id);
      B([.75,.44,.017],[0,1.14,-.16],on?0x275b53:C.dark);
      for(let i=0;i<4;i++)B([.57,.007,.025],[0,.89,.01+i*.065],C.steel);
      B([.22,.008,.12],[0,.89,.31],0x798d94);led(.36,.88,.4);
      return;
    }
    if(p.type==='cpu'){
      desk();B([.36,.71,.62],[.44,1.18,.05],C.dark);F(.44,1.12,.37,.115);led(.44,1.45,.38);
      B([.65,.45,.065],[-.28,1.18,-.18],C.steel);B([.55,.34,.018],[-.28,1.18,-.135],on?0x265646:C.dark);
      B([.05,.16,.05],[-.28,.91,-.18],C.edge);B([.58,.02,.2],[-.28,.86,.23],C.dark);return;
    }
    if(p.type==='gpu'){
      desk();B([1.2,.035,.77],[0,.86,0],0x2d7367);B([1.07,.36,.19],[0,1.1,.04],0x802d35);
      F(-.29,1.1,.15,.135);F(.29,1.1,.15,.135);B([1.05,.04,.19],[0,1.31,.04],C.dark);
      B([.3,.18,.3],[.42,.99,-.3],C.edge);led(-.45,.91,.36);return;
    }
    if(p.type==='rig'){
      for(const dx of [-.69,.69])for(const dz of [-.48,.48])B([.07,1.05,.07],[dx,.63,dz],C.edge);
      for(const y of [.22,1.1])for(const dz of [-.48,.48])B([1.45,.065,.065],[0,y,dz],C.edge);
      B([1.38,.07,.94],[0,.3,0],C.dark);
      for(let j=0;j<6;j++){B([.15,.52,.75],[-.5+j*.2,.78,0],j%2?0x655354:C.steel);led(-.5+j*.2,1.06,.39,.12);}
      for(let j=0;j<3;j++)F(-.46+j*.46,.64,.51,.2);B([.37,.22,.32],[.39,.46,.15],C.edge);return;
    }
    if(p.type==='fpga'){
      desk(.6);B([1.13,.03,.79],[0,.69,0],0x276e58);
      for(const dx of [-.31,.31]){B([.34,.08,.36],[dx,.75,0],C.dark);for(let k=0;k<6;k++)B([.025,.12,.33],[dx-.13+k*.052,.84,0],C.edge);}
      for(let k=0;k<4;k++)B([.08,.04,.12],[-.4+k*.22,.74,.3],0xc4ad68);led(.42,.75,.35);return;
    }
    if(p.type==='avalon'){
      B([1.38,.11,.97],[0,.2,0],C.steel);B([1.32,.48,.86],[0,.5,0],p.color);
      for(let k=0;k<3;k++)F(-.4+k*.4,.5,.45,.145);
      for(let k=0;k<7;k++)B([.06,.015,.6],[-.51+k*.17,.75,0],C.dark);led(.55,.67,.45);return;
    }
    if(p.type==='openasic'){
      B([1.25,.08,.98],[0,.23,0],C.steel);
      for(let j=0;j<p.boards;j++){const dx=(j-(p.boards-1)/2)*.34;B([.045,.58,.87],[dx,.61,0],0x3d766a);for(let k=0;k<6;k++)B([.2,.51,.025],[dx,.61,-.35+k*.14],p.color);}
      F(0,.59,.47,h.id==='s1'?.24:.29);B([1.17,.045,.07],[0,.96,0],C.edge);led(.48,.31,.53);return;
    }
    const units=Math.min(b.qty,p.levels);rail(units);
    for(let j=0;j<units;j++){
      const y=.32+j*.66+p.h/2;B([p.w,p.h,p.d],[0,y,0],p.color);
      if(p.type==='hydro'){
        for(let k=0;k<5;k++)B([p.w-.1,.03,.04],[0,y-p.h/2+.07+k*.075,p.d/2+.015],C.steel);
        for(let k=0;k<p.pipes;k++){
          const dx=(k-(p.pipes-1)/2)*.33;
          part('cylinder',[.055,.28,.055],[x+dx,y+.05,z+p.d/2+.13],k%2?0xdc8063:0x5fb7df,[Math.PI/2,0,0],id);
        }
        B([.31,.07,.3],[.23,y+p.h/2+.025,0],C.steel);led(-p.w/2+.07,y+.1,p.d/2+.03);
      }else{
        B([p.w-.025,p.h-.025,.025],[0,y,p.d/2+.016],C.dark);
        if(p.dual){F(-p.w*.255,y,p.d/2+.04,p.fan);F(p.w*.255,y,p.d/2+.04,p.fan);}else F(0,y,p.d/2+.04,p.fan);
        for(let k=0;k<p.fins;k++)B([.026,.024,p.d-.08],[-p.w/2+.07+k*(p.w-.14)/Math.max(1,p.fins-1),y+p.h/2+.01,0],0x617782);
        if(p.psu)B([.2,.12,p.d*.85],[p.w/2-.08,y+p.h/2+.08,0],C.steel);
        if(p.trim)B([p.w,.025,.05],[0,y-p.h/2+.02,p.d/2+.035],p.trim);
        led(-p.w/2+.04,y+p.h/2-.04,p.d/2+.04);
      }
    }
    if(p.type==='hydro'){
      for(const [dx,col] of [[-.65,0x5fb7df],[.65,0xdc8063]])part('cylinder',[.045,2,.045],[x+dx,1.13,z+.63],col,[0,0,0],id);
    }
  }
  return {profiles,render};
})();
