// ArcFlow backend entrypoint: Express app wiring (CORS, routes).
import express from "express";
import cors from "cors";
import { env } from "./config.js";
import "./db.js";
import publicRoutes from "./routes/public.js";

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  })
);

// --- Circle API proxy ---------------------------------------------------------
// Circle App Kit (swap/bridge) calls api.circle.com directly from the browser,
// but those endpoints send custom request headers (X-License-Identifier,
// X-User-Agent) that are NOT in their CORS Access-Control-Allow-Headers list,
// so the browser blocks them ("Failed to fetch"). Server-side has no CORS, so we
// forward the request here. The frontend rewrites circle.com fetches to this
// route. Mounted with a raw body parser BEFORE express.json so the original
// bytes pass through untouched.
const CIRCLE_HOST_RE = /^https:\/\/[a-z0-9.-]+\.circle\.com\//i;
app.all("/api/cproxy", express.raw({ type: "*/*", limit: "4mb" }), async (req, res) => {
  const target = req.query.url;
  if (!target || !CIRCLE_HOST_RE.test(target)) {
    return res.status(400).json({ error: "invalid_proxy_target" });
  }
  const skip = new Set([
    "host", "origin", "referer", "connection", "content-length", "accept-encoding",
  ]);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!skip.has(k.toLowerCase())) headers[k] = v;
  }
  const hasBody = !["GET", "HEAD"].includes(req.method) && req.body && req.body.length;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? req.body : undefined,
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.set("content-type", ct);
    res.send(buf);
  } catch (e) {
    res.status(502).json({ error: "proxy_failed", message: String(e?.message || e) });
  }
});

app.use(express.json());

app.use("/api", publicRoutes);

// 404 + error handlers
app.use((req, res) => res.status(404).json({ error: "not_found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(env.port, () => {
  console.log(`ArcFlow backend listening on http://localhost:${env.port}`);
});
