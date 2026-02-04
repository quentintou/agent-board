#!/usr/bin/env node
import express from "express";
import path from "path";
import { setDataDir } from "./store";
import apiRouter from "./routes";

function parseArgs() {
  const args = process.argv.slice(2);
  let port = 3456;
  let dataDir = path.resolve("data");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" && args[i + 1]) port = parseInt(args[i + 1], 10);
    if (args[i] === "--data" && args[i + 1]) dataDir = path.resolve(args[i + 1]);
  }

  return { port, dataDir };
}

const { port, dataDir } = parseArgs();
setDataDir(dataDir);

const app = express();

app.use(express.json({ limit: "1mb" }));

// API routes
app.use("/api", apiRouter);

// Dashboard static files
app.use(express.static(path.join(__dirname, "..", "dashboard")));

// Client view (read-only dashboard)
app.get("/dashboard/client/:projectId", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dashboard", "client.html"));
});

// SPA fallback
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "dashboard", "index.html"));
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err.stack || err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Agent Board running at http://localhost:${port}`);
  console.log(`Dashboard: http://localhost:${port}`);
  console.log(`API: http://localhost:${port}/api`);
  console.log(`Data dir: ${dataDir}`);
});
