#!/usr/bin/env node

import {
  installCertificateAuthority,
  uninstallCertificateAuthority,
} from "@jsenv/https-local";
import { parseArgs } from "node:util";

const options = {
  help: {
    type: "boolean",
  },
  trust: {
    type: "boolean",
  },
};
const { values, positionals } = parseArgs({
  options,
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log(`https-local: Generate https certificates to use on your machine.

Usage: 
npx @jsenv/https-local install --trust
npx @jsenv/https-local uninstall

https://github.com/jsenv/core/tree/main/packages/independent/https-local

`);
  process.exit(0);
}

const commandHandlers = {
  install: async ({ tryToTrust }) => {
    await installCertificateAuthority({
      tryToTrust,
      NSSDynamicInstall: tryToTrust,
    });
  },
  uninstall: async () => {
    await uninstallCertificateAuthority({
      tryToUntrust: true,
    });
  },
};

const [command] = positionals;
const commandHandler = commandHandlers[command];
if (!commandHandler) {
  console.error(`Error: unknown command ${command}.`);
  process.exit(1);
}

await commandHandler(values);
