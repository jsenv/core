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
  start: () => {
    const platformName = platform();
    if (platformName === "darwin") {
      console.log("Detected macOS. Starting PostgreSQL...");
      execSync("brew services start postgresql", { stdio: "inherit" });
      return;
    }
    if (platformName === "linux") {
      console.log("Detected Linux. Starting PostgreSQL...");
      execSync("sudo service postgresql start", { stdio: "inherit" });
      return;
    }
    if (platformName === "win32") {
      console.log("Detected Windows. Starting PostgreSQL...");
      execSync('pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" start', {
        stdio: "inherit",
      });
      return;
    }
    throw new Error(`Unsupported operating system: ${platformName}`);
  },
  stop: () => {
    const platformName = platform();
    if (platformName === "darwin") {
      console.log("Detected macOS. Stopping PostgreSQL...");
      execSync("brew services stop postgresql", { stdio: "inherit" });
      return;
    }
    if (platformName === "linux") {
      console.log("Detected Linux. Stopping PostgreSQL...");
      execSync("sudo service postgresql stop", { stdio: "inherit" });
      return;
    }
    if (platformName === "win32") {
      console.log("Detected Windows. Stopping PostgreSQL...");
      execSync('pg_ctl -D "C:\\Program Files\\PostgreSQL\\14\\data" stop', {
        stdio: "inherit",
      });
      return;
    }
    throw new Error(`Unsupported operating system: ${platformName}`);
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
