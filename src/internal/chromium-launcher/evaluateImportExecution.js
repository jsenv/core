import { resolveUrl, urlToRelativeUrl, assertFilePresence } from "@jsenv/util"
import { jsenvHtmlFileUrl } from "../jsenvHtmlFileUrl.js"
import { evalSource } from "../platform/createNodePlatform/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"
import { getBrowserExecutionDynamicData } from "../platform/getBrowserExecutionDynamicData.js"

export const evaluateImportExecution = async ({
  cancellationToken,

  projectDirectoryUrl,
  htmlFileRelativeUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  executionServerOrigin,

  page,

  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
  executionExposureOnWindow,
}) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  await assertFilePresence(fileUrl)

  if (typeof htmlFileRelativeUrl === "undefined") {
    htmlFileRelativeUrl = urlToRelativeUrl(jsenvHtmlFileUrl, projectDirectoryUrl)
  } else if (typeof htmlFileRelativeUrl !== "string") {
    throw new TypeError(`htmlFileRelativeUrl must be a string, received ${htmlFileRelativeUrl}`)
  }
  const htmlFileUrl = resolveUrl(htmlFileRelativeUrl, projectDirectoryUrl)
  await assertFilePresence(htmlFileUrl)
  const htmlFileClientUrl = `${executionServerOrigin}/${htmlFileRelativeUrl}`
  await page.goto(htmlFileClientUrl)

  // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
  // yes evaluate supports passing a function directly
  // but when I do that, istanbul will put coverage statement inside it
  // and I don't want that because function is evaluated client side
  const javaScriptExpressionSource = createBrowserIIFEString({
    outDirectoryRelativeUrl,
    fileRelativeUrl,
    ...getBrowserExecutionDynamicData({
      projectDirectoryUrl,
      compileServerOrigin,
    }),
    collectNamespace,
    collectCoverage,
    executionId,
    errorStackRemapping,
    executionExposureOnWindow,
  })

  try {
    const executionResult = await page.evaluate(javaScriptExpressionSource)

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

const createBrowserIIFEString = (data) => `(() => {
  return window.execute(${JSON.stringify(data, null, "    ")})
})()`
