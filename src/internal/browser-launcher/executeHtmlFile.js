import { resolveUrl, assertFilePresence } from "@jsenv/util"
import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"
import { composeCoverageMap } from "../executing/coverage/composeCoverageMap.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  { cancellationToken, projectDirectoryUrl, compileServerOrigin, page },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  await assertFilePresence(fileUrl) // maybe we should also ensure it's an html file

  const fileClientUrl = resolveUrl(fileRelativeUrl, compileServerOrigin)
  await page.goto(fileClientUrl)

  let executionResult
  try {
    executionResult = await page.evaluate(
      /* istanbul ignore next */
      () => {
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

  const coverageMap = composeCoverageMap(
    ...Object.keys(executionResult).map((fileRelativeUrl) => {
      return executionResult[fileRelativeUrl].coverageMap
    }),
  )

  const fileErrored = Object.keys(executionResult).find((fileRelativeUrl) => {
    const fileExecutionResult = executionResult[fileRelativeUrl]
    return fileExecutionResult.status === "errored"
  })

  if (fileErrored) {
    const { exceptionSource } = executionResult[fileErrored]
    return {
      status: "errored",
      error: evalException(exceptionSource, { projectDirectoryUrl, compileServerOrigin }),
      namespace: executionResult,
      coverageMap,
    }
  }

  return {
    status: "completed",
    namespace: executionResult,
    coverageMap,
  }
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
