"use strict";

/* WHAT LENDERS AND INSURERS SEE — the custody posture, what is holding it back, and the audit that
   certifies it.

   The arithmetic is in engine/credit.js. This draws it. Every finding is shown with the rung it
   blocks, because a rung the player cannot see how to climb is just a number. */

const POSTURE_COPY={
  none:"Nobody will price a risk on this. There is no wallet that can sign, or one that could not be rebuilt if a signer were lost.",
  basic:"It can sign and it can be rebuilt. That is the minimum anybody will look at, and the least they will pay for.",
  strong:"Nothing about it is a known weakness. This is what a lender or an insurer wants to see before they offer their best terms.",
  audited:"Strong, and somebody independent has looked within the last year. The best terms there are."
};
function postureTone(tier){return tier==="none"?"high":tier==="basic"?"medium":"low"}

function custodyPostureSection(){
  const p=custodyPosture();
  const rows=p.findings.map(f=>`<li><b class="${f.blocks==="basic"?"profit-negative":""}">${f.blocks==="basic"?"Blocks basic":"Blocks strong"}</b> · ${f.text}</li>`).join("");
  return `<div class="risk ${postureTone(p.tier)}">Posture: ${p.tier}${p.tier==="audited"?` until ${dateFmt(custodyAuditUntil())}`:""}</div>
    <p class="modal-note">${POSTURE_COPY[p.tier]}</p>
    ${rows?`<ul class="posture-findings">${rows}</ul>`:""}`;
}

function custodyAuditSection(){
  if(state.time<AUDIT_START)return "";
  const job=custodyAuditJob(),reason=auditBlockReason(),last=state.custody.lastAudit;
  if(job){
    const left=Math.max(0,Math.ceil((job.due-state.time)/DAY)),done=Math.max(0,Math.min(100,Math.round((1-(job.due-state.time)/Math.max(DAY,job.due-job.started))*100)));
    return `<div class="incoming-fleet-row"><div class="incoming-fleet-name"><b>Audit under way</b><small>${left}d remaining · your security officer is reviewing the keys</small><div class="bar" style="--w:${done}%;--bar:var(--blue)"><i></i></div></div></div>`;
  }
  const result=last?`<p class="modal-note">Last audit, ${dateFmt(last.at)}: <b class="${last.passed?"profit-positive":"profit-negative"}">${last.passed?"passed":"found problems"}</b>${last.passed?"":`. ${last.findings.join(" ")}`}</p>`:"";
  return `<div class="actions"><button class="action small ${reason?"":"primary"}" data-action="custody-audit" ${reason?`disabled title="${escapeHtml(reason)}"`:""}>Commission an audit · ${fmtUsd(AUDIT_COST)} · ${AUDIT_DAYS} days</button></div>
    ${reason?`<p class="modal-note">${reason}</p>`:`<p class="modal-note">Your security officer reviews the setup and reports every finding, whether or not it passes. A pass is a certificate for a year.</p>`}${result}`;
}

/* Cover against theft: what it costs at today's posture, what it pays, and, because it matters more
   than either, what it will not. */
function custodyCoverSection(){
  if(state.time<COVER_START)return "";
  const p=custodyPosture(),cover=coinCover(),reason=coinCoverBlockReason(),quote=coinCoverQuote(p.tier);
  const excluded=Object.values(COVER_EXCLUDED).map(t=>`<li>${t}</li>`).join("");
  const status=cover
    ?`<div class="risk ${state.time<cover.since+COVER_WAIT_DAYS*DAY?"medium":"low"}">Cover bound ${dateFmt(cover.since)} · ${fmtUsd(coinCoverPremium())} a month${state.time<cover.since+COVER_WAIT_DAYS*DAY?` · pays from ${dateFmt(cover.since+COVER_WAIT_DAYS*DAY)}`:""}</div>`
    :quote?`<p class="modal-note">At a <b>${p.tier}</b> posture, cover would cost about <b>${fmtUsd(quote.premium)}</b> a month and pay <b>${Math.round(quote.pays*100)}%</b> of a covered theft, from thirty days after it is bound. A better posture is cheaper and pays more.</p>`:"";
  return `<h4>Cover against theft</h4>${status}
    <div class="actions"><button class="action small ${cover?"":reason?"":"primary"}" data-action="custody-cover" ${!cover&&reason?`disabled title="${escapeHtml(reason)}"`:""}>${cover?"Cancel cover":"Bind cover"}</button></div>
    ${!cover&&reason?`<p class="modal-note">${reason}</p>`:""}
    <p class="modal-note">It pays for the online wallet being emptied and for a break-in. It does not pay for a venue failing, for coins nobody can spend any more, or for neglect:</p><ul class="posture-findings">${excluded}</ul>`;
}

function custodyCounterpartiesCard(){
  return `<section class="card span-12 custody-counterparties"><div class="card-head"><h2>What lenders and insurers see</h2><div class="meta">${custodyPosture().tier.toUpperCase()} POSTURE</div></div>
    <div class="card-pad">${custodyPostureSection()}${custodyAuditSection()}${custodyCoverSection()}</div></section>`;
}
