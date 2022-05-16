import { createDetailedMessage } from "@jsenv/logger"

import { getRessourceTrace } from "@jsenv/core/src/internal/url_context.js"

export const fromFunctionReturningNamespace = (fn, data) => {
  return fromFunctionReturningRegisteredModule(() => {
    // should we compute the namespace here
    // or as it is done below, defer to execute ?
    // I think defer to execute is better
    return [
      [],
      (_export) => {
        return {
          execute: () => {
            const namespace = fn()
            _export(namespace)
          },
        }
      },
    ]
  }, data)
}

export const fromFunctionReturningRegisteredModule = (fn, data) => {
  try {
    return fn()
  } catch (error) {
    if (error.name === "SyntaxError") {
      throw new Error(
        createDetailedMessage(`Syntax error in module.`, {
          "syntax error stack": error.stack,
          ...getRessourceTrace(data),
        }),
      )
    }
    throw new Error(
      createDetailedMessage(`Module instantiation error.`, {
        ["instantiation error stack"]: error.stack,
        ...getRessourceTrace(data),
      }),
    )
  }
}

// const textToBase64 =
//   typeof window === "object"
//     ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
//     : (text) => Buffer.from(text, "utf8").toString("base64")
