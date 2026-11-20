import test from "node:test";
import assert from "node:assert/strict";
import {
  COIN_BY_KEY,
  calcTotals,
  meltPerCoin,
  pureSilverOzPerCoin,
} from "./junk-silver.ts";

/**
 * Hand-computed expectations. Computed independently with a calculator from
 * the coin specs (gross weight x fineness / 31.1034768 g per troy oz):
 * - dime: 2.5 g x 0.90 = 2.25 g -> 0.07234 ozt
 * - quarter: 6.25 g x 0.90 = 5.625 g -> 0.18085 ozt
 * - half 90%: 12.5 g x 0.90 = 11.25 g -> 0.36170 ozt
 * - Morgan/Peace: 26.73 g x 0.90 = 24.057 g -> 0.77345 ozt
 * - Kennedy 40%: 11.5 g x 0.40 = 4.6 g -> 0.14789 ozt
 * - War Nickel: 5 g x 0.35 = 1.75 g -> 0.05626 ozt
 * Live test price: silver $42.05/ozt (Bullion Price Check spot,
 * gold-api.com, 2026-11-20T06:52:04Z). A second price ($50.00) checks the
 * math is price-independent.
 */
const close = (actual: number, expected: number, tol: number): void =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `expected ${expected} (±${tol}), got ${actual}`,
  );

test("per-coin pure silver matches the sourced specs", () => {
  close(pureSilverOzPerCoin(COIN_BY_KEY.dime90), 0.07234, 0.00001);
  close(pureSilverOzPerCoin(COIN_BY_KEY.quarter90), 0.18085, 0.00001);
  close(pureSilverOzPerCoin(COIN_BY_KEY.half90), 0.3617, 0.00001);
  close(pureSilverOzPerCoin(COIN_BY_KEY.dollar90), 0.77345, 0.00001);
  close(pureSilverOzPerCoin(COIN_BY_KEY.half40), 0.14789, 0.00001);
  close(pureSilverOzPerCoin(COIN_BY_KEY.warNickel), 0.05626, 0.00001);
});

test("10 dimes = 4 quarters = $1 face = 0.72339 ozt (BPC 0.7234/$1 face)", () => {
  const dimes = calcTotals([{ coin: "dime90", quantity: 10 }], 42.05);
  const quarters = calcTotals([{ coin: "quarter90", quantity: 4 }], 42.05);
  close(dimes.totalPureSilverOz, 0.7233917978, 0.0000001);
  close(quarters.totalPureSilverOz, 0.7233917978, 0.0000001);
  close(dimes.totalFaceValue, 1, 0.0001);
  close(quarters.totalFaceValue, 1, 0.0001);
  close(dimes.meltValue, 30.418625, 0.001);
  close(quarters.meltValue, 30.418625, 0.001);
});

test("melt at live silver $42.05/ozt — the four cases from the build report", () => {
  const price = 42.05;
  const dimes = calcTotals([{ coin: "dime90", quantity: 10 }], price);
  close(dimes.meltValue, 30.418625, 0.001);
  close(dimes.totalPureSilverOz, 0.7233917978, 0.0000001);

  const quarters = calcTotals([{ coin: "quarter90", quantity: 4 }], price);
  close(quarters.meltValue, 30.418625, 0.001);

  const morgans = calcTotals([{ coin: "dollar90", quantity: 2 }], price);
  close(morgans.totalFaceValue, 2, 0.0001);
  close(morgans.totalPureSilverOz, 1.5469010204, 0.0000001);
  close(morgans.meltValue, 65.047188, 0.001);

  const nickels = calcTotals([{ coin: "warNickel", quantity: 5 }], price);
  close(nickels.totalFaceValue, 0.25, 0.0001);
  close(nickels.totalPureSilverOz, 0.2813190325, 0.0000001);
  close(nickels.meltValue, 11.829465, 0.001);

  const combined = calcTotals(
    [
      { coin: "dime90", quantity: 10 },
      { coin: "quarter90", quantity: 4 },
      { coin: "dollar90", quantity: 2 },
      { coin: "warNickel", quantity: 5 },
    ],
    price,
  );
  close(combined.totalFaceValue, 4.25, 0.0001);
  close(combined.totalPureSilverOz, 3.2750036495, 0.0000001);
  close(combined.meltValue, 137.713903, 0.001);
});

test("melt at $50.00/ozt — price-independent check", () => {
  const price = 50;
  close(meltPerCoin(COIN_BY_KEY.dime90, price), 3.616959, 0.000001);
  close(meltPerCoin(COIN_BY_KEY.quarter90, price), 9.042397, 0.000001);
  close(meltPerCoin(COIN_BY_KEY.dollar90, price), 38.672526, 0.000001);
  close(meltPerCoin(COIN_BY_KEY.warNickel, price), 2.81319, 0.000001);
  close(meltPerCoin(COIN_BY_KEY.half40, price), 7.394672, 0.000001);
  close(meltPerCoin(COIN_BY_KEY.half90, price), 18.084795, 0.000001);

  const all = calcTotals(
    [
      { coin: "dime90", quantity: 10 },
      { coin: "quarter90", quantity: 4 },
      { coin: "dollar90", quantity: 2 },
      { coin: "warNickel", quantity: 5 },
      { coin: "half40", quantity: 3 },
      { coin: "half90", quantity: 6 },
    ],
    price,
  );
  close(all.totalFaceValue, 8.75, 0.0001);
  close(all.totalPureSilverOz, 5.8888593445, 0.0000001);
  close(all.meltValue, 294.442967, 0.001);
  assert.equal(all.coinCount, 30);
});

test("empty and zero quantities give zero totals", () => {
  const totals = calcTotals([], 42.05);
  assert.equal(totals.totalFaceValue, 0);
  assert.equal(totals.totalPureSilverOz, 0);
  assert.equal(totals.meltValue, 0);
  assert.equal(totals.coinCount, 0);
});
