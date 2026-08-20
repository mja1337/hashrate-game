"use strict";

/* ENGINE LAYER — cross-run career persistence and the end-of-run narrative recap.
   Kept in its own file rather than simulation.js, which is already past the agreed module ceiling. */
const CAREER_KEY="hashrate-career-v1";
function loadCareer(){
  try{const raw=localStorage.getItem(CAREER_KEY);if(raw)return Object.assign({runs:0,bestScore:0,bestGrade:"At risk",bestDifficulty:null,sandboxCompletions:0,milestonesEverHit:0},JSON.parse(raw))}catch(e){}
  return{runs:0,bestScore:0,bestGrade:"At risk",bestDifficulty:null,sandboxCompletions:0,milestonesEverHit:0};
}
function saveCareer(career){try{localStorage.setItem(CAREER_KEY,JSON.stringify(career))}catch(e){}}
function recordCareerRun(){
  const career=loadCareer(),score=operatorScoreBreakdown();
  career.runs+=1;
  if(score.total>career.bestScore){career.bestScore=score.total;career.bestGrade=operatorGrade(score.total);career.bestDifficulty=state.difficulty}
  if(state.endReason==="sandbox-complete")career.sandboxCompletions+=1;
  career.milestonesEverHit=Math.max(career.milestonesEverHit,state.milestones.length);
  saveCareer(career);
}
function careerSummaryHtml(context="intro"){
  const career=loadCareer();if(career.runs<1)return"";
  const kicker=context==="end"?`Career record · run ${career.runs} complete`:`Career record · about to start run ${career.runs+1}`;
  return `<div class="career-summary"><span class="career-summary-kicker">${kicker}</span><div class="career-summary-stats"><div><b>${fmtNum(career.runs)}</b><span>run${career.runs===1?"":"s"} completed</span></div><div><b>${career.bestGrade} · ${fmtNum(career.bestScore)}</b><span>best score${career.bestDifficulty?` · ${startingMode(career.bestDifficulty).label}`:""}</span></div><div><b>${fmtNum(career.sandboxCompletions)}</b><span>centur${career.sandboxCompletions===1?"y":"ies"} completed</span></div><div><b>${career.milestonesEverHit} / ${MILESTONES.length}</b><span>best milestone haul</span></div></div></div>`;
}
function runRecap(){
  const eras=OPERATOR_ERAS.map(era=>({era,stats:operatorEraStats(era),score:operatorEraScore(operatorEraStats(era))})).filter(x=>x.stats&&x.stats.months>0);
  const best=eras.reduce((top,x)=>!top||x.score>top.score?x:top,null),worst=eras.reduce((low,x)=>!low||x.score<low.score?x:low,null);
  const lived=EVENTS.filter(e=>e.imp===3&&state.seen.includes(e.id)),sample=lived.slice(0,3).map(e=>e.title);
  const rescues=(state.operator.bridgeLoans||0)+(state.operator.restructures||0),years=((state.time-(state.campaignStart||START))/DAY/365.25).toFixed(1),score=operatorScoreBreakdown();
  const eraLine=best&&worst&&best.era.id!==worst.era.id?`Operations were strongest through the ${best.era.name} and weakest through the ${worst.era.name}.`:best?`Operations held a steady standard through the ${best.era.name}.`:"";
  const historyLine=sample.length?`Along the way this operation lived through ${sample.join(", ")}${lived.length>3?`, and ${lived.length-3} other major event${lived.length-3===1?"":"s"}`:""}.`:"The campaign opened and closed before any major historical event crossed its timeline.";
  const rescueLine=rescues>0?`It leaned on emergency bridge finance or receivership ${rescues} time${rescues===1?"":"s"} to stay solvent.`:"It never needed emergency bridge finance or receivership to stay solvent.";
  const milestoneLine=`${state.milestones.length} of ${MILESTONES.length} operator milestones were reached.`;
  return `<section class="run-recap"><h3>How this run went</h3><p>Starting as ${startingMode(state.difficulty).label} on ${dateFmt(state.campaignStart||START,true)}, the operation ran for ${years} simulated years. ${eraLine} ${historyLine} ${rescueLine} ${milestoneLine}</p><p>It finishes holding ${fmtBtc(totalBtc()+lightningLocked())} across every wallet and venue, for an Operator Score of ${score.total} / 1,000 — ${operatorGrade(score.total)}.</p></section>`;
}
