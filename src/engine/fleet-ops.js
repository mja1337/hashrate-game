"use strict";

/* THE FLEET'S PHYSICAL LIFE: what arrives, what gets racked, what comes out again, and what
   is switched off without leaving.

   These lived in actions.js beside the money, and then briefly in thermal.js beside the heat,
   because a delivery and a cooling install look alike from a distance. They are not about
   either. They are about the crew: how long it takes to rack four thousand machines, how long
   to pull them out, and what is true of the fleet while that work is half done. */

function advanceProcurement(){state.procurementOrders=state.procurementOrders.filter(o=>{if(o.due>state.time)return true;const h=HARDWARE.find(x=>x.id===o.id);if(!h)return false;if((o.slips||0)<2&&nextRand()<(o.risk||0)){const delay=14+Math.floor(nextRand()*42);o.due=state.time+delay*DAY;o.slips=(o.slips||0)+1;log(`${h.name} delivery slipped`,`${o.vendor||"supplier"} · ${delay} additional days`);showToast("Delivery delayed",`${h.name} shipment slipped by ${delay} days (${o.label}).`,"warning","mine");return true}let delivered=Number(o.qty);if(delivered>1&&nextRand()<(o.partialRisk||0)){delivered=Math.max(1,Math.floor(delivered*(.45+nextRand()*.3)));const remaining=Number(o.qty)-delivered;state.procurementOrders.push({...o,qty:remaining,due:state.time+(14+Math.floor(nextRand()*28))*DAY,slips:2,label:`${o.label} · balance shipment`});log(`${h.name} partially delivered`,`${delivered} received · ${remaining} remain with ${o.vendor||"supplier"}`)}stageDelivery(o.id,delivered,Number.isFinite(o.condition)?o.condition:100);log(`Miner delivery received`,`${delivered} × ${h.name} awaiting activation`);showToast("Miners have arrived",`${delivered} × ${h.name} is staged.${delivered<Number(o.qty)?" The remaining allocation is still in transit.":""}`,"info","mine");renderFullQueued=true;return false})}
/* Staged machines are a count per type, so a second-hand batch's condition would be lost
   between the loading bay and the rack. It is carried alongside, weighted when two batches of
   the same machine are waiting together — which is what actually happens when you buy the
   same model from two sellers. */
function stageDelivery(id,qty,condition){
  const staged=Math.max(0,Math.floor(state.inactiveHardware?.[id]||0));
  const store=state.stagedCondition||(state.stagedCondition={});
  const prior=Number.isFinite(store[id])?store[id]:100;
  const total=staged+qty;
  store[id]=total>0?(staged*prior+qty*condition)/total:condition;
  state.inactiveHardware[id]=total;
}
function activateHardware(id){const h=HARDWARE.find(x=>x.id===id),qty=Math.max(0,Math.floor(state.inactiveHardware?.[id]||0));if(!h||qty<1)return;const trial=JSON.parse(JSON.stringify(state));trial.hardware[id]=(trial.hardware[id]||0)+qty;if(!fleet(trial).within)return showToast("Commissioning blocked",`${qty} × ${h.name} no longer fits the active facility. Free capacity or upgrade the site.`);const days=Math.max(1,Math.ceil(qty/(hasStaff("fieldtech")?40:20)));state.inactiveHardware[id]=0;
  const staged=state.stagedCondition?.[id];
  if(state.stagedCondition)delete state.stagedCondition[id];
  state.commissioningJobs.push({id,qty,due:state.time+days*DAY,started:state.time,days,done:0,condition:Number.isFinite(staged)?staged:undefined});log(`Commissioning started: ${h.name}`,`${qty} units · ${days} days` ,"fleet");showToast("Machines being commissioned",`${qty} × ${h.name} is being racked, configured and tested over ${days} simulation day${days===1?"":"s"}.`,"info","mine");save();renderMineContent()}
/* RETIRING A FLEET IS WORK.

   Commissioning a delivery takes days — the crew racks it, configures it and tests it — and
   this project already made those machines come online gradually rather than all on the last
   day. Taking them out was instant: four thousand miners left the racks, the floor and the
   power budget between one frame and the next, which is not a thing that happens and, worse,
   made an emergency the same speed as a plan. An operator who needed capacity back could have
   it immediately; an operator caught by a price collapse paid no penalty for having left it
   late.

   So retirement is the same shape as commissioning, and deliberately a little faster: pulling
   a machine and putting it on a pallet is quicker than racking, cabling, configuring and
   testing one. Units leave the active fleet as the crew works through them, so hash rate,
   heat and floor space all come down over the same days rather than in one step, and a field
   technician crew makes it quicker exactly as it does on the way in. */
const RETIRE_PER_DAY=34,RETIRE_PER_DAY_TECH=68;
function retirementDays(qty){
  return Math.max(1,Math.ceil(qty/(hasStaff("fieldtech")?RETIRE_PER_DAY_TECH:RETIRE_PER_DAY)));
}
function retiringCount(id,s=state){
  return (s.retirementJobs||[]).filter(job=>job.id===id).reduce((sum,job)=>sum+Math.max(0,Number(job.qty)-Number(job.done||0)),0);
}
function decommissionHardware(id,requested=1){
  const h=HARDWARE.find(x=>x.id===id),owned=state.hardware[id]||0;
  if(!h||h.permanent||owned<1)return;
  const qty=Math.min(owned,Math.max(1,Math.floor(Number(requested)||1)));
  const days=retirementDays(qty);
  state.retirementJobs.push({id,qty,done:0,started:state.time,due:state.time+days*DAY,days});
  log(`Retirement started: ${h.name}`,`${qty} unit${qty===1?"":"s"} · ${days} day${days===1?"":"s"} to unrack and palletise`,"fleet");
  showToast("Retirement underway",`${qty} × ${h.name} is being isolated, unracked and moved to storage over ${days} simulation day${days===1?"":"s"}. Capacity, heat and hash rate come back as the crew works through them.`,"info","mine");
  save();renderMineContent();
}
/* The crew works through the pallet at a steady rate, and what they have finished is out of
   the racks. Salvage is taken as each machine actually comes out rather than all at the end,
   for the same reason the hash rate falls gradually: it is the work that is being modelled. */
function advanceRetirements(){
  state.retirementJobs=(state.retirementJobs||[]).filter(job=>{
    const h=HARDWARE.find(x=>x.id===job.id);if(!h)return false;
    const total=Math.max(0,Math.floor(Number(job.qty)||0)),done=Math.max(0,Math.floor(Number(job.done)||0));
    if(!Number.isFinite(job.started))job.started=Math.min(state.time,job.due);
    const finished=state.time>=job.due;
    const span=Math.max(DAY,job.due-job.started);
    const pulled=finished?total:Math.min(total,Math.floor(total*Math.max(0,(state.time-job.started)/span)));
    const add=Math.min(Math.max(0,pulled-done),state.hardware[job.id]||0);
    if(add>0){
      state.hardware[job.id]=Math.max(0,(state.hardware[job.id]||0)-add);
      state.poweredDownHardware[job.id]=Math.min(state.poweredDownHardware[job.id]||0,state.hardware[job.id]);
      state.decommissionedHardware[job.id]=(state.decommissionedHardware[job.id]||0)+add;
      if(hasSkill("salvage")){
        const tier=fanTierFor(h);
        state.maintenance.inventory[tier]=(state.maintenance.inventory[tier]||0)+add;
      }
      job.done=done+add;
    }
    if(!finished)return true;
    log(`Retired ${job.done} × ${h.name}`,`Isolated from power and ready for resale${hasSkill("salvage")&&job.done?` · ${job.done} ${sparePart(fanTierFor(h))?.name||"fan"}${job.done===1?"":"s"} salvaged`:""}`,"fleet");
    showToast("Machines retired",`${job.done} × ${h.name} is in storage and ready to sell.`,"info","mine");
    renderFullQueued=true;
    return false;
  });
}
function setHardwarePower(id,powerOn,requested=1){
  const h=HARDWARE.find(x=>x.id===id),owned=state.hardware[id]||0;if(!h||owned<1)return;const paused=hardwarePoweredDownCount(h),qty=Math.max(1,Math.floor(Number(requested)||1));
  if(powerOn){const changed=Math.min(paused,qty);if(!changed)return;state.poweredDownHardware[id]=paused-changed;log(`Started ${changed} × ${h.name}`,`${state.poweredDownHardware[id]} remain manually off`,"fleet");showToast("Miners started",`${changed} × ${h.name} will add heat and hash rate while site power is available.`,"info","mine")}
  else{const repairing=Math.min(owned,Math.max(hardwareFaultCount(h),activeServiceJob(id)?.count||0)),available=Math.max(0,owned-paused-repairing),changed=Math.min(available,qty);if(!changed)return showToast("No running units",`Every available ${h.name} is already stopped or in repair.`);state.poweredDownHardware[id]=paused+changed;log(`Paused ${changed} × ${h.name}`,"Cooling load reduced without retiring hardware","fleet");showToast("Heat load reduced",`${changed} × ${h.name} is off. It earns nothing, draws no miner power and stops accumulating wear.`,"info","mine")}
  save();renderMineContent();
}
