import {
  WELL_KNOWN_SYSTEM_PATHNAME,
  WELL_KNOWN_NODE_PLATFORM_PATHNAME,
  projectFolder,
  compileServerOrigin,
  compileInto,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  remap,
  // eslint-disable-next-line import/no-unresolved
} from "NODE_SELF_EXECUTE_STATIC_DATA.js"

// I have to use fetchUsingHTTP here + eval

process.once("unhandledRejection", (valueRejected) => {
  throw valueRejected
})

// force-new-line
;(async () => {
  await import("") // systemjs

  if (remap) {
    const { installSourceMapSupport } = await import("./")
    installSourceMapSupport({ projectFolder })
  }

  return global.System.import(`${compileServerOrigin}${WELL_KNOWN_NODE_PLATFORM_PATHNAME}`).then(
    ({ executeCompiledFile }) => {
      return executeCompiledFile({
        sourceOrigin: `file://${projectFolder}`,
        compileServerOrigin,
        compileInto,
        filenameRelative,
        collectNamespace,
        collectCoverage,
      })
    },
  )
})()
