import { catchCancellation } from "@jsenv/util"
import { getCommandArgument } from "./node-launcher/commandArguments.js"

export const wrapExternalFunctionExecution = async (fn) => {
  const uninstall = installUnhandledRejectionStrict()
  try {
    const value = await catchCancellation(fn)
    return value
  } finally {
    uninstall()
  }
}

const installUnhandledRejectionStrict = () => {
  const unhandledRejectionArg = getCommandArgument(process.execArgv, "--unhandled-rejections")
  if (unhandledRejectionArg === "strict") return () => {}

  const onUnhandledRejection = (reason) => {
    throw reason
  }
  process.once("unhandledRejection", onUnhandledRejection)
  return () => {
    process.removeListener("unhandledRejection", onUnhandledRejection)
  }
}
