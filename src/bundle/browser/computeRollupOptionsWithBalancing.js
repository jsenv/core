import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  projectFolder,
  into,
  entryPointsDescription,
  babelPluginDescription,
  compileId,
}) => {
  return {
    rollupParseOptions: {
      input: entryPointsDescription,
      rollupPluginArray: [
        createJsenvRollupPlugin({
          cancellationToken,
          projectFolder,
        }),
        babelPluginDescriptionToRollupPlugin({
          babelPluginDescription,
        }),
      ],
    },
    rollupGenerateOptions: {
      dir: `${projectFolder}/${into}/${compileId}`,
      format: "iife",
      name,
      sourcemap: true,
      sourceMapExcludeSources: true,
    },
  }
}
