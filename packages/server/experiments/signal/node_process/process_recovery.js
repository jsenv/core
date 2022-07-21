/*
 * This code MUST NOT BE USED
 * - First because you should not do anything when a process uncaughtException
 * or unhandled rejection happens.
 * You cannot assume assume or trust the state of your process so you're
 * likely going to throw an other error trying to handle the first one.
 * - Second because the error stack trace will be modified making it harder
 * to reach back what cause the error

 * Instead you should monitor your process with an other one
 * and when the monitored process die, here you can do what you want
 * like analysing logs to find what cause process to die, ping a log server, ...
*/

const exceptionHandlerSet = new Set()

export const addProcessExceptionHandler = (exceptionHandler) => {
  if (exceptionHandlerSet.size === 0) {
    install()
  }
  exceptionHandlerSet.add(exceptionHandler)
  return () => {
    exceptionHandlerSet.remove(exceptionHandler)
    if (exceptionHandlerSet.size === 0) {
      uninstall()
    }
  }
}

const uncaughtExceptionEventCallback = (error) =>
  triggerUncaughtException(error)

const unhandledRejectionEventCallback = (value, promise) =>
  triggerUnhandledRejection(value, promise)

const rejectionHandledEventCallback = (promise) =>
  recoverExceptionMatching((exception) => exception.promise === promise)

const install = () => {
  process.on("unhandledRejection", unhandledRejectionEventCallback)
  process.on("rejectionHandled", rejectionHandledEventCallback)
  process.on("uncaughtException", uncaughtExceptionEventCallback)
}

const uninstall = () => {
  process.removeListener("unhandledRejection", unhandledRejectionEventCallback)
  process.removeListener("rejectionHandled", rejectionHandledEventCallback)
  process.removeListener("uncaughtException", uncaughtExceptionEventCallback)
}

const triggerUncaughtException = (error) =>
  crash({ type: "uncaughtException", value: error })

const triggerUnhandledRejection = (value, promise) =>
  crash({ type: "unhandledRejection", value, promise })

let isCrashing = false
let crashReason
let resolveRecovering

const crash = async (reason) => {
  if (isCrashing) {
    console.log(`cannot recover due to ${crashReason.type} during recover`)
    console.error(crashReason.value)
    resolveRecovering(false)
    return
  }

  console.log(`process starts crashing due to ${crashReason.type}`)
  console.log(`trying to recover`)

  isCrashing = true
  crashReason = reason

  const externalRecoverPromise = new Promise((resolve) => {
    resolveRecovering = resolve
  })
  const callbackRecoverPromise = firstOperationMatching({
    array: Array.from(exceptionHandlerSet.values()),
    start: (exceptionHandler) => exceptionHandler(reason),
    predicate: (recovered) => typeof recovered === "boolean",
  })
  const recoverPromise = Promise.race([
    externalRecoverPromise,
    callbackRecoverPromise,
  ])

  try {
    const recovered = await recoverPromise
    if (recovered) return
  } catch (error) {
    console.error(`cannot recover due to internal recover error`)
    console.error(error)
  }

  crashReason = undefined
  // uninstall() prevent catching of the next throw
  // else the following would create an infinite loop
  // process.on('uncaughtException', function() {
  //     setTimeout(function() {
  //         throw 'yo';
  //     });
  // });
  uninstall()
  throw reason.value // this mess up the stack trace :'(
  /* eslint-disable no-unreachable */
  // the throw above may be catched by other mecanics
  // so we may arrive there
  install()
}

const recoverExceptionMatching = (predicate) => {
  if (isCrashing && predicate(crashReason)) {
    resolveRecovering(true)
  }
}

const firstOperationMatching = ({ array, start, predicate }) => {
  return new Promise((resolve, reject) => {
    const visit = (index) => {
      if (index >= array.length) {
        return resolve()
      }
      const input = array[index]
      const returnValue = start(input)
      return Promise.resolve(returnValue).then((output) => {
        if (predicate(output)) {
          return resolve(output)
        }
        return visit(index + 1)
      }, reject)
    }

    visit(0)
  })
}
