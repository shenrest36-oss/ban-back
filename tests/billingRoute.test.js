const test = require('node:test');
const assert = require('node:assert/strict');

const { buildPreparedEntries } = require('../src/routes/billing');

test('buildPreparedEntries resolves tax before the transaction and preserves the original charge', async () => {
  const calls = [];

  const entries = [
    { lineType: 'hall_charge', description: 'Hall charge', baseCharge: 1000, isComp: false },
    { lineType: 'item', description: 'Tea', baseCharge: 200, isComp: true },
  ];

  const prepared = await buildPreparedEntries(entries, '2026-10-15', async (baseCharge, chargeDate) => {
    calls.push({ baseCharge, chargeDate });
    return { taxAmount: 100, chargeWithTax: 1100, breakdown: [] };
  });

  assert.equal(calls.length, 1);
  assert.equal(prepared[0].charge, 1000);
  assert.equal(prepared[0].taxAmount, 100);
  assert.equal(prepared[0].chargeWithTax, 1100);
  assert.equal(prepared[1].charge, 0);
  assert.equal(prepared[1].taxAmount, 0);
  assert.equal(prepared[1].chargeWithTax, 0);
});
