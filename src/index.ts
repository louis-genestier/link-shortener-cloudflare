import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { init } from "@paralleldrive/cuid2";
import { cloudflareRateLimiter } from "@hono-rate-limiter/cloudflare";

const createSchema = z.object({
  url: z.string().url(),
});

const getSchema = z.object({
  id: z.string(),
});

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.post(
  "/shorten",
  cloudflareRateLimiter<{ Bindings: CloudflareBindings }>({
    rateLimitBinding: (c) => c.env.MY_RATE_LIMITER,
    keyGenerator: (c) => c.req.header("cf-connecting-ip") ?? "",
  }),
  // zValidator("json", createSchema),
  async (c) => {
    const { url } = await c.req.json();

    const createId = init({
      length: 6,
    });
    const id = createId();

    await c.env.link_shortener.put(id, url, {
      expirationTtl: 60 * 60 * 24 * 30,
    });

    return c.json({
      id,
      originalUrl: url,
    });
  }
);

app.get("/:id", zValidator("param", getSchema), async (c) => {
  const { id } = c.req.valid("param");

  const url = await c.env.link_shortener.get(id);

  if (!url) {
    return c.notFound();
  }

  return c.redirect(url);
});

export default app;
