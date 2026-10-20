const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateTax } = require('../src/services/taxService');

test('calculateTax falls back to zero tax when PMS tax config is unavailable', async () => {
  const previous = process.env.ELLA_PMS_DATABASE_URL;
  delete process.env.ELLA_PMS_DATABASE_URL;

  try {
    const result = await calculateTax(1000, '2026-10-15');
    assert.equal(result.taxAmount, 0);
    assert.equal(result.chargeWithTax, 1000);
    assert.deepEqual(result.breakdown, []);
  } finally {
    if (previous) process.env.ELLA_PMS_DATABASE_URL = previous;
  }
});
