import { resolveFileUrl, fileUrlToPath, pathToFileUrl, fileUrlToRelativePath } from "../urlUtils.js"
import { fetchUsingHttp } from "./fetchUsingHttp.js"
import { createRequireFromFilePath } from "./createRequireFromFilePath.js"

export const execute = async ({
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryUrl,
  moduleFileRelativePath,
  collectNamespace,
  collectCoverage,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in platform logs during testing
  errorExposureInConsole = false,
}) => {
  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
  })

  const moduleFileServerUrl = `${compileServerOrigin}/${moduleFileRelativePath}`
  const moduelFileUrl = resolveFileUrl(moduleFileRelativePath, projectDirectoryUrl)
  const moduleFilePath = fileUrlToPath(moduelFileUrl)

  // ça ne fixera pas le fait que require se fera ou mauvais endroit
  // process.chdir(executionFilePath)
  const executionRequire = createRequireFromFilePath(moduleFilePath)

  const { SourceMapConsumer } = executionRequire("source-map")
  const { installNodeErrorStackRemapping } = executionRequire("@jsenv/error-stack-sourcemap")

  const nodePlatformServerUrl = `${compileServerOrigin}/.jsenv/node-platform.js`
  const nodePlatformFileUrl = resolveFileUrl(`.jsenv/node-platform.js`, compileDirectoryUrl)
  const nodePlatformFilePath = fileUrlToPath(nodePlatformFileUrl)

  await fetchUsingHttp(nodePlatformServerUrl)
  // eslint-disable-next-line import/no-dynamic-require
  const { nodePlatform } = require(nodePlatformFilePath)
  const { relativePathToCompiledUrl, executeFile } = nodePlatform.create({
    compileServerOrigin,
    projectDirectoryUrl,
  })

  const moduleFileCompiledServerUrl = relativePathToCompiledUrl(moduleFileRelativePath)
  const moduleFileCompiledFileUrl = resolveFileUrl(
    moduleFileCompiledServerUrl.slice(`${compileServerOrigin}/`.length),
    projectDirectoryUrl,
  )

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    resolveHref: ({ type, specifier, importer }) => {
      if (type === "source" || type === "file-original" || type === "source-map") {
        const importerUrl = importer
          ? filePathToServerOrFileUrl(importer, { projectDirectoryUrl, compileServerOrigin })
          : moduleFileServerUrl
        const specifierUrl = resolveFileUrl(specifier, importerUrl)
        if (specifierUrl.startsWith(`${compileServerOrigin}/`)) {
          return `file://${specifierUrl.slice(compileServerOrigin.length)}`
        }
        return specifierUrl
      }

      return resolveFileUrl(specifier, importer || moduleFileCompiledFileUrl)
    },
    SourceMapConsumer,
  })

  return executeFile(moduleFileCompiledServerUrl, {
    collectNamespace,
    collectCoverage,
    executionId,
    errorTransform: async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    },
    errorExposureInConsole,
  })
}

const filePathToServerOrFileUrl = (filePath, { projectDirectoryUrl, compileServerOrigin }) => {
  const fileUrl = filePath.startsWith("file://") ? filePath : pathToFileUrl(filePath)
  if (fileUrl.startsWith(projectDirectoryUrl)) {
    const fileRelativePath = fileUrlToRelativePath(fileUrl, projectDirectoryUrl)
    return `${compileServerOrigin}/${fileRelativePath}`
  }
  return fileUrl
}
