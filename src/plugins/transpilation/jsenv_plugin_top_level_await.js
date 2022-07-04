import { applyBabelPlugins } from "@jsenv/ast"

import { requireBabelPlugin } from "./babel/require_babel_plugin.js"

export const jsenvPluginTopLevelAwait = () => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        if (context.isSupportedOnCurrentClients("top_level_await")) {
          return null
        }
        // when we don't use systemjs AND runtime do not support TLA
        // then async-to-promises will throw if there is TLA + exports
        // if we use systemjs however it will work
        // because we'll ignore it
        // in practice TLA + export on old runtimes is unusual, TLA should be reserved
        // to entry points where exports are not needed
        // it would be too much work to use systemjs just to support TLA + export
        // for now let async-to-promises throw in this case
        // (ideally jsenv would throw an error explaining all this)
        const willTransformJsModules =
          !context.isSupportedOnCurrentClients("script_type_module") ||
          !context.isSupportedOnCurrentClients("import_dynamic") ||
          !context.isSupportedOnCurrentClients("import_meta")
        // keep it untouched, systemjs will handle it
        if (willTransformJsModules) {
          return null
        }
        const usesTLA = await usesTopLevelAwait(urlInfo)
        if (!usesTLA) {
          return null
        }
        const { code, map } = await applyBabelPlugins({
          urlInfo,
          babelPlugins: [
            [
              requireBabelPlugin("babel-plugin-transform-async-to-promises"),
              {
                // Maybe we could pass target: "es6" when we support arrow function
                // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
                topLevelAwait: "simple",
                // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
                // externalHelpers: true,
                // externalHelpersPath: JSON.parse(
                //   context.referenceUtils.inject({
                //     type: "js_import_export",
                //     expectedType: "js_module",
                //     specifier:
                //       "babel-plugin-transform-async-to-promises/helpers.mjs",
                //   })[0],
                // ),
              },
            ],
          ],
        })
        return {
          content: code,
          sourcemap: map,
        }
      },
    },
  }
}

const usesTopLevelAwait = async (urlInfo) => {
  if (!urlInfo.content.includes("await ")) {
    return false
  }
  const { metadata } = await applyBabelPlugins({
    urlInfo,
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait],
  })
  return metadata.usesTopLevelAwait
}

const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false
        programPath.traverse({
          AwaitExpression: (path) => {
            const closestFunction = path.getFunctionParent()
            if (!closestFunction) {
              usesTopLevelAwait = true
              path.stop()
            }
          },
        })
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait
      },
    },
  }
}
