import test from "node:test";
import assert from "node:assert/strict";
import {
  isCacheFresh,
  parseCachedPrices,
  parseModeratorPrices,
  resolveSilverPrice,
} from "./pricing.ts";

test("resolveSilverPrice prefers Yahoo, then gold-api, then metalpriceapi", () => {
  const all = resolveSilverPrice({
    yahoo: 42.1,
    goldApi: 42.05,
    metalPriceApi: 42.0,
    moderator: 41.88,
  });
  assert.equal(all.priceUsdPerTroyOz, 42.1);
  assert.equal(all.source, "yahoo");

  const noYahoo = resolveSilverPrice({
    yahoo: null,
    goldApi: 42.05,
    metalPriceApi: 42.0,
    moderator: 41.88,
  });
  assert.equal(noYahoo.priceUsdPerTroyOz, 42.05);
  assert.equal(noYahoo.source, "gold-api");

  const onlyMpa = resolveSilverPrice({
    yahoo: null,
    goldApi: null,
    metalPriceApi: 42.0,
    moderator: 41.88,
  });
  assert.equal(onlyMpa.priceUsdPerTroyOz, 42.0);
  assert.equal(onlyMpa.source, "metalpriceapi");
});

test("resolveSilverPrice falls back to the moderator price when live legs fail", () => {
  const fallback = resolveSilverPrice({
    yahoo: null,
    goldApi: null,
    metalPriceApi: null,
    moderator: 41.88,
  });
  assert.equal(fallback.priceUsdPerTroyOz, 41.88);
  assert.equal(fallback.source, "moderator");
});

test("resolveSilverPrice is null with source none when everything fails", () => {
  const none = resolveSilverPrice({
    yahoo: null,
    goldApi: null,
    metalPriceApi: null,
    moderator: null,
  });
  assert.equal(none.priceUsdPerTroyOz, null);
  assert.equal(none.source, "none");
  assert.equal(none.updatedAt, null);
});

test("parseCachedPrices round-trips a cached payload and rejects bad JSON", () => {
  const raw = JSON.stringify({
    fetchedAt: "2026-11-20T07:00:00.000Z",
    silver: {
      priceUsdPerTroyOz: 42.05,
      source: "gold-api",
      updatedAt: "2026-11-20T07:00:00.000Z",
    },
  });
  const parsed = parseCachedPrices(raw);
  assert.ok(parsed !== null);
  assert.equal(parsed.silver.priceUsdPerTroyOz, 42.05);
  assert.equal(parsed.silver.source, "gold-api");
  assert.equal(parseCachedPrices("not json"), null);
  assert.equal(parseCachedPrices(undefined), null);
  assert.equal(parseCachedPrices('{"fetchedAt": 1}'), null);
});

test("parseModeratorPrices reads the silver reference price only", () => {
  assert.deepEqual(parseModeratorPrices('{"silver": 41.88}'), {
    silver: 41.88,
  });
  assert.deepEqual(parseModeratorPrices('{"silver": "bad"}'), {
    silver: null,
  });
  assert.deepEqual(parseModeratorPrices(undefined), {});
});

test("isCacheFresh enforces the 60-second cache", () => {
  const now = Date.parse("2026-11-20T07:01:00.000Z");
  assert.equal(isCacheFresh("2026-11-20T07:00:30.000Z", now), true);
  assert.equal(isCacheFresh("2026-11-20T06:59:59.000Z", now), false);
  assert.equal(isCacheFresh("not a date", now), false);
});
