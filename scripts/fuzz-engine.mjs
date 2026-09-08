/* A fuzzer, not a test suite.
   The behavioural rules check things someone thought to ask. This asks nothing: it drives the
   engine with random operator actions for thousands of days and only insists that the world
   stay describable — no NaN, no negative fleet, no negative wallet, no throw. Every stranding
   bug this project has had was reachable this way, because they all end with a number that
   cannot be true. Seeds are fixed so a failure is reproducible: `node scripts/fuzz-engine.mjs 7`
   replays exactly the run that broke. */
import { loadEngine, makeEval } from './engine-harness.mjs';

const SEEDS = process.argv[2] ? [Number(process.argv[2])] : [1,2,3,4,5,6,7,8,9,10,11,12];
const TICKS = 4000;
const failures = [];

for (const seed of SEEDS) {
  const ev = makeEval(loadEngine());
  const out = JSON.parse(ev(`(()=>{
    state.started=true;state.ended=false;state.endDismissed=true;state.storyPause=false;
    state.cash=5e7;state.power=true;state.time=at("2013-01-10");state.facility="garage";
    /* Every skill, because a locked action is an unfuzzed action. Half of this list gates
       something — multisig gates quorum wallets, salvage changes what retirement returns — and
       a run without them drives the refusal path 80 times and the real one never. This costs
       realism the fuzzer does not need: it is asking whether the engine stays consistent, not
       whether the run was winnable. */
    state.skills=SKILLS.map(k=>k.id);
    let s=${seed}>>>0;const rnd=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
    const pick=a=>a[Math.floor(rnd()*a.length)];
    const ids=HARDWARE.map(h=>h.id),fac=FACILITIES.map(f=>f.id);
    const bad=[];const seen=new Set();
    function scan(o,path,d){if(d>4||o==null)return;
      if(typeof o==="number"){if(!Number.isFinite(o))bad.push(path+"="+o);return}
      if(typeof o!=="object")return;if(seen.has(o))return;seen.add(o);
      for(const k of Object.keys(o))scan(o[k],path+"."+k,d+1)}
    const acts=[
      ()=>buyHardware(pick(ids),1+Math.floor(rnd()*50)),
      ()=>decommissionHardware(pick(ids),1+Math.floor(rnd()*30)),
      ()=>sellHardware(pick(ids),1+Math.floor(rnd()*30)),
      ()=>setHardwarePower(pick(ids),rnd()<.5,1+Math.floor(rnd()*20)),
      ()=>upgradeFacility(pick(fac)),
      ()=>transfer(pick(["hot","cold","exchange"]),pick(["hot","cold","exchange"]),rnd()),
      ()=>{state.overdrive=!state.overdrive},
      /* The rest of the operation, because a fuzzer only finds bugs in what it actually drives.
         Cooling, staff, custody, parts and the market all mutate the same state the floor reads. */
      ()=>buyCooling(pick(COOLING_EQUIPMENT.map(c=>c.id))),
      ()=>sellCooling(pick(COOLING_EQUIPMENT.map(c=>c.id))),
      ()=>hireStaff(pick(STAFF.map(r=>r.id))),
      ()=>setCustodyPolicy(pick(["single","2of3","3of5"])),
      ()=>dismissStaff(pick(STAFF.map(r=>r.id))),
      ()=>orderParts(pick(Object.keys(state.maintenance.inventory)),1+Math.floor(rnd()*20)),
      ()=>serviceHardware(pick(ids)),
      ()=>setHardwarePower(pick(ids),true,1+Math.floor(rnd()*20)),
      ()=>setContract(pick(["spot","standard","fixed"])),
      ()=>setPayoutThreshold(pick(PAYOUT_THRESHOLDS)),
      ()=>setPayoutDestination(pick(["hot","cold","exchange"])),
      ()=>buyBtc(pick(["hot","cold","exchange"]),rnd()*0.4),
      ()=>sellBtc(pick(["hot","cold","exchange"]),rnd()*0.4),
      ()=>toggleInsurance(),
      ()=>orderCustodyProduct(pick(CUSTODY_PRODUCTS.map(c=>c.id)),1+Math.floor(rnd()*2)),
      ()=>{const k=(state.custody&&state.custody.keys)||[];if(k.length)assignCustodyKey(pick(k).id)},
    ];
    /* Over capacity is not automatically wrong: overdrive deliberately pushes draw past the
       cap, and that is the operator's decision to make. With overdrive off there is no such
       decision, so a site carrying more than it can hold means machines were racked somewhere
       they should never have been bolted in — which is how every stranding here has started. */
    let ticks=0,err=null,negHw=null,negWallet=null,overCap=null,run=0;
    try{
      for(let i=0;i<${TICKS};i++){
        if(rnd()<.35)acts[Math.floor(rnd()*acts.length)]();
        tick(true);ticks++;
        const ff=fleet();
        if(!ff.within&&!state.overdrive){
          if(++run>3&&!overCap)overCap=run+" days at "+ff.potentialKw.toFixed(1)+" kW into "+
            ff.cap.toFixed(1)+" kW and "+ff.space+" units into "+
            ((FACILITIES.find(x=>x.id===state.facility)||{}).space)+", overdrive off";
        }else run=0;
        if(i%20===0){
          seen.clear();scan(state,"state",0);
          for(const k of Object.keys(state.hardware||{}))
            if(!(state.hardware[k]>=0)&&!negHw)negHw=k+"="+state.hardware[k];
          for(const k of Object.keys(state.wallets||{}))
            if(!(state.wallets[k]>=-1e-9)&&!negWallet)negWallet=k+"="+state.wallets[k];
          if(bad.length>4)break;
        }
      }
    }catch(e){err=String(e&&e.message||e).slice(0,220)}
    return JSON.stringify({ticks,err,nonFinite:bad.slice(0,5),negHw,negWallet,overCap,
      date:dateFmt(state.time,true)})})()`));
  const why = out.err ? `threw: ${out.err}`
    : out.nonFinite.length ? `non-finite state: ${out.nonFinite.join(", ")}`
    : out.negHw ? `negative fleet: ${out.negHw}`
    : out.negWallet ? `negative wallet: ${out.negWallet}`
    : out.overCap ? `site over capacity with overdrive off: ${out.overCap}` : "";
  if (why) failures.push(`seed ${seed} (${out.ticks} ticks, reached ${out.date}) — ${why}`);
}

if (failures.length) {
  console.error("Fuzz failures:\n  " + failures.join("\n  "));
  console.error("\nReplay one with: node scripts/fuzz-engine.mjs <seed>");
  process.exit(1);
}
console.log(`Fuzz passed: ${SEEDS.length} seeds × ${TICKS} days of random operator actions — no throw, no non-finite state, no negative fleet or wallet, no site carrying more than it can hold`);
