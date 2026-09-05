"use strict";

/* MINER SILHOUETTES — one recognisable machine per entry in the catalogue.

   The brief these were first written to was "tell them apart at a glance across a room of two
   hundred", and that produced boxes: a coloured slab with a fan on the front. It works at
   megacampus zoom, where a machine is four pixels, and it looks like nothing at all in a
   spare room where the same machine fills a third of the frame.

   So the shapes are now built the way the hardware is built. An air-cooled Antminer is an
   extruded aluminium shell with a fan at EACH end — one drawing air in, one pushing it out —
   ridged along the roof where the extrusion is pulled, with a small controller board on top
   carrying an Ethernet socket and status LEDs, and a power inlet feeding a cable that drops
   away to a busway. A GPU rig is an open frame with individual cards on risers and a PSU
   hanging off it. Those details are what make a render read as a machine rather than as a
   coloured box, and they cost nothing per unit: every piece here is an instance of one of
   three shared geometries, so a floor of forty thousand miners still draws in a handful of
   calls.

   The fan layout is deliberately one per end on every air-cooled model. An earlier pass put
   two fans on each face of the larger machines, which is not the mainstream layout and is
   not something I can verify model by model; a bigger machine gets a bigger fan instead, and
   the generations stay apart on proportion, rib count, PSU treatment and trim.

   Still deliberately not product CAD. Proportions follow the real machines — an S9 is narrow
   and long, an S19 is wider than it is deep — but nothing here is dimensioned, and the
   colours separate generations rather than matching anodising. */

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
    const M=(size,pos,color,rot=[0,0,0])=>api.metal(size,[x+pos[0],pos[1],z+pos[2]],color,id,rot);
    const T=(size,pos,color,rot=[0,0,0],shiny=false)=>api.tube(size,[x+pos[0],pos[1],z+pos[2]],color,rot,id,shiny);
    const F=(dx,y,dz,r,facing=1)=>fan(x+dx,y,z+dz,r,id,on,facing);
    /* Status lights are lamps, not coloured squares: a bright core with an additive halo.
       Wide strips get a tighter spread, because a halo scaled off a 1.3-wide strip would be
       a bar of fog rather than a light. */
    const led=(dx,y,dz,w=.05,spread=w>.4?1.5:2.8)=>api.lamp([w,.035,.024],[x+dx,y,z+dz],accent,id,spread);
    const screen=(size,pos,col,rot=null)=>{
      if(rot)part('box',size,[x+pos[0],pos[1],z+pos[2]],col,rot,id,true);
      else api.lamp(size,[x+pos[0],pos[1],z+pos[2]],col,id,1.35);
    };
    const desk=(height=.78)=>{B([1.6,.09,1.1],[0,height,0],C.wood);for(const dx of [-.66,.66])for(const dz of [-.43,.43])M([.08,height,.08],[dx,height/2,dz],C.steel);};
    /* A short length of cable leaving a machine and dropping out of sight. Nothing in a
       working room is unplugged, and the absence of any cabling was half of why the old
       shapes read as models rather than as equipment. */
    const drop=(dx,y,dz,len=.3,col=0x1b2428)=>{T([.022,len,.022],[dx,y-len/2,dz],col);T([.03,.05,.03],[dx,y,dz],C.dark)};
    const rail=(levels)=>{
      for(const dx of [-.73,.73])for(const dz of [-.52,.52])M([.05,2.08,.05],[dx,1.1,dz],0x44585f);
      for(let j=0;j<levels;j++){M([1.54,.04,1.15],[0,.28+j*.66,0],0x5d737a);
        for(const dz of [-.52,.52])M([1.54,.03,.03],[0,.5+j*.66,dz],0x44585f);}
      M([1.48,.12,.09],[0,2.13,.53],C.steel);led(0,2.13,.59,1.3);
      // Busway down the back of the rack, which is what the machines actually plug into,
      // and a data spine beside it. Orange is power, blue is data, here as everywhere else.
      M([.12,1.9,.12],[.79,1,-.5],0x30444c);
      for(let j=0;j<levels;j++)B([.16,.09,.05],[.79,.42+j*.66,-.43],C.orange);
      M([.07,1.9,.07],[-.79,1,-.5],0x2b4150);
      for(let j=0;j<levels;j++)B([.11,.06,.04],[-.79,.46+j*.66,-.44],0x4a9fe0);
    };
    if(p.type==='laptop'){
      desk();
      // Base: chassis, keyboard well, key rows, trackpad, feet.
      M([.87,.05,.62],[0,.865,.1],C.edge);
      B([.72,.012,.44],[0,.892,.08],0x1c2529);
      for(let r=0;r<5;r++)for(let k=0;k<12;k++)B([.045,.012,.03],[-.31+k*.056,.9,-.02+r*.055],0x2c3a3f);
      B([.24,.014,.13],[0,.9,.26],0x33444a);
      part('box',[.9,.6,.04],[x,1.16,z-.2],C.dark,[-.16,0,0],id);
      part('box',[.79,.49,.012],[x,1.16,z-.176],on?0x2f8f7f:0x11191c,[-.16,0,0],id,true);
      if(on)part('box',[.95,.62,.02],[x,1.16,z-.19],0x2f8f7f,[-.16,0,0],id,true,false,false,true);
      part('box',[.2,.02,.008],[x,1.3,z-.212],C.steel,[-.16,0,0],id);
      for(const dx of [-.4,.4])B([.05,.02,.05],[dx,.845,.28],C.dark);
      drop(.44,.87,-.16,.42);led(.36,.885,.4);
      return;
    }
    if(p.type==='cpu'){
      desk();
      // A tower with a mesh front, a side window and a monitor on an arm.
      M([.36,.71,.62],[.44,1.18,.05],C.dark);
      for(let k=0;k<7;k++)B([.3,.02,.02],[.44,.9+k*.055,.36],0x38484e);
      B([.28,.5,.01],[.62,1.2,.05],0x22323a);
      F(.44,1.42,.37,.115);led(.44,.88,.38);
      M([.65,.45,.05],[-.28,1.18,-.18],C.steel);
      screen([.56,.35,.012],[-.28,1.18,-.146],on?0x2c8a76:0x121a1c);
      M([.06,.18,.06],[-.28,.9,-.18],C.edge);M([.22,.02,.16],[-.28,.815,-.18],C.steel);
      B([.58,.018,.2],[-.28,.868,.23],C.dark);
      for(let k=0;k<10;k++)B([.04,.012,.16],[-.53+k*.055,.878,.23],0x2c3a3f);
      drop(.6,.86,.05,.4);
      return;
    }
    if(p.type==='gpu'){
      desk();
      // A single card on a test bench: PCB, shroud, twin fans, backplate, power leads.
      B([1.2,.03,.77],[0,.86,0],0x1e5f52);
      for(let k=0;k<9;k++)B([.02,.012,.5],[-.44+k*.11,.877,-.04],0xc9a942);
      M([1.07,.34,.2],[0,1.09,.04],0x6e2a31);
      F(-.29,1.09,.16,.13);F(.29,1.09,.16,.13);
      M([1.05,.03,.2],[0,1.28,.04],C.dark);
      M([.3,.19,.3],[.42,.98,-.3],C.edge);
      for(const dx of [-.18,.18])drop(dx,1.27,-.02,.3,0x2a1518);
      led(-.45,.9,.36);
      return;
    }
    if(p.type==='rig'){
      // Open aluminium frame, cards hung vertically on risers, PSU under, fans below.
      for(const dx of [-.69,.69])for(const dz of [-.48,.48])M([.06,1.05,.06],[dx,.63,dz],C.edge);
      for(const y of [.22,.68,1.1])for(const dz of [-.48,.48])M([1.45,.05,.05],[0,y,dz],C.edge);
      for(const dx of [-.69,.69])M([.05,.05,.98],[dx,1.1,0],C.edge);
      M([1.38,.05,.94],[0,.3,0],C.dark);
      for(let j=0;j<6;j++){
        const dx=-.5+j*.2;
        B([.16,.5,.78],[dx,.78,0],0x1d3b36);                       // card PCB edge
        M([.13,.42,.7],[dx,.8,.03],j%2?0x5b4b4c:0x77848a);          // cooler shroud
        T([.09,.1,.09],[dx,.8,.3],0x27343a,[Math.PI/2,0,0]);        // card fan hub
        B([.02,.34,.02],[dx-.07,.8,-.34],0xc46a3a);                 // riser ribbon
        led(dx,1.05,.38,.1);
      }
      for(let j=0;j<3;j++)F(-.46+j*.46,.5,.52,.19);
      M([.42,.24,.34],[.39,.46,.12],C.edge);                        // PSU
      for(const dx of [.24,.5])drop(dx,.58,.12,.26,0x1b2428);
      return;
    }
    if(p.type==='fpga'){
      desk(.6);
      B([1.13,.028,.79],[0,.686,0],0x1c5a49);
      for(const dx of [-.31,.31]){
        M([.34,.07,.36],[dx,.74,0],C.dark);
        for(let k=0;k<6;k++)M([.022,.13,.33],[dx-.13+k*.052,.83,0],C.edge);
        B([.14,.03,.14],[dx,.72,0],0x2c3a3f);
      }
      for(let k=0;k<4;k++)B([.07,.035,.11],[-.4+k*.22,.72,.3],0xc4ad68);
      for(let k=0;k<6;k++)B([.015,.01,.4],[-.5+k*.03,.702,-.16],0xc9a942);
      drop(.5,.7,.3,.24);led(.42,.735,.35);
      return;
    }
    if(p.type==='avalon'){
      // A cylindrical-ended box with a bank of intake fans down one flank.
      M([1.38,.1,.97],[0,.2,0],C.steel);
      M([1.32,.48,.86],[0,.5,0],p.color);
      for(let k=0;k<3;k++)F(-.4+k*.4,.5,.45,.145);
      for(let k=0;k<3;k++)F(-.4+k*.4,.5,-.45,.145,-1);
      for(let k=0;k<7;k++)M([.05,.014,.6],[-.51+k*.17,.75,0],C.dark);
      B([.2,.1,.14],[.42,.76,-.3],C.dark);                          // controller
      B([.07,.04,.03],[.42,.76,-.22],0x2f6f7d);
      drop(.55,.26,-.3,.2);led(.55,.67,.45);
      return;
    }
    if(p.type==='openasic'){
      // An open blade chassis: bare hashboards standing on a tray, one big fan across them.
      M([1.25,.07,.98],[0,.23,0],C.steel);
      for(const dx of [-.6,.6])M([.05,.72,.9],[dx,.6,0],C.edge);
      for(let j=0;j<p.boards;j++){
        const dx=(j-(p.boards-1)/2)*.34;
        B([.04,.58,.87],[dx,.61,0],0x24564d);
        for(let k=0;k<6;k++)M([.19,.5,.022],[dx,.61,-.35+k*.14],p.color);
        for(let k=0;k<3;k++)B([.05,.03,.04],[dx,.34+k*.1,.42],0xc9a942);
      }
      F(0,.59,.47,h.id==='s1'?.24:.29);
      M([1.17,.04,.07],[0,.96,0],C.edge);
      B([.26,.09,.16],[.5,.34,-.3],C.dark);
      drop(.62,.3,-.3,.18);led(.48,.31,.53);
      return;
    }
    if(p.type==='hydro'){
      const units=Math.min(b.qty,p.levels);rail(units);
      for(let j=0;j<units;j++){
        const y=.32+j*.66+p.h/2;
        M([p.w,p.h,p.d],[0,y,0],p.color);
        // Cold plates and the return header running the length of the case.
        for(let k=0;k<5;k++)M([p.w-.1,.028,.04],[0,y-p.h/2+.07+k*.075,p.d/2+.015],C.edge);
        for(let k=0;k<p.pipes;k++){
          const dx=(k-(p.pipes-1)/2)*.33;
          T([.052,.3,.052],[dx,y+.05,p.d/2+.14],k%2?0xdc8063:0x5fb7df,[Math.PI/2,0,0],true);
          T([.068,.06,.068],[dx,y+.05,p.d/2+.27],C.edge,[Math.PI/2,0,0],true);   // quick-connect
        }
        M([.3,.06,.28],[.23,y+p.h/2+.025,0],C.steel);
        B([.12,.04,.1],[-.2,y+p.h/2+.03,.2],C.dark);
        led(-p.w/2+.07,y+.1,p.d/2+.03);
      }
      for(const [dx,col] of [[-.65,0x5fb7df],[.65,0xdc8063]])T([.042,2,.042],[dx,1.13,.63],col,[0,0,0],true);
      return;
    }
    /* AIR-COOLED ASIC. The shape everything from an S3 to an S21 XP shares: an extruded shell
       with a fan at each end, ribbed flanks, a controller on the roof and a cable to a
       busway. What separates the generations is proportion, rib count and how the PSU is
       carried — bolted on top in the S9 era, integrated alongside from the S19 on. */
    const units=Math.min(b.qty,p.levels);rail(units);
    for(let j=0;j<units;j++){
      const y=.32+j*.66+p.h/2,front=p.d/2,back=-p.d/2;
      M([p.w,p.h,p.d],[0,y,0],p.color);
      // Recessed end panels so the fans sit IN the case rather than on it.
      M([p.w-.03,p.h-.03,.03],[0,y,front+.016],0x2b383e);
      M([p.w-.03,p.h-.03,.03],[0,y,back-.016],0x2b383e);
      // A bigger machine carries a bigger fan, not a second one beside it.
      const fanR=p.dual?Math.min(p.fan*1.55,Math.min(p.w,p.h)*.46):p.fan;
      F(0,y,front+.04,fanR);F(0,y,back-.04,fanR,-1);
      /* Ridges along the roof, the way the extrusion is actually pulled. Kept close to the
         shell colour: a first pass drew them dark and added vertical ribs down both flanks
         as well, and eight dark stripes over a light case turns a machine into a cage. */
      for(let k=0;k<p.fins;k++){
        const rx=-p.w/2+.07+k*(p.w-.14)/Math.max(1,p.fins-1);
        M([.02,.018,p.d-.1],[rx,y+p.h/2+.006,0],0x9fb0b4);
      }
      // A louvred band low on each flank, which is the only break in an otherwise flat side.
      for(let k=0;k<3;k++)for(const sx of [-1,1])
        M([.012,.022,p.d*.52],[sx*(p.w/2+.005),y-p.h*.22+k*.06,0],0x8b9ca2);
      // Controller board on the roof: Ethernet socket, reset, two status LEDs.
      M([p.w*.34,.05,.2],[-p.w*.2,y+p.h/2+.03,-p.d*.18],C.dark);
      B([.075,.045,.06],[-p.w*.2+.06,y+p.h/2+.05,-p.d*.18+.09],0x4a9fe0);
      led(-p.w*.2-.05,y+p.h/2+.06,-p.d*.18+.1,.03);
      if(p.psu){
        M([.22,.13,p.d*.82],[p.w/2-.09,y+p.h/2+.085,0],C.steel);
        for(let k=0;k<5;k++)M([.2,.016,.03],[p.w/2-.09,y+p.h/2+.085,-p.d*.3+k*p.d*.15],C.dark);
        drop(p.w/2-.09,y+p.h/2+.02,-p.d*.42,.22);
      }else drop(p.w/2-.05,y-p.h/2+.02,-p.d*.36,.2);
      if(p.trim)M([p.w,.022,.05],[0,y-p.h/2+.02,front+.035],p.trim);
      // Serial label plate, low on the front, where every one of these machines carries it.
      B([p.w*.3,.05,.012],[0,y-p.h/2+.07,front+.03],0xcfd6d2);
      led(-p.w/2+.04,y+p.h/2-.04,front+.04);
    }
  }
  return {profiles,render};
})();
