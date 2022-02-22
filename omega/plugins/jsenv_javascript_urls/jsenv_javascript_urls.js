import { babelTransform } from "@jsenv/core/src/internal/transform_js/babel_transform.js"

import { createMagicSource } from "#internal/sourcemap/magic_source.js"

import { babelPluginMetadataUrlMentions } from "./babel_plugin_metadata_url_mentions.js"
import { urlToRelativeUrl } from "@jsenv/filesystem"
import { projectDirectoryUrl } from "@jsenv/core/jsenv.config.mjs"

export const jsenvJavaScriptUrlsPlugin = () => {
  return {
    name: "jsenv_javascript_urls",

    parse: async ({ callHook, url, contentType, content }) => {
      if (contentType !== "application/javascript") {
        return null
      }
      const { metadata } = await babelTransform({
        options: {
          plugins: [[babelPluginMetadataUrlMentions]],
        },
        url,
        content,
      })
      const { urlMentions } = metadata
      const references = []
      await urlMentions.reduce(
        async (
          previous,
          {
            type, // 'url', 'import_export'
            specifier,
            start,
            end,
          },
        ) => {
          await previous
          const url = await callHook("resolve", {
            urlSpecifier: specifier,
            baseUrl: url,
            type,
          })
          references.push({
            start,
            end,
            urlSpecifier: specifier,
            url,
          })
        },
        Promise.resolve(),
      )
      return references
    },

    transform: ({ url, contentType, content, references }) => {
      if (contentType !== "application/javascript") {
        return null
      }
      const magicSource = createMagicSource({ url, content })
      references.forEach((reference) => {
        magicSource.replace({
          start: reference.start,
          end: reference.end,
          // TODO: inject hmr if needed
          replacement: `/${urlToRelativeUrl(url, projectDirectoryUrl)}`,
        })
      })
      return magicSource.toContentAndSourcemap()
    },
  }
}
