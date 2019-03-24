import { groupToBabelPluginDescription } from "../../group-description/index.js"
import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  importMap,
  projectFolder,
  into,
  globalName,
  entryPointsDescription,
  babelPluginDescription,
  groupDescription,
  compileId,
  log,
  minify,
}) => {
  const dir = `${projectFolder}/${into}/${compileId}`

  const groupBabelPluginDescription = groupToBabelPluginDescription(
    groupDescription[compileId],
    babelPluginDescription,
  )

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    importMap,
    projectFolder,
  })

  log(`
bundle entry points for browser with balancing.
compileId: ${compileId}
entryNameArray: ${Object.keys(entryPointsDescription)}
babelPluginNameArray: ${Object.keys(groupBabelPluginDescription)}
dir: ${dir}
minify: ${minify}
`)

  const babelRollupPlugin = babelPluginDescriptionToRollupPlugin({
    babelPluginDescription: groupBabelPluginDescription,
    minify,
    minifyOptions: { toplevel: false },
  })

  return {
    rollupParseOptions: {
      input: entryPointsDescription,
      plugins: [babelRollupPlugin, jsenvRollupPlugin],
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
