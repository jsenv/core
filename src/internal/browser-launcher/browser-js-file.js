import { installBrowserErrorStackRemapping } from "../error-stack-remapping/installBrowserErrorStackRemapping.js"
import { fetchAndEvalUsingXHR } from "../fetchAndEvalUsingXHR.js"

window.execute = async ({
  outDirectoryRelativeUrl,
  fileRelativeUrl,
  browserRuntimeFileRelativeUrl,
  sourcemapMainFileRelativeUrl,
  sourcemapMappingFileRelativeUrl,
  compileServerOrigin,
  transferableNamespace,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching the browser
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
  errorExposureInNotification = false,
  errorExposureInDocument = true,
}) => {
  const browserRuntimeCompiledFileRemoteUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}otherwise-global-bundle/${browserRuntimeFileRelativeUrl}`
  await fetchAndEvalUsingXHR(browserRuntimeCompiledFileRemoteUrl)
  const { __browserRuntime__ } = window

  const { compileDirectoryRelativeUrl, executeFile } = await __browserRuntime__.create({
    compileServerOrigin,
    outDirectoryRelativeUrl,
  })
  const compiledFileRemoteUrl = `${compileServerOrigin}/${compileDirectoryRelativeUrl}${fileRelativeUrl}`

  let errorTransform = (error) => error
  if (Error.captureStackTrace) {
    await fetchAndEvalUsingXHR(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
    const { SourceMapConsumer } = window.sourceMap
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
      SourceMapConsumer,
    })

    errorTransform = async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    }
  }

  return executeFile(compiledFileRemoteUrl, {
    transferableNamespace,
    executionId,
    errorExposureInConsole,
    errorExposureInNotification,
    errorExposureInDocument,
    errorTransform,
  })
}

window.addEventListener(
  "message",
  (messageEvent) => {
    const { data } = messageEvent

    if (typeof data === "object" && data !== null) {
      const { action, args } = data
      if (action === "evaluate") {
        const [functionSource, ...rest] = args
        perform(
          messageEvent,
          () => {
            // eslint-disable-next-line no-eval
            const fn = window.eval(functionSource)
            return fn(...rest)
          },
          action,
        )
      } else {
        // console.log(`received unknown message data:`, data)
      }
    } else {
      // console.log(`received unknown message data`, data)
    }
  },
  false,
)

const perform = async (messageEvent, fn, action) => {
  notifyAction(messageEvent, action, "will-start")

  let value
  let error
  try {
    value = await fn()
    error = false
  } catch (e) {
    value = e
    error = true
  }

  if (error) {
    notifyAction(messageEvent, action, "failure", value)
  } else {
    notifyAction(messageEvent, action, "completion", value)
  }
}

const notifyAction = (messageEvent, action, state, value) => {
  try {
    messageEvent.source.postMessage(
      {
        action,
        state,
        value,
      },
      messageEvent.origin,
    )
  } catch (e) {
    if (e.code !== DOMException.DATA_CLONE_ERR) {
      throw e
    }

    // value cannot be serialized, give up sending it
    messageEvent.source.postMessage(
      {
        action,
        state,
        cloneError: {
          stack: e.stack,
        },
      },
      messageEvent.origin,
    )
  }
}
