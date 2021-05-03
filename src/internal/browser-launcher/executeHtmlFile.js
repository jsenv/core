import { extname } from "path"
import { resolveUrl, assertFilePresence } from "@jsenv/util"
import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"
import { composeIstanbulCoverages } from "../executing/coverage/composeIstanbulCoverages.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  {
    cancellationToken,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    page,
    collectCoverage,
  },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  if (extname(fileUrl) !== ".html") {
    throw new Error(`the file to execute must use .html extension, received ${fileRelativeUrl}.`)
  }

  await assertFilePresence(fileUrl)

  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}otherwise/`
  const compileDirectoryRemoteUrl = resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin)
  const fileClientUrl = resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl)
  await page.goto(fileClientUrl, { timeout: 0 })

  await page.waitForFunction(
    /* istanbul ignore next */
    () => {
      // eslint-disable-next-line no-undef
      return Boolean(window.__jsenv__)
    },
    [],
    { timeout: 0 },
  )

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
      delete fileExecutionResultMap[fileRelativeUrl].coverageMap
    })
  }

  if (fileErrored) {
    const { exceptionSource } = fileExecutionResultMap[fileErrored]
    return {
      status: "errored",
      error: evalException(exceptionSource, { projectDirectoryUrl, compileServerOrigin }),
      namespace: fileExecutionResultMap,
      readCoverage: () => generateCoverageForPage(fileExecutionResultMap),
    }
  }

  return {
    status: "completed",
    namespace: fileExecutionResultMap,
    readCoverage: () => generateCoverageForPage(fileExecutionResultMap),
  }
}

const generateCoverageForPage = (fileExecutionResultMap) => {
  const coverageMap = composeIstanbulCoverages(
    ...Object.keys(fileExecutionResultMap).map((fileRelativeUrl) => {
      return fileExecutionResultMap[fileRelativeUrl].coverageMap || {}
    }),
  )
  return coverageMap
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
