import { groupToBabelPluginDescription } from "../../group-description/index.js"
import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  projectFolder,
  into,
  globalName,
  entryPointsDescription,
  babelPluginDescription,
  groupDescription,
  compileId,
  log,
}) => {
  const dir = `${projectFolder}/${into}/${compileId}`

  const groupBabelPluginDescription = groupToBabelPluginDescription(
    groupDescription[compileId],
    babelPluginDescription,
  )

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectFolder,
  })

  const babelRollupPlugin = babelPluginDescriptionToRollupPlugin({
    babelPluginDescription: groupBabelPluginDescription,
  })

  log(`
bundle entry points for browser with balancing.
compileId: ${compileId}
entryNameArray: ${Object.keys(entryPointsDescription)}
babelPluginNameArray: ${Object.keys(groupBabelPluginDescription)}
dir: ${dir}
`)

  return {
    rollupParseOptions: {
      input: entryPointsDescription,
      plugins: [jsenvRollupPlugin, babelRollupPlugin],
    },
    rollupGenerateOptions: {
      dir,
      format: "iife",
      name: globalName,
      sourcemap: true,
      sourceMapExcludeSources: true,
    },
  }
}
