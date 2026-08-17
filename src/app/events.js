"use strict";

let recentTouchTab=null;
document.getElementById("app").addEventListener("click",e=>{
  const b=e.target.closest("[data-action]");if(!b||b.disabled)return;const a=b.dataset.action,v=b.dataset.value,id=b.dataset.id;
  if(a==="tab"&&recentTouchTab&&recentTouchTab.value===v&&Date.now()-recentTouchTab.at<800){recentTouchTab=null;return}
  if(a==="percent-snap"){updateTradePercentage(id,Number(v));return}
  if(a==="close-hardware-alert"){closeHardwareAlert(false);return}
  if(a==="inspect-hardware-release"){closeHardwareAlert(true);return}
  if(a==="cancel-transaction"){cancelTransactionConfirmation();return}
  if(a==="confirm-transaction"){confirmTransaction();return}
  if(CONFIRMABLE_ACTIONS.has(a)){requestTransactionConfirmation(b);return}
  if(a==="activity-filter"){activityFilter=ACTIVITY_CATEGORIES.includes(v)?v:"all";activityLimit=100;render();return}
  if(a==="activity-more"){activityLimit+=100;render();return}
  if(a==="liquidate-target"){const input=document.getElementById("liquidation-target");liquidateFromDesk(Number(input?.value),id||null);return}
  if(a==="focus-liquidation"){const input=document.getElementById("liquidation-target");document.getElementById("fleet-liquidation")?.scrollIntoView({behavior:"smooth",block:"start"});setTimeout(()=>input?.focus(),350);return}
  if(a==="starting-mode"){if(STARTING_MODES.some(mode=>mode.id===v)){introDifficulty=v;render()}return}
  if(a==="mobile-menu"){mobileMenuOpen=!mobileMenuOpen;render(false);return}
  if(a==="begin"){const mode=startingMode(introDifficulty);state.cash=1500;state.startingCash=1500;state.time=mode.start;state.campaignStart=mode.start;state.lastMonth=new Date(mode.start).toISOString().slice(0,7);state.difficulty=mode.id;state.started=true;state.seen=["genesis"];log("Campaign start selected",`${mode.label} · ${dateFmt(mode.start)}`,"operations");if(!state.startingGrant){state.points+=1;state.startingGrant=true;log("Genesis operator grant","+1 skill point")}state.speed=1;save();setTimer();render()}
  else if(a==="intro-next"){introStep=Math.min(INTRO_SLIDES.length-1,introStep+1);render()}
  else if(a==="intro-back"){introStep=Math.max(0,introStep-1);render()}
  else if(a==="claim-faucet")claimFaucet();
  else if(a==="start-learning")startLearning(id);
  else if(a==="learning-check")answerLearningCheck(v);
  else if(a==="order-parts")orderParts(id,Number(v));
  else if(a==="service-hw")serviceHardware(id);
  else if(a==="hardware-power")setHardwarePower(id,v==="on",Number(b.dataset.qty)||1);
  else if(a==="buy-cooling")buyCooling(id);
  else if(a==="custody-lesson"){custodyLesson=v;render()}
  else if(a==="patch-firmware")patchFirmware();
  else if(a==="node-storage")upgradeNodeStorage(Number(v));
  else if(a==="node-prune")toggleNodePruning();
  else if(a==="node-mode")setNodeMode(v);
  else if(a==="buy-backup-node")buyBackupNode();
  else if(a==="donate-btc")donateBtc(id,Number(v));
  else if(a==="buy-strategy")buyStrategy(id,Number(v));
  else if(a==="sell-strategy")sellStrategy(id,Number(v));
  else if(a==="contract")setContract(id);
  else if(a==="connectivity")setConnectivityPlan(id);
  else if(a==="treasury-policy")setTreasuryPolicy(id);
  else if(a==="settle-btc")payPendingWithBtc();
  else if(a==="settle-liquidate")liquidateForSettlement();
  else if(a==="settle-bridge")takeBridgeFinance();
  else if(a==="settle-receivership")enterReceivership();
  else if(a==="hire-staff")hireStaff(id);
  else if(a==="insurance")toggleInsurance();
  else if(a==="project-loan")takeProjectLoan();
  else if(a==="repay-loan")repayProjectLoan();
  else if(a==="speed"){state.speed=Number(v);state.returnSpeed=state.speed||state.returnSpeed;setTimer();save();render()}
  else if(a==="tab"){activeTab=v;mobileMenuOpen=false;render(false);window.scrollTo({top:0,behavior:"smooth"})}
  else if(a==="activate-hw")activateHardware(id);else if(a==="decommission-hw")decommissionHardware(id,Number(v));else if(a==="buy-hw")buyHardware(id,Number(v));else if(a==="buy-hw-btc")buyHardwareBtc(id,Number(v));else if(a==="sell-hw")sellHardware(id,Number(v));else if(a==="sell-hw-btc")sellHardwareBtc(id,Number(v));else if(a==="facility")upgradeFacility(id);else if(a==="region")moveRegion(id);else if(a==="buy-node")buyNode(Number(v));
  else if(a==="buy-btc")buyBtc(id,actionFraction(b));else if(a==="sell-btc")sellBtc(id,actionFraction(b));else if(a==="lightning")deployLightning(Number(v));else if(a==="lightning-withdraw")withdrawLightning();else if(a==="transfer")transfer(b.dataset.from,b.dataset.to,actionFraction(b));else if(a==="speculate")takeSpeculation(id,Number(v));else if(a==="skill")unlockSkill(id);
  else if(a==="mode"){if(state.mode!==v){state.mode=v;log(v==="pool"?"Pool mining selected":"Solo mining selected",v==="pool"?poolData().name:"No pool fee","operations")}save();render()}else if(a==="pool"){const selected=poolData(v);if(availablePool()&&selected&&poolEligible(selected)){state.pool=v;state.mode="pool";log("Mining pool changed",`${selected.name} · ${(poolFee()*100).toFixed(2)}% fee`,"operations");save();render()}}else if(a==="toggle-power"){state.power=!state.power;log(state.power?"Mining fleet started":"Mining fleet stopped","manual","operations");save();render()}
  else if(a==="pay-debt")payDebt();else if(a==="story"){state.activeEvent=id;state.eventResume=false;render()}
  else if(a==="close-event"){state.activeEvent=null;if(state.eventResume&&!state.pendingSettlement){state.speed=state.returnSpeed||1;state.eventResume=false}activateNextHardwareAlert();setTimer();save();render()}
  else if(a==="continue-run"){state.ended=false;state.endDismissed=true;state.sandbox=true;state.speed=state.returnSpeed||1;log("Sandbox continuation started","historical feed complete");save();setTimer();render()}
  else if(a==="close-end"){state.endDismissed=true;save();render()}else if(a==="story-pause"){state.storyPause=!state.storyPause;save();render()}
  else if(a==="reset")resetGame();else if(a==="export")exportSave();else if(a==="import")document.getElementById("importSave").click();
});
// A horizontally-scrollable tab strip can occasionally consume a touch click as a scroll gesture.
// Commit the selected tab on touch release, then ignore its synthetic click.
document.getElementById("app").addEventListener("pointerup",e=>{
  if(e.pointerType!=="touch")return;
  const b=e.target.closest('[data-action="tab"]');if(!b||b.disabled)return;
  recentTouchTab={value:b.dataset.value,at:Date.now()};activeTab=b.dataset.value;mobileMenuOpen=false;render(false);window.scrollTo({top:0,behavior:"smooth"});
});
document.getElementById("app").addEventListener("input",e=>{if(e.target.matches("[data-percent-input]"))updateTradePercentage(e.target.dataset.percentInput,e.target.value,e.target);else if(e.target.matches("[data-pool-history]"))updatePoolExplorer(Number(e.target.value))});
document.getElementById("app").addEventListener("change",e=>{if(e.target.matches("[data-hardware-quantity]")){const select=e.target,h=HARDWARE.find(item=>item.id===select.dataset.id),button=select.closest(".fiat-buy-actions")?.querySelector('[data-action="buy-hw"]'),qty=Math.max(1,Math.floor(Number(select.value)||1));if(h&&button){button.dataset.value=String(qty);button.textContent=`Buy ${fmtCompactNumber(qty)} · ${fmtCompactUsd(hardwareUnitCost(h)*qty)}`}return}if(e.target.id==="importSave"&&e.target.files&&e.target.files[0])importSave(e.target.files[0])});
document.getElementById("app").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches(".story-item"))e.target.click()});
