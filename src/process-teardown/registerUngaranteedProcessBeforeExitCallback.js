import { arrayWithoutValue } from "../arrayHelper.js"

let beforeExitCallbackArray = []
let uninstall

export const registerUngaranteedProcessBeforeExitCallback = (callback) => {
  if (beforeExitCallbackArray.length === 0) uninstall = install()
  beforeExitCallbackArray = [...beforeExitCallbackArray, callback]

  return () => {
    if (beforeExitCallbackArray.length === 0) return
    beforeExitCallbackArray = arrayWithoutValue(beforeExitCallbackArray, callback)
    if (beforeExitCallbackArray.length === 0) uninstall()
  }
}

const install = () => {
  const onBeforeExit = () => {
    return beforeExitCallbackArray.reduce(async (previous, callback) => {
      await previous
      return callback()
    }, Promise.resolve())
  }
  process.once("beforeExit", onBeforeExit)
  return () => {
    process.removeListener("beforeExit", onBeforeExit)
  }
}
