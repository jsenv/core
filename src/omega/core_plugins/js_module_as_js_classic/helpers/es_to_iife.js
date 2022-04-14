import { createRequire } from "node:module"
import { urlToBasename } from "@jsenv/filesystem"

const require = createRequire(import.meta.url)

export const esToIIFE = ({ name, url, ast, content }) => {
  const ESIIFE = require("es-iife")
  const result = ESIIFE.transform({
    ast,
    name,
    sourcemap: true,
    resolveGlobal: (specifier) => {
      const specifierUrl = new URL(specifier, url).href
      const globalName = urlToBasename(specifierUrl)
      return globalName
    },
    strict: true,
    code: content,
  })
  return {
    content: result.code,
    sourcemap: result.map,
  }
}
