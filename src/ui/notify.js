"use strict";

/* NOTIFICATIONS — transient toasts and the bad-event impact effect. These
   are presentation, not simulation; they lived in the engine only because
   the engine raises them. Every entry patches the DOM directly rather than
   triggering a render, so a burst of events cannot rebuild the page. */

function feedbackKind(title,kind="info"){if(kind!=="info")return kind;return /not enough|unavailable|required|blocked|failed|invalid|too small|no (?:running|spendable|saleable|asic)|still due|power down|already (?:on|scheduled)|one-way|limit/i.test(title)?"blocked":"success"}
function feedbackLabel(kind){return({bad:"Action needed",warning:"Advance warning",notice:"Rules change",blocked:"Cannot do that",milestone:"Milestone reached",success:"Completed",info:"Update"})[kind]||"Update"}
function toastMarkup(t){const linked=!!t.tab,kind=feedbackKind(t.title,t.kind),assertive=["bad","warning","notice","blocked"].includes(kind);return `<div class="toast toast-${kind} ${linked?"toast-clickable":""}" role="${assertive?"alert":"status"}" aria-live="${assertive?"assertive":"polite"}" ${linked?`data-action="tab" data-value="${t.tab}"${t.anchor?` data-anchor="${t.anchor}"`:""}`:`data-action="dismiss-toast"`}><div class="toast-copy"><small>${feedbackLabel(kind)}</small><b>${escapeHtml(t.title)}</b><span>${escapeHtml(t.message)}</span></div>${linked?`<i class="toast-go"><span>Open ${escapeHtml(t.tab)}</span> →</i>`:""}<button class="toast-dismiss" data-action="dismiss-toast" aria-label="Dismiss this message" title="Dismiss">×</button></div>`}
function dismissToast(){clearTimeout(toastTimer);toastTimer=null;toast=null;document.querySelector(".toast")?.remove()}
function showToast(title,message,kind="info",tab=null,anchor=null){kind=feedbackKind(title,kind);toast={title,message,kind,tab,anchor};const markup=toastMarkup(toast),existing=document.querySelector(".toast"),host=document.getElementById("app");if(existing)existing.outerHTML=markup;else if(host&&state.started)host.insertAdjacentHTML("beforeend",markup);clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast=null;document.querySelector(".toast")?.remove()},8500);if(kind==="bad"&&state.started)triggerImpactEffect()}
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
