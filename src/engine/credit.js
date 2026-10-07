"use strict";

/* CREDIT — what borrowing costs, and what the lender asks to see.

   The operating loan's rate used to be written out in seven places: the month-end bill, the
   settlement forecast, the reserve milestone, the Finance screen three times and a label. They
   agreed only because nobody had changed one. Anything that is about to make the rate depend on
   something has to start by making it one thing, so this is that, and nothing else yet.

   Loaded after keyholders.js; nothing here runs before the page has finished parsing. */

/* The monthly rate on the operating loan. */
function projectLoanRate(){return hasStaff("treasurer")?.009:.012}
/* What all outstanding borrowing adds to the next bill. */
function financeInterestMonthly(){return (state.projectLoan||0)*projectLoanRate()}
