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

function floor3dStop(){if(floor3dRaf){cancelAnimationFrame(floor3dRaf);floor3dRaf=0}}
function floor3dDisposeScene(){
  if(floor3dBuilt&&floor3dBuilt.dispose)floor3dBuilt.dispose();
  floor3dBuilt=null;floor3dSignature="";
}

function floor3dDraw(){
  if(!floor3dBuilt||!floor3dRenderer)return;
  const host=floor3dCanvas.parentElement;
  if(!host)return;
  const width=Math.max(1,host.clientWidth),height=Math.max(1,Math.round(width*.62));
  floor3dRenderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  floor3dRenderer.setSize(width,height,false);
  const span=Math.max(floor3dBuilt.width,floor3dBuilt.depth)*.72,aspect=width/height;
  floor3dCamera.left=-span*aspect;floor3dCamera.right=span*aspect;
  floor3dCamera.top=span;floor3dCamera.bottom=-span;
  floor3dCamera.position.set(floor3dBuilt.cx+span*1.1,span*1.25,floor3dBuilt.cz+span*1.1);
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
  if(!still&&floor3dBuilt&&floor3dBuilt.animated){
    const step=time=>{
      if(document.hidden||!floor3dCanvas.parentElement){floor3dRaf=0;return}
      floor3dBuilt.animate(time);floor3dDraw();
      floor3dRaf=requestAnimationFrame(step);
    };
    floor3dRaf=requestAnimationFrame(step);
  }
}
