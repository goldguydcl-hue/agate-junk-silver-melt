import "./index.css";

import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { navigateTo, showToast } from "@devvit/web/client";
import type { ShareRequest, SilverPrice } from "../shared/api";
import { parsePricesResponse, parseShareResponse } from "../shared/api";
import {
  COINS,
  calcTotals,
  formatOz,
  formatPricePerOz,
  formatUsd,
  meltPerCoin,
  pureSilverOzPerCoin,
} from "../shared/junk-silver";
import type { CoinQuantity, CoinTypeKey } from "../shared/junk-silver";

const SOURCE_LABELS: Record<string, string> = {
  yahoo: "Live",
  "gold-api": "Live",
  metalpriceapi: "Live",
  moderator: "Reference price",
  none: "Unavailable",
};

const EMPTY_QUANTITIES: Record<CoinTypeKey, string> = {
  dime90: "",
  quarter90: "",
  half90: "",
  dollar90: "",
  half40: "",
  warNickel: "",
};

const parseQuantity = (value: string): number => {
  const num = Number.parseInt(value, 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

export const App = () => {
  const [quantities, setQuantities] =
    useState<Record<CoinTypeKey, string>>(EMPTY_QUANTITIES);
  const [silver, setSilver] = useState<SilverPrice | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sharing, setSharing] = useState(false);

  const loadPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/prices");
      if (!res.ok) {
        throw new Error("prices request failed");
      }
      const data = parsePricesResponse(await res.json());
      if (data === null) {
        throw new Error("prices response was not the expected shape");
      }
      setSilver(data.silver);
      setFetchedAt(data.fetchedAt);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => void loadPrices(), 60_000);
    const initial = setTimeout(() => void loadPrices(), 0);
    return () => {
      clearInterval(timer);
      clearTimeout(initial);
    };
  }, [loadPrices]);

  const entries: CoinQuantity[] = useMemo(
    () =>
      COINS.map((coin) => ({
        coin: coin.key,
        quantity: parseQuantity(quantities[coin.key]),
      })),
    [quantities],
  );

  const price = silver?.priceUsdPerTroyOz ?? null;
  const totals = useMemo(
    () => (price === null ? null : calcTotals(entries, price)),
    [entries, price],
  );

  const updatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString("en-US", { hour12: false })
    : "—";

  const sourcePillClass =
    silver?.source === "moderator"
      ? "bg-slate-200 text-slate-700"
      : silver?.source === "none" || silver === null
        ? "bg-red-100 text-red-700"
        : "bg-[#d4af37] text-[#0a1a2e]";

  const setQuantity = (key: CoinTypeKey, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, "");
    setQuantities((current) => ({ ...current, [key]: cleaned }));
  };

  const bumpQuantity = (key: CoinTypeKey, delta: number) => {
    setQuantities((current) => {
      const next = Math.max(0, parseQuantity(current[key]) + delta);
      return { ...current, [key]: next === 0 ? "" : String(next) };
    });
  };

  const clearAll = () => {
    setQuantities(EMPTY_QUANTITIES);
    showToast("Cleared");
  };

  const shareAsPost = async () => {
    if (totals === null || price === null || sharing) {
      return;
    }
    setSharing(true);
    try {
      const lines = entries
        .filter((entry) => entry.quantity > 0)
        .map((entry) => {
          const coin = COINS.find((item) => item.key === entry.coin);
          return {
            coin: coin ? coin.label : entry.coin,
            quantity: entry.quantity,
            meltValue: coin ? meltPerCoin(coin, price) * entry.quantity : 0,
          };
        });
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faceValue: totals.totalFaceValue,
          pureSilverOz: totals.totalPureSilverOz,
          meltValue: totals.meltValue,
          silverPrice: price,
          lines,
        } satisfies ShareRequest),
      });
      if (!res.ok) {
        throw new Error("share failed");
      }
      const data = parseShareResponse(await res.json());
      if (data === null) {
        throw new Error("share response was not the expected shape");
      }
      showToast("Shared to your community");
      navigateTo(data.url);
    } catch {
      showToast("Sharing failed — please try again");
    } finally {
      setSharing(false);
    }
  };

  const copySummary = async () => {
    if (totals === null || price === null) {
      return;
    }
    const summary =
      `My $${totals.totalFaceValue.toFixed(2)} face in junk silver holds ` +
      `${formatOz(totals.totalPureSilverOz)} troy oz of pure silver, worth about ` +
      `${formatUsd(totals.meltValue)} in melt at ${formatPricePerOz(price)}/oz. ` +
      `Estimated with the Agate Junk Silver Melt Calculator — estimates only, not financial advice.`;
    try {
      await navigator.clipboard.writeText(summary);
      showToast("Summary copied — paste it anywhere on Reddit");
    } catch {
      showToast("Copy not available here — use Share as a post instead");
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0a1a2e]">
      <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col px-4 py-4">
        <header className="text-center">
          <p className="text-[0.72rem] font-semibold tracking-[0.25em] text-slate-500">
            AGATE METALS • LIVE REFERENCE
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            Junk Silver Melt Calculator
          </h1>
          <div className="mx-auto mt-3 flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2">
            {loading && silver === null ? (
              <span className="inline-block h-4 w-40 animate-pulse rounded bg-slate-200" />
            ) : (
              <>
                <span className="text-lg font-bold text-[#a07c1a]">
                  {price !== null
                    ? `Silver ${formatPricePerOz(price)} / oz`
                    : "Silver — no live price"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${sourcePillClass}`}
                >
                  {silver ? SOURCE_LABELS[silver.source] : "—"}
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-[0.72rem] text-slate-500">
            Updated {updatedLabel} • Refreshes every 60 seconds
          </p>
        </header>

        {loadError && silver === null ? (
          <div className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-center">
            <p className="font-semibold text-red-900">
              Couldn&apos;t load the live silver price
            </p>
            <p className="mt-1 text-sm text-red-800/70">
              Check your connection and try again. Reference prices may still be
              available once the app reconnects.
            </p>
            <button
              className="mt-3 cursor-pointer rounded-full bg-[#d4af37] px-4 py-2 text-sm font-bold text-[#0a1a2e]"
              onClick={() => {
                setLoading(true);
                setLoadError(false);
                void loadPrices();
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-[#0a1a2e] shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wide">YOUR COINS</h2>
                <button
                  className="cursor-pointer text-sm font-semibold text-slate-500 underline"
                  onClick={clearAll}
                >
                  Clear all
                </button>
              </div>
              {loading && silver === null ? (
                <div className="mt-3 space-y-3">
                  <div className="h-12 animate-pulse rounded-lg bg-slate-200" />
                  <div className="h-12 animate-pulse rounded-lg bg-slate-200" />
                  <div className="h-12 animate-pulse rounded-lg bg-slate-200" />
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {COINS.map((coin) => {
                    const qty = parseQuantity(quantities[coin.key]);
                    const perCoin =
                      price === null ? null : meltPerCoin(coin, price);
                    return (
                      <li
                        key={coin.key}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold leading-tight">
                              {coin.label}
                            </p>
                            <p className="text-xs text-slate-500">
                              {coin.detail} •{" "}
                              {formatOz(pureSilverOzPerCoin(coin))} oz pure
                              silver each
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              className="cursor-pointer rounded-full bg-slate-200 px-2.5 py-1 text-sm font-bold"
                              onClick={() => bumpQuantity(coin.key, -1)}
                              aria-label={`One fewer ${coin.label}`}
                            >
                              −
                            </button>
                            <input
                              className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-lg font-semibold text-black outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/40"
                              type="number"
                              inputMode="numeric"
                              min="0"
                              step="1"
                              value={quantities[coin.key]}
                              placeholder="0"
                              aria-label={`Quantity of ${coin.label}`}
                              onChange={(e) =>
                                setQuantity(coin.key, e.target.value)
                              }
                            />
                            <button
                              className="cursor-pointer rounded-full bg-[#d4af37] px-2.5 py-1 text-sm font-bold text-[#0a1a2e]"
                              onClick={() => bumpQuantity(coin.key, 1)}
                              aria-label={`One more ${coin.label}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {qty > 0 && perCoin !== null ? (
                            <>
                              {qty} × {formatUsd(perCoin)} melt each ={" "}
                              <span className="font-bold text-[#0a1a2e]">
                                {formatUsd(perCoin * qty)}
                              </span>
                            </>
                          ) : (
                            <>
                              Melt each:{" "}
                              {perCoin === null ? "—" : formatUsd(perCoin)}
                            </>
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="mt-4 rounded-2xl bg-black p-4 text-center text-white shadow-lg">
              <p className="text-xs font-semibold tracking-[0.2em]">
                TOTAL MELT VALUE
              </p>
              <p className="mt-1 text-3xl font-bold text-[#d4af37]">
                {totals === null ? "—" : formatUsd(totals.meltValue)}
              </p>
              <div className="mx-auto mt-3 grid max-w-[420px] grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/10 px-2 py-2">
                  <p className="text-[0.65rem] font-bold tracking-wide text-white/60">
                    FACE VALUE
                  </p>
                  <p className="text-base font-bold">
                    {totals === null
                      ? "—"
                      : `$${totals.totalFaceValue.toFixed(2)}`}
                  </p>
                </div>
                <div className="rounded-lg bg-white/10 px-2 py-2">
                  <p className="text-[0.65rem] font-bold tracking-wide text-white/60">
                    PURE SILVER
                  </p>
                  <p className="text-base font-bold">
                    {totals === null
                      ? "—"
                      : `${formatOz(totals.totalPureSilverOz)} oz`}
                  </p>
                </div>
                <div className="rounded-lg bg-white/10 px-2 py-2">
                  <p className="text-[0.65rem] font-bold tracking-wide text-white/60">
                    COINS
                  </p>
                  <p className="text-base font-bold">
                    {totals === null ? "—" : totals.coinCount}
                  </p>
                </div>
              </div>
              {silver?.source === "moderator" ? (
                <p className="mt-2 text-[0.7rem] font-semibold text-white/60">
                  Showing a moderator reference price — live sources are
                  unavailable right now.
                </p>
              ) : null}
              {price === null ? (
                <p className="mt-2 text-[0.7rem] font-semibold text-white/60">
                  No live silver price right now — ask a moderator to set a
                  daily reference price.
                </p>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="cursor-pointer rounded-full bg-[#d4af37] px-3 py-2.5 text-sm font-bold text-[#0a1a2e] disabled:opacity-50"
                  onClick={() => void shareAsPost()}
                  disabled={totals === null || sharing}
                >
                  {sharing ? "Sharing…" : "Share as a post"}
                </button>
                <button
                  className="cursor-pointer rounded-full border-2 border-white bg-black px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  onClick={() => void copySummary()}
                  disabled={totals === null}
                >
                  Copy summary
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-[#0a1a2e] shadow-lg">
              <h2 className="text-sm font-bold tracking-wide">
                MELT PER COIN AT TODAY&apos;S PRICE
              </h2>
              <ul className="mt-2 space-y-1 text-sm">
                {COINS.map((coin) => (
                  <li
                    key={coin.key}
                    className="flex justify-between gap-2 border-b border-slate-100 py-1 last:border-0"
                  >
                    <span>
                      {coin.label}{" "}
                      <span className="text-slate-500">
                        ({formatOz(pureSilverOzPerCoin(coin))} oz)
                      </span>
                    </span>
                    <span className="font-bold">
                      {price === null
                        ? "—"
                        : formatUsd(meltPerCoin(coin, price))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Values use each coin&apos;s full mint spec. Circulated coins
                weigh slightly less — the worn-coin convention is 0.715 troy oz
                of pure silver per $1 face of 90% coinage, versus 0.7234 oz
                unworn.
              </p>
            </section>
          </>
        )}

        <footer className="mt-5 pb-2 text-center text-[0.72rem] leading-relaxed text-slate-500">
          <p>
            All figures are estimates based on the live silver reference price —
            not quotes, and not financial advice.
          </p>
          <p className="mt-2 flex justify-center gap-3">
            <button
              className="cursor-pointer underline"
              onClick={() =>
                navigateTo("https://agatepreciousmetals.com/terms.html")
              }
            >
              Terms
            </button>
            <span>•</span>
            <button
              className="cursor-pointer underline"
              onClick={() =>
                navigateTo("https://agatepreciousmetals.com/privacy.html")
              }
            >
              Privacy
            </button>
            <span>•</span>
            <button
              className="cursor-pointer underline"
              onClick={() => navigateTo("https://agatemetals.com/")}
            >
              agatemetals.com
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
