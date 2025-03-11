#!/usr/bin/env node

import { clearDirectorySync } from "@jsenv/filesystem";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const options = {
  help: {
    type: "boolean",
  },
};
const { values, positionals } = parseArgs({
  options,
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(`filesystem: Manage files generated during tests.

Usage: npx @jsenv/filesystem clear [pattern]

https://github.com/jsenv/core/tree/main/packages/independent/filesystem

pattern: files matching this pattern will be removed; can use "*" and "**"
`);
  process.exit(0);
}

const commandHandlers = {
  clear: (pattern) => {
    const currentDirectoryPath = process.cwd();
    const currentDirectoryUrl = pathToFileURL(`${currentDirectoryPath}/`);
    console.log(`clear files matching ${pattern} in ${currentDirectoryPath}`);
    clearDirectorySync(currentDirectoryUrl, pattern);
  },
};

const [command] = positionals;
const commandHandler = commandHandlers[command];

if (!commandHandler) {
  console.error(`Error: unknown command ${command}.`);
  process.exit(1);
}

if (commandHandler.length) {
  const args = positionals.slice(1);
  if (args.length === 0) {
    console.error(`Error: "${command}" command expect arguments.`);
    process.exit(1);
  }
}

await commandHandler(...positionals.slice(1));
