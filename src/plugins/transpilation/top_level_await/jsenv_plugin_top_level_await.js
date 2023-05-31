import { createRequire } from "node:module";
import { applyBabelPlugins } from "@jsenv/ast";

const require = createRequire(import.meta.url);

export const jsenvPluginTopLevelAwait = () => {
  return {
    name: "jsenv:top_level_await",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("top_level_await")) {
        return false;
      }
      // keep it untouched, systemjs will handle it
      if (context.systemJsTranspilation) {
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const usesTLA = await usesTopLevelAwait(urlInfo);
        if (!usesTLA) {
          return null;
        }
        const { code, map } = await applyBabelPlugins({
          babelPlugins: [
            [
              require("babel-plugin-transform-async-to-promises"),
              {
                // Maybe we could pass target: "es6" when we support arrow function
                // https://github.com/rpetrich/babel-plugin-transform-async-to-promises/blob/92755ff8c943c97596523e586b5fa515c2e99326/async-to-promises.ts#L55
                topLevelAwait: "simple",
                // enable once https://github.com/rpetrich/babel-plugin-transform-async-to-promises/pull/83
                // externalHelpers: true,
                // externalHelpersPath: JSON.parse(
                //   context.referenceUtils.inject({
                //     type: "js_import",
                //     expectedType: "js_module",
                //     specifier:
                //       "babel-plugin-transform-async-to-promises/helpers.mjs",
                //   })[0],
                // ),
              },
            ],
          ],
          input: urlInfo.content,
          inputIsJsModule: true,
          inputUrl: urlInfo.originalUrl,
          outputUrl: urlInfo.generatedUrl,
        });
        return {
          content: code,
          sourcemap: map,
        };
      },
    },
  };
};

const usesTopLevelAwait = async (urlInfo) => {
  if (!urlInfo.content.includes("await ")) {
    return false;
  }
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [babelPluginMetadataUsesTopLevelAwait],
    input: urlInfo.content,
    inputIsJsModule: true,
    inputUrl: urlInfo.originalUrl,
    outputUrl: urlInfo.generatedUrl,
  });
  return metadata.usesTopLevelAwait;
};

const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false;
        programPath.traverse({
          AwaitExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction || closestFunction.type === "Program") {
              usesTopLevelAwait = true;
              path.stop();
            }
          },
        });
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait;
      },
    },
  };
};
