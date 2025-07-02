#!/usr/bin/env node

import { execSync } from "node:child_process";
import { platform } from "node:os";
import { parseArgs } from "node:util";

const options = {
  help: {
    type: "boolean",
  },
};
const commands = {
  help: () => {
    console.log(`@jsenv/database: CLI to manage database.

Usage: npx @jsenv/database [command]

https://github.com/jsenv/importmap-node-module

Command:
  help      Display this message.
  install   Install the database (postgresql) on the current machine.`);
  },
  install: () => {
    const platformName = platform();
    if (platformName === "darwin") {
      console.log("Detected macOS. Installing PostgreSQL using Homebrew...");
      execSync("brew install postgresql", { stdio: "inherit" });
      return;
    }
    if (platformName === "linux") {
      console.log("Detected Linux. Installing PostgreSQL using apt...");
      execSync("sudo apt-get update && sudo apt-get install -y postgresql", {
        stdio: "inherit",
      });
      return;
    }
    if (platformName === "win32") {
      console.log(
        "Detected Windows. Installing PostgreSQL using Chocolatey...",
      );
      execSync("choco install postgresql --confirm", { stdio: "inherit" });
      return;
    }
    throw new Error(`Unsupported operating system: ${platformName}`);
  },
  start: async () => {
    await import("./cli/start.js");
  },
  stop: async () => {
    await import("./cli/stop.js");
  },
  setup: async () => {
    await import("./cli/setup.js");
  },
  manage: async () => {
    await import("./cli/manage.js");
  },
};

const { values, positionals } = parseArgs({ options, allowPositionals: true });
if (values.help || positionals.length === 0) {
  commands.help();
  process.exit(0);
}
if (positionals.length > 1) {
  console.error("Error: too many inputs.");
  process.exit(1);
}
const command = positionals[0];
if (command === "help") {
  commands.help();
  process.exit(0);
}
const commandFunction = commands[command];
if (!commandFunction) {
  console.error(`Error: unknown command "${command}".`);
  commands.help();
  process.exit(1);
}
await commandFunction(values);
