/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.build
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.build but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's build; the goal is to ensure it's tree-shaked)
 */

import { createMagicSource } from "@jsenv/sourcemap"
import { applyBabelPlugins } from "@jsenv/ast"

export const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        if (
          !urlInfo.content.includes("import.meta.dev") &&
          !urlInfo.content.includes("import.meta.test") &&
          !urlInfo.content.includes("import.meta.build")
        ) {
          return null
        }
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaScenarios],
          urlInfo,
        })
        const { dev = [], build = [] } = metadata.importMetaScenarios
        const replacements = []
        const replace = (path, value) => {
          replacements.push({ path, value })
        }
        if (context.scenarios.build) {
          // during build ensure replacement for tree-shaking
          dev.forEach((path) => {
            replace(path, "undefined")
          })
          build.forEach((path) => {
            replace(path, "true")
          })
        } else {
          // during dev we can let "import.meta.build" untouched
          // it will be evaluated to undefined.
          // Moreover it can be surprising to see some "undefined"
          // when source file contains "import.meta.build"
          dev.forEach((path) => {
            replace(path, "true")
          })
        }
        const magicSource = createMagicSource(urlInfo.content)
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
        const importMetas = {}
        programPath.traverse({
          MemberExpression(path) {
            const { node } = path
            const { object } = node
            if (object.type !== "MetaProperty") {
              return
            }
            const { property: objectProperty } = object
            if (objectProperty.name !== "meta") {
              return
            }
            const { property } = node
            const { name } = property
            const importMetaPaths = importMetas[name]
            if (importMetaPaths) {
              importMetaPaths.push(path)
            } else {
              importMetas[name] = [path]
            }
          },
        })
        state.file.metadata.importMetaScenarios = {
          dev: importMetas.dev,
          build: importMetas.build,
        }
      },
    },
  }
}
