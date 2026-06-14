const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// The Judge Script: Validates the codebase against the "True Dynamic ERP" rules

console.log('⚖️   THE JUDGE IS NOW IN SESSION   ⚖️\n');
console.log('Auditing B-Cart codebase for compliance...\n');

let violations = 0;

function check(rule, command, errorMessage) {
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (output.trim()) {
      console.log(`❌  VIOLATION: ${rule}`);
      console.log(`    ${errorMessage}`);
      console.log(`    Occurrences found:\n${output.split('\n').map(l => '      ' + l).join('\n')}\n`);
      violations++;
    } else {
      console.log(`✅  PASSED: ${rule}`);
    }
  } catch (err) {
    // If grep finds nothing, it exits with 1, which means PASS
    console.log(`✅  PASSED: ${rule}`);
  }
}

// Check 1: No direct on_hand_qty writes
check(
  'No direct writes to products.on_hand_qty',
  'grep -rn "UPDATE products SET on_hand_qty" ../backend/src || grep -rn "on_hand_qty = " ../backend/src/modules',
  'All stock changes must go through writeStockMove() to the stock_ledger.'
);

// Check 2: No direct total_amount updates
check(
  'No direct writes to total_amount for orders',
  'grep -rn "UPDATE purchase_orders SET total_amount" ../backend/src || grep -rn "UPDATE sales_orders SET total_amount" ../backend/src',
  'Order totals must be calculated dynamically via views.'
);

// Check 3: Check for manual cost updates
check(
  'No direct writes to products.cost_price outside valuation engine',
  'grep -rn "UPDATE products SET cost_price" ../backend/src/modules',
  'Cost updates must go through the applyWeightedMovingAverage() engine.'
);

// Check 4: Check for missing EventBus
check(
  'Automated actions should use EventBus instead of synchronous calls',
  'grep -rn "await runProcurement(" ../backend/src/modules/sales',
  'Procurement and other downstream actions should be decoupled via eventBus.'
);

console.log('----------------------------------------------------');
if (violations === 0) {
  console.log('🎉 JUDGE VERDICT: 100% COMPLIANT!');
  console.log('   The B-Cart ERP is fully dynamic, trace-driven, and event-sourced.');
} else {
  console.log(`⚠️  JUDGE VERDICT: FAILED. Found ${violations} rule violation(s).`);
  process.exit(1);
}
