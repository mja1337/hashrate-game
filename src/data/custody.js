"use strict";

/* CUSTODY EQUIPMENT — the things you buy, build and back up in order to hold your own keys.

   Three separate ideas, deliberately not collapsed into one:
     a DEVICE is a physical object you own
     a KEY is a secret a device can sign with
     a WALLET is a policy describing which keys may spend

   Three devices carrying the same seed are still one key, and that distinction is the whole
   point of the model. Buying equipment protects nothing until a key is generated on it and
   that key is assigned to a wallet.

   Release dates are the year a product actually reached customers. Where only the year is
   firmly attested the date is set to a plausible month within it and the record says so;
   prices are period-typical rather than quoted invoices, and are modelled. */

const CUSTODY_PRODUCTS=[
  /* --- Commercial signing devices ------------------------------------------------ */
  {id:"trezorone",name:"Trezor One",kind:"signer",supplier:"trezor",date:"2014-08-01",cost:99,lead:9,
    desc:"The first commercial hardware wallet. A screen, two buttons and a seed you write down yourself."},
  {id:"nanos",name:"Ledger Nano S",kind:"signer",supplier:"ledger",date:"2016-06-01",cost:79,lead:9,
    desc:"Secure-element signer, sold through a direct e-commerce channel that keeps customer records."},
  {id:"coldcard",name:"Coldcard Mk1",kind:"signer",supplier:"coinkite",date:"2018-05-01",cost:120,lead:14,
    desc:"Bitcoin-only, air-gappable, built to be used without ever touching a computer."},
  {id:"coldcardmk4",name:"Coldcard Mk4",kind:"signer",supplier:"coinkite",date:"2021-11-01",cost:158,lead:14,
    desc:"USB-C, NFC and a faster secure element. Ships with the firmware line whose entropy defect surfaced in 2026."},
  {id:"nanox",name:"Ledger Nano X",kind:"signer",supplier:"ledger",date:"2019-05-01",cost:119,lead:9,
    desc:"Bluetooth signer from the same direct channel as the Nano S."},
  {id:"bitbox02",name:"BitBox02",kind:"signer",supplier:"shiftcrypto",date:"2019-09-01",cost:109,lead:12,
    desc:"Microcontroller signer with a Bitcoin-only edition and a paired desktop app."},
  {id:"jade",name:"Blockstream Jade",kind:"signer",supplier:"blockstream",date:"2021-01-01",cost:65,lead:12,
    desc:"Open-source signer with a camera, usable fully air-gapped over QR codes."},
  {id:"passport",name:"Foundation Passport",kind:"signer",supplier:"foundation",date:"2021-08-01",cost:259,lead:18,
    desc:"Air-gapped by design: no USB data path at all, everything moves by QR and microSD."},

  /* --- The DIY signer, assembled from parts --------------------------------------- */
  {id:"seedsigner",name:"SeedSigner",kind:"signer",supplier:"selfbuilt",date:"2020-09-01",build:"seedsigner",lead:0,cost:0,
    stateless:true,
    desc:"Built from generic single-board-computer parts and stateless by design: it holds no seed between uses, so losing the device is not losing the wallet."},

  /* --- SeedSigner components, orderable individually or as a kit ------------------- */
  {id:"pizero",name:"Raspberry Pi Zero v1.3",kind:"part",supplier:"generic",date:"2016-05-01",cost:5,lead:11,
    desc:"The v1.3 board specifically: no wireless of any kind, which is the reason this revision is the one specified."},
  {id:"ssdcamera",name:"Compatible camera module",kind:"part",supplier:"generic",date:"2016-05-01",cost:14,lead:11,
    desc:"Reads seed words and unsigned transactions as QR codes. The device has no other input path."},
  {id:"sslcd",name:"240x240 LCD with joystick and buttons",kind:"part",supplier:"generic",date:"2018-01-01",cost:19,lead:13,
    desc:"Display and controls in one hat. The whole interface, and the only thing that ever shows a seed word."},
  {id:"ssmicrosd",name:"microSD card",kind:"part",supplier:"generic",date:"2009-01-03",cost:8,lead:7,
    desc:"Carries the software. It carries no key material, which is what stateless means in practice."},
  {id:"ssenclosure",name:"Printed enclosure",kind:"part",supplier:"generic",date:"2020-09-01",cost:12,lead:9,optional:true,
    desc:"Optional. Protects the assembly and makes it look like a thing you meant to build."},
  {id:"sskit",name:"SeedSigner component kit",kind:"kit",supplier:"generic",date:"2020-09-01",cost:64,lead:14,
    contains:{pizero:1,ssdcamera:1,sslcd:1,ssmicrosd:1,ssenclosure:1},
    desc:"Every component in one order. Faster and dearer than sourcing the parts separately."},

  /* --- Seed backup products -------------------------------------------------------- */
  {id:"paperbackup",name:"Paper and pencil",kind:"backup",supplier:"none",date:"2009-01-03",cost:0,lead:0,durability:"paper",
    desc:"Free, immediate, and destroyed by the first flood or fire it meets."},
  {id:"cryptosteel",name:"Stainless steel letter tiles",kind:"backup",supplier:"cryptosteel",date:"2015-06-01",cost:79,lead:16,durability:"steel",
    desc:"Seed words assembled from steel tiles. Survives what paper does not."},
  {id:"steelplate",name:"Stamped steel plate",kind:"backup",supplier:"generic",date:"2018-01-01",cost:45,lead:12,durability:"steel",
    desc:"A blank plate and a centre punch. Cheaper than tiles and no less durable once stamped."},
];

/* What a SeedSigner needs before it can be assembled. The enclosure is genuinely optional:
   the build completes without it, and the device works. */
/* THE COLDCARD ENTROPY WINDOW. Coinkite's advisory: a configuration error introduced with
   the March 2021 libNgU migration (first public release v4.0.1) caused some devices to fall
   back on a software random number generator instead of the hardware source when generating
   a seed. Any seed generated on an affected device in this window is weak whatever firmware
   the device runs today — "updating corrects future seed generation but does not repair an
   existing affected seed". The window closes at the patch, which the game dates to the
   disclosure rather than tracking firmware versions it does not model. */
const COLDCARD_ENTROPY_WINDOW={supplier:"coinkite",from:"2021-03-01",to:"2026-07-30"};

const CUSTODY_BUILDS={
  seedsigner:{
    id:"seedsigner",name:"SeedSigner",days:2,
    required:{pizero:1,ssdcamera:1,sslcd:1,ssmicrosd:1},
    optional:{ssenclosure:1},
  },
};

/* Suppliers exist as records because a consequence has to be able to find the people who
   bought from one particular vendor in one particular window, rather than everybody who
   happens to own a hardware wallet. */
const CUSTODY_SUPPLIERS={
  trezor:{name:"Trezor"},
  ledger:{name:"Ledger"},
  coinkite:{name:"Coinkite"},
  shiftcrypto:{name:"Shift Crypto"},
  blockstream:{name:"Blockstream"},
  foundation:{name:"Foundation Devices"},
  cryptosteel:{name:"Cryptosteel"},
  generic:{name:"General electronics suppliers"},
  selfbuilt:{name:"Self-built"},
  none:{name:"—"},
};

const CUSTODY_POLICIES=[
  {id:"single",name:"Single signature",keys:1,threshold:1,
    desc:"One key spends. Simple to set up and to recover, and there is nothing between a compromised key and your coins."},
  {id:"2of3",name:"2-of-3 multisig",keys:3,threshold:2,
    desc:"Three independently generated keys; any two can spend. One compromised key cannot move anything, and one lost key does not strand the wallet."},
];
