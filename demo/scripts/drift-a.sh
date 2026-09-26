#!/usr/bin/env bash
# Drift A (SPEC_VIOLATION): the discount goes from 10% to 15%; the test is updated, the SPEC is not.
source "$(dirname "$0")/_lib.sh"
in_demo
replace src/pricing.ts 'DISCOUNT_RATE = 0.1;' 'DISCOUNT_RATE = 0.15;'
replace test/pricing.test.ts "it('gives 10% off above \$100'" "it('gives 15% off above \$100'"
replace test/pricing.test.ts 'toBe(108)' 'toBe(102)'
replace test/orders.test.ts 'toBe(108)' 'toBe(102)'
commit "Raise the loyalty discount to 15%"
