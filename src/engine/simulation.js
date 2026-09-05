"use strict";

/* SIMULATION LAYER — state and economics. */
const SAVE_KEY="hashrate-genesis-save-v1";
const STARTING_LIQUIDITY_MIN=1500,STARTING_LIQUIDITY_MAX=1500000,STARTING_LIQUIDITY_STEP=500;
function clampStartingLiquidity(value){const numeric=Number(value);return Math.min(STARTING_LIQUIDITY_MAX,Math.max(STARTING_LIQUIDITY_MIN,Number.isFinite(numeric)?Math.round(numeric):STARTING_LIQUIDITY_MIN))}
function startingMode(id){return STARTING_MODES.find(mode=>mode.id===id)||STARTING_MODES[0]}
function startingModeForCash(cash){return null}
const initialState=()=>{const seed=Math.floor(Math.random()*4294967296);return{
  version:1,time:START,speed:0,returnSpeed:1,started:false,ended:false,seed,rng:seed,lastReal:Date.now(),
  cash:1500,startingCash:1500,difficulty:"medium",campaignStart:START,debt:0,bill:0,billLedger:{energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0},lastMonth:new Date(START).toISOString().slice(0,7),power:true,policyLock:null,
  wallets:{hot:0,cold:0,mtgox:0,bitfinex:0,quadriga:0,frontier:0,exchange:0,etf:0,frozen:0},
  lightning:{locked:0,earned:0},
  hardware:{laptop:1},poweredDownHardware:{},facility:"home",region:"na",thermal:{temperature:22,orders:[],equipment:{}},overdrive:false,settlementSaleMode:false,autoRepair:false,node:0,nodeStorage:50,nodePruned:false,nodeMode:"archival",nodeSync:{primaryLag:0,primaryPeak:0,backupLag:0,backupPeak:0},backupNode:{enabled:false,outageUntil:0},mode:"solo",pool:"f2pool",
  skills:[],points:0,startingGrant:false,seen:[],activeEvent:null,storyPause:true,shoppingPause:false,speculations:[],powerRateShock:null,hardwareGlut:null,hardwareAlerts:{seen:[],queue:[],active:null,resumeSpeed:0},hardwareToastSeen:[],exposureWarned:[],
  treasuryPolicy:"cover",pendingSettlement:null,endReason:null,arrearsDue:0,gridCutAnnounced:false,marketPressure:{usd:0,at:0},
  operator:{eras:{},periodMined:0,periodUptime:0,periodDays:0,lastRevenueUsd:0,totalMonths:0,solventMonths:0,profitableMonths:0,competitiveMonths:0,bridgeLoans:0,restructures:0},
  xp:{total:0,level:1,peakLevel:1,bestDifficulty:0,shares:0,sources:{shares:0,record:0,deploy:0,repair:0}},
  knowledge:0,nextKnowledge:5,learning:null,completedLearning:[],custody:{devices:[],keys:[],policy:"single",assigned:[],configBackedUp:false,orders:[],parts:{},builds:[],exposure:[],seq:0,lastScare:0},maintenance:{condition:{},faults:{},faultsByPart:{},selfRepairs:{},parts:0,inventory:{fan:0,hashboard:0,powerPcb:0,coolantPump:0,coolingManifold:0,laptopfan:0,asicfan:0,hashboardearly:0,hashboardmodern:0},inventoryMigrated:true,orders:[],serviceJobs:[]},procurementOrders:[],inactiveHardware:{},commissioningJobs:[],decommissionedHardware:{},relocationJob:null,facilityUpgradeJob:null,ops:{firmwarePatchedUntil:0,hijackUntil:0,outageUntil:0,powerOutageUntil:0,venueFreezes:{},riskMonth:""},strategy:{mstr:0,strk:0,strf:0,strd:0,strc:0,yieldEarned:0},sandbox:false,contract:"standard",staff:[],projectLoan:0,insured:false,milestones:[],milestoneLog:[],walletSetup:{done:false,step:0,rolls:[],keyHex:""},guidance:{dismissed:[]},walletSoftware:0,donations:[],
  blocks:0,mined:0,nodeDays:0,uptimeDays:0,powerSpent:0,nextMilestone:1000,
  connectivity:"fixed",history:[],activity:[],activitySeq:0,log:[{time:START,text:"Client synced to the network tip",amount:"~block "+approxHeight(START)}]
}};
let state,loadedHasHardwareAlerts=false,loadedHasHardwareToastSeen=false,activeTab="dashboard",mobileMenuOpen=false,mobileMenuSection="play",activityFilter="all",activityLimit=100,tradePercentages={},custodyLesson="malware",selectedVenue="mtgox",introDifficulty="hard",introStartingCash=STARTING_LIQUIDITY_MIN,pendingTransaction=null,toast=null,toastTimer=null,timer=null,faucet=null,faucetTimer=null,mempoolTimer=null,introStep=0,renderQueued=false,renderFullQueued=false,lastRenderAt=0;
try{const raw=localStorage.getItem(SAVE_KEY);if(raw){const parsed=JSON.parse(raw);loadedHasHardwareAlerts=!!parsed.hardwareAlerts;loadedHasHardwareToastSeen=!!parsed.hardwareToastSeen;state=Object.assign(initialState(),parsed)}else state=initialState()}catch(e){state=initialState()}
const ACTIVITY_CATEGORIES=["trade","fleet","finance","reward","custody","learning","operations","milestone"];
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
function minorHardware(){return HARDWARE.filter(h=>!h.permanent&&h.era!=="ASIC"&&h.era!=="HYDRO ASIC").sort((a,b)=>at(a.date)-at(b.date))}
function migrateHardwareToastSeen(target,hadToastSeen=true){
  const valid=new Set(minorHardware().map(h=>h.id));
  target.hardwareToastSeen=Array.isArray(target.hardwareToastSeen)?[...new Set(target.hardwareToastSeen.filter(id=>valid.has(id)))]:[];
  if(!hadToastSeen)target.hardwareToastSeen=minorHardware().filter(h=>at(h.date)<=Number(target.time||START)).map(h=>h.id);
}
function migrateHardwareAlerts(target,hadAlerts=true){
  const valid=new Set(asicHardware().map(h=>h.id)),defaults={seen:[],queue:[],active:null,resumeSpeed:0},alerts=Object.assign(defaults,target.hardwareAlerts||{});
  alerts.seen=Array.isArray(alerts.seen)?[...new Set(alerts.seen.filter(id=>valid.has(id)))]:[];alerts.queue=Array.isArray(alerts.queue)?[...new Set(alerts.queue.filter(id=>valid.has(id)))]:[];
  alerts.active=valid.has(alerts.active)?alerts.active:null;alerts.resumeSpeed=Math.max(0,Number(alerts.resumeSpeed)||0);
  if(!hadAlerts)alerts.seen=asicHardware().filter(h=>at(h.date)<=Number(target.time||START)).map(h=>h.id);
  target.hardwareAlerts=alerts;
}
migrateHardwareAlerts(state,loadedHasHardwareAlerts);
migrateHardwareToastSeen(state,loadedHasHardwareToastSeen);
const savedStartingMode=STARTING_MODES.some(mode=>mode.id===state.difficulty)?startingMode(state.difficulty):null;
state.difficulty=savedStartingMode?.id||"medium";state.campaignStart=Math.max(START-DAY*5,Number(state.campaignStart)||START);
if(!state.started){introDifficulty=(savedStartingMode||startingMode("medium")).id;introStartingCash=clampStartingLiquidity(state.startingCash);const mode=startingMode(introDifficulty);state.cash=introStartingCash;state.startingCash=introStartingCash;state.time=mode.start;state.campaignStart=mode.start;state.lastMonth=new Date(mode.start).toISOString().slice(0,7);state.difficulty=mode.id}
state.lightning=Object.assign({locked:0,earned:0},state.lightning||{});
state.wallets=Object.assign({hot:0,cold:0,mtgox:0,bitfinex:0,quadriga:0,frontier:0,exchange:0,etf:0,frozen:0},state.wallets||{});
state.speculations=Array.isArray(state.speculations)?state.speculations:[];
state.completedLearning=Array.isArray(state.completedLearning)?state.completedLearning:[];
state.knowledge=Number.isFinite(Number(state.knowledge))?Number(state.knowledge):0;
state.nextKnowledge=Number.isFinite(Number(state.nextKnowledge))?Number(state.nextKnowledge):5;
state.maintenance=Object.assign({condition:{},faults:{},parts:0,inventory:{fan:0,hashboard:0,powerPcb:0,coolantPump:0,coolingManifold:0,laptopfan:0,asicfan:0,hashboardearly:0,hashboardmodern:0},inventoryMigrated:false,orders:[],serviceJobs:[]},state.maintenance||{});
state.maintenance.condition=state.maintenance.condition&&typeof state.maintenance.condition==="object"?state.maintenance.condition:{};
state.maintenance.faults=state.maintenance.faults&&typeof state.maintenance.faults==="object"?state.maintenance.faults:{};
state.maintenance.orders=Array.isArray(state.maintenance.orders)?state.maintenance.orders:[];
state.maintenance.serviceJobs=Array.isArray(state.maintenance.serviceJobs)?state.maintenance.serviceJobs.filter(job=>HARDWARE.some(h=>h.id===job.id)&&Number.isFinite(Number(job.due))):[];
state.maintenance.parts=Math.max(0,Number(state.maintenance.parts)||0);
state.maintenance.inventory=Object.assign({fan:0,hashboard:0,powerPcb:0,coolantPump:0,coolingManifold:0,laptopfan:0,asicfan:0,hashboardearly:0,hashboardmodern:0},state.maintenance.inventory&&typeof state.maintenance.inventory==="object"?state.maintenance.inventory:{});
SPARE_PARTS.forEach(part=>state.maintenance.inventory[part.id]=Math.max(0,Math.floor(Number(state.maintenance.inventory[part.id])||0)));
if(!state.maintenance.inventoryMigrated){state.maintenance.inventory.fan+=Math.floor(state.maintenance.parts);state.maintenance.parts=0;state.maintenance.inventoryMigrated=true;}
state.poweredDownHardware=state.poweredDownHardware&&typeof state.poweredDownHardware==="object"?state.poweredDownHardware:{};
state.thermal=Object.assign({temperature:22,equipment:{}},state.thermal||{});state.thermal.temperature=Math.max(-10,Math.min(90,Number(state.thermal.temperature)||22));state.thermal.equipment=state.thermal.equipment&&typeof state.thermal.equipment==="object"?state.thermal.equipment:{};
COOLING_EQUIPMENT.forEach(item=>state.thermal.equipment[item.id]=Math.max(0,Math.floor(Number(state.thermal.equipment[item.id])||0)));
state.thermal.orders=Array.isArray(state.thermal.orders)?state.thermal.orders.filter(o=>COOLING_EQUIPMENT.some(item=>item.id===o.id)&&Number.isFinite(Number(o.due))).map(o=>({id:o.id,qty:Math.max(1,Math.floor(Number(o.qty)||1)),due:Number(o.due),cost:Number(o.cost)||0})):[];
HARDWARE.filter(h=>fanTierFor(h)!=="laptopfan").forEach(h=>{const byPart=state.maintenance.faultsByPart?.[h.id];if(byPart&&byPart.laptopfan){byPart[fanTierFor(h)]=(byPart[fanTierFor(h)]||0)+byPart.laptopfan;delete byPart.laptopfan}});
(state.maintenance.serviceJobs||[]).forEach(job=>{const h=HARDWARE.find(x=>x.id===job.id);if(h&&job.part==="laptopfan"&&fanTierFor(h)!=="laptopfan")job.part=fanTierFor(h)});
state.procurementOrders=Array.isArray(state.procurementOrders)?state.procurementOrders.filter(o=>HARDWARE.some(h=>h.id===o.id)&&Number(o.qty)>0&&Number.isFinite(Number(o.due))):[];
state.inactiveHardware=state.inactiveHardware&&typeof state.inactiveHardware==="object"?state.inactiveHardware:{};
HARDWARE.forEach(h=>state.inactiveHardware[h.id]=Math.max(0,Math.floor(Number(state.inactiveHardware[h.id])||0)));
state.commissioningJobs=Array.isArray(state.commissioningJobs)?state.commissioningJobs.filter(job=>HARDWARE.some(h=>h.id===job.id)&&Number(job.qty)>0&&Number.isFinite(Number(job.due))):[];
state.decommissionedHardware=state.decommissionedHardware&&typeof state.decommissionedHardware==="object"?state.decommissionedHardware:{};
HARDWARE.forEach(h=>state.decommissionedHardware[h.id]=Math.max(0,Math.floor(Number(state.decommissionedHardware[h.id])||0)));
state.relocationJob=state.relocationJob&&REGIONS.some(r=>r.id===state.relocationJob.id)&&Number.isFinite(Number(state.relocationJob.due))?state.relocationJob:null;
state.facilityUpgradeJob=state.facilityUpgradeJob&&FACILITIES.some(f=>f.id===state.facilityUpgradeJob.id)&&Number.isFinite(Number(state.facilityUpgradeJob.due))?state.facilityUpgradeJob:null;
state.ops=Object.assign({firmwarePatchedUntil:0,hijackUntil:0,outageUntil:0,powerOutageUntil:0,venueFreezes:{},riskMonth:""},state.ops||{});
state.ops.venueFreezes=state.ops.venueFreezes&&typeof state.ops.venueFreezes==="object"?state.ops.venueFreezes:{};
state.nodeSync=Object.assign({primaryLag:0,primaryPeak:0,backupLag:0,backupPeak:0},state.nodeSync||{});
["primaryLag","primaryPeak","backupLag","backupPeak"].forEach(k=>state.nodeSync[k]=Math.max(0,Number(state.nodeSync[k])||0));
state.backupNode=Object.assign({enabled:false,outageUntil:0},state.backupNode||{});state.backupNode.enabled=!!state.backupNode.enabled;state.backupNode.outageUntil=Math.max(0,Number(state.backupNode.outageUntil)||0);
state.strategy=Object.assign({mstr:0,strk:0,strf:0,strd:0,strc:0,yieldEarned:0},state.strategy||{});
/* Custody arrived after these saves were written. Balances and skills are untouched: a run
   loading into the new model keeps every coin exactly where it was and simply has no devices
   yet, which reads correctly — it never bought any. */
state.custody=Object.assign({devices:[],keys:[],policy:"single",assigned:[],configBackedUp:false,
  orders:[],parts:{},builds:[],exposure:[],seq:0,lastScare:0},state.custody||{});
for(const field of ["devices","keys","assigned","orders","builds","exposure"])
  if(!Array.isArray(state.custody[field]))state.custody[field]=[];
if(!state.custody.parts||typeof state.custody.parts!=="object")state.custody.parts={};
state.custody.policy=CUSTODY_POLICIES.some(x=>x.id===state.custody.policy)?state.custody.policy:"single";
state.custody.devices=state.custody.devices.filter(d=>d&&CUSTODY_PRODUCTS.some(p=>p.id===d.product));
state.custody.keys=state.custody.keys.filter(k=>k&&k.id);
state.custody.assigned=state.custody.assigned.filter(id=>state.custody.keys.some(k=>k.id===id));
state.custody.seq=Math.max(Number(state.custody.seq)||0,state.custody.devices.length+state.custody.keys.length);
Object.keys(state.strategy).forEach(k=>{if(!Number.isFinite(Number(state.strategy[k])))state.strategy[k]=0;else state.strategy[k]=Number(state.strategy[k])});
state.nodeStorage=Math.max(50,Number(state.nodeStorage)||50);state.nodePruned=!!state.nodePruned;state.nodeMode=NODE_MODES.some(x=>x.id===state.nodeMode)?state.nodeMode:(state.nodePruned?"pruned":"archival");state.nodePruned=state.nodeMode==="pruned";
state.staff=Array.isArray(state.staff)?state.staff:[];state.contract=POWER_CONTRACTS.some(x=>x.id===state.contract)?state.contract:"standard";state.connectivity=CONNECTIVITY_PLANS.some(x=>x.id===state.connectivity)?state.connectivity:"fixed";state.projectLoan=Math.max(0,Number(state.projectLoan)||0);state.milestones=Array.isArray(state.milestones)?state.milestones:[];
state.billLedger=Object.assign({energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0},state.billLedger||{});Object.keys(state.billLedger).forEach(k=>state.billLedger[k]=Math.max(0,Number(state.billLedger[k])||0));const migratedLedgerTotal=Object.values(state.billLedger).reduce((sum,value)=>sum+value,0);if(state.bill>migratedLedgerTotal+1e-8)state.billLedger.other+=state.bill-migratedLedgerTotal;
state.donations=Array.isArray(state.donations)?state.donations:[];
state.guidance=Object.assign({dismissed:[]},state.guidance||{});state.guidance.dismissed=Array.isArray(state.guidance.dismissed)?[...new Set(state.guidance.dismissed.map(String))]:[];
state.skills=Array.isArray(state.skills)?[...new Set(state.skills.filter(id=>SKILLS.some(s=>s.id===id)))]:[];
state.seen=Array.isArray(state.seen)?state.seen:[];
state.milestones=Array.isArray(state.milestones)?state.milestones:[];
state.exposureWarned=Array.isArray(state.exposureWarned)?state.exposureWarned:[];
state.maintenance.selfRepairs=state.maintenance.selfRepairs&&typeof state.maintenance.selfRepairs==="object"?state.maintenance.selfRepairs:{};
state.xp=normalizeXp(state.xp);
state.startingGrant=!!state.startingGrant;
state.autoRepair=!!state.autoRepair;
state.treasuryPolicy=TREASURY_POLICIES.some(x=>x.id===state.treasuryPolicy)?state.treasuryPolicy:"cover";
state.debt=Math.max(0,Number(state.debt)||0);state.arrearsDue=Number(state.arrearsDue)||0;state.gridCutAnnounced=!!state.gridCutAnnounced;if(state.debt<=0){state.arrearsDue=0;state.gridCutAnnounced=false}
state.pendingSettlement=state.pendingSettlement&&typeof state.pendingSettlement==="object"?state.pendingSettlement:null;
state.operator=Object.assign({eras:{},periodMined:0,periodUptime:0,periodDays:0,lastRevenueUsd:0,totalMonths:0,solventMonths:0,profitableMonths:0,competitiveMonths:0,bridgeLoans:0,restructures:0},state.operator||{});
state.operator.eras=state.operator.eras&&typeof state.operator.eras==="object"?state.operator.eras:{};
["periodMined","periodUptime","periodDays","lastRevenueUsd","totalMonths","solventMonths","profitableMonths","competitiveMonths","bridgeLoans","restructures"].forEach(k=>state.operator[k]=Math.max(0,Number(state.operator[k])||0));
OPERATOR_ERAS.forEach(era=>{state.operator.eras[era.id]=Object.assign({months:0,solvent:0,profitable:0,uptime:0,competitive:0},state.operator.eras[era.id]||{});["months","solvent","profitable","uptime","competitive"].forEach(k=>state.operator.eras[era.id][k]=Math.max(0,Number(state.operator.eras[era.id][k])||0))});
state.maintenance.faultsByPart=state.maintenance.faultsByPart&&typeof state.maintenance.faultsByPart==="object"?state.maintenance.faultsByPart:{};
HARDWARE.forEach(h=>{
  if(!Number.isFinite(Number(state.maintenance.condition[h.id])))state.maintenance.condition[h.id]=100;else state.maintenance.condition[h.id]=Math.max(0,Math.min(100,Number(state.maintenance.condition[h.id])));
  const legacyFaults=Math.max(0,Math.floor(Number(state.maintenance.faults[h.id])||0));
  const byPart=state.maintenance.faultsByPart[h.id]&&typeof state.maintenance.faultsByPart[h.id]==="object"?state.maintenance.faultsByPart[h.id]:{};
  Object.keys(byPart).forEach(part=>{byPart[part]=Math.max(0,Math.floor(Number(byPart[part])||0))||0});
  if(legacyFaults&&!Object.values(byPart).some(Boolean)){const fallback=Object.keys(partFaultWeights(h))[0]||"fan";byPart[fallback]=(byPart[fallback]||0)+legacyFaults}
  state.maintenance.faultsByPart[h.id]=byPart;
  state.maintenance.faults[h.id]=Object.values(byPart).reduce((sum,n)=>sum+n,0);
})
const numericDefaults={cash:1500,debt:0,bill:0,points:0,rng:123456789};
Object.keys(numericDefaults).forEach(k=>{if(!Number.isFinite(Number(state[k])))state[k]=numericDefaults[k];else state[k]=Number(state[k])});
if(state.shoppingPause){state.shoppingPause=false;if(state.started&&state.speed<=0&&!state.activeEvent&&!state.ended)state.speed=Number(state.returnSpeed)||1}
state.overdrive=!!state.overdrive;
state.settlementSaleMode=!!state.settlementSaleMode&&!!state.pendingSettlement;
state.marketPressure=state.marketPressure&&typeof state.marketPressure.usd==="number"&&typeof state.marketPressure.at==="number"?state.marketPressure:{usd:0,at:0};
state.hardware=state.hardware&&typeof state.hardware==="object"?state.hardware:{};
HARDWARE.forEach(h=>{if(!Number.isFinite(Number(state.hardware[h.id])))state.hardware[h.id]=h.permanent?1:0;else state.hardware[h.id]=Math.max(h.permanent?1:0,Math.floor(Number(state.hardware[h.id])));state.poweredDownHardware[h.id]=Math.max(0,Math.min(state.hardware[h.id],Math.floor(Number(state.poweredDownHardware[h.id])||0)))});
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
function hardwareFaultBreakdown(h,s=state){
  const n=s.hardware?.[h.id]||0,byPart=s.maintenance?.faultsByPart?.[h.id]||{},out={};let total=0;
  Object.entries(byPart).forEach(([part,count])=>{const c=Math.max(0,Math.floor(Number(count)||0));if(c){out[part]=c;total+=c}});
  if(total>n){let allocated=0;const keys=Object.keys(out);keys.forEach((part,i)=>{out[part]=i===keys.length-1?Math.max(0,n-allocated):Math.floor(out[part]*n/total);allocated+=out[part]})}
  return out;
}
function hardwareFaultCount(h,s=state){return Object.values(hardwareFaultBreakdown(h,s)).reduce((sum,n)=>sum+n,0)}
function hardwareRepairState(h,s=state){
  const n=s.hardware?.[h.id]||0,servicing=activeServiceJob(h.id,s)?.count||0,faultsByPart=hardwareFaultBreakdown(h,s),faults=Object.values(faultsByPart).reduce((sum,c)=>sum+c,0),repairing=Math.min(n,Math.max(servicing,faults)),paused=Math.min(Math.max(0,n-repairing),hardwarePoweredDownCount(h,s)),active=Math.max(0,n-repairing-paused);
  return{n,active,repairing,paused,faults,faultsByPart,servicing};
}
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
  let hash=0,minerW=0,space=0,value=0,count=0,activeCount=0,potentialW=0,offline=[];
  HARDWARE.forEach(h=>{const n=s.hardware[h.id]||0,reason=hardwareOfflineReason(h,s),rs=hardwareRepairState(h,s),{repairing,paused,active,servicing}=rs;space+=h.space*n;value+=h.cost*n;count+=n;potentialW+=h.w*n;if(n&&reason){offline.push({h,n,reason});return}if(repairing)offline.push({h,n:repairing,reason:servicing?"Repair in progress":"Unexpected hardware fault"});if(paused)offline.push({h,n:paused,reason:"Manually powered down"});const effectiveHash=h.hash*hardwareLaunchFactor(h,s.time);activeCount+=active;hash+=effectiveHash*active;minerW+=h.w*active;if(s.skills.includes("asictune")&&(h.era==="ASIC"||h.era==="HYDRO ASIC"))hash+=effectiveHash*active*.05});
  if(s.skills.includes("firmware"))hash*=1.04;if(s.skills.includes("undervolt"))minerW*=.95;
  if(s.overdrive){hash*=1.15;minerW*=1.25}
  const coolingW=coolingPowerWatts(s,minerW),w=minerW+coolingW;potentialW*=s.skills.includes("undervolt")?.95:1;if(s.overdrive)potentialW*=1.25;potentialW+=coolingPeakWatts(s);
  const f=FACILITIES.find(x=>x.id===s.facility)||FACILITIES[0],cap=f.kw*(s.skills.includes("capacity")?1.1:1);
  const expandedCap=cap*(s.skills.includes("substation")?1.1:1);
  return{hash,w,minerW,coolingW,kw:w/1000,space,value,count,activeCount,cap:expandedCap,potentialKw:potentialW/1000,offline,offlineCount:offline.reduce((a,x)=>a+x.n,0),within:w/1000<=expandedCap&&space<=f.space};
}
function controlled(){return state.wallets.hot+state.wallets.cold}
const COUNTERPARTY_LEAD_DAYS=30;
function hotWalletIncidentRisk(s=state){if(s.time<at("2011-01-01")||(s.wallets?.hot||0)<=0)return 0;const selfHeld=Math.max(1e-12,(s.wallets?.hot||0)+(s.wallets?.cold||0)),hotShare=(s.wallets?.hot||0)/selfHeld,base=.00065+hotShare*.0016;return base*custodyCompromiseFactor(s)*(s.skills?.includes("backups")?.7:1)}
function hotWalletAnnualRisk(s=state){return 1-Math.pow(1-hotWalletIncidentRisk(s),12)}
/* Arrears give you the rest of the month. The grid is cut at the next bill date if
   the debt is still outstanding, which is when a real supplier stops waiting. */
function gridCutOff(s=state){return s.debt>0&&s.time>=(s.arrearsDue||Infinity)}
function nextBillDate(t=state.time){const d=new Date(t);return Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)}
function operatorEraAt(t=state.time){return OPERATOR_ERAS.find(era=>t>=era.start&&t<era.end)||OPERATOR_ERAS[OPERATOR_ERAS.length-1]}
function operatorEraStats(era=operatorEraAt()){return state.operator.eras[era.id]}
function operatorEraScore(stats){if(!stats||stats.months<=0)return 0;return Math.round(35*stats.solvent/stats.months+30*stats.profitable/stats.months+20*stats.uptime/stats.months+15*stats.competitive/stats.months)}
function operatorScoreBreakdown(){
  const eraPoints=OPERATOR_ERAS.reduce((sum,era)=>sum+operatorEraScore(operatorEraStats(era)),0),performance=eraPoints/(OPERATOR_ERAS.length*100)*740,mastery=Math.min(60,Math.max(0,(state.xp?.peakLevel||1)-1)/49*60);
  const milestones=Math.min(80,(state.milestones?.length||0)/MILESTONES.length*80),allBtc=totalBtc()+lightningLocked(),holdings=Math.min(40,Math.log2(1+allBtc)/Math.log2(11)*40),monthly=monthlyCost().total,runway=monthly>0?state.cash/monthly:6,balance=(state.debt||state.projectLoan>Math.max(state.cash,state.operator.lastRevenueUsd*6))?0:Math.min(40,runway/6*40),resilience=Math.max(0,40-state.operator.restructures*20-state.operator.bridgeLoans*5),total=Math.max(0,Math.min(1000,Math.round(performance+mastery+milestones+holdings+balance+resilience)));
  return{total,performance:Math.round(performance),mastery:Math.round(mastery),milestones:Math.round(milestones),holdings:Math.round(holdings),balance:Math.round(balance),resilience:Math.round(resilience),eraPoints};
}
function operatorGrade(score=operatorScoreBreakdown().total){return score>=900?"Legendary":score>=750?"Elite":score>=600?"Durable":score>=450?"Solvent":score>=300?"Survivor":"At risk"}
function lightningLocked(){return state.lightning?.locked||0}
function connectivityOutage(){return state.time<(state.ops?.outageUntil||0)}
function powerOutage(){return state.time<(state.ops?.powerOutageUntil||0)}
function siteOutage(){return connectivityOutage()||powerOutage()}
function activeSiteIncident(){if(powerOutage())return{kind:"Grid outage",until:state.ops.powerOutageUntil};if(connectivityOutage())return{kind:"Internet outage",until:state.ops.outageUntil};return null}
function relocating(){return !!state.relocationJob&&state.time<state.relocationJob.due}
function upgradingFacility(){return !!state.facilityUpgradeJob&&state.time<state.facilityUpgradeJob.due}
function fleetGrounded(){return relocating()||upgradingFacility()}
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
function operating(){const fs=fleet();return state.power&&!gridCutOff()&&!state.policyLock&&!siteOutage()&&!fleetGrounded()&&fs.within&&fs.hash>0}
function asicCount(){return HARDWARE.filter(h=>h.era==="ASIC"||h.era==="HYDRO ASIC").reduce((n,h)=>n+(state.hardware[h.id]||0),0)}
function firmwarePatchDue(){return asicCount()>0&&state.time>=at("2017-04-26")&&state.time>(state.ops?.firmwarePatchedUntil||0)}
function firmwareHijacked(){return state.time<(state.ops?.hijackUntil||0)}
function venueFrozen(id){return state.time<(state.ops?.venueFreezes?.[id]||0)}
function rateMultiplier(){return state.powerRateShock&&state.time<state.powerRateShock.until?state.powerRateShock.multiplier:1}
const ANNOUNCE_WINDOW=DAY*120;
function announced(item,t=state.time){return !item?.date||at(item.date)<=t+ANNOUNCE_WINDOW}
/* DEMAND RESPONSE — a curtailment contract does not merely use less power, it is PAID for the
   load it gives back, and that payment is the entire reason an operator signs one. Riot's
   Rockdale site earned more from ERCOT power credits than from mining in some months of 2023;
   that is the operation this game's own "A Texas miner grows grid-sized" chapter is about.
   The contract used to model the giving-up without the getting-paid, which left it strictly
   worse than every other contract in every month of the campaign — a dead option.

   It is also not a flat duty cycle. Demand response is CALLED when the grid is short, so
   curtailment tracks the same recorded energy shock that raises everyone else's tariff: a
   light standing obligation in calm months, deep curtailment during a crisis, paid at the
   scarcity value of the capacity released. That is what makes the contract a real decision —
   during a shock a comfortable operation buys a fixed PPA and keeps hashing, while a
   squeezed one curtails and takes the credit. */
const CURTAIL_BASE=.05,CURTAIL_SLOPE=.8,CURTAIL_CAP=.6,CURTAIL_CREDIT=1.4;
function curtailmentIntensityAt(t=state.time){return Math.min(CURTAIL_CAP,CURTAIL_BASE+Math.max(0,energyShock(t)-1)*CURTAIL_SLOPE)}
function curtailmentIntensity(t=state.time){return state.contract==="curtail"?curtailmentIntensityAt(t):0}
function curtailmentCreditDaily(watts,t=state.time,r=region()){
  const intensity=curtailmentIntensity(t);
  if(!intensity||watts<=0)return 0;
  // `watts` is the load actually drawn after curtailment; recover the load given back.
  const released=watts/(1-intensity)*intensity;
  const credit=released/1000*24*r.kwh*energyShock(t)*CURTAIL_CREDIT;
  // Capped at the power it would have bought. Free electricity during a crisis is a large
  // enough prize; letting the credit run past it turns a big site into a subsidy farm and
  // can drive the whole operating bill negative, which the settlement path never expects.
  return Math.min(credit,dailyEnergyCostForWatts(watts,t,r));
}
function contractLoadFactor(){return state.contract==="curtail"?1-curtailmentIntensity():1}
function contractUptimeFactor(){return state.contract==="curtail"?1-curtailmentIntensity():state.contract==="spot"&&energyShock(state.time)>1?.9:1}
function energyLoadFactor(){const fs=fleet(),load=fs.cap?fs.kw/fs.cap:0;return 1+Math.pow(Math.max(0,load-.55),2)*1.8}
function energyEfficiencyFactor(){return (hasSkill("metering")?.96:1)*(hasSkill("curtailment")?.96:1)}
function powerContract(){return POWER_CONTRACTS.find(x=>x.id===state.contract)||POWER_CONTRACTS[0]}
function powerRate(r,t=state.time){const c=powerContract(),shock=c.id==="fixed"?1:energyShock(t);return r.kwh*c.mult*shock*energyEfficiencyFactor()*rateMultiplier()*energyLoadFactor()}
function dailyEnergyCostForWatts(watts,t=state.time,r=region()){return Math.max(0,watts)/1000*24*powerRate(r,t)*(hasSkill("heat")?.96:1)}
function hasStaff(id){return state.staff.includes(id)}
/* HARDWARE PRICES DO NOT HOLD. A machine sold at list while it was the current thing and then
   fell away fast: an S9 listed near $2,100 in 2016 and traded at $100-300 by 2019. The game
   used to charge list price forever, which made the newest machine the right buy on payback,
   hash per dollar AND hash per watt at every date and in every region — an eighteen-machine
   catalog with one answer. Resale already depreciated, so you could sell a decade-old S9 for
   4% of list while buying one cost 100%: there was no second-hand market on the buy side, and
   the second-hand market is where old ASICs actually went.

   Depreciation runs on the same shape resale uses, against the same BTC-momentum factor,
   because hardware prices collapsed hardest in bear markets rather than merely with age. It
   does not make old hardware good — the newest machine still wins wherever power is
   expensive. It makes old hardware CHEAP, which is a different and true thing, and it is why
   worn S9s ended up running on sub-$0.04 power long after they stopped being worth buying new. */
const HW_PRICE_PLATEAU=.5,HW_PRICE_HALFLIFE=1.25,HW_PRICE_FLOOR=.03;
function hardwareMarketFactor(h,t=state.time){
  const age=Math.max(0,(t-at(h.date))/DAY/365);
  const depreciation=age<=HW_PRICE_PLATEAU?1:Math.max(HW_PRICE_FLOOR,Math.pow(.5,(age-HW_PRICE_PLATEAU)/HW_PRICE_HALFLIFE));
  const reference=priceAt(Math.max(MARKET,t-DAY*365)),momentum=t<MARKET?1:Math.max(.7,Math.min(1.3,priceAt(t)/reference));
  // A liquidation glut softens secondary prices. That is bad if you are selling and good if
  // you are buying, and the game only ever modelled the first half.
  const glut=state.hardwareGlut&&t<state.hardwareGlut.until?1-state.hardwareGlut.discount:1;
  return depreciation*momentum*glut;
}
/* A machine bought years after release is a used machine, and arrives with the wear that
   implies. Floored above the 65% threshold that takes a hardware type offline, so a
   second-hand purchase is a worse machine rather than an immediate brick. */
function incomingConditionFor(h,t=state.time){
  const age=Math.max(0,(t-at(h.date))/DAY/365);
  if(age<=HW_PRICE_PLATEAU)return 100;
  return Math.max(70,Math.round(100-(age-HW_PRICE_PLATEAU)*7));
}
function hardwareUnitCost(h){return h.cost*hardwareMarketFactor(h)*(hasSkill("procurement")?.94:1)*(hasStaff("procurementlead")?.95:1)}
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
  log(`Completed ${item.title}`,`+${gain.toFixed(gain%1?1:0)} knowledge`);showToast("Learning complete",`${item.title} added ${gain.toFixed(gain%1?1:0)} knowledge.`,"info","learn");renderFullQueued=true;
}
function advanceLearning(){
  const item=learningItem();if(!item||state.learning.waiting)return;
  state.learning.progress=(state.learning.progress||0)+1;
  if(state.learning.progress>=item.days){if(item.check){state.learning.waiting=true;renderFullQueued=true;showToast("Knowledge check",`Finish ${item.title} in the Learn tab.`,"info","learn")}else awardLearning(item)}
}
function covidPartsMarket(){return state.time>=at("2020-03-12")&&state.time<at("2021-07-01")}
function patchFirmware(){
  const count=asicCount(),cost=Math.max(75,count*18);if(!count)return showToast("No ASIC fleet","Firmware patching applies to ASIC and hydro ASIC hardware.");
  if(state.cash<cost)return showToast("Not enough cash",`Signed firmware rollout costs ${fmtUsd(cost)}.`);
  state.cash-=cost;state.ops.firmwarePatchedUntil=state.time+DAY*540;state.ops.hijackUntil=0;
  log("ASIC firmware patched",`${count} machines · protected for 18 months`);showToast("Fleet patched","Signed firmware is current for 18 simulation months.");save();render();
}
function advanceNodeSync(silent=false){
  const syncPath=(lagKey,peakKey,ready,rate,label)=>{const before=state.nodeSync[lagKey];if(ready){state.nodeSync[lagKey]=Math.max(0,before-rate);if(before>0&&state.nodeSync[lagKey]===0){state.nodeSync[peakKey]=0;log(`${label} caught up`,`Verification resumed at the chain tip`);if(!silent)showToast("Node synchronized",`${label} has validated its backlog and reached the chain tip.`,"info","custody")}}else{state.nodeSync[lagKey]=Math.min(365,state.nodeSync[lagKey]+1);state.nodeSync[peakKey]=Math.max(state.nodeSync[peakKey],state.nodeSync[lagKey])}};
  syncPath("primaryLag","primaryPeak",primaryNodeReady(),primaryNodeCatchupRate(),"Primary full node");
  if(state.backupNode.enabled)syncPath("backupLag","backupPeak",backupNodeReady(),4,"Geographic backup node");
}
function advanceOperationalRisks(next){
  if(state.ops.outageUntil&&next>=state.ops.outageUntil){state.ops.outageUntil=0;log("Connectivity restored",`${region().name} upstream service resumed`,`operations`);showToast("Internet restored",`${connectivityPlan().name} service is back. Mining and primary-node connectivity can resume.`,"info","facilities")}
  if(state.ops.powerOutageUntil&&next>=state.ops.powerOutageUntil){state.ops.powerOutageUntil=0;log("Grid power restored",`${region().name} site energized`,`operations`);showToast("Grid restored",`Power is back at ${facility().name}. The fleet can resume hashing.`,"info","facilities")}
  const month=new Date(next).toISOString().slice(0,7);if(state.ops.riskMonth===month)return;state.ops.riskMonth=month;
  advanceCustodyRisks(next);
  const hotRisk=hotWalletIncidentRisk();if(hotRisk>0&&nextRand()<hotRisk){const lost=state.wallets.hot*(.12+nextRand()*.28);state.wallets.hot=Math.max(0,state.wallets.hot-lost);log("Hot-wallet key compromise",`-${fmtBtc(lost)} · cold storage unaffected`,"custody");showToast("Hot wallet compromised",`${fmtBtc(lost)} was lost from the online wallet. Cold storage and custodial venues were unaffected.`,"bad","custody");renderFullQueued=true}
  if(firmwarePatchDue()&&!firmwareHijacked()&&nextRand()<.07){state.ops.hijackUntil=next+DAY*(10+Math.floor(nextRand()*21));log("ASIC fleet hijacked","35% of hash diverted");showToast("Firmware compromise","Unpatched ASIC firmware is pointing part of your hash rate to an attacker. Patch it now.","bad");}
  const r=region(),outageRisk=connectivityIncidentRisk(),gridRisk=Math.min(.28,Math.max(.004,(1-r.rely)*1.15));
  if(!siteOutage()&&(operating()||nodeHostPowered())&&nextRand()<gridRisk){const days=1+Math.floor(nextRand()*(2+gridRisk*45));state.ops.powerOutageUntil=next+DAY*days;log(`${r.name} grid outage`,`${days} days without power`,`operations`);showToast("Grid outage",`${r.name}'s grid is unavailable at ${facility().name}. Mining, cooling and primary-node services pause for ${days} days.`,"bad","facilities");}
  else if(!siteOutage()&&(operating()||nodeHostPowered())&&nextRand()<outageRisk){const plan=connectivityPlan(),days=(1+Math.floor(nextRand()*(3+outageRisk*90)))*(plan.failover??1);
    state.ops.outageUntil=next+DAY*days;
    // A failover link is measured in hours, not days, so the notice has to say so.
    const spell=days<1?`${Math.max(1,Math.round(days*24))} hours`:`${Math.round(days)} days`;
    log(`${r.name} connectivity outage`,`${spell} offline`,`operations`);
    showToast("Internet outage",days<1
      ?`${plan.name} lost its fixed upstream in ${r.name} and cut over to cellular. Mining and primary-node services pause for ${spell}.`
      :`${plan.name} has lost upstream service in ${r.name}. Mining and primary-node services pause for ${spell}.`,"bad","facilities");}
  if(state.backupNode.enabled&&!backupNodeOutage()&&nextRand()<.006){const days=1+Math.floor(nextRand()*3);state.backupNode.outageUntil=next+DAY*days;log("Remote node provider outage",`${days} days offline`);showToast("Backup-node outage",`The remote node site is unavailable for ${days} simulation day${days===1?"":"s"}. The primary node is unaffected.`,"bad","custody");}
  [["bitfinex",.022],["quadriga",.065],["frontier",.04],["exchange",.007]].forEach(([id,risk])=>{if(state.wallets[id]>0&&!venueFrozen(id)&&nextRand()<risk){const days=7+Math.floor(nextRand()*24);state.ops.venueFreezes[id]=next+DAY*days;log(`${walletName(id)} withdrawals frozen`,`${days} days`);showToast("Withdrawal freeze",`${walletName(id)} has paused withdrawals. Move funds only when service resumes.`,"bad");}});
}
function advanceFleetLifecycle(){
  advanceCustodyOrders(state.time);
  state.commissioningJobs=state.commissioningJobs.filter(job=>{if(job.due>state.time)return true;const h=HARDWARE.find(item=>item.id===job.id);
    if(h){const incoming=incomingConditionFor(h,job.orderedAt||state.time);
      if(incoming<100){const existing=state.hardware[job.id]||0,prior=maintenanceCondition(h),total=existing+job.qty;
        if(total>0)state.maintenance.condition[job.id]=(existing*prior+job.qty*incoming)/total}}
    state.hardware[job.id]=(state.hardware[job.id]||0)+job.qty;awardXp((6+3*Math.log2(1+(h?.hash||0)/1e9))*Math.log2(1+job.qty),"deploy");log(`Commissioned ${job.qty} × ${h?.name||job.id}`,"Racked, configured and hashing","fleet");showToast("Commissioning complete",`${job.qty} × ${h?.name||"miner"} is now connected to the fleet.`);renderFullQueued=true;return false});
  const job=state.relocationJob;if(job&&job.due<=state.time){const destination=REGIONS.find(r=>r.id===job.id);state.region=job.id;state.relocationJob=null;state.policyLock=null;state.power=state.debt<=0;log(`Fleet arrived in ${destination?.name||job.id}`,"Site commissioning complete","operations");showToast("Relocation complete",`The fleet is live at ${destination?.name||job.id}.`);renderFullQueued=true}
  const upgradeJob=state.facilityUpgradeJob;if(upgradeJob&&upgradeJob.due<=state.time){
    const destination=FACILITIES.find(x=>x.id===upgradeJob.id);state.facility=upgradeJob.id;state.facilityUpgradeJob=null;state.power=state.debt<=0;
    const incidentRoll=nextRand();if(incidentRoll<upgradeJob.risk&&!state.insured){
      const incident=nextRand();
      if(incident<.42){const until=state.time+DAY*90;state.powerRateShock={multiplier:1.22,until};log("Facility upgrade: power contract repriced","+22% power for 90 days");showToast("Upgrade issue","The new site's power contract is 22% higher for 90 days.","bad")}
      else if(incident<.78){const candidates=HARDWARE.filter(h=>!h.permanent&&(state.hardware[h.id]||0)>0);const h=candidates[Math.floor(nextRand()*candidates.length)];if(h){const lost=Math.max(1,Math.ceil((state.hardware[h.id]||0)*(.05+nextRand()*.1)*(hasSkill("spares")?.5:1)));state.hardware[h.id]=Math.max(0,state.hardware[h.id]-lost);log("Facility upgrade: miners damaged",`-${lost} ${h.name}`);showToast("Upgrade issue",`${lost} ${h.name} damaged in transit.`,"bad")}else{const fee=Math.min(state.cash,fleet().value*.025);state.cash-=fee;log("Facility upgrade: customs inspection",`-${fmtUsd(fee)}`);showToast("Upgrade issue","A customs inspection added an unexpected handling cost.","bad")}}
      else{const fee=Math.min(state.cash,fleet().value*(.03+nextRand()*.04));state.cash-=fee;log("Facility upgrade: equipment held",`-${fmtUsd(fee)}`);showToast("Upgrade issue","Equipment was held during the move; release fees were required.","bad")}
    }else if(incidentRoll<upgradeJob.risk&&state.insured){log("Upgrade incident insured","claim paid");showToast("Insurance claim","The policy absorbed the facility-upgrade incident.")}
    log(`Moved into ${destination?.name||upgradeJob.id}`,"Site commissioning complete","operations");showToast("Facility upgrade complete",`The fleet is live at ${destination?.name||upgradeJob.id}.`);renderFullQueued=true
  }
}
function recordOperatorMonth(snapshot,solvent){
  if(!snapshot)return;const stats=state.operator.eras[snapshot.era]||operatorEraStats();stats.months++;if(solvent)stats.solvent++;if(snapshot.profitable)stats.profitable++;if(snapshot.uptime>=.75)stats.uptime++;if(snapshot.competitive)stats.competitive++;
  state.operator.totalMonths++;if(solvent)state.operator.solventMonths++;if(snapshot.profitable)state.operator.profitableMonths++;if(snapshot.competitive)state.operator.competitiveMonths++;state.operator.lastRevenueUsd=snapshot.revenueUsd;state.operator.periodMined=0;state.operator.periodUptime=0;state.operator.periodDays=0;
}
function sellControlledBtc(amount){
  let remaining=Math.max(0,amount),sold=0;for(const bucket of ["hot","cold"]){const take=Math.min(state.wallets[bucket],remaining);state.wallets[bucket]-=take;remaining-=take;sold+=take}return sold;
}
function queueMonthlySettlement(due,month,loanInterest,silent=false){
  const snapshot=settlementSnapshot(due,month),resumeSpeed=state.speed||state.returnSpeed||0;treasurySaleForSettlement(due,silent);state.pendingSettlement={due,month,loanInterest,snapshot,resumeSpeed};
  if(state.cash+1e-8>=due){finishMonthlySettlement(treasuryPolicy().id==="cover"?"policy":"cash",true);return}
  state.speed=0;renderFullQueued=true;log("Settlement decision required",`${fmtUsd(due-state.cash)} short`);if(!silent)showToast("Settlement paused","Choose how to cover the shortfall. Time will not move until the decision is resolved.","bad","finance");setTimer();
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
function strategySecurity(id){return STRATEGY_SECURITIES.find(x=>x.id===id)}
function strategyPrice(id,t=state.time){const s=strategySecurity(id);if(!s||t<at(s.date))return 0;const ratio=priceAt(t)/priceAt(at(s.date));return Math.max(1,s.base*(1+s.btcBeta*(ratio-1)))}
function strategyValue(id){return (state.strategy[id]||0)*strategyPrice(id)}
function strategyDailyYield(){return STRATEGY_SECURITIES.reduce((sum,s)=>sum+(state.strategy[s.id]||0)*strategyPrice(s.id)*s.yield/365,0)}
function buyStrategy(id,fraction){const s=strategySecurity(id);if(!s||state.time<at(s.date))return;const usd=state.cash*fraction,price=strategyPrice(id);if(usd<1)return;state.cash-=usd;state.strategy[id]+=usd/price;log(`Bought ${s.ticker}`,`-${fmtUsd(usd)}`);save();render()}
function sellStrategy(id,fraction){const s=strategySecurity(id),shares=state.strategy[id]||0;if(!s||shares<=0)return;const gross=shares*fraction*strategyPrice(id);state.strategy[id]-=shares*fraction;state.cash+=gross;log(`Sold ${s.ticker}`,`+${fmtUsd(gross)}`);save();render()}
function expectedDailyBtcForHash(hash,t=state.time){
  const blocks=expectedBlocksPerDayForHash(hash,t),reward=blockRewardAt(t);
  const uptime=Math.min(1,region().rely+(hasSkill("monitoring")?.01:0));
  return blocks*reward*uptime*contractUptimeFactor()*connectivityMiningFactor()*nodeMiningFactor()*(state.mode==="pool"?(1-poolFee())*poolRewardFactorAt(t):1)*(firmwareHijacked() ? .65 : 1);
}
function expectedDay(){return expectedDailyBtcForHash(fleet().hash,state.time)}
/* A vendor losing its customer list is a privacy event with a date and a scope. It reaches
   the people who bought from that vendor inside the window the disclosure describes, and it
   keeps reaching them: a leaked record cannot be un-leaked by buying a different device.
   What it never does is move coins by itself, or prove the device was compromised. */
function applyEvent(e){
  if(e.fx==="ledgerleak"){
    state.custody.exposure.push({supplier:"ledger",at:state.time,from:"2016-06-01",to:"2020-06-30",
      source:e.source||"vendor disclosure"});
    const hit=custodyExposedPurchases();
    if(hit.length)log("Your purchase is in the leaked records",
      `${hit.length} device order${hit.length===1?"":"s"} bought from Ledger in the affected window`,"custody");
  }
  if(e.fx==="mtgox"&&state.wallets.mtgox>0){const lost=state.wallets.mtgox*.8,claim=state.wallets.mtgox*.2;state.wallets.mtgox=0;state.wallets.frozen+=claim;log("Mt. Gox failure",`-${fmtBtc(lost)}`)}
  if(e.fx==="bitfinex"&&state.wallets.bitfinex>0){const lost=state.wallets.bitfinex*.36;state.wallets.bitfinex-=lost;log("Bitfinex security loss",`-${fmtBtc(lost)}`)}
  if(e.fx==="quadriga"&&state.wallets.quadriga>0){const lost=state.wallets.quadriga*.8,claim=state.wallets.quadriga*.2;state.wallets.quadriga=0;state.wallets.frozen+=claim;log("QuadrigaCX collapse",`-${fmtBtc(lost)}`)}
  if(e.fx==="ftx"&&state.wallets.frontier>0){const frozen=state.wallets.frontier*.7,lost=state.wallets.frontier*.3;state.wallets.frontier=0;state.wallets.frozen+=frozen;log("Frontier venue failure",`-${fmtBtc(lost)}`)}
  if(e.fx==="china"&&state.region==="sichuan"){state.policyLock="Mining prohibited in Sichuan — relocate your fleet";state.power=false;log("Sichuan site closed","policy")}
  if(e.fx==="kazakh"&&state.region==="kazakhstan"){state.policyLock="Kazakhstan internet shutdown — relocate or wait";state.power=false;log("Kazakhstan site offline","network")}
  if(e.fx==="computenorthx"){state.hardwareGlut={discount:.15,until:state.time+DAY*120};log("Compute North liquidation glut","Secondary ASIC prices soften for a season","fleet")}
  if(e.fx==="corescix"){state.hardwareGlut={discount:.22,until:state.time+DAY*180};log("Core Scientific liquidation glut","Secondary ASIC prices soften further","fleet")}
  if(e.fx==="riotx"&&state.region==="texas"){state.powerRateShock={multiplier:1.12,until:state.time+DAY*90};log("Regional grid strain","Texas power rates tick up while a large neighboring miner scales its load","operations")}
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
function queueExposureWarnings(prev,next){
  // Counterparty radar is the skill that reads the room before the room catches fire: the
  // four recorded advance warnings arrive a month sooner, which is the difference between
  // withdrawing from Mt. Gox in January and reading about it in February.
  const warningLead=hasSkill("counterparty")?COUNTERPARTY_LEAD_DAYS*DAY:0;
  EXPOSURE_WARNINGS.filter(w=>crossedDate(prev,next,at(w.date)-warningLead)&&!state.exposureWarned.includes(w.id)).forEach(w=>{
    const exposed=w.wallet?state.wallets[w.wallet]>0:state.region===w.region;
    if(!exposed)return;
    state.exposureWarned.push(w.id);
    log(w.title,w.wallet?fmtBtc(state.wallets[w.wallet])+" exposed":"Regional exposure","custody");
    showToast(w.title,w.body,"warning");
  });
}
function queueMinorHardwareReleases(prev,next){
  const seen=state.hardwareToastSeen,releases=minorHardware().filter(h=>crossedDate(prev,next,h.date)&&!seen.includes(h.id));
  releases.forEach(h=>{seen.push(h.id);log(`New hardware available: ${h.name}`,`${fmtHash(h.hash)} · ${h.w} W`,"fleet");showToast("New generation available",`${h.name} (${h.maker}) just reached the catalog — ${fmtHash(h.hash)} at ${h.w} W.`,"info","mine")});
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
  const prev=state.time,next=state.sandbox?Math.min(SANDBOX_END,prev+DAY):Math.min(END,prev+DAY),unlockCrossed=timeGatedUnlockCrossed(prev,next),previousSubsidy=subsidyAt(prev),nextSubsidy=subsidyAt(next);state.time=next;
  if(state.sandbox&&nextSubsidy<previousSubsidy)announceProjectedHalving(previousSubsidy,nextSubsidy,silent);
  advanceLearning();
  advanceThermals();
  advanceMaintenance();
  advanceProcurement();advanceCoolingInstalls();
  advanceFleetLifecycle();
  const crossed=EVENTS.filter(e=>at(e.date)>prev&&at(e.date)<=next&&!state.seen.includes(e.id)).sort((a,b)=>at(a.date)-at(b.date));
  crossed.forEach(e=>{state.seen.push(e.id);applyEvent(e)});
  queueAsicReleases(prev,next);
  queueExposureWarnings(prev,next);
  advanceOperationalRisks(next);
  advanceNodeSync(silent);
  if(!silent&&!faucet&&faucetActive(next)&&nextRand()<.05)triggerFaucet(next);
  const fs=fleet(),r=region(),f=facility(),nodeW=nodePowerWatts();state.operator.periodDays++;
  const rate=powerRate(r,next),minerWatts=state.power&&state.debt<=0&&!state.policyLock&&!fleetGrounded()?fs.w*contractLoadFactor():0,nodeWatts=nodeHostPowered()?nodeW:0,dailyCosts={energy:dailyEnergyCostForWatts(minerWatts+nodeWatts,next,r)-curtailmentCreditDaily(minerWatts,next,r),rent:f.rent/30.4375,internet:internetMonthlyCost()/30.4375,staff:staffMonthlyCost()/30.4375,insurance:insuranceMonthlyCost()/30.4375,nodeNetwork:totalNodeMonthlyOverhead()/30.4375},daily=Object.values(dailyCosts).reduce((sum,value)=>sum+value,0);
  Object.entries(dailyCosts).forEach(([key,value])=>state.billLedger[key]=(state.billLedger[key]||0)+value);state.bill+=daily;state.powerSpent+=daily;
  if(state.mode==="pool"&&!poolClosed(state.pool)&&!poolEligible()){const lostPool=poolData();state.mode="solo";log(`${lostPool.name} no longer available`,`Requires ${SKILLS.find(x=>x.id===lostPool.requires)?.name||lostPool.requires} · failed over to solo mining`,"operations");if(!silent)showToast("Pool unavailable",`${lostPool.name} needs ${SKILLS.find(x=>x.id===lostPool.requires)?.name||lostPool.requires}. Your fleet has failed over to solo mining rather than quietly mining solo while the tab still said pool.`,"bad","pools")}
  if(state.mode==="pool"&&poolClosed(state.pool)){const closedPool=poolData();state.mode="solo";log(`${closedPool.name} shut down`,"Failed over to solo mining","operations");if(!silent)showToast("Pool shut down",`${closedPool.name} has ceased operating. Your fleet has failed over to solo mining.`,"bad","pools")}
  if(operating()){
    const lambda=expectedBlocksPerDayForHash(fs.hash,next)*Math.min(1,r.rely+(hasSkill("monitoring")?.01:0))*contractUptimeFactor()*connectivityMiningFactor()*nodeMiningFactor();
    let blocks,payout;
    if(state.mode==="pool"&&availablePool()&&poolEligible()){blocks=lambda;payout=poolPayoutFor(lambda,next)}
    else{blocks=poisson(lambda);payout=blocks*blockRewardAt(next)}
    if(firmwareHijacked())payout*=.65;
    if(payout>0){state.wallets.hot+=payout;state.mined+=payout;state.operator.periodMined+=payout;state.blocks+=blocks;if(blocks>=1)log(state.mode==="pool"?"Pool payout":blocks>1?`Block reward ×${blocks} (today)`:"Block reward (today)",`+${fmtBtc(payout)}`)}
    state.uptimeDays++;state.operator.periodUptime++;
    advanceOperatorXp(blocks,silent);
  }else advanceOperatorXp(0,silent);
  if(nodeOnline())state.nodeDays++;
  state.wallets.etf*=1-.0025/365;
  const routing=lightningDailyFee();
  if(routing>0){state.wallets.hot+=routing;state.lightning.earned+=routing;if(routing>0)log("Lightning routing fees",`+${fmtBtc(routing)}`)}
  const strategyYield=strategyDailyYield();if(strategyYield>0){state.cash+=strategyYield;state.strategy.yieldEarned+=strategyYield}
  const d=new Date(next),month=d.toISOString().slice(0,7);
  if(month!==state.lastMonth){
    if(state.debt>0&&state.time>=(state.arrearsDue||Infinity)&&!state.gridCutAnnounced){state.gridCutAnnounced=true;log("Grid disconnected",`${fmtUsd(state.debt)} still unpaid`,"finance");if(!silent)showToast("Power and internet cut off",`${fmtUsd(state.debt)} of arrears went unpaid past its second bill date. Mining and node service stop while rent, payroll and finance keep accruing. Clear the arrears from Finance to be reconnected.`,"bad","finance")}
    const loanInterest=state.projectLoan*(hasStaff("treasurer")?.009:.012),due=state.bill+loanInterest;queueMonthlySettlement(due,month,loanInterest,silent);
    if(strategyYield>0)log("Strategy preferred income",`+${fmtUsd(strategyYield*30.4375)}`);
    state.history.push({t:next,p:priceAt(next),btc:controlled(),worth:netWorth(),hash:fs.hash});state.history=state.history.slice(-240);
  }
  queueMinorHardwareReleases(prev,next);
  while(state.blocks>=state.nextMilestone){state.points++;state.nextMilestone*=10;log("Mining milestone","+1 skill point")}
  checkMilestones();
  activateNextHardwareAlert();
  if(next>=END&&!state.sandbox&&!state.pendingSettlement){state.time=END;state.speed=0;state.ended=true;log("Historical record complete","final ledger");recordCareerRun()}
  if(next>=SANDBOX_END&&state.sandbox&&!state.pendingSettlement){state.time=SANDBOX_END;state.speed=0;state.ended=true;state.endReason="sandbox-complete";log("Procedural record complete","100 simulated years since the historical cutoff");recordCareerRun()}
  if(!silent){save();queueRender(unlockCrossed)}
}
function queueRender(full=false){
  const now=performance.now();
  renderFullQueued=renderFullQueued||full;
  if(renderQueued)return;
  // Faster clocks repaint less often, not more: at 16x the simulation covers
  // eight days a second, so a repaint every frame is unreadable jitter.
  const refreshInterval=state.speed>=16?600:state.speed>=8?420:state.speed>=4?320:250;
  const delay=Math.max(0,refreshInterval-(now-lastRenderAt));
  renderQueued=true;
  const paint=()=>{
    const needsFull=renderFullQueued;renderQueued=false;renderFullQueued=false;lastRenderAt=performance.now();
    if(!needsFull&&state.started&&!state.activeEvent&&!state.ended)refreshLive();else renderMineContent();
  };
  // Align the DOM write with the display refresh so it never lands mid-paint.
  setTimeout(()=>requestAnimationFrame(paint),delay);
}
function setTimer(){clearInterval(timer);if(state.speed>0)timer=setInterval(tick,Math.max(70,2000/state.speed))}
function startMempoolTimer(){clearInterval(mempoolTimer);mempoolTimer=setInterval(()=>{if(activeTab==="dashboard"&&state.speed>0)refreshDashboardVisuals()},1200)}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch(e){}}
