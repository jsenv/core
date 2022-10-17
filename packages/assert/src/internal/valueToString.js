import { inspect } from "@jsenv/inspect"

import { valueToWellKnown } from "./wellKnownValue.js"

export const valueToString = (value) => {
  return valueToWellKnown(value) || inspect(value)
}
