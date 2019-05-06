import { createCancellationSource } from "@dmail/cancellation"
import { uneval } from "@dmail/uneval"
import { registerProcessInterruptCallback } from "../process-signal/index.js"
import { installSourceMapSupport } from "./installSourceMapSupport.js"
import { fetchUsingHttp } from "../node-platform-service/node-platform/fetchUsingHttp.js"
import { evalSource } from "../node-platform-service/node-platform/evalSource.js"
import {
  WELL_KNOWN_SYSTEM_PATHNAME,
  SYSTEM_FILENAME,
} from "../compile-server/system-service/index.js"
import { WELL_KNOWN_NODE_PLATFORM_PATHNAME } from "../node-platform-service/index.js"

const execute = async ({
  projectFolder,
  compileServerOrigin,
  compileInto,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  remap,
}) => {
  if (remap) {
    installSourceMapSupport({ projectFolder })
  }

  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
  })

  const systemHref = `${compileServerOrigin}${WELL_KNOWN_SYSTEM_PATHNAME}`
  const systemResponse = await fetchUsingHttp(systemHref)
  if (systemResponse.status < 200 || systemResponse.status >= 400)
    throw new Error(
      createUnexpectedSystemResponseStatusErrorMessage({
        href: systemHref,
        status: systemResponse.status,
        statusText: systemResponse.statusText,
        body: systemResponse.body,
      }),
    )

  evalSource(systemResponse, SYSTEM_FILENAME)

  const { executeCompiledFile } = await global.System.import(
    `${compileServerOrigin}${WELL_KNOWN_NODE_PLATFORM_PATHNAME}`,
  )

  const { status, coverageMap, error, namespace } = await executeCompiledFile({
    sourceOrigin: `file://${projectFolder}`,
    compileServerOrigin,
    compileInto,
    filenameRelative,
    collectNamespace,
    collectCoverage,
  })
  if (status === "rejected") {
    sendToParent("execute-result", {
      status,
      error: exceptionToObject(error),
      coverageMap,
    })
    return
  }
  sendToParent("execute-result", {
    status,
    namespace,
    coverageMap,
  })
}

const createUnexpectedSystemResponseStatusErrorMessage = ({
  href,
  status,
  statusText,
  body,
}) => `system.js response unexpected status.
href: ${href}
status: ${status}
statusText: ${statusText}
body: ${body}`

const exceptionToObject = (exception) => {
  if (exception && exception instanceof Error) {
    const object = {}
    // indirectly this read exception.stack
    // which will ensure it leads to the right file path
    // thanks to sourceMapSupport
    // we may want to have something more explicit but for now it's cool
    Object.getOwnPropertyNames(exception).forEach((name) => {
      object[name] = exception[name]
    })
    return object
  }

  return {
    message: exception,
  }
}

const sendToParent = (type, data) => {
  // https://nodejs.org/api/process.html#process_process_connected
  // not connected anymore, cannot communicate with parent
  if (!process.connected) return

  // process.send algorithm does not send non enumerable values
  // because it works with JSON.stringify I guess so use uneval
  const source = uneval(data)

  process.send({
    type,
    data: source,
  })
}

const onceExecutionRequested = (callback) => listenParentOnce("execute", callback)

const listenParentOnce = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
      // commenting line below keep this process alive
      removeListener()
      callback(eval(`(${event.data})`))
    }
  }

  const removeListener = () => {
    process.removeListener("message", listener)
  }

  process.on("message", listener)
  return removeListener
}

const { token, cancel } = createCancellationSource()
token.register(
  registerProcessInterruptCallback(() => {
    // cancel will remove listener to process.on('message')
    // which is sufficient to let child process die
    // assuming nothing else keeps it alive
    cancel("process interrupt")

    // if something keeps it alive the process won't die
    // but this is the responsability of the code
    // to properly cancel stuff on 'SIGINT'
    // If code does not do that, a process forced exit
    // like process.exit() or child.kill() from parent
    // will ensure process dies
  }),
)
token.register(onceExecutionRequested(execute))
