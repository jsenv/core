import { resolveUrl, assertFilePresence } from "@jsenv/util"
import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  { cancellationToken, projectDirectoryUrl, compileServerOrigin, page },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  await assertFilePresence(fileUrl) // maybe we should also ensure it's an html file

  const fileClientUrl = resolveUrl(fileRelativeUrl, compileServerOrigin)
  await page.goto(fileClientUrl)

  try {
    const executionResult = await page.evaluate(
      /* istanbul ignore next */
      () => {
        return window.__jsenv__.executionResultPromise
      },
    )

    // executionResult c'est un objet contenant l'éxecution de chaque fichier
    // il faut encore compose les coverage
    // et décider si l'ensemble est fail ou pas en prenant la premier dont le status est errored
    // on retournera {status, error coverageMap} ou { status, namespace: executionResult, coverageMap} en fonction

    const { status } = executionResult
    if (status === "errored") {
      const { exceptionSource, coverageMap } = executionResult
      return {
        status,
        error: evalException(exceptionSource, { projectDirectoryUrl, compileServerOrigin }),
        coverageMap,
      }
    }

    const { namespace, coverageMap } = executionResult
    return {
      status,
      namespace,
      coverageMap,
    }
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
