#!/usr/bin/env node
// Restructure dist/ -> .vercel/output/ for Vercel Build Output API v3
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const out = join(root, ".vercel", "output");

if (!existsSync(dist)) {
  console.error("dist/ not found — run vite build first");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Static assets
cpSync(join(dist, "client"), join(out, "static"), { recursive: true });

// Server function
const fnDir = join(out, "functions", "index.func");
mkdirSync(fnDir, { recursive: true });
cpSync(join(dist, "server"), fnDir, { recursive: true });

// Build Output API config — route all non-static requests to the function
const config = {
  version: 3,
  routes: [
    { handle: "filesystem" },
    { src: "/(.*)", dest: "/index" },
  ],
};
writeFileSync(join(out, "config.json"), JSON.stringify(config, null, 2));

console.log("✓ Vercel output ready at .vercel/output/");
