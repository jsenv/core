/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.test
 * - import.meta.preview
 * - import.meta.prod
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.test but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's preview/prod; the goal is to ensure it's tree-shaked)
 */

import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"

import { babelPluginMetadataImportMetaScenarios } from "./babel_plugin_metadata_import_meta_scenarios.js"

export const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transform: {
      js_module: async ({ scenario, parentUrlSite, url, content }) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          parentUrlSite,
          url,
          content,
        })
        const { dev, test, preview, prod } = metadata.importMetaScenarios
        const replacements = []
        const replace = (path, value) => {
          replacements.push({ path, value })
        }
        dev.forEach((path) => {
          if (scenario === "dev") {
            replace(path, true)
          } else if (scenario === "preview" || scenario === "prod") {
            replace(path, undefined)
          }
        })
        test.forEach((path) => {
          if (scenario === "test") {
            replace(path, true)
          } else if (scenario === "preview" || scenario === "prod") {
            replace(path, undefined)
          }
        })
        preview.forEach((path) => {
          if (scenario === "preview") {
            replace(path, true)
          } else if (scenario === "prod") {
            replace(path, undefined)
          }
        })
        prod.forEach((path) => {
          if (scenario === "prod") {
            replace(path, true)
          }
        })
        const magicSource = createMagicSource({ url, content })
        replacements.forEach(({ path, value }) => {
          magicSource.overwrite({
            start: path.node.start,
            end: path.node.end,
            replacement: value,
          })
        })
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}
