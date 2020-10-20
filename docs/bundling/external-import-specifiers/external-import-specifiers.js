import { generateBundle } from "@jsenv/core"

generateBundle({
  format: "commonjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.cjs",
  },
  externalImportSpecifiers: ["./answer.js"],
})

generateBundle({
  format: "systemjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

generateBundle({
  format: "esmodule",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

generateBundle({
  format: "global",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
  globals: {
    "./answer.js": "whatever",
  },
})
