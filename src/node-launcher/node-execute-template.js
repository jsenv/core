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
  const { nodePlatform } = require(`${projectFolder}/${compileInto}/.jsenv/node-platform.js`)
  const { filenameRelativeToCompiledHref, executeFile } = nodePlatform.create({
    projectFolder,
    compileServerOrigin,
  })
  const compiledFile = filenameRelativeToCompiledHref(filenameRelative)

  return executeFile(compiledFile, {
    collectNamespace,
    collectCoverage,
  })
}
