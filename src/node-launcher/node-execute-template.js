import { fetchUsingHttp } from "../node-platform-service/node-platform/fetchUsingHttp.js"
import { pathnameToOperatingSystemFilename } from "../operating-system-filename.js"

export const execute = async ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  filePath,
  collectNamespace,
  collectCoverage,
  remap,
}) => {
  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
  })

  if (remap) {
    const { installSourceMapSupport } = await import("./installSourceMapSupport.js")
    installSourceMapSupport({ projectPathname })
  }

  await fetchUsingHttp(`${compileServerOrigin}/.jsenv/node-platform.js`)
  // eslint-disable-next-line import/no-dynamic-require
  const { nodePlatform } = require(pathnameToOperatingSystemFilename(
    `${projectPathname}${compileIntoRelativePath}/.jsenv/node-platform.js`,
  ))
  const { pathToCompiledHref, executeFile } = nodePlatform.create({
    compileServerOrigin,
    projectPathname,
  })

  const compiledFile = pathToCompiledHref(filePath)
  return executeFile(compiledFile, {
    collectNamespace,
    collectCoverage,
  })
}
