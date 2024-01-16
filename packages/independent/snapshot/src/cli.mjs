#!/usr/bin/env node

import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { clearDirectorySync } from "@jsenv/filesystem";

const options = {
  "help": {
    type: "boolean",
  },
  "include-dev": {
    type: "boolean",
  },
};
const { values, positionals } = parseArgs({ options, allowPositionals: true });

if (values.help || positionals.length === 0) {
  console.log(`snapshot: Manage snapshot files generated during tests.

Usage: npx @jsenv/snapshot clear [pattern]

https://github.com/jsenv/core/tree/main/packages/independent/snapshot

pattern: files matching this pattern will be removed; can use "*" and "**"
`);
  process.exit(0);
}

const commandHandlers = {
  clear: async (pattern) => {
    const currentDirectoryPath = process.cwd();
    const currentDirectoryUrl = pathToFileURL(`${currentDirectoryPath}/`);
    clearDirectorySync(currentDirectoryUrl, pattern);
  },
};

const [command] = positionals;
const commandHandler = commandHandlers[command];

if (!commandHandler) {
  console.error(`Error: unknown command ${command}.`);
  process.exit(1);
}

await commandHandler(...positionals.slice(1));
