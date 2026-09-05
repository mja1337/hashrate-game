"use strict";

/* MOUNTING A CANVAS IN A PAGE THAT REBUILDS ITSELF.

   render() replaces the whole of #app with a new string. Anything inside it is destroyed and
   recreated, which is fine for markup and fatal for a WebGL canvas: a new canvas means a new
   context, new buffers, new textures, several times a second. So the canvas is created once
   and kept in a variable here. Each repaint re-attaches that same element into whatever
   placeholder the new markup provides. The element outlives the markup around it.

   The scene inside it is rebuilt only when the floor has actually changed — a signature of
   the site, the fleet and the state of each batch. Repainting because a number ticked over
   must not cost a scene rebuild, and at a megacampus a rebuild is around 17ms.

   Three.js is half a megabyte and this floor is opt-in, so the library is fetched the first
   time somebody turns it on and never for anyone who does not. That is a same-origin script
   tag, the same mechanism index.html uses, deferred — not a call to any outside service.

   Nothing here is required for the game to work. Every failure path ends at the SVG floor. */

const FLOOR3D_SCRIPTS=["vendor/three.floor.js","src/ui/floor3d/silhouettes.js",
  "src/ui/floor3d/cooling.js","src/ui/floor3d/scenery.js","src/ui/floor3d/scene.js",
  "src/ui/floor3d/model.js"];

let floor3dState="idle";      // idle | loading | ready | unsupported | failed
let floor3dRenderer=null,floor3dCanvas=null,floor3dCamera=null;
let floor3dBuilt=null,floor3dSignature="",floor3dRaf=0,floor3dReason="";

function floor3dSupported(){
  if(floor3dState==="unsupported")return false;
  try{
    const probe=document.createElement("canvas");
    return !!(probe.getContext("webgl2")||probe.getContext("webgl"));
  }catch(e){return false}
}
function floor3dUnavailableReason(){
  if(floor3dReason)return floor3dReason;
  if(!floor3dSupported())return "This browser cannot open a 3D context.";
  return "";
}
function floor3dWanted(){return state.floorView==="3d"}

/* Loads the library and the view modules once, in order, then paints. A failure here is not
   an error the player has to deal with — it turns the toggle off and says why. */
function ensureFloor3dLoaded(){
  if(floor3dState==="ready"||floor3dState==="loading")return;
  if(!floor3dSupported()){floor3dState="unsupported";floor3dReason="This browser cannot open a 3D context.";render();return}
  floor3dState="loading";
  let chain=Promise.resolve();
  for(const src of FLOOR3D_SCRIPTS){
    chain=chain.then(()=>new Promise((resolve,reject)=>{
      if(document.querySelector(`script[data-floor3d="${src}"]`))return resolve();
      const node=document.createElement("script");
      node.src=src;node.dataset.floor3d=src;
      node.onload=resolve;node.onerror=()=>reject(new Error(src));
      document.head.appendChild(node);
    }));
  }
  chain.then(()=>{floor3dState="ready";renderFullQueued=true;render()})
    .catch(error=>{
      floor3dState="failed";
      floor3dReason=`The 3D floor could not load (${error.message}). The flat floor is unchanged.`;
      state.floorView="2d";save();render();
    });
}

/* What the floor looks like, reduced to a string. If this has not changed there is nothing
   to rebuild, however many times the page has repainted. */
function floor3dSignatureNow(){
  const parts=[state.facility,state.region,floor3dWanted()?"3d":"2d",
    state.power?"on":"off",typeof thermalPowerAvailable==="function"&&thermalPowerAvailable()?"cool":"hot",
    (state.staff||[]).slice().sort().join(","),
    Object.keys(state.thermal?.equipment||{}).sort().map(k=>k+state.thermal.equipment[k]).join(","),
    (state.thermal?.orders||[]).map(o=>o.id+(o.qty||1)).sort().join(","),
    typeof immersionTotal==="function"?"imm"+immersionTotal():""];
  for(const b of floorBatches())parts.push(b.id+b.status+b.qty);
  return parts.join("|");
}

function floor3dEnsureRenderer(){
  if(floor3dRenderer)return true;
  try{
    floor3dRenderer=new FloorThree.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});
    floor3dRenderer.setClearColor(0x101b24);
    floor3dRenderer.outputColorSpace=FloorThree.SRGBColorSpace;
    floor3dCanvas=floor3dRenderer.domElement;
    floor3dCanvas.className="floor-3d-canvas";
    floor3dCanvas.setAttribute("aria-label","Three-dimensional view of the mining floor. The flat floor above carries the same information.");
    floor3dCamera=new FloorThree.OrthographicCamera(-10,10,10,-10,.1,150);
    // A lost context is not recoverable here; fall back rather than leave a dead rectangle.
    floor3dCanvas.addEventListener("webglcontextlost",event=>{
      event.preventDefault();floor3dStop();
      floor3dState="failed";floor3dReason="The browser dropped the 3D context. The flat floor is unchanged.";
      state.floorView="2d";save();render();
    });
    return true;
  }catch(e){
    floor3dState="failed";floor3dReason="A 3D context could not be created.";
    return false;
  }
}

/* WHAT A MACHINE IN TROUBLE LOOKS LIKE.

   Colour alone is a poor alarm on a floor of two hundred boxes — it reads as decoration.
   Movement does not, which is why anything that needs a decision pulses and everything
   healthy sits still. Four states, told apart because they need four different responses:

     red      faulted; it has stopped earning and wants a part
     amber    condition inside the last band before the whole type goes offline at 65%
     blue     the grid has cut the site, or a policy has
     violet   the site is hashing but cannot reach the network

   A machine that is simply switched off does not pulse. That is a decision you already made
   and not a problem to solve. */
const FLOOR3D_ALERTS={
  fault:  {colour:0xd9483c, speed:2.9, depth:.85},
  ailing: {colour:0xe0a53a, speed:1.7, depth:.62},
  power:  {colour:0x4f8fd6, speed:1.1, depth:.70},
  network:{colour:0x9b6fd4, speed:1.4, depth:.58},
};
function floor3dAlertFor(batch){
  if(!batch)return null;
  if(batch.status==="fault")return FLOOR3D_ALERTS.fault;
  if(batch.reason==="grid"||batch.reason==="sitepower")return FLOOR3D_ALERTS.power;
  if(batch.reason==="network")return FLOOR3D_ALERTS.network;
  if(batch.ailing&&batch.status!=="repair")return FLOOR3D_ALERTS.ailing;
  return null;
}

/* The assembler already stamps every instance with the batch it belongs to, so the pulse can
   be applied over the top of a finished scene without the renderer knowing anything about
   maintenance. Base colours are captured once; each frame writes base blended toward the
   alert colour and nothing else is touched. */
let floor3dBaseColours=null,floor3dAlertMap=null;
function floor3dPrepareAlerts(){
  floor3dBaseColours=[];floor3dAlertMap=new Map();
  for(const batch of FloorModel.batches()){
    const alert=floor3dAlertFor(batch);
    if(alert)floor3dAlertMap.set(batch.id,alert);
  }
  if(!floor3dBuilt)return;
  floor3dBuilt.root.traverse(node=>{
    if(!node.isInstancedMesh||!node.instanceColor)return;
    floor3dBaseColours.push({mesh:node,base:Float32Array.from(node.instanceColor.array),
      ids:node.userData.batchIds||[]});
  });
}
function floor3dPulse(time){
  if(!floor3dBaseColours||!floor3dAlertMap||!floor3dAlertMap.size)return;
  const target=new FloorThree.Color();
  for(const {mesh,base,ids} of floor3dBaseColours){
    let touched=false;
    for(let i=0;i<ids.length;i++){
      const alert=floor3dAlertMap.get(ids[i]);
      if(!alert)continue;
      const wave=(Math.sin(time*.001*alert.speed*Math.PI)+1)/2;
      const mix=alert.depth*wave;
      target.setHex(alert.colour);
      const o=i*3;
      mesh.instanceColor.array[o]  =base[o]  +(target.r-base[o])  *mix;
      mesh.instanceColor.array[o+1]=base[o+1]+(target.g-base[o+1])*mix;
      mesh.instanceColor.array[o+2]=base[o+2]+(target.b-base[o+2])*mix;
      touched=true;
    }
    if(touched)mesh.instanceColor.needsUpdate=true;
  }
}
function floor3dAnythingWrong(){return !!(floor3dAlertMap&&floor3dAlertMap.size)}

/* Small vector helpers. The bundled three.js is tree-shaken and does not carry the maths
   classes, and this is less code than the parts of them that would be needed. */
function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}
function norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l]}

function floor3dStop(){if(floor3dRaf){cancelAnimationFrame(floor3dRaf);floor3dRaf=0}}
function floor3dDisposeScene(){
  if(floor3dBuilt&&floor3dBuilt.dispose)floor3dBuilt.dispose();
  floor3dBuilt=null;floor3dSignature="";
}

function floor3dDraw(){
  if(!floor3dBuilt||!floor3dRenderer)return;
  const host=floor3dCanvas.parentElement;
  if(!host)return;
  const width=Math.max(1,host.clientWidth),height=Math.max(1,Math.round(width*.42));
  floor3dRenderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  floor3dRenderer.setSize(width,height,false);
  const bounds=floor3dBounds;
  if(!bounds)return;
  /* Fit what the camera will actually SEE, not the size of the thing in world space. A
     mining room is wide and flat, so seen down an isometric axis it is far shorter than it is
     broad; sizing both axes from one radius left a third of the frame empty above and below.
     The eight corners of the bounds are projected onto the camera's own right and up vectors
     and the frustum is fitted to those extents. */
  const reach=bounds.radius*4;
  const eye=[bounds.x+reach,bounds.y+reach*.8,bounds.z+reach];
  const fwd=norm([bounds.x-eye[0],bounds.y-eye[1],bounds.z-eye[2]]);
  const right=norm(cross(fwd,[0,1,0]));
  const up=cross(right,fwd);
  let halfW=0,halfH=0;
  for(const cx of [bounds.minX,bounds.maxX])for(const cy of [bounds.minY,bounds.maxY])for(const cz of [bounds.minZ,bounds.maxZ]){
    const d=[cx-bounds.x,cy-bounds.y,cz-bounds.z];
    halfW=Math.max(halfW,Math.abs(dot(d,right)));
    halfH=Math.max(halfH,Math.abs(dot(d,up)));
  }
  // A little air so the roofline and the front edge of the floor are not touching the frame.
  const margin=1.12;
  halfW=Math.max(halfW*margin,.5);halfH=Math.max(halfH*margin,.5);
  // Whichever axis does not fit its half of the frame decides the zoom.
  const fitW=halfW,fitH=halfH,frameAspect=width/height;
  let viewW=fitW,viewH=fitH;
  if(fitW/fitH>frameAspect)viewH=fitW/frameAspect; else viewW=fitH*frameAspect;
  floor3dCamera.left=-viewW;floor3dCamera.right=viewW;
  floor3dCamera.top=viewH;floor3dCamera.bottom=-viewH;
  floor3dCamera.position.set(eye[0],eye[1],eye[2]);
  floor3dCamera.far=reach*4;
  floor3dCamera.lookAt(bounds.x,bounds.y,bounds.z);
  floor3dCamera.updateProjectionMatrix();
  floor3dRenderer.render(floor3dScene,floor3dCamera);
}

/* Measuring the scene without Box3.

   The bundled three.js is tree-shaken down to thirty exports and Box3 is not among them, so
   the bounds are read straight out of the instance matrices. Done once per rebuild and
   cached, which is where it belonged anyway: the previous attempt rebuilt a bounding box
   every frame to answer a question that only changes when the floor does.

   The size of an instance is its geometry's own local box put through the instance matrix,
   NOT the length of the matrix's basis vectors. A basis vector's length is the SCALE, and a
   BoxGeometry runs from -0.5 to 0.5, so treating scale as a half-extent measured every box
   at twice its size and left a quarter of the frame empty on all four sides. Cylinders and
   the fan torus are not unit-sized either, which is the other reason to ask the geometry.

   Framing off the footprint alone was the bug this replaces. It ignored everything standing
   ON the floor — walls, racks, the service bay — so a short frame clipped the top of the
   room while leaving a gap beneath it, because the camera was aimed at the ground rather
   than at the middle of what there was to look at. */
let floor3dBounds=null;
function floor3dMeasure(root){
  let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity,found=false;
  root.traverse(node=>{
    if(!node.isInstancedMesh||!node.instanceMatrix)return;
    const g=node.geometry;
    if(!g)return;
    if(!g.boundingBox)g.computeBoundingBox();
    const bb=g.boundingBox;
    if(!bb)return;
    // Local centre and half-extent of whatever shape this mesh instances.
    const lx=(bb.min.x+bb.max.x)/2,ly=(bb.min.y+bb.max.y)/2,lz=(bb.min.z+bb.max.z)/2,
          hx=(bb.max.x-bb.min.x)/2,hy=(bb.max.y-bb.min.y)/2,hz=(bb.max.z-bb.min.z)/2;
    const m=node.instanceMatrix.array;
    for(let i=0;i<node.count;i++){
      const o=i*16;
      // Centre through the matrix, then the standard transformed-AABB half-extent: each
      // world axis takes a contribution from every local axis it is rotated across.
      const x=m[o]*lx+m[o+4]*ly+m[o+8]*lz+m[o+12],
            y=m[o+1]*lx+m[o+5]*ly+m[o+9]*lz+m[o+13],
            z=m[o+2]*lx+m[o+6]*ly+m[o+10]*lz+m[o+14];
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))continue;
      const ex=Math.abs(m[o])*hx+Math.abs(m[o+4])*hy+Math.abs(m[o+8])*hz,
            ey=Math.abs(m[o+1])*hx+Math.abs(m[o+5])*hy+Math.abs(m[o+9])*hz,
            ez=Math.abs(m[o+2])*hx+Math.abs(m[o+6])*hy+Math.abs(m[o+10])*hz;
      minX=Math.min(minX,x-ex);maxX=Math.max(maxX,x+ex);
      minY=Math.min(minY,y-ey);maxY=Math.max(maxY,y+ey);
      minZ=Math.min(minZ,z-ez);maxZ=Math.max(maxZ,z+ez);
      found=true;
    }
  });
  if(!found)return null;
  const x=(minX+maxX)/2,y=(minY+maxY)/2,z=(minZ+maxZ)/2;
  const radius=Math.max(maxX-minX,maxY-minY,maxZ-minZ)/2||1;
  return {x,y,z,radius,minX,minY,minZ,maxX,maxY,maxZ};
}

let floor3dScene=null;
function floor3dBuildScene(){
  const T=FloorThree;
  if(!floor3dScene){
    floor3dScene=new T.Scene();
    floor3dScene.add(new T.HemisphereLight(0xe6f6ff,0x33424c,2.4));
    const key=new T.DirectionalLight(0xffe8c2,3);key.position.set(6,15,10);floor3dScene.add(key);
    const fill=new T.DirectionalLight(0x80b9ea,1.1);fill.position.set(-8,5,-3);floor3dScene.add(fill);
  }
  if(floor3dBuilt){floor3dScene.remove(floor3dBuilt.root);floor3dDisposeScene()}
  floor3dBuilt=FloorScene.build(FloorModel.describe(),{});
  floor3dScene.add(floor3dBuilt.root);
  floor3dBounds=floor3dMeasure(floor3dBuilt.root)||{x:floor3dBuilt.cx,y:1,z:floor3dBuilt.cz,
    radius:Math.max(floor3dBuilt.width,floor3dBuilt.depth)/2};
  floor3dPrepareAlerts();
}

/* Called after every repaint of the Mine tab. Re-attaches the surviving canvas, rebuilds the
   scene only if the floor actually changed, and runs the fan animation only when the tab is
   visible and the player has not asked for less motion. */
function mountFloor3d(){
  const host=document.querySelector(".floor-3d-mount");
  if(!host){floor3dStop();return}
  if(floor3dState!=="ready"){ensureFloor3dLoaded();return}
  if(!floor3dEnsureRenderer()){render();return}
  if(floor3dCanvas.parentElement!==host)host.appendChild(floor3dCanvas);
  const signature=floor3dSignatureNow();
  if(signature!==floor3dSignature){floor3dBuildScene();floor3dSignature=signature}
  floor3dDraw();
  floor3dStop();
  const still=typeof reducedMotion==="function"&&reducedMotion();
  if(!still&&floor3dBuilt&&(floor3dBuilt.animated||floor3dAnythingWrong())){
    const step=time=>{
      if(document.hidden||!floor3dCanvas.parentElement){floor3dRaf=0;return}
      if(floor3dBuilt.animated)floor3dBuilt.animate(time);
      floor3dPulse(time);
      floor3dDraw();
      floor3dRaf=requestAnimationFrame(step);
    };
    floor3dRaf=requestAnimationFrame(step);
  }
}
