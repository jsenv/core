/* eslint-disable import/max-dependencies */
import { fork as forkChildProcess } from "child_process"
import { uneval } from "@dmail/uneval"
import { createCancellationToken } from "@dmail/cancellation"
import { JSENV_PATH } from "../JSENV_PATH-2.js"
import { createChildExecArgv } from "./createChildExecArgv.js"
import { generateNodeBundle } from "../bundle-service/index.js"
import { relativePathInception } from "../inception.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
} from "./launch-node-constant.js"
import { evalSource } from "../node-platform-service/node-platform/evalSource.js"
import { regexpEscape } from "../../src/stringHelper.js"
import {
  pathnameToOperatingSystemPath,
  operatingSystemPathToPathname,
} from "../operating-system-path.js"
import { LOG_LEVEL_OFF } from "../logger.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

const CONTROLLABLE_NODE_PATH = `${JSENV_PATH}/src/node-launcher/node-controllable.js`
const NODE_EXECUTE_TEMPLATE_RELATIVE_PATH = "/src/node-launcher/node-execute-template.js"
const NODE_EXECUTE_CLIENT_PATHNAME = "/.jsenv/node-execute.js"

export const launchNode = async ({
  cancellationToken = createCancellationToken(),
  compileServerOrigin,
  projectFolder,
  compileIntoRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = false,
  remap = true,
  traceWarnings = true,
  logLevel = LOG_LEVEL_OFF,
}) => {
  if (typeof compileServerOrigin !== "string")
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  if (typeof projectFolder !== "string")
    throw new TypeError(`projectFolder must be a string, got ${projectFolder}`)
  if (typeof compileIntoRelativePath !== "string")
    throw new TypeError(`compileIntoRelativePath must be a string, got ${compileIntoRelativePath}`)

  const projectPathname = operatingSystemPathToPathname(projectFolder)

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

  const child = forkChildProcess(CONTROLLABLE_NODE_PATH, {
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

  const executeFile = async (fileRelativePath, { collectNamespace, collectCoverage }) => {
    const execute = async () => {
      // seems the bundle below generated files cache is not hit for some reason, find why
      await generateNodeBundle({
        projectPathname,
        compileIntoRelativePath,
        importMapRelativePath,
        sourceRelativePath: relativePathInception({
          projectPathname,
          relativePath: NODE_EXECUTE_TEMPLATE_RELATIVE_PATH,
        }),
        compileRelativePath: NODE_EXECUTE_CLIENT_PATHNAME,
        babelPluginMap: jsenvBabelPluginMap,
        logLevel,
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
            compileServerOrigin,
            projectPathname,
            compileIntoRelativePath,
            fileRelativePath,
            collectNamespace,
            collectCoverage,
            remap,
          }),
        )
      })
    }

    const { status, coverageMap, exceptionSource, namespace } = await execute()
    if (status === "rejected") {
      return {
        status,
        error: evalException(exceptionSource, { compileServerOrigin, projectPathname }),
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

const evalException = (exceptionSource, { compileServerOrigin, projectPathname }) => {
  const error = evalSource(
    exceptionSource,
    `${JSENV_PATH}/src/node-platform-service/node-platform/index.js`,
  )
  if (error && error instanceof Error) {
    const sourceOrigin = `file://${projectPathname}`

    const compileServerOriginRegexp = new RegExp(regexpEscape(compileServerOrigin), "g")
    error.stack = error.stack.replace(compileServerOriginRegexp, sourceOrigin)
    error.message = error.message.replace(compileServerOriginRegexp, sourceOrigin)

    const projectPathnameRegexp = new RegExp(regexpEscape(`(?<!file:\/\/)${projectPathname}`), "g")
    error.stack = error.stack.replace(projectPathnameRegexp, sourceOrigin)
    error.message = error.message.replace(projectPathnameRegexp, sourceOrigin)
  }

  return error
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

const createNodeIIFEString = ({
  compileServerOrigin,
  projectPathname,
  compileIntoRelativePath,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
  remap,
}) => `(() => {
  const { execute } = require(${uneval(
    pathnameToOperatingSystemPath(
      `${projectPathname}${compileIntoRelativePath}${NODE_EXECUTE_CLIENT_PATHNAME}`,
    ),
  )})

  return execute({
    compileServerOrigin: ${uneval(compileServerOrigin)},
    projectPathname: ${uneval(projectPathname)},
    compileIntoRelativePath: ${uneval(compileIntoRelativePath)},
    fileRelativePath: ${uneval(fileRelativePath)},
    collectNamespace: ${uneval(collectNamespace)},
    collectCoverage: ${uneval(collectCoverage)},
    remap: ${uneval(remap)}
  })
})()`
