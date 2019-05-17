import { fetchUsingHttp } from "../node-platform-service/node-platform/fetchUsingHttp.js"
import { pathnameToOperatingSystemPath } from "../operating-system-path.js"

export const execute = async ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  fileRelativePath,
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
  const { nodePlatform } = require(pathnameToOperatingSystemPath(
    `${projectPathname}${compileIntoRelativePath}/.jsenv/node-platform.js`,
  ))
  const { relativePathToCompiledHref, executeFile } = nodePlatform.create({
    compileServerOrigin,
    projectPathname,
  })

  return executeFile(relativePathToCompiledHref(fileRelativePath), {
    collectNamespace,
    collectCoverage,
  })
}
