"use strict";

const SPECULATIONS=[
  {id:"dice",date:"2012-04-18",name:"Satoshi Dice",kind:"Bitcoin gambling",chance:.34,payout:2.1,desc:"A transparent-looking on-chain dice game offers a quick double-or-nothing-style punt."},
  {id:"doge",date:"2013-12-06",name:"Dogecoin launch",kind:"Meme coin",chance:.28,payout:3.2,desc:"A viral fork is gathering a community. Most early meme bets fade; this one might run."},
  {id:"ethereum",date:"2015-07-30",name:"Ethereum launch",kind:"Smart-contract platform",chance:.38,payout:2.7,desc:"A new programmable chain asks you to rotate BTC into an unproven network token."},
  {id:"monero",date:"2014-04-18",name:"Monero launch",kind:"Privacy coin",chance:.30,payout:2.5,desc:"Privacy technology is compelling, but adoption and regulatory pressure make the trade uncertain."},
  {id:"bch",date:"2017-08-01",name:"Bitcoin Cash hard fork",kind:"Bitcoin hard-fork claim",chance:.32,payout:2.4,desc:"A contentious block-size fork creates a separate asset. Risk hot-wallet BTC on the fork trade without making it part of the core operation."},
  {id:"bsv",date:"2018-11-15",name:"Bitcoin SV hard fork",kind:"Bitcoin Cash hard-fork claim",chance:.18,payout:3.6,desc:"A second contentious split offers volatile fork exposure with severe technical, liquidity and counterparty risk."},
  {id:"solana",date:"2020-03-16",name:"Solana launch",kind:"High-throughput chain",chance:.25,payout:4.0,desc:"A fast new chain is promising scale. The upside is large; the early execution risk is larger."},
  {id:"shib",date:"2020-08-01",name:"Shiba Inu launch",kind:"Meme coin",chance:.16,payout:7.0,desc:"A meme-token punt with enormous upside on paper and a strong chance of becoming worthless."}
];
const DONATION_CAMPAIGNS=[
  {id:"wikileaks",date:"2011-06-14",name:"WikiLeaks publishing fund",kind:"Press freedom",desc:"WikiLeaks turns to Bitcoin donations after conventional payment channels are cut off.",url:"https://wikileaks.org/donate.html"},
  {id:"ross",date:"2015-02-04",name:"Ross Ulbricht legal-defense fund",kind:"Legal defense",desc:"A Bitcoin-era court case drives a public campaign for legal-defense and appellate support.",url:"https://freeross.org/"},
  {id:"devfund",date:"2020-01-01",name:"Open-source Bitcoin development",kind:"Protocol resilience",desc:"Support independent work that maintains Bitcoin's open-source infrastructure.",url:"https://brink.dev/"},
  {id:"ukraine",date:"2022-02-26",name:"Ukraine humanitarian & defense relief",kind:"Humanitarian aid",desc:"Ukraine publishes cryptocurrency donation channels as Russia's invasion creates an urgent funding need.",url:"https://donate.thedigital.gov.ua/"}
];
const STRATEGY_SECURITIES=[
  {id:"mstr",ticker:"MSTR",name:"Strategy common stock",date:"2020-08-11",base:145,btcBeta:1.65,yield:0,desc:"Equity in the operating company and its leveraged Bitcoin-treasury strategy. No stated fiat income."},
  {id:"strk",ticker:"STRK",name:"Strike preferred",date:"2025-01-31",base:100,btcBeta:.35,yield:.08,desc:"Perpetual preferred exposure designed around an 8% annual cash dividend, subject to issuer terms."},
  {id:"strf",ticker:"STRF",name:"Strife preferred",date:"2025-03-20",base:100,btcBeta:.2,yield:.10,desc:"Senior perpetual preferred exposure with a modelled 10% annual fiat dividend."},
  {id:"strd",ticker:"STRD",name:"Stride preferred",date:"2025-06-10",base:100,btcBeta:.25,yield:.10,desc:"Higher-yield preferred exposure; its payment profile is simplified here as a 10% annual fiat dividend."},
  {id:"strc",ticker:"STRC",name:"Stretch preferred",date:"2025-07-29",base:100,btcBeta:.08,yield:.09,desc:"Variable-rate preferred designed for cash income. This game models its initial 9% annual fiat yield, paid daily."}
];
const SKILLS=[
  {id:"undervolt",branch:"Compute",name:"Undervolt",desc:"Hardware consumes 5% less power.",cost:2},
  {id:"firmware",branch:"Compute",name:"Custom firmware",desc:"Hardware produces 4% more hash.",cost:3,req:"undervolt",date:"2010-07-17"},
  {id:"procurement",branch:"Compute",name:"Direct procurement",desc:"New hardware costs 6% less.",cost:4,req:"firmware",date:"2012-01-01",minFacility:2},
  {id:"asictune",branch:"Compute",name:"ASIC autotuning",desc:"ASIC and hydro-ASIC hash rate rises 5%.",cost:5,req:"procurement",date:"2013-01-01",minFacility:3},
  {id:"metering",branch:"Energy",name:"Smart metering",desc:"Electricity costs 4% less.",cost:2,minFacility:2},
  {id:"heat",branch:"Energy",name:"Heat reuse",desc:"Recover 4% of every power bill.",cost:3,req:"metering",date:"2011-01-01",minFacility:2},
  {id:"capacity",branch:"Energy",name:"Power engineering",desc:"Facilities support 10% more electrical load.",cost:4,req:"heat",date:"2012-01-01",minFacility:3},
  {id:"substation",branch:"Energy",name:"Dedicated substation",desc:"Adds 10% electrical capacity beyond power engineering.",cost:5,req:"capacity",date:"2015-01-01",minFacility:4},
  {id:"liquidcool",branch:"Energy",name:"Liquid-cooling plant",desc:"Enables water-cooled ASIC deployment at warehouse scale or above.",cost:6,req:"substation",date:"2020-01-01",minFacility:4},
  {id:"curtailment",branch:"Energy",name:"Demand-response control",desc:"Power costs fall by a further 4% through flexible load management.",cost:5,req:"liquidcool",date:"2020-01-01",minFacility:4},
  {id:"poolops",branch:"Operations",name:"Pool operations",desc:"Pool fees fall by 0.4 percentage points.",cost:2,date:"2010-12-16"},
  {id:"monitoring",branch:"Operations",name:"Fleet monitoring",desc:"Uptime improves one point and connectivity incidents fall 25%.",cost:3,req:"poolops",date:"2011-01-01",minFacility:2},
  {id:"fieldservice",branch:"Operations",name:"Field service technique",desc:"Halves the chance of a complication at every stage of a repair.",cost:4,req:"monitoring",date:"2014-01-01",minFacility:3},
  {id:"blocktemplate",branch:"Operations",name:"Block-template construction",desc:"With an online archival or relay node, construct candidate blocks locally, capture 8% more transaction fees and unlock OCEAN's miner-selected templates.",cost:4,req:"monitoring",date:"2012-01-01"},
  {id:"relocation",branch:"Operations",name:"Relocation playbook",desc:"Moving regions costs 20% less.",cost:4,req:"blocktemplate",date:"2013-01-01"},
  {id:"spares",branch:"Operations",name:"Critical spares inventory",desc:"Transit damage during facility moves destroys fewer miners.",cost:4,req:"relocation",date:"2015-01-01"},
  {id:"backups",branch:"Treasury",name:"Key backups",desc:"Self-custody security rises materially.",cost:1},
  {id:"counterparty",branch:"Treasury",name:"Counterparty radar",desc:"Custody warnings arrive earlier.",cost:2,req:"backups",date:"2010-07-17"},
  {id:"multisig",branch:"Treasury",name:"Multisig discipline",desc:"Cold-storage transfers cost 20% less.",cost:4,req:"counterparty",date:"2012-01-01"}
];
const LEARNING=[
  {id:"whitepaper",type:"Paper",date:"2009-01-03",title:"Bitcoin: A Peer-to-Peer Electronic Cash System",author:"Satoshi Nakamoto",days:7,reward:1,check:{q:"What replaces a trusted third party in Bitcoin's payment system?",options:["Proof-of-work and a peer-to-peer network","A central clearing bank","A fixed exchange rate"],answer:0},desc:"Read Bitcoin's nine-page founding paper and understand the double-spend problem, proof-of-work and peer-to-peer consensus."},
  {id:"bitcointalk",type:"Forum",date:"2009-11-22",title:"Bitcoin Talk forum",author:"Read the early threads",days:10,reward:1,check:{q:"What is the main trade-off of leaving coins on an exchange?",options:["You rely on the operator's custody","Blocks stop being mined","Your wallet becomes faster"],answer:0},desc:"Learn the early culture, technical debates and hard-won operational lessons directly from the Bitcoin community."},
  {id:"mastering",type:"Book",date:"2014-12-01",title:"Mastering Bitcoin",author:"Andreas M. Antonopoulos",days:45,reward:3,check:{q:"What does a full node independently verify?",options:["Blocks and consensus rules","The BTC price","Exchange solvency"],answer:0},desc:"A technical foundation for running and securing Bitcoin infrastructure."},
  {id:"digitalgold",type:"Book",date:"2015-05-01",title:"Digital Gold",author:"Nathaniel Popper",days:32,reward:2,desc:"A history of the people, incentives and conflicts behind Bitcoin's early years."},
  {id:"bitcoinstandard",type:"Book",date:"2018-04-01",title:"The Bitcoin Standard",author:"Saifedean Ammous",days:38,reward:3,check:{q:"Which property makes a fixed supply schedule meaningful?",options:["Independent verification","A high marketing budget","A central issuer"],answer:0},desc:"A monetary-history lens on scarcity, money and Bitcoin's fixed issuance."},
  {id:"bookofsatoshi",type:"Book",date:"2014-10-01",title:"The Book of Satoshi",author:"Phil Champagne",days:24,reward:2,desc:"Primary writings and public statements from Bitcoin's earliest years."},
  {id:"layeredmoney",type:"Book",date:"2021-05-01",title:"Layered Money",author:"Nik Bhatia",days:30,reward:2,desc:"A framework for understanding monetary layers, settlement and the role of Bitcoin."},
  {id:"blocksizewar",type:"Book",date:"2021-07-01",title:"The Blocksize War",author:"Jonathan Bier",days:34,reward:3,check:{q:"What did the blocksize debate demonstrate about Bitcoin?",options:["Rule changes require broad coordination","Mining hardware sets all protocol rules","Prices set consensus"],answer:0},desc:"A detailed account of Bitcoin's scaling conflict and decentralized governance."},
  {id:"softwar",type:"Book",date:"2022-10-01",title:"Softwar",author:"Jason P. Lowery",days:28,reward:2,desc:"A provocative national-security perspective on proof-of-work and power projection."},
  {id:"priceTomorrow",type:"Book",date:"2020-01-14",title:"The Price of Tomorrow",author:"Jeff Booth",days:28,reward:2,desc:"Technology-driven deflation and the monetary friction created by debt-based money."},
  {id:"progressiveCase",type:"Book",date:"2023-04-14",title:"A Progressive's Case for Bitcoin",author:"C. Jason Maier",days:30,reward:2,desc:"A social-justice and environmental case for Bitcoin beyond partisan framing."},
  {id:"brokenMoney",type:"Book",date:"2023-08-20",title:"Broken Money",author:"Lyn Alden",days:42,reward:3,desc:"A technological history of money, monetary systems and financial freedom."},
  {id:"cryptosovereignty",type:"Book",date:"2023-08-23",title:"Cryptosovereignty",author:"Erik Cason",days:32,reward:2,desc:"Bitcoin, cryptography and the political philosophy of individual sovereignty."},
  {id:"genesisBook",type:"Book",date:"2024-01-03",title:"The Genesis Book",author:"Aaron van Wirdum",days:36,reward:3,desc:"The people, projects and ideas that inspired Bitcoin before its launch."},
  {id:"bigPrint",type:"Book",date:"2024-12-01",title:"The Big Print",author:"Lawrence Lepard",days:36,reward:3,desc:"A sound-money critique of monetary expansion and its economic consequences."},
  {id:"wbd",type:"Podcast",date:"2017-01-01",title:"What Bitcoin Did",author:"Subscribe to the feed",days:12,reward:1,desc:"Fast operator interviews and current-cycle context. Subscribe once; complete the featured episode."},
  {id:"slp",type:"Podcast",date:"2018-01-01",title:"Stephan Livera Podcast",author:"Subscribe to the feed",days:14,reward:1,check:{q:"Why can cheap electricity still be a bad mining decision?",options:["Policy and reliability can erase the saving","ASICs need no power","Hashrate sets the rent"],answer:0},desc:"A deeper technical and sovereignty-focused mining conversation."},
  {id:"audible",type:"Podcast",date:"2019-01-01",title:"Bitcoin Audible",author:"Subscribe to the feed",days:11,reward:1,desc:"Long-form readings and discussions of Bitcoin research, history and technical writing."},
  {id:"tftc",type:"Podcast",date:"2020-01-01",title:"Tales from the Crypt",author:"Subscribe to the feed",days:10,reward:1,desc:"Builder and operator interviews from the Bitcoin industry."},
  {id:"miningpod",type:"Podcast",date:"2021-01-01",title:"The Mining Pod",author:"Subscribe to the feed",days:12,reward:1,desc:"Mining-market discussion focused on fleets, energy and infrastructure."},
  {id:"podsignal",type:"Podcast",date:"2020-01-01",title:"Market Signal briefing",author:"Subscribe to the feed",days:9,reward:1,desc:"Short cycle briefings that help frame market and treasury decisions."}
];
const NODE_STORAGE=[
  {gb:50,cost:0,date:"2009-01-03",name:"50 GB disk"},
  {gb:250,cost:85,date:"2011-01-01",name:"250 GB disk"},
  {gb:1000,cost:140,date:"2014-01-01",name:"1 TB disk"},
  {gb:2000,cost:220,date:"2016-01-01",name:"2 TB disk"},
  {gb:4000,cost:360,date:"2018-01-01",name:"4 TB disk"},
  {gb:8000,cost:620,date:"2020-01-01",name:"8 TB disk"}
];
const CHAIN_GB=[["2009-01-03",.1],["2011-01-01",2],["2012-12-31",8],["2014-12-31",30],["2016-12-31",90],["2018-12-31",210],["2020-12-31",310],["2022-12-31",460],["2024-12-31",620],["2026-08-08",830]];
const NODE_MODES=[
  {id:"pruned",name:"Pruned verifier",watts:12,monthly:5,connections:8,desc:"Validates consensus with a rolling block window. Lowest cost, but no Lightning or local block-template service."},
  {id:"archival",name:"Archival node",watts:25,monthly:20,connections:16,desc:"Stores the full chain and independently supplies transactions to your operation. A dedicated deployment also supports Lightning."},
  {id:"relay",name:"Mining relay",watts:120,monthly:180,connections:64,requires:2,desc:"A hardened, high-connectivity relay stack that improves block propagation, routing income and mining reliability."}
];
const BACKUP_NODE={date:"2018-01-01",cost:2400,watts:40,monthly:90,connections:24,name:"Geographic backup node"};
