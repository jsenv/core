const { rollup } = require("rollup")
const babel = require("rollup-plugin-babel")
const nodeResolve = require("rollup-plugin-node-resolve")

const modulePluginNames = ["transform-modules-systemjs", "transform-module-common-js"]

export const packager = async ({ fileAbsolute, pluginMap, remap }) => {
  const plugins = Object.keys(pluginMap)
    .filter((pluginName) => modulePluginNames.indexOf(pluginName) === -1)
    .map((pluginName) => pluginMap[pluginName])

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

  const { code, map } = await bundle.generate({
    format: "iife",
    name: "__browserPlatform__",
    sourcemap: remap,
    // file: outputFile,
  })

  return {
    code,
    map,
  }
}
