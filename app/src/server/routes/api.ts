import { Hono } from "hono";
import { context, reddit } from "@devvit/web/server";
import type {
  PricesResponse,
  ShareRequest,
  ShareResponse,
} from "../../shared/api";
import { formatUsd } from "../../shared/junk-silver";
import { getModeratorPrices, getPrices } from "../prices";

type ErrorResponse = {
  status: "error";
  message: string;
};

export const api = new Hono();

api.get("/prices", async (c) => {
  try {
    const result = await getPrices();
    return c.json<PricesResponse>({
      type: "prices",
      silver: result.silver,
      fetchedAt: result.fetchedAt,
      cacheHit: result.cacheHit,
    });
  } catch (error) {
    console.error("API prices error:", error);
    return c.json<ErrorResponse>(
      { status: "error", message: "Failed to load prices" },
      500,
    );
  }
});

api.get("/moderator-prices", async (c) => {
  try {
    const prices = await getModeratorPrices();
    return c.json({ type: "moderator-prices", prices });
  } catch (error) {
    console.error("API moderator-prices error:", error);
    return c.json<ErrorResponse>(
      { status: "error", message: "Failed to load reference prices" },
      500,
    );
  }
});

api.post("/share", async (c) => {
  try {
    const body = await c.req.json<ShareRequest>();
    const value = Number.isFinite(body.meltValue) ? body.meltValue : 0;
    const face = Number.isFinite(body.faceValue) ? body.faceValue : 0;
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const breakdown = lines
      .filter((line) => line.quantity > 0)
      .map((line) => `${line.quantity}x ${line.coin}`)
      .join(", ");
    const detail = breakdown.length > 0 ? ` (${breakdown})` : "";
    const title = `My $${face.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} face in junk silver is worth about ${formatUsd(value)} in melt${detail}`;
    const titleWithCoin =
      title.length > 300 ? `${title.slice(0, 297)}...` : title;

    const post = await reddit.submitCustomPost({ title: titleWithCoin });
    return c.json<ShareResponse>({
      type: "share",
      postId: post.id,
      url: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error("API share error:", error);
    return c.json<ErrorResponse>(
      { status: "error", message: "Failed to share result" },
      500,
    );
  }
});
