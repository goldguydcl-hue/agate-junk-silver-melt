/**
 * Silver-price types, runtime guards, and pure price logic.
 * Self-contained (no relative imports) so it is unit-testable under plain
 * Node with --experimental-strip-types, which requires explicit file
 * extensions on relative imports. The server (src/server/prices.ts) wraps
 * these with fetch + Redis; src/shared/api.ts re-exports the types.
 */
export type PriceSource =
  "yahoo" | "gold-api" | "metalpriceapi" | "moderator" | "none";

export type SilverPrice = {
  /** Live silver price in USD per troy ounce, or null when no leg returned one. */
  priceUsdPerTroyOz: number | null;
  source: PriceSource;
  updatedAt: string | null;
};

export type ModeratorPrices = {
  silver?: number | null;
};

/** Runtime guard for untyped data (fetch bodies, cached JSON). No casts. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isPriceSource = (value: unknown): value is PriceSource =>
  value === "yahoo" ||
  value === "gold-api" ||
  value === "metalpriceapi" ||
  value === "moderator" ||
  value === "none";

/** Server-side price cache lifetime. */
export const CACHE_TTL_MS = 60_000;

export type CachedPrices = {
  fetchedAt: string;
  silver: SilverPrice;
};

export const parseCachedPrices = (
  raw: string | undefined,
): CachedPrices | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== "string") {
      return null;
    }
    if (!isRecord(parsed.silver)) {
      return null;
    }
    const entry = parsed.silver;
    const price =
      typeof entry.priceUsdPerTroyOz === "number"
        ? entry.priceUsdPerTroyOz
        : null;
    const source = isPriceSource(entry.source) ? entry.source : "none";
    const updatedAt =
      typeof entry.updatedAt === "string" ? entry.updatedAt : null;
    return {
      fetchedAt: parsed.fetchedAt,
      silver: { priceUsdPerTroyOz: price, source, updatedAt },
    };
  } catch {
    return null;
  }
};

export const parseModeratorPrices = (
  raw: string | undefined,
): ModeratorPrices => {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return {};
    }
    const value = parsed.silver;
    return {
      silver:
        typeof value === "number" && Number.isFinite(value) ? value : null,
    };
  } catch {
    return {};
  }
};

/**
 * Pure source selection for one price — the heart of the fallback chain.
 * First non-null leg wins; when every live leg fails the moderator
 * reference price is used; when that is missing too the price is null.
 */
export const resolveSilverPrice = (legs: {
  yahoo: number | null;
  goldApi: number | null;
  metalPriceApi: number | null;
  moderator: number | null;
}): SilverPrice => {
  const ordered: { price: number | null; source: PriceSource }[] = [
    { price: legs.yahoo, source: "yahoo" },
    { price: legs.goldApi, source: "gold-api" },
    { price: legs.metalPriceApi, source: "metalpriceapi" },
    { price: legs.moderator, source: "moderator" },
  ];
  for (const leg of ordered) {
    if (typeof leg.price === "number" && Number.isFinite(leg.price)) {
      return {
        priceUsdPerTroyOz: leg.price,
        source: leg.source,
        updatedAt: new Date().toISOString(),
      };
    }
  }
  return { priceUsdPerTroyOz: null, source: "none", updatedAt: null };
};

/** True when a cached payload fetched at `fetchedAt` is still fresh. */
export const isCacheFresh = (
  fetchedAt: string,
  nowMs: number = Date.now(),
): boolean => {
  const fetchedMs = Date.parse(fetchedAt);
  return Number.isFinite(fetchedMs) && nowMs - fetchedMs < CACHE_TTL_MS;
};
