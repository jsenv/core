import { arrayWithout } from "../arrayHelper.js"
import { promiseMatch } from "../promiseHelper.js"

let recoverCallbackArray = []
let uninstall

export const registerProcessCrash = (recoverCallback) => {
  if (recoverCallbackArray.length === 0) uninstall = install()
  recoverCallbackArray = [...recoverCallbackArray, recoverCallback]
  return () => {
    if (recoverCallbackArray.length === 0) return
    recoverCallbackArray = arrayWithout(recoverCallbackArray, recoverCallback)
    if (recoverCallbackArray.length === 0) uninstall()
  }
}

const install = () => {
  const onUncaughtException = (error) => triggerUncaughtException(error)

  const onUnhandledRejection = (value, promise) => triggerUnhandledRejection(value, promise)

  const onRejectionHandled = (promise) =>
    recoverExceptionMatching((exception) => exception.promise === promise)

  process.on("unhandledRejection", onUnhandledRejection)
  process.on("rejectionHandled", onRejectionHandled)
  process.on("uncaughtException", onUncaughtException)

  return () => {
    process.removeListener("unhandledRejection", onUnhandledRejection)
    process.removeListener("rejectionHandled", onRejectionHandled)
    process.removeListener("uncaughtException", onRejectionHandled)
  }
}

const triggerUncaughtException = (error) => crash({ type: "uncaughtException", value: error })

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
  const callbackRecoverPromise = promiseMatch(
    recoverCallbackArray,
    reason,
    (recovered) => typeof recovered === "boolean",
  )
  const recoverPromise = Promise.race([externalRecoverPromise, callbackRecoverPromise])

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
  uninstall = install()
}

const recoverExceptionMatching = (predicate) => {
  if (isCrashing && predicate(crashReason)) {
    resolveRecovering(true)
  }
}
