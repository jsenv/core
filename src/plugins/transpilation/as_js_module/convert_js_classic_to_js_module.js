import { applyBabelPlugins } from "@jsenv/ast";
import { composeTwoSourcemaps } from "@jsenv/sourcemap";

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js";

export const convertJsClassicToJsModule = async ({
  urlInfo,
  jsClassicUrlInfo,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [
      [
        babelPluginReplaceTopLevelThis,
        {
          isWebWorker: isWebWorkerUrlInfo(urlInfo),
        },
      ],
    ],
    urlInfo: jsClassicUrlInfo,
  });
  const sourcemap = await composeTwoSourcemaps(jsClassicUrlInfo.sourcemap, map);
  return {
    content: code,
    sourcemap,
  };
};

const babelPluginReplaceTopLevelThis = () => {
  return {
    name: "replace-top-level-this",
    visitor: {
      Program: (programPath, state) => {
        const { isWebWorker } = state.opts;
        programPath.traverse({
          ThisExpression: (path) => {
            const closestFunction = path.getFunctionParent();
            if (!closestFunction) {
              path.replaceWithSourceString(isWebWorker ? "self" : "window");
            }
          },
        });
      },
    },
  };
};
