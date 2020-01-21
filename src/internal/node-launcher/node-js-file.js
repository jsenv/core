import { COMPILE_ID_COMMONJS_BUNDLE } from "internal/CONSTANTS.js"
import { urlToFileSystemPath, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { installNodeErrorStackRemapping } from "internal/error-stack-remapping/installNodeErrorStackRemapping.js"
import { fetchUrl } from "internal/fetchUrl.js"

export const execute = async ({
  // this whole file will be compiled in every project
  // where jsenvCoreDirectoryUrl must be computed before hand
  // otherwise when this file will be required
  // jsenvCoreDirectoryUrl will be wrong
  jsenvCoreDirectoryUrl,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,

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

  const nodePlatformFileRelativeUrl =
    projectDirectoryUrl === jsenvCoreDirectoryUrl
      ? `src/nodePlatform.js`
      : `${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}src/nodePlatform.js`

  const nodePlatformCompiledFileRelativeUrl = `${outDirectoryRelativeUrl}${COMPILE_ID_COMMONJS_BUNDLE}/${nodePlatformFileRelativeUrl}`
  const nodePlatformCompiledFileServerUrl = resolveUrl(
    nodePlatformCompiledFileRelativeUrl,
    compileServerOrigin,
  )
  await fetchUrl(nodePlatformCompiledFileServerUrl)

  const nodePlatformCompiledFileUrl = resolveUrl(
    nodePlatformCompiledFileRelativeUrl,
    projectDirectoryUrl,
  )
  const nodePlatformCompiledFilePath = urlToFileSystemPath(nodePlatformCompiledFileUrl)
  const nodePlatformOriginalFilePath = urlToFileSystemPath(
    resolveUrl(nodePlatformFileRelativeUrl, projectDirectoryUrl),
  )

  const { nodePlatform } = requireCompiledFileAsOriginalFile({
    compiledFilePath: nodePlatformCompiledFilePath,
    originalFilePath: nodePlatformOriginalFilePath,
  })

  const { compileDirectoryRemoteUrl, executeFile } = nodePlatform.create({
    projectDirectoryUrl,
    compileServerOrigin,
  })

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    projectDirectoryUrl,
  })

  const compiledFileRemoteUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  return executeFile(compiledFileRemoteUrl, {
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

const requireCompiledFileAsOriginalFile = ({ originalFilePath, compiledFilePath }) => {
  const { readFileSync } = import.meta.require("fs")
  const Module = import.meta.require("module")
  const { dirname } = import.meta.require("path")

  const fileContent = String(readFileSync(compiledFilePath))
  const moduleObject = new Module(compiledFilePath)
  moduleObject.paths = Module._nodeModulePaths(dirname(originalFilePath))
  moduleObject._compile(fileContent, compiledFilePath)

  return moduleObject.exports
}
