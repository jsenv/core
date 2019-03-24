import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  importMap,
  projectFolder,
  into,
  entryPointsDescription,
  babelPluginDescription,
  log,
  minify,
}) => {
  const dir = `${projectFolder}/${into}`

  log(`
bundle entry points for node without balancing.
entryNameArray: ${Object.keys(entryPointsDescription)}
babelPluginNameArray: ${Object.keys(babelPluginDescription)}
dir: ${dir}
minify: ${minify}
`)

  const rollupPluginArray = [
    babelPluginDescriptionToRollupPlugin({
      babelPluginDescription,
      minify,
      minifyOptions: { toplevel: true },
    }),
    createJsenvRollupPlugin({
      cancellationToken,
      importMap,
      projectFolder,
    }),
  ]

  return {
    rollupParseOptions: {
      input: entryPointsDescription,
      plugins: rollupPluginArray,
    },
    rollupGenerateOptions: {
      // https://rollupjs.org/guide/en#output-dir
      dir,
      // https://rollupjs.org/guide/en#output-format
      format: "cjs",
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      sourceMapExcludeSources: false,
    },
  }
}
