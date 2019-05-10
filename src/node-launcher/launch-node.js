import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { createCancellationToken } from "@dmail/cancellation"
import { ROOT_FOLDER } from "../ROOT_FOLDER-2.js"
import { createChildExecArgv } from "./createChildExecArgv.js"
import { generateNodeBundle } from "../bundle-service/index.js"
import { filenameRelativeInception } from "../inception.js"
import {
  DEFAULT_COMPILE_INTO,
  DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
} from "./launch-node-constant.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")

const controllableNodeProcessFilename = `${ROOT_FOLDER}/src/node-launcher/node-controllable.js`

export const launchNode = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileServerOrigin,
  compileInto = DEFAULT_COMPILE_INTO,
  importMapFilenameRelative = DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
  remap = true,
  traceWarnings = true,
  verbose = false,
}) => {
  if (typeof projectFolder !== "string")
    throw new TypeError(`projectFolder must be a string, got ${projectFolder}`)
  if (typeof compileServerOrigin !== "string")
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  if (typeof compileInto !== "string")
    throw new TypeError(`compileInto must be a string, got ${compileInto}`)

  const execArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    processExecArgv: process.execArgv,
    processDebugPort: process.debugPort,
  })
  if (traceWarnings && !execArgv.includes("--trace-warnings")) {
    execArgv.push("--trace-warnings")
  }

  const child = forkChildProcess(controllableNodeProcessFilename, {
    execArgv,
    // silent: true
    stdio: "pipe",
  })

  const consoleCallbackArray = []
  const registerConsoleCallback = (callback) => {
    consoleCallbackArray.push(callback)
  }
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  child.stdout.on("data", (chunk) => {
    const text = String(chunk)
    consoleCallbackArray.forEach((callback) => {
      callback({
        type: "log",
        text,
      })
    })
  })
  child.stderr.on("data", (chunk) => {
    const text = String(chunk)
    consoleCallbackArray.forEach((callback) => {
      callback({
        type: "error",
        text,
      })
    })
  })

  const errorCallbackArray = []
  const registerErrorCallback = (callback) => {
    errorCallbackArray.push(callback)
  }
  const emitError = (error) => {
    errorCallbackArray.forEach((callback) => {
      callback(error)
    })
  }
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const errorEventRegistration = registerChildEvent(child, "error", (error) => {
    errorEventRegistration.unregister()
    exitErrorRegistration.unregister()
    emitError(error)
  })
  // process.exit(1) from child
  const exitErrorRegistration = registerChildEvent(child, "exit", (code) => {
    if (code !== 0 && code !== null) {
      errorEventRegistration.unregister()
      exitErrorRegistration.unregister()
      emitError(createExitWithFailureCodeError(code))
    }
  })

  // https://nodejs.org/api/child_process.html#child_process_event_disconnect
  const registerDisconnectCallback = (callback) => {
    const registration = registerChildEvent(child, "disconnect", () => {
      callback()
    })
    return () => {
      registration.unregister()
    }
  }

  const stop = () => {
    const disconnectedPromise = new Promise((resolve) => {
      const unregister = registerDisconnectCallback(() => {
        unregister()
        resolve()
      })
    })
    child.kill("SIGINT")
    return disconnectedPromise
  }

  const stopForce = () => {
    const disconnectedPromise = new Promise((resolve) => {
      const unregister = registerDisconnectCallback(() => {
        unregister()
        resolve()
      })
    })
    child.kill()
    return disconnectedPromise
  }

  const executeFile = async (filenameRelative, { collectNamespace, collectCoverage }) => {
    const execute = async () => {
      const nodeExecuteFilenameRelative = filenameRelativeInception({
        projectFolder,
        filenameRelative: "src/node-launcher/node-execute-template.js",
      })

      // seems the bundle below generated files cache is not hit for some reason, find why
      await generateNodeBundle({
        projectFolder,
        importMapFilenameRelative,
        compileInto,
        babelConfigMap,
        filenameRelative: ".jsenv/node-execute.js",
        sourceFilenameRelative: nodeExecuteFilenameRelative,
        verbose,
      })

      return new Promise((resolve, reject) => {
        const executResultRegistration = registerChildMessage(
          child,
          "evaluate-result",
          ({ error, value }) => {
            executResultRegistration.unregister()
            if (error) {
              reject(value)
            } else {
              resolve(value)
            }
          },
        )

        sendToChild(
          child,
          "evaluate",
          createNodeIIFEString({
            projectFolder,
            compileServerOrigin,
            compileInto,
            filenameRelative,
            collectNamespace,
            collectCoverage,
            remap,
          }),
        )
      })
    }

    const { status, coverageMap, error, namespace } = await execute()
    if (status === "rejected") {
      return {
        status,
        error: errorToSourceError(error, { projectFolder, filenameRelative }),
        coverageMap,
      }
    }
    return {
      status,
      coverageMap,
      namespace,
    }
  }

  return {
    name: "node",
    version: process.version.slice(1),
    options: { execArgv },
    stop,
    stopForce,
    registerDisconnectCallback,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile,
  }
}

const sendToChild = (child, type, data) => {
  const source = uneval(data, { showFunctionBody: true })
  child.send({
    type,
    data: source,
  })
}

const registerChildMessage = (child, type, callback) => {
  return registerChildEvent(child, "message", (message) => {
    if (message.type === type) {
      callback(eval(`(${message.data})`))
    }
  })
}

const registerChildEvent = (child, type, callback) => {
  child.on(type, callback)

  const unregister = () => {
    child.removeListener(type, callback)
  }

  const registration = {
    unregister,
  }
  return registration
}

const createExitWithFailureCodeError = (code) => {
  if (code === 12) {
    return new Error(
      `child exited with 12: forked child wanted to use a non available port for debug`,
    )
  }
  return new Error(`child exited with ${code}`)
}

const errorToSourceError = (
  error,
  // { filenameRelative, sourceOrigin }
) => {
  if (error && error.code === "MODULE_PARSE_ERROR") {
    // error.message = error.message.replace(filenameRelative, `${sourceOrigin}/${filenameRelative}`)
    return error
  }

  if (error && typeof error === "object") {
    return error
  }

  return error
}

const createNodeIIFEString = ({
  projectFolder,
  compileServerOrigin,
  compileInto,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  remap,
}) => `(() => {
  const { execute } = require(${uneval(`${projectFolder}/${compileInto}/.jsenv/node-execute.js`)})

  return execute({
    projectFolder: ${uneval(projectFolder)},
    compileServerOrigin: ${uneval(compileServerOrigin)},
    compileInto: ${uneval(compileInto)},
    filenameRelative: ${uneval(filenameRelative)},
    collectNamespace: ${uneval(collectNamespace)},
    collectCoverage: ${uneval(collectCoverage)},
    remap: ${uneval(remap)}
  })
})()`
