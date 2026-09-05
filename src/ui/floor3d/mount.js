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
  "src/ui/floor3d/scenery.js","src/ui/floor3d/scene.js","src/ui/floor3d/model.js"];

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
    Object.keys(state.thermal?.equipment||{}).sort().map(k=>k+state.thermal.equipment[k]).join(",")];
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
  /* Framing. The span decides how much empty room sits around the floor; .72 left the site
     swimming in it. Fitted to the larger of the two footprint axes with a small margin, and
     divided down when the frame is wide so a letterbox does not push the site away. */
  const footprint=Math.max(floor3dBuilt.width,floor3dBuilt.depth),aspect=width/height;
  const span=footprint*.54/Math.max(1,Math.sqrt(aspect/1.6));
  floor3dCamera.left=-span*aspect;floor3dCamera.right=span*aspect;
  floor3dCamera.top=span;floor3dCamera.bottom=-span;
  floor3dCamera.position.set(floor3dBuilt.cx+footprint,footprint*.86,floor3dBuilt.cz+footprint);
  floor3dCamera.lookAt(floor3dBuilt.cx,0,floor3dBuilt.cz);
  floor3dCamera.updateProjectionMatrix();
  floor3dRenderer.render(floor3dScene,floor3dCamera);
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
