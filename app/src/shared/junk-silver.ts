/**
 * Junk silver coin table + melt math.
 *
 * Pure silver per coin is computed from the coin's spec — gross weight in
 * grams x fineness, divided by grams per troy ounce — never from a rounded
 * per-coin constant, so the figures below stay exact to the specs.
 *
 * SOURCED FIGURES (verified Nov 20, 2026; full citations in the README):
 * - 90% dime: 2.5 g, 90% silver — Numista type 52 ("Roosevelt Silver Dime").
 * - 90% quarter: 6.25 g, 90% silver — the standard 90% spec; Bullion Price
 *   Check junk calculator gives 0.7234 troy oz pure silver per $1 face
 *   (0.18085 oz per quarter).
 * - 90% half dollar: 12.5 g, 90% silver — same $1-face basis (0.36170 oz).
 * - Morgan & Peace dollar: 26.73 g, 90% silver — Bullion Price Check
 *   product_spec tracked_oz 0.77345; NGC melt table 0.7734 oz. NOTE: the
 *   $1-face rule (0.7234 oz per $1) does NOT apply to silver dollars —
 *   they carry 0.77345 oz, about 7% more silver per face dollar.
 * - 40% Kennedy half: 11.5 g, 40% silver — Numista type 10865; Bullion
 *   Price Check 0.29584 oz per $1 face (= 0.14792 per half; the spec-derived
 *   0.14789 differs by 0.00003 oz, a rounding difference in BPC's
 *   per-face figure — the spec value is used here).
 * - 35% War Nickel: 5 g, 35% silver — Numista type 45; Bullion Price Check
 *   0.05626 oz per nickel; NGC melt table 0.0563 oz.
 *
 * The widely quoted worn-coin convention (0.715 troy oz per $1 face of 90%
 * coinage, per Bullion Price Check) is NOT used: this calculator values
 * coins at their full mint spec. Circulated coins weigh slightly less.
 */

/** Grams in one troy ounce. */
export const TROY_OZ_GRAMS = 31.1034768;

export type CoinTypeKey =
  "dime90" | "quarter90" | "half90" | "dollar90" | "half40" | "warNickel";

export type CoinMeta = {
  key: CoinTypeKey;
  label: string;
  detail: string;
  /** Face value of one coin, in USD. */
  faceValue: number;
  /** Gross weight of one coin, in grams. */
  grossWeightGrams: number;
  /** Silver fineness as a fraction (0.90 = 90%). */
  fineness: number;
};

export const COIN_BY_KEY: Record<CoinTypeKey, CoinMeta> = {
  dime90: {
    key: "dime90",
    label: "90% Silver Dime",
    detail: "Mercury / Roosevelt, 1964 & earlier",
    faceValue: 0.1,
    grossWeightGrams: 2.5,
    fineness: 0.9,
  },
  quarter90: {
    key: "quarter90",
    label: "90% Silver Quarter",
    detail: "Washington, 1964 & earlier",
    faceValue: 0.25,
    grossWeightGrams: 6.25,
    fineness: 0.9,
  },
  half90: {
    key: "half90",
    label: "90% Silver Half Dollar",
    detail: "Walking Liberty / Franklin / Kennedy 1964",
    faceValue: 0.5,
    grossWeightGrams: 12.5,
    fineness: 0.9,
  },
  dollar90: {
    key: "dollar90",
    label: "Morgan & Peace Dollar",
    detail: "90% silver dollar, 1878–1935",
    faceValue: 1,
    grossWeightGrams: 26.73,
    fineness: 0.9,
  },
  half40: {
    key: "half40",
    label: "40% Kennedy Half Dollar",
    detail: "Kennedy, 1965–1970",
    faceValue: 0.5,
    grossWeightGrams: 11.5,
    fineness: 0.4,
  },
  warNickel: {
    key: "warNickel",
    label: "35% War Nickel",
    detail: "Jefferson, 1942–1945",
    faceValue: 0.05,
    grossWeightGrams: 5,
    fineness: 0.35,
  },
};

export const COINS: CoinMeta[] = [
  COIN_BY_KEY.dime90,
  COIN_BY_KEY.quarter90,
  COIN_BY_KEY.half90,
  COIN_BY_KEY.dollar90,
  COIN_BY_KEY.half40,
  COIN_BY_KEY.warNickel,
];

/** Pure silver in one coin, in troy ounces. */
export const pureSilverOzPerCoin = (coin: CoinMeta): number =>
  (coin.grossWeightGrams * coin.fineness) / TROY_OZ_GRAMS;

/** Melt value of one coin at a given silver spot price (USD per troy oz). */
export const meltPerCoin = (
  coin: CoinMeta,
  silverPriceUsdPerTroyOz: number,
): number => pureSilverOzPerCoin(coin) * silverPriceUsdPerTroyOz;

export type CoinQuantity = {
  coin: CoinTypeKey;
  quantity: number;
};

export type MeltTotals = {
  totalFaceValue: number;
  totalPureSilverOz: number;
  meltValue: number;
  coinCount: number;
};

/** Totals for a set of coin quantities at a given silver spot price. */
export const calcTotals = (
  quantities: CoinQuantity[],
  silverPriceUsdPerTroyOz: number,
): MeltTotals => {
  let totalFaceValue = 0;
  let totalPureSilverOz = 0;
  let coinCount = 0;
  for (const entry of quantities) {
    const coin = COIN_BY_KEY[entry.coin];
    const qty = Number.isFinite(entry.quantity)
      ? Math.max(0, entry.quantity)
      : 0;
    totalFaceValue += coin.faceValue * qty;
    totalPureSilverOz += pureSilverOzPerCoin(coin) * qty;
    coinCount += qty;
  }
  return {
    totalFaceValue,
    totalPureSilverOz,
    meltValue: totalPureSilverOz * silverPriceUsdPerTroyOz,
    coinCount,
  };
};

export const formatUsd = (value: number): string =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatOz = (value: number): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });

export const formatPricePerOz = (value: number): string =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
