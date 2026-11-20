# Junk Silver Melt Calculator — Build Report

Project: `~/workspace/reddit-tools/junk-silver-melt/` — Devvit app v0.0.1
(`agate-junk-silver-melt`) + standalone HTML twin. Built Nov 20, 2026.
No push, no `devvit publish`, nothing deployed — per the task, the parent
handles GitHub/pushing/zipping.

## 1. Silver-content figures — verified before coding

Pure silver per coin is computed from the spec (gross weight × fineness ÷
31.1034768 g/troy oz), never from a rounded constant.

| Coin | Spec | Pure silver |
| --- | --- | --- |
| 90% dime | 2.5 g, 90% | 0.07234 ozt |
| 90% quarter | 6.25 g, 90% | 0.18085 ozt |
| 90% half | 12.5 g, 90% | 0.36170 ozt |
| Morgan & Peace $1 | 26.73 g, 90% | 0.77345 ozt |
| 40% Kennedy half | 11.5 g, 40% | 0.14789 ozt |
| 35% War Nickel | 5 g, 35% | 0.05626 ozt |

Sources checked live Nov 20, 2026:

- **Numista API** (client `custom.legacy-numista/bin/numista_api.py`):
  type 52 "Roosevelt Silver Dime" — 2.5 g, Silver (.900); type 45
  "Jefferson Wartime Nickel" — 5 g, Billon (.350 silver); type 10865
  "Kennedy Half Dollar (40% Silver)" — 11.5 g, Billon (.400 silver).
  (Numista search did not surface a Morgan/Peace dollar type directly.)
- **Bullion Price Check** junk calculator (live call Nov 20, 2026):
  0.7234 ozt per $1 face of 90% coinage; 0.29584 ozt per $1 face of 40%
  halves; 0.05626 oz per War Nickel; worn-coin convention 0.715 ozt per
  $1 face. BPC `product_spec` for the Morgan Silver Dollar: tracked
  0.77345 ozt.
- **NGC US Silver Coin Melt Values table** (web search, Nov 20, 2026):
  Morgan/Peace dollar 0.7734 oz, Kennedy 40% 0.1479 oz, War Nickel
  0.0563 oz. Money Metals / SD Bullion agree on 0.7734 oz for dollars.

Discrepancies recorded (both in README and code comments):

- The $1-face rule (0.7234 oz/$1) does **not** apply to silver dollars:
  Morgan/Peace hold 0.77345 oz, ~7% more per face dollar.
- BPC's 0.29584 oz/$1 face for 40% halves implies 0.14792 oz per half vs
  the spec-derived 0.14789 oz — a 0.00003 oz rounding difference in BPC's
  per-face figure. Spec value used; NGC's 0.1479 agrees with it.

## 2. `npm run check` — exit 0

`npm run check` (type-check + lint + prettier) inside `app/` — **exit 0**,
Nov 20, 2026. Notes from getting there: test files are excluded from the
tsconfig projects (plain-Node `--experimental-strip-types` needs explicit
`.ts` imports, which `tsc` rejects), so they are linted without type info
via a dedicated eslint override; the price-chain's pure logic lives in
`src/shared/pricing.ts` (no Devvit imports) so it is unit-testable.

## 3. `npm run build` — exit 0

`npm run build` (vite build) — **exit 0**, Nov 20, 2026. The compiled
server bundle (`dist/server/index.cjs`) was inspected and contains all
three price legs (Yahoo SI=F, gold-api XAG, metalpriceapi XAG), the
`prices:cache` / `moderatorPrices` Redis keys, the `/api/prices`,
`/api/moderator-prices` and `/api/share` routes, the fallback-prices form,
and the on-install seeding trigger.

## 4. Math — hand-computed vs app code

Test price: **silver $42.05/ozt** — the live Bullion Price Check spot
(gold-api.com) as of **2026-11-20T06:52:04Z**. Expected values computed by
hand from the specs above; actual values from the app's `calcTotals` /
`meltPerCoin` via `npm run test:unit` (11/11 pass).

| Input | Expected face | Expected pure silver | Expected melt @ $42.05 | App actual melt |
| --- | --- | --- | --- | --- |
| 10 dimes | $1.00 | 0.7233917978 ozt | $30.418625 | $30.418625 ✓ |
| 4 quarters | $1.00 | 0.7233917978 ozt | $30.418625 | $30.418625 ✓ |
| 2 Morgan dollars | $2.00 | 1.5469010204 ozt | $65.047188 | $65.047188 ✓ |
| 5 War Nickels | $0.25 | 0.2813190325 ozt | $11.829465 | $11.829465 ✓ |
| All four combined | $4.25 | 3.2750036495 ozt | $137.713903 | $137.713903 ✓ |

Cross-checks that also passed: 10 dimes = 4 quarters = $1 face =
0.72339 ozt (matches BPC's 0.7234/$1 face); same cases at $50.00/ozt
(10 dimes $36.169590, 2 Morgans $77.345051, 5 War Nickels $14.065952,
full six-coin set $294.442967 on $8.75 face / 5.8888593445 ozt);
per-coin pure silver matches every sourced spec to 5 decimals.

## 5. Price chain — tested live

Same endpoints and parsing guards as `src/server/prices.ts`, run Nov 20,
2026 at 07:44:21Z:

- Yahoo Finance SI=F: **$41.59/ozt** ✓
- gold-api.com XAG: **$41.718/ozt** ✓ (legs agree within $0.13)
- Chain winner with both live: Yahoo $41.59 (first leg, as designed).
- 60-second cache: enforced by `isCacheFresh` (unit-tested: 30 s old =
  fresh, 61 s old = stale) and used in `getPrices` before any fetch.
- Network-down fallback: unit-tested in `resolveSilverPrice` (all live
  legs null → moderator price $41.88, source `moderator`; no moderator →
  null / `none`). The standalone's chain was also run with fetch stubbed
  to fail: gold-api fail → Yahoo $41.59; both fail → built-in reference
  $42.05.
- Seed moderator price: $42.05 (the BPC spot above). Note the live price
  has since moved to ~$41.6–41.7, so the seed will read slightly stale
  until a moderator updates it via the menu or a fresh install re-seeds.

Not testable from this VM: the actual Devvit runtime (Redis, `devvit
playtest`, menu/form/install trigger inside Reddit). That needs Joe's
Reddit login + device browser — see "Still needs Joe".

## 6. Standalone HTML — syntax + smoke test

`standalone/junk-silver-melt-standalone.html`:

- `node --check` on the extracted script: **OK**.
- vm execution test (no DOM): math matches the hand values above
  (combined $137.713903 @ $42.05); price legs verified — gold-api live,
  Yahoo fallback, reference fallback.
- DOM render + interaction test (stubbed document): 6 coin rows built,
  per-coin table 6 rows, live price shown, 10× "+" on dimes →
  $1.00 face / 0.7234 oz / $30.18 melt at $41.72 — **passed**.
- **Theme (Joe's Nov 20 ~02:37 design change): LIGHT.** White page
  background (`#ffffff`), dark navy text (`#0a1a2e`), gold accents only —
  dark-gold `#9a7b1e` for header/price text, `#d4af37` buttons with navy
  text, pale-gold `#fdf8e7` totals panel. Built to read clean on
  agatemetals.com and bullionpricecheck.com (both light sites). The Devvit
  app itself is untouched and stays gold-on-navy (the Reddit look).
- Not verified in a real browser (no browser available to this subagent):
  the final visual render. Recommend a quick visual pass in the parent's
  browser before handing the file to BPC.

## 7. Files delivered

- `app/` — Devvit project (name `agate-junk-silver-melt`, v0.0.1),
  `devvit.json` (header-menu "Create a new post", moderator "Update
  fallback prices" form, onAppInstall seeding), `src/server/prices.ts`
  (silver-only chain), `src/shared/junk-silver.ts` (coin table + math),
  `src/shared/pricing.ts` (pure chain logic + tests), client game/splash
  (gold-on-navy).
- `standalone/junk-silver-melt-standalone.html` — light-theme twin.
- `README.md` — what it does, sourced math, price chain, commands.
- `docs/listing-copy.md` — About / Featuring / Tile copy; Terms +
  Privacy URLs (both verified HTTP 200 on Nov 20, 2026; reused, not
  recreated).
- `BUILD-REPORT.md` — this file.

## 8. Still needs Joe (for the parent)

- **Reddit publish needs Joe's login + device browser**: `devvit login`,
  `devvit playtest` (in-Reddit runtime check of menu / form / install
  trigger), and `devvit publish --public`. None of that was run here.
- **Catalog assets not built**: icon / tile / featuring / fallback images
  for the App Directory listing. The checker's gold-on-navy set lives in
  `~/workspace/reddit-devvit-app/assets/` (builder
  `~/workspace/reddit-devvit-app/build_assets.py`) — render a matching set
  for this app, or reuse the checker's if Joe wants one visual identity.
- **Moderator reference price will go stale**: seeded at $42.05 (Nov 20,
  06:52Z); live silver was ~$41.6–41.7 by 07:44Z. A moderator should
  update it via the subreddit menu after install, or it updates itself
  whenever the live legs work (they are the primary source).
- **Standalone visual check**: confirm the light theme renders as intended
  in a real browser before sending it to bullionpricecheck.com.
