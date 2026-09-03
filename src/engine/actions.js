"use strict";

/* ACTION LAYER — all player mutations pass through here. */
function procurementTerms(h){const covid=state.time>=at("2020-03-12")&&state.time<at("2021-07-01"),early=h.era==="ASIC"&&state.time<at("2016-01-01"),hydro=h.era==="HYDRO ASIC",bitmain=/Bitmain/.test(h.maker),canaan=/Canaan/.test(h.maker),allocation=bitmain&&((state.time>=at("2017-01-01")&&state.time<at("2018-06-01"))||(state.time>=at("2020-09-01")&&state.time<at("2022-01-01"))),frontier=canaan&&early;const days=(early?55:hydro?50:h.era==="ASIC"?28:h.era==="FPGA"?21:10)+(covid?42:0)+(allocation?21:0);const risk=Math.min(.62,(early?.18:0)+(hydro?.12:0)+(covid?.24:0)+(allocation?.17:0)+(frontier?.12:0));const partialRisk=Math.min(.42,(hydro?.16:0)+(covid?.18:0)+(allocation?.12:0)+(frontier?.1:0));const label=covid?"COVID freight market":allocation?"Bitmain allocation market":frontier?"Canaan frontier batch":hydro?"Specialist hydro freight":early?"Early ASIC batch":"Established-channel delivery";return{days,risk,partialRisk,label,vendor:bitmain?"Bitmain":canaan?"Canaan":h.maker}}
function plannedFleetProjection(id=null,qty=0){const trial=JSON.parse(JSON.stringify(state));state.procurementOrders.forEach(o=>trial.hardware[o.id]=(trial.hardware[o.id]||0)+Number(o.qty));HARDWARE.forEach(h=>trial.hardware[h.id]=(trial.hardware[h.id]||0)+Number(state.inactiveHardware?.[h.id]||0));if(id)trial.hardware[id]=(trial.hardware[id]||0)+Number(qty||0);return fleet(trial)}
function hardwarePurchaseLimits(h){
  const reserved=plannedFleetProjection(),cost=Math.max(.000001,hardwareUnitCost(h)),freeWatts=Math.max(0,(reserved.cap-reserved.potentialKw)*1000),freeSpace=Math.max(0,facility().space-reserved.space),cashMax=Math.max(0,Math.floor(state.cash/cost)),powerMax=Math.max(0,Math.floor(freeWatts/Math.max(1,h.w))),spaceMax=Math.max(0,Math.floor(freeSpace/Math.max(1,h.space))),siteMax=Math.min(powerMax,spaceMax),fiatMax=Math.min(cashMax,siteMax),marketOpen=state.time>=MARKET,hotBtcMax=marketOpen?Math.max(0,Math.floor(state.wallets.hot/(cost/priceAt(state.time)))):0;
  return{reserved,cost,freeWatts,freeSpace,cashMax,powerMax,spaceMax,siteMax,fiatMax,hotBtcMax,marketOpen};
}
function hardwarePurchaseStatusHtml(h){
  if(h.permanent)return"";const limits=hardwarePurchaseLimits(h),available=state.time>=at(h.date),siteBinding=limits.siteMax<=limits.cashMax,powerBinding=siteBinding&&limits.powerMax<=limits.spaceMax,spaceBinding=siteBinding&&limits.spaceMax<=limits.powerMax,cashBinding=limits.cashMax<=limits.siteMax,ordered=state.procurementOrders.reduce((sum,o)=>sum+Number(o.qty||0),0),staged=Object.values(state.inactiveHardware||{}).reduce((sum,n)=>sum+Number(n||0),0);
  let tone="",headline="",explanation="";
  if(!available){tone="blocked";headline=`Not purchasable until ${dateFmt(at(h.date))}`;explanation="This generation has been announced but has not reached its release date."}
  else if(limits.fiatMax<1){tone="blocked";if(powerBinding&&spaceBinding){headline="Facility capacity blocks this order";explanation=`One miner needs ${(h.w/1000).toFixed(2)} kW and ${h.space} floor units; only ${(limits.freeWatts/1000).toFixed(2)} kW and ${fmtNum(limits.freeSpace)} units remain.`}else if(powerBinding){headline="Not enough electrical capacity";explanation=`One miner needs ${(h.w/1000).toFixed(2)} kW; only ${(limits.freeWatts/1000).toFixed(2)} kW remains.`}else if(spaceBinding){headline="Not enough floor capacity";explanation=`One miner needs ${h.space} floor units; only ${fmtNum(limits.freeSpace)} remain.`}else{headline="Not enough cash for one miner";explanation=`One miner costs ${fmtUsd(limits.cost)}; available cash is ${fmtUsd(state.cash)}.`}}
  else{const labels=[];if(cashBinding)labels.push("cash");if(powerBinding)labels.push("power");if(spaceBinding)labels.push("floor space");tone=limits.fiatMax<=1||siteBinding?"limited":"";headline=`Maximum fiat order: ${fmtCompactNumber(limits.fiatMax)} miner${limits.fiatMax===1?"":"s"}`;explanation=`${labels.map(x=>x[0].toUpperCase()+x.slice(1)).join(" and ")||"Available resources"} ${labels.length===1?"is":"are"} limiting this order.`}
  const deployment=[];if(h.requires&&!state.skills.includes(h.requires))deployment.push(`needs ${SKILLS.find(x=>x.id===h.requires)?.name||h.requires}`);if(h.minFacility&&facilityTier()<facilityTier({...state,facility:h.minFacility}))deployment.push(`needs ${FACILITIES.find(f=>f.id===h.minFacility)?.name||h.minFacility}`);
  const reservations=ordered||staged?` ${ordered?`${ordered} ordered`:""}${ordered&&staged?" and ":""}${staged?`${staged} staged`:""} miner${ordered+staged===1?" is":"s are"} already included in these capacity figures.`:"";
  return `<div class="purchase-capacity ${tone}" data-purchase-capacity><div class="purchase-capacity-head"><b>${headline}</b><small>${explanation}</small></div><div class="purchase-limits"><span>Cash allows<strong>${fmtCompactNumber(limits.cashMax)} units</strong></span><span>Power allows<strong>${fmtCompactNumber(limits.powerMax)} · ${(limits.freeWatts/1000).toFixed(2)} kW free</strong></span><span>Space allows<strong>${fmtCompactNumber(limits.spaceMax)} · ${fmtNum(limits.freeSpace)} free</strong></span></div><span class="purchase-capacity-note">Each miner uses ${(h.w/1000).toFixed(2)} kW and ${h.space} floor units.${limits.marketOpen?` Hot-wallet BTC funds up to ${fmtCompactNumber(Math.min(limits.hotBtcMax,limits.siteMax))}.`:""}${reservations}${deployment.length?` <strong style="color:var(--red)">It can be ordered, but will remain offline: ${deployment.join(" and ")}.</strong>`:""}${available&&siteBinding?`<br><button class="action small" data-action="tab" data-value="facilities">Open Facilities to add capacity</button>`:""}</span></div>`;
}
function plannedFleetFits(id,qty){const projection=plannedFleetProjection(id,qty);return projection.potentialKw<=projection.cap&&projection.space<=facility().space}
function facilityLimitMessage(id){const h=HARDWARE.find(x=>x.id===id),projection=plannedFleetProjection(id,1),f=facility(),powerOver=Math.max(0,projection.kw-projection.cap),spaceOver=Math.max(0,projection.space-f.space),limits=[];if(powerOver>0)limits.push(`${powerOver.toFixed(2)} kW over electrical capacity`);if(spaceOver>0)limits.push(`${spaceOver.toFixed(0)} floor units over capacity`);const reserved=state.procurementOrders.reduce((sum,o)=>sum+Number(o.qty||0),0);return `Cannot reserve 1 × ${h?.name||"miner"}: ${limits.join(" and ")||"facility capacity reached"}. ${reserved?`${reserved} ordered miner${reserved===1?" is":"s are"} already reserving capacity. `:""}Upgrade the facility in Facilities or sell/cancel capacity before ordering.`}
function placeHardwareOrder(id,qty,btcCost=0){const h=HARDWARE.find(x=>x.id===id),terms=procurementTerms(h);if(!plannedFleetFits(id,qty))return showToast("Facility limit","Your installed fleet plus outstanding orders would exceed capacity.");state.procurementOrders.push({id,qty,due:state.time+terms.days*DAY,risk:terms.risk,partialRisk:terms.partialRisk,vendor:terms.vendor,slips:0,label:terms.label});const paid=btcCost>0?fmtBtc(btcCost):fmtUsd(hardwareUnitCost(h)*qty);log(`Ordered ${qty} × ${h.name}`,`-${paid} · ${terms.vendor} · ${terms.days}-day lead time`,"fleet");showToast("Miner order placed",`${qty} × ${h.name} via ${terms.vendor}: ETA ${dateFmt(state.time+terms.days*DAY)} · ${Math.round(terms.risk*100)}% delay risk.`,"info","mine");save();renderMineContent()}
function advanceCoolingInstalls(){
  state.thermal.orders=(state.thermal.orders||[]).filter(o=>{
    if(o.due>state.time)return true;
    const item=COOLING_EQUIPMENT.find(x=>x.id===o.id);if(!item)return false;
    const qty=Math.max(1,Number(o.qty||1));
    state.thermal.equipment[o.id]=(state.thermal.equipment[o.id]||0)+qty;
    log(`Cooling commissioned: ${item.name}`,`+${fmtNum(item.coolingKw*qty)} kW heat rejection`,"operations");
    showToast("Cooling commissioned",`${item.name} is installed and thermostatically controlled. The room will move toward its new target temperature over the next few simulated days.`,"success","mine");
    return false;
  });
}
function advanceProcurement(){state.procurementOrders=state.procurementOrders.filter(o=>{if(o.due>state.time)return true;const h=HARDWARE.find(x=>x.id===o.id);if(!h)return false;if((o.slips||0)<2&&nextRand()<(o.risk||0)){const delay=14+Math.floor(nextRand()*42);o.due=state.time+delay*DAY;o.slips=(o.slips||0)+1;log(`${h.name} delivery slipped`,`${o.vendor||"supplier"} · ${delay} additional days`);showToast("Delivery delayed",`${h.name} shipment slipped by ${delay} days (${o.label}).`,"warning","mine");return true}let delivered=Number(o.qty);if(delivered>1&&nextRand()<(o.partialRisk||0)){delivered=Math.max(1,Math.floor(delivered*(.45+nextRand()*.3)));const remaining=Number(o.qty)-delivered;state.procurementOrders.push({...o,qty:remaining,due:state.time+(14+Math.floor(nextRand()*28))*DAY,slips:2,label:`${o.label} · balance shipment`});log(`${h.name} partially delivered`,`${delivered} received · ${remaining} remain with ${o.vendor||"supplier"}`)}state.inactiveHardware[o.id]=(state.inactiveHardware[o.id]||0)+delivered;log(`Miner delivery received`,`${delivered} × ${h.name} awaiting activation`);showToast("Miners have arrived",`${delivered} × ${h.name} is staged.${delivered<Number(o.qty)?" The remaining allocation is still in transit.":""}`,"info","mine");renderFullQueued=true;return false})}
function activateHardware(id){const h=HARDWARE.find(x=>x.id===id),qty=Math.max(0,Math.floor(state.inactiveHardware?.[id]||0));if(!h||qty<1)return;const trial=JSON.parse(JSON.stringify(state));trial.hardware[id]=(trial.hardware[id]||0)+qty;if(!fleet(trial).within)return showToast("Commissioning blocked",`${qty} × ${h.name} no longer fits the active facility. Free capacity or upgrade the site.`);const days=Math.max(1,Math.ceil(qty/(hasStaff("fieldtech")?40:20)));state.inactiveHardware[id]=0;state.commissioningJobs.push({id,qty,due:state.time+days*DAY});log(`Commissioning started: ${h.name}`,`${qty} units · ${days} days` ,"fleet");showToast("Machines being commissioned",`${qty} × ${h.name} is being racked, configured and tested over ${days} simulation day${days===1?"":"s"}.`,"info","mine");save();renderMineContent()}
function decommissionHardware(id,requested=1){const h=HARDWARE.find(x=>x.id===id),owned=state.hardware[id]||0;if(!h||h.permanent||owned<1)return;const qty=Math.min(owned,Math.max(1,Math.floor(Number(requested)||1)));state.hardware[id]-=qty;state.poweredDownHardware[id]=Math.min(state.poweredDownHardware[id]||0,state.hardware[id]);state.decommissionedHardware[id]=(state.decommissionedHardware[id]||0)+qty;log(`Retired ${qty} × ${h.name}`,"Isolated from power and ready for resale","fleet");showToast("Machines retired",`${qty} × ${h.name} is in storage and ready to sell.`,"info","mine");save();renderMineContent()}
function setHardwarePower(id,powerOn,requested=1){
  const h=HARDWARE.find(x=>x.id===id),owned=state.hardware[id]||0;if(!h||owned<1)return;const paused=hardwarePoweredDownCount(h),qty=Math.max(1,Math.floor(Number(requested)||1));
  if(powerOn){const changed=Math.min(paused,qty);if(!changed)return;state.poweredDownHardware[id]=paused-changed;log(`Started ${changed} × ${h.name}`,`${state.poweredDownHardware[id]} remain manually off`,"fleet");showToast("Miners started",`${changed} × ${h.name} will add heat and hash rate while site power is available.`,"info","mine")}
  else{const repairing=Math.min(owned,Math.max(hardwareFaultCount(h),activeServiceJob(id)?.count||0)),available=Math.max(0,owned-paused-repairing),changed=Math.min(available,qty);if(!changed)return showToast("No running units",`Every available ${h.name} is already stopped or in repair.`);state.poweredDownHardware[id]=paused+changed;log(`Paused ${changed} × ${h.name}`,"Cooling load reduced without retiring hardware","fleet");showToast("Heat load reduced",`${changed} × ${h.name} is off. It earns nothing, draws no miner power and stops accumulating wear.`,"info","mine")}
  save();renderMineContent();
}
function buyCooling(id){
  const item=COOLING_EQUIPMENT.find(x=>x.id===id),tier=facilityTier();if(!item||state.time<at(item.date)||tier<item.minTier||tier>item.maxTier)return showToast("Cooling unavailable","This equipment does not fit the current facility tier or date.");
  if(state.cash<item.cost)return showToast("Not enough cash",`${item.name} costs ${fmtUsd(item.cost)}.`);
  const trial=JSON.parse(JSON.stringify(state));(trial.thermal.orders||[]).forEach(o=>{trial.thermal.equipment[o.id]=(trial.thermal.equipment[o.id]||0)+Number(o.qty||1)});trial.thermal.equipment[id]=(trial.thermal.equipment[id]||0)+1;const projected=fleet(trial);if(projected.potentialKw>projected.cap)return showToast("Electrical headroom required",`${item.name} adds ${item.watts.toLocaleString("en-US")} W of peak cooling demand. With your fleet and any cooling already on order, the site would need ${fmtNum(projected.potentialKw)} kW against its ${fmtNum(projected.cap)} kW supply. Pause miners or move to a larger facility first.`);
  const days=coolingInstallDays(item);state.cash-=item.cost;state.thermal.orders.push({id,qty:1,due:state.time+days*DAY,cost:item.cost});log(`Ordered cooling: ${item.name}`,`-${fmtUsd(item.cost)} · ${days}-day install`,"operations");showToast("Cooling ordered",`${item.name} is paid for and booked in. The installers need ${days} simulated days, and it rejects no heat until the job is finished on ${dateFmt(state.time+days*DAY)}.`,"info","mine");save();renderMineContent();
}
function buyHardware(id,requested=1){
  const h=HARDWARE.find(x=>x.id===id);if(!h||h.permanent||state.time<at(h.date))return;
  const unitCost=hardwareUnitCost(h);
  let qty=Math.max(1,Math.floor(Number(requested)||1));qty=Math.min(qty,Math.floor(state.cash/unitCost));
  if(qty<1)return showToast("Not enough cash",`You need ${fmtUsd(unitCost)} for one ${h.name}.`);
  while(qty>0&&!plannedFleetFits(id,qty))qty--;
  if(qty<1)return showToast("Facility limit",facilityLimitMessage(id));
  const cost=unitCost*qty;state.cash-=cost;placeHardwareOrder(id,qty);
}
function buyHardwareBtc(id,requested=1){
  const h=HARDWARE.find(x=>x.id===id);if(!h||h.permanent||state.time<at(h.date))return;
  if(state.time<MARKET)return showToast("BTC checkout unavailable","A quoted BTC/USD market is required to price hardware in bitcoin.");
  const unitUsd=hardwareUnitCost(h),unitBtc=unitUsd/priceAt(state.time);
  let qty=Math.max(1,Math.floor(Number(requested)||1));qty=Math.min(qty,Math.floor(state.wallets.hot/unitBtc));
  if(qty<1)return showToast("Not enough hot BTC",`One ${h.name} costs ${fmtBtc(unitBtc)} at today's quoted rate.`);
  while(qty>0&&!plannedFleetFits(id,qty))qty--;
  if(qty<1)return showToast("Facility limit",facilityLimitMessage(id));
  const cost=unitBtc*qty;state.wallets.hot-=cost;placeHardwareOrder(id,qty,cost);
}
function sellHardware(id,requested=1){
  const h=HARDWARE.find(x=>x.id===id),owned=state.decommissionedHardware?.[id]||0;if(!h||owned<1||h.permanent)return showToast("Power down required",`Power down ${h?.name||"this hardware"} before selling it.`);
  let qty=Math.max(1,Math.floor(Number(requested)||1));qty=Math.min(qty,owned);
  const value=resaleHardwareValue(h)*qty;state.decommissionedHardware[id]-=qty;state.cash+=value;
  log(`Sold ${qty} × ${h.name}`,`+${fmtUsd(value)}`,"fleet");showToast("Miner sale complete",`${qty} × ${h.name} left the operation and ${fmtUsd(value)} is now spendable cash.`,"info","mine");save();renderMineContent();
}
function sellHardwareBtc(id,requested=1){
  const h=HARDWARE.find(x=>x.id===id),owned=state.decommissionedHardware?.[id]||0;if(!h||owned<1||h.permanent)return showToast("Power down required",`Power down ${h?.name||"this hardware"} before selling it.`);
  if(state.time<MARKET)return showToast("BTC resale unavailable","A quoted BTC/USD market is required to settle hardware resale in bitcoin.");
  const qty=Math.min(Math.max(1,Math.floor(Number(requested)||1)),owned),value=resaleHardwareValue(h)*qty,btc=value/priceAt(state.time);
  state.decommissionedHardware[id]-=qty;state.wallets.hot+=btc;log(`Sold ${qty} × ${h.name}`,`+${fmtBtc(btc)} · ${fmtUsd(value)} resale value`,"fleet");showToast("Miner sale complete",`${qty} × ${h.name} left the operation and ${fmtBtc(btc)} is now in the hot wallet.`,"info","mine");save();renderMineContent();
}
function resaleHardwareValue(h){
  const age=Math.max(0,(state.time-at(h.date))/DAY/365),halfLife=h.era==="HYDRO ASIC"?4:h.era==="ASIC"?3:h.era==="FPGA"?2:1.5;
  const retained=Math.max(.025,.45*Math.pow(.5,age/halfLife)),reference=priceAt(Math.max(MARKET,state.time-DAY*365)),market=Math.max(.7,Math.min(1.3,priceAt(state.time)/reference)),glut=state.hardwareGlut&&state.time<state.hardwareGlut.until?1-state.hardwareGlut.discount:1;
  return h.cost*retained*market*glut;
}
function facilityReserve(f){
  const r=region(),fs=fleet(),nodeW=nodePowerWatts();
  const rate=powerRate(r,state.time);
  let energy=(fs.w+nodeW)/1000*24*30.4375*rate;if(hasSkill("heat"))energy*=.96;
  const targetTier=Math.max(1,FACILITIES.findIndex(x=>x.id===f.id)+1),scale=[1,1.5,4,15,55,150,300,600][targetTier-1]||1,internet=(r.internet||75)*connectivityPlan().mult*scale;
  return (energy+f.rent+internet+staffMonthlyCost()+insuranceMonthlyCost()+totalNodeMonthlyOverhead())*2;
}
function upgradeFacility(id){
  const f=FACILITIES.find(x=>x.id===id);if(!f||state.time<at(f.date)||f.id===state.facility)return;
  const current=FACILITIES.findIndex(x=>x.id===state.facility),target=FACILITIES.findIndex(x=>x.id===id);
  if(target<current)return showToast("One-way expansion","Downsizing is not available in this build.");
  if(state.facilityUpgradeJob)return showToast("Upgrade underway","The current facility upgrade must finish before another can begin.");
  if(state.relocationJob)return showToast("Relocation underway","The fleet must arrive before a facility upgrade can begin.");
  const reserve=facilityReserve(f),required=f.cost+reserve;
  if(state.cash<f.cost)return showToast("Capital required",`Fit-out costs ${fmtUsd(f.cost)}.`);
  if(state.cash<required)return showToast("Cash reserve required",`Keep ${fmtUsd(reserve)} in liquid cash for two months of expected power, rent, connectivity, staff and node costs after the move.`);
  const risk=facilityMoveRisk(id)*(hasStaff("logistics")?.8:1);
  const days=Math.max(3,Math.ceil(4+fleet().count/70+(target-current-1)*2))*(hasStaff("logistics")?.8:1);
  state.cash-=f.cost;state.facilityUpgradeJob={id,due:state.time+Math.ceil(days)*DAY,cost:f.cost,risk};state.power=false;
  log(`Facility upgrade dispatched to ${f.name}`,`${Math.ceil(days)} days · -${fmtUsd(f.cost)}`,"operations");
  showToast("Upgrade underway",`Mining is paused while the fleet is powered down, moved and re-commissioned at ${f.name}. ETA ${dateFmt(state.facilityUpgradeJob.due)}.`);
  save();render();
}
function takeSpeculation(id,fraction){
  const s=SPECULATIONS.find(x=>x.id===id);if(!s||state.time<at(s.date)||state.speculations.includes(id))return;
  const stake=state.wallets.hot*fraction;if(stake<=0)return showToast("No spendable BTC","Speculative launches can only use BTC in your hot wallet.");
  state.wallets.hot-=stake;state.speculations.push(id);
  if(nextRand()<s.chance){const returnBtc=stake*s.payout;state.wallets.hot+=returnBtc;log(`${s.name} paid off`,`+${fmtBtc(returnBtc-stake)}`);showToast("Speculation paid off",`${s.name} returned ${s.payout.toFixed(1)}× your BTC stake.`)}
  else{log(`${s.name} went to zero`,`-${fmtBtc(stake)}`);showToast("Speculation lost",`${s.name} wiped out the BTC you allocated. The stake cannot be recovered.`,"bad")}
  save();render();
}
function donateBtc(id,fraction){
  const campaign=DONATION_CAMPAIGNS.find(x=>x.id===id);if(!campaign||state.time<at(campaign.date)||state.donations.some(x=>x.id===id))return;
  const btc=state.wallets.hot*fraction;if(btc<=0)return showToast("No spendable BTC","Donations use BTC from your hot wallet.");
  state.wallets.hot-=btc;state.donations.push({id,btc,time:state.time});log(`Donated: ${campaign.name}`,`-${fmtBtc(btc)}`);showToast("BTC donated",`${fmtBtc(btc)} sent to ${campaign.name}.`);save();render();
}
function moveRegion(id){
  const r=REGIONS.find(x=>x.id===id);if(!r||state.time<at(r.date)||id===state.region)return;
  if(state.relocationJob)return showToast("Relocation underway","The fleet must arrive before another move can be scheduled.");if(state.facilityUpgradeJob)return showToast("Upgrade underway","The fleet must finish its facility upgrade before a region move can begin.");if(id==="sichuan"&&state.time>=at("2021-06-21"))return showToast("Region closed","Industrial Bitcoin mining is prohibited here after the 2021 crackdown.");
  let cost=(r.move+fleet().value*.05)*(hasSkill("relocation")?.8:1)*(hasStaff("logistics")?.8:1);
  if(state.cash<cost)return showToast("Relocation blocked",`Moving the fleet costs ${fmtUsd(cost)}.`);
  const days=Math.max(7,Math.ceil(10+fleet().count/35+(r.move>40000?12:0)))*(hasStaff("logistics")?.8:1);state.cash-=cost;state.relocationJob={id,due:state.time+Math.ceil(days)*DAY,cost};state.power=false;log(`Relocation dispatched to ${r.name}`,`${Math.ceil(days)} days · -${fmtUsd(cost)}`,"operations");showToast("Fleet in transit",`Mining is paused while the fleet moves to ${r.name}. ETA ${dateFmt(state.relocationJob.due)}.`);save();render();
}
function buyNode(level){
  const costs={1:260,2:1200},dates={1:START,2:at("2016-01-01")};if(level<=state.node||state.time<dates[level])return;
  if(state.cash<costs[level])return showToast("Not enough cash",`Node setup costs ${fmtUsd(costs[level])}.`);
  state.cash-=costs[level];state.node=level;log(level===1?"Dedicated full node online":"Hardened node online",`-${fmtUsd(costs[level])}`);showToast(level===1?"Continuous verification":"Hardened node online",level===1?"The dedicated node keeps validating when the mining fleet is manually powered down.":"Higher-throughput synchronization and relay profiles are now available.");save();render();
}
function buyBackupNode(){
  if(state.backupNode.enabled||state.node<1||state.time<at(BACKUP_NODE.date))return;
  if(state.cash<BACKUP_NODE.cost)return showToast("Not enough cash",`${BACKUP_NODE.name} setup costs ${fmtUsd(BACKUP_NODE.cost)}.`);
  const lag=initialBackupSyncLag();state.cash-=BACKUP_NODE.cost;state.backupNode.enabled=true;state.nodeSync.backupLag=lag;state.nodeSync.backupPeak=lag;log("Geographic backup node deployed",`${fmtNum(lag)} days of block history queued for validation`);showToast("Initial block download",`The remote node is installed, but it must independently validate ${fmtNum(lag)} modelled days of backlog before it can protect verification continuity.`);save();render();
}
function upgradeNodeStorage(gb){
  const tier=NODE_STORAGE.find(x=>x.gb===Number(gb));if(!tier||tier.gb<=state.nodeStorage||state.time<at(tier.date))return;
  if(state.cash<tier.cost)return showToast("Not enough cash",`${tier.name} costs ${fmtUsd(tier.cost)}.`);
  state.cash-=tier.cost;state.nodeStorage=tier.gb;log("Node storage upgraded",`${tier.name} · -${fmtUsd(tier.cost)}`);save();render();
}
function setNodeMode(id){const profile=NODE_MODES.find(x=>x.id===id);if(!profile||(profile.requires&&state.node<profile.requires))return;state.nodeMode=id;state.nodePruned=id==="pruned";log(`Node profile: ${profile.name}`,`${nodeModeWatts(profile)} W · ${nodeModeConnections(profile)} peers · ${fmtUsd(nodeModeMonthly(profile))}/month network`);save();render()}
function toggleNodePruning(){setNodeMode(state.nodeMode==="pruned"?"archival":"pruned")}
function deriveWalletKeyHex(rolls){
  let n=0n;for(const r of rolls)n=n*6n+BigInt(r-1);
  return n.toString(16).padStart(64,"0").slice(-64);
}
function rollDie(){
  if(state.walletSetup.done||state.walletSetup.rolls.length>=99)return;
  const buf=new Uint8Array(1);crypto.getRandomValues(buf);
  state.walletSetup.rolls.push((buf[0]%6)+1);
  save();render();
}
function finishRolling(){
  if(state.walletSetup.done||state.walletSetup.rolls.length<8)return;
  const buf=new Uint8Array(99-state.walletSetup.rolls.length);crypto.getRandomValues(buf);
  buf.forEach(b=>state.walletSetup.rolls.push((b%6)+1));
  state.walletSetup.step=2;state.walletSetup.keyHex=deriveWalletKeyHex(state.walletSetup.rolls);
  save();render();
}
function skipWalletSetup(){
  if(state.walletSetup.done)return;
  const rolls=[];for(let i=0;i<99;i++)rolls.push(Math.floor(nextRand()*6)+1);
  state.walletSetup.rolls=rolls;state.walletSetup.keyHex=deriveWalletKeyHex(rolls);
  completeWalletSetup();
}
function completeWalletSetup(){
  if(state.walletSetup.done)return;
  const tier=walletSoftwareTierAt(state.campaignStart);
  state.walletSoftware=tier;state.walletSetup.done=true;
  log("Wallet key generated",`${state.walletSetup.rolls.length} dice rolls · installed ${WALLET_SOFTWARE[tier].name}`,"custody");
  state.speed=1;save();setTimer();render();
}
function upgradeWalletSoftware(){
  const next=state.walletSoftware+1;if(next>=WALLET_SOFTWARE.length)return;
  const tier=WALLET_SOFTWARE[next];if(state.time<at(tier.date))return;
  state.walletSoftware=next;state.points++;
  log(`Upgraded to ${tier.name}`,"+1 skill point","milestone");
  showToast(`Upgraded to ${tier.name}`,`${tier.desc} +1 skill point.`,"milestone","custody");
  save();render();
}
function triggerFaucet(t){
  faucet={amount:faucetAmount(t)};
  const host=document.getElementById("app");
  document.querySelector(".faucet-pop")?.remove();
  if(host&&state.started)host.insertAdjacentHTML("beforeend",faucetMarkup(faucet));
  clearTimeout(faucetTimer);
  faucetTimer=setTimeout(()=>{faucet=null;document.querySelector(".faucet-pop")?.remove()},6500);
}
function claimFaucet(){
  if(!faucet)return;const amt=faucet.amount;
  state.wallets.hot+=amt;log("Bitcoin Faucet claimed",`+${fmtBtc(amt)}`);
  clearTimeout(faucetTimer);faucet=null;document.querySelector(".faucet-pop")?.remove();save();refreshLive();
}
function deployLightning(fraction){
  if(!lightningAvailable())return showToast("Lightning unavailable","Lightning routing unlocks in 2018 and requires a synchronized dedicated primary node in archival or relay mode.");
  const btc=state.wallets.hot*fraction;if(btc<=0)return showToast("No spendable BTC","Move bitcoin into the hot wallet first.");
  state.wallets.hot-=btc;state.lightning.locked+=btc;log("Lightning liquidity deployed",`-${fmtBtc(btc)} locked`);save();render();
}
function withdrawLightning(){
  const btc=state.lightning?.locked||0;if(btc<=0)return;
  const fee=btc*.0005;state.lightning.locked=0;state.wallets.hot+=btc-fee;log("Lightning liquidity withdrawn",`+${fmtBtc(btc-fee)}`);save();render();
}
function payDebt(){
  if(state.debt<=0)return;if(state.cash<state.debt)return showToast("Bill still due",`You need ${fmtUsd(state.debt-state.cash)} more.`);
  state.cash-=state.debt;log("Grid service restored",fmtUsd(state.debt),"finance");state.debt=0;state.arrearsDue=0;state.gridCutAnnounced=false;state.power=!state.policyLock;showToast("Arrears cleared","Power and internet are restored. The next operating bill is due at the month boundary as usual.","success","dashboard");save();render();
}
function setContract(id){if(!POWER_CONTRACTS.some(x=>x.id===id)||id===state.contract)return;state.contract=id;log("Power contract changed",powerContract().name);save();render()}
function setConnectivityPlan(id){const plan=CONNECTIVITY_PLANS.find(x=>x.id===id);if(!plan||id===state.connectivity)return;if(plan.minFacility&&facilityTier()<plan.minFacility)return showToast("Connectivity unavailable",`${plan.name} requires a tier ${plan.minFacility} facility or larger.`);state.connectivity=id;log("Connectivity plan changed",`${plan.name} · ${fmtUsd(internetMonthlyCost())}/month`);save();render()}
function setTreasuryPolicy(id){if(!TREASURY_POLICIES.some(x=>x.id===id)||id===state.treasuryPolicy)return;state.treasuryPolicy=id;log("Settlement conversion changed",treasuryPolicy().name,"operations");save();render()}
function hireStaff(id){const s=STAFF.find(x=>x.id===id);if(!s||(id!=="fieldtech"&&hasStaff(id)))return;if(!staffHiringAvailable())return showToast("Staffing unavailable","Move into the tier 3 Light industrial unit or a larger facility before building an internal team.");state.staff.push(id);const count=fieldTechnicianCount();log(`Hired ${s.name}`,id==="fieldtech"?`${count} technicians · ${fmtUsd(s.salary*count)}/month total`:`${fmtUsd(s.salary)}/month`);save();render()}
function dismissStaff(id){
  const role=STAFF.find(x=>x.id===id);if(!role||!hasStaff(id))return;
  if(id==="fieldtech"){
    const committed=(state.maintenance.serviceJobs||[]).reduce((sum,job)=>sum+(job.contracted?0:Number(job.crew||0)),0);
    if(fieldTechnicianCount()-1<committed)return showToast("Technician still on a job",`${committed} technician${committed===1?" is":"s are"} assigned to active repairs. Wait for a service job to finish before cutting the crew.`);
  }
  state.staff.splice(state.staff.indexOf(id),1);
  state.billLedger.staff=(state.billLedger.staff||0)+role.salary;state.bill+=role.salary;
  const techs=fieldTechnicianCount();
  if(!techs&&state.autoRepair)state.autoRepair=false;
  log(`Dismissed ${role.name}`,`One month notice · ${fmtUsd(role.salary)} added to this month's bill${id==="fieldtech"?` · ${techs} technician${techs===1?"":"s"} remaining`:""}`);
  showToast(`${role.name} dismissed`,`Salary stops now. One month's notice (${fmtUsd(role.salary)}) is added to the accrued bill.${id==="fieldtech"&&!techs?" You are back to servicing the fleet yourself.":""}`,"info");
  save();render();
}
function toggleInsurance(){state.insured=!state.insured;log(state.insured?"Migration insurance bound":"Migration insurance cancelled",state.insured?`${fmtUsd(insuranceMonthlyCost())}/month`:"");save();render()}
function fiatCollateral(){return Math.max(0,state.cash-state.projectLoan)}
function reserveMilestoneStatus(){const monthlyBurn=monthlyCost().total+(state.projectLoan||0)*(hasStaff("treasurer")?.009:.012),required=monthlyBurn*6,collateral=fiatCollateral(),days=Math.max(0,state.uptimeDays||0),tier=facilityTier();return{monthlyBurn,required,collateral,days,tier,ok:tier>=2&&days>=180&&state.debt<=0&&collateral>=required}}
function reserveMilestoneProgress(){const r=reserveMilestoneStatus();if(state.milestones.includes("reserve"))return"Six-month reserve achieved";if(r.tier<2)return"Reserve goal: move into a tier 2 facility";if(r.days<180)return`Reserve goal: ${180-r.days} operating day${180-r.days===1?"":"s"} remaining`;if(state.debt>0)return"Reserve goal: clear grid arrears";return`Reserve goal: ${fmtUsd(r.collateral)} / ${fmtUsd(r.required)} unborrowed fiat`}
function projectLoanLimit(){return Math.max(fiatCollateral()*.5,(state.operator?.lastRevenueUsd||0)*6)}
function projectLoanHeadroom(){return state.time<PROJECT_FINANCE_START?0:Math.max(0,projectLoanLimit()-state.projectLoan)}
function projectFinanceReason(){if(state.time<PROJECT_FINANCE_START)return`Unavailable until ${dateFmt(PROJECT_FINANCE_START,true)}: lenders do not yet finance experimental Bitcoin mining`;const collateral=fiatCollateral(),revenue=state.operator?.lastRevenueUsd||0,headroom=projectLoanHeadroom();if(headroom>0)return`${fmtUsd(headroom)} available against fiat collateral or six months of recent mining revenue`;if(collateral<=0&&revenue<=0)return"Unavailable: establish liquid collateral or a revenue-producing mining record";return"Unavailable: operating-credit capacity is fully drawn; repay principal or grow monthly mining revenue"}
function takeProjectLoan(){const max=projectLoanHeadroom(),amount=Math.min(max,Math.max(1000,Math.round(projectLoanLimit()*.25/1000)*1000));if(amount<=0)return showToast("Growth funding unavailable",projectFinanceReason());state.projectLoan+=amount;state.cash+=amount;log("Fiat-backed finance drawn",`+${fmtUsd(amount)}`);save();render()}
function repayProjectLoan(){const amount=Math.min(state.cash,state.projectLoan);if(amount<=0)return;state.cash-=amount;state.projectLoan-=amount;log("Project finance repaid",`-${fmtUsd(amount)}`);save();render()}
function checkMilestones(){MILESTONES.forEach(m=>{if(!state.milestones.includes(m.id)&&m.check()){state.milestones.push(m.id);state.milestoneLog.push({id:m.id,time:state.time});state.points++;log(`Milestone: ${m.label}`,"+1 skill point","milestone");showToast(m.label,`${m.blurb} +1 skill point.`,"milestone")}})}
/* ORDER-BOOK DEPTH — a book whose depth scales with the size of the market moves against
   you in proportion to the fraction of that market your order represents. Market
   capitalisation is recorded; the constant, and the premise that depth tracks
   capitalisation, are modelled.

   This is what stops an early fortune from being a free one. In December 2010 the whole
   market was capitalised at $1.3M, so an idle run's holdings were most of a percent of every
   bitcoin in existence and could not be sold at the quote at any price. The same order is a
   rounding error by 2020, so the effect retires itself as the market grows — no era-specific
   tuning, and nothing to unwind once the market is deep.

   Proportional rather than square-root impact: the recorded capitalisation spans six orders
   of magnitude across the campaign, and a square-root law compresses that into a range too
   narrow to be either honest about 2010 or fair to 2026.

   Pressure carries between trades and decays with a three-day half-life. Slicing one
   unsellable order into a hundred small ones saves at most half the impact, the same
   advantage real execution algorithms get, while genuinely waiting for the book to refill
   works properly — which is the decision the era actually posed. Buying relieves your own
   selling pressure, so only a same-direction imbalance counts against you. */
const IMPACT_K=66,IMPACT_MAX=.85,IMPACT_FLOOR=.001,PRESSURE_HALFLIFE=3*DAY;
function recentPressure(){const p=state.marketPressure;if(!p||!p.usd)return 0;const elapsed=Math.max(0,state.time-p.at);if(elapsed>PRESSURE_HALFLIFE*20)return 0;return p.usd*Math.pow(.5,elapsed/PRESSURE_HALFLIFE)}
function addPressure(usd,side){state.marketPressure={usd:recentPressure()+side*Math.max(0,usd),at:state.time}}
function tradeImpact(usd,side){const cap=marketCapAt(state.time);if(!(cap>0)||!(usd>0))return 0;const standing=Math.max(0,side*recentPressure()),impact=IMPACT_K*(standing+usd)/cap;return impact<IMPACT_FLOOR?0:Math.min(IMPACT_MAX,impact)}
function impactNote(impact){return impact>=IMPACT_FLOOR?`${(impact*100).toFixed(impact<.01?2:1)}% market impact`:""}
function venueTradeFee(bucket){return bucket==="mtgox"?.008:bucket==="frontier"?.004:bucket==="etf"?.0025:.006}
function buyBtc(bucket,fraction){
  if(state.time<MARKET)return;fraction=clamp(Number(fraction)||0,0.01,1);const usd=state.cash*fraction;if(usd<1)return showToast("Order too small","Increase the selected percentage so the buy order is at least $1.");
  const fee=venueTradeFee(bucket);
  const impact=bucket==="etf"?0:tradeImpact(usd,-1),btc=usd*(1-fee)/(priceAt(state.time)*(1+impact));
  if(impact>0)addPressure(usd,-1);
  state.cash-=usd;state.wallets[bucket]+=btc;log(bucket==="etf"?"Bought ETF exposure":"Bought bitcoin",`+${fmtBtc(btc)} · -${fmtUsd(usd)} at ${fmtUsd(priceAt(state.time))}`,"trade");showToast(bucket==="etf"?"ETF purchase complete":"Bitcoin purchase complete",`${fmtUsd(usd)} became ${fmtBtc(btc)} in ${walletName(bucket)}. ${fmtUsd(state.cash)} cash remains.`,"info","market");save();render();
}
function sellBtc(bucket,fraction){
  if(venueFrozen(bucket))return showToast("Withdrawals frozen",`${walletName(bucket)} has paused withdrawals until ${dateFmt(state.ops.venueFreezes[bucket])}.`);
  fraction=clamp(Number(fraction)||0,0.01,1);const btc=state.wallets[bucket]*fraction;if(btc<=0)return;
  const fee=venueTradeFee(bucket);
  const price=priceAt(state.time),notional=btc*price,impact=bucket==="etf"?0:tradeImpact(notional,1),usd=notional*(1-fee)*(1-impact);
  if(impact>0)addPressure(notional,1);
  state.wallets[bucket]-=btc;state.cash+=usd;log(bucket==="etf"?"Sold ETF exposure":"Sold bitcoin",`-${fmtBtc(btc)} · +${fmtUsd(usd)} at ${fmtUsd(price)}${impact>=.001?` · ${impactNote(impact)}`:""}`,"trade");
  if(state.settlementSaleMode&&state.pendingSettlement&&state.cash+1e-8>=state.pendingSettlement.due){state.settlementSaleMode=false;finishMonthlySettlement("btc-rescue");return}
  showToast(bucket==="etf"?"ETF sale complete":"Bitcoin sale complete",impact>=.01?`${fmtBtc(btc)} became ${fmtUsd(usd)}. The order was ${formatPercent(impact*100)}% of its quoted value larger than the book could absorb, so it filled below the quote. ${fmtUsd(state.cash)} cash is now available.`:`${fmtBtc(btc)} became ${fmtUsd(usd)} after fees. ${fmtUsd(state.cash)} cash is now available.`,"info","market");save();render();
}
function transfer(from,to,fraction){
  if(venueFrozen(from))return showToast("Withdrawals frozen",`${walletName(from)} has paused withdrawals until ${dateFmt(state.ops.venueFreezes[from])}.`);
  fraction=clamp(Number(fraction)||0,0.01,1);const gross=state.wallets[from]*fraction;if(gross<=0)return;
  const baseFee=nodeOnline()&&state.nodeMode==="relay"?0.000035:nodeOnline()&&state.nodeMode!=="pruned"?0.00005:0.0002,fee=baseFee*(hasSkill("multisig")?.8:1);if(gross<=fee)return showToast("Transfer too small",`The selected ${formatPercent(fraction*100)}% is not enough to cover the ${fmtBtc(fee)} network fee.`);const btc=gross-fee;
  state.wallets[from]-=gross;state.wallets[to]+=btc;log(`Moved BTC: ${walletName(from)} → ${walletName(to)}`,`${fmtBtc(gross)} sent · -${fmtBtc(fee)} fee`);showToast("BTC transfer complete",`${fmtBtc(btc)} reached ${walletName(to)} after a ${fmtBtc(fee)} network fee.`,"info","custody");save();render();
}
const CONFIRMABLE_ACTIONS=new Set(["buy-btc","sell-btc","buy-hw","buy-hw-btc","sell-hw","sell-hw-btc","buy-strategy","sell-strategy","buy-node","buy-backup-node"]);
function transactionPreview(button){
  const action=button.dataset.action,id=button.dataset.id||null,base={action,id,from:button.dataset.from||null,to:button.dataset.to||null,resumeSpeed:state.speed,quoteTime:state.time};
  if(action==="buy-btc"){
    if(state.time<MARKET)return null;const fraction=actionFraction(button),usd=state.cash*fraction,feeRate=venueTradeFee(id),price=priceAt(state.time);if(usd<1){showToast("Order too small","Increase the selected percentage so the buy order is at least $1.");return null}const isEtf=id==="etf",impact=isEtf?0:tradeImpact(usd,-1),btc=usd*(1-feeRate)/(price*(1+impact));
    return{...base,fraction,title:isEtf?"Review ETF purchase":`Review bitcoin purchase · ${walletName(id)}`,kicker:"Market buy · quote locked",give:fmtUsd(usd),giveSub:`${formatPercent(fraction*100)}% of ${fmtUsd(state.cash)} liquid cash`,receive:isEtf?`${fmtBtc(btc)} equivalent exposure`:fmtBtc(btc),receiveSub:isEtf?"Brokerage exposure · not withdrawable BTC":`Credited to ${walletName(id)}`,reference:`${fmtUsd(price)} per BTC`,fees:`${fmtUsd(usd*feeRate)} · ${(feeRate*100).toFixed(2)}%`,depth:impact>=.001?`${impactNote(impact)} · fills above the quote`:"",after:`${fmtUsd(state.cash-usd)} cash · ${fmtBtc(state.wallets[id]+btc)} position`,confirmLabel:"Confirm buy",confirmClass:"primary"}
  }
  if(action==="sell-btc"){
    if(venueFrozen(id)){showToast("Withdrawals frozen",`${walletName(id)} has paused withdrawals until ${dateFmt(state.ops.venueFreezes[id])}.`);return null}const fraction=actionFraction(button),btc=state.wallets[id]*fraction,feeRate=venueTradeFee(id),price=priceAt(state.time),gross=btc*price,isEtf=id==="etf",impact=isEtf?0:tradeImpact(gross,1),usd=gross*(1-feeRate)*(1-impact);if(btc<=0)return null;
    return{...base,fraction,title:isEtf?"Review ETF sale":`Review bitcoin sale · ${walletName(id)}`,kicker:"Market sell · quote locked",give:isEtf?`${fmtBtc(btc)} equivalent exposure`:fmtBtc(btc),giveSub:`${formatPercent(fraction*100)}% of the ${walletName(id)} position`,receive:fmtUsd(usd),receiveSub:"Added to liquid fiat after fees",reference:`${fmtUsd(price)} per BTC`,fees:`${fmtUsd(gross*feeRate)} · ${(feeRate*100).toFixed(2)}%`,depth:impact>=.001?`−${fmtUsd(gross*(1-feeRate)*impact)} · ${impactNote(impact)}`:"",after:`${fmtUsd(state.cash+usd)} cash · ${fmtBtc(state.wallets[id]-btc)} position`,confirmLabel:"Confirm sell",confirmClass:"danger"}
  }
  if(action==="buy-hw"||action==="buy-hw-btc"){
    const h=HARDWARE.find(item=>item.id===id);if(!h||h.permanent)return null;const payBtc=action==="buy-hw-btc",unitUsd=hardwareUnitCost(h),unit=payBtc?unitUsd/priceAt(state.time):unitUsd,balance=payBtc?state.wallets.hot:state.cash;let qty=Math.min(Math.max(1,Math.floor(Number(button.dataset.value)||1)),Math.floor(balance/unit));while(qty>0&&!plannedFleetFits(id,qty))qty--;if(qty<1){showToast(payBtc?"Not enough hot BTC":"Purchase unavailable",payBtc?`One ${h.name} costs ${fmtBtc(unit)} at the locked quote.`:facilityLimitMessage(id));return null}const cost=unit*qty,terms=procurementTerms(h);
    return{...base,requested:qty,title:`Review miner purchase · ${h.name}`,kicker:`Hardware buy · ${terms.label}`,give:payBtc?fmtBtc(cost):fmtUsd(cost),giveSub:payBtc?`${fmtUsd(unitUsd*qty)} at ${fmtUsd(priceAt(state.time))}/BTC`:`${qty} × ${fmtUsd(unitUsd)} from liquid fiat`,receive:`${fmtCompactNumber(qty)} × ${h.name}`,receiveSub:`${fmtHash(h.hash*qty)} physical hash · delivery in ${terms.days} days`,reference:payBtc?`${fmtBtc(unit)} each`:`${fmtUsd(unitUsd)} each`,fees:"No modelled checkout fee",after:payBtc?`${fmtBtc(state.wallets.hot-cost)} hot BTC remains`:`${fmtUsd(state.cash-cost)} cash remains`,confirmLabel:"Confirm miner order",confirmClass:"primary"}
  }
  if(action==="sell-hw"||action==="sell-hw-btc"){
    const h=HARDWARE.find(item=>item.id===id),retired=state.decommissionedHardware?.[id]||0;if(!h||h.permanent||retired<1)return showToast("Retire miners first",`Move ${h?.name||"this hardware"} to storage before selling it.`);const qty=Math.min(Math.max(1,Math.floor(Number(button.dataset.value)||1)),retired),unit=resaleHardwareValue(h),value=unit*qty,payBtc=action==="sell-hw-btc",btc=payBtc?value/priceAt(state.time):0;
    return{...base,requested:qty,title:`Review miner sale · ${h.name}`,kicker:"Hardware sell · secondary-market quote",give:`${fmtCompactNumber(qty)} × ${h.name}`,giveSub:`${fmtHash(h.hash*qty)} physical hash leaves storage`,receive:payBtc?fmtBtc(btc):fmtUsd(value),receiveSub:payBtc?`${fmtUsd(value)} at ${fmtUsd(priceAt(state.time))}/BTC`:"Added to liquid fiat",reference:`${fmtUsd(unit)} resale per miner`,fees:"No modelled broker fee",after:payBtc?`${fmtCompactNumber(retired-qty)} retired miners · ${fmtBtc(state.wallets.hot+btc)} hot BTC`:`${fmtCompactNumber(retired-qty)} retired miners · ${fmtUsd(state.cash+value)} cash`,confirmLabel:"Confirm miner sale",confirmClass:"danger"}
  }
  if(action==="buy-strategy"){
    const security=strategySecurity(id),fraction=clamp(Number(button.dataset.value)||0,0.01,1),usd=state.cash*fraction,price=strategyPrice(id),shares=usd/price;if(!security||usd<1||price<=0)return null;
    return{...base,fraction,title:`Review ${security.ticker} purchase`,kicker:"Strategy security buy · model quote",give:fmtUsd(usd),giveSub:`${formatPercent(fraction*100)}% of liquid cash`,receive:`${shares.toFixed(4)} ${security.ticker} shares`,receiveSub:`Position value ${fmtUsd(strategyValue(id)+usd)}`,reference:`${fmtUsd(price)} per share`,fees:"No modelled brokerage fee",after:`${fmtUsd(state.cash-usd)} cash · ${((state.strategy[id]||0)+shares).toFixed(4)} shares`,confirmLabel:"Confirm security buy",confirmClass:"primary"}
  }
  if(action==="sell-strategy"){
    const security=strategySecurity(id),held=state.strategy[id]||0,fraction=clamp(Number(button.dataset.value)||0,0.01,1),shares=held*fraction,price=strategyPrice(id),gross=shares*price;if(!security||shares<=0)return null;
    return{...base,fraction,title:`Review ${security.ticker} sale`,kicker:"Strategy security sell · model quote",give:`${shares.toFixed(4)} ${security.ticker} shares`,giveSub:`${formatPercent(fraction*100)}% of the current position`,receive:fmtUsd(gross),receiveSub:"Added to liquid fiat",reference:`${fmtUsd(price)} per share`,fees:"No modelled brokerage fee",after:`${fmtUsd(state.cash+gross)} cash · ${(held-shares).toFixed(4)} shares`,confirmLabel:"Confirm security sale",confirmClass:"danger"}
  }
  if(action==="buy-node"){
    const level=Number(button.dataset.value),cost=level===2?1200:260,name=level===2?"Hardened node":"Dedicated full node";if(state.cash<cost)return null;
    return{...base,requested:level,title:`Review infrastructure purchase · ${name}`,kicker:"Node purchase",give:fmtUsd(cost),giveSub:"Paid from liquid fiat",receive:name,receiveSub:level===2?"Higher-throughput validation and relay infrastructure":"Independent validation when miners are manually stopped",reference:`${fmtUsd(cost)} fixed equipment cost`,fees:"No modelled checkout fee",after:`${fmtUsd(state.cash-cost)} liquid cash`,confirmLabel:"Confirm node purchase",confirmClass:"primary"}
  }
  if(action==="buy-backup-node"){
    if(state.cash<BACKUP_NODE.cost)return null;return{...base,title:"Review infrastructure purchase · geographic backup",kicker:"Remote node purchase",give:fmtUsd(BACKUP_NODE.cost),giveSub:"Paid from liquid fiat",receive:"Independent remote full node",receiveSub:`${BACKUP_NODE.watts} W remote load · ${fmtUsd(BACKUP_NODE.monthly)}/month ongoing`,reference:`${fmtUsd(BACKUP_NODE.cost)} deployment cost`,fees:"No modelled checkout fee",after:`${fmtUsd(state.cash-BACKUP_NODE.cost)} liquid cash`,confirmLabel:"Confirm backup-node purchase",confirmClass:"primary"}
  }
  return null;
}
function transactionPreviewValid(preview){return !!preview&&[preview.give,preview.receive,preview.reference,preview.fees,preview.after].every(value=>!/(?:—|NaN|Infinity)/.test(String(value)))}
function requestTransactionConfirmation(button){const preview=transactionPreview(button);if(!preview)return;if(!transactionPreviewValid(preview))return showToast("Quote unavailable","One or more transaction values could not be calculated. No balances were changed.");state.lastReal=Date.now();state.speed=0;pendingTransaction=preview;setTimer();render()}
function restoreTransactionSpeed(transaction){state.speed=transaction?.resumeSpeed||0;if(state.speed>0)state.returnSpeed=state.speed;state.lastReal=Date.now();setTimer()}
function cancelTransactionConfirmation(){const transaction=pendingTransaction;pendingTransaction=null;restoreTransactionSpeed(transaction);render()}
function confirmTransaction(){
  const transaction=pendingTransaction;if(!transaction)return;pendingTransaction=null;restoreTransactionSpeed(transaction);
  if(transaction.action==="buy-btc")buyBtc(transaction.id,transaction.fraction);else if(transaction.action==="sell-btc")sellBtc(transaction.id,transaction.fraction);else if(transaction.action==="buy-hw")buyHardware(transaction.id,transaction.requested);else if(transaction.action==="buy-hw-btc")buyHardwareBtc(transaction.id,transaction.requested);else if(transaction.action==="sell-hw")sellHardware(transaction.id,transaction.requested);else if(transaction.action==="sell-hw-btc")sellHardwareBtc(transaction.id,transaction.requested);else if(transaction.action==="buy-strategy")buyStrategy(transaction.id,transaction.fraction);else if(transaction.action==="sell-strategy")sellStrategy(transaction.id,transaction.fraction);else if(transaction.action==="buy-node")buyNode(transaction.requested);else if(transaction.action==="buy-backup-node")buyBackupNode();
  if(document.querySelector('[data-action="confirm-transaction"]'))render();
}
function unlockSkill(id){
  const s=SKILLS.find(x=>x.id===id);if(!s||hasSkill(id)||state.points<s.cost||skillGateReason(s))return;
  state.points-=s.cost;state.skills.push(id);log(`Unlocked ${s.name}`,`-${s.cost} point${s.cost===1?"":"s"}`);save();render();
}
function startLearning(id){
  const item=LEARNING.find(x=>x.id===id);if(!item||state.learning||state.completedLearning.includes(id)||state.time<at(item.date))return;
  state.learning={id,progress:0,waiting:false};log(item.type==="Podcast"?`Subscribed: ${item.title}`:`Started reading: ${item.title}`,`${item.days} days`);save();render();
}
function answerLearningCheck(answer){
  const item=learningItem();if(!item||!state.learning.waiting||!item.check)return;
  const correct=Number(answer)===item.check.answer;awardLearning(item,correct?1:.6);if(!correct)showToast("Knowledge check missed",`You completed ${item.title}, but received 60% of the available knowledge. Review the explanation before the next lesson.`,"warning","learn");save();render();
}
function venueAvailable(id){
  if(id==="mtgox")return state.time>=MARKET&&state.time<at("2014-02-24");
  if(id==="bitfinex")return state.time>=at("2012-10-01");
  if(id==="quadriga")return state.time>=at("2013-01-01")&&state.time<at("2019-02-05");
  if(id==="frontier")return state.time>=at("2011-06-01")&&state.time<at("2022-11-11");
  if(id==="exchange")return state.time>=at("2015-01-01");
  if(id==="cold")return state.time>=at("2012-01-01");
  if(id==="etf")return state.time>=at("2024-01-10");return true;
}
function walletName(id){return({hot:"Node-connected hot wallet",cold:"Cold / hardware wallet",mtgox:"Mt. Gox",bitfinex:"Bitfinex",quadriga:"QuadrigaCX",frontier:"Frontier exchange",exchange:"Regulated exchange",etf:"ETF exposure",frozen:"Frozen claims"})[id]||id}
function resetGame(){if(!confirm("Erase this run and return to the Genesis Block?"))return;state=initialState();OPERATOR_ERAS.forEach(era=>state.operator.eras[era.id]={months:0,solvent:0,profitable:0,uptime:0,competitive:0});migrateActivity(state);activeTab="dashboard";activityFilter="all";activityLimit=100;tradePercentages={};introDifficulty="hard";introStartingCash=STARTING_LIQUIDITY_MIN;introStep=0;clearTimeout(faucetTimer);faucet=null;save();setTimer();render()}
function exportSave(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="hashrate-save.json";a.click();URL.revokeObjectURL(url);
}
function importSave(file){
  const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result));if(!parsed||parsed.version!==1||!parsed.wallets||!parsed.hardware)throw new Error("invalid");const restored=Object.assign(initialState(),parsed,{lastReal:Date.now()});restored.points=Number.isFinite(Number(restored.points))?Math.max(0,Math.floor(Number(restored.points))):0;restored.skills=Array.isArray(restored.skills)?[...new Set(restored.skills.filter(id=>SKILLS.some(s=>s.id===id)))]:[];restored.seen=Array.isArray(restored.seen)?restored.seen:[];restored.milestones=Array.isArray(restored.milestones)?restored.milestones:[];restored.milestoneLog=Array.isArray(restored.milestoneLog)?restored.milestoneLog:[];restored.exposureWarned=Array.isArray(restored.exposureWarned)?restored.exposureWarned:[];restored.maintenance.selfRepairs=restored.maintenance.selfRepairs&&typeof restored.maintenance.selfRepairs==="object"?restored.maintenance.selfRepairs:{};restored.xp=normalizeXp(restored.xp);restored.exposureWarned=Array.isArray(restored.exposureWarned)?restored.exposureWarned:[];restored.startingGrant=!!restored.startingGrant;restored.difficulty=STARTING_MODES.some(mode=>mode.id===restored.difficulty)?restored.difficulty:(startingModeForCash(restored.startingCash)?.id||"legacy");restored.treasuryPolicy=TREASURY_POLICIES.some(x=>x.id===restored.treasuryPolicy)?restored.treasuryPolicy:"cover";restored.operator=Object.assign(initialState().operator,restored.operator||{});restored.operator.eras=restored.operator.eras||{};OPERATOR_ERAS.forEach(era=>restored.operator.eras[era.id]=Object.assign({months:0,solvent:0,profitable:0,uptime:0,competitive:0},restored.operator.eras[era.id]||{}));restored.poweredDownHardware=restored.poweredDownHardware&&typeof restored.poweredDownHardware==="object"?restored.poweredDownHardware:{};restored.thermal=Object.assign({temperature:22,equipment:{}},restored.thermal||{});restored.thermal.equipment=restored.thermal.equipment&&typeof restored.thermal.equipment==="object"?restored.thermal.equipment:{};COOLING_EQUIPMENT.forEach(item=>restored.thermal.equipment[item.id]=Math.max(0,Math.floor(Number(restored.thermal.equipment[item.id])||0)));HARDWARE.forEach(h=>restored.poweredDownHardware[h.id]=Math.max(0,Math.min(restored.hardware[h.id]||0,Math.floor(Number(restored.poweredDownHardware[h.id])||0))));migrateActivity(restored);migrateHardwareAlerts(restored,!!parsed.hardwareAlerts);state=restored;activeTab="dashboard";activityFilter="all";activityLimit=100;clearTimeout(faucetTimer);faucet=null;save();setTimer();render();showToast("Run restored","The imported ledger is now active.")}catch(e){showToast("Import failed","That file is not a valid Hashrate save.")}};reader.readAsText(file);
}
