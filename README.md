# Junk Silver Melt Calculator

A free Reddit app from Agate Precious Metals (v0.0.1). Enter how many of each
old US silver coin you have — 90% dimes, quarters and half dollars, Morgan &
Peace dollars, 40% Kennedy halves, 35% War Nickels — and it tells you the
total face value, the total pure silver weight in troy ounces, and the melt
value at the live silver price, plus the melt value of each single coin.

Built Nov 20, 2026, reusing the architecture of the Agate Metals Checker
rebuild (Devvit React template 0.15.4, Vite/React/Hono/Tailwind/TypeScript,
Node 24): the same price chain, the same shared-math pattern, the same house
rules (zero type casts — runtime guards instead; no `window.location`,
`alert`, or downloads — `navigateTo` / `showToast` / clipboard instead).

## How it works

- **Entry point:** subreddit "•••" menu → "Create a new post" (moderators).
  The post opens the calculator full-screen.
- **Calculator:** six coin rows, each with a quantity stepper. Outputs: total
  melt value, total face value, total pure silver (troy oz), coin count, and
  a per-coin melt table at today's price.
- **Sharing:** share a result as a new post, or copy a summary to paste
  anywhere on Reddit.

## The math — sourced figures

Pure silver per coin is **computed from the coin spec, not from a rounded
constant**: gross weight in grams × fineness ÷ 31.1034768 g per troy ounce.
All figures verified Nov 20, 2026:

| Coin | Gross weight | Fineness | Pure silver per coin |
| --- | --- | --- | --- |
| 90% Silver Dime | 2.5 g | 90% | 0.07234 troy oz |
| 90% Silver Quarter | 6.25 g | 90% | 0.18085 troy oz |
| 90% Silver Half Dollar | 12.5 g | 90% | 0.36170 troy oz |
| Morgan & Peace Dollar | 26.73 g | 90% | 0.77345 troy oz |
| 40% Kennedy Half Dollar | 11.5 g | 40% | 0.14789 troy oz |
| 35% War Nickel | 5 g | 35% | 0.05626 troy oz |

Sources:

- **Numista** (via the Numista API client): type 52, "Roosevelt Silver Dime"
  — 2.5 g, Silver (.900); type 45, "Jefferson Wartime Nickel" — 5 g,
  Billon (.350 silver); type 10865, "Kennedy Half Dollar (40% Silver)" —
  11.5 g, Billon (.400 silver).
- **Bullion Price Check** junk-silver calculator
  (`bullionpricecheck.com/melt-value/junk-silver-per-face-value`, live
  Nov 20, 2026): 0.7234 troy oz pure silver per $1 face of 90% coinage
  (= 0.07234 oz per dime, 0.18085 per quarter, 0.36170 per half — exactly
  the spec-derived figures above); 0.29584 oz per $1 face of 40% halves;
  0.05626 oz per War Nickel. BPC also states the worn-coin convention of
  0.715 oz per $1 face for circulated 90% coins.
- **Bullion Price Check** `product_spec` for the Morgan Silver Dollar
  (1878–1904, VG): tracked 0.77345 troy oz. **NGC's US Silver Coin Melt
  Values table** lists the Morgan and Peace dollars at 0.7734 oz
  (26.73 g, 90% silver). Money Metals and SD Bullion agree: 0.7734 oz.

Two things worth knowing:

1. **The $1-face rule does NOT apply to silver dollars.** $1 face of
   dimes/quarters/halves holds 0.7234 oz of pure silver, but a Morgan or
   Peace dollar holds 0.77345 oz — about 7% more silver per face dollar.
   A calculator that applied 0.7234 to dollars would undervalue them.
2. **Discrepancy noted, spec value used.** BPC's 0.29584 oz per $1 face of
   40% halves implies 0.14792 oz per half, while the spec (11.5 g × 40% =
   4.6 g) gives 0.14789 oz — a 0.00003 oz rounding difference in BPC's
   per-face figure. The spec-derived 0.14789 oz is used here. NGC lists
   0.1479 oz, which agrees with the spec value.
3. **Full mint spec, not worn.** The calculator values coins at their full
   mint spec. Circulated coins weigh slightly less; the worn-coin
   convention (0.715 oz per $1 face of 90% coinage) is shown in the app as
   a note, not applied.

Melt value = total pure silver (troy oz) × live silver price (USD per
troy oz). Per-coin melt = that coin's pure silver × live silver price.

## Price fallback chain (silver only, in order)

1. Yahoo Finance futures (SI=F, COMEX silver). No key needed.
2. gold-api.com (XAG). Free, no key.
3. metalpriceapi.com — only when a `metalpriceapi_key` is set in app
   settings.
4. Moderator-maintained daily reference price (Redis). Moderators update it
   from the subreddit menu ("Update fallback prices") — no new upload
   needed. Seeded on install with the Nov 20, 2026 silver spot:
   **$42.05/ozt** (Bullion Price Check / gold-api.com, 2026-11-20T06:52:04Z).

Prices are cached server-side for 60 seconds and refreshed on the same
interval in the client. The chain's source-selection and cache-parsing logic
lives in `app/src/shared/pricing.ts` (no Devvit imports) so it is
unit-testable under plain Node; `app/src/server/prices.ts` is the thin
fetch + Redis wrapper around it.

## Standalone web version

`standalone/junk-silver-melt-standalone.html` is the same calculator as a
single self-contained HTML file (no Devvit dependencies) for embedding on a
web page, e.g. bullionpricecheck.com. It uses gold-api.com first, then Yahoo
Finance, then the built-in reference price ($42.05/ozt, Nov 20, 2026).

**Theme (Joe, Nov 20, 2026): LIGHT.** White page background, dark navy
text, gold accents only (headers, buttons, key numbers) — built to sit
cleanly on agatemetals.com and bullionpricecheck.com, both light sites. The
Devvit app itself stays gold-on-navy (the Reddit look, matching the original
app) — only the standalone twin is light.

## Commands

- `npm run dev`: Playtest the app live on Reddit.
- `npm run build`: Builds the client and server.
- `npm run check`: Type-checks, lints, and checks formatting.
- `npm run test:unit`: Runs the unit tests (math + price-chain logic).
- `npm run deploy`: Uploads a new version of your app.
- `npm run launch`: Uploads and submits the app for review.
- `npm run login`: Logs your CLI into Reddit.

## Publish

```sh
npx devvit publish --public
```

## Disclaimers

Every figure the app shows is an **estimate**, not a quote and not financial
advice. Prices move constantly. Terms:
https://agatepreciousmetals.com/terms.html — Privacy:
https://agatepreciousmetals.com/privacy.html
