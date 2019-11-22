const { pathToFileURL, fileURLToPath } = require("url")
const { fetchUsingHttp } = require("./fetchUsingHttp.js")

const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
  compileServerOrigin,
  jsenvDirectoryRemoteUrl,
  outDirectoryRemoteUrl,
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

  const nodePlatformCompiledFileServerUrl = resolveUrl(
    ".jsenv/node-platform.js",
    outDirectoryRemoteUrl,
  )
  await fetchUsingHttp(nodePlatformCompiledFileServerUrl)

  const jsenvDirectoryUrl = urlToProjectUrl(jsenvDirectoryRemoteUrl, {
    projectDirectoryUrl,
    compileServerOrigin,
  })
  const nodePlatformCompiledFileUrl = resolveUrl("node-platform.js", jsenvDirectoryUrl)
  const nodePlatformCompiledFilePath = fileURLToPath(nodePlatformCompiledFileUrl)
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
exports.execute = execute

const installErrorStackRemapping = ({
  projectDirectoryUrl,
  compileServerOrigin,
  originalFileRemoteUrl,
  compiledFileRemoteUrl,
}) => {
  const { installNodeErrorStackRemapping } = require("@jsenv/error-stack-sourcemap")
  const { SourceMapConsumer } = require("source-map")

  const compiledFileUrl = urlToProjectUrl(compiledFileRemoteUrl, {
    projectDirectoryUrl,
    compileServerOrigin,
  })

  return installNodeErrorStackRemapping({
    resolveHref: ({ type, specifier, importer }) => {
      if (type === "source" || type === "file-original" || type === "source-map") {
        const importerUrl = importer
          ? specifierToServerUrl(importer, { projectDirectoryUrl, compileServerOrigin }) || importer
          : originalFileRemoteUrl
        const specifierUrl = resolveUrl(specifier, importerUrl)
        return (
          urlToProjectUrl(specifierUrl, { projectDirectoryUrl, compileServerOrigin }) ||
          specifierUrl
        )
      }

      return resolveUrl(specifier, importer || compiledFileUrl)
    },
    SourceMapConsumer,
  })
}

const urlToProjectUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`
  }
  return null
}

const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
  }
  return null
}

const specifierToServerUrl = (specifier, { projectDirectoryUrl, compileServerOrigin }) => {
  if (specifier.startsWith("http://") || specifier.startsWith("https://")) {
    return null
  }
  if (specifier.starsWith("file://")) {
    return urlToServerUrl(specifier, { projectDirectoryUrl, compileServerOrigin })
  }
  return urlToServerUrl(pathToFileURL(specifier), { projectDirectoryUrl, compileServerOrigin })
}

const resolveUrl = (relativeUrl, baseUrl) => {
  return String(new URL(relativeUrl, baseUrl))
}
