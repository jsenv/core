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
  autoWrapEntryInPromise, // unused anymore, maybe to remove completely
  log,
  minify,
}) => {
  const dir = `${projectFolder}/${into}`

  log(`
bundle entry points for browser without balancing.
entryNameArray: ${Object.keys(entryPointsDescription)}
babelPluginNameArray: ${Object.keys(babelPluginDescription)}
dir: ${dir}
minify: ${minify}
`)

  const rollupPluginArray = [
    babelPluginDescriptionToRollupPlugin({
      babelPluginDescription,
      minify,
      target: "browser",
    }),
    createJsenvRollupPlugin({
      cancellationToken,
      importMap,
      projectFolder,
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
      // we could exclude them
      // but it's better to put them directly
      // in case source files are not reachable
      // for whatever reason
      sourcemapExcludeSources: false,
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
