import { urlToFileSystemPath, resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { supportsDynamicImport } from "../../supportsDynamicImport.js"
import { COMPILE_ID_COMMONJS_BUNDLE } from "../CONSTANTS.js"
import { installNodeErrorStackRemapping } from "../error-stack-remapping/installNodeErrorStackRemapping.js"
import { fetchUrl } from "../fetchUrl.js"

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

  const dynamicImportSupported = await supportsDynamicImport()
  const nodePlatform = dynamicImportSupported
    ? await getNodePlatformUsingDynamicImport({})
    : await getNodePlatformUsingRequire({
        jsenvCoreDirectoryUrl,
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
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

const getNodePlatformUsingDynamicImport = async () => {
  const { nodePlatform } = await import("../../nodePlatform.js")
  return nodePlatform
}

const getNodePlatformUsingRequire = async ({
  jsenvCoreDirectoryUrl,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  const { require } = await import("../require.js")

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

  // The compiled nodePlatform file will be somewhere else in the filesystem
  // than the original nodePlatform file.
  // It is important for the compiled file to be able to require
  // node modules that original file could access
  // This is the purpose of the function below.
  const requireCompiledFileAsOriginalFile = ({ originalFilePath, compiledFilePath }) => {
    const { readFileSync } = require("fs")
    const Module = require("module")
    const { dirname } = require("path")

    const fileContent = String(readFileSync(compiledFilePath))
    const moduleObject = new Module(compiledFilePath)
    moduleObject.paths = Module._nodeModulePaths(dirname(originalFilePath))
    moduleObject._compile(fileContent, compiledFilePath)

    return moduleObject.exports
  }

  const { nodePlatform } = requireCompiledFileAsOriginalFile({
    compiledFilePath: nodePlatformCompiledFilePath,
    originalFilePath: nodePlatformOriginalFilePath,
  })

  return nodePlatform
}
