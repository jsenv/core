import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import jsenvResolve from "../rollup-plugin-jsenv-resolve/index.js"

export const bundle = async ({ ressource, into, root, babelPlugins = [] }) => {
  if (!ressource) throw new TypeError(`bundle expect a ressource, got ${ressource}`)
  if (!into) throw new TypeError(`bundle expect into, got ${into}`)
  if (!root) throw new TypeError(`bundle expect root, got ${root}`)

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
        exclude: "node_modules/**",
        plugins: babelPlugins,
      }),
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
