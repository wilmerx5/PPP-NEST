'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { STEPS } = require('./ppp-staging-mp-sandbox-rehearsal.cjs');

test('the Mercado Pago sandbox plan never confirms or pays', () => {
  assert.equal(STEPS.some(step => /confirmar|pague|pagar/i.test(step.text)), false);
  assert.ok(STEPS.some(step => step.id === 'mercado-pago'));
  assert.equal(STEPS.at(-1).id, 'reset-end');
});
