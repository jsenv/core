#!/usr/bin/env node

/*
 * Il me faut en dépendence @jsenv/core et @jsenv/test
 * idéalement il faudrait qu'on demande a l'utilisateur son accord
 * pour installer les dependance lorsqu'elle ne sont pas la (genre playwright chromium)
 *
 * PLEIN DE CHOSE A FAIRE OMG
 *
 * (si y'a pas de dossier src dev se fera dans le dossier courant)
 */

import { parseArgs } from "node:util";

const options = {
  help: {
    type: "boolean",
  },
};
const { values, positionals } = parseArgs({ options, allowPositionals: true });
const outfile = positionals[0];

if (values.help || positionals.length === 0) {
  console.log(`jsenv: dev build and test.

Usage:

npx @jsenv/cli dev <src>          start a dev server for files in <src>
npx @jsenv/cli build <src> <dist> generate an optimized version of files in <src> into <dist>
npx @jsenv/cli preview <dist>     start a server for files in <dist>
npx @jsenv/cli test               run test files

<src> defaults to cwd()/src/
<dist> defaults to cwd()/dist/

https://github.com/jsenv/core

For more advanced options, see the API.`);
  process.exit(0);
}

// TODO
