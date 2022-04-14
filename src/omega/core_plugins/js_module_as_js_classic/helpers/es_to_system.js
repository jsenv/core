import { createRequire } from "node:module"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

const require = createRequire(import.meta.url)

export const esToSystem = async ({ url, generatedUrl, content }) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [require("@babel/plugin-transform-modules-systemjs")],
    url,
    generatedUrl,
    content,
  })
  return {
    content: code,
    sourcemap: map,
  }
}
