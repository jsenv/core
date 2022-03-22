// todo
// - must be able to update the inline script code inside the html
// + the inline script will statically import from an helper
// + use a dynamic import that will also use the same helper

/*
 ce qu'on veut je pense c'est:
 build le code inline avec rollup mais en considérant les imports dynamic comme externes
 on les remplacera par la suite avec le résultat rollup pour ce fichier la

 pour les imports statiques idéalement on veut le bundle
 sauf que on va donc se retrouver avec util qui est dupliqué
*/

import { build } from "@jsenv/core/src/build/build.js"

await build({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
})
