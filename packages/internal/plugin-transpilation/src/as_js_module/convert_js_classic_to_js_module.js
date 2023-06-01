import { applyBabelPlugins } from "@jsenv/ast";
import { composeTwoSourcemaps } from "@jsenv/sourcemap";

export const convertJsClassicToJsModule = async ({
  isWebWorker,
  input,
  inputSourcemap,
  inputUrl,
  outputUrl,
}) => {
  const { code, map } = await applyBabelPlugins({
    babelPlugins: [[babelPluginReplaceTopLevelThis, { isWebWorker }]],
    input,
    inputIsJsModule: false,
    inputUrl,
    outputUrl,
  });
  const sourcemap = await composeTwoSourcemaps(inputSourcemap, map);
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
