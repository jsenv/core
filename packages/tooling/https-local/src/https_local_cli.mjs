#!/usr/bin/env node

import {
  installCertificateAuthority,
  uninstallCertificateAuthority,
  verifyHostsFile,
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

npx @jsenv/https-local setup
  Install root certificate, try to trust it and ensure localhost is mapped to 127.0.0.1

npx @jsenv/https-local install --trust
  Install root certificate on the filesystem
  - trust: Try to add root certificate to os and browser trusted stores.

npx @jsenv/https-local uninstall
  Uninstall root certificate from the filesystem

npx @jsenv/https-local localhost-mapping
  Ensure localhost mapping to 127.0.0.1 is set on the filesystem

https://github.com/jsenv/core/tree/main/packages/tooling/https-local

`);

  process.exit(0);
}

const commandHandlers = {
  setup: async () => {
    await installCertificateAuthority({
      tryToTrust: true,
      NSSDynamicInstall: true,
    });
    await verifyHostsFile({
      ipMappings: {
        "127.0.0.1": ["localhost"],
      },
      tryToUpdateHostsFile: true,
    });
  },
  install: async ({ trust }) => {
    await installCertificateAuthority({
      tryToTrust: trust,
      NSSDynamicInstall: trust,
    });
  },
  uninstall: async () => {
    await uninstallCertificateAuthority({
      tryToUntrust: true,
    });
  },
  ["localhost-mapping"]: async () => {
    await verifyHostsFile({
      ipMappings: {
        "127.0.0.1": ["localhost"],
      },
      tryToUpdateHostsFile: true,
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
