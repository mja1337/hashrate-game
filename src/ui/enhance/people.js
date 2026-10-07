"use strict";

/* PEOPLE, AS THE PLAYER MEETS THEM — who holds each key, what it takes to replace one, and the
   warning on the staff card before somebody who knows a key is let go.

   The engine is engine/keyholders.js. This only draws it. */

function custodyExposureWords(key){
  const e=key.exposed;if(!e)return "";
  return e.cause==="former-employee"
    ?`known to a former ${(STAFF.find(r=>r.id===e.role)?.name||"employee").toLowerCase()}`
    :"its backup was stolen";
}

/* A spare signer a replacement key could be generated on. */
function custodySpareSigners(){
  return (state.custody.devices||[]).filter(d=>!d.destroyed&&!d.keyId&&d.place!=="transit");
}

function custodyHolderControls(key){
  if(key.retired)return `<div class="holder-row"><small>Retired${key.holder?"":""}: it no longer controls anything.</small></div>`;
  const holder=custodyHolder(key),assigned=state.custody.assigned.includes(key.id);
  const give=CUSTODY_HOLDERS.filter(h=>h!==holder&&custodyHolderAvailable(h))
    .map(h=>`<button class="action small" data-action="custody-holder" data-id="${key.id}" data-value="${h}">Give to ${custodyHolderName(h)}</button>`).join("");
  const spare=custodySpareSigners(),rotating=custodyRotation();
  let rotate="";
  if(assigned&&!rotating){
    rotate=spare.length
      ?spare.map(d=>`<button class="action small ${key.exposed||key.weakEntropy?"primary":""}" data-action="custody-rotate" data-id="${key.id}" data-value="${d.uid}" title="Generates a new key on this signer, sweeps every coin to it and retires ${key.label}. ${rotationDays()} days.">Rotate onto ${custodyProduct(d.product)?.name||"a spare signer"} · ${rotationDays()}d</button>`).join("")
      :`<small class="modal-note">Replacing this key needs a spare signer with no key on it.</small>`;
  }
  return `<div class="holder-row"><small>Held by <b>${custodyHolderName(holder)}</b>${key.exposed?` · <b class="profit-negative">exposed: ${custodyExposureWords(key)}</b>`:""}${key.weakEntropy?` · <b class="profit-negative">weak seed</b>`:""}</small>
    <div class="actions">${give}${rotate}</div></div>`;
}

function custodyRotationRows(){
  const job=custodyRotation();if(!job)return "";
  const old=custodyKey(job.old),fresh=custodyKey(job.new),left=Math.max(0,Math.ceil((job.due-state.time)/DAY)),done=Math.max(0,Math.min(100,Math.round((1-(job.due-state.time)/Math.max(DAY,job.due-job.started))*100)));
  return `<div class="incoming-fleet-row"><div class="incoming-fleet-name"><b>Rotating ${old?old.label:"a key"} → ${fresh?fresh.label:"a new key"}</b><small>${left}d remaining · coins being swept to the new wallet · ${fmtBtc(job.fee)} network fee · signing is paused</small><div class="bar" style="--w:${done}%;--bar:var(--blue)"><i></i></div></div></div>`;
}
