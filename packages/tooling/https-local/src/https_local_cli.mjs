#!/usr/bin/env node

import {
  installCertificateAuthority,
  requestCertificate,
  uninstallCertificateAuthority,
  verifyHostsFile,
} from "@jsenv/https-local";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const options = {
  "help": {
    type: "boolean",
  },
  "trust": {
    type: "boolean",
  },
  "certificate": {
    type: "string",
  },
  "private-key": {
    type: "string",
  },
  "hostnames": {
    type: "string",
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

npx @jsenv/https-local generate
  Generate a server certificate and write it to files
  - certificate: Path where to write the certificate file (default: certificate.pem)
  - private-key: Path where to write the private key file (default: private_key.pem)
  - hostnames: Comma-separated list of hostnames (default: localhost)

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
  generate: async ({ certificate, "private-key": privateKey, hostnames }) => {
    const certificateFilePath = certificate || "certificate.pem";
    const privateKeyFilePath = privateKey || "private_key.pem";
    const altNames = hostnames ? hostnames.split(",") : ["localhost"];
    const result = requestCertificate({ altNames });
    writeFileSync(certificateFilePath, result.certificate);
    writeFileSync(privateKeyFilePath, result.privateKey);
    console.log(`certificate written to ${certificateFilePath}`);
    console.log(`private key written to ${privateKeyFilePath}`);
  },
};

const [command] = positionals;
const commandHandler = commandHandlers[command];
if (!commandHandler) {
  console.error(`Error: unknown command ${command}.`);
  process.exit(1);
}

await commandHandler(values);
