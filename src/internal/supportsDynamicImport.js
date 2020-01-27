import { memoizeOnce } from "./memoizeOnce.js"

export const supportsDynamicImport = memoizeOnce(async () => {
  // ZXhwb3J0IGRlZmF1bHQgNDI= is Buffer.from("export default 42").toString("base64")

  try {
    // eslint-disable-next-line no-eval
    const asyncFunction = global.eval(`(async () => {
  const moduleSource = "data:text/javascript;base64,ZXhwb3J0IGRlZmF1bHQgNDI="
  const namespace = await import(moduleSource)
  return namespace.default
})`)
    const value = await asyncFunction()
    return value === 42
  } catch (e) {
    return false
  }
})
