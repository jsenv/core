const { rollup } = require("rollup")
const babel = require("rollup-plugin-babel")
const nodeResolve = require("rollup-plugin-node-resolve")

export const packager = async ({ fileAbsolute, plugins, remap }) => {
  const bundle = await rollup({
    input: fileAbsolute,
    plugins: [
      nodeResolve({
        module: true,
      }),
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins,
      }),
    ],
    // skip rollup warnings
    // onwarn: () => {},
  })
  debugger

  // bundle.generate({
  //   format: "iife",
  //   name: "__browserPlatform__",
  //   sourcemap: remap,
  // })

  return bundle
}
