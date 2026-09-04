"use strict";

/* SETTLEMENT — the month boundary, where the operation either pays for itself or does not.
   Costs accrue daily into a ledger; at each boundary that ledger is presented as one bill and
   has to be met from liquid cash. Everything about the shortfall lives here too: the treasury
   conversion that sells BTC to cover it, and the four explicit rescues -- sell, liquidate,
   bridge finance, receivership -- that a player picks between when the cash is not there.

   Split out of simulation.js, which had reached the 70KB per-module ceiling. Nothing here is
   called before the page has finished parsing, so it can load in any order after the engine. */

function deferSettlement(){
  const pending=state.pendingSettlement;if(!pending)return;
  const paid=Math.min(state.cash,pending.due),carried=pending.due-paid;
  state.cash-=paid;state.debt+=carried;state.arrearsDue=nextBillDate();
  state.operator.restructures=state.operator.restructures;
  recordOperatorMonth(pending.snapshot,false);
  state.bill=0;state.billLedger={energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0};
  state.lastMonth=pending.month;state.pendingSettlement=null;state.settlementSaleMode=false;
  log("Operating bill missed",`${fmtUsd(carried)} carried into arrears`,"finance");
  showToast("Bill missed, grid still on",`${fmtUsd(carried)} is now in arrears. The site keeps running until the next bill on ${dateFmt(state.arrearsDue)}; if the arrears are still owed then, power and internet are cut until they are paid.`,"warning","finance");
  state.speed=pending.resumeSpeed||state.returnSpeed||0;setTimer();save();render();
}

function treasuryPolicy(){return TREASURY_POLICIES.find(x=>x.id===state.treasuryPolicy)||TREASURY_POLICIES[0]}

function monthlyCost(){
  const fs=fleet(),r=region(),f=facility(),nodeW=nodePowerWatts();
  const rate=powerRate(r,state.time);
  const projectedWatts=fs.w*contractLoadFactor()+(state.node>=1?nodeW:0),energy=(dailyEnergyCostForWatts(projectedWatts,state.time,r)-curtailmentCreditDaily(fs.w*contractLoadFactor(),state.time,r))*30.4375;
  const staff=staffMonthlyCost(),insurance=insuranceMonthlyCost(),internet=internetMonthlyCost(),nodeNetwork=totalNodeMonthlyOverhead();return{energy,rent:f.rent,staff,insurance,internet,nodeNetwork,total:energy+f.rent+staff+insurance+internet+nodeNetwork,rate};
}

function blankBillLedger(){return{energy:0,rent:0,internet:0,staff:0,insurance:0,nodeNetwork:0,other:0}}

function accruedBillBreakdown(){const result=Object.assign(blankBillLedger(),state.billLedger||{}),accounted=Object.values(result).reduce((sum,value)=>sum+value,0);if(state.bill>accounted+1e-8)result.other+=state.bill-accounted;return result}

function nextSettlementDate(offset=0){const date=new Date(state.time);return Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1+offset,1)}

function settlementForecast(){
  const fs=fleet(),r=region(),f=facility(),nodeW=nodePowerWatts();
  const rate=powerRate(r,state.time);
  const minerWatts=state.power&&!gridCutOff()&&!state.policyLock?fs.w*contractLoadFactor():0,nodeWatts=nodeHostPowered()?nodeW:0,energyDaily=dailyEnergyCostForWatts(minerWatts+nodeWatts,state.time,r)-curtailmentCreditDaily(minerWatts,state.time,r),daily={energy:energyDaily,rent:f.rent/30.4375,internet:internetMonthlyCost()/30.4375,staff:staffMonthlyCost()/30.4375,insurance:insuranceMonthlyCost()/30.4375,nodeNetwork:totalNodeMonthlyOverhead()/30.4375,other:0};
  let cursor=new Date(state.time),days=0,month=cursor.getUTCMonth();do{cursor=new Date(cursor.getTime()+DAY);days++}while(cursor.getUTCMonth()===month);
  const accrued=accruedBillBreakdown(),breakdown={};Object.keys(accrued).forEach(key=>breakdown[key]=accrued[key]+(daily[key]||0)*days);breakdown.finance=state.projectLoan*(hasStaff("treasurer")?.009:.012);const estimated=Object.values(breakdown).reduce((sum,value)=>sum+value,0),cashAfter=state.cash-estimated,coverage=estimated?Math.max(0,Math.min(100,state.cash/estimated*100)):100;
  return{days,dueAt:nextSettlementDate(),daily,accrued,breakdown,estimated,cashAfter,coverage,remaining:Math.max(0,estimated-state.bill)};
}

function settlementSnapshot(due,month){
  const days=Math.max(1,state.operator.periodDays||1),uptime=state.operator.periodUptime/days,marketOpen=state.time>=MARKET,revenueUsd=marketOpen?state.operator.periodMined*priceAt(state.time):0,expectedGross=marketOpen?expectedDailyBtcForHash(fleet().hash)*priceAt(state.time)*days:0,competitive=operating()&&(marketOpen?expectedGross>=due*.75:playerNetworkShareAt(state.time,fleet().hash)>=.0001);
  return{due,month,era:operatorEraAt(Math.max(START,state.time-DAY)).id,mined:state.operator.periodMined,revenueUsd,days,uptime,profitable:marketOpen?uptime>=.25&&revenueUsd>0&&revenueUsd>=due:uptime>=.65,competitive};
}

function treasurySaleForSettlement(due,silent=false){
  if(state.time<MARKET)return 0;const policy=treasuryPolicy(),fee=.006,price=priceAt(state.time);let btc=0;
  if(policy.id!=="cover")return 0;const need=Math.max(0,due-state.cash);btc=need/(price*(1-fee));
  // The automatic sale is charged the same order-book impact as a manual one, so routing a
  // large liquidation through the settlement path is not a way around the book. Impact
  // grows with size and size grows with impact, so the amount needed is solved iteratively.
  for(let i=0;i<5&&btc>0;i++){const slip=tradeImpact(Math.min(state.wallets.hot,btc)*price,1);btc=need/(price*(1-fee)*(1-slip))}
  btc=Math.min(state.wallets.hot,btc);if(btc<=0)return 0;const impact=tradeImpact(btc*price,1);if(impact>0)addPressure(btc*price,1);state.wallets.hot-=btc;const proceeds=btc*price*(1-fee)*(1-impact);state.cash+=proceeds;
  log(`Settlement conversion: ${policy.name}`,`${fmtBtc(btc)} sold · +${fmtUsd(proceeds)}`,"trade");
  const left=controlled(),drained=btc/Math.max(btc+left,1e-12);
  if(!silent){
    const heavy=left<=0||drained>=.5;
    showToast(heavy?"Treasury nearly emptied to pay the bill":"Bill covered by selling BTC",
      `${fmtBtc(btc)} was sold at ${fmtUsd(price)} to raise ${fmtUsd(proceeds)} for the operating bill, because liquid cash did not cover it. Your standing instruction is Cover the bill, so it sold the shortfall and nothing more. ${left>0?`${fmtBtc(left)} is still self-held.`:"You now hold no BTC, so the next bill has to come from cash."}`,
      heavy?"bad":"success","finance");
  }
  return proceeds;
}

function finishMonthlySettlement(kind="cash",automatic=false){
  const pending=state.pendingSettlement;if(!pending||state.cash+1e-8<pending.due)return false;const rescueFeedback=settlementRescueFeedback(kind,pending.due,state.cash-pending.due);state.cash-=pending.due;const interest=pending.loanInterest||0;log("Operating bill settled",fmtUsd(pending.due));if(interest>0)log("Project finance interest",fmtUsd(interest));recordOperatorMonth(pending.snapshot,kind==="cash"||kind==="policy");state.bill=0;state.billLedger=blankBillLedger();state.lastMonth=pending.month;state.pendingSettlement=null;state.debt=0;state.power=!state.policyLock;clearTimeout(toastTimer);toast=null;
  let hardwareOpened=false;if(!state.ended){state.speed=pending.resumeSpeed||state.returnSpeed||0;hardwareOpened=activateNextHardwareAlert();setTimer()}save();if(automatic&&!hardwareOpened){refreshLive();requestAnimationFrame(()=>{refreshDashboardVisuals();refreshMinePricing()})}else render();if(!automatic&&rescueFeedback)setTimeout(()=>showToast(rescueFeedback[0],rescueFeedback[1],"warning","finance"),0);return true;
}

function enterReceivership(){
  const p=state.pendingSettlement;if(!p)return;state.operator.restructures++;const haircut=Math.min(.25,.1+(state.operator.restructures-1)*.05),btcSeized=controlled()*haircut;sellControlledBtc(btcSeized);let machines=0;HARDWARE.filter(h=>!h.permanent).forEach(h=>{const qty=Math.ceil((state.hardware[h.id]||0)*.25);state.hardware[h.id]=Math.max(0,(state.hardware[h.id]||0)-qty);machines+=qty});recordOperatorMonth(p.snapshot,false);state.bill=0;state.billLedger=blankBillLedger();state.debt=0;state.cash=0;state.lastMonth=p.month;state.pendingSettlement=null;state.power=false;clearTimeout(toastTimer);toast=null;log("Receivership",`${Math.round(haircut*100)}% of self-held BTC and ${machines} miners seized`);
  if(state.operator.restructures>=3){state.ended=true;state.endReason="receivership";state.speed=0;log("Scored campaign ended","third receivership");recordCareerRun()}else state.speed=p.resumeSpeed||state.returnSpeed||0;setTimer();save();render();if(state.operator.restructures<3)setTimeout(()=>showToast("Receivership kept the run alive",`${fmtBtc(btcSeized)} and ${machines} miner${machines===1?" was":"s were"} seized. Mining remains off; this is strike ${state.operator.restructures} of 3.`,"warning","finance"),0);
}
