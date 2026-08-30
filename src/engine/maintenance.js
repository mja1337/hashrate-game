"use strict";

/* MAINTENANCE LAYER — spare parts, fault attribution, service jobs and the
   hands-on repair puzzles. Extracted from simulation.js to keep the engine
   inside the agreed module ceiling. Every binding here is a top-level
   function or const resolved at call time, so load order is not sensitive
   beyond running before the first render. */

function sparePart(id){return SPARE_PARTS.find(part=>part.id===id)}
const PART_FAULT_LABELS={laptopfan:"Laptop fan bearing wear",fan:"Fan bearing seizure",asicfan:"Blower fan bearing seizure",hashboardearly:"Hashboard chip failure",hashboard:"Hashboard chip failure",hashboardmodern:"Hashboard chip failure",powerPcb:"PSU/power PCB failure",coolantPump:"Coolant pump failure",coolingManifold:"Cooling manifold leak"};
function fanTierFor(h){return h.era==="ASIC"||h.era==="HYDRO ASIC"?"asicfan":h.era==="CPU"?"laptopfan":"fan"}
function hashboardTierFor(h){if(h.era==="HYDRO ASIC")return"hashboardmodern";if(h.era!=="ASIC")return null;if(at(h.date)<at("2016-01-01"))return"hashboardearly";if(at(h.date)<at("2020-01-01"))return"hashboard";return"hashboardmodern"}
function hardwareUsingPart(partId){return HARDWARE.filter(h=>Object.keys(partFaultWeights(h)).includes(partId))}
function ownedHardwareUsingPart(partId){return hardwareUsingPart(partId).map(h=>({h,n:(state.hardware[h.id]||0)+(state.inactiveHardware?.[h.id]||0)})).filter(x=>x.n>0)}
function partFitSummary(partId){
  const owned=ownedHardwareUsingPart(partId);
  if(owned.length)return{fits:true,text:`Fits ${owned.map(x=>`${x.h.name} ×${x.n}`).join(" · ")}`};
  const all=hardwareUsingPart(partId);
  if(!all.length)return{fits:false,text:"No machine in the game uses this part"};
  const eras=[...new Set(all.map(h=>h.era))].join(", ");
  return{fits:false,text:`Nothing in your fleet uses this — it fits ${eras} hardware such as ${all[all.length-1].name}`};
}
function partFaultWeights(h){
  const fanTier=fanTierFor(h),boardTier=hashboardTierFor(h);
  if(h.era==="HYDRO ASIC")return{[boardTier]:.30,powerPcb:.25,[fanTier]:.15,coolantPump:.15,coolingManifold:.15};
  if(h.era==="ASIC")return{[boardTier]:.45,powerPcb:.35,[fanTier]:.20};
  if(h.era==="FPGA")return{powerPcb:.55,[fanTier]:.45};
  if(h.era==="GPU")return{[fanTier]:.55,powerPcb:.45};
  return{[fanTier]:1};
}
function pickWeightedPart(weights){
  const entries=Object.entries(weights),total=entries.reduce((sum,[,w])=>sum+w,0)||1;
  let roll=nextRand()*total;
  for(const[part,weight]of entries){roll-=weight;if(roll<=0)return part}
  return entries[entries.length-1][0];
}
const REPAIR_STAGES=[
  {id:"powerdown",name:"Power down",weight:.05},
  {id:"disconnect",name:"Disconnect",weight:.10},
  {id:"work",name:"Work",weight:.50},
  {id:"reconnect",name:"Reconnect",weight:.10},
  {id:"fitup",name:"Fit & rack",weight:.10},
  {id:"stabilitycheck",name:"Stability check",weight:.15}
];
function shuffledSlots(n){const arr=Array.from({length:n},(_,i)=>i);for(let i=arr.length-1;i>0;i--){const j=Math.floor(nextRand()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function shuffledPairSlots(pairs){const arr=[];for(let i=0;i<pairs;i++)arr.push(i,i);for(let i=arr.length-1;i>0;i--){const j=Math.floor(nextRand()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
const REPAIR_COMPLICATIONS={
  powerdown:"Breaker interlock didn't isolate cleanly",
  disconnect:"Cabling was more tangled than expected",
  work:"Deeper damage than expected turned up",
  reconnect:"A re-seated connection came in loose",
  fitup:"The rack didn't want to line back up",
  stabilitycheck:"It failed the burn-in and needs another pass"
};
function serviceRequirements(h,count){
  const units=divisor=>Math.max(1,Math.ceil(count/divisor)),fanTier=fanTierFor(h),boardTier=hashboardTierFor(h);
  if(h.era==="HYDRO ASIC")return {[boardTier]:units(10),powerPcb:units(20),coolantPump:units(24),coolingManifold:units(16)};
  if(h.era==="ASIC")return {[fanTier]:units(12),[boardTier]:units(10),powerPcb:units(20)};
  if(h.era==="FPGA")return {[fanTier]:units(12),powerPcb:units(18)};
  if(h.era==="GPU")return {[fanTier]:units(8),powerPcb:units(15)};
  return {[fanTier]:units(10)};
}
function serviceRequirementText(requirements){return Object.entries(requirements).map(([id,qty])=>`${qty} ${sparePart(id)?.name||id}${qty===1?"":"s"}`).join(" · ")}
function hasServiceParts(requirements){return Object.entries(requirements).every(([id,qty])=>(state.maintenance.inventory[id]||0)>=qty)}
function servicePlan(h,count){
  const jobs=state.maintenance.serviceJobs||[],technicians=fieldTechnicianCount(),
    committed=jobs.reduce((sum,job)=>sum+(job.contracted?0:Number(job.crew||0)),0),
    available=Math.max(0,technicians-committed),
    selfBusy=jobs.some(job=>job.contracted),
    selfServiced=available<1,
    crew=selfServiced?(selfBusy?0:1):Math.min(3,available),
    complexity=h.era==="HYDRO ASIC"?2.2:h.era==="ASIC"?1.5:h.era==="GPU"?1.2:1,
    workDays=Math.max(1,Math.ceil(count*complexity/20)),
    days=crew?Math.max(1,Math.ceil(workDays/crew)):Infinity;
  return{technicians,committed,available,crew,workDays,days,contracted:selfServiced,selfBusy,contractorBusy:selfBusy};
}
function repairPuzzleRequired(job){return !!job&&!job.auto&&!!job.contracted&&!job.workDone}
function initRepairPuzzle(job){
  if(!job||job.puzzleType!==undefined)return false;
  if(job.selfAuto===undefined)job.selfAuto=nextRand()<selfAutoCompleteChance(HARDWARE.find(x=>x.id===job.id));
  if(job.selfAuto)return false;
  job.puzzleType=Math.floor(nextRand()*3);job.oldRemoved=!job.part;
  if(job.puzzleType===0){job.tapOrder=shuffledSlots(4);job.tapProgress=[]}
  else if(job.puzzleType===1){job.cableSlots=shuffledPairSlots(3);job.cableLocked=[false,false,false,false,false,false];job.cableSelected=null}
  else{job.dialTarget=20+Math.floor(nextRand()*61);const offsets=[-16,-14,-12,-10,-8,-6,6,8,10,12,14,16];job.dialValue=job.dialTarget+offsets[Math.floor(nextRand()*offsets.length)]}
  return true;
}
function advanceMaintenance(){
  state.maintenance.orders=state.maintenance.orders.filter(order=>{if(order.due>state.time)return true;const part=sparePart(order.type)||sparePart("fan");state.maintenance.inventory[part.id]=(state.maintenance.inventory[part.id]||0)+order.qty;log("Spare parts delivered",`+${order.qty} ${part.name}${order.qty===1?"":"s"}`);return false});
  state.maintenance.serviceJobs=state.maintenance.serviceJobs.filter(job=>{
    const h=HARDWARE.find(x=>x.id===job.id),legacy=!Number.isFinite(Number(job.stage));
    if(legacy){
      if(job.due>state.time)return true;
    }else{
      while(job.stage<REPAIR_STAGES.length&&job.stageDue<=state.time){
        const stage=REPAIR_STAGES[job.stage];
        if(stage.id==="work"&&!job.auto&&job.contracted&&!job.workDone){
          if(job.selfAuto){completeRepairWork(job,"Finished from practised familiarity — no set-up needed",true);continue}
          if(initRepairPuzzle(job))renderFullQueued=true;
          break;
        }
        const complicationChance=Math.min(.6,.10*(job.contracted?1.3:1)*(hasSkill("fieldservice")?.5:1));
        if(nextRand()<complicationChance){
          const delay=(.5+nextRand())*DAY;
          job.stageDue+=delay;job.due+=delay;
          let note=REPAIR_COMPLICATIONS[stage.id];
          if(stage.id==="work"&&nextRand()<.3){
            const breakdown=hardwareFaultBreakdown(job.id),weights=partFaultWeights(h);
            let extra=pickWeightedPart(weights),tries=0;while((extra===job.part||breakdown[extra])&&tries<4){extra=pickWeightedPart(weights);tries++}
            const byPart=state.maintenance.faultsByPart[job.id]||(state.maintenance.faultsByPart[job.id]={});
            byPart[extra]=(byPart[extra]||0)+1;
            note=`Found a second fault — ${sparePart(extra)?.name||extra} also needs attention`;
            renderFullQueued=true;
          }
          const surcharge=Math.round((job.labor||0)*.15);
          if(surcharge>0&&state.cash>=surcharge){state.cash-=surcharge;note+=` · +${fmtUsd(surcharge)} callback fee`}
          log(`${h?.name||job.id} · ${stage.name} complication`,note,"fleet");
          showToast("Repair delayed",`${h?.name||job.id}: ${note}. Completion moves back ${(delay/DAY).toFixed(1)} day${delay/DAY>=1.05?"s":""}; review the job and any newly discovered fault.`,"bad","mine");
          renderFullQueued=true;
          break;
        }
        job.stage++;
        if(job.stage<REPAIR_STAGES.length)job.stageDue=state.time+REPAIR_STAGES[job.stage].weight*(job.totalDays||1)*DAY;
      }
      if(job.stage<REPAIR_STAGES.length)return true;
    }
    const repaired=Math.max(1,Number(job.count)||0);
    if(job.part){
      const byPart=state.maintenance.faultsByPart[job.id]||(state.maintenance.faultsByPart[job.id]={}),partName=sparePart(job.part)?.name||job.part;
      byPart[job.part]=0;
      const boosted=Math.min(100,maintenanceCondition(h)+Math.max(6,20*repaired/Math.max(1,state.hardware[job.id]||1)));
      state.maintenance.condition[job.id]=hardwareFaultCount(h)>0?boosted:Math.max(70,boosted);
      awardXp((12+6*Math.log2(1+repaired))*(job.contracted?1.5:1),"repair");log(`Service completed: ${h?.name||job.id}`,`${repaired} ${partName}${repaired===1?"":"s"} replaced · ${job.contracted?"serviced by you":`${job.crew}-technician crew`}`);
      const remaining=hardwareFaultCount(h);showToast("Part replacement complete",`${repaired} × ${h?.name||"miner"} ${partName.toLowerCase()} swap finished.${remaining?` ${remaining} other fault${remaining===1?" remains":"s remain"} to repair.`:" The serviced units can return to mining."}`,"info","mine");
    }else{
      state.maintenance.faultsByPart[job.id]={};
      state.maintenance.condition[job.id]=Math.min(100,maintenanceCondition(h)+Math.max(18,60*repaired/Math.max(1,state.hardware[job.id]||1)));
      awardXp((12+6*Math.log2(1+repaired))*(job.contracted?1.5:1),"repair");log(`Service completed: ${h?.name||job.id}`,`${repaired} unit${repaired===1?"":"s"} repaired · ${job.contracted?"serviced by you":`${job.crew}-technician crew`}`);
      showToast("Fleet service complete",`${repaired} × ${h?.name||"miner"} returned to service with restored condition. Check temperature and load before pushing the fleet again.`,"info","mine");
    }
    return false;
  });
  if(!thermalPowerAvailable())return;
  const technicians=fieldTechnicianCount(),wearFactor=(technicians?Math.max(.35,.6-.08*Math.min(2,technicians-1)-.02*Math.max(0,technicians-3)):1)*temperatureWearMultiplier(),failureHeat=temperatureFailureMultiplier();
  HARDWARE.forEach(h=>{
    const n=state.hardware[h.id]||0;if(!n||hardwareOfflineReason(h)!=="")return;
    const age=Math.max(0,(state.time-at(h.date))/DAY/365),condition=maintenanceCondition(h),active=hardwareRepairState(h).active;if(!active)return;
    const wear=((h.era==="HYDRO ASIC"?.035:.018)+Math.min(.04,age*.002))*wearFactor*(active/n)*(state.overdrive?1.6:1);
    state.maintenance.condition[h.id]=Math.max(0,condition-wear);
    const base=h.era==="HYDRO ASIC"?.00075:h.era==="ASIC"?.00045:h.era==="GPU"?.000325:.000175,stress=(1+(100-condition)/55+age*.12)*failureHeat*(state.overdrive?2.2:1),failures=Math.min(active,poisson(active*base*stress*(technicians?0.72:1)));
    if(failures){
      const weights=partFaultWeights(h),byPart=state.maintenance.faultsByPart[h.id]||(state.maintenance.faultsByPart[h.id]={}),gained={};
      for(let i=0;i<failures;i++){const part=pickWeightedPart(weights);byPart[part]=(byPart[part]||0)+1;gained[part]=(gained[part]||0)+1}
      const detail=Object.entries(gained).map(([part,count])=>`${count}× ${PART_FAULT_LABELS[part]||sparePart(part)?.name||part}`).join(" · ");
      log(`${h.name} fault detected`,`${detail} · ${roomTemperatureC().toFixed(0)} °C room`,`fleet`);
      showToast("Mining capacity lost to a fault",`${detail} failed on ${h.name} at ${roomTemperatureC().toFixed(0)} °C. Affected units stopped hashing; cool the room and schedule the named part replacement in Mine.`,"bad","mine");
      renderFullQueued=true;
    }
  });
  HARDWARE.forEach(h=>{
    const existingFaults=hardwareFaultCount(h);
    if(!existingFaults||activeServiceJob(h.id))return;
    if(nextRand()<Math.min(.25,existingFaults*.02)){
      const breakdown=hardwareFaultBreakdown(h),weights=partFaultWeights(h);
      let extra=pickWeightedPart(weights),tries=0;while(breakdown[extra]&&tries<4){extra=pickWeightedPart(weights);tries++}
      const byPart=state.maintenance.faultsByPart[h.id]||(state.maintenance.faultsByPart[h.id]={});
      byPart[extra]=(byPart[extra]||0)+1;
      log(`${h.name} fault spreading`,`Ignored damage reaches ${PART_FAULT_LABELS[extra]||sparePart(extra)?.name||extra}`,"fleet");
      showToast("An unrepaired fault spread",`${h.name} now also needs ${sparePart(extra)?.name||extra}. More capacity is offline and the new part must be added to the repair plan.`,"bad","mine");
      renderFullQueued=true;
    }
  });
  if(state.autoRepair&&fieldTechnicianCount()>0)HARDWARE.forEach(h=>{
    if(!(state.hardware[h.id]>0)||activeServiceJob(h.id))return;
    const count=state.hardware[h.id],condition=maintenanceCondition(h);
    if(condition<65){
      const plan=servicePlan(h,count),requirements=serviceRequirements(h,count),labor=Math.max(40,h.cost*.008*count);
      if(plan.crew&&!plan.contracted&&hasServiceParts(requirements)&&state.cash>=labor){serviceHardware(h.id,true);return}
    }
    const breakdown=hardwareFaultBreakdown(h),candidates=Object.entries(breakdown).filter(([,c])=>c>0).sort((a,b)=>b[1]-a[1]);
    for(const[part,faulted]of candidates){
      const requirements={[part]:Math.max(1,Math.ceil(faulted/7))};if(!hasServiceParts(requirements))continue;
      const plan=servicePlan(h,faulted);if(!plan.crew||plan.contracted)continue;
      const labor=Math.max(25,h.cost*.004*faulted);if(state.cash<labor)continue;
      serviceHardwarePart(h.id,part,true);
      return;
    }
  });
}
function orderParts(type,qty=1){
  const part=sparePart(type);if(!part)return;qty=Math.max(1,Math.floor(Number(qty)||1));const unit=sparePartCost(part),cost=qty*unit,lead=partsLeadDays();
  if(state.cash<cost)return showToast("Not enough cash",`${qty} ${part.name}${qty===1?"":"s"} cost ${fmtUsd(cost)}.`);
  state.cash-=cost;state.maintenance.orders.push({type:part.id,qty,due:state.time+lead*DAY});log("Spare parts ordered",`${qty} ${part.name}${qty===1?"":"s"} · -${fmtUsd(cost)} · ${lead} days`);save();renderMineContent();
}
function serviceHardware(id,auto=false){
  const h=HARDWARE.find(x=>x.id===id),count=state.hardware[id]||0;if(!h||!count)return;
  if(activeServiceJob(id))return showToast("Service already scheduled",`${h.name} is already in the maintenance bay.`);
  const condition=maintenanceCondition(h),faults=hardwareFaultCount(h);if(condition>=95&&!faults)return showToast("Service not needed",`${h.name} is at ${condition.toFixed(0)}% condition with no failed units.`);
  const repairCount=condition<65?count:Math.max(faults,Math.ceil(count*.15)),requirements=serviceRequirements(h,repairCount),plan=servicePlan(h,repairCount),labor=plan.contracted?0:Math.max(40,h.cost*.008*repairCount);
  if(!plan.crew)return showToast("You are already on a job",`You can only work one repair at a time yourself.${plan.technicians?` All ${plan.technicians} technician${plan.technicians===1?" is":"s are"} busy on other jobs.`:""} Finish the job on your bench, or hire another field technician to run repairs in parallel.`);
  if(!hasServiceParts(requirements))return showToast("Parts required",`Service needs ${serviceRequirementText(requirements)}; order the missing components first.`);
  if(state.cash<labor)return showToast("Not enough cash",`Service labour costs ${fmtUsd(labor)}.`);
  state.cash-=labor;Object.entries(requirements).forEach(([part,qty])=>state.maintenance.inventory[part]-=qty);state.maintenance.serviceJobs.push({id,count:repairCount,due:state.time+plan.days*DAY,crew:plan.crew,contracted:plan.contracted,labor,totalDays:plan.days,stage:0,stageDue:state.time+REPAIR_STAGES[0].weight*plan.days*DAY,auto});if(repairPuzzleRequired(state.maintenance.serviceJobs[state.maintenance.serviceJobs.length-1]))initRepairPuzzle(state.maintenance.serviceJobs[state.maintenance.serviceJobs.length-1]);log(`Service started: ${h.name}`,`${repairCount} units · ${plan.days} days · ${fmtUsd(labor)}`);showToast(auto?"Auto-repair started":"Service scheduled",`${repairCount} × ${h.name} is offline for ${plan.days} simulation day${plan.days===1?"":"s"}. ${plan.contracted?"You are doing this one yourself — the Work stage waits for you on the Mine floor.":auto?"Your technician crew is handling it automatically.":`${plan.crew} of ${plan.technicians} technicians assigned.`}`,"info","mine");save();renderMineContent();
}
function serviceHardwarePart(id,part,auto=false){
  const h=HARDWARE.find(x=>x.id===id),count=state.hardware[id]||0,partDef=sparePart(part);if(!h||!count||!partDef)return;
  if(activeServiceJob(id))return showToast("Service already scheduled",`${h.name} is already in the maintenance bay.`);
  const faulted=hardwareFaultBreakdown(h)[part]||0;if(!faulted)return showToast("Service not needed",`No ${partDef.name.toLowerCase()} faults are currently reported on ${h.name}.`);
  const requirements={[part]:Math.max(1,Math.ceil(faulted/7))},plan=servicePlan(h,faulted),labor=plan.contracted?0:Math.max(25,h.cost*.004*faulted);
  if(!plan.crew)return showToast("You are already on a job",`You can only work one repair at a time yourself.${plan.technicians?` All ${plan.technicians} technician${plan.technicians===1?" is":"s are"} busy on other jobs.`:""} Finish the job on your bench, or hire another field technician to run repairs in parallel.`);
  if(!hasServiceParts(requirements))return showToast("Parts required",`Replacing ${partDef.name.toLowerCase()}s needs ${serviceRequirementText(requirements)}; order the missing components first.`);
  if(state.cash<labor)return showToast("Not enough cash",`Targeted service labour costs ${fmtUsd(labor)}.`);
  state.cash-=labor;Object.entries(requirements).forEach(([p,qty])=>state.maintenance.inventory[p]-=qty);
  state.maintenance.serviceJobs.push({id,count:faulted,part,due:state.time+plan.days*DAY,crew:plan.crew,contracted:plan.contracted,labor,totalDays:plan.days,stage:0,stageDue:state.time+REPAIR_STAGES[0].weight*plan.days*DAY,auto});if(repairPuzzleRequired(state.maintenance.serviceJobs[state.maintenance.serviceJobs.length-1]))initRepairPuzzle(state.maintenance.serviceJobs[state.maintenance.serviceJobs.length-1]);
  log(`Service started: ${h.name}`,`${faulted} × ${partDef.name} · ${plan.days} day${plan.days===1?"":"s"} · ${fmtUsd(labor)}`);
  showToast(auto?"Auto-repair started":"Service scheduled",`${faulted} × ${partDef.name} swap on ${h.name}, ${plan.days} simulation day${plan.days===1?"":"s"}. ${plan.contracted?"You are doing this one yourself — the Work stage waits for you on the Mine floor.":auto?`Your technician crew is handling it automatically.`:`${plan.crew} of ${plan.technicians} technicians assigned.`}`,"info","mine");
  save();renderMineContent();
}
function repairRemoveOldPart(id){
  const job=activeServiceJob(id);if(!job||!job.part||job.auto||job.oldRemoved)return;
  const h=HARDWARE.find(x=>x.id===id),partDef=sparePart(job.part);
  job.oldRemoved=true;
  showToast("Old part pulled",`${partDef?.name||job.part} removed from ${h?.name||id}. Fit the replacement to finish the job.`,"info","mine");
  save();renderMineContent();
}
function selfRepairMistake(job,message){
  const h=HARDWARE.find(x=>x.id===job.id);job.mistakes=(job.mistakes||0)+1;
  if(!job.contracted||nextRand()>=selfDamageChance(h))return showToast("Out of sequence",message,"bad","mine");
  const drop=3+nextRand()*5,units=Math.max(1,state.hardware[job.id]||1),breakdown=hardwareFaultBreakdown(h),outstanding=Object.values(breakdown).reduce((sum,c)=>sum+c,0);
  state.maintenance.condition[job.id]=Math.max(0,maintenanceCondition(h)-drop);
  let collateral=null;
  if(outstanding<units&&nextRand()<.4){
    const weights=partFaultWeights(h);let extra=pickWeightedPart(weights),tries=0;
    while(extra===job.part&&tries<5){extra=pickWeightedPart(weights);tries++}
    if(extra!==job.part){const byPart=state.maintenance.faultsByPart[job.id]||(state.maintenance.faultsByPart[job.id]={});byPart[extra]=(byPart[extra]||0)+1;collateral=sparePart(extra)?.name||extra}
  }
  log(`${h?.name||job.id} damaged during self-service`,`${collateral?`${collateral} broken · `:""}condition -${drop.toFixed(1)}%${hasSkill("benchskills")?"":" · bench repair skills would cut this risk"}`,"fleet");
  showToast("The self-repair caused damage",`${message} ${collateral?`A ${collateral.toLowerCase()} also broke and is now a separate fault.`:`Machine condition fell ${drop.toFixed(1)}%.`} The current repair remains on your bench.`,"bad","mine");
  renderFullQueued=true;
}
function completeRepairWork(job,successNote,duringTick=false){
  const h=HARDWARE.find(x=>x.id===job.id),partDef=sparePart(job.part),label=job.part?(partDef?.name||job.part):null;
  if(job.contracted){const store=state.maintenance.selfRepairs||(state.maintenance.selfRepairs={});store[job.id]=selfRepairExperience(job.id)+1}
  job.workDone=true;job.stage++;
  if(job.stage<REPAIR_STAGES.length)job.stageDue=state.time+REPAIR_STAGES[job.stage].weight*(job.totalDays||1)*DAY;
  log(`${h?.name||job.id} · ${label?"part seated":"recommissioning check passed"}`,successNote,"fleet");
  showToast(label?"Part seated":"Recommissioning check passed",label?`${label} is fitted correctly on ${h?.name||job.id}. Reconnecting.`:`${h?.name||job.id} passed its final recommissioning check. Reconnecting.`,"info","mine");
  if(duringTick){renderFullQueued=true;return}
  save();renderMineContent();
}
function repairTapSlot(id,slot){
  const job=activeServiceJob(id);slot=Number(slot);if(!job||job.auto||!job.oldRemoved||job.workDone||job.puzzleType!==0||!Array.isArray(job.tapOrder))return;
  job.tapProgress=Array.isArray(job.tapProgress)?job.tapProgress:[];
  const pos=job.tapProgress.length;
  if(job.tapOrder[pos]===slot){
    job.tapProgress.push(slot);
    if(job.tapProgress.length>=job.tapOrder.length)return completeRepairWork(job,"Torqued down in the correct cross pattern");
  }else{
    job.tapProgress=[];
    selfRepairMistake(job,`Wrong mounting point — the ${job.part?sparePart(job.part)?.name?.toLowerCase()||"part":"unit"} shifted.`);
  }
  save();renderMineContent();
}
function repairCableClick(id,slot){
  const job=activeServiceJob(id);slot=Number(slot);if(!job||job.auto||!job.oldRemoved||job.workDone||job.puzzleType!==1||!Array.isArray(job.cableSlots))return;
  if(job.cableLocked[slot])return;
  if(job.cableSelected===null||job.cableSelected===undefined){job.cableSelected=slot;save();renderMineContent();return}
  if(job.cableSelected===slot){job.cableSelected=null;save();renderMineContent();return}
  if(job.cableSlots[job.cableSelected]===job.cableSlots[slot]){
    job.cableLocked[job.cableSelected]=true;job.cableLocked[slot]=true;job.cableSelected=null;
    if(job.cableLocked.every(Boolean))return completeRepairWork(job,"Every cable pair reconnected to its matching terminal");
  }else{
    job.cableSelected=null;
    selfRepairMistake(job,"That pair doesn't match — the connectors don't seat.");
  }
  save();renderMineContent();
}
function repairNudgeDial(id,delta){
  const job=activeServiceJob(id);delta=Number(delta);if(!job||job.auto||!job.oldRemoved||job.workDone||job.puzzleType!==2||!Number.isFinite(job.dialValue))return;
  const before=job.dialValue-job.dialTarget;job.dialValue+=delta;const after=job.dialValue-job.dialTarget;
  if(after===0)return completeRepairWork(job,"Torqued to exact spec");
  if(before!==0&&Math.sign(after)!==Math.sign(before))selfRepairMistake(job,"Over-torqued straight past spec.");
  save();renderMineContent();
}
function sparePartCost(part){const def=typeof part==="string"?sparePart(part):part;return (def?.cost||0)*(covidPartsMarket()?2.25:1)*(hasSkill("partssourcing")?.8:1)}
function partsLeadDays(){return Math.max(3,Math.round((covidPartsMarket()?42:14)*(hasSkill("supplychain")?.6:1)))}
function selfRepairExperience(id){return Math.max(0,Math.floor(Number(state.maintenance.selfRepairs?.[id])||0))}
function selfDamageChance(h){if(!h)return 0;return Math.max(.02,.4*Math.pow(.72,selfRepairExperience(h.id))*(hasSkill("benchskills")?.4:1))}
function selfAutoCompleteChance(h){if(!h||!hasSkill("practisedhands"))return 0;return Math.min(.85,.2+.13*selfRepairExperience(h.id))}
