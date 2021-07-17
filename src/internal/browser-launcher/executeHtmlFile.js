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
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable,
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

  const coverageInstrumentationRequired = coverageForceIstanbul || !coveragePlaywrightAPIAvailable

  const browserRuntimeFeaturesReport = await page.evaluate(
    /* istanbul ignore next */
    ({ coverageInstrumentationRequired }) => {
      // eslint-disable-next-line no-undef
      return window.scanBrowserRuntimeFeatures({ coverageInstrumentationRequired })
    },
    { coverageInstrumentationRequired },
  )
  // ici si on peut avoid compilation alors on pourrait visiter la page de base
  // mais il faudrait alors un moyen d'obtenir:
  // coverage et namespace des scripts qui s'éxécute

  try {
    let executionResult
    const { canAvoidCompilation, compileId } = browserRuntimeFeaturesReport
    if (canAvoidCompilation) {
      executionResult = await executeSource({
        projectDirectoryUrl,
        compileServerOrigin,
        fileRelativeUrl,
        page,
        collectCoverage,
      })
    } else {
      executionResult = await executeCompiledVersion({
        projectDirectoryUrl,
        compileServerOrigin,
        fileRelativeUrl,
        page,
        outDirectoryRelativeUrl,
        compileId,
        collectCoverage,
      })
    }

    if (collectPerformance) {
      const performance = await page.evaluate(
        /* istanbul ignore next */
        () => {
          // eslint-disable-next-line no-undef
          const { performance } = window
          if (!performance) {
            return null
          }

          const measures = {}
          const measurePerfEntries = performance.getEntriesByType("measure")
          measurePerfEntries.forEach((measurePerfEntry) => {
            measures[measurePerfEntry.name] = measurePerfEntry.duration
          })

          return {
            timeOrigin: performance.timeOrigin,
            timing: performance.timing.toJSON(),
            navigation: performance.navigation.toJSON(),
            measures,
          }
        },
      )
      executionResult.performance = performance
    }

    return executionResult
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
}

const executeSource = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  fileRelativeUrl,
  page,
  collectCoverage,
}) => {
  let transformResult = (result) => result

  if (collectCoverage) {
    await page.coverage.startJSCoverage()
    transformResult = composeTransformer(transformResult, async (result) => {
      const coverage = await page.coverage.stopJSCoverage()
      return {
        ...result,
        coverage,
      }
    })
  }

  const fileClientUrl = resolveUrl(fileRelativeUrl, `${compileServerOrigin}/`)
  await page.goto(fileClientUrl, { timeout: 0 })

  const executionResult = await page.evaluate(
    /* istanbul ignore next */
    () => {
      // eslint-disable-next-line no-undef
      return window.__jsenv__.executionResultPromise
    },
  )

  const { fileExecutionResultMap } = executionResult
  const fileErrored = Object.keys(fileExecutionResultMap).find((fileRelativeUrl) => {
    const fileExecutionResult = fileExecutionResultMap[fileRelativeUrl]
    return fileExecutionResult.status === "errored"
  })

  if (fileErrored) {
    const { exceptionSource } = fileExecutionResultMap[fileErrored]
    return transformResult({
      status: "errored",
      error: evalException(exceptionSource, { projectDirectoryUrl, compileServerOrigin }),
      namespace: fileExecutionResultMap,
    })
  }

  return transformResult({
    status: "completed",
    namespace: fileExecutionResultMap,
  })
}

const executeCompiledVersion = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  fileRelativeUrl,
  page,
  outDirectoryRelativeUrl,
  compileId,
  collectCoverage,
}) => {
  let transformResult = (result) => result
  if (collectCoverage) {
    transformResult = composeTransformer(transformResult, async (result) => {
      result.coverage = generateCoverageForPage(fileExecutionResultMap)
      return result
    })
  } else {
    transformResult = composeTransformer(transformResult, (result) => {
      const { namespace: fileExecutionResultMap } = result
      Object.keys(fileExecutionResultMap).forEach((fileRelativeUrl) => {
        delete fileExecutionResultMap[fileRelativeUrl].coverage
      })
      return result
    })
  }

  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`
  const compileDirectoryRemoteUrl = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin)
  const fileClientUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  await page.goto(fileClientUrl, { timeout: 0 })

  const executionResult = await page.evaluate(
    /* istanbul ignore next */
    () => {
      // eslint-disable-next-line no-undef
      return window.__jsenv__.executionResultPromise
    },
  )

  const { fileExecutionResultMap } = executionResult
  const fileErrored = Object.keys(fileExecutionResultMap).find((fileRelativeUrl) => {
    const fileExecutionResult = fileExecutionResultMap[fileRelativeUrl]
    return fileExecutionResult.status === "errored"
  })

  if (fileErrored) {
    const { exceptionSource } = fileExecutionResultMap[fileErrored]
    return transformResult({
      status: "errored",
      error: evalException(exceptionSource, { projectDirectoryUrl, compileServerOrigin }),
      namespace: fileExecutionResultMap,
    })
  }

  return transformResult({
    status: "completed",
    namespace: fileExecutionResultMap,
  })
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

const composeTransformer = (previousTransformer, transformer) => {
  return (value) => {
    const transformedValue = previousTransformer(value)
    return transformer(transformedValue)
  }
}
