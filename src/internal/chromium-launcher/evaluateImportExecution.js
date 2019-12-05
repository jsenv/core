import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { assertFileExists } from "internal/filesystemUtils.js"
import { evalSource } from "internal/platform/createNodePlatform/evalSource.js"
import { escapeRegexpSpecialCharacters } from "internal/escapeRegexpSpecialCharacters.js"

export const evaluateImportExecution = async ({
  cancellationToken,

  projectDirectoryUrl,
  htmlFileUrl,
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
  if (!htmlFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(`chromium html file must be inside project directory
--- chromium html file url ---
${htmlFileUrl}
--- project directory url ---
${htmlFileUrl}`)
  }
  await assertFileExists(htmlFileUrl)

  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  await assertFileExists(fileUrl)

  const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, projectDirectoryUrl)
  const htmlFileClientUrl = `${executionServerOrigin}/${htmlFileRelativeUrl}`
  await page.goto(htmlFileClientUrl)

  // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
  // yes evaluate supports passing a function directly
  // but when I do that, istanbul will put coverage statement inside it
  // and I don't want that because function is evaluated client side
  const javaScriptExpressionSource = createBrowserIIFEString({
    browserPlatformFileRelativeUrl:
      projectDirectoryUrl === jsenvCoreDirectoryUrl
        ? "src/browserPlatform.js"
        : `${urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl)}src/browserPlatform.js`,
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
    const remoteRootRegexp = new RegExp(
      escapeRegexpSpecialCharacters(`${compileServerOrigin}/`),
      "g",
    )
    error.stack = error.stack.replace(remoteRootRegexp, projectDirectoryUrl)
    error.message = error.message.replace(remoteRootRegexp, projectDirectoryUrl)
  }

  return error
}

const createBrowserIIFEString = ({
  browserPlatformFileRelativeUrl,
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
      browserPlatformFileRelativeUrl,
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
