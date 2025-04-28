#!/usr/bin/env node

import { execSync } from "node:child_process";
import { platform } from "node:os";
import { parseArgs } from "node:util";

const options = {
  help: {
    type: "boolean",
  },
};
const { values, positionals } = parseArgs({ options, allowPositionals: true });
if (values.help || positionals.length === 0) {
  usage();
  process.exit(0);
}
if (positionals.length > 1) {
  console.error("Error: too many inputs.");
  process.exit(1);
}
const command = positionals[0];
if (command === "help") {
  usage();
  process.exit(0);
}
if (command !== "install") {
  usage();
  process.exit(1);
}

function usage() {
  console.log(`@jsenv/database: CLI to manage database.

Usage: npx @jsenv/database [command]

https://github.com/jsenv/importmap-node-module

Command:
  help    Display this message.
  install Install the database (postgre) on the current machine.`);
}

try {
  const platformName = platform();
  if (platformName === "darwin") {
    console.log("Detected macOS. Installing PostgreSQL using Homebrew...");
    execSync("brew install postgresql", { stdio: "inherit" });
  } else if (platformName === "linux") {
    console.log("Detected Linux. Installing PostgreSQL using apt...");
    execSync("sudo apt-get update && sudo apt-get install -y postgresql", {
      stdio: "inherit",
    });
  } else if (platformName === "win32") {
    console.log("Detected Windows. Installing PostgreSQL using Chocolatey...");
    execSync("choco install postgresql --confirm", { stdio: "inherit" });
  } else {
    console.error(`Unsupported operating system: ${platformName}`);
    process.exit(1);
  }
} catch (e) {
  console.error("Error installing PostgreSQL:", e);
  process.exit(1);
}
