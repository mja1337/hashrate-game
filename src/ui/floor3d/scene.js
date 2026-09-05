"use strict";

/* THE ASSEMBLER — turns a floor description into a three.js scene and hands back something
   disposable. Ported unchanged from the floor prototype.

   View only. It reads a description of the floor and returns geometry; it never touches game
   state. Everything is instanced, which is why a megacampus of forty-four thousand miners
   draws in five calls rather than four thousand.

   ONE EDIT from the prototype: each batch is drawn with its OWN machine rather than with a
   single hardware type chosen for the whole scene. The prototype only ever showed one model
   at a time, so a scene-wide silhouette was enough; a real fleet is mixed, and drawing two
   GPU rigs and a laptop as three identical miners is simply wrong. */

/* View-only Three.js assembler. One persistent renderer, disposable instanced scenes. */
const FloorScene=(()=>{
  const T=FloorThree,C={slab:0x17262d,floor:0x516267,wall:0x768588,steel:0x283b43,edge:0x9aafb2,dark:0x111b22,orange:0xf7a13d,green:0x75e3b2,blue:0x68bafa,red:0xff705d,wood:0x916f4b};
  const colors={online:C.green,fault:C.red,repair:C.blue,off:0x52636c};
  function layout(s){
    const {p}=FloorModel.definitions(s),bs=FloorModel.batches(s),cols=Math.min(p.cols,bs.length),rows=Math.ceil(bs.length/cols);
    const dx=(p.width-(p.width>=18?7:3.8))/p.cols,dz=Math.min(2.15,(p.depth-(p.width>=18?6:3.6))/Math.max(rows,1));
    return bs.map((b,i)=>({...b,x:(i%cols-(cols-1)/2)*dx,z:p.id==='container'?(Math.floor(Math.floor(i/cols)/2)-1)*4.4+(Math.floor(i/cols)%2?1:-1)*.8:(Math.floor(i/cols)-(rows-1)/2)*dz-.3}));
  }
  function build(s,opts={}){
    const root=new T.Group(),{h}=FloorModel.definitions(s),stats=FloorModel.metrics(s),rows=layout(s),buckets=new Map(),fanMeshes=[],textures=[],materials=[],signs=[];
    /* Segment counts are the cheapest realism available: every one of these geometries is
       instanced, so raising them costs vertices once and nothing per machine. Twelve-sided
       cylinders read as polygons at fan size, and a four-segment torus is a square ring. */
    const geo={box:new T.BoxGeometry(1,1,1),cylinder:new T.CylinderGeometry(1,1,1,20),torus:new T.TorusGeometry(1,.075,8,20)},dummy=new T.Object3D();
    /* `metal` picks a second lit material rather than a second colour: brushed aluminium and
       a painted steel frame reflect differently, and no per-instance colour can express that.
       It costs one extra draw call per geometry that uses it, which is the whole budget. */
    function part(kind,size,pos,color=C.steel,rot=[0,0,0],batch=-1,unlit=false,fan=false,metal=false){
      const key=kind+':'+unlit+':'+fan+':'+metal;if(!buckets.has(key))buckets.set(key,{kind,unlit,fan,metal,items:[]});
      dummy.position.set(...pos);dummy.scale.set(...size);dummy.rotation.set(...rot);dummy.updateMatrix();
      buckets.get(key).items.push({matrix:dummy.matrix.clone(),color,batch,pos,size,rot});
    }
    const box=(size,pos,col,batch=-1,unlit=false)=>part('box',size,pos,col,[0,0,0],batch,unlit);
    const metal=(size,pos,col,batch=-1,rot=[0,0,0])=>part('box',size,pos,col,rot,batch,false,false,true);
    const tube=(size,pos,col,rot=[0,0,0],batch=-1,shiny=false)=>part('cylinder',size,pos,col,rot,batch,false,false,shiny);
    /* A fan reads as a fan when it has a recessed housing, a wire guard and a hub the blades
       actually attach to. Seven blades rather than three, because three is a ceiling fan. */
    function fan(x,y,z,r,id=-1,spinning=false,facing=1){
      part('cylinder',[r*1.06,.05,r*1.06],[x,y,z-facing*.012],C.dark,[Math.PI/2,0,0],id);
      part('torus',[r,r,r],[x,y,z+facing*.027],C.edge,[0,0,0],id,false,false,true);
      part('torus',[r*.66,r*.66,r*.66],[x,y,z+facing*.031],C.edge,[0,0,0],id,false,false,true);
      for(let i=0;i<7;i++)part('box',[r*1.5,r*.34,.022],[x,y,z+facing*.038],C.steel,[0,0,i*Math.PI/3.5],id,false,spinning);
      part('cylinder',[r*.26,.055,r*.26],[x,y,z+facing*.05],C.edge,[Math.PI/2,0,0],id,false,false,true);
      // Four wire spokes across the guard, the way a finger guard is actually made.
      for(let i=0;i<4;i++)part('box',[r*2.02,.022,.022],[x,y,z+facing*.062],C.edge,[0,0,i*Math.PI/4],id,false,false,true);
    }
    const label=(text,pos,width,height=.3)=>signs.push({text,pos,width,height});
    const site=FloorScenery.populate(s,{box,part,fan,label,metal,tube,C});
    rows.forEach(b=>{
      const {x,z}=b,statusColor=colors[b.status],accent=opts.heat?(b.status==='online'?(stats.heatRatio>1?C.red:C.orange):C.dark):statusColor;
      box([1.68,.013,1.3],[x,.088,z],0x34464d,b.id);
      if(s.selected===b.id){
        for(const dz of [-.72,.72])box([1.8,.025,.055],[x,.11,z+dz],C.orange,b.id,true);
        for(const dx of [-.87,.87])box([.055,.025,1.5],[x+dx,.11,z],C.orange,b.id,true);
      }
      FloorMiners.render(b.hardware||h,b,{box,part,fan,metal,tube,C,accent});
      if(b.status==='fault'||b.status==='repair'){
        box([.36,.25,.1],[x,2.48,z],statusColor,b.id,true);box([.035,.11,.02],[x,2.5,z+.07],C.dark,b.id);
        if(b.status==='fault')box([.035,.025,.02],[x,2.4,z+.07],C.dark,b.id);
      }
    });
    for(const bucket of buckets.values()){
      const material=bucket.unlit?new T.MeshBasicMaterial({color:0xffffff})
        :new T.MeshStandardMaterial({color:0xffffff,roughness:bucket.metal?.34:.78,metalness:bucket.metal?.78:.12});
      materials.push(material);
      const mesh=new T.InstancedMesh(geo[bucket.kind],material,bucket.items.length);
      bucket.items.forEach((a,i)=>{mesh.setMatrixAt(i,a.matrix);mesh.setColorAt(i,new T.Color(a.color));});
      mesh.userData.batchIds=bucket.items.map(a=>a.batch);mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);
      if(bucket.fan)fanMeshes.push({mesh,items:bucket.items});
    }
    if(opts.labels!==false&&typeof document!=='undefined')for(const [i,sign] of signs.entries()){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=96;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#15242c';ctx.fillRect(0,0,768,96);ctx.fillStyle='#f7a13d';ctx.font='bold 42px monospace';ctx.textAlign='center';ctx.fillText(sign.text,384,63,730);
      const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);
      const mat=new T.MeshBasicMaterial({map:tex,side:T.DoubleSide});materials.push(mat);
      const g=new T.PlaneGeometry(sign.width,sign.height);geo['sign'+i]=g;
      const mesh=new T.Mesh(g,mat);mesh.position.set(...sign.pos);root.add(mesh);
    }
    let lastAngle=0;
    function animate(t){const angle=t*.008;if(Math.abs(angle-lastAngle)<.015)return;lastAngle=angle;
      for(const {mesh,items} of fanMeshes){items.forEach((a,i)=>{dummy.position.set(...a.pos);dummy.scale.set(...a.size);dummy.rotation.set(a.rot[0],a.rot[1],a.rot[2]+angle);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;}}
    function dispose(){root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});Object.values(geo).forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
    return {root,rows,width:site.width,depth:site.depth,cx:site.cx,cz:site.cz,landmarks:site.items,crew:site.crew,animate,dispose,animated:fanMeshes.length>0,hardware:h};
  }
  return {build,layout,colors};
})();
