"use strict";

/* THERMAL LAYER — installed cooling, active heat load and room response. */
function hardwarePoweredDownCount(h,s=state){return Math.max(0,Math.min(s.hardware?.[h.id]||0,Math.floor(Number(s.poweredDownHardware?.[h.id])||0)))}
function ambientTemperatureC(t=state.time,s=state){const r=REGIONS.find(x=>x.id===s.region)||REGIONS[0],date=new Date(t),start=Date.UTC(date.getUTCFullYear(),0,0),day=(t-start)/DAY,season=Math.sin((day-111)/365*Math.PI*2);return (r.ambientC??18)+(r.seasonalC??8)*season}
function coolingInstallDays(item){const covid=state.time>=at("2020-03-12")&&state.time<at("2021-07-01");return Math.max(1,Math.round((item.install||14)*(covid?1.6:1)))}
function pendingCoolingOrders(id=null){return (state.thermal?.orders||[]).filter(o=>!id||o.id===id)}
function pendingCoolingCount(id){return pendingCoolingOrders(id).reduce((sum,o)=>sum+Number(o.qty||1),0)}
function coolingCapacityKw(s=state){const f=FACILITIES.find(x=>x.id===s.facility)||FACILITIES[0],equipment=COOLING_EQUIPMENT.reduce((sum,item)=>sum+(s.thermal?.equipment?.[item.id]||0)*item.coolingKw,0);return Math.max(.1,(f.passiveCoolingKw||f.kw*.3)+equipment)*(s.skills?.includes("heat")?1.15:1)}
function activeMinerWatts(s=state){
  return HARDWARE.reduce((sum,h)=>{const n=s.hardware?.[h.id]||0;if(!n||hardwareOfflineReason(h,s))return sum;const repairing=Math.min(n,Math.max(activeServiceJob(h.id,s)?.count||0,hardwareFaultCount(h,s))),paused=Math.min(n-repairing,hardwarePoweredDownCount(h,s));return sum+h.w*Math.max(0,n-repairing-paused)},0)*(s.skills?.includes("undervolt") ? .95 : 1)*(s.overdrive?1.25:1)
}
function coolingPeakWatts(s=state){return COOLING_EQUIPMENT.reduce((sum,item)=>sum+(s.thermal?.equipment?.[item.id]||0)*item.watts,0)}
function coolingPowerWatts(s=state,minerWatts=activeMinerWatts(s)){if(minerWatts<=0)return 0;const capacity=Math.max(.1,coolingCapacityKw(s)),demand=Math.max(.12,Math.min(1,minerWatts/1000/capacity));return coolingPeakWatts(s)*demand}
function thermalPowerAvailable(s=state){return !!s.power&&!gridCutOff(s)&&!s.policyLock&&s.time>=(s.ops?.powerOutageUntil||0)&&!(s.relocationJob&&s.time<s.relocationJob.due)&&!(s.facilityUpgradeJob&&s.time<s.facilityUpgradeJob.due)}
/* Cooling ratings are quoted as what the site can reject at a ten-degree room-to-outside
   difference, so a rating divided by ten is the kilowatts it sheds per degree. */
const THERMAL_REFERENCE_DELTA=10;
function thermalLossKwPerC(s=state){return Math.max(.005,coolingCapacityKw(s)/THERMAL_REFERENCE_DELTA)}
/* An enclosed site has a floor: a spare room is inside a heated house, an industrial
   unit holds some background warmth. A container yard has none and tracks the weather. */
function siteBaselineC(s=state){const f=FACILITIES.find(x=>x.id===s.facility)||FACILITIES[0];return Math.max(ambientTemperatureC(s.time,s),f.indoorBaseC??-Infinity)}
function thermalTargetC(s=state){
  const baseline=siteBaselineC(s);
  if(!thermalPowerAvailable(s))return baseline;
  const heatKw=activeMinerWatts(s)/1000;
  if(heatKw<=0)return baseline;
  return Math.min(95,Math.max(baseline,ambientTemperatureC(s.time,s)+heatKw/thermalLossKwPerC(s)));
}
function roomTemperatureC(s=state){const value=Number(s.thermal?.temperature);return Number.isFinite(value)?value:ambientTemperatureC(s.time,s)+2}
function temperatureWearMultiplier(s=state){return 1+Math.max(0,roomTemperatureC(s)-28)*.04}
function temperatureFailureMultiplier(s=state){return 1+Math.max(0,roomTemperatureC(s)-30)*.12}
function advanceThermals(){const target=thermalTargetC(),current=roomTemperatureC(),rate=activeMinerWatts()>0&&thermalPowerAvailable()?0.72:0.8;state.thermal.temperature=Math.max(-10,Math.min(90,current+(target-current)*rate))}
