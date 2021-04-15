import { createRequire } from "module"

const require = createRequire(import.meta.url)
const { rollup } = require("rollup")

const rollupInputOptions = {
  input: "./sandbox/treeshaking-import-meta/main.js",
  treeshake: {
    propertyReadSideEffects: false,
  },
}
const rollupOutputOptions = {
  // https://rollupjs.org/guide/en#output-dir
  dir: String(new URL("./", import.meta.url)),
  // https://rollupjs.org/guide/en#output-format
  format: "es",
  // https://rollupjs.org/guide/en#output-sourcemap
  sourcemap: true,
}

const rollupReturnValue = await rollup(rollupInputOptions)
const rollupBuild = await rollupReturnValue.generate(rollupOutputOptions)

console.log(rollupBuild.output[0].code)
