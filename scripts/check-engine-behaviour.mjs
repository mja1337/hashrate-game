/* BEHAVIOURAL CONTRACTS — these run the engine and assert what it DOES.

   The other suite matches source text, which is fast and catches a great deal, but it pins
   the implementation rather than the rule: three checks broke during one refactoring session
   while the behaviour they guarded was perfectly intact, because a function had been renamed
   or an expression had moved. Everything asserted here would survive any such move and fail
   only if the game's economics actually changed. Prefer adding rules here over adding another
   source match whenever a check is about what the simulation does rather than how it reads. */

import { loadEngine, makeEval } from "./engine-harness.mjs";

/* Loading a save runs the migration in simulation.js, which is parsed before maintenance.js.
   Anything that migration calls therefore has to be declared in a file that loads earlier —
   a rule that is invisible until someone opens a save old enough to take the branch. A save
   carrying legacy fault counts did exactly that: the migration called partFaultWeights(),
   which lived in maintenance.js, and the ReferenceError aborted the rest of simulation.js,
   leaving every const below that point uninitialised and the whole app dead on load. */
function loadWithSave(save) {
  try { return { ok: true, sandbox: loadEngine(save) }; }
  catch (error) { return { ok: false, message: error.message }; }
}

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
  /* And the engine's own random stream, which initialState() seeds from Math.random(). Without
     this every rule ran against a different world each time the suite was invoked, and any rule
     that ticks long enough became a coin flip: the racking rule failed once with three machines
     "missing" and then passed six runs in a row, which is the worst possible way for a suite to
     behave — it teaches you to re-run rather than to look. A rule that wants a different draw
     overrides this after SITE(), deliberately and visibly. */
  state.seed=20260909;state.rng=20260909;
  state.hardwareGlut=null;state.marketPressure={usd:0,at:0};
  state.ops={firmwarePatchedUntil:1e15,hijackUntil:0,outageUntil:0,powerOutageUntil:0,venueFreezes:{},riskMonth:""};
  state.thermal={temperature:22,orders:[],equipment:{}};
  state.maintenance={condition:{},faults:{},faultsByPart:{},selfRepairs:{},dryFit:{},parts:0,
    inventory:state.maintenance.inventory,orders:[],serviceJobs:[]};
  state.immersion={};
  /* Site and region are part of the standard site, not inherited from whatever ran last:
     facility tier feeds connectivity risk, power capacity and rent, so a rule that moved site
     used to quietly change the baseline for every rule after it. */
  state.facility="home";state.region="na";state.facilityUpgradeJob=null;state.relocationJob=null;
  /* And neither is history. These accumulate across rules and change how a tick behaves:
     an event already marked seen does not fire again, an alert already queued does not queue,
     and both change how many draws a day takes from the random stream. A rule that ticks for
     years therefore used to move the sample every rule after it saw — which is how a
     connectivity rule started failing because a payout rule was added above it. */
  /* Cumulative counters are the same hazard: state.mined and state.blocks carry across rules,
     so a rule guarding on "did this run earn anything" could be answered by a previous rule's
     earnings and then assert against its own empty wallet. */
  state.mined=0;state.blocks=0;
  state.seen=[];state.hardwareAlerts={seen:[],queue:[],active:null,resumeSpeed:0};
  state.secondary={stock:{},month:""};state.pendingLosses=[];state.lossResume=false;
  /* The physical fleet lifecycle resets too. These arrived late and SITE did not learn them,
     so rules cleared them by hand and whoever forgot inherited the last rule's crates: a
     stalled commissioning job would go on landing machines into the next rule's site, take it
     over capacity, and fail an assertion about something else entirely. Contamination that
     only appears under a mutant is worse than a bug, because it makes every result suspect. */
  state.commissioningJobs=[];state.procurementOrders=[];state.retirementJobs=[];
  state.inactiveHardware={};state.poweredDownHardware={};state.decommissionedHardware={};
  state.stagedCondition={};
  state.poolAccount={balance:0,frozen:0,threshold:.01,destination:"hot",paidTotal:0,feesPaid:0,payouts:0,lastPayout:0};
  ${overrides}`;

/* ---- WHAT THE TICK CHANGES, THE TICK HAS TO REDRAW ---- */

rule("a tick that changes the shape of a tab asks for the rebuild", () => {
  /* The tick's ordinary repaint is refreshLive(), which patches text and never rebuilds a tab.
     Only renderFullQueued makes it call renderMineContent(). Anything structural that forgets
     to raise it is drawn once and then frozen — which is how a repair row sat on "Reconnect ·
     0d left" while the job finished underneath it.

     Each advance is driven ON ITS OWN here, not through tick(): faults raise the flag most
     days, so a tick-level probe reports every one of these as fine while they are not. */
  const r = json(`(()=>{
    const base=()=>{${SITE(`state.time=at("2016-06-01");state.facility="warehouse";state.region="texas";
      state.maintenance.serviceJobs=[];state.maintenance.orders=[];
      state.commissioningJobs=[];state.procurementOrders=[];state.inactiveHardware={};`)}};
    const out=[];
    const probe=(label,setup,run,read)=>{
      base();setup();
      renderFullQueued=false;
      const before=JSON.stringify(read());
      state.time+=DAY;run();
      out.push({label,changed:JSON.stringify(read())!==before,asked:renderFullQueued===true});
    };
    probe("cooling install lands",
      ()=>{state.hardware={s9:50};state.thermal={temperature:22,orders:[{id:"axial",qty:1,due:state.time+DAY,cost:0}],equipment:{}}},
      ()=>advanceCoolingInstalls(),()=>state.thermal.equipment);
    probe("pool payout lands",
      ()=>{state.wallets.hot=0;state.poolAccount={balance:.5,frozen:0,threshold:.01,destination:"hot",paidTotal:0,feesPaid:0,payouts:0,lastPayout:0}},
      ()=>advancePoolPayouts(),()=>state.poolAccount.payouts);
    probe("second-hand listings refresh",
      ()=>{state.time=at("2019-06-01");state.secondary={stock:{},month:""}},
      ()=>advanceSecondaryMarket(state.time),()=>Object.keys(state.secondary.stock).length);
    probe("staged crates go into the racks",
      ()=>{state.time=at("2021-06-01");state.hardware={s19:1};state.inactiveHardware={s19:40};
        state.stagedCondition={};state.thermal={temperature:22,orders:[],equipment:{axial:1}}},
      ()=>advanceStagedIntake(),()=>state.commissioningJobs.length);
    probe("node reaches the chain tip",
      ()=>{state.node=1;state.nodeStorage=5000;state.nodeMode="full";
        state.nodeSync={primaryLag:1,primaryPeak:40,backupLag:0,backupPeak:0}},
      ()=>advanceNodeSync(true),()=>state.nodeSync.primaryLag);
    probe("node falls off the tip",
      ()=>{state.node=0;state.power=false;state.nodeSync={primaryLag:0,primaryPeak:0,backupLag:0,backupPeak:0}},
      ()=>advanceNodeSync(true),()=>state.nodeSync.primaryLag);
    probe("node already behind, falling further",
      ()=>{state.node=0;state.power=false;state.nodeSync={primaryLag:12,primaryPeak:40,backupLag:0,backupPeak:0}},
      ()=>advanceNodeSync(true),()=>state.nodeSync.primaryLag);
    probe("node merely catching up",
      ()=>{state.node=1;state.nodeStorage=5000;state.nodeMode="full";
        state.nodeSync={primaryLag:40,primaryPeak:40,backupLag:0,backupPeak:0}},
      ()=>advanceNodeSync(true),()=>state.nodeSync.primaryLag);
    return{out}})()`);
  const by = Object.fromEntries(r.out.map(o => [o.label, o]));
  for (const label of ["cooling install lands","pool payout lands","second-hand listings refresh",
                       "staged crates go into the racks","node reaches the chain tip","node falls off the tip"]) {
    assert(by[label], `${label} was not probed`);
    assert(by[label].changed, `${label} changed nothing, so the probe proves nothing`);
    assert(by[label].asked, `${label} changed the shape of a tab without asking for the rebuild that draws it`);
  }
  /* And the counter-case, which is the whole reason this is not "flag on every change": a lag
     that moves every single tick wants a text patch, not a tab rebuild. Raising the flag here
     would undo the reason the tick repaints with refreshLive() at all. */
  for (const label of ["node merely catching up", "node already behind, falling further"])
    assert(by[label].changed && !by[label].asked,
      `${label}: ordinary sync progress now forces a full tab rebuild every tick`);
});

/* ---- WHAT A BUTTON OFFERS IS WHAT THE ACTION ALLOWS ---- */

rule("a service the button offers is a service that actually starts", () => {
  /* Both service actions refused in five places and their buttons checked three. The gap that
     mattered was the crew: with nobody on the payroll you ARE the crew, you can only be on one
     bench at a time, and every other machine's Refurbish and Replace button stayed enabled with
     an empty tooltip. Clicking one did nothing whatsoever.

     Asserted as parity rather than as a list of conditions: whatever the reason says, starting
     the job must agree with it. A new refusal added to the action and forgotten in the helper
     fails here. */
  const r = json(`(()=>{${SITE(`state.time=at("2016-06-01");state.facility="warehouse";state.region="texas";
    state.cash=1e6;state.hardware={};state.hardware.s9=40;state.hardware.s7=20;
    state.thermal={temperature:22,orders:[],equipment:{axial:2}};`)}
    const cases=[];
    const probe=(label,setup)=>{
      state.maintenance.serviceJobs=[];state.staff=[];state.skills=[];
      state.maintenance.condition={s9:70,s7:70};
      state.maintenance.faults={s9:4,s7:4};
      state.maintenance.faultsByPart={s9:{asicfan:4},s7:{asicfan:4}};
      state.maintenance.inventory.asicfan=99;state.maintenance.inventory.hashboardearly=99;
      state.maintenance.inventory.hashboard=99;state.maintenance.inventory.thermalpaste=99;
      setup();
      const h=HARDWARE.find(x=>x.id==="s7");
      for(const part of [null,"asicfan"]){
        const reason=serviceBlockReason(h,part);
        const before=state.maintenance.serviceJobs.length;
        if(part)serviceHardwarePart("s7",part);else serviceHardware("s7");
        const started=state.maintenance.serviceJobs.length>before;
        cases.push({label,part:part||"refurbish",reason,started});
        // Undo so the two probes in a case do not interfere.
        state.maintenance.serviceJobs=state.maintenance.serviceJobs.filter(j=>j.id!=="s7");
      }
    };
    probe("free hands",()=>{});
    probe("already on a bench yourself",()=>{serviceHardwarePart("s9","asicfan")});
    probe("technicians on the payroll",()=>{state.staff=["fieldtech","fieldtech","fieldtech"]});
    probe("crew all committed",()=>{state.staff=["fieldtech"];serviceHardwarePart("s9","asicfan")});
    probe("no parts in stock",()=>{state.maintenance.inventory.asicfan=0;state.maintenance.inventory.hashboardearly=0;state.maintenance.inventory.hashboard=0});
    probe("nothing wrong with it",()=>{state.maintenance.condition.s7=100;state.maintenance.faults.s7=0;state.maintenance.faultsByPart.s7={}});
    /* This machine already in the bay. Every other case clears s7's jobs between probes, so
       without it the "already scheduled" branch was never walked and could be deleted freely. */
    {
      state.maintenance.serviceJobs=[];state.staff=["fieldtech","fieldtech","fieldtech"];state.skills=[];
      state.maintenance.condition={s9:70,s7:70};state.maintenance.faults={s9:4,s7:4};
      state.maintenance.faultsByPart={s9:{asicfan:4},s7:{asicfan:4}};
      state.maintenance.inventory.asicfan=99;state.maintenance.inventory.hashboardearly=99;
      state.maintenance.inventory.hashboard=99;state.maintenance.inventory.thermalpaste=99;
      serviceHardwarePart("s7","asicfan");
      const h=HARDWARE.find(x=>x.id==="s7");
      for(const part of [null,"asicfan"]){
        const reason=serviceBlockReason(h,part);
        const before=state.maintenance.serviceJobs.length;
        if(part)serviceHardwarePart("s7",part);else serviceHardware("s7");
        cases.push({label:"already in the bay",part:part||"refurbish",reason,
          started:state.maintenance.serviceJobs.length>before});
      }
    }
    return{cases}})()`);
  assert(r.cases.length >= 10, "the matrix did not run");
  for (const c of r.cases)
    assert((c.reason === "") === c.started,
      `${c.label} / ${c.part}: the button ${c.reason ? `says "${c.reason}"` : "offers it"} but the action ${c.started ? "started" : "refused"}`);
  // The matrix has to contain both answers, or parity is trivially true.
  assert(r.cases.some(c => c.started), "no case ever started a job, so the rule proves nothing");
  assert(r.cases.some(c => !c.started), "no case was ever refused, so the rule proves nothing");
});

rule("a drain the button offers is a drain that actually happens", () => {
  /* Coming out of the fluid is not free — the fans go back on and somebody does the work — so
     it can be refused for want of cash, and the button offering it did not know that. An
     operator with no money saw an enabled "Drain 10" that did nothing when pressed. Parity,
     not a list of conditions. */
  const r = json(`(()=>{${SITE(`state.time=at("2022-06-01");state.facility="warehouse";state.region="texas";
    state.hardware={};state.hardware.s19=40;state.immersion={};
    state.thermal={temperature:22,orders:[],equipment:{axial:2,immersion:1}};`)}
    state.maintenance.inventory.immersionKit=50;state.cash=1e6;
    convertToImmersion("s19",10);
    const h=HARDWARE.find(x=>x.id==="s19");
    const cases=[];
    const probe=(label,cash,qty)=>{
      state.cash=cash;
      const reason=immersionDrainBlockReason(h,qty);
      const before=immersionCount("s19");
      revertFromImmersion("s19",qty);
      cases.push({label,reason,drained:immersionCount("s19")<before});
    };
    probe("plenty of cash",1e6,10);
    // Put them back so the next probes have something to drain.
    state.cash=1e6;convertToImmersion("s19",10);
    probe("no cash at all",0,10);
    probe("just short",immersionConversionLabour(h,10)-1,10);
    probe("enough for one",immersionConversionLabour(h,1),1);
    state.cash=1e6;
    const drainedAll=(()=>{revertFromImmersion("s19",99);return immersionCount("s19")})();
    probe("nothing submerged",1e6,1);
    return{cases,drainedAll}})()`);
  for (const c of r.cases)
    assert((c.reason === "") === c.drained,
      `${c.label}: the button ${c.reason ? `says "${c.reason}"` : "offers it"} but the action ${c.drained ? "drained" : "refused"}`);
  assert(r.cases.some(c => c.drained), "nothing ever drained, so the rule proves nothing");
  assert(r.cases.some(c => !c.drained), "nothing was ever refused, so the rule proves nothing");
});

/* ---- A JOB THAT MOVES HAS TO SAY SO ---- */

rule("a repair changing stage asks the Mine tab to redraw", () => {
  /* The tick's ordinary repaint is refreshLive(), which patches text and never rebuilds the
     Mine tab. Only renderFullQueued makes it call renderMineContent(). Stage transitions did
     not set it, so a job could move Reconnect -> Fit -> Stability -> finished underneath a row
     that went on saying "Reconnect · 0d left" for as long as the clock ran. The engine was
     never stuck; the row describing it was. */
  const r = json(`(()=>{${SITE(`state.time=at("2010-03-01");state.facility="home";state.region="na";
    state.hardware={};state.hardware.laptop=1;state.staff=[];state.skills=[];`)}
    state.maintenance.serviceJobs=[];state.maintenance.condition.laptop=70;
    state.maintenance.faults={laptop:1};state.maintenance.faultsByPart={laptop:{laptopfan:1}};
    state.maintenance.inventory.laptopfan=5;state.maintenance.inventory.thermalpaste=20;
    serviceHardwarePart("laptop","laptopfan");
    const job=activeServiceJob("laptop");
    for(let i=0;i<30&&(job.stage||0)<2;i++)tick(true);
    if(!job.oldRemoved)repairRemoveOldPart("laptop");
    if(job.puzzleType===0){for(const slot of job.tapOrder.slice())repairTapSlot("laptop",slot)}
    else if(job.puzzleType===1){const slots=job.cableSlots.slice();
      for(let p=0;p<3;p++){const idx=[];slots.forEach((v,i)=>{if(v===p)idx.push(i)});
        repairCableClick("laptop",idx[0]);repairCableClick("laptop",idx[1])}}
    else{let g=0;while(Math.abs(job.dialValue-job.dialTarget)>job.dialTolerance&&g++<80){
      const off=job.dialValue-job.dialTarget;repairNudgeDial("laptop",off>0?(off>5?-5:-1):(off<-5?5:1))}}
    const stageAfterWork=job.stage;
    // Clear the flag, then run ONE tick and see whether the transition re-raises it.
    const steps=[];
    for(let i=0;i<6;i++){
      renderFullQueued=false;
      const before=activeServiceJob("laptop");
      const stageBefore=before?before.stage:null;
      tick(true);
      const after=activeServiceJob("laptop");
      const stageAfter=after?after.stage:"gone";
      if(stageBefore!==stageAfter)steps.push({from:stageBefore,to:stageAfter,asked:renderFullQueued===true});
      if(!after)break;
    }
    return{stageAfterWork,steps}})()`);
  assert(r.stageAfterWork > 2, "the bench work never completed, so there are no later stages to test");
  assert(r.steps.length > 0, "the job never changed stage on a tick");
  for (const step of r.steps)
    assert(step.asked, `moving from stage ${step.from} to ${step.to} did not ask the Mine tab to redraw, so the row would freeze there`);
  // Including the transition that removes the job: the row has to stop being drawn at all.
  assert(r.steps.some(step => step.to === "gone"), "the job never finished within the window");

  /* A save written before repairs were staged carries a job with no stage field, and that path
     skips the stage loop entirely — so it needs its own flag on completion. Asserting only
     through the staged path let that one be deleted without anything noticing, because the
     final stage++ had already raised the flag. */
  const legacy = json(`(()=>{${SITE(`state.time=at("2010-03-01");state.facility="home";state.region="na";
    state.hardware={};state.hardware.laptop=1;`)}
    state.maintenance.condition.laptop=70;
    state.maintenance.faults={laptop:1};state.maintenance.faultsByPart={laptop:{laptopfan:1}};
    state.maintenance.inventory.laptopfan=5;state.maintenance.inventory.thermalpaste=20;
    // A pre-staging job: due date only, no stage.
    state.maintenance.serviceJobs=[{id:"laptop",count:1,part:"laptopfan",due:state.time+DAY,
      crew:1,contracted:false,labor:0,auto:true}];
    renderFullQueued=false;
    state.time+=DAY*2;advanceMaintenance();
    return{gone:!activeServiceJob("laptop"),asked:renderFullQueued===true}})()`);
  assert(legacy.gone, "a legacy job never completed");
  assert(legacy.asked, "a legacy job finished without asking the Mine tab to stop drawing its row");
});

/* ---- THE BENCH ASKS FOR A PROCEDURE, NOT A GUESS ---- */

rule("the faulted part decides the procedure", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");`)}
    return{map:["asicfan","laptopfan","fan","coolantPump","hashboard","hashboardearly",
      "hashboardmodern","powerPcb","coolingManifold"].map(p=>[p,repairProcedureFor(p)]),
      noPart:repairProcedureFor(undefined)}})()`);
  const by = Object.fromEntries(r.map);
  /* A fan is a wiring job, a hashboard is seated and cross-torqued, a power board is torqued to
     a spec. This was Math.floor(nextRand()*3) — a fan fault could hand you a torque wrench —
     which made the task decoration on top of the repair and taught nothing about the part. */
  for (const fan of ["asicfan", "laptopfan", "fan", "coolantPump"])
    assert(by[fan] === 1, `${fan} is not a wiring job (got procedure ${by[fan]})`);
  for (const board of ["hashboard", "hashboardearly", "hashboardmodern"])
    assert(by[board] === 0, `${board} is not a seat-and-cross-torque job (got ${by[board]})`);
  for (const torque of ["powerPcb", "coolingManifold"])
    assert(by[torque] === 2, `${torque} is not a torque-to-spec job (got ${by[torque]})`);
  assert(Number.isFinite(r.noPart), "a recommissioning check with no part has no procedure at all");
});

rule("the printed cross pattern is a real cross pattern", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");`)}
    const opp={0:3,3:0,1:2,2:1},bad=[];
    for(let i=0;i<600;i++){const o=crossPattern();
      if(o.length!==4||new Set(o).size!==4||o[1]!==opp[o[0]]||o[3]!==opp[o[2]])bad.push(o)}
    const starts=new Set();for(let i=0;i<200;i++)starts.add(crossPattern()[0]);
    /* And the pattern the JOB actually gets, not merely what the generator returns: asserting
       only on the helper passes happily while the caller hands out a hardcoded order. */
    const jobs=[],jobStarts=new Set();
    for(let i=0;i<200;i++){const j={part:"hashboardmodern"};initRepairPuzzle(j);
      const o=j.tapOrder;jobStarts.add(o[0]);
      if(o.length!==4||new Set(o).size!==4||o[1]!==opp[o[0]]||o[3]!==opp[o[2]])jobs.push(o)}
    return{bad:bad.slice(0,3),badCount:bad.length,starts:[...starts].sort(),
      jobBad:jobs.slice(0,3),jobBadCount:jobs.length,jobStarts:[...jobStarts].sort()}})()`);
  /* The sequence is printed and described as the manual's, so it has to be one: any corner,
     then the corner diagonally opposite, then either of the remaining pair, then its opposite.
     A shuffle would have the game teach a technique that is not the technique. */
  assert(r.badCount === 0, `${r.badCount} of 600 patterns were not cross patterns, e.g. ${JSON.stringify(r.bad)}`);
  // Which corner you start at is the fitter's choice, so that much should still vary.
  assert(r.starts.length === 4, `patterns only ever start at ${r.starts.join(",")}`);
  assert(r.jobBadCount === 0, `${r.jobBadCount} of 200 bench jobs got a non-cross order, e.g. ${JSON.stringify(r.jobBad)}`);
  assert(r.jobStarts.length === 4, `bench jobs only ever start at ${r.jobStarts.join(",")}, so the order is fixed rather than generated`);
});

rule("following the procedure by the book costs nothing", () => {
  /* THE POINT OF ALL OF THIS. Every one of these used to punish the player for information they
     were never given: the mount order was a hidden shuffle, so a wrong mount was a coin flip
     that could damage the machine, and the cable pairs were unlabelled, so the first pick of
     each pair was a guess with a penalty attached. Neither is a test of anything. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="workshop";state.region="texas";
    state.hardware={};state.hardware.s19=40;state.staff=[];state.skills=[];
    state.thermal={temperature:22,orders:[],equipment:{axial:1}};`)}
    state.maintenance.inventory.hashboardmodern=99;state.maintenance.inventory.asicfan=99;
    state.maintenance.inventory.powerPcb=99;state.maintenance.inventory.thermalpaste=99;
    const play=part=>{
      state.maintenance.serviceJobs=[];state.maintenance.condition.s19=80;
      state.maintenance.faults={s19:2};state.maintenance.faultsByPart={s19:{[part]:2}};
      serviceHardwarePart("s19",part);
      const job=activeServiceJob("s19");if(!job)return{part,skipped:true};
      job.stage=2;job.oldRemoved=true;
      if(job.puzzleType===0){for(const slot of job.tapOrder.slice())repairTapSlot("s19",slot)}
      else if(job.puzzleType===1){const slots=job.cableSlots.slice();
        for(let pair=0;pair<3;pair++){const idx=[];slots.forEach((v,i)=>{if(v===pair)idx.push(i)});
          repairCableClick("s19",idx[0]);repairCableClick("s19",idx[1])}}
      else{let guard=0;while(Math.abs(job.dialValue-job.dialTarget)>job.dialTolerance&&guard++<80){
        const off=job.dialValue-job.dialTarget;repairNudgeDial("s19",off>0?(off>5?-5:-1):(off<-5?5:1))}}
      return{part,type:job.puzzleType,mistakes:job.mistakes||0,workDone:!!job.workDone};
    };
    return{plays:["hashboardmodern","asicfan","powerPcb"].map(play)}})()`);
  for (const play of r.plays) {
    assert(!play.skipped, `${play.part} never produced a bench job`);
    assert(play.workDone, `${play.part} could not be completed by following its own instructions`);
    assert(play.mistakes === 0,
      `${play.part} charged ${play.mistakes} mistake(s) to a player who followed the printed procedure exactly`);
  }
  assert(new Set(r.plays.map(p => p.type)).size === 3, "the three parts did not exercise three different procedures");
});

rule("a torque spec is a band, and only overshooting it is a mistake", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="workshop";state.region="texas";
    state.hardware={};state.hardware.s19=40;state.staff=[];state.skills=[];
    state.thermal={temperature:22,orders:[],equipment:{axial:1}};`)}
    state.maintenance.inventory.powerPcb=99;state.maintenance.inventory.thermalpaste=99;
    state.maintenance.serviceJobs=[];state.maintenance.condition.s19=80;
    state.maintenance.faults={s19:2};state.maintenance.faultsByPart={s19:{powerPcb:2}};
    serviceHardwarePart("s19","powerPcb");
    const job=activeServiceJob("s19");job.stage=2;job.oldRemoved=true;
    const tol=job.dialTolerance,target=job.dialTarget;
    // Land inside the band rather than exactly on the figure.
    job.dialValue=target+tol;
    repairNudgeDial("s19",0);
    return{tol,target,acceptedAtEdge:!!activeServiceJob("s19")?.workDone||true,
      landedWithoutExact:job.dialValue!==target,mistakes:job.mistakes||0,done:!!job.workDone}})()`);
  assert(r.tol >= 1, "a torque spec has no tolerance, so it is an exact number to land on again");
  assert(r.done, "a fastener inside the tolerance band was not accepted");
  assert(r.landedWithoutExact, "the job only completed on the exact figure");
  assert(r.mistakes === 0, "working into the band counted as a mistake");
});

/* ---- HIRING A CREW HAS TO BUY A CREW ---- */

rule("technicians stack on a big repair and change nothing on a small one", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2025-06-01");state.facility="megacampus";state.region="iceland";
    state.hardware={};state.hardware.s21xp=47000;state.maintenance.serviceJobs=[];`)}
    const h=HARDWARE.find(x=>x.id==="s21xp");
    const at_=(faults,techs)=>{state.staff=Array.from({length:techs},()=>"fieldtech");
      const p=servicePlan(h,faults);return{crew:p.crew,days:p.days}};
    return{small:{t3:at_(10,3),t25:at_(10,25)},
      big:{t1:at_(300,1),t3:at_(300,3),t10:at_(300,10),t25:at_(300,25)},
      huge:at_(1000,25)}})()`);
  /* The bug: crew was min(3, available), so the fourth technician onward did nothing. A player
     hired twenty-five, watched three of them work, and carried a permanent backlog while paying
     the other twenty-two to stand still. */
  assert(r.big.t25.crew > r.big.t3.crew, `twenty-five technicians put ${r.big.t25.crew} on a 300-unit job, the same as three`);
  assert(r.big.t25.days < r.big.t3.days, "hiring more technicians did not make a large repair any faster");
  assert(r.big.t10.crew > r.big.t3.crew && r.big.t10.days < r.big.t3.days, "ten technicians are worth no more than three");
  assert(r.huge.crew >= 25, `a thousand faulted units absorbed only ${r.huge.crew} of twenty-five technicians`);
  /* And a small job is unchanged: you cannot usefully put twenty-five people on ten machines. */
  assert(r.small.t25.crew === r.small.t3.crew && r.small.t25.days === r.small.t3.days,
    "a ten-unit job now scales with the payroll, which is not how a ten-unit job works");
  /* And it is three, not one: a small job still takes a normal crew. Asserting only that the
     two agree passes just as happily when both collapse to a single technician. */
  assert(r.small.t3.crew === 3, `a ten-unit job with three technicians used ${r.small.t3.crew} of them`);
  /* One technician must still beat none of them, and beat three by less. */
  assert(r.big.t1.days > r.big.t3.days, "one technician is as good as three on a large job");
});

rule("racking and unracking scale with the crew, not with whether one exists", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2025-06-01");state.facility="megacampus";state.region="iceland";`)}
    const rate=t=>{state.staff=Array.from({length:t},()=>"fieldtech");
      return{commission:Math.max(1,Math.ceil(5000/crewRatePerDay(20))),retire:retirementDays(5000)}};
    return{none:rate(0),one:rate(1),three:rate(3),twelve:rate(12),twentyfive:rate(25)}})()`);
  /* hasStaff() is a boolean. Reading it here meant one technician doubled the rate and the
     twenty-fourth did nothing — the same mistake as the repair planner, in the place it costs
     most, on the sites large enough to employ a real crew. */
  assert(r.one.commission < r.none.commission, "a technician does not speed up commissioning at all");
  assert(r.three.commission < r.one.commission, "a third technician racks nothing faster than one");
  assert(r.twelve.commission < r.three.commission, "twelve technicians rack no faster than three");
  assert(r.three.retire < r.one.retire && r.twelve.retire < r.three.retire,
    "unracking does not scale with the crew doing it");
  /* Returns diminish rather than running away: there is a limit to how many people can usefully
     move around the same aisle. */
  assert(r.twentyfive.commission === r.twelve.commission,
    "the crew speed-up has no ceiling, so a large payroll racks a fleet instantly");
});

/* ---- THE SKILL TREE IS A GRAPH, AND HAS TO BE A VALID ONE ---- */

rule("every skill descends from a foundation, and the graph has no cycles", () => {
  const r = json(`(()=>{${SITE(`state.skills=[];`)}
    const byId=Object.fromEntries(SKILLS.map(s=>[s.id,s]));
    const roots=SKILLS.filter(s=>!skillRequirements(s).length).map(s=>s.id);
    const dangling=[],cyclic=[],unreachable=[];
    for(const skill of SKILLS){
      for(const id of skillRequirements(skill))if(!byId[id])dangling.push(skill.id+"->"+id);
      /* Collect every ancestor. Visiting a node twice by DIFFERENT paths is convergence, not a
         cycle — salvage reaching benchskills through both diagnostics and parts sourcing is
         exactly what makes this a graph — so the visited set only stops the walk repeating
         work. A cycle is a node that is its own ancestor. */
      const seen=new Set();let frontier=skillRequirements(skill),depth=0,ok=!frontier.length;
      while(frontier.length&&depth++<40){
        const next=[];
        for(const id of frontier){
          if(seen.has(id))continue;
          seen.add(id);
          const parent=byId[id];if(!parent)continue;
          const up=skillRequirements(parent);
          if(!up.length)ok=true;else next.push(...up);
        }
        frontier=next;
      }
      if(seen.has(skill.id))cyclic.push(skill.id);
      else if(!ok)unreachable.push(skill.id);
    }
    const branches=[...new Set(SKILLS.map(s=>s.branch))];
    const rootsPerBranch=branches.map(b=>[b,SKILLS.filter(s=>s.branch===b&&!skillRequirements(s).length).length]);
    const multi=SKILLS.filter(s=>skillRequirements(s).length>1).map(s=>s.id);
    const crossBranch=SKILLS.filter(s=>skillRequirements(s).some(id=>byId[id]&&byId[id].branch!==s.branch)).map(s=>s.id);
    return{roots,dangling,cyclic,unreachable,rootsPerBranch,multi,crossBranch,total:SKILLS.length}})()`);
  assert(r.dangling.length === 0, `prerequisites pointing at nothing: ${r.dangling.join(", ")}`);
  assert(r.cyclic.length === 0, `these depend on themselves through a cycle: ${r.cyclic.join(", ")}`);
  assert(r.unreachable.length === 0, `these can never be reached from a foundation: ${r.unreachable.join(", ")}`);
  /* One entry point per branch. Six independent ladders is not a tree, and neither is a branch
     with three separate starts you can take in any order. */
  for (const [branch, count] of r.rootsPerBranch)
    assert(count === 1, `the ${branch} branch has ${count} foundations; it should have exactly one`);
  /* And the thing that makes it a graph rather than six ladders: nodes that need two parents,
     and parents in another branch. Without these, nothing you spend in one branch has ever
     cost you anything in another. */
  assert(r.multi.length >= 6, `only ${r.multi.length} skills need more than one prerequisite`);
  /* Named rather than counted. A threshold passes when any one of them is quietly deleted,
     which is exactly the regression worth catching: each of these edges is a specific claim
     about what an operation has to have done before it can do something else. */
  for (const id of ["immersiontuning","practisedhands","curtailment","standbypower","firmwarehygiene"])
    assert(r.crossBranch.includes(id), `${id} no longer depends on another branch`);
});

rule("a skill with two prerequisites needs both of them", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2024-01-01");state.facility="container";state.points=99;`)}
    const target=SKILLS.find(s=>skillRequirements(s).length>1);
    const reqs=skillRequirements(target);
    // One parent only: still refused, and the refusal names what is missing.
    state.skills=[reqs[0]];
    /* "met" reads the SHIPPED gate rather than a parallel predicate. It used to call
       skillPrereqsMet(), which nothing in the game consulted — so this rule proved a spare
       correct while unlockSkill's real guard went untested. */
    const half={gate:skillGateReason(target),met:skillGateReason(target)===""};
    unlockSkill(target.id);
    const afterHalf=state.skills.includes(target.id);
    // Both parents: allowed.
    state.skills=reqs.slice();
    const full={gate:skillGateReason(target),met:skillGateReason(target)===""};
    unlockSkill(target.id);
    return{id:target.id,reqs,half,afterHalf,full,afterFull:state.skills.includes(target.id),
      names:reqs.map(skillName)}})()`);
  assert(r.reqs.length > 1, "no multi-prerequisite skill to test");
  assert(!r.half.met && r.half.gate !== "", `${r.id} counted one of ${r.reqs.length} prerequisites as enough`);
  assert(r.half.gate.includes(r.names[1]), `the refusal did not name the missing prerequisite: "${r.half.gate}"`);
  assert(!r.afterHalf, `${r.id} was unlocked with only half its prerequisites`);
  assert(r.full.met && r.full.gate === "" && r.afterFull, `${r.id} stayed locked with both prerequisites met`);
});

/* ---- SOME THINGS ARE MOMENTS, NOT A MENU ---- */

rule("a fork trade and a donation drive close when the moment does", () => {
  const r = json(`(()=>{${SITE(`state.donations=[];state.speculations=[];state.wallets.hot=5;`)}
    const open=d=>{state.time=at(d);return{
      specs:SPECULATIONS.filter(x=>offerOpen(x)).map(x=>x.id),
      gifts:DONATION_CAMPAIGNS.filter(x=>offerOpen(x)).map(x=>x.id)}};
    const y2017=open("2017-10-01"),y2022=open("2022-04-01"),y2026=open("2026-06-01");
    // Taking a closed offer must change nothing at all.
    state.time=at("2026-06-01");state.wallets.hot=5;
    const hot=state.wallets.hot,xp=state.xp.total;
    takeSpeculation("bch",.1);donateBtc("wikileaks",.1);
    return{y2017,y2022,y2026,
      after:{specs:state.speculations.length,gifts:state.donations.length,
        hot:state.wallets.hot===hot,xp:state.xp.total===xp},
      dated:SPECULATIONS.concat(DONATION_CAMPAIGNS).filter(x=>!x.until).map(x=>x.id)}})()`);
  /* Every one of these is a moment. A list where none of them ever close is a list that offers
     the 2017 fork claim in 2026, which is a different decision from the one described. */
  assert(r.dated.length === 0, `these never close: ${r.dated.join(", ")}`);
  assert(r.y2017.specs.includes("bch"), "the Bitcoin Cash fork trade was not available two months after the fork");
  assert(!r.y2022.specs.includes("bch"), "the fork claim was still on offer five years later");
  assert(r.y2022.gifts.includes("ukraine") && !r.y2017.gifts.includes("ukraine"),
    "the Ukraine relief campaign is not tied to when it happened");
  assert(r.y2026.specs.length === 0 && r.y2026.gifts.length === 0,
    `the end of the run still offers ${r.y2026.specs.length} trades and ${r.y2026.gifts.length} campaigns`);
  assert(r.after.specs === 0 && r.after.gifts === 0 && r.after.hot && r.after.xp,
    "a closed offer could still be taken");
});

rule("giving coins away is worth real operator XP", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2022-04-01");state.donations=[];state.wallets.hot=5;
    state.xp={total:0,level:1,peakLevel:1,bestDifficulty:0,shares:0,sources:{shares:0,record:0,deploy:0,repair:0,spend:0}};`)}
    const small=(()=>{donateBtc("ukraine",.05);const x=state.xp.total;
      state.donations=[];state.xp.total=0;state.xp.level=1;state.wallets.hot=5;return x})();
    const large=(()=>{donateBtc("ukraine",.5);return state.xp.total})();
    return{small,large,level:state.xp.level,given:state.donations[0].btc,hot:state.wallets.hot}})()`);
  /* The only use of bitcoin in this game that never comes back as machines, capacity or cash.
     XP is the one thing the game has with which to say that mattered. */
  assert(r.small > 100, `a donation paid ${r.small} XP, which is not worth noticing`);
  assert(r.large > r.small, "giving away more is worth no more than giving away less");
  assert(r.level > 1, `${r.large} XP did not move the operator past level 1`);
  assert(r.given > 0 && r.hot < 5, "the donation did not actually cost any bitcoin");
});

/* ---- MINING INCOME ARRIVES THROUGH CUSTODY ---- */

rule("pool income is held by the pool until it clears the threshold", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";state.region="texas";
    state.hardware={};state.hardware.s19=60;state.wallets.hot=0;state.wallets.cold=0;
    state.mode="pool";state.pool="foundry";state.skills=["pool"];
    state.poolAccount={balance:0,frozen:0,threshold:.01,destination:"hot",paidTotal:0,feesPaid:0,payouts:0,lastPayout:0};
    state.thermal={temperature:22,orders:[],equipment:{axial:6}};`)}
    const trace=[];
    for(let d=0;d<40;d++){tick(true);trace.push({pool:poolAccount().balance,hot:state.wallets.hot,paid:poolAccount().payouts})}
    return{trace,threshold:poolAccount().threshold,fee:payoutNetworkFee(),
      totals:{paid:poolAccount().paidTotal,fees:poolAccount().feesPaid,payouts:poolAccount().payouts}}})()`);
  const earned = r.trace.some(t => t.pool > 0 || t.hot > 0);
  assert(earned, "the fleet earned nothing over 40 days, so this rule proves nothing");
  /* The whole point: there is a day on which the miner has been paid nothing and the pool is
     holding real money. That is the state the game never used to represent. */
  const holding = r.trace.find(t => t.pool > 0 && t.paid === 0);
  assert(holding, "income never sat with the pool; it went straight to the wallet as it used to");
  assert(r.totals.payouts > 0, `no payout was ever made over 40 days at a ${r.threshold} threshold`);
  assert(r.totals.fees > 0, "payouts cost no network fee, so the threshold trade-off does not exist");
  /* Every payout crosses the threshold, and the fee comes out of the payment. */
  const firstPaid = r.trace.findIndex(t => t.paid === 1);
  assert(firstPaid > 0 && r.trace[firstPaid - 1].pool >= 0, "the first payout did not follow a held balance");
  assert(r.trace[firstPaid].hot > 0, "a payout was recorded but nothing reached the wallet");
});

rule("solo mining has no pool balance and no withdrawal fee", () => {
  /* Asserted against the router directly rather than by waiting for a block. Solo mining is a
     lottery, and a run long enough to be sure of winning it is also long enough for an
     unserviced fleet to degrade itself offline — so a tick-driven version of this rule was
     failing for reasons that had nothing to do with what it claims. The tick's use of this
     router is proved by the pool rule above, which watches a balance accrue through ticks. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";state.region="texas";
    state.wallets.hot=0;state.wallets.cold=0;state.mode="solo";
    state.poolAccount={balance:0,frozen:0,threshold:.01,destination:"hot",paidTotal:0,feesPaid:0,payouts:0,lastPayout:0};`)}
    creditMiningIncome(.5);
    const solo={hot:state.wallets.hot,pool:poolAccount().balance,fees:poolAccount().feesPaid};
    // The same income, mined through a pool, must behave completely differently.
    state.mode="pool";state.pool="foundry";state.wallets.hot=0;
    creditMiningIncome(.5);
    const pooled={hot:state.wallets.hot,pool:poolAccount().balance};
    return{solo,pooled}})()`);
  /* The coinbase pays an address you control: nobody holds it and nobody charges you to send
     it. That is the half of the solo trade-off the game never showed. */
  assert(r.solo.hot === .5, `solo income put ${r.solo.hot} in the wallet instead of the whole 0.5`);
  assert(r.solo.pool === 0, `solo mining accrued ${r.solo.pool} in a pool balance`);
  assert(r.solo.fees === 0, "solo mining paid a pool withdrawal fee");
  assert(r.pooled.hot === 0 && r.pooled.pool === .5,
    `pool income reached the wallet directly (${r.pooled.hot} hot, ${r.pooled.pool} held); it must sit with the pool first`);
});

rule("the payout destination decides who is holding the income", () => {
  const r = json(`(()=>{
    const run=dest=>{
      ${SITE(`state.time=at("2021-06-01");state.facility="warehouse";state.region="texas";
        state.hardware={};state.hardware.s19=60;state.wallets.hot=0;state.wallets.cold=0;
        state.wallets.exchange=0;state.mode="pool";state.pool="foundry";state.skills=["pool"];
        state.thermal={temperature:22,orders:[],equipment:{axial:6}};`)}
      state.poolAccount={balance:0,frozen:0,threshold:.005,destination:dest,paidTotal:0,feesPaid:0,payouts:0,lastPayout:0};
      for(let d=0;d<60;d++)tick(true);
      return{hot:state.wallets.hot,cold:state.wallets.cold,exchange:state.wallets.exchange,
        payouts:poolAccount().payouts};
    };
    return{hot:run("hot"),exchange:run("exchange"),
      coldBlocked:(()=>{${SITE(`state.time=at("2021-06-01");state.custody=blankCustody();`)}
        return payoutDestinationBlockReason("cold")})()}})()`);
  assert(r.hot.payouts > 0 && r.hot.hot > 0, "paying to the hot wallet did not reach the hot wallet");
  assert(r.exchange.payouts > 0 && r.exchange.exchange > 0 && r.exchange.hot === 0,
    "paying to an exchange put the income somewhere else");
  /* Cold storage is not a place you can be paid until you have built somewhere to be paid to.
     This is the moment the custody tab stops being optional. */
  assert(/custody/i.test(r.coldBlocked),
    "cold storage can be chosen as a payout destination without a wallet that can receive into it");
});

rule("a pool that stops paying takes what it was holding", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2026-07-01");state.facility="warehouse";state.region="texas";
    state.hardware={};state.hardware.s19=60;state.wallets.hot=0;state.mode="pool";state.pool="poolin";
    state.skills=["pool"];state.pendingLosses=[];
    state.poolAccount={balance:0,frozen:0,threshold:.5,destination:"hot",paidTotal:0,feesPaid:0,payouts:0,lastPayout:0};
    state.thermal={temperature:22,orders:[],equipment:{axial:6}};`)}
    // A high threshold means a large balance is still on the pool's books when it closes.
    for(let d=0;d<8;d++)tick(true);
    const before=poolAccount().balance,hotBefore=state.wallets.hot;
    for(let d=0;d<20;d++)tick(true);
    return{before,hotBefore,after:poolAccount().balance,frozen:poolAccount().frozen,
      mode:state.mode,losses:(state.pendingLosses||[]).map(l=>l.cause)}})()`);
  assert(r.before > 0, "the pool was holding nothing when it closed, so this rule proves nothing");
  assert(r.mode === "solo", "the fleet did not fail over when the pool closed");
  assert(r.after === 0, "the pool kept paying after it shut down");
  /* What is lost is exactly what the operator chose to leave there — the threshold argument
     made concrete — and it is reported as a coin loss rather than a log line. */
  assert(r.frozen > 0 && r.frozen < r.before, `${r.frozen} of ${r.before} survived as a claim; it must be a fraction`);
  assert(r.losses.includes("poolfail"), "a stranded pool balance was not reported as a loss");
});

/* ---- CAPACITY GATES THE LOADING BAY, NOT THE TILL ---- */

rule("a fleet can be bought beyond the room, and the room takes what it can", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="workshop";state.region="texas";
    state.cash=5e6;state.hardware={};state.hardware.s19=20;state.poweredDownHardware={};
    state.decommissionedHardware={};state.inactiveHardware={};state.procurementOrders=[];
    state.commissioningJobs=[];state.retirementJobs=[];state.stagedCondition={};
    state.thermal={temperature:22,orders:[],equipment:{axial:1}};`)}
    const h=HARDWARE.find(x=>x.id==="s19");
    const headroom=siteRackHeadroom(h);
    const offered=hardwarePurchaseLimits(h).fiatMax;
    buyHardware("s19",60);
    const ordered=state.procurementOrders.reduce((a,o)=>a+o.qty,0);
    state.procurementOrders.forEach(o=>{o.due=state.time;o.risk=0;o.partialRisk=0});
    tick(true);
    const arrival={staged:state.inactiveHardware.s19||0,job:(state.commissioningJobs[0]||{}).qty||0,
      installed:state.hardware.s19,hold:stagedHoldReason("s19")};
    // Free real capacity and let the crew work: the rest must go in without being asked.
    decommissionHardware("s19",20);
    /* Long enough for the intake to work through in waves, and to prove it then STOPS. The
       intake has to pace itself: machines being commissioned occupy floor and draw power before
       the crew has finished bolting them in, so each wave waits for the last to land. */
    let everOver=false;
    for(let d=0;d<60;d++){tick(true);if(!fleet().within)everOver=true}
    return{headroom,offered,ordered,arrival,everOver,
      end:{staged:state.inactiveHardware.s19||0,installed:state.hardware.s19,
        stored:state.decommissionedHardware.s19||0,
        within:fleet().within,headroom:siteRackHeadroom(HARDWARE.find(x=>x.id==="s19"))}}})()`);
  assert(r.headroom > 0 && r.headroom < 60, `the site had headroom for ${r.headroom}; the case needs it to be short of the order`);
  /* The card has to offer it too, or the engine allows something the player can never ask for. */
  assert(r.offered > r.headroom,
    `the card offered ${r.offered} against room for ${r.headroom}; capacity is still clamping what may be bought`);
  assert(r.ordered === 60, `buying 60 against headroom for ${r.headroom} was cut to ${r.ordered}; capacity must not gate the purchase`);
  /* What fits is taken without being asked, and what does not fit waits rather than being
     refused. The old behaviour rejected the whole batch because one machine did not fit. */
  assert(r.arrival.job === r.headroom, `the site accepted ${r.arrival.job} of a delivery it had room for ${r.headroom} of`);
  assert(r.arrival.staged === 60 - r.headroom, `${r.arrival.staged} were left in storage; expected ${60 - r.headroom}`);
  assert(/storage/i.test(r.arrival.hold), "nothing explains why the rest of a paid-for delivery is still in its crate");
  /* And the room opening later is enough on its own — nobody should have to press a button to
     accept hardware they have already paid for. But only as far as the room actually goes: a
     workshop supplies 100 kW and an S19 draws 3.5 kW, so it holds about twenty-nine of them and
     the balance stays in storage. An earlier version of this rule asserted that all sixty went
     in, which is precisely the bug it should have caught — the intake was over-committing
     because machines already being commissioned reserved nothing, and a site that ends up
     holding more than it can carry stops mining entirely. */
  assert(r.end.installed > r.headroom, "capacity freeing up did not let any more machines in");
  assert(r.end.installed + r.end.staged === 60, `${r.end.installed} racked and ${r.end.staged} staged do not account for the 60 bought`);
  assert(r.end.stored === 20, `${r.end.stored} machines in storage after retiring 20`);
  assert(r.end.headroom === 0, `the site stopped taking machines with room for ${r.end.headroom} more`);
  /* The invariant this whole gate exists to protect. */
  assert(!r.everOver && r.end.within, "the site was allowed to hold more fleet than it can carry, which stops it mining entirely");
});

rule("machines already being commissioned reserve the capacity they will use", () => {
  /* THE BUG THIS EXISTS FOR. Commissioning takes days and the intake runs every day. Headroom
     measured against INSTALLED machines alone does not shrink while a job is in flight, so the
     intake started a fresh job every day for the whole length of the last one, each convinced
     there was room. A site ends up holding several times what it can carry, fleet().within goes
     false, and the entire operation stops mining. A player lost months of a 575,000-machine
     farm to exactly this. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="workshop";state.region="texas";
    state.hardware={};state.hardware.s19=1;state.inactiveHardware={s19:400};state.stagedCondition={};
    state.commissioningJobs=[];state.retirementJobs=[];state.procurementOrders=[];
    state.decommissionedHardware={};state.poweredDownHardware={};
    state.thermal={temperature:22,orders:[],equipment:{axial:1}};`)}
    const h=HARDWARE.find(x=>x.id==="s19");
    const headroomStart=siteRackHeadroom(h);
    activateHardware("s19");
    // Mid-job, with the crew still bolting the first wave in, the site must report no room.
    const midJob={jobs:state.commissioningJobs.length,headroom:siteRackHeadroom(h),
      committed:committedLoad().watts};
    let everOver=false,peak=0;
    for(let d=0;d<60;d++){tick(true);if(!fleet().within)everOver=true;peak=Math.max(peak,state.hardware.s19)}
    return{headroomStart,midJob,everOver,peak,
      end:{installed:state.hardware.s19,staged:state.inactiveHardware.s19||0,within:fleet().within}}})()`);
  assert(r.headroomStart > 0 && r.headroomStart < 400, "the case needs a site with room for some but not all");
  assert(r.midJob.jobs === 1, "no commissioning job was started");
  assert(r.midJob.committed > 0, "a job in flight reserves no load at all");
  assert(r.midJob.headroom === 0,
    `with a job in flight the site still claims room for ${r.midJob.headroom} more, which is how it over-commits`);
  /* The invariant. Over sixty days of the intake running daily, the installed fleet must never
     once exceed what the site can carry. */
  assert(!r.everOver, "the site was allowed to hold more fleet than it can carry, which stops it mining entirely");
  assert(r.end.within, "the site ended holding more than it can carry");
  assert(r.end.installed + r.end.staged === 401, `${r.end.installed} racked and ${r.end.staged} staged do not account for the 401 owned`);
});

rule("a site that cannot carry its fleet says so", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2025-06-01");state.facility="megacampus";state.region="iceland";
    state.power=true;state.debt=0;state.hardware={};state.hardware.s21=575000;
    state.thermal={temperature:20,orders:[],equipment:{coolingtower:40}};`)}
    const over={within:fleet().within,operating:operating(),reason:siteStopReason(),earning:earningHash(),physical:fleet().hash};
    // And when it does fit, it says nothing.
    state.hardware={s21:20000};
    return{over,ok:{within:fleet().within,reason:siteStopReason()}}})()`);
  assert(r.over.within === false && r.over.operating === false, "the case needs a site that cannot carry its fleet");
  /* A stoppage the game cannot explain is worse than any stoppage it can. */
  assert(r.over.reason !== "", "a site stopped because its fleet does not fit gives no reason at all");
  assert(/kW|floor/.test(r.over.reason), `the reason does not say what is over: "${r.over.reason}"`);
  assert(/retire|sell|larger/i.test(r.over.reason), `the reason does not say what to do about it: "${r.over.reason}"`);
  /* And the number under "your hash" is what is being earned, not what is installed. A player
     watched sixteen exahash while their balance did not move. */
  assert(r.over.earning === 0 && r.over.physical > 0,
    `a stopped site reported ${r.over.earning} of earning hash against ${r.over.physical} installed`);
  assert(r.ok.reason === "", `a site that fits still complains: "${r.ok.reason}"`);
});

rule("the manual commission button racks what fits instead of refusing the batch", () => {
  /* The auto-intake and the button are two paths to the same decision, and the button was the
     one that used to reject a whole delivery because one machine did not fit. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="workshop";state.region="texas";
    state.hardware={};state.hardware.s19=20;state.inactiveHardware={s19:60};state.stagedCondition={};
    state.commissioningJobs=[];state.procurementOrders=[];state.retirementJobs=[];
    state.thermal={temperature:22,orders:[],equipment:{axial:1}};`)}
    const h=HARDWARE.find(x=>x.id==="s19");
    const headroom=siteRackHeadroom(h);
    activateHardware("s19");
    return{headroom,job:(state.commissioningJobs[0]||{}).qty||0,staged:state.inactiveHardware.s19||0}})()`);
  assert(r.headroom > 0 && r.headroom < 60, "the case needs a site with room for some but not all");
  assert(r.job === r.headroom, `the button commissioned ${r.job} of the ${r.headroom} that fit`);
  assert(r.staged === 60 - r.headroom, `${r.staged} left in storage; expected ${60 - r.headroom}`);
});

rule("a refused order returns the money and the listing", () => {
  /* Ordering used to be capacity-checked before payment, so the one path that can still refuse
     an order — a second-hand listing that is not deep enough — was free to take the cash and
     return silently. It is not free any more. */
  const r = json(`(()=>{${SITE(`state.time=at("2019-06-01");state.facility="warehouse";state.region="texas";
    state.cash=5e6;state.hardware={};state.inactiveHardware={};state.procurementOrders=[];`)}
    advanceSecondaryMarket(state.time);
    const listed=secondaryStock("s9");
    /* Reached directly, because the buy path clamps to the listing before it gets here — this
       is the belt-and-braces case, and a defence nobody exercises is a defence nobody has. */
    const stood=placeHardwareOrder("s9",listed+50);
    return{listed,stood,stillListed:secondaryStock("s9"),orders:state.procurementOrders.length}})()`);
  assert(r.listed > 0, "no second-hand stock to test against");
  assert(r.stood === false, "an order deeper than the listing was accepted anyway");
  assert(r.stillListed === r.listed, `a refused order consumed ${r.listed - r.stillListed} of the listing it could not fill`);
  assert(r.orders === 0, "a refused order was still added to the book");
});

/* ---- A PLANT YOU CAN BUY IS A PLANT YOU CAN LEAVE ---- */

rule("cooling can be cancelled before it lands and sold after it does", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2017-06-01");state.facility="warehouse";state.region="texas";
    state.cash=500000;state.hardware={};state.hardware.s9=300;
    state.thermal={temperature:26,orders:[],equipment:{axial:3}};`)}
    const item=COOLING_EQUIPMENT.find(x=>x.id==="axial");
    const start={cash:state.cash,cap:coolingCapacityKw()};
    buyCooling("axial");
    const ordered={cash:state.cash,orders:state.thermal.orders.length};
    cancelCoolingOrder("axial");
    const cancelled={cash:state.cash,orders:state.thermal.orders.length};
    sellCooling("axial");
    return {cost:item.cost,cooling:item.coolingKw,start,ordered,cancelled,
      sold:{cash:state.cash,units:state.thermal.equipment.axial||0,cap:coolingCapacityKw()},
      resaleQuoted:coolingResaleValue(item)}})()`);
  assert(r.ordered.orders === 1 && r.ordered.cash === r.start.cash - r.cost, "ordering cooling no longer costs its price");
  assert(r.cancelled.orders === 0, "an undelivered cooling order cannot be cancelled");
  /* A cancellation is not a refund in full: the supplier keeps a restocking fee, or ordering
     costs nothing to change your mind about and the decision carries no weight. */
  const refunded = r.cancelled.cash - r.ordered.cash;
  assert(refunded > 0 && refunded < r.cost, `cancelling refunded ${refunded} of ${r.cost}; it must return most of the money but not all of it`);
  assert(r.sold.units === 2, "selling an installed unit did not remove it from the plant");
  assert(r.sold.cash - r.cancelled.cash === r.resaleQuoted && r.resaleQuoted > 0,
    "selling installed cooling paid something other than the price its own card quotes");
  /* The point of selling it: the heat rejection goes with it, the same day. */
  assert(Math.abs((r.start.cap - r.sold.cap) - r.cooling * (r.start.cap / r.start.cap)) < r.cooling * 0.35,
    `capacity fell by ${(r.start.cap - r.sold.cap).toFixed(1)} kW when the unit sheds ${r.cooling} kW`);
  assert(r.sold.cap < r.start.cap, "selling a cooling unit did not reduce heat rejection");
});

rule("a cooling sale is worth more than the same plant sold with a building", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2017-06-01");state.facility="warehouse";state.region="texas";
    state.thermal={temperature:26,orders:[],equipment:{axial:2}};`)}
    const item=COOLING_EQUIPMENT.find(x=>x.id==="axial");
    return {chosen:coolingResaleValue(item),cost:item.cost,distressed:Math.round(item.cost*0.25)}})()`);
  /* Choosing the moment and the buyer is worth something. A downsize sells the plant with the
     building to someone who knows the operator has to leave; that is the worse price, and the
     two must not drift into each other or one of the decisions stops meaning anything. */
  assert(r.chosen > r.distressed, "selling cooling deliberately is worth no more than losing it in a downsize");
  assert(r.chosen < r.cost, "used industrial plant sells for its full price");
});

/* ---- THE FACILITY LADDER GOES BOTH WAYS ---- */

rule("a fleet that fits can move to a smaller site, and one that does not cannot", () => {
  /* The gate is physical, so it is tested physically: the same site, the same cash, the same
     date, varying only how many machines are installed. */
  const fits = json(`(()=>{${SITE(`state.time=at("2016-06-01");state.facility="warehouse";
    state.region="texas";state.hardware={};state.hardware.s9=4;state.procurementOrders=[];
    state.inactiveHardware={};state.decommissionedHardware={};state.commissioningJobs=[];
    state.facilityUpgradeJob=null;state.relocationJob=null;`)}
    const target=FACILITIES.find(f=>f.id==="workshop");
    const before={cash:state.cash,facility:state.facility,blocked:facilityDownsizeBlockReason("workshop")};
    downsizeFacility("workshop");
    return {blocked:before.blocked,job:state.facilityUpgradeJob&&state.facilityUpgradeJob.id,
      down:!!(state.facilityUpgradeJob&&state.facilityUpgradeJob.down),paid:before.cash-state.cash,
      cost:facilityDownsizeCost(target),power:state.power}})()`);
  assert(fits.blocked === "", `a four-machine fleet should fit a workshop, but: ${fits.blocked}`);
  assert(fits.job === "workshop", "downsizing did not dispatch a move to the smaller site");
  assert(fits.down === true, "the move is not recorded as a downsize, so the UI will call it an upgrade");
  assert(fits.power === false, "a physical move must power the fleet down");
  assert(fits.paid === fits.cost && fits.paid > 0, `the lease break and re-rack were not charged (paid ${fits.paid}, cost ${fits.cost})`);

  const tooMany = json(`(()=>{${SITE(`state.time=at("2016-06-01");state.facility="warehouse";
    state.region="texas";state.hardware={};state.hardware.s9=400;state.procurementOrders=[];
    state.inactiveHardware={};state.decommissionedHardware={};state.commissioningJobs=[];
    state.facilityUpgradeJob=null;state.relocationJob=null;`)}
    downsizeFacility("workshop");
    return {blocked:facilityDownsizeBlockReason("workshop"),job:state.facilityUpgradeJob}})()`);
  assert(tooMany.blocked !== "", "400 S9s should not fit a light industrial unit");
  assert(tooMany.job === null, "a fleet that does not fit was still moved into the smaller site");
});

rule("downsizing costs a lease break rather than a fit-out, and is far cheaper than the way up", () => {
  const money = json(`(()=>{${SITE(`state.time=at("2016-06-01");state.facility="warehouse";state.region="texas";`)}
    const workshop=FACILITIES.find(f=>f.id==="workshop"),warehouse=FACILITIES.find(f=>f.id==="warehouse");
    return {down:facilityDownsizeCost(workshop),fitOut:workshop.cost,leavingRent:warehouse.rent,
      rentSaved:warehouse.rent-workshop.rent}})()`);
  assert(money.rentSaved > 0, "moving down the ladder does not reduce rent, which is the only reason to do it");
  assert(money.down >= money.leavingRent, "walking away from a lease costs less than a month of it, so there is no reason to think about it");
  /* The number that decides whether this is a real option: an operator who has shrunk is short
     of cash, so the move has to pay for itself in months rather than years — and it must not be
     free, or staying in a site you have outgrown downward would never be a mistake. */
  const payback = money.down / money.rentSaved;
  assert(payback > 1 && payback < 6, `downsizing pays back in ${payback.toFixed(1)} months; it should be a few months, not free and not a year`);
});

rule("cooling on order counts against the site you are moving into", () => {
  /* The third instance of one class: work already in flight that the gate does not count.
     Machines mid-commission, crates waiting to be racked, and now plant on order — a cooling
     order placed in a site with room to spare installs into whichever site the operator is
     standing in when the fitters finish. buyCooling checks headroom honestly at the moment of
     purchase; nothing re-checked it after the ground moved. pendingCoolingOrdersFor() was
     written to answer this and was never called by anything. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";
    state.region="texas";state.cash=1e9;state.hardware={s19:20};
    state.thermal={temperature:22,orders:[],equipment:{}};`)}
    const bought=[];
    for(const item of COOLING_EQUIPMENT){
      const before=JSON.stringify(state.thermal.orders);
      buyCooling(item.id);
      if(JSON.stringify(state.thermal.orders)!==before)bought.push(item.id);
    }
    const pendingW=state.thermal.orders.reduce((a,o)=>{
      const it=COOLING_EQUIPMENT.find(x=>x.id===o.id);return a+(it?it.watts*(o.qty||1):0)},0);
    const reason=facilityDownsizeBlockReason("workshop");
    downsizeFacility("workshop");
    return {bought:bought.length,pendingKw:+(pendingW/1000).toFixed(1),reason,
      dispatched:!!state.facilityUpgradeJob,facility:state.facility}})()`);
  assert(r.bought > 0, "no cooling was ordered, so the rule tests nothing");
  assert(r.pendingKw > 20, `only ${r.pendingKw} kW of cooling was on order; too little to exceed the destination's supply`);
  assert(r.reason !== "", `the move was allowed with ${r.pendingKw} kW of cooling still on order, which installs on arrival`);
  assert(!r.dispatched && r.facility === "warehouse", "the move went ahead despite being refused");
});

rule("a facility move is a risk you can price, in both directions", () => {
  /* Mutation testing found nothing asserting the SHAPE of move risk. Turning the .48 ceiling
     into a floor — one character — makes every expansion at least a coin-flip disaster and the
     whole suite passed. Risk is the number the operator accepts when they commit to a move, so
     the bounds are the contract: an upgrade never certain to go wrong, a downsize meaningfully
     safer than an expansion because there is no new grid connection to energise, and moving
     nowhere costing nothing. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.cash=1e9;state.hardware={s19:20};`)}
    const rows=[];
    // facilityMoveRisk reads state.facility, so the site has to actually be set, not passed.
    for(const from of FACILITIES){
      for(const to of FACILITIES){
        state.facility=from.id;
        rows.push({from:from.id,to:to.id,
          up:FACILITIES.findIndex(x=>x.id===to.id)>FACILITIES.findIndex(x=>x.id===from.id),
          same:from.id===to.id,risk:facilityMoveRisk(to.id)});
      }
    }
    return {rows,labels:[facilityRiskLabel(.05),facilityRiskLabel(.2),facilityRiskLabel(.4)]}})()`);
  const same = r.rows.filter(x => x.same), ups = r.rows.filter(x => x.up),
        downs = r.rows.filter(x => !x.up && !x.same);
  assert(same.every(x => x.risk === 0), "moving to the site you are already in carries risk");
  assert(ups.every(x => x.risk > 0 && x.risk <= 0.48),
    `an expansion fell outside 0 < risk <= 0.48: ${JSON.stringify(ups.find(x => !(x.risk > 0 && x.risk <= 0.48)))}`);
  assert(downs.every(x => x.risk > 0 && x.risk <= 0.2),
    `a downsize fell outside 0 < risk <= 0.2: ${JSON.stringify(downs.find(x => !(x.risk > 0 && x.risk <= 0.2)))}`);
  /* The ceiling has to BIND, or Math.min(.48,...) and Math.max(.48,...) are the same function
     on this data and the assertion above proves nothing. */
  assert(ups.some(x => x.risk > 0.2), "no expansion is riskier than a downsize ceiling; the bounds are not being exercised");
  assert(Math.max(...downs.map(x => x.risk)) < Math.max(...ups.map(x => x.risk)),
    "the riskiest downsize is not safer than the riskiest expansion");
  assert(r.labels[0] === "Low move risk" && r.labels[2] === "High move risk",
    `risk labels do not describe the bands: ${r.labels.join(" / ")}`);
});

rule("a move incident cannot charge more money than the operator has", () => {
  /* Both incident fees are clamped with Math.min(state.cash, ...). Turning either into a
     Math.max charges a fee computed from FLEET VALUE against a cash balance that may be a
     fraction of it, so a bad roll on arrival invents debt out of nothing. Nothing asserted it. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";
    state.region="texas";state.hardware={s19:400};state.insured=false;state.debt=0;`)}
    // A large fleet and almost no cash: fees are priced off fleet value, so the clamp is load-bearing.
    state.cash=500;
    const fleetValue=Math.round(fleet().value);   // before any incident damages the fleet
    const worst=[];
    for(let trial=0;trial<200;trial++){
      state.cash=500;state.facility="warehouse";state.hardware={s19:400};
      state.facilityUpgradeJob={id:"workshop",due:state.time-DAY,cost:0,risk:1,down:true};
      advanceFacilityMove();
      worst.push(state.cash);
    }
    return {min:Math.min(...worst),fleetValue}})()`);
  assert(r.fleetValue > 5000, `the fleet must be worth far more than the cash on hand for this to test anything, got ${r.fleetValue}`);
  assert(r.min >= 0, `a move incident drove cash to ${r.min} from a starting balance of 500`);
});

rule("retirement cannot be booked for machines already on their way out", () => {
  /* retiringCount() was written to answer this and never called, so the cap was on machines
     owned rather than machines still in the racks. Booking the same 100 twice made a second
     job that pulled nothing and then announced "Retired 0" with a notice saying they were in
     storage — a confirmation for work that never happened. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";
    state.region="texas";state.cash=1e8;state.hardware={s19:100};
    state.thermal={temperature:22,orders:[],equipment:{}};`)}
    decommissionHardware("s19",100);
    decommissionHardware("s19",100);
    const booked=state.retirementJobs.reduce((a,j)=>a+j.qty,0),jobs=state.retirementJobs.length;
    for(let d=0;d<40;d++)tick(true);
    return {booked,jobs,jobsLeft:state.retirementJobs.length,
      hardware:state.hardware.s19||0,decommissioned:state.decommissionedHardware.s19||0}})()`);
  assert(r.jobs === 1, `${r.jobs} retirement jobs were opened against one fleet of 100`);
  assert(r.booked === 100, `${r.booked} machines were booked for retirement out of 100 owned`);
  assert(r.jobsLeft === 0, "the retirement did not finish");
  assert(r.decommissioned === 100 && r.hardware === 0,
    `the fleet did not end up in storage: ${r.hardware} racked, ${r.decommissioned} retired`);
});

rule("the loading bay racks against the site being moved INTO, not the one being left", () => {
  /* The stranding that has no warning attached to it, because every individual step is legal.
     The fleet fits the smaller site, so the move is allowed. Crates already standing on the
     floor are then racked over the following days against the headroom of the site being
     vacated. The move lands and 306 machines are drawing 999 kW into a 100 kW cap, on a floor
     that holds 260 units and is carrying 612. Nothing can be sold fast enough to recover it. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";
    state.region="texas";state.cash=1e9;state.hardware={s19:20};
    state.thermal={temperature:22,orders:[],equipment:{axial:2}};
    state.inactiveHardware={s19:400};`)}
    const moveAllowed=facilityDownsizeBlockReason("workshop")==="";
    downsizeFacility("workshop");
    let over=0;
    for(let d=0;d<150;d++){tick(true);if(!fleet().within)over++}
    const f=fleet(),site=FACILITIES.find(x=>x.id===state.facility);
    return {moveAllowed,facility:state.facility,daysOverCapacity:over,within:f.within,
      installed:state.hardware.s19||0,crated:state.inactiveHardware.s19||0,
      kw:+f.potentialKw.toFixed(1),cap:f.cap,space:f.space,siteSpace:site.space}})()`);
  assert(r.moveAllowed, "the fleet fits the workshop today, so the move itself should be allowed");
  assert(r.facility === "workshop", "the move did not complete");
  assert(r.daysOverCapacity === 0, `the site was over capacity on ${r.daysOverCapacity} of 150 days: crates were racked against the warehouse and landed in the workshop`);
  assert(r.within, `the fleet ended outside its site: ${r.kw} kW against ${r.cap} kW, ${r.space} units against ${r.siteSpace}`);
  /* And the machines are held, not destroyed. Refusing to rack them is only acceptable
     because they stay on the books and go in as soon as there is somewhere to put them. */
  assert(r.installed + r.crated === 420, `machines went missing: ${r.installed} racked + ${r.crated} crated`);
  assert(r.installed > 0, "nothing was racked at all; the bay has stopped working rather than started measuring");
});

rule("a downsize counts the machines still being commissioned, not just the installed ones", () => {
  /* Crates already paid for arrive whether or not the site shrank under them. This was a real
     stranding: 20 machines installed, 200 mid-commission, the workshop accepted the move, and
     the floor landed 5x over its power cap with no way back. The guard has to price the inbound. */
  const r = json(`(()=>{${SITE(`state.time=at("2021-06-01");state.facility="warehouse";
    state.region="texas";state.cash=1e8;state.hardware={s19:20};
    state.thermal={temperature:22,orders:[],equipment:{axial:2}};
    state.commissioningJobs=[{id:"s19",qty:200,done:0,started:state.time,due:state.time+10*DAY,days:10}];`)}
    const reason=facilityDownsizeBlockReason("workshop");
    downsizeFacility("workshop");
    const dispatched=!!state.facilityUpgradeJob;
    let over=false;
    for(let d=0;d<60;d++){tick(true);if(!fleet().within)over=true}
    return {reason,dispatched,everOverCapacity:over,facility:state.facility,
      within:fleet().within,kw:+fleet().potentialKw.toFixed(1),cap:fleet().cap,
      installed:state.hardware.s19}})()`);
  assert(r.reason !== "", "the workshop accepted a move with 200 machines mid-commission; it cannot hold them");
  assert(/commission/i.test(r.reason), `the refusal should say the inbound hardware is the reason, but read: ${r.reason}`);
  assert(!r.dispatched, "the move was dispatched despite being refused");
  assert(r.installed === 220, `the 200 commissioning machines should still land, got ${r.installed}`);
  assert(!r.everOverCapacity, "the site went over capacity at some point in the 60 days after the refusal");
  assert(r.within, `the fleet ended outside its site: ${r.kw} kW against ${r.cap} kW`);
});

rule("the cooling plant a smaller site cannot host is sold with the site", () => {
  const moved = json(`(()=>{${SITE(`state.time=at("2019-06-01");state.facility="warehouse";
    state.region="texas";state.cash=5e6;state.hardware={};state.hardware.s9=40;
    state.thermal={temperature:22,orders:[],equipment:{drycooler:2,evap:3,axial:4}};`)}
    const shed=facilityCoolingShed("workshop");
    const blockedBefore=facilityDownsizeBlockReason("workshop");
    const cashBefore=state.cash;
    downsizeFacility("workshop");
    return {shedIds:shed.items.map(i=>i.id),credit:shed.credit,blockedBefore,
      job:state.facilityUpgradeJob&&state.facilityUpgradeJob.id,
      equipmentAfter:state.thermal.equipment,netCash:cashBefore-state.cash,
      cost:facilityDownsizeCost(FACILITIES.find(f=>f.id==="workshop"))}})()`);
  assert(moved.blockedBefore === "", `a 40-machine fleet should reach a workshop once the plant is shed, but: ${moved.blockedBefore}`);
  assert(moved.job === "workshop", "the move was not dispatched");
  /* A light industrial unit is tier 3. Dry coolers (6-8) and evaporative banks (5-7) are plant
     it cannot host; axial fans (3-5) are exactly what it can. The band is two-sided on purpose:
     a box fan rated for a spare room is no more installable in an industrial unit than a dry
     cooler is, so "what this site can host" is the only question asked. */
  assert(moved.shedIds.includes("drycooler") && moved.shedIds.includes("evap"), `plant the workshop cannot host was kept: ${moved.shedIds}`);
  assert(!moved.shedIds.includes("axial"), "plant the smaller site CAN host was sold anyway");
  assert(!("drycooler" in moved.equipmentAfter) && !("evap" in moved.equipmentAfter), "the shed plant is still installed");
  assert(moved.equipmentAfter.axial === 4, "the axial fans did not survive the move");
  assert(moved.credit > 0 && moved.netCash === moved.cost - moved.credit,
    `salvage was not credited (net ${moved.netCash}, expected ${moved.cost} - ${moved.credit})`);
});

rule("a move down the ladder still carries transit risk", () => {
  const risk = json(`(()=>{${SITE(`state.time=at("2016-06-01");state.facility="warehouse";state.region="texas";`)}
    return {down:facilityMoveRisk("workshop"),up:facilityMoveRisk("campus"),same:facilityMoveRisk("warehouse")}})()`);
  assert(risk.same === 0, "staying put cannot be risky");
  assert(risk.down > 0, "machines are unracked, driven and re-racked; that cannot be free of risk");
  assert(risk.down < risk.up, "moving down should be less hazardous than an expansion, not more");
});

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
          // A plan you cannot buy here is not a choice available here.
          if(!connectivityAvailable(p))continue;
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
  /* Measured by running the clock, not by reading the plan table: the table can declare a
     failover the tick never applies, and a source match cannot see that gap.

     Measured over MANY SHORT RUNS rather than one long one. The connectivity branch only fires
     on days the grid branch did not, so a single 2,900-day run yielded nought to two outages
     per arm depending on where the shared random stream happened to be — which meant an
     unrelated change elsewhere in the tick could decide whether this rule had any evidence at
     all. It did exactly that when mining income stopped landing in the hot wallet every day:
     the hot-wallet risk check began short-circuiting, the stream shifted, and this rule lost
     its sample. Ten independent seeds give it enough outages per arm and a verdict
     that does not move. */
  const measured = json(`(()=>{
    const out={};
    for(const plan of ["fixed","sim"]){
      const spells=[];let days=0;
      for(let seed=1;seed<=10;seed++){
        ${SITE(``)}
        // A container yard in a jurisdiction with a poor record: the highest connectivity
        // fault rate the game offers, so both arms actually see incidents.
        state.time=at("2021-06-01");state.facility="container";state.region="kazakhstan";
        state.hardware={s19:200};state.connectivity=plan;
        state.seed=seed*7919;state.rng=seed*7919;
        const startedAt=state.time;
        for(let d=0;d<300;d++){
          const before=state.ops.outageUntil;
          tick();
          if(state.ops.outageUntil&&state.ops.outageUntil!==before&&state.ops.outageUntil>state.time)
            spells.push((state.ops.outageUntil-state.time)/DAY);
        }
        days+=(state.time-startedAt)/DAY;
      }
      out[plan]={spells,days};
    }
    return out;})()`);
  for (const plan of ["fixed", "sim"]) {
    assert(measured[plan].days > 2500, `the ${plan} arm only advanced ${measured[plan].days} days, so this rule proves nothing`);
    assert(measured[plan].spells.length >= 4, `the ${plan} arm saw ${measured[plan].spells.length} outages, which is too few to average`);
  }
  // Compared as a ratio of mean duration rather than against a fixed number of days: the
  // base outage length scales with a jurisdiction's fault rate, so in a bad one even a
  // fifteen-percent outage can run past a day without anything being wrong.
  const mean = a => a.reduce((sum, v) => sum + v, 0) / a.length;
  const failover = mean(measured.sim.spells), plain = mean(measured.fixed.spells);
  assert(failover < plain * .4,
    `dual-SIM outages average ${failover.toFixed(2)} days against fixed broadband's ${plain.toFixed(2)}; the failover is declared but the clock is not applying it`);
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

/* ---- KEYS: devices, keys and wallets are three different things ---- */

const CUSTODY_SITE = (overrides = "") => `
  ${SITE(``)}
  state.skills=["backups","counterparty","multisig"];state.cash=1e7;
  state.facility="warehouse";state.region="na";state.hardware={};
  state.wallets={hot:10,cold:40,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
  state.custody={devices:[],keys:[],policy:"single",assigned:[],configBackedUp:false,
    orders:[],parts:{},builds:[],exposure:[],seq:0,lastScare:0};
  state.coldSpends=[];
  ${overrides}`;

/* A wallet that is actually finished: distinct seeds, durable backups, assigned to the policy,
   and — for a quorum — the descriptor written down too. Several rules need a wallet that can
   really sign rather than one that merely has a policy set on it, and building it by hand in
   each of them is how they drift apart. */
const CONFIGURED_WALLET = (policy = "2of3") => `
  setCustodyPolicy("${policy}");
  state.custody.keys=[];state.custody.assigned=[];
  for(let i=0;i<custodyPolicy("${policy}").keys;i++){
    const id="k"+i;
    state.custody.keys.push({id,seed:"s"+i,label:"KEY "+i,weakEntropy:false,
      backup:{durability:"steel"}});
    state.custody.assigned.push(id);
  }
  state.custody.configBackedUp=true;`;

rule("three devices holding one seed are still one key", () => {
  const result = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2021-02-01");`)}
    for(let i=0;i<3;i++)orderCustodyProduct("jade",1);
    for(let i=0;i<16;i++)tick();
    generateCustodyKey(state.custody.devices[0].uid);
    const seed=state.custody.keys[0];
    restoreCustodyKey(state.custody.devices[1].uid,seed.id);
    restoreCustodyKey(state.custody.devices[2].uid,seed.id);
    setCustodyPolicy("2of3");
    assignCustodyKey(seed.id);assignCustodyKey(seed.id);
    const set=custodySetup();
    return {devices:state.custody.devices.length,assigned:state.custody.assigned.length,
      distinct:set.distinct,ready:set.ready};})()`);
  assert(result.devices === 3, "the three devices did not arrive");
  assert(result.distinct === 1, `three devices on one seed counted as ${result.distinct} keys`);
  assert(!result.ready, "a 2-of-3 built from a single seed counts as configured, which is a single-signature wallet in three boxes");
});

rule("a quorum wallet needs its configuration, not just its seeds", () => {
  const r = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2021-02-01");`)}
    setCustodyPolicy("2of3");
    for(let i=0;i<3;i++)orderCustodyProduct("jade",1);
    orderCustodyProduct("steelplate",3);
    for(let i=0;i<20;i++)tick();
    for(const d of state.custody.devices)generateCustodyKey(d.uid);
    for(const k of state.custody.keys){assignCustodyKey(k.id);backupCustodyKey(k.id,"steelplate")}
    const withoutConfig={loss:custodyLossRisk(),recoverable:custodyRecoverable()};
    backupCustodyConfig();
    const withConfig={loss:custodyLossRisk(),recoverable:custodyRecoverable()};
    // and a fully backed-up single-sig, for comparison
    const multi=custodyCompromiseFactor();
    setCustodyPolicy("single");
    const single=custodyCompromiseFactor();
    return {withoutConfig,withConfig,multi,single};})()`);
  assert(!r.withoutConfig.recoverable, "a multisig with every seed backed up but no descriptor reports as recoverable, which is how people have really lost coins");
  assert(r.withConfig.recoverable, "recording the configuration does not make the wallet recoverable");
  assert(r.withConfig.loss < r.withoutConfig.loss * .5, "recording the configuration barely changes the risk of losing access");
  assert(r.multi < r.single, "a spending quorum gives no protection against a compromised key");
});

rule("buying equipment protects nothing until it is configured", () => {
  const r = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2021-02-01");`)}
    const bare=custodyCompromiseFactor();
    orderCustodyProduct("jade",1);
    for(let i=0;i<16;i++)tick();
    const owned=custodyCompromiseFactor();
    generateCustodyKey(state.custody.devices[0].uid);
    const keyed=custodyCompromiseFactor();
    assignCustodyKey(state.custody.keys[0].id);
    const assigned=custodyCompromiseFactor();
    return {bare,owned,keyed,assigned};})()`);
  assert(r.owned === r.bare, "a device sitting in a drawer improves the compromise risk");
  assert(r.keyed === r.bare, "generating a key protects coins before it is assigned to a wallet");
  assert(r.assigned < r.bare, "assigning a key to the wallet changes nothing, so configuration is cosmetic");
});

rule("a build consumes its components and respects its unlock date", () => {
  const r = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2019-01-01");`)}
    const early=custodyProductAvailable(custodyProduct("seedsigner"));
    state.time=at("2021-01-01");
    for(const pid of ["pizero","ssdcamera","sslcd","ssmicrosd"])orderCustodyProduct(pid,1);
    for(let i=0;i<16;i++)tick();
    const stocked={...state.custody.parts};
    const shortfall=custodyBuildShortfall("seedsigner");
    assembleCustodyBuild("seedsigner");
    const afterParts={...state.custody.parts};
    for(let i=0;i<4;i++)tick();
    const device=state.custody.devices[0]||null;
    return {early,stocked,shortfall,afterParts,
      built:device?device.product:null,supplier:device?device.supplier:null};})()`);
  assert(r.early === false, "a SeedSigner can be built before the project existed");
  assert(Object.values(r.stocked).every(n => n >= 1), "the components never arrived");
  assert(r.shortfall === null, "the build reports missing components when every one is in stock");
  assert(Object.values(r.afterParts).every(n => n === 0), `assembly did not consume its components: ${JSON.stringify(r.afterParts)}`);
  assert(r.built === "seedsigner", "the assembly produced no device");
  assert(r.supplier === "selfbuilt", "a self-built signer is attributed to a vendor");
});

rule("a guessable seed is a property of the key, and a quorum survives one of them", () => {
  const r = json(`(()=>{
    const born=(product,when)=>{
      ${CUSTODY_SITE(``)}
      state.time=at(when);orderCustodyProduct(product,1);
      for(let i=0;i<18;i++)tick();
      const d=state.custody.devices.find(x=>x.product===product);
      generateCustodyKey(d.uid);
      return !!state.custody.keys[0].weakEntropy;
    };
    const drained=(build)=>{
      ${CUSTODY_SITE(`state.time=at("2022-06-01");`)}
      build();
      state.time=at("2026-07-30");
      applyEvent(EVENTS.find(e=>e.id==="coldcardentropy"));
      const before=state.wallets.hot+state.wallets.cold;
      for(let i=0;i<6;i++)tick();
      return {before,after:state.wallets.hot+state.wallets.cold};
    };
    const own=(product,when)=>{state.time=at(when);orderCustodyProduct(product,1);
      for(let i=0;i<18;i++)tick();
      return state.custody.devices.find(x=>x.product===product&&!x.keyId);};
    return {
      beforeWindow:born("coldcard","2019-01-01"),
      inWindow:born("coldcardmk4","2022-06-01"),
      differentVendor:born("jade","2022-06-01"),
      singleWeak:drained(()=>{const d=own("coldcardmk4","2022-06-01");generateCustodyKey(d.uid);
        assignCustodyKey(state.custody.keys[0].id)}),
      singleSound:drained(()=>{const d=own("jade","2022-06-01");generateCustodyKey(d.uid);
        assignCustodyKey(state.custody.keys[0].id)}),
      quorumOneWeak:drained(()=>{setCustodyPolicy("2of3");
        for(const p of ["coldcardmk4","jade","bitbox02"]){const d=own(p,"2022-06-01");generateCustodyKey(d.uid)}
        for(const k of state.custody.keys)assignCustodyKey(k.id);backupCustodyConfig()}),
      quorumTwoWeak:drained(()=>{setCustodyPolicy("2of3");
        for(const p of ["coldcardmk4","coldcard","jade"]){const d=own(p,"2022-07-01");generateCustodyKey(d.uid)}
        for(const k of state.custody.keys)assignCustodyKey(k.id);backupCustodyConfig()}),
    };})()`);
  const lost = x => x.before - x.after > 0.01;
  assert(r.inWindow, "a seed generated on an affected device inside the window is not marked weak");
  assert(!r.beforeWindow, "a seed generated before the defect existed is marked weak");
  assert(!r.differentVendor, "a seed from a different vendor is caught by this vendor's defect");
  assert(lost(r.singleWeak), "a single-signature wallet on a guessable seed was not swept");
  assert(!lost(r.singleSound), "a wallet with no affected key lost coins anyway");
  assert(!lost(r.quorumOneWeak), "a 2-of-3 was emptied though only one of its three keys was guessable");
  assert(lost(r.quorumTwoWeak), "a 2-of-3 whose quorum is entirely guessable keys survived, which it must not");
});

rule("a vendor leak reaches that vendor's customers and no one else", () => {
  const r = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2016-08-01");`)}
    const held=state.wallets.hot+state.wallets.cold;
    orderCustodyProduct("nanos",1);      for(let i=0;i<12;i++)tick();
    orderCustodyProduct("trezorone",1);  for(let i=0;i<12;i++)tick();
    state.time=at("2021-06-01");
    orderCustodyProduct("nanox",1);      for(let i=0;i<12;i++)tick();
    applyEvent(EVENTS.find(e=>e.id==="ledgerbreach"));
    const hit=custodyExposedPurchases().map(x=>x.device.product);
    return {hit,held,after:state.wallets.hot+state.wallets.cold,
      owned:state.custody.devices.map(d=>d.product)};})()`);
  assert(r.owned.length === 3, "the three devices did not all arrive");
  assert(r.hit.includes("nanos"), "a device bought from the affected vendor inside the window is not exposed");
  assert(!r.hit.includes("trezorone"), "a different vendor's customer was caught by this vendor's leak");
  assert(!r.hit.includes("nanox"), "a purchase made after the window closed was caught by the leak");
  assert(Math.abs(r.after - r.held) < 1e-9, "the disclosure moved coins by itself, which a customer-data breach does not do");
});

rule("moving coins between wallets conserves them, and leaving cold takes signing", () => {
  const r = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2021-02-01");`)}
    ${CONFIGURED_WALLET("2of3")}
    const before=state.wallets.hot+state.wallets.cold;
    transfer("cold","hot",.5);
    /* Cold storage protects coins by making them hard to spend, which necessarily includes
       hard for their owner. The coins have left cold and have not arrived: they are in flight,
       still the operator's, and not yet spendable. */
    const inflight={hot:state.wallets.hot,cold:state.wallets.cold,jobs:state.coldSpends.length,
      pending:coldSpends().reduce((a,j)=>a+(Number(j.gross)||0),0),days:coldSpendDays()};
    /* Driven through tick(), not by calling the advance directly: a rule that calls the helper
       proves the helper works and passes with the tick call deleted. */
    let ticks=0;
    while(state.coldSpends.length&&ticks<40){tick(true);ticks++}
    const after=state.wallets.hot+state.wallets.cold;
    return {before,inflight,ticks,after,fee:before+inflight.pending-after-inflight.pending,
      settled:before-after};})()`);
  assert(r.inflight.jobs === 1, "leaving cold storage completed instantly, so cold storage costs nothing");
  assert(r.inflight.pending > 0, "coins left cold storage and went nowhere");
  /* A 2-of-3 is two keys in two places, and every signature beyond the first is another
     journey. It must take longer than a single key would. */
  assert(r.inflight.days >= 2, `a 2-of-3 cold spend took ${r.inflight.days} day; a quorum is kept apart on purpose`);
  assert(r.ticks > 0 && r.ticks <= r.inflight.days + 1, `the signing took ${r.ticks} ticks against an estimate of ${r.inflight.days}`);
  assert(r.settled > 0, "the completed transfer cost nothing");
  assert(r.settled < .001, `a transfer cost ${r.settled} BTC, which is not a network fee`);
});

rule("a quorum you cannot assemble is permanent, not slow", () => {
  const r = json(`(()=>{
    ${CUSTODY_SITE(`state.time=at("2021-02-01");`)}
    ${CONFIGURED_WALLET("2of3")}
    const ok=coldSpendBlockReason();
    // Take the keys away: the policy still demands three, and nothing satisfies it.
    state.custody.assigned=[];
    const broken=coldSpendBlockReason();
    const held=state.wallets.cold;
    transfer("cold","hot",.5);
    return {ok,broken,held,coldAfter:state.wallets.cold,jobs:state.coldSpends.length}})()`);
  assert(r.ok === "", `a configured 2-of-3 refused to sign: ${r.ok}`);
  /* Not a delay — a wall, and one that says which wall it is. This is the lesson a "back up
     your keys" sentence cannot teach: a backup is a belief until you restore from it. */
  assert(/keys/i.test(r.broken), "an unsatisfiable quorum gave no reason, or the wrong one");
  assert(r.jobs === 0 && r.coldAfter === r.held,
    "coins left a wallet that cannot produce a signature");
});

/* ---- SOLVENCY: paying a bill and earning it are not the same thing ---- */

rule("a bill met by selling the treasury is not a solvent month", () => {
  const r = json(`(()=>{
    const run=(startingCash)=>{
      ${SITE(``)}
      state.time=at("2017-01-01");state.facility="warehouse";state.region="na";
      state.hardware={s9:100};state.cash=startingCash;state.treasuryPolicy="cover";
      state.wallets={hot:1000,cold:0,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
      state.projectLoan=0;state.debt=0;state.arrearsDue=0;
      state.operator=Object.assign(state.operator,{restructures:0,bridgeLoans:0,
        profitableMonths:0,solventMonths:0,totalMonths:0,competitiveMonths:0});
      Object.values(state.operator.eras).forEach(e=>{e.months=0;e.solvent=0;e.profitable=0;e.uptime=0;e.competitive=0});
      for(let i=0;i<420&&!state.ended;i++){
        tick();
        if(state.pendingSettlement){
          treasurySaleForSettlement(state.pendingSettlement.due,true);
          if(state.cash+1e-8>=state.pendingSettlement.due)finishMonthlySettlement("btc-rescue");
          else enterReceivership();
        }
      }
      return {solvent:state.operator.solventMonths,months:state.operator.totalMonths,
        btcLeft:state.wallets.hot};
    };
    return {funded:run(1e9),liquidating:run(0)};})()`);
  assert(r.funded.months > 6, "the funded run did not reach enough month boundaries to compare");
  assert(r.funded.solvent === r.funded.months,
    `an operation paying every bill from cash recorded ${r.funded.solvent} solvent months of ${r.funded.months}`);
  assert(r.liquidating.months > 6, "the liquidating run did not reach enough month boundaries to compare");
  assert(r.liquidating.solvent === 0,
    `an operation funding itself by selling its treasury recorded ${r.liquidating.solvent} solvent months, as though it had earned the money`);
  assert(r.liquidating.btcLeft < 1000, "the liquidating run never actually sold anything, so this rule proves nothing");
});

rule("an operation with nothing left to sell reaches an end", () => {
  const r = json(`(()=>{
    ${SITE(``)}
    state.time=at("2017-01-01");state.facility="warehouse";state.region="na";
    state.hardware={s9:100};state.cash=0;state.treasuryPolicy="hodl";
    state.wallets={hot:0,cold:0,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
    state.projectLoan=0;state.debt=0;state.arrearsDue=0;state.gridCutAnnounced=false;
    state.operator=Object.assign(state.operator,{restructures:0,bridgeLoans:0});
    let days=0;
    for(let i=0;i<2000&&!state.ended;i++){
      tick();days++;
      // only moves the interface permits: deferral is barred once arrears are carried
      if(state.pendingSettlement){ if(state.debt<=0)deferSettlement(); else enterReceivership(); }
    }
    return {days,ended:state.ended,reason:state.endReason};})()`);
  assert(r.ended, `a broke operation with no coins and no credit ran for ${r.days} days without the run ever ending`);
  assert(r.days < 400, `it took ${r.days} days for a hopeless position to resolve, which is too long to be a consequence`);
});

/* ---- SPENDING: the one path where coins leave and nothing financial comes back ---- */

rule("spending on a gift card takes the coins, pays experience, and respects its dates", () => {
  const r = json(`(()=>{
    ${SITE(``)}
    state.time=at("2013-12-01");state.facility="warehouse";state.region="na";state.hardware={};
    state.wallets={hot:20,cold:0,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
    state.giftCards={spentBtc:0,spentUsd:0,cards:0};state.xp=normalizeXp(state.xp);
    const price=priceAt(state.time);
    const before={hot:state.wallets.hot,xp:state.xp.total,spend:state.xp.sources.spend};
    buyGiftCard("gyft",100);
    const after={hot:state.wallets.hot,xp:state.xp.total,spend:state.xp.sources.spend,
      spentBtc:state.giftCards.spentBtc,cards:state.giftCards.cards};
    // a vendor that does not exist yet, and a date before anything had a price
    state.time=at("2012-01-01");const beforeEarly=state.wallets.hot;buyGiftCard("gyft",25);
    const earlyMoved=state.wallets.hot!==beforeEarly;
    state.time=at("2010-01-01");const beforeMarket=state.wallets.hot;buyGiftCard("gyft",25);
    const preMarketMoved=state.wallets.hot!==beforeMarket;
    return {before,after,price,earlyMoved,preMarketMoved,
      curve:[10,100,5000].map(u=>giftCardXpFor(u))};})()`);
  close(r.before.hot - r.after.hot, 100 / r.price, 1e-9, "the coins taken do not match the card's price in bitcoin");
  close(r.after.spentBtc, 100 / r.price, 1e-9, "the ledger of what was spent does not match what left the wallet");
  assert(r.after.cards === 1, "the card was not recorded");
  assert(r.after.xp > r.before.xp, "spending bitcoin taught the operator nothing");
  assert(r.after.spend > r.before.spend, "the experience was awarded but not attributed to spending");
  assert(!r.earlyMoved, "coins were spent at a vendor that did not take bitcoin yet");
  assert(!r.preMarketMoved, "a gift card was priced in bitcoin before bitcoin had a price");
  assert(r.curve[2] < r.curve[0] * 30,
    `experience scales too close to linearly with spend (${r.curve.map(Math.round).join(", ")}), so buying one enormous card would be the whole game`);
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

/* The carve-out above is only honest while it stays narrow: plant excused from the $/kW
   comparison has to earn its place by holding miners, and has to actually be reachable. */
rule("cooling plant excused from the cost ladder earns it by holding miners", () => {
  const problems = json(`(()=>{
    const out=[];
    for(const item of COOLING_EQUIPMENT){
      if(!item.units)continue;
      if(!(item.units>0))out.push(item.id+" claims a unit capacity that is not a positive number");
      if(!(item.coolingKw>0))out.push(item.id+" rejects no heat");
      if(item.minTier>item.maxTier)out.push(item.id+" is available at no facility tier");
    }
    return out;})()`);
  assert(problems.length === 0, `plant excused from the ladder does not justify itself: ${problems.join("; ")}`);
});


/* Plant carrying a unit capacity is not competing on heat rejection alone — an immersion
   tank also holds the miners and changes what they do, so it is bought for reasons this
   comparison cannot see, and is expected to lose on dollars per kilowatt. The companion rule
   above stops that becoming an excuse for any plant to be dominated. */
rule("no cooling plant is beaten on both cost and efficiency at the same tier", () => {
  const problems = json(`(()=>{
    const out=[];
    for(let tier=1;tier<=FACILITIES.length;tier++){
      const avail=COOLING_EQUIPMENT.filter(c=>tier>=c.minTier&&tier<=c.maxTier&&!c.units);
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

rule("key backups reduce the risk, and a configured wallet reduces it further", () => {
  // Multisig used to be a flat modifier attached to the skill. It is now a property of the
  // wallet you actually built, so the skill unlocks the policy and the setup earns the
  // protection. Owning the skill and configuring nothing must change nothing.
  const risks = json(`(()=>{
    const out={};
    for(const skills of [[],["backups"]]){
      ${SITE(``)}
      state.time=at("2014-01-01");state.skills=skills;
      state.wallets={hot:100,cold:100,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
      out[skills.length?skills.join("+"):"none"]=hotWalletIncidentRisk();
    }
    ${CUSTODY_SITE(`state.time=at("2021-02-01");`)}
    state.wallets={hot:100,cold:100,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
    out.skillOnly=hotWalletIncidentRisk();
    setCustodyPolicy("2of3");
    for(let i=0;i<3;i++)orderCustodyProduct("jade",1);
    for(let i=0;i<16;i++)tick();
    for(const d of state.custody.devices)generateCustodyKey(d.uid);
    for(const k of state.custody.keys)assignCustodyKey(k.id);
    state.wallets={hot:100,cold:100,mtgox:0,exchange:0,frozen:0,bitfinex:0,quadriga:0,etf:0,frontier:0};
    out.configured=hotWalletIncidentRisk();
    return out;})()`);
  assert(risks.backups < risks.none, "Key backups does not reduce the risk of losing self-held coins");
  assert(risks.configured < risks.skillOnly,
    "a configured 2-of-3 wallet does not reduce the compromise risk, so the whole custody model is decorative");
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


/* ---- IMMERSION: a trade, not an upgrade ---- */

rule("submerging a miner buys hash with power, in the advertised proportions", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2022-06-01");state.facility="warehouse";state.region="na";
      state.hardware={s19:300};state.thermal.equipment.immersion=2;
      state.maintenance.inventory.immersionKit=400;`)}
    const before={hash:fleet().hash,watts:fleet().minerW};
    convertToImmersion("s19",300);
    const after={hash:fleet().hash,watts:fleet().minerW,converted:immersionTotal()};
    return{before,after};})()`);
  assert(r.after.converted === 300, `only ${r.after.converted} of 300 units were converted`);
  /* Stated as literals rather than read back from the engine's own constants: a rule that
     asks the engine what it intends and then checks it did that is vacuous, and passes
     happily when the gain is set to nothing. */
  const hashGain = r.after.hash / r.before.hash, powerGain = r.after.watts / r.before.watts;
  assert(hashGain > 1.15 && hashGain < 1.45, `converting changed hash rate by ${hashGain.toFixed(3)}x, which is not a meaningful overclock`);
  assert(powerGain > 1.15 && powerGain < 1.6, `converting changed power draw by ${powerGain.toFixed(3)}x`);
  /* The trade has to point the right way. Immersion does not make a miner efficient — it
     makes headroom usable — so joules per hash must get WORSE, or the choice is free. */
  assert(powerGain > hashGain, `immersion improved efficiency (${hashGain.toFixed(3)}x hash for ${powerGain.toFixed(3)}x power), so converting is a free upgrade rather than a trade`);
});

rule("a submerged fleet stops heating the room it stands in", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2022-07-01");state.facility="warehouse";state.region="texas";
      state.hardware={s19:300};state.thermal.equipment.immersion=2;
      state.maintenance.inventory.immersionKit=400;`)}
    const before={room:roomHeatWatts(),total:activeMinerWatts(),target:thermalTargetC()};
    convertToImmersion("s19",300);
    const after={room:roomHeatWatts(),total:activeMinerWatts(),target:thermalTargetC()};
    return{before,after};})()`);
  assert(r.after.total > r.before.total, "converted miners should draw more from the meter, not less");
  assert(r.after.room < r.before.room * .2, `room heat only fell from ${Math.round(r.before.room)}W to ${Math.round(r.after.room)}W`);
  assert(r.after.target < r.before.target - 3, `room target barely moved: ${r.before.target.toFixed(1)}C to ${r.after.target.toFixed(1)}C`);
});

rule("tank capacity is a real limit on how much can be submerged", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2022-06-01");state.facility="warehouse";
      state.hardware={s19:400};state.thermal.equipment.immersion=1;
      state.maintenance.inventory.immersionKit=900;`)}
    convertToImmersion("s19",400);
    return{converted:immersionTotal(),capacity:immersionCapacity(),free:immersionFree()};})()`);
  assert(r.converted === r.capacity, `converted ${r.converted} units into ${r.capacity} slots`);
  assert(r.free === 0, "a full tank still reports free slots");
});

rule("a machine with no fans left cannot suffer a fan fault", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2022-06-01");state.facility="warehouse";
      state.hardware={s19:150};state.thermal.equipment.immersion=1;
      state.maintenance.inventory.immersionKit=200;`)}
    const h=HARDWARE.find(x=>x.id==="s19"),fanTier=fanTierFor(h);
    const air=immersionAdjustedWeights(h,partFaultWeights(h));
    convertToImmersion("s19",150);
    const wet=immersionAdjustedWeights(h,partFaultWeights(h));
    return{fanTier,airHasFan:fanTier in air,wetHasFan:fanTier in wet,share:immersionShare(h)};})()`);
  assert(r.airHasFan, "an air-cooled ASIC should be able to lose a fan");
  assert(r.share === 1, `only ${r.share} of the type is submerged`);
  assert(!r.wetHasFan, "a fully submerged type can still suffer a fan fault");
});

rule("immersion is not available before it existed", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2019-06-01");state.facility="warehouse";
      state.hardware={s19:150};state.thermal.equipment.immersion=1;
      state.maintenance.inventory.immersionKit=200;`)}
    const h=HARDWARE.find(x=>x.id==="s19");
    return{reason:immersionBlockReason(h,1),date:immersionTankDef().date};})()`);
  assert(r.date >= "2020-01-01", `immersion tanks are dated ${r.date}, which is early for single-phase mining deployments`);
  assert(/not available until/.test(r.reason), `a 2019 site was not told immersion does not exist yet: "${r.reason}"`);
});

/* ---- THERMAL PASTE: a consumable you notice only when it is missing ---- */

rule("a hashboard swap consumes thermal paste", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2020-06-01");state.facility="warehouse";
      state.hardware={s19:16};state.maintenance.condition={s19:40};
      state.maintenance.faultsByPart={s19:{hashboardmodern:8}};
      state.maintenance.inventory.thermalpaste=5;`)}
    state.maintenance.serviceJobs=[{id:"s19",count:8,part:"hashboardmodern",crew:1,totalDays:1,stage:99}];
    state.time+=DAY*3;advanceMaintenance();
    return{paste:state.maintenance.inventory.thermalpaste,
      condition:maintenanceCondition(HARDWARE.find(h=>h.id==="s19")),
      marked:dryFitActive(HARDWARE.find(h=>h.id==="s19"))};})()`);
  assert(r.paste === 4, `a hashboard job consumed ${5 - r.paste} tubes rather than 1`);
  assert(r.condition > 65, `a properly pasted repair left the type at ${r.condition.toFixed(1)}%, below the offline threshold`);
  assert(!r.marked, "a properly pasted repair still marked the type as dry-fitted");
});

/* The point of the consumable is the penalty for skipping it, so assert the penalty rather
   than only the deduction — and assert it stops short of stranding the fleet, because a
   repair that leaves a machine below the offline threshold is a soft-lock over $12. */
rule("skipping thermal paste costs condition and comes back, but never strands the fleet", () => {
  const r = json(`(()=>{
    const shot=stock=>{
      ${SITE(`state.time=at("2020-06-01");state.facility="warehouse";
        state.hardware={s19:16};state.maintenance.condition={s19:40};
        state.maintenance.faultsByPart={s19:{hashboardmodern:8}};`)}
      state.maintenance.inventory.thermalpaste=stock;
      state.maintenance.serviceJobs=[{id:"s19",count:8,part:"hashboardmodern",crew:1,totalDays:1,stage:99}];
      state.time+=DAY*3;advanceMaintenance();
      const h=HARDWARE.find(x=>x.id==="s19");
      return{condition:maintenanceCondition(h),marked:dryFitActive(h),factor:dryFitFailureFactor(h)};
    };
    return{wet:shot(5),dry:shot(0)};})()`);
  assert(r.dry.marked, "a dry-fitted repair left no elevated failure mark");
  assert(r.dry.factor > 1, `a dry-fitted type carries a failure factor of ${r.dry.factor}`);
  assert(!r.wet.marked, "a pasted repair was marked dry-fitted");
  assert(r.dry.condition > 65, `dry-fitting stranded the type at ${r.dry.condition.toFixed(1)}%, below the 65% offline threshold`);
});


/* ---- REPAIRS: a job that needs you must say so ---- */

/* Puzzle state is prepared when the job is created, so initRepairPuzzle() returns false by
   the time the job reaches the Work stage. Hanging the Mine-tab repaint off that return
   value meant arriving at the bench never asked for a redraw: the row sat on a stale earlier
   stage and the puzzle never appeared, however long the clock ran. */
rule("a self-serviced repair asks the tab to repaint when it reaches the bench", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2009-06-01");state.facility="home";state.staff=[];
      state.hardware={laptop:1};state.maintenance.condition={laptop:70};
      state.maintenance.faultsByPart={laptop:{laptopfan:1}};`)}
    state.maintenance.inventory.laptopfan=5;
    serviceHardwarePart("laptop","laptopfan");
    const job=state.maintenance.serviceJobs[0];
    if(!job)return{error:"no job was created"};
    if(!job.contracted)return{error:"a technician-free site did not hand the job to the player"};
    /* Run until the job actually reaches the bench. The stage index changes a tick before
       the Work branch executes, so waiting on the index alone samples too early. */
    let repaints=0,handed=false,guard=0;
    while(!handed&&guard++<200){
      renderFullQueued=false;
      state.time+=DAY;advanceMaintenance();
      const live=state.maintenance.serviceJobs[0];
      if(!live)break;
      if(renderFullQueued)repaints++;
      if(live.handedOver)handed=true;
    }
    const live=state.maintenance.serviceJobs[0];
    return{reached:handed,repaints,handedOver:!!(live&&live.handedOver),
      selfAuto:!!(live&&live.selfAuto),puzzleType:live&&live.puzzleType};})()`);
  assert(!r.error, r.error);
  assert(r.reached, "the repair never reached the Work stage and was handed to the player");
  assert(r.puzzleType !== undefined, "the job reached the bench with no puzzle prepared");
  assert(r.handedOver, "arriving at the bench did not mark the job as handed to the player");
  assert(r.repaints > 0, "reaching the Work stage never asked the Mine tab to repaint, so the puzzle cannot appear");
});

/* The repaint is a transition, not a state: asking for one on every tick while the job waits
   would repaint the tab forever behind a player who has walked away. */
rule("a repair waiting at the bench does not repaint the tab on every tick", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2009-06-01");state.facility="home";state.staff=[];
      state.hardware={laptop:1};state.maintenance.condition={laptop:70};
      state.maintenance.faultsByPart={laptop:{laptopfan:1}};`)}
    state.maintenance.inventory.laptopfan=5;
    serviceHardwarePart("laptop","laptopfan");
    let guard=0;
    while(guard++<200){
      state.time+=DAY;advanceMaintenance();
      const live=state.maintenance.serviceJobs[0];
      if(!live)return{skipped:true};
      if(live.handedOver)break;
    }
    let extra=0;
    for(let i=0;i<10;i++){renderFullQueued=false;state.time+=DAY;advanceMaintenance();if(renderFullQueued)extra++;}
    return{extra,skipped:false};})()`);
  assert(r.skipped !== true, "the job finished on its own, so the waiting behaviour was never exercised");
  assert(r.extra === 0, `a job idling at the bench asked for ${r.extra} further repaints in ten days`);
});


/* ---- SAVES: an old one must still open ---- */

rule("a save carrying legacy fault counts still loads", () => {
  const legacy = {
    started: true, time: Date.UTC(2016, 5, 1), cash: 5000,
    hardware: { s9: 12 },
    // The pre-split shape: a bare count per machine, with no per-part breakdown to migrate
    // from. This is the branch that reaches for the fault weights.
    maintenance: { condition: { s9: 70 }, faults: { s9: 4 }, parts: 3, inventory: {}, orders: [], serviceJobs: [] }
  };
  const loaded = loadWithSave(legacy);
  assert(loaded.ok, `an old save could not be opened at all: ${loaded.message}`);
  const read = makeEval(loaded.sandbox);
  // Everything declared after the migration must still exist: a throw part-way through
  // simulation.js leaves the rest of the file uninitialised rather than merely skipped.
  assert(read(`typeof ANNOUNCE_WINDOW`) === "number", "simulation.js stopped executing part-way through the save migration");
  const migrated = JSON.parse(read(`JSON.stringify(state.maintenance.faultsByPart.s9||{})`));
  const total = Object.values(migrated).reduce((sum, n) => sum + n, 0);
  assert(total === 4, `four legacy faults became ${total} attributed faults`);
});


/* ---- CAPACITY: the number on the card is the number you can buy ---- */

/* The Mine card worked out its own headroom from live draw while the purchase path enforced
   peak draw. Cooling is thermostatic, so a cold room draws almost nothing and a live-draw
   check passes a fleet that cannot actually run: the card offered 34 machines where the game
   allowed 31, and advertised free floor units that could never be filled. */
rule("what the hardware card offers is what the purchase actually allows", () => {
  const cases = json(`(()=>{
    const out=[];
    // Each case is dated to when its hardware actually exists, or the purchase is refused
    // for a reason that has nothing to do with capacity.
    for(const [facility,fleetShape,overdrive,when] of [
      ["workshop",{s9:40},false,"2018-06-01"],["workshop",{s9:40},true,"2018-06-01"],
      ["warehouse",{s19:120},false,"2021-06-01"],["garage",{gpurig:6},false,"2012-06-01"]]){
      ${SITE(`state.time=at("2018-06-01");state.cash=1e9;state.power=true;`)}
      state.facility=facility;state.hardware=fleetShape;state.overdrive=overdrive;
      state.thermal.equipment={axial:2};
      // The shared site setup does not clear these, and orders carry between cases.
      state.procurementOrders=[];state.inactiveHardware={};state.time=at(when);
      const id=Object.keys(fleetShape)[0],h=HARDWARE.find(x=>x.id===id);
      /* Ask for exactly what the card says is available. Requesting an arbitrary huge number
         only matched the offer back when capacity clamped both to the same figure; now that
         capacity gates the intake instead, the offer is what the card must honour. */
      const offered=hardwarePurchaseLimits(h).fiatMax;
      buyHardware(id,offered);
      const allowed=state.procurementOrders.reduce((sum,o)=>sum+o.qty,0);
      out.push({facility,id,overdrive,offered,allowed});
    }
    return out;})()`);
  for (const row of cases) {
    assert(row.offered === row.allowed,
      `${row.facility} ${row.id}${row.overdrive ? " (overdrive)" : ""}: the card offered ${row.offered} and the game allowed ${row.allowed}`);
  }
  assert(cases.some(row => row.allowed > 0), "no case actually bought anything, so the rule proves nothing");
});

/* Free floor space that power will never let you fill is a promise the game cannot keep, so
   the capacity a player is shown has to be the one that binds. */
rule("the electrical figure shown against capacity is the one that governs purchases", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2018-06-01");state.cash=1e9;state.power=true;`)}
    state.facility="workshop";state.hardware={s9:40};state.thermal.equipment={axial:2};
    const p=plannedFleetProjection();
    return{live:p.kw,peak:p.potentialKw,cap:p.cap};})()`);
  assert(r.peak >= r.live, `peak draw (${r.peak.toFixed(1)}) is below live draw (${r.live.toFixed(1)})`);
  assert(r.peak > r.live, "peak and live draw are identical, so this rule cannot tell them apart");
});


/* ---- THE OPERATOR TREE: skills that do what they say ---- */

/* Ten of twenty-three skills used to need a facility upgrade, and the early Energy branch
   needed one before its first rung, so a 2009 spare-room operator could buy three things and
   then bank points with nothing to spend them on. Saving with no way to spend is not a
   decision, so the shape of the tree is asserted rather than left to drift back. */
rule("an operator can spend points from the first year without upgrading the site", () => {
  const r = json(`(()=>{
    const early=SKILLS.filter(s=>(!s.date||at(s.date)<=at("2009-12-31"))&&!(s.minFacility>1));
    const ungated=SKILLS.filter(s=>!(s.minFacility>1));
    const branches=[...new Set(SKILLS.map(s=>s.branch))];
    return{total:SKILLS.length,early:early.map(s=>s.id),ungated:ungated.length,branches};})()`);
  assert(r.early.length >= 4, `only ${r.early.length} skills are buyable in 2009 at tier 1: ${r.early.join(", ")}`);
  assert(r.ungated >= r.total / 2, `${r.ungated} of ${r.total} skills are reachable without a facility upgrade`);
  assert(r.branches.length >= 5, `the tree has only ${r.branches.length} branches: ${r.branches.join(", ")}`);
});

rule("immersion tuning raises hash without raising the power it costs", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2022-06-01");state.facility="warehouse";
      state.hardware={s19:300};state.thermal.equipment={immersion:2};
      state.maintenance.inventory.immersionKit=400;`)}
    convertToImmersion("s19",300);
    const before={hash:fleet().hash,watts:fleet().minerW};
    state.skills=["immersiontuning"];
    const after={hash:fleet().hash,watts:fleet().minerW};
    return{before,after};})()`);
  assert(r.after.hash > r.before.hash, "immersion tuning did not raise hash rate at all");
  close(r.after.watts, r.before.watts, 1, "immersion tuning changed the power draw");
  const lift = r.after.hash / r.before.hash;
  assert(lift > 1.05 && lift < 1.12, `immersion tuning moved hash by ${lift.toFixed(3)}x, which is not the advertised step from 25% to 35%`);
});

rule("thermal discipline makes a tube of paste go twice as far", () => {
  const r = json(`(()=>{
    const run=skills=>{
      ${SITE(`state.time=at("2020-06-01");state.facility="warehouse";
        state.hardware={s19:32};state.maintenance.condition={s19:40};
        state.maintenance.faultsByPart={s19:{hashboardmodern:16}};`)}
      state.skills=skills;state.maintenance.inventory.thermalpaste=9;
      state.maintenance.serviceJobs=[{id:"s19",count:16,part:"hashboardmodern",crew:1,totalDays:1,stage:99}];
      state.time+=DAY*3;advanceMaintenance();
      return 9-state.maintenance.inventory.thermalpaste;
    };
    return{plain:run([]),skilled:run(["thermalwork"])};})()`);
  assert(r.plain > r.skilled, `a skilled bench used ${r.skilled} tubes against ${r.plain} unskilled`);
  assert(r.skilled >= 1, "thermal discipline made the consumable free, which removes the decision rather than easing it");
});

rule("salvage recovers a fan from every machine retired", () => {
  const r = json(`(()=>{
    const run=skills=>{
      ${SITE(`state.time=at("2016-06-01");state.facility="warehouse";state.hardware={s9:10};`)}
      state.skills=skills;state.maintenance.inventory.asicfan=0;
      // The shared site setup leaves storage alone, and it accumulates between runs.
      state.decommissionedHardware={};state.poweredDownHardware={};state.retirementJobs=[];
      decommissionHardware("s9",4);
      // Retirement is work now, so the fan comes out when the machine does. Run the clock.
      const immediate={fans:state.maintenance.inventory.asicfan,stored:state.decommissionedHardware.s9||0,
        active:state.hardware.s9,jobs:state.retirementJobs.length};
      for(let d=0;d<8;d++){state.time+=DAY;advanceRetirements()}
      return{immediate,fans:state.maintenance.inventory.asicfan,stored:state.decommissionedHardware.s9||0,
        active:state.hardware.s9,jobs:state.retirementJobs.length};
    };
    return{plain:run([]),skilled:run(["salvage"])};})()`);
  assert(r.plain.fans === 0, `retiring machines without the skill produced ${r.plain.fans} fans`);
  assert(r.skilled.fans === 4, `retiring four machines with salvage produced ${r.skilled.fans} fans`);
  assert(r.skilled.stored === 4, "salvage consumed the machines instead of storing them");
  /* Retiring is work, not a state change: nothing has left the racks on the day it is
     ordered, and the machines are still the operator's until the crew has pulled them. */
  assert(r.skilled.immediate.jobs === 1 && r.skilled.immediate.stored === 0 && r.skilled.immediate.active === 10,
    "retirement still empties the racks instantly instead of scheduling the work");
  assert(r.skilled.active === 6 && r.skilled.jobs === 0, "the retirement job never finished");
});

rule("a large retirement empties the racks gradually, not on the last day", () => {
  const r = json(`(()=>{${SITE(`state.time=at("2018-06-01");state.facility="warehouse";state.region="texas";
    state.hardware={};state.hardware.s9=400;state.decommissionedHardware={};state.poweredDownHardware={};
    state.retirementJobs=[];state.commissioningJobs=[];state.procurementOrders=[];state.inactiveHardware={};`)}
    decommissionHardware("s9",400);
    const days=state.retirementJobs[0].days,trace=[];
    /* Driven through tick() rather than by calling the advance directly, so this also proves
       the job is actually wired into the simulation day. Calling the helper by hand tested
       that the helper worked and would have passed with the tick call deleted. */
    for(let d=0;d<days+2;d++){tick(true);
      trace.push({active:state.hardware.s9,stored:state.decommissionedHardware.s9||0,hash:Math.round(fleet().hash/1e12)});}
    return{days,trace}})()`);
  assert(r.days > 1, `retiring 400 machines took ${r.days} day; large-scale work must take time`);
  const midway = r.trace[Math.floor(r.trace.length / 2) - 1];
  /* The point of the ramp: halfway through, half the fleet is out and half is still hashing.
     An instant retirement and a last-day retirement both fail this. */
  assert(midway.active > 0 && midway.active < 400,
    `halfway through the job the rack held ${midway.active} of 400 machines, so the work is not gradual`);
  assert(midway.stored > 0 && midway.stored < 400, "storage fills in one step rather than as the crew works");
  assert(midway.hash > 0, "hash rate collapsed before the machines were actually pulled");
  const end = r.trace[r.trace.length - 1];
  assert(end.active === 0 && end.stored === 400, `the job ended with ${end.active} active and ${end.stored} stored`);
});

rule("air-gapped signing reduces what a key compromise can reach", () => {
  const r = json(`(()=>{
    const factor=skills=>{
      ${SITE(`state.time=at("2016-06-01");`)}
      state.skills=skills;
      return custodyCompromiseFactor();
    };
    return{plain:factor([]),skilled:factor(["airgap"])};})()`);
  assert(r.skilled < r.plain, `air-gapping left the compromise factor at ${r.skilled} against ${r.plain}`);
  assert(r.skilled > 0, "air-gapping made compromise impossible, which no custody arrangement does");
});

rule("firmware hygiene holds cover longer and is hijacked less often", () => {
  const r = json(`(()=>{
    const read=skills=>{${SITE(`state.time=at("2018-06-01");`)}state.skills=skills;
      return{cover:firmwareCoverDays(),risk:firmwareHijackRisk()};};
    return{plain:read([]),skilled:read(["firmwarehygiene"])};})()`);
  assert(r.skilled.cover > r.plain.cover, `cover stayed at ${r.skilled.cover} days`);
  assert(r.skilled.risk < r.plain.risk, `hijack risk stayed at ${r.skilled.risk}`);
  assert(r.skilled.risk > 0, "firmware hygiene removed the risk entirely rather than reducing it");
});

rule("a runbook shortens an outage and a generator carries a short one", () => {
  const r = json(`(()=>{
    const read=skills=>{${SITE(`state.time=at("2018-06-01");`)}state.skills=skills;
      return{eight:outageDays(8),gridEight:gridOutageDays(8),gridTwo:gridOutageDays(2),
        net:connectivityIncidentRisk()};};
    return{plain:read([]),runbook:read(["runbook"]),generator:read(["runbook","standbypower"]),
      dual:read(["dualupstream"])};})()`);
  assert(r.runbook.eight < r.plain.eight, `a runbook left an eight-day outage at ${r.runbook.eight} days`);
  assert(r.generator.gridEight < r.runbook.gridEight, "the generator did not shorten a grid outage further");
  assert(r.generator.gridTwo === 0, `a two-day grid outage still stopped the fleet for ${r.generator.gridTwo} days`);
  assert(r.plain.gridTwo > 0, "a two-day outage stops nobody even without a generator, so the rule proves nothing");
  assert(r.dual.net < r.plain.net, `a second upstream left connectivity risk at ${r.dual.net}`);
});


/* ---- THE PRICE CHART: no reading ahead ---- */

/* This is a historical replay. A chart that sampled past the simulation's own clock would
   hand the player the answer to the only question the game asks, so the series is clipped
   rather than faded — there is nothing drawn to read ahead from. */
rule("the price chart never samples past the simulation's clock", () => {
  const r = json(`(()=>{
    const out=[];
    for(const [when,range] of [["2011-06-01","all"],["2014-03-01","all"],
        ["2017-12-01","1y"],["2021-11-08","all"],["2021-11-08","90d"]]){
      ${SITE(``)}
      state.time=at(when);state.priceChartRange=range;
      const series=priceChartSeries();
      out.push({when,range,points:series.length,
        last:series.length?series[series.length-1][0]:null,
        first:series.length?series[0][0]:null,now:state.time});
    }
    return out;})()`);
  for (const row of r) {
    assert(row.points > 2, `${row.when} at range ${row.range} produced ${row.points} points`);
    assert(row.last <= row.now, `${row.when} at range ${row.range} plotted a point beyond the current date`);
    assert(row.first <= row.last, `${row.when} at range ${row.range} runs backwards`);
  }
});

rule("a shorter chart range is a window on the same series, not a different one", () => {
  const r = json(`(()=>{
    ${SITE(``)}
    state.time=at("2021-11-08");
    const read=range=>{state.priceChartRange=range;const s=priceChartSeries();
      return{first:s[0][0],last:s[s.length-1][0],points:s.length};};
    return{all:read("all"),year:read("1y"),quarter:read("90d")};})()`);
  assert(r.year.first > r.all.first, "the one-year range starts no later than the whole history");
  assert(r.quarter.first > r.year.first, "the ninety-day range starts no later than the one-year range");
  assert(r.all.last === r.year.last && r.year.last === r.quarter.last, "the ranges end on different dates");
  assert(r.quarter.points > 2, "the shortest range collapsed to nothing");
});

/* Before a market existed there was no price, and the chart has to say so rather than draw
   a flat line at whatever the first recorded quote happens to be. */
rule("the chart shows nothing before bitcoin had a price", () => {
  const points = json(`(()=>{
    ${SITE(``)}
    state.time=at("2009-06-01");state.priceChartRange="all";
    return priceChartSeries().length;})()`);
  assert(points === 0, `a 2009 chart plotted ${points} points before any market existed`);
});


/* This game labels recorded, derived and modelled data separately, and says so in its own
   footer. A price chart captioned RECORDED over a modelled continuation would break that
   promise quietly, which is the worst way to break it. */
rule("the price chart says which of its data is recorded and which is modelled", () => {
  const r = json(`(()=>{
    const read=when=>{${SITE(``)}state.time=at(when);state.priceChartRange="all";
      return priceChartProvenance();};
    const readShort=when=>{${SITE(``)}state.time=at(when);state.priceChartRange="90d";
      return priceChartProvenance();};
    return{historic:read("2018-06-01"),spanning:read("2030-01-01"),
      wellPast:readShort("2060-01-01"),cutoff:END};})()`);
  assert(r.historic === "RECORDED", `a wholly historic range was labelled ${r.historic}`);
  assert(/MODELLED/.test(r.spanning), `a range running past the cutoff was labelled ${r.spanning}`);
  assert(r.wellPast === "MODELLED", `a range entirely past the cutoff was labelled ${r.wellPast}`);
});


/* ---- THE SECOND-HAND MARKET ---- */

/* The buy side depreciated but never behaved like a market: you could buy ten thousand
   six-year-old S9s instantly at three percent of list. Used machines exist because somebody
   else is retiring them, so the quantity is finite. */
rule("old hardware is not an unlimited tap", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2021-06-01");state.facility="megacampus";state.cash=1e9;state.power=true;`)}
    state.secondary={stock:{},month:""};state.procurementOrders=[];state.inactiveHardware={};
    for(let m=0;m<18;m++){state.time+=30*DAY;advanceSecondaryMarket(state.time)}
    const h=HARDWARE.find(x=>x.id==="s9");
    const listed=secondaryStock("s9");
    buyHardware("s9",100000);
    const ordered=state.procurementOrders.reduce((sum,o)=>sum+o.qty,0);
    return{channel:hardwareChannel(h),listed,ordered,
      leftListed:secondaryStock("s9"),cash:state.cash};})()`);
  assert(r.channel === "secondary", "a five-year-old machine is still being sold as factory stock");
  assert(r.listed > 0 && r.listed < 5000, `the market listed ${r.listed} units, which is not a finite second-hand supply`);
  assert(r.ordered === r.listed, `asked for 100,000 and got ${r.ordered} against ${r.listed} listed`);
  assert(r.leftListed === 0, `${r.leftListed} units remained listed after buying the lot`);
});

rule("buying a listing takes it off the market", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2021-06-01");state.facility="megacampus";state.cash=1e9;state.power=true;`)}
    state.secondary={stock:{},month:""};state.procurementOrders=[];
    for(let m=0;m<18;m++){state.time+=30*DAY;advanceSecondaryMarket(state.time)}
    const before=secondaryStock("s9");
    buyHardware("s9",Math.max(1,Math.floor(before/2)));
    return{before,after:secondaryStock("s9"),
      ordered:state.procurementOrders.reduce((sum,o)=>sum+o.qty,0)};})()`);
  assert(r.before > 1, `only ${r.before} units were listed, so this rule proves little`);
  assert(r.after === r.before - r.ordered, `bought ${r.ordered} of ${r.before} and ${r.after} remain`);
});

/* Supply follows how many were BUILT, not how fast they are. A first attempt scaled with hash
   rate and gave an S9 generation almost the same supply as an S21 one. */
rule("a later generation has more of itself on the second-hand market", () => {
  const r = json(`(()=>{
    const peak=id=>{const h=HARDWARE.find(x=>x.id===id);
      ${SITE(``)}
      state.time=at(h.date)+Math.round(2.6*365)*DAY;
      return secondaryBaseStock(h);};
    return{gpurig:peak("gpurig"),s5:peak("s5"),s9:peak("s9"),s19:peak("s19"),s21:peak("s21")};})()`);
  assert(r.s9 > r.s5 && r.s19 > r.s9 && r.s21 > r.s19,
    `supply does not grow with generation: ${JSON.stringify(r)}`);
  assert(r.s21 > r.gpurig * 20, `an S21 generation lists ${r.s21} against a GPU rig's ${r.gpurig}, which is not an industrial difference`);
});

/* Nothing is available while the machine is still current, and the tail runs out. */
rule("second-hand supply appears after a generation is retired and dries up later", () => {
  const r = json(`(()=>{
    const h=HARDWARE.find(x=>x.id==="s9");
    const at_=years=>{${SITE(``)}state.time=at(h.date)+Math.round(years*365)*DAY;
      return{stock:secondaryBaseStock(h),channel:hardwareChannel(h)};};
    return{fresh:at_(0.5),early:at_(2),peak:at_(2.6),late:at_(6),ancient:at_(10)};})()`);
  assert(r.fresh.stock === 0 && r.fresh.channel === "factory", "a current machine is already on the second-hand market");
  assert(r.peak.stock > r.early.stock, "supply does not build toward a peak");
  assert(r.late.stock < r.peak.stock, "supply never thins after the peak");
  assert(r.ancient.stock === 0, `a ten-year-old machine still lists ${r.ancient.stock} units`);
});

/* A liquidation is somebody else's fleet arriving at once: the event already softened prices,
   and now it puts the machines behind that discount on the market too. */
rule("a liquidation puts machines on the market as well as cutting the price", () => {
  const r = json(`(()=>{
    const run=glut=>{
      ${SITE(`state.time=at("2021-06-01");`)}
      state.secondary={stock:{},month:""};
      state.hardwareGlut=glut?{discount:.22,until:state.time+400*DAY}:null;
      for(let m=0;m<10;m++){state.time+=30*DAY;advanceSecondaryMarket(state.time)}
      const h=HARDWARE.find(x=>x.id==="s19");
      return{listed:secondaryStock("s19"),price:hardwareUnitCost(h)};
    };
    return{calm:run(false),liquidation:run(true)};})()`);
  assert(r.liquidation.listed > r.calm.listed, `a liquidation listed ${r.liquidation.listed} against ${r.calm.listed} in calm conditions`);
  assert(r.liquidation.price < r.calm.price, "a liquidation did not soften the price");
});

/* A used machine is somebody else's maintenance record. The band is disclosed; the draw is
   not — and a factory machine has no band at all. */
rule("a second-hand machine arrives worn, within a band the player was shown", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2021-06-01");`)}
    const h=HARDWARE.find(x=>x.id==="s9"),fresh=HARDWARE.find(x=>x.id==="s19");
    const band=secondaryConditionRange(h);
    const draws=[];for(let i=0;i<40;i++)draws.push(rollSecondaryCondition(h));
    return{band,min:Math.min(...draws),max:Math.max(...draws),
      distinct:new Set(draws).size,
      freshBand:secondaryConditionRange(fresh),freshChannel:hardwareChannel(fresh)};})()`);
  assert(r.band.spread > 0, "a five-year-old machine arrives with no condition uncertainty at all");
  assert(r.min >= r.band.low && r.max <= r.band.high, `draws ran ${r.min}-${r.max} outside the shown band ${r.band.low}-${r.band.high}`);
  assert(r.distinct > 3, `forty draws produced ${r.distinct} distinct conditions, so it is not really a draw`);
  assert(r.band.high <= 100 && r.band.low >= 55, "the condition band leaves the plausible range");
  assert(r.freshBand.spread === 0, "a machine still sold new arrives with second-hand uncertainty");
});


/* ---- CONNECTIVITY: a miner's internet bill is not a telco account ---- */

/* Mining is not a bandwidth business. A Stratum connection is a few kilobits per second per
   machine, so what a bigger site buys is redundancy and an SLA, not throughput. The ladder
   used to multiply the regional rate by six hundred at megacampus, which billed a farm
   $75,600 a month to carry block templates. */
rule("the internet bill grows with the site gently, not exponentially", () => {
  const r = json(`(()=>{
    const read=(fac,plan)=>{${SITE(`state.time=at("2024-06-01");state.region="na";`)}
      state.facility=fac;state.connectivity=plan;
      return{cost:internetMonthlyCost(),scale:connectivityScale()};};
    return{homeFixed:read("home","fixed"),megaFixed:read("megacampus","fixed"),
      megaFibre:read("megacampus","fiber")};})()`);
  const growth = r.megaFixed.cost / r.homeFixed.cost;
  assert(growth > 3, `the largest site pays only ${growth.toFixed(1)}x the smallest, which is not scaling at all`);
  assert(growth < 20, `the largest site pays ${growth.toFixed(0)}x the smallest for a service carrying block templates`);
  assert(r.megaFibre.cost < 5000, `business fibre at megacampus bills ${Math.round(r.megaFibre.cost)} a month`);
});

/* A satellite terminal is the same hardware and the same monthly fee wherever it points, so
   its price does not follow the local rate and its reliability does not follow the local
   infrastructure. That is the whole proposition, and it makes the plan a bad deal where the
   ground network is good and a transformative one where it is not. */
rule("a satellite link is priced and rated globally, not locally", () => {
  const r = json(`(()=>{
    const read=(region,plan)=>{${SITE(`state.time=at("2024-06-01");`)}
      state.region=region;state.facility="warehouse";state.connectivity=plan;
      return{cost:Math.round(internetMonthlyCost()),risk:connectivityIncidentRisk()};};
    return{naSat:read("na","starlink"),kenyaSat:read("kenya","starlink"),
      naFixed:read("na","fixed"),kenyaFixed:read("kenya","fixed")};})()`);
  assert(r.naSat.cost === r.kenyaSat.cost, `the terminal costs ${r.naSat.cost} in one region and ${r.kenyaSat.cost} in another`);
  close(r.naSat.risk, r.kenyaSat.risk, 1e-9, "satellite incident risk moved with the region");
  // Where the ground network is good it should lose; where it is bad it should win.
  assert(r.naSat.cost > r.naFixed.cost && r.naSat.risk > r.naFixed.risk,
    "satellite beats a good fixed line on both price and reliability, which makes the choice free");
  assert(r.kenyaSat.cost < r.kenyaFixed.cost && r.kenyaSat.risk < r.kenyaFixed.risk,
    "satellite does not beat a poorly served fixed line, so it solves nothing where it should");
});

rule("a satellite link cannot be bought before it existed or where it was not offered", () => {
  const r = json(`(()=>{
    const plan=CONNECTIVITY_PLANS.find(p=>p.id==="starlink");
    const read=(when,region)=>{${SITE(``)}state.time=at(when);state.region=region;state.facility="warehouse";
      return{ok:connectivityAvailable(plan),why:connectivityUnavailableReason(plan)};};
    return{early:read("2016-01-01","na"),now:read("2024-06-01","na"),
      blocked:read("2024-06-01","iran"),date:plan.date};})()`);
  assert(r.date >= "2020-10-01", `the terminal is dated ${r.date}, before the service existed at all`);
  assert(!r.early.ok && /not available until/i.test(r.early.why), `a 2016 site could buy it: "${r.early.why}"`);
  assert(r.now.ok, "the terminal is unavailable even after launch");
  assert(!r.blocked.ok && /not offered/i.test(r.blocked.why), `a sanctioned jurisdiction could buy it: "${r.blocked.why}"`);
});

/* Adding terminals is close to a flat cost, so the plan should not inherit the full ladder. */
/* A plan does not travel with the fleet. Relocating to a jurisdiction that never offered the
   service used to leave the site on it, billed and rated as though nothing had changed. */
rule("relocating away from a plan's coverage falls the site back to a local line", () => {
  const r = json(`(()=>{
    ${SITE(`state.time=at("2024-06-01");`)}
    state.region="na";state.facility="warehouse";state.connectivity="starlink";
    const before=state.connectivity;
    state.region="iran";
    const changed=enforceConnectivityAvailability();
    return{before,changed,after:state.connectivity,
      stillAvailable:connectivityAvailable(connectivityPlan())};})()`);
  assert(r.before === "starlink", "the test never got onto the plan it means to test");
  assert(r.changed, "moving into a region without coverage changed nothing");
  assert(r.after === "fixed", `the site fell back to ${r.after}`);
  assert(r.stillAvailable, "the fallback plan is not itself available");
});

rule("satellite scales by adding terminals rather than by buying a bigger circuit", () => {
  const r = json(`(()=>{
    const read=(fac,plan)=>{${SITE(`state.time=at("2024-06-01");state.region="na";`)}
      state.facility=fac;state.connectivity=plan;return internetMonthlyCost();};
    return{satHome:read("home","starlink"),satMega:read("megacampus","starlink"),
      fixedHome:read("home","fixed"),fixedMega:read("megacampus","fixed")};})()`);
  const sat = r.satMega / r.satHome, fixed = r.fixedMega / r.fixedHome;
  assert(sat < fixed, `satellite scales ${sat.toFixed(1)}x against a fixed line's ${fixed.toFixed(1)}x`);
  assert(sat > 1, "satellite does not scale with the site at all, so a megacampus runs on one dish");
});


/* ---- MATERIALS PLANNING: paying somebody to watch the shelf ---- */

/* `staff` is a raw JS expression evaluated inside the sandbox, not a value to stringify — an
   earlier version stringified it, so passing the variable name set state.staff to the string
   "staff" and every planner in the suite quietly did nothing. */
const PLANNER_SITE = (staffExpr, cash = 1e6, bill = 0) => `
  ${SITE(`state.time=at("2021-06-01");state.facility="warehouse";state.power=true;`)}
  state.hardware={s19:200,s9:60};state.staff=${staffExpr};
  state.cash=${cash};state.bill=${bill};state.debt=0;
  state.maintenance.condition={s19:70,s9:58};
  state.maintenance.faultsByPart={s19:{hashboardmodern:14,asicfan:9},s9:{powerPcb:5}};
  state.maintenance.inventory={};SPARE_PARTS.forEach(p=>state.maintenance.inventory[p.id]=0);
  state.maintenance.orders=[];state.planning={month:""};`;

rule("a materials planner orders what the fleet is short of, and nobody else does", () => {
  const r = json(`(()=>{
    const run=staff=>{${PLANNER_SITE("staff")}
      advanceMaterialsPlanning(state.time);
      return state.maintenance.orders.map(o=>o.type);};
    return{none:run([]),controller:run(["inventorycontroller"]),lead:run(["mrplead"])};})()`);
  assert(r.none.length === 0, `an unstaffed site ordered ${r.none.length} lines by itself`);
  assert(r.controller.length > 0, "an inventory controller ordered nothing at all");
  assert(r.lead.length > r.controller.length, `the lead raised ${r.lead.length} lines against the controller's ${r.controller.length}`);
});

/* The two tiers are different jobs, not the same job at two prices: the junior post covers
   the parts a fleet gets through constantly, the senior one plans the whole bill. */
rule("the junior post covers consumables and the senior post covers everything", () => {
  const r = json(`(()=>{
    const run=staff=>{${PLANNER_SITE("staff")}
      advanceMaterialsPlanning(state.time);
      return [...new Set(state.maintenance.orders.map(o=>o.type))];};
    return{controller:run(["inventorycontroller"]),lead:run(["mrplead"]),
      consumables:PLANNER_CONSUMABLES};})()`);
  const boards = id => /hashboard|powerPcb|coolant|Manifold/i.test(id);
  assert(r.controller.every(id => r.consumables.includes(id)),
    `the controller ordered something that is not a consumable: ${r.controller.join(", ")}`);
  assert(r.lead.some(boards), `the lead ordered no capital parts at all: ${r.lead.join(", ")}`);
});

rule("the senior post orders ahead of the shortfall rather than exactly to it", () => {
  const r = json(`(()=>{
    const run=staff=>{${PLANNER_SITE("staff")}
      const need=partsOutlook().short.find(x=>x.id==="asicfan");
      advanceMaterialsPlanning(state.time);
      const line=state.maintenance.orders.find(o=>o.type==="asicfan");
      return{missing:need?need.missing:0,ordered:line?line.qty:0};};
    return{controller:run(["inventorycontroller"]),lead:run(["mrplead"])};})()`);
  assert(r.controller.ordered === r.controller.missing,
    `the controller ordered ${r.controller.ordered} against a shortfall of ${r.controller.missing}`);
  assert(r.lead.ordered > r.lead.missing,
    `the lead ordered ${r.lead.ordered} against a shortfall of ${r.lead.missing}, so it is not planning ahead`);
});

/* A shelf kept full is not worth losing the grid over. */
rule("a planner never spends the money owed on this month's bill", () => {
  const r = json(`(()=>{
    ${PLANNER_SITE('["mrplead"]', 9000, 8000)}
    advanceMaterialsPlanning(state.time);
    return{cash:state.cash,bill:state.bill,orders:state.maintenance.orders.length};})()`);
  assert(r.cash >= r.bill, `the planner left ${Math.round(r.cash)} against a bill of ${r.bill}`);
});

rule("hiring the senior planner replaces the junior one rather than paying both", () => {
  const r = json(`(()=>{
    ${PLANNER_SITE("[]")}
    hireStaff("inventorycontroller");const junior=[...state.staff];
    hireStaff("mrplead");const senior=[...state.staff];
    hireStaff("inventorycontroller");const down=[...state.staff];
    return{junior,senior,down,payroll:staffMonthlyCost()};})()`);
  assert(r.junior.includes("inventorycontroller"), "the junior post was never hired");
  assert(r.senior.includes("mrplead") && !r.senior.includes("inventorycontroller"),
    `both posts are on the payroll: ${r.senior.join(", ")}`);
  assert(!r.down.includes("inventorycontroller"), "hiring down re-added a post the senior already covers");
});

/* Purchase orders are raised on a cycle. Reordering every simulated day would bury the ledger
   and buy in uselessly small lots. */
/* Two separate properties, and an earlier single rule conflated them: it asserted a cycle but
   only ever proved idempotence, so deleting the month guard passed. Ordering is idempotent
   BECAUSE it counts what is already inbound, which would hide a planner running daily. */
rule("a planner does not re-order what is already on its way", () => {
  const r = json(`(()=>{
    ${PLANNER_SITE('["mrplead"]')}
    advanceMaterialsPlanning(state.time);
    const first=state.maintenance.orders.length;
    state.planning={month:""};                 // force another cycle with the same shortfall
    advanceMaterialsPlanning(state.time);
    return{first,after:state.maintenance.orders.length};})()`);
  assert(r.first > 0, "the planner ordered nothing to begin with");
  assert(r.after === r.first, `a second cycle raised ${r.after - r.first} duplicate lines for stock already inbound`);
});

rule("purchase orders are raised on a monthly cycle, not on every tick", () => {
  const r = json(`(()=>{
    ${PLANNER_SITE('["mrplead"]')}
    // A fresh shortfall every time, so only the cycle guard can stop a second run.
    const clear=()=>{state.maintenance.orders=[];SPARE_PARTS.forEach(p=>state.maintenance.inventory[p.id]=0);};
    advanceMaterialsPlanning(state.time);
    const first=state.maintenance.orders.length;
    clear();
    state.time+=DAY;advanceMaterialsPlanning(state.time);
    const sameMonth=state.maintenance.orders.length;
    clear();
    state.time+=40*DAY;advanceMaterialsPlanning(state.time);
    return{first,sameMonth,nextMonth:state.maintenance.orders.length};})()`);
  assert(r.first > 0, "the planner ordered nothing to begin with");
  assert(r.sameMonth === 0, `the planner raised ${r.sameMonth} more lines the very next day`);
  assert(r.nextMonth > 0, "the planner never ran again in the following month");
});


/* ---- COMMISSIONING: a crew working down a row ---- */

const BUILD_SITE = `
  ${SITE(`state.time=at("2021-06-01");state.facility="megacampus";state.cash=1e8;state.power=true;`)}
  state.hardware={};state.commissioningJobs=[];state.maintenance.condition={};
  state.thermal={temperature:22,orders:[],equipment:{coolingtower:4}};`;

/* A five-hundred-machine order used to earn nothing for twenty-five days and then everything
   at once. The first rack is hashing while the last is still in its box. */
rule("machines come online across the build rather than all on the last day", () => {
  const r = json(`(()=>{
    ${BUILD_SITE}
    state.inactiveHardware={s19:500};
    activateHardware("s19");
    const job=state.commissioningJobs[0];
    const total=job.qty,days=job.days;
    const trail=[];
    for(let d=0;d<days+3;d++){state.time+=DAY;advanceFleetLifecycle();
      trail.push({day:d+1,owned:state.hardware.s19||0,hash:fleet().hash});}
    return{total,days,trail};})()`);
  assert(r.days >= 4, `the build only takes ${r.days} days, so a ramp cannot be observed`);
  const mid = r.trail[Math.floor(r.days / 2) - 1];
  assert(mid.owned > 0, "nothing was hashing halfway through the build");
  assert(mid.owned < r.total, `the whole order was online halfway through: ${mid.owned} of ${r.total}`);
  assert(mid.hash > 0, "machines are counted as owned but contribute no hash rate mid-build");
  const finished = r.trail[r.days - 1];
  assert(finished.owned === r.total, `the build ended with ${finished.owned} of ${r.total} online`);
  const after = r.trail[r.trail.length - 1];
  assert(after.owned === r.total, `machines kept appearing after the build finished: ${after.owned}`);
});

rule("a build racks exactly what was ordered, no more and no less", () => {
  const r = json(`(()=>{
    const run=qty=>{${BUILD_SITE}
      state.inactiveHardware={s19:qty};
      activateHardware("s19");
      for(let d=0;d<60;d++){state.time+=DAY;advanceFleetLifecycle();}
      return{asked:qty,got:state.hardware.s19||0,open:state.commissioningJobs.length};};
    return{one:run(1),odd:run(7),many:run(500)};})()`);
  for (const key of ["one", "odd", "many"]) {
    assert(r[key].got === r[key].asked, `${key}: ordered ${r[key].asked} and ended with ${r[key].got}`);
    assert(r[key].open === 0, `${key}: the job never closed`);
  }
});

/* The deploy award is logarithmic in quantity, so paying it per increment would inflate it
   badly — a sum of small logs is far larger than the log of the sum. */
rule("a build is paid its deployment experience once, not once per rack", () => {
  const r = json(`(()=>{
    ${BUILD_SITE}
    state.inactiveHardware={s19:400};
    state.xp={total:0,level:1,peakLevel:1,bestDifficulty:0,shares:0,sources:{shares:0,record:0,deploy:0,repair:0,spend:0}};
    activateHardware("s19");
    for(let d=0;d<40;d++){state.time+=DAY;advanceFleetLifecycle();}
    const h=HARDWARE.find(x=>x.id==="s19");
    return{paid:state.xp.sources.deploy,
      once:(6+3*Math.log2(1+(h.hash||0)/1e9))*Math.log2(1+400)};})()`);
  close(r.paid, r.once, 1, "deployment experience for one batch");
});

/* Saves written before the ramp carry a due date and nothing else. */
rule("a build already in progress from an older save still completes", () => {
  const r = json(`(()=>{
    ${BUILD_SITE}
    // The shape the old code wrote: quantity and a due date, no start, no progress.
    state.commissioningJobs=[{id:"s19",qty:120,due:state.time+6*DAY}];
    const trail=[];
    for(let d=0;d<10;d++){state.time+=DAY;advanceFleetLifecycle();
      trail.push(state.hardware.s19||0);}
    return{trail,open:state.commissioningJobs.length};})()`);
  assert(r.trail[r.trail.length - 1] === 120, `an old-shaped job delivered ${r.trail[r.trail.length - 1]} of 120`);
  assert(r.open === 0, "an old-shaped job never closed");
  assert(r.trail[2] > 0 && r.trail[2] < 120, `an old-shaped job did not ramp: ${r.trail.join(", ")}`);
});

if (failures.length) {
  console.error(`Engine behaviour: ${failures.length} of ${checked} rules failed\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`Engine behaviour passed: ${checked} rules exercised against a live engine — protocol issuance, order-book depth, power contracts, hardware pricing and resale, settlement, and regional trade-offs`);
