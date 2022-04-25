import { requireBabelPlugin } from "@jsenv/babel-plugins"

import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

export const jsenvPluginTopLevelAwait = () => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    transform: {
      js_module: async (urlInfo, context) => {
        if (!urlInfo.data.usesTopLevelAwait) {
          return null
        }
        if (context.isSupportedOnCurrentClients("top_level_await")) {
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
