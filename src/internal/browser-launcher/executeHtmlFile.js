import {
  resolveUrl,
  assertFilePresence,
  urlToRelativeUrl,
  urlToExtension,
} from "@jsenv/filesystem"

import { COMPILE_PROXY_BUILD_URL } from "@jsenv/core/dist/build_manifest.js"
import { filterV8Coverage } from "@jsenv/core/src/internal/executing/coverage_utils/v8_coverage_from_directory.js"
import { composeTwoFileByFileIstanbulCoverages } from "@jsenv/core/src/internal/executing/coverage_utils/istanbul_coverage_composition.js"
import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  {
    executeOperation,
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    page,

    // measurePerformance,
    collectPerformance,
    collectCoverage,
    coverageIgnorePredicate,
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable,
    transformErrorHook,
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
    COMPILE_PROXY_BUILD_URL,
    projectDirectoryUrl,
  )
  const compileProxyClientUrl = resolveUrl(
    compileProxyProjectRelativeUrl,
    compileServerOrigin,
  )
  executeOperation.throwIfAborted()
  await page.goto(compileProxyClientUrl)

  const coverageHandledFromOutside =
    coveragePlaywrightAPIAvailable && !coverageForceIstanbul

  executeOperation.throwIfAborted()
  const browserRuntimeFeaturesReport = await page.evaluate(
    /* istanbul ignore next */
    async ({ coverageHandledFromOutside }) => {
      // eslint-disable-next-line no-undef
      await window.readyPromise

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
    executeOperation.throwIfAborted()
    if (canAvoidCompilation) {
      executionResult = await executeSource({
        projectDirectoryUrl,
        compileServerOrigin,
        fileRelativeUrl,
        page,
        collectCoverage,
        coverageIgnorePredicate,
        transformErrorHook,
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
        transformErrorHook,
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
    if (executeOperation.signal.aborted && isBrowserClosedError(error)) {
      executeOperation.throwIfAborted()
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
  coverageIgnorePredicate,
  transformErrorHook,
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
      const coverage = filterV8Coverage(
        { result: v8CoveragesWithFsUrls },
        {
          coverageIgnorePredicate,
        },
      )
      return {
        ...result,
        coverage,
      }
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
      transformErrorHook,
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
  transformErrorHook,
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
      transformErrorHook,
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
  let istanbulCoverageComposed = null
  Object.keys(fileExecutionResultMap).forEach((fileRelativeUrl) => {
    const istanbulCoverage = fileExecutionResultMap[fileRelativeUrl].coverage
    istanbulCoverageComposed = istanbulCoverageComposed
      ? composeTwoFileByFileIstanbulCoverages(
          istanbulCoverageComposed,
          istanbulCoverage,
        )
      : istanbulCoverage
  })

  return istanbulCoverageComposed
}

const evalException = (
  exceptionSource,
  { projectDirectoryUrl, compileServerOrigin, transformErrorHook },
) => {
  let error = evalSource(exceptionSource)

  if (error && error instanceof Error) {
    const remoteRootRegexp = new RegExp(
      escapeRegexpSpecialCharacters(`${compileServerOrigin}/`),
      "g",
    )
    error.stack = error.stack.replace(remoteRootRegexp, projectDirectoryUrl)
    error.message = error.message.replace(remoteRootRegexp, projectDirectoryUrl)

    error = transformErrorHook(error)
  }

  return error
}

const composeTransformer = (previousTransformer, transformer) => {
  return (value) => {
    const transformedValue = previousTransformer(value)
    return transformer(transformedValue)
  }
}
