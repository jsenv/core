import { resolveUrl, urlToBasename } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"

export const esToIIFE = ({ name, url, ast, content }) => {
  const ESIIFE = require("es-iife")
  const result = ESIIFE.transform({
    ast,
    name,
    sourcemap: true,
    resolveGlobal: (specifier) => {
      const specifierUrl = resolveUrl(specifier, url)
      const globalName = urlToBasename(specifierUrl)
      return globalName
    },
    strict: true,
    code: content,
  })
  return {
    map: result.map,
    content: result.code,
  }
}
