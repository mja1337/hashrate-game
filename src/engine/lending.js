"use strict";

/* LENDING — borrowing against the bitcoin itself, and what it costs to be the one who holds it.

   The operating loan is secured on fiat and a record of mining revenue. This one is secured on the
   coins, which is cheaper and is also the only way to raise money from a reserve without selling it.
   There are two ways to do it, and they are the two ways it has really been done:

     COLLABORATIVE CUSTODY   The lender holds ONE key of your 2-of-3. It can co-sign nothing without
                             you, so it cannot run off with the coins, and it cannot take them
                             without the loan going unpaid. It needs a wallet a lender will sign for
                             (strong posture), the coins have to be swept into it, which is a signing
                             with a real fee and days, and in exchange it lends more, charges least,
                             and its failure does not touch your coins.

     FULL-CUSTODY PLEDGE     You send the coins to the lender. It needs nothing of you and happens
                             at once from the hot wallet. It lends less, costs more, and the coins
                             are now a claim on a company, which is the position every customer of
                             a lender that has failed has found themselves in.

   The price of bitcoin is the third party. The loan is a fixed sum against coins that move, so a fall
   raises the share of their value that is owed. Past a first line the lender calls the loan and you
   have two weeks to repay it or add coins; past a second, or after those two weeks, it sells enough of
   the collateral to clear the debt and a penalty, whatever the price is.

   Interest joins the monthly bill through financeInterestMonthly(), with the operating loan's.
   Pledged coins count as yours (total BTC, net worth) and as nobody's to spend: they are not in
   controlled() and not a claim on a venue.

   Loaded after credit.js; nothing here runs before the page has finished parsing. */

const SECURED_START=Date.parse("2018-06-01T00:00:00Z");   // when lenders first offered credit against bitcoin
const SECURED_MODES={
  collaborative:{id:"collaborative",name:"Collaborative custody",ltv:.5,rate:.007,callLtv:.8,liqLtv:.9},
  pledge:{id:"pledge",name:"Full-custody pledge",ltv:.4,rate:.010,callLtv:.75,liqLtv:.85}
};
const SECURED_CALL_DAYS=14,SECURED_PENALTY=.05,SECURED_AUDIT_DISCOUNT=.001,SECURED_BUFFER=1.03;

/* ---- reading the loan ---------------------------------------------------------------------- */

function securedLoan(s=state){
  const l=s.securedLoan;
  return l&&typeof l==="object"&&SECURED_MODES[l.mode]&&Number.isFinite(l.principal)&&Number.isFinite(l.pledged)?l:null;
}
function securedPrincipal(s=state){const l=securedLoan(s);return l?l.principal:0}
/* Coins in a lender's hands, including those on their way. They are the borrower's and nobody's to spend. */
function securedPledgedBtc(s=state){const l=securedLoan(s);return l?l.pledged+(l.pending?l.pending.gross:0):0}
function securedInterestMonthly(s=state){const l=securedLoan(s);return l?l.principal*l.rate:0}
function securedLtv(s=state){
  const l=securedLoan(s);if(!l||l.pledged<=0||s.time<MARKET)return 0;
  return l.principal/(l.pledged*priceAt(s.time));
}
function securedRate(mode,s=state){
  // A lender that can see an audited wallet is lending against less risk.
  return Math.max(0,SECURED_MODES[mode].rate-(mode==="collaborative"&&custodyPosture(s).tier==="audited"?SECURED_AUDIT_DISCOUNT:0));
}

/* ---- what is on offer ------------------------------------------------------------------------- */

/* What borrowing would do if a fraction of the coins this lender can hold were pledged. */
function securedQuote(mode,fraction,s=state){
  const m=SECURED_MODES[mode],bucket=mode==="collaborative"?"cold":"hot",gross=(s.wallets[bucket]||0)*fraction;
  const fee=bucket==="cold"?transferNetworkFee("cold",fraction,{},s):flatNetworkFee(s);
  const pledged=Math.max(0,gross-fee),price=s.time>=MARKET?priceAt(s.time):0;
  return{mode,bucket,fraction,gross,fee,pledged,principal:pledged*price*m.ltv,rate:securedRate(mode,s),
    days:bucket==="cold"?coldSpendDays(s)+1:0,ltv:m.ltv};
}
function securedBlockReason(mode,s=state,opts={}){
  const m=SECURED_MODES[mode];if(!m)return "Unknown lender.";
  if(s.time<SECURED_START)return `Nobody lends against bitcoin until ${dateFmt(SECURED_START,true)}.`;
  if(s.time<MARKET)return "There is no market to value the coins in.";
  if(securedLoan(s))return "You already have a loan against your coins. Repay it first.";
  if(mode==="collaborative"){
    const set=custodySetup(s);
    if(set.policy.threshold<2)return "A collaborative loan needs a quorum wallet, because the lender holds one of its keys.";
    if(!set.ready||!set.configOk)return "Finish the quorum wallet first: every key assigned and its configuration written down.";
    const posture=custodyPosture(s);
    if(posture.rank<2)return `A lender will not co-sign a wallet that is not at least strong. ${(posture.findings.find(f=>f.blocks==="strong"||f.blocks==="basic")||{}).text||""}`.trim();
    if((s.wallets.cold||0)<=0)return "There are no coins in cold storage to pledge.";
    const sign=coldSpendBlockReason(s,{settling:!!opts.settling});if(sign)return sign;
  } else if((s.wallets.hot||0)<=0)return "There are no coins in the hot wallet to pledge.";
  return "";
}

/* ---- borrowing ----------------------------------------------------------------------------------- */

function borrowSecured(mode,fraction,opts={}){
  const reason=securedBlockReason(mode,state,opts);
  if(reason)return showToast("Cannot borrow",reason,"bad","custody");
  fraction=Math.min(1,Math.max(.01,Number(fraction)||0));
  const q=securedQuote(mode,fraction);
  if(q.pledged<=0||q.principal<=0)return showToast("Too small",`The ${fmtBtc(q.fee)} network fee is more than the coins being pledged.`,"bad","custody");
  utxoConsume(q.bucket,fraction);
  state.wallets[q.bucket]-=q.gross;
  const loan={mode,principal:0,pledged:0,rate:q.rate,since:state.time,call:null};
  if(q.days>0)loan.pending={gross:q.pledged,principal:q.principal,due:state.time+q.days*DAY,started:state.time};
  else{loan.pledged=q.pledged;loan.principal=q.principal;state.cash+=q.principal}
  state.securedLoan=loan;
  const m=SECURED_MODES[mode];
  log(`Borrowed against ${fmtBtc(q.pledged)}`,`${fmtUsd(q.principal)} · ${m.name} · ${(q.rate*100).toFixed(1)}% a month${q.days?` · arrives in ${q.days} days`:""}`,"custody");
  showToast("Loan agreed",q.days
    ?`${fmtBtc(q.pledged)} is being swept into a wallet the lender co-signs. ${fmtUsd(q.principal)} arrives in ${q.days} days, when the coins are in place.`
    :`${fmtUsd(q.principal)} is in your account against ${fmtBtc(q.pledged)} now held by the lender.`,"success","custody");
  save();render();
  return loan;
}
/* Returning the coins. A lender that holds one key co-signs them back, which is a journey like any other. */
function returnPledge(mode,btc){
  if(btc<=0)return;
  if(mode==="collaborative"){
    const days=coldSpendDays()+1,fee=Math.min(btc,sweepFeeBtc(1,1,true));
    coldSpends().push({to:"cold",gross:btc,fee,due:state.time+days*DAY,started:state.time,days,purpose:"release"});
  } else {state.wallets.hot+=btc;utxoAdd("hot")}
}
function repaySecuredLoan(){
  const l=securedLoan();if(!l)return;
  if(l.pending)return showToast("Wait for the coins","The pledge is still on its way, so the loan cannot be settled yet.","bad","custody");
  if(state.cash<l.principal)return showToast("Not enough cash",`Repaying costs ${fmtUsd(l.principal)} and you have ${fmtUsd(state.cash)}.`,"bad","custody");
  state.cash-=l.principal;
  returnPledge(l.mode,l.pledged);
  state.securedLoan=null;
  log("Loan against coins repaid",`${fmtUsd(l.principal)} · ${fmtBtc(l.pledged)} returned`,"custody");
  showToast("Loan repaid",l.mode==="collaborative"?`${fmtBtc(l.pledged)} will be co-signed back to your cold storage.`:`${fmtBtc(l.pledged)} is back in your hot wallet.`,"success","custody");
  save();render();
}
/* More coins against the same loan, which is what a margin call asks for. */
function addSecuredCollateral(fraction){
  const l=securedLoan();if(!l)return showToast("No loan","There is nothing to add collateral to.","bad","custody");
  if(l.pending)return showToast("Wait for the coins","The first pledge is still on its way.","bad","custody");
  const bucket=l.mode==="collaborative"?"cold":"hot";
  if((state.wallets[bucket]||0)<=0)return showToast("Nothing to add",`There are no coins in ${bucket==="cold"?"cold storage":"the hot wallet"}.`,"bad","custody");
  if(l.mode==="collaborative"){const sign=coldSpendBlockReason();if(sign)return showToast("Cannot add collateral",sign,"bad","custody")}
  fraction=Math.min(1,Math.max(.01,Number(fraction)||0));
  const q=securedQuote(l.mode,fraction);
  if(q.pledged<=0)return showToast("Too small","The network fee is more than the coins being added.","bad","custody");
  utxoConsume(bucket,fraction);state.wallets[bucket]-=q.gross;
  if(q.days>0)l.pending={gross:q.pledged,principal:0,due:state.time+q.days*DAY,started:state.time};
  else l.pledged+=q.pledged;
  log(`Added ${fmtBtc(q.pledged)} as collateral`,q.days?`arrives in ${q.days} days`:"at once","custody");
  showToast("Collateral added",q.days?`${fmtBtc(q.pledged)} is on its way to the lender's co-signed wallet and counts in ${q.days} days.`:`${fmtBtc(q.pledged)} now backs the loan.`,"info","custody");
  save();render();
}

/* ---- the price moves ---------------------------------------------------------------------------- */

function liquidateSecured(why,next=state.time){
  const l=securedLoan();if(!l)return;
  const price=priceAt(next),owed=l.principal*(1+SECURED_PENALTY),sold=Math.min(l.pledged,owed/price),left=l.pledged-sold;
  state.securedLoan=null;
  returnPledge(l.mode,left);
  log("Collateral sold by the lender",`-${fmtBtc(sold)} at ${fmtUsd(price)} · loan cleared`,"custody");
  reportCoinLoss({title:"Your lender sold your collateral",kind:"seized",btc:sold,cause:"margin",from:"coins pledged against a loan",
    what:`${why==="call"?"The margin call was not met in time.":"The price fell through the lender's second line."} It sold ${fmtBtc(sold)} at ${fmtUsd(price)} to clear ${fmtUsd(l.principal)} and a ${Math.round(SECURED_PENALTY*100)}% penalty. ${left>0?`${fmtBtc(left)} came back to you.`:"Nothing was left to return."}`,
    why:"The loan was a fixed sum against coins that move. A fall raised the share of their value that was owed, and past a point a lender does not wait for the price to come back.",
    remedy:"Borrow well below the limit, so the price has to fall a long way, and keep cash to repay or coins to add. A margin call gives two weeks and no more.",tab:"custody"});
}
function advanceSecuredLoan(next,silent=false){
  const l=securedLoan();if(!l)return;
  if(l.pending&&!pendingAt(l.pending,next)){
    l.pledged+=l.pending.gross;
    if(l.pending.principal>0){l.principal+=l.pending.principal;state.cash+=l.pending.principal}
    log("Pledge arrived",`${fmtBtc(l.pending.gross)} in place${l.pending.principal>0?` · ${fmtUsd(l.pending.principal)} paid out`:""}`,"custody");
    if(!silent)showToast("Pledge in place",l.pending.principal>0?`${fmtUsd(l.pending.principal)} is in your account.`:`${fmtBtc(l.pending.gross)} now backs the loan.`,"success","custody");
    l.pending=null;renderFullQueued=true;
  }
  if(next<MARKET||l.pledged<=0)return;
  const m=SECURED_MODES[l.mode],ltv=l.principal/(l.pledged*priceAt(next));
  if(ltv>=m.liqLtv){liquidateSecured("crash",next);return}
  if(ltv>m.callLtv){
    if(!l.call){
      l.call={since:next,until:next+SECURED_CALL_DAYS*DAY};
      log("Margin call",`The loan is at ${Math.round(ltv*100)}% of the collateral's value · ${SECURED_CALL_DAYS} days`,"custody");
      if(!silent)showToast("Margin call",`The price has fallen and your loan is now ${Math.round(ltv*100)}% of the coins' value. Repay it or add coins within ${SECURED_CALL_DAYS} days, or the lender sells.`,"bad","custody");
    } else if(next>=l.call.until)liquidateSecured("call",next);
  } else if(l.call&&ltv<=m.callLtv*.95){
    l.call=null;log("Margin call cured","The price recovered","custody");
    if(!silent)showToast("Margin call cured","The price has recovered enough that the lender no longer asks for more.","success","custody");
  }
}

/* ---- the lender fails -------------------------------------------------------------------------- */

/* Celsius, June 2022. A lender is a company, and what its customers held was a claim on it. A
   pledge sent to it is exactly that; coins in a wallet where it held one key of three never were. */
function applyLenderFailure(){
  const l=securedLoan();if(!l)return;
  if(l.mode==="collaborative"){
    log("Your lender failed","It held one key of three. Your coins did not move and the loan was sold on","custody");
    showToast("Your lender failed, and your coins did not move","It held one key of your quorum, so it could not have taken them. The loan carries on with whoever bought it.","success","custody");
    return;
  }
  const lost=l.pledged*.3,frozen=l.pledged*.7;
  state.wallets.frozen+=frozen;state.securedLoan=null;
  // The debt does not go away with the collateral. It becomes ordinary borrowing, at the ordinary rate.
  state.projectLoan+=l.principal;
  log("Your lender froze withdrawals",`-${fmtBtc(lost)} · ${fmtBtc(frozen)} frozen · ${fmtUsd(l.principal)} now owed as ordinary debt`,"custody");
  reportCoinLoss({title:"The lender that held your coins froze",kind:"counterparty",btc:lost,recovered:frozen,cause:"lenders",from:"coins pledged to a lender",
    what:`${fmtBtc(frozen)} is frozen as a claim in the lender's bankruptcy and ${fmtBtc(lost)} is written off. You still owe ${fmtUsd(l.principal)}, now as ordinary borrowing at the ordinary rate.`,
    why:"Coins sent to a lender stop being coins you hold and become a claim on the company. Its failure took the collateral and left the debt.",
    remedy:"Borrow in collaborative custody, where the lender holds one key of several and cannot move the coins, or do not leave coins with a company that you have not seen the books of.",tab:"custody"});
}

/* ---- paying a bill with it ------------------------------------------------------------------------ */

/* How much would have to be pledged to cover the bill that is waiting, and what that would do. */
function settlementBorrowPlan(mode,s=state){
  const p=s.pendingSettlement;if(!p||s.time<MARKET)return null;
  const m=SECURED_MODES[mode],need=Math.max(0,p.due-s.cash),bucket=mode==="collaborative"?"cold":"hot",held=s.wallets[bucket]||0;
  if(held<=0)return null;
  const wantBtc=need/(priceAt(s.time)*m.ltv)*SECURED_BUFFER,fraction=Math.min(1,Math.max(.01,wantBtc/held)),q=securedQuote(mode,fraction,s);
  return{...q,need,covers:q.principal>=need-1e-6};
}
function borrowForSettlement(mode){
  const reason=securedBlockReason(mode,state,{settling:true});
  if(reason)return showToast("Cannot borrow",reason,"bad","custody");
  const plan=settlementBorrowPlan(mode);if(!plan)return;
  if(mode==="collaborative"){
    // The coins need days to be co-signed into place and the clock is stopped, so carry the bill into the grace month first.
    if(state.debt>0)return showToast("Cannot borrow",
      "You are already carrying arrears. Missing a second bill cuts the grid, so raise this one another way.","bad","custody");
    deferSettlement();
    borrowSecured(mode,plan.fraction);
    return;
  }
  if(!borrowSecured(mode,plan.fraction,{settling:true}))return;
  if(state.pendingSettlement&&state.cash>=state.pendingSettlement.due)finishMonthlySettlement("secured");
}
