"use strict";

/* DATA LAYER — compact, offline historical anchors and gameplay estimates. */
const LIGHTNING=Date.parse("2018-03-15T00:00:00Z"),PROJECT_FINANCE_START=Date.parse("2014-01-01T00:00:00Z");
const DAY=86400000, GENESIS=Date.parse("2009-01-03T00:00:00Z"), START=Date.parse("2009-02-03T00:00:00Z"), END=Date.parse("2026-08-08T00:00:00Z"), MARKET=Date.parse("2010-07-17T00:00:00Z");
const SANDBOX_END=END+DAY*365.25*100;
const at=d=>Date.parse(d+"T00:00:00Z");
const FAUCET_START=at("2010-06-11"), FAUCET_END=at("2012-06-11");
const TREASURY_POLICIES=[
  {id:"cover",name:"Cover the bill",short:"Sell only what settlement needs",ratio:null},
  {id:"hodl",name:"HODL everything",short:"Keep every mined satoshi",ratio:0},
  {id:"sell25",name:"Sell 25%",short:"Convert one quarter of monthly production",ratio:.25},
  {id:"sell50",name:"Sell 50%",short:"Balance reserves and reinvestment",ratio:.5},
  {id:"sell100",name:"Sell 100%",short:"Run a fiat-profit mining business",ratio:1}
];
const OPERATOR_ERAS=[
  {id:"frontier",name:"CPU frontier",start:GENESIS,end:at("2011-01-01")},
  {id:"garage",name:"GPU garage",start:at("2011-01-01"),end:at("2013-01-01")},
  {id:"asic",name:"ASIC industrialisation",start:at("2013-01-01"),end:at("2017-01-01")},
  {id:"professional",name:"Professional mining",start:at("2017-01-01"),end:at("2021-01-01")},
  {id:"stress",name:"Sovereign stress",start:at("2021-01-01"),end:at("2024-01-01")},
  {id:"institutional",name:"Institutional era",start:at("2024-01-01"),end:END+DAY},
  {id:"frontier2",name:"Procedural frontier",start:END+DAY,end:SANDBOX_END+DAY}
];
