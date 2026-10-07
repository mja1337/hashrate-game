"use strict";

/* PEOPLE — who holds a key, what happens when they leave, and how a key is replaced.

   A key is a secret, and a secret that a person knows is a secret that goes when they do. So a key
   can be held by the owner or by somebody on the payroll, and dismissing the person who held it
   does not remove the key from the wallet: it makes it known to someone who no longer works for
   you. That is a different problem from a lost key or a stolen one, and it has a different
   answer, which is the one real operators give: replace the key and move the coins.

   Three things follow:

     EXPOSURE  Dismissing a holder marks every key they ever knew as exposed. An exposed key
               raises the wallet's compromise risk (custody.js) until it is replaced.

     INSIDER   If the exposed keys alone are enough to satisfy the wallet, a former employee can
               spend. That is a monthly chance, halved by a security officer, and it ends only
               when the key is replaced. One exposed key of a 2-of-3 is harmless; the same key in a
               single-signature wallet is the whole wallet.

     ROTATION  Replacing a key is a job, not a click. A new key is generated on a spare signer, every
               coin is swept to the new wallet, which costs the real fee for the weight of the
               coins and takes days, and the wallet's descriptor has to be written down again.
               It also consolidates the coins into one, which is the one thing that makes the next
               spend cheap.

   A stolen backup (places.js) uses the same field and the same answer. A key with a known weak
   seed does too, which is the remedy the entropy advisory has always described.

   Rolls are hashes of the seed, never nextRand(). Loaded after places.js. */

const INSIDER_MONTHLY_RISK=.02,INSIDER_SECURITY_FACTOR=.5,INSIDER_TAKE_FLOOR=.4,INSIDER_TAKE_SPREAD=.4;

/* ---- who holds what -------------------------------------------------------------------- */

function custodyHolder(key){return key&&CUSTODY_HOLDERS.includes(key.holder)?key.holder:"owner"}
function custodyHolderName(id){return id==="owner"?"You":(STAFF.find(r=>r.id===id)?.name||id)}
function custodyHolderAvailable(id){return id==="owner"||(CUSTODY_HOLDERS.includes(id)&&hasStaff(id))}
/* Everyone who has ever known this key. Handing it to someone else does not make the last
   person forget it. */
function custodyKnownBy(key){return new Set([...(key.knownBy||[]),custodyHolder(key)].filter(id=>id!=="owner"))}

function setKeyHolder(keyId,role){
  const key=custodyKey(keyId);if(!key)return;
  if(!custodyHolderAvailable(role))return showToast("Nobody in that post",`${custodyHolderName(role)} is not on your payroll. Hire them first, or keep the key yourself.`,"bad","custody");
  const was=custodyHolder(key);if(was===role)return;
  key.knownBy=[...custodyKnownBy(key)];
  key.holder=role;
  log(`Key ${key.label} now held by ${custodyHolderName(role)}`,was==="owner"?"Was held by you":`Was held by ${custodyHolderName(was)}, who still knows it`,"custody");
  showToast("Key handed over",`${custodyHolderName(role)} now holds ${key.label}.${was!=="owner"?` ${custodyHolderName(was)} still knows it, so dismissing them would still expose it.`:""}`,"info","custody");
  save();render();
}
/* A technician who is busy on a repair crew is not free to sign. */
function custodyHolderDelay(key,s=state){
  if(custodyHolder(key)!=="fieldtech")return 0;
  const techs=fieldTechnicianCount(s);if(techs<=0)return 0;
  const committed=((s.maintenance&&s.maintenance.serviceJobs)||[]).reduce((sum,job)=>sum+(job.contracted?0:Number(job.crew||0)),0);
  return committed>=techs?1:0;
}

/* ---- someone leaves ---------------------------------------------------------------------- */

/* Called after a dismissal, with how many were in the post before. */
function custodyOnDismiss(roleId,countBefore=1){
  if(!state.custody||roleId==="owner")return;
  const hit=[];
  for(const key of custodyAssignedKeys()){
    if(key.exposed||!custodyKnownBy(key).has(roleId))continue;
    // One technician of several held it. Whether it was the one who left is settled by the seed, not by a coin flip.
    if(roleId==="fieldtech"&&countBefore>1&&hashRoll(state.seed,"dismiss",key.id,state.time)>=1/countBefore)continue;
    key.exposed={cause:"former-employee",role:roleId,at:state.time};hit.push(key);
  }
  if(!hit.length)return;
  const name=STAFF.find(r=>r.id===roleId)?.name||roleId,list=hit.map(k=>k.label).join(", ");
  log(`${name} left knowing ${hit.length===1?"a key":"keys"}`,`${list} · replace ${hit.length===1?"it":"them"}`,"custody");
  showToast(`${hit.length===1?"A key is":"Keys are"} now known to a former employee`,
    `${name} knew ${list}. ${hit.length===1?"It stays":"They stay"} in the wallet until ${hit.length===1?"it is":"they are"} replaced, and a former employee is an insider risk for as long as that takes. Rotate ${hit.length===1?"it":"them"} onto a spare signer.`,"bad","custody");
}
/* The wording the dismiss button needs, or "" when nobody's key is at stake. */
function custodyDismissNote(roleId){
  if(!state.custody||roleId==="owner")return "";
  const keys=custodyAssignedKeys().filter(k=>!k.exposed&&custodyKnownBy(k).has(roleId));
  if(!keys.length)return "";
  const name=STAFF.find(r=>r.id===roleId)?.name||roleId;
  return `${name} knows ${keys.map(k=>k.label).join(", ")}. Dismissing them exposes ${keys.length===1?"that key":"those keys"} until you replace ${keys.length===1?"it":"them"}.`;
}

/* ---- the insider ---------------------------------------------------------------------------- */

function insiderMonthlyRisk(){return INSIDER_MONTHLY_RISK*(hasStaff("security")?INSIDER_SECURITY_FACTOR:1)}
/* Whether the keys a former employee knows are enough to spend on their own. */
function custodyInsiderCanSpend(s=state){
  const policy=custodyPolicy(s.custody.policy);
  const seeds=new Set(custodyAssignedKeys(s).filter(k=>k.exposed&&k.exposed.cause==="former-employee").map(k=>k.seed||k.id));
  return seeds.size>0&&seeds.size>=policy.threshold;
}
function advanceInsiderRisk(next){
  if(!state.custody||!custodyInsiderCanSpend())return;
  const hot=state.wallets.hot||0,cold=state.wallets.cold||0,held=hot+cold;if(held<=0)return;
  const month=new Date(next).toISOString().slice(0,7);
  if(hashRoll(state.seed,"insider",month)>=insiderMonthlyRisk())return;
  const taken=held*(INSIDER_TAKE_FLOOR+INSIDER_TAKE_SPREAD*hashRoll(state.seed,"insider-take",month));
  state.wallets.hot=Math.max(0,hot-taken*hot/held);state.wallets.cold=Math.max(0,cold-taken*cold/held);
  const who=custodyAssignedKeys().find(k=>k.exposed&&k.exposed.cause==="former-employee");
  const name=STAFF.find(r=>r.id===(who&&who.exposed.role))?.name||"A former employee";
  log("Coins taken by a former employee",`-${fmtBtc(taken)} · ${name}`,"custody");
  reportCoinLoss({title:"A former employee used a key they still had",kind:"stolen",btc:taken,cause:"insider",from:"self-held keys",
    what:`${name} still knew ${custodyAssignedKeys().filter(k=>k.exposed).map(k=>k.label).join(", ")} and used ${custodyPolicy(state.custody.policy).threshold>1?"enough keys":"it"} to move ${fmtBtc(taken)}.`,
    why:"Dismissing the person who held a key does not remove the key from the wallet. It makes it known to someone with a reason to resent you, and it stays that way until it is replaced.",
    remedy:custodyPolicy(state.custody.policy).threshold>1?"A quorum is what protects you here: one key known to one person spends nothing. Replace the key anyway.":"Replace the key the day someone who held it leaves, and move the coins to the new wallet. In a quorum, one key known to one person is not enough to spend.",tab:"custody"});
}

/* ---- replacing a key ------------------------------------------------------------------------ */

function custodyRotation(c=state.custody){return (c&&c.rotation)||null}
function rotateBlockReason(keyId,deviceUid,s=state){
  const c=s.custody,key=custodyKey(keyId),device=custodyDevice(deviceUid);
  if(custodyRotation(c))return "A rotation is already under way.";
  if(!key||!c.assigned.includes(keyId))return "Only a key in the wallet can be rotated.";
  if(!device||device.destroyed||device.place==="transit")return "That signer is not available.";
  if(device.keyId)return "Generate the new key on a signer that holds none, or the two keys will not be independent.";
  return "";
}
function rotationDays(){return coldSpendDays()+1}
function rotateCustodyKey(keyId,deviceUid){
  const reason=rotateBlockReason(keyId,deviceUid);
  if(reason)return showToast("Cannot rotate",reason,"bad","custody");
  const c=state.custody,old=custodyKey(keyId),device=custodyDevice(deviceUid),product=custodyProduct(device.product);
  const key={id:`k${c.keys.length+1}`,label:nextKeyLabel(),seed:`s${c.keys.length+1}`,bornOn:state.time,deviceUid,
    stateless:!!product?.stateless,backup:null,weakEntropy:custodyWeakEntropyAt(product,state.time)};
  c.keys.push(key);device.keyId=key.id;
  // A person who knew the old key is not handed the new one.
  key.holder=old.exposed&&old.exposed.cause==="former-employee"?"owner":custodyHolder(old);
  // Every coin is swept to the new wallet, and the fee is the real one for the weight being gathered.
  const fee=Math.min(state.wallets.cold||0,transferNetworkFee("cold",1)),days=rotationDays();
  state.wallets.cold=Math.max(0,(state.wallets.cold||0)-fee);
  c.rotation={old:old.id,new:key.id,due:state.time+days*DAY,started:state.time,fee,days};
  log(`Rotating ${old.label} to ${key.label}`,`${days} day${days===1?"":"s"} · ${fmtBtc(fee)} to sweep the coins`,"custody");
  showToast("Rotation started",`${key.label} is generated and the coins are being swept to the new wallet. It takes ${days} day${days===1?"":"s"} and ${fmtBtc(fee)}. Until it finishes the old key still controls the coins, and signing is paused.`,"info","custody");
  save();render();
}
function advanceRotation(silent=false){
  const c=state.custody,job=custodyRotation(c);
  if(!job||pendingAt(job,state.time))return;
  const old=custodyKey(job.old),fresh=custodyKey(job.new),slot=c.assigned.indexOf(job.old);
  if(slot>=0)c.assigned[slot]=job.new;else if(fresh)c.assigned.push(job.new);
  if(old){old.retired=true;delete old.exposed}
  // A new key set invalidates the descriptor written down for the old one, and so does every copy of it.
  if(custodyPolicy(c.policy).threshold>1){c.configBackedUp=false;c.configCopies=[];delete c.configPlace}
  utxoState().cold=(state.wallets.cold||0)>0?1:0;
  c.rotation=null;
  log(`Rotated to ${fresh?fresh.label:"a new key"}`,`${old?old.label:"The old key"} retired · coins consolidated into one`,"custody");
  if(!silent)showToast("Rotation complete",`${old?old.label:"The old key"} no longer controls anything. ${custodyPolicy(c.policy).threshold>1?"Record the wallet configuration again, and back the new key up. ":"Back the new key up. "}The coins are now a single coin, which is the cheapest thing to spend.`,"success","custody");
  renderFullQueued=true;
}
