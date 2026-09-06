"use strict";

/* CHANGING SITE.

   A facility move is the same operation in both directions: power down, unrack, transport,
   re-rack, commission, and hope the machines that went on the lorry all come off it. The
   ladder was one-way only because nothing had been written for the way back, not because
   moving down is different in kind — and an operator who has just sold half a fleet to meet a
   bill is precisely the operator who most needs to stop paying for the site that fleet used
   to fill.

   So the risk model, the timed job and the commissioning that ends it are shared, and the
   direction changes only three things: what it costs (a lease break rather than a fit-out),
   how much can go wrong (less, but not nothing), and what the site can hold when you arrive.
   That last one is the only hard gate, and it is enforced in facilityDownsizeBlockReason
   where the button that offers the move can read the same answer. */

function relocating(){return !!state.relocationJob&&state.time<state.relocationJob.due}
function upgradingFacility(){return !!state.facilityUpgradeJob&&state.time<state.facilityUpgradeJob.due}
function facilityMoveRisk(id){
  const current=Math.max(0,FACILITIES.findIndex(x=>x.id===state.facility)),target=Math.max(0,FACILITIES.findIndex(x=>x.id===id));
  if(target===current)return 0;
  /* Moving down is still a physical move — machines are unracked, driven and re-racked, and
     some of them do not survive it. It carries less risk than an expansion because there is no
     new contract to negotiate, no new grid connection to energise and fewer machines to move
     than the site you are leaving once held; it does not carry none. */
  if(target<current)return Math.min(.2,.025+(current-target)*.03);
  return Math.min(.48,.05+(target-current)*.075+target*.025);
}
function facilityRiskLabel(risk){return risk<.12?"Low move risk":risk<.25?"Moderate move risk":"High move risk"}

/* The job resolving. Incidents are rolled once, on arrival, against the risk recorded when the
   move was dispatched — so a policy bought mid-move does not retroactively change the odds
   that were accepted. */
function advanceFacilityMove(){
  const upgradeJob=state.facilityUpgradeJob;if(upgradeJob&&upgradeJob.due<=state.time){
    const destination=FACILITIES.find(x=>x.id===upgradeJob.id),wasDownsize=!!upgradeJob.down;state.facility=upgradeJob.id;state.facilityUpgradeJob=null;state.power=state.debt<=0;
    const incidentRoll=nextRand();if(incidentRoll<upgradeJob.risk&&!state.insured){
      const incident=nextRand();
      if(incident<.42){const until=state.time+DAY*90;state.powerRateShock={multiplier:1.22,until};log("Facility upgrade: power contract repriced","+22% power for 90 days");showToast("Upgrade issue","The new site's power contract is 22% higher for 90 days.","bad")}
      else if(incident<.78){const candidates=HARDWARE.filter(h=>!h.permanent&&(state.hardware[h.id]||0)>0);const h=candidates[Math.floor(nextRand()*candidates.length)];if(h){const lost=Math.max(1,Math.ceil((state.hardware[h.id]||0)*(.05+nextRand()*.1)*(hasSkill("spares")?.5:1)));state.hardware[h.id]=Math.max(0,state.hardware[h.id]-lost);log("Facility upgrade: miners damaged",`-${lost} ${h.name}`);showToast("Upgrade issue",`${lost} ${h.name} damaged in transit.`,"bad")}else{const fee=Math.min(state.cash,fleet().value*.025);state.cash-=fee;log("Facility upgrade: customs inspection",`-${fmtUsd(fee)}`);showToast("Upgrade issue","A customs inspection added an unexpected handling cost.","bad")}}
      else{const fee=Math.min(state.cash,fleet().value*(.03+nextRand()*.04));state.cash-=fee;log("Facility upgrade: equipment held",`-${fmtUsd(fee)}`);showToast("Upgrade issue","Equipment was held during the move; release fees were required.","bad")}
    }else if(incidentRoll<upgradeJob.risk&&state.insured){log("Upgrade incident insured","claim paid");showToast("Insurance claim","The policy absorbed the facility-upgrade incident.")}
    log(`Moved into ${destination?.name||upgradeJob.id}`,"Site commissioning complete","operations");
    showToast(wasDownsize?"Downsizing complete":"Facility upgrade complete",wasDownsize
      ?`The fleet is live at ${destination?.name||upgradeJob.id}. Rent is now ${fmtUsd(destination?.rent||0)} a month — the saving starts with the next bill, not this one.`
      :`The fleet is live at ${destination?.name||upgradeJob.id}.`,"info","facilities");renderFullQueued=true
  }
}

/* Which way a proposed move goes, so the card, the button and the action all describe the same
   operation rather than each deciding for itself. */
function facilityIsDownsize(id,s=state){
  return FACILITIES.findIndex(x=>x.id===id)<FACILITIES.findIndex(x=>x.id===s.facility);
}
