import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import jsenvResolve from "../rollup-plugin-jsenv-resolve/index.js"

export const bundle = async ({ ressource, into, babelPlugins = [], root }) => {
  const file = `${root}/${ressource}`

  const options = {
    input: file,
    plugins: [
      jsenvResolve(),
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins: babelPlugins,
      }),
    ],
    // skip rollup warnings
    // onwarn: () => {},
  }

  const rollupBundle = await rollup(options)

  const result = await rollupBundle.generate({
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
