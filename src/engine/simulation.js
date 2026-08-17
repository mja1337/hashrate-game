"use strict";

/* SIMULATION LAYER — deterministic state and economics. */
const SAVE_KEY="hashrate-genesis-save-v1";
const STARTING_MODES=[
  {id:"easy",label:"Easy",start:1233100800000,desc:"Begin five days earlier, while the network is a little quieter."},
  {id:"medium",label:"Standard",start:1233619200000,desc:"Begin on the original campaign opening: 03 February 2009."},
  {id:"hard",label:"Hard",start:1288483200000,desc:"Join late, after the earliest mining opportunity has passed."}
];
function startingMode(id){return STARTING_MODES.find(mode=>mode.id===id)||STARTING_MODES[0]}
function startingModeForCash(cash){return null}
const initialState=()=>({
  version:1,time:START,speed:0,returnSpeed:1,started:false,ended:false,seed:198421,rng:198421,lastReal:Date.now(),
  cash:1500,startingCash:1500,difficulty:"medium",campaignStart:START,debt:0,bill:0,billLedger:{energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0},lastMonth:new Date(START).toISOString().slice(0,7),power:true,policyLock:null,
  wallets:{hot:0,cold:0,mtgox:0,bitfinex:0,quadriga:0,frontier:0,exchange:0,etf:0,frozen:0},
  lightning:{locked:0,earned:0},
  hardware:{laptop:1},facility:"home",region:"na",node:0,nodeStorage:50,nodePruned:false,nodeMode:"archival",nodeSync:{primaryLag:0,primaryPeak:0,backupLag:0,backupPeak:0},backupNode:{enabled:false,outageUntil:0},mode:"solo",pool:"f2pool",
  skills:[],points:0,startingGrant:false,seen:[],activeEvent:null,storyPause:true,shoppingPause:false,speculations:[],powerRateShock:null,hardwareAlerts:{seen:[],queue:[],active:null,resumeSpeed:0},
  treasuryPolicy:"cover",pendingSettlement:null,endReason:null,
  operator:{eras:{},periodMined:0,periodUptime:0,periodDays:0,lastRevenueUsd:0,totalMonths:0,solventMonths:0,profitableMonths:0,competitiveMonths:0,bridgeLoans:0,restructures:0},
  knowledge:0,nextKnowledge:3,learning:null,completedLearning:[],maintenance:{condition:{},faults:{},parts:0,inventory:{fan:0,hashboard:0,powerPcb:0,coolantPump:0,coolingManifold:0},inventoryMigrated:true,orders:[],serviceJobs:[]},procurementOrders:[],inactiveHardware:{},commissioningJobs:[],decommissionedHardware:{},relocationJob:null,ops:{firmwarePatchedUntil:0,hijackUntil:0,outageUntil:0,powerOutageUntil:0,venueFreezes:{},riskMonth:""},strategy:{mstr:0,strk:0,strf:0,strd:0,strc:0,yieldEarned:0},sandbox:false,contract:"standard",staff:[],projectLoan:0,insured:false,milestones:[],donations:[],
  blocks:0,mined:0,nodeDays:0,uptimeDays:0,powerSpent:0,nextMilestone:100,
  connectivity:"fixed",history:[],activity:[],activitySeq:0,log:[{time:START,text:"Client synced to the network tip",amount:"~block "+approxHeight(START)}]
});
let state,loadedHasHardwareAlerts=false,activeTab="dashboard",mobileMenuOpen=false,activityFilter="all",activityLimit=100,tradePercentages={},introDifficulty="hard",pendingTransaction=null,toast=null,toastTimer=null,timer=null,faucet=null,faucetTimer=null,introStep=0,renderQueued=false,renderFullQueued=false,lastRenderAt=0;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const parsed=JSON.parse(raw);loadedHasHardwareAlerts=!!parsed.hardwareAlerts;state=Object.assign(initialState(),parsed)}else state=initialState()}catch(e){state=initialState()}
const ACTIVITY_CATEGORIES=["trade","fleet","finance","reward","custody","learning","operations"];
function activityCategory(text=""){
  if(/bought|sold|treasury policy|ETF exposure|strategy/i.test(text))return"trade";
  if(/miner|hardware|ASIC|fleet|ordered|activated|service|spare parts|firmware|facility migration/i.test(text))return"fleet";
  if(/bill|settlement|finance|debt|receivership|interest|grid service/i.test(text))return"finance";
  if(/reward|payout|routing fees|faucet|mining milestone/i.test(text))return"reward";
  if(/moved BTC|lightning liquidity|node|withdrawal|custody/i.test(text))return"custody";
  if(/learning|completed|reading|subscribed|skill|milestone/i.test(text))return"learning";
  return"operations";
}
function migrateActivity(target){
  const source=Array.isArray(target.activity)&&target.activity.length?target.activity:Array.isArray(target.log)?target.log:[];
  target.activity=source.map((entry,index)=>{const time=Number(entry.time)||START,numberOrNull=value=>value===null||typeof value==="undefined"||value===""?null:Number.isFinite(Number(value))?Number(value):null,price=numberOrNull(entry.price);return{id:Math.max(1,Number(entry.id)||source.length-index),time,text:String(entry.text||"Activity"),amount:String(entry.amount||""),category:ACTIVITY_CATEGORIES.includes(entry.category)?entry.category:activityCategory(entry.text),cash:numberOrNull(entry.cash),btc:numberOrNull(entry.btc),hash:numberOrNull(entry.hash),price:time<MARKET||price===null||price<=0?null:price}}).sort((a,b)=>b.time-a.time||b.id-a.id);
  target.activitySeq=Math.max(Number(target.activitySeq)||0,...target.activity.map(entry=>entry.id),0);target.log=target.activity.slice(0,8);
}
migrateActivity(state);
function asicHardware(){return HARDWARE.filter(h=>h.era==="ASIC"||h.era==="HYDRO ASIC").sort((a,b)=>at(a.date)-at(b.date))}
function migrateHardwareAlerts(target,hadAlerts=true){
  const valid=new Set(asicHardware().map(h=>h.id)),defaults={seen:[],queue:[],active:null,resumeSpeed:0},alerts=Object.assign(defaults,target.hardwareAlerts||{});
  alerts.seen=Array.isArray(alerts.seen)?[...new Set(alerts.seen.filter(id=>valid.has(id)))]:[];alerts.queue=Array.isArray(alerts.queue)?[...new Set(alerts.queue.filter(id=>valid.has(id)))]:[];
  alerts.active=valid.has(alerts.active)?alerts.active:null;alerts.resumeSpeed=Math.max(0,Number(alerts.resumeSpeed)||0);
  if(!hadAlerts)alerts.seen=asicHardware().filter(h=>at(h.date)<=Number(target.time||START)).map(h=>h.id);
  target.hardwareAlerts=alerts;
}
migrateHardwareAlerts(state,loadedHasHardwareAlerts);
const savedStartingMode=STARTING_MODES.some(mode=>mode.id===state.difficulty)?startingMode(state.difficulty):null;
state.difficulty=savedStartingMode?.id||"medium";state.campaignStart=Math.max(START-DAY*5,Number(state.campaignStart)||START);
if(!state.started){introDifficulty=(savedStartingMode||startingMode("medium")).id;const mode=startingMode(introDifficulty);state.cash=1500;state.startingCash=1500;state.time=mode.start;state.campaignStart=mode.start;state.lastMonth=new Date(mode.start).toISOString().slice(0,7);state.difficulty=mode.id}
state.lightning=Object.assign({locked:0,earned:0},state.lightning||{});
state.wallets=Object.assign({hot:0,cold:0,mtgox:0,bitfinex:0,quadriga:0,frontier:0,exchange:0,etf:0,frozen:0},state.wallets||{});
state.speculations=Array.isArray(state.speculations)?state.speculations:[];
state.completedLearning=Array.isArray(state.completedLearning)?state.completedLearning:[];
state.knowledge=Number.isFinite(Number(state.knowledge))?Number(state.knowledge):0;
state.nextKnowledge=Number.isFinite(Number(state.nextKnowledge))?Number(state.nextKnowledge):3;
state.maintenance=Object.assign({condition:{},faults:{},parts:0,inventory:{fan:0,hashboard:0,powerPcb:0,coolantPump:0,coolingManifold:0},inventoryMigrated:false,orders:[],serviceJobs:[]},state.maintenance||{});
state.maintenance.condition=state.maintenance.condition&&typeof state.maintenance.condition==="object"?state.maintenance.condition:{};
state.maintenance.faults=state.maintenance.faults&&typeof state.maintenance.faults==="object"?state.maintenance.faults:{};
state.maintenance.orders=Array.isArray(state.maintenance.orders)?state.maintenance.orders:[];
state.maintenance.serviceJobs=Array.isArray(state.maintenance.serviceJobs)?state.maintenance.serviceJobs.filter(job=>HARDWARE.some(h=>h.id===job.id)&&Number.isFinite(Number(job.due))):[];
state.maintenance.parts=Math.max(0,Number(state.maintenance.parts)||0);
state.maintenance.inventory=Object.assign({fan:0,hashboard:0,powerPcb:0,coolantPump:0,coolingManifold:0},state.maintenance.inventory&&typeof state.maintenance.inventory==="object"?state.maintenance.inventory:{});
SPARE_PARTS.forEach(part=>state.maintenance.inventory[part.id]=Math.max(0,Math.floor(Number(state.maintenance.inventory[part.id])||0)));
if(!state.maintenance.inventoryMigrated){state.maintenance.inventory.fan+=Math.floor(state.maintenance.parts);state.maintenance.parts=0;state.maintenance.inventoryMigrated=true;}
state.procurementOrders=Array.isArray(state.procurementOrders)?state.procurementOrders.filter(o=>HARDWARE.some(h=>h.id===o.id)&&Number(o.qty)>0&&Number.isFinite(Number(o.due))):[];
state.inactiveHardware=state.inactiveHardware&&typeof state.inactiveHardware==="object"?state.inactiveHardware:{};
HARDWARE.forEach(h=>state.inactiveHardware[h.id]=Math.max(0,Math.floor(Number(state.inactiveHardware[h.id])||0)));
state.commissioningJobs=Array.isArray(state.commissioningJobs)?state.commissioningJobs.filter(job=>HARDWARE.some(h=>h.id===job.id)&&Number(job.qty)>0&&Number.isFinite(Number(job.due))):[];
state.decommissionedHardware=state.decommissionedHardware&&typeof state.decommissionedHardware==="object"?state.decommissionedHardware:{};
HARDWARE.forEach(h=>state.decommissionedHardware[h.id]=Math.max(0,Math.floor(Number(state.decommissionedHardware[h.id])||0)));
state.relocationJob=state.relocationJob&&REGIONS.some(r=>r.id===state.relocationJob.id)&&Number.isFinite(Number(state.relocationJob.due))?state.relocationJob:null;
state.ops=Object.assign({firmwarePatchedUntil:0,hijackUntil:0,outageUntil:0,powerOutageUntil:0,venueFreezes:{},riskMonth:""},state.ops||{});
state.ops.venueFreezes=state.ops.venueFreezes&&typeof state.ops.venueFreezes==="object"?state.ops.venueFreezes:{};
state.nodeSync=Object.assign({primaryLag:0,primaryPeak:0,backupLag:0,backupPeak:0},state.nodeSync||{});
["primaryLag","primaryPeak","backupLag","backupPeak"].forEach(k=>state.nodeSync[k]=Math.max(0,Number(state.nodeSync[k])||0));
state.backupNode=Object.assign({enabled:false,outageUntil:0},state.backupNode||{});state.backupNode.enabled=!!state.backupNode.enabled;state.backupNode.outageUntil=Math.max(0,Number(state.backupNode.outageUntil)||0);
state.strategy=Object.assign({mstr:0,strk:0,strf:0,strd:0,strc:0,yieldEarned:0},state.strategy||{});
Object.keys(state.strategy).forEach(k=>{if(!Number.isFinite(Number(state.strategy[k])))state.strategy[k]=0;else state.strategy[k]=Number(state.strategy[k])});
state.nodeStorage=Math.max(50,Number(state.nodeStorage)||50);state.nodePruned=!!state.nodePruned;state.nodeMode=NODE_MODES.some(x=>x.id===state.nodeMode)?state.nodeMode:(state.nodePruned?"pruned":"archival");state.nodePruned=state.nodeMode==="pruned";
state.staff=Array.isArray(state.staff)?state.staff:[];state.contract=POWER_CONTRACTS.some(x=>x.id===state.contract)?state.contract:"standard";state.connectivity=CONNECTIVITY_PLANS.some(x=>x.id===state.connectivity)?state.connectivity:"fixed";state.projectLoan=Math.max(0,Number(state.projectLoan)||0);state.milestones=Array.isArray(state.milestones)?state.milestones:[];
state.billLedger=Object.assign({energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0},state.billLedger||{});Object.keys(state.billLedger).forEach(k=>state.billLedger[k]=Math.max(0,Number(state.billLedger[k])||0));const migratedLedgerTotal=Object.values(state.billLedger).reduce((sum,value)=>sum+value,0);if(state.bill>migratedLedgerTotal+1e-8)state.billLedger.other+=state.bill-migratedLedgerTotal;
state.donations=Array.isArray(state.donations)?state.donations:[];
state.skills=Array.isArray(state.skills)?[...new Set(state.skills.filter(id=>SKILLS.some(s=>s.id===id)))]:[];
state.seen=Array.isArray(state.seen)?state.seen:[];
state.milestones=Array.isArray(state.milestones)?state.milestones:[];
state.startingGrant=!!state.startingGrant;
state.treasuryPolicy=TREASURY_POLICIES.some(x=>x.id===state.treasuryPolicy)?state.treasuryPolicy:"cover";
state.pendingSettlement=state.pendingSettlement&&typeof state.pendingSettlement==="object"?state.pendingSettlement:null;
state.operator=Object.assign({eras:{},periodMined:0,periodUptime:0,periodDays:0,lastRevenueUsd:0,totalMonths:0,solventMonths:0,profitableMonths:0,competitiveMonths:0,bridgeLoans:0,restructures:0},state.operator||{});
state.operator.eras=state.operator.eras&&typeof state.operator.eras==="object"?state.operator.eras:{};
["periodMined","periodUptime","periodDays","lastRevenueUsd","totalMonths","solventMonths","profitableMonths","competitiveMonths","bridgeLoans","restructures"].forEach(k=>state.operator[k]=Math.max(0,Number(state.operator[k])||0));
OPERATOR_ERAS.forEach(era=>{state.operator.eras[era.id]=Object.assign({months:0,solvent:0,profitable:0,uptime:0,competitive:0},state.operator.eras[era.id]||{});["months","solvent","profitable","uptime","competitive"].forEach(k=>state.operator.eras[era.id][k]=Math.max(0,Number(state.operator.eras[era.id][k])||0))});
HARDWARE.forEach(h=>{if(!Number.isFinite(Number(state.maintenance.condition[h.id])))state.maintenance.condition[h.id]=100;else state.maintenance.condition[h.id]=Math.max(0,Math.min(100,Number(state.maintenance.condition[h.id])));state.maintenance.faults[h.id]=Math.max(0,Math.min(state.hardware?.[h.id]||0,Math.floor(Number(state.maintenance.faults[h.id])||0)))})
const numericDefaults={cash:1500,debt:0,bill:0,points:0,rng:123456789};
Object.keys(numericDefaults).forEach(k=>{if(!Number.isFinite(Number(state[k])))state[k]=numericDefaults[k];else state[k]=Number(state[k])});
if(state.shoppingPause){state.shoppingPause=false;if(state.started&&state.speed<=0&&!state.activeEvent&&!state.ended)state.speed=Number(state.returnSpeed)||1}
state.hardware=state.hardware&&typeof state.hardware==="object"?state.hardware:{};
HARDWARE.forEach(h=>{if(!Number.isFinite(Number(state.hardware[h.id])))state.hardware[h.id]=h.permanent?1:0;else state.hardware[h.id]=Math.max(h.permanent?1:0,Math.floor(Number(state.hardware[h.id])))});
function hasSkill(id){return state.skills.includes(id)}
function fieldTechnicianCount(s=state){return (s.staff||[]).filter(id=>id==="fieldtech").length}
function activeServiceJob(id,s=state){return (s.maintenance?.serviceJobs||[]).find(job=>job.id===id)}
function region(){return REGIONS.find(x=>x.id===state.region)||REGIONS[0]}
function facility(){return FACILITIES.find(x=>x.id===state.facility)||FACILITIES[0]}
function facilityTier(s=state){const tier=FACILITIES.findIndex(x=>x.id===s.facility);return tier<0?1:tier+1}
function connectivityPlan(s=state){return CONNECTIVITY_PLANS.find(x=>x.id===s.connectivity)||CONNECTIVITY_PLANS[0]}
function connectivityScale(s=state){return[1,1.5,4,15,55,150,300,600][Math.max(0,facilityTier(s)-1)]||1}
function internetMonthlyCost(s=state){const r=REGIONS.find(x=>x.id===s.region)||REGIONS[0];return(r.internet||75)*connectivityPlan(s).mult*connectivityScale(s)}
function connectivityMiningFactor(s=state){return connectivityPlan(s).payout||1}
function connectivityIncidentRisk(s=state){const r=REGIONS.find(x=>x.id===s.region)||REGIONS[0];return(r.netRisk||.02)*(connectivityPlan(s).risk||1)*(s.skills?.includes("monitoring")?.75:1)}
function skillGateReason(skill){if(skill.req&&!hasSkill(skill.req))return`Requires ${SKILLS.find(x=>x.id===skill.req)?.name||skill.req}`;if(skill.date&&state.time<at(skill.date))return`Unlocks ${dateFmt(at(skill.date),true)}`;if(skill.minFacility&&facilityTier()<skill.minFacility)return`Requires ${FACILITIES[skill.minFacility-1]?.name||`tier ${skill.minFacility} facility`}`;return""}
function staffHiringAvailable(s=state){return facilityTier(s)>=3}
function maintenanceCondition(h,s=state){const value=Number(s.maintenance?.condition?.[h.id]);return Number.isFinite(value)?Math.max(0,Math.min(100,value)):100}
function hardwareFaultCount(h,s=state){return Math.max(0,Math.min(s.hardware?.[h.id]||0,Math.floor(Number(s.maintenance?.faults?.[h.id])||0)))}
function hardwareLaunchFactor(h,t=state.time){if(!h.edge||t<at(h.date))return 1;const age=(t-at(h.date))/DAY;if(age<=365)return h.edge;if(age>=730)return 1;return 1+(h.edge-1)*(730-age)/365}
function hardwareOfflineReason(h,s=state){
  const condition=maintenanceCondition(h,s);
  if(h.requires&&!s.skills.includes(h.requires))return `Requires ${SKILLS.find(x=>x.id===h.requires)?.name||h.requires}`;
  if(h.minFacility&&FACILITIES.findIndex(x=>x.id===s.facility)<FACILITIES.findIndex(x=>x.id===h.minFacility))return `Requires ${FACILITIES.find(x=>x.id===h.minFacility)?.name||h.minFacility}`;
  if(condition<65)return "Maintenance required";
  return "";
}
function fitsInstalledFleet(s){const fs=fleet(s),f=FACILITIES.find(x=>x.id===s.facility)||FACILITIES[0];return fs.potentialKw<=fs.cap&&fs.space<=f.space}
function fleet(s=state){
  let hash=0,w=0,space=0,value=0,count=0,potentialW=0,offline=[];
  HARDWARE.forEach(h=>{const n=s.hardware[h.id]||0,reason=hardwareOfflineReason(h,s),servicing=activeServiceJob(h.id,s)?.count||0,faults=hardwareFaultCount(h,s),unavailable=Math.min(n,Math.max(servicing,faults));space+=h.space*n;value+=h.cost*n;count+=n;potentialW+=h.w*n;if(n&&reason){offline.push({h,n,reason});return}if(unavailable)offline.push({h,n:unavailable,reason:servicing?"Repair in progress":"Unexpected hardware fault"});const active=Math.max(0,n-unavailable),effectiveHash=h.hash*hardwareLaunchFactor(h,s.time);hash+=effectiveHash*active;w+=h.w*active;if(s.skills.includes("asictune")&&(h.era==="ASIC"||h.era==="HYDRO ASIC"))hash+=effectiveHash*active*.05});
  if(s.skills.includes("firmware"))hash*=1.04;if(s.skills.includes("undervolt"))w*=.95;
  const f=FACILITIES.find(x=>x.id===s.facility)||FACILITIES[0],cap=f.kw*(s.skills.includes("capacity")?1.1:1);
  const expandedCap=cap*(s.skills.includes("substation")?1.1:1);
  return{hash,w,kw:w/1000,space,value,count,cap:expandedCap,potentialKw:potentialW/1000,offline,offlineCount:offline.reduce((a,x)=>a+x.n,0),within:w/1000<=expandedCap&&space<=f.space};
}
function controlled(){return state.wallets.hot+state.wallets.cold}
function treasuryPolicy(){return TREASURY_POLICIES.find(x=>x.id===state.treasuryPolicy)||TREASURY_POLICIES[0]}
function operatorEraAt(t=state.time){return OPERATOR_ERAS.find(era=>t>=era.start&&t<era.end)||OPERATOR_ERAS[OPERATOR_ERAS.length-1]}
function operatorEraStats(era=operatorEraAt()){return state.operator.eras[era.id]}
function operatorEraScore(stats){if(!stats||stats.months<=0)return 0;return Math.round(35*stats.solvent/stats.months+30*stats.profitable/stats.months+20*stats.uptime/stats.months+15*stats.competitive/stats.months)}
function operatorScoreBreakdown(){
  const eraPoints=OPERATOR_ERAS.reduce((sum,era)=>sum+operatorEraScore(operatorEraStats(era)),0),performance=eraPoints/600*800;
  const milestones=Math.min(80,(state.milestones?.length||0)/4*80),allBtc=totalBtc()+lightningLocked(),custody=allBtc>0?Math.min(40,controlled()/allBtc*40):0,monthly=monthlyCost().total,runway=monthly>0?state.cash/monthly:6,balance=(state.debt||state.projectLoan>Math.max(state.cash,state.operator.lastRevenueUsd*6))?0:Math.min(40,runway/6*40),resilience=Math.max(0,40-state.operator.restructures*20-state.operator.bridgeLoans*5),total=Math.max(0,Math.min(1000,Math.round(performance+milestones+custody+balance+resilience)));
  return{total,performance:Math.round(performance),milestones:Math.round(milestones),custody:Math.round(custody),balance:Math.round(balance),resilience:Math.round(resilience),eraPoints};
}
function operatorGrade(score=operatorScoreBreakdown().total){return score>=900?"Legendary":score>=750?"Elite":score>=600?"Durable":score>=450?"Solvent":score>=300?"Survivor":"At risk"}
function lightningLocked(){return state.lightning?.locked||0}
function connectivityOutage(){return state.time<(state.ops?.outageUntil||0)}
function powerOutage(){return state.time<(state.ops?.powerOutageUntil||0)}
function siteOutage(){return connectivityOutage()||powerOutage()}
function activeSiteIncident(){if(powerOutage())return{kind:"Grid outage",until:state.ops.powerOutageUntil};if(connectivityOutage())return{kind:"Internet outage",until:state.ops.outageUntil};return null}
function relocating(){return !!state.relocationJob&&state.time<state.relocationJob.due}
function nodeProfile(){return NODE_MODES.find(x=>x.id===state.nodeMode)||NODE_MODES[1]}
function nodeDeploymentName(){return state.node===2?"Hardened node":state.node===1?"Dedicated full node":"Laptop full node"}
function nodeModeWatts(profile=nodeProfile()){if(state.node===0)return 0;if(state.node===2)return profile.id==="relay"?profile.watts:profile.id==="archival"?80:35;return profile.watts}
function nodeModeMonthly(profile=nodeProfile()){if(state.node===0)return 0;if(state.node===2&&profile.id!=="relay")return profile.monthly*2;return profile.monthly}
function nodeModeConnections(profile=nodeProfile()){if(state.node===0)return profile.id==="pruned"?8:12;if(state.node===2&&profile.id!=="relay")return profile.connections*2;return profile.connections}
function nodePowerWatts(){return nodeModeWatts()}
function nodeMonthlyOverhead(){return nodeModeMonthly()}
function backupNodeMonthlyOverhead(){return state.backupNode?.enabled?BACKUP_NODE.monthly:0}
function totalNodeMonthlyOverhead(){return nodeMonthlyOverhead()+backupNodeMonthlyOverhead()}
function nodeConnections(){return nodeModeConnections()}
function nodeHostPowered(){if(state.debt>0||state.policyLock)return false;if(state.node>=1)return true;const laptop=HARDWARE.find(x=>x.id==="laptop");return !!state.power&&!!laptop&&!hardwareOfflineReason(laptop)}
function nodeStorageReady(){const p=nodeProfile();return p.id==="pruned"?state.nodeStorage>=25:state.nodeStorage>=chainSizeAt(state.time)}
function primaryNodeReady(){return nodeHostPowered()&&!siteOutage()&&nodeStorageReady()}
function backupNodeOutage(){return state.time<(state.backupNode?.outageUntil||0)}
function backupNodeReady(){return !!state.backupNode?.enabled&&state.debt<=0&&!backupNodeOutage()}
function primaryNodeOnline(){return primaryNodeReady()&&(state.nodeSync?.primaryLag||0)<=0}
function backupNodeOnline(){return backupNodeReady()&&(state.nodeSync?.backupLag||0)<=0}
function nodeOnline(){return primaryNodeOnline()||backupNodeOnline()}
function primaryNodeOfflineReason(){if(state.debt>0)return"grid arrears";if(state.policyLock)return"site policy shutdown";if(siteOutage())return"site connectivity outage";if(state.node===0&&!state.power)return"mining laptop powered off";if(state.node===0&&hardwareOfflineReason(HARDWARE.find(x=>x.id==="laptop")))return"laptop hardware unavailable";if(!nodeStorageReady())return"storage below chain requirement";if((state.nodeSync?.primaryLag||0)>0)return`catching up · ${fmtNum(state.nodeSync.primaryLag)} days behind`;return"primary node offline"}
function backupNodeOfflineReason(){if(!state.backupNode?.enabled)return"not deployed";if(state.debt>0)return"hosting account in arrears";if(backupNodeOutage())return"remote provider outage";if((state.nodeSync?.backupLag||0)>0)return`catching up · ${fmtNum(state.nodeSync.backupLag)} days behind`;return"backup node offline"}
function nodeOfflineReason(){if(primaryNodeReady()&&(state.nodeSync?.primaryLag||0)>0)return primaryNodeOfflineReason();if(backupNodeReady()&&(state.nodeSync?.backupLag||0)>0)return backupNodeOfflineReason();return state.backupNode?.enabled?`primary: ${primaryNodeOfflineReason()} · backup: ${backupNodeOfflineReason()}`:primaryNodeOfflineReason()}
function nodeVerificationPath(){if(primaryNodeOnline()&&backupNodeOnline())return"two independent nodes at tip";if(primaryNodeOnline())return"primary node at tip";if(backupNodeOnline())return"remote backup carrying verification";return nodeOfflineReason()}
function primaryNodeCatchupRate(){return state.node===2?6:state.node===1?3:1.5}
function nodeSyncProgress(lag,peak){return peak>0?Math.max(0,Math.min(100,(1-lag/peak)*100)):lag<=0?100:0}
function initialBackupSyncLag(){return Math.max(5,Math.ceil(chainSizeAt(state.time)/40))}
function nodeVerificationCoverage(){const elapsed=Math.max(1,Math.floor((state.time-START)/DAY));return Math.max(0,Math.min(1,(state.nodeDays||0)/elapsed))}
function nodeMiningFactor(){return !nodeOnline()?0.97:!primaryNodeOnline()?0.99:state.nodeMode==="relay"?1.015:state.nodeMode==="pruned"?0.99:1}
function blockRewardAt(t){const localTemplates=hasSkill("blocktemplate")&&primaryNodeOnline()&&state.nodeMode!=="pruned",feeMultiplier=(localTemplates?1.08:1)*(state.nodeMode==="relay"&&primaryNodeOnline()?1.03:1);return subsidyAt(t)+feeAt(t)*feeMultiplier}
function lightningAvailable(){return state.time>=LIGHTNING&&state.node>=1&&primaryNodeOnline()&&state.nodeMode!=="pruned"}
function poolEligible(p=poolData()){return !!p&&(!p.requires||hasSkill(p.requires))}
function lightningRate(){const activity=Math.max(.25,Math.min(3,txAt(state.time)/250000));return .00003*activity}
function lightningDailyFee(){return lightningAvailable()?lightningLocked()*lightningRate()*(hasSkill("monitoring")?1.08:1)*(state.nodeMode==="relay"?1.2:1):0}
function claims(){return state.wallets.mtgox+state.wallets.bitfinex+state.wallets.quadriga+state.wallets.frontier+state.wallets.exchange+state.wallets.frozen}
function totalBtc(){return controlled()+claims()}
function marketLiquidBtc(){return state.wallets.hot+["mtgox","bitfinex","quadriga","frontier","exchange"].reduce((sum,id)=>sum+(venueAvailable(id)&&!venueFrozen(id)?state.wallets[id]:0),0)}
function equityValue(){return STRATEGY_SECURITIES.reduce((sum,s)=>sum+strategyValue(s.id),0)}
function netWorth(){return state.cash-state.debt+(state.time>=MARKET?totalBtc()+state.wallets.etf+lightningLocked():0)*priceAt(state.time)+equityValue()+fleet().value*.3}
function nextRand(){state.rng=(state.rng*1664525+1013904223)>>>0;return state.rng/4294967296}
function poisson(lambda){
  if(lambda<=0)return 0;if(lambda>30)return Math.max(0,Math.round(lambda+Math.sqrt(lambda)*(nextRand()+nextRand()+nextRand()+nextRand()+nextRand()+nextRand()-3)*1.4));
  const l=Math.exp(-lambda);let k=0,p=1;do{k++;p*=nextRand()}while(p>l);return k-1;
}
function log(text,amount="",category=""){
  const entry={id:++state.activitySeq,time:state.time,text,amount,category:category||activityCategory(text),cash:Number(state.cash)||0,btc:controlled(),hash:fleet().hash,price:state.time>=MARKET?priceAt(state.time):null};
  state.activity.unshift(entry);state.log=state.activity.slice(0,8);
}
function showToast(title,message){toast={title,message};const markup=`<div class="toast"><div><b>${title}</b><span>${message}</span></div></div>`,existing=document.querySelector(".toast"),host=document.getElementById("app");if(existing)existing.outerHTML=markup;else if(host&&state.started)host.insertAdjacentHTML("beforeend",markup);clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast=null;document.querySelector(".toast")?.remove()},8500)}
function availablePool(){return state.time>=at("2010-12-16")}
function poolData(id=state.pool){return POOLS.find(x=>x.id===id)||POOLS.find(x=>x.id==="f2pool")}
function poolShareAt(id,t){const p=poolData(id);if(!p||id==="solo")return id==="solo"?0:0;const a=p.anchors.map(([d,v])=>[at(d),v]).sort((x,y)=>x[0]-y[0]);if(t<a[0][0])return 0;for(let i=0;i<a.length-1;i++){const [t0,v0]=a[i],[t1,v1]=a[i+1];if(t>=t0&&t<=t1){const f=(t-t0)/(t1-t0);return v0+(v1-v0)*f}}return a[a.length-1][1]}
function activePoolShare(){return state.mode==="pool"?poolShareAt(state.pool,state.time):0}
function poolFee(){const p=poolData();return Math.max(.005,(p?.fee||.02)-(hasSkill("poolops")?.004:0))}
function operating(){const fs=fleet();return state.power&&state.debt<=0&&!state.policyLock&&!siteOutage()&&!relocating()&&fs.within}
function asicCount(){return HARDWARE.filter(h=>h.era==="ASIC"||h.era==="HYDRO ASIC").reduce((n,h)=>n+(state.hardware[h.id]||0),0)}
function firmwarePatchDue(){return asicCount()>0&&state.time>=at("2017-04-26")&&state.time>(state.ops?.firmwarePatchedUntil||0)}
function firmwareHijacked(){return state.time<(state.ops?.hijackUntil||0)}
function venueFrozen(id){return state.time<(state.ops?.venueFreezes?.[id]||0)}
function rateMultiplier(){return state.powerRateShock&&state.time<state.powerRateShock.until?state.powerRateShock.multiplier:1}
const ANNOUNCE_WINDOW=DAY*120;
function announced(item,t=state.time){return !item?.date||at(item.date)<=t+ANNOUNCE_WINDOW}
function contractLoadFactor(){return state.contract==="curtail"?.78:1}
function contractUptimeFactor(){return state.contract==="curtail"?.78:state.contract==="spot"&&energyShock(state.time)>1?.9:1}
function energyLoadFactor(){const fs=fleet(),load=fs.cap?fs.kw/fs.cap:0;return 1+Math.pow(Math.max(0,load-.55),2)*1.8}
function energyEfficiencyFactor(){return (hasSkill("metering")?.96:1)*(hasSkill("curtailment")?.96:1)}
function powerContract(){return POWER_CONTRACTS.find(x=>x.id===state.contract)||POWER_CONTRACTS[0]}
function powerRate(r,t=state.time){const c=powerContract(),shock=c.id==="fixed"?1:energyShock(t);return r.kwh*c.mult*shock*energyEfficiencyFactor()*rateMultiplier()*energyLoadFactor()}
function dailyEnergyCostForWatts(watts,t=state.time,r=region()){return Math.max(0,watts)/1000*24*powerRate(r,t)*(hasSkill("heat")?.96:1)}
function hasStaff(id){return state.staff.includes(id)}
function hardwareUnitCost(h){return h.cost*(hasSkill("procurement")?.94:1)*(hasStaff("procurementlead")?.95:1)}
function staffMonthlyCost(){return state.staff.reduce((sum,id)=>sum+(STAFF.find(x=>x.id===id)?.salary||0),0)}
function insuranceMonthlyCost(){return state.insured?fleet().value*.0015:0}
function facilityMoveRisk(id){
  const current=Math.max(0,FACILITIES.findIndex(x=>x.id===state.facility)),target=Math.max(0,FACILITIES.findIndex(x=>x.id===id));
  return target<=current?0:Math.min(.48,.05+(target-current)*.075+target*.025);
}
function facilityRiskLabel(risk){return risk<.12?"Low move risk":risk<.25?"Moderate move risk":"High move risk"}
function learningItem(){return state.learning?LEARNING.find(x=>x.id===state.learning.id):null}
function awardLearning(item,multiplier=1){
  const gain=item.reward*multiplier;state.knowledge+=gain;state.completedLearning.push(item.id);state.learning=null;
  while(state.knowledge>=state.nextKnowledge){state.points++;state.nextKnowledge+=3;log("Learning milestone","+1 skill point")}
  log(`Completed ${item.title}`,`+${gain.toFixed(gain%1?1:0)} knowledge`);showToast("Learning complete",`${item.title} added ${gain.toFixed(gain%1?1:0)} knowledge.`);renderFullQueued=true;
}
function advanceLearning(){
  const item=learningItem();if(!item||state.learning.waiting)return;
  state.learning.progress=(state.learning.progress||0)+1;
  if(state.learning.progress>=item.days){if(item.check){state.learning.waiting=true;renderFullQueued=true;showToast("Knowledge check",`Finish ${item.title} in the Learn tab.`)}else awardLearning(item)}
}
function covidPartsMarket(){return state.time>=at("2020-03-12")&&state.time<at("2021-07-01")}
function sparePart(id){return SPARE_PARTS.find(part=>part.id===id)}
function serviceRequirements(h,count){
  const units=divisor=>Math.max(1,Math.ceil(count/divisor));
  if(h.era==="HYDRO ASIC")return {hashboard:units(10),powerPcb:units(20),coolantPump:units(24),coolingManifold:units(16)};
  if(h.era==="ASIC")return {fan:units(12),hashboard:units(10),powerPcb:units(20)};
  if(h.era==="FPGA")return {fan:units(12),powerPcb:units(18)};
  if(h.era==="GPU")return {fan:units(8),powerPcb:units(15)};
  return {fan:units(10)};
}
function serviceRequirementText(requirements){return Object.entries(requirements).map(([id,qty])=>`${qty} ${sparePart(id)?.name||id}${qty===1?"":"s"}`).join(" · ")}
function hasServiceParts(requirements){return Object.entries(requirements).every(([id,qty])=>(state.maintenance.inventory[id]||0)>=qty)}
function servicePlan(h,count){const technicians=fieldTechnicianCount(),committed=(state.maintenance.serviceJobs||[]).reduce((sum,job)=>sum+Number(job.crew||0),0),available=Math.max(0,technicians-committed),crew=technicians===0?1:Math.min(3,available),complexity=h.era==="HYDRO ASIC"?2.2:h.era==="ASIC"?1.5:h.era==="GPU"?1.2:1,workDays=Math.max(1,Math.ceil(count*complexity/20)),days=crew?Math.max(1,Math.ceil(workDays/crew)):Infinity;return{technicians,committed,available,crew,workDays,days,contracted:technicians===0}}
function advanceMaintenance(){
  state.maintenance.orders=state.maintenance.orders.filter(order=>{if(order.due>state.time)return true;const part=sparePart(order.type)||sparePart("fan");state.maintenance.inventory[part.id]=(state.maintenance.inventory[part.id]||0)+order.qty;log("Spare parts delivered",`+${order.qty} ${part.name}${order.qty===1?"":"s"}`);return false});
  state.maintenance.serviceJobs=state.maintenance.serviceJobs.filter(job=>{if(job.due>state.time)return true;const h=HARDWARE.find(x=>x.id===job.id),repaired=Math.max(1,Number(job.count)||0);state.maintenance.faults[job.id]=Math.max(0,hardwareFaultCount(h)-repaired);state.maintenance.condition[job.id]=Math.min(100,maintenanceCondition(h)+Math.max(18,60*repaired/Math.max(1,state.hardware[job.id]||1)));log(`Service completed: ${h?.name||job.id}`,`${repaired} unit${repaired===1?"":"s"} repaired · ${job.crew}-technician crew`);showToast("Service completed",`${repaired} × ${h?.name||"miner"} returned to service.`);return false});
  const fs=fleet();fs.offline.forEach(()=>{});
  const technicians=fieldTechnicianCount(),wearFactor=technicians?Math.max(.35,.6-.08*Math.min(2,technicians-1)-.02*Math.max(0,technicians-3)):1;
  HARDWARE.forEach(h=>{const n=state.hardware[h.id]||0;if(!n||hardwareOfflineReason(h)!=="")return;const age=Math.max(0,(state.time-at(h.date))/DAY/365),wear=((h.era==="HYDRO ASIC"?.035:.018)+Math.min(.04,age*.002))*wearFactor,condition=maintenanceCondition(h),active=Math.max(0,n-hardwareFaultCount(h)-Number(activeServiceJob(h.id)?.count||0));state.maintenance.condition[h.id]=Math.max(0,condition-wear);if(!active)return;const base=h.era==="HYDRO ASIC"?.0015:h.era==="ASIC"?.0009:h.era==="GPU"?.00065:.00035,stress=1+(100-condition)/55+age*.12,failures=Math.min(active,poisson(active*base*stress*(technicians?0.72:1)));if(failures){state.maintenance.faults[h.id]=hardwareFaultCount(h)+failures;log(`${h.name} fault detected`,`${failures} unit${failures===1?"":"s"} offline · repair parts required`,`fleet`);showToast("Fleet fault",`${failures} × ${h.name} went offline. Schedule a repair in Operations.`);renderFullQueued=true}});
}
function orderParts(type,qty=1){
  const part=sparePart(type);if(!part)return;qty=Math.max(1,Math.floor(Number(qty)||1));const covid=covidPartsMarket(),unit=part.cost*(covid?2.25:1),cost=qty*unit,lead=covid?42:14;
  if(state.cash<cost)return showToast("Not enough cash",`${qty} ${part.name}${qty===1?"":"s"} cost ${fmtUsd(cost)}.`);
  state.cash-=cost;state.maintenance.orders.push({type:part.id,qty,due:state.time+lead*DAY});log("Spare parts ordered",`${qty} ${part.name}${qty===1?"":"s"} · -${fmtUsd(cost)} · ${lead} days`);save();render();
}
function serviceHardware(id){
  const h=HARDWARE.find(x=>x.id===id),count=state.hardware[id]||0;if(!h||!count)return;
  if(activeServiceJob(id))return showToast("Service already scheduled",`${h.name} is already in the maintenance bay.`);
  const condition=maintenanceCondition(h),faults=hardwareFaultCount(h);if(condition>=95&&!faults)return showToast("Service not needed",`${h.name} is at ${condition.toFixed(0)}% condition with no failed units.`);
  const repairCount=condition<65?count:Math.max(faults,Math.ceil(count*.15)),requirements=serviceRequirements(h,repairCount),plan=servicePlan(h,repairCount),labor=Math.max(40,h.cost*.008*repairCount)*(plan.contracted?1.35:1);
  if(!plan.crew)return showToast("Technician crew busy",`${plan.committed} technician${plan.committed===1?" is":"s are"} assigned to active repairs. Hire another field technician or wait for a service job to complete.`);
  if(!hasServiceParts(requirements))return showToast("Parts required",`Service needs ${serviceRequirementText(requirements)}; order the missing components first.`);
  if(state.cash<labor)return showToast("Not enough cash",`Service labour costs ${fmtUsd(labor)}.`);
  state.cash-=labor;Object.entries(requirements).forEach(([part,qty])=>state.maintenance.inventory[part]-=qty);state.maintenance.serviceJobs.push({id,count:repairCount,due:state.time+plan.days*DAY,crew:plan.crew});log(`Service started: ${h.name}`,`${repairCount} units · ${plan.days} days · ${fmtUsd(labor)}`);showToast("Service scheduled",`${repairCount} × ${h.name} is offline for ${plan.days} simulation day${plan.days===1?"":"s"}. ${plan.contracted?"An external technician is covering the job.":`${plan.crew} of ${plan.technicians} technicians assigned.`}`);save();render();
}
function patchFirmware(){
  const count=asicCount(),cost=Math.max(75,count*18);if(!count)return showToast("No ASIC fleet","Firmware patching applies to ASIC and hydro ASIC hardware.");
  if(state.cash<cost)return showToast("Not enough cash",`Signed firmware rollout costs ${fmtUsd(cost)}.`);
  state.cash-=cost;state.ops.firmwarePatchedUntil=state.time+DAY*540;state.ops.hijackUntil=0;
  log("ASIC firmware patched",`${count} machines · protected for 18 months`);showToast("Fleet patched","Signed firmware is current for 18 simulation months.");save();render();
}
function advanceNodeSync(silent=false){
  const syncPath=(lagKey,peakKey,ready,rate,label)=>{const before=state.nodeSync[lagKey];if(ready){state.nodeSync[lagKey]=Math.max(0,before-rate);if(before>0&&state.nodeSync[lagKey]===0){state.nodeSync[peakKey]=0;log(`${label} caught up`,`Verification resumed at the chain tip`);if(!silent)showToast("Node synchronized",`${label} has validated its backlog and reached the chain tip.`)}}else{state.nodeSync[lagKey]=Math.min(365,state.nodeSync[lagKey]+1);state.nodeSync[peakKey]=Math.max(state.nodeSync[peakKey],state.nodeSync[lagKey])}};
  syncPath("primaryLag","primaryPeak",primaryNodeReady(),primaryNodeCatchupRate(),"Primary full node");
  if(state.backupNode.enabled)syncPath("backupLag","backupPeak",backupNodeReady(),4,"Geographic backup node");
}
function advanceOperationalRisks(next){
  if(state.ops.outageUntil&&next>=state.ops.outageUntil){state.ops.outageUntil=0;log("Connectivity restored",`${region().name} upstream service resumed`,`operations`);showToast("Internet restored",`${connectivityPlan().name} service is back. Mining and primary-node connectivity can resume.`)}
  if(state.ops.powerOutageUntil&&next>=state.ops.powerOutageUntil){state.ops.powerOutageUntil=0;log("Grid power restored",`${region().name} site energized`,`operations`);showToast("Grid restored",`Power is back at ${facility().name}. The fleet can resume hashing.`)}
  const month=new Date(next).toISOString().slice(0,7);if(state.ops.riskMonth===month)return;state.ops.riskMonth=month;
  if(firmwarePatchDue()&&!firmwareHijacked()&&nextRand()<.07){state.ops.hijackUntil=next+DAY*(10+Math.floor(nextRand()*21));log("ASIC fleet hijacked","35% of hash diverted");showToast("Firmware compromise","Unpatched ASIC firmware is pointing part of your hashrate to an attacker. Patch it now.");}
  const r=region(),outageRisk=connectivityIncidentRisk(),gridRisk=Math.min(.28,Math.max(.004,(1-r.rely)*1.15));
  if(!siteOutage()&&(operating()||nodeHostPowered())&&nextRand()<gridRisk){const days=1+Math.floor(nextRand()*(2+gridRisk*45));state.ops.powerOutageUntil=next+DAY*days;log(`${r.name} grid outage`,`${days} days without power`,`operations`);showToast("Grid outage",`${r.name}'s grid is unavailable at ${facility().name}. Mining, cooling and primary-node services pause for ${days} days.`);}
  else if(!siteOutage()&&(operating()||nodeHostPowered())&&nextRand()<outageRisk){const days=1+Math.floor(nextRand()*(3+outageRisk*90));state.ops.outageUntil=next+DAY*days;log(`${r.name} connectivity outage`,`${days} days offline`,`operations`);showToast("Internet outage",`${connectivityPlan().name} has lost upstream service in ${r.name}. Mining and primary-node services pause for ${days} days.`);}
  if(state.backupNode.enabled&&!backupNodeOutage()&&nextRand()<.006){const days=1+Math.floor(nextRand()*3);state.backupNode.outageUntil=next+DAY*days;log("Remote node provider outage",`${days} days offline`);showToast("Backup-node outage",`The remote node site is unavailable for ${days} simulation day${days===1?"":"s"}. The primary node is unaffected.`);}
  [["bitfinex",.022],["quadriga",.065],["frontier",.04],["exchange",.007]].forEach(([id,risk])=>{if(state.wallets[id]>0&&!venueFrozen(id)&&nextRand()<risk){const days=7+Math.floor(nextRand()*24);state.ops.venueFreezes[id]=next+DAY*days;log(`${walletName(id)} withdrawals frozen`,`${days} days`);showToast("Withdrawal freeze",`${walletName(id)} has paused withdrawals. Move funds only when service resumes.`);}});
}
function monthlyCost(){
  const fs=fleet(),r=region(),f=facility(),nodeW=nodePowerWatts();
  const rate=powerRate(r,state.time);
  const projectedWatts=fs.w*contractLoadFactor()+(state.node>=1?nodeW:0),energy=dailyEnergyCostForWatts(projectedWatts,state.time,r)*30.4375;
  const staff=staffMonthlyCost(),insurance=insuranceMonthlyCost(),internet=internetMonthlyCost(),nodeNetwork=totalNodeMonthlyOverhead();return{energy,rent:f.rent,staff,insurance,internet,nodeNetwork,total:energy+f.rent+staff+insurance+internet+nodeNetwork,rate};
}
function advanceFleetLifecycle(){
  state.commissioningJobs=state.commissioningJobs.filter(job=>{if(job.due>state.time)return true;const h=HARDWARE.find(item=>item.id===job.id);state.hardware[job.id]=(state.hardware[job.id]||0)+job.qty;log(`Commissioned ${job.qty} × ${h?.name||job.id}`,"Racked, configured and hashing","fleet");showToast("Commissioning complete",`${job.qty} × ${h?.name||"miner"} is now connected to the fleet.`);renderFullQueued=true;return false});
  const job=state.relocationJob;if(job&&job.due<=state.time){const destination=REGIONS.find(r=>r.id===job.id);state.region=job.id;state.relocationJob=null;state.policyLock=null;state.power=state.debt<=0;log(`Fleet arrived in ${destination?.name||job.id}`,"Site commissioning complete","operations");showToast("Relocation complete",`The fleet is live at ${destination?.name||job.id}.`);renderFullQueued=true}
}
function blankBillLedger(){return{energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0}}
function accruedBillBreakdown(){const result=Object.assign(blankBillLedger(),state.billLedger||{}),accounted=Object.values(result).reduce((sum,value)=>sum+value,0);if(state.bill>accounted+1e-8)result.other+=state.bill-accounted;return result}
function nextSettlementDate(offset=0){const date=new Date(state.time);return Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1+offset,1)}
function settlementForecast(){
  const fs=fleet(),r=region(),f=facility(),nodeW=nodePowerWatts();
  const rate=powerRate(r,state.time);
  const minerWatts=state.power&&state.debt<=0&&!state.policyLock?fs.w*contractLoadFactor():0,nodeWatts=nodeHostPowered()?nodeW:0,energyDaily=dailyEnergyCostForWatts(minerWatts+nodeWatts,state.time,r),daily={energy:energyDaily,rent:f.rent/30.4375,internet:internetMonthlyCost()/30.4375,staff:staffMonthlyCost()/30.4375,insurance:insuranceMonthlyCost()/30.4375,nodeNetwork:totalNodeMonthlyOverhead()/30.4375,other:0};
  let cursor=new Date(state.time),days=0,month=cursor.getUTCMonth();do{cursor=new Date(cursor.getTime()+DAY);days++}while(cursor.getUTCMonth()===month);
  const accrued=accruedBillBreakdown(),breakdown={};Object.keys(accrued).forEach(key=>breakdown[key]=accrued[key]+(daily[key]||0)*days);breakdown.finance=state.projectLoan*(hasStaff("treasurer")?.009:.012);const estimated=Object.values(breakdown).reduce((sum,value)=>sum+value,0),cashAfter=state.cash-estimated,coverage=estimated?Math.max(0,Math.min(100,state.cash/estimated*100)):100;
  return{days,dueAt:nextSettlementDate(),daily,accrued,breakdown,estimated,cashAfter,coverage,remaining:Math.max(0,estimated-state.bill)};
}
function settlementSnapshot(due,month){
  const days=Math.max(1,state.operator.periodDays||1),uptime=state.operator.periodUptime/days,marketOpen=state.time>=MARKET,revenueUsd=marketOpen?state.operator.periodMined*priceAt(state.time):0,expectedGross=marketOpen?expectedDailyBtcForHash(fleet().hash)*priceAt(state.time)*days:0,competitive=operating()&&(marketOpen?expectedGross>=due*.75:playerNetworkShareAt(state.time,fleet().hash)>=.0001);
  return{due,month,era:operatorEraAt(Math.max(START,state.time-DAY)).id,mined:state.operator.periodMined,revenueUsd,days,uptime,profitable:marketOpen?uptime>=.25&&revenueUsd>0&&revenueUsd>=due:uptime>=.65,competitive};
}
function recordOperatorMonth(snapshot,solvent){
  if(!snapshot)return;const stats=state.operator.eras[snapshot.era]||operatorEraStats();stats.months++;if(solvent)stats.solvent++;if(snapshot.profitable)stats.profitable++;if(snapshot.uptime>=.75)stats.uptime++;if(snapshot.competitive)stats.competitive++;
  state.operator.totalMonths++;if(solvent)state.operator.solventMonths++;if(snapshot.profitable)state.operator.profitableMonths++;if(snapshot.competitive)state.operator.competitiveMonths++;state.operator.lastRevenueUsd=snapshot.revenueUsd;state.operator.periodMined=0;state.operator.periodUptime=0;state.operator.periodDays=0;
}
function sellControlledBtc(amount){
  let remaining=Math.max(0,amount),sold=0;for(const bucket of ["hot","cold"]){const take=Math.min(state.wallets[bucket],remaining);state.wallets[bucket]-=take;remaining-=take;sold+=take}return sold;
}
function treasurySaleForSettlement(due){
  if(state.time<MARKET)return 0;const policy=treasuryPolicy(),fee=.006,price=priceAt(state.time);let btc=0;
  if(policy.id==="cover")btc=Math.max(0,due-state.cash)/(price*(1-fee));else btc=state.operator.periodMined*(policy.ratio||0);
  btc=Math.min(state.wallets.hot,btc);if(btc<=0)return 0;state.wallets.hot-=btc;const proceeds=btc*price*(1-fee);state.cash+=proceeds;log(`Treasury policy: ${policy.name}`,`${fmtBtc(btc)} sold · +${fmtUsd(proceeds)}`);return proceeds;
}
function finishMonthlySettlement(kind="cash",automatic=false){
  const pending=state.pendingSettlement;if(!pending||state.cash+1e-8<pending.due)return false;state.cash-=pending.due;const interest=pending.loanInterest||0;log("Operating bill settled",fmtUsd(pending.due));if(interest>0)log("Project finance interest",fmtUsd(interest));recordOperatorMonth(pending.snapshot,kind==="cash"||kind==="policy");state.bill=0;state.billLedger=blankBillLedger();state.lastMonth=pending.month;state.pendingSettlement=null;state.debt=0;state.power=!state.policyLock;clearTimeout(toastTimer);toast=null;
  let hardwareOpened=false;if(!state.ended){state.speed=pending.resumeSpeed||state.returnSpeed||1;hardwareOpened=activateNextHardwareAlert();setTimer()}save();if(automatic&&!hardwareOpened){refreshLive();requestAnimationFrame(()=>{refreshDashboardVisuals();refreshMinePricing()})}else render();return true;
}
function queueMonthlySettlement(due,month,loanInterest){
  const snapshot=settlementSnapshot(due,month),resumeSpeed=state.speed||state.returnSpeed||1;treasurySaleForSettlement(due);state.pendingSettlement={due,month,loanInterest,snapshot,resumeSpeed};
  if(state.cash>=due){finishMonthlySettlement(treasuryPolicy().id==="cover"?"policy":"cash",true);return}
  state.speed=0;renderFullQueued=true;log("Settlement decision required",`${fmtUsd(due-state.cash)} short`);showToast("Settlement paused","Choose how to cover the shortfall. Time will not move until the decision is resolved.");setTimer();
}
function payPendingWithBtc(){
  const p=state.pendingSettlement;if(!p||state.time<MARKET)return;const fee=.006,needed=Math.max(0,p.due-state.cash)/(priceAt(state.time)*(1-fee));if(controlled()+1e-12<needed)return showToast("Not enough self-held BTC",`You need ${fmtBtc(needed)} to close this settlement.`);const sold=sellControlledBtc(needed),proceeds=sold*priceAt(state.time)*(1-fee);state.cash+=proceeds;log("Emergency BTC sale",`${fmtBtc(sold)} · +${fmtUsd(proceeds)}`);finishMonthlySettlement("btc-rescue");
}
function liquidationCandidates(onlyId=null){
  return HARDWARE.filter(h=>!h.permanent&&(!onlyId||h.id===onlyId)&&(state.decommissionedHardware?.[h.id]||0)>0).map(h=>{const profitability=hardwareProfitability(h);return{h,owned:state.decommissionedHardware[h.id]||0,unit:Math.max(1,resaleHardwareValue(h)),margin:profitability.netPerUnit,efficiency:h.hash/Math.max(1,h.w)}}).sort((a,b)=>{const marginA=Number.isFinite(a.margin)?a.margin:Infinity,marginB=Number.isFinite(b.margin)?b.margin:Infinity;return marginA-marginB||a.efficiency-b.efficiency});
}
function fleetLiquidationPlan(target,onlyId=null){
  let remaining=Math.max(0,Number(target)||0),total=0,qty=0;const entries=[];
  for(const candidate of liquidationCandidates(onlyId)){if(remaining<=.005)break;const units=Math.min(candidate.owned,Math.max(1,Math.ceil(remaining/candidate.unit))),value=units*candidate.unit;entries.push({...candidate,qty:units,value});remaining-=value;total+=value;qty+=units}
  return{target:Math.max(0,Number(target)||0),total,qty,remaining:Math.max(0,remaining),entries,covered:remaining<=.005};
}
function liquidationPlanLabel(plan){return plan.entries.map(entry=>`${fmtCompactNumber(entry.qty)} × ${entry.h.name}`).join(", ")||"No saleable miners"}
function executeFleetLiquidation(target,onlyId=null,label="Fleet sold for liquidity"){
  const plan=fleetLiquidationPlan(target,onlyId);if(!plan.qty)return null;
  plan.entries.forEach(entry=>state.decommissionedHardware[entry.h.id]=Math.max(0,(state.decommissionedHardware[entry.h.id]||0)-entry.qty));state.cash+=plan.total;log(label,`${liquidationPlanLabel(plan)} · +${fmtUsd(plan.total)}`,"fleet");return plan;
}
function liquidateForSettlement(){
  const p=state.pendingSettlement;if(!p)return;const short=Math.max(0,p.due-state.cash),plan=executeFleetLiquidation(short,null,"Emergency fleet liquidation");
  if(!plan)return showToast("No saleable miners","There is no non-permanent mining hardware left to liquidate.");if(state.cash>=p.due)finishMonthlySettlement("liquidation");else{p.snapshot.competitive=false;save();render()}
}
function takeBridgeFinance(){
  const p=state.pendingSettlement;if(!p||state.time<MARKET)return;const short=Math.max(0,p.due-state.cash),principal=short*1.15;state.projectLoan+=principal;state.cash+=short;state.operator.bridgeLoans++;log("Emergency bridge finance",`${fmtUsd(principal)} principal for ${fmtUsd(short)} liquidity`);finishMonthlySettlement("bridge");
}
function enterReceivership(){
  const p=state.pendingSettlement;if(!p)return;state.operator.restructures++;const haircut=Math.min(.25,.1+(state.operator.restructures-1)*.05),btcSeized=controlled()*haircut;sellControlledBtc(btcSeized);let machines=0;HARDWARE.filter(h=>!h.permanent).forEach(h=>{const qty=Math.ceil((state.hardware[h.id]||0)*.25);state.hardware[h.id]=Math.max(0,(state.hardware[h.id]||0)-qty);machines+=qty});recordOperatorMonth(p.snapshot,false);state.bill=0;state.billLedger=blankBillLedger();state.debt=0;state.cash=0;state.lastMonth=p.month;state.pendingSettlement=null;state.power=false;clearTimeout(toastTimer);toast=null;log("Receivership",`${Math.round(haircut*100)}% of self-held BTC and ${machines} miners seized`);
  if(state.operator.restructures>=3){state.ended=true;state.endReason="receivership";state.speed=0;log("Scored campaign ended","third receivership")}else state.speed=p.resumeSpeed||state.returnSpeed||1;setTimer();save();render();
}
function strategySecurity(id){return STRATEGY_SECURITIES.find(x=>x.id===id)}
function strategyPrice(id,t=state.time){const s=strategySecurity(id);if(!s||t<at(s.date))return 0;const ratio=priceAt(t)/priceAt(at(s.date));return Math.max(1,s.base*(1+s.btcBeta*(ratio-1)))}
function strategyValue(id){return (state.strategy[id]||0)*strategyPrice(id)}
function strategyDailyYield(){return STRATEGY_SECURITIES.reduce((sum,s)=>sum+(state.strategy[s.id]||0)*strategyPrice(s.id)*s.yield/365,0)}
function buyStrategy(id,fraction){const s=strategySecurity(id);if(!s||state.time<at(s.date))return;const usd=state.cash*fraction,price=strategyPrice(id);if(usd<1)return;state.cash-=usd;state.strategy[id]+=usd/price;log(`Bought ${s.ticker}`,`-${fmtUsd(usd)}`);save();render()}
function sellStrategy(id,fraction){const s=strategySecurity(id),shares=state.strategy[id]||0;if(!s||shares<=0)return;const gross=shares*fraction*strategyPrice(id);state.strategy[id]-=shares*fraction;state.cash+=gross;log(`Sold ${s.ticker}`,`+${fmtUsd(gross)}`);save();render()}
function expectedDailyBtcForHash(hash,t=state.time){
  const blocks=expectedBlocksPerDayForHash(hash,t),reward=blockRewardAt(t);
  const uptime=Math.min(1,region().rely+(hasSkill("monitoring")?.01:0));
  return blocks*reward*uptime*contractUptimeFactor()*connectivityMiningFactor()*nodeMiningFactor()*(state.mode==="pool"?1-poolFee():1)*(firmwareHijacked() ? .65 : 1);
}
function expectedDay(){return expectedDailyBtcForHash(fleet().hash,state.time)}
function applyEvent(e){
  if(e.fx==="mtgox"&&state.wallets.mtgox>0){const lost=state.wallets.mtgox*.8,claim=state.wallets.mtgox*.2;state.wallets.mtgox=0;state.wallets.frozen+=claim;log("Mt. Gox failure",`-${fmtBtc(lost)}`)}
  if(e.fx==="bitfinex"&&state.wallets.bitfinex>0){const lost=state.wallets.bitfinex*.36;state.wallets.bitfinex-=lost;log("Bitfinex security loss",`-${fmtBtc(lost)}`)}
  if(e.fx==="quadriga"&&state.wallets.quadriga>0){const lost=state.wallets.quadriga*.8,claim=state.wallets.quadriga*.2;state.wallets.quadriga=0;state.wallets.frozen+=claim;log("QuadrigaCX collapse",`-${fmtBtc(lost)}`)}
  if(e.fx==="ftx"&&state.wallets.frontier>0){const frozen=state.wallets.frontier*.7,lost=state.wallets.frontier*.3;state.wallets.frontier=0;state.wallets.frozen+=frozen;log("Frontier venue failure",`-${fmtBtc(lost)}`)}
  if(e.fx==="china"&&state.region==="sichuan"){state.policyLock="Mining prohibited in Sichuan — relocate your fleet";state.power=false;log("Sichuan site closed","policy")}
  if(e.fx==="kazakh"&&state.region==="kazakhstan"){state.policyLock="Kazakhstan internet shutdown — relocate or wait";state.power=false;log("Kazakhstan site offline","network")}
  if(e.imp===3)state.points+=1;
  if(e.imp===3&&state.storyPause){state.returnSpeed=state.speed||state.returnSpeed||1;state.speed=0;state.activeEvent=e.id}
}
function crossedDate(prev,next,date){const t=typeof date==="number"?date:at(date);return t>prev&&t<=next}
function timeGatedUnlockCrossed(prev,next){
  const dated=[...EVENTS,...LEARNING,...HARDWARE,...FACILITIES,...REGIONS,...POOLS,...NODE_STORAGE,...SPECULATIONS,...DONATION_CAMPAIGNS,...STRATEGY_SECURITIES,...SKILLS,BACKUP_NODE];
  return dated.some(item=>item.date&&crossedDate(prev,next,item.date))||[MARKET,LIGHTNING,at("2011-01-01"),at("2012-01-01"),at("2014-01-01"),at("2015-01-01"),at("2016-01-01"),at("2017-01-01"),at("2021-01-01"),at("2024-01-01"),at("2024-01-10")].some(date=>crossedDate(prev,next,date));
}
function hardwareEfficiency(h){return h?.hash>0?h.w/(h.hash/1e12):Infinity}
function previousMiningGeneration(h){return HARDWARE.filter(item=>!item.permanent&&at(item.date)<at(h.date)).sort((a,b)=>at(b.date)-at(a.date))[0]||null}
function queueAsicReleases(prev,next){
  const alerts=state.hardwareAlerts,releases=asicHardware().filter(h=>crossedDate(prev,next,h.date)&&!alerts.seen.includes(h.id));
  releases.forEach(h=>{alerts.seen.push(h.id);if(!alerts.queue.includes(h.id)&&alerts.active!==h.id)alerts.queue.push(h.id);log(`New hardware released: ${h.name}`,`${fmtHash(h.hash)} · ${h.w} W · ${fmtJth(hardwareEfficiency(h))} J/TH`,"fleet")});
}
function activateNextHardwareAlert(){
  const alerts=state.hardwareAlerts;if(alerts.active||!alerts.queue.length||state.activeEvent||state.pendingSettlement||pendingTransaction||state.ended)return false;
  const id=alerts.queue.shift();if(!asicHardware().some(h=>h.id===id))return activateNextHardwareAlert();
  alerts.resumeSpeed=state.speed>0?state.speed:(alerts.resumeSpeed||state.returnSpeed||1);state.speed=0;alerts.active=id;renderFullQueued=true;setTimer();return true;
}
function closeHardwareAlert(inspect=false){
  const alerts=state.hardwareAlerts;if(!alerts.active)return;alerts.active=null;
  if(inspect){alerts.resumeSpeed=0;state.speed=0;activeTab="mine";save();setTimer();render(false);return}
  if(!activateNextHardwareAlert()){state.speed=alerts.resumeSpeed||state.returnSpeed||1;alerts.resumeSpeed=0;setTimer()}
  save();render();
}
function tick(silent=false){
  if(!state.started||state.ended||state.pendingSettlement)return;
  state.lastReal=Date.now();
  const prev=state.time,next=state.sandbox?prev+DAY:Math.min(END,prev+DAY),unlockCrossed=timeGatedUnlockCrossed(prev,next),previousSubsidy=subsidyAt(prev),nextSubsidy=subsidyAt(next);state.time=next;
  if(state.sandbox&&nextSubsidy<previousSubsidy){log("Protocol halving",`Block subsidy reduced from ${previousSubsidy} BTC to ${nextSubsidy} BTC`);if(!silent)showToast("Bitcoin halving",`The block subsidy is now ${nextSubsidy} BTC. Future mining payouts reflect the new issuance rate.`)}
  advanceLearning();
  advanceMaintenance();
  advanceProcurement();
  advanceFleetLifecycle();
  const crossed=EVENTS.filter(e=>at(e.date)>prev&&at(e.date)<=next&&!state.seen.includes(e.id)).sort((a,b)=>at(a.date)-at(b.date));
  crossed.forEach(e=>{state.seen.push(e.id);applyEvent(e)});
  queueAsicReleases(prev,next);
  advanceOperationalRisks(next);
  advanceNodeSync(silent);
  if(!silent&&!faucet&&faucetActive(next)&&nextRand()<.05)triggerFaucet(next);
  const fs=fleet(),r=region(),f=facility(),nodeW=nodePowerWatts();state.operator.periodDays++;
  const rate=powerRate(r,next),minerWatts=state.power&&state.debt<=0&&!state.policyLock&&!relocating()?fs.w*contractLoadFactor():0,nodeWatts=nodeHostPowered()?nodeW:0,dailyCosts={energy:dailyEnergyCostForWatts(minerWatts+nodeWatts,next,r),rent:f.rent/30.4375,internet:internetMonthlyCost()/30.4375,staff:staffMonthlyCost()/30.4375,insurance:insuranceMonthlyCost()/30.4375,nodeNetwork:totalNodeMonthlyOverhead()/30.4375},daily=Object.values(dailyCosts).reduce((sum,value)=>sum+value,0);
  Object.entries(dailyCosts).forEach(([key,value])=>state.billLedger[key]=(state.billLedger[key]||0)+value);state.bill+=daily;state.powerSpent+=daily;
  if(operating()){
    const lambda=expectedBlocksPerDayForHash(fs.hash,next)*Math.min(1,r.rely+(hasSkill("monitoring")?.01:0))*contractUptimeFactor()*connectivityMiningFactor()*nodeMiningFactor();
    let blocks,payout;
    if(state.mode==="pool"&&availablePool()&&poolEligible()){blocks=lambda;payout=lambda*blockRewardAt(next)*(1-poolFee())*(.97+nextRand()*.06)}
    else{blocks=poisson(lambda);payout=blocks*blockRewardAt(next)}
    if(firmwareHijacked())payout*=.65;
    if(payout>0){state.wallets.hot+=payout;state.mined+=payout;state.operator.periodMined+=payout;state.blocks+=blocks;if(blocks>=1)log(state.mode==="pool"?"Pool payout":"Block reward",`+${fmtBtc(payout)}`)}
    state.uptimeDays++;state.operator.periodUptime++;
  }
  if(nodeOnline())state.nodeDays++;
  state.wallets.etf*=1-.0025/365;
  const routing=lightningDailyFee();
  if(routing>0){state.wallets.hot+=routing;state.lightning.earned+=routing;if(routing>0)log("Lightning routing fees",`+${fmtBtc(routing)}`)}
  const strategyYield=strategyDailyYield();if(strategyYield>0){state.cash+=strategyYield;state.strategy.yieldEarned+=strategyYield}
  const d=new Date(next),month=d.toISOString().slice(0,7);
  if(month!==state.lastMonth){
    const loanInterest=state.projectLoan*(hasStaff("treasurer")?.009:.012),due=state.bill+loanInterest;queueMonthlySettlement(due,month,loanInterest);
    if(strategyYield>0)log("Strategy preferred income",`+${fmtUsd(strategyYield*30.4375)}`);
    state.history.push({t:next,p:priceAt(next),btc:controlled(),worth:netWorth(),hash:fs.hash});state.history=state.history.slice(-240);
  }
  while(state.blocks>=state.nextMilestone){state.points++;state.nextMilestone*=10;log("Mining milestone","+1 skill point")}
  checkMilestones();
  activateNextHardwareAlert();
  if(next>=END&&!state.sandbox&&!state.pendingSettlement){state.time=END;state.speed=0;state.ended=true;log("Historical record complete","final ledger")}
  if(!silent){save();queueRender(unlockCrossed)}
}
function queueRender(full=false){
  const now=performance.now();
  renderFullQueued=renderFullQueued||full;
  if(renderQueued)return;
  const refreshInterval=state.speed>=16?1000:state.speed>=8?700:state.speed>=4?450:250;
  const delay=Math.max(0,refreshInterval-(now-lastRenderAt));
  renderQueued=true;
  setTimeout(()=>{const needsFull=renderFullQueued;renderQueued=false;renderFullQueued=false;lastRenderAt=performance.now();if(!needsFull&&state.started&&!state.activeEvent&&!state.ended)refreshLive();else render()},delay);
}
function refreshDashboard(){
  if(activeTab!=="dashboard")return;
  const fs=fleet(),monthly=monthlyCost(),share=playerNetworkShareAt(state.time,fs.hash)*100,online=operating(),exp=online?expectedDay():0;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set("dashboard-status",online?"Your machines are securing the network.":state.policyLock?"Politics has shut the site.":state.debt>0?"The grid has cut you off.":"Mining is offline.");
  set("dashboard-copy",`${narrativeCopy("dashboard")} ${online?`You currently control ${fmtPct(share)} of effective hash.`:"Resolve the operational constraint or deliberately remain offline while history continues without you."}`);
  set("dashboard-yield",fmtBtc(exp));set("dashboard-controlled",fmtBtc(controlled()));set("dashboard-claims",fmtBtc(claims()));set("dashboard-runway",`${monthly.total?Math.max(0,state.cash/monthly.total).toFixed(1):"∞"} mo`);set("dashboard-runway-cost",`${fmtUsd(monthly.total)} expected monthly`);set("dashboard-load",`${(fs.kw/fs.cap*100).toFixed(1)}%`);set("dashboard-load-sub",`${fs.space} / ${facility().space} floor units`);set("dashboard-chart-date",dateFmt(state.time,true));set("dashboard-history-value",fmtBtc(controlled()));set("dashboard-bill",`Next bill accrued: ${fmtUsd(state.bill)}`);
  // Large visual cards deliberately wait for monthly/unlock renders so live
  // timeline ticks do not cause layout reflow while the player is reading.
}
function refreshDashboardVisuals(){
  if(activeTab!=="dashboard")return;
  const fs=fleet(),treasury=document.getElementById("dashboard-treasury");
  if(treasury)treasury.innerHTML=btcBreakdown();
  const shareCard=document.getElementById("dashboard-network-share");if(shareCard){const competition=competitiveHashAt(state.time,fs.hash);shareCard.innerHTML=`${donut(playerNetworkShareAt(state.time,fs.hash))}<div class="pie-legend"><span><i class="sw" style="background:var(--orange)"></i>You · ${fmtHash(fs.hash)}</span><span><i class="sw" style="background:#1a2325;border:1px solid var(--line)"></i>Effective competitors · ${fmtHash(competition)}</span></div><p class="modal-note">Historical baseline plus modelled competitive response.</p>`}
  const marketChart=document.getElementById("dashboard-market-chart");if(marketChart)marketChart.innerHTML=chart(sampled(priceAt),"#f7931a",true,{points:sampled(hashAt),color:"#86c79a",label:"Network hashrate",mainLabel:"BTC/USD"});
  const historyChart=document.getElementById("dashboard-history-chart");if(historyChart){const history=state.history.length?state.history.map(x=>x.btc):[0,controlled()];historyChart.innerHTML=chart(history,"#86c79a",true)}
  const mempool=document.getElementById("dashboard-mempool");if(mempool)mempool.innerHTML=mempoolViz();
}
function refreshSettlementForecast(){
  if(!document.getElementById("settlement-forecast"))return;const x=settlementForecast(),stateClass=x.cashAfter<0?"short":x.cashAfter<x.estimated*.2?"tight":"",status=x.cashAfter<0?`SHORT ${fmtUsd(Math.abs(x.cashAfter))} · fleet will disconnect if you do not raise cash or shut down`:x.cashAfter<x.estimated*.2?`TIGHT · only ${fmtUsd(x.cashAfter)} remains after settlement`:`COVERED · ${fmtUsd(x.cashAfter)} projected cash after settlement`,set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  const panel=document.getElementById("settlement-forecast-panel");if(panel)panel.className=`settlement-forecast ${stateClass}`;set("forecast-heading",`Forthcoming obligations · next settlement ${dateFmt(x.dueAt)}`);set("forecast-next-total",fmtUsd(x.estimated));set("forecast-next-note",`${x.days} day${x.days===1?"":"s"} remaining · current accrued costs included`);set("forecast-accrued",fmtUsd(state.bill));set("forecast-remaining",fmtUsd(x.remaining));set("forecast-total",fmtUsd(x.estimated));set("forecast-cash-after",fmtUsd(x.cashAfter));Object.entries(x.breakdown).forEach(([key,value])=>set(`forecast-line-${key}`,fmtUsd(value)));const bar=document.getElementById("forecast-bar");if(bar)bar.style.setProperty("--forecast",`${x.coverage}%`);set("forecast-status",status);
}
function refreshLearning(){
  if(activeTab!=="learn"||!state.learning)return;
  const item=learningItem();if(!item)return;
  const days=Math.min(item.days,Math.max(0,state.learning.progress||0)),percent=Math.min(100,Math.round(days/item.days*100));
  const dayEl=document.getElementById("learning-progress-days"),percentEl=document.getElementById("learning-progress-percent");
  if(dayEl)dayEl.textContent=`${days} / ${item.days} days`;
  if(percentEl)percentEl.textContent=`${percent}% complete`;
}
function refreshMinePricing(){
  if(activeTab!=="mine")return;
  const profitDesk=document.getElementById("mine-profitability");if(profitDesk){const shell=document.createElement("div");shell.innerHTML=profitabilityDeskHtml();profitDesk.innerHTML=shell.firstElementChild.innerHTML}
  const reserved=plannedFleetProjection(),availableKw=Math.max(0,reserved.cap*1000-reserved.w),availableSpace=Math.max(0,facility().space-reserved.space),marketOpen=state.time>=MARKET;
  document.querySelectorAll(".catalog .item").forEach(card=>{
    const firstBuy=card.querySelector('[data-action="buy-hw"]');if(!firstBuy)return;
    const h=HARDWARE.find(x=>x.id===firstBuy.dataset.id);if(!h||h.permanent)return;
    const available=state.time>=at(h.date),owned=state.hardware[h.id]||0,cost=hardwareUnitCost(h),resale=resaleHardwareValue(h),capacityMax=Math.max(0,Math.min(Math.floor(availableKw/Math.max(1,h.w)),Math.floor(availableSpace/Math.max(1,h.space)))),fiatMax=Math.max(0,Math.min(Math.floor(state.cash/cost),capacityMax)),price=card.querySelector(".price");
    if(price)price.innerHTML=`Buy · ${fmtCompactUsd(cost)} <small>Sell now · ${fmtCompactUsd(resale)}${marketOpen?` · ${fmtCompactBtc(resale/priceAt(state.time))}`:""}</small>`;
    const fiatActions=card.querySelector(".fiat-buy-actions"),selectedFiatQty=Number(fiatActions?.querySelector("[data-hardware-quantity]")?.value)||1;if(fiatActions)fiatActions.outerHTML=hardwareFiatBuyControls(h,cost,fiatMax,available,selectedFiatQty);
    const btcBuys=[...card.querySelectorAll('[data-action="buy-hw-btc"]')];
    if(marketOpen&&btcBuys.length){const unitBtc=cost/priceAt(state.time),btcMax=Math.max(0,Math.min(Math.floor(state.wallets.hot/unitBtc),capacityMax));btcBuys[0].dataset.value="1";btcBuys[0].disabled=btcMax<1;btcBuys[0].textContent=`Buy 1 · ${fmtCompactBtc(unitBtc)}`;btcBuys[1].dataset.value=String(btcMax);btcBuys[1].disabled=btcMax<1;btcBuys[1].textContent=`Buy max · ${fmtCompactBtc(unitBtc*btcMax)} (${fmtCompactNumber(btcMax)} miners)`}
    const fiatSells=[...card.querySelectorAll('[data-action="sell-hw"]')],btcSells=[...card.querySelectorAll('[data-action="sell-hw-btc"]')];
    if(fiatSells[0])fiatSells[0].textContent=`Sell 1 · ${fmtCompactUsd(resale)}`;
    if(fiatSells[1]){fiatSells[1].dataset.value=String(owned);fiatSells[1].textContent=`Sell all · ${fmtCompactUsd(resale*owned)} (${fmtCompactNumber(owned)} miners)`}
    if(btcSells[0]){btcSells[0].disabled=!marketOpen;btcSells[0].textContent=`Sell 1 · ${marketOpen?fmtCompactBtc(resale/priceAt(state.time)):"BTC unavailable"}`}
    if(btcSells[1]){btcSells[1].dataset.value=String(owned);btcSells[1].disabled=!marketOpen;btcSells[1].textContent=`Sell all · ${marketOpen?fmtCompactBtc(resale*owned/priceAt(state.time)):"BTC unavailable"} (${fmtCompactNumber(owned)} miners)`}
  });
}
function refreshLive(){
  const fs=fleet(),mc=monthlyCost(),online=operating(),p=priceAt(state.time),set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set("live-date",dateFmt(state.time));set("live-block",`BLOCK ~${fmtNum(approxHeight(state.time))}`);set("live-fiat",fmtUsd(state.cash));set("live-illiquid-fiat",fmtUsd(equityValue()));set("live-controlled-btc",fmtBtc(controlled()));set("live-custodial-btc",fmtBtc(claims()));set("live-lightning-btc",fmtBtc(lightningLocked()));set("live-price",state.time<MARKET?"NO MARKET":fmtUsd(p));set("live-network-hash",fmtHash(hashAt(state.time)));set("live-difficulty",fmtDiff(difficultyAt(state.time)));set("live-subsidy",`${subsidyAt(state.time)} BTC`);set("live-fees",fmtBtc(feeAt(state.time)));set("live-your-hash",fmtHash(fs.hash));set("live-your-status",online?"online":"offline");set("live-power",`${fs.kw.toFixed(2)} kW`);set("live-power-rate",`${fmtUsd(mc.rate)}/kWh`);set("live-transactions",fmtNum(txAt(state.time)));set("live-worth",fmtUsd(netWorth()));
  const hash=document.getElementById("live-your-hash");if(hash)hash.classList.toggle("green",online);refreshDashboard();refreshSettlementForecast();refreshLearning();
}
function setTimer(){clearInterval(timer);if(state.speed>0)timer=setInterval(tick,Math.max(70,2000/state.speed))}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){}}
