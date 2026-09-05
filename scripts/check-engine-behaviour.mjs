/* BEHAVIOURAL CONTRACTS — these run the engine and assert what it DOES.

   The other suite matches source text, which is fast and catches a great deal, but it pins
   the implementation rather than the rule: three checks broke during one refactoring session
   while the behaviour they guarded was perfectly intact, because a function had been renamed
   or an expression had moved. Everything asserted here would survive any such move and fail
   only if the game's economics actually changed. Prefer adding rules here over adding another
   source match whenever a check is about what the simulation does rather than how it reads. */

import { loadEngine, makeEval } from "./engine-harness.mjs";

const ev = makeEval(loadEngine());
const run = expr => ev(expr);
const json = expr => JSON.parse(ev(`JSON.stringify(${expr})`));

let checked = 0;
const failures = [];
function rule(name, fn) {
  checked += 1;
  try { fn(); } catch (error) { failures.push(`${name}: ${error.message}`); }
}
function assert(condition, message) { if (!condition) throw new Error(message); }
function close(actual, expected, tolerance, message) {
  assert(Math.abs(actual - expected) <= tolerance, `${message} (got ${actual}, wanted ${expected}±${tolerance})`);
}

/* A standard site, so each rule states only what it is actually varying. */
const SITE = (overrides = "") => `
  state.started=true;state.skills=[];state.staff=[];state.insured=false;state.overdrive=false;
  state.ended=false;state.endReason=null;state.endDismissed=true;state.activeEvent=null;state.storyPause=false;
  state.mode="pool";state.pool="foundry";state.connectivity="fixed";state.contract="spot";
  state.node=0;state.cash=1e9;state.debt=0;state.power=true;state.policyLock=null;
  state.hardwareGlut=null;state.marketPressure={usd:0,at:0};
  state.ops={firmwarePatchedUntil:1e15,hijackUntil:0,outageUntil:0,powerOutageUntil:0,venueFreezes:{},riskMonth:""};
  state.thermal={temperature:22,orders:[],equipment:{}};
  state.maintenance={condition:{},faults:{},faultsByPart:{},selfRepairs:{},parts:0,
    inventory:state.maintenance.inventory,orders:[],serviceJobs:[]};
  ${overrides}`;

/* ---- PROTOCOL: rules Bitcoin itself enforces, which the game may never bend ---- */

rule("the subsidy halves on whole satoshis", () => {
  const sats = json(`[["2009-01-03",5000000000],["2012-11-29",2500000000],["2016-07-10",1250000000],
    ["2020-05-12",625000000],["2024-04-20",312500000]].map(([d,want])=>[d,subsidySatsAt(at(d)),want])`);
  for (const [date, actual, want] of sats) {
    assert(actual === want, `subsidy at ${date} is ${actual}, not ${want}`);
    assert(Number.isInteger(actual), `subsidy at ${date} is not a whole number of satoshis`);
  }
});

rule("the subsidy grinds down to one satoshi and then to nothing", () => {
  assert(run(`subsidySatsAt(at("2009-01-03"))`) === 5000000000, "genesis subsidy is wrong");
  // Integer division ends the issuance schedule exactly, and it ends late: 32 halvings still
  // leave a single satoshi, and only the 33rd takes it to zero.
  assert(run(`subsidySatsAt(at("2140-01-01"))`) === 1, "the 32nd halving should still pay one satoshi");
  assert(run(`subsidySatsAt(at("2144-01-01"))`) === 0, "the subsidy never reaches zero");
  assert(run(`subsidySatsAt(at("2200-01-01"))`) === 0, "the subsidy comes back after reaching zero");
});

rule("difficulty only changes at a recorded retarget", () => {
  const changes = run(`(()=>{let t=at("2016-01-01"),prev=difficultyAt(t),changes=0;
    for(let i=0;i<365;i++){t+=DAY;const d=difficultyAt(t);if(d!==prev){changes++;prev=d}}return changes})()`);
  assert(changes > 20 && changes < 40, `difficulty changed ${changes} times in 2016; a 2016-block retarget is roughly 26 a year`);
});

/* ---- ORDER-BOOK DEPTH: an early fortune must not be a liquid one ---- */

rule("a large sale into a thin market moves the price against you", () => {
  const impact = run(`(()=>{${SITE(`state.time=at("2010-12-01");`)}
    return tradeImpact(40400*priceAt(state.time),1)})()`);
  assert(impact > 0.3, `dumping the idle windfall in Dec 2010 costs only ${(impact * 100).toFixed(1)}% — the book is too deep`);
});

rule("the same order is invisible once the market is deep", () => {
  const impact = run(`(()=>{${SITE(`state.time=at("2026-08-01");`)}
    return tradeImpact(1000*priceAt(state.time),1)})()`);
  assert(impact < 0.02, `a 1,000 BTC sale at the cutoff costs ${(impact * 100).toFixed(2)}%, which is too punitive for a deep market`);
});

rule("slicing an order does not dodge the impact", () => {
  const ratio = run(`(()=>{${SITE(`state.time=at("2010-12-01");`)}
    const total=40400*priceAt(state.time);
    const oneShot=total*(1-tradeImpact(total,1));
    state.marketPressure={usd:0,at:0};
    let sliced=0;
    for(let i=0;i<100;i++){const q=total/100;sliced+=q*(1-tradeImpact(q,1));addPressure(q,1)}
    return sliced/oneShot})()`);
  assert(ratio < 2, `slicing into 100 orders returns ${ratio.toFixed(2)}x the proceeds; standing pressure is not accumulating`);
});

/* ---- POWER CONTRACTS: four options, none of them dead ---- */

rule("every power contract is the best choice somewhere", () => {
  const winners = json(`(()=>{
    const seen={};
    for(const d of ["2017-06-01","2021-06-01","2022-06-01","2023-01-01","2024-06-01"]){
      for(const [reg,fac,hw,n] of [["iceland","campus","s19",1200],["texas","campus","s19",1200],
                                   ["na","warehouse","s9",120],["sichuan","campus","s19",1500]]){
        if(at(d)<at("2017-01-01"))continue;
        let best=null;
        for(const c of POWER_CONTRACTS){
          ${SITE(``)}
          state.time=at(d);state.facility=fac;state.region=reg;state.hardware={[hw]:n};state.contract=c.id;
          const f=fleet(),mc=monthlyCost();
          const p=expectedDailyBtcForHash(f.hash)*contractUptimeFactor()*priceAt(state.time)*30.4375-mc.total;
          if(!best||p>best.p)best={id:c.id,p};
        }
        seen[best.id]=(seen[best.id]||0)+1;
      }
    }
    return seen;})()`);
  for (const id of ["spot", "fixed", "curtail"]) {
    assert(winners[id] > 0, `no scenario prefers the ${id} contract — it is a dead option (winners: ${JSON.stringify(winners)})`);
  }
});

rule("curtailment deepens when the grid is short", () => {
  const calm = run(`(()=>{${SITE(`state.time=at("2019-06-01");state.contract="curtail";`)}return curtailmentIntensity()})()`);
  const shock = run(`(()=>{${SITE(`state.time=at("2022-06-01");state.contract="curtail";`)}return curtailmentIntensity()})()`);
  assert(calm < 0.15, `curtailment gives up ${(calm * 100).toFixed(0)}% of load in a calm month`);
  assert(shock > calm * 3, `curtailment barely deepens during a shock (${(calm * 100).toFixed(0)}% -> ${(shock * 100).toFixed(0)}%)`);
});

rule("curtailment is paid for the capacity it releases", () => {
  const credit = run(`(()=>{${SITE(`state.time=at("2022-06-01");state.facility="campus";state.region="texas";
    state.hardware={s19:600};state.contract="curtail";`)}
    const f=fleet();return curtailmentCreditDaily(f.w*contractLoadFactor())})()`);
  assert(credit > 0, "releasing capacity during a shock earns nothing, which is the only reason anyone signs the contract");
});

rule("the credit never turns the operating bill negative", () => {
  const worst = run(`(()=>{let worst=Infinity;
    for(const [reg,fac,hw,n] of [["iran","campus","s19",2700],["sichuan","megacampus","s21xp",49000],
                                 ["texas","hydroplant","s19",20000]]){
      ${SITE(``)}
      state.time=at("2022-06-01");state.facility=fac;state.region=reg;state.hardware={[hw]:n};state.contract="curtail";
      worst=Math.min(worst,monthlyCost().total);
    } return worst})()`);
  assert(worst >= 0, `an operating bill went to ${Math.round(worst)}; settlement would pay the player`);
});

/* ---- CONNECTIVITY: three plans, three different jobs ---- */

rule("every connectivity plan is the best choice somewhere", () => {
  const winners = json(`(()=>{
    const seen={},h=HARDWARE.find(x=>x.id==="s21xp");
    for(const reg of ["na","iceland","sichuan","kazakhstan","texas","iran","kenya","bhutan"]){
      for(const f of FACILITIES){
        if(at(f.date)>at("2025-06-01"))continue;
        const cap=Math.max(0,Math.min(Math.floor(f.kw*1000/h.w),Math.floor(f.space/h.space)));
        if(!cap)continue;
        const n=Math.max(1,Math.round(cap*0.77));
        let best=null;
        for(const p of CONNECTIVITY_PLANS){
          ${SITE(``)}
          state.time=at("2025-06-01");state.facility=f.id;state.region=reg;
          state.hardware={s21xp:n};state.connectivity=p.id;
          const fs=fleet();
          const rev=expectedDailyBtcForHash(fs.hash)*priceAt(state.time)*30.4375;
          const value=(p.payout-1)*rev-internetMonthlyCost()
            -rev*(connectivityIncidentRisk()*3*(p.failover??1)/30.4375);
          if(!best||value>best.v)best={id:p.id,v:value};
        }
        seen[best.id]=(seen[best.id]||0)+1;
      }
    }
    return seen;})()`);
  for (const id of ["fixed", "sim", "fiber"]) {
    assert(winners[id] > 0, `no site prefers the ${id} plan — it is a dead option (winners: ${JSON.stringify(winners)})`);
  }
});

rule("a failover link's outages are measured in hours, not days", () => {
  // Measured by running the clock, not by reading the plan table: the table can declare a
  // failover the tick never applies, and a source match cannot see that gap.
  //
  // The assertion is on the LENGTH of each outage rather than on total downtime, because the
  // two arms consume the random stream differently and so do not see the same incidents.
  // Comparing aggregate downtime made this rule pass with the failover deleted, purely
  // because one arm drew fewer outages than the other.
  const measured = json(`(()=>{
    const out={};
    for(const plan of ["fixed","sim"]){
      ${SITE(``)}
      // Sichuan from 2014 leaves room for 4,000 days inside the campaign, at a 3.5% monthly
      // fault rate — frequent enough that both arms see several incidents.
      state.time=at("2014-06-01");state.facility="warehouse";state.region="sichuan";
      state.hardware={s5:100};state.connectivity=plan;state.seed=12345;state.rng=12345;
      const spells=[];let days=0;const startedAt=state.time;
      for(let d=0;d<4000;d++){
        const before=state.ops.outageUntil;
        tick();
        if(state.time>startedAt+days*DAY)days++;
        if(state.ops.outageUntil&&state.ops.outageUntil!==before&&state.ops.outageUntil>state.time)
          spells.push((state.ops.outageUntil-state.time)/DAY);
      }
      out[plan]={spells,days};
    }
    return out;})()`);
  for (const plan of ["fixed", "sim"]) {
    assert(measured[plan].days > 3000, `the ${plan} arm only advanced ${measured[plan].days} days, so this rule proves nothing`);
    assert(measured[plan].spells.length > 1, `the ${plan} arm saw ${measured[plan].spells.length} outages in 4,000 days, so this rule proves nothing`);
  }
  const longestFailover = Math.max(...measured.sim.spells);
  const longestFixed = Math.max(...measured.fixed.spells);
  assert(longestFailover < 1,
    `a dual-SIM outage ran ${longestFailover.toFixed(1)} days; a backup link that takes days to carry traffic is not a backup link`);
  assert(longestFixed >= 1,
    `a fixed-broadband outage only ran ${longestFixed.toFixed(1)} days, so the comparison proves nothing`);
  const sim = json(`CONNECTIVITY_PLANS.find(p=>p.id==="sim")`);
  assert(sim.payout >= 1, "dual-SIM charges a standing revenue penalty for a link the site is not normally using");
});

/* ---- HARDWARE: newest wins on dear power, cheap-and-old wins on cheap power ---- */

rule("hardware prices fall after release", () => {
  const path = json(`(()=>{const h=HARDWARE.find(x=>x.id==="s9");const out=[];
    for(const d of ["2017-06-01","2019-06-01","2021-06-01","2025-06-01"]){
      ${SITE(``)} state.time=at(d);out.push(Math.round(hardwareUnitCost(h)));}
    return out})()`);
  for (let i = 1; i < path.length; i += 1) {
    assert(path[i] < path[i - 1], `the S9 did not get cheaper between samples: ${path.join(" -> ")}`);
  }
  assert(path[path.length - 1] < path[0] * 0.2, `the S9 only fell to ${path[path.length - 1]} from ${path[0]}`);
});

rule("a machine cannot be bought and immediately resold at a profit", () => {
  const worst = run(`(()=>{let worst=0;
    for(const h of HARDWARE.filter(x=>!x.permanent)){
      for(const age of [0.5,1,2,3,4,6,9]){
        const t=at(h.date)+age*365*DAY; if(t>END)continue;
        ${SITE(``)} state.time=t;
        const buy=hardwareUnitCost(h),sell=resaleHardwareValue(h);
        if(buy>0)worst=Math.max(worst,sell/buy);
      }
    } return worst})()`);
  assert(worst < 1, `a machine resells for ${worst.toFixed(2)}x what it costs to buy`);
});

rule("the newest machine still wins where power is expensive", () => {
  const best = run(`(()=>{${SITE(`state.time=at("2025-06-01");state.facility="campus";state.region="na";`)}
    const t=state.time;
    const avail=HARDWARE.filter(h=>t>=at(h.date)&&!h.permanent);
    const scored=avail.map(h=>{
      ${SITE(``)} state.time=t;state.facility="campus";state.region="na";state.hardware={[h.id]:1};
      const f=fleet();
      const net=expectedDailyBtcForHash(f.hash)*contractUptimeFactor()*priceAt(t)
                -dailyEnergyCostForWatts(f.w*contractLoadFactor(),t,region());
      return {id:h.id,pay:net>0?hardwareUnitCost(h)/net:Infinity};
    }).sort((a,b)=>a.pay-b.pay);
    const newest=avail.slice().sort((a,b)=>at(b.date)-at(a.date))[0];
    return scored[0].id===newest.id})()`);
  assert(best === true, "on expensive power an older machine now out-earns the newest, which is not how mining works");
});

rule("an old machine bought cheap can win where power is cheap", () => {
  const older = run(`(()=>{
    const t=at("2025-06-01");
    const avail=HARDWARE.filter(h=>t>=at(h.date)&&!h.permanent);
    const scored=avail.map(h=>{
      ${SITE(``)} state.time=t;state.facility="campus";state.region="iran";state.hardware={[h.id]:1};
      const f=fleet();
      const net=expectedDailyBtcForHash(f.hash)*contractUptimeFactor()*priceAt(t)
                -dailyEnergyCostForWatts(f.w*contractLoadFactor(),t,region());
      return {id:h.id,pay:net>0?hardwareUnitCost(h)/net:Infinity};
    }).sort((a,b)=>a.pay-b.pay);
    const newest=avail.slice().sort((a,b)=>at(b.date)-at(a.date))[0];
    return scored[0].id!==newest.id})()`);
  assert(older === true, "on the cheapest power in the game the newest machine is still the only answer");
});

rule("a used machine arrives worn but never pre-broken", () => {
  const worst = run(`(()=>{let worst=100;
    for(const h of HARDWARE.filter(x=>!x.permanent)){
      const t=Math.min(END,at(h.date)+9*365*DAY);
      ${SITE(``)} state.time=t;
      worst=Math.min(worst,incomingConditionFor(h));
    } return worst})()`);
  assert(worst >= 66, `a used machine can arrive at ${worst}% condition, below the 65% threshold that takes a type offline`);
  assert(worst < 100, "age does not affect the condition a machine arrives in");
});

/* ---- CUSTODY: where coins sit has to matter ---- */

rule("cold storage is safe and a hot wallet is not", () => {
  const risks = json(`(()=>{
    const out={};
    for(const [label,hot,cold] of [["allHot",100,0],["half",50,50],["allCold",0,100]]){
      ${SITE(``)}
      state.time=at("2014-01-01");
      state.wallets={hot,cold,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
      out[label]={monthly:hotWalletIncidentRisk(),annual:hotWalletAnnualRisk()};
    }
    return out;})()`);
  assert(risks.allCold.monthly === 0, "cold storage carries a key-compromise risk, which is not what cold storage means");
  assert(risks.allHot.monthly > 0, "a fully hot wallet carries no risk at all, so custody placement is free");
  assert(risks.half.monthly < risks.allHot.monthly, "moving coins to cold storage does not reduce the risk");
  // The roll is gated to one per calendar month, so the annual figure must compound 12 times
  // rather than 365. A daily roll of a monthly rate would be thirty times too punishing.
  close(risks.allHot.annual, 1 - Math.pow(1 - risks.allHot.monthly, 12), 1e-9,
    "the annual risk does not compound as a monthly roll");
});

rule("the venues that failed can still take coins off you", () => {
  const wired = json(`["mtgox","bitfinexhack","quadriga","ftx"].map(id=>{
    const e=EVENTS.find(x=>x.id===id);
    return {id,found:!!e,fx:e?e.fx||null:null};
  })`);
  for (const row of wired) {
    assert(row.found, `the ${row.id} collapse is missing from the timeline`);
    assert(row.fx, `${row.id} has no effect wired to it, so holding a balance there is free`);
  }
});

/* ---- SECURITIES: the instruments must behave as advertised ---- */

rule("each security's price tracks the BTC sensitivity it advertises", () => {
  const rows = json(`STRATEGY_SECURITIES.map(s=>{
    const t0=at(s.date),t1=Math.min(END,t0+300*DAY);
    state.time=t0;const p0=strategyPrice(s.id);
    state.time=t1;const p1=strategyPrice(s.id);
    const btc=priceAt(t1)/priceAt(t0)-1;
    return {ticker:s.ticker,declared:s.btcBeta,implied:btc?((p1/p0-1)/btc):null};
  })`);
  for (const row of rows) {
    assert(row.implied !== null, `${row.ticker} has no tradable window to price against`);
    close(row.implied, row.declared, .02, `${row.ticker} moves at beta ${row.implied.toFixed(2)} against a declared ${row.declared}`);
  }
});

rule("each security pays the yield it advertises", () => {
  const rows = json(`(()=>{
    const out=[];
    for(const sec of STRATEGY_SECURITIES){
      ${SITE(``)}
      // Held at a home site with no fleet and deep cash, so the run cannot end early and
      // drag the measurement down — an earlier version of this went bankrupt at day 172
      // and reported a 10% instrument paying 4.7%.
      state.time=at(sec.date)+DAY;state.facility="home";state.region="na";
      state.hardware={};state.cash=1e9;
      state.strategy={mstr:0,strk:0,strf:0,strd:0,strc:0,yieldEarned:0};
      state.strategy[sec.id]=1000;
      const notional=1000*strategyPrice(sec.id);
      let days=0;
      for(let d=0;d<365;d++){const before=state.time;tick();if(state.time>before)days++}
      out.push({ticker:sec.ticker,declared:sec.yield*100,
        effective:100*state.strategy.yieldEarned/notional,days,ended:!!state.ended});
    }
    return out;})()`);
  for (const row of rows) {
    assert(row.days === 365 && !row.ended, `the ${row.ticker} measurement only ran ${row.days} days, so it proves nothing`);
    // Accrual is on the live price, so a year of drift moves the realised rate a little.
    close(row.effective, row.declared, 1.5, `${row.ticker} advertises ${row.declared}% and paid ${row.effective.toFixed(2)}%`);
  }
});

/* ---- COOLING: a ladder where every rung is a trade-off ---- */

rule("no cooling plant is beaten on both cost and efficiency at the same tier", () => {
  const problems = json(`(()=>{
    const out=[];
    for(let tier=1;tier<=FACILITIES.length;tier++){
      const avail=COOLING_EQUIPMENT.filter(c=>tier>=c.minTier&&tier<=c.maxTier);
      for(const a of avail)for(const b of avail){
        if(a===b)continue;
        const ac=a.cost/a.coolingKw,ae=a.coolingKw/(a.watts/1000);
        const bc=b.cost/b.coolingKw,be=b.coolingKw/(b.watts/1000);
        if(bc<=ac&&be>=ae&&(bc<ac||be>ae))out.push("tier "+tier+": "+a.id+" is beaten by "+b.id);
      }
    }
    return [...new Set(out)];})()`);
  assert(problems.length === 0, `a site can buy strictly better plant for less: ${problems.join("; ")}`);
});

rule("every facility tier can cool itself", () => {
  const orphans = json(`FACILITIES.map((f,i)=>i+1)
    .filter(tier=>!COOLING_EQUIPMENT.some(c=>tier>=c.minTier&&tier<=c.maxTier))`);
  assert(orphans.length === 0, `facility tiers with no cooling plant available: ${orphans.join(", ")}`);
});

/* ---- PROGRESSION: a skill the player pays for has to do something ---- */

rule("the treasury branch protects self-held coins", () => {
  const risks = json(`(()=>{
    const out={};
    for(const skills of [[],["backups"],["backups","counterparty","multisig"]]){
      ${SITE(``)}
      state.time=at("2014-01-01");state.skills=skills;
      state.wallets={hot:100,cold:100,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
      out[skills.length?skills.join("+"):"none"]=hotWalletIncidentRisk();
    }
    return out;})()`);
  assert(risks.backups < risks.none, "Key backups does not reduce the risk of losing self-held coins");
  assert(risks["backups+counterparty+multisig"] < risks.backups, "the full treasury branch adds nothing over its first skill");
});

/* ---- SETTLEMENT: the month boundary has to behave ---- */

rule("the treasury conversion raises exactly what the bill needs", () => {
  const rows = json(`(()=>{const out=[];
    for(const [d,hw,fac,due] of [["2010-12-01",{laptop:1},"home",50.7],["2013-06-01",{avalon:10},"warehouse",42000],
                                 ["2021-06-01",{s19:600},"campus",900000]]){
      ${SITE(``)}
      state.time=at(d);state.facility=fac;state.hardware=hw;state.region="texas";
      state.treasuryPolicy="cover";state.wallets.hot=5000;state.cash=0;
      treasurySaleForSettlement(due,true);
      out.push({due,cash:state.cash});
    } return out})()`);
  for (const row of rows) {
    close(row.cash, row.due, Math.max(0.01, row.due * 1e-6), `a ${row.due} bill was covered with ${row.cash}`);
  }
});

/* ---- REGIONS: cheap power must not simply be correct ---- */

rule("the cheapest power in the game is not automatically the best site", () => {
  const winner = run(`(()=>{let best=null;
    for(const r of REGIONS){
      if(at(r.date)>at("2021-06-01"))continue;
      ${SITE(``)}
      state.time=at("2021-06-01");state.facility="campus";state.region=r.id;state.hardware={s19:600};
      const f=fleet(),mc=monthlyCost();
      const rev=expectedDailyBtcForHash(f.hash)*priceAt(state.time)*30.4375;
      const losses=connectivityIncidentRisk()*rev*(3/30.4375)+rev*(1-(r.rely||1));
      const p=rev-mc.total-losses;
      if(!best||p>best.p)best={id:r.id,p,kwh:r.kwh};
    }
    const cheapest=REGIONS.filter(r=>at(r.date)<=at("2021-06-01")).sort((a,b)=>a.kwh-b.kwh)[0];
    return best.id===cheapest.id?"cheapest-wins":"trade-off";})()`);
  assert(winner === "trade-off", "the cheapest electricity is also the best site, so the region choice is a lookup");
});

if (failures.length) {
  console.error(`Engine behaviour: ${failures.length} of ${checked} rules failed\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`Engine behaviour passed: ${checked} rules exercised against a live engine — protocol issuance, order-book depth, power contracts, hardware pricing and resale, settlement, and regional trade-offs`);
