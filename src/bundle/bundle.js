import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import jsenvResolve from "../rollup-plugin-jsenv-resolve/index.js"
import { transformAsync } from "@babel/core"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"

// list of things to do in order:
// - multiple bundle generation (with different babel plugins configuration)
// - create an entry file to decide which bundle to load on node
// - same on browser

export const bundle = async ({
  ressource,
  into,
  root,
  babelPlugins = [],
  transformAsyncToPromise = false,

  // here I should start a compileServer and
  // use it to get the transpiled file
  // so that we would benefit from filesystem cache
  // and avoid having different way of transpiling files
  // (can renove the babel stuff entirely)
  // jsenvResolve will also move here because it's easier
  // to do this I could add a load hook as described here:
  // https://rollupjs.org/guide/en#plugins

  // compileGroupCount
  // pluginMap // instead of babelPlugins array
  // pluginCompatMap,
  // platformUsageMap,
}) => {
  if (!ressource) throw new TypeError(`bundle expect a ressource, got ${ressource}`)
  if (!into) throw new TypeError(`bundle expect into, got ${into}`)
  if (!root) throw new TypeError(`bundle expect root, got ${root}`)

  babelPlugins.unshift(syntaxDynamicImport)

  const file = `${root}/${ressource}`
  const options = {
    input: file,
    plugins: [
      jsenvResolve({ root }),
      babel({
        babelrc: false,
        // https://babeljs.io/docs/en/options#parseropts
        parserOpts: {
          allowAwaitOutsideFunction: true,
        },
        // we must add dynamic import no ?
        exclude: "node_modules/**",
        plugins: babelPlugins,
      }),
      // {
      // https://rollupjs.org/guide/en#resolvedynamicimport
      // resolveDynamicImport: () => {
      //   return false
      // },
      // },
      {
        // https://rollupjs.org/guide/en#renderchunk
        // needed to transform top level await
        // and also the async keyword used here
        // https://github.com/rollup/rollup/blob/38f3ca676ba67d740ef5cd2967f8412f80feeafe/src/finalisers/system.ts#L185
        renderChunk: async (code, chunk) => {
          // renderChunk does not provide sourceMap, is this a bug ?
          // should open an issue here: https://github.com/rollup/rollup/issues
          if (!transformAsyncToPromise) return null

          const { code: chunkCode, map } = await transformAsync(code, {
            babelrc: false,
            filename: chunk.facadeModuleId,
            plugins: [transformAsyncToPromises],
            sourceMaps: true,
          })

          return { code: chunkCode, map }
        },
      },
    ],
    experimentalTopLevelAwait: true, // required here so that acorn can parse the module
    // skip rollup warnings
    // onwarn: () => {},
  }
  const rollupBundle = await rollup(options)

  const result = await rollupBundle.write({
    // https://rollupjs.org/guide/en#output-dir
    dir: `${root}/${into}`,
    // https://rollupjs.org/guide/en#output-format
    format: "system",
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    experimentalTopLevelAwait: true,
  })

  return result
}
