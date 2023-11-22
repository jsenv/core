#!/usr/bin/env node

import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { readdirSync, statSync } from "node:fs";
import { URL_META } from "@jsenv/url-meta";
import { removeEntry } from "@jsenv/filesystem";

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
    const currentDirectoryUrl = pathToFileURL(`${process.cwd()}/`);
    const associations = URL_META.resolveAssociations(
      {
        clear: {
          [pattern]: true,
          "**/.*": false,
          "**/.*/": false,
          "**/node_modules/": false,
        },
      },
      currentDirectoryUrl,
    );
    const visitDirectory = async (directoryUrl) => {
      const entryNames = readdirSync(directoryUrl);
      for (const entryName of entryNames) {
        const entryUrl = new URL(entryName, directoryUrl);
        const meta = URL_META.applyAssociations({
          url: entryUrl.href,
          associations,
        });
        if (meta.clear) {
          await removeEntry(entryUrl, { recursive: true, allowUseless: true });
        }
        const entryStat = statSync(entryUrl);
        if (entryStat.isDirectory()) {
          await visitDirectory(entryUrl);
        }
      }
    };
    await visitDirectory(currentDirectoryUrl);
  },
};

const [command] = positionals;
const commandHandler = commandHandlers[command];

if (!commandHandler) {
  console.error(`Error: unknown command ${command}.`);
  process.exit(1);
}

await commandHandler(positionals.slice(1));
