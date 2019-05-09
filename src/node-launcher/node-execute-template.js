import { fetchUsingHttp } from "../node-platform-service/node-platform/fetchUsingHttp.js"

export const execute = async ({
  projectFolder,
  compileServerOrigin,
  compileInto,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  remap,
}) => {
  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
  })

  if (remap) {
    const { installSourceMapSupport } = await import("./installSourceMapSupport.js")
    installSourceMapSupport({ projectFolder })
  }

  await fetchUsingHttp(`${compileServerOrigin}/.jsenv/node-platform.js`)
  // eslint-disable-next-line import/no-dynamic-require
  const { executeCompiledFile } = require(`${projectFolder}/${compileInto}/.jsenv/node-platform.js`)

  return executeCompiledFile({
    sourceOrigin: `file://${projectFolder}`,
    compileServerOrigin,
    compileInto,
    filenameRelative,
    collectNamespace,
    collectCoverage,
  })
}
