const { rollup } = require("rollup")
const babel = require("rollup-plugin-babel")
const nodeResolve = require("rollup-plugin-node-resolve")

export const packager = async ({ file, fileAbsolute, plugins, remap }) => {
  // https://rollupjs.org/guide/en#big-list-of-options
  const options = {
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
  }

  const bundle = await rollup(options)

  const { code, map } = await bundle.generate({
    format: "iife",
    name: "__browserPlatform__",
    sourcemap: remap,
    // sourcemapFile: file,
  })
  // map.sources are relative to this project root
  // I think rollup find a package.json and makes sourcemap relative to it
  // what I want instead is to make them relative to localRoot somehow
  // but for now this behaviour is enough
  map.file = file

  return {
    code,
    map,
  }
}
