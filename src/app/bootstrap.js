"use strict";

const originalApplyEvent=applyEvent;applyEvent=function(e){originalApplyEvent(e);if(e.imp===3&&state.storyPause)state.eventResume=true};
const originalTick=tick;tick=function(silent=false){const old=state.speed;originalTick(silent);if(!silent&&old!==state.speed)setTimer()};
document.addEventListener("visibilitychange",()=>{if(document.visibilityState!=="visible"||!state.started||state.speed<=0||state.ended)return;const stepMs=2000/state.speed,steps=Math.min(3650,Math.floor((Date.now()-(state.lastReal||Date.now()))/stepMs));for(let i=0;i<steps&&state.speed>0&&!state.ended;i++)tick(true);state.lastReal=Date.now();save();render();setTimer()});
if(state.ended)state.speed=0;setTimer();startMempoolTimer();render();
