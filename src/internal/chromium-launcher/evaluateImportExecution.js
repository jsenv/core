import { evalSource } from "internal/platform/createNodePlatform/evalSource.js"
import { escapeRegexpSpecialCharacters } from "internal/escapeRegexpSpecialCharacters.js"
import { resolveUrl } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"

export const evaluateImportExecution = async ({
  cancellationToken,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  chromiumServerOrigin,

  page,

  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
  executionExposureOnWindow,
}) => {
  await assertFileExists(resolveUrl(fileRelativeUrl, projectDirectoryUrl))

  await page.goto(chromiumServerOrigin)
  // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
  // yes evaluate supports passing a function directly
  // but when I do that, istanbul will put coverage statement inside it
  // and I don't want that because function is evaluated client side
  const javaScriptExpressionSource = createBrowserIIFEString({
    outDirectoryRelativeUrl,
    fileRelativeUrl,
    compileServerOrigin,
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
    const remoteRootRegexp = new RegExp(escapeRegexpSpecialCharacters(compileServerOrigin), "g")
    error.stack = error.stack.replace(remoteRootRegexp, projectDirectoryUrl)
    error.message = error.message.replace(remoteRootRegexp, projectDirectoryUrl)
  }

  return error
}

const createBrowserIIFEString = ({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  compileServerOrigin,
  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
  executionExposureOnWindow,
}) => `(() => {
  return window.execute(${JSON.stringify(
    {
      outDirectoryRelativeUrl,
      fileRelativeUrl,
      compileServerOrigin,
      collectNamespace,
      collectCoverage,
      executionId,
      errorStackRemapping,
      executionExposureOnWindow,
    },
    null,
    "    ",
  )})
})()`
