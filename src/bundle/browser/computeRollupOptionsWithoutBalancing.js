import MagicString from "magic-string"
import { createJsenvRollupPlugin } from "../createJsenvRollupPlugin.js"
import { babelPluginDescriptionToRollupPlugin } from "../babelPluginDescriptionToRollupPlugin.js"

export const computeRollupOptionsWithoutBalancing = ({
  cancellationToken,
  importMap,
  projectFolder,
  into,
  globalPromiseName,
  globalName,
  entryPointsDescription,
  babelPluginDescription,
  autoWrapEntryInPromise,
  log,
}) => {
  const dir = `${projectFolder}/${into}`

  log(`
bundle entry points for browser without balancing.
entryNameArray: ${Object.keys(entryPointsDescription)}
babelPluginNameArray: ${Object.keys(babelPluginDescription)}
dir: ${dir}
`)

  const rollupPluginArray = [
    createJsenvRollupPlugin({
      cancellationToken,
      importMap,
      projectFolder,
    }),
    babelPluginDescriptionToRollupPlugin({
      babelPluginDescription,
    }),
    ...(autoWrapEntryInPromise
      ? [
          createIIFEPromiseRollupPlugin({
            projectFolder,
            globalPromiseName,
            globalName,
          }),
        ]
      : []),
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
      format: "iife",
      name: globalName,
      // https://rollupjs.org/guide/en#output-sourcemap
      sourcemap: true,
      sourceMapExcludeSources: true,
    },
  }
}

const createIIFEPromiseRollupPlugin = ({ globalPromiseName, globalName }) => {
  return {
    name: "iife-promise",

    // https://rollupjs.org/guide/en#renderchunk
    renderChunk: (code) => {
      const magicString = new MagicString(code)
      magicString.append(`
var ${globalPromiseName} = Promise.resolve(${globalName})`)
      const map = magicString.generateMap({ hires: true })
      const renderedCode = magicString.toString()
      return { code: renderedCode, map }
    },
  }
}
