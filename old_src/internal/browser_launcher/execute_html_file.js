import {
  resolveUrl,
  assertFilePresence,
  urlToRelativeUrl,
  urlToExtension,
} from "@jsenv/filesystem"

import { compileProxyFiles } from "@jsenv/core/src/internal/jsenv_file_selector.js"
import { filterV8Coverage } from "@jsenv/core/src/internal/coverage/v8_coverage_from_directory.js"
import { composeTwoFileByFileIstanbulCoverages } from "@jsenv/core/src/internal/coverage/istanbul_coverage_composition.js"
import { evalSource } from "@jsenv/core/src/internal/node_launcher/eval_source.js"
import { escapeRegexpSpecialCharacters } from "@jsenv/core/src/internal/regexp_escape.js"

import { getBrowserRuntimeProfile } from "./browser_runtime_profile.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  {
    runtime,
    executeOperation,
    projectDirectoryUrl,
    jsenvFileSelector,
    compileServerOrigin,
    compileServerId,
    jsenvDirectoryRelativeUrl,
    page,

    // measurePerformance,
    collectPerformance,
    collectCoverage,
    coverageIgnorePredicate,
    coverageForceIstanbul,
    coveragePlaywrightAPIAvailable,
    transformErrorHook,
    forceSource,
    forceCompilation,
  },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  if (urlToExtension(fileUrl) !== ".html") {
    throw new Error(
      `the file to execute must use .html extension, received ${fileRelativeUrl}.`,
    )
  }
  await assertFilePresence(fileUrl)
  const compileProxyFile = jsenvFileSelector.select(compileProxyFiles, {
    canUseScriptTypeModule: false,
  })
  const compileProxyServerUrl = resolveUrl(
    compileProxyFile.urlRelativeToProject,
    compileServerOrigin,
  )
  executeOperation.throwIfAborted()
  await page.goto(compileProxyServerUrl)
  executeOperation.throwIfAborted()

  const coverageHandledFromOutside =
    coveragePlaywrightAPIAvailable && !coverageForceIstanbul
  const browserRuntimeProfile = await getBrowserRuntimeProfile({
    page,
    compileServerId,
    runtime,
    // js coverage
    // When instrumentation CAN be handed by playwright
    // https://playwright.dev/docs/api/class-chromiumcoverage#chromiumcoveragestartjscoverageoptions
    // coverageHandledFromOutside is true and "transform-instrument" becomes non mandatory
    coverageHandledFromOutside,
    forceSource,
    forceCompilation,
  })

  try {
    let executionResult
    const { compileId } = browserRuntimeProfile
    executeOperation.throwIfAborted()
    if (compileId) {
      executionResult = await executeCompiledVersion({
        projectDirectoryUrl,
        compileServerOrigin,
        fileRelativeUrl,
        page,
        jsenvDirectoryRelativeUrl,
        compileId,
        collectCoverage,
        transformErrorHook,
      })
    } else {
      executionResult = await executeSource({
        projectDirectoryUrl,
        compileServerOrigin,
        fileRelativeUrl,
        page,
        collectCoverage,
        coverageIgnorePredicate,
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
      const scriptExecutionResults = result.namespace
      Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
        delete scriptExecutionResults[fileRelativeUrl].coverage
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

  const { scriptExecutionResults } = executionResult
  const scriptErrored = Object.keys(scriptExecutionResults).find(
    (fileRelativeUrl) => {
      const scriptExecutionResult = scriptExecutionResults[fileRelativeUrl]
      return scriptExecutionResult.status === "errored"
    },
  )
  if (scriptErrored) {
    const { exceptionSource } = scriptExecutionResults[scriptErrored]
    const error = evalException(exceptionSource, {
      projectDirectoryUrl,
      compileServerOrigin,
      transformErrorHook,
    })
    return transformResult({
      status: "errored",
      error,
      namespace: scriptExecutionResults,
    })
  }

  return transformResult({
    status: "completed",
    namespace: scriptExecutionResults,
  })
}

const executeCompiledVersion = async ({
  projectDirectoryUrl,
  compileServerOrigin,
  fileRelativeUrl,
  page,
  jsenvDirectoryRelativeUrl,
  compileId,
  collectCoverage,
  transformErrorHook,
}) => {
  let transformResult = (result) => result
  if (collectCoverage) {
    transformResult = composeTransformer(transformResult, async (result) => {
      result.coverage = generateCoverageForPage(result.namespace)
      return result
    })
  } else {
    transformResult = composeTransformer(transformResult, (result) => {
      const scriptExecutionResults = result.namespace
      Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
        delete scriptExecutionResults[fileRelativeUrl].coverage
      })
      return result
    })
  }

  const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`
  const compileDirectoryRemoteUrl = resolveUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )
  const fileClientUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  await page.goto(fileClientUrl, { timeout: 0 })

  const executionResult = await page.evaluate(
    /* eslint-disable no-undef */
    /* istanbul ignore next */
    () => {
      return window.__html_supervisor__.getScriptExecutionResults()
    },
    /* eslint-enable no-undef */
  )

  const { scriptExecutionResults } = executionResult
  const scriptErrored = Object.keys(scriptExecutionResults).find(
    (fileRelativeUrl) => {
      const scriptExecutionResult = scriptExecutionResults[fileRelativeUrl]
      return scriptExecutionResult.status === "errored"
    },
  )
  if (scriptErrored) {
    const { exceptionSource } = scriptExecutionResults[scriptErrored]
    const error = evalException(exceptionSource, {
      projectDirectoryUrl,
      compileServerOrigin,
      transformErrorHook,
    })
    return transformResult({
      status: "errored",
      error,
      namespace: scriptExecutionResults,
    })
  }
  return transformResult({
    status: "completed",
    namespace: scriptExecutionResults,
  })
}

const generateCoverageForPage = (scriptExecutionResults) => {
  let istanbulCoverageComposed = null
  Object.keys(scriptExecutionResults).forEach((fileRelativeUrl) => {
    const istanbulCoverage = scriptExecutionResults[fileRelativeUrl].coverage
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
