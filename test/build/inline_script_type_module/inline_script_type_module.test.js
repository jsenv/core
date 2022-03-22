/*
 * souci restants:
 * - pas de version sur le fichier html
 *   ni aucun entry point, sauf si ce point d'entrée vient en fait du html
 */

import { build } from "@jsenv/core/src/build/build.js"

await build({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
})
