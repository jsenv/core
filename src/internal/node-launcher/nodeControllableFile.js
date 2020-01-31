import { createRequire } from "module"

const require = createRequire(import.meta.url)

const { makeProcessControllable } = require("./makeProcessControllable.cjs")

makeProcessControllable({
  evaluate: async (expressionString) => {
    const sourceAsBase64 = Buffer.from(expressionString).toString("base64")
    const namespace = await import(`data:text/javascript;base64,${sourceAsBase64}`)
    const value = await namespace.default
    return value
  },
})
