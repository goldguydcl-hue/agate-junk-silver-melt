import { Hono } from "hono";
import type { UiResponse } from "@devvit/web/shared";
import type { ModeratorPrices } from "../../shared/api";
import { getModeratorPrices, setModeratorPrices } from "../prices";

type FallbackPricesFormValues = {
  silver?: number | string;
};

const toPrice = (value: number | string | undefined): number | null => {
  if (value === undefined || value === "") {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export const forms = new Hono();

forms.post("/fallback-prices-submit", async (c) => {
  const values = await c.req.json<FallbackPricesFormValues>();
  const current = await getModeratorPrices();
  const next: ModeratorPrices = { ...current };
  const parsed = toPrice(values.silver);
  if (parsed !== null) {
    next.silver = parsed;
  }
  await setModeratorPrices(next);

  return c.json<UiResponse>(
    {
      showToast: "Fallback prices updated",
    },
    200,
  );
});
