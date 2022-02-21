/*
 * https://github.com/preactjs/prefresh/blob/85475cf4bc4492f76c284c9fb80ddb5597fc9cd3/packages/vite/src/index.js#L36
 */

import prefreshBabelPlugin from "@prefresh/babel-plugin"
import {
  normalizeStructuredMetaMap,
  urlToMeta,
  urlToFileSystemPath,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { createMagicSource } from "@jsenv/core/src/internal/sourcemap/magic_source.js"
import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"
import { babelPluginSyntaxes } from "@jsenv/core/src/internal/compile_server/js/babel_plugin_syntaxes.js"

export const createPrefreshHmrPlugin = ({ urlPatterns } = {}) => {
  const structuredMetaMap = normalizeStructuredMetaMap(
    {
      includes: {
        "**/*.jsx": true,
        "**/*.tsx": true,
        ...urlPatterns,
      },
    },
    "file://",
  )
  const shouldTransform = (url) => {
    return urlToMeta({ url, structuredMetaMap }).includes
  }
  return {
    name: "prefresh",
    transform: async ({ projectDirectoryUrl, url, contentType, content }) => {
      if (contentType !== "application/javascript") {
        return null
      }
      if (!shouldTransform(url)) {
        return null
      }
      const result = await babelTransform({
        options: {
          filename: urlToFileSystemPath(url),
          filenameRelative: urlToRelativeUrl(url, projectDirectoryUrl),
          configFile: false,
          babelrc: false, // trust only these options, do not read any babelrc config file
          sourceMaps: false,
          parserOpts: {
            allowAwaitOutsideFunction: true,
            plugins: ["jsx"],
          },
          generatorOpts: {
            compact: false,
          },
          plugins: [
            [babelPluginSyntaxes],
            [prefreshBabelPlugin, { skipEnvCheck: true }],
          ],
        },
        url,
        code: content,
      })
      const magicSource = createMagicSource({
        url,
        content: result.code,
        map: result.map,
      })
      const hasReg = /\$RefreshReg\$\(/.test(result.code)
      const hasSig = /\$RefreshSig\$\(/.test(result.code)
      if (!hasSig && !hasReg) {
        return content
      }
      magicSource.prepend(`import { installPrefresh } from "@jsenv/core/src/internal/autoreload/prefresh/prefresh.js"
const __prefresh__ = installPrefresh(import.meta.url)
`)
      if (hasReg) {
        magicSource.append(`
__prefresh__.end()
import.meta.hot.accept(__prefresh__.acceptCallback)`)
      }
      return magicSource.toStringAndMap()
    },
  }
}
