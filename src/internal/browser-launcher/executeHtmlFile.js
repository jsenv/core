import { resolveUrl, assertFilePresence, urlToRelativeUrl, urlToExtension } from "@jsenv/util"

import { jsenvCompileProxyHtmlFileInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { composeIstanbulCoverages } from "@jsenv/core/src/internal/executing/coverage/composeIstanbulCoverages.js"

import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  {
    cancellationToken,
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    page,
    // measurePerformance,
    collectPerformance,
    collectCoverage,
  },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  if (urlToExtension(fileUrl) !== ".html") {
    throw new Error(`the file to execute must use .html extension, received ${fileRelativeUrl}.`)
  }

  await assertFilePresence(fileUrl)

  const compileProxyProjectRelativeUrl = urlToRelativeUrl(
    jsenvCompileProxyHtmlFileInfo.url,
    projectDirectoryUrl,
  )
  const compileProxyClientUrl = resolveUrl(compileProxyProjectRelativeUrl, compileServerOrigin)
  await page.goto(compileProxyClientUrl)

  const browserRuntimeFeaturesReport = await page.evaluate(
    /* istanbul ignore next */
    () => {
      // eslint-disable-next-line no-undef
      return window.scanBrowserRuntimeFeatures()
    },
  )
  // ici si on peut avoid compilation alors on pourrait visiter la page de base
  // mais il faudrait alors un moyen d'obtenir:
  // coverage et namespace des scripts qui s'éxécute
  const { compileId } = browserRuntimeFeaturesReport
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`
  const compileDirectoryRemoteUrl = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin)
  const fileClientUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  await page.goto(fileClientUrl, { timeout: 0 })

  let executionResult
  try {
    executionResult = await page.evaluate(
      /* istanbul ignore next */
      () => {
        // eslint-disable-next-line no-undef
        return window.__jsenv__.executionResultPromise
      },
    )
  } catch (e) {
    // if browser is closed due to cancellation
    // before it is able to finish evaluate we can safely ignore
    // and rethrow with current cancelError
    if (
      e.message.match(/^Protocol error \(.*?\): Target closed/) &&
      cancellationToken.cancellationRequested
    ) {
      cancellationToken.throwIfRequested()
    }

    throw e
  }

  const { fileExecutionResultMap } = executionResult

  const fileErrored = Object.keys(fileExecutionResultMap).find((fileRelativeUrl) => {
    const fileExecutionResult = fileExecutionResultMap[fileRelativeUrl]
    return fileExecutionResult.status === "errored"
  })

  if (!collectCoverage) {
    Object.keys(fileExecutionResultMap).forEach((fileRelativeUrl) => {
      delete fileExecutionResultMap[fileRelativeUrl].coverage
    })
  }

  if (fileErrored) {
    const { exceptionSource } = fileExecutionResultMap[fileErrored]
    return {
      status: "errored",
      error: evalException(exceptionSource, { projectDirectoryUrl, compileServerOrigin }),
      namespace: fileExecutionResultMap,
      ...(collectCoverage ? { coverage: generateCoverageForPage(fileExecutionResultMap) } : {}),
      ...(collectPerformance ? { performance: executionResult.performance } : {}),
    }
  }

  return {
    status: "completed",
    namespace: fileExecutionResultMap,
    ...(collectCoverage ? { coverage: generateCoverageForPage(fileExecutionResultMap) } : {}),
    ...(collectPerformance ? { performance: executionResult.performance } : {}),
  }
}

const generateCoverageForPage = (fileExecutionResultMap) => {
  const istanbulCoverages = []
  Object.keys(fileExecutionResultMap).forEach((fileRelativeUrl) => {
    const istanbulCoverage = fileExecutionResultMap[fileRelativeUrl].coverage
    if (istanbulCoverage) {
      istanbulCoverages.push(istanbulCoverage)
    }
  })
  const istanbulCoverage = composeIstanbulCoverages(istanbulCoverages)
  return istanbulCoverage
}

const evalException = (exceptionSource, { projectDirectoryUrl, compileServerOrigin }) => {
  const error = evalSource(exceptionSource)

  if (error && error instanceof Error) {
    const remoteRootRegexp = new RegExp(
      escapeRegexpSpecialCharacters(`${compileServerOrigin}/`),
      "g",
    )
    error.stack = error.stack.replace(remoteRootRegexp, projectDirectoryUrl)
    error.message = error.message.replace(remoteRootRegexp, projectDirectoryUrl)
  }

  return error
}
