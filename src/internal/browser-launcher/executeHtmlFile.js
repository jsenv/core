import { resolveUrl, assertFilePresence, fileSystemPathToUrl, urlToRelativeUrl } from "@jsenv/util"
import { evalSource } from "../runtime/createNodeRuntime/evalSource.js"
import { escapeRegexpSpecialCharacters } from "../escapeRegexpSpecialCharacters.js"
import { require } from "../require.js"

export const executeHtmlFile = async (
  fileRelativeUrl,
  {
    cancellationToken,

    projectDirectoryUrl,
    compileServerOrigin,

    page,

    collectNamespace,
    collectCoverage,
    errorStackRemapping,
    executionExposureOnWindow,
  },
) => {
  const fileUrl = resolveUrl(fileRelativeUrl, projectDirectoryUrl)
  await assertFilePresence(fileUrl) // maybe we should also ensure it's an html file

  const fileClientUrl = resolveUrl(fileRelativeUrl, compileServerOrigin)
  await page.goto(fileClientUrl)

  const sourcemapMainFileUrl = fileSystemPathToUrl(require.resolve("source-map/dist/source-map.js"))
  const sourcemapMappingFileUrl = fileSystemPathToUrl(
    require.resolve("source-map/lib/mappings.wasm"),
  )
  const sourcemapMainFileRelativeUrl = urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl)
  const sourcemapMappingFileRelativeUrl = urlToRelativeUrl(
    sourcemapMappingFileUrl,
    projectDirectoryUrl,
  )

  console.log({
    // ces trucs la sont des sortes d'option qu'on pourrait activer en faisant
    // window.__jsenv__.scriptExecutionOptions.errorStackRemapping = true
    // mais bon je vois pas trop comment faire
    // la encore je mettrais bien ces options pour le serveur
    errorStackRemapping,
    executionExposureOnWindow,
    collectNamespace,
    collectCoverage,

    // ça serais bien de le savoir on pourrait mettre
    // cette info dans le truc qui demande au server le outDirectoryRelativeUrl
    sourcemapMainFileRelativeUrl,
    sourcemapMappingFileRelativeUrl,
  })

  try {
    const executionResult = await page.evaluate(
      /* istanbul ignore next */
      () => {
        return window.__jsenv__.executionResultPromise
      },
    )

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
