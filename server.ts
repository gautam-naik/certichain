import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { config } from "./server/config.ts";
import { getDb } from "./server/db.ts";
import { createApiRouter } from "./server/routes.ts";
import { compileCertificateRegistry } from "./server/solidity.ts";

async function startServer() {
  // Initialize SQLite database and compile Solidity contract on boot
  getDb();
  try {
    const compiled = compileCertificateRegistry();
    console.log(
      `[CertiChain] Compiled ${compiled.contractName} via solc ${compiled.compilerVersion}`
    );
  } catch (err) {
    console.error("[CertiChain] Solidity compilation warning:", err);
  }

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  // CORS headers for local dev & API access
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use("/api", createApiRouter());

  app.get("/api/docs", (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.send(`<!doctype html>
<html>
  <head>
    <title>CertiChain API Documentation</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #070B14; color: #E2E8F0; max-width: 920px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
      h1 { color: #2DD4BF; }
      pre { background: #0F172A; border: 1px solid #1E293B; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; }
      a { color: #2DD4BF; }
    </style>
  </head>
  <body>
    <h1>CertiChain OpenAPI 3.0 Specification</h1>
    <p>Machine-readable schema: <a href="/api/docs/openapi.json">/api/docs/openapi.json</a></p>
    <pre id="spec">Loading specification...</pre>
    <script>
      fetch('/api/docs/openapi.json').then(r => r.json()).then(d => {
        document.getElementById('spec').textContent = JSON.stringify(d, null, 2);
      });
    </script>
  </body>
</html>`);
  });

  const isProd = process.env.NODE_ENV === "production";
  const distDir = path.resolve(process.cwd(), "dist");

  if (!isProd || !fs.existsSync(distDir)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`[CertiChain] Server running on http://0.0.0.0:${config.port}`);
  });
}

startServer();
