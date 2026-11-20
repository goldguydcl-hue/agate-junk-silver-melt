import type { SilverPrice } from "./pricing";
import { isPriceSource, isRecord } from "./pricing";

export { isPriceSource, isRecord } from "./pricing";
export type { ModeratorPrices, PriceSource, SilverPrice } from "./pricing";

export type PricesResponse = {
  type: "prices";
  silver: SilverPrice;
  fetchedAt: string;
  cacheHit: boolean;
};

export type ShareRequest = {
  faceValue: number;
  pureSilverOz: number;
  meltValue: number;
  silverPrice: number;
  lines: ShareLine[];
};

export type ShareLine = {
  coin: string;
  quantity: number;
  meltValue: number;
};

export type ShareResponse = {
  type: "share";
  postId: string;
  url: string;
};

/** Validate a /api/prices body. Returns null when the shape is wrong. */
export const parsePricesResponse = (data: unknown): PricesResponse | null => {
  if (!isRecord(data) || data.type !== "prices") {
    return null;
  }
  if (
    typeof data.fetchedAt !== "string" ||
    typeof data.cacheHit !== "boolean"
  ) {
    return null;
  }
  if (!isRecord(data.silver)) {
    return null;
  }
  const silverRaw = data.silver;
  const price =
    typeof silverRaw.priceUsdPerTroyOz === "number"
      ? silverRaw.priceUsdPerTroyOz
      : null;
  const source = isPriceSource(silverRaw.source) ? silverRaw.source : "none";
  const updatedAt =
    typeof silverRaw.updatedAt === "string" ? silverRaw.updatedAt : null;
  return {
    type: "prices",
    silver: { priceUsdPerTroyOz: price, source, updatedAt },
    fetchedAt: data.fetchedAt,
    cacheHit: data.cacheHit,
  };
};

/** Validate a /api/share body. Returns null when the shape is wrong. */
export const parseShareResponse = (data: unknown): ShareResponse | null => {
  if (!isRecord(data) || data.type !== "share") {
    return null;
  }
  if (typeof data.postId !== "string" || typeof data.url !== "string") {
    return null;
  }
  return { type: "share", postId: data.postId, url: data.url };
};
