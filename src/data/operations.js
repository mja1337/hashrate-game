"use strict";

const FACILITIES=[
  {id:"home",name:"Home office",date:"2009-01-03",kw:1.5,space:5,rent:0,cost:0,indoorBaseC:18,passiveCoolingKw:1,desc:"One circuit, no rent, little tolerance for heat."},
  {id:"garage",name:"Rented garage",date:"2010-01-01",kw:12,space:35,rent:320,cost:4800,indoorBaseC:10,passiveCoolingKw:4,desc:"A real panel, some airflow and concerned neighbours."},
  {id:"workshop",name:"Light industrial unit",date:"2012-01-01",kw:100,space:260,rent:3900,cost:28000,indoorBaseC:8,passiveCoolingKw:32,desc:"Three-phase power and room for rows of machines."},
  {id:"warehouse",name:"Mining warehouse",date:"2015-01-01",kw:1000,space:2600,rent:29000,cost:320000,indoorBaseC:8,passiveCoolingKw:300,desc:"Professional distribution, ventilation and security."},
  {id:"campus",name:"Grid-scale campus",date:"2018-01-01",kw:10000,space:24000,rent:185000,cost:4500000,indoorBaseC:5,passiveCoolingKw:2800,desc:"You are now an energy company with hashing attached."},
  {id:"container",name:"Modular container yard",date:"2020-01-01",kw:30000,space:68000,rent:410000,cost:12500000,passiveCoolingKw:8500,desc:"Thirty megawatts of containerised mining. Fast to deploy, exposed to logistics and grid constraints."},
  {id:"hydroplant",name:"Hydro colocation plant",date:"2023-01-01",kw:75000,space:155000,rent:760000,cost:34000000,indoorBaseC:8,passiveCoolingKw:24000,desc:"Purpose-built high-density infrastructure beside generation. Huge upside, huge contractual exposure."},
  {id:"megacampus",name:"Sovereign megacampus",date:"2025-01-01",kw:180000,space:360000,rent:1500000,cost:90000000,indoorBaseC:5,passiveCoolingKw:60000,desc:"Utility-scale mining campus designed for national-scale power agreements and geopolitical risk."}
];
/* The ladder is deliberately monotonic in BOTH directions: each step up rejects more heat
   per kilowatt it draws, and costs more per kilowatt of rejection to buy. That is the whole
   trade-off — bigger plant runs cheaper and buys dearer — and it only works if no unit beats
   another on both counts.

   It used to. Evaporative cooling was the efficiency peak AND the cheapest per kilowatt, so
   the two larger units above it were strictly worse: at a megacampus you would install
   thirty-five evaporative banks rather than two cooling towers, and they would be cheaper,
   more efficient and quicker to commission. The tier bands overlapped four deep at the top,
   which is what let a small unit stand next to plant ten times its size and win.

   Bands are now three tiers wide at most, so each site chooses between neighbours on the
   ladder rather than the whole catalog. What a dry cooler really buys you over an
   evaporative bank is not efficiency, it is that it consumes no water — and water is not
   something this game models, so here it earns its place the honest way, by rejecting more
   heat per kilowatt drawn than the bank below it and costing more per kilowatt to install. */
const COOLING_EQUIPMENT=[
  {id:"boxfan",name:"Workshop box fan",date:"2009-01-03",minTier:1,maxTier:2,cost:95,install:3,coolingKw:1.6,watts:85,desc:"Moves room air cheaply; useful at home and in a small garage."},
  {id:"exhaust",name:"Ducted exhaust kit",date:"2010-01-01",minTier:2,maxTier:3,cost:700,install:9,coolingKw:10,watts:420,desc:"Pulls a deliberate hot aisle out of a garage or small industrial unit."},
  {id:"axial",name:"Industrial axial fan wall",date:"2012-01-01",minTier:3,maxTier:5,cost:5300,install:21,coolingKw:68,watts:2600,desc:"High-volume intake and extraction for rows of air-cooled miners."},
  {id:"ahu",name:"Filtered air-handling unit",date:"2015-01-01",minTier:4,maxTier:6,cost:54000,install:35,coolingKw:620,watts:22000,desc:"A controlled industrial airflow plant with filtration and economiser logic."},
  {id:"evap",name:"Evaporative cooling bank",date:"2018-01-01",minTier:5,maxTier:7,cost:478000,install:60,coolingKw:5200,watts:173000,desc:"Utility-scale evaporative cooling: capital intensive, and cheaper to run than any air plant below it."},
  {id:"drycooler",name:"Closed-loop dry cooler",date:"2020-01-01",minTier:6,maxTier:8,cost:2110000,install:90,coolingKw:22000,watts:688000,desc:"Container and hydro-loop heat rejection with pumps, controls and redundancy. Dearer to install than an evaporative bank, and leaner to run."},
  /* Not simply another rung on the air ladder: a tank holds miners as well as rejecting
     their heat, so it carries a `units` capacity the other plant has no need of. Its draw is
     pumps and a heat exchanger rather than fans moving a building's worth of air, which is
     why it sheds so much more per watt than the evaporative bank above it and still costs
     more per kilowatt to install. */
  {id:"immersion",name:"Single-phase immersion tank",date:"2021-01-01",minTier:3,maxTier:8,cost:96000,install:45,coolingKw:520,watts:16000,units:150,desc:"A dielectric fluid bath with a pumped heat-exchanger loop, holding up to 150 converted miners. Their heat leaves through the loop instead of the room, and submerged machines take clock headroom air cooling cannot support."},
  {id:"coolingtower",name:"Industrial cooling tower",date:"2023-01-01",minTier:7,maxTier:8,cost:7200000,install:120,coolingKw:72000,watts:2118000,desc:"Campus-scale heat rejection for dense liquid-cooled fleets: the dearest plant to build and the cheapest to run."}
];
const REGIONS=[
  {id:"na",name:"North America",date:"2009-01-03",kwh:.12,rely:.995,netRisk:.008,internet:45,move:0,ambientC:11,seasonalC:12,policy:"Stable, expensive",desc:"Reliable grid access and deep capital markets; middling power prices."},
  {id:"iceland",name:"Iceland",date:"2013-01-01",kwh:.075,rely:.998,netRisk:.006,internet:130,move:18000,ambientC:5,seasonalC:5.5,policy:"Cool & dependable",desc:"Cooling and renewable generation help; logistics and space cost more."},
  {id:"sichuan",name:"Sichuan",date:"2014-01-01",kwh:.045,rely:.96,netRisk:.035,internet:95,move:22000,ambientC:16.5,seasonalC:10,policy:"Cheap, exposed",desc:"Seasonal hydropower is cheap until political permission disappears."},
  {id:"kazakhstan",name:"Kazakhstan",date:"2018-01-01",kwh:.055,rely:.91,netRisk:.055,internet:80,move:30000,ambientC:3.5,seasonalC:18,policy:"Cheap, constrained",desc:"Low rates attract miners; grid curtailment and unrest are material."},
  {id:"texas",name:"Texas",date:"2019-01-01",kwh:.07,rely:.94,netRisk:.02,internet:85,move:26000,ambientC:20,seasonalC:10.5,policy:"Flexible, volatile",desc:"Deep power markets reward flexibility; heat and price spikes punish it."},
  {id:"iran",name:"Iran",date:"2019-07-01",kwh:.032,rely:.78,netRisk:.075,internet:180,move:52000,ambientC:17,seasonalC:13,policy:"Cheap, politically exposed",desc:"State-priced power can be exceptionally cheap, but licensing, seasonal curtailment and seizure risk are acute."},
  {id:"kenya",name:"Kenya",date:"2021-01-01",kwh:.048,rely:.88,netRisk:.05,internet:240,move:48000,ambientC:18,seasonalC:2,policy:"Geothermal frontier",desc:"Geothermal potential offers a low-carbon power thesis; interconnection, currency and execution risk remain high."},
  {id:"bhutan",name:"Bhutan",date:"2023-01-01",kwh:.038,rely:.86,netRisk:.045,internet:210,move:65000,ambientC:12.5,seasonalC:8.5,policy:"Hydro, sovereign partner",desc:"Abundant hydropower can support scale, but access depends on partnership, seasonality and sovereign decisions."}
];
const POWER_CONTRACTS=[
  {id:"standard",name:"Standard tariff",mult:1,desc:"Balanced baseline tariff with normal exposure to energy shocks."},
  {id:"fixed",name:"Fixed-price PPA",mult:1.12,desc:"Pay a premium for a stable rate that ignores temporary energy shocks."},
  {id:"spot",name:"Spot-market power",mult:.82,desc:"Cheaper in normal conditions; energy shocks pass through in full."},
  {id:"curtail",name:"Curtailment contract",mult:.9,desc:"Discounted flexible load agreement. Strong economics, less operational certainty."}
];
/* The two upgrades protect against an outage in different ways, because in life they do.
   Diverse business routing makes the fault less likely to happen at all. A pair of cellular
   modems does nothing to stop a backhoe finding your fibre — it means you are carrying
   traffic again within the hour instead of waiting days for a splice crew, which is why
   `failover` shortens the outage rather than preventing it.

   Dual-SIM used to be modelled as a replacement primary that permanently trimmed 1.5% off
   mining revenue, which made it cost more than fixed broadband AND earn less than it: optimal
   in none of 56 tier-and-region combinations. It is a backup link. You are on the fixed line
   almost all of the time, so there is no standing penalty to pay. */
const CONNECTIVITY_PLANS=[
  {id:"fixed",name:"Local fixed broadband",mult:1,risk:1,payout:1,failover:1,desc:"Lowest recurring cost. One local upstream leaves the site exposed to cable, exchange and provider faults, and a fault means waiting for the provider."},
  {id:"sim",name:"Dual-SIM cellular failover",mult:1.55,risk:1,payout:1,failover:.15,desc:"Two mobile carriers cannot stop the last mile being cut, but the site carries traffic again within the hour rather than waiting days for a repair crew."},
  {id:"fiber",name:"Business fibre + SLA",mult:2.8,risk:.32,payout:1.008,failover:1,minFacility:2,desc:"Diverse business routing and an SLA make the incident far less likely in the first place; faster propagation adds 0.8% effective mining revenue."}
];
const STAFF=[
  {id:"fieldtech",name:"Field technician",salary:1200,desc:"Scalable repair crew. More technicians reduce fleet wear and shorten service outages; up to three can work one hardware type at once."},
  {id:"logistics",name:"Logistics lead",salary:2200,desc:"Cuts relocation costs and migration incident risk by 20%."},
  {id:"procurementlead",name:"Procurement lead",salary:1800,desc:"Reduces new hardware purchase costs by 5%."},
  {id:"treasurer",name:"Treasury manager",salary:2600,desc:"Reduces project-loan interest by 25%."}
];
