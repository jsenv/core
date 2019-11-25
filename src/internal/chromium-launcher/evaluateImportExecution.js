import {
  operatingSystemPathToPathname,
  pathnameToOperatingSystemPath,
} from "@jsenv/operating-system-path"
import { assertFile } from "./filesystem-assertions.js"
import { evalSource } from "./evalSource.js"
import { escapeRegexpSpecialCharacters } from "./escape-regexp-special-characters.js"

export const evaluateImportExecution = async ({
  cancellationToken,
  projectPath,
  page,
  compileServerOrigin,
  puppeteerServerOrigin,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
}) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)

  await assertFile(pathnameToOperatingSystemPath(`${projectPathname}${fileRelativePath}`))

  await page.goto(puppeteerServerOrigin)
  // https://github.com/GoogleChrome/puppeteer/blob/v1.14.0/docs/api.md#pageevaluatepagefunction-args
  // yes evaluate supports passing a function directly
  // but when I do that, istanbul will put coverage statement inside it
  // and I don't want that because function is evaluated client side
  const javaScriptExpressionSource = createBrowserIIFEString({
    compileServerOrigin,
    fileRelativePath,
    collectNamespace,
    collectCoverage,
    executionId,
    errorStackRemapping,
  })

  try {
    const executionResult = await page.evaluate(javaScriptExpressionSource)

    const { status } = executionResult
    if (status === "errored") {
      const { exceptionSource, coverageMap } = executionResult
      return {
        status,
        error: evalException(exceptionSource, { compileServerOrigin, projectPath }),
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

const evalException = (exceptionSource, { compileServerOrigin, projectPath }) => {
  const projectPathname = operatingSystemPathToPathname(projectPath)

  const error = evalSource(exceptionSource)

  if (error && error instanceof Error) {
    const sourceOrigin = `file://${projectPathname}`
    const remoteRootRegexp = new RegExp(escapeRegexpSpecialCharacters(compileServerOrigin), "g")
    error.stack = error.stack.replace(remoteRootRegexp, sourceOrigin)
    error.message = error.message.replace(remoteRootRegexp, sourceOrigin)
  }

  return error
}

const createBrowserIIFEString = ({
  compileServerOrigin,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
  executionId,
  errorStackRemapping,
}) => `(() => {
  return window.execute({
    compileServerOrigin: ${JSON.stringify(compileServerOrigin)},
    fileRelativePath: ${JSON.stringify(fileRelativePath)},
    collectNamespace: ${JSON.stringify(collectNamespace)},
    collectCoverage: ${JSON.stringify(collectCoverage)},
    executionId: ${JSON.stringify(executionId)},
    errorStackRemapping:  ${JSON.stringify(errorStackRemapping)},
  })
})()`
