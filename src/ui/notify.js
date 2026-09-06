"use strict";

/* NOTIFICATIONS — transient toasts and the bad-event impact effect. These
   are presentation, not simulation; they lived in the engine only because
   the engine raises them. Every entry patches the DOM directly rather than
   triggering a render, so a burst of events cannot rebuild the page. */

function feedbackKind(title,kind="info"){if(kind!=="info")return kind;return /not enough|unavailable|required|blocked|failed|invalid|too small|no (?:running|spendable|saleable|asic)|still due|power down|already (?:on|scheduled)|one-way|limit/i.test(title)?"blocked":"success"}
function feedbackLabel(kind){return({bad:"Action needed",warning:"Advance warning",notice:"Rules change",blocked:"Cannot do that",milestone:"Milestone reached",success:"Completed",info:"Update"})[kind]||"Update"}
function toastMarkup(t){const linked=!!t.tab,kind=feedbackKind(t.title,t.kind),assertive=["bad","warning","notice","blocked"].includes(kind),repeats=Math.max(0,Number(t.repeats)||0);return `<div class="toast toast-${kind} ${linked?"toast-clickable":""} ${repeats?"toast-repeated":""}" role="${assertive?"alert":"status"}" aria-live="${assertive?"assertive":"polite"}" ${linked?`data-action="tab" data-value="${t.tab}"${t.anchor?` data-anchor="${t.anchor}"`:""}`:`data-action="dismiss-toast"`}><div class="toast-copy"><small>${feedbackLabel(kind)}${repeats?` · ${repeats+1} together`:""}</small><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.message)}</span>${repeats?`<em class="toast-repeat">and ${repeats} more like it just now</em>`:""}</div>${linked?`<i class="toast-go"><span>Open ${escapeHtml(t.tab)}</span> →</i>`:""}<button class="toast-dismiss" data-action="dismiss-toast" aria-label="Dismiss this message" title="Dismiss">×</button></div>`}
function dismissToast(){clearTimeout(toastTimer);toastTimer=null;toast=null;document.querySelector(".toast")?.remove()}
/* WHEN THE SAME THING KEEPS HAPPENING.

   A fleet of five thousand machines breaks constantly, and every fault raised its own toast.
   Each one replaced the last, restarted the eight-second timer and — for anything bad — fired
   the screen flash again. The result was a strobe: a notice was on screen at all times, none
   of them stayed long enough to read, and the flash that is supposed to mean "something just
   went wrong" meant "you have a large fleet".

   Repeats of the same notice now fold into the one already showing. It keeps its place, gains
   a count, and gets a little longer on screen for each one so it can actually be read. The
   flash fires for the first of a run and not for the rest, which restores what a flash means.

   Coalescing is by TITLE, because the title is what a notice is about and the message is the
   particulars — "Mining capacity lost to a fault" is one situation whether it is an S19 or an
   S21 this time. A genuinely different notice still interrupts immediately, because a burst of
   faults must never bury the one that says a settlement is due. */
const TOAST_COALESCE_MS=9000,TOAST_BASE_MS=8500,TOAST_MAX_MS=20000;
let toastRepeats=0,toastLastTitle="",toastLastAt=0;
function toastLife(){return Math.min(TOAST_MAX_MS,TOAST_BASE_MS+toastRepeats*1200)}
function showToast(title,message,kind="info",tab=null,anchor=null){
  kind=feedbackKind(title,kind);
  const now=Date.now(),repeat=title===toastLastTitle&&now-toastLastAt<TOAST_COALESCE_MS&&!!document.querySelector(".toast");
  toastRepeats=repeat?toastRepeats+1:0;
  toastLastTitle=title;toastLastAt=now;
  toast={title,message,kind,tab,anchor,repeats:toastRepeats};
  const markup=toastMarkup(toast),existing=document.querySelector(".toast"),host=document.getElementById("app");
  if(existing)existing.outerHTML=markup;else if(host&&state.started)host.insertAdjacentHTML("beforeend",markup);
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{toast=null;document.querySelector(".toast")?.remove()},toastLife());
  // The flash marks the START of a run of trouble, not each item in it.
  if(kind==="bad"&&state.started&&!repeat)triggerImpactEffect();
}
let lastImpactAt=0,flashNode=null,flashTimer=null,shakeTimer=null;
function reducedMotion(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}
function clearImpactFlash(){clearTimeout(flashTimer);flashTimer=null;if(flashNode){flashNode.remove();flashNode=null}
  // Anything a previous session leaked is swept up on the next impact.
  document.querySelectorAll(".impact-flash").forEach(node=>node.remove());}
function triggerImpactEffect(){
  if(reducedMotion())return;
  const now=performance.now(),recent=now-lastImpactAt<4000;lastImpactAt=now;
  // One node, reused. Restarting its animation is what makes a second hit read as a second
  // hit; appending another node only costs a compositing layer.
  clearImpactFlash();
  flashNode=document.createElement("div");flashNode.className="impact-flash";document.body.appendChild(flashNode);
  flashNode.addEventListener("animationend",clearImpactFlash,{once:true});
  // A timer as well, because animationend is not guaranteed to arrive.
  flashTimer=setTimeout(clearImpactFlash,1200);
  // The shake translates the whole app, so a run of faults reads as the page
  // throwing itself around. Flash every time; shake at most once every 4s.
  if(recent)return;
  const shell=document.querySelector(".app");
  if(!shell)return;
  clearTimeout(shakeTimer);
  shell.classList.remove("impact-shake");void shell.offsetWidth;shell.classList.add("impact-shake");
  const drop=()=>shell.classList.remove("impact-shake");
  shell.addEventListener("animationend",drop,{once:true});
  shakeTimer=setTimeout(drop,900);
}
