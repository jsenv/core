import { buildProject } from "@jsenv/core"

buildProject({
  format: "commonjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "file.cjs",
  },
  externalImportSpecifiers: ["./answer.js"],
})

buildProject({
  format: "systemjs",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

buildProject({
  format: "esmodule",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

buildProject({
  format: "global",
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
  globals: {
    "./answer.js": "whatever",
  },
})
