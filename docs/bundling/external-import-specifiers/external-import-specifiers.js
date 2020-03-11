import {
  generateCommonJsBundle,
  generateSystemJsBundle,
  generateEsModuleBundle,
  generateGlobalBundle,
} from "@jsenv/core"

generateCommonJsBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

generateSystemJsBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

generateEsModuleBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
})

generateGlobalBundle({
  projectDirectoryUrl: new URL("./", import.meta.url),
  entryPointMap: {
    main: "./file.js",
  },
  externalImportSpecifiers: ["./answer.js"],
  globals: {
    "./answer.js": "whatever",
  },
})
