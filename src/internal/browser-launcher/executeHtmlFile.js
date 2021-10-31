import {
  resolveUrl,
  assertFilePresence,
  urlToRelativeUrl,
  urlToExtension,
} from "@jsenv/filesystem"

import { Abort } from "@jsenv/core/src/abort/main.js"
import { jsenvCompileProxyHtmlFileInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { v8CoverageFromAllV8Coverages } from "@jsenv/core/src/internal/executing/coverage/v8CoverageFromAllV8Coverages.js"
import { composeIstanbulCoverages } from "@jsenv/core/src/internal/executing/coverage/composeIstanbulCoverages.js"
import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  {
    launchBrowserOperation,
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    page,

    // measurePerformance,
    collectPerformance,
    collectCoverage,
    coverageConfig,
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable,
  },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  if (urlToExtension(fileUrl) !== ".html") {
    throw new Error(
      `the file to execute must use .html extension, received ${fileRelativeUrl}.`,
    )
  }

  await assertFilePresence(fileUrl)

  const compileProxyProjectRelativeUrl = urlToRelativeUrl(
    jsenvCompileProxyHtmlFileInfo.url,
    projectDirectoryUrl,
  )
  const compileProxyClientUrl = resolveUrl(
    compileProxyProjectRelativeUrl,
    compileServerOrigin,
  )
  Abort.throwIfAborted(launchBrowserOperation.abortSignal)
  await page.goto(compileProxyClientUrl)

  const coverageHandledFromOutside =
    coveragePlaywrightAPIAvailable && !coverageForceIstanbul

  Abort.throwIfAborted(launchBrowserOperation.abortSignal)
  const browserRuntimeFeaturesReport = await page.evaluate(
    /* istanbul ignore next */
    ({ coverageHandledFromOutside }) => {
      // eslint-disable-next-line no-undef
      return window.scanBrowserRuntimeFeatures({
        coverageHandledFromOutside,
        failFastOnFeatureDetection: true,
      })
    },
    { coverageHandledFromOutside },
  )

  try {
    let executionResult
    const { canAvoidCompilation, compileId } = browserRuntimeFeaturesReport
    Abort.throwIfAborted(launchBrowserOperation.abortSignal)
    if (canAvoidCompilation) {
      executionResult = await executeSource({
        projectDirectoryUrl,
        compileServerOrigin,
        fileRelativeUrl,
        page,
        collectCoverage,
        coverageConfig,
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
  } catch (error) {
    // if browser is closed due to abort
    // before it is able to finish evaluate we can safely ignore
    // and rethrow with current abort error
    if (
      launchBrowserOperation.abortSignal.aborted &&
      isBrowserClosedError(error)
    ) {
      Abort.throwIfAborted(launchBrowserOperation.abortSignal)
    }
    throw error
  }
}

const isBrowserClosedError = (error) => {
  if (error.message.match(/browserContext.newPage: Browser closed/)) {
    return true
  }

  if (error.message.match(/^Protocol error \(.*?\): Target closed/)) {
    return true
  }

  return false
}

const executeSource = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  fileRelativeUrl,
  page,
  collectCoverage,
  coverageConfig,
}) => {
  let transformResult = (result) => result

  if (collectCoverage) {
    await page.coverage.startJSCoverage({
      // reportAnonymousScripts: true,
    })
    transformResult = composeTransformer(transformResult, async (result) => {
      const v8CoveragesWithWebUrls = await page.coverage.stopJSCoverage()
      // we convert urls starting with http:// to file:// because we later
      // convert the url to filesystem path in istanbulCoverageFromV8Coverage function
      const v8CoveragesWithFsUrls = v8CoveragesWithWebUrls.map(
        (v8CoveragesWithWebUrl) => {
          const relativeUrl = urlToRelativeUrl(
            v8CoveragesWithWebUrl.url,
            compileServerOrigin,
          )
          const fsUrl = resolveUrl(relativeUrl, projectDirectoryUrl)
          return {
            ...v8CoveragesWithWebUrl,
            url: fsUrl,
          }
        },
      )
      const allV8Coverages = [{ result: v8CoveragesWithFsUrls }]
      const coverage = v8CoverageFromAllV8Coverages(allV8Coverages, {
        coverageRootUrl: projectDirectoryUrl,
        coverageConfig,
      })
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
  const fileErrored = Object.keys(fileExecutionResultMap).find(
    (fileRelativeUrl) => {
      const fileExecutionResult = fileExecutionResultMap[fileRelativeUrl]
      return fileExecutionResult.status === "errored"
    },
  )

  if (fileErrored) {
    const { exceptionSource } = fileExecutionResultMap[fileErrored]
    const error = evalException(exceptionSource, {
      projectDirectoryUrl,
      compileServerOrigin,
    })
    return transformResult({
      status: "errored",
      error,
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
  const compileDirectoryRemoteUrl = resolveUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )
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
  const fileErrored = Object.keys(fileExecutionResultMap).find(
    (fileRelativeUrl) => {
      const fileExecutionResult = fileExecutionResultMap[fileRelativeUrl]
      return fileExecutionResult.status === "errored"
    },
  )

  if (fileErrored) {
    const { exceptionSource } = fileExecutionResultMap[fileErrored]
    const error = evalException(exceptionSource, {
      projectDirectoryUrl,
      compileServerOrigin,
    })
    return transformResult({
      status: "errored",
      error,
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

const evalException = (
  exceptionSource,
  { projectDirectoryUrl, compileServerOrigin },
) => {
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
