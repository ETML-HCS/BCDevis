"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const requestedScript = process.argv[2];
if (!requestedScript) {
  console.error("Indiquez le script Electron à lancer.");
  process.exit(1);
}

const electronPath = require("electron");
const scriptPath = path.resolve(process.cwd(), requestedScript);
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const result = spawnSync(electronPath, [scriptPath, ...process.argv.slice(3)], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  console.error(result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
