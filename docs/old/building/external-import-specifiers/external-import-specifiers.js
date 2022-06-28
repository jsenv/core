import { build } from "@jsenv/core"

build({
  format: "commonjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPoints: {
    main: "file.cjs",
  },
  externalImportSpecifiers: ["./answer.js"],
})

build({
  format: "systemjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPoints: {
    main: "file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

build({
  format: "esmodule",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPoints: {
    main: "file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

build({
  format: "global",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPoints: {
    main: "file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
  globals: {
    "./answer.js": "whatever",
  },
})
