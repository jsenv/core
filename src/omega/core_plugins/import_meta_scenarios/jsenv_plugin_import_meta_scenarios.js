/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.test
 * - import.meta.build
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.test but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's build; the goal is to ensure it's tree-shaked)
 */

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

import { collectProgramImportMetas } from "@jsenv/utils/js_ast/program_import_metas.js"

export const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transform: {
      js_module: async ({ url, content }, { scenario }) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          url,
          content,
        })
        const { dev = [], test = [], build = [] } = metadata.importMetaScenarios
        const replacements = []
        const replace = (path, value) => {
          replacements.push({ path, value })
        }
        if (scenario === "dev") {
          dev.forEach((path) => {
            replace(path, "true")
          })
        } else if (scenario === "test") {
          // test is also considered a dev environment
          // just like the dev server can be used to debug test files
          // without this people would have to write
          // if (import.meta.dev || import.meta.test) or if (!import.meta.build)
          dev.forEach((path) => {
            replace(path, "true")
          })
          test.forEach((path) => {
            replace(path, "true")
          })
        } else if (scenario === "build") {
          // replacing by undefined might not be required
          // as I suppose rollup would consider them as undefined
          // but let's make it explicit to ensure code is properly tree-shaked
          dev.forEach((path) => {
            replace(path, "undefined")
          })
          test.forEach((path) => {
            replace(path, "undefined")
          })
          build.forEach((path) => {
            replace(path, "true")
          })
        }
        const magicSource = createMagicSource(content)
        replacements.forEach(({ path, value }) => {
          magicSource.replace({
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

const babelPluginMetadataImportMetaScenarios = () => {
  return {
    name: "metadata-import-meta-scenarios",
    visitor: {
      Program(programPath, state) {
        const importMetas = collectProgramImportMetas(programPath)
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          test: importMetas.test,
          build: importMetas.build,
        }
      },
    },
  }
}
