import { uneval } from "@jsenv/core/node_modules/@jsenv/uneval/index.js"

export const unevalException = (value) => {
  if (value && value.hasOwnProperty("toString")) {
    delete value.toString
  }
  return uneval(value, { ignoreSymbols: true })
}
