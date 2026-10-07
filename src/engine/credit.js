"use strict";

/* CREDIT — what borrowing costs, and what the lender asks to see.

   The operating loan's rate used to be written out in seven places: the month-end bill, the
   settlement forecast, the reserve milestone, the Finance screen three times and a label. They
   agreed only because nobody had changed one. Anything that is about to make the rate depend on
   something has to start by making it one thing, so this is that, and nothing else yet.

   Loaded after keyholders.js; nothing here runs before the page has finished parsing. */

/* The monthly rate on the operating loan. */
function projectLoanRate(){return hasStaff("treasurer")?.009:.012}
/* What all outstanding borrowing adds to the next bill. */
function financeInterestMonthly(){return (state.projectLoan||0)*projectLoanRate()}

/* ---- what a lender or an insurer sees ----------------------------------------------------- */

/* CUSTODY POSTURE: one word for how well the keys are kept, so that whoever prices a risk on them
   does not have to read the whole setup.

     NONE      no wallet that can sign, or one that could not be rebuilt if a signer were lost
     BASIC     it can sign and it can be rebuilt
     STRONG    and nothing about it is a known weakness: no key anybody else knows, no seed with a
               known flaw, the places recorded and no single one of them holding everything needed,
               and every backup on something that survives a fire
     AUDITED   strong, and somebody independent has looked within the last year

   Every finding says what is wrong in a sentence, and which rung it blocks. The audit reports the
   same list, because an audit that found something the player could not already see would be
   a trick rather than a service. */

const AUDIT_START=Date.parse("2014-01-01T00:00:00Z");   // the first firms that would look at a bitcoin custody setup
const AUDIT_COST=4000,AUDIT_DAYS=14,AUDIT_VALID_DAYS=365;
const POSTURE_TIERS=["none","basic","strong","audited"];

function custodyAuditUntil(s=state){return Number(s.custody&&s.custody.auditUntil)||0}
function custodyAuditValid(s=state){return custodyAuditUntil(s)>s.time}
function custodyAuditJob(s=state){return (s.custody&&s.custody.audit)||null}

function custodyPostureFindings(s=state){
  const set=custodySetup(s),out=[],add=(id,text,blocks)=>out.push({id,text,blocks});
  if(!set.ready)add("unsigned","No wallet can sign yet: not every key the policy needs is assigned.","basic");
  else if(!custodyRecoverable(s))add("unrecoverable","The wallet could not be rebuilt if a signer were lost: a backup or the quorum's configuration is missing.","basic");
  if(set.exposed>0)add("exposed","A key of this wallet is known to somebody else. Replace it.","strong");
  if(custodyAssignedKeys(s).some(k=>k.weakEntropy))add("weak","A key was generated from a seed with a known flaw. Replace it.","strong");
  if(set.ready&&!set.placed)add("unplaced","Nothing records where the keys are kept, so nobody can say what a fire would take.","strong");
  if(set.placed&&set.fragile)add("fragile",`Losing ${custodyPlaceName(set.fragileAt)} would leave the wallet unrecoverable.`,"strong");
  if(set.ready&&set.steelBacked<set.assigned.length)add("paper","Some seed backups are on paper, which a fire or a flood destroys.","strong");
  if(set.ready&&set.liveDistinct<set.policy.threshold)add("signers","Too few working signers: a device was destroyed or is on its way.","strong");
  return out;
}
function custodyPosture(s=state){
  const findings=custodyPostureFindings(s),blocks=tier=>findings.some(f=>f.blocks===tier);
  let rank=0;
  if(!blocks("basic")){rank=1;if(!blocks("strong")){rank=2;if(custodyAuditValid(s))rank=3}}
  return{tier:POSTURE_TIERS[rank],rank,findings};
}

/* ---- the audit --------------------------------------------------------------------------------- */

function auditBlockReason(s=state){
  if(s.time<AUDIT_START)return "Nobody audits bitcoin custody this early.";
  if(custodyAuditJob(s))return "An audit is already under way.";
  if(!hasStaff("security"))return "An audit is run by your security officer. Hire one first.";
  if(s.cash<AUDIT_COST)return `An audit costs ${fmtUsd(AUDIT_COST)} and you have ${fmtUsd(s.cash)}.`;
  if(!custodySetup(s).ready)return "There is no wallet to audit yet.";
  return "";
}
function commissionCustodyAudit(){
  const reason=auditBlockReason();
  if(reason)return showToast("Cannot start an audit",reason,"bad","custody");
  state.cash-=AUDIT_COST;
  state.custody.audit={started:state.time,due:state.time+AUDIT_DAYS*DAY,cost:AUDIT_COST};
  log("Custody audit commissioned",`${fmtUsd(AUDIT_COST)} · ${AUDIT_DAYS} days`,"custody");
  showToast("Audit under way",`Your security officer is reviewing the keys. It takes ${AUDIT_DAYS} days and reports every finding, whether or not it passes.`,"info","custody");
  save();render();
}
function advanceAudit(silent=false){
  const c=state.custody,job=custodyAuditJob();
  if(!job||pendingAt(job,state.time))return;
  const findings=custodyPostureFindings(),blocking=findings.filter(f=>f.blocks==="basic"||f.blocks==="strong"),passed=blocking.length===0;
  c.audit=null;c.lastAudit={at:state.time,passed,findings:findings.map(f=>f.text)};
  if(passed)c.auditUntil=state.time+AUDIT_VALID_DAYS*DAY;
  log(passed?"Custody audit passed":`Custody audit: ${blocking.length} finding${blocking.length===1?"":"s"}`,
    passed?`Valid until ${dateFmt(c.auditUntil)}`:blocking.map(f=>f.text).join(" "),"custody");
  if(!silent)showToast(passed?"Audit passed":"Audit found problems",
    passed?`Your custody is audited until ${dateFmt(c.auditUntil)}. Anybody who prices a risk on your keys can see it.`:`${blocking.map(f=>f.text).join(" ")} Fix them and ask again.`,passed?"success":"bad","custody");
  renderFullQueued=true;
}
