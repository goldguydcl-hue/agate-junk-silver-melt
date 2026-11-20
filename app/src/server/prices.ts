import { redis, settings } from "@devvit/web/server";
import type { ModeratorPrices, SilverPrice } from "../shared/api";
import { isRecord } from "../shared/api";
import {
  isCacheFresh,
  parseCachedPrices,
  parseModeratorPrices,
  resolveSilverPrice,
} from "../shared/pricing";

const CACHE_KEY = "prices:cache";
const MODERATOR_PRICES_KEY = "moderatorPrices";
const FETCH_TIMEOUT_MS = 5_000;

/** Fallback reference price seeded on install (USD per troy oz). */
export const SEED_MODERATOR_PRICES: ModeratorPrices = {
  // Silver spot via Bullion Price Check (gold-api.com), 2026-11-20T06:52:04Z.
  silver: 42.05,
};

const fetchJson = async (url: string): Promise<unknown> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AgateJunkSilverMelt/1.0" },
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data: unknown = await res.json();
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/** Yahoo Finance silver futures (COMEX SI=F). No key needed. */
const fetchYahooPrice = async (): Promise<number | null> => {
  const data = await fetchJson(
    "https://query1.finance.yahoo.com/v8/finance/chart/SI=F?range=1d&interval=1m",
  );
  if (!isRecord(data)) {
    return null;
  }
  const chart = data.chart;
  if (
    !isRecord(chart) ||
    !Array.isArray(chart.result) ||
    chart.result.length === 0
  ) {
    return null;
  }
  const first = chart.result[0];
  if (!isRecord(first)) {
    return null;
  }
  const meta = first.meta;
  if (!isRecord(meta)) {
    return null;
  }
  const price = meta.regularMarketPrice;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
};

/** gold-api.com silver (XAG). Free, no key. */
const fetchGoldApiPrice = async (): Promise<number | null> => {
  const data = await fetchJson("https://api.gold-api.com/price/XAG");
  if (!isRecord(data)) {
    return null;
  }
  const price = data.price;
  return typeof price === "number" && Number.isFinite(price) ? price : null;
};

/** metalpriceapi.com silver — only when a key is configured in app settings. */
const fetchMetalPriceApiPrice = async (
  apiKey: string,
): Promise<number | null> => {
  const data = await fetchJson(
    `https://api.metalpriceapi.com/v1/latest?api_key=${encodeURIComponent(apiKey)}&base=USD&currencies=XAG`,
  );
  if (!isRecord(data) || data.success !== true || !isRecord(data.rates)) {
    return null;
  }
  const value = data.rates.XAG;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const getModeratorPrices = async (): Promise<ModeratorPrices> => {
  const raw = await redis.get(MODERATOR_PRICES_KEY);
  return parseModeratorPrices(raw);
};

export const setModeratorPrices = async (
  prices: ModeratorPrices,
): Promise<void> => {
  await redis.set(MODERATOR_PRICES_KEY, JSON.stringify(prices));
};

/**
 * Silver price fallback chain, in order:
 * 1. Yahoo Finance futures (SI=F)
 * 2. gold-api.com (XAG)
 * 3. metalpriceapi.com — only when an API key is set in app settings
 * 4. Moderator-maintained daily reference price (Redis)
 * Results are cached server-side for 60 seconds.
 */
export const getPrices = async (): Promise<{
  silver: SilverPrice;
  fetchedAt: string;
  cacheHit: boolean;
}> => {
  const cached = parseCachedPrices(await redis.get(CACHE_KEY));
  if (cached && isCacheFresh(cached.fetchedAt)) {
    return {
      silver: cached.silver,
      fetchedAt: cached.fetchedAt,
      cacheHit: true,
    };
  }

  const [moderator, apiKey] = await Promise.all([
    getModeratorPrices(),
    settings.get<string>("metalpriceapi_key"),
  ]);
  const metalPriceApi =
    typeof apiKey === "string" && apiKey.length > 0
      ? await fetchMetalPriceApiPrice(apiKey)
      : null;

  const fetchedAt = new Date().toISOString();
  const silver = resolveSilverPrice({
    yahoo: await fetchYahooPrice(),
    goldApi: await fetchGoldApiPrice(),
    metalPriceApi,
    moderator: moderator.silver ?? null,
  });
  // Keep the cache timestamp consistent with the fetch.
  const resolved: SilverPrice =
    silver.priceUsdPerTroyOz === null
      ? silver
      : { ...silver, updatedAt: fetchedAt };

  const payload = { fetchedAt, silver: resolved };
  await redis.set(CACHE_KEY, JSON.stringify(payload));
  await redis.expire(CACHE_KEY, 120);
  return { silver: resolved, fetchedAt, cacheHit: false };
};
