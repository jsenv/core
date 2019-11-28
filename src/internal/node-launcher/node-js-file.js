import { COMPILE_ID_COMMONJS_BUNDLE } from "internal/CONSTANTS.js"
import { fileUrlToPath, pathToFileUrl, resolveUrl } from "internal/urlUtils.js"
import { installNodeErrorStackRemapping } from "internal/error-stack-remapping/installNodeErrorStackRemapping.js"
import { fetchUsingHttp } from "internal/platform/createNodePlatform/fetchUsingHttp.js"

export const execute = async ({
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

  const outDirectoryRemoteUrl = resolveUrl(outDirectoryRelativeUrl, compileServerOrigin)
  const nodePlatformCompiledFileServerUrl = resolveUrl(
    `${COMPILE_ID_COMMONJS_BUNDLE}/src/nodePlatform.js`,
    outDirectoryRemoteUrl,
  )
  await fetchUsingHttp(nodePlatformCompiledFileServerUrl)

  const outDirectoryUrl = resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl)
  const nodePlatformCompiledFileUrl = resolveUrl(
    `${COMPILE_ID_COMMONJS_BUNDLE}/src/nodePlatform.js`,
    outDirectoryUrl,
  )
  const nodePlatformCompiledFilePath = fileUrlToPath(nodePlatformCompiledFileUrl)
  // eslint-disable-next-line import/no-dynamic-require
  const { nodePlatform } = require(nodePlatformCompiledFilePath)

  const { compileDirectoryRemoteUrl, executeFile } = nodePlatform.create({
    projectDirectoryUrl,
    compileServerOrigin,
  })

  const originalFileRemoteUrl = resolveUrl(fileRelativeUrl, compileServerOrigin)
  const compiledFileRemoteUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  const { getErrorOriginalStackString } = installErrorStackRemapping({
    projectDirectoryUrl,
    compileServerOrigin,
    originalFileRemoteUrl,
    compiledFileRemoteUrl,
  })

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

const installErrorStackRemapping = ({
  projectDirectoryUrl,
  compileServerOrigin,
  originalFileRemoteUrl,
  compiledFileRemoteUrl,
}) => {
  const compiledFileUrl = urlToProjectUrl(compiledFileRemoteUrl, {
    projectDirectoryUrl,
    compileServerOrigin,
  })

  return installNodeErrorStackRemapping({
    resolveUrl: ({ type, specifier, importer }) => {
      let importerUrl
      if (importer) {
        importerUrl =
          specifierToServerUrl(importer, { projectDirectoryUrl, compileServerOrigin }) || importer
      } else if (type === "source" || type === "source-map") {
        importerUrl = originalFileRemoteUrl
      } else if (type === "file-original") {
        importerUrl = compiledFileRemoteUrl
      } else {
        importerUrl = compiledFileUrl
      }

      const specifierUrl = resolveUrl(specifier, importerUrl)

      if (specifierUrl.startsWith(`${compileServerOrigin}/`)) {
        const relativeUrl = specifierUrl.slice(`${compileServerOrigin}/`.length)
        const projectUrl = `${projectDirectoryUrl}${relativeUrl}`
        return projectUrl
      }
      return specifierUrl
    },
  })
}

const urlToProjectUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`
  }
  return null
}

const specifierToServerUrl = (specifier, { projectDirectoryUrl, compileServerOrigin }) => {
  if (specifier.startsWith("http://") || specifier.startsWith("https://")) {
    return null
  }
  if (specifier.startsWith("file://")) {
    return urlToServerUrl(specifier, { projectDirectoryUrl, compileServerOrigin })
  }
  return urlToServerUrl(pathToFileUrl(specifier), {
    projectDirectoryUrl,
    compileServerOrigin,
  })
}

const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
  }
  return null
}
