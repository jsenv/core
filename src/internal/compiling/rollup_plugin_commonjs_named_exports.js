// https://github.com/snowpackjs/snowpack/blob/main/esinstall/src/rollup-plugins/rollup-plugin-wrap-install-targets.ts

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { VM as VM2 } from "vm2"
import isValidIdentifier from "is-valid-identifier"
import resolve from "resolve"
import { init, parse } from "cjs-module-lexer"
import { fileSystemPathToUrl, urlToFileSystemPath } from "@jsenv/filesystem"

export const rollupPluginCommonJsNamedExports = ({ logger }) => {
  const inputSummaries = {}
  const cjsScannedNamedExports = {}

  return {
    async buildStart({ input }) {
      await init()

      Object.keys(input).forEach((key) => {
        const inputFilePath = input[key]
        const inputFileUrl = fileSystemPathToUrl(inputFilePath)
        console.log({ inputFileUrl })
        inputSummaries[inputFileUrl] = {
          all: false,
          default: false,
          namespace: false,
          named: [],
        }

        const cjsExports =
          detectStaticExports({ logger, fileUrl: inputFileUrl }) ||
          detectExportsUsingSandboxedRuntime({ logger, fileUrl: inputFileUrl })

        if (cjsExports && cjsExports.length) {
          cjsScannedNamedExports[inputFileUrl] = cjsExports
        }
        input[key] = `jsenv:${inputFileUrl}`
      })
    },
    resolveId(source) {
      if (source.startsWith("jsenv:")) {
        return source
      }

      return null
    },
    load(id) {
      if (!id.startsWith("jsenv:")) {
        return null
      }

      const inputFileUrl = id.substring("jsenv:".length)
      const inputSummary = inputSummaries[inputFileUrl]
      let uniqueNamedExports = inputSummary.named
      const scannedNamedExports = cjsScannedNamedExports[inputFileUrl]
      if (scannedNamedExports) {
        uniqueNamedExports = scannedNamedExports || []
        inputSummary.default = true
      }
      const codeForExports = generateCodeForExports({
        uniqueNamedExports,
        inputSummary,
        inputFileUrl,
      })
      return codeForExports
    },
  }
}

/**
 * Attempt #1: Static analysis: Lower Fidelity, but faster.
 * Do our best job to statically scan a file for named exports. This uses "cjs-module-lexer", the
 * same CJS export scanner that Node.js uses internally. Very fast, but only works on some modules,
 * depending on how they were build/written/compiled.
 */
const detectStaticExports = ({ logger, fileUrl, visited = new Set() }) => {
  const isMainEntrypoint = visited.size === 0
  // Prevent infinite loops via circular dependencies.
  if (visited.has(fileUrl)) {
    return []
  }
  visited.add(fileUrl)

  const fileContents = readFileSync(new URL(fileUrl), "utf8")
  try {
    const { exports, reexports } = parse(fileContents)
    // If re-exports were detected (`exports.foo = require(...)`) then resolve them here.
    let resolvedReexports = []
    if (reexports.length > 0) {
      reexports.forEach((reexport) => {
        const reExportedFilePath = resolve.sync(reexport, {
          basedir: fileURLToPath(new URL("./", fileUrl)),
        })
        const reExportedFileUrl = fileSystemPathToUrl(reExportedFilePath)
        const staticExports = detectStaticExports({
          logger,
          fileUrl: reExportedFileUrl,
          visited,
        })
        if (staticExports) {
          resolvedReexports = [...resolvedReexports, ...staticExports]
        }
      })
    }
    const resolvedExports = Array.from(
      new Set([...exports, ...resolvedReexports]),
    ).filter(isValidNamedExport)

    if (isMainEntrypoint && resolvedExports.length === 0) {
      return undefined
    }

    return resolvedExports
  } catch (err) {
    // Safe to ignore, this is usually due to the file not being CJS.
    logger.debug(`detectStaticExports ${fileUrl}: ${err.message}`)
    return undefined
  }
}

/**
 * Attempt #2b - Sandboxed runtime analysis: More powerful, but slower.
 * This will only work on UMD and very simple CJS files (require not supported).
 * Uses VM2 to run safely sandbox untrusted code (no access no Node.js primitives, just JS).
 * If nothing was detected, return undefined.
 */
const detectExportsUsingSandboxedRuntime = ({ logger, fileUrl }) => {
  try {
    const fileContents = readFileSync(new URL(fileUrl), "utf8")
    const vm = new VM2({ wasm: false, fixAsync: false })
    const vmResult = vm.run(wrapCodeToRunInVm(fileContents))
    const exportsResult = Object.keys(vmResult)
    logger.debug(
      `detectExportsUsingSandboxedRuntime success ${fileUrl}: ${exportsResult}`,
    )
    return exportsResult.filter((identifier) => isValidIdentifier(identifier))
  } catch (err) {
    logger.debug(
      `detectExportsUsingSandboxedRuntime error ${fileUrl}: ${err.message}`,
    )
    return undefined
  }
}

const isValidNamedExport = (name) =>
  name !== "default" && name !== "__esModule" && isValidIdentifier(name)

const wrapCodeToRunInVm = (code) => {
  return `const exports = {};
const module = { exports };
${code};;
module.exports;`
}

const generateCodeForExports = ({
  uniqueNamedExports,
  inputSummary,
  inputFileUrl,
}) => {
  const from = urlToFileSystemPath(inputFileUrl)
  const lines = [
    ...(inputSummary.namespace ? [stringifyNamespaceReExport({ from })] : []),
    ...(inputSummary.default ? [stringifyDefaultReExport({ from })] : []),
    stringifyNamedReExports({
      namedExports: uniqueNamedExports,
      from,
    }),
  ]
  return lines.join(`
`)
}

const stringifyNamespaceReExport = ({ from }) => {
  return `export * from "${from}";`
}

const stringifyDefaultReExport = ({ from }) => {
  return `import __jsenv_default_import__ from "${from}";
export default __jsenv_default_import__;`
}

const stringifyNamedReExports = ({ namedExports, from }) => {
  return `export { ${namedExports.join(",")} } from "${from}";`
}
